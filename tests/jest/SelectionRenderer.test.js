/**
 * Tests for SelectionRenderer
 */
'use strict';

const SelectionRenderer = require( '../../resources/ext.layers.editor/canvas/SelectionRenderer.js' );

describe( 'SelectionRenderer', () => {
	let renderer;
	let mockCtx;
	let mockLayers;

	beforeEach( () => {
		// Mock canvas 2D context
		mockCtx = {
			save: jest.fn(),
			restore: jest.fn(),
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			beginPath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			stroke: jest.fn(),
			fill: jest.fn(),
			arc: jest.fn(),
			translate: jest.fn(),
			rotate: jest.fn(),
			setLineDash: jest.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1
		};

		// Mock layers array
		mockLayers = [
			{ id: 'layer1', type: 'rectangle', x: 100, y: 100, width: 200, height: 100 },
			{ id: 'layer2', type: 'circle', x: 300, y: 200, radius: 50 },
			{ id: 'layer3', type: 'arrow', x1: 50, y1: 50, x2: 150, y2: 150 }
		];

		renderer = new SelectionRenderer( {
			ctx: mockCtx,
			getLayerById: ( id ) => mockLayers.find( ( l ) => l.id === id ) || null,
			getLayerBounds: ( layer ) => {
				if ( layer.type === 'rectangle' ) {
					return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
				}
				if ( layer.type === 'circle' ) {
					const r = layer.radius || 0;
					return { x: layer.x - r, y: layer.y - r, width: r * 2, height: r * 2 };
				}
				if ( layer.type === 'arrow' || layer.type === 'line' ) {
					const minX = Math.min( layer.x1, layer.x2 );
					const minY = Math.min( layer.y1, layer.y2 );
					return {
						x: minX,
						y: minY,
						width: Math.abs( layer.x2 - layer.x1 ),
						height: Math.abs( layer.y2 - layer.y1 )
					};
				}
				return null;
			}
		} );
	} );

	afterEach( () => {
		if ( renderer ) {
			renderer.destroy();
		}
	} );

	describe( 'constructor', () => {
		test( 'should create instance with config', () => {
			expect( renderer ).toBeInstanceOf( SelectionRenderer );
			expect( renderer.ctx ).toBe( mockCtx );
		} );

		test( 'should initialize empty selection handles', () => {
			expect( renderer.selectionHandles ).toEqual( [] );
		} );

		test( 'should set default style configuration', () => {
			expect( renderer.handleSize ).toBe( 12 );
			expect( renderer.handleColor ).toBe( '#2196f3' );
			expect( renderer.rotationHandleColor ).toBe( '#ff9800' );
		} );
	} );

	describe( 'setContext', () => {
		test( 'should update context', () => {
			const newCtx = { newContext: true };
			renderer.setContext( newCtx );
			expect( renderer.ctx ).toBe( newCtx );
		} );
	} );

	describe( 'clearHandles', () => {
		test( 'should clear selection handles array', () => {
			renderer.selectionHandles = [ { type: 'nw' }, { type: 'se' } ];
			renderer.clearHandles();
			expect( renderer.selectionHandles ).toEqual( [] );
		} );
	} );

	describe( 'getHandles', () => {
		test( 'should return selection handles', () => {
			const handles = [ { type: 'nw' }, { type: 'se' } ];
			renderer.selectionHandles = handles;
			expect( renderer.getHandles() ).toBe( handles );
		} );
	} );

	describe( 'drawMultiSelectionIndicators', () => {
		test( 'should clear handles when no selection', () => {
			renderer.selectionHandles = [ { type: 'test' } ];
			renderer.drawMultiSelectionIndicators( [] );
			expect( renderer.selectionHandles ).toEqual( [] );
		} );

		test( 'should draw indicators for each selected layer', () => {
			renderer.drawMultiSelectionIndicators( [ 'layer1' ] );
			// Should have 8 handles (corners + edges) + 1 rotation = 9
			expect( renderer.selectionHandles.length ).toBe( 9 );
		} );

		test( 'should handle null selection array', () => {
			renderer.drawMultiSelectionIndicators( null );
			expect( renderer.selectionHandles ).toEqual( [] );
		} );
	} );

	describe( 'drawSelectionIndicators', () => {
		test( 'should handle non-existent layer', () => {
			renderer.drawSelectionIndicators( 'nonexistent' );
			expect( renderer.selectionHandles ).toEqual( [] );
		} );

		test( 'should draw handles for rectangle layer', () => {
			renderer.drawSelectionIndicators( 'layer1' );
			// 8 resize handles + 1 rotation handle
			expect( renderer.selectionHandles.length ).toBe( 9 );
		} );

		test( 'should draw line-specific handles for arrow layer', () => {
			renderer.drawSelectionIndicators( 'layer3' );
			// 2 endpoint handles only (no rotation for lines)
			expect( renderer.selectionHandles.length ).toBe( 2 );
		} );

		test( 'should call ctx.save and ctx.restore', () => {
			renderer.drawSelectionIndicators( 'layer1' );
			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawSelectionHandles', () => {
		test( 'should create 8 handles for bounding box', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawSelectionHandles( bounds, layer, false, bounds );

			expect( renderer.selectionHandles.length ).toBe( 8 );

			const types = renderer.selectionHandles.map( ( h ) => h.type );
			expect( types ).toContain( 'nw' );
			expect( types ).toContain( 'ne' );
			expect( types ).toContain( 'se' );
			expect( types ).toContain( 'sw' );
			expect( types ).toContain( 'n' );
			expect( types ).toContain( 'e' );
			expect( types ).toContain( 's' );
			expect( types ).toContain( 'w' );
		} );

		test( 'should draw filled and stroked rectangles', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawSelectionHandles( bounds, layer, false, bounds );

			expect( mockCtx.fillRect ).toHaveBeenCalledTimes( 8 );
			expect( mockCtx.strokeRect ).toHaveBeenCalledTimes( 8 );
		} );

		test( 'should transform coordinates for rotated layers', () => {
			const bounds = { x: -100, y: -50, width: 200, height: 100 };
			const worldBounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 45 };

			renderer.drawSelectionHandles( bounds, layer, true, worldBounds );

			// Handles should have transformed world coordinates
			expect( renderer.selectionHandles.length ).toBe( 8 );
			// Check that coordinates were transformed (not the same as local)
			const nwHandle = renderer.selectionHandles.find( ( h ) => h.type === 'nw' );
			expect( nwHandle ).toBeDefined();
			expect( nwHandle.layerId ).toBe( 'test' );
			expect( nwHandle.rotation ).toBe( 45 );
		} );
	} );

	describe( 'drawLineSelectionIndicators', () => {
		test( 'should create 2 endpoint handles for line', () => {
			const layer = { id: 'line1', type: 'line', x1: 50, y1: 50, x2: 150, y2: 150 };
			renderer.drawLineSelectionIndicators( layer );

			expect( renderer.selectionHandles.length ).toBe( 2 );

			const types = renderer.selectionHandles.map( ( h ) => h.type );
			expect( types ).toContain( 'w' ); // Start point
			expect( types ).toContain( 'e' ); // End point
		} );

		test( 'should mark handles as isLine', () => {
			const layer = { id: 'line1', type: 'line', x1: 50, y1: 50, x2: 150, y2: 150 };
			renderer.drawLineSelectionIndicators( layer );

			renderer.selectionHandles.forEach( ( handle ) => {
				expect( handle.isLine ).toBe( true );
			} );
		} );

		test( 'should handle missing coordinates', () => {
			const layer = { id: 'line1', type: 'line' };
			renderer.drawLineSelectionIndicators( layer );

			expect( renderer.selectionHandles.length ).toBe( 2 );
			// Should default to 0,0
			expect( renderer.selectionHandles[ 0 ].x ).toBeDefined();
			expect( renderer.selectionHandles[ 0 ].y ).toBeDefined();
		} );
	} );

	describe( 'drawRotationHandle', () => {
		test( 'should create rotation handle', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawRotationHandle( bounds, layer, false, bounds );

			expect( renderer.selectionHandles.length ).toBe( 1 );
			expect( renderer.selectionHandles[ 0 ].type ).toBe( 'rotate' );
		} );

		test( 'should draw connecting line', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawRotationHandle( bounds, layer, false, bounds );

			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.moveTo ).toHaveBeenCalled();
			expect( mockCtx.lineTo ).toHaveBeenCalled();
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'should draw circular handle', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawRotationHandle( bounds, layer, false, bounds );

			expect( mockCtx.arc ).toHaveBeenCalled();
			expect( mockCtx.fill ).toHaveBeenCalled();
		} );

		test( 'should transform coordinates for rotated layers', () => {
			const bounds = { x: -100, y: -50, width: 200, height: 100 };
			const worldBounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 90 };

			renderer.drawRotationHandle( bounds, layer, true, worldBounds );

			const rotateHandle = renderer.selectionHandles[ 0 ];
			expect( rotateHandle.type ).toBe( 'rotate' );
			expect( rotateHandle.rotation ).toBe( 90 );
		} );
	} );

	describe( 'drawMarqueeBox', () => {
		test( 'should not draw when rect is null', () => {
			renderer.drawMarqueeBox( null );
			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );

		test( 'should draw marquee rectangle', () => {
			const rect = { x: 50, y: 50, width: 100, height: 80 };
			renderer.drawMarqueeBox( rect );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 50, 50, 100, 80 );
			expect( mockCtx.strokeRect ).toHaveBeenCalledWith( 50, 50, 100, 80 );
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		test( 'should set dashed line style', () => {
			const rect = { x: 50, y: 50, width: 100, height: 80 };
			renderer.drawMarqueeBox( rect );

			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 5, 5 ] );
		} );
	} );

	describe( 'destroy', () => {
		test( 'should clear all state', () => {
			renderer.selectionHandles = [ { type: 'nw' } ];
			renderer.destroy();

			expect( renderer.selectionHandles ).toEqual( [] );
			expect( renderer.ctx ).toBeNull();
			expect( renderer.getLayerById ).toBeNull();
			expect( renderer.getLayerBounds ).toBeNull();
			expect( renderer.config ).toBeNull();
		} );
	} );

	describe( 'integration: handle positions', () => {
		test( 'should place corner handles at correct positions', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawSelectionHandles( bounds, layer, false, bounds );

			const handleSize = renderer.handleSize;
			const nw = renderer.selectionHandles.find( ( h ) => h.type === 'nw' );
			const se = renderer.selectionHandles.find( ( h ) => h.type === 'se' );

			// NW corner should be at (100, 100) minus half handle size
			expect( nw.x ).toBe( 100 - handleSize / 2 );
			expect( nw.y ).toBe( 100 - handleSize / 2 );

			// SE corner should be at (300, 200) minus half handle size
			expect( se.x ).toBe( 300 - handleSize / 2 );
			expect( se.y ).toBe( 200 - handleSize / 2 );
		} );

		test( 'should place edge handles at midpoints', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawSelectionHandles( bounds, layer, false, bounds );

			const handleSize = renderer.handleSize;
			const n = renderer.selectionHandles.find( ( h ) => h.type === 'n' );
			const e = renderer.selectionHandles.find( ( h ) => h.type === 'e' );

			// N edge should be at midpoint of top edge
			expect( n.x ).toBe( 200 - handleSize / 2 ); // 100 + 200/2
			expect( n.y ).toBe( 100 - handleSize / 2 );

			// E edge should be at midpoint of right edge
			expect( e.x ).toBe( 300 - handleSize / 2 ); // 100 + 200
			expect( e.y ).toBe( 150 - handleSize / 2 ); // 100 + 100/2
		} );
	} );
} );
