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
			cancelButton: '.cancel-button',
			
			// Tools - all 11 layer types
			pointerTool: '[data-tool="pointer"], .tool-pointer',
			selectTool: '[data-tool="select"], .tool-select',
			textTool: '[data-tool="text"], .tool-text',
			rectangleTool: '[data-tool="rectangle"], .tool-rectangle',
			circleTool: '[data-tool="circle"], .tool-circle',
			ellipseTool: '[data-tool="ellipse"], .tool-ellipse',
			arrowTool: '[data-tool="arrow"], .tool-arrow',
			lineTool: '[data-tool="line"], .tool-line',
			polygonTool: '[data-tool="polygon"], .tool-polygon',
			starTool: '[data-tool="star"], .tool-star',
			pathTool: '[data-tool="path"], .tool-path, [data-tool="pen"], .tool-pen',
			blurTool: '[data-tool="blur"], .tool-blur',
			
			// Layer panel items - exclude background layer from count
			layerItem: '.layer-item:not(.background-layer-item)',
			layerName: '.layer-name',
			layerVisibility: '.layer-visibility-toggle',
			layerLock: '.layer-lock-toggle',
			deleteLayerBtn: '.delete-layer-btn, [data-action="delete-layer"]'
		};
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
	 */
	async selectTool( toolName ) {
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
		// With 1920x1080 viewport, button should be visible
		await this.page.click( this.selectors.saveButton );
		// Wait for save operation
		await this.page.waitForResponse(
			( response ) => response.url().includes( 'action=layerssave' ),
			{ timeout: 10000 }
		);
	}

	/**
	 * Cancel and close editor
	 */
	async cancel() {
		await this.page.click( this.selectors.cancelButton );
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
