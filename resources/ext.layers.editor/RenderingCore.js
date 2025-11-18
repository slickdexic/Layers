/**
 * RenderingCore Module for Layers Editor
 * Core rendering engine extracted from CanvasManager.js
 * Handles canvas context management, drawing primitives, and layer rendering
 */
( function () {
	'use strict';

	const clampOpacity = function ( value ) {
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	};

	/**
	 * RenderingCore - Manages core canvas rendering operations
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element to render on
	 * @param {Object} config - Configuration options
	 * @class
	 */
	function RenderingCore( canvas, config ) {
		this.canvas = canvas;
		this.ctx = canvas.getContext( '2d' );
		this.config = config || {};

		// Canvas state management
		this.canvasStateStack = [];
		this.backgroundImage = null;

		// Performance optimization
		this.dirtyRegion = null;
		this.animationFrameId = null;
		this.redrawScheduled = false;
		this.layersCache = Object.create( null );
		this.viewportBounds = { x: 0, y: 0, width: 0, height: 0 };

		// Canvas pooling for temporary operations
		this.canvasPool = [];
		this.maxPoolSize = 5;

		// Transformation state
		this.zoom = 1.0;
		this.panX = 0;
		this.panY = 0;

		// Grid and rulers
		this.showGrid = false;
		this.gridSize = 20;
		this.showRulers = false;
		this.rulerSize = 20;

		this.init();
	}

	/**
	 * Initialize the rendering core
	 */
	RenderingCore.prototype.init = function () {
		// Set up default canvas context properties
		this.ctx.imageSmoothingEnabled = true;
		this.ctx.imageSmoothingQuality = 'high';

		// Initialize canvas state
		this.saveCanvasState();
	};

	/**
	 * Save current canvas transformation state
	 */
	RenderingCore.prototype.saveCanvasState = function () {
		this.ctx.save();
		this.canvasStateStack.push( {
			zoom: this.zoom,
			panX: this.panX,
			panY: this.panY
		} );
	};

	/**
	 * Restore canvas transformation state
	 */
	RenderingCore.prototype.restoreCanvasState = function () {
		this.ctx.restore();
		if ( this.canvasStateStack.length > 0 ) {
			const state = this.canvasStateStack.pop();
			this.zoom = state.zoom;
			this.panX = state.panX;
			this.panY = state.panY;
		}
	};

	/**
	 * Clear the entire canvas
	 */
	RenderingCore.prototype.clear = function () {
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
	};

	/**
	 * Main redraw function - orchestrates complete canvas redraw
	 *
	 * @param {Array} layers - Array of layer objects to render
	 */
	RenderingCore.prototype.redraw = function ( layers ) {
		// Clear canvas
		this.clear();

		// Apply transformations
		this.applyTransformations();

		// Draw background image if available
		if ( this.backgroundImage && this.backgroundImage.complete ) {
			this.drawBackgroundImage();
		}

		// Draw grid if enabled
		if ( this.showGrid ) {
			this.drawGrid();
		}

		// Draw rulers if enabled
		if ( this.showRulers ) {
			this.drawRulers();
		}

		// Render all layers
		if ( layers && layers.length > 0 ) {
			this.renderLayers( layers );
		}
	};

	/**
	 * Apply current transformations (zoom, pan) to canvas context
	 */
	RenderingCore.prototype.applyTransformations = function () {
		const zoom = this.zoom || 1;

		// Reset previous transform before applying the new state
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		this.ctx.translate( this.panX, this.panY );
		this.ctx.scale( zoom, zoom );
	};

	/**
	 * Render all layers in the order they should appear on canvas
	 *
	 * @param {Array} layers - Array of layer objects
	 */
	RenderingCore.prototype.renderLayers = function ( layers ) {
		if ( !Array.isArray( layers ) || layers.length === 0 ) {
			return;
		}

		for ( let i = layers.length - 1; i >= 0; i-- ) {
			const layer = layers[ i ];

			if ( !layer || layer.visible === false ) {
				continue;
			}

			this.drawLayer( layer );
		}
	};

	/**
	 * Dispatch drawing of a single layer
	 *
	 * @param {Object} layer - Layer definition
	 */
	RenderingCore.prototype.drawLayer = function ( layer ) {
		try {
			switch ( layer.type ) {
				case 'text':
					this.drawText( layer );
					break;
				case 'rectangle':
				case 'rect':
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
				case 'blur':
					this.drawBlur( layer );
					break;
				default:
					this.drawErrorPlaceholder( layer );
			}
		} catch ( error ) {
			// Error recovery for layer drawing
			this.handleDrawingError( layer, error );
		}
	};

	/**
	 * Draw text layer
	 *
	 * @param {Object} layer - Text layer object
	 */
	RenderingCore.prototype.drawText = function ( layer ) {
		if ( !layer || !layer.text ) {
			return;
		}

		this.ctx.save();

		const textAlign = layer.textAlign || 'left';
		let x = layer.x || 0;
		let y = layer.y || 0;
		const fontSize = layer.fontSize || 16;
		const fontFamily = layer.fontFamily || 'Arial';
		this.ctx.font = fontSize + 'px ' + fontFamily;
		this.ctx.textAlign = textAlign;
		this.ctx.textBaseline = 'top';

		let text = String( layer.text );
		text = text.replace( /[^\x20-\x7E\u00A0-\uFFFF]/g, '' );
		text = text.replace( /<[^>]+>/g, '' );

		const maxLineWidth = layer.maxWidth || layer.width || ( this.canvas.width * 0.8 );
		const lines = this.wrapText( text, maxLineWidth, this.ctx );
		const lineHeight = fontSize * 1.2;
		let totalTextWidth = 0;
		const totalTextHeight = lines.length * lineHeight;

		for ( let i = 0; i < lines.length; i++ ) {
			const lineMetrics = this.ctx.measureText( lines[ i ] );
			if ( lineMetrics.width > totalTextWidth ) {
				totalTextWidth = lineMetrics.width;
			}
		}

		const anchorLeft = this.getTextAnchorLeft( textAlign, x, totalTextWidth );
		const centerX = anchorLeft + ( totalTextWidth / 2 );
		const centerY = y + ( totalTextHeight / 2 );
		let drawX = x;
		let drawY = y;

		if ( layer.rotation && layer.rotation !== 0 ) {
			const rotationRadians = ( layer.rotation * Math.PI ) / 180;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotationRadians );
			this.ctx.textAlign = 'left';
			drawX = anchorLeft - centerX;
			drawY = -( totalTextHeight / 2 );
		}

		if ( layer.textShadow ) {
			this.ctx.shadowColor = layer.textShadowColor || '#000000';
			const zoomFactor = this.zoom || 1;
			this.ctx.shadowOffsetX = 2 * zoomFactor;
			this.ctx.shadowOffsetY = 2 * zoomFactor;
			this.ctx.shadowBlur = 4;
		}

		const baseAlpha = this.ctx.globalAlpha;
		const fillColor = layer.fill || layer.color || '#000000';
		const fillOpacity = clampOpacity( layer.fillOpacity );
		const strokeOpacity = clampOpacity( layer.strokeOpacity );

		for ( let j = 0; j < lines.length; j++ ) {
			const lineText = lines[ j ];
			const lineY = drawY + ( j * lineHeight );

			if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
				this.ctx.strokeStyle = layer.textStrokeColor || '#000000';
				this.ctx.lineWidth = layer.textStrokeWidth;
				this.ctx.globalAlpha = baseAlpha * strokeOpacity;
				this.ctx.strokeText( lineText, drawX, lineY );
			}

			this.ctx.fillStyle = fillColor;
			this.ctx.globalAlpha = baseAlpha * fillOpacity;
			this.ctx.fillText( lineText, drawX, lineY );
		}

		this.ctx.globalAlpha = baseAlpha;
		this.ctx.restore();
	};

	/**
	 * Handle drawing errors with proper error reporting
	 *
	 * @param {Object} layer - Layer that failed to render
	 * @param {Error} error - The error that occurred
	 */
	RenderingCore.prototype.handleDrawingError = function ( layer, error ) {
		if ( this.config.onError ) {
			this.config.onError( 'Layer drawing failed for', layer.type, 'layer:', error );
		}
		this.drawErrorPlaceholder( layer );
	};

	/**
	 * Draw error placeholder for failed layer rendering
	 *
	 * @param {Object} layer - Layer that failed to render
	 */
	RenderingCore.prototype.drawErrorPlaceholder = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const w = layer.width || 50;
		const h = layer.height || 50;

		this.ctx.save();
		this.ctx.strokeStyle = '#ff0000';
		this.ctx.lineWidth = 2;
		this.ctx.setLineDash( [ 5, 5 ] );
		this.ctx.strokeRect( x, y, w, h );
		this.ctx.setLineDash( [] );

		// Draw X
		this.ctx.beginPath();
		this.ctx.moveTo( x, y );
		this.ctx.lineTo( x + w, y + h );
		this.ctx.moveTo( x + w, y );
		this.ctx.lineTo( x, y + h );
		this.ctx.stroke();
		this.ctx.restore();
	};

	/**
	 * Draw blur effect layer
	 *
	 * @param {Object} layer - Blur layer object
	 */
	RenderingCore.prototype.drawBlur = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const w = layer.width || 0;
		const h = layer.height || 0;

		if ( w <= 0 || h <= 0 ) {
			return;
		}

		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect( x, y, w, h );
		this.ctx.clip();

		const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );
		const prevFilter = this.ctx.filter || 'none';
		this.ctx.filter = 'blur(' + radius + 'px)';

		if ( this.backgroundImage && this.backgroundImage.complete ) {
			this.ctx.drawImage( this.backgroundImage, 0, 0 );
		}

		this.ctx.filter = prevFilter;
		this.ctx.restore();
	};

	/**
	 * Draw rectangle layer
	 *
	 * @param {Object} layer - Rectangle layer object
	 */
	RenderingCore.prototype.drawRectangle = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const w = layer.width || 0;
		const h = layer.height || 0;

		if ( w <= 0 || h <= 0 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.rect( x, y, w, h );

		// Store base opacity for proper composition
		const baseOpacity = this.ctx.globalAlpha;

		// Fill
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			const fillOpacity = typeof layer.fillOpacity === 'number' ? layer.fillOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * fillOpacity;
			this.ctx.fill();
		}
		// Stroke
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			if ( layer.strokeWidth ) {
				this.ctx.lineWidth = layer.strokeWidth;
			}
			const strokeOpacity = typeof layer.strokeOpacity === 'number' ? layer.strokeOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	/**
	 * Draw circle layer
	 *
	 * @param {Object} layer - Circle layer object
	 */
	RenderingCore.prototype.drawCircle = function ( layer ) {
		const centerX = layer.x || 0;
		const centerY = layer.y || 0;
		const radius = layer.radius || (layer.width ? layer.width / 2 : 50);

		if ( radius <= 0 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.arc( centerX, centerY, radius, 0, 2 * Math.PI );

		// Store base opacity for proper composition
		const baseOpacity = this.ctx.globalAlpha;

		// Fill
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			const fillOpacity = typeof layer.fillOpacity === 'number' ? layer.fillOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * fillOpacity;
			this.ctx.fill();
		}
		// Stroke
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			if ( layer.strokeWidth ) {
				this.ctx.lineWidth = layer.strokeWidth;
			}
			const strokeOpacity = typeof layer.strokeOpacity === 'number' ? layer.strokeOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			this.ctx.stroke();
		} else if ( !layer.fill || layer.fill === 'transparent' || layer.fill === 'none' ) {
			// Default stroke if no fill
			this.ctx.strokeStyle = '#ff0000';
			this.ctx.lineWidth = 2;
			const strokeOpacity = typeof layer.strokeOpacity === 'number' ? layer.strokeOpacity : 1;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			this.ctx.stroke();
		}

		this.ctx.restore();
	};

	/**
	 * Draw ellipse layer
	 *
	 * @param {Object} layer - Ellipse layer object
	 */
	RenderingCore.prototype.drawEllipse = function ( layer ) {
		const centerX = ( layer.x || 0 ) + ( layer.width || 0 ) / 2;
		const centerY = ( layer.y || 0 ) + ( layer.height || 0 ) / 2;
		const radiusX = ( layer.width || 0 ) / 2;
		const radiusY = ( layer.height || 0 ) / 2;

		if ( radiusX <= 0 || radiusY <= 0 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.ellipse( centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI );

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			if ( layer.strokeWidth ) {
				this.ctx.lineWidth = layer.strokeWidth;
			}
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.globalAlpha = baseOpacity;

		this.ctx.restore();
	};

	/**
	 * Draw line layer
	 *
	 * @param {Object} layer - Line layer object
	 */
	RenderingCore.prototype.drawLine = function ( layer ) {
		this.ctx.save();
		this.applyLayerStyle( layer );

		this.ctx.beginPath();
		this.ctx.moveTo( layer.x1 || layer.x || 0, layer.y1 || layer.y || 0 );
		const endX = layer.x2 || ( layer.x || 0 ) + ( layer.width || 0 );
		const endY = layer.y2 || ( layer.y || 0 ) + ( layer.height || 0 );
		this.ctx.lineTo( endX, endY );
		const baseOpacity = this.ctx.globalAlpha;
		this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
		this.ctx.stroke();
		this.ctx.globalAlpha = baseOpacity;

		this.ctx.restore();
	};

	/**
	 * Apply common layer styling (fill, stroke, opacity, etc.)
	 *
	 * @param {Object} layer - Layer object with style properties
	 */
	RenderingCore.prototype.applyLayerStyle = function ( layer ) {
		// Shadow effects MUST be applied before transformations
		if ( layer.shadow === true || layer.shadowBlur > 0 ) {
			this.ctx.shadowColor = layer.shadowColor || '#000000';
			this.ctx.shadowBlur = Math.max( 0, Math.min( 64, layer.shadowBlur || 0 ) );
			this.ctx.shadowOffsetX = layer.shadowOffsetX || 0;
			this.ctx.shadowOffsetY = layer.shadowOffsetY || 0;
		} else {
			// Clear shadow when not enabled
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		// Fill style
		if ( layer.fill ) {
			this.ctx.fillStyle = layer.fill;
		} else if ( layer.color ) {
			this.ctx.fillStyle = layer.color;
		}

		// Stroke style
		if ( layer.stroke ) {
			this.ctx.strokeStyle = layer.stroke;
		}

		// Line width
		if ( layer.strokeWidth ) {
			this.ctx.lineWidth = layer.strokeWidth;
		}

		// Opacity
		if ( typeof layer.opacity === 'number' && layer.opacity !== 1 ) {
			this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
		}

		// Blend mode
		if ( layer.blendMode || layer.blend ) {
			this.ctx.globalCompositeOperation = layer.blendMode || layer.blend;
		}

		// Rotation (applied AFTER shadow setup)
		if ( layer.rotation ) {
			const centerX = ( layer.x || 0 ) + ( layer.width || 0 ) / 2;
			const centerY = ( layer.y || 0 ) + ( layer.height || 0 ) / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -centerX, -centerY );
		}
	};

	/**
	 * Draw grid overlay
	 */
	RenderingCore.prototype.drawGrid = function () {
		if ( !this.showGrid ) {
			return;
		}

		this.ctx.save();
		this.ctx.strokeStyle = '#e0e0e0';
		this.ctx.lineWidth = 1;
		this.ctx.globalAlpha = 0.5;

		const gridSize = this.gridSize;
		const canvasWidth = this.canvas.width;
		const canvasHeight = this.canvas.height;

		this.ctx.beginPath();

		// Vertical lines
		for ( let x = 0; x <= canvasWidth; x += gridSize ) {
			this.ctx.moveTo( x, 0 );
			this.ctx.lineTo( x, canvasHeight );
		}

		// Horizontal lines
		for ( let y = 0; y <= canvasHeight; y += gridSize ) {
			this.ctx.moveTo( 0, y );
			this.ctx.lineTo( canvasWidth, y );
		}

		this.ctx.stroke();
		this.ctx.restore();
	};

	/**
	 * Draw rulers (top and left bars with measurement marks)
	 */
	RenderingCore.prototype.drawRulers = function () {
		if ( !this.showRulers ) {
			return;
		}

		const size = this.rulerSize;
		const w = this.canvas.width;
		const h = this.canvas.height;

		this.ctx.save();
		this.ctx.setTransform( 1, 0, 0, 1, 0, 0 ); // Reset transform for UI elements

		// Draw ruler backgrounds
		this.ctx.fillStyle = '#f3f3f3';
		this.ctx.fillRect( 0, 0, w, size ); // Top ruler
		this.ctx.fillRect( 0, 0, size, h ); // Left ruler

		// Draw ruler borders
		this.ctx.strokeStyle = '#ddd';
		this.ctx.lineWidth = 1;
		this.ctx.beginPath();
		this.ctx.moveTo( 0, size + 0.5 );
		this.ctx.lineTo( w, size + 0.5 );
		this.ctx.moveTo( size + 0.5, 0 );
		this.ctx.lineTo( size + 0.5, h );
		this.ctx.stroke();

		// Draw tick marks
		this.drawRulerTicks( size, w, h );

		this.ctx.restore();
	};

	/**
	 * Draw ruler tick marks and labels
	 *
	 * @param {number} size - Ruler size
	 * @param {number} w - Canvas width
	 * @param {number} h - Canvas height
	 */
	RenderingCore.prototype.drawRulerTicks = function ( size, w, h ) {
		const tickStep = 50;
		this.ctx.fillStyle = '#666';
		this.ctx.font = '10px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';

		// Top ruler ticks
		for ( let x = tickStep; x < w; x += tickStep ) {
			this.ctx.beginPath();
			this.ctx.moveTo( x, size - 5 );
			this.ctx.lineTo( x, size );
			this.ctx.stroke();
			this.ctx.fillText( x.toString(), x, size / 2 );
		}

		// Left ruler ticks
		this.ctx.textAlign = 'center';
		this.ctx.save();
		for ( let y = tickStep; y < h; y += tickStep ) {
			this.ctx.beginPath();
			this.ctx.moveTo( size - 5, y );
			this.ctx.lineTo( size, y );
			this.ctx.stroke();

			this.ctx.save();
			this.ctx.translate( size / 2, y );
			this.ctx.rotate( -Math.PI / 2 );
			this.ctx.fillText( y.toString(), 0, 0 );
			this.ctx.restore();
		}
		this.ctx.restore();
	};

	/**
	 * Get temporary canvas for offscreen operations
	 *
	 * @param {number} width - Canvas width
	 * @param {number} height - Canvas height
	 * @return {Object} Canvas object with canvas and context
	 */
	RenderingCore.prototype.getTempCanvas = function ( width, height ) {
		let tempCanvas;

		if ( this.canvasPool.length > 0 ) {
			tempCanvas = this.canvasPool.pop();
		} else {
			tempCanvas = document.createElement( 'canvas' );
		}

		tempCanvas.width = width || this.canvas.width;
		tempCanvas.height = height || this.canvas.height;

		return {
			canvas: tempCanvas,
			context: tempCanvas.getContext( '2d' )
		};
	};

	/**
	 * Return temporary canvas to pool
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas to return to pool
	 */
	RenderingCore.prototype.returnTempCanvas = function ( canvas ) {
		if ( this.canvasPool.length < this.maxPoolSize ) {
			canvas.width = 1;
			canvas.height = 1;
			this.canvasPool.push( canvas );
		}
	};

	// Placeholder methods for complex shapes (to be implemented)

	/**
	 * Draw polygon layer
	 *
	 * @param {Object} layer - Polygon layer object
	 */
	RenderingCore.prototype.drawPolygon = function ( layer ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 3 ) {
			return;
		}

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();

		// Move to first point
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		// Draw lines to remaining points
		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		this.ctx.closePath();

		var baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.globalAlpha = baseOpacity;

		this.ctx.restore();
	};

	/**
	 * Draw star layer
	 *
	 * @param {Object} layer - Star layer object
	 */
	RenderingCore.prototype.drawStar = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const points = layer.points || 5;
		const outerRadius = layer.outerRadius || layer.radius || 50;
		const innerRadius = layer.innerRadius || outerRadius * 0.5;

		this.ctx.save();
		this.applyLayerStyle( layer );
		this.ctx.beginPath();

		for ( let i = 0; i < points * 2; i++ ) {
			const angle = ( i * Math.PI ) / points - Math.PI / 2;
			const r = i % 2 === 0 ? outerRadius : innerRadius;
			const px = x + Math.cos( angle ) * r;
			const py = y + Math.sin( angle ) * r;

			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}

		this.ctx.closePath();

		const baseOpacity = this.ctx.globalAlpha;
		if ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' ) {
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fill();
		}
		if ( layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' ) {
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = layer.strokeWidth || 1;
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
			this.ctx.stroke();
		}
		this.ctx.globalAlpha = baseOpacity;

		this.ctx.restore();
	};

	/**
	 * Draw arrow layer
	 *
	 * @param {Object} layer - Arrow layer object
	 */
	RenderingCore.prototype.drawArrow = function ( layer ) {
		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 100;
		const y2 = layer.y2 || 100;
		const headSize = layer.arrowSize || 10;

		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;
		const baseOpacity = this.ctx.globalAlpha;
		const strokeAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
		this.ctx.globalAlpha = strokeAlpha;

		// Draw main line
		this.ctx.beginPath();
		this.ctx.moveTo( x1, y1 );
		this.ctx.lineTo( x2, y2 );
		this.ctx.stroke();

		// Calculate arrow head
		const angle = Math.atan2( y2 - y1, x2 - x1 );
		const headAngle = Math.PI / 6; // 30 degrees

		this.ctx.beginPath();
		this.ctx.moveTo( x2, y2 );
		this.ctx.lineTo(
			x2 - headSize * Math.cos( angle - headAngle ),
			y2 - headSize * Math.sin( angle - headAngle )
		);
		this.ctx.moveTo( x2, y2 );
		this.ctx.lineTo(
			x2 - headSize * Math.cos( angle + headAngle ),
			y2 - headSize * Math.sin( angle + headAngle )
		);
		this.ctx.stroke();
		this.ctx.globalAlpha = baseOpacity;

		this.ctx.restore();
	};

	/**
	 * Draw highlight layer
	 *
	 * @param {Object} layer - Highlight layer object
	 */
	RenderingCore.prototype.drawHighlight = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const width = layer.width || 100;
		const height = layer.height || 20;

		this.ctx.save();
		let opacity = 0.3;
		if ( typeof layer.opacity === 'number' && !Number.isNaN( layer.opacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.opacity ) );
		} else if ( typeof layer.fillOpacity === 'number' && !Number.isNaN( layer.fillOpacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.fillOpacity ) );
		}
		this.ctx.globalAlpha = opacity; // Semi-transparent highlight
		this.ctx.fillStyle = layer.color || layer.fill || '#ffff00';
		this.ctx.fillRect( x, y, width, height );
		this.ctx.restore();
	};

	/**
	 * Draw path layer
	 *
	 * @param {Object} layer - Path layer object
	 */
	RenderingCore.prototype.drawPath = function ( layer ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 2 ) {
			return;
		}

		this.ctx.save();
		this.ctx.strokeStyle = layer.stroke || '#000000';
		this.ctx.lineWidth = layer.strokeWidth || 2;
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';
		const baseOpacity = this.ctx.globalAlpha;
		this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );

		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		this.ctx.stroke();
		this.ctx.globalAlpha = baseOpacity;
		this.ctx.restore();
	};

	RenderingCore.prototype.wrapText = function ( text, maxWidth, ctx ) {
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
			if ( metrics.width > maxWidth && currentLine !== '' ) {
				lines.push( currentLine );
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}

		if ( currentLine ) {
			lines.push( currentLine );
		}

		return lines.length > 0 ? lines : [ '' ];
	};

	RenderingCore.prototype.getTextAnchorLeft = function ( textAlign, x, width ) {
		const align = ( textAlign || 'left' ).toLowerCase();
		switch ( align ) {
			case 'center':
				return x - ( width / 2 );
			case 'right':
			case 'end':
				return x - width;
			case 'start':
			default:
				return x;
		}
	};

	/**
	 * Set grid properties
	 *
	 * @param {boolean} show - Whether to show grid
	 * @param {number} size - Grid size in pixels
	 * @param {string} color - Grid color
	 */
	RenderingCore.prototype.setGridProperties = function ( show, size, color ) {
		this.showGrid = !!show;
		if ( typeof size === 'number' && size > 0 ) {
			this.gridSize = size;
		}
		if ( color ) {
			this.gridColor = color;
		}
	};

	/**
	 * Set ruler properties
	 *
	 * @param {boolean} show - Whether to show rulers
	 * @param {number} size - Ruler size in pixels
	 * @param {string} color - Ruler color
	 * @param {string} textColor - Ruler text color
	 */
	RenderingCore.prototype.setRulerProperties = function ( show, size, color, textColor ) {
		this.showRulers = !!show;
		if ( typeof size === 'number' && size > 0 ) {
			this.rulerSize = size;
		}
		if ( color ) {
			this.rulerColor = color;
		}
		if ( textColor ) {
			this.rulerTextColor = textColor;
		}
	};

	// Export the module
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = RenderingCore;
	} else if ( typeof window !== 'undefined' ) {
		window.RenderingCore = RenderingCore;
	}

	// MediaWiki ResourceLoader support
	if ( typeof mw !== 'undefined' && mw.loader ) {
		mw.loader.using( [], () => {
			mw.RenderingCore = RenderingCore;
		} );
	}

	window.RenderingCore = RenderingCore;

}() );
