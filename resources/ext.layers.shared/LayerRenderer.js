/**
 * LayerRenderer - Shared rendering engine for Layers extension
 *
 * This module provides a unified rendering implementation used by both:
 * - LayersViewer (read-only article display)
 * - CanvasRenderer/ShapeRenderer (editor)
 *
 * By centralizing rendering logic here, we ensure:
 * 1. Visual consistency between viewer and editor
 * 2. Single source of truth for bug fixes
 * 3. Reduced code duplication (~1,000 lines eliminated)
 *
 * Shadow rendering is delegated to ShadowRenderer for clean separation of concerns.
 *
 * @module LayerRenderer
 * @since 0.9.0
 */
( function () {
	'use strict';

	// Get ShadowRenderer - it should be loaded before this module
	const ShadowRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ShadowRenderer ) ||
		( typeof require !== 'undefined' ? require( './ShadowRenderer.js' ) : null );

	// Get ArrowRenderer - it should be loaded before this module
	const ArrowRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ArrowRenderer ) ||
		( typeof require !== 'undefined' ? require( './ArrowRenderer.js' ) : null );

	// Get TextRenderer - it should be loaded before this module
	const TextRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.TextRenderer ) ||
		( typeof require !== 'undefined' ? require( './TextRenderer.js' ) : null );

	// Get TextBoxRenderer - it should be loaded before this module
	const TextBoxRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.TextBoxRenderer ) ||
		( typeof require !== 'undefined' ? require( './TextBoxRenderer.js' ) : null );

	// Get PolygonStarRenderer - it should be loaded before this module
	const PolygonStarRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.PolygonStarRenderer ) ||
		( typeof require !== 'undefined' ? require( './PolygonStarRenderer.js' ) : null );

	// Get ShapeRenderer - it should be loaded before this module
	const ShapeRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ShapeRenderer ) ||
		( typeof require !== 'undefined' ? require( './ShapeRenderer.js' ) : null );

	// Get EffectsRenderer - it should be loaded before this module
	const EffectsRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.EffectsRenderer ) ||
		( typeof require !== 'undefined' ? require( './EffectsRenderer.js' ) : null );

	/**
	 * LayerRenderer class - Renders individual layer shapes on a canvas
	 */
class LayerRenderer {
	/**
	 * Creates a new LayerRenderer instance
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
	 * @param {Object} [config] - Configuration options
	 * @param {number} [config.zoom=1] - Current zoom level (for editor)
	 * @param {HTMLImageElement} [config.backgroundImage] - Background image for blur effects
	 * @param {HTMLCanvasElement} [config.canvas] - Canvas element reference
	 * @param {number} [config.baseWidth] - Original image width for scaling (viewer mode)
	 * @param {number} [config.baseHeight] - Original image height for scaling (viewer mode)
	 * @param {Function} [config.onImageLoad] - Callback when an image layer finishes loading
	 */
	constructor( ctx, config ) {
		this.ctx = ctx;
		this.config = config || {};
		this.zoom = this.config.zoom || 1;
		this.backgroundImage = this.config.backgroundImage || null;
		this.canvas = this.config.canvas || null;
		this.baseWidth = this.config.baseWidth || null;
		this.baseHeight = this.config.baseHeight || null;
		this.onImageLoad = this.config.onImageLoad || null;

		// Create ShadowRenderer instance for shadow operations
		if ( ShadowRenderer ) {
			this.shadowRenderer = new ShadowRenderer( ctx, { canvas: this.canvas } );
		} else {
			this.shadowRenderer = null;
		}

		// Create ArrowRenderer instance for arrow shape operations
		if ( ArrowRenderer ) {
			this.arrowRenderer = new ArrowRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
		} else {
			this.arrowRenderer = null;
		}

		// Create TextRenderer instance for text shape operations
		if ( TextRenderer ) {
			this.textRenderer = new TextRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
		} else {
			this.textRenderer = null;
		}

		// Create PolygonStarRenderer for polygon/star operations
		if ( PolygonStarRenderer ) {
			this.polygonStarRenderer = new PolygonStarRenderer( ctx, {} );
		} else {
			this.polygonStarRenderer = null;
		}

		// Create ShapeRenderer instance for basic shape operations
		if ( ShapeRenderer ) {
			this.shapeRenderer = new ShapeRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
			// Wire up PolygonStarRenderer for polygon/star delegation
			if ( this.polygonStarRenderer ) {
				this.shapeRenderer.setPolygonStarRenderer( this.polygonStarRenderer );
			}
		} else {
			this.shapeRenderer = null;
		}

		// Create TextBoxRenderer instance for text box shape operations
		if ( TextBoxRenderer ) {
			this.textBoxRenderer = new TextBoxRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
		} else {
			this.textBoxRenderer = null;
		}

		// Create EffectsRenderer instance for blur operations
		if ( EffectsRenderer ) {
			this.effectsRenderer = new EffectsRenderer( ctx, {
				canvas: this.canvas,
				backgroundImage: this.backgroundImage,
				baseWidth: this.baseWidth,
				baseHeight: this.baseHeight
			} );
		} else {
			this.effectsRenderer = null;
		}
	}

	// ========================================================================
	// Configuration Methods
	// ========================================================================

	/**
	 * Update the rendering context
	 * Used when rendering to a different context (e.g., export canvas)
	 *
	 * @param {CanvasRenderingContext2D} ctx - New rendering context
	 */
	setContext( ctx ) {
		this.ctx = ctx;
		// Update sub-renderers
		if ( this.shadowRenderer ) {
			this.shadowRenderer.setContext( ctx );
		}
		if ( this.arrowRenderer ) {
			this.arrowRenderer.setContext( ctx );
		}
		if ( this.textRenderer ) {
			this.textRenderer.setContext( ctx );
		}
		if ( this.shapeRenderer ) {
			this.shapeRenderer.setContext( ctx );
		}
		if ( this.textBoxRenderer ) {
			this.textBoxRenderer.setContext( ctx );
		}
		if ( this.effectsRenderer ) {
			this.effectsRenderer.setContext( ctx );
		}
	}

	/**
	 * Update the zoom level
	 *
	 * @param {number} zoom - New zoom level
	 */
	setZoom( zoom ) {
		this.zoom = zoom;
	}

	/**
	 * Set the background image (used for blur effects)
	 *
	 * @param {HTMLImageElement} img - Background image
	 */
	setBackgroundImage ( img ) {
		this.backgroundImage = img;
	}

	/**
	 * Set the canvas reference
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element
	 */
	setCanvas ( canvas ) {
		this.canvas = canvas;
		if ( this.shadowRenderer ) {
			this.shadowRenderer.setCanvas( canvas );
		}
	}

	/**
	 * Set base dimensions for scaling (viewer mode)
	 *
	 * @param {number} width - Original image width
	 * @param {number} height - Original image height
	 */
	setBaseDimensions ( width, height ) {
		this.baseWidth = width;
		this.baseHeight = height;
	}

	/**
	 * Get current scale factors for viewer mode
	 *
	 * @private
	 * @return {Object} Scale factors {sx, sy, avg}
	 */
	getScaleFactors () {
		if ( !this.baseWidth || !this.baseHeight || !this.canvas ) {
			return { sx: 1, sy: 1, avg: 1 };
		}
		const sx = ( this.canvas.width || 1 ) / this.baseWidth;
		const sy = ( this.canvas.height || 1 ) / this.baseHeight;
		return { sx: sx, sy: sy, avg: ( sx + sy ) / 2 };
	}

	// ========================================================================
	// Shadow Delegation Methods (delegates to ShadowRenderer)
	// ========================================================================

	/** Clear shadow settings from context */
	clearShadow() { if ( this.shadowRenderer ) { this.shadowRenderer.clearShadow(); } }

	/** Apply shadow settings to context (blur and offset only, not spread) */
	applyShadow( layer, scale ) { if ( this.shadowRenderer ) { this.shadowRenderer.applyShadow( layer, scale ); } }

	/** Get shadow spread value from layer */
	getShadowSpread( layer, scale ) {
		return this.shadowRenderer ? this.shadowRenderer.getShadowSpread( layer, scale ) : 0;
	}

	/** Check if shadow is enabled on a layer */
	hasShadowEnabled( layer ) {
		return this.shadowRenderer ? this.shadowRenderer.hasShadowEnabled( layer ) : false;
	}

	/** Get shadow parameters for offscreen rendering technique */
	getShadowParams( layer, scale ) {
		return this.shadowRenderer ? this.shadowRenderer.getShadowParams( layer, scale ) :
			{ offsetX: 0, offsetY: 0, blur: 0, color: 'transparent', offscreenOffset: 0 };
	}

	/** Draw a spread shadow using offscreen canvas technique */
	drawSpreadShadow( layer, scale, spread, drawExpandedPathFn, opacity ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.setContext( this.ctx );
			this.shadowRenderer.drawSpreadShadow( layer, scale, spread, drawExpandedPathFn, opacity );
		}
	}

	/** Draw a spread shadow for stroked shapes using offscreen canvas */
	drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.setContext( this.ctx );
			this.shadowRenderer.drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity );
		}
	}

	/** Execute a function with a temporary globalAlpha multiplier */
	withLocalAlpha( alpha, drawFn ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.withLocalAlpha( alpha, drawFn );
		} else if ( typeof drawFn === 'function' ) {
			drawFn.call( this );
		}
	}

	// ========================================================================
	// Shape Drawing Methods (delegates to specialized renderers)
	// ========================================================================

	/** Helper to prepare options for renderer delegation */
	_prepareRenderOptions( options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
		return { scale, shadowScale: opts.shadowScale || scale, scaled: opts.scaled };
	}

	/** Draw a rectangle shape */
	drawRectangle( layer, options ) {
		if ( this.shapeRenderer ) { this.shapeRenderer.setContext( this.ctx ); this.shapeRenderer.drawRectangle( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw a text box shape (rectangle with multi-line text) */
	drawTextBox( layer, options ) {
		if ( this.textBoxRenderer ) { this.textBoxRenderer.setContext( this.ctx ); this.textBoxRenderer.draw( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw a circle shape */
	drawCircle( layer, options ) {
		if ( this.shapeRenderer ) { this.shapeRenderer.setContext( this.ctx ); this.shapeRenderer.drawCircle( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw an ellipse shape */
	drawEllipse( layer, options ) {
		if ( this.shapeRenderer ) { this.shapeRenderer.setContext( this.ctx ); this.shapeRenderer.drawEllipse( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw a line shape */
	drawLine( layer, options ) {
		if ( this.shapeRenderer ) { this.shapeRenderer.setContext( this.ctx ); this.shapeRenderer.drawLine( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw an arrow as a closed polygon */
	drawArrow( layer, options ) {
		if ( this.arrowRenderer ) { this.arrowRenderer.setContext( this.ctx ); this.arrowRenderer.draw( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw a polygon shape */
	drawPolygon( layer, options ) {
		if ( this.shapeRenderer ) { this.shapeRenderer.setContext( this.ctx ); this.shapeRenderer.drawPolygon( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw a star shape */
	drawStar( layer, options ) {
		if ( this.shapeRenderer ) { this.shapeRenderer.setContext( this.ctx ); this.shapeRenderer.drawStar( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw a freehand path */
	drawPath( layer, options ) {
		if ( this.shapeRenderer ) { this.shapeRenderer.setContext( this.ctx ); this.shapeRenderer.drawPath( layer, this._prepareRenderOptions( options ) ); }
	}

	/** Draw a blur effect region */
	drawBlur( layer, options ) {
		if ( this.effectsRenderer ) { this.effectsRenderer.setContext( this.ctx ); this.effectsRenderer.drawBlur( layer, options ); }
	}

	/**
	 * Draw an image layer
	 *
	 * @param {Object} layer - Image layer with src, x, y, width, height properties
	 * @param {Object} [options] - Rendering options
	 */
	drawImage( layer, options ) {
		const opts = this._prepareRenderOptions( options );
		const scale = opts.scale;

		// Get the cached image, or load it if not cached
		const img = this._getImageElement( layer );
		if ( !img || !img.complete ) {
			// Image not ready yet - draw a placeholder
			this._drawImagePlaceholder( layer, scale );
			return;
		}

		// Calculate scaled position and dimensions
		const x = ( layer.x || 0 ) * scale.sx;
		const y = ( layer.y || 0 ) * scale.sy;
		const width = ( layer.width || img.naturalWidth ) * scale.sx;
		const height = ( layer.height || img.naturalHeight ) * scale.sy;

		this.ctx.save();

		// Apply opacity if specified
		if ( layer.opacity !== undefined && layer.opacity !== 1 ) {
			this.ctx.globalAlpha = layer.opacity;
		}

		// Apply rotation if specified
		if ( layer.rotation ) {
			const centerX = x + width / 2;
			const centerY = y + height / 2;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( layer.rotation * Math.PI / 180 );
			this.ctx.translate( -centerX, -centerY );
		}

		// Apply shadow if enabled
		// Use shadowScale from options if provided (for viewer scaling), otherwise use 1:1 scale
		const shadowScale = opts.shadowScale || { sx: 1, sy: 1, avg: 1 };
		if ( this.shadowRenderer && this.shadowRenderer.hasShadowEnabled( layer ) ) {
			this.shadowRenderer.applyShadow( layer, shadowScale );
		}

		// Draw the image
		this.ctx.drawImage( img, x, y, width, height );

		// Clear shadow after drawing
		if ( this.shadowRenderer ) {
			this.shadowRenderer.clearShadow();
		}

		this.ctx.restore();
	}

	/**
	 * Get or create cached image element for a layer
	 *
	 * @param {Object} layer - Image layer
	 * @return {HTMLImageElement|null} - Image element or null if not available
	 */
	_getImageElement( layer ) {
		if ( !layer.src ) {
			return null;
		}

		// Use layer id as cache key
		const cacheKey = layer.id || layer.src.substring( 0, 50 );

		// Check if we have a cached image
		if ( !this._imageCache ) {
			this._imageCache = new Map();
		}

		if ( this._imageCache.has( cacheKey ) ) {
			return this._imageCache.get( cacheKey );
		}

		// Create new image element and start loading
		const img = new Image();
		this._imageCache.set( cacheKey, img );

		// Store reference to this for closure
		const self = this;

		// Request redraw when image loads
		img.onload = () => {
			// Use the configured callback (preferred)
			if ( self.onImageLoad && typeof self.onImageLoad === 'function' ) {
				self.onImageLoad();
			}
			// Fallback to global requestRedraw if available
			else if ( typeof window !== 'undefined' && window.Layers && window.Layers.requestRedraw ) {
				window.Layers.requestRedraw();
			}
		};

		// Handle load errors gracefully
		img.onerror = () => {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[LayerRenderer] Failed to load image layer:', cacheKey );
			}
		};

		// Set src after handlers to ensure events fire
		img.src = layer.src;

		return img;
	}

	/**
	 * Draw a placeholder while image is loading
	 *
	 * @param {Object} layer - Image layer
	 * @param {Object} scale - Scale factors
	 */
	_drawImagePlaceholder( layer, scale ) {
		const x = ( layer.x || 0 ) * scale.sx;
		const y = ( layer.y || 0 ) * scale.sy;
		const width = ( layer.width || 100 ) * scale.sx;
		const height = ( layer.height || 100 ) * scale.sy;

		this.ctx.save();
		this.ctx.strokeStyle = '#888';
		this.ctx.lineWidth = 1;
		this.ctx.setLineDash( [ 5, 5 ] );
		this.ctx.strokeRect( x, y, width, height );

		// Draw loading indicator (diagonal lines)
		this.ctx.beginPath();
		this.ctx.moveTo( x, y );
		this.ctx.lineTo( x + width, y + height );
		this.ctx.moveTo( x + width, y );
		this.ctx.lineTo( x, y + height );
		this.ctx.stroke();
		this.ctx.restore();
	}

	/** Draw a text layer */
	drawText( layer, options ) {
		if ( this.textRenderer ) { this.textRenderer.setContext( this.ctx ); this.textRenderer.draw( layer, this._prepareRenderOptions( options ) ); }
	}

	// ========================================================================
	// Blur Blend Mode Support
	// ========================================================================

	/**
	 * Check if a layer uses blur as its blend mode
	 *
	 * @param {Object} layer - Layer to check
	 * @return {boolean} True if layer uses blur blend mode
	 */
	hasBlurBlendMode( layer ) {
		const blendMode = layer.blendMode || layer.blend;
		return blendMode === 'blur';
	}

	/**
	 * Draw a layer with blur blend mode (uses shape as clip region for blur effect)
	 *
	 * @param {Object} layer - Layer with blur blend mode
	 * @param {Object} [options] - Rendering options
	 */
	drawLayerWithBlurBlend( layer, options ) {
		if ( !this.effectsRenderer ) {
			// Fallback: draw shape normally if effects renderer unavailable
			this._drawLayerByType( layer, options );
			return;
		}

		const self = this;
		const opts = this._prepareRenderOptions( options );

		// Create a function that draws the shape path
		const drawPathFn = ( ctx ) => {
			self._drawShapePath( layer, opts, ctx );
		};

		// Use the effects renderer to apply blur with the shape as clip
		this.effectsRenderer.setContext( this.ctx );
		this.effectsRenderer.drawBlurWithShape( layer, drawPathFn, opts );
	}

	/**
	 * Draw just the shape path (for clipping in blur blend mode)
	 *
	 * @param {Object} layer - Layer with shape properties
	 * @param {Object} opts - Render options with scale
	 * @param {CanvasRenderingContext2D} ctx - Context to draw on
	 */
	_drawShapePath( layer, opts, ctx ) {
		const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
		const type = layer.type;

		// Apply rotation transform if needed
		let x, y, width, height, centerX, centerY;
		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;

		if ( hasRotation ) {
			// Calculate center for rotation
			switch ( type ) {
				case 'circle':
					x = ( layer.x || 0 ) * scale.sx;
					y = ( layer.y || 0 ) * scale.sy;
					centerX = x;
					centerY = y;
					break;
				case 'ellipse':
					x = ( layer.x || 0 ) * scale.sx;
					y = ( layer.y || 0 ) * scale.sy;
					centerX = x;
					centerY = y;
					break;
				default:
					x = ( layer.x || 0 ) * scale.sx;
					y = ( layer.y || 0 ) * scale.sy;
					width = ( layer.width || 0 ) * scale.sx;
					height = ( layer.height || 0 ) * scale.sy;
					centerX = x + width / 2;
					centerY = y + height / 2;
			}
			ctx.translate( centerX, centerY );
			ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			ctx.translate( -centerX, -centerY );
		}

		switch ( type ) {
			case 'rectangle':
			case 'rect':
				this._drawRectPath( layer, scale, ctx );
				break;
			case 'circle':
				this._drawCirclePath( layer, scale, ctx );
				break;
			case 'ellipse':
				this._drawEllipsePath( layer, scale, ctx );
				break;
			case 'polygon':
				this._drawPolygonPath( layer, scale, ctx );
				break;
			case 'star':
				this._drawStarPath( layer, scale, ctx );
				break;
			default:
				// Fallback: rectangle bounding box
				this._drawRectPath( layer, scale, ctx );
		}
	}

	/**
	 * Draw rectangle path
	 * @private
	 */
	_drawRectPath( layer, scale, ctx ) {
		const x = ( layer.x || 0 ) * scale.sx;
		const y = ( layer.y || 0 ) * scale.sy;
		const w = ( layer.width || 0 ) * scale.sx;
		const h = ( layer.height || 0 ) * scale.sy;
		let cornerRadius = ( layer.cornerRadius || 0 ) * scale.avg;
		cornerRadius = Math.min( cornerRadius, Math.min( w, h ) / 2 );

		if ( cornerRadius > 0 && ctx.roundRect ) {
			ctx.roundRect( x, y, w, h, cornerRadius );
		} else {
			ctx.rect( x, y, w, h );
		}
	}

	/**
	 * Draw circle path
	 * @private
	 */
	_drawCirclePath( layer, scale, ctx ) {
		const x = ( layer.x || 0 ) * scale.sx;
		const y = ( layer.y || 0 ) * scale.sy;
		const radius = ( layer.radius || 0 ) * scale.avg;
		ctx.arc( x, y, radius, 0, Math.PI * 2 );
	}

	/**
	 * Draw ellipse path
	 * @private
	 */
	_drawEllipsePath( layer, scale, ctx ) {
		const x = ( layer.x || 0 ) * scale.sx;
		const y = ( layer.y || 0 ) * scale.sy;
		const radiusX = ( layer.radiusX || layer.width / 2 || 0 ) * scale.sx;
		const radiusY = ( layer.radiusY || layer.height / 2 || 0 ) * scale.sy;
		ctx.ellipse( x, y, radiusX, radiusY, 0, 0, Math.PI * 2 );
	}

	/**
	 * Draw polygon path
	 * @private
	 */
	_drawPolygonPath( layer, scale, ctx ) {
		const x = ( layer.x || 0 ) * scale.sx;
		const y = ( layer.y || 0 ) * scale.sy;
		const radius = ( layer.radius || 50 ) * scale.avg;
		const sides = layer.sides || 6;
		const rotation = ( layer.rotation || 0 ) * Math.PI / 180;

		for ( let i = 0; i < sides; i++ ) {
			const angle = ( i * 2 * Math.PI / sides ) - Math.PI / 2 + rotation;
			const px = x + radius * Math.cos( angle );
			const py = y + radius * Math.sin( angle );
			if ( i === 0 ) {
				ctx.moveTo( px, py );
			} else {
				ctx.lineTo( px, py );
			}
		}
		ctx.closePath();
	}

	/**
	 * Draw star path
	 * @private
	 */
	_drawStarPath( layer, scale, ctx ) {
		const x = ( layer.x || 0 ) * scale.sx;
		const y = ( layer.y || 0 ) * scale.sy;
		const outerRadius = ( layer.radius || layer.outerRadius || 50 ) * scale.avg;
		const innerRadius = ( layer.innerRadius || outerRadius * 0.5 ) * scale.avg;
		const points = layer.points || 5;
		const rotation = ( layer.rotation || 0 ) * Math.PI / 180;

		for ( let i = 0; i < points * 2; i++ ) {
			const radius = i % 2 === 0 ? outerRadius : innerRadius;
			const angle = ( i * Math.PI / points ) - Math.PI / 2 + rotation;
			const px = x + radius * Math.cos( angle );
			const py = y + radius * Math.sin( angle );
			if ( i === 0 ) {
				ctx.moveTo( px, py );
			} else {
				ctx.lineTo( px, py );
			}
		}
		ctx.closePath();
	}

	// ========================================================================
	// Dispatcher
	// ========================================================================

	/**
	 * Draw a layer by type (dispatcher method)
	 *
	 * @param {Object} layer - Layer to draw
	 * @param {Object} [options] - Rendering options
	 */
	drawLayer ( layer, options ) {
		// Check for blur blend mode - use special rendering path
		if ( this.hasBlurBlendMode( layer ) && layer.type !== 'blur' ) {
			this.drawLayerWithBlurBlend( layer, options );
			return;
		}

		this._drawLayerByType( layer, options );
	}

	/**
	 * Draw layer by type (internal dispatch)
	 *
	 * @param {Object} layer - Layer to draw
	 * @param {Object} [options] - Rendering options
	 * @private
	 */
	_drawLayerByType( layer, options ) {
		switch ( layer.type ) {
			case 'text':
				this.drawText( layer, options );
				break;
			case 'textbox':
				this.drawTextBox( layer, options );
				break;
			case 'rectangle':
			case 'rect':
				this.drawRectangle( layer, options );
				break;
			case 'circle':
				this.drawCircle( layer, options );
				break;
			case 'ellipse':
				this.drawEllipse( layer, options );
				break;
			case 'polygon':
				this.drawPolygon( layer, options );
				break;
			case 'star':
				this.drawStar( layer, options );
				break;
			case 'line':
				this.drawLine( layer, options );
				break;
			case 'arrow':
				this.drawArrow( layer, options );
				break;
			case 'path':
				this.drawPath( layer, options );
				break;
			case 'blur':
				this.drawBlur( layer, options );
				break;
			case 'image':
				this.drawImage( layer, options );
				break;
		}
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

	/**
	 * Clean up resources
	 */
	destroy() {
		this.ctx = null;
		this.config = null;
		this.backgroundImage = null;
		this.canvas = null;
		this.baseWidth = null;
		this.baseHeight = null;
		if ( this._imageCache ) {
			this._imageCache.clear();
			this._imageCache = null;
		}
	}
}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.LayerRenderer = LayerRenderer;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = LayerRenderer;
	}

}() );
