/* eslint-env node */
/**
 * J81 Acceptance: Diff pages and the viewer's restore in Chromium
 * Advances: HIST-2, TYPES-4.
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. A diff between two revisions shows each changed drawing at both revisions and leaves unchanged ones out.
 * 2. The left side reads layersread at revision A and the right at B; centre pixel of left canvas is red and right blue.
 * 3. A text-only edit shows no .layers-drawing-diff section.
 * 4. "Restore this version" on Special:ViewLayersPage makes exactly one new revision D tagged layers-page-drawing
 *    whose summary names the drawing and revision A, main text equals revision C, and snapshot has red fill.
 * 5. Going back to the form and pressing Restore again saves nothing and informs the user.
 * 6. Restore button is not offered for revision D (current version) or for anonymous readers.
 * 7. Exact-base CAS cleanup restores baseline wikitext and initial snapshot.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'diff pages show drawing changes, text-only diffs omit them, and viewer restore creates revision D', async ( { page, context } ) => {
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

	const surfaceId = 'slide_diff_probe';
	const binding = `v1:${ pageId }:${ surfaceId }`;

	try {
		// =========================================================================
		// Step 1: Make three revisions by exact-base publication:
		//   A: recorded snapshot + bound slide "Diff probe" (fill #ff0000) + embed
		//   B: same, with fill #0000ff
		//   C: B's drawings unchanged; main text + one extra sentence
		// =========================================================================
		needsRestore = true;

		// Revision A: red rectangle
		const surfaceA = {
			id: surfaceId,
			kind: 'slide',
			label: 'Diff probe',
			canvas: {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			},
			layers: [
				{
					id: 'rect_diff',
					type: 'rectangle',
					x: 0,
					y: 0,
					width: 800,
					height: 600,
					fill: '#ff0000'
				}
			],
			readingOrder: [ 'rect_diff' ]
		};

		const snapshotA = {
			schemaVersion: 1,
			surfaces: [
				...( initialSnapshot.surfaces || [] ),
				surfaceA
			]
		};

		const mainTextA = `${ initialMainText }\n\n== Diff Probe ==\n{{#Slide:DiffProbe|layersbinding=${ binding }|width=800}}`;

		const pubA = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( snapshotA ),
			maintext: mainTextA,
			summary: 'J81 revision A: add Diff probe slide with red rectangle',
			token: csrfToken
		}, true );
		expect( pubA.layerspublish?.result ).toBe( 'Success' );
		const revA = pubA.layerspublish.revid;
		expect( revA ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = revA;

		// Revision B: blue rectangle
		const surfaceB = {
			...surfaceA,
			layers: [
				{
					...surfaceA.layers[ 0 ],
					fill: '#0000ff'
				}
			]
		};

		const snapshotB = {
			schemaVersion: 1,
			surfaces: [
				...( initialSnapshot.surfaces || [] ),
				surfaceB
			]
		};

		const mainTextB = mainTextA;

		const pubB = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( revA ),
			data: JSON.stringify( snapshotB ),
			maintext: mainTextB,
			summary: 'J81 revision B: update Diff probe fill to blue',
			token: csrfToken
		}, true );
		expect( pubB.layerspublish?.result ).toBe( 'Success' );
		const revB = pubB.layerspublish.revid;
		expect( revB ).toBeGreaterThan( revA );
		lastOwnedRevision = revB;

		// Revision C: B's drawings unchanged; main text plus one extra sentence
		const mainTextC = `${ mainTextB }\n\nThis is an extra sentence for revision C.`;

		const pubC = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( revB ),
			data: JSON.stringify( snapshotB ),
			maintext: mainTextC,
			summary: 'J81 revision C: text-only change with extra sentence',
			token: csrfToken
		}, true );
		expect( pubC.layerspublish?.result ).toBe( 'Success' );
		const revC = pubC.layerspublish.revid;
		expect( revC ).toBeGreaterThan( revB );
		lastOwnedRevision = revC;

		// =========================================================================
		// Step 2: Open diff B against A:
		//   - One "Drawing changes" section (.layers-drawing-diff)
		//   - One pair, for "Diff probe" only (baseline drawing did not change)
		//   - Left reads A, right reads B
		//   - Centre pixel of left canvas is red and right blue
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&diff=${ revB }&oldid=${ revA }` );

		const diffSection = page.locator( '.layers-drawing-diff' );
		await expect( diffSection ).toBeVisible();
		expect( await diffSection.count() ).toBe( 1 );

		const pairs = diffSection.locator( '.layers-drawing-diff__pair' );
		expect( await pairs.count() ).toBe( 1 );

		const leftView = pairs.locator( `.layers-drawing-diff-view[data-layers-revision="${ revA }"]` );
		const rightView = pairs.locator( `.layers-drawing-diff-view[data-layers-revision="${ revB }"]` );
		await expect( leftView ).toBeVisible();
		await expect( rightView ).toBeVisible();
		expect( await leftView.getAttribute( 'data-layers-binding' ) ).toBe( binding );
		expect( await rightView.getAttribute( 'data-layers-binding' ) ).toBe( binding );

		const leftCanvas = leftView.locator( 'canvas' );
		const rightCanvas = rightView.locator( 'canvas' );
		await expect( leftCanvas ).toBeVisible();
		await expect( rightCanvas ).toBeVisible();

		// Sample centre pixel of left (red) and right (blue)
		const leftPixel = await leftCanvas.evaluate( ( c ) => {
			const ctx = c.getContext( '2d' );
			const cx = Math.floor( c.width / 2 );
			const cy = Math.floor( c.height / 2 );
			return Array.from( ctx.getImageData( cx, cy, 1, 1 ).data );
		} );
		expect( leftPixel[ 0 ] ).toBe( 255 );
		expect( leftPixel[ 1 ] ).toBe( 0 );
		expect( leftPixel[ 2 ] ).toBe( 0 );
		expect( leftPixel[ 3 ] ).toBe( 255 );

		const rightPixel = await rightCanvas.evaluate( ( c ) => {
			const ctx = c.getContext( '2d' );
			const cx = Math.floor( c.width / 2 );
			const cy = Math.floor( c.height / 2 );
			return Array.from( ctx.getImageData( cx, cy, 1, 1 ).data );
		} );
		expect( rightPixel[ 0 ] ).toBe( 0 );
		expect( rightPixel[ 1 ] ).toBe( 0 );
		expect( rightPixel[ 2 ] ).toBe( 255 );
		expect( rightPixel[ 3 ] ).toBe( 255 );

		// =========================================================================
		// Step 3: Open diff C against B: no .layers-drawing-diff section
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&diff=${ revC }&oldid=${ revB }` );
		expect( await page.locator( '.layers-drawing-diff' ).count() ).toBe( 0 );

		// =========================================================================
		// Step 4: On page history, follow revision A's "Diff probe" viewer link:
		//   - Intro names "Diff probe"
		//   - "Restore this version" button is shown
		//   - Press it -> exactly one new revision D tagged layers-page-drawing
		//   - Summary names "Diff probe" and revision A
		//   - D's main text equals C's
		//   - D's snapshot: slide fill is #ff0000, baseline equals recorded one
		//   - Record where browser lands
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&action=history` );

		const historyLink = page.locator( `a.layers-history-view-link[href*="revid=${ revA }"][href*="surface=${ surfaceId }"]` );
		await expect( historyLink ).toBeVisible();
		expect( await historyLink.textContent() ).toContain( 'Diff probe' );

		await Promise.all( [
			page.waitForNavigation(),
			historyLink.click()
		] );

		// Verify on Special:ViewLayersPage
		expect( page.url() ).toContain( 'Special:ViewLayersPage' );
		expect( page.url() ).toContain( `revid=${ revA }` );
		expect( page.url() ).toContain( `surface=${ surfaceId }` );

		const introText = await page.locator( '#mw-content-text' ).textContent();
		expect( introText ).toContain( 'Diff probe' );

		const restoreButton = page.getByRole( 'button', { name: /Restore this version/i } );
		await expect( restoreButton ).toBeVisible();

		// Keep a second page on the exact same form to test submitting the stale form
		// after the first page has successfully restored revision A to revision D
		const staleFormPage = await context.newPage();
		await staleFormPage.goto( page.url() );
		const staleRestoreButton = staleFormPage.getByRole( 'button', { name: /Restore this version/i } );
		await expect( staleRestoreButton ).toBeVisible();

		// Press Restore this version on the primary page
		await Promise.all( [
			page.waitForNavigation(),
			restoreButton.click()
		] );

		const landedUrl = page.url();
		// eslint-disable-next-line no-console
		console.log( '[J81] Browser landed on:', landedUrl );
		expect( landedUrl ).toContain( owner );

		// Query owner revisions
		const historyQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags|comment|content',
			rvslots: 'main'
		} );
		const latestRevData = historyQuery.query.pages[ 0 ].revisions[ 0 ];
		const revD = latestRevData.revid;
		expect( revD ).toBeGreaterThan( revC );
		lastOwnedRevision = revD;

		// Revision D assertions
		expect( latestRevData.tags ).toContain( 'layers-page-drawing' );
		expect( latestRevData.comment ).toContain( 'Diff probe' );
		expect( latestRevData.comment.replace( /,/g, '' ) ).toContain( String( revA ) );
		expect( latestRevData.slots.main.content ).toBe( mainTextC );

		// Verify snapshot in revision D
		const dLayers = await api( { action: 'layersread', owner, revid: String( revD ) } );
		const dSnapshot = dLayers.layersread.snapshot;
		const dProbe = dSnapshot.surfaces.find( ( s ) => s.id === surfaceId );
		expect( dProbe ).toBeDefined();
		expect( dProbe.layers[ 0 ].fill ).toBe( '#ff0000' );

		// Every drawing recorded in step 1 is unchanged in D
		for ( const recorded of initialSnapshot.surfaces ) {
			expect( dSnapshot.surfaces.find( ( s ) => s.id === recorded.id ) ).toEqual( recorded );
		}

		// =========================================================================
		// Step 5: Go back to form from step 4 and press button again:
		//   - In browser history (page.goBack()), the re-requested page no longer offers
		//     the button because revision A is now identical to current revision D.
		//   - Submitting the stale form (staleFormPage) with base=revC posts to the server.
		//   - Nothing is saved (latest revision is still D).
		//   - Observe message displayed on the page.
		// =========================================================================
		// Going back re-requests the viewer, which no longer offers revision A: it is now the current version
		await page.goBack();
		await expect( page.locator( '#layers-history-container' ) ).toHaveCount( 1 );
		expect( await page.getByRole( 'button', { name: /Restore this version/i } ).count() ).toBe( 0 );

		// Submit the stale form
		await Promise.all( [
			staleFormPage.waitForNavigation().catch( () => {} ),
			staleRestoreButton.click()
		] );

		// Verify latest revision is still D
		const revCheckAfterRepeat = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids'
		} );
		expect( revCheckAfterRepeat.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( revD );

		// Check the notice displayed on the stale form page
		const stalePageContent = await staleFormPage.locator( '#mw-content-text' ).textContent();
		// eslint-disable-next-line no-console
		console.log( '[J81] Notice on stale form repeat submit:', stalePageContent );

		// Check what error message appears
		const matchesConflict = stalePageContent.includes( 'has changed since this version was opened' );
		const matchesUnavailable = stalePageContent.includes( 'cannot be restored' );
		// eslint-disable-next-line no-console
		console.log( `[J81] matchesConflict: ${ matchesConflict }, matchesUnavailable: ${ matchesUnavailable }` );
		expect( matchesConflict ).toBe( true );
		expect( matchesUnavailable ).toBe( false );

		await staleFormPage.close();

		// =========================================================================
		// Step 6: Check button is not offered:
		//   - for revision D (current version)
		//   - for revision A in a fresh unauthenticated browser context
		// =========================================================================
		await page.goto( `${ base }/index.php?title=Special:ViewLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ revD }&surface=${ surfaceId }` );
		expect( await page.getByRole( 'button', { name: /Restore this version/i } ).count() ).toBe( 0 );

		// Anonymous context check
		const anonContext = await page.context().browser().newContext();
		const anonPage = await anonContext.newPage();
		await anonPage.goto( `${ base }/index.php?title=Special:ViewLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ revA }&surface=${ surfaceId }` );
		expect( await anonPage.getByRole( 'button', { name: /Restore this version/i } ).count() ).toBe( 0 );
		await anonContext.close();

		// =========================================================================
		// Step 7: Restore owner to text and snapshot recorded in step 1 with
		//         exact-base cleanup
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J81 cleanup: restore automated owner state',
			token: csrfToken
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restorePub.layerspublish.revid;
		needsRestore = false;

		// Verify owner wikitext matches baseline content
		const verifyClean = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'content',
			rvslots: 'main'
		} );
		expect( verifyClean.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );

	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J81 cleanup: restore automated owner state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
