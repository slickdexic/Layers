/**
 * HighlightRenderer - Renders highlight marker shapes
 *
 * Highlights are simple semi-transparent rectangles used for
 * marking important areas of an image.
 *
 * @module HighlightRenderer
 * @since 0.9.0
 */
( function () {
	'use strict';

	// Get BaseShapeRenderer (loaded before this module)
	const BaseShapeRenderer = window.BaseShapeRenderer ||
		( window.Layers && window.Layers.Renderers && window.Layers.Renderers.BaseShapeRenderer );

	/**
	 * HighlightRenderer - Renders highlight shapes
	 *
	 * @class
	 * @extends BaseShapeRenderer
	 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
	 * @param {Object} parent - Parent LayerRenderer instance
	 */
	function HighlightRenderer( ctx, parent ) {
		// Call parent constructor
		if ( BaseShapeRenderer ) {
			BaseShapeRenderer.call( this, ctx, parent );
		} else {
			this.ctx = ctx;
			this.parent = parent;
		}
	}

	// Inherit from BaseShapeRenderer if available
	if ( BaseShapeRenderer ) {
		HighlightRenderer.prototype = Object.create( BaseShapeRenderer.prototype );
		HighlightRenderer.prototype.constructor = HighlightRenderer;
	}

	/**
	 * Draw a highlight shape
	 *
	 * Highlights are semi-transparent rectangles used for marking areas.
	 * They default to yellow (#ffff00) at 30% opacity.
	 *
	 * @param {Object} layer - Layer with highlight properties
	 * @param {number} [layer.x=0] - X position
	 * @param {number} [layer.y=0] - Y position
	 * @param {number} [layer.width=100] - Width
	 * @param {number} [layer.height=20] - Height
	 * @param {number} [layer.rotation=0] - Rotation in degrees
	 * @param {number} [layer.opacity=0.3] - Opacity (0-1)
	 * @param {string} [layer.color='#ffff00'] - Fill color
	 * @param {Object} [options] - Rendering options (unused for highlights)
	 */
	HighlightRenderer.prototype.draw = function ( layer ) {
		let x = layer.x || 0;
		let y = layer.y || 0;
		const width = layer.width || 100;
		const height = layer.height || 20;

		this.ctx.save();

		// Handle rotation
		const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
		if ( hasRotation ) {
			this.ctx.translate( x + width / 2, y + height / 2 );
			this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			x = -width / 2;
			y = -height / 2;
		}

		// Highlights default to 0.3 opacity
		let opacity = 0.3;
		if ( typeof layer.opacity === 'number' && !Number.isNaN( layer.opacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.opacity ) );
		} else if ( typeof layer.fillOpacity === 'number' && !Number.isNaN( layer.fillOpacity ) ) {
			opacity = Math.max( 0, Math.min( 1, layer.fillOpacity ) );
		}

		this.ctx.globalAlpha = opacity;
		this.ctx.fillStyle = layer.color || layer.fill || '#ffff00';
		this.ctx.fillRect( x, y, width, height );

		this.ctx.restore();
	};

	// ========================================================================
	// Exports
	// ========================================================================

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Renderers = window.Layers.Renderers || {};
		window.Layers.Renderers.HighlightRenderer = HighlightRenderer;

		// Direct export for backward compatibility
		window.HighlightRenderer = HighlightRenderer;
	}

	// CommonJS export for testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = HighlightRenderer;
	}
}() );
