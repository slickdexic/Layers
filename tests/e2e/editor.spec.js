/* eslint-env node */
/**
 * Layers Editor - E2E Tests
 * 
 * These tests require a running MediaWiki instance with the Layers extension installed.
 * Set the MW_SERVER environment variable to point to your MediaWiki instance.
 * 
 * Usage:
 *   MW_SERVER=http://localhost:8080 npx playwright test tests/e2e/editor.spec.js
 * 
 * For tests requiring login:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 npx playwright test
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage, getAcceptanceConfig } = require( './fixtures' );

// Skip editor tests if no MediaWiki server configured
const config = getAcceptanceConfig();
const hasServer = Boolean( process.env.MW_SERVER || config?.base );
const describeEditor = hasServer ? test.describe : test.describe.skip;

describeEditor( 'Layers Editor', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		// Login required for all editor operations
		await editorPage.login();
	} );

	describeEditor( 'Editor Loading', () => {
		test( 'can open the editor from the owning page overlay', async ( { page } ) => {
			const cfg = getAcceptanceConfig();
			const base = process.env.MW_SERVER || cfg?.base || 'http://localhost:8080';
			const owner = 'Layers_browser_acceptance';
			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&useskin=vector-2022` );
			const host = page.locator( '.layers-bound-slide.layers-bound-controls' ).first();
			await expect( host ).toBeVisible( { timeout: 15000 } );
			await host.hover();
			const editButton = host.locator( '.layers-viewer-overlay-btn--edit' );
			await expect( editButton ).toBeVisible();
			await Promise.all( [ page.waitForNavigation(), editButton.click() ] );
			expect( await editorPage.isEditorLoaded() ).toBe( true );
		} );

		test( 'editor has required components', async ( { page } ) => {
			await editorPage.openEditor();
			
			// Check for toolbar
			const toolbar = await page.$( editorPage.selectors.toolbar );
			expect( toolbar ).not.toBeNull();
			
			// Check for layer panel
			const layerPanel = await page.$( editorPage.selectors.layerPanel );
			expect( layerPanel ).not.toBeNull();
			
			// Check for canvas
			const canvas = await page.$( editorPage.selectors.canvas );
			expect( canvas ).not.toBeNull();
		} );
	} );

	describeEditor( 'Layer Creation', () => {
		test.beforeEach( async () => {
			await editorPage.openEditor();
		} );

		test( 'can create rectangle layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			// Select rectangle tool
			await editorPage.selectTool( 'rectangle' );
			
			// Draw rectangle on canvas
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			
			// Verify layer was created
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create circle layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 150, 150, 200, 200 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create text layer', async ( { page } ) => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'text' );
			await editorPage.clickCanvas( 150, 150 );
			
			// Wait for text input modal to appear (uses .text-input class in modal)
			const textInput = await page.waitForSelector( '.text-input, .layers-text-editor', { timeout: 5000 } );
			
			// Click to ensure focus
			await textInput.click();
			
			// Type some text
			await page.keyboard.type( 'Test Label' );
			await page.waitForTimeout( 200 );
			// Press Enter to confirm (Escape would cancel)
			await page.keyboard.press( 'Enter' );
			
			// Wait for layer to be created
			await page.waitForTimeout( 500 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create arrow layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'arrow' );
			await editorPage.drawOnCanvas( 50, 50, 200, 200 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create ellipse layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'ellipse' );
			await editorPage.drawOnCanvas( 100, 100, 250, 180 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create line layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'line' );
			await editorPage.drawOnCanvas( 50, 50, 250, 250 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create polygon layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'polygon' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create star layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'star' );
			await editorPage.drawOnCanvas( 150, 150, 250, 250 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		// Note: Blur tool was removed in v1.4.2. Use fill='blur' on any shape instead.

		test( 'can create path layer with pen tool', async ( { page } ) => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'path' );
			
			// Pen tool uses freehand drawing (mouse down, drag, mouse up)
			// Draw a path by dragging
			await editorPage.drawOnCanvas( 50, 50, 150, 100 );
			
			// Wait for path to be finalized
			await page.waitForTimeout( 500 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );
	} );

	describeEditor( 'Layer Manipulation', () => {
		test.beforeEach( async () => {
			await editorPage.openEditor();
			if ( ![ 'can undo layer creation', 'can redo undone action' ].includes( test.info().title ) ) {
				await editorPage.selectTool( 'rectangle' );
				await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			}
		} );

		test( 'can select layer by clicking', async () => {
			// Switch to pointer tool
			await editorPage.selectTool( 'pointer' );
			
			// Click on the layer
			await editorPage.clickCanvas( 150, 150 );
			
			// Selection handles are drawn on canvas, not DOM elements
			// Instead, verify the layer is selected by checking the layer panel
			const selectedLayer = await editorPage.page.$( '.layer-item.selected, .layer-item[aria-selected="true"]' );
			expect( selectedLayer ).not.toBeNull();
		} );

		test( 'can delete selected layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			// Select layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 150 );
			
			// Delete layer
			await editorPage.pressShortcut( 'Delete' );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount - 1 );
		} );

		test( 'can undo layer creation', async ( { page } ) => {
			const initialCount = await editorPage.getLayerCount();
			
			// Create a layer
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 300, 300, 350, 350 );
			
			// Wait for layer creation to complete and verify
			await page.waitForTimeout( 500 );
			const afterCreate = await editorPage.getLayerCount();
			expect( afterCreate ).toBe( initialCount + 1 );
			
			// Click on canvas to ensure focus before keyboard shortcut
			await editorPage.clickCanvas( 50, 50 );
			await page.waitForTimeout( 200 );
			
			// Undo
			await editorPage.undo();
			await page.waitForTimeout( 500 );
			
			expect( await editorPage.getLayerCount() ).toBe( initialCount );
		} );

		test( 'can redo undone action', async ( { page } ) => {
			const initialCount = await editorPage.getLayerCount();
			
			// Create layer
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 300, 300, 350, 350 );
			
			// Wait for layer creation to complete
			await page.waitForTimeout( 500 );
			expect( await editorPage.getLayerCount() ).toBe( initialCount + 1 );
			
			// Click on canvas to ensure focus before keyboard shortcut
			await editorPage.clickCanvas( 50, 50 );
			await page.waitForTimeout( 200 );
			
			// Undo
			await editorPage.undo();
			await page.waitForTimeout( 500 );
			expect( await editorPage.getLayerCount() ).toBe( initialCount );
			
			// Redo
			await editorPage.redo();
			await page.waitForTimeout( 500 );
			expect( await editorPage.getLayerCount() ).toBe( initialCount + 1 );
		} );
	} );

	describeEditor( 'Save and Load', () => {
		test.skip( process.env.CI !== 'true' || process.env.LAYERS_E2E_DISPOSABLE !== '1',
			'Save journeys require the disposable CI fixture' );
		test( 'radial diagonal radius and exact centres survive history, recovery and Save', async ( { page } ) => {
			test.setTimeout( 120000 );
			const initialSnapshot = await editorPage.readSnapshot(), errors = [];
			let release = () => {};
			page.on( 'pageerror', error => errors.push( error.message ) );
			const ready = () => expect( page.getByRole( 'button', { name: 'Check saved page', exact: true } ) ).toBeVisible();
			try {
				await editorPage.openEditor(); await editorPage.selectTool( 'text' ); await editorPage.clickCanvas( 120, 250 );
				await page.getByRole( 'textbox', { name: 'Type your text here...' } ).fill( 'GRADIENT TEXT' );
				await page.getByRole( 'button', { name: 'OK', exact: true } ).click();
				const id = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ).filter( layer => layer.type === 'text' ).at( -1 ).id );
				const model = () => page.evaluate( selected => window.layersEditorInstance.stateManager.get( 'layers' ).find( layer => layer.id === selected ), id );
				const select = () => page.locator( `.layer-item[data-layer-id="${ id }"] .layer-grab-area` ).click();
				await select(); await page.locator( 'input[data-prop="fontSize"]' ).fill( '72' );
				await page.locator( 'input[data-prop="fontSize"]' ).press( 'Tab' );
				await expect.poll( async () => ( await model() ).fontSize ).toBe( 72 );
				await page.locator( '.gradient-type-select' ).selectOption( 'radial' );
				await page.locator( '.gradient-preset-swatch' ).nth( 0 ).click(); await editorPage.save();
				const editNumber = async ( name, value ) => {
					const input = page.locator( `.gradient-${ name }-number` );
					await input.fill( '' ); await input.pressSequentially( value, { delay: 15 } ); await input.press( 'Tab' );
				};
				await editNumber( 'radius', '137.5' ); await editNumber( 'center-x', '12.5' ); await editNumber( 'center-y', '73.25' );
				await expect.poll( async () => ( await model() ).gradient ).toMatchObject( { radius: 1.375, centerX: 0.125, centerY: 0.7325 } );
				await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
				await page.locator( '.gradient-radius-slider' ).press( 'Home' );
				await expect.poll( async () => ( await model() ).gradient.radius ).toBe( 0 );
				await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
				// Use editor history; Ctrl+Z inside a numeric input belongs to that input.
				await page.getByRole( 'button', { name: /^Undo:/ } ).click(); await expect.poll( async () => ( await model() ).gradient.radius ).toBe( 1.375 );
				await page.getByRole( 'button', { name: /^Redo:/ } ).click(); await expect.poll( async () => ( await model() ).gradient.radius ).toBe( 0 );
				expect( await page.evaluate( () => window.layersEditorInstance.apiManager.pageOwnedDrafts.flushDurably() ) ).toBe( true );
				await page.reload(); await page.getByRole( 'button', { name: 'Continue draft', exact: true } ).click(); await ready();
				await select(); await expect( page.locator( '.gradient-radius-number' ) ).toHaveValue( '0' );
				await expect( page.locator( '.gradient-center-x-number' ) ).toHaveValue( '12.5' );
				await expect( page.locator( '.gradient-center-y-number' ) ).toHaveValue( '73.25' );
				await editorPage.save();
				expect( ( await editorPage.readSnapshot() ).surfaces[ 0 ].layers.find( layer => layer.id === id ).gradient )
					.toMatchObject( { radius: 0, centerX: 0.125, centerY: 0.7325 } );
				await page.getByRole( 'button', { name: 'Close', exact: true } ).click();
				await page.waitForFunction( () => window.mw?.config?.get( 'wgPageName' ) === 'Layers_browser_acceptance' );
				await editorPage.openEditor(); await select();
				await expect( page.locator( '.gradient-radius-number' ) ).toHaveValue( '0' );
				await editNumber( 'radius', '200' ); await editNumber( 'center-x', '0' ); await editNumber( 'center-y', '100' );
				let entered;
				const held = new Promise( resolve => { release = resolve; } ), committed = new Promise( resolve => { entered = resolve; } );
				await page.route( '**/api.php', async route => {
					if ( new URLSearchParams( route.request().postData() || '' ).get( 'action' ) !== 'layerspublish' ) { await route.continue(); return; }
					const response = await route.fetch(); entered(); await held; await route.fulfill( { response } );
				} );
				const saving = editorPage.save(); await committed;
				await editNumber( 'center-y', '50' ); await expect.poll( async () => ( await model() ).gradient.centerY ).toBe( 0.5 );
				// Deliberately let the 300 ms property-history timer fire while publication is pending.
				await page.waitForTimeout( 600 ); release(); await saving;
				await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
				expect( await page.evaluate( () => window.layersEditorInstance.hasUnsavedChanges() ) ).toBe( true );
				await page.getByRole( 'button', { name: /^Undo:/ } ).click(); await expect.poll( async () => ( await model() ).gradient.centerY ).toBe( 1 );
				await page.getByRole( 'button', { name: /^Redo:/ } ).click(); await expect.poll( async () => ( await model() ).gradient.centerY ).toBe( 0.5 );
				await page.unrouteAll( { behavior: 'wait' } );
				await editorPage.save();
				expect( ( await editorPage.readSnapshot() ).surfaces[ 0 ].layers.find( layer => layer.id === id ).gradient )
					.toMatchObject( { radius: 2, centerX: 0, centerY: 0.5 } );
				expect( errors ).toEqual( [] );
			} finally { release(); await page.unrouteAll( { behavior: 'wait' } ); await editorPage.restoreSnapshot( initialSnapshot ); }
		} );

		test( 'gradient to Solid Color survives Undo, recovery and native Save', async ( { page } ) => {
			test.setTimeout( 120000 );
			const initialSnapshot = await editorPage.readSnapshot(), expected = [], errors = [];
			page.on( 'pageerror', error => errors.push( error.message ) );
			page.on( 'console', message => { if ( message.type() === 'error' && message.text().includes( 'saveLayers rejected' ) ) errors.push( message.text() ); } );
			const model = id => page.evaluate( selected => window.layersEditorInstance.stateManager.get( 'layers' ).find( layer => layer.id === selected ), id );
			const select = id => page.locator( `.layer-item[data-layer-id="${ id }"] .layer-grab-area` ).click();
			try {
				await editorPage.openEditor();
				for ( const type of [ 'arrow', 'text' ] ) {
					await editorPage.selectTool( type );
					if ( type === 'arrow' ) { await editorPage.drawOnCanvas( 100, 120, 350, 160 ); }
					else {
						await editorPage.clickCanvas( 120, 250 );
						await page.getByRole( 'textbox', { name: 'Type your text here...' } ).fill( 'Solid fill recovery' );
						await page.getByRole( 'button', { name: 'OK', exact: true } ).click();
					}
					const id = await page.evaluate( shape => window.layersEditorInstance.stateManager.get( 'layers' ).filter( layer => layer.type === shape ).at( -1 ).id, type );
					await select( id ); await page.locator( '.gradient-type-select' ).selectOption( 'radial' );
					await page.locator( '.gradient-preset-swatch' ).nth( 0 ).click();
					await expect.poll( async () => ( await model( id ) ).gradient?.type ).toBe( 'radial' );
					await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
					expected.push( await model( id ) );
				}
				await editorPage.save();
				for ( const layer of expected ) {
					await select( layer.id ); await page.locator( '.gradient-type-select' ).selectOption( 'solid' );
					await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
					await expect.poll( async () => ( await model( layer.id ) ).gradient ).toBeNull();
					await editorPage.undo(); await expect.poll( async () => ( await model( layer.id ) ).gradient ).toEqual( layer.gradient );
					await editorPage.redo(); await expect.poll( async () => ( await model( layer.id ) ).gradient ).toBeNull();
				}
				expect( await page.evaluate( () => window.layersEditorInstance.apiManager.pageOwnedDrafts.flushDurably() ) ).toBe( true );
				await page.reload(); await page.getByRole( 'button', { name: 'Continue draft', exact: true } ).click();
				await expect( page.getByRole( 'button', { name: 'Check saved page', exact: true } ) ).toBeVisible();
				await editorPage.save();
				const saved = await editorPage.readSnapshot();
				for ( const layer of expected ) {
					expect( saved.surfaces[ 0 ].layers.find( item => item.id === layer.id ) ).toEqual( { ...layer, gradient: null } );
				}
				await page.getByRole( 'button', { name: 'Close', exact: true } ).click();
				await page.waitForFunction( () => window.mw?.config?.get( 'wgPageName' ) === 'Layers_browser_acceptance' );
				await editorPage.openEditor();
				for ( const layer of expected ) {
					await select( layer.id ); await expect( page.locator( '.gradient-type-select' ) ).toHaveValue( 'solid' );
					expect( await model( layer.id ) ).toEqual( { ...layer, gradient: null } );
				}
				await select( expected[ 0 ].id ); await page.locator( '.gradient-type-select' ).selectOption( 'linear' );
				await editorPage.save(); await page.locator( '.gradient-type-select' ).selectOption( 'solid' );
				await editorPage.save();
				expect( ( await editorPage.readSnapshot() ).surfaces[ 0 ].layers.find( layer => layer.id === expected[ 0 ].id ).gradient ).toBeNull();
				expect( errors ).toEqual( [] );
			} finally { await editorPage.restoreSnapshot( initialSnapshot ); }
		} );

		test( 'Discard recovery then immediate Save and Close publishes once', async ( { page } ) => {
			test.setTimeout( 120000 );
			const initialSnapshot = await editorPage.readSnapshot(), errors = [];
			page.on( 'pageerror', error => errors.push( error.message ) );
			page.on( 'console', message => { if ( message.type() === 'error' && message.text().includes( 'saveLayers rejected' ) ) errors.push( message.text() ); } );
			let release, entered, publications = 0;
			const held = new Promise( resolve => { release = resolve; } );
			const committed = new Promise( resolve => { entered = resolve; } );
			try {
				await editorPage.openEditor();
				await editorPage.selectTool( 'arrow' ); await editorPage.drawOnCanvas( 100, 100, 300, 200 );
				await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
				expect( await page.evaluate( () => window.layersEditorInstance.apiManager.pageOwnedDrafts.flushDurably() ) ).toBe( true );
				await page.reload();
				await page.getByRole( 'button', { name: 'Discard draft and open saved version', exact: true } ).click();
				await page.getByRole( 'button', { name: 'Discard draft', exact: true } ).click();
				await expect( page.getByRole( 'button', { name: 'Check saved page', exact: true } ) ).toBeVisible();
				await editorPage.selectTool( 'arrow' ); await editorPage.drawOnCanvas( 100, 100, 320, 220 );
				const expected = await page.evaluate( () => window.layersEditorInstance.stateManager.get( 'layers' ) );
				await page.route( '**/api.php', async route => {
					if ( new URLSearchParams( route.request().postData() || '' ).get( 'action' ) !== 'layerspublish' ) { await route.continue(); return; }
					publications++;
					const response = await route.fetch(); entered(); await held; await route.fulfill( { response } );
				} );
				// helper.save() waits for completion, which hid this race.
				await page.locator( '.save-button' ).click(); await committed;
				await page.locator( '.save-button' ).click();
				await page.getByRole( 'button', { name: 'Close', exact: true } ).click();
				await expect( page.getByRole( 'alertdialog' ) ).toHaveCount( 0 );
				expect( await page.evaluate( () => window.layersEditorInstance._closePending ) ).toBe( true );
				release();
				await page.waitForFunction( () => window.mw?.config?.get( 'wgPageName' ) === 'Layers_browser_acceptance' );
				expect( ( await editorPage.readSnapshot() ).surfaces.find( surface => surface.id === 'presentation' ).layers ).toEqual( expected );
				expect( publications ).toBe( 1 ); expect( errors ).toEqual( [] );
			} finally {
				release(); await page.unrouteAll( { behavior: 'wait' } );
				await editorPage.restoreSnapshot( initialSnapshot );
			}
		} );

		test( 'arrow and text gradients survive recovery choices and exact Save/reopen', async ( { page } ) => {
			test.setTimeout( 120000 );
			const pageErrors = []; page.on( 'pageerror', error => pageErrors.push( error.message ) );
			const initialSnapshot = await editorPage.readSnapshot();
			const model = id => page.evaluate( selected => window.layersEditorInstance.stateManager.get( 'layers' )
				.find( layer => layer.id === selected ), id );
			const expected = [];
			try {
				await editorPage.openEditor();
				for ( const type of [ 'arrow', 'text' ] ) {
					await page.getByRole( 'button', { name: type === 'arrow' ? 'Arrow' : 'Text', exact: true } ).click();
					await page.getByRole( 'menuitem', { name: type === 'arrow' ? 'Arrow A' : 'Text T', exact: true } ).click();
					if ( type === 'arrow' ) {
						await editorPage.drawOnCanvas( 100, 120, 350, 160 );
					} else {
						await editorPage.clickCanvas( 120, 250 );
						await page.getByRole( 'textbox', { name: 'Type your text here...' } ).fill( 'Gradient text' );
						await page.getByRole( 'button', { name: 'OK', exact: true } ).click();
					}
					await expect.poll( () => page.evaluate( shape => window.layersEditorInstance.stateManager.get( 'layers' )
						.some( layer => layer.type === shape ), type ), `created ${ type } layer` ).toBe( true );
					const id = await page.evaluate( shape => window.layersEditorInstance.stateManager.get( 'layers' )
						.filter( layer => layer.type === shape ).at( -1 ).id, type );
					await page.locator( `.layer-item[data-layer-id="${ id }"] .layer-grab-area` ).click();
					const fillType = page.locator( '.gradient-type-select' );
					await fillType.selectOption( 'linear' );
					const presets = await page.evaluate( () => Object.values( window.Layers.Renderers.GradientRenderer.getPresets() ) );
					for ( let index = 0; index < 3; index++ ) {
						await page.locator( '.gradient-preset-swatch' ).nth( index ).click();
						await expect.poll( async () => ( await model( id ) ).gradient ).toEqual( presets[ index ] );
						// Let normal history capture replace the layer objects before the next edit.
						await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
					}
					const linearPixels = await page.locator( '.layers-canvas' ).evaluate( canvas => canvas.toDataURL() );
					await fillType.selectOption( 'radial' );
					await expect.poll( async () => ( await model( id ) ).gradient.type ).toBe( 'radial' );
					await expect.poll( () => page.locator( '.layers-canvas' ).evaluate( canvas => canvas.toDataURL() ) )
						.not.toBe( linearPixels );
					await page.locator( '.gradient-radius-slider' ).press( 'Home' );
					await expect.poll( async () => ( await model( id ) ).gradient.radius ).toBe( 0 );
					await fillType.selectOption( 'linear' );
					await page.locator( '.gradient-angle-slider' ).press( 'End' );
					await expect.poll( async () => ( await model( id ) ).gradient.angle ).toBe( 360 );
					expected.push( { id, gradient: ( await model( id ) ).gradient } );
				}
				await editorPage.save();
				const saved = await editorPage.readSnapshot();
				for ( const layer of expected ) {
					expect( saved.surfaces[ 0 ].layers.find( item => item.id === layer.id ).gradient ).toEqual( layer.gradient );
				}
				const arrow = expected[ 0 ];
				const backups = () => page.evaluate( () => Object.fromEntries( Object.entries( localStorage )
					.filter( ( [ key ] ) => key.startsWith( 'layers-page-owned-draft-v1:' ) ) ) );
				const editAngle = async value => {
					await page.locator( `.layer-item[data-layer-id="${ arrow.id }"] .layer-grab-area` ).click();
					await page.locator( '.gradient-angle-slider' ).press( value === 0 ? 'Home' : 'End' );
					await expect.poll( async () => ( await model( arrow.id ) ).gradient.angle ).toBe( value );
					await page.waitForFunction( () => !window.layersEditorInstance._updateLayerSaveTimer );
					expect( await page.evaluate( () => window.layersEditorInstance.apiManager.pageOwnedDrafts.flushDurably() ) ).toBe( true );
				};
				const ready = () => expect( page.getByRole( 'button', { name: 'Check saved page', exact: true } ) ).toBeVisible();
				await editAngle( 0 );
				const continued = await backups();
				await page.reload(); await page.getByRole( 'button', { name: 'Continue draft', exact: true } ).click(); await ready();
				await expect.poll( async () => ( await model( arrow.id ) ).gradient.angle ).toBe( 0 );
				await page.getByRole( 'button', { name: /^Undo:/ } ).click();
				await expect.poll( async () => ( await model( arrow.id ) ).gradient.angle ).toBe( 360 );
				await page.getByRole( 'button', { name: /^Redo:/ } ).click();
				await expect.poll( async () => ( await model( arrow.id ) ).gradient.angle ).toBe( 0 );
				await editorPage.save();
				await editAngle( 360 );
				const doomed = await page.evaluate( () => {
					const controller = window.layersEditorInstance.apiManager.pageOwnedDrafts.controller;
					const key = controller.store._recordKey( controller.store._validateAndBuildKey( controller.getRecoveryScope() ), controller.store._writerId );
					return { key, raw: localStorage.getItem( key ) };
				} );
				expect( doomed.raw ).toBeTruthy();
				const beforeDiscard = await backups();
				await page.reload();
				await page.getByRole( 'button', { name: 'Discard draft and open saved version', exact: true } ).click();
				await expect( page.getByRole( 'button', { name: 'Discard draft', exact: true } ) ).toBeVisible();
				await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
				expect( await backups() ).toEqual( beforeDiscard );
				await page.getByRole( 'button', { name: 'Discard draft and open saved version', exact: true } ).click();
				await page.getByRole( 'button', { name: 'Discard draft', exact: true } ).click(); await ready();
				expect( ( await backups() )[ doomed.key ] ).toBeUndefined();
				for ( const [ key, raw ] of Object.entries( continued ) ) { expect( ( await backups() )[ key ] ).toBe( raw ); }
				await expect.poll( async () => ( await model( arrow.id ) ).gradient.angle ).toBe( 0 );
				await editAngle( 360 ); arrow.gradient = ( await model( arrow.id ) ).gradient;
				await editorPage.save();
				const afterRecovery = await editorPage.readSnapshot();
				for ( const layer of expected ) {
					expect( afterRecovery.surfaces[ 0 ].layers.find( item => item.id === layer.id ).gradient ).toEqual( layer.gradient );
				}
				await page.getByRole( 'button', { name: 'Close', exact: true } ).click();
				await page.waitForFunction( () => window.mw?.config?.get( 'wgPageName' ) === 'Layers_browser_acceptance' );
				await editorPage.openEditor();
				for ( const layer of expected ) {
					expect( ( await model( layer.id ) ).gradient ).toEqual( layer.gradient );
				}
				await editAngle( 0 ); const beforeCancel = await backups();
				await page.reload(); await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
				await page.waitForFunction( () => window.mw?.config?.get( 'wgPageName' ) === 'Layers_browser_acceptance' );
				expect( await backups() ).toEqual( beforeCancel ); expect( pageErrors ).toEqual( [] );
			} finally {
				await editorPage.restoreSnapshot( initialSnapshot );
			}
		} );

		test( 'can save layers', async () => {
			const initialSnapshot = await editorPage.readSnapshot();
			try {
				await editorPage.openEditor();
				
				// Create a layer
				await editorPage.selectTool( 'rectangle' );
				await editorPage.drawOnCanvas( 100, 100, 200, 200 );
				
				// Wait for layer to be created and dirty state to be set
				await editorPage.page.waitForTimeout( 500 );
				
				// Save and verify response
				const response = await editorPage.save();
				expect( response.ok() ).toBe( true );
			} finally {
				await editorPage.restoreSnapshot( initialSnapshot );
			}
		} );

		test( 'saved layers persist on reload', async () => {
			const initialSnapshot = await editorPage.readSnapshot();
			try {
				// Open editor and create layer
				await editorPage.openEditor();
				await editorPage.selectTool( 'rectangle' );
				await editorPage.drawOnCanvas( 100, 100, 200, 200 );
				
				// Wait for layer to be created
				await editorPage.page.waitForTimeout( 300 );
				
				const countBeforeSave = await editorPage.getLayerCount();
				
				// Save
				await editorPage.save();
				
				// Wait a moment for save to complete
				await editorPage.page.waitForTimeout( 1000 );
				
				// Reload editor
				await editorPage.page.reload();
				await editorPage.openEditor();
				
				// Verify layers persisted
				const countAfterReload = await editorPage.getLayerCount();
				expect( countAfterReload ).toBe( countBeforeSave );
			} finally {
				await editorPage.restoreSnapshot( initialSnapshot );
			}
		} );
	} );

	describeEditor( 'Keyboard Shortcuts', () => {
		test.beforeEach( async () => {
			await editorPage.openEditor();
		} );

		test( 'V key selects pointer tool', async () => {
			// First select a different tool
			await editorPage.selectTool( 'rectangle' );
			
			// Press V for pointer
			await editorPage.page.keyboard.press( 'v' );
			
			// Verify pointer tool is selected (check for active class)
			const pointerTool = await editorPage.page.$( `${ editorPage.selectors.pointerTool }.active, ${ editorPage.selectors.pointerTool }[aria-pressed="true"]` );
			expect( pointerTool ).not.toBeNull();
		} );

		test( 'Ctrl+A selects all layers', async () => {
			const initialCount = await editorPage.getLayerCount();
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 150, 150, 200, 200 );

			await editorPage.page.keyboard.press( 'Control+a' );

			const counts = await editorPage.page.evaluate( () => {
				const state = window.layersEditorInstance.stateManager;
				return [ state.get( 'selectedLayerIds' ).length, state.get( 'layers' ).length ];
			} );
			expect( counts[ 1 ] ).toBe( initialCount + 2 );
			expect( counts[ 0 ] ).toBe( counts[ 1 ] );
		} );
	} );
} );

// Tests that can run without MediaWiki
test.describe( 'Editor Component Tests (Offline)', () => {
	test( 'LayersEditor class is defined when script loads', async () => {
		// This test requires serving the JS files, so skip for now
		test.skip();
	} );
} );
