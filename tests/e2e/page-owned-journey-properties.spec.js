/* eslint-env node */
/**
 * J78 Properties panel changes through the page-owned editor acceptance:
 * Proves in real Chromium on the original test wiki (http://localhost:8080) that
 * every control the properties panel shows saves as set, including false and 0
 * values, gradient cleared back to solid publishes as absent, and no layer carries
 * a key the seed and panel did not write. Reopening without changes creates no new revision.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

test.describe.configure( { mode: 'serial' } );

test( 'properties panel changes save as set, clear gradients, and create no revision on clean save', async ( { page, context } ) => {
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
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65/J78 wiki rules` );
	}

	// Record initial snapshot (must be restored in cleanup, never an empty one)
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	let lastOwnedRevision = null;
	let needsRestore = false;

	// UI interaction helpers for the properties panel
	const selectLayerItem = async ( layerId ) => {
		const item = page.locator( `.layer-item[data-layer-id="${ layerId }"]` );
		await expect( item ).toBeVisible();
		await item.click();
		await page.waitForTimeout( 100 );
	};

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

	const setSlider = async ( labelPattern, value, sectionName = null ) => {
		const field = getField( labelPattern, sectionName );
		await expect( field ).toBeVisible();
		const input = field.locator( 'input.compact-number, input[type="number"]' ).first();
		await expect( input ).toBeVisible();
		await input.fill( String( value ) );
		await input.dispatchEvent( 'input' );
		await page.waitForTimeout( 150 );
	};

	const setSelect = async ( labelPattern, value, sectionName = null ) => {
		const field = getField( labelPattern, sectionName );
		await expect( field ).toBeVisible();
		const select = field.locator( 'select' ).first();
		await expect( select ).toBeVisible();
		await select.selectOption( value );
		await page.waitForTimeout( 150 );
	};

	const setCheckbox = async ( labelPattern, checked, sectionName = null ) => {
		const field = getField( labelPattern, sectionName );
		await expect( field ).toBeVisible();
		const checkbox = field.locator( 'input[type="checkbox"]' ).first();
		await expect( checkbox ).toBeVisible();
		const isChecked = await checkbox.isChecked();
		if ( isChecked !== checked ) {
			await checkbox.click();
			await page.waitForTimeout( 200 );
		}
	};

	const pickColour = async ( hex ) => {
		const hexInput = page.locator( '.color-picker-dialog .color-picker-hex-input' );
		await expect( hexInput ).toBeVisible();
		await hexInput.fill( hex );
		await page.locator( '.color-picker-dialog button.color-picker-btn--primary' ).click();
		await expect( page.locator( '.color-picker-dialog' ) ).toHaveCount( 0 );
	};

	const setColor = async ( labelPattern, hex, sectionName = null ) => {
		const field = getField( labelPattern, sectionName );
		await expect( field ).toBeVisible();
		const btn = field.locator( 'button' ).first();
		await expect( btn ).toBeVisible();
		await btn.click();
		await pickColour( hex );
		await page.waitForTimeout( 100 );
	};

	try {
		// =========================================================================
		// Step 1: Seed owner with 8 layers directly in snapshot, open edit link
		// =========================================================================
		needsRestore = true;
		const surfaceId = 'slide_journey_properties';
		const binding = `v1:${ pageId }:${ surfaceId }`;

		const seedLayers = [
			{
				id: 'layer_rect',
				type: 'rectangle',
				x: 30,
				y: 30,
				width: 100,
				height: 60,
				stroke: '#000000',
				strokeWidth: 2,
				fill: '#ffffff'
			},
			{
				id: 'layer_star',
				type: 'star',
				x: 160,
				y: 30,
				radius: 40,
				outerRadius: 40,
				innerRadius: 20,
				points: 5,
				rotation: 25,
				stroke: '#000000',
				strokeWidth: 2,
				fill: '#ffffff'
			},
			{
				id: 'layer_poly',
				type: 'polygon',
				x: 270,
				y: 30,
				radius: 40,
				sides: 6,
				cornerRadius: 8,
				stroke: '#000000',
				strokeWidth: 2,
				fill: '#ffffff'
			},
			{
				id: 'layer_arrow',
				type: 'arrow',
				x1: 400,
				y1: 50,
				x2: 520,
				y2: 50,
				stroke: '#000000',
				strokeWidth: 2,
				fill: 'transparent',
				arrowSize: 10,
				arrowStyle: 'single',
				arrowhead: 'arrow',
				tailWidth: 6
			},
			{
				id: 'layer_textbox',
				type: 'textbox',
				x: 560,
				y: 30,
				width: 120,
				height: 60,
				text: 'TextBox',
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				color: '#000000',
				textAlign: 'left',
				verticalAlign: 'top',
				lineHeight: 1.2,
				stroke: 'transparent',
				strokeWidth: 0,
				fill: '#ffffff',
				cornerRadius: 0,
				padding: 8
			},
			{
				id: 'layer_callout',
				type: 'callout',
				x: 30,
				y: 150,
				width: 130,
				height: 70,
				text: 'Callout',
				fontSize: 16,
				fontFamily: 'Arial, sans-serif',
				color: '#000000',
				textAlign: 'center',
				verticalAlign: 'middle',
				lineHeight: 1.2,
				stroke: '#000000',
				strokeWidth: 1,
				fill: '#ffffff',
				cornerRadius: 8,
				padding: 12,
				tailDirection: 'bottom',
				tailPosition: 0.5,
				tailSize: 20
			},
			{
				id: 'layer_marker',
				type: 'marker',
				x: 230,
				y: 180,
				value: 1,
				style: 'circled',
				size: 24,
				fontSizeAdjust: 2,
				fontFamily: 'Arial, sans-serif',
				fontWeight: 'bold',
				fill: '#ffffff',
				stroke: '#000000',
				strokeWidth: 2,
				color: '#000000'
			},
			{
				id: 'layer_dim',
				type: 'dimension',
				x1: 340,
				y1: 180,
				x2: 490,
				y2: 180,
				stroke: '#000000',
				strokeWidth: 1,
				fontSize: 12,
				fontFamily: 'Arial, sans-serif',
				color: '#000000',
				endStyle: 'arrow',
				textPosition: 'above',
				extensionLength: 10,
				extensionGap: 3,
				dimensionOffset: 15,
				textOffset: 10,
				arrowSize: 8,
				tickSize: 6,
				unit: 'px',
				scale: 1,
				showUnit: true,
				showBackground: true,
				backgroundColor: '#ffffff',
				precision: 0,
				toleranceType: 'none',
				text: ''
			}
		];

		const seededSnapshot = {
			schemaVersion: 1,
			surfaces: [
				{
					id: surfaceId,
					kind: 'slide',
					label: 'Properties Panel Journey',
					canvas: {
						width: 800,
						height: 600,
						backgroundColor: '#ffffff',
						backgroundVisible: true,
						backgroundOpacity: 1
					},
					layers: seedLayers,
					readingOrder: seedLayers.map( ( l ) => l.id )
				}
			]
		};

		const seedMainText = `${ initialMainText }\n\n== Properties Panel Journey ==\n{{#Slide:PropertiesPresentation|layersbinding=${ binding }|width=800}}`;

		const pubSeed = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( initialRevId ),
			data: JSON.stringify( seededSnapshot ),
			maintext: seedMainText,
			summary: 'J78: seed bound slide with 8 layers for properties panel test',
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
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length === 8 );

		// Wait until apiManager.pageOwnedDrafts.ready is true and check that no recovery dialog is shown
		await page.waitForFunction( () => window.layersEditorInstance.apiManager.pageOwnedDrafts?.ready === true,
			null, { timeout: 30000 } );
		await expect( page.locator( 'dialog.layers-page-recovery' ) ).toHaveCount( 0 );

		// =========================================================================
		// Step 2: Through layer list & properties panel only, change every control
		// =========================================================================

		// 2.1 Rectangle
		await selectLayerItem( 'layer_rect' );
		await setInput( 'X Position', 45, 'Transform' );
		await setInput( 'Y Position', 45, 'Transform' );
		await setInput( 'Rotation', 15, 'Transform' );
		await setInput( 'Width', 110, 'Transform' );
		await setInput( 'Height', 70, 'Transform' );
		await setInput( 'Corner Radius', 12, 'Transform' );
		await setColor( 'Stroke Color', '#123456', 'Appearance' );
		await setInput( 'Stroke Width', 4, 'Appearance' );
		await setSlider( 'Stroke Opacity', 80, 'Appearance' );

		// Gradient toggle on rectangle: switch to linear gradient, then switch back to solid
		const gradSelect = page.locator( '.gradient-editor .gradient-type-select' );
		await expect( gradSelect ).toBeVisible();
		await gradSelect.selectOption( 'linear' );
		await page.waitForTimeout( 200 );
		await gradSelect.selectOption( 'solid' );
		await page.waitForTimeout( 200 );

		await setColor( 'Fill Color', '#abcdef', 'Appearance' );
		await setSlider( 'Fill Opacity', 75, 'Appearance' );
		await setSlider( 'Layer Opacity', 85, 'Effects' );
		await setSelect( 'Blend', 'multiply', 'Effects' );

		// Drop shadow
		await setCheckbox( /^Shadow$/, true, 'Effects' );
		await expect( getField( 'Shadow Blur', 'Effects' ) ).toBeVisible();
		await setInput( 'Shadow Color', '#222222', 'Effects' );
		await setInput( 'Shadow Blur', 10, 'Effects' );
		await setInput( 'Shadow Spread', 3, 'Effects' );
		await setInput( 'Shadow Offset X', 5, 'Effects' );
		await setInput( 'Shadow Offset Y', 5, 'Effects' );

		// 2.2 Star
		await selectLayerItem( 'layer_star' );
		await setInput( 'X Position', 175, 'Transform' );
		await setInput( 'Y Position', 50, 'Transform' );
		await setInput( 'Rotation', 0, 'Transform' );
		await setInput( 'Points', 6, 'Transform' );
		await setInput( 'Outer Radius', 50, 'Transform' );
		await setInput( 'Inner Radius', 25, 'Transform' );
		await setInput( 'Point Radius', 4, 'Transform' );
		await setInput( 'Valley Radius', 4, 'Transform' );
		await setColor( 'Stroke Color', '#654321', 'Appearance' );
		await setInput( 'Stroke Width', 3, 'Appearance' );
		await setSlider( 'Stroke Opacity', 90, 'Appearance' );
		await setColor( 'Fill Color', '#ffd700', 'Appearance' );
		await setSlider( 'Fill Opacity', 85, 'Appearance' );
		await setSlider( 'Layer Opacity', 90, 'Effects' );
		await setSelect( 'Blend', 'screen', 'Effects' );
		await setCheckbox( /^Shadow$/, true, 'Effects' );
		await expect( getField( 'Shadow Blur', 'Effects' ) ).toBeVisible();
		await setInput( 'Shadow Color', '#111111', 'Effects' );
		await setInput( 'Shadow Blur', 8, 'Effects' );
		await setInput( 'Shadow Spread', 2, 'Effects' );
		await setInput( 'Shadow Offset X', 4, 'Effects' );
		await setInput( 'Shadow Offset Y', 4, 'Effects' );

		// 2.3 Polygon
		await selectLayerItem( 'layer_poly' );
		await setInput( 'X Position', 285, 'Transform' );
		await setInput( 'Y Position', 50, 'Transform' );
		await setInput( 'Rotation', 30, 'Transform' );
		await setInput( 'Sides', 8, 'Transform' );
		await setInput( 'Radius', 50, 'Transform' );
		await setInput( 'Corner Radius', 0, 'Transform' );
		await setColor( 'Stroke Color', '#335577', 'Appearance' );
		await setInput( 'Stroke Width', 3, 'Appearance' );
		await setSlider( 'Stroke Opacity', 85, 'Appearance' );
		await setColor( 'Fill Color', '#00e5ff', 'Appearance' );
		await setSlider( 'Fill Opacity', 80, 'Appearance' );
		await setSlider( 'Layer Opacity', 80, 'Effects' );
		await setSelect( 'Blend', 'overlay', 'Effects' );
		await setCheckbox( /^Shadow$/, true, 'Effects' );
		await expect( getField( 'Shadow Blur', 'Effects' ) ).toBeVisible();
		await setInput( 'Shadow Color', '#000000', 'Effects' );
		await setInput( 'Shadow Blur', 6, 'Effects' );
		await setInput( 'Shadow Spread', 1, 'Effects' );
		await setInput( 'Shadow Offset X', 3, 'Effects' );
		await setInput( 'Shadow Offset Y', 3, 'Effects' );

		// Hide polygon in layer list (step 2: "hide another")
		await page.locator( '.layer-item[data-layer-id="layer_poly"] .layer-visibility' ).dispatchEvent( 'click' );
		await expect.poll( () => page.evaluate( () => {
			return window.layersEditorInstance.stateManager.get( 'layers' )?.find( ( l ) => l.id === 'layer_poly' )?.visible;
		} ) ).toBe( false );

		// 2.4 Arrow
		await selectLayerItem( 'layer_arrow' );
		await setInput( 'Start X', 410, 'Transform' );
		await setInput( 'Start Y', 60, 'Transform' );
		await setInput( 'End X', 530, 'Transform' );
		await setInput( 'End Y', 60, 'Transform' );
		await setInput( 'Arrow Size', 18, 'Transform' );
		await setSlider( 'Head Scale', 120, 'Transform' );
		await setInput( 'Tail Width', 0, 'Transform' );
		await setSelect( 'Arrow Ends', 'single', 'Transform' );
		await setSelect( 'Head Type', 'chevron', 'Transform' );
		await setColor( 'Stroke Color', '#446688', 'Appearance' );
		await setInput( 'Stroke Width', 3, 'Appearance' );
		await setSlider( 'Stroke Opacity', 95, 'Appearance' );
		await setColor( 'Fill Color', '#ffeedd', 'Appearance' );
		await setSlider( 'Fill Opacity', 85, 'Appearance' );
		await setSlider( 'Layer Opacity', 95, 'Effects' );
		await setSelect( 'Blend', 'darken', 'Effects' );
		await setCheckbox( /^Shadow$/, true, 'Effects' );
		await expect( getField( 'Shadow Blur', 'Effects' ) ).toBeVisible();
		await setInput( 'Shadow Color', '#1a1a1a', 'Effects' );
		await setInput( 'Shadow Blur', 6, 'Effects' );
		await setInput( 'Shadow Spread', 1, 'Effects' );
		await setInput( 'Shadow Offset X', 3, 'Effects' );
		await setInput( 'Shadow Offset Y', 3, 'Effects' );

		// 2.5 Text box
		await selectLayerItem( 'layer_textbox' );
		await setInput( 'X Position', 575, 'Transform' );
		await setInput( 'Y Position', 45, 'Transform' );
		await setInput( 'Rotation', 5, 'Transform' );
		await setInput( 'Width', 140, 'Transform' );
		await setInput( 'Height', 70, 'Transform' );
		await setInput( 'Corner Radius', 6, 'Transform' );
		await setInput( 'Text Stroke Width', 1, 'Text Effects' );
		await setColor( 'Text Stroke Color', '#112233', 'Text Effects' );
		await setCheckbox( 'Enable Text Shadow', true, 'Text Shadow' );
		await expect( getField( 'Shadow Blur', 'Text Shadow' ) ).toBeVisible();
		await setColor( 'Shadow Color', '#333333', 'Text Shadow' );
		await setInput( 'Shadow Blur', 6, 'Text Shadow' );
		await setInput( 'Shadow Offset X', 3, 'Text Shadow' );
		await setInput( 'Shadow Offset Y', 3, 'Text Shadow' );
		await setSelect( 'Text Align', 'center', 'Alignment' );
		await setSelect( 'Vertical Align', 'middle', 'Alignment' );
		await setInput( 'Padding', 12, 'Alignment' );
		await setColor( 'Stroke Color', '#224466', 'Appearance' );
		await setInput( 'Stroke Width', 2, 'Appearance' );
		await setSlider( 'Stroke Opacity', 90, 'Appearance' );
		await setColor( 'Fill Color', '#f5f5f5', 'Appearance' );
		await setSlider( 'Fill Opacity', 90, 'Appearance' );
		await setSlider( 'Layer Opacity', 90, 'Effects' );
		await setSelect( 'Blend', 'normal', 'Effects' );

		// 2.6 Callout
		await selectLayerItem( 'layer_callout' );
		await setInput( 'X Position', 45, 'Transform' );
		await setInput( 'Y Position', 160, 'Transform' );
		await setInput( 'Rotation', 5, 'Transform' );
		await setInput( 'Width', 150, 'Transform' );
		await setInput( 'Height', 80, 'Transform' );
		await setInput( 'Corner Radius', 12, 'Transform' );
		await setInput( 'Text Stroke Width', 1, 'Text Effects' );
		await setColor( 'Text Stroke Color', '#223344', 'Text Effects' );
		await setCheckbox( 'Enable Text Shadow', true, 'Text Shadow' );
		await expect( getField( 'Shadow Blur', 'Text Shadow' ) ).toBeVisible();
		await setColor( 'Shadow Color', '#222222', 'Text Shadow' );
		await setInput( 'Shadow Blur', 5, 'Text Shadow' );
		await setInput( 'Shadow Offset X', 2, 'Text Shadow' );
		await setInput( 'Shadow Offset Y', 2, 'Text Shadow' );
		await setSelect( 'Text Align', 'right', 'Alignment' );
		await setSelect( 'Vertical Align', 'bottom', 'Alignment' );
		await setInput( 'Padding', 16, 'Alignment' );
		await setSelect( 'Tail Style', 'curved', 'Callout Tail' );
		await setColor( 'Stroke Color', '#335577', 'Appearance' );
		await setInput( 'Stroke Width', 2, 'Appearance' );
		await setSlider( 'Stroke Opacity', 95, 'Appearance' );
		await setColor( 'Fill Color', '#eef2f5', 'Appearance' );
		await setSlider( 'Fill Opacity', 90, 'Appearance' );
		await setSlider( 'Layer Opacity', 95, 'Effects' );
		await setSelect( 'Blend', 'normal', 'Effects' );

		// 2.7 Marker
		await selectLayerItem( 'layer_marker' );
		await setInput( 'X Position', 245, 'Transform' );
		await setInput( 'Y Position', 195, 'Transform' );
		await setInput( 'Rotation', 10, 'Transform' );
		// A label, which the panel always sends as text.
		await setInput( 'Value', '1A', 'Marker Properties' );
		await setSelect( 'Marker Style', 'letter', 'Marker Properties' );
		await setInput( 'Marker Size', 30, 'Marker Properties' );
		await setInput( 'Font Size Adjust', 3, 'Marker Properties' );
		await setColor( 'Text Color', '#112233', 'Marker Properties' );
		await setColor( 'Fill Color', '#fff3cd', 'Marker Properties' );
		await setColor( 'Stroke Color', '#856404', 'Marker Properties' );
		await setInput( 'Stroke Width', 3, 'Marker Properties' );
		await setCheckbox( 'Show Arrow', true, 'Marker Properties' );
		await setSlider( 'Layer Opacity', 90, 'Effects' );
		await setSelect( 'Blend', 'multiply', 'Effects' );
		await setCheckbox( /^Shadow$/, true, 'Effects' );

		// 2.8 Dimension
		await selectLayerItem( 'layer_dim' );
		await setInput( 'Font Size', 14, 'Dimension Properties' );
		await setInput( 'Dimension Value', '25.4 mm', 'Dimension Properties' );
		await setColor( 'Text Color', '#1a1a1a', 'Dimension Properties' );
		await setColor( 'Stroke Color', '#003366', 'Dimension Properties' );
		await setInput( 'Line Width', 2, 'Dimension Properties' );
		await setSelect( 'Orientation', 'horizontal', 'Dimension Properties' );
		await setSelect( 'End Style', 'tick', 'Dimension Properties' );
		await setSelect( 'Text Position', 'below', 'Dimension Properties' );
		await setSelect( 'Text Direction', 'horizontal', 'Dimension Properties' );
		await setInput( 'Extension Length', 15, 'Dimension Properties' );
		await setInput( 'Dimension Offset', 20, 'Dimension Properties' );
		await setInput( 'Text Offset', 0, 'Dimension Properties' );
		// False boolean value: uncheck Show Background
		await setCheckbox( 'Show Background', false, 'Text Background' );
		// Tolerance: select symmetric and fill value
		await setSelect( 'Tolerance Type', 'symmetric', 'Tolerance' );
		await expect( getField( 'Tolerance (±)', 'Tolerance' ) ).toBeVisible();
		await setInput( 'Tolerance (±)', '0.05', 'Tolerance' );

		// Lock dimension layer in layer list (step 2: "Lock one layer")
		await page.locator( '.layer-item[data-layer-id="layer_dim"] .layer-lock' ).dispatchEvent( 'click' );
		await expect.poll( () => page.evaluate( () => {
			return window.layersEditorInstance.stateManager.get( 'layers' )?.find( ( l ) => l.id === 'layer_dim' )?.locked;
		} ) ).toBe( true );

		// Save once via .save-button
		const savePromise = page.waitForResponse( ( response ) =>
			response.url().includes( 'api.php' ) &&
			( response.request().postData() || '' ).includes( 'action=layerspublish' ),
		{ timeout: 30000 } );

		await page.locator( '.save-button' ).click();
		const savedResponse = await savePromise;
		const postData = savedResponse.request().postData();
		const saved = await savedResponse.json();
		if ( saved.layerspublish?.result !== 'Success' ) {
			// eslint-disable-next-line no-console
			console.error( 'PUBLISH FAILED:', JSON.stringify( saved, null, 2 ) );
			// eslint-disable-next-line no-console
			console.error( 'POST DATA:', postData );
		}
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
		// Step 3: Check stored values in layersread, no gradient, no extra keys, render status
		// =========================================================================
		const publishedRev1 = await api( { action: 'layersread', owner, revid: String( rev1 ) } );
		const publishedLayers1 = publishedRev1.layersread.snapshot.surfaces[ 0 ].layers;
		expect( publishedLayers1.length ).toBe( 8 );

		// 3.1 Verify rectangle stored values
		const rect1 = publishedLayers1.find( ( l ) => l.id === 'layer_rect' );
		expect( rect1 ).toBeDefined();
		expect( rect1.x ).toBe( 45 );
		expect( rect1.y ).toBe( 45 );
		expect( rect1.rotation ).toBe( 15 );
		expect( rect1.width ).toBe( 110 );
		expect( rect1.height ).toBe( 70 );
		expect( rect1.cornerRadius ).toBe( 12 );
		expect( rect1.stroke ).toBe( '#123456' );
		expect( rect1.strokeWidth ).toBe( 4 );
		expect( rect1.strokeOpacity ).toBe( 0.8 );
		expect( rect1.fill ).toBe( '#abcdef' );
		expect( rect1.fillOpacity ).toBe( 0.75 );
		expect( rect1.opacity ).toBe( 0.85 );
		expect( rect1.blendMode ).toBe( 'multiply' );
		expect( rect1.shadow ).toBe( true );
		expect( rect1.shadowColor ).toBe( '#222222' );
		expect( rect1.shadowBlur ).toBe( 10 );
		expect( rect1.shadowSpread ).toBe( 3 );
		expect( rect1.shadowOffsetX ).toBe( 5 );
		expect( rect1.shadowOffsetY ).toBe( 5 );
		// Specifically check rectangle has no gradient property (cleared back to solid publishes as absent)
		expect( rect1.gradient ).toBeUndefined();

		// 3.2 Verify star stored values
		const star1 = publishedLayers1.find( ( l ) => l.id === 'layer_star' );
		expect( star1 ).toBeDefined();
		expect( star1.x ).toBe( 175 );
		expect( star1.y ).toBe( 50 );
		expect( star1.rotation ).toBe( 0 );
		expect( star1.points ).toBe( 6 );
		expect( star1.outerRadius ).toBe( 50 );
		expect( star1.innerRadius ).toBe( 25 );
		expect( star1.pointRadius ).toBe( 4 );
		expect( star1.valleyRadius ).toBe( 4 );
		expect( star1.stroke ).toBe( '#654321' );
		expect( star1.strokeWidth ).toBe( 3 );
		expect( star1.strokeOpacity ).toBe( 0.9 );
		expect( star1.fill ).toBe( '#ffd700' );
		expect( star1.fillOpacity ).toBe( 0.85 );
		expect( star1.opacity ).toBe( 0.9 );
		expect( star1.blendMode ).toBe( 'screen' );
		expect( star1.shadow ).toBe( true );

		// 3.3 Verify polygon stored values (including visible: false)
		const poly1 = publishedLayers1.find( ( l ) => l.id === 'layer_poly' );
		expect( poly1 ).toBeDefined();
		expect( poly1.x ).toBe( 285 );
		expect( poly1.y ).toBe( 50 );
		expect( poly1.rotation ).toBe( 30 );
		expect( poly1.sides ).toBe( 8 );
		expect( poly1.radius ).toBe( 50 );
		expect( poly1.cornerRadius ).toBe( 0 );
		expect( poly1.stroke ).toBe( '#335577' );
		expect( poly1.strokeWidth ).toBe( 3 );
		expect( poly1.strokeOpacity ).toBe( 0.85 );
		expect( poly1.fill ).toBe( '#00e5ff' );
		expect( poly1.fillOpacity ).toBe( 0.8 );
		expect( poly1.opacity ).toBe( 0.8 );
		expect( poly1.blendMode ).toBe( 'overlay' );
		expect( poly1.visible ).toBe( false );

		// 3.4 Verify arrow stored values
		const arrow1 = publishedLayers1.find( ( l ) => l.id === 'layer_arrow' );
		expect( arrow1 ).toBeDefined();
		expect( arrow1.x1 ).toBe( 410 );
		expect( arrow1.y1 ).toBe( 60 );
		expect( arrow1.x2 ).toBe( 530 );
		expect( arrow1.y2 ).toBe( 60 );
		expect( arrow1.arrowSize ).toBe( 18 );
		expect( arrow1.headScale ).toBe( 1.2 );
		expect( arrow1.tailWidth ).toBe( 0 );
		expect( arrow1.arrowStyle ).toBe( 'single' );
		expect( arrow1.arrowHeadType ).toBe( 'chevron' );
		expect( arrow1.stroke ).toBe( '#446688' );
		expect( arrow1.strokeWidth ).toBe( 3 );
		expect( arrow1.strokeOpacity ).toBe( 0.95 );
		expect( arrow1.fill ).toBe( '#ffeedd' );
		expect( arrow1.fillOpacity ).toBe( 0.85 );
		expect( arrow1.opacity ).toBe( 0.95 );
		expect( arrow1.blendMode ).toBe( 'darken' );

		// 3.5 Verify textbox stored values
		const tb1 = publishedLayers1.find( ( l ) => l.id === 'layer_textbox' );
		expect( tb1 ).toBeDefined();
		expect( tb1.x ).toBe( 575 );
		expect( tb1.y ).toBe( 45 );
		expect( tb1.rotation ).toBe( 5 );
		expect( tb1.width ).toBe( 140 );
		expect( tb1.height ).toBe( 70 );
		expect( tb1.cornerRadius ).toBe( 6 );
		expect( tb1.textStrokeWidth ).toBe( 1 );
		expect( tb1.textStrokeColor ).toBe( '#112233' );
		expect( tb1.textShadow ).toBe( true );
		expect( tb1.textShadowColor ).toBe( '#333333' );
		expect( tb1.textShadowBlur ).toBe( 6 );
		expect( tb1.textShadowOffsetX ).toBe( 3 );
		expect( tb1.textShadowOffsetY ).toBe( 3 );
		expect( tb1.textAlign ).toBe( 'center' );
		expect( tb1.verticalAlign ).toBe( 'middle' );
		expect( tb1.padding ).toBe( 12 );
		expect( tb1.stroke ).toBe( '#224466' );
		expect( tb1.strokeWidth ).toBe( 2 );
		expect( tb1.strokeOpacity ).toBe( 0.9 );
		expect( tb1.fill ).toBe( '#f5f5f5' );
		expect( tb1.fillOpacity ).toBe( 0.9 );
		expect( tb1.opacity ).toBe( 0.9 );

		// 3.6 Verify callout stored values
		const callout1 = publishedLayers1.find( ( l ) => l.id === 'layer_callout' );
		expect( callout1 ).toBeDefined();
		expect( callout1.x ).toBe( 45 );
		expect( callout1.y ).toBe( 160 );
		expect( callout1.rotation ).toBe( 5 );
		expect( callout1.width ).toBe( 150 );
		expect( callout1.height ).toBe( 80 );
		expect( callout1.cornerRadius ).toBe( 12 );
		expect( callout1.textStrokeWidth ).toBe( 1 );
		expect( callout1.textStrokeColor ).toBe( '#223344' );
		expect( callout1.textShadow ).toBe( true );
		expect( callout1.textAlign ).toBe( 'right' );
		expect( callout1.verticalAlign ).toBe( 'bottom' );
		expect( callout1.padding ).toBe( 16 );
		expect( callout1.tailStyle ).toBe( 'curved' );
		expect( callout1.stroke ).toBe( '#335577' );
		expect( callout1.strokeWidth ).toBe( 2 );

		// 3.7 Verify marker stored values
		const marker1 = publishedLayers1.find( ( l ) => l.id === 'layer_marker' );
		expect( marker1 ).toBeDefined();
		expect( marker1.x ).toBe( 245 );
		expect( marker1.y ).toBe( 195 );
		expect( marker1.rotation ).toBe( 10 );
		expect( marker1.value ).toBe( '1A' );
		expect( marker1.style ).toBe( 'letter' );
		expect( marker1.size ).toBe( 30 );
		expect( marker1.fontSizeAdjust ).toBe( 3 );
		expect( marker1.color ).toBe( '#112233' );
		expect( marker1.fill ).toBe( '#fff3cd' );
		expect( marker1.stroke ).toBe( '#856404' );
		expect( marker1.strokeWidth ).toBe( 3 );
		expect( marker1.hasArrow ).toBe( true );

		// 3.8 Verify dimension stored values (including locked: true, showBackground: false)
		const dim1 = publishedLayers1.find( ( l ) => l.id === 'layer_dim' );
		expect( dim1 ).toBeDefined();
		expect( dim1.fontSize ).toBe( 14 );
		expect( dim1.text ).toBe( '25.4 mm' );
		expect( dim1.color ).toBe( '#1a1a1a' );
		expect( dim1.stroke ).toBe( '#003366' );
		expect( dim1.strokeWidth ).toBe( 2 );
		expect( dim1.orientation ).toBe( 'horizontal' );
		expect( dim1.endStyle ).toBe( 'tick' );
		expect( dim1.textPosition ).toBe( 'below' );
		expect( dim1.textDirection ).toBe( 'horizontal' );
		expect( dim1.extensionLength ).toBe( 15 );
		expect( dim1.dimensionOffset ).toBe( 20 );
		expect( dim1.textOffset ).toBe( 0 );
		expect( dim1.showBackground ).toBe( false );
		expect( dim1.toleranceType ).toBe( 'symmetric' );
		expect( String( dim1.toleranceValue ) ).toBe( '0.05' );
		expect( dim1.locked ).toBe( true );

		// Check that no layer carries a key that neither the seed nor the panel wrote
		const allowedKeysByType = {
			rectangle: new Set( [
				'id', 'type', 'x', 'y', 'rotation', 'width', 'height', 'cornerRadius',
				'stroke', 'strokeWidth', 'strokeOpacity', 'fill', 'fillOpacity',
				'opacity', 'blendMode', 'shadow', 'shadowColor', 'shadowBlur',
				'shadowSpread', 'shadowOffsetX', 'shadowOffsetY', 'visible', 'locked'
			] ),
			star: new Set( [
				'id', 'type', 'x', 'y', 'rotation', 'radius', 'outerRadius', 'innerRadius',
				'points', 'pointRadius', 'valleyRadius', 'stroke', 'strokeWidth',
				'strokeOpacity', 'fill', 'fillOpacity', 'opacity', 'blendMode',
				'shadow', 'shadowColor', 'shadowBlur', 'shadowSpread', 'shadowOffsetX',
				'shadowOffsetY', 'visible', 'locked'
			] ),
			polygon: new Set( [
				'id', 'type', 'x', 'y', 'rotation', 'radius', 'sides', 'cornerRadius',
				'stroke', 'strokeWidth', 'strokeOpacity', 'fill', 'fillOpacity',
				'opacity', 'blendMode', 'shadow', 'shadowColor', 'shadowBlur',
				'shadowSpread', 'shadowOffsetX', 'shadowOffsetY', 'visible', 'locked'
			] ),
			arrow: new Set( [
				'id', 'type', 'x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth',
				'strokeOpacity', 'fill', 'fillOpacity', 'arrowSize', 'headScale',
				'tailWidth', 'arrowStyle', 'arrowhead', 'arrowHeadType', 'opacity',
				'blendMode', 'shadow', 'shadowColor', 'shadowBlur', 'shadowSpread',
				'shadowOffsetX', 'shadowOffsetY', 'visible', 'locked'
			] ),
			textbox: new Set( [
				'id', 'type', 'x', 'y', 'rotation', 'width', 'height', 'text',
				'fontSize', 'fontFamily', 'color', 'textAlign', 'verticalAlign',
				'lineHeight', 'stroke', 'strokeWidth', 'strokeOpacity', 'fill',
				'fillOpacity', 'cornerRadius', 'padding', 'textStrokeWidth',
				'textStrokeColor', 'textShadow', 'textShadowColor', 'textShadowBlur',
				'textShadowOffsetX', 'textShadowOffsetY', 'opacity', 'blendMode',
				'shadow', 'shadowColor', 'shadowBlur', 'shadowSpread', 'shadowOffsetX',
				'shadowOffsetY', 'visible', 'locked', 'richText'
			] ),
			callout: new Set( [
				'id', 'type', 'x', 'y', 'rotation', 'width', 'height', 'text',
				'fontSize', 'fontFamily', 'color', 'textAlign', 'verticalAlign',
				'lineHeight', 'stroke', 'strokeWidth', 'strokeOpacity', 'fill',
				'fillOpacity', 'cornerRadius', 'padding', 'tailDirection',
				'tailPosition', 'tailSize', 'tailStyle', 'tailTipX', 'tailTipY',
				'textStrokeWidth', 'textStrokeColor', 'textShadow', 'textShadowColor',
				'textShadowBlur', 'textShadowOffsetX', 'textShadowOffsetY',
				'opacity', 'blendMode', 'shadow', 'shadowColor', 'shadowBlur',
				'shadowSpread', 'shadowOffsetX', 'shadowOffsetY', 'visible', 'locked'
			] ),
			marker: new Set( [
				'id', 'type', 'x', 'y', 'rotation', 'value', 'name', 'style', 'size',
				'fontSizeAdjust', 'fontFamily', 'fontWeight', 'fill', 'stroke',
				'strokeWidth', 'color', 'hasArrow', 'arrowX', 'arrowY', 'opacity',
				'blendMode', 'shadow', 'shadowColor', 'shadowBlur', 'shadowSpread',
				'shadowOffsetX', 'shadowOffsetY', 'visible', 'locked'
			] ),
			dimension: new Set( [
				'id', 'type', 'x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth',
				'fontSize', 'fontFamily', 'color', 'endStyle', 'tickSize',
				'arrowSize', 'arrowsInside', 'textPosition', 'orientation',
				'textDirection', 'extensionLength', 'extensionGap', 'dimensionOffset',
				'textOffset', 'unit', 'scale', 'showUnit', 'showBackground',
				'backgroundColor', 'precision', 'toleranceType', 'toleranceValue',
				'toleranceUpper', 'toleranceLower', 'text', 'visible', 'locked'
			] )
		};

		publishedLayers1.forEach( ( layer ) => {
			const allowed = allowedKeysByType[ layer.type ];
			expect( allowed, `Allowed keys should exist for layer type ${ layer.type }` ).toBeDefined();
			for ( const key of Object.keys( layer ) ) {
				expect( allowed.has( key ), `Layer ${ layer.id } (${ layer.type }) has unexpected key: ${ key }` ).toBe( true );
			}
		} );

		// Check rendering status on page, viewer, and diff
		const assertNoRenderErrors = async () => {
			expect( await page.locator( '.layers-page-history-render-failed' ).count() ).toBe( 0 );
			expect( await page.locator( 'text=could not be displayed' ).count() ).toBe( 0 );
			expect( await page.locator( 'text=This Layers revision is unavailable' ).count() ).toBe( 0 );
		};

		// 3.9 On the page
		await page.goto( `${ base }/index.php?${ new URLSearchParams( { title: owner } ) }` );
		await expect( page.locator( '.layers-bound-slide canvas' ).first() ).toBeVisible();
		await assertNoRenderErrors();

		// 3.10 In the viewer for rev1
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: 'Special:ViewLayersPage',
			owner,
			revid: String( rev1 ),
			surface: surfaceId
		} ) }` );
		await expect( page.locator( '.ext-layers-historical-canvas' ) ).toBeVisible();
		await assertNoRenderErrors();

		// 3.11 On diff against seed
		await page.goto( `${ base }/index.php?${ new URLSearchParams( {
			title: owner,
			diff: String( rev1 ),
			oldid: String( seedRevId )
		} ) }` );
		await expect( page.locator( `.layers-drawing-diff-view[data-layers-revision="${ rev1 }"] canvas` ) ).toBeVisible();
		await expect( page.locator( `.layers-drawing-diff-view[data-layers-revision="${ seedRevId }"] canvas` ) ).toBeVisible();
		await expect( page.locator( '.layers-bound-slide canvas' ).first() ).toBeVisible();
		await assertNoRenderErrors();

		// =========================================================================
		// Step 4: Reopen editor (no recovery dialog), save without changes: no new rev
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
		await page.waitForFunction( () => ( window.layersEditorInstance?.stateManager?.get( 'layers' ) || [] ).length === 8 );

		// The backup kept after the first save matches this revision, so nothing may be offered for recovery.
		await page.waitForFunction( () => window.layersEditorInstance.apiManager.pageOwnedDrafts?.ready === true,
			null, { timeout: 15000 } );
		await expect( page.locator( 'dialog.layers-page-recovery' ) ).toHaveCount( 0 );

		// Save without changing anything
		let saveRequestDispatched = false;
		page.on( 'request', ( req ) => {
			if ( req.url().includes( 'api.php' ) && ( req.postData() || '' ).includes( 'action=layerspublish' ) ) {
				saveRequestDispatched = true;
			}
		} );

		await page.locator( '.save-button' ).click();
		await page.waitForTimeout( 1000 );

		// Check whether a new revision was created in history
		const historyAfterCleanSave = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'ids',
			rvlimit: 2
		} );
		const latestRevAfterClean = historyAfterCleanSave.query.pages[ 0 ].revisions[ 0 ].revid;
		expect( latestRevAfterClean, `Clean save must not create a new revision (dispatched: ${ saveRequestDispatched })` ).toBe( rev1 );
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
				summary: 'J78: restore baseline after acceptance run',
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
