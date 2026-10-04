/* eslint-env node */
/**
 * J98 Acceptance: Search, PDF pages and galleries after migration
 * Advances: TYPES-2, TYPES-4 and HIST-8.
 *
 * Proves in real Chromium on the test wiki (http://localhost:8080) that:
 * 1. Search: A page-owned drawing's text containing a nonce word is indexed,
 *    found via Special:Search (fulltext=1&ns0=1), and displays drawing text
 *    as snippet with .searchmatch. When baseline is restored, search clears.
 * 2. PDF page: On the owner page, embed [[File:Layers migration fixture B.pdf|page=2|layerset=Page two notes]].
 *    Follow "Create layer set", draw a shape and save. The page paints it
 *    over the rendition of page 2 (not page 1), and layersread gives the surface
 *    a source for page 2. An earlier revision from history does not show the drawing.
 *    Editor page navigation is absent (pinned to page 2).
 * 3. Galleries: With that drawing and one for B010.jpg named "Gallery notes",
 *    <gallery> lines: File:B010.jpg|layerset=Gallery notes|Named,
 *    File:B010.jpg|Unnamed, and File:B020.jpg|No drawing.
 *    Each painted image's canvas is checked against drawing pixels, and no caption
 *    shows layerset=. Adding [[Category:Layers browser gallery]] shows a category page
 *    where galleries show plain images with no canvas mounted.
 * 4. Exact-base CAS cleanup restores baseline wikitext and initial snapshot.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const { isWikiMigrated } = require( './helpers/migration' );

test.describe.configure( { mode: 'serial' } );

test( 'search, PDF pages and galleries after migration (TYPES-2, TYPES-4, HIST-8)', async ( { page, context } ) => {
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
		lgtoken: loginToken,
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
		rvslots: 'main',
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
	const baselineTitleLayer = initialSnapshot.surfaces[ 0 ].layers.find( ( l ) => l.id === 'title' );
	expect( baselineTitleLayer ).toBeDefined();
	expect( baselineTitleLayer.x ).toBe( 99 );
	expect( baselineTitleLayer.y ).toBe( 60 );

	let lastOwnedRevision = initialRevId;
	let needsRestore = false;

	await page.setViewportSize( { width: 1920, height: 1080 } );

	const clearDrafts = async () => {
		await page.evaluate( () => {
			if ( typeof localStorage !== 'undefined' ) {
				localStorage.clear();
			}
		} );
	};

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

	const canvasToClient = async ( x, y ) => {
		const canvas = page.locator( '.layers-canvas' );
		const box = await canvas.boundingBox();
		return {
			x: box.x + x * ( box.width / 800 ),
			y: box.y + y * ( box.height / 600 ),
		};
	};

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

	const drawRectangle = async ( startX = 60, startY = 60, endX = 220, endY = 160 ) => {
		await selectToolbarTool( 'rectangle', 'shapes' );
		await drawDrag( startX, startY, endX, endY );
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );
	};

	// Generate a letters-only random nonce word of at least 14 characters
	const randomWord = ( prefix ) => {
		const chars = 'abcdefghijklmnopqrstuvwxyz';
		let res = prefix;
		while ( res.length < 16 ) {
			res += chars.charAt( Math.floor( Math.random() * chars.length ) );
		}
		return res;
	};

	// The bound canvas holds the image as well, so "drawn pixels" must be the layer's own stroke:
	// share of samples along the rectangle's top edge (or a control line above it) in the stroke colour.
	const strokeShare = ( canvasLocator, surface, layer, above ) => canvasLocator.evaluate( ( c, args ) => {
		const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec( args.stroke );
		const want = hex ? [ 1, 2, 3 ].map( ( i ) => parseInt( hex[ i ], 16 ) ) : [ 0, 0, 0 ];
		const scale = c.width / args.canvasWidth;
		const y = Math.round( ( args.layer.y - ( args.above ? args.layer.height * 0.15 : 0 ) ) * scale );
		const band = Math.max( 2, Math.round( ( args.layer.strokeWidth || 2 ) * scale ) );
		const data = c.getContext( '2d' ).getImageData( 0, Math.max( 0, y - band ), c.width, 2 * band + 1 ).data;
		let samples = 0;
		let hits = 0;
		for ( let x = Math.round( ( args.layer.x + args.layer.width * 0.2 ) * scale );
			x < ( args.layer.x + args.layer.width * 0.8 ) * scale; x += 4 ) {
			samples++;
			for ( let row = 0; row < 2 * band + 1; row++ ) {
				const i = ( row * c.width + x ) * 4;
				if ( Math.abs( data[ i ] - want[ 0 ] ) + Math.abs( data[ i + 1 ] - want[ 1 ] ) + Math.abs( data[ i + 2 ] - want[ 2 ] ) < 90 ) {
					hits++;
					break;
				}
			}
		}
		return samples ? hits / samples : 0;
	}, {
		stroke: layer.stroke || layer.color || '#000000',
		canvasWidth: surface.canvas.width,
		layer: { x: layer.x, y: layer.y, width: layer.width, height: layer.height, strokeWidth: layer.strokeWidth },
		above
	} );
	const expectStroke = async ( canvasLocator, surface ) => {
		const layer = surface.layers.find( ( l ) => l.type === 'rectangle' );
		expect( layer, 'the surface holds the drawn rectangle' ).toBeDefined();
		await expect.poll( () => strokeShare( canvasLocator, surface, layer, false ), { timeout: 15000 } ).toBeGreaterThanOrEqual( 0.9 );
		expect( await strokeShare( canvasLocator, surface, layer, true ) ).toBeLessThan( 0.5 );
	};

	const searchWord = randomWord( 'layersacceptance' );
	expect( /^[a-z]+$/.test( searchWord ) ).toBe( true );
	expect( searchWord.length ).toBeGreaterThanOrEqual( 14 );

	// Poll job queue stats until pending jobs count reaches 0
	const waitForJobQueue = async ( maxWaitMs = 15000 ) => {
		const start = Date.now();
		while ( Date.now() - start < maxWaitMs ) {
			const stats = await api( { action: 'query', meta: 'siteinfo', siprop: 'statistics' } );
			const jobs = stats?.query?.statistics?.jobs;
			if ( typeof jobs === 'number' && jobs === 0 ) {
				return Number( ( ( Date.now() - start ) / 1000 ).toFixed( 1 ) );
			}
			await page.waitForTimeout( 500 );
		}
		return Number( ( ( Date.now() - start ) / 1000 ).toFixed( 1 ) );
	};

	// Poll Special:Search in Chromium until result matches expectation or clears
	const searchUntil = async ( word, targetTitle, expectFound = true, maxWaitMs = 60000 ) => {
		const startTime = Date.now();
		const searchUrl = `${ base }/index.php?title=Special:Search&search=${ encodeURIComponent( word ) }&fulltext=1&ns0=1`;
		while ( Date.now() - startTime < maxWaitMs ) {
			await page.goto( searchUrl );
			await expect( page.locator( '.searchresults' ) ).toHaveCount( 1 );
			const results = page.locator( '.mw-search-result' );
			const count = await results.count();
			let foundTarget = null;
			for ( let i = 0; i < count; i++ ) {
				const item = results.nth( i );
				const heading = await item.locator( '.mw-search-result-heading a' ).textContent();
				const cleanHeading = heading ? heading.trim().replace( /_/g, ' ' ) : '';
				if ( cleanHeading === targetTitle.replace( /_/g, ' ' ) ) {
					foundTarget = item;
					break;
				}
			}
			if ( expectFound && foundTarget ) {
				const elapsedSeconds = Number( ( ( Date.now() - startTime ) / 1000 ).toFixed( 1 ) );
				const snippet = ( await foundTarget.locator( '.searchresult' ).allTextContents() ).join( ' ' );
				const highlighted = ( await foundTarget.locator( '.searchresult .searchmatch' ).allTextContents() ).join( ' ' );
				return { found: true, elapsedSeconds, snippet, highlighted, count, item: foundTarget };
			}
			if ( !expectFound && !foundTarget ) {
				const elapsedSeconds = Number( ( ( Date.now() - startTime ) / 1000 ).toFixed( 1 ) );
				return { found: false, elapsedSeconds, count };
			}
			await page.waitForTimeout( 1000 );
		}
		throw new Error( `Timed out waiting for search "${ word }" (expectFound=${ expectFound }, target="${ targetTitle }") after ${ maxWaitMs / 1000 }s` );
	};

	try {
		// =========================================================================
		// Part 1: Search acceptance
		//         1. Verify searchWord is not initially found.
		//         2. Publish revision where drawing text holds searchWord.
		//         3. Wait for job queue and poll Special:Search until page is found.
		//         4. Result shows drawing text as snippet with .searchmatch around word.
		// =========================================================================
		needsRestore = true;

		// Confirm searchWord initially finds 0 results
		await page.goto( `${ base }/index.php?title=Special:Search&search=${ encodeURIComponent( searchWord ) }&fulltext=1&ns0=1` );
		await expect( page.locator( '.searchresults' ) ).toHaveCount( 1 );
		const initialSearchCount = await page.locator( '.mw-search-result' ).count();
		expect( initialSearchCount ).toBe( 0 );

		// Publish revision whose drawing text holds searchWord
		const searchSnapshot = JSON.parse( JSON.stringify( initialSnapshot ) );
		const titleLayer = searchSnapshot.surfaces[ 0 ].layers.find( ( l ) => l.id === 'title' );
		expect( titleLayer ).toBeDefined();
		titleLayer.text = `Visual ideas — 世界 ${ searchWord }`;

		const pubSearch = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( searchSnapshot ),
			maintext: initialMainText,
			summary: `J98 step 1: add search probe word ${ searchWord } to drawing text`,
			token: csrfToken,
		}, true );
		expect( pubSearch.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = pubSearch.layerspublish.revid;
		expect( lastOwnedRevision ).toBeGreaterThan( initialRevId );

		// Wait for job queue, then poll Special:Search
		await waitForJobQueue();
		const searchResult = await searchUntil( searchWord, owner, true, 60000 );
		expect( searchResult.found ).toBe( true );
		expect( searchResult.snippet ).toContain( searchWord );
		expect( searchResult.highlighted ).toContain( searchWord );
		// eslint-disable-next-line no-console
		console.log( `[J98] Search indexed drawing text with "${ searchWord }" in ${ searchResult.elapsedSeconds }s` );

		// =========================================================================
		// Part 2: PDF page drawing acceptance
		//         1. On owner page embed [[File:Layers migration fixture B.pdf|page=2|layerset=Page two notes]]
		//         2. Follow "Create layer set: Page two notes", draw rectangle and save.
		//         3. Page paints it over rendition of page 2 (not page 1).
		//         4. layersread gives surface a source for page 2.
		//         5. Earlier revision of owner page from history does not show drawing.
		//         6. Editor refuses / does not expose page navigation controls.
		// =========================================================================
		const pdfEmbedText = `${ initialMainText }\n\n` +
			`[[File:Layers migration fixture B.pdf|page=2|layerset=Page two notes]]`;

		const pubPdfEmbed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( searchSnapshot ),
			maintext: pdfEmbedText,
			summary: 'J98 step 2: embed fixture B PDF page 2 for drawing creation',
			token: csrfToken,
		}, true );
		expect( pubPdfEmbed.layerspublish?.result ).toBe( 'Success' );
		const revPdfEmbed = pubPdfEmbed.layerspublish.revid;
		lastOwnedRevision = revPdfEmbed;

		// Navigate to page view and locate "Create layer set: Page two notes"
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await page.waitForLoadState( 'networkidle' );
		await clearDrafts();

		const createPdfLink = page.locator( '.layers-page-edit-link', { hasText: 'Create layer set: Page two notes' } );
		await expect( createPdfLink ).toBeVisible();

		// Open editor from the link
		await Promise.all( [
			page.waitForNavigation(),
			createPdfLink.click(),
		] );

		await page.waitForSelector( '.layers-canvas' );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Layer set: Page two notes' );

		// Editor check on PDF page:
		// Page navigation group is absent (session is strictly pinned to page 2)
		const pageNavGroup = page.locator( '.page-nav-group' );
		await expect( pageNavGroup ).toHaveCount( 0 );

		// Background image is loaded and targets page 2
		await page.waitForFunction( () => {
			const cm = window.layersEditorInstance?.canvasManager;
			return cm && cm.backgroundImage && cm.backgroundImage.complete && cm.backgroundImage.naturalWidth > 0;
		} );
		const bgSrc = await page.evaluate( () => window.layersEditorInstance?.canvasManager?.backgroundImage?.src || '' );
		expect( bgSrc ).toContain( 'page2-' );
		expect( bgSrc ).not.toContain( 'page1-' );

		// Draw one rectangle on the PDF page
		await drawRectangle( 60, 60, 220, 160 );

		// Save PDF page drawing
		const saveBtn = page.locator( '.save-button' );
		await expect( saveBtn ).toBeVisible();
		const savePdfPromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await saveBtn.click();
		const savePdfResp = await savePdfPromise;
		expect( savePdfResp.ok() ).toBe( true );
		const savePdfJson = await savePdfResp.json();
		expect( savePdfJson.layerspublish?.result ).toBe( 'Success' );
		const revPdfSaved = savePdfJson.layerspublish.revid;
		expect( revPdfSaved ).toBeGreaterThan( revPdfEmbed );
		lastOwnedRevision = revPdfSaved;
		await page.waitForFunction( () => !window.layersEditorInstance?.hasUnsavedChanges() );

		// Verify on page view: painted over rendition of page 2 (not page 1)
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await page.waitForLoadState( 'networkidle' );

		const pdfLink = page.locator( 'a[href*="Layers_migration_fixture_B.pdf"]' );
		await expect( pdfLink ).toBeVisible();
		const pdfHref = await pdfLink.getAttribute( 'href' );
		expect( pdfHref ).toContain( 'page=2' );
		expect( pdfHref ).not.toContain( 'page=1' );

		const pdfHost = pdfLink.locator( '.layers-bound-file-view' );
		await expect( pdfHost ).toBeVisible();
		const pdfCanvas = pdfHost.locator( 'canvas' );
		await expect( pdfCanvas ).toBeVisible();

		// layersread gives the surface a source for page 2
		const readPdfData = await api( { action: 'layersread', owner, revid: String( revPdfSaved ) } );
		const pdfSnapshot = readPdfData.layersread.snapshot;
		const pdfSurface = pdfSnapshot.surfaces.find( ( s ) => s.label === 'Page two notes' );
		expect( pdfSurface ).toBeDefined();
		expect( pdfSurface.kind ).toBe( 'pdf' );
		expect( pdfSurface.source.fileTitle.replace( /_/g, ' ' ) ).toBe( 'File:Layers migration fixture B.pdf' );
		expect( pdfSurface.source.page ).toBe( 2 );
		await expectStroke( pdfCanvas, pdfSurface );

		const pdfRendition = readPdfData.layersread.sourceRenditions?.[ pdfSurface.id ]?.url || '';
		expect( pdfRendition ).toContain( 'page2-' );
		expect( pdfRendition ).not.toContain( 'page1-' );

		// Open an earlier revision from history: does not show the drawing
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&oldid=${ revPdfEmbed }` );
		await page.waitForLoadState( 'networkidle' );
		await expect( page.locator( 'a[href*="Layers_migration_fixture_B.pdf"]' ) ).toBeVisible();
		await expect( page.locator( '.layers-bound-file-view canvas' ) ).toHaveCount( 0 );

		// =========================================================================
		// Part 3: Galleries acceptance
		//         1. Add drawing on B010.jpg named "Gallery notes".
		//         2. Add <gallery> lines:
		//            File:B010.jpg|layerset=Gallery notes|Named
		//            File:B010.jpg|Unnamed
		//            File:B020.jpg|No drawing
		//         3. Check each image's canvas against drawing pixels (J65 comparison)
		//            and that no caption shows layerset=.
		//         4. Add [[Category:Layers browser gallery]] to page, open category page,
		//            and check that its gallery shows plain images with no canvas.
		// =========================================================================
		// First embed B010.jpg to create "Gallery notes"
		const embedWithB010Text = `${ pdfEmbedText }\n\n` +
			`[[File:B010.jpg|layerset=Gallery notes]]`;

		const pubB010Embed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( pdfSnapshot ),
			maintext: embedWithB010Text,
			summary: 'J98 step 3: embed B010.jpg to create Gallery notes',
			token: csrfToken,
		}, true );
		expect( pubB010Embed.layerspublish?.result ).toBe( 'Success' );
		const revB010Embed = pubB010Embed.layerspublish.revid;
		lastOwnedRevision = revB010Embed;

		// Navigate to page view and follow "Create layer set: Gallery notes"
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await page.waitForLoadState( 'networkidle' );
		await clearDrafts();

		const createImgLink = page.locator( '.layers-page-edit-link', { hasText: 'Create layer set: Gallery notes' } );
		await expect( createImgLink ).toBeVisible();

		await Promise.all( [
			page.waitForNavigation(),
			createImgLink.click(),
		] );

		await page.waitForSelector( '.layers-canvas' );
		await expect( page.locator( '.layers-page-drawing-name-text' ) ).toHaveText( 'Layer set: Gallery notes' );

		// Wait for image background to load
		await page.waitForFunction( () => {
			const cm = window.layersEditorInstance?.canvasManager;
			return cm && cm.backgroundImage && cm.backgroundImage.complete && cm.backgroundImage.naturalWidth > 0;
		} );

		// Draw one rectangle for Gallery notes
		await drawRectangle( 60, 60, 240, 180 );

		// Save Gallery notes drawing
		const saveImgPromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		await page.locator( '.save-button' ).click();
		const saveImgResp = await saveImgPromise;
		expect( saveImgResp.ok() ).toBe( true );
		const saveImgJson = await saveImgResp.json();
		expect( saveImgJson.layerspublish?.result ).toBe( 'Success' );
		const revImgSaved = saveImgJson.layerspublish.revid;
		expect( revImgSaved ).toBeGreaterThan( revB010Embed );
		lastOwnedRevision = revImgSaved;
		await page.waitForFunction( () => !window.layersEditorInstance?.hasUnsavedChanges() );

		// Read current snapshot containing Welcome Slide, Page two notes, and Gallery notes
		const readFullData = await api( { action: 'layersread', owner, revid: String( revImgSaved ) } );
		const fullSnapshot = readFullData.layersread.snapshot;
		expect( fullSnapshot.surfaces.length ).toBe( 3 );
		expect( fullSnapshot.surfaces.map( ( s ) => s.label ) )
			.toEqual( [ 'Welcome Slide', 'Page two notes', 'Gallery notes' ] );

		// A magenta stroke tells the drawing from the photograph, which may hold any dark colour
		const galleryRect = fullSnapshot.surfaces[ 2 ].layers.find( ( l ) => l.type === 'rectangle' );
		expect( galleryRect ).toBeDefined();
		galleryRect.stroke = '#ff00ff';
		galleryRect.strokeWidth = 8;

		// Now publish wikitext with <gallery> lines and [[Category:Layers browser gallery]]
		const galleryWikitext = `${ initialMainText }\n\n` +
			`[[File:Layers migration fixture B.pdf|page=2|layerset=Page two notes]]\n\n` +
			`<gallery>\n` +
			`File:B010.jpg|layerset=Gallery notes|Named\n` +
			`File:B010.jpg|Unnamed\n` +
			`File:B020.jpg|No drawing\n` +
			`</gallery>\n\n` +
			`[[Category:Layers browser gallery]]`;

		const pubGallery = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( fullSnapshot ),
			maintext: galleryWikitext,
			summary: 'J98 step 3: add gallery and category for gallery acceptance',
			token: csrfToken,
		}, true );
		expect( pubGallery.layerspublish?.result ).toBe( 'Success' );
		const revGallery = pubGallery.layerspublish.revid;
		expect( revGallery ).toBeGreaterThan( revImgSaved );
		lastOwnedRevision = revGallery;

		// Check gallery on owner page view
		await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
		await page.waitForLoadState( 'networkidle' );

		const gallery = page.locator( '.gallery' );
		await expect( gallery ).toBeVisible();
		const boxes = gallery.locator( 'li.gallerybox' );
		await expect( boxes ).toHaveCount( 3 );

		// Box 1: File:B010.jpg|layerset=Gallery notes|Named
		const box1 = boxes.nth( 0 );
		const host1 = box1.locator( '.layers-bound-file-view' );
		await expect( host1 ).toBeVisible();
		const canvas1 = host1.locator( 'canvas' );
		await expect( canvas1 ).toBeVisible();
		const caption1 = ( await box1.locator( '.gallerytext' ).textContent() ).trim();
		expect( caption1 ).toBe( 'Named' );
		expect( caption1 ).not.toContain( 'layerset=' );

		// Box 2: File:B010.jpg|Unnamed (paints same drawing because B010.jpg has one drawing on page)
		const box2 = boxes.nth( 1 );
		const host2 = box2.locator( '.layers-bound-file-view' );
		await expect( host2 ).toBeVisible();
		const canvas2 = host2.locator( 'canvas' );
		await expect( canvas2 ).toBeVisible();
		const caption2 = ( await box2.locator( '.gallerytext' ).textContent() ).trim();
		expect( caption2 ).toBe( 'Unnamed' );
		expect( caption2 ).not.toContain( 'layerset=' );

		// Box 3: File:B020.jpg|No drawing (plain image, no canvas)
		const box3 = boxes.nth( 2 );
		await expect( box3.locator( '.layers-bound-file-view' ) ).toHaveCount( 0 );
		await expect( box3.locator( 'canvas' ) ).toHaveCount( 0 );
		await expect( box3.locator( 'img' ) ).toBeVisible();
		const caption3 = ( await box3.locator( '.gallerytext' ).textContent() ).trim();
		expect( caption3 ).toBe( 'No drawing' );
		expect( caption3 ).not.toContain( 'layerset=' );

		// Both B010.jpg images carry the drawing's own stroke, and B020.jpg has no canvas
		await expectStroke( canvas1, fullSnapshot.surfaces[ 2 ] );
		await expectStroke( canvas2, fullSnapshot.surfaces[ 2 ] );

		// Compare canvas 1 and canvas 2 pixels: both paint the exact same drawing on B010.jpg
		const pixels1 = await canvas1.evaluate( ( c ) => Array.from( c.getContext( '2d' ).getImageData( 0, 0, c.width, c.height ).data ) );
		const pixels2 = await canvas2.evaluate( ( c ) => Array.from( c.getContext( '2d' ).getImageData( 0, 0, c.width, c.height ).data ) );
		expect( pixels1.length ).toBe( pixels2.length );
		let diffPixelCount = 0;
		for ( let i = 0; i < pixels1.length; i += 4 ) {
			if ( Math.abs( pixels1[ i ] - pixels2[ i ] ) > 10 ||
				Math.abs( pixels1[ i + 1 ] - pixels2[ i + 1 ] ) > 10 ||
				Math.abs( pixels1[ i + 2 ] - pixels2[ i + 2 ] ) > 10 ) {
				diffPixelCount++;
			}
		}
		const diffRatio = diffPixelCount / ( pixels1.length / 4 );
		expect( diffRatio ).toBeLessThanOrEqual( 0.05 );

		// Category page verification: open Category:Layers browser gallery
		await page.goto( `${ base }/index.php?title=Category:Layers_browser_gallery` );
		await page.waitForLoadState( 'networkidle' );

		// Category page gallery/thumbnails must show plain images with no canvas mounted
		await expect( page.locator( 'canvas' ) ).toHaveCount( 0 );
		await expect( page.locator( '.layers-bound-file-view' ) ).toHaveCount( 0 );
		await expect( page.locator( '#mw-pages' ) ).toContainText( 'Layers browser acceptance' );

		// A gallery rendered outside any page parse shows no annotations either
		await page.goto( `${ base }/index.php?title=Special:NewFiles&limit=100` );
		await page.waitForLoadState( 'networkidle' );
		await expect( page.locator( '.gallerybox a[href*="B010.jpg"] img' ).first() ).toBeVisible();
		await expect( page.locator( 'canvas' ) ).toHaveCount( 0 );
		await expect( page.locator( '.layers-thumbnail, [data-layer-data], [data-layers-binding]' ) ).toHaveCount( 0 );

		// =========================================================================
		// Part 4: Restore baseline and verify search clears
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J98 step 4: restore baseline after search, PDF and gallery acceptance',
			token: csrfToken,
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restorePub.layerspublish.revid;
		needsRestore = false;

		// Verify search index clears the probe word after baseline restoration
		await waitForJobQueue();
		const clearedSearchResult = await searchUntil( searchWord, owner, false, 60000 );
		expect( clearedSearchResult.found ).toBe( false );
		// eslint-disable-next-line no-console
		console.log( `[J98] Search cleared probe word "${ searchWord }" from index in ${ clearedSearchResult.elapsedSeconds }s` );
	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J98 cleanup: restore baseline in finally',
					token: csrfToken,
				}, true );
			} catch ( _err ) {
				// cleanup best effort
			}
		}
	}
} );
