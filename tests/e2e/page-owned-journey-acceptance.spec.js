/* eslint-env node */
/**
 * J65 end-to-end adoption-to-history browser acceptance:
 * Exercises ordinary slide, image, and PDF page two workflows end-to-end in real Chromium
 * on the original test wiki (http://localhost:8080). Verifies adoption and edit history tagging,
 * pixel checks across oldid and current revisions, rendition URL preservation, and cross-page isolation.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'adoption-to-history journeys verify slide, image, pdf page two, and cross-page isolation', async ( { page, context } ) => {
	test.setTimeout( 180000 );
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
	const isolationOwner = 'Layers_browser_acceptance_isolation';

	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// 1. Authenticate as the QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	// 2. Ten-minute rule: verify owner has not changed in the last 10 minutes
	const siteGeneral = ( await api( { action: 'query', meta: 'siteinfo', siprop: 'general' } ) ).query.general;
	const serverTime = new Date( siteGeneral.time ).getTime();

	const latest = async () => {
		const record = ( await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|timestamp|user|content|tags',
			rvslots: 'main'
		} ) ).query.pages[ 0 ];
		return {
			pageId: record.pageid,
			revision: record.revisions[ 0 ].revid,
			timestamp: record.revisions[ 0 ].timestamp,
			user: record.revisions[ 0 ].user,
			text: record.revisions[ 0 ].slots.main.content,
			tags: record.revisions[ 0 ].tags
		};
	};

	const initial = await latest();
	const diffMinutes = ( serverTime - new Date( initial.timestamp ).getTime() ) / 60000;
	// A finished cleanup by this account (original text restored) is not someone else's work in progress.
	// Worker processes do not see the command line, so this cannot depend on how the run was started.
	const isPrecedingTestCleanup = initial.user === config.username &&
		initial.text === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65 wiki rules` );
	}

	const initialSnapshot = ( await api( { action: 'layersread', owner, revid: String( initial.revision ) } ) )
		.layersread.snapshot;

	// 3. Check / record isolation page state
	const isolationQuery = await api( {
		action: 'query',
		prop: 'revisions',
		titles: isolationOwner,
		rvprop: 'ids|content',
		rvslots: 'main'
	} );
	const isolationPage = isolationQuery.query.pages[ 0 ];
	const isolationExisted = !isolationPage.missing;
	const isolationInitialText = isolationExisted ?
		isolationPage.revisions[ 0 ].slots.main.content :
		'Dedicated automated Layers isolation page.';

	// 4. Locate image fixture (first JPEG/PNG)
	const imageFiles = ( await api( {
		action: 'query',
		list: 'allimages',
		aimime: 'image/jpeg|image/png',
		ailimit: 1,
		aiprop: 'timestamp|sha1|size'
	} ) ).query.allimages;
	test.skip( !imageFiles.length, 'Requires at least one JPEG or PNG file on the wiki' );
	const imageFile = imageFiles[ 0 ];
	const imgSetName = 'j65-image-journey';

	// 5. Locate PDF fixture with at least 2 pages
	const pdfFiles = ( await api( {
		action: 'query',
		list: 'allimages',
		aimime: 'application/pdf',
		ailimit: 5,
		aiprop: 'size'
	} ) ).query.allimages;
	const pdfFile = pdfFiles.find( ( p ) => p.pagecount >= 2 );
	const pdfSetName = pdfFile ? 'j65-pdf-journey-p2' : null;

	// Tracking variables for cleanup
	let lastOwnedRevision = null;
	let publicationPending = false;
	let sharedSlideSaved = false;
	let sharedImageSaved = false;
	let sharedPdfSaved = false;
	let sharedSlideBefore = null;
	let sharedImgBefore = null;
	const slide = 'J65_Slide_Journey';

	try {
		// A. Seed shared slide drawing
		const savedSlide = await api( {
			action: 'layerssave',
			slidename: slide,
			token: csrfToken,
			data: JSON.stringify( {
				canvasWidth: 800,
				canvasHeight: 600,
				backgroundColor: '#ffffff',
				layers: [
					{
						id: 'slide_box',
						type: 'rectangle',
						x: 50,
						y: 50,
						width: 200,
						height: 100,
						fill: '#ff0000',
						stroke: 'none'
					}
				]
			} )
		}, true );
		expect( savedSlide.layerssave?.success ).toBeTruthy();
		sharedSlideSaved = true;
		sharedSlideBefore = ( await api( { action: 'layersinfo', filename: 'Slide:' + slide } ) )
			.layersinfo.layerset;
		expect( sharedSlideBefore ).toBeTruthy();

		// B. Seed shared image drawing
		const savedImage = await api( {
			action: 'layerssave',
			filename: imageFile.name,
			setname: imgSetName,
			token: csrfToken,
			data: JSON.stringify( [
				{
					id: 'img_box',
					type: 'rectangle',
					x: 20,
					y: 20,
					width: 100,
					height: 80,
					fill: '#00c000',
					stroke: 'none'
				}
			] )
		}, true );
		expect( savedImage.layerssave?.success ).toBeTruthy();
		sharedImageSaved = true;
		sharedImgBefore = ( await api( { action: 'layersinfo', filename: imageFile.name, setname: imgSetName } ) )
			.layersinfo.layerset;
		expect( sharedImgBefore ).toBeTruthy();

		// C. Seed shared PDF page 2 drawing if multipage PDF available
		if ( pdfFile && pdfSetName ) {
			const savedPdf = await api( {
				action: 'layerssave',
				filename: pdfFile.name,
				setname: pdfSetName,
				page: 2,
				token: csrfToken,
				data: JSON.stringify( [
					{
						id: 'pdf_p2_box',
						type: 'rectangle',
						x: 40,
						y: 40,
						width: 150,
						height: 100,
						fill: '#0000ff',
						stroke: 'none'
					}
				] )
			}, true );
			expect( savedPdf.layerssave?.success ).toBeTruthy();
			sharedPdfSaved = true;
		}

		// D. Embed shared slide and image on isolation page
		const isolationEmbedText = `${ isolationInitialText }\n\n== Shared Embeds ==\n` +
			`{{#Slide:${ slide }|width=400}}\n\n` +
			`[[File:${ imageFile.name }|300px|layerset=${ imgSetName }|Shared photo]]`;
		const editIsolation = await api( {
			action: 'edit',
			title: isolationOwner,
			text: isolationEmbedText,
			summary: 'J65 acceptance: seed isolation embeds',
			token: csrfToken
		}, true );
		expect( editIsolation.edit?.result ).toBe( 'Success' );

		// Helper to verify isolation page integrity
		const assertIsolationIntegrity = async ( stageDesc ) => {
			await page.goto( `${ base }/index.php?title=${ isolationOwner }` );
			await expect( page.locator( '.layers-page-edit-controls' ) ).toHaveCount( 0 );
			await expect( page.locator( '.layers-bound-slide' ) ).toHaveCount( 0 );
			await expect( page.locator( '.layers-bound-file-view' ) ).toHaveCount( 0 );
			await expect( page.locator( '.layers-slide-container' ) ).toHaveCount( 1 );

			const currentSlideInfo = ( await api( { action: 'layersinfo', filename: 'Slide:' + slide } ) )
				.layersinfo.layerset;
			expect( [ currentSlideInfo.id, currentSlideInfo.revision ],
				`Shared slide layersinfo unchanged at ${ stageDesc }` )
				.toEqual( [ sharedSlideBefore.id, sharedSlideBefore.revision ] );

			const currentImgInfo = ( await api( { action: 'layersinfo', filename: imageFile.name, setname: imgSetName } ) )
				.layersinfo.layerset;
			expect( [ currentImgInfo.id, currentImgInfo.revision ],
				`Shared image layersinfo unchanged at ${ stageDesc }` )
				.toEqual( [ sharedImgBefore.id, sharedImgBefore.revision ] );
		};

		// Initial isolation verification
		await assertIsolationIntegrity( 'before owner adoption' );

		// ==========================================
		// JOURNEY 1: Slide Adoption and Editing
		// ==========================================
		const slideEmbed = `{{#Slide:${ slide }|width=400}}`;
		publicationPending = true;
		const seededSlide = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initial.revision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: `${ initial.text }\n\n${ slideEmbed }`,
			summary: 'J65: seed shared slide on owner',
			token: csrfToken
		}, true );
		expect( seededSlide.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = seededSlide.layerspublish.revid;
		publicationPending = false;

		// Adopt slide from page link
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const slideAdoptLink = page.locator( '.layers-page-adopt-link' );
		await expect( slideAdoptLink ).toHaveCount( 1 );
		await expect( slideAdoptLink ).toContainText( slide );
		await slideAdoptLink.click();

		await expect( page.locator( '#mw-content-text' ) ).toContainText( slide );
		publicationPending = true;
		await Promise.all( [
			page.waitForURL( ( u ) => u.searchParams.get( 'title' ) === owner || u.pathname.endsWith( '/' + owner ) ),
			page.locator( '.mw-htmlform-submit button, button[type=submit]' ).first().click()
		] );
		const adoptedSlideRecord = await latest();
		expect( adoptedSlideRecord.revision ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = adoptedSlideRecord.revision;
		const slideAdoptionRevId = adoptedSlideRecord.revision;
		publicationPending = false;

		// Verify isolation after slide adoption
		await assertIsolationIntegrity( 'after slide adoption' );

		// Open slide from page edit link and edit
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const slideEditLink = page.locator( '.layers-page-edit-link' );
		await expect( slideEditLink ).toHaveCount( 1 );
		await Promise.all( [ page.waitForNavigation(), slideEditLink.click() ] );
		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 );

		const preEditLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		await page.locator( '.layer-item:not(.background-layer-item) .layer-grab-area' ).first().click();
		await page.keyboard.press( 'ArrowRight' );
		const editedSlideLayers = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
		expect( editedSlideLayers[ 0 ].x ).toBe( preEditLayers[ 0 ].x + 1 );

		const slideSavePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		publicationPending = true;
		await page.locator( '.save-button' ).click();
		const slideSaveRes = await ( await slideSavePromise ).json();
		expect( slideSaveRes.layerspublish?.result ).toBe( 'Success' );
		const slideEditRevId = slideSaveRes.layerspublish.revid;
		lastOwnedRevision = slideEditRevId;
		publicationPending = false;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Check page history: both adoption and edit are tagged layers-page-drawing
		const slideHistoryQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags',
			rvlimit: 5
		} );
		const slideRevs = slideHistoryQuery.query.pages[ 0 ].revisions;
		const slideAdoptEntry = slideRevs.find( ( r ) => r.revid === slideAdoptionRevId );
		const slideEditEntry = slideRevs.find( ( r ) => r.revid === slideEditRevId );
		expect( slideAdoptEntry.tags ).toContain( 'layers-page-drawing' );
		expect( slideEditEntry.tags ).toContain( 'layers-page-drawing' );

		// Pixel checks: oldid draws pre-edit layer, current page draws edited layer
		await page.goto( `${ base }/index.php?title=${ owner }&oldid=${ slideAdoptionRevId }` );
		const oldSlideCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await expect( oldSlideCanvas ).toBeVisible();
		// At (50, 55), pre-edit rectangle (x: 50) is red
		await expect.poll( () => oldSlideCanvas.evaluate( ( c ) =>
			Array.from( c.getContext( '2d' ).getImageData( 50, 55, 1, 1 ).data ) ) ).toEqual( [ 255, 0, 0, 255 ] );

		await page.goto( `${ base }/index.php?title=${ owner }` );
		const currentSlideCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await expect( currentSlideCanvas ).toBeVisible();
		// At (50, 55), post-edit (x: 51) is no longer red
		await expect.poll( () => currentSlideCanvas.evaluate( ( c ) =>
			Array.from( c.getContext( '2d' ).getImageData( 50, 55, 1, 1 ).data ) ) ).not.toEqual( [ 255, 0, 0, 255 ] );
		// At (51, 55), post-edit rectangle is red
		await expect.poll( () => currentSlideCanvas.evaluate( ( c ) =>
			Array.from( c.getContext( '2d' ).getImageData( 51, 55, 1, 1 ).data ) ) ).toEqual( [ 255, 0, 0, 255 ] );

		// Verify isolation after slide edit
		await assertIsolationIntegrity( 'after slide edit' );

		// ==========================================
		// JOURNEY 2: Image Adoption and Editing
		// ==========================================
		const currentOwnerState = await latest();
		const currentSnapshotForImg = ( await api( {
			action: 'layersread',
			owner,
			revid: String( lastOwnedRevision )
		} ) ).layersread.snapshot;

		const imgEmbed = `[[File:${ imageFile.name }|300px|layerset=${ imgSetName }|Shared photo]]`;
		publicationPending = true;
		const seededImg = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( currentSnapshotForImg ),
			maintext: `${ currentOwnerState.text }\n\n${ imgEmbed }`,
			summary: 'J65: seed shared image embed on owner',
			token: csrfToken
		}, true );
		expect( seededImg.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = seededImg.layerspublish.revid;
		publicationPending = false;

		// Adopt image from page link
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const imgAdoptLink = page.locator( '.layers-page-adopt-link' );
		await expect( imgAdoptLink ).toHaveCount( 1 );
		await imgAdoptLink.click();

		await expect( page.locator( '#mw-content-text' ) ).toContainText( imageFile.name.replace( /_/g, ' ' ) );
		publicationPending = true;
		await Promise.all( [
			page.waitForURL( ( u ) => u.searchParams.get( 'title' ) === owner || u.pathname.endsWith( '/' + owner ) ),
			page.locator( '.mw-htmlform-submit button, button[type=submit]' ).first().click()
		] );
		const adoptedImgRecord = await latest();
		expect( adoptedImgRecord.revision ).toBeGreaterThan( lastOwnedRevision );
		lastOwnedRevision = adoptedImgRecord.revision;
		const imgAdoptionRevId = adoptedImgRecord.revision;
		publicationPending = false;

		// Verify isolation after image adoption
		await assertIsolationIntegrity( 'after image adoption' );

		// Open image from page edit link and edit
		await page.goto( `${ base }/index.php?title=${ owner }` );
		const imgEditLink = page.locator( '.layers-page-edit-link' ).filter( { hasText: imageFile.name } );
		await expect( imgEditLink ).toHaveCount( 1 );
		await Promise.all( [ page.waitForNavigation(), imgEditLink.click() ] );
		await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length > 0 &&
			window.layersEditorInstance.canvasManager?.backgroundImage?.complete );

		await page.locator( '.layer-item:not(.background-layer-item) .layer-grab-area' ).first().click();
		await page.keyboard.press( 'ArrowRight' );

		const imgSavePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
			( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
		publicationPending = true;
		await page.locator( '.save-button' ).click();
		const imgSaveRes = await ( await imgSavePromise ).json();
		expect( imgSaveRes.layerspublish?.result ).toBe( 'Success' );
		const imgEditRevId = imgSaveRes.layerspublish.revid;
		lastOwnedRevision = imgEditRevId;
		publicationPending = false;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges() );

		// Check image history tags
		const imgHistoryQuery = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags',
			rvlimit: 5
		} );
		const imgRevs = imgHistoryQuery.query.pages[ 0 ].revisions;
		expect( imgRevs.find( ( r ) => r.revid === imgAdoptionRevId ).tags ).toContain( 'layers-page-drawing' );
		expect( imgRevs.find( ( r ) => r.revid === imgEditRevId ).tags ).toContain( 'layers-page-drawing' );

		// Rendition URL preservation check across oldid
		const escapedImg = imageFile.name.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
		const imgBindingMatch = adoptedImgRecord.text.match( new RegExp( `\\[\\[File:${ escapedImg }\\|.*?layersbinding=(v1:\\d+:[A-Za-z0-9_]+)` ) );
		expect( imgBindingMatch ).not.toBeNull();
		const imgBinding = imgBindingMatch[ 1 ];
		const oldImgBundle = ( await api( {
			action: 'layersread',
			owner,
			revid: String( imgAdoptionRevId ),
			binding: imgBinding
		} ) ).layersread.bindings[ imgBinding ];
		const newImgBundle = ( await api( {
			action: 'layersread',
			owner,
			revid: String( imgEditRevId ),
			binding: imgBinding
		} ) ).layersread.bindings[ imgBinding ];
		expect( oldImgBundle.source.url ).toBe( newImgBundle.source.url );

		// Check oldid view in browser
		await page.goto( `${ base }/index.php?title=${ owner }&oldid=${ imgAdoptionRevId }` );
		const oldImgCanvas = page.locator( 'a .layers-bound-file-view canvas' );
		await expect( oldImgCanvas ).toHaveCount( 1 );
		await expect( oldImgCanvas ).toBeVisible();
		await expect.poll( () => oldImgCanvas.evaluate( ( c ) =>
			Array.from( c.getContext( '2d' ).getImageData( 30, 30, 1, 1 ).data ) ) ).toEqual( [ 0, 192, 0, 255 ] );

		// Verify isolation after image edit
		await assertIsolationIntegrity( 'after image edit' );

		// ==========================================
		// JOURNEY 3: PDF Page Two Adoption
		// ==========================================
		if ( pdfFile && pdfSetName ) {
			const currentForPdf = await latest();
			const currentSnapshotForPdf = ( await api( {
				action: 'layersread',
				owner,
				revid: String( lastOwnedRevision )
			} ) ).layersread.snapshot;

			const pdfEmbed = `[[File:${ pdfFile.name }|page=2|300px|layerset=${ pdfSetName }|PDF Page Two]]`;
			publicationPending = true;
			const seededPdf = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( currentSnapshotForPdf ),
				maintext: `${ currentForPdf.text }\n\n${ pdfEmbed }`,
				summary: 'J65: seed PDF page two embed on owner',
				token: csrfToken
			}, true );
			expect( seededPdf.layerspublish?.result ).toBe( 'Success' );
			lastOwnedRevision = seededPdf.layerspublish.revid;
			publicationPending = false;

			// Adopt PDF page 2 from page link
			await page.goto( `${ base }/index.php?title=${ owner }` );
			const pdfAdoptLink = page.locator( '.layers-page-adopt-link' );
			await expect( pdfAdoptLink ).toHaveCount( 1 );
			await pdfAdoptLink.click();

			await expect( page.locator( '#mw-content-text' ) ).toContainText( pdfFile.name.replace( /_/g, ' ' ) );
			publicationPending = true;
			await Promise.all( [
				page.waitForURL( ( u ) => u.searchParams.get( 'title' ) === owner || u.pathname.endsWith( '/' + owner ) ),
				page.locator( '.mw-htmlform-submit button, button[type=submit]' ).first().click()
			] );
			const adoptedPdfRecord = await latest();
			expect( adoptedPdfRecord.revision ).toBeGreaterThan( lastOwnedRevision );
			lastOwnedRevision = adoptedPdfRecord.revision;
			const pdfAdoptionRevId = adoptedPdfRecord.revision;
			publicationPending = false;

			// Check canvas aspect matches page two and drawing is over page two's rendition
			await page.goto( `${ base }/index.php?title=${ owner }` );
			const pdfHost = page.locator( 'a .layers-bound-file-view' ).last();
			const pdfCanvas = pdfHost.locator( 'canvas' );
			await expect( pdfCanvas ).toBeVisible();
			const canvasWidth = parseInt( await pdfCanvas.getAttribute( 'width' ), 10 );
			const canvasHeight = parseInt( await pdfCanvas.getAttribute( 'height' ), 10 );
			expect( canvasWidth ).toBeGreaterThan( 0 );
			expect( canvasHeight ).toBeGreaterThan( 0 );
			const aspect = canvasWidth / canvasHeight;
			expect( aspect ).toBeGreaterThan( 0.5 );
			expect( aspect ).toBeLessThan( 2.0 );

			const escapedPdf = pdfFile.name.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
			const pdfBindingMatch = adoptedPdfRecord.text.match( new RegExp( `\\[\\[File:${ escapedPdf }\\|.*?layersbinding=(v1:\\d+:[A-Za-z0-9_]+)` ) );
			expect( pdfBindingMatch ).not.toBeNull();
			const pdfBinding = pdfBindingMatch[ 1 ];
			const pdfRead = await api( {
				action: 'layersread',
				owner,
				revid: String( pdfAdoptionRevId ),
				binding: pdfBinding
			} );
			const pdfBundle = pdfRead.layersread.bindings[ pdfBinding ];
			expect( pdfBundle ).toBeDefined();
			const pdfSurface = pdfBundle.surface;
			expect( pdfSurface ).toBeDefined();
			expect( pdfSurface.source.page ).toBe( 2 );
			expect( [ pdfSurface.canvas.width, pdfSurface.canvas.height ] ).toEqual( [ canvasWidth, canvasHeight ] );
			expect( pdfBundle.source.url ).toContain( encodeURIComponent( pdfFile.name ).replace( /%20/g, '_' ).split( '.' )[ 0 ] );
			expect( pdfBundle.source.url ).toContain( 'page2-' );
			await expect.poll( () => pdfCanvas.evaluate( ( c ) =>
				Array.from( c.getContext( '2d' ).getImageData( 50, 50, 1, 1 ).data ) ) ).toEqual( [ 0, 0, 255, 255 ] );
		}

		// Final isolation verification
		await assertIsolationIntegrity( 'final check after all journeys' );
	} finally {
		// Restore automation owner state via atomic CAS
		const restore = async () => {
			if ( lastOwnedRevision !== null ) {
				if ( publicationPending ) {
					throw new Error( 'J65 cleanup requires review: publication outcome is uncertain; no restore attempted' );
				}
				const current = await latest();
				if ( current.pageId !== initial.pageId || current.revision !== lastOwnedRevision ) {
					throw new Error( 'J65 cleanup requires review: another edit intervened; no restore attempted' );
				}
				const restored = await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initial.text,
					summary: 'J65 cleanup: restore automated owner state',
					token: csrfToken
				}, true );
				if ( !restored.layerspublish || restored.layerspublish.result !== 'Success' ) {
					throw new Error( 'J65 cleanup failed; no retry or forced overwrite attempted' );
				}
				const verify = await api( { action: 'layersread', owner, revid: String( restored.layerspublish.revid ) } );
				expect( verify.layersread.snapshot ).toEqual( initialSnapshot );
				expect( ( await latest() ).text ).toBe( initial.text );
			}
		};

		// Restore isolation page
		const restoreIsolation = async () => {
			await api( {
				action: 'edit',
				title: isolationOwner,
				text: isolationInitialText,
				summary: 'J65 cleanup: restore isolation page text',
				token: csrfToken
			}, true );
		};

		// Delete spec's legacy sets
		const deleteSets = async () => {
			if ( sharedImageSaved ) {
				await api( {
					action: 'layersdelete',
					filename: imageFile.name,
					setname: imgSetName,
					token: csrfToken
				}, true );
			}
			if ( sharedPdfSaved && pdfFile && pdfSetName ) {
				await api( {
					action: 'layersdelete',
					filename: pdfFile.name,
					setname: pdfSetName,
					page: 2,
					token: csrfToken
				}, true );
			}
			if ( sharedSlideSaved ) {
				await api( {
					action: 'layersdelete',
					slidename: slide,
					setname: sharedSlideBefore.name || 'default',
					token: csrfToken
				}, true );
			}
		};

		try {
			await restore();
		} finally {
			try {
				await restoreIsolation();
			} finally {
				await deleteSets();
			}
		}
	}
} );
