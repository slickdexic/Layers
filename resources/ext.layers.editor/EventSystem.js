/**
 * EventSystem Module for Layers Editor
 * Handles mouse, touch, and keyboard event management
 * Extracted from CanvasManager.js - manages all user interactions and input handling
 */
( function () {
	'use strict';

	/**
	 * EventSystem - Manages all user input events and interactions
	 *
	 * @param {HTMLCanvasElement} canvas - Canvas element to attach events to
	 * @param {Object} config - Configuration options
	 * @class
	 */
	function EventSystem( canvas, config ) {
		this.canvas = canvas;
		this.config = config || {};

		// Editor reference for callbacks
		this.editor = this.config.editor || null;

		// Event state tracking
		this.isDragging = false;
		this.isDrawing = false;
		this.isPanning = false;
		this.isResizing = false;
		this.isRotating = false;
		this.isMarqueeSelecting = false;
		this.isDraggingGuide = false;

		// Touch and gesture state
		this.isPinching = false;
		this.lastTouchTime = 0;
		this.initialPinchDistance = 0;
		this.initialZoom = 1.0;

		// Keyboard state
		this.spacePressed = false;
		this.ctrlPressed = false;
		this.shiftPressed = false;
		this.altPressed = false;

		// Position tracking
		this.startPoint = null;
		this.dragStartPoint = null;
		this.lastPanPoint = null;
		this.currentPoint = null;

		// Event callbacks - will be set by the host
		this.callbacks = {
			onMouseDown: null,
			onMouseMove: null,
			onMouseUp: null,
			onKeyDown: null,
			onKeyUp: null,
			onWheel: null,
			onDoubleClick: null,
			onContextMenu: null
		};

		this.init();
	}

	/**
	 * Initialize the event system
	 */
	EventSystem.prototype.init = function () {
		this.setupEventHandlers();
	};

	/**
	 * Set up all event listeners
	 */
	EventSystem.prototype.setupEventHandlers = function () {
		const self = this;

		// Store bound functions for later removal
		this.boundHandlers = {
			mousedown: ( e ) => self.handleMouseDown( e ),
			mousemove: ( e ) => self.handleMouseMove( e ),
			mouseup: ( e ) => self.handleMouseUp( e ),
			dblclick: ( e ) => self.handleDoubleClick( e ),
			touchstart: ( e ) => { e.preventDefault(); self.handleTouchStart( e ); },
			touchmove: ( e ) => { e.preventDefault(); self.handleTouchMove( e ); },
			touchend: ( e ) => { e.preventDefault(); self.handleTouchEnd( e ); },
			touchcancel: ( e ) => { e.preventDefault(); self.handleTouchEnd( e ); },
			wheel: ( e ) => { e.preventDefault(); self.handleWheel( e ); },
			contextmenu: ( e ) => { e.preventDefault(); self.handleContextMenu( e ); },
			keydown: ( e ) => self.handleKeyDown( e ),
			keyup: ( e ) => self.handleKeyUp( e ),
			blur: () => self.resetKeyStates()
		};

		// Mouse events
		this.canvas.addEventListener( 'mousedown', this.boundHandlers.mousedown );
		this.canvas.addEventListener( 'mousemove', this.boundHandlers.mousemove );
		this.canvas.addEventListener( 'mouseup', this.boundHandlers.mouseup );
		this.canvas.addEventListener( 'dblclick', this.boundHandlers.dblclick );

		// Touch events for mobile support
		this.canvas.addEventListener( 'touchstart', this.boundHandlers.touchstart );
		this.canvas.addEventListener( 'touchmove', this.boundHandlers.touchmove );
		this.canvas.addEventListener( 'touchend', this.boundHandlers.touchend );
		this.canvas.addEventListener( 'touchcancel', this.boundHandlers.touchcancel );

		// Wheel event for zooming
		this.canvas.addEventListener( 'wheel', this.boundHandlers.wheel );

		// Prevent context menu
		this.canvas.addEventListener( 'contextmenu', this.boundHandlers.contextmenu );

		// Keyboard events
		document.addEventListener( 'keydown', this.boundHandlers.keydown );
		document.addEventListener( 'keyup', this.boundHandlers.keyup );

		// Window events for cleanup
		window.addEventListener( 'blur', this.boundHandlers.blur );
	};

	/**
	 * Handle mouse down events
	 *
	 * @param {MouseEvent} e - Mouse event
	 */
	EventSystem.prototype.handleMouseDown = function ( e ) {
		this.updateKeyStates( e );
		this.startPoint = this.getEventCoordinates( e );
		this.dragStartPoint = this.startPoint;
		this.currentPoint = this.startPoint;

		// Ignore right click (handled by context menu)
		if ( e.button === 2 ) {
			return;
		}

		// Pass through middle mouse button (button 1) for pan operations
		// CanvasManager will handle pan mode for both middle-click and space+left-click
		// Pass through left mouse button (button 0) for normal operations
		// All other buttons are ignored

		// Call registered callback (let CanvasManager handle panning and operations)
		if ( this.callbacks.onMouseDown ) {
			this.callbacks.onMouseDown( e, this.startPoint );
		}
	};

	/**
	 * Handle mouse move events
	 *
	 * @param {MouseEvent} e - Mouse event
	 */
	EventSystem.prototype.handleMouseMove = function ( e ) {
		this.updateKeyStates( e );
		this.currentPoint = this.getEventCoordinates( e );

		// Call registered callback (CanvasManager handles panning)
		if ( this.callbacks.onMouseMove ) {
			this.callbacks.onMouseMove( e, this.currentPoint );
		}
	};

	/**
	 * Handle mouse up events
	 *
	 * @param {MouseEvent} e - Mouse event
	 */
	EventSystem.prototype.handleMouseUp = function ( e ) {
		this.updateKeyStates( e );

		// Reset interaction states
		this.isDragging = false;
		this.isDrawing = false;
		this.isResizing = false;
		this.isRotating = false;
		this.isMarqueeSelecting = false;
		this.isDraggingGuide = false;

		// Call registered callback (CanvasManager handles panning cleanup)
		if ( this.callbacks.onMouseUp ) {
			this.callbacks.onMouseUp( e, this.currentPoint );
		}

		// Reset points
		this.startPoint = null;
		this.dragStartPoint = null;
	};

	/**
	 * Handle double click events
	 *
	 * @param {MouseEvent} e - Mouse event
	 */
	EventSystem.prototype.handleDoubleClick = function ( e ) {
		const point = this.getEventCoordinates( e );

		// Call registered callback
		if ( this.callbacks.onDoubleClick ) {
			this.callbacks.onDoubleClick( e, point );
		}
	};

	/**
	 * Handle touch start events
	 *
	 * @param {TouchEvent} e - Touch event
	 */
	EventSystem.prototype.handleTouchStart = function ( e ) {
		const touch = e.touches[ 0 ];
		if ( !touch ) {
			return;
		}

		// Handle multi-touch gestures
		if ( e.touches.length > 1 ) {
			this.handlePinchStart( e );
			return;
		}

		// Convert touch to mouse event
		const mouseEvent = this.touchToMouseEvent( touch, 'mousedown' );
		this.lastTouchTime = Date.now();
		this.handleMouseDown( mouseEvent );
	};

	/**
	 * Handle touch move events
	 *
	 * @param {TouchEvent} e - Touch event
	 */
	EventSystem.prototype.handleTouchMove = function ( e ) {
		const touch = e.touches[ 0 ];
		if ( !touch ) {
			return;
		}

		// Handle multi-touch gestures
		if ( e.touches.length > 1 ) {
			this.handlePinchMove( e );
			return;
		}

		// Convert touch to mouse event
		const mouseEvent = this.touchToMouseEvent( touch, 'mousemove' );
		this.handleMouseMove( mouseEvent );
	};

	/**
	 * Handle touch end events
	 *
	 * @param {TouchEvent} e - Touch event
	 */
	EventSystem.prototype.handleTouchEnd = function ( e ) {
		// Handle double-tap for zoom
		const now = Date.now();
		if ( this.lastTouchTime && ( now - this.lastTouchTime ) < 300 ) {
			this.handleDoubleTap( e );
			return;
		}

		// Handle pinch end
		if ( this.isPinching ) {
			this.handlePinchEnd( e );
			return;
		}

		// Convert touch to mouse event
		const mouseEvent = this.touchToMouseEvent( null, 'mouseup' );
		this.handleMouseUp( mouseEvent );
	};

	/**
	 * Handle pinch start for zoom gestures
	 *
	 * @param {TouchEvent} e - Touch event
	 */
	EventSystem.prototype.handlePinchStart = function ( e ) {
		if ( e.touches.length !== 2 ) {
			return;
		}

		this.isPinching = true;
		const touch1 = e.touches[ 0 ];
		const touch2 = e.touches[ 1 ];

		this.initialPinchDistance = Math.sqrt(
			Math.pow( touch2.clientX - touch1.clientX, 2 ) +
			Math.pow( touch2.clientY - touch1.clientY, 2 )
		);

		// Store initial zoom if available
		const canvasMgr = this.editor && this.editor.canvasManager;
		if ( canvasMgr && canvasMgr.transformationEngine ) {
			this.initialZoom = canvasMgr.transformationEngine.getZoom();
		}
	};

	/**
	 * Handle pinch move for zoom gestures
	 *
	 * @param {TouchEvent} e - Touch event
	 */
	EventSystem.prototype.handlePinchMove = function ( e ) {
		if ( !this.isPinching || e.touches.length !== 2 ) {
			return;
		}

		const touch1 = e.touches[ 0 ];
		const touch2 = e.touches[ 1 ];

		const currentDistance = Math.sqrt(
			Math.pow( touch2.clientX - touch1.clientX, 2 ) +
			Math.pow( touch2.clientY - touch1.clientY, 2 )
		);

		const scaleFactor = currentDistance / this.initialPinchDistance;
		const newZoom = this.initialZoom * scaleFactor;

		// Apply zoom via transformation engine if available
		const canvasMgr = this.editor && this.editor.canvasManager;
		if ( canvasMgr && canvasMgr.transformationEngine ) {
			canvasMgr.transformationEngine.setZoom( newZoom );
		}
	};

	/**
	 * Handle pinch end
	 */
	EventSystem.prototype.handlePinchEnd = function () {
		this.isPinching = false;
		this.initialPinchDistance = 0;
		this.initialZoom = 1.0;
	};

	/**
	 * Handle double tap for zoom
	 */
	EventSystem.prototype.handleDoubleTap = function () {
		// Toggle between fit and 100% zoom
		const canvasMgr = this.editor && this.editor.canvasManager;
		if ( canvasMgr && canvasMgr.transformationEngine ) {
			const currentZoom = canvasMgr.transformationEngine.getZoom();
			if ( currentZoom === 1.0 ) {
				canvasMgr.transformationEngine.fitToWindow();
			} else {
				canvasMgr.transformationEngine.setZoom( 1.0 );
			}
		}
	};

	/**
	 * Handle wheel events for zooming
	 *
	 * @param {WheelEvent} e - Wheel event
	 */
	EventSystem.prototype.handleWheel = function ( e ) {
		// Call registered callback
		if ( this.callbacks.onWheel ) {
			this.callbacks.onWheel( e );
		}
	};

	/**
	 * Handle context menu events
	 *
	 * @param {MouseEvent} e - Mouse event
	 */
	EventSystem.prototype.handleContextMenu = function ( e ) {
		// Call registered callback
		if ( this.callbacks.onContextMenu ) {
			this.callbacks.onContextMenu( e );
		}
	};

	/**
	 * Handle keyboard down events
	 *
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	EventSystem.prototype.handleKeyDown = function ( e ) {
		// Don't handle keys when typing in input fields
		if ( this.isInputFocused( e.target ) ) {
			return;
		}

		this.updateKeyStates( e );

		// Handle space key for panning
		if ( e.code === 'Space' ) {
			e.preventDefault();
			this.spacePressed = true;
			if ( this.canvas ) {
				this.canvas.style.cursor = 'grab';
			}
		}

		// Call registered callback
		if ( this.callbacks.onKeyDown ) {
			this.callbacks.onKeyDown( e );
		}
	};

	/**
	 * Handle keyboard up events
	 *
	 * @param {KeyboardEvent} e - Keyboard event
	 */
	EventSystem.prototype.handleKeyUp = function ( e ) {
		this.updateKeyStates( e );

		// Handle space key release
		if ( e.code === 'Space' ) {
			this.spacePressed = false;
			if ( this.canvas ) {
				this.canvas.style.cursor = 'default';
			}
		}

		// Call registered callback
		if ( this.callbacks.onKeyUp ) {
			this.callbacks.onKeyUp( e );
		}
	};

	/**
	 * Start panning operation
	 *
	 * @param {MouseEvent} e - Mouse event
	 */
	EventSystem.prototype.startPanning = function ( e ) {
		this.isPanning = true;
		this.lastPanPoint = { x: e.clientX, y: e.clientY };
		if ( this.canvas ) {
			this.canvas.style.cursor = 'grabbing';
		}
	};

	/**
	 * Update panning during drag
	 *
	 * @param {MouseEvent} e - Mouse event
	 */
	EventSystem.prototype.updatePanning = function ( e ) {
		if ( !this.isPanning || !this.lastPanPoint ) {
			return;
		}

		// Update pan via transformation engine if available
		const canvasMgr = this.editor && this.editor.canvasManager;
		if ( canvasMgr && canvasMgr.transformationEngine ) {
			canvasMgr.transformationEngine.updatePan( e.clientX, e.clientY );
		}

		this.lastPanPoint = { x: e.clientX, y: e.clientY };
	};

	/**
	 * Stop panning operation
	 */
	EventSystem.prototype.stopPanning = function () {
		this.isPanning = false;
		this.lastPanPoint = null;

		// Update pan via transformation engine if available
		const canvasMgr = this.editor && this.editor.canvasManager;
		if ( canvasMgr && canvasMgr.transformationEngine ) {
			canvasMgr.transformationEngine.stopPan();
		}

		if ( this.canvas ) {
			this.canvas.style.cursor = this.spacePressed ? 'grab' : 'default';
		}
	};

	/**
	 * Get coordinates from event (mouse or touch)
	 *
	 * @param {Event} e - Event object
	 * @return {Object} Coordinates {x, y}
	 */
	EventSystem.prototype.getEventCoordinates = function ( e ) {
		// Use canvasManager's transformation properties for coordinate conversion
		// This ensures we use the same values that CanvasManager applies to the context
		const canvasMgr = this.config.canvasManager || ( this.editor && this.editor.canvasManager );
		if ( canvasMgr ) {
			// Sync transformation properties to ensure they are current
			if ( canvasMgr.syncTransformProperties ) {
				canvasMgr.syncTransformProperties();
			}

			// Get basic canvas coordinates (relative to canvas element)
			const rect = this.canvas.getBoundingClientRect();
			const clientX = e.clientX - rect.left;
			const clientY = e.clientY - rect.top;

			// Account for CSS scaling if canvas is scaled
			const scaleX = this.canvas.width / rect.width;
			const scaleY = this.canvas.height / rect.height;
			const canvasX = clientX * scaleX;
			const canvasY = clientY * scaleY;

			// Apply inverse transformation (undo zoom and pan applied by CanvasManager)
			// Use CanvasManager's properties which are synced with TransformationEngine
			const panX = canvasMgr.panX || 0;
			const panY = canvasMgr.panY || 0;
			const zoom = canvasMgr.zoom || 1;

			const logicalX = ( canvasX - panX ) / zoom;
			const logicalY = ( canvasY - panY ) / zoom;

			return { x: logicalX, y: logicalY };
		}

		// Fallback to basic canvas coordinate calculation
		const fallbackRect = this.canvas.getBoundingClientRect();
		return {
			x: e.clientX - fallbackRect.left,
			y: e.clientY - fallbackRect.top
		};
	};

	/**
	 * Convert touch event to mouse event
	 *
	 * @param {Touch} touch - Touch object (or null for touch end)
	 * @param {string} type - Event type
	 * @return {Object} Mouse event object
	 */
	EventSystem.prototype.touchToMouseEvent = function ( touch, type ) {
		return {
			type: type,
			clientX: touch ? touch.clientX : 0,
			clientY: touch ? touch.clientY : 0,
			button: 0,
			preventDefault: function () {},
			stopPropagation: function () {}
		};
	};

	/**
	 * Update keyboard modifier states from event
	 *
	 * @param {Event} e - Event object
	 */
	EventSystem.prototype.updateKeyStates = function ( e ) {
		this.ctrlPressed = e.ctrlKey || e.metaKey;
		this.shiftPressed = e.shiftKey;
		this.altPressed = e.altKey;
	};

	/**
	 * Reset all keyboard states
	 */
	EventSystem.prototype.resetKeyStates = function () {
		this.spacePressed = false;
		this.ctrlPressed = false;
		this.shiftPressed = false;
		this.altPressed = false;
	};

	/**
	 * Check if an input element is focused
	 *
	 * @param {Element} target - Target element
	 * @return {boolean} True if input is focused
	 */
	EventSystem.prototype.isInputFocused = function ( target ) {
		return target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.contentEditable === 'true';
	};

	/**
	 * Set event callback
	 *
	 * @param {string} event - Event name
	 * @param {Function} callback - Callback function
	 */
	EventSystem.prototype.on = function ( event, callback ) {
		const callbackName = 'on' + event.charAt( 0 ).toUpperCase() + event.slice( 1 );
		if ( Object.prototype.hasOwnProperty.call( this.callbacks, callbackName ) ) {
			this.callbacks[ callbackName ] = callback;
		}
	};

	/**
	 * Remove event callback
	 *
	 * @param {string} event - Event name
	 */
	EventSystem.prototype.off = function ( event ) {
		const callbackName = 'on' + event.charAt( 0 ).toUpperCase() + event.slice( 1 );
		if ( Object.prototype.hasOwnProperty.call( this.callbacks, callbackName ) ) {
			this.callbacks[ callbackName ] = null;
		}
	};

	/**
	 * Get current interaction state
	 *
	 * @return {Object} Current state object
	 */
	EventSystem.prototype.getState = function () {
		return {
			isDragging: this.isDragging,
			isDrawing: this.isDrawing,
			isPanning: this.isPanning,
			isResizing: this.isResizing,
			isRotating: this.isRotating,
			isMarqueeSelecting: this.isMarqueeSelecting,
			isDraggingGuide: this.isDraggingGuide,
			isPinching: this.isPinching,
			spacePressed: this.spacePressed,
			ctrlPressed: this.ctrlPressed,
			shiftPressed: this.shiftPressed,
			altPressed: this.altPressed,
			startPoint: this.startPoint,
			currentPoint: this.currentPoint
		};
	};

	/**
	 * Set interaction state
	 *
	 * @param {string} state - State name
	 * @param {boolean} value - State value
	 */
	EventSystem.prototype.setState = function ( state, value ) {
		if ( Object.prototype.hasOwnProperty.call( this, state ) ) {
			this[ state ] = !!value;
		}
	};

	/**
	 * Update configuration options
	 *
	 * @param {Object} newConfig - New configuration options
	 */
	EventSystem.prototype.updateConfig = function ( newConfig ) {
		if ( newConfig ) {
			Object.keys( newConfig ).forEach( ( key ) => {
				this.config[ key ] = newConfig[ key ];
			} );

			// Update editor reference if provided
			if ( newConfig.editor ) {
				this.editor = newConfig.editor;
			}
		}
	};

	/**
	 * Clean up event listeners and resources
	 */
	EventSystem.prototype.destroy = function () {
		// Remove all event listeners using stored bound handlers
		if ( this.boundHandlers && this.canvas ) {
			this.canvas.removeEventListener( 'mousedown', this.boundHandlers.mousedown );
			this.canvas.removeEventListener( 'mousemove', this.boundHandlers.mousemove );
			this.canvas.removeEventListener( 'mouseup', this.boundHandlers.mouseup );
			this.canvas.removeEventListener( 'dblclick', this.boundHandlers.dblclick );
			this.canvas.removeEventListener( 'touchstart', this.boundHandlers.touchstart );
			this.canvas.removeEventListener( 'touchmove', this.boundHandlers.touchmove );
			this.canvas.removeEventListener( 'touchend', this.boundHandlers.touchend );
			this.canvas.removeEventListener( 'touchcancel', this.boundHandlers.touchcancel );
			this.canvas.removeEventListener( 'wheel', this.boundHandlers.wheel );
			this.canvas.removeEventListener( 'contextmenu', this.boundHandlers.contextmenu );
		}

		// Remove document event listeners
		if ( this.boundHandlers ) {
			document.removeEventListener( 'keydown', this.boundHandlers.keydown );
			document.removeEventListener( 'keyup', this.boundHandlers.keyup );
			window.removeEventListener( 'blur', this.boundHandlers.blur );
		}

		// Clear references
		this.boundHandlers = null;
		this.canvas = null;
		this.editor = null;
		this.config = null;
		this.callbacks = null;
	};

	// Export the module - ALWAYS set on window for cross-file dependencies
	if ( typeof window !== 'undefined' ) {
		window.EventSystem = EventSystem;
	}

	// Also export via CommonJS if available (for Node.js/Jest testing)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = EventSystem;
	}

	// MediaWiki ResourceLoader support
	if ( typeof mw !== 'undefined' && mw.loader ) {
		mw.loader.using( [], () => {
			mw.EventSystem = EventSystem;
		} );
	}

}() );
