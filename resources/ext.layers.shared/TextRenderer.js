/**
 * TextRenderer - Specialized text shape rendering
 *
 * Extracted from LayerRenderer.js to reduce file size and improve maintainability.
 * This module handles all text-related rendering including:
 * - Font sizing and family
 * - Text alignment
 * - Text stroke (outline)
 * - Shadow rendering with spread support
 * - Rotation around text center
 *
 * @module TextRenderer
 * @since 0.9.1
 */
( function () {
	'use strict';

	/**
	 * Get clampOpacity from MathUtils namespace
	 *
	 * @private
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity value
	 */
	function clampOpacity( value ) {
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.MathUtils ) {
			return window.Layers.MathUtils.clampOpacity( value );
		}
		// Fallback if MathUtils not loaded
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	}

	/**
	 * TextRenderer class - Renders text shapes on canvas
	 */
	class TextRenderer {
		/**
		 * Creates a new TextRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shadowRenderer] - ShadowRenderer instance for shadow operations
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
		}

		/**
		 * Set the shadow renderer instance
		 *
		 * @param {Object} shadowRenderer - ShadowRenderer instance
		 */
		setShadowRenderer( shadowRenderer ) {
			this.shadowRenderer = shadowRenderer;
		}

		/**
		 * Set the context
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
		}

		// ========================================================================
		// Shadow Helper Methods (delegate to shadowRenderer or provide fallbacks)
		// ========================================================================

		/**
		 * Clear shadow settings from context
		 */
		clearShadow() {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.clearShadow();
			} else {
				this.ctx.shadowColor = 'transparent';
				this.ctx.shadowBlur = 0;
				this.ctx.shadowOffsetX = 0;
				this.ctx.shadowOffsetY = 0;
			}
		}

		/**
		 * Apply shadow settings to context
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 */
		applyShadow( layer, scale ) {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.applyShadow( layer, scale );
			} else {
				// Minimal fallback
				const scaleX = scale.sx || 1;
				const scaleY = scale.sy || 1;
				const scaleAvg = scale.avg || 1;

				if ( layer.shadow === true || layer.shadow === 'true' || layer.shadow === 1 ) {
					this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
					this.ctx.shadowBlur = ( typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 8 ) * scaleAvg;
					this.ctx.shadowOffsetX = ( typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 2 ) * scaleX;
					this.ctx.shadowOffsetY = ( typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 2 ) * scaleY;
				}
			}
		}

		/**
		 * Check if shadow is enabled on a layer
		 *
		 * @param {Object} layer - Layer to check
		 * @return {boolean} True if shadow is enabled
		 */
		hasShadowEnabled( layer ) {
			if ( this.shadowRenderer ) {
				return this.shadowRenderer.hasShadowEnabled( layer );
			}
			return layer.shadow === true ||
				layer.shadow === 'true' ||
				layer.shadow === 1 ||
				layer.shadow === '1' ||
				( typeof layer.shadow === 'object' && layer.shadow );
		}

		/**
		 * Get shadow spread value from layer
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @return {number} Spread value in pixels
		 */
		getShadowSpread( layer, scale ) {
			if ( this.shadowRenderer ) {
				return this.shadowRenderer.getShadowSpread( layer, scale );
			}
			const scaleAvg = scale.avg || 1;
			if ( !this.hasShadowEnabled( layer ) ) {
				return 0;
			}
			if ( typeof layer.shadowSpread === 'number' && layer.shadowSpread > 0 ) {
				return layer.shadowSpread * scaleAvg;
			}
			return 0;
		}

		/**
		 * Get shadow parameters for rendering
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @return {Object} Shadow parameters {color, blur, offsetX, offsetY}
		 */
		getShadowParams( layer, scale ) {
			if ( this.shadowRenderer && typeof this.shadowRenderer.getShadowParams === 'function' ) {
				return this.shadowRenderer.getShadowParams( layer, scale );
			}
			// Fallback implementation
			const scaleX = scale.sx || 1;
			const scaleY = scale.sy || 1;
			const scaleAvg = scale.avg || 1;
			return {
				color: layer.shadowColor || 'rgba(0,0,0,0.4)',
				blur: ( typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 8 ) * scaleAvg,
				offsetX: ( typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 2 ) * scaleX,
				offsetY: ( typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 2 ) * scaleY
			};
		}

		// ========================================================================
		// Text Drawing
		// ========================================================================

		/**
		 * Draw a text layer
		 *
		 * @param {Object} layer - Layer with text properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
		 */
		draw( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			this.ctx.save();

			let fontSize = layer.fontSize || 16;
			if ( !opts.scaled ) {
				fontSize = Math.max( 1, Math.round( fontSize * scale.avg ) );
			}

			const fontFamily = layer.fontFamily || 'Arial';
			const text = layer.text || '';
			let x = layer.x || 0;
			let y = layer.y || 0;

			this.ctx.font = fontSize + 'px ' + fontFamily;
			this.ctx.textAlign = layer.textAlign || 'left';
			this.ctx.fillStyle = layer.fill || layer.color || '#000000';

			// Calculate text metrics for rotation centering
			const textMetrics = this.ctx.measureText( text );
			const textWidth = textMetrics.width;
			const textHeight = fontSize;

			// Calculate text center for rotation based on textAlign
			const align = layer.textAlign || 'left';
			let centerX;
			if ( align === 'center' ) {
				centerX = x;
			} else if ( align === 'right' ) {
				centerX = x - ( textWidth / 2 );
			} else {
				// 'left' (default)
				centerX = x + ( textWidth / 2 );
			}
			const centerY = y - ( textHeight / 4 );

			// Apply rotation if present
			if ( layer.rotation && layer.rotation !== 0 ) {
				const rotationRadians = ( layer.rotation * Math.PI ) / 180;
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( rotationRadians );
				// After translate to center, offset back by half text dimensions
				if ( align === 'center' ) {
					x = 0;
				} else if ( align === 'right' ) {
					x = textWidth / 2;
				} else {
					x = -( textWidth / 2 );
				}
				y = textHeight / 4;
			}

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Shadow rendering with spread support
			if ( this.hasShadowEnabled( layer ) ) {
				const sp = this.getShadowParams( layer, shadowScale );

				if ( spread > 0 ) {
					// Draw spread shadow by rendering at multiple offset positions
					this.ctx.save();
					this.ctx.globalAlpha = baseOpacity;

					// For spread, draw multiple shadow layers in a circle pattern
					const steps = Math.max( 8, Math.ceil( spread * 2 ) );
					for ( let i = 0; i < steps; i++ ) {
						const angle = ( i / steps ) * Math.PI * 2;
						const offsetX = Math.cos( angle ) * spread;
						const offsetY = Math.sin( angle ) * spread;

						this.ctx.shadowColor = sp.color;
						this.ctx.shadowBlur = sp.blur;
						this.ctx.shadowOffsetX = sp.offsetX + offsetX;
						this.ctx.shadowOffsetY = sp.offsetY + offsetY;

						// Draw stroke shadow if text has stroke
						if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
							let strokeW = layer.textStrokeWidth;
							if ( !opts.scaled ) {
								strokeW = strokeW * scale.avg;
							}
							this.ctx.strokeStyle = sp.color;
							this.ctx.lineWidth = strokeW;
							this.ctx.globalAlpha = 0.1 * baseOpacity;
							this.ctx.strokeText( text, x, y );
						}

						// Draw fill shadow
						this.ctx.fillStyle = sp.color;
						this.ctx.globalAlpha = 0.1 * baseOpacity;
						this.ctx.fillText( text, x, y );
					}

					this.ctx.restore();
					this.clearShadow();
				} else {
					// No spread - use standard canvas shadow
					this.applyShadow( layer, shadowScale );
				}
			}

			// Draw text stroke if enabled
			if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
				let strokeW = layer.textStrokeWidth;
				if ( !opts.scaled ) {
					strokeW = strokeW * scale.avg;
				}
				this.ctx.strokeStyle = layer.textStrokeColor || '#000000';
				this.ctx.lineWidth = strokeW;
				this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );
				this.ctx.strokeText( text, x, y );
			}

			// Clear shadow before drawing actual text (shadow already rendered)
			if ( this.hasShadowEnabled( layer ) && spread > 0 ) {
				this.clearShadow();
			}

			// Draw fill
			this.ctx.fillStyle = layer.fill || layer.color || '#000000';
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.fillOpacity );
			this.ctx.fillText( text, x, y );

			this.ctx.restore();
		}

		/**
		 * Measure text dimensions
		 *
		 * @param {string} text - Text to measure
		 * @param {number} fontSize - Font size in pixels
		 * @param {string} fontFamily - Font family
		 * @return {Object} Dimensions {width, height}
		 */
		measureText( text, fontSize, fontFamily ) {
			this.ctx.save();
			this.ctx.font = fontSize + 'px ' + ( fontFamily || 'Arial' );
			const metrics = this.ctx.measureText( text );
			this.ctx.restore();
			return {
				width: metrics.width,
				height: fontSize
			};
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.ctx = null;
			this.config = null;
			this.shadowRenderer = null;
		}
	}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.TextRenderer = TextRenderer;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = TextRenderer;
	}

}() );
