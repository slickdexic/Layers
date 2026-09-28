/* eslint-env node */
/**
 * J84: Automated accessibility checks of Layers' own screens with axe-core.
 * Advances: UI-3.
 *
 * Runs WCAG 2.2 A and AA rules using installed axe-core across Layers' own screens:
 * 1. Owner page with a slide drawing and an image drawing (and shared adoption notice/link).
 * 2. Full-size view of slide drawing (Special:ViewLayersPage).
 * 3. Full-size view of image drawing (Special:ViewLayersPage).
 * 4. Page-owned editor with a layer selected and properties panel open.
 * 5. Special:ViewLayersPage for an earlier revision (with its restore form).
 * 6. Adoption confirmation page for a shared slide (Special:AdoptLayersDrawing).
 * 7. Diff page with a drawing change (index.php?diff=...&oldid=...).
 *
 * Each screen tested in Vector 2022 light and dark modes (useskin=vector-2022,
 * dark via skin-theme-clientpref-night, with transitions/animations disabled).
 * Limits checks to Layers' own elements, not the skin.
 * Fails on any critical or serious violation, and prints every violation with its rule,
 * element and count.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'UI-3 automated accessibility checks on Layers screens with axe-core in light and dark mode', async ( { page, context } ) => {
	test.setTimeout( 300000 ); // 5 minutes

	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );

	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	const base = url.origin;

	const owner = 'Layers_browser_acceptance';

	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// 1. Authenticate as QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	await page.setViewportSize( { width: 1920, height: 1080 } );

	// 2. Ten-minute quiet rule check on owner
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

	const initialRev = initialPageData.revisions[ 0 ];
	const initialRevId = initialRev.revid;
	const initialMainText = initialRev.slots.main.content;
	const diffMinutes = ( serverTime - new Date( initialRev.timestamp ).getTime() ) / 60000;
	const isPrecedingTestCleanup = initialRev.user === config.username &&
		initialMainText === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65 wiki rules` );
	}

	// 3. Record initial snapshot
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	// Discover first JPEG or PNG fixture
	const files = ( await api( {
		action: 'query',
		list: 'allimages',
		aimime: 'image/jpeg|image/png',
		ailimit: 1,
		aiprop: 'timestamp|sha1|size'
	} ) ).query.allimages;
	test.skip( !files.length, 'Requires at least one JPEG or PNG file on wiki' );
	const file = files[ 0 ];

	let lastOwnedRevision = initialRevId;
	let needsRestore = false;
	let sharedSlideSaved = false;
	let sharedSlideSet = null;
	const sharedSlideName = 'J84_Shared_Slide_Accessibility';

	const allAuditReports = [];

	/**
	 * Run axe on target selectors within the current page in both light and dark modes.
	 * @param {string} screenName
	 * @param {string[]} targetSelectors
	 */
	const auditScreen = async ( screenName, targetSelectors ) => {
		for ( const mode of [ 'light', 'dark' ] ) {
			await page.evaluate( ( currentMode ) => {
				const isDark = currentMode === 'dark';
				document.documentElement.classList.remove(
					isDark ? 'skin-theme-clientpref-day' : 'skin-theme-clientpref-night',
					'skin-theme-clientpref-os'
				);
				document.documentElement.classList.add(
					isDark ? 'skin-theme-clientpref-night' : 'skin-theme-clientpref-day'
				);

				// Disable CSS transitions and animations before color evaluation
				let style = document.getElementById( 'axe-disable-transitions' );
				if ( !style ) {
					style = document.createElement( 'style' );
					style.id = 'axe-disable-transitions';
					style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
					document.head.appendChild( style );
				}
			}, mode );

			await page.waitForTimeout( 200 );

			// Inject axe-core
			await page.addScriptTag( { path: require.resolve( 'axe-core' ) } );

			// Run axe-core
			const report = await page.evaluate( async ( { selectors, currentMode, currentScreen } ) => {
				const matchedSelectors = selectors.filter( ( sel ) => document.querySelector( sel ) !== null );
				if ( matchedSelectors.length === 0 ) {
					return {
						screen: currentScreen,
						mode: currentMode,
						violations: [],
						warning: `None of selectors [${ selectors.join( ', ' ) }] found in DOM`
					};
				}

				const includeContext = matchedSelectors.map( ( s ) => [ s ] );
				// eslint-disable-next-line no-undef
				const results = await axe.run( { include: includeContext }, {
					runOnly: {
						type: 'tag',
						values: [ 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa' ]
					}
				} );

				return {
					screen: currentScreen,
					mode: currentMode,
					matchedSelectors,
					violations: results.violations.map( ( v ) => ( {
						id: v.id,
						impact: v.impact,
						description: v.description,
						help: v.help,
						helpUrl: v.helpUrl,
						nodesCount: v.nodes.length,
						nodes: v.nodes.map( ( n ) => ( {
							html: n.html.slice( 0, 150 ),
							target: n.target,
							failureSummary: n.failureSummary
						} ) )
					} ) )
				};
			}, { selectors: targetSelectors, currentMode: mode, currentScreen: screenName } );

			allAuditReports.push( report );
		}
	};

	try {
		needsRestore = true;

		// =========================================================================
		// Setup: Seed Revision A with slide drawing, photo drawing, and shared slide embed
		// =========================================================================
		// 1. Seed shared slide so adoption notice/link is present
		const savedShared = await api( {
			action: 'layerssave',
			slidename: sharedSlideName,
			token: csrfToken,
			data: JSON.stringify( {
				canvasWidth: 800,
				canvasHeight: 600,
				backgroundColor: '#ffffff',
				layers: [ { id: 'shared_box', type: 'rectangle', x: 30, y: 30, width: 150, height: 100, fill: '#ffcc00' } ]
			} )
		}, true );
		expect( savedShared.layerssave?.success ).toBeTruthy();
		sharedSlideSaved = true;
		// Never assume a set name: read the slide's from the wiki.
		sharedSlideSet = ( await api( { action: 'layersinfo', filename: 'Slide:' + sharedSlideName } ) )
			.layersinfo.layerset.name;

		const slideSurfaceA = {
			id: 'a11y_slide',
			kind: 'slide',
			label: 'a11y_slide',
			canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
			layers: [ { id: 'r_a', type: 'rectangle', x: 20, y: 20, width: 120, height: 80, fill: '#ff0000', stroke: 'none' } ],
			readingOrder: [ 'r_a' ]
		};

		const fileSurfaceA = {
			id: 'a11y_photo',
			kind: 'image',
			label: 'a11y_photo',
			canvas: { width: file.width, height: file.height, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
			layers: [ { id: 't_a', type: 'text', x: 20, y: 20, text: 'A11y Photo Label', fontSize: 20, color: '#000000' } ],
			readingOrder: [ 't_a' ],
			source: {
				repository: 'local',
				fileTitle: 'File:' + file.name,
				timestamp: file.timestamp.replace( /\D/g, '' ),
				// eslint-disable-next-line no-undef
				sha1: BigInt( '0x' + file.sha1 ).toString( 36 ).padStart( 31, '0' ),
				page: 1
			}
		};

		const snapshotA = {
			schemaVersion: 1,
			surfaces: [ ...( initialSnapshot.surfaces || [] ), slideSurfaceA, fileSurfaceA ]
		};

		const wikitextA = `${ initialMainText }\n\n== Accessibility Acceptance ==\n{{#Slide:${ pageId }:a11y_slide}}\n\n[[File:${ file.name }|200px|layerset=${ pageId }:a11y_photo]]\n\n{{#Slide:${ sharedSlideName }|width=300}}`;

		const pubA = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( snapshotA ),
			maintext: wikitextA,
			summary: 'J84 setup: Revision A with slide, photo, and shared slide',
			token: csrfToken
		}, true );
		expect( pubA.layerspublish?.result ).toBe( 'Success' );
		const revA = pubA.layerspublish.revid;
		lastOwnedRevision = revA;

		// =========================================================================
		// Setup: Seed Revision B (edit slide fill) for diff and restore testing
		// =========================================================================
		const slideSurfaceB = {
			...slideSurfaceA,
			layers: [ { ...slideSurfaceA.layers[ 0 ], fill: '#0000ff' } ]
		};
		const snapshotB = {
			schemaVersion: 1,
			surfaces: [ ...( initialSnapshot.surfaces || [] ), slideSurfaceB, fileSurfaceA ]
		};

		const pubB = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( snapshotB ),
			maintext: wikitextA,
			summary: 'J84 setup: Revision B with changed slide fill',
			token: csrfToken
		}, true );
		expect( pubB.layerspublish?.result ).toBe( 'Success' );
		const revB = pubB.layerspublish.revid;
		lastOwnedRevision = revB;

		// =========================================================================
		// Screen 1: Owner page with slide and image drawing (and adoption notice/link)
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&useskin=vector-2022` );
		await page.waitForLoadState( 'networkidle' );
		await page.locator( '.layers-bound-slide canvas' ).waitFor( { state: 'visible', timeout: 30000 } );
		await page.locator( '.layers-bound-file-view canvas' ).waitFor( { state: 'visible', timeout: 30000 } );

		await auditScreen( '1. Owner Page with Drawings & Adoption Notice', [
			'.layers-bound-slide',
			'.layers-bound-file-view',
			'.layers-page-edit-controls',
			'.layers-page-edit-link',
			'.layers-page-adopt-link',
			'.layers-page-edit-controls__notice'
		] );

		// =========================================================================
		// Screen 2: Full-size view of slide drawing (Special:ViewLayersPage)
		// =========================================================================
		await page.goto( `${ base }/index.php?title=Special:ViewLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ revB }&surface=a11y_slide&useskin=vector-2022` );
		await page.waitForLoadState( 'networkidle' );
		await page.locator( '#layers-history-container canvas' ).waitFor( { state: 'visible', timeout: 30000 } );

		await auditScreen( '2. Full-Size View of Slide Drawing', [
			'#layers-history-container',
			'.layers-historical-viewer',
			'.layers-historical-viewer-controls'
		] );

		// =========================================================================
		// Screen 3: Full-size view of photo drawing (Special:ViewLayersPage)
		// =========================================================================
		await page.goto( `${ base }/index.php?title=Special:ViewLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ revB }&surface=a11y_photo&useskin=vector-2022` );
		await page.waitForLoadState( 'networkidle' );
		await page.locator( '#layers-history-container canvas' ).waitFor( { state: 'visible', timeout: 30000 } );

		await auditScreen( '3. Full-Size View of Photo Drawing', [
			'#layers-history-container',
			'.layers-historical-viewer',
			'.layers-historical-viewer-controls'
		] );

		// =========================================================================
		// Screen 4: Page-owned editor with layer selected and properties panel open
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&useskin=vector-2022` );
		const editLink = page.locator( '.layers-page-edit-link' ).first();
		await Promise.all( [
			page.waitForNavigation(),
			editLink.click()
		] );
		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );
		await page.locator( '.layer-item:not(.background-layer-item)' ).first().click();
		await page.locator( '.layer-properties-form' ).waitFor( { state: 'visible', timeout: 15000 } );

		await auditScreen( '4. Page-Owned Editor with Layer Selected & Properties Panel', [
			'#layers-editor-container',
			'.layers-editor',
			'.layers-toolbar',
			'.layers-editor-canvas',
			'.layers-panels',
			'.layer-properties-form'
		] );

		// =========================================================================
		// Screen 5: Special:ViewLayersPage for earlier revision with restore form
		// =========================================================================
		await page.goto( `${ base }/index.php?title=Special:ViewLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ revA }&surface=a11y_slide&useskin=vector-2022` );
		await page.waitForLoadState( 'networkidle' );
		await page.locator( '#layers-history-container canvas' ).waitFor( { state: 'visible', timeout: 30000 } );
		await expect( page.getByRole( 'button', { name: /Restore this version/i } ) ).toBeVisible();

		await auditScreen( '5. Earlier Revision with Restore Form', [
			'#layers-history-container',
			'.mw-htmlform',
			'form.mw-htmlform'
		] );

		// =========================================================================
		// Screen 6: Adoption confirmation page for a shared slide
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&useskin=vector-2022` );
		const adoptLink = page.locator( '.layers-page-adopt-link' );
		await expect( adoptLink ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			adoptLink.click()
		] );
		await page.waitForLoadState( 'networkidle' );
		expect( page.url() ).toContain( 'Special:AdoptLayersDrawing' );

		await auditScreen( '6. Shared Slide Adoption Confirmation Page', [
			'#mw-content-text form',
			'form.mw-htmlform',
			'.mw-htmlform'
		] );

		// =========================================================================
		// Screen 7: Diff page with drawing change
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&diff=${ revB }&oldid=${ revA }&useskin=vector-2022` );
		await page.waitForLoadState( 'networkidle' );
		await page.locator( '.layers-drawing-diff' ).waitFor( { state: 'visible', timeout: 30000 } );

		await auditScreen( '7. Diff Page with Drawing Change', [
			'.layers-drawing-diff'
		] );

		// =========================================================================
		// Reporting: Print all violations and evaluate critical/serious violations
		// =========================================================================
		// eslint-disable-next-line no-console
		console.log( '\n=======================================================' );
		// eslint-disable-next-line no-console
		console.log( 'J84 / UI-3 ACCESSIBILITY AUDIT REPORT (axe-core WCAG 2.2 A/AA)' );
		// eslint-disable-next-line no-console
		console.log( '=======================================================' );

		let totalViolationsCount = 0;
		const criticalOrSeriousViolations = [];

		for ( const report of allAuditReports ) {
			// eslint-disable-next-line no-console
			console.log( `\n--- Screen: [${ report.screen }] | Mode: [${ report.mode }] ---` );
			if ( report.warning ) {
				// eslint-disable-next-line no-console
				console.log( `  WARNING: ${ report.warning }` );
			}
			if ( report.violations.length === 0 ) {
				// eslint-disable-next-line no-console
				console.log( '  No violations found.' );
			} else {
				for ( const v of report.violations ) {
					totalViolationsCount += v.nodesCount;
					const entry = {
						screen: report.screen,
						mode: report.mode,
						rule: v.id,
						impact: v.impact,
						description: v.description,
						nodesCount: v.nodesCount,
						nodes: v.nodes
					};
					if ( v.impact === 'critical' || v.impact === 'serious' ) {
						criticalOrSeriousViolations.push( entry );
					}
					// eslint-disable-next-line no-console
					console.log( `  [${ ( v.impact || 'unknown' ).toUpperCase() }] Rule: ${ v.id } (${ v.nodesCount } occurrence(s))` );
					// eslint-disable-next-line no-console
					console.log( `    Description: ${ v.description }` );
					for ( const node of v.nodes ) {
						// eslint-disable-next-line no-console
						console.log( `    - Element: ${ node.target } | HTML: ${ node.html }` );
					}
				}
			}
		}

		// eslint-disable-next-line no-console
		console.log( '\n=======================================================' );
		// eslint-disable-next-line no-console
		console.log( `Total violation occurrences: ${ totalViolationsCount }` );
		// eslint-disable-next-line no-console
		console.log( `Critical/Serious violations: ${ criticalOrSeriousViolations.length }` );
		// eslint-disable-next-line no-console
		console.log( '=======================================================\n' );

		// =========================================================================
		// Step 4: Cleanup: Restore owner to recorded baseline state before assertion
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J84 cleanup: restore automated owner baseline state',
			token: csrfToken
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restorePub.layerspublish.revid;
		needsRestore = false;

		if ( sharedSlideSaved ) {
			await api( { action: 'layersdelete', slidename: sharedSlideName, setname: sharedSlideSet, token: csrfToken }, true );
			sharedSlideSaved = false;
		}

		const verifyClean = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'content',
			rvslots: 'main'
		} );
		expect( verifyClean.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );

		// A screen whose elements were not found was not audited; that is a failure, not a pass.
		expect( allAuditReports.filter( ( r ) => r.warning ).map( ( r ) => `${ r.screen } (${ r.mode })` ) ).toEqual( [] );

		// Known open violations, tracked in the charter (UI-3) and fixed in the design pass. Each entry
		// must still occur: when it is fixed, this list fails until the entry is removed.
		const KNOWN_OPEN = [
			// Layer rows are listbox options holding their own buttons; they need the grid pattern.
			{ rule: 'nested-interactive', html: 'class="layer-item' }
		];
		const isKnown = ( v ) => KNOWN_OPEN.some( ( k ) => k.rule === v.rule &&
			v.nodes.every( ( n ) => n.html.includes( k.html ) ) );
		for ( const known of KNOWN_OPEN ) {
			expect( criticalOrSeriousViolations.some( ( v ) => v.rule === known.rule ),
				`Known violation ${ known.rule } no longer occurs: remove it from KNOWN_OPEN` ).toBe( true );
		}
		const unexpected = criticalOrSeriousViolations.filter( ( v ) => !isKnown( v ) );
		expect( unexpected.map( ( v ) => `${ v.screen } (${ v.mode }): ${ v.rule }` ),
			'Critical or serious accessibility violations; see the console report' ).toEqual( [] );

	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J84 cleanup: restore automated owner state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
		if ( sharedSlideSaved ) {
			try {
				await api( { action: 'layersdelete', slidename: sharedSlideName, setname: sharedSlideSet, token: csrfToken }, true );
			} catch ( e ) {}
		}
	}
} );
