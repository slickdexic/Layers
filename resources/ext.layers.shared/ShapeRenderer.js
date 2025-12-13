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
	 * Clamp a value to a valid opacity range [0, 1]
	 *
	 * @private
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
	 * ShapeRenderer class - Renders basic geometric shapes on canvas
	 */
	class ShapeRenderer {
		/**
		 * Creates a new ShapeRenderer instance
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
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
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
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Draw fill
			if ( hasFill ) {
				this.ctx.beginPath();
				this.ctx.arc( cx, cy, radius, 0, 2 * Math.PI );
				this.ctx.fillStyle = layer.fill;
				this.ctx.globalAlpha = baseOpacity * fillOpacity;
				this.ctx.fill();
			}

			// Draw stroke
			if ( hasStroke ) {
				this.ctx.beginPath();
				this.ctx.arc( cx, cy, radius, 0, 2 * Math.PI );
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
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
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
							ctx.scale( Math.max( effectiveRadiusX, 0.0001 ), Math.max( effectiveRadiusY, 0.0001 ) );
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
							ctx.scale( Math.max( radiusX, 0.0001 ), Math.max( radiusY, 0.0001 ) );
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
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Use native ellipse() if available
			if ( this.ctx.ellipse ) {
				// Draw fill
				if ( hasFill ) {
					this.ctx.beginPath();
					this.ctx.ellipse( x, y, radiusX, radiusY, rotationRad, 0, 2 * Math.PI );
					this.ctx.fillStyle = layer.fill;
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.ctx.fill();
				}

				// Draw stroke
				if ( hasStroke ) {
					this.ctx.beginPath();
					this.ctx.ellipse( x, y, radiusX, radiusY, rotationRad, 0, 2 * Math.PI );
					this.ctx.strokeStyle = layer.stroke;
					this.ctx.lineWidth = strokeW;
					this.ctx.globalAlpha = baseOpacity * strokeOpacity;
					this.ctx.stroke();
				}
			} else {
				// Fallback: use scale transform
				this.ctx.translate( x, y );
				if ( hasRotation ) {
					this.ctx.rotate( rotationRad );
				}

				// Draw fill
				if ( hasFill ) {
					this.ctx.beginPath();
					this.ctx.save();
					this.ctx.scale( Math.max( radiusX, 0.0001 ), Math.max( radiusY, 0.0001 ) );
					this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
					this.ctx.restore();
					this.ctx.fillStyle = layer.fill;
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.ctx.fill();
				}

				// Draw stroke
				if ( hasStroke ) {
					this.ctx.beginPath();
					this.ctx.save();
					this.ctx.scale( Math.max( radiusX, 0.0001 ), Math.max( radiusY, 0.0001 ) );
					this.ctx.arc( 0, 0, 1, 0, 2 * Math.PI );
					this.ctx.restore();
					this.ctx.strokeStyle = layer.stroke;
					this.ctx.lineWidth = strokeW;
					this.ctx.globalAlpha = baseOpacity * strokeOpacity;
					this.ctx.stroke();
				}
			}

			this.ctx.restore();
		}

		// ========================================================================
		// Polygon
		// ========================================================================

		/**
		 * Draw a regular polygon shape
		 *
		 * @param {Object} layer - Layer with polygon properties (sides, x, y, radius)
		 * @param {Object} [options] - Rendering options
		 */
		drawPolygon( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			const sides = layer.sides || 6;
			const x = layer.x || 0;
			const y = layer.y || 0;
			const radius = layer.radius || 50;
			let strokeW = layer.strokeWidth || 1;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
			}

			this.ctx.save();

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Handle rotation around polygon center
			if ( typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
				this.ctx.translate( x, y );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				this.ctx.translate( -x, -y );
			}

			// Shadow handling
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
				const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

				// Draw fill shadow
				if ( hasFillForShadow ) {
					const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
					const effectiveRadius = spread > 0 ? radius + spread : radius;
					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						ctx.beginPath();
						for ( let i = 0; i < sides; i++ ) {
							const angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
							const px = x + effectiveRadius * Math.cos( angle );
							const py = y + effectiveRadius * Math.sin( angle );
							if ( i === 0 ) {
								ctx.moveTo( px, py );
							} else {
								ctx.lineTo( px, py );
							}
						}
						ctx.closePath();
					}, fillShadowOpacity );
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						ctx.beginPath();
						for ( let i = 0; i < sides; i++ ) {
							const angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
							const px = x + radius * Math.cos( angle );
							const py = y + radius * Math.sin( angle );
							if ( i === 0 ) {
								ctx.moveTo( px, py );
							} else {
								ctx.lineTo( px, py );
							}
						}
						ctx.closePath();
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			// Helper to draw the polygon path
			const drawPolygonPath = () => {
				this.ctx.beginPath();
				for ( let i = 0; i < sides; i++ ) {
					const angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
					const px = x + radius * Math.cos( angle );
					const py = y + radius * Math.sin( angle );
					if ( i === 0 ) {
						this.ctx.moveTo( px, py );
					} else {
						this.ctx.lineTo( px, py );
					}
				}
				this.ctx.closePath();
			};

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Draw fill
			if ( hasFill ) {
				drawPolygonPath();
				this.ctx.fillStyle = layer.fill;
				this.ctx.globalAlpha = baseOpacity * fillOpacity;
				this.ctx.fill();
			}

			// Draw stroke
			if ( hasStroke ) {
				drawPolygonPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();
			}

			this.ctx.restore();
		}

		// ========================================================================
		// Star
		// ========================================================================

		/**
		 * Draw a star shape
		 *
		 * @param {Object} layer - Layer with star properties (points, x, y, outerRadius, innerRadius)
		 * @param {Object} [options] - Rendering options
		 */
		drawStar( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			const points = layer.points || 5;
			const x = layer.x || 0;
			const y = layer.y || 0;
			const outerRadius = layer.outerRadius || layer.radius || 50;
			const innerRadius = layer.innerRadius || outerRadius * 0.5;
			let strokeW = layer.strokeWidth || 1;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
			}

			this.ctx.save();

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Handle rotation around star center
			if ( typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
				this.ctx.translate( x, y );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				this.ctx.translate( -x, -y );
			}

			// Shadow handling
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
				const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

				// Draw fill shadow
				if ( hasFillForShadow ) {
					const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						ctx.beginPath();
						for ( let i = 0; i < points * 2; i++ ) {
							const angle = ( i * Math.PI ) / points - Math.PI / 2;
							const r = i % 2 === 0 ? outerRadius + spread : innerRadius + spread;
							const px = x + r * Math.cos( angle );
							const py = y + r * Math.sin( angle );
							if ( i === 0 ) {
								ctx.moveTo( px, py );
							} else {
								ctx.lineTo( px, py );
							}
						}
						ctx.closePath();
					}, fillShadowOpacity );
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						ctx.beginPath();
						for ( let i = 0; i < points * 2; i++ ) {
							const angle = ( i * Math.PI ) / points - Math.PI / 2;
							const r = i % 2 === 0 ? outerRadius : innerRadius;
							const px = x + r * Math.cos( angle );
							const py = y + r * Math.sin( angle );
							if ( i === 0 ) {
								ctx.moveTo( px, py );
							} else {
								ctx.lineTo( px, py );
							}
						}
						ctx.closePath();
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			// Helper to draw the star path
			const drawStarPath = () => {
				this.ctx.beginPath();
				for ( let i = 0; i < points * 2; i++ ) {
					const angle = ( i * Math.PI ) / points - Math.PI / 2;
					const r = i % 2 === 0 ? outerRadius : innerRadius;
					const px = x + r * Math.cos( angle );
					const py = y + r * Math.sin( angle );
					if ( i === 0 ) {
						this.ctx.moveTo( px, py );
					} else {
						this.ctx.lineTo( px, py );
					}
				}
				this.ctx.closePath();
			};

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Draw fill
			if ( hasFill ) {
				drawStarPath();
				this.ctx.fillStyle = layer.fill;
				this.ctx.globalAlpha = baseOpacity * fillOpacity;
				this.ctx.fill();
			}

			// Draw stroke
			if ( hasStroke ) {
				drawStarPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();
			}

			this.ctx.restore();
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
		window.Layers.ShapeRenderer = ShapeRenderer;
	}

	// CommonJS for testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = ShapeRenderer;
	}

}() );
