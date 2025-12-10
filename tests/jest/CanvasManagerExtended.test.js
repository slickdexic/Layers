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

		global.GridRulersController = jest.fn( () => ( {
			drawGrid: jest.fn(),
			toggleGrid: jest.fn(),
			drawRulers: jest.fn(),
			drawGuides: jest.fn(),
			drawGuidePreview: jest.fn(),
			toggleRulers: jest.fn(),
			toggleGuidesVisibility: jest.fn(),
			toggleSnapToGrid: jest.fn(),
			toggleSnapToGuides: jest.fn(),
			toggleSmartGuides: jest.fn(),
			getGuideSnapDelta: jest.fn( () => ( { dx: 0, dy: 0 } ) )
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

	describe( 'loadBackgroundImageFallback', () => {
		it( 'should build URL list from background URL and page images', () => {
			// Mock document.querySelectorAll to return some images
			const mockImg1 = { src: 'http://example.com/image1.png' };
			const mockImg2 = { src: 'http://example.com/image2.png' };
			const originalQuerySelectorAll = document.querySelectorAll;
			document.querySelectorAll = jest.fn( () => [ mockImg1, mockImg2 ] );

			canvasManager.config.backgroundImageUrl = 'http://example.com/bg.png';
			canvasManager.tryLoadImageFallback = jest.fn();

			canvasManager.loadBackgroundImageFallback();

			expect( canvasManager.tryLoadImageFallback ).toHaveBeenCalled();
			const urls = canvasManager.tryLoadImageFallback.mock.calls[ 0 ][ 0 ];
			expect( urls ).toContain( 'http://example.com/bg.png' );
			expect( urls ).toContain( 'http://example.com/image1.png' );
			expect( urls ).toContain( 'http://example.com/image2.png' );

			document.querySelectorAll = originalQuerySelectorAll;
		} );

		it( 'should deduplicate URLs', () => {
			const mockImg = { src: 'http://example.com/bg.png' };
			const originalQuerySelectorAll = document.querySelectorAll;
			document.querySelectorAll = jest.fn( () => [ mockImg ] );

			canvasManager.config.backgroundImageUrl = 'http://example.com/bg.png';
			canvasManager.tryLoadImageFallback = jest.fn();

			canvasManager.loadBackgroundImageFallback();

			const urls = canvasManager.tryLoadImageFallback.mock.calls[ 0 ][ 0 ];
			const bgCount = urls.filter( ( u ) => u === 'http://example.com/bg.png' ).length;
			expect( bgCount ).toBe( 1 );

			document.querySelectorAll = originalQuerySelectorAll;
		} );

		it( 'should add MediaWiki redirect URL when mw config available', () => {
			const originalQuerySelectorAll = document.querySelectorAll;
			document.querySelectorAll = jest.fn( () => [] );

			// Mock mw.config
			window.mw = {
				config: {
					get: jest.fn( ( key ) => {
						if ( key === 'wgServer' ) {
							return 'https://wiki.example.com';
						}
						if ( key === 'wgScriptPath' ) {
							return '/w';
						}
						return null;
					} )
				}
			};

			canvasManager.tryLoadImageFallback = jest.fn();
			canvasManager.loadBackgroundImageFallback();

			const urls = canvasManager.tryLoadImageFallback.mock.calls[ 0 ][ 0 ];
			expect( urls.some( ( u ) => u.includes( 'Special:Redirect/file/' ) ) ).toBe( true );

			document.querySelectorAll = originalQuerySelectorAll;
			delete window.mw;
		} );

		it( 'should not call tryLoadImageFallback when no URLs found', () => {
			const originalQuerySelectorAll = document.querySelectorAll;
			document.querySelectorAll = jest.fn( () => [] );

			canvasManager.config.backgroundImageUrl = null;
			delete window.mw;
			canvasManager.tryLoadImageFallback = jest.fn();

			canvasManager.loadBackgroundImageFallback();

			expect( canvasManager.tryLoadImageFallback ).not.toHaveBeenCalled();

			document.querySelectorAll = originalQuerySelectorAll;
		} );
	} );

	describe( 'tryLoadImageFallback', () => {
		it( 'should call handleImageLoadError when all URLs exhausted', () => {
			canvasManager.handleImageLoadError = jest.fn();
			canvasManager.tryLoadImageFallback( [], 0 );
			expect( canvasManager.handleImageLoadError ).toHaveBeenCalled();
		} );

		it( 'should call handleImageLoadError when index exceeds urls length', () => {
			canvasManager.handleImageLoadError = jest.fn();
			canvasManager.tryLoadImageFallback( [ 'url1' ], 5 );
			expect( canvasManager.handleImageLoadError ).toHaveBeenCalled();
		} );

		it( 'should create Image and set src', () => {
			const urls = [ 'http://example.com/test.png' ];
			const originalImage = window.Image;

			let createdImage = null;
			window.Image = function () {
				createdImage = { onload: null, onerror: null, src: null, crossOrigin: null };
				return createdImage;
			};

			canvasManager.tryLoadImageFallback( urls, 0 );

			expect( createdImage ).not.toBeNull();
			expect( createdImage.crossOrigin ).toBe( 'anonymous' );
			expect( createdImage.src ).toBe( 'http://example.com/test.png' );

			window.Image = originalImage;
		} );

		it( 'should call handleImageLoaded on image load success', () => {
			const urls = [ 'http://example.com/test.png' ];
			const originalImage = window.Image;

			let createdImage = null;
			window.Image = function () {
				createdImage = {
					onload: null,
					onerror: null,
					src: null,
					crossOrigin: null,
					width: 640,
					height: 480
				};
				return createdImage;
			};

			canvasManager.handleImageLoaded = jest.fn();
			canvasManager.tryLoadImageFallback( urls, 0 );

			// Simulate load
			createdImage.onload();

			expect( canvasManager.handleImageLoaded ).toHaveBeenCalledWith(
				createdImage,
				expect.objectContaining( {
					width: 640,
					height: 480,
					source: 'fallback'
				} )
			);

			window.Image = originalImage;
		} );

		it( 'should try next URL on image load error', () => {
			const urls = [ 'http://example.com/bad.png', 'http://example.com/good.png' ];
			const originalImage = window.Image;

			let imageCount = 0;
			let lastImage = null;
			window.Image = function () {
				imageCount++;
				lastImage = { onload: null, onerror: null, src: null, crossOrigin: null };
				return lastImage;
			};

			canvasManager.tryLoadImageFallback( urls, 0 );

			// First image fails
			lastImage.onerror();

			expect( imageCount ).toBe( 2 );
			expect( lastImage.src ).toBe( 'http://example.com/good.png' );

			window.Image = originalImage;
		} );
	} );

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

	describe( 'deepCloneLayers', () => {
		it( 'should deep clone simple layers', () => {
			const layers = [
				{ id: '1', type: 'rectangle', x: 10, y: 20 },
				{ id: '2', type: 'circle', x: 30, y: 40 }
			];
			const cloned = canvasManager.deepCloneLayers( layers );

			expect( cloned ).not.toBe( layers );
			expect( cloned ).toEqual( layers );
			expect( cloned[ 0 ] ).not.toBe( layers[ 0 ] );
		} );

		it( 'should deep clone layers with nested objects', () => {
			const layers = [
				{ id: '1', type: 'path', points: [ { x: 0, y: 0 }, { x: 10, y: 10 } ] }
			];
			const cloned = canvasManager.deepCloneLayers( layers );

			expect( cloned[ 0 ].points ).not.toBe( layers[ 0 ].points );
			expect( cloned[ 0 ].points ).toEqual( layers[ 0 ].points );
		} );

		it( 'should handle fallback cloning when JSON fails', () => {
			// Create an object that JSON.stringify will fail on (circular reference)
			const layers = [
				{ id: '1', type: 'rectangle', x: 10, y: 20 }
			];

			// Add circular reference
			layers[ 0 ].self = layers[ 0 ];

			// Mock JSON.stringify to throw
			const originalStringify = JSON.stringify;
			JSON.stringify = jest.fn( () => {
				throw new Error( 'Circular reference' );
			} );

			const cloned = canvasManager.deepCloneLayers( layers );

			expect( cloned ).toBeDefined();
			expect( cloned.length ).toBe( 1 );
			expect( cloned[ 0 ].id ).toBe( '1' );
			expect( cloned[ 0 ].type ).toBe( 'rectangle' );

			JSON.stringify = originalStringify;
		} );

		it( 'should clone nested objects in fallback mode', () => {
			const layers = [
				{ id: '1', style: { color: 'red', stroke: 'blue' } }
			];

			const originalStringify = JSON.stringify;
			JSON.stringify = jest.fn( () => {
				throw new Error( 'Fail' );
			} );

			const cloned = canvasManager.deepCloneLayers( layers );

			expect( cloned[ 0 ].style ).toBeDefined();
			expect( cloned[ 0 ].style.color ).toBe( 'red' );

			JSON.stringify = originalStringify;
		} );

		it( 'should clone arrays in fallback mode', () => {
			const layers = [
				{ id: '1', points: [ 1, 2, 3 ] }
			];

			const originalStringify = JSON.stringify;
			JSON.stringify = jest.fn( () => {
				throw new Error( 'Fail' );
			} );

			const cloned = canvasManager.deepCloneLayers( layers );

			expect( Array.isArray( cloned[ 0 ].points ) ).toBe( true );
			expect( cloned[ 0 ].points ).toEqual( [ 1, 2, 3 ] );
			expect( cloned[ 0 ].points ).not.toBe( layers[ 0 ].points );

			JSON.stringify = originalStringify;
		} );
	} );

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

	describe( 'updateUndoRedoButtons', () => {
		it( 'should delegate to editor historyManager', () => {
			canvasManager.updateUndoRedoButtons();
			expect( mockEditor.historyManager.updateUndoRedoButtons ).toHaveBeenCalled();
		} );

		it( 'should use direct historyManager as fallback', () => {
			canvasManager.editor = null;
			canvasManager.historyManager = {
				updateUndoRedoButtons: jest.fn()
			};

			canvasManager.updateUndoRedoButtons();

			expect( canvasManager.historyManager.updateUndoRedoButtons ).toHaveBeenCalled();
		} );

		it( 'should handle missing historyManager gracefully', () => {
			canvasManager.editor = {};
			canvasManager.historyManager = null;

			expect( () => canvasManager.updateUndoRedoButtons() ).not.toThrow();
		} );
	} );

	describe( 'undo and redo delegation', () => {
		it( 'should delegate undo to editor', () => {
			const result = canvasManager.undo();
			expect( mockEditor.undo ).toHaveBeenCalled();
			expect( result ).toBe( true );
		} );

		it( 'should return false when editor unavailable', () => {
			canvasManager.editor = null;
			const result = canvasManager.undo();
			expect( result ).toBe( false );
		} );

		it( 'should delegate redo to editor', () => {
			const result = canvasManager.redo();
			expect( mockEditor.redo ).toHaveBeenCalled();
			expect( result ).toBe( true );
		} );

		it( 'should return false for redo when editor unavailable', () => {
			canvasManager.editor = null;
			const result = canvasManager.redo();
			expect( result ).toBe( false );
		} );
	} );

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

	describe( 'controller delegation methods', () => {
		it( 'should delegate drawRulers to gridRulersController', () => {
			canvasManager.gridRulersController = {
				drawRulers: jest.fn()
			};
			canvasManager.drawRulers();
			expect( canvasManager.gridRulersController.drawRulers ).toHaveBeenCalled();
		} );

		it( 'should delegate drawGuides to gridRulersController', () => {
			canvasManager.gridRulersController = {
				drawGuides: jest.fn()
			};
			canvasManager.drawGuides();
			expect( canvasManager.gridRulersController.drawGuides ).toHaveBeenCalled();
		} );

		it( 'should delegate drawGuidePreview to gridRulersController', () => {
			canvasManager.gridRulersController = {
				drawGuidePreview: jest.fn()
			};
			canvasManager.drawGuidePreview();
			expect( canvasManager.gridRulersController.drawGuidePreview ).toHaveBeenCalled();
		} );

		it( 'should delegate getGuideSnapDelta to gridRulersController', () => {
			canvasManager.gridRulersController = {
				getGuideSnapDelta: jest.fn( () => ( { dx: 5, dy: 10 } ) )
			};
			const result = canvasManager.getGuideSnapDelta( {}, 0, 0, 10 );
			expect( result ).toEqual( { dx: 5, dy: 10 } );
		} );

		it( 'should return default when gridRulersController unavailable', () => {
			canvasManager.gridRulersController = null;
			const result = canvasManager.getGuideSnapDelta( {}, 0, 0, 10 );
			expect( result ).toEqual( { dx: 0, dy: 0 } );
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
		it( 'should log error when CanvasEvents not found', () => {
			// Remove CanvasEvents from global
			const originalCanvasEvents = window.CanvasEvents;
			delete window.CanvasEvents;

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
				'Layers: CanvasEvents module not found'
			);

			newManager.destroy();
			window.CanvasEvents = originalCanvasEvents;
			delete window.mw;
		} );
	} );
} );
