/**
 * Tests for GridRulersController.js
 *
 * GridRulersController handles grid, rulers, and guides for the canvas.
 */

const GridRulersController = require( '../../resources/ext.layers.editor/canvas/GridRulersController.js' );

describe( 'GridRulersController', () => {
	let controller;
	let mockManager;
	let mockRenderer;
	let mockEditor;

	beforeEach( () => {
		// Create mock renderer
		mockRenderer = {
			drawGrid: jest.fn(),
			drawRulers: jest.fn(),
			drawGuides: jest.fn(),
			drawGuidePreview: jest.fn()
		};

		// Create mock editor
		mockEditor = {
			layers: []
		};

		// Create mock manager
		mockManager = {
			renderer: mockRenderer,
			editor: mockEditor,
			showGrid: false,
			showRulers: false,
			showGuides: false,
			snapToGrid: false,
			snapToGuides: false,
			smartGuides: false,
			gridSize: 20,
			horizontalGuides: [],
			verticalGuides: [],
			isDraggingGuide: false,
			dragGuideOrientation: null,
			dragGuidePos: 0,
			redraw: jest.fn(),
			renderLayers: jest.fn()
		};

		controller = new GridRulersController( mockManager );
	} );

	describe( 'constructor', () => {
		it( 'should initialize with correct defaults', () => {
			expect( controller.manager ).toBe( mockManager );
			expect( controller.gridSize ).toBe( 20 );
			expect( controller.rulerSize ).toBe( 20 );
			expect( controller.horizontalGuides ).toEqual( [] );
			expect( controller.verticalGuides ).toEqual( [] );
			expect( controller.isDraggingGuide ).toBe( false );
			expect( controller.dragGuideOrientation ).toBeNull();
			expect( controller.dragGuidePos ).toBe( 0 );
		} );
	} );

	// ==================== Visibility Methods ====================

	describe( 'isGridVisible', () => {
		it( 'should return manager showGrid state', () => {
			mockManager.showGrid = true;
			expect( controller.isGridVisible() ).toBe( true );

			mockManager.showGrid = false;
			expect( controller.isGridVisible() ).toBe( false );
		} );
	} );

	describe( 'areRulersVisible', () => {
		it( 'should return manager showRulers state', () => {
			mockManager.showRulers = true;
			expect( controller.areRulersVisible() ).toBe( true );

			mockManager.showRulers = false;
			expect( controller.areRulersVisible() ).toBe( false );
		} );
	} );

	describe( 'areGuidesVisible', () => {
		it( 'should return manager showGuides state', () => {
			mockManager.showGuides = true;
			expect( controller.areGuidesVisible() ).toBe( true );

			mockManager.showGuides = false;
			expect( controller.areGuidesVisible() ).toBe( false );
		} );
	} );

	// ==================== Toggle Methods ====================

	describe( 'toggleGrid', () => {
		it( 'should toggle grid visibility', () => {
			mockManager.showGrid = false;
			controller.toggleGrid();

			expect( mockManager.showGrid ).toBe( true );
			expect( mockManager.redraw ).toHaveBeenCalled();
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should toggle off when already on', () => {
			mockManager.showGrid = true;
			controller.toggleGrid();

			expect( mockManager.showGrid ).toBe( false );
		} );
	} );

	describe( 'toggleRulers', () => {
		it( 'should toggle rulers visibility', () => {
			mockManager.showRulers = false;
			controller.toggleRulers();

			expect( mockManager.showRulers ).toBe( true );
			expect( mockManager.redraw ).toHaveBeenCalled();
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'toggleGuidesVisibility', () => {
		it( 'should toggle guides visibility', () => {
			mockManager.showGuides = false;
			controller.toggleGuidesVisibility();

			expect( mockManager.showGuides ).toBe( true );
			expect( mockManager.redraw ).toHaveBeenCalled();
		} );
	} );

	describe( 'toggleSnapToGrid', () => {
		it( 'should toggle snap to grid', () => {
			mockManager.snapToGrid = false;
			controller.toggleSnapToGrid();

			expect( mockManager.snapToGrid ).toBe( true );
		} );

		it( 'should toggle off when already on', () => {
			mockManager.snapToGrid = true;
			controller.toggleSnapToGrid();

			expect( mockManager.snapToGrid ).toBe( false );
		} );
	} );

	describe( 'toggleSnapToGuides', () => {
		it( 'should toggle snap to guides', () => {
			mockManager.snapToGuides = false;
			controller.toggleSnapToGuides();

			expect( mockManager.snapToGuides ).toBe( true );
		} );
	} );

	describe( 'toggleSmartGuides', () => {
		it( 'should toggle smart guides', () => {
			mockManager.smartGuides = false;
			controller.toggleSmartGuides();

			expect( mockManager.smartGuides ).toBe( true );
		} );
	} );

	// ==================== Grid Methods ====================

	describe( 'setGridSize', () => {
		it( 'should set grid size on controller and manager', () => {
			controller.setGridSize( 50 );

			expect( controller.gridSize ).toBe( 50 );
			expect( mockManager.gridSize ).toBe( 50 );
		} );

		it( 'should redraw when grid is visible', () => {
			mockManager.showGrid = true;
			controller.setGridSize( 30 );

			expect( mockManager.redraw ).toHaveBeenCalled();
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should not redraw when grid is hidden', () => {
			mockManager.showGrid = false;
			controller.setGridSize( 40 );

			expect( mockManager.redraw ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'drawGrid', () => {
		it( 'should delegate to renderer', () => {
			controller.drawGrid();

			expect( mockRenderer.drawGrid ).toHaveBeenCalled();
		} );

		it( 'should handle missing renderer gracefully', () => {
			mockManager.renderer = null;

			// Should not throw
			controller.drawGrid();
		} );
	} );

	describe( 'drawRulers', () => {
		it( 'should delegate to renderer', () => {
			controller.drawRulers();

			expect( mockRenderer.drawRulers ).toHaveBeenCalled();
		} );

		it( 'should handle missing renderer gracefully', () => {
			mockManager.renderer = null;
			controller.drawRulers();
			// Should not throw
		} );
	} );

	describe( 'drawGuides', () => {
		it( 'should delegate to renderer', () => {
			controller.drawGuides();

			expect( mockRenderer.drawGuides ).toHaveBeenCalled();
		} );
	} );

	describe( 'drawGuidePreview', () => {
		it( 'should delegate to renderer', () => {
			controller.drawGuidePreview();

			expect( mockRenderer.drawGuidePreview ).toHaveBeenCalled();
		} );
	} );

	// ==================== Guide Management ====================

	describe( 'addHorizontalGuide', () => {
		it( 'should add a horizontal guide', () => {
			controller.addHorizontalGuide( 100 );

			expect( controller.horizontalGuides ).toContain( 100 );
			expect( mockManager.horizontalGuides ).toContain( 100 );
		} );

		it( 'should not add duplicate guides', () => {
			controller.addHorizontalGuide( 100 );
			controller.addHorizontalGuide( 100 );

			expect( controller.horizontalGuides.filter( ( g ) => g === 100 ) ).toHaveLength( 1 );
		} );

		it( 'should redraw when guides are visible', () => {
			mockManager.showGuides = true;
			controller.addHorizontalGuide( 150 );

			expect( mockManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should not redraw when guides are hidden', () => {
			mockManager.showGuides = false;
			controller.addHorizontalGuide( 200 );

			expect( mockManager.redraw ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'addVerticalGuide', () => {
		it( 'should add a vertical guide', () => {
			controller.addVerticalGuide( 200 );

			expect( controller.verticalGuides ).toContain( 200 );
			expect( mockManager.verticalGuides ).toContain( 200 );
		} );

		it( 'should not add duplicate guides', () => {
			controller.addVerticalGuide( 200 );
			controller.addVerticalGuide( 200 );

			expect( controller.verticalGuides.filter( ( g ) => g === 200 ) ).toHaveLength( 1 );
		} );

		it( 'should redraw when guides are visible', () => {
			mockManager.showGuides = true;
			controller.addVerticalGuide( 250 );

			expect( mockManager.redraw ).toHaveBeenCalled();
			expect( mockManager.renderLayers ).toHaveBeenCalledWith( mockEditor.layers );
		} );

		it( 'should not redraw when guides are hidden', () => {
			mockManager.showGuides = false;
			controller.addVerticalGuide( 300 );

			expect( mockManager.redraw ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'removeHorizontalGuide', () => {
		it( 'should remove an existing horizontal guide', () => {
			controller.horizontalGuides = [ 100, 200, 300 ];
			controller.removeHorizontalGuide( 200 );

			expect( controller.horizontalGuides ).toEqual( [ 100, 300 ] );
			expect( mockManager.horizontalGuides ).toEqual( [ 100, 300 ] );
		} );

		it( 'should do nothing if guide not found', () => {
			controller.horizontalGuides = [ 100, 300 ];
			controller.removeHorizontalGuide( 200 );

			expect( controller.horizontalGuides ).toEqual( [ 100, 300 ] );
		} );

		it( 'should redraw when guides are visible', () => {
			mockManager.showGuides = true;
			controller.horizontalGuides = [ 100 ];
			controller.removeHorizontalGuide( 100 );

			expect( mockManager.redraw ).toHaveBeenCalled();
		} );
	} );

	describe( 'removeVerticalGuide', () => {
		it( 'should remove an existing vertical guide', () => {
			controller.verticalGuides = [ 50, 150, 250 ];
			controller.removeVerticalGuide( 150 );

			expect( controller.verticalGuides ).toEqual( [ 50, 250 ] );
			expect( mockManager.verticalGuides ).toEqual( [ 50, 250 ] );
		} );

		it( 'should do nothing if guide not found', () => {
			controller.verticalGuides = [ 50, 250 ];
			controller.removeVerticalGuide( 100 );

			expect( controller.verticalGuides ).toEqual( [ 50, 250 ] );
		} );

		it( 'should redraw when guides are visible', () => {
			mockManager.showGuides = true;
			controller.verticalGuides = [ 150 ];
			controller.removeVerticalGuide( 150 );

			expect( mockManager.redraw ).toHaveBeenCalled();
			expect( mockManager.renderLayers ).toHaveBeenCalledWith( mockEditor.layers );
		} );

		it( 'should not redraw when guides are hidden', () => {
			mockManager.showGuides = false;
			controller.verticalGuides = [ 150 ];
			controller.removeVerticalGuide( 150 );

			expect( mockManager.redraw ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'clearAllGuides', () => {
		it( 'should clear all horizontal and vertical guides', () => {
			controller.horizontalGuides = [ 100, 200 ];
			controller.verticalGuides = [ 50, 150 ];

			controller.clearAllGuides();

			expect( controller.horizontalGuides ).toEqual( [] );
			expect( controller.verticalGuides ).toEqual( [] );
			expect( mockManager.horizontalGuides ).toEqual( [] );
			expect( mockManager.verticalGuides ).toEqual( [] );
		} );

		it( 'should redraw when guides are visible', () => {
			mockManager.showGuides = true;
			controller.horizontalGuides = [ 100 ];

			controller.clearAllGuides();

			expect( mockManager.redraw ).toHaveBeenCalled();
		} );
	} );

	// ==================== Snapping Methods ====================

	describe( 'snapPointToGrid', () => {
		it( 'should return original point when snap is disabled', () => {
			mockManager.snapToGrid = false;

			const result = controller.snapPointToGrid( 47, 63 );

			expect( result ).toEqual( { x: 47, y: 63 } );
		} );

		it( 'should snap point to grid when enabled', () => {
			mockManager.snapToGrid = true;
			controller.gridSize = 20;

			const result = controller.snapPointToGrid( 47, 63 );

			expect( result ).toEqual( { x: 40, y: 60 } );
		} );

		it( 'should snap to nearest grid point', () => {
			mockManager.snapToGrid = true;
			controller.gridSize = 10;

			expect( controller.snapPointToGrid( 4, 4 ) ).toEqual( { x: 0, y: 0 } );
			expect( controller.snapPointToGrid( 6, 6 ) ).toEqual( { x: 10, y: 10 } );
			expect( controller.snapPointToGrid( 5, 5 ) ).toEqual( { x: 10, y: 10 } );
		} );

		it( 'should use default grid size of 20 if not set', () => {
			mockManager.snapToGrid = true;
			controller.gridSize = 0;

			const result = controller.snapPointToGrid( 35, 35 );

			expect( result ).toEqual( { x: 40, y: 40 } );
		} );
	} );

	describe( 'getGuideSnapDelta', () => {
		const bounds = { x: 100, y: 100, width: 50, height: 30 };

		it( 'should return zero delta when no guides exist', () => {
			mockManager.verticalGuides = [];
			mockManager.horizontalGuides = [];

			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result ).toEqual( { dx: 0, dy: 0 } );
		} );

		it( 'should snap left edge to vertical guide', () => {
			mockManager.verticalGuides = [ 105 ];
			mockManager.horizontalGuides = [];

			// bounds.x (100) + deltaX (0) = 100, guide at 105
			// 105 - 100 = 5, which is within tolerance
			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result.dx ).toBe( 5 );
		} );

		it( 'should snap right edge to vertical guide', () => {
			mockManager.verticalGuides = [ 155 ];
			mockManager.horizontalGuides = [];

			// right = 100 + 50 = 150, guide at 155
			// 155 - 150 = 5, within tolerance
			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result.dx ).toBe( 5 );
		} );

		it( 'should snap center X to vertical guide', () => {
			mockManager.verticalGuides = [ 128 ];
			mockManager.horizontalGuides = [];

			// centerX = 100 + 25 = 125, guide at 128
			// 128 - 125 = 3, within tolerance
			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result.dx ).toBe( 3 );
		} );

		it( 'should snap top edge to horizontal guide', () => {
			mockManager.verticalGuides = [];
			mockManager.horizontalGuides = [ 104 ];

			// top = 100, guide at 104
			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result.dy ).toBe( 4 );
		} );

		it( 'should snap bottom edge to horizontal guide', () => {
			mockManager.verticalGuides = [];
			mockManager.horizontalGuides = [ 135 ];

			// bottom = 100 + 30 = 130, guide at 135
			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result.dy ).toBe( 5 );
		} );

		it( 'should snap center Y to horizontal guide', () => {
			mockManager.verticalGuides = [];
			mockManager.horizontalGuides = [ 118 ];

			// centerY = 100 + 15 = 115, guide at 118
			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result.dy ).toBe( 3 );
		} );

		it( 'should use provided delta in calculations', () => {
			mockManager.verticalGuides = [ 200 ];
			mockManager.horizontalGuides = [];

			// left = 100 + deltaX(95) = 195, guide at 200
			const result = controller.getGuideSnapDelta( bounds, 95, 0, 6 );

			expect( result.dx ).toBe( 5 );
		} );

		it( 'should not snap when outside tolerance', () => {
			mockManager.verticalGuides = [ 200 ];
			mockManager.horizontalGuides = [ 200 ];

			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result ).toEqual( { dx: 0, dy: 0 } );
		} );

		it( 'should use controller guides as fallback', () => {
			mockManager.verticalGuides = undefined;
			mockManager.horizontalGuides = undefined;
			controller.verticalGuides = [ 103 ];
			controller.horizontalGuides = [ 103 ];

			const result = controller.getGuideSnapDelta( bounds, 0, 0, 6 );

			expect( result.dx ).toBe( 3 );
			expect( result.dy ).toBe( 3 );
		} );

		it( 'should use default tolerance of 6', () => {
			mockManager.verticalGuides = [ 106 ];
			mockManager.horizontalGuides = [];

			const result = controller.getGuideSnapDelta( bounds, 0, 0 );

			expect( result.dx ).toBe( 6 ); // 106 - 100 = 6, exactly at tolerance
		} );

		it( 'should handle bounds with missing properties', () => {
			mockManager.verticalGuides = [ 5 ];
			mockManager.horizontalGuides = [ 5 ];

			const result = controller.getGuideSnapDelta( {}, 0, 0, 6 );

			expect( result.dx ).toBe( 5 ); // 0 + 0 = 0, guide at 5
			expect( result.dy ).toBe( 5 );
		} );
	} );

	// ==================== Guide Dragging ====================

	describe( 'startGuideDrag', () => {
		it( 'should initialize horizontal guide drag', () => {
			controller.startGuideDrag( 'h', 150 );

			expect( controller.isDraggingGuide ).toBe( true );
			expect( controller.dragGuideOrientation ).toBe( 'h' );
			expect( controller.dragGuidePos ).toBe( 150 );
			expect( mockManager.isDraggingGuide ).toBe( true );
			expect( mockManager.dragGuideOrientation ).toBe( 'h' );
			expect( mockManager.dragGuidePos ).toBe( 150 );
		} );

		it( 'should initialize vertical guide drag', () => {
			controller.startGuideDrag( 'v', 200 );

			expect( controller.dragGuideOrientation ).toBe( 'v' );
			expect( controller.dragGuidePos ).toBe( 200 );
		} );
	} );

	describe( 'updateGuideDrag', () => {
		it( 'should update guide position during drag', () => {
			controller.startGuideDrag( 'h', 100 );
			controller.updateGuideDrag( 175 );

			expect( controller.dragGuidePos ).toBe( 175 );
			expect( mockManager.dragGuidePos ).toBe( 175 );
			expect( mockRenderer.drawGuidePreview ).toHaveBeenCalled();
		} );
	} );

	describe( 'finishGuideDrag', () => {
		it( 'should add horizontal guide on finish', () => {
			controller.startGuideDrag( 'h', 100 );
			controller.finishGuideDrag( 250 );

			expect( controller.horizontalGuides ).toContain( 250 );
			expect( controller.isDraggingGuide ).toBe( false );
			expect( controller.dragGuideOrientation ).toBeNull();
			expect( controller.dragGuidePos ).toBe( 0 );
		} );

		it( 'should add vertical guide on finish', () => {
			controller.startGuideDrag( 'v', 50 );
			controller.finishGuideDrag( 300 );

			expect( controller.verticalGuides ).toContain( 300 );
		} );

		it( 'should reset manager state', () => {
			controller.startGuideDrag( 'h', 100 );
			controller.finishGuideDrag( 150 );

			expect( mockManager.isDraggingGuide ).toBe( false );
			expect( mockManager.dragGuideOrientation ).toBeNull();
			expect( mockManager.dragGuidePos ).toBe( 0 );
		} );
	} );

	describe( 'cancelGuideDrag', () => {
		it( 'should reset all drag state', () => {
			controller.startGuideDrag( 'h', 100 );
			controller.cancelGuideDrag();

			expect( controller.isDraggingGuide ).toBe( false );
			expect( controller.dragGuideOrientation ).toBeNull();
			expect( controller.dragGuidePos ).toBe( 0 );
			expect( mockManager.isDraggingGuide ).toBe( false );
		} );

		it( 'should trigger redraw', () => {
			controller.startGuideDrag( 'v', 200 );
			controller.cancelGuideDrag();

			expect( mockManager.redraw ).toHaveBeenCalled();
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );
	} );

	// ==================== Integration Tests ====================

	describe( 'guide workflow', () => {
		it( 'should complete a full guide drag workflow', () => {
			// Start drag from ruler
			controller.startGuideDrag( 'h', 100 );
			expect( controller.isDraggingGuide ).toBe( true );

			// Move guide
			controller.updateGuideDrag( 150 );
			expect( controller.dragGuidePos ).toBe( 150 );

			// Finish drag
			controller.finishGuideDrag( 200 );
			expect( controller.horizontalGuides ).toContain( 200 );
			expect( controller.isDraggingGuide ).toBe( false );
		} );

		it( 'should cancel guide drag correctly', () => {
			controller.startGuideDrag( 'v', 50 );
			controller.updateGuideDrag( 100 );
			controller.cancelGuideDrag();

			// Guide should not be added
			expect( controller.verticalGuides ).not.toContain( 100 );
			expect( controller.isDraggingGuide ).toBe( false );
		} );
	} );

	describe( 'multiple guides', () => {
		it( 'should manage multiple guides correctly', () => {
			controller.addHorizontalGuide( 100 );
			controller.addHorizontalGuide( 200 );
			controller.addVerticalGuide( 50 );
			controller.addVerticalGuide( 150 );

			expect( controller.horizontalGuides ).toHaveLength( 2 );
			expect( controller.verticalGuides ).toHaveLength( 2 );

			controller.removeHorizontalGuide( 100 );
			expect( controller.horizontalGuides ).toEqual( [ 200 ] );

			controller.clearAllGuides();
			expect( controller.horizontalGuides ).toEqual( [] );
			expect( controller.verticalGuides ).toEqual( [] );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all state and references', () => {
			// Add some guides first
			controller.horizontalGuides = [ 100, 200 ];
			controller.verticalGuides = [ 50, 150 ];
			controller.startGuideDrag( 'h', 100 );

			controller.destroy();

			expect( controller.horizontalGuides ).toEqual( [] );
			expect( controller.verticalGuides ).toEqual( [] );
			expect( controller.isDraggingGuide ).toBe( false );
			expect( controller.dragGuideOrientation ).toBeNull();
			expect( controller.dragGuidePos ).toBe( 0 );
			expect( controller.manager ).toBeNull();
		} );
	} );
} );
