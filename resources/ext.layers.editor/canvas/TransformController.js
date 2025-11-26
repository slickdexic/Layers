/**
 * TransformController - Handles resize, rotation, and drag operations for layers
 *
 * Extracted from CanvasManager.js to reduce file size and improve maintainability.
 * This module manages all layer transformation operations including:
 * - Resize (8 handles for rectangles, circles, ellipses, polygons, lines, paths, text)
 * - Rotation (rotation handle with shift-snap to 15-degree increments)
 * - Drag (single and multi-layer drag with snap-to-grid support)
 *
 * @module canvas/TransformController
 */
( function () {
	'use strict';

	/**
	 * TransformController class
	 *
	 * @class
	 * @param {Object} canvasManager Reference to parent CanvasManager
	 */
	function TransformController( canvasManager ) {
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

		// Throttling for transform events
		this.transformEventScheduled = false;
		this.lastTransformPayload = null;
	}

	// ==================== Resize Operations ====================

	/**
	 * Start a resize operation on the selected layer
	 *
	 * @param {Object} handle The resize handle being dragged
	 * @param {Object} startPoint The starting mouse point
	 */
	TransformController.prototype.startResize = function ( handle, startPoint ) {
		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartPoint = startPoint;

		// Get rotation for proper cursor
		var layer = this.manager.editor.getLayerById( this.manager.selectedLayerId );
		var rotation = layer ? layer.rotation : 0;
		this.manager.canvas.style.cursor = this.getResizeCursor( handle.type, rotation );

		// Store original layer state
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}
	};

	/**
	 * Handle resize during mouse move
	 *
	 * @param {Object} point Current mouse point
	 * @param {Event} event Mouse event for modifier keys
	 */
	TransformController.prototype.handleResize = function ( point, event ) {
		var layer = this.manager.editor.getLayerById( this.manager.selectedLayerId );

		if ( !layer || !this.originalLayerState ) {
			return;
		}

		var deltaX = point.x - this.dragStartPoint.x;
		var deltaY = point.y - this.dragStartPoint.y;

		// If layer has rotation, transform the delta into the layer's local coordinate system
		var rotation = layer.rotation || 0;
		if ( rotation !== 0 ) {
			var rotRad = -rotation * Math.PI / 180;
			var cos = Math.cos( rotRad );
			var sin = Math.sin( rotRad );
			var rotatedDeltaX = deltaX * cos - deltaY * sin;
			var rotatedDeltaY = deltaX * sin + deltaY * cos;
			deltaX = rotatedDeltaX;
			deltaY = rotatedDeltaY;
		}

		// Limit delta values to prevent sudden jumps during rapid mouse movements
		var maxDelta = 1000;
		deltaX = Math.max( -maxDelta, Math.min( maxDelta, deltaX ) );
		deltaY = Math.max( -maxDelta, Math.min( maxDelta, deltaY ) );

		// Get modifier keys from the event
		var modifiers = {
			proportional: event && event.shiftKey,
			fromCenter: event && event.altKey
		};

		// Calculate new dimensions based on handle type
		var updates = this.calculateResize(
			this.originalLayerState,
			this.resizeHandle.type,
			deltaX,
			deltaY,
			modifiers
		);

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

			// Re-render and emit live-transform event
			this.manager.renderLayers( this.manager.editor.layers );
			this.emitTransforming( layer );
		}
	};

	/**
	 * Finish the resize operation
	 */
	TransformController.prototype.finishResize = function () {
		this.isResizing = false;
		this.resizeHandle = null;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Mark editor as dirty
		this.manager.editor.markDirty();
	};

	/**
	 * Get the appropriate cursor for a resize handle
	 *
	 * @param {string} handleType Handle type (n, s, e, w, ne, nw, se, sw)
	 * @param {number} rotation Layer rotation in degrees
	 * @return {string} CSS cursor value
	 */
	TransformController.prototype.getResizeCursor = function ( handleType, rotation ) {
		// If no rotation, use the original cursor logic
		if ( !rotation || rotation === 0 ) {
			switch ( handleType ) {
				case 'nw':
				case 'se':
					return 'nw-resize';
				case 'ne':
				case 'sw':
					return 'ne-resize';
				case 'n':
				case 's':
					return 'n-resize';
				case 'e':
				case 'w':
					return 'e-resize';
				default:
					return 'default';
			}
		}

		// For rotated objects, calculate the effective cursor direction
		var normalizedRotation = ( ( rotation % 360 ) + 360 ) % 360;
		var cursorIndex = Math.round( normalizedRotation / 45 ) % 8;

		// Map handle types to base cursor directions (0 = north)
		var baseCursors = {
			n: 0,
			ne: 1,
			e: 2,
			se: 3,
			s: 4,
			sw: 5,
			w: 6,
			nw: 7
		};

		// Calculate the effective cursor direction
		var effectiveDirection = ( baseCursors[ handleType ] + cursorIndex ) % 8;

		// Map back to cursor names
		var cursors = [ 'n-resize', 'ne-resize', 'e-resize', 'ne-resize', 'n-resize', 'ne-resize', 'e-resize', 'nw-resize' ];
		return cursors[ effectiveDirection ];
	};

	/**
	 * Calculate resize updates based on layer type
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @param {Object} modifiers Modifier keys state
	 * @return {Object|null} Updates object with new dimensions
	 */
	TransformController.prototype.calculateResize = function (
		originalLayer, handleType, deltaX, deltaY, modifiers
	) {
		modifiers = modifiers || {};

		switch ( originalLayer.type ) {
			case 'rectangle':
			case 'blur':
				return this.calculateRectangleResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'circle':
				return this.calculateCircleResize(
					originalLayer, handleType, deltaX, deltaY, modifiers
				);
			case 'ellipse':
				return this.calculateEllipseResize(
					originalLayer, handleType, deltaX, deltaY
				);
			case 'polygon':
			case 'star':
				return this.calculatePolygonResize(
					originalLayer, handleType, deltaX, deltaY
				);
			case 'line':
			case 'arrow':
				return this.calculateLineResize(
					originalLayer, handleType, deltaX, deltaY
				);
			case 'path':
				return this.calculatePathResize(
					originalLayer, handleType, deltaX, deltaY
				);
			case 'text':
				return this.calculateTextResize(
					originalLayer, handleType, deltaX, deltaY
				);
			default:
				return null;
		}
	};

	/**
	 * Calculate rectangle resize adjustments
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @param {Object} modifiers Modifier keys state
	 * @return {Object} Updates object with new dimensions
	 */
	TransformController.prototype.calculateRectangleResize = function (
		originalLayer, handleType, deltaX, deltaY, modifiers
	) {
		modifiers = modifiers || {};
		var updates = {};
		var origX = originalLayer.x || 0;
		var origY = originalLayer.y || 0;
		var origW = originalLayer.width || 0;
		var origH = originalLayer.height || 0;

		// Calculate aspect ratio for proportional scaling
		var aspectRatio = origW / origH;
		var centerX = origX + origW / 2;
		var centerY = origY + origH / 2;

		if ( modifiers.proportional ) {
			// Proportional scaling: maintain aspect ratio
			if ( aspectRatio === 0 || !isFinite( aspectRatio ) ) {
				aspectRatio = 1.0;
			}

			var absDeltaX = Math.abs( deltaX );
			var absDeltaY = Math.abs( deltaY );

			if ( absDeltaX > absDeltaY ) {
				deltaY = deltaY < 0 ? -absDeltaX / aspectRatio : absDeltaX / aspectRatio;
			} else {
				deltaX = deltaX < 0 ? -absDeltaY * aspectRatio : absDeltaY * aspectRatio;
			}
		}

		switch ( handleType ) {
			case 'nw':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW - deltaX ) / 2;
					updates.y = centerY - ( origH - deltaY ) / 2;
					updates.width = origW - deltaX;
					updates.height = origH - deltaY;
				} else {
					updates.x = origX + deltaX;
					updates.y = origY + deltaY;
					updates.width = origW - deltaX;
					updates.height = origH - deltaY;
				}
				break;
			case 'ne':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW + deltaX ) / 2;
					updates.y = centerY - ( origH - deltaY ) / 2;
					updates.width = origW + deltaX;
					updates.height = origH - deltaY;
				} else {
					updates.y = origY + deltaY;
					updates.width = origW + deltaX;
					updates.height = origH - deltaY;
				}
				break;
			case 'sw':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW - deltaX ) / 2;
					updates.y = centerY - ( origH + deltaY ) / 2;
					updates.width = origW - deltaX;
					updates.height = origH + deltaY;
				} else {
					updates.x = origX + deltaX;
					updates.width = origW - deltaX;
					updates.height = origH + deltaY;
				}
				break;
			case 'se':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW + deltaX ) / 2;
					updates.y = centerY - ( origH + deltaY ) / 2;
					updates.width = origW + deltaX;
					updates.height = origH + deltaY;
				} else {
					updates.width = origW + deltaX;
					updates.height = origH + deltaY;
				}
				break;
			case 'n':
				if ( modifiers.fromCenter ) {
					updates.y = centerY - ( origH - deltaY ) / 2;
					updates.height = origH - deltaY;
				} else {
					updates.y = origY + deltaY;
					updates.height = origH - deltaY;
				}
				break;
			case 's':
				if ( modifiers.fromCenter ) {
					updates.y = centerY - ( origH + deltaY ) / 2;
					updates.height = origH + deltaY;
				} else {
					updates.height = origH + deltaY;
				}
				break;
			case 'w':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW - deltaX ) / 2;
					updates.width = origW - deltaX;
				} else {
					updates.x = origX + deltaX;
					updates.width = origW - deltaX;
				}
				break;
			case 'e':
				if ( modifiers.fromCenter ) {
					updates.x = centerX - ( origW + deltaX ) / 2;
					updates.width = origW + deltaX;
				} else {
					updates.width = origW + deltaX;
				}
				break;
		}

		// Apply minimum size constraints
		if ( updates.width !== undefined ) {
			updates.width = Math.max( 5, updates.width );
		}
		if ( updates.height !== undefined ) {
			updates.height = Math.max( 5, updates.height );
		}

		// Prevent extreme coordinate values
		if ( updates.x !== undefined ) {
			updates.x = Math.max( -10000, Math.min( 10000, updates.x ) );
		}
		if ( updates.y !== undefined ) {
			updates.y = Math.max( -10000, Math.min( 10000, updates.y ) );
		}
		if ( updates.width !== undefined ) {
			updates.width = Math.min( 10000, updates.width );
		}
		if ( updates.height !== undefined ) {
			updates.height = Math.min( 10000, updates.height );
		}

		return updates;
	};

	/**
	 * Calculate circle resize adjustments
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new radius
	 */
	TransformController.prototype.calculateCircleResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		var updates = {};
		var origRadius = originalLayer.radius || 50;
		var origX = originalLayer.x || 0;
		var origY = originalLayer.y || 0;

		// Calculate new position based on handle and delta
		var handleX, handleY;
		switch ( handleType ) {
			case 'e':
				handleX = origX + origRadius + deltaX;
				handleY = origY;
				break;
			case 'w':
				handleX = origX - origRadius + deltaX;
				handleY = origY;
				break;
			case 'n':
				handleX = origX;
				handleY = origY - origRadius + deltaY;
				break;
			case 's':
				handleX = origX;
				handleY = origY + origRadius + deltaY;
				break;
			case 'ne':
				handleX = origX + origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY - origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			case 'nw':
				handleX = origX - origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY - origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			case 'se':
				handleX = origX + origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY + origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			case 'sw':
				handleX = origX - origRadius * Math.cos( Math.PI / 4 ) + deltaX;
				handleY = origY + origRadius * Math.sin( Math.PI / 4 ) + deltaY;
				break;
			default:
				return null;
		}

		// Calculate new radius based on distance from center
		var newRadius = Math.sqrt(
			( handleX - origX ) * ( handleX - origX ) +
			( handleY - origY ) * ( handleY - origY )
		);

		updates.radius = Math.max( 5, newRadius );
		return updates;
	};

	/**
	 * Calculate ellipse resize adjustments
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new radiusX/radiusY
	 */
	TransformController.prototype.calculateEllipseResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		var updates = {};
		var origRX = originalLayer.radiusX || 1;
		var origRY = originalLayer.radiusY || 1;

		if ( handleType === 'e' || handleType === 'w' ) {
			updates.radiusX = Math.max(
				5,
				origRX + ( handleType === 'e' ? deltaX : -deltaX )
			);
		}
		if ( handleType === 'n' || handleType === 's' ) {
			updates.radiusY = Math.max(
				5,
				origRY + ( handleType === 's' ? deltaY : -deltaY )
			);
		}
		return updates;
	};

	/**
	 * Calculate polygon/star resize adjustments
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new radius
	 */
	TransformController.prototype.calculatePolygonResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		var updates = {};
		var origRadius = originalLayer.radius || 50;
		var deltaDistance = 0;

		switch ( handleType ) {
			case 'e':
			case 'w':
				deltaDistance = Math.abs( deltaX );
				break;
			case 'n':
			case 's':
				deltaDistance = Math.abs( deltaY );
				break;
			case 'ne':
			case 'nw':
			case 'se':
			case 'sw':
				deltaDistance = Math.max( Math.abs( deltaX ), Math.abs( deltaY ) );
				break;
		}

		// Determine direction (growing or shrinking)
		var growing = false;
		switch ( handleType ) {
			case 'e':
				growing = deltaX > 0;
				break;
			case 'w':
				growing = deltaX < 0;
				break;
			case 'n':
				growing = deltaY < 0;
				break;
			case 's':
				growing = deltaY > 0;
				break;
			case 'ne':
				growing = deltaX > 0 || deltaY < 0;
				break;
			case 'nw':
				growing = deltaX < 0 || deltaY < 0;
				break;
			case 'se':
				growing = deltaX > 0 || deltaY > 0;
				break;
			case 'sw':
				growing = deltaX < 0 || deltaY > 0;
				break;
		}

		var newRadius = growing ?
			origRadius + deltaDistance :
			Math.max( 10, origRadius - deltaDistance );

		updates.radius = newRadius;
		return updates;
	};

	/**
	 * Calculate line/arrow resize adjustments
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged (unused for lines)
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new x2/y2
	 */
	TransformController.prototype.calculateLineResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		var updates = {};
		updates.x2 = ( originalLayer.x2 || 0 ) + deltaX;
		updates.y2 = ( originalLayer.y2 || 0 ) + deltaY;
		return updates;
	};

	/**
	 * Calculate path resize adjustments (scales all points)
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged (unused)
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object|null} Updates object with scaled points
	 */
	TransformController.prototype.calculatePathResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		if ( !originalLayer.points ) {
			return null;
		}
		var updates = { points: [] };
		var scaleX = 1 + deltaX / 100;
		var scaleY = 1 + deltaY / 100;

		for ( var i = 0; i < originalLayer.points.length; i++ ) {
			updates.points.push( {
				x: originalLayer.points[ i ].x * scaleX,
				y: originalLayer.points[ i ].y * scaleY
			} );
		}
		return updates;
	};

	/**
	 * Calculate text resize adjustments (changes font size)
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement
	 * @param {number} deltaY Delta Y movement
	 * @return {Object} Updates object with new fontSize
	 */
	TransformController.prototype.calculateTextResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		var updates = {};
		var originalFontSize = originalLayer.fontSize || 16;

		// Calculate font size change based on diagonal movement
		var diagonalDelta = Math.sqrt( deltaX * deltaX + deltaY * deltaY );
		var fontSizeChange = diagonalDelta * 0.2;

		// Determine if we're growing or shrinking based on handle direction
		var isGrowing = false;
		switch ( handleType ) {
			case 'se':
			case 'e':
			case 's':
				isGrowing = ( deltaX > 0 || deltaY > 0 );
				break;
			case 'nw':
			case 'w':
			case 'n':
				isGrowing = ( deltaX < 0 || deltaY < 0 );
				break;
			case 'ne':
				isGrowing = ( deltaX > 0 || deltaY < 0 );
				break;
			case 'sw':
				isGrowing = ( deltaX < 0 || deltaY > 0 );
				break;
		}

		var newFontSize = originalFontSize;
		if ( isGrowing ) {
			newFontSize += fontSizeChange;
		} else {
			newFontSize -= fontSizeChange;
		}

		// Clamp font size to reasonable bounds
		newFontSize = Math.max( 6, Math.min( 144, newFontSize ) );
		updates.fontSize = Math.round( newFontSize );

		return updates;
	};

	// ==================== Rotation Operations ====================

	/**
	 * Start a rotation operation on the selected layer
	 *
	 * @param {Object} point Starting mouse point
	 */
	TransformController.prototype.startRotation = function ( point ) {
		this.isRotating = true;
		this.manager.canvas.style.cursor = 'grabbing';
		if ( point ) {
			this.dragStartPoint = point;
		}

		// Store original layer state
		var layer = this.manager.editor.getLayerById( this.manager.selectedLayerId );
		if ( layer ) {
			this.originalLayerState = JSON.parse( JSON.stringify( layer ) );
		}
	};

	/**
	 * Handle rotation during mouse move
	 *
	 * @param {Object} point Current mouse point
	 * @param {Event} event Mouse event for modifier keys
	 */
	TransformController.prototype.handleRotation = function ( point, event ) {
		var layer = this.manager.editor.getLayerById( this.manager.selectedLayerId );
		if ( !layer ) {
			return;
		}

		// Calculate angle from rotation center to mouse position
		var bounds = this.manager.getLayerBounds( layer );
		if ( !bounds ) {
			return;
		}

		var centerX = bounds.centerX;
		var centerY = bounds.centerY;

		var startAngle = Math.atan2(
			this.dragStartPoint.y - centerY,
			this.dragStartPoint.x - centerX
		);
		var currentAngle = Math.atan2( point.y - centerY, point.x - centerX );

		var angleDelta = currentAngle - startAngle;
		var degrees = angleDelta * ( 180 / Math.PI );

		// Apply snap-to-angle if Shift key is held (15-degree increments)
		if ( event && event.shiftKey ) {
			var snapAngle = 15;
			degrees = Math.round( degrees / snapAngle ) * snapAngle;
		}

		// Apply rotation
		layer.rotation = ( this.originalLayerState.rotation || 0 ) + degrees;

		// Re-render and emit live-transform event
		this.manager.renderLayers( this.manager.editor.layers );
		this.emitTransforming( layer );
	};

	/**
	 * Finish the rotation operation
	 */
	TransformController.prototype.finishRotation = function () {
		this.isRotating = false;
		this.originalLayerState = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Mark editor as dirty
		this.manager.editor.markDirty();
	};

	// ==================== Drag Operations ====================

	/**
	 * Start a drag operation on selected layer(s)
	 *
	 * @param {Object} startPoint Starting mouse point
	 */
	TransformController.prototype.startDrag = function ( startPoint ) {
		this.isDragging = true;
		this.dragStartPoint = startPoint;
		this.manager.canvas.style.cursor = 'move';

		// Store original layer state(s)
		if ( this.manager.selectedLayerIds.length > 1 ) {
			// Multi-selection: store all selected layer states
			this.originalMultiLayerStates = {};
			for ( var i = 0; i < this.manager.selectedLayerIds.length; i++ ) {
				var layerId = this.manager.selectedLayerIds[ i ];
				var multiLayer = this.manager.editor.getLayerById( layerId );
				if ( multiLayer ) {
					this.originalMultiLayerStates[ layerId ] =
						JSON.parse( JSON.stringify( multiLayer ) );
				}
			}
		} else {
			// Single selection: store single layer state
			var singleLayer = this.manager.editor.getLayerById( this.manager.selectedLayerId );
			if ( singleLayer ) {
				this.originalLayerState = JSON.parse( JSON.stringify( singleLayer ) );
			}
		}
	};

	/**
	 * Handle drag during mouse move
	 *
	 * @param {Object} point Current mouse point
	 */
	TransformController.prototype.handleDrag = function ( point ) {
		var deltaX = point.x - this.dragStartPoint.x;
		var deltaY = point.y - this.dragStartPoint.y;

		// Enable drag preview mode for visual feedback
		this.showDragPreview = true;

		// Collect layers to move
		var layersToMove = [];
		if ( this.manager.selectedLayerIds.length > 1 ) {
			for ( var i = 0; i < this.manager.selectedLayerIds.length; i++ ) {
				var multiLayer = this.manager.editor.getLayerById( this.manager.selectedLayerIds[ i ] );
				if ( multiLayer ) {
					layersToMove.push( multiLayer );
				}
			}
		} else {
			var singleLayer = this.manager.editor.getLayerById( this.manager.selectedLayerId );
			if ( singleLayer && this.originalLayerState ) {
				layersToMove.push( singleLayer );
			}
		}

		// Move all layers in the selection
		for ( var j = 0; j < layersToMove.length; j++ ) {
			var layerToMove = layersToMove[ j ];
			var originalState = this.originalLayerState;

			// For multi-selection, get individual original states
			if ( this.manager.selectedLayerIds.length > 1 && this.originalMultiLayerStates ) {
				originalState = this.originalMultiLayerStates[ layerToMove.id ];
			}

			if ( !originalState ) {
				continue;
			}

			// Apply snap-to-grid if enabled
			var adjustedDeltaX = deltaX;
			var adjustedDeltaY = deltaY;

			if ( this.manager.snapToGrid && this.manager.gridSize > 0 ) {
				var newX = ( originalState.x || 0 ) + deltaX;
				var newY = ( originalState.y || 0 ) + deltaY;
				var snappedPoint = this.manager.snapPointToGrid( { x: newX, y: newY } );
				adjustedDeltaX = snappedPoint.x - ( originalState.x || 0 );
				adjustedDeltaY = snappedPoint.y - ( originalState.y || 0 );
			}

			// Update layer position based on type
			this.updateLayerPosition( layerToMove, originalState, adjustedDeltaX, adjustedDeltaY );
		}

		// Re-render and emit live-transform event
		this.manager.renderLayers( this.manager.editor.layers );
		var active = this.manager.editor.getLayerById( this.manager.selectedLayerId );
		if ( active ) {
			this.emitTransforming( active );
		}
	};

	/**
	 * Update layer position during drag operation
	 *
	 * @param {Object} layer Layer to update
	 * @param {Object} originalState Original state before drag
	 * @param {number} deltaX X offset
	 * @param {number} deltaY Y offset
	 */
	TransformController.prototype.updateLayerPosition = function (
		layer, originalState, deltaX, deltaY
	) {
		switch ( layer.type ) {
			case 'rectangle':
			case 'blur':
			case 'circle':
			case 'text':
			case 'ellipse':
			case 'polygon':
			case 'star':
				layer.x = ( originalState.x || 0 ) + deltaX;
				layer.y = ( originalState.y || 0 ) + deltaY;
				break;
			case 'line':
			case 'arrow':
				layer.x1 = ( originalState.x1 || 0 ) + deltaX;
				layer.y1 = ( originalState.y1 || 0 ) + deltaY;
				layer.x2 = ( originalState.x2 || 0 ) + deltaX;
				layer.y2 = ( originalState.y2 || 0 ) + deltaY;
				break;
			case 'path':
			case 'highlight':
				if ( originalState.points && originalState.points.length > 0 ) {
					layer.points = originalState.points.map( function ( pt ) {
						return { x: pt.x + deltaX, y: pt.y + deltaY };
					} );
				}
				break;
		}
	};

	/**
	 * Finish the drag operation
	 */
	TransformController.prototype.finishDrag = function () {
		this.isDragging = false;
		this.showDragPreview = false;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Mark editor as dirty
		this.manager.editor.markDirty();
	};

	// ==================== Utility Methods ====================

	/**
	 * Emit a throttled custom event with current transform values
	 * to allow the properties panel to live-sync during manipulation.
	 *
	 * @param {Object} layer The layer object to serialize and emit
	 */
	TransformController.prototype.emitTransforming = function ( layer ) {
		if ( !layer ) {
			return;
		}
		this.lastTransformPayload = layer;
		if ( this.transformEventScheduled ) {
			return;
		}
		this.transformEventScheduled = true;
		var self = this;
		window.requestAnimationFrame( function () {
			self.transformEventScheduled = false;
			var target = ( self.manager.editor && self.manager.editor.container ) ||
				self.manager.container || document;
			try {
				var detail = {
					id: self.lastTransformPayload.id,
					layer: JSON.parse( JSON.stringify( self.lastTransformPayload ) )
				};
				var evt = new CustomEvent( 'layers:transforming', { detail: detail } );
				target.dispatchEvent( evt );
			} catch ( _e ) { /* ignore */ }
		} );
	};

	/**
	 * Check if any transform operation is active
	 *
	 * @return {boolean} True if resizing, rotating, or dragging
	 */
	TransformController.prototype.isTransforming = function () {
		return this.isResizing || this.isRotating || this.isDragging;
	};

	/**
	 * Get the current transform state
	 *
	 * @return {Object} Current transform state
	 */
	TransformController.prototype.getState = function () {
		return {
			isResizing: this.isResizing,
			isRotating: this.isRotating,
			isDragging: this.isDragging,
			resizeHandle: this.resizeHandle,
			showDragPreview: this.showDragPreview
		};
	};

	// Export for use by CanvasManager
	window.TransformController = TransformController;

}() );
