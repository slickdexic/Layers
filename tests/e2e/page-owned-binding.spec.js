/* eslint-env node */
/** Opt-in: tests read-only inline bound slide presentation on the original test wiki. */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'read-only inline bound slide renders, isolates revisions, and reloads on navigation', async ( { page, context } ) => {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );

	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	const base = url.origin;

	// If configuration points to a disposable wiki, stop and report it rather than silently testing there.
	if ( ( url.pathname && url.pathname !== '/' && url.pathname !== '/index.php' ) ||
		config.base.includes( '/tmp/' ) || config.base.includes( 'browser-' )
	) {
		throw new Error( 'Acceptance configuration must target the original wiki root' );
	}

	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// 1. Authenticate as the established QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );

	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	// Read and retain the automated page's current main text and snapshot
	const initialPageQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: owner,
		rvprop: 'ids|content',
		rvslots: 'main'
	} );
	const pageData = initialPageQuery.query.pages[ 0 ];
	expect( pageData.missing ).toBeUndefined();
	const pageId = pageData.pageid;
	expect( typeof pageId ).toBe( 'number' );
	expect( pageId ).toBeGreaterThan( 0 );

	const initialRevId = pageData.revisions[ 0 ].revid;
	const initialMainText = pageData.revisions[ 0 ].slots.main.content;

	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	const assertPaintedColor = async ( rgb ) => {
		const canvas = page.locator( '.layers-bound-slide canvas' ).first();
		await expect( canvas ).toBeVisible();
		await expect( canvas ).toHaveAttribute( 'width', '800' );
		await expect( canvas ).toHaveAttribute( 'height', '600' );
		await expect.poll( () => canvas.evaluate( ( element ) =>
			Array.from( element.getContext( '2d' ).getImageData( 200, 145, 1, 1 ).data )
		) ).toEqual( [ ...rgb, 255 ] );
	};

	let needsRestore = false;
	let lastOwnedRevision = null;
	let publicationPending = false;
	try {
		// Seed a valid text/vector slide snapshot and a main-text embed using layersbinding=v1:<PageID>:<surfaceId>
		needsRestore = true;
		const surfaceId = 'slide_bound_j67';
		const firstBinding = `v1:${ pageId }:${ surfaceId }`;

		const firstSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Bound Slide J67',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: [
						{
							id: 'rect1',
							type: 'rectangle',
							x: 50,
							y: 50,
							width: 200,
							height: 100,
							fill: '#ff0000',
							stroke: 'none'
						},
						{
							id: 'label1',
							type: 'text',
							x: 60,
							y: 80,
							text: 'Revision One Drawing',
							fontSize: 20,
							color: '#000000'
						}
					],
					readingOrder: [ 'rect1', 'label1' ]
				}
			]
		};

		const firstMainText = `${ initialMainText }\n\n== Inline Slide ==\n{{#Slide:WelcomePresentation|layersbinding=${ firstBinding }}}`;

		publicationPending = true;
		const pub1 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( firstSnapshot ),
			maintext: firstMainText,
			summary: 'J67: seed first bound slide embed',
			token: csrfToken
		}, true );
		expect( pub1.layerspublish ).toBeDefined();
		expect( pub1.layerspublish.result ).toBe( 'Success' );
		const firstRevId = pub1.layerspublish.revid;
		lastOwnedRevision = firstRevId;
		publicationPending = false;
		expect( firstRevId ).toBeGreaterThan( initialRevId );

		// 2. Visit the ordinary page URL
		const consoleFailures = [];
		page.on( 'console', ( msg ) => {
			if ( msg.type() === 'error' ) {
				consoleFailures.push( 'Browser console error' );
			}
		} );
		page.on( 'pageerror', () => consoleFailures.push( 'Uncaught browser error' ) );

		const response1 = await page.goto( `${ base }/index.php?title=${ owner }` );
		expect( response1.ok() ).toBe( true );

		// Assert real HTML response Cache-Control includes no-store
		const cacheControl = response1.headers()[ 'cache-control' ] || '';
		expect( cacheControl.toLowerCase() ).toContain( 'no-store' );

		// Verify .layers-bound-slide contains a painted canvas
		const boundSlide = page.locator( '.layers-bound-slide' );
		await expect( boundSlide ).toBeVisible();
		await expect( boundSlide ).toHaveAttribute( 'data-layers-binding', firstBinding );
		await expect( boundSlide ).toHaveAttribute( 'data-layers-revision', String( firstRevId ) );

		const canvas1 = boundSlide.locator( 'canvas' );
		await expect( canvas1 ).toBeVisible();

		const isPainted1 = await page.evaluate( () => {
			const c = document.querySelector( '.layers-bound-slide canvas' );
			if ( !c ) {
				return false;
			}
			const ctx = c.getContext( '2d' );
			const imgData = ctx.getImageData( 0, 0, c.width, c.height ).data;
			for ( let i = 0; i < imgData.length; i += 4 ) {
				if ( imgData[ i ] > 200 && imgData[ i + 1 ] < 50 && imgData[ i + 2 ] < 50 && imgData[ i + 3 ] > 200 ) {
					return true;
				}
			}
			return false;
		} );
		expect( isPainted1 ).toBe( true );

		// Verify bootstrap bundle has exactly the published revision/surface
		const boundSlides1 = await page.evaluate( () => mw.config.get( 'wgLayersBoundSlides' ) );
		expect( boundSlides1 ).toBeDefined();
		expect( boundSlides1[ firstBinding ] ).toBeDefined();
		expect( boundSlides1[ firstBinding ].revisionId ).toBe( firstRevId );
		expect( boundSlides1[ firstBinding ].surface.id ).toBe( surfaceId );
		expect( boundSlides1[ firstBinding ].surface.layers[ 0 ].fill ).toBe( '#ff0000' );
		expect( boundSlides1[ firstBinding ].surface.layers[ 1 ].text ).toBe( 'Revision One Drawing' );

		// No legacy .layers-slide-container or edit/save controls appear for this bound embed
		await expect( page.locator( '.layers-slide-container' ) ).toHaveCount( 0 );
		await expect( page.locator( '.layers-edit-btn' ) ).toHaveCount( 0 );
		await expect( page.locator( '.save-button' ) ).toHaveCount( 0 );
		await expect( page.locator( '.layers-page-revision-check-button' ) ).toHaveCount( 0 );
		await expect( page.locator( '.layers-editor-container' ) ).toHaveCount( 0 );

		expect( consoleFailures ).toEqual( [] );

		// 3. Publish a distinct second drawing
		const secondSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Bound Slide J67',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: [
						{
							id: 'rect2',
							type: 'rectangle',
							x: 100,
							y: 100,
							width: 250,
							height: 120,
							fill: '#0000ff',
							stroke: 'none'
						},
						{
							id: 'label2',
							type: 'text',
							x: 110,
							y: 130,
							text: 'Revision Two Updated Drawing',
							fontSize: 22,
							color: '#000000'
						}
					],
					readingOrder: [ 'rect2', 'label2' ]
				}
			]
		};

		publicationPending = true;
		const pub2 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( firstRevId ),
			data: JSON.stringify( secondSnapshot ),
			maintext: firstMainText,
			summary: 'J67: publish second distinct drawing',
			token: csrfToken
		}, true );
		expect( pub2.layerspublish ).toBeDefined();
		expect( pub2.layerspublish.result ).toBe( 'Success' );
		const secondRevId = pub2.layerspublish.revid;
		lastOwnedRevision = secondRevId;
		publicationPending = false;
		expect( secondRevId ).toBeGreaterThan( firstRevId );

		// Visit the first page revision with native oldid
		await page.goto( `${ base }/index.php?title=${ owner }&oldid=${ firstRevId }` );
		const oldBoundSlides = await page.evaluate( () => mw.config.get( 'wgLayersBoundSlides' ) );
		await assertPaintedColor( [ 255, 0, 0 ] );
		expect( oldBoundSlides[ firstBinding ] ).toBeDefined();
		expect( oldBoundSlides[ firstBinding ].revisionId ).toBe( firstRevId );
		expect( oldBoundSlides[ firstBinding ].surface.layers[ 0 ].fill ).toBe( '#ff0000' );
		expect( oldBoundSlides[ firstBinding ].surface.layers[ 1 ].text ).toBe( 'Revision One Drawing' );
		expect( oldBoundSlides[ firstBinding ].surface.layers[ 0 ].x ).toBe( 50 );

		// Verify current page displays the second drawing
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const currentBoundSlides = await page.evaluate( () => mw.config.get( 'wgLayersBoundSlides' ) );
		await assertPaintedColor( [ 0, 0, 255 ] );
		expect( currentBoundSlides[ firstBinding ] ).toBeDefined();
		expect( currentBoundSlides[ firstBinding ].revisionId ).toBe( secondRevId );
		expect( currentBoundSlides[ firstBinding ].surface.layers[ 0 ].fill ).toBe( '#0000ff' );
		expect( currentBoundSlides[ firstBinding ].surface.layers[ 1 ].text ).toBe( 'Revision Two Updated Drawing' );
		expect( currentBoundSlides[ firstBinding ].surface.layers[ 0 ].x ).toBe( 100 );

		// Reload both URLs to exercise parser-cache reuse; old revision must never receive new drawing
		await page.goto( `${ base }/index.php?title=${ owner }&oldid=${ firstRevId }` );
		await page.reload();
		const reloadedOldBoundSlides = await page.evaluate( () => mw.config.get( 'wgLayersBoundSlides' ) );
		await assertPaintedColor( [ 255, 0, 0 ] );
		expect( reloadedOldBoundSlides[ firstBinding ].revisionId ).toBe( firstRevId );
		expect( reloadedOldBoundSlides[ firstBinding ].surface.layers[ 0 ].fill ).toBe( '#ff0000' );
		expect( reloadedOldBoundSlides[ firstBinding ].surface.layers[ 1 ].text ).toBe( 'Revision One Drawing' );

		await page.goto( `${ base }/index.php?title=${ owner }` );
		await page.reload();
		const reloadedCurrentBoundSlides = await page.evaluate( () => mw.config.get( 'wgLayersBoundSlides' ) );
		await assertPaintedColor( [ 0, 0, 255 ] );
		expect( reloadedCurrentBoundSlides[ firstBinding ].revisionId ).toBe( secondRevId );
		expect( reloadedCurrentBoundSlides[ firstBinding ].surface.layers[ 0 ].fill ).toBe( '#0000ff' );
		expect( reloadedCurrentBoundSlides[ firstBinding ].surface.layers[ 1 ].text ).toBe( 'Revision Two Updated Drawing' );

		// 4. Place the same binding twice on the automated page; confirm two independent canvas hosts
		const doubleMainText = `${ initialMainText }\n\n` +
			`{{#Slide:WelcomePresentation|layersbinding=${ firstBinding }}}\n\n` +
			`{{#Slide:WelcomePresentation|layersbinding=${ firstBinding }}}`;

		publicationPending = true;
		const pub3 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( secondRevId ),
			data: JSON.stringify( secondSnapshot ),
			maintext: doubleMainText,
			summary: 'J67: place the same binding twice on page',
			token: csrfToken
		}, true );
		expect( pub3.layerspublish ).toBeDefined();
		expect( pub3.layerspublish.result ).toBe( 'Success' );
		const doubleRevId = pub3.layerspublish.revid;
		lastOwnedRevision = doubleRevId;
		publicationPending = false;
		expect( doubleRevId ).toBeGreaterThan( secondRevId );

		await page.goto( `${ base }/index.php?title=${ owner }` );
		const doubleHosts = page.locator( '.layers-bound-slide' );
		await expect( doubleHosts ).toHaveCount( 2 );

		const canvasA = doubleHosts.nth( 0 ).locator( 'canvas' );
		const canvasB = doubleHosts.nth( 1 ).locator( 'canvas' );
		await expect( canvasA ).toBeVisible();
		await expect( canvasB ).toBeVisible();

		const distinctCanvases = await page.evaluate( () => {
			const canvases = document.querySelectorAll( '.layers-bound-slide canvas' );
			return canvases.length === 2 && canvases[ 0 ] !== canvases[ 1 ];
		} );
		expect( distinctCanvases ).toBe( true );

		// Check navigation/back-forward restoration
		await page.goto( `${ base }/index.php?title=Special:Version` );
		await page.goBack();
		await expect( page.locator( '.layers-bound-slide' ) ).toHaveCount( 2 );
		await expect( page.locator( '.layers-bound-slide canvas' ) ).toHaveCount( 2 );
		await expect( page.locator( '.layers-bound-slide canvas' ).first() ).toBeVisible();
		expect( consoleFailures ).toEqual( [] );
	} finally {
		const restore = async () => {
			if ( needsRestore ) {
				if ( publicationPending || !Number.isInteger( lastOwnedRevision ) ) {
					throw new Error( 'J67 cleanup requires review: publication outcome is uncertain; no restore attempted' );
				}
				const latestQuery = await api( { action: 'query', prop: 'info|revisions',
					titles: owner, rvprop: 'ids' } );
				const latest = latestQuery.query.pages[ 0 ];
				if ( latest.pageid !== pageId || latest.revisions[ 0 ].revid !== lastOwnedRevision ) {
					throw new Error( 'J67 cleanup requires review: another edit intervened; no restore attempted' );
				}
				const restoreRes = await api( {
					action: 'layerspublish', owner, baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ), maintext: initialMainText,
					summary: 'J67 cleanup: restore automated owner state', token: csrfToken
				}, true );
				if ( !restoreRes.layerspublish || restoreRes.layerspublish.result !== 'Success' ) {
					throw new Error( 'J67 cleanup failed; no retry or forced overwrite attempted' );
				}
				const restoredRevision = restoreRes.layerspublish.revid;
				const verifyRead = await api( { action: 'layersread', owner, revid: String( restoredRevision ) } );
				expect( verifyRead.layersread.snapshot ).toEqual( initialSnapshot );
				const verifyPage = await api( { action: 'query', prop: 'revisions', revids: String( restoredRevision ),
					rvprop: 'content', rvslots: 'main' } );
				expect( verifyPage.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );
			}
		};
		await restore();
	}
} );

test( 'exact-source bound-editor route admits valid embedding, saves once, and rejects stale or forged parameters', async ( { page, context } ) => {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );

	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	expect( url.search + url.hash + url.username + url.password ).toBe( '' );
	const base = url.origin;

	if ( ( url.pathname && url.pathname !== '/' && url.pathname !== '/index.php' ) ||
		config.base.includes( '/tmp/' ) || config.base.includes( 'browser-' )
	) {
		throw new Error( 'Acceptance configuration must target the original wiki root' );
	}

	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// 1. Authenticate as the QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );

	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	// Read and retain the automated owner's current state
	const initialPageQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: owner,
		rvprop: 'ids|content',
		rvslots: 'main'
	} );
	const pageData = initialPageQuery.query.pages[ 0 ];
	expect( pageData.missing ).toBeUndefined();
	const pageId = pageData.pageid;
	expect( typeof pageId ).toBe( 'number' );
	expect( pageId ).toBeGreaterThan( 0 );

	const initialRevId = pageData.revisions[ 0 ].revid;
	const initialMainText = pageData.revisions[ 0 ].slots.main.content;

	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	let needsRestore = false;
	let lastOwnedRevision = null;
	let publicationPending = false;
	try {
		// 1. Extend the bound-slide setup with a Unicode prefix and compute UTF-8 byte offset
		needsRestore = true;
		const surfaceId = 'slide_bound_j73';
		const binding = `v1:${ pageId }:${ surfaceId }`;
		const unicodePrefix = 'Unicode 測試 — café — 世界\n';
		const embedText = `{{#Slide:WelcomePresentation|layersbinding=${ binding }|width=400}}`;
		const seedMainText = `${ initialMainText }\n\n== Bound Section ==\n${ unicodePrefix }${ embedText }`;

		const seededSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Bound Slide J73',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: [
						{
							id: 'rect1',
							type: 'rectangle',
							x: 50,
							y: 50,
							width: 200,
							height: 100,
							fill: '#ff0000',
							stroke: 'none'
						},
						{
							id: 'label1',
							type: 'text',
							x: 60,
							y: 80,
							text: 'Bound Slide J73 Text',
							fontSize: 20,
							color: '#000000'
						}
					],
					readingOrder: [ 'rect1', 'label1' ]
				}
			]
		};

		publicationPending = true;
		const seedPub = await api( {
			action: 'layerspublish',
			owner,
			pageid: String( pageId ),
			baserevid: String( initialRevId ),
			data: JSON.stringify( seededSnapshot ),
			maintext: seedMainText,
			summary: 'J73: seed bound slide embed with Unicode prefix',
			token: csrfToken
		}, true );
		expect( seedPub.layerspublish ).toBeDefined();
		expect( seedPub.layerspublish.result ).toBe( 'Success' );
		const seedRevId = seedPub.layerspublish.revid;
		lastOwnedRevision = seedRevId;
		publicationPending = false;
		expect( seedRevId ).toBeGreaterThan( initialRevId );

		// Compute the exact UTF-8 byte offset, asserting it differs from JavaScript character count
		const prefixBeforeEmbed = seedMainText.slice( 0, seedMainText.indexOf( embedText ) );
		const byteOffset = Buffer.byteLength( prefixBeforeEmbed, 'utf8' );
		const charOffset = prefixBeforeEmbed.length;
		expect( byteOffset ).toBeGreaterThan( charOffset );

		// Navigate to the tuple route Special:EditLayersPage?pageid=...&revid=...&start=...&expected=...
		const editorUrl = `${ base }/index.php?` + new URLSearchParams( {
			title: 'Special:EditLayersPage',
			pageid: String( pageId ),
			revid: String( seedRevId ),
			start: String( byteOffset ),
			expected: embedText
		} );

		const editorResponse = await page.goto( editorUrl );
		expect( editorResponse.status() ).toBe( 200 );
		expect( editorResponse.request().redirectedFrom() ).toBeNull();

		// Assert real HTTP response Cache-Control includes no-store
		const cacheControl = editorResponse.headers()[ 'cache-control' ] || '';
		expect( cacheControl.toLowerCase() ).toContain( 'no-store' );

		// Verify bootstrap PageID/revision/surface match
		const bootstrap = await page.evaluate( () => {
			const init = window.wgLayersEditorInit ||
				( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersEditorInit' ) );
			return init;
		} );
		expect( bootstrap ).toBeDefined();
		expect( bootstrap.pageOwned.pageId ).toBe( pageId );
		expect( bootstrap.pageOwned.revisionId ).toBe( seedRevId );
		expect( bootstrap.pageOwned.surfaceId ).toBe( surfaceId );

		// Verify canvas loads
		await expect( page.locator( '.layers-canvas' ) ).toBeVisible();
		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );

		// 2. Make one ordinary UI drawing edit and save once
		const beforeEdit = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		await page.locator( '.layer-item:not(.background-layer-item) .layer-grab-area' ).first().click();
		await page.keyboard.press( 'ArrowRight' );
		const editedLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( editedLayers[ 0 ].x ).toBe( beforeEdit[ 0 ].x + 1 );

		let saveRequests = 0;
		page.on( 'request', ( request ) => {
			if ( ( request.postData() || '' ).includes( 'action=layerspublish' ) ) {
				saveRequests++;
			}
		} );

		let capturedPostData = null;
		const responsePromise = page.waitForResponse( ( response ) => {
			if ( response.url().includes( 'api.php' ) &&
				( response.request().postData() || '' ).includes( 'action=layerspublish' ) ) {
				capturedPostData = response.request().postData();
				return true;
			}
			return false;
		} );

		publicationPending = true;
		await page.locator( '.save-button' ).click();
		const savedResponse = await responsePromise;
		const saved = await savedResponse.json();
		expect( saveRequests ).toBe( 1 );

		// Inspect pageid and baserevid on actual editor POST
		const postParams = new URLSearchParams( capturedPostData );
		expect( postParams.get( 'pageid' ) ).toBe( String( pageId ) );
		expect( postParams.get( 'baserevid' ) ).toBe( String( seedRevId ) );
		expect( saved.error ).toBeUndefined();

		expect( saved.layerspublish?.result ).toBe( 'Success' );
		const newRevision = saved.layerspublish.revid;
		expect( Number.isInteger( newRevision ) ).toBe( true );
		expect( newRevision ).toBeGreaterThan( seedRevId );
		// Update last-confirmed-revision cleanup tracker immediately
		lastOwnedRevision = newRevision;
		publicationPending = false;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );
		const published = await api( { action: 'layersread', owner, revid: String( newRevision ) } );
		expect( published.layersread.snapshot.surfaces[ 0 ].layers ).toEqual( editedLayers );
		const history = await api( { action: 'query', prop: 'revisions', titles: owner,
			rvprop: 'ids', rvlimit: '2' } );
		expect( history.query.pages[ 0 ].pageid ).toBe( pageId );
		expect( history.query.pages[ 0 ].revisions.map( ( revision ) => revision.revid ) )
			.toEqual( [ newRevision, seedRevId ] );

		// Assert preserved main binding in the newly saved revision
		const newRevPage = await api( {
			action: 'query',
			prop: 'revisions',
			revids: String( newRevision ),
			rvprop: 'content',
			rvslots: 'main'
		} );
		const savedMainText = newRevPage.query.pages[ 0 ].revisions[ 0 ].slots.main.content;
		expect( savedMainText ).toBe( seedMainText );

		// Assert unchanged old snapshot
		const oldSnapshotCheck = await api( {
			action: 'layersread',
			owner,
			revid: String( seedRevId )
		} );
		expect( oldSnapshotCheck.layersread.snapshot ).toEqual( seededSnapshot );

		// 3. Navigate the same route at the old revision, at a wrong offset, and with an altered expected string
		const denialCases = [
			{
				name: 'old-stale-revision',
				params: {
					title: 'Special:EditLayersPage',
					pageid: String( pageId ),
					revid: String( seedRevId ),
					start: String( byteOffset ),
					expected: embedText
				}
			},
			{
				name: 'wrong-byte-offset',
				params: {
					title: 'Special:EditLayersPage',
					pageid: String( pageId ),
					revid: String( newRevision ),
					start: String( byteOffset + 8 ),
					expected: embedText
				}
			},
			{
				name: 'altered-expected-string',
				params: {
					title: 'Special:EditLayersPage',
					pageid: String( pageId ),
					revid: String( newRevision ),
					start: String( byteOffset ),
					expected: embedText.replace( 'WelcomePresentation', 'ForgedPresentation' )
				}
			}
		];

		for ( const denialCase of denialCases ) {
			const denialUrl = `${ base }/index.php?` + new URLSearchParams( denialCase.params );
			const denialResponse = await page.goto( denialUrl );
			expect( denialResponse.status() ).toBe( 200 );
			expect( denialResponse.request().redirectedFrom() ).toBeNull();

			const denialCache = denialResponse.headers()[ 'cache-control' ] || '';
			expect( denialCache.toLowerCase() ).toContain( 'no-store' );

			await expect( page.locator( '#mw-content-text' ) ).toContainText( 'The page-owned Layers editor is unavailable' );

			const denialBootstrap = await page.evaluate( () => window.wgLayersEditorInit ||
				( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersEditorInit' ) ) );
			expect( denialBootstrap ).toBeFalsy();
			expect( [ 'loading', 'loaded', 'executing', 'ready' ] ).not.toContain(
				await page.evaluate( () => mw.loader.getState( 'ext.layers.editor' ) ) );

			await expect( page.locator( '#layers-editor-container' ) ).toHaveCount( 0 );
			await expect( page.locator( '.layers-canvas' ) ).toHaveCount( 0 );
			await expect( page.locator( '.layers-page-revision-check-button' ) ).toHaveCount( 0 );
			await expect( page.locator( '.save-button' ) ).toHaveCount( 0 );
		}

		// Ensure no publication requests occurred during denial navigations
		expect( saveRequests ).toBe( 1 );
	} finally {
		const restore = async () => {
			if ( needsRestore ) {
				if ( publicationPending || !Number.isInteger( lastOwnedRevision ) ) {
					throw new Error( 'J73 cleanup requires review: publication outcome is uncertain; no restore attempted' );
				}
				const latestQuery = await api( {
					action: 'query',
					prop: 'info|revisions',
					titles: owner,
					rvprop: 'ids'
				} );
				const latest = latestQuery.query.pages[ 0 ];
				if ( latest.pageid !== pageId || latest.revisions[ 0 ].revid !== lastOwnedRevision ) {
					throw new Error( 'J73 cleanup requires review: another edit intervened; no restore attempted' );
				}
				const restoreRes = await api( {
					action: 'layerspublish',
					owner,
					pageid: String( pageId ),
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J73 cleanup: restore automated owner state',
					token: csrfToken
				}, true );
				if ( !restoreRes.layerspublish || restoreRes.layerspublish.result !== 'Success' ) {
					throw new Error( 'J73 cleanup failed; no retry or forced overwrite attempted' );
				}
				const restoredRevision = restoreRes.layerspublish.revid;
				const verifyRead = await api( { action: 'layersread', owner, revid: String( restoredRevision ) } );
				expect( verifyRead.layersread.snapshot ).toEqual( initialSnapshot );
				const verifyPage = await api( {
					action: 'query',
					prop: 'revisions',
					revids: String( restoredRevision ),
					rvprop: 'content',
					rvslots: 'main'
				} );
				expect( verifyPage.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );
			}
		};
		await restore();
	}
} );
