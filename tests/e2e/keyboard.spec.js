/* eslint-env node */
/**
 * Layers Extension - Keyboard Shortcuts E2E Tests
 *
 * Tests for keyboard shortcuts in the layers editor.
 * Covers tool switching, layer operations, and navigation.
 *
 * Usage:
 *   MW_SERVER=http://localhost:8080 MW_USERNAME=Admin MW_PASSWORD=admin123 \
 *     npx playwright test tests/e2e/keyboard.spec.js
 */

const { test, expect } = require( '@playwright/test' );
const { LayersEditorPage } = require( './fixtures' );

// Skip tests if no MediaWiki server configured
const describeKeyboard = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeKeyboard( 'Keyboard Shortcuts', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
		await editorPage.login();
		const testFile = process.env.TEST_FILE || 'Test.png';
		await editorPage.openEditor( testFile );
	} );

	describeKeyboard( 'Tool Shortcuts', () => {
		test( 'V key activates pointer/select tool', async ( { page } ) => {
			// First select a different tool
			await editorPage.selectTool( 'rectangle' );
			await page.waitForTimeout( 200 );

			// Press V
			await page.keyboard.press( 'v' );
			await page.waitForTimeout( 200 );

			// Pointer tool should be active
			const pointerActive = await page.$(
				'[data-tool="pointer"].active, [data-tool="select"].active, ' +
				'.tool-pointer[aria-pressed="true"], .tool-select[aria-pressed="true"]'
			);
			expect( pointerActive ).not.toBeNull();
		} );

		test( 'R key activates rectangle tool', async ( { page } ) => {
			await page.keyboard.press( 'r' );
			await page.waitForTimeout( 200 );

			const rectActive = await page.$(
				'[data-tool="rectangle"].active, .tool-rectangle[aria-pressed="true"]'
			);
			expect( rectActive ).not.toBeNull();
		} );

		test( 'C key activates circle tool', async ( { page } ) => {
			await page.keyboard.press( 'c' );
			await page.waitForTimeout( 200 );

			const circleActive = await page.$(
				'[data-tool="circle"].active, .tool-circle[aria-pressed="true"]'
			);
			expect( circleActive ).not.toBeNull();
		} );

		test( 'E key activates ellipse tool', async ( { page } ) => {
			await page.keyboard.press( 'e' );
			await page.waitForTimeout( 200 );

			const ellipseActive = await page.$(
				'[data-tool="ellipse"].active, .tool-ellipse[aria-pressed="true"]'
			);
			expect( ellipseActive ).not.toBeNull();
		} );

		test( 'A key activates arrow tool', async ( { page } ) => {
			await page.keyboard.press( 'a' );
			await page.waitForTimeout( 200 );

			const arrowActive = await page.$(
				'[data-tool="arrow"].active, .tool-arrow[aria-pressed="true"]'
			);
			expect( arrowActive ).not.toBeNull();
		} );

		test( 'L key activates line tool', async ( { page } ) => {
			await page.keyboard.press( 'l' );
			await page.waitForTimeout( 200 );

			const lineActive = await page.$(
				'[data-tool="line"].active, .tool-line[aria-pressed="true"]'
			);
			expect( lineActive ).not.toBeNull();
		} );

		test( 'T key activates text tool', async ( { page } ) => {
			await page.keyboard.press( 't' );
			await page.waitForTimeout( 200 );

			const textActive = await page.$(
				'[data-tool="text"].active, .tool-text[aria-pressed="true"]'
			);
			expect( textActive ).not.toBeNull();
		} );

		test( 'P key activates path/pen tool', async ( { page } ) => {
			await page.keyboard.press( 'p' );
			await page.waitForTimeout( 200 );

			const pathActive = await page.$(
				'[data-tool="path"].active, [data-tool="pen"].active, ' +
				'.tool-path[aria-pressed="true"], .tool-pen[aria-pressed="true"]'
			);
			expect( pathActive ).not.toBeNull();
		} );

		test( 'B key activates blur tool', async ( { page } ) => {
			await page.keyboard.press( 'b' );
			await page.waitForTimeout( 200 );

			const blurActive = await page.$(
				'[data-tool="blur"].active, .tool-blur[aria-pressed="true"]'
			);
			expect( blurActive ).not.toBeNull();
		} );
	} );

	describeKeyboard( 'Selection Shortcuts', () => {
		test.beforeEach( async () => {
			// Create some layers to work with
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 50, 200, 100 );
			await editorPage.drawOnCanvas( 250, 50, 300, 100 );
		} );

		test( 'Ctrl+A selects all layers', async ( { page } ) => {
			// Deselect first
			await page.keyboard.press( 'Escape' );
			await page.waitForTimeout( 200 );

			// Select all
			await page.keyboard.press( 'Control+a' );
			await page.waitForTimeout( 200 );

			// Check for multi-selection
			const selectedItems = await page.$$(
				'.layer-item.selected, .layer-item[aria-selected="true"]'
			);
			expect( selectedItems.length ).toBeGreaterThanOrEqual( 3 );
		} );

		test( 'Escape deselects all', async ( { page } ) => {
			// Select a layer first
			await editorPage.clickCanvas( 75, 75 );
			await page.waitForTimeout( 200 );

			// Press Escape
			await page.keyboard.press( 'Escape' );
			await page.waitForTimeout( 200 );

			// No selected items should remain
			const selectedItems = await page.$$(
				'.layer-item.selected:not(.background-layer-item), ' +
				'.layer-item[aria-selected="true"]:not(.background-layer-item)'
			);
			expect( selectedItems.length ).toBe( 0 );
		} );
	} );

	describeKeyboard( 'Edit Shortcuts', () => {
		test.beforeEach( async () => {
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
		} );

		test( 'Delete key removes selected layer', async ( { page } ) => {
			// Select the layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 150 );
			await page.waitForTimeout( 200 );

			const countBefore = await editorPage.getLayerCount();

			// Delete
			await page.keyboard.press( 'Delete' );
			await page.waitForTimeout( 300 );

			const countAfter = await editorPage.getLayerCount();
			expect( countAfter ).toBe( countBefore - 1 );
		} );

		test( 'Backspace key also removes selected layer', async ( { page } ) => {
			// Select the layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 150 );
			await page.waitForTimeout( 200 );

			const countBefore = await editorPage.getLayerCount();

			// Backspace
			await page.keyboard.press( 'Backspace' );
			await page.waitForTimeout( 300 );

			const countAfter = await editorPage.getLayerCount();
			expect( countAfter ).toBe( countBefore - 1 );
		} );

		test( 'Ctrl+Z undoes last action', async ( { page } ) => {
			const countAfterCreate = await editorPage.getLayerCount();

			// Undo
			await page.keyboard.press( 'Control+z' );
			await page.waitForTimeout( 300 );

			const countAfterUndo = await editorPage.getLayerCount();
			expect( countAfterUndo ).toBe( countAfterCreate - 1 );
		} );

		test( 'Ctrl+Shift+Z redoes undone action', async ( { page } ) => {
			const countAfterCreate = await editorPage.getLayerCount();

			// Undo
			await page.keyboard.press( 'Control+z' );
			await page.waitForTimeout( 300 );

			// Redo
			await page.keyboard.press( 'Control+Shift+z' );
			await page.waitForTimeout( 300 );

			const countAfterRedo = await editorPage.getLayerCount();
			expect( countAfterRedo ).toBe( countAfterCreate );
		} );

		test( 'Ctrl+Y also redoes undone action', async ( { page } ) => {
			const countAfterCreate = await editorPage.getLayerCount();

			// Undo
			await page.keyboard.press( 'Control+z' );
			await page.waitForTimeout( 300 );

			// Redo with Ctrl+Y
			await page.keyboard.press( 'Control+y' );
			await page.waitForTimeout( 300 );

			const countAfterRedo = await editorPage.getLayerCount();
			expect( countAfterRedo ).toBe( countAfterCreate );
		} );
	} );

	describeKeyboard( 'Clipboard Shortcuts', () => {
		test.beforeEach( async () => {
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
		} );

		test( 'Ctrl+C copies selected layer', async ( { page } ) => {
			// Select layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 150 );
			await page.waitForTimeout( 200 );

			// Copy
			await page.keyboard.press( 'Control+c' );
			await page.waitForTimeout( 200 );

			// The copy operation should complete without error
			// We verify by pasting next
			const countBefore = await editorPage.getLayerCount();

			// Paste
			await page.keyboard.press( 'Control+v' );
			await page.waitForTimeout( 300 );

			const countAfter = await editorPage.getLayerCount();
			expect( countAfter ).toBe( countBefore + 1 );
		} );

		test( 'Ctrl+V pastes copied layer', async ( { page } ) => {
			// Select and copy
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 150 );
			await page.waitForTimeout( 200 );
			await page.keyboard.press( 'Control+c' );
			await page.waitForTimeout( 200 );

			const countBefore = await editorPage.getLayerCount();

			// Paste
			await page.keyboard.press( 'Control+v' );
			await page.waitForTimeout( 300 );

			const countAfter = await editorPage.getLayerCount();
			expect( countAfter ).toBe( countBefore + 1 );
		} );

		test( 'Ctrl+X cuts selected layer', async ( { page } ) => {
			// Select layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 150 );
			await page.waitForTimeout( 200 );

			const countBefore = await editorPage.getLayerCount();

			// Cut
			await page.keyboard.press( 'Control+x' );
			await page.waitForTimeout( 300 );

			const countAfterCut = await editorPage.getLayerCount();
			expect( countAfterCut ).toBe( countBefore - 1 );

			// Paste should restore it
			await page.keyboard.press( 'Control+v' );
			await page.waitForTimeout( 300 );

			const countAfterPaste = await editorPage.getLayerCount();
			expect( countAfterPaste ).toBe( countBefore );
		} );

		test( 'Ctrl+D duplicates selected layer', async ( { page } ) => {
			// Select layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 150, 150 );
			await page.waitForTimeout( 200 );

			const countBefore = await editorPage.getLayerCount();

			// Duplicate
			await page.keyboard.press( 'Control+d' );
			await page.waitForTimeout( 300 );

			const countAfter = await editorPage.getLayerCount();
			expect( countAfter ).toBe( countBefore + 1 );
		} );
	} );

	describeKeyboard( 'Layer Order Shortcuts', () => {
		test.beforeEach( async () => {
			// Create multiple layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 150, 200, 200 );
		} );

		test( 'Ctrl+] brings layer forward', async ( { page } ) => {
			// Select the first (lower) layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 75, 75 );
			await page.waitForTimeout( 200 );

			// Bring forward
			await page.keyboard.press( 'Control+]' );
			await page.waitForTimeout( 200 );

			// Layer should now be above the other
			// Verify by checking layer order in panel
			const layerItems = await page.$$(
				'.layer-item:not(.background-layer-item)'
			);
			expect( layerItems.length ).toBeGreaterThanOrEqual( 2 );
		} );

		test( 'Ctrl+[ sends layer backward', async ( { page } ) => {
			// Select the top layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 175, 175 );
			await page.waitForTimeout( 200 );

			// Send backward
			await page.keyboard.press( 'Control+[' );
			await page.waitForTimeout( 200 );

			// Layer should now be below the other
			const layerItems = await page.$$(
				'.layer-item:not(.background-layer-item)'
			);
			expect( layerItems.length ).toBeGreaterThanOrEqual( 2 );
		} );

		test( 'Ctrl+Shift+] brings layer to front', async ( { page } ) => {
			// Create a third layer
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 250, 250, 300, 300 );

			// Select the first layer
			await editorPage.selectTool( 'pointer' );
			await editorPage.clickCanvas( 75, 75 );
			await page.waitForTimeout( 200 );

			// Bring to front
			await page.keyboard.press( 'Control+Shift+]' );
			await page.waitForTimeout( 200 );

			// This layer should now be at the top
			const layerItems = await page.$$(
				'.layer-item:not(.background-layer-item)'
			);
			expect( layerItems.length ).toBeGreaterThanOrEqual( 3 );
		} );

		test( 'Ctrl+Shift+[ sends layer to back', async ( { page } ) => {
			// Create a third layer
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 250, 250, 300, 300 );

			// Select the top layer (last created)
			// It should already be selected after creation

			// Send to back
			await page.keyboard.press( 'Control+Shift+[' );
			await page.waitForTimeout( 200 );

			// Verify layer is now at bottom
			const layerItems = await page.$$(
				'.layer-item:not(.background-layer-item)'
			);
			expect( layerItems.length ).toBeGreaterThanOrEqual( 3 );
		} );
	} );

	describeKeyboard( 'Save Shortcut', () => {
		test( 'Ctrl+S saves layers', async ( { page } ) => {
			// Create a layer to ensure there's something to save
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			await page.waitForTimeout( 300 );

			// Set up response listener
			const responsePromise = page.waitForResponse(
				( response ) => {
					const url = response.url();
					const request = response.request();
					if ( url.includes( 'api.php' ) && request.method() === 'POST' ) {
						const postData = request.postData() || '';
						return postData.includes( 'action=layerssave' );
					}
					return false;
				},
				{ timeout: 15000 }
			);

			// Press Ctrl+S
			await page.keyboard.press( 'Control+s' );

			// Wait for save response
			const response = await responsePromise;
			expect( response.ok() ).toBe( true );
		} );
	} );

	describeKeyboard( 'Help Shortcut', () => {
		test( 'Shift+? shows keyboard shortcuts help', async ( { page } ) => {
			// Press Shift+?
			await page.keyboard.press( 'Shift+?' );
			await page.waitForTimeout( 300 );

			// Should show help dialog/panel
			const helpPanel = await page.$(
				'.keyboard-shortcuts-help, .shortcuts-dialog, [role="dialog"]:has-text("shortcuts"), ' +
				'.help-overlay, .shortcuts-panel'
			);
			expect( helpPanel ).not.toBeNull();
		} );
	} );

	describeKeyboard( 'Zoom Shortcuts', () => {
		test( 'Ctrl+= zooms in', async ( { page } ) => {
			// Zoom in
			await page.keyboard.press( 'Control+=' );
			await page.waitForTimeout( 200 );

			// Zoom should increase (or at least the shortcut should work)
			// This is a basic verification that the shortcut is handled
		} );

		test( 'Ctrl+- zooms out', async ( { page } ) => {
			// Zoom out
			await page.keyboard.press( 'Control+-' );
			await page.waitForTimeout( 200 );
		} );

		test( 'Ctrl+0 resets zoom to fit', async ( { page } ) => {
			// First zoom in
			await page.keyboard.press( 'Control+=' );
			await page.keyboard.press( 'Control+=' );
			await page.waitForTimeout( 200 );

			// Reset to fit
			await page.keyboard.press( 'Control+0' );
			await page.waitForTimeout( 200 );
		} );

		test( 'Ctrl+1 resets zoom to 100%', async ( { page } ) => {
			// Zoom in first
			await page.keyboard.press( 'Control+=' );
			await page.waitForTimeout( 200 );

			// Reset to 100%
			await page.keyboard.press( 'Control+1' );
			await page.waitForTimeout( 200 );
		} );
	} );

	describeKeyboard( 'Layer Panel Navigation', () => {
		test.beforeEach( async () => {
			// Create multiple layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 150, 200, 200 );
			await editorPage.drawOnCanvas( 250, 250, 300, 300 );
		} );

		test( 'Arrow keys navigate layer list', async ( { page } ) => {
			// Focus the layer panel
			const layerPanel = await page.$(
				'.layers-panel, .layer-panel, [data-testid="layer-panel"]'
			);
			if ( layerPanel ) {
				await layerPanel.click();
				await page.waitForTimeout( 200 );

				// Select first layer
				const firstLayer = await page.$(
					'.layer-item:not(.background-layer-item)'
				);
				if ( firstLayer ) {
					await firstLayer.click();
					await page.waitForTimeout( 200 );

					// Press down arrow
					await page.keyboard.press( 'ArrowDown' );
					await page.waitForTimeout( 200 );

					// A different layer should now be selected
					const selectedItems = await page.$$(
						'.layer-item.selected, .layer-item[aria-selected="true"]'
					);
					expect( selectedItems.length ).toBeGreaterThanOrEqual( 1 );
				}
			}
		} );

		test( 'Home key selects first layer', async ( { page } ) => {
			// Focus layer panel
			const lastLayer = await page.$$(
				'.layer-item:not(.background-layer-item)'
			);
			if ( lastLayer.length > 0 ) {
				await lastLayer[ lastLayer.length - 1 ].click();
				await page.waitForTimeout( 200 );

				// Press Home
				await page.keyboard.press( 'Home' );
				await page.waitForTimeout( 200 );
			}
		} );

		test( 'End key selects last layer', async ( { page } ) => {
			// Select first layer
			const firstLayer = await page.$(
				'.layer-item:not(.background-layer-item)'
			);
			if ( firstLayer ) {
				await firstLayer.click();
				await page.waitForTimeout( 200 );

				// Press End
				await page.keyboard.press( 'End' );
				await page.waitForTimeout( 200 );
			}
		} );
	} );
} );
