/**
 * Layers Extension - E2E Test Fixtures and Utilities
 * 
 * This file provides common fixtures, helpers, and page objects
 * for E2E tests of the Layers editor.
 */

/* eslint-env node */
const { test: base } = require( '@playwright/test' );

/**
 * Custom test fixtures for Layers E2E tests
 */
const test = base.extend( {
	/**
	 * Page fixture with MediaWiki login
	 */
	loggedInPage: async ( { page }, use ) => {
		// Skip login in smoke tests or if no credentials
		if ( !process.env.MW_USERNAME || !process.env.MW_PASSWORD ) {
			await use( page );
			return;
		}

		// Navigate to Special:UserLogin
		await page.goto( '/index.php?title=Special:UserLogin' );
		
		// Fill login form
		await page.fill( '#wpName1', process.env.MW_USERNAME );
		await page.fill( '#wpPassword1', process.env.MW_PASSWORD );
		await page.click( '#wpLoginAttempt' );
		
		// Wait for redirect
		await page.waitForLoadState( 'networkidle' );
		
		await use( page );
	},

	/**
	 * Navigate to a file page with layers
	 */
	filePage: async ( { page }, use ) => {
		const filename = process.env.TEST_FILE || 'Test_image.png';
		await page.goto( `/index.php?title=File:${ filename }` );
		await use( page );
	}
} );

/**
 * Page Object Model for the Layers Editor
 */
class LayersEditorPage {
	constructor( page ) {
		this.page = page;
		
		// Selectors for editor components
		this.selectors = {
			editor: '.layers-editor',
			canvas: '.layers-canvas',
			toolbar: '.layers-toolbar',
			layerPanel: '.layers-panel, .layer-panel',
			// Actual button classes from Toolbar.js
			saveButton: '.save-button',
			// cancelButton removed - X close button provides same functionality
			
			// Tools - all 12 layer types (callout added in v1.4.2, blur removed)
			pointerTool: '[data-tool="pointer"], .tool-pointer',
			selectTool: '[data-tool="select"], .tool-select',
			textTool: '[data-tool="text"], .tool-text',
			textboxTool: '[data-tool="textbox"], .tool-textbox',
			calloutTool: '[data-tool="callout"], .tool-callout',
			rectangleTool: '[data-tool="rectangle"], .tool-rectangle',
			circleTool: '[data-tool="circle"], .tool-circle',
			ellipseTool: '[data-tool="ellipse"], .tool-ellipse',
			arrowTool: '[data-tool="arrow"], .tool-arrow',
			lineTool: '[data-tool="line"], .tool-line',
			polygonTool: '[data-tool="polygon"], .tool-polygon',
			starTool: '[data-tool="star"], .tool-star',
			pathTool: '[data-tool="path"], .tool-path, [data-tool="pen"], .tool-pen',
			penTool: '[data-tool="pen"], .tool-pen',
			
			// Shape Library (5,116 shapes in 12 categories)
			shapeLibraryButton: '.shape-library-button',
			shapeLibraryPanel: '.layers-shape-library-panel',
			shapeLibraryOverlay: '.layers-shape-library-overlay',
			shapeLibraryClose: '.layers-shape-library-close',
			shapeLibrarySearch: '.layers-shape-library-search-input',
			shapeLibraryCategories: '.layers-shape-library-categories',
			shapeLibraryCategory: '.layers-shape-library-category',
			shapeLibraryGrid: '.layers-shape-library-grid',
			shapeLibraryItem: '.layers-shape-library-item',
			shapeLibraryPreview: '.layers-shape-library-preview',
			shapeLibraryLabel: '.layers-shape-library-label',
			
			// Layer panel items - exclude background layer from count
			layerItem: '.layer-item:not(.background-layer-item)',
			layerName: '.layer-name',
			layerVisibility: '.layer-visibility-toggle',
			layerLock: '.layer-lock-toggle',
			deleteLayerBtn: '.delete-layer-btn, [data-action="delete-layer"]'
		};
		
		// Tool keyboard shortcuts (used by selectTool for dropdown tools)
		// Updated for v1.4.2+ toolbar with dropdown grouping
		this.toolShortcuts = {
			pointer: 'v',
			select: 'v',
			text: 't',
			textbox: 'x',
			callout: 'b',
			rectangle: 'r',
			circle: 'c',
			ellipse: 'e',
			arrow: 'a',
			line: 'l',
			polygon: 'y',
			star: 's',
			path: 'p',
			pen: 'p'
		};
		
		// Tools that are inside dropdowns (v1.4.2+)
		this.dropdownTools = new Set( [
			'text', 'textbox', 'callout',
			'rectangle', 'circle', 'ellipse', 'polygon', 'star',
			'arrow', 'line'
		] );
	}

	/**
	 * Open the layers editor for a file
	 */
	async openEditor( filename ) {
		await this.page.goto( `/index.php?title=File:${ filename }&action=editlayers` );
		await this.page.waitForSelector( this.selectors.canvas, { timeout: 10000 } );
		// Wait for editor to fully initialize (toolbar, panels, etc.)
		await this.page.waitForSelector( this.selectors.saveButton, { timeout: 5000 } );
		// Small delay to ensure all event handlers are attached
		await this.page.waitForTimeout( 500 );
	}

	/**
	 * Login to MediaWiki (required for save operations)
	 */
	async login() {
		const username = process.env.MW_USERNAME;
		const password = process.env.MW_PASSWORD;
		
		if ( !username || !password ) {
			throw new Error( 'MW_USERNAME and MW_PASSWORD required for login' );
		}
		
		await this.page.goto( '/index.php?title=Special:UserLogin' );
		await this.page.fill( '#wpName1', username );
		await this.page.fill( '#wpPassword1', password );
		await this.page.click( '#wpLoginAttempt' );
		await this.page.waitForLoadState( 'networkidle' );
	}

	/**
	 * Check if editor is loaded
	 */
	async isEditorLoaded() {
		try {
			await this.page.waitForSelector( this.selectors.canvas, { timeout: 5000 } );
			return true;
		} catch ( e ) {
			return false;
		}
	}

	/**
	 * Select a tool
	 * 
	 * For tools inside dropdowns (v1.4.2+), uses keyboard shortcuts
	 * which is more reliable than trying to click hidden dropdown items.
	 * For standalone tools (pointer, pen), clicks the button directly.
	 */
	async selectTool( toolName ) {
		// First, click on canvas to ensure it has focus for keyboard shortcuts
		await this.clickCanvas( 10, 10 );
		await this.page.waitForTimeout( 100 );
		
		// Use keyboard shortcut for dropdown tools (more reliable)
		const shortcut = this.toolShortcuts[ toolName ];
		if ( shortcut ) {
			await this.page.keyboard.press( shortcut );
			// Wait for tool to be selected
			await this.page.waitForTimeout( 100 );
			return;
		}
		
		// Fallback to clicking for standalone tools
		const selector = this.selectors[ `${ toolName }Tool` ];
		if ( !selector ) {
			throw new Error( `Unknown tool: ${ toolName }` );
		}
		await this.page.click( selector );
	}

	/**
	 * Draw on the canvas
	 */
	async drawOnCanvas( startX, startY, endX, endY ) {
		const canvas = await this.page.$( this.selectors.canvas );
		const box = await canvas.boundingBox();
		
		await this.page.mouse.move( box.x + startX, box.y + startY );
		await this.page.mouse.down();
		await this.page.mouse.move( box.x + endX, box.y + endY );
		await this.page.mouse.up();
	}

	/**
	 * Click on canvas at position
	 */
	async clickCanvas( x, y ) {
		const canvas = await this.page.$( this.selectors.canvas );
		const box = await canvas.boundingBox();
		await this.page.mouse.click( box.x + x, box.y + y );
	}

	/**
	 * Get layer count
	 */
	async getLayerCount() {
		const layers = await this.page.$$( this.selectors.layerItem );
		return layers.length;
	}

	/**
	 * Save layers
	 */
	async save() {
		// Set up response listener BEFORE clicking (avoid race condition)
		// Note: MediaWiki API uses POST body for action parameter, not URL query string
		// So we check for POST to api.php and verify action=layerssave in postData
		const responsePromise = this.page.waitForResponse(
			( response ) => {
				const url = response.url();
				const request = response.request();
				// Check if it's a POST to api.php with layerssave action
				if ( url.includes( 'api.php' ) && request.method() === 'POST' ) {
					const postData = request.postData() || '';
					return postData.includes( 'action=layerssave' );
				}
				return false;
			},
			{ timeout: 15000 }
		);
		
		// Click save button
		await this.page.click( this.selectors.saveButton );
		
		// Wait for response
		return responsePromise;
	}

	/**
	 * Cancel and close editor (uses X close button)
	 */
	async cancel() {
		await this.page.click( '.layers-header-close' );
	}

	/**
	 * Delete selected layer
	 */
	async deleteSelectedLayer() {
		await this.page.click( this.selectors.deleteLayerBtn );
	}

	/**
	 * Press keyboard shortcut
	 */
	async pressShortcut( key ) {
		await this.page.keyboard.press( key );
	}

	/**
	 * Undo last action
	 */
	async undo() {
		await this.page.keyboard.press( 'Control+z' );
	}

	/**
	 * Redo last undone action
	 */
	async redo() {
		await this.page.keyboard.press( 'Control+Shift+z' );
	}
}

module.exports = {
	test,
	LayersEditorPage
};
