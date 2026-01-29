/**
 * ArrowGeometry - Pure geometry calculations for arrow shapes
 *
 * Extracted from ArrowRenderer.js to reduce file size and improve maintainability.
 * This module handles all arrow vertex calculation including:
 * - Vertex building for straight arrows (single, double, no head)
 * - Head vertex building for different head types (pointed, chevron, standard)
 * - Bézier curve tangent calculation for curved arrows
 * - Arrow curve detection
 *
 * All methods are pure geometry calculations with no canvas dependencies.
 *
 * @module ArrowGeometry
 * @since 1.5.38
 */
( function () {
	'use strict';

	/**
	 * Arrow geometry constants
	 *
	 * These ratios were empirically determined to produce visually pleasing arrow heads.
	 * They are multiplied by the arrowSize parameter to scale proportionally.
	 *
	 * Geometry reference:
	 * - The arrow "barb" is the diagonal line extending from the tip
	 * - The "chevron" is the notch cut into the back of pointed arrow heads
	 * - "Head depth" is how far back from the tip the arrow head extends
	 */
	const ARROW_GEOMETRY = {
		/**
		 * Barb length ratio: how far the arrow barbs extend diagonally from the tip.
		 * Value of 1.56 creates a balanced, sharp appearance.
		 * Increasing makes the head more elongated; decreasing makes it stubbier.
		 */
		BARB_LENGTH_RATIO: 1.56,

		/**
		 * Barb width ratio: spread of the arrow head perpendicular to the shaft.
		 * Value of 0.8 provides good visibility without being too wide.
		 * This affects how "pointed" vs "spread" the arrowhead appears.
		 */
		BARB_WIDTH_RATIO: 0.8,

		/**
		 * Chevron depth ratio: depth of the notch in chevron/pointed arrow heads.
		 * Value of 0.52 creates a classic "notched" arrowhead look.
		 * Set to 0 for a flat-backed arrow head; higher values make deeper notches.
		 */
		CHEVRON_DEPTH_RATIO: 0.52,

		/**
		 * Head depth ratio: how far the arrow head extends back from the tip.
		 * Value of 1.3 ensures the head is prominent but not overwhelming.
		 */
		HEAD_DEPTH_RATIO: 1.3,

		/**
		 * Barb thickness ratio: thickness of barb lines relative to shaft.
		 * Value of 1.5 makes barbs slightly thicker than the shaft for visibility.
		 */
		BARB_THICKNESS_RATIO: 1.5
	};

	/**
	 * ArrowGeometry class - Pure geometry calculations for arrow shapes
	 */
	class ArrowGeometry {
		/**
		 * Creates a new ArrowGeometry instance
		 */
		constructor() {
			// No state needed - all methods are pure calculations
		}

		/**
		 * Get the arrow geometry constants
		 *
		 * @return {Object} Arrow geometry constants
		 */
		getConstants() {
			return ARROW_GEOMETRY;
		}

		/**
		 * Check if an arrow layer has a curve (non-default control point)
		 *
		 * @param {Object} layer - Arrow layer to check
		 * @return {boolean} True if the arrow is curved
		 */
		isCurved( layer ) {
			if ( typeof layer.controlX !== 'number' || typeof layer.controlY !== 'number' ) {
				return false;
			}
			// Check if control point differs from midpoint by more than 1px
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;
			const midX = ( x1 + x2 ) / 2;
			const midY = ( y1 + y2 ) / 2;
			const dx = layer.controlX - midX;
			const dy = layer.controlY - midY;
			return Math.sqrt( dx * dx + dy * dy ) > 1;
		}

		/**
		 * Get the tangent angle at a point on a quadratic Bézier curve
		 *
		 * @param {number} t - Parameter 0 to 1 (0 = start, 1 = end)
		 * @param {number} x1 - Start X
		 * @param {number} y1 - Start Y
		 * @param {number} cx - Control X
		 * @param {number} cy - Control Y
		 * @param {number} x2 - End X
		 * @param {number} y2 - End Y
		 * @return {number} Angle in radians
		 */
		getBezierTangent( t, x1, y1, cx, cy, x2, y2 ) {
			// Derivative of quadratic Bézier: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
			const dx = 2 * ( 1 - t ) * ( cx - x1 ) + 2 * t * ( x2 - cx );
			const dy = 2 * ( 1 - t ) * ( cy - y1 ) + 2 * t * ( y2 - cy );
			return Math.atan2( dy, dx );
		}

		/**
		 * Build the vertices for an arrow polygon
		 *
		 * @param {number} x1 - Start X
		 * @param {number} y1 - Start Y
		 * @param {number} x2 - End X (tip direction)
		 * @param {number} y2 - End Y
		 * @param {number} angle - Angle of arrow direction
		 * @param {number} perpAngle - Perpendicular angle
		 * @param {number} halfShaft - Half of shaft width
		 * @param {number} arrowSize - Size of arrowhead
		 * @param {string} arrowStyle - 'single', 'double', or 'none'
		 * @param {string} headType - 'pointed', 'chevron', or 'standard'
		 * @param {number} headScale - Scale factor for arrow head size
		 * @param {number} tailWidth - Extra width at tail end
		 * @return {Array} Array of {x, y} vertex objects
		 */
		buildArrowVertices(
			x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth
		) {
			const vertices = [];
			const cos = Math.cos( angle );
			const sin = Math.sin( angle );
			const perpCos = Math.cos( perpAngle );
			const perpSin = Math.sin( perpAngle );

			const effectiveHeadScale = headScale || 1.0;
			const barbAngle = Math.PI / 6;
			const barbLength = arrowSize * ARROW_GEOMETRY.BARB_LENGTH_RATIO * effectiveHeadScale;
			const barbWidth = arrowSize * ARROW_GEOMETRY.BARB_WIDTH_RATIO;
			const chevronDepth = arrowSize * ARROW_GEOMETRY.CHEVRON_DEPTH_RATIO * effectiveHeadScale;
			const tailExtra = ( tailWidth || 0 ) / 2;

			if ( arrowStyle === 'none' ) {
				vertices.push( { x: x1 + perpCos * ( halfShaft + tailExtra ), y: y1 + perpSin * ( halfShaft + tailExtra ) } );
				vertices.push( { x: x2 + perpCos * halfShaft, y: y2 + perpSin * halfShaft } );
				vertices.push( { x: x2 - perpCos * halfShaft, y: y2 - perpSin * halfShaft } );
				vertices.push( { x: x1 - perpCos * ( halfShaft + tailExtra ), y: y1 - perpSin * ( halfShaft + tailExtra ) } );
				return vertices;
			}

			const headDepth = arrowSize * ARROW_GEOMETRY.HEAD_DEPTH_RATIO * effectiveHeadScale;
			const headBaseX = x2 - cos * headDepth;
			const headBaseY = y2 - sin * headDepth;

			const leftBarbAngle = angle - barbAngle;
			const leftBarbCos = Math.cos( leftBarbAngle );
			const leftBarbSin = Math.sin( leftBarbAngle );

			const rightBarbAngle = angle + barbAngle;
			const rightBarbCos = Math.cos( rightBarbAngle );
			const rightBarbSin = Math.sin( rightBarbAngle );

			const barbThickness = halfShaft * ARROW_GEOMETRY.BARB_THICKNESS_RATIO;

			if ( arrowStyle === 'single' ) {
				this._buildSingleHeadVertices(
					vertices, x1, y1, x2, y2, cos, sin, perpCos, perpSin,
					halfShaft, tailExtra, headBaseX, headBaseY,
					barbLength, barbWidth, barbThickness, chevronDepth,
					leftBarbCos, leftBarbSin, rightBarbCos, rightBarbSin,
					headType
				);
			} else if ( arrowStyle === 'double' ) {
				this._buildDoubleHeadVertices(
					vertices, x1, y1, x2, y2, angle, cos, sin, perpCos, perpSin,
					halfShaft, headDepth, headBaseX, headBaseY,
					barbLength, barbWidth, barbThickness, chevronDepth,
					leftBarbCos, leftBarbSin, rightBarbCos, rightBarbSin,
					barbAngle, headType
				);
			}

			return vertices;
		}

		/**
		 * Build vertices for single-headed arrow
		 *
		 * @private
		 */
		_buildSingleHeadVertices(
			vertices, x1, y1, x2, y2, cos, sin, perpCos, perpSin,
			halfShaft, tailExtra, headBaseX, headBaseY,
			barbLength, barbWidth, barbThickness, chevronDepth,
			leftBarbCos, leftBarbSin, rightBarbCos, rightBarbSin,
			headType
		) {
			vertices.push( { x: x1 + perpCos * ( halfShaft + tailExtra ), y: y1 + perpSin * ( halfShaft + tailExtra ) } );

			if ( headType === 'standard' ) {
				const leftOuterX = x2 - barbLength * leftBarbCos;
				const leftOuterY = y2 - barbLength * leftBarbSin;
				const leftInnerX = leftOuterX + barbThickness * leftBarbSin;
				const leftInnerY = leftOuterY - barbThickness * leftBarbCos;
				const leftDx = leftInnerX - headBaseX;
				const leftDy = leftInnerY - headBaseY;
				const leftCurrentDist = leftDx * perpCos + leftDy * perpSin;
				const leftDeltaPerStep = leftBarbCos * perpCos + leftBarbSin * perpSin;
				const leftT = ( halfShaft - leftCurrentDist ) / leftDeltaPerStep;
				const leftShaftX = leftInnerX + leftT * leftBarbCos;
				const leftShaftY = leftInnerY + leftT * leftBarbSin;
				vertices.push( { x: leftShaftX, y: leftShaftY } );
				vertices.push( { x: leftInnerX, y: leftInnerY } );
				vertices.push( { x: leftOuterX, y: leftOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				vertices.push( {
					x: headBaseX - cos * chevronDepth + perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth + perpSin * barbWidth
				} );
			} else {
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				const leftBarbX = x2 - barbLength * leftBarbCos;
				const leftBarbY = y2 - barbLength * leftBarbSin;
				vertices.push( { x: leftBarbX, y: leftBarbY } );
			}

			vertices.push( { x: x2, y: y2 } );

			if ( headType === 'standard' ) {
				const rightOuterX = x2 - barbLength * rightBarbCos;
				const rightOuterY = y2 - barbLength * rightBarbSin;
				const rightInnerX = rightOuterX - barbThickness * rightBarbSin;
				const rightInnerY = rightOuterY + barbThickness * rightBarbCos;
				const rightDx = rightInnerX - headBaseX;
				const rightDy = rightInnerY - headBaseY;
				const rightCurrentDist = rightDx * perpCos + rightDy * perpSin;
				const rightDeltaPerStep = rightBarbCos * perpCos + rightBarbSin * perpSin;
				const rightT = ( -halfShaft - rightCurrentDist ) / rightDeltaPerStep;
				const rightShaftX = rightInnerX + rightT * rightBarbCos;
				const rightShaftY = rightInnerY + rightT * rightBarbSin;
				vertices.push( { x: rightOuterX, y: rightOuterY } );
				vertices.push( { x: rightInnerX, y: rightInnerY } );
				vertices.push( { x: rightShaftX, y: rightShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth - perpSin * barbWidth
				} );
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			} else {
				const rightBarbX = x2 - barbLength * rightBarbCos;
				const rightBarbY = y2 - barbLength * rightBarbSin;
				vertices.push( { x: rightBarbX, y: rightBarbY } );
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			}

			vertices.push( { x: x1 - perpCos * ( halfShaft + tailExtra ), y: y1 - perpSin * ( halfShaft + tailExtra ) } );
		}

		/**
		 * Build vertices for double-headed arrow
		 *
		 * Uses buildHeadVertices for both heads to ensure consistent rendering.
		 * For double-headed arrows, tailWidth is ignored (both heads are symmetric).
		 *
		 * @private
		 */
		_buildDoubleHeadVertices(
			vertices, x1, y1, x2, y2, angle, cos, sin, perpCos, perpSin,
			halfShaft, headDepth, headBaseX, headBaseY,
			barbLength, barbWidth, barbThickness, chevronDepth,
			leftBarbCos, leftBarbSin, rightBarbCos, rightBarbSin,
			barbAngle, headType
		) {
			// Get arrowSize from geometry (reverse-calculate from barbLength)
			const effectiveHeadScale = 1.0;
			const arrowSize = barbLength / ( ARROW_GEOMETRY.BARB_LENGTH_RATIO * effectiveHeadScale );

			// For a double-headed arrow, we need to trace a continuous outline:
			// 1. Start at tail's TOP edge connection
			// 2. Go around tail tip to tail's BOTTOM edge
			// 3. Connect to front's BOTTOM edge
			// 4. Go around front tip to front's TOP edge
			// 5. Close back to tail's TOP (first vertex)

			// Build tail head vertices (pointing backwards at angle+PI)
			const tailHeadVertices = this.buildHeadVertices(
				x1, y1, angle + Math.PI, halfShaft, arrowSize, effectiveHeadScale, headType, true
			);

			// Build front head vertices (pointing forwards at angle)
			const frontHeadVertices = this.buildHeadVertices(
				x2, y2, angle, halfShaft, arrowSize, effectiveHeadScale, headType, true
			);

			// Path flow: tail [TOP → BOTTOM] + front [BOTTOM → TOP] + close [TOP → TOP]
			for ( const v of tailHeadVertices ) {
				vertices.push( v );
			}

			for ( const v of frontHeadVertices ) {
				vertices.push( v );
			}

			// Polygon auto-closes from front's TOP back to tail's TOP (first vertex)
		}

		/**
		 * Build head vertices for an arrow head at a given position/angle.
		 * This is the same logic used by _buildSingleHeadVertices for consistent heads.
		 *
		 * @param {number} tipX - X coordinate of arrow tip
		 * @param {number} tipY - Y coordinate of arrow tip
		 * @param {number} angle - Direction angle (radians)
		 * @param {number} halfShaft - Half of shaft width
		 * @param {number} arrowSize - Arrow size
		 * @param {number} headScale - Head scale factor
		 * @param {string} headType - 'pointed', 'chevron', or 'standard'
		 * @param {boolean} isLeftToRight - True if traversing left-to-right (affects vertex order)
		 * @return {Array} Array of vertex objects {x, y}
		 */
		buildHeadVertices( tipX, tipY, angle, halfShaft, arrowSize, headScale, headType, isLeftToRight ) {
			const vertices = [];
			const effectiveHeadScale = headScale || 1.0;
			const barbAngle = Math.PI / 6; // 30 degrees
			const barbLength = arrowSize * ARROW_GEOMETRY.BARB_LENGTH_RATIO * effectiveHeadScale;
			const barbWidth = arrowSize * ARROW_GEOMETRY.BARB_WIDTH_RATIO;
			const barbThickness = halfShaft * ARROW_GEOMETRY.BARB_THICKNESS_RATIO;
			const chevronDepth = arrowSize * ARROW_GEOMETRY.CHEVRON_DEPTH_RATIO * effectiveHeadScale;
			const headDepth = arrowSize * ARROW_GEOMETRY.HEAD_DEPTH_RATIO * effectiveHeadScale;

			const cos = Math.cos( angle );
			const sin = Math.sin( angle );
			const perpCos = Math.cos( angle + Math.PI / 2 );
			const perpSin = Math.sin( angle + Math.PI / 2 );

			const headBaseX = tipX - cos * headDepth;
			const headBaseY = tipY - sin * headDepth;

			const leftBarbAngle = angle - barbAngle;
			const leftBarbCos = Math.cos( leftBarbAngle );
			const leftBarbSin = Math.sin( leftBarbAngle );

			const rightBarbAngle = angle + barbAngle;
			const rightBarbCos = Math.cos( rightBarbAngle );
			const rightBarbSin = Math.sin( rightBarbAngle );

			if ( isLeftToRight ) {
				// Left side vertices first, then tip, then right side
				if ( headType === 'standard' ) {
					const leftOuterX = tipX - barbLength * leftBarbCos;
					const leftOuterY = tipY - barbLength * leftBarbSin;
					const leftInnerX = leftOuterX + barbThickness * leftBarbSin;
					const leftInnerY = leftOuterY - barbThickness * leftBarbCos;
					const leftDx = leftInnerX - headBaseX;
					const leftDy = leftInnerY - headBaseY;
					const leftCurrentDist = leftDx * perpCos + leftDy * perpSin;
					const leftDeltaPerStep = leftBarbCos * perpCos + leftBarbSin * perpSin;
					const leftT = ( halfShaft - leftCurrentDist ) / leftDeltaPerStep;
					const leftShaftX = leftInnerX + leftT * leftBarbCos;
					const leftShaftY = leftInnerY + leftT * leftBarbSin;
					vertices.push( { x: leftShaftX, y: leftShaftY } );
					vertices.push( { x: leftInnerX, y: leftInnerY } );
					vertices.push( { x: leftOuterX, y: leftOuterY } );
				} else if ( headType === 'chevron' ) {
					vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
					vertices.push( {
						x: headBaseX - cos * chevronDepth + perpCos * barbWidth,
						y: headBaseY - sin * chevronDepth + perpSin * barbWidth
					} );
				} else {
					// pointed
					vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
					vertices.push( { x: tipX - barbLength * leftBarbCos, y: tipY - barbLength * leftBarbSin } );
				}

				// Tip
				vertices.push( { x: tipX, y: tipY } );

				// Right side
				if ( headType === 'standard' ) {
					const rightOuterX = tipX - barbLength * rightBarbCos;
					const rightOuterY = tipY - barbLength * rightBarbSin;
					const rightInnerX = rightOuterX - barbThickness * rightBarbSin;
					const rightInnerY = rightOuterY + barbThickness * rightBarbCos;
					const rightDx = rightInnerX - headBaseX;
					const rightDy = rightInnerY - headBaseY;
					const rightCurrentDist = rightDx * perpCos + rightDy * perpSin;
					const rightDeltaPerStep = rightBarbCos * perpCos + rightBarbSin * perpSin;
					const rightT = ( -halfShaft - rightCurrentDist ) / rightDeltaPerStep;
					const rightShaftX = rightInnerX + rightT * rightBarbCos;
					const rightShaftY = rightInnerY + rightT * rightBarbSin;
					vertices.push( { x: rightOuterX, y: rightOuterY } );
					vertices.push( { x: rightInnerX, y: rightInnerY } );
					vertices.push( { x: rightShaftX, y: rightShaftY } );
				} else if ( headType === 'chevron' ) {
					vertices.push( {
						x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
						y: headBaseY - sin * chevronDepth - perpSin * barbWidth
					} );
					vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
				} else {
					// pointed
					vertices.push( { x: tipX - barbLength * rightBarbCos, y: tipY - barbLength * rightBarbSin } );
					vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
				}
			} else {
				// Right side vertices first, then tip, then left side (reverse order)
				if ( headType === 'standard' ) {
					const rightOuterX = tipX - barbLength * rightBarbCos;
					const rightOuterY = tipY - barbLength * rightBarbSin;
					const rightInnerX = rightOuterX - barbThickness * rightBarbSin;
					const rightInnerY = rightOuterY + barbThickness * rightBarbCos;
					const rightDx = rightInnerX - headBaseX;
					const rightDy = rightInnerY - headBaseY;
					const rightCurrentDist = rightDx * perpCos + rightDy * perpSin;
					const rightDeltaPerStep = rightBarbCos * perpCos + rightBarbSin * perpSin;
					const rightT = ( -halfShaft - rightCurrentDist ) / rightDeltaPerStep;
					const rightShaftX = rightInnerX + rightT * rightBarbCos;
					const rightShaftY = rightInnerY + rightT * rightBarbSin;
					vertices.push( { x: rightShaftX, y: rightShaftY } );
					vertices.push( { x: rightInnerX, y: rightInnerY } );
					vertices.push( { x: rightOuterX, y: rightOuterY } );
				} else if ( headType === 'chevron' ) {
					vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
					vertices.push( {
						x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
						y: headBaseY - sin * chevronDepth - perpSin * barbWidth
					} );
				} else {
					// pointed
					vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
					vertices.push( { x: tipX - barbLength * rightBarbCos, y: tipY - barbLength * rightBarbSin } );
				}

				// Tip
				vertices.push( { x: tipX, y: tipY } );

				// Left side
				if ( headType === 'standard' ) {
					const leftOuterX = tipX - barbLength * leftBarbCos;
					const leftOuterY = tipY - barbLength * leftBarbSin;
					const leftInnerX = leftOuterX + barbThickness * leftBarbSin;
					const leftInnerY = leftOuterY - barbThickness * leftBarbCos;
					const leftDx = leftInnerX - headBaseX;
					const leftDy = leftInnerY - headBaseY;
					const leftCurrentDist = leftDx * perpCos + leftDy * perpSin;
					const leftDeltaPerStep = leftBarbCos * perpCos + leftBarbSin * perpSin;
					const leftT = ( halfShaft - leftCurrentDist ) / leftDeltaPerStep;
					const leftShaftX = leftInnerX + leftT * leftBarbCos;
					const leftShaftY = leftInnerY + leftT * leftBarbSin;
					vertices.push( { x: leftOuterX, y: leftOuterY } );
					vertices.push( { x: leftInnerX, y: leftInnerY } );
					vertices.push( { x: leftShaftX, y: leftShaftY } );
				} else if ( headType === 'chevron' ) {
					vertices.push( {
						x: headBaseX - cos * chevronDepth + perpCos * barbWidth,
						y: headBaseY - sin * chevronDepth + perpSin * barbWidth
					} );
					vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				} else {
					// pointed
					vertices.push( { x: tipX - barbLength * leftBarbCos, y: tipY - barbLength * leftBarbSin } );
					vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
				}
			}

			return vertices;
		}
	}

	// Register with Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.ArrowGeometry = ArrowGeometry;

		// Also expose for direct access
		window.ArrowGeometry = ArrowGeometry;
	}

	// Export for CommonJS (Jest tests)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ArrowGeometry;
	}
}() );
