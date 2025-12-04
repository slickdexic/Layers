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
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
		const rotation = layer ? layer.rotation : 0;
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
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );

		if ( !layer || !this.originalLayerState ) {
			return;
		}

		let deltaX = point.x - this.dragStartPoint.x;
		let deltaY = point.y - this.dragStartPoint.y;

		// If layer has rotation, transform the delta into the layer's local coordinate system
		const rotation = layer.rotation || 0;
		if ( rotation !== 0 ) {
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

		// Calculate new dimensions based on handle type
		const updates = this.calculateResize(
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
	 * The cursor should indicate the direction of resize movement, which is
	 * perpendicular to the edge being dragged. For rotated shapes, we need to
	 * rotate the cursor direction by the same amount as the shape.
	 *
	 * @param {string} handleType Handle type (n, s, e, w, ne, nw, se, sw)
	 * @param {number} rotation Layer rotation in degrees
	 * @return {string} CSS cursor value
	 */
	TransformController.prototype.getResizeCursor = function ( handleType, rotation ) {
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
	 * For rotated rectangles, this method ensures that the edge opposite to the
	 * dragged handle stays fixed in world space, providing intuitive resize behavior.
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged
	 * @param {number} deltaX Delta X movement (in local coords)
	 * @param {number} deltaY Delta Y movement (in local coords)
	 * @param {Object} modifiers Modifier keys state
	 * @return {Object} Updates object with new dimensions
	 */
	TransformController.prototype.calculateRectangleResize = function (
		originalLayer, handleType, deltaX, deltaY, modifiers
	) {
		modifiers = modifiers || {};
		const updates = {};
		const origX = originalLayer.x || 0;
		const origY = originalLayer.y || 0;
		const origW = originalLayer.width || 0;
		const origH = originalLayer.height || 0;
		const rotation = originalLayer.rotation || 0;

		// Calculate aspect ratio for proportional scaling
		let aspectRatio = origW / origH;
		const centerX = origX + origW / 2;
		const centerY = origY + origH / 2;

		if ( modifiers.proportional ) {
			// Proportional scaling: maintain aspect ratio
			if ( aspectRatio === 0 || !isFinite( aspectRatio ) ) {
				aspectRatio = 1.0;
			}

			const absDeltaX = Math.abs( deltaX );
			const absDeltaY = Math.abs( deltaY );

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

		// For rotated shapes, apply anchor point correction to keep opposite edge fixed in world space
		// This only applies to edge handles (n, s, e, w) when not resizing from center
		if ( rotation !== 0 && !modifiers.fromCenter ) {
			this.applyRotatedResizeCorrection( updates, originalLayer, handleType );
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
	 * Apply correction to keep the opposite edge fixed in world space for rotated shapes.
	 *
	 * When resizing a rotated shape from an edge handle, the opposite edge should stay
	 * fixed in world coordinates. Without correction, the center point moves, which
	 * causes the opposite edge to shift because the rotation pivot changes.
	 *
	 * @param {Object} updates The updates object to modify
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged (n, s, e, w, or corner)
	 */
	TransformController.prototype.applyRotatedResizeCorrection = function (
		updates, originalLayer, handleType
	) {
		const rotation = originalLayer.rotation || 0;
		if ( rotation === 0 ) {
			return;
		}

		const origX = originalLayer.x || 0;
		const origY = originalLayer.y || 0;
		const origW = originalLayer.width || 0;
		const origH = originalLayer.height || 0;

		// Calculate original center
		const origCenterX = origX + origW / 2;
		const origCenterY = origY + origH / 2;

		// Calculate new dimensions
		const newX = updates.x !== undefined ? updates.x : origX;
		const newY = updates.y !== undefined ? updates.y : origY;
		const newW = updates.width !== undefined ? updates.width : origW;
		const newH = updates.height !== undefined ? updates.height : origH;

		// Calculate new center
		const newCenterX = newX + newW / 2;
		const newCenterY = newY + newH / 2;

		// If centers are the same, no correction needed
		if ( Math.abs( newCenterX - origCenterX ) < 0.001 &&
			Math.abs( newCenterY - origCenterY ) < 0.001 ) {
			return;
		}

		const rotRad = rotation * Math.PI / 180;
		const cos = Math.cos( rotRad );
		const sin = Math.sin( rotRad );

		// Determine which edge should stay fixed based on handle type
		// anchor is the local offset from center to the fixed edge center
		let anchorLocalX = 0;
		let anchorLocalY = 0;

		switch ( handleType ) {
			case 'n':
				// North handle: south edge should stay fixed
				anchorLocalY = origH / 2; // local offset to south edge
				break;
			case 's':
				// South handle: north edge should stay fixed
				anchorLocalY = -origH / 2; // local offset to north edge
				break;
			case 'e':
				// East handle: west edge should stay fixed
				anchorLocalX = -origW / 2; // local offset to west edge
				break;
			case 'w':
				// West handle: east edge should stay fixed
				anchorLocalX = origW / 2; // local offset to east edge
				break;
			case 'nw':
				// NW handle: SE corner should stay fixed
				anchorLocalX = origW / 2;
				anchorLocalY = origH / 2;
				break;
			case 'ne':
				// NE handle: SW corner should stay fixed
				anchorLocalX = -origW / 2;
				anchorLocalY = origH / 2;
				break;
			case 'sw':
				// SW handle: NE corner should stay fixed
				anchorLocalX = origW / 2;
				anchorLocalY = -origH / 2;
				break;
			case 'se':
				// SE handle: NW corner should stay fixed
				anchorLocalX = -origW / 2;
				anchorLocalY = -origH / 2;
				break;
			default:
				return;
		}

		// Calculate the anchor point in world space (original)
		// World = Center + Rotate(LocalOffset)
		const origAnchorWorldX = origCenterX + anchorLocalX * cos - anchorLocalY * sin;
		const origAnchorWorldY = origCenterY + anchorLocalX * sin + anchorLocalY * cos;

		// Calculate the new local offset to the fixed edge/corner
		let newAnchorLocalX = 0;
		let newAnchorLocalY = 0;

		switch ( handleType ) {
			case 'n':
				newAnchorLocalY = newH / 2;
				break;
			case 's':
				newAnchorLocalY = -newH / 2;
				break;
			case 'e':
				newAnchorLocalX = -newW / 2;
				break;
			case 'w':
				newAnchorLocalX = newW / 2;
				break;
			case 'nw':
				newAnchorLocalX = newW / 2;
				newAnchorLocalY = newH / 2;
				break;
			case 'ne':
				newAnchorLocalX = -newW / 2;
				newAnchorLocalY = newH / 2;
				break;
			case 'sw':
				newAnchorLocalX = newW / 2;
				newAnchorLocalY = -newH / 2;
				break;
			case 'se':
				newAnchorLocalX = -newW / 2;
				newAnchorLocalY = -newH / 2;
				break;
		}

		// If the new center were (newCenterX, newCenterY), where would the anchor be in world?
		// We want this to equal origAnchorWorld, so we need to adjust the center.
		// newAnchorWorld = newCenter + Rotate(newAnchorLocal)
		// We want: origAnchorWorld = adjustedCenter + Rotate(newAnchorLocal)
		// So: adjustedCenter = origAnchorWorld - Rotate(newAnchorLocal)

		const adjustedCenterX = origAnchorWorldX - ( newAnchorLocalX * cos - newAnchorLocalY * sin );
		const adjustedCenterY = origAnchorWorldY - ( newAnchorLocalX * sin + newAnchorLocalY * cos );

		// From adjusted center, calculate new x, y
		const adjustedX = adjustedCenterX - newW / 2;
		const adjustedY = adjustedCenterY - newH / 2;

		// Apply corrections
		updates.x = adjustedX;
		updates.y = adjustedY;
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
		const updates = {};
		const origRadius = originalLayer.radius || 50;
		const origX = originalLayer.x || 0;
		const origY = originalLayer.y || 0;

		// Calculate new position based on handle and delta
		let handleX, handleY;
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
		const newRadius = Math.sqrt(
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
		const updates = {};
		const origRX = originalLayer.radiusX || 1;
		const origRY = originalLayer.radiusY || 1;

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
		const updates = {};
		const origRadius = originalLayer.radius || 50;
		let deltaDistance = 0;

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
		let growing = false;
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

		const newRadius = growing ?
			origRadius + deltaDistance :
			Math.max( 10, origRadius - deltaDistance );

		updates.radius = newRadius;
		return updates;
	};

	/**
	 * Calculate line/arrow resize adjustments
	 * Handles both endpoint movement (w/e handles) and perpendicular offset (n/s handles)
	 *
	 * @param {Object} originalLayer Original layer properties
	 * @param {string} handleType Handle being dragged: 'w' = start point, 'e' = end point,
	 *                           'n'/'s' = perpendicular offset (adjusts both endpoints)
	 * @param {number} deltaX Delta X movement in world coordinates
	 * @param {number} deltaY Delta Y movement in world coordinates
	 * @return {Object} Updates object with new endpoint coordinates
	 */
	TransformController.prototype.calculateLineResize = function (
		originalLayer, handleType, deltaX, deltaY
	) {
		const updates = {};
		const x1 = originalLayer.x1 || 0;
		const y1 = originalLayer.y1 || 0;
		const x2 = originalLayer.x2 || 0;
		const y2 = originalLayer.y2 || 0;

		// Calculate line angle for transforms
		const dx = x2 - x1;
		const dy = y2 - y1;
		const angle = Math.atan2( dy, dx );

		// Add any user-applied rotation
		const additionalRotation = ( originalLayer.rotation || 0 ) * Math.PI / 180;

		switch ( handleType ) {
			case 'w':
				// Move start point (x1, y1)
				updates.x1 = x1 + deltaX;
				updates.y1 = y1 + deltaY;
				break;
			case 'e':
				// Move end point (x2, y2)
				updates.x2 = x2 + deltaX;
				updates.y2 = y2 + deltaY;
				break;
			case 'n':
			case 's': {
				// Perpendicular movement - offset both points perpendicular to line
				// Calculate perpendicular direction
				const perpAngle = angle + Math.PI / 2 + additionalRotation;
				// Project the delta onto the perpendicular direction
				const cos = Math.cos( perpAngle );
				const sin = Math.sin( perpAngle );
				const perpDist = deltaX * cos + deltaY * sin;
				const sign = handleType === 'n' ? 1 : -1;
				const offset = perpDist * sign;
				
				// Apply perpendicular offset to both endpoints
				const offsetX = Math.cos( perpAngle ) * offset;
				const offsetY = Math.sin( perpAngle ) * offset;
				updates.x1 = x1 + offsetX;
				updates.y1 = y1 + offsetY;
				updates.x2 = x2 + offsetX;
				updates.y2 = y2 + offsetY;
				break;
			}
			default:
				// Fallback to original behavior (move end point)
				updates.x2 = x2 + deltaX;
				updates.y2 = y2 + deltaY;
		}

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
		const updates = { points: [] };
		const scaleX = 1 + deltaX / 100;
		const scaleY = 1 + deltaY / 100;

		for ( let i = 0; i < originalLayer.points.length; i++ ) {
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
		const updates = {};
		const originalFontSize = originalLayer.fontSize || 16;

		// Calculate font size change based on diagonal movement
		const diagonalDelta = Math.sqrt( deltaX * deltaX + deltaY * deltaY );
		const fontSizeChange = diagonalDelta * 0.2;

		// Determine if we're growing or shrinking based on handle direction
		let isGrowing = false;
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

		let newFontSize = originalFontSize;
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
		const layer = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
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
	};

	/**
	 * Handle drag during mouse move
	 *
	 * @param {Object} point Current mouse point
	 */
	TransformController.prototype.handleDrag = function ( point ) {
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
			}

			// Update layer position based on type
			this.updateLayerPosition( layerToMove, originalState, adjustedDeltaX, adjustedDeltaY );
		}

		// Re-render and emit live-transform event
		this.manager.renderLayers( this.manager.editor.layers );
		const active = this.manager.editor.getLayerById( this.manager.getSelectedLayerId() );
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
		// Only mark dirty if actual drag movement occurred (showDragPreview is set in handleDrag)
		const hadMovement = this.showDragPreview;

		this.isDragging = false;
		this.showDragPreview = false;
		this.originalLayerState = null;
		this.originalMultiLayerStates = null;
		this.dragStartPoint = null;

		// Reset cursor to appropriate tool cursor
		this.manager.canvas.style.cursor = this.manager.getToolCursor( this.manager.currentTool );

		// Only mark editor as dirty if there was actual movement
		if ( hadMovement ) {
			this.manager.editor.markDirty();
		}
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
		const self = this;
		window.requestAnimationFrame( function () {
			self.transformEventScheduled = false;
			const target = ( self.manager.editor && self.manager.editor.container ) ||
				self.manager.container || document;
			try {
				const detail = {
					id: self.lastTransformPayload.id,
					layer: JSON.parse( JSON.stringify( self.lastTransformPayload ) )
				};
				const evt = new CustomEvent( 'layers:transforming', { detail: detail } );
				target.dispatchEvent( evt );
			} catch ( e ) {
				if ( window.layersErrorHandler ) {
					window.layersErrorHandler.handleError( e, 'TransformController.emitTransformEvent', 'canvas' );
				}
			}
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

	/**
	 * Clean up resources and state
	 */
	TransformController.prototype.destroy = function () {
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
	};

	// Export for use by CanvasManager
	window.TransformController = TransformController;

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TransformController;
	}

}() );
