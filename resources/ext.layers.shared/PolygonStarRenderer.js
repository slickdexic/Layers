/**
 * PolygonStarRenderer - Specialized polygon and star shape rendering
 *
 * Extracted from ShapeRenderer.js to reduce file size and improve maintainability.
 * This module handles rendering of complex polygon shapes:
 * - Polygon (regular n-gons with optional rounded corners)
 * - Star (with customizable points and valley radii)
 *
 * All shapes support:
 * - Fill and stroke with separate opacities
 * - Shadow rendering with spread support
 * - Rotation
 * - Scaling
 * - Rounded corners (via PolygonGeometry)
 *
 * @module PolygonStarRenderer
 * @since 1.1.7
 */
( function () {
	'use strict';

	/**
	 * Get PolygonGeometry class from namespace
	 *
	 * @return {Function|null} PolygonGeometry class or null
	 */
	function getPolygonGeometry() {
		return ( window.Layers && window.Layers.Utils && window.Layers.Utils.PolygonGeometry ) || null;
	}

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
	 * PolygonStarRenderer class - Renders polygon and star shapes on canvas
	 */
	class PolygonStarRenderer {
		/**
		 * Creates a new PolygonStarRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shapeRenderer] - Parent ShapeRenderer for shadow methods
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shapeRenderer = this.config.shapeRenderer || null;
		}

		/**
		 * Set the parent shape renderer for shadow delegation
		 *
		 * @param {Object} shapeRenderer - ShapeRenderer instance
		 */
		setShapeRenderer( shapeRenderer ) {
			this.shapeRenderer = shapeRenderer;
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
		// Shadow Helper Methods (delegate to shapeRenderer)
		// ========================================================================

		/**
		 * Clear shadow settings from context
		 */
		clearShadow() {
			if ( this.shapeRenderer ) {
				this.shapeRenderer.clearShadow();
			} else {
				this.ctx.shadowColor = 'transparent';
				this.ctx.shadowBlur = 0;
				this.ctx.shadowOffsetX = 0;
				this.ctx.shadowOffsetY = 0;
			}
		}

		/**
		 * Check if layer has shadow enabled
		 *
		 * @param {Object} layer - Layer to check
		 * @return {boolean} True if shadow is enabled
		 */
		hasShadowEnabled( layer ) {
			if ( this.shapeRenderer ) {
				return this.shapeRenderer.hasShadowEnabled( layer );
			}
			return layer.shadow === true;
		}

		/**
		 * Get shadow spread value
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @return {number} Shadow spread value
		 */
		getShadowSpread( layer, scale ) {
			if ( this.shapeRenderer ) {
				return this.shapeRenderer.getShadowSpread( layer, scale );
			}
			if ( !layer.shadow ) {
				return 0;
			}
			const spread = layer.shadowSpread || 0;
			const avg = ( scale && scale.avg ) || 1;
			return spread * avg;
		}

		/**
		 * Draw shadow with spread effect for fills
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @param {number} spread - Spread amount
		 * @param {Function} drawPathFn - Function to draw the path
		 * @param {number} opacity - Opacity value
		 */
		drawSpreadShadow( layer, scale, spread, drawPathFn, opacity ) {
			if ( this.shapeRenderer ) {
				this.shapeRenderer.drawSpreadShadow( layer, scale, spread, drawPathFn, opacity );
			}
		}

		/**
		 * Draw shadow with spread effect for strokes
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @param {number} strokeWidth - Expanded stroke width
		 * @param {Function} drawPathFn - Function to draw the path
		 * @param {number} opacity - Opacity value
		 */
		drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity ) {
			if ( this.shapeRenderer ) {
				this.shapeRenderer.drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity );
			}
		}

		// ========================================================================
		// Path Drawing Helpers
		// ========================================================================

		/**
		 * Draw a rounded polygon path on the context
		 *
		 * Uses arcTo for smooth rounded corners at each vertex.
		 *
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points
		 * @param {number} cornerRadius - Radius for rounded corners
		 */
		drawRoundedPolygonPath( vertices, cornerRadius ) {
			if ( !vertices || vertices.length < 3 ) {
				return;
			}
			const n = vertices.length;
			this.ctx.beginPath();

			// Start at midpoint of edge from vertex 0 to vertex 1
			// This ensures we're not near any corner
			this.ctx.moveTo(
				( vertices[ 0 ].x + vertices[ 1 ].x ) / 2,
				( vertices[ 0 ].y + vertices[ 1 ].y ) / 2
			);

			// Arc around vertices 1, 2, ..., n-1
			for ( let i = 1; i < n; i++ ) {
				const curr = vertices[ i ];
				const next = vertices[ ( i + 1 ) % n ];
				if ( cornerRadius > 0 ) {
					this.ctx.arcTo( curr.x, curr.y, next.x, next.y, cornerRadius );
				} else {
					this.ctx.lineTo( curr.x, curr.y );
				}
			}

			// Arc around vertex 0
			if ( cornerRadius > 0 ) {
				this.ctx.arcTo( vertices[ 0 ].x, vertices[ 0 ].y, vertices[ 1 ].x, vertices[ 1 ].y, cornerRadius );
			} else {
				this.ctx.lineTo( vertices[ 0 ].x, vertices[ 0 ].y );
			}

			// Close path - connects back to our starting midpoint
			this.ctx.closePath();
		}

		/**
		 * Draw a rounded star path on the context with different radii for points and valleys
		 *
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points (alternating outer/inner)
		 * @param {number} pointRadius - Radius for outer point corners
		 * @param {number} valleyRadius - Radius for inner valley corners
		 */
		drawRoundedStarPath( vertices, pointRadius, valleyRadius ) {
			if ( !vertices || vertices.length < 3 ) {
				return;
			}
			const n = vertices.length;
			this.ctx.beginPath();

			// Helper to get radius for a vertex (even = point, odd = valley)
			const getRadius = ( i ) => ( i % 2 === 0 ? pointRadius : valleyRadius );

			// Start at midpoint of edge from vertex 0 to vertex 1
			// This ensures we're not near any corner
			this.ctx.moveTo(
				( vertices[ 0 ].x + vertices[ 1 ].x ) / 2,
				( vertices[ 0 ].y + vertices[ 1 ].y ) / 2
			);

			// Arc around vertices 1, 2, ..., n-1
			for ( let i = 1; i < n; i++ ) {
				const curr = vertices[ i ];
				const next = vertices[ ( i + 1 ) % n ];
				const r = getRadius( i );
				if ( r > 0 ) {
					this.ctx.arcTo( curr.x, curr.y, next.x, next.y, r );
				} else {
					this.ctx.lineTo( curr.x, curr.y );
				}
			}

			// Arc around vertex 0
			const r0 = getRadius( 0 );
			if ( r0 > 0 ) {
				this.ctx.arcTo( vertices[ 0 ].x, vertices[ 0 ].y, vertices[ 1 ].x, vertices[ 1 ].y, r0 );
			} else {
				this.ctx.lineTo( vertices[ 0 ].x, vertices[ 0 ].y );
			}

			// Close path - connects back to our starting midpoint
			this.ctx.closePath();
		}

		// ========================================================================
		// Polygon
		// ========================================================================

		/**
		 * Draw a regular polygon shape
		 *
		 * @param {Object} layer - Layer with polygon properties (sides, x, y, radius, cornerRadius)
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
		 */
		drawPolygon( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			const sides = layer.sides || 6;
			const x = layer.x || 0;
			const y = layer.y || 0;
			const radius = layer.radius || 50;
			const cornerRadius = layer.cornerRadius || 0;
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
					const PolygonGeometryShadow = getPolygonGeometry();
					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						if ( PolygonGeometryShadow && cornerRadius > 0 ) {
							PolygonGeometryShadow.drawPolygonPath( ctx, x, y, effectiveRadius, sides, cornerRadius );
						} else {
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
						}
					}, fillShadowOpacity );
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					const PolygonGeometryStroke = getPolygonGeometry();
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						if ( PolygonGeometryStroke && cornerRadius > 0 ) {
							PolygonGeometryStroke.drawPolygonPath( ctx, x, y, radius, sides, cornerRadius );
						} else {
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
						}
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			// Helper to draw the polygon path - use PolygonGeometry if available
			const PolygonGeometry = getPolygonGeometry();
			const drawPolygonPath = () => {
				if ( PolygonGeometry ) {
					PolygonGeometry.drawPolygonPath( this.ctx, x, y, radius, sides, cornerRadius );
				} else if ( cornerRadius > 0 ) {
					// Fallback with rounded corners
					const vertices = [];
					for ( let i = 0; i < sides; i++ ) {
						const angle = ( i * 2 * Math.PI ) / sides - Math.PI / 2;
						vertices.push( {
							x: x + radius * Math.cos( angle ),
							y: y + radius * Math.sin( angle )
						} );
					}
					this.drawRoundedPolygonPath( vertices, cornerRadius );
				} else {
					// Fallback inline implementation
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
				}
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
		 * @param {Object} layer - Layer with star properties (points, x, y, outerRadius, innerRadius, pointRadius, valleyRadius)
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
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
			const pointRadius = layer.pointRadius || 0;
			const valleyRadius = layer.valleyRadius || 0;
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
					const PolygonGeometryShadow = getPolygonGeometry();
					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						const effectiveOuter = outerRadius + spread;
						const effectiveInner = innerRadius + spread;
						if ( PolygonGeometryShadow && ( pointRadius > 0 || valleyRadius > 0 ) ) {
							PolygonGeometryShadow.drawStarPath( ctx, x, y, effectiveOuter, effectiveInner, points, pointRadius, valleyRadius );
						} else {
							ctx.beginPath();
							for ( let i = 0; i < points * 2; i++ ) {
								const angle = ( i * Math.PI ) / points - Math.PI / 2;
								const r = i % 2 === 0 ? effectiveOuter : effectiveInner;
								const px = x + r * Math.cos( angle );
								const py = y + r * Math.sin( angle );
								if ( i === 0 ) {
									ctx.moveTo( px, py );
								} else {
									ctx.lineTo( px, py );
								}
							}
							ctx.closePath();
						}
					}, fillShadowOpacity );
				}

				// Draw stroke shadow
				if ( hasStrokeForShadow ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
					const PolygonGeometryStroke = getPolygonGeometry();
					this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
						if ( PolygonGeometryStroke && ( pointRadius > 0 || valleyRadius > 0 ) ) {
							PolygonGeometryStroke.drawStarPath( ctx, x, y, outerRadius, innerRadius, points, pointRadius, valleyRadius );
						} else {
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
						}
					}, strokeShadowOpacity );
				}
			}

			// Clear shadow state
			this.clearShadow();

			// Helper to draw the star path - use PolygonGeometry if available
			const PolygonGeometry = getPolygonGeometry();
			const drawStarPath = () => {
				if ( PolygonGeometry ) {
					PolygonGeometry.drawStarPath( this.ctx, x, y, outerRadius, innerRadius, points, pointRadius, valleyRadius );
				} else if ( pointRadius > 0 || valleyRadius > 0 ) {
					// Fallback with rounded corners
					const vertices = [];
					for ( let i = 0; i < points * 2; i++ ) {
						const angle = ( i * Math.PI ) / points - Math.PI / 2;
						const r = i % 2 === 0 ? outerRadius : innerRadius;
						vertices.push( {
							x: x + r * Math.cos( angle ),
							y: y + r * Math.sin( angle )
						} );
					}
					this.drawRoundedStarPath( vertices, pointRadius, valleyRadius );
				} else {
					// Fallback inline implementation
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
				}
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
			this.shapeRenderer = null;
		}
	}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.PolygonStarRenderer = PolygonStarRenderer;
	}

	// CommonJS for testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = PolygonStarRenderer;
	}

}() );
