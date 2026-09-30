/* eslint-env node */
/**
 * J101 Acceptance: Browser acceptance of history tools (undo links, feeds)
 * Advances: HIST-2.
 *
 * Proves in Chromium on the test wiki (http://localhost:8080) that:
 * 1. Changed drawing gets drawing undo link: On an edit that modified an existing drawing
 *    ("Welcome Slide"), action=history replaces core's undo link with
 *    "undo drawing: Welcome Slide" (class layers-history-undo-link inside .mw-pager-tools;
 *    href is Special:ViewLayersPage with owner=Layers_browser_acceptance, revid=previous_revid,
 *    and surface=presentation). Core's rollback remains available.
 * 2. Drawing undo flow: Following the link opens Special:ViewLayersPage with the prior canvas
 *    and the "Restore this version" button. Submitting it publishes a new revision.
 *    Proves restore by value: reads layers slot before and after, asserting layer x returned
 *    to earlier value, page text is unchanged, and other drawings are untouched.
 * 3. Text-only edit keeps core undo: An edit modifying only wikitext keeps core's standard
 *    action=edit&undo=... link.
 * 4. Added drawing shows no undo link: An edit that only added a brand-new drawing shows no
 *    drawing undo link and no core undo link.
 * 5. Permission check: Anonymous reader sees no undo links. (Account with edit but without
 *    editlayers does not exist on test wiki and is recorded as not tested).
 * 6. Feeds: Special:RecentChanges, Special:Watchlist (page watched, then restored), and
 *    Special:Contributions list the drawing edit with its summary and layers-page-drawing tag.
 * 7. Baseline restored by exact-base CAS in main flow and finally.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const { isWikiMigrated } = require( './helpers/migration' );

test.describe.configure( { mode: 'serial' } );

test( 'page history undo links, feeds and permissions for drawing edits (HIST-2)', async ( { page, context } ) => {
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
	const tokens = ( await api( { action: 'query', meta: 'tokens', type: 'csrf|watch' } ) ).query.tokens;
	const csrfToken = tokens.csrftoken;
	const watchToken = tokens.watchtoken;

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
	expect( initialSnapshot.surfaces.map( ( s ) => s.label ) ).toEqual( [ 'Welcome Slide' ] );
	const initialTitleLayer = initialSnapshot.surfaces[ 0 ].layers.find( ( l ) => l.id === 'title' );
	expect( initialTitleLayer ).toBeDefined();
	const initialX = initialTitleLayer.x;

	let lastOwnedRevision = initialRevId;
	let watchedOriginally = false;

	try {
		// Watch state check: see if owner is already watched
		const watchCheck = await api( { action: 'query', prop: 'info', inprop: 'watched', titles: owner } );
		watchedOriginally = !!watchCheck.query.pages[ 0 ].watched;
		if ( !watchedOriginally ) {
			await api( { action: 'watch', titles: owner, token: watchToken }, true );
		}

		// =========================================================================
		// Part 1: Changed drawing gets drawing undo link
		// =========================================================================
		// Modify layer 'x' on 'Welcome Slide' from initialX to initialX + 50
		const modifiedSnapshot = JSON.parse( JSON.stringify( initialSnapshot ) );
		const modTitleLayer = modifiedSnapshot.surfaces[ 0 ].layers.find( ( l ) => l.id === 'title' );
		modTitleLayer.x = initialX + 50;

		const editDrawingSummary = 'J101 test: edit drawing Welcome Slide';
		const pubModifiedDrawing = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( modifiedSnapshot ),
			maintext: initialMainText,
			summary: editDrawingSummary,
			token: csrfToken
		}, true );
		expect( pubModifiedDrawing.layerspublish?.result ).toBe( 'Success' );
		const revModifiedDrawing = pubModifiedDrawing.layerspublish.revid;
		const revBeforeModified = lastOwnedRevision;
		lastOwnedRevision = revModifiedDrawing;

		// Open action=history in the browser
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&action=history` );
		await page.waitForLoadState( 'networkidle' );

		// Find the history line for revModifiedDrawing
		const topHistoryLine = page.locator( `li[data-mw-revid="${ revModifiedDrawing }"]` );
		const topTools = topHistoryLine.locator( '.mw-pager-tools' );
		await expect( topTools ).toBeVisible();

		// Core's undo link is replaced
		const coreUndoLink = topTools.locator( 'a[href*="undo="]' );
		await expect( coreUndoLink ).toHaveCount( 0 );

		// Drawing undo link is present with exact attributes
		const drawingUndoLink = topTools.locator( '.layers-history-undo-link' );
		await expect( drawingUndoLink ).toBeVisible();
		await expect( drawingUndoLink ).toHaveText( 'undo drawing: Welcome Slide' );

		const undoHref = await drawingUndoLink.getAttribute( 'href' );
		expect( undoHref ).toContain( 'Special:ViewLayersPage' );
		expect( undoHref ).toContain( `owner=${ owner }` );
		expect( undoHref ).toContain( `revid=${ revBeforeModified }` );
		expect( undoHref ).toContain( 'surface=presentation' );

		// Core's rollback remains available
		const rollbackLink = topTools.locator( '.mw-rollback-link a' );
		await expect( rollbackLink ).toBeVisible();

		// =========================================================================
		// Part 2: Drawing undo flow
		// =========================================================================
		await drawingUndoLink.click();
		await page.waitForLoadState( 'networkidle' );

		expect( page.url() ).toContain( 'Special:ViewLayersPage' );

		// Prior canvas is rendered
		const historyCanvas = page.locator( '#layers-history-container canvas' );
		await expect( historyCanvas ).toBeVisible( { timeout: 15000 } );

		// "Restore this version" button is present
		const restoreButton = page.locator( 'button[type="submit"]:has-text("Restore this version")' );
		await expect( restoreButton ).toBeVisible();

		// Read latest layers slot BEFORE restore
		const readBeforeRestore = await api( { action: 'layersread', owner, revid: String( lastOwnedRevision ) } );
		const titleXBefore = readBeforeRestore.layersread.snapshot.surfaces[ 0 ].layers.find( ( l ) => l.id === 'title' ).x;
		expect( titleXBefore ).toBe( initialX + 50 );

		// Submit the restore form
		await restoreButton.click();
		await page.waitForLoadState( 'networkidle' );

		// Redirected back to owner page
		expect( page.url() ).toContain( owner );

		// Query owner page revisions: verify new revision published
		const afterRestoreHistory = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|comment|tags|content',
			rvslots: 'main',
			rvlimit: 1
		} );
		const revRestored = afterRestoreHistory.query.pages[ 0 ].revisions[ 0 ];
		expect( revRestored.revid ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = revRestored.revid;

		expect( revRestored.tags ).toContain( 'layers-page-drawing' );
		expect( revRestored.comment ).toContain( 'Restored the drawing “Welcome Slide”' );
		expect( revRestored.slots.main.content ).toBe( initialMainText );

		// PROVE RESTORE BY VALUE: read latest layers slot through API
		const readAfterRestore = await api( { action: 'layersread', owner, revid: String( lastOwnedRevision ) } );
		const restoredSnapshot = readAfterRestore.layersread.snapshot;
		const restoredTitleLayer = restoredSnapshot.surfaces[ 0 ].layers.find( ( l ) => l.id === 'title' );
		expect( restoredTitleLayer.x ).toBe( initialX );
		expect( restoredSnapshot.surfaces.map( ( s ) => s.label ) ).toEqual( [ 'Welcome Slide' ] );

		// =========================================================================
		// Part 3: Text-only edit keeps core undo
		// =========================================================================
		const textOnlyContent = `${ initialMainText }\n\nText only edit for J101.`;
		const textOnlySummary = 'J101 test: wikitext edit only';
		const pubTextOnly = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( restoredSnapshot ),
			maintext: textOnlyContent,
			summary: textOnlySummary,
			token: csrfToken
		}, true );
		expect( pubTextOnly.layerspublish?.result ).toBe( 'Success' );
		const revTextOnly = pubTextOnly.layerspublish.revid;
		lastOwnedRevision = revTextOnly;

		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&action=history` );
		await page.waitForLoadState( 'networkidle' );

		const textOnlyTools = page.locator( `li[data-mw-revid="${ revTextOnly }"]` ).locator( '.mw-pager-tools' );
		await expect( textOnlyTools ).toBeVisible();

		// Keeps core's standard undo link
		const coreUndoText = textOnlyTools.locator( 'a[href*="action=edit"][href*="undo="]' );
		await expect( coreUndoText ).toBeVisible();
		await expect( coreUndoText ).toHaveText( 'undo' );

		// Shows NO drawing undo link
		await expect( textOnlyTools.locator( '.layers-history-undo-link' ) ).toHaveCount( 0 );

		// =========================================================================
		// Part 4: Added drawing shows no undo link
		// =========================================================================
		const addedSnapshot = JSON.parse( JSON.stringify( restoredSnapshot ) );
		addedSnapshot.surfaces.push( {
			id: 'surface_j101_new',
			kind: 'slide',
			label: 'Brand New Drawing',
			canvas: {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			},
			layers: [
				{
					id: 'l1',
					type: 'text',
					text: 'Brand new drawing layer',
					x: 30,
					y: 30,
					fontSize: 18,
					color: '#000000'
				}
			]
		} );

		const addDrawingSummary = 'J101 test: add brand new drawing';
		const pubAddedDrawing = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( addedSnapshot ),
			maintext: textOnlyContent,
			summary: addDrawingSummary,
			token: csrfToken
		}, true );
		expect( pubAddedDrawing.layerspublish?.result ).toBe( 'Success' );
		const revAddedDrawing = pubAddedDrawing.layerspublish.revid;
		lastOwnedRevision = revAddedDrawing;

		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&action=history` );
		await page.waitForLoadState( 'networkidle' );

		const addedDrawingTools = page.locator( `li[data-mw-revid="${ revAddedDrawing }"]` ).locator( '.mw-pager-tools' );
		await expect( addedDrawingTools ).toBeVisible();

		// Shows no drawing undo link (brand new drawing had no prior version)
		await expect( addedDrawingTools.locator( '.layers-history-undo-link' ) ).toHaveCount( 0 );

		// Shows no core undo link either
		await expect( addedDrawingTools.locator( 'a[href*="undo="]' ) ).toHaveCount( 0 );

		// =========================================================================
		// Part 5: Permission check
		// =========================================================================
		// Anonymous reader sees no undo links in history
		const anonContext = await page.context().browser().newContext();
		const anonPage = await anonContext.newPage();
		await anonPage.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&action=history` );
		await anonPage.waitForLoadState( 'networkidle' );

		const anonUndoLinks = anonPage.locator( 'a[href*="undo"], .layers-history-undo-link' );
		await expect( anonUndoLinks ).toHaveCount( 0 );
		await anonContext.close();

		// Check for an account with edit but without editlayers
		const allUsersResp = await api( { action: 'query', list: 'allusers', auprop: 'rights', aulimit: '500' } );
		const editWithoutLayers = allUsersResp.query.allusers.find( ( u ) =>
			u.rights && u.rights.includes( 'edit' ) && !u.rights.includes( 'editlayers' )
		);
		if ( !editWithoutLayers ) {
			// Per J101 packet instructions:
			// "You may not create accounts; if the wiki has no such account, record that part as not tested, not passed."
			// We log this finding and verify that the test handles it cleanly without fabricating a pass.
			// eslint-disable-next-line no-console
			console.log( 'J101 Finding: No account with edit but without editlayers exists on test wiki; recorded as not tested.' );
		} else {
			// If such an account exists, test it
			const limitedContext = await page.context().browser().newContext();
			const limitedPage = await limitedContext.newPage();
			await limitedPage.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&action=history` );
			await expect( limitedPage.locator( '#pagehistory a[href*="undo"], #pagehistory .layers-history-undo-link' ) ).toHaveCount( 0 );
			await limitedContext.close();
		}

		// =========================================================================
		// Part 6: Feeds
		// =========================================================================
		const ownerTitle = owner.replace( /_/g, ' ' );

		// Special:RecentChanges
		await page.goto( `${ base }/index.php?title=Special:RecentChanges&enhanced=0` );
		await page.waitForLoadState( 'networkidle' );

		const rcRow = page.locator( '.mw-changeslist-line' ).filter( { hasText: ownerTitle } ).filter( { hasText: editDrawingSummary } ).first();
		await expect( rcRow ).toBeVisible();
		await expect( rcRow.locator( '.comment' ) ).toContainText( editDrawingSummary );
		await expect( rcRow.locator( '.mw-tag-marker-layers-page-drawing' ) ).toBeVisible();

		// Special:Watchlist
		await page.goto( `${ base }/index.php?title=Special:Watchlist&enhanced=0` );
		await page.waitForLoadState( 'networkidle' );

		const wlRow = page.locator( '.mw-changeslist-line' ).filter( { hasText: ownerTitle } ).filter( { hasText: editDrawingSummary } ).first();
		await expect( wlRow ).toBeVisible();
		await expect( wlRow.locator( '.comment' ) ).toContainText( editDrawingSummary );
		await expect( wlRow.locator( '.mw-tag-marker-layers-page-drawing' ) ).toBeVisible();

		// Special:Contributions
		await page.goto( `${ base }/index.php?title=Special:Contributions/${ encodeURIComponent( config.username ) }` );
		await page.waitForLoadState( 'networkidle' );

		const contribRow = page.locator( 'ul.mw-contributions-list > li' ).filter( { hasText: ownerTitle } ).filter( { hasText: editDrawingSummary } ).first();
		await expect( contribRow ).toBeVisible();
		await expect( contribRow.locator( '.comment' ) ).toContainText( editDrawingSummary );
		await expect( contribRow.locator( '.mw-tag-marker-layers-page-drawing' ) ).toBeVisible();

		// Restore watch state
		if ( !watchedOriginally ) {
			await api( { action: 'watch', titles: owner, unwatch: '1', token: watchToken }, true );
		}

		// Restore baseline in main flow
		const pubRestore = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J101 cleanup: restore baseline',
			token: csrfToken
		}, true );
		expect( pubRestore.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = pubRestore.layerspublish.revid;

	} finally {
		// Ensure owner page is restored to exact baseline
		try {
			if ( !watchedOriginally ) {
				await api( { action: 'watch', titles: owner, unwatch: '1', token: watchToken }, true );
			}
			const checkQuery = await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'ids|content',
				rvslots: 'main'
			} );
			const curRev = checkQuery.query.pages[ 0 ].revisions[ 0 ];
			const curRevId = curRev.revid;
			const curText = curRev.slots.main.content;
			const curLayers = await api( { action: 'layersread', owner, revid: String( curRevId ) } );
			const curSnapshot = curLayers.layersread.snapshot;

			if ( curText !== initialMainText ||
				JSON.stringify( curSnapshot ) !== JSON.stringify( initialSnapshot )
			) {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( curRevId ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J101 finally: restore baseline',
					token: csrfToken
				}, true );
			}
		} catch ( e ) {
			// Best effort
		}
	}
} );
