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
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;
		this.canvas = null;
		this.ctx = null;
		this.backgroundImage = null;
		this.currentTool = 'pointer';
		this.isDrawing = false;
		this.startPoint = null;

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

		this.init();
	}

	CanvasManager.prototype.init = function () {
		// console.log( 'Layers: CanvasManager initializing...' );
		// console.log( 'Layers: Container element:', this.container );

		// Find or create canvas
		this.canvas = this.container.querySelector( 'canvas' );
		if ( !this.canvas ) {
			// console.log( 'Layers: No canvas found, creating one...' );
			this.canvas = document.createElement( 'canvas' );
			this.canvas.className = 'layers-canvas';
			this.container.appendChild( this.canvas );
		}

		this.ctx = this.canvas.getContext( '2d' );

		// console.log( 'Layers: Canvas found/created:', this.canvas );
		// console.log( 'Layers: Context:', this.ctx );

		// Set up event handlers
		this.setupEventHandlers();

		// Load background image first, then set canvas size based on it
		this.loadBackgroundImage();

		// console.log( 'Layers: CanvasManager initialization complete' );
	};

	CanvasManager.prototype.loadBackgroundImage = function () {
		var filename = this.editor.filename;
		var backgroundImageUrl = this.config.backgroundImageUrl;

		// console.log( 'Layers: Starting background image load for:', filename );
		// console.log( 'Layers: Background image URL from config:', backgroundImageUrl );

		var imageUrls = [];

		// Priority 1: Use the specific background image URL from config
		if ( backgroundImageUrl ) {
			imageUrls.push( backgroundImageUrl );
			// console.log( 'Layers: Added config URL to try:', backgroundImageUrl );
		}

		// Priority 2: Try to find the current page image
		var pageImages = document.querySelectorAll( '.mw-file-element img, .fullImageLink img, .filehistory img, img[src*="' + filename + '"]' );
		if ( pageImages.length > 0 ) {
			for ( var i = 0; i < pageImages.length; i++ ) {
				var imgSrc = pageImages[ i ].src;
				if ( imgSrc && imageUrls.indexOf( imgSrc ) === -1 ) {
					imageUrls.push( imgSrc );
					// console.log( 'Layers: Added page image URL to try:', imgSrc );
				}
			}
		}

		// Priority 3: Try MediaWiki patterns if mw is available
		if ( filename && mw && mw.config && mw.config.get( 'wgServer' ) && mw.config.get( 'wgScriptPath' ) ) {
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
					// console.log( 'Layers: Added MediaWiki URL to try:', url );
				}
			} );
		}

		// If we have URLs to try, start loading
		if ( imageUrls.length > 0 ) {
			// console.log( 'Layers: Attempting to load real images, URLs:', imageUrls );
			this.tryLoadImage( imageUrls, 0 );
		} else {
			// console.log( 'Layers: No real image URLs available, using test image' );
			this.useTestImage();
		}
	};

	CanvasManager.prototype.tryLoadImage = function ( urls, index ) {
		var self = this;

		if ( index >= urls.length ) {
			// console.error( 'Layers: Failed to load image from any URL, using test image' );
			this.useTestImage();
			return;
		}

		var currentUrl = urls[ index ];
		// console.log( 'Layers: Attempting to load image from:', currentUrl );

		this.backgroundImage = new Image();
		this.backgroundImage.crossOrigin = 'anonymous'; // Allow cross-origin images

		this.backgroundImage.onload = function () {
			// console.log( 'Layers: Background image loaded successfully from:', currentUrl );
			// console.log( 'Layers: Image dimensions:',
			//  self.backgroundImage.width, 'x', self.backgroundImage.height );

			// Set canvas size to match the image
			self.canvas.width = self.backgroundImage.width;
			self.canvas.height = self.backgroundImage.height;
			// console.log( 'Layers: Canvas size set to:',
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
			// console.warn( 'Layers: Failed to load image from:', currentUrl );
			// Try next URL
			self.tryLoadImage( urls, index + 1 );
		};

		this.backgroundImage.src = currentUrl;
	};

	CanvasManager.prototype.useTestImage = function () {
		var self = this;
		// console.log( 'Layers: Creating test background image...' );

		// Try SVG first
		var svgData = this.createTestImage( this.editor.filename );
		var svgDataUrl = 'data:image/svg+xml;base64,' + btoa( svgData );

		this.backgroundImage = new Image();
		this.backgroundImage.crossOrigin = 'anonymous';

		this.backgroundImage.onload = function () {
			// console.log( 'Layers: Test SVG image loaded successfully' );
			// console.log( 'Layers: Test image dimensions:',
			//  self.backgroundImage.width, 'x', self.backgroundImage.height );

			// Set canvas size to match the image (800x600 for the test image)
			self.canvas.width = 800;
			self.canvas.height = 600;
			// console.log( 'Layers: Canvas size set to:',
			//  self.canvas.width, 'x', self.canvas.height );

			self.resizeCanvas();
			self.redraw();
			if ( self.editor.layers ) {
				self.renderLayers( self.editor.layers );
			}
		};

		this.backgroundImage.onerror = function () {
			// console.warn( 'Layers: SVG test image failed, creating canvas background directly' );
			self.createCanvasBackground();
		};

		this.backgroundImage.src = svgDataUrl;

		// Also create canvas background immediately as backup
		setTimeout( function () {
			if ( !self.backgroundImage || !self.backgroundImage.complete ) {
				// console.log( 'Layers: SVG taking too long, using canvas background' );
				self.createCanvasBackground();
			}
		}, 1000 );
	};

	CanvasManager.prototype.createCanvasBackground = function () {
		// Create a simple background directly on canvas when even SVG fails
		// console.log( 'Layers: Creating canvas background as final fallback' );
		this.backgroundImage = null;

		// Set default canvas size
		this.canvas.width = 800;
		this.canvas.height = 600;

		// Clear and set up the canvas
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

		// Draw background
		this.ctx.fillStyle = '#f8f9fa';
		this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );
		this.ctx.strokeStyle = '#dee2e6';
		this.ctx.lineWidth = 2;
		this.ctx.strokeRect( 1, 1, this.canvas.width - 2, this.canvas.height - 2 );

		// Add text
		this.ctx.fillStyle = '#6c757d';
		this.ctx.font = '24px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';
		this.ctx.fillText( this.editor.filename || 'Sample Image', this.canvas.width / 2, this.canvas.height / 2 - 20 );
		this.ctx.font = '16px Arial';
		this.ctx.fillText( 'Sample Image for Layer Editing', this.canvas.width / 2, this.canvas.height / 2 + 20 );
		this.ctx.font = '12px Arial';
		this.ctx.fillStyle = '#adb5bd';
		this.ctx.fillText( 'Draw shapes and text using the tools above', this.canvas.width / 2, this.canvas.height / 2 + 50 );

		// Add some design elements
		this.ctx.strokeStyle = '#e9ecef';
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		this.ctx.arc( 200, 150, 50, 0, 2 * Math.PI );
		this.ctx.stroke();

		this.ctx.strokeRect( 500, 300, 100, 80 );

		this.ctx.beginPath();
		this.ctx.moveTo( 100, 400 );
		this.ctx.lineTo( 300, 500 );
		this.ctx.stroke();

		// Resize canvas to fit container
		this.resizeCanvas();

		// console.log( 'Layers: Canvas background created successfully' );
		// console.log( 'Layers: Canvas size:', this.canvas.width, 'x', this.canvas.height );
		// console.log( 'Layers: Canvas display size:',
		//  this.canvas.style.width, 'x', this.canvas.style.height );

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
		// console.log( 'Layers: Resizing canvas...' );

		// Get container dimensions
		var container = this.canvas.parentNode;
		// console.log( 'Layers: Container:', container );
		// console.log( 'Layers: Container dimensions:',
		//  container.clientWidth, 'x', container.clientHeight );

		// If no canvas size is set yet, use default
		if ( this.canvas.width === 0 || this.canvas.height === 0 ) {
			this.canvas.width = 800;
			this.canvas.height = 600;
		}

		var canvasWidth = this.canvas.width;
		var canvasHeight = this.canvas.height;

		// console.log( 'Layers: Canvas logical size:', canvasWidth, 'x', canvasHeight );

		// Calculate available space in container (with padding)
		var availableWidth = Math.max( container.clientWidth - 40, 400 );
		var availableHeight = Math.max( container.clientHeight - 40, 300 );

		// console.log( 'Layers: Available space:', availableWidth, 'x', availableHeight );

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

		// console.log( 'Layers: Canvas display size set to', displayWidth, 'x', displayHeight );
		// console.log( 'Layers: Scale factor:', scale );
		// console.log( 'Layers: Final canvas styles:', {
		//     width: this.canvas.style.width,
		//     height: this.canvas.style.height,
		//     border: this.canvas.style.border,
		//     boxShadow: this.canvas.style.boxShadow
		// });
	};

	CanvasManager.prototype.setupEventHandlers = function () {
		var self = this;

		// Mouse events
		this.canvas.addEventListener( 'mousedown', function ( e ) {
			self.handleMouseDown( e );
		} );

		this.canvas.addEventListener( 'mousemove', function ( e ) {
			self.handleMouseMove( e );
		} );

		this.canvas.addEventListener( 'mouseup', function ( e ) {
			self.handleMouseUp( e );
		} );

		// Touch events for mobile support
		this.canvas.addEventListener( 'touchstart', function ( e ) {
			e.preventDefault(); // Prevent scrolling
			self.handleTouchStart( e );
		} );

		this.canvas.addEventListener( 'touchmove', function ( e ) {
			e.preventDefault(); // Prevent scrolling
			self.handleTouchMove( e );
		} );

		this.canvas.addEventListener( 'touchend', function ( e ) {
			e.preventDefault();
			self.handleTouchEnd( e );
		} );

		// Handle pinch-to-zoom on touch devices
		this.canvas.addEventListener( 'touchcancel', function ( e ) {
			e.preventDefault();
			self.handleTouchEnd( e );
		} );

		// Wheel event for zooming
		this.canvas.addEventListener( 'wheel', function ( e ) {
			e.preventDefault();
			self.handleWheel( e );
		} );

		// Prevent context menu
		this.canvas.addEventListener( 'contextmenu', function ( e ) {
			e.preventDefault();
		} );

		// Keyboard events for pan and zoom
		document.addEventListener( 'keydown', function ( e ) {
			self.handleKeyDown( e );
		} );

		document.addEventListener( 'keyup', function ( e ) {
			self.handleKeyUp( e );
		} );

		// Touch events for mobile support
		this.canvas.addEventListener( 'touchstart', function ( e ) {
			e.preventDefault();
			var touch = e.touches[ 0 ];
			var mouseEvent = new MouseEvent( 'mousedown', {
				clientX: touch.clientX,
				clientY: touch.clientY
			} );
			self.canvas.dispatchEvent( mouseEvent );
		} );

		this.canvas.addEventListener( 'touchmove', function ( e ) {
			e.preventDefault();
			var touch = e.touches[ 0 ];
			var mouseEvent = new MouseEvent( 'mousemove', {
				clientX: touch.clientX,
				clientY: touch.clientY
			} );
			self.canvas.dispatchEvent( mouseEvent );
		} );

		this.canvas.addEventListener( 'touchend', function ( e ) {
			e.preventDefault();
			var mouseEvent = new MouseEvent( 'mouseup', {} );
			self.canvas.dispatchEvent( mouseEvent );
		} );
	};

	CanvasManager.prototype.handleMouseDown = function ( e ) {
		var point = this.getMousePoint( e );
		this.startPoint = point;
		this.dragStartPoint = point;

		// console.log( 'Layers: Mouse down at', point, 'tool:', this.currentTool );

		// Begin guide creation when clicking in ruler zones
		if ( this.showRulers ) {
			var rp = this.getRawClientPoint( e );
			var inTopRuler = rp.canvasY < this.rulerSize;
			var inLeftRuler = rp.canvasX < this.rulerSize;
			if ( inTopRuler || inLeftRuler ) {
				this.isDraggingGuide = true;
				this.dragGuideOrientation = inTopRuler ? 'h' : 'v';
				this.dragGuidePos = inTopRuler ? point.y : point.x;
				this.canvas.style.cursor = 'grabbing';
				return;
			}
		}

		// Handle middle mouse button or space+click for panning
		if ( e.button === 1 || ( e.button === 0 && this.spacePressed ) ) {
			this.isPanning = true;
			this.lastPanPoint = { x: e.clientX, y: e.clientY };
			this.canvas.style.cursor = 'grabbing';
			return;
		}

		// Ignore right click
		if ( e.button === 2 ) {
			return;
		}

		// Check for selection handle clicks first
		if ( this.currentTool === 'pointer' && this.selectedLayerId ) {
			var handleHit = this.hitTestSelectionHandles( point );
			if ( handleHit ) {
				this.startResize( handleHit );
				return;
			}

			// Check for rotation handle
			if ( this.rotationHandle && this.isPointInRect( point, this.rotationHandle ) ) {
				this.startRotation( point );
				return;
			}
		}

		this.isDrawing = true;

		if ( this.currentTool === 'zoom' ) {
			// Handle zoom tool - click to zoom in, shift+click to zoom out
			this.handleZoomClick( point, e );
		} else if ( this.currentTool === 'pointer' || this.currentTool === 'marquee' ) {
			// Handle layer selection and dragging
			var isCtrlClick = e.ctrlKey || e.metaKey;
			var selectedLayer = null;
			if ( this.currentTool === 'pointer' ) {
				selectedLayer = this.handleLayerSelection( point, isCtrlClick );
				if ( selectedLayer && !isCtrlClick ) {
					this.startDrag( point );
				} else if ( !selectedLayer && !isCtrlClick ) {
					// Start marquee selection when clicking empty space
					this.startMarqueeSelection( point );
				}
			} else {
				// Explicit marquee tool: always start marquee selection
				this.startMarqueeSelection( point );
			}
		} else {
			// Start drawing new layer
			this.startDrawing( point );
		}
	};

	CanvasManager.prototype.hitTestSelectionHandles = function ( point ) {
		console.log( 'Layers: Hit testing handles at point:', point, 'handles:', this.selectionHandles.length );
		for ( var i = 0; i < this.selectionHandles.length; i++ ) {
			var handle = this.selectionHandles[ i ];
			if ( this.isPointInRect( point, handle ) ) {
				console.log( 'Layers: Handle hit detected:', handle.type );
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
		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartPoint = this.startPoint; // Use the point from handleMouseDown

		// Get rotation for proper cursor
		var layer = this.editor.getLayerById( this.selectedLayerId );
		var rotation = layer ? layer.rotation : 0;
		this.canvas.style.cursor = this.getResizeCursor( handle.type, rotation );

		// Store original layer state
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}

		console.log( 'Layers: Starting resize with handle:', handle.type );
		console.log( 'Layers: dragStartPoint set to:', this.dragStartPoint );
		console.log( 'Layers: originalLayerState:', this.originalLayerState );
	};

	CanvasManager.prototype.startRotation = function () {
		this.isRotating = true;
		this.canvas.style.cursor = 'grabbing';

		// Store original layer state
		var layer = this.editor.getLayerById( this.selectedLayerId );
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}

		// console.log( 'Layers: Starting rotation' );
	};

	CanvasManager.prototype.startDrag = function () {
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

		// console.log( 'Layers: Starting drag' );
	};

	CanvasManager.prototype.getResizeCursor = function ( handleType, rotation ) {
		// If no rotation, use the original cursor logic
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

	CanvasManager.prototype.handleMouseMove = function ( e ) {
		var point = this.getMousePoint( e );
		
		// Debug: Log mouse move when in resize mode
		if ( this.isResizing ) {
			console.log( 'Layers: Mouse move during resize mode. isResizing:', this.isResizing, 'resizeHandle:', this.resizeHandle, 'dragStartPoint:', this.dragStartPoint );
		}
		
		// Guide drag preview rendering
		if ( this.isDraggingGuide ) {
			this.dragGuidePos = ( this.dragGuideOrientation === 'h' ) ? point.y : point.x;
			this.redraw();
			this.renderLayers( this.editor.layers );
			this.drawGuidePreview();
			return;
		}

		// Update status: live cursor position
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( {
				pos: { x: point.x, y: point.y }
			} );
		}

		// Handle marquee selection
		if ( this.isMarqueeSelecting ) {
			this.updateMarqueeSelection( point );
			return;
		}

		if ( this.isPanning ) {
			var deltaX = e.clientX - this.lastPanPoint.x;
			var deltaY = e.clientY - this.lastPanPoint.y;

			// Apply pan offset to canvas position
			var currentTranslateX = this.panX || 0;
			var currentTranslateY = this.panY || 0;

			this.panX = currentTranslateX + deltaX;
			this.panY = currentTranslateY + deltaY;

			this.lastPanPoint = { x: e.clientX, y: e.clientY };

			// Update canvas position
			this.canvas.style.transform = 'translate(' + this.panX + 'px, ' + this.panY + 'px) scale(' + this.zoom + ')';
			this.canvas.style.transformOrigin = '0 0';

			return;
		}

		if ( this.isResizing && this.resizeHandle && this.dragStartPoint ) {
			console.log( 'Layers: Mouse move during resize, calling handleResize' );
			try {
				this.handleResize( point, e );
			} catch ( error ) {
				console.error( 'Layers: Error in handleResize:', error );
			}
			return;
		}

		if ( this.isRotating && this.dragStartPoint ) {
			this.handleRotation( point, e );
			return;
		}

		if ( this.isDragging && this.dragStartPoint ) {
			this.handleDrag( point );
			return;
		}

		if ( !this.isDrawing ) {
			// Update cursor based on what's under the mouse
			this.updateCursor( point );
			return;
		}

		// Handle zoom tool drag
		if ( this.currentTool === 'zoom' && this.isDrawing ) {
			this.handleZoomDrag( point );
			return;
		}

		if ( this.currentTool !== 'pointer' ) {
			this.continueDrawing( point );
		}
	};

	CanvasManager.prototype.handleResize = function ( point, event ) {
		console.log( 'Layers: handleResize called with point:', point );
		var layer = this.editor.getLayerById( this.selectedLayerId );
		console.log( 'Layers: selectedLayerId:', this.selectedLayerId, 'layer:', layer );
		console.log( 'Layers: originalLayerState:', this.originalLayerState );
		
		if ( !layer || !this.originalLayerState ) {
			console.log( 'Layers: handleResize early return - no layer or originalLayerState' );
			console.log( 'Layers: layer exists:', !!layer, 'originalLayerState exists:', !!this.originalLayerState );
			return;
		}

		var deltaX = point.x - this.dragStartPoint.x;
		var deltaY = point.y - this.dragStartPoint.y;
		console.log( 'Layers: Resize delta:', { x: deltaX, y: deltaY } );

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
		console.log( 'Layers: Calculated resize updates:', updates );

		// Apply updates to layer
		if ( updates ) {
			if ( this.editor && this.editor.debug ) {
				this.editor.debugLog( 'Applying updates:', updates );
			}
			Object.keys( updates ).forEach( function ( key ) {
				layer[ key ] = updates[ key ];
			} );
			console.log( 'Layers: Applied updates to layer:', layer );

			// Re-render
			this.renderLayers( this.editor.layers );
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

		// Clamp font size to reasonable bounds
		newFontSize = Math.max( 8, Math.min( 144, newFontSize ) );
		updates.fontSize = Math.round( newFontSize );

		return updates;
	};

	CanvasManager.prototype.handleRotation = function ( point, event ) {
		var layer = this.editor.getLayerById( this.selectedLayerId );
		if ( !layer || !this.rotationHandle ) {
			return;
		}

		// Calculate angle from rotation center to mouse position
		var centerX = this.rotationHandle.centerX;
		var centerY = this.rotationHandle.centerY;

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

		// Re-render
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.handleDrag = function ( point ) {
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

		// Re-render
		this.renderLayers( this.editor.layers );
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
				var selectedLayer = this.editor.getLayerById( this.selectedLayerId );
				var rotation = selectedLayer ? selectedLayer.rotation : 0;
				this.canvas.style.cursor = this.getResizeCursor( handleHit.type, rotation );
				return;
			}

			// Check rotation handle
			if ( this.rotationHandle && this.isPointInRect( point, this.rotationHandle ) ) {
				this.canvas.style.cursor = 'grab';
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
		// Find layer at click point (reverse order for top-most first)
		for ( var i = this.editor.layers.length - 1; i >= 0; i-- ) {
			var layer = this.editor.layers[ i ];
			if ( layer.visible !== false && this.isPointInLayer( point, layer ) ) {
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
				// Create polygon points for hit testing
				var polySides = layer.sides || 6;
				var polyX = layer.x || 0;
				var polyY = layer.y || 0;
				var polyRadius = layer.radius || 50;
				var polyRotation = ( layer.rotation || 0 ) * Math.PI / 180;

				var polyPoints = [];
				if ( layer.type === 'polygon' ) {
					for ( var si = 0; si < polySides; si++ ) {
						var angle = ( si * 2 * Math.PI ) / polySides - Math.PI / 2 + polyRotation;
						polyPoints.push( {
							x: polyX + polyRadius * Math.cos( angle ),
							y: polyY + polyRadius * Math.sin( angle )
						} );
					}
				} else { // star
					var starPoints = layer.points || layer.starPoints || 5;
					var outerRadius = polyRadius;
					var innerRadius = polyRadius * 0.4;
					for ( var sti = 0; sti < starPoints * 2; sti++ ) {
						var starAngle = ( sti * Math.PI ) / starPoints - Math.PI / 2 + polyRotation;
						var starR = ( sti % 2 === 0 ) ? outerRadius : innerRadius;
						polyPoints.push( {
							x: polyX + starR * Math.cos( starAngle ),
							y: polyY + starR * Math.sin( starAngle )
						} );
					}
				}

				// Point-in-polygon test using ray casting
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

	CanvasManager.prototype.handleMouseUp = function ( e ) {
		// Handle marquee selection completion
		if ( this.isMarqueeSelecting ) {
			this.finishMarqueeSelection();
			return;
		}

		// Finish guide creation
		if ( this.isDraggingGuide ) {
			if ( this.dragGuideOrientation === 'h' ) {
				this.addHorizontalGuide( this.dragGuidePos );
			} else if ( this.dragGuideOrientation === 'v' ) {
				this.addVerticalGuide( this.dragGuidePos );
			}
			this.isDraggingGuide = false;
			this.dragGuideOrientation = null;
			this.canvas.style.cursor = this.getToolCursor( this.currentTool );
			this.redraw();
			this.renderLayers( this.editor.layers );
			return;
		}

		if ( this.isPanning ) {
			this.isPanning = false;
			this.canvas.style.cursor = this.getToolCursor( this.currentTool );
			return;
		}

		if ( this.isResizing ) {
			this.finishResize();
			return;
		}

		if ( this.isRotating ) {
			this.finishRotation();
			return;
		}

		if ( this.isDragging ) {
			this.finishDrag();
			return;
		}

		if ( !this.isDrawing ) {
			return;
		}

		var point = this.getMousePoint( e );
		this.isDrawing = false;

		if ( this.currentTool !== 'pointer' ) {
			this.finishDrawing( point );
		}
	};

	CanvasManager.prototype.finishResize = function () {
		console.log( 'Layers: finishResize called' );
		this.isResizing = false;
		this.resizeHandle = null;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor instead of hardcoded 'default'
		this.canvas.style.cursor = this.getToolCursor( this.currentTool );

		// Mark editor as dirty
		this.editor.markDirty();

		// console.log( 'Layers: Resize finished' );
	};

	// Touch event handlers for mobile support
	CanvasManager.prototype.handleTouchStart = function ( e ) {
		var touch = e.touches[ 0 ];
		if ( !touch ) {
			return;
		}

		// Handle multi-touch gestures
		if ( e.touches.length > 1 ) {
			this.handlePinchStart( e );
			return;
		}

		// Convert touch to mouse event
		var mouseEvent = {
			clientX: touch.clientX,
			clientY: touch.clientY,
			button: 0,
			preventDefault: function () {},
			stopPropagation: function () {}
		};

		this.lastTouchTime = Date.now();
		this.handleMouseDown( mouseEvent );
	};

	CanvasManager.prototype.handleTouchMove = function ( e ) {
		var touch = e.touches[ 0 ];
		if ( !touch ) {
			return;
		}

		// Handle multi-touch gestures
		if ( e.touches.length > 1 ) {
			this.handlePinchMove( e );
			return;
		}

		// Convert touch to mouse event
		var mouseEvent = {
			clientX: touch.clientX,
			clientY: touch.clientY,
			button: 0,
			preventDefault: function () {},
			stopPropagation: function () {}
		};

		this.handleMouseMove( mouseEvent );
	};

	CanvasManager.prototype.handleTouchEnd = function ( e ) {
		// Handle double-tap for zoom
		var now = Date.now();
		if ( this.lastTouchTime && ( now - this.lastTouchTime ) < 300 ) {
			this.handleDoubleTap( e );
			return;
		}

		// Handle pinch end
		if ( this.isPinching ) {
			this.handlePinchEnd( e );
			return;
		}

		// Convert touch to mouse event
		var mouseEvent = {
			clientX: 0,
			clientY: 0,
			button: 0,
			preventDefault: function () {},
			stopPropagation: function () {}
		};

		this.handleMouseUp( mouseEvent );
	};

	CanvasManager.prototype.handlePinchStart = function ( e ) {
		if ( e.touches.length !== 2 ) {
			return;
		}

		this.isPinching = true;
		var touch1 = e.touches[ 0 ];
		var touch2 = e.touches[ 1 ];

		this.initialPinchDistance = Math.sqrt(
			Math.pow( touch2.clientX - touch1.clientX, 2 ) +
			Math.pow( touch2.clientY - touch1.clientY, 2 )
		);
		this.initialZoom = this.zoom;
	};

	CanvasManager.prototype.handlePinchMove = function ( e ) {
		if ( !this.isPinching || e.touches.length !== 2 ) {
			return;
		}

		var touch1 = e.touches[ 0 ];
		var touch2 = e.touches[ 1 ];

		var currentDistance = Math.sqrt(
			Math.pow( touch2.clientX - touch1.clientX, 2 ) +
			Math.pow( touch2.clientY - touch1.clientY, 2 )
		);

		var scale = currentDistance / this.initialPinchDistance;
		var newZoom = this.initialZoom * scale;

		// Clamp zoom level
		newZoom = Math.max( 0.1, Math.min( 5.0, newZoom ) );

		this.setZoom( newZoom );
	};

	CanvasManager.prototype.handlePinchEnd = function () {
		this.isPinching = false;
		this.initialPinchDistance = null;
		this.initialZoom = null;
	};

	CanvasManager.prototype.handleDoubleTap = function () {
		// Toggle between fit-to-screen and 100% zoom
		if ( this.zoom < 1.0 ) {
			this.resetZoom();
		} else {
			this.fitToWindow();
		}
	};

	// Duplicate setZoom removed; see the later definition that clamps, updates CSS size, and status

	CanvasManager.prototype.finishRotation = function () {
		this.isRotating = false;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.canvas.style.cursor = this.getToolCursor( this.currentTool );

		// Mark editor as dirty
		this.editor.markDirty();

		// console.log( 'Layers: Rotation finished' );
	};

	CanvasManager.prototype.finishDrag = function () {
		this.isDragging = false;
		this.showDragPreview = false;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.canvas.style.cursor = this.getToolCursor( this.currentTool );

		// Mark editor as dirty
		this.editor.markDirty();

		// console.log( 'Layers: Drag finished' );
	};

	CanvasManager.prototype.handleWheel = function ( e ) {
		// Don't zoom when resizing, rotating, or dragging
		if ( this.isResizing || this.isRotating || this.isDragging || this.isPanning ) {
			e.preventDefault();
			return;
		}

		e.preventDefault();

		var delta = e.deltaY > 0 ? -0.1 : 0.1;
		var newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.zoom + delta ) );

		if ( newZoom !== this.zoom ) {
			// Update zoom
			this.zoom = newZoom;
			this.userHasSetZoom = true; // Mark that user has manually set zoom

			// Update CSS size
			if ( this.backgroundImage ) {
				this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
				this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
			}

			this.updateCanvasTransform();
		}
	};

	CanvasManager.prototype.handleKeyDown = function ( e ) {
		// Don't handle keys when typing in input fields
		if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' ) {
			return;
		}

		// Selection shortcuts
		if ( e.ctrlKey || e.metaKey ) {
			switch ( e.key.toLowerCase() ) {
				case 'a':
					e.preventDefault();
					this.selectAll();
					break;
				case 'd':
					e.preventDefault();
					this.deselectAll();
					break;
				case 'c':
					e.preventDefault();
					this.copySelected();
					break;
				case 'v':
					e.preventDefault();
					this.pasteFromClipboard();
					break;
				case 'x':
					e.preventDefault();
					this.cutSelected();
					break;
				case 'z':
					e.preventDefault();
					if ( e.shiftKey ) {
						this.redo();
					} else {
						this.undo();
					}
					break;
				case '=':
				case '+':
					e.preventDefault();
					this.zoomIn();
					break;
				case '-':
					e.preventDefault();
					this.zoomOut();
					break;
				case '0':
					e.preventDefault();
					this.resetZoom();
					break;
			}
		}

		// Delete selected objects
		if ( e.key === 'Delete' || e.key === 'Backspace' ) {
			e.preventDefault();
			this.deleteSelected();
		}

		// Pan shortcuts with arrow keys
		if ( !e.ctrlKey && !e.metaKey ) {
			var panDistance = 20;
			switch ( e.key ) {
				case 'ArrowUp':
					e.preventDefault();
					this.panY += panDistance;
					this.canvas.style.transform = 'translate(' + this.panX + 'px, ' + this.panY + 'px) scale(' + this.zoom + ')';
					break;
				case 'ArrowDown':
					e.preventDefault();
					this.panY -= panDistance;
					this.canvas.style.transform = 'translate(' + this.panX + 'px, ' + this.panY + 'px) scale(' + this.zoom + ')';
					break;
				case 'ArrowLeft':
					e.preventDefault();
					this.panX += panDistance;
					this.canvas.style.transform = 'translate(' + this.panX + 'px, ' + this.panY + 'px) scale(' + this.zoom + ')';
					break;
				case 'ArrowRight':
					e.preventDefault();
					this.panX -= panDistance;
					this.canvas.style.transform = 'translate(' + this.panX + 'px, ' + this.panY + 'px) scale(' + this.zoom + ')';
					break;
			}
		}

		// Space key for temporary pan mode
		if ( e.code === 'Space' && !e.repeat ) {
			e.preventDefault();
			this.spacePressed = true;
			this.canvas.style.cursor = 'grab';
		}
	};

	CanvasManager.prototype.zoomIn = function () {
		this.setZoom( this.zoom + 0.1 );
	};

	CanvasManager.prototype.zoomOut = function () {
		this.setZoom( this.zoom - 0.1 );
	};

	CanvasManager.prototype.setZoom = function ( newZoom ) {
		this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
		this.userHasSetZoom = true; // Mark that user has manually set zoom

		// Update CSS size based on zoom
		if ( this.backgroundImage ) {
			this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
			this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
		}

		this.updateCanvasTransform();

		// Update status zoom percent
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { zoomPercent: this.zoom * 100 } );
		}

		// console.log( 'Layers: Zoom set to', this.zoom );
	};

	CanvasManager.prototype.resetZoom = function () {
		this.zoom = 1.0;
		this.panX = 0;
		this.panY = 0;
		this.userHasSetZoom = true; // Mark that user has manually reset zoom

		if ( this.backgroundImage ) {
			this.canvas.style.width = this.backgroundImage.width + 'px';
			this.canvas.style.height = this.backgroundImage.height + 'px';
		}

		this.updateCanvasTransform();

		if ( this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( 100 );
		}
		if ( this.editor && typeof this.editor.updateZoomReadout === 'function' ) {
			this.editor.updateZoomReadout( 100 );
		}
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { zoomPercent: 100 } );
		}
	};

	CanvasManager.prototype.fitToWindow = function () {
		if ( !this.backgroundImage ) {
			return;
		}

		var container = this.canvas.parentNode;
		var containerWidth = container.clientWidth - 40; // padding
		var containerHeight = container.clientHeight - 40;

		var scaleX = containerWidth / this.backgroundImage.width;
		var scaleY = containerHeight / this.backgroundImage.height;
		var scale = Math.min( scaleX, scaleY );

		this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, scale ) );
		this.panX = 0;
		this.panY = 0;
		this.userHasSetZoom = true; // Mark that user has manually set zoom

		// Update CSS size
		this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
		this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';

		this.updateCanvasTransform();

		if ( this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( Math.round( this.zoom * 100 ) );
		}
	};

	CanvasManager.prototype.updateCanvasTransform = function () {
		// Update zoom display
		if ( this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( Math.round( this.zoom * 100 ) );
		}
		if ( this.editor && typeof this.editor.updateZoomReadout === 'function' ) {
			this.editor.updateZoomReadout( Math.round( this.zoom * 100 ) );
		}
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { zoomPercent: this.zoom * 100 } );
		}

		// Apply CSS transform for zoom and pan
		var scale = this.zoom;
		var translateX = this.panX;
		var translateY = this.panY;

		this.canvas.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
		this.canvas.style.transformOrigin = '0 0';

		// console.log( 'Layers: Canvas transform updated - zoom:',
		//  this.zoom, 'pan:', this.panX, this.panY );
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

		// Clamp zoom level
		newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );

		if ( newZoom !== this.zoom ) {
			// Calculate zoom center - zoom towards the clicked point
			var centerX = point.x;
			var centerY = point.y;

			// Adjust pan to zoom towards the clicked point
			var zoomChange = newZoom / this.zoom;
			this.panX = centerX - ( centerX - this.panX ) * zoomChange;
			this.panY = centerY - ( centerY - this.panY ) * zoomChange;

			this.zoom = newZoom;
			this.userHasSetZoom = true;

			// Update CSS size
			if ( this.backgroundImage ) {
				this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
				this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
			}

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
			this.zoom = newZoom;
			this.userHasSetZoom = true;

			// Update CSS size
			if ( this.backgroundImage ) {
				this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
				this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
			}

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
		this.redraw();
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
		this.redraw();
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
		return rect1.x < rect2.x + rect2.width &&
			rect1.x + rect1.width > rect2.x &&
			rect1.y < rect2.y + rect2.height &&
			rect1.y + rect1.height > rect2.y;
	};

	// Apply opacity, blend mode, and simple effects per layer scope
	CanvasManager.prototype.applyLayerEffects = function ( layer, drawCallback ) {
		this.ctx.save();
		// Opacity
		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}
		// Blend mode
		if ( layer.blend ) {
			try {
				this.ctx.globalCompositeOperation = String( layer.blend );
			} catch ( e ) {
				// ignore unsupported modes
			}
		}
		// Effects: shadow/glow/strokeEffect (basic interpretations)
		if ( layer.shadow ) {
			this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
			this.ctx.shadowBlur = layer.shadowBlur || 8;
			this.ctx.shadowOffsetX = layer.shadowOffsetX || 2;
			this.ctx.shadowOffsetY = layer.shadowOffsetY || 2;
		}

		// Draw with effects
		try {
			if ( typeof drawCallback === 'function' ) {
				drawCallback();
			}
			// Optional glow: simulate by extra stroke around path-like shapes
			if ( layer.glow && ( layer.type === 'rectangle' || layer.type === 'circle' || layer.type === 'ellipse' || layer.type === 'polygon' || layer.type === 'star' || layer.type === 'line' || layer.type === 'arrow' || layer.type === 'path' ) ) {
				// Simple glow by re-stroking with wider, translucent stroke
				var prevAlpha = this.ctx.globalAlpha;
				this.ctx.globalAlpha = ( prevAlpha || 1 ) * 0.3;
				this.ctx.save();
				this.ctx.strokeStyle = ( layer.stroke || '#000' );
				this.ctx.lineWidth = ( layer.strokeWidth || 1 ) + 6;
				// Redraw the shape outline only where possible
				switch ( layer.type ) {
					case 'rectangle':
						this.ctx.strokeRect(
							layer.x || 0,
							layer.y || 0,
							layer.width || 0,
							layer.height || 0
						);
						break;
					case 'circle':
						this.ctx.beginPath();
						this.ctx.arc(
							layer.x || 0,
							layer.y || 0,
							layer.radius || 0,
							0,
							2 * Math.PI
						);
						this.ctx.stroke();
						break;
					case 'ellipse':
						this.ctx.save();
						this.ctx.translate( layer.x || 0, layer.y || 0 );
						this.ctx.scale( layer.radiusX || 1, layer.radiusY || 1 );
						this.ctx.beginPath();
						this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
						this.ctx.stroke();
						this.ctx.restore();
						break;
					case 'polygon':
					case 'star':
					case 'line':
					case 'arrow':
					case 'path':
						// Skip extra stroke pass for these for now (draw functions already handled)
						break;
				}
				this.ctx.restore();
				this.ctx.globalAlpha = prevAlpha;
			}
		} finally {
			this.ctx.restore();
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
		if ( !this.isMarqueeSelecting ) {
			return;
		}

		var rect = this.getMarqueeRect();

		this.ctx.save();
		this.ctx.strokeStyle = '#007bff';
		this.ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 5, 5 ] );

		this.ctx.fillRect( rect.x, rect.y, rect.width, rect.height );
		this.ctx.strokeRect( rect.x, rect.y, rect.width, rect.height );

		this.ctx.restore();
	};

	CanvasManager.prototype.drawSelectionIndicators = function ( layerId ) {
		var layer = this.editor.getLayerById( layerId );
		if ( !layer ) {
			return;
		}

		this.ctx.save();

		// Get layer bounds (unrotated)
		var bounds = this.getLayerBounds( layer );
		if ( !bounds ) {
			this.ctx.restore();
			return;
		}

		// Apply rotation transformation if the layer has rotation
		var rotation = layer.rotation || 0;
		if ( rotation !== 0 ) {
			// Calculate center of the original bounds for rotation
			var centerX = bounds.x + bounds.width / 2;
			var centerY = bounds.y + bounds.height / 2;

			// Apply the same rotation as the layer
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotation * Math.PI / 180 );

			// Adjust bounds to be relative to the rotation center
			bounds = {
				x: -bounds.width / 2,
				y: -bounds.height / 2,
				width: bounds.width,
				height: bounds.height
			};
		}

		// Draw selection outline
		this.ctx.strokeStyle = '#2196f3';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 5, 5 ] );
		this.ctx.strokeRect( bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2 );

		// Draw selection handles
		this.drawSelectionHandles( bounds, layer );

		// Draw rotation handle
		this.drawRotationHandle( bounds, layer );

		this.ctx.restore();
	};

	CanvasManager.prototype.getLayerBounds = function ( layer ) {
		switch ( layer.type ) {
			case 'rectangle':
				var rectX = layer.x || 0;
				var rectY = layer.y || 0;
				var width = layer.width || 0;
				var height = layer.height || 0;
				var rotation = ( layer.rotation || 0 ) * Math.PI / 180;

				// Handle negative dimensions
				if ( width < 0 ) {
					rectX += width;
					width = -width;
				}
				if ( height < 0 ) {
					rectY += height;
					height = -height;
				}

				if ( rotation === 0 ) {
					return { x: rectX, y: rectY, width: width, height: height };
				}

				// Compute rotated AABB for selection box
				var cx = rectX + width / 2;
				var cy = rectY + height / 2;
				var corners = [
					{ x: rectX, y: rectY },
					{ x: rectX + width, y: rectY },
					{ x: rectX + width, y: rectY + height },
					{ x: rectX, y: rectY + height }
				];
				var cos = Math.cos( rotation );
				var sin = Math.sin( rotation );
				var rx = corners.map( function ( p ) {
					var dx = p.x - cx;
					var dy = p.y - cy;
					return {
						x: cx + dx * cos - dy * sin,
						y: cy + dx * sin + dy * cos
					};
				} );
				var rMinX = Math.min.apply( null, rx.map( function ( p ) {
					return p.x;
				} ) );
				var rMaxX = Math.max.apply( null, rx.map( function ( p ) {
					return p.x;
				} ) );
				var rMinY = Math.min.apply( null, rx.map( function ( p ) {
					return p.y;
				} ) );
				var rMaxY = Math.max.apply( null, rx.map( function ( p ) {
					return p.y;
				} ) );
				return { x: rMinX, y: rMinY, width: rMaxX - rMinX, height: rMaxY - rMinY };

			case 'blur':
				var bx = layer.x || 0;
				var by = layer.y || 0;
				var bw = layer.width || 0;
				var bh = layer.height || 0;

				// Handle negative dimensions
				if ( bw < 0 ) {
					bx += bw;
					bw = -bw;
				}
				if ( bh < 0 ) {
					by += bh;
					bh = -bh;
				}

				return { x: bx, y: by, width: bw, height: bh };

			case 'circle':
				var centerX = layer.x || 0;
				var centerY = layer.y || 0;
				var radius = layer.radius || 0;
				return {
					x: centerX - radius,
					y: centerY - radius,
					width: radius * 2,
					height: radius * 2
				};

			case 'text':
				var textX = layer.x || 0;
				var textY = layer.y || 0;
				var fontSize = layer.fontSize || 16;
				var text = layer.text || '';

				// Estimate text dimensions
				this.ctx.save();
				this.ctx.font = fontSize + 'px ' + ( layer.fontFamily || 'Arial' );
				var metrics = this.ctx.measureText( text );
				this.ctx.restore();

				return {
					x: textX,
					y: textY - fontSize,
					width: metrics.width,
					height: fontSize
				};

			case 'line':
			case 'arrow':
				var x1 = layer.x1 || 0;
				var y1 = layer.y1 || 0;
				var x2 = layer.x2 || 0;
				var y2 = layer.y2 || 0;

				var minX = Math.min( x1, x2 );
				var minY = Math.min( y1, y2 );
				var maxX = Math.max( x1, x2 );
				var maxY = Math.max( y1, y2 );

				return {
					x: minX,
					y: minY,
					width: maxX - minX,
					height: maxY - minY
				};

			case 'polygon':
			case 'star':
				var polyX = layer.x || 0;
				var polyY = layer.y || 0;
				var polyRadius = layer.radius || 50;

				return {
					x: polyX - polyRadius,
					y: polyY - polyRadius,
					width: polyRadius * 2,
					height: polyRadius * 2
				};

			case 'ellipse':
				var ellipseX = layer.x || 0;
				var ellipseY = layer.y || 0;
				var radX = layer.radiusX || layer.radius || 50;
				var radY = layer.radiusY || layer.radius || 50;

				return {
					x: ellipseX - radX,
					y: ellipseY - radY,
					width: radX * 2,
					height: radY * 2
				};

			case 'path':
				if ( !layer.points || layer.points.length === 0 ) {
					return null;
				}

				var pathMinX = layer.points[ 0 ].x;
				var pathMaxX = layer.points[ 0 ].x;
				var pathMinY = layer.points[ 0 ].y;
				var pathMaxY = layer.points[ 0 ].y;

				for ( var pi = 1; pi < layer.points.length; pi++ ) {
					var point = layer.points[ pi ];
					pathMinX = Math.min( pathMinX, point.x );
					pathMaxX = Math.max( pathMaxX, point.x );
					pathMinY = Math.min( pathMinY, point.y );
					pathMaxY = Math.max( pathMaxY, point.y );
				}

				return {
					x: pathMinX,
					y: pathMinY,
					width: pathMaxX - pathMinX,
					height: pathMaxY - pathMinY
				};

			default:
				return null;
		}
	};

	CanvasManager.prototype.drawSelectionHandles = function ( bounds, layer ) {
		this.selectionHandles = []; // Reset handles array

		var handleSize = 12;
		var handleColor = '#2196f3';
		var handleBorderColor = '#ffffff';
		var rotation = ( layer && layer.rotation ) || 0;

		// Define handle positions (8 handles: 4 corners + 4 midpoints)
		var handles = [
			{ type: 'nw', x: bounds.x, y: bounds.y },
			{ type: 'n', x: bounds.x + bounds.width / 2, y: bounds.y },
			{ type: 'ne', x: bounds.x + bounds.width, y: bounds.y },
			{ type: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
			{ type: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
			{ type: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
			{ type: 'sw', x: bounds.x, y: bounds.y + bounds.height },
			{ type: 'w', x: bounds.x, y: bounds.y + bounds.height / 2 }
		];

		// Calculate actual world coordinates for hit testing
		// These need to be in the same coordinate space as getMousePoint()
		var actualHandles = [];

		// Get the original bounds in world coordinates
		var originalBounds = this.getLayerBounds( layer );
		if ( !originalBounds ) {
			return;
		}
		var centerX = originalBounds.x + originalBounds.width / 2;
		var centerY = originalBounds.y + originalBounds.height / 2;

		// Define handles in world coordinates based on original bounds
		var worldHandles = [
			{ type: 'nw', x: originalBounds.x, y: originalBounds.y },
			{ type: 'n', x: originalBounds.x + originalBounds.width / 2, y: originalBounds.y },
			{ type: 'ne', x: originalBounds.x + originalBounds.width, y: originalBounds.y },
			{ type: 'e', x: originalBounds.x + originalBounds.width, y: originalBounds.y + originalBounds.height / 2 },
			{ type: 'se', x: originalBounds.x + originalBounds.width, y: originalBounds.y + originalBounds.height },
			{ type: 's', x: originalBounds.x + originalBounds.width / 2, y: originalBounds.y + originalBounds.height },
			{ type: 'sw', x: originalBounds.x, y: originalBounds.y + originalBounds.height },
			{ type: 'w', x: originalBounds.x, y: originalBounds.y + originalBounds.height / 2 }
		];

		if ( rotation !== 0 && layer ) {
			var rotRad = rotation * Math.PI / 180;
			var cos = Math.cos( rotRad );
			var sin = Math.sin( rotRad );

			worldHandles.forEach( function ( handle ) {
				// Translate to origin, rotate, then translate back
				var relX = handle.x - centerX;
				var relY = handle.y - centerY;
				var rotatedX = centerX + relX * cos - relY * sin;
				var rotatedY = centerY + relX * sin + relY * cos;

				actualHandles.push( {
					type: handle.type,
					x: rotatedX - handleSize / 2,
					y: rotatedY - handleSize / 2,
					width: handleSize,
					height: handleSize
				} );
			} );
		} else {
			// No rotation, use handles as-is
			worldHandles.forEach( function ( handle ) {
				actualHandles.push( {
					type: handle.type,
					x: handle.x - handleSize / 2,
					y: handle.y - handleSize / 2,
					width: handleSize,
					height: handleSize
				} );
			} );
		}

		// Store handles for hit testing in world coordinates
		this.selectionHandles = actualHandles;
		console.log( 'Layers: Created', actualHandles.length, 'selection handles:', actualHandles );

		// Draw handles in the current transformed coordinate space
		handles.forEach( function ( handle ) {
			// Draw handle
			this.ctx.fillStyle = handleColor;
			this.ctx.strokeStyle = handleBorderColor;
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash( [] );

			this.ctx.fillRect(
				handle.x - handleSize / 2,
				handle.y - handleSize / 2,
				handleSize,
				handleSize
			);
			this.ctx.strokeRect(
				handle.x - handleSize / 2,
				handle.y - handleSize / 2,
				handleSize,
				handleSize
			);
		}.bind( this ) );
	};

	CanvasManager.prototype.drawRotationHandle = function ( bounds, layer ) {
		var handleSize = 12;
		var handleColor = '#ff9800';
		var handleBorderColor = '#ffffff';
		var lineColor = '#2196f3';
		var rotation = ( layer && layer.rotation ) || 0;

		// Rotation handle position (above the selection)
		var rotationHandleX = bounds.x + bounds.width / 2;
		var rotationHandleY = bounds.y - 25;

		// Calculate actual world coordinates for hit testing
		var actualHandleX = rotationHandleX;
		var actualHandleY = rotationHandleY;
		var centerX = bounds.x + bounds.width / 2;
		var centerY = bounds.y + bounds.height / 2;

		if ( rotation !== 0 && layer ) {
			// Get the original layer bounds for calculating the center
			var originalBounds = this.getLayerBounds( layer );
			var originalCenterX = originalBounds.x + originalBounds.width / 2;
			var originalCenterY = originalBounds.y + originalBounds.height / 2;
			var rotRad = rotation * Math.PI / 180;
			var cos = Math.cos( rotRad );
			var sin = Math.sin( rotRad );

			// Transform rotation handle position back to world coordinates
			actualHandleX = originalCenterX + rotationHandleX * cos - rotationHandleY * sin;
			actualHandleY = originalCenterY + rotationHandleX * sin + rotationHandleY * cos;

			// Use original center for rotation center in hit testing
			centerX = originalCenterX;
			centerY = originalCenterY;
		}

		// Store rotation handle for hit testing (in world coordinates)
		this.rotationHandle = {
			x: actualHandleX - handleSize / 2,
			y: actualHandleY - handleSize / 2,
			width: handleSize,
			height: handleSize,
			centerX: centerX,
			centerY: centerY
		};

		// Draw connection line (in transformed coordinate space)
		this.ctx.strokeStyle = lineColor;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );
		this.ctx.beginPath();
		this.ctx.moveTo( bounds.x + bounds.width / 2, bounds.y );
		this.ctx.lineTo( rotationHandleX, rotationHandleY );
		this.ctx.stroke();

		// Draw rotation handle (circle) (in transformed coordinate space)
		this.ctx.fillStyle = handleColor;
		this.ctx.strokeStyle = handleBorderColor;
		this.ctx.lineWidth = 1;

		this.ctx.beginPath();
		this.ctx.arc( rotationHandleX, rotationHandleY, handleSize / 2, 0, 2 * Math.PI );
		this.ctx.fill();
		this.ctx.stroke();
	};

	// Draw background grid if enabled
	CanvasManager.prototype.drawGrid = function () {
		if ( !this.showGrid ) {
			return;
		}

		var size = this.gridSize || 20;
		var w = this.canvas.width;
		var h = this.canvas.height;

		this.ctx.save();
		this.ctx.strokeStyle = '#e9ecef';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );

		// Vertical lines
		for ( var x = 0; x <= w; x += size ) {
			this.ctx.beginPath();
			this.ctx.moveTo( x, 0 );
			this.ctx.lineTo( x, h );
			this.ctx.stroke();
		}

		// Horizontal lines
		for ( var y = 0; y <= h; y += size ) {
			this.ctx.beginPath();
			this.ctx.moveTo( 0, y );
			this.ctx.lineTo( w, y );
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.toggleGrid = function () {
		this.showGrid = !this.showGrid;
		this.redraw();
		this.renderLayers( this.editor.layers );
	};

	// Selection helpers
	CanvasManager.prototype.selectLayer = function ( layerId, fromPanel ) {
		this.selectedLayerId = layerId || null;
		this.selectedLayerIds = this.selectedLayerId ? [ this.selectedLayerId ] : [];
		this.selectionHandles = [];
		this.redraw();
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
		this.redraw();
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
		this.redraw();
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

		this.redraw();
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
			self.editor.layers.push( clone );
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

	// Key up handling (exit pan mode etc.)
	CanvasManager.prototype.handleKeyUp = function ( e ) {
		if ( e.code === 'Space' ) {
			this.spacePressed = false;
			this.canvas.style.cursor = this.getToolCursor( this.currentTool );
		}
	};

	// External resize hook used by editor
	CanvasManager.prototype.handleCanvasResize = function () {
		this.resizeCanvas();
		this.updateCanvasTransform();
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.getMousePoint = function ( e ) {
		var rect = this.canvas.getBoundingClientRect();

		// Get mouse position relative to canvas
		var clientX = e.clientX - rect.left;
		var clientY = e.clientY - rect.top;

		// Convert from display coordinates to canvas coordinates
		// Account for CSS transforms (zoom and pan)
		var canvasX = ( clientX - ( this.panX || 0 ) ) / this.zoom;
		var canvasY = ( clientY - ( this.panY || 0 ) ) / this.zoom;

		// Snap to grid if enabled (optimize with cached grid size)
		if ( this.snapToGrid && this.gridSize > 0 ) {
			var gridSize = this.gridSize; // Cache to avoid repeated property access
			canvasX = Math.round( canvasX / gridSize ) * gridSize;
			canvasY = Math.round( canvasY / gridSize ) * gridSize;
		}

		return {
			x: canvasX,
			y: canvasY
		};
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
		this.showRulers = !this.showRulers;
		this.redraw();
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.toggleGuidesVisibility = function () {
		this.showGuides = !this.showGuides;
		this.redraw();
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.toggleSnapToGrid = function () {
		this.snapToGrid = !this.snapToGrid;
	};

	CanvasManager.prototype.toggleSnapToGuides = function () {
		this.snapToGuides = !this.snapToGuides;
	};

	CanvasManager.prototype.toggleSmartGuides = function () {
		this.smartGuides = !this.smartGuides;
	};

	CanvasManager.prototype.startDrawing = function ( point ) {
		// console.log( 'Layers: Starting to draw with tool:',
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
				// console.warn( 'Unknown tool:', this.currentTool );
		}

		// console.log( 'Layers: Temp layer created:', this.tempLayer );
	};

	CanvasManager.prototype.continueDrawing = function ( point ) {
		// Continue drawing based on current tool
		if ( this.tempLayer ) {
			this.redraw();
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
		}

		// Clean up
		this.tempLayer = null;
		this.redraw();
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
		// console.log( 'Layers: Starting pen tool at point:', point, 'with style:', style );

		// Create a path for free-hand drawing
		this.tempLayer = {
			type: 'path',
			points: [ point ],
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'none'
		};

		// console.log( 'Layers: Created temp layer for pen:', this.tempLayer );
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
			'z-index: 10001;' +
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

		// Event handlers
		var textInput = modal.querySelector( '.text-input' );
		var fontFamilyInput = modal.querySelector( '.font-family-input' );
		var fontSizeInput = modal.querySelector( '.font-size-input' );
		var colorInput = modal.querySelector( '.color-input' );
		var alignButtons = modal.querySelectorAll( '.align-btn' );
		var addBtn = modal.querySelector( '.add-btn' );
		var cancelBtn = modal.querySelector( '.cancel-btn' );

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
					textStrokeColor: style.textStrokeColor || '#000000',
					textStrokeWidth: style.textStrokeWidth || 0,
					textShadow: style.textShadow || false,
					textShadowColor: style.textShadowColor || '#000000'
				};
				self.editor.addLayer( layerData );
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

	CanvasManager.prototype.startCircleTool = function ( point, style ) {
		// Store starting point for circle
		this.tempLayer = {
			type: 'circle',
			x: point.x,
			y: point.y,
			radius: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'transparent'
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
		this.tempLayer = {
			type: 'ellipse',
			x: point.x,
			y: point.y,
			radiusX: 0,
			radiusY: 0,
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'transparent'
		};
	};

	CanvasManager.prototype.startPolygonTool = function ( point, style ) {
		this.tempLayer = {
			type: 'polygon',
			x: point.x,
			y: point.y,
			radius: 0,
			sides: 6, // Default hexagon
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'transparent'
		};
	};

	CanvasManager.prototype.startStarTool = function ( point, style ) {
		this.tempLayer = {
			type: 'star',
			x: point.x,
			y: point.y,
			outerRadius: 0,
			innerRadius: 0,
			points: 5, // Default 5-pointed star
			stroke: style.color || '#000000',
			strokeWidth: style.strokeWidth || 2,
			fill: 'transparent'
		};
	};

	CanvasManager.prototype.drawPreview = function ( point ) {
		if ( !this.tempLayer ) {
			return;
		}

		switch ( this.tempLayer.type ) {
			case 'rectangle':
				this.tempLayer.width = point.x - this.tempLayer.x;
				this.tempLayer.height = point.y - this.tempLayer.y;
				this.drawRectangle( this.tempLayer );
				break;
			case 'circle':
				var dx = point.x - this.tempLayer.x;
				var dy = point.y - this.tempLayer.y;
				this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
				this.drawCircle( this.tempLayer );
				break;
			case 'ellipse':
				this.tempLayer.radiusX = Math.abs( point.x - this.tempLayer.x );
				this.tempLayer.radiusY = Math.abs( point.y - this.tempLayer.y );
				this.drawEllipse( this.tempLayer );
				break;
			case 'polygon':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.radius = Math.sqrt( dx * dx + dy * dy );
				this.drawPolygon( this.tempLayer );
				break;
			case 'star':
				dx = point.x - this.tempLayer.x;
				dy = point.y - this.tempLayer.y;
				this.tempLayer.outerRadius = Math.sqrt( dx * dx + dy * dy );
				this.tempLayer.innerRadius = this.tempLayer.outerRadius * 0.5;
				this.drawStar( this.tempLayer );
				break;
			case 'line':
				this.tempLayer.x2 = point.x;
				this.tempLayer.y2 = point.y;
				this.drawLine( this.tempLayer );
				break;
			case 'arrow':
				this.tempLayer.x2 = point.x;
				this.tempLayer.y2 = point.y;
				this.drawArrow( this.tempLayer );
				break;
			case 'highlight':
				this.tempLayer.width = point.x - this.tempLayer.x;
				this.drawHighlight( this.tempLayer );
				break;
			case 'path':
				// Add point to path for pen tool
				this.tempLayer.points.push( point );
				this.drawPath( this.tempLayer );
				break;
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
		// console.log( 'Layers: Setting tool to:', tool );
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
			arrowStyle: has( options.arrowStyle ) ? options.arrowStyle : prev.arrowStyle
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
		// Avoid unnecessary redraws
		if ( this.isRendering ) {
			return;
		}
		this.isRendering = true;

		try {
			// Debug: Log rendering start (only if debug mode enabled)
			if ( this.editor && this.editor.debug ) {
				this.editor.debugLog( 'Starting renderLayers with', layers ? layers.length : 0, 'layers' );
			}

			// Redraw background
			this.redraw();

			// Render each layer in order
			if ( layers && layers.length > 0 ) {
				// Debug: Log layers processing (only if debug mode enabled)
				if ( this.editor && this.editor.debug ) {
					this.editor.debugLog( 'Processing layers array' );
				}
				// Batch operations for better performance
				this.ctx.save();

				layers.forEach( function ( layer, index ) {
					// Debug: Log layer processing (only if debug mode enabled)
					if ( this.editor && this.editor.debug ) {
						this.editor.debugLog( 'Processing layer', index, 'visible:', layer.visible, 'type:', layer.type );
					}
					if ( layer.visible !== false ) { // Skip invisible layers early
						this.applyLayerEffects( layer, function () {
							// Debug: Log layer drawing (only if debug mode enabled)
							if ( this.editor && this.editor.debug ) {
								this.editor.debugLog( 'Drawing layer', index, layer.type );
							}
							this.drawLayer( layer );
						}.bind( this ) );
					} else if ( this.editor && this.editor.debug ) {
						this.editor.debugLog( 'Skipping invisible layer', index );
					}
				}.bind( this ) );

				this.ctx.restore();
			} else if ( this.editor && this.editor.debug ) {
				this.editor.debugLog( 'No layers to render' );
			}

			// Draw selection indicators if any layer is selected
			if ( this.selectedLayerId ) {
				this.drawSelectionIndicators( this.selectedLayerId );

				// Update status with selection size
				try {
					var sel = null;
					if ( this.editor && this.editor.getLayerById ) {
						sel = this.editor.getLayerById( this.selectedLayerId );
					}
					if ( sel && this.editor && typeof this.editor.updateStatus === 'function' ) {
						var b = this.getLayerBounds( sel );
						if ( b ) {
							this.editor.updateStatus( {
								size: { width: b.width, height: b.height }
							} );
						}
					}
				} catch ( _e ) {}
			}

			// Draw guides on top
			this.drawGuides();

			// Draw preview guide while dragging from ruler
			this.drawGuidePreview();

			// Debug: Log completion (only if debug mode enabled)
			if ( this.editor && this.editor.debug ) {
				this.editor.debugLog( 'renderLayers completed successfully' );
			}
		} catch ( error ) {
			// Log error using proper error handling
			if ( this.editor && this.editor.errorLog ) {
				this.editor.errorLog( 'Error during rendering:', error );
			}
			// Log error to MediaWiki if available, otherwise to console as fallback
			if ( window.mw && window.mw.log ) {
				window.mw.log.error( 'Layers: Error during rendering:', error );
			}
		} finally {
			this.isRendering = false;
		}
	};

	CanvasManager.prototype.redraw = function () {
		// console.log( 'Layers: Redrawing canvas...' );
		// console.log( 'Layers: Background image status:',
		//  this.backgroundImage ? 'loaded' : 'none',
		//             this.backgroundImage ? ('complete: ' + this.backgroundImage.complete) : '' );

		// Clear canvas
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

		// Draw background image if available
		if ( this.backgroundImage && this.backgroundImage.complete ) {
			// console.log( 'Layers: Drawing background image',
			//  this.backgroundImage.width + 'x' + this.backgroundImage.height );
			this.ctx.drawImage( this.backgroundImage, 0, 0 );
		} else {
			// Draw a pattern background to show that this is the canvas area
			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );

			// Draw a checker pattern to indicate "no image loaded"
			this.ctx.fillStyle = '#f0f0f0';
			var checkerSize = 20;
			for ( var x = 0; x < this.canvas.width; x += checkerSize * 2 ) {
				for ( var y = 0; y < this.canvas.height; y += checkerSize * 2 ) {
					this.ctx.fillRect( x, y, checkerSize, checkerSize );
					this.ctx.fillRect( x + checkerSize, y + checkerSize, checkerSize, checkerSize );
				}
			}

			// Draw a message in the center
			this.ctx.fillStyle = '#666666';
			this.ctx.font = '24px Arial';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			var text = this.backgroundImage ? 'Loading image...' : 'No image loaded';
			this.ctx.fillText( text, this.canvas.width / 2, this.canvas.height / 2 );

			// console.log( 'Layers: Drew placeholder background with message:', text );
		}

		// Draw grid if enabled
		this.drawGrid();

		// Draw rulers after background/grid
		this.drawRulers();
	};

	CanvasManager.prototype.drawLayer = function ( layer ) {
		// Skip invisible layers
		if ( layer.visible === false ) {
			return;
		}

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
		// Draw a blurred version of the background inside the rect
		var x = layer.x || 0;
		var y = layer.y || 0;
		var w = layer.width || 0;
		var h = layer.height || 0;
		if ( w <= 0 || h <= 0 ) {
			return;
		}
		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect( x, y, w, h );
		this.ctx.clip();
		var radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );
		var prevFilter = this.ctx.filter || 'none';
		this.ctx.filter = 'blur(' + radius + 'px)';
		if ( this.backgroundImage && this.backgroundImage.complete ) {
			this.ctx.drawImage( this.backgroundImage, 0, 0 );
		} else {
			// Fallback: blur current canvas content by redrawing nothing special
			// (kept for compatibility; effect minimal when no background)
		}
		this.ctx.filter = prevFilter;
		this.ctx.restore();
	};

	// Draw rulers (top and left bars with ticks)
	CanvasManager.prototype.drawRulers = function () {
		if ( !this.showRulers ) {
			return;
		}

		var size = this.rulerSize;
		var w = this.canvas.width;
		var h = this.canvas.height;

		this.ctx.save();
		this.ctx.fillStyle = '#f3f3f3';
		this.ctx.fillRect( 0, 0, w, size );
		this.ctx.fillRect( 0, 0, size, h );
		this.ctx.strokeStyle = '#ddd';
		this.ctx.beginPath();
		this.ctx.moveTo( 0, size + 0.5 );
		this.ctx.lineTo( w, size + 0.5 );
		this.ctx.moveTo( size + 0.5, 0 );
		this.ctx.lineTo( size + 0.5, h );
		this.ctx.stroke();

		// ticks
		var tickStep = 50;
		this.ctx.fillStyle = '#666';
		this.ctx.strokeStyle = '#bbb';
		this.ctx.font = '10px Arial';
		this.ctx.textAlign = 'center';
		for ( var x = size; x <= w; x += tickStep ) {
			this.ctx.beginPath();
			this.ctx.moveTo( x + 0.5, 0 );
			this.ctx.lineTo( x + 0.5, size );
			this.ctx.stroke();
			this.ctx.fillText( Math.round( ( x - size ) ), x, size - 6 );
		}
		this.ctx.textAlign = 'right';
		this.ctx.textBaseline = 'middle';
		for ( var y = size; y <= h; y += tickStep ) {
			this.ctx.beginPath();
			this.ctx.moveTo( 0, y + 0.5 );
			this.ctx.lineTo( size, y + 0.5 );
			this.ctx.stroke();
			this.ctx.fillText( Math.round( ( y - size ) ), size - 4, y );
		}
		this.ctx.restore();
	};

	CanvasManager.prototype.drawGuides = function () {
		if ( !this.showGuides ) {
			return;
		}
		this.ctx.save();
		this.ctx.strokeStyle = '#26c6da';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 4, 4 ] );
		var size = this.rulerSize;
		for ( var i = 0; i < this.verticalGuides.length; i++ ) {
			var gx = this.verticalGuides[ i ];
			this.ctx.beginPath();
			this.ctx.moveTo( gx + 0.5, 0 );
			this.ctx.lineTo( gx + 0.5, this.canvas.height );
			this.ctx.stroke();
			if ( this.showRulers ) {
				this.ctx.fillStyle = '#26c6da';
				this.ctx.fillRect( gx - 1, 0, 2, size );
			}
		}
		for ( var j = 0; j < this.horizontalGuides.length; j++ ) {
			var gy = this.horizontalGuides[ j ];
			this.ctx.beginPath();
			this.ctx.moveTo( 0, gy + 0.5 );
			this.ctx.lineTo( this.canvas.width, gy + 0.5 );
			this.ctx.stroke();
			if ( this.showRulers ) {
				this.ctx.fillStyle = '#26c6da';
				this.ctx.fillRect( 0, gy - 1, size, 2 );
			}
		}
		this.ctx.restore();
	};

	CanvasManager.prototype.drawGuidePreview = function () {
		if ( !this.isDraggingGuide ) {
			return;
		}
		this.ctx.save();
		this.ctx.strokeStyle = '#ff4081';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 8, 4 ] );
		if ( this.dragGuideOrientation === 'h' ) {
			this.ctx.beginPath();
			this.ctx.moveTo( 0, this.dragGuidePos + 0.5 );
			this.ctx.lineTo( this.canvas.width, this.dragGuidePos + 0.5 );
			this.ctx.stroke();
		} else if ( this.dragGuideOrientation === 'v' ) {
			this.ctx.beginPath();
			this.ctx.moveTo( this.dragGuidePos + 0.5, 0 );
			this.ctx.lineTo( this.dragGuidePos + 0.5, this.canvas.height );
			this.ctx.stroke();
		}
		this.ctx.restore();
	};

	CanvasManager.prototype.getGuideSnapDelta = function ( bounds, deltaX, deltaY, tol ) {
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

	CanvasManager.prototype.drawText = function ( layer ) {
		this.ctx.save();

		var x = layer.x || 0;
		var y = layer.y || 0;

		this.ctx.font = ( layer.fontSize || 16 ) + 'px ' + ( layer.fontFamily || 'Arial' );
		this.ctx.textAlign = layer.textAlign || 'left';

		// Input sanitization: strip control characters and dangerous HTML from text
		var text = layer.text || '';
		// Remove control characters - keep only printable ASCII and Unicode characters
		text = String( text ).replace( /[^\x20-\x7E\u00A0-\uFFFF]/g, '' );
		text = text.replace( /<[^>]+>/g, '' );

		// Calculate text dimensions for proper rotation centering
		var textMetrics = this.ctx.measureText( text );
		var textWidth = textMetrics.width;
		var textHeight = layer.fontSize || 16;

		// Calculate text center for rotation
		var centerX = x + ( textWidth / 2 );
		var centerY = y - ( textHeight / 4 ); // Adjust for text baseline

		// Apply rotation if present
		if ( layer.rotation && layer.rotation !== 0 ) {
			var rotationRadians = ( layer.rotation * Math.PI ) / 180;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotationRadians );
			// Adjust drawing position to account for center rotation
			x = -( textWidth / 2 );
			y = textHeight / 4;
		}

		// Apply text shadow if enabled
		if ( layer.textShadow ) {
			this.ctx.shadowColor = layer.textShadowColor || '#000000';
			this.ctx.shadowOffsetX = 2;
			this.ctx.shadowOffsetY = 2;
			this.ctx.shadowBlur = 4;
		}

		// Draw text stroke if enabled
		if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
			this.ctx.strokeStyle = layer.textStrokeColor || '#000000';
			this.ctx.lineWidth = layer.textStrokeWidth;
			this.ctx.strokeText( text, x, y );
		}

		// Draw text fill (respect optional fillOpacity)
		this.ctx.fillStyle = layer.fill || '#000000';
		var tFillOp = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
		this.withLocalAlpha( tFillOp, function () {
			this.ctx.fillText( text, x, y );
		}.bind( this ) );

		this.ctx.restore();
	};
	// Accessibility: Add ARIA roles and keyboard navigation stubs
	// TODO: Implement more comprehensive keyboard navigation and screen reader support
	// for canvas elements

	// Analytics: Stub for usage tracking
	// TODO: Add analytics hooks for canvas actions (e.g., draw, select, delete)

	// Testing: Stub for unit/E2E tests
	// TODO: Add unit and integration tests for CanvasManager

	CanvasManager.prototype.drawRectangle = function ( layer ) {
		this.ctx.save();

		var x = layer.x || 0;
		var y = layer.y || 0;
		var w = layer.width || 0;
		var h = layer.height || 0;
		var rot = ( layer.rotation || 0 ) * Math.PI / 180;

		if ( rot !== 0 ) {
			var cx = x + w / 2;
			var cy = y + h / 2;
			this.ctx.translate( cx, cy );
			this.ctx.rotate( rot );
			x = -w / 2;
			y = -h / 2;
		}

		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			var fOp = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
			this.withLocalAlpha( fOp, function () {
				this.ctx.fillRect( x, y, w, h );
			}.bind( this ) );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			var sOp = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
			this.withLocalAlpha( sOp, function () {
				this.ctx.strokeRect( x, y, w, h );
			}.bind( this ) );
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.drawCircle = function ( layer ) {
		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.arc( layer.x, layer.y, layer.radius, 0, 2 * Math.PI );

		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			var fOp2 = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
			this.withLocalAlpha( fOp2, function () {
				this.ctx.fill();
			}.bind( this ) );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			var sOp2 = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
			this.withLocalAlpha( sOp2, function () {
				this.ctx.stroke();
			}.bind( this ) );
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.drawLine = function ( layer ) {
		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 1;

		this.ctx.beginPath();
		this.ctx.moveTo( layer.x1, layer.y1 );
		this.ctx.lineTo( layer.x2, layer.y2 );
		var sOp3 = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
		this.withLocalAlpha( sOp3, function () {
			this.ctx.stroke();
		}.bind( this ) );

		this.ctx.restore();
	};

	CanvasManager.prototype.drawArrow = function ( layer ) {
		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.fillStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 1;

		var x1 = layer.x1 || 0;
		var y1 = layer.y1 || 0;
		var x2 = layer.x2 || 0;
		var y2 = layer.y2 || 0;
		var arrowSize = layer.arrowSize || 10;
		var arrowStyle = layer.arrowStyle || 'single';

		// Draw line
		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );
		var sOp4 = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
		this.withLocalAlpha( sOp4, function () {
			this.ctx.stroke();
		}.bind( this ) );

		// Draw arrowheads based on style
		if ( arrowStyle === 'single' || arrowStyle === 'double' ) {
			this.drawArrowHead( x2, y2, x1, y1, arrowSize );
		}

		if ( arrowStyle === 'double' ) {
			this.drawArrowHead( x1, y1, x2, y2, arrowSize );
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.drawArrowHead = function ( tipX, tipY, baseX, baseY, size ) {
		// Calculate arrow head angle
		var angle = Math.atan2( tipY - baseY, tipX - baseX );
		var arrowAngle = Math.PI / 6; // 30 degrees

		// Draw arrow head
		this.ctx.beginPath();
		this.ctx.moveTo( tipX, tipY );
		this.ctx.lineTo(
			tipX - size * Math.cos( angle - arrowAngle ),
			tipY - size * Math.sin( angle - arrowAngle )
		);
		this.ctx.moveTo( tipX, tipY );
		this.ctx.lineTo(
			tipX - size * Math.cos( angle + arrowAngle ),
			tipY - size * Math.sin( angle + arrowAngle )
		);
		var sOpAH = 1;
		if ( this.editor && this.editor.getLayerById && this.selectedLayerId ) {
			// Try to respect stroke opacity of selected layer if available
			var lay = this.editor.getLayerById( this.selectedLayerId );
			sOpAH = ( lay && typeof lay.strokeOpacity === 'number' ) ? lay.strokeOpacity : 1;
		}
		this.withLocalAlpha( sOpAH, function () {
			this.ctx.stroke();
		}.bind( this ) );
	};

	CanvasManager.prototype.drawHighlight = function ( layer ) {
		this.ctx.save();

		// Draw semi-transparent highlight
		this.ctx.fillStyle = layer.fill || '#ffff0080';
		var fOpH = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
		this.withLocalAlpha( fOpH, function () {
			this.ctx.fillRect( layer.x, layer.y, layer.width, layer.height );
		}.bind( this ) );

		this.ctx.restore();
	};

	CanvasManager.prototype.drawPath = function ( layer ) {
		if ( !layer.points || layer.points.length < 2 ) {
			return;
		}

		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';

		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		for ( var i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		var sOpP = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
		this.withLocalAlpha( sOpP, function () {
			this.ctx.stroke();
		}.bind( this ) );
		this.ctx.restore();
	};

	CanvasManager.prototype.drawEllipse = function ( layer ) {
		this.ctx.save();
		this.ctx.beginPath();

		var x = layer.x || 0;
		var y = layer.y || 0;
		var radiusX = layer.radiusX || layer.width / 2 || 0;
		var radiusY = layer.radiusY || layer.height / 2 || 0;

		// Create ellipse using scaling transformation
		this.ctx.translate( x, y );
		this.ctx.scale( radiusX, radiusY );
		this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
		this.ctx.restore();

		this.ctx.save();
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			var fOpE = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
			this.withLocalAlpha( fOpE, function () {
				this.ctx.fill();
			}.bind( this ) );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			var sOpE = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
			this.withLocalAlpha( sOpE, function () {
				this.ctx.stroke();
			}.bind( this ) );
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.drawPolygon = function ( layer ) {
		var sides = layer.sides || 6;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radius = layer.radius || 50;
		var rotation = layer.rotation || 0;

		this.ctx.save();

		// Apply rotation if specified
		if ( rotation !== 0 ) {
			this.ctx.translate( x, y );
			this.ctx.rotate( rotation * Math.PI / 180 );
			this.ctx.translate( -x, -y );
		}

		this.ctx.beginPath();

		for ( var i = 0; i < sides; i++ ) {
			var angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
			var px = x + radius * Math.cos( angle );
			var py = y + radius * Math.sin( angle );

			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}

		this.ctx.closePath();

		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			var fOpPg = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
			this.withLocalAlpha( fOpPg, function () {
				this.ctx.fill();
			}.bind( this ) );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			var sOpPg = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
			this.withLocalAlpha( sOpPg, function () {
				this.ctx.stroke();
			}.bind( this ) );
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.drawStar = function ( layer ) {
		var points = layer.points || 5;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var outerRadius = layer.outerRadius || layer.radius || 50;
		var innerRadius = layer.innerRadius || outerRadius * 0.5;

		this.ctx.save();
		this.ctx.beginPath();

		for ( var i = 0; i < points * 2; i++ ) {
			var angle = ( i * Math.PI ) / points - Math.PI / 2;
			var radius = i % 2 === 0 ? outerRadius : innerRadius;
			var px = x + radius * Math.cos( angle );
			var py = y + radius * Math.sin( angle );

			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}

		this.ctx.closePath();

		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			var fOpS = ( typeof layer.fillOpacity === 'number' ) ? layer.fillOpacity : 1;
			this.withLocalAlpha( fOpS, function () {
				this.ctx.fill();
			}.bind( this ) );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			var sOpS = ( typeof layer.strokeOpacity === 'number' ) ? layer.strokeOpacity : 1;
			this.withLocalAlpha( sOpS, function () {
				this.ctx.stroke();
			}.bind( this ) );
		}

		this.ctx.restore();
	};

	// Duplicate resize helpers removed to avoid overriding earlier implementations.

	/**
	 * Destroy the CanvasManager and clean up resources to prevent memory leaks
	 * This method should be called when the editor is closed or destroyed
	 */
	CanvasManager.prototype.destroy = function () {
		// Remove all event listeners to prevent memory leaks
		if ( this.canvas ) {
			this.canvas.removeEventListener( 'mousedown', this.onMouseDownHandler );
			this.canvas.removeEventListener( 'mousemove', this.onMouseMoveHandler );
			this.canvas.removeEventListener( 'mouseup', this.onMouseUpHandler );
			this.canvas.removeEventListener( 'wheel', this.onWheelHandler );
			this.canvas.removeEventListener( 'contextmenu', this.onContextMenuHandler );
			this.canvas.removeEventListener( 'click', this.onClickHandler );
			this.canvas.removeEventListener( 'dblclick', this.onDoubleClickHandler );

			// Touch events for mobile support
			this.canvas.removeEventListener( 'touchstart', this.onTouchStartHandler );
			this.canvas.removeEventListener( 'touchmove', this.onTouchMoveHandler );
			this.canvas.removeEventListener( 'touchend', this.onTouchEndHandler );
		}

		// Remove window event listeners
		if ( this.onResizeHandler ) {
			window.removeEventListener( 'resize', this.onResizeHandler );
		}
		if ( this.onKeyDownHandler ) {
			window.removeEventListener( 'keydown', this.onKeyDownHandler );
		}
		if ( this.onKeyUpHandler ) {
			window.removeEventListener( 'keyup', this.onKeyUpHandler );
		}

		// Clear canvas context
		if ( this.ctx ) {
			this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
		}

		// Clear background image reference
		if ( this.backgroundImage ) {
			this.backgroundImage.onload = null;
			this.backgroundImage.onerror = null;
			this.backgroundImage = null;
		}

		// Clear all object references to prevent circular references
		this.canvas = null;
		this.ctx = null;
		this.container = null;
		this.editor = null;

		// Clear arrays and objects
		this.history = [];
		this.clipboard = [];
		this.selectedLayerIds = [];
		this.selectionHandles = [];
		this.horizontalGuides = [];
		this.verticalGuides = [];

		// Clear timers if any exist
		if ( this.renderTimer ) {
			clearTimeout( this.renderTimer );
			this.renderTimer = null;
		}
		if ( this.resizeTimer ) {
			clearTimeout( this.resizeTimer );
			this.resizeTimer = null;
		}

		// Log for debugging (only in debug mode)
		if ( this.debug ) {
			mw.log( 'CanvasManager destroyed and cleaned up' );
		}
	};

	// Export CanvasManager to global scope
	window.CanvasManager = CanvasManager;

}() );
