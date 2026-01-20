/**
 * Tests for VirtualLayerList
 */

const VirtualLayerList = require( '../../../resources/ext.layers.editor/ui/VirtualLayerList.js' );

describe( 'VirtualLayerList', () => {
	let container;
	let listElement;
	let layers;
	let virtualList;

	beforeEach( () => {
		// Create mock DOM structure
		container = document.createElement( 'div' );
		container.style.height = '400px';
		container.style.overflowY = 'auto';
		Object.defineProperty( container, 'clientHeight', { value: 400, writable: true } );

		listElement = document.createElement( 'div' );
		container.appendChild( listElement );
		document.body.appendChild( container );

		// Create mock layers
		layers = [];
		for ( let i = 0; i < 50; i++ ) {
			layers.push( {
				id: `layer-${ i }`,
				type: 'rectangle',
				name: `Layer ${ i }`,
				visible: true,
				locked: false
			} );
		}
	} );

	afterEach( () => {
		if ( virtualList ) {
			virtualList.destroy();
			virtualList = null;
		}
		if ( container.parentNode ) {
			container.parentNode.removeChild( container );
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default config', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			expect( virtualList ).toBeDefined();
			expect( virtualList.itemHeight ).toBe( 44 );
			expect( virtualList.overscan ).toBe( 5 );
			expect( virtualList.threshold ).toBe( 30 );
		} );

		it( 'should accept custom config values', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn(),
				itemHeight: 50,
				overscan: 10,
				threshold: 20
			} );

			expect( virtualList.itemHeight ).toBe( 50 );
			expect( virtualList.overscan ).toBe( 10 );
			expect( virtualList.threshold ).toBe( 20 );
		} );
	} );

	describe( 'isEnabled', () => {
		it( 'should return true when layer count exceeds threshold', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers, // 50 layers
				createItem: jest.fn(),
				updateItem: jest.fn(),
				threshold: 30
			} );

			expect( virtualList.isEnabled() ).toBe( true );
		} );

		it( 'should return false when layer count is below threshold', () => {
			const smallLayers = layers.slice( 0, 10 );
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => smallLayers,
				createItem: jest.fn(),
				updateItem: jest.fn(),
				threshold: 30
			} );

			expect( virtualList.isEnabled() ).toBe( false );
		} );
	} );

	describe( 'enable/disable', () => {
		it( 'should enable virtualization', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			virtualList.enable();
			expect( virtualList._isEnabled ).toBe( true );
		} );

		it( 'should disable virtualization', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			virtualList.enable();
			virtualList.disable();
			expect( virtualList._isEnabled ).toBe( false );
		} );

		it( 'should not enable twice', () => {
			const addSpy = jest.spyOn( container, 'addEventListener' );

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			virtualList.enable();
			virtualList.enable(); // Second call should be no-op

			// Should only add scroll listener once
			expect( addSpy ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'render', () => {
		it( 'should return false for small layer counts', () => {
			const smallLayers = layers.slice( 0, 10 );
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => smallLayers,
				createItem: jest.fn(),
				updateItem: jest.fn(),
				threshold: 30
			} );

			const result = virtualList.render();
			expect( result ).toBe( false );
		} );

		it( 'should return true for large layer counts', () => {
			const createItem = jest.fn( ( layer ) => {
				const el = document.createElement( 'div' );
				el.className = 'layer-item';
				el.dataset.layerId = layer.id;
				return el;
			} );

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem,
				updateItem: jest.fn(),
				threshold: 30
			} );

			const result = virtualList.render();
			expect( result ).toBe( true );
		} );

		it( 'should only render visible items plus overscan', () => {
			const createItem = jest.fn( ( layer ) => {
				const el = document.createElement( 'div' );
				el.className = 'layer-item';
				el.dataset.layerId = layer.id;
				return el;
			} );

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers, // 50 layers
				createItem,
				updateItem: jest.fn(),
				itemHeight: 44,
				overscan: 5,
				threshold: 30
			} );

			virtualList.render();

			// With 400px container and 44px items, visible = ~9 items
			// Plus 5 overscan on each side = ~19 items max
			// Should be much less than 50 total layers
			expect( createItem.mock.calls.length ).toBeLessThan( 30 );
		} );

		it( 'should create spacer elements', () => {
			const createItem = jest.fn( ( layer ) => {
				const el = document.createElement( 'div' );
				el.className = 'layer-item';
				el.dataset.layerId = layer.id;
				return el;
			} );

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem,
				updateItem: jest.fn()
			} );

			virtualList.render();

			const topSpacer = listElement.querySelector( '.layers-virtual-spacer-top' );
			const bottomSpacer = listElement.querySelector( '.layers-virtual-spacer-bottom' );

			expect( topSpacer ).toBeTruthy();
			expect( bottomSpacer ).toBeTruthy();
		} );
	} );

	describe( 'scrollToLayer', () => {
		it( 'should scroll to make layer visible', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn( ( layer ) => {
					const el = document.createElement( 'div' );
					el.className = 'layer-item';
					el.dataset.layerId = layer.id;
					return el;
				} ),
				updateItem: jest.fn()
			} );

			virtualList.enable();
			virtualList.scrollToLayer( 'layer-40' );

			// Should have scrolled down
			expect( container.scrollTop ).toBeGreaterThan( 0 );
		} );

		it( 'should not scroll for non-existent layer', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			virtualList.enable();
			const initialScroll = container.scrollTop;
			virtualList.scrollToLayer( 'non-existent' );

			expect( container.scrollTop ).toBe( initialScroll );
		} );
	} );

	describe( 'getVisibleRange', () => {
		it( 'should return current visible range', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn( ( layer ) => {
					const el = document.createElement( 'div' );
					el.className = 'layer-item';
					el.dataset.layerId = layer.id;
					return el;
				} ),
				updateItem: jest.fn()
			} );

			virtualList.render();

			const range = virtualList.getVisibleRange();
			expect( range ).toHaveProperty( 'start' );
			expect( range ).toHaveProperty( 'end' );
			expect( range.start ).toBeGreaterThanOrEqual( 0 );
			expect( range.end ).toBeGreaterThan( range.start );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up resources', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			virtualList.enable();
			virtualList.destroy();

			expect( virtualList._isEnabled ).toBe( false );
			expect( virtualList._itemPool.size ).toBe( 0 );
		} );
	} );

	describe( 'item recycling', () => {
		it( 'should recycle DOM elements when scrolling', () => {
			const createItem = jest.fn( ( layer ) => {
				const el = document.createElement( 'div' );
				el.className = 'layer-item';
				el.dataset.layerId = layer.id;
				return el;
			} );

			const updateItem = jest.fn();

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem,
				updateItem,
				threshold: 30
			} );

			// First render
			virtualList.render();
			const initialCreateCalls = createItem.mock.calls.length;

			// Simulate scroll
			container.scrollTop = 500;
			virtualList._performRender();

			// Some items should be updated rather than recreated
			expect( updateItem ).toHaveBeenCalled();
		} );
	} );
} );
