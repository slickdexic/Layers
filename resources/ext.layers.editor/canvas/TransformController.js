/**
 * TransformController - Handles resize, rotation, and drag operations for layers
 * Extracted from CanvasManager.js. Delegates resize calculations to ResizeCalculator.
 * @module canvas/TransformController
 */
( function () {
	'use strict';

	// Import helper
	const getClass = ( typeof window !== 'undefined' && window.Layers && window.Layers.Utils &&
		window.Layers.Utils.getClass ) ?
		window.Layers.Utils.getClass :
		function ( namespacePath, legacyName ) {
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
			if ( typeof window !== 'undefined' && legacyName && window[ legacyName ] ) {
				return window[ legacyName ];
			}
			return null;
		};

	/** TransformController class */
class TransformController {
	/** Creates a new TransformController instance */
	constructor( canvasManager ) {
		this.manager = canvasManager;

		// Transform state
		this.isResizing = false;
		this.isRotating = false;
		this.isDragging = false;
		this.isArrowTipDragging = false;

		this.resizeHandle = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;
		this.showDragPreview = false;

		// Throttling for transform events and render
		this.transformEventScheduled = false;
		this.lastTransformPayload = null;
		this._resizeRenderScheduled = false;
		this._resizeRafId = null; // Track rAF for cancellation
		this._pendingResizeLayer = null;
		this._dragRenderScheduled = false;
		this._dragRafId = null; // Track rAF for cancellation
		this._rotationRenderScheduled = false;
		this._rotationRafId = null; // Track rAF for cancellation
		this._pendingRotationLayer = null;

		// Cache efficient cloning function reference
		this._cloneLayerEfficient = null;
	}

	/** Clone a layer efficiently (preserves src/path by reference) @private @return {Object} */
	_cloneLayer( layer ) {
		if ( !this._cloneLayerEfficient ) {
			if ( typeof window !== 'undefined' &&
				window.Layers &&
				window.Layers.Utils &&
				typeof window.Layers.Utils.cloneLayerEfficient === 'function' ) {
				this._cloneLayerEfficient = window.Layers.Utils.cloneLayerEfficient;
			}
		}
		if ( this._cloneLayerEfficient ) {
			return this._cloneLayerEfficient( layer );
		}
		return JSON.parse( JSON.stringify( layer ) );
	}

	/** Check if a layer is effectively locked (directly or via parent folder) @return {boolean} */
	isLayerEffectivelyLocked( layer ) {
		if ( !layer ) {
			return false;
		}

		// Check if layer is directly locked
		if ( layer.locked === true ) {
			return true;
		}

		// Check if any parent folder is locked
		let parentId = layer.parentGroup;
		const layers = this.manager.editor.layers || [];
		const visited = new Set();

		while ( parentId && !visited.has( parentId ) ) {
			visited.add( parentId );
			const parent = layers.find( ( l ) => l.id === parentId );
			if ( !parent ) {
				break;
			}
			if ( parent.locked === true ) {
				return true;
			}
			parentId = parent.parentGroup;
		}

		return false;
	}

	// ==================== Resize Operations ====================

	/** Start a resize operation on the selected layer */
	startResize( handle, startPoint ) {
		// Get the layer first to check lock status
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );

		// Prevent resize on locked layers
		if ( this.isLayerEffectivelyLocked( layer ) ) {
			return;
		}

		// Prevent resize on marker layers - use properties panel instead
		// This avoids accidental resizing when trying to reposition the marker
		if ( layer && layer.type === 'marker' ) {
			return;
		}

		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartPoint = startPoint;

		// Get rotation for proper cursor
		const rotation = layer ? layer.rotation : 0;
		const RC = getClass( 'Canvas.ResizeCalculator', 'ResizeCalculator' );
		this.manager.canvas.style.cursor = RC ? RC.getResizeCursor( handle.type, rotation ) : 'default';

		// Store original layer state using efficient cloning
		if ( layer ) {
			this.originalLayerState = this._cloneLayer( layer );
		}
	}

	/** Handle resize during mouse move */
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
		// For image and customShape layers, invert the shift key behavior:
		// - Default: proportional (preserve aspect ratio)
		// - Shift held: allow free resize (break aspect ratio)
		const isImageOrShape = layer.type === 'image' || layer.type === 'customShape';
		const shiftPressed = event && event.shiftKey;
		const modifiers = {
			proportional: isImageOrShape ? !shiftPressed : shiftPressed,
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
				this._resizeRafId = window.requestAnimationFrame( () => {
					this._resizeRenderScheduled = false;
					this._resizeRafId = null;
					// Guard against destroyed manager to prevent null reference errors
					if ( !this.manager || this.manager.isDestroyed || !this.manager.editor ) {
						return;
					}
					if ( this._pendingResizeLayer ) {
						// P2.20 FIX: Validate layer still exists in layers array
						// The layer may have been deleted between scheduling and execution
						const layerId = this._pendingResizeLayer.id;
						const stillExists = this.manager.editor.layers.some(
							( l ) => l.id === layerId
						);
						if ( stillExists ) {
							this.manager.renderLayers( this.manager.editor.layers );
							this.emitTransforming( this._pendingResizeLayer );
						}
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

	// ==================== Rotation Operations ====================

	/** Start a rotation operation on the selected layer */
	startRotation ( point ) {
		// Get the layer first to check lock status
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );

		// Prevent rotation on locked layers
		if ( this.isLayerEffectivelyLocked( layer ) ) {
			return;
		}

		this.isRotating = true;
		this.manager.canvas.style.cursor = 'grabbing';
		if ( point ) {
			this.dragStartPoint = point;
		}

		// Store original layer state using efficient cloning
		if ( layer ) {
			this.originalLayerState = this._cloneLayer( layer );
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
			this._rotationRafId = window.requestAnimationFrame( () => {
				this._rotationRenderScheduled = false;
				this._rotationRafId = null;
				// Guard against destroyed manager to prevent null reference errors
				if ( !this.manager || this.manager.isDestroyed || !this.manager.editor ) {
					return;
				}
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
		// Check if any selected layer is locked
		const selectedIds = this.manager.getSelectedLayerIds();

		// For single selection, check if layer is locked
		if ( selectedIds.length <= 1 ) {
			const singleLayer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
			if ( this.isLayerEffectivelyLocked( singleLayer ) ) {
				return;
			}
		} else {
			// For multi-selection, check if ALL selected layers are locked
			// If any are unlocked, we allow drag but skip the locked ones in handleDrag
			let allLocked = true;
			for ( let i = 0; i < selectedIds.length; i++ ) {
				const layer = this.manager.editor.getLayerById( selectedIds[ i ] );
				if ( !this.isLayerEffectivelyLocked( layer ) ) {
					allLocked = false;
					break;
				}
			}
			if ( allLocked ) {
				return;
			}
		}

		this.isDragging = true;
		this.dragStartPoint = startPoint;
		this.manager.canvas.style.cursor = 'move';

		// Store original layer state(s)
		if ( selectedIds.length > 1 ) {
			// Multi-selection: store all selected layer states using efficient cloning
			this.originalMultiLayerStates = {};
			for ( let i = 0; i < selectedIds.length; i++ ) {
				const layerId = selectedIds[ i ];
				const multiLayer = this.manager.editor.getLayerById( layerId );
				if ( multiLayer ) {
					this.originalMultiLayerStates[ layerId ] = this._cloneLayer( multiLayer );
				}
			}
		} else {
			// Single selection: store single layer state using efficient cloning
			const singleLayer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
			if ( singleLayer ) {
				this.originalLayerState = this._cloneLayer( singleLayer );
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
				// Skip locked layers in multi-selection
				if ( multiLayer && !this.isLayerEffectivelyLocked( multiLayer ) ) {
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
			} else if ( this.manager.smartGuidesController &&
				( this.manager.smartGuidesController.enabled || this.manager.smartGuidesController.canvasSnapEnabled ) ) {
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

		// Throttle rendering AND UI updates using requestAnimationFrame to prevent lag during rapid drag
		// Both render and emitTransforming are batched together (like handleResize)
		this._pendingDragLayerId = this.manager.getSelectedLayerId();
		if ( !this._dragRenderScheduled ) {
			this._dragRenderScheduled = true;
			this._dragRafId = window.requestAnimationFrame( () => {
				this._dragRenderScheduled = false;
				this._dragRafId = null;
				// Guard against destroyed manager to prevent null reference errors
				if ( !this.manager || this.manager.isDestroyed || !this.manager.editor ) {
					return;
				}
				this.manager.renderLayers( this.manager.editor.layers );
				// Emit transform event after render (inside rAF to reduce per-frame work)
				if ( this._pendingDragLayerId ) {
					const active = this.manager.editor.getLayerById( this._pendingDragLayerId );
					if ( active ) {
						this.emitTransforming( active );
					}
				}
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
			case 'customShape':
				layer.x = ( originalState.x || 0 ) + deltaX;
				layer.y = ( originalState.y || 0 ) + deltaY;
				break;
			case 'marker':
				// Move marker center position only - arrow position is independent
				layer.x = ( originalState.x || 0 ) + deltaX;
				layer.y = ( originalState.y || 0 ) + deltaY;
				// Arrow position (arrowX, arrowY) is NOT moved with the marker
				// This allows users to reposition the marker balloon and arrow independently
				break;
			case 'line':
			case 'arrow':
			case 'dimension':
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

	// ==================== Arrow Tip Dragging ====================

	/**
	 * Start dragging the arrow tip of a marker layer
	 *
	 * @param {Object} handle The arrowTip handle
	 * @param {Object} startPoint The starting mouse point
	 */
	startArrowTipDrag( handle, startPoint ) {
		const layer = this.manager.editor.getLayerById( handle.layerId );

		// Prevent drag on locked layers
		if ( this.isLayerEffectivelyLocked( layer ) ) {
			return;
		}

		this.isArrowTipDragging = true;
		this.dragStartPoint = startPoint;
		this.arrowTipLayerId = handle.layerId;
		this.manager.canvas.style.cursor = 'move';

		// Store original layer state
		if ( layer ) {
			this.originalLayerState = this._cloneLayer( layer );
		}
	}

	/**
	 * Handle arrow tip dragging during mouse move
	 *
	 * @param {Object} point Current mouse point
	 */
	handleArrowTipDrag( point ) {
		if ( !this.isArrowTipDragging || !this.arrowTipLayerId ) {
			return;
		}

		const layer = this.manager.editor.getLayerById( this.arrowTipLayerId );
		if ( !layer ) {
			return;
		}

		// Update arrow position directly to mouse point
		this.manager.editor.updateLayer( this.arrowTipLayerId, {
			arrowX: point.x,
			arrowY: point.y
		} );

		this.showDragPreview = true;

		// Emit transform event for live properties panel update
		this.emitTransforming( layer );

		// Throttle rendering to animation frames to avoid excessive repaints
		if ( !this._arrowTipRafId ) {
			this._arrowTipRafId = requestAnimationFrame( () => {
				this._arrowTipRafId = null;
				this.manager.renderLayers( this.manager.editor.layers );
			} );
		}
	}

	/**
	 * Finish the arrow tip drag operation
	 */
	finishArrowTipDrag() {
		const hadMovement = this.showDragPreview;

		// Cancel any pending rAF from arrow tip drag
		if ( this._arrowTipRafId ) {
			cancelAnimationFrame( this._arrowTipRafId );
			this._arrowTipRafId = null;
			// Ensure final state is rendered
			this.manager.renderLayers( this.manager.editor.layers );
		}

		// Emit final transform event
		if ( hadMovement && this.arrowTipLayerId ) {
			const layer = this.manager.editor.getLayerById( this.arrowTipLayerId );
			if ( layer ) {
				this.emitTransforming( layer, true );
			}
		}

		this.isArrowTipDragging = false;
		this.arrowTipLayerId = null;
		this.showDragPreview = false;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Mark dirty and save state
		if ( hadMovement ) {
			this.manager.editor.markDirty();
			if ( this.manager.editor && typeof this.manager.editor.saveState === 'function' ) {
				this.manager.editor.saveState( 'Move arrow tip' );
			}
		}
	}

	// ==================== Dimension Offset Drag Methods ====================

	/**
	 * Start dragging the dimension offset handle.
	 * The handle moves the dimension line perpendicular to the measurement axis.
	 *
	 * @param {Object} handle The dimensionText handle with perpX, perpY, unitDx, unitDy, anchorMidX, anchorMidY
	 * @param {Object} startPoint The starting mouse point
	 */
	startDimensionTextDrag( handle, startPoint ) {
		const layer = this.manager.editor.getLayerById( handle.layerId );

		// Prevent drag on locked layers
		if ( this.isLayerEffectivelyLocked( layer ) ) {
			return;
		}

		this.isDimensionTextDragging = true;
		this.dragStartPoint = startPoint;
		this.dimensionTextLayerId = handle.layerId;
		// Store both direction vectors for unified movement
		this.dimensionPerpX = handle.perpX || 0;
		this.dimensionPerpY = handle.perpY || -1;
		this.dimensionUnitDx = handle.unitDx || 1;
		this.dimensionUnitDy = handle.unitDy || 0;
		this.dimensionAnchorMidX = handle.anchorMidX || 0;
		this.dimensionAnchorMidY = handle.anchorMidY || 0;
		this.dimensionLineLength = handle.lineLength || 100;
		this.manager.canvas.style.cursor = 'move';

		// Store original layer state
		if ( layer ) {
			this.originalLayerState = this._cloneLayer( layer );
		}
	}

	/**
	 * Handle unified dimension text dragging during mouse move.
	 * Tracks both perpendicular (dimensionOffset) and parallel (textOffset) movement.
	 * Snaps textOffset to center when near zero.
	 *
	 * @param {Object} point Current mouse point
	 */
	handleDimensionTextDrag( point ) {
		if ( !this.isDimensionTextDragging || !this.dimensionTextLayerId ) {
			return;
		}

		const layer = this.manager.editor.getLayerById( this.dimensionTextLayerId );
		if ( !layer ) {
			return;
		}

		// Calculate displacement from anchor midpoint
		const dx = point.x - this.dimensionAnchorMidX;
		const dy = point.y - this.dimensionAnchorMidY;

		// Calculate perpendicular offset (dimensionOffset)
		// Negate so that dragging "away" from baseline (up for horizontal lines) gives positive values
		const perpOffset = -( dx * this.dimensionPerpX + dy * this.dimensionPerpY );

		// Calculate parallel offset (textOffset)
		let parallelOffset = dx * this.dimensionUnitDx + dy * this.dimensionUnitDy;

		// Snap to center when near zero (within 10 pixels)
		const snapThreshold = 10;
		if ( Math.abs( parallelOffset ) < snapThreshold ) {
			parallelOffset = 0;
		}

		// Update both offsets
		this.manager.editor.updateLayer( this.dimensionTextLayerId, {
			dimensionOffset: Math.round( perpOffset ),
			textOffset: Math.round( parallelOffset )
		} );

		this.showDragPreview = true;

		// Emit transform event for live properties panel update
		this.emitTransforming( layer );

		// Render layers
		this.manager.renderLayers( this.manager.editor.layers );
	}

	/**
	 * Finish the unified dimension text drag operation
	 */
	finishDimensionTextDrag() {
		const hadMovement = this.showDragPreview;

		// Emit final transform event
		if ( hadMovement && this.dimensionTextLayerId ) {
			const layer = this.manager.editor.getLayerById( this.dimensionTextLayerId );
			if ( layer ) {
				this.emitTransforming( layer, true );
			}
		}

		this.isDimensionTextDragging = false;
		this.dimensionTextLayerId = null;
		this.dimensionPerpX = 0;
		this.dimensionPerpY = 0;
		this.dimensionUnitDx = 0;
		this.dimensionUnitDy = 0;
		this.dimensionAnchorMidX = 0;
		this.dimensionAnchorMidY = 0;
		this.dimensionLineLength = 0;
		this.showDragPreview = false;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Mark dirty and save state
		if ( hadMovement ) {
			this.manager.editor.markDirty();
			if ( this.manager.editor && typeof this.manager.editor.saveState === 'function' ) {
				this.manager.editor.saveState( 'Move dimension text' );
			}
		}
	}

	// ==================== Utility Methods ====================

	/**
	 * Emit custom event with current transform values for properties panel sync.
	 * Creates lightweight layer copy (omits src/path to avoid expensive serialization).
	 * @param {Object} layer The layer object to serialize and emit
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
			// Create a lightweight copy, omitting large data (base64 src, SVG paths)
			// The properties panel only needs geometry/style properties, not the data
			const lightweightLayer = {};
			for ( const key in layer ) {
				if ( Object.prototype.hasOwnProperty.call( layer, key ) ) {
					// Skip large binary/path data - not needed for UI updates
					if ( key === 'src' || key === 'path' ) {
						continue;
					}
					// Shallow copy simple values and arrays (like viewBox, points)
					const value = layer[ key ];
					if ( Array.isArray( value ) ) {
						lightweightLayer[ key ] = value.slice();
					} else if ( typeof value === 'object' && value !== null ) {
						// For nested objects, do a shallow clone
						lightweightLayer[ key ] = Object.assign( {}, value );
					} else {
						lightweightLayer[ key ] = value;
					}
				}
			}

			const detail = {
				id: layer.id,
				layer: lightweightLayer
			};
			const evt = new CustomEvent( 'layers:transforming', { detail: detail } );
			target.dispatchEvent( evt );
		} catch ( e ) {
			if ( window.layersErrorHandler ) {
				window.layersErrorHandler.handleError( e, 'TransformController.emitTransformEvent', 'canvas' );
			}
		}
	}

	/** Check if any transform operation is active @return {boolean} */
	isTransforming () {
		return this.isResizing || this.isRotating || this.isDragging || this.isArrowTipDragging;
	}

	/** Get the current transform state @return {Object} */
	getState () {
		return {
			isResizing: this.isResizing,
			isRotating: this.isRotating,
			isDragging: this.isDragging,
			isArrowTipDragging: this.isArrowTipDragging,
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

		// Cancel pending requestAnimationFrame callbacks
		if ( this._resizeRafId !== null ) {
			window.cancelAnimationFrame( this._resizeRafId );
			this._resizeRafId = null;
		}
		if ( this._rotationRafId !== null ) {
			window.cancelAnimationFrame( this._rotationRafId );
			this._rotationRafId = null;
		}
		if ( this._dragRafId !== null ) {
			window.cancelAnimationFrame( this._dragRafId );
			this._dragRafId = null;
		}

		// Clear RAF scheduling flags
		this._resizeRenderScheduled = false;
		this._rotationRenderScheduled = false;
		this._dragRenderScheduled = false;

		// Clear pending layer references for RAF callbacks
		this._pendingResizeLayer = null;
		this._pendingRotationLayer = null;
		this._pendingDragLayerId = null;

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
