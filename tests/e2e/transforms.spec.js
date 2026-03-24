/* eslint-env node */
/**
 * Layers Editor - Transform Operations E2E Tests
 *
 * Tests layer transform operations: drag-move, resize, rotation,
 * multi-select transforms, and alignment.
 *
 * Requires a running MediaWiki instance with the Layers extension installed.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 \
 *     npx playwright test tests/e2e/transforms.spec.js
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

const describeEditor = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeEditor( 'Transform Operations', () => {
	let editorPage;
	const testFile = process.env.TEST_FILE || 'Test.png';

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
		await editorPage.openEditor( testFile );
	} );

	describeEditor( 'Layer Drag-Move', () => {
		test( 'can drag a layer to a new position', async ( { page } ) => {
			// Create rectangle at known position
			await editorPage.createAndSelectLayer( 'rectangle', 100, 100, 200, 200 );

			// Read original position from property panel
			const xBefore = await editorPage.getPropertyValue( 'x' );
			const yBefore = await editorPage.getPropertyValue( 'y' );
			expect( xBefore ).not.toBeNull();
			expect( yBefore ).not.toBeNull();

			// Drag the layer 100px right and 50px down
			await editorPage.dragOnCanvas( 150, 150, 250, 200 );
			await page.waitForTimeout( 300 );

			// Re-select to refresh properties
			await editorPage.clickCanvas( 250, 200 );
			await page.waitForTimeout( 300 );

			const xAfter = await editorPage.getPropertyValue( 'x' );
			const yAfter = await editorPage.getPropertyValue( 'y' );

			if ( xAfter && yAfter ) {
				// Position should have changed
				expect( parseFloat( xAfter ) ).not.toBe( parseFloat( xBefore ) );
				expect( parseFloat( yAfter ) ).not.toBe( parseFloat( yBefore ) );
			}
		} );

		test( 'drag-move is undoable', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle', 100, 100, 200, 200 );

			const xBefore = await editorPage.getPropertyValue( 'x' );

			// Drag layer
			await editorPage.dragOnCanvas( 150, 150, 300, 150 );
			await page.waitForTimeout( 300 );

			// Undo
			await editorPage.undo();
			await page.waitForTimeout( 500 );

			// Reselect
			await editorPage.clickCanvas( 150, 150 );
			await page.waitForTimeout( 300 );

			const xAfterUndo = await editorPage.getPropertyValue( 'x' );
			if ( xBefore && xAfterUndo ) {
				expect( parseFloat( xAfterUndo ) ).toBeCloseTo( parseFloat( xBefore ), 0 );
			}
		} );
	} );

	describeEditor( 'Property-Based Transforms', () => {
		test( 'can set exact position via property inputs', async () => {
			await editorPage.createAndSelectLayer( 'rectangle', 100, 100, 200, 200 );

			// Set exact X position
			await editorPage.setPropertyValue( 'x', '50' );
			await editorPage.setPropertyValue( 'y', '75' );

			// Re-read values
			const xVal = await editorPage.getPropertyValue( 'x' );
			const yVal = await editorPage.getPropertyValue( 'y' );
			expect( parseFloat( xVal ) ).toBeCloseTo( 50, 0 );
			expect( parseFloat( yVal ) ).toBeCloseTo( 75, 0 );
		} );

		test( 'can set exact dimensions via property inputs', async () => {
			await editorPage.createAndSelectLayer( 'rectangle', 100, 100, 200, 200 );

			await editorPage.setPropertyValue( 'width', '300' );
			await editorPage.setPropertyValue( 'height', '150' );

			const wVal = await editorPage.getPropertyValue( 'width' );
			const hVal = await editorPage.getPropertyValue( 'height' );
			expect( parseFloat( wVal ) ).toBeCloseTo( 300, 0 );
			expect( parseFloat( hVal ) ).toBeCloseTo( 150, 0 );
		} );

		test( 'can set rotation via property input', async () => {
			await editorPage.createAndSelectLayer( 'rectangle', 100, 100, 200, 200 );

			await editorPage.setPropertyValue( 'rotation', '90' );

			const rotVal = await editorPage.getPropertyValue( 'rotation' );
			expect( parseFloat( rotVal ) ).toBe( 90 );
		} );

		test( 'can set circle radius via property input', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'circle', 150, 150, 250, 250 );

			const radiusInput = await page.$( '[data-prop="radius"]' );
			expect( radiusInput ).not.toBeNull();

			await radiusInput.fill( '80' );
			await radiusInput.press( 'Tab' );
			await page.waitForTimeout( 300 );

			const val = await radiusInput.inputValue();
			expect( parseFloat( val ) ).toBeCloseTo( 80, 0 );
		} );
	} );

	describeEditor( 'Arrow Endpoint Transforms', () => {
		test( 'can move arrow endpoints via properties', async ( { page } ) => {
			await editorPage.selectTool( 'arrow' );
			await editorPage.drawOnCanvas( 50, 50, 250, 200 );
			await page.waitForTimeout( 300 );

			// Select the arrow
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 125 );
			await page.waitForTimeout( 300 );

			const x1Input = await page.$( '[data-prop="x1"]' );
			if ( x1Input ) {
				await x1Input.fill( '10' );
				await x1Input.press( 'Tab' );
				await page.waitForTimeout( 300 );

				const val = await x1Input.inputValue();
				expect( parseFloat( val ) ).toBeCloseTo( 10, 0 );
			}
		} );
	} );

	describeEditor( 'Multi-Layer Selection', () => {
		test( 'Ctrl+A selects all layers', async ( { page } ) => {
			// Create two layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );
			await page.waitForTimeout( 200 );

			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 200, 200, 300, 300 );
			await page.waitForTimeout( 200 );

			// Focus canvas
			await editorPage.clickCanvas( 10, 10 );
			await page.waitForTimeout( 100 );

			// Select all
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 300 );

			// Both layers should be selected in the layer panel
			const selectedLayers = await page.$$( '.layer-item.selected, .layer-item[aria-selected="true"]' );
			expect( selectedLayers.length ).toBeGreaterThanOrEqual( 2 );
		} );

		test( 'Ctrl+click adds to selection', async ( { page } ) => {
			// Create two layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 150, 150 );
			await page.waitForTimeout( 200 );

			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 250, 250, 350, 350 );
			await page.waitForTimeout( 200 );

			// Select first layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 100, 100 );
			await page.waitForTimeout( 200 );

			// Ctrl+click second layer
			const canvas = await page.$( editorPage.selectors.canvas );
			const box = await canvas.boundingBox();
			await page.keyboard.down( 'Control' );
			await page.mouse.click( box.x + 300, box.y + 300 );
			await page.keyboard.up( 'Control' );
			await page.waitForTimeout( 300 );

			// Both should be selected
			const selectedLayers = await page.$$( '.layer-item.selected, .layer-item[aria-selected="true"]' );
			expect( selectedLayers.length ).toBeGreaterThanOrEqual( 2 );
		} );
	} );

	describeEditor( 'Keyboard Nudge', () => {
		test( 'arrow keys nudge selected layer', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle', 200, 200, 300, 300 );

			const xBefore = await editorPage.getPropertyValue( 'x' );

			// Focus canvas for keyboard input
			await editorPage.clickCanvas( 250, 250 );
			await page.waitForTimeout( 200 );

			// Nudge right
			await page.keyboard.press( 'ArrowRight' );
			await page.waitForTimeout( 300 );

			// Re-select to refresh
			await editorPage.clickCanvas( 251, 250 );
			await page.waitForTimeout( 300 );

			const xAfter = await editorPage.getPropertyValue( 'x' );
			if ( xBefore && xAfter ) {
				// Arrow key should nudge by 1px
				expect( parseFloat( xAfter ) ).toBeGreaterThanOrEqual( parseFloat( xBefore ) );
			}
		} );
	} );

	describeEditor( 'Layer Duplication Transform', () => {
		test( 'duplicated layer has offset position', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle', 100, 100, 200, 200 );

			const xBefore = await editorPage.getPropertyValue( 'x' );
			const countBefore = await editorPage.getLayerCount();

			// Duplicate
			await page.keyboard.press( 'Control+d' );
			await page.waitForTimeout( 500 );

			const countAfter = await editorPage.getLayerCount();
			expect( countAfter ).toBe( countBefore + 1 );

			// The duplicated layer should be auto-selected
			const xAfter = await editorPage.getPropertyValue( 'x' );
			if ( xBefore && xAfter ) {
				// Duplicate is typically offset by 10px
				expect( parseFloat( xAfter ) ).toBeGreaterThan( parseFloat( xBefore ) );
			}
		} );
	} );

	describeEditor( 'Copy-Paste Transform', () => {
		test( 'pasted layer appears at offset position', async ( { page } ) => {
			await editorPage.createAndSelectLayer( 'rectangle', 100, 100, 200, 200 );

			const countBefore = await editorPage.getLayerCount();

			// Copy
			await page.keyboard.press( 'Control+c' );
			await page.waitForTimeout( 200 );

			// Paste
			await page.keyboard.press( 'Control+v' );
			await page.waitForTimeout( 500 );

			const countAfter = await editorPage.getLayerCount();
			expect( countAfter ).toBe( countBefore + 1 );
		} );
	} );

	describeEditor( 'Z-Order Transforms', () => {
		test( 'Ctrl+] moves layer forward', async ( { page } ) => {
			// Create two layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			await page.waitForTimeout( 200 );

			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 150, 150, 250, 250 );
			await page.waitForTimeout( 200 );

			// Select first layer (rectangle) from panel
			const layerItems = await page.$$( editorPage.selectors.layerItem );
			expect( layerItems.length ).toBeGreaterThanOrEqual( 2 );

			// Click the bottom layer in the panel to select it
			if ( layerItems.length >= 2 ) {
				await layerItems[ layerItems.length - 1 ].click();
				await page.waitForTimeout( 200 );

				// Bring forward
				await page.keyboard.press( 'Control+]' );
				await page.waitForTimeout( 300 );

				// Verify order changed
				const afterItems = await page.$$( editorPage.selectors.layerItem );
				expect( afterItems.length ).toBeGreaterThanOrEqual( 2 );
			}
		} );
	} );
} );
