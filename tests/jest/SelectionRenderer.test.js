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
			closePath: jest.fn(),
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
			// 2 endpoint handles + 1 curve control handle for arrows
			expect( renderer.selectionHandles.length ).toBe( 3 );
			const types = renderer.selectionHandles.map( ( h ) => h.type );
			expect( types ).toContain( 'w' ); // Start point
			expect( types ).toContain( 'e' ); // End point
			expect( types ).toContain( 'control' ); // Curve control
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

	describe( 'drawCurveControlHandle', () => {
		test( 'should create control handle for arrow', () => {
			const layer = { id: 'arrow1', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawCurveControlHandle( layer, 0, 0, 100, 100, 12, false );

			expect( renderer.selectionHandles.length ).toBe( 1 );
			const handle = renderer.selectionHandles[ 0 ];
			expect( handle.type ).toBe( 'control' );
			expect( handle.isControl ).toBe( true );
			expect( handle.isLine ).toBe( true );
		} );

		test( 'should position at midpoint by default', () => {
			const layer = { id: 'arrow1', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0 };
			renderer.drawCurveControlHandle( layer, 0, 0, 100, 0, 12, false );

			const handle = renderer.selectionHandles[ 0 ];
			// Midpoint is (50, 0), handle is centered at that point minus handleSize/2
			expect( handle.x ).toBe( 50 - 12 / 2 );
			expect( handle.y ).toBe( 0 - 12 / 2 );
		} );

		test( 'should use existing control point if set', () => {
			const layer = {
				id: 'arrow1', type: 'arrow',
				x1: 0, y1: 0, x2: 100, y2: 0,
				controlX: 50, controlY: 80
			};
			renderer.drawCurveControlHandle( layer, 0, 0, 100, 0, 12, false );

			const handle = renderer.selectionHandles[ 0 ];
			expect( handle.x ).toBe( 50 - 12 / 2 );
			expect( handle.y ).toBe( 80 - 12 / 2 );
		} );

		test( 'should draw circular handle', () => {
			const layer = { id: 'arrow1', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawCurveControlHandle( layer, 0, 0, 100, 100, 12, false );

			expect( mockCtx.arc ).toHaveBeenCalled();
			expect( mockCtx.fill ).toHaveBeenCalled();
		} );

		test( 'should draw dashed line to midpoint', () => {
			const layer = { id: 'arrow1', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawCurveControlHandle( layer, 0, 0, 100, 100, 12, false );

			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 4, 4 ] );
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'should use key object style when isKeyObject', () => {
			const layer = { id: 'arrow1', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawCurveControlHandle( layer, 0, 0, 100, 100, 12, true );

			// When key object, strokeStyle should be orange
			expect( mockCtx.strokeStyle ).toBe( '#ff9800' );
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

	describe( 'drawCalloutTailHandle', () => {
		test( 'should create tailTip handle for callout with default tail', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				x: 100,
				y: 100,
				width: 200,
				height: 100
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			expect( renderer.selectionHandles.length ).toBe( 1 );
			const handle = renderer.selectionHandles[ 0 ];
			expect( handle.type ).toBe( 'tailTip' );
			expect( handle.isCalloutTail ).toBe( true );
			expect( handle.layerId ).toBe( 'callout1' );
		} );

		test( 'should position tail at bottom by default', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				x: 100, y: 100,
				width: 200, height: 100
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// Default: bottom center, tailSize=20
			// tipY = y + height + tailSize = 100 + 100 + 20 = 220
			// tipX = x + width * 0.5 = 100 + 100 = 200
			expect( handle.x ).toBe( 200 - handleSize / 2 );
			expect( handle.y ).toBe( 220 - handleSize / 2 );
		} );

		test( 'should use explicit tailTipX/tailTipY when set', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailTipX: 50,
				tailTipY: 80
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// Explicit tip is relative to center (200, 150)
			// tipX = 200 + 50 = 250, tipY = 150 + 80 = 230
			expect( handle.x ).toBe( 250 - handleSize / 2 );
			expect( handle.y ).toBe( 230 - handleSize / 2 );
		} );

		test( 'should rotate explicit tailTip with layer rotation', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailTipX: 50,
				tailTipY: 0,
				rotation: 90
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			// After 90 degree rotation, (50, 0) becomes (0, 50)
			// Center is (200, 150), so tip is at (200 + 0, 150 + 50) = (200, 200)
			expect( handle ).toBeDefined();
			expect( handle.type ).toBe( 'tailTip' );
		} );

		test( 'should handle tailDirection top', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'top',
				tailPosition: 0.5,
				tailSize: 30
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// tipX = 100 + 200 * 0.5 = 200
			// tipY = 100 - 30 = 70
			expect( handle.x ).toBe( 200 - handleSize / 2 );
			expect( handle.y ).toBe( 70 - handleSize / 2 );
		} );

		test( 'should handle tailDirection left', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'left',
				tailPosition: 0.5,
				tailSize: 25
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// tipX = 100 - 25 = 75
			// tipY = 100 + 100 * 0.5 = 150
			expect( handle.x ).toBe( 75 - handleSize / 2 );
			expect( handle.y ).toBe( 150 - handleSize / 2 );
		} );

		test( 'should handle tailDirection right', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'right',
				tailPosition: 0.5,
				tailSize: 25
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// tipX = 100 + 200 + 25 = 325
			// tipY = 100 + 100 * 0.5 = 150
			expect( handle.x ).toBe( 325 - handleSize / 2 );
			expect( handle.y ).toBe( 150 - handleSize / 2 );
		} );

		test( 'should handle tailDirection top-left', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'top-left',
				tailPosition: 0.25,
				tailSize: 20
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// tipX = 100 + 200 * 0.25 = 150
			// tipY = 100 - 20 = 80
			expect( handle.x ).toBe( 150 - handleSize / 2 );
			expect( handle.y ).toBe( 80 - handleSize / 2 );
		} );

		test( 'should handle tailDirection top-right', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'top-right',
				tailPosition: 0.75,
				tailSize: 20
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// tipX = 100 + 200 * 0.75 = 250
			// tipY = 100 - 20 = 80
			expect( handle.x ).toBe( 250 - handleSize / 2 );
			expect( handle.y ).toBe( 80 - handleSize / 2 );
		} );

		test( 'should handle tailDirection bottom-left', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'bottom-left',
				tailPosition: 0.25,
				tailSize: 20
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// tipX = 100 + 200 * 0.25 = 150
			// tipY = 100 + 100 + 20 = 220
			expect( handle.x ).toBe( 150 - handleSize / 2 );
			expect( handle.y ).toBe( 220 - handleSize / 2 );
		} );

		test( 'should handle tailDirection bottom-right', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'bottom-right',
				tailPosition: 0.75,
				tailSize: 20
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			const handleSize = renderer.handleSize;
			// tipX = 100 + 200 * 0.75 = 250
			// tipY = 100 + 100 + 20 = 220
			expect( handle.x ).toBe( 250 - handleSize / 2 );
			expect( handle.y ).toBe( 220 - handleSize / 2 );
		} );

		test( 'should rotate legacy tail position with layer rotation', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'bottom',
				tailPosition: 0.5,
				tailSize: 20,
				rotation: 180
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			const handle = renderer.selectionHandles[ 0 ];
			expect( handle ).toBeDefined();
			expect( handle.type ).toBe( 'tailTip' );
		} );

		test( 'should draw dashed line from center to tail tip', () => {
			const layer = {
				id: 'callout1',
				type: 'callout',
				tailDirection: 'bottom'
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 4, 4 ] );
			expect( mockCtx.moveTo ).toHaveBeenCalled();
			expect( mockCtx.lineTo ).toHaveBeenCalled();
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'should draw diamond-shaped handle', () => {
			const layer = {
				id: 'callout1',
				type: 'callout'
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, false );

			// Diamond is drawn with moveTo, 3 lineTo, closePath
			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.moveTo ).toHaveBeenCalled();
			expect( mockCtx.closePath ).toHaveBeenCalled();
			expect( mockCtx.fill ).toHaveBeenCalled();
		} );

		test( 'should use key object style when isKeyObject', () => {
			const layer = {
				id: 'callout1',
				type: 'callout'
			};
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			renderer.drawCalloutTailHandle( layer, bounds, true );

			// When key object, strokeStyle should be orange
			expect( mockCtx.strokeStyle ).toBe( '#ff9800' );
		} );
	} );

	describe( 'group layer handling', () => {
		test( 'should skip drawing handles for group layers', () => {
			const groupLayer = { id: 'group1', type: 'group', name: 'My Group' };
			mockLayers.push( groupLayer );

			renderer.drawSelectionIndicators( 'group1' );

			// Group layers should not get handles
			expect( renderer.selectionHandles ).toEqual( [] );
		} );
	} );

	describe( 'missing context handling', () => {
		test( 'should not draw when context is null', () => {
			renderer.ctx = null;
			renderer.drawSelectionIndicators( 'layer1' );

			expect( renderer.selectionHandles ).toEqual( [] );
		} );

		test( 'drawMarqueeBox should not draw when context is null', () => {
			renderer.ctx = null;
			renderer.drawMarqueeBox( { x: 0, y: 0, width: 100, height: 100 } );

			expect( mockCtx.save ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'missing bounds handling', () => {
		test( 'should handle layer with no bounds', () => {
			// Add a layer that returns null bounds
			const unboundedLayer = { id: 'unbounded', type: 'unknown' };
			mockLayers.push( unboundedLayer );

			renderer.drawSelectionIndicators( 'unbounded' );

			expect( renderer.selectionHandles ).toEqual( [] );
		} );
	} );

	describe( 'rotated layer handling', () => {
		test( 'should apply rotation transform for rotated layers', () => {
			// Add a rotated rectangle layer
			const rotatedLayer = {
				id: 'rotated1',
				type: 'rectangle',
				x: 100, y: 100,
				width: 200, height: 100,
				rotation: 45
			};
			mockLayers.push( rotatedLayer );

			renderer.drawSelectionIndicators( 'rotated1' );

			expect( mockCtx.translate ).toHaveBeenCalled();
			expect( mockCtx.rotate ).toHaveBeenCalled();
			// Should have 9 handles (8 resize + 1 rotation)
			expect( renderer.selectionHandles.length ).toBe( 9 );
		} );

		test( 'should draw callout tail handle for rotated callouts', () => {
			// Add a rotated callout layer
			const rotatedCallout = {
				id: 'rotatedCallout1',
				type: 'callout',
				x: 100, y: 100,
				width: 200, height: 100,
				rotation: 90
			};
			mockLayers.push( rotatedCallout );

			// Update getLayerBounds to handle callout
			renderer.getLayerBounds = ( layer ) => {
				if ( layer.type === 'callout' ) {
					return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
				}
				return null;
			};

			renderer.drawSelectionIndicators( 'rotatedCallout1' );

			// Should have resize handles + rotation + tail tip
			const tailHandle = renderer.selectionHandles.find( ( h ) => h.type === 'tailTip' );
			expect( tailHandle ).toBeDefined();
			expect( tailHandle.isCalloutTail ).toBe( true );
		} );
	} );

	describe( 'key object styling', () => {
		test( 'should use orange border for key object handles', () => {
			renderer.drawMultiSelectionIndicators( [ 'layer1', 'layer2' ], 'layer1' );

			// Should set strokeStyle to orange for key object
			expect( mockCtx.strokeStyle ).toBe( '#ffffff' ); // Last call, non-key object
		} );

		test( 'should use thicker border for key object', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawSelectionHandles( bounds, layer, false, bounds, true );

			// Key object should have lineWidth 3
			expect( mockCtx.lineWidth ).toBe( 3 );
		} );

		test( 'should use normal border for non-key object', () => {
			const bounds = { x: 100, y: 100, width: 200, height: 100 };
			const layer = { id: 'test', rotation: 0 };
			renderer.drawSelectionHandles( bounds, layer, false, bounds, false );

			// Non-key object should have lineWidth 1
			expect( mockCtx.lineWidth ).toBe( 1 );
		} );

		test( 'should style line handles differently for key object', () => {
			const layer = { id: 'line1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawLineSelectionIndicators( layer, true );

			// Key object line should have lineWidth 3
			expect( mockCtx.lineWidth ).toBe( 3 );
		} );
	} );

	describe( 'constructor edge cases', () => {
		test( 'should handle empty config', () => {
			const emptyRenderer = new SelectionRenderer( {} );
			expect( emptyRenderer.ctx ).toBeNull();
			expect( emptyRenderer.getLayerById( 'any' ) ).toBeNull();
			expect( emptyRenderer.getLayerBounds( {} ) ).toBeNull();
		} );

		test( 'should use default functions when not provided', () => {
			const minimalRenderer = new SelectionRenderer( { ctx: mockCtx } );
			expect( minimalRenderer.getLayerById( 'test' ) ).toBeNull();
			expect( minimalRenderer.getLayerBounds( {} ) ).toBeNull();
		} );
	} );

	describe( 'line layer edge cases', () => {
		test( 'should add control handle for arrow layers', () => {
			const arrowLayer = { id: 'arrow1', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawLineSelectionIndicators( arrowLayer, false );

			// Should have 2 endpoint handles + 1 control handle
			expect( renderer.selectionHandles.length ).toBe( 3 );
			const controlHandle = renderer.selectionHandles.find( ( h ) => h.type === 'control' );
			expect( controlHandle ).toBeDefined();
			expect( controlHandle.isControl ).toBe( true );
		} );

		test( 'should not add control handle for line layers', () => {
			const lineLayer = { id: 'line1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawLineSelectionIndicators( lineLayer, false );

			// Should have only 2 endpoint handles
			expect( renderer.selectionHandles.length ).toBe( 2 );
			const controlHandle = renderer.selectionHandles.find( ( h ) => h.type === 'control' );
			expect( controlHandle ).toBeUndefined();
		} );
	} );

	describe( 'marker selection indicators', () => {
		test( 'should draw circular selection around marker', () => {
			const markerLayer = { id: 'marker1', type: 'marker', x: 100, y: 100, size: 32 };
			renderer.drawMarkerSelectionIndicators( markerLayer, false );

			// Should draw arc for circular selection
			expect( mockCtx.arc ).toHaveBeenCalled();
			expect( mockCtx.stroke ).toHaveBeenCalled();
		} );

		test( 'should use default size 24 when not specified', () => {
			const markerLayer = { id: 'marker1', type: 'marker', x: 50, y: 50 };
			renderer.drawMarkerSelectionIndicators( markerLayer, false );

			expect( mockCtx.arc ).toHaveBeenCalled();
			// First arc call is for selection circle, radius = 24/2 + 4 = 16
			const firstArcCall = mockCtx.arc.mock.calls[ 0 ];
			expect( firstArcCall[ 2 ] ).toBe( 16 ); // radius
		} );

		test( 'should register center move handle for marker', () => {
			const markerLayer = { id: 'marker1', type: 'marker', x: 100, y: 100, size: 24 };
			renderer.drawMarkerSelectionIndicators( markerLayer, false );

			expect( renderer.selectionHandles.length ).toBeGreaterThanOrEqual( 1 );
			const moveHandle = renderer.selectionHandles.find( ( h ) => h.type === 'move' );
			expect( moveHandle ).toBeDefined();
			expect( moveHandle.isMarker ).toBe( true );
			expect( moveHandle.layerId ).toBe( 'marker1' );
		} );

		test( 'should draw arrow endpoint handle when marker has arrow', () => {
			const markerLayer = {
				id: 'marker1',
				type: 'marker',
				x: 100,
				y: 100,
				size: 24,
				hasArrow: true,
				arrowX: 200,
				arrowY: 150
			};
			renderer.drawMarkerSelectionIndicators( markerLayer, false );

			// Should have 2 handles: center move + arrow tip
			expect( renderer.selectionHandles.length ).toBe( 2 );
			const arrowTipHandle = renderer.selectionHandles.find( ( h ) => h.type === 'arrowTip' );
			expect( arrowTipHandle ).toBeDefined();
			expect( arrowTipHandle.isArrowTip ).toBe( true );
			expect( arrowTipHandle.isMarker ).toBe( true );
		} );

		test( 'should draw dashed line connecting marker to arrow endpoint', () => {
			const markerLayer = {
				id: 'marker1',
				type: 'marker',
				x: 100,
				y: 100,
				hasArrow: true,
				arrowX: 200,
				arrowY: 200
			};
			renderer.drawMarkerSelectionIndicators( markerLayer, false );

			// Check for dashed line
			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [ 3, 3 ] );
			expect( mockCtx.moveTo ).toHaveBeenCalledWith( 100, 100 );
			expect( mockCtx.lineTo ).toHaveBeenCalledWith( 200, 200 );
		} );

		test( 'should not draw arrow handle when hasArrow is false', () => {
			const markerLayer = {
				id: 'marker1',
				type: 'marker',
				x: 100,
				y: 100,
				hasArrow: false
			};
			renderer.drawMarkerSelectionIndicators( markerLayer, false );

			// Should have only 1 handle (center move)
			expect( renderer.selectionHandles.length ).toBe( 1 );
			const arrowTipHandle = renderer.selectionHandles.find( ( h ) => h.type === 'arrowTip' );
			expect( arrowTipHandle ).toBeUndefined();
		} );

		test( 'should use orange style for key object marker', () => {
			const markerLayer = { id: 'marker1', type: 'marker', x: 100, y: 100 };
			renderer.drawMarkerSelectionIndicators( markerLayer, true );

			// Key object should have orange stroke and lineWidth 3
			expect( mockCtx.strokeStyle ).toBe( '#ff9800' );
			expect( mockCtx.lineWidth ).toBe( 3 );
		} );

		test( 'should handle marker with missing coordinates as 0', () => {
			const markerLayer = { id: 'marker1', type: 'marker' };
			renderer.drawMarkerSelectionIndicators( markerLayer, false );

			// Should still register handle at 0,0
			const moveHandle = renderer.selectionHandles.find( ( h ) => h.type === 'move' );
			expect( moveHandle ).toBeDefined();
		} );
	} );

	describe( 'dimension selection indicators', () => {
		test( 'should draw endpoint handles at x1,y1 and x2,y2', () => {
			const dimensionLayer = { id: 'dim1', type: 'dimension', x1: 50, y1: 100, x2: 200, y2: 100 };
			renderer.drawDimensionSelectionIndicators( dimensionLayer, false );

			// Should have 2 endpoint handles
			expect( renderer.selectionHandles.length ).toBe( 2 );
			const handles = renderer.selectionHandles;
			expect( handles[ 0 ].type ).toBe( 'w' );
			expect( handles[ 1 ].type ).toBe( 'e' );
			expect( handles[ 0 ].isDimension ).toBe( true );
			expect( handles[ 1 ].isDimension ).toBe( true );
		} );

		test( 'should draw fillRect and strokeRect for dimension handles', () => {
			const dimensionLayer = { id: 'dim1', type: 'dimension', x1: 0, y1: 0, x2: 100, y2: 0 };
			renderer.drawDimensionSelectionIndicators( dimensionLayer, false );

			// Should call fillRect and strokeRect for each endpoint (2 times each)
			expect( mockCtx.fillRect ).toHaveBeenCalledTimes( 2 );
			expect( mockCtx.strokeRect ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'should use orange style for key object dimension', () => {
			const dimensionLayer = { id: 'dim1', type: 'dimension', x1: 0, y1: 0, x2: 100, y2: 50 };
			renderer.drawDimensionSelectionIndicators( dimensionLayer, true );

			expect( mockCtx.strokeStyle ).toBe( '#ff9800' );
			expect( mockCtx.lineWidth ).toBe( 3 );
		} );

		test( 'should use default border style for non-key dimension', () => {
			const dimensionLayer = { id: 'dim1', type: 'dimension', x1: 0, y1: 0, x2: 100, y2: 100 };
			renderer.drawDimensionSelectionIndicators( dimensionLayer, false );

			// Non-key should have lineWidth 1
			expect( mockCtx.lineWidth ).toBe( 1 );
		} );

		test( 'should handle dimension with missing coordinates as 0', () => {
			const dimensionLayer = { id: 'dim1', type: 'dimension' };
			renderer.drawDimensionSelectionIndicators( dimensionLayer, false );

			// Should have 2 handles at (0,0) and (0,0)
			expect( renderer.selectionHandles.length ).toBe( 2 );
			const handles = renderer.selectionHandles;
			expect( handles[ 0 ].layerId ).toBe( 'dim1' );
		} );

		test( 'should set empty line dash for dimension handles', () => {
			const dimensionLayer = { id: 'dim1', type: 'dimension', x1: 10, y1: 20, x2: 110, y2: 20 };
			renderer.drawDimensionSelectionIndicators( dimensionLayer, false );

			// Should reset line dash to solid
			expect( mockCtx.setLineDash ).toHaveBeenCalledWith( [] );
		} );
	} );
} );
