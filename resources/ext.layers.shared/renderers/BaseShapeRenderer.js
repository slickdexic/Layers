/**
 * BaseShapeRenderer - Base class for shape rendering
 *
 * Provides common utilities for shadow handling, opacity management,
 * scaling, and rotation that all shape renderers share.
 *
 * @module BaseShapeRenderer
 * @since 0.9.0
 */
( function () {
	'use strict';

	/**
	 * Clamp a value to a valid opacity range [0, 1]
	 *
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity value (defaults to 1 if invalid)
	 */
	function clampOpacity( value ) {
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	}

	/**
	 * BaseShapeRenderer - Base class for shape rendering
	 *
	 * @class
	 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
	 * @param {Object} parent - Parent LayerRenderer instance (for shared state)
	 */
	function BaseShapeRenderer( ctx, parent ) {
		this.ctx = ctx;
		this.parent = parent;
	}

	// ========================================================================
	// Scale and Transform Utilities
	// ========================================================================

	/**
	 * Get current scale factors (delegates to parent)
	 *
	 * @return {Object} Scale factors {sx, sy, avg}
	 */
	BaseShapeRenderer.prototype.getScaleFactors = function () {
		if ( this.parent && typeof this.parent.getScaleFactors === 'function' ) {
			return this.parent.getScaleFactors();
		}
		return { sx: 1, sy: 1, avg: 1 };
	};

	/**
	 * Apply rotation transform around center point
	 *
	 * @param {Object} layer - Layer with rotation property
	 * @param {number} centerX - Center X coordinate
	 * @param {number} centerY - Center Y coordinate
	 * @return {boolean} True if rotation was applied
	 */
	BaseShapeRenderer.prototype.applyRotation = function ( layer, centerX, centerY ) {
		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			return true;
		}
		return false;
	};

	// ========================================================================
	// Shadow Utilities
	// ========================================================================

	/**
	 * Clear shadow settings from context
	 */
	BaseShapeRenderer.prototype.clearShadow = function () {
		this.ctx.shadowColor = 'transparent';
		this.ctx.shadowBlur = 0;
		this.ctx.shadowOffsetX = 0;
		this.ctx.shadowOffsetY = 0;
	};

	/**
	 * Check if shadow is enabled on layer
	 *
	 * @param {Object} layer - Layer to check
	 * @return {boolean} True if shadow is enabled
	 */
	BaseShapeRenderer.prototype.hasShadowEnabled = function ( layer ) {
		if ( this.parent && typeof this.parent.hasShadowEnabled === 'function' ) {
			return this.parent.hasShadowEnabled( layer );
		}
		return layer.shadow === true || layer.shadow === 'true' || layer.shadow === 1;
	};

	/**
	 * Apply shadow settings (delegates to parent)
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 */
	BaseShapeRenderer.prototype.applyShadow = function ( layer, scale ) {
		if ( this.parent && typeof this.parent.applyShadow === 'function' ) {
			this.parent.applyShadow( layer, scale );
		}
	};

	/**
	 * Get shadow spread value (delegates to parent)
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @return {number} Shadow spread value
	 */
	BaseShapeRenderer.prototype.getShadowSpread = function ( layer, scale ) {
		if ( this.parent && typeof this.parent.getShadowSpread === 'function' ) {
			return this.parent.getShadowSpread( layer, scale );
		}
		return 0;
	};

	/**
	 * Draw spread shadow for fill (delegates to parent)
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} spread - Shadow spread value
	 * @param {Function} drawPathFn - Function to draw the path
	 * @param {number} opacity - Opacity to apply
	 */
	BaseShapeRenderer.prototype.drawSpreadShadow = function ( layer, scale, spread, drawPathFn, opacity ) {
		if ( this.parent && typeof this.parent.drawSpreadShadow === 'function' ) {
			this.parent.drawSpreadShadow( layer, scale, spread, drawPathFn, opacity );
		}
	};

	/**
	 * Draw spread shadow for stroke (delegates to parent)
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} strokeWidth - Stroke width
	 * @param {Function} drawPathFn - Function to draw the path
	 * @param {number} opacity - Opacity to apply
	 */
	BaseShapeRenderer.prototype.drawSpreadShadowStroke = function ( layer, scale, strokeWidth, drawPathFn, opacity ) {
		if ( this.parent && typeof this.parent.drawSpreadShadowStroke === 'function' ) {
			this.parent.drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity );
		}
	};

	// ========================================================================
	// Opacity Utilities
	// ========================================================================

	/**
	 * Clamp opacity value
	 *
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity (0-1)
	 */
	BaseShapeRenderer.prototype.clampOpacity = function ( value ) {
		return clampOpacity( value );
	};

	/**
	 * Get effective fill opacity
	 *
	 * @param {Object} layer - Layer object
	 * @return {number} Fill opacity (0-1)
	 */
	BaseShapeRenderer.prototype.getFillOpacity = function ( layer ) {
		return clampOpacity( layer.fillOpacity );
	};

	/**
	 * Get effective stroke opacity
	 *
	 * @param {Object} layer - Layer object
	 * @return {number} Stroke opacity (0-1)
	 */
	BaseShapeRenderer.prototype.getStrokeOpacity = function ( layer ) {
		return clampOpacity( layer.strokeOpacity );
	};

	/**
	 * Get base opacity for layer
	 *
	 * @param {Object} layer - Layer object
	 * @return {number} Base opacity (0-1)
	 */
	BaseShapeRenderer.prototype.getBaseOpacity = function ( layer ) {
		return typeof layer.opacity === 'number' ? layer.opacity : 1;
	};

	// ========================================================================
	// Fill/Stroke Helpers
	// ========================================================================

	/**
	 * Check if layer has visible fill
	 *
	 * @param {Object} layer - Layer object
	 * @return {boolean} True if fill should be rendered
	 */
	BaseShapeRenderer.prototype.hasVisibleFill = function ( layer ) {
		const fillOpacity = this.getFillOpacity( layer );
		return layer.fill &&
			layer.fill !== 'transparent' &&
			layer.fill !== 'none' &&
			fillOpacity > 0;
	};

	/**
	 * Check if layer has visible stroke
	 *
	 * @param {Object} layer - Layer object
	 * @return {boolean} True if stroke should be rendered
	 */
	BaseShapeRenderer.prototype.hasVisibleStroke = function ( layer ) {
		const strokeOpacity = this.getStrokeOpacity( layer );
		return layer.stroke &&
			layer.stroke !== 'transparent' &&
			layer.stroke !== 'none' &&
			strokeOpacity > 0;
	};

	/**
	 * Apply fill style and draw
	 *
	 * @param {Object} layer - Layer object
	 * @param {Function} drawPathFn - Function to draw the path
	 * @param {Object} [options] - Options
	 * @param {boolean} [options.shadowEnabled] - Whether shadow is enabled
	 * @param {Object} [options.shadowScale] - Scale for shadow
	 */
	BaseShapeRenderer.prototype.applyFill = function ( layer, drawPathFn, options ) {
		const opts = options || {};
		const baseOpacity = this.getBaseOpacity( layer );
		const fillOpacity = this.getFillOpacity( layer );

		if ( opts.shadowEnabled ) {
			this.applyShadow( layer, opts.shadowScale );
		}

		this.ctx.fillStyle = layer.fill;
		this.ctx.globalAlpha = baseOpacity * fillOpacity;
		drawPathFn();
		this.ctx.fill();
	};

	/**
	 * Apply stroke style and draw
	 *
	 * @param {Object} layer - Layer object
	 * @param {number} strokeWidth - Stroke width
	 * @param {Function} drawPathFn - Function to draw the path
	 * @param {Object} [options] - Options
	 * @param {boolean} [options.shadowEnabled] - Whether shadow is enabled
	 * @param {Object} [options.shadowScale] - Scale for shadow
	 * @param {boolean} [options.hasFill] - Whether shape has visible fill
	 */
	BaseShapeRenderer.prototype.applyStroke = function ( layer, strokeWidth, drawPathFn, options ) {
		const opts = options || {};
		const baseOpacity = this.getBaseOpacity( layer );
		const strokeOpacity = this.getStrokeOpacity( layer );

		if ( !opts.hasFill && opts.shadowEnabled ) {
			// No fill to go behind, draw stroke with shadow directly
			this.applyShadow( layer, opts.shadowScale );
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = strokeWidth;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			drawPathFn();
			this.ctx.stroke();
		} else {
			// Draw stroke without shadow first
			this.ctx.strokeStyle = layer.stroke;
			this.ctx.lineWidth = strokeWidth;
			this.ctx.globalAlpha = baseOpacity * strokeOpacity;
			drawPathFn();
			this.ctx.stroke();

			// Then draw stroke shadow BEHIND using destination-over
			if ( opts.shadowEnabled ) {
				this.ctx.save();
				this.ctx.globalCompositeOperation = 'destination-over';
				this.applyShadow( layer, opts.shadowScale );
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeWidth;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				drawPathFn();
				this.ctx.stroke();
				this.ctx.restore();
			}
		}
	};

	// ========================================================================
	// Abstract Method
	// ========================================================================

	/**
	 * Draw the shape - must be implemented by subclasses
	 *
	 * @abstract
	 * @param {Object} layer - Layer to draw
	 * @param {Object} [options] - Rendering options
	 */
	BaseShapeRenderer.prototype.draw = function ( /* layer, options */ ) {
		throw new Error( 'BaseShapeRenderer.draw() must be implemented by subclass' );
	};

	// ========================================================================
	// Exports
	// ========================================================================

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Renderers = window.Layers.Renderers || {};
		window.Layers.Renderers.BaseShapeRenderer = BaseShapeRenderer;

		// Direct export for backward compatibility
		window.BaseShapeRenderer = BaseShapeRenderer;
	}

	// CommonJS export for testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = BaseShapeRenderer;
	}
}() );
