/**
 * InteractionController - Manages mouse/touch input coordination and drag state
 *
 * This controller centralizes the management of user interaction state, including:
 * - Drag operation tracking (isDragging, isResizing, isRotating)
 * - Point tracking (startPoint, dragStartPoint, lastTouchPoint)
 * - Marquee selection state
 * - Panning state
 *
 * It provides a clean API for starting, updating, and finishing various
 * interaction modes without cluttering CanvasManager.
 *
 * @class
 */
( function () {
	'use strict';

	/**
	 * InteractionController constructor
	 *
	 * @param {Object} canvasManager Reference to the parent CanvasManager
	 */
	function InteractionController( canvasManager ) {
		this.canvasManager = canvasManager;

		// Drag/manipulation state
		this.isDragging = false;
		this.isResizing = false;
		this.isRotating = false;
		this.isPanning = false;

		// Marquee selection
		this.isMarqueeSelecting = false;
		this.marqueeStart = { x: 0, y: 0 };
		this.marqueeEnd = { x: 0, y: 0 };

		// Point tracking
		this.startPoint = null;
		this.dragStartPoint = null;
		this.lastPanPoint = null;
		this.lastTouchPoint = null;
		this.lastTouchTime = 0;

		// Handle being manipulated
		this.resizeHandle = null;
		this.originalLayerState = null;

		// Visual feedback
		this.showDragPreview = false;
		this.dragOffset = { x: 0, y: 0 };

		// Guide dragging
		this.isDraggingGuide = false;
		this.dragGuideOrientation = null; // 'h' | 'v'
		this.dragGuidePos = 0;
	}

	// =========================================================================
	// State Queries
	// =========================================================================

	/**
	 * Check if any manipulation is in progress
	 * @return {boolean}
	 */
	InteractionController.prototype.isManipulating = function () {
		return this.isDragging || this.isResizing || this.isRotating;
	};

	/**
	 * Check if any interaction is active
	 * @return {boolean}
	 */
	InteractionController.prototype.isInteracting = function () {
		return this.isManipulating() || this.isPanning || this.isMarqueeSelecting;
	};

	/**
	 * Get the current interaction mode
	 * @return {string} One of: 'none', 'dragging', 'resizing', 'rotating', 'panning', 'marquee'
	 */
	InteractionController.prototype.getMode = function () {
		if ( this.isDragging ) {
			return 'dragging';
		}
		if ( this.isResizing ) {
			return 'resizing';
		}
		if ( this.isRotating ) {
			return 'rotating';
		}
		if ( this.isPanning ) {
			return 'panning';
		}
		if ( this.isMarqueeSelecting ) {
			return 'marquee';
		}
		return 'none';
	};

	// =========================================================================
	// Drag Operations
	// =========================================================================

	/**
	 * Start a drag operation
	 * @param {Object} point Starting point {x, y}
	 * @param {Object} originalState Original layer state to preserve
	 */
	InteractionController.prototype.startDrag = function ( point, originalState ) {
		this.isDragging = true;
		this.startPoint = { x: point.x, y: point.y };
		this.dragStartPoint = { x: point.x, y: point.y };
		this.originalLayerState = originalState ? JSON.parse( JSON.stringify( originalState ) ) : null;
		this.showDragPreview = true;
	};

	/**
	 * Update drag position
	 * @param {Object} point Current point {x, y}
	 * @return {Object} Delta from start {deltaX, deltaY}
	 */
	InteractionController.prototype.updateDrag = function ( point ) {
		if ( !this.isDragging || !this.dragStartPoint ) {
			return { deltaX: 0, deltaY: 0 };
		}
		return {
			deltaX: point.x - this.dragStartPoint.x,
			deltaY: point.y - this.dragStartPoint.y
		};
	};

	/**
	 * Finish drag operation
	 * @return {Object|null} The original layer state for undo purposes
	 */
	InteractionController.prototype.finishDrag = function () {
		const originalState = this.originalLayerState;
		this.isDragging = false;
		this.showDragPreview = false;
		this.startPoint = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;
		return originalState;
	};

	// =========================================================================
	// Resize Operations
	// =========================================================================

	/**
	 * Start a resize operation
	 * @param {string} handle Handle type (e.g., 'nw', 'se', 'n', 'e')
	 * @param {Object} point Starting point {x, y}
	 * @param {Object} originalState Original layer state
	 */
	InteractionController.prototype.startResize = function ( handle, point, originalState ) {
		this.isResizing = true;
		this.resizeHandle = handle;
		this.startPoint = { x: point.x, y: point.y };
		this.dragStartPoint = { x: point.x, y: point.y };
		this.originalLayerState = originalState ? JSON.parse( JSON.stringify( originalState ) ) : null;
	};

	/**
	 * Update resize delta
	 * @param {Object} point Current point {x, y}
	 * @return {Object} Delta and handle info
	 */
	InteractionController.prototype.updateResize = function ( point ) {
		if ( !this.isResizing || !this.dragStartPoint ) {
			return { deltaX: 0, deltaY: 0, handle: null };
		}
		return {
			deltaX: point.x - this.dragStartPoint.x,
			deltaY: point.y - this.dragStartPoint.y,
			handle: this.resizeHandle
		};
	};

	/**
	 * Finish resize operation
	 * @return {Object|null} The original layer state for undo
	 */
	InteractionController.prototype.finishResize = function () {
		const originalState = this.originalLayerState;
		this.isResizing = false;
		this.resizeHandle = null;
		this.startPoint = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;
		return originalState;
	};

	// =========================================================================
	// Rotation Operations
	// =========================================================================

	/**
	 * Start a rotation operation
	 * @param {Object} point Starting point {x, y}
	 * @param {Object} originalState Original layer state
	 */
	InteractionController.prototype.startRotation = function ( point, originalState ) {
		this.isRotating = true;
		this.startPoint = { x: point.x, y: point.y };
		this.dragStartPoint = { x: point.x, y: point.y };
		this.originalLayerState = originalState ? JSON.parse( JSON.stringify( originalState ) ) : null;
	};

	/**
	 * Calculate rotation angle from start point
	 * @param {Object} point Current point {x, y}
	 * @param {Object} center Center of rotation {x, y}
	 * @return {number} Angle in degrees
	 */
	InteractionController.prototype.calculateRotationAngle = function ( point, center ) {
		if ( !this.startPoint || !center ) {
			return 0;
		}

		const startAngle = Math.atan2(
			this.startPoint.y - center.y,
			this.startPoint.x - center.x
		);
		const currentAngle = Math.atan2(
			point.y - center.y,
			point.x - center.x
		);

		// Convert to degrees
		return ( currentAngle - startAngle ) * ( 180 / Math.PI );
	};

	/**
	 * Finish rotation operation
	 * @return {Object|null} The original layer state for undo
	 */
	InteractionController.prototype.finishRotation = function () {
		const originalState = this.originalLayerState;
		this.isRotating = false;
		this.startPoint = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;
		return originalState;
	};

	// =========================================================================
	// Pan Operations
	// =========================================================================

	/**
	 * Start panning
	 * @param {Object} point Starting client point {x, y}
	 */
	InteractionController.prototype.startPan = function ( point ) {
		this.isPanning = true;
		this.lastPanPoint = { x: point.x, y: point.y };
	};

	/**
	 * Update pan position
	 * @param {Object} point Current client point {x, y}
	 * @return {Object} Pan delta {deltaX, deltaY}
	 */
	InteractionController.prototype.updatePan = function ( point ) {
		if ( !this.isPanning || !this.lastPanPoint ) {
			return { deltaX: 0, deltaY: 0 };
		}

		const delta = {
			deltaX: point.x - this.lastPanPoint.x,
			deltaY: point.y - this.lastPanPoint.y
		};

		this.lastPanPoint = { x: point.x, y: point.y };
		return delta;
	};

	/**
	 * Finish panning
	 */
	InteractionController.prototype.finishPan = function () {
		this.isPanning = false;
		this.lastPanPoint = null;
	};

	// =========================================================================
	// Marquee Selection
	// =========================================================================

	/**
	 * Start marquee selection
	 * @param {Object} point Starting point {x, y}
	 */
	InteractionController.prototype.startMarquee = function ( point ) {
		this.isMarqueeSelecting = true;
		this.marqueeStart = { x: point.x, y: point.y };
		this.marqueeEnd = { x: point.x, y: point.y };
	};

	/**
	 * Update marquee end point
	 * @param {Object} point Current point {x, y}
	 */
	InteractionController.prototype.updateMarquee = function ( point ) {
		if ( !this.isMarqueeSelecting ) {
			return;
		}
		this.marqueeEnd = { x: point.x, y: point.y };
	};

	/**
	 * Get the marquee rectangle (normalized)
	 * @return {Object} Rectangle {x, y, width, height}
	 */
	InteractionController.prototype.getMarqueeRect = function () {
		const x1 = Math.min( this.marqueeStart.x, this.marqueeEnd.x );
		const y1 = Math.min( this.marqueeStart.y, this.marqueeEnd.y );
		const x2 = Math.max( this.marqueeStart.x, this.marqueeEnd.x );
		const y2 = Math.max( this.marqueeStart.y, this.marqueeEnd.y );

		return {
			x: x1,
			y: y1,
			width: x2 - x1,
			height: y2 - y1
		};
	};

	/**
	 * Finish marquee selection
	 * @return {Object} The final marquee rectangle
	 */
	InteractionController.prototype.finishMarquee = function () {
		const rect = this.getMarqueeRect();
		this.isMarqueeSelecting = false;
		this.marqueeStart = { x: 0, y: 0 };
		this.marqueeEnd = { x: 0, y: 0 };
		return rect;
	};

	// =========================================================================
	// Touch Handling
	// =========================================================================

	/**
	 * Record a touch point for gesture detection
	 * @param {Object} point Touch point {x, y}
	 */
	InteractionController.prototype.recordTouch = function ( point ) {
		this.lastTouchPoint = { x: point.x, y: point.y };
		this.lastTouchTime = Date.now();
	};

	/**
	 * Check if this is a double-tap
	 * @param {Object} point Current touch point
	 * @param {number} maxDelay Maximum delay between taps (ms)
	 * @param {number} maxDistance Maximum distance between taps (px)
	 * @return {boolean}
	 */
	InteractionController.prototype.isDoubleTap = function ( point, maxDelay, maxDistance ) {
		maxDelay = maxDelay || 300;
		maxDistance = maxDistance || 30;

		if ( !this.lastTouchPoint ) {
			return false;
		}

		const timeDelta = Date.now() - this.lastTouchTime;
		if ( timeDelta > maxDelay ) {
			return false;
		}

		const distance = Math.sqrt(
			Math.pow( point.x - this.lastTouchPoint.x, 2 ) +
			Math.pow( point.y - this.lastTouchPoint.y, 2 )
		);

		return distance <= maxDistance;
	};

	/**
	 * Clear touch state
	 */
	InteractionController.prototype.clearTouch = function () {
		this.lastTouchPoint = null;
		this.lastTouchTime = 0;
	};

	// =========================================================================
	// Guide Dragging
	// =========================================================================

	/**
	 * Start dragging a guide
	 * @param {string} orientation 'h' for horizontal, 'v' for vertical
	 * @param {number} position Initial position
	 */
	InteractionController.prototype.startGuideDrag = function ( orientation, position ) {
		this.isDraggingGuide = true;
		this.dragGuideOrientation = orientation;
		this.dragGuidePos = position;
	};

	/**
	 * Update guide position
	 * @param {number} position New position
	 */
	InteractionController.prototype.updateGuideDrag = function ( position ) {
		if ( !this.isDraggingGuide ) {
			return;
		}
		this.dragGuidePos = position;
	};

	/**
	 * Finish guide dragging
	 * @return {Object|null} Guide info {orientation, position} or null
	 */
	InteractionController.prototype.finishGuideDrag = function () {
		if ( !this.isDraggingGuide ) {
			return null;
		}

		const result = {
			orientation: this.dragGuideOrientation,
			position: this.dragGuidePos
		};

		this.isDraggingGuide = false;
		this.dragGuideOrientation = null;
		this.dragGuidePos = 0;

		return result;
	};

	// =========================================================================
	// Reset
	// =========================================================================

	/**
	 * Reset all interaction state
	 */
	InteractionController.prototype.reset = function () {
		this.isDragging = false;
		this.isResizing = false;
		this.isRotating = false;
		this.isPanning = false;
		this.isMarqueeSelecting = false;
		this.isDraggingGuide = false;

		this.startPoint = null;
		this.dragStartPoint = null;
		this.lastPanPoint = null;
		this.lastTouchPoint = null;
		this.lastTouchTime = 0;

		this.resizeHandle = null;
		this.originalLayerState = null;
		this.showDragPreview = false;

		this.marqueeStart = { x: 0, y: 0 };
		this.marqueeEnd = { x: 0, y: 0 };

		this.dragGuideOrientation = null;
		this.dragGuidePos = 0;
	};

	/**
	 * Clean up resources
	 */
	InteractionController.prototype.destroy = function () {
		this.reset();
		this.canvasManager = null;
	};

	// =========================================================================
	// Export
	// =========================================================================

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.InteractionController = InteractionController;

		// Backward compatibility - direct window export
		window.InteractionController = InteractionController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = InteractionController;
	}

}() );
