/**
 * TransformationEngine Module for Layers Editor
 * Handles zoom, pan, rotation, and coordinate transformations
 * Extracted from CanvasManager.js - manages viewport, scaling, and smooth animations
 */
( function () {
	'use strict';

	/**
	 * TransformationEngine - Manages canvas transformations and viewport
	 *
	 * @class
	 */
	class TransformationEngine {
		/**
		 * @param {HTMLCanvasElement} canvas - Canvas element to transform
		 * @param {Object} config - Configuration options
		 */
		constructor( canvas, config ) {
			this.canvas = canvas;
			this.config = config || {};

			// Editor reference for status updates
			this.editor = this.config.editor || null;

			// Zoom and pan state
			this.zoom = 1.0;
			this.minZoom = 0.1;
			this.maxZoom = 5.0;
			this.panX = 0;
			this.panY = 0;
			this.isPanning = false;
			this.lastPanPoint = null;
			this.userHasSetZoom = false;

			// Smooth zoom animation properties
			this.isAnimatingZoom = false;
			this.zoomAnimationDuration = 300; // milliseconds
			this.zoomAnimationStartTime = 0;
			this.zoomAnimationStartZoom = 1.0;
			this.zoomAnimationTargetZoom = 1.0;

			// Viewport bounds for culling
			this.viewportBounds = { x: 0, y: 0, width: 0, height: 0 };

			// Grid snapping
			this.snapToGrid = false;
			this.gridSize = 10;

			this.init();
		}

		/**
		 * Initialize the transformation engine
		 */
		init() {
			// Update zoom limits from config if provided
			if ( this.config.minZoom !== undefined ) {
				this.minZoom = this.config.minZoom;
			}
			if ( this.config.maxZoom !== undefined ) {
				this.maxZoom = this.config.maxZoom;
			}
			if ( this.config.gridSize !== undefined ) {
				this.gridSize = this.config.gridSize;
			}

			// Initialize transformation
			this.updateCanvasTransform();
			this.updateViewportBounds();
		}

	/**
	 * Set zoom level with clamping and status update
	 *
	 * @param {number} newZoom - New zoom level
	 */
	setZoom( newZoom ) {
		this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
		this.userHasSetZoom = true;

		this.updateCanvasTransform();
		this.updateViewportBounds();

		// Update status zoom percent
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { zoomPercent: this.zoom * 100 } );
		}
	}

	/**
	 * Set zoom directly without triggering user zoom flag (for animations)
	 *
	 * @param {number} newZoom - New zoom level
	 */
	setZoomDirect( newZoom ) {
		this.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );
		this.updateCanvasTransform();
		this.updateViewportBounds();

		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { zoomPercent: this.zoom * 100 } );
		}
	}

	/**
	 * Get current zoom level
	 *
	 * @return {number} Current zoom level
	 */
	getZoom() {
		return this.zoom;
	}

	/**
	 * Zoom in by increment
	 */
	zoomIn() {
		const targetZoom = this.zoom + 0.2;
		this.smoothZoomTo( targetZoom );
		this.userHasSetZoom = true;
	}

	/**
	 * Zoom out by increment
	 */
	zoomOut() {
		const targetZoom = this.zoom - 0.2;
		this.smoothZoomTo( targetZoom );
		this.userHasSetZoom = true;
	}

	/**
	 * Reset zoom and pan to defaults
	 */
	resetZoom() {
		this.panX = 0;
		this.panY = 0;
		this.userHasSetZoom = true;

		this.smoothZoomTo( 1.0 );

		// Update UI components
		if ( this.editor && this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( 100 );
		}
		if ( this.editor && typeof this.editor.updateZoomReadout === 'function' ) {
			this.editor.updateZoomReadout( 100 );
		}
		if ( this.editor && typeof this.editor.updateStatus === 'function' ) {
			this.editor.updateStatus( { zoomPercent: 100 } );
		}
	}

	/**
	 * Zoom by delta amount at anchor point
	 *
	 * @param {number} delta - Zoom delta amount
	 * @param {Object} anchor - Anchor point {x, y}
	 */
	zoomBy( delta, anchor ) {
		const currentZoom = this.zoom;
		let newZoom = currentZoom + delta;
		newZoom = Math.max( this.minZoom, Math.min( this.maxZoom, newZoom ) );

		if ( anchor ) {
			// Anchor point is in world coordinates (from clientToCanvas conversion)
			// We want to keep this world point at the same screen position
			// Canvas transform: ctx.translate(panX, panY); ctx.scale(zoom, zoom);
			// Screen position = (worldX + panX) * zoom

			// Calculate current screen position of the anchor point
			const screenX = ( anchor.x + this.panX ) * currentZoom;
			const screenY = ( anchor.y + this.panY ) * currentZoom;

			// After zoom change, we want the same world point at the same screen position
			// screenX = (anchor.x + newPanX) * newZoom
			// So: newPanX = screenX / newZoom - anchor.x
			const newPanX = screenX / newZoom - anchor.x;
			const newPanY = screenY / newZoom - anchor.y;

			this.setPan( newPanX, newPanY );
		}

		this.setZoom( newZoom );
		this.userHasSetZoom = true;
	}

	/**
	 * Pan by pixel amounts (for keyboard navigation)
	 *
	 * @param {number} deltaX - X pan amount in pixels
	 * @param {number} deltaY - Y pan amount in pixels
	 */
	panByPixels( deltaX, deltaY ) {
		this.panX += deltaX;
		this.panY += deltaY;
		this.updateCanvasTransform();
		this.updateViewportBounds();
	}

	/**
	 * Get current pan position
	 *
	 * @return {Object} Pan position {x, y}
	 */
	getPan() {
		return { x: this.panX, y: this.panY };
	}

	/**
	 * Set pan position directly
	 *
	 * @param {number} newPanX - New X pan position
	 * @param {number} newPanY - New Y pan position
	 */
	setPan( newPanX, newPanY ) {
		this.panX = newPanX;
		this.panY = newPanY;
		this.updateCanvasTransform();
		this.updateViewportBounds();
	}

	/**
	 * Start panning operation
	 *
	 * @param {number} startX - Starting X coordinate
	 * @param {number} startY - Starting Y coordinate
	 */
	startPan( startX, startY ) {
		this.isPanning = true;
		this.lastPanPoint = { x: startX, y: startY };
	}

	/**
	 * Update pan position during drag
	 *
	 * @param {number} currentX - Current X coordinate
	 * @param {number} currentY - Current Y coordinate
	 */
	updatePan( currentX, currentY ) {
		if ( !this.isPanning || !this.lastPanPoint ) {
			return;
		}

		const deltaX = currentX - this.lastPanPoint.x;
		const deltaY = currentY - this.lastPanPoint.y;

		this.panX += deltaX;
		this.panY += deltaY;

		this.lastPanPoint = { x: currentX, y: currentY };
		this.updateCanvasTransform();
		this.updateViewportBounds();
	}

	/**
	 * Stop panning operation
	 */
	stopPan() {
		this.isPanning = false;
		this.lastPanPoint = null;
	}

	/**
	 * Check if currently panning
	 *
	 * @return {boolean} True if panning
	 */
	isPanningActive() {
		return this.isPanning;
	}

	/**
	 * Smoothly animate zoom to target level
	 *
	 * @param {number} targetZoom - Target zoom level
	 * @param {number} duration - Animation duration in milliseconds (optional)
	 */
	smoothZoomTo( targetZoom, duration ) {
		targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );
		duration = duration || this.zoomAnimationDuration;

		// If already at target zoom or very close, don't animate
		if ( Math.abs( this.zoom - targetZoom ) < 0.01 ) {
			return;
		}

		this.isAnimatingZoom = true;
		this.zoomAnimationStartTime = performance.now();
		this.zoomAnimationStartZoom = this.zoom;
		this.zoomAnimationTargetZoom = targetZoom;
		this.zoomAnimationDuration = duration;

		this.animateZoom();
	}

	/**
	 * Animation frame function for smooth zooming
	 */
	animateZoom() {
		if ( !this.isAnimatingZoom ) {
			return;
		}

		const currentTime = performance.now();
		const elapsed = currentTime - this.zoomAnimationStartTime;
		const progress = Math.min( elapsed / this.zoomAnimationDuration, 1.0 );

		// Use easing function for smooth animation (ease-out)
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
	}

	/**
	 * Update the canvas CSS transform from current pan/zoom state
	 * DEPRECATED: Using canvas context transforms only to avoid coordinate confusion
	 */
	updateCanvasTransform() {
		// Removed CSS transform setting to use canvas context transforms only
		// Transform properties are synced to CanvasManager for context-based rendering
		this.updateViewportBounds();
	}

	/**
	 * Update viewport bounds for culling calculations
	 */
	updateViewportBounds() {
		if ( !this.canvas ) {
			return;
		}

		const container = this.canvas.parentNode;
		if ( !container ) {
			return;
		}

		// Calculate visible area in canvas coordinates
		this.viewportBounds = {
			x: -this.panX / this.zoom,
			y: -this.panY / this.zoom,
			width: container.clientWidth / this.zoom,
			height: container.clientHeight / this.zoom
		};
	}

	/**
	 * Get current viewport bounds
	 *
	 * @return {Object} Viewport bounds {x, y, width, height}
	 */
	getViewportBounds() {
		return this.viewportBounds;
	}

	/**
	 * Fit canvas to window dimensions
	 *
	 * @param {Object} backgroundImage - Background image for size reference
	 */
	fitToWindow( backgroundImage ) {
		if ( !backgroundImage || !this.canvas ) {
			return;
		}

		const container = this.canvas.parentNode;
		if ( !container ) {
			return;
		}

		const containerWidth = container.clientWidth - 40; // padding
		const containerHeight = container.clientHeight - 40;

		const scaleX = containerWidth / backgroundImage.width;
		const scaleY = containerHeight / backgroundImage.height;
		let targetZoom = Math.min( scaleX, scaleY );

		// Clamp to zoom limits
		targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );

		// Reset pan position
		this.panX = 0;
		this.panY = 0;
		this.userHasSetZoom = true;

		// Animate to fit zoom level
		this.smoothZoomTo( targetZoom );

		// Update UI
		if ( this.editor && this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( Math.round( targetZoom * 100 ) );
		}
	}

	/**
	 * Zoom to fit specified bounds
	 *
	 * @param {Object} bounds - Bounds to fit {left, top, right, bottom}
	 * @param {number} padding - Padding around content (optional)
	 */
	zoomToFitBounds( bounds, padding ) {
		if ( !bounds || !this.canvas ) {
			return;
		}

		padding = padding || 50;
		const contentWidth = ( bounds.right - bounds.left ) + ( padding * 2 );
		const contentHeight = ( bounds.bottom - bounds.top ) + ( padding * 2 );

		const container = this.canvas.parentNode;
		if ( !container ) {
			return;
		}

		const containerWidth = container.clientWidth - 40;
		const containerHeight = container.clientHeight - 40;

		const scaleX = containerWidth / contentWidth;
		const scaleY = containerHeight / contentHeight;
		let targetZoom = Math.min( scaleX, scaleY );

		// Clamp to zoom limits
		targetZoom = Math.max( this.minZoom, Math.min( this.maxZoom, targetZoom ) );

		// Center content in viewport
		const centerX = ( bounds.left + bounds.right ) / 2;
		const centerY = ( bounds.top + bounds.bottom ) / 2;

		this.panX = ( containerWidth / 2 ) - ( centerX * targetZoom );
		this.panY = ( containerHeight / 2 ) - ( centerY * targetZoom );
		this.userHasSetZoom = true;

		// Animate to target zoom
		this.smoothZoomTo( targetZoom );

		// Update UI
		if ( this.editor && this.editor.toolbar ) {
			this.editor.toolbar.updateZoomDisplay( Math.round( targetZoom * 100 ) );
		}
	}

	/**
	 * Convert client coordinates to canvas coordinates
	 *
	 * @param {number} clientX - Client X coordinate
	 * @param {number} clientY - Client Y coordinate
	 * @return {Object} Canvas coordinates {x, y}
	 */
	clientToCanvas( clientX, clientY ) {
		// Return coordinates in the editor's world/canvas coordinate space (matching the
		// coordinate space used by layer.x/layer.y and by CanvasManager rendering).
		if ( !this.canvas ) {
			return { x: 0, y: 0 };
		}

		const rect = this.canvas.getBoundingClientRect();
		const relX = clientX - rect.left;
		const relY = clientY - rect.top;

		// Scale to logical canvas pixels (account for high-DPI / CSS scaling)
		const scaleX = this.canvas.width / rect.width || 1;
		const scaleY = this.canvas.height / rect.height || 1;
		const canvasX = relX * scaleX;
		const canvasY = relY * scaleY;

		// The CanvasManager performRedraw applies transforms in this order:
		// ctx.translate(panX, panY); ctx.scale(zoom, zoom);
		// Drawing coordinates (world) are transformed to screen/canvas pixels as:
		// canvasPixel = zoom * ( world + pan )
		// Therefore invert that mapping here to obtain world coordinates:
		let worldX = ( canvasX / this.zoom ) - ( this.panX || 0 );
		let worldY = ( canvasY / this.zoom ) - ( this.panY || 0 );

		// Apply grid snapping in world coordinates if enabled
		if ( this.snapToGrid && this.gridSize > 0 ) {
			worldX = Math.round( worldX / this.gridSize ) * this.gridSize;
			worldY = Math.round( worldY / this.gridSize ) * this.gridSize;
		}

		return { x: worldX, y: worldY };
	}

	/**
	 * Convert canvas coordinates to client coordinates
	 *
	 * @param {number} canvasX - Canvas X coordinate
	 * @param {number} canvasY - Canvas Y coordinate
	 * @return {Object} Client coordinates {x, y}
	 */
	canvasToClient( canvasX, canvasY ) {
		if ( !this.canvas ) {
			return { x: 0, y: 0 };
		}

		const rect = this.canvas.getBoundingClientRect();
		const scaleX = rect.width / this.canvas.width;
		const scaleY = rect.height / this.canvas.height;

		const clientX = rect.left + ( canvasX * scaleX );
		const clientY = rect.top + ( canvasY * scaleY );

		return { x: clientX, y: clientY };
	}

	/**
	 * Get raw coordinates without snapping (for precise operations)
	 *
	 * @param {MouseEvent} event - Mouse event
	 * @return {Object} Raw canvas coordinates {canvasX, canvasY}
	 */
	getRawCoordinates( event ) {
		if ( !this.canvas ) {
			return { canvasX: 0, canvasY: 0 };
		}

		const rect = this.canvas.getBoundingClientRect();
		const clientX = event.clientX - rect.left;
		const clientY = event.clientY - rect.top;

		return {
			canvasX: ( clientX - ( this.panX || 0 ) ) / this.zoom,
			canvasY: ( clientY - ( this.panY || 0 ) ) / this.zoom
		};
	}

	/**
	 * Enable or disable grid snapping
	 *
	 * @param {boolean} enabled - Whether to enable grid snapping
	 */
	setSnapToGrid( enabled ) {
		this.snapToGrid = !!enabled;
	}

	/**
	 * Set grid size for snapping
	 *
	 * @param {number} size - Grid size in pixels
	 */
	setGridSize( size ) {
		if ( typeof size === 'number' && size > 0 ) {
			this.gridSize = size;
		}
	}

	/**
	 * Check if animation is currently running
	 *
	 * @return {boolean} True if animating
	 */
	isAnimating() {
		return this.isAnimatingZoom;
	}

	/**
	 * Set zoom limits
	 *
	 * @param {number} min - Minimum zoom level
	 * @param {number} max - Maximum zoom level
	 */
	setZoomLimits( min, max ) {
		if ( typeof min === 'number' && min > 0 ) {
			this.minZoom = min;
		}
		if ( typeof max === 'number' && max > this.minZoom ) {
			this.maxZoom = max;
		}

		// Clamp current zoom to new limits
		if ( this.zoom < this.minZoom || this.zoom > this.maxZoom ) {
			this.setZoom( Math.max( this.minZoom, Math.min( this.maxZoom, this.zoom ) ) );
		}
	}

	/**
	 * Get current zoom limits
	 *
	 * @return {Object} Zoom limits {min, max}
	 */
	getZoomLimits() {
		return { min: this.minZoom, max: this.maxZoom };
	}

	/**
	 * Update configuration options
	 *
	 * @param {Object} newConfig - New configuration options
	 */
	updateConfig( newConfig ) {
		if ( newConfig ) {
			Object.keys( newConfig ).forEach( ( key ) => {
				this.config[ key ] = newConfig[ key ];
			} );

			// Update editor reference if provided
			if ( newConfig.editor ) {
				this.editor = newConfig.editor;
			}

			// Re-initialize with new config
			this.init();
		}
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.canvas = null;
		this.editor = null;
		this.config = null;
		this.isAnimatingZoom = false;
		this.lastPanPoint = null;
	}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.TransformationEngine = TransformationEngine;

		// Backward compatibility - direct window export
		window.TransformationEngine = TransformationEngine;
	}

	// Also export via CommonJS if available (for Node.js/Jest testing)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TransformationEngine;
	}

}() );
