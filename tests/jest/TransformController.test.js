/**
 * Tests for TransformController.js
 *
 * TransformController handles resize, rotation, and drag operations for layers.
 */

const TransformController = require( '../../resources/ext.layers.editor/canvas/TransformController.js' );
const ResizeCalculator = require( '../../resources/ext.layers.editor/canvas/ResizeCalculator.js' );

// Set up ResizeCalculator in global namespace for TransformController to find
global.window = global.window || {};
global.window.Layers = global.window.Layers || {};
global.window.Layers.Canvas = global.window.Layers.Canvas || {};
global.window.Layers.Canvas.ResizeCalculator = ResizeCalculator;

// Mock requestAnimationFrame to execute callbacks synchronously for testing
global.window.requestAnimationFrame = ( callback ) => {
	callback();
	return 0;
};

describe( 'TransformController', () => {
	let controller;
	let mockManager;
	let mockEditor;
	let mockCanvas;
	let testLayer;

	beforeEach( () => {
		// Create mock canvas
		mockCanvas = {
			style: { cursor: 'default' }
		};

		// Create test layer
		testLayer = {
			id: 'layer1',
			type: 'rectangle',
			x: 100,
			y: 100,
			width: 200,
			height: 150,
			rotation: 0
		};

		// Create mock editor
		mockEditor = {
			layers: [ testLayer ],
			getLayerById: jest.fn( ( id ) => {
				return mockEditor.layers.find( ( l ) => l.id === id );
			} ),
			markDirty: jest.fn(),
			container: document.createElement( 'div' )
		};

		// Create mock manager
		mockManager = {
			canvas: mockCanvas,
			editor: mockEditor,
			selectedLayerId: 'layer1',
			selectedLayerIds: [ 'layer1' ],
			currentTool: 'select',
			snapToGrid: false,
			gridSize: 10,
			container: document.createElement( 'div' ),
			getToolCursor: jest.fn( () => 'default' ),
			renderLayers: jest.fn(),
			getSelectedLayerId: jest.fn( function () {
				return this.selectedLayerId;
			} ),
			getSelectedLayerIds: jest.fn( function () {
				return this.selectedLayerIds || [];
			} ),
			getLayerBounds: jest.fn( ( layer ) => ( {
				centerX: layer.x + ( layer.width || 0 ) / 2,
				centerY: layer.y + ( layer.height || 0 ) / 2,
				width: layer.width || 100,
				height: layer.height || 100
			} ) ),
			snapPointToGrid: jest.fn( ( point ) => ( {
				x: Math.round( point.x / 10 ) * 10,
				y: Math.round( point.y / 10 ) * 10
			} ) )
		};

		controller = new TransformController( mockManager );
	} );

	describe( 'constructor', () => {
		it( 'should initialize with correct defaults', () => {
			expect( controller.manager ).toBe( mockManager );
			expect( controller.isResizing ).toBe( false );
			expect( controller.isRotating ).toBe( false );
			expect( controller.isDragging ).toBe( false );
			expect( controller.resizeHandle ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( controller.originalLayerState ).toBeNull();
			expect( controller.originalMultiLayerStates ).toBeNull();
			expect( controller.showDragPreview ).toBe( false );
		} );
	} );

	// ==================== Resize Operations ====================

	describe( 'startResize', () => {
		it( 'should initialize resize state', () => {
			const handle = { type: 'se' };
			const startPoint = { x: 300, y: 250 };

			controller.startResize( handle, startPoint );

			expect( controller.isResizing ).toBe( true );
			expect( controller.resizeHandle ).toBe( handle );
			expect( controller.dragStartPoint ).toBe( startPoint );
			expect( controller.originalLayerState ).toEqual( testLayer );
		} );

		it( 'should set appropriate resize cursor', () => {
			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );
			expect( mockCanvas.style.cursor ).toBe( 'nwse-resize' );
		} );

		it( 'should handle missing layer gracefully', () => {
			mockManager.selectedLayerId = 'nonexistent';
			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );
			expect( controller.originalLayerState ).toBeNull();
		} );
	} );

	describe( 'handleResize', () => {
		beforeEach( () => {
			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );
		} );

		it( 'should update layer dimensions on resize', () => {
			controller.handleResize( { x: 350, y: 300 }, {} );

			expect( testLayer.width ).toBe( 250 ); // 200 + 50
			expect( testLayer.height ).toBe( 200 ); // 150 + 50
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should maintain proportions with shift key', () => {
			controller.handleResize( { x: 400, y: 250 }, { shiftKey: true } );

			// With proportional scaling, the larger delta determines both
			expect( testLayer.width ).toBeGreaterThan( 200 );
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should do nothing if layer not found', () => {
			mockManager.selectedLayerId = 'nonexistent';
			controller.handleResize( { x: 350, y: 300 }, {} );
			// Should not throw
			expect( mockManager.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should limit delta values to prevent jumps', () => {
			// Simulate a huge jump
			controller.handleResize( { x: 5000, y: 5000 }, {} );

			// Width and height should be capped
			expect( testLayer.width ).toBeLessThanOrEqual( 1200 ); // 200 + max 1000
			expect( testLayer.height ).toBeLessThanOrEqual( 1150 ); // 150 + max 1000
		} );
	} );

	describe( 'finishResize', () => {
		it( 'should reset resize state', () => {
			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );
			controller.finishResize();

			expect( controller.isResizing ).toBe( false );
			expect( controller.resizeHandle ).toBeNull();
			expect( controller.originalLayerState ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );
	} );

	describe( 'getResizeCursor', () => {
		it( 'should return correct cursor for unrotated handles', () => {
			// Diagonal handles use nwse-resize or nesw-resize
			expect( controller.getResizeCursor( 'nw', 0 ) ).toBe( 'nwse-resize' );
			expect( controller.getResizeCursor( 'se', 0 ) ).toBe( 'nwse-resize' );
			expect( controller.getResizeCursor( 'ne', 0 ) ).toBe( 'nesw-resize' );
			expect( controller.getResizeCursor( 'sw', 0 ) ).toBe( 'nesw-resize' );
			// Edge handles use ns-resize or ew-resize
			expect( controller.getResizeCursor( 'n', 0 ) ).toBe( 'ns-resize' );
			expect( controller.getResizeCursor( 's', 0 ) ).toBe( 'ns-resize' );
			expect( controller.getResizeCursor( 'e', 0 ) ).toBe( 'ew-resize' );
			expect( controller.getResizeCursor( 'w', 0 ) ).toBe( 'ew-resize' );
		} );

		it( 'should return default for unknown handle type', () => {
			expect( controller.getResizeCursor( 'unknown', 0 ) ).toBe( 'default' );
		} );

		it( 'should adjust cursor for rotated layers', () => {
			// At 45° rotation, n handle should become nesw-resize (diagonal)
			expect( controller.getResizeCursor( 'n', 45 ) ).toBe( 'nesw-resize' );
			// At 90° rotation, n handle should become ew-resize (horizontal)
			expect( controller.getResizeCursor( 'n', 90 ) ).toBe( 'ew-resize' );
			// At 45° rotation, e handle should become nwse-resize
			expect( controller.getResizeCursor( 'e', 45 ) ).toBe( 'nwse-resize' );
		} );

		it( 'should handle negative rotations', () => {
			// -45° is same as 315°, so n handle becomes nwse-resize
			expect( controller.getResizeCursor( 'n', -45 ) ).toBe( 'nwse-resize' );
			// -90° is same as 270°, so n handle becomes ew-resize
			expect( controller.getResizeCursor( 'n', -90 ) ).toBe( 'ew-resize' );
		} );
	} );

	describe( 'calculateResize', () => {
		it( 'should dispatch to rectangle resize for rectangles', () => {
			const result = controller.calculateResize(
				{ type: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
				'se', 10, 10, {}
			);
			expect( result.width ).toBe( 110 );
			expect( result.height ).toBe( 110 );
		} );

		it( 'should dispatch to circle resize for circles', () => {
			const result = controller.calculateResize(
				{ type: 'circle', x: 50, y: 50, radius: 50 },
				'e', 10, 0, {}
			);
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should dispatch to ellipse resize for ellipses', () => {
			const result = controller.calculateResize(
				{ type: 'ellipse', x: 50, y: 50, radiusX: 50, radiusY: 30 },
				'e', 10, 0, {}
			);
			expect( result.radiusX ).toBe( 60 );
		} );

		it( 'should dispatch to polygon resize for polygons', () => {
			const result = controller.calculateResize(
				{ type: 'polygon', x: 50, y: 50, radius: 50 },
				'e', 10, 0, {}
			);
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should dispatch to star resize for stars', () => {
			const result = controller.calculateResize(
				{ type: 'star', x: 50, y: 50, radius: 50 },
				'e', 10, 0, {}
			);
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should dispatch to line resize for lines', () => {
			const result = controller.calculateResize(
				{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 },
				'se', 10, 10, {}
			);
			expect( result.x2 ).toBe( 110 );
			expect( result.y2 ).toBe( 110 );
		} );

		it( 'should dispatch to line resize for arrows', () => {
			const result = controller.calculateResize(
				{ type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 },
				'se', 10, 10, {}
			);
			expect( result.x2 ).toBe( 110 );
		} );

		it( 'should dispatch to path resize for paths', () => {
			const result = controller.calculateResize(
				{ type: 'path', points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ] },
				'se', 10, 10, {}
			);
			expect( result.points ).toBeDefined();
			expect( result.points.length ).toBe( 2 );
		} );

		it( 'should dispatch to text resize for text', () => {
			const result = controller.calculateResize(
				{ type: 'text', x: 0, y: 0, fontSize: 16 },
				'se', 10, 10, {}
			);
			expect( result.fontSize ).toBeGreaterThan( 16 );
		} );

		it( 'should dispatch to rectangle resize for textbox', () => {
			const result = controller.calculateResize(
				{ type: 'textbox', x: 0, y: 0, width: 100, height: 100 },
				'se', 10, 10, {}
			);
			expect( result.width ).toBe( 110 );
		} );

		it( 'should return null for unknown layer type', () => {
			const result = controller.calculateResize(
				{ type: 'unknown', x: 0, y: 0 },
				'se', 10, 10, {}
			);
			expect( result ).toBeNull();
		} );
	} );

	describe( 'calculateRectangleResize', () => {
		const originalRect = { type: 'rectangle', x: 100, y: 100, width: 200, height: 150 };

		it( 'should resize from se handle', () => {
			const result = controller.calculateRectangleResize( originalRect, 'se', 50, 30, {} );
			expect( result.width ).toBe( 250 );
			expect( result.height ).toBe( 180 );
		} );

		it( 'should resize from nw handle', () => {
			const result = controller.calculateRectangleResize( originalRect, 'nw', -20, -10, {} );
			expect( result.x ).toBe( 80 );
			expect( result.y ).toBe( 90 );
			expect( result.width ).toBe( 220 );
			expect( result.height ).toBe( 160 );
		} );

		it( 'should resize from ne handle', () => {
			const result = controller.calculateRectangleResize( originalRect, 'ne', 50, -30, {} );
			expect( result.y ).toBe( 70 );
			expect( result.width ).toBe( 250 );
			expect( result.height ).toBe( 180 );
		} );

		it( 'should resize from sw handle', () => {
			const result = controller.calculateRectangleResize( originalRect, 'sw', -50, 30, {} );
			expect( result.x ).toBe( 50 );
			expect( result.width ).toBe( 250 );
			expect( result.height ).toBe( 180 );
		} );

		it( 'should resize from n handle (vertical only)', () => {
			const result = controller.calculateRectangleResize( originalRect, 'n', 0, -30, {} );
			expect( result.y ).toBe( 70 );
			expect( result.height ).toBe( 180 );
			expect( result.x ).toBeUndefined();
			expect( result.width ).toBeUndefined();
		} );

		it( 'should resize from s handle (vertical only)', () => {
			const result = controller.calculateRectangleResize( originalRect, 's', 0, 30, {} );
			expect( result.height ).toBe( 180 );
			expect( result.y ).toBeUndefined();
		} );

		it( 'should resize from e handle (horizontal only)', () => {
			const result = controller.calculateRectangleResize( originalRect, 'e', 50, 0, {} );
			expect( result.width ).toBe( 250 );
			expect( result.x ).toBeUndefined();
		} );

		it( 'should resize from w handle (horizontal only)', () => {
			const result = controller.calculateRectangleResize( originalRect, 'w', -50, 0, {} );
			expect( result.x ).toBe( 50 );
			expect( result.width ).toBe( 250 );
		} );

		it( 'should maintain proportions with shift key', () => {
			const result = controller.calculateRectangleResize(
				originalRect, 'se', 100, 10, { proportional: true }
			);
			// The larger delta should determine both dimensions proportionally
			expect( result.width ).toBeGreaterThan( 200 );
			expect( result.height ).toBeGreaterThan( 150 );
		} );

		it( 'should resize from center with alt key', () => {
			const result = controller.calculateRectangleResize(
				originalRect, 'se', 50, 30, { fromCenter: true }
			);
			// Center should move to accommodate symmetric resize
			expect( result.x ).toBeDefined();
			expect( result.y ).toBeDefined();
		} );

		it( 'should enforce minimum size constraint', () => {
			const result = controller.calculateRectangleResize(
				originalRect, 'nw', 300, 300, {}
			);
			expect( result.width ).toBeGreaterThanOrEqual( 5 );
			expect( result.height ).toBeGreaterThanOrEqual( 5 );
		} );

		it( 'should limit coordinate values to safe range', () => {
			const result = controller.calculateRectangleResize(
				originalRect, 'nw', -20000, -20000, {}
			);
			expect( result.x ).toBeGreaterThanOrEqual( -10000 );
			expect( result.y ).toBeGreaterThanOrEqual( -10000 );
		} );
	} );

	describe( 'calculateCircleResize', () => {
		const originalCircle = { type: 'circle', x: 100, y: 100, radius: 50 };

		it( 'should resize from e handle', () => {
			const result = controller.calculateCircleResize( originalCircle, 'e', 20, 0 );
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should resize from w handle', () => {
			const result = controller.calculateCircleResize( originalCircle, 'w', -20, 0 );
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should resize from n handle', () => {
			const result = controller.calculateCircleResize( originalCircle, 'n', 0, -20 );
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should resize from s handle', () => {
			const result = controller.calculateCircleResize( originalCircle, 's', 0, 20 );
			expect( result.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should resize from diagonal handles', () => {
			const resultNE = controller.calculateCircleResize( originalCircle, 'ne', 10, -10 );
			const resultNW = controller.calculateCircleResize( originalCircle, 'nw', -10, -10 );
			const resultSE = controller.calculateCircleResize( originalCircle, 'se', 10, 10 );
			const resultSW = controller.calculateCircleResize( originalCircle, 'sw', -10, 10 );

			expect( resultNE.radius ).toBeDefined();
			expect( resultNW.radius ).toBeDefined();
			expect( resultSE.radius ).toBeDefined();
			expect( resultSW.radius ).toBeDefined();
		} );

		it( 'should enforce minimum radius', () => {
			const result = controller.calculateCircleResize( originalCircle, 'e', -100, 0 );
			expect( result.radius ).toBeGreaterThanOrEqual( 5 );
		} );

		it( 'should return null for unknown handle', () => {
			const result = controller.calculateCircleResize( originalCircle, 'unknown', 10, 10 );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'calculateEllipseResize', () => {
		const originalEllipse = { type: 'ellipse', x: 100, y: 100, radiusX: 60, radiusY: 40 };

		it( 'should resize radiusX from e handle', () => {
			const result = controller.calculateEllipseResize( originalEllipse, 'e', 20, 0 );
			expect( result.radiusX ).toBe( 80 );
			expect( result.radiusY ).toBeUndefined();
		} );

		it( 'should resize radiusX from w handle', () => {
			const result = controller.calculateEllipseResize( originalEllipse, 'w', -20, 0 );
			expect( result.radiusX ).toBe( 80 );
		} );

		it( 'should resize radiusY from s handle', () => {
			const result = controller.calculateEllipseResize( originalEllipse, 's', 0, 20 );
			expect( result.radiusY ).toBe( 60 );
			expect( result.radiusX ).toBeUndefined();
		} );

		it( 'should resize radiusY from n handle', () => {
			const result = controller.calculateEllipseResize( originalEllipse, 'n', 0, -20 );
			expect( result.radiusY ).toBe( 60 );
		} );

		it( 'should enforce minimum radius', () => {
			const result = controller.calculateEllipseResize( originalEllipse, 'e', -100, 0 );
			expect( result.radiusX ).toBeGreaterThanOrEqual( 5 );
		} );
	} );

	describe( 'calculatePolygonResize', () => {
		const originalPolygon = { type: 'polygon', x: 100, y: 100, radius: 50 };

		it( 'should grow polygon from e handle with positive delta', () => {
			const result = controller.calculatePolygonResize( originalPolygon, 'e', 20, 0 );
			expect( result.radius ).toBe( 70 ); // 50 + 20
		} );

		it( 'should shrink polygon from e handle with negative delta', () => {
			const result = controller.calculatePolygonResize( originalPolygon, 'e', -10, 0 );
			expect( result.radius ).toBe( 40 ); // 50 - 10
		} );

		it( 'should grow polygon from w handle with negative delta', () => {
			const result = controller.calculatePolygonResize( originalPolygon, 'w', -20, 0 );
			expect( result.radius ).toBe( 70 );
		} );

		it( 'should grow polygon from n handle with negative delta', () => {
			const result = controller.calculatePolygonResize( originalPolygon, 'n', 0, -20 );
			expect( result.radius ).toBe( 70 );
		} );

		it( 'should grow polygon from s handle with positive delta', () => {
			const result = controller.calculatePolygonResize( originalPolygon, 's', 0, 20 );
			expect( result.radius ).toBe( 70 );
		} );

		it( 'should handle diagonal handles', () => {
			const resultNE = controller.calculatePolygonResize( originalPolygon, 'ne', 15, -15 );
			const resultNW = controller.calculatePolygonResize( originalPolygon, 'nw', -15, -15 );
			const resultSE = controller.calculatePolygonResize( originalPolygon, 'se', 15, 15 );
			const resultSW = controller.calculatePolygonResize( originalPolygon, 'sw', -15, 15 );

			expect( resultNE.radius ).toBeGreaterThan( 50 );
			expect( resultNW.radius ).toBeGreaterThan( 50 );
			expect( resultSE.radius ).toBeGreaterThan( 50 );
			expect( resultSW.radius ).toBeGreaterThan( 50 );
		} );

		it( 'should enforce minimum radius of 10', () => {
			const result = controller.calculatePolygonResize( originalPolygon, 'e', -100, 0 );
			expect( result.radius ).toBeGreaterThanOrEqual( 10 );
		} );
	} );

	describe( 'calculateLineResize', () => {
		const originalLine = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };

		it( 'should move end point with e handle', () => {
			const result = controller.calculateLineResize( originalLine, 'e', 25, 30 );
			expect( result.x2 ).toBe( 125 );
			expect( result.y2 ).toBe( 130 );
			expect( result.x1 ).toBeUndefined();
			expect( result.y1 ).toBeUndefined();
		} );

		it( 'should move start point with w handle', () => {
			const result = controller.calculateLineResize( originalLine, 'w', 15, 20 );
			expect( result.x1 ).toBe( 15 );
			expect( result.y1 ).toBe( 20 );
			expect( result.x2 ).toBeUndefined();
			expect( result.y2 ).toBeUndefined();
		} );

		it( 'should handle negative deltas for end point', () => {
			const result = controller.calculateLineResize( originalLine, 'e', -20, -30 );
			expect( result.x2 ).toBe( 80 );
			expect( result.y2 ).toBe( 70 );
		} );

		it( 'should handle negative deltas for start point', () => {
			const result = controller.calculateLineResize( originalLine, 'w', -10, -15 );
			expect( result.x1 ).toBe( -10 );
			expect( result.y1 ).toBe( -15 );
		} );

		it( 'should fallback to end point for unknown handle', () => {
			const result = controller.calculateLineResize( originalLine, 'se', 25, 30 );
			expect( result.x2 ).toBe( 125 );
			expect( result.y2 ).toBe( 130 );
		} );
	} );

	describe( 'calculatePathResize', () => {
		const originalPath = {
			type: 'path',
			points: [
				{ x: 0, y: 0 },
				{ x: 50, y: 25 },
				{ x: 100, y: 100 }
			]
		};

		it( 'should scale all points', () => {
			const result = controller.calculatePathResize( originalPath, 'se', 10, 10 );
			expect( result.points ).toHaveLength( 3 );
			// Scale is 1 + delta/100 = 1.1 for both x and y
			expect( result.points[ 2 ].x ).toBeCloseTo( 110, 0 );
			expect( result.points[ 2 ].y ).toBeCloseTo( 110, 0 );
		} );

		it( 'should return null if no points', () => {
			const result = controller.calculatePathResize( { type: 'path' }, 'se', 10, 10 );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'calculateTextResize', () => {
		const originalText = { type: 'text', x: 50, y: 50, fontSize: 24 };

		it( 'should increase font size when growing from se', () => {
			const result = controller.calculateTextResize( originalText, 'se', 50, 50 );
			expect( result.fontSize ).toBeGreaterThan( 24 );
		} );

		it( 'should decrease font size when shrinking from se', () => {
			const result = controller.calculateTextResize( originalText, 'se', -30, -30 );
			expect( result.fontSize ).toBeLessThan( 24 );
		} );

		it( 'should increase font size when shrinking from nw (opposite direction)', () => {
			const result = controller.calculateTextResize( originalText, 'nw', -50, -50 );
			expect( result.fontSize ).toBeGreaterThan( 24 );
		} );

		it( 'should clamp font size to minimum 6', () => {
			const result = controller.calculateTextResize( originalText, 'se', -500, -500 );
			expect( result.fontSize ).toBeGreaterThanOrEqual( 6 );
		} );

		it( 'should clamp font size to maximum 500', () => {
			const result = controller.calculateTextResize( originalText, 'se', 5000, 5000 );
			expect( result.fontSize ).toBeLessThanOrEqual( 500 );
		} );

		it( 'should handle different handle types', () => {
			const resultE = controller.calculateTextResize( originalText, 'e', 30, 0 );
			const resultN = controller.calculateTextResize( originalText, 'n', 0, -30 );
			const resultNE = controller.calculateTextResize( originalText, 'ne', 30, -30 );
			const resultSW = controller.calculateTextResize( originalText, 'sw', -30, 30 );

			expect( resultE.fontSize ).toBeDefined();
			expect( resultN.fontSize ).toBeDefined();
			expect( resultNE.fontSize ).toBeDefined();
			expect( resultSW.fontSize ).toBeDefined();
		} );
	} );

	// ==================== Rotation Operations ====================

	describe( 'startRotation', () => {
		it( 'should initialize rotation state', () => {
			const startPoint = { x: 350, y: 100 };

			controller.startRotation( startPoint );

			expect( controller.isRotating ).toBe( true );
			expect( controller.dragStartPoint ).toBe( startPoint );
			expect( mockCanvas.style.cursor ).toBe( 'grabbing' );
			expect( controller.originalLayerState ).toEqual( testLayer );
		} );

		it( 'should handle null point', () => {
			controller.startRotation( null );

			expect( controller.isRotating ).toBe( true );
			expect( controller.dragStartPoint ).toBeNull();
		} );
	} );

	describe( 'handleRotation', () => {
		beforeEach( () => {
			controller.startRotation( { x: 300, y: 100 } );
		} );

		it( 'should update layer rotation', () => {
			// Move point to create rotation
			controller.handleRotation( { x: 300, y: 200 }, {} );

			expect( testLayer.rotation ).not.toBe( 0 );
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should snap to 15 degrees with shift key', () => {
			controller.handleRotation( { x: 350, y: 150 }, { shiftKey: true } );

			// Rotation should be a multiple of 15
			expect( testLayer.rotation % 15 ).toBeCloseTo( 0, 1 );
		} );

		it( 'should do nothing if layer not found', () => {
			mockManager.selectedLayerId = 'nonexistent';
			controller.handleRotation( { x: 350, y: 150 }, {} );
			expect( mockManager.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing if bounds not available', () => {
			mockManager.getLayerBounds = jest.fn( () => null );
			controller.handleRotation( { x: 350, y: 150 }, {} );
			expect( mockManager.renderLayers ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'finishRotation', () => {
		it( 'should reset rotation state', () => {
			controller.startRotation( { x: 300, y: 100 } );
			controller.finishRotation();

			expect( controller.isRotating ).toBe( false );
			expect( controller.originalLayerState ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );
	} );

	// ==================== Drag Operations ====================

	describe( 'startDrag', () => {
		it( 'should initialize single layer drag state', () => {
			const startPoint = { x: 150, y: 150 };

			controller.startDrag( startPoint );

			expect( controller.isDragging ).toBe( true );
			expect( controller.dragStartPoint ).toBe( startPoint );
			expect( mockCanvas.style.cursor ).toBe( 'move' );
			expect( controller.originalLayerState ).toEqual( testLayer );
		} );

		it( 'should store multi-layer states for multi-selection', () => {
			const layer2 = { id: 'layer2', type: 'circle', x: 200, y: 200, radius: 30 };
			mockEditor.layers.push( layer2 );
			mockManager.selectedLayerIds = [ 'layer1', 'layer2' ];

			controller.startDrag( { x: 150, y: 150 } );

			expect( controller.originalMultiLayerStates ).toBeDefined();
			expect( controller.originalMultiLayerStates.layer1 ).toEqual( testLayer );
			expect( controller.originalMultiLayerStates.layer2 ).toEqual( layer2 );
		} );
	} );

	describe( 'handleDrag', () => {
		beforeEach( () => {
			controller.startDrag( { x: 150, y: 150 } );
		} );

		it( 'should update layer position', () => {
			controller.handleDrag( { x: 200, y: 180 } );

			expect( testLayer.x ).toBe( 150 ); // 100 + 50
			expect( testLayer.y ).toBe( 130 ); // 100 + 30
			expect( controller.showDragPreview ).toBe( true );
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should apply snap to grid when enabled', () => {
			mockManager.snapToGrid = true;
			mockManager.gridSize = 10;

			controller.handleDrag( { x: 163, y: 157 } );

			// Position should be snapped to grid
			expect( testLayer.x % 10 ).toBe( 0 );
			expect( testLayer.y % 10 ).toBe( 0 );
		} );

		it( 'should handle multi-layer drag', () => {
			const layer2 = { id: 'layer2', type: 'circle', x: 200, y: 200, radius: 30 };
			mockEditor.layers.push( layer2 );
			mockManager.selectedLayerIds = [ 'layer1', 'layer2' ];

			// Restart drag for multi-selection
			controller.startDrag( { x: 150, y: 150 } );
			controller.handleDrag( { x: 200, y: 200 } );

			// Both layers should move
			expect( testLayer.x ).toBe( 150 );
			expect( layer2.x ).toBe( 250 );
		} );
	} );

	describe( 'updateLayerPosition', () => {
		it( 'should update rectangle position', () => {
			const layer = { type: 'rectangle', x: 100, y: 100 };
			const original = { x: 100, y: 100 };

			controller.updateLayerPosition( layer, original, 50, 30 );

			expect( layer.x ).toBe( 150 );
			expect( layer.y ).toBe( 130 );
		} );

		it( 'should update line/arrow position', () => {
			const layer = { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 };
			const original = { x1: 0, y1: 0, x2: 100, y2: 100 };

			controller.updateLayerPosition( layer, original, 20, 30 );

			expect( layer.x1 ).toBe( 20 );
			expect( layer.y1 ).toBe( 30 );
			expect( layer.x2 ).toBe( 120 );
			expect( layer.y2 ).toBe( 130 );
		} );

		it( 'should update path points', () => {
			const layer = {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 50, y: 50 } ]
			};
			const original = {
				points: [ { x: 0, y: 0 }, { x: 50, y: 50 } ]
			};

			controller.updateLayerPosition( layer, original, 10, 20 );

			expect( layer.points[ 0 ] ).toEqual( { x: 10, y: 20 } );
			expect( layer.points[ 1 ] ).toEqual( { x: 60, y: 70 } );
		} );

		it( 'should handle path with no points gracefully', () => {
			const layer = { type: 'path' };
			const original = {};

			// Should not throw
			controller.updateLayerPosition( layer, original, 10, 20 );
		} );

		it( 'should update various layer types', () => {
			const types = [ 'textbox', 'circle', 'text', 'ellipse', 'polygon', 'star' ];

			for ( const type of types ) {
				const layer = { type, x: 50, y: 50 };
				const original = { x: 50, y: 50 };

				controller.updateLayerPosition( layer, original, 25, 15 );

				expect( layer.x ).toBe( 75 );
				expect( layer.y ).toBe( 65 );
			}
		} );

		it( 'should update arrow like line', () => {
			const layer = { type: 'arrow', x1: 10, y1: 10, x2: 60, y2: 60 };
			const original = { x1: 10, y1: 10, x2: 60, y2: 60 };

			controller.updateLayerPosition( layer, original, 5, 10 );

			expect( layer.x1 ).toBe( 15 );
			expect( layer.y1 ).toBe( 20 );
			expect( layer.x2 ).toBe( 65 );
			expect( layer.y2 ).toBe( 70 );
		} );
	} );

	describe( 'finishDrag', () => {
		it( 'should reset drag state', () => {
			controller.startDrag( { x: 150, y: 150 } );
			controller.handleDrag( { x: 200, y: 200 } );
			controller.finishDrag();

			expect( controller.isDragging ).toBe( false );
			expect( controller.showDragPreview ).toBe( false );
			expect( controller.originalLayerState ).toBeNull();
			expect( controller.originalMultiLayerStates ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );
	} );

	// ==================== Utility Methods ====================

	describe( 'isTransforming', () => {
		it( 'should return false when not transforming', () => {
			expect( controller.isTransforming() ).toBe( false );
		} );

		it( 'should return true when resizing', () => {
			controller.isResizing = true;
			expect( controller.isTransforming() ).toBe( true );
		} );

		it( 'should return true when rotating', () => {
			controller.isRotating = true;
			expect( controller.isTransforming() ).toBe( true );
		} );

		it( 'should return true when dragging', () => {
			controller.isDragging = true;
			expect( controller.isTransforming() ).toBe( true );
		} );
	} );

	describe( 'getState', () => {
		it( 'should return current transform state', () => {
			controller.isResizing = true;
			controller.resizeHandle = { type: 'se' };
			controller.showDragPreview = true;

			const state = controller.getState();

			expect( state.isResizing ).toBe( true );
			expect( state.isRotating ).toBe( false );
			expect( state.isDragging ).toBe( false );
			expect( state.resizeHandle ).toEqual( { type: 'se' } );
			expect( state.showDragPreview ).toBe( true );
		} );
	} );

	describe( 'emitTransforming', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should emit custom event with layer data', () => {
			const dispatchSpy = jest.spyOn( mockEditor.container, 'dispatchEvent' );

			controller.emitTransforming( testLayer );

			// Events are now emitted synchronously for responsive UI
			expect( dispatchSpy ).toHaveBeenCalled();
			const event = dispatchSpy.mock.calls[ 0 ][ 0 ];
			expect( event.type ).toBe( 'layers:transforming' );
			expect( event.detail.id ).toBe( 'layer1' );
		} );

		it( 'should emit events synchronously for responsive UI', () => {
			const dispatchSpy = jest.spyOn( mockEditor.container, 'dispatchEvent' );

			// Emit multiple times - each should dispatch immediately for responsive UI
			controller.emitTransforming( testLayer );
			controller.emitTransforming( testLayer );
			controller.emitTransforming( testLayer );

			// All events should have been dispatched synchronously
			expect( dispatchSpy ).toHaveBeenCalledTimes( 3 );
		} );

		it( 'should do nothing for null layer', () => {
			const dispatchSpy = jest.spyOn( mockEditor.container, 'dispatchEvent' );

			controller.emitTransforming( null );

			jest.advanceTimersByTime( 16 );

			expect( dispatchSpy ).not.toHaveBeenCalled();
		} );

		it( 'should use manager container as fallback', () => {
			mockManager.editor.container = null;
			const dispatchSpy = jest.spyOn( mockManager.container, 'dispatchEvent' );

			controller.emitTransforming( testLayer );

			// Events are now emitted synchronously
			expect( dispatchSpy ).toHaveBeenCalled();
		} );

		it( 'should skip src and path properties in lightweight copy', () => {
			const dispatchSpy = jest.spyOn( mockEditor.container, 'dispatchEvent' );
			const layerWithLargeData = {
				id: 'image1',
				type: 'image',
				x: 100,
				y: 100,
				width: 200,
				height: 150,
				src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
				path: 'M 0 0 L 100 100 L 200 0 Z'
			};

			controller.emitTransforming( layerWithLargeData );

			expect( dispatchSpy ).toHaveBeenCalled();
			const event = dispatchSpy.mock.calls[ 0 ][ 0 ];
			expect( event.detail.layer.id ).toBe( 'image1' );
			expect( event.detail.layer.x ).toBe( 100 );
			expect( event.detail.layer.width ).toBe( 200 );
			// src and path should NOT be in the lightweight copy
			expect( event.detail.layer.src ).toBeUndefined();
			expect( event.detail.layer.path ).toBeUndefined();
		} );

		it( 'should clone array properties in lightweight copy', () => {
			const dispatchSpy = jest.spyOn( mockEditor.container, 'dispatchEvent' );
			const originalPoints = [ { x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 0 } ];
			const layerWithArray = {
				id: 'polygon1',
				type: 'polygon',
				x: 50,
				y: 50,
				points: originalPoints,
				viewBox: [ 0, 0, 100, 100 ]
			};

			controller.emitTransforming( layerWithArray );

			expect( dispatchSpy ).toHaveBeenCalled();
			const event = dispatchSpy.mock.calls[ 0 ][ 0 ];
			expect( event.detail.layer.points ).toEqual( originalPoints );
			expect( event.detail.layer.viewBox ).toEqual( [ 0, 0, 100, 100 ] );
			// Should be cloned, not the same reference
			expect( event.detail.layer.points ).not.toBe( originalPoints );
			expect( event.detail.layer.viewBox ).not.toBe( layerWithArray.viewBox );
		} );

		it( 'should shallow clone nested object properties in lightweight copy', () => {
			const dispatchSpy = jest.spyOn( mockEditor.container, 'dispatchEvent' );
			const originalMeta = { author: 'test', created: Date.now() };
			const layerWithNested = {
				id: 'layer1',
				type: 'rectangle',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				customData: originalMeta,
				strokeStyle: { color: '#ff0000', width: 2 }
			};

			controller.emitTransforming( layerWithNested );

			expect( dispatchSpy ).toHaveBeenCalled();
			const event = dispatchSpy.mock.calls[ 0 ][ 0 ];
			expect( event.detail.layer.customData ).toEqual( originalMeta );
			expect( event.detail.layer.strokeStyle ).toEqual( { color: '#ff0000', width: 2 } );
			// Should be cloned, not the same reference
			expect( event.detail.layer.customData ).not.toBe( originalMeta );
			expect( event.detail.layer.strokeStyle ).not.toBe( layerWithNested.strokeStyle );
		} );

		it( 'should call layersErrorHandler when event dispatch fails', () => {
			const mockErrorHandler = {
				handleError: jest.fn()
			};
			window.layersErrorHandler = mockErrorHandler;

			// Make dispatchEvent throw an error
			mockEditor.container.dispatchEvent = jest.fn().mockImplementation( () => {
				throw new Error( 'Test dispatch error' );
			} );

			controller.emitTransforming( testLayer );

			expect( mockErrorHandler.handleError ).toHaveBeenCalledWith(
				expect.any( Error ),
				'TransformController.emitTransformEvent',
				'canvas'
			);

			// Clean up
			delete window.layersErrorHandler;
		} );
	} );

	// ==================== Integration Tests ====================

	describe( 'resize with rotation', () => {
		it( 'should transform deltas for rotated layer', () => {
			testLayer.rotation = 45;
			controller.startResize( { type: 'e' }, { x: 300, y: 175 } );

			// Move horizontally
			controller.handleResize( { x: 350, y: 175 }, {} );

			// Layer should be modified
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'star layer resize special handling', () => {
		it( 'should update star radius properties', () => {
			const starLayer = {
				id: 'star1',
				type: 'star',
				x: 100,
				y: 100,
				radius: 50,
				outerRadius: 50,
				innerRadius: 25
			};
			mockEditor.layers = [ starLayer ];
			mockManager.selectedLayerId = 'star1';

			controller.startResize( { type: 'e' }, { x: 150, y: 100 } );
			controller.handleResize( { x: 200, y: 100 }, {} );

			expect( starLayer.outerRadius ).toBe( starLayer.radius );
			expect( starLayer.innerRadius ).toBe( starLayer.radius * 0.5 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up transform state', () => {
			// Set some state first
			controller.isResizing = true;
			controller.isRotating = true;
			controller.isDragging = true;
			controller.resizeHandle = { type: 'se' };
			controller.dragStartPoint = { x: 100, y: 100 };
			controller.originalLayerState = { id: 'test' };
			controller.originalMultiLayerStates = [ { id: 'test' } ];

			controller.destroy();

			expect( controller.isResizing ).toBe( false );
			expect( controller.isRotating ).toBe( false );
			expect( controller.isDragging ).toBe( false );
			expect( controller.resizeHandle ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( controller.originalLayerState ).toBeNull();
			expect( controller.originalMultiLayerStates ).toBeNull();
		} );

		it( 'should cancel pending transform events', () => {
			controller.transformEventScheduled = true;
			controller.lastTransformPayload = { type: 'test' };

			controller.destroy();

			expect( controller.transformEventScheduled ).toBe( false );
			expect( controller.lastTransformPayload ).toBeNull();
		} );

		it( 'should clear manager reference', () => {
			expect( controller.manager ).not.toBeNull();

			controller.destroy();

			expect( controller.manager ).toBeNull();
		} );
	} );

	describe( 'fallback paths', () => {
		it( 'should return null from calculateResize when ResizeCalculator unavailable', () => {
			// Temporarily remove ResizeCalculator
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculateResize(
				testLayer, 'se', 10, 10, {}
			);

			expect( result ).toBeNull();

			// Restore
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );

		it( 'should return empty object from calculateRectangleResize when ResizeCalculator unavailable', () => {
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculateRectangleResize(
				testLayer, 'se', 10, 10, {}
			);

			expect( result ).toEqual( {} );

			// Restore
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );

		it( 'should return null from calculateCircleResize when ResizeCalculator unavailable', () => {
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculateCircleResize(
				{ type: 'circle', x: 50, y: 50, radius: 30 }, 'e', 10, 0
			);

			expect( result ).toBeNull();
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );

		it( 'should return empty object from calculateEllipseResize when ResizeCalculator unavailable', () => {
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculateEllipseResize(
				{ type: 'ellipse', x: 50, y: 50, radiusX: 40, radiusY: 30 }, 'e', 10, 0
			);

			expect( result ).toEqual( {} );
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );

		it( 'should return empty object from calculatePolygonResize when ResizeCalculator unavailable', () => {
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculatePolygonResize(
				{ type: 'polygon', x: 50, y: 50, radius: 30 }, 'e', 10, 0
			);

			expect( result ).toEqual( {} );
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );

		it( 'should return empty object from calculateLineResize when ResizeCalculator unavailable', () => {
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculateLineResize(
				{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 }, 'e', 10, 10
			);

			expect( result ).toEqual( {} );
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );

		it( 'should return null from calculatePathResize when ResizeCalculator unavailable', () => {
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculatePathResize(
				{ type: 'path', points: [ { x: 0, y: 0 }, { x: 50, y: 50 } ] }, 'se', 10, 10
			);

			expect( result ).toBeNull();
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );

		it( 'should return empty object from calculateTextResize when ResizeCalculator unavailable', () => {
			const savedCalc = global.window.Layers.Canvas.ResizeCalculator;
			delete global.window.Layers.Canvas.ResizeCalculator;

			const result = controller.calculateTextResize(
				{ type: 'text', x: 50, y: 50, fontSize: 16 }, 'se', 10, 10
			);

			expect( result ).toEqual( {} );
			global.window.Layers.Canvas.ResizeCalculator = savedCalc;
		} );
	} );

	describe( 'updateLayerPosition edge cases', () => {
		it( 'should update marker layer position', () => {
			const layer = {
				type: 'marker',
				x: 100,
				y: 100,
				arrowX: 150,
				arrowY: 80
			};
			const original = { x: 100, y: 100, arrowX: 150, arrowY: 80 };

			controller.updateLayerPosition( layer, original, 20, 30 );

			// Marker center should move
			expect( layer.x ).toBe( 120 );
			expect( layer.y ).toBe( 130 );
			// Arrow position should NOT move (independent positioning)
			expect( layer.arrowX ).toBe( 150 );
			expect( layer.arrowY ).toBe( 80 );
		} );

		it( 'should update curved arrow with controlX/controlY', () => {
			const layer = {
				type: 'arrow',
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 100,
				controlX: 50,
				controlY: 0
			};
			const original = {
				x1: 0,
				y1: 0,
				x2: 100,
				y2: 100,
				controlX: 50,
				controlY: 0
			};

			controller.updateLayerPosition( layer, original, 10, 20 );

			expect( layer.x1 ).toBe( 10 );
			expect( layer.y1 ).toBe( 20 );
			expect( layer.x2 ).toBe( 110 );
			expect( layer.y2 ).toBe( 120 );
			// Control point should also move
			expect( layer.controlX ).toBe( 60 );
			expect( layer.controlY ).toBe( 20 );
		} );

		it( 'should update dimension layer position', () => {
			const layer = {
				type: 'dimension',
				x1: 0,
				y1: 0,
				x2: 200,
				y2: 0
			};
			const original = { x1: 0, y1: 0, x2: 200, y2: 0 };

			controller.updateLayerPosition( layer, original, 15, 25 );

			expect( layer.x1 ).toBe( 15 );
			expect( layer.y1 ).toBe( 25 );
			expect( layer.x2 ).toBe( 215 );
			expect( layer.y2 ).toBe( 25 );
		} );

		it( 'should update customShape layer position', () => {
			const layer = {
				type: 'customShape',
				x: 50,
				y: 50,
				width: 100,
				height: 100
			};
			const original = { x: 50, y: 50 };

			controller.updateLayerPosition( layer, original, 25, 35 );

			expect( layer.x ).toBe( 75 );
			expect( layer.y ).toBe( 85 );
		} );

		it( 'should update image layer position', () => {
			const layer = {
				type: 'image',
				x: 100,
				y: 200,
				width: 300,
				height: 400
			};
			const original = { x: 100, y: 200 };

			controller.updateLayerPosition( layer, original, -10, -20 );

			expect( layer.x ).toBe( 90 );
			expect( layer.y ).toBe( 180 );
		} );
	} );

	describe( 'saveState fallback paths', () => {
		it( 'should use manager.saveState when editor.saveState is unavailable on finishResize', () => {
			// Remove editor.saveState
			delete mockEditor.saveState;
			mockManager.saveState = jest.fn();

			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );
			controller.finishResize();

			expect( mockManager.saveState ).toHaveBeenCalledWith( 'Resize layer' );
		} );

		it( 'should use manager.saveState when editor.saveState is unavailable on finishRotation', () => {
			delete mockEditor.saveState;
			mockManager.saveState = jest.fn();

			controller.startRotation( { x: 300, y: 100 } );
			controller.finishRotation();

			expect( mockManager.saveState ).toHaveBeenCalledWith( 'Rotate layer' );
		} );

		it( 'should use manager.saveState when editor.saveState is unavailable on finishDrag', () => {
			delete mockEditor.saveState;
			mockManager.saveState = jest.fn();

			controller.startDrag( { x: 150, y: 150 } );
			controller.handleDrag( { x: 200, y: 200 } );
			controller.finishDrag();

			expect( mockManager.saveState ).toHaveBeenCalledWith( 'Move layer' );
		} );
	} );

	describe( 'handleDrag with missing originalState', () => {
		it( 'should skip layer when originalMultiLayerStates does not have entry', () => {
			const layer2 = { id: 'layer2', type: 'circle', x: 200, y: 200, radius: 30 };
			mockEditor.layers.push( layer2 );
			mockManager.selectedLayerIds = [ 'layer1', 'layer2' ];

			controller.startDrag( { x: 150, y: 150 } );
			// Manually remove one layer's original state to simulate the edge case
			delete controller.originalMultiLayerStates.layer2;

			controller.handleDrag( { x: 200, y: 200 } );

			// layer1 should move, layer2 should not (no originalState)
			expect( testLayer.x ).toBe( 150 );
			expect( layer2.x ).toBe( 200 ); // Unchanged
		} );
	} );

	describe( 'smart guides snapping during drag', () => {
		let smartGuidesController;

		beforeEach( () => {
			smartGuidesController = {
				enabled: true,
				calculateSnappedPosition: jest.fn( ( layer, x, y ) => ( { x: x + 5, y: y + 3 } ) )
			};
			mockManager.smartGuidesController = smartGuidesController;
			mockManager.gridSnapEnabled = false;
		} );

		it( 'should apply smart guides snapping when grid snap is disabled', () => {
			// Use testLayer which is already in mockEditor.layers
			mockManager.selectedLayerIds = [ 'layer1' ];

			controller.startDrag( { x: 100, y: 100 } );

			expect( controller.isDragging ).toBe( true );
			expect( controller.originalLayerState ).toEqual( testLayer );
		} );

		it( 'should use smart guides controller when available and enabled', () => {
			mockManager.selectedLayerIds = [ 'layer1' ];

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 110, y: 110 } );

			// Smart guides should have been consulted
			expect( smartGuidesController.calculateSnappedPosition ).toHaveBeenCalled();
		} );

		it( 'should not use smart guides when both disabled', () => {
			smartGuidesController.enabled = false;
			smartGuidesController.canvasSnapEnabled = false;
			mockManager.selectedLayerIds = [ 'layer1' ];

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 110, y: 110 } );

			// Smart guides should NOT be consulted since both disabled
			expect( smartGuidesController.calculateSnappedPosition ).not.toHaveBeenCalled();
		} );

		it( 'should use snapping when only canvas snap is enabled', () => {
			smartGuidesController.enabled = false;
			smartGuidesController.canvasSnapEnabled = true;
			mockManager.selectedLayerIds = [ 'layer1' ];

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 110, y: 110 } );

			// Should use snapping since canvasSnapEnabled is true
			expect( smartGuidesController.calculateSnappedPosition ).toHaveBeenCalled();
		} );

		it( 'should prefer grid snap over smart guides when grid snap is enabled', () => {
			mockManager.snapToGrid = true;
			mockManager.gridSize = 10;
			mockManager.selectedLayerIds = [ 'layer1' ];

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 110, y: 110 } );

			// Smart guides should NOT be used since grid snap takes precedence
			expect( smartGuidesController.calculateSnappedPosition ).not.toHaveBeenCalled();
		} );

		it( 'should clear smart guides on finishDrag', () => {
			smartGuidesController.clearGuides = jest.fn();
			mockManager.selectedLayerIds = [ 'layer1' ];

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 110, y: 110 } );
			controller.finishDrag();

			// clearGuides should be called when smart guides controller is available
			expect( smartGuidesController.clearGuides ).toHaveBeenCalled();
		} );
	} );

	describe( 'layer lock protection', () => {
		let lockedLayer;
		let unlockedLayer;
		let lockedFolder;
		let childOfLockedFolder;

		beforeEach( () => {
			lockedLayer = {
				id: 'locked1',
				type: 'rectangle',
				x: 50,
				y: 50,
				width: 100,
				height: 100,
				locked: true
			};

			unlockedLayer = {
				id: 'unlocked1',
				type: 'rectangle',
				x: 200,
				y: 200,
				width: 100,
				height: 100,
				locked: false
			};

			lockedFolder = {
				id: 'folder1',
				type: 'group',
				locked: true,
				children: [ 'child1' ]
			};

			childOfLockedFolder = {
				id: 'child1',
				type: 'rectangle',
				x: 300,
				y: 300,
				width: 50,
				height: 50,
				locked: false,
				parentGroup: 'folder1'
			};

			mockEditor.layers = [ lockedLayer, unlockedLayer, lockedFolder, childOfLockedFolder ];
		} );

		describe( 'isLayerEffectivelyLocked', () => {
			it( 'should return true for directly locked layer', () => {
				expect( controller.isLayerEffectivelyLocked( lockedLayer ) ).toBe( true );
			} );

			it( 'should return false for unlocked layer', () => {
				expect( controller.isLayerEffectivelyLocked( unlockedLayer ) ).toBe( false );
			} );

			it( 'should return true for child of locked folder', () => {
				expect( controller.isLayerEffectivelyLocked( childOfLockedFolder ) ).toBe( true );
			} );

			it( 'should return false for null layer', () => {
				expect( controller.isLayerEffectivelyLocked( null ) ).toBe( false );
			} );

			it( 'should handle circular parent references gracefully', () => {
				const circularLayer = {
					id: 'circular',
					type: 'rectangle',
					parentGroup: 'circular',
					locked: false
				};
				mockEditor.layers.push( circularLayer );

				// Should not infinite loop and should return false
				expect( controller.isLayerEffectivelyLocked( circularLayer ) ).toBe( false );
			} );

			it( 'should return false when parentGroup references non-existent folder', () => {
				const orphanLayer = {
					id: 'orphan',
					type: 'rectangle',
					parentGroup: 'nonexistent-folder',
					locked: false
				};
				// Don't add the parent folder to mockEditor.layers
				expect( controller.isLayerEffectivelyLocked( orphanLayer ) ).toBe( false );
			} );
		} );

		describe( 'startDrag with locked layers', () => {
			it( 'should prevent drag on locked layer', () => {
				mockManager.selectedLayerIds = [ 'locked1' ];
				mockManager.getSelectedLayerId = () => 'locked1';

				controller.startDrag( { x: 100, y: 100 } );

				expect( controller.isDragging ).toBe( false );
			} );

			it( 'should allow drag on unlocked layer', () => {
				mockManager.selectedLayerIds = [ 'unlocked1' ];
				mockManager.getSelectedLayerId = () => 'unlocked1';

				controller.startDrag( { x: 100, y: 100 } );

				expect( controller.isDragging ).toBe( true );
			} );

			it( 'should prevent drag on child of locked folder', () => {
				mockManager.selectedLayerIds = [ 'child1' ];
				mockManager.getSelectedLayerId = () => 'child1';

				controller.startDrag( { x: 100, y: 100 } );

				expect( controller.isDragging ).toBe( false );
			} );

			it( 'should prevent drag when all selected layers are locked', () => {
				mockManager.selectedLayerIds = [ 'locked1', 'child1' ];

				controller.startDrag( { x: 100, y: 100 } );

				expect( controller.isDragging ).toBe( false );
			} );

			it( 'should allow drag when at least one layer is unlocked in multi-selection', () => {
				mockManager.selectedLayerIds = [ 'locked1', 'unlocked1' ];

				controller.startDrag( { x: 100, y: 100 } );

				expect( controller.isDragging ).toBe( true );
			} );
		} );

		describe( 'startResize with locked layers', () => {
			it( 'should prevent resize on locked layer', () => {
				mockManager.selectedLayerIds = [ 'locked1' ];
				mockManager.getSelectedLayerId = () => 'locked1';

				controller.startResize( { type: 'se' }, { x: 100, y: 100 } );

				expect( controller.isResizing ).toBe( false );
			} );

			it( 'should prevent resize on marker layer', () => {
				const markerLayer = {
					id: 'marker1',
					type: 'marker',
					x: 100,
					y: 100,
					locked: false
				};
				mockEditor.layers = [ markerLayer ];
				mockManager.selectedLayerIds = [ 'marker1' ];
				mockManager.getSelectedLayerId = () => 'marker1';

				controller.startResize( { type: 'se' }, { x: 100, y: 100 } );

				expect( controller.isResizing ).toBe( false );
			} );

			it( 'should allow resize on unlocked layer', () => {
				mockManager.selectedLayerIds = [ 'unlocked1' ];
				mockManager.getSelectedLayerId = () => 'unlocked1';

				controller.startResize( { type: 'se' }, { x: 100, y: 100 } );

				expect( controller.isResizing ).toBe( true );
			} );
		} );

		describe( 'startRotation with locked layers', () => {
			it( 'should prevent rotation on locked layer', () => {
				mockManager.selectedLayerIds = [ 'locked1' ];
				mockManager.getSelectedLayerId = () => 'locked1';

				controller.startRotation( { x: 100, y: 100 } );

				expect( controller.isRotating ).toBe( false );
			} );

			it( 'should allow rotation on unlocked layer', () => {
				mockManager.selectedLayerIds = [ 'unlocked1' ];
				mockManager.getSelectedLayerId = () => 'unlocked1';

				controller.startRotation( { x: 100, y: 100 } );

				expect( controller.isRotating ).toBe( true );
			} );
		} );

		describe( 'handleDrag with locked layers in multi-selection', () => {
			it( 'should skip locked layers when moving multi-selection', () => {
				mockManager.selectedLayerIds = [ 'locked1', 'unlocked1' ];
				mockManager.getSelectedLayerId = () => 'unlocked1';

				controller.startDrag( { x: 200, y: 200 } );
				controller.handleDrag( { x: 210, y: 210 } );

				// Unlocked layer should have been updated
				expect( unlockedLayer.x ).toBe( 210 );
				expect( unlockedLayer.y ).toBe( 210 );

				// Locked layer should NOT have been updated
				expect( lockedLayer.x ).toBe( 50 );
				expect( lockedLayer.y ).toBe( 50 );
			} );
		} );
	} );

	// ==================== Arrow Tip Dragging (Marker Tool) ====================
	describe( 'Arrow tip dragging for markers', () => {
		let controller;
		let mockManager;
		let mockMarkerLayer;

		beforeEach( () => {
			mockMarkerLayer = {
				id: 'marker-1',
				type: 'marker',
				x: 100,
				y: 100,
				arrowX: 150,
				arrowY: 150,
				width: 30,
				height: 30,
				locked: false
			};

			mockManager = {
				editor: {
					getLayerById: jest.fn( ( id ) => {
						if ( id === 'marker-1' ) {
							return mockMarkerLayer;
						}
						return null;
					} ),
					layers: [ mockMarkerLayer ],
					updateLayer: jest.fn( ( id, updates ) => {
						Object.assign( mockMarkerLayer, updates );
					} ),
					markDirty: jest.fn(),
					saveState: jest.fn()
				},
				canvas: { style: { cursor: '' } },
				renderLayers: jest.fn(),
				getToolCursor: jest.fn( () => 'default' ),
				currentTool: 'select',
				eventManager: {
					emit: jest.fn()
				}
			};

			controller = new TransformController( mockManager );
		} );

		describe( 'startArrowTipDrag', () => {
			it( 'should start arrow tip drag for unlocked marker', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				const startPoint = { x: 150, y: 150 };

				controller.startArrowTipDrag( handle, startPoint );

				expect( controller.isArrowTipDragging ).toBe( true );
				expect( controller.arrowTipLayerId ).toBe( 'marker-1' );
				expect( controller.dragStartPoint ).toEqual( startPoint );
				expect( mockManager.canvas.style.cursor ).toBe( 'move' );
			} );

			it( 'should not start arrow tip drag for locked marker', () => {
				mockMarkerLayer.locked = true;
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				const startPoint = { x: 150, y: 150 };

				controller.startArrowTipDrag( handle, startPoint );

				expect( controller.isArrowTipDragging ).toBe( false );
			} );

			it( 'should store original layer state for undo', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				const startPoint = { x: 150, y: 150 };

				controller.startArrowTipDrag( handle, startPoint );

				expect( controller.originalLayerState ).toBeDefined();
				expect( controller.originalLayerState.id ).toBe( 'marker-1' );
				expect( controller.originalLayerState.arrowX ).toBe( 150 );
			} );
		} );

		describe( 'handleArrowTipDrag', () => {
			it( 'should update arrow position during drag', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );

				controller.handleArrowTipDrag( { x: 200, y: 180 } );

				expect( mockManager.editor.updateLayer ).toHaveBeenCalledWith( 'marker-1', {
					arrowX: 200,
					arrowY: 180
				} );
				expect( mockManager.renderLayers ).toHaveBeenCalled();
			} );

			it( 'should not update if not in arrow tip drag mode', () => {
				controller.handleArrowTipDrag( { x: 200, y: 180 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should not update if layer no longer exists', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );

				// Simulate layer being deleted
				mockManager.editor.getLayerById = jest.fn( () => null );

				controller.handleArrowTipDrag( { x: 200, y: 180 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should emit transforming event during drag', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );

				// Mock dispatchEvent to capture events
				const mockDispatch = jest.fn();
				mockManager.editor.container = { dispatchEvent: mockDispatch };

				controller.handleArrowTipDrag( { x: 200, y: 180 } );

				// Check that CustomEvent was dispatched
				expect( mockDispatch ).toHaveBeenCalled();
				const event = mockDispatch.mock.calls[ 0 ][ 0 ];
				expect( event.type ).toBe( 'layers:transforming' );
				expect( event.detail.layer ).toBeDefined();
			} );
		} );

		describe( 'finishArrowTipDrag', () => {
			it( 'should finish drag and save state when there was movement', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );
				controller.handleArrowTipDrag( { x: 200, y: 180 } );

				controller.finishArrowTipDrag();

				expect( controller.isArrowTipDragging ).toBe( false );
				expect( controller.arrowTipLayerId ).toBeNull();
				expect( mockManager.editor.markDirty ).toHaveBeenCalled();
				expect( mockManager.editor.saveState ).toHaveBeenCalledWith( 'Move arrow tip' );
			} );

			it( 'should not save state if there was no movement', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );

				// Finish without any handleArrowTipDrag calls
				controller.finishArrowTipDrag();

				expect( mockManager.editor.markDirty ).not.toHaveBeenCalled();
			} );

			it( 'should reset cursor on finish', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );
				controller.handleArrowTipDrag( { x: 200, y: 180 } );

				controller.finishArrowTipDrag();

				expect( mockManager.getToolCursor ).toHaveBeenCalled();
				expect( mockManager.canvas.style.cursor ).toBe( 'default' );
			} );

			it( 'should dispatch final transform event if there was movement', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );

				// Mock dispatchEvent to capture events
				const mockDispatch = jest.fn();
				mockManager.editor.container = { dispatchEvent: mockDispatch };

				controller.handleArrowTipDrag( { x: 200, y: 180 } );
				controller.finishArrowTipDrag();

				// Check that CustomEvent was dispatched multiple times (during drag and finish)
				expect( mockDispatch.mock.calls.length ).toBeGreaterThanOrEqual( 2 );
			} );
		} );
	} );
} );
