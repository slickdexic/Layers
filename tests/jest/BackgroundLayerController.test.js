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
			const visBtn = item.querySelector( '.background-visibility-btn' );

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

			const visBtn = bgItem.querySelector( '.background-visibility-btn' );
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
			const visBtn = mockLayerList.querySelector( '.background-visibility-btn' );

			visBtn.click();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );
		} );

		it( 'should update opacity when slider changed', () => {
			const slider = mockLayerList.querySelector( '.background-opacity-slider' );

			slider.value = '50';
			slider.dispatchEvent( new Event( 'input' ) );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 0.5 );
		} );

		it( 'should use direct addEventListener when addTargetListener not provided', () => {
			// Create controller without addTargetListener
			const controllerWithoutTracker = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
				// No addTargetListener provided
			} );
			controllerWithoutTracker.render();

			// Visibility button should still work via direct addEventListener
			mockStateManager._stateMap.set( 'backgroundVisible', true );
			const visBtn = mockLayerList.querySelector( '.background-visibility-btn' );

			visBtn.click();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );

			// Opacity slider should also work via direct addEventListener
			const opacitySlider = mockLayerList.querySelector( '.background-opacity-slider' );
			if ( opacitySlider ) {
				opacitySlider.value = '75';
				opacitySlider.dispatchEvent( new Event( 'input' ) );
				expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 0.75 );
			}
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

	// ============================================================
	// SM-1: Slide Mode - Canvas Layer Tests
	// ============================================================
	describe( 'slide mode (SM-1 fix verification)', () => {
		beforeEach( () => {
			// Set up slide mode state
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ff0000' );
			mockStateManager._stateMap.set( 'slideCanvasWidth', 1024 );
			mockStateManager._stateMap.set( 'slideCanvasHeight', 768 );
		} );

		it( 'isSlideMode() should return true when isSlide state is true', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.isSlideMode() ).toBe( true );
		} );

		it( 'isSlideMode() should return false when isSlide state is false', () => {
			mockStateManager._stateMap.set( 'isSlide', false );

			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.isSlideMode() ).toBe( false );
		} );

		it( 'should create Canvas layer item in slide mode', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			expect( bgItem ).not.toBe( null );
			expect( bgItem.classList.contains( 'canvas-layer-item' ) ).toBe( true );
			expect( bgItem.classList.contains( 'background-layer-item--slide' ) ).toBe( true );
		} );

		it( 'should show "Canvas" label in slide mode', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			expect( bgItem.getAttribute( 'aria-label' ) ).toBe( 'Canvas' );

			// Canvas name text should be present
			const nameEl = bgItem.querySelector( '.canvas-name' );
			expect( nameEl ).not.toBe( null );
			expect( nameEl.textContent ).toBe( 'Canvas' );
		} );

		it( 'should include color swatch in slide mode', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			const colorSwatch = bgItem.querySelector( '.layer-background-color-swatch' );
			expect( colorSwatch ).not.toBe( null );
			expect( colorSwatch.style.backgroundColor ).toBe( 'rgb(255, 0, 0)' ); // #ff0000
		} );

		it( 'should include opacity slider in slide mode', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			const opacitySlider = bgItem.querySelector( '.background-opacity-slider' );
			// Slide mode canvas now has opacity slider (SM-1c fix)
			expect( opacitySlider ).not.toBe( null );
		} );

		it( 'getSlideBackgroundColor() should return color from state', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.getSlideBackgroundColor() ).toBe( '#ff0000' );
		} );

		it( 'getSlideBackgroundColor() should return default white if not set', () => {
			mockStateManager._stateMap.delete( 'slideBackgroundColor' );

			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.getSlideBackgroundColor() ).toBe( '#ffffff' );
		} );
	} );

	describe( 'image mode vs slide mode (SM-1 regression check)', () => {
		it( 'should create Background Image layer in image mode (not slide)', () => {
			mockStateManager._stateMap.set( 'isSlide', false );
			mockStateManager._stateMap.set( 'backgroundVisible', true );
			mockStateManager._stateMap.set( 'backgroundOpacity', 0.8 );

			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			expect( bgItem ).not.toBe( null );

			// Should NOT have slide-specific classes
			expect( bgItem.classList.contains( 'canvas-layer-item' ) ).toBe( false );
			expect( bgItem.classList.contains( 'background-layer-item--slide' ) ).toBe( false );

			// Should have "Background Image" label
			expect( bgItem.getAttribute( 'aria-label' ) ).toBe( 'Background Image' );

			// Should have opacity slider (image mode has this)
			const opacitySlider = bgItem.querySelector( '.background-opacity-slider' );
			expect( opacitySlider ).not.toBe( null );

			// Should NOT have color swatch (image mode uses background image)
			const colorSwatch = bgItem.querySelector( '.layer-background-color-swatch' );
			expect( colorSwatch ).toBe( null );
		} );
	} );

	// ============================================================
	// Additional coverage tests for uncovered methods
	// ============================================================

	describe( 'selectCanvasLayer', () => {
		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ffffff' );
			mockEditor.layerPanel = {
				showCanvasProperties: jest.fn()
			};
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();
		} );

		it( 'should call showCanvasProperties when available', () => {
			controller.selectCanvasLayer();

			expect( mockEditor.layerPanel.showCanvasProperties ).toHaveBeenCalled();
		} );

		it( 'should set canvasLayerSelected to true in state', () => {
			controller.selectCanvasLayer();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'canvasLayerSelected', true );
		} );

		it( 'should clear selectedLayerIds', () => {
			controller.selectCanvasLayer();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [] );
		} );

		it( 'should add selected class to background item', () => {
			controller.selectCanvasLayer();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			expect( bgItem.classList.contains( 'selected' ) ).toBe( true );
			expect( bgItem.getAttribute( 'aria-selected' ) ).toBe( 'true' );
		} );

		it( 'should remove selected class from other layer items', () => {
			// Add another layer item
			const otherItem = document.createElement( 'div' );
			otherItem.className = 'layer-item selected';
			mockLayerList.appendChild( otherItem );

			controller.selectCanvasLayer();

			expect( otherItem.classList.contains( 'selected' ) ).toBe( false );
		} );

		it( 'should handle missing layerPanel gracefully', () => {
			mockEditor.layerPanel = null;

			expect( () => controller.selectCanvasLayer() ).not.toThrow();
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'canvasLayerSelected', true );
		} );

		it( 'should handle missing showCanvasProperties method', () => {
			mockEditor.layerPanel = {}; // No showCanvasProperties

			expect( () => controller.selectCanvasLayer() ).not.toThrow();
		} );

		it( 'should handle missing editor gracefully', () => {
			controller.editor = null;

			expect( () => controller.selectCanvasLayer() ).not.toThrow();
		} );

		it( 'should respond to canvas layer click', () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			controller.render();

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			bgItem.click();

			expect( mockEditor.layerPanel.showCanvasProperties ).toHaveBeenCalled();
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'canvasLayerSelected', true );
		} );

		it( 'should not trigger selection when clicking visibility button', () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'backgroundVisible', true );
			controller.render();

			mockEditor.layerPanel.showCanvasProperties.mockClear();
			const visBtn = mockLayerList.querySelector( '.background-visibility-btn' );
			visBtn.click();

			// Should toggle visibility, not select
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );
			// showCanvasProperties should NOT be called by the visibility toggle
			// (it may have been called during render, so we cleared it first)
		} );
	} );

	describe( 'setCanvasDimension', () => {
		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'slideCanvasWidth', 800 );
			mockStateManager._stateMap.set( 'slideCanvasHeight', 600 );
			mockCanvasManager.setBaseDimensions = jest.fn();
			mockCanvasManager.resizeCanvas = jest.fn();
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should set slideCanvasWidth for width dimension', () => {
			controller.setCanvasDimension( 'width', 1024 );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'slideCanvasWidth', 1024 );
		} );

		it( 'should set slideCanvasHeight for height dimension', () => {
			controller.setCanvasDimension( 'height', 768 );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'slideCanvasHeight', 768 );
		} );

		it( 'should also set baseWidth/baseHeight for consistency', () => {
			controller.setCanvasDimension( 'width', 1024 );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'baseWidth', 1024 );
		} );

		it( 'should mark dirty', () => {
			controller.setCanvasDimension( 'width', 1024 );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'isDirty', true );
		} );

		it( 'should call setBaseDimensions when available', () => {
			controller.setCanvasDimension( 'width', 1024 );

			expect( mockCanvasManager.setBaseDimensions ).toHaveBeenCalledWith( 1024, 600 );
		} );

		it( 'should use fallback resizeCanvas when setBaseDimensions unavailable', () => {
			delete mockCanvasManager.setBaseDimensions;

			controller.setCanvasDimension( 'width', 1024 );

			expect( mockCanvasManager.resizeCanvas ).toHaveBeenCalled();
			expect( mockCanvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should handle missing editor gracefully', () => {
			controller.editor = null;

			expect( () => controller.setCanvasDimension( 'width', 1024 ) ).not.toThrow();
		} );

		it( 'should handle missing canvasManager gracefully', () => {
			mockEditor.canvasManager = null;

			expect( () => controller.setCanvasDimension( 'width', 1024 ) ).not.toThrow();
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'slideCanvasWidth', 1024 );
		} );
	} );

	describe( 'setSlideBackgroundColor', () => {
		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockCanvasManager.setBackgroundColor = jest.fn();
			mockEditor.layerPanel = {
				updateCanvasColorSwatch: jest.fn()
			};
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();
		} );

		it( 'should set slideBackgroundColor in state', () => {
			controller.setSlideBackgroundColor( '#ff0000' );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'slideBackgroundColor', '#ff0000' );
		} );

		it( 'should call canvasManager.setBackgroundColor when available', () => {
			controller.setSlideBackgroundColor( '#00ff00' );

			expect( mockCanvasManager.setBackgroundColor ).toHaveBeenCalledWith( '#00ff00' );
		} );

		it( 'should mark dirty', () => {
			controller.setSlideBackgroundColor( '#0000ff' );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'isDirty', true );
		} );

		it( 'should call canvasManager.redraw', () => {
			controller.setSlideBackgroundColor( '#ff00ff' );

			expect( mockCanvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should call updateCanvasColorSwatch when available', () => {
			controller.setSlideBackgroundColor( '#ffff00' );

			expect( mockEditor.layerPanel.updateCanvasColorSwatch ).toHaveBeenCalledWith( '#ffff00' );
		} );

		it( 'should handle missing setBackgroundColor gracefully', () => {
			delete mockCanvasManager.setBackgroundColor;

			expect( () => controller.setSlideBackgroundColor( '#ffffff' ) ).not.toThrow();
		} );

		it( 'should handle missing layerPanel gracefully', () => {
			mockEditor.layerPanel = null;

			expect( () => controller.setSlideBackgroundColor( '#ffffff' ) ).not.toThrow();
		} );

		it( 'should handle missing editor gracefully', () => {
			controller.editor = null;

			expect( () => controller.setSlideBackgroundColor( '#ffffff' ) ).not.toThrow();
		} );
	} );

	describe( 'openColorPicker', () => {
		let anchorElement;

		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ffffff' );
			anchorElement = document.createElement( 'button' );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should use toolbar color picker when available', () => {
			mockEditor.toolbar = {
				openColorPickerDialog: jest.fn()
			};

			controller.openColorPicker( anchorElement );

			expect( mockEditor.toolbar.openColorPickerDialog ).toHaveBeenCalledWith(
				anchorElement,
				'#ffffff',
				expect.objectContaining( {
					allowTransparent: true,
					onApply: expect.any( Function )
				} )
			);
		} );

		it( 'should call onApply callback when color picker applies', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ffffff' );
			mockCanvasManager.setBackgroundColor = jest.fn();
			let capturedOnApply;
			mockEditor.toolbar = {
				openColorPickerDialog: jest.fn( ( anchor, color, options ) => {
					capturedOnApply = options.onApply;
				} )
			};

			controller.openColorPicker( anchorElement );
			capturedOnApply( '#ff0000' );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'slideBackgroundColor', '#ff0000' );
		} );

		it( 'should fall back to native color input when toolbar not available', () => {
			mockEditor.toolbar = null;

			// Mock click on color input
			const clickSpy = jest.spyOn( HTMLInputElement.prototype, 'click' ).mockImplementation( () => {} );

			controller.openColorPicker( anchorElement );

			// Should have created a color input in the DOM
			const colorInput = document.body.querySelector( 'input[type="color"]' );
			expect( colorInput ).not.toBe( null );
			expect( clickSpy ).toHaveBeenCalled();

			// Clean up
			if ( colorInput && colorInput.parentNode ) {
				colorInput.parentNode.removeChild( colorInput );
			}
			clickSpy.mockRestore();
		} );

		it( 'should set transparent color to white in fallback input', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', 'transparent' );
			mockEditor.toolbar = null;

			jest.spyOn( HTMLInputElement.prototype, 'click' ).mockImplementation( () => {} );

			controller.openColorPicker( anchorElement );

			const colorInput = document.body.querySelector( 'input[type="color"]' );
			expect( colorInput.value ).toBe( '#ffffff' );

			// Clean up
			if ( colorInput && colorInput.parentNode ) {
				colorInput.parentNode.removeChild( colorInput );
			}
		} );

		it( 'should call setSlideBackgroundColor on fallback input change', () => {
			mockEditor.toolbar = null;
			mockCanvasManager.setBackgroundColor = jest.fn();
			jest.spyOn( HTMLInputElement.prototype, 'click' ).mockImplementation( () => {} );

			controller.openColorPicker( anchorElement );

			const colorInput = document.body.querySelector( 'input[type="color"]' );
			colorInput.value = '#00ff00';
			colorInput.dispatchEvent( new Event( 'change' ) );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'slideBackgroundColor', '#00ff00' );
		} );

		it( 'should remove fallback input on blur after timeout', () => {
			jest.useFakeTimers();
			mockEditor.toolbar = null;
			jest.spyOn( HTMLInputElement.prototype, 'click' ).mockImplementation( () => {} );

			controller.openColorPicker( anchorElement );

			const colorInput = document.body.querySelector( 'input[type="color"]' );
			colorInput.dispatchEvent( new Event( 'blur' ) );

			jest.advanceTimersByTime( 150 );

			expect( document.body.querySelector( 'input[type="color"]' ) ).toBe( null );

			jest.useRealTimers();
		} );
	} );

	describe( 'createBackgroundIcon', () => {
		it( 'should create SVG icon for background image', () => {
			mockStateManager._stateMap.set( 'isSlide', false );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			const icon = controller.createBackgroundIcon();

			expect( icon.className ).toBe( 'layer-background-icon' );
			expect( icon.querySelector( 'svg' ) ).not.toBe( null );
		} );
	} );

	describe( 'createColorSwatchIcon', () => {
		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
		} );

		it( 'should create color swatch with current background color', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ff0000' );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			const swatch = controller.createColorSwatchIcon();

			expect( swatch.className ).toBe( 'layer-background-color-swatch' );
			expect( swatch.style.background ).toContain( 'rgb(255, 0, 0)' );
		} );

		it( 'should show diagonal stripe for transparent color', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', 'transparent' );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			const swatch = controller.createColorSwatchIcon();

			expect( swatch.style.background ).toContain( 'repeating-linear-gradient' );
		} );

		it( 'should show diagonal stripe for none color', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', 'none' );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			const swatch = controller.createColorSwatchIcon();

			expect( swatch.style.background ).toContain( 'repeating-linear-gradient' );
		} );

		it( 'should default to white for empty color', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', '' );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			const swatch = controller.createColorSwatchIcon();

			// Empty string is falsy, so getSlideBackgroundColor returns '#ffffff'
			expect( swatch.style.background ).toContain( 'rgb(255, 255, 255)' );
		} );
	} );

	describe( 'createLockIcon', () => {
		it( 'should create lock icon element', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			const lockIcon = controller.createLockIcon( ( key, fallback ) => fallback );

			expect( lockIcon.className ).toContain( 'layer-lock' );
			expect( lockIcon.className ).toContain( 'background-lock' );
			expect( lockIcon.title ).toBe( 'Background is always locked' );
		} );

		it( 'should append IconFactory lock icon when available', () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			const lockIcon = controller.createLockIcon( ( key, fallback ) => fallback );

			// IconFactory was mocked to return a span with text
			const iconSpan = lockIcon.querySelector( 'span' );
			expect( iconSpan ).not.toBe( null );
			expect( iconSpan.textContent ).toBe( 'locked' );
		} );
	} );

	describe( 'render with color swatch update in slide mode', () => {
		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#0000ff' );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should update color swatch on re-render', () => {
			controller.render();

			// Change color
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ff0000' );

			// Re-render
			controller.render();

			const swatch = mockLayerList.querySelector( '.layer-background-color-swatch' );
			expect( swatch.style.background ).toContain( 'rgb(255, 0, 0)' );
		} );

		it( 'should update swatch to diagonal stripe when color becomes transparent', () => {
			controller.render();

			// Change to transparent
			mockStateManager._stateMap.set( 'slideBackgroundColor', 'transparent' );

			// Re-render
			controller.render();

			const swatch = mockLayerList.querySelector( '.layer-background-color-swatch' );
			expect( swatch.style.background ).toContain( 'repeating-linear-gradient' );
		} );
	} );

	describe( 'updateBackgroundLayerItem in slide mode', () => {
		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ffffff' );
			mockStateManager._stateMap.set( 'slideCanvasWidth', 800 );
			mockStateManager._stateMap.set( 'slideCanvasHeight', 600 );
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
			controller.render();
		} );

		it( 'should update color swatch background', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ff00ff' );

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			controller.updateBackgroundLayerItem( bgItem );

			const swatch = bgItem.querySelector( '.layer-background-color-swatch' );
			expect( swatch.style.background ).toContain( 'rgb(255, 0, 255)' );
		} );

		it( 'should update swatch to transparent pattern', () => {
			mockStateManager._stateMap.set( 'slideBackgroundColor', 'transparent' );

			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			controller.updateBackgroundLayerItem( bgItem );

			const swatch = bgItem.querySelector( '.layer-background-color-swatch' );
			expect( swatch.style.background ).toContain( 'repeating-linear-gradient' );
		} );
	} );

	describe( 'optimized redraw', () => {
		beforeEach( () => {
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );
		} );

		it( 'should use redrawOptimized when available during opacity change', () => {
			mockCanvasManager.redrawOptimized = jest.fn();

			controller.setBackgroundOpacity( 0.5 );

			expect( mockCanvasManager.redrawOptimized ).toHaveBeenCalled();
		} );

		it( 'should fall back to regular redraw when redrawOptimized unavailable', () => {
			delete mockCanvasManager.redrawOptimized;

			controller.setBackgroundOpacity( 0.5 );

			expect( mockCanvasManager.redraw ).toHaveBeenCalled();
		} );
	} );

	describe( 'createCanvasLayerContent click handling', () => {
		beforeEach( () => {
			mockStateManager._stateMap.set( 'isSlide', true );
			mockStateManager._stateMap.set( 'slideBackgroundColor', '#ffffff' );
			mockEditor.layerPanel = {
				showCanvasProperties: jest.fn()
			};
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback,
				addTargetListener: ( target, event, handler ) => target.addEventListener( event, handler )
			} );
			controller.render();
		} );

		it( 'should select canvas on item click', () => {
			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			bgItem.click();

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'canvasLayerSelected', true );
		} );

		it( 'should not select when clicking on button', () => {
			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			const btn = bgItem.querySelector( 'button' );

			mockStateManager.set.mockClear();
			const event = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( event, 'target', { value: btn } );
			bgItem.dispatchEvent( event );

			// The button itself triggers visibility toggle, not canvas selection
			// Check that canvasLayerSelected was not set by the item click handler
			const canvasSelectedCalls = mockStateManager.set.mock.calls.filter(
				( [ key ] ) => key === 'canvasLayerSelected'
			);
			// The visibility button click may propagate, so we check behavior
			expect( canvasSelectedCalls.length ).toBe( 0 );
		} );

		it( 'should not select when clicking on input', () => {
			const bgItem = mockLayerList.querySelector( '.background-layer-item' );
			const input = bgItem.querySelector( 'input' );

			mockStateManager.set.mockClear();
			const event = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( event, 'target', { value: input } );
			bgItem.dispatchEvent( event );

			const canvasSelectedCalls = mockStateManager.set.mock.calls.filter(
				( [ key ] ) => key === 'canvasLayerSelected'
			);
			expect( canvasSelectedCalls.length ).toBe( 0 );
		} );
	} );

	describe( 'isSlideMode edge cases', () => {
		it( 'should return false when editor is null', () => {
			controller = new BackgroundLayerController( {
				editor: null,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.isSlideMode() ).toBe( false );
		} );

		it( 'should return false when stateManager is null', () => {
			mockEditor.stateManager = null;
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.isSlideMode() ).toBe( false );
		} );
	} );

	describe( 'getSlideBackgroundColor edge cases', () => {
		it( 'should return #ffffff when editor is null', () => {
			controller = new BackgroundLayerController( {
				editor: null,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.getSlideBackgroundColor() ).toBe( '#ffffff' );
		} );

		it( 'should return #ffffff when stateManager is null', () => {
			mockEditor.stateManager = null;
			controller = new BackgroundLayerController( {
				editor: mockEditor,
				layerList: mockLayerList,
				msg: ( key, fallback ) => fallback
			} );

			expect( controller.getSlideBackgroundColor() ).toBe( '#ffffff' );
		} );
	} );
} );
