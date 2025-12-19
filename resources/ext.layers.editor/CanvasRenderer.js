/**
 * CanvasRenderer Module for Layers Editor
 * Unified rendering engine handling all canvas drawing operations.
 * Consolidates logic from CanvasManager, RenderingCore, and LayerRenderer.
 */
( function () {
	'use strict';

	// Use shared namespace helper
	const getClass = ( window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		window.layersGetClass ||
		function ( namespacePath, globalName ) {
			return window[ globalName ] || null;
		};

	// Lazy-resolved utilities (resolved on first use)
	let _TextUtils = null;
	let _GeometryUtils = null;
	let _SelectionRenderer = null;

	function getTextUtils() {
		if ( !_TextUtils ) {
			_TextUtils = getClass( 'Utils.Text', 'TextUtils' );
		}
		return _TextUtils;
	}

	function getGeometryUtils() {
		if ( !_GeometryUtils ) {
			_GeometryUtils = getClass( 'Utils.Geometry', 'GeometryUtils' );
		}
		return _GeometryUtils;
	}

	function getSelectionRendererClass() {
		if ( !_SelectionRenderer ) {
			_SelectionRenderer = ( window.Layers && window.Layers.Canvas &&
				window.Layers.Canvas.SelectionRenderer ) || null;
		}
		return _SelectionRenderer;
	}

	/**
	 * CanvasRenderer - Manages all canvas rendering operations
	 *
	 * @class CanvasRenderer
	 */
	class CanvasRenderer {
		/**
		 * Create a new CanvasRenderer instance
		 *
		 * @param {HTMLCanvasElement} canvas - Canvas element to render on
		 * @param {Object} config - Configuration options
		 */
		constructor( canvas, config ) {
			this.canvas = canvas;
			this.ctx = canvas.getContext( '2d' );
			this.config = config || {};
			this.editor = this.config.editor || null;

			// Canvas state management
			this.canvasStateStack = [];
			this.backgroundImage = null;

			// Transformation state
			this.zoom = 1.0;
			this.panX = 0;
			this.panY = 0;

			// Selection state
			this.selectedLayerIds = [];
			this.selectionHandles = [];
			this.rotationHandle = null;
			this.isMarqueeSelecting = false;
			this.marqueeRect = null;

			// Canvas pooling
			this.canvasPool = [];
			this.maxPoolSize = 5;

			// Layer renderer (delegated shape drawing - uses shared LayerRenderer)
			this.layerRenderer = null;

			// Selection renderer (delegated selection UI drawing)
			this._selectionRenderer = null;

			this.init();
		}

		init() {
			this.ctx.imageSmoothingEnabled = true;
			this.ctx.imageSmoothingQuality = 'high';

			// Initialize LayerRenderer for shape drawing delegation
			// Uses shared LayerRenderer (ext.layers.shared) for consistency with viewer
			const LayerRenderer = getClass( 'LayerRenderer', 'LayerRenderer' );
			if ( LayerRenderer ) {
				// Create callback for async image loading to trigger re-render
				const onImageLoadCallback = () => {
					if ( this.editor && this.editor.canvasManager ) {
						this.editor.canvasManager.renderLayers( this.editor.layers );
					}
				};

				this.layerRenderer = new LayerRenderer( this.ctx, {
					zoom: this.zoom,
					backgroundImage: this.backgroundImage,
					canvas: this.canvas,
					onImageLoad: onImageLoadCallback
				} );
			}

			// Initialize SelectionRenderer for selection UI drawing
			this._initSelectionRenderer();
		}

		/**
		 * Initialize SelectionRenderer module
		 */
		_initSelectionRenderer() {
			const SelectionRendererClass = getSelectionRendererClass();
			if ( SelectionRendererClass ) {
				this._selectionRenderer = new SelectionRendererClass( {
					ctx: this.ctx,
					getLayerById: ( id ) => this._getLayerById( id ),
					getLayerBounds: ( layer ) => this.getLayerBounds( layer )
				} );
			}
		}

		/**
		 * Get layer by ID (helper for SelectionRenderer)
		 *
		 * @param {string} layerId - Layer ID
		 * @return {Object|null} Layer object or null
		 */
		_getLayerById( layerId ) {
			if ( this.editor && typeof this.editor.getLayerById === 'function' ) {
				return this.editor.getLayerById( layerId );
			}
			return null;
		}

		setTransform( zoom, panX, panY ) {
			this.zoom = zoom;
			this.panX = panX;
			this.panY = panY;
			// Sync zoom to LayerRenderer
			if ( this.layerRenderer ) {
				this.layerRenderer.setZoom( zoom );
			}
		}

		setBackgroundImage( img ) {
			this.backgroundImage = img;
			// Sync background to LayerRenderer (for blur effects)
			if ( this.layerRenderer ) {
				this.layerRenderer.setBackgroundImage( img );
			}
		}

		setSelection( selectedLayerIds ) {
			this.selectedLayerIds = selectedLayerIds || [];
		}

		setMarquee( isSelecting, rect ) {
			this.isMarqueeSelecting = isSelecting;
			this.marqueeRect = rect;
		}

		/**
		 * Get background visibility state from editor
		 *
		 * @return {boolean} True if background should be visible
		 */
		getBackgroundVisible() {
			if ( this.editor && this.editor.stateManager ) {
				const visible = this.editor.stateManager.get( 'backgroundVisible' );
				return visible !== false; // Default to true
			}
			return true;
		}

		/**
		 * Get background opacity state from editor
		 *
		 * @return {number} Opacity value 0-1
		 */
		getBackgroundOpacity() {
			if ( this.editor && this.editor.stateManager ) {
				const opacity = this.editor.stateManager.get( 'backgroundOpacity' );
				if ( typeof opacity === 'number' && !Number.isNaN( opacity ) ) {
					return Math.max( 0, Math.min( 1, opacity ) );
				}
			}
			return 1.0;
		}

		clear() {
			this.ctx.save();
			this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
			this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );
			this.ctx.restore();
		}

		redraw( layers ) {
			this.clear();
			this.applyTransformations();

			// Check background visibility from state
			const bgVisible = this.getBackgroundVisible();
			if ( bgVisible && this.backgroundImage && this.backgroundImage.complete ) {
				this.drawBackgroundImage();
			} else if ( !bgVisible ) {
				// Draw checker pattern when background is hidden
				this.drawCheckerPattern();
			} else if ( this.backgroundImage && this.backgroundImage.complete ) {
				this.drawBackgroundImage();
			}

			if ( layers && layers.length > 0 ) {
				this.renderLayers( layers );
			}

			this.drawMultiSelectionIndicators();
			this.drawMarqueeBox();
		}

		applyTransformations() {
			this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );
			this.ctx.translate( this.panX, this.panY );
			this.ctx.scale( this.zoom, this.zoom );
		}

		drawBackgroundImage() {
			if ( !this.backgroundImage ) {
				this.drawCheckerPattern();
				return;
			}

			const opacity = this.getBackgroundOpacity();
			this.ctx.save();
			if ( opacity < 1 ) {
				// Draw checker pattern underneath for transparency visualization
				this.ctx.globalAlpha = 1;
				this.drawCheckerPatternToContext();
				this.ctx.globalAlpha = opacity;
			}
			this.ctx.drawImage( this.backgroundImage, 0, 0 );
			this.ctx.restore();
		}

		/**
		 * Draw checker pattern for transparency visualization
		 */
		drawCheckerPattern() {
			this.ctx.save();
			this.drawCheckerPatternToContext();
			this.ctx.restore();
		}

		/**
		 * Draw checker pattern directly to context (without save/restore)
		 */
		drawCheckerPatternToContext() {
			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );

			this.ctx.fillStyle = '#e8e8e8';
			const checkerSize = 20;
			for ( let x = 0; x < this.canvas.width; x += checkerSize * 2 ) {
				for ( let y = 0; y < this.canvas.height; y += checkerSize * 2 ) {
					this.ctx.fillRect( x, y, checkerSize, checkerSize );
					this.ctx.fillRect( x + checkerSize, y + checkerSize, checkerSize, checkerSize );
				}
			}
		}

		renderLayers( layers ) {
			if ( !Array.isArray( layers ) ) {
				return;
			}
			// Render in reverse order (bottom to top) if that's how the array is structured,
			// or normal order if array is bottom-to-top.
			// CanvasManager loop was: for ( var i = layers.length - 1; i >= 0; i-- )
			// which implies layers[0] is top? No, usually layers[0] is bottom.
			// Let's check CanvasManager.renderLayers.
			// CanvasManager.js: for ( var i = layers.length - 1; i >= 0; i-- )
			// This means layers[length-1] is drawn first? No, loop goes backwards.
			// If i=length-1 is drawn first, then it's at the bottom.
			// So layers array is Top-to-Bottom.
			for ( let i = layers.length - 1; i >= 0; i-- ) {
				const layer = layers[ i ];
				if ( layer && layer.visible !== false ) {
					// Special handling for blur layers - blur everything rendered so far
					if ( layer.type === 'blur' ) {
						this.drawBlurEffect( layer );
					} else {
						this.drawLayerWithEffects( layer );
					}
				}
			}
		}

		/**
		 * Render layers to an external context (used for export).
		 * Does NOT include background image or checker pattern.
		 *
		 * @param {CanvasRenderingContext2D} targetCtx - Target context to draw on
		 * @param {Array} layers - Array of layer objects to render
		 * @param {number} scale - Scale factor for rendering (default: 1)
		 */
		renderLayersToContext( targetCtx, layers, scale = 1 ) {
			if ( !targetCtx || !Array.isArray( layers ) ) {
				return;
			}

			// Save original context and state
			const originalCtx = this.ctx;
			const originalZoom = this.zoom;
			const originalPanX = this.panX;
			const originalPanY = this.panY;

			// Temporarily use the target context with export settings
			this.ctx = targetCtx;
			this.zoom = scale;
			this.panX = 0;
			this.panY = 0;

			// Update layerRenderer to use the target context
			if ( this.layerRenderer && typeof this.layerRenderer.setContext === 'function' ) {
				this.layerRenderer.setContext( targetCtx );
			}

			// Apply transformations to the target context
			this.applyTransformations();

			// Render layers (bottom to top)
			for ( let i = layers.length - 1; i >= 0; i-- ) {
				const layer = layers[ i ];
				if ( layer && layer.visible !== false ) {
					// Note: blur effects may not work correctly without the background
					// in the target context, but we still attempt to render them
					if ( layer.type === 'blur' ) {
						// For export, blur layers need the region to already be drawn
						// This is a limitation - blur on transparent may look different
						this.drawBlurEffectToContext( targetCtx, layer, scale );
					} else {
						this.drawLayerWithEffects( layer );
					}
				}
			}

			// Restore original context and state
			this.ctx = originalCtx;
			this.zoom = originalZoom;
			this.panX = originalPanX;
			this.panY = originalPanY;

			// Restore layerRenderer to use the original context
			if ( this.layerRenderer && typeof this.layerRenderer.setContext === 'function' ) {
				this.layerRenderer.setContext( originalCtx );
			}
		}

		/**
		 * Draw a blur effect to an external context for export
		 *
		 * @param {CanvasRenderingContext2D} targetCtx - Target context
		 * @param {Object} layer - Blur layer
		 * @param {number} scale - Scale factor
		 */
		drawBlurEffectToContext( targetCtx, layer, scale ) {
			const x = ( layer.x || 0 ) * scale;
			const y = ( layer.y || 0 ) * scale;
			const w = ( layer.width || 0 ) * scale;
			const h = ( layer.height || 0 ) * scale;

			if ( w <= 0 || h <= 0 ) {
				return;
			}

			const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );

			targetCtx.save();

			// Apply layer opacity
			if ( typeof layer.opacity === 'number' ) {
				targetCtx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}

			try {
				// Get the canvas this context belongs to
				const targetCanvas = targetCtx.canvas;

				// Create a temp canvas to capture and blur the region
				const tempCanvas = document.createElement( 'canvas' );
				tempCanvas.width = Math.max( 1, Math.ceil( w ) );
				tempCanvas.height = Math.max( 1, Math.ceil( h ) );
				const tempCtx = tempCanvas.getContext( '2d' );

				if ( tempCtx ) {
					// Copy the region from target canvas
					tempCtx.drawImage( targetCanvas, x, y, w, h, 0, 0, w, h );

					// Apply blur filter
					targetCtx.filter = `blur(${ radius }px)`;

					// Draw the blurred region back
					targetCtx.drawImage( tempCanvas, x, y, w, h );

					// Reset filter
					targetCtx.filter = 'none';
				}
			} catch ( e ) {
				// Fallback: just draw a semi-transparent overlay
				targetCtx.fillStyle = 'rgba(128, 128, 128, 0.5)';
				targetCtx.fillRect( x, y, w, h );
			}

			targetCtx.restore();
		}

	/**
		 * Draw a blur effect that blurs everything below it (background + layers)
		 *
		 * @param {Object} layer - Blur layer with x, y, width, height, blurRadius
		 */
		drawBlurEffect( layer ) {
			const x = layer.x || 0;
			const y = layer.y || 0;
			const w = layer.width || 0;
			const h = layer.height || 0;

			if ( w <= 0 || h <= 0 ) {
				return;
			}

			const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );

			this.ctx.save();

			// Apply layer opacity and blend mode
			if ( typeof layer.opacity === 'number' ) {
				this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}
			if ( layer.blend ) {
				try {
					this.ctx.globalCompositeOperation = String( layer.blend );
				} catch ( e ) {
					this.ctx.globalCompositeOperation = 'source-over';
				}
			}

			try {
				// Create a temp canvas to capture what's been drawn so far
				const tempCanvas = document.createElement( 'canvas' );
				tempCanvas.width = Math.max( 1, Math.ceil( w ) );
				tempCanvas.height = Math.max( 1, Math.ceil( h ) );
				const tempCtx = tempCanvas.getContext( '2d' );

				if ( tempCtx ) {
					// Copy the region from the main canvas to temp canvas
					// We need to account for the current transform (zoom/pan)
					tempCtx.drawImage(
						this.canvas,
						x * this.zoom + this.panX,
						y * this.zoom + this.panY,
						w * this.zoom,
						h * this.zoom,
						0, 0,
						tempCanvas.width,
						tempCanvas.height
					);

					// Apply blur filter and draw back
					this.ctx.filter = 'blur(' + radius + 'px)';
					this.ctx.drawImage( tempCanvas, x, y, w, h );
					this.ctx.filter = 'none';
				}
			} catch ( e ) {
				// Fallback: gray overlay
				this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
				this.ctx.fillRect( x, y, w, h );
			}

			this.ctx.restore();
		}

		drawLayerWithEffects( layer ) {
			this.ctx.save();
			if ( typeof layer.opacity === 'number' ) {
				this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}
			if ( layer.blend ) {
				try {
					this.ctx.globalCompositeOperation = String( layer.blend );
				} catch ( blendError ) {
					// Invalid blend mode - fall back to default 'source-over'
					mw.log.warn( '[CanvasRenderer] Invalid blend mode "' + layer.blend + '":', blendError.message );
					this.ctx.globalCompositeOperation = 'source-over';
				}
			}

			// Shadow
			if ( layer.shadow ) {
				this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
				this.ctx.shadowBlur = Math.round( layer.shadowBlur || 8 );
				this.ctx.shadowOffsetX = Math.round( layer.shadowOffsetX || 2 );
				this.ctx.shadowOffsetY = Math.round( layer.shadowOffsetY || 2 );
			} else {
				this.ctx.shadowColor = 'transparent';
				this.ctx.shadowBlur = 0;
				this.ctx.shadowOffsetX = 0;
				this.ctx.shadowOffsetY = 0;
			}

			try {
				this.drawLayer( layer );

				// Glow effect
				if ( layer.glow && this.supportsGlow( layer.type ) ) {
					this.drawGlow( layer );
				}
			} finally {
				this.ctx.restore();
			}
		}

		supportsGlow( type ) {
			return [ 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'arrow', 'path' ].indexOf( type ) !== -1;
		}

		drawGlow( layer ) {
			const prevAlpha = this.ctx.globalAlpha;
			this.ctx.globalAlpha = ( prevAlpha || 1 ) * 0.3;
			this.ctx.save();
			this.ctx.strokeStyle = ( layer.stroke || '#000' );
			this.ctx.lineWidth = ( layer.strokeWidth || 1 ) + 6;
			// Re-draw shape outline for glow
			// This is a simplified version, ideally we'd reuse the path
			this.drawLayerShapeOnly( layer );
			this.ctx.restore();
			this.ctx.globalAlpha = prevAlpha;
		}

		drawLayerShapeOnly( layer ) {
			// Helper to draw just the path/shape for glow effect
			// This duplicates some logic but avoids full drawLayer overhead
			switch ( layer.type ) {
				case 'rectangle':
					this.ctx.strokeRect( layer.x || 0, layer.y || 0, layer.width || 0, layer.height || 0 );
					break;
				case 'circle':
					this.ctx.beginPath();
					this.ctx.arc( layer.x || 0, layer.y || 0, layer.radius || 0, 0, 2 * Math.PI );
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
				// Add others as needed
			}
		}

		/**
		 * Draw a layer using the shared LayerRenderer
		 * LayerRenderer is a required dependency (ext.layers.shared)
		 *
		 * @param {Object} layer - Layer to draw
		 */
		drawLayer( layer ) {
			if ( this.layerRenderer ) {
				this.layerRenderer.drawLayer( layer );
			}
		}

		// --- UI Rendering (Selection, Guides, etc.) ---

		/**
		 * Draw selection indicators for all selected layers
		 * Delegates to SelectionRenderer (required module)
		 */
		drawMultiSelectionIndicators() {
			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawMultiSelectionIndicators( this.selectedLayerIds );
				this.selectionHandles = this._selectionRenderer.getHandles();
			} else {
				// Minimal fallback for tests without SelectionRenderer
				this.selectionHandles = [];
			}
		}

		/**
		 * Draw selection indicators for a single layer
		 * Delegates to SelectionRenderer (required module)
		 *
		 * @param {string} layerId - Layer ID
		 */
		drawSelectionIndicators( layerId ) {
			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawSelectionIndicators( layerId );
				this.selectionHandles = this._selectionRenderer.getHandles();
			}
		}

		/**
		 * Draw selection handles
		 * Delegates to SelectionRenderer (required module)
		 *
		 * @param {Object} bounds - Drawing bounds
		 * @param {Object} layer - The layer object
		 * @param {boolean} isRotated - Whether the layer is rotated
		 * @param {Object} worldBounds - World-space bounds
		 */
		drawSelectionHandles( bounds, layer, isRotated, worldBounds ) {
			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawSelectionHandles( bounds, layer, isRotated, worldBounds );
				this.selectionHandles = this._selectionRenderer.getHandles();
			}
		}

		/**
		 * Draw line selection indicators
		 * Delegates to SelectionRenderer (required module)
		 *
		 * @param {Object} layer - The line or arrow layer
		 */
		drawLineSelectionIndicators( layer ) {
			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawLineSelectionIndicators( layer );
				this.selectionHandles = this._selectionRenderer.getHandles();
			}
		}

		/**
		 * Draw rotation handle
		 * Delegates to SelectionRenderer (required module)
		 *
		 * @param {Object} bounds - Drawing bounds
		 * @param {Object} layer - The layer object
		 * @param {boolean} isRotated - Whether the layer is rotated
		 * @param {Object} worldBounds - World-space bounds
		 */
		drawRotationHandle( bounds, layer, isRotated, worldBounds ) {
			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawRotationHandle( bounds, layer, isRotated, worldBounds );
				this.selectionHandles = this._selectionRenderer.getHandles();
			}
		}

		/**
		 * Draw marquee selection box
		 * Delegates to SelectionRenderer (required module)
		 */
		drawMarqueeBox() {
			if ( !this.isMarqueeSelecting || !this.marqueeRect ) {
				return;
			}

			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawMarqueeBox( this.marqueeRect );
			}
		}

		// --- Helpers ---

		applyLayerStyle( layer ) {
			if ( layer.fill ) {
				this.ctx.fillStyle = layer.fill;
			} else if ( layer.color ) {
				this.ctx.fillStyle = layer.color;
			}
			if ( layer.stroke ) {
				this.ctx.strokeStyle = layer.stroke;
			}
			if ( layer.strokeWidth ) {
				this.ctx.lineWidth = layer.strokeWidth;
			}
			if ( typeof layer.opacity === 'number' ) {
				this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}
			if ( layer.blendMode || layer.blend ) {
				this.ctx.globalCompositeOperation = layer.blendMode || layer.blend;
			}
			if ( layer.rotation ) {
				const centerX = ( layer.x || 0 ) + ( layer.width || 0 ) / 2;
				const centerY = ( layer.y || 0 ) + ( layer.height || 0 ) / 2;
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( layer.rotation * Math.PI / 180 );
				this.ctx.translate( -centerX, -centerY );
			}
		}

		withLocalAlpha( factor, fn ) {
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

		clearShadow() {
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;
		}

		getLayerBounds( layer ) {
			// Uses TextUtils/GeometryUtils for bounds calculation
			if ( !layer ) {
				return null;
			}
			const baseBounds = this._getRawLayerBounds( layer );
			if ( !baseBounds ) {
				return null;
			}
			return baseBounds; // Simplified for now, rotation handled in drawSelectionIndicators
		}

		_getRawLayerBounds( layer ) {
			// Handle text layers specially - they need canvas context for measurement
			if ( layer && layer.type === 'text' ) {
				const canvasWidth = this.canvas ? this.canvas.width : 0;
				const TextUtils = getTextUtils();
				const metrics = TextUtils ? TextUtils.measureTextLayer( layer, this.ctx, canvasWidth ) : null;
				return metrics ? { x: metrics.originX, y: metrics.originY, width: metrics.width, height: metrics.height } : null;
			}
			// Use GeometryUtils for all other layer types
			const GeometryUtils = getGeometryUtils();
			return GeometryUtils ? GeometryUtils.getLayerBoundsForType( layer ) : null;
		}

		drawErrorPlaceholder( layer ) {
			this.ctx.save();
			this.ctx.fillStyle = '#ff9999';
			this.ctx.strokeStyle = '#cc0000';
			this.ctx.lineWidth = 2;

			const x = layer.x || 0;
			const y = layer.y || 0;
			const width = layer.width || 50;
			const height = layer.height || 50;

			this.ctx.fillRect( x, y, width, height );
			this.ctx.strokeRect( x, y, width, height );

			// Draw error icon (X)
			this.ctx.strokeStyle = '#ffffff';
			this.ctx.lineWidth = 3;
			this.ctx.beginPath();
			this.ctx.moveTo( x + 10, y + 10 );
			this.ctx.lineTo( x + width - 10, y + height - 10 );
			this.ctx.moveTo( x + width - 10, y + 10 );
			this.ctx.lineTo( x + 10, y + height - 10 );
			this.ctx.stroke();

			this.ctx.restore();
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			// Clear canvas pool
			if ( this.canvasPool && this.canvasPool.length > 0 ) {
				this.canvasPool.forEach( function ( pooledCanvas ) {
					pooledCanvas.width = 0;
					pooledCanvas.height = 0;
				} );
				this.canvasPool = [];
			}

			// Clear canvas state stack
			this.canvasStateStack = [];

			// Clear selection state
			this.selectedLayerIds = [];
			this.selectionHandles = [];
			this.rotationHandle = null;
			this.marqueeRect = null;

			// Clear guides
			this.horizontalGuides = [];
			this.verticalGuides = [];

			// Destroy layer renderer
			if ( this.layerRenderer && typeof this.layerRenderer.destroy === 'function' ) {
				this.layerRenderer.destroy();
			}
			this.layerRenderer = null;

			// Destroy selection renderer
			if ( this._selectionRenderer && typeof this._selectionRenderer.destroy === 'function' ) {
				this._selectionRenderer.destroy();
			}
			this._selectionRenderer = null;

			// Clear references
			this.backgroundImage = null;
			this.canvas = null;
			this.ctx = null;
			this.config = null;
			this.editor = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.Renderer = CanvasRenderer;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasRenderer;
	}

}() );
