/**
 * ResizeCalculator - Pure calculation methods for layer resize operations
 *
 * Extracted from TransformController.js to reduce file size and improve maintainability.
 * This module contains all resize calculation logic for different layer types:
 * - Rectangle/Blur (with rotation correction)
 * - Circle (radius-based)
 * - Ellipse (radiusX/radiusY)
 * - Polygon/Star (uniform radius scaling)
 * - Line/Arrow (endpoint and perpendicular movement)
 * - Path (point scaling from anchor)
 * - Text (font size adjustment)
 *
 * All methods are static since they are pure functions with no state.
 *
 * @module canvas/ResizeCalculator
 */
( function () {
	'use strict';

	/**
	 * ResizeCalculator class - static methods for resize calculations
	 */
	class ResizeCalculator {
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
		static calculateResize(
			originalLayer, handleType, deltaX, deltaY, modifiers
		) {
			modifiers = modifiers || {};

			// Special handling for callout tail tip
			if ( handleType === 'tailTip' && originalLayer.type === 'callout' ) {
				return ResizeCalculator.calculateCalloutTailResize(
					originalLayer, deltaX, deltaY
				);
			}

			switch ( originalLayer.type ) {
				case 'rectangle':
				case 'textbox':
				case 'callout':
				case 'blur':
				case 'image':
					return ResizeCalculator.calculateRectangleResize(
						originalLayer, handleType, deltaX, deltaY, modifiers
					);
				case 'circle':
					return ResizeCalculator.calculateCircleResize(
						originalLayer, handleType, deltaX, deltaY, modifiers
					);
				case 'ellipse':
					return ResizeCalculator.calculateEllipseResize(
						originalLayer, handleType, deltaX, deltaY
					);
				case 'polygon':
				case 'star':
					return ResizeCalculator.calculatePolygonResize(
						originalLayer, handleType, deltaX, deltaY
					);
				case 'line':
				case 'arrow':
					return ResizeCalculator.calculateLineResize(
						originalLayer, handleType, deltaX, deltaY
					);
				case 'path':
					return ResizeCalculator.calculatePathResize(
						originalLayer, handleType, deltaX, deltaY
					);
				case 'text':
					return ResizeCalculator.calculateTextResize(
						originalLayer, handleType, deltaX, deltaY
					);
				default:
					return null;
			}
		}

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
		static calculateRectangleResize(
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
				ResizeCalculator.applyRotatedResizeCorrection( updates, originalLayer, handleType );
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
		}

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
		static applyRotatedResizeCorrection(
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
		}

		/**
		 * Calculate circle resize adjustments
		 *
		 * @param {Object} originalLayer Original layer properties
		 * @param {string} handleType Handle being dragged
		 * @param {number} deltaX Delta X movement
		 * @param {number} deltaY Delta Y movement
		 * @return {Object} Updates object with new radius
		 */
		static calculateCircleResize(
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
		}

		/**
		 * Calculate ellipse resize adjustments
		 *
		 * @param {Object} originalLayer Original layer properties
		 * @param {string} handleType Handle being dragged
		 * @param {number} deltaX Delta X movement
		 * @param {number} deltaY Delta Y movement
		 * @return {Object} Updates object with new radiusX/radiusY
		 */
		static calculateEllipseResize(
			originalLayer, handleType, deltaX, deltaY
		) {
			const updates = {};
			const origRX = originalLayer.radiusX || 1;
			const origRY = originalLayer.radiusY || 1;

			// Edge handles: adjust only the corresponding axis
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

			// Corner handles: adjust both axes simultaneously
			if ( handleType === 'ne' || handleType === 'nw' ||
				handleType === 'se' || handleType === 'sw' ) {
				// Determine direction for X axis (e = right side, w = left side)
				const xSign = ( handleType === 'ne' || handleType === 'se' ) ? 1 : -1;
				// Determine direction for Y axis (s = bottom, n = top)
				const ySign = ( handleType === 'se' || handleType === 'sw' ) ? 1 : -1;

				updates.radiusX = Math.max( 5, origRX + ( xSign * deltaX ) );
				updates.radiusY = Math.max( 5, origRY + ( ySign * deltaY ) );
			}

			return updates;
		}

		/**
		 * Calculate polygon/star resize adjustments
		 *
		 * @param {Object} originalLayer Original layer properties
		 * @param {string} handleType Handle being dragged
		 * @param {number} deltaX Delta X movement
		 * @param {number} deltaY Delta Y movement
		 * @return {Object} Updates object with new radius
		 */
		static calculatePolygonResize(
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
		}

		/**
		 * Calculate line/arrow resize adjustments
		 * Handles both endpoint movement (w/e handles), perpendicular offset (n/s handles),
		 * and curve control point movement (control handle)
		 *
		 * @param {Object} originalLayer Original layer properties
		 * @param {string} handleType Handle being dragged: 'w' = start point, 'e' = end point,
		 *                           'n'/'s' = perpendicular offset (adjusts both endpoints),
		 *                           'control' = curve control point
		 * @param {number} deltaX Delta X movement in world coordinates
		 * @param {number} deltaY Delta Y movement in world coordinates
		 * @return {Object} Updates object with new endpoint coordinates
		 */
		static calculateLineResize(
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
				case 'control': {
					// Move curve control point
					// Get original control point or default to midpoint
					const origControlX = typeof originalLayer.controlX === 'number' ?
						originalLayer.controlX : ( x1 + x2 ) / 2;
					const origControlY = typeof originalLayer.controlY === 'number' ?
						originalLayer.controlY : ( y1 + y2 ) / 2;
					updates.controlX = origControlX + deltaX;
					updates.controlY = origControlY + deltaY;
					break;
				}
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
		}

		/**
		 * Calculate path resize adjustments (scales all points from anchor)
		 *
		 * The anchor point is on the opposite side of the dragged handle, so
		 * that edge stays fixed while the other side moves with the mouse.
		 *
		 * @param {Object} originalLayer Original layer properties
		 * @param {string} handleType Handle being dragged
		 * @param {number} deltaX Delta X movement
		 * @param {number} deltaY Delta Y movement
		 * @return {Object|null} Updates object with scaled points
		 */
		static calculatePathResize(
			originalLayer, handleType, deltaX, deltaY
		) {
			if ( !originalLayer.points || originalLayer.points.length === 0 ) {
				return null;
			}

			// Calculate bounding box of original points
			let minX = originalLayer.points[ 0 ].x;
			let minY = originalLayer.points[ 0 ].y;
			let maxX = minX;
			let maxY = minY;

			for ( let i = 1; i < originalLayer.points.length; i++ ) {
				const pt = originalLayer.points[ i ];
				minX = Math.min( minX, pt.x );
				minY = Math.min( minY, pt.y );
				maxX = Math.max( maxX, pt.x );
				maxY = Math.max( maxY, pt.y );
			}

			const width = maxX - minX;
			const height = maxY - minY;

			// Avoid division by zero
			if ( width < 1 && height < 1 ) {
				return null;
			}

			// Determine anchor point and scale factors based on handle type
			// The anchor is on the opposite side of the handle being dragged
			let anchorX, anchorY;
			let newWidth = width;
			let newHeight = height;

			switch ( handleType ) {
				case 'nw':
					anchorX = maxX;
					anchorY = maxY;
					newWidth = Math.max( 5, width - deltaX );
					newHeight = Math.max( 5, height - deltaY );
					break;
				case 'ne':
					anchorX = minX;
					anchorY = maxY;
					newWidth = Math.max( 5, width + deltaX );
					newHeight = Math.max( 5, height - deltaY );
					break;
				case 'sw':
					anchorX = maxX;
					anchorY = minY;
					newWidth = Math.max( 5, width - deltaX );
					newHeight = Math.max( 5, height + deltaY );
					break;
				case 'se':
					anchorX = minX;
					anchorY = minY;
					newWidth = Math.max( 5, width + deltaX );
					newHeight = Math.max( 5, height + deltaY );
					break;
				case 'n':
					anchorX = minX + width / 2;
					anchorY = maxY;
					newHeight = Math.max( 5, height - deltaY );
					break;
				case 's':
					anchorX = minX + width / 2;
					anchorY = minY;
					newHeight = Math.max( 5, height + deltaY );
					break;
				case 'w':
					anchorX = maxX;
					anchorY = minY + height / 2;
					newWidth = Math.max( 5, width - deltaX );
					break;
				case 'e':
					anchorX = minX;
					anchorY = minY + height / 2;
					newWidth = Math.max( 5, width + deltaX );
					break;
				default:
					return null;
			}

			// Calculate scale factors
			const scaleX = width > 0 ? newWidth / width : 1;
			const scaleY = height > 0 ? newHeight / height : 1;

			// Transform all points: scale relative to anchor point
			const updatedPoints = [];
			for ( let i = 0; i < originalLayer.points.length; i++ ) {
				const pt = originalLayer.points[ i ];
				updatedPoints.push( {
					x: anchorX + ( pt.x - anchorX ) * scaleX,
					y: anchorY + ( pt.y - anchorY ) * scaleY
				} );
			}

			return { points: updatedPoints };
		}

		/**
		 * Calculate text resize adjustments (changes font size)
		 *
		 * @param {Object} originalLayer Original layer properties
		 * @param {string} handleType Handle being dragged
		 * @param {number} deltaX Delta X movement
		 * @param {number} deltaY Delta Y movement
		 * @return {Object} Updates object with new fontSize
		 */
		static calculateTextResize(
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

			// Clamp font size to reasonable bounds (6-500)
			newFontSize = Math.max( 6, Math.min( 500, newFontSize ) );
			updates.fontSize = Math.round( newFontSize );

			return updates;
		}

		/**
		 * Calculate callout tail tip resize adjustments.
		 * Moves the tail tip to the new position based on drag delta.
		 *
		 * tailTipX/tailTipY are stored in LOCAL coordinates (relative to callout center,
		 * in unrotated space). This means the tail rotates with the callout body.
		 *
		 * @param {Object} originalLayer Original layer properties
		 * @param {number} deltaX Delta X movement in world coordinates
		 * @param {number} deltaY Delta Y movement in world coordinates
		 * @return {Object} Updates object with new tailTipX/tailTipY coordinates
		 */
		static calculateCalloutTailResize( originalLayer, deltaX, deltaY ) {
			const updates = {};

			const x = originalLayer.x || 0;
			const y = originalLayer.y || 0;
			const width = originalLayer.width || 100;
			const height = originalLayer.height || 60;
			const rotation = originalLayer.rotation || 0;

			// Get current tip position in LOCAL coordinates (relative to center)
			let currentLocalTipX, currentLocalTipY;

			if ( typeof originalLayer.tailTipX === 'number' &&
				typeof originalLayer.tailTipY === 'number' ) {
				// Already in local coordinates
				currentLocalTipX = originalLayer.tailTipX;
				currentLocalTipY = originalLayer.tailTipY;
			} else {
				// Calculate default tip position from legacy properties
				// These are calculated in local space relative to the callout
				const tailDirection = originalLayer.tailDirection || 'bottom';
				const tailPosition = typeof originalLayer.tailPosition === 'number' ?
					originalLayer.tailPosition : 0.5;
				const tailSize = originalLayer.tailSize || 20;

				// Calculate tip in world space (unrotated)
				let worldTipX, worldTipY;
				switch ( tailDirection ) {
					case 'top':
					case 'top-left':
					case 'top-right':
						worldTipX = x + width * tailPosition;
						worldTipY = y - tailSize;
						break;
					case 'bottom':
					case 'bottom-left':
					case 'bottom-right':
						worldTipX = x + width * tailPosition;
						worldTipY = y + height + tailSize;
						break;
					case 'left':
						worldTipX = x - tailSize;
						worldTipY = y + height * tailPosition;
						break;
					case 'right':
						worldTipX = x + width + tailSize;
						worldTipY = y + height * tailPosition;
						break;
					default:
						worldTipX = x + width * 0.5;
						worldTipY = y + height + tailSize;
				}

				// Convert to local coordinates (relative to center)
				const centerX = x + width / 2;
				const centerY = y + height / 2;
				currentLocalTipX = worldTipX - centerX;
				currentLocalTipY = worldTipY - centerY;
			}

			// Convert world delta to local delta (un-rotate if layer is rotated)
			let localDeltaX = deltaX;
			let localDeltaY = deltaY;

			if ( rotation !== 0 ) {
				const rad = -rotation * Math.PI / 180; // Negative to un-rotate
				const cos = Math.cos( rad );
				const sin = Math.sin( rad );
				localDeltaX = deltaX * cos - deltaY * sin;
				localDeltaY = deltaX * sin + deltaY * cos;
			}

			// Apply local delta to get new local position
			updates.tailTipX = currentLocalTipX + localDeltaX;
			updates.tailTipY = currentLocalTipY + localDeltaY;

			return updates;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.ResizeCalculator = ResizeCalculator;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ResizeCalculator;
	}

}() );
