/**
 * Event Handler for Layers Editor
 * Handles mouse, touch, and keyboard events
 */
( function () {
	'use strict';

	/**
	 * EventHandler class
	 *
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 * @class
	 */
	function EventHandler( config, canvasManager ) {
		this.config = config || {};
		this.canvasManager = canvasManager;
		this.canvas = canvasManager.canvas;

		// Event state
		this.isMouseDown = false;
		this.lastMousePoint = null;
		this.touches = {};

		this.setupEventListeners();
	}

	/**
	 * Set up all event listeners
	 */
	EventHandler.prototype.setupEventListeners = function () {
		var self = this;

		// Mouse events
		this.canvas.addEventListener( 'mousedown', function ( e ) {
			self.handleMouseDown( e );
		} );

		this.canvas.addEventListener( 'mousemove', function ( e ) {
			self.handleMouseMove( e );
		} );

		this.canvas.addEventListener( 'mouseup', function ( e ) {
			self.handleMouseUp( e );
		} );

		// Touch events for mobile support
		this.canvas.addEventListener( 'touchstart', function ( e ) {
			e.preventDefault(); // Prevent scrolling
			self.handleTouchStart( e );
		} );

		this.canvas.addEventListener( 'touchmove', function ( e ) {
			e.preventDefault(); // Prevent scrolling
			self.handleTouchMove( e );
		} );

		this.canvas.addEventListener( 'touchend', function ( e ) {
			e.preventDefault();
			self.handleTouchEnd( e );
		} );

		// Handle pinch-to-zoom on touch devices
		this.canvas.addEventListener( 'touchcancel', function ( e ) {
			e.preventDefault();
			self.handleTouchEnd( e );
		} );

		// Wheel event for zooming
		this.canvas.addEventListener( 'wheel', function ( e ) {
			e.preventDefault();
			self.handleWheel( e );
		} );

		// Prevent context menu
		this.canvas.addEventListener( 'contextmenu', function ( e ) {
			e.preventDefault();
		} );

		// Keyboard events for pan and zoom
		document.addEventListener( 'keydown', function ( e ) {
			self.handleKeyDown( e );
		} );

		document.addEventListener( 'keyup', function ( e ) {
			self.handleKeyUp( e );
		} );

		// Window resize
		window.addEventListener( 'resize', function () {
			self.handleResize();
		} );
	};

	/**
	 * Handle mouse down events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	EventHandler.prototype.handleMouseDown = function ( e ) {
		this.isMouseDown = true;
		var point = this.getMousePoint( e );
		this.lastMousePoint = point;

		// Delegate to canvas manager
		this.canvasManager.handleMouseDown( e );
	};

	/**
	 * Handle mouse move events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	EventHandler.prototype.handleMouseMove = function ( e ) {
		var point = this.getMousePoint( e );
		this.lastMousePoint = point;

		// Delegate to canvas manager
		this.canvasManager.handleMouseMove( e );
	};

	/**
	 * Handle mouse up events
	 *
	 * @param {MouseEvent} e Mouse event
	 */
	EventHandler.prototype.handleMouseUp = function ( e ) {
		this.isMouseDown = false;

		// Delegate to canvas manager
		this.canvasManager.handleMouseUp( e );
	};

	/**
	 * Handle touch start events
	 *
	 * @param {TouchEvent} e Touch event
	 */
	EventHandler.prototype.handleTouchStart = function ( e ) {
		var touch = e.touches[ 0 ];
		var mouseEvent = new MouseEvent( 'mousedown', {
			clientX: touch.clientX,
			clientY: touch.clientY
		} );
		this.handleMouseDown( mouseEvent );

		// Store touch for multi-touch gestures
		for ( var i = 0; i < e.touches.length; i++ ) {
			var t = e.touches[ i ];
			this.touches[ t.identifier ] = {
				x: t.clientX,
				y: t.clientY,
				startTime: Date.now()
			};
		}
	};

	/**
	 * Handle touch move events
	 *
	 * @param {TouchEvent} e Touch event
	 */
	EventHandler.prototype.handleTouchMove = function ( e ) {
		var touch = e.touches[ 0 ];
		var mouseEvent = new MouseEvent( 'mousemove', {
			clientX: touch.clientX,
			clientY: touch.clientY
		} );
		this.handleMouseMove( mouseEvent );

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
		var mouseEvent = new MouseEvent( 'mouseup', {
			clientX: this.lastMousePoint ? this.lastMousePoint.clientX : 0,
			clientY: this.lastMousePoint ? this.lastMousePoint.clientY : 0
		} );
		this.handleMouseUp( mouseEvent );

		// Clean up touch tracking
		for ( var i = 0; i < e.changedTouches.length; i++ ) {
			var touch = e.changedTouches[ i ];
			delete this.touches[ touch.identifier ];
		}
	};

	/**
	 * Handle mouse wheel events for zooming
	 *
	 * @param {WheelEvent} e Wheel event
	 */
	EventHandler.prototype.handleWheel = function ( e ) {
		var delta = e.deltaY > 0 ? -0.1 : 0.1;
		var point = this.getMousePoint( e );

		// Delegate to canvas manager
		this.canvasManager.zoom( delta, point );
	};

	/**
	 * Handle pinch-to-zoom gestures
	 *
	 * @param {TouchEvent} e Touch event
	 */
	EventHandler.prototype.handlePinchZoom = function ( e ) {
		var touch1 = e.touches[ 0 ];
		var touch2 = e.touches[ 1 ];

		var currentDistance = Math.sqrt(
			Math.pow( touch2.clientX - touch1.clientX, 2 ) +
			Math.pow( touch2.clientY - touch1.clientY, 2 )
		);

		if ( this.lastPinchDistance ) {
			var delta = ( currentDistance - this.lastPinchDistance ) * 0.01;
			var centerX = ( touch1.clientX + touch2.clientX ) / 2;
			var centerY = ( touch1.clientY + touch2.clientY ) / 2;

			var point = this.getMousePointFromClient( centerX, centerY );
			this.canvasManager.zoom( delta, point );
		}

		this.lastPinchDistance = currentDistance;
	};

	/**
	 * Handle keyboard down events
	 *
	 * @param {KeyboardEvent} e Keyboard event
	 */
	EventHandler.prototype.handleKeyDown = function ( e ) {
		// Check if we're in an input field
		if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable ) {
			return;
		}

		var handled = false;

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
			this.canvasManager.deleteSelected();
			handled = true;
		}

		// Arrow keys for nudging
		if ( this.canvasManager.selectedLayerIds && this.canvasManager.selectedLayerIds.length > 0 ) {
			var nudgeDistance = e.shiftKey ? 10 : 1;
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
			this.canvas.style.cursor = this.canvasManager.getToolCursor( this.canvasManager.currentTool );
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
		var rect = this.canvas.getBoundingClientRect();
		var canvasX = ( clientX - rect.left ) / this.canvasManager.zoom - this.canvasManager.panX;
		var canvasY = ( clientY - rect.top ) / this.canvasManager.zoom - this.canvasManager.panY;

		// Apply grid snapping if enabled
		if ( this.canvasManager.snapToGrid && this.canvasManager.showGrid ) {
			var gridSize = this.canvasManager.gridSize;
			canvasX = Math.round( canvasX / gridSize ) * gridSize;
			canvasY = Math.round( canvasY / gridSize ) * gridSize;
		}

		return {
			x: canvasX,
			y: canvasY,
			clientX: clientX,
			clientY: clientY
		};
	};

	/**
	 * Destroy event handler and clean up listeners
	 */
	EventHandler.prototype.destroy = function () {
		// Remove all event listeners
		// Note: In a production implementation, we'd store references to the bound functions
		// and remove them specifically. For now, this serves as a placeholder.
		this.canvas = null;
		this.canvasManager = null;
		this.touches = {};
	};

	// Export EventHandler to global scope
	window.LayersEventHandler = EventHandler;

}() );
