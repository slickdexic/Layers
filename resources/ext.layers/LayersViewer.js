/**
 * Layers Viewer - Displays images with layers in articles
 * Lightweight viewer for non-editing contexts
 *
 * This module uses the shared LayerRenderer for consistent rendering
 * with the editor.
 *
 * @module LayersViewer
 */
( function () {
	'use strict';

	// Get the shared LayerRenderer from the Layers namespace
	const LayerRenderer = ( window.Layers && window.Layers.LayerRenderer ) || window.LayerRenderer;

	// Get the shared LayerDataNormalizer for consistent data handling
	const LayerDataNormalizer = ( window.Layers && window.Layers.LayerDataNormalizer ) || window.LayerDataNormalizer;

	/**
	 * LayersViewer class - Renders layer annotations on images in article view
	 *
	 * @class
	 */
	class LayersViewer {
		/**
		 * Create a LayersViewer instance
		 *
		 * @param {Object} config Configuration object
		 * @param {HTMLElement} config.container The container element for the viewer.
		 * @param {HTMLImageElement} config.imageElement The image element to overlay.
		 * @param {Object} config.layerData The layer data to render.
		 */
		constructor( config ) {
			this.config = config || {};
			this.container = this.config.container;
			this.imageElement = this.config.imageElement;
			this.layerData = this.config.layerData || [];
			this.baseWidth = ( this.layerData && this.layerData.baseWidth ) || null;
			this.baseHeight = ( this.layerData && this.layerData.baseHeight ) || null;
			this.canvas = null;
			this.ctx = null;
			this.renderer = null; // Shared LayerRenderer instance
			this.resizeObserver = null;
			this.rAFId = null;
			this.boundWindowResize = null;
			// Store original image styles for restoration on destroy
			this.originalImageVisibility = null;
			this.originalImageOpacity = null;

			this.init();
		}

		/**
		 * Initialize the viewer
		 */
		init() {
			if ( !this.container || !this.imageElement ) {
				return;
			}

			// Normalize layer data using the shared utility
			// This ensures boolean properties are correctly typed for rendering
			this.normalizeLayerData();

			this.applyBackgroundSettings();
			this.createCanvas();
			this.loadImageAndRender();
		}

		/**
		 * Normalize layer data to ensure consistent types
		 * Uses the shared LayerDataNormalizer for consistency with the editor
		 */
		normalizeLayerData() {
			if ( !this.layerData ) {
				return;
			}

			// Use the shared normalizer if available
			if ( LayerDataNormalizer && typeof LayerDataNormalizer.normalizeLayerData === 'function' ) {
				LayerDataNormalizer.normalizeLayerData( this.layerData );
			} else {
				// Fallback for testing environments where the shared module may not be loaded
				this.fallbackNormalize();
			}
		}

		/**
		 * Fallback normalization for when shared module is not available
		 * @private
		 */
		fallbackNormalize() {
			if ( !this.layerData || !this.layerData.layers ) {
				return;
			}

			const booleanProps = [ 'shadow', 'textShadow', 'glow', 'visible', 'locked', 'preserveAspectRatio' ];

			this.layerData.layers.forEach( ( layer ) => {
				// Normalize boolean properties
				booleanProps.forEach( ( prop ) => {
					const val = layer[ prop ];
					if ( val === '0' || val === 'false' || val === 0 ) {
						layer[ prop ] = false;
					} else if ( val === '' || val === '1' || val === 'true' || val === 1 ) {
						layer[ prop ] = true;
					}
				} );

				// Normalize blend mode alias (server stores blendMode, client uses blend)
				if ( layer.blendMode !== undefined && layer.blend === undefined ) {
					layer.blend = layer.blendMode;
				}
				if ( layer.blend !== undefined && layer.blendMode === undefined ) {
					layer.blendMode = layer.blend;
				}
			} );
		}

		/**
		 * Apply background visibility and opacity settings to the image element
		 */
		applyBackgroundSettings() {
			if ( !this.imageElement ) {
				return;
			}

			// Ensure the image element has a style object (may be missing in tests)
			if ( !this.imageElement.style ) {
				return;
			}

			// Store original styles for restoration on destroy (only once)
			if ( this.originalImageVisibility === null ) {
				this.originalImageVisibility = this.imageElement.style.visibility || '';
				this.originalImageOpacity = this.imageElement.style.opacity || '';
			}

			// If no layer data, ensure image is visible (fail-safe)
			if ( !this.layerData ) {
				this.imageElement.style.visibility = 'visible';
				this.imageElement.style.opacity = '1';
				return;
			}

			// Apply background visibility (default: true/visible)
			// Handle all possible representations from API (boolean, integer, string)
			const bgVisible = this.layerData.backgroundVisible;
			
			// Background should be hidden ONLY if explicitly set to a falsy representation
			// Default behavior (undefined/null/missing) is to show the background
			const isHidden = bgVisible === false || bgVisible === 0 || bgVisible === '0' || bgVisible === 'false';
			
			// Apply background opacity (default: 1.0)
			let bgOpacity = 1.0;
			const rawOpacity = this.layerData.backgroundOpacity;
			if ( typeof rawOpacity === 'number' && rawOpacity >= 0 && rawOpacity <= 1 ) {
				bgOpacity = rawOpacity;
			} else if ( typeof rawOpacity === 'string' ) {
				const parsed = parseFloat( rawOpacity );
				if ( !isNaN( parsed ) && parsed >= 0 && parsed <= 1 ) {
					bgOpacity = parsed;
				}
			}

			// Apply visibility and opacity settings
			if ( isHidden ) {
				// Hide the background image completely
				this.imageElement.style.visibility = 'hidden';
				this.imageElement.style.opacity = '0';
			} else {
				// Show the image with configured opacity
				// Explicitly set to 'visible' to override any CSS that might hide it
				this.imageElement.style.visibility = 'visible';
				this.imageElement.style.opacity = String( bgOpacity );
			}
		}

		/**
		 * Create the canvas overlay element
		 */
		createCanvas() {
			// Create canvas overlay
			this.canvas = document.createElement( 'canvas' );
			this.canvas.className = 'layers-viewer-canvas';
			this.canvas.style.position = 'absolute';
			this.canvas.style.top = '0';
			this.canvas.style.left = '0';
			this.canvas.style.pointerEvents = 'none';
			this.canvas.style.zIndex = '1000';

			this.ctx = this.canvas.getContext( '2d' );

			// Initialize shared LayerRenderer with image load callback
			// This ensures image layers trigger a redraw when their base64 data loads
			this.renderer = new LayerRenderer( this.ctx, {
				canvas: this.canvas,
				baseWidth: this.baseWidth,
				baseHeight: this.baseHeight,
				onImageLoad: () => {
					if ( typeof mw !== 'undefined' && mw.log ) {
						mw.log( '[LayersViewer] onImageLoad callback triggered, calling renderLayers()' );
					}
					this.renderLayers();
				}
			} );

			// Make container relative positioned
			if ( getComputedStyle( this.container ).position === 'static' ) {
				this.container.style.position = 'relative';
			}

			this.container.appendChild( this.canvas );
		}

		/**
		 * Load the image and set up resize observers
		 */
		loadImageAndRender() {
			// Ensure background settings are applied when image loads
			// This handles cases where image visibility might be affected by loading state
			const applySettingsAndRender = () => {
				// Re-apply background settings to ensure visibility is correct
				// This is needed because some browsers/MediaWiki versions may
				// reset styles during image load
				this.applyBackgroundSettings();
				this.resizeCanvasAndRender();
			};

			// Wait for image to load if not already loaded
			if ( this.imageElement.complete && this.imageElement.naturalWidth > 0 ) {
				applySettingsAndRender();
			} else {
				this.imageElement.addEventListener( 'load', () => {
					applySettingsAndRender();
				} );
			}

			// Re-render on window resize to keep overlay aligned
			this.boundWindowResize = () => {
				this.scheduleResize();
			};
			window.addEventListener( 'resize', this.boundWindowResize );

			// Re-render when the image element's box size changes (responsive layout, thumb swaps)
			if ( typeof window.ResizeObserver === 'function' ) {
				try {
					this.resizeObserver = new window.ResizeObserver( () => {
						this.scheduleResize();
					} );
					this.resizeObserver.observe( this.imageElement );
				} catch ( e ) {
					if ( window.mw && window.mw.log ) {
						mw.log.warn( '[LayersViewer] ResizeObserver setup failed:', e.message );
					}
				}
			}
		}

		/**
		 * Schedule a resize using requestAnimationFrame to debounce
		 */
		scheduleResize() {
			if ( this.rAFId ) {
				return;
			}
			this.rAFId = window.requestAnimationFrame( () => {
				this.rAFId = null;
				this.resizeCanvasAndRender();
			} );
		}

		/**
		 * Clean up the viewer and release resources
		 */
		destroy() {
			if ( this.resizeObserver && typeof this.resizeObserver.disconnect === 'function' ) {
				try {
					this.resizeObserver.disconnect();
				} catch ( e ) {
					if ( window.mw && window.mw.log ) {
						mw.log.warn( '[LayersViewer] ResizeObserver disconnect failed:', e.message );
					}
				}
			}
			if ( this.boundWindowResize ) {
				window.removeEventListener( 'resize', this.boundWindowResize );
				this.boundWindowResize = null;
			}
			if ( this.rAFId ) {
				try {
					window.cancelAnimationFrame( this.rAFId );
				} catch ( cancelError ) {
					mw.log.warn( '[LayersViewer] cancelAnimationFrame failed:', cancelError.message );
				}
				this.rAFId = null;
			}
			if ( this.renderer ) {
				this.renderer.destroy();
				this.renderer = null;
			}
			// Restore original image visibility/opacity before removing canvas
			// This prevents the image from staying hidden when viewer is reinitialized
			if ( this.imageElement && this.imageElement.style ) {
				if ( this.originalImageVisibility !== null ) {
					this.imageElement.style.visibility = this.originalImageVisibility;
				}
				if ( this.originalImageOpacity !== null ) {
					this.imageElement.style.opacity = this.originalImageOpacity;
				}
			}
			// Remove the canvas from the DOM to prevent duplicate overlays
			// when viewer is reinitialized with fresh data (FR-10)
			if ( this.canvas && this.canvas.parentNode ) {
				this.canvas.parentNode.removeChild( this.canvas );
			}
			this.canvas = null;
			this.ctx = null;
		}

		/**
		 * Resize the canvas to match the image and re-render
		 */
		resizeCanvasAndRender() {
			// Set canvas pixel size to MATCH the displayed image size for crisp alignment
			let displayW = this.imageElement.offsetWidth;
			let displayH = this.imageElement.offsetHeight;
			if ( !displayW || !displayH ) {
				// Fallback to natural dimensions when offsets are 0 (e.g., image hidden)
				displayW = this.imageElement.naturalWidth || this.imageElement.width || 0;
				displayH = this.imageElement.naturalHeight || this.imageElement.height || 0;
			}

			this.canvas.width = displayW;
			this.canvas.height = displayH;

			// Ensure CSS size matches exactly
			this.canvas.style.width = displayW + 'px';
			this.canvas.style.height = displayH + 'px';

			// Update renderer with current canvas reference
			if ( this.renderer ) {
				this.renderer.setCanvas( this.canvas );
				this.renderer.setBaseDimensions( this.baseWidth, this.baseHeight );
				this.renderer.setBackgroundImage( this.imageElement );
			}

			this.renderLayers();
		}

		/**
		 * Render all layers onto the canvas
		 */
		renderLayers() {
			if ( !this.layerData || !this.layerData.layers ) {
				return;
			}

			// Clear canvas
			this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

			const layers = Array.isArray( this.layerData.layers ) ? this.layerData.layers : [];

			// Check if any layer uses a non-default blend mode
			// Blend modes only work when blending with content on the canvas, not DOM elements
			// So we need to draw the background image onto the canvas for blend to work
			const hasBlendMode = layers.some( ( layer ) => {
				const blend = layer.blend || layer.blendMode;
				return blend && blend !== 'normal' && blend !== 'source-over';
			} );

			if ( hasBlendMode ) {
				// Draw background image onto canvas so blend modes work
				this.drawBackgroundOnCanvas();
			}

			// Render layers from bottom to top so top-most (index 0 in editor) is drawn last.
			for ( let i = layers.length - 1; i >= 0; i-- ) {
				const layer = layers[ i ];
				this.renderLayer( layer );
			}
		}

		/**
		 * Draw the background image onto the canvas
		 * Required for blend modes to work (they blend with canvas content, not DOM)
		 * @private
		 */
		drawBackgroundOnCanvas() {
			if ( !this.imageElement || !this.ctx ) {
				return;
			}

			// Get background settings
			const bgVisible = this.layerData ? this.layerData.backgroundVisible : true;
			const isHidden = bgVisible === false || bgVisible === 'false' || bgVisible === '0' || bgVisible === 0;

			if ( isHidden ) {
				// Even when hidden, fill with white so blend modes have something to blend with
				this.ctx.fillStyle = '#ffffff';
				this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );
				return;
			}

			// Apply background opacity
			let bgOpacity = 1.0;
			if ( this.layerData && this.layerData.backgroundOpacity !== undefined ) {
				const rawOpacity = this.layerData.backgroundOpacity;
				if ( typeof rawOpacity === 'number' && rawOpacity >= 0 && rawOpacity <= 1 ) {
					bgOpacity = rawOpacity;
				} else if ( typeof rawOpacity === 'string' ) {
					const parsed = parseFloat( rawOpacity );
					if ( !isNaN( parsed ) && parsed >= 0 && parsed <= 1 ) {
						bgOpacity = parsed;
					}
				}
			}

			// Always fill with white first to ensure consistent rendering with the editor.
			// PNG images with transparency would otherwise blend with transparent pixels,
			// producing different results than the editor (which uses a white canvas).
			// This ensures blend modes like 'exclusion' look identical in editor and viewer.
			this.ctx.fillStyle = '#ffffff';
			this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );

			this.ctx.save();
			this.ctx.globalAlpha = bgOpacity;
			this.ctx.drawImage( this.imageElement, 0, 0, this.canvas.width, this.canvas.height );
			this.ctx.restore();

			// Hide the DOM image element since we're drawing it on canvas
			// This prevents double-rendering
			if ( this.imageElement.style ) {
				this.imageElement.style.visibility = 'hidden';
			}
		}

		/**
		 * Render a single layer
		 *
		 * @param {Object} layer - Layer data object
		 */
		renderLayer( layer ) {
			// Skip invisible layers
			if ( layer.visible === false || layer.visible === 'false' || layer.visible === '0' || layer.visible === 0 ) {
				return;
			}

			// Compute scaling from saved coordinates to current canvas size
			let sx = 1;
			let sy = 1;
			let scaleAvg = 1;
			if ( this.baseWidth && this.baseHeight ) {
				sx = ( this.canvas.width || 1 ) / this.baseWidth;
				sy = ( this.canvas.height || 1 ) / this.baseHeight;
				scaleAvg = ( sx + sy ) / 2;
			}

			// Create a shallow copy and scale known coords for viewer
			let L = layer;
			if ( this.baseWidth && this.baseHeight ) {
				L = this.scaleLayerCoordinates( layer, sx, sy, scaleAvg );
			}

			// Apply per-layer effects (opacity, blend, shadow) at the context level
			this.ctx.save();
			if ( typeof layer.opacity === 'number' ) {
				this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}
			// Check both blend and blendMode for robustness (server stores blendMode)
			const blendMode = layer.blend || layer.blendMode;
			if ( blendMode ) {
				try {
					this.ctx.globalCompositeOperation = String( blendMode );
				} catch ( e ) {
					if ( window.mw && window.mw.log ) {
						mw.log.warn( '[LayersViewer] Unsupported blend mode: ' + blendMode );
					}
				}
			}

			// Apply shadow at the context level (matching editor behavior)
			// This ensures ALL layer types (including image) get shadows applied
			const shadowScale = { sx: sx, sy: sy, avg: scaleAvg };
			if ( this.renderer && this.renderer.hasShadowEnabled( layer ) ) {
				this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
				this.ctx.shadowBlur = Math.round( ( layer.shadowBlur || 8 ) * scaleAvg );
				this.ctx.shadowOffsetX = Math.round( ( layer.shadowOffsetX || 2 ) * sx );
				this.ctx.shadowOffsetY = Math.round( ( layer.shadowOffsetY || 2 ) * sy );
			} else {
				this.ctx.shadowColor = 'transparent';
				this.ctx.shadowBlur = 0;
				this.ctx.shadowOffsetX = 0;
				this.ctx.shadowOffsetY = 0;
			}

			// Delegate rendering to the shared LayerRenderer
			// Using scaled=true since we pre-scaled the coordinates
			// shadowScale passed for any shape-specific shadow handling
			this.renderer.drawLayer( L, { scaled: true, imageElement: this.imageElement, shadowScale: shadowScale } );

			// Restore to pre-layer state
			this.ctx.restore();
		}

		/**
		 * Scale layer coordinates for display at current canvas size
		 *
		 * @private
		 * @param {Object} layer - Original layer data
		 * @param {number} sx - X scale factor
		 * @param {number} sy - Y scale factor
		 * @param {number} scaleAvg - Average scale factor
		 * @return {Object} Scaled layer copy
		 */
		scaleLayerCoordinates( layer, sx, sy, scaleAvg ) {
			const L = {};
			for ( const k in layer ) {
				if ( Object.prototype.hasOwnProperty.call( layer, k ) ) {
					L[ k ] = layer[ k ];
				}
			}
			if ( typeof L.x === 'number' ) {
				L.x = L.x * sx;
			}
			if ( typeof L.y === 'number' ) {
				L.y = L.y * sy;
			}
			if ( typeof L.width === 'number' ) {
				L.width = L.width * sx;
			}
			if ( typeof L.height === 'number' ) {
				L.height = L.height * sy;
			}
			if ( typeof L.radius === 'number' ) {
				L.radius = L.radius * scaleAvg;
			}
			if ( typeof L.outerRadius === 'number' ) {
				L.outerRadius = L.outerRadius * scaleAvg;
			}
			if ( typeof L.innerRadius === 'number' ) {
				L.innerRadius = L.innerRadius * scaleAvg;
			}
			if ( typeof L.radiusX === 'number' ) {
				L.radiusX = L.radiusX * sx;
			}
			if ( typeof L.radiusY === 'number' ) {
				L.radiusY = L.radiusY * sy;
			}
			if ( typeof L.x1 === 'number' ) {
				L.x1 = L.x1 * sx;
			}
			if ( typeof L.y1 === 'number' ) {
				L.y1 = L.y1 * sy;
			}
			if ( typeof L.x2 === 'number' ) {
				L.x2 = L.x2 * sx;
			}
			if ( typeof L.y2 === 'number' ) {
				L.y2 = L.y2 * sy;
			}
			// Curved arrow control point - must be scaled for proper Bézier curve
			if ( typeof L.controlX === 'number' ) {
				L.controlX = L.controlX * sx;
			}
			if ( typeof L.controlY === 'number' ) {
				L.controlY = L.controlY * sy;
			}
			if ( typeof L.fontSize === 'number' ) {
				L.fontSize = L.fontSize * scaleAvg;
			}
			if ( typeof L.strokeWidth === 'number' ) {
				L.strokeWidth = L.strokeWidth * scaleAvg;
			}
			if ( typeof L.arrowSize === 'number' ) {
				L.arrowSize = L.arrowSize * scaleAvg;
			}
			if ( typeof L.tailWidth === 'number' ) {
				L.tailWidth = L.tailWidth * scaleAvg;
			}
			if ( typeof L.textStrokeWidth === 'number' ) {
				L.textStrokeWidth = L.textStrokeWidth * scaleAvg;
			}
			// Corner radii for shapes (rectangles, polygons, textboxes, stars)
			if ( typeof L.cornerRadius === 'number' ) {
				L.cornerRadius = L.cornerRadius * scaleAvg;
			}
			if ( typeof L.pointRadius === 'number' ) {
				L.pointRadius = L.pointRadius * scaleAvg;
			}
			if ( typeof L.valleyRadius === 'number' ) {
				L.valleyRadius = L.valleyRadius * scaleAvg;
			}
			// Text box padding - must be scaled to match container size
			if ( typeof L.padding === 'number' ) {
				L.padding = L.padding * scaleAvg;
			}
			// Blur radius - must be scaled for blur layers and blur fill
			if ( typeof L.blurRadius === 'number' ) {
				L.blurRadius = L.blurRadius * scaleAvg;
			}
			if ( Array.isArray( L.points ) ) {
				const pts = [];
				for ( let i = 0; i < L.points.length; i++ ) {
					const p = L.points[ i ];
					pts.push( { x: p.x * sx, y: p.y * sy } );
				}
				L.points = pts;
			}
			return L;
		}
	}

	// Export for manual initialization; bootstrap handled in ext.layers/init.js
	window.Layers = window.Layers || {};
	window.Layers.Viewer = LayersViewer;

}() );
