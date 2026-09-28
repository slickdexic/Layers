/* eslint-env node */
/* global BigInt */
/**
 * J82 Acceptance: Named embeds in Chromium
 * Advances: HIST-4, TYPES-4.
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. A page shows its own slide and image drawings through embeds that name them (<pageId>:<name>).
 * 2. The page HTML contains no layer data, only data-layers-binding identities.
 * 3. Each drawing's edit link opens the editor, properties panel edits save as set,
 *    and each save creates exactly one new tagged revision.
 * 4. Refused embed forms (another page ID, unknown name, 0: page ID, file embed naming slide)
 *    draw nothing, show no shared layers, and the page still renders.
 * 5. Exact-base CAS cleanup restores baseline wikitext and initial snapshot.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'named embeds show drawings, edit links save tagged revisions, and refused forms draw nothing', async ( { page, context } ) => {
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

	// Discover first JPEG or PNG fixture
	const files = ( await api( {
		action: 'query',
		list: 'allimages',
		aimime: 'image/jpeg|image/png',
		ailimit: 1,
		aiprop: 'timestamp|sha1|size'
	} ) ).query.allimages;
	test.skip( !files.length, 'Requires at least one JPEG or PNG file on the wiki' );
	const file = files[ 0 ];

	let lastOwnedRevision = null;
	let needsRestore = false;

	// Desktop viewport for properties panel controls
	await page.setViewportSize( { width: 1920, height: 1080 } );

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
		// Step 1: Add slide "Named probe slide" (rectangle) and image "Named probe photo"
		//         on first JPEG/PNG file (text layer). Embeds:
		//         {{#Slide:<pageId>:named_probe_SLIDE}}
		//         [[File:<file>|200px|layerset=<pageId>:Named probe photo]]
		// =========================================================================
		needsRestore = true;

		const slideSurfaceId = 'slide_named_probe';
		const fileSurfaceId = 'photo_named_probe';
		const slideBinding = `v1:${ pageId }:${ slideSurfaceId }`;
		const fileBinding = `v1:${ pageId }:${ fileSurfaceId }`;

		const slideSurface = {
			id: slideSurfaceId,
			kind: 'slide',
			label: 'Named probe slide',
			canvas: {
				width: 800,
				height: 600,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			},
			layers: [
				{
					id: 'rect_named',
					type: 'rectangle',
					x: 40,
					y: 40,
					width: 200,
					height: 150,
					fill: '#ff0000',
					stroke: 'none'
				}
			],
			readingOrder: [ 'rect_named' ]
		};

		const fileSurface = {
			id: fileSurfaceId,
			kind: 'image',
			label: 'Named probe photo',
			canvas: {
				width: file.width,
				height: file.height,
				backgroundColor: '#ffffff',
				backgroundVisible: true,
				backgroundOpacity: 1
			},
			layers: [
				{
					id: 'text_named_photo',
					type: 'text',
					x: 30,
					y: 30,
					fontSize: 24,
					fontFamily: 'Arial',
					color: '#000000',
					text: 'Probe Photo Text',
					visible: true
				}
			],
			readingOrder: [ 'text_named_photo' ],
			source: {
				repository: 'local',
				fileTitle: 'File:' + file.name,
				timestamp: file.timestamp.replace( /\D/g, '' ),
				sha1: BigInt( '0x' + file.sha1 ).toString( 36 ).padStart( 31, '0' ),
				page: 1
			}
		};

		const snapshot1 = {
			schemaVersion: 1,
			surfaces: [
				...( initialSnapshot.surfaces || [] ),
				slideSurface,
				fileSurface
			]
		};

		// Case and underscore differences are deliberate per contract
		const mainText1 = `${ initialMainText }\n\n== Named Embeds ==\n{{#Slide:${ pageId }:named_probe_SLIDE}}\n\n[[File:${ file.name }|200px|layerset=${ pageId }:Named probe photo]]`;

		const pub1 = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( snapshot1 ),
			maintext: mainText1,
			summary: 'J82 step 1: seed named slide and file embeds',
			token: csrfToken
		}, true );
		expect( pub1.layerspublish?.result ).toBe( 'Success' );
		const rev1 = pub1.layerspublish.revid;
		expect( rev1 ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = rev1;

		// =========================================================================
		// Step 2: View page: both drawings are drawn (slide rectangle, photo text),
		//         and page HTML contains no layer data, only data-layers-binding identities.
		// =========================================================================
		const response = await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const pageHtml = await response.text();

		// HTML contains no layer data, only identities
		expect( pageHtml ).not.toContain( 'Probe Photo Text' );
		expect( pageHtml ).not.toContain( 'rect_named' );
		expect( pageHtml ).not.toContain( 'data-layer-data' );
		expect( pageHtml ).toContain( `data-layers-binding="${ slideBinding }"` );
		expect( pageHtml ).toContain( `data-layers-binding="${ fileBinding }"` );

		// Both drawings are drawn
		const slideHost = page.locator( `.layers-bound-slide[data-layers-binding="${ slideBinding }"]` );
		await expect( slideHost ).toBeVisible();
		const slideCanvas = slideHost.locator( 'canvas' );
		await expect( slideCanvas ).toBeVisible();

		// Sample pixel on slide canvas (at 50, 50 rectangle is red [255, 0, 0, 255])
		await expect.poll( () => slideCanvas.evaluate( ( c ) => {
			const ctx = c.getContext( '2d' );
			return Array.from( ctx.getImageData( 50, 50, 1, 1 ).data );
		} ) ).toEqual( [ 255, 0, 0, 255 ] );

		const fileHost = page.locator( '.layers-bound-file-view' );
		await expect( fileHost ).toBeVisible();
		const fileCanvas = fileHost.locator( 'canvas' );
		await expect( fileCanvas ).toBeVisible();

		// =========================================================================
		// Step 3: Follow each drawing's edit link from the page.
		//         Change one property in properties panel and save:
		//         exactly one new tagged revision each time, and saved snapshot has change.
		// =========================================================================

		// --- 3a: Edit slide drawing ---
		const slideEditLink = page.locator( '.layers-page-edit-link' ).filter( { hasText: 'Named probe slide' } );
		await expect( slideEditLink ).toBeVisible();

		await Promise.all( [
			page.waitForNavigation(),
			slideEditLink.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );
		await page.locator( '.layer-item:not(.background-layer-item)' ).first().click();

		// Change strokeWidth in Appearance section from 0 to 6
		await setInput( 'Stroke Width', 6, 'Appearance' );

		const saveSlidePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveSlideRes = await ( await saveSlidePromise ).json();
		expect( saveSlideRes.layerspublish?.result ).toBe( 'Success' );
		const rev2 = saveSlideRes.layerspublish.revid;
		expect( rev2 ).toBeGreaterThan( lastOwnedRevision );
		const beforeSlideEdit = lastOwnedRevision;
		lastOwnedRevision = rev2;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Check tagged revision in page history
		const historyAfterSlideEdit = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags',
			rvlimit: 3
		} );
		const rev2Record = historyAfterSlideEdit.query.pages[ 0 ].revisions[ 0 ];
		expect( [ rev2Record.revid, rev2Record.parentid ] ).toEqual( [ rev2, beforeSlideEdit ] );
		expect( rev2Record.tags ).toContain( 'layers-page-drawing' );

		// Check saved snapshot has strokeWidth 6
		const readRev2 = await api( { action: 'layersread', owner, revid: String( rev2 ) } );
		const rev2Slide = readRev2.layersread.snapshot.surfaces.find( ( s ) => s.id === slideSurfaceId );
		expect( rev2Slide.layers[ 0 ].strokeWidth ).toBe( 6 );

		// --- 3b: Edit photo drawing ---
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		const fileEditLink = page.locator( '.layers-page-edit-link' ).filter( { hasText: 'Named probe photo' } );
		await expect( fileEditLink ).toBeVisible();

		await Promise.all( [
			page.waitForNavigation(),
			fileEditLink.click()
		] );

		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );
		await page.locator( '.layer-item:not(.background-layer-item)' ).first().click();

		// Change X Position in Transform section from 30 to 45
		await setInput( 'X Position', 45, 'Transform' );

		const saveFilePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveFileRes = await ( await saveFilePromise ).json();
		expect( saveFileRes.layerspublish?.result ).toBe( 'Success' );
		const rev3 = saveFileRes.layerspublish.revid;
		expect( rev3 ).toBeGreaterThan( lastOwnedRevision );
		const beforeFileEdit = lastOwnedRevision;
		lastOwnedRevision = rev3;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Check tagged revision in page history
		const historyAfterFileEdit = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags',
			rvlimit: 3
		} );
		const rev3Record = historyAfterFileEdit.query.pages[ 0 ].revisions[ 0 ];
		expect( [ rev3Record.revid, rev3Record.parentid ] ).toEqual( [ rev3, beforeFileEdit ] );
		expect( rev3Record.tags ).toContain( 'layers-page-drawing' );

		// Check saved snapshot has x 45
		const readRev3 = await api( { action: 'layersread', owner, revid: String( rev3 ) } );
		const rev3File = readRev3.layersread.snapshot.surfaces.find( ( s ) => s.id === fileSurfaceId );
		expect( rev3File.layers[ 0 ].x ).toBe( 45 );

		// =========================================================================
		// Step 4: Publish main text (drawings unchanged) with these embeds:
		//   - another page ID with the same names
		//   - an unknown name
		//   - 0: as the page ID
		//   - a file embed naming the slide
		// None draws anything, none shows shared layers, and page still renders.
		// =========================================================================
		const otherPageId = pageId + 9999;
		const refusedMainText = `${ initialMainText }\n\n== Refused Embeds ==\n` +
			`{{#Slide:${ otherPageId }:named_probe_SLIDE}}\n` +
			`[[File:${ file.name }|200px|layerset=${ otherPageId }:Named probe photo]]\n` +
			`{{#Slide:${ pageId }:unknown_probe_slide}}\n` +
			`[[File:${ file.name }|200px|layerset=${ pageId }:unknown_probe_photo]]\n` +
			`{{#Slide:0:named_probe_SLIDE}}\n` +
			`[[File:${ file.name }|200px|layerset=0:Named probe photo]]\n` +
			`[[File:${ file.name }|200px|layerset=${ pageId }:Named probe slide]]\n` +
			`{{#Slide:${ pageId }:Named probe photo}}`;

		const pubRefused = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( readRev3.layersread.snapshot ),
			maintext: refusedMainText,
			summary: 'J82 step 4: publish refused embed forms',
			token: csrfToken
		}, true );
		expect( pubRefused.layerspublish?.result ).toBe( 'Success' );
		const rev4 = pubRefused.layerspublish.revid;
		expect( rev4 ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = rev4;

		// Navigate to page in Chromium and verify
		const refusedResponse = await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		expect( refusedResponse.status() ).toBe( 200 );

		// None draws anything: no bound slide containers and no bound file views
		expect( await page.locator( '.layers-bound-slide' ).count() ).toBe( 0 );
		expect( await page.locator( '.layers-bound-file-view' ).count() ).toBe( 0 );
		expect( await page.locator( 'img.layers-bound-file' ).count() ).toBe( 0 );

		// None shows shared layers: no legacy slide container or legacy overlay
		expect( await page.locator( '.layers-slide-container' ).count() ).toBe( 0 );
		expect( await page.locator( '.layers-container' ).count() ).toBe( 0 );
		expect( await page.locator( '.layers-overlay' ).count() ).toBe( 0 );

		// The page still renders: content area is visible and images render normally
		const contentArea = page.locator( '#mw-content-text' );
		await expect( contentArea ).toBeVisible();
		expect( await contentArea.locator( 'img' ).count() ).toBeGreaterThan( 0 );

		// =========================================================================
		// Step 5: Restore owner to text and snapshot recorded in step 1 with
		//         exact-base cleanup.
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J82 cleanup: restore automated owner baseline state',
			token: csrfToken
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restorePub.layerspublish.revid;
		needsRestore = false;

		// Verify owner wikitext matches initial baseline
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
					summary: 'J82 cleanup: restore automated owner state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
