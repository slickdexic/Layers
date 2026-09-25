/* eslint-env node */
/** Opt-in: publishes only to the explicitly provisioned Layers_browser_acceptance test owner. */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );

// All tests advance the same dedicated automation owner; never run them concurrently.
test.describe.configure( { mode: 'serial' } );
let restoreVisibility = null;
test.afterEach( async () => {
	// Playwright gives teardown its own time budget, including after a test timeout.
	if ( restoreVisibility ) {
		const restore = restoreVisibility;
		restoreVisibility = null;
		await restore();
	}
} );

test( 'reload recovers an unsaved local drawing only after confirmation without publishing', async ( { page, context } ) => {
	test.skip( !process.env.LAYERS_ACCEPTANCE_CONFIG, 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( process.env.LAYERS_ACCEPTANCE_CONFIG, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ? await context.request.post( config.base + '/api.php', { form: params } ) :
			await context.request.get( config.base + '/api.php', { params } );
		return response.json();
	};
	const token = await api( { action: 'query', meta: 'tokens', type: 'login' } );
	const login = await api( { action: 'login', lgname: config.username, lgpassword: config.password,
		lgtoken: token.query.tokens.logintoken }, true );
	expect( login.login.result ).toBe( 'Success' );
	const history = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
	const revision = history.query.pages[ 0 ].revisions[ 0 ].revid;
	const before = await api( { action: 'layersread', owner, revid: String( revision ) } );
	await page.goto( config.base + '/index.php?' + new URLSearchParams( {
		title: 'Special:EditLayersPage', owner, revid: String( revision ), surface: 'presentation'
	} ) );
	await expect( page.locator( '.layers-page-revision-check-button' ) ).toBeVisible();
	let publications = 0;
	page.on( 'request', ( request ) => {
		if ( ( request.postData() || '' ).includes( 'action=layerspublish' ) ) {
			publications++;
		}
	} );
	await page.locator( '.layer-item:not(.background-layer-item)' ).first().click();
	await page.keyboard.press( 'ArrowDown' );
	const local = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
	// Wait for the actual debounced backup; never manufacture or inject a draft.
	await page.waitForFunction( ( expected ) => Object.keys( localStorage ).some( ( key ) => {
		if ( !key.startsWith( 'layers-page-owned-draft-v1:' ) ) {
			return false;
		}
		return JSON.stringify( JSON.parse( localStorage.getItem( key ) ).editorState.layers ) === JSON.stringify( expected );
	} ), local );
	const dismissed = new Promise( ( resolve ) => {
		page.once( 'dialog', async ( prompt ) => {
			expect( prompt.type() ).toBe( 'beforeunload' );
			await prompt.dismiss();
			resolve();
		} );
	} );
	// Do not wait for a navigation to complete: the user deliberately cancels it.
	await page.evaluate( () => { window.setTimeout( () => window.location.reload(), 0 ); } );
	await dismissed;
	await expect( page.locator( '.layers-canvas' ) ).toBeVisible();
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual( local );
	page.on( 'dialog', ( prompt ) => prompt.accept() );
	await page.reload();
	const dialog = page.locator( 'dialog.layers-page-recovery' );
	await expect( dialog ).toBeVisible();
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual(
		before.layersread.snapshot.surfaces[ 0 ].layers );
	await dialog.getByRole( 'button', { name: 'Restore local edits', exact: true } ).click();
	await expect( dialog ).toHaveCount( 0 );
	await expect( page.locator( '.layers-page-revision-check-button' ) ).toBeVisible();
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual( local );
	expect( publications ).toBe( 0 );
	const after = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
	expect( after ).toEqual( history );
	expect( await api( { action: 'layersread', owner, revid: String( revision ) } ) ).toEqual( before );
} );

test( 'two editors reject conflicting saves and retain the unsaved drawing during reconciliation', async ( { page, context } ) => {
	test.skip( !process.env.LAYERS_ACCEPTANCE_CONFIG, 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( process.env.LAYERS_ACCEPTANCE_CONFIG, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ? await context.request.post( config.base + '/api.php', { form: params } ) :
			await context.request.get( config.base + '/api.php', { params } );
		return response.json();
	};
	const token = await api( { action: 'query', meta: 'tokens', type: 'login' } );
	const login = await api( { action: 'login', lgname: config.username, lgpassword: config.password,
		lgtoken: token.query.tokens.logintoken }, true );
	expect( login.login.result ).toBe( 'Success' );
	const history = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
	const revision = history.query.pages[ 0 ].revisions[ 0 ].revid;
	const before = await api( { action: 'layersread', owner, revid: String( revision ) } );
	const editorUrl = config.base + '/index.php?' + new URLSearchParams( {
		title: 'Special:EditLayersPage', owner, revid: String( revision ), surface: 'presentation'
	} );
	const other = await context.newPage();
	for ( const tab of [ page, other ] ) {
		await tab.goto( editorUrl );
		await expect( tab.locator( '.layers-page-revision-check-button' ) ).toBeVisible();
	}
	for ( const [ tab, key ] of [ [ page, 'ArrowRight' ], [ other, 'ArrowDown' ] ] ) {
		await tab.locator( '.layer-item:not(.background-layer-item)' ).first().click();
		await tab.keyboard.press( key );
	}
	const save = async ( tab ) => {
		const pending = tab.waitForResponse( ( response ) => response.url().includes( 'api.php' ) &&
			( response.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await tab.locator( '.save-button' ).click();
		return ( await pending ).json();
	};
	const winner = await save( page );
	expect( winner.error ).toBeUndefined();
	const savedRevision = winner.layerspublish.revid;
	const rejected = await save( other );
	expect( rejected.error.code ).toBe( 'layers-edit-conflict' );
	const status = () => other.evaluate( () => window.layersEditorInstance.apiManager.pageOwnedBridge.session.getStatus() );
	await expect.poll( async () => ( await status() ).phase ).toBe( 'conflict' );
	const local = await other.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
	expect( local[ 0 ].x ).toBe( before.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].x );
	expect( local[ 0 ].y ).toBe( before.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].y + 1 );
	let posts = 0;
	other.on( 'request', ( request ) => {
		if ( ( request.postData() || '' ).includes( 'action=layerspublish' ) ) {
			posts++;
		}
	} );
	// The deliberate check may read, but must neither merge conflicting changes nor publish.
	await other.locator( '.layers-page-revision-check-button' ).click();
	await expect( other.locator( '.layers-page-revision-check-status' ) ).toHaveText(
		await other.evaluate( () => mw.msg( 'layers-page-revision-check-conflict' ) ) );
	expect( ( await status() ).phase ).toBe( 'conflict' );
	expect( await other.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual( local );
	expect( posts ).toBe( 0 );
	const after = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
	expect( after.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( savedRevision );
	expect( await api( { action: 'layersread', owner, revid: String( revision ) } ) ).toEqual( before );
} );

test( 'native editor save preserves the old revision and opens it from page history', async ( { page, context } ) => {
	test.skip( !process.env.LAYERS_ACCEPTANCE_CONFIG, 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( process.env.LAYERS_ACCEPTANCE_CONFIG, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ? await context.request.post( config.base + '/api.php', { form: params } ) :
			await context.request.get( config.base + '/api.php', { params } );
		return response.json();
	};
	const token = await api( { action: 'query', meta: 'tokens', type: 'login' } );
	const login = await api( { action: 'login', lgname: config.username, lgpassword: config.password,
		lgtoken: token.query.tokens.logintoken }, true );
	expect( login.login.result ).toBe( 'Success' );
	const history = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
	const revision = history.query.pages[ 0 ].revisions[ 0 ].revid;
	const before = await api( { action: 'layersread', owner, revid: String( revision ) } );
	expect( before.layersread.snapshot.surfaces[ 0 ].canvas.backgroundVisible ).toBe( true );
	const editorUrl = config.base + '/index.php?' + new URLSearchParams( {
		title: 'Special:EditLayersPage', owner, revid: String( revision ), surface: 'presentation'
	} );
	const readRequestPromise = page.waitForRequest( ( request ) => {
		const u = new URL( request.url() );
		return u.searchParams.get( 'action' ) === 'layersread';
	} );
	await page.goto( editorUrl );
	const readRequest = await readRequestPromise;
	expect( new URL( readRequest.url() ).searchParams.get( 'formatversion' ) ).toBe( '2' );
	await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );
	// The real mw.Api client must preserve JSON booleans before any user changes.
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'backgroundVisible' ) ) ).toBe( true );
	await page.locator( '.layer-item:not(.background-layer-item)' ).first().click();
	await page.keyboard.press( 'ArrowRight' );
	const responsePromise = page.waitForResponse( ( response ) => response.url().includes( 'api.php' ) &&
		( response.request().postData() || '' ).includes( 'action=layerspublish' ) );
	await page.locator( '.save-button' ).click();
	const saved = await ( await responsePromise ).json();
	expect( saved.error ).toBeUndefined();
	const newRevision = saved.layerspublish.revid;
	expect( newRevision ).toBeGreaterThan( revision );
	const old = await api( { action: 'layersread', owner, revid: String( revision ) } );
	expect( old ).toEqual( before );
	const current = await api( { action: 'layersread', owner, revid: String( newRevision ) } );
	expect( current.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].x ).toBe(
		before.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].x + 1 );
	const viewer = await context.newPage();
	await viewer.goto( config.base + '/index.php?' + new URLSearchParams( { title: owner, action: 'history' } ) );
	await viewer.locator( '.layers-history-view-link[href*="revid=' + revision + '"]' ).click();
	await expect( viewer.locator( '.ext-layers-historical-canvas' ) ).toBeVisible();
	expect( await viewer.evaluate( () => mw.config.get( 'wgLayersRevisionView' ).surface ) ).toEqual(
		before.layersread.snapshot.surfaces[ 0 ] );
	expect( await viewer.evaluate( () => mw.config.get( 'wgLayersRevisionView' ).revisionId ) ).toBe( revision );
	await expect( viewer.locator( '.save-button' ) ).toHaveCount( 0 );
} );

test( 'native editor preserves and round-trips false boolean values across save, reopen and historical viewing', async ( { page, context } ) => {
	test.skip( !process.env.LAYERS_ACCEPTANCE_CONFIG, 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( process.env.LAYERS_ACCEPTANCE_CONFIG, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ? await context.request.post( config.base + '/api.php', { form: params } ) :
			await context.request.get( config.base + '/api.php', { params } );
		return response.json();
	};
	const loginToken = await api( { action: 'query', meta: 'tokens', type: 'login' } );
	const login = await api( { action: 'login', lgname: config.username, lgpassword: config.password,
		lgtoken: loginToken.query.tokens.logintoken }, true );
	expect( login.login.result ).toBe( 'Success' );

	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;
	const history = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
	const currentRev = history.query.pages[ 0 ].revisions[ 0 ].revid;
	const currentRead = await api( { action: 'layersread', owner, revid: String( currentRev ) } );

	// 1. Seed only the disposable owner using the authenticated native publication API,
	// preserving all unrelated snapshot fields while ensuring visible starting state.
	const seedSnapshot = JSON.parse( JSON.stringify( currentRead.layersread.snapshot ) );
	seedSnapshot.surfaces[ 0 ].canvas.backgroundVisible = true;
	seedSnapshot.surfaces[ 0 ].layers[ 0 ].visible = true;
	const seedResult = await api( {
		action: 'layerspublish',
		owner,
		baserevid: String( currentRev ),
		data: JSON.stringify( seedSnapshot ),
		summary: 'Seed baseline with visible background and layer',
		token: csrfToken
	}, true );
	expect( seedResult.error ).toBeUndefined();
	const baseRevision = seedResult.layerspublish.revid;

	restoreVisibility = async () => {
		// Also restore visibility if a UI assertion or navigation fails after Save.
		// Read the current snapshot so cleanup never rolls back unrelated edits.
		const latestHistory = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
		const latestRevision = latestHistory.query.pages[ 0 ].revisions[ 0 ].revid;
		const latestRead = await api( { action: 'layersread', owner, revid: String( latestRevision ) } );
		const latest = latestRead.layersread.snapshot;
		if ( latest.surfaces[ 0 ].canvas.backgroundVisible !== true || latest.surfaces[ 0 ].layers[ 0 ].visible !== true ) {
			latest.surfaces[ 0 ].canvas.backgroundVisible = true;
			latest.surfaces[ 0 ].layers[ 0 ].visible = true;
			const restored = await api( { action: 'layerspublish', owner, baserevid: String( latestRevision ),
				data: JSON.stringify( latest ), summary: 'Restore browser test visibility after failure', token: csrfToken }, true );
			expect( restored.error ).toBeUndefined();
		}
	};
	// Open the editor at the seeded base revision and assert layersread request sends formatversion=2
	const editorUrl = config.base + '/index.php?' + new URLSearchParams( {
		title: 'Special:EditLayersPage', owner, revid: String( baseRevision ), surface: 'presentation'
	} );
	const initialReadPromise = page.waitForRequest( ( request ) => {
		const u = new URL( request.url() );
		return u.searchParams.get( 'action' ) === 'layersread' && u.searchParams.get( 'revid' ) === String( baseRevision );
	} );
	await page.goto( editorUrl );
	const initialRead = await initialReadPromise;
	expect( new URL( initialRead.url() ).searchParams.get( 'formatversion' ) ).toBe( '2' );
	await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );

	// Confirm initial true state
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'backgroundVisible' ) ) ).toBe( true );
	expect( await page.evaluate( () => {
		const l = window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ];
		return l.visible !== false && l.visible !== 0;
	} ) ).toBe( true );

	// Toggle background visibility (true -> false) and layer visibility (true -> false) through actual editor UI
	await page.locator( '.background-layer-item .background-visibility-btn' ).click();
	await page.locator( '.layer-item:not(.background-layer-item) .layer-visibility' ).first().click();

	// Verify editor state before saving
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'backgroundVisible' ) ) ).toBe( false );
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ].visible ) ).toBe( false );

	// Save through actual editor
	const savePromise = page.waitForResponse( ( response ) => response.url().includes( 'api.php' ) &&
		( response.request().postData() || '' ).includes( 'action=layerspublish' ) );
	await page.locator( '.save-button' ).click();
	const saved = await ( await savePromise ).json();
	expect( saved.error ).toBeUndefined();
	const hiddenRevision = saved.layerspublish.revid;
	// A received HTTP response precedes completion of the editor save lifecycle.
	await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );
	expect( hiddenRevision ).toBeGreaterThan( baseRevision );

	// Reopen the exact newly saved revision and assert both properties still exist with boolean false
	const reopenUrl = config.base + '/index.php?' + new URLSearchParams( {
		title: 'Special:EditLayersPage', owner, revid: String( hiddenRevision ), surface: 'presentation'
	} );
	const reopenReadPromise = page.waitForRequest( ( request ) => {
		const u = new URL( request.url() );
		return u.searchParams.get( 'action' ) === 'layersread' && u.searchParams.get( 'revid' ) === String( hiddenRevision );
	} );
	await page.goto( reopenUrl );
	const reopenRead = await reopenReadPromise;
	expect( new URL( reopenRead.url() ).searchParams.get( 'formatversion' ) ).toBe( '2' );
	await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'backgroundVisible' ) ) ).toBe( false );
	expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ].visible ) ).toBe( false );

	// 2 & 3. Restore the disposable owner's initial canvas/layer visibility with another ordinary publication
	// in cleanup, preserving its history. This creates a later publication after hiddenRevision.
	const readHidden = await api( { action: 'layersread', owner, revid: String( hiddenRevision ) } );
	expect( readHidden.layersread.snapshot.surfaces[ 0 ].canvas.backgroundVisible ).toBe( false );
	expect( readHidden.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].visible ).toBe( false );

	const restoreSnapshot = JSON.parse( JSON.stringify( readHidden.layersread.snapshot ) );
	restoreSnapshot.surfaces[ 0 ].canvas.backgroundVisible = true;
	restoreSnapshot.surfaces[ 0 ].layers[ 0 ].visible = true;

	const cleanupResult = await api( {
		action: 'layerspublish',
		owner,
		baserevid: String( hiddenRevision ),
		data: JSON.stringify( restoreSnapshot ),
		summary: 'Restore initial canvas/layer visibility in cleanup',
		token: csrfToken
	}, true );
	expect( cleanupResult.error ).toBeUndefined();
	const laterRevision = cleanupResult.layerspublish.revid;
	expect( laterRevision ).toBeGreaterThan( hiddenRevision );

	// Verify the historical viewer uses that explicit revision (hiddenRevision) after later publication
	const viewer = await context.newPage();
	await viewer.goto( config.base + '/index.php?' + new URLSearchParams( { title: owner, action: 'history' } ) );
	await viewer.locator( '.layers-history-view-link[href*="revid=' + hiddenRevision + '"]' ).click();
	await expect( viewer.locator( '.ext-layers-historical-canvas' ) ).toBeVisible();
	expect( await viewer.evaluate( () => mw.config.get( 'wgLayersRevisionView' ).revisionId ) ).toBe( hiddenRevision );
	expect( await viewer.evaluate( () => mw.config.get( 'wgLayersRevisionView' ).surface.canvas.backgroundVisible ) ).toBe( false );
	expect( await viewer.evaluate( () => mw.config.get( 'wgLayersRevisionView' ).surface.layers[ 0 ].visible ) ).toBe( false );
	await expect( viewer.locator( '.save-button' ) ).toHaveCount( 0 );

	// Assert native read returns exact false values
	const verifiedOld = await api( { action: 'layersread', owner, revid: String( hiddenRevision ) } );
	expect( verifiedOld.layersread.snapshot.surfaces[ 0 ].canvas.backgroundVisible ).toBe( false );
	expect( verifiedOld.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].visible ).toBe( false );

	// Verify cleanup publication restored true values on the latest revision
	const verifiedLatest = await api( { action: 'layersread', owner, revid: String( laterRevision ) } );
	expect( verifiedLatest.layersread.snapshot.surfaces[ 0 ].canvas.backgroundVisible ).toBe( true );
	expect( verifiedLatest.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].visible ).toBe( true );

} );

test( 'lost publication response enters uncertain phase and continues editing after deliberate reconciliation', async ( { page, context } ) => {
	test.skip( !process.env.LAYERS_ACCEPTANCE_CONFIG, 'Requires an explicitly provisioned, seeded pilot automation owner' );
	const config = JSON.parse( fs.readFileSync( process.env.LAYERS_ACCEPTANCE_CONFIG, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	const owner = 'Layers_browser_acceptance';
	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ? await context.request.post( config.base + '/api.php', { form: params } ) :
			await context.request.get( config.base + '/api.php', { params } );
		return response.json();
	};
	const loginToken = await api( { action: 'query', meta: 'tokens', type: 'login' } );
	const login = await api( { action: 'login', lgname: config.username, lgpassword: config.password,
		lgtoken: loginToken.query.tokens.logintoken }, true );
	expect( login.login.result ).toBe( 'Success' );

	const history = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids', rvlimit: 5 } );
	const revision = history.query.pages[ 0 ].revisions[ 0 ].revid;
	const before = await api( { action: 'layersread', owner, revid: String( revision ) } );

	const editorUrl = config.base + '/index.php?' + new URLSearchParams( {
		title: 'Special:EditLayersPage', owner, revid: String( revision ), surface: 'presentation'
	} );
	const initialReadPromise = page.waitForRequest( ( request ) => {
		const u = new URL( request.url() );
		return u.searchParams.get( 'action' ) === 'layersread' && u.searchParams.get( 'revid' ) === String( revision );
	} );
	await page.goto( editorUrl );
	const initialRead = await initialReadPromise;
	expect( new URL( initialRead.url() ).searchParams.get( 'formatversion' ) ).toBe( '2' );
	await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );
	await expect( page.locator( '.layers-page-revision-check-button' ) ).toBeVisible();

	// 1. Make an actual UI drawing edit
	await page.locator( '.layer-item:not(.background-layer-item) .layer-grab-area' ).first().click();
	await page.keyboard.press( 'ArrowRight' );
	const editedLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
	expect( editedLayers[ 0 ].x ).toBe( before.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].x + 1 );
	expect( await page.evaluate( () => window.layersEditorInstance.hasUnsavedChanges() ) ).toBe( true );

	let publicationCount = 0;
	page.on( 'request', ( request ) => {
		if ( ( request.postData() || '' ).includes( 'action=layerspublish' ) ) {
			publicationCount++;
		}
	} );

	// Intercept only that editor's next layerspublish request, forward once to the real native API,
	// verify the response confirms a new revision, then abort delivery to the editor.
	let interceptedPublish = false;
	let committedRevision = null;
	const routePattern = '**/api.php*';

	await page.route( routePattern, async ( route ) => {
		const postData = route.request().postData() || '';
		if ( !interceptedPublish && postData.includes( 'action=layerspublish' ) ) {
			interceptedPublish = true;
			const response = await route.fetch();
			const json = await response.json();
			expect( json.error ).toBeUndefined();
			expect( json.layerspublish?.result ).toBe( 'Success' );
			expect( typeof json.layerspublish?.revid ).toBe( 'number' );
			expect( json.layerspublish.revid ).toBeGreaterThan( revision );
			committedRevision = json.layerspublish.revid;
			await route.abort( 'failed' );
			return;
		}
		await route.continue();
	} );

	try {
		const status = () => page.evaluate( () => window.layersEditorInstance.apiManager.pageOwnedBridge.session.getStatus() );

		// Save through UI with intercepted and aborted response
		await page.locator( '.save-button' ).click();

		// 2. Verify the browser enters uncertain, preserves its local drawing/base, and does not retry
		await expect.poll( async () => ( await status() ).phase ).toBe( 'uncertain' );
		expect( ( await status() ).revisionId ).toBe( revision );
		expect( ( await status() ).dirty ).toBe( true );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual( editedLayers );
		expect( publicationCount ).toBe( 1 );

		// Trigger another Save through UI and verify it is blocked without another publication request
		// Observe completion of this specific click, not an already-idle flag.
		await page.evaluate( () => {
			const editor = window.layersEditorInstance;
			const save = editor.save;
			window.layersAcceptanceSaveCompleted = false;
			editor.save = function ( ...args ) {
				editor.save = save;
				return Promise.resolve( save.apply( this, args ) ).finally( () => {
					window.layersAcceptanceSaveCompleted = true;
				} );
			};
		} );
		await page.locator( '.save-button' ).click();
		await page.waitForFunction( () => window.layersAcceptanceSaveCompleted === true );
		await page.waitForFunction( () => !window.layersEditorInstance.apiManager.pageOwnedBridge.saving );
		await expect( page.locator( '.layers-spinner' ) ).toHaveCount( 0 );
		expect( ( await status() ).phase ).toBe( 'uncertain' );
		expect( publicationCount ).toBe( 1 );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual( editedLayers );

		// Inspect native history to verify exactly one new revision and unchanged old snapshot
		const historyAfterBlocked = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids', rvlimit: 5 } );
		expect( historyAfterBlocked.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( committedRevision );
		expect( historyAfterBlocked.query.pages[ 0 ].revisions[ 1 ].revid ).toBe( revision );
		const oldSnapshot = await api( { action: 'layersread', owner, revid: String( revision ) } );
		expect( oldSnapshot ).toEqual( before );

		// Release route interception before reconciliation
		await page.unroute( routePattern );

		// 3. Click Check saved page and observe exact read using formatversion=2
		const reconcileReadPromise = page.waitForRequest( ( request ) => {
			const u = new URL( request.url() );
			return u.searchParams.get( 'action' ) === 'layersread' &&
				u.searchParams.get( 'revid' ) === String( committedRevision );
		} );
		await page.locator( '.layers-page-revision-check-button' ).click();
		const reconcileRead = await reconcileReadPromise;
		expect( new URL( reconcileRead.url() ).searchParams.get( 'formatversion' ) ).toBe( '2' );

		// Reconciliation recognizes committed drawing, adopts its explicit revision, becomes ready/clean
		await expect( page.locator( '.layers-page-revision-check-status' ) ).toHaveText(
			await page.evaluate( () => mw.msg( 'layers-page-revision-check-matched' ) )
		);
		await expect.poll( async () => ( await status() ).phase ).toBe( 'ready' );
		expect( ( await status() ).revisionId ).toBe( committedRevision );
		expect( ( await status() ).dirty ).toBe( false );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'isDirty' ) ) ).toBe( false );
		expect( await page.evaluate( () => window.layersEditorInstance.hasUnsavedChanges() ) ).toBe( false );
		expect( publicationCount ).toBe( 1 );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) ) ).toEqual( editedLayers );

		// 4. Make a second distinct UI edit and save normally
		await page.locator( '.layer-item:not(.background-layer-item) .layer-grab-area' ).first().click();
		await page.keyboard.press( 'ArrowRight' );
		const secondEditedLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( secondEditedLayers[ 0 ].x ).toBe( editedLayers[ 0 ].x + 1 );
		expect( await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'isDirty' ) ) ).toBe( true );

		const secondSavePromise = page.waitForResponse( ( response ) =>
			response.url().includes( 'api.php' ) &&
			( response.request().postData() || '' ).includes( 'action=layerspublish' )
		);
		await page.locator( '.save-button' ).click();
		const secondSaveResponse = await secondSavePromise;
		const secondSaved = await secondSaveResponse.json();
		expect( secondSaved.error ).toBeUndefined();
		expect( secondSaved.layerspublish?.result ).toBe( 'Success' );
		const secondRevision = secondSaved.layerspublish.revid;
		expect( secondRevision ).toBeGreaterThan( committedRevision );

		// Verify editor continues cleanly after reconciliation
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );
		expect( ( await status() ).phase ).toBe( 'ready' );
		expect( ( await status() ).revisionId ).toBe( secondRevision );
		expect( ( await status() ).dirty ).toBe( false );

		const secondRead = await api( { action: 'layersread', owner, revid: String( secondRevision ) } );
		expect( publicationCount ).toBe( 2 );
		expect( secondRead.layersread.snapshot.surfaces[ 0 ].layers[ 0 ].x ).toBe( secondEditedLayers[ 0 ].x );

		const finalHistory = await api( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids', rvlimit: 5 } );
		const revisionIds = finalHistory.query.pages[ 0 ].revisions.map( ( r ) => r.revid );
		expect( revisionIds[ 0 ] ).toBe( secondRevision );
		expect( revisionIds[ 1 ] ).toBe( committedRevision );
		expect( revisionIds ).toContain( revision );
	} finally {
		await page.unroute( routePattern ).catch( () => {} );
	}
} );
