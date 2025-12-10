/**
 * Tests for LayerItemEvents
 * Handles click, keyboard, and focus events for layer list items
 */

const LayerItemEvents = require( '../../resources/ext.layers.editor/panel/LayerItemEvents.js' );

describe( 'LayerItemEvents', () => {
	let layerList;
	let mockLayers;
	let callbacks;
	let instance;

	beforeEach( () => {
		// Create a mock layer list DOM structure
		layerList = document.createElement( 'div' );
		layerList.className = 'layers-list';

		mockLayers = [
			{ id: 'layer1', name: 'Layer 1', visible: true, locked: false },
			{ id: 'layer2', name: 'Layer 2', visible: true, locked: true },
			{ id: 'layer3', name: 'Layer 3', visible: false, locked: false }
		];

		// Create layer items in the DOM
		mockLayers.forEach( ( layer, index ) => {
			const item = document.createElement( 'div' );
			item.className = 'layer-item';
			item.dataset.layerId = layer.id;
			item.dataset.index = index;

			const grabArea = document.createElement( 'div' );
			grabArea.className = 'layer-grab-area';
			grabArea.tabIndex = 0;

			const visibility = document.createElement( 'button' );
			visibility.className = 'layer-visibility';

			const name = document.createElement( 'span' );
			name.className = 'layer-name';
			name.contentEditable = 'true';
			name.textContent = layer.name;

			const lock = document.createElement( 'button' );
			lock.className = 'layer-lock';

			const deleteBtn = document.createElement( 'button' );
			deleteBtn.className = 'layer-delete';

			item.appendChild( grabArea );
			item.appendChild( visibility );
			item.appendChild( name );
			item.appendChild( lock );
			item.appendChild( deleteBtn );
			layerList.appendChild( item );
		} );

		document.body.appendChild( layerList );

		callbacks = {
			onSelect: jest.fn(),
			onToggleVisibility: jest.fn(),
			onToggleLock: jest.fn(),
			onDelete: jest.fn(),
			onEditName: jest.fn()
		};
	} );

	afterEach( () => {
		if ( instance ) {
			instance.destroy();
			instance = null;
		}
		if ( layerList && layerList.parentNode ) {
			layerList.parentNode.removeChild( layerList );
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default config', () => {
			instance = new LayerItemEvents( {} );
			expect( instance ).toBeDefined();
			expect( instance.layerList ).toBeUndefined();
		} );

		it( 'should store config values', () => {
			const getLayers = jest.fn( () => mockLayers );
			const getSelectedLayerId = jest.fn( () => 'layer1' );

			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: getLayers,
				getSelectedLayerId: getSelectedLayerId,
				callbacks: callbacks
			} );

			expect( instance.layerList ).toBe( layerList );
			expect( instance.callbacks ).toBe( callbacks );
		} );

		it( 'should set up event listeners when layerList provided', () => {
			const addListenerSpy = jest.spyOn( layerList, 'addEventListener' );

			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );

			expect( addListenerSpy ).toHaveBeenCalledWith( 'click', expect.any( Function ) );
			expect( addListenerSpy ).toHaveBeenCalledWith( 'keydown', expect.any( Function ) );
		} );

		it( 'should use custom addTargetListener when provided', () => {
			const customListener = jest.fn();

			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks,
				addTargetListener: customListener
			} );

			expect( customListener ).toHaveBeenCalledWith( layerList, 'click', expect.any( Function ) );
			expect( customListener ).toHaveBeenCalledWith( layerList, 'keydown', expect.any( Function ) );
		} );
	} );

	describe( 'handleClick', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should call onSelect when clicking layer item', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			const event = new MouseEvent( 'click', { bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onSelect ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should call onToggleVisibility when clicking visibility button', () => {
			const visBtn = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-visibility' );
			const event = new MouseEvent( 'click', { bubbles: true } );
			visBtn.dispatchEvent( event );

			expect( callbacks.onToggleVisibility ).toHaveBeenCalledWith( 'layer2' );
			expect( callbacks.onSelect ).not.toHaveBeenCalled();
		} );

		it( 'should call onToggleLock when clicking lock button', () => {
			const lockBtn = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-lock' );
			const event = new MouseEvent( 'click', { bubbles: true } );
			lockBtn.dispatchEvent( event );

			expect( callbacks.onToggleLock ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should call onDelete when clicking delete button', () => {
			const deleteBtn = layerList.querySelector( '.layer-item[data-layer-id="layer3"] .layer-delete' );
			const event = new MouseEvent( 'click', { bubbles: true } );
			deleteBtn.dispatchEvent( event );

			expect( callbacks.onDelete ).toHaveBeenCalledWith( 'layer3' );
		} );

		it( 'should call onEditName when clicking name element', () => {
			const nameEl = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-name' );
			const event = new MouseEvent( 'click', { bubbles: true } );
			nameEl.dispatchEvent( event );

			expect( callbacks.onEditName ).toHaveBeenCalledWith( 'layer1', nameEl );
		} );

		it( 'should ignore clicks outside layer items', () => {
			const event = new MouseEvent( 'click', { bubbles: true } );
			layerList.dispatchEvent( event );

			expect( callbacks.onSelect ).not.toHaveBeenCalled();
			expect( callbacks.onToggleVisibility ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'handleKeydown - navigation', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should focus previous layer on ArrowUp', () => {
			const grabArea2 = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-grab-area' );
			grabArea2.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp', bubbles: true } );
			grabArea2.dispatchEvent( event );

			const grabArea1 = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			expect( document.activeElement ).toBe( grabArea1 );
		} );

		it( 'should focus next layer on ArrowDown', () => {
			const grabArea1 = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea1.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown', bubbles: true } );
			grabArea1.dispatchEvent( event );

			const grabArea2 = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-grab-area' );
			expect( document.activeElement ).toBe( grabArea2 );
		} );

		it( 'should not move past first layer on ArrowUp', () => {
			const grabArea1 = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea1.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp', bubbles: true } );
			grabArea1.dispatchEvent( event );

			// Should stay focused on first item
			expect( document.activeElement ).toBe( grabArea1 );
		} );

		it( 'should not move past last layer on ArrowDown', () => {
			const grabArea3 = layerList.querySelector( '.layer-item[data-layer-id="layer3"] .layer-grab-area' );
			grabArea3.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown', bubbles: true } );
			grabArea3.dispatchEvent( event );

			// Should stay focused on last item
			expect( document.activeElement ).toBe( grabArea3 );
		} );

		it( 'should focus first layer on Home', () => {
			const grabArea3 = layerList.querySelector( '.layer-item[data-layer-id="layer3"] .layer-grab-area' );
			grabArea3.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Home', bubbles: true } );
			grabArea3.dispatchEvent( event );

			const grabArea1 = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			expect( document.activeElement ).toBe( grabArea1 );
		} );

		it( 'should focus last layer on End', () => {
			const grabArea1 = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea1.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'End', bubbles: true } );
			grabArea1.dispatchEvent( event );

			const grabArea3 = layerList.querySelector( '.layer-item[data-layer-id="layer3"] .layer-grab-area' );
			expect( document.activeElement ).toBe( grabArea3 );
		} );
	} );

	describe( 'handleKeydown - actions', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should call onSelect on Enter', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Enter', bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onSelect ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should call onSelect on Space', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: ' ', bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onSelect ).toHaveBeenCalledWith( 'layer2' );
		} );

		it( 'should call onDelete on Delete key', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Delete', bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onDelete ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should call onDelete on Backspace key', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Backspace', bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onDelete ).toHaveBeenCalledWith( 'layer2' );
		} );

		it( 'should call onToggleVisibility on V key', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'v', bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onToggleVisibility ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should call onToggleLock on L key', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'l', bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onToggleLock ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should not trigger shortcut with Ctrl key', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'v', ctrlKey: true, bubbles: true } );
			grabArea.dispatchEvent( event );

			expect( callbacks.onToggleVisibility ).not.toHaveBeenCalled();
		} );

		it( 'should not delete when focused on editable element', () => {
			const nameEl = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-name' );
			nameEl.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'Delete', bubbles: true } );
			nameEl.dispatchEvent( event );

			expect( callbacks.onDelete ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'findLayerIndex', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should find layer by ID', () => {
			expect( instance.findLayerIndex( 'layer1' ) ).toBe( 0 );
			expect( instance.findLayerIndex( 'layer2' ) ).toBe( 1 );
			expect( instance.findLayerIndex( 'layer3' ) ).toBe( 2 );
		} );

		it( 'should return -1 for non-existent layer', () => {
			expect( instance.findLayerIndex( 'nonexistent' ) ).toBe( -1 );
		} );

		it( 'should handle string/number ID comparison', () => {
			const layersWithNumericIds = [
				{ id: 1, name: 'Layer 1' },
				{ id: '2', name: 'Layer 2' }
			];
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => layersWithNumericIds,
				callbacks: callbacks
			} );

			expect( instance.findLayerIndex( '1' ) ).toBe( 0 );
			expect( instance.findLayerIndex( 1 ) ).toBe( 0 );
		} );
	} );

	describe( 'focusLayerAtIndex', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should focus layer at valid index', () => {
			instance.focusLayerAtIndex( 1 );
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-grab-area' );
			expect( document.activeElement ).toBe( grabArea );
		} );

		it( 'should not focus at negative index', () => {
			const initialFocus = document.activeElement;
			instance.focusLayerAtIndex( -1 );
			expect( document.activeElement ).toBe( initialFocus );
		} );

		it( 'should not focus at index beyond layers', () => {
			const initialFocus = document.activeElement;
			instance.focusLayerAtIndex( 100 );
			expect( document.activeElement ).toBe( initialFocus );
		} );
	} );

	describe( 'focusLayerById', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should focus layer by ID', () => {
			instance.focusLayerById( 'layer3' );
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer3"] .layer-grab-area' );
			expect( document.activeElement ).toBe( grabArea );
		} );

		it( 'should handle missing layer gracefully', () => {
			const initialFocus = document.activeElement;
			instance.focusLayerById( 'nonexistent' );
			// Should not throw, focus unchanged
			expect( document.activeElement ).toBe( initialFocus );
		} );
	} );

	describe( 'getFocusedLayerId', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should return focused layer ID', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-grab-area' );
			grabArea.focus();
			expect( instance.getFocusedLayerId() ).toBe( 'layer2' );
		} );

		it( 'should return null when nothing focused in list', () => {
			document.body.focus();
			expect( instance.getFocusedLayerId() ).toBeNull();
		} );
	} );

	describe( 'isLayerFocused', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should return true when layer is focused', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer1"] .layer-grab-area' );
			grabArea.focus();
			expect( instance.isLayerFocused( 'layer1' ) ).toBe( true );
		} );

		it( 'should return false when different layer is focused', () => {
			const grabArea = layerList.querySelector( '.layer-item[data-layer-id="layer2"] .layer-grab-area' );
			grabArea.focus();
			expect( instance.isLayerFocused( 'layer1' ) ).toBe( false );
		} );
	} );

	describe( 'helper methods', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		describe( 'isSelectionKey', () => {
			it( 'should return true for Enter', () => {
				const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
				expect( instance.isSelectionKey( event ) ).toBe( true );
			} );

			it( 'should return true for Space', () => {
				const event = new KeyboardEvent( 'keydown', { key: ' ' } );
				expect( instance.isSelectionKey( event ) ).toBe( true );
			} );

			it( 'should return false for other keys', () => {
				const event = new KeyboardEvent( 'keydown', { key: 'a' } );
				expect( instance.isSelectionKey( event ) ).toBe( false );
			} );
		} );

		describe( 'isNavigationKey', () => {
			it( 'should return true for arrow keys', () => {
				expect( instance.isNavigationKey( new KeyboardEvent( 'keydown', { key: 'ArrowUp' } ) ) ).toBe( true );
				expect( instance.isNavigationKey( new KeyboardEvent( 'keydown', { key: 'ArrowDown' } ) ) ).toBe( true );
			} );

			it( 'should return true for Home/End', () => {
				expect( instance.isNavigationKey( new KeyboardEvent( 'keydown', { key: 'Home' } ) ) ).toBe( true );
				expect( instance.isNavigationKey( new KeyboardEvent( 'keydown', { key: 'End' } ) ) ).toBe( true );
			} );

			it( 'should return false for other keys', () => {
				expect( instance.isNavigationKey( new KeyboardEvent( 'keydown', { key: 'Enter' } ) ) ).toBe( false );
			} );
		} );

		describe( 'isDeleteKey', () => {
			it( 'should return true for Delete and Backspace', () => {
				expect( instance.isDeleteKey( new KeyboardEvent( 'keydown', { key: 'Delete' } ) ) ).toBe( true );
				expect( instance.isDeleteKey( new KeyboardEvent( 'keydown', { key: 'Backspace' } ) ) ).toBe( true );
			} );

			it( 'should return false for other keys', () => {
				expect( instance.isDeleteKey( new KeyboardEvent( 'keydown', { key: 'd' } ) ) ).toBe( false );
			} );
		} );

		describe( 'getShortcutType', () => {
			it( 'should return visibility for V key', () => {
				expect( instance.getShortcutType( new KeyboardEvent( 'keydown', { key: 'v' } ) ) ).toBe( 'visibility' );
				expect( instance.getShortcutType( new KeyboardEvent( 'keydown', { key: 'V' } ) ) ).toBe( 'visibility' );
			} );

			it( 'should return lock for L key', () => {
				expect( instance.getShortcutType( new KeyboardEvent( 'keydown', { key: 'l' } ) ) ).toBe( 'lock' );
				expect( instance.getShortcutType( new KeyboardEvent( 'keydown', { key: 'L' } ) ) ).toBe( 'lock' );
			} );

			it( 'should return null with modifier keys', () => {
				expect( instance.getShortcutType( new KeyboardEvent( 'keydown', { key: 'v', ctrlKey: true } ) ) ).toBeNull();
				expect( instance.getShortcutType( new KeyboardEvent( 'keydown', { key: 'l', metaKey: true } ) ) ).toBeNull();
			} );

			it( 'should return null for other keys', () => {
				expect( instance.getShortcutType( new KeyboardEvent( 'keydown', { key: 'a' } ) ) ).toBeNull();
			} );
		} );

		describe( 'getNavigationDirection', () => {
			it( 'should return -1 for ArrowUp', () => {
				expect( instance.getNavigationDirection( new KeyboardEvent( 'keydown', { key: 'ArrowUp' } ) ) ).toBe( -1 );
			} );

			it( 'should return 1 for ArrowDown', () => {
				expect( instance.getNavigationDirection( new KeyboardEvent( 'keydown', { key: 'ArrowDown' } ) ) ).toBe( 1 );
			} );

			it( 'should return first for Home', () => {
				expect( instance.getNavigationDirection( new KeyboardEvent( 'keydown', { key: 'Home' } ) ) ).toBe( 'first' );
			} );

			it( 'should return last for End', () => {
				expect( instance.getNavigationDirection( new KeyboardEvent( 'keydown', { key: 'End' } ) ) ).toBe( 'last' );
			} );

			it( 'should return null for other keys', () => {
				expect( instance.getNavigationDirection( new KeyboardEvent( 'keydown', { key: 'Enter' } ) ) ).toBeNull();
			} );
		} );
	} );

	describe( 'setLayerList', () => {
		it( 'should update layer list reference', () => {
			instance = new LayerItemEvents( {} );
			expect( instance.layerList ).toBeUndefined();

			instance.setLayerList( layerList );
			expect( instance.layerList ).toBe( layerList );
		} );
	} );

	describe( 'setCallbacks', () => {
		it( 'should update callbacks', () => {
			instance = new LayerItemEvents( { layerList: layerList } );
			const newCallbacks = { onSelect: jest.fn() };

			instance.setCallbacks( newCallbacks );
			expect( instance.callbacks ).toBe( newCallbacks );
		} );

		it( 'should handle null callbacks', () => {
			instance = new LayerItemEvents( { layerList: layerList, callbacks: callbacks } );
			instance.setCallbacks( null );
			expect( instance.callbacks ).toEqual( {} );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );

			instance.destroy();

			expect( instance.layerList ).toBeNull();
			expect( instance.callbacks ).toEqual( {} );
		} );
	} );

	describe( 'triggerCallback', () => {
		beforeEach( () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => mockLayers,
				callbacks: callbacks
			} );
		} );

		it( 'should call callback with arguments', () => {
			instance.triggerCallback( 'onSelect', 'layer1' );
			expect( callbacks.onSelect ).toHaveBeenCalledWith( 'layer1' );
		} );

		it( 'should handle missing callback gracefully', () => {
			expect( () => {
				instance.triggerCallback( 'nonexistent', 'arg1' );
			} ).not.toThrow();
		} );

		it( 'should pass multiple arguments', () => {
			instance.triggerCallback( 'onEditName', 'layer1', document.createElement( 'span' ) );
			expect( callbacks.onEditName ).toHaveBeenCalledWith( 'layer1', expect.any( HTMLSpanElement ) );
		} );
	} );

	describe( 'empty layer list handling', () => {
		it( 'should handle empty layers array gracefully', () => {
			instance = new LayerItemEvents( {
				layerList: layerList,
				getLayers: () => [],
				callbacks: callbacks
			} );

			// Should not throw
			const grabArea = layerList.querySelector( '.layer-grab-area' );
			grabArea.focus();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown', bubbles: true } );
			expect( () => grabArea.dispatchEvent( event ) ).not.toThrow();
		} );
	} );
} );
