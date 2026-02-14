/**
 * RenderCoordinator - Manages render scheduling and optimization for the Layers Editor
 *
 * This module provides:
 * - requestAnimationFrame batching to prevent multiple redraws per frame
 * - Dirty region tracking for partial redraws (future optimization)
 * - Render queue management for smooth animations
 * - Performance metrics collection
 *
 * @module RenderCoordinator
 */
( function () {
	'use strict';

	/**
	 * RenderCoordinator class
	 */
class RenderCoordinator {
	/**
	 * Creates a new RenderCoordinator instance
	 *
	 * @param {CanvasManager} canvasManager - Reference to the canvas manager
	 * @param {Object} [options] - Configuration options
	 * @param {boolean} [options.enableMetrics=false] - Enable performance metrics collection
	 * @param {number} [options.targetFps=60] - Target frames per second
	 */
	constructor( canvasManager, options ) {
		this.canvasManager = canvasManager;
		this.options = options || {};

		// Render state
		this.pendingRedraw = false;
		this.animationFrameId = null;
		this.fallbackTimeoutId = null; // For environments without rAF
		this.isDestroyed = false;

		// Layer change detection for skipping redundant redraws
		// Stores a quick hash of the last rendered state
		this.lastLayersHash = null;
		this.forceNextRedraw = false; // Force redraw even if hash matches

		// Dirty region tracking (for future partial redraw optimization)
		this.dirtyRegions = [];
		this.fullRedrawRequired = true;

		// Performance metrics
		this.enableMetrics = this.options.enableMetrics || false;
		this.targetFps = this.options.targetFps || 60;
		this.targetFrameTime = 1000 / this.targetFps;
		this.lastFrameTime = 0;
		this.frameCount = 0;
		this.frameTimes = [];
		this.maxFrameTimesSample = 60; // Keep last 60 frame times for averaging

		// Render callbacks queue
		this.preRenderCallbacks = [];
		this.postRenderCallbacks = [];

		// Bind methods to preserve context
		this._boundRenderFrame = this._renderFrame.bind( this );
	}

	/**
	 * Schedule a redraw for the next animation frame
	 * Multiple calls before the next frame are coalesced into a single redraw
	 *
	 * @param {Object} [options] - Redraw options
	 * @param {boolean} [options.immediate=false] - Force immediate redraw (skip batching)
	 * @param {Object} [options.region] - Dirty region {x, y, width, height} for partial redraw
	 * @return {RenderCoordinator} Returns this for chaining
	 */
	scheduleRedraw( options ) {
		if ( this.isDestroyed ) {
			return this;
		}

		options = options || {};

		// Track dirty regions for future partial redraw optimization
		if ( options.region ) {
			this.dirtyRegions.push( options.region );
		} else {
			// No specific region means full redraw
			this.fullRedrawRequired = true;
		}

		// Immediate mode bypasses batching (use sparingly)
		if ( options.immediate ) {
			this._performRedraw();
			return this;
		}

		// Skip if redraw already scheduled
		if ( this.pendingRedraw ) {
			return this;
		}

		this.pendingRedraw = true;

		// Use requestAnimationFrame for smooth rendering
		if ( typeof window !== 'undefined' && window.requestAnimationFrame ) {
			this.animationFrameId = window.requestAnimationFrame( this._boundRenderFrame );
		} else {
			// Fallback for environments without rAF (track ID for cleanup)
			this.fallbackTimeoutId = setTimeout( this._boundRenderFrame, this.targetFrameTime );
		}

		return this;
	}

	/**
	 * Internal render frame callback
	 * @private
	 */
	_renderFrame ( timestamp ) {
		if ( this.isDestroyed ) {
			return;
		}

		this.pendingRedraw = false;
		this.animationFrameId = null;
		this.fallbackTimeoutId = null;

		// Track frame timing for metrics
		if ( this.enableMetrics && timestamp ) {
			const frameTime = timestamp - this.lastFrameTime;
			this.lastFrameTime = timestamp;
			this._recordFrameTime( frameTime );
		}

		// Perform the actual redraw
		this._performRedraw();
	}

	/**
	 * Perform the actual redraw operation
	 * @private
	 */
	_performRedraw () {
		const startTime = this.enableMetrics ? performance.now() : 0;

		try {
			// Run pre-render callbacks
			this._runCallbacks( this.preRenderCallbacks );

			// Delegate to CanvasManager's renderer
			if ( this.canvasManager && this.canvasManager.renderer ) {
				const layers = this.canvasManager.editor && this.canvasManager.editor.layers
					? this.canvasManager.editor.layers
					: [];

				// Check if we can skip redraw (layers unchanged and not forced)
				if ( !this.forceNextRedraw && !this.fullRedrawRequired ) {
					const currentHash = this._computeLayersHash( layers );
					if ( currentHash === this.lastLayersHash ) {
						// Skip redraw - nothing changed
						return;
					}
					this.lastLayersHash = currentHash;
				}

				// Reset force flag after using it
				this.forceNextRedraw = false;

				this.canvasManager.renderer.redraw( layers );
			}

			// Run post-render callbacks
			this._runCallbacks( this.postRenderCallbacks );

		} catch ( error ) {
			this._handleRenderError( error );
		} finally {
			// Reset dirty state
			this.dirtyRegions = [];
			this.fullRedrawRequired = false;

			// Record render time
			if ( this.enableMetrics ) {
				const renderTime = performance.now() - startTime;
				this._recordRenderTime( renderTime );
			}
		}
	}

	/**
	 * Compute a quick hash of the layers state for change detection.
	 * This is not cryptographic - just needs to detect changes.
	 *
	 * @param {Array} layers - Array of layer objects
	 * @return {string} Hash string
	 * @private
	 */
	_computeLayersHash ( layers ) {
		if ( !layers || layers.length === 0 ) {
			return 'empty';
		}
		// Include layer count and key properties that affect rendering
		const parts = [ layers.length.toString() ];
		for ( let i = 0; i < layers.length; i++ ) {
			const layer = layers[ i ];
			// Include all properties that affect visual rendering
			parts.push(
				layer.id || '',
				layer.x || 0,
				layer.y || 0,
				layer.width || 0,
				layer.height || 0,
				layer.rotation || 0,
				layer.visible !== false && layer.visible !== 0 ? '1' : '0',
				layer.opacity || 1,
				// Style properties
				layer.fill || '',
				layer.stroke || '',
				layer.strokeWidth || 0,
				layer.fillOpacity !== undefined ? layer.fillOpacity : '',
				layer.strokeOpacity !== undefined ? layer.strokeOpacity : '',
				// Text properties
				layer.text || '',
				layer.fontSize || '',
				layer.fontFamily || '',
				layer.fontWeight || '',
				layer.fontStyle || '',
				layer.textAlign || '',
				// Shape/line endpoints
				layer.x1 || 0,
				layer.y1 || 0,
				layer.x2 || 0,
				layer.y2 || 0,
				layer.radius || 0,
				// Effects
				layer.shadow ? '1' : '0',
				layer.shadowBlur || 0,
				layer.blurRadius || 0,
				layer.blendMode || '',
				// Image source (use length to avoid huge strings)
				layer.src ? layer.src.length : 0,
				// Complex properties (use JSON length as proxy for changes)
				layer.richText ? layer.richText.length : 0,
				layer.gradient ? ( layer.gradient.type || '' ) : '',
				layer.points ? layer.points.length : 0,
				// Locked/name (affect rendering of selection handles)
				layer.locked ? '1' : '0',
				layer.name || ''
			);
		}
		// Also include selection state and zoom/pan
		if ( this.canvasManager ) {
			const renderer = this.canvasManager.renderer;
			if ( renderer ) {
				parts.push( renderer.zoom || 1 );
				parts.push( renderer.panX || 0 );
				parts.push( renderer.panY || 0 );
				parts.push( ( renderer.selectedLayerIds || [] ).join( ',' ) );
			}
		}
		return parts.join( '|' );
	}

	/**
	 * Run an array of callbacks
	 * @param {Array<Function>} callbacks
	 * @private
	 */
	_runCallbacks ( callbacks ) {
		for ( let i = 0; i < callbacks.length; i++ ) {
			try {
				callbacks[ i ]();
			} catch ( error ) {
				this._logError( 'Render callback error:', error );
			}
		}
	}

	/**
	 * Handle render errors
	 * @param {Error} error
	 * @private
	 */
	_handleRenderError ( error ) {
		this._logError( 'Render error:', error );

		// Notify error handler if available
		if ( typeof window !== 'undefined' && window.layersErrorHandler ) {
			window.layersErrorHandler.handleError( error, 'RenderCoordinator._performRedraw', 'canvas' );
		}
	}

	/**
	 * Log an error using appropriate logging system
	 * @param {string} message
	 * @param {Error} error
	 * @private
	 */
	_logError ( message, error ) {
		if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
			mw.log.error( '[RenderCoordinator]', message, error );
		}
	}

	/**
	 * Record frame time for metrics
	 * @param {number} frameTime
	 * @private
	 */
	_recordFrameTime ( frameTime ) {
		this.frameTimes.push( frameTime );
		if ( this.frameTimes.length > this.maxFrameTimesSample ) {
			this.frameTimes.shift();
		}
		this.frameCount++;
	}

	/**
	 * Record render time for metrics
	 * @param {number} renderTime
	 * @private
	 */
	_recordRenderTime ( renderTime ) {
		// Could be extended to track render time separately from frame time
		if ( renderTime > this.targetFrameTime ) {
			this._logError( 'Slow render detected:', new Error( renderTime + 'ms exceeds target ' + this.targetFrameTime + 'ms' ) );
		}
	}

	/**
	 * Add a pre-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	addPreRenderCallback ( callback ) {
		if ( typeof callback === 'function' ) {
			this.preRenderCallbacks.push( callback );
		}
		return this;
	}

	/**
	 * Add a post-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	addPostRenderCallback ( callback ) {
		if ( typeof callback === 'function' ) {
			this.postRenderCallbacks.push( callback );
		}
		return this;
	}

	/**
	 * Remove a pre-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	removePreRenderCallback ( callback ) {
		const index = this.preRenderCallbacks.indexOf( callback );
		if ( index !== -1 ) {
			this.preRenderCallbacks.splice( index, 1 );
		}
		return this;
	}

	/**
	 * Remove a post-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	removePostRenderCallback ( callback ) {
		const index = this.postRenderCallbacks.indexOf( callback );
		if ( index !== -1 ) {
			this.postRenderCallbacks.splice( index, 1 );
		}
		return this;
	}

	/**
	 * Mark a region as dirty (needs redraw)
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 * @return {RenderCoordinator}
	 */
	markDirty ( x, y, width, height ) {
		this.dirtyRegions.push( { x: x, y: y, width: width, height: height } );
		return this.scheduleRedraw();
	}

	/**
	 * Mark entire canvas as needing full redraw
	 * @return {RenderCoordinator}
	 */
	markFullRedraw () {
		this.fullRedrawRequired = true;
		return this.scheduleRedraw();
	}

	/**
	 * Force the next redraw to happen even if layer hash matches.
	 * Useful when UI state changes that isn't captured in the layer hash.
	 *
	 * @return {RenderCoordinator}
	 */
	forceRedraw () {
		this.forceNextRedraw = true;
		this.lastLayersHash = null;
		return this.scheduleRedraw();
	}

	/**
	 * Invalidate the cached layer hash, forcing a full redraw on next request.
	 * Call this when the background, selection, or other non-layer state changes.
	 *
	 * @return {RenderCoordinator}
	 */
	invalidateRenderCache () {
		this.lastLayersHash = null;
		return this;
	}

	/**
	 * Cancel any pending redraw
	 * @return {RenderCoordinator}
	 */
	cancelPendingRedraw () {
		if ( this.animationFrameId !== null ) {
			if ( typeof window !== 'undefined' && window.cancelAnimationFrame ) {
				window.cancelAnimationFrame( this.animationFrameId );
			}
			this.animationFrameId = null;
		}
		if ( this.fallbackTimeoutId !== null ) {
			clearTimeout( this.fallbackTimeoutId );
			this.fallbackTimeoutId = null;
		}
		this.pendingRedraw = false;
		return this;
	}

	/**
	 * Get performance metrics
	 * @return {Object} Metrics object with fps, avgFrameTime, frameCount
	 */
	getMetrics () {
		if ( !this.enableMetrics || this.frameTimes.length === 0 ) {
			return {
				fps: 0,
				avgFrameTime: 0,
				frameCount: this.frameCount,
				enabled: this.enableMetrics
			};
		}

		const sum = this.frameTimes.reduce( function ( a, b ) {
			return a + b;
		}, 0 );
		const avgFrameTime = sum / this.frameTimes.length;
		const fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

		return {
			fps: Math.round( fps * 10 ) / 10,
			avgFrameTime: Math.round( avgFrameTime * 100 ) / 100,
			frameCount: this.frameCount,
			enabled: this.enableMetrics
		};
	}

	/**
	 * Reset metrics
	 * @return {RenderCoordinator}
	 */
	resetMetrics () {
		this.frameTimes = [];
		this.frameCount = 0;
		return this;
	}

	/**
	 * Enable or disable metrics collection
	 * @param {boolean} enabled
	 * @return {RenderCoordinator}
	 */
	setMetricsEnabled ( enabled ) {
		this.enableMetrics = !!enabled;
		if ( !this.enableMetrics ) {
			this.resetMetrics();
		}
		return this;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.isDestroyed = true;
		this.cancelPendingRedraw();
		this.preRenderCallbacks = [];
		this.postRenderCallbacks = [];
		this.dirtyRegions = [];
		this.frameTimes = [];
		this.lastLayersHash = null;
		this.forceNextRedraw = false;
		this.canvasManager = null;
	}
}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.RenderCoordinator = RenderCoordinator;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = RenderCoordinator;
	}

}() );
