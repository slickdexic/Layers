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
		 * @param {Object} [config.effectsRenderer] - EffectsRenderer instance for blur fill
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
			this.effectsRenderer = this.config.effectsRenderer || null;
			this.gradientRenderer = this.config.gradientRenderer || null;
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
		 * Set the effects renderer instance (for blur fill)
		 *
		 * @param {Object} effectsRenderer - EffectsRenderer instance
		 */
		setEffectsRenderer( effectsRenderer ) {
			this.effectsRenderer = effectsRenderer;
		}

		/**
		 * Set the gradient renderer instance
		 *
		 * @param {Object} gradientRenderer - GradientRenderer instance
		 */
		setGradientRenderer( gradientRenderer ) {
			this.gradientRenderer = gradientRenderer;
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

			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const isBlurFill = layer.fill === 'blur';
			const fillOpacity = clampOpacity( layer.fillOpacity );

			// Save original coordinates BEFORE rotation transform for blur capture
			// After rotation, x/y become local coords (-width/2, -height/2) but blur
			// capture needs world coords or axis-aligned bounding box of rotated shape
			const originalX = x;
			const originalY = y;

			this.ctx.save();

			// Apply rotation FIRST - this affects blur fill, shadow, stroke, and text
			if ( hasRotation ) {
				this.ctx.translate( x + width / 2, y + height / 2 );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				x = -width / 2;
				y = -height / 2;
			}

			const spread = this.getShadowSpread( layer, shadowScale );

			// Use rounded rect if cornerRadius > 0
			const useRoundedRect = cornerRadius > 0 && this.ctx.roundRect;

			// Helper to draw the rectangle path
			// Accepts ctx parameter for blur fill (where EffectsRenderer passes its own ctx)
			const drawRectPath = ( ctx ) => {
				const targetCtx = ctx || this.ctx;
				if ( useRoundedRect || cornerRadius > 0 ) {
					if ( targetCtx.roundRect ) {
						targetCtx.beginPath();
						targetCtx.roundRect( x, y, width, height, cornerRadius );
					} else {
						this.drawRoundedRectPath( x, y, width, height, cornerRadius, targetCtx );
					}
				} else {
					targetCtx.beginPath();
					targetCtx.rect( x, y, width, height );
				}
			};

			// Handle blur fill - delegate to EffectsRenderer
			// Must be done AFTER rotation is applied to the context
			if ( isBlurFill && this.effectsRenderer && fillOpacity > 0 ) {
				// Calculate blur capture bounds - for rotated shapes, need axis-aligned
				// bounding box in world coordinates, not the transformed local coords
				let blurBounds;
				if ( hasRotation ) {
					// Compute axis-aligned bounding box of the rotated rectangle
					const centerX = originalX + width / 2;
					const centerY = originalY + height / 2;
					const angleRad = ( layer.rotation * Math.PI ) / 180;
					const cos = Math.abs( Math.cos( angleRad ) );
					const sin = Math.abs( Math.sin( angleRad ) );
					// Width and height of axis-aligned bounding box
					const aabbWidth = width * cos + height * sin;
					const aabbHeight = width * sin + height * cos;
					blurBounds = {
						x: centerX - aabbWidth / 2,
						y: centerY - aabbHeight / 2,
						width: aabbWidth,
						height: aabbHeight
					};
				} else {
					blurBounds = { x: originalX, y: originalY, width: width, height: height };
				}

				this.ctx.globalAlpha = baseOpacity * fillOpacity;
				this.effectsRenderer.drawBlurFill(
					layer,
					drawRectPath,
					blurBounds,
					opts
				);
			}

			// Shadow handling (same as rectangle - includes stroke shadow)
			// Note: Blur fill (fill='blur') should NOT trigger fill shadow rendering
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && layer.fill !== 'blur';
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
							drawRectPath( ctx );
						}, fillShadowOpacity );
					}
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						drawRectPath( ctx );
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			// Note: fillOpacity was already calculated above for blur fill handling
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			// Note: isBlurFill was already calculated above
			// Check for gradient fill
			const GradientRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.Renderers && window.Layers.Renderers.GradientRenderer );
			const hasGradient = GradientRenderer && GradientRenderer.hasGradient( layer );
			const hasFill = ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0 ) || hasGradient;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Bounds for gradient calculation
			const fillBounds = { x: x, y: y, width: width, height: height };

			// Draw fill (blur fill is handled earlier, after rotation transform is applied)
			if ( hasFill && !isBlurFill ) {
				// Try gradient fill first
				let usedGradient = false;
				if ( hasGradient && this.gradientRenderer ) {
					usedGradient = this.gradientRenderer.applyFill( layer, fillBounds, { scale: scale.avg || 1 } );
				}
				// Fallback to solid color fill
				if ( !usedGradient && layer.fill ) {
					this.ctx.fillStyle = layer.fill;
				}
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

			// Draw text (clipped to the box) - supports both plain text and rich text
			const hasTextContent = ( layer.text && layer.text.length > 0 ) || this.hasRichText( layer );
			if ( hasTextContent ) {
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

			// Check for rich text content
			if ( this.hasRichText( layer ) ) {
				this.drawRichTextContent( layer, x, y, width, height, padding, scale, shadowScale, baseOpacity );
				this.ctx.restore();
				return;
			}

			// Text rendering (plain text path)
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
			const textShadowBlur = ( typeof layer.textShadowBlur === 'number' ? layer.textShadowBlur : 4 ) * shadowScale.avg;
			const textShadowOffsetX = ( typeof layer.textShadowOffsetX === 'number' ? layer.textShadowOffsetX : 2 ) * shadowScale.avg;
			const textShadowOffsetY = ( typeof layer.textShadowOffsetY === 'number' ? layer.textShadowOffsetY : 2 ) * shadowScale.avg;

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

		// ========================================================================
		// Rich Text Support
		// ========================================================================

		/**
		 * Check if layer has valid rich text content
		 *
		 * @param {Object} layer - Layer object
		 * @return {boolean} True if layer has rich text
		 */
		hasRichText( layer ) {
			return Array.isArray( layer.richText ) &&
				layer.richText.length > 0 &&
				layer.richText.some( ( run ) => run && typeof run.text === 'string' );
		}

		/**
		 * Get plain text from rich text array for wrapping calculations
		 *
		 * @param {Array} richText - Rich text runs array
		 * @return {string} Combined plain text
		 */
		getRichTextPlainText( richText ) {
			if ( !Array.isArray( richText ) ) {
				return '';
			}
			return richText
				.filter( ( run ) => run && typeof run.text === 'string' )
				.map( ( run ) => run.text )
				.join( '' );
		}

		/**
		 * Build a map of character positions to runs for efficient lookup
		 *
		 * @param {Array} richText - Rich text runs array
		 * @return {Array} Array where index is char position, value is {runIndex, localIndex}
		 */
		buildCharToRunMap( richText ) {
			const map = [];
			let charPos = 0;

			for ( let runIndex = 0; runIndex < richText.length; runIndex++ ) {
				const run = richText[ runIndex ];
				if ( !run || typeof run.text !== 'string' ) {
					continue;
				}

				for ( let localIndex = 0; localIndex < run.text.length; localIndex++ ) {
					map[ charPos ] = { runIndex, localIndex };
					charPos++;
				}
			}

			return map;
		}

		/**
		 * Draw a line of rich text with mixed formatting
		 *
		 * @param {Array} richText - Rich text runs array
		 * @param {number} lineStart - Starting character index for this line
		 * @param {number} lineEnd - Ending character index (exclusive)
		 * @param {number} lineX - X position to start drawing
		 * @param {number} lineY - Y position for the line
		 * @param {Object} baseStyle - Base style from layer (fontSize, fontFamily, color, etc.)
		 * @param {Object} textStyle - Text effects (shadow, stroke)
		 * @param {Object} scale - Scale factors
		 */
		drawRichTextLine( richText, lineStart, lineEnd, lineX, lineY, baseStyle, textStyle, scale ) {
			let currentX = lineX;
			let charPos = 0;

			for ( const run of richText ) {
				if ( !run || typeof run.text !== 'string' ) {
					continue;
				}

				const runStart = charPos;
				const runEnd = charPos + run.text.length;
				charPos = runEnd;

				// Check if this run overlaps with the current line
				if ( runEnd <= lineStart || runStart >= lineEnd ) {
					continue; // Run is completely outside this line
				}

				// Calculate which portion of this run is on this line
				const sliceStart = Math.max( 0, lineStart - runStart );
				const sliceEnd = Math.min( run.text.length, lineEnd - runStart );
				const textSlice = run.text.slice( sliceStart, sliceEnd );

				if ( textSlice.length === 0 ) {
					continue;
				}

				// Build style for this run
				const style = run.style || {};
				const fontSize = ( style.fontSize || baseStyle.fontSize ) * scale.avg;
				const fontFamily = style.fontFamily || baseStyle.fontFamily;
				const fontWeight = style.fontWeight || baseStyle.fontWeight;
				const fontStyle = style.fontStyle || baseStyle.fontStyle;
				const color = style.color || baseStyle.color;

				// Set font and color
				this.ctx.font = `${ fontStyle } ${ fontWeight } ${ fontSize }px ${ fontFamily }`;
				this.ctx.fillStyle = color;
				// Ensure alphabetic baseline is used
				this.ctx.textBaseline = 'alphabetic';

				// Draw background (highlight) if specified
				// With alphabetic baseline, lineY is the baseline, so background starts above
				if ( style.backgroundColor ) {
					const metrics = this.ctx.measureText( textSlice );
					// Approximate: ascent is ~80% of fontSize, descent is ~20%
					const ascent = fontSize * 0.8;
					const descent = fontSize * 0.2;
					const bgTop = lineY - ascent;
					const bgHeight = ascent + descent;
					this.ctx.save();
					this.ctx.fillStyle = style.backgroundColor;
					this.ctx.fillRect( currentX, bgTop, metrics.width, bgHeight );
					this.ctx.restore();
					this.ctx.fillStyle = color;
				}

				// Apply text shadow
				if ( textStyle.hasTextShadow ) {
					this.ctx.shadowColor = textStyle.textShadowColor;
					this.ctx.shadowBlur = textStyle.textShadowBlur;
					this.ctx.shadowOffsetX = textStyle.textShadowOffsetX;
					this.ctx.shadowOffsetY = textStyle.textShadowOffsetY;
				}

				// Handle per-run text stroke
				const runStrokeWidth = style.textStrokeWidth ?
					style.textStrokeWidth * scale.avg :
					( textStyle.hasTextStroke ? textStyle.textStrokeWidth : 0 );
				const runStrokeColor = style.textStrokeColor || textStyle.textStrokeColor;

				if ( runStrokeWidth > 0 ) {
					// Disable shadow for stroke
					if ( textStyle.hasTextShadow ) {
						this.ctx.shadowColor = 'transparent';
					}
					this.ctx.strokeStyle = runStrokeColor;
					this.ctx.lineWidth = runStrokeWidth;
					this.ctx.lineJoin = 'round';
					this.ctx.miterLimit = 2;
					this.ctx.strokeText( textSlice, currentX, lineY );
					// Re-enable shadow for fill
					if ( textStyle.hasTextShadow ) {
						this.ctx.shadowColor = textStyle.textShadowColor;
					}
				}

				// Handle text decoration
				// With alphabetic baseline, lineY is at the baseline
				if ( style.textDecoration && style.textDecoration !== 'none' ) {
					const metrics = this.ctx.measureText( textSlice );
					this.ctx.save();
					this.ctx.strokeStyle = color;
					this.ctx.lineWidth = Math.max( 1, fontSize / 15 );

					switch ( style.textDecoration ) {
						case 'underline':
							// Underline goes slightly below the baseline
							this.ctx.beginPath();
							this.ctx.moveTo( currentX, lineY + fontSize * 0.15 );
							this.ctx.lineTo( currentX + metrics.width, lineY + fontSize * 0.15 );
							this.ctx.stroke();
							break;
						case 'line-through':
							// Line-through goes through the middle (x-height area)
							this.ctx.beginPath();
							this.ctx.moveTo( currentX, lineY - fontSize * 0.3 );
							this.ctx.lineTo( currentX + metrics.width, lineY - fontSize * 0.3 );
							this.ctx.stroke();
							break;
						case 'overline':
							// Overline goes above the text
							this.ctx.beginPath();
							this.ctx.moveTo( currentX, lineY - fontSize * 0.8 );
							this.ctx.lineTo( currentX + metrics.width, lineY - fontSize * 0.8 );
							this.ctx.stroke();
							break;
					}
					this.ctx.restore();
				}

				// Draw the text
				this.ctx.fillText( textSlice, currentX, lineY );

				// Measure and advance x position
				const textWidth = this.ctx.measureText( textSlice ).width;
				currentX += textWidth;

				// Clear shadow after drawing
				if ( textStyle.hasTextShadow ) {
					this.ctx.shadowColor = 'transparent';
					this.ctx.shadowBlur = 0;
					this.ctx.shadowOffsetX = 0;
					this.ctx.shadowOffsetY = 0;
				}
			}
		}

		/**
		 * Draw rich text content with word wrapping and mixed formatting
		 *
		 * @param {Object} layer - Layer with richText property
		 * @param {number} x - Box x position
		 * @param {number} y - Box y position
		 * @param {number} width - Box width
		 * @param {number} height - Box height
		 * @param {number} padding - Padding in scaled pixels
		 * @param {Object} scale - Scale factors
		 * @param {Object} shadowScale - Shadow scale factors
		 * @param {number} baseOpacity - Base opacity
		 */
		drawRichTextContent( layer, x, y, width, height, padding, scale, shadowScale, baseOpacity ) {
			const richText = layer.richText;

			// Base style from layer
			const baseStyle = {
				fontSize: layer.fontSize || 16,
				fontFamily: layer.fontFamily || 'Arial, sans-serif',
				fontWeight: layer.fontWeight || 'normal',
				fontStyle: layer.fontStyle || 'normal',
				color: layer.color || '#000000'
			};

			const baseFontSize = baseStyle.fontSize * scale.avg;
			const textAlign = layer.textAlign || 'left';
			const verticalAlign = layer.verticalAlign || 'top';
			const lineHeightMultiplier = layer.lineHeight || 1.2;

			// Get plain text for wrapping
			const plainText = this.getRichTextPlainText( richText );

			// Use base font for wrapping calculations
			const fontString = `${ baseStyle.fontStyle } ${ baseStyle.fontWeight } ${ baseFontSize }px ${ baseStyle.fontFamily }`;
			this.ctx.font = fontString;
			// Use alphabetic baseline for proper mixed-size text alignment
			this.ctx.textBaseline = 'alphabetic';
			this.ctx.globalAlpha = baseOpacity;

			// Wrap text using base font (simplified approach)
			const lines = this.wrapText( plainText, width - padding * 2, baseFontSize, baseStyle.fontFamily, baseStyle.fontWeight, baseStyle.fontStyle );

			// Calculate character ranges for each line and find max font size per line
			const lineMetrics = [];
			let charPos = 0;
			for ( let i = 0; i < lines.length; i++ ) {
				const lineText = lines[ i ];
				const lineStart = charPos;
				const lineEnd = charPos + lineText.length;

				// Find the maximum font size used in this line
				let maxFontSize = baseFontSize;
				let runCharPos = 0;
				for ( const run of richText ) {
					if ( !run || typeof run.text !== 'string' ) {
						continue;
					}
					const runStart = runCharPos;
					const runEnd = runCharPos + run.text.length;
					runCharPos = runEnd;

					// Check if this run overlaps with the current line
					if ( runEnd <= lineStart || runStart >= lineEnd ) {
						continue;
					}

					// This run is on this line - check its font size
					const runFontSize = ( ( run.style && run.style.fontSize ) || baseStyle.fontSize ) * scale.avg;
					if ( runFontSize > maxFontSize ) {
						maxFontSize = runFontSize;
					}
				}

				// Line height based on the tallest text in this line
				const lineHeight = maxFontSize * lineHeightMultiplier;

				lineMetrics.push( {
					text: lineText,
					start: lineStart,
					end: lineEnd,
					maxFontSize: maxFontSize,
					lineHeight: lineHeight
				} );

				charPos = lineEnd;
				// Account for whitespace between lines
				if ( i < lines.length - 1 ) {
					const nextChar = plainText[ charPos ];
					if ( nextChar === ' ' || nextChar === '\n' ) {
						charPos++;
					}
				}
			}

			// Calculate total text height (sum of line heights)
			const totalTextHeight = lineMetrics.reduce( ( sum, lm ) => sum + lm.lineHeight, 0 );
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

			// Text effect properties
			const hasTextShadow = layer.textShadow === true || layer.textShadow === 'true' ||
				layer.textShadow === 1 || layer.textShadow === '1';
			const textStyle = {
				hasTextShadow,
				textShadowColor: layer.textShadowColor || 'rgba(0,0,0,0.5)',
				textShadowBlur: ( typeof layer.textShadowBlur === 'number' ? layer.textShadowBlur : 4 ) * shadowScale.avg,
				textShadowOffsetX: ( typeof layer.textShadowOffsetX === 'number' ? layer.textShadowOffsetX : 2 ) * shadowScale.avg,
				textShadowOffsetY: ( typeof layer.textShadowOffsetY === 'number' ? layer.textShadowOffsetY : 2 ) * shadowScale.avg,
				hasTextStroke: ( layer.textStrokeWidth || 0 ) > 0,
				textStrokeColor: layer.textStrokeColor || '#000000',
				textStrokeWidth: ( layer.textStrokeWidth || 0 ) * scale.avg
			};

			// Draw each line
			let currentY = textY;
			for ( let i = 0; i < lineMetrics.length; i++ ) {
				const lm = lineMetrics[ i ];

				// Calculate baseline position for this line
				// Baseline is at the top of line + max font size (since we're using alphabetic baseline)
				const baselineY = currentY + lm.maxFontSize;

				// Only draw if within the box
				if ( baselineY > y + height ) {
					break;
				}

				// Calculate line X position based on alignment
				// Need to measure with proper font for each run to get accurate width
				let lineX;
				const lineWidth = this.measureRichTextLineWidth( richText, lm.start, lm.end, baseStyle, scale );
				switch ( textAlign ) {
					case 'center':
						lineX = x + ( width - lineWidth ) / 2;
						break;
					case 'right':
						lineX = x + width - padding - lineWidth;
						break;
					case 'left':
					default:
						lineX = x + padding;
						break;
				}

				// Draw the rich text for this line at the baseline
				this.drawRichTextLine( richText, lm.start, lm.end, lineX, baselineY, baseStyle, textStyle, scale );

				// Move to next line
				currentY += lm.lineHeight;
			}
		}

		/**
		 * Measure the width of a rich text line
		 *
		 * @private
		 * @param {Array} richText - Rich text runs array
		 * @param {number} lineStart - Starting character index
		 * @param {number} lineEnd - Ending character index
		 * @param {Object} baseStyle - Base style
		 * @param {Object} scale - Scale factors
		 * @return {number} Width of the line in pixels
		 */
		measureRichTextLineWidth( richText, lineStart, lineEnd, baseStyle, scale ) {
			let totalWidth = 0;
			let charPos = 0;

			for ( const run of richText ) {
				if ( !run || typeof run.text !== 'string' ) {
					continue;
				}

				const runStart = charPos;
				const runEnd = charPos + run.text.length;
				charPos = runEnd;

				// Check if this run overlaps with the current line
				if ( runEnd <= lineStart || runStart >= lineEnd ) {
					continue;
				}

				// Calculate which portion of this run is on this line
				const sliceStart = Math.max( 0, lineStart - runStart );
				const sliceEnd = Math.min( run.text.length, lineEnd - runStart );
				const textSlice = run.text.slice( sliceStart, sliceEnd );

				if ( textSlice.length === 0 ) {
					continue;
				}

				// Build font for this run
				const style = run.style || {};
				const fontSize = ( style.fontSize || baseStyle.fontSize ) * scale.avg;
				const fontFamily = style.fontFamily || baseStyle.fontFamily;
				const fontWeight = style.fontWeight || baseStyle.fontWeight;
				const fontStyle = style.fontStyle || baseStyle.fontStyle;

				this.ctx.font = `${ fontStyle } ${ fontWeight } ${ fontSize }px ${ fontFamily }`;
				totalWidth += this.ctx.measureText( textSlice ).width;
			}

			return totalWidth;
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

			// Draw only the text content (supports both plain text and rich text)
			const hasText = ( layer.text && layer.text.length > 0 ) || this.hasRichText( layer );
			if ( hasText ) {
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
