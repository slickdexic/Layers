/**
 * CalloutRenderer - Specialized callout/chat bubble rendering
 *
 * This module handles rendering of callout (speech bubble) shapes:
 * - Rounded rectangle container with a triangular tail/pointer
 * - Multi-line text with word wrapping
 * - Text alignment (horizontal and vertical)
 * - Configurable tail direction and position
 * - Text stroke and shadow effects
 *
 * @module CalloutRenderer
 * @since 1.5.0
 */
( function () {
	'use strict';

	/**
	 * Get clampOpacity from MathUtils namespace
	 *
	 * @private
	 * @param {*} value - Value to clamp
	 * @return {number} Clamped opacity value
	 */
	function clampOpacity( value ) {
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.MathUtils ) {
			return window.Layers.MathUtils.clampOpacity( value );
		}
		// Fallback if MathUtils not loaded
		if ( typeof value !== 'number' || Number.isNaN( value ) ) {
			return 1;
		}
		return Math.max( 0, Math.min( 1, value ) );
	}

	/**
	 * CalloutRenderer class - Renders callout/chat bubble shapes on canvas
	 */
	class CalloutRenderer {
		/**
		 * Creates a new CalloutRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shadowRenderer] - ShadowRenderer instance for shadow operations
		 * @param {Object} [config.effectsRenderer] - EffectsRenderer instance for blur fill
		 * @param {Object} [config.textBoxRenderer] - TextBoxRenderer instance for text rendering
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
			this.effectsRenderer = this.config.effectsRenderer || null;
			this.textBoxRenderer = this.config.textBoxRenderer || null;
		}

		/**
		 * Set the shadow renderer instance
		 *
		 * @param {Object} shadowRenderer - ShadowRenderer instance
		 */
		setShadowRenderer( shadowRenderer ) {
			this.shadowRenderer = shadowRenderer;
		}

		/**
		 * Set the effects renderer instance (for blur fill)
		 *
		 * @param {Object} effectsRenderer - EffectsRenderer instance
		 */
		setEffectsRenderer( effectsRenderer ) {
			this.effectsRenderer = effectsRenderer;
		}

		/**
		 * Set the text box renderer instance (for text rendering)
		 *
		 * @param {Object} textBoxRenderer - TextBoxRenderer instance
		 */
		setTextBoxRenderer( textBoxRenderer ) {
			this.textBoxRenderer = textBoxRenderer;
		}

		/**
		 * Set the context
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
			// Also update context for textBoxRenderer if available
			if ( this.textBoxRenderer && typeof this.textBoxRenderer.setContext === 'function' ) {
				this.textBoxRenderer.setContext( ctx );
			}
		}

		// ========================================================================
		// Shadow Helper Methods (delegate to shadowRenderer or provide fallbacks)
		// ========================================================================

		/**
		 * Clear shadow settings from context
		 */
		clearShadow() {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.clearShadow();
			} else {
				this.ctx.shadowColor = 'transparent';
				this.ctx.shadowBlur = 0;
				this.ctx.shadowOffsetX = 0;
				this.ctx.shadowOffsetY = 0;
			}
		}

		/**
		 * Check if shadow is enabled on a layer
		 *
		 * @param {Object} layer - Layer to check
		 * @return {boolean} True if shadow is enabled
		 */
		hasShadowEnabled( layer ) {
			if ( this.shadowRenderer ) {
				return !!this.shadowRenderer.hasShadowEnabled( layer );
			}
			return layer.shadow === true ||
				layer.shadow === 'true' ||
				layer.shadow === 1 ||
				layer.shadow === '1' ||
				( typeof layer.shadow === 'object' && layer.shadow );
		}

		/**
		 * Get shadow spread value from layer
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @return {number} Spread value in pixels
		 */
		getShadowSpread( layer, scale ) {
			if ( this.shadowRenderer ) {
				return this.shadowRenderer.getShadowSpread( layer, scale );
			}
			const scaleAvg = ( scale && scale.avg ) || 1;
			if ( !this.hasShadowEnabled( layer ) ) {
				return 0;
			}
			if ( typeof layer.shadowSpread === 'number' && layer.shadowSpread > 0 ) {
				return layer.shadowSpread * scaleAvg;
			}
			return 0;
		}

		/**
		 * Draw spread shadow for a filled shape
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @param {number} spread - Spread amount
		 * @param {Function} drawPathFn - Function to draw the path
		 * @param {number} opacity - Opacity for the shadow
		 */
		drawSpreadShadow( layer, scale, spread, drawPathFn, opacity ) {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.drawSpreadShadow( layer, scale, spread, drawPathFn, opacity );
			}
		}

		// ========================================================================
		// Callout Path Drawing
		// ========================================================================

		/**
		 * Calculate the closest point on the rectangle perimeter to a given point.
		 * Used for the draggable tail feature to find where the tail attaches.
		 *
		 * @private
		 * @param {number} px - Point x coordinate
		 * @param {number} py - Point y coordinate
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
				const dist = Math.sqrt( ( px - closestX ) * ( px - closestX ) + ( py - closestY ) * ( py - closestY ) );

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
					const dist = Math.sqrt( ( px - closestX ) * ( px - closestX ) + ( py - closestY ) * ( py - closestY ) );

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
		 * @private
		 * @param {number} x - Rectangle x
		 * @param {number} y - Rectangle y
		 * @param {number} width - Rectangle width
		 * @param {number} height - Rectangle height
		 * @param {number} tipX - Tail tip X position (relative to layer origin)
		 * @param {number} tipY - Tail tip Y position (relative to layer origin)
		 * @param {number} cornerRadius - Corner radius to avoid
		 * @return {Object} Object with base1, base2, tip, edge
		 */
		getTailFromTipPosition( x, y, width, height, tipX, tipY, cornerRadius ) {
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
				const base1InArc = base1Angle >= corner.startAngle - tolerance && base1Angle <= corner.endAngle + tolerance;
				const base2InArc = base2Angle >= corner.startAngle - tolerance && base2Angle <= corner.endAngle + tolerance;

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
		 * @private
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

		/**
		 * Draw the callout path (rounded rectangle with tail)
		 * Supports two modes:
		 * 1. Legacy mode: uses tailDirection, tailPosition, tailSize
		 * 2. Draggable mode: uses tailTipX, tailTipY for direct positioning
		 *
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {number} width - Width
		 * @param {number} height - Height
		 * @param {number} cornerRadius - Corner radius
		 * @param {string} tailDirection - Direction of the tail (legacy mode)
		 * @param {number} tailPosition - Position along edge (0-1) (legacy mode)
		 * @param {number} tailSize - Size of the tail (legacy mode)
		 * @param {CanvasRenderingContext2D} [context] - Optional context
		 * @param {string} [tailStyle='triangle'] - Style of the tail (triangle, curved, line)
		 * @param {number} [tailTipX] - Tail tip X for draggable mode
		 * @param {number} [tailTipY] - Tail tip Y for draggable mode
		 */
		drawCalloutPath( x, y, width, height, cornerRadius, tailDirection, tailPosition, tailSize, context, tailStyle, tailTipX, tailTipY ) {
			const ctx = context || this.ctx;
			const style = tailStyle || 'triangle';

			// Validate inputs - abort silently if invalid to prevent canvas corruption
			if ( !isFinite( x ) || !isFinite( y ) || !isFinite( width ) || !isFinite( height ) ||
				!isFinite( cornerRadius ) ) {
				ctx.beginPath(); // Start empty path to avoid errors
				return;
			}

			// Ensure minimum dimensions for rendering
			if ( width < 5 || height < 5 ) {
				// For very small shapes, just draw a simple rectangle
				ctx.beginPath();
				ctx.rect( x, y, Math.max( 1, width ), Math.max( 1, height ) );
				return;
			}

			// Clamp corner radius to safe range (max half of smaller dimension)
			const maxRadius = Math.min( width, height ) / 2;
			const r = Math.max( 0, Math.min( cornerRadius, maxRadius ) );

			// Determine if using draggable mode (has tailTipX/tailTipY)
			const useDraggableMode = typeof tailTipX === 'number' && typeof tailTipY === 'number' &&
				isFinite( tailTipX ) && isFinite( tailTipY );

			let tail;
			let edge;

			if ( useDraggableMode ) {
				// Draggable mode - calculate tail from tip position
				tail = this.getTailFromTipPosition( x, y, width, height, tailTipX, tailTipY, r );
				edge = tail.edge;
			} else {
				// Legacy mode - use direction/position/size
				// Clamp tail size to reasonable range
				const maxTailSize = Math.min( width * 0.8, height * 0.8 );
				const actualTailSize = Math.max( 0, Math.min( tailSize || 20, maxTailSize ) );
				tail = this.getTailCoordinates( x, y, width, height, tailDirection || 'bottom', tailPosition || 0.5, actualTailSize, r );

				// Map direction to edge
				if ( tailDirection === 'top' || tailDirection === 'top-left' || tailDirection === 'top-right' ) {
					edge = 'top';
				} else if ( tailDirection === 'left' ) {
					edge = 'left';
				} else if ( tailDirection === 'right' ) {
					edge = 'right';
				} else {
					edge = 'bottom';
				}
			}

			// Validate tail coordinates
			if ( !tail || !tail.base1 || !tail.base2 || !tail.tip ||
				!isFinite( tail.base1.x ) || !isFinite( tail.base1.y ) ||
				!isFinite( tail.base2.x ) || !isFinite( tail.base2.y ) ||
				!isFinite( tail.tip.x ) || !isFinite( tail.tip.y ) ) {
				// Fallback to simple rounded rect without tail
				ctx.beginPath();
				if ( r > 0.5 && ctx.roundRect ) {
					ctx.roundRect( x, y, width, height, r );
				} else {
					ctx.rect( x, y, width, height );
				}
				return;
			}

			// Helper to draw tail segment based on style
			const drawTailSegment = () => {
				switch ( style ) {
					case 'curved':
						// Curved tail using quadratic Bezier - smooth speech bubble look
						// Calculate control point for curve (perpendicular to base midpoint)
						{
							const baseMidX = ( tail.base1.x + tail.base2.x ) / 2;
							const baseMidY = ( tail.base1.y + tail.base2.y ) / 2;
							// Control point is between base midpoint and tip, offset perpendicular
							const ctrlX = baseMidX + ( tail.tip.x - baseMidX ) * 0.3;
							const ctrlY = baseMidY + ( tail.tip.y - baseMidY ) * 0.3;
							ctx.quadraticCurveTo( ctrlX, ctrlY, tail.tip.x, tail.tip.y );
							// Return curve from tip
							const ctrlX2 = baseMidX + ( tail.tip.x - baseMidX ) * 0.3;
							const ctrlY2 = baseMidY + ( tail.tip.y - baseMidY ) * 0.3;
							ctx.quadraticCurveTo( ctrlX2, ctrlY2, tail.base1.x, tail.base1.y );
						}
						break;

					case 'line':
						// Simple line pointer - just a single line to tip and back
						// First go to the midpoint of the base
						{
							const midX = ( tail.base1.x + tail.base2.x ) / 2;
							const midY = ( tail.base1.y + tail.base2.y ) / 2;
							ctx.lineTo( midX, midY );
							ctx.lineTo( tail.tip.x, tail.tip.y );
							ctx.lineTo( midX, midY );
						}
						break;

					case 'triangle':
					default:
						// Classic triangle tail (default)
						ctx.lineTo( tail.base2.x, tail.base2.y );
						ctx.lineTo( tail.tip.x, tail.tip.y );
						ctx.lineTo( tail.base1.x, tail.base1.y );
						break;
				}
			};

			ctx.beginPath();

			// Use simpler path if corner radius is 0
			if ( r < 0.5 ) {
				// Simple rectangle path with tail
				ctx.moveTo( x, y );

				// Top edge with optional tail
				if ( edge === 'top' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					drawTailSegment();
				}
				ctx.lineTo( x + width, y );

				// Right edge with optional tail
				if ( edge === 'right' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					drawTailSegment();
				}
				ctx.lineTo( x + width, y + height );

				// Bottom edge with optional tail
				if ( edge === 'bottom' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					drawTailSegment();
				}
				ctx.lineTo( x, y + height );

				// Left edge with optional tail
				if ( edge === 'left' ) {
					ctx.lineTo( tail.base2.x, tail.base2.y );
					drawTailSegment();
				}

				ctx.closePath();
				return;
			}

			// Helper: draw tail at current position, ending at base1
			const insertTail = () => {
				ctx.lineTo( tail.base2.x, tail.base2.y );
				drawTailSegment();
			};

			// Helper: draw corner arc, splitting it if the tail is on this corner
			const drawCorner = ( cx, cy, startAngle, endAngle, cornerName ) => {
				if ( edge === cornerName ) {
					// Tail is on this corner - need to split the arc
					// Calculate angles for base points relative to corner center
					const raw1 = Math.atan2( tail.base1.y - cy, tail.base1.x - cx );
					const raw2 = Math.atan2( tail.base2.y - cy, tail.base2.x - cx );

					// Normalize angles to arc range [startAngle, startAngle + 2π)
					// This ensures both angles are on the same "branch" for comparison
					const TWO_PI = 2 * Math.PI;
					const normalizeToArc = ( angle ) => {
						let a = angle;
						while ( a < startAngle - 0.001 ) {
							a += TWO_PI;
						}
						while ( a >= startAngle + TWO_PI ) {
							a -= TWO_PI;
						}
						return a;
					};

					const base1Angle = normalizeToArc( raw1 );
					const base2Angle = normalizeToArc( raw2 );

					// Check if base points are within the arc range [startAngle, endAngle]
					const tolerance = 0.01;
					const arcLength = endAngle - startAngle;
					const base1Offset = base1Angle - startAngle;
					const base2Offset = base2Angle - startAngle;
					const base1InArc = base1Offset >= -tolerance && base1Offset <= arcLength + tolerance;
					const base2InArc = base2Offset >= -tolerance && base2Offset <= arcLength + tolerance;

					if ( !base1InArc || !base2InArc ) {
						// One or both base points are outside the arc - just draw the full arc
						ctx.arc( cx, cy, r, startAngle, endAngle, false );
						return;
					}

					// Both base points are on the arc
					// Determine drawing order by offset from startAngle (smaller offset = first on path)
					let firstAngle, secondAngle, firstBase, secondBase;

					if ( base1Offset < base2Offset ) {
						firstAngle = base1Angle;
						secondAngle = base2Angle;
						firstBase = tail.base1;
						secondBase = tail.base2;
					} else {
						firstAngle = base2Angle;
						secondAngle = base1Angle;
						firstBase = tail.base2;
						secondBase = tail.base1;
					}

					// Draw: arc from start to first base point
					if ( firstAngle > startAngle + tolerance ) {
						ctx.arc( cx, cy, r, startAngle, firstAngle, false );
					}

					// Draw tail: first base → tip → second base
					ctx.lineTo( firstBase.x, firstBase.y );
					ctx.lineTo( tail.tip.x, tail.tip.y );
					ctx.lineTo( secondBase.x, secondBase.y );

					// Continue arc from second base to end
					if ( endAngle > secondAngle + tolerance ) {
						ctx.arc( cx, cy, r, secondAngle, endAngle, false );
					}
				} else {
					// Normal corner - full arc
					ctx.arc( cx, cy, r, startAngle, endAngle, false );
				}
			};

			// Rounded rectangle with tail
			ctx.moveTo( x + r, y );

			// Top edge
			if ( edge === 'top' ) {
				insertTail();
			}
			ctx.lineTo( x + width - r, y );

			// Top-right corner (arc from -90° to 0°)
			drawCorner( x + width - r, y + r, -Math.PI / 2, 0, 'tr' );

			// Right edge
			if ( edge === 'right' ) {
				insertTail();
			}
			ctx.lineTo( x + width, y + height - r );

			// Bottom-right corner (arc from 0° to 90°)
			drawCorner( x + width - r, y + height - r, 0, Math.PI / 2, 'br' );

			// Bottom edge
			if ( edge === 'bottom' ) {
				insertTail();
			}
			ctx.lineTo( x + r, y + height );

			// Bottom-left corner (arc from 90° to 180°)
			drawCorner( x + r, y + height - r, Math.PI / 2, Math.PI, 'bl' );

			// Left edge
			if ( edge === 'left' ) {
				insertTail();
			}
			ctx.lineTo( x, y + r );

			// Top-left corner (arc from 180° to 270°)
			drawCorner( x + r, y + r, Math.PI, 1.5 * Math.PI, 'tl' );

			ctx.closePath();
		}

		/**
		 * Draw a rounded rectangle manually (for environments without roundRect)
		 *
		 * @private
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} x - X position
		 * @param {number} y - Y position
		 * @param {number} width - Width
		 * @param {number} height - Height
		 * @param {number} r - Corner radius
		 */
		_drawRoundedRect( ctx, x, y, width, height, r ) {
			ctx.beginPath();
			ctx.moveTo( x + r, y );
			ctx.lineTo( x + width - r, y );
			ctx.arcTo( x + width, y, x + width, y + r, r );
			ctx.lineTo( x + width, y + height - r );
			ctx.arcTo( x + width, y + height, x + width - r, y + height, r );
			ctx.lineTo( x + r, y + height );
			ctx.arcTo( x, y + height, x, y + height - r, r );
			ctx.lineTo( x, y + r );
			ctx.arcTo( x, y, x + r, y, r );
			ctx.closePath();
		}

		// ========================================================================
		// Main Draw Method
		// ========================================================================

		/**
		 * Draw a callout shape (rounded rectangle with tail and multi-line text)
		 *
		 * @param {Object} layer - Layer with callout properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
		 */
		draw( layer, options ) {
			// Wrap in try-catch to prevent canvas corruption from errors
			try {
				this._drawInternal( layer, options );
			} catch ( e ) {
				if ( typeof console !== 'undefined' && console.error ) {
					console.error( 'CalloutRenderer.draw error:', e );
				}
				// Ensure context is restored if error occurred after save
				try {
					this.ctx.restore();
				} catch ( restoreErr ) {
					// Ignore restore errors
				}
			}
		}

		/**
		 * Internal draw implementation
		 *
		 * @private
		 * @param {Object} layer - Layer with callout properties
		 * @param {Object} [options] - Rendering options
		 */
		_drawInternal( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			let x = layer.x || 0;
			let y = layer.y || 0;
			let width = layer.width || 0;
			let height = layer.height || 0;

			// Skip rendering if dimensions are too small
			if ( Math.abs( width ) < 1 || Math.abs( height ) < 1 ) {
				return;
			}

			// Normalize negative dimensions (when drawing from bottom-right to top-left)
			if ( width < 0 ) {
				x = x + width;
				width = Math.abs( width );
			}
			if ( height < 0 ) {
				y = y + height;
				height = Math.abs( height );
			}

			let strokeW = layer.strokeWidth || 1;
			let cornerRadius = layer.cornerRadius || 8;
			const padding = ( layer.padding || 8 ) * scale.avg;

			// Callout-specific properties
			const tailDirection = layer.tailDirection || 'bottom';
			const tailPosition = typeof layer.tailPosition === 'number' ? layer.tailPosition : 0.5;
			let tailSize = layer.tailSize || 20;
			const tailStyle = layer.tailStyle || 'triangle';

			// Draggable tail tip coordinates (takes precedence over direction/position/size)
			let tailTipX = typeof layer.tailTipX === 'number' ? layer.tailTipX : null;
			let tailTipY = typeof layer.tailTipY === 'number' ? layer.tailTipY : null;

			if ( !opts.scaled ) {
				strokeW = strokeW * scale.avg;
				cornerRadius = cornerRadius * scale.avg;
				tailSize = tailSize * scale.avg;
				// NOTE: tailTipX/tailTipY are NOT scaled here because they come from
				// the resize handler in world coordinates, not layer local coordinates.
				// They're already in the correct screen space.
			}

			// Ensure minimum dimensions for stable rendering
			if ( width < 20 || height < 20 ) {
				// Too small for a proper callout - just draw simple rect
				this.ctx.save();
				this.ctx.beginPath();
				this.ctx.rect( x, y, width, height );
				if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' && layer.fill !== 'blur' ) {
					this.ctx.fillStyle = layer.fill;
					this.ctx.fill();
				}
				if ( layer.stroke && layer.stroke !== 'none' && layer.stroke !== 'transparent' && strokeW > 0 ) {
					this.ctx.strokeStyle = layer.stroke;
					this.ctx.lineWidth = strokeW;
					this.ctx.stroke();
				}
				this.ctx.restore();
				return;
			}

			// Clamp corner radius to prevent rendering issues
			// Corner radius must leave room for tail on the edge
			const maxRadius = Math.min( width, height ) / 3;
			cornerRadius = Math.min( cornerRadius, Math.max( 0, maxRadius ) );

			// Clamp tail size to prevent it from being larger than the shape
			const maxTailSize = Math.min( width / 3, height / 3 );
			tailSize = Math.min( tailSize, Math.max( 0, maxTailSize ) );

			const hasRotation = typeof layer.rotation === 'number' && layer.rotation !== 0;
			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const isBlurFill = layer.fill === 'blur';
			const fillOpacity = clampOpacity( layer.fillOpacity );

			// Save original coordinates for blur capture
			const originalX = x;
			const originalY = y;

			this.ctx.save();

			// Apply rotation
			if ( hasRotation ) {
				this.ctx.translate( x + width / 2, y + height / 2 );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				// tailTipX/tailTipY are already in local coords (relative to center)
				// No transform needed - they work directly with the rotated coordinate system
				x = -width / 2;
				y = -height / 2;
			} else if ( tailTipX !== null && tailTipY !== null ) {
				// Not rotated, but tailTipX/tailTipY are relative to center
				// Convert to absolute coordinates for the path drawing
				const centerX = originalX + width / 2;
				const centerY = originalY + height / 2;
				tailTipX = centerX + tailTipX;
				tailTipY = centerY + tailTipY;
			}

			const spread = this.getShadowSpread( layer, shadowScale );

			// Helper to draw the callout path
			const drawPath = ( ctx ) => {
				const targetCtx = ctx || this.ctx;
				this.drawCalloutPath( x, y, width, height, cornerRadius, tailDirection, tailPosition, tailSize, targetCtx, tailStyle, tailTipX, tailTipY );
			};

			// Handle blur fill
			if ( isBlurFill && this.effectsRenderer && fillOpacity > 0 ) {
				let blurBounds;
				if ( hasRotation ) {
					const centerX = originalX + width / 2;
					const centerY = originalY + height / 2;
					const angleRad = ( layer.rotation * Math.PI ) / 180;
					const cos = Math.abs( Math.cos( angleRad ) );
					const sin = Math.abs( Math.sin( angleRad ) );
					const aabbWidth = width * cos + height * sin;
					const aabbHeight = width * sin + height * cos;
					blurBounds = {
						x: centerX - aabbWidth / 2,
						y: centerY - aabbHeight / 2,
						width: aabbWidth,
						height: aabbHeight + tailSize
					};
				} else {
					// Include tail in bounds
					let boundsY = y;
					let boundsHeight = height;
					if ( tailDirection === 'top' || tailDirection === 'top-left' || tailDirection === 'top-right' ) {
						boundsY = y - tailSize;
						boundsHeight = height + tailSize;
					} else if ( tailDirection === 'bottom' || tailDirection === 'bottom-left' || tailDirection === 'bottom-right' ) {
						boundsHeight = height + tailSize;
					}
					blurBounds = { x: originalX, y: boundsY, width: width, height: boundsHeight };
				}

				this.ctx.globalAlpha = baseOpacity * fillOpacity;
				this.effectsRenderer.drawBlurFill(
					layer,
					drawPath,
					blurBounds,
					opts
				);
			}

			// Draw shadow with spread
			if ( spread > 0 && !isBlurFill ) {
				this.drawSpreadShadow( layer, shadowScale, spread, drawPath, fillOpacity * baseOpacity );
			}

			// Draw fill
			if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' && !isBlurFill ) {
				drawPath();
				this.ctx.fillStyle = layer.fill;
				this.ctx.globalAlpha = fillOpacity * baseOpacity;

				if ( this.hasShadowEnabled( layer ) && spread === 0 ) {
					if ( this.shadowRenderer ) {
						this.shadowRenderer.applyShadow( layer, shadowScale );
					}
				}

				this.ctx.fill();
				this.clearShadow();
			}

			// Draw stroke
			if ( layer.stroke && layer.stroke !== 'none' && layer.stroke !== 'transparent' && strokeW > 0 ) {
				drawPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeW;
				const strokeOpacity = clampOpacity( layer.strokeOpacity );
				this.ctx.globalAlpha = strokeOpacity * baseOpacity;

				if ( this.hasShadowEnabled( layer ) && !layer.fill ) {
					if ( this.shadowRenderer ) {
						this.shadowRenderer.applyShadow( layer, shadowScale );
					}
				}

				this.ctx.stroke();
				this.clearShadow();
			}

			// Draw text inside the callout (delegate to TextBoxRenderer if available)
			if ( layer.text && this.textBoxRenderer ) {
				// Create a temporary layer for text rendering with adjusted bounds
				const textLayer = Object.assign( {}, layer, {
					x: x,
					y: y,
					width: width,
					height: height,
					// Don't re-apply rotation - already applied to context
					rotation: 0
				} );

				// Use TextBoxRenderer's text drawing logic with correct parameters
				this.textBoxRenderer.drawTextContent( textLayer, x, y, width, height, padding / scale.avg, scale, shadowScale, baseOpacity );
			} else if ( layer.text ) {
				// Fallback: simple single-line text
				this.drawSimpleText( layer, x, y, width, height, padding, baseOpacity, scale );
			}

			this.ctx.restore();
		}

		/**
		 * Draw simple text fallback when TextBoxRenderer is not available
		 *
		 * @private
		 * @param {Object} layer - Layer with text properties
		 * @param {number} x - Box x
		 * @param {number} y - Box y
		 * @param {number} width - Box width
		 * @param {number} height - Box height
		 * @param {number} padding - Padding
		 * @param {number} opacity - Opacity
		 * @param {Object} scale - Scale factors
		 */
		drawSimpleText( layer, x, y, width, height, padding, opacity, scale ) {
			const fontSize = ( layer.fontSize || 16 ) * ( scale.avg || 1 );
			const fontFamily = layer.fontFamily || 'Arial, sans-serif';
			const fontWeight = layer.fontWeight || 'normal';
			const fontStyle = layer.fontStyle || 'normal';

			this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
			this.ctx.fillStyle = layer.color || '#000000';
			this.ctx.globalAlpha = opacity;

			const textAlign = layer.textAlign || 'left';
			const verticalAlign = layer.verticalAlign || 'top';

			let textX = x + padding;
			if ( textAlign === 'center' ) {
				textX = x + width / 2;
				this.ctx.textAlign = 'center';
			} else if ( textAlign === 'right' ) {
				textX = x + width - padding;
				this.ctx.textAlign = 'right';
			} else {
				this.ctx.textAlign = 'left';
			}

			let textY = y + padding + fontSize;
			if ( verticalAlign === 'middle' ) {
				textY = y + height / 2 + fontSize / 3;
			} else if ( verticalAlign === 'bottom' ) {
				textY = y + height - padding;
			}

			this.ctx.fillText( layer.text, textX, textY );
		}
	}

	// Export to Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.CalloutRenderer = CalloutRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = CalloutRenderer;
	}
}() );
