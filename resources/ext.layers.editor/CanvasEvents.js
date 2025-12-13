( function () {
	'use strict';

	/**
	 * CanvasEvents
	 * Handles DOM events for the CanvasManager
	 *
	 * @class CanvasEvents
	 */
	class CanvasEvents {
		/**
		 * Create a new CanvasEvents instance
		 *
		 * @param {CanvasManager} canvasManager
		 */
		constructor( canvasManager ) {
			this.cm = canvasManager;
			this.canvas = canvasManager.canvas;
			this.setup();
		}

		setup() {
			// Bind handlers
			this.onMouseDown = this.handleMouseDown.bind( this );
			this.onMouseMove = this.handleMouseMove.bind( this );
			this.onMouseUp = this.handleMouseUp.bind( this );
			this.onWheel = this.handleWheel.bind( this );
			this.onKeyDown = this.handleKeyDown.bind( this );
			this.onKeyUp = this.handleKeyUp.bind( this );
			this.onContextMenu = this.handleContextMenu.bind( this );

			// Attach to canvas
			this.canvas.addEventListener( 'mousedown', this.onMouseDown );
			this.canvas.addEventListener( 'mousemove', this.onMouseMove );
			this.canvas.addEventListener( 'mouseup', this.onMouseUp );
			this.canvas.addEventListener( 'wheel', this.onWheel, { passive: false } );
			this.canvas.addEventListener( 'contextmenu', this.onContextMenu );

			// Attach to document
			document.addEventListener( 'keydown', this.onKeyDown );
			document.addEventListener( 'keyup', this.onKeyUp );

			// Touch events
			this.onTouchStart = this.handleTouchStart.bind( this );
			this.onTouchMove = this.handleTouchMove.bind( this );
			this.onTouchEnd = this.handleTouchEnd.bind( this );

			this.canvas.addEventListener( 'touchstart', this.onTouchStart, { passive: false } );
			this.canvas.addEventListener( 'touchmove', this.onTouchMove, { passive: false } );
			this.canvas.addEventListener( 'touchend', this.onTouchEnd, { passive: false } );
			this.canvas.addEventListener( 'touchcancel', this.onTouchEnd, { passive: false } );
		}

		destroy() {
			this.canvas.removeEventListener( 'mousedown', this.onMouseDown );
			this.canvas.removeEventListener( 'mousemove', this.onMouseMove );
			this.canvas.removeEventListener( 'mouseup', this.onMouseUp );
			this.canvas.removeEventListener( 'wheel', this.onWheel );
			this.canvas.removeEventListener( 'contextmenu', this.onContextMenu );
			this.canvas.removeEventListener( 'touchstart', this.onTouchStart );
			this.canvas.removeEventListener( 'touchmove', this.onTouchMove );
			this.canvas.removeEventListener( 'touchend', this.onTouchEnd );
			this.canvas.removeEventListener( 'touchcancel', this.onTouchEnd );

			document.removeEventListener( 'keydown', this.onKeyDown );
			document.removeEventListener( 'keyup', this.onKeyUp );
		}

		handleContextMenu( e ) {
			e.preventDefault();
		}

		handleMouseDown( e ) {
			const cm = this.cm;
			const point = cm.getMousePoint( e );
			cm.startPoint = point;
			cm.dragStartPoint = point;

			// Begin guide creation when clicking in ruler zones
			if ( cm.showRulers ) {
				const rp = cm.getRawClientPoint( e );
				const inTopRuler = rp.canvasY < cm.rulerSize;
				const inLeftRuler = rp.canvasX < cm.rulerSize;
				if ( inTopRuler || inLeftRuler ) {
					cm.isDraggingGuide = true;
					cm.dragGuideOrientation = inTopRuler ? 'h' : 'v';
					cm.dragGuidePos = inTopRuler ? point.y : point.x;
					cm.canvas.style.cursor = 'grabbing';
					return;
				}
			}

			// Handle middle mouse button or space+click for panning
			if ( e.button === 1 || ( e.button === 0 && cm.spacePressed ) ) {
				cm.isPanning = true;
				cm.lastPanPoint = { x: e.clientX, y: e.clientY };
				cm.canvas.style.cursor = 'grabbing';
				return;
			}

			// Ignore right click
			if ( e.button === 2 ) {
				return;
			}

			// Check for selection handle clicks first
			if ( cm.currentTool === 'pointer' && cm.getSelectedLayerId && cm.getSelectedLayerId() ) {
				const handleHit = cm.hitTestSelectionHandles( point );
				if ( handleHit ) {
					const tc = cm.transformController;
					if ( handleHit.type === 'rotate' ) {
						if ( tc ) {
							tc.startRotation( point );
						}
					} else {
						if ( tc ) {
							tc.startResize( handleHit, cm.startPoint || point );
						}
					}
					return;
				}
			}

			cm.isDrawing = true;

			if ( cm.currentTool === 'zoom' ) {
				cm.handleZoomClick( point, e );
			} else if ( cm.currentTool === 'pointer' || cm.currentTool === 'marquee' ) {
				const isCtrlClick = e.ctrlKey || e.metaKey;
				let selectedLayer = null;
				if ( cm.currentTool === 'pointer' ) {
					selectedLayer = cm.handleLayerSelection( point, isCtrlClick );
					if ( selectedLayer && !isCtrlClick ) {
						if ( cm.transformController ) {
							cm.transformController.startDrag( cm.startPoint || point );
						}
					} else if ( !selectedLayer && !isCtrlClick ) {
						cm.startMarqueeSelection( point );
					}
				} else {
					cm.startMarqueeSelection( point );
				}
			} else {
				cm.startDrawing( point );
			}
		}

		handleMouseMove( e ) {
			const cm = this.cm;
			const point = cm.getMousePoint( e );

			// Guide drag preview rendering
			if ( cm.isDraggingGuide ) {
				cm.dragGuidePos = ( cm.dragGuideOrientation === 'h' ) ? point.y : point.x;
				cm.renderLayers( cm.editor.layers );
				cm.drawGuidePreview();
				return;
			}

			// Update status: live cursor position
			if ( cm.editor && typeof cm.editor.updateStatus === 'function' ) {
				cm.editor.updateStatus( {
					pos: { x: point.x, y: point.y }
				} );
			}

			// Handle marquee selection
			if ( cm.isMarqueeSelecting ) {
				cm.updateMarqueeSelection( point );
				return;
			}

			if ( cm.isPanning ) {
				const deltaX = e.clientX - cm.lastPanPoint.x;
				const deltaY = e.clientY - cm.lastPanPoint.y;

				// Apply pan offset to canvas position
				const currentTranslateX = cm.panX || 0;
				const currentTranslateY = cm.panY || 0;

				cm.panX = currentTranslateX + deltaX;
				cm.panY = currentTranslateY + deltaY;

				cm.lastPanPoint = { x: e.clientX, y: e.clientY };

				// Update canvas position
				cm.updateCanvasTransform();

				return;
			}

			const tc = cm.transformController;
			if ( tc && tc.isResizing && tc.resizeHandle && tc.dragStartPoint ) {
				try {
					tc.handleResize( point, e );
				} catch ( error ) {
					// Log resize errors for debugging - these can occur during rapid interactions
					if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
						mw.log.error( '[CanvasEvents] handleResize error:', error.message || error );
					}
				}
				return;
			}

			if ( tc && tc.isRotating && tc.dragStartPoint ) {
				tc.handleRotation( point, e );
				return;
			}

			if ( tc && tc.isDragging && tc.dragStartPoint ) {
				tc.handleDrag( point );
				return;
			}

			// Always update cursor when not actively resizing/rotating/dragging
			const isTransforming = tc && ( tc.isResizing || tc.isRotating || tc.isDragging );
			if ( !isTransforming ) {
				cm.updateCursor( point );
			}

			if ( !cm.isDrawing ) {
				return;
			}

			// Handle zoom tool drag
			if ( cm.currentTool === 'zoom' && cm.isDrawing ) {
				cm.handleZoomDrag( point );
				return;
			}

			if ( cm.currentTool !== 'pointer' ) {
				cm.continueDrawing( point );
			}
		}

		handleMouseUp( e ) {
			const cm = this.cm;

			// Handle marquee selection completion
			if ( cm.isMarqueeSelecting ) {
				cm.finishMarqueeSelection();
				return;
			}

			// Finish guide creation
			if ( cm.isDraggingGuide ) {
				if ( cm.dragGuideOrientation === 'h' ) {
					cm.addHorizontalGuide( cm.dragGuidePos );
				} else if ( cm.dragGuideOrientation === 'v' ) {
					cm.addVerticalGuide( cm.dragGuidePos );
				}
				cm.isDraggingGuide = false;
				cm.dragGuideOrientation = null;
				cm.canvas.style.cursor = cm.getToolCursor( cm.currentTool );
				cm.renderLayers( cm.editor.layers );
				return;
			}

			if ( cm.isPanning ) {
				cm.isPanning = false;
				cm.canvas.style.cursor = cm.getToolCursor( cm.currentTool );
				return;
			}

			const tc = cm.transformController;
			if ( tc && tc.isResizing ) {
				tc.finishResize();
				return;
			}

			if ( tc && tc.isRotating ) {
				tc.finishRotation();
				return;
			}

			if ( tc && tc.isDragging ) {
				tc.finishDrag();
				return;
			}

			if ( !cm.isDrawing ) {
				return;
			}

			const point = cm.getMousePoint( e );
			cm.isDrawing = false;

			if ( cm.currentTool !== 'pointer' ) {
				cm.finishDrawing( point );
			}
		}

		handleWheel( e ) {
			const cm = this.cm;
			const tc = cm.transformController;
			// Don't zoom when resizing, rotating, dragging or panning
			const isTransforming = tc && ( tc.isResizing || tc.isRotating || tc.isDragging );
			if ( isTransforming || cm.isPanning ) {
				e.preventDefault();
				return;
			}

			e.preventDefault();

			// Wheel delta: positive deltaY zooms out, negative zooms in
			const delta = e.deltaY > 0 ? -0.1 : 0.1;

			// Compute anchor in canvas coordinates under the mouse
			const point = cm.getMousePoint( e );
			cm.zoomBy( delta, point );
		}

		handleKeyDown( e ) {
			const cm = this.cm;
			// Don't handle keys when typing in input fields
			if ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' ) {
				return;
			}

			// Selection shortcuts
			if ( e.ctrlKey || e.metaKey ) {
				switch ( e.key.toLowerCase() ) {
					case 'a':
						e.preventDefault();
						cm.selectAll();
						break;
					case 'd':
						e.preventDefault();
						cm.deselectAll();
						break;
					case 'c':
						e.preventDefault();
						cm.copySelected();
						break;
					case 'v':
						e.preventDefault();
						cm.pasteFromClipboard();
						break;
					case 'x':
						e.preventDefault();
						cm.cutSelected();
						break;
					case 'z':
						e.preventDefault();
						// Route through editor's HistoryManager for single source of truth
						if ( cm.editor && typeof cm.editor.redo === 'function' ) {
							if ( e.shiftKey ) {
								cm.editor.redo();
							} else {
								cm.editor.undo();
							}
						}
						break;
					case '=':
					case '+':
						e.preventDefault();
						cm.zoomIn();
						break;
					case '-':
						e.preventDefault();
						cm.zoomOut();
						break;
					case '0':
						e.preventDefault();
						cm.resetZoom();
						break;
				}
			}

			// Delete selected objects
			if ( e.key === 'Delete' || e.key === 'Backspace' ) {
				e.preventDefault();
				cm.deleteSelected();
			}

			// Pan shortcuts with arrow keys
			if ( !e.ctrlKey && !e.metaKey ) {
				const panDistance = 20;
				switch ( e.key ) {
					case 'ArrowUp':
						e.preventDefault();
						cm.panY += panDistance;
						cm.updateCanvasTransform();
						break;
					case 'ArrowDown':
						e.preventDefault();
						cm.panY -= panDistance;
						cm.updateCanvasTransform();
						break;
					case 'ArrowLeft':
						e.preventDefault();
						cm.panX += panDistance;
						cm.updateCanvasTransform();
						break;
					case 'ArrowRight':
						e.preventDefault();
						cm.panX -= panDistance;
						cm.updateCanvasTransform();
						break;
				}
			}

			// Space key for temporary pan mode
			if ( e.code === 'Space' && !e.repeat ) {
				e.preventDefault();
				cm.spacePressed = true;
				cm.canvas.style.cursor = 'grab';
			}
		}

		handleKeyUp( e ) {
			const cm = this.cm;
			if ( e.code === 'Space' ) {
				cm.spacePressed = false;
				if ( !cm.isPanning ) {
					cm.canvas.style.cursor = cm.getToolCursor( cm.currentTool );
				}
			}
		}

		handleTouchStart( e ) {
			const cm = this.cm;
			const touch = e.touches[ 0 ];
			if ( !touch ) {
				return;
			}
			cm.lastTouchPoint = { clientX: touch.clientX, clientY: touch.clientY };

			// Handle multi-touch gestures
			if ( e.touches.length > 1 ) {
				this.handlePinchStart( e );
				return;
			}

			// Convert touch to mouse event
			const mouseEvent = {
				clientX: touch.clientX,
				clientY: touch.clientY,
				button: 0,
				preventDefault: function () {},
				stopPropagation: function () {}
			};

			cm.lastTouchTime = Date.now();
			this.handleMouseDown( mouseEvent );
		}

		handleTouchMove( e ) {
			const cm = this.cm;
			const touch = e.touches[ 0 ];
			if ( !touch ) {
				return;
			}
			cm.lastTouchPoint = { clientX: touch.clientX, clientY: touch.clientY };

			// Handle multi-touch gestures
			if ( e.touches.length > 1 ) {
				this.handlePinchMove( e );
				return;
			}

			// Convert touch to mouse event
			const mouseEvent = {
				clientX: touch.clientX,
				clientY: touch.clientY,
				button: 0,
				preventDefault: function () {},
				stopPropagation: function () {}
			};

			this.handleMouseMove( mouseEvent );
		}

		handleTouchEnd( e ) {
			const cm = this.cm;
			const changedTouch = ( e.changedTouches && e.changedTouches[ 0 ] ) || null;
			if ( changedTouch ) {
				cm.lastTouchPoint = { clientX: changedTouch.clientX, clientY: changedTouch.clientY };
			}
			// Handle double-tap for zoom
			const now = Date.now();
			if ( cm.lastTouchTime && ( now - cm.lastTouchTime ) < 300 ) {
				this.handleDoubleTap( e );
				return;
			}

			// Handle pinch end
			if ( cm.isPinching ) {
				this.handlePinchEnd( e );
				return;
			}

			// Convert touch to mouse event using the last real touch coordinates
			const clientX = cm.lastTouchPoint ? cm.lastTouchPoint.clientX : 0;
			const clientY = cm.lastTouchPoint ? cm.lastTouchPoint.clientY : 0;
			const mouseEvent = {
				clientX: clientX,
				clientY: clientY,
				button: 0,
				preventDefault: function () {},
				stopPropagation: function () {}
			};

			this.handleMouseUp( mouseEvent );
		}

		handlePinchStart( e ) {
			const cm = this.cm;
			if ( e.touches.length !== 2 ) {
				return;
			}

			cm.isPinching = true;
			const touch1 = e.touches[ 0 ];
			const touch2 = e.touches[ 1 ];

			cm.initialPinchDistance = Math.sqrt(
				Math.pow( touch2.clientX - touch1.clientX, 2 ) +
				Math.pow( touch2.clientY - touch1.clientY, 2 )
			);
			cm.initialZoom = cm.zoom;
		}

		handlePinchMove( e ) {
			const cm = this.cm;
			if ( !cm.isPinching || e.touches.length !== 2 ) {
				return;
			}

			const touch1 = e.touches[ 0 ];
			const touch2 = e.touches[ 1 ];

			const currentDistance = Math.sqrt(
				Math.pow( touch2.clientX - touch1.clientX, 2 ) +
				Math.pow( touch2.clientY - touch1.clientY, 2 )
			);

			const scale = currentDistance / cm.initialPinchDistance;
			let newZoom = cm.initialZoom * scale;

			// Clamp zoom level
			newZoom = Math.max( 0.1, Math.min( 5.0, newZoom ) );

			cm.setZoom( newZoom );
		}

		handlePinchEnd() {
			const cm = this.cm;
			cm.isPinching = false;
			cm.initialPinchDistance = null;
			cm.initialZoom = null;
		}

		handleDoubleTap() {
			const cm = this.cm;
			// Toggle between fit-to-screen and 100% zoom
			if ( cm.zoom < 1.0 ) {
				cm.resetZoom();
			} else {
				cm.fitToWindow();
			}
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.Events = CanvasEvents;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CanvasEvents;
	}

}() );
