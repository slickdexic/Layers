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
		test( 'can open editor from page drawing edit link', async ( { page } ) => {
			const cfg = getAcceptanceConfig();
			const base = process.env.MW_SERVER || cfg?.base || 'http://localhost:8080';
			const owner = 'Layers_browser_acceptance';

			const initialSnapshot = await editorPage.readSnapshot( owner );
			const api = await editorPage.getApiClient();
			const histRes = await api.get( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids|content', rvslots: 'main' } );
			const initialRevId = histRes.query.pages[ 0 ].revisions[ 0 ].revid;
			const baselineText = histRes.query.pages[ 0 ].revisions[ 0 ].slots.main.content;

			let currentRevId = initialRevId;
			try {
				const tokenRes = await api.get( { action: 'query', meta: 'tokens', type: 'csrf' } );
				const csrfToken = tokenRes.query.tokens.csrftoken;
				const seedRes = await api.post( {
					action: 'layerspublish',
					owner,
					baserevid: String( currentRevId ),
					maintext: `${ baselineText }\n\n{{#Slide:Welcome Slide}}`,
					data: JSON.stringify( initialSnapshot ),
					summary: 'Temporary embed for edit link test',
					token: csrfToken
				} );
				expect( seedRes?.layerspublish?.result ).toBe( 'Success' );
				currentRevId = seedRes.layerspublish.revid;

				await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }&useskin=vector-2022` );
				const editLink = page.locator( '.layers-page-edit-link' ).first();
				await expect( editLink ).toBeVisible( { timeout: 15000 } );
				await expect( editLink ).toContainText( 'Edit layer set: Welcome Slide' );
				await Promise.all( [
					page.waitForNavigation(),
					editLink.click()
				] );

				const loaded = await editorPage.isEditorLoaded();
				expect( loaded ).toBe( true );
			} finally {
				await editorPage.restoreSnapshot( initialSnapshot, currentRevId, owner );
			}
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
			
			// Create a layer to manipulate
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 100, 100, 200, 200 );
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
			// This test opens a fresh editor to avoid undo history interference
			// from beforeEach layer creation
			await editorPage.openEditor();
			
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
			// This test opens a fresh editor to avoid undo history interference
			await editorPage.openEditor();
			
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
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 50, 50, 100, 100 );
			await editorPage.selectTool( 'rectangle' );
			await editorPage.drawOnCanvas( 150, 150, 200, 200 );

			await editorPage.page.keyboard.press( 'Control+a' );

			const counts = await editorPage.page.evaluate( () => {
				const state = window.layersEditorInstance.stateManager;
				return [ state.get( 'selectedLayerIds' ).length, state.get( 'layers' ).length ];
			} );
			expect( counts[ 1 ] ).toBeGreaterThanOrEqual( 3 );
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
