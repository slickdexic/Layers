/**
 * Unit tests for InteractionController
 *
 * Tests the centralized interaction state management including:
 * - Drag, resize, rotate operations
 * - Pan and marquee selection
 * - Touch gesture detection
 * - Guide dragging
 */

'use strict';

const InteractionController = require( '../../resources/ext.layers.editor/canvas/InteractionController.js' );

describe( 'InteractionController', () => {
	let controller;
	let mockCanvasManager;

	beforeEach( () => {
		mockCanvasManager = {
			canvas: { style: {} },
			editor: { layers: [] }
		};
		controller = new InteractionController( mockCanvasManager );
	} );

	afterEach( () => {
		controller.destroy();
	} );

	describe( 'initialization', () => {
		it( 'should initialize with all states false', () => {
			expect( controller.isDragging ).toBe( false );
			expect( controller.isResizing ).toBe( false );
			expect( controller.isRotating ).toBe( false );
			expect( controller.isPanning ).toBe( false );
			expect( controller.isMarqueeSelecting ).toBe( false );
			expect( controller.isDraggingGuide ).toBe( false );
		} );

		it( 'should initialize with null points', () => {
			expect( controller.startPoint ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( controller.lastPanPoint ).toBeNull();
			expect( controller.lastTouchPoint ).toBeNull();
		} );

		it( 'should store reference to canvas manager', () => {
			expect( controller.canvasManager ).toBe( mockCanvasManager );
		} );
	} );

	describe( 'state queries', () => {
		describe( 'isManipulating', () => {
			it( 'should return false when nothing is happening', () => {
				expect( controller.isManipulating() ).toBe( false );
			} );

			it( 'should return true when dragging', () => {
				controller.isDragging = true;
				expect( controller.isManipulating() ).toBe( true );
			} );

			it( 'should return true when resizing', () => {
				controller.isResizing = true;
				expect( controller.isManipulating() ).toBe( true );
			} );

			it( 'should return true when rotating', () => {
				controller.isRotating = true;
				expect( controller.isManipulating() ).toBe( true );
			} );
		} );

		describe( 'isInteracting', () => {
			it( 'should return false when nothing is happening', () => {
				expect( controller.isInteracting() ).toBe( false );
			} );

			it( 'should return true when panning', () => {
				controller.isPanning = true;
				expect( controller.isInteracting() ).toBe( true );
			} );

			it( 'should return true when marquee selecting', () => {
				controller.isMarqueeSelecting = true;
				expect( controller.isInteracting() ).toBe( true );
			} );

			it( 'should return true when manipulating', () => {
				controller.isDragging = true;
				expect( controller.isInteracting() ).toBe( true );
			} );
		} );

		describe( 'getMode', () => {
			it( 'should return "none" by default', () => {
				expect( controller.getMode() ).toBe( 'none' );
			} );

			it( 'should return "dragging" when dragging', () => {
				controller.isDragging = true;
				expect( controller.getMode() ).toBe( 'dragging' );
			} );

			it( 'should return "resizing" when resizing', () => {
				controller.isResizing = true;
				expect( controller.getMode() ).toBe( 'resizing' );
			} );

			it( 'should return "rotating" when rotating', () => {
				controller.isRotating = true;
				expect( controller.getMode() ).toBe( 'rotating' );
			} );

			it( 'should return "panning" when panning', () => {
				controller.isPanning = true;
				expect( controller.getMode() ).toBe( 'panning' );
			} );

			it( 'should return "marquee" when marquee selecting', () => {
				controller.isMarqueeSelecting = true;
				expect( controller.getMode() ).toBe( 'marquee' );
			} );

			it( 'should prioritize dragging over panning', () => {
				controller.isDragging = true;
				controller.isPanning = true;
				expect( controller.getMode() ).toBe( 'dragging' );
			} );
		} );
	} );

	describe( 'drag operations', () => {
		it( 'should start drag correctly', () => {
			const startPoint = { x: 100, y: 100 };
			const originalState = { x: 50, y: 50, width: 100, height: 80 };
			controller.startDrag( startPoint, originalState );

			expect( controller.isDragging ).toBe( true );
			expect( controller.startPoint ).toEqual( startPoint );
			expect( controller.dragStartPoint ).toEqual( startPoint );
			expect( controller.originalLayerState ).toEqual( originalState );
			expect( controller.showDragPreview ).toBe( true );
		} );

		it( 'should deep clone original state', () => {
			const startPoint = { x: 100, y: 100 };
			const originalState = { x: 50, y: 50, width: 100, height: 80 };
			controller.startDrag( startPoint, originalState );

			// Modify original - should not affect stored state
			originalState.x = 999;
			expect( controller.originalLayerState.x ).toBe( 50 );
		} );

		it( 'should calculate drag delta correctly', () => {
			const startPoint = { x: 100, y: 100 };
			const originalState = { x: 50, y: 50, width: 100, height: 80 };
			controller.startDrag( startPoint, originalState );

			const newPoint = { x: 150, y: 120 };
			const delta = controller.updateDrag( newPoint );

			expect( delta.deltaX ).toBe( 50 );
			expect( delta.deltaY ).toBe( 20 );
		} );

		it( 'should return zero delta when not dragging', () => {
			const delta = controller.updateDrag( { x: 150, y: 120 } );

			expect( delta.deltaX ).toBe( 0 );
			expect( delta.deltaY ).toBe( 0 );
		} );

		it( 'should finish drag and return original state', () => {
			const startPoint = { x: 100, y: 100 };
			const originalState = { x: 50, y: 50, width: 100, height: 80 };
			controller.startDrag( startPoint, originalState );

			const returned = controller.finishDrag();

			expect( controller.isDragging ).toBe( false );
			expect( controller.showDragPreview ).toBe( false );
			expect( controller.startPoint ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( controller.originalLayerState ).toBeNull();
			expect( returned ).toEqual( { x: 50, y: 50, width: 100, height: 80 } );
		} );
	} );

	describe( 'resize operations', () => {
		it( 'should start resize correctly', () => {
			const handle = 'se';
			const startPoint = { x: 200, y: 180 };
			const originalState = { x: 100, y: 100, width: 100, height: 80 };
			controller.startResize( handle, startPoint, originalState );

			expect( controller.isResizing ).toBe( true );
			expect( controller.resizeHandle ).toBe( handle );
			expect( controller.startPoint ).toEqual( startPoint );
			expect( controller.originalLayerState ).toEqual( originalState );
		} );

		it( 'should calculate resize delta correctly', () => {
			const handle = 'se';
			const startPoint = { x: 200, y: 180 };
			const originalState = { x: 100, y: 100, width: 100, height: 80 };
			controller.startResize( handle, startPoint, originalState );

			const newPoint = { x: 250, y: 200 };
			const result = controller.updateResize( newPoint );

			expect( result.deltaX ).toBe( 50 );
			expect( result.deltaY ).toBe( 20 );
			expect( result.handle ).toBe( 'se' );
		} );

		it( 'should return null handle when not resizing', () => {
			const result = controller.updateResize( { x: 250, y: 200 } );

			expect( result.handle ).toBeNull();
		} );

		it( 'should finish resize and clear state', () => {
			const handle = 'se';
			const startPoint = { x: 200, y: 180 };
			const originalState = { x: 100, y: 100, width: 100, height: 80 };
			controller.startResize( handle, startPoint, originalState );

			const returned = controller.finishResize();

			expect( controller.isResizing ).toBe( false );
			expect( controller.resizeHandle ).toBeNull();
			expect( returned ).toEqual( originalState );
		} );
	} );

	describe( 'rotation operations', () => {
		it( 'should start rotation correctly', () => {
			const startPoint = { x: 200, y: 100 };
			const originalState = { x: 100, y: 100, rotation: 0 };
			controller.startRotation( startPoint, originalState );

			expect( controller.isRotating ).toBe( true );
			expect( controller.startPoint ).toEqual( startPoint );
			expect( controller.originalLayerState ).toEqual( originalState );
		} );

		it( 'should calculate rotation angle correctly', () => {
			const startPoint = { x: 200, y: 100 };
			const originalState = { x: 100, y: 100, rotation: 0 };
			controller.startRotation( startPoint, originalState );

			const center = { x: 100, y: 100 };
			// Point at 90 degrees from start
			const newPoint = { x: 100, y: 0 };

			const angle = controller.calculateRotationAngle( newPoint, center );

			// Start point is at 0 degrees (right of center)
			// New point is at -90 degrees (above center)
			// Delta should be -90 degrees
			expect( angle ).toBeCloseTo( -90, 1 );
		} );

		it( 'should return 0 when start point is null', () => {
			const angle = controller.calculateRotationAngle( { x: 100, y: 0 }, { x: 100, y: 100 } );
			expect( angle ).toBe( 0 );
		} );

		it( 'should finish rotation and clear state', () => {
			const startPoint = { x: 200, y: 100 };
			const originalState = { x: 100, y: 100, rotation: 0 };
			controller.startRotation( startPoint, originalState );

			const returned = controller.finishRotation();

			expect( controller.isRotating ).toBe( false );
			expect( returned ).toEqual( originalState );
		} );
	} );

	describe( 'pan operations', () => {
		it( 'should start pan correctly', () => {
			const startPoint = { x: 500, y: 400 };
			controller.startPan( startPoint );

			expect( controller.isPanning ).toBe( true );
			expect( controller.lastPanPoint ).toEqual( startPoint );
		} );

		it( 'should calculate pan delta correctly', () => {
			const startPoint = { x: 500, y: 400 };
			controller.startPan( startPoint );

			const newPoint = { x: 520, y: 380 };
			const delta = controller.updatePan( newPoint );

			expect( delta.deltaX ).toBe( 20 );
			expect( delta.deltaY ).toBe( -20 );
		} );

		it( 'should update lastPanPoint after each update', () => {
			const startPoint = { x: 500, y: 400 };
			controller.startPan( startPoint );

			controller.updatePan( { x: 520, y: 380 } );
			expect( controller.lastPanPoint ).toEqual( { x: 520, y: 380 } );

			const delta = controller.updatePan( { x: 540, y: 360 } );
			expect( delta.deltaX ).toBe( 20 );
			expect( delta.deltaY ).toBe( -20 );
		} );

		it( 'should return zero delta when not panning', () => {
			const delta = controller.updatePan( { x: 520, y: 380 } );

			expect( delta.deltaX ).toBe( 0 );
			expect( delta.deltaY ).toBe( 0 );
		} );

		it( 'should finish pan and clear state', () => {
			const startPoint = { x: 500, y: 400 };
			controller.startPan( startPoint );

			controller.finishPan();

			expect( controller.isPanning ).toBe( false );
			expect( controller.lastPanPoint ).toBeNull();
		} );
	} );

	describe( 'marquee selection', () => {
		it( 'should start marquee correctly', () => {
			const startPoint = { x: 100, y: 100 };
			controller.startMarquee( startPoint );

			expect( controller.isMarqueeSelecting ).toBe( true );
			expect( controller.marqueeStart ).toEqual( startPoint );
			expect( controller.marqueeEnd ).toEqual( startPoint );
		} );

		it( 'should update marquee end point', () => {
			const startPoint = { x: 100, y: 100 };
			controller.startMarquee( startPoint );

			const newPoint = { x: 300, y: 250 };
			controller.updateMarquee( newPoint );

			expect( controller.marqueeEnd ).toEqual( newPoint );
			expect( controller.marqueeStart ).toEqual( startPoint ); // Unchanged
		} );

		it( 'should not update when not selecting', () => {
			controller.updateMarquee( { x: 300, y: 250 } );

			expect( controller.marqueeEnd ).toEqual( { x: 0, y: 0 } );
		} );

		it( 'should calculate normalized marquee rect', () => {
			controller.startMarquee( { x: 300, y: 250 } );
			controller.updateMarquee( { x: 100, y: 100 } );

			const rect = controller.getMarqueeRect();

			expect( rect.x ).toBe( 100 );
			expect( rect.y ).toBe( 100 );
			expect( rect.width ).toBe( 200 );
			expect( rect.height ).toBe( 150 );
		} );

		it( 'should finish marquee and return rect', () => {
			const startPoint = { x: 100, y: 100 };
			controller.startMarquee( startPoint );
			controller.updateMarquee( { x: 300, y: 250 } );

			const rect = controller.finishMarquee();

			expect( controller.isMarqueeSelecting ).toBe( false );
			expect( controller.marqueeStart ).toEqual( { x: 0, y: 0 } );
			expect( controller.marqueeEnd ).toEqual( { x: 0, y: 0 } );
			expect( rect.x ).toBe( 100 );
			expect( rect.y ).toBe( 100 );
			expect( rect.width ).toBe( 200 );
			expect( rect.height ).toBe( 150 );
		} );
	} );

	describe( 'touch handling', () => {
		it( 'should record touch point and time', () => {
			const point = { x: 100, y: 100 };
			controller.recordTouch( point );

			expect( controller.lastTouchPoint ).toEqual( point );
			expect( controller.lastTouchTime ).toBeGreaterThan( 0 );
		} );

		describe( 'isDoubleTap', () => {
			it( 'should return false when no previous touch', () => {
				expect( controller.isDoubleTap( { x: 100, y: 100 } ) ).toBe( false );
			} );

			it( 'should detect double tap within time and distance', () => {
				controller.recordTouch( { x: 100, y: 100 } );

				// Simulate quick second tap nearby
				const result = controller.isDoubleTap( { x: 105, y: 105 }, 300, 30 );

				expect( result ).toBe( true );
			} );

			it( 'should reject double tap when too far', () => {
				controller.recordTouch( { x: 100, y: 100 } );

				const result = controller.isDoubleTap( { x: 200, y: 200 }, 300, 30 );

				expect( result ).toBe( false );
			} );

			it( 'should reject double tap when too slow', () => {
				controller.lastTouchPoint = { x: 100, y: 100 };
				controller.lastTouchTime = Date.now() - 500; // 500ms ago

				const result = controller.isDoubleTap( { x: 105, y: 105 }, 300, 30 );

				expect( result ).toBe( false );
			} );
		} );

		it( 'should clear touch state', () => {
			controller.recordTouch( { x: 100, y: 100 } );
			controller.clearTouch();

			expect( controller.lastTouchPoint ).toBeNull();
			expect( controller.lastTouchTime ).toBe( 0 );
		} );
	} );

	describe( 'guide dragging', () => {
		it( 'should start guide drag correctly', () => {
			controller.startGuideDrag( 'h', 150 );

			expect( controller.isDraggingGuide ).toBe( true );
			expect( controller.dragGuideOrientation ).toBe( 'h' );
			expect( controller.dragGuidePos ).toBe( 150 );
		} );

		it( 'should update guide position', () => {
			controller.startGuideDrag( 'v', 200 );

			controller.updateGuideDrag( 250 );

			expect( controller.dragGuidePos ).toBe( 250 );
		} );

		it( 'should not update when not dragging guide', () => {
			controller.updateGuideDrag( 250 );

			expect( controller.dragGuidePos ).toBe( 0 );
		} );

		it( 'should finish guide drag and return info', () => {
			controller.startGuideDrag( 'h', 150 );
			controller.updateGuideDrag( 200 );

			const result = controller.finishGuideDrag();

			expect( controller.isDraggingGuide ).toBe( false );
			expect( controller.dragGuideOrientation ).toBeNull();
			expect( controller.dragGuidePos ).toBe( 0 );
			expect( result ).toEqual( { orientation: 'h', position: 200 } );
		} );

		it( 'should return null when not dragging guide', () => {
			const result = controller.finishGuideDrag();

			expect( result ).toBeNull();
		} );
	} );

	describe( 'reset', () => {
		it( 'should reset all interaction state', () => {
			// Set up various states
			controller.startDrag( { x: 100, y: 100 }, { x: 50 } );
			controller.startMarquee( { x: 200, y: 200 } );
			controller.recordTouch( { x: 300, y: 300 } );

			controller.reset();

			expect( controller.isDragging ).toBe( false );
			expect( controller.isResizing ).toBe( false );
			expect( controller.isRotating ).toBe( false );
			expect( controller.isPanning ).toBe( false );
			expect( controller.isMarqueeSelecting ).toBe( false );
			expect( controller.isDraggingGuide ).toBe( false );
			expect( controller.startPoint ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( controller.lastPanPoint ).toBeNull();
			expect( controller.lastTouchPoint ).toBeNull();
			expect( controller.resizeHandle ).toBeNull();
			expect( controller.originalLayerState ).toBeNull();
			expect( controller.showDragPreview ).toBe( false );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			controller.startDrag( { x: 100, y: 100 }, { x: 50 } );

			controller.destroy();

			expect( controller.canvasManager ).toBeNull();
			expect( controller.isDragging ).toBe( false );
		} );
	} );
} );
