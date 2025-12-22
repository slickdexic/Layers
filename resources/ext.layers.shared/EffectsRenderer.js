/**
 * EffectsRenderer - Handles special effect layers (blur)
 *
 * This module provides rendering for effect-type layers that apply
 * visual modifications to image regions rather than drawing shapes.
 *
 * Extracted from LayerRenderer to separate concerns and reduce god class size.
 *
 * @module EffectsRenderer
 * @since 0.9.0
 */
( function () {
	'use strict';

	/**
	 * EffectsRenderer class - Renders blur effect layers
	 */
	class EffectsRenderer {
		/**
		 * Creates a new EffectsRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {HTMLCanvasElement} [config.canvas] - Canvas element reference
		 * @param {HTMLImageElement} [config.backgroundImage] - Background image for blur effects
		 * @param {number} [config.baseWidth] - Original image width for scaling
		 * @param {number} [config.baseHeight] - Original image height for scaling
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.canvas = this.config.canvas || null;
			this.backgroundImage = this.config.backgroundImage || null;
			this.baseWidth = this.config.baseWidth || null;
			this.baseHeight = this.config.baseHeight || null;
		}

		/**
		 * Set the canvas context
		 *
		 * @param {CanvasRenderingContext2D} ctx - New context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
		}

		/**
		 * Update the background image reference
		 *
		 * @param {HTMLImageElement} image - Background image
		 */
		setBackgroundImage( image ) {
			this.backgroundImage = image;
		}

		/**
		 * Update base dimensions for scaling calculations
		 *
		 * @param {number} width - Base width
		 * @param {number} height - Base height
		 */
		setBaseDimensions( width, height ) {
			this.baseWidth = width;
			this.baseHeight = height;
		}

		/**
		 * Get scale factors for coordinate transformation
		 *
		 * @return {Object} Scale factors { sx, sy, avg }
		 */
		getScaleFactors() {
			if ( !this.canvas || !this.baseWidth || !this.baseHeight ) {
				return { sx: 1, sy: 1, avg: 1 };
			}
			const sx = this.canvas.width / this.baseWidth;
			const sy = this.canvas.height / this.baseHeight;
			return { sx: sx, sy: sy, avg: ( sx + sy ) / 2 };
		}

		/**
		 * Draw a blur effect region
		 *
		 * Blur effects obscure portions of an image, useful for
		 * redacting sensitive information or focusing attention elsewhere.
		 *
		 * @param {Object} layer - Layer with blur properties
		 * @param {number} [layer.x=0] - X position
		 * @param {number} [layer.y=0] - Y position
		 * @param {number} [layer.width=0] - Width
		 * @param {number} [layer.height=0] - Height
		 * @param {number} [layer.blurRadius=12] - Blur radius (1-64)
		 * @param {Object} [options] - Rendering options
		 * @param {boolean} [options.scaled] - Whether coordinates are pre-scaled
		 * @param {HTMLImageElement} [options.imageElement] - Image for blur source (viewer mode)
		 */
		drawBlur( layer, options ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();

			let x = layer.x || 0;
			let y = layer.y || 0;
			let w = layer.width || 0;
			let h = layer.height || 0;

			if ( w <= 0 || h <= 0 ) {
				return;
			}

			// For viewer mode, coordinates need scaling
			if ( !opts.scaled && this.baseWidth && this.baseHeight ) {
				x = x * scale.sx;
				y = y * scale.sy;
				w = w * scale.sx;
				h = h * scale.sy;
			}

			const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );
			const imgSource = opts.imageElement || this.backgroundImage;

			this.ctx.save();

			// If we have an image source, do proper blur
			if ( imgSource && imgSource.complete ) {
				// Create temp canvas for blur effect
				const tempCanvas = document.createElement( 'canvas' );
				tempCanvas.width = Math.max( 1, Math.ceil( w ) );
				tempCanvas.height = Math.max( 1, Math.ceil( h ) );
				const tempCtx = tempCanvas.getContext( '2d' );

				if ( tempCtx ) {
					// Calculate source coordinates
					const imgW = imgSource.naturalWidth || imgSource.width;
					const imgH = imgSource.naturalHeight || imgSource.height;
					const canvasW = this.canvas ? this.canvas.width : w;
					const canvasH = this.canvas ? this.canvas.height : h;
					const imgScaleX = imgW / canvasW;
					const imgScaleY = imgH / canvasH;

					const srcX = x * imgScaleX;
					const srcY = y * imgScaleY;
					const srcW = w * imgScaleX;
					const srcH = h * imgScaleY;

					try {
						tempCtx.drawImage(
							imgSource,
							srcX, srcY, srcW, srcH,
							0, 0, tempCanvas.width, tempCanvas.height
						);

						this.ctx.filter = 'blur(' + radius + 'px)';
						this.ctx.drawImage( tempCanvas, x, y, w, h );
						this.ctx.filter = 'none';
					} catch ( e ) {
						// CORS or other error - fall back to gray overlay
						this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
						this.ctx.fillRect( x, y, w, h );
					}
				}
			} else if ( this.backgroundImage && this.backgroundImage.complete ) {
				// Editor mode - blur the background directly
				this.ctx.beginPath();
				this.ctx.rect( x, y, w, h );
				this.ctx.clip();

				const prevFilter = this.ctx.filter || 'none';
				this.ctx.filter = 'blur(' + radius + 'px)';
				this.ctx.drawImage( this.backgroundImage, 0, 0 );
				this.ctx.filter = prevFilter;
			} else {
				// Fallback: gray overlay
				this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
				this.ctx.fillRect( x, y, w, h );
			}

			this.ctx.restore();
		}
	}

	// ========================================================================
	// Module Export
	// ========================================================================

	// Export for both browser and CommonJS (Jest) environments
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.EffectsRenderer = EffectsRenderer;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = EffectsRenderer;
	}
}() );
