/* eslint-env node */
/**
 * J91 Acceptance: Browser acceptance of copying another page's drawing
 * Advances: HIST-5 and TYPES-3.
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. From baseline, publish exact-base revision with baseline drawing renamed to
 *    "Copy probe baseline" and text with {{#Slide:227:Welcome Slide}} appended.
 *    Reads 227's page ID and current revision from API (not hardcoded).
 * 2. On page view, embed shows no drawing, no edit link for "Welcome Slide",
 *    and controls list exactly one "Copy “Welcome Slide” from Layers history test to this page" link.
 * 3. Follow link to Special:CopyLayersDrawing: names source page and current revision,
 *    and writes nothing. Axe-core accessibility check runs with 0 critical/serious violations.
 *    Press Cancel: returns to page and nothing was written.
 * 4. Follow link again, enter note "J91 copy" and confirm: exactly one new revision appears.
 *    Comment is exactly 'Copied the layer set “Welcome Slide” from [[:Layers history test]] (revision <N>): J91 copy'.
 *    Main text rewrites embed to owner's own page ID. layers slot holds baseline drawing unchanged
 *    plus "Welcome Slide" with new ID (not presentation) and same layers as source.
 * 5. Layers_history_test still at same revision.
 * 6. On page view, copy is painted, controls read "Edit layer set: Welcome Slide", no copy link.
 *    Open editor from link, move a layer, save: owner changes, source 227 remains unchanged.
 * 7. Clean baseline restoration via CAS exact-base publication in main flow and finally.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'copy another page’s drawing into a page from its embed (HIST-5, TYPES-3)', async ( { page, context } ) => {
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
	const sourceTitle = 'Layers_history_test';

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

	// Read source page Layers_history_test from API (read-only)
	const sourceQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: sourceTitle,
		rvprop: 'ids'
	} );
	const sourcePageData = sourceQuery.query.pages[ 0 ];
	expect( sourcePageData.missing ).toBeUndefined();
	const sourcePageId = sourcePageData.pageid;
	expect( Number.isInteger( sourcePageId ) ).toBe( true );
	const sourceRevId = sourcePageData.revisions[ 0 ].revid;
	expect( Number.isInteger( sourceRevId ) ).toBe( true );

	// Read source page drawing "Welcome Slide" from API
	const sourceLayers = await api( { action: 'layersread', owner: sourceTitle, revid: String( sourceRevId ) } );
	const sourceSnapshot = sourceLayers.layersread.snapshot;
	const sourceWelcome = sourceSnapshot.surfaces.find( ( s ) => s.label === 'Welcome Slide' );
	expect( sourceWelcome ).toBeDefined();
	expect( sourceWelcome.kind ).toBe( 'slide' );

	let lastOwnedRevision = null;
	let needsRestore = false;

	await page.setViewportSize( { width: 1920, height: 1080 } );

	try {
		needsRestore = true;

		// =========================================================================
		// Step 1: From baseline, publish exact-base revision:
		//         - Baseline drawing renamed to "Copy probe baseline"
		//         - Main text has {{#Slide:<sourcePageId>:Welcome Slide}} appended
		// =========================================================================
		const copyProbeSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					...initialSnapshot.surfaces[ 0 ],
					label: 'Copy probe baseline'
				}
			]
		};

		const step1Text = `${ initialMainText }\n\n== Copy Probe ==\n{{#Slide:${ sourcePageId }:Welcome Slide}}`;

		const pub1 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( copyProbeSnapshot ),
			maintext: step1Text,
			summary: 'J91 step 1: seed foreign slide embed for copy acceptance',
			token: csrfToken
		}, true );
		expect( pub1.layerspublish?.result ).toBe( 'Success' );
		const rev1 = pub1.layerspublish.revid;
		expect( rev1 ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = rev1;

		// =========================================================================
		// Step 2: On page view:
		//         - The embed shows no drawing
		//         - No "Edit layer set: Welcome Slide" link
		//         - Controls list exactly one "Copy “Welcome Slide” from Layers history test to this page" link
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const controls = page.locator( '.layers-page-edit-controls' );
		await expect( controls ).toBeVisible();

		// Embed shows no drawing
		await expect( page.locator( '.layers-bound-slide canvas' ) ).toHaveCount( 0 );

		// No edit link for Welcome Slide
		await expect( controls.locator( '.layers-page-edit-link', { hasText: 'Edit layer set: Welcome Slide' } ) ).toHaveCount( 0 );

		// Exactly one copy link
		const copyLink = controls.locator( '.layers-page-copy-link' );
		await expect( copyLink ).toHaveCount( 1 );
		await expect( copyLink ).toHaveText( 'Copy “Welcome Slide” from Layers history test to this page' );

		// =========================================================================
		// Step 3: Follow copy link to Special:CopyLayersDrawing:
		//         - Names source page and its current revision
		//         - Writes nothing (owner's latest revid unchanged)
		//         - Step 7: Run axe-core on confirmation page (WCAG 2.2 A and AA)
		//         - Press Cancel: returns to page and nothing was written
		// =========================================================================
		await Promise.all( [
			page.waitForNavigation(),
			copyLink.click()
		] );

		// Special:CopyLayersDrawing loaded
		await expect( page.locator( '#firstHeading' ) ).toContainText( 'Copy a layer set from another page' );
		const pageContent = page.locator( '#mw-content-text' );
		await expect( pageContent ).toContainText( 'Layers history test' );
		await expect( pageContent ).toContainText( String( sourceRevId ) );

		// Assert nothing written to owner
		const revCheckAfterNav = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( revCheckAfterNav.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev1 );

		// Step 7: Accessibility audit with axe-core on Special:CopyLayersDrawing (as in Screen 6 of accessibility.spec.js)
		await page.addScriptTag( { path: require.resolve( 'axe-core' ) } );
		const axeResults = await page.evaluate( async () => {
			// eslint-disable-next-line no-undef
			const res = await axe.run( '.mw-htmlform', {
				runOnly: {
					type: 'tag',
					values: [ 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa' ]
				}
			} );
			return res.violations.map( ( v ) => ( {
				id: v.id,
				impact: v.impact,
				description: v.description,
				nodesCount: v.nodes.length
			} ) );
		} );
		const criticalOrSerious = axeResults.filter( ( v ) => v.impact === 'critical' || v.impact === 'serious' );
		expect( criticalOrSerious ).toHaveLength( 0 );

		// Press Cancel: returns to owner page and nothing was written
		const cancelLink = page.locator( '.mw-htmlform-submit-buttons a, a:has-text("Cancel")' );
		await expect( cancelLink.first() ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			cancelLink.first().click()
		] );

		// Back on owner page
		await expect( page.locator( '#firstHeading' ) ).toContainText( 'Layers browser acceptance' );
		const revCheckAfterCancel = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( revCheckAfterCancel.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev1 );

		// =========================================================================
		// Step 4: Follow link again, type note "J91 copy" and confirm:
		//         - Exactly one new revision appears (rev2)
		//         - Comment is exactly:
		//           'Copied the layer set “Welcome Slide” from [[:Layers history test]] (revision <N>): J91 copy'
		//         - Main text names owner's own page ID in embed
		//         - layers slot holds baseline drawing unchanged plus "Welcome Slide"
		//           with new ID (not presentation) and same layers as source
		// =========================================================================
		const copyLink2 = page.locator( '.layers-page-copy-link' );
		await expect( copyLink2 ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			copyLink2.click()
		] );

		// Fill note input
		const noteInput = page.getByLabel( 'Note (optional):' );
		await expect( noteInput ).toBeVisible();
		await noteInput.fill( 'J91 copy' );

		// Submit form
		const submitButton = page.getByRole( 'button', { name: 'Copy to this page' } );
		await expect( submitButton ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			submitButton.click()
		] );

		// Back on owner page after redirect
		const revQuery2 = await api( {
			action: 'query',
			prop: 'info|revisions',
			titles: owner,
			rvprop: 'ids|comment|tags|content',
			rvslots: 'main',
			rvlimit: 1
		} );
		const revData2 = revQuery2.query.pages[ 0 ].revisions[ 0 ];
		const rev2 = revData2.revid;
		lastOwnedRevision = rev2;
		expect( revData2.parentid ).toBe( rev1 );

		// Comment must be exactly:
		expect( revData2.comment ).toBe( `Copied the layer set “Welcome Slide” from [[:Layers history test]] (revision ${ sourceRevId }): J91 copy` );
		expect( revData2.tags ).toContain( 'layers-page-drawing' );

		// Main text must name owner's own page ID in embed
		const newMainText = revData2.slots.main.content;
		expect( newMainText ).toContain( `{{#Slide:${ ownerPageId }:Welcome Slide}}` );
		expect( newMainText ).not.toContain( `{{#Slide:${ sourcePageId }:Welcome Slide}}` );

		// layers slot must hold baseline drawing unchanged plus "Welcome Slide" with new ID
		const read2 = await api( { action: 'layersread', owner, revid: String( rev2 ) } );
		const snapshot2 = read2.layersread.snapshot;
		expect( snapshot2.surfaces.length ).toBe( 2 );

		// Baseline unchanged
		expect( snapshot2.surfaces[ 0 ].id ).toBe( 'presentation' );
		expect( snapshot2.surfaces[ 0 ].label ).toBe( 'Copy probe baseline' );

		// Copied drawing
		const copiedSurface = snapshot2.surfaces.find( ( s ) => s.label === 'Welcome Slide' );
		expect( copiedSurface ).toBeDefined();
		expect( copiedSurface.id ).not.toBe( 'presentation' );
		expect( copiedSurface.kind ).toBe( 'slide' );
		expect( copiedSurface.layers ).toEqual( sourceWelcome.layers );

		// =========================================================================
		// Step 5: Layers_history_test must still be at the same revision
		// =========================================================================
		const sourceCheck = await api( {
			action: 'query',
			prop: 'revisions',
			titles: sourceTitle,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( sourceCheck.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( sourceRevId );

		// =========================================================================
		// Step 6: On page view:
		//         - Copy is painted
		//         - Controls read "Edit layer set: Welcome Slide"
		//         - Offer no copy link
		//         - Open editor from that link, move a layer and save:
		//           owner changes, and 227 is still at same revision with layer where it was
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const controlsAfterCopy = page.locator( '.layers-page-edit-controls' );
		await expect( controlsAfterCopy ).toBeVisible();

		// Copy is painted
		const slideHost = page.locator( '.layers-bound-slide' );
		await expect( slideHost ).toBeVisible();
		const slideCanvas = slideHost.locator( 'canvas' );
		await expect( slideCanvas ).toBeVisible();

		// Controls read "Edit layer set: Welcome Slide"
		const editWelcomeLink = controlsAfterCopy.locator( '.layers-page-edit-link', {
			hasText: 'Edit layer set: Welcome Slide'
		} );
		await expect( editWelcomeLink ).toBeVisible();

		// Offer no copy link
		await expect( controlsAfterCopy.locator( '.layers-page-copy-link' ) ).toHaveCount( 0 );

		// Open editor from that link
		await Promise.all( [
			page.waitForNavigation(),
			editWelcomeLink.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Layer set: Welcome Slide' );

		// Move a layer
		const layerItem = page.locator( '.layer-item:not(.background-layer-item)' ).first();
		await layerItem.locator( '.layer-grab-area' ).click();
		await page.evaluate( () => document.activeElement && document.activeElement.blur() );
		const origY = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ].y );
		await page.keyboard.press( 'ArrowDown' );
		await page.waitForFunction( ( y ) => {
			const l = window.layersEditorInstance.stateManager.get( 'layers' )[ 0 ];
			return l && l.y !== y;
		}, origY );

		// Save
		const savePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveRes = await ( await savePromise ).json();
		expect( saveRes.layerspublish?.result ).toBe( 'Success' );
		const rev3 = saveRes.layerspublish.revid;
		expect( rev3 ).toBeGreaterThan( rev2 );
		lastOwnedRevision = rev3;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Assert owner changed to rev3
		const ownerLatest = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( ownerLatest.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev3 );
		const read3 = await api( { action: 'layersread', owner, revid: String( rev3 ) } );
		const movedCopy = read3.layersread.snapshot.surfaces.find( ( s ) => s.label === 'Welcome Slide' );
		expect( movedCopy.id ).toBe( copiedSurface.id );
		expect( movedCopy.layers ).not.toEqual( sourceWelcome.layers );

		// Source page 227 still at same revision with layer where it was
		const sourceCheckFinal = await api( {
			action: 'query',
			prop: 'revisions',
			titles: sourceTitle,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( sourceCheckFinal.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( sourceRevId );

		const sourceLayersFinal = await api( { action: 'layersread', owner: sourceTitle, revid: String( sourceRevId ) } );
		expect( sourceLayersFinal.layersread.snapshot.surfaces.find( ( s ) => s.label === 'Welcome Slide' ).layers )
			.toEqual( sourceWelcome.layers );

		// =========================================================================
		// Step 8: Restore baseline wikitext and initial snapshot via CAS exact-base publication
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J91 cleanup: restore automated owner baseline state',
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
					summary: 'J91 cleanup: restore automated owner baseline state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
