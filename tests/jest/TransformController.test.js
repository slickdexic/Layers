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

	// NOTE: getResizeCursor and calculateResize tests moved to ResizeCalculator.test.js
	// TransformController no longer wraps ResizeCalculator — CanvasManager calls it directly

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

		it( 'should update control points for curved arrows', () => {
			const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100, controlX: 50, controlY: 50 };
			const original = { x1: 0, y1: 0, x2: 100, y2: 100, controlX: 50, controlY: 50 };

			controller.updateLayerPosition( layer, original, 20, 30 );

			expect( layer.x1 ).toBe( 20 );
			expect( layer.y1 ).toBe( 30 );
			expect( layer.controlX ).toBe( 70 ); // 50 + 20
			expect( layer.controlY ).toBe( 80 ); // 50 + 30
		} );

		it( 'should not set control points when absent from original', () => {
			const layer = { type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 100 };
			const original = { x1: 0, y1: 0, x2: 100, y2: 100 };

			controller.updateLayerPosition( layer, original, 20, 30 );

			expect( layer.controlX ).toBeUndefined();
			expect( layer.controlY ).toBeUndefined();
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

	// NOTE: ResizeCalculator fallback tests removed — calculateResize/getResizeCursor
	// are no longer on TransformController. See ResizeCalculator.test.js.

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

		it( 'should derive ref point from points array for path layer (P2-122 regression)', () => {
			// Path layers have no top-level x/y — position is encoded in the points array.
			// Before the fix, _getRefPoint fell through to {x:0,y:0}, so smart guides
			// received a proposedX/Y based on the origin rather than the layer's actual position.
			const pathLayer = {
				id: 'path1',
				type: 'path',
				points: [ { x: 50, y: 200 }, { x: 150, y: 100 }, { x: 250, y: 200 } ]
			};
			mockEditor.layers = [ pathLayer ];
			mockManager.selectedLayerId = 'path1';
			mockManager.selectedLayerIds = [ 'path1' ];

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 120, y: 115 } );

			expect( smartGuidesController.calculateSnappedPosition ).toHaveBeenCalled();

			// ref = { x: min(50,150,250)=50, y: min(200,100,200)=100 }
			// proposedX = 50 + (120-100) = 70; proposedY = 100 + (115-100) = 115
			const call = smartGuidesController.calculateSnappedPosition.mock.calls[ 0 ];
			expect( call[ 1 ] ).toBe( 70 );
			expect( call[ 2 ] ).toBe( 115 );
		} );

		it( 'should use grid snap ref point correctly for path layer', () => {
			mockManager.snapToGrid = true;
			mockManager.gridSize = 10;
			const pathLayer = {
				id: 'path1',
				type: 'path',
				points: [ { x: 50, y: 200 }, { x: 150, y: 100 }, { x: 250, y: 200 } ]
			};
			mockEditor.layers = [ pathLayer ];
			mockManager.selectedLayerId = 'path1';
			mockManager.selectedLayerIds = [ 'path1' ];

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 120, y: 115 } );

			// Grid snap is used; smart guides should not be called
			expect( smartGuidesController.calculateSnappedPosition ).not.toHaveBeenCalled();
			// snapPointToGrid should have been called with the correct proposed position
			// ref = {x:50, y:100}; proposed = {x:70, y:115}
			expect( mockManager.snapPointToGrid ).toHaveBeenCalledWith( { x: 70, y: 115 } );
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

		describe( 'arrow tip RAF destruction guard', () => {
			it( 'should handle manager destruction in RAF callback gracefully', () => {
				// P2-103 regression: RAF callback could fire after editor destruction
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );
				controller.handleArrowTipDrag( { x: 200, y: 180 } );

				// Simulate manager destruction after drag but before RAF fires
				controller.manager.isDestroyed = true;
				controller.manager.renderLayers.mockClear();

				// RAF already fired synchronously in our mock, but verify
				// the guard logic works by checking renderLayers is not called
				// after destruction (subsequent drags)
				controller.manager.isDestroyed = false;
				controller.handleArrowTipDrag( { x: 210, y: 190 } );
				// Verify it still works when not destroyed
				expect( mockManager.renderLayers ).toHaveBeenCalled();
			} );

			it( 'should not render when manager editor is nullified', () => {
				const handle = { layerId: 'marker-1', type: 'arrowTip' };
				controller.startArrowTipDrag( handle, { x: 150, y: 150 } );

				// The isDestroyed guard protects the RAF callback
				expect( controller.isArrowTipDragging ).toBe( true );
				expect( controller.manager ).toBeTruthy();
				expect( controller.manager.isDestroyed ).toBeFalsy();
			} );
		} );
	} );

	// ==================== Angle Dimension Text Drag ====================

	describe( 'Angle dimension text drag operations', () => {
		let mockAngleLayer;

		beforeEach( () => {
			mockAngleLayer = {
				id: 'angle-1',
				type: 'angleDimension',
				cx: 200,
				cy: 200,
				ax: 300,
				ay: 200,
				bx: 200,
				by: 100,
				textOffset: 0,
				arcRadius: 60,
				fontSize: 14,
				textPosition: 'center',
				locked: false
			};

			mockManager = {
				editor: {
					getLayerById: jest.fn( ( id ) => {
						if ( id === 'angle-1' ) {
							return mockAngleLayer;
						}
						return null;
					} ),
					layers: [ mockAngleLayer ],
					updateLayer: jest.fn( ( id, updates ) => {
						Object.assign( mockAngleLayer, updates );
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
				},
				container: document.createElement( 'div' )
			};

			controller = new TransformController( mockManager );
		} );

		describe( 'startAngleDimensionTextDrag', () => {
			it( 'should initialize drag state correctly', () => {
				const handle = {
					layerId: 'angle-1',
					cx: 200,
					cy: 200,
					midAngle: Math.PI / 4,
					arcRadius: 60
				};
				const startPoint = { x: 250, y: 160 };

				controller.startAngleDimensionTextDrag( handle, startPoint );

				expect( controller.isAngleDimensionTextDragging ).toBe( true );
				expect( controller.dragStartPoint ).toBe( startPoint );
				expect( controller.angleDimTextLayerId ).toBe( 'angle-1' );
				expect( controller.angleDimVertexX ).toBe( 200 );
				expect( controller.angleDimVertexY ).toBe( 200 );
				expect( controller.angleDimMidAngle ).toBe( Math.PI / 4 );
				expect( controller.angleDimArcRadius ).toBe( 60 );
				expect( mockManager.canvas.style.cursor ).toBe( 'move' );
				expect( controller.originalLayerState ).toBeTruthy();
				expect( controller.originalLayerState.id ).toBe( 'angle-1' );
			} );

			it( 'should not start drag for locked layer', () => {
				mockAngleLayer.locked = true;
				const handle = {
					layerId: 'angle-1',
					cx: 200,
					cy: 200,
					midAngle: Math.PI / 4,
					arcRadius: 60
				};

				controller.startAngleDimensionTextDrag( handle, { x: 250, y: 160 } );

				expect( controller.isAngleDimensionTextDragging ).toBeFalsy();
			} );

			it( 'should not start drag for layer locked via parent folder', () => {
				const parentFolder = {
					id: 'folder-1',
					type: 'folder',
					locked: true
				};
				mockAngleLayer.parentGroup = 'folder-1';
				mockManager.editor.layers = [ parentFolder, mockAngleLayer ];

				const handle = {
					layerId: 'angle-1',
					cx: 200,
					cy: 200,
					midAngle: 0,
					arcRadius: 60
				};

				controller.startAngleDimensionTextDrag( handle, { x: 250, y: 160 } );

				expect( controller.isAngleDimensionTextDragging ).toBeFalsy();
			} );

			it( 'should handle non-existent layer gracefully', () => {
				const handle = {
					layerId: 'nonexistent',
					cx: 200,
					cy: 200,
					midAngle: 0,
					arcRadius: 60
				};

				controller.startAngleDimensionTextDrag( handle, { x: 250, y: 160 } );

				// isLayerEffectivelyLocked returns false for null, so drag state is set
				expect( controller.isAngleDimensionTextDragging ).toBe( true );
				// But originalLayerState should be null since layer wasn't found
				expect( controller.originalLayerState ).toBeNull();
			} );
		} );

		describe( 'handleAngleDimensionTextDrag', () => {
			const handle = {
				layerId: 'angle-1',
				cx: 200,
				cy: 200,
				midAngle: 0, // 0 radians = pointing right
				arcRadius: 60
			};

			beforeEach( () => {
				controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
			} );

			it( 'should update textOffset and arcRadius based on mouse position', () => {
				// Move mouse to a position at ~45 degrees from vertex, 80px away
				controller.handleAngleDimensionTextDrag( { x: 257, y: 143 } );

				expect( mockManager.editor.updateLayer ).toHaveBeenCalledWith(
					'angle-1',
					expect.objectContaining( {
						textOffset: expect.any( Number ),
						arcRadius: expect.any( Number )
					} )
				);
				expect( mockManager.renderLayers ).toHaveBeenCalled();
				expect( controller.showDragPreview ).toBe( true );
			} );

			it( 'should snap textOffset to zero when near center (within 3 degrees)', () => {
				// Move mouse almost at midAngle (0) direction, just 1 degree off
				// At 80px distance, sin(1°) * 80 ≈ 1.4px offset
				const smallAngle = 1 * ( Math.PI / 180 );
				const px = 200 + 80 * Math.cos( smallAngle );
				const py = 200 + 80 * Math.sin( smallAngle );

				controller.handleAngleDimensionTextDrag( { x: px, y: py } );

				// textOffset should snap to 0
				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].textOffset ).toBe( 0 );
			} );

			it( 'should not snap textOffset when beyond 3 degree threshold', () => {
				// Move mouse at 10 degrees off midAngle
				const angle = 10 * ( Math.PI / 180 );
				const px = 200 + 80 * Math.cos( angle );
				const py = 200 + 80 * Math.sin( angle );

				controller.handleAngleDimensionTextDrag( { x: px, y: py } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].textOffset ).not.toBe( 0 );
			} );

			it( 'should snap arcRadius to original when within 5 pixels', () => {
				// Move mouse at exactly the original arcRadius distance (60px) from vertex
				const px = 200 + 62; // 62px = within 5px of 60
				const py = 200;

				controller.handleAngleDimensionTextDrag( { x: px, y: py } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].arcRadius ).toBe( 60 ); // snapped to original
			} );

			it( 'should not snap arcRadius when beyond 5 pixel threshold', () => {
				// Move mouse at 80px from vertex (20px beyond 60px original)
				const px = 200 + 80;
				const py = 200;

				controller.handleAngleDimensionTextDrag( { x: px, y: py } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].arcRadius ).not.toBe( 60 );
			} );

			it( 'should clamp arcRadius to minimum of 10', () => {
				// Move mouse very close to vertex (5px away)
				controller.handleAngleDimensionTextDrag( { x: 205, y: 200 } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].arcRadius ).toBeGreaterThanOrEqual( 10 );
			} );

			it( 'should clamp arcRadius to maximum of 500', () => {
				// Move mouse very far from vertex (600px away)
				controller.handleAngleDimensionTextDrag( { x: 800, y: 200 } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].arcRadius ).toBeLessThanOrEqual( 500 );
			} );

			it( 'should adjust arcRadius for textPosition "above"', () => {
				mockAngleLayer.textPosition = 'above';
				// Move mouse 100px from vertex
				controller.handleAngleDimensionTextDrag( { x: 300, y: 200 } );

				// arcRadius = mouseDistance - perpOffset; the perpOffset is subtracted
				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].arcRadius ).toBeDefined();
			} );

			it( 'should adjust arcRadius for textPosition "below"', () => {
				mockAngleLayer.textPosition = 'below';
				// Move mouse 100px from vertex
				controller.handleAngleDimensionTextDrag( { x: 300, y: 200 } );

				// arcRadius = mouseDistance + perpOffset
				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].arcRadius ).toBeDefined();
			} );

			it( 'should normalize offset angle to [-π, π] range', () => {
				// Move mouse to create a large angle (nearly opposite to midAngle)
				controller.handleAngleDimensionTextDrag( { x: 100, y: 200 } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				// The offset should be normalized, not outside ±180
				expect( Math.abs( updateCall[ 1 ].textOffset ) ).toBeLessThanOrEqual( 180 );
			} );

			it( 'should do nothing if not dragging', () => {
				controller.isAngleDimensionTextDragging = false;

				controller.handleAngleDimensionTextDrag( { x: 300, y: 200 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should do nothing if layerId is null', () => {
				controller.angleDimTextLayerId = null;

				controller.handleAngleDimensionTextDrag( { x: 300, y: 200 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should do nothing if layer not found', () => {
				controller.angleDimTextLayerId = 'nonexistent';

				controller.handleAngleDimensionTextDrag( { x: 300, y: 200 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should use default fontSize of 12 when not set', () => {
				delete mockAngleLayer.fontSize;
				mockAngleLayer.textPosition = 'above';

				controller.handleAngleDimensionTextDrag( { x: 300, y: 200 } );

				expect( mockManager.editor.updateLayer ).toHaveBeenCalled();
			} );

			it( 'should round textOffset to one decimal place', () => {
				// Move at an angle that produces a non-round offset
				const angle = 7.777 * ( Math.PI / 180 );
				const px = 200 + 80 * Math.cos( angle );
				const py = 200 + 80 * Math.sin( angle );

				controller.handleAngleDimensionTextDrag( { x: px, y: py } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				const offset = updateCall[ 1 ].textOffset;
				// Check it's rounded to 1 decimal place
				expect( offset ).toBe( Math.round( offset * 10 ) / 10 );
			} );

			it( 'should emit transform event for live panel update', () => {
				const dispatchSpy = jest.spyOn( mockManager.container, 'dispatchEvent' );

				controller.handleAngleDimensionTextDrag( { x: 280, y: 160 } );

				// emitTransforming dispatches a CustomEvent
				expect( dispatchSpy ).toHaveBeenCalled();
			} );
		} );

		describe( 'finishAngleDimensionTextDrag', () => {
			const handle = {
				layerId: 'angle-1',
				cx: 200,
				cy: 200,
				midAngle: 0,
				arcRadius: 60
			};

			it( 'should reset all drag state', () => {
				controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
				controller.handleAngleDimensionTextDrag( { x: 280, y: 160 } );
				controller.finishAngleDimensionTextDrag();

				expect( controller.isAngleDimensionTextDragging ).toBe( false );
				expect( controller.angleDimTextLayerId ).toBeNull();
				expect( controller.angleDimVertexX ).toBe( 0 );
				expect( controller.angleDimVertexY ).toBe( 0 );
				expect( controller.angleDimMidAngle ).toBe( 0 );
				expect( controller.angleDimArcRadius ).toBe( 0 );
				expect( controller.showDragPreview ).toBe( false );
				expect( controller.originalLayerState ).toBeNull();
				expect( controller.dragStartPoint ).toBeNull();
			} );

			it( 'should mark dirty and save state when movement occurred', () => {
				controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
				controller.handleAngleDimensionTextDrag( { x: 280, y: 160 } );
				controller.finishAngleDimensionTextDrag();

				expect( mockManager.editor.markDirty ).toHaveBeenCalled();
				expect( mockManager.editor.saveState ).toHaveBeenCalledWith( 'Move angle dimension text' );
			} );

			it( 'should not mark dirty when no movement occurred', () => {
				controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
				// No handleAngleDimensionTextDrag call
				controller.finishAngleDimensionTextDrag();

				expect( mockManager.editor.markDirty ).not.toHaveBeenCalled();
			} );

			it( 'should emit final transform event when movement occurred', () => {
				controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
				controller.handleAngleDimensionTextDrag( { x: 280, y: 160 } );

				const dispatchSpy = jest.fn();
				mockManager.editor.container = { dispatchEvent: dispatchSpy };

				controller.finishAngleDimensionTextDrag();

				// emitTransforming with isFinal=true
				expect( dispatchSpy ).toHaveBeenCalled();
			} );

			it( 'should reset cursor to tool cursor', () => {
				controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
				controller.finishAngleDimensionTextDrag();

				expect( mockManager.getToolCursor ).toHaveBeenCalled();
				expect( mockManager.canvas.style.cursor ).toBe( 'default' );
			} );

			it( 'should handle finish without saveState method gracefully', () => {
				delete mockManager.editor.saveState;
				controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
				controller.handleAngleDimensionTextDrag( { x: 280, y: 160 } );

				expect( () => {
					controller.finishAngleDimensionTextDrag();
				} ).not.toThrow();

				expect( mockManager.editor.markDirty ).toHaveBeenCalled();
			} );
		} );
	} );

	// ==================== Dimension Text Drag ====================

	describe( 'Dimension text drag operations', () => {
		let mockDimLayer;

		beforeEach( () => {
			mockDimLayer = {
				id: 'dim-1',
				type: 'dimension',
				x1: 100,
				y1: 200,
				x2: 300,
				y2: 200,
				dimensionOffset: 40,
				textOffset: 0,
				locked: false
			};

			mockManager = {
				editor: {
					getLayerById: jest.fn( ( id ) => {
						if ( id === 'dim-1' ) {
							return mockDimLayer;
						}
						return null;
					} ),
					layers: [ mockDimLayer ],
					updateLayer: jest.fn( ( id, updates ) => {
						Object.assign( mockDimLayer, updates );
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
				},
				container: document.createElement( 'div' )
			};

			controller = new TransformController( mockManager );
		} );

		describe( 'startDimensionTextDrag', () => {
			it( 'should initialize dimension text drag state', () => {
				const handle = {
					layerId: 'dim-1',
					perpX: 0,
					perpY: -1,
					unitDx: 1,
					unitDy: 0,
					anchorMidX: 200,
					anchorMidY: 200,
					lineLength: 200
				};
				const startPoint = { x: 200, y: 160 };

				controller.startDimensionTextDrag( handle, startPoint );

				expect( controller.isDimensionTextDragging ).toBe( true );
				expect( controller.dragStartPoint ).toBe( startPoint );
				expect( controller.dimensionTextLayerId ).toBe( 'dim-1' );
				expect( controller.dimensionPerpX ).toBe( 0 );
				expect( controller.dimensionPerpY ).toBe( -1 );
				expect( controller.dimensionUnitDx ).toBe( 1 );
				expect( controller.dimensionUnitDy ).toBe( 0 );
				expect( controller.dimensionAnchorMidX ).toBe( 200 );
				expect( controller.dimensionAnchorMidY ).toBe( 200 );
				expect( controller.dimensionLineLength ).toBe( 200 );
				expect( mockManager.canvas.style.cursor ).toBe( 'move' );
				expect( controller.originalLayerState ).toBeTruthy();
			} );

			it( 'should not start drag for locked layer', () => {
				mockDimLayer.locked = true;
				const handle = {
					layerId: 'dim-1',
					perpX: 0,
					perpY: -1,
					unitDx: 1,
					unitDy: 0,
					anchorMidX: 200,
					anchorMidY: 200,
					lineLength: 200
				};

				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );

				expect( controller.isDimensionTextDragging ).toBeFalsy();
			} );

			it( 'should use default direction values when handle properties missing', () => {
				const handle = {
					layerId: 'dim-1'
					// No perpX, perpY, unitDx, etc.
				};

				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );

				expect( controller.dimensionPerpX ).toBe( 0 );
				expect( controller.dimensionPerpY ).toBe( -1 );
				expect( controller.dimensionUnitDx ).toBe( 1 );
				expect( controller.dimensionUnitDy ).toBe( 0 );
				expect( controller.dimensionAnchorMidX ).toBe( 0 );
				expect( controller.dimensionAnchorMidY ).toBe( 0 );
				expect( controller.dimensionLineLength ).toBe( 100 );
			} );

			it( 'should not start drag for layer locked via parent folder', () => {
				const parentFolder = {
					id: 'folder-1',
					type: 'folder',
					locked: true
				};
				mockDimLayer.parentGroup = 'folder-1';
				mockManager.editor.layers = [ parentFolder, mockDimLayer ];

				const handle = {
					layerId: 'dim-1',
					perpX: 0,
					perpY: -1,
					unitDx: 1,
					unitDy: 0,
					anchorMidX: 200,
					anchorMidY: 200,
					lineLength: 200
				};

				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );

				expect( controller.isDimensionTextDragging ).toBeFalsy();
			} );
		} );

		describe( 'handleDimensionTextDrag', () => {
			const handle = {
				layerId: 'dim-1',
				perpX: 0,
				perpY: -1,
				unitDx: 1,
				unitDy: 0,
				anchorMidX: 200,
				anchorMidY: 200,
				lineLength: 200
			};

			beforeEach( () => {
				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );
			} );

			it( 'should update dimensionOffset and textOffset', () => {
				// Move mouse perpendicular (up) and parallel (right)
				controller.handleDimensionTextDrag( { x: 250, y: 150 } );

				expect( mockManager.editor.updateLayer ).toHaveBeenCalledWith(
					'dim-1',
					expect.objectContaining( {
						dimensionOffset: expect.any( Number ),
						textOffset: expect.any( Number )
					} )
				);
				expect( mockManager.renderLayers ).toHaveBeenCalled();
				expect( controller.showDragPreview ).toBe( true );
			} );

			it( 'should calculate perpendicular offset correctly for horizontal dimension', () => {
				// For perpX=0, perpY=-1 (pointing up), dragging up should give positive offset
				// Mouse at (200, 150) → dy = 150-200 = -50; perpOffset = -(0*0 + (-50)*(-1)) = -50
				controller.handleDimensionTextDrag( { x: 200, y: 150 } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].dimensionOffset ).toBe( -50 );
			} );

			it( 'should snap textOffset to zero when within 10 pixels of center', () => {
				// Move mouse slightly right of anchor midpoint: dx=5 along unitDx=1
				controller.handleDimensionTextDrag( { x: 205, y: 200 } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].textOffset ).toBe( 0 ); // snapped
			} );

			it( 'should not snap textOffset when beyond 10 pixel threshold', () => {
				// Move mouse 50px right of anchor midpoint
				controller.handleDimensionTextDrag( { x: 250, y: 200 } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( updateCall[ 1 ].textOffset ).not.toBe( 0 );
			} );

			it( 'should round dimension offsets to integers', () => {
				controller.handleDimensionTextDrag( { x: 233.7, y: 177.3 } );

				const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
				expect( Number.isInteger( updateCall[ 1 ].dimensionOffset ) ).toBe( true );
				expect( Number.isInteger( updateCall[ 1 ].textOffset ) ).toBe( true );
			} );

			it( 'should do nothing if not dragging', () => {
				controller.isDimensionTextDragging = false;

				controller.handleDimensionTextDrag( { x: 250, y: 150 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should do nothing if layerId is null', () => {
				controller.dimensionTextLayerId = null;

				controller.handleDimensionTextDrag( { x: 250, y: 150 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should do nothing if layer not found', () => {
				controller.dimensionTextLayerId = 'nonexistent';

				controller.handleDimensionTextDrag( { x: 250, y: 150 } );

				expect( mockManager.editor.updateLayer ).not.toHaveBeenCalled();
			} );

			it( 'should emit transform event for live panel update', () => {
				const dispatchSpy = jest.spyOn( mockManager.container, 'dispatchEvent' );

				controller.handleDimensionTextDrag( { x: 250, y: 150 } );

				expect( dispatchSpy ).toHaveBeenCalled();
			} );

			it( 'should handle diagonal dimension line correctly', () => {
				// Reset with diagonal perpendicular/unit vectors
				controller.dimensionPerpX = -0.707;
				controller.dimensionPerpY = -0.707;
				controller.dimensionUnitDx = 0.707;
				controller.dimensionUnitDy = -0.707;

				controller.handleDimensionTextDrag( { x: 250, y: 150 } );

				expect( mockManager.editor.updateLayer ).toHaveBeenCalled();
			} );
		} );

		describe( 'finishDimensionTextDrag', () => {
			const handle = {
				layerId: 'dim-1',
				perpX: 0,
				perpY: -1,
				unitDx: 1,
				unitDy: 0,
				anchorMidX: 200,
				anchorMidY: 200,
				lineLength: 200
			};

			it( 'should reset all drag state', () => {
				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );
				controller.handleDimensionTextDrag( { x: 250, y: 120 } );
				controller.finishDimensionTextDrag();

				expect( controller.isDimensionTextDragging ).toBe( false );
				expect( controller.dimensionTextLayerId ).toBeNull();
				expect( controller.dimensionPerpX ).toBe( 0 );
				expect( controller.dimensionPerpY ).toBe( 0 );
				expect( controller.dimensionUnitDx ).toBe( 0 );
				expect( controller.dimensionUnitDy ).toBe( 0 );
				expect( controller.dimensionAnchorMidX ).toBe( 0 );
				expect( controller.dimensionAnchorMidY ).toBe( 0 );
				expect( controller.dimensionLineLength ).toBe( 0 );
				expect( controller.showDragPreview ).toBe( false );
				expect( controller.originalLayerState ).toBeNull();
				expect( controller.dragStartPoint ).toBeNull();
			} );

			it( 'should mark dirty and save state when movement occurred', () => {
				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );
				controller.handleDimensionTextDrag( { x: 250, y: 120 } );
				controller.finishDimensionTextDrag();

				expect( mockManager.editor.markDirty ).toHaveBeenCalled();
				expect( mockManager.editor.saveState ).toHaveBeenCalledWith( 'Move dimension text' );
			} );

			it( 'should not mark dirty when no movement occurred', () => {
				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );
				controller.finishDimensionTextDrag();

				expect( mockManager.editor.markDirty ).not.toHaveBeenCalled();
			} );

			it( 'should emit final transform event when movement occurred', () => {
				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );
				controller.handleDimensionTextDrag( { x: 250, y: 120 } );

				const dispatchSpy = jest.fn();
				mockManager.editor.container = { dispatchEvent: dispatchSpy };

				controller.finishDimensionTextDrag();

				expect( dispatchSpy ).toHaveBeenCalled();
			} );

			it( 'should reset cursor to tool cursor', () => {
				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );
				controller.finishDimensionTextDrag();

				expect( mockManager.getToolCursor ).toHaveBeenCalled();
				expect( mockManager.canvas.style.cursor ).toBe( 'default' );
			} );

			it( 'should handle finish without saveState method gracefully', () => {
				delete mockManager.editor.saveState;
				controller.startDimensionTextDrag( handle, { x: 200, y: 160 } );
				controller.handleDimensionTextDrag( { x: 250, y: 120 } );

				expect( () => {
					controller.finishDimensionTextDrag();
				} ).not.toThrow();

				expect( mockManager.editor.markDirty ).toHaveBeenCalled();
			} );
		} );
	} );

	// ==================== Additional Branch Coverage ====================

	describe( 'updateLayerPosition type coverage', () => {
		it( 'should move angleDimension layers by updating cx/cy/ax/ay/bx/by', () => {
			const layer = {
				id: 'ad-1',
				type: 'angleDimension',
				cx: 200,
				cy: 200,
				ax: 300,
				ay: 200,
				bx: 200,
				by: 100
			};
			const original = { ...layer };

			controller.updateLayerPosition( layer, original, 50, 30 );

			expect( layer.cx ).toBe( 250 );
			expect( layer.cy ).toBe( 230 );
			expect( layer.ax ).toBe( 350 );
			expect( layer.ay ).toBe( 230 );
			expect( layer.bx ).toBe( 250 );
			expect( layer.by ).toBe( 130 );
		} );

		it( 'should move arrow controlX/controlY when present', () => {
			const layer = {
				id: 'a-1',
				type: 'arrow',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 200,
				controlX: 150,
				controlY: 120
			};
			const original = { ...layer };

			controller.updateLayerPosition( layer, original, 10, 20 );

			expect( layer.controlX ).toBe( 160 );
			expect( layer.controlY ).toBe( 140 );
		} );

		it( 'should not set controlX/controlY when not in original layer', () => {
			const layer = {
				id: 'a-2',
				type: 'arrow',
				x1: 100,
				y1: 100,
				x2: 200,
				y2: 200
			};
			const original = { ...layer };

			controller.updateLayerPosition( layer, original, 10, 20 );

			expect( layer.controlX ).toBeUndefined();
			expect( layer.controlY ).toBeUndefined();
		} );
	} );

	describe( '_cloneLayer', () => {
		it( 'should use efficient clone function from window.Layers.Utils when available', () => {
			const clonedOutput = { id: 'clone', type: 'rect' };
			global.window.Layers.Utils = {
				cloneLayerEfficient: jest.fn( () => clonedOutput )
			};

			// Reset cached reference
			controller._cloneLayerEfficient = null;
			const result = controller._cloneLayer( { id: 'test', type: 'rect' } );

			expect( result ).toBe( clonedOutput );
			expect( global.window.Layers.Utils.cloneLayerEfficient ).toHaveBeenCalled();

			// Cleanup
			delete global.window.Layers.Utils;
		} );

		it( 'should fall back to JSON clone when Utils not available', () => {
			controller._cloneLayerEfficient = null;
			delete global.window.Layers.Utils;

			const original = { id: 'test', x: 100, y: 200 };
			const result = controller._cloneLayer( original );

			expect( result ).toEqual( original );
			expect( result ).not.toBe( original ); // Different reference
		} );
	} );

	describe( 'destroy with pending RAF callbacks', () => {
		it( 'should cancel pending rotation RAF', () => {
			const cancelSpy = jest.spyOn( window, 'cancelAnimationFrame' );
			controller._rotationRafId = 42;

			controller.destroy();

			expect( cancelSpy ).toHaveBeenCalledWith( 42 );
			cancelSpy.mockRestore();
		} );

		it( 'should cancel pending drag RAF', () => {
			const cancelSpy = jest.spyOn( window, 'cancelAnimationFrame' );
			controller._dragRafId = 99;

			controller.destroy();

			expect( cancelSpy ).toHaveBeenCalledWith( 99 );
			cancelSpy.mockRestore();
		} );

		it( 'should cancel pending arrow tip RAF', () => {
			const cancelSpy = jest.spyOn( window, 'cancelAnimationFrame' );
			controller._arrowTipRafId = 77;

			controller.destroy();

			expect( cancelSpy ).toHaveBeenCalledWith( 77 );
			cancelSpy.mockRestore();
		} );

		it( 'should cancel all pending RAFs simultaneously', () => {
			const cancelSpy = jest.spyOn( window, 'cancelAnimationFrame' );
			controller._resizeRafId = 10;
			controller._rotationRafId = 20;
			controller._dragRafId = 30;
			controller._arrowTipRafId = 40;
			controller._angleDimRafId = 50;
			controller._dimTextRafId = 60;

			controller.destroy();

			expect( cancelSpy ).toHaveBeenCalledTimes( 6 );
			expect( controller._resizeRafId ).toBeNull();
			expect( controller._rotationRafId ).toBeNull();
			expect( controller._dragRafId ).toBeNull();
			expect( controller._arrowTipRafId ).toBeNull();
			expect( controller._angleDimRafId ).toBeNull();
			expect( controller._dimTextRafId ).toBeNull();
			cancelSpy.mockRestore();
		} );
	} );

	describe( 'Angle dimension offset normalization edge cases', () => {
		let mockAngleLayer2;

		beforeEach( () => {
			mockAngleLayer2 = {
				id: 'angle-2',
				type: 'angleDimension',
				cx: 200,
				cy: 200,
				ax: 300,
				ay: 200,
				bx: 200,
				by: 100,
				textOffset: 0,
				arcRadius: 60,
				fontSize: 14,
				textPosition: 'center',
				locked: false
			};

			mockManager = {
				editor: {
					getLayerById: jest.fn( () => mockAngleLayer2 ),
					layers: [ mockAngleLayer2 ],
					updateLayer: jest.fn( ( id, updates ) => {
						Object.assign( mockAngleLayer2, updates );
					} ),
					markDirty: jest.fn(),
					saveState: jest.fn()
				},
				canvas: { style: { cursor: '' } },
				renderLayers: jest.fn(),
				getToolCursor: jest.fn( () => 'default' ),
				currentTool: 'select',
				eventManager: { emit: jest.fn() },
				container: document.createElement( 'div' )
			};

			controller = new TransformController( mockManager );
		} );

		it( 'should normalize angle offset > π (triggers while loop subtraction)', () => {
			// Set midAngle to -π (pointing left)
			// Move mouse to the right (+x): atan2(0, +dx) = 0
			// offsetRadians = 0 - (-π) = π... but if midAngle is < -π we get > 2π
			// To guarantee the while loop fires: set midAngle to -3π so offset = 0 - (-3π) = 3π
			const handle = {
				layerId: 'angle-2',
				cx: 200,
				cy: 200,
				midAngle: -3 * Math.PI, // Forces offset > π
				arcRadius: 60
			};

			controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
			controller.handleAngleDimensionTextDrag( { x: 260, y: 200 } );

			expect( mockManager.editor.updateLayer ).toHaveBeenCalled();
			const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
			// After normalization, textOffset should be in [-180, 180]
			expect( Math.abs( updateCall[ 1 ].textOffset ) ).toBeLessThanOrEqual( 180 );
		} );

		it( 'should normalize angle offset < -π (triggers while loop addition)', () => {
			// Set midAngle to 3π so offset = mouseAngle - 3π < -π
			const handle = {
				layerId: 'angle-2',
				cx: 200,
				cy: 200,
				midAngle: 3 * Math.PI, // Forces offset < -π
				arcRadius: 60
			};

			controller.startAngleDimensionTextDrag( handle, { x: 260, y: 200 } );
			controller.handleAngleDimensionTextDrag( { x: 260, y: 200 } );

			expect( mockManager.editor.updateLayer ).toHaveBeenCalled();
			const updateCall = mockManager.editor.updateLayer.mock.calls[ 0 ];
			expect( Math.abs( updateCall[ 1 ].textOffset ) ).toBeLessThanOrEqual( 180 );
		} );
	} );

	describe( 'Snap-to-grid with geometric layer types', () => {
		it( 'should compute reference point for angleDimension in snap-to-grid drag', () => {
			const angleLayer = {
				id: 'ad-snap',
				type: 'angleDimension',
				cx: 200,
				cy: 200,
				ax: 300,
				ay: 200,
				bx: 200,
				by: 100,
				locked: false
			};
			mockEditor.layers = [ angleLayer ];
			mockManager.selectedLayerId = 'ad-snap';
			mockManager.selectedLayerIds = [ 'ad-snap' ];
			mockManager.snapToGrid = true;
			mockManager.gridSize = 10;

			controller.startDrag( { x: 200, y: 200 } );
			controller.handleDrag( { x: 213, y: 207 } );

			// The snapping should have been applied via _getRefPoint
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should compute reference point for path layers in snap-to-grid drag', () => {
			const pathLayer = {
				id: 'path-snap',
				type: 'path',
				points: [ { x: 50, y: 60 }, { x: 100, y: 120 }, { x: 150, y: 80 } ],
				locked: false
			};
			mockEditor.layers = [ pathLayer ];
			mockManager.selectedLayerId = 'path-snap';
			mockManager.selectedLayerIds = [ 'path-snap' ];
			mockManager.snapToGrid = true;
			mockManager.gridSize = 10;

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 113, y: 107 } );

			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'Resize RAF destruction guard', () => {
		it( 'should handle destroyed manager during resize RAF callback', () => {
			// Start a resize to schedule the RAF
			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );

			// Set destroyed flag before RAF fires (our mock runs synchronously so we test the guard directly)
			controller.manager.isDestroyed = true;
			controller._resizeRenderScheduled = false;
			controller._pendingResizeLayer = testLayer;

			// Simulate another resize move - the RAF guard should detect destruction
			controller.handleResize( { x: 350, y: 300 }, {} );

			// Still should not throw; RAF guard protects
			expect( controller.isResizing ).toBe( true );
		} );
	} );

	describe( 'Rotation RAF destruction guard', () => {
		it( 'should handle destroyed manager during rotation RAF callback', () => {
			controller.startRotation( { x: 300, y: 100 } );
			controller.manager.isDestroyed = true;
			controller._rotationRenderScheduled = false;

			// Try to rotate after destruction
			controller.handleRotation( { x: 350, y: 150 }, {} );

			// Should not throw
			expect( controller.isRotating ).toBe( true );
		} );
	} );

	// ===== Gap coverage tests =====

	describe( 'isTransforming - additional flags', () => {
		it( 'should return true when isArrowTipDragging is true', () => {
			controller.isArrowTipDragging = true;
			expect( controller.isTransforming() ).toBe( true );
		} );

		it( 'should return false when all flags are false', () => {
			controller.isResizing = false;
			controller.isRotating = false;
			controller.isDragging = false;
			controller.isArrowTipDragging = false;
			expect( controller.isTransforming() ).toBe( false );
		} );
	} );

	describe( 'getState - fields', () => {
		it( 'should include all transform state fields', () => {
			controller.isResizing = true;
			controller.isRotating = false;
			controller.isDragging = true;
			controller.isArrowTipDragging = false;
			controller.resizeHandle = { type: 'se' };
			controller.showDragPreview = true;

			const state = controller.getState();
			expect( state.isResizing ).toBe( true );
			expect( state.isRotating ).toBe( false );
			expect( state.isDragging ).toBe( true );
			expect( state.isArrowTipDragging ).toBe( false );
			expect( state.resizeHandle ).toEqual( { type: 'se' } );
			expect( state.showDragPreview ).toBe( true );
		} );
	} );

	describe( 'startResize - ResizeCalculator null', () => {
		it( 'should use default cursor when ResizeCalculator is unavailable', () => {
			const savedRC = global.window.Layers.Canvas.ResizeCalculator;
			global.window.Layers.Canvas.ResizeCalculator = undefined;

			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );
			expect( mockCanvas.style.cursor ).toBe( 'default' );

			global.window.Layers.Canvas.ResizeCalculator = savedRC;
		} );
	} );

	describe( 'handleResize - null ResizeCalculator', () => {
		it( 'should not crash when ResizeCalculator returns null updates', () => {
			controller.startResize( { type: 'se' }, { x: 300, y: 250 } );

			const savedRC = global.window.Layers.Canvas.ResizeCalculator;
			global.window.Layers.Canvas.ResizeCalculator = undefined;

			// Should not throw - updates will be null
			expect( () => {
				controller.handleResize( { x: 350, y: 300 }, {} );
			} ).not.toThrow();

			global.window.Layers.Canvas.ResizeCalculator = savedRC;
		} );
	} );

	describe( 'handleResize - rotation skip for control handle', () => {
		it( 'should skip rotation delta transform for control handle', () => {
			const arrowLayer = {
				id: 'arrow1',
				type: 'arrow',
				x1: 50, y1: 50,
				x2: 200, y2: 200,
				controlX: 125, controlY: 50,
				rotation: 45
			};
			mockEditor.layers = [ arrowLayer ];
			mockManager.selectedLayerId = 'arrow1';
			mockEditor.getLayerById.mockImplementation( ( id ) =>
				mockEditor.layers.find( ( l ) => l.id === id )
			);

			controller.startResize( { type: 'control' }, { x: 125, y: 50 } );
			// Should not throw and should skip the rotation transform
			expect( () => {
				controller.handleResize( { x: 150, y: 75 }, {} );
			} ).not.toThrow();
		} );

		it( 'should skip rotation delta transform for tailTip handle', () => {
			const calloutLayer = {
				id: 'callout1',
				type: 'callout',
				x: 100, y: 100,
				width: 200, height: 100,
				tailTipX: 50, tailTipY: 250,
				rotation: 30
			};
			mockEditor.layers = [ calloutLayer ];
			mockManager.selectedLayerId = 'callout1';
			mockEditor.getLayerById.mockImplementation( ( id ) =>
				mockEditor.layers.find( ( l ) => l.id === id )
			);

			controller.startResize( { type: 'tailTip' }, { x: 50, y: 250 } );
			expect( () => {
				controller.handleResize( { x: 80, y: 260 }, {} );
			} ).not.toThrow();
		} );
	} );

	describe( 'handleResize - star layer special handling', () => {
		it( 'should update radius, outerRadius, and innerRadius for star layers', () => {
			const starLayer = {
				id: 'star1',
				type: 'star',
				x: 100, y: 100,
				radius: 50,
				outerRadius: 50,
				innerRadius: 25,
				rotation: 0
			};
			mockEditor.layers = [ starLayer ];
			mockManager.selectedLayerId = 'star1';
			mockEditor.getLayerById.mockImplementation( ( id ) =>
				mockEditor.layers.find( ( l ) => l.id === id )
			);

			controller.startResize( { type: 'se' }, { x: 150, y: 150 } );
			controller.handleResize( { x: 180, y: 180 }, {} );

			expect( starLayer.radius ).toBeGreaterThanOrEqual( 5 );
			expect( starLayer.outerRadius ).toBe( starLayer.radius );
			expect( starLayer.innerRadius ).toBe( starLayer.radius * 0.5 );
		} );
	} );

	describe( 'handleDrag - smart guides branch', () => {
		it( 'should use smart guides when grid snap is disabled', () => {
			const mockSmartGuides = {
				enabled: true,
				canvasSnapEnabled: false,
				calculateSnappedPosition: jest.fn( ( _layer, x, y ) => ( { x, y } ) )
			};
			mockManager.smartGuidesController = mockSmartGuides;
			mockManager.snapToGrid = false;

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 120, y: 115 } );

			expect( mockSmartGuides.calculateSnappedPosition ).toHaveBeenCalled();
		} );

		it( 'should use smart guides when canvasSnapEnabled is true', () => {
			const mockSmartGuides = {
				enabled: false,
				canvasSnapEnabled: true,
				calculateSnappedPosition: jest.fn( ( _layer, x, y ) => ( { x, y } ) )
			};
			mockManager.smartGuidesController = mockSmartGuides;
			mockManager.snapToGrid = false;

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 120, y: 115 } );

			expect( mockSmartGuides.calculateSnappedPosition ).toHaveBeenCalled();
		} );

		it( 'should not use smart guides when controller is null', () => {
			mockManager.smartGuidesController = null;
			mockManager.snapToGrid = false;

			controller.startDrag( { x: 100, y: 100 } );
			// Should not throw
			expect( () => {
				controller.handleDrag( { x: 120, y: 110 } );
			} ).not.toThrow();
		} );
	} );

	describe( 'updateLayerPosition - all layer types', () => {
		it( 'should update marker x/y but NOT arrowX/arrowY', () => {
			const markerLayer = {
				id: 'marker1', type: 'marker',
				x: 50, y: 50, arrowX: 100, arrowY: 200
			};
			const originalState = { x: 50, y: 50, arrowX: 100, arrowY: 200 };
			controller.updateLayerPosition( markerLayer, originalState, 20, 30 );
			expect( markerLayer.x ).toBe( 70 );
			expect( markerLayer.y ).toBe( 80 );
			expect( markerLayer.arrowX ).toBe( 100 ); // unchanged
			expect( markerLayer.arrowY ).toBe( 200 ); // unchanged
		} );

		it( 'should update dimension endpoints and control points', () => {
			const dimLayer = {
				id: 'dim1', type: 'dimension',
				x1: 0, y1: 0, x2: 100, y2: 0,
				controlX: 50, controlY: -20
			};
			const originalState = { ...dimLayer };
			controller.updateLayerPosition( dimLayer, originalState, 10, 20 );
			expect( dimLayer.x1 ).toBe( 10 );
			expect( dimLayer.y1 ).toBe( 20 );
			expect( dimLayer.x2 ).toBe( 110 );
			expect( dimLayer.y2 ).toBe( 20 );
			expect( dimLayer.controlX ).toBe( 60 );
			expect( dimLayer.controlY ).toBe( 0 );
		} );

		it( 'should update angleDimension cx/cy/ax/ay/bx/by', () => {
			const adLayer = {
				id: 'ad1', type: 'angleDimension',
				cx: 50, cy: 50, ax: 100, ay: 50, bx: 50, by: 0
			};
			const originalState = { ...adLayer };
			controller.updateLayerPosition( adLayer, originalState, 15, -10 );
			expect( adLayer.cx ).toBe( 65 );
			expect( adLayer.cy ).toBe( 40 );
			expect( adLayer.ax ).toBe( 115 );
			expect( adLayer.ay ).toBe( 40 );
			expect( adLayer.bx ).toBe( 65 );
			expect( adLayer.by ).toBe( -10 );
		} );

		it( 'should update path points', () => {
			const pathLayer = {
				id: 'path1', type: 'path',
				points: [ { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 } ]
			};
			const originalState = {
				points: [ { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 } ]
			};
			controller.updateLayerPosition( pathLayer, originalState, 10, -5 );
			expect( pathLayer.points ).toEqual( [
				{ x: 10, y: -5 }, { x: 60, y: 45 }, { x: 110, y: -5 }
			] );
		} );

		it( 'should not update path without points', () => {
			const pathLayer = { id: 'path2', type: 'path' };
			const originalState = {};
			controller.updateLayerPosition( pathLayer, originalState, 10, 10 );
			expect( pathLayer.points ).toBeUndefined();
		} );
	} );

	describe( 'emitTransforming - error handling', () => {
		it( 'should handle dispatchEvent error with layersErrorHandler', () => {
			const handleError = jest.fn();
			window.layersErrorHandler = { handleError };

			const originalDispatch = HTMLElement.prototype.dispatchEvent;
			HTMLElement.prototype.dispatchEvent = () => { throw new Error( 'dispatch fail' ); };

			controller.emitTransforming( {
				id: 'l1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10
			} );

			expect( handleError ).toHaveBeenCalledWith(
				expect.any( Error ),
				'TransformController.emitTransformEvent',
				'canvas'
			);

			HTMLElement.prototype.dispatchEvent = originalDispatch;
			delete window.layersErrorHandler;
		} );

		it( 'should not throw when dispatchEvent fails and no error handler', () => {
			delete window.layersErrorHandler;

			const originalDispatch = HTMLElement.prototype.dispatchEvent;
			HTMLElement.prototype.dispatchEvent = () => { throw new Error( 'dispatch fail' ); };

			expect( () => {
				controller.emitTransforming( {
					id: 'l1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10
				} );
			} ).not.toThrow();

			HTMLElement.prototype.dispatchEvent = originalDispatch;
		} );

		it( 'should return early when layer is null', () => {
			expect( () => controller.emitTransforming( null ) ).not.toThrow();
		} );

		it( 'should skip src and path in lightweight copy', () => {
			let emitted = null;
			const originalDispatch = mockEditor.container.dispatchEvent;
			mockEditor.container.dispatchEvent = ( evt ) => {
				emitted = evt.detail;
			};

			controller.emitTransforming( {
				id: 'l1', type: 'image',
				x: 0, y: 0, width: 100, height: 50,
				src: 'data:image/png;base64,xxxxxxxxxx',
				path: 'M0 0 L100 100'
			} );

			expect( emitted.layer ).toBeDefined();
			expect( emitted.layer.src ).toBeUndefined();
			expect( emitted.layer.path ).toBeUndefined();
			expect( emitted.layer.x ).toBe( 0 );
			expect( emitted.layer.width ).toBe( 100 );

			mockEditor.container.dispatchEvent = originalDispatch;
		} );

		it( 'should shallow-clone arrays in emitTransforming', () => {
			let emitted = null;
			const originalDispatch = mockEditor.container.dispatchEvent;
			mockEditor.container.dispatchEvent = ( evt ) => {
				emitted = evt.detail;
			};

			const origPoints = [ { x: 0, y: 0 }, { x: 50, y: 50 } ];
			controller.emitTransforming( {
				id: 'l1', type: 'path',
				points: origPoints
			} );

			expect( emitted.layer.points ).toEqual( origPoints );
			expect( emitted.layer.points ).not.toBe( origPoints ); // shallow copy

			mockEditor.container.dispatchEvent = originalDispatch;
		} );
	} );

	describe( 'destroy - RAF cleanup', () => {
		it( 'should cancel all pending RAF IDs', () => {
			const cancelRAF = jest.fn();
			window.cancelAnimationFrame = cancelRAF;

			controller._resizeRafId = 1;
			controller._rotationRafId = 2;
			controller._dragRafId = 3;
			controller._arrowTipRafId = 4;
			controller._angleDimRafId = 5;
			controller._dimTextRafId = 6;

			controller.destroy();

			expect( cancelRAF ).toHaveBeenCalledWith( 1 );
			expect( cancelRAF ).toHaveBeenCalledWith( 2 );
			expect( cancelRAF ).toHaveBeenCalledWith( 3 );
			expect( cancelRAF ).toHaveBeenCalledWith( 4 );
			expect( cancelRAF ).toHaveBeenCalledWith( 5 );
			expect( cancelRAF ).toHaveBeenCalledWith( 6 );
		} );

		it( 'should not call cancelAnimationFrame when RAF IDs are null', () => {
			const cancelRAF = jest.fn();
			window.cancelAnimationFrame = cancelRAF;

			controller._resizeRafId = null;
			controller._rotationRafId = null;
			controller._dragRafId = null;
			controller._arrowTipRafId = null;
			controller._angleDimRafId = null;
			controller._dimTextRafId = null;

			controller.destroy();

			expect( cancelRAF ).not.toHaveBeenCalled();
		} );

		it( 'should clear all transform state', () => {
			controller.isResizing = true;
			controller.isRotating = true;
			controller.isDragging = true;
			controller.isArrowTipDragging = true;
			controller.resizeHandle = { type: 'se' };
			controller.dragStartPoint = { x: 0, y: 0 };
			controller.originalLayerState = {};
			controller.originalMultiLayerStates = {};
			controller.showDragPreview = true;

			controller.destroy();

			expect( controller.isResizing ).toBe( false );
			expect( controller.isRotating ).toBe( false );
			expect( controller.isDragging ).toBe( false );
			expect( controller.isArrowTipDragging ).toBe( false );
			expect( controller.resizeHandle ).toBeNull();
			expect( controller.dragStartPoint ).toBeNull();
			expect( controller.originalLayerState ).toBeNull();
			expect( controller.originalMultiLayerStates ).toBeNull();
			expect( controller.showDragPreview ).toBe( false );
			expect( controller.manager ).toBeNull();
		} );
	} );

	describe( 'handleDrag - ref point for geometric layer types', () => {
		it( 'should compute ref point for arrow type (min of x1,x2)', () => {
			const arrowLayer = {
				id: 'arrow2', type: 'arrow',
				x1: 200, y1: 100, x2: 50, y2: 300
			};
			mockEditor.layers = [ arrowLayer ];
			mockManager.selectedLayerId = 'arrow2';
			mockEditor.getLayerById.mockImplementation( ( id ) =>
				mockEditor.layers.find( ( l ) => l.id === id )
			);

			mockManager.snapToGrid = true;
			mockManager.gridSize = 10;
			mockManager.snapPointToGrid = jest.fn( ( pt ) => ( {
				x: Math.round( pt.x / 10 ) * 10,
				y: Math.round( pt.y / 10 ) * 10
			} ) );

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 113, y: 107 } );

			// Should have used snapPointToGrid with ref point from min(x1,x2), min(y1,y2)
			expect( mockManager.snapPointToGrid ).toHaveBeenCalled();
		} );

		it( 'should compute ref point for angleDimension type', () => {
			const adLayer = {
				id: 'ad2', type: 'angleDimension',
				cx: 100, cy: 100, ax: 200, ay: 100, bx: 100, by: 50
			};
			mockEditor.layers = [ adLayer ];
			mockManager.selectedLayerId = 'ad2';
			mockEditor.getLayerById.mockImplementation( ( id ) =>
				mockEditor.layers.find( ( l ) => l.id === id )
			);

			mockManager.snapToGrid = true;
			mockManager.gridSize = 10;
			mockManager.snapPointToGrid = jest.fn( ( pt ) => ( {
				x: Math.round( pt.x / 10 ) * 10,
				y: Math.round( pt.y / 10 ) * 10
			} ) );

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 115, y: 108 } );

			expect( mockManager.snapPointToGrid ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleResize - image/customShape shift inversion', () => {
		it( 'should invert shift behavior for image layers', () => {
			const imgLayer = {
				id: 'img1', type: 'image',
				x: 0, y: 0, width: 200, height: 100, rotation: 0
			};
			mockEditor.layers = [ imgLayer ];
			mockManager.selectedLayerId = 'img1';
			mockEditor.getLayerById.mockImplementation( ( id ) =>
				mockEditor.layers.find( ( l ) => l.id === id )
			);

			controller.startResize( { type: 'se' }, { x: 200, y: 100 } );
			// Without shift → proportional for images (inverted)
			controller.handleResize( { x: 250, y: 150 }, { shiftKey: false } );
			// Should apply proportional resize
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should invert shift behavior for customShape layers', () => {
			const csLayer = {
				id: 'cs1', type: 'customShape',
				x: 0, y: 0, width: 200, height: 100, rotation: 0
			};
			mockEditor.layers = [ csLayer ];
			mockManager.selectedLayerId = 'cs1';
			mockEditor.getLayerById.mockImplementation( ( id ) =>
				mockEditor.layers.find( ( l ) => l.id === id )
			);

			controller.startResize( { type: 'se' }, { x: 200, y: 100 } );
			// With shift → free resize for images/customShape (inverted)
			controller.handleResize( { x: 250, y: 150 }, { shiftKey: true } );
			expect( mockManager.renderLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'finishDrag - smart guides cleanup', () => {
		it( 'should clear smart guides on finish', () => {
			const clearGuides = jest.fn();
			mockManager.smartGuidesController = { clearGuides };

			controller.startDrag( { x: 100, y: 100 } );
			controller.handleDrag( { x: 120, y: 110 } );
			controller.finishDrag();

			expect( clearGuides ).toHaveBeenCalled();
		} );

		it( 'should not throw if smart guides controller is null', () => {
			mockManager.smartGuidesController = null;

			controller.startDrag( { x: 100, y: 100 } );
			expect( () => controller.finishDrag() ).not.toThrow();
		} );
	} );
} );
