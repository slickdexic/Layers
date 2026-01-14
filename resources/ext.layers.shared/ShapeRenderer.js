/**
 * ShapeRenderer - Specialized basic shape rendering
 *
 * Extracted from LayerRenderer.js to reduce file size and improve maintainability.
 * This module handles rendering of basic geometric shapes:
 * - Rectangle (with rounded corners)
 * - Circle
 * - Ellipse
 * - Polygon (regular n-gons)
 * - Star
 *
 * All shapes support:
 * - Fill and stroke with separate opacities
 * - Shadow rendering with spread support
 * - Rotation
 * - Scaling
 *
 * @module ShapeRenderer
 * @since 0.9.1
 */
( function () {
	'use strict';

	/**
	 * Get SCALE_EPSILON from MathUtils namespace (with fallback)
	 *
	 * @private
	 * @return {number} Scale epsilon value
	 */
	function getScaleEpsilon() {
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.MathUtils && window.Layers.MathUtils.MATH ) {
			return window.Layers.MathUtils.MATH.SCALE_EPSILON;
		}
		// Fallback if MathUtils not loaded
		return 0.0001;
	}

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
	 * ShapeRenderer class - Renders basic geometric shapes on canvas
	 */
	class ShapeRenderer {
		/**
		 * Creates a new ShapeRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shadowRenderer] - ShadowRenderer instance for shadow operations
		 * @param {Object} [config.polygonStarRenderer] - PolygonStarRenderer instance for polygon/star shapes
		 * @param {Object} [config.effectsRenderer] - EffectsRenderer instance for blur fill
		 * @param {Object} [config.gradientRenderer] - GradientRenderer instance for gradient fills
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
			this.polygonStarRenderer = this.config.polygonStarRenderer || null;
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
		 * Set the polygon/star renderer instance
		 *
		 * @param {Object} polygonStarRenderer - PolygonStarRenderer instance
		 */
		setPolygonStarRenderer( polygonStarRenderer ) {
			this.polygonStarRenderer = polygonStarRenderer;
			if ( polygonStarRenderer ) {
				polygonStarRenderer.setShapeRenderer( this );
			}
		}

		/**
		 * Set the context
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
			if ( this.polygonStarRenderer ) {
				this.polygonStarRenderer.setContext( ctx );
			}
		}

		// ========================================================================
		// Fill Helper Methods
		// ========================================================================

		/**
		 * Apply fill style to context (gradient or solid color)
		 *
		 * Checks if the layer has a gradient definition and applies it if available,
		 * otherwise falls back to solid fill color.
		 *
		 * @param {Object} layer - Layer with fill and optional gradient properties
		 * @param {Object} bounds - Bounding box for gradient calculation { x, y, width, height }
		 * @param {Object} [opts] - Options including scale
		 * @return {boolean} True if gradient was applied, false for solid fill
		 */
		applyFillStyle( layer, bounds, opts ) {
			// Extract scale factor - opts.scale may be an object {sx, sy, avg} or a number
			let scaleFactor = 1;
			if ( opts && opts.scale ) {
				if ( typeof opts.scale === 'number' ) {
					scaleFactor = opts.scale;
				} else if ( typeof opts.scale.avg === 'number' ) {
					scaleFactor = opts.scale.avg;
				}
			}

			// Check for gradient fill first
			if ( this.gradientRenderer ) {
				const GradientRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.Renderers && window.Layers.Renderers.GradientRenderer );
				if ( GradientRenderer && GradientRenderer.hasGradient( layer ) ) {
					return this.gradientRenderer.applyFill( layer, bounds, { scale: scaleFactor } );
				}
			}

			// Fallback to solid fill
			if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' && layer.fill !== 'blur' ) {
				this.ctx.fillStyle = layer.fill;
			}
			return false;
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
			}
			// No fallback - shadows require ShadowRenderer for full support
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
			// If no shadowRenderer, shadows are not drawn
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
			// If no shadowRenderer, shadows are not drawn
		}

		// ========================================================================
		// Geometry Helper Methods (delegate to PolygonStarRenderer)
		// ========================================================================

		/**
		 * Draw a rounded polygon path on the context
		 * Delegates to PolygonStarRenderer if available
		 *
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points
		 * @param {number} cornerRadius - Radius for rounded corners
		 */
		drawRoundedPolygonPath( vertices, cornerRadius ) {
			if ( this.polygonStarRenderer ) {
				this.polygonStarRenderer.drawRoundedPolygonPath( vertices, cornerRadius );
			}
		}

		/**
		 * Draw a rounded star path on the context with different radii for points and valleys
		 * Delegates to PolygonStarRenderer if available
		 *
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points (alternating outer/inner)
		 * @param {number} pointRadius - Radius for outer point corners
		 * @param {number} valleyRadius - Radius for inner valley corners
		 */
		drawRoundedStarPath( vertices, pointRadius, valleyRadius ) {
			if ( this.polygonStarRenderer ) {
				this.polygonStarRenderer.drawRoundedStarPath( vertices, pointRadius, valleyRadius );
			}
		}

		// ========================================================================
		// Rectangle
		// ========================================================================

		/**
		 * Draw a rectangle shape
		 *
		 * @param {Object} layer - Layer with rectangle properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
		 */
		drawRectangle( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			let x = layer.x || 0;
			let y = layer.y || 0;
			const width = layer.width || 0;
			const height = layer.height || 0;
			let strokeW = layer.strokeWidth || 1;
			let cornerRadius = layer.cornerRadius || 0;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
				cornerRadius = cornerRadius * scale.avg;
			}

			// Clamp corner radius to half of the smaller dimension
			const maxRadius = Math.min( Math.abs( width ), Math.abs( height ) ) / 2;
			cornerRadius = Math.min( cornerRadius, maxRadius );

			this.ctx.save();

			// Store world coordinates BEFORE rotation for blur fill capture
			// (drawBlurFill needs world coords to capture the correct canvas region)
			const worldX = x;
			const worldY = y;

			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			if ( hasRotation ) {
				this.ctx.translate( x + width / 2, y + height / 2 );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				x = -width / 2;
				y = -height / 2;
			}

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Use rounded rect if cornerRadius > 0, otherwise use regular rect
			const useRoundedRect = cornerRadius > 0 && this.ctx.roundRect;

			// Shadow handling
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
						}, fillShadowOpacity );
					}
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
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
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

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

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const isBlurFill = layer.fill === 'blur';
			// Check for gradient fill using static method if available
			const GradientRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.Renderers && window.Layers.Renderers.GradientRenderer );
			const hasGradient = GradientRenderer && GradientRenderer.hasGradient( layer );
			const hasFill = ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0 ) || hasGradient;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Bounds for gradient calculation
			const fillBounds = { x: x, y: y, width: width, height: height };

			// Draw fill
			if ( hasFill ) {
				if ( isBlurFill && this.effectsRenderer ) {
					// Blur fill - use EffectsRenderer to blur background within shape
					// Use world coordinates for capture bounds (before rotation transform)
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.effectsRenderer.drawBlurFill(
						layer,
						drawRectPath,
						{ x: worldX, y: worldY, width: width, height: height },
						opts
					);
				} else if ( !isBlurFill ) {
					// Apply gradient or solid fill
					this.applyFillStyle( layer, fillBounds, opts );
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					drawRectPath();
					this.ctx.fill();
				}
			}

			// Draw stroke
			if ( hasStroke ) {
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				drawRectPath();
				this.ctx.stroke();
			}

			this.ctx.restore();
		}

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
		// Circle
		// ========================================================================

		/**
		 * Draw a circle shape
		 *
		 * @param {Object} layer - Layer with circle properties (x, y center, radius)
		 * @param {Object} [options] - Rendering options
		 */
		drawCircle( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			const cx = layer.x || 0;
			const cy = layer.y || 0;
			const radius = layer.radius || 0;
			let strokeW = layer.strokeWidth || 1;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
			}

			this.ctx.save();

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Shadow handling
			// Note: Blur fill (fill='blur') should NOT trigger fill shadow rendering
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && layer.fill !== 'blur';
				const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

				// Draw fill shadow
				if ( hasFillForShadow ) {
					const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
					const effectiveRadius = spread > 0 ? radius + spread : radius;
					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						ctx.beginPath();
						ctx.arc( cx, cy, effectiveRadius, 0, 2 * Math.PI );
					}, fillShadowOpacity );
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						ctx.beginPath();
						ctx.arc( cx, cy, radius, 0, 2 * Math.PI );
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const isBlurFill = layer.fill === 'blur';
			// Check for gradient fill
			const GradientRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.Renderers && window.Layers.Renderers.GradientRenderer );
			const hasGradient = GradientRenderer && GradientRenderer.hasGradient( layer );
			const hasFill = ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0 ) || hasGradient;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Bounds for gradient calculation
			const fillBounds = { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 };

			// Helper to draw circle path
			const drawCirclePath = ( ctx ) => {
				const context = ctx || this.ctx;
				context.beginPath();
				context.arc( cx, cy, radius, 0, 2 * Math.PI );
			};

			// Draw fill
			if ( hasFill ) {
				if ( isBlurFill && this.effectsRenderer ) {
					// Blur fill - use EffectsRenderer to blur background within circle
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.effectsRenderer.drawBlurFill(
						layer,
						drawCirclePath,
						fillBounds,
						opts
					);
				} else if ( !isBlurFill ) {
					// Apply gradient or solid fill
					drawCirclePath();
					this.applyFillStyle( layer, fillBounds, opts );
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.ctx.fill();
				}
			}

			// Draw stroke
			if ( hasStroke ) {
				drawCirclePath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();
			}

			this.ctx.restore();
		}

		// ========================================================================
		// Ellipse
		// ========================================================================

		/**
		 * Draw an ellipse shape
		 *
		 * @param {Object} layer - Layer with ellipse properties
		 * @param {Object} [options] - Rendering options
		 */
		drawEllipse( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;
			const scaleEpsilon = getScaleEpsilon();

			const x = layer.x || 0;
			const y = layer.y || 0;
			const radiusX = layer.radiusX || ( layer.width || 0 ) / 2;
			const radiusY = layer.radiusY || ( layer.height || 0 ) / 2;
			let strokeW = layer.strokeWidth || 1;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
			}

			this.ctx.save();

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Handle rotation
			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			const rotationRad = hasRotation ? ( layer.rotation * Math.PI ) / 180 : 0;

			// Shadow handling
			// Note: Blur fill (fill='blur') should NOT trigger fill shadow rendering
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && layer.fill !== 'blur';
				const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

				// Draw fill shadow
				if ( hasFillForShadow ) {
					const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
					const effectiveRadiusX = spread > 0 ? radiusX + spread : radiusX;
					const effectiveRadiusY = spread > 0 ? radiusY + spread : radiusY;
					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						ctx.beginPath();
						if ( ctx.ellipse ) {
							ctx.ellipse( x, y, effectiveRadiusX, effectiveRadiusY, rotationRad, 0, 2 * Math.PI );
						} else {
							ctx.save();
							ctx.translate( x, y );
							if ( hasRotation ) {
								ctx.rotate( rotationRad );
							}
							ctx.scale( Math.max( effectiveRadiusX, scaleEpsilon ), Math.max( effectiveRadiusY, scaleEpsilon ) );
							ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
							ctx.restore();
						}
					}, fillShadowOpacity );
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						ctx.beginPath();
						if ( ctx.ellipse ) {
							ctx.ellipse( x, y, radiusX, radiusY, rotationRad, 0, 2 * Math.PI );
						} else {
							ctx.save();
							ctx.translate( x, y );
							if ( hasRotation ) {
								ctx.rotate( rotationRad );
							}
							ctx.scale( Math.max( radiusX, scaleEpsilon ), Math.max( radiusY, scaleEpsilon ) );
							ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
							ctx.restore();
						}
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const isBlurFill = layer.fill === 'blur';
			// Check for gradient fill
			const GradientRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.Renderers && window.Layers.Renderers.GradientRenderer );
			const hasGradient = GradientRenderer && GradientRenderer.hasGradient( layer );
			const hasFill = ( layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0 ) || hasGradient;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Bounds for gradient calculation
			const fillBounds = { x: x - radiusX, y: y - radiusY, width: radiusX * 2, height: radiusY * 2 };

			// Helper to draw ellipse path
			const drawEllipsePath = ( ctx ) => {
				const context = ctx || this.ctx;
				context.beginPath();
				if ( context.ellipse ) {
					context.ellipse( x, y, radiusX, radiusY, rotationRad, 0, 2 * Math.PI );
				} else {
					context.save();
					context.translate( x, y );
					if ( hasRotation ) {
						context.rotate( rotationRad );
					}
					context.scale( Math.max( radiusX, scaleEpsilon ), Math.max( radiusY, scaleEpsilon ) );
					context.arc( 0, 0, 1, 0, 2 * Math.PI );
					context.restore();
				}
			};

			// Draw fill
			if ( hasFill ) {
				if ( isBlurFill && this.effectsRenderer ) {
					// Blur fill - use EffectsRenderer to blur background within ellipse
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.effectsRenderer.drawBlurFill(
						layer,
						drawEllipsePath,
						fillBounds,
						opts
					);
				} else if ( !isBlurFill ) {
					// Apply gradient or solid fill
					drawEllipsePath();
					this.applyFillStyle( layer, fillBounds, opts );
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.ctx.fill();
				}
			}

			// Draw stroke
			if ( hasStroke ) {
				drawEllipsePath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();
			}

			this.ctx.restore();
		}

		// ========================================================================
		// Polygon (delegated to PolygonStarRenderer)
		// ========================================================================

		/**
		 * Draw a regular polygon shape
		 * Delegates to PolygonStarRenderer if available
		 *
		 * @param {Object} layer - Layer with polygon properties (sides, x, y, radius, cornerRadius)
		 * @param {Object} [options] - Rendering options
		 */
		drawPolygon( layer, options ) {
			if ( this.polygonStarRenderer ) {
				this.polygonStarRenderer.drawPolygon( layer, options );
			}
		}

		// ========================================================================
		// Star (delegated to PolygonStarRenderer)
		// ========================================================================

		/**
		 * Draw a star shape
		 * Delegates to PolygonStarRenderer if available
		 *
		 * @param {Object} layer - Layer with star properties (points, x, y, outerRadius, innerRadius, pointRadius, valleyRadius)
		 * @param {Object} [options] - Rendering options
		 */
		drawStar( layer, options ) {
			if ( this.polygonStarRenderer ) {
				this.polygonStarRenderer.drawStar( layer, options );
			}
		}

		/**
		 * Draw a line shape
		 *
		 * @param {Object} layer - Layer with line properties (x1, y1, x2, y2)
		 * @param {Object} [options] - Rendering options
		 */
		drawLine( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;
			let strokeW = layer.strokeWidth || 1;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
			}

			this.ctx.save();

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Handle rotation
			if ( typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
				const centerX = ( x1 + x2 ) / 2;
				const centerY = ( y1 + y2 ) / 2;
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				this.ctx.translate( -centerX, -centerY );
			}

			// Shadow handling with spread - for lines, spread means a thicker shadow stroke
			if ( spread > 0 && this.hasShadowEnabled( layer ) ) {
				const expandedWidth = strokeW + spread * 2;
				const shadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );

				this.drawSpreadShadowStroke( layer, shadowScale, expandedWidth, ( ctx ) => {
					ctx.beginPath();
					ctx.moveTo( x1, y1 );
					ctx.lineTo( x2, y2 );
				}, shadowOpacity );
			} else if ( this.hasShadowEnabled( layer ) ) {
				this.applyShadow( layer, shadowScale );
			}

			// Draw actual line
			if ( spread > 0 ) {
				this.clearShadow();
			}

			this.ctx.strokeStyle = layer.stroke || '#000000';
			this.ctx.lineWidth = strokeW;
			this.ctx.lineCap = 'round';
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );

			this.ctx.beginPath();
			this.ctx.moveTo( x1, y1 );
			this.ctx.lineTo( x2, y2 );
			this.ctx.stroke();

			this.ctx.restore();
		}

		/**
		 * Draw a freehand path
		 *
		 * @param {Object} layer - Layer with points array
		 * @param {Object} [options] - Rendering options
		 */
		drawPath( layer, options ) {
			if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 2 ) {
				return;
			}

			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			let strokeW = layer.strokeWidth || 2;
			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
			}

			this.ctx.save();

			// Handle rotation: calculate bounding box center and rotate around it
			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			let centerX = 0;
			let centerY = 0;

			if ( hasRotation ) {
				// Calculate bounding box of all points
				let minX = layer.points[ 0 ].x;
				let minY = layer.points[ 0 ].y;
				let maxX = minX;
				let maxY = minY;

				for ( let i = 1; i < layer.points.length; i++ ) {
					const pt = layer.points[ i ];
					minX = Math.min( minX, pt.x );
					minY = Math.min( minY, pt.y );
					maxX = Math.max( maxX, pt.x );
					maxY = Math.max( maxY, pt.y );
				}

				centerX = ( minX + maxX ) / 2;
				centerY = ( minY + maxY ) / 2;

				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				this.ctx.translate( -centerX, -centerY );
			}

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Shadow handling with spread
			if ( spread > 0 && this.hasShadowEnabled( layer ) ) {
				const expandedWidth = strokeW + spread * 2;
				const shadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );

				this.drawSpreadShadowStroke( layer, shadowScale, expandedWidth, ( ctx ) => {
					ctx.beginPath();
					ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );
					for ( let i = 1; i < layer.points.length; i++ ) {
						ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
					}
				}, shadowOpacity );
			} else if ( this.hasShadowEnabled( layer ) ) {
				this.applyShadow( layer, shadowScale );
			}

			// Draw actual path
			if ( spread > 0 ) {
				this.clearShadow();
			}

			this.ctx.strokeStyle = layer.stroke || '#000000';
			this.ctx.lineWidth = strokeW;
			this.ctx.lineCap = 'round';
			this.ctx.lineJoin = 'round';
			this.ctx.globalAlpha = baseOpacity * clampOpacity( layer.strokeOpacity );

			this.ctx.beginPath();
			this.ctx.moveTo( layer.points[ 0 ].x, layer.points[ 0 ].y );
			for ( let i = 1; i < layer.points.length; i++ ) {
				this.ctx.lineTo( layer.points[ i ].x, layer.points[ i ].y );
			}
			this.ctx.stroke();

			this.ctx.restore();
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.ctx = null;
			this.config = null;
			this.shadowRenderer = null;
			if ( this.polygonStarRenderer ) {
				this.polygonStarRenderer.destroy();
				this.polygonStarRenderer = null;
			}
		}
	}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.ShapeRenderer = ShapeRenderer;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = ShapeRenderer;
	}

}() );
