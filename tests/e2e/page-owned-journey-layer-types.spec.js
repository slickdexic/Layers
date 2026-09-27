/* eslint-env node */
/**
 * J76 Every layer type through the page-owned editor acceptance:
 * Proves in real Chromium on the original test wiki (http://localhost:8080) that
 * a page-owned drawing created with every tool (marker, Shape Library shape,
 * emoji, image import, folder/group, blend mode multiply) saves, displays on the
 * page, in history, on a diff, in the viewer, and can be restored.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'every layer type created through page-owned editor saves, renders, compares on diff, and restores', async ( { page, context } ) => {
	test.setTimeout( 480000 );
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

	// Authenticate as the QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;

	// Ten-minute rule: verify owner has not changed in the last 10 minutes
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
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65/J76 wiki rules` );
	}

	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	let lastOwnedRevision = null;
	let needsRestore = false;

	try {
		// =========================================================================
		// Step 1: Seed owner with one bound slide by exact-base publication, open edit link
		// =========================================================================
		needsRestore = true;
		const surfaceId = 'slide_journey_layer_types';
		const binding = `v1:${ pageId }:${ surfaceId }`;

		// Base slide has a cyan rectangle spanning x: 250..400, y: 250..350
		const seededSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Layer Types Journey',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: [
						{
							id: 'base_cyan_rect',
							type: 'rectangle',
							x: 250,
							y: 250,
							width: 150,
							height: 100,
							fill: '#00ffff',
							stroke: 'none'
						}
					],
					readingOrder: [ 'base_cyan_rect' ]
				}
			]
		};

		const seedMainText = `${ initialMainText }\n\n== Layer Types Journey ==\n{{#Slide:WelcomePresentation|layersbinding=${ binding }|width=800}}`;

		const pubSeed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( seededSnapshot ),
			maintext: seedMainText,
			summary: 'J76: seed bound slide with base cyan rectangle',
			token: csrfToken
		}, true );

		expect( pubSeed.layerspublish?.result ).toBe( 'Success' );
		const seedRevId = pubSeed.layerspublish.revid;
		expect( seedRevId ).toBeGreaterThan( initialRevId );
		lastOwnedRevision = seedRevId;

		// Open edit link through the page
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		const editLink = page.locator( '.layers-page-edit-link' );
		await expect( editLink ).toBeVisible();

		const [ editorResponse ] = await Promise.all( [
			page.waitForNavigation(),
			editLink.click()
		] );
		expect( editorResponse.status() ).toBe( 200 );
		expect( ( editorResponse.headers()[ 'cache-control' ] || '' ).toLowerCase() ).toContain( 'no-store' );

		await expect( page.locator( '.layers-canvas' ) ).toBeVisible();
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );

		// =========================================================================
		// Step 2: Through toolbar only: marker, shape, emoji, image, folder, multiply
		// =========================================================================

		// 2a. Place marker via toolbar
		const annotationDropdown = page.locator( '.tool-dropdown[data-group-id="annotation"]' );
		await annotationDropdown.locator( '.tool-dropdown-trigger' ).click();
		await annotationDropdown.locator( '.tool-dropdown-item[data-tool="marker"]' ).click();
		// Click canvas to place marker
		await page.locator( '.layers-canvas' ).click( { position: { x: 700, y: 100 } } );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'marker' )
		);

		// 2b. Insert Shape Library shape
		await page.locator( '.shape-library-button' ).click();
		await expect( page.locator( '.layers-shape-library-panel' ) ).toBeVisible( { timeout: 10000 } );
		await expect( page.locator( '.layers-shape-library-item' ).first() ).toBeVisible( { timeout: 10000 } );
		await page.locator( '.layers-shape-library-item' ).first().click();
		await expect( page.locator( '.layers-shape-library-panel' ) ).not.toBeVisible( { timeout: 5000 } );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'customShape' )
		);

		// Set shape layer's blend mode to multiply in the properties panel right now while it is selected
		const blendSelect = page.locator( '.property-field' ).filter( { hasText: 'Blend' } ).locator( 'select' );
		await expect( blendSelect ).toBeVisible();
		await blendSelect.selectOption( 'multiply' );
		await page.waitForTimeout( 200 );

		// 2c. Insert Emoji and move it to (550, 300) so it does not overlap the shape
		await page.locator( '.emoji-picker-button' ).click();
		await expect( page.locator( '.layers-emoji-picker' ) ).toBeVisible( { timeout: 10000 } );
		await expect( page.locator( '.layers-emoji-picker-grid button' ).first() ).toBeVisible( { timeout: 10000 } );
		await page.locator( '.layers-emoji-picker-grid button' ).first().click();
		await expect( page.locator( '.layers-emoji-picker' ) ).not.toBeVisible( { timeout: 5000 } );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).filter( ( l ) => l.type === 'customShape' ).length >= 2
		);

		// Move newly added emoji layer via properties panel position fields
		const xInput = page.locator( '.property-field' ).filter( { hasText: 'X Position' } ).locator( 'input' );
		await expect( xInput ).toBeVisible();
		await xInput.fill( '550' );
		await xInput.press( 'Enter' );

		const yInput = page.locator( '.property-field' ).filter( { hasText: 'Y Position' } ).locator( 'input' );
		await expect( yInput ).toBeVisible();
		await yInput.fill( '300' );
		await yInput.press( 'Enter' );

		// 2d. Import small PNG fixture with image import button
		const fixturePath = path.resolve( __dirname, '../fixtures/assets/test-image.png' );
		const [ fileChooser ] = await Promise.all( [
			page.waitForEvent( 'filechooser' ),
			page.locator( '.import-image-button' ).click()
		] );
		await fileChooser.setFiles( fixturePath );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'image' )
		);

		// Rows are found by layer ID so a missing layer fails instead of silently selecting another one.
		const editorLayerIds = await page.evaluate( () => {
			const layers = window.layersEditorInstance.stateManager.get( 'layers' );
			const shapes = layers.filter( ( l ) => l.type === 'customShape' );
			return {
				image: layers.find( ( l ) => l.type === 'image' ).id,
				shape: shapes.find( ( l ) => l.blendMode === 'multiply' ).id,
				emoji: shapes.find( ( l ) => l.blendMode !== 'multiply' ).id
			};
		} );
		const layerRow = ( id ) => page.locator( `.layer-item[data-layer-id="${ id }"]` );

		// Select the newly imported image layer and scale it to 60x60 in the properties panel
		await layerRow( editorLayerIds.image ).click();
		for ( const label of [ /^Width$/, /^Height$/ ] ) {
			const sizeInput = page.locator( '.property-field' ).filter( { hasText: label } ).locator( 'input' );
			await expect( sizeInput ).toBeVisible();
			await sizeInput.fill( '60' );
			await sizeInput.press( 'Enter' );
		}

		// 2e. Put two of the new layers (Shape Library shape and Emoji) in a folder
		await layerRow( editorLayerIds.shape ).click();
		await layerRow( editorLayerIds.emoji ).click( { modifiers: [ 'Control' ] } );

		await page.locator( '.layers-create-group-btn' ).click();
		await expect( page.locator( '.layer-item.layer-item-group' ) ).toBeVisible();

		// 2f. Save once via .save-button
		const responsePromise = page.waitForResponse( ( response ) =>
			response.url().includes( 'api.php' ) &&
			( response.request().postData() || '' ).includes( 'action=layerspublish' ),
		{ timeout: 30000 } );

		await page.locator( '.save-button' ).click();
		const savedResponse = await responsePromise;
		const saved = await savedResponse.json();
		expect( saved.layerspublish?.result ).toBe( 'Success' );

		const rev1 = saved.layerspublish.revid;
		expect( Number.isInteger( rev1 ) ).toBe( true );
		expect( rev1 ).toBeGreaterThan( seedRevId );
		lastOwnedRevision = rev1;

		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges(), null, { timeout: 30000 } );

		// Verify exactly one new tagged revision
		const historyAfterSave = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags',
			rvlimit: 2
		} );
		const latestRevData = historyAfterSave.query.pages[ 0 ].revisions[ 0 ];
		expect( latestRevData.revid ).toBe( rev1 );
		expect( latestRevData.tags ).toContain( 'layers-page-drawing' );

		// Read the saved layers to retrieve exact coordinates
		const publishedRev1 = await api( { action: 'layersread', owner, revid: String( rev1 ) } );
		const publishedLayers1 = publishedRev1.layersread.snapshot.surfaces[ 0 ].layers;

		const markerLayer = publishedLayers1.find( ( l ) => l.type === 'marker' );
		expect( markerLayer ).toBeDefined();
		const imageLayer = publishedLayers1.find( ( l ) => l.id === editorLayerIds.image );
		expect( imageLayer ).toMatchObject( { type: 'image', width: 60, height: 60 } );
		const shapeLayer = publishedLayers1.find( ( l ) => l.id === editorLayerIds.shape );
		expect( shapeLayer ).toMatchObject( { type: 'customShape', blendMode: 'multiply' } );
		expect( shapeLayer ).not.toHaveProperty( 'blend' );
		const emojiLayer = publishedLayers1.find( ( l ) => l.id === editorLayerIds.emoji );
		expect( emojiLayer ).toMatchObject( { type: 'customShape', x: 550, y: 300 } );
		const groupLayer = publishedLayers1.find( ( l ) => l.type === 'group' );
		expect( groupLayer ).toBeDefined();
		expect( groupLayer.children ).toContain( shapeLayer.id );
		expect( groupLayer.children ).toContain( emojiLayer.id );

		// Compute pixel sampling targets
		const imageSampleX = Math.round( imageLayer.x + imageLayer.width / 2 );
		const imageSampleY = Math.round( imageLayer.y + imageLayer.height / 2 );

		// Shape center is around (400, 300); cyan rect is at x: 250..400.
		// Multiplied area is inside the overlap (e.g. at x: 380, y: 300)
		const multSampleX = 380;
		const multSampleY = 300;

		// Shape area over white canvas is outside cyan rect (e.g. at x: 410, y: 325)
		const shapeWhiteX = 410;
		const shapeWhiteY = 325;

		// =========================================================================
		// Step 3: Sample pixels on page, viewer, and diff against previous revision
		// =========================================================================

		const sampleLayerPixels = async ( canvasLocator ) => {
			await expect( canvasLocator ).toBeVisible();
			// Poll until canvas has completed async image and SVG decodes and repaints
			await expect.poll( async () => {
				return await canvasLocator.evaluate( ( c, coords ) => {
					const ctx = c.getContext( '2d' );
					const sample = ( x, y ) => Array.from( ctx.getImageData( x, y, 1, 1 ).data );
					const img = sample( coords.imgX, coords.imgY );
					const mult = sample( coords.mX, coords.mY );
					return img[ 3 ] === 255 && mult[ 3 ] === 255;
				}, { imgX: imageSampleX, imgY: imageSampleY, mX: multSampleX, mY: multSampleY } );
			}, { timeout: 15000 } ).toBe( true );

			const samples = await canvasLocator.evaluate( ( c, coords ) => {
				const ctx = c.getContext( '2d' );
				const sample = ( x, y ) => Array.from( ctx.getImageData( x, y, 1, 1 ).data );

				// Marker ink around marker position
				const markerData = ctx.getImageData(
					Math.max( 0, Math.round( coords.markerX - 20 ) ),
					Math.max( 0, Math.round( coords.markerY - 20 ) ),
					40, 40
				).data;
				let markerInk = 0;
				for ( let i = 0; i < markerData.length; i += 4 ) {
					if ( markerData[ i ] < 250 || markerData[ i + 1 ] < 250 || markerData[ i + 2 ] < 250 ) {
						markerInk++;
					}
				}

				// Emoji ink around emoji position
				const emojiData = ctx.getImageData(
					Math.max( 0, Math.round( coords.emojiX ) ),
					Math.max( 0, Math.round( coords.emojiY ) ),
					Math.round( coords.emojiW || 50 ),
					Math.round( coords.emojiH || 50 )
				).data;
				let emojiInk = 0;
				for ( let i = 0; i < emojiData.length; i += 4 ) {
					if ( emojiData[ i ] < 250 || emojiData[ i + 1 ] < 250 || emojiData[ i + 2 ] < 250 ) {
						emojiInk++;
					}
				}

				return {
					image: sample( coords.imgX, coords.imgY ),
					multiplied: sample( coords.mX, coords.mY ),
					shape: sample( coords.sX, coords.sY ),
					markerInk,
					emojiInk
				};
			}, {
				imgX: imageSampleX,
				imgY: imageSampleY,
				mX: multSampleX,
				mY: multSampleY,
				sX: shapeWhiteX,
				sY: shapeWhiteY,
				markerX: markerLayer.x,
				markerY: markerLayer.y,
				emojiX: emojiLayer.x,
				emojiY: emojiLayer.y,
				emojiW: emojiLayer.width,
				emojiH: emojiLayer.height
			} );

			// Fixture image color: RGB(32, 96, 192)
			expect( samples.image ).toEqual( [ 32, 96, 192, 255 ] );

			// Multiplied area (shape #F9A800 multiplied over cyan #00ffff yields dark green [0, 168, 0, 255])
			expect( samples.multiplied ).toEqual( [ 0, 168, 0, 255 ] );

			// Shape alone over white canvas: amber #F9A800 [249, 168, 0, 255]
			expect( samples.shape ).toEqual( [ 249, 168, 0, 255 ] );

			// Marker and Emoji have non-zero ink
			expect( samples.markerInk ).toBeGreaterThan( 50 );
			expect( samples.emojiInk ).toBeGreaterThan( 50 );
		};

		const assertNoErrors = async () => {
			expect( await page.locator( '.layers-page-history-render-failed' ).count() ).toBe( 0 );
			expect( await page.locator( 'text=could not be displayed' ).count() ).toBe( 0 );
			expect( await page.locator( 'text=This Layers revision is unavailable' ).count() ).toBe( 0 );
		};

		// 3a. Verify on page
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		const pageCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await sampleLayerPixels( pageCanvas );
		await assertNoErrors();

		// 3b. Verify in viewer for rev1
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: 'Special:ViewLayersPage',
			owner,
			revid: String( rev1 ),
			surface: surfaceId
		} ) }` );
		const viewerCanvas = page.locator( '.ext-layers-historical-canvas' );
		await sampleLayerPixels( viewerCanvas );
		await assertNoErrors();

		// 3c. Verify on diff against previous revision (seedRevId)
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: owner,
			diff: String( rev1 ),
			oldid: String( seedRevId )
		} ) }` );
		await expect( page.locator( '.layers-drawing-diff-view' ).first() ).toBeVisible();
		const diffCanvas = page.locator( `.layers-drawing-diff-view[data-layers-revision="${ rev1 }"] canvas` );
		await sampleLayerPixels( diffCanvas );
		await assertNoErrors();

		// =========================================================================
		// Step 4: Hide folder in editor and save; verify members disappear
		// =========================================================================
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		const editLink2 = page.locator( '.layers-page-edit-link' );
		await expect( editLink2 ).toBeVisible();
		await Promise.all( [
			page.waitForNavigation(),
			editLink2.click()
		] );

		await expect( page.locator( '.layers-canvas' ) ).toBeVisible();
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );

		// The backup kept after the first save matches this revision, so nothing may be offered for recovery.
		await page.waitForFunction( () => window.layersEditorInstance.apiManager.pageOwnedDrafts?.ready === true,
			null, { timeout: 15000 } );
		await expect( page.locator( 'dialog.layers-page-recovery' ) ).toHaveCount( 0 );

		// Locate the folder/group in the layer list and toggle its visibility
		const groupLayerItem = page.locator( '.layer-item.layer-item-group' );
		await expect( groupLayerItem ).toBeVisible();
		await groupLayerItem.locator( '.layer-visibility' ).click();

		// Save new revision with hidden folder
		const savePromise2 = page.waitForResponse( ( response ) =>
			response.url().includes( 'api.php' ) &&
			( response.request().postData() || '' ).includes( 'action=layerspublish' ),
		{ timeout: 30000 } );
		await page.locator( '.save-button' ).click();
		const savedResponse2 = await savePromise2;
		const saved2 = await savedResponse2.json();
		expect( saved2.layerspublish?.result ).toBe( 'Success' );

		const rev2 = saved2.layerspublish.revid;
		expect( rev2 ).toBeGreaterThan( rev1 );
		lastOwnedRevision = rev2;
		await page.waitForFunction( () => !window.layersEditorInstance.hasUnsavedChanges(), null, { timeout: 30000 } );

		// Check on page for rev2: folder members must disappear, non-members stay
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		const pageCanvas2 = page.locator( '.layers-bound-slide canvas' ).first();
		await expect( pageCanvas2 ).toBeVisible();

		await expect.poll( async () => {
			return await pageCanvas2.evaluate( ( c, coords ) => {
				const ctx = c.getContext( '2d' );
				const sample = ( x, y ) => Array.from( ctx.getImageData( x, y, 1, 1 ).data );
				return sample( coords.imgX, coords.imgY )[ 3 ] === 255;
			}, { imgX: imageSampleX, imgY: imageSampleY } );
		}, { timeout: 10000 } ).toBe( true );

		const rev2PageSamples = await pageCanvas2.evaluate( ( c, coords ) => {
			const ctx = c.getContext( '2d' );
			const sample = ( x, y ) => Array.from( ctx.getImageData( x, y, 1, 1 ).data );

			const markerData = ctx.getImageData(
				Math.max( 0, Math.round( coords.markerX - 20 ) ),
				Math.max( 0, Math.round( coords.markerY - 20 ) ),
				40, 40
			).data;
			let markerInk = 0;
			for ( let i = 0; i < markerData.length; i += 4 ) {
				if ( markerData[ i ] < 250 || markerData[ i + 1 ] < 250 || markerData[ i + 2 ] < 250 ) {
					markerInk++;
				}
			}

			const emojiData = ctx.getImageData(
				Math.max( 0, Math.round( coords.emojiX ) ),
				Math.max( 0, Math.round( coords.emojiY ) ),
				Math.round( coords.emojiW || 50 ),
				Math.round( coords.emojiH || 50 )
			).data;
			let emojiInk = 0;
			for ( let i = 0; i < emojiData.length; i += 4 ) {
				if ( emojiData[ i ] < 250 || emojiData[ i + 1 ] < 250 || emojiData[ i + 2 ] < 250 ) {
					emojiInk++;
				}
			}

			return {
				cyanUnderneath: sample( coords.mX, coords.mY ),
				shapeOverWhite: sample( coords.sX, coords.sY ),
				image: sample( coords.imgX, coords.imgY ),
				markerInk,
				emojiInk
			};
		}, {
			imgX: imageSampleX,
			imgY: imageSampleY,
			mX: multSampleX,
			mY: multSampleY,
			sX: shapeWhiteX,
			sY: shapeWhiteY,
			markerX: markerLayer.x,
			markerY: markerLayer.y,
			emojiX: emojiLayer.x,
			emojiY: emojiLayer.y,
			emojiW: emojiLayer.width,
			emojiH: emojiLayer.height
		} );

		// Shape members are gone: (380, 300) reverts to pure cyan; (420, 300) reverts to white canvas
		expect( rev2PageSamples.cyanUnderneath ).toEqual( [ 0, 255, 255, 255 ] );
		expect( rev2PageSamples.shapeOverWhite ).toEqual( [ 255, 255, 255, 255 ] );
		expect( rev2PageSamples.emojiInk ).toBe( 0 );

		// Non-member layers still present
		expect( rev2PageSamples.image ).toEqual( [ 32, 96, 192, 255 ] );
		expect( rev2PageSamples.markerInk ).toBeGreaterThan( 50 );
		await assertNoErrors();

		// Check in viewer for rev2: members are also disappeared
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: 'Special:ViewLayersPage',
			owner,
			revid: String( rev2 ),
			surface: surfaceId
		} ) }` );
		const rev2ViewerCanvas = page.locator( '.ext-layers-historical-canvas' );
		await expect( rev2ViewerCanvas ).toBeVisible();
		const rev2ViewerSample = await rev2ViewerCanvas.evaluate( ( c, coords ) => {
			const ctx = c.getContext( '2d' );
			return Array.from( ctx.getImageData( coords.mX, coords.mY, 1, 1 ).data );
		}, { mX: multSampleX, mY: multSampleY } );
		expect( rev2ViewerSample ).toEqual( [ 0, 255, 255, 255 ] );
		await assertNoErrors();

		// Check in viewer for previous revision (rev1): members STILL show
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: 'Special:ViewLayersPage',
			owner,
			revid: String( rev1 ),
			surface: surfaceId
		} ) }` );
		const rev1ViewerCanvas = page.locator( '.ext-layers-historical-canvas' );
		await sampleLayerPixels( rev1ViewerCanvas );
		await assertNoErrors();

		// =========================================================================
		// Step 5: Restore rev1 drawing from viewer
		// =========================================================================
		const restoreBtn = page.locator( '.mw-htmlform-submit button, button[type=submit]' ).first();
		await expect( restoreBtn ).toBeVisible();
		await expect( restoreBtn ).toContainText( 'Restore this version' );

		await Promise.all( [
			page.waitForURL( ( u ) => u.searchParams.get( 'title' ) === owner || u.pathname.endsWith( '/' + owner ) ),
			restoreBtn.click()
		] );

		// History must gain exactly one new tagged revision
		const historyAfterRestore = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags|content',
			rvslots: 'main',
			rvlimit: 2
		} );
		const restoredRevRecord = historyAfterRestore.query.pages[ 0 ].revisions[ 0 ];
		const rev3 = restoredRevRecord.revid;
		expect( rev3 ).toBeGreaterThan( rev2 );
		lastOwnedRevision = rev3;
		expect( restoredRevRecord.tags ).toContain( 'layers-page-drawing' );
		// Main wikitext remains unchanged
		expect( restoredRevRecord.slots.main.content ).toBe( seedMainText );

		// Page shows restored drawing: members visible again
		const restoredPageCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await sampleLayerPixels( restoredPageCanvas );
		await assertNoErrors();
	} finally {
		// =========================================================================
		// Step 6: Restore owner with exact-base CAS cleanup
		// =========================================================================
		if ( needsRestore && lastOwnedRevision ) {
			const cleanupRes = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( initialSnapshot ),
				maintext: initialMainText,
				summary: 'J76: restore baseline after acceptance run',
				token: csrfToken
			}, true );
			expect( cleanupRes.layerspublish?.result ).toBe( 'Success' );

			// Verify clean baseline state
			const verifyClean = await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'content',
				rvslots: 'main'
			} );
			expect( verifyClean.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );
		}
	}
} );
