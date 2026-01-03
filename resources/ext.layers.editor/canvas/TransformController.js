/**
 * TransformController - Handles resize, rotation, and drag operations for layers
 *
 * Extracted from CanvasManager.js to reduce file size and improve maintainability.
 * This module manages all layer transformation operations including:
 * - Resize (8 handles for rectangles, circles, ellipses, polygons, lines, paths, text)
 * - Rotation (rotation handle with shift-snap to 15-degree increments)
 * - Drag (single and multi-layer drag with snap-to-grid support)
 *
 * Resize calculations are delegated to ResizeCalculator for cleaner separation.
 *
 * @module canvas/TransformController
 */
( function () {
	'use strict';

	// Import helper
	const getClass = ( typeof window !== 'undefined' && window.Layers && window.Layers.Utils &&
		window.Layers.Utils.getClass ) ?
		window.Layers.Utils.getClass :
		function ( namespacePath, legacyName ) {
			// Check namespace path first
			if ( typeof window !== 'undefined' && window.Layers ) {
				const parts = namespacePath.split( '.' );
				let obj = window.Layers;
				for ( let i = 0; i < parts.length; i++ ) {
					if ( obj && obj[ parts[ i ] ] ) {
						obj = obj[ parts[ i ] ];
					} else {
						obj = null;
						break;
					}
				}
				if ( obj ) {
					return obj;
				}
			}
			// Fallback to legacy window global
			if ( typeof window !== 'undefined' && legacyName && window[ legacyName ] ) {
				return window[ legacyName ];
			}
			return null;
		};

	/**
	 * TransformController class
	 */
class TransformController {
	/**
	 * Creates a new TransformController instance
	 *
	 * @param {Object} canvasManager Reference to parent CanvasManager
	 */
	constructor( canvasManager ) {
		this.manager = canvasManager;

		// Transform state
		this.isResizing = false;
		this.isRotating = false;
		this.isDragging = false;

		this.resizeHandle = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;
		this.showDragPreview = false;

		// Throttling for transform events and render
		this.transformEventScheduled = false;
		this.lastTransformPayload = null;
		this._resizeRenderScheduled = false;
		this._pendingResizeLayer = null;
		this._dragRenderScheduled = false;
		this._rotationRenderScheduled = false;
		this._pendingRotationLayer = null;
	}

	// ==================== Resize Operations ====================

	/**
	 * Start a resize operation on the selected layer
	 *
	 * @param {Object} handle The resize handle being dragged
	 * @param {Object} startPoint The starting mouse point
	 */
	startResize( handle, startPoint ) {
		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartPoint = startPoint;

		// Get rotation for proper cursor
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
		const rotation = layer ? layer.rotation : 0;
		this.manager.canvas.style.cursor = this.getResizeCursor( handle.type, rotation );

		// Store original layer state
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}
	}

	/**
	 * Handle resize during mouse move
	 *
	 * @param {Object} point Current mouse point
	 * @param {Event} event Mouse event for modifier keys
	 */
	handleResize ( point, event ) {
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );

		if ( !layer || !this.originalLayerState ) {
			return;
		}

		let deltaX = point.x - this.dragStartPoint.x;
		let deltaY = point.y - this.dragStartPoint.y;

		// If layer has rotation, transform the delta into the layer's local coordinate system
		// Exception: control handles (arrows) and tailTip handles (callouts) work in world space
		const rotation = layer.rotation || 0;
		const handleType = this.resizeHandle ? this.resizeHandle.type : '';
		const skipRotation = handleType === 'control' || handleType === 'tailTip';

		if ( rotation !== 0 && !skipRotation ) {
			const rotRad = -rotation * Math.PI / 180;
			const cos = Math.cos( rotRad );
			const sin = Math.sin( rotRad );
			const rotatedDeltaX = deltaX * cos - deltaY * sin;
			const rotatedDeltaY = deltaX * sin + deltaY * cos;
			deltaX = rotatedDeltaX;
			deltaY = rotatedDeltaY;
		}

		// Limit delta values to prevent sudden jumps during rapid mouse movements
		const maxDelta = 1000;
		deltaX = Math.max( -maxDelta, Math.min( maxDelta, deltaX ) );
		deltaY = Math.max( -maxDelta, Math.min( maxDelta, deltaY ) );

		// Get modifier keys from the event
		const modifiers = {
			proportional: event && event.shiftKey,
			fromCenter: event && event.altKey
		};

		// Calculate new dimensions based on handle type using ResizeCalculator
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		const updates = ResizeCalculator ?
			ResizeCalculator.calculateResize(
				this.originalLayerState,
				this.resizeHandle.type,
				deltaX,
				deltaY,
				modifiers
			) : null;

		// Apply updates to layer
		if ( updates ) {
			Object.keys( updates ).forEach( function ( key ) {
				layer[ key ] = updates[ key ];
			} );

			// Special handling for star layers
			if ( layer.type === 'star' && Object.prototype.hasOwnProperty.call( updates, 'radius' ) ) {
				layer.radius = Math.max( 5, Math.abs( layer.radius || 0 ) );
				layer.outerRadius = layer.radius;
				layer.innerRadius = layer.radius * 0.5;
			}

			// Throttle rendering using requestAnimationFrame to prevent lag during rapid drag
			this._pendingResizeLayer = layer;
			if ( !this._resizeRenderScheduled ) {
				this._resizeRenderScheduled = true;
				window.requestAnimationFrame( () => {
					this._resizeRenderScheduled = false;
					if ( this._pendingResizeLayer ) {
						this.manager.renderLayers( this.manager.editor.layers );
						this.emitTransforming( this._pendingResizeLayer );
					}
				} );
			}
		}
	}

	/**
	 * Finish the resize operation
	 */
	finishResize () {
		// Emit final transform event synchronously to sync properties panel with final dimensions
		const selectedLayer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
		if ( selectedLayer ) {
			this.emitTransforming( selectedLayer, true );
		}

		this.isResizing = false;
		this.resizeHandle = null;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Mark editor as dirty and save state
		this.manager.editor.markDirty();
		if ( this.manager.editor && typeof this.manager.editor.saveState === 'function' ) {
			this.manager.editor.saveState( 'Resize layer' );
		} else if ( this.manager && typeof this.manager.saveState === 'function' ) {
			this.manager.saveState( 'Resize layer' );
		}
	}

	/**
	 * Get the appropriate cursor for a resize handle
	 *
	 * The cursor should indicate the direction of resize movement, which is
	 * perpendicular to the edge being dragged. For rotated shapes, we need to
	 * rotate the cursor direction by the same amount as the shape.
	 *
	 * @param {string} handleType Handle type (n, s, e, w, ne, nw, se, sw)
	 * @param {number} rotation Layer rotation in degrees
	 * @return {string} CSS cursor value
	 */
	getResizeCursor ( handleType, rotation ) {
		// Base angles for each handle type (direction of resize in local space)
		// 0° = up (north), 90° = right (east), etc.
		const handleAngles = {
			n: 0, // resize vertically (up/down)
			ne: 45, // resize diagonally
			e: 90, // resize horizontally (left/right)
			se: 135,
			s: 180,
			sw: 225,
			w: 270,
			nw: 315
		};

		// Get the base angle for this handle
		const baseAngle = handleAngles[ handleType ];
		if ( baseAngle === undefined ) {
			return 'default';
		}

		// Add rotation to get the world-space cursor direction
		const worldAngle = ( baseAngle + ( rotation || 0 ) ) % 360;

		// Normalize to 0-360
		const normalizedAngle = ( ( worldAngle % 360 ) + 360 ) % 360;

		// CSS only has 4 resize cursors: n-resize, ne-resize, e-resize, nw-resize
		// (plus their opposites which look the same: s=n, sw=ne, w=e, se=nw)
		// Map the angle to the nearest cursor direction (8 sectors of 45° each)
		// Sector centers: 0°=n, 45°=ne, 90°=e, 135°=se, 180°=s, 225°=sw, 270°=w, 315°=nw
		const sector = Math.round( normalizedAngle / 45 ) % 8;

		// Map sectors to CSS cursor values
		// Sectors 0,4 (n,s) -> ns-resize
		// Sectors 1,5 (ne,sw) -> nesw-resize
		// Sectors 2,6 (e,w) -> ew-resize
		// Sectors 3,7 (se,nw) -> nwse-resize
		const cursorMap = [
			'ns-resize', // 0: north (0°)
			'nesw-resize', // 1: northeast (45°)
			'ew-resize', // 2: east (90°)
			'nwse-resize', // 3: southeast (135°)
			'ns-resize', // 4: south (180°)
			'nesw-resize', // 5: southwest (225°)
			'ew-resize', // 6: west (270°)
			'nwse-resize' // 7: northwest (315°)
		];

		return cursorMap[ sector ];
	}

	// ==================== Resize Calculation Wrappers ====================
	// These methods delegate to ResizeCalculator for backwards compatibility

	/**
	 * Calculate resize updates based on layer type
	 * Delegates to ResizeCalculator.calculateResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @param {Object} modifiers Modifier keys state
	 * @return {Object|null} Updates object with new dimensions
	 */
	calculateResize( originalLayer, handleType, deltaX, deltaY, modifiers ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculateResize( originalLayer, handleType, deltaX, deltaY, modifiers );
		}
		return null;
	}

	/**
	 * Calculate rectangle resize adjustments
	 * Delegates to ResizeCalculator.calculateRectangleResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @param {Object} modifiers Modifier keys state
	 * @return {Object} Updates object with new dimensions
	 */
	calculateRectangleResize( originalLayer, handleType, deltaX, deltaY, modifiers ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculateRectangleResize( originalLayer, handleType, deltaX, deltaY, modifiers );
		}
		return {};
	}

	/**
	 * Apply correction to keep the opposite edge fixed in world space for rotated shapes
	 * Delegates to ResizeCalculator.applyRotatedResizeCorrection
	 *
	 * @param {Object} updates The updates object to modify
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 */
	applyRotatedResizeCorrection( updates, originalLayer, handleType ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, handleType );
		}
	}

	/**
	 * Calculate circle resize adjustments
	 * Delegates to ResizeCalculator.calculateCircleResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object|null} Updates object with new radius
	 */
	calculateCircleResize( originalLayer, handleType, deltaX, deltaY ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculateCircleResize( originalLayer, handleType, deltaX, deltaY );
		}
		return null;
	}

	/**
	 * Calculate ellipse resize adjustments
	 * Delegates to ResizeCalculator.calculateEllipseResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new radiusX/radiusY
	 */
	calculateEllipseResize( originalLayer, handleType, deltaX, deltaY ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculateEllipseResize( originalLayer, handleType, deltaX, deltaY );
		}
		return {};
	}

	/**
	 * Calculate polygon/star resize adjustments
	 * Delegates to ResizeCalculator.calculatePolygonResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new radius
	 */
	calculatePolygonResize( originalLayer, handleType, deltaX, deltaY ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculatePolygonResize( originalLayer, handleType, deltaX, deltaY );
		}
		return {};
	}

	/**
	 * Calculate line/arrow resize adjustments
	 * Delegates to ResizeCalculator.calculateLineResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new endpoint coordinates
	 */
	calculateLineResize( originalLayer, handleType, deltaX, deltaY ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculateLineResize( originalLayer, handleType, deltaX, deltaY );
		}
		return {};
	}

	/**
	 * Calculate path resize adjustments
	 * Delegates to ResizeCalculator.calculatePathResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object|null} Updates object with scaled points
	 */
	calculatePathResize( originalLayer, handleType, deltaX, deltaY ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculatePathResize( originalLayer, handleType, deltaX, deltaY );
		}
		return null;
	}

	/**
	 * Calculate text resize adjustments
	 * Delegates to ResizeCalculator.calculateTextResize
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new fontSize
	 */
	calculateTextResize( originalLayer, handleType, deltaX, deltaY ) {
		const ResizeCalculator = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		if ( ResizeCalculator ) {
			return ResizeCalculator.calculateTextResize( originalLayer, handleType, deltaX, deltaY );
		}
		return {};
	}

	// ==================== Rotation Operations ====================

	/**
	 * Start a rotation operation on the selected layer
	 *
	 * @param {Object} point Starting mouse point
	 */
	startRotation ( point ) {
		this.isRotating = true;
		this.manager.canvas.style.cursor = 'grabbing';
		if ( point ) {
			this.dragStartPoint = point;
		}

		// Store original layer state
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}
	}

	/**
	 * Handle rotation during mouse move
	 *
	 * @param {Object} point Current mouse point
	 * @param {Event} event Mouse event for modifier keys
	 */
	handleRotation ( point, event ) {
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
		if ( !layer ) {
			return;
		}

		// Calculate angle from rotation center to mouse position
		const bounds = this.manager.getLayerBounds( layer );
		if ( !bounds ) {
			return;
		}

		const centerX = bounds.centerX;
		const centerY = bounds.centerY;

		const startAngle = Math.atan2(
			this.dragStartPoint.y - centerY,
			this.dragStartPoint.x - centerX
		);
		const currentAngle = Math.atan2( point.y - centerY, point.x - centerX );

		const angleDelta = currentAngle - startAngle;
		let degrees = angleDelta * ( 180 / Math.PI );

		// Apply snap-to-angle if Shift key is held (15-degree increments)
		if ( event && event.shiftKey ) {
			const snapAngle = 15;
			degrees = Math.round( degrees / snapAngle ) * snapAngle;
		}

		// Apply rotation
		layer.rotation = ( this.originalLayerState.rotation || 0 ) + degrees;

		// Throttle rendering using requestAnimationFrame to prevent lag during rapid rotation
		this._pendingRotationLayer = layer;
		if ( !this._rotationRenderScheduled ) {
			this._rotationRenderScheduled = true;
			window.requestAnimationFrame( () => {
				this._rotationRenderScheduled = false;
				if ( this._pendingRotationLayer ) {
					this.manager.renderLayers( this.manager.editor.layers );
					this.emitTransforming( this._pendingRotationLayer );
				}
			} );
		}
	}

	/**
	 * Finish the rotation operation
	 */
	finishRotation () {
		// Emit final transform event synchronously to sync properties panel with final rotation value
		const selectedLayer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
		if ( selectedLayer ) {
			this.emitTransforming( selectedLayer, true );
		}

		this.isRotating = false;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Mark editor as dirty and save state
		this.manager.editor.markDirty();
		if ( this.manager.editor && typeof this.manager.editor.saveState === 'function' ) {
			this.manager.editor.saveState( 'Rotate layer' );
		} else if ( this.manager && typeof this.manager.saveState === 'function' ) {
			this.manager.saveState( 'Rotate layer' );
		}
	}

	// ==================== Drag Operations ====================

	/**
	 * Start a drag operation on selected layer(s)
	 *
	 * @param {Object} startPoint Starting mouse point
	 */
	startDrag ( startPoint ) {
		this.isDragging = true;
		this.dragStartPoint = startPoint;
		this.manager.canvas.style.cursor = 'move';

		// Store original layer state(s)
		const selectedIds = this.manager.getSelectedLayerIds();
		if ( selectedIds.length > 1 ) {
			// Multi-selection: store all selected layer states
			this.originalMultiLayerStates = {};
			for ( let i = 0; i < selectedIds.length; i++ ) {
				const layerId = selectedIds[ i ];
				const multiLayer = this.manager.editor.getLayerById( layerId );
				if ( multiLayer ) {
					this.originalMultiLayerStates[ layerId ] =
						JSON.parse( JSON.stringify( multiLayer ) );
				}
			}
		} else {
			// Single selection: store single layer state
			const singleLayer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
			if ( singleLayer ) {
				this.originalLayerState = JSON.parse( JSON.stringify( singleLayer ) );
			}
		}
	}

	/**
	 * Handle drag during mouse move
	 *
	 * @param {Object} point Current mouse point
	 */
	handleDrag ( point ) {
		const deltaX = point.x - this.dragStartPoint.x;
		const deltaY = point.y - this.dragStartPoint.y;

		// Enable drag preview mode for visual feedback
		this.showDragPreview = true;

		// Collect layers to move
		const layersToMove = [];
		const dragSelectedIds = this.manager.getSelectedLayerIds();
		if ( dragSelectedIds.length > 1 ) {
			for ( let i = 0; i < dragSelectedIds.length; i++ ) {
				const multiLayer = this.manager.editor.getLayerById( dragSelectedIds[ i ] );
				if ( multiLayer ) {
					layersToMove.push( multiLayer );
				}
			}
		} else {
			const singleLayer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
			if ( singleLayer && this.originalLayerState ) {
				layersToMove.push( singleLayer );
			}
		}

		// Move all layers in the selection
		for ( let j = 0; j < layersToMove.length; j++ ) {
			const layerToMove = layersToMove[ j ];
			let originalState = this.originalLayerState;

			// For multi-selection, get individual original states
			if ( dragSelectedIds.length > 1 && this.originalMultiLayerStates ) {
				originalState = this.originalMultiLayerStates[ layerToMove.id ];
			}

			if ( !originalState ) {
				continue;
			}

			// Apply snap-to-grid if enabled
			let adjustedDeltaX = deltaX;
			let adjustedDeltaY = deltaY;

			if ( this.manager.snapToGrid && this.manager.gridSize > 0 ) {
				const newX = ( originalState.x || 0 ) + deltaX;
				const newY = ( originalState.y || 0 ) + deltaY;
				const snappedPoint = this.manager.snapPointToGrid( { x: newX, y: newY } );
				adjustedDeltaX = snappedPoint.x - ( originalState.x || 0 );
				adjustedDeltaY = snappedPoint.y - ( originalState.y || 0 );
			} else if ( this.manager.smartGuidesController && this.manager.smartGuidesController.enabled ) {
				// Apply smart guides snapping when grid snap is disabled
				const proposedX = ( originalState.x || 0 ) + deltaX;
				const proposedY = ( originalState.y || 0 ) + deltaY;
				const snapped = this.manager.smartGuidesController.calculateSnappedPosition(
					layerToMove,
					proposedX,
					proposedY,
					this.manager.editor.layers
				);
				adjustedDeltaX = snapped.x - ( originalState.x || 0 );
				adjustedDeltaY = snapped.y - ( originalState.y || 0 );
			}

			// Update layer position based on type
			this.updateLayerPosition( layerToMove, originalState, adjustedDeltaX, adjustedDeltaY );
		}

		// Emit live-transform event BEFORE rendering (so UI updates while render is processing)
		const active = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
		if ( active ) {
			this.emitTransforming( active );
		}

		// Throttle rendering using requestAnimationFrame to prevent lag during rapid drag
		if ( !this._dragRenderScheduled ) {
			this._dragRenderScheduled = true;
			window.requestAnimationFrame( () => {
				this._dragRenderScheduled = false;
				this.manager.renderLayers( this.manager.editor.layers );
			} );
		}
	}

	/**
	 * Update layer position during drag operation
	 *
	 * @param {Object} layer Layer to update
	 * @param {Object} originalState Original state before drag
	 * @param {number} deltaX X offset
	 * @param {number} deltaY Y offset
	 */
	updateLayerPosition (
		layer, originalState, deltaX, deltaY
	) {
		switch ( layer.type ) {
			case 'rectangle':
			case 'textbox':
			case 'callout':
			case 'blur':
			case 'circle':
			case 'text':
			case 'ellipse':
			case 'polygon':
			case 'star':
			case 'image':
				layer.x = ( originalState.x || 0 ) + deltaX;
				layer.y = ( originalState.y || 0 ) + deltaY;
				break;
			case 'line':
			case 'arrow':
				layer.x1 = ( originalState.x1 || 0 ) + deltaX;
				layer.y1 = ( originalState.y1 || 0 ) + deltaY;
				layer.x2 = ( originalState.x2 || 0 ) + deltaX;
				layer.y2 = ( originalState.y2 || 0 ) + deltaY;
				// Move control point with the arrow (for curved arrows)
				if ( originalState.controlX !== undefined ) {
					layer.controlX = originalState.controlX + deltaX;
				}
				if ( originalState.controlY !== undefined ) {
					layer.controlY = originalState.controlY + deltaY;
				}
				break;
			case 'path':
				if ( originalState.points && originalState.points.length > 0 ) {
					layer.points = originalState.points.map( function ( pt ) {
						return { x: pt.x + deltaX, y: pt.y + deltaY };
					} );
				}
				break;
		}
	}

	/**
	 * Finish the drag operation
	 */
	finishDrag () {
		// Only mark dirty if actual drag movement occurred (showDragPreview is set in handleDrag)
		const hadMovement = this.showDragPreview;

		// Emit final transform event synchronously to sync properties panel with final position
		if ( hadMovement ) {
			const selectedLayer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
			if ( selectedLayer ) {
				this.emitTransforming( selectedLayer, true );
			}
		}

		this.isDragging = false;
		this.showDragPreview = false;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;
		this.dragStartPoint = null;

		// Clear smart guides after drag
		if ( this.manager.smartGuidesController ) {
			this.manager.smartGuidesController.clearGuides();
		}

		// Reset cursor to appropriate tool cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Only mark editor as dirty and save state if there was actual movement
		if ( hadMovement ) {
			this.manager.editor.markDirty();
			// Save state for undo/redo
			if ( this.manager.editor && typeof this.manager.editor.saveState === 'function' ) {
				this.manager.editor.saveState( 'Move layer' );
			} else if ( this.manager && typeof this.manager.saveState === 'function' ) {
				this.manager.saveState( 'Move layer' );
			}
		}
	}

	// ==================== Utility Methods ====================

	/**
	 * Emit a custom event with current transform values
	 * to allow the properties panel to sync during manipulation.
	 *
	 * Events are emitted synchronously to ensure the UI updates before
	 * expensive rendering operations. The receiving handler (syncPropertiesFromLayer)
	 * only updates a few input values, which is very fast.
	 *
	 * @param {Object} layer The layer object to serialize and emit
	 * @param {boolean} [_force=false] Deprecated parameter, kept for compatibility
	 */
	emitTransforming ( layer, _force ) {
		if ( !layer ) {
			return;
		}

		// Emit synchronously - DOM updates are fast, and this ensures
		// the UI updates before blocking render operations
		const target = ( this.manager.editor && this.manager.editor.container ) ||
			this.manager.container || document;
		try {
			const detail = {
				id: layer.id,
				layer: JSON.parse( JSON.stringify( layer ) )
			};
			const evt = new CustomEvent( 'layers:transforming', { detail: detail } );
			target.dispatchEvent( evt );
		} catch ( e ) {
			if ( window.layersErrorHandler ) {
				window.layersErrorHandler.handleError( e, 'TransformController.emitTransformEvent', 'canvas' );
			}
		}
	}

	/**
	 * Check if any transform operation is active
	 *
	 * @return {boolean} True if resizing, rotating, or dragging
	 */
	isTransforming () {
		return this.isResizing || this.isRotating || this.isDragging;
	}

	/**
	 * Get the current transform state
	 *
	 * @return {Object} Current transform state
	 */
	getState () {
		return {
			isResizing: this.isResizing,
			isRotating: this.isRotating,
			isDragging: this.isDragging,
			resizeHandle: this.resizeHandle,
			showDragPreview: this.showDragPreview
		};
	}

	/**
	 * Clean up resources and state
	 */
	destroy() {
		// Cancel any pending transform events
		this.transformEventScheduled = false;
		this.lastTransformPayload = null;

		// Clear transform state
		this.isResizing = false;
		this.isRotating = false;
		this.isDragging = false;
		this.resizeHandle = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;

		// Clear reference
		this.manager = null;
	}
}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.TransformController = TransformController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TransformController;
	}

}() );
