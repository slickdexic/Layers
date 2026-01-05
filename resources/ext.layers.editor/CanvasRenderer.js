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

			// Get the key object ID from selection manager for visual distinction
			let keyObjectId = null;
			if ( this.editor && this.editor.canvasManager && this.editor.canvasManager.selectionManager ) {
				keyObjectId = this.editor.canvasManager.selectionManager.lastSelectedId;
			}

			this.drawMultiSelectionIndicators( keyObjectId );
			this.drawMarqueeBox();

			// Draw smart guides if available and active
			this.drawSmartGuides();
		}

		/**
		 * Draw smart guides overlay (called after other overlays)
		 */
		drawSmartGuides() {
			if ( !this.editor || !this.editor.canvasManager ) {
				return;
			}
			const smartGuidesController = this.editor.canvasManager.smartGuidesController;
			if ( smartGuidesController && typeof smartGuidesController.render === 'function' ) {
				smartGuidesController.render( this.ctx );
			}
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

			// Always draw a solid white background first to ensure blur fill works
			// correctly with PNG images that have transparency. Without this,
			// transparent areas would blur to transparent pixels instead of white.
			this.ctx.globalAlpha = 1;
			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillRect( 0, 0, this.canvas.width / this.zoom, this.canvas.height / this.zoom );

			if ( opacity < 1 ) {
				// Draw checker pattern for transparency visualization when opacity is reduced
				this.drawCheckerPatternToContext();
			}

			this.ctx.globalAlpha = opacity;

			// Scale the background image to fit the canvas dimensions.
			// This is critical when the loaded image (e.g., a thumbnail) has different
			// dimensions than the canvas (which uses original file dimensions).
			// For TIFF files, we load a 2048px thumbnail but the canvas is sized to
			// the original file dimensions (e.g., 567x925).
			const canvasW = this.canvas.width / this.zoom;
			const canvasH = this.canvas.height / this.zoom;
			this.ctx.drawImage( this.backgroundImage, 0, 0, canvasW, canvasH );
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
					this.drawLayerWithEffects( layer );
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
					this.drawLayerWithEffects( layer );
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

		drawLayerWithEffects( layer ) {
			// Check for blur blend mode - use special rendering path
			// Skip arrows and lines - they handle blur fill via ArrowRenderer/effectsRenderer,
			// and blur blend mode with rectangular clip doesn't make sense for these shapes
			const blendMode = layer.blendMode || layer.blend;
			const isArrowOrLine = layer.type === 'arrow' || layer.type === 'line';
			if ( blendMode === 'blur' && !isArrowOrLine ) {
				this.drawLayerWithBlurBlend( layer );
				return;
			}

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

		/**
		 * Draw a layer with blur blend mode
		 * Uses the shape as a clipping region for a blur effect on everything below.
		 * Blur acts as a fill - stroke and content (text, arrows) are drawn on top.
		 *
		 * @param {Object} layer - Layer with blur blend mode
		 */
		drawLayerWithBlurBlend( layer ) {
			const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );

			// Calculate scaled coordinates (screen space)
			const x = ( layer.x || 0 ) * this.zoom + this.panX;
			const y = ( layer.y || 0 ) * this.zoom + this.panY;
			const width = ( layer.width || 0 ) * this.zoom;
			const height = ( layer.height || 0 ) * this.zoom;

			// For arrow, calculate center differently
			let centerX, centerY;
			if ( layer.type === 'arrow' || layer.type === 'line' ) {
				const x1 = ( layer.x1 || 0 ) * this.zoom + this.panX;
				const y1 = ( layer.y1 || 0 ) * this.zoom + this.panY;
				const x2 = ( layer.x2 || 0 ) * this.zoom + this.panX;
				const y2 = ( layer.y2 || 0 ) * this.zoom + this.panY;
				centerX = ( x1 + x2 ) / 2;
				centerY = ( y1 + y2 ) / 2;
			} else {
				centerX = x + width / 2;
				centerY = y + height / 2;
			}

			this.ctx.save();

			// CRITICAL: Reset transform to identity for blur operations.
			// We're working in screen/pixel coordinates, not layer coordinates.
			// The clipping path and blur must be drawn in screen space.
			this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );

			// Apply rotation if needed (in screen coordinates)
			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			if ( hasRotation ) {
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				this.ctx.translate( -centerX, -centerY );
			}

			// Apply layer opacity for the blur fill
			if ( typeof layer.opacity === 'number' ) {
				this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}

			// Create clipping path based on shape type (in screen coordinates)
			this.ctx.beginPath();
			this._drawBlurClipPath( layer );
			this.ctx.clip();

			try {
				// Capture EVERYTHING currently on the canvas (all layers below)
				const tempCanvas = document.createElement( 'canvas' );
				tempCanvas.width = this.canvas.width;
				tempCanvas.height = this.canvas.height;
				const tempCtx = tempCanvas.getContext( '2d' );

				if ( tempCtx ) {
					// Copy the current canvas content (includes background + all previously drawn layers)
					tempCtx.drawImage( this.canvas, 0, 0 );

					// Apply blur and draw back within the clip region
					// Note: blur radius stays in pixels, not scaled by zoom
					this.ctx.filter = 'blur(' + radius + 'px)';
					this.ctx.drawImage( tempCanvas, 0, 0 );
					this.ctx.filter = 'none';
				}
			} catch ( e ) {
				// Error fallback - draw a semi-transparent overlay
				mw.log.warn( '[CanvasRenderer] Blur blend mode failed:', e.message );
				this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
				this.ctx.beginPath();
				this._drawBlurClipPath( layer );
				this.ctx.fill();
			}

			this.ctx.restore();

			// Draw stroke AFTER the blur (outside the clipped/saved state)
			// This makes blur act as a fill effect only
			this._drawBlurStroke( layer, hasRotation, centerX, centerY );

			// Draw content on top (text for textbox/text, arrow shape for arrows)
			this._drawBlurContent( layer, hasRotation, centerX, centerY );
		}

		/**
		 * Draw stroke for blur blend mode layer
		 *
		 * @param {Object} layer - Layer
		 * @param {boolean} hasRotation - Whether rotation is applied
		 * @param {number} centerX - Rotation center X
		 * @param {number} centerY - Rotation center Y
		 * @private
		 */
		_drawBlurStroke( layer, hasRotation, centerX, centerY ) {
			// Skip stroke for text type (it doesn't have shape stroke)
			// Skip stroke for arrow/line types - _drawBlurContent renders them with stroke via LayerRenderer
			if ( layer.type === 'text' || layer.type === 'arrow' || layer.type === 'line' ) {
				return;
			}

			if ( layer.stroke && layer.strokeWidth > 0 ) {
				this.ctx.save();

				// Re-apply rotation for stroke
				if ( hasRotation ) {
					this.ctx.translate( centerX, centerY );
					this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
					this.ctx.translate( -centerX, -centerY );
				}

				// Apply stroke opacity
				if ( typeof layer.strokeOpacity === 'number' ) {
					this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.strokeOpacity ) );
				} else if ( typeof layer.opacity === 'number' ) {
					this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
				}

				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = ( layer.strokeWidth || 1 ) * this.zoom;

				// Apply stroke style (dashed, dotted, etc.)
				if ( layer.strokeStyle === 'dashed' ) {
					this.ctx.setLineDash( [ 8 * this.zoom, 4 * this.zoom ] );
				} else if ( layer.strokeStyle === 'dotted' ) {
					this.ctx.setLineDash( [ 2 * this.zoom, 2 * this.zoom ] );
				} else {
					this.ctx.setLineDash( [] );
				}

				this.ctx.beginPath();
				this._drawBlurClipPath( layer );
				this.ctx.stroke();
				this.ctx.restore();
			}
		}

		/**
		 * Draw content on top of blur (text, arrows)
		 *
		 * @param {Object} layer - Layer
		 * @param {boolean} hasRotation - Whether rotation is applied
		 * @param {number} centerX - Rotation center X
		 * @param {number} centerY - Rotation center Y
		 * @private
		 */
		_drawBlurContent( layer, hasRotation, centerX, centerY ) {
			// Handle text content for textbox
			if ( layer.type === 'textbox' && layer.text ) {
				// Use the layerRenderer to draw only the text portion
				if ( this.layerRenderer && this.layerRenderer.textBoxRenderer ) {
					this.ctx.save();
					if ( hasRotation ) {
						this.ctx.translate( centerX, centerY );
						this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
						this.ctx.translate( -centerX, -centerY );
					}
					this.layerRenderer.textBoxRenderer.setContext( this.ctx );
					this.layerRenderer.textBoxRenderer.drawTextOnly( layer, {
						scale: { sx: this.zoom, sy: this.zoom, avg: this.zoom },
						offset: { x: this.panX, y: this.panY }
					} );
					this.ctx.restore();
				}
			}

			// Handle text type layers
			if ( layer.type === 'text' && layer.text ) {
				if ( this.layerRenderer && this.layerRenderer.textRenderer ) {
					this.ctx.save();
					if ( hasRotation ) {
						this.ctx.translate( centerX, centerY );
						this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
						this.ctx.translate( -centerX, -centerY );
					}
					this.layerRenderer.textRenderer.setContext( this.ctx );
					this.layerRenderer.textRenderer.draw( layer, {
						scale: { sx: this.zoom, sy: this.zoom, avg: this.zoom },
						offset: { x: this.panX, y: this.panY }
					} );
					this.ctx.restore();
				}
			}

			// Handle arrow type - draw arrow shape on top
			if ( layer.type === 'arrow' ) {
				if ( this.layerRenderer && this.layerRenderer.arrowRenderer ) {
					this.ctx.save();
					// Arrow handles its own rotation
					this.layerRenderer.arrowRenderer.setContext( this.ctx );
					this.layerRenderer.arrowRenderer.draw( layer, {
						scale: { sx: this.zoom, sy: this.zoom, avg: this.zoom },
						offset: { x: this.panX, y: this.panY }
					} );
					this.ctx.restore();
				}
			}

			// Handle line type - draw line on top
			if ( layer.type === 'line' ) {
				if ( this.layerRenderer ) {
					this.ctx.save();
					this.layerRenderer.drawLine( layer, {
						zoom: this.zoom,
						panX: this.panX,
						panY: this.panY
					} );
					this.ctx.restore();
				}
			}
		}

		/**
		 * Draw the clipping path for blur blend mode based on layer type
		 *
		 * @param {Object} layer - Layer with shape properties
		 * @private
		 */
		_drawBlurClipPath( layer ) {
			const x = ( layer.x || 0 ) * this.zoom + this.panX;
			const y = ( layer.y || 0 ) * this.zoom + this.panY;
			const width = ( layer.width || 0 ) * this.zoom;
			const height = ( layer.height || 0 ) * this.zoom;

			switch ( layer.type ) {
				case 'rectangle':
				case 'rect': {
					let cornerRadius = ( layer.cornerRadius || 0 ) * this.zoom;
					cornerRadius = Math.min( cornerRadius, Math.min( width, height ) / 2 );
					if ( cornerRadius > 0 && this.ctx.roundRect ) {
						this.ctx.roundRect( x, y, width, height, cornerRadius );
					} else if ( cornerRadius > 0 ) {
						this._drawRoundedRectPath( x, y, width, height, cornerRadius );
					} else {
						this.ctx.rect( x, y, width, height );
					}
					break;
				}
				case 'textbox': {
					// Textbox is like rectangle but always supports corner radius
					let cornerRadius = ( layer.cornerRadius || 0 ) * this.zoom;
					cornerRadius = Math.min( cornerRadius, Math.min( width, height ) / 2 );
					if ( cornerRadius > 0 && this.ctx.roundRect ) {
						this.ctx.roundRect( x, y, width, height, cornerRadius );
					} else if ( cornerRadius > 0 ) {
						this._drawRoundedRectPath( x, y, width, height, cornerRadius );
					} else {
						this.ctx.rect( x, y, width, height );
					}
					break;
				}
				case 'text': {
					// Text uses its bounding box
					this.ctx.rect( x, y, width, height );
					break;
				}
				case 'circle': {
					const radius = ( layer.radius || 0 ) * this.zoom;
					this.ctx.arc( x, y, radius, 0, Math.PI * 2 );
					break;
				}
				case 'ellipse': {
					const radiusX = ( layer.radiusX || width / 2 || 0 ) * this.zoom;
					const radiusY = ( layer.radiusY || height / 2 || 0 ) * this.zoom;
					this.ctx.ellipse( x, y, radiusX, radiusY, 0, 0, Math.PI * 2 );
					break;
				}
				case 'polygon': {
					const radius = ( layer.radius || 50 ) * this.zoom;
					const sides = layer.sides || 6;
					for ( let i = 0; i < sides; i++ ) {
						const angle = ( i * 2 * Math.PI / sides ) - Math.PI / 2;
						const px = x + radius * Math.cos( angle );
						const py = y + radius * Math.sin( angle );
						if ( i === 0 ) {
							this.ctx.moveTo( px, py );
						} else {
							this.ctx.lineTo( px, py );
						}
					}
					this.ctx.closePath();
					break;
				}
				case 'star': {
					const outerRadius = ( layer.radius || layer.outerRadius || 50 ) * this.zoom;
					const innerRadius = ( layer.innerRadius || outerRadius * 0.5 ) * this.zoom;
					const points = layer.points || 5;
					for ( let i = 0; i < points * 2; i++ ) {
						const r = i % 2 === 0 ? outerRadius : innerRadius;
						const angle = ( i * Math.PI / points ) - Math.PI / 2;
						const px = x + r * Math.cos( angle );
						const py = y + r * Math.sin( angle );
						if ( i === 0 ) {
							this.ctx.moveTo( px, py );
						} else {
							this.ctx.lineTo( px, py );
						}
					}
					this.ctx.closePath();
					break;
				}
				case 'arrow':
				case 'line': {
					// Arrow uses line endpoints to create a bounding region
					const x1 = ( layer.x1 || 0 ) * this.zoom + this.panX;
					const y1 = ( layer.y1 || 0 ) * this.zoom + this.panY;
					const x2 = ( layer.x2 || 0 ) * this.zoom + this.panX;
					const y2 = ( layer.y2 || 0 ) * this.zoom + this.panY;
					const arrowSize = ( layer.arrowSize || 15 ) * this.zoom;
					const strokeWidth = ( layer.strokeWidth || 2 ) * this.zoom;
					const halfWidth = Math.max( arrowSize, strokeWidth * 2 );

					// Create a thick line path (rectangle along the arrow)
					const angle = Math.atan2( y2 - y1, x2 - x1 );
					const perpAngle = angle + Math.PI / 2;
					const dx = Math.cos( perpAngle ) * halfWidth;
					const dy = Math.sin( perpAngle ) * halfWidth;

					this.ctx.moveTo( x1 - dx, y1 - dy );
					this.ctx.lineTo( x2 - dx, y2 - dy );
					this.ctx.lineTo( x2 + dx, y2 + dy );
					this.ctx.lineTo( x1 + dx, y1 + dy );
					this.ctx.closePath();
					break;
				}
				default:
					// Default to rectangle bounding box
					this.ctx.rect( x, y, width, height );
			}
		}

		/**
		 * Draw a rounded rectangle path manually (fallback for browsers without roundRect)
		 *
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {number} width - Width
		 * @param {number} height - Height
		 * @param {number} radius - Corner radius
		 * @private
		 */
		_drawRoundedRectPath( x, y, width, height, radius ) {
			this.ctx.moveTo( x + radius, y );
			this.ctx.lineTo( x + width - radius, y );
			this.ctx.quadraticCurveTo( x + width, y, x + width, y + radius );
			this.ctx.lineTo( x + width, y + height - radius );
			this.ctx.quadraticCurveTo( x + width, y + height, x + width - radius, y + height );
			this.ctx.lineTo( x + radius, y + height );
			this.ctx.quadraticCurveTo( x, y + height, x, y + height - radius );
			this.ctx.lineTo( x, y + radius );
			this.ctx.quadraticCurveTo( x, y, x + radius, y );
			this.ctx.closePath();
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
				// Pass editor transform info for blur fill support
				this.layerRenderer.drawLayer( layer, {
					zoom: this.zoom,
					panX: this.panX,
					panY: this.panY
				} );
			}
		}

		// --- UI Rendering (Selection, Guides, etc.) ---

		/**
		 * Draw selection indicators for all selected layers
		 * Delegates to SelectionRenderer (required module)
		 *
		 * @param {string} [keyObjectId] - ID of the key object (last selected) for visual distinction
		 */
		drawMultiSelectionIndicators( keyObjectId ) {
			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawMultiSelectionIndicators( this.selectedLayerIds, keyObjectId );
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
		 * @param {boolean} [isKeyObject=false] - Whether this is the key object
		 */
		drawSelectionIndicators( layerId, isKeyObject ) {
			if ( this._selectionRenderer ) {
				this._selectionRenderer.drawSelectionIndicators( layerId, isKeyObject );
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
