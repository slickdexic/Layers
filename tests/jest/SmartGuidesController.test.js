/**
 * SmartGuidesController Unit Tests
 *
 * Tests for the SmartGuidesController module which provides intelligent
 * snapping to object edges, centers, and visual guide lines.
 *
 * @since 1.1.7
 */

/* eslint-env jest */

const SmartGuidesController = require( '../../resources/ext.layers.editor/canvas/SmartGuidesController.js' );

describe( 'SmartGuidesController', () => {
	let controller;
	let mockCanvasManager;
	let mockLayers;

	beforeEach( () => {
		// Create mock canvas manager
		mockCanvasManager = {
			zoom: 1,
			panX: 0,
			panY: 0,
			selectionManager: {
				selectedLayerIds: []
			},
			getLayerBounds: jest.fn( ( layer ) => {
				if ( !layer ) {
					return null;
				}
				if ( layer.type === 'rectangle' ) {
					return {
						x: layer.x,
						y: layer.y,
						width: layer.width,
						height: layer.height
					};
				}
				if ( layer.type === 'circle' ) {
					const r = layer.radius || 0;
					return {
						x: layer.x - r,
						y: layer.y - r,
						width: r * 2,
						height: r * 2
					};
				}
				return null;
			} )
		};

		// Create sample layers for testing
		mockLayers = [
			{ id: 'layer1', type: 'rectangle', x: 100, y: 100, width: 100, height: 50, visible: true },
			{ id: 'layer2', type: 'rectangle', x: 300, y: 100, width: 100, height: 50, visible: true },
			{ id: 'layer3', type: 'rectangle', x: 100, y: 250, width: 100, height: 50, visible: true }
		];

		controller = new SmartGuidesController( mockCanvasManager );
	} );

	afterEach( () => {
		if ( controller ) {
			controller.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default values', () => {
			expect( controller ).toBeDefined();
			expect( controller.enabled ).toBe( false ); // Off by default - toggle with ';' key
			expect( controller.snapThreshold ).toBe( 8 );
			expect( controller.showGuides ).toBe( true );
		} );

		it( 'should store canvas manager reference', () => {
			expect( controller.manager ).toBe( mockCanvasManager );
		} );

		it( 'should initialize empty active guides', () => {
			expect( controller.activeGuides ).toEqual( [] );
		} );
	} );

	describe( 'setEnabled', () => {
		it( 'should enable smart guides', () => {
			controller.setEnabled( true );
			expect( controller.enabled ).toBe( true );
		} );

		it( 'should disable smart guides', () => {
			controller.setEnabled( false );
			expect( controller.enabled ).toBe( false );
		} );

		it( 'should clear guides when disabled', () => {
			controller.activeGuides = [ { type: 'vertical', x: 100 } ];
			controller.setEnabled( false );
			expect( controller.activeGuides ).toEqual( [] );
		} );

		it( 'should coerce to boolean', () => {
			controller.setEnabled( 1 );
			expect( controller.enabled ).toBe( true );
			controller.setEnabled( 0 );
			expect( controller.enabled ).toBe( false );
		} );
	} );

	describe( 'setSnapThreshold', () => {
		it( 'should update snap threshold', () => {
			controller.setSnapThreshold( 12 );
			expect( controller.snapThreshold ).toBe( 12 );
		} );

		it( 'should reject invalid values', () => {
			controller.setSnapThreshold( -5 );
			expect( controller.snapThreshold ).toBe( 8 ); // unchanged

			controller.setSnapThreshold( 0 );
			expect( controller.snapThreshold ).toBe( 8 ); // unchanged

			controller.setSnapThreshold( 'invalid' );
			expect( controller.snapThreshold ).toBe( 8 ); // unchanged
		} );
	} );

	describe( 'invalidateCache', () => {
		it( 'should clear snap points cache', () => {
			controller.snapPointsCache = { horizontal: [], vertical: [] };
			controller.cacheExcludedIds = 'layer1';
			controller.invalidateCache();
			expect( controller.snapPointsCache ).toBeNull();
			expect( controller.cacheExcludedIds ).toBeNull();
		} );
	} );

	describe( 'clearGuides', () => {
		it( 'should clear active guides', () => {
			controller.activeGuides = [ { type: 'vertical', x: 100 } ];
			controller.clearGuides();
			expect( controller.activeGuides ).toEqual( [] );
		} );
	} );

	describe( 'getLayerBounds', () => {
		it( 'should return null for null layer', () => {
			expect( controller.getLayerBounds( null ) ).toBeNull();
		} );

		it( 'should delegate to manager.getLayerBounds when available', () => {
			const expectedBounds = { x: 10, y: 20, width: 100, height: 50 };
			mockCanvasManager.getLayerBounds = jest.fn().mockReturnValue( expectedBounds );
			controller.manager = mockCanvasManager;

			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const bounds = controller.getLayerBounds( layer );

			expect( mockCanvasManager.getLayerBounds ).toHaveBeenCalledWith( layer );
			expect( bounds ).toEqual( expectedBounds );
		} );

		it( 'should fall back to calculateBounds when manager.getLayerBounds is not available', () => {
			// Ensure manager doesn't have getLayerBounds
			delete mockCanvasManager.getLayerBounds;
			controller.manager = mockCanvasManager;

			const layer = { type: 'rectangle', x: 10, y: 20, width: 100, height: 50 };
			const bounds = controller.getLayerBounds( layer );

			expect( bounds ).toEqual( { x: 10, y: 20, width: 100, height: 50 } );
		} );
	} );

	describe( 'calculateBounds', () => {
		it( 'should calculate bounds for rectangle', () => {
			const layer = { type: 'rectangle', x: 50, y: 50, width: 100, height: 80 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 50, y: 50, width: 100, height: 80 } );
		} );

		it( 'should calculate bounds for circle', () => {
			const layer = { type: 'circle', x: 100, y: 100, radius: 50 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 50, y: 50, width: 100, height: 100 } );
		} );

		it( 'should calculate bounds for ellipse', () => {
			const layer = { type: 'ellipse', x: 100, y: 100, radiusX: 60, radiusY: 40 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 40, y: 60, width: 120, height: 80 } );
		} );

		it( 'should calculate bounds for line', () => {
			const layer = { type: 'line', x1: 50, y1: 50, x2: 150, y2: 100 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 50, y: 50, width: 100, height: 50 } );
		} );

		it( 'should calculate bounds for polygon', () => {
			const layer = { type: 'polygon', x: 100, y: 100, radius: 50 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 50, y: 50, width: 100, height: 100 } );
		} );

		it( 'should calculate bounds for star', () => {
			const layer = { type: 'star', x: 100, y: 100, outerRadius: 60 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 40, y: 40, width: 120, height: 120 } );
		} );

		it( 'should calculate bounds for path', () => {
			const layer = {
				type: 'path',
				points: [
					{ x: 10, y: 20 },
					{ x: 100, y: 50 },
					{ x: 60, y: 80 }
				]
			};
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 10, y: 20, width: 90, height: 60 } );
		} );

		it( 'should return null for null layer', () => {
			expect( controller.calculateBounds( null ) ).toBeNull();
		} );

		it( 'should return null for unknown type', () => {
			expect( controller.calculateBounds( { type: 'unknown' } ) ).toBeNull();
		} );

		it( 'should calculate bounds for text layer', () => {
			const layer = { type: 'text', x: 50, y: 50, width: 200, fontSize: 24 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 50, y: 50, width: 200, height: 24 } );
		} );

		it( 'should use default values for text layer without width/fontSize', () => {
			const layer = { type: 'text' };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 0, y: 0, width: 100, height: 16 } );
		} );

		it( 'should calculate bounds for arrow layer like line', () => {
			const layer = { type: 'arrow', x1: 20, y1: 30, x2: 120, y2: 80 };
			const bounds = controller.calculateBounds( layer );
			expect( bounds ).toEqual( { x: 20, y: 30, width: 100, height: 50 } );
		} );

		it( 'should return null for path with no points', () => {
			const layer = { type: 'path', points: [] };
			expect( controller.calculateBounds( layer ) ).toBeNull();
		} );

		it( 'should return null for path without points array', () => {
			const layer = { type: 'path' };
			expect( controller.calculateBounds( layer ) ).toBeNull();
		} );
	} );

	describe( 'buildSnapPoints', () => {
		it( 'should build snap points from layers', () => {
			const snapPoints = controller.buildSnapPoints( mockLayers, [] );

			// Should have horizontal and vertical arrays
			expect( snapPoints.horizontal ).toBeDefined();
			expect( snapPoints.vertical ).toBeDefined();

			// Each layer contributes 3 horizontal (top, center, bottom) and 3 vertical (left, center, right)
			expect( snapPoints.horizontal.length ).toBe( 9 ); // 3 layers * 3
			expect( snapPoints.vertical.length ).toBe( 9 ); // 3 layers * 3
		} );

		it( 'should exclude specified layer IDs', () => {
			const snapPoints = controller.buildSnapPoints( mockLayers, [ 'layer1' ] );

			// Should only have points from layer2 and layer3
			expect( snapPoints.horizontal.length ).toBe( 6 ); // 2 layers * 3
			expect( snapPoints.vertical.length ).toBe( 6 ); // 2 layers * 3
		} );

		it( 'should skip invisible layers', () => {
			mockLayers[ 0 ].visible = false;
			const snapPoints = controller.buildSnapPoints( mockLayers, [] );

			expect( snapPoints.horizontal.length ).toBe( 6 ); // 2 visible layers * 3
			expect( snapPoints.vertical.length ).toBe( 6 );
		} );

		it( 'should cache results', () => {
			const snapPoints1 = controller.buildSnapPoints( mockLayers, [ 'layer1' ] );
			const snapPoints2 = controller.buildSnapPoints( mockLayers, [ 'layer1' ] );

			expect( snapPoints1 ).toBe( snapPoints2 ); // Same reference (cached)
		} );

		it( 'should return empty arrays for empty layers', () => {
			const snapPoints = controller.buildSnapPoints( [], [] );
			expect( snapPoints.horizontal ).toEqual( [] );
			expect( snapPoints.vertical ).toEqual( [] );
		} );
	} );

	describe( 'findNearestSnap', () => {
		it( 'should find nearest snap point within threshold', () => {
			const snapPoints = [
				{ value: 100, type: 'edge', layerId: 'layer1' },
				{ value: 200, type: 'center', layerId: 'layer2' }
			];

			const result = controller.findNearestSnap( 105, snapPoints );
			expect( result ).not.toBeNull();
			expect( result.value ).toBe( 100 );
		} );

		it( 'should return null when no snap point within threshold', () => {
			const snapPoints = [
				{ value: 100, type: 'edge', layerId: 'layer1' }
			];

			const result = controller.findNearestSnap( 120, snapPoints ); // 20px away
			expect( result ).toBeNull();
		} );

		it( 'should return closest snap when multiple within threshold', () => {
			const snapPoints = [
				{ value: 100, type: 'edge', layerId: 'layer1' },
				{ value: 105, type: 'edge', layerId: 'layer2' }
			];

			const result = controller.findNearestSnap( 103, snapPoints );
			expect( result.value ).toBe( 105 ); // Closer to 103
		} );
	} );

	describe( 'calculateSnappedPosition', () => {
		beforeEach( () => {
			// Enable smart guides for snapping tests
			controller.setEnabled( true );
		} );

		it( 'should return original position when disabled', () => {
			controller.setEnabled( false );
			const result = controller.calculateSnappedPosition(
				mockLayers[ 0 ], 100, 100, mockLayers
			);
			expect( result.x ).toBe( 100 );
			expect( result.y ).toBe( 100 );
			expect( result.snappedX ).toBe( false );
			expect( result.snappedY ).toBe( false );
		} );

		it( 'should snap to left edge of another layer', () => {
			// layer2 left edge is at x=300
			// If we position layer1's right edge (100+100=200) near 300, it should snap
			const layer = { id: 'layer1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50 };
			const result = controller.calculateSnappedPosition(
				layer, 203, 100, mockLayers // right edge at 303, should snap to 300
			);

			// Right edge (203+100=303) should snap to layer2's left (300)
			expect( result.snappedX ).toBe( true );
			expect( result.x ).toBe( 200 ); // 200+100=300 (right edge aligned)
		} );

		it( 'should snap to top edge of another layer', () => {
			// layer2 top edge is at y=100
			const layer = { id: 'layer1', type: 'rectangle', x: 50, y: 0, width: 100, height: 50 };
			const result = controller.calculateSnappedPosition(
				layer, 50, 98, mockLayers // top at 98, should snap to 100
			);

			expect( result.snappedY ).toBe( true );
			expect( result.y ).toBe( 100 );
		} );

		it( 'should generate guide objects when snapping', () => {
			const layer = { id: 'layer1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50 };
			const result = controller.calculateSnappedPosition(
				layer, 100, 100, mockLayers
			);

			// Should have at least some guides if snapping occurred
			expect( Array.isArray( result.guides ) ).toBe( true );
		} );

		it( 'should update activeGuides property', () => {
			const layer = { id: 'layer1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50 };
			controller.calculateSnappedPosition( layer, 100, 100, mockLayers );

			expect( controller.activeGuides ).toBeDefined();
			expect( Array.isArray( controller.activeGuides ) ).toBe( true );
		} );
	} );

	describe( 'renderGuides', () => {
		let mockCtx;

		beforeEach( () => {
			mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				beginPath: jest.fn(),
				moveTo: jest.fn(),
				lineTo: jest.fn(),
				stroke: jest.fn(),
				setLineDash: jest.fn(),
				strokeStyle: '',
				lineWidth: 1,
				canvas: { width: 800, height: 600 }
			};
		} );

		it( 'should not render when no active guides', () => {
			controller.activeGuides = [];
			controller.renderGuides( mockCtx, 1, 0, 0 );
			expect( mockCtx.beginPath ).not.toHaveBeenCalled();
		} );

		it( 'should not render when showGuides is false', () => {
			controller.showGuides = false;
			controller.activeGuides = [ { type: 'vertical', x: 100 } ];
			controller.renderGuides( mockCtx, 1, 0, 0 );
			expect( mockCtx.beginPath ).not.toHaveBeenCalled();
		} );

		it( 'should render vertical guide', () => {
			controller.activeGuides = [ { type: 'vertical', x: 100, isCenter: false } ];
			controller.renderGuides( mockCtx, 1, 0, 0 );

			expect( mockCtx.save ).toHaveBeenCalled();
			expect( mockCtx.beginPath ).toHaveBeenCalled();
			expect( mockCtx.moveTo ).toHaveBeenCalledWith( 100, 0 );
			expect( mockCtx.lineTo ).toHaveBeenCalledWith( 100, 600 );
			expect( mockCtx.stroke ).toHaveBeenCalled();
			expect( mockCtx.restore ).toHaveBeenCalled();
		} );

		it( 'should render horizontal guide', () => {
			controller.activeGuides = [ { type: 'horizontal', y: 200, isCenter: false } ];
			controller.renderGuides( mockCtx, 1, 0, 0 );

			expect( mockCtx.moveTo ).toHaveBeenCalledWith( 0, 200 );
			expect( mockCtx.lineTo ).toHaveBeenCalledWith( 800, 200 );
		} );

		it( 'should apply zoom and pan', () => {
			controller.activeGuides = [ { type: 'vertical', x: 100, isCenter: false } ];
			controller.renderGuides( mockCtx, 2, 50, 0 ); // zoom=2, panX=50

			// screenX = 100 * 2 + 50 = 250
			expect( mockCtx.moveTo ).toHaveBeenCalledWith( 250, 0 );
		} );

		it( 'should use different style for center guides', () => {
			controller.activeGuides = [ { type: 'vertical', x: 100, isCenter: true } ];
			controller.renderGuides( mockCtx, 1, 0, 0 );

			expect( mockCtx.strokeStyle ).toBe( controller.centerGuideColor );
		} );
	} );

	describe( 'render', () => {
		it( 'should call renderGuides with manager zoom/pan', () => {
			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				beginPath: jest.fn(),
				moveTo: jest.fn(),
				lineTo: jest.fn(),
				stroke: jest.fn(),
				setLineDash: jest.fn(),
				strokeStyle: '',
				lineWidth: 1,
				canvas: { width: 800, height: 600 }
			};

			mockCanvasManager.zoom = 1.5;
			mockCanvasManager.panX = 20;
			mockCanvasManager.panY = 30;
			controller.activeGuides = [ { type: 'vertical', x: 100, isCenter: false } ];

			controller.render( mockCtx );

			// Should apply manager's zoom/pan
			const expectedScreenX = 100 * 1.5 + 20; // 170
			expect( mockCtx.moveTo ).toHaveBeenCalledWith( expectedScreenX, 0 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			controller.destroy();
			expect( controller.manager ).toBeNull();
			expect( controller.activeGuides ).toEqual( [] );
			expect( controller.snapPointsCache ).toBeNull();
		} );
	} );

	describe( 'integration - snap to alignment', () => {
		beforeEach( () => {
			// Enable smart guides for integration tests
			controller.setEnabled( true );
		} );

		it( 'should snap layer left to another layer left', () => {
			// layer2 is at x=300
			const layer = { id: 'dragged', type: 'rectangle', x: 0, y: 200, width: 80, height: 40 };
			const result = controller.calculateSnappedPosition(
				layer, 303, 200, mockLayers // left at 303, should snap to 300
			);

			expect( result.snappedX ).toBe( true );
			expect( result.x ).toBe( 300 ); // Aligned with layer2's left edge
		} );

		it( 'should snap layer center to another layer center', () => {
			// layer1 center is at x=150 (100+100/2)
			const layer = { id: 'dragged', type: 'rectangle', x: 0, y: 200, width: 100, height: 40 };
			const result = controller.calculateSnappedPosition(
				layer, 103, 200, mockLayers // center at 153, should snap to 150
			);

			expect( result.snappedX ).toBe( true );
			// Center should be at 150, so x = 150 - 50 = 100
			expect( result.x ).toBe( 100 );
		} );
	} );
} );
