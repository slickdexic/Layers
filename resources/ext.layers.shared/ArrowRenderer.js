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
					this.ctx.shadowBlur = ( layer.shadowBlur || 8 ) * scaleAvg;
					this.ctx.shadowOffsetX = ( layer.shadowOffsetX || 2 ) * scaleX;
					this.ctx.shadowOffsetY = ( layer.shadowOffsetY || 2 ) * scaleY;
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
			const barbLength = arrowSize * 1.56 * effectiveHeadScale;
			const barbWidth = arrowSize * 0.8;
			const chevronDepth = arrowSize * 0.52 * effectiveHeadScale;
			const tailExtra = ( tailWidth || 0 ) / 2;

			if ( arrowStyle === 'none' ) {
				vertices.push( { x: x1 + perpCos * ( halfShaft + tailExtra ), y: y1 + perpSin * ( halfShaft + tailExtra ) } );
				vertices.push( { x: x2 + perpCos * halfShaft, y: y2 + perpSin * halfShaft } );
				vertices.push( { x: x2 - perpCos * halfShaft, y: y2 - perpSin * halfShaft } );
				vertices.push( { x: x1 - perpCos * ( halfShaft + tailExtra ), y: y1 - perpSin * ( halfShaft + tailExtra ) } );
				return vertices;
			}

			const headDepth = arrowSize * 1.3 * effectiveHeadScale;
			const headBaseX = x2 - cos * headDepth;
			const headBaseY = y2 - sin * headDepth;

			const leftBarbAngle = angle - barbAngle;
			const leftBarbCos = Math.cos( leftBarbAngle );
			const leftBarbSin = Math.sin( leftBarbAngle );

			const rightBarbAngle = angle + barbAngle;
			const rightBarbCos = Math.cos( rightBarbAngle );
			const rightBarbSin = Math.sin( rightBarbAngle );

			const barbThickness = halfShaft * 1.5;

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
		 * @private
		 */
		_buildDoubleHeadVertices(
			vertices, x1, y1, x2, y2, angle, cos, sin, perpCos, perpSin,
			halfShaft, headDepth, headBaseX, headBaseY,
			barbLength, barbWidth, barbThickness, chevronDepth,
			leftBarbCos, leftBarbSin, rightBarbCos, rightBarbSin,
			barbAngle, headType
		) {
			const tailBaseX = x1 + cos * headDepth;
			const tailBaseY = y1 + sin * headDepth;

			const tailLeftAngle = angle + Math.PI - barbAngle;
			const tailLeftCos = Math.cos( tailLeftAngle );
			const tailLeftSin = Math.sin( tailLeftAngle );

			const tailRightAngle = angle + Math.PI + barbAngle;
			const tailRightCos = Math.cos( tailRightAngle );
			const tailRightSin = Math.sin( tailRightAngle );

			// Tail head (left side)
			if ( headType === 'standard' ) {
				const tailLeftOuterX = x1 + barbLength * tailLeftCos;
				const tailLeftOuterY = y1 + barbLength * tailLeftSin;
				const tailLeftInnerX = tailLeftOuterX + barbThickness * tailLeftSin;
				const tailLeftInnerY = tailLeftOuterY - barbThickness * tailLeftCos;
				const tailLeftDx = tailLeftInnerX - tailBaseX;
				const tailLeftDy = tailLeftInnerY - tailBaseY;
				const tailLeftCurrentDist = tailLeftDx * perpCos + tailLeftDy * perpSin;
				const tailLeftDeltaPerStep = tailLeftCos * perpCos + tailLeftSin * perpSin;
				const tailLeftT = ( halfShaft - tailLeftCurrentDist ) / tailLeftDeltaPerStep;
				const tailLeftShaftX = tailLeftInnerX + tailLeftT * tailLeftCos;
				const tailLeftShaftY = tailLeftInnerY + tailLeftT * tailLeftSin;
				vertices.push( { x: tailLeftShaftX, y: tailLeftShaftY } );
				vertices.push( { x: tailLeftInnerX, y: tailLeftInnerY } );
				vertices.push( { x: tailLeftOuterX, y: tailLeftOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: tailBaseX + cos * chevronDepth + perpCos * barbWidth,
					y: tailBaseY + sin * chevronDepth + perpSin * barbWidth
				} );
			} else {
				const tailLeftBarbX = x1 + barbLength * tailLeftCos;
				const tailLeftBarbY = y1 + barbLength * tailLeftSin;
				vertices.push( { x: tailLeftBarbX, y: tailLeftBarbY } );
			}

			vertices.push( { x: x1, y: y1 } );

			// Tail head (right side)
			if ( headType === 'standard' ) {
				const tailRightOuterX = x1 + barbLength * tailRightCos;
				const tailRightOuterY = y1 + barbLength * tailRightSin;
				const tailRightInnerX = tailRightOuterX - barbThickness * tailRightSin;
				const tailRightInnerY = tailRightOuterY + barbThickness * tailRightCos;
				const tailRightDx = tailRightInnerX - tailBaseX;
				const tailRightDy = tailRightInnerY - tailBaseY;
				const tailRightCurrentDist = tailRightDx * perpCos + tailRightDy * perpSin;
				const tailRightDeltaPerStep = tailRightCos * perpCos + tailRightSin * perpSin;
				const tailRightT = ( -halfShaft - tailRightCurrentDist ) / tailRightDeltaPerStep;
				const tailRightShaftX = tailRightInnerX + tailRightT * tailRightCos;
				const tailRightShaftY = tailRightInnerY + tailRightT * tailRightSin;
				vertices.push( { x: tailRightOuterX, y: tailRightOuterY } );
				vertices.push( { x: tailRightInnerX, y: tailRightInnerY } );
				vertices.push( { x: tailRightShaftX, y: tailRightShaftY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: tailBaseX + cos * chevronDepth - perpCos * barbWidth,
					y: tailBaseY + sin * chevronDepth - perpSin * barbWidth
				} );
				vertices.push( { x: tailBaseX - perpCos * halfShaft, y: tailBaseY - perpSin * halfShaft } );
			} else {
				const tailRightBarbX = x1 + barbLength * tailRightCos;
				const tailRightBarbY = y1 + barbLength * tailRightSin;
				vertices.push( { x: tailRightBarbX, y: tailRightBarbY } );
				vertices.push( { x: tailBaseX - perpCos * halfShaft, y: tailBaseY - perpSin * halfShaft } );
			}

			// Shaft to head
			if ( headType !== 'standard' ) {
				vertices.push( { x: headBaseX - perpCos * halfShaft, y: headBaseY - perpSin * halfShaft } );
			}

			// Front head (right side)
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
				vertices.push( { x: rightShaftX, y: rightShaftY } );
				vertices.push( { x: rightInnerX, y: rightInnerY } );
				vertices.push( { x: rightOuterX, y: rightOuterY } );
			} else if ( headType === 'chevron' ) {
				vertices.push( {
					x: headBaseX - cos * chevronDepth - perpCos * barbWidth,
					y: headBaseY - sin * chevronDepth - perpSin * barbWidth
				} );
			} else {
				const rightBarbX = x2 - barbLength * rightBarbCos;
				const rightBarbY = y2 - barbLength * rightBarbSin;
				vertices.push( { x: rightBarbX, y: rightBarbY } );
			}

			vertices.push( { x: x2, y: y2 } );

			// Front head (left side)
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
				const leftBarbX = x2 - barbLength * leftBarbCos;
				const leftBarbY = y2 - barbLength * leftBarbSin;
				vertices.push( { x: leftBarbX, y: leftBarbY } );
				vertices.push( { x: headBaseX + perpCos * halfShaft, y: headBaseY + perpSin * halfShaft } );
			}

			// Back to tail
			if ( headType !== 'standard' ) {
				vertices.push( { x: tailBaseX + perpCos * halfShaft, y: tailBaseY + perpSin * halfShaft } );
			}
		}

		// ========================================================================
		// Arrow Drawing
		// ========================================================================

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

			// Shadow handling with spread
			if ( spread > 0 && this.hasShadowEnabled( layer ) ) {
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
			} else if ( this.hasShadowEnabled( layer ) ) {
				this.applyShadow( layer, shadowScale );
			}

			// Draw actual arrow
			if ( spread > 0 ) {
				this.clearShadow();
			}

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
			const shadowEnabled = this.hasShadowEnabled( layer ) && spread === 0;

			// Draw fill (blur fill or regular)
			if ( hasFill ) {
				if ( isBlurFill && this.effectsRenderer ) {
					// Blur fill - use EffectsRenderer to blur background within arrow
					// Calculate bounding box from vertices
					const xs = vertices.map( function ( v ) { return v.x; } );
					const ys = vertices.map( function ( v ) { return v.y; } );
					const minX = Math.min.apply( null, xs );
					const minY = Math.min.apply( null, ys );
					const maxX = Math.max.apply( null, xs );
					const maxY = Math.max.apply( null, ys );
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.effectsRenderer.drawBlurFill(
						layer,
						drawArrowPath,
						{ x: minX, y: minY, width: maxX - minX, height: maxY - minY },
						opts
					);
				} else if ( !isBlurFill ) {
					// Regular color fill (with shadow if enabled and spread === 0)
					if ( shadowEnabled ) {
						this.applyShadow( layer, shadowScale );
					}
					drawArrowPath();
					this.ctx.fillStyle = layer.fill;
					this.ctx.globalAlpha = baseOpacity * fillOpacity;
					this.ctx.fill();
				}
			}

			// Clear shadow before stroke only if there was a visible fill
			if ( hasFill && !isBlurFill ) {
				this.clearShadow();
			}

			// Draw stroke
			if ( hasStroke ) {
				if ( !hasFill && shadowEnabled ) {
					this.applyShadow( layer, shadowScale );
					drawArrowPath();
					this.ctx.strokeStyle = layer.stroke;
					this.ctx.lineWidth = strokeWidth;
					this.ctx.lineJoin = 'miter';
					this.ctx.miterLimit = 10;
					this.ctx.globalAlpha = baseOpacity * strokeOpacity;
					this.ctx.stroke();
				} else {
					drawArrowPath();
					this.ctx.strokeStyle = layer.stroke;
					this.ctx.lineWidth = strokeWidth;
					this.ctx.lineJoin = 'miter';
					this.ctx.miterLimit = 10;
					this.ctx.globalAlpha = baseOpacity * strokeOpacity;
					this.ctx.stroke();

					if ( shadowEnabled ) {
						this.ctx.save();
						this.ctx.globalCompositeOperation = 'destination-over';
						this.applyShadow( layer, shadowScale );
						drawArrowPath();
						this.ctx.strokeStyle = layer.stroke;
						this.ctx.lineWidth = strokeWidth;
						this.ctx.lineJoin = 'miter';
						this.ctx.miterLimit = 10;
						this.ctx.globalAlpha = baseOpacity * strokeOpacity;
						this.ctx.stroke();
						this.ctx.restore();
					}
				}
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
