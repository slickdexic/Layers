/**
 * LayerListRenderer unit tests
 *
 * Tests for the layer list DOM rendering component.
 */
'use strict';

const { LayerListRenderer } = require( '../../../resources/ext.layers.editor/ui/LayerListRenderer.js' );

describe( 'LayerListRenderer', () => {
	let renderer;
	let mockLayerList;
	let mockMsg;
	let mockGetSelectedLayerId;
	let mockGetSelectedLayerIds;
	let mockGetLayers;
	let mockOnMoveLayer;

	// Mock IconFactory
	beforeAll( () => {
		global.window = global.window || {};
		global.window.Layers = {
			UI: {
				IconFactory: {
					createEyeIcon: jest.fn( () => {
						const span = document.createElement( 'span' );
						span.className = 'eye-icon';
						return span;
					} ),
					createLockIcon: jest.fn( () => {
						const span = document.createElement( 'span' );
						span.className = 'lock-icon';
						return span;
					} ),
					createDeleteIcon: jest.fn( () => {
						const span = document.createElement( 'span' );
						span.className = 'delete-icon';
						return span;
					} )
				}
			},
			Constants: {
				LAYER_TYPES: {
					TEXT: 'text',
					RECTANGLE: 'rectangle',
					CIRCLE: 'circle',
					ELLIPSE: 'ellipse',
					POLYGON: 'polygon',
					STAR: 'star',
					ARROW: 'arrow',
					LINE: 'line',
					PATH: 'path',
					BLUR: 'blur'
				}
			}
		};
	} );

	beforeEach( () => {
		mockLayerList = document.createElement( 'div' );
		mockMsg = jest.fn( ( key, fallback ) => fallback || key );
		mockGetSelectedLayerId = jest.fn( () => null );
		mockGetSelectedLayerIds = jest.fn( () => [] );
		mockGetLayers = jest.fn( () => [] );
		mockOnMoveLayer = jest.fn();

		renderer = new LayerListRenderer( {
			layerList: mockLayerList,
			msg: mockMsg,
			getSelectedLayerId: mockGetSelectedLayerId,
			getSelectedLayerIds: mockGetSelectedLayerIds,
			getLayers: mockGetLayers,
			onMoveLayer: mockOnMoveLayer
		} );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with config', () => {
			expect( renderer ).toBeInstanceOf( LayerListRenderer );
			expect( renderer.layerList ).toBe( mockLayerList );
		} );

		it( 'should use provided msg function', () => {
			expect( renderer.msg ).toBe( mockMsg );
		} );

		it( 'should use default msg function when not provided', () => {
			const defaultRenderer = new LayerListRenderer( {
				layerList: mockLayerList
			} );
			expect( defaultRenderer.msg( 'test-key', 'fallback' ) ).toBe( 'fallback' );
			expect( defaultRenderer.msg( 'test-key' ) ).toBe( 'test-key' );
		} );

		it( 'should use default getSelectedLayerId when not provided', () => {
			const defaultRenderer = new LayerListRenderer( {
				layerList: mockLayerList
			} );
			expect( defaultRenderer.getSelectedLayerId() ).toBeNull();
		} );

		it( 'should use default getSelectedLayerIds when not provided', () => {
			const defaultRenderer = new LayerListRenderer( {
				layerList: mockLayerList
			} );
			expect( defaultRenderer.getSelectedLayerIds() ).toEqual( [] );
		} );

		it( 'should use default getLayers when not provided', () => {
			const defaultRenderer = new LayerListRenderer( {
				layerList: mockLayerList
			} );
			expect( defaultRenderer.getLayers() ).toEqual( [] );
		} );

		it( 'should store onMoveLayer callback', () => {
			expect( renderer.onMoveLayer ).toBe( mockOnMoveLayer );
		} );

		it( 'should default onMoveLayer to null when not provided', () => {
			const defaultRenderer = new LayerListRenderer( {
				layerList: mockLayerList
			} );
			expect( defaultRenderer.onMoveLayer ).toBeNull();
		} );
	} );

	describe( 'render', () => {
		it( 'should do nothing when layerList is null', () => {
			renderer.layerList = null;
			expect( () => renderer.render() ).not.toThrow();
		} );

		it( 'should show empty state when no layers', () => {
			mockGetLayers.mockReturnValue( [] );
			renderer.render();
			const emptyMsg = mockLayerList.querySelector( '.layers-empty' );
			expect( emptyMsg ).not.toBeNull();
			expect( emptyMsg.textContent ).toBe( 'No layers yet. Choose a tool to begin.' );
		} );

		it( 'should create layer items for each layer', () => {
			mockGetLayers.mockReturnValue( [
				{ id: '1', type: 'rectangle' },
				{ id: '2', type: 'circle' }
			] );
			renderer.render();
			const items = mockLayerList.querySelectorAll( '.layer-item' );
			expect( items.length ).toBe( 2 );
		} );

		it( 'should remove empty message when layers exist', () => {
			// First render with no layers
			mockGetLayers.mockReturnValue( [] );
			renderer.render();
			expect( mockLayerList.querySelector( '.layers-empty' ) ).not.toBeNull();

			// Then render with layers
			mockGetLayers.mockReturnValue( [ { id: '1', type: 'rectangle' } ] );
			renderer.render();
			expect( mockLayerList.querySelector( '.layers-empty' ) ).toBeNull();
		} );

		it( 'should remove items that are no longer in layers', () => {
			mockGetLayers.mockReturnValue( [
				{ id: '1', type: 'rectangle' },
				{ id: '2', type: 'circle' }
			] );
			renderer.render();
			expect( mockLayerList.querySelectorAll( '.layer-item' ).length ).toBe( 2 );

			// Remove one layer
			mockGetLayers.mockReturnValue( [ { id: '1', type: 'rectangle' } ] );
			renderer.render();
			expect( mockLayerList.querySelectorAll( '.layer-item' ).length ).toBe( 1 );
		} );

		it( 'should update existing items instead of recreating', () => {
			mockGetLayers.mockReturnValue( [ { id: '1', type: 'rectangle', visible: true } ] );
			renderer.render();
			const firstItem = mockLayerList.querySelector( '.layer-item' );

			// Render again with same layer
			mockGetLayers.mockReturnValue( [ { id: '1', type: 'rectangle', visible: false } ] );
			renderer.render();
			const secondItem = mockLayerList.querySelector( '.layer-item' );

			expect( firstItem ).toBe( secondItem );
		} );

		it( 'should maintain correct order', () => {
			mockGetLayers.mockReturnValue( [
				{ id: '1', type: 'rectangle' },
				{ id: '2', type: 'circle' },
				{ id: '3', type: 'ellipse' }
			] );
			renderer.render();

			const items = mockLayerList.querySelectorAll( '.layer-item' );
			expect( items[ 0 ].dataset.layerId ).toBe( '1' );
			expect( items[ 1 ].dataset.layerId ).toBe( '2' );
			expect( items[ 2 ].dataset.layerId ).toBe( '3' );
		} );

		it( 'should reorder items when layer order changes', () => {
			mockGetLayers.mockReturnValue( [
				{ id: '1', type: 'rectangle' },
				{ id: '2', type: 'circle' }
			] );
			renderer.render();

			// Swap order
			mockGetLayers.mockReturnValue( [
				{ id: '2', type: 'circle' },
				{ id: '1', type: 'rectangle' }
			] );
			renderer.render();

			const items = mockLayerList.querySelectorAll( '.layer-item' );
			expect( items[ 0 ].dataset.layerId ).toBe( '2' );
			expect( items[ 1 ].dataset.layerId ).toBe( '1' );
		} );
	} );

	describe( 'createLayerItem', () => {
		it( 'should create layer item with correct class', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.className ).toContain( 'layer-item' );
		} );

		it( 'should set data-layer-id attribute', () => {
			const layer = { id: 'layer-123', type: 'circle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.dataset.layerId ).toBe( 'layer-123' );
		} );

		it( 'should set data-index attribute', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 5 );
			expect( item.dataset.index ).toBe( '5' );
		} );

		it( 'should set draggable attribute', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.draggable ).toBe( true );
		} );

		it( 'should set ARIA role to option', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.getAttribute( 'role' ) ).toBe( 'option' );
		} );

		it( 'should set aria-selected to false when not selected', () => {
			mockGetSelectedLayerIds.mockReturnValue( [] );
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.getAttribute( 'aria-selected' ) ).toBe( 'false' );
		} );

		it( 'should set aria-selected to true when selected', () => {
			mockGetSelectedLayerIds.mockReturnValue( [ '1' ] );
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.getAttribute( 'aria-selected' ) ).toBe( 'true' );
		} );

		it( 'should add selected class when selected', () => {
			mockGetSelectedLayerIds.mockReturnValue( [ '1' ] );
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.classList.contains( 'selected' ) ).toBe( true );
		} );

		it( 'should use layer name when provided', () => {
			const layer = { id: '1', type: 'rectangle', name: 'My Rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.getAttribute( 'aria-label' ) ).toBe( 'My Rectangle' );
		} );

		it( 'should create grab area', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.querySelector( '.layer-grab-area' ) ).not.toBeNull();
		} );

		it( 'should create visibility button', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.querySelector( '.layer-visibility' ) ).not.toBeNull();
		} );

		it( 'should create editable name element', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			const nameEl = item.querySelector( '.layer-name' );
			expect( nameEl ).not.toBeNull();
			expect( nameEl.contentEditable ).toBeTruthy();
		} );

		it( 'should create lock button', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.querySelector( '.layer-lock' ) ).not.toBeNull();
		} );

		it( 'should create delete button', () => {
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.querySelector( '.layer-delete' ) ).not.toBeNull();
		} );
	} );

	describe( '_createGrabArea', () => {
		it( 'should create grab area element', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			expect( grabArea.className ).toBe( 'layer-grab-area' );
		} );

		it( 'should set tabindex for keyboard focus', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			expect( grabArea.getAttribute( 'tabindex' ) ).toBe( '0' );
		} );

		it( 'should set role to button', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			expect( grabArea.getAttribute( 'role' ) ).toBe( 'button' );
		} );

		it( 'should set cursor to grab', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			expect( grabArea.style.cursor ).toBe( 'grab' );
		} );

		it( 'should contain SVG icon', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			expect( grabArea.querySelector( 'svg' ) ).not.toBeNull();
		} );

		it( 'should handle ArrowUp keydown', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp' } );
			Object.defineProperty( event, 'preventDefault', { value: jest.fn() } );
			grabArea.dispatchEvent( event );
			expect( mockOnMoveLayer ).toHaveBeenCalledWith( '1', -1 );
		} );

		it( 'should handle ArrowDown keydown', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown' } );
			Object.defineProperty( event, 'preventDefault', { value: jest.fn() } );
			grabArea.dispatchEvent( event );
			expect( mockOnMoveLayer ).toHaveBeenCalledWith( '1', 1 );
		} );

		it( 'should not call onMoveLayer for other keys', () => {
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			grabArea.dispatchEvent( event );
			expect( mockOnMoveLayer ).not.toHaveBeenCalled();
		} );

		it( 'should not add keydown listener when onMoveLayer is null', () => {
			renderer.onMoveLayer = null;
			const layer = { id: '1', type: 'rectangle' };
			const grabArea = renderer._createGrabArea( layer, 'Test Layer', mockMsg );
			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp' } );
			// Should not throw
			expect( () => grabArea.dispatchEvent( event ) ).not.toThrow();
		} );
	} );

	describe( '_createVisibilityButton', () => {
		it( 'should create button element', () => {
			const layer = { id: '1', visible: true };
			const btn = renderer._createVisibilityButton( layer, mockMsg );
			expect( btn.tagName ).toBe( 'BUTTON' );
			expect( btn.className ).toBe( 'layer-visibility' );
		} );

		it( 'should set button type', () => {
			const layer = { id: '1', visible: true };
			const btn = renderer._createVisibilityButton( layer, mockMsg );
			expect( btn.type ).toBe( 'button' );
		} );

		it( 'should set aria-label', () => {
			const layer = { id: '1', visible: true };
			const btn = renderer._createVisibilityButton( layer, mockMsg );
			expect( btn.getAttribute( 'aria-label' ) ).toBe( 'Toggle visibility' );
		} );

		it( 'should contain an icon element', () => {
			const layer = { id: '1', visible: true };
			const btn = renderer._createVisibilityButton( layer, mockMsg );
			expect( btn.firstChild ).not.toBeNull();
		} );
	} );

	describe( '_createLockButton', () => {
		it( 'should create button element', () => {
			const layer = { id: '1', locked: false };
			const btn = renderer._createLockButton( layer, mockMsg );
			expect( btn.tagName ).toBe( 'BUTTON' );
			expect( btn.className ).toBe( 'layer-lock' );
		} );

		it( 'should contain an icon element', () => {
			const layer = { id: '1', locked: false };
			const btn = renderer._createLockButton( layer, mockMsg );
			expect( btn.firstChild ).not.toBeNull();
		} );
	} );

	describe( '_createDeleteButton', () => {
		it( 'should create button element', () => {
			const btn = renderer._createDeleteButton( mockMsg );
			expect( btn.tagName ).toBe( 'BUTTON' );
			expect( btn.className ).toBe( 'layer-delete' );
		} );

		it( 'should set aria-label', () => {
			const btn = renderer._createDeleteButton( mockMsg );
			expect( btn.getAttribute( 'aria-label' ) ).toBe( 'Delete layer' );
		} );

		it( 'should contain an icon element', () => {
			const btn = renderer._createDeleteButton( mockMsg );
			expect( btn.firstChild ).not.toBeNull();
		} );
	} );

	describe( 'updateLayerItem', () => {
		let item;
		let layer;

		beforeEach( () => {
			layer = { id: '1', type: 'rectangle', visible: true, locked: false };
			item = renderer.createLayerItem( layer, 0 );
		} );

		it( 'should update data-layer-id', () => {
			renderer.updateLayerItem( item, { id: '2', type: 'circle' }, 0 );
			expect( item.dataset.layerId ).toBe( '2' );
		} );

		it( 'should update data-index', () => {
			renderer.updateLayerItem( item, layer, 3 );
			expect( item.dataset.index ).toBe( '3' );
		} );

		it( 'should update aria-selected when selected', () => {
			mockGetSelectedLayerIds.mockReturnValue( [ '1' ] );
			renderer.updateLayerItem( item, layer, 0 );
			expect( item.getAttribute( 'aria-selected' ) ).toBe( 'true' );
		} );

		it( 'should update aria-selected when deselected', () => {
			item.setAttribute( 'aria-selected', 'true' );
			mockGetSelectedLayerIds.mockReturnValue( [] );
			renderer.updateLayerItem( item, layer, 0 );
			expect( item.getAttribute( 'aria-selected' ) ).toBe( 'false' );
		} );

		it( 'should add selected class when selected', () => {
			mockGetSelectedLayerIds.mockReturnValue( [ '1' ] );
			renderer.updateLayerItem( item, layer, 0 );
			expect( item.classList.contains( 'selected' ) ).toBe( true );
		} );

		it( 'should remove selected class when deselected', () => {
			item.classList.add( 'selected' );
			mockGetSelectedLayerIds.mockReturnValue( [] );
			renderer.updateLayerItem( item, layer, 0 );
			expect( item.classList.contains( 'selected' ) ).toBe( false );
		} );

		it( 'should update visibility button', () => {
			renderer.updateLayerItem( item, { ...layer, visible: false }, 0 );
			expect( item.querySelector( '.layer-visibility' ).firstChild ).not.toBeNull();
		} );

		it( 'should update lock button', () => {
			renderer.updateLayerItem( item, { ...layer, locked: true }, 0 );
			expect( item.querySelector( '.layer-lock' ).firstChild ).not.toBeNull();
		} );

		it( 'should update layer name', () => {
			const nameEl = item.querySelector( '.layer-name' );
			renderer.updateLayerItem( item, { ...layer, name: 'New Name' }, 0 );
			expect( nameEl.textContent ).toBe( 'New Name' );
		} );

		it( 'should not update name when element is focused', () => {
			const nameEl = item.querySelector( '.layer-name' );
			nameEl.textContent = 'Editing...';
			Object.defineProperty( document, 'activeElement', {
				value: nameEl,
				writable: true,
				configurable: true
			} );
			renderer.updateLayerItem( item, { ...layer, name: 'New Name' }, 0 );
			expect( nameEl.textContent ).toBe( 'Editing...' );
		} );

		it( 'should update grab area aria-label', () => {
			renderer.updateLayerItem( item, { ...layer, name: 'Updated Layer' }, 0 );
			const grabArea = item.querySelector( '.layer-grab-area' );
			expect( grabArea.getAttribute( 'aria-label' ) ).toContain( 'Updated Layer' );
		} );
	} );

	describe( 'getDefaultLayerName', () => {
		it( 'should return Rectangle for rectangle type', () => {
			expect( renderer.getDefaultLayerName( { type: 'rectangle' } ) ).toBe( 'Rectangle' );
		} );

		it( 'should return Circle for circle type', () => {
			expect( renderer.getDefaultLayerName( { type: 'circle' } ) ).toBe( 'Circle' );
		} );

		it( 'should return Ellipse for ellipse type', () => {
			expect( renderer.getDefaultLayerName( { type: 'ellipse' } ) ).toBe( 'Ellipse' );
		} );

		it( 'should return Polygon for polygon type', () => {
			expect( renderer.getDefaultLayerName( { type: 'polygon' } ) ).toBe( 'Polygon' );
		} );

		it( 'should return Star for star type', () => {
			expect( renderer.getDefaultLayerName( { type: 'star' } ) ).toBe( 'Star' );
		} );

		it( 'should return Arrow for arrow type', () => {
			expect( renderer.getDefaultLayerName( { type: 'arrow' } ) ).toBe( 'Arrow' );
		} );

		it( 'should return Line for line type', () => {
			expect( renderer.getDefaultLayerName( { type: 'line' } ) ).toBe( 'Line' );
		} );

		it( 'should return Drawing for path type', () => {
			expect( renderer.getDefaultLayerName( { type: 'path' } ) ).toBe( 'Drawing' );
		} );

		it( 'should return Blur Effect for blur type', () => {
			expect( renderer.getDefaultLayerName( { type: 'blur' } ) ).toBe( 'Blur Effect' );
		} );

		it( 'should return text prefix with content for text type', () => {
			const result = renderer.getDefaultLayerName( { type: 'text', text: 'Hello World' } );
			expect( result ).toBe( 'Text: Hello World' );
		} );

		it( 'should truncate long text to 20 characters', () => {
			const longText = 'This is a very long text that should be truncated';
			const result = renderer.getDefaultLayerName( { type: 'text', text: longText } );
			expect( result.length ).toBeLessThanOrEqual( 6 + 20 ); // "Text: " + 20 chars
		} );

		it( 'should show Empty for text with no content', () => {
			const result = renderer.getDefaultLayerName( { type: 'text', text: '' } );
			expect( result ).toBe( 'Text: Empty' );
		} );

		it( 'should return Layer for unknown type', () => {
			expect( renderer.getDefaultLayerName( { type: 'unknown' } ) ).toBe( 'Layer' );
		} );
	} );

	describe( '_createEyeIcon', () => {
		it( 'should create an element', () => {
			const icon = renderer._createEyeIcon( true );
			expect( icon ).toBeDefined();
			expect( icon.tagName ).toBeDefined();
		} );

		it( 'should return span when IconFactory not available', () => {
			const originalIconFactory = window.Layers.UI.IconFactory;
			window.Layers.UI.IconFactory = null;

			const testRenderer = new LayerListRenderer( {
				layerList: mockLayerList
			} );
			const icon = testRenderer._createEyeIcon( true );
			expect( icon.tagName ).toBe( 'SPAN' );

			window.Layers.UI.IconFactory = originalIconFactory;
		} );
	} );

	describe( '_createLockIcon', () => {
		it( 'should create an element', () => {
			const icon = renderer._createLockIcon( true );
			expect( icon ).toBeDefined();
			expect( icon.tagName ).toBeDefined();
		} );
	} );

	describe( '_createDeleteIcon', () => {
		it( 'should create an element', () => {
			const icon = renderer._createDeleteIcon();
			expect( icon ).toBeDefined();
			expect( icon.tagName ).toBeDefined();
		} );
	} );

	describe( 'selection with numeric IDs', () => {
		it( 'should match selection when layer ID is string', () => {
			mockGetSelectedLayerIds.mockReturnValue( [ '1' ] );
			const layer = { id: '1', type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.classList.contains( 'selected' ) ).toBe( true );
		} );

		it( 'should match selection when layer ID is number', () => {
			mockGetSelectedLayerIds.mockReturnValue( [ 1 ] );
			const layer = { id: 1, type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.classList.contains( 'selected' ) ).toBe( true );
		} );

		it( 'should match string selection with numeric layer ID', () => {
			mockGetSelectedLayerIds.mockReturnValue( [ '1' ] );
			const layer = { id: 1, type: 'rectangle' };
			const item = renderer.createLayerItem( layer, 0 );
			expect( item.classList.contains( 'selected' ) ).toBe( true );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export LayerListRenderer class', () => {
			expect( LayerListRenderer ).toBeDefined();
			expect( typeof LayerListRenderer ).toBe( 'function' );
		} );

		it( 'should allow creating new instances', () => {
			const instance = new LayerListRenderer( { layerList: document.createElement( 'div' ) } );
			expect( instance ).toBeInstanceOf( LayerListRenderer );
		} );
	} );
} );
