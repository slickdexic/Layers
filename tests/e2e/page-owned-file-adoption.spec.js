/* eslint-env node */
/**
 * Opt-in: copies a shared legacy file drawing into the dedicated Layers_browser_acceptance owner through
 * Special:AdoptLayersDrawing, pinned to the file version shown, then restores the owner and deletes the
 * test's own legacy set.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'an editor makes a shared file drawing owned by the page, pinned to the file version shown', async ( { page, context } ) => {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.port ).toBe( '8080' );
	expect( url.search + url.hash + url.username + url.password ).toBe( '' );
	const base = url.origin;
	const owner = 'Layers_browser_acceptance';
	const setName = 'adopt-acceptance';
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
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;
	const latest = async () => {
		const record = ( await api( { action: 'query', prop: 'revisions', titles: owner,
			rvprop: 'ids|content|tags', rvslots: 'main' } ) ).query.pages[ 0 ];
		return { pageId: record.pageid, revision: record.revisions[ 0 ].revid,
			text: record.revisions[ 0 ].slots.main.content, tags: record.revisions[ 0 ].tags };
	};

	// Any existing bitmap on the wiki; the test adds, then deletes, only its own named set.
	const files = ( await api( { action: 'query', list: 'allimages', aimime: 'image/jpeg|image/png', ailimit: 1,
		aiprop: 'timestamp|sha1|size' } ) ).query.allimages;
	test.skip( !files.length, 'Requires at least one JPEG or PNG file on the wiki' );
	const file = files[ 0 ];
	const shownName = file.name.replace( /_/g, ' ' );

	const initial = await latest();
	const initialSnapshot = ( await api( { action: 'layersread', owner, revid: String( initial.revision ) } ) )
		.layersread.snapshot;
	let sharedSaved = false;
	let lastOwnedRevision = null;
	let publicationPending = false;
	try {
		const saved = await api( { action: 'layerssave', filename: file.name, setname: setName, token: csrfToken,
			data: JSON.stringify( [ { id: 'file_adopt_rect', type: 'rectangle', x: 20, y: 20,
				width: Math.round( file.width / 2 ), height: Math.round( file.height / 2 ),
				fill: '#00c000', stroke: 'none' } ] ) }, true );
		expect( saved.layerssave && saved.layerssave.success ).toBeTruthy();
		sharedSaved = true;
		const sharedBefore = ( await api( { action: 'layersinfo', filename: file.name, setname: setName } ) )
			.layersinfo.layerset;
		expect( sharedBefore ).toBeTruthy();

		const embed = `[[File:${ file.name }|300px|layerset=${ setName }|Shared photo]]`;
		const withShared = `${ initial.text }\n\n${ embed }`;
		publicationPending = true;
		const seeded = await api( { action: 'layerspublish', owner, baserevid: String( initial.revision ),
			data: JSON.stringify( initialSnapshot ), maintext: withShared,
			summary: 'File adoption acceptance: embed a shared file drawing', token: csrfToken }, true );
		expect( seeded.layerspublish && seeded.layerspublish.result ).toBe( 'Success' );
		lastOwnedRevision = seeded.layerspublish.revid;
		publicationPending = false;

		// The page offers the shared file drawing to its editor; nothing is written by looking.
		await page.goto( `${ base }/index.php?title=${ owner }` );
		await expect( page.locator( '.layers-page-edit-controls__notice' ) )
			.toContainText( 'Some drawings on this page are shared' );
		const adopt = page.locator( '.layers-page-adopt-link' );
		await expect( adopt ).toHaveCount( 1 );
		await expect( adopt ).toContainText( shownName );
		const confirmation = new URL( await adopt.getAttribute( 'href' ), base );
		expect( confirmation.searchParams.get( 'filets' ) ).toBe( file.timestamp.replace( /\D/g, '' ) );
		await adopt.click();
		const content = page.locator( '#mw-content-text' );
		await expect( content ).toContainText( shownName );
		await expect( content ).toContainText( setName );
		await expect( content ).toContainText( 'uploading a new version of the file will not change it.' );
		expect( ( await latest() ).revision ).toBe( lastOwnedRevision );

		// Confirming publishes one page revision with an image surface pinned to the version shown.
		publicationPending = true;
		await Promise.all( [
			page.waitForURL( ( target ) => target.searchParams.get( 'title' ) === owner ||
				target.pathname.endsWith( '/' + owner ) ),
			page.locator( '.mw-htmlform-submit' ).click()
		] );
		const adopted = await latest();
		expect( adopted.revision ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = adopted.revision;
		publicationPending = false;
		expect( adopted.tags ).toContain( 'layers-page-drawing' );
		expect( adopted.text.slice( 0, initial.text.length + 2 ) ).toBe( initial.text + '\n\n' );
		const rewritten = adopted.text.slice( initial.text.length + 2 );
		const escaped = file.name.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
		const named = rewritten.match( new RegExp( `^\\[\\[File:${ escaped }\\|300px\\|layerset=` +
			`${ initial.pageId }:([^|\\]]+)\\|Shared photo\\]\\]$` ) );
		expect( named ).not.toBeNull();
		const snapshot = ( await api( { action: 'layersread', owner, revid: String( adopted.revision ) } ) )
			.layersread.snapshot;
		expect( snapshot.surfaces.length ).toBe( initialSnapshot.surfaces.length + 1 );
		const surface = snapshot.surfaces.find( ( s ) => s.label === named[ 1 ] );
		expect( [ surface.kind, surface.source.fileTitle, surface.source.timestamp, surface.source.page ] )
			.toEqual( [ 'image', 'File:' + file.name, file.timestamp.replace( /\D/g, '' ), 1 ] );
		expect( [ surface.canvas.width, surface.canvas.height ] ).toEqual( [ file.width, file.height ] );
		expect( surface.layers.map( ( l ) => l.id ) ).toEqual( [ 'file_adopt_rect' ] );

		// The page now draws its own copy over the pinned version and no longer offers adoption.
		await expect( page.locator( '.layers-page-adopt-link' ) ).toHaveCount( 0 );
		const canvas = page.locator( 'a .layers-bound-file-view canvas' );
		await expect( canvas ).toHaveCount( 1 );
		await expect.poll( () => canvas.evaluate( ( element ) =>
			Array.from( element.getContext( '2d' ).getImageData( 30, 30, 1, 1 ).data ) ) ).toEqual( [ 0, 192, 0, 255 ] );
		const sharedAfter = ( await api( { action: 'layersinfo', filename: file.name, setname: setName } ) )
			.layersinfo.layerset;
		expect( [ sharedAfter.id, sharedAfter.revision ] ).toEqual( [ sharedBefore.id, sharedBefore.revision ] );

		// Returning to the same confirmation is refused rather than adopting twice.
		await page.goto( confirmation.href );
		await expect( page.locator( '.mw-htmlform-submit' ) ).toHaveCount( 0 );
		expect( ( await latest() ).revision ).toBe( lastOwnedRevision );
	} finally {
		const restore = async () => {
			if ( lastOwnedRevision === null ) {
				return;
			}
			if ( publicationPending ) {
				throw new Error( 'File adoption cleanup requires review: publication outcome is uncertain; no restore attempted' );
			}
			const current = await latest();
			if ( current.pageId !== initial.pageId || current.revision !== lastOwnedRevision ) {
				throw new Error( 'File adoption cleanup requires review: another edit intervened; no restore attempted' );
			}
			const restored = await api( { action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( initialSnapshot ), maintext: initial.text,
				summary: 'File adoption acceptance cleanup: restore automated owner state', token: csrfToken }, true );
			if ( !restored.layerspublish || restored.layerspublish.result !== 'Success' ) {
				throw new Error( 'File adoption cleanup failed; no retry or forced overwrite attempted' );
			}
			expect( ( await latest() ).text ).toBe( initial.text );
		};
		try {
			await restore();
		} finally {
			if ( sharedSaved ) {
				const deleted = await api( { action: 'layersdelete', filename: file.name, setname: setName,
					token: csrfToken }, true );
				expect( deleted.layersdelete && deleted.layersdelete.success ).toBeTruthy();
			}
		}
	}
} );
