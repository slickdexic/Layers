/**
 * ZoomPanController - Handles zoom and pan operations for the canvas
 *
 * Extracted from CanvasManager.js to reduce file size and improve maintainability.
 * This module manages all zoom (in/out/fit/reset) and pan (drag) operations.
 *
 * @module canvas/ZoomPanController
 */
( function () {
	'use strict';

	/**
	 * ZoomPanController class
	 *
	 * @class
	 * @param {Object} canvasManager Reference to parent CanvasManager
	 */
	function ZoomPanController( canvasManager ) {
		this.manager = canvasManager;

		// Zoom state (references manager properties for backwards compatibility)
		// These getters/setters allow gradual migration while maintaining state in manager
		this.minZoom = 0.1;
		this.maxZoom = 5.0;

		// Smooth zoom animation properties
		this.isAnimatingZoom = false;
		this.zoomAnimationDuration = 300; // milliseconds
		this.zoomAnimationStartTime = 0;
		this.zoomAnimationStartZoom = 1.0;
		this.zoomAnimationTargetZoom = 1.0;
	}

	/**
	 * Get current zoom level
	 *
	 * @return {number} Current zoom level
	 */
	ZoomPanController.prototype.getZoom = function () {
		return this.manager.zoom;
	};

	/**
	 * Get current pan offset
	 *
	 * @return {{x: number, y: number}} Current pan offset
	 */
	ZoomPanController.prototype.getPan = function () {
		return {
			x: this.manager.panX,
			y: this.manager.panY
		};
	};

	/**
	 * Zoom in by a fixed increment
	 */
	ZoomPanController.prototype.zoomIn = function () {
		const targetZoom = this.manager.zoom + 0.2;
		this.smoothZoomTo( targetZoom );
		this.manager.userHasSetZoom = true;
	};

	/**
	 * Zoom out by a fixed increment
	 */
	ZoomPanController.prototype.zoomOut = function () {
		const targetZoom = this.manager.zoom - 0.2;
		this.smoothZoomTo( targetZoom );
		this.manager.userHasSetZoom = true;
	};

	/**
	 * Set zoom level with clamping and user flag
	 *
	 * @param {number} newZoom New zoom level
	 */
	ZoomPanController.prototype.setZoom = function ( newZoom ) {
		this.manager.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
		this.manager.userHasSetZoom = true;

		this.updateCanvasTransform();

		// Update status zoom percent
		if ( this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
			this.manager.editor.updateStatus( { zoomPercent: this.manager.zoom * 100 } );
		}
	};

	/**
	 * Set zoom directly without triggering user zoom flag (for animations)
	 *
	 * @param {number} newZoom New zoom level
	 */
	ZoomPanController.prototype.setZoomDirect = function ( newZoom ) {
		this.manager.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
		this.updateCanvasTransform();
		if ( this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
			this.manager.editor.updateStatus( { zoomPercent: this.manager.zoom * 100 } );
		}
	};

	/**
	 * Update the canvas CSS transform from current pan/zoom state
	 */
	ZoomPanController.prototype.updateCanvasTransform = function () {
		// Update zoom display in toolbar
		if ( this.manager.editor && this.manager.editor.toolbar ) {
			this.manager.editor.toolbar.updateZoomDisplay( Math.round( this.manager.zoom * 100 ) );
		}
		if ( this.manager.editor && typeof this.manager.editor.updateZoomReadout === 'function' ) {
			this.manager.editor.updateZoomReadout( Math.round( this.manager.zoom * 100 ) );
		}

		// Apply CSS transform for zoom and pan
		this.manager.canvas.style.transform = 'translate(' + this.manager.panX + 'px, ' +
			this.manager.panY + 'px) scale(' + this.manager.zoom + ')';
		this.manager.canvas.style.transformOrigin = '0 0';
	};

	/**
	 * Reset zoom to 100% and center pan
	 */
	ZoomPanController.prototype.resetZoom = function () {
		this.manager.panX = 0;
		this.manager.panY = 0;
		this.manager.userHasSetZoom = true;

		// Smoothly animate back to 100% zoom
		this.smoothZoomTo( 1.0 );

		if ( this.manager.editor && this.manager.editor.toolbar ) {
			this.manager.editor.toolbar.updateZoomDisplay( 100 );
		}
		if ( this.manager.editor && typeof this.manager.editor.updateZoomReadout === 'function' ) {
			this.manager.editor.updateZoomReadout( 100 );
		}
		if ( this.manager.editor && typeof this.manager.editor.updateStatus === 'function' ) {
			this.manager.editor.updateStatus( { zoomPercent: 100 } );
		}
	};

	/**
	 * Smoothly animate zoom to a target level
	 *
	 * @param {number} targetZoom Target zoom level
	 * @param {number} [duration] Animation duration in milliseconds
	 */
	ZoomPanController.prototype.smoothZoomTo = function ( targetZoom, duration ) {
		// Clamp target zoom to valid range
		targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );
		duration = duration || this.zoomAnimationDuration;

		// If already at target zoom or very close, don't animate
		if ( Math.abs( this.manager.zoom - targetZoom ) < 0.01 ) {
			return;
		}

		this.isAnimatingZoom = true;
		this.zoomAnimationStartTime = performance.now();
		this.zoomAnimationStartZoom = this.manager.zoom;
		this.zoomAnimationTargetZoom = targetZoom;
		this.zoomAnimationDuration = duration;

		this.animateZoom();
	};

	/**
	 * Animation frame function for smooth zooming
	 */
	ZoomPanController.prototype.animateZoom = function () {
		if ( !this.isAnimatingZoom ) {
			return;
		}

		const currentTime = performance.now();
		const elapsed = currentTime - this.zoomAnimationStartTime;
		const progress = Math.min( elapsed / this.zoomAnimationDuration, 1.0 );

		// Use easing function for smooth animation (ease-out cubic)
		const easedProgress = 1 - Math.pow( 1 - progress, 3 );

		// Calculate current zoom level
		const currentZoom = this.zoomAnimationStartZoom +
			( this.zoomAnimationTargetZoom - this.zoomAnimationStartZoom ) * easedProgress;

		this.setZoomDirect( currentZoom );

		if ( progress < 1.0 ) {
			// Continue animation
			requestAnimationFrame( this.animateZoom.bind( this ) );
		} else {
			// Animation complete
			this.isAnimatingZoom = false;
			this.setZoomDirect( this.zoomAnimationTargetZoom );
		}
	};

	/**
	 * Fit canvas to window size
	 */
	ZoomPanController.prototype.fitToWindow = function () {
		if ( !this.manager.backgroundImage ) {
			return;
		}

		const container = this.manager.canvas.parentNode;
		const containerWidth = container.clientWidth - 40; // padding
		const containerHeight = container.clientHeight - 40;

		const scaleX = containerWidth / this.manager.backgroundImage.width;
		const scaleY = containerHeight / this.manager.backgroundImage.height;
		let targetZoom = Math.min( scaleX, scaleY );

		// Clamp to zoom limits
		targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );

		// Reset pan position
		this.manager.panX = 0;
		this.manager.panY = 0;
		this.manager.userHasSetZoom = true;

		// Animate to fit zoom level
		this.smoothZoomTo( targetZoom );

		if ( this.manager.editor && this.manager.editor.toolbar ) {
			this.manager.editor.toolbar.updateZoomDisplay( Math.round( targetZoom * 100 ) );
		}
	};

	/**
	 * Zoom to fit all layers in the viewport
	 */
	ZoomPanController.prototype.zoomToFitLayers = function () {
		if ( !this.manager.editor || this.manager.editor.layers.length === 0 ) {
			this.fitToWindow(); // Fall back to fitting canvas
			return;
		}

		// Calculate bounding box of all layers
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		let hasVisibleLayers = false;

		for ( let i = 0; i < this.manager.editor.layers.length; i++ ) {
			const layer = this.manager.editor.layers[ i ];
			if ( !layer.visible ) {
				continue; // Skip invisible layers
			}

			hasVisibleLayers = true;
			const layerBounds = this.manager.getLayerBounds( layer );
			if ( layerBounds ) {
				minX = Math.min( minX, layerBounds.left );
				minY = Math.min( minY, layerBounds.top );
				maxX = Math.max( maxX, layerBounds.right );
				maxY = Math.max( maxY, layerBounds.bottom );
			}
		}

		if ( !hasVisibleLayers ) {
			this.fitToWindow(); // Fall back to fitting canvas
			return;
		}

		// Add some padding around the content
		const padding = 50;
		const contentWidth = ( maxX - minX ) + ( padding * 2 );
		const contentHeight = ( maxY - minY ) + ( padding * 2 );

		const container = this.manager.canvas.parentNode;
		const containerWidth = container.clientWidth - 40;
		const containerHeight = container.clientHeight - 40;

		const scaleX = containerWidth / contentWidth;
		const scaleY = containerHeight / contentHeight;
		let targetZoom = Math.min( scaleX, scaleY );

		// Clamp to zoom limits
		targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );

		// Center the content
		const centerX = ( minX + maxX ) / 2;
		const centerY = ( minY + maxY ) / 2;
		const canvasCenterX = this.manager.canvas.width / 2;
		const canvasCenterY = this.manager.canvas.height / 2;

		this.manager.panX = ( canvasCenterX - centerX ) * targetZoom;
		this.manager.panY = ( canvasCenterY - centerY ) * targetZoom;
		this.manager.userHasSetZoom = true;

		// Animate to fit zoom level
		this.smoothZoomTo( targetZoom );
	};

	/**
	 * Public zoom helper used by external handlers (wheel/pinch)
	 *
	 * @param {number} delta Positive to zoom in, negative to zoom out (in zoom units)
	 * @param {{x: number, y: number}} point Canvas coordinate under the cursor to anchor zoom around
	 */
	ZoomPanController.prototype.zoomBy = function ( delta, point ) {
		const target = Math.max( this.minZoom, Math.min( this.maxZoom, this.manager.zoom + delta ) );
		if ( target === this.manager.zoom ) {
			return;
		}
		// Anchor zoom around the point
		const screenX = this.manager.panX + this.manager.zoom * point.x;
		const screenY = this.manager.panY + this.manager.zoom * point.y;
		this.manager.zoom = target;
		this.manager.panX = screenX - this.manager.zoom * point.x;
		this.manager.panY = screenY - this.manager.zoom * point.y;
		this.manager.userHasSetZoom = true;
		this.updateCanvasTransform();
	};

	/**
	 * Set pan position
	 *
	 * @param {number} x X offset
	 * @param {number} y Y offset
	 */
	ZoomPanController.prototype.setPan = function ( x, y ) {
		this.manager.panX = x;
		this.manager.panY = y;
		this.updateCanvasTransform();
	};

	/**
	 * Pan by a delta amount
	 *
	 * @param {number} dx X delta
	 * @param {number} dy Y delta
	 */
	ZoomPanController.prototype.panBy = function ( dx, dy ) {
		this.manager.panX += dx;
		this.manager.panY += dy;
		this.updateCanvasTransform();
	};

	/**
	 * Clean up resources
	 */
	ZoomPanController.prototype.destroy = function () {
		// Clear panning state
		this.isPanning = false;
		this.panStart = null;

		// Clear reference
		this.manager = null;
	};

	// Export to global scope for MediaWiki ResourceLoader
	window.ZoomPanController = ZoomPanController;

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ZoomPanController;
	}

}() );
