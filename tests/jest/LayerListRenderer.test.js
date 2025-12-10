/**
 * Tests for LayerListRenderer
 */

const fs = require( 'fs' );
const path = require( 'path' );

// Load the source file
const sourceFile = path.join( __dirname, '../../resources/ext.layers.editor/ui/LayerListRenderer.js' );
const sourceCode = fs.readFileSync( sourceFile, 'utf8' );

// Execute in a controlled environment
const mockWindow = {
	Layers: { UI: {} },
	LayerListRenderer: null,
	IconFactory: {
		createEyeIcon: jest.fn( ( visible ) => {
			const span = document.createElement( 'span' );
			span.className = visible ? 'eye-open' : 'eye-closed';
			return span;
		} ),
		createLockIcon: jest.fn( ( locked ) => {
			const span = document.createElement( 'span' );
			span.className = locked ? 'locked' : 'unlocked';
			return span;
		} ),
		createDeleteIcon: jest.fn( () => {
			const span = document.createElement( 'span' );
			span.className = 'delete-icon';
			return span;
		} )
	},
	LayersConstants: {
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
			HIGHLIGHT: 'highlight',
			BLUR: 'blur'
		}
	}
};

// eslint-disable-next-line no-new-func
const initModule = new Function( 'window', 'document', 'module', sourceCode + '\nreturn window.LayerListRenderer;' );
const LayerListRenderer = initModule( mockWindow, document, { exports: {} } );

describe( 'LayerListRenderer', () => {
	let renderer;
	let mockLayerList;
	let mockMsg;
	let mockGetSelectedLayerId;
	let mockGetLayers;
	let mockOnMoveLayer;

	beforeEach( () => {
		// Create a real DOM element for the layer list
		mockLayerList = document.createElement( 'div' );
		mockLayerList.className = 'layers-list';

		mockMsg = jest.fn( ( key, fallback ) => fallback || key );
		mockGetSelectedLayerId = jest.fn( () => null );
		mockGetLayers = jest.fn( () => [] );
		mockOnMoveLayer = jest.fn();

		// Reset IconFactory mocks
		mockWindow.IconFactory.createEyeIcon.mockClear();
		mockWindow.IconFactory.createLockIcon.mockClear();
		mockWindow.IconFactory.createDeleteIcon.mockClear();
	} );

	describe( 'constructor', () => {
		test( 'should initialize with config', () => {
			renderer = new LayerListRenderer( {
				layerList: mockLayerList,
				msg: mockMsg,
				getSelectedLayerId: mockGetSelectedLayerId,
				getLayers: mockGetLayers,
				onMoveLayer: mockOnMoveLayer
			} );

			expect( renderer.layerList ).toBe( mockLayerList );
			expect( renderer.msg ).toBe( mockMsg );
		} );

		test( 'should use default functions when not provided', () => {
			renderer = new LayerListRenderer( {
				layerList: mockLayerList
			} );

			expect( typeof renderer.msg ).toBe( 'function' );
			expect( typeof renderer.getSelectedLayerId ).toBe( 'function' );
			expect( typeof renderer.getLayers ).toBe( 'function' );
			expect( renderer.getSelectedLayerId() ).toBeNull();
			expect( renderer.getLayers() ).toEqual( [] );
		} );
	} );

	describe( 'render', () => {
		beforeEach( () => {
			renderer = new LayerListRenderer( {
				layerList: mockLayerList,
				msg: mockMsg,
				getSelectedLayerId: mockGetSelectedLayerId,
				getLayers: mockGetLayers,
				onMoveLayer: mockOnMoveLayer
			} );
		} );

		test( 'should render empty message when no layers', () => {
			mockGetLayers.mockReturnValue( [] );
			renderer.render();

			const emptyMsg = mockLayerList.querySelector( '.layers-empty' );
			expect( emptyMsg ).not.toBeNull();
			expect( emptyMsg.textContent ).toBe( 'No layers yet. Choose a tool to begin.' );
		} );

		test( 'should render layer items for each layer', () => {
			mockGetLayers.mockReturnValue( [
				{ id: 'layer_1', type: 'text', text: 'Hello' },
				{ id: 'layer_2', type: 'rectangle' }
			] );
			renderer.render();

			const items = mockLayerList.querySelectorAll( '.layer-item' );
			expect( items.length ).toBe( 2 );
			expect( items[ 0 ].dataset.layerId ).toBe( 'layer_1' );
			expect( items[ 1 ].dataset.layerId ).toBe( 'layer_2' );
		} );

		test( 'should remove empty message when layers are added', () => {
			// First render with no layers
			mockGetLayers.mockReturnValue( [] );
			renderer.render();

			// Then render with layers
			mockGetLayers.mockReturnValue( [
				{ id: 'layer_1', type: 'text', text: 'Hello' }
			] );
			renderer.render();

			const emptyMsg = mockLayerList.querySelector( '.layers-empty' );
			expect( emptyMsg ).toBeNull();
		} );

		test( 'should handle null layerList gracefully', () => {
			renderer = new LayerListRenderer( {
				layerList: null,
				getLayers: mockGetLayers
			} );
			mockGetLayers.mockReturnValue( [ { id: 'layer_1', type: 'text' } ] );

			// Should not throw
			expect( () => renderer.render() ).not.toThrow();
		} );

		test( 'should mark selected layer', () => {
			mockGetSelectedLayerId.mockReturnValue( 'layer_2' );
			mockGetLayers.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );
			renderer.render();

			const item1 = mockLayerList.querySelector( '[data-layer-id="layer_1"]' );
			const item2 = mockLayerList.querySelector( '[data-layer-id="layer_2"]' );

			expect( item1.classList.contains( 'selected' ) ).toBe( false );
			expect( item2.classList.contains( 'selected' ) ).toBe( true );
		} );

		test( 'should remove items no longer in layer list', () => {
			// First render with two layers
			mockGetLayers.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );
			renderer.render();

			// Then render with only one layer
			mockGetLayers.mockReturnValue( [
				{ id: 'layer_1', type: 'text' }
			] );
			renderer.render();

			const items = mockLayerList.querySelectorAll( '.layer-item' );
			expect( items.length ).toBe( 1 );
			expect( items[ 0 ].dataset.layerId ).toBe( 'layer_1' );
		} );

		test( 'should maintain layer order', () => {
			mockGetLayers.mockReturnValue( [
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' },
				{ id: 'layer_3', type: 'circle' }
			] );
			renderer.render();

			// Change order
			mockGetLayers.mockReturnValue( [
				{ id: 'layer_3', type: 'circle' },
				{ id: 'layer_1', type: 'text' },
				{ id: 'layer_2', type: 'rectangle' }
			] );
			renderer.render();

			const items = mockLayerList.querySelectorAll( '.layer-item' );
			expect( items[ 0 ].dataset.layerId ).toBe( 'layer_3' );
			expect( items[ 1 ].dataset.layerId ).toBe( 'layer_1' );
			expect( items[ 2 ].dataset.layerId ).toBe( 'layer_2' );
		} );
	} );

	describe( 'createLayerItem', () => {
		beforeEach( () => {
			renderer = new LayerListRenderer( {
				layerList: mockLayerList,
				msg: mockMsg,
				getSelectedLayerId: mockGetSelectedLayerId,
				getLayers: mockGetLayers,
				onMoveLayer: mockOnMoveLayer
			} );
		} );

		test( 'should create layer item with all required elements', () => {
			const layer = { id: 'layer_1', type: 'text', text: 'Hello' };
			const item = renderer.createLayerItem( layer, 0 );

			expect( item.className ).toBe( 'layer-item' );
			expect( item.dataset.layerId ).toBe( 'layer_1' );
			expect( item.dataset.index ).toBe( '0' );
			expect( item.draggable ).toBe( true );

			expect( item.querySelector( '.layer-grab-area' ) ).not.toBeNull();
			expect( item.querySelector( '.layer-visibility' ) ).not.toBeNull();
			expect( item.querySelector( '.layer-name' ) ).not.toBeNull();
			expect( item.querySelector( '.layer-lock' ) ).not.toBeNull();
			expect( item.querySelector( '.layer-delete' ) ).not.toBeNull();
		} );

		test( 'should set ARIA attributes', () => {
			const layer = { id: 'layer_1', type: 'text', text: 'Hello', name: 'My Layer' };
			const item = renderer.createLayerItem( layer, 0 );

			expect( item.getAttribute( 'role' ) ).toBe( 'option' );
			expect( item.getAttribute( 'aria-label' ) ).toBe( 'My Layer' );
		} );

		test( 'should mark selected item', () => {
			mockGetSelectedLayerId.mockReturnValue( 'layer_1' );
			const layer = { id: 'layer_1', type: 'text' };
			const item = renderer.createLayerItem( layer, 0 );

			expect( item.classList.contains( 'selected' ) ).toBe( true );
			expect( item.getAttribute( 'aria-selected' ) ).toBe( 'true' );
		} );

		test( 'should use layer name when provided', () => {
			const layer = { id: 'layer_1', type: 'text', name: 'Custom Name' };
			const item = renderer.createLayerItem( layer, 0 );

			const nameEl = item.querySelector( '.layer-name' );
			expect( nameEl.textContent ).toBe( 'Custom Name' );
		} );

		test( 'should attach keyboard handler to grab area when onMoveLayer provided', () => {
			const layer = { id: 'layer_1', type: 'text' };
			const item = renderer.createLayerItem( layer, 0 );
			const grabArea = item.querySelector( '.layer-grab-area' );

			// Simulate ArrowUp keydown
			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp' } );
			grabArea.dispatchEvent( event );

			expect( mockOnMoveLayer ).toHaveBeenCalledWith( 'layer_1', -1 );
		} );

		test( 'should handle ArrowDown for moving layer down', () => {
			const layer = { id: 'layer_1', type: 'text' };
			const item = renderer.createLayerItem( layer, 0 );
			const grabArea = item.querySelector( '.layer-grab-area' );

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowDown' } );
			grabArea.dispatchEvent( event );

			expect( mockOnMoveLayer ).toHaveBeenCalledWith( 'layer_1', 1 );
		} );
	} );

	describe( 'updateLayerItem', () => {
		beforeEach( () => {
			renderer = new LayerListRenderer( {
				layerList: mockLayerList,
				msg: mockMsg,
				getSelectedLayerId: mockGetSelectedLayerId,
				getLayers: mockGetLayers
			} );
		} );

		test( 'should update layer attributes', () => {
			const layer = { id: 'layer_1', type: 'text' };
			const item = renderer.createLayerItem( layer, 0 );

			const updatedLayer = { id: 'layer_1', type: 'text', name: 'Updated Name' };
			renderer.updateLayerItem( item, updatedLayer, 1 );

			expect( item.dataset.index ).toBe( '1' );
			expect( item.getAttribute( 'aria-label' ) ).toBe( 'Updated Name' );
		} );

		test( 'should update selection state', () => {
			const layer = { id: 'layer_1', type: 'text' };
			const item = renderer.createLayerItem( layer, 0 );

			expect( item.classList.contains( 'selected' ) ).toBe( false );

			// Simulate selection change
			mockGetSelectedLayerId.mockReturnValue( 'layer_1' );
			renderer.updateLayerItem( item, layer, 0 );

			expect( item.classList.contains( 'selected' ) ).toBe( true );
		} );

		test( 'should update visibility icon', () => {
			const layer = { id: 'layer_1', type: 'text', visible: true };
			const item = renderer.createLayerItem( layer, 0 );

			mockWindow.IconFactory.createEyeIcon.mockClear();

			const updatedLayer = { id: 'layer_1', type: 'text', visible: false };
			renderer.updateLayerItem( item, updatedLayer, 0 );

			expect( mockWindow.IconFactory.createEyeIcon ).toHaveBeenCalledWith( false );
		} );

		test( 'should update lock icon', () => {
			const layer = { id: 'layer_1', type: 'text', locked: false };
			const item = renderer.createLayerItem( layer, 0 );

			mockWindow.IconFactory.createLockIcon.mockClear();

			const updatedLayer = { id: 'layer_1', type: 'text', locked: true };
			renderer.updateLayerItem( item, updatedLayer, 0 );

			expect( mockWindow.IconFactory.createLockIcon ).toHaveBeenCalledWith( true );
		} );

		test( 'should check activeElement before updating name', () => {
			// This tests the code path exists - JSDOM doesn't fully support contentEditable focus
			const layer = { id: 'layer_1', type: 'text', name: 'Original' };
			const item = renderer.createLayerItem( layer, 0 );
			const nameEl = item.querySelector( '.layer-name' );

			// When element doesn't have focus, name should update
			const updatedLayer = { id: 'layer_1', type: 'text', name: 'New Name' };
			renderer.updateLayerItem( item, updatedLayer, 0 );

			expect( nameEl.textContent ).toBe( 'New Name' );
		} );
	} );

	describe( 'getDefaultLayerName', () => {
		beforeEach( () => {
			renderer = new LayerListRenderer( {
				layerList: mockLayerList,
				msg: mockMsg
			} );
		} );

		test( 'should return type-based name for rectangle', () => {
			const result = renderer.getDefaultLayerName( { type: 'rectangle' } );
			expect( result ).toBe( 'Rectangle' );
		} );

		test( 'should return type-based name for circle', () => {
			const result = renderer.getDefaultLayerName( { type: 'circle' } );
			expect( result ).toBe( 'Circle' );
		} );

		test( 'should return type-based name for ellipse', () => {
			const result = renderer.getDefaultLayerName( { type: 'ellipse' } );
			expect( result ).toBe( 'Ellipse' );
		} );

		test( 'should return text preview for text layers', () => {
			const result = renderer.getDefaultLayerName( { type: 'text', text: 'Hello World' } );
			expect( result ).toBe( 'Text: Hello World' );
		} );

		test( 'should truncate long text to 20 characters', () => {
			const result = renderer.getDefaultLayerName( { type: 'text', text: 'This is a very long text that should be truncated' } );
			// slice(0, 20) gives exactly 20 characters from the text
			expect( result ).toBe( 'Text: This is a very long ' );
		} );

		test( 'should handle text layer without text', () => {
			const result = renderer.getDefaultLayerName( { type: 'text' } );
			expect( result ).toBe( 'Text: Empty' );
		} );

		test( 'should return Layer for unknown types', () => {
			const result = renderer.getDefaultLayerName( { type: 'unknown' } );
			expect( result ).toBe( 'Layer' );
		} );

		test( 'should handle all standard layer types', () => {
			const types = {
				rectangle: 'Rectangle',
				circle: 'Circle',
				ellipse: 'Ellipse',
				polygon: 'Polygon',
				star: 'Star',
				arrow: 'Arrow',
				line: 'Line',
				path: 'Drawing',
				highlight: 'Highlight',
				blur: 'Blur/Redaction'
			};

			for ( const [ type, expected ] of Object.entries( types ) ) {
				const result = renderer.getDefaultLayerName( { type } );
				expect( result ).toBe( expected );
			}
		} );
	} );

	describe( 'icon creation methods', () => {
		beforeEach( () => {
			renderer = new LayerListRenderer( {
				layerList: mockLayerList,
				msg: mockMsg
			} );
		} );

		test( '_createEyeIcon should delegate to IconFactory', () => {
			renderer._createEyeIcon( true );
			expect( mockWindow.IconFactory.createEyeIcon ).toHaveBeenCalledWith( true );
		} );

		test( '_createLockIcon should delegate to IconFactory', () => {
			renderer._createLockIcon( true );
			expect( mockWindow.IconFactory.createLockIcon ).toHaveBeenCalledWith( true );
		} );

		test( '_createDeleteIcon should delegate to IconFactory', () => {
			renderer._createDeleteIcon();
			expect( mockWindow.IconFactory.createDeleteIcon ).toHaveBeenCalled();
		} );
	} );
} );
