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
			this.onDoubleClick = this.handleDoubleClick.bind( this );
			this.onContainerMouseDown = this.handleContainerMouseDown.bind( this );

			// Attach to canvas
			this.canvas.addEventListener( 'mousedown', this.onMouseDown );
			this.canvas.addEventListener( 'mousemove', this.onMouseMove );
			this.canvas.addEventListener( 'mouseup', this.onMouseUp );
			this.canvas.addEventListener( 'wheel', this.onWheel, { passive: false } );
			this.canvas.addEventListener( 'contextmenu', this.onContextMenu );
			this.canvas.addEventListener( 'dblclick', this.onDoubleClick );

			// Attach click handler to container for clicks outside canvas (deselect behavior)
			if ( this.cm.container ) {
				this.cm.container.addEventListener( 'mousedown', this.onContainerMouseDown );
			}

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
			this.canvas.removeEventListener( 'dblclick', this.onDoubleClick );
			this.canvas.removeEventListener( 'touchstart', this.onTouchStart );
			this.canvas.removeEventListener( 'touchmove', this.onTouchMove );
			this.canvas.removeEventListener( 'touchend', this.onTouchEnd );
			this.canvas.removeEventListener( 'touchcancel', this.onTouchEnd );

			if ( this.cm.container ) {
				this.cm.container.removeEventListener( 'mousedown', this.onContainerMouseDown );
			}

			document.removeEventListener( 'keydown', this.onKeyDown );
			document.removeEventListener( 'keyup', this.onKeyUp );
		}

		handleContextMenu( e ) {
			e.preventDefault();
		}

		/**
		 * Handle clicks on the container (outside the canvas) to deselect layers
		 * This enables the expected UX behavior where clicking outside the canvas
		 * clears the current selection.
		 *
		 * @param {MouseEvent} e
		 */
		handleContainerMouseDown( e ) {
			const cm = this.cm;

			// Only handle clicks directly on the container itself, not on child elements (like canvas)
			if ( e.target !== cm.container ) {
				return;
			}

			// Finish inline text editing if active
			if ( cm.isTextEditing && cm.inlineTextEditor ) {
				cm.inlineTextEditor.finishEditing( true );
			}

			// Deselect all layers using pointer tool behavior
			if ( cm.currentTool === 'pointer' || cm.currentTool === 'marquee' ) {
				cm.deselectAll();
			}
		}

		/**
		 * Handle double-click for inline text editing
		 *
		 * @param {MouseEvent} e
		 */
		handleDoubleClick( e ) {
			const cm = this.cm;

			// Block if already editing or during interactions
			if ( cm.isTextEditing ) {
				return;
			}

			// Block interactions during API loading
			if ( cm.interactionController && cm.interactionController.shouldBlockInteraction() ) {
				return;
			}

			// Only handle with pointer tool
			if ( cm.currentTool !== 'pointer' ) {
				return;
			}

			const point = cm.getMousePoint( e );
			const layers = cm.editor?.layers || [];

			// Find the topmost text or textbox layer at this point
			const textLayer = this.findTextLayerAtPoint( point, layers );

			if ( textLayer && cm.inlineTextEditor ) {
				e.preventDefault();
				cm.inlineTextEditor.startEditing( textLayer );
			}
		}

		/**
		 * Find the topmost text or textbox layer at the given point
		 *
		 * @param {{x: number, y: number}} point
		 * @param {Array} layers
		 * @return {Object|null}
		 */
		findTextLayerAtPoint( point, layers ) {
			// Iterate in reverse to find topmost layer first
			for ( let i = layers.length - 1; i >= 0; i-- ) {
				const layer = layers[ i ];

				// Skip hidden or locked layers
				if ( layer.visible === false || layer.visible === 0 ) {
					continue;
				}

				// Only handle text, textbox, and callout layers
				if ( layer.type !== 'text' && layer.type !== 'textbox' && layer.type !== 'callout' ) {
					continue;
				}

				// Check if point is within layer bounds
				if ( this.isPointInLayer( point, layer ) ) {
					return layer;
				}
			}
			return null;
		}

		/**
		 * Check if a point is within a layer's bounding box
		 *
		 * @param {{x: number, y: number}} point
		 * @param {Object} layer
		 * @return {boolean}
		 */
		isPointInLayer( point, layer ) {
			const cm = this.cm;

			// Use HitTestController if available for accurate hit testing
			if ( cm.hitTestController && typeof cm.hitTestController.hitTestLayer === 'function' ) {
				return cm.hitTestController.hitTestLayer( layer, point );
			}

			// Fallback to basic bounding box check
			const x = layer.x || 0;
			const y = layer.y || 0;
			const width = layer.width || 100;
			const height = layer.height || 50;

			return point.x >= x && point.x <= x + width &&
				point.y >= y && point.y <= y + height;
		}

		handleMouseDown( e ) {
			const cm = this.cm;

			// If inline text editing is active, finish it first
			// This allows clicking elsewhere to deselect properly
			if ( cm.isTextEditing && cm.inlineTextEditor ) {
				cm.inlineTextEditor.finishEditing( true );
				// Let the editor close, then continue with normal click handling
			}

			// Block interactions during API loading to prevent race conditions
			if ( cm.interactionController && cm.interactionController.shouldBlockInteraction() ) {
				return;
			}

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
					} else if ( handleHit.type === 'arrowTip' && handleHit.isMarker ) {
						// Special handling for marker arrow tip - start arrow drag
						if ( tc ) {
							tc.startArrowTipDrag( handleHit, cm.startPoint || point );
						}
					} else if ( handleHit.type === 'dimensionOffset' && handleHit.isDimensionOffset ) {
						// Special handling for dimension offset handle - start offset drag
						if ( tc ) {
							tc.startDimensionOffsetDrag( handleHit, cm.startPoint || point );
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
						// For dimension layers, check if click is in text area
						// If so, start text drag; otherwise don't allow body dragging
						// (dimension layers can only be moved via handles or text)
						if ( selectedLayer.type === 'dimension' ) {
							if ( this.isPointInDimensionTextArea( point, selectedLayer ) ) {
								if ( cm.transformController ) {
									// Create a handle for unified text dragging (both offsets)
									const handle = this.createDimensionTextHandle( selectedLayer );
									cm.transformController.startDimensionTextDrag( handle, cm.startPoint || point );
								}
							}
							// If not in text area, just select (no drag) - anchors moved via handles
						} else if ( cm.transformController ) {
							cm.transformController.startDrag( cm.startPoint || point );
						}
					} else if ( !selectedLayer && !isCtrlClick ) {
						cm.startMarqueeSelection( point );
					}
				} else {
					cm.startMarqueeSelection( point );
				}
			} else {
				// For multi-phase angle dimension: if phase 2, start drawing continues
				// from the existing tempLayer (vertex + arm1 already placed)
				const dc = cm.drawingController;
				if ( cm.currentTool === 'angleDimension' && dc && dc.isAngleDimensionInProgress() ) {
					// Phase 2: user clicks to start drawing arm2
					dc.isDrawing = true;
					cm.isDrawing = true;
				} else {
					cm.startDrawing( point );
				}
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
			if ( tc && tc.isArrowTipDragging && tc.dragStartPoint ) {
				tc.handleArrowTipDrag( point );
				return;
			}

			if ( tc && tc.isDimensionTextDragging && tc.dragStartPoint ) {
				tc.handleDimensionTextDrag( point );
				return;
			}

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

			// Always update cursor when not actively transforming
			const isTransforming = tc && ( tc.isResizing || tc.isRotating || tc.isDragging || tc.isArrowTipDragging || tc.isDimensionTextDragging );
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
			if ( tc && tc.isArrowTipDragging ) {
				tc.finishArrowTipDrag();
				return;
			}

			if ( tc && tc.isDimensionTextDragging ) {
				tc.finishDimensionTextDrag();
				return;
			}

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
			// Don't zoom when resizing, rotating, dragging, arrow-tip-dragging or panning
			const isTransforming = tc && ( tc.isResizing || tc.isRotating || tc.isDragging || tc.isArrowTipDragging );
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

			// Selection shortcuts (clipboard operations, select all)
			// Note: Ctrl+Z/Y undo/redo, Ctrl+D duplicate, and Delete are handled by EventManager
			if ( e.ctrlKey || e.metaKey ) {
				switch ( e.key.toLowerCase() ) {
					case 'a':
						e.preventDefault();
						cm.selectAll();
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

			// Note: Delete/Backspace is handled by EventManager to avoid duplicate handlers

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

		/**
		 * Check if a point is in the text area of a dimension layer.
		 * The text area is a region around the current text position (accounting for textOffset).
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Dimension layer
		 * @return {boolean} True if point is in text area
		 */
		isPointInDimensionTextArea( point, layer ) {
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			// Calculate dimension line position
			const dx = x2 - x1;
			const dy = y2 - y1;
			const distance = Math.sqrt( dx * dx + dy * dy );
			if ( distance < 1 ) {
				return false;
			}
			const angle = Math.atan2( dy, dx );
			const perpX = -Math.sin( angle );
			const perpY = Math.cos( angle );
			const unitDx = dx / distance;
			const unitDy = dy / distance;

			// Get offset distance
			let offsetDistance;
			if ( typeof layer.dimensionOffset === 'number' && !isNaN( layer.dimensionOffset ) ) {
				offsetDistance = layer.dimensionOffset;
			} else {
				const extensionLength = typeof layer.extensionLength === 'number' ? layer.extensionLength : 10;
				const extensionGap = typeof layer.extensionGap === 'number' ? layer.extensionGap : 3;
				offsetDistance = extensionGap + extensionLength / 2;
			}

			// Get text offset (along the line)
			const textOffset = typeof layer.textOffset === 'number' ? layer.textOffset : 0;

			// Calculate dimension line center
			const dimX1 = x1 - perpX * offsetDistance;
			const dimY1 = y1 - perpY * offsetDistance;
			const dimX2 = x2 - perpX * offsetDistance;
			const dimY2 = y2 - perpY * offsetDistance;

			// Calculate actual text position (accounting for textOffset)
			const textX = ( dimX1 + dimX2 ) / 2 + unitDx * textOffset;
			const textY = ( dimY1 + dimY2 ) / 2 + unitDy * textOffset;

			// Text hit radius
			const fontSize = layer.fontSize || 12;
			const textHitRadius = Math.max( fontSize * 1.5, 20 );

			const distToText = Math.sqrt(
				( point.x - textX ) * ( point.x - textX ) +
				( point.y - textY ) * ( point.y - textY )
			);

			return distToText <= textHitRadius;
		}

		/**
		 * Create a synthetic handle object for dimension offset dragging.
		 * This mimics the handle that would be registered by SelectionRenderer.
		 *
		 * @param {Object} layer Dimension layer
		 * @return {Object} Handle object compatible with startDimensionOffsetDrag
		 */
		createDimensionOffsetHandle( layer ) {
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			// Calculate perpendicular direction
			const dx = x2 - x1;
			const dy = y2 - y1;
			const angle = Math.atan2( dy, dx );
			const perpX = -Math.sin( angle );
			const perpY = Math.cos( angle );

			// Calculate anchor midpoint
			const anchorMidX = ( x1 + x2 ) / 2;
			const anchorMidY = ( y1 + y2 ) / 2;

			return {
				type: 'dimensionOffset',
				layerId: layer.id,
				isDimensionOffset: true,
				anchorMidX: anchorMidX,
				anchorMidY: anchorMidY,
				perpX: perpX,
				perpY: perpY
			};
		}

		/**
		 * Create a handle for unified dimension text dragging.
		 * Supports both perpendicular (dimensionOffset) and parallel (textOffset) movement.
		 *
		 * @param {Object} layer The dimension layer
		 * @return {Object} Handle object with both direction vectors
		 */
		createDimensionTextHandle( layer ) {
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			// Calculate directions
			const dx = x2 - x1;
			const dy = y2 - y1;
			const len = Math.sqrt( dx * dx + dy * dy );
			const angle = Math.atan2( dy, dx );

			// Unit vectors: parallel (along line) and perpendicular
			const unitDx = len > 0 ? dx / len : 1;
			const unitDy = len > 0 ? dy / len : 0;
			const perpX = -Math.sin( angle );
			const perpY = Math.cos( angle );

			// Calculate anchor midpoint
			const anchorMidX = ( x1 + x2 ) / 2;
			const anchorMidY = ( y1 + y2 ) / 2;

			return {
				type: 'dimensionText',
				layerId: layer.id,
				isDimensionText: true,
				anchorMidX: anchorMidX,
				anchorMidY: anchorMidY,
				unitDx: unitDx,
				unitDy: unitDy,
				perpX: perpX,
				perpY: perpY,
				lineLength: len
			};
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
