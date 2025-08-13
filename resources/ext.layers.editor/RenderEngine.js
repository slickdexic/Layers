/**
 * Render Engine for Layers Editor
 * Handles canvas rendering and drawing operations
 */
( function () {
	'use strict';

	/**
	 * RenderEngine class
	 *
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 * @class
	 */
	function RenderEngine( config, canvasManager ) {
		this.config = config || {};
		this.canvasManager = canvasManager;
		this.canvas = canvasManager.canvas;
		this.ctx = canvasManager.ctx;

		// Rendering state
		this.isRendering = false;
		this.renderQueue = [];
		this.lastRenderTime = 0;
		this.targetFPS = 60;
		this.frameTime = 1000 / this.targetFPS;

		// Performance optimization flags
		this.enableDirtyRectRendering = true;
		this.enableObjectCulling = true;
		this.dirtyRegions = [];
	}

	/**
	 * Main render method
	 *
	 * @param {Array} layers Array of layer objects to render
	 * @param {Object} options Rendering options
	 */
	RenderEngine.prototype.render = function ( layers, options ) {
		if ( this.isRendering ) {
			return;
		}

		// eslint-disable-next-line no-unused-vars
		options = options || {};
		this.isRendering = true;

		try {
			// Clear canvas
			this.clearCanvas();

			// Draw background
			this.drawBackground();

			// Draw grid if enabled
			this.drawGrid();

			// Draw rulers if enabled
			this.drawRulers();

			// Render layers
			this.renderLayers( layers || [] );

			// Draw selection indicators
			this.drawSelectionIndicators();

			// Draw guides
			this.drawGuides();

			// Draw guide preview if dragging
			this.drawGuidePreview();

			// Draw marquee selection
			this.drawMarqueeBox();

		} catch ( error ) {
			if ( window.mw && window.mw.log ) {
				window.mw.log.error( 'Layers: Error during rendering:', error );
			} else {
				// eslint-disable-next-line no-console
				console.error( 'Layers: Error during rendering:', error );
			}
		} finally {
			this.isRendering = false;
		}
	};

	/**
	 * Clear the entire canvas
	 */
	RenderEngine.prototype.clearCanvas = function () {
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
	};

	/**
	 * Clear specific dirty regions only
	 *
	 * @param {Array} regions Array of dirty regions to clear
	 */
	RenderEngine.prototype.clearDirtyRegions = function ( regions ) {
		if ( !this.enableDirtyRectRendering || !regions || regions.length === 0 ) {
			this.clearCanvas();
			return;
		}

		regions.forEach( function ( region ) {
			this.ctx.clearRect( region.x, region.y, region.width, region.height );
		}.bind( this ) );
	};

	/**
	 * Draw background image or pattern
	 */
	RenderEngine.prototype.drawBackground = function () {
		if ( this.canvasManager.backgroundImage && this.canvasManager.backgroundImage.complete ) {
			this.ctx.drawImage( this.canvasManager.backgroundImage, 0, 0 );
		} else {
			this.drawPlaceholderBackground();
		}
	};

	/**
	 * Draw placeholder background pattern
	 */
	RenderEngine.prototype.drawPlaceholderBackground = function () {
		var w = this.canvas.width;
		var h = this.canvas.height;

		// Checkerboard pattern
		this.ctx.fillStyle = '#f8f9fa';
		this.ctx.fillRect( 0, 0, w, h );

		this.ctx.fillStyle = '#e9ecef';
		var size = 20;
		for ( var x = 0; x < w; x += size * 2 ) {
			for ( var y = 0; y < h; y += size * 2 ) {
				this.ctx.fillRect( x, y, size, size );
				this.ctx.fillRect( x + size, y + size, size, size );
			}
		}

		// Center message
		this.ctx.fillStyle = '#6c757d';
		this.ctx.font = '16px Arial, sans-serif';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';
		var text = 'Loading image...';
		this.ctx.fillText( text, w / 2, h / 2 );
	};

	/**
	 * Draw background grid if enabled
	 */
	RenderEngine.prototype.drawGrid = function () {
		if ( !this.canvasManager.showGrid ) {
			return;
		}

		var size = this.canvasManager.gridSize || 20;
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

	/**
	 * Draw rulers if enabled
	 */
	RenderEngine.prototype.drawRulers = function () {
		if ( !this.canvasManager.showRulers ) {
			return;
		}

		var rulerSize = this.canvasManager.rulerSize || 20;
		var w = this.canvas.width;
		var h = this.canvas.height;

		this.ctx.save();
		this.ctx.fillStyle = '#f8f9fa';
		this.ctx.strokeStyle = '#dee2e6';
		this.ctx.lineWidth = 1;
		this.ctx.font = '10px Arial, sans-serif';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';

		// Horizontal ruler
		this.ctx.fillRect( 0, 0, w, rulerSize );
		this.ctx.strokeRect( 0, 0, w, rulerSize );

		// Vertical ruler
		this.ctx.fillRect( 0, 0, rulerSize, h );
		this.ctx.strokeRect( 0, 0, rulerSize, h );

		// Ruler markings
		var step = 50;
		this.ctx.fillStyle = '#495057';

		// Horizontal markings
		for ( var x = step; x < w; x += step ) {
			this.ctx.beginPath();
			this.ctx.moveTo( x, 0 );
			this.ctx.lineTo( x, rulerSize );
			this.ctx.stroke();
			this.ctx.fillText( x.toString(), x, rulerSize / 2 );
		}

		// Vertical markings
		for ( var y = step; y < h; y += step ) {
			this.ctx.beginPath();
			this.ctx.moveTo( 0, y );
			this.ctx.lineTo( rulerSize, y );
			this.ctx.stroke();
			this.ctx.save();
			this.ctx.translate( rulerSize / 2, y );
			this.ctx.rotate( -Math.PI / 2 );
			this.ctx.fillText( y.toString(), 0, 0 );
			this.ctx.restore();
		}

		this.ctx.restore();
	};

	/**
	 * Render all layers
	 *
	 * @param {Array} layers Array of layer objects
	 */
	RenderEngine.prototype.renderLayers = function ( layers ) {
		if ( !layers || layers.length === 0 ) {
			return;
		}

		// Apply object culling if enabled
		var visibleLayers = this.enableObjectCulling ?
			this.cullLayers( layers ) : layers;

		// Render each visible layer
		visibleLayers.forEach( function ( layer ) {
			if ( layer.visible !== false ) {
				this.drawLayer( layer );
			}
		}.bind( this ) );
	};

	/**
	 * Cull layers that are outside the viewport
	 *
	 * @param {Array} layers Array of layer objects
	 * @return {Array} Filtered array of visible layers
	 */
	RenderEngine.prototype.cullLayers = function ( layers ) {
		var viewport = this.getViewport();

		return layers.filter( function ( layer ) {
			var bounds = this.getLayerBounds( layer );
			return bounds && this.intersectsViewport( bounds, viewport );
		}.bind( this ) );
	};

	/**
	 * Get current viewport bounds
	 *
	 * @return {Object} Viewport bounds
	 */
	RenderEngine.prototype.getViewport = function () {
		return {
			x: -this.canvasManager.panX / this.canvasManager.zoom,
			y: -this.canvasManager.panY / this.canvasManager.zoom,
			width: this.canvas.width / this.canvasManager.zoom,
			height: this.canvas.height / this.canvasManager.zoom
		};
	};

	/**
	 * Check if bounds intersect with viewport
	 *
	 * @param {Object} bounds Layer bounds
	 * @param {Object} viewport Viewport bounds
	 * @return {boolean} True if intersects
	 */
	RenderEngine.prototype.intersectsViewport = function ( bounds, viewport ) {
		return bounds.x < viewport.x + viewport.width &&
			bounds.x + bounds.width > viewport.x &&
			bounds.y < viewport.y + viewport.height &&
			bounds.y + bounds.height > viewport.y;
	};

	/**
	 * Get layer bounds
	 *
	 * @param {Object} layer Layer object
	 * @return {Object|null} Bounds object or null
	 */
	RenderEngine.prototype.getLayerBounds = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		return this.canvasManager.getLayerBounds( layer );
	};

	/**
	 * Draw a single layer
	 *
	 * @param {Object} layer Layer object to draw
	 */
	RenderEngine.prototype.drawLayer = function ( layer ) {
		if ( !layer || layer.visible === false ) {
			return;
		}

		// Apply layer opacity
		var previousAlpha = this.ctx.globalAlpha;
		if ( typeof layer.opacity === 'number' ) {
			this.ctx.globalAlpha = previousAlpha * layer.opacity;
		}

		try {
			switch ( layer.type ) {
				case 'rectangle':
					this.drawRectangle( layer );
					break;
				case 'circle':
					this.drawCircle( layer );
					break;
				case 'ellipse':
					this.drawEllipse( layer );
					break;
				case 'line':
					this.drawLine( layer );
					break;
				case 'arrow':
					this.drawArrow( layer );
					break;
				case 'text':
					this.drawText( layer );
					break;
				case 'polygon':
					this.drawPolygon( layer );
					break;
				case 'star':
					this.drawStar( layer );
					break;
				case 'path':
					this.drawPath( layer );
					break;
				case 'blur':
					this.drawBlur( layer );
					break;
				default:
					// Unknown layer type
					if ( window.mw && window.mw.log ) {
						window.mw.log.warn( 'Unknown layer type:', layer.type );
					}
					break;
			}
		} catch ( error ) {
			if ( window.mw && window.mw.log ) {
				window.mw.log.error( 'Error drawing layer:', layer, error );
			}
		} finally {
			this.ctx.globalAlpha = previousAlpha;
		}
	};

	/**
	 * Draw rectangle layer
	 *
	 * @param {Object} layer Rectangle layer object
	 */
	RenderEngine.prototype.drawRectangle = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawRectangle( layer );
	};

	/**
	 * Draw circle layer
	 *
	 * @param {Object} layer Circle layer object
	 */
	RenderEngine.prototype.drawCircle = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawCircle( layer );
	};

	/**
	 * Draw ellipse layer
	 *
	 * @param {Object} layer Ellipse layer object
	 */
	RenderEngine.prototype.drawEllipse = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawEllipse( layer );
	};

	/**
	 * Draw line layer
	 *
	 * @param {Object} layer Line layer object
	 */
	RenderEngine.prototype.drawLine = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawLine( layer );
	};

	/**
	 * Draw arrow layer
	 *
	 * @param {Object} layer Arrow layer object
	 */
	RenderEngine.prototype.drawArrow = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawArrow( layer );
	};

	/**
	 * Draw text layer
	 *
	 * @param {Object} layer Text layer object
	 */
	RenderEngine.prototype.drawText = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawText( layer );
	};

	/**
	 * Draw polygon layer
	 *
	 * @param {Object} layer Polygon layer object
	 */
	RenderEngine.prototype.drawPolygon = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawPolygon( layer );
	};

	/**
	 * Draw star layer
	 *
	 * @param {Object} layer Star layer object
	 */
	RenderEngine.prototype.drawStar = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawStar( layer );
	};

	/**
	 * Draw path layer
	 *
	 * @param {Object} layer Path layer object
	 */
	RenderEngine.prototype.drawPath = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawPath( layer );
	};

	/**
	 * Draw blur layer
	 *
	 * @param {Object} layer Blur layer object
	 */
	RenderEngine.prototype.drawBlur = function ( layer ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawBlur( layer );
	};

	/**
	 * Draw selection indicators
	 */
	RenderEngine.prototype.drawSelectionIndicators = function () {
		if ( this.canvasManager.selectedLayerId ) {
			this.drawSelectionForLayer( this.canvasManager.selectedLayerId );
		}

		if ( this.canvasManager.selectedLayerIds && this.canvasManager.selectedLayerIds.length > 0 ) {
			this.canvasManager.selectedLayerIds.forEach( function ( layerId ) {
				this.drawSelectionForLayer( layerId );
			}.bind( this ) );
		}
	};

	/**
	 * Draw selection indicators for a specific layer
	 *
	 * @param {string} layerId Layer ID
	 */
	RenderEngine.prototype.drawSelectionForLayer = function ( layerId ) {
		// Delegate to canvas manager's existing implementation
		this.canvasManager.drawSelectionIndicators( layerId );
	};

	/**
	 * Draw guides
	 */
	RenderEngine.prototype.drawGuides = function () {
		// Delegate to canvas manager's existing implementation
		if ( typeof this.canvasManager.drawGuides === 'function' ) {
			this.canvasManager.drawGuides();
		}
	};

	/**
	 * Draw guide preview
	 */
	RenderEngine.prototype.drawGuidePreview = function () {
		// Delegate to canvas manager's existing implementation
		if ( typeof this.canvasManager.drawGuidePreview === 'function' ) {
			this.canvasManager.drawGuidePreview();
		}
	};

	/**
	 * Draw marquee selection box
	 */
	RenderEngine.prototype.drawMarqueeBox = function () {
		// Delegate to canvas manager's existing implementation
		if ( typeof this.canvasManager.drawMarqueeBox === 'function' ) {
			this.canvasManager.drawMarqueeBox();
		}
	};

	/**
	 * Mark region as dirty for next render
	 *
	 * @param {Object} region Region to mark dirty
	 */
	RenderEngine.prototype.markDirty = function ( region ) {
		if ( !this.enableDirtyRectRendering ) {
			return;
		}

		this.dirtyRegions.push( region );
	};

	/**
	 * Clear dirty regions
	 */
	RenderEngine.prototype.clearDirtyRegions = function () {
		this.dirtyRegions = [];
	};

	/**
	 * Apply local alpha for scoped opacity changes
	 *
	 * @param {number} alpha Alpha value
	 * @param {Function} callback Function to execute with alpha
	 */
	RenderEngine.prototype.withLocalAlpha = function ( alpha, callback ) {
		var previousAlpha = this.ctx.globalAlpha;
		this.ctx.globalAlpha = previousAlpha * alpha;
		try {
			callback.call( this );
		} finally {
			this.ctx.globalAlpha = previousAlpha;
		}
	};

	/**
	 * Optimize rendering performance
	 */
	RenderEngine.prototype.optimize = function () {
		// Enable image smoothing for better quality
		this.ctx.imageSmoothingEnabled = true;
		if ( this.ctx.imageSmoothingQuality ) {
			this.ctx.imageSmoothingQuality = 'high';
		}

		// Enable context caching if available
		if ( this.ctx.save && this.ctx.restore ) {
			// Context state management is already handled
		}
	};

	/**
	 * Get render performance metrics
	 *
	 * @return {Object} Performance metrics
	 */
	RenderEngine.prototype.getPerformanceMetrics = function () {
		return {
			lastRenderTime: this.lastRenderTime,
			targetFPS: this.targetFPS,
			frameTime: this.frameTime,
			dirtyRegionCount: this.dirtyRegions.length,
			cullingEnabled: this.enableObjectCulling,
			dirtyRenderingEnabled: this.enableDirtyRectRendering
		};
	};

	// Export RenderEngine to global scope
	window.LayersRenderEngine = RenderEngine;

}() );
