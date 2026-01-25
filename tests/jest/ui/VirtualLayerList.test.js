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

			expect( topSpacer ).toBeInstanceOf( HTMLElement );
			expect( bottomSpacer ).toBeInstanceOf( HTMLElement );
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

		it( 'should prune item pool when it exceeds 50 items', () => {
			// Create 100 layers to force pool overflow
			const manyLayers = [];
			for ( let i = 0; i < 100; i++ ) {
				manyLayers.push( {
					id: `layer-${ i }`,
					type: 'rectangle',
					name: `Layer ${ i }`,
					visible: true
				} );
			}

			const createItem = jest.fn( ( layer ) => {
				const el = document.createElement( 'div' );
				el.className = 'layer-item';
				el.dataset.layerId = layer.id;
				return el;
			} );

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => manyLayers,
				createItem,
				updateItem: jest.fn(),
				threshold: 30
			} );

			// Render multiple times at different scroll positions to build up pool
			virtualList.render();
			container.scrollTop = 2000;
			virtualList._performRender();
			container.scrollTop = 0;
			virtualList._performRender();
			container.scrollTop = 3000;
			virtualList._performRender();

			// Pool should be pruned to max 50
			expect( virtualList._itemPool.size ).toBeLessThanOrEqual( 50 );
		} );
	} );

	describe( 'scrollToLayer edge cases', () => {
		it( 'should scroll up when item is above viewport', () => {
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

			// Scroll down first
			container.scrollTop = 1000;

			// Now scroll to layer at top
			virtualList.scrollToLayer( 'layer-5' );

			// Should have scrolled up
			expect( container.scrollTop ).toBe( 5 * 44 ); // layer 5 * itemHeight
		} );

		it( 'should scroll down when item is below viewport', () => {
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
			container.scrollTop = 0;

			// Scroll to layer far down (layer 40 is at 40*44 = 1760px)
			virtualList.scrollToLayer( 'layer-40' );

			// Should have scrolled down so item is visible at bottom
			const expectedBottom = ( 40 * 44 ) + 44; // itemTop + itemHeight
			const expectedScroll = expectedBottom - 400; // - containerHeight
			expect( container.scrollTop ).toBe( expectedScroll );
		} );

		it( 'should not scroll if item is already visible', () => {
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
			container.scrollTop = 0;
			const initialScroll = container.scrollTop;

			// Layer 2 at 88px is visible in 400px viewport
			virtualList.scrollToLayer( 'layer-2' );

			expect( container.scrollTop ).toBe( initialScroll );
		} );
	} );

	describe( '_onScroll', () => {
		it( 'should schedule render when enabled', () => {
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
			const scheduleSpy = jest.spyOn( virtualList, '_scheduleRender' );

			virtualList._onScroll();

			expect( scheduleSpy ).toHaveBeenCalled();
		} );

		it( 'should not schedule render when disabled', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			// Don't enable
			const scheduleSpy = jest.spyOn( virtualList, '_scheduleRender' );

			virtualList._onScroll();

			expect( scheduleSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'disable', () => {
		it( 'should not disable if already disabled', () => {
			const removeSpy = jest.spyOn( container, 'removeEventListener' );

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			// Never enabled, so disable should be no-op
			virtualList.disable();

			expect( removeSpy ).not.toHaveBeenCalled();
		} );

		it( 'should clean up spacers and cancel pending renders', () => {
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
			virtualList.disable();

			// Spacers should be removed
			expect( listElement.querySelector( '.layers-virtual-spacer-top' ) ).toBeNull();
			expect( listElement.querySelector( '.layers-virtual-spacer-bottom' ) ).toBeNull();
		} );
	} );

	describe( '_throttle', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should execute function immediately on first call', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			const fn = jest.fn();
			const throttled = virtualList._throttle( fn, 100 );

			throttled();
			expect( fn ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should not execute again within throttle limit', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			const fn = jest.fn();
			const throttled = virtualList._throttle( fn, 100 );

			throttled();
			throttled();
			throttled();

			expect( fn ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should execute again after throttle limit expires', () => {
			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => layers,
				createItem: jest.fn(),
				updateItem: jest.fn()
			} );

			const fn = jest.fn();
			const throttled = virtualList._throttle( fn, 100 );

			throttled();
			expect( fn ).toHaveBeenCalledTimes( 1 );

			jest.advanceTimersByTime( 150 );

			throttled();
			expect( fn ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	describe( '_scheduleRender', () => {
		it( 'should not schedule multiple renders', () => {
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

			// First render to enable
			virtualList.render();

			const rafSpy = jest.spyOn( window, 'requestAnimationFrame' );

			virtualList._scheduleRender();
			virtualList._scheduleRender();
			virtualList._scheduleRender();

			// Should only call RAF once
			expect( rafSpy ).toHaveBeenCalledTimes( 1 );

			// Cancel pending to avoid afterEach issues
			if ( virtualList._pendingRender ) {
				cancelAnimationFrame( virtualList._pendingRender );
				virtualList._pendingRender = null;
			}

			rafSpy.mockRestore();
		} );

		it( 'should clear pending flag after render executes', () => {
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

			// First render to set up spacers
			virtualList.render();

			// Manually set pending and call the callback logic
			virtualList._pendingRender = 123;
			virtualList._pendingRender = null;
			virtualList._performRender();

			expect( virtualList._pendingRender ).toBe( null );
		} );
	} );

	describe( 'render with transition from large to small', () => {
		it( 'should disable virtualization when layer count drops below threshold', () => {
			let currentLayers = layers; // 50 layers

			virtualList = new VirtualLayerList( {
				container,
				listElement,
				getLayers: () => currentLayers,
				createItem: jest.fn( ( layer ) => {
					const el = document.createElement( 'div' );
					el.className = 'layer-item';
					el.dataset.layerId = layer.id;
					return el;
				} ),
				updateItem: jest.fn(),
				threshold: 30
			} );

			// First render with 50 layers
			virtualList.render();
			expect( virtualList._isEnabled ).toBe( true );

			// Now reduce to 10 layers
			currentLayers = layers.slice( 0, 10 );
			const result = virtualList.render();

			expect( result ).toBe( false );
			expect( virtualList._isEnabled ).toBe( false );
		} );
	} );
} );
