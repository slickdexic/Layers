/* eslint-env node */
/**
 * J100 Acceptance: Browser acceptance of copying from the editor's list
 * Advances: HIST-5, TYPES-3 and scenario S4.
 *
 * Proves in Chromium on the test wiki (http://localhost:8080) that:
 * 1. The list: "Copy from another page" opens a dialog with focus in the search box;
 *    lists drawings of other pages (never this page's own). Search for a title prefix
 *    filters results; searching for a nonexistent string reports no drawings found.
 *    Escape closes dialog and returns focus to the button; Tab never leaves dialog.
 * 2. The confirmation: Selecting "anatomy" of Layers migration fixture/Direct opens
 *    Special:CopyLayersDrawing naming the drawing, source page, revision and this page;
 *    a GET changes nothing.
 * 3. The copy: Submitting with note "J100" creates a new revision tagged layers-page-drawing
 *    with summary 'Copied the layer set “anatomy” from [[:Layers migration fixture/Direct]] (revision N): J100'.
 *    layersread lists "Welcome Slide" and "anatomy", and copy's layers equal source's.
 *    Copying a second time names the new drawing "anatomy 2".
 * 4. Showing it: Publishing owner page text with [[File:<file>|layerset=<ownerId>:anatomy]]
 *    paints the copy (text color detected along text line, not on control line above).
 * 5. Stale and unreadable: Form submitted against a changed base revision fails with edit
 *    conflict message; anonymous layersdrawings request returns permissiondenied.
 * 6. Baseline restored by exact-base CAS in main flow and finally.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const { isWikiMigrated } = require( './helpers/migration' );

test.describe.configure( { mode: 'serial' } );

test( 'copy drawing from editor list of other pages (HIST-5, TYPES-3, S4)', async ( { page, context } ) => {
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
	expect( initialSnapshot.surfaces.map( ( s ) => s.label ) ).toEqual( [ 'Welcome Slide' ] );

	let lastOwnedRevision = initialRevId;

	const clearDrafts = async () => {
		await page.evaluate( ( id ) => {
			try {
				const prefix = `layers_page_draft_${ id }_`;
				const toRemove = [];
				for ( let i = 0; i < localStorage.length; i++ ) {
					const key = localStorage.key( i );
					if ( key && key.startsWith( prefix ) ) {
						toRemove.push( key );
					}
				}
				toRemove.forEach( ( k ) => localStorage.removeItem( k ) );
			} catch ( e ) {
				// Ignore
			}
		}, pageId );
	};

	try {
		// =========================================================================
		// Part 1: The list
		// =========================================================================
		await page.goto( `${ base }/index.php?title=Special:EditLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ lastOwnedRevision }&surface=presentation` );
		await page.waitForLoadState( 'networkidle' );
		await clearDrafts();

		const copyButton = page.locator( '.layers-page-drawing-copy' );
		await expect( copyButton ).toBeVisible();
		await copyButton.click();

		const dialog = page.locator( '.layers-page-copy-dialog' );
		await expect( dialog ).toBeVisible();

		const searchInput = page.locator( '.layers-page-copy-search' );
		await expect( searchInput ).toBeFocused();

		// Wait for default listing to load
		await expect( page.locator( '.layers-page-copy-results li' ).first() ).toBeVisible( { timeout: 10000 } );

		// Verify owner page's own drawings are NEVER listed
		const resultTexts = await page.locator( '.layers-page-copy-results li' ).allInnerTexts();
		for ( const txt of resultTexts ) {
			expect( txt ).not.toContain( owner );
		}

		// Search for start of title: "Layers migration fixture/Direct"
		await searchInput.fill( 'Layers migration fixture/Direct' );
		await expect.poll( async () => {
			const items = await page.locator( '.layers-page-copy-results li' ).allInnerTexts();
			return items.length > 0 && items.every( ( t ) => t.includes( 'Layers migration fixture/Direct' ) );
		}, { timeout: 10000 } ).toBe( true );

		// Search for string that matches nothing
		await searchInput.fill( 'NonexistentQueryXYZ999' );
		await expect( page.locator( '.layers-page-copy-results li' ) ).toHaveCount( 0, { timeout: 10000 } );
		await expect( page.locator( '.layers-page-copy-status' ) ).not.toBeEmpty();

		// Escape closes dialog and leaves editor open with focus back on button
		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toHaveCount( 0 );
		await expect( page.locator( '[role="application"]' ) ).toBeVisible();
		await expect( copyButton ).toBeFocused();

		// Reopen dialog and test Tab focus trapping
		await copyButton.click();
		await expect( dialog ).toBeVisible();
		await expect( searchInput ).toBeFocused();

		const focusableElements = dialog.locator( 'input, a[href], button' );
		const count = await focusableElements.count();
		expect( count ).toBeGreaterThan( 1 );

		for ( let i = 0; i < count + 2; i++ ) {
			await page.keyboard.press( 'Tab' );
			const inside = await page.evaluate( () => {
				const d = document.querySelector( '.layers-page-copy-dialog' );
				return d ? d.contains( document.activeElement ) : false;
			} );
			expect( inside ).toBe( true );
		}

		// =========================================================================
		// Part 2: The confirmation
		// =========================================================================
		await searchInput.fill( 'Layers migration fixture/Direct' );
		const anatomyLink = page.locator( '.layers-page-copy-results li a' ).filter( { hasText: 'anatomy' } ).first();
		await expect( anatomyLink ).toBeVisible( { timeout: 10000 } );

		const anatomyHref = await anatomyLink.getAttribute( 'href' );
		const sourceRevBefore = ( await api( {
			action: 'query', prop: 'revisions', rvprop: 'ids', titles: 'Layers migration fixture/Direct'
		} ) ).query.pages[ 0 ].revisions[ 0 ].revid;
		await anatomyLink.click();
		await page.waitForLoadState( 'networkidle' );

		expect( page.url() ).toContain( 'Special:CopyLayersDrawing' );
		const contentText = await page.locator( '#mw-content-text' ).innerText();
		expect( contentText ).toContain( 'anatomy' );
		expect( contentText ).toContain( 'Layers migration fixture/Direct' );
		expect( contentText ).toContain( 'Layers browser acceptance' );

		// A GET changes nothing: owner latest revision is still initialRevId
		const afterGetOwnerQuery = await api( { action: 'query', prop: 'revisions', rvprop: 'ids', titles: owner } );
		expect( afterGetOwnerQuery.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( initialRevId );

		// =========================================================================
		// Part 3: The copy
		// =========================================================================
		const noteInput = page.locator( 'input[name="wpnote"]' );
		await expect( noteInput ).toBeVisible();
		await noteInput.fill( 'J100' );

		const submitButton = page.locator( 'button[type="submit"]' );
		await submitButton.click();
		await page.waitForLoadState( 'networkidle' );

		// Check owner page revisions
		const ownerHistory = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|comment|tags|content',
			rvslots: 'main',
			rvlimit: 2
		} );
		const latestRev = ownerHistory.query.pages[ 0 ].revisions[ 0 ];
		expect( latestRev.revid ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = latestRev.revid;

		expect( latestRev.tags ).toContain( 'layers-page-drawing' );
		expect( latestRev.comment ).toMatch( /^Copied the layer set “anatomy” from \[\[:Layers migration fixture\/Direct\]\] \(revision \d+\): J100$/ );
		expect( latestRev.slots.main.content ).toBe( initialMainText );

		// layersread lists "Welcome Slide" and "anatomy", and copy's layers equal source's
		const readAfterCopy = await api( { action: 'layersread', owner, revid: String( lastOwnedRevision ) } );
		const surfacesAfterCopy = readAfterCopy.layersread.snapshot.surfaces;
		expect( surfacesAfterCopy.map( ( s ) => s.label ) ).toEqual( [ 'Welcome Slide', 'anatomy' ] );

		const anatomySurface = surfacesAfterCopy.find( ( s ) => s.label === 'anatomy' );
		expect( anatomySurface ).toBeDefined();
		expect( anatomySurface.layers[ 0 ].text ).toBe( 'Fixture A anatomy' );

		// Source page's latest revision is unchanged
		const sourceQuery = await api( {
			action: 'query', prop: 'revisions', rvprop: 'ids', titles: 'Layers migration fixture/Direct'
		} );
		expect( sourceQuery.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( sourceRevBefore );

		// Do the copy a second time from the list: new drawing named "anatomy 2"
		await page.goto( `${ base }/index.php?title=Special:EditLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ lastOwnedRevision }&surface=presentation` );
		await page.waitForLoadState( 'networkidle' );
		await clearDrafts();

		await page.locator( '.layers-page-drawing-copy' ).click();
		await expect( page.locator( '.layers-page-copy-dialog' ) ).toBeVisible();
		await page.locator( '.layers-page-copy-search' ).fill( 'Layers migration fixture/Direct' );
		const anatomyLink2 = page.locator( '.layers-page-copy-results li a' ).filter( { hasText: 'anatomy' } ).first();
		await expect( anatomyLink2 ).toBeVisible( { timeout: 10000 } );

		await anatomyLink2.click();
		await page.waitForLoadState( 'networkidle' );
		await page.locator( 'input[name="wpnote"]' ).fill( 'J100 second' );
		await page.locator( 'button[type="submit"]' ).click();
		await page.waitForLoadState( 'networkidle' );

		const ownerHistory2 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		lastOwnedRevision = ownerHistory2.query.pages[ 0 ].revisions[ 0 ].revid;

		const readAfterCopy2 = await api( { action: 'layersread', owner, revid: String( lastOwnedRevision ) } );
		const labelsAfterCopy2 = readAfterCopy2.layersread.snapshot.surfaces.map( ( s ) => s.label );
		expect( labelsAfterCopy2 ).toContain( 'anatomy 2' );

		// =========================================================================
		// Part 4: Showing it
		// =========================================================================
		const currentSnapshot = readAfterCopy2.layersread.snapshot;
		const embedText = `${ initialMainText }\n\n[[File:Layers_migration_fixture_A.png|layerset=${ pageId }:anatomy]]`;

		const pubEmbed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( currentSnapshot ),
			maintext: embedText,
			summary: 'J100 step 4: embed copied anatomy drawing',
			token: csrfToken
		}, true );
		expect( pubEmbed.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = pubEmbed.layerspublish.revid;

		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await page.waitForLoadState( 'networkidle' );

		const canvasLocator = page.locator( '.layers-bound-file-view canvas' ).first();
		await expect( canvasLocator ).toBeVisible( { timeout: 15000 } );

		// Check stroke / text colour on canvas: text black pixels found along text line, none in control area above
		const pixelCheck = await canvasLocator.evaluate( ( c ) => {
			const ctx = c.getContext( '2d' );
			let textBlack = 0;
			let aboveBlack = 0;
			for ( let x = 50; x < 150; x++ ) {
				for ( let y = 35; y <= 55; y++ ) {
					const d = ctx.getImageData( x, y, 1, 1 ).data;
					if ( d[ 0 ] < 50 && d[ 1 ] < 50 && d[ 2 ] < 50 ) {
						textBlack++;
					}
				}
				for ( let y = 10; y <= 30; y++ ) {
					const d = ctx.getImageData( x, y, 1, 1 ).data;
					if ( d[ 0 ] < 50 && d[ 1 ] < 50 && d[ 2 ] < 50 ) {
						aboveBlack++;
					}
				}
			}
			return { textBlack, aboveBlack };
		} );
		expect( pixelCheck.textBlack ).toBeGreaterThan( 50 );
		expect( pixelCheck.aboveBlack ).toBe( 0 );

		// =========================================================================
		// Part 5: Stale and unreadable
		// =========================================================================
		// Open confirmation page for another drawing (labels)
		await page.goto( new URL( anatomyHref, base ).toString() );
		await page.waitForLoadState( 'networkidle' );
		await expect( page.locator( 'button[type="submit"]' ) ).toBeVisible();

		// While confirmation page is open with stale revid, publish another revision of owner page
		const midPublish = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( currentSnapshot ),
			maintext: `${ embedText }\n<!-- concurrent edit -->`,
			summary: 'J100 step 5: concurrent edit before submit',
			token: csrfToken
		}, true );
		expect( midPublish.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = midPublish.layerspublish.revid;

		// Now submit the stale form
		await page.locator( 'button[type="submit"]' ).click();
		await page.waitForLoadState( 'networkidle' );

		// Page refuses with edit conflict message
		const errorBox = page.locator( '.cdx-message--error, .mw-message-box-error' );
		await expect( errorBox ).toBeVisible();
		const errorText = await errorBox.innerText();
		expect( errorText ).toContain( 'has changed since this confirmation was opened' );

		// Verify no drawing was added
		const readAfterConflict = await api( { action: 'layersread', owner, revid: String( lastOwnedRevision ) } );
		const labelsAfterConflict = readAfterConflict.layersread.snapshot.surfaces.map( ( s ) => s.label );
		expect( labelsAfterConflict ).toEqual( currentSnapshot.surfaces.map( ( s ) => s.label ) );

		// Anonymously, layersdrawings API answers permissiondenied
		const anonContext = await page.context().browser().newContext();
		const anonResponse = await anonContext.request.get( `${ base }/api.php`, {
			params: {
				action: 'layersdrawings',
				search: 'Layers',
				exclude: String( pageId ),
				format: 'json',
				formatversion: '2'
			}
		} );
		const anonData = await anonResponse.json();
		expect( anonData.error?.code ).toBe( 'permissiondenied' );
		await anonContext.close();

		// Restore baseline in main flow
		const pubRestore = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J100 cleanup: restore baseline',
			token: csrfToken
		}, true );
		expect( pubRestore.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = pubRestore.layerspublish.revid;

	} finally {
		// Ensure owner page is restored to exact baseline
		try {
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
					summary: 'J100 finally: restore baseline',
					token: csrfToken
				}, true );
			}
		} catch ( e ) {
			// Best effort
		}
	}
} );
