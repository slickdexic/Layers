/* eslint-env node */
/**
 * J79 Acceptance: A refused page-owned save names the layer
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. When page history refuses a drawing because of an unpublishable value (strokeWidth: 150),
 *    the editor's error notification names the layer ("Warning box") and the property ("strokeWidth").
 * 2. The page's latest revision is unchanged in history.
 * 3. The editor retains unsaved changes and the value 150.
 * 4. Fixing the stroke width to 5 via the properties panel saves successfully as exactly one new tagged revision.
 * 5. Repeating the refusal with an unnamed layer (no name) names the layer's ID ("layer_rect") instead.
 * 6. Exact-base CAS cleanup restores baseline wikitext and initial snapshot.
 *
 * The editor leaves page-owned drawings to the server's validation, so the first Save
 * reaches api.php. (J79 found the editor's own checks refusing it first, with a
 * notification that named neither the layer nor the property; fixed by the lead.)
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'a refused page-owned save names the layer and property, retains unsaved work, and saves once fixed', async ( { page, context } ) => {
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
	expect( typeof pageId ).toBe( 'number' );
	expect( pageId ).toBe( 228 );

	const initialRev = initialPageData.revisions[ 0 ];
	const initialRevId = initialRev.revid;
	const initialMainText = initialRev.slots.main.content;
	const diffMinutes = ( serverTime - new Date( initialRev.timestamp ).getTime() ) / 60000;
	const isPrecedingTestCleanup = initialRev.user === config.username &&
		initialMainText === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65 wiki rules` );
	}

	// Record initial snapshot (must be restored in cleanup, never an empty one)
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	let lastOwnedRevision = null;
	let needsRestore = false;

	// Ensure desktop viewport so toolbar buttons remain visible and unclipped
	await page.setViewportSize( { width: 1920, height: 1080 } );

	// UI interaction helpers for the properties panel
	const selectLayerItem = async ( layerId ) => {
		const item = page.locator( `.layer-item[data-layer-id="${ layerId }"]` );
		await expect( item ).toBeVisible();
		await item.click();
		await page.waitForTimeout( 100 );
	};

	const getField = ( labelPattern, sectionName = null ) => {
		const root = sectionName ?
			page.locator( '.property-section' ).filter( {
				has: page.locator( '.property-section-header', { hasText: sectionName } )
			} ) :
			page.locator( '.layer-properties-form' );
		return root.locator( '.property-field' ).filter( {
			has: page.locator( 'label', { hasText: labelPattern } )
		} ).first();
	};

	const setInput = async ( labelPattern, value, sectionName = null ) => {
		const field = getField( labelPattern, sectionName );
		await expect( field ).toBeVisible();
		const input = field.locator( 'input, textarea' ).first();
		await expect( input ).toBeVisible();
		await input.fill( String( value ) );
		await input.dispatchEvent( 'change' );
		await page.waitForTimeout( 150 );
	};

	try {
		// =========================================================================
		// Step 1: Record owner revision & snapshot; seed one bound slide with one
		//         rectangle named "Warning box"; open edit link & wait for drafts ready
		// =========================================================================
		needsRestore = true;
		const surfaceId = 'slide_refusal_message';
		const binding = `v1:${ pageId }:${ surfaceId }`;

		const seedLayers = [
			{
				id: 'layer_rect',
				type: 'rectangle',
				name: 'Warning box',
				x: 50,
				y: 50,
				width: 120,
				height: 80,
				stroke: '#000000',
				strokeWidth: 2,
				fill: '#ffffff'
			}
		];

		const seededSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Refusal Message Probe',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: seedLayers,
					readingOrder: seedLayers.map( ( l ) => l.id )
				}
			]
		};

		const seedMainText = `${ initialMainText }\n\n== Refusal Message ==\n{{#Slide:RefusalPresentation|layersbinding=${ binding }|width=800}}`;

		const pubSeed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( seededSnapshot ),
			maintext: seedMainText,
			summary: 'J79: seed bound slide with Warning box rectangle',
			token: csrfToken
		}, true );

		expect( pubSeed.layerspublish?.result ).toBe( 'Success' );
		const seedRevId = pubSeed.layerspublish.revid;
		expect( seedRevId ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = seedRevId;

		// Open edit link through the page
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		const editLink = page.locator( '.layers-page-edit-link' );
		await expect( editLink ).toBeVisible();

		const [ editorResponse ] = await Promise.all( [
			page.waitForNavigation(),
			editLink.click()
		] );
		expect( editorResponse.status() ).toBe( 200 );
		expect( ( editorResponse.headers()[ 'cache-control' ] || '' ).toLowerCase() ).toContain( 'no-store' );

		await expect( page.locator( '.layers-canvas' ) ).toBeVisible();
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length === 1 );

		// Wait until apiManager.pageOwnedDrafts.ready is true and verify no recovery dialog
		await page.waitForFunction( () => window.layersEditorInstance.apiManager.pageOwnedDrafts?.ready === true,
			null, { timeout: 30000 } );
		await expect( page.locator( 'dialog.layers-page-recovery' ) ).toHaveCount( 0 );

		// =========================================================================
		// Step 2: Inject unpublishable strokeWidth: 150 on the rectangle's layer
		//         object, mark dirty, then press Save. (The only allowed state write)
		// =========================================================================
		await page.evaluate( () => {
			const editor = window.layersEditorInstance;
			const layers = editor.stateManager.get( 'layers' );
			const rect = layers.find( ( l ) => l.type === 'rectangle' );
			rect.strokeWidth = 150;
			editor.markDirty();
		} );

		// The first Save reaches the server, which refuses it
		const saveFailurePromise1 = page.waitForResponse( ( resp ) =>
			resp.url().includes( 'api.php' ) && ( resp.request().postData() || '' ).includes( 'action=layerspublish' ),
			{ timeout: 30000 }
		);
		await page.locator( '.save-button' ).click();
		const failureResponse1 = await saveFailurePromise1;
		const failureData1 = await failureResponse1.json();
		expect( failureData1.error?.code ).toBe( 'layers-invalid-snapshot' );
		await expect( page.locator( '.mw-notification', { hasText: 'Layer validation failed' } ) ).toHaveCount( 0 );

		// =========================================================================
		// Step 3: Check error notification contains "Warning box" and "strokeWidth",
		//         page's latest revision is unchanged, and editor shows unsaved changes and 150
		// =========================================================================
		const serverErrorNotification1 = page.locator( '.mw-notification' ).filter( {
			hasText: 'Warning box'
		} );
		await expect( serverErrorNotification1 ).toBeVisible();
		await expect( serverErrorNotification1 ).toContainText( 'Warning box' );
		await expect( serverErrorNotification1 ).toContainText( 'strokeWidth' );

		// Check page history: latest revision remains unchanged at seedRevId
		const historyAfterRefusal1 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		const latestRevAfterRefusal1 = historyAfterRefusal1.query.pages[ 0 ].revisions[ 0 ].revid;
		expect( latestRevAfterRefusal1 ).toBe( seedRevId );

		// Check editor still shows unsaved changes
		await expect( page.locator( '.save-button' ) ).toHaveClass( /has-changes/ );
		const isDirty1 = await page.evaluate( () => window.layersEditorInstance.hasUnsavedChanges() );
		expect( isDirty1 ).toBe( true );

		// Check editor still holds the value 150 in state
		const strokeValueInState1 = await page.evaluate( () => {
			const layers = window.layersEditorInstance.stateManager.get( 'layers' );
			const rect = layers.find( ( l ) => l.type === 'rectangle' );
			return rect ? rect.strokeWidth : null;
		} );
		expect( strokeValueInState1 ).toBe( 150 );

		// Check properties panel displays the value 150
		await selectLayerItem( 'layer_rect' );
		const strokeInput1 = getField( 'Stroke Width', 'Appearance' ).locator( 'input' ).first();
		await expect( strokeInput1 ).toHaveValue( '150' );

		// =========================================================================
		// Step 4: Set stroke width to 5 via properties panel and save:
		//         exactly one new tagged revision, whose snapshot has strokeWidth 5
		// =========================================================================
		await setInput( 'Stroke Width', 5, 'Appearance' );

		const saveSuccessPromise = page.waitForResponse( ( resp ) =>
			resp.url().includes( 'api.php' ) && ( resp.request().postData() || '' ).includes( 'action=layerspublish' ),
			{ timeout: 30000 }
		);
		await page.locator( '.save-button' ).click();
		const successResponse = await saveSuccessPromise;
		const successData = await successResponse.json();
		expect( successData.layerspublish?.result ).toBe( 'Success' );

		const rev1 = successData.layerspublish.revid;
		expect( Number.isInteger( rev1 ) ).toBe( true );
		expect( rev1 ).toBeGreaterThan( seedRevId );
		lastOwnedRevision = rev1;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges(), null, { timeout: 30000 } );

		// Verify exactly one new tagged revision in history
		const historyAfterSave = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags',
			rvlimit: 2
		} );
		const revisionsList = historyAfterSave.query.pages[ 0 ].revisions;
		expect( revisionsList.length ).toBe( 2 );
		expect( revisionsList[ 0 ].revid ).toBe( rev1 );
		expect( revisionsList[ 0 ].tags ).toContain( 'layers-page-drawing' );
		expect( revisionsList[ 1 ].revid ).toBe( seedRevId );

		// Verify that the snapshot of rev1 stored strokeWidth 5
		const publishedRev1 = await api( { action: 'layersread', owner, revid: String( rev1 ) } );
		const publishedLayers1 = publishedRev1.layersread.snapshot.surfaces[ 0 ].layers;
		expect( publishedLayers1.length ).toBe( 1 );
		const publishedRect1 = publishedLayers1[ 0 ];
		expect( publishedRect1.id ).toBe( 'layer_rect' );
		expect( publishedRect1.strokeWidth ).toBe( 5 );

		// =========================================================================
		// Step 5: Repeat step 2 with an unnamed layer (remove the name) and check
		//         the notification names the layer's ID instead
		// =========================================================================
		await page.evaluate( () => {
			const editor = window.layersEditorInstance;
			const layers = editor.stateManager.get( 'layers' );
			const rect = layers.find( ( l ) => l.type === 'rectangle' );
			delete rect.name;
			rect.strokeWidth = 150;
			editor.markDirty();
		} );

		const saveFailurePromise2 = page.waitForResponse( ( resp ) =>
			resp.url().includes( 'api.php' ) && ( resp.request().postData() || '' ).includes( 'action=layerspublish' ),
			{ timeout: 30000 }
		);
		await page.locator( '.save-button' ).click();
		const failureResponse2 = await saveFailurePromise2;
		const failureData2 = await failureResponse2.json();
		expect( failureData2.error?.code ).toBe( 'layers-invalid-snapshot' );

		// Check the notification names the layer ID ("layer_rect") and property ("strokeWidth"),
		// and does not use the old name ("Warning box")
		const serverErrorNotification2 = page.locator( '.mw-notification' ).filter( {
			hasText: 'layer_rect'
		} );
		await expect( serverErrorNotification2 ).toBeVisible();
		await expect( serverErrorNotification2 ).toContainText( 'layer_rect' );
		await expect( serverErrorNotification2 ).toContainText( 'strokeWidth' );
		await expect( serverErrorNotification2 ).not.toContainText( 'Warning box' );

		// Check page history is unchanged (still rev1)
		const historyAfterRefusal2 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		const latestRevAfterRefusal2 = historyAfterRefusal2.query.pages[ 0 ].revisions[ 0 ].revid;
		expect( latestRevAfterRefusal2 ).toBe( rev1 );

		// Check editor still shows unsaved changes and holds 150
		await expect( page.locator( '.save-button' ) ).toHaveClass( /has-changes/ );
		const isDirty2 = await page.evaluate( () => window.layersEditorInstance.hasUnsavedChanges() );
		expect( isDirty2 ).toBe( true );
		const strokeValueInState2 = await page.evaluate( () => {
			const layers = window.layersEditorInstance.stateManager.get( 'layers' );
			const rect = layers.find( ( l ) => l.type === 'rectangle' );
			return rect ? rect.strokeWidth : null;
		} );
		expect( strokeValueInState2 ).toBe( 150 );
	} finally {
		// =========================================================================
		// Step 6: Restore owner to recorded baseline text and snapshot
		// =========================================================================
		if ( needsRestore && lastOwnedRevision ) {
			const cleanupRes = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( initialSnapshot ),
				maintext: initialMainText,
				summary: 'J79: restore baseline after acceptance run',
				token: csrfToken
			}, true );
			expect( cleanupRes.layerspublish?.result ).toBe( 'Success' );

			const verifyClean = await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'content',
				rvslots: 'main'
			} );
			expect( verifyClean.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );
		}
	}
} );
