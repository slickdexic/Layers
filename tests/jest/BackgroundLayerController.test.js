/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for BackgroundLayerController
 * Extracted from LayerPanel.js for better separation of concerns
 */

describe( 'BackgroundLayerController', () => {
	let BackgroundLayerController;
	let mockEditor;
	let mockStateManager;
	let mockCanvasManager;
	let mockLayerList;
	let mockEventTracker;
	let controller;

	beforeEach( () => {
		// Reset modules and window state
		jest.resetModules();

		// Set up window.Layers namespace
		window.Layers = {
			UI: {
				IconFactory: {
					createEyeIcon: jest.fn( ( visible ) => {
						const span = document.createElement( 'span' );
						span.textContent = visible ? 'visible' : 'hidden';
						return span;
					} ),
					createLockIcon: jest.fn( ( locked ) => {
						const span = document.createElement( 'span' );
						span.textContent = locked ? 'locked' : 'unlocked';
						return span;
					} )
				}
			}
		};

		// Load the module
		BackgroundLayerController = require( '../../resources/ext.layers.editor/ui/BackgroundLayerController.js' );

		// Re-register after requiring
		window.Layers.UI.BackgroundLayerController = BackgroundLayerController;

		// Create mock state manager
		const stateMap = new Map();
		mockStateManager = {
			get: jest.fn( ( key ) => stateMap.get( key ) ),
			set: jest.fn( ( key, value ) => stateMap.set( key, value ) ),
			_stateMap: stateMap
		};

		// Create mock canvas manager
		mockCanvasManager = {
			redraw: jest.fn()
		};

		// Create mock editor
		mockEditor = {
			stateManager: mockStateManager,
			canvasManager: mockCanvasManager
		};

		// Create mock layer list
		mockLayerList = document.createElement( 'div' );
		mockLayerList.className = 'layers-list';

		// Create mock event tracker
		mockEventTracker = {
			addEventListener: jest.fn( ( target, type, handler ) => {
				target.addEventListener( type, handler );
			} )
		};
	} );

	afterEach( () => {
		if ( controller && typeof controller.destroy === 'function' ) {
			controller.destroy();
		}
		delete window.Layers;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create controller with correct properties', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.editor ).toBe( mockEditor );
			expect( controller.layerList ).toBe( mockLayerList );
		} );

		it( 'should handle missing config gracefully', () => {
			controller = new BackgroundLayerController();

			expect( controller.editor ).toBe( null );
			expect( controller.layerList ).toBe( null );
		} );

		it( 'should use default msg function when not provided', () => {
			controller = new BackgroundLayerController( { editor: mockEditor } );

			const result = controller.msg( 'test-key', 'Fallback Value' );
			expect( result ).toBe( 'Fallback Value' );
		} );
	} );

	describe( 'getBackgroundVisible', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should return true when backgroundVisible is true', () => {
			mockStateManager._stateMap.set( 'backgroundVisible', true );

			expect( controller.getBackgroundVisible() ).toBe( true );
		} );

		it( 'should return false when backgroundVisible is false', () => {
			mockStateManager._stateMap.set( 'backgroundVisible', false );

			expect( controller.getBackgroundVisible() ).toBe( false );
		} );

		it( 'should return false when backgroundVisible is integer 0 (API serialization)', () => {
			// API returns 0/1 integers due to PHP boolean serialization
			mockStateManager._stateMap.set( 'backgroundVisible', 0 );

			expect( controller.getBackgroundVisible() ).toBe( false );
		} );

		it( 'should return true when backgroundVisible is integer 1 (API serialization)', () => {
			mockStateManager._stateMap.set( 'backgroundVisible', 1 );

			expect( controller.getBackgroundVisible() ).toBe( true );
		} );

		it( 'should return true when backgroundVisible is undefined (default)', () => {
			// Not setting any value - should default to true
			expect( controller.getBackgroundVisible() ).toBe( true );
		} );

		it( 'should return true when stateManager is unavailable', () => {
			controller.editor = null;

			expect( controller.getBackgroundVisible() ).toBe( true );
		} );
	} );

	describe( 'getBackgroundOpacity', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should return opacity value from stateManager', () => {
			mockStateManager._stateMap.set( 'backgroundOpacity', 0.5 );

			expect( controller.getBackgroundOpacity() ).toBe( 0.5 );
		} );

		it( 'should return 1.0 when opacity is undefined (default)', () => {
			expect( controller.getBackgroundOpacity() ).toBe( 1.0 );
		} );

		it( 'should return 1.0 when stateManager is unavailable', () => {
			controller.editor = null;

			expect( controller.getBackgroundOpacity() ).toBe( 1.0 );
		} );

		it( 'should return 1.0 for non-number opacity values', () => {
			mockStateManager._stateMap.set( 'backgroundOpacity', 'invalid' );

			expect( controller.getBackgroundOpacity() ).toBe( 1.0 );
		} );
	} );

	describe( 'toggleBackgroundVisibility', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should toggle visibility from true to false', () => {
			mockStateManager._stateMap.set( 'backgroundVisible', true );

			controller.toggleBackgroundVisibility();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );
		} );

		it( 'should toggle visibility from false to true', () => {
			mockStateManager._stateMap.set( 'backgroundVisible', false );

			controller.toggleBackgroundVisibility();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
		} );

		it( 'should call canvasManager.redraw after toggling', () => {
			controller.toggleBackgroundVisibility();

			expect( mockCanvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should handle missing stateManager gracefully', () => {
			controller.editor = null;

			expect( () => controller.toggleBackgroundVisibility() ).not.toThrow();
		} );
	} );

	describe( 'setBackgroundOpacity', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should set opacity value', () => {
			controller.setBackgroundOpacity( 0.75 );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 0.75 );
		} );

		it( 'should clamp opacity to minimum 0', () => {
			controller.setBackgroundOpacity( -0.5 );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 0 );
		} );

		it( 'should clamp opacity to maximum 1', () => {
			controller.setBackgroundOpacity( 1.5 );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 1 );
		} );

		it( 'should call canvasManager.redraw after setting', () => {
			controller.setBackgroundOpacity( 0.5 );

			expect( mockCanvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should handle missing stateManager gracefully', () => {
			controller.editor = null;

			expect( () => controller.setBackgroundOpacity( 0.5 ) ).not.toThrow();
		} );
	} );

	describe( 'createBackgroundLayerItem', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should create a div with correct class', () => {
			const item = controller.createBackgroundLayerItem();

			expect( item.className ).toContain( 'layer-item' );
			expect( item.className ).toContain( 'background-layer-item' );
		} );

		it( 'should set correct data-layer-id', () => {
			const item = controller.createBackgroundLayerItem();

			expect( item.dataset.layerId ).toBe( '__background__' );
		} );

		it( 'should include ARIA attributes', () => {
			const item = controller.createBackgroundLayerItem();

			expect( item.getAttribute( 'role' ) ).toBe( 'option' );
			expect( item.getAttribute( 'aria-selected' ) ).toBe( 'false' );
			expect( item.getAttribute( 'aria-label' ) ).toBe( 'Background Image' );
		} );

		it( 'should include visibility button', () => {
			const item = controller.createBackgroundLayerItem();
			const visBtn = item.querySelector( '.background-visibility' );

			expect( visBtn ).not.toBe( null );
			expect( visBtn.getAttribute( 'aria-label' ) ).toBe( 'Toggle background visibility' );
		} );

		it( 'should include opacity slider', () => {
			const item = controller.createBackgroundLayerItem();
			const slider = item.querySelector( '.background-opacity-slider' );

			expect( slider ).not.toBe( null );
			expect( slider.type ).toBe( 'range' );
			expect( slider.min ).toBe( '0' );
			expect( slider.max ).toBe( '100' );
		} );

		it( 'should include lock icon', () => {
			const item = controller.createBackgroundLayerItem();
			const lockIcon = item.querySelector( '.background-lock' );

			expect( lockIcon ).not.toBe( null );
		} );
	} );

	describe( 'render', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should create background item if none exists', () => {
			controller.render();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			expect( bgItem ).not.toBe( null );
		} );

		it( 'should update existing background item', () => {
			// First render creates the item
			controller.render();

			// Set state
			mockStateManager._stateMap.set( 'backgroundOpacity', 0.5 );

			// Second render updates the item
			controller.render();

			const slider = mockLayerList.querySelector( '.background-opacity-slider' );
			expect( slider.value ).toBe( '50' );
		} );

		it( 'should do nothing if layerList is null', () => {
			controller.layerList = null;

			expect( () => controller.render() ).not.toThrow();
		} );
	} );

	describe( 'updateBackgroundLayerItem', () => {
		let bgItem;

		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			// Create background item first
			controller.render();
			bgItem = mockLayerList.querySelector( '.background-layer-item' );
		} );

		it( 'should update visibility button aria-pressed', () => {
			mockStateManager._stateMap.set( 'backgroundVisible', false );

			controller.updateBackgroundLayerItem( bgItem );

			const visBtn = bgItem.querySelector( '.background-visibility' );
			expect( visBtn.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		} );

		it( 'should update opacity slider value', () => {
			mockStateManager._stateMap.set( 'backgroundOpacity', 0.75 );

			controller.updateBackgroundLayerItem( bgItem );

			const slider = bgItem.querySelector( '.background-opacity-slider' );
			expect( slider.value ).toBe( '75' );
		} );

		it( 'should update opacity label', () => {
			mockStateManager._stateMap.set( 'backgroundOpacity', 0.25 );

			controller.updateBackgroundLayerItem( bgItem );

			const label = bgItem.querySelector( '.background-opacity-label' );
			expect( label.textContent ).toBe( '25%' );
		} );

		it( 'should find item in DOM if not provided', () => {
			mockStateManager._stateMap.set( 'backgroundOpacity', 0.33 );

			controller.updateBackgroundLayerItem();

			const label = mockLayerList.querySelector( '.background-opacity-label' );
			expect( label.textContent ).toBe( '33%' );
		} );

		it( 'should handle missing item gracefully', () => {
			controller.layerList = document.createElement( 'div' ); // Empty

			expect( () => controller.updateBackgroundLayerItem() ).not.toThrow();
		} );
	} );

	describe( 'setLayerList', () => {
		it( 'should update the layerList reference', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList
			} );

			const newLayerList = document.createElement( 'div' );
			controller.setLayerList( newLayerList );

			expect( controller.layerList ).toBe( newLayerList );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all references', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList
			} );

			controller.destroy();

			expect( controller.editor ).toBe( null );
			expect( controller.layerList ).toBe( null );
			expect( controller.config ).toBe( null );
		} );
	} );

	describe( 'event handling', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();
		} );

		it( 'should toggle visibility when visibility button clicked', () => {
			mockStateManager._stateMap.set( 'backgroundVisible', true );
			const visBtn = mockLayerList.querySelector( '.background-visibility' );

			visBtn.click();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );
		} );

		it( 'should update opacity when slider changed', () => {
			const slider = mockLayerList.querySelector( '.background-opacity-slider' );

			slider.value = '50';
			slider.dispatchEvent( new Event( 'input' ) );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 0.5 );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export BackgroundLayerController class', () => {
			expect( BackgroundLayerController ).toBeDefined();
			expect( typeof BackgroundLayerController ).toBe( 'function' );
		} );

		it( 'should register in window.Layers.UI namespace', () => {
			expect( window.Layers.UI.BackgroundLayerController ).toBe( BackgroundLayerController );
		} );
	} );
} );
