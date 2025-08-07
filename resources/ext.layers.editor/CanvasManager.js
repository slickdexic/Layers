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

		// Grid settings
		this.showGrid = false;
		this.gridSize = 20;
		this.snapToGrid = false;

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
			// console.log( 'Layers: Image dimensions:', self.backgroundImage.width, 'x', self.backgroundImage.height );

			// Set canvas size to match the image
			self.canvas.width = self.backgroundImage.width;
			self.canvas.height = self.backgroundImage.height;
			// console.log( 'Layers: Canvas size set to:', self.canvas.width, 'x', self.canvas.height );

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
			// console.log( 'Layers: Test image dimensions:', self.backgroundImage.width, 'x', self.backgroundImage.height );

			// Set canvas size to match the image (800x600 for the test image)
			self.canvas.width = 800;
			self.canvas.height = 600;
			// console.log( 'Layers: Canvas size set to:', self.canvas.width, 'x', self.canvas.height );

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
		// console.log( 'Layers: Canvas display size:', this.canvas.style.width, 'x', this.canvas.style.height );

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
		// console.log( 'Layers: Container dimensions:', container.clientWidth, 'x', container.clientHeight );

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

		// Set zoom and pan
		this.zoom = scale;
		this.panX = 0;
		this.panY = 0;

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

		// Handle middle mouse button or space+click for panning
		if ( e.button === 1 || ( e.button === 0 && e.spaceKey ) ) {
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
				this.startResize( handleHit, point );
				return;
			}

			// Check for rotation handle
			if ( this.rotationHandle && this.isPointInRect( point, this.rotationHandle ) ) {
				this.startRotation( point );
				return;
			}
		}

		this.isDrawing = true;

		if ( this.currentTool === 'pointer' ) {
			// Check for selection handle interaction first
			var handle = this.hitTestSelectionHandles( point );
			if ( handle ) {
				this.startResize( point, handle );
				return;
			}

			// Handle layer selection and dragging
			var isCtrlClick = e.ctrlKey || e.metaKey;
			var selectedLayer = this.handleLayerSelection( point, isCtrlClick );
			if ( selectedLayer && !isCtrlClick ) {
				this.startDrag( point );
			} else if ( !selectedLayer && !isCtrlClick ) {
				// Start marquee selection
				this.startMarqueeSelection( point );
			}
		} else {
			// Start drawing new layer
			this.startDrawing( point );
		}
	};

	CanvasManager.prototype.hitTestSelectionHandles = function ( point ) {
		for ( var i = 0; i < this.selectionHandles.length; i++ ) {
			var handle = this.selectionHandles[ i ];
			if ( this.isPointInRect( point, handle ) ) {
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
		this.canvas.style.cursor = this.getResizeCursor( handle.type );

		// Store original layer state
		var layer = this.editor.getLayerById( this.selectedLayerId );
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}

		// console.log( 'Layers: Starting resize with handle:', handle.type );
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

	CanvasManager.prototype.getResizeCursor = function ( handleType ) {
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
	};

	CanvasManager.prototype.handleMouseMove = function ( e ) {
		var point = this.getMousePoint( e );

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
			this.handleResize( point, e );
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

		if ( this.currentTool !== 'pointer' ) {
			this.continueDrawing( point );
		}
	};

	CanvasManager.prototype.handleResize = function ( point, event ) {
		var layer = this.editor.getLayerById( this.selectedLayerId );
		if ( !layer || !this.originalLayerState ) {
			return;
		}

		var deltaX = point.x - this.dragStartPoint.x;
		var deltaY = point.y - this.dragStartPoint.y;

		// Get modifier keys from the event
		var modifiers = {
			proportional: event && event.shiftKey, // Shift key for proportional scaling
			fromCenter: event && event.altKey // Alt key for scaling from center
		};

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
			Object.keys( updates ).forEach( function ( key ) {
				layer[ key ] = updates[ key ];
			} );

			// Re-render
			this.renderLayers( this.editor.layers );
		}
	};

	CanvasManager.prototype.calculateResize = function ( originalLayer, handleType, deltaX, deltaY, modifiers ) {
		modifiers = modifiers || {};

		switch ( originalLayer.type ) {
			case 'rectangle':
				return this.calculateRectangleResize( originalLayer, handleType, deltaX, deltaY, modifiers );
			case 'circle':
				return this.calculateCircleResize( originalLayer, handleType, deltaX, deltaY, modifiers );
			case 'text':
				// Text doesn't resize, only repositions
				return null;
			default:
				return null;
		}
	};

	CanvasManager.prototype.calculateRectangleResize = function ( originalLayer, handleType, deltaX, deltaY, modifiers ) {
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
			var maxDelta = Math.max( Math.abs( deltaX ), Math.abs( deltaY ) );
			deltaX = deltaX < 0 ? -maxDelta : maxDelta;
			deltaY = deltaY < 0 ? -maxDelta / aspectRatio : maxDelta / aspectRatio;
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

		return updates;
	};

	CanvasManager.prototype.calculateCircleResize = function ( originalLayer, handleType, deltaX, deltaY ) {
		var updates = {};
		var distance = Math.sqrt( deltaX * deltaX + deltaY * deltaY );

		// For circles, any handle adjusts the radius
		var radiusChange = 0;
		switch ( handleType ) {
			case 'e':
			case 'w':
				radiusChange = Math.abs( deltaX );
				break;
			case 'n':
			case 's':
				radiusChange = Math.abs( deltaY );
				break;
			default:
				radiusChange = distance;
		}

		// Determine if we're growing or shrinking
		if ( handleType === 'nw' || handleType === 'n' || handleType === 'w' ) {
			radiusChange = -radiusChange;
		}

		updates.radius = Math.max( 5, ( originalLayer.radius || 0 ) + radiusChange );
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

		var startAngle = Math.atan2( this.dragStartPoint.y - centerY, this.dragStartPoint.x - centerX );
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
	CanvasManager.prototype.updateLayerPosition = function ( layer, originalState, deltaX, deltaY ) {
		switch ( layer.type ) {
			case 'rectangle':
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
				this.canvas.style.cursor = this.getResizeCursor( handleHit.type );
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

	CanvasManager.prototype.handleMouseUp = function ( e ) {
		// Handle marquee selection completion
		if ( this.isMarqueeSelecting ) {
			this.finishMarqueeSelection();
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
		this.isResizing = false;
		this.resizeHandle = null;
		this.originalLayerState = null;
		this.dragStartPoint = null;
		this.canvas.style.cursor = 'default';

		// Mark editor as dirty
		this.editor.markDirty();

		// console.log( 'Layers: Resize finished' );
	};

	CanvasManager.prototype.finishRotation = function () {
		this.isRotating = false;
		this.originalLayerState = null;
		this.dragStartPoint = null;
		this.canvas.style.cursor = 'default';

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
		this.canvas.style.cursor = 'default';

		// Mark editor as dirty
		this.editor.markDirty();

		// console.log( 'Layers: Drag finished' );
	};

	CanvasManager.prototype.handleWheel = function ( e ) {
		e.preventDefault();

		var delta = e.deltaY > 0 ? -0.1 : 0.1;
		var newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.zoom + delta ) );

		if ( newZoom !== this.zoom ) {
			// Update zoom
			this.zoom = newZoom;

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
			e.spaceKey = true;
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

		// Update CSS size based on zoom
		if ( this.backgroundImage ) {
			this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
			this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';
		}

		this.updateCanvasTransform();

		// console.log( 'Layers: Zoom set to', this.zoom );
	};

	CanvasManager.prototype.resetZoom = function () {
		this.zoom = 1.0;
		this.panX = 0;
		this.panY = 0;

		if ( this.backgroundImage ) {
			this.canvas.style.width = this.backgroundImage.width + 'px';
			this.canvas.style.height = this.backgroundImage.height + 'px';
		}

		this.updateCanvasTransform();

		if ( this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( 100 );
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

		// Update CSS size
		this.canvas.style.width = ( this.backgroundImage.width * this.zoom ) + 'px';
		this.canvas.style.height = ( this.backgroundImage.height * this.zoom ) + 'px';

		this.updateCanvasTransform();

		if ( this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( Math.round( this.zoom * 100 ) );
		}

		// console.log( 'Layers: Fit to window - zoom:', this.zoom );
	};

	CanvasManager.prototype.updateCanvasTransform = function () {
		// Update zoom display
		if ( this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( Math.round( this.zoom * 100 ) );
		}

		// Apply CSS transform for zoom and pan
		var scale = this.zoom;
		var translateX = this.panX;
		var translateY = this.panY;

		this.canvas.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
		this.canvas.style.transformOrigin = '0 0';

		// console.log( 'Layers: Canvas transform updated - zoom:', this.zoom, 'pan:', this.panX, this.panY );
	};

	CanvasManager.prototype.handleLayerSelection = function ( point, isCtrlClick ) {
		// Find layer at click point (reverse order for top-most first)
		var selectedLayer = this.getLayerAtPoint( point );

		if ( selectedLayer ) {
			if ( isCtrlClick ) {
				// Multi-selection mode
				var isAlreadySelected = this.selectedLayerIds.indexOf( selectedLayer.id ) !== -1;
				if ( isAlreadySelected ) {
					this.removeFromSelection( selectedLayer.id );
				} else {
					this.addToSelection( selectedLayer.id );
				}
			} else {
				// Single selection mode
				this.editor.selectLayer( selectedLayer.id );
			}
			return selectedLayer;
		} else {
			if ( !isCtrlClick ) {
				this.editor.selectLayer( null );
			}
			return null;
		}
	};

	CanvasManager.prototype.isPointInLayer = function ( point, layer ) {
		switch ( layer.type ) {
			case 'text':
				return this.isPointInText( point, layer );
			case 'rectangle':
				return this.isPointInRectangle( point, layer );
			case 'circle':
				return this.isPointInCircle( point, layer );
			case 'ellipse':
				return this.isPointInEllipse( point, layer );
			case 'polygon':
				return this.isPointInPolygon( point, layer );
			case 'star':
				return this.isPointInStar( point, layer );
			case 'path':
				return this.isPointInPath( point, layer );
			default:
				return false;
		}
	};

	CanvasManager.prototype.isPointInText = function ( point, layer ) {
		// Simple bounding box check for text
		var x = layer.x || 0;
		var y = layer.y || 0;
		var fontSize = layer.fontSize || 16;
		var text = layer.text || '';

		// Estimate text dimensions
		this.ctx.save();
		this.ctx.font = fontSize + 'px ' + ( layer.fontFamily || 'Arial' );
		var metrics = this.ctx.measureText( text );
		this.ctx.restore();

		return point.x >= x && point.x <= x + metrics.width &&
               point.y >= y - fontSize && point.y <= y;
	};

	CanvasManager.prototype.isPointInRectangle = function ( point, layer ) {
		var x = layer.x || 0;
		var y = layer.y || 0;
		var width = layer.width || 0;
		var height = layer.height || 0;

		// Handle negative dimensions
		if ( width < 0 ) {
			x += width;
			width = -width;
		}
		if ( height < 0 ) {
			y += height;
			height = -height;
		}

		return point.x >= x && point.x <= x + width &&
               point.y >= y && point.y <= y + height;
	};

	CanvasManager.prototype.isPointInCircle = function ( point, layer ) {
		var centerX = layer.x || 0;
		var centerY = layer.y || 0;
		var radius = layer.radius || 0;

		var dx = point.x - centerX;
		var dy = point.y - centerY;
		var distance = Math.sqrt( dx * dx + dy * dy );

		return distance <= radius;
	};

	CanvasManager.prototype.isPointInPath = function ( point, layer ) {
		if ( !layer.points || layer.points.length < 2 ) {
			return false;
		}

		var tolerance = ( layer.strokeWidth || 2 ) + 3; // Click tolerance

		// Check if point is near any line segment in the path
		for ( var i = 0; i < layer.points.length - 1; i++ ) {
			var p1 = layer.points[ i ];
			var p2 = layer.points[ i + 1 ];

			var distance = this.distanceToLineSegment( point, p1, p2 );
			if ( distance <= tolerance ) {
				return true;
			}
		}

		return false;
	};

	CanvasManager.prototype.distanceToLineSegment = function ( point, lineStart, lineEnd ) {
		var A = point.x - lineStart.x;
		var B = point.y - lineStart.y;
		var C = lineEnd.x - lineStart.x;
		var D = lineEnd.y - lineStart.y;

		var dot = A * C + B * D;
		var lenSq = C * C + D * D;
		var param = -1;

		if ( lenSq !== 0 ) {
			param = dot / lenSq;
		}

		var xx, yy;

		if ( param < 0 ) {
			xx = lineStart.x;
			yy = lineStart.y;
		} else if ( param > 1 ) {
			xx = lineEnd.x;
			yy = lineEnd.y;
		} else {
			xx = lineStart.x + param * C;
			yy = lineStart.y + param * D;
		}

		var dx = point.x - xx;
		var dy = point.y - yy;
		return Math.sqrt( dx * dx + dy * dy );
	};

	CanvasManager.prototype.isPointInEllipse = function ( point, layer ) {
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radiusX = layer.radiusX || layer.width / 2 || 0;
		var radiusY = layer.radiusY || layer.height / 2 || 0;

		var dx = ( point.x - x ) / radiusX;
		var dy = ( point.y - y ) / radiusY;
		return ( dx * dx + dy * dy ) <= 1;
	};

	CanvasManager.prototype.isPointInPolygon = function ( point, layer ) {
		var sides = layer.sides || 6;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radius = layer.radius || 50;

		// Generate polygon points
		var points = [];
		for ( var i = 0; i < sides; i++ ) {
			var angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
			points.push( {
				x: x + radius * Math.cos( angle ),
				y: y + radius * Math.sin( angle )
			} );
		}

		return this.isPointInPolygonByPoints( point, points );
	};

	CanvasManager.prototype.isPointInStar = function ( point, layer ) {
		var points = layer.points || 5;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var outerRadius = layer.outerRadius || layer.radius || 50;
		var innerRadius = layer.innerRadius || outerRadius * 0.5;

		// Generate star points
		var starPoints = [];
		for ( var i = 0; i < points * 2; i++ ) {
			var angle = ( i * Math.PI ) / points - Math.PI / 2;
			var radius = i % 2 === 0 ? outerRadius : innerRadius;
			starPoints.push( {
				x: x + radius * Math.cos( angle ),
				y: y + radius * Math.sin( angle )
			} );
		}

		return this.isPointInPolygonByPoints( point, starPoints );
	};

	CanvasManager.prototype.isPointInPolygonByPoints = function ( point, vertices ) {
		var inside = false;
		for ( var i = 0, j = vertices.length - 1; i < vertices.length; j = i++ ) {
			if ( ( ( vertices[ i ].y > point.y ) !== ( vertices[ j ].y > point.y ) ) &&
				( point.x < ( vertices[ j ].x - vertices[ i ].x ) * ( point.y - vertices[ i ].y ) / ( vertices[ j ].y - vertices[ i ].y ) + vertices[ i ].x ) ) {
				inside = !inside;
			}
		}
		return inside;
	};

	CanvasManager.prototype.handleKeyUp = function ( e ) {
		// Handle space key release for pan mode
		if ( e.code === 'Space' ) {
			e.preventDefault();
			this.canvas.style.cursor = this.getToolCursor( this.currentTool );
		}
	};

	CanvasManager.prototype.toggleGrid = function () {
		this.showGrid = !this.showGrid;
		this.redraw();
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.snapToGridPoint = function ( point ) {
		if ( !this.snapToGrid ) {
			return point;
		}

		return {
			x: Math.round( point.x / this.gridSize ) * this.gridSize,
			y: Math.round( point.y / this.gridSize ) * this.gridSize
		};
	};

	CanvasManager.prototype.drawGrid = function () {
		if ( !this.showGrid ) {
			return;
		}

		this.ctx.save();
		this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
		this.ctx.lineWidth = 1;

		var gridSize = this.gridSize;
		var width = this.canvas.width;
		var height = this.canvas.height;

		// Draw vertical lines
		for ( var x = 0; x <= width; x += gridSize ) {
			this.ctx.beginPath();
			this.ctx.moveTo( x, 0 );
			this.ctx.lineTo( x, height );
			this.ctx.stroke();
		}

		// Draw horizontal lines
		for ( var y = 0; y <= height; y += gridSize ) {
			this.ctx.beginPath();
			this.ctx.moveTo( 0, y );
			this.ctx.lineTo( width, y );
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.selectLayer = function ( layerId ) {
		this.selectedLayerId = layerId;
		// Update multi-selection array
		if ( layerId ) {
			this.selectedLayerIds = [ layerId ];
		} else {
			this.selectedLayerIds = [];
		}
		this.redraw();
		this.renderLayers( this.editor.layers );

		// Draw selection indicators
		if ( layerId ) {
			this.drawSelectionIndicators( layerId );
		}
	};

	// Multi-selection methods
	CanvasManager.prototype.addToSelection = function ( layerId ) {
		if ( layerId && this.selectedLayerIds.indexOf( layerId ) === -1 ) {
			this.selectedLayerIds.push( layerId );
			this.selectedLayerId = layerId; // Keep single selection for compatibility
			this.redraw();
			this.renderLayers( this.editor.layers );
			this.drawMultiSelectionIndicators();
		}
	};

	CanvasManager.prototype.removeFromSelection = function ( layerId ) {
		var index = this.selectedLayerIds.indexOf( layerId );
		if ( index !== -1 ) {
			this.selectedLayerIds.splice( index, 1 );
			if ( this.selectedLayerIds.length > 0 ) {
				this.selectedLayerId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ];
			} else {
				this.selectedLayerId = null;
			}
			this.redraw();
			this.renderLayers( this.editor.layers );
			if ( this.selectedLayerIds.length > 0 ) {
				this.drawMultiSelectionIndicators();
			}
		}
	};

	CanvasManager.prototype.selectAll = function () {
		this.selectedLayerIds = this.editor.layers.map( function ( layer ) {
			return layer.id;
		} );
		if ( this.selectedLayerIds.length > 0 ) {
			this.selectedLayerId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ];
		}
		this.redraw();
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();
	};

	CanvasManager.prototype.deselectAll = function () {
		this.selectedLayerId = null;
		this.selectedLayerIds = [];
		this.redraw();
		this.renderLayers( this.editor.layers );
	};

	CanvasManager.prototype.drawMultiSelectionIndicators = function () {
		var self = this;
		this.selectedLayerIds.forEach( function ( layerId ) {
			self.drawSelectionIndicators( layerId );
		} );
	};

	// Clipboard operations (stubs for now)
	CanvasManager.prototype.copySelected = function () {
		if ( this.selectedLayerIds.length === 0 ) {
			return;
		}

		var selectedLayers = this.selectedLayerIds.map( function ( id ) {
			return this.editor.getLayerById( id );
		}.bind( this ) ).filter( function ( layer ) {
			return layer !== null;
		} );

		// Store in internal clipboard for now
		this.clipboard = JSON.parse( JSON.stringify( selectedLayers ) );
		// console.log( 'Copied ' + selectedLayers.length + ' layers to clipboard' );
	};

	CanvasManager.prototype.cutSelected = function () {
		this.copySelected();
		this.deleteSelected();
	};

	CanvasManager.prototype.pasteFromClipboard = function () {
		if ( !this.clipboard || this.clipboard.length === 0 ) {
			return;
		}

		// Save state for undo
		this.saveState( 'paste' );

		var self = this;
		var newLayerIds = [];

		this.clipboard.forEach( function ( layerData ) {
			var newLayer = JSON.parse( JSON.stringify( layerData ) );
			newLayer.id = 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );

			// Offset the pasted layer slightly to avoid overlap
			if ( newLayer.x !== undefined ) {
				newLayer.x += 20;
			}
			if ( newLayer.y !== undefined ) {
				newLayer.y += 20;
			}

			// Handle line/arrow offset
			if ( newLayer.x1 !== undefined ) {
				newLayer.x1 += 20;
				newLayer.x2 += 20;
			}
			if ( newLayer.y1 !== undefined ) {
				newLayer.y1 += 20;
				newLayer.y2 += 20;
			}

			// Handle path points offset
			if ( newLayer.points && Array.isArray( newLayer.points ) ) {
				newLayer.points = newLayer.points.map( function ( point ) {
					return {
						x: point.x + 20,
						y: point.y + 20
					};
				} );
			}

			self.editor.layers.push( newLayer );
			newLayerIds.push( newLayer.id );
		} );

		// Select the pasted layers
		this.selectedLayerIds = newLayerIds;
		this.selectedLayerId = newLayerIds[ newLayerIds.length - 1 ];

		// Update layer panel
		if ( this.editor.layerPanel ) {
			this.editor.layerPanel.updateLayerList();
		}

		// Mark as dirty
		this.editor.markDirty();

		this.redraw();
		this.renderLayers( this.editor.layers );
		this.drawMultiSelectionIndicators();

		// console.log( 'Pasted ' + newLayerIds.length + ' layers' );
	};

	CanvasManager.prototype.deleteSelected = function () {
		if ( this.selectedLayerIds.length === 0 ) {
			return;
		}

		var self = this;
		this.selectedLayerIds.forEach( function ( layerId ) {
			var index = -1;
			for ( var i = 0; i < self.editor.layers.length; i++ ) {
				if ( self.editor.layers[ i ].id === layerId ) {
					index = i;
					break;
				}
			}
			if ( index !== -1 ) {
				self.editor.layers.splice( index, 1 );
			}
		} );

		this.deselectAll();
		// console.log( 'Deleted selected layers' );
	};

	// History management methods
	CanvasManager.prototype.saveState = function ( action ) {
		// Deep clone the current layers state
		var state = {
			layers: JSON.parse( JSON.stringify( this.editor.layers || [] ) ),
			action: action || 'action',
			timestamp: Date.now()
		};

		// Remove any states after current index (if we're not at the end)
		this.history = this.history.slice( 0, this.historyIndex + 1 );

		// Add new state
		this.history.push( state );
		this.historyIndex = this.history.length - 1;

		// Limit history size
		if ( this.history.length > this.maxHistorySteps ) {
			this.history.shift();
			this.historyIndex--;
		}

		// Update toolbar undo/redo buttons
		this.updateUndoRedoButtons();
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
		if ( this.editor.layerPanel ) {
			this.editor.layerPanel.updateLayerList();
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
		if ( this.editor.layerPanel ) {
			this.editor.layerPanel.updateLayerList();
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

	CanvasManager.prototype.drawMarqueeBox = function () {
		if ( !this.isMarqueeSelecting ) { return; }

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
		if ( !layer ) { return; }

		this.ctx.save();

		// Get layer bounds
		var bounds = this.getLayerBounds( layer );
		if ( !bounds ) {
			this.ctx.restore();
			return;
		}

		// Draw selection outline
		this.ctx.strokeStyle = '#2196f3';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 5, 5 ] );
		this.ctx.strokeRect( bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2 );

		// Draw selection handles
		this.drawSelectionHandles( bounds );

		// Draw rotation handle
		this.drawRotationHandle( bounds );

		this.ctx.restore();
	};

	CanvasManager.prototype.getLayerBounds = function ( layer ) {
		switch ( layer.type ) {
			case 'rectangle':
				var rectX = layer.x || 0;
				var rectY = layer.y || 0;
				var width = layer.width || 0;
				var height = layer.height || 0;

				// Handle negative dimensions
				if ( width < 0 ) {
					rectX += width;
					width = -width;
				}
				if ( height < 0 ) {
					rectY += height;
					height = -height;
				}

				return { x: rectX, y: rectY, width: width, height: height };

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

			default:
				return null;
		}
	};

	CanvasManager.prototype.drawSelectionHandles = function ( bounds ) {
		this.selectionHandles = []; // Reset handles array

		var handleSize = 8;
		var handleColor = '#2196f3';
		var handleBorderColor = '#ffffff';

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

		// Draw handles
		handles.forEach( function ( handle ) {
			// Store handle info for hit testing
			this.selectionHandles.push( {
				type: handle.type,
				x: handle.x - handleSize / 2,
				y: handle.y - handleSize / 2,
				width: handleSize,
				height: handleSize
			} );

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

	CanvasManager.prototype.drawRotationHandle = function ( bounds ) {
		var handleSize = 8;
		var handleColor = '#ff9800';
		var handleBorderColor = '#ffffff';
		var lineColor = '#2196f3';

		// Rotation handle position (above the selection)
		var rotationHandleX = bounds.x + bounds.width / 2;
		var rotationHandleY = bounds.y - 25;

		// Store rotation handle for hit testing
		this.rotationHandle = {
			x: rotationHandleX - handleSize / 2,
			y: rotationHandleY - handleSize / 2,
			width: handleSize,
			height: handleSize,
			centerX: bounds.x + bounds.width / 2,
			centerY: bounds.y + bounds.height / 2
		};

		// Draw connection line
		this.ctx.strokeStyle = lineColor;
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [] );
		this.ctx.beginPath();
		this.ctx.moveTo( bounds.x + bounds.width / 2, bounds.y );
		this.ctx.lineTo( rotationHandleX, rotationHandleY );
		this.ctx.stroke();

		// Draw rotation handle (circle)
		this.ctx.fillStyle = handleColor;
		this.ctx.strokeStyle = handleBorderColor;
		this.ctx.lineWidth = 1;

		this.ctx.beginPath();
		this.ctx.arc( rotationHandleX, rotationHandleY, handleSize / 2, 0, 2 * Math.PI );
		this.ctx.fill();
		this.ctx.stroke();
	};

	CanvasManager.prototype.updateStyleOptions = function ( options ) {
		this.currentStyle = options || {};
	};

	CanvasManager.prototype.handleMouseMove = function ( e ) {
		if ( !this.isDrawing ) { return; }

		var point = this.getMousePoint( e );

		if ( this.currentTool !== 'pointer' ) {
			this.continueDrawing( point );
		}
	};

	CanvasManager.prototype.handleMouseUp = function ( e ) {
		if ( !this.isDrawing ) { return; }

		var point = this.getMousePoint( e );
		this.isDrawing = false;

		if ( this.currentTool !== 'pointer' ) {
			this.finishDrawing( point );
		}
	};

	CanvasManager.prototype.getMousePoint = function ( e ) {
		var rect = this.canvas.getBoundingClientRect();

		// Get mouse position relative to canvas
		var clientX = e.clientX - rect.left;
		var clientY = e.clientY - rect.top;

		// Convert from display coordinates to canvas coordinates
		// Account for CSS transforms (zoom and pan)
		var canvasX = clientX / this.zoom;
		var canvasY = clientY / this.zoom;

		// Snap to grid if enabled
		if ( this.snapToGrid ) {
			canvasX = Math.round( canvasX / this.gridSize ) * this.gridSize;
			canvasY = Math.round( canvasY / this.gridSize ) * this.gridSize;
		}

		return {
			x: canvasX,
			y: canvasY
		};
	};

	CanvasManager.prototype.startDrawing = function ( point ) {
		// console.log( 'Layers: Starting to draw with tool:', this.currentTool, 'at point:', point );

		// Use current style options if available
		var style = this.currentStyle || {};

		// Reset any previous temp layer
		this.tempLayer = null;

		// Prepare for drawing based on current tool
		switch ( this.currentTool ) {
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
		if ( !this.tempLayer ) { return; }

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
		if ( !this.tempLayer ) { return null; }

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
             Math.sqrt( Math.pow( layer.x2 - layer.x1, 2 ) + Math.pow( layer.y2 - layer.y1, 2 ) ) < 5 ) {
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
	};

	CanvasManager.prototype.getToolCursor = function ( tool ) {
		switch ( tool ) {
			case 'text': return 'text';
			case 'pen': return 'crosshair';
			case 'rectangle':
			case 'circle': return 'crosshair';
			default: return 'default';
		}
	};

	CanvasManager.prototype.renderLayers = function ( layers ) {
		// Redraw background
		this.redraw();

		// Render each layer in order
		if ( layers && layers.length > 0 ) {
			layers.forEach( function ( layer ) {
				this.drawLayer( layer );
			}.bind( this ) );
		}

		// Draw selection indicators if any layer is selected
		if ( this.selectedLayerId ) {
			this.drawSelectionIndicators( this.selectedLayerId );
		}
	};

	CanvasManager.prototype.redraw = function () {
		// console.log( 'Layers: Redrawing canvas...' );
		// console.log( 'Layers: Background image status:', this.backgroundImage ? 'loaded' : 'none',
		//             this.backgroundImage ? ('complete: ' + this.backgroundImage.complete) : '' );

		// Clear canvas
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

		// Draw background image if available
		if ( this.backgroundImage && this.backgroundImage.complete ) {
			// console.log( 'Layers: Drawing background image', this.backgroundImage.width + 'x' + this.backgroundImage.height );
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
	};

	CanvasManager.prototype.drawLayer = function ( layer ) {
		// Skip invisible layers
		if ( layer.visible === false ) {
			return;
		}

		switch ( layer.type ) {
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

	CanvasManager.prototype.drawText = function ( layer ) {
		this.ctx.save();
		this.ctx.font = ( layer.fontSize || 16 ) + 'px ' + ( layer.fontFamily || 'Arial' );
		this.ctx.textAlign = layer.textAlign || 'left';

		var text = layer.text || '';
		var x = layer.x || 0;
		var y = layer.y || 0;

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

		// Draw text fill
		this.ctx.fillStyle = layer.fill || '#000000';
		this.ctx.fillText( text, x, y );

		this.ctx.restore();
	};

	CanvasManager.prototype.drawRectangle = function ( layer ) {
		this.ctx.save();

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fillRect( layer.x, layer.y, layer.width, layer.height );
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.strokeRect( layer.x, layer.y, layer.width, layer.height );
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.drawCircle = function ( layer ) {
		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.arc( layer.x, layer.y, layer.radius, 0, 2 * Math.PI );

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
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
		this.ctx.stroke();

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
		this.ctx.stroke();

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
		this.ctx.stroke();
	};

	CanvasManager.prototype.drawHighlight = function ( layer ) {
		this.ctx.save();

		// Draw semi-transparent highlight
		this.ctx.fillStyle = layer.fill || '#ffff0080';
		this.ctx.fillRect( layer.x, layer.y, layer.width, layer.height );

		this.ctx.restore();
	};

	CanvasManager.prototype.drawPath = function ( layer ) {
		if ( !layer.points || layer.points.length < 2 ) { return; }

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

		this.ctx.stroke();
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
		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.drawPolygon = function ( layer ) {
		var sides = layer.sides || 6;
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radius = layer.radius || 50;

		this.ctx.save();
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

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
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

		if ( layer.fill && layer.fill !== 'transparent' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.fill();
		}

		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	CanvasManager.prototype.handleResize = function () {
		// Recalculate fit to window if canvas is at fit zoom level
		if ( this.backgroundImage ) {
			var container = this.canvas.parentNode;
			var containerWidth = container.clientWidth - 40;
			var containerHeight = container.clientHeight - 40;

			var scaleX = containerWidth / this.backgroundImage.width;
			var scaleY = containerHeight / this.backgroundImage.height;
			var fitScale = Math.min( scaleX, scaleY );

			// If we're close to fit zoom, re-fit to window
			if ( Math.abs( this.zoom - fitScale ) < 0.1 ) {
				this.fitToWindow();
			}
		}
	};

	// Export CanvasManager to global scope
	window.CanvasManager = CanvasManager;

}() );
