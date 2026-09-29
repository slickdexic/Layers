/* eslint-env node */
/**
 * J92 Acceptance: Browser acceptance of drawings on by default
 * Advances: HIST-3 (Drawings in page history are on by default for standard content pages).
 *
 * Proves on the test wiki (http://localhost:8080) that:
 * 1. A page nobody enrolled (Layers D2 probe) can start a drawing.
 *    Creates or resets Layers D2 probe with text {{#Slide:<pageId>:D2 slide}}.
 * 2. On page view, drawing controls offer "Create page drawing: D2 slide".
 *    Following it, drawing a rectangle and saving with empty summary creates exactly
 *    one new revision with comment 'Added drawing “D2 slide”' and tag 'layers-page-drawing',
 *    and the page then shows the painted drawing.
 * 3. A page outside configured namespaces (Project:Layers D2 probe) cannot start drawings:
 *    its page view offers no "Create page drawing" link, and layerspublish fails
 *    with 'layers-publication-disabled'.
 * 4. Owner page still works as before: editor opens, layer moves, saves, and baseline restores.
 * 5. Both probe pages remain in place (never deleted); on rerun, Layers D2 probe is reset with
 *    empty drawing list so step 2 starts from an uncreated drawing state.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'drawings on by default for content pages and disabled for Project: pages (HIST-3)', async ( { page, context } ) => {
	test.setTimeout( 240000 );
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
	const probeTitle = 'Layers D2 probe';
	const projectProbeTitle = 'Project:Layers D2 probe';

	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// Authenticate as QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	// Ten-minute quiet rule check on owner
	const siteGeneral = ( await api( { action: 'query', meta: 'siteinfo', siprop: 'general' } ) ).query.general;
	const serverTime = new Date( siteGeneral.time ).getTime();

	const initialOwnerQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: owner,
		rvprop: 'ids|timestamp|user|content',
		rvslots: 'main'
	} );
	const initialPageData = initialOwnerQuery.query.pages[ 0 ];
	expect( initialPageData.missing ).toBeUndefined();
	const ownerPageId = initialPageData.pageid;
	expect( Number.isInteger( ownerPageId ) ).toBe( true );

	const initialRev = initialPageData.revisions[ 0 ];
	const initialRevId = initialRev.revid;
	const initialMainText = initialRev.slots.main.content;
	const diffMinutes = ( serverTime - new Date( initialRev.timestamp ).getTime() ) / 60000;
	const isPrecedingTestCleanup = initialRev.user === config.username &&
		initialMainText === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65 wiki rules` );
	}

	// Verify owner starts in known baseline state
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;
	expect( initialMainText ).toBe( 'Dedicated automated Layers history acceptance page.' );
	expect( initialSnapshot.surfaces.map( ( s ) => [ s.id, s.kind, s.label ] ) )
		.toEqual( [ [ 'presentation', 'slide', 'Welcome Slide' ] ] );

	let lastOwnedRevision = null;
	let needsRestore = false;

	await page.setViewportSize( { width: 1920, height: 1080 } );

	// Helper to clear localStorage drafts
	const clearDrafts = async () => {
		await page.evaluate( () => {
			const keys = [];
			for ( let i = 0; i < localStorage.length; i++ ) {
				const k = localStorage.key( i );
				if ( k && k.startsWith( 'layers-page-owned-draft-v1:' ) ) {
					keys.push( k );
				}
			}
			for ( const k of keys ) {
				localStorage.removeItem( k );
			}
		} );
	};

	// Helper to select tools from the toolbar
	const selectToolbarTool = async ( toolId, groupId = null ) => {
		if ( groupId ) {
			const dropdown = page.locator( `.tool-dropdown[data-group-id="${ groupId }"]` );
			const menu = dropdown.locator( '.tool-dropdown-menu' );
			if ( !( await menu.isVisible() ) ) {
				await dropdown.locator( '.tool-dropdown-trigger' ).click();
				await expect( menu ).toBeVisible();
			}
			await dropdown.locator( `.tool-dropdown-item[data-tool="${ toolId }"]` ).click();
			await expect( menu ).not.toBeVisible();
		} else {
			await page.locator( `.tool-button[data-tool="${ toolId }"]` ).click();
		}
	};

	// Helper to map canvas logical coordinates to screen client coordinates
	const canvasToClient = async ( x, y ) => {
		const canvas = page.locator( '.layers-canvas' );
		const box = await canvas.boundingBox();
		return {
			x: box.x + x * ( box.width / 800 ),
			y: box.y + y * ( box.height / 600 )
		};
	};

	// Helper to draw a rectangle on canvas
	const drawRectangle = async () => {
		await selectToolbarTool( 'rectangle', 'shapes' );
		const start = await canvasToClient( 50, 50 );
		await page.mouse.move( start.x, start.y );
		await page.mouse.down();
		const end = await canvasToClient( 200, 150 );
		await page.mouse.move( end.x, end.y );
		await page.waitForTimeout( 50 );
		await page.mouse.up();
		await page.waitForTimeout( 100 );
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );
	};

	try {
		// =========================================================================
		// Step 1: Create or reset Layers D2 probe with text {{#Slide:<pageId>:D2 slide}}
		//         (create it first with plain text to learn its ID if not existing).
		//         Has no drawings and was never enrolled.
		// =========================================================================
		const probeQuery = await api( {
			action: 'query',
			prop: 'info|revisions',
			titles: probeTitle,
			rvprop: 'ids|content',
			rvslots: 'main'
		} );
		const probeData = probeQuery.query.pages[ 0 ];
		let probePageId;
		let probeBaseRevId;

		if ( probeData.missing ) {
			// Create first with plain text to learn its ID
			const initEdit = await api( {
				action: 'edit',
				title: probeTitle,
				text: 'Layers D2 probe initializing',
				summary: 'J92: initialize Layers D2 probe',
				token: csrfToken
			}, true );
			expect( initEdit.edit?.result ).toBe( 'Success' );
			probePageId = initEdit.edit.pageid;
			probeBaseRevId = initEdit.edit.newrevid;

			// Update with exact embed text
			const embedEdit = await api( {
				action: 'edit',
				title: probeTitle,
				text: `{{#Slide:${ probePageId }:D2 slide}}`,
				summary: 'J92: set probe embed text',
				baserevid: String( probeBaseRevId ),
				token: csrfToken
			}, true );
			expect( embedEdit.edit?.result ).toBe( 'Success' );
			probeBaseRevId = embedEdit.edit.newrevid;
		} else {
			// Existing from previous run: reset with empty drawing list (exact base, same text per step 5)
			probePageId = probeData.pageid;
			probeBaseRevId = probeData.revisions[ 0 ].revid;
			const resetPub = await api( {
				action: 'layerspublish',
				owner: probeTitle,
				baserevid: String( probeBaseRevId ),
				data: JSON.stringify( { schemaVersion: 1, surfaces: [] } ),
				maintext: `{{#Slide:${ probePageId }:D2 slide}}`,
				summary: 'J92: reset Layers D2 probe without drawings',
				token: csrfToken
			}, true );
			expect( resetPub.layerspublish?.result ).toBe( 'Success' );
			probeBaseRevId = resetPub.layerspublish?.revid || probeBaseRevId;
		}

		expect( Number.isInteger( probePageId ) ).toBe( true );
		expect( Number.isInteger( probeBaseRevId ) ).toBe( true );

		// =========================================================================
		// Step 2: On its page view, drawing controls offer "Create page drawing: D2 slide".
		//         Follow it, draw a rectangle, save with an empty summary.
		//         Exactly one new revision appears with comment 'Added drawing “D2 slide”'
		//         and tag 'layers-page-drawing', and page then shows the drawing.
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( probeTitle ) }` );
		await clearDrafts();

		const probeControls = page.locator( '.layers-page-edit-controls' );
		await expect( probeControls ).toBeVisible();

		const createD2Link = probeControls.locator( '.layers-page-edit-link', {
			hasText: 'Create page drawing: D2 slide'
		} );
		await expect( createD2Link ).toBeVisible();

		// Follow create link
		await Promise.all( [
			page.waitForNavigation(),
			createD2Link.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Drawing: D2 slide' );

		// Draw a rectangle
		await drawRectangle();
		const d2Layers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( d2Layers.length ).toBe( 1 );
		expect( d2Layers[ 0 ].type ).toBe( 'rectangle' );

		// Save with empty summary
		const summaryInput = page.getByLabel( 'Summary:' );
		await expect( summaryInput ).toHaveValue( '' );

		const saveD2Promise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveD2Res = await ( await saveD2Promise ).json();
		expect( saveD2Res.layerspublish?.result ).toBe( 'Success' );
		const d2Rev = saveD2Res.layerspublish.revid;
		expect( d2Rev ).toBeGreaterThan( probeBaseRevId );

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Verify revision comment and tag
		const probeRevQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: probeTitle,
			rvprop: 'ids|comment|tags',
			rvstartid: d2Rev,
			rvlimit: 1
		} );
		const probeRevData = probeRevQuery.query.pages[ 0 ].revisions[ 0 ];
		expect( probeRevData.revid ).toBe( d2Rev );
		expect( probeRevData.parentid ).toBe( probeBaseRevId );
		expect( probeRevData.comment ).toBe( 'Added drawing “D2 slide”' );
		expect( probeRevData.tags ).toContain( 'layers-page-drawing' );

		// Page then shows the drawing
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( probeTitle ) }` );
		const probeControlsAfter = page.locator( '.layers-page-edit-controls' );
		await expect( probeControlsAfter ).toBeVisible();

		const slideHost = page.locator( '.layers-bound-slide' );
		await expect( slideHost ).toBeVisible();
		const slideCanvas = slideHost.locator( 'canvas' );
		await expect( slideCanvas ).toBeVisible();

		// Controls now read "Edit page drawing: D2 slide"
		const editD2Link = probeControlsAfter.locator( '.layers-page-edit-link', {
			hasText: 'Edit page drawing: D2 slide'
		} );
		await expect( editD2Link ).toBeVisible();

		// =========================================================================
		// Step 3: Create or reset Project:Layers D2 probe the same way with its own page ID.
		//         Its page view offers no "Create page drawing" link, and a layerspublish
		//         API request for it fails with 'layers-publication-disabled'.
		// =========================================================================
		const projectQuery = await api( {
			action: 'query',
			prop: 'info|revisions',
			titles: projectProbeTitle,
			rvprop: 'ids'
		} );
		const projectData = projectQuery.query.pages[ 0 ];
		let projectPageId;
		let projectBaseRevId;

		if ( projectData.missing ) {
			const initProjectEdit = await api( {
				action: 'edit',
				title: projectProbeTitle,
				text: 'Project probe initializing',
				summary: 'J92: initialize Project probe',
				token: csrfToken
			}, true );
			expect( initProjectEdit.edit?.result ).toBe( 'Success' );
			projectPageId = initProjectEdit.edit.pageid;
			projectBaseRevId = initProjectEdit.edit.newrevid;

			const setProjectText = await api( {
				action: 'edit',
				title: projectProbeTitle,
				text: `{{#Slide:${ projectPageId }:D2 slide}}`,
				summary: 'J92: set project probe embed text',
				baserevid: String( projectBaseRevId ),
				token: csrfToken
			}, true );
			expect( setProjectText.edit?.result ).toBe( 'Success' );
			projectBaseRevId = setProjectText.edit.newrevid;
		} else {
			projectPageId = projectData.pageid;
			projectBaseRevId = projectData.revisions[ 0 ].revid;
			const resetProjectText = await api( {
				action: 'edit',
				title: projectProbeTitle,
				text: `{{#Slide:${ projectPageId }:D2 slide}}`,
				summary: 'J92: reset project probe text',
				baserevid: String( projectBaseRevId ),
				token: csrfToken
			}, true );
			expect( resetProjectText.edit?.result ).toBe( 'Success' );
			projectBaseRevId = resetProjectText.edit?.newrevid || projectBaseRevId;
		}

		expect( Number.isInteger( projectPageId ) ).toBe( true );
		expect( Number.isInteger( projectBaseRevId ) ).toBe( true );

		// On page view: offers no "Create page drawing" link
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( projectProbeTitle ) }` );
		await expect( page.locator( '.layers-page-edit-link' ) ).toHaveCount( 0 );

		// layerspublish API request with valid document fails with layers-publication-disabled
		const validDoc = {
			schemaVersion: 1,
			surfaces: [
				{
					id: 'd2_proj_slide',
					kind: 'slide',
					label: 'D2 slide',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: []
				}
			]
		};

		const pubProject = await api( {
			action: 'layerspublish',
			owner: projectProbeTitle,
			baserevid: String( projectBaseRevId ),
			data: JSON.stringify( validDoc ),
			token: csrfToken
		}, true );
		expect( pubProject.error?.code ).toBe( 'layers-publication-disabled' );

		// =========================================================================
		// Step 4: Owner page still works as before: open its drawing from editor route,
		//         move a layer, save, and restore baseline by exact-base publication.
		// =========================================================================
		needsRestore = true;

		await page.goto( `${ base }/index.php?` + new URLSearchParams( {
			title: 'Special:EditLayersPage',
			owner,
			revid: String( initialRevId ),
			surface: 'presentation'
		} ) );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Drawing: Welcome Slide' );

		// Move a layer
		const ownerLayerItem = page.locator( '.layer-item:not(.background-layer-item)' ).first();
		await ownerLayerItem.locator( '.layer-grab-area' ).click();
		await page.evaluate( () => document.activeElement && document.activeElement.blur() );
		const origOwnerY = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ].y );
		await page.keyboard.press( 'ArrowDown' );
		await page.waitForFunction( ( y ) => {
			const l = window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ];
			return l && l.y !== y;
		}, origOwnerY );

		// Save
		const saveOwnerPromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveOwnerRes = await ( await saveOwnerPromise ).json();
		expect( saveOwnerRes.layerspublish?.result ).toBe( 'Success' );
		const revOwner = saveOwnerRes.layerspublish.revid;
		expect( revOwner ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = revOwner;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Restore baseline by exact-base publication
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J92 cleanup: restore automated owner baseline state',
			token: csrfToken
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restorePub.layerspublish.revid;
		needsRestore = false;

		// Verify owner wikitext matches known baseline
		const verifyClean = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'content',
			rvslots: 'main'
		} );
		expect( verifyClean.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );

		const verifyLayers = await api( { action: 'layersread', owner, revid: String( lastOwnedRevision ) } );
		expect( verifyLayers.layersread?.snapshot?.surfaces?.length ).toBe( 1 );
		expect( verifyLayers.layersread.snapshot.surfaces[ 0 ].id ).toBe( 'presentation' );
		expect( verifyLayers.layersread.snapshot.surfaces[ 0 ].label ).toBe( 'Welcome Slide' );

		await clearDrafts();

	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J92 cleanup: restore automated owner baseline state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
