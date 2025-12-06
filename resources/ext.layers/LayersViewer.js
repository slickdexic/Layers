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
	 * LayersViewer class
	 *
	 * @class
	 * @param {Object} config Configuration object
	 * @param {HTMLElement} config.container The container element for the viewer.
	 * @param {HTMLImageElement} config.imageElement The image element to overlay.
	 * @param {Object} config.layerData The layer data to render.
	 */
	function LayersViewer( config ) {
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

	LayersViewer.prototype.init = function () {
		if ( !this.container || !this.imageElement ) {
			return;
		}

		this.createCanvas();
		this.loadImageAndRender();
	};

	LayersViewer.prototype.createCanvas = function () {
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
	};

	LayersViewer.prototype.loadImageAndRender = function () {
		const self = this;

		// Wait for image to load if not already loaded
		if ( this.imageElement.complete ) {
			this.resizeCanvasAndRender();
		} else {
			this.imageElement.addEventListener( 'load', function () {
				self.resizeCanvasAndRender();
			} );
		}

		// Re-render on window resize to keep overlay aligned
		this.boundWindowResize = function () {
			self.scheduleResize();
		};
		window.addEventListener( 'resize', this.boundWindowResize );

		// Re-render when the image element's box size changes (responsive layout, thumb swaps)
		if ( typeof window.ResizeObserver === 'function' ) {
			try {
				this.resizeObserver = new window.ResizeObserver( function () {
					self.scheduleResize();
				} );
				this.resizeObserver.observe( this.imageElement );
			} catch ( e ) {
				if ( window.mw && window.mw.log ) {
					mw.log.warn( '[LayersViewer] ResizeObserver setup failed:', e.message );
				}
			}
		}
	};

	LayersViewer.prototype.scheduleResize = function () {
		const self = this;
		if ( this.rAFId ) {
			return;
		}
		this.rAFId = window.requestAnimationFrame( function () {
			self.rAFId = null;
			self.resizeCanvasAndRender();
		} );
	};

	LayersViewer.prototype.destroy = function () {
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
	};

	LayersViewer.prototype.resizeCanvasAndRender = function () {
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
	};

	LayersViewer.prototype.renderLayers = function () {
		if ( !this.layerData || !this.layerData.layers ) {
			return;
		}

		// Clear canvas
		this.ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

		// Render layers from bottom to top so top-most (index 0 in editor) is drawn last.
		const layers = Array.isArray( this.layerData.layers ) ? this.layerData.layers : [];
		for ( let i = layers.length - 1; i >= 0; i-- ) {
			this.renderLayer( layers[ i ] );
		}
	};

	LayersViewer.prototype.renderLayer = function ( layer ) {
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

		// Apply shadow at outer context level using the renderer helper
		const scale = { sx: sx, sy: sy, avg: scaleAvg };
		this.renderer.applyShadow( layer, scale );

		// Delegate rendering to the shared LayerRenderer
		// Using scaled=true since we pre-scaled the coordinates
		this.renderer.drawLayer( L, { scaled: true, imageElement: this.imageElement } );

		// Restore to pre-layer state
		this.ctx.restore();
	};

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
	LayersViewer.prototype.scaleLayerCoordinates = function ( layer, sx, sy, scaleAvg ) {
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
	};

	// Export for manual initialization; bootstrap handled in ext.layers/init.js
	window.LayersViewer = LayersViewer;

	// Also add to Layers namespace
	window.Layers = window.Layers || {};
	window.Layers.Viewer = LayersViewer;

}() );
