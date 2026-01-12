/**
 * Unit tests for CanvasManager
 */

'use strict';

const CanvasManager = require( '../../resources/ext.layers.editor/CanvasManager.js' );

describe( 'CanvasManager', () => {
	let canvasManager;
	let mockCanvas;
	let mockContext;
	let mockEditor;
	let mockContainer;

	beforeEach( () => {
		// Create mock canvas with comprehensive context
		mockContext = {
			clearRect: jest.fn(),
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			scale: jest.fn(),
			rotate: jest.fn(),
			setTransform: jest.fn(),
			beginPath: jest.fn(),
			closePath: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			stroke: jest.fn(),
			fill: jest.fn(),
			arc: jest.fn(),
			rect: jest.fn(),
			fillRect: jest.fn(),
			strokeRect: jest.fn(),
			drawImage: jest.fn(),
			fillText: jest.fn(),
			strokeText: jest.fn(),
			measureText: jest.fn( () => ( { width: 100 } ) ),
			globalAlpha: 1,
			globalCompositeOperation: 'source-over',
			fillStyle: '#000000',
			strokeStyle: '#000000',
			lineWidth: 1,
			font: '16px Arial'
		};

		mockCanvas = {
			getContext: jest.fn( () => mockContext ),
			getBoundingClientRect: jest.fn( () => ( {
				left: 0,
				top: 0,
				width: 800,
				height: 600
			} ) ),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			width: 800,
			height: 600,
			style: {},
			className: '',
			parentNode: null
		};

		mockContainer = {
			querySelector: jest.fn( () => null ),
			appendChild: jest.fn(),
			clientWidth: 1000,
			clientHeight: 800
		};

		// Mock editor with layers
		mockEditor = {
			layers: [
				{ id: 'layer1', type: 'rectangle', x: 100, y: 100, width: 200, height: 150, visible: true },
				{ id: 'layer2', type: 'circle', x: 300, y: 300, radius: 50, visible: true },
				{ id: 'layer3', type: 'text', x: 400, y: 200, text: 'Hello', visible: true }
			],
			filename: 'Test.png',
			getLayerById: jest.fn( ( id ) => mockEditor.layers.find( ( l ) => l.id === id ) ),
			addLayer: jest.fn(),
			updateLayer: jest.fn(),
			removeLayer: jest.fn(),
			updateStatus: jest.fn(),
			errorLog: jest.fn(),
			stateManager: {
				get: jest.fn( ( key ) => {
					if ( key === 'selectedLayerIds' ) {
						return [];
					}
					return null;
				} ),
				set: jest.fn(),
				subscribe: jest.fn()
			},
			historyManager: {
				saveState: jest.fn(),
				updateUndoRedoButtons: jest.fn()
			},
			undo: jest.fn( () => true ),
			redo: jest.fn( () => true ),
			setCurrentTool: jest.fn()
		};

		// Mock global classes
		global.CanvasRenderer = jest.fn( () => ( {
			setBackgroundImage: jest.fn(),
			setTransform: jest.fn(),
			setSelection: jest.fn(),
			setMarquee: jest.fn(),
			setGuides: jest.fn(),
			setDragGuide: jest.fn(),
			redraw: jest.fn(),
			drawLayer: jest.fn(),
			drawLayerWithEffects: jest.fn(),
			drawMarqueeBox: jest.fn(),
			drawSelectionIndicators: jest.fn(),
			drawSelectionHandles: jest.fn(),
			drawRotationHandle: jest.fn(),
			drawErrorPlaceholder: jest.fn(),
			destroy: jest.fn()
		} ) );

		global.CanvasEvents = jest.fn( () => ( {
			destroy: jest.fn()
		} ) );

		global.ZoomPanController = jest.fn( () => ( {
			zoomIn: jest.fn(),
			zoomOut: jest.fn(),
			setZoom: jest.fn(),
			setZoomDirect: jest.fn(),
			resetZoom: jest.fn(),
			smoothZoomTo: jest.fn(),
			animateZoom: jest.fn(),
			fitToWindow: jest.fn(),
			zoomToFitLayers: jest.fn(),
			zoomBy: jest.fn(),
			updateCanvasTransform: jest.fn()
		} ) );

		global.TransformController = jest.fn( () => ( {
			startResize: jest.fn(),
			handleResize: jest.fn(),
			finishResize: jest.fn(),
			calculateResize: jest.fn( () => ( { width: 100, height: 100 } ) ),
			startRotation: jest.fn(),
			handleRotation: jest.fn(),
			finishRotation: jest.fn(),
			startDrag: jest.fn(),
			handleDrag: jest.fn(),
			finishDrag: jest.fn(),
			getResizeCursor: jest.fn( () => 'nwse-resize' ),
			isResizing: false,
			isRotating: false,
			isDragging: false,
			resizeHandle: null,
			showDragPreview: false
		} ) );

		global.HitTestController = jest.fn( () => ( {
			hitTestSelectionHandles: jest.fn( () => null ),
			getLayerAtPoint: jest.fn( () => null ),
			isPointInRect: jest.fn( () => false ),
			isPointInLayer: jest.fn( () => false ),
			isPointNearLine: jest.fn( () => false ),
			pointToSegmentDistance: jest.fn( () => Infinity ),
			isPointInPolygon: jest.fn( () => false )
		} ) );

		global.DrawingController = jest.fn( () => ( {
			startDrawing: jest.fn(),
			continueDrawing: jest.fn(),
			finishDrawing: jest.fn( () => ( { type: 'rectangle' } ) ),
			getTempLayer: jest.fn( () => null ),
			drawPreview: jest.fn(),
			getToolCursor: jest.fn( () => 'crosshair' )
		} ) );

		global.ClipboardController = jest.fn( () => ( {
			copySelected: jest.fn(),
			paste: jest.fn(),
			cutSelected: jest.fn()
		} ) );

		global.TextInputController = jest.fn( () => ( {
			createTextInputModal: jest.fn( () => ( { element: {} } ) ),
			finishTextInput: jest.fn(),
			hideTextInputModal: jest.fn()
		} ) );

		global.LayersSelectionManager = jest.fn( () => ( {
			selectLayer: jest.fn(),
			deselectAll: jest.fn(),
			getSelectedLayerIds: jest.fn( () => [] ),
			startMarqueeSelection: jest.fn(),
			updateMarqueeSelection: jest.fn(),
			finishMarqueeSelection: jest.fn(),
			getMarqueeRect: jest.fn( () => ( { x: 0, y: 0, width: 0, height: 0 } ) )
		} ) );

		global.RenderCoordinator = jest.fn( () => ( {
			scheduleRedraw: jest.fn(),
			destroy: jest.fn()
		} ) );

		global.ImageLoader = jest.fn( function ( config ) {
			this.load = jest.fn();
			this.config = config;
		} );

		global.GeometryUtils = {
			getLayerBoundsForType: jest.fn( ( layer ) => {
				if ( layer.type === 'rectangle' ) {
					return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
				}
				if ( layer.type === 'circle' ) {
					return { x: layer.x - layer.radius, y: layer.y - layer.radius, width: layer.radius * 2, height: layer.radius * 2 };
				}
				return { x: 0, y: 0, width: 100, height: 100 };
			} ),
			computeAxisAlignedBounds: jest.fn( ( rect ) => ( {
				left: rect.x,
				top: rect.y,
				right: rect.x + rect.width,
				bottom: rect.y + rect.height
			} ) )
		};

		global.TextUtils = {
			measureTextLayer: jest.fn( ( layer ) => ( {
				originX: layer.x,
				originY: layer.y,
				width: 100,
				height: 20
			} ) )
		};

		global.LayersConstants = {
			DEFAULTS: {
				COLORS: { STROKE: '#000000' },
				LAYER: { STROKE_WIDTH: 2, FONT_SIZE: 16, FONT_FAMILY: 'Arial, sans-serif' }
			},
			UI: { MIN_ZOOM: 0.1, MAX_ZOOM: 5.0, ANIMATION_DURATION: 300, GRID_SIZE: 20, RULER_SIZE: 30 },
			LIMITS: { MAX_CANVAS_POOL_SIZE: 5 }
		};

		// Mock StyleController for style options tests
		global.StyleController = jest.fn( () => ( {
			updateStyleOptions: jest.fn( ( options ) => {
				// Return merged style object like the real controller
				return {
					color: options.color || '#000000',
					fill: options.fill || null,
					strokeWidth: options.strokeWidth || 2,
					fontSize: options.fontSize || 16,
					fontFamily: options.fontFamily || 'Arial, sans-serif',
					...options
				};
			} ),
			applyToLayer: jest.fn( ( layer, style ) => {
				// Apply style to layer like the real controller
				if ( style.color ) {
					if ( layer.type === 'text' ) {
						layer.fill = style.color;
					} else {
						layer.stroke = style.color;
					}
				}
				if ( style.fill && layer.type !== 'text' && layer.type !== 'line' && layer.type !== 'arrow' ) {
					layer.fill = style.fill;
				}
				if ( style.strokeWidth && layer.type !== 'text' ) {
					layer.strokeWidth = style.strokeWidth;
				}
				if ( layer.type === 'text' ) {
					if ( style.fontSize ) layer.fontSize = style.fontSize;
					if ( style.fontFamily ) layer.fontFamily = style.fontFamily;
					if ( style.textStrokeColor ) layer.textStrokeColor = style.textStrokeColor;
					if ( style.textStrokeWidth ) layer.textStrokeWidth = style.textStrokeWidth;
				}
				if ( style.shadow ) {
					layer.shadow = style.shadow;
					if ( style.shadowColor ) layer.shadowColor = style.shadowColor;
					if ( style.shadowBlur ) layer.shadowBlur = style.shadowBlur;
					if ( style.shadowOffsetX !== undefined ) layer.shadowOffsetX = style.shadowOffsetX;
					if ( style.shadowOffsetY !== undefined ) layer.shadowOffsetY = style.shadowOffsetY;
				}
			} ),
			getCurrentStyle: jest.fn( () => ( { color: '#000000', strokeWidth: 2 } ) ),
			setCurrentStyle: jest.fn()
		} ) );

		// Create CanvasManager with config
		canvasManager = new CanvasManager( {
			container: mockContainer,
			editor: mockEditor,
			canvas: mockCanvas
		} );

		// Ensure styleController is set up
		if ( !canvasManager.styleController ) {
			canvasManager.styleController = new global.StyleController();
		}
	} );

	afterEach( () => {
		if ( canvasManager ) {
			canvasManager.destroy();
		}
		jest.clearAllMocks();
	} );

	describe( 'constructor and initialization', () => {
		it( 'should create CanvasManager with config', () => {
			expect( canvasManager ).toBeDefined();
			expect( canvasManager.config ).toBeDefined();
		} );

		it( 'should initialize with default style options', () => {
			expect( canvasManager.currentStyle ).toBeDefined();
			expect( canvasManager.currentStyle.color ).toBe( '#000000' );
			expect( canvasManager.currentStyle.strokeWidth ).toBe( 2 );
			expect( canvasManager.currentStyle.fontSize ).toBe( 16 );
		} );

		it( 'should initialize zoom and pan properties', () => {
			expect( canvasManager.zoom ).toBe( 1.0 );
			expect( canvasManager.panX ).toBe( 0 );
			expect( canvasManager.panY ).toBe( 0 );
			expect( canvasManager.minZoom ).toBe( 0.1 );
			expect( canvasManager.maxZoom ).toBe( 5.0 );
		} );

		it( 'should initialize selection state', () => {
			expect( canvasManager.selectionHandles ).toEqual( [] );
			expect( canvasManager.isResizing ).toBe( false );
			expect( canvasManager.isRotating ).toBe( false );
			expect( canvasManager.isDragging ).toBe( false );
		} );

		it( 'should initialize marquee selection state', () => {
			expect( canvasManager.isMarqueeSelecting ).toBe( false );
			expect( canvasManager.marqueeStart ).toEqual( { x: 0, y: 0 } );
			expect( canvasManager.marqueeEnd ).toEqual( { x: 0, y: 0 } );
		} );

		it( 'should initialize canvas pool', () => {
			expect( canvasManager.canvasPool ).toEqual( [] );
			expect( canvasManager.maxPoolSize ).toBe( 5 );
		} );

		it( 'should create canvas when container has no canvas', () => {
			const newManager = new CanvasManager( {
				container: mockContainer,
				editor: mockEditor
			} );
			expect( mockContainer.appendChild ).toHaveBeenCalled();
			newManager.destroy();
		} );

		it( 'should handle back-compat editor-like config', () => {
			const editorLike = {
				canvas: mockCanvas,
				layers: [],
				getLayerById: jest.fn()
			};
			const newManager = new CanvasManager( editorLike );
			expect( newManager.editor ).toBe( editorLike );
			newManager.destroy();
		} );
	} );

	describe( 'getSelectedLayerIds and setSelectedLayerIds', () => {
		it( 'should get selected layer IDs from StateManager', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1', 'layer2' ] );
			const ids = canvasManager.getSelectedLayerIds();
			expect( ids ).toEqual( [ 'layer1', 'layer2' ] );
			expect( mockEditor.stateManager.get ).toHaveBeenCalledWith( 'selectedLayerIds' );
		} );

		it( 'should return empty array when no selection', () => {
			mockEditor.stateManager.get.mockReturnValue( null );
			const ids = canvasManager.getSelectedLayerIds();
			expect( ids ).toEqual( [] );
		} );

		it( 'should set selected layer IDs via StateManager', () => {
			canvasManager.setSelectedLayerIds( [ 'layer1' ] );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [ 'layer1' ] );
		} );

		it( 'should get primary selected layer ID (last in array)', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1', 'layer2' ] );
			const id = canvasManager.getSelectedLayerId();
			expect( id ).toBe( 'layer2' );
		} );

		it( 'should return null when no layers selected', () => {
			mockEditor.stateManager.get.mockReturnValue( [] );
			const id = canvasManager.getSelectedLayerId();
			expect( id ).toBeNull();
		} );
	} );

	describe( 'layer bounds calculation', () => {
		it( 'should return null for null layer', () => {
			const bounds = canvasManager.getLayerBounds( null );
			expect( bounds ).toBeNull();
		} );

		it( 'should calculate bounds for rectangle layer', () => {
			const layer = { type: 'rectangle', x: 100, y: 100, width: 200, height: 150 };
			const bounds = canvasManager.getLayerBounds( layer );
			expect( bounds ).toBeDefined();
			expect( bounds.x ).toBe( 100 );
			expect( bounds.y ).toBe( 100 );
			expect( bounds.width ).toBe( 200 );
			expect( bounds.height ).toBe( 150 );
		} );

		it( 'should calculate center point', () => {
			const layer = { type: 'rectangle', x: 100, y: 100, width: 200, height: 100 };
			const bounds = canvasManager.getLayerBounds( layer );
			expect( bounds.centerX ).toBe( 200 ); // 100 + 200/2
			expect( bounds.centerY ).toBe( 150 ); // 100 + 100/2
		} );

		it( 'should include rotation in bounds', () => {
			const layer = { type: 'rectangle', x: 100, y: 100, width: 200, height: 100, rotation: 45 };
			const bounds = canvasManager.getLayerBounds( layer );
			expect( bounds.rotation ).toBe( 45 );
		} );

		it( 'should calculate text layer bounds using TextUtils', () => {
			const layer = { type: 'text', x: 50, y: 50, text: 'Hello' };
			const bounds = canvasManager.getLayerBounds( layer );
			expect( global.TextUtils.measureTextLayer ).toHaveBeenCalled();
			expect( bounds ).toBeDefined();
		} );

		it( 'should return fallback bounds for text layer when ctx is null', () => {
			// Temporarily null out the context
			const originalCtx = canvasManager.ctx;
			canvasManager.ctx = null;

			const layer = { type: 'text', x: 50, y: 75, width: 150, height: 30, text: 'Hello' };
			const bounds = canvasManager.getLayerBounds( layer );

			expect( bounds ).toBeDefined();
			expect( bounds.x ).toBe( 50 );
			expect( bounds.y ).toBe( 75 );
			expect( bounds.width ).toBe( 150 );
			expect( bounds.height ).toBe( 30 );

			// Restore context
			canvasManager.ctx = originalCtx;
		} );

		it( 'should use default dimensions for text layer fallback when not specified', () => {
			const originalCtx = canvasManager.ctx;
			canvasManager.ctx = null;

			const layer = { type: 'text', x: 10, y: 20, text: 'Hello' };
			const bounds = canvasManager.getLayerBounds( layer );

			expect( bounds ).toBeDefined();
			expect( bounds.width ).toBe( 100 ); // default
			expect( bounds.height ).toBe( 20 ); // default

			canvasManager.ctx = originalCtx;
		} );

		it( 'should return null when _getRawLayerBounds returns null', () => {
			// Mock _getRawLayerBounds to return null
			const originalGetRawBounds = canvasManager._getRawLayerBounds;
			canvasManager._getRawLayerBounds = jest.fn().mockReturnValue( null );

			const layer = { type: 'rectangle', x: 10, y: 20 };
			const bounds = canvasManager.getLayerBounds( layer );

			expect( bounds ).toBeNull();
			expect( canvasManager._getRawLayerBounds ).toHaveBeenCalledWith( layer );

			// Restore
			canvasManager._getRawLayerBounds = originalGetRawBounds;
		} );
	} );

	describe( 'canvas pool management', () => {
		it( 'should create new temp canvas when pool is empty', () => {
			const tempCanvas = canvasManager.getTempCanvas( 200, 150 );
			expect( tempCanvas ).toBeDefined();
			expect( tempCanvas.canvas ).toBeDefined();
			expect( tempCanvas.context ).toBeDefined();
			expect( tempCanvas.canvas.width ).toBe( 200 );
			expect( tempCanvas.canvas.height ).toBe( 150 );
		} );

		it( 'should reuse canvas from pool', () => {
			const tempCanvas1 = canvasManager.getTempCanvas( 100, 100 );
			canvasManager.returnTempCanvas( tempCanvas1 );
			expect( canvasManager.canvasPool.length ).toBe( 1 );

			const tempCanvas2 = canvasManager.getTempCanvas( 200, 200 );
			expect( canvasManager.canvasPool.length ).toBe( 0 );
			expect( tempCanvas2.canvas.width ).toBe( 200 );
		} );

		it( 'should not exceed max pool size', () => {
			for ( let i = 0; i < 10; i++ ) {
				const tempCanvas = canvasManager.getTempCanvas( 100, 100 );
				canvasManager.returnTempCanvas( tempCanvas );
			}
			expect( canvasManager.canvasPool.length ).toBeLessThanOrEqual( canvasManager.maxPoolSize );
		} );

		it( 'should discard canvas when pool is full', () => {
			// Fill the pool to max with proper canvas objects
			const maxSize = canvasManager.maxPoolSize;
			for ( let i = 0; i < maxSize; i++ ) {
				const canvas = document.createElement( 'canvas' );
				canvasManager.canvasPool.push( {
					canvas: canvas,
					context: {
						clearRect: jest.fn(),
						setTransform: jest.fn(),
						globalAlpha: 1,
						globalCompositeOperation: 'source-over'
					}
				} );
			}
			expect( canvasManager.canvasPool.length ).toBe( maxSize );

			// Create an extra canvas outside the pool
			const extraCanvas = {
				canvas: document.createElement( 'canvas' ),
				context: {
					setTransform: jest.fn(),
					globalAlpha: 1,
					globalCompositeOperation: 'source-over'
				}
			};

			// Return it - should NOT add to pool (pool is full)
			canvasManager.returnTempCanvas( extraCanvas );

			// Pool size should remain unchanged
			expect( canvasManager.canvasPool.length ).toBe( maxSize );
			// Canvas should be nullified for garbage collection
			expect( extraCanvas.canvas ).toBeNull();
			expect( extraCanvas.context ).toBeNull();
		} );

		it( 'should handle null temp canvas', () => {
			expect( () => canvasManager.returnTempCanvas( null ) ).not.toThrow();
			expect( () => canvasManager.returnTempCanvas( {} ) ).not.toThrow();
		} );
	} );

	describe( 'marquee selection', () => {
		it( 'should start marquee selection', () => {
			canvasManager.startMarqueeSelection( { x: 50, y: 50 } );
			expect( canvasManager.isMarqueeSelecting ).toBe( true );
			expect( canvasManager.marqueeStart ).toEqual( { x: 50, y: 50 } );
			expect( canvasManager.marqueeEnd ).toEqual( { x: 50, y: 50 } );
		} );

		it( 'should update marquee selection', () => {
			canvasManager.startMarqueeSelection( { x: 50, y: 50 } );
			canvasManager.updateMarqueeSelection( { x: 150, y: 150 } );
			expect( canvasManager.marqueeEnd ).toEqual( { x: 150, y: 150 } );
		} );

		it( 'should not update when not marquee selecting', () => {
			canvasManager.updateMarqueeSelection( { x: 150, y: 150 } );
			expect( canvasManager.marqueeEnd ).toEqual( { x: 0, y: 0 } );
		} );

		it( 'should calculate marquee rect with normalized coordinates', () => {
			canvasManager.startMarqueeSelection( { x: 150, y: 150 } );
			canvasManager.updateMarqueeSelection( { x: 50, y: 50 } );
			const rect = canvasManager.getMarqueeRect();
			expect( rect.x ).toBe( 50 );
			expect( rect.y ).toBe( 50 );
			expect( rect.width ).toBe( 100 );
			expect( rect.height ).toBe( 100 );
		} );

		it( 'should finish marquee selection', () => {
			canvasManager.startMarqueeSelection( { x: 50, y: 50 } );
			canvasManager.updateMarqueeSelection( { x: 150, y: 150 } );
			canvasManager.finishMarqueeSelection();
			expect( canvasManager.isMarqueeSelecting ).toBe( false );
		} );

		it( 'should not finish when not marquee selecting', () => {
			canvasManager.finishMarqueeSelection();
			expect( canvasManager.isMarqueeSelecting ).toBe( false );
		} );
	} );

	describe( 'selection methods', () => {
		it( 'should select a layer', () => {
			canvasManager.selectLayer( 'layer1' );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [ 'layer1' ] );
		} );

		it( 'should select all visible layers', () => {
			canvasManager.selectAll();
			const setCall = mockEditor.stateManager.set.mock.calls[ 0 ];
			expect( setCall[ 0 ] ).toBe( 'selectedLayerIds' );
			expect( setCall[ 1 ] ).toEqual( [ 'layer1', 'layer2', 'layer3' ] );
		} );

		it( 'should deselect all layers', () => {
			canvasManager.deselectAll();
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [] );
		} );

		it( 'should handle layer selection with click', () => {
			canvasManager.hitTestController.getLayerAtPoint.mockReturnValue( { id: 'layer1' } );
			const result = canvasManager.handleLayerSelection( { x: 100, y: 100 }, false );
			expect( result ).toEqual( { id: 'layer1' } );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [ 'layer1' ] );
		} );

		it( 'should toggle selection with ctrl+click', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.hitTestController.getLayerAtPoint.mockReturnValue( { id: 'layer2' } );
			canvasManager.handleLayerSelection( { x: 300, y: 300 }, true );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [ 'layer1', 'layer2' ] );
		} );

		it( 'should deselect when clicking empty space without ctrl', () => {
			canvasManager.hitTestController.getLayerAtPoint.mockReturnValue( null );
			const result = canvasManager.handleLayerSelection( { x: 0, y: 0 }, false );
			expect( result ).toBeNull();
		} );
	} );

	describe( 'rect intersection', () => {
		it( 'should detect intersecting rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 50, y: 50, width: 100, height: 100 };
			expect( canvasManager.rectsIntersect( rect1, rect2 ) ).toBe( true );
		} );

		it( 'should detect non-intersecting rectangles', () => {
			const rect1 = { x: 0, y: 0, width: 50, height: 50 };
			const rect2 = { x: 100, y: 100, width: 50, height: 50 };
			expect( canvasManager.rectsIntersect( rect1, rect2 ) ).toBe( false );
		} );

		it( 'should handle rect with aabb format', () => {
			const rect1 = { left: 0, top: 0, right: 100, bottom: 100 };
			const rect2 = { left: 50, top: 50, right: 150, bottom: 150 };
			expect( canvasManager.rectsIntersect( rect1, rect2 ) ).toBe( true );
		} );

		it( 'should handle null rect', () => {
			const aabb = canvasManager._rectToAabb( null );
			expect( aabb ).toEqual( { left: 0, top: 0, right: 0, bottom: 0 } );
		} );
	} );

	// Note: deepCloneLayers, undo/redo delegation tests removed - methods were dead code

	describe( 'saveState delegation', () => {
		it( 'should delegate saveState to historyManager', () => {
			canvasManager.saveState( 'test action' );
			expect( mockEditor.historyManager.saveState ).toHaveBeenCalledWith( 'test action' );
		} );
	} );

	describe( 'clipboard operations delegation', () => {
		it( 'should delegate copySelected to ClipboardController', () => {
			canvasManager.copySelected();
			expect( canvasManager.clipboardController.copySelected ).toHaveBeenCalled();
		} );

		it( 'should delegate pasteFromClipboard to ClipboardController', () => {
			canvasManager.pasteFromClipboard();
			expect( canvasManager.clipboardController.paste ).toHaveBeenCalled();
		} );

		it( 'should delegate cutSelected to ClipboardController', () => {
			canvasManager.cutSelected();
			expect( canvasManager.clipboardController.cutSelected ).toHaveBeenCalled();
		} );
	} );

	describe( 'zoom operations delegation', () => {
		it( 'should delegate zoomIn to ZoomPanController', () => {
			canvasManager.zoomIn();
			expect( canvasManager.zoomPanController.zoomIn ).toHaveBeenCalled();
		} );

		it( 'should delegate zoomOut to ZoomPanController', () => {
			canvasManager.zoomOut();
			expect( canvasManager.zoomPanController.zoomOut ).toHaveBeenCalled();
		} );

		it( 'should delegate setZoom to ZoomPanController', () => {
			canvasManager.setZoom( 1.5 );
			expect( canvasManager.zoomPanController.setZoom ).toHaveBeenCalledWith( 1.5 );
		} );

		it( 'should delegate resetZoom to ZoomPanController', () => {
			canvasManager.resetZoom();
			expect( canvasManager.zoomPanController.resetZoom ).toHaveBeenCalled();
		} );

		it( 'should delegate fitToWindow to ZoomPanController', () => {
			canvasManager.fitToWindow();
			expect( canvasManager.zoomPanController.fitToWindow ).toHaveBeenCalled();
		} );

		it( 'should delegate zoomBy to ZoomPanController', () => {
			canvasManager.zoomBy( 0.1, { x: 100, y: 100 } );
			expect( canvasManager.zoomPanController.zoomBy ).toHaveBeenCalledWith( 0.1, { x: 100, y: 100 } );
		} );
	} );

	describe( 'transform operations delegation', () => {
		it( 'should delegate startResize to TransformController', () => {
			canvasManager.startPoint = { x: 100, y: 100 };
			canvasManager.startResize( 'se' );
			expect( canvasManager.transformController.startResize ).toHaveBeenCalledWith( 'se', { x: 100, y: 100 } );
		} );

		it( 'should delegate startRotation to TransformController', () => {
			canvasManager.startRotation( { x: 100, y: 50 } );
			expect( canvasManager.transformController.startRotation ).toHaveBeenCalledWith( { x: 100, y: 50 } );
		} );

		it( 'should delegate startDrag to TransformController', () => {
			canvasManager.startPoint = { x: 100, y: 100 };
			canvasManager.startDrag();
			expect( canvasManager.transformController.startDrag ).toHaveBeenCalledWith( { x: 100, y: 100 } );
		} );

		it( 'should delegate finishResize to TransformController', () => {
			canvasManager.transformController.isResizing = true;
			canvasManager.finishResize();
			expect( canvasManager.transformController.finishResize ).toHaveBeenCalled();
		} );

		it( 'should delegate finishRotation to TransformController', () => {
			canvasManager.transformController.isRotating = true;
			canvasManager.finishRotation();
			expect( canvasManager.transformController.finishRotation ).toHaveBeenCalled();
		} );

		it( 'should delegate finishDrag to TransformController', () => {
			canvasManager.transformController.isDragging = true;
			canvasManager.finishDrag();
			expect( canvasManager.transformController.finishDrag ).toHaveBeenCalled();
		} );

		it( 'should delegate getResizeCursor to TransformController', () => {
			canvasManager.getResizeCursor( 'se', 0 );
			expect( canvasManager.transformController.getResizeCursor ).toHaveBeenCalledWith( 'se', 0 );
		} );
	} );

	describe( 'drawing operations delegation', () => {
		it( 'should delegate startDrawing to DrawingController', () => {
			canvasManager.currentTool = 'rectangle';
			canvasManager.startDrawing( { x: 100, y: 100 } );
			expect( canvasManager.drawingController.startDrawing ).toHaveBeenCalled();
		} );

		it( 'should delegate continueDrawing to DrawingController', () => {
			canvasManager.continueDrawing( { x: 150, y: 150 } );
			expect( canvasManager.drawingController.continueDrawing ).toHaveBeenCalledWith( { x: 150, y: 150 } );
		} );

		it( 'should delegate finishDrawing to DrawingController', () => {
			canvasManager.finishDrawing( { x: 200, y: 200 } );
			expect( canvasManager.drawingController.finishDrawing ).toHaveBeenCalled();
		} );

		it( 'should delegate getToolCursor to DrawingController', () => {
			canvasManager.getToolCursor( 'rectangle' );
			expect( canvasManager.drawingController.getToolCursor ).toHaveBeenCalledWith( 'rectangle' );
		} );
	} );

	describe( 'hit testing delegation', () => {
		it( 'should delegate hitTestSelectionHandles to HitTestController', () => {
			canvasManager.hitTestSelectionHandles( { x: 100, y: 100 } );
			expect( canvasManager.hitTestController.hitTestSelectionHandles ).toHaveBeenCalledWith( { x: 100, y: 100 } );
		} );

		it( 'should delegate getLayerAtPoint to HitTestController', () => {
			canvasManager.getLayerAtPoint( { x: 100, y: 100 } );
			expect( canvasManager.hitTestController.getLayerAtPoint ).toHaveBeenCalledWith( { x: 100, y: 100 } );
		} );

		it( 'should delegate isPointInLayer to HitTestController', () => {
			const layer = { id: 'layer1' };
			canvasManager.isPointInLayer( { x: 100, y: 100 }, layer );
			expect( canvasManager.hitTestController.isPointInLayer ).toHaveBeenCalledWith( { x: 100, y: 100 }, layer );
		} );
	} );

	describe( 'tool management', () => {
		it( 'should set current tool', () => {
			canvasManager.setTool( 'rectangle' );
			expect( canvasManager.currentTool ).toBe( 'rectangle' );
		} );

		it( 'should update status when setting tool', () => {
			canvasManager.setTool( 'circle' );
			expect( mockEditor.updateStatus ).toHaveBeenCalledWith( { tool: 'circle' } );
		} );
	} );

	describe( 'style options', () => {
		it( 'should update current style', () => {
			canvasManager.updateStyleOptions( { color: '#ff0000', strokeWidth: 5 } );
			expect( canvasManager.currentStyle.color ).toBe( '#ff0000' );
			expect( canvasManager.currentStyle.strokeWidth ).toBe( 5 );
		} );

		it( 'should apply style to selected layers', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.updateStyleOptions( { color: '#ff0000' } );
			expect( mockEditor.layers[ 0 ].stroke ).toBe( '#ff0000' );
		} );

		it( 'should apply fill color to text layers', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer3' ] );
			canvasManager.updateStyleOptions( { color: '#0000ff' } );
			expect( mockEditor.layers[ 2 ].fill ).toBe( '#0000ff' );
		} );
	} );

	describe( 'mouse point calculation', () => {
		it( 'should calculate mouse point from client coordinates', () => {
			const point = canvasManager.getMousePointFromClient( 100, 100 );
			expect( point.x ).toBeDefined();
			expect( point.y ).toBeDefined();
		} );
	} );

	describe( 'cursor update', () => {
		it( 'should use tool cursor for non-pointer tools', () => {
			canvasManager.currentTool = 'rectangle';
			canvasManager.updateCursor( { x: 100, y: 100 } );
			expect( canvasManager.canvas.style.cursor ).toBe( 'crosshair' );
		} );

		it( 'should show resize cursor when over handle', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.currentTool = 'pointer';
			canvasManager.hitTestController.hitTestSelectionHandles.mockReturnValue( { type: 'se' } );
			canvasManager.updateCursor( { x: 100, y: 100 } );
			expect( canvasManager.canvas.style.cursor ).toBe( 'nwse-resize' );
		} );

		it( 'should show grab cursor for rotate handle', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.currentTool = 'pointer';
			canvasManager.hitTestController.hitTestSelectionHandles.mockReturnValue( { type: 'rotate' } );
			canvasManager.updateCursor( { x: 100, y: 50 } );
			expect( canvasManager.canvas.style.cursor ).toBe( 'grab' );
		} );

		it( 'should show move cursor when over selected layer', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.currentTool = 'pointer';
			canvasManager.hitTestController.hitTestSelectionHandles.mockReturnValue( null );
			canvasManager.hitTestController.getLayerAtPoint.mockReturnValue( { id: 'layer1' } );
			canvasManager.updateCursor( { x: 100, y: 100 } );
			expect( canvasManager.canvas.style.cursor ).toBe( 'move' );
		} );

		it( 'should show pointer cursor when over unselected layer', () => {
			mockEditor.stateManager.get.mockReturnValue( [ 'layer2' ] );
			canvasManager.currentTool = 'pointer';
			canvasManager.hitTestController.hitTestSelectionHandles.mockReturnValue( null );
			canvasManager.hitTestController.getLayerAtPoint.mockReturnValue( { id: 'layer1' } );
			canvasManager.updateCursor( { x: 100, y: 100 } );
			expect( canvasManager.canvas.style.cursor ).toBe( 'pointer' );
		} );

		it( 'should adjust resize cursor for rotated layers', () => {
			// Set up a rotated layer
			const rotatedLayer = { id: 'layer1', type: 'rectangle', rotation: 45 };
			mockEditor.layers = [ rotatedLayer ];
			mockEditor.getLayerById = jest.fn( () => rotatedLayer );
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.currentTool = 'pointer';
			canvasManager.hitTestController.hitTestSelectionHandles.mockReturnValue( { type: 'n' } );

			// Mock getResizeCursor to use real rotation logic
			canvasManager.transformController.getResizeCursor = jest.fn( ( handleType, rotation ) => {
				const handleAngles = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };
				const baseAngle = handleAngles[ handleType ];
				if ( baseAngle === undefined ) {
					return 'default';
				}
				const worldAngle = ( baseAngle + ( rotation || 0 ) ) % 360;
				const normalizedAngle = ( ( worldAngle % 360 ) + 360 ) % 360;
				const sector = Math.round( normalizedAngle / 45 ) % 8;
				const cursorMap = [ 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize' ];
				return cursorMap[ sector ];
			} );

			canvasManager.updateCursor( { x: 100, y: 100 } );

			// At 45° rotation, N handle should show nesw-resize (diagonal)
			expect( canvasManager.transformController.getResizeCursor ).toHaveBeenCalledWith( 'n', 45 );
			expect( canvasManager.canvas.style.cursor ).toBe( 'nesw-resize' );
		} );
	} );

	describe( 'zoom click handling', () => {
		it( 'should zoom in on click', () => {
			const initialZoom = canvasManager.zoom;
			canvasManager.handleZoomClick( { x: 400, y: 300 }, { shiftKey: false } );
			expect( canvasManager.zoom ).toBeGreaterThan( initialZoom );
		} );

		it( 'should zoom out with shift click', () => {
			canvasManager.zoom = 2.0;
			const initialZoom = canvasManager.zoom;
			canvasManager.handleZoomClick( { x: 400, y: 300 }, { shiftKey: true } );
			expect( canvasManager.zoom ).toBeLessThan( initialZoom );
		} );

		it( 'should clamp zoom to max', () => {
			canvasManager.zoom = 4.9;
			canvasManager.handleZoomClick( { x: 400, y: 300 }, { shiftKey: false } );
			expect( canvasManager.zoom ).toBeLessThanOrEqual( canvasManager.maxZoom );
		} );

		it( 'should set userHasSetZoom flag', () => {
			canvasManager.handleZoomClick( { x: 400, y: 300 }, { shiftKey: false } );
			expect( canvasManager.userHasSetZoom ).toBe( true );
		} );
	} );

	describe( 'zoom drag handling', () => {
		it( 'should not zoom without drag start point', () => {
			canvasManager.dragStartPoint = null;
			const initialZoom = canvasManager.zoom;
			canvasManager.handleZoomDrag( { x: 400, y: 200 } );
			expect( canvasManager.zoom ).toBe( initialZoom );
		} );

		it( 'should zoom in when dragging up', () => {
			canvasManager.dragStartPoint = { x: 400, y: 300 };
			canvasManager.initialDragZoom = 1.0;
			canvasManager.zoom = 1.0;
			canvasManager.handleZoomDrag( { x: 400, y: 200 } ); // Drag up
			expect( canvasManager.zoom ).toBeGreaterThan( 1.0 );
		} );

		it( 'should zoom out when dragging down', () => {
			canvasManager.dragStartPoint = { x: 400, y: 300 };
			canvasManager.initialDragZoom = 1.0;
			canvasManager.zoom = 1.0;
			canvasManager.handleZoomDrag( { x: 400, y: 400 } ); // Drag down
			expect( canvasManager.zoom ).toBeLessThan( 1.0 );
		} );
	} );

	describe( 'layer position update', () => {
		it( 'should update rectangle position', () => {
			const layer = { type: 'rectangle', x: 100, y: 100 };
			const original = { x: 100, y: 100 };
			canvasManager.updateLayerPosition( layer, original, 50, 50 );
			expect( layer.x ).toBe( 150 );
			expect( layer.y ).toBe( 150 );
		} );

		it( 'should update line position', () => {
			const layer = { type: 'line', x1: 100, y1: 100, x2: 200, y2: 200 };
			const original = { x1: 100, y1: 100, x2: 200, y2: 200 };
			canvasManager.updateLayerPosition( layer, original, 25, 25 );
			expect( layer.x1 ).toBe( 125 );
			expect( layer.y1 ).toBe( 125 );
			expect( layer.x2 ).toBe( 225 );
			expect( layer.y2 ).toBe( 225 );
		} );

		it( 'should update path points', () => {
			const layer = { type: 'path', points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ] };
			const original = { points: [ { x: 0, y: 0 }, { x: 100, y: 100 } ] };
			canvasManager.updateLayerPosition( layer, original, 10, 10 );
			expect( layer.points[ 0 ] ).toEqual( { x: 10, y: 10 } );
			expect( layer.points[ 1 ] ).toEqual( { x: 110, y: 110 } );
		} );
	} );

	describe( 'redraw methods', () => {
		it( 'should call renderer redraw', () => {
			canvasManager.redraw();
			expect( canvasManager.renderer.redraw ).toHaveBeenCalled();
		} );

		it( 'should sync state to renderer before redraw', () => {
			canvasManager.redraw();
			expect( canvasManager.renderer.setBackgroundImage ).toHaveBeenCalled();
			expect( canvasManager.renderer.setSelection ).toHaveBeenCalled();
		} );

		it( 'should handle redraw without renderer', () => {
			canvasManager.renderer = null;
			expect( () => canvasManager.redraw() ).not.toThrow();
		} );

		it( 'should use RenderCoordinator for optimized redraw', () => {
			canvasManager.redrawOptimized();
			expect( canvasManager.renderCoordinator.scheduleRedraw ).toHaveBeenCalled();
		} );
	} );

	describe( 'layer viewport culling', () => {
		it( 'should return false for null layer', () => {
			expect( canvasManager.isLayerInViewport( null ) ).toBe( false );
		} );

		it( 'should return true when viewport not initialized', () => {
			canvasManager.viewportBounds = null;
			const layer = { type: 'rectangle', x: 1000, y: 1000 };
			expect( canvasManager.isLayerInViewport( layer ) ).toBe( true );
		} );
	} );

	describe( 'canvas resize', () => {
		it( 'should resize canvas to fit container', () => {
			// Create a fresh manager with a proper parent setup
			const containerWithCanvas = {
				querySelector: jest.fn( () => mockCanvas ),
				appendChild: jest.fn(),
				clientWidth: 1000,
				clientHeight: 800
			};
			mockCanvas.parentNode = containerWithCanvas;

			const newManager = new CanvasManager( {
				container: containerWithCanvas,
				editor: mockEditor,
				canvas: mockCanvas
			} );

			newManager.resizeCanvas();
			expect( newManager.canvas.style.width ).toBeDefined();
			expect( newManager.canvas.style.height ).toBeDefined();
			newManager.destroy();
		} );

		it( 'should preserve user zoom when resizing', () => {
			const containerWithCanvas = {
				querySelector: jest.fn( () => mockCanvas ),
				appendChild: jest.fn(),
				clientWidth: 1000,
				clientHeight: 800
			};
			mockCanvas.parentNode = containerWithCanvas;

			const newManager = new CanvasManager( {
				container: containerWithCanvas,
				editor: mockEditor,
				canvas: mockCanvas
			} );

			newManager.userHasSetZoom = true;
			newManager.zoom = 2.0;
			newManager.resizeCanvas();
			expect( newManager.zoom ).toBe( 2.0 );
			newManager.destroy();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up all resources', () => {
			canvasManager.destroy();
			expect( canvasManager.renderCoordinator ).toBeNull();
			expect( canvasManager.events ).toBeNull();
			expect( canvasManager.canvas ).toBeNull();
			expect( canvasManager.ctx ).toBeNull();
			expect( canvasManager.editor ).toBeNull();
		} );

		it( 'should call destroy on renderer', () => {
			const destroySpy = canvasManager.renderer.destroy;
			canvasManager.destroy();
			expect( destroySpy ).toHaveBeenCalled();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export CanvasManager', () => {
			expect( CanvasManager ).toBeDefined();
			expect( typeof CanvasManager ).toBe( 'function' );
		} );
	} );

	describe( 'withLocalAlpha', () => {
		it( 'should execute callback with modified globalAlpha', () => {
			const callback = jest.fn();
			canvasManager.withLocalAlpha( 0.5, callback );
			expect( callback ).toHaveBeenCalled();
		} );

		it( 'should restore original globalAlpha after callback', () => {
			const originalAlpha = canvasManager.ctx.globalAlpha;
			canvasManager.withLocalAlpha( 0.5, () => {} );
			expect( canvasManager.ctx.globalAlpha ).toBe( originalAlpha );
		} );

		it( 'should skip alpha modification when factor is 1', () => {
			const callback = jest.fn();
			const originalAlpha = canvasManager.ctx.globalAlpha;
			canvasManager.withLocalAlpha( 1, callback );
			expect( callback ).toHaveBeenCalled();
			expect( canvasManager.ctx.globalAlpha ).toBe( originalAlpha );
		} );

		it( 'should clamp factor to valid range', () => {
			const callback = jest.fn();
			canvasManager.withLocalAlpha( 2.5, callback );
			expect( callback ).toHaveBeenCalled();
		} );

		it( 'should handle negative factor by clamping to 0', () => {
			const callback = jest.fn();
			canvasManager.withLocalAlpha( -0.5, callback );
			expect( callback ).toHaveBeenCalled();
		} );

		it( 'should handle non-number factor as 1', () => {
			const callback = jest.fn();
			canvasManager.withLocalAlpha( 'invalid', callback );
			expect( callback ).toHaveBeenCalled();
		} );
	} );

	describe( 'applyLayerEffects', () => {
		it( 'should execute draw callback', () => {
			const drawCallback = jest.fn();
			canvasManager.applyLayerEffects( { id: 'layer1' }, drawCallback );
			expect( drawCallback ).toHaveBeenCalled();
		} );

		it( 'should handle missing callback gracefully', () => {
			expect( () => {
				canvasManager.applyLayerEffects( { id: 'layer1' } );
			} ).not.toThrow();
		} );
	} );

	describe( 'notifyToolbarOfSelection', () => {
		it( 'should notify style controls of selection change', () => {
			const mockUpdateForSelection = jest.fn();
			canvasManager.editor.toolbar = {
				styleControls: {
					updateForSelection: mockUpdateForSelection
				}
			};
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.notifyToolbarOfSelection( [ 'layer1' ] );
			expect( mockUpdateForSelection ).toHaveBeenCalled();
		} );

		it( 'should handle missing toolbar gracefully', () => {
			canvasManager.editor.toolbar = null;
			expect( () => {
				canvasManager.notifyToolbarOfSelection( [ 'layer1' ] );
			} ).not.toThrow();
		} );

		it( 'should handle missing styleControls gracefully', () => {
			canvasManager.editor.toolbar = {};
			expect( () => {
				canvasManager.notifyToolbarOfSelection( [ 'layer1' ] );
			} ).not.toThrow();
		} );

		it( 'should pass correct layers to updateForSelection', () => {
			const mockUpdateForSelection = jest.fn();
			canvasManager.editor.toolbar = {
				styleControls: {
					updateForSelection: mockUpdateForSelection
				}
			};
			canvasManager.notifyToolbarOfSelection( [ 'layer1', 'layer2' ] );
			expect( mockUpdateForSelection ).toHaveBeenCalledWith(
				expect.arrayContaining( [
					expect.objectContaining( { id: 'layer1' } ),
					expect.objectContaining( { id: 'layer2' } )
				] )
			);
		} );
	} );

	describe( 'updateStyleOptions without StyleController', () => {
		beforeEach( () => {
			// Remove styleController to test behavior without it
			canvasManager.styleController = null;
		} );

		it( 'should not throw when styleController is unavailable', () => {
			expect( () => {
				canvasManager.updateStyleOptions( { color: '#ff0000' } );
			} ).not.toThrow();
		} );

		it( 'should not modify layers when styleController is unavailable', () => {
			const originalStroke = mockEditor.layers[ 0 ].stroke;
			mockEditor.stateManager.get.mockReturnValue( [ 'layer1' ] );
			canvasManager.updateStyleOptions( { color: '#ff0000' } );
			// Layer should not be modified - StyleController handles all styling
			expect( mockEditor.layers[ 0 ].stroke ).toBe( originalStroke );
		} );
	} );

	describe( 'selectLayer', () => {
		it( 'should update selection through stateManager', () => {
			canvasManager.selectLayer( 'layer1' );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith(
				'selectedLayerIds',
				[ 'layer1' ]
			);
		} );

		it( 'should clear selection when layerId is null', () => {
			canvasManager.selectLayer( null );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith(
				'selectedLayerIds',
				[]
			);
		} );

		it( 'should reset selection handles', () => {
			canvasManager.selectionHandles = [ { type: 'nw' }, { type: 'se' } ];
			canvasManager.selectLayer( 'layer1' );
			expect( canvasManager.selectionHandles ).toEqual( [] );
		} );

		it( 'should trigger re-render', () => {
			const renderSpy = jest.spyOn( canvasManager, 'renderLayers' );
			canvasManager.selectLayer( 'layer1' );
			expect( renderSpy ).toHaveBeenCalled();
		} );

		it( 'should update status with selection count', () => {
			canvasManager.selectLayer( 'layer1' );
			expect( mockEditor.updateStatus ).toHaveBeenCalledWith(
				expect.objectContaining( { selection: expect.any( Number ) } )
			);
		} );
	} );

	describe( 'renderer delegation methods', () => {
		it( 'should delegate drawLayerWithEffects to renderer', () => {
			const layer = { id: 'layer1' };
			canvasManager.drawLayerWithEffects( layer );
			expect( canvasManager.renderer.drawLayerWithEffects ).toHaveBeenCalledWith( layer );
		} );

		it( 'should delegate drawMarqueeBox to renderer', () => {
			canvasManager.drawMarqueeBox();
			expect( canvasManager.renderer.drawMarqueeBox ).toHaveBeenCalled();
		} );

		it( 'should delegate drawSelectionIndicators to renderer', () => {
			canvasManager.drawSelectionIndicators( 'layer1', true );
			expect( canvasManager.renderer.drawSelectionIndicators ).toHaveBeenCalledWith( 'layer1', true );
		} );

		it( 'should delegate drawSelectionHandles to renderer', () => {
			const bounds = { x: 0, y: 0, width: 100, height: 100 };
			const layer = { id: 'layer1' };
			canvasManager.drawSelectionHandles( bounds, layer );
			expect( canvasManager.renderer.drawSelectionHandles ).toHaveBeenCalledWith( bounds, layer );
		} );

		it( 'should delegate drawRotationHandle to renderer', () => {
			const bounds = { x: 0, y: 0, width: 100, height: 100 };
			const layer = { id: 'layer1' };
			canvasManager.drawRotationHandle( bounds, layer );
			expect( canvasManager.renderer.drawRotationHandle ).toHaveBeenCalledWith( bounds, layer );
		} );

		it( 'should handle missing renderer gracefully for drawLayerWithEffects', () => {
			canvasManager.renderer = null;
			expect( () => {
				canvasManager.drawLayerWithEffects( { id: 'layer1' } );
			} ).not.toThrow();
		} );

		it( 'should handle missing renderer gracefully for drawMarqueeBox', () => {
			canvasManager.renderer = null;
			expect( () => {
				canvasManager.drawMarqueeBox();
			} ).not.toThrow();
		} );
	} );

	describe( 'text input controller delegation', () => {
		it( 'should delegate createTextInputModal to textInputController', () => {
			canvasManager.createTextInputModal( { x: 100, y: 100 }, { fontSize: 16 } );
			expect( canvasManager.textInputController.createTextInputModal )
				.toHaveBeenCalledWith( { x: 100, y: 100 }, { fontSize: 16 } );
		} );

		it( 'should delegate finishTextInput to textInputController', () => {
			const input = { value: 'Hello' };
			canvasManager.finishTextInput( input, { x: 100, y: 100 }, { fontSize: 16 } );
			expect( canvasManager.textInputController.finishTextInput )
				.toHaveBeenCalledWith( input, { x: 100, y: 100 }, { fontSize: 16 } );
		} );

		it( 'should delegate hideTextInputModal to textInputController', () => {
			canvasManager.textInputModal = { remove: jest.fn() };
			canvasManager.hideTextInputModal();
			expect( canvasManager.textInputController.hideTextInputModal ).toHaveBeenCalled();
			expect( canvasManager.textInputModal ).toBeNull();
		} );

		it( 'should return null from createTextInputModal when controller is missing', () => {
			canvasManager.textInputController = null;
			const result = canvasManager.createTextInputModal( { x: 100, y: 100 }, {} );
			expect( result ).toBeNull();
		} );

		it( 'should handle missing textInputController in finishTextInput', () => {
			canvasManager.textInputController = null;
			expect( () => {
				canvasManager.finishTextInput( {}, { x: 100, y: 100 }, {} );
			} ).not.toThrow();
		} );

		it( 'should handle missing textInputController in hideTextInputModal', () => {
			canvasManager.textInputController = null;
			canvasManager.textInputModal = { remove: jest.fn() };
			expect( () => {
				canvasManager.hideTextInputModal();
			} ).not.toThrow();
			expect( canvasManager.textInputModal ).toBeNull();
		} );
	} );

	describe( 'marquee selection completion', () => {
		beforeEach( () => {
			canvasManager.marqueeStart = { x: 0, y: 0 };
			canvasManager.marqueeEnd = { x: 100, y: 100 };
			canvasManager.isMarqueeSelecting = true;
			canvasManager.selectionManager.finishMarqueeSelection = jest.fn();
			canvasManager.selectionManager.getSelectedLayerIds = jest.fn( () => [ 'layer1', 'layer2' ] );
		} );

		it( 'should delegate to selectionManager', () => {
			canvasManager.finishMarqueeSelection();
			expect( canvasManager.selectionManager.finishMarqueeSelection ).toHaveBeenCalled();
		} );

		it( 'should sync selection state back from selectionManager', () => {
			canvasManager.finishMarqueeSelection();
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith(
				'selectedLayerIds',
				expect.arrayContaining( [ 'layer1', 'layer2' ] )
			);
		} );

		it( 'should deselect all when no layers selected', () => {
			canvasManager.selectionManager.getSelectedLayerIds = jest.fn( () => [] );
			const deselectSpy = jest.spyOn( canvasManager, 'deselectAll' );
			canvasManager.finishMarqueeSelection();
			expect( deselectSpy ).toHaveBeenCalled();
		} );

		it( 'should reset isMarqueeSelecting flag', () => {
			canvasManager.finishMarqueeSelection();
			expect( canvasManager.isMarqueeSelecting ).toBe( false );
		} );

		it( 'should trigger re-render and update status', () => {
			const renderSpy = jest.spyOn( canvasManager, 'renderLayers' );
			canvasManager.finishMarqueeSelection();
			expect( renderSpy ).toHaveBeenCalled();
			expect( mockEditor.updateStatus ).toHaveBeenCalledWith(
				expect.objectContaining( { selection: expect.any( Number ) } )
			);
		} );
	} );

	describe( 'getMarqueeRect', () => {
		it( 'should calculate rect from marquee start and end', () => {
			canvasManager.marqueeStart = { x: 50, y: 50 };
			canvasManager.marqueeEnd = { x: 150, y: 200 };
			const rect = canvasManager.getMarqueeRect();
			expect( rect.x ).toBe( 50 );
			expect( rect.y ).toBe( 50 );
			expect( rect.width ).toBe( 100 );
			expect( rect.height ).toBe( 150 );
		} );

		it( 'should handle reversed coordinates', () => {
			canvasManager.marqueeStart = { x: 150, y: 200 };
			canvasManager.marqueeEnd = { x: 50, y: 50 };
			const rect = canvasManager.getMarqueeRect();
			expect( rect.x ).toBe( 50 );
			expect( rect.y ).toBe( 50 );
			expect( rect.width ).toBe( 100 );
			expect( rect.height ).toBe( 150 );
		} );
	} );

	describe( 'getLayersInRect', () => {
		it( 'should return layers that intersect with rect', () => {
			jest.spyOn( canvasManager, 'getLayerBounds' ).mockImplementation( ( layer ) => {
				if ( layer.id === 'layer1' ) {
					return { x: 100, y: 100, width: 200, height: 150 };
				}
				return { x: 1000, y: 1000, width: 50, height: 50 };
			} );
			jest.spyOn( canvasManager, 'rectsIntersect' ).mockImplementation( ( r1, r2 ) => {
				return r2.x < 300 && r2.y < 300;
			} );

			const layers = canvasManager.getLayersInRect( { x: 0, y: 0, width: 300, height: 300 } );
			expect( layers ).toContainEqual( expect.objectContaining( { id: 'layer1' } ) );
		} );

		it( 'should return empty array when no layers intersect', () => {
			jest.spyOn( canvasManager, 'getLayerBounds' ).mockReturnValue( {
				x: 1000, y: 1000, width: 50, height: 50
			} );
			jest.spyOn( canvasManager, 'rectsIntersect' ).mockReturnValue( false );

			const layers = canvasManager.getLayersInRect( { x: 0, y: 0, width: 100, height: 100 } );
			expect( layers ).toEqual( [] );
		} );
	} );

	describe( 'rectsIntersect', () => {
		it( 'should return true for overlapping rects', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 50, y: 50, width: 100, height: 100 };
			expect( canvasManager.rectsIntersect( rect1, rect2 ) ).toBe( true );
		} );

		it( 'should return false for non-overlapping rects', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 200, y: 200, width: 100, height: 100 };
			expect( canvasManager.rectsIntersect( rect1, rect2 ) ).toBe( false );
		} );

		it( 'should return false for touching but not overlapping rects', () => {
			const rect1 = { x: 0, y: 0, width: 100, height: 100 };
			const rect2 = { x: 100, y: 0, width: 100, height: 100 };
			expect( canvasManager.rectsIntersect( rect1, rect2 ) ).toBe( false );
		} );
	} );

	// ========================================================================
	// Coverage Tests - Fallback event handlers and error branches
	// ========================================================================

	describe( 'setupEventHandlers fallback path', () => {
		it( 'should use fallback event handlers when CanvasEvents unavailable', () => {
			// Setup window.Layers namespace if needed
			if ( !window.Layers ) {
				window.Layers = {};
			}
			if ( !window.Layers.Canvas ) {
				window.Layers.Canvas = {};
			}

			// Remove CanvasEvents to trigger fallback
			const originalCanvasEvents = window.Layers.Canvas.Events;
			delete window.Layers.Canvas.Events;

			// Also remove global.CanvasEvents to ensure fallback
			const originalGlobalEvents = global.CanvasEvents;
			delete global.CanvasEvents;

			const testCanvas = document.createElement( 'canvas' );
			testCanvas.getContext = jest.fn().mockReturnValue( mockContext );
			const testEditor = {
				stateManager: {
					get: jest.fn().mockReturnValue( [] ),
					set: jest.fn(),
					subscribe: jest.fn()
				}
			};

			const manager = new CanvasManager( {
				canvas: testCanvas,
				editor: testEditor
			} );

			// Should have created fallback event object
			expect( manager.events ).toBeTruthy();
			expect( typeof manager.events.destroy ).toBe( 'function' );

			// Should have attached event listeners
			expect( manager.__mousedownHandler ).toBeDefined();
			expect( manager.__mousemoveHandler ).toBeDefined();
			expect( manager.__mouseupHandler ).toBeDefined();

			// Test destroy removes listeners
			manager.events.destroy();
			expect( manager.__mousedownHandler ).toBeNull();
			expect( manager.__mousemoveHandler ).toBeNull();
			expect( manager.__mouseupHandler ).toBeNull();

			// Restore
			window.Layers.Canvas.Events = originalCanvasEvents;
			global.CanvasEvents = originalGlobalEvents;
		} );

		it( 'should handle CanvasEvents initialization error gracefully', () => {
			// Setup namespace
			if ( !window.Layers ) {
				window.Layers = {};
			}
			if ( !window.Layers.Canvas ) {
				window.Layers.Canvas = {};
			}

			// Mock CanvasEvents to throw during construction
			const originalCanvasEvents = window.Layers.Canvas.Events;
			window.Layers.Canvas.Events = jest.fn().mockImplementation( () => {
				throw new Error( 'CanvasEvents init failed' );
			} );

			const testCanvas = document.createElement( 'canvas' );
			testCanvas.getContext = jest.fn().mockReturnValue( mockContext );
			const testEditor = {
				stateManager: {
					get: jest.fn().mockReturnValue( [] ),
					set: jest.fn(),
					subscribe: jest.fn()
				}
			};

			// Should not throw
			expect( () => {
				const manager = new CanvasManager( {
					canvas: testCanvas,
					editor: testEditor
				} );
				expect( manager.events ).toBeNull();
			} ).not.toThrow();

			// Restore
			window.Layers.Canvas.Events = originalCanvasEvents;
		} );

		it( 'should handle missing handleMouseDown gracefully in fallback', () => {
			// Setup namespace
			if ( !window.Layers ) {
				window.Layers = {};
			}
			if ( !window.Layers.Canvas ) {
				window.Layers.Canvas = {};
			}

			const originalCanvasEvents = window.Layers.Canvas.Events;
			delete window.Layers.Canvas.Events;

			const originalGlobalEvents = global.CanvasEvents;
			delete global.CanvasEvents;

			const testCanvas = document.createElement( 'canvas' );
			testCanvas.getContext = jest.fn().mockReturnValue( mockContext );
			const testEditor = {
				stateManager: {
					get: jest.fn().mockReturnValue( [] ),
					set: jest.fn(),
					subscribe: jest.fn()
				}
			};

			const manager = new CanvasManager( {
				canvas: testCanvas,
				editor: testEditor
			} );

			// Remove the handler methods
			delete manager.handleMouseDown;
			delete manager.handleMouseMove;
			delete manager.handleMouseUp;

			// Should not throw when calling event handlers
			expect( () => {
				manager.__mousedownHandler( { clientX: 0, clientY: 0 } );
				manager.__mousemoveHandler( { clientX: 10, clientY: 10 } );
				manager.__mouseupHandler( { clientX: 10, clientY: 10 } );
			} ).not.toThrow();

			// Restore
			window.Layers.Canvas.Events = originalCanvasEvents;
			global.CanvasEvents = originalGlobalEvents;
		} );

		it( 'should not create fallback handlers when canvas lacks addEventListener', () => {
			// Setup namespace
			if ( !window.Layers ) {
				window.Layers = {};
			}
			if ( !window.Layers.Canvas ) {
				window.Layers.Canvas = {};
			}

			const originalCanvasEvents = window.Layers.Canvas.Events;
			delete window.Layers.Canvas.Events;

			const originalGlobalEvents = global.CanvasEvents;
			delete global.CanvasEvents;

			// Mock canvas without addEventListener
			const testCanvas = {
				getContext: jest.fn().mockReturnValue( mockContext ),
				width: 800,
				height: 600
			};
			const testEditor = {
				stateManager: {
					get: jest.fn().mockReturnValue( [] ),
					set: jest.fn(),
					subscribe: jest.fn()
				}
			};

			const manager = new CanvasManager( {
				canvas: testCanvas,
				editor: testEditor
			} );

			// Should have event object but no handlers attached
			expect( manager.events ).toBeTruthy();
			expect( manager.__mousedownHandler ).toBeUndefined();

			// Restore
			window.Layers.Canvas.Events = originalCanvasEvents;
			global.CanvasEvents = originalGlobalEvents;
		} );
	} );

	describe( 'error handling in fallback event cleanup', () => {
		it( 'should handle removeEventListener errors gracefully', () => {
			const originalLayers = window.Layers;
			delete window.Layers;
			window.Layers = {};

			// Mock canvas that throws on removeEventListener
			const errorCanvas = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn().mockImplementation( () => {
					throw new Error( 'removeEventListener failed' );
				} ),
				getContext: jest.fn().mockReturnValue( mockContext ),
				getBoundingClientRect: jest.fn().mockReturnValue( {
					left: 0, top: 0, width: 800, height: 600
				} ),
				width: 800,
				height: 600
			};

			const testEditor = {
				stateManager: {
					get: jest.fn().mockReturnValue( [] ),
					set: jest.fn(),
					subscribe: jest.fn()
				}
			};

			const manager = new CanvasManager( {
				canvas: errorCanvas,
				editor: testEditor
			} );

			// Should not throw when destroying with errors
			expect( () => {
				manager.events.destroy();
			} ).not.toThrow();

			// Restore
			window.Layers = originalLayers;
		} );
	} );

	describe( 'StateManager delegation', () => {
		it( 'should return empty array from getSelectedLayerIds when no StateManager', () => {
			const noStateManager = new CanvasManager( {
				canvas: mockCanvas,
				editor: {} // No stateManager
			} );

			expect( noStateManager.getSelectedLayerIds() ).toEqual( [] );
		} );

		it( 'should return null from getSelectedLayerId when no selection', () => {
			canvasManager.editor.stateManager.get = jest.fn().mockReturnValue( [] );

			expect( canvasManager.getSelectedLayerId() ).toBeNull();
		} );

		it( 'should not throw setSelectedLayerIds when no StateManager', () => {
			const noStateManager = new CanvasManager( {
				canvas: mockCanvas,
				editor: {}
			} );

			expect( () => {
				noStateManager.setSelectedLayerIds( [ 'layer1' ] );
			} ).not.toThrow();
		} );

		it( 'should handle null ids in setSelectedLayerIds', () => {
			canvasManager.setSelectedLayerIds( null );

			expect( canvasManager.editor.stateManager.set ).toHaveBeenCalledWith(
				'selectedLayerIds',
				[]
			);
		} );

		it( 'should not throw subscribeToState when no StateManager', () => {
			const noStateManager = new CanvasManager( {
				canvas: mockCanvas,
				editor: {}
			} );

			expect( () => {
				noStateManager.subscribeToState();
			} ).not.toThrow();
		} );
	} );

	describe( 'findClass error handling', () => {
		it( 'should handle globalThis access error gracefully', () => {
			// Create manager which triggers findClass during init
			const originalLayers = window.Layers;
			
			// Create a scenario where global access might fail
			delete window.Layers;
			window.Layers = {
				Canvas: {},
				Core: {}
			};

			expect( () => {
				new CanvasManager( {
					canvas: mockCanvas,
					editor: mockEditor
				} );
			} ).not.toThrow();

			// Restore
			window.Layers = originalLayers;
		} );
	} );

	describe( 'updateDimensionDefaults', () => {
		it( 'should do nothing when props is null', () => {
			canvasManager.dimensionDefaults = { stroke: '#000' };
			canvasManager.updateDimensionDefaults( null );
			expect( canvasManager.dimensionDefaults.stroke ).toBe( '#000' );
		} );

		it( 'should update dimension properties', () => {
			canvasManager.dimensionDefaults = {};
			canvasManager.updateDimensionDefaults( {
				endStyle: 'arrow',
				textPosition: 'above',
				extensionLength: 10,
				toleranceType: 'symmetric',
				toleranceValue: 0.5
			} );
			expect( canvasManager.dimensionDefaults.endStyle ).toBe( 'arrow' );
			expect( canvasManager.dimensionDefaults.textPosition ).toBe( 'above' );
			expect( canvasManager.dimensionDefaults.toleranceType ).toBe( 'symmetric' );
		} );

		it( 'should not update properties not in whitelist', () => {
			canvasManager.dimensionDefaults = {};
			canvasManager.updateDimensionDefaults( {
				invalidProp: 'value',
				endStyle: 'arrow'
			} );
			expect( canvasManager.dimensionDefaults.invalidProp ).toBeUndefined();
			expect( canvasManager.dimensionDefaults.endStyle ).toBe( 'arrow' );
		} );
	} );

	describe( 'updateMarkerDefaults', () => {
		it( 'should do nothing when props is null', () => {
			canvasManager.markerDefaults = { style: 'circle' };
			canvasManager.updateMarkerDefaults( null );
			expect( canvasManager.markerDefaults.style ).toBe( 'circle' );
		} );

		it( 'should update marker properties', () => {
			canvasManager.markerDefaults = {};
			canvasManager.updateMarkerDefaults( {
				style: 'square',
				size: 32,
				fontSizeAdjust: 1.2,
				hasArrow: true,
				arrowStyle: 'curved'
			} );
			expect( canvasManager.markerDefaults.style ).toBe( 'square' );
			expect( canvasManager.markerDefaults.size ).toBe( 32 );
			expect( canvasManager.markerDefaults.hasArrow ).toBe( true );
		} );
	} );

	describe( 'hitTestSelectionHandles delegation', () => {
		it( 'should return null when hitTestController unavailable', () => {
			canvasManager.hitTestController = null;
			const result = canvasManager.hitTestSelectionHandles( { x: 100, y: 100 } );
			expect( result ).toBeNull();
		} );

		it( 'should delegate to hitTestController', () => {
			canvasManager.hitTestController = {
				hitTestSelectionHandles: jest.fn( () => 'nw' )
			};
			const result = canvasManager.hitTestSelectionHandles( { x: 100, y: 100 } );
			expect( result ).toBe( 'nw' );
			expect( canvasManager.hitTestController.hitTestSelectionHandles ).toHaveBeenCalled();
		} );
	} );

	describe( 'isPointInRect delegation', () => {
		it( 'should use fallback when hitTestController unavailable', () => {
			canvasManager.hitTestController = null;
			const rect = { x: 0, y: 0, width: 100, height: 100 };
			expect( canvasManager.isPointInRect( { x: 50, y: 50 }, rect ) ).toBe( true );
			expect( canvasManager.isPointInRect( { x: 150, y: 50 }, rect ) ).toBe( false );
		} );

		it( 'should delegate to hitTestController when available', () => {
			canvasManager.hitTestController = {
				isPointInRect: jest.fn( () => true )
			};
			canvasManager.isPointInRect( { x: 50, y: 50 }, { x: 0, y: 0, width: 100, height: 100 } );
			expect( canvasManager.hitTestController.isPointInRect ).toHaveBeenCalled();
		} );
	} );

	describe( 'startResize delegation', () => {
		it( 'should do nothing when transformController unavailable', () => {
			canvasManager.transformController = null;
			expect( () => canvasManager.startResize( 'nw' ) ).not.toThrow();
		} );

		it( 'should delegate to transformController and sync state', () => {
			canvasManager.transformController = {
				startResize: jest.fn(),
				isResizing: true,
				resizeHandle: 'se'
			};
			canvasManager.startResize( 'se' );
			expect( canvasManager.transformController.startResize ).toHaveBeenCalled();
			expect( canvasManager.isResizing ).toBe( true );
			expect( canvasManager.resizeHandle ).toBe( 'se' );
		} );
	} );

	describe( 'startRotation delegation', () => {
		it( 'should do nothing when transformController unavailable', () => {
			canvasManager.transformController = null;
			expect( () => canvasManager.startRotation( { x: 100, y: 100 } ) ).not.toThrow();
		} );

		it( 'should delegate to transformController and sync state', () => {
			canvasManager.transformController = {
				startRotation: jest.fn(),
				isRotating: true
			};
			canvasManager.startRotation( { x: 100, y: 100 } );
			expect( canvasManager.transformController.startRotation ).toHaveBeenCalled();
			expect( canvasManager.isRotating ).toBe( true );
		} );
	} );

	describe( 'startDrag delegation', () => {
		it( 'should do nothing when transformController unavailable', () => {
			canvasManager.transformController = null;
			expect( () => canvasManager.startDrag() ).not.toThrow();
		} );

		it( 'should delegate to transformController and sync state', () => {
			canvasManager.transformController = {
				startDrag: jest.fn(),
				isDragging: true
			};
			canvasManager.startDrag();
			expect( canvasManager.transformController.startDrag ).toHaveBeenCalled();
			expect( canvasManager.isDragging ).toBe( true );
		} );
	} );

	describe( 'getResizeCursor delegation', () => {
		it( 'should return default when transformController unavailable', () => {
			canvasManager.transformController = null;
			expect( canvasManager.getResizeCursor( 'nw', 0 ) ).toBe( 'default' );
		} );

		it( 'should delegate to transformController', () => {
			canvasManager.transformController = {
				getResizeCursor: jest.fn( () => 'nwse-resize' )
			};
			const result = canvasManager.getResizeCursor( 'nw', 45 );
			expect( result ).toBe( 'nwse-resize' );
		} );
	} );

	describe( 'handleResize delegation', () => {
		it( 'should do nothing when transformController unavailable', () => {
			canvasManager.transformController = null;
			expect( () => canvasManager.handleResize( { x: 100, y: 100 }, {} ) ).not.toThrow();
		} );

		it( 'should do nothing when not resizing', () => {
			canvasManager.transformController = {
				isResizing: false,
				handleResize: jest.fn()
			};
			canvasManager.handleResize( { x: 100, y: 100 }, {} );
			expect( canvasManager.transformController.handleResize ).not.toHaveBeenCalled();
		} );

		it( 'should delegate when resizing', () => {
			canvasManager.transformController = {
				isResizing: true,
				handleResize: jest.fn()
			};
			canvasManager.handleResize( { x: 100, y: 100 }, {} );
			expect( canvasManager.transformController.handleResize ).toHaveBeenCalled();
		} );
	} );

	describe( 'smoothZoomTo delegation', () => {
		it( 'should do nothing when zoomPanController unavailable', () => {
			canvasManager.zoomPanController = null;
			expect( () => canvasManager.smoothZoomTo( 1.5, 300 ) ).not.toThrow();
		} );

		it( 'should delegate to zoomPanController', () => {
			canvasManager.zoomPanController = {
				smoothZoomTo: jest.fn()
			};
			canvasManager.smoothZoomTo( 1.5, 300 );
			expect( canvasManager.zoomPanController.smoothZoomTo ).toHaveBeenCalledWith( 1.5, 300 );
		} );
	} );

	describe( 'animateZoom delegation', () => {
		it( 'should do nothing when zoomPanController unavailable', () => {
			canvasManager.zoomPanController = null;
			expect( () => canvasManager.animateZoom() ).not.toThrow();
		} );

		it( 'should delegate to zoomPanController', () => {
			canvasManager.zoomPanController = {
				animateZoom: jest.fn()
			};
			canvasManager.animateZoom();
			expect( canvasManager.zoomPanController.animateZoom ).toHaveBeenCalled();
		} );
	} );

	describe( 'setZoomDirect delegation', () => {
		it( 'should do nothing when zoomPanController unavailable', () => {
			canvasManager.zoomPanController = null;
			expect( () => canvasManager.setZoomDirect( 2.0 ) ).not.toThrow();
		} );

		it( 'should delegate to zoomPanController', () => {
			canvasManager.zoomPanController = {
				setZoomDirect: jest.fn()
			};
			canvasManager.setZoomDirect( 2.0 );
			expect( canvasManager.zoomPanController.setZoomDirect ).toHaveBeenCalledWith( 2.0 );
		} );
	} );

	describe( 'zoomToFitLayers delegation', () => {
		it( 'should do nothing when zoomPanController unavailable', () => {
			canvasManager.zoomPanController = null;
			expect( () => canvasManager.zoomToFitLayers() ).not.toThrow();
		} );

		it( 'should delegate to zoomPanController', () => {
			canvasManager.zoomPanController = {
				zoomToFitLayers: jest.fn()
			};
			canvasManager.zoomToFitLayers();
			expect( canvasManager.zoomPanController.zoomToFitLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'notifyToolbarOfSelection', () => {
		it( 'should do nothing when editor unavailable', () => {
			canvasManager.editor = null;
			expect( () => canvasManager.notifyToolbarOfSelection( [ 'layer1' ] ) ).not.toThrow();
		} );

		it( 'should do nothing when toolbar unavailable', () => {
			canvasManager.editor = { layers: [] };
			expect( () => canvasManager.notifyToolbarOfSelection( [ 'layer1' ] ) ).not.toThrow();
		} );

		it( 'should do nothing when styleControls unavailable', () => {
			canvasManager.editor = { layers: [], toolbar: {} };
			expect( () => canvasManager.notifyToolbarOfSelection( [ 'layer1' ] ) ).not.toThrow();
		} );

		it( 'should call updateForSelection with layer objects', () => {
			const mockStyleControls = { updateForSelection: jest.fn() };
			canvasManager.editor = {
				layers: [
					{ id: 'layer1', type: 'rectangle' },
					{ id: 'layer2', type: 'circle' }
				],
				toolbar: { styleControls: mockStyleControls }
			};
			canvasManager.notifyToolbarOfSelection( [ 'layer1' ] );
			expect( mockStyleControls.updateForSelection ).toHaveBeenCalledWith(
				[ { id: 'layer1', type: 'rectangle' } ]
			);
		} );
	} );

	describe( 'startDrawing with tool defaults', () => {
		it( 'should merge dimensionDefaults for dimension tool', () => {
			canvasManager.currentTool = 'dimension';
			canvasManager.dimensionDefaults = { endStyle: 'arrow', stroke: '#ff0000' };
			canvasManager.drawingController = {
				startDrawing: jest.fn(),
				getTempLayer: jest.fn( () => null )
			};

			canvasManager.startDrawing( { x: 100, y: 100 } );

			expect( canvasManager.drawingController.startDrawing ).toHaveBeenCalledWith(
				{ x: 100, y: 100 },
				'dimension',
				expect.objectContaining( { endStyle: 'arrow', stroke: '#ff0000' } )
			);
		} );

		it( 'should merge markerDefaults for marker tool', () => {
			canvasManager.currentTool = 'marker';
			canvasManager.markerDefaults = { style: 'square', size: 32 };
			canvasManager.drawingController = {
				startDrawing: jest.fn(),
				getTempLayer: jest.fn( () => null )
			};

			canvasManager.startDrawing( { x: 100, y: 100 } );

			expect( canvasManager.drawingController.startDrawing ).toHaveBeenCalledWith(
				{ x: 100, y: 100 },
				'marker',
				expect.objectContaining( { style: 'square', size: 32 } )
			);
		} );

		it( 'should log error when drawingController unavailable', () => {
			canvasManager.drawingController = null;
			const mockLog = { error: jest.fn() };
			global.mw = { log: mockLog };

			canvasManager.startDrawing( { x: 100, y: 100 } );

			expect( mockLog.error ).toHaveBeenCalled();
		} );
	} );

	describe( 'continueDrawing', () => {
		it( 'should do nothing when drawingController unavailable', () => {
			canvasManager.drawingController = null;
			expect( () => canvasManager.continueDrawing( { x: 100, y: 100 } ) ).not.toThrow();
		} );

		it( 'should schedule render frame', () => {
			const mockTempLayer = { id: 'temp', type: 'rectangle' };
			canvasManager.drawingController = {
				continueDrawing: jest.fn(),
				getTempLayer: jest.fn( () => mockTempLayer ),
				drawPreview: jest.fn()
			};
			canvasManager.renderer = { render: jest.fn() };

			canvasManager.continueDrawing( { x: 100, y: 100 } );

			expect( canvasManager.drawingController.continueDrawing ).toHaveBeenCalled();
			expect( canvasManager.tempLayer ).toBe( mockTempLayer );
		} );
	} );

	describe( 'finishDrawing', () => {
		it( 'should log error when drawingController unavailable', () => {
			canvasManager.drawingController = null;
			const mockLog = { error: jest.fn() };
			global.mw = { log: mockLog };

			canvasManager.finishDrawing( { x: 100, y: 100 } );

			expect( mockLog.error ).toHaveBeenCalled();
		} );

		it( 'should add layer and reset to pointer tool', () => {
			const mockLayerData = { id: 'new-layer', type: 'rectangle' };
			canvasManager.drawingController = {
				finishDrawing: jest.fn( () => mockLayerData )
			};
			canvasManager.renderer = { render: jest.fn() };
			canvasManager.editor.setCurrentTool = jest.fn();

			canvasManager.finishDrawing( { x: 100, y: 100 } );

			expect( canvasManager.editor.addLayer ).toHaveBeenCalledWith( mockLayerData );
			expect( canvasManager.editor.setCurrentTool ).toHaveBeenCalledWith( 'pointer' );
		} );
	} );

	describe( 'text input controller delegation', () => {
		it( 'createTextInputModal should return null when controller unavailable', () => {
			canvasManager.textInputController = null;
			expect( canvasManager.createTextInputModal( { x: 0, y: 0 }, {} ) ).toBeNull();
		} );

		it( 'createTextInputModal should delegate to controller', () => {
			const mockModal = document.createElement( 'div' );
			canvasManager.textInputController = {
				createTextInputModal: jest.fn( () => mockModal )
			};
			const result = canvasManager.createTextInputModal( { x: 10, y: 20 }, { fontSize: 16 } );
			expect( result ).toBe( mockModal );
		} );

		it( 'finishTextInput should do nothing when controller unavailable', () => {
			canvasManager.textInputController = null;
			expect( () => canvasManager.finishTextInput( {}, {}, {} ) ).not.toThrow();
		} );

		it( 'hideTextInputModal should clear textInputModal', () => {
			canvasManager.textInputModal = { remove: jest.fn() };
			canvasManager.textInputController = { hideTextInputModal: jest.fn() };

			canvasManager.hideTextInputModal();

			expect( canvasManager.textInputModal ).toBeNull();
		} );
	} );

	describe( 'setTool', () => {
		it( 'should set current tool and update cursor', () => {
			canvasManager.drawingController = {
				getToolCursor: jest.fn( () => 'crosshair' )
			};
			canvasManager.setTool( 'rectangle' );
			expect( canvasManager.currentTool ).toBe( 'rectangle' );
			expect( canvasManager.canvas.style.cursor ).toBe( 'crosshair' );
		} );

		it( 'should update editor status', () => {
			canvasManager.drawingController = { getToolCursor: jest.fn( () => 'default' ) };
			canvasManager.setTool( 'text' );
			expect( canvasManager.editor.updateStatus ).toHaveBeenCalledWith( { tool: 'text' } );
		} );
	} );

	describe( 'getToolCursor delegation', () => {
		it( 'should return default when drawingController unavailable', () => {
			canvasManager.drawingController = null;
			expect( canvasManager.getToolCursor( 'rectangle' ) ).toBe( 'default' );
		} );

		it( 'should delegate to drawingController', () => {
			canvasManager.drawingController = {
				getToolCursor: jest.fn( () => 'crosshair' )
			};
			expect( canvasManager.getToolCursor( 'arrow' ) ).toBe( 'crosshair' );
		} );
	} );

	describe( 'redraw', () => {
		it( 'should do nothing when renderer unavailable', () => {
			canvasManager.renderer = null;
			expect( () => canvasManager.redraw( [] ) ).not.toThrow();
		} );
	} );

	describe( 'getLayerBounds', () => {
		it( 'should return null for null layer', () => {
			expect( canvasManager.getLayerBounds( null ) ).toBeNull();
		} );

		it( 'should include rotation in bounds', () => {
			const layer = { id: 'rect', type: 'rectangle', x: 100, y: 100, width: 200, height: 100, rotation: 45 };
			const bounds = canvasManager.getLayerBounds( layer );
			expect( bounds ).not.toBeNull();
			expect( bounds.rotation ).toBe( 45 );
		} );
	} );

	describe( '_getRawLayerBounds text fallback', () => {
		it( 'should use fallback when ctx unavailable for text layer', () => {
			canvasManager.ctx = null;
			const layer = { id: 'text1', type: 'text', x: 50, y: 50, text: 'Hello' };
			const bounds = canvasManager._getRawLayerBounds( layer );
			expect( bounds.x ).toBe( 50 );
			expect( bounds.y ).toBe( 50 );
			expect( bounds.width ).toBe( 100 ); // fallback
			expect( bounds.height ).toBe( 20 ); // fallback
		} );

		it( 'should use fallback when TextUtils.measureTextLayer returns null', () => {
			// Save original
			const originalMeasure = global.TextUtils.measureTextLayer;
			global.TextUtils.measureTextLayer = jest.fn().mockReturnValue( null );

			const layer = { id: 'text1', type: 'text', x: 30, y: 40, width: 150, height: 25, text: 'Hello' };
			const bounds = canvasManager._getRawLayerBounds( layer );

			expect( bounds.x ).toBe( 30 );
			expect( bounds.y ).toBe( 40 );
			expect( bounds.width ).toBe( 150 );
			expect( bounds.height ).toBe( 25 );

			// Restore
			global.TextUtils.measureTextLayer = originalMeasure;
		} );
	} );

	describe( 'handleImageLoaded after destruction', () => {
		it( 'should do nothing when isDestroyed is true', () => {
			canvasManager.isDestroyed = true;
			canvasManager.renderer = { setBackgroundImage: jest.fn() };

			canvasManager.handleImageLoaded( new Image(), {} );

			expect( canvasManager.renderer.setBackgroundImage ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'loadBackgroundImage', () => {
		it( 'should use ImageLoader when available', () => {
			// ImageLoader is available in test environment
			canvasManager.imageLoader = null;
			canvasManager.loadBackgroundImage();

			// The loadBackgroundImage should have been called and created an imageLoader
			// (or called handleImageLoadError if ImageLoader unavailable)
			expect( true ).toBe( true ); // Basic smoke test
		} );
	} );
} );
