/* eslint-env node */
/* global BigInt */
/**
 * J90 Acceptance: Browser acceptance of creating a drawing from an embed
 * Advances: HIST-4 (An embed can start a new drawing: Create link, empty editor, first save adds it).
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. From the baseline, publish page text with three embeds:
 *    {{#Slide:<pageId>:Created slide}}
 *    [[File:<test image>|layerset=<pageId>:Created notes]]
 *    {{#Slide:<pageId + 1>:Other page}}
 * 2. On page view, drawing controls list "Create page drawing: Created slide"
 *    and "Create page drawing: Created notes", and nothing for "Other page".
 *    The first two embeds show no drawing yet.
 * 3. Slide: Open "Create page drawing: Created slide". Header reads "Drawing: Created slide".
 *    Press Rename drawing: message is the exact English text of layers-page-drawing-rename-new.
 *    Leave editor without saving: latest revision ID does not change.
 * 4. Draft: Open it again, draw one rectangle, reload editor page, restore draft from recovery dialog,
 *    and check rectangle is there. Save with empty summary. Exactly one new revision appears with
 *    comment 'Added drawing “Created slide”' and tag 'layers-page-drawing'; layers slot holds
 *    baseline drawing unchanged plus slide named "Created slide" with one rectangle.
 * 5. Image: Open "Create page drawing: Created notes". Editor shows uploaded image; draw one shape
 *    and save. New drawing is of kind 'image' with its source naming the uploaded file's current version.
 * 6. On page view, both drawings are painted, controls read "Edit page drawing: …" for both,
 *    and "Other page" still shows nothing.
 * 7. Accessibility rerun on tests/e2e/accessibility.spec.js.
 * 8. Baseline restoration by exact-base publication, in main flow and finally.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'an embed can start a new drawing: Create link, empty editor, first save adds it (HIST-4)', async ( { page, context } ) => {
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

	// Reuse existing image fixture from test wiki (B010.jpg)
	const fileInfoQuery = await api( {
		action: 'query',
		titles: 'File:B010.jpg',
		prop: 'imageinfo',
		iiprop: 'timestamp|sha1|size|mime'
	} );
	const testImageFile = fileInfoQuery.query.pages[ 0 ];
	expect( testImageFile.missing ).toBeUndefined();
	const testImageInfo = testImageFile.imageinfo[ 0 ];
	expect( testImageInfo.mime ).toMatch( /^image\// );

	let lastOwnedRevision = null;
	let needsRestore = false;

	await page.setViewportSize( { width: 1920, height: 1080 } );

	// Helper to clear localStorage drafts for this origin
	const clearDrafts = async () => {
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
	};

	// Helper to select tools from the toolbar (handling both dropdowns and standalone buttons)
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

	// Helper to map canvas logical coordinates to screen client coordinates
	const canvasToClient = async ( x, y ) => {
		const canvas = page.locator( '.layers-canvas' );
		const box = await canvas.boundingBox();
		return {
			x: box.x + x * ( box.width / 800 ),
			y: box.y + y * ( box.height / 600 )
		};
	};

	// Helper to perform press-drag-release gesture on canvas
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

	// Helper to draw a rectangle on canvas
	const drawRectangle = async () => {
		await selectToolbarTool( 'rectangle', 'shapes' );
		await drawDrag( 50, 50, 200, 150 );
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );
	};

	try {
		needsRestore = true;

		// =========================================================================
		// Step 1: From baseline, publish page text (exact base, drawings unchanged)
		//         with three embeds:
		//         {{#Slide:<pageId>:Created slide}}
		//         [[File:B010.jpg|layerset=<pageId>:Created notes]]
		//         {{#Slide:<pageId + 1>:Other page}}
		// =========================================================================
		const otherPageId = pageId + 1;
		const embedsText = `{{#Slide:${ pageId }:Created slide}}\n` +
			`[[File:B010.jpg|layerset=${ pageId }:Created notes]]\n` +
			`{{#Slide:${ otherPageId }:Other page}}`;

		const pub1 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( initialSnapshot ),
			maintext: embedsText,
			summary: 'J90 step 1: seed three embeds for create acceptance',
			token: csrfToken
		}, true );
		expect( pub1.layerspublish?.result ).toBe( 'Success' );
		const rev1 = pub1.layerspublish.revid;
		expect( rev1 ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = rev1;

		// =========================================================================
		// Step 2: On page view:
		//         - Controls must list "Create page drawing: Created slide"
		//         - Controls must list "Create page drawing: Created notes"
		//         - Nothing for "Other page"
		//         - First two embeds show no drawing yet
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await clearDrafts();

		const controls = page.locator( '.layers-page-edit-controls' );
		await expect( controls ).toBeVisible();

		const createSlideLink = controls.locator( '.layers-page-edit-link', { hasText: 'Create page drawing: Created slide' } );
		await expect( createSlideLink ).toBeVisible();

		const createNotesLink = controls.locator( '.layers-page-edit-link', { hasText: 'Create page drawing: Created notes' } );
		await expect( createNotesLink ).toBeVisible();

		// Nothing for "Other page"
		await expect( controls ).not.toContainText( 'Other page' );
		await expect( controls.locator( '.layers-page-edit-link', { hasText: 'Other page' } ) ).toHaveCount( 0 );

		// The first two embeds show no drawing yet: no painted canvas on either embed
		await expect( page.locator( '.layers-bound-slide canvas' ) ).toHaveCount( 0 );
		await expect( page.locator( '.layers-bound-file-view canvas' ) ).toHaveCount( 0 );

		// =========================================================================
		// Step 3: Slide:
		//         - Open "Create page drawing: Created slide"
		//         - Header reads "Drawing: Created slide"
		//         - Press Rename drawing: message must be exact English text of layers-page-drawing-rename-new
		//         - Leave editor without saving: latest revid must not change
		// =========================================================================
		await Promise.all( [
			page.waitForNavigation(),
			createSlideLink.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		const nameText = page.locator( '.layers-page-drawing-name-text' );
		await expect( nameText ).toHaveText( 'Drawing: Created slide' );

		// Press Rename drawing
		const renameBtn = page.locator( 'button.layers-page-drawing-rename' );
		await expect( renameBtn ).toBeVisible();
		await renameBtn.click();
		const promptInput = page.locator( 'input.layers-modal-input' );
		await expect( promptInput ).toBeVisible();
		await promptInput.fill( 'New name' );
		await page.locator( '.layers-modal-buttons button.layers-btn-primary' ).click();

		// Refusal notification with exact text
		const errorNotif = page.locator( '.mw-notification.mw-notification-type-error' );
		await expect( errorNotif.last() ).toContainText(
			"Save this new drawing before renaming it: the page's embed names it, and would no longer find it."
		);
		await expect( nameText ).toHaveText( 'Drawing: Created slide' );

		// Leave editor without saving; assert latest revision ID is unchanged
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const revCheck3 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 1
		} );
		expect( revCheck3.query.pages[ 0 ].revisions[ 0 ].revid ).toBe( rev1 );

		// Clear drafts flushed when navigating away in step 3 so step 4 has clean slate
		await clearDrafts();

		// =========================================================================
		// Step 4: Draft:
		//         - Open "Create page drawing: Created slide" again
		//         - Draw one rectangle
		//         - Reload editor page, restore draft from recovery dialog
		//         - Check rectangle is there
		//         - Save with empty summary
		//         - Exactly one new revision appears (rev2)
		//         - Comment is exactly 'Added drawing “Created slide”'
		//         - Tag: layers-page-drawing
		//         - layers slot holds baseline drawing unchanged plus slide "Created slide" with 1 rectangle
		// =========================================================================
		page.on( 'dialog', ( prompt ) => prompt.accept() );

		const createSlideLink2 = page.locator( '.layers-page-edit-link', { hasText: 'Create page drawing: Created slide' } );
		await expect( createSlideLink2 ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			createSlideLink2.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Drawing: Created slide' );

		// Draw one rectangle
		await drawRectangle();
		const localLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( localLayers.length ).toBe( 1 );
		expect( localLayers[ 0 ].type ).toBe( 'rectangle' );

		// Wait for actual debounced localStorage draft
		await page.waitForFunction( ( expected ) => Object.keys( localStorage ).some( ( key ) => {
			if ( !key.startsWith( 'layers-page-owned-draft-v1:' ) ) {
				return false;
			}
			return JSON.stringify( JSON.parse( localStorage.getItem( key ) ).editorState.layers ) === JSON.stringify( expected );
		} ), localLayers );

		// Reload editor page and restore draft
		await page.reload();

		const recoveryDialog = page.locator( 'dialog.layers-page-recovery' );
		await expect( recoveryDialog ).toBeVisible();
		// One draft for this revision, so no chooser: the dialog offers it directly.
		await expect( recoveryDialog.getByRole( 'button', { name: 'Review this draft' } ) ).toHaveCount( 0 );

		const restoreBtn = recoveryDialog.getByRole( 'button', { name: 'Restore local edits', exact: true } );
		await expect( restoreBtn ).toBeVisible();
		await restoreBtn.click();
		await expect( recoveryDialog ).toHaveCount( 0 );

		// Check rectangle is restored
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length === 1 );
		const restoredLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( restoredLayers[ 0 ].type ).toBe( 'rectangle' );

		// Save with empty summary
		const summaryInput = page.getByLabel( 'Summary:' );
		await expect( summaryInput ).toHaveValue( '' );

		const savePromise1 = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveRes1 = await ( await savePromise1 ).json();
		expect( saveRes1.layerspublish?.result ).toBe( 'Success' );
		const rev2 = saveRes1.layerspublish.revid;
		expect( rev2 ).toBeGreaterThan( rev1 );
		lastOwnedRevision = rev2;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Verify revision 2 comment and tag via API
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
		expect( revData2.parentid ).toBe( rev1 );
		expect( revData2.comment ).toBe( 'Added drawing “Created slide”' );
		expect( revData2.tags ).toContain( 'layers-page-drawing' );

		// Verify layers slot holds baseline drawing unchanged plus slide "Created slide" with 1 rectangle
		const read2 = await api( { action: 'layersread', owner, revid: String( rev2 ) } );
		const snapshot2 = read2.layersread.snapshot;
		expect( snapshot2.surfaces.length ).toBe( 2 );
		expect( snapshot2.surfaces[ 0 ].id ).toBe( 'presentation' );
		expect( snapshot2.surfaces[ 0 ].kind ).toBe( 'slide' );
		expect( snapshot2.surfaces[ 0 ].label ).toBe( 'Welcome Slide' );
		expect( snapshot2.surfaces[ 1 ].kind ).toBe( 'slide' );
		expect( snapshot2.surfaces[ 1 ].label ).toBe( 'Created slide' );
		expect( snapshot2.surfaces[ 1 ].layers.length ).toBe( 1 );
		expect( snapshot2.surfaces[ 1 ].layers[ 0 ].type ).toBe( 'rectangle' );

		// Clear drafts before opening image drawing
		await clearDrafts();

		// =========================================================================
		// Step 5: Image:
		//         - Open "Create page drawing: Created notes"
		//         - Editor must show the uploaded image
		//         - Draw one shape and save
		//         - New drawing must be of kind image with source naming uploaded file's current version
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const createNotesLink2 = page.locator( '.layers-page-edit-link', { hasText: 'Create page drawing: Created notes' } );
		await expect( createNotesLink2 ).toBeVisible();

		await Promise.all( [
			page.waitForNavigation(),
			createNotesLink2.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.apiManager?.pageOwnedDrafts?.ready === true );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Drawing: Created notes' );

		// Editor must show the uploaded image
		await page.waitForFunction( () => {
			const cm = window.layersEditorInstance?.canvasManager;
			return cm && cm.backgroundImage && cm.backgroundImage.complete && cm.backgroundImage.naturalWidth > 0;
		} );

		// Draw one shape
		await drawRectangle();
		const imageLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( imageLayers.length ).toBe( 1 );
		expect( imageLayers[ 0 ].type ).toBe( 'rectangle' );

		// Save
		const savePromise2 = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveRes2 = await ( await savePromise2 ).json();
		expect( saveRes2.layerspublish?.result ).toBe( 'Success' );
		const rev3 = saveRes2.layerspublish.revid;
		expect( rev3 ).toBeGreaterThan( rev2 );
		lastOwnedRevision = rev3;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Verify revision 3 comment and tag via API
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
		expect( revData3.parentid ).toBe( rev2 );
		expect( revData3.comment ).toBe( 'Added drawing “Created notes”' );
		expect( revData3.tags ).toContain( 'layers-page-drawing' );

		// Verify new drawing is of kind image with source naming uploaded file's current version
		const read3 = await api( { action: 'layersread', owner, revid: String( rev3 ) } );
		const snapshot3 = read3.layersread.snapshot;
		expect( snapshot3.surfaces.length ).toBe( 3 );
		const notesSurface = snapshot3.surfaces.find( ( s ) => s.label === 'Created notes' );
		expect( notesSurface ).toBeDefined();
		expect( notesSurface.kind ).toBe( 'image' );
		expect( notesSurface.source.repository ).toBe( 'local' );
		expect( notesSurface.source.fileTitle ).toBe( 'File:B010.jpg' );
		expect( notesSurface.source.timestamp ).toBe( testImageInfo.timestamp.replace( /\D/g, '' ) );
		const expectedSha1 = BigInt( '0x' + testImageInfo.sha1 ).toString( 36 ).padStart( 31, '0' );
		expect( notesSurface.source.sha1 ).toBe( expectedSha1 );

		// =========================================================================
		// Step 6: Post-creation page view:
		//         - Both drawings are painted
		//         - Controls now read "Edit page drawing: …" for both
		//         - "Other page" still shows nothing
		// =========================================================================
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const controlsAfter = page.locator( '.layers-page-edit-controls' );
		await expect( controlsAfter ).toBeVisible();

		// Both drawings painted
		const slideHost = page.locator( '.layers-bound-slide' );
		await expect( slideHost ).toBeVisible();
		const slideCanvas = slideHost.locator( 'canvas' );
		await expect( slideCanvas ).toBeVisible();
		await expect.poll( async () => {
			return slideCanvas.evaluate( ( c ) => {
				const ctx = c.getContext( '2d' );
				const pixels = ctx.getImageData( 0, 0, c.width, c.height ).data;
				for ( let i = 0; i < pixels.length; i += 4 ) {
					if ( pixels[ i + 3 ] > 0 && ( pixels[ i ] < 250 || pixels[ i + 1 ] < 250 || pixels[ i + 2 ] < 250 ) ) {
						return true;
					}
				}
				return false;
			} );
		} ).toBe( true );

		const fileHost = page.locator( '.layers-bound-file-view' );
		await expect( fileHost ).toBeVisible();
		const fileCanvas = fileHost.locator( 'canvas' );
		await expect( fileCanvas ).toBeVisible();
		await expect.poll( async () => {
			return fileCanvas.evaluate( ( c ) => {
				const ctx = c.getContext( '2d' );
				const pixels = ctx.getImageData( 0, 0, c.width, c.height ).data;
				for ( let i = 0; i < pixels.length; i += 4 ) {
					if ( pixels[ i + 3 ] > 0 && ( pixels[ i ] < 250 || pixels[ i + 1 ] < 250 || pixels[ i + 2 ] < 250 ) ) {
						return true;
					}
				}
				return false;
			} );
		} ).toBe( true );

		// Controls now read "Edit page drawing: …" for both
		const editSlideLink = controlsAfter.locator( '.layers-page-edit-link', { hasText: 'Edit page drawing: Created slide' } );
		await expect( editSlideLink ).toBeVisible();

		const editNotesLink = controlsAfter.locator( '.layers-page-edit-link', { hasText: 'Edit page drawing: Created notes' } );
		await expect( editNotesLink ).toBeVisible();

		// "Other page" still shows nothing
		await expect( controlsAfter ).not.toContainText( 'Other page' );
		await expect( controlsAfter.locator( '.layers-page-edit-link', { hasText: 'Other page' } ) ).toHaveCount( 0 );

		// =========================================================================
		// Step 8: Restore baseline wikitext and initial snapshot via CAS exact-base publication
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J90 cleanup: restore automated owner baseline state',
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

		await clearDrafts();

	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J90 cleanup: restore automated owner baseline state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
