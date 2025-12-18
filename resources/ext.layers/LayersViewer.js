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

			this.init();
		}

		/**
		 * Initialize the viewer
		 */
		init() {
			if ( !this.container || !this.imageElement ) {
				return;
			}

			this.applyBackgroundSettings();
			this.createCanvas();
			this.loadImageAndRender();
		}

		/**
		 * Apply background visibility and opacity settings to the image element
		 */
		applyBackgroundSettings() {
			if ( !this.imageElement || !this.layerData ) {
				return;
			}

			// Ensure the image element has a style object (may be missing in tests)
			if ( !this.imageElement.style ) {
				return;
			}

			// Apply background visibility (default: true)
			const bgVisible = this.layerData.backgroundVisible;
			if ( bgVisible === false || bgVisible === 'false' || bgVisible === '0' || bgVisible === 0 ) {
				this.imageElement.style.visibility = 'hidden';
			} else {
				// Ensure visibility is restored if it was previously hidden
				this.imageElement.style.visibility = 'visible';
			}

			// Apply background opacity (default: 1.0)
			const bgOpacity = this.layerData.backgroundOpacity;
			if ( typeof bgOpacity === 'number' && bgOpacity >= 0 && bgOpacity <= 1 ) {
				this.imageElement.style.opacity = String( bgOpacity );
			} else if ( typeof bgOpacity === 'string' ) {
				const parsed = parseFloat( bgOpacity );
				if ( !isNaN( parsed ) && parsed >= 0 && parsed <= 1 ) {
					this.imageElement.style.opacity = String( parsed );
				}
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

			// Initialize shared LayerRenderer
			this.renderer = new LayerRenderer( this.ctx, {
				canvas: this.canvas,
				baseWidth: this.baseWidth,
				baseHeight: this.baseHeight
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
			// Wait for image to load if not already loaded
			if ( this.imageElement.complete ) {
				this.resizeCanvasAndRender();
			} else {
				this.imageElement.addEventListener( 'load', () => {
					this.resizeCanvasAndRender();
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

			// Render layers from bottom to top so top-most (index 0 in editor) is drawn last.
			const layers = Array.isArray( this.layerData.layers ) ? this.layerData.layers : [];
			for ( let i = layers.length - 1; i >= 0; i-- ) {
				const layer = layers[ i ];
				// Special handling for blur layers - blur everything rendered so far
				if ( layer.type === 'blur' ) {
					this.renderBlurLayer( layer );
				} else {
					this.renderLayer( layer );
				}
			}
		}

		/**
		 * Render a blur layer that blurs everything drawn below it
		 *
		 * @param {Object} layer - Blur layer with x, y, width, height, blurRadius
		 */
		renderBlurLayer( layer ) {
			// Skip invisible layers
			if ( layer.visible === false || layer.visible === 'false' || layer.visible === '0' || layer.visible === 0 ) {
				return;
			}

			// Compute scaling from saved coordinates to current canvas size
			let sx = 1;
			let sy = 1;
			if ( this.baseWidth && this.baseHeight ) {
				sx = ( this.canvas.width || 1 ) / this.baseWidth;
				sy = ( this.canvas.height || 1 ) / this.baseHeight;
			}

			// Scale blur region coordinates
			const x = ( layer.x || 0 ) * sx;
			const y = ( layer.y || 0 ) * sy;
			const w = ( layer.width || 0 ) * sx;
			const h = ( layer.height || 0 ) * sy;

			if ( w <= 0 || h <= 0 ) {
				return;
			}

			const radius = Math.max( 1, Math.min( 64, Math.round( layer.blurRadius || 12 ) ) );

			this.ctx.save();

			// Apply layer opacity and blend mode
			if ( typeof layer.opacity === 'number' ) {
				this.ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}
			if ( layer.blend ) {
				try {
					this.ctx.globalCompositeOperation = String( layer.blend );
				} catch ( e ) {
					this.ctx.globalCompositeOperation = 'source-over';
				}
			}

			try {
				// Create a temp canvas to capture the composite (image + layers drawn so far)
				const tempCanvas = document.createElement( 'canvas' );
				tempCanvas.width = Math.max( 1, Math.ceil( w ) );
				tempCanvas.height = Math.max( 1, Math.ceil( h ) );
				const tempCtx = tempCanvas.getContext( '2d' );

				if ( tempCtx ) {
					// First draw the background image region
					if ( this.imageElement && this.imageElement.complete ) {
						const imgW = this.imageElement.naturalWidth || this.imageElement.width;
						const imgH = this.imageElement.naturalHeight || this.imageElement.height;
						const imgScaleX = imgW / this.canvas.width;
						const imgScaleY = imgH / this.canvas.height;

						tempCtx.drawImage(
							this.imageElement,
							x * imgScaleX, y * imgScaleY, w * imgScaleX, h * imgScaleY,
							0, 0, tempCanvas.width, tempCanvas.height
						);
					}

					// Then overlay what's been drawn on our canvas (layers below this blur)
					tempCtx.drawImage(
						this.canvas,
						x, y, w, h,
						0, 0, tempCanvas.width, tempCanvas.height
					);

					// Apply blur filter and draw back
					this.ctx.filter = 'blur(' + radius + 'px)';
					this.ctx.drawImage( tempCanvas, x, y, w, h );
					this.ctx.filter = 'none';
				}
			} catch ( e ) {
				// Fallback: gray overlay
				this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
				this.ctx.fillRect( x, y, w, h );
			}

			this.ctx.restore();
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
			if ( layer.blend ) {
				try {
					this.ctx.globalCompositeOperation = String( layer.blend );
				} catch ( e ) {
					if ( window.mw && window.mw.log ) {
						mw.log.warn( '[LayersViewer] Unsupported blend mode: ' + layer.blend );
					}
				}
			}

			// Prepare shadow scale for the renderer
			// BUG FIX (2025-12-08): Pass shadowScale in options instead of calling applyShadow here
			// Previously, applyShadow was called here with correct scale, but then shape methods
			// in LayerRenderer called applyShadow again with scale=1, overwriting the correct values.
			// Now we pass shadowScale through options so shape methods use the correct scale.
			const shadowScale = { sx: sx, sy: sy, avg: scaleAvg };

			// Delegate rendering to the shared LayerRenderer
			// Using scaled=true since we pre-scaled the coordinates
			// shadowScale tells shape methods to use this scale for shadow offsets (not 1:1)
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
