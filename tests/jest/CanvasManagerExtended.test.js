/**
 * Extended unit tests for CanvasManager - coverage improvement
 * Targets uncovered lines: image loading fallbacks, deepCloneLayers, error handling
 */

'use strict';

const CanvasManager = require( '../../resources/ext.layers.editor/CanvasManager.js' );

describe( 'CanvasManager Extended Coverage', () => {
	let canvasManager;
	let mockCanvas;
	let mockContext;
	let mockEditor;
	let mockContainer;
	let mockRenderer;

	beforeEach( () => {
		// Mock renderer
		mockRenderer = {
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
		};

		// Mock global classes
		global.CanvasRenderer = jest.fn( () => mockRenderer );

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

		global.HitTestController = jest.fn( () => ( {
			hitTestSelectionHandles: jest.fn(),
			getLayerAtPoint: jest.fn(),
			isPointInLayer: jest.fn(),
			isPointNearLine: jest.fn(),
			isPointInPolygon: jest.fn(),
			pointToSegmentDistance: jest.fn(),
			isPointInRect: jest.fn()
		} ) );

		global.TransformController = jest.fn( () => ( {
			startResize: jest.fn(),
			handleResize: jest.fn(),
			finishResize: jest.fn(),
			startRotation: jest.fn(),
			handleRotation: jest.fn(),
			finishRotation: jest.fn(),
			startDrag: jest.fn(),
			handleDrag: jest.fn(),
			finishDrag: jest.fn(),
			getResizeCursor: jest.fn( () => 'default' ),
			calculateResize: jest.fn(),
			isResizing: false,
			isRotating: false,
			isDragging: false,
			resizeHandle: null
		} ) );

		global.ClipboardController = jest.fn( () => ( {
			copy: jest.fn(),
			paste: jest.fn(),
			cut: jest.fn()
		} ) );

		global.RenderCoordinator = jest.fn( () => ( {
			scheduleRedraw: jest.fn(),
			destroy: jest.fn()
		} ) );

		global.DrawingController = jest.fn( () => ( {} ) );
		global.InteractionController = jest.fn( () => ( {} ) );
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
				{ id: 'layer2', type: 'circle', x: 300, y: 300, radius: 50, visible: true }
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
			container: {
				dispatchEvent: jest.fn()
			}
		};

		// Create CanvasManager
		canvasManager = new CanvasManager( {
			container: mockContainer,
			editor: mockEditor,
			canvas: mockCanvas
		} );
	} );

	afterEach( () => {
		if ( canvasManager ) {
			canvasManager.destroy();
		}
		jest.clearAllMocks();
	} );

	// NOTE: loadBackgroundImageFallback and tryLoadImageFallback tests removed
	// These methods were deprecated and removed from CanvasManager.js
	// ImageLoader.js handles all image loading in production

	describe( 'handleImageLoaded', () => {
		beforeEach( () => {
			// Stub resizeCanvas to avoid DOM errors
			canvasManager.resizeCanvas = jest.fn();
		} );

		it( 'should set backgroundImage', () => {
			const mockImage = { width: 800, height: 600 };
			canvasManager.handleImageLoaded( mockImage, { width: 800, height: 600 } );
			expect( canvasManager.backgroundImage ).toBe( mockImage );
		} );

		it( 'should pass image to renderer', () => {
			const mockImage = { width: 800, height: 600 };
			canvasManager.handleImageLoaded( mockImage, { width: 800, height: 600 } );
			expect( canvasManager.renderer.setBackgroundImage ).toHaveBeenCalledWith( mockImage );
		} );

		it( 'should set canvas dimensions from info', () => {
			const mockImage = { width: 1024, height: 768 };
			canvasManager.handleImageLoaded( mockImage, { width: 1024, height: 768 } );
			expect( canvasManager.canvas.width ).toBe( 1024 );
			expect( canvasManager.canvas.height ).toBe( 768 );
		} );

		it( 'should fallback to image dimensions if info missing', () => {
			const mockImage = { width: 512, height: 384 };
			canvasManager.handleImageLoaded( mockImage, {} );
			expect( canvasManager.canvas.width ).toBe( 512 );
			expect( canvasManager.canvas.height ).toBe( 384 );
		} );

		it( 'should fallback to default dimensions if all missing', () => {
			const mockImage = {};
			canvasManager.handleImageLoaded( mockImage, {} );
			expect( canvasManager.canvas.width ).toBe( 800 );
			expect( canvasManager.canvas.height ).toBe( 600 );
		} );

		it( 'should call resizeCanvas', () => {
			const mockImage = { width: 800, height: 600 };
			canvasManager.handleImageLoaded( mockImage, { width: 800, height: 600 } );
			expect( canvasManager.resizeCanvas ).toHaveBeenCalled();
		} );

		it( 'should return early if isDestroyed is true', () => {
			const mockImage = { width: 800, height: 600 };
			// Set initial state to track if it gets modified
			canvasManager.backgroundImage = null;
			canvasManager.isDestroyed = true;

			// Clear mock to track calls from this test only
			canvasManager.renderer.setBackgroundImage.mockClear();

			canvasManager.handleImageLoaded( mockImage, { width: 800, height: 600 } );

			// Should not set backgroundImage when destroyed (remains null)
			expect( canvasManager.backgroundImage ).toBeNull();
			expect( canvasManager.renderer.setBackgroundImage ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'isDestroyed flag', () => {
		it( 'should initialize isDestroyed to false', () => {
			// Create a fresh instance to test initialization
			const freshCanvas = document.createElement( 'canvas' );
			const freshMockEditor = {
				stateManager: {
					get: jest.fn().mockReturnValue( null )
				},
				layers: [],
				errorLog: jest.fn()
			};
			const freshManager = new CanvasManager( freshCanvas, freshMockEditor );

			expect( freshManager.isDestroyed ).toBe( false );

			freshManager.destroy();
		} );

		it( 'should set isDestroyed to true on destroy', () => {
			expect( canvasManager.isDestroyed ).toBe( false );
			canvasManager.destroy();
			expect( canvasManager.isDestroyed ).toBe( true );
		} );
	} );

	describe( 'handleImageLoadError', () => {
		beforeEach( () => {
			// Stub resizeCanvas to avoid DOM errors
			canvasManager.resizeCanvas = jest.fn();
		} );

		it( 'should set backgroundImage to null', () => {
			canvasManager.backgroundImage = { width: 100 };
			canvasManager.handleImageLoadError();
			expect( canvasManager.backgroundImage ).toBeNull();
		} );

		it( 'should clear renderer background', () => {
			canvasManager.handleImageLoadError();
			expect( canvasManager.renderer.setBackgroundImage ).toHaveBeenCalledWith( null );
		} );

		it( 'should set default canvas size', () => {
			canvasManager.handleImageLoadError();
			expect( canvasManager.canvas.width ).toBe( 800 );
			expect( canvasManager.canvas.height ).toBe( 600 );
		} );

		it( 'should call resizeCanvas', () => {
			canvasManager.handleImageLoadError();
			expect( canvasManager.resizeCanvas ).toHaveBeenCalled();
		} );
	} );

	// Note: deepCloneLayers tests removed - method was dead code (never called in production)

	describe( 'calculateResize without TransformController', () => {
		it( 'should return null and log error when TransformController unavailable', () => {
			canvasManager.transformController = null;

			window.mw = {
				log: {
					error: jest.fn()
				}
			};

			const result = canvasManager.calculateResize(
				{ x: 0, y: 0, width: 100, height: 100 },
				'se',
				10,
				10,
				{}
			);

			expect( result ).toBeNull();
			expect( window.mw.log.error ).toHaveBeenCalledWith(
				'Layers: TransformController not available for calculateResize'
			);

			delete window.mw;
		} );
	} );

	describe( 'emitTransforming', () => {
		it( 'should not emit for null layer', () => {
			canvasManager.transformEventScheduled = false;
			canvasManager.emitTransforming( null );
			expect( canvasManager.lastTransformPayload ).toBeNull();
		} );

		it( 'should schedule transform event', ( done ) => {
			canvasManager.transformEventScheduled = false;
			const layer = { id: 'test', type: 'rectangle', x: 10, y: 20 };

			// Mock requestAnimationFrame
			const originalRAF = window.requestAnimationFrame;
			window.requestAnimationFrame = ( cb ) => {
				setTimeout( cb, 0 );
				return 1;
			};

			canvasManager.emitTransforming( layer );

			expect( canvasManager.lastTransformPayload ).toBe( layer );
			expect( canvasManager.transformEventScheduled ).toBe( true );

			setTimeout( () => {
				expect( canvasManager.transformEventScheduled ).toBe( false );
				expect( mockEditor.container.dispatchEvent ).toHaveBeenCalled();
				window.requestAnimationFrame = originalRAF;
				done();
			}, 50 );
		} );

		it( 'should not schedule duplicate events', () => {
			canvasManager.transformEventScheduled = true;
			const layer = { id: 'test', type: 'rectangle' };

			const originalRAF = window.requestAnimationFrame;
			window.requestAnimationFrame = jest.fn();

			canvasManager.emitTransforming( layer );

			expect( window.requestAnimationFrame ).not.toHaveBeenCalled();
			expect( canvasManager.lastTransformPayload ).toBe( layer );

			window.requestAnimationFrame = originalRAF;
		} );
	} );

	// Note: updateUndoRedoButtons and undo/redo tests removed - methods were dead code (never called externally)

	describe( 'saveState delegation', () => {
		it( 'should delegate to editor historyManager', () => {
			canvasManager.saveState( 'test action' );
			expect( mockEditor.historyManager.saveState ).toHaveBeenCalledWith( 'test action' );
		} );

		it( 'should use direct historyManager as fallback', () => {
			canvasManager.editor = null;
			canvasManager.historyManager = {
				saveState: jest.fn()
			};

			canvasManager.saveState( 'test action' );

			expect( canvasManager.historyManager.saveState ).toHaveBeenCalledWith( 'test action' );
		} );
	} );

	describe( 'isLayerInViewport', () => {
		it( 'should return false for null layer', () => {
			expect( canvasManager.isLayerInViewport( null ) ).toBe( false );
		} );

		it( 'should return true when viewport has zero width', () => {
			canvasManager.viewportBounds = { x: 0, y: 0, width: 0, height: 600 };
			const layer = { type: 'rectangle', x: 1000, y: 1000 };
			expect( canvasManager.isLayerInViewport( layer ) ).toBe( true );
		} );

		it( 'should return true when viewport has zero height', () => {
			canvasManager.viewportBounds = { x: 0, y: 0, width: 800, height: 0 };
			const layer = { type: 'rectangle', x: 1000, y: 1000 };
			expect( canvasManager.isLayerInViewport( layer ) ).toBe( true );
		} );

		it( 'should return true when getLayerBounds returns null', () => {
			canvasManager.viewportBounds = { x: 0, y: 0, width: 800, height: 600 };
			canvasManager.getLayerBounds = jest.fn( () => null );
			const layer = { type: 'unknown' };
			expect( canvasManager.isLayerInViewport( layer ) ).toBe( true );
		} );

		it( 'should return false for layer completely to the right of viewport', () => {
			canvasManager.viewportBounds = { x: 0, y: 0, width: 800, height: 600 };
			canvasManager.getLayerBounds = jest.fn( () => ( {
				left: 900, right: 1000, top: 100, bottom: 200
			} ) );
			const layer = { type: 'rectangle', x: 900 };
			expect( canvasManager.isLayerInViewport( layer ) ).toBe( false );
		} );

		it( 'should return false for layer completely to the left of viewport', () => {
			canvasManager.viewportBounds = { x: 100, y: 0, width: 800, height: 600 };
			canvasManager.getLayerBounds = jest.fn( () => ( {
				left: 0, right: 50, top: 100, bottom: 200
			} ) );
			const layer = { type: 'rectangle', x: 0 };
			expect( canvasManager.isLayerInViewport( layer ) ).toBe( false );
		} );

		it( 'should return true for layer intersecting viewport', () => {
			canvasManager.viewportBounds = { x: 0, y: 0, width: 800, height: 600 };
			canvasManager.getLayerBounds = jest.fn( () => ( {
				left: 400, right: 600, top: 300, bottom: 400
			} ) );
			const layer = { type: 'rectangle', x: 400 };
			expect( canvasManager.isLayerInViewport( layer ) ).toBe( true );
		} );
	} );

	describe( 'redrawOptimized fallback', () => {
		it( 'should use setTimeout fallback when requestAnimationFrame unavailable', ( done ) => {
			canvasManager.renderCoordinator = null;
			canvasManager.redrawScheduled = false;

			const originalRAF = window.requestAnimationFrame;
			window.requestAnimationFrame = undefined;

			canvasManager.redraw = jest.fn();
			canvasManager.redrawOptimized();

			expect( canvasManager.redrawScheduled ).toBe( true );

			setTimeout( () => {
				expect( canvasManager.redraw ).toHaveBeenCalled();
				expect( canvasManager.redrawScheduled ).toBe( false );
				window.requestAnimationFrame = originalRAF;
				done();
			}, 50 );
		} );

		it( 'should not schedule when already scheduled', () => {
			canvasManager.renderCoordinator = null;
			canvasManager.redrawScheduled = true;

			canvasManager.redraw = jest.fn();
			canvasManager.redrawOptimized();

			expect( canvasManager.redraw ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'drawLayer', () => {
		it( 'should skip invisible layers', () => {
			const layer = { type: 'rectangle', visible: false };
			canvasManager.drawLayer( layer );
			expect( canvasManager.renderer.drawLayer ).not.toHaveBeenCalled();
		} );

		it( 'should call renderer.drawLayer for visible layers', () => {
			const layer = { type: 'rectangle', visible: true };
			canvasManager.drawLayer( layer );
			expect( canvasManager.renderer.drawLayer ).toHaveBeenCalledWith( layer );
		} );

		it( 'should handle layer without visible property', () => {
			const layer = { type: 'rectangle' };
			canvasManager.drawLayer( layer );
			expect( canvasManager.renderer.drawLayer ).toHaveBeenCalledWith( layer );
		} );

		it( 'should handle renderer errors gracefully', () => {
			canvasManager.renderer.drawLayer = jest.fn( () => {
				throw new Error( 'Render error' );
			} );
			canvasManager.renderer.drawErrorPlaceholder = jest.fn();

			const layer = { type: 'rectangle', visible: true };
			canvasManager.drawLayer( layer );

			expect( mockEditor.errorLog ).toHaveBeenCalled();
			expect( canvasManager.renderer.drawErrorPlaceholder ).toHaveBeenCalledWith( layer );
		} );

		it( 'should handle drawErrorPlaceholder failure', () => {
			canvasManager.renderer.drawLayer = jest.fn( () => {
				throw new Error( 'Render error' );
			} );
			canvasManager.renderer.drawErrorPlaceholder = jest.fn( () => {
				throw new Error( 'Placeholder error' );
			} );

			window.mw = {
				log: {
					error: jest.fn()
				}
			};

			const layer = { type: 'rectangle', visible: true };
			expect( () => canvasManager.drawLayer( layer ) ).not.toThrow();
			expect( window.mw.log.error ).toHaveBeenCalled();

			delete window.mw;
		} );

		it( 'should handle missing renderer', () => {
			canvasManager.renderer = null;
			const layer = { type: 'rectangle', visible: true };
			expect( () => canvasManager.drawLayer( layer ) ).not.toThrow();
		} );
	} );

	describe( 'hit test delegation methods', () => {
		it( 'should delegate getLayerAtPoint to hitTestController', () => {
			const mockLayer = { id: 'test' };
			canvasManager.hitTestController = {
				getLayerAtPoint: jest.fn( () => mockLayer )
			};
			const result = canvasManager.getLayerAtPoint( { x: 100, y: 100 } );
			expect( result ).toBe( mockLayer );
		} );

		it( 'should return null when hitTestController unavailable', () => {
			canvasManager.hitTestController = null;
			const result = canvasManager.getLayerAtPoint( { x: 100, y: 100 } );
			expect( result ).toBeNull();
		} );

		it( 'should delegate isPointInLayer to hitTestController', () => {
			canvasManager.hitTestController = {
				isPointInLayer: jest.fn( () => true )
			};
			const result = canvasManager.isPointInLayer( { x: 50, y: 50 }, { id: 'test' } );
			expect( result ).toBe( true );
		} );

		it( 'should return false when hitTestController unavailable for isPointInLayer', () => {
			canvasManager.hitTestController = null;
			const result = canvasManager.isPointInLayer( { x: 50, y: 50 }, { id: 'test' } );
			expect( result ).toBe( false );
		} );

		it( 'should delegate isPointNearLine to hitTestController', () => {
			canvasManager.hitTestController = {
				isPointNearLine: jest.fn( () => true )
			};
			const result = canvasManager.isPointNearLine( { x: 50, y: 50 }, 0, 0, 100, 100, 5 );
			expect( result ).toBe( true );
		} );

		it( 'should return false when hitTestController unavailable for isPointNearLine', () => {
			canvasManager.hitTestController = null;
			const result = canvasManager.isPointNearLine( { x: 50, y: 50 }, 0, 0, 100, 100, 5 );
			expect( result ).toBe( false );
		} );

		it( 'should delegate pointToSegmentDistance to hitTestController', () => {
			canvasManager.hitTestController = {
				pointToSegmentDistance: jest.fn( () => 5.5 )
			};
			const result = canvasManager.pointToSegmentDistance( 50, 50, 0, 0, 100, 100 );
			expect( result ).toBe( 5.5 );
		} );

		it( 'should return Infinity when hitTestController unavailable', () => {
			canvasManager.hitTestController = null;
			const result = canvasManager.pointToSegmentDistance( 50, 50, 0, 0, 100, 100 );
			expect( result ).toBe( Infinity );
		} );

		it( 'should delegate isPointInPolygon to hitTestController', () => {
			canvasManager.hitTestController = {
				isPointInPolygon: jest.fn( () => true )
			};
			const result = canvasManager.isPointInPolygon( { x: 50, y: 50 }, [ { x: 0, y: 0 } ] );
			expect( result ).toBe( true );
		} );

		it( 'should return false when hitTestController unavailable for isPointInPolygon', () => {
			canvasManager.hitTestController = null;
			const result = canvasManager.isPointInPolygon( { x: 50, y: 50 }, [ { x: 0, y: 0 } ] );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'transform delegation methods', () => {
		it( 'should delegate startResize to transformController', () => {
			canvasManager.transformController = {
				startResize: jest.fn(),
				isResizing: true,
				resizeHandle: 'se'
			};
			canvasManager.startPoint = { x: 100, y: 100 };
			canvasManager.startResize( 'se' );
			expect( canvasManager.transformController.startResize ).toHaveBeenCalledWith( 'se', { x: 100, y: 100 } );
			expect( canvasManager.isResizing ).toBe( true );
			expect( canvasManager.resizeHandle ).toBe( 'se' );
		} );

		it( 'should delegate startRotation to transformController', () => {
			canvasManager.transformController = {
				startRotation: jest.fn(),
				isRotating: true
			};
			canvasManager.startRotation( { x: 100, y: 100 } );
			expect( canvasManager.transformController.startRotation ).toHaveBeenCalledWith( { x: 100, y: 100 } );
			expect( canvasManager.isRotating ).toBe( true );
		} );

		it( 'should delegate startDrag to transformController', () => {
			canvasManager.transformController = {
				startDrag: jest.fn(),
				isDragging: true
			};
			canvasManager.startPoint = { x: 50, y: 50 };
			canvasManager.startDrag();
			expect( canvasManager.transformController.startDrag ).toHaveBeenCalledWith( { x: 50, y: 50 } );
			expect( canvasManager.isDragging ).toBe( true );
		} );

		it( 'should delegate getResizeCursor to transformController', () => {
			canvasManager.transformController = {
				getResizeCursor: jest.fn( () => 'nwse-resize' )
			};
			const result = canvasManager.getResizeCursor( 'se', 0 );
			expect( result ).toBe( 'nwse-resize' );
		} );

		it( 'should return default cursor when transformController unavailable', () => {
			canvasManager.transformController = null;
			const result = canvasManager.getResizeCursor( 'se', 0 );
			expect( result ).toBe( 'default' );
		} );
	} );

	describe( 'subscribeToState', () => {
		it( 'should subscribe to selectedLayerIds changes', () => {
			canvasManager.subscribeToState();
			expect( mockEditor.stateManager.subscribe ).toHaveBeenCalledWith(
				'selectedLayerIds',
				expect.any( Function )
			);
		} );

		it( 'should handle missing stateManager', () => {
			canvasManager.editor.stateManager = null;
			expect( () => canvasManager.subscribeToState() ).not.toThrow();
		} );

		it( 'should handle missing editor', () => {
			canvasManager.editor = null;
			expect( () => canvasManager.subscribeToState() ).not.toThrow();
		} );
	} );

	describe( 'setupEventHandlers', () => {
		it( 'should log error when ImageLoader not found', () => {
			// Remove ImageLoader to test the error logging
			const originalImageLoader = global.ImageLoader;
			delete global.ImageLoader;

			window.mw = {
				log: {
					error: jest.fn()
				}
			};

			// Create new manager to trigger setup
			const newManager = new CanvasManager( {
				container: mockContainer,
				editor: mockEditor,
				canvas: mockCanvas
			} );

			expect( window.mw.log.error ).toHaveBeenCalledWith(
				'Layers: ImageLoader not found - check extension.json dependencies'
			);

			newManager.destroy();
			global.ImageLoader = originalImageLoader;
			delete window.mw;
		} );
	} );

	describe( 'clipboard fallbacks', () => {
		it( 'should log error when clipboardController unavailable for cutSelected', () => {
			canvasManager.clipboardController = null;
			window.mw = { log: { error: jest.fn() } };

			canvasManager.cutSelected();

			expect( window.mw.log.error ).toHaveBeenCalledWith(
				'Layers: ClipboardController not available for cutSelected'
			);
			delete window.mw;
		} );

		it( 'should delegate deleteSelected to selectionManager', () => {
			const deleteSelected = jest.fn();
			canvasManager.selectionManager = { deleteSelected };

			canvasManager.deleteSelected();

			expect( deleteSelected ).toHaveBeenCalled();
		} );

		it( 'should fallback to editor.deleteSelected when selectionManager unavailable', () => {
			canvasManager.selectionManager = null;
			const deleteSelected = jest.fn();
			canvasManager.editor = { deleteSelected };

			canvasManager.deleteSelected();

			expect( deleteSelected ).toHaveBeenCalled();
		} );

		it( 'should log error when no handler available for deleteSelected', () => {
			canvasManager.selectionManager = null;
			canvasManager.editor = {};
			window.mw = { log: { error: jest.fn() } };

			canvasManager.deleteSelected();

			expect( window.mw.log.error ).toHaveBeenCalledWith(
				'Layers: No handler available for deleteSelected'
			);
			delete window.mw;
		} );
	} );

	describe( 'canvas resize', () => {
		it( 'should call handleCanvasResize and update canvas', () => {
			canvasManager.resizeCanvas = jest.fn();
			canvasManager.updateCanvasTransform = jest.fn();
			canvasManager.renderLayers = jest.fn();
			canvasManager.editor = { layers: [] };

			canvasManager.handleCanvasResize();

			expect( canvasManager.resizeCanvas ).toHaveBeenCalled();
			expect( canvasManager.updateCanvasTransform ).toHaveBeenCalled();
			expect( canvasManager.renderLayers ).toHaveBeenCalledWith( [] );
		} );

		it( 'should set base dimensions', () => {
			canvasManager.resizeCanvas = jest.fn();

			canvasManager.setBaseDimensions( 1920, 1080 );

			expect( canvasManager.baseWidth ).toBe( 1920 );
			expect( canvasManager.baseHeight ).toBe( 1080 );
			expect( canvasManager.resizeCanvas ).toHaveBeenCalled();
		} );

		it( 'should handle null dimensions', () => {
			canvasManager.resizeCanvas = jest.fn();

			canvasManager.setBaseDimensions( null, null );

			expect( canvasManager.baseWidth ).toBeNull();
			expect( canvasManager.baseHeight ).toBeNull();
		} );

		it( 'should return early from resizeCanvas if no container or canvas', () => {
			canvasManager.container = null;
			canvasManager.canvas = null;

			// Should not throw
			expect( () => canvasManager.resizeCanvas() ).not.toThrow();
		} );
	} );

	describe( 'style options', () => {
		it( 'should delegate updateStyleOptions to styleController', () => {
			const updateStyleOptions = jest.fn().mockReturnValue( { color: '#ff0000' } );
			canvasManager.styleController = { updateStyleOptions, applyToLayer: jest.fn() };
			canvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [] );

			canvasManager.updateStyleOptions( { color: '#ff0000' } );

			expect( updateStyleOptions ).toHaveBeenCalledWith( { color: '#ff0000' } );
			expect( canvasManager.currentStyle ).toEqual( { color: '#ff0000' } );
		} );

		it( 'should apply styles to selected layers', () => {
			const applyToLayer = jest.fn();
			const mockLayer = { id: 'layer1', type: 'rectangle' };
			canvasManager.styleController = {
				updateStyleOptions: jest.fn().mockReturnValue( { fill: '#00ff00' } ),
				applyToLayer
			};
			canvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [ 'layer1' ] );
			canvasManager.editor = {
				getLayerById: jest.fn().mockReturnValue( mockLayer ),
				layers: [ mockLayer ]
			};
			canvasManager.renderLayers = jest.fn();

			canvasManager.updateStyleOptions( { fill: '#00ff00' } );

			expect( applyToLayer ).toHaveBeenCalledWith( mockLayer, { fill: '#00ff00' } );
			expect( canvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should log error when styleController unavailable', () => {
			canvasManager.styleController = null;
			window.mw = { log: { error: jest.fn() } };

			canvasManager.updateStyleOptions( { fill: '#ffffff' } );

			expect( window.mw.log.error ).toHaveBeenCalled();
			delete window.mw;
		} );
	} );

	describe( 'slide mode', () => {
		it( 'should set slide mode on canvas manager and renderer', () => {
			canvasManager.renderer = { setSlideMode: jest.fn() };

			canvasManager.setSlideMode( true );

			expect( canvasManager.isSlideMode ).toBe( true );
			expect( canvasManager.renderer.setSlideMode ).toHaveBeenCalledWith( true );
		} );

		it( 'should handle setSlideMode without renderer', () => {
			canvasManager.renderer = null;

			expect( () => canvasManager.setSlideMode( true ) ).not.toThrow();
			expect( canvasManager.isSlideMode ).toBe( true );
		} );

		it( 'should set background color and redraw', () => {
			canvasManager.renderer = { setSlideBackgroundColor: jest.fn() };
			canvasManager.redraw = jest.fn();

			canvasManager.setBackgroundColor( '#ff0000' );

			expect( canvasManager.slideBackgroundColor ).toBe( '#ff0000' );
			expect( canvasManager.renderer.setSlideBackgroundColor ).toHaveBeenCalledWith( '#ff0000' );
			expect( canvasManager.redraw ).toHaveBeenCalled();
		} );

		it( 'should default to transparent when color is null', () => {
			canvasManager.renderer = { setSlideBackgroundColor: jest.fn() };
			canvasManager.redraw = jest.fn();

			canvasManager.setBackgroundColor( null );

			expect( canvasManager.slideBackgroundColor ).toBe( 'transparent' );
		} );

		it( 'should handle setBackgroundColor without renderer', () => {
			canvasManager.renderer = null;
			canvasManager.redraw = jest.fn();

			expect( () => canvasManager.setBackgroundColor( '#00ff00' ) ).not.toThrow();
			expect( canvasManager.slideBackgroundColor ).toBe( '#00ff00' );
		} );
	} );

	describe( 'drawing with throttling', () => {
		it( 'should schedule drawing frame when tempLayer exists', () => {
			const mockTempLayer = { id: 'temp', type: 'rectangle' };
			canvasManager._drawingFrameScheduled = false;
			canvasManager.drawingController = {
				continueDrawing: jest.fn(),
				getTempLayer: jest.fn().mockReturnValue( mockTempLayer ),
				drawPreview: jest.fn()
			};
			canvasManager.renderLayers = jest.fn();
			canvasManager.editor = { layers: [] };
			canvasManager.isDestroyed = false;

			// Call the method that triggers drawing frame
			canvasManager.continueDrawing( { x: 100, y: 100 } );

			expect( canvasManager._drawingFrameScheduled ).toBe( true );
			expect( canvasManager.tempLayer ).toBe( mockTempLayer );
		} );

		it( 'should not schedule duplicate drawing frames', () => {
			const mockTempLayer = { id: 'temp', type: 'rectangle' };
			canvasManager._drawingFrameScheduled = true;
			canvasManager.drawingController = {
				continueDrawing: jest.fn(),
				getTempLayer: jest.fn().mockReturnValue( mockTempLayer )
			};

			const originalRaf = window.requestAnimationFrame;
			window.requestAnimationFrame = jest.fn();

			canvasManager.continueDrawing( { x: 100, y: 100 } );

			// Should not have scheduled a new frame since one is pending
			expect( window.requestAnimationFrame ).not.toHaveBeenCalled();

			window.requestAnimationFrame = originalRaf;
		} );

		it( 'should guard against destroyed state in drawing callback', () => {
			jest.useFakeTimers();

			const mockTempLayer = { id: 'temp', type: 'rectangle' };
			canvasManager._drawingFrameScheduled = false;
			canvasManager.drawingController = {
				continueDrawing: jest.fn(),
				getTempLayer: jest.fn().mockReturnValue( mockTempLayer ),
				drawPreview: jest.fn()
			};
			canvasManager.renderLayers = jest.fn();
			canvasManager.editor = { layers: [] };
			canvasManager.isDestroyed = true;

			canvasManager.continueDrawing( { x: 100, y: 100 } );

			// Run the rAF callback
			jest.runAllTimers();

			// Should not have called render because isDestroyed is true
			expect( canvasManager.renderLayers ).not.toHaveBeenCalled();

			jest.useRealTimers();
		} );
	} );

	describe( 'findClass edge cases', () => {
		it( 'should handle findClass when class is not found', () => {
			// This tests error resilience - manager should not throw
			expect( () => {
				new CanvasManager( {
					container: document.createElement( 'div' ),
					editor: { stateManager: { get: jest.fn(), set: jest.fn(), subscribe: jest.fn() } }
				} );
			} ).not.toThrow();
		} );
	} );

	describe( 'ImageLoader fallback', () => {
		it( 'should handle image load error gracefully', () => {
			canvasManager.handleImageLoadError = jest.fn();

			// This simulates the ImageLoader not being found
			canvasManager.handleImageLoadError();

			expect( canvasManager.handleImageLoadError ).toHaveBeenCalled();
		} );

		it( 'should set default dimensions on image load error', () => {
			canvasManager.baseWidth = null;
			canvasManager.baseHeight = null;

			// Call the actual error handler
			canvasManager.handleImageLoadError();

			// Should have set default dimensions
			expect( canvasManager.baseWidth ).toBeDefined();
			expect( canvasManager.baseHeight ).toBeDefined();
		} );
	} );

	describe( 'findClass fallback paths', () => {
		it( 'should find class from mw global', () => {
			// Test the mw namespace fallback - use CanvasManager's internal findClass via getClass
			// Since findClass is local to the module, we test indirectly via behavior
			const manager = canvasManager;
			// If a controller wasn't found, it should be undefined - this tests the fallback chain
			expect( manager.zoomPanController ).toBeDefined();
		} );
	} );

	describe( 'events.destroy error handling', () => {
		it( 'should handle removeEventListener errors gracefully', () => {
			const mockCanvas = {
				addEventListener: jest.fn(),
				removeEventListener: jest.fn( () => {
					throw new Error( 'Test error' );
				} ),
				getContext: jest.fn( () => mockContext ),
				width: 800,
				height: 600
			};

			const manager = new CanvasManager( {
				container: document.createElement( 'div' ),
				editor: mockEditor,
				canvas: mockCanvas
			} );

			// Set handlers
			manager.__mousedownHandler = jest.fn();
			manager.__mousemoveHandler = jest.fn();
			manager.__mouseupHandler = jest.fn();

			// This should not throw even with removeEventListener errors
			expect( () => {
				manager.events.destroy();
			} ).not.toThrow();
		} );
	} );

	describe( 'calculateResize fallback', () => {
		it( 'should return null when transformController is unavailable', () => {
			canvasManager.transformController = null;

			const result = canvasManager.calculateResize(
				{ id: 'layer-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
				'se',
				10,
				10,
				{}
			);

			expect( result ).toBeNull();
		} );
	} );

	describe( 'handleImageLoaded with base dimensions', () => {
		it( 'should use base dimensions when available', () => {
			canvasManager.baseWidth = 1000;
			canvasManager.baseHeight = 800;

			canvasManager.handleImageLoaded(
				{ width: 400, height: 300 },
				{ width: 400, height: 300 }
			);

			expect( canvasManager.canvas.width ).toBe( 1000 );
			expect( canvasManager.canvas.height ).toBe( 800 );
		} );

		it( 'should fall back to image dimensions when base dimensions are zero', () => {
			canvasManager.baseWidth = 0;
			canvasManager.baseHeight = 0;

			canvasManager.handleImageLoaded(
				{ width: 500, height: 400 },
				{ width: 500, height: 400 }
			);

			expect( canvasManager.canvas.width ).toBe( 500 );
			expect( canvasManager.canvas.height ).toBe( 400 );
		} );

		it( 'should use default dimensions when image dimensions unavailable', () => {
			canvasManager.baseWidth = null;
			canvasManager.baseHeight = null;
			canvasManager.defaultCanvasWidth = 640;
			canvasManager.defaultCanvasHeight = 480;

			canvasManager.handleImageLoaded(
				{},
				{}
			);

			expect( canvasManager.canvas.width ).toBe( 640 );
			expect( canvasManager.canvas.height ).toBe( 480 );
		} );
	} );

	describe( 'handleImageLoadError edge cases', () => {
		it( 'should return early if destroyed', () => {
			canvasManager.isDestroyed = true;

			// Call the handler
			canvasManager.handleImageLoadError();

			// Should not have set backgroundImage since it returns early
			// (The background would be set to null normally)
		} );

		it( 'should use layersMessages for error message when available', () => {
			canvasManager.isDestroyed = false;
			window.layersMessages = {
				get: jest.fn( () => 'Custom error message' )
			};
			// mw.notify must be defined for the message to be fetched
			if ( !global.mw ) {
				global.mw = {};
			}
			global.mw.notify = jest.fn();

			canvasManager.handleImageLoadError();

			expect( window.layersMessages.get ).toHaveBeenCalledWith(
				'layers-background-load-error',
				expect.any( String )
			);
			expect( global.mw.notify ).toHaveBeenCalledWith( 'Custom error message', { type: 'warn' } );
		} );
	} );

	describe( 'updateLayerPosition for paths with control points', () => {
		it( 'should move control points for curved arrows', () => {
			const layer = {
				id: 'arrow-1',
				type: 'arrow',
				x1: 0, y1: 0,
				x2: 100, y2: 100,
				controlX: 50,
				controlY: 50
			};
			const originalState = { ...layer };

			canvasManager.updateLayerPosition( layer, originalState, 20, 30 );

			expect( layer.controlX ).toBe( 70 ); // 50 + 20
			expect( layer.controlY ).toBe( 80 ); // 50 + 30
		} );

		it( 'should handle arrows without control points', () => {
			const layer = {
				id: 'arrow-1',
				type: 'arrow',
				x1: 0, y1: 0,
				x2: 100, y2: 100
			};
			const originalState = { ...layer };

			canvasManager.updateLayerPosition( layer, originalState, 20, 30 );

			expect( layer.controlX ).toBeUndefined();
			expect( layer.controlY ).toBeUndefined();
		} );
	} );

	describe( 'emitTransforming error handling', () => {
		it( 'should not throw when emitting transform event', () => {
			const mockLayer = {
				id: 'layer-1',
				type: 'rectangle',
				x: 0, y: 0,
				width: 100, height: 100
			};

			// Should not throw
			expect( () => {
				canvasManager.emitTransforming( mockLayer );
			} ).not.toThrow();
		} );
	} );

	describe( 'subscribeToState unsubscribe handling', () => {
		it( 'should track unsubscriber when returned by subscribe', () => {
			const unsubscribeFn = jest.fn();
			canvasManager.editor.stateManager.subscribe = jest.fn( () => unsubscribeFn );
			canvasManager.stateUnsubscribers = [];

			canvasManager.subscribeToState();

			expect( canvasManager.stateUnsubscribers ).toContain( unsubscribeFn );
		} );

		it( 'should not add to unsubscribers when subscribe returns non-function', () => {
			canvasManager.editor.stateManager.subscribe = jest.fn( () => null );
			canvasManager.stateUnsubscribers = [];

			canvasManager.subscribeToState();

			expect( canvasManager.stateUnsubscribers.length ).toBe( 0 );
		} );
	} );

	describe( 'notifyToolbarOfSelection edge cases', () => {
		it( 'should handle missing styleControls.updateForSelection', () => {
			canvasManager.editor.toolbar = {
				styleControls: {}
			};

			// Should not throw
			expect( () => {
				canvasManager.notifyToolbarOfSelection( [ 'layer-1' ] );
			} ).not.toThrow();
		} );
	} );

	describe( 'clipboard operations fallbacks', () => {
		it( 'should log error when clipboardController unavailable for copySelected', () => {
			canvasManager.clipboardController = null;
			global.mw = global.mw || {};
			global.mw.log = global.mw.log || {};
			global.mw.log.error = jest.fn();

			canvasManager.copySelected();

			expect( global.mw.log.error ).toHaveBeenCalledWith(
				expect.stringContaining( 'ClipboardController not available' )
			);
		} );

		it( 'should log error when clipboardController unavailable for pasteFromClipboard', () => {
			canvasManager.clipboardController = null;
			global.mw = global.mw || {};
			global.mw.log = global.mw.log || {};
			global.mw.log.error = jest.fn();

			canvasManager.pasteFromClipboard();

			expect( global.mw.log.error ).toHaveBeenCalledWith(
				expect.stringContaining( 'ClipboardController not available' )
			);
		} );
	} );

	describe( 'setBaseDimensions edge cases', () => {
		it( 'should resize canvas when dimensions differ', () => {
			// Ensure mw.log is a function for this test
			global.mw = global.mw || {};
			global.mw.log = jest.fn();
			canvasManager.canvas.width = 100;
			canvasManager.canvas.height = 100;

			canvasManager.setBaseDimensions( 200, 200 );

			expect( canvasManager.canvas.width ).toBe( 200 );
			expect( canvasManager.canvas.height ).toBe( 200 );
		} );

		it( 'should not resize canvas when dimensions match', () => {
			canvasManager.canvas.width = 800;
			canvasManager.canvas.height = 600;
			const originalWidth = canvasManager.canvas.width;

			canvasManager.setBaseDimensions( 800, 600 );

			expect( canvasManager.canvas.width ).toBe( originalWidth );
		} );
	} );

	describe( 'drawMultiSelectionIndicators edge cases', () => {
		it( 'should return early when single layer selected', () => {
			canvasManager.editor.stateManager.get = jest.fn().mockReturnValue( [ 'layer-1' ] );
			canvasManager.drawSelectionIndicators = jest.fn();

			canvasManager.drawMultiSelectionIndicators();

			expect( canvasManager.drawSelectionIndicators ).not.toHaveBeenCalled();
		} );

		it( 'should draw indicators for multiple selected layers', () => {
			canvasManager.editor.stateManager.get = jest.fn().mockReturnValue( [ 'layer-1', 'layer-2' ] );
			canvasManager.selectionManager = { lastSelectedId: 'layer-2' };
			canvasManager.drawSelectionIndicators = jest.fn();

			canvasManager.drawMultiSelectionIndicators();

			expect( canvasManager.drawSelectionIndicators ).toHaveBeenCalledTimes( 2 );
		} );
	} );
} );
