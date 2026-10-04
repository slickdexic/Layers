/* eslint-env node */
/* global BigInt */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const { scopedRestorePlan } = require( './helpers/scoped-identity-receipt.js' );

test.describe.configure( { mode: 'serial' } );

function verifiedOwnCleanup( owner, config ) {
	const receiptPath = process.env.LAYERS_ACCEPTANCE_CLEANUP_RECEIPT;
	if ( !receiptPath || owner.user !== config.username ) {
		return false;
	}
	const receipt = JSON.parse( fs.readFileSync( receiptPath, 'utf8' ) );
	const baseline = receipt.baselines?.find( ( item ) => item.owner === owner.owner );
	const cleanup = receipt.cleanup?.find( ( item ) => item.owner === owner.owner );
	if ( !baseline || !cleanup?.restored || receipt.cleanupErrors?.length !== 0 ||
		baseline.pageId !== owner.pageId || cleanup.restored !== owner.revision ) {
		return false;
	}
	expect( owner.slotContent ).toEqual( baseline.slots );
	expect( owner.snapshot ).toEqual( baseline.snapshot );
	return true;
}

async function acceptanceSession( context ) {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	expect( configPath && fs.existsSync( configPath ), 'Original acceptance configuration is required' ).toBeTruthy();
	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	expect( [ '', '/', '/index.php' ] ).toContain( url.pathname );
	expect( url.search + url.hash + url.username + url.password ).toBe( '' );
	const base = url.origin;
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ? await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( { action: 'login', lgname: config.username, lgpassword: config.password,
		lgtoken: loginToken }, true );
	expect( login.login.result ).toBe( 'Success' );
	return { api, base, config };
}

test( 'J112C2 read-only provisioned owner and local PDF preflight', async ( { context }, testInfo ) => {
	test.skip( !!process.env.LAYERS_ACCEPTANCE_RESTORE_RECEIPT, 'Cleanup-only mode cannot start normal scenarios' );
	const { api, base, config } = await acceptanceSession( context );
	const site = await api( { action: 'query', meta: 'siteinfo', siprop: 'general' } );
	const serverTime = Date.parse( site.query.general.time );
	expect( Number.isFinite( serverTime ), 'The wiki must supply its current time' ).toBe( true );
	const owners = [];
	for ( const owner of [ 'Layers_browser_acceptance', 'Layers_browser_scoped_source' ] ) {
		const result = await api( { action: 'query', prop: 'info|revisions', titles: owner,
			rvprop: 'ids|timestamp|user|content|contentmodel', rvslots: '*', rvlimit: 1 } );
		const current = result.query.pages[ 0 ];
		expect( current.missing, `Dedicated owner ${ owner } must already exist` ).toBeUndefined();
		const revision = current.revisions[ 0 ];
		const read = await api( { action: 'layersread', owner, revid: String( revision.revid ) } );
		owners.push( { owner, pageId: current.pageid, revision: revision.revid, timestamp: revision.timestamp,
			user: revision.user, main: revision.slots.main.content, slots: Object.keys( revision.slots ),
			slotContent: revision.slots,
			snapshot: read.layersread?.snapshot, readError: read.error?.code } );
	}
	const files = ( await api( { action: 'query', list: 'allimages', aimime: 'application/pdf',
		ailimit: 50, aiprop: 'timestamp|sha1|size|mime' } ) ).query.allimages;
	const pdfs = [];
	for ( const file of files ) {
		const result = await api( { action: 'query', titles: 'File:' + file.name, prop: 'imageinfo',
			iiprop: 'timestamp|sha1|size|mime' } );
		const info = result.query.pages[ 0 ];
		if ( info.imagerepository === 'local' && info.imageinfo?.[ 0 ]?.pagecount >= 2 ) {
			pdfs.push( { title: info.title, ...info.imageinfo[ 0 ] } );
		}
	}
	const reportPath = testInfo.outputPath( 'provisioned-fixtures.json' );
	fs.writeFileSync( reportPath, JSON.stringify( { base, owners, pdfs }, null, 2 ) );
	await testInfo.attach( 'provisioned-fixtures.json', { path: reportPath, contentType: 'application/json' } );
	for ( const owner of owners ) {
		expect( owner.readError, `Exact baseline of ${ owner.owner } must be readable` ).toBeUndefined();
		expect( owner.slots.slice().sort() ).toEqual( [ 'layers', 'main' ] );
		expect( owner.slotContent.main.contentmodel ).toBe( 'wikitext' );
		expect( owner.slotContent.main.contentformat ).toBe( 'text/x-wiki' );
		expect( owner.slotContent.layers.contentmodel ).toBe( 'layers-document' );
		expect( owner.slotContent.layers.contentformat ).toBe( 'application/json' );
		for ( const slot of Object.values( owner.slotContent ) ) {
			expect( typeof slot.content, 'Exact serialized slot bytes must be available for cleanup' ).toBe( 'string' );
		}
		expect( owner.snapshot?.schemaVersion, 'A complete Layers snapshot is required' ).toBe( 1 );
		expect( Array.isArray( owner.snapshot?.surfaces ), 'Snapshot surfaces must be present' ).toBe( true );
		expect( JSON.parse( owner.slotContent.layers.content ) ).toEqual( owner.snapshot );
		const sourceOwner = owner.owner === 'Layers_browser_scoped_source';
		const baselineMain = sourceOwner ? 'Dedicated automated Layers scoped source acceptance page.' :
			'Dedicated automated Layers history acceptance page.';
		expect( owner.main, 'The dedicated owner must be at its provisioned baseline' ).toBe( baselineMain );
		if ( sourceOwner ) {
			expect( owner.snapshot ).toEqual( { schemaVersion: 1, surfaces: [] } );
		}
		const revisionTime = Date.parse( owner.timestamp );
		expect( Number.isFinite( revisionTime ) ).toBe( true );
		const ageMinutes = ( serverTime - revisionTime ) / 60000;
		const knownFreshSourceBaseline = sourceOwner && owner.pageId === 272 && owner.revision === 2742 &&
			owner.user === config.username;
		expect( ageMinutes >= 10 || knownFreshSourceBaseline || verifiedOwnCleanup( owner, config ),
			`Owner ${ owner.owner } must be quiet for ten minutes or be this actor's exact new source baseline` )
			.toBe( true );
	}
	expect( pdfs.length, 'A readable existing local PDF with at least two pages is required; no upload is authorized' )
		.toBeGreaterThan( 0 );
} );

test( 'J112C2 scoped editor, PDF rename, copy and draft acceptance', async ( { page, context }, testInfo ) => {
	test.skip( !!process.env.LAYERS_ACCEPTANCE_RESTORE_RECEIPT, 'Cleanup-only mode cannot start normal scenarios' );
	test.setTimeout( 600000 );
	const { api, base, config } = await acceptanceSession( context );
	const token = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;
	const evidence = { base, steps: [], cleanup: [], browserErrors: [] };
	page.on( 'pageerror', ( error ) => evidence.browserErrors.push( error.message ) );
	page.on( 'dialog', ( dialog ) => dialog.accept() );
	const current = async ( owner ) => ( await api( { action: 'query', titles: owner, prop: 'info|revisions',
		rvprop: 'ids|timestamp|user|content|contentmodel|tags|comment', rvslots: '*', rvlimit: 1 } ) ).query.pages[ 0 ];
	const read = async ( record, revision = record.lastOwnedRevision ) => {
		const result = await api( { action: 'layersread', owner: record.owner, revid: String( revision ) } );
		expect( result.error ).toBeUndefined();
		return result.layersread.snapshot;
	};
	const serverTime = Date.parse( ( await api( { action: 'query', meta: 'siteinfo', siprop: 'general' } ) )
		.query.general.time );
	const records = [];
	for ( const owner of [ 'Layers_browser_acceptance', 'Layers_browser_scoped_source' ] ) {
		const info = await current( owner );
		expect( info.missing ).toBeUndefined();
		const revision = info.revisions[ 0 ];
		const record = { owner, pageId: info.pageid, baseline: revision, lastOwnedRevision: revision.revid,
			changed: false, unknownSave: false };
		record.snapshot = await read( record );
		expect( Object.keys( revision.slots ).sort() ).toEqual( [ 'layers', 'main' ] );
		expect( JSON.parse( revision.slots.layers.content ) ).toEqual( record.snapshot );
		expect( revision.slots.main.contentmodel ).toBe( 'wikitext' );
		expect( revision.slots.layers.contentmodel ).toBe( 'layers-document' );
		const source = owner === 'Layers_browser_scoped_source';
		expect( revision.slots.main.content ).toBe( source ?
			'Dedicated automated Layers scoped source acceptance page.' :
			'Dedicated automated Layers history acceptance page.' );
		if ( source ) {
			expect( record.snapshot ).toEqual( { schemaVersion: 1, surfaces: [] } );
		} else {
			expect( record.snapshot.surfaces.map( ( surface ) => [ surface.id, surface.kind, surface.label ] ) )
				.toEqual( [ [ 'presentation', 'slide', 'Welcome Slide' ] ] );
		}
		expect( ( serverTime - Date.parse( revision.timestamp ) ) / 60000 >= 10 ||
			( revision.user === config.username && source && info.pageid === 272 && revision.revid === 2742 ) ||
			verifiedOwnCleanup( { owner,
				pageId: info.pageid, revision: revision.revid, user: revision.user,
				slotContent: revision.slots, snapshot: record.snapshot }, config ),
		'Writable owners must be quiet or exactly match our verified cleanup receipt' )
			.toBe( true );
		records.push( record );
	}
	const [ destination, source ] = records;
	const witness = await current( 'Layers_browser_acceptance_isolation' );
	const pdfTitle = 'File:Layers migration fixture B.pdf';
	const imageTitle = 'File:B010.jpg';
	const files = {};
	for ( const title of [ pdfTitle, imageTitle ] ) {
		const info = ( await api( { action: 'query', titles: title, prop: 'imageinfo',
			iiprop: 'timestamp|sha1|size|mime|url' } ) ).query.pages[ 0 ];
		expect( info.imagerepository ).toBe( 'local' );
		expect( info.imageinfo?.[ 0 ] ).toBeDefined();
		files[ title ] = info.imageinfo[ 0 ];
	}
	expect( files[ pdfTitle ].pagecount ).toBeGreaterThanOrEqual( 3 );
	evidence.baselines = records.map( ( record ) => ( { owner: record.owner, pageId: record.pageId,
		revision: record.baseline.revid, slots: record.baseline.slots, snapshot: record.snapshot } ) );
	evidence.files = files;
	const saveEvidence = () => fs.writeFileSync( testInfo.outputPath( 'journey-evidence.json' ),
		JSON.stringify( evidence, null, 2 ) );
	const acknowledge = async ( record, revision, previous, action ) => {
		expect( Number.isInteger( revision ) && revision > previous ).toBe( true );
		record.lastOwnedRevision = revision;
		record.changed = true;
		record.unknownSave = false;
		const result = await current( record.owner );
		expect( result.pageid ).toBe( record.pageId );
		expect( result.revisions[ 0 ].revid ).toBe( revision );
		expect( result.revisions[ 0 ].parentid ).toBe( previous );
		evidence.steps.push( { action, owner: record.owner, revision, parent: previous,
			main: result.revisions[ 0 ].slots.main.content, snapshot: await read( record ) } );
		saveEvidence();
	};
	const publish = async ( record, snapshot, main, summary ) => {
		const previous = record.lastOwnedRevision;
		record.unknownSave = true;
		const result = await api( { action: 'layerspublish', owner: record.owner, pageid: String( record.pageId ),
			baserevid: String( previous ), data: JSON.stringify( snapshot ), maintext: main,
			summary, token }, true );
		if ( result.error ) {
			record.unknownSave = false;
			evidence.steps.push( { action: summary, owner: record.owner, refused: result.error } );
			saveEvidence();
		}
		expect( result.error, 'Publication must pass the real admission boundary' ).toBeUndefined();
		expect( result.layerspublish?.result ).toBe( 'Success' );
		await acknowledge( record, result.layerspublish.revid, previous, summary );
	};
	const surface = ( id, kind, note, color, title = null, number = 1 ) => {
		const file = title ? files[ title ] : null;
		const result = { id, kind, label: 'ABC', canvas: { width: file?.width || 800,
			height: file?.height || 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
			layers: [ { id: id + '_note', type: 'text', text: note, name: note,
				x: 60, y: 70, fontSize: 32, color, visible: true },
			{ id: id + '_rect', type: 'rectangle', x: 100, y: 140, width: 220, height: 100,
				fill: color, stroke: 'none', visible: true } ], readingOrder: [ id + '_note', id + '_rect' ] };
		if ( file ) {
			result.source = { repository: 'local', fileTitle: title.replace( / /g, '_' ),
				timestamp: file.timestamp.replace( /[-:TZ]/g, '' ),
				sha1: BigInt( '0x' + file.sha1 ).toString( 36 ).padStart( 31, '0' ), page: number };
		}
		return result;
	};
	const followEmbed = async ( record, prefix ) => {
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( record.owner ) }` );
		const links = page.locator( '.layers-page-edit-link' );
		await expect( links.first() ).toBeVisible( { timeout: 30000 } );
		const href = await links.evaluateAll( ( elements, expected ) => elements.find( ( element ) =>
			new URL( element.href ).searchParams.get( 'expected' )?.startsWith( expected ) )?.getAttribute( 'href' ), prefix );
		expect( href, 'Use the existing protected control for this exact file and PDF page' ).toBeTruthy();
		await links.evaluateAll( ( elements, target ) => elements.find( ( element ) =>
			element.getAttribute( 'href' ) === target ).click(), href );
		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true,
			null, { timeout: 60000 } );
	};
	const openEditor = async ( record, id, note ) => {
		const selected = ( await read( record ) ).surfaces.find( ( item ) => item.id === id );
		expect( selected ).toBeDefined();
		const prefix = selected.kind === 'slide' ? '{{#Slide:ABC|' :
			`[[${ selected.source.fileTitle.replace( /_/g, ' ' ) }|` +
			( selected.kind === 'pdf' ? `page=${ selected.source.page }|` : '' );
		await followEmbed( record, prefix );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Layer set: ' + selected.label );
		await expect( page.locator( '.layer-item' ).filter( { hasText: note } ) ).toBeVisible();
		const state = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( state.find( ( layer ) => layer.id === id + '_note' ).text ).toBe( note );
		const color = selected.layers.find( ( layer ) => layer.id === id + '_rect' ).fill;
		await expect.poll( () => page.locator( '.layers-canvas' ).evaluate( ( canvas, hex ) => {
			const rgb = [ 1, 3, 5 ].map( ( offset ) => parseInt( hex.slice( offset, offset + 2 ), 16 ) );
			const pixels = canvas.getContext( '2d' ).getImageData( 0, 0, canvas.width, canvas.height ).data;
			let count = 0;
			for ( let offset = 0; offset < pixels.length; offset += 4 ) {
				if ( rgb.every( ( value, channel ) => Math.abs( pixels[ offset + channel ] - value ) <= 2 ) &&
					pixels[ offset + 3 ] === 255 ) {
					count++;
				}
			}
			return count;
		}, color ) ).toBeGreaterThan( 100 );
	};
	const screenshot = async ( name ) => {
		const file = testInfo.outputPath( name + '.png' );
		await page.screenshot( { path: file, fullPage: true } );
		await testInfo.attach( name, { path: file, contentType: 'image/png' } );
	};
	const editFont = async ( note, size ) => {
		const before = await page.evaluate( ( text ) => window.layersEditorInstance.stateManager.get( 'layers' )
			.find( ( layer ) => layer.text === text ), note );
		await page.locator( '.layer-item' ).filter( { hasText: note } ).click();
		await page.getByLabel( /font size/i ).fill( String( size ) );
		await page.getByLabel( /font size/i ).press( 'Tab' );
		await expect.poll( () => page.evaluate( ( text ) => window.layersEditorInstance.stateManager.get( 'layers' )
			.find( ( layer ) => layer.text === text )?.fontSize, note ) ).toBe( size );
		expect( await page.evaluate( ( text ) => window.layersEditorInstance.stateManager.get( 'layers' )
			.find( ( layer ) => layer.text === text ), note ),
		'Font Size must preserve color, font family and every other existing text property' )
			.toEqual( { ...before, fontSize: size } );
	};
	const uiSave = async ( record, summary ) => {
		await page.getByLabel( 'Summary:' ).fill( summary );
		const previous = record.lastOwnedRevision;
		const response = page.waitForResponse( ( result ) => result.url().includes( 'api.php' ) &&
			( result.request().postData() || '' ).includes( 'action=layerspublish' ) );
		record.unknownSave = true;
		await page.locator( '.save-button' ).click();
		const saved = await response;
		const body = new URLSearchParams( saved.request().postData() );
		expect( body.get( 'baserevid' ) ).toBe( String( previous ) );
		const result = await saved.json();
		if ( result.error ) {
			record.unknownSave = false;
		}
		expect( result.layerspublish?.result, JSON.stringify( result.error ) ).toBe( 'Success' );
		await acknowledge( record, result.layerspublish.revid, previous, summary );
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );
		const revision = ( await current( record.owner ) ).revisions[ 0 ];
		expect( revision.comment ).toBe( summary );
		expect( revision.tags ).toContain( 'layers-page-drawing' );
	};
	let scenarioError;
	const cleanupErrors = [];
	try {
		const sourceSurfaces = [ surface( 'c2_source_one', 'pdf', 'Source page one', '#b72065', pdfTitle ),
			surface( 'c2_source_two', 'pdf', 'Source page two', '#b72065', pdfTitle, 2 ) ];
		await publish( source, { schemaVersion: 1, surfaces: sourceSurfaces },
			`${ source.baseline.slots.main.content }\n[[${ pdfTitle }|page=1|layerset=ABC]]\n` +
			`[[${ pdfTitle }|page=2|layerset=ABC]]`, 'J112C2 source equal-name set' );
		const destinationSurfaces = [ ...destination.snapshot.surfaces,
			surface( 'c2_pdf_one', 'pdf', 'Destination page one', '#e21945', pdfTitle ),
			surface( 'c2_pdf_two', 'pdf', 'Destination page two', '#11a261', pdfTitle, 2 ),
			surface( 'c2_photo', 'image', 'Independent photo', '#2367e0', imageTitle ),
			surface( 'c2_slide', 'slide', 'Independent slide', '#e3a514' ) ];
		const main = `${ destination.baseline.slots.main.content }\n` +
			`[[${ pdfTitle }|page=1|300px|layerset=ABC|Page one]]\n` +
			`[[${ pdfTitle }|page=2|300px|layerset=ABC|Page two]]\n` +
			`[[${ pdfTitle }|page=3|300px|layerset=ABC|Page three]]\n` +
			`[[${ pdfTitle }|page=1|200px|layerset=ABC|Repeated page one]]\n` +
			`[[${ imageTitle }|200px|layerset=ABC|Independent image]]\n{{#Slide:ABC|width=300}}\n` +
			`[[${ pdfTitle }|page=1|layerset=${ source.pageId }:ABC|Foreign owner]]`;
		await publish( destination, { schemaVersion: 1, surfaces: destinationSurfaces }, main,
			'J112C2 distinct equal-name layer sets' );
		const seedRevision = destination.lastOwnedRevision;
		for ( const [ record, id, note ] of [ [ destination, 'c2_pdf_one', 'Destination page one' ],
			[ destination, 'c2_pdf_two', 'Destination page two' ],
			[ destination, 'c2_photo', 'Independent photo' ], [ destination, 'c2_slide', 'Independent slide' ],
			[ source, 'c2_source_two', 'Source page two' ] ] ) {
			await openEditor( record, id, note );
			await screenshot( id );
		}
		for ( const [ id, note ] of [ [ 'c2_pdf_one', 'Destination page one' ],
			[ 'c2_pdf_two', 'Destination page two' ] ] ) {
			await openEditor( destination, id, note );
			await editFont( note, 36 );
			await uiSave( destination, `J112C2 save ${ id } independently` );
			await openEditor( destination, id, note );
			const original = destinationSurfaces.find( ( item ) => item.id === id );
			expect( ( await read( destination ) ).surfaces.find( ( item ) => item.id === id ) )
				.toEqual( { ...original, layers: original.layers.map( ( layer ) =>
					layer.type === 'text' ? { ...layer, fontSize: 36 } : layer ) } );
			await screenshot( id + '_saved' );
		}
		const edited = await read( destination );
		for ( const id of [ 'presentation', 'c2_photo', 'c2_slide' ] ) {
			expect( edited.surfaces.find( ( item ) => item.id === id ) )
				.toEqual( destinationSurfaces.find( ( item ) => item.id === id ) );
		}
		await followEmbed( destination, `[[${ pdfTitle }|page=3|` );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual( [] );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toContainText( 'ABC' );
		await page.locator( '.tool-dropdown[data-group-id="shapes"] .tool-dropdown-trigger' ).click();
		await page.locator( '.tool-dropdown-item[data-tool="rectangle"]' ).click();
		const bounds = await page.locator( '.layers-canvas' ).boundingBox();
		await page.mouse.move( bounds.x + 120, bounds.y + 150 );
		await page.mouse.down();
		await page.mouse.move( bounds.x + 290, bounds.y + 245, { steps: 10 } );
		await page.mouse.up();
		await expect.poll( () => page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ).length ) )
			.toBe( 1 );
		await uiSave( destination, 'J112C2 create unannotated PDF page three in ABC' );
		const beforeRename = await read( destination );
		const pageThree = beforeRename.surfaces.find( ( item ) => item.kind === 'pdf' && item.source.page === 3 );
		expect( pageThree.label ).toBe( 'ABC' );
		expect( pageThree.source ).toEqual( { ...beforeRename.surfaces.find( ( item ) => item.id === 'c2_pdf_one' ).source,
			page: 3 } );
		await followEmbed( destination, `[[${ pdfTitle }|page=3|` );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ).length ) ).toBe( 1 );
		await screenshot( 'pdf_page_three_created' );
		await openEditor( destination, 'c2_pdf_two', 'Destination page two' );
		await page.locator( '.layers-page-drawing-rename:not(.layers-page-drawing-copy)' ).click();
		await page.locator( 'input.layers-modal-input' ).fill( 'Renamed PDF' );
		await page.locator( '.layers-modal-buttons button.layers-btn-primary' ).click();
		await uiSave( destination, 'J112C2 rename all PDF pages from page two' );
		const renamed = await read( destination );
		expect( renamed.surfaces ).toEqual( beforeRename.surfaces.map( ( item ) =>
			item.kind === 'pdf' ? { ...item, label: 'Renamed PDF' } : item ) );
		const renamedMain = ( await current( destination.owner ) ).revisions[ 0 ].slots.main.content;
		const reference = renamedMain.match( /layerset=([^|]+)\|Page one/ )[ 1 ];
		expect( [ 'Renamed PDF', `${ destination.pageId }:Renamed PDF` ] ).toContain( reference );
		expect( renamedMain ).toBe( main.split( '\n' ).map( ( line ) => line.startsWith( `[[${ pdfTitle }|` ) &&
			line.includes( 'layerset=ABC|' ) ? line.replace( 'layerset=ABC|', `layerset=${ reference }|` ) : line ).join( '\n' ) );
		expect( ( await read( destination, seedRevision ) ).surfaces ).toEqual( destinationSurfaces );
		expect( ( await read( source ) ).surfaces ).toEqual( sourceSurfaces );
		await screenshot( 'pdf_whole_set_renamed' );
		await editFont( 'Destination page two', 38 );
		await uiSave( destination, 'J112C2 save again without reverting sibling names' );
		expect( ( await read( destination ) ).surfaces.filter( ( item ) => item.kind === 'pdf' )
			.map( ( item ) => item.label ) ).toEqual( [ 'Renamed PDF', 'Renamed PDF', 'Renamed PDF' ] );
		const copyThroughCatalog = async ( selectedId, expectedName, changeAfterPreview ) => {
			await openEditor( destination, 'c2_pdf_two', 'Destination page two' );
			await page.locator( '.layers-page-drawing-copy' ).click();
			await expect( page.locator( '.layers-page-copy-dialog' ) ).toBeVisible();
			await expect( page.locator( '#layers-page-copy-title' ) ).toHaveText( 'Copy a layer set from another page' );
			await page.locator( '.layers-page-copy-search' ).fill( source.owner.replace( /_/g, ' ' ) );
			const selection = page.locator( `.layers-page-copy-results li a[href*="sourcesurface=${ selectedId }"]` );
			await expect( selection ).toBeVisible();
			const selectedUrl = new URL( await selection.getAttribute( 'href' ), base );
			const previewRevision = Number( selectedUrl.searchParams.get( 'sourcerev' ) );
			expect( selectedUrl.searchParams.get( 'sourcepage' ) ).toBe( String( source.pageId ) );
			expect( previewRevision ).toBe( source.lastOwnedRevision );
			const original = await read( source, previewRevision );
			if ( selectedId === 'c2_source_two' ) {
				await screenshot( 'copy_picker_layer_sets' );
			}
			await selection.click();
			await expect( page.locator( 'input[name="wpnote"]' ) ).toBeVisible();
			await expect( page.locator( '#firstHeading' ) ).toHaveText( 'Copy a layer set from another page' );
			await screenshot( 'copy_preview_' + selectedId );
			if ( changeAfterPreview ) {
				const newer = { ...original, surfaces: original.surfaces.map( ( item ) => ( { ...item,
					label: 'Changed source', layers: item.layers.map( ( layer ) => layer.type === 'text' ?
						{ ...layer, text: 'Newer ' + layer.text } : layer ) } ) ) };
				await publish( source, newer, ( await current( source.owner ) ).revisions[ 0 ].slots.main.content,
					'J112C2 change source after exact copy preview' );
			}
			const beforeCopy = await read( destination );
			const previous = destination.lastOwnedRevision;
			const note = `J112C2 ${ selectedId } ${ Date.now() }`;
			await page.locator( 'input[name="wpnote"]' ).fill( note );
			const pending = page.waitForResponse( ( result ) => result.request().method() === 'POST' &&
				( result.request().postData() || '' ).includes( 'sourcesurface=' + selectedId ) );
			destination.unknownSave = true;
			await page.locator( 'button[type="submit"]' ).click();
			const response = await pending;
			const sent = new URLSearchParams( response.request().postData() );
			for ( const [ field, value ] of Object.entries( { pageid: destination.pageId, revid: previous,
				sourcepage: source.pageId, sourcerev: previewRevision, sourcesurface: selectedId } ) ) {
				expect( sent.get( field ) ).toBe( String( value ) );
			}
			expect( response.status() ).toBe( 302 );
			const result = await current( destination.owner );
			const revision = result.revisions[ 0 ];
			expect( result.pageid ).toBe( destination.pageId );
			expect( revision.parentid, 'An intervening writer cannot become our cleanup base' ).toBe( previous );
			expect( revision.comment ).toContain( `(revision ${ previewRevision }): ${ note }` );
			expect( revision.comment ).toMatch( /^Copied the layer set / );
			expect( revision.comment ).toContain( source.owner.replace( /_/g, ' ' ) );
			expect( revision.tags ).toContain( 'layers-page-drawing' );
			expect( revision.slots.main.content ).toBe( renamedMain );
			const copied = await read( destination, revision.revid );
			const oldIds = new Set( beforeCopy.surfaces.map( ( item ) => item.id ) );
			expect( copied.surfaces.filter( ( item ) => oldIds.has( item.id ) ) ).toEqual( beforeCopy.surfaces );
			const added = copied.surfaces.filter( ( item ) => !oldIds.has( item.id ) );
			expect( added.map( ( item ) => item.source.page ).sort() ).toEqual( [ 1, 2 ] );
			for ( const item of added ) {
				const originalPart = original.surfaces.find( ( part ) => part.source.page === item.source.page );
				expect( original.surfaces.map( ( part ) => part.id ) ).not.toContain( item.id );
				expect( item ).toEqual( { ...originalPart, id: item.id, label: expectedName } );
			}
			await acknowledge( destination, revision.revid, previous, 'Verified catalog copy: ' + expectedName );
			expect( await read( source, previewRevision ) ).toEqual( original );
			const copiedPart = added.find( ( item ) => item.source.page === 2 );
			await page.goto( `${ base }/index.php?title=Special:EditLayersPage&owner=${ encodeURIComponent( destination.owner ) }` +
				`&revid=${ destination.lastOwnedRevision }&surface=${ copiedPart.id }` );
			await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true,
				null, { timeout: 60000 } );
			await expect( page.locator( '.layers-page-drawing-name-text' ) ).toContainText( expectedName );
			await expect( page.locator( '.layer-item' ).filter( { hasText: 'Source page two' } ) ).toBeVisible();
			await screenshot( 'copied_' + expectedName.replace( / /g, '_' ) );
			return original;
		};
		const previewedSource = await copyThroughCatalog( 'c2_source_two', 'ABC', true );
		await publish( source, previewedSource,
			`${ source.baseline.slots.main.content }\n[[${ pdfTitle }|page=1|layerset=ABC]]\n` +
			`[[${ pdfTitle }|page=2|layerset=ABC]]`, 'J112C2 restore source set for occupied-scope copy' );
		await copyThroughCatalog( 'c2_source_one', 'ABC 2', false );
		const draftMain = renamedMain + '\nJ112C2 independent draft recovery checkpoint.';
		await publish( destination, await read( destination ), draftMain, 'J112C2 establish a fresh draft base' );
		const draftRevision = destination.lastOwnedRevision;
		const drafts = [];
		for ( const [ id, note, size ] of [ [ 'c2_pdf_one', 'Destination page one', 44 ],
			[ 'c2_pdf_two', 'Destination page two', 46 ] ] ) {
			await openEditor( destination, id, note );
			await editFont( note, size );
			const stored = await page.evaluate( () => {
				const lifecycle = window.layersEditorInstance.apiManager.pageOwnedDrafts;
				if ( !lifecycle.flush() ) {
					throw new Error( 'Explicit draft persistence failed' );
				}
				const controller = lifecycle.controller;
				const draft = controller.bridge.session.getDraft();
				const scope = { wiki: controller.wiki, user: controller.user, owner: draft.owner,
					baseRevisionId: draft.baseRevisionId, surfaceId: draft.surfaceId };
				return { scope, writer: controller.store._writerId, raw: controller.store.read( scope ) };
			} );
			expect( stored.scope.surfaceId ).toBe( id );
			expect( stored.scope.baseRevisionId ).toBe( draftRevision );
			expect( JSON.parse( stored.raw ).editorState.layers.find( ( layer ) => layer.text === note ).fontSize ).toBe( size );
			drafts.push( { ...stored, id, note, size } );
		}
		expect( drafts[ 0 ].scope.surfaceId ).not.toBe( drafts[ 1 ].scope.surfaceId );
		expect( drafts[ 0 ].writer ).not.toBe( drafts[ 1 ].writer );
		for ( const draft of drafts ) {
			await page.goto( `${ base }/index.php?title=Special:EditLayersPage&owner=${ encodeURIComponent( destination.owner ) }` +
				`&revid=${ draftRevision }&surface=${ draft.id }` );
			const recovery = page.locator( 'dialog.layers-page-recovery' );
			await expect( recovery ).toBeVisible();
			await screenshot( draft.id + '_recovery_offer' );
			await recovery.getByRole( 'button', { name: 'Restore local edits', exact: true } ).click();
			await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true,
				null, { timeout: 60000 } );
			expect( await page.evaluate( ( note ) => window.layersEditorInstance.stateManager.get( 'layers' )
				.find( ( layer ) => layer.text === note ).fontSize, draft.note ) ).toBe( draft.size );
			expect( await page.evaluate( () => window.layersEditorInstance.hasUnsavedChanges() ) ).toBe( true );
			const preserved = await page.evaluate( ( original ) => {
				const store = window.layersEditorInstance.apiManager.pageOwnedDrafts.controller.store;
				store.selectRecovery( original.writer );
				return store.read( original.scope );
			}, draft );
			expect( preserved ).toBe( draft.raw );
			await screenshot( draft.id + '_recovered' );
			expect( ( await current( destination.owner ) ).revisions[ 0 ].revid ).toBe( draftRevision );
		}
		evidence.drafts = drafts;
		const beforeConflict = await read( destination );
		await publish( destination, beforeConflict, draftMain + '\nJ112C2 concurrent main-slot checkpoint.',
			'J112C2 advance owner while recovered editor remains stale' );
		const concurrentRevision = destination.lastOwnedRevision;
		await page.getByLabel( 'Summary:' ).fill( 'J112C2 deliberately stale browser save' );
		const pendingConflict = page.waitForResponse( ( response ) => response.url().includes( 'api.php' ) &&
			( response.request().postData() || '' ).includes( 'action=layerspublish' ), { timeout: 60000 } );
		destination.unknownSave = true;
		await page.locator( '.save-button' ).click();
		const refused = await pendingConflict;
		const result = await refused.json();
		if ( result.error ) {
			destination.unknownSave = false;
		} else if ( result.layerspublish?.result === 'Success' ) {
			await acknowledge( destination, result.layerspublish.revid, concurrentRevision, 'Unexpected stale-save success' );
		}
		expect( new URLSearchParams( refused.request().postData() ).get( 'baserevid' ) ).toBe( String( draftRevision ) );
		expect( result.error?.code ).toBe( 'layers-edit-conflict' );
		expect( ( await current( destination.owner ) ).revisions[ 0 ].revid ).toBe( concurrentRevision );
		expect( await read( destination ) ).toEqual( beforeConflict );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )
			.find( ( layer ) => layer.text === 'Destination page two' ).fontSize ) ).toBe( 46 );
		expect( await page.evaluate( () => window.layersEditorInstance.hasUnsavedChanges() ) ).toBe( true );
		evidence.staleSave = { base: draftRevision, concurrentRevision, error: result.error.code, retainedFontSize: 46 };
		await screenshot( 'stale_save_retains_recovered_work' );
		expect( evidence.browserErrors ).toEqual( [] );
	} catch ( error ) {
		scenarioError = error;
		evidence.scenarioError = error.message;
	} finally {
		test.setTimeout( 720000 );
		for ( const record of records.filter( ( owner ) => owner.changed || owner.unknownSave ) ) {
			await ( async () => {
				try {
					const before = await current( record.owner );
					const observed = before.revisions[ 0 ].revid;
					evidence.cleanup.push( { owner: record.owner, baseline: record.baseline.revid,
						lastAcknowledged: record.lastOwnedRevision, observed } );
					expect( record.unknownSave, 'Unknown saves prohibit cleanup writes' ).toBe( false );
					expect( before.pageid ).toBe( record.pageId );
					expect( observed, 'Cleanup must not overwrite an intervening writer' ).toBe( record.lastOwnedRevision );
					await publish( record, record.snapshot, record.baseline.slots.main.content,
						'J112C2 cleanup: restore exact dedicated baseline' );
					const restored = ( await current( record.owner ) ).revisions[ 0 ];
					expect( Object.keys( restored.slots ).sort() ).toEqual( Object.keys( record.baseline.slots ).sort() );
					for ( const role of Object.keys( record.baseline.slots ) ) {
						for ( const property of [ 'content', 'contentmodel', 'contentformat' ] ) {
							expect( restored.slots[ role ][ property ] ).toBe( record.baseline.slots[ role ][ property ] );
						}
					}
					expect( await read( record ) ).toEqual( record.snapshot );
					evidence.cleanup.at( -1 ).restored = record.lastOwnedRevision;
				} catch ( error ) {
					cleanupErrors.push( `${ record.owner }: ${ error.message }` );
				}
			} )();
		}
		const afterWitness = await current( 'Layers_browser_acceptance_isolation' );
		expect( afterWitness.pageid ).toBe( witness.pageid );
		expect( afterWitness.revisions[ 0 ] ).toEqual( witness.revisions[ 0 ] );
		evidence.cleanupErrors = cleanupErrors;
		saveEvidence();
	}
	expect( cleanupErrors, 'Every cleanup refusal must be surfaced, even after a scenario failure' ).toEqual( [] );
	if ( scenarioError ) {
		throw scenarioError;
	}
} );

if ( process.env.LAYERS_ACCEPTANCE_RESTORE_RECEIPT ) {
	test( 'J112C2 restore only acknowledged owners after an aborted runner', async ( { context }, testInfo ) => {
		const receipt = JSON.parse( fs.readFileSync( process.env.LAYERS_ACCEPTANCE_RESTORE_RECEIPT, 'utf8' ) );
		const plan = scopedRestorePlan( receipt );
		const { api } = await acceptanceSession( context );
		const token = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;
		const current = async ( owner ) => ( await api( { action: 'query', titles: owner, prop: 'info|revisions',
			rvprop: 'ids|user|content|contentmodel', rvslots: '*', rvlimit: 1 } ) ).query.pages[ 0 ];
		const witness = await current( 'Layers_browser_acceptance_isolation' );
		// Validate every historical baseline and current owner before the first write.
		// A local receipt alone cannot authorize different content or a different page.
		for ( const { baseline, acknowledged } of plan ) {
			const historical = ( await api( { action: 'query', revids: String( baseline.revision ),
				prop: 'info|revisions', rvprop: 'ids|content|contentmodel', rvslots: '*' } ) ).query.pages[ 0 ];
			expect( historical.pageid ).toBe( baseline.pageId );
			expect( historical.revisions[ 0 ].revid ).toBe( baseline.revision );
			expect( historical.revisions[ 0 ].slots ).toEqual( baseline.slots );
			const authorized = await api( { action: 'layersread', owner: baseline.owner,
				revid: String( baseline.revision ) } );
			expect( authorized.layersread?.snapshot ).toEqual( baseline.snapshot );
			const before = await current( baseline.owner );
			expect( before.pageid ).toBe( baseline.pageId );
			expect( before.revisions[ 0 ].revid ).toBe( acknowledged.revision );
			expect( before.revisions[ 0 ].parentid ).toBe( acknowledged.parent );
			expect( before.revisions[ 0 ].slots.main.content ).toBe( acknowledged.main );
			expect( JSON.parse( before.revisions[ 0 ].slots.layers.content ) ).toEqual( acknowledged.snapshot );
		}
		const errors = [];
		receipt.cleanup = [];
		for ( const { baseline, acknowledged } of plan ) {
			try {
				const before = await current( baseline.owner );
				expect( before.pageid ).toBe( baseline.pageId );
				expect( before.revisions[ 0 ].revid, 'Do not adopt an unacknowledged latest revision' ).toBe( acknowledged.revision );
				const result = await api( { action: 'layerspublish', owner: baseline.owner, pageid: String( baseline.pageId ),
					baserevid: String( acknowledged.revision ), data: JSON.stringify( baseline.snapshot ),
					maintext: baseline.slots.main.content, summary: 'J112C2 cleanup after aborted runner: exact baseline', token }, true );
				expect( result.layerspublish?.result ).toBe( 'Success' );
				const restored = ( await current( baseline.owner ) ).revisions[ 0 ];
				expect( restored.revid ).toBe( result.layerspublish.revid );
				expect( restored.parentid ).toBe( acknowledged.revision );
				expect( restored.slots ).toEqual( baseline.slots );
				const read = await api( { action: 'layersread', owner: baseline.owner, revid: String( restored.revid ) } );
				expect( read.layersread?.snapshot ).toEqual( baseline.snapshot );
				receipt.cleanup.push( { owner: baseline.owner, baseline: baseline.revision,
					lastAcknowledged: acknowledged.revision, observed: acknowledged.revision, restored: restored.revid } );
			} catch ( error ) {
				errors.push( `${ baseline.owner }: ${ error.message }` );
			}
		}
		expect( await current( 'Layers_browser_acceptance_isolation' ) ).toEqual( witness );
		receipt.cleanupErrors = errors;
		fs.writeFileSync( testInfo.outputPath( 'journey-evidence.json' ), JSON.stringify( receipt, null, 2 ) );
		expect( errors ).toEqual( [] );
	} );
}
