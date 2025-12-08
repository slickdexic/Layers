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
	 *
	 * @param {CanvasManager} canvasManager - Reference to the canvas manager
	 * @param {Object} [options] - Configuration options
	 * @param {boolean} [options.enableMetrics=false] - Enable performance metrics collection
	 * @param {number} [options.targetFps=60] - Target frames per second
	 * @class
	 */
	function RenderCoordinator( canvasManager, options ) {
		this.canvasManager = canvasManager;
		this.options = options || {};

		// Render state
		this.pendingRedraw = false;
		this.animationFrameId = null;
		this.isDestroyed = false;

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
	RenderCoordinator.prototype.scheduleRedraw = function ( options ) {
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
			// Fallback for environments without rAF
			setTimeout( this._boundRenderFrame, this.targetFrameTime );
		}

		return this;
	};

	/**
	 * Internal render frame callback
	 * @private
	 */
	RenderCoordinator.prototype._renderFrame = function ( timestamp ) {
		if ( this.isDestroyed ) {
			return;
		}

		this.pendingRedraw = false;
		this.animationFrameId = null;

		// Track frame timing for metrics
		if ( this.enableMetrics && timestamp ) {
			const frameTime = timestamp - this.lastFrameTime;
			this.lastFrameTime = timestamp;
			this._recordFrameTime( frameTime );
		}

		// Perform the actual redraw
		this._performRedraw();
	};

	/**
	 * Perform the actual redraw operation
	 * @private
	 */
	RenderCoordinator.prototype._performRedraw = function () {
		const startTime = this.enableMetrics ? performance.now() : 0;

		try {
			// Run pre-render callbacks
			this._runCallbacks( this.preRenderCallbacks );

			// Delegate to CanvasManager's renderer
			if ( this.canvasManager && this.canvasManager.renderer ) {
				const layers = this.canvasManager.editor && this.canvasManager.editor.layers
					? this.canvasManager.editor.layers
					: [];

				// Future optimization: use dirty regions for partial redraws
				// For now, always do full redraw
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
	};

	/**
	 * Run an array of callbacks
	 * @param {Array<Function>} callbacks
	 * @private
	 */
	RenderCoordinator.prototype._runCallbacks = function ( callbacks ) {
		for ( let i = 0; i < callbacks.length; i++ ) {
			try {
				callbacks[ i ]();
			} catch ( error ) {
				this._logError( 'Render callback error:', error );
			}
		}
	};

	/**
	 * Handle render errors
	 * @param {Error} error
	 * @private
	 */
	RenderCoordinator.prototype._handleRenderError = function ( error ) {
		this._logError( 'Render error:', error );

		// Notify error handler if available
		if ( typeof window !== 'undefined' && window.layersErrorHandler ) {
			window.layersErrorHandler.handleError( error, 'RenderCoordinator._performRedraw', 'canvas' );
		}
	};

	/**
	 * Log an error using appropriate logging system
	 * @param {string} message
	 * @param {Error} error
	 * @private
	 */
	RenderCoordinator.prototype._logError = function ( message, error ) {
		if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
			mw.log.error( '[RenderCoordinator]', message, error );
		}
	};

	/**
	 * Record frame time for metrics
	 * @param {number} frameTime
	 * @private
	 */
	RenderCoordinator.prototype._recordFrameTime = function ( frameTime ) {
		this.frameTimes.push( frameTime );
		if ( this.frameTimes.length > this.maxFrameTimesSample ) {
			this.frameTimes.shift();
		}
		this.frameCount++;
	};

	/**
	 * Record render time for metrics
	 * @param {number} renderTime
	 * @private
	 */
	RenderCoordinator.prototype._recordRenderTime = function ( renderTime ) {
		// Could be extended to track render time separately from frame time
		if ( renderTime > this.targetFrameTime ) {
			this._logError( 'Slow render detected:', new Error( renderTime + 'ms exceeds target ' + this.targetFrameTime + 'ms' ) );
		}
	};

	/**
	 * Add a pre-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.addPreRenderCallback = function ( callback ) {
		if ( typeof callback === 'function' ) {
			this.preRenderCallbacks.push( callback );
		}
		return this;
	};

	/**
	 * Add a post-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.addPostRenderCallback = function ( callback ) {
		if ( typeof callback === 'function' ) {
			this.postRenderCallbacks.push( callback );
		}
		return this;
	};

	/**
	 * Remove a pre-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.removePreRenderCallback = function ( callback ) {
		const index = this.preRenderCallbacks.indexOf( callback );
		if ( index !== -1 ) {
			this.preRenderCallbacks.splice( index, 1 );
		}
		return this;
	};

	/**
	 * Remove a post-render callback
	 * @param {Function} callback
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.removePostRenderCallback = function ( callback ) {
		const index = this.postRenderCallbacks.indexOf( callback );
		if ( index !== -1 ) {
			this.postRenderCallbacks.splice( index, 1 );
		}
		return this;
	};

	/**
	 * Mark a region as dirty (needs redraw)
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.markDirty = function ( x, y, width, height ) {
		this.dirtyRegions.push( { x: x, y: y, width: width, height: height } );
		return this.scheduleRedraw();
	};

	/**
	 * Mark entire canvas as needing full redraw
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.markFullRedraw = function () {
		this.fullRedrawRequired = true;
		return this.scheduleRedraw();
	};

	/**
	 * Cancel any pending redraw
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.cancelPendingRedraw = function () {
		if ( this.animationFrameId !== null ) {
			if ( typeof window !== 'undefined' && window.cancelAnimationFrame ) {
				window.cancelAnimationFrame( this.animationFrameId );
			}
			this.animationFrameId = null;
		}
		this.pendingRedraw = false;
		return this;
	};

	/**
	 * Get performance metrics
	 * @return {Object} Metrics object with fps, avgFrameTime, frameCount
	 */
	RenderCoordinator.prototype.getMetrics = function () {
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
	};

	/**
	 * Reset metrics
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.resetMetrics = function () {
		this.frameTimes = [];
		this.frameCount = 0;
		return this;
	};

	/**
	 * Enable or disable metrics collection
	 * @param {boolean} enabled
	 * @return {RenderCoordinator}
	 */
	RenderCoordinator.prototype.setMetricsEnabled = function ( enabled ) {
		this.enableMetrics = !!enabled;
		if ( !this.enableMetrics ) {
			this.resetMetrics();
		}
		return this;
	};

	/**
	 * Clean up resources
	 */
	RenderCoordinator.prototype.destroy = function () {
		this.isDestroyed = true;
		this.cancelPendingRedraw();
		this.preRenderCallbacks = [];
		this.postRenderCallbacks = [];
		this.dirtyRegions = [];
		this.frameTimes = [];
		this.canvasManager = null;
	};

	// Export
	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.RenderCoordinator = RenderCoordinator;

		// Backward compatibility - direct window export
		window.RenderCoordinator = RenderCoordinator;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = RenderCoordinator;
	}

}() );
