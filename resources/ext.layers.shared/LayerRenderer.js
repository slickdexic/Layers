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

		// Create EffectsRenderer instance for highlight/blur operations
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
	// Shadow Delegation Methods
	// These methods delegate to ShadowRenderer
	// ========================================================================

	/**
	 * Clear shadow settings from context
	 */
	clearShadow() {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.clearShadow();
		}
	}

	/**
	 * Apply shadow settings to context (blur and offset only, not spread)
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors from getScaleFactors()
	 */
	applyShadow( layer, scale ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.applyShadow( layer, scale );
		}
	}

	/**
	 * Get shadow spread value from layer
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @return {number} Spread value in pixels (scaled)
	 */
	getShadowSpread( layer, scale ) {
		return this.shadowRenderer ? this.shadowRenderer.getShadowSpread( layer, scale ) : 0;
	}

	/**
	 * Check if shadow is enabled on a layer
	 *
	 * @param {Object} layer - Layer to check
	 * @return {boolean} True if shadow is enabled
	 */
	hasShadowEnabled( layer ) {
		return this.shadowRenderer ? this.shadowRenderer.hasShadowEnabled( layer ) : false;
	}

	/**
	 * Get shadow parameters for offscreen rendering technique
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @return {Object} Shadow parameters {offsetX, offsetY, blur, color, offscreenOffset}
	 */
	getShadowParams( layer, scale ) {
		return this.shadowRenderer ?
			this.shadowRenderer.getShadowParams( layer, scale ) :
			{ offsetX: 0, offsetY: 0, blur: 0, color: 'transparent', offscreenOffset: 0 };
	}

	/**
	 * Draw a spread shadow using offscreen canvas technique.
	 * Delegates to ShadowRenderer for the complex offscreen canvas logic.
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} spread - Spread amount in pixels (already scaled)
	 * @param {Function} drawExpandedPathFn - Function that creates the expanded path
	 * @param {number} [opacity=1] - Opacity to apply to the shadow (0-1)
	 */
	drawSpreadShadow( layer, scale, spread, drawExpandedPathFn, opacity ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.setContext( this.ctx );
			this.shadowRenderer.drawSpreadShadow( layer, scale, spread, drawExpandedPathFn, opacity );
		}
	}

	/**
	 * Draw a spread shadow for stroked shapes using offscreen canvas.
	 * Delegates to ShadowRenderer for the complex offscreen canvas logic.
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} strokeWidth - The expanded stroke width to use
	 * @param {Function} drawPathFn - Function that creates the path
	 * @param {number} [opacity=1] - Opacity to apply to the shadow (0-1)
	 */
	drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.setContext( this.ctx );
			this.shadowRenderer.drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity );
		}
	}

	/**
	 * Execute a function with a temporary globalAlpha multiplier
	 *
	 * @param {number|undefined} alpha - Opacity multiplier (0-1)
	 * @param {Function} drawFn - Drawing function to execute
	 */
	withLocalAlpha( alpha, drawFn ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.withLocalAlpha( alpha, drawFn );
		} else if ( typeof drawFn === 'function' ) {
			drawFn.call( this );
		}
	}

	// ========================================================================
	// Shape Drawing Methods
	// ========================================================================

	/**
	 * Draw a rectangle shape
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with rectangle properties
	 * @param {Object} [options] - Rendering options
	 * @param {boolean} [options.scaled=false] - Whether layer coords are pre-scaled
	 */
	drawRectangle ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawRectangle( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a circle shape
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with circle properties (x, y center, radius)
	 * @param {Object} [options] - Rendering options
	 */
	drawCircle ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawCircle( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw an ellipse shape
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with ellipse properties
	 * @param {Object} [options] - Rendering options
	 */
	drawEllipse ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawEllipse( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a line
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with line properties (x1, y1, x2, y2)
	 * @param {Object} [options] - Rendering options
	 */
	drawLine ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawLine( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Build the vertices for an arrow polygon
	 * Delegates to ArrowRenderer for the actual vertex calculation.
	 *
	 * @private
	 * @param {number} x1 - Start X
	 * @param {number} y1 - Start Y
	 * @param {number} x2 - End X (tip direction)
	 * @param {number} y2 - End Y
	 * @param {number} angle - Angle of arrow direction
	 * @param {number} perpAngle - Perpendicular angle
	 * @param {number} halfShaft - Half of shaft width
	 * @param {number} arrowSize - Size of arrowhead
	 * @param {string} arrowStyle - 'single', 'double', or 'none'
	 * @param {string} headType - 'pointed', 'chevron', or 'standard'
	 * @param {number} headScale - Scale factor for arrow head size
	 * @param {number} tailWidth - Extra width at tail end
	 * @return {Array} Array of {x, y} vertex objects
	 */
	buildArrowVertices (
		x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth
	) {
		if ( this.arrowRenderer ) {
			return this.arrowRenderer.buildArrowVertices(
				x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth
			);
		}
		// Fallback: return empty array if ArrowRenderer not available
		return [];
	}

	/**
	 * Draw an arrow as a closed polygon
	 * Delegates to ArrowRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with arrow properties
	 * @param {Object} [options] - Rendering options
	 */
	drawArrow ( layer, options ) {
		if ( this.arrowRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.arrowRenderer.setContext( this.ctx );
			this.arrowRenderer.draw( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a regular polygon (e.g., hexagon, pentagon)
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with sides, x, y, radius
	 * @param {Object} [options] - Rendering options
	 */
	drawPolygon ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawPolygon( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a star shape
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with points (count), x, y, outerRadius, innerRadius
	 * @param {Object} [options] - Rendering options
	 */
	drawStar ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawStar( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a freehand path
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with points array
	 * @param {Object} [options] - Rendering options
	 */
	drawPath ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawPath( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a highlight overlay
	 * Delegates to EffectsRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with highlight properties
	 * @param {Object} [options] - Rendering options
	 */
	drawHighlight( layer, options ) {
		if ( this.effectsRenderer ) {
			this.effectsRenderer.setContext( this.ctx );
			this.effectsRenderer.drawHighlight( layer, options );
		}
	}

	/**
	 * Draw a blur effect region
	 * Delegates to EffectsRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with blur properties
	 * @param {Object} [options] - Rendering options
	 * @param {HTMLImageElement} [options.imageElement] - Image for blur source (viewer mode)
	 */
	drawBlur( layer, options ) {
		if ( this.effectsRenderer ) {
			this.effectsRenderer.setContext( this.ctx );
			this.effectsRenderer.drawBlur( layer, options );
		}
	}

	/**
	 * Draw a text layer
	 * Delegates to TextRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with text properties
	 * @param {Object} [options] - Rendering options
	 */
	drawText ( layer, options ) {
		if ( this.textRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.textRenderer.setContext( this.ctx );
			this.textRenderer.draw( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
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
			case 'highlight':
				this.drawHighlight( layer, options );
				break;
			case 'path':
				this.drawPath( layer, options );
				break;
			case 'blur':
				this.drawBlur( layer, options );
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
