/* eslint-env node */
/**
 * J96 Acceptance: Browser acceptance of bare names after migration
 * Advances: HIST-4 and HIST-8.
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. From the owner page's baseline, publish text that adds:
 *    {{#Slide:Bare probe}} and [[File:B010.jpg|layerset=Bare notes]].
 * 2. The page view offers "Create layer set: Bare probe" and "Create layer set: Bare notes".
 *    Create the slide through its link, draw a rectangle and save.
 *    The page then paints it, and the embed in the page text is still bare.
 * 3. Rename the drawing to "Bare probe renamed" in the editor and save.
 *    The embed becomes {{#Slide:<pageId>:Bare probe renamed}}.
 * 4. A layerssave request for B010.jpg fails with migrated.
 * 5. Baseline restored by exact-base publication in main flow and finally.
 * 6. Read-only: on DeleteMe006 the images of FT-Image-149-000001.jpg and FT-Image-149-000002.jpg
 *    both paint their drawings, and FT-Image-149-000003.jpg is a plain image.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const { isWikiMigrated } = require( './helpers/migration' );

test.describe.configure( { mode: 'serial' } );

test( 'bare names mean page-owned drawings after migration (HIST-4, HIST-8)', async ( { page, context } ) => {
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

	const migrated = await isWikiMigrated( { context, base } );
	test.skip( !migrated, 'shared sets are read-only after the migration' );

	const owner = 'Layers_browser_acceptance';

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
	const pageId = initialPageData.pageid;
	expect( Number.isInteger( pageId ) ).toBe( true );

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

	const canvasToClient = async ( x, y ) => {
		const canvas = page.locator( '.layers-canvas' );
		const box = await canvas.boundingBox();
		return {
			x: box.x + x * ( box.width / 800 ),
			y: box.y + y * ( box.height / 600 )
		};
	};

	const drawDrag = async ( startX, startY, endX, endY ) => {
		const start = await canvasToClient( startX, startY );
		await page.mouse.move( start.x, start.y );
		await page.mouse.down();
		const end = await canvasToClient( endX, endY );
		await page.mouse.move( end.x, end.y );
		await page.waitForTimeout( 50 );
		await page.mouse.up();
		await page.waitForTimeout( 100 );
	};

	const drawRectangle = async () => {
		await selectToolbarTool( 'rectangle', 'shapes' );
		await drawDrag( 50, 50, 200, 150 );
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );
	};

	const renameDrawing = async ( newName ) => {
		const renameBtn = page.locator( 'button.layers-page-drawing-rename' );
		await expect( renameBtn ).toBeVisible();
		await renameBtn.click();
		const promptInput = page.locator( 'input.layers-modal-input' );
		await expect( promptInput ).toBeVisible();
		await promptInput.fill( newName );
		await page.locator( '.layers-modal-buttons button.layers-btn-primary' ).click();
	};

	try {
		// =========================================================================
		// Step 1: Baseline setup: Publish text with bare embeds
		//         {{#Slide:Bare probe}} and [[File:B010.jpg|layerset=Bare notes]]
		// =========================================================================
		needsRestore = true;

		const bareEmbedsText = `${ initialMainText }\n\n` +
			`{{#Slide:Bare probe}}\n\n` +
			`[[File:B010.jpg|layerset=Bare notes]]`;

		const pub1 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( initialSnapshot ),
			maintext: bareEmbedsText,
			summary: 'J96 step 1: seed bare embeds for bare names acceptance',
			token: csrfToken
		}, true );
		expect( pub1.layerspublish?.result ).toBe( 'Success' );
		const rev1 = pub1.layerspublish.revid;
		expect( rev1 ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = rev1;

		// =========================================================================
		// Step 2: Page view offers "Create layer set: Bare probe" and
		//         "Create layer set: Bare notes". Create slide through its link,
		//         draw a rectangle and save.
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await page.waitForLoadState( 'networkidle' );

		const createSlideLink = page.locator( '.layers-page-edit-link', { hasText: 'Create layer set: Bare probe' } );
		await expect( createSlideLink ).toBeVisible();

		const createFileLink = page.locator( '.layers-page-edit-link', { hasText: 'Create layer set: Bare notes' } );
		await expect( createFileLink ).toBeVisible();

		// Create slide through its link
		await Promise.all( [
			page.waitForNavigation(),
			createSlideLink.click()
		] );

		await page.waitForSelector( '.layers-canvas' );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Layer set: Bare probe' );

		// Draw one rectangle
		await drawRectangle();

		// Save slide drawing
		const saveBtn = page.locator( '.save-button' );
		await expect( saveBtn ).toBeVisible();
		const savePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await saveBtn.click();
		const saveResp = await savePromise;
		expect( saveResp.ok() ).toBe( true );
		const saveJson = await saveResp.json();
		expect( saveJson.layerspublish?.result ).toBe( 'Success' );
		const rev2 = saveJson.layerspublish.revid;
		expect( rev2 ).toBeGreaterThan( rev1 );
		lastOwnedRevision = rev2;
		await page.waitForFunction( () => !window.layersEditorInstance?.hasUnsavedChanges() );

		// Verify on page view: painted, and embed in page text is still bare
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await page.waitForLoadState( 'networkidle' );

		const slideContainer = page.locator( '.layers-bound-slide, .layers-slide-container' );
		await expect( slideContainer ).toBeVisible();
		const slideCanvas = slideContainer.locator( 'canvas' );
		await expect( slideCanvas ).toBeVisible();

		const rev2Query = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|content',
			rvslots: 'main'
		} );
		const rev2Text = rev2Query.query.pages[ 0 ].revisions[ 0 ].slots.main.content;
		expect( rev2Text ).toContain( '{{#Slide:Bare probe}}' );
		expect( rev2Text ).not.toContain( `{{#Slide:${ pageId }:Bare probe}}` );

		// =========================================================================
		// Step 3: Rename layer set to "Bare probe renamed" in editor and save.
		//         Embed becomes {{#Slide:<pageId>:Bare probe renamed}}.
		// =========================================================================
		const editSlideLink = page.locator( '.layers-page-edit-link', { hasText: 'Edit layer set: Bare probe' } );
		await expect( editSlideLink ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			editSlideLink.click()
		] );

		await page.waitForSelector( '.layers-canvas' );
		await renameDrawing( 'Bare probe renamed' );

		const savePromise2 = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await saveBtn.click();
		const saveResp2 = await savePromise2;
		expect( saveResp2.ok() ).toBe( true );
		const saveJson2 = await saveResp2.json();
		expect( saveJson2.layerspublish?.result ).toBe( 'Success' );
		const rev3 = saveJson2.layerspublish.revid;
		expect( rev3 ).toBeGreaterThan( rev2 );
		lastOwnedRevision = rev3;
		await page.waitForFunction( () => !window.layersEditorInstance?.hasUnsavedChanges() );

		// Embed becomes {{#Slide:<pageId>:Bare probe renamed}}
		const rev3Query = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|content',
			rvslots: 'main'
		} );
		const rev3Text = rev3Query.query.pages[ 0 ].revisions[ 0 ].slots.main.content;
		expect( rev3Text ).toContain( `{{#Slide:${ pageId }:Bare probe renamed}}` );
		expect( rev3Text ).not.toContain( '{{#Slide:Bare probe}}' );

		// =========================================================================
		// Step 4: Shared set save refusal:
		//         A layerssave request for B010.jpg fails with migrated.
		// =========================================================================
		const saveSharedRes = await api( {
			action: 'layerssave',
			filename: 'B010.jpg',
			token: csrfToken,
			data: JSON.stringify( {
				canvasWidth: 800,
				canvasHeight: 600,
				layers: []
			} )
		}, true );
		expect( saveSharedRes.error?.code ).toBe( 'migrated' );

		// Restore baseline in main flow
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J96 step 5: restore baseline after bare names acceptance',
			token: csrfToken
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		needsRestore = false;

		// =========================================================================
		// Step 6: Read-only on DeleteMe006:
		//         FT-Image-149-000001.jpg and FT-Image-149-000002.jpg paint drawings,
		//         FT-Image-149-000003.jpg is a plain image.
		// =========================================================================
		await page.goto( `${ base }/index.php?title=DeleteMe006` );
		await page.waitForLoadState( 'networkidle' );
		await page.waitForTimeout( 1500 );

		// FT-Image-149-000001.jpg paints drawing (host replaces img with canvas)
		const link1 = page.locator( 'a[href*="FT-Image-149-000001.jpg"]' );
		await expect( link1 ).toBeVisible();
		const host1 = link1.locator( '.layers-bound-file-view' );
		await expect( host1 ).toBeVisible();
		const canvas1 = host1.locator( 'canvas' );
		await expect( canvas1 ).toBeVisible();
		const hasNonWhite1 = await canvas1.evaluate( ( c ) => {
			const ctx = c.getContext( '2d' );
			if ( !ctx ) {
				return false;
			}
			const d = ctx.getImageData( 0, 0, c.width, c.height ).data;
			for ( let i = 0; i < d.length; i += 4 ) {
				if ( d[ i + 3 ] > 0 ) {
					return true;
				}
			}
			return false;
		} );
		expect( hasNonWhite1 ).toBe( true );

		// FT-Image-149-000002.jpg paints drawing (host replaces img with canvas)
		const link2 = page.locator( 'a[href*="FT-Image-149-000002.jpg"]' );
		await expect( link2 ).toBeVisible();
		const host2 = link2.locator( '.layers-bound-file-view' );
		await expect( host2 ).toBeVisible();
		const canvas2 = host2.locator( 'canvas' );
		await expect( canvas2 ).toBeVisible();
		const hasNonWhite2 = await canvas2.evaluate( ( c ) => {
			const ctx = c.getContext( '2d' );
			if ( !ctx ) {
				return false;
			}
			const d = ctx.getImageData( 0, 0, c.width, c.height ).data;
			for ( let i = 0; i < d.length; i += 4 ) {
				if ( d[ i + 3 ] > 0 ) {
					return true;
				}
			}
			return false;
		} );
		expect( hasNonWhite2 ).toBe( true );

		// FT-Image-149-000003.jpg is a plain image
		const link3 = page.locator( 'a[href*="FT-Image-149-000003.jpg"]' );
		await expect( link3 ).toBeVisible();
		const img3 = link3.locator( 'img' );
		await expect( img3 ).toBeVisible();
		await expect( link3.locator( '.layers-bound-file-view' ) ).toHaveCount( 0 );
		await expect( link3.locator( 'canvas' ) ).toHaveCount( 0 );
	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J96 cleanup: restore baseline in finally',
					token: csrfToken
				}, true );
			} catch ( _err ) {
				// cleanup best effort
			}
		}
	}
} );
