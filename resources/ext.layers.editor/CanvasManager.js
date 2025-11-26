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

		// Performance optimization properties
		this.dirtyRegion = null; // Track dirty regions to avoid full redraws
		this.animationFrameId = null; // For requestAnimationFrame
		this.redrawScheduled = false; // Prevent multiple redraws in same frame
		// Use a plain object for cache to satisfy environments without ES2015 Map
		this.layersCache = Object.create( null ); // Cache rendered layers
		this.viewportBounds = { x: 0, y: 0, width: 0, height: 0 }; // For culling

		// Selection and manipulation state
		this.selectedLayerId = null;
		this.selectedLayerIds = []; // Multi-selection support
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

		// Initialize default style
		this.currentStyle = {
			color: '#000000',
			strokeWidth: 2,
			fontSize: 16,
			fontFamily: 'Arial, sans-serif'
		};

		// Zoom and pan functionality
		this.zoom = 1.0;
		this.minZoom = 0.1;
		this.maxZoom = 5.0;
		this.panX = 0;
		this.panY = 0;
		this.isPanning = false;
		this.lastPanPoint = null;
		this.userHasSetZoom = false; // Track if user has manually adjusted zoom

		// Smooth zoom animation properties
		this.isAnimatingZoom = false;
		this.zoomAnimationDuration = 300; // milliseconds
		this.zoomAnimationStartTime = 0;
		this.zoomAnimationStartZoom = 1.0;
		this.zoomAnimationTargetZoom = 1.0;

		// Grid settings
		this.showGrid = false;
		this.gridSize = 20;
		this.snapToGrid = false;

		// Rulers & guides
		this.showRulers = false;
		this.showGuides = false;
		this.snapToGuides = false;
		this.smartGuides = false; // reserved for future smart alignment
		this.rulerSize = 20;
		this.horizontalGuides = []; // y positions in canvas coords
		this.verticalGuides = []; // x positions in canvas coords
		this.isDraggingGuide = false;
		this.dragGuideOrientation = null; // 'h' | 'v'
		this.dragGuidePos = 0;

		// History/Undo system
		this.history = [];
		this.historyIndex = -1;
		this.maxHistorySteps = 50;

		// Clipboard for copy/paste
		this.clipboard = [];

		// Canvas pooling for temporary canvas operations to prevent memory leaks
		this.canvasPool = [];
		this.maxPoolSize = 5;

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
		var RendererClass = ( typeof CanvasRenderer !== 'undefined' ) ? CanvasRenderer :
			( ( typeof window !== 'undefined' && window.CanvasRenderer ) ? window.CanvasRenderer :
			( ( typeof mw !== 'undefined' && mw.CanvasRenderer ) ? mw.CanvasRenderer : undefined ) );

		if ( RendererClass ) {
			this.renderer = new RendererClass( this.canvas, { editor: this.editor } );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.error( 'Layers: CanvasRenderer not found' );
		}
		// Initialize SelectionManager
		var SelectionManagerClass = ( typeof LayersSelectionManager !== 'undefined' ) ? LayersSelectionManager :
			( ( typeof window !== 'undefined' && window.LayersSelectionManager ) ? window.LayersSelectionManager :
			( ( typeof mw !== 'undefined' && mw.LayersSelectionManager ) ? mw.LayersSelectionManager : undefined ) );

		if ( SelectionManagerClass ) {
			this.selectionManager = new SelectionManagerClass( {}, this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: SelectionManager not found, some features may be disabled' );
		}

		// Initialize ZoomPanController for zoom/pan operations
		var ZoomPanControllerClass = ( typeof ZoomPanController !== 'undefined' ) ? ZoomPanController :
			( ( typeof window !== 'undefined' && window.ZoomPanController ) ? window.ZoomPanController : undefined );

		if ( ZoomPanControllerClass ) {
			this.zoomPanController = new ZoomPanControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: ZoomPanController not found, zoom/pan may use fallback methods' );
		}

		// Initialize GridRulersController for grid/ruler/guide operations
		var GridRulersControllerClass = ( typeof GridRulersController !== 'undefined' ) ? GridRulersController :
			( ( typeof window !== 'undefined' && window.GridRulersController ) ? window.GridRulersController : undefined );

		if ( GridRulersControllerClass ) {
			this.gridRulersController = new GridRulersControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: GridRulersController not found, grid/rulers may use fallback methods' );
		}

		// Initialize TransformController for resize/rotation/drag operations
		var TransformControllerClass = ( typeof TransformController !== 'undefined' ) ? TransformController :
			( ( typeof window !== 'undefined' && window.TransformController ) ? window.TransformController : undefined );

		if ( TransformControllerClass ) {
			this.transformController = new TransformControllerClass( this );
		} else if ( typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( 'Layers: TransformController not found, transforms may use fallback methods' );
		}

		// Set up event handlers
		this.setupEventHandlers();

		// Load background image if editor/filename is present; otherwise
		// skip image detection during tests.
		if ( this.editor && this.editor.filename ) {
			this.loadBackgroundImage();
		}
	};

	CanvasManager.prototype.loadBackgroundImage = function () {
		var filename = this.editor.filename;
		var backgroundImageUrl = this.config.backgroundImageUrl;
		var imageUrls = [];

		// Priority 1: Use the specific background image URL from config
		if ( backgroundImageUrl ) {
			imageUrls.push( backgroundImageUrl );
		}

		// Priority 2: Try to find the current page image
		var pageImages = document.querySelectorAll( '.mw-file-element img, .fullImageLink img, .filehistory img, img[src*="' + filename + '"]' );
		if ( pageImages.length > 0 ) {
			for ( var i = 0; i < pageImages.length; i++ ) {
				var imgSrc = pageImages[ i ].src;
				if ( imgSrc && imageUrls.indexOf( imgSrc ) === -1 ) {
					imageUrls.push( imgSrc );
				}
			}
		}

		// Priority 3: Try MediaWiki patterns if mw is available
		if (
			filename && typeof mw !== 'undefined' && mw && mw.config &&
			mw.config.get( 'wgServer' ) && mw.config.get( 'wgScriptPath' )
		) {
			var mwUrls = [
				mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' ) +
				'/index.php?title=Special:Redirect/file/' + encodeURIComponent( filename ),

				mw.config.get( 'wgServer' ) + mw.config.get( 'wgScriptPath' ) +
				'/index.php?title=File:' + encodeURIComponent( filename )
			];

			if ( mw.config.get( 'wgArticlePath' ) ) {
				mwUrls.push(
					mw.config.get( 'wgServer' ) + mw.config.get( 'wgArticlePath' ).replace( '$1', 'File:' + encodeURIComponent( filename ) )
				);
			}

			mwUrls.forEach( function ( url ) {
				if ( imageUrls.indexOf( url ) === -1 ) {
					imageUrls.push( url );
				}
			} );
		}

		// If we have URLs to try, start loading
		if ( imageUrls.length > 0 ) {
			this.tryLoadImage( imageUrls, 0 );
		} else {
			this.useTestImage();
		}
	};

	CanvasManager.prototype.tryLoadImage = function ( urls, index ) {
		var self = this;

		if ( index >= urls.length ) {
			this.useTestImage();
			return;
		}

		var currentUrl = urls[ index ];
		this.backgroundImage = new Image();
		this.backgroundImage.crossOrigin = 'anonymous'; // Allow cross-origin images

		this.backgroundImage.onload = function () {
			//  self.backgroundImage.width, 'x', self.backgroundImage.height );

			// Pass image to renderer immediately
			if ( self.renderer ) {
				self.renderer.setBackgroundImage( self.backgroundImage );
			}

			// Set canvas size to match the image
			self.canvas.width = self.backgroundImage.width;
			self.canvas.height = self.backgroundImage.height;
			//  self.canvas.width, 'x', self.canvas.height );

			// Resize canvas display to fit container
			self.resizeCanvas();

			// Draw the image and any layers
			self.redraw();
			if ( self.editor.layers ) {
				self.renderLayers( self.editor.layers );
			}
		};

		this.backgroundImage.onerror = function () {
			// Try next URL
			self.tryLoadImage( urls, index + 1 );
		};

		this.backgroundImage.src = currentUrl;
	};

	CanvasManager.prototype.useTestImage = function () {
		var self = this;
		// Try SVG first
		var svgData = this.createTestImage( this.editor.filename );
		var svgDataUrl = 'data:image/svg+xml;base64,' + btoa( svgData );

		this.backgroundImage = new Image();
		this.backgroundImage.crossOrigin = 'anonymous';

		this.backgroundImage.onload = function () {
			//  self.backgroundImage.width, 'x', self.backgroundImage.height );

			// Pass image to renderer immediately
			if ( self.renderer ) {
				self.renderer.setBackgroundImage( self.backgroundImage );
			}

			// Set canvas size to match the image (800x600 for the test image)
			self.canvas.width = 800;
			self.canvas.height = 600;
			//  self.canvas.width, 'x', self.canvas.height );

			self.resizeCanvas();
			self.redraw();
			if ( self.editor.layers ) {
				self.renderLayers( self.editor.layers );
			}
		};

		this.backgroundImage.onerror = function () {
			self.createCanvasBackground();
		};

		this.backgroundImage.src = svgDataUrl;

		// Also create canvas background immediately as backup
		setTimeout( function () {
			if ( !self.backgroundImage || !self.backgroundImage.complete ) {
				self.createCanvasBackground();
			}
		}, 1000 );
	};

	CanvasManager.prototype.createCanvasBackground = function () {
		// Create a simple background directly on canvas when even SVG fails
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

	CanvasManager.prototype.createTestImage = function ( filename ) {
		return '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">' +
			'<rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>' +
			'<text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#495057">' +
			( filename || 'Sample Image' ).replace( /[<>&"]/g, function ( match ) {
				return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ match ];
			} ) + '</text>' +
			'<text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#6c757d">Sample Image for Layer Editing</text>' +
			'<circle cx="200" cy="150" r="50" fill="none" stroke="#e9ecef" stroke-width="2"/>' +
			'<rect x="500" y="300" width="100" height="80" fill="none" stroke="#e9ecef" stroke-width="2"/>' +
			'<line x1="100" y1="400" x2="300" y2="500" stroke="#e9ecef" stroke-width="2"/>' +
			'<text x="50%" y="85%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#adb5bd">Draw shapes and text using the tools above</text>' +
			'</svg>';
	};

	CanvasManager.prototype.resizeCanvas = function () {
		// Get container dimensions
		var container = this.canvas.parentNode;
		//  container.clientWidth, 'x', container.clientHeight );

		// If no canvas size is set yet, use default
		if ( this.canvas.width === 0 || this.canvas.height === 0 ) {
			this.canvas.width = 800;
			this.canvas.height = 600;
		}

		var canvasWidth = this.canvas.width;
		var canvasHeight = this.canvas.height;
		// Calculate available space in container (with padding)
		var availableWidth = Math.max( container.clientWidth - 40, 400 );
		var availableHeight = Math.max( container.clientHeight - 40, 300 );
		// Calculate scale to fit the canvas in the container
		var scaleX = availableWidth / canvasWidth;
		var scaleY = availableHeight / canvasHeight;
		var scale = Math.min( scaleX, scaleY );

		// Ensure reasonable scale bounds (don't make it too tiny or huge)
		scale = Math.max( 0.1, Math.min( scale, 3.0 ) );

		// Calculate final display size
		var displayWidth = Math.floor( canvasWidth * scale );
		var displayHeight = Math.floor( canvasHeight * scale );

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
		var handles = [];
		if ( this.renderer && this.renderer.selectionHandles && this.renderer.selectionHandles.length > 0 ) {
			handles = this.renderer.selectionHandles;
		} else if ( this.selectionManager && this.selectionManager.selectionHandles && this.selectionManager.selectionHandles.length > 0 ) {
			handles = this.selectionManager.selectionHandles;
		} else {
			handles = this.selectionHandles;
		}

		for ( var i = 0; i < handles.length; i++ ) {
			var handle = handles[ i ];
			var rect = handle.rect || handle;
			if ( this.isPointInRect( point, rect ) ) {
				return handle;
			}
		}
		return null;
	};

	CanvasManager.prototype.isPointInRect = function ( point, rect ) {
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

		var layer = this.editor.getLayerById( this.selectedLayerId );
		var rotation = layer ? layer.rotation : 0;
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

		var layer = this.editor.getLayerById( this.selectedLayerId );
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
		if ( this.selectedLayerIds.length > 1 ) {
			// Multi-selection: store all selected layer states
			this.originalMultiLayerStates = {};
			for ( var i = 0; i < this.selectedLayerIds.length; i++ ) {
				var layerId = this.selectedLayerIds[ i ];
				var multiLayer = this.editor.getLayerById( layerId );
				if ( multiLayer ) {
					this.originalMultiLayerStates[ layerId ] =
						JSON.parse( JSON.stringify( multiLayer ) );
				}
			}
		} else {
			// Single selection: store single layer state
			var singleLayer = this.editor.getLayerById( this.selectedLayerId );
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
		var normalizedRotation = ( ( rotation % 360 ) + 360 ) % 360;
		var cursorIndex = Math.round( normalizedRotation / 45 ) % 8;

		// Map handle types to base cursor directions (0 = north)
		var baseCursors = {
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
		var effectiveDirection = ( baseCursors[ handleType ] + cursorIndex ) % 8;

		// Map back to cursor names
		var cursors = [ 'n-resize', 'ne-resize', 'e-resize', 'ne-resize', 'n-resize', 'ne-resize', 'e-resize', 'nw-resize' ];
		return cursors[ effectiveDirection ];
	};



	CanvasManager.prototype.handleResize = function ( point, event ) {
		if ( this.transformController && this.transformController.isResizing ) {
			this.transformController.handleResize( point, event );
			return;
		}
		// Fallback for when controller is not available
		var layer = this.editor.getLayerById( this.selectedLayerId );

		if ( !layer || !this.originalLayerState ) {
			return;
		}

		var deltaX = point.x - this.dragStartPoint.x;
		var deltaY = point.y - this.dragStartPoint.y;

		// If layer has rotation, transform the delta into the layer's local coordinate system
		var rotation = layer.rotation || 0;
		if ( rotation !== 0 ) {
			var rotRad = -rotation * Math.PI / 180; // Negative to reverse the rotation
			var cos = Math.cos( rotRad );
			var sin = Math.sin( rotRad );
			var rotatedDeltaX = deltaX * cos - deltaY * sin;
			var rotatedDeltaY = deltaX * sin + deltaY * cos;
			deltaX = rotatedDeltaX;
			deltaY = rotatedDeltaY;
		}

		// Limit delta values to prevent sudden jumps during rapid mouse movements
		var maxDelta = 1000; // Reasonable maximum delta in pixels
		deltaX = Math.max( -maxDelta, Math.min( maxDelta, deltaX ) );
		deltaY = Math.max( -maxDelta, Math.min( maxDelta, deltaY ) );

		// Get modifier keys from the event
		var modifiers = {
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
		var updates = this.calculateResize(
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
		var updates = {};
		var origRX = origLayerEllipse.radiusX || 1;
		var origRY = origLayerEllipse.radiusY || 1;
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
		var updates = {};
		var origRadius = origLayerPoly.radius || 50;

		// Calculate distance from center to determine new radius
		var deltaDistance = 0;

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
		var growing = false;
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
		var newRadius = growing ?
			origRadius + deltaDistance :
			Math.max( 10, origRadius - deltaDistance );

		updates.radius = newRadius;
		return updates;
	};

	// Line/arrow resize: move x2/y2
	CanvasManager.prototype.calculateLineResize = function (
		origLayerLine, handleLine, dXLine, dYLine
	) {
		var updates = {};
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
		var updates = { points: [] };
		var scaleX = 1 + dXPath / 100;
		var scaleY = 1 + dYPath / 100;
		for ( var i = 0; i < origLayerPath.points.length; i++ ) {
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
		var updates = {};
		var origX = originalLayer.x || 0;
		var origY = originalLayer.y || 0;
		var origW = originalLayer.width || 0;
		var origH = originalLayer.height || 0;

		// Calculate aspect ratio for proportional scaling
		var aspectRatio = origW / origH;
		var centerX = origX + origW / 2;
		var centerY = origY + origH / 2;

		if ( modifiers.proportional ) {
			// Proportional scaling: maintain aspect ratio
			// Prevent division by zero and extreme aspect ratios
			if ( aspectRatio === 0 || !isFinite( aspectRatio ) ) {
				aspectRatio = 1.0;
			}

			// Use the dimension that changed the most to drive the scaling
			var absDeltaX = Math.abs( deltaX );
			var absDeltaY = Math.abs( deltaY );

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
		var updates = {};
		var origRadius = originalLayer.radius || 50;
		var origX = originalLayer.x || 0;
		var origY = originalLayer.y || 0;

		// Calculate new position based on handle and delta
		var handleX, handleY;
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
		var newRadius = Math.sqrt(
			( handleX - origX ) * ( handleX - origX ) +
			( handleY - origY ) * ( handleY - origY )
		);

		updates.radius = Math.max( 5, newRadius );
		return updates;
	};

	CanvasManager.prototype.calculateTextResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		var updates = {};
		var originalFontSize = originalLayer.fontSize || 16;

		// Calculate font size change based on diagonal movement
		var diagonalDelta = Math.sqrt( deltaX * deltaX + deltaY * deltaY );
		var fontSizeChange = diagonalDelta * 0.2; // Scale factor

		// Determine if we're growing or shrinking based on handle direction
		var isGrowing = false;
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

		var newFontSize = originalFontSize;
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
		var layer = this.editor.getLayerById( this.selectedLayerId );
		if ( !layer ) {
			return;
		}

		// Calculate angle from rotation center to mouse position
		var bounds = this.getLayerBounds( layer );
		if ( !bounds ) {
			return;
		}

		var centerX = bounds.centerX;
		var centerY = bounds.centerY;

		var startAngle = Math.atan2(
			this.dragStartPoint.y - centerY,
			this.dragStartPoint.x - centerX
		);
		var currentAngle = Math.atan2( point.y - centerY, point.x - centerX );

		var angleDelta = currentAngle - startAngle;
		var degrees = angleDelta * ( 180 / Math.PI );

		// Apply snap-to-angle if Shift key is held (15-degree increments)
		if ( event && event.shiftKey ) {
			var snapAngle = 15;
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
		var deltaX = point.x - this.dragStartPoint.x;
		var deltaY = point.y - this.dragStartPoint.y;

		// Enable drag preview mode for visual feedback
		this.showDragPreview = true;

		// Support multi-selection dragging
		var layersToMove = [];
		if ( this.selectedLayerIds.length > 1 ) {
			// Multi-selection: move all selected layers
			for ( var i = 0; i < this.selectedLayerIds.length; i++ ) {
				var multiLayer = this.editor.getLayerById( this.selectedLayerIds[ i ] );
				if ( multiLayer ) {
					layersToMove.push( multiLayer );
				}
			}
		} else {
			// Single selection: move just the selected layer
			var singleLayer = this.editor.getLayerById( this.selectedLayerId );
			if ( singleLayer && this.originalLayerState ) {
				layersToMove.push( singleLayer );
			}
		}

		// Move all layers in the selection
		for ( var j = 0; j < layersToMove.length; j++ ) {
			var layerToMove = layersToMove[ j ];
			var originalState = this.originalLayerState;

			// For multi-selection, we need to get individual original states
			if ( this.selectedLayerIds.length > 1 && this.originalMultiLayerStates ) {
				originalState = this.originalMultiLayerStates[ layerToMove.id ];
			}

			if ( !originalState ) {
				continue;
			}

			// Apply snap-to-grid if enabled
			var adjustedDeltaX = deltaX;
			var adjustedDeltaY = deltaY;

			if ( this.snapToGrid && this.gridSize > 0 ) {
				var newX = ( originalState.x || 0 ) + deltaX;
				var newY = ( originalState.y || 0 ) + deltaY;
				var snappedPoint = this.snapPointToGrid( { x: newX, y: newY } );
				adjustedDeltaX = snappedPoint.x - ( originalState.x || 0 );
				adjustedDeltaY = snappedPoint.y - ( originalState.y || 0 );
			}

			// Update layer position based on type
			this.updateLayerPosition( layerToMove, originalState, adjustedDeltaX, adjustedDeltaY );
		}

		// Re-render and emit live-transform event for the primary selected layer
		this.renderLayers( this.editor.layers );
		var active = this.editor.getLayerById( this.selectedLayerId );
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
		var self = this;
		window.requestAnimationFrame( function () {
			self.transformEventScheduled = false;
			var target = ( self.editor && self.editor.container ) || self.container || document;
			try {
				var detail = {
					id: self.lastTransformPayload.id,
					layer: JSON.parse( JSON.stringify( self.lastTransformPayload ) )
				};
				var evt = new CustomEvent( 'layers:transforming', { detail: detail } );
				target.dispatchEvent( evt );
			} catch ( _e ) { /* ignore */ }
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
		if ( this.selectedLayerId ) {
			var handleHit = this.hitTestSelectionHandles( point );

			if ( handleHit ) {
				if ( handleHit.type === 'rotate' ) {
					this.canvas.style.cursor = 'grab';
					return;
				}
				var selectedLayer = this.editor.getLayerById( this.selectedLayerId );
				var rotation = selectedLayer ? selectedLayer.rotation : 0;
				this.canvas.style.cursor = this.getResizeCursor( handleHit.type, rotation );
				return;
			}
		}

		// Check for layer hover
		var layerUnderMouse = this.getLayerAtPoint( point );
		if ( layerUnderMouse ) {
			// If this is the selected layer, show move cursor
			if ( this.selectedLayerId && layerUnderMouse.id === this.selectedLayerId ) {
				this.canvas.style.cursor = 'move';
			} else {
				this.canvas.style.cursor = 'pointer';
			}
		} else {
			this.canvas.style.cursor = 'crosshair';
		}
	};

	CanvasManager.prototype.getLayerAtPoint = function ( point ) {
		// Find layer at click point in visual top-most-first order
		// We draw from end->start, so index 0 is top-most and should be tested first
		for ( var i = 0; i < this.editor.layers.length; i++ ) {
			var layer = this.editor.layers[ i ];
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
		if ( !layer ) {
			return false;
		}
		switch ( layer.type ) {
			case 'rectangle': {
				var rMinX = Math.min( layer.x, layer.x + layer.width );
				var rMinY = Math.min( layer.y, layer.y + layer.height );
				var rW = Math.abs( layer.width );
				var rH = Math.abs( layer.height );
				return point.x >= rMinX && point.x <= rMinX + rW &&
					point.y >= rMinY && point.y <= rMinY + rH;
			}
			case 'blur': {
				var bMinX = Math.min( layer.x, layer.x + layer.width );
				var bMinY = Math.min( layer.y, layer.y + layer.height );
				var bW = Math.abs( layer.width );
				var bH = Math.abs( layer.height );
				return point.x >= bMinX && point.x <= bMinX + bW &&
					point.y >= bMinY && point.y <= bMinY + bH;
			}
			case 'circle': {
				var dx = point.x - ( layer.x || 0 );
				var dy = point.y - ( layer.y || 0 );
				var r = layer.radius || 0;
				return ( dx * dx + dy * dy ) <= r * r;
			}
			case 'text': {
				var bounds = this.getLayerBounds( layer );
				return bounds &&
					point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
					point.y >= bounds.y && point.y <= bounds.y + bounds.height;
			}
			case 'line':
			case 'arrow': {
				return this.isPointNearLine( point, layer.x1, layer.y1, layer.x2, layer.y2,
					Math.max( 6, ( layer.strokeWidth || 2 ) + 4 ) );
			}
			case 'path': {
				if ( !layer.points || layer.points.length < 2 ) {
					return false;
				}
				var tol = Math.max( 6, ( layer.strokeWidth || 2 ) + 4 );
				for ( var i = 0; i < layer.points.length - 1; i++ ) {
					if ( this.isPointNearLine( point,
						layer.points[ i ].x, layer.points[ i ].y,
						layer.points[ i + 1 ].x, layer.points[ i + 1 ].y,
						tol ) ) {
						return true;
					}
				}
				return false;
			}
			case 'ellipse': {
				var ex = layer.x || 0;
				var ey = layer.y || 0;
				var radX = Math.abs( layer.radiusX || 0 );
				var radY = Math.abs( layer.radiusY || 0 );
				if ( radX === 0 || radY === 0 ) {
					return false;
				}
				var nx = ( point.x - ex ) / radX;
				var ny = ( point.y - ey ) / radY;
				return nx * nx + ny * ny <= 1;
			}
			case 'polygon':
			case 'star': {
				var polyX = layer.x || 0;
				var polyY = layer.y || 0;
				var polyRotation = ( layer.rotation || 0 ) * Math.PI / 180;
				var polyPoints = [];
				if ( layer.type === 'polygon' ) {
					var polySides = layer.sides || 6;
					var polyRadius = Math.abs( layer.radius || layer.outerRadius || 50 );
					for ( var si = 0; si < polySides; si++ ) {
						var angle = ( si * 2 * Math.PI ) / polySides - Math.PI / 2 + polyRotation;
						polyPoints.push( {
							x: polyX + polyRadius * Math.cos( angle ),
							y: polyY + polyRadius * Math.sin( angle )
						} );
					}
				} else {
					var starPoints = ( typeof layer.points === 'number' ? layer.points : null ) || layer.starPoints || 5;
					var outerRadius = Math.abs( layer.outerRadius || layer.radius || 50 );
					var innerRadius = Math.abs( layer.innerRadius || outerRadius * 0.4 );
					for ( var sti = 0; sti < starPoints * 2; sti++ ) {
						var starAngle = ( sti * Math.PI ) / starPoints - Math.PI / 2 + polyRotation;
						var starR = ( sti % 2 === 0 ) ? outerRadius : innerRadius;
						polyPoints.push( {
							x: polyX + starR * Math.cos( starAngle ),
							y: polyY + starR * Math.sin( starAngle )
						} );
					}
				}

				return this.isPointInPolygon( point, polyPoints );
			}
			case 'highlight': {
				var hx = Math.min( layer.x, layer.x + layer.width );
				var hy = Math.min( layer.y, layer.y + ( layer.height || 20 ) );
				var hw = Math.abs( layer.width );
				var hh = Math.abs( layer.height || 20 );
				return point.x >= hx && point.x <= hx + hw &&
					point.y >= hy && point.y <= hy + hh;
			}
		}
		return false;
	};

	CanvasManager.prototype.isPointNearLine = function ( point, x1, y1, x2, y2, tolerance ) {
		var dist = this.pointToSegmentDistance( point.x, point.y, x1, y1, x2, y2 );
		return dist <= ( tolerance || 6 );
	};

	CanvasManager.prototype.pointToSegmentDistance = function ( px, py, x1, y1, x2, y2 ) {
		var dx = x2 - x1;
		var dy = y2 - y1;
		if ( dx === 0 && dy === 0 ) {
			return Math.sqrt( Math.pow( px - x1, 2 ) + Math.pow( py - y1, 2 ) );
		}
		var t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / ( dx * dx + dy * dy );
		t = Math.max( 0, Math.min( 1, t ) );
		var projX = x1 + t * dx;
		var projY = y1 + t * dy;
		return Math.sqrt( Math.pow( px - projX, 2 ) + Math.pow( py - projY, 2 ) );
	};

	CanvasManager.prototype.isPointInPolygon = function ( point, polygonPoints ) {
		var x = point.x;
		var y = point.y;
		var inside = false;

		for ( var i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++ ) {
			var xi = polygonPoints[ i ].x;
			var yi = polygonPoints[ i ].y;
			var xj = polygonPoints[ j ].x;
			var yj = polygonPoints[ j ].y;

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
			var targetZoom = this.zoom + 0.2;
			this.smoothZoomTo( targetZoom );
			this.userHasSetZoom = true;
		}
	};

	CanvasManager.prototype.zoomOut = function () {
		if ( this.zoomPanController ) {
			this.zoomPanController.zoomOut();
		} else {
			// Fallback for when controller is not available
			var targetZoom = this.zoom - 0.2;
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
			var currentTime = performance.now();
			var elapsed = currentTime - this.zoomAnimationStartTime;
			var progress = Math.min( elapsed / this.zoomAnimationDuration, 1.0 );
			var easedProgress = 1 - Math.pow( 1 - progress, 3 );
			var currentZoom = this.zoomAnimationStartZoom +
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
			var container = this.canvas.parentNode;
			var containerWidth = container.clientWidth - 40;
			var containerHeight = container.clientHeight - 40;
			var scaleX = containerWidth / this.backgroundImage.width;
			var scaleY = containerHeight / this.backgroundImage.height;
			var targetZoom = Math.min( scaleX, scaleY );
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
			var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			var hasVisibleLayers = false;
			for ( var i = 0; i < this.editor.layers.length; i++ ) {
				var layer = this.editor.layers[ i ];
				if ( !layer.visible ) {
					continue;
				}
				hasVisibleLayers = true;
				var layerBounds = this.getLayerBounds( layer );
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
			var padding = 50;
			var contentWidth = ( maxX - minX ) + ( padding * 2 );
			var contentHeight = ( maxY - minY ) + ( padding * 2 );
			var container = this.canvas.parentNode;
			var containerWidth = container.clientWidth - 40;
			var containerHeight = container.clientHeight - 40;
			var scaleX = containerWidth / contentWidth;
			var scaleY = containerHeight / contentHeight;
			var targetZoom = Math.min( scaleX, scaleY );
			targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );
			var centerX = ( minX + maxX ) / 2;
			var centerY = ( minY + maxY ) / 2;
			var canvasCenterX = this.canvas.width / 2;
			var canvasCenterY = this.canvas.height / 2;
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

		var baseBounds = this._getRawLayerBounds( layer );
		if ( !baseBounds ) {
			return null;
		}

		var rotation = layer.rotation || 0;
		var aabb = this._computeAxisAlignedBounds( baseBounds, rotation );

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
		var rectX, rectY, safeWidth, safeHeight;
		switch ( layer.type ) {
			case 'text': {
				var textMetrics = this.measureTextLayer( layer );
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
				var radius = Math.abs( layer.radius || 0 );
				return {
					x: ( layer.x || 0 ) - radius,
					y: ( layer.y || 0 ) - radius,
					width: radius * 2,
					height: radius * 2
				};
			}
			case 'ellipse': {
				var radiusX = Math.abs( layer.radiusX || layer.radius || 0 );
				var radiusY = Math.abs( layer.radiusY || layer.radius || 0 );
				return {
					x: ( layer.x || 0 ) - radiusX,
					y: ( layer.y || 0 ) - radiusY,
					width: radiusX * 2,
					height: radiusY * 2
				};
			}
			case 'line':
			case 'arrow': {
				var x1 = layer.x1 !== undefined ? layer.x1 : ( layer.x || 0 );
				var y1 = layer.y1 !== undefined ? layer.y1 : ( layer.y || 0 );
				var x2 = layer.x2 !== undefined ? layer.x2 : ( layer.x || 0 );
				var y2 = layer.y2 !== undefined ? layer.y2 : ( layer.y || 0 );
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
					var minX = layer.points[ 0 ].x;
					var maxX = layer.points[ 0 ].x;
					var minY = layer.points[ 0 ].y;
					var maxY = layer.points[ 0 ].y;
					for ( var i = 1; i < layer.points.length; i++ ) {
						var pt = layer.points[ i ];
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
				var r = layer.radius;
				if ( layer.type === 'star' && layer.outerRadius ) {
					r = layer.outerRadius;
				}
				var radiusFallback = Math.abs( r || 50 );
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

		var rotation = ( rotationDegrees || 0 ) * Math.PI / 180;
		if ( rotation === 0 ) {
			return {
				left: rect.x,
				top: rect.y,
				right: rect.x + rect.width,
				bottom: rect.y + rect.height
			};
		}

		var centerX = rect.x + ( rect.width / 2 );
		var centerY = rect.y + ( rect.height / 2 );
		var corners = [
			{ x: rect.x, y: rect.y },
			{ x: rect.x + rect.width, y: rect.y },
			{ x: rect.x + rect.width, y: rect.y + rect.height },
			{ x: rect.x, y: rect.y + rect.height }
		];
		var cosR = Math.cos( rotation );
		var sinR = Math.sin( rotation );
		var rotated = corners.map( function ( point ) {
			var dx = point.x - centerX;
			var dy = point.y - centerY;
			return {
				x: centerX + dx * cosR - dy * sinR,
				y: centerY + dx * sinR + dy * cosR
			};
		} );
		var xs = rotated.map( function ( point ) {
			return point.x;
		} );
		var ys = rotated.map( function ( point ) {
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
		var tempCanvasObj = this.canvasPool.pop();
		if ( tempCanvasObj ) {
			// Reuse existing canvas from pool
			tempCanvasObj.canvas.width = width || 100;
			tempCanvasObj.canvas.height = height || 100;
			// Clear the canvas
			var canvas = tempCanvasObj.canvas;
			tempCanvasObj.context.clearRect( 0, 0, canvas.width, canvas.height );
		} else {
			// Create new canvas object
			var tempCanvas = document.createElement( 'canvas' );
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
			var canvas = tempCanvasObj.canvas;
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

		var zoomFactor = event.shiftKey ? 0.8 : 1.25; // Zoom out if shift, zoom in otherwise
		var newZoom = this.zoom * zoomFactor;
		newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );

		if ( newZoom !== this.zoom ) {
			// Keep the clicked canvas point under the cursor stable
			var screenX = this.panX + this.zoom * point.x;
			var screenY = this.panY + this.zoom * point.y;
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

		var deltaY = this.dragStartPoint.y - point.y; // Negative = drag down = zoom out
		var sensitivity = 0.01; // Zoom sensitivity
		var zoomChange = 1 + ( deltaY * sensitivity );

		var newZoom = this.initialDragZoom * zoomChange;

		// Clamp zoom level
		newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );

		if ( newZoom !== this.zoom ) {
			// Anchor zoom around drag start point
			var anchor = this.dragStartPoint;
			var screenX = this.panX + this.zoom * anchor.x;
			var screenY = this.panY + this.zoom * anchor.y;
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
			var target = Math.max( this.minZoom, Math.min( this.maxZoom, this.zoom + delta ) );
			if ( target === this.zoom ) {
				return;
			}
			var screenX = this.panX + this.zoom * point.x;
			var screenY = this.panY + this.zoom * point.y;
			this.zoom = target;
			this.panX = screenX - this.zoom * point.x;
			this.panY = screenY - this.zoom * point.y;
			this.userHasSetZoom = true;
			this.updateCanvasTransform();
		}
	};

	CanvasManager.prototype.saveState = function ( action ) {
		// Avoid saving state during rapid operations
		if ( this.savingState ) {
			return;
		}
		this.savingState = true;

		// Use a timeout to debounce rapid state saves
		clearTimeout( this.saveStateTimeout );
		this.saveStateTimeout = setTimeout( function () {
			try {
				// Deep clone the current layers state efficiently
				var state = {
					layers: this.deepCloneLayers( this.editor.layers || [] ),
					action: action || 'action',
					timestamp: Date.now()
				};

				// Remove any states after current index (if we're not at the end)
				if ( this.historyIndex < this.history.length - 1 ) {
					this.history.splice( this.historyIndex + 1 );
				}

				// Add new state
				this.history.push( state );
				this.historyIndex = this.history.length - 1;

				// Limit history size to prevent memory issues
				if ( this.history.length > this.maxHistorySteps ) {
					// Remove oldest entries
					var toRemove = this.history.length - this.maxHistorySteps;
					this.history.splice( 0, toRemove );
					this.historyIndex -= toRemove;
				}

				// Update toolbar undo/redo buttons
				this.updateUndoRedoButtons();
			} finally {
				this.savingState = false;
			}
		}.bind( this ), 100 ); // 100ms debounce
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
				var clone = {};
				for ( var key in layer ) {
					if ( Object.prototype.hasOwnProperty.call( layer, key ) ) {
						var value = layer[ key ];
						if ( Array.isArray( value ) ) {
							clone[ key ] = value.slice(); // Shallow copy arrays
						} else if ( typeof value === 'object' && value !== null ) {
							// Manual object copying for older JavaScript compatibility
							clone[ key ] = {};
							for ( var subKey in value ) {
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

	CanvasManager.prototype.updateUndoRedoButtons = function () {
		if ( this.editor && this.editor.toolbar ) {
			var canUndo = this.historyIndex > 0;
			var canRedo = this.historyIndex < this.history.length - 1;
			this.editor.toolbar.updateUndoRedoState( canUndo, canRedo );
		}
	};

	// Undo/Redo implementation
	CanvasManager.prototype.undo = function () {
		if ( this.historyIndex <= 0 ) {
			return false;
		}

		this.historyIndex--;
		var state = this.history[ this.historyIndex ];

		// Restore the layers state
		this.editor.layers = JSON.parse( JSON.stringify( state.layers ) );

		// Clear selection and redraw
		this.deselectAll();
		this.renderLayers( this.editor.layers );

		// Update layer panel
		if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
			this.editor.layerPanel.updateLayers( this.editor.layers );
		}

		// Update buttons
		this.updateUndoRedoButtons();

		// Mark editor as dirty
		this.editor.markDirty();

		return true;
	};

	CanvasManager.prototype.redo = function () {
		if ( this.historyIndex >= this.history.length - 1 ) {
			return false;
		}

		this.historyIndex++;
		var state = this.history[ this.historyIndex ];

		// Restore the layers state
		this.editor.layers = JSON.parse( JSON.stringify( state.layers ) );

		// Clear selection and redraw
		this.deselectAll();
		this.renderLayers( this.editor.layers );

		// Update layer panel
		if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
			this.editor.layerPanel.updateLayers( this.editor.layers );
		}

		// Update buttons
		this.updateUndoRedoButtons();

		// Mark editor as dirty
		this.editor.markDirty();

		return true;
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

		var marqueeRect = this.getMarqueeRect();
		var selectedLayers = this.getLayersInRect( marqueeRect );

		if ( selectedLayers.length > 0 ) {
			this.selectedLayerIds = selectedLayers.map( function ( layer ) {
				return layer.id;
			} );
			this.selectedLayerId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ];
			this.drawMultiSelectionIndicators();
		} else {
			this.deselectAll();
		}

		this.isMarqueeSelecting = false;
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();

		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selectionCount: ( this.selectedLayerIds || [] ).length } );
		}
	};

	CanvasManager.prototype.getMarqueeRect = function () {
		var x1 = Math.min( this.marqueeStart.x, this.marqueeEnd.x );
		var y1 = Math.min( this.marqueeStart.y, this.marqueeEnd.y );
		var x2 = Math.max( this.marqueeStart.x, this.marqueeEnd.x );
		var y2 = Math.max( this.marqueeStart.y, this.marqueeEnd.y );

		return {
			x: x1,
			y: y1,
			width: x2 - x1,
			height: y2 - y1
		};
	};

	CanvasManager.prototype.getLayersInRect = function ( rect ) {
		var layersInRect = [];
		var self = this;

		this.editor.layers.forEach( function ( layer ) {
			var layerBounds = self.getLayerBounds( layer );
			if ( layerBounds && self.rectsIntersect( rect, layerBounds ) ) {
				layersInRect.push( layer );
			}
		} );

		return layersInRect;
	};

	CanvasManager.prototype.rectsIntersect = function ( rect1, rect2 ) {
		var a = this._rectToAabb( rect1 );
		var b = this._rectToAabb( rect2 );
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
		var x = rect.x || 0;
		var y = rect.y || 0;
		var width = rect.width || 0;
		var height = rect.height || 0;
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
		var f = ( typeof factor === 'number' ) ? Math.max( 0, Math.min( 1, factor ) ) : 1;
		if ( f === 1 ) {
			fn();
			return;
		}
		var prev = this.ctx.globalAlpha;
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
		this.selectedLayerId = layerId || null;
		this.selectedLayerIds = this.selectedLayerId ? [ this.selectedLayerId ] : [];
		this.selectionHandles = [];
		this.renderLayers( this.editor.layers );
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selectionCount: this.selectedLayerIds.length } );
		}

		// Only sync with layer panel if this wasn't called from panel (prevent circular calls)
		if ( !fromPanel && this.editor && this.editor.layerPanel ) {
			this.editor.layerPanel.selectLayer( layerId, true );
		}
	};

	CanvasManager.prototype.selectAll = function () {
		this.selectedLayerIds = ( this.editor.layers || [] )
			.filter( function ( layer ) { return layer.visible !== false; } )
			.map( function ( layer ) { return layer.id; } );
		this.selectedLayerId =
			this.selectedLayerIds[ this.selectedLayerIds.length - 1 ] || null;
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selectionCount: this.selectedLayerIds.length } );
		}
	};

	CanvasManager.prototype.deselectAll = function () {
		this.selectedLayerId = null;
		this.selectedLayerIds = [];
		this.selectionHandles = [];
		this.rotationHandle = null;
		this.renderLayers( this.editor.layers );
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selectionCount: 0, size: { width: 0, height: 0 } } );
		}
	};

	CanvasManager.prototype.handleLayerSelection = function ( point, isCtrlClick ) {
		var hit = this.getLayerAtPoint( point );
		if ( !hit ) {
			if ( !isCtrlClick ) {
				this.deselectAll();
			}
			return null;
		}

		if ( isCtrlClick ) {
			// Toggle selection state
			var idx = this.selectedLayerIds.indexOf( hit.id );
			if ( idx === -1 ) {
				this.selectedLayerIds.push( hit.id );
			} else {
				this.selectedLayerIds.splice( idx, 1 );
			}
			this.selectedLayerId =
				this.selectedLayerIds[ this.selectedLayerIds.length - 1 ] || null;
		} else {
			this.selectedLayerIds = [ hit.id ];
			this.selectedLayerId = hit.id;
		}

		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();

		// Sync selection with layer panel
		if ( this.editor && this.editor.layerPanel ) {
			this.editor.layerPanel.selectLayer( this.selectedLayerId, true );
		}

		return hit;
	};

	CanvasManager.prototype.drawMultiSelectionIndicators = function () {
		if ( !this.selectedLayerIds || this.selectedLayerIds.length <= 1 ) {
			return;
		}
		for ( var i = 0; i < this.selectedLayerIds.length; i++ ) {
			this.drawSelectionIndicators( this.selectedLayerIds[ i ] );
		}
	};

	// Clipboard operations
	CanvasManager.prototype.copySelected = function () {
		var self = this;
		this.clipboard = [];
		( this.selectedLayerIds || [] ).forEach( function ( id ) {
			var layer = self.editor.getLayerById( id );
			if ( layer ) {
				self.clipboard.push( JSON.parse( JSON.stringify( layer ) ) );
			}
		} );
	};

	CanvasManager.prototype.pasteFromClipboard = function () {
		if ( !this.clipboard || this.clipboard.length === 0 ) {
			return;
		}

		var self = this;
		this.editor.saveState();
		this.clipboard.forEach( function ( layer ) {
			var clone = JSON.parse( JSON.stringify( layer ) );
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
			self.selectedLayerId = clone.id;
		} );

		this.selectedLayerIds = [ this.selectedLayerId ];
		this.renderLayers( this.editor.layers );
		this.editor.markDirty();
	};

	CanvasManager.prototype.cutSelected = function () {
		if ( !this.selectedLayerIds || this.selectedLayerIds.length === 0 ) {
			return;
		}
		this.copySelected();
		var ids = this.selectedLayerIds.slice();
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
		var rect = this.canvas.getBoundingClientRect();
		// Position within the displayed (transformed) element
		var relX = clientX - rect.left;
		var relY = clientY - rect.top;
		// Scale to logical canvas pixels
		var scaleX = this.canvas.width / rect.width;
		var scaleY = this.canvas.height / rect.height;
		var canvasX = relX * scaleX;
		var canvasY = relY * scaleY;

		if ( this.snapToGrid && this.gridSize > 0 ) {
			var gridSize = this.gridSize;
			canvasX = Math.round( canvasX / gridSize ) * gridSize;
			canvasY = Math.round( canvasY / gridSize ) * gridSize;
		}

		return { x: canvasX, y: canvasY };
	};

	// Raw mapping without snapping, useful for ruler hit testing
	CanvasManager.prototype.getRawClientPoint = function ( e ) {
		var rect = this.canvas.getBoundingClientRect();
		var clientX = e.clientX - rect.left;
		var clientY = e.clientY - rect.top;
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
		//  this.currentTool, 'at point:', point );

		// Use current style options if available
		var style = this.currentStyle || {};

		// Reset any previous temp layer
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
		// Continue drawing based on current tool
		if ( this.tempLayer ) {
			this.renderLayers( this.editor.layers );
			this.drawPreview( point );
		}
	};

	CanvasManager.prototype.finishDrawing = function ( point ) {
		// Finish drawing and create layer
		var layerData = this.createLayerFromDrawing( point );
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
		var modal = this.createTextInputModal( point, style );
		document.body.appendChild( modal );

		// Focus on text input
		var textInput = modal.querySelector( '.text-input' );
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
		var self = this;

		// Create modal overlay
		var overlay = document.createElement( 'div' );
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
		var modal = document.createElement( 'div' );
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

		// Set default font family if provided in style
		if ( fontFamilyInput && style.fontFamily ) {
			fontFamilyInput.value = style.fontFamily;
		}

		// Handle text alignment button clicks
		var currentAlignment = 'left';
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
			var text = textInput.value.trim();
			if ( text ) {
				var layerData = {
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
		var fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
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
		var fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
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
		var fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
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
		var fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
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
		var fillColor = ( style && style.fill !== undefined && style.fill !== null ) ?
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
		switch ( this.tempLayer.type ) {
			case 'rectangle':
				this.tempLayer.width = point.x - this.tempLayer.x;
				this.tempLayer.height = point.y - this.tempLayer.y;
				break;
			case 'circle':
				var dx = point.x - this.tempLayer.x;
				var dy = point.y - this.tempLayer.y;
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

		var layer = this.tempLayer;
		this.tempLayer = null;

		// Final adjustments based on tool type
		switch ( layer.type ) {
			case 'rectangle':
				layer.width = point.x - layer.x;
				layer.height = point.y - layer.y;
				break;
			case 'circle':
				var dx = point.x - layer.x;
				var dy = point.y - layer.y;
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
		var prev = this.currentStyle;
		var has = function ( v ) {
			return v !== undefined && v !== null;
		};
		var next = {
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
		var applyToLayer = function ( layer ) {
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

		if ( this.selectedLayerIds && this.selectedLayerIds.length ) {
			for ( var i = 0; i < this.selectedLayerIds.length; i++ ) {
				applyToLayer( this.editor.getLayerById( this.selectedLayerIds[ i ] ) );
			}
			this.renderLayers( this.editor.layers );
		}

		// Reflect selection count in status bar
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { selectionCount: ( this.selectedLayerIds || [] ).length } );
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
			this.renderer.setSelection( this.selectedLayerIds );
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
			var layersToDraw = layers || ( ( this.editor && this.editor.layers ) ? this.editor.layers : [] );
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
		var bounds = this.getLayerBounds( layer );
		if ( !bounds ) {
			return true; // If we can't determine bounds, assume visible
		}

		var viewport = this.viewportBounds;
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
		var dx = 0;
		var dy = 0;
		if ( this.verticalGuides && this.verticalGuides.length ) {
			var left = ( bounds.x || 0 ) + deltaX;
			var right = left + ( bounds.width || 0 );
			var centerX = left + ( bounds.width || 0 ) / 2;
			for ( var i = 0; i < this.verticalGuides.length; i++ ) {
				var gx = this.verticalGuides[ i ];
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
			var top = ( bounds.y || 0 ) + deltaY;
			var bottom = top + ( bounds.height || 0 );
			var centerY = top + ( bounds.height || 0 ) / 2;
			for ( var j = 0; j < this.horizontalGuides.length; j++ ) {
				var gy = this.horizontalGuides[ j ];
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
		var safeText = text == null ? '' : String( text );
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

		var words = text.split( ' ' );
		var lines = [];
		var currentLine = '';

		for ( var i = 0; i < words.length; i++ ) {
			var word = words[ i ];
			var testLine = currentLine + ( currentLine ? ' ' : '' ) + word;
			var metrics = ctx.measureText( testLine );
			var testWidth = metrics.width;

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

		var fontSize = layer.fontSize || 16;
		var fontFamily = layer.fontFamily || 'Arial';
		var sanitizedText = this.sanitizeTextContent( layer.text || '' );
		var lineHeight = fontSize * 1.2;
		var context = this.ctx;
		var canvasWidth = this.canvas ? this.canvas.width : 0;
		var maxLineWidth = layer.maxWidth || ( canvasWidth ? canvasWidth * 0.8 : fontSize * Math.max( sanitizedText.length, 1 ) );

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
		var lines = this.wrapText( sanitizedText, maxLineWidth, context );
		if ( !lines.length ) {
			lines = [ '' ];
		}

		var totalTextWidth = 0;
		var metricsForLongest = null;
		for ( var i = 0; i < lines.length; i++ ) {
			var lineMetrics = context.measureText( lines[ i ] || ' ' );
			if ( lineMetrics.width > totalTextWidth ) {
			
				totalTextWidth = lineMetrics.width;
				metricsForLongest = lineMetrics;
			}
		}
		if ( totalTextWidth === 0 ) {
			var fallbackMetrics = context.measureText( sanitizedText || ' ' );
			totalTextWidth = fallbackMetrics.width;
			metricsForLongest = fallbackMetrics;
		}

		context.restore();

		var ascent = metricsForLongest && typeof metricsForLongest.actualBoundingBoxAscent === 'number' ?
			metricsForLongest.actualBoundingBoxAscent : fontSize * 0.8;
		var descent = metricsForLongest && typeof metricsForLongest.actualBoundingBoxDescent === 'number' ?
			metricsForLongest.actualBoundingBoxDescent : fontSize * 0.2;
		var totalHeight = ascent + descent;
		if ( lines.length > 1 ) {
			totalHeight = ascent + descent + ( lines.length - 1 ) * lineHeight;
		}

		var textAlign = layer.textAlign || 'left';
		var alignOffset = 0;
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

		var originX = ( layer.x ||  0 ) - alignOffset;
		var originY = ( layer.y || 0 ) - ascent;

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
