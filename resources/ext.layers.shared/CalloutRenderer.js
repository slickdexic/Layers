/**
 * CalloutRenderer - Specialized callout/chat bubble rendering
 *
 * This module handles rendering of callout (speech bubble) shapes:
 * - Rounded rectangle container with a triangular tail/pointer
 * - Multi-line text with word wrapping
 * - Text alignment (horizontal and vertical)
 * - Configurable tail direction and position
 * - Text stroke and shadow effects
 *
 * @module CalloutRenderer
 * @since 1.5.0
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
	 * CalloutRenderer class - Renders callout/chat bubble shapes on canvas
	 */
	class CalloutRenderer {
		/**
		 * Creates a new CalloutRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shadowRenderer] - ShadowRenderer instance for shadow operations
		 * @param {Object} [config.effectsRenderer] - EffectsRenderer instance for blur fill
		 * @param {Object} [config.textBoxRenderer] - TextBoxRenderer instance for text rendering
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
			this.effectsRenderer = this.config.effectsRenderer || null;
			this.textBoxRenderer = this.config.textBoxRenderer || null;
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
		 * Set the text box renderer instance (for text rendering)
		 *
		 * @param {Object} textBoxRenderer - TextBoxRenderer instance
		 */
		setTextBoxRenderer( textBoxRenderer ) {
			this.textBoxRenderer = textBoxRenderer;
		}

		/**
		 * Set the context
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
			// Also update context for textBoxRenderer if available
			if ( this.textBoxRenderer && typeof this.textBoxRenderer.setContext === 'function' ) {
				this.textBoxRenderer.setContext( ctx );
			}
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

		// ========================================================================
		// Callout Path Drawing
		// ========================================================================

		/**
		 * Get tail position coordinates based on direction and position.
		 * Uses tangent-aware calculations to ensure tail blends smoothly with corners.
		 *
		 * @private
		 * @param {number} x - Rectangle x
		 * @param {number} y - Rectangle y
		 * @param {number} width - Rectangle width
		 * @param {number} height - Rectangle height
		 * @param {string} direction - Tail direction (bottom, top, left, right, corners)
		 * @param {number} position - Position along edge (0-1)
		 * @param {number} tailSize - Size of the tail
		 * @param {number} cornerRadius - Corner radius to avoid
		 * @return {Object} Object with base1, base2, tip, and optional curve control points
		 */
		getTailCoordinates( x, y, width, height, direction, position, tailSize, cornerRadius ) {
			// Calculate maximum safe tail size relative to shape
			const minDim = Math.min( width, height );
			const safeTailSize = Math.max( 1, Math.min( tailSize, minDim * 0.8 ) );
			const halfTail = Math.max( 1, safeTailSize / 2 );

			// Calculate the "safe zone" for the tail base - area between corners
			// Leave room for corner radius on each side
			const safeZoneMargin = Math.max( cornerRadius, 2 );

			let result;

			// Helper to clamp position and calculate coordinates for horizontal edges
			const calcHorizontal = ( edgeY, tipY, dir ) => {
				const safeStart = x + safeZoneMargin;
				const safeEnd = x + width - safeZoneMargin;
				const safeWidth = Math.max( 0, safeEnd - safeStart );

				// Apply direction-specific position overrides
				let pos = position;
				if ( dir === 'bottom-left' || dir === 'top-left' ) {
					pos = 0.2;
				} else if ( dir === 'bottom-right' || dir === 'top-right' ) {
					pos = 0.8;
				}

				// Calculate center position along safe zone
				const center = safeWidth > 0 ?
					safeStart + safeWidth * Math.max( 0, Math.min( 1, pos ) ) :
					x + width / 2;

				// Calculate base points, clamped to safe zone
				const base1X = Math.max( safeStart, Math.min( safeEnd, center - halfTail ) );
				const base2X = Math.max( safeStart, Math.min( safeEnd, center + halfTail ) );

				return {
					base1: { x: base1X, y: edgeY },
					base2: { x: base2X, y: edgeY },
					tip: { x: center, y: tipY }
				};
			};

			// Helper to calculate coordinates for vertical edges
			const calcVertical = ( edgeX, tipX ) => {
				const safeStart = y + safeZoneMargin;
				const safeEnd = y + height - safeZoneMargin;
				const safeHeight = Math.max( 0, safeEnd - safeStart );

				// Calculate center position along safe zone
				const center = safeHeight > 0 ?
					safeStart + safeHeight * Math.max( 0, Math.min( 1, position ) ) :
					y + height / 2;

				// Calculate base points, clamped to safe zone
				const base1Y = Math.max( safeStart, Math.min( safeEnd, center - halfTail ) );
				const base2Y = Math.max( safeStart, Math.min( safeEnd, center + halfTail ) );

				return {
					base1: { x: edgeX, y: base1Y },
					base2: { x: edgeX, y: base2Y },
					tip: { x: tipX, y: center }
				};
			};

			// Calculate based on direction
			switch ( direction ) {
				case 'bottom':
				case 'bottom-left':
				case 'bottom-right':
					result = calcHorizontal( y + height, y + height + safeTailSize, direction );
					break;

				case 'top':
				case 'top-left':
				case 'top-right': {
					result = calcHorizontal( y, y - safeTailSize, direction );
					// Swap base points for correct winding order on top
					const temp = result.base1;
					result.base1 = result.base2;
					result.base2 = temp;
					break;
				}

				case 'left':
					result = calcVertical( x, x - safeTailSize );
					break;

				case 'right': {
					result = calcVertical( x + width, x + width + safeTailSize );
					// Swap base points for correct winding order on right
					const tempR = result.base1;
					result.base1 = result.base2;
					result.base2 = tempR;
					break;
				}

				default:
					// Default to bottom center
					result = calcHorizontal( y + height, y + height + safeTailSize, 'bottom' );
			}

			return result;
		}

		/**
		 * Draw the callout path (rounded rectangle with tail)
		 *
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {number} width - Width
		 * @param {number} height - Height
		 * @param {number} cornerRadius - Corner radius
		 * @param {string} tailDirection - Direction of the tail
		 * @param {number} tailPosition - Position along edge (0-1)
		 * @param {number} tailSize - Size of the tail
		 * @param {CanvasRenderingContext2D} [context] - Optional context
		 */
		drawCalloutPath( x, y, width, height, cornerRadius, tailDirection, tailPosition, tailSize, context ) {
			const ctx = context || this.ctx;

			// Validate inputs - abort silently if invalid to prevent canvas corruption
			if ( !isFinite( x ) || !isFinite( y ) || !isFinite( width ) || !isFinite( height ) ||
				!isFinite( cornerRadius ) || !isFinite( tailSize ) ) {
				ctx.beginPath(); // Start empty path to avoid errors
				return;
			}

			// Ensure minimum dimensions for rendering
			if ( width < 5 || height < 5 ) {
				// For very small shapes, just draw a simple rectangle
				ctx.beginPath();
				ctx.rect( x, y, Math.max( 1, width ), Math.max( 1, height ) );
				return;
			}

			// Clamp corner radius to safe range (max half of smaller dimension)
			const maxRadius = Math.min( width, height ) / 2;
			const r = Math.max( 0, Math.min( cornerRadius, maxRadius ) );

			// Clamp tail size to reasonable range
			const maxTailSize = Math.min( width * 0.8, height * 0.8 );
			const actualTailSize = Math.max( 0, Math.min( tailSize, maxTailSize ) );

			// Get tail coordinates - already clamped to safe zones
			const tail = this.getTailCoordinates( x, y, width, height, tailDirection, tailPosition, actualTailSize, r );

			// Validate tail coordinates
			if ( !tail || !tail.base1 || !tail.base2 || !tail.tip ||
				!isFinite( tail.base1.x ) || !isFinite( tail.base1.y ) ||
				!isFinite( tail.base2.x ) || !isFinite( tail.base2.y ) ||
				!isFinite( tail.tip.x ) || !isFinite( tail.tip.y ) ) {
				// Fallback to simple rounded rect without tail
				ctx.beginPath();
				if ( r > 0.5 && ctx.roundRect ) {
					ctx.roundRect( x, y, width, height, r );
				} else {
					ctx.rect( x, y, width, height );
				}
				return;
			}

			ctx.beginPath();

			// Use simpler path if corner radius is 0
			if ( r < 0.5 ) {
				// Simple rectangle path with tail
				ctx.moveTo( x, y );

				// Top edge with optional tail
				if ( tailDirection === 'top' || tailDirection === 'top-left' || tailDirection === 'top-right' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					ctx.lineTo( tail.tip.x, tail.tip.y );
					ctx.lineTo( tail.base1.x, tail.base1.y );
				}
				ctx.lineTo( x + width, y );

				// Right edge with optional tail
				if ( tailDirection === 'right' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					ctx.lineTo( tail.tip.x, tail.tip.y );
					ctx.lineTo( tail.base1.x, tail.base1.y );
				}
				ctx.lineTo( x + width, y + height );

				// Bottom edge with optional tail
				if ( tailDirection === 'bottom' || tailDirection === 'bottom-left' || tailDirection === 'bottom-right' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					ctx.lineTo( tail.tip.x, tail.tip.y );
					ctx.lineTo( tail.base1.x, tail.base1.y );
				}
				ctx.lineTo( x, y + height );

				// Left edge with optional tail
				if ( tailDirection === 'left' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					ctx.lineTo( tail.tip.x, tail.tip.y );
					ctx.lineTo( tail.base1.x, tail.base1.y );
				}

				ctx.closePath();
				return;
			}

			// Rounded rectangle with tail
			ctx.moveTo( x + r, y );

			// Top edge
			if ( tailDirection === 'top' || tailDirection === 'top-left' || tailDirection === 'top-right' ) {
				ctx.lineTo( tail.base2.x, tail.base2.y );
				ctx.lineTo( tail.tip.x, tail.tip.y );
				ctx.lineTo( tail.base1.x, tail.base1.y );
			}
			ctx.lineTo( x + width - r, y );

			// Top-right corner
			ctx.arcTo( x + width, y, x + width, y + r, r );

			// Right edge
			if ( tailDirection === 'right' ) {
				ctx.lineTo( tail.base2.x, tail.base2.y );
				ctx.lineTo( tail.tip.x, tail.tip.y );
				ctx.lineTo( tail.base1.x, tail.base1.y );
			}
			ctx.lineTo( x + width, y + height - r );

			// Bottom-right corner
			ctx.arcTo( x + width, y + height, x + width - r, y + height, r );

			// Bottom edge
			if ( tailDirection === 'bottom' || tailDirection === 'bottom-left' || tailDirection === 'bottom-right' ) {
				ctx.lineTo( tail.base2.x, tail.base2.y );
				ctx.lineTo( tail.tip.x, tail.tip.y );
				ctx.lineTo( tail.base1.x, tail.base1.y );
			}
			ctx.lineTo( x + r, y + height );

			// Bottom-left corner
			ctx.arcTo( x, y + height, x, y + height - r, r );

			// Left edge
			if ( tailDirection === 'left' ) {
				ctx.lineTo( tail.base2.x, tail.base2.y );
				ctx.lineTo( tail.tip.x, tail.tip.y );
				ctx.lineTo( tail.base1.x, tail.base1.y );
			}
			ctx.lineTo( x, y + r );

			// Top-left corner
			ctx.arcTo( x, y, x + r, y, r );

			ctx.closePath();
		}

		// ========================================================================
		// Main Draw Method
		// ========================================================================

		/**
		 * Draw a callout shape (rounded rectangle with tail and multi-line text)
		 *
		 * @param {Object} layer - Layer with callout properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
		 */
		draw( layer, options ) {
			// Wrap in try-catch to prevent canvas corruption from errors
			try {
				this._drawInternal( layer, options );
			} catch ( e ) {
				if ( typeof console !== 'undefined' && console.error ) {
					console.error( 'CalloutRenderer.draw error:', e );
				}
				// Ensure context is restored if error occurred after save
				try {
					this.ctx.restore();
				} catch ( restoreErr ) {
					// Ignore restore errors
				}
			}
		}

		/**
		 * Internal draw implementation
		 *
		 * @private
		 * @param {Object} layer - Layer with callout properties
		 * @param {Object} [options] - Rendering options
		 */
		_drawInternal( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			let x = layer.x || 0;
			let y = layer.y || 0;
			let width = layer.width || 0;
			let height = layer.height || 0;

			// Skip rendering if dimensions are too small
			if ( Math.abs( width ) < 1 || Math.abs( height ) < 1 ) {
				return;
			}

			// Normalize negative dimensions (when drawing from bottom-right to top-left)
			if ( width < 0 ) {
				x = x + width;
				width = Math.abs( width );
			}
			if ( height < 0 ) {
				y = y + height;
				height = Math.abs( height );
			}

			let strokeW = layer.strokeWidth || 1;
			let cornerRadius = layer.cornerRadius || 8;
			const padding = ( layer.padding || 8 ) * scale.avg;

			// Callout-specific properties
			const tailDirection = layer.tailDirection || 'bottom';
			const tailPosition = typeof layer.tailPosition === 'number' ? layer.tailPosition : 0.5;
			let tailSize = layer.tailSize || 20;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
				cornerRadius = cornerRadius * scale.avg;
				tailSize = tailSize * scale.avg;
			}

			// Ensure minimum dimensions for stable rendering
			if ( width < 20 || height < 20 ) {
				// Too small for a proper callout - just draw simple rect
				this.ctx.save();
				this.ctx.beginPath();
				this.ctx.rect( x, y, width, height );
				if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' && layer.fill !== 'blur' ) {
					this.ctx.fillStyle = layer.fill;
					this.ctx.fill();
				}
				if ( layer.stroke && layer.stroke !== 'none' && layer.stroke !== 'transparent' && strokeW > 0 ) {
					this.ctx.strokeStyle = layer.stroke;
					this.ctx.lineWidth = strokeW;
					this.ctx.stroke();
				}
				this.ctx.restore();
				return;
			}

			// Clamp corner radius to prevent rendering issues
			// Corner radius must leave room for tail on the edge
			const maxRadius = Math.min( width, height ) / 3;
			cornerRadius = Math.min( cornerRadius, Math.max( 0, maxRadius ) );

			// Clamp tail size to prevent it from being larger than the shape
			const maxTailSize = Math.min( width / 3, height / 3 );
			tailSize = Math.min( tailSize, Math.max( 0, maxTailSize ) );

			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const isBlurFill = layer.fill === 'blur';
			const fillOpacity = clampOpacity( layer.fillOpacity );

			// Save original coordinates for blur capture
			const originalX = x;
			const originalY = y;

			this.ctx.save();

			// Apply rotation
			if ( hasRotation ) {
				this.ctx.translate( x + width / 2, y + height / 2 );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				x = -width / 2;
				y = -height / 2;
			}

			const spread = this.getShadowSpread( layer, shadowScale );

			// Helper to draw the callout path
			const drawPath = ( ctx ) => {
				const targetCtx = ctx || this.ctx;
				this.drawCalloutPath( x, y, width, height, cornerRadius, tailDirection, tailPosition, tailSize, targetCtx );
			};

			// Handle blur fill
			if ( isBlurFill && this.effectsRenderer && fillOpacity > 0 ) {
				let blurBounds;
				if ( hasRotation ) {
					const centerX = originalX + width / 2;
					const centerY = originalY + height / 2;
					const angleRad = ( layer.rotation * Math.PI ) / 180;
					const cos = Math.abs( Math.cos( angleRad ) );
					const sin = Math.abs( Math.sin( angleRad ) );
					const aabbWidth = width * cos + height * sin;
					const aabbHeight = width * sin + height * cos;
					blurBounds = {
						x: centerX - aabbWidth / 2,
						y: centerY - aabbHeight / 2,
						width: aabbWidth,
						height: aabbHeight + tailSize
					};
				} else {
					// Include tail in bounds
					let boundsY = y;
					let boundsHeight = height;
					if ( tailDirection === 'top' || tailDirection === 'top-left' || tailDirection === 'top-right' ) {
						boundsY = y - tailSize;
						boundsHeight = height + tailSize;
					} else if ( tailDirection === 'bottom' || tailDirection === 'bottom-left' || tailDirection === 'bottom-right' ) {
						boundsHeight = height + tailSize;
					}
					blurBounds = { x: originalX, y: boundsY, width: width, height: boundsHeight };
				}

				this.effectsRenderer.drawBlurFill(
					layer,
					blurBounds,
					drawPath,
					this.ctx,
					fillOpacity * baseOpacity
				);
			}

			// Draw shadow with spread
			if ( spread > 0 && !isBlurFill ) {
				this.drawSpreadShadow( layer, shadowScale, spread, drawPath, fillOpacity * baseOpacity );
			}

			// Draw fill
			if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' && !isBlurFill ) {
				drawPath();
				this.ctx.fillStyle = layer.fill;
				this.ctx.globalAlpha = fillOpacity * baseOpacity;

				if ( this.hasShadowEnabled( layer ) && spread === 0 ) {
					if ( this.shadowRenderer ) {
						this.shadowRenderer.applyShadow( layer, shadowScale );
					}
				}

				this.ctx.fill();
				this.clearShadow();
			}

			// Draw stroke
			if ( layer.stroke && layer.stroke !== 'none' && layer.stroke !== 'transparent' && strokeW > 0 ) {
				drawPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				const strokeOpacity = clampOpacity( layer.strokeOpacity );
				this.ctx.globalAlpha = strokeOpacity * baseOpacity;

				if ( this.hasShadowEnabled( layer ) && !layer.fill ) {
					if ( this.shadowRenderer ) {
						this.shadowRenderer.applyShadow( layer, shadowScale );
					}
				}

				this.ctx.stroke();
				this.clearShadow();
			}

			// Draw text inside the callout (delegate to TextBoxRenderer if available)
			if ( layer.text && this.textBoxRenderer ) {
				// Create a temporary layer for text rendering with adjusted bounds
				const textLayer = Object.assign( {}, layer, {
					x: x,
					y: y,
					width: width,
					height: height,
					// Don't re-apply rotation - already applied to context
					rotation: 0
				} );

				// Use TextBoxRenderer's text drawing logic with correct parameters
				this.textBoxRenderer.drawTextContent( textLayer, x, y, width, height, padding / scale.avg, scale, shadowScale, baseOpacity );
			} else if ( layer.text ) {
				// Fallback: simple single-line text
				this.drawSimpleText( layer, x, y, width, height, padding, baseOpacity, scale );
			}

			this.ctx.restore();
		}

		/**
		 * Draw simple text fallback when TextBoxRenderer is not available
		 *
		 * @private
		 * @param {Object} layer - Layer with text properties
		 * @param {number} x - Box x
		 * @param {number} y - Box y
		 * @param {number} width - Box width
		 * @param {number} height - Box height
		 * @param {number} padding - Padding
		 * @param {number} opacity - Opacity
		 * @param {Object} scale - Scale factors
		 */
		drawSimpleText( layer, x, y, width, height, padding, opacity, scale ) {
			const fontSize = ( layer.fontSize || 16 ) * ( scale.avg || 1 );
			const fontFamily = layer.fontFamily || 'Arial, sans-serif';
			const fontWeight = layer.fontWeight || 'normal';
			const fontStyle = layer.fontStyle || 'normal';

			this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
			this.ctx.fillStyle = layer.color || '#000000';
			this.ctx.globalAlpha = opacity;

			const textAlign = layer.textAlign || 'left';
			const verticalAlign = layer.verticalAlign || 'top';

			let textX = x + padding;
			if ( textAlign === 'center' ) {
				textX = x + width / 2;
				this.ctx.textAlign = 'center';
			} else if ( textAlign === 'right' ) {
				textX = x + width - padding;
				this.ctx.textAlign = 'right';
			} else {
				this.ctx.textAlign = 'left';
			}

			let textY = y + padding + fontSize;
			if ( verticalAlign === 'middle' ) {
				textY = y + height / 2 + fontSize / 3;
			} else if ( verticalAlign === 'bottom' ) {
				textY = y + height - padding;
			}

			this.ctx.fillText( layer.text, textX, textY );
		}
	}

	// Export to Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.CalloutRenderer = CalloutRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CalloutRenderer;
	}
}() );
