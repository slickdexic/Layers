/**
 * TextBoxRenderer - Specialized text box rendering
 *
 * Extracted from ShapeRenderer.js to reduce file size and improve maintainability.
 * This module handles rendering of text box shapes:
 * - Rectangle container with rounded corners
 * - Multi-line text with word wrapping
 * - Text alignment (horizontal and vertical)
 * - Text stroke and shadow effects
 *
 * @module TextBoxRenderer
 * @since 1.1.1
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
	 * TextBoxRenderer class - Renders text box shapes on canvas
	 */
	class TextBoxRenderer {
		/**
		 * Creates a new TextBoxRenderer instance
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
		 * Check if shadow is enabled on a layer
		 *
		 * @param {Object} layer - Layer to check
		 * @return {boolean} True if shadow is enabled
		 */
		hasShadowEnabled( layer ) {
			if ( this.shadowRenderer ) {
				return !!this.shadowRenderer.hasShadowEnabled( layer );
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
			const scaleAvg = ( scale && scale.avg ) || 1;
			if ( !this.hasShadowEnabled( layer ) ) {
				return 0;
			}
			if ( typeof layer.shadowSpread === 'number' && layer.shadowSpread > 0 ) {
				return layer.shadowSpread * scaleAvg;
			}
			return 0;
		}

		/**
		 * Draw spread shadow for a filled shape
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @param {number} spread - Spread amount
		 * @param {Function} drawPathFn - Function to draw the path
		 * @param {number} opacity - Opacity for the shadow
		 */
		drawSpreadShadow( layer, scale, spread, drawPathFn, opacity ) {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.drawSpreadShadow( layer, scale, spread, drawPathFn, opacity );
			}
		}

		/**
		 * Draw spread shadow for a stroked shape
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @param {number} strokeWidth - Stroke width
		 * @param {Function} drawPathFn - Function to draw the path
		 * @param {number} opacity - Opacity for the shadow
		 */
		drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity ) {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity );
			}
		}

		// ========================================================================
		// Rectangle Path Helpers
		// ========================================================================

		/**
		 * Draw a rounded rectangle path (fallback for browsers without roundRect)
		 *
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {number} width - Width
		 * @param {number} height - Height
		 * @param {number} radius - Corner radius
		 * @param {CanvasRenderingContext2D} [context] - Optional context (defaults to this.ctx)
		 */
		drawRoundedRectPath( x, y, width, height, radius, context ) {
			const ctx = context || this.ctx;
			ctx.beginPath();
			ctx.moveTo( x + radius, y );
			ctx.lineTo( x + width - radius, y );
			ctx.arcTo( x + width, y, x + width, y + radius, radius );
			ctx.lineTo( x + width, y + height - radius );
			ctx.arcTo( x + width, y + height, x + width - radius, y + height, radius );
			ctx.lineTo( x + radius, y + height );
			ctx.arcTo( x, y + height, x, y + height - radius, radius );
			ctx.lineTo( x, y + radius );
			ctx.arcTo( x, y, x + radius, y, radius );
			ctx.closePath();
		}

		// ========================================================================
		// Text Box Rendering
		// ========================================================================

		/**
		 * Draw a text box shape (rectangle with multi-line text)
		 * Text is clipped to the box boundaries
		 *
		 * @param {Object} layer - Layer with textbox properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
		 */
		draw( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			let x = layer.x || 0;
			let y = layer.y || 0;
			const width = layer.width || 0;
			const height = layer.height || 0;
			let strokeW = layer.strokeWidth || 1;
			let cornerRadius = layer.cornerRadius || 0;
			const padding = ( layer.padding || 8 ) * scale.avg;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
				cornerRadius = cornerRadius * scale.avg;
			}

			// Clamp corner radius to half of the smaller dimension
			const maxRadius = Math.min( Math.abs( width ), Math.abs( height ) ) / 2;
			cornerRadius = Math.min( cornerRadius, maxRadius );

			this.ctx.save();

			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			if ( hasRotation ) {
				this.ctx.translate( x + width / 2, y + height / 2 );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				x = -width / 2;
				y = -height / 2;
			}

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Use rounded rect if cornerRadius > 0
			const useRoundedRect = cornerRadius > 0 && this.ctx.roundRect;

			// Helper to draw the rectangle path (needed for shadow)
			const drawRectPathFor = ( ctx ) => {
				if ( useRoundedRect || cornerRadius > 0 ) {
					if ( ctx.roundRect ) {
						ctx.beginPath();
						ctx.roundRect( x, y, width, height, cornerRadius );
					} else {
						this.drawRoundedRectPath( x, y, width, height, cornerRadius, ctx );
					}
				} else {
					ctx.beginPath();
					ctx.rect( x, y, width, height );
				}
			};

			// Shadow handling (same as rectangle - includes stroke shadow)
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
				const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

				// Draw fill shadow
				if ( hasFillForShadow ) {
					const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
					if ( spread > 0 ) {
						this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
							const expandedX = x - spread;
							const expandedY = y - spread;
							const expandedW = width + spread * 2;
							const expandedH = height + spread * 2;
							const expandedRadius = Math.min( cornerRadius + spread, Math.min( Math.abs( expandedW ), Math.abs( expandedH ) ) / 2 );
							if ( useRoundedRect || cornerRadius > 0 ) {
								if ( ctx.roundRect ) {
									ctx.beginPath();
									ctx.roundRect( expandedX, expandedY, expandedW, expandedH, expandedRadius );
								} else {
									this.drawRoundedRectPath( expandedX, expandedY, expandedW, expandedH, expandedRadius, ctx );
								}
							} else {
								ctx.beginPath();
								ctx.rect( expandedX, expandedY, expandedW, expandedH );
							}
						}, fillShadowOpacity );
					} else {
						this.drawSpreadShadow( layer, shadowScale, 0, ( ctx ) => {
							drawRectPathFor( ctx );
						}, fillShadowOpacity );
					}
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						drawRectPathFor( ctx );
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			// Helper to draw the rectangle path
			const drawRectPath = () => {
				if ( useRoundedRect ) {
					this.ctx.beginPath();
					this.ctx.roundRect( x, y, width, height, cornerRadius );
				} else if ( cornerRadius > 0 ) {
					this.drawRoundedRectPath( x, y, width, height, cornerRadius );
				} else {
					this.ctx.beginPath();
					this.ctx.rect( x, y, width, height );
				}
			};

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Draw fill
			if ( hasFill ) {
				this.ctx.fillStyle = layer.fill;
				this.ctx.globalAlpha = baseOpacity * fillOpacity;
				drawRectPath();
				this.ctx.fill();
			}

			// Draw stroke
			if ( hasStroke ) {
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				drawRectPath();
				this.ctx.stroke();
			}

			// Draw text (clipped to the box)
			if ( layer.text && layer.text.length > 0 ) {
				this.drawTextContent( layer, x, y, width, height, padding, scale, shadowScale, baseOpacity );
			}

			this.ctx.restore();
		}

		/**
		 * Draw text content inside the text box
		 *
		 * @private
		 * @param {Object} layer - Layer with text properties
		 * @param {number} x - Box X position (possibly rotated)
		 * @param {number} y - Box Y position (possibly rotated)
		 * @param {number} width - Box width
		 * @param {number} height - Box height
		 * @param {number} padding - Padding in scaled pixels
		 * @param {Object} scale - Scale factors
		 * @param {Object} shadowScale - Shadow scale factors for text shadow
		 * @param {number} baseOpacity - Base opacity
		 */
		drawTextContent( layer, x, y, width, height, padding, scale, shadowScale, baseOpacity ) {
			this.ctx.save();

			// Create clipping region (simplified path)
			this.ctx.beginPath();
			this.ctx.rect( x, y, width, height );
			this.ctx.clip();

			// Text rendering
			const fontSize = ( layer.fontSize || 16 ) * scale.avg;
			const fontFamily = layer.fontFamily || 'Arial, sans-serif';
			const fontWeight = layer.fontWeight || 'normal';
			const fontStyle = layer.fontStyle || 'normal';
			const textColor = layer.color || '#000000';
			const textAlign = layer.textAlign || 'left';
			const verticalAlign = layer.verticalAlign || 'top';
			const lineHeight = ( layer.lineHeight || 1.2 ) * fontSize;

			// Build font string with weight and style
			const fontString = `${ fontStyle } ${ fontWeight } ${ fontSize }px ${ fontFamily }`;
			this.ctx.font = fontString;
			this.ctx.fillStyle = textColor;
			this.ctx.globalAlpha = baseOpacity;
			this.ctx.textBaseline = 'top';

			// Split text into lines and wrap
			const lines = this.wrapText( layer.text, width - padding * 2, fontSize, fontFamily, fontWeight, fontStyle );
			const totalTextHeight = lines.length * lineHeight;
			const availableHeight = height - padding * 2;

			// Calculate starting Y position based on vertical alignment
			let textY;
			switch ( verticalAlign ) {
				case 'middle':
					textY = y + padding + ( availableHeight - totalTextHeight ) / 2;
					break;
				case 'bottom':
					textY = y + padding + availableHeight - totalTextHeight;
					break;
				case 'top':
				default:
					textY = y + padding;
					break;
			}

			// Calculate text X position based on alignment
			let textX;
			switch ( textAlign ) {
				case 'center':
					this.ctx.textAlign = 'center';
					textX = x + width / 2;
					break;
				case 'right':
					this.ctx.textAlign = 'right';
					textX = x + width - padding;
					break;
				case 'left':
				default:
					this.ctx.textAlign = 'left';
					textX = x + padding;
					break;
			}

			// Text stroke properties
			const textStrokeWidth = ( layer.textStrokeWidth || 0 ) * scale.avg;
			const textStrokeColor = layer.textStrokeColor || '#000000';
			const hasTextStroke = textStrokeWidth > 0;

			// Text shadow properties - use shadowScale for proper scaling in viewer
			// Handle multiple possible types from JSON (boolean, string, number, empty string)
			const hasTextShadow = layer.textShadow === true || layer.textShadow === 'true' || layer.textShadow === 1 || layer.textShadow === '1';
			const textShadowColor = layer.textShadowColor || 'rgba(0,0,0,0.5)';
			const textShadowBlur = ( layer.textShadowBlur || 4 ) * shadowScale.avg;
			const textShadowOffsetX = ( layer.textShadowOffsetX || 2 ) * shadowScale.avg;
			const textShadowOffsetY = ( layer.textShadowOffsetY || 2 ) * shadowScale.avg;

			// Draw each line (clipped to box)
			for ( let i = 0; i < lines.length; i++ ) {
				const currentY = textY + i * lineHeight;
				// Only draw if within the box
				if ( currentY + fontSize <= y + height ) {
					this.drawTextLine( lines[ i ], textX, currentY, {
						hasTextShadow,
						textShadowColor,
						textShadowBlur,
						textShadowOffsetX,
						textShadowOffsetY,
						hasTextStroke,
						textStrokeColor,
						textStrokeWidth
					} );
				}
			}

			this.ctx.restore();
		}

		/**
		 * Draw a single line of text with optional stroke and shadow
		 *
		 * @private
		 * @param {string} text - Text to draw
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {Object} style - Style options
		 */
		drawTextLine( text, x, y, style ) {
			// Apply text shadow if enabled
			if ( style.hasTextShadow ) {
				this.ctx.shadowColor = style.textShadowColor;
				this.ctx.shadowBlur = style.textShadowBlur;
				this.ctx.shadowOffsetX = style.textShadowOffsetX;
				this.ctx.shadowOffsetY = style.textShadowOffsetY;
			}

			// Draw text stroke first (behind fill)
			if ( style.hasTextStroke ) {
				// Temporarily disable shadow for stroke
				if ( style.hasTextShadow ) {
					this.ctx.shadowColor = 'transparent';
				}
				this.ctx.strokeStyle = style.textStrokeColor;
				this.ctx.lineWidth = style.textStrokeWidth;
				this.ctx.lineJoin = 'round';
				this.ctx.miterLimit = 2;
				this.ctx.strokeText( text, x, y );
				// Re-enable shadow for fill
				if ( style.hasTextShadow ) {
					this.ctx.shadowColor = style.textShadowColor;
				}
			}

			// Draw text fill
			this.ctx.fillText( text, x, y );

			// Clear shadow after each line to prevent accumulation
			if ( style.hasTextShadow ) {
				this.ctx.shadowColor = 'transparent';
				this.ctx.shadowBlur = 0;
				this.ctx.shadowOffsetX = 0;
				this.ctx.shadowOffsetY = 0;
			}
		}

		/**
		 * Wrap text to fit within a given width
		 *
		 * @param {string} text - Text to wrap
		 * @param {number} maxWidth - Maximum width for each line
		 * @param {number} fontSize - Font size in pixels
		 * @param {string} fontFamily - Font family
		 * @param {string} [fontWeight='normal'] - Font weight (normal or bold)
		 * @param {string} [fontStyle='normal'] - Font style (normal or italic)
		 * @return {Array<string>} Array of wrapped lines
		 */
		wrapText( text, maxWidth, fontSize, fontFamily, fontWeight, fontStyle ) {
			const weight = fontWeight || 'normal';
			const style = fontStyle || 'normal';
			this.ctx.save();
			this.ctx.font = `${ style } ${ weight } ${ fontSize }px ${ fontFamily }`;

			const lines = [];
			const paragraphs = text.split( '\n' );

			for ( const paragraph of paragraphs ) {
				if ( paragraph === '' ) {
					lines.push( '' );
					continue;
				}

				const words = paragraph.split( ' ' );
				let currentLine = '';

				for ( const word of words ) {
					const testLine = currentLine ? currentLine + ' ' + word : word;
					const metrics = this.ctx.measureText( testLine );

					if ( metrics.width > maxWidth && currentLine ) {
						lines.push( currentLine );
						currentLine = word;
					} else {
						currentLine = testLine;
					}
				}

				if ( currentLine ) {
					lines.push( currentLine );
				}
			}

			this.ctx.restore();
			return lines.length > 0 ? lines : [ '' ];
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.ctx = null;
			this.config = null;
			this.shadowRenderer = null;
		}

		/**
		 * Draw only the text content of a textbox (no background fill/stroke)
		 * Used by blur blend mode to render text on top of blur effect
		 *
		 * @param {Object} layer - Layer with text properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.offset] - Offset {x, y} for position adjustment
		 */
		drawTextOnly( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const offset = opts.offset || { x: 0, y: 0 };

			// Calculate scaled dimensions
			const x = ( layer.x || 0 ) * scale.sx + offset.x;
			const y = ( layer.y || 0 ) * scale.sy + offset.y;
			const width = ( layer.width || 100 ) * scale.sx;
			const height = ( layer.height || 50 ) * scale.sy;
			const padding = ( layer.padding || 8 ) * scale.avg;

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;

			// Draw only the text content
			if ( layer.text && layer.text.length > 0 ) {
				this.ctx.save();

				// Apply layer opacity
				this.ctx.globalAlpha = baseOpacity;

				this.drawTextContent( layer, x, y, width, height, padding, scale, scale, baseOpacity );

				this.ctx.restore();
			}
		}
	}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.TextBoxRenderer = TextBoxRenderer;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = TextBoxRenderer;
	}

}() );
