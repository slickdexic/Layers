/**
 * Canvas Manager for Layers Editor
 * Handles HTML5 canvas operations and rendering
 */
( function () {
	'use strict';

	/**
	 * CanvasManager class
	 *
	 * @param {Object} config
	 * @class
	 *
	 */
	function CanvasManager( config ) {
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

		this.currentStyle = {
			color: ( defaults && defaults.COLORS ) ? defaults.COLORS.STROKE : '#000000',
			strokeWidth: ( defaults && defaults.LAYER ) ? defaults.LAYER.STROKE_WIDTH : 2,
			fontSize: ( defaults && defaults.LAYER ) ? defaults.LAYER.FONT_SIZE : 16,
			fontFamily: ( defaults && defaults.LAYER ) ? defaults.LAYER.FONT_FAMILY : 'Arial, sans-serif'
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

		// Smooth zoom animation properties
		this.isAnimatingZoom = false;
		this.zoomAnimationDuration = uiConsts ? uiConsts.ANIMATION_DURATION : 300;
		this.zoomAnimationStartTime = 0;
		this.zoomAnimationStartZoom = 1.0;
		this.zoomAnimationTargetZoom = 1.0;

		// Grid settings
		this.showGrid = false;
		this.gridSize = uiConsts ? uiConsts.GRID_SIZE : 20;
		this.snapToGrid = false;

		// Rulers & guides
		this.showRulers = false;
		this.showGuides = false;
		this.snapToGuides = false;
		this.smartGuides = false; // reserved for future smart alignment
		this.rulerSize = uiConsts ? uiConsts.RULER_SIZE : 30;
		this.horizontalGuides = []; // y positions in canvas coords
		this.verticalGuides = []; // x positions in canvas coords
		this.isDraggingGuide = false;
		this.dragGuideOrientation = null; // 'h' | 'v'
		this.dragGuidePos = 0;

		// Note: History/Undo is managed by HistoryManager (single source of truth)
		// These legacy properties are kept for backward compatibility but are no longer used
		// this.history, this.historyIndex are accessed via this.editor.historyManager

		// Clipboard for copy/paste
		this.clipboard = [];

		// Canvas pooling for temporary canvas operations to prevent memory leaks
		this.canvasPool = [];
		this.maxPoolSize = limits ? limits.MAX_CANVAS_POOL_SIZE : 5;

		this.init();
	}

	CanvasManager.prototype.init = function () {
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

		// Initialize CanvasRenderer
		const RendererClass = ( typeof CanvasRenderer !== 'undefined' ) ? CanvasRenderer :
			( ( typeof window !== 'undefined' && window.CanvasRenderer ) ? window.CanvasRenderer :
			( ( typeof mw !== 'undefined' && mw.CanvasRenderer ) ? mw.CanvasRenderer : undefined ) );

		if ( RendererClass ) {
			this.renderer = new RendererClass( this.canvas, { editor: this.editor } );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: CanvasRenderer not found' );
		}
		// Initialize SelectionManager
		const SelectionManagerClass = ( typeof LayersSelectionManager !== 'undefined' ) ? LayersSelectionManager :
			( ( typeof window !== 'undefined' && window.LayersSelectionManager ) ? window.LayersSelectionManager :
			( ( typeof mw !== 'undefined' && mw.LayersSelectionManager ) ? mw.LayersSelectionManager : undefined ) );

		if ( SelectionManagerClass ) {
			this.selectionManager = new SelectionManagerClass( {}, this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: SelectionManager not found, some features may be disabled' );
		}

		// Initialize ZoomPanController for zoom/pan operations
		const ZoomPanControllerClass = ( typeof ZoomPanController !== 'undefined' ) ? ZoomPanController :
			( ( typeof window !== 'undefined' && window.ZoomPanController ) ? window.ZoomPanController : undefined );

		if ( ZoomPanControllerClass ) {
			this.zoomPanController = new ZoomPanControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: ZoomPanController not found, zoom/pan may use fallback methods' );
		}

		// Initialize GridRulersController for grid/ruler/guide operations
		const GridRulersControllerClass = ( typeof GridRulersController !== 'undefined' ) ? GridRulersController :
			( ( typeof window !== 'undefined' && window.GridRulersController ) ? window.GridRulersController : undefined );

		if ( GridRulersControllerClass ) {
			this.gridRulersController = new GridRulersControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: GridRulersController not found, grid/rulers may use fallback methods' );
		}

		// Initialize TransformController for resize/rotation/drag operations
		const TransformControllerClass = ( typeof TransformController !== 'undefined' ) ? TransformController :
			( ( typeof window !== 'undefined' && window.TransformController ) ? window.TransformController : undefined );

		if ( TransformControllerClass ) {
			this.transformController = new TransformControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: TransformController not found, transforms may use fallback methods' );
		}

		// Initialize HitTestController for hit testing operations
		const HitTestControllerClass = ( typeof HitTestController !== 'undefined' ) ? HitTestController :
			( ( typeof window !== 'undefined' && window.HitTestController ) ? window.HitTestController : undefined );

		if ( HitTestControllerClass ) {
			this.hitTestController = new HitTestControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: HitTestController not found, hit testing may use fallback methods' );
		}

		// Initialize DrawingController for shape drawing operations
		const DrawingControllerClass = ( typeof DrawingController !== 'undefined' ) ? DrawingController :
			( ( typeof window !== 'undefined' && window.DrawingController ) ? window.DrawingController : undefined );

		if ( DrawingControllerClass ) {
			this.drawingController = new DrawingControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: DrawingController not found, drawing may use fallback methods' );
		}

		// Initialize ClipboardController for copy/paste operations
		const ClipboardControllerClass = ( typeof ClipboardController !== 'undefined' ) ? ClipboardController :
			( ( typeof window !== 'undefined' && window.ClipboardController ) ? window.ClipboardController : undefined );

		if ( ClipboardControllerClass ) {
			this.clipboardController = new ClipboardControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: ClipboardController not found, clipboard may use fallback methods' );
		}

		// Set up event handlers
		this.setupEventHandlers();

		// Load background image if editor/filename is present; otherwise
		// skip image detection during tests.
		if ( this.editor && this.editor.filename ) {
			this.loadBackgroundImage();
		}

		// Subscribe to StateManager for selection changes
		this.subscribeToState();
	};

	/**
	 * Get the selected layer IDs from StateManager (single source of truth)
	 * @return {Array} Array of selected layer IDs
	 */
	CanvasManager.prototype.getSelectedLayerIds = function () {
		if ( this.editor && this.editor.stateManager ) {
			return this.editor.stateManager.get( 'selectedLayerIds' ) || [];
		}
		return [];
	};

	/**
	 * Get the primary selected layer ID (last in selection array)
	 * @return {string|null} The selected layer ID or null
	 */
	CanvasManager.prototype.getSelectedLayerId = function () {
		const ids = this.getSelectedLayerIds();
		return ids.length > 0 ? ids[ ids.length - 1 ] : null;
	};

	/**
	 * Set the selected layer IDs via StateManager
	 * @param {Array} ids Array of layer IDs to select
	 */
	CanvasManager.prototype.setSelectedLayerIds = function ( ids ) {
		if ( this.editor && this.editor.stateManager ) {
			this.editor.stateManager.set( 'selectedLayerIds', ids || [] );
		}
	};

	/**
	 * Subscribe to StateManager for reactive updates
	 */
	CanvasManager.prototype.subscribeToState = function () {
		const self = this;
		if ( !this.editor || !this.editor.stateManager ) {
			return;
		}

		// Subscribe to selection changes to trigger re-render
		this.editor.stateManager.subscribe( 'selectedLayerIds', function () {
			self.selectionHandles = [];
			self.renderLayers( self.editor.layers );
		} );
	};

	/**
	 * Load background image using ImageLoader module
	 * Delegates to ImageLoader for URL detection and loading with fallbacks
	 */
	CanvasManager.prototype.loadBackgroundImage = function () {
		const self = this;
		const filename = this.editor.filename;
		const backgroundImageUrl = this.config.backgroundImageUrl;

		// Get ImageLoader class
		const ImageLoaderClass = ( typeof ImageLoader !== 'undefined' ) ? ImageLoader :
			( ( typeof window !== 'undefined' && window.ImageLoader ) ? window.ImageLoader : null );

		if ( ImageLoaderClass ) {
			// Use ImageLoader module
			this.imageLoader = new ImageLoaderClass( {
				filename: filename,
				backgroundImageUrl: backgroundImageUrl,
				onLoad: function ( image, info ) {
					self.handleImageLoaded( image, info );
				},
				onError: function () {
					self.handleImageLoadError();
				}
			} );
			this.imageLoader.load();
		} else {
			// Fallback for environments without ImageLoader
			if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[CanvasManager] ImageLoader not found, using fallback' );
			}
			this.loadBackgroundImageFallback();
		}
	};

	/**
	 * Handle successful image load from ImageLoader
	 * @param {HTMLImageElement} image - The loaded image
	 * @param {Object} info - Load info (width, height, source, etc.)
	 */
	CanvasManager.prototype.handleImageLoaded = function ( image, info ) {
		this.backgroundImage = image;

		// Pass image to renderer
		if ( this.renderer ) {
			this.renderer.setBackgroundImage( this.backgroundImage );
		}

		// Set canvas size to match the image
		this.canvas.width = info.width || image.width || 800;
		this.canvas.height = info.height || image.height || 600;

		// Resize canvas display to fit container
		this.resizeCanvas();

		// Draw the image and any layers
		this.redraw();
		if ( this.editor && this.editor.layers ) {
			this.renderLayers( this.editor.layers );
		}
	};

	/**
	 * Handle image load error from ImageLoader
	 */
	CanvasManager.prototype.handleImageLoadError = function () {
		// Create a simple background directly on canvas when all load attempts fail
		this.backgroundImage = null;
		if ( this.renderer ) {
			this.renderer.setBackgroundImage( null );
		}

		// Set default canvas size
		this.canvas.width = 800;
		this.canvas.height = 600;

		// Resize canvas to fit container
		this.resizeCanvas();

		// Render any existing layers
		if ( this.editor && this.editor.layers ) {
			this.renderLayers( this.editor.layers );
		}
	};

	/**
	 * Fallback image loading for environments without ImageLoader module
	 * @private
	 */
	CanvasManager.prototype.loadBackgroundImageFallback = function () {
		const filename = this.editor.filename;
		const backgroundImageUrl = this.config.backgroundImageUrl;

		// Build URL list
		const imageUrls = [];
		if ( backgroundImageUrl ) {
			imageUrls.push( backgroundImageUrl );
		}

		// Try page images
		const pageImages = document.querySelectorAll(
			'.mw-file-element img, .fullImageLink img, .filehistory img, img[src*="' + filename + '"]'
		);
		for ( let i = 0; i < pageImages.length; i++ ) {
			const imgSrc = pageImages[ i ].src;
			if ( imgSrc && imageUrls.indexOf( imgSrc ) === -1 ) {
				imageUrls.push( imgSrc );
			}
		}

		// Try MediaWiki URLs
		if ( filename && typeof mw !== 'undefined' && mw.config ) {
			const server = mw.config.get( 'wgServer' );
			const scriptPath = mw.config.get( 'wgScriptPath' );
			if ( server && scriptPath ) {
				imageUrls.push(
					server + scriptPath + '/index.php?title=Special:Redirect/file/' +
					encodeURIComponent( filename )
				);
			}
		}

		// Try loading
		if ( imageUrls.length > 0 ) {
			this.tryLoadImageFallback( imageUrls, 0 );
		}
		// If no URLs found, just leave the canvas in its current state.
		// This matches the original behavior where image loading was asynchronous
		// and the canvas wasn't modified until an image actually loaded/failed.
	};

	/**
	 * Fallback image loading with URL list
	 * @param {string[]} urls - URLs to try
	 * @param {number} index - Current index
	 * @private
	 */
	CanvasManager.prototype.tryLoadImageFallback = function ( urls, index ) {
		const self = this;

		if ( index >= urls.length ) {
			this.handleImageLoadError();
			return;
		}

		const image = new Image();
		image.crossOrigin = 'anonymous';

		image.onload = function () {
			self.handleImageLoaded( image, {
				width: image.width,
				height: image.height,
				source: 'fallback'
			} );
		};

		image.onerror = function () {
			self.tryLoadImageFallback( urls, index + 1 );
		};

		image.src = urls[ index ];
	};

	CanvasManager.prototype.resizeCanvas = function () {
		// Get container dimensions
		const container = this.canvas.parentNode;
		//  container.clientWidth, 'x', container.clientHeight );

		// If no canvas size is set yet, use default
		if ( this.canvas.width === 0 || this.canvas.height === 0 ) {
			this.canvas.width = 800;
			this.canvas.height = 600;
		}

		const canvasWidth = this.canvas.width;
		const canvasHeight = this.canvas.height;
		// Calculate available space in container (with padding)
		const availableWidth = Math.max( container.clientWidth - 40, 400 );
		const availableHeight = Math.max( container.clientHeight - 40, 300 );
		// Calculate scale to fit the canvas in the container
		const scaleX = availableWidth / canvasWidth;
		const scaleY = availableHeight / canvasHeight;
		let scale = Math.min( scaleX, scaleY );

		// Ensure reasonable scale bounds (don't make it too tiny or huge)
		scale = Math.max( 0.1, Math.min( scale, 3.0 ) );

		// Calculate final display size
		const displayWidth = Math.floor( canvasWidth * scale );
		const displayHeight = Math.floor( canvasHeight * scale );

		// Set CSS size for display
		this.canvas.style.width = displayWidth + 'px';
		this.canvas.style.height = displayHeight + 'px';
		this.canvas.style.maxWidth = 'none';
		this.canvas.style.maxHeight = 'none';
		this.canvas.style.border = '1px solid #ddd';
		this.canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

		// Set zoom and pan only if user hasn't manually set zoom
		if ( !this.userHasSetZoom ) {
			this.zoom = scale;
			this.panX = 0;
			this.panY = 0;
		} else {
			// User has manually set zoom - preserve it but update canvas size with current zoom
			this.canvas.style.width = ( canvasWidth * this.zoom ) + 'px';
			this.canvas.style.height = ( canvasHeight * this.zoom ) + 'px';
		}
		//     width: this.canvas.style.width,
		//     height: this.canvas.style.height,
		//     border: this.canvas.style.border,
		//     boxShadow: this.canvas.style.boxShadow
		// });
	};

	CanvasManager.prototype.setupEventHandlers = function () {
		if ( typeof CanvasEvents !== 'undefined' ) {
			this.events = new CanvasEvents( this );
			return;
		}
		if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: CanvasEvents module not found' );
		}
	};



	CanvasManager.prototype.hitTestSelectionHandles = function ( point ) {
		// Delegate to HitTestController if available
		if ( this.hitTestController ) {
			return this.hitTestController.hitTestSelectionHandles( point );
		}

		// Fallback for when controller is not available
		let handles = [];
		if ( this.renderer && this.renderer.selectionHandles && this.renderer.selectionHandles.length > 0 ) {
			handles = this.renderer.selectionHandles;
		} else if ( this.selectionManager && this.selectionManager.selectionHandles && this.selectionManager.selectionHandles.length > 0 ) {
			handles = this.selectionManager.selectionHandles;
		} else {
			handles = this.selectionHandles;
		}

		for ( let i = 0; i < handles.length; i++ ) {
			const handle = handles[ i ];
			const rect = handle.rect || handle;
			if ( this.isPointInRect( point, rect ) ) {
				return handle;
			}
		}
		return null;
	};

	CanvasManager.prototype.isPointInRect = function ( point, rect ) {
		// Delegate to HitTestController if available
		if ( this.hitTestController ) {
			return this.hitTestController.isPointInRect( point, rect );
		}
		// Fallback
		return point.x >= rect.x && point.x <= rect.x + rect.width &&
			point.y >= rect.y && point.y <= rect.y + rect.height;
	};

	CanvasManager.prototype.startResize = function ( handle ) {
		if ( this.transformController ) {
			this.transformController.startResize( handle, this.startPoint );
			this.isResizing = this.transformController.isResizing;
			this.resizeHandle = this.transformController.resizeHandle;
			return;
		}
		// Fallback for when controller is not available
		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartPoint = this.startPoint;

		const layer = this.editor.getLayerById( this.getSelectedLayerId() );
		const rotation = layer ? layer.rotation : 0;
		this.canvas.style.cursor = this.getResizeCursor( handle.type, rotation );

		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}
	};

	CanvasManager.prototype.startRotation = function ( point ) {
		if ( this.transformController ) {
			this.transformController.startRotation( point );
			this.isRotating = this.transformController.isRotating;
			return;
		}
		// Fallback for when controller is not available
		this.isRotating = true;
		this.canvas.style.cursor = 'grabbing';
		if ( point ) {
			this.dragStartPoint = point;
		}

		const layer = this.editor.getLayerById( this.getSelectedLayerId() );
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}
	};

	CanvasManager.prototype.startDrag = function () {
		if ( this.transformController ) {
			this.transformController.startDrag( this.startPoint );
			this.isDragging = this.transformController.isDragging;
			return;
		}
		// Fallback for when controller is not available
		this.isDragging = true;
		this.canvas.style.cursor = 'move';

		// Store original layer state(s)
		const selectedIds = this.getSelectedLayerIds();
		if ( selectedIds.length > 1 ) {
			// Multi-selection: store all selected layer states
			this.originalMultiLayerStates = {};
			for ( let i = 0; i < selectedIds.length; i++ ) {
				const layerId = selectedIds[ i ];
				const multiLayer = this.editor.getLayerById( layerId );
				if ( multiLayer ) {
					this.originalMultiLayerStates[ layerId ] =
						JSON.parse( JSON.stringify( multiLayer ) );
				}
			}
		} else {
			// Single selection: store single layer state
			const singleLayer = this.editor.getLayerById( this.getSelectedLayerId() );
			if ( singleLayer ) {
				this.originalLayerState = JSON.parse( JSON.stringify( singleLayer ) );
			}
		}
	};

	CanvasManager.prototype.getResizeCursor = function ( handleType, rotation ) {
		if ( this.transformController ) {
			return this.transformController.getResizeCursor( handleType, rotation );
		}
		// Fallback for when controller is not available
		if ( !rotation || rotation === 0 ) {
			switch ( handleType ) {
				case 'nw':
				case 'se':
					return 'nw-resize';
				case 'ne':
				case 'sw':
					return 'ne-resize';
				case 'n':
				case 's':
					return 'n-resize';
				case 'e':
				case 'w':
					return 'e-resize';
				default:
					return 'default';
			}
		}

		// For rotated objects, we need to calculate the effective cursor direction
		// based on the handle type and rotation angle
		const normalizedRotation = ( ( rotation % 360 ) + 360 ) % 360;
		const cursorIndex = Math.round( normalizedRotation / 45 ) % 8;

		// Map handle types to base cursor directions (0 = north)
		const baseCursors = {
			n: 0,
			ne: 1,
			e: 2,
			se: 3,
			s: 4,
			sw: 5,
			w: 6,
			nw: 7
		};

		// Calculate the effective cursor direction
		const effectiveDirection = ( baseCursors[ handleType ] + cursorIndex ) % 8;

		// Map back to cursor names
		const cursors = [ 'n-resize', 'ne-resize', 'e-resize', 'ne-resize', 'n-resize', 'ne-resize', 'e-resize', 'nw-resize' ];
		return cursors[ effectiveDirection ];
	};



	CanvasManager.prototype.handleResize = function ( point, event ) {
		if ( this.transformController && this.transformController.isResizing ) {
			this.transformController.handleResize( point, event );
			return;
		}
		// Fallback for when controller is not available
		const layer = this.editor.getLayerById( this.getSelectedLayerId() );

		if ( !layer || !this.originalLayerState ) {
			return;
		}

		let deltaX = point.x - this.dragStartPoint.x;
		let deltaY = point.y - this.dragStartPoint.y;

		// If layer has rotation, transform the delta into the layer's local coordinate system
		const rotation = layer.rotation || 0;
		if ( rotation !== 0 ) {
			const rotRad = -rotation * Math.PI / 180; // Negative to reverse the rotation
			const cos = Math.cos( rotRad );
			const sin = Math.sin( rotRad );
			const rotatedDeltaX = deltaX * cos - deltaY * sin;
			const rotatedDeltaY = deltaX * sin + deltaY * cos;
			deltaX = rotatedDeltaX;
			deltaY = rotatedDeltaY;
		}

		// Limit delta values to prevent sudden jumps during rapid mouse movements
		const maxDelta = 1000; // Reasonable maximum delta in pixels
		deltaX = Math.max( -maxDelta, Math.min( maxDelta, deltaX ) );
		deltaY = Math.max( -maxDelta, Math.min( maxDelta, deltaY ) );

		// Get modifier keys from the event
		const modifiers = {
			proportional: event && event.shiftKey, // Shift key for proportional scaling
			fromCenter: event && event.altKey // Alt key for scaling from center
		};

		// Debug logging
		if ( this.editor && this.editor.debug ) {
			this.editor.debugLog( 'Resize:', {
				handle: this.resizeHandle.type,
				delta: { x: deltaX, y: deltaY },
				layer: layer.type,
				original: this.originalLayerState,
				modifiers: modifiers
			} );
		}

		// Calculate new dimensions based on handle type
		const updates = this.calculateResize(
			this.originalLayerState,
			this.resizeHandle.type,
			deltaX,
			deltaY,
			modifiers
		);

		// Apply updates to layer
		if ( updates ) {
			if ( this.editor && this.editor.debug ) {
				this.editor.debugLog( 'Applying updates:', updates );
			}
			Object.keys( updates ).forEach( function ( key ) {
				layer[ key ] = updates[ key ];
			} );
			if ( layer.type === 'star' && Object.prototype.hasOwnProperty.call( updates, 'radius' ) ) {
				layer.radius = Math.max( 5, Math.abs( layer.radius || 0 ) );
				layer.outerRadius = layer.radius;
				layer.innerRadius = layer.radius * 0.5;
			}

			// Re-render and emit live-transform event
			this.renderLayers( this.editor.layers );
			this.emitTransforming( layer );
		} else if ( this.editor && this.editor.debug ) {
			this.editor.debugLog( 'No updates calculated for resize' );
		}
	};

	CanvasManager.prototype.calculateResize = function (
		originalLayer, handleType, deltaX, deltaY, modifiers
	) {
		modifiers = modifiers || {};

		switch ( originalLayer.type ) {
			case 'rectangle':
			case 'blur':
				return this.calculateRectangleResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'circle':
				return this.calculateCircleResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'ellipse':
				return this.calculateEllipseResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'polygon':
			case 'star':
				return this.calculatePolygonResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'line':
			case 'arrow':
				return this.calculateLineResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'path':
				return this.calculatePathResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'text':
				// Text can be resized by changing font size
				return this.calculateTextResize(
					originalLayer, handleType, deltaX, deltaY
				);
			default:
				return null;
		}
	};

	/**
	 * Calculate ellipse resize adjustments for radiusX and radiusY
	 *
	 * @param {Object} origLayerEllipse Original layer ellipse properties
	 * @param {string} handleEllipse Handle being dragged ('e', 'w', 'n', 's', etc.)
	 * @param {number} dXEllipse Delta X movement
	 * @param {number} dYEllipse Delta Y movement
	 * @return {Object} Updates object with new radiusX/radiusY values
	 */
	CanvasManager.prototype.calculateEllipseResize = function (
		origLayerEllipse, handleEllipse, dXEllipse, dYEllipse
	) {
		const updates = {};
		const origRX = origLayerEllipse.radiusX || 1;
		const origRY = origLayerEllipse.radiusY || 1;
		if ( handleEllipse === 'e' || handleEllipse === 'w' ) {
			updates.radiusX = Math.max(
				5,
				origRX + ( handleEllipse === 'e' ? dXEllipse : -dXEllipse )
			);
		}
		if ( handleEllipse === 'n' || handleEllipse === 's' ) {
			updates.radiusY = Math.max(
				5,
				origRY + ( handleEllipse === 's' ? dYEllipse : -dYEllipse )
			);
		}
		return updates;
	};

	// Polygon/star resize: scale width/height (bounding box)
	CanvasManager.prototype.calculatePolygonResize = function (
		origLayerPoly, handlePoly, dXPoly, dYPoly
	) {
		const updates = {};
		const origRadius = origLayerPoly.radius || 50;

		// Calculate distance from center to determine new radius
		let deltaDistance = 0;

		switch ( handlePoly ) {
			case 'e':
			case 'w':
				deltaDistance = Math.abs( dXPoly );
				break;
			case 'n':
			case 's':
				deltaDistance = Math.abs( dYPoly );
				break;
			case 'ne':
			case 'nw':
			case 'se':
			case 'sw':
				// For corner handles, use the larger delta
				deltaDistance = Math.max( Math.abs( dXPoly ), Math.abs( dYPoly ) );
				break;
		}

		// Determine direction (growing or shrinking)
		let growing = false;
		switch ( handlePoly ) {
			case 'e':
				growing = dXPoly > 0;
				break;
			case 'w':
				growing = dXPoly < 0;
				break;
			case 'n':
				growing = dYPoly < 0;
				break;
			case 's':
				growing = dYPoly > 0;
				break;
			case 'ne':
				growing = dXPoly > 0 || dYPoly < 0;
				break;
			case 'nw':
				growing = dXPoly < 0 || dYPoly < 0;
				break;
			case 'se':
				growing = dXPoly > 0 || dYPoly > 0;
				break;
			case 'sw':
				growing = dXPoly < 0 || dYPoly > 0;
				break;
		}

		// Apply the change
		const newRadius = growing ?
			origRadius + deltaDistance :
			Math.max( 10, origRadius - deltaDistance );

		updates.radius = newRadius;
		return updates;
	};

	// Line/arrow resize: move x2/y2
	CanvasManager.prototype.calculateLineResize = function (
		origLayerLine, handleLine, dXLine, dYLine
	) {
		const updates = {};
		updates.x2 = ( origLayerLine.x2 || 0 ) + dXLine;
		updates.y2 = ( origLayerLine.y2 || 0 ) + dYLine;
		return updates;
	};

	// Path resize: scale all points
	CanvasManager.prototype.calculatePathResize = function (
		origLayerPath, handlePath, dXPath, dYPath
	) {
		if ( !origLayerPath.points ) {
			return null;
		}
		const updates = { points: [] };
		const scaleX = 1 + dXPath / 100;
		const scaleY = 1 + dYPath / 100;
		for ( let i = 0; i < origLayerPath.points.length; i++ ) {
			updates.points.push( {
				x: origLayerPath.points[ i ].x * scaleX,
				y: origLayerPath.points[ i ].y * scaleY
			} );
		}
		return updates;
	};

	/**
	 * Calculate rectangle resize adjustments
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @param {Object} modifiers Modifier keys state
	 * @return {Object} Updates object with new dimensions
	 */
	CanvasManager.prototype.calculateRectangleResize = function (
		originalLayer, handleType, deltaX, deltaY, modifiers
	) {
		modifiers = modifiers || {};
		const updates = {};
		const origX = originalLayer.x || 0;
		const origY = originalLayer.y || 0;
		const origW = originalLayer.width || 0;
		const origH = originalLayer.height || 0;

		// Calculate aspect ratio for proportional scaling
		let aspectRatio = origW / origH;
		const centerX = origX + origW / 2;
		const centerY = origY + origH / 2;

		if ( modifiers.proportional ) {
			// Proportional scaling: maintain aspect ratio
			// Prevent division by zero and extreme aspect ratios
			if ( aspectRatio === 0 || !isFinite( aspectRatio ) ) {
				aspectRatio = 1.0;
			}

			// Use the dimension that changed the most to drive the scaling
			const absDeltaX = Math.abs( deltaX );
			const absDeltaY = Math.abs( deltaY );

			if ( absDeltaX > absDeltaY ) {
				// X dimension changed more - scale based on X
				deltaY = deltaY < 0 ? -absDeltaX / aspectRatio : absDeltaX / aspectRatio;
			} else {
				// Y dimension changed more - scale based on Y
				deltaX = deltaX < 0 ? -absDeltaY * aspectRatio : absDeltaY * aspectRatio;
			}
		}

		switch ( handleType ) {
			case 'nw':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW - deltaX ) / 2;
					updates.y = centerY - ( origH - deltaY ) / 2;
					updates.width = origW - deltaX;
					updates.height = origH - deltaY;
				} else {
					updates.x = origX + deltaX;
					updates.y = origY + deltaY;
					updates.width = origW - deltaX;
					updates.height = origH - deltaY;
				}
				break;
			case 'ne':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW + deltaX ) / 2;
					updates.y = centerY - ( origH - deltaY ) / 2;
					updates.width = origW + deltaX;
					updates.height = origH - deltaY;
				} else {
					updates.y = origY + deltaY;
					updates.width = origW + deltaX;
					updates.height = origH - deltaY;
				}
				break;
			case 'sw':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW - deltaX ) / 2;
					updates.y = centerY - ( origH + deltaY ) / 2;
					updates.width = origW - deltaX;
					updates.height = origH + deltaY;
				} else {
					updates.x = origX + deltaX;
					updates.width = origW - deltaX;
					updates.height = origH + deltaY;
				}
				break;
			case 'se':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW + deltaX ) / 2;
					updates.y = centerY - ( origH + deltaY ) / 2;
					updates.width = origW + deltaX;
					updates.height = origH + deltaY;
				} else {
					updates.width = origW + deltaX;
					updates.height = origH + deltaY;
				}
				break;
			case 'n':
				if ( modifiers.fromCenter ) {
					updates.y = centerY - ( origH - deltaY ) / 2;
					updates.height = origH - deltaY;
				} else {
					updates.y = origY + deltaY;
					updates.height = origH - deltaY;
				}
				break;
			case 's':
				if ( modifiers.fromCenter ) {
					updates.y = centerY - ( origH + deltaY ) / 2;
					updates.height = origH + deltaY;
				} else {
					updates.height = origH + deltaY;
				}
				break;
			case 'w':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW - deltaX ) / 2;
					updates.width = origW - deltaX;
				} else {
					updates.x = origX + deltaX;
					updates.width = origW - deltaX;
				}
				break;
			case 'e':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW + deltaX ) / 2;
					updates.width = origW + deltaX;
				} else {
					updates.width = origW + deltaX;
				}
				break;
		}

		// Apply minimum size constraints
		if ( updates.width !== undefined ) {
			updates.width = Math.max( 5, updates.width );
		}
		if ( updates.height !== undefined ) {
			updates.height = Math.max( 5, updates.height );
		}

		// Prevent extreme coordinate values that could cause rendering issues
		if ( updates.x !== undefined ) {
			updates.x = Math.max( -10000, Math.min( 10000, updates.x ) );
		}
		if ( updates.y !== undefined ) {
			updates.y = Math.max( -10000, Math.min( 10000, updates.y ) );
		}
		if ( updates.width !== undefined ) {
			updates.width = Math.min( 10000, updates.width );
		}
		if ( updates.height !== undefined ) {
			updates.height = Math.min( 10000, updates.height );
		}

		return updates;
	};

	CanvasManager.prototype.calculateCircleResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		const updates = {};
		const origRadius = originalLayer.radius || 50;
		const origX = originalLayer.x || 0;
		const origY = originalLayer.y || 0;

		// Calculate new position based on handle and delta
		let handleX, handleY;
		switch ( handleType ) {
			case 'e':
				handleX = origX + origRadius + deltaX;
				handleY = origY;
				break;
			case 'w':
				handleX = origX - origRadius + deltaX;
				handleY = origY;
				break;
			case 'n':
				handleX = origX;
				handleY = origY - origRadius + deltaY;
				break;
			case 's':
				handleX = origX;
				handleY = origY + origRadius + deltaY;
				break;
			case 'ne':
				handleX = origX + origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY - origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			case 'nw':
				handleX = origX - origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY - origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			case 'se':
				handleX = origX + origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY + origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			case 'sw':
				handleX = origX - origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY + origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			default:
				return null;
		}

		// Calculate new radius based on distance from center to new handle position
		const newRadius = Math.sqrt(
			( handleX - origX ) * ( handleX - origX ) +
			( handleY - origY ) * ( handleY - origY )
		);

		updates.radius = Math.max( 5, newRadius );
		return updates;
	};

	CanvasManager.prototype.calculateTextResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		const updates = {};
		const originalFontSize = originalLayer.fontSize || 16;

		// Calculate font size change based on diagonal movement
		const diagonalDelta = Math.sqrt( deltaX * deltaX + deltaY * deltaY );
		const fontSizeChange = diagonalDelta * 0.2; // Scale factor

		// Determine if we're growing or shrinking based on handle direction
		let isGrowing = false;
		switch ( handleType ) {
			case 'se':
			case 'e':
			case 's':
				isGrowing = ( deltaX > 0 || deltaY > 0 );
				break;
			case 'nw':
			case 'w':
			case 'n':
				isGrowing = ( deltaX < 0 || deltaY < 0 );
				break;
			case 'ne':
				isGrowing = ( deltaX > 0 || deltaY < 0 );
				break;
			case 'sw':
				isGrowing = ( deltaX < 0 || deltaY > 0 );
				break;
		}

		let newFontSize = originalFontSize;
		if ( isGrowing ) {
			newFontSize += fontSizeChange;
		} else {
			newFontSize -= fontSizeChange;
		}

		// Clamp font size to reasonable bounds (minimum 6px for readability)
		newFontSize = Math.max( 6, Math.min( 144, newFontSize ) );
		updates.fontSize = Math.round( newFontSize );

		return updates;
	};

	CanvasManager.prototype.handleRotation = function ( point, event ) {
		if ( this.transformController && this.transformController.isRotating ) {
			this.transformController.handleRotation( point, event );
			return;
		}
		// Fallback for when controller is not available
		const layer = this.editor.getLayerById( this.getSelectedLayerId() );
		if ( !layer ) {
			return;
		}

		// Calculate angle from rotation center to mouse position
		const bounds = this.getLayerBounds( layer );
		if ( !bounds ) {
			return;
		}

		const centerX = bounds.centerX;
		const centerY = bounds.centerY;

		const startAngle = Math.atan2(
			this.dragStartPoint.y - centerY,
			this.dragStartPoint.x - centerX
		);
		const currentAngle = Math.atan2( point.y - centerY, point.x - centerX );

		const angleDelta = currentAngle - startAngle;
		let degrees = angleDelta * ( 180 / Math.PI );

		// Apply snap-to-angle if Shift key is held (15-degree increments)
		if ( event && event.shiftKey ) {
			const snapAngle = 15;
			degrees = Math.round( degrees / snapAngle ) * snapAngle;
		}

		// Store rotation (we'll implement actual rotation rendering later)
		layer.rotation = ( this.originalLayerState.rotation || 0 ) + degrees;

		// Re-render and emit live-transform event
		this.renderLayers( this.editor.layers );
		this.emitTransforming( layer );
	};

	CanvasManager.prototype.handleDrag = function ( point ) {
		if ( this.transformController && this.transformController.isDragging ) {
			this.transformController.handleDrag( point );
			this.showDragPreview = this.transformController.showDragPreview;
			return;
		}
		// Fallback for when controller is not available
		const deltaX = point.x - this.dragStartPoint.x;
		const deltaY = point.y - this.dragStartPoint.y;

		// Enable drag preview mode for visual feedback
		this.showDragPreview = true;

		// Support multi-selection dragging
		const layersToMove = [];
		const selectedIds = this.getSelectedLayerIds();
		if ( selectedIds.length > 1 ) {
			// Multi-selection: move all selected layers
			for ( let i = 0; i < selectedIds.length; i++ ) {
				const multiLayer = this.editor.getLayerById( selectedIds[ i ] );
				if ( multiLayer ) {
					layersToMove.push( multiLayer );
				}
			}
		} else {
			// Single selection: move just the selected layer
			const singleLayer = this.editor.getLayerById( this.getSelectedLayerId() );
			if ( singleLayer && this.originalLayerState ) {
				layersToMove.push( singleLayer );
			}
		}

		// Move all layers in the selection
		for ( let j = 0; j < layersToMove.length; j++ ) {
			const layerToMove = layersToMove[ j ];
			let originalState = this.originalLayerState;

			// For multi-selection, we need to get individual original states
			if ( selectedIds.length > 1 && this.originalMultiLayerStates ) {
				originalState = this.originalMultiLayerStates[ layerToMove.id ];
			}

			if ( !originalState ) {
				continue;
			}

			// Apply snap-to-grid if enabled
			let adjustedDeltaX = deltaX;
			let adjustedDeltaY = deltaY;

			if ( this.snapToGrid && this.gridSize > 0 ) {
				const newX = ( originalState.x || 0 ) + deltaX;
				const newY = ( originalState.y || 0 ) + deltaY;
				const snappedPoint = this.snapPointToGrid( { x: newX, y: newY } );
				adjustedDeltaX = snappedPoint.x - ( originalState.x || 0 );
				adjustedDeltaY = snappedPoint.y - ( originalState.y || 0 );
			}

			// Update layer position based on type
			this.updateLayerPosition( layerToMove, originalState, adjustedDeltaX, adjustedDeltaY );
		}

		// Re-render and emit live-transform event for the primary selected layer
		this.renderLayers( this.editor.layers );
		const active = this.editor.getLayerById( this.getSelectedLayerId() );
		if ( active ) {
			this.emitTransforming( active );
		}
	};

	/**
	 * Emit a throttled custom event with current transform values
	 * to allow the properties panel to live-sync during manipulation.
	 *
	 * @param {Object} layer The layer object to serialize and emit
	 */
	CanvasManager.prototype.emitTransforming = function ( layer ) {
		if ( !layer ) {
			return;
		}
		this.lastTransformPayload = layer;
		if ( this.transformEventScheduled ) {
			return;
		}
		this.transformEventScheduled = true;
		const self = this;
		window.requestAnimationFrame( function () {
			self.transformEventScheduled = false;
			const target = ( self.editor && self.editor.container ) || self.container || document;
			try {
				const detail = {
					id: self.lastTransformPayload.id,
					layer: JSON.parse( JSON.stringify( self.lastTransformPayload ) )
				};
				const evt = new CustomEvent( 'layers:transforming', { detail: detail } );
				target.dispatchEvent( evt );
			} catch ( e ) {
				if ( window.layersErrorHandler ) {
					window.layersErrorHandler.handleError( e, 'CanvasManager.emitTransformEvent', 'canvas' );
				}
			}
		} );
	};

	/**
	 * Update layer position during drag operation
	 *
	 * @param {Object} layer Layer to update
	 * @param {Object} originalState Original state before drag
	 * @param {number} deltaX X offset
	 * @param {number} deltaY Y offset
	 */
	CanvasManager.prototype.updateLayerPosition = function (
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
	};

	CanvasManager.prototype.updateCursor = function ( point ) {
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
			this.canvas.style.cursor = 'crosshair';
		}
	};

	CanvasManager.prototype.getLayerAtPoint = function ( point ) {
		// Delegate to HitTestController if available
		if ( this.hitTestController ) {
			return this.hitTestController.getLayerAtPoint( point );
		}

		// Fallback: Find layer at click point in visual top-most-first order
		for ( let i = 0; i < this.editor.layers.length; i++ ) {
			const layer = this.editor.layers[ i ];
			if ( layer.visible === false || layer.locked === true ) {
				continue;
			}
			if ( this.isPointInLayer( point, layer ) ) {
				return layer;
			}
		}
		return null;
	};

	CanvasManager.prototype.isPointInLayer = function ( point, layer ) {
		// Delegate to HitTestController if available
		if ( this.hitTestController ) {
			return this.hitTestController.isPointInLayer( point, layer );
		}

		// Fallback implementation
		if ( !layer ) {
			return false;
		}
		switch ( layer.type ) {
			case 'rectangle':
			case 'blur': {
				const rMinX = Math.min( layer.x, layer.x + layer.width );
				const rMinY = Math.min( layer.y, layer.y + layer.height );
				const rW = Math.abs( layer.width );
				const rH = Math.abs( layer.height );
				return point.x >= rMinX && point.x <= rMinX + rW &&
					point.y >= rMinY && point.y <= rMinY + rH;
			}
			case 'circle': {
				const dx = point.x - ( layer.x || 0 );
				const dy = point.y - ( layer.y || 0 );
				const r = layer.radius || 0;
				return ( dx * dx + dy * dy ) <= r * r;
			}
			case 'text': {
				const bounds = this.getLayerBounds( layer );
				return bounds &&
					point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
					point.y >= bounds.y && point.y <= bounds.y + bounds.height;
			}
			case 'line':
			case 'arrow':
				return this.isPointNearLine( point, layer.x1, layer.y1, layer.x2, layer.y2,
					Math.max( 6, ( layer.strokeWidth || 2 ) + 4 ) );
			case 'ellipse': {
				const ex = layer.x || 0;
				const ey = layer.y || 0;
				const radX = Math.abs( layer.radiusX || 0 );
				const radY = Math.abs( layer.radiusY || 0 );
				if ( radX === 0 || radY === 0 ) {
					return false;
				}
				const nx = ( point.x - ex ) / radX;
				const ny = ( point.y - ey ) / radY;
				return nx * nx + ny * ny <= 1;
			}
			case 'highlight': {
				const hx = Math.min( layer.x, layer.x + layer.width );
				const hy = Math.min( layer.y, layer.y + ( layer.height || 20 ) );
				const hw = Math.abs( layer.width );
				const hh = Math.abs( layer.height || 20 );
				return point.x >= hx && point.x <= hx + hw &&
					point.y >= hy && point.y <= hy + hh;
			}
			default:
				return false;
		}
	};

	CanvasManager.prototype.isPointNearLine = function ( point, x1, y1, x2, y2, tolerance ) {
		// Delegate to HitTestController if available
		if ( this.hitTestController ) {
			return this.hitTestController.isPointNearLine( point, x1, y1, x2, y2, tolerance );
		}
		// Fallback
		const dist = this.pointToSegmentDistance( point.x, point.y, x1, y1, x2, y2 );
		return dist <= ( tolerance || 6 );
	};

	CanvasManager.prototype.pointToSegmentDistance = function ( px, py, x1, y1, x2, y2 ) {
		// Delegate to HitTestController if available
		if ( this.hitTestController ) {
			return this.hitTestController.pointToSegmentDistance( px, py, x1, y1, x2, y2 );
		}
		// Fallback
		const dx = x2 - x1;
		const dy = y2 - y1;
		if ( dx === 0 && dy === 0 ) {
			return Math.sqrt( Math.pow( px - x1, 2 ) + Math.pow( py - y1, 2 ) );
		}
		let t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / ( dx * dx + dy * dy );
		t = Math.max( 0, Math.min( 1, t ) );
		const projX = x1 + t * dx;
		const projY = y1 + t * dy;
		return Math.sqrt( Math.pow( px - projX, 2 ) + Math.pow( py - projY, 2 ) );
	};

	CanvasManager.prototype.isPointInPolygon = function ( point, polygonPoints ) {
		// Delegate to HitTestController if available
		if ( this.hitTestController ) {
			return this.hitTestController.isPointInPolygon( point, polygonPoints );
		}
		// Fallback
		const x = point.x;
		const y = point.y;
		let inside = false;

		for ( let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++ ) {
			const xi = polygonPoints[ i ].x;
			const yi = polygonPoints[ i ].y;
			const xj = polygonPoints[ j ].x;
			const yj = polygonPoints[ j ].y;

			if ( ( ( yi > y ) !== ( yj > y ) ) &&
				( x < ( xj - xi ) * ( y - yi ) / ( yj - yi ) + xi ) ) {
				inside = !inside;
			}
		}

		return inside;
	};



	CanvasManager.prototype.finishResize = function () {
		if ( this.transformController && this.transformController.isResizing ) {
			this.transformController.finishResize();
			this.isResizing = false;
			this.resizeHandle = null;
			return;
		}
		// Fallback for when controller is not available
		this.isResizing = false;
		this.resizeHandle = null;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor instead of hardcoded 'default'
		this.canvas.style.cursor = this.getToolCursor( this.currentTool );

		// Mark editor as dirty
		this.editor.markDirty();
	};



	// Duplicate setZoom removed; see the later definition that clamps, updates CSS size, and status

	CanvasManager.prototype.finishRotation = function () {
		if ( this.transformController && this.transformController.isRotating ) {
			this.transformController.finishRotation();
			this.isRotating = false;
			return;
		}
		// Fallback for when controller is not available
		this.isRotating = false;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.canvas.style.cursor = this.getToolCursor( this.currentTool );

		// Mark editor as dirty
		this.editor.markDirty();
	};

	CanvasManager.prototype.finishDrag = function () {
		if ( this.transformController && this.transformController.isDragging ) {
			this.transformController.finishDrag();
			this.isDragging = false;
			this.showDragPreview = false;
			return;
		}
		// Fallback for when controller is not available
		this.isDragging = false;
		this.showDragPreview = false;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.canvas.style.cursor = this.getToolCursor( this.currentTool );

		// Mark editor as dirty
		this.editor.markDirty();
	};





	CanvasManager.prototype.zoomIn = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomIn();
		} else {
			// Fallback for when controller is not available
			const targetZoom = this.zoom + 0.2;
			this.smoothZoomTo( targetZoom );
			this.userHasSetZoom = true;
		}
	};

	CanvasManager.prototype.zoomOut = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomOut();
		} else {
			// Fallback for when controller is not available
			const targetZoom = this.zoom - 0.2;
			this.smoothZoomTo( targetZoom );
			this.userHasSetZoom = true;
		}
	};

	CanvasManager.prototype.setZoom = function ( newZoom ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.setZoom( newZoom );
		} else {
			// Fallback for when controller is not available
			this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
			this.userHasSetZoom = true;
			this.updateCanvasTransform();
			if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
				this.editor.updateStatus( { zoomPercent: this.zoom * 100 } );
			}
		}
	};

	/**
	 * Update the canvas CSS transform from current pan/zoom state.
	 */
	CanvasManager.prototype.updateCanvasTransform = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.updateCanvasTransform();
		} else {
			this.canvas.style.transform = 'translate(' + this.panX + 'px, ' +
				this.panY + 'px) scale(' + this.zoom + ')';
			this.canvas.style.transformOrigin = '0 0';
		}
	};

	CanvasManager.prototype.resetZoom = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.resetZoom();
		} else {
			// Fallback for when controller is not available
			this.panX = 0;
			this.panY = 0;
			this.userHasSetZoom = true;
			this.smoothZoomTo( 1.0 );
			if ( this.editor && this.editor.toolbar ) {
				this.editor.toolbar.updateZoomDisplay( 100 );
			}
			if ( this.editor && typeof this.editor.updateZoomReadout === 'function' ) {
				this.editor.updateZoomReadout( 100 );
			}
			if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
				this.editor.updateStatus( { zoomPercent: 100 } );
			}
		}
	};

	/**
	 * Smoothly animate zoom to a target level
	 *
	 * @param {number} targetZoom Target zoom level
	 * @param {number} duration Animation duration in milliseconds (optional)
	 */
	CanvasManager.prototype.smoothZoomTo = function ( targetZoom, duration ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.smoothZoomTo( targetZoom, duration );
		} else {
			// Fallback for when controller is not available
			targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );
			duration = duration || this.zoomAnimationDuration;
			if ( Math.abs( this.zoom - targetZoom ) < 0.01 ) {
				return;
			}
			this.isAnimatingZoom = true;
			this.zoomAnimationStartTime = performance.now();
			this.zoomAnimationStartZoom = this.zoom;
			this.zoomAnimationTargetZoom = targetZoom;
			this.zoomAnimationDuration = duration;
			this.animateZoom();
		}
	};

	/**
	 * Animation frame function for smooth zooming
	 */
	CanvasManager.prototype.animateZoom = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.animateZoom();
		} else {
			// Fallback for when controller is not available
			if ( !this.isAnimatingZoom ) {
				return;
			}
			const currentTime = performance.now();
			const elapsed = currentTime - this.zoomAnimationStartTime;
			const progress = Math.min( elapsed / this.zoomAnimationDuration, 1.0 );
			const easedProgress = 1 - Math.pow( 1 - progress, 3 );
			const currentZoom = this.zoomAnimationStartZoom +
				( this.zoomAnimationTargetZoom - this.zoomAnimationStartZoom ) * easedProgress;
			this.setZoomDirect( currentZoom );
			if ( progress < 1.0 ) {
				requestAnimationFrame( this.animateZoom.bind( this ) );
			} else {
				this.isAnimatingZoom = false;
				this.setZoomDirect( this.zoomAnimationTargetZoom );
			}
		}
	};

	/**
	 * Set zoom directly without triggering user zoom flag (for animations)
	 *
	 * @param {number} newZoom New zoom level
	 */
	CanvasManager.prototype.setZoomDirect = function ( newZoom ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.setZoomDirect( newZoom );
		} else {
			this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
			this.updateCanvasTransform();
			if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
				this.editor.updateStatus( { zoomPercent: this.zoom * 100 } );
			}
		}
	};

	CanvasManager.prototype.fitToWindow = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.fitToWindow();
		} else {
			// Fallback for when controller is not available
			if ( !this.backgroundImage ) {
				return;
			}
			const container = this.canvas.parentNode;
			const containerWidth = container.clientWidth - 40;
			const containerHeight = container.clientHeight - 40;
			const scaleX = containerWidth / this.backgroundImage.width;
			const scaleY = containerHeight / this.backgroundImage.height;
			let targetZoom = Math.min( scaleX, scaleY );
			targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );
			this.panX = 0;
			this.panY = 0;
			this.userHasSetZoom = true;
			this.smoothZoomTo( targetZoom );
			if ( this.editor && this.editor.toolbar ) {
				this.editor.toolbar.updateZoomDisplay( Math.round( targetZoom * 100 ) );
			}
		}
	};

	/**
	 * Zoom to fit all layers in the viewport
	 */
	CanvasManager.prototype.zoomToFitLayers = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomToFitLayers();
		} else {
			// Fallback for when controller is not available
			if ( !this.editor || this.editor.layers.length === 0 ) {
				this.fitToWindow();
				return;
			}
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			let hasVisibleLayers = false;
			for ( let i = 0; i < this.editor.layers.length; i++ ) {
				const layer = this.editor.layers[ i ];
				if ( !layer.visible ) {
					continue;
				}
				hasVisibleLayers = true;
				const layerBounds = this.getLayerBounds( layer );
				if ( layerBounds ) {
					minX = Math.min( minX, layerBounds.left );
					minY = Math.min( minY, layerBounds.top );
					maxX = Math.max( maxX, layerBounds.right );
					maxY = Math.max( maxY, layerBounds.bottom );
				}
			}
			if ( !hasVisibleLayers ) {
				this.fitToWindow();
				return;
			}
			const padding = 50;
			const contentWidth = ( maxX - minX ) + ( padding * 2 );
			const contentHeight = ( maxY - minY ) + ( padding * 2 );
			const container = this.canvas.parentNode;
			const containerWidth = container.clientWidth - 40;
			const containerHeight = container.clientHeight - 40;
			const scaleX = containerWidth / contentWidth;
			const scaleY = containerHeight / contentHeight;
			let targetZoom = Math.min( scaleX, scaleY );
			targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );
			const centerX = ( minX + maxX ) / 2;
			const centerY = ( minY + maxY ) / 2;
			const canvasCenterX = this.canvas.width / 2;
			const canvasCenterY = this.canvas.height / 2;
			this.panX = ( canvasCenterX - centerX ) * targetZoom;
			this.panY = ( canvasCenterY - centerY ) * targetZoom;
			this.userHasSetZoom = true;
			this.smoothZoomTo( targetZoom );
		}
	};

	/**
	 * Get bounding box of a layer
	 *
	 * @param {Object} layer Layer object
	 * @return {Object|null} Bounding box including raw and axis-aligned data
	 */
	CanvasManager.prototype.getLayerBounds = function ( layer ) {
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
	};

	CanvasManager.prototype._getRawLayerBounds = function ( layer ) {
		let rectX, rectY, safeWidth, safeHeight;
		switch ( layer.type ) {
			case 'text': {
				const textMetrics = this.measureTextLayer( layer );
				if ( !textMetrics ) {
					return null;
				}
				return {
					x: textMetrics.originX,
					y: textMetrics.originY,
					width: textMetrics.width,
					height: textMetrics.height
				};
			}
			case 'rectangle':
			case 'highlight':
			case 'blur': {
				rectX = layer.x || 0;
				rectY = layer.y || 0;
				safeWidth = layer.width || 0;
				safeHeight = layer.height || 0;
				if ( safeWidth < 0 ) {
					rectX += safeWidth;
					safeWidth = Math.abs( safeWidth );
				}
				if ( safeHeight < 0 ) {
					rectY += safeHeight;
					safeHeight = Math.abs( safeHeight );
				}
				return {
					x: rectX,
					y: rectY,
					width: safeWidth,
					height: safeHeight
				};
			}
			case 'circle': {
				const radius = Math.abs( layer.radius || 0 );
				return {
					x: ( layer.x || 0 ) - radius,
					y: ( layer.y || 0 ) - radius,
					width: radius * 2,
					height: radius * 2
				};
			}
			case 'ellipse': {
				const radiusX = Math.abs( layer.radiusX || layer.radius || 0 );
				const radiusY = Math.abs( layer.radiusY || layer.radius || 0 );
				return {
					x: ( layer.x || 0 ) - radiusX,
					y: ( layer.y || 0 ) - radiusY,
					width: radiusX * 2,
					height: radiusY * 2
				};
			}
			case 'line':
			case 'arrow': {
				const x1 = layer.x1 !== undefined ? layer.x1 : ( layer.x || 0 );
				const y1 = layer.y1 !== undefined ? layer.y1 : ( layer.y || 0 );
				const x2 = layer.x2 !== undefined ? layer.x2 : ( layer.x || 0 );
				const y2 = layer.y2 !== undefined ? layer.y2 : ( layer.y || 0 );
				return {
					x: Math.min( x1, x2 ),
					y: Math.min( y1, y2 ),
					width: Math.max( Math.abs( x2 - x1 ), 1 ),
					height: Math.max( Math.abs( y2 - y1 ), 1 )
				};
			}
			case 'polygon':
			case 'star':
			case 'path': {
				if ( Array.isArray( layer.points ) && layer.points.length >= 3 ) {
					let minX = layer.points[ 0 ].x;
					let maxX = layer.points[ 0 ].x;
					let minY = layer.points[ 0 ].y;
					let maxY = layer.points[ 0 ].y;
					for ( let i = 1; i < layer.points.length; i++ ) {
						const pt = layer.points[ i ];
						minX = Math.min( minX, pt.x );
						maxX = Math.max( maxX, pt.x );
						minY = Math.min( minY, pt.y );
						maxY = Math.max( maxY, pt.y );
					}
					return {
						x: minX,
						y: minY,
						width: Math.max( maxX - minX, 1 ),
						height: Math.max( maxY - minY, 1 )
					};
				}
				let r = layer.radius;
				if ( layer.type === 'star' && layer.outerRadius ) {
					r = layer.outerRadius;
				}
				const radiusFallback = Math.abs( r || 50 );
				return {
					x: ( layer.x || 0 ) - radiusFallback,
					y: ( layer.y || 0 ) - radiusFallback,
					width: radiusFallback * 2,
					height: radiusFallback * 2
				};
			}
			default: {
				rectX = layer.x || 0;
				rectY = layer.y || 0;
				safeWidth = Math.abs( layer.width || 50 ) || 50;
				safeHeight = Math.abs( layer.height || 50 ) || 50;
				return {
					x: rectX,
					y: rectY,
					width: safeWidth,
					height: safeHeight
				};
			}
		}
	};

	CanvasManager.prototype._computeAxisAlignedBounds = function ( rect, rotationDegrees ) {
		if ( !rect ) {
			return { left: 0, top: 0, right: 0, bottom: 0 };
		}

		const rotation = ( rotationDegrees || 0 ) * Math.PI / 180;
		if ( rotation === 0 ) {
			return {
				left: rect.x,
				top: rect.y,
				right: rect.x + rect.width,
				bottom: rect.y + rect.height
			};
		}

		const centerX = rect.x + ( rect.width / 2 );
		const centerY = rect.y + ( rect.height / 2 );
		const corners = [
			{ x: rect.x, y: rect.y },
			{ x: rect.x + rect.width, y: rect.y },
			{ x: rect.x + rect.width, y: rect.y + rect.height },
			{ x: rect.x, y: rect.y + rect.height }
		];
		const cosR = Math.cos( rotation );
		const sinR = Math.sin( rotation );
		const rotated = corners.map( function ( point ) {
			const dx = point.x - centerX;
			const dy = point.y - centerY;
			return {
				x: centerX + dx * cosR - dy * sinR,
				y: centerY + dx * sinR + dy * cosR
			};
		} );
		const xs = rotated.map( function ( point ) {
			return point.x;
		} );
		const ys = rotated.map( function ( point ) {
			return point.y;
		} );

		return {
			left: Math.min.apply( null, xs ),
			top: Math.min.apply( null, ys ),
			right: Math.max.apply( null, xs ),
			bottom: Math.max.apply( null, ys )
		};
	};

	/**
	 * Get a temporary canvas from the pool or create a new one
	 * This prevents memory leaks from constantly creating new canvas elements
	 *
	 * @param {number} width Canvas width
	 * @param {number} height Canvas height
	 * @return {Object} Object with canvas and context properties
	 */
	CanvasManager.prototype.getTempCanvas = function ( width, height ) {
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
	};

	/**
	 * Return a temporary canvas to the pool for reuse
	 *
	 * @param {Object} tempCanvasObj Object with canvas and context properties
	 */
	CanvasManager.prototype.returnTempCanvas = function ( tempCanvasObj ) {
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
	};

	/**
	 * Handle zoom tool click - zoom in at point, or zoom out with shift
	 *
	 * @param {Object} point Mouse point in canvas coordinates
	 * @param {MouseEvent} event Mouse event with modifier keys
	 */
	CanvasManager.prototype.handleZoomClick = function ( point, event ) {
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
	};

	/**
	 * Handle zoom tool drag - drag up/down to zoom in/out dynamically
	 *
	 * @param {Object} point Current mouse point
	 */
	CanvasManager.prototype.handleZoomDrag = function ( point ) {
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
	};

	/**
	 * Public zoom helper used by external handlers (wheel/pinch)
	 *
	 * @param {number} delta Positive to zoom in, negative to zoom out (in zoom units)
	 * @param {{x:number,y:number}} point Canvas coordinate under the cursor to anchor zoom around
	 */
	CanvasManager.prototype.zoomBy = function ( delta, point ) {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomBy( delta, point );
		} else {
			// Fallback for when controller is not available
			const target = Math.max( this.minZoom, Math.min( this.maxZoom, this.zoom + delta ) );
			if ( target === this.zoom ) {
				return;
			}
			const screenX = this.panX + this.zoom * point.x;
			const screenY = this.panY + this.zoom * point.y;
			this.zoom = target;
			this.panX = screenX - this.zoom * point.x;
			this.panY = screenY - this.zoom * point.y;
			this.userHasSetZoom = true;
			this.updateCanvasTransform();
		}
	};

	/**
	 * Save current state to history for undo/redo
	 * Delegates to HistoryManager for single source of truth
	 *
	 * @param {string} action Description of the action
	 */
	CanvasManager.prototype.saveState = function ( action ) {
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
	};

	/**
	 * Efficient deep clone for layers data
	 *
	 * @param {Array} layers
	 * @return {Array}
	 */
	CanvasManager.prototype.deepCloneLayers = function ( layers ) {
		// Use JSON parse/stringify for deep cloning but with optimization
		try {
			return JSON.parse( JSON.stringify( layers ) );
		} catch ( e ) {
			// Fallback to manual cloning if JSON fails
			return layers.map( function ( layer ) {
				const clone = {};
				for ( const key in layer ) {
					if ( Object.prototype.hasOwnProperty.call( layer, key ) ) {
						const value = layer[ key ];
						if ( Array.isArray( value ) ) {
							clone[ key ] = value.slice(); // Shallow copy arrays
						} else if ( typeof value === 'object' && value !== null ) {
							// Manual object copying for older JavaScript compatibility
							clone[ key ] = {};
							for ( const subKey in value ) {
								if ( Object.prototype.hasOwnProperty.call( value, subKey ) ) {
									clone[ key ][ subKey ] = value[ subKey ];
								}
							}
						} else {
							clone[ key ] = value;
						}
					}
				}
				return clone;
			} );
		}
	};

	/**
	 * Update undo/redo button states
	 * Delegates to HistoryManager for single source of truth
	 */
	CanvasManager.prototype.updateUndoRedoButtons = function () {
		// Delegate to HistoryManager via editor if available
		if ( this.editor && this.editor.historyManager &&
			typeof this.editor.historyManager.updateUndoRedoButtons === 'function' ) {
			this.editor.historyManager.updateUndoRedoButtons();
		} else if ( this.historyManager &&
			typeof this.historyManager.updateUndoRedoButtons === 'function' ) {
			this.historyManager.updateUndoRedoButtons();
		}
	};

	/**
	 * Undo last action
	 * Delegates to editor's HistoryManager for single source of truth
	 *
	 * @return {boolean} True if undo was performed
	 */
	CanvasManager.prototype.undo = function () {
		// Delegate to editor for single source of truth
		if ( this.editor && typeof this.editor.undo === 'function' ) {
			return this.editor.undo();
		}
		return false;
	};

	/**
	 * Redo last undone action
	 * Delegates to editor's HistoryManager for single source of truth
	 *
	 * @return {boolean} True if redo was performed
	 */
	CanvasManager.prototype.redo = function () {
		// Delegate to editor for single source of truth
		if ( this.editor && typeof this.editor.redo === 'function' ) {
			return this.editor.redo();
		}
		return false;
	};

	// Marquee selection methods
	CanvasManager.prototype.startMarqueeSelection = function ( point ) {
		this.isMarqueeSelecting = true;
		this.marqueeStart = { x: point.x, y: point.y };
		this.marqueeEnd = { x: point.x, y: point.y };
	};

	CanvasManager.prototype.updateMarqueeSelection = function ( point ) {
		if ( !this.isMarqueeSelecting ) {
			return;
		}

		this.marqueeEnd = { x: point.x, y: point.y };
		this.renderLayers( this.editor.layers );
		this.drawMarqueeBox();
	};

	CanvasManager.prototype.finishMarqueeSelection = function () {
		if ( !this.isMarqueeSelecting ) {
			return;
		}

		const marqueeRect = this.getMarqueeRect();
		const selectedLayers = this.getLayersInRect( marqueeRect );

		if ( selectedLayers.length > 0 ) {
			const newSelectedIds = selectedLayers.map( function ( layer ) {
				return layer.id;
			} );
			this.setSelectedLayerIds( newSelectedIds );
			this.drawMultiSelectionIndicators();
		} else {
			this.deselectAll();
		}

		this.isMarqueeSelecting = false;
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();

		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: this.getSelectedLayerIds().length } );
		}
	};

	CanvasManager.prototype.getMarqueeRect = function () {
		const x1 = Math.min( this.marqueeStart.x, this.marqueeEnd.x );
		const y1 = Math.min( this.marqueeStart.y, this.marqueeEnd.y );
		const x2 = Math.max( this.marqueeStart.x, this.marqueeEnd.x );
		const y2 = Math.max( this.marqueeStart.y, this.marqueeEnd.y );

		return {
			x: x1,
			y: y1,
			width: x2 - x1,
			height: y2 - y1
		};
	};

	CanvasManager.prototype.getLayersInRect = function ( rect ) {
		const layersInRect = [];
		const self = this;

		this.editor.layers.forEach( function ( layer ) {
			const layerBounds = self.getLayerBounds( layer );
			if ( layerBounds && self.rectsIntersect( rect, layerBounds ) ) {
				layersInRect.push( layer );
			}
		} );

		return layersInRect;
	};

	CanvasManager.prototype.rectsIntersect = function ( rect1, rect2 ) {
		const a = this._rectToAabb( rect1 );
		const b = this._rectToAabb( rect2 );
		return a.left < b.right && a.right > b.left &&
			a.top < b.bottom && a.bottom > b.top;
	};

	CanvasManager.prototype._rectToAabb = function ( rect ) {
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
	};

	// Apply opacity, blend mode, and simple effects per layer scope
	CanvasManager.prototype.applyLayerEffects = function ( layer, drawCallback ) {
		// Deprecated: Logic moved to renderer
		if ( typeof drawCallback === 'function' ) {
			drawCallback();
		}
	};

	// Wrapper: draw a single layer with effects, without creating closures in hot loops
	CanvasManager.prototype.drawLayerWithEffects = function ( layer ) {
		// Delegated to renderer
		if ( this.renderer ) {
			this.renderer.drawLayerWithEffects( layer );
		}
	};

	// Helper: run drawing with multiplied alpha (used for fill/stroke opacity)
	CanvasManager.prototype.withLocalAlpha = function ( factor, fn ) {
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
	};

	CanvasManager.prototype.drawMarqueeBox = function () {
		// Delegated to renderer
		if ( this.renderer ) {
			this.renderer.drawMarqueeBox();
		}
	};

	CanvasManager.prototype.drawSelectionIndicators = function ( layerId ) {
		// Delegated to renderer
		if ( this.renderer ) {
			this.renderer.drawSelectionIndicators( layerId );
		}
	};


	CanvasManager.prototype.drawSelectionHandles = function ( bounds, layer ) {
		// Delegated to renderer
		if ( this.renderer ) {
			this.renderer.drawSelectionHandles( bounds, layer );
		}
	};

	CanvasManager.prototype.drawRotationHandle = function ( bounds, layer ) {
		if ( this.renderer ) {
			this.renderer.drawRotationHandle( bounds, layer );
		}
	};

	// Draw background grid if enabled
	CanvasManager.prototype.drawGrid = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.drawGrid();
		} else if ( this.renderer ) {
			// Fallback: delegate directly to renderer
			this.renderer.drawGrid();
		}
	};

	CanvasManager.prototype.toggleGrid = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.toggleGrid();
		} else {
			// Fallback for when controller is not available
			this.showGrid = !this.showGrid;
			this.renderLayers( this.editor.layers );
		}
	};

	// Selection helpers
	CanvasManager.prototype.selectLayer = function ( layerId, fromPanel ) {
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
	};

	CanvasManager.prototype.selectAll = function () {
		const allIds = ( this.editor.layers || [] )
			.filter( function ( layer ) { return layer.visible !== false; } )
			.map( function ( layer ) { return layer.id; } );
		this.setSelectedLayerIds( allIds );
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: this.getSelectedLayerIds().length } );
		}
	};

	CanvasManager.prototype.deselectAll = function () {
		this.setSelectedLayerIds( [] );
		this.selectionHandles = [];
		this.rotationHandle = null;
		this.renderLayers( this.editor.layers );
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: 0, size: { width: 0, height: 0 } } );
		}
	};

	CanvasManager.prototype.handleLayerSelection = function ( point, isCtrlClick ) {
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

		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();

		// Sync selection with layer panel
		if ( this.editor && this.editor.layerPanel ) {
			this.editor.layerPanel.selectLayer( this.getSelectedLayerId(), true );
		}

		// Update status bar with selection count
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: this.getSelectedLayerIds().length } );
		}

		return hit;
	};

	CanvasManager.prototype.drawMultiSelectionIndicators = function () {
		const selectedIds = this.getSelectedLayerIds();
		if ( !selectedIds || selectedIds.length <= 1 ) {
			return;
		}
		for ( let i = 0; i < selectedIds.length; i++ ) {
			this.drawSelectionIndicators( selectedIds[ i ] );
		}
	};

	// Clipboard operations
	CanvasManager.prototype.copySelected = function () {
		// Delegate to ClipboardController if available
		if ( this.clipboardController ) {
			this.clipboardController.copySelected();
			return;
		}

		// Fallback
		const self = this;
		this.clipboard = [];
		this.getSelectedLayerIds().forEach( function ( id ) {
			const layer = self.editor.getLayerById( id );
			if ( layer ) {
				self.clipboard.push( JSON.parse( JSON.stringify( layer ) ) );
			}
		} );
	};

	CanvasManager.prototype.pasteFromClipboard = function () {
		// Delegate to ClipboardController if available
		if ( this.clipboardController ) {
			this.clipboardController.paste();
			return;
		}

		// Fallback
		if ( !this.clipboard || this.clipboard.length === 0 ) {
			return;
		}

		const self = this;
		let lastPastedId = null;
		this.editor.saveState();
		this.clipboard.forEach( function ( layer ) {
			const clone = JSON.parse( JSON.stringify( layer ) );
			// Offset pasted items slightly
			if ( clone.x !== undefined ) {
				clone.x = ( clone.x || 0 ) + 20;
			}
			if ( clone.y !== undefined ) {
				clone.y = ( clone.y || 0 ) + 20;
			}
			if ( clone.x1 !== undefined ) {
				clone.x1 = ( clone.x1 || 0 ) + 20;
			}
			if ( clone.y1 !== undefined ) {
				clone.y1 = ( clone.y1 || 0 ) + 20;
			}
			if ( clone.x2 !== undefined ) {
				clone.x2 = ( clone.x2 || 0 ) + 20;
			}
			if ( clone.y2 !== undefined ) {
				clone.y2 = ( clone.y2 || 0 ) + 20;
			}
			if ( clone.points ) {
				clone.points = clone.points.map( function ( p ) {
					return { x: p.x + 20, y: p.y + 20 };
				} );
			}
			// New id
			clone.id = ( self.editor && self.editor.generateLayerId ) ?
				self.editor.generateLayerId() :
				( 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 ) );
			// Insert pasted clone at top so it appears above others
			self.editor.layers.unshift( clone );
			lastPastedId = clone.id;
		} );

		if ( lastPastedId ) {
			this.setSelectedLayerIds( [ lastPastedId ] );
		}
		this.renderLayers( this.editor.layers );
		this.editor.markDirty();
	};

	CanvasManager.prototype.cutSelected = function () {
		// Delegate to ClipboardController if available
		if ( this.clipboardController ) {
			this.clipboardController.cutSelected();
			return;
		}

		// Fallback
		const selectedIds = this.getSelectedLayerIds();
		if ( !selectedIds || selectedIds.length === 0 ) {
			return;
		}
		this.copySelected();
		const ids = selectedIds.slice();
		this.editor.saveState();
		this.editor.layers = this.editor.layers.filter( function ( layer ) {
			return ids.indexOf( layer.id ) === -1;
		} );
		this.deselectAll();
		this.renderLayers( this.editor.layers );
		this.editor.markDirty();
	};



	// External resize hook used by editor
	CanvasManager.prototype.handleCanvasResize = function () {
		this.resizeCanvas();
		this.updateCanvasTransform();
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.getMousePoint = function ( e ) {
		return this.getMousePointFromClient( e.clientX, e.clientY );
	};

	/**
	 * Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.
	 * Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.
	 *
	 * @param {number} clientX
	 * @param {number} clientY
	 * @return {{x:number,y:number}}
	 */
	CanvasManager.prototype.getMousePointFromClient = function ( clientX, clientY ) {
		const rect = this.canvas.getBoundingClientRect();
		// Position within the displayed (transformed) element
		const relX = clientX - rect.left;
		const relY = clientY - rect.top;
		// Scale to logical canvas pixels
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;
		let canvasX = relX * scaleX;
		let canvasY = relY * scaleY;

		if ( this.snapToGrid && this.gridSize > 0 ) {
			const gridSize = this.gridSize;
			canvasX = Math.round( canvasX / gridSize ) * gridSize;
			canvasY = Math.round( canvasY / gridSize ) * gridSize;
		}

		return { x: canvasX, y: canvasY };
	};

	// Raw mapping without snapping, useful for ruler hit testing
	CanvasManager.prototype.getRawClientPoint = function ( e ) {
		const rect = this.canvas.getBoundingClientRect();
		const clientX = e.clientX - rect.left;
		const clientY = e.clientY - rect.top;
		return {
			canvasX: ( clientX - ( this.panX || 0 ) ) / this.zoom,
			canvasY: ( clientY - ( this.panY || 0 ) ) / this.zoom
		};
	};

	CanvasManager.prototype.addHorizontalGuide = function ( y ) {
		if ( typeof y !== 'number' ) {
			return;
		}
		if ( this.horizontalGuides.indexOf( y ) === -1 ) {
			this.horizontalGuides.push( y );
		}
	};

	CanvasManager.prototype.addVerticalGuide = function ( x ) {
		if ( typeof x !== 'number' ) {
			return;
		}
		if ( this.verticalGuides.indexOf( x ) === -1 ) {
			this.verticalGuides.push( x );
		}
	};

	CanvasManager.prototype.toggleRulers = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.toggleRulers();
		} else {
			// Fallback for when controller is not available
			this.showRulers = !this.showRulers;
			this.renderLayers( this.editor.layers );
		}
	};

	CanvasManager.prototype.toggleGuidesVisibility = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.toggleGuidesVisibility();
		} else {
			// Fallback for when controller is not available
			this.showGuides = !this.showGuides;
			this.renderLayers( this.editor.layers );
		}
	};

	CanvasManager.prototype.toggleSnapToGrid = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.toggleSnapToGrid();
		} else {
			this.snapToGrid = !this.snapToGrid;
		}
	};

	CanvasManager.prototype.toggleSnapToGuides = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.toggleSnapToGuides();
		} else {
			this.snapToGuides = !this.snapToGuides;
		}
	};

	CanvasManager.prototype.toggleSmartGuides = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.toggleSmartGuides();
		} else {
			this.smartGuides = !this.smartGuides;
		}
	};

	CanvasManager.prototype.startDrawing = function ( point ) {
		// Use current style options if available
		const style = this.currentStyle || {};

		// Delegate to DrawingController if available
		if ( this.drawingController ) {
			this.drawingController.startDrawing( point, this.currentTool, style );
			// Sync tempLayer for backward compatibility
			this.tempLayer = this.drawingController.getTempLayer();
			return;
		}

		// Fallback: Reset any previous temp layer
		this.tempLayer = null;

		// Prepare for drawing based on current tool
		switch ( this.currentTool ) {
			case 'blur':
				this.startBlurTool( point, style );
				break;
			case 'text':
				this.startTextTool( point, style );
				break;
			case 'pen':
				this.startPenTool( point, style );
				break;
			case 'rectangle':
				this.startRectangleTool( point, style );
				break;
			case 'circle':
				this.startCircleTool( point, style );
				break;
			case 'ellipse':
				this.startEllipseTool( point, style );
				break;
			case 'polygon':
				this.startPolygonTool( point, style );
				break;
			case 'star':
				this.startStarTool( point, style );
				break;
			case 'line':
				this.startLineTool( point, style );
				break;
			case 'arrow':
				this.startArrowTool( point, style );
				break;
			case 'highlight':
				this.startHighlightTool( point, style );
				break;
			default:
		}
	};

	CanvasManager.prototype.continueDrawing = function ( point ) {
		// Delegate to DrawingController if available
		if ( this.drawingController ) {
			this.drawingController.continueDrawing( point );
			this.tempLayer = this.drawingController.getTempLayer();
			if ( this.tempLayer ) {
				this.renderLayers( this.editor.layers );
				this.drawingController.drawPreview();
			}
			return;
		}

		// Fallback: Continue drawing based on current tool
		if ( this.tempLayer ) {
			this.renderLayers( this.editor.layers );
			this.drawPreview( point );
		}
	};

	CanvasManager.prototype.finishDrawing = function ( point ) {
		// Delegate to DrawingController if available
		if ( this.drawingController ) {
			const layerData = this.drawingController.finishDrawing( point, this.currentTool );
			this.tempLayer = null;
			if ( layerData ) {
				this.editor.addLayer( layerData );
				if ( typeof this.editor.setCurrentTool === 'function' ) {
					this.editor.setCurrentTool( 'pointer' );
				}
			}
			this.renderLayers( this.editor.layers );
			return;
		}

		// Fallback: Finish drawing and create layer
		let layerData = this.createLayerFromDrawing( point );
		if ( layerData ) {
			// Convert rectangle to blur layer when blur tool is active
			if ( this.currentTool === 'blur' ) {
				if ( layerData.type === 'rectangle' ) {
					layerData = {
						type: 'blur',
						x: layerData.x,
						y: layerData.y,
						width: layerData.width,
						height: layerData.height,
						blurRadius: 12
					};
				}
			}
			this.editor.addLayer( layerData );
			if ( typeof this.editor.setCurrentTool === 'function' ) {
				this.editor.setCurrentTool( 'pointer' );
			}
		}

		// Clean up
		this.tempLayer = null;
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.startTextTool = function ( point, style ) {
		// Create a more sophisticated text input dialog

		// Create modal for text input
		const modal = this.createTextInputModal( point, style );
		document.body.appendChild( modal );

		// Focus on text input
		const textInput = modal.querySelector( '.text-input' );
		textInput.focus();

		this.isDrawing = false;
	};

	CanvasManager.prototype.startPenTool = function ( point, style ) {
		// Create a path for free-hand drawing
		this.tempLayer = {
			type: 'path',
			points: [ point ],
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'none'
		};
	};

	CanvasManager.prototype.createTextInputModal = function ( point, style ) {
		const self = this;

		// Create modal overlay
		const overlay = document.createElement( 'div' );
		overlay.className = 'text-input-overlay';
		overlay.style.cssText =
			'position: fixed;' +
			'top: 0;' +
			'left: 0;' +
			'width: 100%;' +
			'height: 100%;' +
			'background: rgba(0, 0, 0, 0.5);' +
			'z-index: 1000000;' +
			'display: flex;' +
			'align-items: center;' +
			'justify-content: center;';

		// Create modal content
		const modal = document.createElement( 'div' );
		modal.className = 'text-input-modal';
		modal.style.cssText =
			'background: white;' +
			'border-radius: 8px;' +
			'padding: 20px;' +
			'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);' +
			'min-width: 300px;';

		modal.innerHTML =
			'<h3 style="margin: 0 0 15px 0;">Add Text</h3>' +
			'<textarea class="text-input" placeholder="Enter your text..." style="' +
				'width: 100%; ' +
				'height: 80px; ' +
				'border: 1px solid #ddd; ' +
				'border-radius: 4px; ' +
				'padding: 8px;' +
				'font-family: inherit;' +
				'resize: vertical;' +
			'"></textarea>' +
			'<div style="margin: 15px 0;">' +
				'<label style="display: block; margin-bottom: 5px;">Font Family:</label>' +
				'<select class="font-family-input" style="' +
					'width: 150px;' +
					'padding: 4px 8px;' +
					'border: 1px solid #ddd;' +
					'border-radius: 4px;' +
					'margin-bottom: 10px;' +
				'">' +
					'<option value="Arial, sans-serif">Arial</option>' +
					'<option value="Georgia, serif">Georgia</option>' +
					'<option value="Times New Roman, serif">Times New Roman</option>' +
					'<option value="Verdana, sans-serif">Verdana</option>' +
					'<option value="Helvetica, sans-serif">Helvetica</option>' +
					'<option value="Courier New, monospace">Courier New</option>' +
					'<option value="Impact, sans-serif">Impact</option>' +
					'<option value="Comic Sans MS, cursive">Comic Sans MS</option>' +
				'</select>' +
				'<br>' +
				'<label style="display: inline-block; margin-bottom: 5px; margin-right: 10px;">Font Size:</label>' +
				'<input type="number" class="font-size-input" value="' + ( style.fontSize || 16 ) + '" min="8" max="72" style="' +
					'width: 80px;' +
					'padding: 4px 8px;' +
					'border: 1px solid #ddd;' +
					'border-radius: 4px;' +
				'">' +
				'<label style="display: inline-block; margin-left: 15px; margin-right: 5px;">Color:</label>' +
				'<input type="color" class="color-input" value="' + ( style.color || '#000000' ) + '" style="' +
					'width: 40px;' +
					'height: 30px;' +
					'border: 1px solid #ddd;' +
					'border-radius: 4px;' +
				'">' +
				'<br><br>' +
				'<label style="display: inline-block; margin-bottom: 5px; margin-right: 10px;">Stroke Width:</label>' +
				'<input type="number" class="stroke-width-input" value="' + ( style.textStrokeWidth || 0 ) + '" min="0" max="10" step="0.5" style="' +
					'width: 80px;' +
					'padding: 4px 8px;' +
					'border: 1px solid #ddd;' +
					'border-radius: 4px;' +
				'">' +
				'<label style="display: inline-block; margin-left: 15px; margin-right: 5px;">Stroke Color:</label>' +
				'<input type="color" class="stroke-color-input" value="' + ( style.textStrokeColor || '#000000' ) + '" style="' +
					'width: 40px;' +
					'height: 30px;' +
					'border: 1px solid #ddd;' +
					'border-radius: 4px;' +
				'">' +
				'<br><br>' +
				'<label style="display: block; margin-bottom: 5px;">Text Alignment:</label>' +
				'<div class="text-align-buttons" style="display: flex; gap: 5px; margin-bottom: 10px;">' +
					'<button type="button" class="align-btn align-left active" data-align="left" style="' +
						'padding: 6px 12px;' +
						'border: 1px solid #ddd;' +
						'background: #e9ecef;' +
						'border-radius: 4px;' +
						'cursor: pointer;' +
					'">Left</button>' +
					'<button type="button" class="align-btn align-center" data-align="center" style="' +
						'padding: 6px 12px;' +
						'border: 1px solid #ddd;' +
						'background: #f8f9fa;' +
						'border-radius: 4px;' +
						'cursor: pointer;' +
					'">Center</button>' +
					'<button type="button" class="align-btn align-right" data-align="right" style="' +
						'padding: 6px 12px;' +
						'border: 1px solid #ddd;' +
						'background: #f8f9fa;' +
						'border-radius: 4px;' +
						'cursor: pointer;' +
					'">Right</button>' +
				'</div>' +
			'</div>' +
			'<div style="text-align: right; margin-top: 20px;">' +
				'<button class="cancel-btn" style="' +
					'background: #f8f9fa;' +
					'border: 1px solid #ddd;' +
					'border-radius: 4px;' +
					'padding: 8px 16px;' +
					'margin-right: 10px;' +
					'cursor: pointer;' +
				'">Cancel</button>' +
				'<button class="add-btn" style="' +
					'background: #007bff;' +
					'color: white;' +
					'border: 1px solid #007bff;' +
					'border-radius: 4px;' +
					'padding: 8px 16px;' +
					'cursor: pointer;' +
				'">Add Text</button>' +
			'</div>';

		overlay.appendChild( modal );

		// Query DOM elements from the modal
		const textInput = modal.querySelector( '.text-input' );
		const fontFamilyInput = modal.querySelector( '.font-family-input' );
		const fontSizeInput = modal.querySelector( '.font-size-input' );
		const colorInput = modal.querySelector( '.color-input' );
		const strokeWidthInput = modal.querySelector( '.stroke-width-input' );
		const strokeColorInput = modal.querySelector( '.stroke-color-input' );
		const alignButtons = modal.querySelectorAll( '.align-btn' );
		const addBtn = modal.querySelector( '.add-btn' );
		const cancelBtn = modal.querySelector( '.cancel-btn' );

		// Set default font family if provided in style
		if ( fontFamilyInput && style.fontFamily ) {
			fontFamilyInput.value = style.fontFamily;
		}

		// Handle text alignment button clicks
		let currentAlignment = 'left';
		alignButtons.forEach( function ( btn ) {
			btn.addEventListener( 'click', function ( e ) {
				e.preventDefault();

				// Remove active state from all buttons
				alignButtons.forEach( function ( b ) {
					b.style.background = '#f8f9fa';
				} );

				// Set active state for clicked button
				this.style.background = '#e9ecef';
				currentAlignment = this.dataset.align;
			} );
		} );

		function addText() {
			const text = textInput.value.trim();
			if ( text ) {
				const layerData = {
					type: 'text',
					text: text,
					x: point.x,
					y: point.y,
					fontSize: parseInt( fontSizeInput.value ) || 16,
					fontFamily: fontFamilyInput.value || 'Arial, sans-serif',
					textAlign: currentAlignment,
					fill: colorInput.value,
					textStrokeColor: strokeColorInput.value || '#000000',
					textStrokeWidth: parseFloat( strokeWidthInput.value ) || 0,
					textShadow: style.textShadow || false,
					textShadowColor: style.textShadowColor || '#000000'
				};
				self.editor.addLayer( layerData );
				if ( typeof self.editor.setCurrentTool === 'function' ) {
					self.editor.setCurrentTool( 'pointer' );
				}
			}
			document.body.removeChild( overlay );
		}

		function cancel() {
			document.body.removeChild( overlay );
		}

		addBtn.addEventListener( 'click', addText );
		cancelBtn.addEventListener( 'click', cancel );

		// Allow Enter to add text (but not Shift+Enter for new lines)
		textInput.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Enter' && !e.shiftKey ) {

				e.preventDefault();
				addText();
			} else if ( e.key === 'Escape' ) {
				cancel();
			}
		} );

		// Click outside to cancel
		overlay.addEventListener( 'click', function ( e ) {
			if ( e.target === overlay ) {
				cancel();
			}
		} );

		return overlay;
	};

	CanvasManager.prototype.startRectangleTool = function ( point, style ) {
		// Store starting point for rectangle
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'rectangle',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	};

	CanvasManager.prototype.startCircleTool = function ( point, style ) {
		// Store starting point for circle
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'circle',
			x: point.x,
			y: point.y,
			radius: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	};

	CanvasManager.prototype.startLineTool = function ( point, style ) {
		this.tempLayer = {
			type: 'line',
			x1: point.x,
			y1: point.y,
			x2: point.x,
			y2: point.y,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2
		};
	};

	CanvasManager.prototype.startArrowTool = function ( point, style ) {
		this.tempLayer = {
			type: 'arrow',
			x1: point.x,
			y1: point.y,
			x2: point.x,
			y2: point.y,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			arrowSize: 10,
			arrowStyle: style.arrowStyle || 'single'
		};
	};

	CanvasManager.prototype.startHighlightTool = function ( point, style ) {
		this.tempLayer = {
			type: 'highlight',
			x: point.x,
			y: point.y,
			width: 0,
			height: 20, // Default highlight height
			fill: style.color ? style.color + '80' : '#ffff0080' // Add transparency
		};
	};

	CanvasManager.prototype.startEllipseTool = function ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'ellipse',
			x: point.x,
			y: point.y,
			radiusX: 0,
			radiusY: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	};

	CanvasManager.prototype.startPolygonTool = function ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'polygon',
			x: point.x,
			y: point.y,
			radius: 0,
			sides: 6, // Default hexagon
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	};

	CanvasManager.prototype.startStarTool = function ( point, style ) {
		const fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
			style.fill : 'transparent';
		this.tempLayer = {
			type: 'star',
			x: point.x,
			y: point.y,
			radius: 0,
			outerRadius: 0,
			innerRadius: 0,
			points: 5, // Default 5-pointed star
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: fillColor
		};
	};

	CanvasManager.prototype.drawPreview = function ( point ) {
		if ( !this.tempLayer ) {
			return;
		}

		// Update temp layer geometry based on current mouse point
		let dx, dy;
		switch ( this.tempLayer.type ) {
			case 'rectangle':
				this.tempLayer.width = point.x - this.tempLayer.x;
				this.tempLayer.height = point.y - this.tempLayer.y;
				break;
			case 'circle':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'ellipse':
				this.tempLayer.radiusX = Math.abs( point.x - this.tempLayer.x );
				this.tempLayer.radiusY = Math.abs( point.y - this.tempLayer.y );
				break;
			case 'polygon':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'star':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.outerRadius = Math.sqrt( dx * dx + dy * dy );
				this.tempLayer.radius = this.tempLayer.outerRadius;
				this.tempLayer.innerRadius = this.tempLayer.outerRadius * 0.5;
				break;
			case 'line':
				this.tempLayer.x2 = point.x;
				this.tempLayer.y2 = point.y;
				break;
			case 'arrow':
				this.tempLayer.x2 = point.x;
				this.tempLayer.y2 = point.y;
				break;
			case 'highlight':
				this.tempLayer.width = point.x - this.tempLayer.x;
				break;
			case 'path':
				// Add point to path for pen tool
				this.tempLayer.points.push( point );
				break;
		}

		// Draw the temp layer using renderer
		if ( this.renderer ) {
			this.renderer.drawLayer( this.tempLayer );
		}
	};

	CanvasManager.prototype.createLayerFromDrawing = function ( point ) {
		if ( !this.tempLayer ) {
			return null;
		}

		const layer = this.tempLayer;
		this.tempLayer = null;

		// Final adjustments based on tool type
		let dx, dy;
		switch ( layer.type ) {
			case 'rectangle':
				layer.width = point.x - layer.x;
				layer.height = point.y - layer.y;
				break;
			case 'circle':
				dx = point.x - layer.x;
				dy = point.y - layer.y;
				layer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'ellipse':
				layer.radiusX = Math.abs( point.x - layer.x );
				layer.radiusY = Math.abs( point.y - layer.y );
				break;
			case 'polygon':
				dx = point.x - layer.x;
				dy = point.y - layer.y;
				layer.radius = Math.sqrt( dx * dx + dy * dy );
				break;
			case 'star':
				dx = point.x - layer.x;
				dy = point.y - layer.y;
				layer.outerRadius = Math.sqrt( dx * dx + dy * dy );
				layer.innerRadius = layer.outerRadius * 0.5;
				layer.radius = layer.outerRadius;
				break;
			case 'line':
				layer.x2 = point.x;
				layer.y2 = point.y;
				break;
			case 'arrow':
				layer.x2 = point.x;
				layer.y2 = point.y;
				break;
			case 'highlight':
				layer.width = point.x - layer.x;
				break;
			case 'path':
				// Path is already complete
				break;
		}

		// Don't create tiny shapes
		if ( layer.type === 'rectangle' && ( Math.abs( layer.width ) < 5 || Math.abs( layer.height ) < 5 ) ) {
			return null;
		}
		if ( layer.type === 'circle' && layer.radius < 5 ) {
			return null;
		}
		if ( ( layer.type === 'line' || layer.type === 'arrow' ) &&
			Math.sqrt( Math.pow( layer.x2 - layer.x1, 2 ) +
				Math.pow( layer.y2 - layer.y1, 2 ) ) < 5 ) {
			return null;
		}
		if ( layer.type === 'path' && layer.points.length < 2 ) {
			return null;
		}

		return layer;
	};

	CanvasManager.prototype.setTool = function ( tool ) {
		this.currentTool = tool;
		this.canvas.style.cursor = this.getToolCursor( tool );
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { tool: tool } );
		}
	};

	CanvasManager.prototype.getToolCursor = function ( tool ) {
		// Delegate to DrawingController if available
		if ( this.drawingController ) {
			return this.drawingController.getToolCursor( tool );
		}

		// Fallback
		switch ( tool ) {
			case 'blur': return 'crosshair';
			case 'text': return 'text';
			case 'pen': return 'crosshair';
			case 'rectangle':
			case 'circle':
			case 'ellipse':
			case 'polygon':
			case 'star':
			case 'line':
			case 'arrow':
			case 'highlight':
				return 'crosshair';
			default: return 'default';
		}
	};

	/**
	 * Update current drawing style from toolbar and optionally apply to selection
	 *
	 * @param {Object} options
	 */
	CanvasManager.prototype.updateStyleOptions = function ( options ) {
		this.currentStyle = this.currentStyle || {};
		const prev = this.currentStyle;
		const has = function ( v ) {
			return v !== undefined && v !== null;
		};
		const next = {
			color: has( options.color ) ? options.color : prev.color,
			fill: has( options.fill ) ? options.fill : prev.fill,
			strokeWidth: has( options.strokeWidth ) ? options.strokeWidth : prev.strokeWidth,
			fontSize: has( options.fontSize ) ? options.fontSize : prev.fontSize,
			fontFamily: prev.fontFamily || 'Arial, sans-serif',
			textStrokeColor: has( options.textStrokeColor ) ?
				options.textStrokeColor : prev.textStrokeColor,
			textStrokeWidth: has( options.textStrokeWidth ) ?
				options.textStrokeWidth : prev.textStrokeWidth,
			textShadow: has( options.textShadow ) ? options.textShadow : prev.textShadow,
			textShadowColor: has( options.textShadowColor ) ?
				options.textShadowColor : prev.textShadowColor,
			arrowStyle: has( options.arrowStyle ) ? options.arrowStyle : prev.arrowStyle,
			// Add general shadow properties for all layer types
			shadow: has( options.shadow ) ? options.shadow : prev.shadow,
			shadowColor: has( options.shadowColor ) ? options.shadowColor : prev.shadowColor,
			shadowBlur: has( options.shadowBlur ) ? options.shadowBlur : prev.shadowBlur,
			shadowOffsetX: has( options.shadowOffsetX ) ? options.shadowOffsetX : prev.shadowOffsetX,
			shadowOffsetY: has( options.shadowOffsetY ) ? options.shadowOffsetY : prev.shadowOffsetY
		};
		this.currentStyle = next;

		// Live-apply style updates to selected layer(s) where sensible
		const applyToLayer = function ( layer ) {
			if ( !layer ) {
				return;
			}
			// Stroke/fill for shapes and lines
			if ( next.color ) {
				if ( layer.type === 'text' ) {
					layer.fill = next.color;
				} else if ( layer.type === 'highlight' ) {
					layer.fill = next.color;
				} else {
					layer.stroke = next.color;
				}
			}
			if ( next.fill ) {
				if ( layer.type !== 'text' && layer.type !== 'line' && layer.type !== 'arrow' ) {
					layer.fill = next.fill;
				}
			}
			if ( next.strokeWidth !== undefined && next.strokeWidth !== null ) {
				layer.strokeWidth = next.strokeWidth;
			}
			if ( layer.type === 'text' ) {
				if ( next.fontSize !== undefined && next.fontSize !== null ) {
					layer.fontSize = next.fontSize;
				}
				if ( next.textStrokeWidth !== undefined && next.textStrokeWidth !== null ) {
					layer.textStrokeWidth = next.textStrokeWidth;
				}
				if ( next.textStrokeColor ) {
					layer.textStrokeColor = next.textStrokeColor;
				}
				if ( next.textShadow !== undefined && next.textShadow !== null ) {
					layer.textShadow = next.textShadow;
				}
				if ( next.textShadowColor ) {
					layer.textShadowColor = next.textShadowColor;
				}
			}
			if ( layer.type === 'arrow' && next.arrowStyle ) {
				layer.arrowStyle = next.arrowStyle;
			}
			// Apply general shadow properties to all layer types
			if ( next.shadow !== undefined && next.shadow !== null ) {
				layer.shadow = next.shadow;
			}
			if ( next.shadowColor !== undefined && next.shadowColor !== null ) {
				layer.shadowColor = next.shadowColor;
			}
			if ( next.shadowBlur !== undefined && next.shadowBlur !== null ) {
				layer.shadowBlur = next.shadowBlur;
			}
			if ( next.shadowOffsetX !== undefined && next.shadowOffsetX !== null ) {
				layer.shadowOffsetX = next.shadowOffsetX;
			}
			if ( next.shadowOffsetY !== undefined && next.shadowOffsetY !== null ) {
				layer.shadowOffsetY = next.shadowOffsetY;
			}
		};

		const selectedIds = this.getSelectedLayerIds();
		if ( selectedIds && selectedIds.length ) {
			for ( let i = 0; i < selectedIds.length; i++ ) {
				applyToLayer( this.editor.getLayerById( selectedIds[ i ] ) );
			}
			this.renderLayers( this.editor.layers );
		}

		// Reflect selection count in status bar
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selection: selectedIds.length } );
		}
	};

	CanvasManager.prototype.renderLayers = function ( layers ) {
		this.redraw( layers );
	};

	CanvasManager.prototype.redraw = function ( layers ) {
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
			this.renderer.setGuides( this.showGuides, this.horizontalGuides, this.verticalGuides );
			
			// Grid and Rulers
			this.renderer.showGrid = this.showGrid;
			this.renderer.gridSize = this.gridSize;
			this.renderer.showRulers = this.showRulers;
			this.renderer.rulerSize = this.rulerSize;

			// Drag guide state
			if ( this.isDraggingGuide ) {
				this.renderer.setDragGuide( this.dragGuideOrientation, this.dragGuidePos );
			} else {
				this.renderer.setDragGuide( null );
			}

			// Perform redraw
			const layersToDraw = layers || ( ( this.editor && this.editor.layers ) ? this.editor.layers : [] );
			this.renderer.redraw( layersToDraw );

		} catch ( error ) {
			if ( this.editor && this.editor.errorLog ) {
				this.editor.errorLog( 'Canvas redraw failed:', error );
			}
		}
	};

	CanvasManager.prototype.redrawOptimized = function () {
		// Optimize redraws using requestAnimationFrame
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
			setTimeout( function () {
				this.redraw();
				this.redrawScheduled = false;
			}.bind( this ), 16 ); // ~60fps
		}
	};

	CanvasManager.prototype.updateViewportBounds = function () {
		// Update viewport bounds for layer culling
		this.viewportBounds.x = 0;
		this.viewportBounds.y = 0;
		this.viewportBounds.width = this.canvas.width;
		this.viewportBounds.height = this.canvas.height;
	};

	CanvasManager.prototype.isLayerInViewport = function ( layer ) {
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
	};


	CanvasManager.prototype.drawLayer = function ( layer ) {
		// Skip invisible layers
		if ( layer.visible === false ) {
			return;
		}

		try {
			switch ( layer.type ) {
				case 'blur':
					this.drawBlur( layer );
					break;
				case 'text':
					this.drawText( layer );
					break;
				case 'rectangle':
					this.drawRectangle( layer );
					break;
				case 'circle':
					this.drawCircle( layer );
					break;
				case 'ellipse':
					this.drawEllipse( layer );
					break;
				case 'polygon':
					this.drawPolygon( layer );
					break;
				case 'star':
					this.drawStar( layer );
					break;
				case 'line':
					this.drawLine( layer );
					break;
				case 'arrow':
					this.drawArrow( layer );
					break;
				case 'highlight':
					this.drawHighlight( layer );
					break;
				case 'path':
					this.drawPath( layer );
					break;
			}
		} catch ( error ) {
			// Error recovery for layer drawing
			if ( this.editor && this.editor.errorLog ) {
				this.editor.errorLog( 'Layer drawing failed for', layer.type, 'layer:', error );
			}

			// Draw error placeholder for the layer
			try {
								if ( this.renderer ) {
					this.renderer.drawErrorPlaceholder( layer );
				}
			} catch ( recoveryError ) {
				if ( window.mw && window.mw.log && typeof window.mw.log.error === 'function' ) {
					window.mw.log.error( 'Layers: Layer error recovery failed:', recoveryError );
				} else if ( this.editor && typeof this.editor.errorLog === 'function' ) {
					this.editor.errorLog( 'Layer error recovery failed:', recoveryError );
				}
			}
		}
	};

	CanvasManager.prototype.startBlurTool = function ( point, style ) {
		// Use rectangle preview for blur region
		this.tempLayer = {
			type: 'rectangle',
			x: point.x,
			y: point.y,
			width: 0,
			height: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'transparent'
		};
	};

	CanvasManager.prototype.drawBlur = function ( layer ) {
		// Delegated to renderer
		if ( this.renderer ) {
			this.renderer.drawBlur( layer );
		}
	};

	// Draw rulers (top and left bars with ticks)
	CanvasManager.prototype.drawRulers = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.drawRulers();
		} else if ( this.renderer ) {
			// Fallback: delegate directly to renderer
			this.renderer.drawRulers();
		}
	};

	CanvasManager.prototype.drawGuides = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.drawGuides();
		} else if ( this.renderer ) {
			// Fallback: delegate directly to renderer
			this.renderer.drawGuides();
		}
	};

	CanvasManager.prototype.drawGuidePreview = function () {
		if ( this.gridRulersController ) {
			this.gridRulersController.drawGuidePreview();
		} else if ( this.renderer ) {
			// Fallback: delegate directly to renderer
			this.renderer.drawGuidePreview();
		}
	};

	CanvasManager.prototype.getGuideSnapDelta = function ( bounds, deltaX, deltaY, tol ) {
		if ( this.gridRulersController ) {
			return this.gridRulersController.getGuideSnapDelta( bounds, deltaX, deltaY, tol );
		}
		// Fallback for when controller is not available
		tol = tol || 6;
		let dx = 0;
		let dy = 0;
		if ( this.verticalGuides && this.verticalGuides.length ) {
			const left = ( bounds.x || 0 ) + deltaX;
			const right = left + ( bounds.width || 0 );
			const centerX = left + ( bounds.width || 0 ) / 2;
			for ( let i = 0; i < this.verticalGuides.length; i++ ) {
				const gx = this.verticalGuides[ i ];
				if ( Math.abs( gx - left ) <= tol ) {
					dx = gx - left;
					break;
				}
				if ( Math.abs( gx - right ) <= tol ) {
					dx = gx - right;
					break;
				}
				if ( Math.abs( gx - centerX ) <= tol ) {
					dx = gx - centerX;
					break;
				}
			}
		}
		if ( this.horizontalGuides && this.horizontalGuides.length ) {
			const top = ( bounds.y || 0 ) + deltaY;
			const bottom = top + ( bounds.height || 0 );
			const centerY = top + ( bounds.height || 0 ) / 2;
			for ( let j = 0; j < this.horizontalGuides.length; j++ ) {
				const gy = this.horizontalGuides[ j ];
				if ( Math.abs( gy - top ) <= tol ) {
					dy = gy - top;
					break;
				}
				if ( Math.abs( gy - bottom ) <= tol ) {
					dy = gy - bottom;
					break;
				}
				if ( Math.abs( gy - centerY ) <= tol ) {
					dy = gy - centerY;
					break;
				}
			}
		}
		return { dx: dx, dy: dy };
	};

	CanvasManager.prototype.sanitizeTextContent = function ( text ) {
		let safeText = text == null ? '' : String( text );
		safeText = safeText.replace( /[^\x20-\x7E\u00A0-\uFFFF]/g, '' );
		safeText = safeText.replace( /<[^>]+>/g, '' );
		return safeText;
	};

	/**
	 * Helper function to wrap text into multiple lines
	 *
	 * @param {string} text The text to wrap
	 * @param {number} maxWidth Maximum width in pixels
	 * @param {CanvasRenderingContext2D} ctx Canvas context for measuring text
	 * @return {Array} Array of text lines
	 */
	CanvasManager.prototype.wrapText = function ( text, maxWidth, ctx ) {
		if ( !text || !maxWidth || maxWidth <= 0 ) {
			return [ text || '' ];
		}

		const words = text.split( ' ' );
		const lines = [];
		let currentLine = '';

		for ( let i = 0; i < words.length; i++ ) {
			const word = words[ i ];
			const testLine = currentLine + ( currentLine ? ' ' : '' ) + word;
			const metrics = ctx.measureText( testLine );
			const testWidth = metrics.width;

			if ( testWidth > maxWidth && currentLine !== '' ) {
				// Current line is full, start a new line
				lines.push( currentLine );
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}

		// Add the last line
		if ( currentLine ) {
			lines.push( currentLine );
		}

		return lines.length > 0 ? lines : [ '' ];
	};

	CanvasManager.prototype.measureTextLayer = function ( layer ) {
		if ( !layer ) {
			return null;
		}

		const fontSize = layer.fontSize || 16;
		const fontFamily = layer.fontFamily || 'Arial';
		const sanitizedText = this.sanitizeTextContent( layer.text || '' );
		const lineHeight = fontSize * 1.2;
		const context = this.ctx;
		const canvasWidth = this.canvas ? this.canvas.width : 0;
		const maxLineWidth = layer.maxWidth || ( canvasWidth ? canvasWidth * 0.8 : fontSize * Math.max( sanitizedText.length, 1 ) );

		if ( !context ) {
			return {
				lines: [ sanitizedText ],
				fontSize: fontSize,
				fontFamily: fontFamily,
				lineHeight: lineHeight,
				width: Math.max( sanitizedText.length * fontSize * 0.6, fontSize ),
				height: lineHeight,
				originX: layer.x || 0,
				originY: ( layer.y || 0 ) - fontSize,
				ascent: fontSize,
				descent: fontSize * 0.2,
				baselineY: layer.y || 0
			};
		}

		context.save();
		context.font = fontSize + 'px ' + fontFamily;
		let lines = this.wrapText( sanitizedText, maxLineWidth, context );
		if ( !lines.length ) {
			lines = [ '' ];
		}

		let totalTextWidth = 0;
		let metricsForLongest = null;
		for ( let i = 0; i < lines.length; i++ ) {
			const lineMetrics = context.measureText( lines[ i ] || ' ' );
			if ( lineMetrics.width > totalTextWidth ) {
			
				totalTextWidth = lineMetrics.width;
				metricsForLongest = lineMetrics;
			}
		}
		if ( totalTextWidth === 0 ) {
			const fallbackMetrics = context.measureText( sanitizedText || ' ' );
			totalTextWidth = fallbackMetrics.width;
			metricsForLongest = fallbackMetrics;
		}

		context.restore();

		const ascent = metricsForLongest && typeof metricsForLongest.actualBoundingBoxAscent === 'number' ?
			metricsForLongest.actualBoundingBoxAscent : fontSize * 0.8;
		const descent = metricsForLongest && typeof metricsForLongest.actualBoundingBoxDescent === 'number' ?
			metricsForLongest.actualBoundingBoxDescent : fontSize * 0.2;
		let totalHeight = ascent + descent;
		if ( lines.length > 1 ) {
			totalHeight = ascent + descent + ( lines.length - 1 ) * lineHeight;
		}

		const textAlign = layer.textAlign || 'left';
		let alignOffset = 0;
		switch ( textAlign ) {
			case 'center':
				alignOffset = totalTextWidth / 2;
				break;
			case 'right':
			case 'end':
				alignOffset = totalTextWidth;
				break;
			default:
				alignOffset = 0;
		}

		const originX = ( layer.x ||  0 ) - alignOffset;
		const originY = ( layer.y || 0 ) - ascent;

		return {
			lines: lines,
			fontSize: fontSize,
			fontFamily: fontFamily,
			lineHeight: lineHeight,
			width: totalTextWidth,
			height: totalHeight,
			originX: originX,
			originY: originY,
			ascent: ascent,
			descent: descent,
			baselineY: layer.y || 0,
			alignOffset: alignOffset
		};
	};

	CanvasManager.prototype.drawText = function ( layer ) {
		// Delegated to renderer
		if ( this.renderer ) {
			this.renderer.drawText( layer );
		}
	};

	CanvasManager.prototype.drawRectangle = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawRectangle( layer );
		}
	};

	CanvasManager.prototype.drawCircle = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawCircle( layer );
		}
	};

	CanvasManager.prototype.drawLine = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawLine( layer );
		}
	};

	CanvasManager.prototype.drawArrow = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawArrow( layer );
		}
	};

	CanvasManager.prototype.drawHighlight = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawHighlight( layer );
		}
	};

	CanvasManager.prototype.drawPath = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawPath( layer );
		}
	};

	CanvasManager.prototype.drawEllipse = function ( layer ) {
	
		if ( this.renderer ) {
			this.renderer.drawEllipse( layer );
		}
	};

	CanvasManager.prototype.drawPolygon = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawPolygon( layer );
		}
	};

	CanvasManager.prototype.drawStar = function ( layer ) {
		if ( this.renderer ) {
			this.renderer.drawStar( layer );
		}
	};



	CanvasManager.prototype.destroy = function () {
		if ( this.events ) {
			this.events.destroy();
			this.events = null;
		}
		if ( this.renderer && typeof this.renderer.destroy === 'function' ) {
			this.renderer.destroy();
			this.renderer = null;
		}
		this.canvas = null;
		this.ctx = null;
		this.editor = null;
	};

	// Export
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasManager;
	}
	if ( typeof window !== 'undefined' ) {
		window.CanvasManager = CanvasManager;
	}
	if ( typeof mw !== 'undefined' && mw.loader ) {
		mw.loader.using( [], function () {
			mw.CanvasManager = CanvasManager;
		} );
	}

}() );
