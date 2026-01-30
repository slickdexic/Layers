/**
 * TailCalculator - Geometric calculations for callout tails
 *
 * Extraced from CalloutRenderer.js to reduce file size and improve maintainability.
 * Contains pure geometric calculations for determining tail positions:
 * - Perimeter point calculations for draggable tails
 * - Tail base and tip coordinate calculations
 * - Edge/corner detection and mapping
 *
 * @module TailCalculator
 * @since 1.5.39
 */
( function () {
	'use strict';

	/**
	 * TailCalculator class - Pure geometric calculations for callout tails
	 */
	class TailCalculator {
		/**
		 * Get the closest point on a rounded rectangle perimeter to an external point.
		 * This is used when dragging a tail tip to find where the base should attach.
		 *
		 * @param {number} px - External point X
		 * @param {number} py - External point Y
		 * @param {number} x - Rectangle x
		 * @param {number} y - Rectangle y
		 * @param {number} width - Rectangle width
		 * @param {number} height - Rectangle height
		 * @param {number} cornerRadius - Corner radius to avoid
		 * @return {Object} Object with edge ('top', 'bottom', 'left', 'right'), baseX, baseY
		 */
		getClosestPerimeterPoint( px, py, x, y, width, height, cornerRadius ) {
			const r = Math.min( cornerRadius, Math.min( width, height ) / 2 );
			const centerX = x + width / 2;
			const centerY = y + height / 2;

			// Direction from center to the tip
			const dx = px - centerX;
			const dy = py - centerY;

			// Handle case where tip is at center
			if ( Math.abs( dx ) < 0.1 && Math.abs( dy ) < 0.1 ) {
				return { edge: 'bottom', baseX: centerX, baseY: y + height, tangentX: 1, tangentY: 0 };
			}

			// Define the 4 corner arc centers
			const corners = [
				{ cx: x + r, cy: y + r, name: 'tl', startAngle: Math.PI, endAngle: 1.5 * Math.PI },
				{ cx: x + width - r, cy: y + r, name: 'tr', startAngle: 1.5 * Math.PI, endAngle: 2 * Math.PI },
				{ cx: x + width - r, cy: y + height - r, name: 'br', startAngle: 0, endAngle: 0.5 * Math.PI },
				{ cx: x + r, cy: y + height - r, name: 'bl', startAngle: 0.5 * Math.PI, endAngle: Math.PI }
			];

			// Define the 4 straight edges (between corners)
			const edges = [
				{ name: 'top', x1: x + r, y1: y, x2: x + width - r, y2: y, tangentX: 1, tangentY: 0 },
				{ name: 'right', x1: x + width, y1: y + r, x2: x + width, y2: y + height - r, tangentX: 0, tangentY: 1 },
				{ name: 'bottom', x1: x + width - r, y1: y + height, x2: x + r, y2: y + height, tangentX: -1, tangentY: 0 },
				{ name: 'left', x1: x, y1: y + height - r, x2: x, y2: y + r, tangentX: 0, tangentY: -1 }
			];

			let bestDist = Infinity;
			let bestPoint = { edge: 'bottom', baseX: centerX, baseY: y + height, tangentX: 1, tangentY: 0 };

			// Check straight edges
			for ( const edge of edges ) {
				// Skip degenerate edges (when corner radius fills entire edge)
				if ( edge.x1 === edge.x2 && edge.y1 === edge.y2 ) {
					continue;
				}

				// Project point onto line segment
				const edgeDx = edge.x2 - edge.x1;
				const edgeDy = edge.y2 - edge.y1;
				const edgeLen = Math.sqrt( edgeDx * edgeDx + edgeDy * edgeDy );

				if ( edgeLen < 1 ) {
					continue;
				}

				const t = Math.max( 0, Math.min( 1,
					( ( px - edge.x1 ) * edgeDx + ( py - edge.y1 ) * edgeDy ) / ( edgeLen * edgeLen )
				) );

				const closestX = edge.x1 + t * edgeDx;
				const closestY = edge.y1 + t * edgeDy;
				const dist = Math.sqrt(
					( px - closestX ) * ( px - closestX ) + ( py - closestY ) * ( py - closestY )
				);

				if ( dist < bestDist ) {
					bestDist = dist;
					bestPoint = {
						edge: edge.name,
						baseX: closestX,
						baseY: closestY,
						tangentX: edge.tangentX,
						tangentY: edge.tangentY
					};
				}
			}

			// Check corner arcs (only if radius > 0)
			if ( r > 0.5 ) {
				for ( const corner of corners ) {
					// Find closest point on arc: project tip onto arc
					const toDx = px - corner.cx;
					const toDy = py - corner.cy;
					const toAngle = Math.atan2( toDy, toDx );

					// Normalize angle to [0, 2*PI)
					let normAngle = toAngle;
					if ( normAngle < 0 ) {
						normAngle += 2 * Math.PI;
					}

					// Check if angle is within the arc's range
					let startNorm = corner.startAngle;
					let endNorm = corner.endAngle;
					if ( startNorm < 0 ) {
						startNorm += 2 * Math.PI;
					}
					if ( endNorm < 0 ) {
						endNorm += 2 * Math.PI;
					}
					if ( endNorm < startNorm ) {
						endNorm += 2 * Math.PI;
					}
					if ( normAngle < startNorm ) {
						normAngle += 2 * Math.PI;
					}

					// Clamp angle to arc range
					let clampedAngle;
					if ( normAngle >= startNorm && normAngle <= endNorm ) {
						clampedAngle = toAngle;
					} else {
						// Use whichever endpoint is closer
						const distToStart = Math.abs( normAngle - startNorm );
						const distToEnd = Math.abs( normAngle - endNorm );
						clampedAngle = distToStart < distToEnd ? corner.startAngle : corner.endAngle;
					}

					const closestX = corner.cx + r * Math.cos( clampedAngle );
					const closestY = corner.cy + r * Math.sin( clampedAngle );
					const dist = Math.sqrt(
						( px - closestX ) * ( px - closestX ) + ( py - closestY ) * ( py - closestY )
					);

					if ( dist < bestDist ) {
						bestDist = dist;
						// Tangent is perpendicular to radius (90 degrees counterclockwise)
						bestPoint = {
							edge: corner.name,
							baseX: closestX,
							baseY: closestY,
							tangentX: -Math.sin( clampedAngle ),
							tangentY: Math.cos( clampedAngle )
						};
					}
				}
			}

			return bestPoint;
		}

		/**
		 * Get tail coordinates from a draggable tip position.
		 * Calculates the base attachment point on the perimeter and tail width.
		 * Uses tangent-aware placement for smooth blending with corners.
		 *
		 * @param {number} x - Rectangle x
		 * @param {number} y - Rectangle y
		 * @param {number} width - Rectangle width
		 * @param {number} height - Rectangle height
		 * @param {number} tipX - Tail tip X position (relative to layer origin)
		 * @param {number} tipY - Tail tip Y position (relative to layer origin)
		 * @param {number} cornerRadius - Corner radius to avoid
		 * @return {Object|null} Object with base1, base2, tip, edge, or null if tip is inside rectangle
		 */
		getTailFromTipPosition( x, y, width, height, tipX, tipY, cornerRadius ) {
			// If tip is inside the rectangle, no tail should be drawn
			if ( tipX >= x && tipX <= x + width && tipY >= y && tipY <= y + height ) {
				return null;
			}

			// Get the closest point on the perimeter (including corners)
			const perimeter = this.getClosestPerimeterPoint( tipX, tipY, x, y, width, height, cornerRadius );
			const r = Math.min( cornerRadius, Math.min( width, height ) / 2 );

			// Calculate tail base width based on distance from tip to base
			const dist = Math.sqrt(
				( tipX - perimeter.baseX ) * ( tipX - perimeter.baseX ) +
				( tipY - perimeter.baseY ) * ( tipY - perimeter.baseY )
			);

			// Base width scales with distance but capped at reasonable limits
			const minDim = Math.min( width, height );
			const minBaseWidth = Math.max( 8, minDim * 0.08 );
			const maxBaseWidth = Math.min( 30, minDim * 0.3 );
			const baseWidth = Math.max( minBaseWidth, Math.min( maxBaseWidth, dist * 0.3 ) );
			const halfBase = baseWidth / 2;

			let edge = perimeter.edge;
			let base1, base2;

			// For corners, offset along the arc (angularly) to keep base points ON the arc
			if ( r > 0 && ( edge === 'tl' || edge === 'tr' || edge === 'br' || edge === 'bl' ) ) {
				// Get corner center and arc range
				const cornerData = {
					tl: { cx: x + r, cy: y + r, startAngle: Math.PI, endAngle: 1.5 * Math.PI },
					tr: { cx: x + width - r, cy: y + r, startAngle: -Math.PI / 2, endAngle: 0 },
					br: { cx: x + width - r, cy: y + height - r, startAngle: 0, endAngle: Math.PI / 2 },
					bl: { cx: x + r, cy: y + height - r, startAngle: Math.PI / 2, endAngle: Math.PI }
				};
				const corner = cornerData[ edge ];

				// Calculate angular offset for half the base width
				// Arc length = r * angle, so angle = arcLength / r
				const angularOffset = halfBase / r;

				// Current angle of the base point on the arc
				let baseAngle = Math.atan2( perimeter.baseY - corner.cy, perimeter.baseX - corner.cx );

				// Normalize baseAngle to be within [startAngle, startAngle + 2π)
				const TWO_PI = 2 * Math.PI;
				while ( baseAngle < corner.startAngle - 0.001 ) {
					baseAngle += TWO_PI;
				}
				while ( baseAngle > corner.startAngle + TWO_PI ) {
					baseAngle -= TWO_PI;
				}

				// Calculate base point angles
				const base1Angle = baseAngle - angularOffset;
				const base2Angle = baseAngle + angularOffset;

				// Check if both base points are within the arc range
				const tolerance = 0.05;
				const base1InArc = base1Angle >= corner.startAngle - tolerance &&
					base1Angle <= corner.endAngle + tolerance;
				const base2InArc = base2Angle >= corner.startAngle - tolerance &&
					base2Angle <= corner.endAngle + tolerance;

				if ( base1InArc && base2InArc ) {
					// Both points on arc - use angular offset
					base1 = {
						x: corner.cx + r * Math.cos( base1Angle ),
						y: corner.cy + r * Math.sin( base1Angle )
					};
					base2 = {
						x: corner.cx + r * Math.cos( base2Angle ),
						y: corner.cy + r * Math.sin( base2Angle )
					};
				} else {
					// One or both points extend beyond the arc - snap to adjacent straight edge
					// Determine which straight edge to use based on which side extends past
					if ( !base1InArc && base1Angle < corner.startAngle ) {
						// base1 extends past start of arc
						edge = this._getEdgeBeforeCorner( edge );
					} else if ( !base2InArc && base2Angle > corner.endAngle ) {
						// base2 extends past end of arc
						edge = this._getEdgeAfterCorner( edge );
					} else {
						// Fallback: use edge closest to tip
						const distToStart = Math.abs( baseAngle - corner.startAngle );
						const distToEnd = Math.abs( baseAngle - corner.endAngle );
						edge = distToStart < distToEnd ?
							this._getEdgeBeforeCorner( perimeter.edge ) :
							this._getEdgeAfterCorner( perimeter.edge );
					}

					// Recalculate base using straight edge tangent
					const straightEdgeTangents = {
						top: { tx: 1, ty: 0, baseY: y },
						bottom: { tx: -1, ty: 0, baseY: y + height },
						left: { tx: 0, ty: -1, baseX: x },
						right: { tx: 0, ty: 1, baseX: x + width }
					};
					const edgeData = straightEdgeTangents[ edge ];
					const tx = edgeData.tx;
					const ty = edgeData.ty;

					// Project base point onto the straight edge
					let baseX = perimeter.baseX;
					let baseY = perimeter.baseY;
					if ( edgeData.baseY !== undefined ) {
						baseY = edgeData.baseY;
						baseX = Math.max( x + r, Math.min( x + width - r, baseX ) );
					} else {
						baseX = edgeData.baseX;
						baseY = Math.max( y + r, Math.min( y + height - r, baseY ) );
					}

					base1 = { x: baseX - tx * halfBase, y: baseY - ty * halfBase };
					base2 = { x: baseX + tx * halfBase, y: baseY + ty * halfBase };
				}
			} else {
				// For straight edges, use tangent-based offset (original approach)
				const tx = perimeter.tangentX || 0;
				const ty = perimeter.tangentY || 0;

				base1 = {
					x: perimeter.baseX - tx * halfBase,
					y: perimeter.baseY - ty * halfBase
				};
				base2 = {
					x: perimeter.baseX + tx * halfBase,
					y: perimeter.baseY + ty * halfBase
				};
			}

			// Determine winding order based on which side of base the tip is on
			// Cross product: if positive, tip is to the left of base1→base2, swap
			const crossZ = ( base2.x - base1.x ) * ( tipY - base1.y ) -
				( base2.y - base1.y ) * ( tipX - base1.x );

			if ( crossZ < 0 ) {
				return {
					base1: base2,
					base2: base1,
					tip: { x: tipX, y: tipY },
					edge
				};
			}

			return {
				base1,
				base2,
				tip: { x: tipX, y: tipY },
				edge
			};
		}

		/**
		 * Get the straight edge that comes before a corner in the path drawing order.
		 *
		 * @private
		 * @param {string} corner - Corner identifier (tl, tr, br, bl)
		 * @return {string} The edge before this corner
		 */
		_getEdgeBeforeCorner( corner ) {
			// Path order: top → tr → right → br → bottom → bl → left → tl → top
			const mapping = {
				tr: 'top',
				br: 'right',
				bl: 'bottom',
				tl: 'left'
			};
			return mapping[ corner ] || 'top';
		}

		/**
		 * Get the straight edge that comes after a corner in the path drawing order.
		 *
		 * @private
		 * @param {string} corner - Corner identifier (tl, tr, br, bl)
		 * @return {string} The edge after this corner
		 */
		_getEdgeAfterCorner( corner ) {
			// Path order: top → tr → right → br → bottom → bl → left → tl → top
			const mapping = {
				tr: 'right',
				br: 'bottom',
				bl: 'left',
				tl: 'top'
			};
			return mapping[ corner ] || 'bottom';
		}

		/**
		 * Get tail position coordinates based on direction and position.
		 * Uses tangent-aware calculations to ensure tail blends smoothly with corners.
		 *
		 * @param {number} x - Rectangle x
		 * @param {number} y - Rectangle y
		 * @param {number} width - Rectangle width
		 * @param {number} height - Rectangle height
		 * @param {string} direction - Tail direction (bottom, top, left, right, corners)
		 * @param {number} position - Position along edge (0-1)
		 * @param {number} tailSize - Size of the tail
		 * @param {number} cornerRadius - Corner radius to avoid
		 * @return {Object} Object with base1, base2, tip, and optional curve control points
		 */
		getTailCoordinates( x, y, width, height, direction, position, tailSize, cornerRadius ) {
			// Calculate maximum safe tail size relative to shape
			const minDim = Math.min( width, height );
			const safeTailSize = Math.max( 1, Math.min( tailSize, minDim * 0.8 ) );
			const halfTail = Math.max( 1, safeTailSize / 2 );

			// Calculate the "safe zone" for the tail base - area between corners
			// Leave room for corner radius on each side
			const safeZoneMargin = Math.max( cornerRadius, 2 );

			let result;

			// Helper to clamp position and calculate coordinates for horizontal edges
			const calcHorizontal = ( edgeY, tipY, dir ) => {
				const safeStart = x + safeZoneMargin;
				const safeEnd = x + width - safeZoneMargin;
				const safeWidth = Math.max( 0, safeEnd - safeStart );

				// Apply direction-specific position overrides
				let pos = position;
				if ( dir === 'bottom-left' || dir === 'top-left' ) {
					pos = 0.2;
				} else if ( dir === 'bottom-right' || dir === 'top-right' ) {
					pos = 0.8;
				}

				// Calculate center position along safe zone
				const center = safeWidth > 0 ?
					safeStart + safeWidth * Math.max( 0, Math.min( 1, pos ) ) :
					x + width / 2;

				// Calculate base points, clamped to safe zone
				const base1X = Math.max( safeStart, Math.min( safeEnd, center - halfTail ) );
				const base2X = Math.max( safeStart, Math.min( safeEnd, center + halfTail ) );

				return {
					base1: { x: base1X, y: edgeY },
					base2: { x: base2X, y: edgeY },
					tip: { x: center, y: tipY }
				};
			};

			// Helper to calculate coordinates for vertical edges
			const calcVertical = ( edgeX, tipX ) => {
				const safeStart = y + safeZoneMargin;
				const safeEnd = y + height - safeZoneMargin;
				const safeHeight = Math.max( 0, safeEnd - safeStart );

				// Calculate center position along safe zone
				const center = safeHeight > 0 ?
					safeStart + safeHeight * Math.max( 0, Math.min( 1, position ) ) :
					y + height / 2;

				// Calculate base points, clamped to safe zone
				const base1Y = Math.max( safeStart, Math.min( safeEnd, center - halfTail ) );
				const base2Y = Math.max( safeStart, Math.min( safeEnd, center + halfTail ) );

				return {
					base1: { x: edgeX, y: base1Y },
					base2: { x: edgeX, y: base2Y },
					tip: { x: tipX, y: center }
				};
			};

			// Calculate based on direction
			switch ( direction ) {
				case 'bottom':
				case 'bottom-left':
				case 'bottom-right':
					result = calcHorizontal( y + height, y + height + safeTailSize, direction );
					break;

				case 'top':
				case 'top-left':
				case 'top-right': {
					result = calcHorizontal( y, y - safeTailSize, direction );
					// Swap base points for correct winding order on top
					const temp = result.base1;
					result.base1 = result.base2;
					result.base2 = temp;
					break;
				}

				case 'left':
					result = calcVertical( x, x - safeTailSize );
					break;

				case 'right': {
					result = calcVertical( x + width, x + width + safeTailSize );
					// Swap base points for correct winding order on right
					const tempR = result.base1;
					result.base1 = result.base2;
					result.base2 = tempR;
					break;
				}

				default:
					// Default to bottom center
					result = calcHorizontal( y + height, y + height + safeTailSize, 'bottom' );
			}

			return result;
		}
	}

	// Export to namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.TailCalculator = TailCalculator;
		// Also expose at top level for backwards compatibility
		window.TailCalculator = TailCalculator;
	}

	// Export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TailCalculator;
	}
}() );
