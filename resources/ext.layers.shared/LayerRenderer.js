/**
 * LayerRenderer - Shared rendering engine for Layers extension
 *
 * This module provides a unified rendering implementation used by both:
 * - LayersViewer (read-only article display)
 * - CanvasRenderer/ShapeRenderer (editor)
 *
 * By centralizing rendering logic here, we ensure:
 * 1. Visual consistency between viewer and editor
 * 2. Single source of truth for bug fixes
 * 3. Reduced code duplication (~1,000 lines eliminated)
 *
 * Shadow rendering is delegated to ShadowRenderer for clean separation of concerns.
 *
 * @module LayerRenderer
 * @since 0.9.0
 */
( function () {
	'use strict';

	// Get ShadowRenderer - it should be loaded before this module
	const ShadowRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ShadowRenderer ) ||
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './ShadowRenderer.js' ) : null );

	/**
	 * Clamp a value to a valid opacity range [0, 1]
	 * Uses ShadowRenderer's implementation if available, otherwise local fallback
	 *
	 * @private
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity value (defaults to 1 if invalid)
	 */
	const clampOpacity = ( ShadowRenderer && ShadowRenderer.clampOpacity ) || function ( value ) {
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	};

	/**
	 * LayerRenderer class - Renders individual layer shapes on a canvas
	 */
class LayerRenderer {
	/**
	 * Creates a new LayerRenderer instance
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
	 * @param {Object} [config] - Configuration options
	 * @param {number} [config.zoom=1] - Current zoom level (for editor)
	 * @param {HTMLImageElement} [config.backgroundImage] - Background image for blur effects
	 * @param {HTMLCanvasElement} [config.canvas] - Canvas element reference
	 * @param {number} [config.baseWidth] - Original image width for scaling (viewer mode)
	 * @param {number} [config.baseHeight] - Original image height for scaling (viewer mode)
	 */
	constructor( ctx, config ) {
		this.ctx = ctx;
		this.config = config || {};
		this.zoom = this.config.zoom || 1;
		this.backgroundImage = this.config.backgroundImage || null;
		this.canvas = this.config.canvas || null;
		this.baseWidth = this.config.baseWidth || null;
		this.baseHeight = this.config.baseHeight || null;

		// Create ShadowRenderer instance for shadow operations
		if ( ShadowRenderer ) {
			this.shadowRenderer = new ShadowRenderer( ctx, { canvas: this.canvas } );
		} else {
			this.shadowRenderer = null;
		}
	}

	// ========================================================================
	// Configuration Methods
	// ========================================================================

	/**
	 * Update the zoom level
	 *
	 * @param {number} zoom - New zoom level
	 */
	setZoom( zoom ) {
		this.zoom = zoom;
	}

	/**
	 * Set the background image (used for blur effects)
	 *
	 * @param {HTMLImageElement} img - Background image
	 */
	setBackgroundImage ( img ) {
		this.backgroundImage = img;
	}

	/**
	 * Set the canvas reference
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element
	 */
	setCanvas ( canvas ) {
		this.canvas = canvas;
		if ( this.shadowRenderer ) {
			this.shadowRenderer.setCanvas( canvas );
		}
	}

	/**
	 * Set base dimensions for scaling (viewer mode)
	 *
	 * @param {number} width - Original image width
	 * @param {number} height - Original image height
	 */
	setBaseDimensions ( width, height ) {
		this.baseWidth = width;
		this.baseHeight = height;
	}

	/**
	 * Get current scale factors for viewer mode
	 *
	 * @private
	 * @return {Object} Scale factors {sx, sy, avg}
	 */
	getScaleFactors () {
		if ( !this.baseWidth || !this.baseHeight || !this.canvas ) {
			return { sx: 1, sy: 1, avg: 1 };
		}
		const sx = ( this.canvas.width || 1 ) / this.baseWidth;
		const sy = ( this.canvas.height || 1 ) / this.baseHeight;
		return { sx: sx, sy: sy, avg: ( sx + sy ) / 2 };
	}

	// ========================================================================
	// Shadow Delegation Methods
	// These methods delegate to ShadowRenderer when available, with fallbacks
	// ========================================================================

	/**
	 * Clear shadow settings from context
	 */
	clearShadow () {
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
	 * Apply shadow settings to context (blur and offset only, not spread)
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors from getScaleFactors()
	 */
	applyShadow ( layer, scale ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.applyShadow( layer, scale );
		} else {
			// Fallback implementation
			const scaleX = scale.sx || 1;
			const scaleY = scale.sy || 1;
			const scaleAvg = scale.avg || 1;

			const shadowExplicitlyDisabled = layer.shadow === false ||
				layer.shadow === 'false' ||
				layer.shadow === 0 ||
				layer.shadow === '0';

			const shadowExplicitlyEnabled = layer.shadow === true ||
				layer.shadow === 'true' ||
				layer.shadow === 1 ||
				layer.shadow === '1';

			if ( shadowExplicitlyDisabled ) {
				this.clearShadow();
			} else if ( shadowExplicitlyEnabled ) {
				this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
				this.ctx.shadowBlur = ( typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 8 ) * scaleAvg;
				this.ctx.shadowOffsetX = ( typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 2 ) * scaleX;
				this.ctx.shadowOffsetY = ( typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 2 ) * scaleY;
			} else if ( typeof layer.shadow === 'object' && layer.shadow ) {
				this.ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.4)';
				this.ctx.shadowBlur = ( typeof layer.shadow.blur === 'number' ? layer.shadow.blur : 8 ) * scaleAvg;
				this.ctx.shadowOffsetX = ( typeof layer.shadow.offsetX === 'number' ? layer.shadow.offsetX : 2 ) * scaleX;
				this.ctx.shadowOffsetY = ( typeof layer.shadow.offsetY === 'number' ? layer.shadow.offsetY : 2 ) * scaleY;
			}
		}
	}

	/**
	 * Get shadow spread value from layer
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @return {number} Spread value in pixels (scaled)
	 */
	getShadowSpread ( layer, scale ) {
		if ( this.shadowRenderer ) {
			return this.shadowRenderer.getShadowSpread( layer, scale );
		}
		// Fallback
		const scaleAvg = scale.avg || 1;
		if ( !this.hasShadowEnabled( layer ) ) {
			return 0;
		}
		if ( typeof layer.shadowSpread === 'number' && layer.shadowSpread > 0 ) {
			return layer.shadowSpread * scaleAvg;
		}
		if ( typeof layer.shadow === 'object' && layer.shadow &&
			typeof layer.shadow.spread === 'number' && layer.shadow.spread > 0 ) {
			return layer.shadow.spread * scaleAvg;
		}
		return 0;
	}

	/**
	 * Check if shadow is enabled on a layer
	 *
	 * @param {Object} layer - Layer to check
	 * @return {boolean} True if shadow is enabled
	 */
	hasShadowEnabled ( layer ) {
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
	 * Get shadow parameters for offscreen rendering technique
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @return {Object} Shadow parameters {offsetX, offsetY, blur, color, offscreenOffset}
	 */
	getShadowParams ( layer, scale ) {
		if ( this.shadowRenderer ) {
			return this.shadowRenderer.getShadowParams( layer, scale );
		}
		// Fallback
		const scaleX = scale.sx || 1;
		const scaleY = scale.sy || 1;
		const scaleAvg = scale.avg || 1;
		return {
			offsetX: ( typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 2 ) * scaleX,
			offsetY: ( typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 2 ) * scaleY,
			blur: ( typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 8 ) * scaleAvg,
			color: layer.shadowColor || 'rgba(0,0,0,0.4)',
			offscreenOffset: 10000
		};
	}

	/**
	 * Draw a spread shadow using offscreen canvas technique.
	 * Delegates to ShadowRenderer for the complex offscreen canvas logic.
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} spread - Spread amount in pixels (already scaled)
	 * @param {Function} drawExpandedPathFn - Function that creates the expanded path
	 * @param {number} [opacity=1] - Opacity to apply to the shadow (0-1)
	 */
	drawSpreadShadow ( layer, scale, spread, drawExpandedPathFn, opacity ) {
		if ( this.shadowRenderer ) {
			// ShadowRenderer needs the current context
			this.shadowRenderer.setContext( this.ctx );
			this.shadowRenderer.drawSpreadShadow( layer, scale, spread, drawExpandedPathFn, opacity );
		} else {
			// Fallback: just apply basic shadow
			this.applyShadow( layer, scale );
		}
	}

	/**
	 * Draw a spread shadow for stroked shapes using offscreen canvas.
	 * Delegates to ShadowRenderer for the complex offscreen canvas logic.
	 *
	 * @param {Object} layer - Layer with shadow properties
	 * @param {Object} scale - Scale factors
	 * @param {number} strokeWidth - The expanded stroke width to use
	 * @param {Function} drawPathFn - Function that creates the path
	 * @param {number} [opacity=1] - Opacity to apply to the shadow (0-1)
	 */
	drawSpreadShadowStroke ( layer, scale, strokeWidth, drawPathFn, opacity ) {
		if ( this.shadowRenderer ) {
			// ShadowRenderer needs the current context
			this.shadowRenderer.setContext( this.ctx );
			this.shadowRenderer.drawSpreadShadowStroke( layer, scale, strokeWidth, drawPathFn, opacity );
		} else {
			// Fallback: just apply basic shadow
			this.applyShadow( layer, scale );
		}
	}

	/**
	 * Execute a function with a temporary globalAlpha multiplier
	 *
	 * @param {number|undefined} alpha - Opacity multiplier (0-1)
	 * @param {Function} drawFn - Drawing function to execute
	 */
	withLocalAlpha ( alpha, drawFn ) {
		if ( this.shadowRenderer ) {
			this.shadowRenderer.withLocalAlpha( alpha, drawFn );
		} else {
			// Fallback
			if ( typeof drawFn !== 'function' ) {
				return;
			}
			if ( typeof alpha !== 'number' ) {
				drawFn.call( this );
				return;
			}
			const clampedAlpha = Math.max( 0, Math.min( 1, alpha ) );
			const previousAlpha = this.ctx.globalAlpha;
			this.ctx.globalAlpha = previousAlpha * clampedAlpha;
			try {
				drawFn.call( this );
			} finally {
				this.ctx.globalAlpha = previousAlpha;
			}
		}
	}

	// ========================================================================
	// Shape Drawing Methods
	// ========================================================================

	/**
	 * Draw a rectangle shape
	 *
	 * @param {Object} layer - Layer with rectangle properties
	 * @param {Object} [options] - Rendering options
	 * @param {boolean} [options.scaled=false] - Whether layer coords are pre-scaled
	 */
	drawRectangle ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
		// BUG FIX (2025-12-08): Use separate shadowScale for shadow operations
		// When viewer passes scaled=true, scale={1,1,1} for geometry but shadow needs actual scale
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

		// Shadow handling: use offscreen canvas technique for shadows
		// This ensures stroke shadows are visible even with fill present
		// For spread > 0: shadows are expanded by spread amount
		// For spread === 0: use same technique but without expansion for consistent results
		if ( this.hasShadowEnabled( layer ) ) {
			const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
			const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

			// Draw fill shadow (expanded filled shape if spread > 0) at fill opacity
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
					// spread === 0: use offscreen technique with no expansion
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

			// Draw stroke shadow (as a thick stroke if spread > 0, or regular stroke) at stroke opacity
			// FIX (2025-12-10): Always use offscreen technique for stroke shadow when fill is present
			// This ensures stroke shadow is visible (destination-over approach didn't work)
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

		// Draw actual shape (shadows already handled via offscreen canvas above)
		// FIX (2025-12-10): Shadows are now always drawn using offscreen canvas technique
		// so we don't need native canvas shadow or destination-over compositing here

		// Clear any shadow state from context
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
		// Only consider fill "visible" if it has color AND non-zero opacity
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
	drawRoundedRectPath ( x, y, width, height, radius, context ) {
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

	/**
	 * Draw a circle shape
	 *
	 * @param {Object} layer - Layer with circle properties (x, y center, radius)
	 * @param {Object} [options] - Rendering options
	 */
	drawCircle ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
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

		// Shadow handling: use offscreen canvas technique for shadows
		// FIX (2025-12-10): Always use offscreen technique for consistent results
		if ( this.hasShadowEnabled( layer ) ) {
			const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
			const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

			// Draw fill shadow at fill opacity
			if ( hasFillForShadow ) {
				const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
				const effectiveRadius = spread > 0 ? radius + spread : radius;
				this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
					ctx.beginPath();
					ctx.arc( cx, cy, effectiveRadius, 0, 2 * Math.PI );
				}, fillShadowOpacity );
			}

			// Draw stroke shadow at stroke opacity
			if ( hasStrokeForShadow ) {
				const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
				const effectiveStrokeWidth = spread > 0 ? strokeW + spread * 2 : strokeW;
				this.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( ctx ) => {
					ctx.beginPath();
					ctx.arc( cx, cy, radius, 0, 2 * Math.PI );
				}, strokeShadowOpacity );
			}
		}

		// Draw actual circle (shadows already handled via offscreen canvas above)
		// FIX (2025-12-10): Shadows are now always drawn using offscreen canvas technique
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

	/**
	 * Draw an ellipse shape
	 *
	 * @param {Object} layer - Layer with ellipse properties
	 * @param {Object} [options] - Rendering options
	 */
	drawEllipse ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
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

		// Shadow handling: use offscreen canvas technique for shadows
		// FIX (2025-12-10): Always use offscreen technique for consistent results
		if ( this.hasShadowEnabled( layer ) ) {
			const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
			const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

			// Draw fill shadow at fill opacity
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

			// Draw stroke shadow at stroke opacity
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

		// Draw actual ellipse (shadows already handled via offscreen canvas above)
		// FIX (2025-12-10): Shadows are now always drawn using offscreen canvas technique
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

	/**
	 * Draw a line
	 *
	 * @param {Object} layer - Layer with line properties (x1, y1, x2, y2)
	 * @param {Object} [options] - Rendering options
	 */
	drawLine ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
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

		// If shadow spread > 0, draw thicker shadow line then erase it
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
		// When spread > 0, shadow was already drawn via drawSpreadShadowStroke, so clear it.
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
	 * Build the vertices for an arrow polygon
	 *
	 * @private
	 * @param {number} x1 - Start X
	 * @param {number} y1 - Start Y
	 * @param {number} x2 - End X (tip direction)
	 * @param {number} y2 - End Y
	 * @param {number} angle - Angle of arrow direction
	 * @param {number} perpAngle - Perpendicular angle
	 * @param {number} halfShaft - Half of shaft width
	 * @param {number} arrowSize - Size of arrowhead
	 * @param {string} arrowStyle - 'single', 'double', or 'none'
	 * @param {string} headType - 'pointed', 'chevron', or 'standard'
	 * @param {number} headScale - Scale factor for arrow head size
	 * @param {number} tailWidth - Extra width at tail end
	 * @return {Array} Array of {x, y} vertex objects
	 */
	buildArrowVertices (
		x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth
	) {
		const vertices = [];
		const cos = Math.cos( angle );
		const sin = Math.sin( angle );
		const perpCos = Math.cos( perpAngle );
		const perpSin = Math.sin( perpAngle );

		const effectiveHeadScale = headScale || 1.0;
		const barbAngle = Math.PI / 6;
		const barbLength = arrowSize * 1.56 * effectiveHeadScale;
		const barbWidth = arrowSize * 0.8;
		const chevronDepth = arrowSize * 0.52 * effectiveHeadScale;
		const tailExtra = ( tailWidth || 0 ) / 2;

		if ( arrowStyle === 'none' ) {
			vertices.push( { x: x1 + perpCos * ( halfShaft + tailExtra ), y: y1 + perpSin * ( halfShaft + tailExtra ) } );
			vertices.push( { x: x2 + perpCos * halfShaft, y: y2 + perpSin * halfShaft } );
			vertices.push( { x: x2 - perpCos * halfShaft, y: y2 - perpSin * halfShaft } );
			vertices.push( { x: x1 - perpCos * ( halfShaft + tailExtra ), y: y1 - perpSin * ( halfShaft + tailExtra ) } );
			return vertices;
		}

		const headDepth = arrowSize * 1.3 * effectiveHeadScale;
		const headBaseX = x2 - cos * headDepth;
		const headBaseY = y2 - sin * headDepth;

		const leftBarbAngle = angle - barbAngle;
		const leftBarbCos = Math.cos( leftBarbAngle );
		const leftBarbSin = Math.sin( leftBarbAngle );

		const rightBarbAngle = angle + barbAngle;
		const rightBarbCos = Math.cos( rightBarbAngle );
		const rightBarbSin = Math.sin( rightBarbAngle );

		const barbThickness = halfShaft * 1.5;

		if ( arrowStyle === 'single' ) {
			vertices.push( { x: x1 + perpCos * ( halfShaft + tailExtra ), y: y1 + perpSin * ( halfShaft + tailExtra ) } );

			if ( headType === 'standard' ) {
				const leftOuterX = x2 - barbLength * leftBarbCos;
				const leftOuterY = y2 - barbLength * leftBarbSin;
				const leftInnerX = leftOuterX + barbThickness * leftBarbSin;
				const leftInnerY = leftOuterY - barbThickness * leftBarbCos;
				const leftDx = leftInnerX - headBaseX;
				const leftDy = leftInnerY - headBaseY;
				const leftCurrentDist = leftDx * perpCos + leftDy * perpSin;
				const leftDeltaPerStep = leftBarbCos * perpCos + leftBarbSin * perpSin;
				const leftT = ( halfShaft - leftCurrentDist ) / leftDeltaPerStep;
				const leftShaftX = leftInnerX + leftT * leftBarbCos;
				const leftShaftY = leftInnerY + leftT * leftBarbSin;
				vertices.push( { x: leftShaftX, y: leftShaftY } );
				vertices.push( { x: leftInnerX, y: leftInnerY } );
				vertices.push( { x: leftOuterX, y: leftOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				vertices.push( {
					x: headBaseX - cos * chevronDepth + perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth + perpSin * barbWidth
				} );
			} else {
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				const leftBarbX = x2 - barbLength * leftBarbCos;
				const leftBarbY = y2 - barbLength * leftBarbSin;
				vertices.push( { x: leftBarbX, y: leftBarbY } );
			}

			vertices.push( { x: x2, y: y2 } );

			if ( headType === 'standard' ) {
				const rightOuterX = x2 - barbLength * rightBarbCos;
				const rightOuterY = y2 - barbLength * rightBarbSin;
				const rightInnerX = rightOuterX - barbThickness * rightBarbSin;
				const rightInnerY = rightOuterY + barbThickness * rightBarbCos;
				const rightDx = rightInnerX - headBaseX;
				const rightDy = rightInnerY - headBaseY;
				const rightCurrentDist = rightDx * perpCos + rightDy * perpSin;
				const rightDeltaPerStep = rightBarbCos * perpCos + rightBarbSin * perpSin;
				const rightT = ( -halfShaft - rightCurrentDist ) / rightDeltaPerStep;
				const rightShaftX = rightInnerX + rightT * rightBarbCos;
				const rightShaftY = rightInnerY + rightT * rightBarbSin;
				vertices.push( { x: rightOuterX, y: rightOuterY } );
				vertices.push( { x: rightInnerX, y: rightInnerY } );
				vertices.push( { x: rightShaftX, y: rightShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth - perpSin * barbWidth
				} );
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			} else {
				const rightBarbX = x2 - barbLength * rightBarbCos;
				const rightBarbY = y2 - barbLength * rightBarbSin;
				vertices.push( { x: rightBarbX, y: rightBarbY } );
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			}

			vertices.push( { x: x1 - perpCos * ( halfShaft + tailExtra ), y: y1 - perpSin * ( halfShaft + tailExtra ) } );

		} else if ( arrowStyle === 'double' ) {
			// Double-headed arrow - build both ends
			const tailBaseX = x1 + cos * headDepth;
			const tailBaseY = y1 + sin * headDepth;

			const tailLeftAngle = angle + Math.PI - barbAngle;
			const tailLeftCos = Math.cos( tailLeftAngle );
			const tailLeftSin = Math.sin( tailLeftAngle );

			const tailRightAngle = angle + Math.PI + barbAngle;
			const tailRightCos = Math.cos( tailRightAngle );
			const tailRightSin = Math.sin( tailRightAngle );

			// Tail head (left side)
			if ( headType === 'standard' ) {
				const tailLeftOuterX = x1 + barbLength * tailLeftCos;
				const tailLeftOuterY = y1 + barbLength * tailLeftSin;
				const tailLeftInnerX = tailLeftOuterX + barbThickness * tailLeftSin;
				const tailLeftInnerY = tailLeftOuterY - barbThickness * tailLeftCos;
				const tailLeftDx = tailLeftInnerX - tailBaseX;
				const tailLeftDy = tailLeftInnerY - tailBaseY;
				const tailLeftCurrentDist = tailLeftDx * perpCos + tailLeftDy * perpSin;
				const tailLeftDeltaPerStep = tailLeftCos * perpCos + tailLeftSin * perpSin;
				const tailLeftT = ( halfShaft - tailLeftCurrentDist ) / tailLeftDeltaPerStep;
				const tailLeftShaftX = tailLeftInnerX + tailLeftT * tailLeftCos;
				const tailLeftShaftY = tailLeftInnerY + tailLeftT * tailLeftSin;
				vertices.push( { x: tailLeftShaftX, y: tailLeftShaftY } );
				vertices.push( { x: tailLeftInnerX, y: tailLeftInnerY } );
				vertices.push( { x: tailLeftOuterX, y: tailLeftOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: tailBaseX + cos * chevronDepth + perpCos * barbWidth,
					y: tailBaseY + sin * chevronDepth + perpSin * barbWidth
				} );
			} else {
				const tailLeftBarbX = x1 + barbLength * tailLeftCos;
				const tailLeftBarbY = y1 + barbLength * tailLeftSin;
				vertices.push( { x: tailLeftBarbX, y: tailLeftBarbY } );
			}

			vertices.push( { x: x1, y: y1 } );

			// Tail head (right side)
			if ( headType === 'standard' ) {
				const tailRightOuterX = x1 + barbLength * tailRightCos;
				const tailRightOuterY = y1 + barbLength * tailRightSin;
				const tailRightInnerX = tailRightOuterX - barbThickness * tailRightSin;
				const tailRightInnerY = tailRightOuterY + barbThickness * tailRightCos;
				const tailRightDx = tailRightInnerX - tailBaseX;
				const tailRightDy = tailRightInnerY - tailBaseY;
				const tailRightCurrentDist = tailRightDx * perpCos + tailRightDy * perpSin;
				const tailRightDeltaPerStep = tailRightCos * perpCos + tailRightSin * perpSin;
				const tailRightT = ( -halfShaft - tailRightCurrentDist ) / tailRightDeltaPerStep;
				const tailRightShaftX = tailRightInnerX + tailRightT * tailRightCos;
				const tailRightShaftY = tailRightInnerY + tailRightT * tailRightSin;
				vertices.push( { x: tailRightOuterX, y: tailRightOuterY } );
				vertices.push( { x: tailRightInnerX, y: tailRightInnerY } );
				vertices.push( { x: tailRightShaftX, y: tailRightShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: tailBaseX + cos * chevronDepth - perpCos * barbWidth,
					y: tailBaseY + sin * chevronDepth - perpSin * barbWidth
				} );
				vertices.push( { x: tailBaseX - perpCos * halfShaft, y: tailBaseY - perpSin * halfShaft } );
			} else {
				const tailRightBarbX = x1 + barbLength * tailRightCos;
				const tailRightBarbY = y1 + barbLength * tailRightSin;
				vertices.push( { x: tailRightBarbX, y: tailRightBarbY } );
				vertices.push( { x: tailBaseX - perpCos * halfShaft, y: tailBaseY - perpSin * halfShaft } );
			}

			// Shaft to head
			if ( headType !== 'standard' ) {
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			}

			// Front head (right side)
			if ( headType === 'standard' ) {
				const rightOuterX = x2 - barbLength * rightBarbCos;
				const rightOuterY = y2 - barbLength * rightBarbSin;
				const rightInnerX = rightOuterX - barbThickness * rightBarbSin;
				const rightInnerY = rightOuterY + barbThickness * rightBarbCos;
				const rightDx = rightInnerX - headBaseX;
				const rightDy = rightInnerY - headBaseY;
				const rightCurrentDist = rightDx * perpCos + rightDy * perpSin;
				const rightDeltaPerStep = rightBarbCos * perpCos + rightBarbSin * perpSin;
				const rightT = ( -halfShaft - rightCurrentDist ) / rightDeltaPerStep;
				const rightShaftX = rightInnerX + rightT * rightBarbCos;
				const rightShaftY = rightInnerY + rightT * rightBarbSin;
				vertices.push( { x: rightShaftX, y: rightShaftY } );
				vertices.push( { x: rightInnerX, y: rightInnerY } );
				vertices.push( { x: rightOuterX, y: rightOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth - perpSin * barbWidth
				} );
			} else {
				const rightBarbX = x2 - barbLength * rightBarbCos;
				const rightBarbY = y2 - barbLength * rightBarbSin;
				vertices.push( { x: rightBarbX, y: rightBarbY } );
			}

			vertices.push( { x: x2, y: y2 } );

			// Front head (left side)
			if ( headType === 'standard' ) {
				const leftOuterX = x2 - barbLength * leftBarbCos;
				const leftOuterY = y2 - barbLength * leftBarbSin;
				const leftInnerX = leftOuterX + barbThickness * leftBarbSin;
				const leftInnerY = leftOuterY - barbThickness * leftBarbCos;
				const leftDx = leftInnerX - headBaseX;
				const leftDy = leftInnerY - headBaseY;
				const leftCurrentDist = leftDx * perpCos + leftDy * perpSin;
				const leftDeltaPerStep = leftBarbCos * perpCos + leftBarbSin * perpSin;
				const leftT = ( halfShaft - leftCurrentDist ) / leftDeltaPerStep;
				const leftShaftX = leftInnerX + leftT * leftBarbCos;
				const leftShaftY = leftInnerY + leftT * leftBarbSin;
				vertices.push( { x: leftOuterX, y: leftOuterY } );
				vertices.push( { x: leftInnerX, y: leftInnerY } );
				vertices.push( { x: leftShaftX, y: leftShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth + perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth + perpSin * barbWidth
				} );
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
			} else {
				const leftBarbX = x2 - barbLength * leftBarbCos;
				const leftBarbY = y2 - barbLength * leftBarbSin;
				vertices.push( { x: leftBarbX, y: leftBarbY } );
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
			}

			// Back to tail
			if ( headType !== 'standard' ) {
				vertices.push( { x: tailBaseX + perpCos * halfShaft, y: tailBaseY + perpSin * halfShaft } );
			}
		}

		return vertices;
	}

	/**
	 * Draw an arrow as a closed polygon
	 *
	 * @param {Object} layer - Layer with arrow properties
	 * @param {Object} [options] - Rendering options
	 */
	drawArrow ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
		const shadowScale = opts.shadowScale || scale;

		const x1 = layer.x1 || 0;
		const y1 = layer.y1 || 0;
		const x2 = layer.x2 || 0;
		const y2 = layer.y2 || 0;
		let arrowSize = layer.arrowSize || 15;
		let tailWidth = typeof layer.tailWidth === 'number' ? layer.tailWidth : 0;
		let strokeWidth = layer.strokeWidth || 2;

		if ( !opts.scaled ) {
			arrowSize = arrowSize * scale.avg;
			tailWidth = tailWidth * scale.avg;
			strokeWidth = strokeWidth * scale.avg;
		}

		const arrowStyle = layer.arrowStyle || 'single';
		const headType = layer.arrowHeadType || 'pointed';
		const headScale = typeof layer.headScale === 'number' ? layer.headScale : 1.0;
		const shaftWidth = Math.max( arrowSize * 0.4, strokeWidth * 1.5, 4 );

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

		const angle = Math.atan2( y2 - y1, x2 - x1 );
		const perpAngle = angle + Math.PI / 2;

		// Shadow handling with spread - draw separate shadows for fill and stroke
		if ( spread > 0 && this.hasShadowEnabled( layer ) ) {
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

			// Draw fill shadow at fill opacity
			if ( hasFill ) {
				const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
				const expandedShaftWidth = shaftWidth + spread * 2;
				const expandedArrowSize = arrowSize + spread;
				const expandedVertices = this.buildArrowVertices(
					x1, y1, x2, y2,
					angle, perpAngle, expandedShaftWidth / 2,
					expandedArrowSize, arrowStyle, headType, headScale, tailWidth + spread
				);

				this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
					ctx.beginPath();
					if ( expandedVertices.length > 0 ) {
						ctx.moveTo( expandedVertices[ 0 ].x, expandedVertices[ 0 ].y );
						for ( let i = 1; i < expandedVertices.length; i++ ) {
							ctx.lineTo( expandedVertices[ i ].x, expandedVertices[ i ].y );
						}
						ctx.closePath();
					}
				}, fillShadowOpacity );
			}

			// Draw stroke shadow at stroke opacity
			if ( hasStroke ) {
				const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
				const expandedStrokeWidth = strokeWidth + spread * 2;
				const originalVertices = this.buildArrowVertices(
					x1, y1, x2, y2, angle, perpAngle, shaftWidth / 2,
					arrowSize, arrowStyle, headType, headScale, tailWidth
				);

				this.drawSpreadShadowStroke( layer, shadowScale, expandedStrokeWidth, ( ctx ) => {
					ctx.beginPath();
					if ( originalVertices.length > 0 ) {
						ctx.moveTo( originalVertices[ 0 ].x, originalVertices[ 0 ].y );
						for ( let i = 1; i < originalVertices.length; i++ ) {
							ctx.lineTo( originalVertices[ i ].x, originalVertices[ i ].y );
						}
						ctx.closePath();
					}
				}, strokeShadowOpacity );
			}
		} else if ( this.hasShadowEnabled( layer ) ) {
			this.applyShadow( layer, shadowScale );
		}

		// Draw actual arrow
		// FIX (2025-12-09): Fill and stroke each get shadows based on their own opacity.
		// Stroke shadow is drawn BEHIND the fill using destination-over composite mode.
		if ( spread > 0 ) {
			this.clearShadow();
		}

		const vertices = this.buildArrowVertices(
			x1, y1, x2, y2, angle, perpAngle, shaftWidth / 2,
			arrowSize, arrowStyle, headType, headScale, tailWidth
		);

		// Helper to draw the arrow path
		const drawArrowPath = () => {
			this.ctx.beginPath();
			if ( vertices.length > 0 ) {
				this.ctx.moveTo( vertices[ 0 ].x, vertices[ 0 ].y );
				for ( let i = 1; i < vertices.length; i++ ) {
					this.ctx.lineTo( vertices[ i ].x, vertices[ i ].y );
				}
				this.ctx.closePath();
			}
		};

		const fillOpacity = clampOpacity( layer.fillOpacity );
		const strokeOpacity = clampOpacity( layer.strokeOpacity );
		const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
		const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;
		const shadowEnabled = this.hasShadowEnabled( layer ) && spread === 0;

		// Draw fill (with shadow if enabled and spread === 0)
		if ( hasFill ) {
			// FIX (2025-12-09): Explicitly apply shadow right before fill to ensure it's active
			if ( shadowEnabled ) {
				this.applyShadow( layer, shadowScale );
			}
			drawArrowPath();
			this.ctx.fillStyle = layer.fill;
			this.ctx.globalAlpha = baseOpacity * fillOpacity;
			this.ctx.fill();
		}

		// Clear shadow before stroke only if there was a visible fill
		if ( hasFill ) {
			this.clearShadow();
		}

		// Draw stroke
		if ( hasStroke ) {
			if ( !hasFill && shadowEnabled ) {
				// No fill to go behind, draw stroke with shadow directly
				this.applyShadow( layer, shadowScale );
				drawArrowPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeWidth;
				this.ctx.lineJoin = 'miter';
				this.ctx.miterLimit = 10;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();
			} else {
				// Draw stroke without shadow first
				drawArrowPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeWidth;
				this.ctx.lineJoin = 'miter';
				this.ctx.miterLimit = 10;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();

				// Then draw stroke shadow BEHIND using destination-over
				if ( shadowEnabled ) {
					this.ctx.save();
					this.ctx.globalCompositeOperation = 'destination-over';
					this.applyShadow( layer, shadowScale );
					drawArrowPath();
					this.ctx.strokeStyle = layer.stroke;
					this.ctx.lineWidth = strokeWidth;
					this.ctx.lineJoin = 'miter';
					this.ctx.miterLimit = 10;
					this.ctx.globalAlpha = baseOpacity * strokeOpacity;
					this.ctx.stroke();
					this.ctx.restore();
				}
			}
		}

		this.ctx.restore();
	}

	/**
	 * Draw a regular polygon (e.g., hexagon, pentagon)
	 *
	 * @param {Object} layer - Layer with sides, x, y, radius
	 * @param {Object} [options] - Rendering options
	 */
	drawPolygon ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
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

		// Shadow handling: always use offscreen canvas technique for consistent results
		// FIX (2025-12-11): Use offscreen technique for ALL shadows, not just spread > 0
		if ( this.hasShadowEnabled( layer ) ) {
			const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
			const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

			// Draw fill shadow at fill opacity
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

			// Draw stroke shadow at stroke opacity
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

		// Draw actual polygon (shadows already handled via offscreen canvas above)
		// FIX (2025-12-11): Always use offscreen technique, so just clear shadow state
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

	/**
	 * Draw a star shape
	 *
	 * @param {Object} layer - Layer with points (count), x, y, outerRadius, innerRadius
	 * @param {Object} [options] - Rendering options
	 */
	drawStar ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
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

		// Shadow handling: always use offscreen canvas technique for consistent results
		// FIX (2025-12-11): Use offscreen technique for ALL shadows, not just spread > 0
		if ( this.hasShadowEnabled( layer ) ) {
			const hasFillForShadow = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
			const hasStrokeForShadow = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

			// Draw fill shadow at fill opacity
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

			// Draw stroke shadow at stroke opacity
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

		// Draw actual star (shadows already handled via offscreen canvas above)
		// FIX (2025-12-11): Always use offscreen technique, so just clear shadow state
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
	 * Draw a freehand path
	 *
	 * @param {Object} layer - Layer with points array
	 * @param {Object} [options] - Rendering options
	 */
	drawPath ( layer, options ) {
		if ( !layer.points || !Array.isArray( layer.points ) || layer.points.length < 2 ) {
			return;
		}

		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
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

		// If shadow spread > 0, draw thicker shadow path using offscreen canvas
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
		// When spread > 0, shadow was already drawn via drawSpreadShadowStroke, so clear it.
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
	 * Draw a highlight overlay
	 *
	 * @param {Object} layer - Layer with highlight properties
	 * @param {Object} [options] - Rendering options
	 */
	drawHighlight ( layer ) {
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
	}

	/**
	 * Draw a blur effect region
	 *
	 * @param {Object} layer - Layer with blur properties
	 * @param {Object} [options] - Rendering options
	 * @param {HTMLImageElement} [options.imageElement] - Image for blur source (viewer mode)
	 */
	drawBlur ( layer, options ) {
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

	/**
	 * Draw a text layer
	 *
	 * @param {Object} layer - Layer with text properties
	 * @param {Object} [options] - Rendering options
	 */
	drawText ( layer, options ) {
		const opts = options || {};
		const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
		// BUG FIX (2025-12-09): Use shadowScale for shadow operations, like other shape methods
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

		// Calculate text center for rotation
		const centerX = x + ( textWidth / 2 );
		const centerY = y - ( textHeight / 4 );

		// Apply rotation if present
		if ( layer.rotation && layer.rotation !== 0 ) {
			const rotationRadians = ( layer.rotation * Math.PI ) / 180;
			this.ctx.translate( centerX, centerY );
			this.ctx.rotate( rotationRadians );
			x = -( textWidth / 2 );
			y = textHeight / 4;
		}

		const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
		const spread = this.getShadowSpread( layer, shadowScale );

		// FIX (2025-12-10): Implement spread shadow support for text
		// Use offscreen canvas technique for consistent shadow rendering
		if ( this.hasShadowEnabled( layer ) ) {
			// For text, we need a custom shadow implementation since text rendering is special
			// We'll draw the text multiple times at offset positions to simulate spread
			const sp = this.getShadowParams( layer, shadowScale );
			
			if ( spread > 0 ) {
				// Draw spread shadow by rendering expanded shadow
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
						this.ctx.globalAlpha = 0.1 * baseOpacity; // Low opacity per step
						this.ctx.strokeText( text, x, y );
					}
					
					// Draw fill shadow
					this.ctx.fillStyle = sp.color;
					this.ctx.globalAlpha = 0.1 * baseOpacity; // Low opacity per step
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

	// ========================================================================
	// Dispatcher
	// ========================================================================

	/**
	 * Draw a layer by type (dispatcher method)
	 *
	 * @param {Object} layer - Layer to draw
	 * @param {Object} [options] - Rendering options
	 */
	drawLayer ( layer, options ) {
		switch ( layer.type ) {
			case 'text':
				this.drawText( layer, options );
				break;
			case 'rectangle':
			case 'rect':
				this.drawRectangle( layer, options );
				break;
			case 'circle':
				this.drawCircle( layer, options );
				break;
			case 'ellipse':
				this.drawEllipse( layer, options );
				break;
			case 'polygon':
				this.drawPolygon( layer, options );
				break;
			case 'star':
				this.drawStar( layer, options );
				break;
			case 'line':
				this.drawLine( layer, options );
				break;
			case 'arrow':
				this.drawArrow( layer, options );
				break;
			case 'highlight':
				this.drawHighlight( layer, options );
				break;
			case 'path':
				this.drawPath( layer, options );
				break;
			case 'blur':
				this.drawBlur( layer, options );
				break;
		}
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

	/**
	 * Clean up resources
	 */
	destroy() {
		this.ctx = null;
		this.config = null;
		this.backgroundImage = null;
		this.canvas = null;
		this.baseWidth = null;
		this.baseHeight = null;
	}
}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.LayerRenderer = LayerRenderer;

		// DEPRECATED: Direct window export - use window.Layers.LayerRenderer instead
		// This will be removed in a future version
		window.LayerRenderer = LayerRenderer;
	}

	// CommonJS for testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = LayerRenderer;
	}

}() );
