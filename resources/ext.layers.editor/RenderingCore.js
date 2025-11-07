/**
 * RenderingCore Module for Layers Editor
 * Core rendering engine extracted from CanvasManager.js
 * Handles canvas context management, drawing primitives, and layer rendering
 */
( function () {
	'use strict';

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
		this.ctx.setTransform(
			this.zoom, 0, 0, this.zoom,
			this.panX * this.zoom,
			this.panY * this.zoom
		);
	};

	/**
	 * Draw background image
	 */
	RenderingCore.prototype.drawBackgroundImage = function () {
		if ( !this.backgroundImage || !this.backgroundImage.complete ) {
			return;
		}

		// Get base dimensions from config if available
		const canvasManager = this.config.canvasManager;
		const imgWidth = ( canvasManager && canvasManager.baseWidth ) || this.backgroundImage.naturalWidth;
		const imgHeight = ( canvasManager && canvasManager.baseHeight ) || this.backgroundImage.naturalHeight;

		// Draw background image at world origin (0,0) with canvas transformations applied
		// The transformations (zoom/pan) are already applied in performRedraw
		this.ctx.drawImage( this.backgroundImage, 0, 0, imgWidth, imgHeight );
	};

	/**
	 * Render array of layers
	 *
	 * @param {Array} layers - Array of layer objects
	 */
	RenderingCore.prototype.renderLayers = function ( layers ) {
		if ( !layers || !Array.isArray( layers ) ) {
			return;
		}

		for ( let i = 0; i < layers.length; i++ ) {
			const layer = layers[ i ];
			if ( layer && layer.visible !== false ) {
				this.drawLayer( layer );
			}
		}
	};

	/**
	 * Draw a single layer based on its type
	 *
	 * @param {Object} layer - Layer object to draw
	 */
	RenderingCore.prototype.drawLayer = function ( layer ) {
		if ( !layer || layer.visible === false ) {
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
				default:
					this.drawErrorPlaceholder( layer );
			}
		} catch ( error ) {
			// Error recovery for layer drawing
			this.handleDrawingError( layer, error );
		}
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
	 * Draw text layer
	 *
	 * @param {Object} layer - Text layer object
	 */
	RenderingCore.prototype.drawText = function ( layer ) {
		if ( !layer.text ) {
			return;
		}

		this.ctx.save();

		// Set text properties
		const fontSize = layer.fontSize || 16;
		const fontFamily = layer.fontFamily || 'Arial, sans-serif';
		this.ctx.font = fontSize + 'px ' + fontFamily;
		this.ctx.fillStyle = layer.color || '#000000';
		this.ctx.textAlign = layer.textAlign || 'left';
		this.ctx.textBaseline = layer.textBaseline || 'top';

		// Apply rotation if specified
		if ( layer.rotation ) {
			const centerX = layer.x + ( layer.width || 0 ) / 2;
			const centerY = layer.y + ( layer.height || 0 ) / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -centerX, -centerY );
		}

		// Draw text stroke if specified
		if ( layer.textStrokeWidth && layer.textStrokeColor ) {
			this.ctx.strokeStyle = layer.textStrokeColor;
			this.ctx.lineWidth = layer.textStrokeWidth;
			this.ctx.strokeText( layer.text, layer.x || 0, layer.y || 0 );
		}

		// Draw text fill
		this.ctx.fillText( layer.text, layer.x || 0, layer.y || 0 );

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

		if ( layer.fill || layer.fillOpacity > 0 ) {
			this.ctx.fill();
		}
		if ( layer.stroke || layer.strokeWidth > 0 ) {
			this.ctx.stroke();
		}

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
		this.ctx.stroke();

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
		this.ctx.beginPath();

		// Move to first point
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		// Draw lines to remaining points
		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		this.ctx.closePath();

		// Apply styles
		if ( layer.fill ) {
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

	/**
	 * Draw star layer
	 *
	 * @param {Object} layer - Star layer object
	 */
	RenderingCore.prototype.drawStar = function ( layer ) {
		const x = layer.x || 0;
		const y = layer.y || 0;
		const radius = layer.radius || 50;
		const points = layer.points || 5;
		const innerRadius = radius * 0.5;

		this.ctx.save();
		this.ctx.beginPath();

		for ( let i = 0; i < points * 2; i++ ) {
			const angle = ( i * Math.PI ) / points;
			const r = i % 2 === 0 ? radius : innerRadius;
			const px = x + Math.cos( angle ) * r;
			const py = y + Math.sin( angle ) * r;

			if ( i === 0 ) {
				this.ctx.moveTo( px, py );
			} else {
				this.ctx.lineTo( px, py );
			}
		}

		this.ctx.closePath();

		// Apply styles
		if ( layer.fill ) {
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

		this.ctx.beginPath();
		this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );

		for ( let i = 1; i < layer.points.length; i++ ) {
			this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
		}

		this.ctx.stroke();
		this.ctx.restore();
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
