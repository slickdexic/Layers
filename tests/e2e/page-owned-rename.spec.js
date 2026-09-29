/* eslint-env node */
/**
 * J87 Acceptance: Browser acceptance of renaming a drawing
 * Advances: HIST-7 (Renaming a drawing updates this page's embeds in the same revision).
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. Baseline setup: On owner Layers_browser_acceptance (PageID 228), publish exact-base revision
 *    with two slide drawings: presentation ("Welcome Slide") and second_probe ("Second probe"),
 *    embedded by name in page wikitext.
 * 2. Editor header shows "Drawing: Welcome Slide".
 * 3. Refused names: Entering invalid name "a|b" and duplicate name "second_PROBE" show exact
 *    English notifications, keep header "Drawing: Welcome Slide", and leave revision ID unchanged.
 * 4. Rename to "Renamed probe" shows notice "The drawing will be called \"Renamed probe\" when you save.",
 *    updates header to "Drawing: Renamed probe", and saving with summary creates exactly one new revision.
 * 5. In the new revision, layers slot names presentation "Renamed probe" while leaving "Second probe" unchanged;
 *    main text updates embed to {{#Slide:<pageId>:Renamed probe}} and leaves Second probe unchanged without "Welcome Slide";
 *    page view paints both drawings and edit link reads "Edit page drawing: Renamed probe".
 * 6. Local draft recovery: Reopening editor, renaming to "Draft name" without saving, and reloading offers
 *    draft in recovery dialog; restoring draft updates header to "Drawing: Draft name"; closing without saving
 *    does not change latest revision ID.
 * 7. Exact-base CAS cleanup restores baseline wikitext and initial snapshot in main flow and finally.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'renaming a drawing updates this page embeds in the same revision (HIST-7)', async ( { page, context } ) => {
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

	// Record initial snapshot (must be restored in cleanup)
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;
	// Start only from the known baseline, so the cleanup restores it rather than whatever was found.
	expect( initialMainText ).toBe( 'Dedicated automated Layers history acceptance page.' );
	expect( initialSnapshot.surfaces.map( ( s ) => [ s.id, s.kind, s.label ] ) )
		.toEqual( [ [ 'presentation', 'slide', 'Welcome Slide' ] ] );

	let lastOwnedRevision = null;
	let needsRestore = false;

	await page.setViewportSize( { width: 1920, height: 1080 } );

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
		// Step 1: Baseline setup: Publish exact-base revision with two slide drawings:
		//         presentation ("Welcome Slide") and second_probe ("Second probe").
		//         Page text embeds both by name:
		//         {{#Slide:<pageId>:Welcome Slide}}
		//         {{#Slide:<pageId>:Second probe}}
		// =========================================================================
		needsRestore = true;

		const welcomeSlideSurface = {
			id: 'presentation',
			kind: 'slide',
			label: 'Welcome Slide',
			canvas: {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			},
			layers: [
				{
					id: 'title',
					type: 'text',
					text: 'Visual ideas — 世界',
					x: 99,
					y: 60,
					fontSize: 24,
					color: '#000000',
					visible: true
				}
			],
			readingOrder: [ 'title' ]
		};

		const secondProbeSurface = {
			id: 'second_probe',
			kind: 'slide',
			label: 'Second probe',
			canvas: {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			},
			layers: [
				{
					id: 'sec_txt',
					type: 'text',
					text: 'Second probe layer',
					x: 50,
					y: 50,
					fontSize: 20,
					color: '#0000ff',
					visible: true
				}
			],
			readingOrder: [ 'sec_txt' ]
		};

		const seedSnapshot = {
			schemaVersion: 1,
			surfaces: [
				welcomeSlideSurface,
				secondProbeSurface
			]
		};

		const seedMainText = `${ initialMainText }\n\n== Drawings ==\n{{#Slide:${ pageId }:Welcome Slide}}\n\n{{#Slide:${ pageId }:Second probe}}`;

		const pub1 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( seedSnapshot ),
			maintext: seedMainText,
			summary: 'J87 baseline: Welcome Slide and Second probe',
			token: csrfToken
		}, true );
		expect( pub1.layerspublish?.result ).toBe( 'Success' );
		const rev1 = pub1.layerspublish.revid;
		expect( rev1 ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = rev1;

		// =========================================================================
		// Step 2: Open editor from "Edit page drawing: Welcome Slide" link.
		//         Header must read "Drawing: Welcome Slide".
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const welcomeEditLink = page.locator( '.layers-page-edit-link' ).filter( {
			hasText: 'Edit page drawing: Welcome Slide'
		} );
		await expect( welcomeEditLink ).toBeVisible();

		await Promise.all( [
			page.waitForNavigation(),
			welcomeEditLink.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		const nameText = page.locator( '.layers-page-drawing-name-text' );
		await expect( nameText ).toHaveText( 'Drawing: Welcome Slide' );

		// =========================================================================
		// Step 3: Refused names: Press "Rename drawing" button, enter "a|b", then
		//         "second_PROBE". Each must show exact English error notification,
		//         header must remain "Drawing: Welcome Slide", and latest revid must
		//         not change.
		// =========================================================================

		// Attempt 3a: "a|b" (invalid characters)
		await renameDrawing( 'a|b' );
		const errorNotif1 = page.locator( '.mw-notification.mw-notification-type-error' );
		await expect( errorNotif1.last() ).toContainText(
			'"a|b" cannot be used as a drawing name. A name needs 1 to 255 characters and none of these: | [ ] { } < > :'
		);
		await expect( nameText ).toHaveText( 'Drawing: Welcome Slide' );

		const historyAfterRefusal1 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( historyAfterRefusal1.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev1 );

		// Attempt 3b: "second_PROBE" (conflicts with existing "Second probe" case-insensitively)
		await renameDrawing( 'second_PROBE' );
		const errorNotif2 = page.locator( '.mw-notification.mw-notification-type-error' );
		await expect( errorNotif2.last() ).toContainText(
			'This page already has a drawing named "second_PROBE". Names that differ only in case, spaces or underscores count as the same name.'
		);
		await expect( nameText ).toHaveText( 'Drawing: Welcome Slide' );

		const historyAfterRefusal2 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( historyAfterRefusal2.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev1 );

		// =========================================================================
		// Step 4: Rename to "Renamed probe":
		//         - Verify notification: "The drawing will be called \"Renamed probe\" when you save."
		//         - Header must read "Drawing: Renamed probe".
		//         - Latest revision ID must still not change.
		//         - Save with summary ("Rename Welcome Slide to Renamed probe").
		// =========================================================================
		await renameDrawing( 'Renamed probe' );
		const infoNotif = page.locator( '.mw-notification' ).filter( {
			hasText: 'The drawing will be called "Renamed probe" when you save.'
		} );
		await expect( infoNotif.last() ).toBeVisible();
		await expect( nameText ).toHaveText( 'Drawing: Renamed probe' );

		const historyBeforeSave = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( historyBeforeSave.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev1 );

		const saveSummary = 'Rename Welcome Slide to Renamed probe';
		const savePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.evaluate( ( summary ) => {
			return window.layersEditorInstance.apiManager.pageOwnedDrafts.save( summary );
		}, saveSummary );
		const saveRes = await ( await savePromise ).json();
		expect( saveRes.layerspublish?.result ).toBe( 'Success' );
		const rev2 = saveRes.layerspublish.revid;
		expect( rev2 ).toBeGreaterThan( rev1 );
		lastOwnedRevision = rev2;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// =========================================================================
		// Step 5: Result: Exactly one new revision.
		//         - In it, layers slot names presentation "Renamed probe" and leaves
		//           "Second probe" unchanged.
		//         - Main text contains {{#Slide:<pageId>:Renamed probe}} and second
		//           embed unchanged, and no longer contains "Welcome Slide".
		//         - On page view, both drawings are painted and edit link reads
		//           "Edit page drawing: Renamed probe".
		// =========================================================================
		const historyAfterSave = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags|comment|content',
			rvslots: 'main',
			rvlimit: 2
		} );
		const rev2Record = historyAfterSave.query.pages[ 0 ].revisions[ 0 ];
		expect( rev2Record.revid ).toBe( rev2 );
		expect( rev2Record.parentid ).toBe( rev1 );
		expect( rev2Record.comment ).toBe( saveSummary );
		expect( rev2Record.tags ).toContain( 'layers-page-drawing' );

		// Check snapshot in layers slot
		const readRev2 = await api( { action: 'layersread', owner, revid: String( rev2 ) } );
		const surfacesRev2 = readRev2.layersread.snapshot.surfaces;
		const surface0 = surfacesRev2.find( ( s ) => s.id === 'presentation' );
		expect( surface0 ).toBeDefined();
		expect( surface0.label ).toBe( 'Renamed probe' );
		const surface1 = surfacesRev2.find( ( s ) => s.id === 'second_probe' );
		expect( surface1 ).toBeDefined();
		expect( surface1.label ).toBe( 'Second probe' );

		// Check main wikitext rewritten
		const mainTextRev2 = rev2Record.slots.main.content;
		expect( mainTextRev2 ).toContain( `{{#Slide:${ pageId }:Renamed probe}}` );
		expect( mainTextRev2 ).toContain( `{{#Slide:${ pageId }:Second probe}}` );
		expect( mainTextRev2 ).not.toContain( 'Welcome Slide' );

		// Check owner page view
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const slideCanvases = page.locator( '.layers-bound-slide canvas' );
		await expect( slideCanvases ).toHaveCount( 2 );
		await expect( slideCanvases.first() ).toBeVisible();
		await expect( slideCanvases.last() ).toBeVisible();

		// Both drawings painted (non-white pixels on each slide canvas)
		for ( const index of [ 0, 1 ] ) {
			await expect.poll( () => slideCanvases.nth( index ).evaluate( ( c ) => {
				const data = c.getContext( '2d' ).getImageData( 0, 0, c.width, c.height ).data;
				for ( let i = 0; i < data.length; i += 4 ) {
					if ( data[ i + 3 ] > 0 && ( data[ i ] !== 255 || data[ i + 1 ] !== 255 || data[ i + 2 ] !== 255 ) ) {
						return true;
					}
				}
				return false;
			} ) ).toBe( true );
		}

		const renamedEditLink = page.locator( '.layers-page-edit-link' ).filter( {
			hasText: 'Edit page drawing: Renamed probe'
		} );
		await expect( renamedEditLink ).toBeVisible();

		// Clear any drafts from earlier steps so the subsequent draft test starts with a clean slate
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

		// =========================================================================
		// Step 6: Draft recovery:
		//         - Open editor again from "Edit page drawing: Renamed probe"
		//         - Rename to "Draft name" without saving
		//         - Reload browser page
		//         - The recovery dialog (dialog.layers-page-recovery) must offer draft
		//         - Press restore (layers-page-draft-dialog-restore)
		//         - Header must read "Drawing: Draft name"
		//         - Close editor without saving; latest revision ID must not change
		// =========================================================================
		page.on( 'dialog', ( prompt ) => prompt.accept() );

		await Promise.all( [
			page.waitForNavigation(),
			renamedEditLink.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Drawing: Renamed probe' );

		await renameDrawing( 'Draft name' );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Drawing: Draft name' );

		// Do not save; wait a tick for localStorage sync then reload
		await page.waitForTimeout( 200 );
		await page.reload();

		const recoveryDialog = page.locator( 'dialog.layers-page-recovery' );
		await expect( recoveryDialog ).toBeVisible();

		// One draft for this revision, so no chooser: the dialog offers it directly.
		await expect( recoveryDialog.getByRole( 'button', { name: 'Review this draft' } ) ).toHaveCount( 0 );

		const restoreBtn = recoveryDialog.getByRole( 'button', { name: 'Restore local edits', exact: true } );
		await expect( restoreBtn ).toBeVisible();
		await restoreBtn.click();
		await expect( recoveryDialog ).toHaveCount( 0 );

		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Drawing: Draft name' );

		// Close editor without saving
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );

		const historyAfterDraftClose = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( historyAfterDraftClose.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev2 );

		// =========================================================================
		// Step 7: Restore owner baseline wikitext and initial snapshot via CAS exact-base publication
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J87 cleanup: restore automated owner baseline state',
			token: csrfToken
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restorePub.layerspublish.revid;
		needsRestore = false;

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
					summary: 'J87 cleanup: restore automated owner state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
