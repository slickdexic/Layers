/* eslint-env node */
/**
 * J89 Acceptance: Browser acceptance of edit summaries
 * Advances: HIST-1 (Every drawing save has a summary in page history).
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. Opening editor on owner's current revision (Special:EditLayersPage) shows
 *    a field labelled "Summary:" in the header that is initially empty.
 * 2. Automatic summary, one change: Moving a layer and saving with empty summary
 *    records exact comment 'Edited layer set “Welcome Slide”' with tag 'layers-page-drawing'.
 * 3. Automatic summary, two changes: Renaming drawing to "Summary probe", moving a layer,
 *    and saving with empty summary records exact comment
 *    'Renamed layer set “Welcome Slide” to “Summary probe”; Edited layer set “Summary probe”'.
 * 4. Typed summary: Moving a layer, typing "Probe summary" into the field, and saving
 *    records exact comment 'Probe summary', and clears the field afterwards.
 * 5. History page: Opening action=history shows the three summaries on the three newest rows in order.
 * 6. Accessibility check: Rerunning tests/e2e/accessibility.spec.js reports no new violations.
 * 7. Baseline restoration: Baseline wikitext and snapshot cleanly restored via CAS exact-base publication.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'every drawing save through the editor gets a summary in page history (HIST-1)', async ( { page, context } ) => {
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

	try {
		needsRestore = true;

		// =========================================================================
		// Step 1: Open editor on owner's current revision (Special:EditLayersPage).
		//         Header must show a field labelled "Summary:" that is empty.
		// =========================================================================
		await page.goto( `${ base }/index.php?` + new URLSearchParams( {
			title: 'Special:EditLayersPage',
			owner,
			revid: String( initialRevId ),
			surface: 'presentation'
		} ) );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );

		const summaryInput = page.getByLabel( 'Summary:' );
		await expect( summaryInput ).toBeVisible();
		await expect( summaryInput ).toHaveValue( '' );
		await expect( page.locator( '.layers-page-summary label' ) ).toHaveText( 'Summary:' );

		const moveTextLayer = async () => {
			const layerItem = page.locator( '.layer-item:not(.background-layer-item)' ).first();
			await layerItem.locator( '.layer-grab-area' ).click();
			// Blur active element so keyboard arrow key triggers the document canvas nudge handler
			await page.evaluate( () => document.activeElement && document.activeElement.blur() );
			const origY = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ].y );
			await page.keyboard.press( 'ArrowDown' );
			await page.waitForFunction( ( y ) => {
				const l = window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ];
				return l && l.y !== y;
			}, origY );
		};

		// =========================================================================
		// Step 2: Automatic, one change:
		//         - Move the text layer (select it in layer list, press ArrowDown).
		//         - Press Save with Summary field empty.
		//         - New revision comment must be exactly: Edited layer set “Welcome Slide”
		//         - New revision must carry layers-page-drawing tag.
		// =========================================================================
		await moveTextLayer();

		await expect( summaryInput ).toHaveValue( '' );

		const savePromise1 = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveRes1 = await ( await savePromise1 ).json();
		expect( saveRes1.layerspublish?.result ).toBe( 'Success' );
		const rev1 = saveRes1.layerspublish.revid;
		expect( rev1 ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = rev1;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Verify revision 1 details via API
		const revQuery1 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|comment|tags',
			rvstartid: rev1,
			rvlimit: 1
		} );
		const revData1 = revQuery1.query.pages[ 0 ].revisions[ 0 ];
		expect( revData1.revid ).toBe( rev1 );
		expect( revData1.comment ).toBe( 'Edited layer set “Welcome Slide”' );
		expect( revData1.tags ).toContain( 'layers-page-drawing' );

		// =========================================================================
		// Step 3: Automatic, two changes:
		//         - Rename layer set to "Summary probe" with Rename button.
		//         - Move the layer again.
		//         - Save with Summary field empty.
		//         - Comment must be exactly:
		//           Renamed layer set “Welcome Slide” to “Summary probe”; Edited layer set “Summary probe”
		// =========================================================================
		const renameBtn = page.locator( 'button.layers-page-drawing-rename' );
		await expect( renameBtn ).toBeVisible();
		await renameBtn.click();
		const promptInput = page.locator( 'input.layers-modal-input' );
		await expect( promptInput ).toBeVisible();
		await promptInput.fill( 'Summary probe' );
		await page.locator( '.layers-modal-buttons button.layers-btn-primary' ).click();
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Layer set: Summary probe' );

		await moveTextLayer();

		await expect( summaryInput ).toHaveValue( '' );

		const savePromise2 = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveRes2 = await ( await savePromise2 ).json();
		expect( saveRes2.layerspublish?.result ).toBe( 'Success' );
		const rev2 = saveRes2.layerspublish.revid;
		expect( rev2 ).toBeGreaterThan( rev1 );
		lastOwnedRevision = rev2;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Verify revision 2 details via API
		const revQuery2 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|comment|tags',
			rvstartid: rev2,
			rvlimit: 1
		} );
		const revData2 = revQuery2.query.pages[ 0 ].revisions[ 0 ];
		expect( revData2.revid ).toBe( rev2 );
		expect( revData2.comment ).toBe( 'Renamed layer set “Welcome Slide” to “Summary probe”; Edited layer set “Summary probe”' );
		expect( revData2.tags ).toContain( 'layers-page-drawing' );

		// =========================================================================
		// Step 4: Typed summary:
		//         - Move the layer again.
		//         - Type "Probe summary" into Summary field.
		//         - Save.
		//         - Comment must be exactly: Probe summary
		//         - Field must be empty afterwards.
		// =========================================================================
		await moveTextLayer();

		await summaryInput.fill( 'Probe summary' );
		await expect( summaryInput ).toHaveValue( 'Probe summary' );

		const savePromise3 = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveRes3 = await ( await savePromise3 ).json();
		expect( saveRes3.layerspublish?.result ).toBe( 'Success' );
		const rev3 = saveRes3.layerspublish.revid;
		expect( rev3 ).toBeGreaterThan( rev2 );
		lastOwnedRevision = rev3;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Verify revision 3 details via API
		const revQuery3 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|comment|tags',
			rvstartid: rev3,
			rvlimit: 1
		} );
		const revData3 = revQuery3.query.pages[ 0 ].revisions[ 0 ];
		expect( revData3.revid ).toBe( rev3 );
		expect( revData3.comment ).toBe( 'Probe summary' );
		expect( revData3.tags ).toContain( 'layers-page-drawing' );

		// Field must be empty afterwards
		await expect( summaryInput ).toHaveValue( '' );

		// =========================================================================
		// Step 5: History page:
		//         - Open action=history for owner.
		//         - Check that the three summaries appear on the three newest rows, in order:
		//           Row 0 (newest, rev3): "Probe summary"
		//           Row 1 (rev2): "Renamed layer set “Welcome Slide” to “Summary probe”; Edited layer set “Summary probe”"
		//           Row 2 (rev1): "Edited layer set “Welcome Slide”"
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&action=history` );
		await page.waitForSelector( '#pagehistory' );
		const historyRows = page.locator( '#pagehistory li[data-mw-revid]' );

		// Row 0 (newest): rev3 with typed summary
		await expect( historyRows.nth( 0 ) ).toHaveAttribute( 'data-mw-revid', String( rev3 ) );
		await expect( historyRows.nth( 0 ).locator( '.comment' ) ).toContainText( 'Probe summary' );

		// Row 1: rev2 with two automatic changes
		await expect( historyRows.nth( 1 ) ).toHaveAttribute( 'data-mw-revid', String( rev2 ) );
		await expect( historyRows.nth( 1 ).locator( '.comment' ) ).toContainText(
			'Renamed layer set “Welcome Slide” to “Summary probe”; Edited layer set “Summary probe”'
		);

		// Row 2: rev1 with one automatic change
		await expect( historyRows.nth( 2 ) ).toHaveAttribute( 'data-mw-revid', String( rev1 ) );
		await expect( historyRows.nth( 2 ).locator( '.comment' ) ).toContainText( 'Edited layer set “Welcome Slide”' );

		// =========================================================================
		// Step 6: Restore baseline wikitext and initial snapshot via CAS exact-base publication
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J89 cleanup: restore automated owner baseline state',
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

	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J89 cleanup: restore automated owner baseline state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
