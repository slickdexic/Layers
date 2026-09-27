/* eslint-env node */
/**
 * J77 Every drawing tool and text formatting through the page-owned editor acceptance:
 * Proves in real Chromium on the original test wiki (http://localhost:8080) that
 * a drawing made with every other tool (rectangle, circle, ellipse, polygon,
 * star, line, arrow, pen stroke, text, text box, callout, dimension, angle
 * dimension), with text formatting applied in the editor, saves and shows everywhere.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'every drawing tool and text formatting through page-owned editor saves, renders, compares on diff, and updates', async ( { page, context } ) => {
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
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65/J77 wiki rules` );
	}

	// Record initial snapshot (must be restored in cleanup, never an empty one)
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	let lastOwnedRevision = null;
	let needsRestore = false;

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
	const drawDrag = async ( startX, startY, endX, endY, intermediateMoves = [] ) => {
		const start = await canvasToClient( startX, startY );
		await page.mouse.move( start.x, start.y );
		await page.mouse.down();
		for ( const pt of intermediateMoves ) {
			const c = await canvasToClient( pt[ 0 ], pt[ 1 ] );
			await page.mouse.move( c.x, c.y );
			await page.waitForTimeout( 30 );
		}
		const end = await canvasToClient( endX, endY );
		await page.mouse.move( end.x, end.y );
		await page.waitForTimeout( 30 );
		await page.mouse.up();
		await page.waitForTimeout( 100 );
	};

	// The colour dialog applies only through its Apply button.
	const pickColour = async ( hex ) => {
		const hexInput = page.locator( '.color-picker-dialog .color-picker-hex-input' );
		await expect( hexInput ).toBeVisible();
		await hexInput.fill( hex );
		await page.locator( '.color-picker-dialog button.color-picker-btn--primary' ).click();
		await expect( page.locator( '.color-picker-dialog' ) ).toHaveCount( 0 );
	};

	// Helper to click canvas at logical coordinates
	const clickCanvasPoint = async ( x, y ) => {
		const pt = await canvasToClient( x, y );
		await page.mouse.click( pt.x, pt.y );
		await page.waitForTimeout( 100 );
	};

	try {
		// =========================================================================
		// Step 1: Seed owner with one bound slide by exact-base publication, open edit link
		// =========================================================================
		needsRestore = true;
		const surfaceId = 'slide_journey_drawing_tools';
		const binding = `v1:${ pageId }:${ surfaceId }`;

		// Base slide has a cyan rectangle spanning x: 250..400, y: 250..350 (same as J76)
		const seededSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Drawing Tools Journey',
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

		const seedMainText = `${ initialMainText }\n\n== Drawing Tools Journey ==\n{{#Slide:WelcomePresentation|layersbinding=${ binding }|width=800}}`;

		const pubSeed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( seededSnapshot ),
			maintext: seedMainText,
			summary: 'J77: seed bound slide with base cyan rectangle',
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

		// Wait until apiManager.pageOwnedDrafts.ready is true and check that no recovery dialog is shown
		await page.waitForFunction( () => window.layersEditorInstance.apiManager.pageOwnedDrafts?.ready === true,
			null, { timeout: 30000 } );
		await expect( page.locator( 'dialog.layers-page-recovery' ) ).toHaveCount( 0 );

		// =========================================================================
		// Step 2: Through toolbar, canvas and panels only: draw every tool, text formatting
		// =========================================================================

		// 2a. Rectangle
		await selectToolbarTool( 'rectangle', 'shapes' );
		await drawDrag( 30, 30, 120, 90 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'rectangle' && l.id !== 'base_cyan_rect' )
		);

		// 2b. Circle
		await selectToolbarTool( 'circle', 'shapes' );
		await drawDrag( 150, 30, 190, 70 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'circle' )
		);

		// 2c. Ellipse
		await selectToolbarTool( 'ellipse', 'shapes' );
		await drawDrag( 270, 60, 330, 90 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'ellipse' )
		);

		// 2d. Polygon
		await selectToolbarTool( 'polygon', 'shapes' );
		await drawDrag( 370, 30, 410, 70 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'polygon' )
		);

		// 2e. Star
		await selectToolbarTool( 'star', 'shapes' );
		await drawDrag( 470, 30, 510, 70 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'star' )
		);

		// 2f. Line
		await selectToolbarTool( 'line', 'lines' );
		await drawDrag( 30, 170, 130, 200 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'line' )
		);

		// 2g. Arrow
		await selectToolbarTool( 'arrow', 'lines' );
		await drawDrag( 160, 170, 260, 200 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'arrow' )
		);

		// 2h. Pen stroke
		await selectToolbarTool( 'pen' );
		await drawDrag( 30, 240, 120, 240, [ [ 70, 270 ] ] );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'path' )
		);

		// 2i. Text (modal text input)
		await selectToolbarTool( 'text', 'text' );
		await clickCanvasPoint( 60, 500 );
		const textModal = page.locator( '.layers-text-modal' );
		await expect( textModal ).toBeVisible( { timeout: 10000 } );
		const textInput = textModal.locator( 'input.text-input' );
		await textInput.fill( 'Caption Text' );
		await textInput.press( 'Enter' );
		await expect( textModal ).not.toBeVisible();
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'text' && l.text === 'Caption Text' )
		);

		// 2j. Text box with rich text and font change
		await selectToolbarTool( 'textbox', 'text' );
		await drawDrag( 550, 30, 750, 140 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'textbox' )
		);

		// Open inline text editor by double-clicking the text box
		await selectToolbarTool( 'pointer' );
		const tbPoint = await canvasToClient( 650, 85 );
		await page.mouse.dblclick( tbPoint.x, tbPoint.y );
		const inlineEditor = page.locator( '.layers-inline-text-editor.textbox' );
		await expect( inlineEditor ).toBeVisible( { timeout: 10000 } );
		const contentWrapper = inlineEditor.locator( '.layers-inline-content-wrapper' );
		await expect( contentWrapper ).toBeVisible();

		// Type "Alpha Beta Gamma"
		await page.keyboard.type( 'Alpha Beta Gamma' );
		await page.waitForTimeout( 150 );

		// Make "Beta" bold with inline text toolbar
		await page.evaluate( () => {
			const wrapper = document.querySelector( '.layers-inline-content-wrapper' );
			const textNode = wrapper.firstChild;
			const text = textNode ? textNode.textContent : '';
			const start = text.indexOf( 'Beta' );
			if ( start !== -1 ) {
				const range = document.createRange();
				range.setStart( textNode, start );
				range.setEnd( textNode, start + 4 );
				const sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange( range );
			}
		} );
		const boldBtn = page.locator( '.layers-text-toolbar button[data-format="bold"]' );
		await expect( boldBtn ).toBeVisible();
		await boldBtn.click();
		await page.waitForTimeout( 150 );

		// Make "Gamma" a different colour with inline text toolbar
		await page.evaluate( () => {
			const wrapper = document.querySelector( '.layers-inline-content-wrapper' );
			const walker = document.createTreeWalker( wrapper, NodeFilter.SHOW_TEXT );
			let node;
			while ( ( node = walker.nextNode() ) ) {
				const idx = node.textContent.indexOf( 'Gamma' );
				if ( idx !== -1 ) {
					const range = document.createRange();
					range.setStart( node, idx );
					range.setEnd( node, idx + 5 );
					const sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange( range );
					break;
				}
			}
		} );

		// Click color picker on inline text toolbar
		const colorBtn = page.locator( '.layers-text-toolbar-color-button, .layers-text-toolbar-color' );
		await expect( colorBtn ).toBeVisible();
		await colorBtn.click();

		await pickColour( '#e02424' );

		// Choose a different font for the text box from the font list
		// With text selected the font list styles only that run; with none it sets the whole box's font.
		await page.evaluate( () => window.getSelection().collapseToEnd() );
		const fontSelect = page.locator( '.layers-text-toolbar select.layers-text-toolbar-font' );
		await expect( fontSelect ).toBeVisible();
		await fontSelect.selectOption( 'Courier New' );
		await page.waitForTimeout( 150 );

		// Finish inline text editing with Ctrl+Enter
		await page.keyboard.press( 'Control+Enter' );
		await expect( page.locator( '.layers-inline-text-editor' ) ).toHaveCount( 0 );

		// 2k. Callout (leave empty)
		await selectToolbarTool( 'callout', 'text' );
		await drawDrag( 320, 170, 500, 250 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'callout' )
		);

		// 2l. Dimension with symmetric tolerance typed in properties panel
		await selectToolbarTool( 'dimension', 'annotation' );
		await drawDrag( 30, 340, 230, 340 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'dimension' )
		);

		// Set tolerance to symmetric with typed value in properties panel
		const tolSelect = page.locator( '.property-field' ).filter( { hasText: 'Tolerance Type' } ).locator( 'select' );
		await expect( tolSelect ).toBeVisible();
		await tolSelect.selectOption( 'symmetric' );

		const tolValInput = page.locator( '.property-field' ).filter( { hasText: 'Tolerance (±)' } ).locator( 'input' );
		await expect( tolValInput ).toBeVisible();
		await tolValInput.fill( '0.05' );
		await tolValInput.press( 'Enter' );
		await page.waitForTimeout( 150 );

		// 2m. Angle dimension (three clicks: arm1, vertex, arm2)
		await selectToolbarTool( 'angleDimension', 'annotation' );
		await clickCanvasPoint( 300, 350 );
		await clickCanvasPoint( 380, 400 );
		await clickCanvasPoint( 450, 350 );
		await page.waitForFunction( () =>
			( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).some( ( l ) => l.type === 'angleDimension' )
		);

		// Save once via .save-button
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

		// =========================================================================
		// Step 3: Read revision with layersread, sample pixels, verify no errors
		// =========================================================================
		const publishedRev1 = await api( { action: 'layersread', owner, revid: String( rev1 ) } );
		const publishedLayers1 = publishedRev1.layersread.snapshot.surfaces[ 0 ].layers;

		const expectedTypes = [
			'rectangle', 'circle', 'ellipse', 'polygon', 'star',
			'line', 'arrow', 'path', 'text', 'textbox', 'callout',
			'dimension', 'angleDimension'
		];
		expectedTypes.forEach( ( type ) => {
			const found = publishedLayers1.find( ( l ) => l.type === type && l.id !== 'base_cyan_rect' );
			expect( found, `Layer type ${ type } should be present in published snapshot` ).toBeDefined();
		} );

		// Verify text box has richText with bold and coloured runs
		const publishedTextBox = publishedLayers1.find( ( l ) => l.type === 'textbox' );
		expect( publishedTextBox ).toBeDefined();
		expect( Array.isArray( publishedTextBox.richText ) ).toBe( true );
		expect( publishedTextBox.richText.length ).toBeGreaterThanOrEqual( 2 );
		expect( publishedTextBox.richText.map( ( r ) => r.text ).join( '' ) ).toBe( 'Alpha Beta Gamma' );
		expect( publishedTextBox.richText.find( ( r ) => r.text === 'Beta' )?.style?.fontWeight ).toBe( 'bold' );
		expect( publishedTextBox.richText.find( ( r ) => r.text === 'Gamma' )?.style?.color ).toBe( '#e02424' );
		expect( publishedTextBox.fontFamily ).toBe( 'Courier New' );

		// Verify callout was left empty
		const publishedCallout = publishedLayers1.find( ( l ) => l.type === 'callout' );
		expect( publishedCallout ).toBeDefined();
		expect( publishedCallout.text || '' ).toBe( '' );

		// Verify dimension has symmetric tolerance with typed value
		const publishedDimension = publishedLayers1.find( ( l ) => l.type === 'dimension' );
		expect( publishedDimension ).toBeDefined();
		expect( publishedDimension.toleranceType ).toBe( 'symmetric' );
		expect( String( publishedDimension.toleranceValue ) ).toBe( '0.05' );

		const layerOf = ( type ) => publishedLayers1.find( ( l ) => l.type === type && l.id !== 'base_cyan_rect' );
		const vertex = ( layer, radius, angle ) => [ layer.x + radius * Math.cos( angle ), layer.y + radius * Math.sin( angle ) ];
		const rect = layerOf( 'rectangle' );
		const polygon = layerOf( 'polygon' );
		const star = layerOf( 'star' );
		const shapeOutlines = {
			rectangle: [ rect.x, rect.y + rect.height / 2 ],
			circle: [ layerOf( 'circle' ).x + layerOf( 'circle' ).radius, layerOf( 'circle' ).y ],
			ellipse: [ layerOf( 'ellipse' ).x, layerOf( 'ellipse' ).y + layerOf( 'ellipse' ).radiusY ],
			polygon: vertex( polygon, polygon.radius, Math.floor( polygon.sides / 2 ) * 2 * Math.PI / polygon.sides - Math.PI / 2 ),
			star: vertex( star, star.outerRadius, 4 * Math.PI / star.points - Math.PI / 2 )
		};

		// Pixel sampling helper
		const sampleDrawingPixels = async ( canvasLocator ) => {
			await expect( canvasLocator ).toBeVisible();

			const samples = await canvasLocator.evaluate( ( c, outlines ) => {
				const ctx = c.getContext( '2d' );
				const samplePixel = ( x, y ) => Array.from( ctx.getImageData( x, y, 1, 1 ).data );

				const checkInkInBox = ( x, y, w, h ) => {
					const data = ctx.getImageData( Math.max( 0, Math.round( x ) ), Math.max( 0, Math.round( y ) ), w, h ).data;
					let ink = 0;
					for ( let i = 0; i < data.length; i += 4 ) {
						if ( ( data[ i ] < 250 || data[ i + 1 ] < 250 || data[ i + 2 ] < 250 ) && data[ i + 3 ] > 0 ) {
							ink++;
						}
					}
					return ink;
				};

				return {
					outlineInk: Object.fromEntries( Object.entries( outlines ).map( ( [ type, [ x, y ] ] ) =>
						[ type, checkInkInBox( x - 3, y - 3, 7, 7 ) ] ) ),
					shapeInteriors: [ samplePixel( 75, 60 ), samplePixel( 150, 30 ), samplePixel( 270, 60 ),
						samplePixel( 370, 30 ), samplePixel( 470, 30 ) ],

					// Stroked or text layers: check for ink near each layer
					lineInk: checkInkInBox( 70, 175, 20, 20 ),
					arrowInk: checkInkInBox( 200, 175, 20, 20 ),
					pathInk: checkInkInBox( 50, 240, 40, 40 ),
					textInk: checkInkInBox( 60, 480, 50, 30 ),
					textboxInk: checkInkInBox( 560, 40, 100, 40 ),
					calloutInk: checkInkInBox( 320, 170, 50, 50 ),
					dimInk: checkInkInBox( 50, 320, 50, 15 ),
					angleDimInk: checkInkInBox( 435, 345, 20, 20 )
				};
			}, shapeOutlines );

			// Each shape's stroke is drawn where its geometry puts it; the default fill leaves the inside white.
			for ( const [ type, ink ] of Object.entries( samples.outlineInk ) ) {
				expect( ink, `${ type } outline` ).toBeGreaterThan( 0 );
			}
			samples.shapeInteriors.forEach( ( pixel ) => expect( pixel ).toEqual( [ 255, 255, 255, 255 ] ) );

			// Stroked and text layers have non-zero ink
			expect( samples.lineInk ).toBeGreaterThan( 0 );
			expect( samples.arrowInk ).toBeGreaterThan( 0 );
			expect( samples.pathInk ).toBeGreaterThan( 0 );
			expect( samples.textInk ).toBeGreaterThan( 0 );
			expect( samples.textboxInk ).toBeGreaterThan( 0 );
			expect( samples.calloutInk ).toBeGreaterThan( 0 );
			expect( samples.dimInk ).toBeGreaterThan( 0 );
			expect( samples.angleDimInk ).toBeGreaterThan( 0 );
		};

		const assertNoErrors = async () => {
			expect( await page.locator( '.layers-page-history-render-failed' ).count() ).toBe( 0 );
			expect( await page.locator( 'text=could not be displayed' ).count() ).toBe( 0 );
			expect( await page.locator( 'text=This Layers revision is unavailable' ).count() ).toBe( 0 );
		};

		// 3a. On the page
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		const pageCanvas = page.locator( '.layers-bound-slide canvas' ).first();
		await sampleDrawingPixels( pageCanvas );
		await assertNoErrors();

		// 3b. In the viewer for rev1
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: 'Special:ViewLayersPage',
			owner,
			revid: String( rev1 ),
			surface: surfaceId
		} ) }` );
		const viewerCanvas = page.locator( '.ext-layers-historical-canvas' );
		await sampleDrawingPixels( viewerCanvas );
		await assertNoErrors();

		// 3c. On diff against seed
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: owner,
			diff: String( rev1 ),
			oldid: String( seedRevId )
		} ) }` );
		await expect( page.locator( '.layers-drawing-diff-view' ).first() ).toBeVisible();
		const diffCanvas = page.locator( `.layers-drawing-diff-view[data-layers-revision="${ rev1 }"] canvas` );
		await sampleDrawingPixels( diffCanvas );
		await assertNoErrors();

		// =========================================================================
		// Step 4: Reopen editor (no recovery dialog), change one layer's colour, save
		// =========================================================================
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		const editLink2 = page.locator( '.layers-page-edit-link' );
		await expect( editLink2 ).toBeVisible();

		const [ editorResponse2 ] = await Promise.all( [
			page.waitForNavigation(),
			editLink2.click()
		] );
		expect( editorResponse2.status() ).toBe( 200 );
		expect( ( editorResponse2.headers()[ 'cache-control' ] || '' ).toLowerCase() ).toContain( 'no-store' );

		await expect( page.locator( '.layers-canvas' ) ).toBeVisible();
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length > 0 );

		// The backup kept after the first save matches this revision, so nothing may be offered for recovery.
		await page.waitForFunction( () => window.layersEditorInstance.apiManager.pageOwnedDrafts?.ready === true,
			null, { timeout: 15000 } );
		await expect( page.locator( 'dialog.layers-page-recovery' ) ).toHaveCount( 0 );

		// Select the drawn rectangle by ID and change its stroke colour in the properties panel
		await page.locator( `.layer-item[data-layer-id="${ rect.id }"]` ).click();
		const colorField = page.locator( '.property-field' ).filter( { hasText: 'Stroke Color' } ).first();
		await expect( colorField ).toBeVisible();
		await colorField.locator( 'button' ).first().click();
		await pickColour( '#00aa00' );
		await page.waitForFunction( ( id ) => window.layersEditorInstance.stateManager.get( 'layers' )
			.find( ( l ) => l.id === id ).stroke === '#00aa00', rect.id, { timeout: 5000 } );

		// Save: exactly one new tagged revision
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

		// Verify exactly one new tagged revision
		const historyAfterSave2 = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids|tags',
			rvlimit: 2
		} );
		const latestRevData2 = historyAfterSave2.query.pages[ 0 ].revisions[ 0 ];
		expect( latestRevData2.revid ).toBe( rev2 );
		expect( latestRevData2.tags ).toContain( 'layers-page-drawing' );
		const publishedLayers2 = ( await api( { action: 'layersread', owner, revid: String( rev2 ) } ) )
			.layersread.snapshot.surfaces[ 0 ].layers;
		expect( publishedLayers2 ).toEqual( publishedLayers1.map( ( l ) => l.id === rect.id ? { ...l, stroke: '#00aa00' } : l ) );
	} finally {
		// =========================================================================
		// Step 5: Restore owner to recorded baseline text and snapshot
		// =========================================================================
		if ( needsRestore && lastOwnedRevision ) {
			const cleanupRes = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( initialSnapshot ),
				maintext: initialMainText,
				summary: 'J77: restore baseline after acceptance run',
				token: csrfToken
			}, true );
			expect( cleanupRes.layerspublish?.result ).toBe( 'Success' );

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
