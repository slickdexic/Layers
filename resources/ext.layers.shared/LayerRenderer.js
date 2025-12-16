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
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './ShadowRenderer.js' ) : null );

	// Get ArrowRenderer - it should be loaded before this module
	const ArrowRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ArrowRenderer ) ||
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './ArrowRenderer.js' ) : null );

	// Get TextRenderer - it should be loaded before this module
	const TextRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.TextRenderer ) ||
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './TextRenderer.js' ) : null );

	// Get ShapeRenderer - it should be loaded before this module
	const ShapeRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ShapeRenderer ) ||
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './ShapeRenderer.js' ) : null );

	// Get EffectsRenderer - it should be loaded before this module
	const EffectsRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.EffectsRenderer ) ||
		// eslint-disable-next-line no-undef
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
	 */
	constructor( ctx, config ) {
		this.ctx = ctx;
		this.config = config || {};
		this.zoom = this.config.zoom || 1;
		this.backgroundImage = this.config.backgroundImage || null;
		this.canvas = this.config.canvas || null;
		this.baseWidth = this.config.baseWidth || null;
		this.baseHeight = this.config.baseHeight || null;

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

		// Create ShapeRenderer instance for basic shape operations
		if ( ShapeRenderer ) {
			this.shapeRenderer = new ShapeRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
		} else {
			this.shapeRenderer = null;
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

		// Draw the image
		this.ctx.drawImage( img, x, y, width, height );

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
		img.src = layer.src;
		this._imageCache.set( cacheKey, img );

		// Request redraw when image loads
		img.onload = () => {
			// Trigger a redraw - the canvas manager should handle this
			if ( typeof window !== 'undefined' && window.Layers && window.Layers.requestRedraw ) {
				window.Layers.requestRedraw();
			}
		};

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
	// Dispatcher
	// ========================================================================

	/**
	 * Draw a layer by type (dispatcher method)
	 *
	 * @param {Object} layer - Layer to draw
	 * @param {Object} [options] - Rendering options
	 */
	drawLayer ( layer, options ) {
		switch ( layer.type ) {
			case 'text':
				this.drawText( layer, options );
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
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = LayerRenderer;
	}

}() );
