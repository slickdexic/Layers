/**
 * Event Handler for Layers Editor
 * Handles mouse, touch, and keyboard events
 */
( function () {
	'use strict';

	/**
	 * Minimal typedef for CanvasManager used for JSDoc references in this file.
	 * This avoids jsdoc/no-undefined-types without changing runtime behavior.
	 *
	 * @typedef {Object} CanvasManager
	 * @property {HTMLCanvasElement} canvas
	 * @property {CanvasRenderingContext2D} ctx
	 */

	/**
	 * EventHandler class
	 *
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 * @class
	 */
	function EventHandler( config, canvasManager ) {
		// Back-compat: allow new EventHandler(canvasManager)
		if ( config && !canvasManager && ( config.canvas || config.layers ) ) {
			canvasManager = config;
			config = {};
		}

		this.config = config || {};
		this.canvasManager = canvasManager;
		this.canvas = canvasManager.canvas;

		// Event state
		this.isMouseDown = false;
		this.lastMousePoint = null;
		this.touches = {};
		// Compat for tests
		this.lastTouchTime = 0;
		this.spacePressed = false;

		this.setupEventListeners();
	}

	/**
	 * Set up all event listeners
	 */
	EventHandler.prototype.setupEventListeners = function () {
		const self = this;
		this.listeners = {};

		// Mouse events
		this.listeners.mousedown = function ( e ) {
			self.handleMouseDown( e );
		};
		this.listeners.mousemove = function ( e ) {
			self.handleMouseMove( e );
		};
		this.listeners.mouseup = function ( e ) {
			self.handleMouseUp( e );
		};

		this.canvas.addEventListener( 'mousedown', this.listeners.mousedown );
		this.canvas.addEventListener( 'mousemove', this.listeners.mousemove );
		this.canvas.addEventListener( 'mouseup', this.listeners.mouseup );

		// Touch events for mobile support
		this.listeners.touchstart = function ( e ) {
			e.preventDefault();
			self.handleTouchStart( e );
		};
		this.listeners.touchmove = function ( e ) {
			e.preventDefault();
			self.handleTouchMove( e );
		};
		this.listeners.touchend = function ( e ) {
			e.preventDefault();
			self.handleTouchEnd( e );
		};
		this.listeners.touchcancel = function ( e ) {
			e.preventDefault();
			self.handleTouchEnd( e );
		};

		this.canvas.addEventListener( 'touchstart', this.listeners.touchstart );
		this.canvas.addEventListener( 'touchmove', this.listeners.touchmove );
		this.canvas.addEventListener( 'touchend', this.listeners.touchend );
		this.canvas.addEventListener( 'touchcancel', this.listeners.touchcancel );

		// Wheel event: handled by CanvasManager to centralize zoom-to-pointer logic

		// Prevent context menu
		this.canvas.addEventListener( 'contextmenu', ( e ) => {
			e.preventDefault();
		} );

		// Keyboard events for pan and zoom
		document.addEventListener( 'keydown', ( e ) => {
			self.handleKeyDown( e );
		} );

		document.addEventListener( 'keyup', ( e ) => {
			self.handleKeyUp( e );
		} );

		// Window resize
		window.addEventListener( 'resize', () => {
			self.handleResize();
		} );
	};

	/**
	 * Handle mouse down events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	EventHandler.prototype.handleMouseDown = function ( e ) {
		if ( e && typeof e.preventDefault === 'function' ) {
			e.preventDefault();
		}
		// Only left button
		if ( e && typeof e.button === 'number' && e.button !== 0 ) {
			this.isMouseDown = false;
			return;
		}

		this.isMouseDown = true;
		const coords = this.getCoordsFromEvent( e );
		this.lastMousePoint = coords;

		// Prefer pointer-based APIs if available
		if ( this.canvasManager && typeof this.canvasManager.handlePointerDown === 'function' ) {
			this.canvasManager.handlePointerDown( coords.x, coords.y );
		} else if ( typeof this.canvasManager.handleMouseDown === 'function' ) {
			this.canvasManager.handleMouseDown( e );
		}
	};

	/**
	 * Handle mouse move events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	EventHandler.prototype.handleMouseMove = function ( e ) {
		if ( e && typeof e.preventDefault === 'function' ) {
			e.preventDefault();
		}
		// Only process move when actively dragging (compat with legacy tests)
		if ( !this.isMouseDown ) {
			return;
		}
		const coords = this.getCoordsFromEvent( e );
		this.lastMousePoint = coords;

		if ( this.canvasManager && typeof this.canvasManager.handlePointerMove === 'function' ) {
			this.canvasManager.handlePointerMove( coords.x, coords.y );
		} else if ( typeof this.canvasManager.handleMouseMove === 'function' ) {
			this.canvasManager.handleMouseMove( e );
		}
	};

	/**
	 * Handle mouse up events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	EventHandler.prototype.handleMouseUp = function ( e ) {
		if ( e && typeof e.preventDefault === 'function' ) {
			e.preventDefault();
		}
		this.isMouseDown = false;
		const coords = this.getCoordsFromEvent( e );

		if ( this.canvasManager && typeof this.canvasManager.handlePointerUp === 'function' ) {
			this.canvasManager.handlePointerUp( coords.x, coords.y );
		} else if ( typeof this.canvasManager.handleMouseUp === 'function' ) {
			this.canvasManager.handleMouseUp( e );
		}
	};

	/**
	 * Handle touch start events
	 *
	 * @param {TouchEvent} e Touch event
	 */
	EventHandler.prototype.handleTouchStart = function ( e ) {
		if ( e && typeof e.preventDefault === 'function' ) {
			e.preventDefault();
		}
		const touch = e.touches[ 0 ];
		// Compute canvas-relative coords
		const rect = this.canvas.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		const y = touch.clientY - rect.top;
		const downEvt = {
			preventDefault: function () {},
			button: 0,
			offsetX: x,
			offsetY: y
		};
		this.handleMouseDown( downEvt );

		// Store touch for multi-touch gestures
		for ( let i = 0; i < e.touches.length; i++ ) {
			const t = e.touches[ i ];
			this.touches[ t.identifier ] = {
				x: t.clientX,
				y: t.clientY,
				startTime: Date.now()
			};
		}
		this.lastTouchTime = Date.now();
	};

	/**
	 * Handle touch move events
	 *
	 * @param {TouchEvent} e Touch event
	 */
	EventHandler.prototype.handleTouchMove = function ( e ) {
		if ( e && typeof e.preventDefault === 'function' ) {
			e.preventDefault();
		}
		const touch = e.touches[ 0 ];
		const rect = this.canvas.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		const y = touch.clientY - rect.top;
		// Call pointer move directly for touch; don't require isMouseDown
		if ( this.canvasManager && typeof this.canvasManager.handlePointerMove === 'function' ) {
			this.canvasManager.handlePointerMove( x, y );
		} else if ( typeof this.canvasManager.handleMouseMove === 'function' ) {
			this.canvasManager.handleMouseMove( { offsetX: x, offsetY: y } );
		}

		// Handle pinch-to-zoom
		if ( e.touches.length === 2 ) {
			this.handlePinchZoom( e );
		}
	};

	/**
	 * Handle touch end events
	 *
	 * @param {TouchEvent} e Touch event
	 */
	EventHandler.prototype.handleTouchEnd = function ( e ) {
		if ( e && typeof e.preventDefault === 'function' ) {
			e.preventDefault();
		}
		// Use last changed touch position to compute coords
		const t = e.changedTouches && e.changedTouches[ 0 ];
		const rect = this.canvas.getBoundingClientRect();
		const x = t ? ( t.clientX - rect.left ) : 0;
		const y = t ? ( t.clientY - rect.top ) : 0;
		if ( this.canvasManager && typeof this.canvasManager.handlePointerUp === 'function' ) {
			this.canvasManager.handlePointerUp( x, y );
		} else if ( typeof this.canvasManager.handleMouseUp === 'function' ) {
			this.canvasManager.handleMouseUp( { offsetX: x, offsetY: y } );
		}

		// Clean up touch tracking
		for ( let i = 0; i < e.changedTouches.length; i++ ) {
			const touch = e.changedTouches[ i ];
			delete this.touches[ touch.identifier ];
		}
	};

	/**
	 * Handle mouse wheel events for zooming
	 *
	 * @param {WheelEvent} e Wheel event
	 */
	EventHandler.prototype.handleWheel = function ( e ) {
		const delta = e.deltaY > 0 ? -0.1 : 0.1;
		const point = this.getMousePoint( e );

		// Delegate to canvas manager
		this.canvasManager.zoomBy( delta, point );
	};

	/**
	 * Handle pinch-to-zoom gestures
	 *
	 * @param {TouchEvent} e Touch event
	 */
	EventHandler.prototype.handlePinchZoom = function ( e ) {
		const touch1 = e.touches[ 0 ];
		const touch2 = e.touches[ 1 ];

		const currentDistance = Math.sqrt(
			Math.pow( touch2.clientX - touch1.clientX, 2 ) +
			Math.pow( touch2.clientY - touch1.clientY, 2 )
		);

		if ( this.lastPinchDistance ) {
			const delta = ( currentDistance - this.lastPinchDistance ) * 0.01;
			const centerX = ( touch1.clientX + touch2.clientX ) / 2;
			const centerY = ( touch1.clientY + touch2.clientY ) / 2;

			const point = this.canvasManager.getMousePointFromClient( centerX, centerY );
			this.canvasManager.zoomBy( delta, point );
		}

		this.lastPinchDistance = currentDistance;
	};

	/**
	 * Handle keyboard down events
	 *
	 * @param {KeyboardEvent} e Keyboard event
	 */
	EventHandler.prototype.handleKeyDown = function ( e ) {
		// Check if we're in an input field (guard target for tests)
		const target = e && e.target ? e.target : {};
		const tag = ( target.tagName || '' ).toUpperCase();
		const isEditable = !!target.isContentEditable;
		if ( tag === 'INPUT' || tag === 'TEXTAREA' || isEditable ) {
			return;
		}

		let handled = false;

		// Zoom shortcuts
		if ( e.ctrlKey || e.metaKey ) {
			switch ( e.key ) {
				case '+':
				case '=':
					this.canvasManager.zoomIn();
					handled = true;
					break;
				case '-':
					this.canvasManager.zoomOut();
					handled = true;
					break;
				case '0':
					this.canvasManager.resetZoom();
					handled = true;
					break;
			}
		}

		// Undo/Redo
		if ( ( e.ctrlKey || e.metaKey ) && !e.shiftKey && e.key === 'z' ) {
			this.canvasManager.undo();
			handled = true;
		} else if ( ( ( e.ctrlKey || e.metaKey ) && e.shiftKey && e.key === 'z' ) ||
					( ( e.ctrlKey || e.metaKey ) && e.key === 'y' ) ) {
			this.canvasManager.redo();
			handled = true;
		}

		// Copy/Paste/Delete
		if ( e.ctrlKey || e.metaKey ) {
			switch ( e.key ) {
				case 'c':
					this.canvasManager.copy();
					handled = true;
					break;
				case 'v':
					this.canvasManager.paste();
					handled = true;
					break;
				case 'a':
					this.canvasManager.selectAll();
					handled = true;
					break;
			}
		}

		if ( e.key === 'Delete' || e.key === 'Backspace' ) {
			if ( this.canvasManager && typeof this.canvasManager.deleteSelected === 'function' ) {
				this.canvasManager.deleteSelected();
			} else if ( this.canvasManager && typeof this.canvasManager.deleteSelectedLayers === 'function' ) {
				this.canvasManager.deleteSelectedLayers();
			}
			handled = true;
		}

		// Arrow keys for nudging
		if (
			this.canvasManager.selectedLayerIds &&
			this.canvasManager.selectedLayerIds.length > 0
		) {
			const nudgeDistance = e.shiftKey ? 10 : 1;
			switch ( e.key ) {
				case 'ArrowLeft':
					this.canvasManager.nudgeSelected( -nudgeDistance, 0 );
					handled = true;
					break;
				case 'ArrowRight':
					this.canvasManager.nudgeSelected( nudgeDistance, 0 );
					handled = true;
					break;
				case 'ArrowUp':
					this.canvasManager.nudgeSelected( 0, -nudgeDistance );
					handled = true;
					break;
				case 'ArrowDown':
					this.canvasManager.nudgeSelected( 0, nudgeDistance );
					handled = true;
					break;
			}
		}

		// Pan with space + arrow keys
		if ( e.key === ' ' ) {
			this.spacePressed = true;
			this.canvas.style.cursor = 'grab';
			handled = true;
		}

		if ( handled ) {
			e.preventDefault();
		}
	};

	/**
	 * Handle keyboard up events
	 *
	 * @param {KeyboardEvent} e Keyboard event
	 */
	EventHandler.prototype.handleKeyUp = function ( e ) {
		if ( e.key === ' ' ) {
			this.spacePressed = false;
			this.canvas.style.cursor = this.canvasManager.getToolCursor(
				this.canvasManager.currentTool
			);
		}
	};

	/**
	 * Handle window resize events
	 */
	EventHandler.prototype.handleResize = function () {
		// Delegate to canvas manager
		this.canvasManager.resizeCanvas();
	};

	/**
	 * Get mouse point in canvas coordinates
	 *
	 * @param {MouseEvent} e Mouse event
	 * @return {Object} Point with x, y coordinates
	 */
	EventHandler.prototype.getMousePoint = function ( e ) {
		return this.canvasManager.getMousePoint( e );
	};

	/**
	 * Get mouse point from client coordinates
	 *
	 * @param {number} clientX Client X coordinate
	 * @param {number} clientY Client Y coordinate
	 * @return {Object} Point with x, y coordinates
	 */
	EventHandler.prototype.getMousePointFromClient = function ( clientX, clientY ) {
		const pt = this.canvasManager.getMousePointFromClient( clientX, clientY );
		pt.clientX = clientX;
		pt.clientY = clientY;
		return pt;
	};

	/**
	 * Destroy event handler and clean up listeners
	 */
	EventHandler.prototype.destroy = function () {
		if ( this.canvas && this.listeners ) {
			this.canvas.removeEventListener( 'mousedown', this.listeners.mousedown );
			this.canvas.removeEventListener( 'mousemove', this.listeners.mousemove );
			this.canvas.removeEventListener( 'mouseup', this.listeners.mouseup );
			this.canvas.removeEventListener( 'touchstart', this.listeners.touchstart );
			this.canvas.removeEventListener( 'touchmove', this.listeners.touchmove );
			this.canvas.removeEventListener( 'touchend', this.listeners.touchend );
			this.canvas.removeEventListener( 'touchcancel', this.listeners.touchcancel );
		}
		this.listeners = null;
		this.canvas = null;
		this.canvasManager = null;
		this.touches = {};
	};

	// Internal: normalize event to canvas-relative coords
	EventHandler.prototype.getCoordsFromEvent = function ( e ) {
		if ( e && typeof e.offsetX === 'number' && typeof e.offsetY === 'number' ) {
			return { x: e.offsetX, y: e.offsetY };
		}
		const rect = this.canvas.getBoundingClientRect();
		const cx = ( e && typeof e.clientX === 'number' ) ? e.clientX : 0;
		const cy = ( e && typeof e.clientY === 'number' ) ? e.clientY : 0;
		return { x: cx - rect.left, y: cy - rect.top };
	};

	// Maintain a private alias for back-compat with in-flight patches
	// Alias removed to satisfy style rules; all internal references use getCoordsFromEvent

	// Export EventHandler to global scope
	window.LayersEventHandler = EventHandler;

	// Also export via CommonJS when available (for Jest tests)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = EventHandler;
	}

}() );
