/**
 * Tests for LayerPanel keyboard navigation
 *
 * Covers handleLayerListKeydown and focusLayerAtIndex methods
 */

const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );

// Mock IconFactory
const mockIconFactory = {
	createSVGElement: jest.fn( ( tag ) => document.createElementNS( 'http://www.w3.org/2000/svg', tag ) ),
	createEyeIcon: jest.fn( () => document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' ) ),
	createLockIcon: jest.fn( () => document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' ) ),
	createDeleteIcon: jest.fn( () => document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' ) ),
	createGrabIcon: jest.fn( () => document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' ) )
};

describe( 'LayerPanel Keyboard Navigation', () => {
	let LayerPanel;
	let layerPanel;
	let mockEditor;
	let mockStateManager;
	let mockLayers;

	beforeEach( () => {
		// Set up mock layers
		mockLayers = [
			{ id: 'layer1', type: 'rectangle', name: 'Layer 1', visible: true, locked: false },
			{ id: 'layer2', type: 'circle', name: 'Layer 2', visible: true, locked: false },
			{ id: 'layer3', type: 'text', name: 'Layer 3', visible: false, locked: true }
		];

		// Setup window globals
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.Layers.UI.IconFactory = mockIconFactory;
		window.Layers.UI.ColorPickerDialog = null;
		window.Layers.UI.ConfirmDialog = null;
		window.Layers.UI.PropertiesForm = null;

		// Mock EventTracker
		window.EventTracker = jest.fn( function () {
			this.listeners = [];
			this.add = jest.fn( ( element, event, handler, options ) => {
				element.addEventListener( event, handler, options );
				this.listeners.push( { element, event, handler, options } );
				return { element, event, handler, options };
			} );
			this.remove = jest.fn();
			this.removeAllForElement = jest.fn();
			this.count = jest.fn( () => this.listeners.length );
			this.destroy = jest.fn( () => {
				this.listeners.forEach( ( info ) => {
					if ( info.element && info.element.removeEventListener ) {
						info.element.removeEventListener( info.event, info.handler, info.options );
					}
				} );
				this.listeners = [];
			} );
		} );

		// Setup DOM
		document.body.innerHTML = '<div id="layers-panel-container"></div>';

		// Create mock StateManager
		mockStateManager = new StateManager();
		mockStateManager.set( 'layers', mockLayers );
		mockStateManager.set( 'selectedLayerIds', [] );

		// Create mock editor
		mockEditor = {
			layers: mockLayers,
			stateManager: mockStateManager,
			historyManager: {
				saveState: jest.fn()
			},
			canvasManager: {
				redraw: jest.fn(),
				renderLayers: jest.fn(),
				selectLayer: jest.fn()
			},
			container: document.body,
			getLayerById: jest.fn( ( id ) => mockLayers.find( ( l ) => l.id === id ) ),
			updateLayer: jest.fn(),
			deleteLayer: jest.fn(),
			removeLayer: jest.fn(),
			saveState: jest.fn()
		};

		// Reset module cache
		jest.resetModules();
		jest.clearAllMocks();

		// Re-establish globals AFTER resetModules (they get cleared)
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.Layers.UI.IconFactory = mockIconFactory;
		window.Layers.UI.ColorPickerDialog = null;
		window.Layers.UI.ConfirmDialog = null;
		window.Layers.UI.PropertiesForm = null;

		require( '../../resources/ext.layers.editor/LayerPanel.js' );
		LayerPanel = window.Layers.UI.LayerPanel;

		// Create LayerPanel instance with options object (matching constructor signature)
		const container = document.getElementById( 'layers-panel-container' );
		layerPanel = new LayerPanel( {
			container: container,
			editor: mockEditor
		} );

		// Ensure layerList exists
		if ( !layerPanel.layerList ) {
			layerPanel.layerList = document.createElement( 'div' );
			layerPanel.layerList.className = 'layer-list';
			container.appendChild( layerPanel.layerList );
		}

		// Set up layer list with mock items
		layerPanel.layerList.innerHTML = '';
		mockLayers.forEach( ( layer ) => {
			const item = document.createElement( 'div' );
			item.className = 'layer-item';
			item.dataset.layerId = layer.id;
			item.setAttribute( 'tabindex', '0' );

			const grabArea = document.createElement( 'div' );
			grabArea.className = 'layer-grab-area';
			grabArea.setAttribute( 'tabindex', '0' );
			item.appendChild( grabArea );

			layerPanel.layerList.appendChild( item );
		} );
	} );

	afterEach( () => {
		if ( layerPanel && typeof layerPanel.destroy === 'function' ) {
			layerPanel.destroy();
		}
		document.body.innerHTML = '';
		jest.restoreAllMocks();
	} );

	describe( 'handleLayerListKeydown', () => {
		const createKeyEvent = ( key, options = {} ) => {
			return new KeyboardEvent( 'keydown', {
				key,
				bubbles: true,
				cancelable: true,
				...options
			} );
		};

		it( 'should do nothing when target is not a layer item', () => {
			const event = createKeyEvent( 'ArrowDown' );
			Object.defineProperty( event, 'target', { value: document.createElement( 'div' ) } );

			layerPanel.handleLayerListKeydown( event );
			// Should not throw and not change focus
		} );

		it( 'should handle gracefully when layers array is empty', () => {
			// Clear layers from state
			mockEditor.layers = [];
			mockStateManager.set( 'layers', [] );

			// Create a temporary layer item in DOM (simulating stale UI state)
			const tempItem = document.createElement( 'div' );
			tempItem.className = 'layer-item';
			tempItem.dataset.layerId = 'stale-layer';
			layerPanel.layerList.appendChild( tempItem );

			const event = createKeyEvent( 'ArrowDown' );
			Object.defineProperty( event, 'target', { value: tempItem } );

			// Should handle gracefully without throwing
			expect( () => {
				layerPanel.handleLayerListKeydown( event );
			} ).not.toThrow();

			layerPanel.layerList.removeChild( tempItem );
		} );

		it( 'should navigate up with ArrowUp key', () => {
			const secondItem = layerPanel.layerList.querySelectorAll( '.layer-item' )[ 1 ];
			const event = createKeyEvent( 'ArrowUp' );
			Object.defineProperty( event, 'target', { value: secondItem } );

			const focusSpy = jest.spyOn( layerPanel, 'focusLayerAtIndex' );
			layerPanel.handleLayerListKeydown( event );

			expect( focusSpy ).toHaveBeenCalledWith( 0 );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should not navigate up when at first item', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const event = createKeyEvent( 'ArrowUp' );
			Object.defineProperty( event, 'target', { value: firstItem } );

			const focusSpy = jest.spyOn( layerPanel, 'focusLayerAtIndex' );
			layerPanel.handleLayerListKeydown( event );

			expect( focusSpy ).not.toHaveBeenCalled();
		} );

		it( 'should navigate down with ArrowDown key', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const event = createKeyEvent( 'ArrowDown' );
			Object.defineProperty( event, 'target', { value: firstItem } );

			const focusSpy = jest.spyOn( layerPanel, 'focusLayerAtIndex' );
			layerPanel.handleLayerListKeydown( event );

			expect( focusSpy ).toHaveBeenCalledWith( 1 );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should not navigate down when at last item', () => {
			const lastItem = layerPanel.layerList.querySelectorAll( '.layer-item' )[ 2 ];
			const event = createKeyEvent( 'ArrowDown' );
			Object.defineProperty( event, 'target', { value: lastItem } );

			const focusSpy = jest.spyOn( layerPanel, 'focusLayerAtIndex' );
			layerPanel.handleLayerListKeydown( event );

			expect( focusSpy ).not.toHaveBeenCalled();
		} );

		it( 'should navigate to first item with Home key', () => {
			const lastItem = layerPanel.layerList.querySelectorAll( '.layer-item' )[ 2 ];
			const event = createKeyEvent( 'Home' );
			Object.defineProperty( event, 'target', { value: lastItem } );

			const focusSpy = jest.spyOn( layerPanel, 'focusLayerAtIndex' );
			layerPanel.handleLayerListKeydown( event );

			expect( focusSpy ).toHaveBeenCalledWith( 0 );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should navigate to last item with End key', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const event = createKeyEvent( 'End' );
			Object.defineProperty( event, 'target', { value: firstItem } );

			const focusSpy = jest.spyOn( layerPanel, 'focusLayerAtIndex' );
			layerPanel.handleLayerListKeydown( event );

			expect( focusSpy ).toHaveBeenCalledWith( 2 );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should select layer with Enter key', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'Enter' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const selectSpy = jest.spyOn( layerPanel, 'selectLayer' );
			layerPanel.handleLayerListKeydown( event );

			expect( selectSpy ).toHaveBeenCalledWith( 'layer1' );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should select layer with Space key', () => {
			const secondItem = layerPanel.layerList.querySelectorAll( '.layer-item' )[ 1 ];
			const grabArea = secondItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( ' ' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const selectSpy = jest.spyOn( layerPanel, 'selectLayer' );
			layerPanel.handleLayerListKeydown( event );

			expect( selectSpy ).toHaveBeenCalledWith( 'layer2' );
		} );

		it( 'should not select when Enter pressed on button', () => {
			const button = document.createElement( 'button' );
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			firstItem.appendChild( button );

			const event = createKeyEvent( 'Enter' );
			Object.defineProperty( event, 'target', { value: button } );

			const selectSpy = jest.spyOn( layerPanel, 'selectLayer' );
			layerPanel.handleLayerListKeydown( event );

			expect( selectSpy ).not.toHaveBeenCalled();
		} );

		it( 'should not select when Enter pressed on editable element', () => {
			const editable = document.createElement( 'span' );
			editable.contentEditable = 'true';
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			firstItem.appendChild( editable );

			const event = createKeyEvent( 'Enter' );
			Object.defineProperty( event, 'target', { value: editable } );

			const selectSpy = jest.spyOn( layerPanel, 'selectLayer' );
			layerPanel.handleLayerListKeydown( event );

			expect( selectSpy ).not.toHaveBeenCalled();
		} );

		it( 'should delete layer with Delete key', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'Delete' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const deleteSpy = jest.spyOn( layerPanel, 'deleteLayer' );
			layerPanel.handleLayerListKeydown( event );

			expect( deleteSpy ).toHaveBeenCalledWith( 'layer1' );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should delete layer with Backspace key', () => {
			const secondItem = layerPanel.layerList.querySelectorAll( '.layer-item' )[ 1 ];
			const grabArea = secondItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'Backspace' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const deleteSpy = jest.spyOn( layerPanel, 'deleteLayer' );
			layerPanel.handleLayerListKeydown( event );

			expect( deleteSpy ).toHaveBeenCalledWith( 'layer2' );
		} );

		it( 'should not delete when on editable element', () => {
			const editable = document.createElement( 'span' );
			editable.contentEditable = 'true';
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			firstItem.appendChild( editable );

			const event = createKeyEvent( 'Delete' );
			Object.defineProperty( event, 'target', { value: editable } );

			const deleteSpy = jest.spyOn( layerPanel, 'deleteLayer' );
			layerPanel.handleLayerListKeydown( event );

			expect( deleteSpy ).not.toHaveBeenCalled();
		} );

		it( 'should toggle visibility with V key', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'v' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerVisibility' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).toHaveBeenCalledWith( 'layer1' );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should toggle visibility with uppercase V key', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'V' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerVisibility' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should not toggle visibility with Ctrl+V (paste shortcut)', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'v', { ctrlKey: true } );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerVisibility' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).not.toHaveBeenCalled();
		} );

		it( 'should not toggle visibility with Meta+V (Mac paste)', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'v', { metaKey: true } );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerVisibility' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).not.toHaveBeenCalled();
		} );

		it( 'should not toggle visibility on editable element', () => {
			const editable = document.createElement( 'span' );
			editable.contentEditable = 'true';
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			firstItem.appendChild( editable );

			const event = createKeyEvent( 'v' );
			Object.defineProperty( event, 'target', { value: editable } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerVisibility' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).not.toHaveBeenCalled();
		} );

		it( 'should toggle lock with L key', () => {
			const secondItem = layerPanel.layerList.querySelectorAll( '.layer-item' )[ 1 ];
			const grabArea = secondItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'l' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerLock' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).toHaveBeenCalledWith( 'layer2' );
			expect( event.defaultPrevented ).toBe( true );
		} );

		it( 'should toggle lock with uppercase L key', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'L' );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerLock' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should not toggle lock with Ctrl+L', () => {
			const firstItem = layerPanel.layerList.querySelector( '.layer-item' );
			const grabArea = firstItem.querySelector( '.layer-grab-area' );
			const event = createKeyEvent( 'l', { ctrlKey: true } );
			Object.defineProperty( event, 'target', { value: grabArea } );

			const toggleSpy = jest.spyOn( layerPanel, 'toggleLayerLock' );
			layerPanel.handleLayerListKeydown( event );

			expect( toggleSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'focusLayerAtIndex', () => {
		it( 'should focus the grab area of the layer at given index', () => {
			const grabArea = layerPanel.layerList.querySelector( '.layer-item .layer-grab-area' );
			const focusSpy = jest.spyOn( grabArea, 'focus' );

			layerPanel.focusLayerAtIndex( 0 );

			expect( focusSpy ).toHaveBeenCalled();
		} );

		it( 'should focus second layer when index is 1', () => {
			const grabAreas = layerPanel.layerList.querySelectorAll( '.layer-item .layer-grab-area' );
			const focusSpy = jest.spyOn( grabAreas[ 1 ], 'focus' );

			layerPanel.focusLayerAtIndex( 1 );

			expect( focusSpy ).toHaveBeenCalled();
		} );

		it( 'should do nothing for negative index', () => {
			layerPanel.focusLayerAtIndex( -1 );
			// Should not throw
		} );

		it( 'should do nothing for out-of-bounds index', () => {
			layerPanel.focusLayerAtIndex( 100 );
			// Should not throw
		} );

		it( 'should delegate to itemEventsController if available', () => {
			const mockController = {
				focusLayerAtIndex: jest.fn()
			};
			layerPanel.itemEventsController = mockController;

			layerPanel.focusLayerAtIndex( 1 );

			expect( mockController.focusLayerAtIndex ).toHaveBeenCalledWith( 1 );
		} );
	} );
} );
