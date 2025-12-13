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

	// Get ArrowRenderer - it should be loaded before this module
	const ArrowRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ArrowRenderer ) ||
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './ArrowRenderer.js' ) : null );

	// Get TextRenderer - it should be loaded before this module
	const TextRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.TextRenderer ) ||
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './TextRenderer.js' ) : null );

	// Get ShapeRenderer - it should be loaded before this module
	const ShapeRenderer = ( typeof window !== 'undefined' && window.Layers && window.Layers.ShapeRenderer ) ||
		// eslint-disable-next-line no-undef
		( typeof require !== 'undefined' ? require( './ShapeRenderer.js' ) : null );

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

		// Create ArrowRenderer instance for arrow shape operations
		if ( ArrowRenderer ) {
			this.arrowRenderer = new ArrowRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
		} else {
			this.arrowRenderer = null;
		}

		// Create TextRenderer instance for text shape operations
		if ( TextRenderer ) {
			this.textRenderer = new TextRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
		} else {
			this.textRenderer = null;
		}

		// Create ShapeRenderer instance for basic shape operations
		if ( ShapeRenderer ) {
			this.shapeRenderer = new ShapeRenderer( ctx, { shadowRenderer: this.shadowRenderer } );
		} else {
			this.shapeRenderer = null;
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
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with rectangle properties
	 * @param {Object} [options] - Rendering options
	 * @param {boolean} [options.scaled=false] - Whether layer coords are pre-scaled
	 */
	drawRectangle ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawRectangle( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a circle shape
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with circle properties (x, y center, radius)
	 * @param {Object} [options] - Rendering options
	 */
	drawCircle ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawCircle( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw an ellipse shape
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with ellipse properties
	 * @param {Object} [options] - Rendering options
	 */
	drawEllipse ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawEllipse( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a line
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with line properties (x1, y1, x2, y2)
	 * @param {Object} [options] - Rendering options
	 */
	drawLine ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawLine( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Build the vertices for an arrow polygon
	 * Delegates to ArrowRenderer for the actual vertex calculation.
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
		if ( this.arrowRenderer ) {
			return this.arrowRenderer.buildArrowVertices(
				x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth
			);
		}
		// Fallback: return empty array if ArrowRenderer not available
		return [];
	}

	/**
	 * Draw an arrow as a closed polygon
	 * Delegates to ArrowRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with arrow properties
	 * @param {Object} [options] - Rendering options
	 */
	drawArrow ( layer, options ) {
		if ( this.arrowRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.arrowRenderer.setContext( this.ctx );
			this.arrowRenderer.draw( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a regular polygon (e.g., hexagon, pentagon)
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with sides, x, y, radius
	 * @param {Object} [options] - Rendering options
	 */
	drawPolygon ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawPolygon( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a star shape
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with points (count), x, y, outerRadius, innerRadius
	 * @param {Object} [options] - Rendering options
	 */
	drawStar ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawStar( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
	}

	/**
	 * Draw a freehand path
	 * Delegates to ShapeRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with points array
	 * @param {Object} [options] - Rendering options
	 */
	drawPath ( layer, options ) {
		if ( this.shapeRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.shapeRenderer.setContext( this.ctx );
			this.shapeRenderer.drawPath( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
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
	 * Delegates to TextRenderer for the actual drawing.
	 *
	 * @param {Object} layer - Layer with text properties
	 * @param {Object} [options] - Rendering options
	 */
	drawText ( layer, options ) {
		if ( this.textRenderer ) {
			const opts = options || {};
			const scale = opts.scaled ? { sx: 1, sy: 1, avg: 1 } : this.getScaleFactors();
			const shadowScale = opts.shadowScale || scale;
			this.textRenderer.setContext( this.ctx );
			this.textRenderer.draw( layer, {
				scale: scale,
				shadowScale: shadowScale,
				scaled: opts.scaled
			} );
		}
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
	}

	// CommonJS for testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		// eslint-disable-next-line no-undef
		module.exports = LayerRenderer;
	}

}() );
