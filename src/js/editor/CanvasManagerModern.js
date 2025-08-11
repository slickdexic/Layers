/**
 * Modern Canvas Manager for Layers Editor
 * Integrates with new modular components for better performance and maintainability
 */
( function () {
	'use strict';

	/**
	 * CanvasManager class
	 *
	 * @param {Object} config Configuration object
	 * @class
	 */
	function CanvasManagerModern( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.editor = this.config.editor;

		// Initialize new modular components
		this.historyManager = new window.LayersHistoryManager( 50 );
		this.dialogManager = new window.LayersDialogManager();
		this.imageLoader = new window.LayersImageLoader();
		this.renderer = null; // Will be initialized after container setup

		// Current state
		this.layers = [];
		this.selectedLayerIds = [];
		this.currentTool = 'pointer';
		this.isDrawing = false;
		this.startPoint = null;

		// Layer manipulation state
		this.isResizing = false;
		this.isRotating = false;
		this.isDragging = false;
		this.resizeHandle = null;
		this.dragStartPoint = null;

		// Current style settings
		this.currentStyle = {
			color: '#000000',
			strokeWidth: 2,
			fontSize: 16,
			fontFamily: 'Arial, sans-serif',
			fillColor: 'transparent',
			opacity: 1.0
		};

		// Zoom and pan
		this.zoom = 1.0;
		this.minZoom = 0.1;
		this.maxZoom = 5.0;
		this.panX = 0;
		this.panY = 0;

		// Initialize
		this.init();
	}

	/**
	 * Initialize the canvas manager
	 */
	CanvasManagerModern.prototype.init = function () {
		this.setupRenderer();
		this.loadBackgroundImage();
		this.setupEventHandlers();
		this.addInitialState();
	};

	/**
	 * Set up the renderer with proper canvas structure
	 */
	CanvasManagerModern.prototype.setupRenderer = function () {
		var containerRect = this.container.getBoundingClientRect();

		this.renderer = new window.LayersRenderer( {
			container: this.container,
			width: containerRect.width || 800,
			height: containerRect.height || 600
		} );

		// Set up event delegation through the renderer's event canvas
		this.canvas = this.renderer.getEventCanvas();
		this.overlayCtx = this.renderer.getOverlayContext();
	};

	/**
	 * Load the background image using the new ImageLoader
	 */
	CanvasManagerModern.prototype.loadBackgroundImage = function () {
		var self = this;
		var imageUrl = this.getImageUrl();

		if ( !imageUrl ) {
			mw.log.warn( 'No image URL provided for layers editor' );
			return;
		}

		this.imageLoader.loadImage( imageUrl, {
			crossOrigin: 'anonymous',
			timeout: 10000
		} ).done( function ( image ) {
			self.renderer.setBackgroundImage( image );
			self.renderer.render();
		} ).fail( function ( error ) {
			self.dialogManager.alert(
				'Failed to load background image: ' + error.message,
				'Image Loading Error',
				'error'
			);
		} );
	};

	/**
	 * Get the image URL from MediaWiki configuration
	 *
	 * @return {string|null} The image URL
	 */
	CanvasManagerModern.prototype.getImageUrl = function () {
		// Use the improved URL resolution from ImageLoader
		try {
			return this.imageLoader.getImageUrl(
				mw.config.get( 'wgLayersEditorInit' ).filename
			);
		} catch ( error ) {
			mw.log.error( 'Failed to get image URL:', error );
			return null;
		}
	};

	/**
	 * Set up event handlers for user interaction
	 */
	CanvasManagerModern.prototype.setupEventHandlers = function () {
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
			e.preventDefault();
			var touch = e.touches[ 0 ];
			var mouseEvent = new MouseEvent( 'mousedown', {
				clientX: touch.clientX,
				clientY: touch.clientY
			} );
			self.handleMouseDown( mouseEvent );
		} );

		// Keyboard shortcuts
		document.addEventListener( 'keydown', function ( e ) {
			self.handleKeyDown( e );
		} );

		// Window resize
		window.addEventListener( 'resize', function () {
			self.handleResize();
		} );
	};

	/**
	 * Handle mouse down events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	CanvasManagerModern.prototype.handleMouseDown = function ( e ) {
		var point = this.getCanvasPoint( e );
		this.startPoint = point;
		this.isDrawing = true;

		switch ( this.currentTool ) {
			case 'pointer':
				this.handleSelectionStart( point );
				break;
			case 'pen':
				this.startDrawing( point );
				break;
			case 'text':
				this.addTextLayer( point );
				break;
			case 'rectangle':
			case 'circle':
			case 'ellipse':
				this.startShapeDrawing( point );
				break;
		}

		// Prevent default to avoid text selection
		e.preventDefault();
	};

	/**
	 * Handle mouse move events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	CanvasManagerModern.prototype.handleMouseMove = function ( e ) {
		if ( !this.isDrawing ) {
			return;
		}

		var point = this.getCanvasPoint( e );

		switch ( this.currentTool ) {
			case 'pen':
				this.continueDrawing( point );
				break;
			case 'rectangle':
			case 'circle':
			case 'ellipse':
				this.updateShapeDrawing( point );
				break;
		}
	};

	/**
	 * Handle mouse up events
	 */
	CanvasManagerModern.prototype.handleMouseUp = function () {
		if ( !this.isDrawing ) {
			return;
		}

		this.isDrawing = false;

		switch ( this.currentTool ) {
			case 'pen':
				this.finishDrawing();
				break;
			case 'rectangle':
			case 'circle':
			case 'ellipse':
				this.finishShapeDrawing();
				break;
		}

		this.saveState();
	};

	/**
	 * Handle keyboard shortcuts
	 *
	 * @param {KeyboardEvent} e Keyboard event
	 */
	CanvasManagerModern.prototype.handleKeyDown = function ( e ) {
		// Only handle shortcuts when editor is focused
		if ( !this.container.contains( document.activeElement ) ) {
			return;
		}

		if ( e.ctrlKey || e.metaKey ) {
			switch ( e.key ) {
				case 'z':
					e.preventDefault();
					if ( e.shiftKey ) {
						this.redo();
					} else {
						this.undo();
					}
					break;
				case 'y':
					e.preventDefault();
					this.redo();
					break;
				case 'a':
					e.preventDefault();
					this.selectAll();
					break;
				case 'c':
					e.preventDefault();
					this.copySelected();
					break;
				case 'v':
					e.preventDefault();
					this.paste();
					break;
			}
		} else {
			switch ( e.key ) {
				case 'Delete':
				case 'Backspace':
					e.preventDefault();
					this.deleteSelected();
					break;
				case 'Escape':
					e.preventDefault();
					this.clearSelection();
					break;
			}
		}
	};

	/**
	 * Handle window resize
	 */
	CanvasManagerModern.prototype.handleResize = function () {
		var containerRect = this.container.getBoundingClientRect();
		this.renderer.resize( containerRect.width, containerRect.height );
		this.render();
	};

	/**
	 * Convert mouse event coordinates to canvas coordinates
	 *
	 * @param {MouseEvent} e Mouse event
	 * @return {Object} Point with x and y coordinates
	 */
	CanvasManagerModern.prototype.getCanvasPoint = function ( e ) {
		var rect = this.canvas.getBoundingClientRect();
		return {
			x: ( e.clientX - rect.left ) / this.zoom - this.panX,
			y: ( e.clientY - rect.top ) / this.zoom - this.panY
		};
	};

	/**
	 * Add a new layer and save state
	 *
	 * @param {Object} layer Layer object to add
	 */
	CanvasManagerModern.prototype.addLayer = function ( layer ) {
		layer.id = this.generateLayerId();
		this.layers.push( layer );
		this.renderer.setLayers( this.layers );
		this.render();
		this.saveState();
	};

	/**
	 * Generate a unique layer ID
	 *
	 * @return {string} Unique layer ID
	 */
	CanvasManagerModern.prototype.generateLayerId = function () {
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	};

	/**
	 * Delete selected layers with confirmation
	 */
	CanvasManagerModern.prototype.deleteSelected = function () {
		var self = this;

		if ( this.selectedLayerIds.length === 0 ) {
			this.dialogManager.alert(
				mw.message( 'layers-no-layer-selected' ).text(),
				mw.message( 'layers-editor-title' ).text()
			);
			return;
		}

		var message = this.selectedLayerIds.length === 1 ?
			mw.message( 'layers-delete-confirm' ).text() :
			'Delete ' + this.selectedLayerIds.length + ' selected layers?';

		this.dialogManager.confirm( message, 'Confirm Deletion' )
			.done( function ( confirmed ) {
				if ( confirmed ) {
					self.layers = self.layers.filter( function ( layer ) {
						return self.selectedLayerIds.indexOf( layer.id ) === -1;
					} );
					self.selectedLayerIds = [];
					self.renderer.setLayers( self.layers );
					self.render();
					self.saveState();
				}
			} );
	};

	/**
	 * Undo the last action
	 */
	CanvasManagerModern.prototype.undo = function () {
		var previousState = this.historyManager.undo();
		if ( previousState ) {
			this.layers = previousState.layers || [];
			this.selectedLayerIds = previousState.selectedLayerIds || [];
			this.renderer.setLayers( this.layers );
			this.render();
		}
	};

	/**
	 * Redo the last undone action
	 */
	CanvasManagerModern.prototype.redo = function () {
		var nextState = this.historyManager.redo();
		if ( nextState ) {
			this.layers = nextState.layers || [];
			this.selectedLayerIds = nextState.selectedLayerIds || [];
			this.renderer.setLayers( this.layers );
			this.render();
		}
	};

	/**
	 * Save current state to history
	 */
	CanvasManagerModern.prototype.saveState = function () {
		this.historyManager.addState( {
			layers: this.layers,
			selectedLayerIds: this.selectedLayerIds.slice()
		} );
	};

	/**
	 * Add initial state to history
	 */
	CanvasManagerModern.prototype.addInitialState = function () {
		this.saveState();
	};

	/**
	 * Render the canvas
	 */
	CanvasManagerModern.prototype.render = function () {
		this.renderer.render();
		this.renderSelectionHandles();
	};

	/**
	 * Render selection handles on the overlay
	 */
	CanvasManagerModern.prototype.renderSelectionHandles = function () {
		// Mark overlay as dirty to trigger redraw
		this.renderer.markDirty( 'overlay' );

		// Clear overlay
		var ctx = this.overlayCtx;
		ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

		// Draw selection handles for selected layers
		for ( var i = 0; i < this.selectedLayerIds.length; i++ ) {
			var layer = this.getLayerById( this.selectedLayerIds[ i ] );
			if ( layer ) {
				this.drawSelectionHandles( layer );
			}
		}
	};

	/**
	 * Draw selection handles for a layer
	 *
	 * @param {Object} layer Layer to draw handles for
	 */
	CanvasManagerModern.prototype.drawSelectionHandles = function ( layer ) {
		var ctx = this.overlayCtx;
		var bounds = this.getLayerBounds( layer );

		if ( !bounds ) {
			return;
		}

		// Draw selection rectangle
		ctx.strokeStyle = '#007cba';
		ctx.lineWidth = 1;
		ctx.setLineDash( [ 5, 5 ] );
		ctx.strokeRect( bounds.x, bounds.y, bounds.width, bounds.height );

		// Draw resize handles
		var handleSize = 8;
		var handles = [
			{
				x: bounds.x - handleSize / 2,
				y: bounds.y - handleSize / 2
			}, // Top-left
			{
				x: bounds.x + bounds.width - handleSize / 2,
				y: bounds.y - handleSize / 2
			}, // Top-right
			{
				x: bounds.x + bounds.width - handleSize / 2,
				y: bounds.y + bounds.height - handleSize / 2
			}, // Bottom-right
			{
				x: bounds.x - handleSize / 2,
				y: bounds.y + bounds.height - handleSize / 2
			} // Bottom-left
		];

		ctx.fillStyle = '#007cba';
		ctx.setLineDash( [] );

		for ( var i = 0; i < handles.length; i++ ) {
			ctx.fillRect( handles[ i ].x, handles[ i ].y, handleSize, handleSize );
		}
	};

	/**
	 * Get the bounds of a layer
	 *
	 * @param {Object} layer Layer to get bounds for
	 * @return {Object|null} Bounds object with x, y, width, height
	 */
	CanvasManagerModern.prototype.getLayerBounds = function ( layer ) {
		switch ( layer.type ) {
			case 'text':
				// Approximate text bounds
				return {
					x: layer.x || 0,
					y: layer.y || 0,
					width: ( layer.text ?
						layer.text.length * ( layer.fontSize || 16 ) * 0.6 : 100 ),
					height: layer.fontSize || 16
				};
			case 'rectangle':
				return {
					x: layer.x || 0,
					y: layer.y || 0,
					width: layer.width || 100,
					height: layer.height || 100
				};
			case 'circle':
				var radius = layer.radius || 50;
				return {
					x: ( layer.x || 0 ) - radius,
					y: ( layer.y || 0 ) - radius,
					width: radius * 2,
					height: radius * 2
				};
			default:
				return null;
		}
	};

	/**
	 * Get a layer by ID
	 *
	 * @param {string} layerId Layer ID
	 * @return {Object|null} Layer object or null if not found
	 */
	CanvasManagerModern.prototype.getLayerById = function ( layerId ) {
		for ( var i = 0; i < this.layers.length; i++ ) {
			if ( this.layers[ i ].id === layerId ) {
				return this.layers[ i ];
			}
		}
		return null;
	};

	/**
	 * Set the current tool
	 *
	 * @param {string} tool Tool name
	 */
	CanvasManagerModern.prototype.setTool = function ( tool ) {
		this.currentTool = tool;
		this.clearSelection();
	};

	/**
	 * Clear the current selection
	 */
	CanvasManagerModern.prototype.clearSelection = function () {
		this.selectedLayerIds = [];
		this.render();
	};

	/**
	 * Get the current layers data for saving
	 *
	 * @return {Array} Array of layer objects
	 */
	CanvasManagerModern.prototype.getLayersData = function () {
		return this.layers.slice(); // Return a copy
	};

	/**
	 * Set the layers data (for loading)
	 *
	 * @param {Array} layersData Array of layer objects
	 */
	CanvasManagerModern.prototype.setLayersData = function ( layersData ) {
		this.layers = layersData || [];
		this.selectedLayerIds = [];
		this.renderer.setLayers( this.layers );
		this.render();
		this.saveState();
	};

	/**
	 * Handle selection start (pointer tool)
	 */
	CanvasManagerModern.prototype.handleSelectionStart = function () {
		// TODO: Implement layer selection logic
		// For now, just clear selection if no layer hit
		this.clearSelection();
	};

	/**
	 * Start drawing (pen tool)
	 */
	CanvasManagerModern.prototype.startDrawing = function () {
		// TODO: Implement pen drawing start
	};

	/**
	 * Continue drawing (pen tool)
	 */
	CanvasManagerModern.prototype.continueDrawing = function () {
		// TODO: Implement pen drawing continuation
	};

	/**
	 * Finish drawing (pen tool)
	 */
	CanvasManagerModern.prototype.finishDrawing = function () {
		// TODO: Implement pen drawing finish
	};

	/**
	 * Add text layer at position
	 *
	 * @param {Object} point Position to add text
	 */
	CanvasManagerModern.prototype.addTextLayer = function ( point ) {
		var layer = {
			type: 'text',
			x: point.x,
			y: point.y,
			text: 'New Text',
			fontSize: this.currentStyle.fontSize,
			fontFamily: this.currentStyle.fontFamily,
			color: this.currentStyle.color
		};
		this.addLayer( layer );
	};

	/**
	 * Start shape drawing
	 */
	CanvasManagerModern.prototype.startShapeDrawing = function () {
		// TODO: Implement shape drawing start
	};

	/**
	 * Update shape drawing
	 */
	CanvasManagerModern.prototype.updateShapeDrawing = function () {
		// TODO: Implement shape drawing update
	};

	/**
	 * Finish shape drawing
	 */
	CanvasManagerModern.prototype.finishShapeDrawing = function () {
		// TODO: Implement shape drawing finish
	};

	/**
	 * Select all layers
	 */
	CanvasManagerModern.prototype.selectAll = function () {
		this.selectedLayerIds = this.layers.map( function ( layer ) {
			return layer.id;
		} );
		this.render();
	};

	/**
	 * Copy selected layers
	 */
	CanvasManagerModern.prototype.copySelected = function () {
		// TODO: Implement copy functionality
	};

	/**
	 * Paste copied layers
	 */
	CanvasManagerModern.prototype.paste = function () {
		// TODO: Implement paste functionality
	};

	// Export for use by LayersEditor
	window.LayersCanvasManagerModern = CanvasManagerModern;

}() );
