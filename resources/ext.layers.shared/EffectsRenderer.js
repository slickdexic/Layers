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
			/** @private Cached offscreen canvas for blur rendering */
			this._blurCanvas = null;
			/** @private Cached offscreen canvas context */
			this._blurCtx = null;
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
		 * Draw a blur effect using a shape as the clipping region
		 *
		 * This enables blur as a "blend mode" for any shape type.
		 * The shape's geometry defines the blurred region.
		 * Blur acts as a fill effect - stroke should be drawn separately after calling this.
		 *
		 * @param {Object} layer - Layer with shape properties and blurRadius
		 * @param {Function} drawPathFn - Function that draws the shape path (ctx) => void
		 * @param {Object} [options] - Rendering options
		 * @param {boolean} [options.scaled] - Whether coordinates are pre-scaled
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg} for stroke drawing
		 */
		drawBlurWithShape( layer, drawPathFn, options ) {
			const opts = options || {};
			const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );

			if ( !this.canvas ) {
				return;
			}

			this.ctx.save();

			// Apply layer opacity for the blur fill
			if ( typeof layer.opacity === 'number' ) {
				this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}

			// Create the clipping path using the shape
			this.ctx.beginPath();
			drawPathFn( this.ctx );
			this.ctx.clip();

			// We'll use the full canvas for simplicity
			const canvasWidth = this.canvas.width;
			const canvasHeight = this.canvas.height;

			// Reuse cached offscreen canvas to avoid per-frame GPU allocation
			if ( !this._blurCanvas ||
				this._blurCanvas.width !== canvasWidth ||
				this._blurCanvas.height !== canvasHeight ) {
				this._blurCanvas = document.createElement( 'canvas' );
				this._blurCanvas.width = canvasWidth;
				this._blurCanvas.height = canvasHeight;
				this._blurCtx = this._blurCanvas.getContext( '2d' );
			} else {
				this._blurCtx.clearRect( 0, 0, canvasWidth, canvasHeight );
			}
			const tempCanvas = this._blurCanvas;
			const tempCtx = this._blurCtx;

			if ( tempCtx ) {
				try {
					// Capture EVERYTHING currently on the canvas (all layers below)
					tempCtx.drawImage( this.canvas, 0, 0 );

					// Apply blur filter and draw back to main canvas within clip region
					this.ctx.filter = 'blur(' + radius + 'px)';
					this.ctx.drawImage( tempCanvas, 0, 0 );
					this.ctx.filter = 'none';
				} catch ( e ) {
					// CORS or other error - fall back to tinted overlay
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.warn( '[EffectsRenderer] drawBlurFillSimple failed, using fallback:', e.message );
					}
					this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
					this.ctx.beginPath();
					drawPathFn( this.ctx );
					this.ctx.fill();
				}
			}

			this.ctx.restore();

			// Draw stroke AFTER the blur (outside the clipped/saved state)
			// This makes blur act as a fill effect only
			if ( layer.stroke && layer.strokeWidth > 0 ) {
				this.ctx.save();

				// Apply stroke opacity
				if ( typeof layer.strokeOpacity === 'number' ) {
					this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.strokeOpacity ) );
				} else if ( typeof layer.opacity === 'number' ) {
					this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
				}

				const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = ( layer.strokeWidth || 1 ) * scale.avg;

				// Apply stroke style (dashed, dotted, etc.)
				if ( layer.strokeStyle === 'dashed' ) {
					this.ctx.setLineDash( [ 8 * scale.avg, 4 * scale.avg ] );
				} else if ( layer.strokeStyle === 'dotted' ) {
					this.ctx.setLineDash( [ 2 * scale.avg, 2 * scale.avg ] );
				} else {
					this.ctx.setLineDash( [] );
				}

				this.ctx.beginPath();
				drawPathFn( this.ctx );
				this.ctx.stroke();
				this.ctx.restore();
			}
		}

		/**
		 * Check if a layer has blur as its blend mode
		 *
		 * @param {Object} layer - Layer to check
		 * @return {boolean} True if layer uses blur blend mode
		 */
		hasBlurBlendMode( layer ) {
			const blendMode = layer.blendMode || layer.blend;
			return blendMode === 'blur';
		}

		/**
		 * Draw a blur fill within a clipping path
		 *
		 * This is used when shapes have fill='blur' to blur content
		 * within the shape's bounds (respecting corner radii, rotation, etc).
		 *
		 * The blur captures everything currently on the canvas (including other layers)
		 * for a true "frosted glass" effect. Falls back to background image if needed.
		 *
		 * @param {Object} layer - Layer with blur properties
		 * @param {Function} drawPathFn - Function that draws the clipping path (receives ctx)
		 * @param {Object} bounds - Bounding box { x, y, width, height }
		 * @param {Object} [options] - Rendering options
		 * @param {boolean} [options.scaled] - Whether coordinates are pre-scaled (viewer mode)
		 * @param {HTMLImageElement} [options.imageElement] - Image for blur source (viewer mode)
		 */
		drawBlurFill( layer, drawPathFn, bounds, options ) {
			const opts = options || {};
			const x = bounds.x || 0;
			const y = bounds.y || 0;
			const w = bounds.width || 0;
			const h = bounds.height || 0;

			// Log blur fill parameters for troubleshooting (debug only)
			if ( typeof mw !== 'undefined' && mw.config &&
				mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[EffectsRenderer] drawBlurFill called',
					'type:', layer.type,
					'bounds:', x, y, w, h,
					'hasCanvas:', !!this.canvas,
					'hasBackgroundImage:', !!this.backgroundImage,
					'scaled:', !!opts.scaled
				);
			}

			if ( w <= 0 || h <= 0 ) {
				if ( typeof mw !== 'undefined' && mw.config &&
					mw.config.get( 'wgLayersDebug' ) && mw.log ) {
					mw.log( '[EffectsRenderer] drawBlurFill - skipped due to zero dimensions' );
				}
				return;
			}

			// blurRadius should already be scaled in viewer via scaleLayerCoordinates
			const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );

			// Determine if we're in editor mode with zoom/pan
			// In editor mode, layer coordinates need to be transformed to screen coordinates
			const zoom = opts.zoom || 1;
			const panX = opts.panX || 0;
			const panY = opts.panY || 0;
			const isEditorMode = zoom !== 1 || panX !== 0 || panY !== 0;

			// Transform layer coordinates to screen/canvas pixel coordinates for capture
			// Screen coordinate = (layerCoord * zoom) + pan
			let captureX, captureY, captureW, captureH;
			if ( isEditorMode && !opts.scaled ) {
				captureX = ( x * zoom ) + panX;
				captureY = ( y * zoom ) + panY;
				captureW = w * zoom;
				captureH = h * zoom;
			} else {
				captureX = x;
				captureY = y;
				captureW = w;
				captureH = h;
			}

			// Add padding to avoid edge artifacts from blur sampling transparent pixels
			// In editor mode, padding should also be scaled
			const scaledRadius = isEditorMode && !opts.scaled ? radius * zoom : radius;
			const padding = Math.ceil( scaledRadius * 2 );

			// Calculate padded bounds (clamped to canvas)
			const canvasW = this.canvas ? this.canvas.width : ( this.baseWidth || 1 );
			const canvasH = this.canvas ? this.canvas.height : ( this.baseHeight || 1 );
			const paddedX = Math.max( 0, Math.floor( captureX - padding ) );
			const paddedY = Math.max( 0, Math.floor( captureY - padding ) );
			const paddedW = Math.min( canvasW - paddedX, Math.ceil( captureW + padding * 2 ) );
			const paddedH = Math.min( canvasH - paddedY, Math.ceil( captureH + padding * 2 ) );

			// Reuse temp canvas for the blur region (avoids per-frame allocation)
			const reqW = Math.max( 1, paddedW );
			const reqH = Math.max( 1, paddedH );
			if ( !this._blurFillCanvas ) {
				this._blurFillCanvas = document.createElement( 'canvas' );
				this._blurFillCtx = this._blurFillCanvas.getContext( '2d' );
			}
			this._blurFillCanvas.width = reqW;
			this._blurFillCanvas.height = reqH;
			const tempCanvas = this._blurFillCanvas;
			const tempCtx = this._blurFillCtx;

			if ( !tempCtx ) {
				return;
			}

			// Fill with white first to ensure blur works with PNG transparency
			// Without this, transparent areas would blur to transparent pixels
			tempCtx.fillStyle = '#ffffff';
			tempCtx.fillRect( 0, 0, tempCanvas.width, tempCanvas.height );

			// Determine if we're in viewer mode (canvas overlay without background image drawn on it)
			// In viewer mode, the background image is a separate HTML element, so we need to
			// draw from the image source first, then optionally overlay canvas content
			const isViewerMode = opts.scaled || opts.imageElement;
			const imgSource = opts.imageElement || this.backgroundImage;

			let hasContent = false;

			// Step 1: In viewer mode, draw from background image first (since it's not on canvas)
			if ( isViewerMode && imgSource && imgSource.complete ) {
				const imgW = imgSource.naturalWidth || imgSource.width;
				const imgH = imgSource.naturalHeight || imgSource.height;

				// Determine canvas dimensions for coordinate mapping
				let mapCanvasW, mapCanvasH;
				if ( opts.scaled && this.canvas ) {
					mapCanvasW = this.canvas.width;
					mapCanvasH = this.canvas.height;
				} else {
					mapCanvasW = this.baseWidth || canvasW;
					mapCanvasH = this.baseHeight || canvasH;
				}

				// Map canvas coords to image coords
				const imgScaleX = imgW / mapCanvasW;
				const imgScaleY = imgH / mapCanvasH;
				const srcX = Math.max( 0, paddedX * imgScaleX );
				const srcY = Math.max( 0, paddedY * imgScaleY );
				const srcW = Math.min( imgW - srcX, paddedW * imgScaleX );
				const srcH = Math.min( imgH - srcY, paddedH * imgScaleY );

				try {
					tempCtx.drawImage(
						imgSource,
						srcX, srcY, srcW, srcH,
						0, 0, tempCanvas.width, tempCanvas.height
					);
					hasContent = true;
				} catch ( e ) {
					// Image draw failed (CORS) - will try canvas capture below
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.warn( '[EffectsRenderer] Image draw failed (CORS):', e.message );
					}
					hasContent = false;
				}

				// Step 2: Overlay any canvas content (other layers drawn so far)
				// This allows blur to show other annotation layers in the viewer
				if ( this.canvas && this.ctx ) {
					try {
						tempCtx.drawImage(
							this.canvas,
							paddedX, paddedY, paddedW, paddedH,
							0, 0, tempCanvas.width, tempCanvas.height
						);
					} catch ( e ) {
						// Canvas overlay failed - continue with just the image
						if ( typeof mw !== 'undefined' && mw.log ) {
							mw.log.warn( '[EffectsRenderer] Canvas overlay failed:', e.message );
						}
					}
				}
			}

			// Step 3: Editor mode - capture from canvas first (includes background + all layers)
			if ( !hasContent && this.canvas && this.ctx ) {
				try {
					// Capture the current canvas state (everything drawn so far)
					tempCtx.drawImage(
						this.canvas,
						paddedX, paddedY, paddedW, paddedH,
						0, 0, tempCanvas.width, tempCanvas.height
					);
					hasContent = true;
				} catch ( e ) {
					// Canvas capture failed (e.g., tainted canvas)
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.warn( '[EffectsRenderer] Canvas capture failed:', e.message );
					}
					hasContent = false;
				}
			}

			// Step 4: Fallback to background image if editor canvas capture failed
			if ( !hasContent && imgSource && imgSource.complete ) {
				const imgW = imgSource.naturalWidth || imgSource.width;
				const imgH = imgSource.naturalHeight || imgSource.height;
				const mapCanvasW = this.baseWidth || canvasW;
				const mapCanvasH = this.baseHeight || canvasH;
				const imgScaleX = imgW / mapCanvasW;
				const imgScaleY = imgH / mapCanvasH;
				const srcX = Math.max( 0, paddedX * imgScaleX );
				const srcY = Math.max( 0, paddedY * imgScaleY );
				const srcW = Math.min( imgW - srcX, paddedW * imgScaleX );
				const srcH = Math.min( imgH - srcY, paddedH * imgScaleY );

				try {
					tempCtx.drawImage(
						imgSource,
						srcX, srcY, srcW, srcH,
						0, 0, tempCanvas.width, tempCanvas.height
					);
					hasContent = true;
				} catch ( e ) {
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log.warn( '[EffectsRenderer] Background image draw failed:', e.message );
					}
					hasContent = false;
				}
			}

			// Step 5: No content available - show placeholder
			if ( !hasContent ) {
				// Log when falling back to placeholder (debug only)
				if ( typeof mw !== 'undefined' && mw.config &&
					mw.config.get( 'wgLayersDebug' ) && mw.log ) {
					mw.log( '[EffectsRenderer] drawBlurFill - using gray placeholder (no content)' );
				}
				this.ctx.save();
				this.ctx.shadowColor = 'transparent';
				this.ctx.shadowBlur = 0;
				this.ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
				drawPathFn( this.ctx );
				this.ctx.fill();
				this.ctx.restore();
				return;
			}

			// Log successful blur rendering (debug only)
			if ( typeof mw !== 'undefined' && mw.config &&
				mw.config.get( 'wgLayersDebug' ) && mw.log ) {
				mw.log( '[EffectsRenderer] drawBlurFill - drawing blurred content' );
			}

			// Now draw the blurred content clipped to the shape
			this.ctx.save();

			// CRITICAL: Clear any inherited shadow state so blur doesn't look like shadow
			this.ctx.shadowColor = 'transparent';
			this.ctx.shadowBlur = 0;
			this.ctx.shadowOffsetX = 0;
			this.ctx.shadowOffsetY = 0;

			// Create the clipping path (drawn in layer coordinates, transformed by context)
			// IMPORTANT: When clip() is called, the path is transformed by the current
			// matrix and stored in device coordinates. This means we CAN reset the
			// transform afterward and the clip will still work correctly.
			drawPathFn( this.ctx );
			this.ctx.clip();

			// Reset transform to draw at screen coordinates
			// The clip path is already stored in device coords, so this works correctly
			// even for rotated shapes - the clip region remains in the right place
			this.ctx.setTransform( 1, 0, 0, 1, 0, 0 );

			// Apply blur filter and draw the captured content at screen coordinates
			this.ctx.filter = 'blur(' + scaledRadius + 'px)';
			this.ctx.drawImage( tempCanvas, paddedX, paddedY, paddedW, paddedH );
			this.ctx.filter = 'none';

			this.ctx.restore();

			// Release GPU texture memory immediately (don't wait for GC)
			tempCanvas.width = 0;
			tempCanvas.height = 0;
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
