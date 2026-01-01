/**
 * Tests for DrawingController.js
 *
 * DrawingController handles shape drawing and tool operations for all shape creation.
 */

const DrawingController = require( '../../resources/ext.layers.editor/canvas/DrawingController.js' );

describe( 'DrawingController', () => {
	let controller;
	let mockCanvasManager;
	let mockRenderer;

	beforeEach( () => {
		// Create mock renderer
		mockRenderer = {
			drawLayer: jest.fn()
		};

		// Create mock canvas manager
		mockCanvasManager = {
			renderer: mockRenderer,
			createTextInputModal: jest.fn( () => {
				const modal = document.createElement( 'div' );
				const textInput = document.createElement( 'input' );
				textInput.className = 'text-input';
				modal.appendChild( textInput );
				return modal;
			} )
		};

		controller = new DrawingController( mockCanvasManager );
	} );

	afterEach( () => {
		// Clean up any modals added to body
		document.body.innerHTML = '';
	} );

	describe( 'constructor', () => {
		it( 'should initialize with correct defaults', () => {
			expect( controller.canvasManager ).toBe( mockCanvasManager );
			expect( controller.tempLayer ).toBeNull();
			expect( controller.isDrawing ).toBe( false );
			expect( controller.MIN_SHAPE_SIZE ).toBe( 5 );
			expect( controller.MIN_LINE_LENGTH ).toBe( 5 );
			expect( controller.MIN_PATH_POINTS ).toBe( 2 );
		} );
	} );

	describe( 'startDrawing', () => {
		const defaultStyle = { color: '#ff0000', strokeWidth: 3 };
		const startPoint = { x: 100, y: 100 };

		it( 'should start drawing for rectangle tool', () => {
			controller.startDrawing( startPoint, 'rectangle', defaultStyle );

			expect( controller.isDrawing ).toBe( true );
			expect( controller.tempLayer.type ).toBe( 'rectangle' );
			expect( controller.tempLayer.x ).toBe( 100 );
			expect( controller.tempLayer.y ).toBe( 100 );
		} );

		it( 'should start drawing for circle tool', () => {
			controller.startDrawing( startPoint, 'circle', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'circle' );
			expect( controller.tempLayer.radius ).toBe( 0 );
		} );

		it( 'should start drawing for ellipse tool', () => {
			controller.startDrawing( startPoint, 'ellipse', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'ellipse' );
			expect( controller.tempLayer.radiusX ).toBe( 0 );
			expect( controller.tempLayer.radiusY ).toBe( 0 );
		} );

		it( 'should start drawing for polygon tool', () => {
			controller.startDrawing( startPoint, 'polygon', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'polygon' );
			expect( controller.tempLayer.sides ).toBe( 6 );
		} );

		it( 'should start drawing for star tool', () => {
			controller.startDrawing( startPoint, 'star', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'star' );
			expect( controller.tempLayer.points ).toBe( 5 );
		} );

		it( 'should start drawing for line tool', () => {
			controller.startDrawing( startPoint, 'line', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'line' );
			expect( controller.tempLayer.x1 ).toBe( 100 );
			expect( controller.tempLayer.y1 ).toBe( 100 );
			expect( controller.tempLayer.x2 ).toBe( 100 );
			expect( controller.tempLayer.y2 ).toBe( 100 );
		} );

		it( 'should start drawing for arrow tool', () => {
			controller.startDrawing( startPoint, 'arrow', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'arrow' );
			expect( controller.tempLayer.arrowSize ).toBe( 10 );
		} );

		it( 'should start drawing for pen tool', () => {
			controller.startDrawing( startPoint, 'pen', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'path' );
			expect( controller.tempLayer.points ).toEqual( [ startPoint ] );
		} );

		it( 'should handle text tool specially', () => {
			controller.startDrawing( startPoint, 'text', defaultStyle );

			// Text tool stops drawing and creates modal
			expect( controller.isDrawing ).toBe( false );
			expect( mockCanvasManager.createTextInputModal ).toHaveBeenCalled();
		} );

		it( 'should do nothing for unknown tool', () => {
			controller.startDrawing( startPoint, 'unknown', defaultStyle );

			expect( controller.tempLayer ).toBeNull();
		} );

		it( 'should reset previous temp layer on new draw', () => {
			controller.tempLayer = { type: 'old' };
			controller.startDrawing( startPoint, 'rectangle', defaultStyle );

			expect( controller.tempLayer.type ).toBe( 'rectangle' );
		} );
	} );

	describe( 'continueDrawing', () => {
		const startPoint = { x: 100, y: 100 };
		const style = { color: '#000000', strokeWidth: 2 };

		it( 'should update rectangle preview', () => {
			controller.startDrawing( startPoint, 'rectangle', style );
			controller.continueDrawing( { x: 200, y: 180 } );

			expect( controller.tempLayer.width ).toBe( 100 );
			expect( controller.tempLayer.height ).toBe( 80 );
		} );

		it( 'should update circle preview', () => {
			controller.startDrawing( startPoint, 'circle', style );
			controller.continueDrawing( { x: 150, y: 100 } );

			expect( controller.tempLayer.radius ).toBe( 50 );
		} );

		it( 'should update ellipse preview', () => {
			controller.startDrawing( startPoint, 'ellipse', style );
			controller.continueDrawing( { x: 160, y: 140 } );

			// Ellipse center should be midpoint, radii are half the drag distance
			// Start: 100,100 -> End: 160,140
			// Center: (130, 120), radiusX: 30, radiusY: 20
			expect( controller.tempLayer.radiusX ).toBe( 30 );
			expect( controller.tempLayer.radiusY ).toBe( 20 );
			expect( controller.tempLayer.x ).toBe( 130 );
			expect( controller.tempLayer.y ).toBe( 120 );
		} );

		it( 'should update polygon preview', () => {
			controller.startDrawing( startPoint, 'polygon', style );
			controller.continueDrawing( { x: 150, y: 100 } );

			expect( controller.tempLayer.radius ).toBe( 50 );
		} );

		it( 'should update star preview', () => {
			controller.startDrawing( startPoint, 'star', style );
			controller.continueDrawing( { x: 180, y: 100 } );

			expect( controller.tempLayer.outerRadius ).toBe( 80 );
			expect( controller.tempLayer.innerRadius ).toBe( 40 );
		} );

		it( 'should update line preview', () => {
			controller.startDrawing( startPoint, 'line', style );
			controller.continueDrawing( { x: 200, y: 200 } );

			expect( controller.tempLayer.x2 ).toBe( 200 );
			expect( controller.tempLayer.y2 ).toBe( 200 );
		} );

		it( 'should update arrow preview', () => {
			controller.startDrawing( startPoint, 'arrow', style );
			controller.continueDrawing( { x: 250, y: 150 } );

			expect( controller.tempLayer.x2 ).toBe( 250 );
			expect( controller.tempLayer.y2 ).toBe( 150 );
		} );

		it( 'should add points to path for pen tool', () => {
			controller.startDrawing( startPoint, 'pen', style );
			controller.continueDrawing( { x: 110, y: 105 } );
			controller.continueDrawing( { x: 120, y: 110 } );

			expect( controller.tempLayer.points ).toHaveLength( 3 );
		} );

		it( 'should do nothing if no temp layer', () => {
			// Should not throw
			controller.continueDrawing( { x: 200, y: 200 } );
			expect( controller.tempLayer ).toBeNull();
		} );
	} );

	describe( 'finishDrawing', () => {
		const startPoint = { x: 100, y: 100 };
		const style = { color: '#000000', strokeWidth: 2 };

		it( 'should create rectangle layer', () => {
			controller.startDrawing( startPoint, 'rectangle', style );
			controller.continueDrawing( { x: 200, y: 200 } );

			const result = controller.finishDrawing( { x: 200, y: 200 }, 'rectangle' );

			expect( result ).not.toBeNull();
			expect( result.type ).toBe( 'rectangle' );
			expect( result.width ).toBe( 100 );
			expect( result.height ).toBe( 100 );
			expect( controller.isDrawing ).toBe( false );
		} );

		it( 'should create circle layer', () => {
			controller.startDrawing( startPoint, 'circle', style );

			const result = controller.finishDrawing( { x: 150, y: 100 }, 'circle' );

			expect( result.type ).toBe( 'circle' );
			expect( result.radius ).toBe( 50 );
		} );

		it( 'should create ellipse layer', () => {
			controller.startDrawing( startPoint, 'ellipse', style );

			const result = controller.finishDrawing( { x: 180, y: 140 }, 'ellipse' );

			expect( result.type ).toBe( 'ellipse' );
			expect( result.radiusX ).toBe( 80 );
			expect( result.radiusY ).toBe( 40 );
		} );

		it( 'should create polygon layer', () => {
			controller.startDrawing( startPoint, 'polygon', style );

			const result = controller.finishDrawing( { x: 160, y: 100 }, 'polygon' );

			expect( result.type ).toBe( 'polygon' );
			expect( result.radius ).toBe( 60 );
		} );

		it( 'should create star layer with inner/outer radius', () => {
			controller.startDrawing( startPoint, 'star', style );

			const result = controller.finishDrawing( { x: 170, y: 100 }, 'star' );

			expect( result.type ).toBe( 'star' );
			expect( result.outerRadius ).toBe( 70 );
			expect( result.innerRadius ).toBe( 35 );
		} );

		it( 'should create line layer', () => {
			controller.startDrawing( startPoint, 'line', style );

			const result = controller.finishDrawing( { x: 200, y: 150 }, 'line' );

			expect( result.type ).toBe( 'line' );
			expect( result.x2 ).toBe( 200 );
			expect( result.y2 ).toBe( 150 );
		} );

		it( 'should create arrow layer', () => {
			controller.startDrawing( startPoint, 'arrow', style );

			const result = controller.finishDrawing( { x: 200, y: 150 }, 'arrow' );

			expect( result.type ).toBe( 'arrow' );
			expect( result.x2 ).toBe( 200 );
		} );

		it( 'should create path layer', () => {
			controller.startDrawing( startPoint, 'pen', style );
			controller.continueDrawing( { x: 110, y: 110 } );
			controller.continueDrawing( { x: 120, y: 120 } );

			const result = controller.finishDrawing( { x: 130, y: 130 }, 'pen' );

			expect( result.type ).toBe( 'path' );
			expect( result.points.length ).toBeGreaterThanOrEqual( 2 );
		} );

		it( 'should return null for shapes below minimum size', () => {
			controller.startDrawing( startPoint, 'rectangle', style );

			// Very small shape
			const result = controller.finishDrawing( { x: 101, y: 101 }, 'rectangle' );

			expect( result ).toBeNull();
		} );

		it( 'should return null if no temp layer', () => {
			const result = controller.finishDrawing( { x: 200, y: 200 }, 'rectangle' );
			expect( result ).toBeNull();
		} );

		it( 'should clean up temp layer after finishing', () => {
			controller.startDrawing( startPoint, 'rectangle', style );
			controller.finishDrawing( { x: 200, y: 200 }, 'rectangle' );

			expect( controller.tempLayer ).toBeNull();
		} );
	} );

	describe( 'getTempLayer', () => {
		it( 'should return null when no drawing', () => {
			expect( controller.getTempLayer() ).toBeNull();
		} );

		it( 'should return temp layer during drawing', () => {
			controller.startDrawing( { x: 50, y: 50 }, 'rectangle', {} );
			expect( controller.getTempLayer() ).not.toBeNull();
		} );
	} );

	describe( 'getIsDrawing', () => {
		it( 'should return false initially', () => {
			expect( controller.getIsDrawing() ).toBe( false );
		} );

		it( 'should return true during drawing', () => {
			controller.startDrawing( { x: 50, y: 50 }, 'circle', {} );
			expect( controller.getIsDrawing() ).toBe( true );
		} );
	} );

	describe( 'setIsDrawing', () => {
		it( 'should set drawing state', () => {
			controller.setIsDrawing( true );
			expect( controller.isDrawing ).toBe( true );

			controller.setIsDrawing( false );
			expect( controller.isDrawing ).toBe( false );
		} );
	} );

	describe( 'Tool-specific start methods', () => {
		const point = { x: 50, y: 50 };
		const style = { color: '#00ff00', strokeWidth: 4, fill: '#0000ff' };

		describe( 'startTextTool', () => {
			it( 'should create text input modal', () => {
				controller.startTextTool( point, style );

				expect( mockCanvasManager.createTextInputModal ).toHaveBeenCalledWith( point, style );
			} );

			it( 'should set isDrawing to false', () => {
				controller.isDrawing = true;
				controller.startTextTool( point, style );

				expect( controller.isDrawing ).toBe( false );
			} );

			it( 'should handle missing createTextInputModal method', () => {
				controller.canvasManager.createTextInputModal = undefined;

				// Should not throw
				controller.startTextTool( point, style );
			} );
		} );

		describe( 'startPenTool', () => {
			it( 'should create path with initial point', () => {
				controller.startPenTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'path' );
				expect( controller.tempLayer.points ).toEqual( [ point ] );
				expect( controller.tempLayer.fill ).toBe( 'none' );
			} );
		} );

		describe( 'startRectangleTool', () => {
			it( 'should create rectangle with fill from style', () => {
				controller.startRectangleTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'rectangle' );
				expect( controller.tempLayer.fill ).toBe( '#0000ff' );
			} );

			it( 'should use transparent fill if not provided', () => {
				controller.startRectangleTool( point, { color: '#000000' } );

				expect( controller.tempLayer.fill ).toBe( 'transparent' );
			} );
		} );

		describe( 'startCircleTool', () => {
			it( 'should create circle with zero radius', () => {
				controller.startCircleTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'circle' );
				expect( controller.tempLayer.radius ).toBe( 0 );
			} );
		} );

		describe( 'startEllipseTool', () => {
			it( 'should create ellipse with zero radii', () => {
				controller.startEllipseTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'ellipse' );
				expect( controller.tempLayer.radiusX ).toBe( 0 );
				expect( controller.tempLayer.radiusY ).toBe( 0 );
			} );
		} );

		describe( 'startPolygonTool', () => {
			it( 'should create hexagon by default', () => {
				controller.startPolygonTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'polygon' );
				expect( controller.tempLayer.sides ).toBe( 6 );
			} );
		} );

		describe( 'startStarTool', () => {
			it( 'should create 5-pointed star by default', () => {
				controller.startStarTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'star' );
				expect( controller.tempLayer.points ).toBe( 5 );
			} );
		} );

		describe( 'startLineTool', () => {
			it( 'should create line with same start and end', () => {
				controller.startLineTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'line' );
				expect( controller.tempLayer.x1 ).toBe( point.x );
				expect( controller.tempLayer.y1 ).toBe( point.y );
				expect( controller.tempLayer.x2 ).toBe( point.x );
				expect( controller.tempLayer.y2 ).toBe( point.y );
			} );
		} );

		describe( 'startArrowTool', () => {
			it( 'should create arrow with default size', () => {
				controller.startArrowTool( point, style );

				expect( controller.tempLayer.type ).toBe( 'arrow' );
				expect( controller.tempLayer.arrowSize ).toBe( 10 );
				expect( controller.tempLayer.arrowStyle ).toBe( 'single' );
			} );

			it( 'should use arrowStyle from style if provided', () => {
				controller.startArrowTool( point, { ...style, arrowStyle: 'double' } );

				expect( controller.tempLayer.arrowStyle ).toBe( 'double' );
			} );
		} );

	} );

	describe( 'updatePreview', () => {
		const point = { x: 50, y: 50 };
		const style = { color: '#000000', strokeWidth: 2 };

		it( 'should do nothing if no temp layer', () => {
			// Should not throw
			controller.updatePreview( { x: 100, y: 100 } );
		} );

		it( 'should handle unknown layer type gracefully', () => {
			controller.tempLayer = { type: 'unknown' };
			// Should not throw
			controller.updatePreview( { x: 100, y: 100 } );
		} );
	} );

	describe( 'drawPreview', () => {
		it( 'should do nothing if no temp layer', () => {
			controller.drawPreview();
			expect( mockRenderer.drawLayer ).not.toHaveBeenCalled();
		} );

		it( 'should call renderer to draw temp layer', () => {
			controller.startDrawing( { x: 50, y: 50 }, 'rectangle', {} );
			controller.drawPreview();

			expect( mockRenderer.drawLayer ).toHaveBeenCalledWith( controller.tempLayer );
		} );

		it( 'should handle missing renderer gracefully', () => {
			controller.canvasManager.renderer = null;
			controller.startDrawing( { x: 50, y: 50 }, 'circle', {} );

			// Should not throw
			controller.drawPreview();
		} );
	} );

	describe( 'isValidShape', () => {
		it( 'should validate rectangle size', () => {
			expect( controller.isValidShape( {
				type: 'rectangle',
				width: 10,
				height: 10
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'rectangle',
				width: 2,
				height: 10
			} ) ).toBe( false );

			expect( controller.isValidShape( {
				type: 'rectangle',
				width: 10,
				height: 2
			} ) ).toBe( false );
		} );

		it( 'should validate negative dimensions for rectangle', () => {
			expect( controller.isValidShape( {
				type: 'rectangle',
				width: -10,
				height: -10
			} ) ).toBe( true );
		} );

		it( 'should validate circle radius', () => {
			expect( controller.isValidShape( {
				type: 'circle',
				radius: 10
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'circle',
				radius: 3
			} ) ).toBe( false );
		} );

		it( 'should validate ellipse radii (at least one must be valid)', () => {
			expect( controller.isValidShape( {
				type: 'ellipse',
				radiusX: 10,
				radiusY: 3
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'ellipse',
				radiusX: 3,
				radiusY: 10
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'ellipse',
				radiusX: 2,
				radiusY: 2
			} ) ).toBe( false );
		} );

		it( 'should validate polygon radius', () => {
			expect( controller.isValidShape( {
				type: 'polygon',
				radius: 10
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'polygon',
				radius: 2
			} ) ).toBe( false );
		} );

		it( 'should validate star outer radius', () => {
			expect( controller.isValidShape( {
				type: 'star',
				outerRadius: 10
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'star',
				outerRadius: 2
			} ) ).toBe( false );
		} );

		it( 'should validate line length', () => {
			expect( controller.isValidShape( {
				type: 'line',
				x1: 0,
				y1: 0,
				x2: 10,
				y2: 0
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'line',
				x1: 0,
				y1: 0,
				x2: 2,
				y2: 2
			} ) ).toBe( false ); // ~2.83 length
		} );

		it( 'should validate arrow length', () => {
			expect( controller.isValidShape( {
				type: 'arrow',
				x1: 0,
				y1: 0,
				x2: 0,
				y2: 10
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'arrow',
				x1: 0,
				y1: 0,
				x2: 1,
				y2: 1
			} ) ).toBe( false );
		} );

		it( 'should validate path points count', () => {
			expect( controller.isValidShape( {
				type: 'path',
				points: [ { x: 0, y: 0 }, { x: 10, y: 10 } ]
			} ) ).toBe( true );

			expect( controller.isValidShape( {
				type: 'path',
				points: [ { x: 0, y: 0 } ]
			} ) ).toBe( false );

			// Path without points returns falsy (undefined)
			expect( controller.isValidShape( {
				type: 'path'
			} ) ).toBeFalsy();
		} );

		it( 'should return true for unknown types', () => {
			expect( controller.isValidShape( {
				type: 'custom'
			} ) ).toBe( true );
		} );
	} );

	describe( 'getToolCursor', () => {
		it( 'should return crosshair for drawing tools', () => {
			const crosshairTools = [
				'pen', 'rectangle', 'circle', 'ellipse',
				'polygon', 'star', 'line', 'arrow'
			];

			for ( const tool of crosshairTools ) {
				expect( controller.getToolCursor( tool ) ).toBe( 'crosshair' );
			}
		} );

		it( 'should return text cursor for text tool', () => {
			expect( controller.getToolCursor( 'text' ) ).toBe( 'text' );
		} );

		it( 'should return default for unknown tools', () => {
			expect( controller.getToolCursor( 'select' ) ).toBe( 'default' );
			expect( controller.getToolCursor( 'unknown' ) ).toBe( 'default' );
		} );
	} );

	describe( 'isDrawingTool', () => {
		it( 'should return true for all drawing tools', () => {
			const drawingTools = [
				'text', 'pen', 'rectangle', 'circle',
				'ellipse', 'polygon', 'star', 'line', 'arrow'
			];

			for ( const tool of drawingTools ) {
				expect( controller.isDrawingTool( tool ) ).toBe( true );
			}
		} );

		it( 'should return false for non-drawing tools', () => {
			expect( controller.isDrawingTool( 'select' ) ).toBe( false );
			expect( controller.isDrawingTool( 'pan' ) ).toBe( false );
			expect( controller.isDrawingTool( 'zoom' ) ).toBe( false );
			expect( controller.isDrawingTool( 'unknown' ) ).toBe( false );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all resources', () => {
			controller.startDrawing( { x: 50, y: 50 }, 'rectangle', {} );

			controller.destroy();

			expect( controller.tempLayer ).toBeNull();
			expect( controller.isDrawing ).toBe( false );
			expect( controller.canvasManager ).toBeNull();
		} );
	} );

	// ==================== Integration Tests ====================

	describe( 'Complete drawing workflow', () => {
		it( 'should complete a full rectangle drawing cycle', () => {
			const style = { color: '#ff0000', strokeWidth: 2, fill: '#00ff00' };

			// Start
			controller.startDrawing( { x: 50, y: 50 }, 'rectangle', style );
			expect( controller.isDrawing ).toBe( true );

			// Continue
			controller.continueDrawing( { x: 100, y: 80 } );
			expect( controller.tempLayer.width ).toBe( 50 );
			expect( controller.tempLayer.height ).toBe( 30 );

			// Draw preview
			controller.drawPreview();
			expect( mockRenderer.drawLayer ).toHaveBeenCalled();

			// Finish
			const layer = controller.finishDrawing( { x: 150, y: 100 }, 'rectangle' );
			expect( layer ).not.toBeNull();
			expect( layer.type ).toBe( 'rectangle' );
			expect( layer.width ).toBe( 100 );
			expect( layer.height ).toBe( 50 );
			expect( layer.stroke ).toBe( '#ff0000' );
			expect( layer.fill ).toBe( '#00ff00' );
			expect( controller.isDrawing ).toBe( false );
		} );

		it( 'should complete a full pen drawing cycle', () => {
			const style = { color: '#0000ff', strokeWidth: 3 };

			controller.startDrawing( { x: 10, y: 10 }, 'pen', style );

			// Add multiple points
			controller.continueDrawing( { x: 20, y: 15 } );
			controller.continueDrawing( { x: 30, y: 20 } );
			controller.continueDrawing( { x: 40, y: 25 } );

			const layer = controller.finishDrawing( { x: 50, y: 30 }, 'pen' );

			expect( layer.type ).toBe( 'path' );
			expect( layer.points.length ).toBe( 4 ); // 1 initial + 3 from continueDrawing
		} );

		it( 'should reject undersized shapes', () => {
			controller.startDrawing( { x: 100, y: 100 }, 'circle', {} );
			controller.continueDrawing( { x: 101, y: 101 } );

			const layer = controller.finishDrawing( { x: 102, y: 102 }, 'circle' );

			// Radius would be ~2.83, below minimum of 5
			expect( layer ).toBeNull();
		} );
	} );
} );
