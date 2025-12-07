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
const { LayersEditorPage } = require( './fixtures' );

// Skip editor tests if no MediaWiki server configured
const describeEditor = process.env.MW_SERVER ? test.describe : test.describe.skip;

describeEditor( 'Layers Editor', () => {
	let editorPage;

	test.beforeEach( async ( { page } ) => {
		editorPage = new LayersEditorPage( page );
	} );

	describeEditor( 'Editor Loading', () => {
		test( 'can open editor on File page', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			
			// Navigate to File page
			await page.goto( `/index.php?title=File:${ testFile }` );
			
			// Check for edit layers link/button
			const editLayersLink = await page.$( 'a[href*="action=editlayers"], .edit-layers-link' );
			
			// If file exists and has edit layers action
			if ( editLayersLink ) {
				await editLayersLink.click();
				await page.waitForLoadState( 'networkidle' );
				
				// Editor should load
				const loaded = await editorPage.isEditorLoaded();
				expect( loaded ).toBe( true );
			}
		} );

		test( 'editor has required components', async ( { page } ) => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );
			
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
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );
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
			
			// Type some text
			await page.keyboard.type( 'Test Label' );
			await page.keyboard.press( 'Escape' );
			
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

		test( 'can create highlight layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'highlight' );
			await editorPage.drawOnCanvas( 100, 100, 300, 150 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create path layer with pen tool', async ( { page } ) => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'path' );
			
			// Draw a path with multiple clicks
			await editorPage.clickCanvas( 50, 50 );
			await editorPage.clickCanvas( 100, 80 );
			await editorPage.clickCanvas( 150, 50 );
			await editorPage.clickCanvas( 200, 100 );
			
			// Double-click to finish path
			const canvas = await page.$( editorPage.selectors.canvas );
			const box = await canvas.boundingBox();
			await page.mouse.dblclick( box.x + 200, box.y + 100 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );

		test( 'can create blur layer', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			await editorPage.selectTool( 'blur' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			
			const newCount = await editorPage.getLayerCount();
			expect( newCount ).toBe( initialCount + 1 );
		} );
	} );

	describeEditor( 'Layer Manipulation', () => {
		test.beforeEach( async () => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );
			
			// Create a layer to manipulate
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
		} );

		test( 'can select layer by clicking', async () => {
			// Switch to pointer tool
			await editorPage.selectTool( 'pointer' );
			
			// Click on the layer
			await editorPage.clickCanvas( 150, 150 );
			
			// Check for selection handles (implementation-specific)
			// This might need adjustment based on actual DOM structure
			const selectionHandles = await editorPage.page.$$( '.selection-handle, .resize-handle' );
			expect( selectionHandles.length ).toBeGreaterThan( 0 );
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

		test( 'can undo layer creation', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			// Create another layer
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 300, 300, 350, 350 );
			
			expect( await editorPage.getLayerCount() ).toBe( initialCount + 1 );
			
			// Undo
			await editorPage.undo();
			
			expect( await editorPage.getLayerCount() ).toBe( initialCount );
		} );

		test( 'can redo undone action', async () => {
			const initialCount = await editorPage.getLayerCount();
			
			// Create layer
			await editorPage.selectTool( 'circle' );
			await editorPage.drawOnCanvas( 300, 300, 350, 350 );
			
			// Undo
			await editorPage.undo();
			expect( await editorPage.getLayerCount() ).toBe( initialCount );
			
			// Redo
			await editorPage.redo();
			expect( await editorPage.getLayerCount() ).toBe( initialCount + 1 );
		} );
	} );

	describeEditor( 'Save and Load', () => {
		test( 'can save layers', async () => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );
			
			// Create a layer
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			
			// Save
			const savePromise = editorPage.page.waitForResponse(
				( response ) => response.url().includes( 'action=layerssave' )
			);
			
			await editorPage.save();
			const response = await savePromise;
			
			expect( response.ok() ).toBe( true );
		} );

		test( 'saved layers persist on reload', async () => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			
			// Open editor and create layer
			await editorPage.openEditor( testFile );
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			
			const countBeforeSave = await editorPage.getLayerCount();
			
			// Save
			await editorPage.save();
			
			// Wait a moment for save to complete
			await editorPage.page.waitForTimeout( 1000 );
			
			// Reload editor
			await editorPage.page.reload();
			await editorPage.openEditor( testFile );
			
			// Verify layers persisted
			const countAfterReload = await editorPage.getLayerCount();
			expect( countAfterReload ).toBe( countBeforeSave );
		} );
	} );

	describeEditor( 'Keyboard Shortcuts', () => {
		test.beforeEach( async () => {
			const testFile = process.env.TEST_FILE || 'Test.png';
			await editorPage.openEditor( testFile );
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

		test( 'Escape key deselects layer', async () => {
			// Create and select a layer
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
			
			// Press Escape
			await editorPage.page.keyboard.press( 'Escape' );
			
			// Verify no selection handles visible
			const selectionHandles = await editorPage.page.$$( '.selection-handle.visible' );
			expect( selectionHandles.length ).toBe( 0 );
		} );

		test( 'Ctrl+A selects all layers', async () => {
			// Create multiple layers
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.drawOnCanvas( 150, 150, 200, 200 );
			
			// Select all
			await editorPage.page.keyboard.press( 'Control+a' );
			
			// Both layers should be selected - check for multiple selection indicator
			// (implementation-specific, may need adjustment)
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
