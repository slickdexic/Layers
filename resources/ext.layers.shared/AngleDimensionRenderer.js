/**
 * AngleDimensionRenderer - Renders angle measurement annotations
 *
 * This module handles rendering of angle dimensions for technical illustrations:
 * - Three-point angle measurement (vertex + two arm endpoints)
 * - Arc drawn between the two arms at configurable radius
 * - Extension lines along each arm from vertex through arm endpoints
 * - Auto-calculated angle value in degrees (with optional override)
 * - Arrow/tick/dot end markers at arc endpoints
 * - Configurable text positioning (above, below, center on arc)
 * - Support for reflex angles (>180°)
 * - Tolerance annotations (symmetric, deviation, limits, basic)
 *
 * Industry standards followed:
 * - ISO 129-1: Technical drawings - Dimensioning
 * - ASME Y14.5: Geometric Dimensioning and Tolerancing
 * - Angle measured counterclockwise from arm1 to arm2 (standard convention)
 * - Arc radius adjustable independently of arm length
 *
 * @module AngleDimensionRenderer
 * @since 1.5.59
 */
( function () {
	'use strict';

	/**
	 * End style constants (shared with DimensionRenderer)
	 * @constant {Object}
	 */
	const END_STYLES = {
		ARROW: 'arrow',
		TICK: 'tick',
		DOT: 'dot',
		NONE: 'none'
	};

	/**
	 * Text position constants
	 * @constant {Object}
	 */
	const TEXT_POSITIONS = {
		ABOVE: 'above',
		BELOW: 'below',
		CENTER: 'center'
	};

	/**
	 * Tolerance type constants
	 * @constant {Object}
	 */
	const TOLERANCE_TYPES = {
		NONE: 'none',
		SYMMETRIC: 'symmetric',
		DEVIATION: 'deviation',
		LIMITS: 'limits',
		BASIC: 'basic'
	};

	/**
	 * Default angle dimension configuration
	 * @constant {Object}
	 */
	const DEFAULTS = {
		stroke: '#000000',
		strokeWidth: 1,
		fontSize: 12,
		fontFamily: 'Arial, sans-serif',
		color: '#000000',
		endStyle: END_STYLES.ARROW,
		textPosition: TEXT_POSITIONS.CENTER,
		arcRadius: 40,
		extensionLength: 10,
		arrowsInside: true,
		arrowSize: 8,
		tickSize: 6,
		showUnit: true,
		showBackground: true,
		backgroundColor: '#ffffff',
		precision: 1,
		reflexAngle: false,
		textOffset: 0,
		toleranceType: 'none',
		toleranceValue: 0,
		toleranceUpper: 0,
		toleranceLower: 0
	};

	/**
	 * AngleDimensionRenderer class - Renders angle annotations on canvas
	 */
	class AngleDimensionRenderer {
		/**
		 * Creates a new AngleDimensionRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
		}

		/**
		 * Set the canvas context
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
		}

		/**
		 * Calculate the angle between two arms from a vertex
		 *
		 * @param {Object} layer - Angle dimension layer
		 * @return {Object} Object with startAngle, endAngle, sweepAngle (all in radians)
		 */
		calculateAngles( layer ) {
			const cx = layer.cx || 0;
			const cy = layer.cy || 0;
			const ax = layer.ax || 0;
			const ay = layer.ay || 0;
			const bx = layer.bx || 0;
			const by = layer.by || 0;
			// Handle both boolean false and integer 0 (from PHP serialization)
			const reflexAngle = layer.reflexAngle === true || layer.reflexAngle === 1;

			// Calculate angles of each arm from vertex
			const angleA = Math.atan2( ay - cy, ax - cx );
			const angleB = Math.atan2( by - cy, bx - cx );

			// Normalize angles to [0, 2π)
			const normA = ( angleA + 2 * Math.PI ) % ( 2 * Math.PI );
			const normB = ( angleB + 2 * Math.PI ) % ( 2 * Math.PI );

			// Calculate sweep angle (counterclockwise from arm1 to arm2)
			let sweep = normB - normA;
			if ( sweep < 0 ) {
				sweep += 2 * Math.PI;
			}

			// If reflex angle is requested, use the complementary angle
			if ( reflexAngle ) {
				if ( sweep <= Math.PI ) {
					sweep = 2 * Math.PI - sweep;
				}
			} else {
				// Default: use the minor angle (<=180°)
				if ( sweep > Math.PI ) {
					sweep = 2 * Math.PI - sweep;
				}
			}

			// Determine start and end angles for the arc
			// Start from arm1, sweep toward arm2
			let startAngle, endAngle;

			if ( reflexAngle ) {
				// For reflex: start from arm1, go the long way around to arm2
				if ( normB - normA > 0 && normB - normA <= Math.PI ) {
					// arm2 is CCW from arm1 by <=180°, so reflex goes CW
					startAngle = normB;
					endAngle = normA;
					// Swap so sweep is drawn correctly
					startAngle = normA;
					endAngle = normA + sweep;
				} else {
					startAngle = normA;
					endAngle = normA + sweep;
				}
			} else {
				// For minor angle: always use the shorter arc
				const ccwSweep = ( normB - normA + 2 * Math.PI ) % ( 2 * Math.PI );
				if ( ccwSweep <= Math.PI ) {
					// CCW from A to B is the minor angle
					startAngle = normA;
					endAngle = normB;
				} else {
					// CW from A to B is the minor angle
					startAngle = normB;
					endAngle = normA;
				}
			}

			return {
				startAngle: startAngle,
				endAngle: endAngle,
				sweepAngle: sweep,
				angleA: normA,
				angleB: normB
			};
		}

		/**
		 * Calculate angle in degrees
		 *
		 * @param {Object} layer - Angle dimension layer
		 * @return {number} Angle in degrees
		 */
		calculateDegrees( layer ) {
			const angles = this.calculateAngles( layer );
			return angles.sweepAngle * ( 180 / Math.PI );
		}

		/**
		 * Format angle measurement value for display
		 *
		 * @param {number} degrees - Angle in degrees
		 * @param {Object} layer - Layer with precision/tolerance settings
		 * @return {string} Formatted value string
		 */
		formatMeasurement( degrees, layer ) {
			const precision = layer.precision !== undefined ? layer.precision : DEFAULTS.precision;
			// Handle both boolean false and integer 0 (from PHP serialization)
			const showUnit = layer.showUnit !== false && layer.showUnit !== 0;
			const toleranceType = layer.toleranceType || DEFAULTS.toleranceType;

			const formattedValue = degrees.toFixed( precision );
			const unitSuffix = showUnit ? '\u00B0' : '';

			return this.formatWithTolerance(
				formattedValue, unitSuffix, toleranceType, layer, precision
			);
		}

		/**
		 * Format value with tolerance annotation
		 *
		 * @param {string} value - Formatted main value
		 * @param {string} unitSuffix - Unit suffix (e.g., "°")
		 * @param {string} toleranceType - Type of tolerance
		 * @param {Object} layer - Layer with tolerance settings
		 * @param {number} precision - Decimal precision
		 * @return {string} Formatted string with tolerance
		 */
		formatWithTolerance( value, unitSuffix, toleranceType, layer, precision ) {
			const numValue = parseFloat( value );

			switch ( toleranceType ) {
				case TOLERANCE_TYPES.SYMMETRIC: {
					const tol = parseFloat( layer.toleranceValue ) || DEFAULTS.toleranceValue;
					if ( tol === 0 || isNaN( tol ) ) {
						return value + unitSuffix;
					}
					return value + ' \u00B1' + tol.toFixed( precision ) + unitSuffix;
				}

				case TOLERANCE_TYPES.DEVIATION: {
					const upper = layer.toleranceUpper !== undefined ? parseFloat( layer.toleranceUpper ) : DEFAULTS.toleranceUpper;
					const lower = layer.toleranceLower !== undefined ? parseFloat( layer.toleranceLower ) : DEFAULTS.toleranceLower;
					if ( ( upper === 0 || isNaN( upper ) ) && ( lower === 0 || isNaN( lower ) ) ) {
						return value + unitSuffix;
					}
					const safeUpper = isNaN( upper ) ? 0 : upper;
					const safeLower = isNaN( lower ) ? 0 : lower;
					const upperStr = ( safeUpper >= 0 ? '+' : '' ) + safeUpper.toFixed( precision );
					const lowerStr = ( safeLower >= 0 ? '+' : '' ) + safeLower.toFixed( precision );
					return value + ' ' + upperStr + '/' + lowerStr + unitSuffix;
				}

				case TOLERANCE_TYPES.LIMITS: {
					const upper = layer.toleranceUpper !== undefined ? parseFloat( layer.toleranceUpper ) : DEFAULTS.toleranceUpper;
					const lower = layer.toleranceLower !== undefined ? parseFloat( layer.toleranceLower ) : DEFAULTS.toleranceLower;
					const safeUpper = isNaN( upper ) ? 0 : upper;
					const safeLower = isNaN( lower ) ? 0 : lower;
					const minVal = ( numValue - Math.abs( safeLower ) ).toFixed( precision );
					const maxVal = ( numValue + Math.abs( safeUpper ) ).toFixed( precision );
					return minVal + '-' + maxVal + unitSuffix;
				}

				case TOLERANCE_TYPES.BASIC:
					return value + unitSuffix;

				case TOLERANCE_TYPES.NONE:
				default:
					return value + unitSuffix;
			}
		}

		/**
		 * Build the full display text including value and tolerance
		 *
		 * @param {number} autoDegrees - Auto-calculated angle in degrees
		 * @param {Object} layer - Layer object with text/tolerance settings
		 * @return {string} Full display text
		 */
		buildDisplayText( autoDegrees, layer ) {
			if ( layer.text ) {
				return this.formatUserTextWithTolerance( layer.text, layer );
			}
			return this.formatMeasurement( autoDegrees, layer );
		}

		/**
		 * Format user-entered text with tolerance annotation
		 *
		 * @param {string} text - User-entered angle value
		 * @param {Object} layer - Layer with tolerance settings
		 * @return {string} Text with tolerance appended
		 */
		formatUserTextWithTolerance( text, layer ) {
			const toleranceType = layer.toleranceType || DEFAULTS.toleranceType;

			switch ( toleranceType ) {
				case TOLERANCE_TYPES.SYMMETRIC: {
					const tol = layer.toleranceValue;
					if ( !tol ) {
						return text;
					}
					return text + ' \u00B1' + tol;
				}

				case TOLERANCE_TYPES.DEVIATION: {
					const upper = layer.toleranceUpper;
					const lower = layer.toleranceLower;
					if ( !upper && !lower ) {
						return text;
					}
					let upperStr = upper || '0';
					if ( upperStr && !upperStr.toString().startsWith( '+' ) && !upperStr.toString().startsWith( '-' ) ) {
						upperStr = '+' + upperStr;
					}
					let lowerStr = lower || '0';
					if ( lowerStr && !lowerStr.toString().startsWith( '+' ) && !lowerStr.toString().startsWith( '-' ) ) {
						lowerStr = '-' + lowerStr;
					}
					return text + ' ' + upperStr + '/' + lowerStr;
				}

				case TOLERANCE_TYPES.LIMITS: {
					const upper = layer.toleranceUpper;
					const lower = layer.toleranceLower;
					if ( !upper && !lower ) {
						return text;
					}
					return text + ' (' + ( lower || '0' ) + ' to ' + ( upper || '0' ) + ')';
				}

				case TOLERANCE_TYPES.BASIC:
					return text;

				case TOLERANCE_TYPES.NONE:
				default:
					return text;
			}
		}

		/**
		 * Draw an angle dimension layer
		 *
		 * @param {Object} layer - Angle dimension layer object
		 * @param {Object} [_options] - Rendering options (reserved for future use)
		 */
		draw( layer, _options ) {
			if ( !this.ctx || !layer ) {
				return;
			}

			try {
				this._drawInternal( layer, _options );
			} catch ( error ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[AngleDimensionRenderer] Error drawing angle dimension:', error.message || error );
				}
			}
		}

		/**
		 * Internal draw implementation
		 *
		 * @param {Object} layer - Angle dimension layer object
		 * @param {Object} [_options] - Rendering options
		 * @private
		 */
		_drawInternal( layer, _options ) {
			const ctx = this.ctx;
			const cx = layer.cx || 0;
			const cy = layer.cy || 0;
			const ax = layer.ax || 0;
			const ay = layer.ay || 0;
			const bx = layer.bx || 0;
			const by = layer.by || 0;

			// Validate: arms must have some length
			const armALen = Math.sqrt( ( ax - cx ) * ( ax - cx ) + ( ay - cy ) * ( ay - cy ) );
			const armBLen = Math.sqrt( ( bx - cx ) * ( bx - cx ) + ( by - cy ) * ( by - cy ) );
			if ( armALen < 1 || armBLen < 1 ) {
				return;
			}

			const stroke = layer.stroke || DEFAULTS.stroke;
			let strokeWidth = layer.strokeWidth;
			if ( typeof strokeWidth !== 'number' || isNaN( strokeWidth ) || strokeWidth <= 0 ) {
				strokeWidth = DEFAULTS.strokeWidth;
			}
			let fontSize = layer.fontSize;
			if ( typeof fontSize !== 'number' || isNaN( fontSize ) || fontSize <= 0 ) {
				fontSize = DEFAULTS.fontSize;
			}
			const fontFamily = layer.fontFamily || DEFAULTS.fontFamily;
			const color = layer.color || DEFAULTS.color;
			const endStyle = layer.endStyle || DEFAULTS.endStyle;
			const textPosition = layer.textPosition || DEFAULTS.textPosition;
			let arcRadius = layer.arcRadius;
			if ( typeof arcRadius !== 'number' || isNaN( arcRadius ) || arcRadius <= 0 ) {
				arcRadius = DEFAULTS.arcRadius;
			}
			let extensionLength = layer.extensionLength;
			if ( typeof extensionLength !== 'number' || isNaN( extensionLength ) ) {
				extensionLength = DEFAULTS.extensionLength;
			}

			// Calculate angles
			const angles = this.calculateAngles( layer );
			const degrees = angles.sweepAngle * ( 180 / Math.PI );

			ctx.save();

			// Apply opacity
			if ( typeof layer.opacity === 'number' ) {
				ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}

			ctx.strokeStyle = stroke;
			ctx.lineWidth = strokeWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			// Draw extension lines along each arm (from vertex outward)
			this._drawExtensionLines( ctx, cx, cy, ax, ay, bx, by, arcRadius, extensionLength, angles );

			// Draw the arc
			// Handle both boolean false and integer 0 (from PHP serialization)
			const arrowsInside = layer.arrowsInside !== false && layer.arrowsInside !== 0;
			this._drawArc( ctx, cx, cy, arcRadius, angles, arrowsInside, endStyle, layer );

			// Draw end markers at arc endpoints
			this._drawArcEndMarkers( ctx, cx, cy, arcRadius, angles, endStyle, arrowsInside, layer );

			// Build and draw text
			const measureText = this.buildDisplayText( degrees, layer );
			this._drawAngleText(
				ctx, cx, cy, arcRadius, angles, measureText,
				fontSize, fontFamily, color, textPosition, layer
			);

			ctx.restore();
		}

		/**
		 * Draw extension lines along the arms from vertex through the arc
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} cx - Vertex X
		 * @param {number} cy - Vertex Y
		 * @param {number} ax - Arm1 endpoint X
		 * @param {number} ay - Arm1 endpoint Y
		 * @param {number} bx - Arm2 endpoint X
		 * @param {number} by - Arm2 endpoint Y
		 * @param {number} arcRadius - Radius of the dimension arc
		 * @param {number} extensionLength - How far lines extend past the arc
		 * @param {Object} angles - Calculated angle data
		 * @private
		 */
		_drawExtensionLines( ctx, cx, cy, ax, ay, bx, by, arcRadius, extensionLength, _angles ) {
			// Calculate arm unit vectors
			const armALen = Math.sqrt( ( ax - cx ) * ( ax - cx ) + ( ay - cy ) * ( ay - cy ) );
			const armBLen = Math.sqrt( ( bx - cx ) * ( bx - cx ) + ( by - cy ) * ( by - cy ) );

			const armAUnitX = ( ax - cx ) / armALen;
			const armAUnitY = ( ay - cy ) / armALen;
			const armBUnitX = ( bx - cx ) / armBLen;
			const armBUnitY = ( by - cy ) / armBLen;

			// Extension line for arm A: from vertex to arcRadius + extensionLength
			const extEndA = arcRadius + extensionLength;
			ctx.beginPath();
			ctx.moveTo( cx, cy );
			ctx.lineTo( cx + armAUnitX * extEndA, cy + armAUnitY * extEndA );
			ctx.stroke();

			// Extension line for arm B: from vertex to arcRadius + extensionLength
			const extEndB = arcRadius + extensionLength;
			ctx.beginPath();
			ctx.moveTo( cx, cy );
			ctx.lineTo( cx + armBUnitX * extEndB, cy + armBUnitY * extEndB );
			ctx.stroke();
		}

		/**
		 * Draw the dimension arc between the two arms
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} cx - Vertex X
		 * @param {number} cy - Vertex Y
		 * @param {number} arcRadius - Arc radius
		 * @param {Object} angles - Calculated angles
		 * @param {boolean} arrowsInside - Whether arrows point inward
		 * @param {string} endStyle - End marker style
		 * @param {Object} layer - Layer for style settings
		 * @private
		 */
		_drawArc( ctx, cx, cy, arcRadius, angles, arrowsInside, endStyle, layer ) {
			// Handle both boolean false and integer 0 (from PHP serialization)
			const showBackground = layer.showBackground !== false && layer.showBackground !== 0;
			const needsLineBreak = layer.textPosition === TEXT_POSITIONS.CENTER && !showBackground;

			if ( needsLineBreak ) {
				// Draw arc with gap for text
				const midAngle = angles.startAngle + angles.sweepAngle / 2;
				const textOffset = typeof layer.textOffset === 'number' ? layer.textOffset : 0;
				const textAngle = midAngle + textOffset * ( Math.PI / 180 );

				// Estimate gap based on font size
				const fontSize = layer.fontSize || DEFAULTS.fontSize;
				const gapAngle = ( fontSize * 1.5 ) / arcRadius; // approximate angular gap

				// Draw first half
				ctx.beginPath();
				ctx.arc( cx, cy, arcRadius, angles.startAngle, textAngle - gapAngle / 2 );
				ctx.stroke();

				// Draw second half
				ctx.beginPath();
				ctx.arc( cx, cy, arcRadius, textAngle + gapAngle / 2, angles.startAngle + angles.sweepAngle );
				ctx.stroke();
			} else {
				// Draw continuous arc
				ctx.beginPath();
				ctx.arc( cx, cy, arcRadius, angles.startAngle, angles.startAngle + angles.sweepAngle );
				ctx.stroke();
			}
		}

		/**
		 * Draw end markers at the arc endpoints
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} cx - Vertex X
		 * @param {number} cy - Vertex Y
		 * @param {number} arcRadius - Arc radius
		 * @param {Object} angles - Calculated angles
		 * @param {string} endStyle - End marker style
		 * @param {boolean} arrowsInside - Whether arrows point inward
		 * @param {Object} layer - Layer for style settings
		 * @private
		 */
		_drawArcEndMarkers( ctx, cx, cy, arcRadius, angles, endStyle, arrowsInside, layer ) {
			if ( endStyle === END_STYLES.NONE ) {
				return;
			}

			// Arc start point
			const startX = cx + arcRadius * Math.cos( angles.startAngle );
			const startY = cy + arcRadius * Math.sin( angles.startAngle );

			// Arc end point
			const endAngle = angles.startAngle + angles.sweepAngle;
			const endX = cx + arcRadius * Math.cos( endAngle );
			const endY = cy + arcRadius * Math.sin( endAngle );

			// Tangent directions at arc endpoints
			// For a circle at angle θ, the tangent direction is (-sin θ, cos θ) for CCW
			if ( arrowsInside ) {
				// Arrows point along the arc toward each other (inward)
				// At start: tangent is in the CCW direction (into the arc)
				const startTangentAngle = angles.startAngle + Math.PI / 2;
				// At end: tangent is in the CW direction (into the arc)
				const endTangentAngle = endAngle - Math.PI / 2;

				this._drawEndMarker( ctx, startX, startY, startTangentAngle, endStyle, layer );
				this._drawEndMarker( ctx, endX, endY, endTangentAngle, endStyle, layer );
			} else {
				// Arrows point outward (away from each other)
				const startTangentAngle = angles.startAngle - Math.PI / 2;
				const endTangentAngle = endAngle + Math.PI / 2;

				this._drawEndMarker( ctx, startX, startY, startTangentAngle, endStyle, layer );
				this._drawEndMarker( ctx, endX, endY, endTangentAngle, endStyle, layer );

				// Draw extension tails for outside arrows
				if ( endStyle === END_STYLES.ARROW ) {
					const arrowSize = layer.arrowSize || DEFAULTS.arrowSize;
					const tailLength = arrowSize * 1.5;

					// Tail at start (extends arc backward)
					const tailStartAngle = angles.startAngle - ( tailLength / arcRadius );
					ctx.beginPath();
					ctx.arc( cx, cy, arcRadius, tailStartAngle, angles.startAngle );
					ctx.stroke();

					// Tail at end (extends arc forward)
					const tailEndAngle = endAngle + ( tailLength / arcRadius );
					ctx.beginPath();
					ctx.arc( cx, cy, arcRadius, endAngle, tailEndAngle );
					ctx.stroke();
				}
			}
		}

		/**
		 * Draw end marker (arrow, tick, or dot)
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} x - Marker X position
		 * @param {number} y - Marker Y position
		 * @param {number} angle - Direction angle (radians)
		 * @param {string} style - End style (arrow, tick, dot, none)
		 * @param {Object} layer - Layer for style settings
		 * @private
		 */
		_drawEndMarker( ctx, x, y, angle, style, layer ) {
			const arrowSize = layer.arrowSize || DEFAULTS.arrowSize;
			const tickSize = layer.tickSize || DEFAULTS.tickSize;

			switch ( style ) {
				case END_STYLES.ARROW: {
					const arrowAngle = Math.PI / 6;
					ctx.beginPath();
					ctx.moveTo( x, y );
					ctx.lineTo(
						x + arrowSize * Math.cos( angle - arrowAngle ),
						y + arrowSize * Math.sin( angle - arrowAngle )
					);
					ctx.moveTo( x, y );
					ctx.lineTo(
						x + arrowSize * Math.cos( angle + arrowAngle ),
						y + arrowSize * Math.sin( angle + arrowAngle )
					);
					ctx.stroke();
					break;
				}

				case END_STYLES.TICK: {
					const perpAngle = angle + Math.PI / 2;
					ctx.beginPath();
					ctx.moveTo(
						x - tickSize / 2 * Math.cos( perpAngle ),
						y - tickSize / 2 * Math.sin( perpAngle )
					);
					ctx.lineTo(
						x + tickSize / 2 * Math.cos( perpAngle ),
						y + tickSize / 2 * Math.sin( perpAngle )
					);
					ctx.stroke();
					break;
				}

				case END_STYLES.DOT:
					ctx.beginPath();
					ctx.arc( x, y, 2, 0, Math.PI * 2 );
					ctx.fillStyle = layer.stroke || DEFAULTS.stroke;
					ctx.fill();
					break;

				case END_STYLES.NONE:
				default:
					break;
			}
		}

		/**
		 * Draw the angle measurement text along the arc
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} cx - Vertex X
		 * @param {number} cy - Vertex Y
		 * @param {number} arcRadius - Arc radius
		 * @param {Object} angles - Calculated angles
		 * @param {string} text - Measurement text
		 * @param {number} fontSize - Font size
		 * @param {string} fontFamily - Font family
		 * @param {string} color - Text color
		 * @param {string} position - Text position (above, below, center)
		 * @param {Object} [layer] - Layer object
		 * @private
		 */
		_drawAngleText( ctx, cx, cy, arcRadius, angles, text, fontSize, fontFamily, color, position, layer ) {
			// Calculate midpoint of the arc for text placement
			const textOffset = typeof layer?.textOffset === 'number' ? layer.textOffset : 0;
			const midAngle = angles.startAngle + angles.sweepAngle / 2 + textOffset * ( Math.PI / 180 );

			// Text position perpendicular to arc
			let textRadius = arcRadius;
			const perpOffset = fontSize * 0.8;

			switch ( position ) {
				case TEXT_POSITIONS.ABOVE:
					// Above = inside the curve (closer to vertex)
					textRadius = arcRadius - perpOffset;
					break;
				case TEXT_POSITIONS.BELOW:
					// Below = outside the curve (farther from vertex)
					textRadius = arcRadius + perpOffset;
					break;
				case TEXT_POSITIONS.CENTER:
				default:
					// On the arc
					textRadius = arcRadius;
					break;
			}

			const textX = cx + textRadius * Math.cos( midAngle );
			const textY = cy + textRadius * Math.sin( midAngle );

			// Determine text rotation to follow the arc
			const textDirection = layer?.textDirection || 'auto';
			let textAngle;
			if ( textDirection === 'horizontal' ) {
				textAngle = 0;
			} else {
				// Auto: orient text tangent to the arc, flipped for readability
				textAngle = midAngle + Math.PI / 2;
				if ( textAngle > Math.PI / 2 || textAngle < -Math.PI / 2 ) {
					textAngle += Math.PI;
				}
				// Normalize
				textAngle = ( ( textAngle % ( 2 * Math.PI ) ) + 2 * Math.PI ) % ( 2 * Math.PI );
				if ( textAngle > Math.PI / 2 && textAngle < 3 * Math.PI / 2 ) {
					textAngle += Math.PI;
				}
			}

			ctx.save();
			ctx.translate( textX, textY );
			ctx.rotate( textAngle );

			ctx.font = fontSize + 'px ' + fontFamily;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';

			const metrics = ctx.measureText( text );
			const padding = 3;
			// Handle both boolean false and integer 0 (from PHP serialization)
			const showBackground = layer?.showBackground !== false && layer?.showBackground !== 0;
			const backgroundColor = layer?.backgroundColor || DEFAULTS.backgroundColor;
			const toleranceType = layer?.toleranceType || DEFAULTS.toleranceType;

			// Draw background
			if ( showBackground ) {
				ctx.fillStyle = backgroundColor;
				ctx.fillRect(
					-metrics.width / 2 - padding,
					-fontSize / 2 - padding,
					metrics.width + padding * 2,
					fontSize + padding * 2
				);
			}

			// Draw basic reference box
			if ( toleranceType === TOLERANCE_TYPES.BASIC ) {
				ctx.strokeStyle = color;
				ctx.lineWidth = 1;
				ctx.strokeRect(
					-metrics.width / 2 - padding,
					-fontSize / 2 - padding,
					metrics.width + padding * 2,
					fontSize + padding * 2
				);
			}

			ctx.fillStyle = color;
			ctx.fillText( text, 0, 0 );

			ctx.restore();
		}

		/**
		 * Get the bounding box for an angle dimension layer
		 *
		 * @param {Object} layer - Angle dimension layer
		 * @return {Object} Bounding box {x, y, width, height}
		 */
		getBounds( layer ) {
			const cx = layer.cx || 0;
			const cy = layer.cy || 0;
			const ax = layer.ax || 0;
			const ay = layer.ay || 0;
			const bx = layer.bx || 0;
			const by = layer.by || 0;
			const arcRadius = layer.arcRadius || DEFAULTS.arcRadius;
			const padding = 20;

			// Bounding box encompasses vertex, arm endpoints, and the arc
			const minX = Math.min( cx - arcRadius, ax, bx ) - padding;
			const minY = Math.min( cy - arcRadius, ay, by ) - padding;
			const maxX = Math.max( cx + arcRadius, ax, bx ) + padding;
			const maxY = Math.max( cy + arcRadius, ay, by ) + padding;

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Hit test for angle dimension layer
		 *
		 * @param {Object} layer - Angle dimension layer
		 * @param {number} px - Test point X
		 * @param {number} py - Test point Y
		 * @return {boolean} True if point is near the angle dimension
		 */
		hitTest( layer, px, py ) {
			const cx = layer.cx || 0;
			const cy = layer.cy || 0;
			const ax = layer.ax || 0;
			const ay = layer.ay || 0;
			const bx = layer.bx || 0;
			const by = layer.by || 0;
			const arcRadius = layer.arcRadius || DEFAULTS.arcRadius;
			const tolerance = 10;

			// Test 1: Distance to the arc
			const distFromVertex = Math.sqrt( ( px - cx ) * ( px - cx ) + ( py - cy ) * ( py - cy ) );
			if ( Math.abs( distFromVertex - arcRadius ) <= tolerance ) {
				// Check if the point is within the arc's angular range
				const angles = this.calculateAngles( layer );
				const pointAngle = ( Math.atan2( py - cy, px - cx ) + 2 * Math.PI ) % ( 2 * Math.PI );
				if ( this._isAngleInRange( pointAngle, angles.startAngle, angles.sweepAngle ) ) {
					return true;
				}
			}

			// Test 2: Distance to extension lines (from vertex to arm endpoints)
			const distToArmA = this._pointToLineDistance( px, py, cx, cy, ax, ay );
			if ( distToArmA <= tolerance ) {
				return true;
			}
			const distToArmB = this._pointToLineDistance( px, py, cx, cy, bx, by );
			return distToArmB <= tolerance;
		}

		/**
		 * Check if an angle is within a range (accounting for wrapping)
		 *
		 * @param {number} angle - Test angle in radians [0, 2π)
		 * @param {number} startAngle - Range start angle
		 * @param {number} sweepAngle - Range sweep (positive = CCW)
		 * @return {boolean} True if angle is within range
		 * @private
		 */
		_isAngleInRange( angle, startAngle, sweepAngle ) {
			const normStart = ( startAngle % ( 2 * Math.PI ) + 2 * Math.PI ) % ( 2 * Math.PI );
			const normEnd = ( ( startAngle + sweepAngle ) % ( 2 * Math.PI ) + 2 * Math.PI ) % ( 2 * Math.PI );
			const normAngle = ( angle % ( 2 * Math.PI ) + 2 * Math.PI ) % ( 2 * Math.PI );

			if ( sweepAngle >= 0 ) {
				// CCW sweep
				if ( normStart <= normEnd ) {
					return normAngle >= normStart && normAngle <= normEnd;
				}
				// Wraps around 0
				return normAngle >= normStart || normAngle <= normEnd;
			}
			// CW sweep (should not normally happen with our calculation)
			if ( normEnd <= normStart ) {
				return normAngle >= normEnd && normAngle <= normStart;
			}
			return normAngle >= normEnd || normAngle <= normStart;
		}

		/**
		 * Calculate distance from point to line segment
		 *
		 * @param {number} px - Point X
		 * @param {number} py - Point Y
		 * @param {number} x1 - Line start X
		 * @param {number} y1 - Line start Y
		 * @param {number} x2 - Line end X
		 * @param {number} y2 - Line end Y
		 * @return {number} Distance from point to line
		 * @private
		 */
		_pointToLineDistance( px, py, x1, y1, x2, y2 ) {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const lengthSq = dx * dx + dy * dy;

			if ( lengthSq === 0 ) {
				return Math.sqrt( ( px - x1 ) * ( px - x1 ) + ( py - y1 ) * ( py - y1 ) );
			}

			let t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / lengthSq;
			t = Math.max( 0, Math.min( 1, t ) );

			const projX = x1 + t * dx;
			const projY = y1 + t * dy;

			return Math.sqrt( ( px - projX ) * ( px - projX ) + ( py - projY ) * ( py - projY ) );
		}

		/**
		 * Create a default angle dimension layer object
		 *
		 * @param {number} cx - Vertex X
		 * @param {number} cy - Vertex Y
		 * @param {number} ax - Arm1 endpoint X
		 * @param {number} ay - Arm1 endpoint Y
		 * @param {number} bx - Arm2 endpoint X
		 * @param {number} by - Arm2 endpoint Y
		 * @param {Object} [options] - Additional options
		 * @return {Object} Angle dimension layer object
		 */
		static createAngleDimensionLayer( cx, cy, ax, ay, bx, by, options ) {
			options = options || {};

			return {
				id: options.id || 'angleDimension-' + Date.now(),
				type: 'angleDimension',
				cx: cx,
				cy: cy,
				ax: ax,
				ay: ay,
				bx: bx,
				by: by,
				stroke: options.stroke || DEFAULTS.stroke,
				strokeWidth: options.strokeWidth || DEFAULTS.strokeWidth,
				fontSize: options.fontSize || DEFAULTS.fontSize,
				fontFamily: options.fontFamily || DEFAULTS.fontFamily,
				color: options.color || DEFAULTS.color,
				endStyle: options.endStyle || DEFAULTS.endStyle,
				textPosition: options.textPosition || DEFAULTS.textPosition,
				arcRadius: options.arcRadius || DEFAULTS.arcRadius,
				extensionLength: options.extensionLength !== undefined ? options.extensionLength : DEFAULTS.extensionLength,
				arrowsInside: options.arrowsInside !== false,
				arrowSize: options.arrowSize || DEFAULTS.arrowSize,
				tickSize: options.tickSize || DEFAULTS.tickSize,
				showUnit: options.showUnit !== false,
				showBackground: options.showBackground !== false,
				backgroundColor: options.backgroundColor || DEFAULTS.backgroundColor,
				precision: options.precision !== undefined ? options.precision : DEFAULTS.precision,
				reflexAngle: options.reflexAngle || false,
				textOffset: options.textOffset !== undefined ? options.textOffset : DEFAULTS.textOffset,
				toleranceType: options.toleranceType || DEFAULTS.toleranceType,
				toleranceValue: options.toleranceValue !== undefined ? options.toleranceValue : DEFAULTS.toleranceValue,
				toleranceUpper: options.toleranceUpper !== undefined ? options.toleranceUpper : DEFAULTS.toleranceUpper,
				toleranceLower: options.toleranceLower !== undefined ? options.toleranceLower : DEFAULTS.toleranceLower,
				text: options.text || '',
				visible: options.visible !== false,
				locked: options.locked || false,
				opacity: options.opacity !== undefined ? options.opacity : 1,
				name: options.name || 'Angle Dimension'
			};
		}

		/**
		 * Get available end styles
		 *
		 * @return {Object} End style constants
		 */
		static get END_STYLES() {
			return END_STYLES;
		}

		/**
		 * Get available text positions
		 *
		 * @return {Object} Text position constants
		 */
		static get TEXT_POSITIONS() {
			return TEXT_POSITIONS;
		}

		/**
		 * Get default configuration
		 *
		 * @return {Object} Default values
		 */
		static get DEFAULTS() {
			return { ...DEFAULTS };
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.AngleDimensionRenderer = AngleDimensionRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = AngleDimensionRenderer;
	}

} )();
