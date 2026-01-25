/**
 * Canvas Manager for Layers Editor
 * Handles HTML5 canvas operations and rendering
 */
( function () {
	'use strict';

	// Use shared namespace helper (loaded via utils/NamespaceHelper.js)
	const getClass = ( typeof window !== 'undefined' && window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		( typeof window !== 'undefined' && window.layersGetClass ) ||
		function ( namespacePath, globalName ) {
			// Minimal fallback for test environments
			if ( typeof window !== 'undefined' && window[ globalName ] ) {
				return window[ globalName ];
			}
			if ( typeof global !== 'undefined' && global[ globalName ] ) {
				return global[ globalName ];
			}
			return null;
		};

	// Mapping from class names to namespace paths for findClass()
	// Paths are relative to window.Layers (e.g., 'Canvas.Renderer' → window.Layers.Canvas.Renderer)
	const CLASS_NAMESPACE_MAP = {
		CanvasRenderer: 'Canvas.Renderer',
		CanvasEvents: 'Canvas.Events',
		LayersSelectionManager: 'Core.SelectionManager',
		StyleController: 'Core.StyleController',
		ZoomPanController: 'Canvas.ZoomPanController',
		TransformController: 'Canvas.TransformController',
		HitTestController: 'Canvas.HitTestController',
		DrawingController: 'Canvas.DrawingController',
		ClipboardController: 'Canvas.ClipboardController',
		TextInputController: 'Canvas.TextInputController',
		InlineTextEditor: 'Canvas.InlineTextEditor',
		AlignmentController: 'Canvas.AlignmentController',
		SmartGuidesController: 'Canvas.SmartGuidesController',
		RenderCoordinator: 'Canvas.RenderCoordinator',
		InteractionController: 'Canvas.InteractionController',
		ValidationManager: 'Validation.Manager',
		LayerRenderer: 'LayerRenderer',
		LayerPanel: 'UI.LayerPanel'
	};

	/**
	 * Helper to find a class in different environments.
	 * Checks namespace paths first (via CLASS_NAMESPACE_MAP), then falls back
	 * to direct window/global lookup for backwards compatibility.
	 *
	 * @param {string} name - Class name to find
	 * @return {Function|undefined} The class or undefined
	 */
	function findClass( name ) {
		// First, try namespace-aware lookup using the mapping
		const namespacePath = CLASS_NAMESPACE_MAP[ name ];
		if ( namespacePath && typeof window !== 'undefined' && window.Layers ) {
			// Traverse the namespace path dynamically (not cached at module load)
			const parts = namespacePath.split( '.' );
			let obj = window.Layers;
			for ( const part of parts ) {
				obj = obj && obj[ part ];
			}
			if ( obj ) {
				return obj;
			}
		}

		// Fallback: direct window lookup (deprecated pattern)
		if ( typeof window !== 'undefined' && window[ name ] ) {
			return window[ name ];
		}
		if ( typeof mw !== 'undefined' && mw[ name ] ) {
			return mw[ name ];
		}
		// Check global scope for Node.js/test environments
		try {
			const globalRef = ( typeof globalThis !== 'undefined' ) ? globalThis :
				( typeof global !== 'undefined' ) ? global : {};
			if ( globalRef[ name ] ) {
				return globalRef[ name ];
			}
		} catch ( e ) {
			// Global scope access failed - expected in some restricted environments
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[CanvasManager] findClass failed for "' + name + '":', e.message );
			}
		}
		return undefined;
	}

	/**
	 * CanvasManager class
	 */
class CanvasManager {
	/**
	 * Creates a new CanvasManager instance
	 *
	 * @param {Object} config Configuration options
	 */
	constructor( config ) {
		// Back-compat: allow new CanvasManager(editorLike)
		if (
			config && !config.container &&
			( config.canvas || config.layers || config.getLayerById )
		) {
			config = {
				editor: config,
				container: ( config.container || null ),
				canvas: config.canvas
			};
		}
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.canvas = null;
		this.ctx = null;
		this.backgroundImage = null;
		this.currentTool = 'pointer';
		this.isDrawing = false;
		this.startPoint = null;
		this.isDestroyed = false; // Guard for async callbacks after destruction

		// Note: Performance optimizations like dirty region tracking and layer caching
		// can be added in RenderCoordinator.js when needed. See improvement_plan.md #0.2
		this.redrawScheduled = false; // Prevent multiple redraws in same frame

		// Selection and manipulation state
		// NOTE: selectedLayerId and selectedLayerIds are now managed via StateManager
		// Use getSelectedLayerId() and getSelectedLayerIds() to access them
		this.selectionHandles = [];
		this.isResizing = false;
		this.isRotating = false;
		this.isDragging = false;
		this.resizeHandle = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;
		this.isMarqueeSelecting = false;
		this.marqueeStart = { x: 0, y: 0 };
		this.marqueeEnd = { x: 0, y: 0 };
		this.lastTouchPoint = null;
		this.lastTouchTime = 0;

		// Throttle transform event emission for live UI sync
		this.transformEventScheduled = false;
		this.lastTransformPayload = null;

		// Drag visual feedback
		this.dragPreview = false;
		this.dragOffset = { x: 0, y: 0 };
		this.showDragGhost = true;

		// Initialize default style using constants
		const defaults = ( typeof LayersConstants !== 'undefined' ) ? LayersConstants.DEFAULTS : null;
		const uiConsts = ( typeof LayersConstants !== 'undefined' ) ? LayersConstants.UI : null;
		const limits = ( typeof LayersConstants !== 'undefined' ) ? LayersConstants.LIMITS : null;

		// Default canvas dimensions (used as fallback when image dimensions unavailable)
		this.defaultCanvasWidth = ( limits && limits.DEFAULT_CANVAS_WIDTH ) ?
			limits.DEFAULT_CANVAS_WIDTH : 800;
		this.defaultCanvasHeight = ( limits && limits.DEFAULT_CANVAS_HEIGHT ) ?
			limits.DEFAULT_CANVAS_HEIGHT : 600;

		this.currentStyle = {
			color: ( defaults && defaults.COLORS ) ? defaults.COLORS.STROKE : '#000000',
			strokeWidth: ( defaults && defaults.LAYER ) ? defaults.LAYER.STROKE_WIDTH : 2,
			fontSize: ( defaults && defaults.LAYER ) ? defaults.LAYER.FONT_SIZE : 16,
			fontFamily: ( defaults && defaults.LAYER ) ? defaults.LAYER.FONT_FAMILY : 'Arial, sans-serif',
			fill: ( defaults && defaults.COLORS ) ? defaults.COLORS.FILL : 'transparent'
		};

		// Tool-specific style defaults (persist between drawings)
		// These are updated when layer properties are modified
		this.dimensionDefaults = {
			endStyle: 'arrow',
			textPosition: 'above',
			extensionLength: 10,
			extensionGap: 3,
			arrowSize: 8,
			tickSize: 6,
			showBackground: true,
			backgroundColor: '#ffffff',
			showUnit: true,
			unit: 'px',
			scale: 1,
			precision: 0,
			toleranceType: 'none',
			toleranceValue: 0,
			toleranceUpper: 0,
			toleranceLower: 0,
			// Colors are stored here for persistence (stroke=line, color=text)
			stroke: null,
			color: null,
			fontSize: null,
			strokeWidth: null
		};

		this.markerDefaults = {
			style: 'circled',
			size: 24,
			fontSizeAdjust: 0,
			fill: '#ffffff',
			stroke: '#000000',
			strokeWidth: 2,
			color: '#000000',
			hasArrow: false,
			arrowStyle: 'arrow',
			autoNumber: false  // When true, marker tool stays active and auto-increments
		};

		// Zoom and pan functionality
		this.zoom = 1.0;
		this.minZoom = uiConsts ? uiConsts.MIN_ZOOM : 0.1;
		this.maxZoom = uiConsts ? uiConsts.MAX_ZOOM : 5.0;
		this.panX = 0;
		this.panY = 0;
		this.isPanning = false;
		this.lastPanPoint = null;
		this.userHasSetZoom = false; // Track if user has manually adjusted zoom

		// Inline text editing state
		this.isTextEditing = false;

		// Smooth zoom animation properties
		this.isAnimatingZoom = false;
		this.zoomAnimationDuration = uiConsts ? uiConsts.ANIMATION_DURATION : 300;
		this.zoomAnimationStartTime = 0;
		this.zoomAnimationStartZoom = 1.0;
		this.zoomAnimationTargetZoom = 1.0;

		// Note: History/Undo is managed by HistoryManager (single source of truth)
		// These legacy properties are kept for backward compatibility but are no longer used
		// this.history, this.historyIndex are accessed via this.editor.historyManager

		// Clipboard for copy/paste
		this.clipboard = [];

		// Canvas pooling for temporary canvas operations to prevent memory leaks
		this.canvasPool = [];
		this.maxPoolSize = limits ? limits.MAX_CANVAS_POOL_SIZE : 5;

		// Track state subscriptions for cleanup
		this.stateUnsubscribers = [];

		this.init();
	}

	init () {
		// Support headless/test scenarios: if container is missing, either
		// use a provided canvas in config or create a detached canvas.
		if ( !this.container ) {
			if ( this.config.canvas && this.config.canvas.getContext ) {
				this.canvas = this.config.canvas;
			} else {
				this.canvas = document.createElement( 'canvas' );
				this.canvas.className = 'layers-canvas';
			}
		} else {
			// Find or create canvas
			this.canvas = this.container.querySelector( 'canvas' );
			if ( !this.canvas ) {
				this.canvas = document.createElement( 'canvas' );
				this.canvas.className = 'layers-canvas';
				this.container.appendChild( this.canvas );
			}
		}

		this.ctx = this.canvas.getContext( '2d' );
		if ( !this.ctx ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.error( 'Layers: Could not get 2D canvas context. The editor may not function correctly.' );
			}
			// Continue anyway - some features may still work, but rendering will fail
		}

		// Helper to initialize a controller
		const initController = ( name, propName, createFn, logLevel ) => {
			const ControllerClass = findClass( name );
			if ( ControllerClass ) {
				this[ propName ] = createFn( ControllerClass );
			} else if ( typeof mw !== 'undefined' && mw.log && mw.log[ logLevel ] ) {
				mw.log[ logLevel ]( 'Layers: ' + name + ' not found' );
			}
		};

		// Initialize renderer (required)
		initController( 'CanvasRenderer', 'renderer', ( C ) => {
			return new C( this.canvas, { editor: this.editor } );
		}, 'error' );

		// Initialize selection manager
		initController( 'LayersSelectionManager', 'selectionManager', ( C ) => {
			return new C( {}, this );
		}, 'warn' );

		// Initialize controllers (all take 'this' as argument)
		// StyleController should be loaded before other controllers that rely on style
		initController( 'StyleController', 'styleController', ( C ) => {
			return new C( this.editor );
		}, 'warn' );
		
		const controllers = [
			[ 'ZoomPanController', 'zoomPanController' ],
			[ 'TransformController', 'transformController' ],
			[ 'HitTestController', 'hitTestController' ],
			[ 'DrawingController', 'drawingController' ],
			[ 'ClipboardController', 'clipboardController' ],
			[ 'TextInputController', 'textInputController' ],
			[ 'InlineTextEditor', 'inlineTextEditor' ],
			[ 'AlignmentController', 'alignmentController' ],
			[ 'SmartGuidesController', 'smartGuidesController' ]
		];

		controllers.forEach( ( entry ) => {
			initController( entry[ 0 ], entry[ 1 ], ( C ) => {
				return new C( this );
			}, 'warn' );
		} );

		// Initialize RenderCoordinator for optimized rendering
		initController( 'RenderCoordinator', 'renderCoordinator', ( C ) => {
			return new C( this, {
				enableMetrics: this.config.enableRenderMetrics || false,
				targetFps: this.config.targetFps || 60
			} );
		}, 'warn' );

		// Set up event handlers
		this.setupEventHandlers();

		// Load background image if editor/filename is present; otherwise
		// skip image detection during tests.
		if ( this.editor && this.editor.filename ) {
			this.loadBackgroundImage();
		}

		// Subscribe to StateManager for selection changes
		this.subscribeToState();
	}

	/**
	 * Initialize the event handling layer for CanvasManager.
	 * This will construct CanvasEvents controller if available, otherwise
	 * install basic fallback handlers for test environments.
	 */
	setupEventHandlers () {
		const EventsClass = findClass( 'CanvasEvents' );
		if ( EventsClass ) {
			try {
				this.events = new EventsClass( this );
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
					mw.log.error( '[CanvasManager] Failed to init CanvasEvents:', e && e.message );
				}
				this.events = null;
			}
			return;
		}

		// Fallback for minimal test environments: attach stripped-down event handlers
		this.events = {
			destroy: () => {
				if ( this.canvas ) {
					if ( this.__mousedownHandler ) {
						try {
							this.canvas.removeEventListener( 'mousedown', this.__mousedownHandler );
						} catch ( err ) {
							mw.log.warn( '[CanvasManager] Failed to remove mousedown listener:', err );
						}
					}
					if ( this.__mousemoveHandler ) {
						try {
							this.canvas.removeEventListener( 'mousemove', this.__mousemoveHandler );
						} catch ( err ) {
							mw.log.warn( '[CanvasManager] Failed to remove mousemove listener:', err );
						}
					}
					if ( this.__mouseupHandler ) {
						try {
							this.canvas.removeEventListener( 'mouseup', this.__mouseupHandler );
						} catch ( err ) {
							mw.log.warn( '[CanvasManager] Failed to remove mouseup listener:', err );
						}
					}
				}
				this.__mousedownHandler = null;
				this.__mousemoveHandler = null;
				this.__mouseupHandler = null;
			}
		};
		if ( this.canvas && this.canvas.addEventListener ) {
			this.__mousedownHandler = ( e ) => {
				if ( typeof this.handleMouseDown === 'function' ) {
					this.handleMouseDown( e );
				}
			};
			this.__mousemoveHandler = ( e ) => {
				if ( typeof this.handleMouseMove === 'function' ) {
					this.handleMouseMove( e );
				}
			};
			this.__mouseupHandler = ( e ) => {
				if ( typeof this.handleMouseUp === 'function' ) {
					this.handleMouseUp( e );
				}
			};
			this.canvas.addEventListener( 'mousedown', this.__mousedownHandler );
			this.canvas.addEventListener( 'mousemove', this.__mousemoveHandler );
			this.canvas.addEventListener( 'mouseup', this.__mouseupHandler );
		}
	}

	/**
	 * Get the selected layer IDs from StateManager (single source of truth)
	 * @return {Array} Array of selected layer IDs
	 */
	getSelectedLayerIds () {
		if ( this.editor && this.editor.stateManager ) {
			return this.editor.stateManager.get( 'selectedLayerIds' ) || [];
		}
		return [];
	}

	/**
	 * Get the primary selected layer ID (last in selection array)
	 * @return {string|null} The selected layer ID or null
	 */
	getSelectedLayerId () {
		const ids = this.getSelectedLayerIds();
		return ids.length > 0 ? ids[ ids.length - 1 ] : null;
	}

	/**
	 * Set the selected layer IDs via StateManager
	 * @param {Array} ids Array of layer IDs to select
	 */
	setSelectedLayerIds ( ids ) {
		if ( this.editor && this.editor.stateManager ) {
			this.editor.stateManager.set( 'selectedLayerIds', ids || [] );
		}
	}

	/**
	 * Subscribe to StateManager for reactive updates
	 */
	subscribeToState () {
		if ( !this.editor || !this.editor.stateManager ) {
			return;
		}

		// Subscribe to selection changes to trigger re-render and toolbar update
		const unsubscribe = this.editor.stateManager.subscribe( 'selectedLayerIds', ( selectedIds ) => {
			this.selectionHandles = [];
			this.renderLayers( this.editor.layers );

			// Notify toolbar of selection change for presets
			this.notifyToolbarOfSelection( selectedIds );
		} );

		// Track unsubscriber for cleanup in destroy()
		if ( unsubscribe && typeof unsubscribe === 'function' ) {
			this.stateUnsubscribers.push( unsubscribe );
		}
	}

	/**
	 * Notify toolbar style controls of selection change for preset dropdown
	 *
	 * @param {Array} selectedIds Selected layer IDs
	 */
	notifyToolbarOfSelection( selectedIds ) {
		if ( !this.editor || !this.editor.toolbar || !this.editor.toolbar.styleControls ) {
			return;
		}

		// Get the actual layer objects for selected IDs
		const layers = this.editor.layers || [];
		const selectedLayers = ( selectedIds || [] )
			.map( ( id ) => layers.find( ( l ) => l.id === id ) )
			.filter( ( l ) => l != null );

		// Notify style controls of selection change
		if ( typeof this.editor.toolbar.styleControls.updateForSelection === 'function' ) {
			this.editor.toolbar.styleControls.updateForSelection( selectedLayers );
		}
	}

	/**
	 * Load background image using ImageLoader module
	 * Delegates to ImageLoader for URL detection and loading with fallbacks
	 * @note ImageLoader is guaranteed to load first via extension.json in production,
	 *       but fallback is kept for test environments and backward compatibility.
	 */
	loadBackgroundImage () {
		const filename = this.editor.filename;
		const backgroundImageUrl = this.config.backgroundImageUrl;

		// Get ImageLoader class - prefer namespace, fallback to global
		const ImageLoaderClass = getClass( 'Utils.ImageLoader', 'ImageLoader' );

		if ( ImageLoaderClass ) {
			// Use ImageLoader module (production path)
			this.imageLoader = new ImageLoaderClass( {
				filename: filename,
				backgroundImageUrl: backgroundImageUrl,
				onLoad: ( image, info ) => {
					this.handleImageLoaded( image, info );
				},
				onError: () => {
					this.handleImageLoadError();
				}
			} );
			this.imageLoader.load();
		} else {
			// ImageLoader should always be available via extension.json
			// If not, log error and proceed without background image
			if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
				mw.log.error( 'Layers: ImageLoader not found - check extension.json dependencies' );
			}
			this.handleImageLoadError();
		}
	}

	/**
	 * Handle successful image load from ImageLoader
	 * @param {HTMLImageElement} image - The loaded image
	 * @param {Object} info - Load info (width, height, source, etc.)
	 */
	handleImageLoaded ( image, info ) {
		// Guard against callbacks after destruction (async race condition)
		if ( this.isDestroyed ) {
			return;
		}

		this.backgroundImage = image;

		// Pass image to renderer
		if ( this.renderer ) {
			this.renderer.setBackgroundImage( this.backgroundImage );
		}

		// Set canvas size: prefer base dimensions (original file size) if available,
		// otherwise use loaded image dimensions.
		// This is critical for formats like TIFF where we load a thumbnail but
		// need to use the original file's coordinate space for layer positioning.
		if ( this.baseWidth && this.baseHeight && this.baseWidth > 0 && this.baseHeight > 0 ) {
			// Use base dimensions from API (original file size)
			this.canvas.width = this.baseWidth;
			this.canvas.height = this.baseHeight;
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log( '[CanvasManager] Using base dimensions for canvas: ' +
					this.baseWidth + 'x' + this.baseHeight +
					' (loaded image: ' + ( info.width || image.width ) + 'x' + ( info.height || image.height ) + ')' );
			}
		} else {
			// Fall back to loaded image dimensions
			const defaultWidth = this.defaultCanvasWidth || 800;
			const defaultHeight = this.defaultCanvasHeight || 600;
			this.canvas.width = info.width || image.width || defaultWidth;
			this.canvas.height = info.height || image.height || defaultHeight;
		}

		// Resize canvas display to fit container
		this.resizeCanvas();

		// Draw the image and any layers
		this.redraw();
		if ( this.editor && this.editor.layers ) {
			this.renderLayers( this.editor.layers );
		}
	}

	/**
	 * Handle image load error from ImageLoader
	 */
	handleImageLoadError () {
		// Guard against callbacks after destruction (async race condition)
		if ( this.isDestroyed ) {
			return;
		}

		// Create a simple background directly on canvas when all load attempts fail
		this.backgroundImage = null;
		if ( this.renderer ) {
			this.renderer.setBackgroundImage( null );
		}

		// Set default canvas size from constants
		this.canvas.width = this.defaultCanvasWidth || 800;
		this.canvas.height = this.defaultCanvasHeight || 600;

		// Resize canvas to fit container
		this.resizeCanvas();

		// Notify user that background image failed to load
		if ( typeof mw !== 'undefined' && mw.notify ) {
			const message = window.layersMessages
				? window.layersMessages.get( 'layers-background-load-error', 'Background image could not be loaded. You can still add annotations.' )
				: 'Background image could not be loaded. You can still add annotations.';
			mw.notify( message, { type: 'warn' } );
		}

		// Render any existing layers
		if ( this.editor && this.editor.layers ) {
			this.renderLayers( this.editor.layers );
		}
	}

	/**
	 * Update current style options and apply to selected layers.
	 * Delegates to StyleController.
	 *
	 * @param {Object} options - Style options to update
	 */
	updateStyleOptions ( options ) {
		if ( !this.styleController || typeof this.styleController.updateStyleOptions !== 'function' ) {
			// StyleController should always be available via extension.json
			if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
				mw.log.error( 'Layers: StyleController not available - check extension.json dependencies' );
			}
			return;
		}

		const next = this.styleController.updateStyleOptions( options );
		// Sync to this.currentStyle so new drawings use updated styles
		this.currentStyle = next;

		// Live-apply style updates to selected layers
		const ids = this.getSelectedLayerIds();
		if ( ids && ids.length && this.editor ) {
			for ( let i = 0; i < ids.length; i++ ) {
				const layer = this.editor.getLayerById( ids[ i ] );
				if ( layer && typeof this.styleController.applyToLayer === 'function' ) {
					this.styleController.applyToLayer( layer, next );
				}
			}
			this.renderLayers( this.editor.layers );
		}
	}

	/**
	 * Update dimension tool defaults from a layer's properties.
	 * Call this when dimension layer properties are modified to persist settings.
	 *
	 * @param {Object} props - Dimension properties to persist
	 */
	updateDimensionDefaults( props ) {
		if ( !props ) {
			return;
		}
		const dimensionProps = [
			'endStyle', 'textPosition', 'extensionLength', 'extensionGap',
			'arrowSize', 'tickSize', 'showBackground', 'backgroundColor',
			'showUnit', 'unit', 'scale', 'precision',
			// Tolerance settings
			'toleranceType', 'toleranceValue', 'toleranceUpper', 'toleranceLower',
			// Colors and sizing
			'stroke', 'color', 'fontSize', 'strokeWidth'
		];
		dimensionProps.forEach( ( prop ) => {
			if ( props[ prop ] !== undefined ) {
				this.dimensionDefaults[ prop ] = props[ prop ];
			}
		} );
	}

	/**
	 * Update marker tool defaults from a layer's properties.
	 * Call this when marker layer properties are modified to persist settings.
	 *
	 * @param {Object} props - Marker properties to persist
	 */
	updateMarkerDefaults( props ) {
		if ( !props ) {
			return;
		}
		const markerProps = [
			'style', 'size', 'fontSizeAdjust',
			'fill', 'stroke', 'strokeWidth', 'color',
			'hasArrow', 'arrowStyle', 'autoNumber'
		];
		markerProps.forEach( ( prop ) => {
			if ( props[ prop ] !== undefined ) {
				this.markerDefaults[ prop ] = props[ prop ];
			}
		} );
	}

	hitTestSelectionHandles ( point ) {
		if ( this.hitTestController ) {
			return this.hitTestController.hitTestSelectionHandles( point );
		}
		return null;
	}

	isPointInRect ( point, rect ) {
		if ( this.hitTestController ) {
			return this.hitTestController.isPointInRect( point, rect );
		}
		return point.x >= rect.x && point.x <= rect.x + rect.width &&
			point.y >= rect.y && point.y <= rect.y + rect.height;
	}

	startResize ( handle ) {
		if ( this.transformController ) {
			this.transformController.startResize( handle, this.startPoint );
			this.isResizing = this.transformController.isResizing;
			this.resizeHandle = this.transformController.resizeHandle;
		}
	}

	startRotation ( point ) {
		if ( this.transformController ) {
			this.transformController.startRotation( point );
			this.isRotating = this.transformController.isRotating;
		}
	}

	startDrag () {
		if ( this.transformController ) {
			this.transformController.startDrag( this.startPoint );
			this.isDragging = this.transformController.isDragging;
		}
	}

	getResizeCursor ( handleType, rotation ) {
		if ( this.transformController ) {
			return this.transformController.getResizeCursor( handleType, rotation );
		}
		return 'default';
	}



	handleResize ( point, event ) {
		if ( this.transformController && this.transformController.isResizing ) {
			this.transformController.handleResize( point, event );
		}
	}

	/**
	 * Calculate resize updates based on layer type
	 * Delegates to TransformController for actual calculations
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @param {Object} modifiers Modifier keys state
	 * @return {Object|null} Updates object with new dimensions
	 */
	calculateResize (
		originalLayer, handleType, deltaX, deltaY, modifiers
	) {
		if ( this.transformController ) {
			return this.transformController.calculateResize(
				originalLayer, handleType, deltaX, deltaY, modifiers
			);
		}
		// TransformController not available - should never happen in production
		if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: TransformController not available for calculateResize' );
		}
		return null;
	}
	handleRotation ( point, event ) {
		if ( this.transformController && this.transformController.isRotating ) {
			this.transformController.handleRotation( point, event );
		}
	}

	handleDrag ( point ) {
		if ( this.transformController && this.transformController.isDragging ) {
			this.transformController.handleDrag( point );
			this.showDragPreview = this.transformController.showDragPreview;
		}
	}

	/**
	 * Emit a throttled custom event with current transform values
	 * to allow the properties panel to live-sync during manipulation.
	 *
	 * @param {Object} layer The layer object to serialize and emit
	 */
	emitTransforming ( layer ) {
		if ( !layer ) {
			return;
		}
		this.lastTransformPayload = layer;
		if ( this.transformEventScheduled ) {
			return;
		}
		this.transformEventScheduled = true;
		window.requestAnimationFrame( () => {
			this.transformEventScheduled = false;
			const target = ( this.editor && this.editor.container ) || this.container || document;
			try {
				const detail = {
					id: this.lastTransformPayload.id,
					layer: JSON.parse( JSON.stringify( this.lastTransformPayload ) )
				};
				const evt = new CustomEvent( 'layers:transforming', { detail: detail } );
				target.dispatchEvent( evt );
			} catch ( e ) {
				const ErrorHandler = getClass( 'Utils.ErrorHandler', 'layersErrorHandler' );
				if ( ErrorHandler && ErrorHandler.handleError ) {
					ErrorHandler.handleError( e, 'CanvasManager.emitTransformEvent', 'canvas' );
				}
			}
		} );
	}

	/**
	 * Update layer position during drag operation
	 *
	 * @param {Object} layer Layer to update
	 * @param {Object} originalState Original state before drag
	 * @param {number} deltaX X offset
	 * @param {number} deltaY Y offset
	 */
	updateLayerPosition (
		layer, originalState, deltaX, deltaY
	) {
		switch ( layer.type ) {
			case 'rectangle':
			case 'blur':
			case 'circle':
			case 'text':
			case 'ellipse':
			case 'polygon':
			case 'star':
				layer.x = ( originalState.x || 0 ) + deltaX;
				layer.y = ( originalState.y || 0 ) + deltaY;
				break;
			case 'line':
			case 'arrow':
				layer.x1 = ( originalState.x1 || 0 ) + deltaX;
				layer.y1 = ( originalState.y1 || 0 ) + deltaY;
				layer.x2 = ( originalState.x2 || 0 ) + deltaX;
				layer.y2 = ( originalState.y2 || 0 ) + deltaY;
				// Move control point with the arrow (for curved arrows)
				if ( originalState.controlX !== undefined ) {
					layer.controlX = originalState.controlX + deltaX;
				}
				if ( originalState.controlY !== undefined ) {
					layer.controlY = originalState.controlY + deltaY;
				}
				break;
			case 'path':
				if ( layer.points && originalState.points ) {
					layer.points = originalState.points.map( function ( pt ) {
						return {
							x: pt.x + deltaX,
							y: pt.y + deltaY
						};
					} );
				}
				break;
		}
	}

	updateCursor ( point ) {
		if ( this.currentTool !== 'pointer' ) {
			this.canvas.style.cursor = this.getToolCursor( this.currentTool );
			return;
		}

		// Check for handle hover
		const currentSelectedId = this.getSelectedLayerId();
		if ( currentSelectedId ) {
			const handleHit = this.hitTestSelectionHandles( point );

			if ( handleHit ) {
				if ( handleHit.type === 'rotate' ) {
					this.canvas.style.cursor = 'grab';
					return;
				}
				const selectedLayer = this.editor.getLayerById( currentSelectedId );
				const rotation = selectedLayer ? selectedLayer.rotation : 0;
				this.canvas.style.cursor = this.getResizeCursor( handleHit.type, rotation );
				return;
			}
		}

		// Check for layer hover
		const layerUnderMouse = this.getLayerAtPoint( point );
		if ( layerUnderMouse ) {
			// If this is the selected layer, show move cursor
			if ( currentSelectedId && layerUnderMouse.id === currentSelectedId ) {
				this.canvas.style.cursor = 'move';
			} else {
				this.canvas.style.cursor = 'pointer';
			}
		} else {
			// Default cursor when in pointer mode with nothing hovered
			this.canvas.style.cursor = 'default';
		}
	}

	// HitTest delegation methods
	getLayerAtPoint ( point ) {
		return this.hitTestController ? this.hitTestController.getLayerAtPoint( point ) : null;
	}
	isPointInLayer ( point, layer ) {
		return this.hitTestController ? this.hitTestController.isPointInLayer( point, layer ) : false;
	}
	isPointNearLine ( point, x1, y1, x2, y2, tolerance ) {
		return this.hitTestController ? this.hitTestController.isPointNearLine( point, x1, y1, x2, y2, tolerance ) : false;
	}
	pointToSegmentDistance ( px, py, x1, y1, x2, y2 ) {
		return this.hitTestController ? this.hitTestController.pointToSegmentDistance( px, py, x1, y1, x2, y2 ) : Infinity;
	}
	isPointInPolygon ( point, polygonPoints ) {
		return this.hitTestController ? this.hitTestController.isPointInPolygon( point, polygonPoints ) : false;
	}

	finishResize () {
		if ( this.transformController && this.transformController.isResizing ) {
			this.transformController.finishResize();
			this.isResizing = false;
			this.resizeHandle = null;
		}
	}



	// Duplicate setZoom removed; see the later definition that clamps, updates CSS size, and status

	finishRotation () {
		if ( this.transformController && this.transformController.isRotating ) {
			this.transformController.finishRotation();
			this.isRotating = false;
		}
	}

	finishDrag () {
		if ( this.transformController && this.transformController.isDragging ) {
			this.transformController.finishDrag();
			this.isDragging = false;
			this.showDragPreview = false;
		}
	}





	zoomIn () {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomIn();
		}
	}

	zoomOut () {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomOut();
		}
	}

	setZoom ( newZoom ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.setZoom( newZoom );
		}
	}

	/**
	 * Update the canvas CSS transform from current pan/zoom state.
	 */
	updateCanvasTransform () {
		if ( this.zoomPanController ) {
			this.zoomPanController.updateCanvasTransform();
		}
	}

	resetZoom () {
		if ( this.zoomPanController ) {
			this.zoomPanController.resetZoom();
		}
	}

	/**
	 * Smoothly animate zoom to a target level
	 *
	 * @param {number} targetZoom Target zoom level
	 * @param {number} duration Animation duration in milliseconds (optional)
	 */
	smoothZoomTo ( targetZoom, duration ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.smoothZoomTo( targetZoom, duration );
		}
	}

	/**
	 * Animation frame function for smooth zooming
	 */
	animateZoom () {
		if ( this.zoomPanController ) {
			this.zoomPanController.animateZoom();
		}
	}

	/**
	 * Set zoom directly without triggering user zoom flag (for animations)
	 *
	 * @param {number} newZoom New zoom level
	 */
	setZoomDirect ( newZoom ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.setZoomDirect( newZoom );
		}
	}

	fitToWindow () {
		if ( this.zoomPanController ) {
			this.zoomPanController.fitToWindow();
		}
	}

	/**
	 * Zoom to fit all layers in the viewport
	 */
	zoomToFitLayers () {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomToFitLayers();
		}
	}

	/**
	 * Get bounding box of a layer
	 *
	 * @param {Object} layer Layer object
	 * @return {Object|null} Bounding box including raw and axis-aligned data
	 */
	getLayerBounds ( layer ) {
		if ( !layer ) {
			return null;
		}

		const baseBounds = this._getRawLayerBounds( layer );
		if ( !baseBounds ) {
			return null;
		}

		const rotation = layer.rotation || 0;
		const aabb = this._computeAxisAlignedBounds( baseBounds, rotation );

		return {
			x: baseBounds.x,
			y: baseBounds.y,
			width: baseBounds.width,
			height: baseBounds.height,
			rotation: rotation,
			centerX: baseBounds.x + ( baseBounds.width / 2 ),
			centerY: baseBounds.y + ( baseBounds.height / 2 ),
			left: aabb.left,
			top: aabb.top,
			right: aabb.right,
			bottom: aabb.bottom
		};
	}

	_getRawLayerBounds ( layer ) {
		// Handle text layers specially - they need canvas context for measurement
		if ( layer && layer.type === 'text' ) {
			// Guard: text measurement requires canvas context
			if ( !this.ctx ) {
				// Fallback to basic bounds without text measurement
				return {
					x: layer.x || 0,
					y: layer.y || 0,
					width: layer.width || 100,
					height: layer.height || 20
				};
			}
			const canvasWidth = this.canvas ? this.canvas.width : 0;
			const TextUtils = getClass( 'Utils.Text', 'TextUtils' );
			const textMetrics = TextUtils ? TextUtils.measureTextLayer( layer, this.ctx, canvasWidth ) : null;
			if ( !textMetrics ) {
				// Fallback to layer's own bounds if TextUtils unavailable
				return {
					x: layer.x || 0,
					y: layer.y || 0,
					width: layer.width || 100,
					height: layer.height || 20
				};
			}
			return {
				x: textMetrics.originX,
				y: textMetrics.originY,
				width: textMetrics.width,
				height: textMetrics.height
			};
		}
		// Use GeometryUtils for all other layer types
		const GeometryUtils = getClass( 'Utils.Geometry', 'GeometryUtils' );
		return GeometryUtils ? GeometryUtils.getLayerBoundsForType( layer ) : null;
	}

	_computeAxisAlignedBounds ( rect, rotationDegrees ) {
		const GeometryUtils = getClass( 'Utils.Geometry', 'GeometryUtils' );
		return GeometryUtils ? GeometryUtils.computeAxisAlignedBounds( rect, rotationDegrees ) : null;
	}

	/**
	 * Get a temporary canvas from the pool or create a new one
	 * This prevents memory leaks from constantly creating new canvas elements
	 *
	 * @param {number} width Canvas width
	 * @param {number} height Canvas height
	 * @return {Object} Object with canvas and context properties
	 */
	getTempCanvas ( width, height ) {
		let tempCanvasObj = this.canvasPool.pop();
		if ( tempCanvasObj ) {
			// Reuse existing canvas from pool
			tempCanvasObj.canvas.width = width || 100;
			tempCanvasObj.canvas.height = height || 100;
			// Clear the canvas
			const canvas = tempCanvasObj.canvas;
			tempCanvasObj.context.clearRect( 0, 0, canvas.width, canvas.height );
		} else {
			// Create new canvas object
			const tempCanvas = document.createElement( 'canvas' );
			tempCanvas.width = width || 100;
			tempCanvas.height = height || 100;
			tempCanvasObj = {
				canvas: tempCanvas,
				context: tempCanvas.getContext( '2d' )
			};
		}
		return tempCanvasObj;
	}

	/**
	 * Return a temporary canvas to the pool for reuse
	 *
	 * @param {Object} tempCanvasObj Object with canvas and context properties
	 */
	returnTempCanvas ( tempCanvasObj ) {
		if ( !tempCanvasObj || !tempCanvasObj.canvas || !tempCanvasObj.context ) {
			return;
		}

		// Only keep a limited number of canvases in the pool
		if ( this.canvasPool.length < this.maxPoolSize ) {
			// Clear the canvas before returning to pool
			const canvas = tempCanvasObj.canvas;
			tempCanvasObj.context.clearRect( 0, 0, canvas.width, canvas.height );
			// Reset context state
			tempCanvasObj.context.setTransform( 1, 0, 0, 1, 0, 0 );
			tempCanvasObj.context.globalAlpha = 1;
			tempCanvasObj.context.globalCompositeOperation = 'source-over';
			this.canvasPool.push( tempCanvasObj );
		} else {
			// Pool is full, let the canvas be garbage collected
			tempCanvasObj.canvas = null;
			tempCanvasObj.context = null;
		}
	}

	/**
	 * Handle zoom tool click - zoom in at point, or zoom out with shift
	 *
	 * @param {Object} point Mouse point in canvas coordinates
	 * @param {MouseEvent} event Mouse event with modifier keys
	 */
	handleZoomClick ( point, event ) {
		// Set up for potential drag operation
		this.initialDragZoom = this.zoom;

		const zoomFactor = event.shiftKey ? 0.8 : 1.25; // Zoom out if shift, zoom in otherwise
		let newZoom = this.zoom * zoomFactor;
		newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );

		if ( newZoom !== this.zoom ) {
			// Keep the clicked canvas point under the cursor stable
			const screenX = this.panX + this.zoom * point.x;
			const screenY = this.panY + this.zoom * point.y;
			this.zoom = newZoom;
			this.panX = screenX - this.zoom * point.x;
			this.panY = screenY - this.zoom * point.y;
			this.userHasSetZoom = true;
			this.updateCanvasTransform();
		}
	}

	/**
	 * Handle zoom tool drag - drag up/down to zoom in/out dynamically
	 *
	 * @param {Object} point Current mouse point
	 */
	handleZoomDrag ( point ) {
		if ( !this.dragStartPoint ) {
			return;
		}

		const deltaY = this.dragStartPoint.y - point.y; // Negative = drag down = zoom out
		const sensitivity = 0.01; // Zoom sensitivity
		const zoomChange = 1 + ( deltaY * sensitivity );

		let newZoom = this.initialDragZoom * zoomChange;

		// Clamp zoom level
		newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );

		if ( newZoom !== this.zoom ) {
			// Anchor zoom around drag start point
			const anchor = this.dragStartPoint;
			const screenX = this.panX + this.zoom * anchor.x;
			const screenY = this.panY + this.zoom * anchor.y;
			this.zoom = newZoom;
			this.panX = screenX - this.zoom * anchor.x;
			this.panY = screenY - this.zoom * anchor.y;
			this.userHasSetZoom = true;
			this.updateCanvasTransform();
		}
	}

	/**
	 * Public zoom helper used by external handlers (wheel/pinch)
	 *
	 * @param {number} delta Positive to zoom in, negative to zoom out (in zoom units)
	 * @param {{x:number,y:number}} point Canvas coordinate under the cursor to anchor zoom around
	 */
	zoomBy ( delta, point ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomBy( delta, point );
		}
	}

	/**
	 * Save current state to history for undo/redo
	 * Delegates to HistoryManager for single source of truth
	 *
	 * @param {string} action Description of the action
	 */
	saveState ( action ) {
		// Delegate to HistoryManager via editor if available
		if ( this.editor && this.editor.historyManager &&
			typeof this.editor.historyManager.saveState === 'function' ) {
			this.editor.historyManager.saveState( action );
		} else if ( this.historyManager &&
			typeof this.historyManager.saveState === 'function' ) {
			// Direct historyManager reference fallback
			this.historyManager.saveState( action );
		}
		// Note: debouncing is handled by HistoryManager
	}

	// Marquee selection methods - delegate to SelectionManager
	startMarqueeSelection ( point ) {
		this.isMarqueeSelecting = true;
		this.marqueeStart = { x: point.x, y: point.y };
		this.marqueeEnd = { x: point.x, y: point.y };
		if ( this.selectionManager ) {
			this.selectionManager.startMarqueeSelection( point );
		}
	}

	updateMarqueeSelection ( point ) {
		if ( !this.isMarqueeSelecting ) {
			return;
		}
		this.marqueeEnd = { x: point.x, y: point.y };
		if ( this.selectionManager ) {
			this.selectionManager.updateMarqueeSelection( point );
		}
		this.renderLayers( this.editor.layers );
		this.drawMarqueeBox();
	}

	finishMarqueeSelection () {
		if ( !this.isMarqueeSelecting ) {
			return;
		}
		if ( this.selectionManager ) {
			this.selectionManager.finishMarqueeSelection();
			// Sync selection state back
			const selectedIds = this.selectionManager.getSelectedLayerIds ?
				this.selectionManager.getSelectedLayerIds() : [];
			if ( selectedIds.length > 0 ) {
				this.setSelectedLayerIds( selectedIds );
				this.drawMultiSelectionIndicators();
			} else {
				this.deselectAll();
			}
		}
		this.isMarqueeSelecting = false;
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: this.getSelectedLayerIds().length } );
		}
	}

	getMarqueeRect () {
		// Use local state for calculating rect - always kept in sync
		const x1 = Math.min( this.marqueeStart.x, this.marqueeEnd.x );
		const y1 = Math.min( this.marqueeStart.y, this.marqueeEnd.y );
		const x2 = Math.max( this.marqueeStart.x, this.marqueeEnd.x );
		const y2 = Math.max( this.marqueeStart.y, this.marqueeEnd.y );
		return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
	}

	getLayersInRect ( rect ) {
		const layersInRect = [];
		this.editor.layers.forEach( ( layer ) => {
			const layerBounds = this.getLayerBounds( layer );
			if ( layerBounds && this.rectsIntersect( rect, layerBounds ) ) {
				layersInRect.push( layer );
			}
		} );
		return layersInRect;
	}

	rectsIntersect ( rect1, rect2 ) {
		const a = this._rectToAabb( rect1 );
		const b = this._rectToAabb( rect2 );
		return a.left < b.right && a.right > b.left &&
			a.top < b.bottom && a.bottom > b.top;
	}

	_rectToAabb ( rect ) {
		if ( !rect ) {
			return { left: 0, top: 0, right: 0, bottom: 0 };
		}
		if ( typeof rect.left === 'number' && typeof rect.right === 'number' &&
			typeof rect.top === 'number' && typeof rect.bottom === 'number' ) {
			return rect;
		}
		const x = rect.x || 0;
		const y = rect.y || 0;
		const width = rect.width || 0;
		const height = rect.height || 0;
		return {
			left: x,
			top: y,
			right: x + width,
			bottom: y + height
		};
	}

	// Apply opacity, blend mode, and simple effects per layer scope
	applyLayerEffects ( layer, drawCallback ) {
		// Deprecated: Logic moved to renderer
		if ( typeof drawCallback === 'function' ) {
			drawCallback();
		}
	}

	// Renderer delegation methods
	drawLayerWithEffects ( layer ) { if ( this.renderer ) { this.renderer.drawLayerWithEffects( layer ); } }
	drawMarqueeBox () { if ( this.renderer ) { this.renderer.drawMarqueeBox(); } }
	drawSelectionIndicators ( layerId, isKeyObject ) { if ( this.renderer ) { this.renderer.drawSelectionIndicators( layerId, isKeyObject ); } }
	drawSelectionHandles ( bounds, layer ) { if ( this.renderer ) { this.renderer.drawSelectionHandles( bounds, layer ); } }
	drawRotationHandle ( bounds, layer ) { if ( this.renderer ) { this.renderer.drawRotationHandle( bounds, layer ); } }

	// Helper: run drawing with multiplied alpha (used for fill/stroke opacity)
	withLocalAlpha ( factor, fn ) {
		const f = ( typeof factor === 'number' ) ? Math.max( 0, Math.min( 1, factor ) ) : 1;
		if ( f === 1 ) {
			fn();
			return;
		}
		const prev = this.ctx.globalAlpha;
		this.ctx.globalAlpha = ( prev || 1 ) * f;
		try {
			fn();
		} finally {
			this.ctx.globalAlpha = prev;
		}
	}

	// Selection helpers
	selectLayer ( layerId, fromPanel ) {
		// Update selection through StateManager (single source of truth)
		this.setSelectedLayerIds( layerId ? [ layerId ] : [] );
		this.selectionHandles = [];
		this.renderLayers( this.editor.layers );
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: this.getSelectedLayerIds().length } );
		}

		// Only sync with layer panel if this wasn't called from panel (prevent circular calls)
		if ( !fromPanel && this.editor && this.editor.layerPanel ) {
			this.editor.layerPanel.selectLayer( layerId, true );
		}
	}

	selectAll () {
		const allIds = ( this.editor.layers || [] )
			.filter( function ( layer ) { return layer.visible !== false; } )
			.map( function ( layer ) { return layer.id; } );
		this.setSelectedLayerIds( allIds );
		// Update lastSelectedId for key object alignment (last layer is key object)
		if ( this.selectionManager && allIds.length > 0 ) {
			this.selectionManager.lastSelectedId = allIds[ allIds.length - 1 ];
		}
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: this.getSelectedLayerIds().length } );
		}
	}

	deselectAll () {
		this.setSelectedLayerIds( [] );
		this.selectionHandles = [];
		this.rotationHandle = null;
		// Clear lastSelectedId when nothing is selected
		if ( this.selectionManager ) {
			this.selectionManager.lastSelectedId = null;
		}
		this.renderLayers( this.editor.layers );
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: 0, size: { width: 0, height: 0 } } );
		}
	}

	handleLayerSelection ( point, isCtrlClick ) {
		const hit = this.getLayerAtPoint( point );
		if ( !hit ) {
			if ( !isCtrlClick ) {
				this.deselectAll();
			}
			return null;
		}

		const currentIds = this.getSelectedLayerIds().slice(); // Copy current selection
		let newIds;

		if ( isCtrlClick ) {
			// Toggle selection state
			const idx = currentIds.indexOf( hit.id );
			if ( idx === -1 ) {
				currentIds.push( hit.id );
			} else {
				currentIds.splice( idx, 1 );
			}
			newIds = currentIds;
		} else {
			newIds = [ hit.id ];
		}

		// Update selection through StateManager
		this.setSelectedLayerIds( newIds );

		// Update lastSelectedId for key object alignment
		if ( this.selectionManager ) {
			const isHitSelected = newIds.indexOf( hit.id ) !== -1;
			if ( isHitSelected ) {
				// The clicked layer is selected, it becomes the key object
				this.selectionManager.lastSelectedId = hit.id;
			} else if ( newIds.length > 0 ) {
				// The clicked layer was deselected, use the last remaining
				this.selectionManager.lastSelectedId = newIds[ newIds.length - 1 ];
			} else {
				this.selectionManager.lastSelectedId = null;
			}
		}

		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();

		// Note: LayerPanel will update via StateManager subscription
		// Do NOT call layerPanel.selectLayer here as it would overwrite multi-selection

		// Update status bar with selection count
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: this.getSelectedLayerIds().length } );
		}

		return hit;
	}

	/**
	 * Draw selection indicators for multiple selected layers
	 * The key object (last selected) is visually distinguished with an orange border
	 */
	drawMultiSelectionIndicators () {
		const selectedIds = this.getSelectedLayerIds();
		if ( !selectedIds || selectedIds.length <= 1 ) {
			return;
		}
		
		// Get the key object ID (last selected layer) for visual distinction
		const keyObjectId = this.selectionManager ? this.selectionManager.lastSelectedId : null;
		
		for ( let i = 0; i < selectedIds.length; i++ ) {
			const isKeyObject = selectedIds.length > 1 && selectedIds[ i ] === keyObjectId;
			this.drawSelectionIndicators( selectedIds[ i ], isKeyObject );
		}
	}

	// Clipboard operations - delegated to ClipboardController
	copySelected () {
		if ( this.clipboardController ) {
			this.clipboardController.copySelected();
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: ClipboardController not available for copySelected' );
		}
	}

	pasteFromClipboard () {
		if ( this.clipboardController ) {
			this.clipboardController.paste();
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: ClipboardController not available for pasteFromClipboard' );
		}
	}

	cutSelected () {
		if ( this.clipboardController ) {
			this.clipboardController.cutSelected();
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: ClipboardController not available for cutSelected' );
		}
	}

	deleteSelected () {
		if ( this.selectionManager ) {
			this.selectionManager.deleteSelected();
		} else if ( this.editor && typeof this.editor.deleteSelected === 'function' ) {
			this.editor.deleteSelected();
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: No handler available for deleteSelected' );
		}
	}



	// External resize hook used by editor
	handleCanvasResize () {
		this.resizeCanvas();
		this.updateCanvasTransform();
		this.renderLayers( this.editor.layers );
	}

	/**
	 * Set the base dimensions that layers were created against.
	 * Used for scaling layers when the canvas size differs from the original.
	 *
	 * IMPORTANT: This also resizes the canvas logical dimensions to match.
	 * This ensures layers are created at coordinates that match the original
	 * image dimensions, regardless of what thumbnail size was loaded.
	 * This is critical for formats like TIFF where we load a thumbnail but
	 * need to store layers at the original file's coordinate space.
	 *
	 * @param {number} width - Original image width
	 * @param {number} height - Original image height
	 */
	setBaseDimensions ( width, height ) {
		this.baseWidth = width || null;
		this.baseHeight = height || null;

		// Resize canvas logical dimensions to match base dimensions
		// This ensures layers are created at the correct coordinate space
		if ( this.canvas && width && height && width > 0 && height > 0 ) {
			// Only resize if dimensions differ significantly (avoid unnecessary redraws)
			if ( this.canvas.width !== width || this.canvas.height !== height ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log( '[CanvasManager] Resizing canvas from ' +
						this.canvas.width + 'x' + this.canvas.height +
						' to base dimensions ' + width + 'x' + height );
				}
				this.canvas.width = width;
				this.canvas.height = height;
			}
		}

		// Trigger resize to apply proper CSS scaling
		this.resizeCanvas();

		// Redraw to ensure background image scales correctly
		this.redraw();
	}

	/**
	 * Set slide mode (no background image, custom dimensions and color)
	 * Called when editing a slide instead of a file image.
	 *
	 * @param {boolean} isSlide - Whether editor is in slide mode
	 */
	setSlideMode( isSlide ) {
		this.isSlideMode = isSlide;
		if ( this.renderer ) {
			this.renderer.setSlideMode( isSlide );
		}
	}

	/**
	 * Set slide background color
	 * Only used in slide mode (setSlideMode must be called first)
	 *
	 * @param {string} color - Background color (e.g. '#ffffff', 'transparent')
	 */
	setBackgroundColor( color ) {
		this.slideBackgroundColor = color || 'transparent';
		if ( this.renderer ) {
			this.renderer.setSlideBackgroundColor( color );
		}
		// Redraw to show new background
		this.redraw();
	}

	/**
	 * Resize canvas to match container size while maintaining aspect ratio.
	 * Updates viewport bounds for layer culling.
	 */
	resizeCanvas () {
		const container = this.container || ( this.canvas && this.canvas.parentNode );
		if ( !container || !this.canvas ) {
			return;
		}

		// Get container dimensions (with padding accounted for)
		const containerWidth = container.clientWidth || 800;
		const containerHeight = container.clientHeight || 600;

		// Get the canvas logical dimensions (image size)
		const canvasWidth = this.canvas.width || 800;
		const canvasHeight = this.canvas.height || 600;

		// Calculate aspect-ratio-preserving CSS dimensions
		// The canvas should fit within the container while preserving aspect ratio
		const canvasAspect = canvasWidth / canvasHeight;
		const containerAspect = containerWidth / containerHeight;

		let cssWidth, cssHeight;
		if ( canvasAspect > containerAspect ) {
			// Canvas is wider than container - constrain by width
			cssWidth = containerWidth;
			cssHeight = containerWidth / canvasAspect;
		} else {
			// Canvas is taller than container - constrain by height
			cssHeight = containerHeight;
			cssWidth = containerHeight * canvasAspect;
		}

		// Apply CSS dimensions to maintain aspect ratio
		this.canvas.style.width = Math.round( cssWidth ) + 'px';
		this.canvas.style.height = Math.round( cssHeight ) + 'px';

		if ( !this.userHasSetZoom ) {
			// Reset logical zoom if user hasn't set zoom manually
			this.zoom = 1.0;
			if ( this.zoomPanController && typeof this.zoomPanController.updateCanvasTransform === 'function' ) {
				this.zoomPanController.updateCanvasTransform();
			}
		}

		// Update viewport bounds used for layer culling
		this.viewportBounds = this.viewportBounds || { x: 0, y: 0, width: 0, height: 0 };
		this.viewportBounds.width = this.canvas.width;
		this.viewportBounds.height = this.canvas.height;
	}

	getMousePoint ( e ) {
		return this.getMousePointFromClient( e.clientX, e.clientY );
	}

	/**
	 * Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.
	 * Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.
	 *
	 * @param {number} clientX
	 * @param {number} clientY
	 * @return {{x:number,y:number}}
	 */
	getMousePointFromClient ( clientX, clientY ) {
		const rect = this.canvas.getBoundingClientRect();
		// Position within the displayed (transformed) element
		const relX = clientX - rect.left;
		const relY = clientY - rect.top;
		// Scale to logical canvas pixels
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;
		const canvasX = relX * scaleX;
		const canvasY = relY * scaleY;

		return { x: canvasX, y: canvasY };
	}

	startDrawing ( point ) {
		// Use current style options if available
		let style = { ...( this.currentStyle || {} ) };

		// Merge tool-specific defaults for dimension and marker tools
		if ( this.currentTool === 'dimension' && this.dimensionDefaults ) {
			style = { ...style, ...this.dimensionDefaults };
		} else if ( this.currentTool === 'marker' && this.markerDefaults ) {
			style = { ...style, ...this.markerDefaults };
		}

		// Delegate to DrawingController
		if ( this.drawingController ) {
			this.drawingController.startDrawing( point, this.currentTool, style );
			// Sync tempLayer for backward compatibility
			this.tempLayer = this.drawingController.getTempLayer();
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: DrawingController not available for startDrawing' );
		}
	}

	continueDrawing ( point ) {
		// Delegate to DrawingController - update geometry immediately
		if ( this.drawingController ) {
			this.drawingController.continueDrawing( point );
			this.tempLayer = this.drawingController.getTempLayer();

			// Throttle rendering using requestAnimationFrame to avoid lag
			if ( this.tempLayer && !this._drawingFrameScheduled ) {
				this._drawingFrameScheduled = true;
				window.requestAnimationFrame( () => {
					this._drawingFrameScheduled = false;
					// Guard against destroyed state to prevent null reference errors
					if ( this.isDestroyed ) {
						return;
					}
					if ( this.tempLayer ) {
						this.renderLayers( this.editor.layers );
						this.drawingController.drawPreview();
					}
				} );
			}
		}
	}

	finishDrawing ( point ) {
		// Delegate to DrawingController
		if ( this.drawingController ) {
			const currentTool = this.currentTool;
			const layerData = this.drawingController.finishDrawing( point, currentTool );
			this.tempLayer = null;
			// Check if marker autonumber mode is enabled
			// If so, stay on marker tool instead of switching to pointer
			const isMarkerAutoNumber = currentTool === 'marker' &&
				this.markerDefaults &&
				this.markerDefaults.autoNumber;

			if ( layerData ) {
				// When auto-number is enabled, don't select the new layer
				// so the toolbar controls stay visible for continued drawing
				if ( isMarkerAutoNumber ) {
					this.editor.addLayerWithoutSelection( layerData );
				} else {
					this.editor.addLayer( layerData );
				}
			}

			if ( !isMarkerAutoNumber ) {
				// Reset to pointer tool after drawing finishes
				// (whether or not a layer was created)
				if ( typeof this.editor.setCurrentTool === 'function' ) {
					this.editor.setCurrentTool( 'pointer' );
				}
			}
			this.renderLayers( this.editor.layers );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: DrawingController not available for finishDrawing' );
		}
	}

	// Text input controller delegation
	createTextInputModal ( point, style ) {
		return this.textInputController ? this.textInputController.createTextInputModal( point, style ) : null;
	}
	finishTextInput ( input, point, style ) {
		if ( this.textInputController ) { this.textInputController.finishTextInput( input, point, style ); }
	}
	hideTextInputModal () {
		if ( this.textInputController ) { this.textInputController.hideTextInputModal(); }
		this.textInputModal = null;
	}

	setTool ( tool ) {
		this.currentTool = tool;
		this.canvas.style.cursor = this.getToolCursor( tool );
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { tool: tool } );
		}
	}

	/**
	 * Set text editing mode (used by InlineTextEditor)
	 * When active, suppresses selection handles and drag operations
	 *
	 * @param {boolean} isEditing Whether inline text editing is active
	 */
	setTextEditingMode ( isEditing ) {
		this.isTextEditing = isEditing;
		if ( isEditing ) {
			// Prevent selection changes while editing
			this.canvas.style.cursor = 'text';
		} else {
			// Restore normal cursor
			this.canvas.style.cursor = this.getToolCursor( this.currentTool );
			this.redraw( this.editor?.layers );
		}
	}

	getToolCursor ( tool ) {
		// Delegate to DrawingController
		if ( this.drawingController ) {
			return this.drawingController.getToolCursor( tool );
		}
		return 'default';
	}

	// NOTE: updateStyleOptions is defined earlier (around line 523) and delegates to StyleController.
	// Duplicate definition removed to prevent redefinition and reduce file size.

	renderLayers ( layers ) {
		this.redraw( layers );
	}

	redraw ( layers ) {
		if ( !this.renderer ) {
			return;
		}

		try {
			// Sync state to renderer
			// Fix: Do not pass zoom/pan to renderer to avoid double-transformation (CSS + Context)
			this.renderer.setTransform( 1, 0, 0 );
			this.renderer.setBackgroundImage( this.backgroundImage );
			this.renderer.setSelection( this.getSelectedLayerIds() );
			this.renderer.setMarquee( this.isMarqueeSelecting, this.getMarqueeRect() );

			// Perform redraw
			const layersToDraw = layers || ( ( this.editor && this.editor.layers ) ? this.editor.layers : [] );
			this.renderer.redraw( layersToDraw );

		} catch ( error ) {
			if ( this.editor && this.editor.errorLog ) {
				// Capture detailed error info for debugging
				const errorInfo = error instanceof Error ?
					{ message: error.message, stack: error.stack } :
					( typeof error === 'object' ? JSON.stringify( error ) : String( error ) );
				this.editor.errorLog( 'Canvas redraw failed:', errorInfo );
			}
		}
	}

	redrawOptimized () {
		// Delegate to RenderCoordinator for optimized rendering with rAF batching
		if ( this.renderCoordinator ) {
			this.renderCoordinator.scheduleRedraw();
			return;
		}

		// Fallback: Optimize redraws using requestAnimationFrame
		if ( this.redrawScheduled ) {
			return; // Already scheduled
		}

		this.redrawScheduled = true;

		if ( window.requestAnimationFrame ) {
			this.animationFrameId = window.requestAnimationFrame( function () {
				this.redraw();
				this.redrawScheduled = false;
			}.bind( this ) );
		} else {
			// Fallback for older browsers
			this.fallbackTimeoutId = setTimeout( function () {
				this.redraw();
				this.redrawScheduled = false;
				this.fallbackTimeoutId = null;
			}.bind( this ), 16 ); // ~60fps
		}
	}

	updateViewportBounds () {
		// Update viewport bounds for layer culling
		this.viewportBounds.x = 0;
		this.viewportBounds.y = 0;
		this.viewportBounds.width = this.canvas.width;
		this.viewportBounds.height = this.canvas.height;
	}

	isLayerInViewport ( layer ) {
		// Basic layer culling - check if layer intersects with viewport
		if ( !layer ) {
			return false;
		}

		// If viewport bounds aren't properly initialized, show all layers
		if ( !this.viewportBounds || this.viewportBounds.width <= 0 ||
			this.viewportBounds.height <= 0 ) {
			return true;
		}

		// Get layer bounds
		const bounds = this.getLayerBounds( layer );
		if ( !bounds ) {
			return true; // If we can't determine bounds, assume visible
		}

		const viewport = this.viewportBounds;
		return !( bounds.right < viewport.x ||
				bounds.left > viewport.x + viewport.width ||
				bounds.bottom < viewport.y ||
				bounds.top > viewport.y + viewport.height );
	}


	drawLayer ( layer ) {
		// Skip invisible layers
		if ( layer.visible === false ) {
			return;
		}

		if ( !this.renderer ) {
			return;
		}

		try {
			this.renderer.drawLayer( layer );
		} catch ( error ) {
			// Error recovery for layer drawing
			if ( this.editor && this.editor.errorLog ) {
				this.editor.errorLog( 'Layer drawing failed for', layer.type, 'layer:', error );
			}

			// Draw error placeholder for the layer
			try {
				this.renderer.drawErrorPlaceholder( layer );
			} catch ( recoveryError ) {
				if ( window.mw && window.mw.log && typeof window.mw.log.error === 'function' ) {
					window.mw.log.error( 'Layers: Layer error recovery failed:', recoveryError );
				} else if ( this.editor && typeof this.editor.errorLog === 'function' ) {
					this.editor.errorLog( 'Layer error recovery failed:', recoveryError );
				}
			}
		}
	}

	destroy () {
		// Set destroyed flag first to prevent async callbacks from running
		this.isDestroyed = true;

		// Cancel any pending animation frame to prevent memory leaks
		if ( this.animationFrameId ) {
			window.cancelAnimationFrame( this.animationFrameId );
			this.animationFrameId = null;
		}
		// Cancel fallback timeout if used
		if ( this.fallbackTimeoutId ) {
			clearTimeout( this.fallbackTimeoutId );
			this.fallbackTimeoutId = null;
		}
		this.redrawScheduled = false;
		// Reset drawing frame flag to prevent stale RAF callbacks
		this._drawingFrameScheduled = false;

		// Clean up all controllers - order matters for dependencies
		const controllersToDestroy = [
			'renderCoordinator',
			'events',
			'renderer',
			'selectionManager',
			'zoomPanController',
			'transformController',
			'hitTestController',
			'drawingController',
			'clipboardController',
			'textInputController',
			'alignmentController',
			'smartGuidesController',
			'styleController',
			'imageLoader'
		];

		controllersToDestroy.forEach( function ( name ) {
			if ( this[ name ] ) {
				if ( typeof this[ name ].destroy === 'function' ) {
					try {
						this[ name ].destroy();
					} catch ( e ) {
						if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
							mw.log.warn( '[CanvasManager] Error destroying ' + name + ':', e.message );
						}
					}
				}
				this[ name ] = null;
			}
		}, this );

		// Unsubscribe from state manager to prevent memory leaks
		if ( this.stateUnsubscribers && this.stateUnsubscribers.length > 0 ) {
			this.stateUnsubscribers.forEach( ( unsub ) => {
				if ( typeof unsub === 'function' ) {
					try {
						unsub();
					} catch ( e ) {
						if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
							mw.log.warn( '[CanvasManager] Error unsubscribing:', e.message );
						}
					}
				}
			} );
			this.stateUnsubscribers = [];
		}

		// Clear canvas pool to prevent memory leaks
		if ( this.canvasPool && this.canvasPool.length > 0 ) {
			this.canvasPool.forEach( function ( pooledCanvas ) {
				pooledCanvas.width = 0;
				pooledCanvas.height = 0;
			} );
			this.canvasPool = [];
		}

		// Clear clipboard
		this.clipboard = [];

		// Reset zoom animation state
		this.zoomAnimationStartTime = 0;
		this.zoomAnimationStartZoom = 1.0;
		this.zoomAnimationTargetZoom = 1.0;

		// Clear references
		this.canvas = null;
		this.ctx = null;
		this.container = null;
		this.backgroundImage = null;
		this.editor = null;
		this.config = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.Manager = CanvasManager;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasManager;
	}

}() );
