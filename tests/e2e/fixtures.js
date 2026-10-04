/**
 * Layers Extension - E2E Test Fixtures and Utilities
 * 
 * This file provides common fixtures, helpers, and page objects
 * for E2E tests of the Layers editor.
 */

/* eslint-env node */
const { test: base, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );

/**
 * Get acceptance config from environment or temp file.
 * @return {Object|null}
 */
function getAcceptanceConfig() {
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	if ( configPath && fs.existsSync( configPath ) ) {
		return JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	}
	return null;
}

/**
 * Custom test fixtures for Layers E2E tests
 */
const test = base.extend( {
	/**
	 * Page fixture with MediaWiki login
	 */
	loggedInPage: async ( { page }, use ) => {
		const config = getAcceptanceConfig();
		const username = ( process.env.MW_USERNAME && process.env.MW_PASSWORD ) ?
			process.env.MW_USERNAME : ( config?.username || process.env.MW_USERNAME );
		const password = ( process.env.MW_USERNAME && process.env.MW_PASSWORD ) ?
			process.env.MW_PASSWORD : ( config?.password || process.env.MW_PASSWORD );
		const baseServer = process.env.MW_SERVER || config?.base || 'http://localhost:8080';

		if ( !username || !password ) {
			await use( page );
			return;
		}

		const req = page.context().request;
		const tokenRes = await req.get( `${ baseServer }/api.php?action=query&meta=tokens&type=login&format=json&formatversion=2` );
		const tokenData = await tokenRes.json();
		const logintoken = tokenData?.query?.tokens?.logintoken;
		if ( logintoken ) {
			const loginRes = await req.post( `${ baseServer }/api.php`, {
				form: {
					action: 'login',
					lgname: username,
					lgpassword: password,
					lgtoken: logintoken,
					format: 'json',
					formatversion: '2'
				}
			} );
			const loginData = await loginRes.json();
			if ( loginData?.login?.result === 'Success' ) {
				await use( page );
				return;
			}
		}

		await page.goto( `${ baseServer }/index.php?title=Special:UserLogin` );
		await page.fill( '#wpName1', username );
		await page.fill( '#wpPassword1', password );
		await Promise.all( [
			page.waitForNavigation( { waitUntil: 'domcontentloaded' } ),
			page.click( '#wpLoginAttempt' )
		] );

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
			deleteLayerBtn: '.delete-layer-btn, [data-action="delete-layer"]',
			
			// Property panel
			propertiesForm: '.layer-properties-form',
			propertySection: '.property-section',
			propertySectionHeader: '.property-section-header',
			propertySectionBody: '.property-section-body',
			propertyField: '.property-field',
			propertyFieldColor: '.property-field--color',
			propertyFieldCheckbox: '.property-field--checkbox',
			propertyFieldCompound: '.property-field--compound',
			colorButton: '.color-display-button',
			
			// Selection state
			selectedLayerItem: '.layer-item.selected, .layer-item[aria-selected="true"]'
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

		// Clean leftover drafts on any navigation to ensure test isolation
		this.page.addInitScript( () => {
			try {
				const toRemove = [];
				for ( let i = 0; i < window.localStorage.length; i++ ) {
					const key = window.localStorage.key( i );
					if ( key && ( key.startsWith( 'layers-' ) || key.startsWith( 'layers_page_' ) ) ) {
						toRemove.push( key );
					}
				}
				for ( const key of toRemove ) {
					window.localStorage.removeItem( key );
				}
			} catch ( e ) {}
		} ).catch( () => {} );
	}

	/**
	 * Open Special:EditLayersPage for the owner page's drawing.
	 * Follows the "Edit layer set" link if already visible,
	 * or navigates directly to Special:EditLayersPage for the drawing.
	 *
	 * @param {string} [owner='Layers_browser_acceptance']
	 * @param {string} [surface='presentation']
	 */
	async openEditor( owner = 'Layers_browser_acceptance', surface = 'presentation' ) {
		const config = getAcceptanceConfig();
		const base = process.env.MW_SERVER || config?.base || 'http://localhost:8080';
		// If passed a filename like 'Test.png' or 'ImageTest03.png' by legacy callers, target the owner page instead
		const targetOwner = ( typeof owner === 'string' && ( owner.endsWith( '.png' ) || owner.endsWith( '.jpg' ) || owner.endsWith( '.pdf' ) ) ) ?
			'Layers_browser_acceptance' : ( owner || 'Layers_browser_acceptance' );

		// Clear any leftover local drafts to maintain test isolation
		await this.page.evaluate( () => {
			try {
				const toRemove = [];
				for ( let i = 0; i < window.localStorage.length; i++ ) {
					const key = window.localStorage.key( i );
					if ( key && ( key.startsWith( 'layers-' ) || key.startsWith( 'layers_page_' ) ) ) {
						toRemove.push( key );
					}
				}
				for ( const key of toRemove ) {
					window.localStorage.removeItem( key );
				}
			} catch ( e ) {}
		} ).catch( () => {} );

		const editLink = this.page.locator( '.layers-page-edit-link' ).first();
		if ( await editLink.isVisible().catch( () => false ) ) {
			await Promise.all( [
				this.page.waitForNavigation(),
				editLink.click()
			] );
		} else {
			await this.page.goto( `${ base }/index.php?title=Special:EditLayersPage&owner=${ encodeURIComponent( targetOwner ) }&surface=${ encodeURIComponent( surface ) }&revid=current` );
		}
		await this.page.waitForSelector( this.selectors.canvas, { timeout: 15000 } );
		await this.page.waitForSelector( this.selectors.saveButton, { timeout: 10000 } );

		// Wait for editor instance and bridge to finish loading
		await this.page.waitForFunction( () => {
			const inst = window.layersEditorInstance;
			if ( !inst || !inst.stateManager ) {
				return false;
			}
			const bridge = ( inst.apiManager || inst.api )?.pageOwnedBridge;
			if ( bridge ) {
				return Boolean( bridge.loaded );
			}
			return true;
		}, { timeout: 20000 } );

		// Wait for DOM layer items to match stateManager layers count
		await this.page.waitForFunction( () => {
			const mgr = window.layersEditorInstance?.stateManager;
			if ( !mgr ) {
				return false;
			}
			const layers = mgr.get( 'layers' );
			if ( !Array.isArray( layers ) ) {
				return false;
			}
			const domLayers = document.querySelectorAll( '.layer-item:not(.background-layer-item)' );
			return domLayers.length === layers.length;
		}, { timeout: 10000 } );

		await this.page.waitForTimeout( 300 );
	}

	/**
	 * Open the shared-set editor on a File page. It exists only until the migration to page history.
	 * @param {string} filename
	 */
	async openLegacyEditor( filename ) {
		await this.page.goto( `/index.php?title=File:${ filename }&action=editlayers` );
		await this.page.waitForSelector( this.selectors.canvas, { timeout: 10000 } );
		await this.page.waitForSelector( this.selectors.saveButton, { timeout: 5000 } );
		await this.page.waitForTimeout( 500 );
	}

	/**
	 * Login to MediaWiki using acceptance config credentials (or env vars).
	 */
	async login() {
		const config = getAcceptanceConfig();
		const username = ( process.env.MW_USERNAME && process.env.MW_PASSWORD ) ?
			process.env.MW_USERNAME : ( config?.username || process.env.MW_USERNAME );
		const password = ( process.env.MW_USERNAME && process.env.MW_PASSWORD ) ?
			process.env.MW_PASSWORD : ( config?.password || process.env.MW_PASSWORD );
		const base = process.env.MW_SERVER || config?.base || 'http://localhost:8080';

		if ( !username || !password ) {
			throw new Error( 'MW_USERNAME and MW_PASSWORD (or LAYERS_ACCEPTANCE_CONFIG) required for login' );
		}

		const req = this.page.context().request;
		const tokenRes = await req.get( `${ base }/api.php?action=query&meta=tokens&type=login&format=json&formatversion=2` );
		const tokenData = await tokenRes.json();
		const logintoken = tokenData?.query?.tokens?.logintoken;
		if ( logintoken ) {
			const loginRes = await req.post( `${ base }/api.php`, {
				form: {
					action: 'login',
					lgname: username,
					lgpassword: password,
					lgtoken: logintoken,
					format: 'json',
					formatversion: '2'
				}
			} );
			const loginData = await loginRes.json();
			if ( loginData?.login?.result === 'Success' ) {
				return;
			}
		}

		await this.page.goto( `${ base }/index.php?title=Special:UserLogin` );
		await this.page.fill( '#wpName1', username );
		await this.page.fill( '#wpPassword1', password );
		await Promise.all( [
			this.page.waitForNavigation( { waitUntil: 'domcontentloaded' } ),
			this.page.click( '#wpLoginAttempt' )
		] );
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
	 * Save layers in the page-owned editor (waits for layerspublish and verifies success)
	 */
	async save() {
		const responsePromise = this.page.waitForResponse(
			( response ) => {
				const url = response.url();
				const request = response.request();
				if ( url.includes( 'api.php' ) && request.method() === 'POST' ) {
					const postData = request.postData() || '';
					return postData.includes( 'action=layerspublish' ) || postData.includes( 'action=layerssave' );
				}
				return false;
			},
			{ timeout: 30000 }
		);

		await this.page.click( this.selectors.saveButton );
		const response = await responsePromise;
		expect( response.ok() ).toBe( true );
		const data = await response.json();
		expect( data.layerspublish?.result ?? ( data.layerssave?.success === 1 ? 'Success' : undefined ) ).toBe( 'Success' );
		await this.page.waitForTimeout( 500 );
		return response;
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

	/**
	 * Get the value of a property input by its data-prop attribute
	 * @param {string} propName - The data-prop value (e.g., 'width', 'height', 'rotation')
	 * @return {Promise<string|null>} The input value or null if not found
	 */
	async getPropertyValue( propName ) {
		const input = await this.page.$( `[data-prop="${ propName }"]` );
		if ( !input ) {
			return null;
		}
		return input.inputValue();
	}

	/**
	 * Set a property input value by its data-prop attribute
	 * @param {string} propName - The data-prop value (e.g., 'width', 'height', 'rotation')
	 * @param {string|number} value - The value to set
	 */
	async setPropertyValue( propName, value ) {
		const input = await this.page.$( `[data-prop="${ propName }"]` );
		if ( !input ) {
			throw new Error( `Property input not found: ${ propName }` );
		}
		await input.fill( String( value ) );
		// Trigger change event by pressing Tab (moves focus, fires change)
		await input.press( 'Tab' );
		await this.page.waitForTimeout( 200 );
	}

	/**
	 * Check if the properties panel is visible
	 * @return {Promise<boolean>}
	 */
	async isPropertiesPanelVisible() {
		const form = await this.page.$( this.selectors.propertiesForm );
		return form !== null;
	}

	/**
	 * Get the number of property sections visible
	 * @return {Promise<number>}
	 */
	async getPropertySectionCount() {
		const sections = await this.page.$$( this.selectors.propertySection );
		return sections.length;
	}

	/**
	 * Create a layer and select it (convenience for property/transform tests)
	 * @param {string} toolName - Tool to use (e.g., 'rectangle', 'circle')
	 * @param {number} [x1=100] - Start X
	 * @param {number} [y1=100] - Start Y
	 * @param {number} [x2=250] - End X
	 * @param {number} [y2=250] - End Y
	 */
	async createAndSelectLayer( toolName, x1 = 100, y1 = 100, x2 = 250, y2 = 250 ) {
		await this.selectTool( toolName );
		await this.drawOnCanvas( x1, y1, x2, y2 );
		await this.page.waitForTimeout( 300 );
		// Switch to pointer and click on the layer to select it
		await this.selectTool( 'pointer' );
		const midX = ( x1 + x2 ) / 2;
		const midY = ( y1 + y2 ) / 2;
		await this.clickCanvas( midX, midY );
		await this.page.waitForTimeout( 300 );
	}

	/**
	 * Drag a layer from one position to another
	 * @param {number} fromX - Start X on canvas
	 * @param {number} fromY - Start Y on canvas
	 * @param {number} toX - End X on canvas
	 * @param {number} toY - End Y on canvas
	 */
	async dragOnCanvas( fromX, fromY, toX, toY ) {
		const canvas = await this.page.$( this.selectors.canvas );
		const box = await canvas.boundingBox();
		
		await this.page.mouse.move( box.x + fromX, box.y + fromY );
		await this.page.waitForTimeout( 100 );
		await this.page.mouse.down();
		// Move in steps for more reliable drag
		const steps = 5;
		for ( let i = 1; i <= steps; i++ ) {
			const x = fromX + ( toX - fromX ) * ( i / steps );
			const y = fromY + ( toY - fromY ) * ( i / steps );
			await this.page.mouse.move( box.x + x, box.y + y );
		}
		await this.page.mouse.up();
	}

	/**
	 * Get an API client using the page's request context
	 * @return {Promise<{get: Function, post: Function}>}
	 */
	async getApiClient() {
		const config = getAcceptanceConfig();
		const base = process.env.MW_SERVER || config?.base || 'http://localhost:8080';
		const req = this.page.context().request;
		return {
			get: async ( params ) => {
				const res = await req.get( `${ base }/api.php`, { params: { ...params, format: 'json', formatversion: '2' } } );
				return res.json();
			},
			post: async ( params ) => {
				const res = await req.post( `${ base }/api.php`, { form: { ...params, format: 'json', formatversion: '2' } } );
				return res.json();
			}
		};
	}

	/**
	 * Read the latest snapshot for the given owner
	 * @param {string} [owner='Layers_browser_acceptance']
	 * @return {Promise<Object>}
	 */
	async readSnapshot( owner = 'Layers_browser_acceptance' ) {
		const api = await this.getApiClient();
		const history = await api.get( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
		const revid = history.query.pages[ 0 ].revisions[ 0 ].revid;
		const readRes = await api.get( { action: 'layersread', owner, revid: String( revid ) } );
		return readRes.layersread.snapshot;
	}

	/**
	 * Get the latest revision ID for the given owner
	 * @param {string} [owner='Layers_browser_acceptance']
	 * @return {Promise<number>}
	 */
	async getLatestRevisionId( owner = 'Layers_browser_acceptance' ) {
		const api = await this.getApiClient();
		const history = await api.get( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
		return history.query.pages[ 0 ].revisions[ 0 ].revid;
	}

	/**
	 * Restore snapshot by exact-base publication
	 * @param {Object} snapshot
	 * @param {number} [baseRevId]
	 * @param {string} [owner='Layers_browser_acceptance']
	 * @return {Promise<Object>}
	 */
	async restoreSnapshot( snapshot, baseRevId, owner = 'Layers_browser_acceptance' ) {
		const api = await this.getApiClient();
		const history = await api.get( { action: 'query', prop: 'revisions', titles: owner, rvprop: 'ids' } );
		const latestRev = history.query.pages[ 0 ].revisions[ 0 ].revid;
		const tokenRes = await api.get( { action: 'query', meta: 'tokens', type: 'csrf' } );
		const csrfToken = tokenRes.query.tokens.csrftoken;
		const pubRes = await api.post( {
			action: 'layerspublish',
			owner,
			baserevid: String( latestRev ),
			data: JSON.stringify( snapshot ),
			maintext: 'Dedicated automated Layers history acceptance page.',
			summary: 'Restore baseline snapshot via exact-base publication',
			token: csrfToken
		} );
		expect( pubRes.error, 'the owner page must be restored to its baseline' ).toBeUndefined();
		return pubRes;
	}
}

module.exports = {
	test,
	LayersEditorPage,
	getAcceptanceConfig
};
