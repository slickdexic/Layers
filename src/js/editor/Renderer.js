/**
 * Multi-Layer Canvas Renderer
 * Implements efficient rendering using multiple canvas layers
 * Replaces the inefficient full-redraw approach
 */

( function () {
	'use strict';

	/**
	 * Renderer class
	 * @param {Object} config Configuration object
	 * @class
	 */
	function Renderer( config ) {
		this.config = config || {};
		this.container = this.config.container;
		this.width = this.config.width || 800;
		this.height = this.config.height || 600;

		// Canvas layers
		this.backgroundCanvas = null;
		this.backgroundCtx = null;
		this.drawingCanvas = null;
		this.drawingCtx = null;
		this.overlayCanvas = null;
		this.overlayCtx = null;

		// Render state
		this.backgroundImage = null;
		this.layers = [];
		this.isDirty = {
			background: true,
			drawing: true,
			overlay: true
		};

		this.init();
	}

	/**
	 * Initialize the renderer
	 */
	Renderer.prototype.init = function () {
		this.createCanvasLayers();
		this.setupEventDelegation();
	};

	/**
	 * Create the canvas layer structure
	 */
	Renderer.prototype.createCanvasLayers = function () {
		var style = 'position: absolute; left: 0; top: 0; pointer-events: none;';

		// Background layer (static image)
		this.backgroundCanvas = document.createElement( 'canvas' );
		this.backgroundCanvas.className = 'layers-canvas-background';
		this.backgroundCanvas.style.cssText = style + ' z-index: 1;';
		this.backgroundCanvas.width = this.width;
		this.backgroundCanvas.height = this.height;
		this.backgroundCtx = this.backgroundCanvas.getContext( '2d' );

		// Drawing layer (user drawings)
		this.drawingCanvas = document.createElement( 'canvas' );
		this.drawingCanvas.className = 'layers-canvas-drawing';
		this.drawingCanvas.style.cssText = style + ' z-index: 2;';
		this.drawingCanvas.width = this.width;
		this.drawingCanvas.height = this.height;
		this.drawingCtx = this.drawingCanvas.getContext( '2d' );

		// Overlay layer (selection handles, UI elements)
		this.overlayCanvas = document.createElement( 'canvas' );
		this.overlayCanvas.className = 'layers-canvas-overlay';
		this.overlayCanvas.style.cssText = 'position: absolute; left: 0; top: 0; z-index: 3;';
		this.overlayCanvas.width = this.width;
		this.overlayCanvas.height = this.height;
		this.overlayCtx = this.overlayCanvas.getContext( '2d' );

		// Add to container
		this.container.appendChild( this.backgroundCanvas );
		this.container.appendChild( this.drawingCanvas );
		this.container.appendChild( this.overlayCanvas );
	};

	/**
	 * Set up event delegation on the top overlay canvas
	 */
	Renderer.prototype.setupEventDelegation = function () {
		// All mouse/touch events go through the overlay canvas
		// This allows proper event handling while maintaining layer separation
		this.overlayCanvas.style.pointerEvents = 'auto';
	};

	/**
	 * Set the background image
	 * @param {HTMLImageElement} image The background image
	 */
	Renderer.prototype.setBackgroundImage = function ( image ) {
		this.backgroundImage = image;
		this.isDirty.background = true;
	};

	/**
	 * Set the layers data
	 * @param {Array} layers Array of layer objects
	 */
	Renderer.prototype.setLayers = function ( layers ) {
		this.layers = layers || [];
		this.isDirty.drawing = true;
	};

	/**
	 * Mark a specific layer as dirty for re-rendering
	 * @param {string} layerType Type of layer ('background', 'drawing', 'overlay')
	 */
	Renderer.prototype.markDirty = function ( layerType ) {
		if ( layerType && this.isDirty.hasOwnProperty( layerType ) ) {
			this.isDirty[ layerType ] = true;
		} else {
			// Mark all layers dirty
			this.isDirty.background = true;
			this.isDirty.drawing = true;
			this.isDirty.overlay = true;
		}
	};

	/**
	 * Render all dirty layers
	 */
	Renderer.prototype.render = function () {
		if ( this.isDirty.background ) {
			this.renderBackground();
			this.isDirty.background = false;
		}

		if ( this.isDirty.drawing ) {
			this.renderDrawing();
			this.isDirty.drawing = false;
		}

		if ( this.isDirty.overlay ) {
			this.renderOverlay();
			this.isDirty.overlay = false;
		}
	};

	/**
	 * Render the background layer
	 */
	Renderer.prototype.renderBackground = function () {
		this.backgroundCtx.clearRect( 0, 0, this.width, this.height );

		if ( this.backgroundImage ) {
			// Calculate scaling to fit image within canvas
			var scale = Math.min(
				this.width / this.backgroundImage.width,
				this.height / this.backgroundImage.height
			);

			var scaledWidth = this.backgroundImage.width * scale;
			var scaledHeight = this.backgroundImage.height * scale;
			var x = ( this.width - scaledWidth ) / 2;
			var y = ( this.height - scaledHeight ) / 2;

			this.backgroundCtx.drawImage(
				this.backgroundImage,
				x, y, scaledWidth, scaledHeight
			);
		}
	};

	/**
	 * Render the drawing layer
	 */
	Renderer.prototype.renderDrawing = function () {
		this.drawingCtx.clearRect( 0, 0, this.width, this.height );

		for ( var i = 0; i < this.layers.length; i++ ) {
			var layer = this.layers[ i ];
			if ( layer.visible !== false ) {
				this.renderLayer( layer, this.drawingCtx );
			}
		}
	};

	/**
	 * Render a single layer
	 * @param {Object} layer Layer object to render
	 * @param {CanvasRenderingContext2D} ctx Context to render to
	 */
	Renderer.prototype.renderLayer = function ( layer, ctx ) {
		ctx.save();

		// Apply layer-level transformations
		if ( layer.opacity !== undefined && layer.opacity !== 1 ) {
			ctx.globalAlpha = layer.opacity;
		}

		if ( layer.blendMode && layer.blendMode !== 'normal' ) {
			ctx.globalCompositeOperation = layer.blendMode;
		}

		// Render based on layer type
		switch ( layer.type ) {
			case 'text':
				this.renderTextLayer( layer, ctx );
				break;
			case 'rectangle':
				this.renderRectangleLayer( layer, ctx );
				break;
			case 'circle':
				this.renderCircleLayer( layer, ctx );
				break;
			case 'path':
				this.renderPathLayer( layer, ctx );
				break;
			default:
				console.warn( 'Unknown layer type:', layer.type );
		}

		ctx.restore();
	};

	/**
	 * Render a text layer
	 * @param {Object} layer Text layer object
	 * @param {CanvasRenderingContext2D} ctx Rendering context
	 */
	Renderer.prototype.renderTextLayer = function ( layer, ctx ) {
		if ( !layer.text ) {
			return;
		}

		ctx.font = ( layer.fontSize || 16 ) + 'px ' + ( layer.fontFamily || 'Arial' );
		ctx.fillStyle = layer.color || '#000000';
		ctx.textAlign = layer.textAlign || 'left';
		ctx.textBaseline = layer.textBaseline || 'top';

		ctx.fillText( layer.text, layer.x || 0, layer.y || 0 );
	};

	/**
	 * Render a rectangle layer
	 * @param {Object} layer Rectangle layer object
	 * @param {CanvasRenderingContext2D} ctx Rendering context
	 */
	Renderer.prototype.renderRectangleLayer = function ( layer, ctx ) {
		var x = layer.x || 0;
		var y = layer.y || 0;
		var width = layer.width || 100;
		var height = layer.height || 100;

		if ( layer.fillColor ) {
			ctx.fillStyle = layer.fillColor;
			ctx.fillRect( x, y, width, height );
		}

		if ( layer.strokeColor && layer.strokeWidth ) {
			ctx.strokeStyle = layer.strokeColor;
			ctx.lineWidth = layer.strokeWidth;
			ctx.strokeRect( x, y, width, height );
		}
	};

	/**
	 * Render a circle layer
	 * @param {Object} layer Circle layer object
	 * @param {CanvasRenderingContext2D} ctx Rendering context
	 */
	Renderer.prototype.renderCircleLayer = function ( layer, ctx ) {
		var x = layer.x || 0;
		var y = layer.y || 0;
		var radius = layer.radius || 50;

		ctx.beginPath();
		ctx.arc( x, y, radius, 0, 2 * Math.PI );

		if ( layer.fillColor ) {
			ctx.fillStyle = layer.fillColor;
			ctx.fill();
		}

		if ( layer.strokeColor && layer.strokeWidth ) {
			ctx.strokeStyle = layer.strokeColor;
			ctx.lineWidth = layer.strokeWidth;
			ctx.stroke();
		}
	};

	/**
	 * Render a path layer
	 * @param {Object} layer Path layer object
	 * @param {CanvasRenderingContext2D} ctx Rendering context
	 */
	Renderer.prototype.renderPathLayer = function ( layer, ctx ) {
		if ( !layer.points || layer.points.length < 2 ) {
			return;
		}

		ctx.beginPath();
		ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		for ( var i = 1; i < layer.points.length; i++ ) {
			ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		if ( layer.strokeColor && layer.strokeWidth ) {
			ctx.strokeStyle = layer.strokeColor;
			ctx.lineWidth = layer.strokeWidth;
			ctx.stroke();
		}
	};

	/**
	 * Render the overlay layer (UI elements, selection handles)
	 */
	Renderer.prototype.renderOverlay = function () {
		this.overlayCtx.clearRect( 0, 0, this.width, this.height );
		// Overlay rendering will be handled by UI components
	};

	/**
	 * Resize all canvas layers
	 * @param {number} width New width
	 * @param {number} height New height
	 */
	Renderer.prototype.resize = function ( width, height ) {
		this.width = width;
		this.height = height;

		this.backgroundCanvas.width = width;
		this.backgroundCanvas.height = height;
		this.drawingCanvas.width = width;
		this.drawingCanvas.height = height;
		this.overlayCanvas.width = width;
		this.overlayCanvas.height = height;

		this.markDirty();
	};

	/**
	 * Get the overlay canvas for event handling
	 * @returns {HTMLCanvasElement} The overlay canvas
	 */
	Renderer.prototype.getEventCanvas = function () {
		return this.overlayCanvas;
	};

	/**
	 * Get the overlay context for UI rendering
	 * @returns {CanvasRenderingContext2D} The overlay context
	 */
	Renderer.prototype.getOverlayContext = function () {
		return this.overlayCtx;
	};

	// Export for use in other modules
	window.LayersRenderer = Renderer;

}() );
