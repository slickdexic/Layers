/* eslint-env node */
/**
 * J65b move continuity browser acceptance:
 * Proves in real Chromium on the original test wiki (http://localhost:8080) that
 * a page-owned drawing survives a native page move (with noredirect), survives
 * UI editing under the new title, survives history drawing restoration from
 * Special:ViewLayersPage, and survives moving back to the original title with
 * PageID preserved throughout.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'page-owned drawing survives native move, editing, history restore, and move back', async ( { page, context } ) => {
	test.setTimeout( 180000 );
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
	const movedTitle = 'Layers_browser_acceptance_moved';

	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// Authenticate as the QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	// 1. Read the test account's rights (meta=userinfo&uiprop=rights).
	// Skip with a clear message unless it has move and suppressredirect.
	const userinfo = ( await api( { action: 'query', meta: 'userinfo', uiprop: 'rights' } ) ).query.userinfo;
	const hasMove = userinfo.rights.includes( 'move' );
	const hasSuppressRedirect = userinfo.rights.includes( 'suppressredirect' );
	test.skip( !hasMove || !hasSuppressRedirect, 'Test account requires move and suppressredirect rights for noredirect page moves' );

	// 2. Ten-minute rule: verify owner has not changed in the last 10 minutes
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
	expect( typeof pageId ).toBe( 'number' );
	expect( pageId ).toBeGreaterThan( 0 );

	const initialRev = initialPageData.revisions[ 0 ];
	const initialRevId = initialRev.revid;
	const initialMainText = initialRev.slots.main.content;
	const diffMinutes = ( serverTime - new Date( initialRev.timestamp ).getTime() ) / 60000;
	const isPrecedingTestCleanup = initialRev.user === config.username &&
		initialMainText === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65b wiki rules` );
	}

	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	let pageAtMovedTitle = false;

	try {
		// 2. Seed one bound slide by exact-base publication, as existing specs do, and record the PageID.
		const surfaceId = 'slide_journey_move';
		const binding = `v1:${ pageId }:${ surfaceId }`;
		const embedText = `{{#Slide:WelcomePresentation|layersbinding=${ binding }|width=400}}`;
		const seedMainText = `${ initialMainText }\n\n== Move Continuity Section ==\n${ embedText }`;

		const seededSnapshot = {
			schemaVersion: 1,
			surfaces: [
				...initialSnapshot.surfaces,
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Move Continuity Slide',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: [
						{
							id: 'move_rect',
							type: 'rectangle',
							x: 50,
							y: 50,
							width: 200,
							height: 100,
							fill: '#ff0000',
							stroke: 'none'
						},
						{
							id: 'move_text',
							type: 'text',
							x: 60,
							y: 80,
							text: 'Move Continuity Text',
							fontSize: 20,
							color: '#000000'
						}
					],
					readingOrder: [ 'move_rect', 'move_text' ]
				}
			]
		};

		const seedPub = await api( {
			action: 'layerspublish',
			owner,
			pageid: String( pageId ),
			baserevid: String( initialRevId ),
			data: JSON.stringify( seededSnapshot ),
			maintext: seedMainText,
			summary: 'J65b: seed bound slide before move',
			token: csrfToken
		}, true );
		expect( seedPub.layerspublish?.result ).toBe( 'Success' );
		const preMoveRevId = seedPub.layerspublish.revid;

		// 3. Move the owner to the new title with the API (action=move).
		// Both moves use noredirect, so no redirect page is left behind.
		const moveRes = await api( {
			action: 'move',
			from: owner,
			to: movedTitle,
			noredirect: 1,
			reason: 'J65b: move owner to moved title',
			token: csrfToken
		}, true );
		expect( moveRes.move ).toBeDefined();
		expect( moveRes.move.to ).toBe( 'Layers browser acceptance moved' );
		pageAtMovedTitle = true;

		// Check the old title must not exist
		const oldTitleQuery = ( await api( { action: 'query', titles: owner } ) ).query.pages[ 0 ];
		expect( oldTitleQuery.missing ).toBeDefined();

		// Check new title retains the exact PageID
		const movedTitleQuery = ( await api( { action: 'query', titles: movedTitle, prop: 'info' } ) ).query.pages[ 0 ];
		expect( movedTitleQuery.pageid ).toBe( pageId );

		// At the new title: check the drawing's pixels
		await page.goto( `${ base }/index.php?title=${ movedTitle }` );
		const movedSlideCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await expect( movedSlideCanvas ).toBeVisible();
		// At (60, 60), the rectangle is red [255, 0, 0, 255]
		await expect.poll( () => movedSlideCanvas.evaluate( ( c ) =>
			Array.from( c.getContext( '2d' ).getImageData( 60, 60, 1, 1 ).data ) ) ).toEqual( [ 255, 0, 0, 255 ] );

		// Check the page's edit link: open it, change one layer, save, and check the saved revision
		const editLink = page.locator( '.layers-page-edit-link' );
		await expect( editLink ).toHaveCount( 1 );
		await expect( editLink ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			editLink.click()
		] );

		await expect( page.locator( '.layers-canvas' ) ).toBeVisible();
		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );

		const beforeEdit = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		// Select non-background layer and move +1px right
		await page.locator( '.layer-item:not(.background-layer-item) .layer-grab-area' ).first().click();
		await page.keyboard.press( 'ArrowRight' );
		const editedLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( editedLayers[ 0 ].x ).toBe( beforeEdit[ 0 ].x + 1 );

		const savePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const savedRes = await ( await savePromise ).json();
		expect( savedRes.layerspublish?.result ).toBe( 'Success' );
		const postEditRevId = savedRes.layerspublish.revid;
		expect( postEditRevId ).toBeGreaterThan( preMoveRevId );
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Check the saved revision: tagged layers-page-drawing
		const historyAfterEdit = ( await api( {
			action: 'query',
			prop: 'revisions',
			titles: movedTitle,
			rvprop: 'ids|tags',
			rvlimit: 2
		} ) ).query.pages[ 0 ].revisions;
		expect( historyAfterEdit[ 0 ].revid ).toBe( postEditRevId );
		expect( historyAfterEdit[ 0 ].tags ).toContain( 'layers-page-drawing' );

		// Check the history link to the pre-move revision
		await page.goto( `${ base }/index.php?title=${ movedTitle }&action=history` );
		const preMoveHistoryLink = page.locator( `a.layers-history-view-link[href*="revid=${ preMoveRevId }"][href*="surface=${ surfaceId }"]` );
		await expect( preMoveHistoryLink ).toHaveCount( 1 );
		await expect( preMoveHistoryLink ).toBeVisible();

		// Check layersread with the new title
		const readMoved = await api( {
			action: 'layersread',
			owner: movedTitle,
			revid: String( postEditRevId )
		} );
		const movedSurface = readMoved.layersread?.snapshot?.surfaces.find( ( s ) => s.id === surfaceId );
		expect( movedSurface?.layers ).toEqual( editedLayers );

		// 3a. Still at the new title, open the pre-edit version of the drawing from page history
		// and use Restore this version.
		await Promise.all( [
			page.waitForNavigation(),
			preMoveHistoryLink.click()
		] );

		await expect( page.locator( '.ext-layers-historical-canvas' ) ).toBeVisible();

		// Verify "Restore this version" form is offered
		const restoreButton = page.locator( '.mw-htmlform-submit button, button[type=submit]' );
		await expect( restoreButton ).toBeVisible();
		await expect( restoreButton ).toContainText( 'Restore this version' );

		const preRestoreQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: movedTitle,
			rvprop: 'content',
			rvslots: 'main'
		} );
		const preRestoreText = preRestoreQuery.query.pages[ 0 ].revisions[ 0 ].slots.main.content;

		// Submit the restore form
		await Promise.all( [
			page.waitForURL( ( u ) => u.searchParams.get( 'title' ) === movedTitle ||
				u.pathname.endsWith( '/' + movedTitle ) ),
			restoreButton.click()
		] );

		// Check the page shows that version again (pixel check: red at (50, 55))
		const restoredCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await expect( restoredCanvas ).toBeVisible();
		await expect.poll( () => restoredCanvas.evaluate( ( c ) =>
			Array.from( c.getContext( '2d' ).getImageData( 50, 55, 1, 1 ).data ) ) ).toEqual( [ 255, 0, 0, 255 ] );

		// Check history gained exactly one tagged revision, and the page text did not change
		const historyAfterRestore = ( await api( {
			action: 'query',
			prop: 'revisions',
			titles: movedTitle,
			rvprop: 'ids|tags|comment|content',
			rvslots: 'main',
			rvlimit: 5
		} ) ).query.pages[ 0 ].revisions;
		const restoredRev = historyAfterRestore[ 0 ];
		expect( restoredRev.revid ).toBeGreaterThan( postEditRevId );
		expect( restoredRev.tags ).toContain( 'layers-page-drawing' );
		expect( restoredRev.slots.main.content ).toBe( preRestoreText );

		// 4. Move it back the same way and check the PageID is unchanged and the drawing still renders.
		const moveBackRes = await api( {
			action: 'move',
			from: movedTitle,
			to: owner,
			noredirect: 1,
			reason: 'J65b: move back to original title',
			token: csrfToken
		}, true );
		expect( moveBackRes.move ).toBeDefined();
		expect( moveBackRes.move.to ).toBe( 'Layers browser acceptance' );
		pageAtMovedTitle = false;

		// Check PageID is unchanged
		const backQuery = ( await api( { action: 'query', titles: owner, prop: 'info' } ) ).query.pages[ 0 ];
		expect( backQuery.pageid ).toBe( pageId );

		// Check drawing still renders at original title
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const originalCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await expect( originalCanvas ).toBeVisible();
		await expect.poll( () => originalCanvas.evaluate( ( c ) =>
			Array.from( c.getContext( '2d' ).getImageData( 50, 55, 1, 1 ).data ) ) ).toEqual( [ 255, 0, 0, 255 ] );

		// Restore the owner with the usual exact-base cleanup
		const latestBackRev = ( await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids'
		} ) ).query.pages[ 0 ].revisions[ 0 ].revid;

		const cleanupPub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( latestBackRev ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J65b cleanup: restore automated owner state',
			token: csrfToken
		}, true );
		expect( cleanupPub.layerspublish?.result ).toBe( 'Success' );
	} finally {
		// 5. If any step fails after the first move, move the page back before anything else,
		// and never delete a page. If moving back fails, stop and report; do not retry.
		if ( pageAtMovedTitle ) {
			const fallbackMove = await api( {
				action: 'move',
				from: movedTitle,
				to: owner,
				noredirect: 1,
				reason: 'J65b cleanup: emergency move back to original title',
				token: csrfToken
			}, true );
			if ( fallbackMove.move ) {
				pageAtMovedTitle = false;
			} else {
				// Stop and report; do not retry
				console.error( 'CRITICAL: J65b moving back failed:', JSON.stringify( fallbackMove ) );
			}
		}

		// Ensure owner is restored to baseline text and snapshot
		if ( !pageAtMovedTitle ) {
			const checkCurrent = ( await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'ids|content',
				rvslots: 'main'
			} ) ).query.pages[ 0 ];
			if ( checkCurrent && !checkCurrent.missing && checkCurrent.revisions ) {
				const curRev = checkCurrent.revisions[ 0 ];
				if ( curRev.slots.main.content !== initialMainText ) {
					await api( {
						action: 'layerspublish',
						owner,
						baserevid: String( curRev.revid ),
						data: JSON.stringify( initialSnapshot ),
						maintext: initialMainText,
						summary: 'J65b cleanup: restore automated owner state',
						token: csrfToken
					}, true );
				}
			}
		}
	}
} );
