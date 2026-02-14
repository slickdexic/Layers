/**
 * ArrowRenderer - Specialized arrow shape rendering
 *
 * Extracted from LayerRenderer.js to reduce file size and improve maintainability.
 * This module handles all arrow-related rendering including:
 * - Arrow vertex calculation (single, double, no head)
 * - Arrow head types (pointed, chevron, standard)
 * - Shadow rendering with spread support
 *
 * @module ArrowRenderer
 * @since 0.9.1
 */
( function () {
	'use strict';

	// Get ArrowGeometry for pure geometry calculations
	const ArrowGeometry = ( typeof window !== 'undefined' && window.Layers &&
		window.Layers.ArrowGeometry ) || ( typeof window !== 'undefined' && window.ArrowGeometry );

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
	 * Arrow geometry constants for fallback (primary logic in ArrowGeometry.js)
	 */
	const ARROW_GEOMETRY = {
		BARB_LENGTH_RATIO: 1.56,
		BARB_WIDTH_RATIO: 0.8,
		CHEVRON_DEPTH_RATIO: 0.52,
		HEAD_DEPTH_RATIO: 1.3,
		BARB_THICKNESS_RATIO: 1.5
	};

	/**
	 * ArrowRenderer class - Renders arrow shapes on canvas
	 */
	class ArrowRenderer {
		/**
		 * Creates a new ArrowRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shadowRenderer] - ShadowRenderer instance for shadow operations
		 * @param {Object} [config.effectsRenderer] - EffectsRenderer instance for blur fill
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
			this.effectsRenderer = this.config.effectsRenderer || null;

			// Initialize ArrowGeometry for pure geometry calculations
			this.arrowGeometry = ArrowGeometry ? new ArrowGeometry() : null;
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
		 * Set the effects renderer instance for blur fill
		 *
		 * @param {Object} effectsRenderer - EffectsRenderer instance
		 */
		setEffectsRenderer( effectsRenderer ) {
			this.effectsRenderer = effectsRenderer;
		}

		/**
		 * Set the context
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
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
		 * Apply shadow settings to context
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 */
		applyShadow( layer, scale ) {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.applyShadow( layer, scale );
			} else {
				// Minimal fallback
				const scaleX = scale.sx || 1;
				const scaleY = scale.sy || 1;
				const scaleAvg = scale.avg || 1;

				if ( layer.shadow === true || layer.shadow === 'true' || layer.shadow === 1 ) {
					this.ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.4)';
					this.ctx.shadowBlur = ( typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 8 ) * scaleAvg;
					this.ctx.shadowOffsetX = ( typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 2 ) * scaleX;
					this.ctx.shadowOffsetY = ( typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 2 ) * scaleY;
				}
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
				return this.shadowRenderer.hasShadowEnabled( layer );
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
			const scaleAvg = scale.avg || 1;
			if ( !this.hasShadowEnabled( layer ) ) {
				return 0;
			}
			if ( typeof layer.shadowSpread === 'number' && layer.shadowSpread > 0 ) {
				return layer.shadowSpread * scaleAvg;
			}
			return 0;
		}

		/**
		 * Draw a spread shadow using offscreen canvas
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @param {number} spread - Spread amount
		 * @param {Function} drawFn - Function to draw the path
		 * @param {number} [opacity=1] - Opacity
		 */
		drawSpreadShadow( layer, scale, spread, drawFn, opacity ) {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.setContext( this.ctx );
				this.shadowRenderer.drawSpreadShadow( layer, scale, spread, drawFn, opacity );
			} else {
				this.applyShadow( layer, scale );
			}
		}

		/**
		 * Draw a spread shadow stroke
		 *
		 * @param {Object} layer - Layer with shadow properties
		 * @param {Object} scale - Scale factors
		 * @param {number} strokeWidth - Stroke width
		 * @param {Function} drawFn - Function to draw the path
		 * @param {number} [opacity=1] - Opacity
		 */
		drawSpreadShadowStroke( layer, scale, strokeWidth, drawFn, opacity ) {
			if ( this.shadowRenderer ) {
				this.shadowRenderer.setContext( this.ctx );
				this.shadowRenderer.drawSpreadShadowStroke( layer, scale, strokeWidth, drawFn, opacity );
			} else {
				this.applyShadow( layer, scale );
			}
		}

		// ========================================================================
		// Arrow Vertex Calculation
		// ========================================================================

		/**
		 * Build the vertices for an arrow polygon.
		 * Delegates to ArrowGeometry for pure geometry calculations.
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
			if ( this.arrowGeometry ) {
				return this.arrowGeometry.buildArrowVertices(
					x1, y1, x2, y2, angle, perpAngle, halfShaft, arrowSize, arrowStyle, headType, headScale, tailWidth
				);
			}
			// Fallback - simple line vertices
			const perpCos = Math.cos( perpAngle );
			const perpSin = Math.sin( perpAngle );
			return [
				{ x: x1 + perpCos * halfShaft, y: y1 + perpSin * halfShaft },
				{ x: x2 + perpCos * halfShaft, y: y2 + perpSin * halfShaft },
				{ x: x2 - perpCos * halfShaft, y: y2 - perpSin * halfShaft },
				{ x: x1 - perpCos * halfShaft, y: y1 - perpSin * halfShaft }
			];
		}

		/**
		 * Check if an arrow layer has a curve (non-default control point)
		 * Delegates to ArrowGeometry for pure geometry calculations.
		 *
		 * @param {Object} layer - Arrow layer to check
		 * @return {boolean} True if the arrow is curved
		 */
		isCurved( layer ) {
			if ( this.arrowGeometry ) {
				return this.arrowGeometry.isCurved( layer );
			}
			// Fallback
			if ( typeof layer.controlX !== 'number' || typeof layer.controlY !== 'number' ) {
				return false;
			}
			const midX = ( ( layer.x1 || 0 ) + ( layer.x2 || 0 ) ) / 2;
			const midY = ( ( layer.y1 || 0 ) + ( layer.y2 || 0 ) ) / 2;
			const dx = layer.controlX - midX;
			const dy = layer.controlY - midY;
			return Math.sqrt( dx * dx + dy * dy ) > 1;
		}

		/**
		 * Get the tangent angle at a point on a quadratic Bézier curve
		 * Delegates to ArrowGeometry for pure geometry calculations.
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
			if ( this.arrowGeometry ) {
				return this.arrowGeometry.getBezierTangent( t, x1, y1, cx, cy, x2, y2 );
			}
			// Fallback: derivative of quadratic Bézier
			const dx = 2 * ( 1 - t ) * ( cx - x1 ) + 2 * t * ( x2 - cx );
			const dy = 2 * ( 1 - t ) * ( cy - y1 ) + 2 * t * ( y2 - cy );
			return Math.atan2( dy, dx );
		}

		/**
		 * Build head vertices for an arrow head at a given position/angle.
		 * Delegates to ArrowGeometry for pure geometry calculations.
		 *
		 * @private
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
		_buildHeadVertices( tipX, tipY, angle, halfShaft, arrowSize, headScale, headType, isLeftToRight ) {
			if ( this.arrowGeometry ) {
				return this.arrowGeometry.buildHeadVertices(
					tipX, tipY, angle, halfShaft, arrowSize, headScale, headType, isLeftToRight
				);
			}
			// Fallback: simple pointed head
			const cos = Math.cos( angle );
			const sin = Math.sin( angle );
			const perpCos = Math.cos( angle + Math.PI / 2 );
			const perpSin = Math.sin( angle + Math.PI / 2 );
			const vertices = [];
			vertices.push( { x: tipX - cos * arrowSize + perpCos * halfShaft, y: tipY - sin * arrowSize + perpSin * halfShaft } );
			vertices.push( { x: tipX, y: tipY } );
			vertices.push( { x: tipX - cos * arrowSize - perpCos * halfShaft, y: tipY - sin * arrowSize - perpSin * halfShaft } );
			return vertices;
		}

		/**
		 * Draw a curved arrow using quadratic Bézier
		 * Draws the entire arrow (shaft + head) as one unified polygon path.
		 * Uses the same head vertex logic as straight arrows for consistent appearance.
		 *
		 * @param {Object} layer - Layer with arrow properties
		 * @param {Object} [options] - Rendering options
		 */
		drawCurved( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;
			const cx = layer.controlX;
			const cy = layer.controlY;

			let arrowSize = layer.arrowSize || 15;
			let tailWidth = typeof layer.tailWidth === 'number' ? layer.tailWidth : 0;
			let strokeWidth = layer.strokeWidth || 2;

			if ( !opts.scaled ) {
				arrowSize = arrowSize * scale.avg;
				tailWidth = tailWidth * scale.avg;
				strokeWidth = strokeWidth * scale.avg;
			}

			const arrowStyle = layer.arrowStyle || 'single';
			const headType = layer.arrowHeadType || 'pointed';
			const headScale = typeof layer.headScale === 'number' ? layer.headScale : 1.0;
			const shaftWidth = Math.max( arrowSize * 0.4, strokeWidth * 1.5, 4 );
			const halfShaft = shaftWidth / 2;

			this.ctx.save();

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;

			// Handle rotation around arrow center
			if ( typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
				const centerX = ( x1 + x2 ) / 2;
				const centerY = ( y1 + y2 ) / 2;
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				this.ctx.translate( -centerX, -centerY );
			}

			// Get tangent angles at endpoints
			const startAngle = this.getBezierTangent( 0, x1, y1, cx, cy, x2, y2 );
			const endAngle = this.getBezierTangent( 1, x1, y1, cx, cy, x2, y2 );

			const effectiveHeadScale = headScale || 1.0;
			const headDepth = arrowSize * ARROW_GEOMETRY.HEAD_DEPTH_RATIO * effectiveHeadScale;

			const spread = this.getShadowSpread( layer, shadowScale );

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const isBlurFill = layer.fill === 'blur';
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Calculate perpendicular angles at key points
			const startPerp = startAngle + Math.PI / 2;
			const endPerp = endAngle + Math.PI / 2;
			const ctrlPerp = this.getBezierTangent( 0.5, x1, y1, cx, cy, x2, y2 ) + Math.PI / 2;

			const tailExtra = tailWidth / 2;

			// Calculate where shaft ends (before head)
			let curveEndX = x2;
			let curveEndY = y2;
			let curveStartX = x1;
			let curveStartY = y1;

			if ( arrowStyle === 'single' || arrowStyle === 'double' ) {
				curveEndX = x2 - Math.cos( endAngle ) * headDepth;
				curveEndY = y2 - Math.sin( endAngle ) * headDepth;
			}
			if ( arrowStyle === 'double' ) {
				curveStartX = x1 + Math.cos( startAngle ) * headDepth;
				curveStartY = y1 + Math.sin( startAngle ) * headDepth;
			}

			// Build the unified arrow path
			const drawUnifiedArrowPath = () => {
				this.ctx.beginPath();

				// Calculate shaft edge points
				const startTopX = curveStartX + Math.cos( startPerp ) * ( halfShaft + tailExtra );
				const startTopY = curveStartY + Math.sin( startPerp ) * ( halfShaft + tailExtra );
				const ctrlTopX = cx + Math.cos( ctrlPerp ) * halfShaft;
				const ctrlTopY = cy + Math.sin( ctrlPerp ) * halfShaft;
				const endTopX = curveEndX + Math.cos( endPerp ) * halfShaft;
				const endTopY = curveEndY + Math.sin( endPerp ) * halfShaft;

				const startBotX = curveStartX - Math.cos( startPerp ) * ( halfShaft + tailExtra );
				const startBotY = curveStartY - Math.sin( startPerp ) * ( halfShaft + tailExtra );
				const ctrlBotX = cx - Math.cos( ctrlPerp ) * halfShaft;
				const ctrlBotY = cy - Math.sin( ctrlPerp ) * halfShaft;
				const endBotX = curveEndX - Math.cos( endPerp ) * halfShaft;
				const endBotY = curveEndY - Math.sin( endPerp ) * halfShaft;

				if ( arrowStyle === 'double' ) {
					// Get tail head vertices (pointing backwards, right-to-left order)
					// IMPORTANT: Because the tail head uses angle = startAngle + PI, its perpendicular
					// is 180° rotated from the shaft's perpendicular. This inverts the vertex mapping:
					// - vertex[0] corresponds to shaft's TOP (+ perpendicular in shaft coords)
					// - vertex[last] corresponds to shaft's BOTTOM (- perpendicular in shaft coords)
					const tailHeadVertices = this._buildHeadVertices(
						x1, y1, startAngle + Math.PI, halfShaft, arrowSize, headScale, headType, false
					);

					// Get front head vertices (left-to-right order)
					// - vertex[0] corresponds to shaft's TOP (+ perpendicular)
					// - vertex[last] corresponds to shaft's BOTTOM (- perpendicular)
					const frontHeadVertices = this._buildHeadVertices(
						x2, y2, endAngle, halfShaft, arrowSize, headScale, headType, true
					);

					// Path flow (no crossover):
					// 1. Start at tail's vertex[0] (shaft TOP at tail)
					// 2. Curve along TOP to front's vertex[0] (shaft TOP at front)
					// 3. Draw front head to vertex[last] (shaft BOTTOM at front)
					// 4. Curve along BOTTOM to tail's vertex[last] (shaft BOTTOM at tail)
					// 5. Draw tail head in REVERSE back to vertex[0] (shaft TOP at tail)
					const tailFirstVertex = tailHeadVertices[ 0 ];
					const tailLastVertex = tailHeadVertices[ tailHeadVertices.length - 1 ];
					const frontFirstVertex = frontHeadVertices[ 0 ];

					// Start at tail's TOP side (first vertex due to inverted perpendicular)
					this.ctx.moveTo( tailFirstVertex.x, tailFirstVertex.y );

					// Curve along TOP edge to front head's TOP side (first vertex)
					this.ctx.quadraticCurveTo( ctrlTopX, ctrlTopY, frontFirstVertex.x, frontFirstVertex.y );

					// Draw front head vertices (skip first since we curved to it)
					for ( let i = 1; i < frontHeadVertices.length; i++ ) {
						this.ctx.lineTo( frontHeadVertices[ i ].x, frontHeadVertices[ i ].y );
					}

					// Curve along BOTTOM edge to tail's BOTTOM side (last vertex)
					this.ctx.quadraticCurveTo( ctrlBotX, ctrlBotY, tailLastVertex.x, tailLastVertex.y );

					// Draw tail head vertices in REVERSE (from last-1 down to 0)
					// This completes the path from BOTTOM back to TOP where we started
					for ( let i = tailHeadVertices.length - 2; i >= 0; i-- ) {
						this.ctx.lineTo( tailHeadVertices[ i ].x, tailHeadVertices[ i ].y );
					}
				} else if ( arrowStyle === 'single' ) {
					// Get head vertices (left-to-right order)
					const headVertices = this._buildHeadVertices(
						x2, y2, endAngle, halfShaft, arrowSize, headScale, headType, true
					);

					// For standard head type, use the head vertices' shaft connection points
					// to avoid crossover artifacts
					const headFirstVertex = headVertices[ 0 ];

					// Start at top edge of shaft tail
					this.ctx.moveTo( startTopX, startTopY );

					// Curve to head's first vertex (top shaft connection)
					this.ctx.quadraticCurveTo( ctrlTopX, ctrlTopY, headFirstVertex.x, headFirstVertex.y );

					// Draw remaining head vertices (skip first since we curved to it)
					for ( let i = 1; i < headVertices.length; i++ ) {
						this.ctx.lineTo( headVertices[ i ].x, headVertices[ i ].y );
					}

					// Return along bottom edge - curve from last head vertex back to tail
					this.ctx.quadraticCurveTo( ctrlBotX, ctrlBotY, startBotX, startBotY );
				} else {
					// No head (arrowStyle === 'none')
					this.ctx.moveTo( startTopX, startTopY );
					this.ctx.quadraticCurveTo( ctrlTopX, ctrlTopY, endTopX, endTopY );
					this.ctx.lineTo( endBotX, endBotY );
					this.ctx.quadraticCurveTo( ctrlBotX, ctrlBotY, startBotX, startBotY );
				}

				this.ctx.closePath();
			};

			// Helper to build expanded path for spread shadow (includes heads)
			const buildExpandedArrowPath = ( ctx, extraSpread ) => {
				const expandedHalfShaft = halfShaft + extraSpread;
				const expandedTailExtra = tailExtra + extraSpread;
				// Guard against division by zero when arrowSize is 0
				const expandedHeadScale = arrowSize > 0
					? ( arrowSize + extraSpread ) / arrowSize * effectiveHeadScale
					: effectiveHeadScale;

				const startTopX = curveStartX + Math.cos( startPerp ) * ( expandedHalfShaft + expandedTailExtra );
				const startTopY = curveStartY + Math.sin( startPerp ) * ( expandedHalfShaft + expandedTailExtra );
				const ctrlTopX = cx + Math.cos( ctrlPerp ) * expandedHalfShaft;
				const ctrlTopY = cy + Math.sin( ctrlPerp ) * expandedHalfShaft;
				const endTopX = curveEndX + Math.cos( endPerp ) * expandedHalfShaft;
				const endTopY = curveEndY + Math.sin( endPerp ) * expandedHalfShaft;

				const startBotX = curveStartX - Math.cos( startPerp ) * ( expandedHalfShaft + expandedTailExtra );
				const startBotY = curveStartY - Math.sin( startPerp ) * ( expandedHalfShaft + expandedTailExtra );
				const ctrlBotX = cx - Math.cos( ctrlPerp ) * expandedHalfShaft;
				const ctrlBotY = cy - Math.sin( ctrlPerp ) * expandedHalfShaft;
				const endBotX = curveEndX - Math.cos( endPerp ) * expandedHalfShaft;
				const endBotY = curveEndY - Math.sin( endPerp ) * expandedHalfShaft;

				ctx.beginPath();
				if ( arrowStyle === 'double' ) {
					// Get expanded tail head vertices (pointing backwards)
					// Due to inverted perpendicular: vertex[0] = shaft TOP, vertex[last] = shaft BOTTOM
					const tailHeadVertices = this._buildHeadVertices(
						x1, y1, startAngle + Math.PI, expandedHalfShaft, arrowSize, expandedHeadScale, headType, false
					);

					// Get expanded front head vertices
					// vertex[0] = shaft TOP, vertex[last] = shaft BOTTOM
					const frontHeadVertices = this._buildHeadVertices(
						x2, y2, endAngle, expandedHalfShaft, arrowSize, expandedHeadScale, headType, true
					);

					// Same path flow as main drawing - no crossover
					const tailFirstVertex = tailHeadVertices[ 0 ];
					const tailLastVertex = tailHeadVertices[ tailHeadVertices.length - 1 ];
					const frontFirstVertex = frontHeadVertices[ 0 ];

					// Start at tail's TOP side (first vertex due to inverted perpendicular)
					ctx.moveTo( tailFirstVertex.x, tailFirstVertex.y );

					// Curve along TOP edge to front head's TOP side
					ctx.quadraticCurveTo( ctrlTopX, ctrlTopY, frontFirstVertex.x, frontFirstVertex.y );

					// Draw front head vertices (skip first)
					for ( let i = 1; i < frontHeadVertices.length; i++ ) {
						ctx.lineTo( frontHeadVertices[ i ].x, frontHeadVertices[ i ].y );
					}

					// Curve along BOTTOM edge to tail's BOTTOM side (last vertex)
					ctx.quadraticCurveTo( ctrlBotX, ctrlBotY, tailLastVertex.x, tailLastVertex.y );

					// Draw tail head vertices in REVERSE (from last-1 down to 0)
					for ( let i = tailHeadVertices.length - 2; i >= 0; i-- ) {
						ctx.lineTo( tailHeadVertices[ i ].x, tailHeadVertices[ i ].y );
					}
				} else if ( arrowStyle === 'single' ) {
					// Get expanded head vertices
					const headVertices = this._buildHeadVertices(
						x2, y2, endAngle, expandedHalfShaft, arrowSize, expandedHeadScale, headType, true
					);

					const headFirstVertex = headVertices[ 0 ];

					ctx.moveTo( startTopX, startTopY );
					ctx.quadraticCurveTo( ctrlTopX, ctrlTopY, headFirstVertex.x, headFirstVertex.y );

					for ( let i = 1; i < headVertices.length; i++ ) {
						ctx.lineTo( headVertices[ i ].x, headVertices[ i ].y );
					}

					ctx.quadraticCurveTo( ctrlBotX, ctrlBotY, startBotX, startBotY );
				} else {
					// No head (arrowStyle === 'none')
					ctx.moveTo( startTopX, startTopY );
					ctx.quadraticCurveTo( ctrlTopX, ctrlTopY, endTopX, endTopY );
					ctx.lineTo( endBotX, endBotY );
					ctx.quadraticCurveTo( ctrlBotX, ctrlBotY, startBotX, startBotY );
				}
				ctx.closePath();
			};

			// Shadow handling - always use drawSpreadShadow (consistent with ShapeRenderer)
			if ( this.hasShadowEnabled( layer ) ) {
				// Draw fill shadow at fill opacity
				if ( hasFill && !isBlurFill ) {
					const fillShadowOpacity = baseOpacity * fillOpacity;
					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						buildExpandedArrowPath( ctx, spread );
					}, fillShadowOpacity );
				}

				// Draw stroke shadow at stroke opacity
				if ( hasStroke ) {
					const strokeShadowOpacity = baseOpacity * strokeOpacity;
					const expandedStrokeWidth = strokeWidth + spread * 2;
					this.drawSpreadShadowStroke( layer, shadowScale, expandedStrokeWidth, ( ctx ) => {
						buildExpandedArrowPath( ctx, 0 );
					}, strokeShadowOpacity );
				}
			}

			// Always clear shadow for actual drawing
			this.clearShadow();

			// Draw fill (blur fill or regular)
			if ( hasFill ) {
				if ( isBlurFill && this.effectsRenderer ) {
					// Blur fill - calculate bounding box from curve and heads
					const padding = arrowSize * 2;
					const minX = Math.min( x1, x2, cx ) - padding;
					const minY = Math.min( y1, y2, cy ) - padding;
					const maxX = Math.max( x1, x2, cx ) + padding;
					const maxY = Math.max( y1, y2, cy ) + padding;
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.effectsRenderer.drawBlurFill(
						layer,
						drawUnifiedArrowPath,
						{ x: minX, y: minY, width: maxX - minX, height: maxY - minY },
						opts
					);
				} else if ( !isBlurFill ) {
					drawUnifiedArrowPath();
					this.ctx.fillStyle = layer.fill;
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.ctx.fill();
				}
			}

			this.clearShadow();

			// Draw stroke
			if ( hasStroke ) {
				drawUnifiedArrowPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeWidth;
				this.ctx.lineJoin = 'round';
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();
			}

			this.ctx.restore();
		}

		/**
		 * Draw an arrow head at the specified position and angle
		 *
		 * @param {number} tipX - X coordinate of arrow tip
		 * @param {number} tipY - Y coordinate of arrow tip
		 * @param {number} angle - Angle the arrow is pointing (radians)
		 * @param {number} size - Arrow head size
		 * @param {number} headScale - Scale factor for head
		 * @param {string} headType - Head type: 'pointed', 'chevron', 'standard'
		 * @param {string} color - Fill color for head
		 * @param {number} opacity - Opacity
		 * @param {string} [strokeColor] - Stroke color for head outline
		 * @param {number} [strokeWidth] - Stroke width for head outline
		 * @param {number} [strokeOpacity] - Stroke opacity for head outline
		 */
		drawArrowHead( tipX, tipY, angle, size, headScale, headType, color, opacity, strokeColor, strokeWidth, strokeOpacity ) {
			const effectiveSize = size * headScale;
			const barbAngle = Math.PI / 6; // 30 degrees
			const barbLength = effectiveSize * ARROW_GEOMETRY.BARB_LENGTH_RATIO;

			this.ctx.save();
			this.ctx.translate( tipX, tipY );
			this.ctx.rotate( angle );

			this.ctx.beginPath();
			this.ctx.moveTo( 0, 0 ); // Tip

			// Left barb
			const leftX = -barbLength * Math.cos( barbAngle );
			const leftY = -barbLength * Math.sin( barbAngle );
			this.ctx.lineTo( leftX, leftY );

			if ( headType === 'chevron' ) {
				// Chevron has inward notch
				const notchDepth = effectiveSize * ARROW_GEOMETRY.CHEVRON_DEPTH_RATIO;
				this.ctx.lineTo( -notchDepth, 0 );
			} else if ( headType === 'standard' ) {
				// Standard has inner barb
				const innerLength = barbLength * 0.65;
				this.ctx.lineTo( -innerLength * Math.cos( barbAngle * 0.5 ), -innerLength * Math.sin( barbAngle * 0.5 ) );
				this.ctx.lineTo( -innerLength * Math.cos( barbAngle * 0.5 ), innerLength * Math.sin( barbAngle * 0.5 ) );
			}

			// Right barb
			const rightX = -barbLength * Math.cos( barbAngle );
			const rightY = barbLength * Math.sin( barbAngle );
			this.ctx.lineTo( rightX, rightY );

			this.ctx.closePath();

			this.ctx.fillStyle = color || '#000000';
			this.ctx.globalAlpha = opacity;
			this.ctx.fill();

			// Draw stroke if provided
			if ( strokeColor && strokeWidth > 0 ) {
				this.ctx.strokeStyle = strokeColor;
				this.ctx.lineWidth = strokeWidth;
				this.ctx.lineJoin = 'round';
				this.ctx.globalAlpha = typeof strokeOpacity === 'number' ? strokeOpacity : opacity;
				this.ctx.stroke();
			}

			this.ctx.restore();
		}

		/**
		 * Draw an arrow as a closed polygon
		 *
		 * @param {Object} layer - Layer with arrow properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors {sx, sy, avg}
		 * @param {Object} [options.shadowScale] - Shadow scale factors
		 * @param {boolean} [options.scaled] - Whether coords are pre-scaled
		 */
		draw( layer, options ) {
			// Check if this is a curved arrow
			if ( this.isCurved( layer ) ) {
				return this.drawCurved( layer, options );
			}

			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1, avg: 1 };
			const shadowScale = opts.shadowScale || scale;

			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;
			let arrowSize = layer.arrowSize || 15;
			let tailWidth = typeof layer.tailWidth === 'number' ? layer.tailWidth : 0;
			let strokeWidth = layer.strokeWidth || 2;

			if ( !opts.scaled ) {
				arrowSize = arrowSize * scale.avg;
				tailWidth = tailWidth * scale.avg;
				strokeWidth = strokeWidth * scale.avg;
			}

			const arrowStyle = layer.arrowStyle || 'single';
			const headType = layer.arrowHeadType || 'pointed';
			const headScale = typeof layer.headScale === 'number' ? layer.headScale : 1.0;
			const shaftWidth = Math.max( arrowSize * 0.4, strokeWidth * 1.5, 4 );

			this.ctx.save();

			const baseOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1;
			const spread = this.getShadowSpread( layer, shadowScale );

			// Handle rotation
			if ( typeof layer.rotation === 'number' && layer.rotation !== 0 ) {
				const centerX = ( x1 + x2 ) / 2;
				const centerY = ( y1 + y2 ) / 2;
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				this.ctx.translate( -centerX, -centerY );
			}

			const angle = Math.atan2( y2 - y1, x2 - x1 );
			const perpAngle = angle + Math.PI / 2;

			// Shadow handling - always use drawSpreadShadow (consistent with ShapeRenderer)
			if ( this.hasShadowEnabled( layer ) ) {
				const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none';
				const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none';

				// Draw fill shadow at fill opacity
				if ( hasFill ) {
					const fillShadowOpacity = baseOpacity * clampOpacity( layer.fillOpacity );
					const expandedShaftWidth = shaftWidth + spread * 2;
					const expandedArrowSize = arrowSize + spread;
					const expandedVertices = this.buildArrowVertices(
						x1, y1, x2, y2,
						angle, perpAngle, expandedShaftWidth / 2,
						expandedArrowSize, arrowStyle, headType, headScale, tailWidth + spread
					);

					this.drawSpreadShadow( layer, shadowScale, spread, ( ctx ) => {
						ctx.beginPath();
						if ( expandedVertices.length > 0 ) {
							ctx.moveTo( expandedVertices[ 0 ].x, expandedVertices[ 0 ].y );
							for ( let i = 1; i < expandedVertices.length; i++ ) {
								ctx.lineTo( expandedVertices[ i ].x, expandedVertices[ i ].y );
							}
							ctx.closePath();
						}
					}, fillShadowOpacity );
				}

				// Draw stroke shadow at stroke opacity
				if ( hasStroke ) {
					const strokeShadowOpacity = baseOpacity * clampOpacity( layer.strokeOpacity );
					const expandedStrokeWidth = strokeWidth + spread * 2;
					const originalVertices = this.buildArrowVertices(
						x1, y1, x2, y2, angle, perpAngle, shaftWidth / 2,
						arrowSize, arrowStyle, headType, headScale, tailWidth
					);

					this.drawSpreadShadowStroke( layer, shadowScale, expandedStrokeWidth, ( ctx ) => {
						ctx.beginPath();
						if ( originalVertices.length > 0 ) {
							ctx.moveTo( originalVertices[ 0 ].x, originalVertices[ 0 ].y );
							for ( let i = 1; i < originalVertices.length; i++ ) {
								ctx.lineTo( originalVertices[ i ].x, originalVertices[ i ].y );
							}
							ctx.closePath();
						}
					}, strokeShadowOpacity );
				}
			}

			// Always clear shadow for actual drawing
			this.clearShadow();

			const vertices = this.buildArrowVertices(
				x1, y1, x2, y2, angle, perpAngle, shaftWidth / 2,
				arrowSize, arrowStyle, headType, headScale, tailWidth
			);

			// Helper to draw the arrow path
			// Accepts ctx parameter for blur fill (where EffectsRenderer passes its own ctx)
			const drawArrowPath = ( ctx ) => {
				const targetCtx = ctx || this.ctx;
				targetCtx.beginPath();
				if ( vertices.length > 0 ) {
					targetCtx.moveTo( vertices[ 0 ].x, vertices[ 0 ].y );
					for ( let i = 1; i < vertices.length; i++ ) {
						targetCtx.lineTo( vertices[ i ].x, vertices[ i ].y );
					}
					targetCtx.closePath();
				}
			};

			const fillOpacity = clampOpacity( layer.fillOpacity );
			const strokeOpacity = clampOpacity( layer.strokeOpacity );
			const isBlurFill = layer.fill === 'blur';
			const hasFill = layer.fill && layer.fill !== 'transparent' && layer.fill !== 'none' && fillOpacity > 0;
			const hasStroke = layer.stroke && layer.stroke !== 'transparent' && layer.stroke !== 'none' && strokeOpacity > 0;

			// Draw fill (blur fill or regular)
			// Shadows are already handled above via drawSpreadShadow
			if ( hasFill ) {
				if ( isBlurFill && this.effectsRenderer ) {
					// Blur fill - use EffectsRenderer to blur background within arrow
					// Calculate bounding box from vertices
					const xs = vertices.map( ( v ) => v.x );
					const ys = vertices.map( ( v ) => v.y );
					const minX = Math.min( ...xs );
					const minY = Math.min( ...ys );
					const maxX = Math.max( ...xs );
					const maxY = Math.max( ...ys );
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.effectsRenderer.drawBlurFill(
						layer,
						drawArrowPath,
						{ x: minX, y: minY, width: maxX - minX, height: maxY - minY },
						opts
					);
				} else if ( !isBlurFill ) {
					drawArrowPath();
					this.ctx.fillStyle = layer.fill;
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.ctx.fill();
				}
			}

			// Draw stroke
			if ( hasStroke ) {
				drawArrowPath();
				this.ctx.strokeStyle = layer.stroke;
				this.ctx.lineWidth = strokeWidth;
				this.ctx.lineJoin = 'miter';
				this.ctx.miterLimit = 10;
				this.ctx.globalAlpha = baseOpacity * strokeOpacity;
				this.ctx.stroke();
			}

			this.ctx.restore();
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.ctx = null;
			this.config = null;
			this.shadowRenderer = null;
			this.effectsRenderer = null;
		}
	}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.ArrowRenderer = ArrowRenderer;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = ArrowRenderer;
	}

}() );
