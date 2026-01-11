/**
 * DimensionRenderer - Renders dimension/measurement annotations
 *
 * This module handles rendering of dimension lines for technical illustrations:
 * - Horizontal and vertical dimension lines with extension lines
 * - Auto-calculated measurement values (with optional scale)
 * - Arrow/tick mark styles at endpoints
 * - Configurable text positioning (above, below, inline)
 *
 * @module DimensionRenderer
 * @since 1.5.4
 */
( function () {
	'use strict';

	/**
	 * Dimension end style constants
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
	 * Default dimension configuration
	 * @constant {Object}
	 */
	const DEFAULTS = {
		stroke: '#000000',
		strokeWidth: 1,
		fontSize: 12,
		fontFamily: 'Arial, sans-serif',
		color: '#000000',
		endStyle: END_STYLES.ARROW,
		textPosition: TEXT_POSITIONS.ABOVE,
		extensionLength: 10,
		extensionGap: 3,
		arrowSize: 8,
		tickSize: 6,
		unit: 'px',
		scale: 1,
		showUnit: true,
		showBackground: true,
		backgroundColor: '#ffffff',
		precision: 0,
		toleranceType: 'none',
		toleranceValue: 0,
		toleranceUpper: 0,
		toleranceLower: 0
	};

	/**
	 * Tolerance type constants
	 * @constant {Object}
	 */
	const TOLERANCE_TYPES = {
		NONE: 'none',
		SYMMETRIC: 'symmetric',   // ±value
		DEVIATION: 'deviation',   // +upper/-lower
		LIMITS: 'limits',         // min-max format
		BASIC: 'basic'            // boxed (reference dimension)
	};

	/**
	 * DimensionRenderer class - Renders dimension annotations on canvas
	 */
	class DimensionRenderer {
		/**
		 * Creates a new DimensionRenderer instance
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
		 * Format measurement value for display
		 *
		 * @param {number} value - Raw pixel value
		 * @param {Object} layer - Layer with scale/unit/precision settings
		 * @return {string} Formatted value string
		 */
		formatMeasurement( value, layer ) {
			const scale = layer.scale || DEFAULTS.scale;
			const unit = layer.unit || DEFAULTS.unit;
			const precision = layer.precision !== undefined ? layer.precision : DEFAULTS.precision;
			const showUnit = layer.showUnit !== false;
			const toleranceType = layer.toleranceType || DEFAULTS.toleranceType;

			const scaledValue = value * scale;
			const formattedValue = scaledValue.toFixed( precision );
			const unitSuffix = showUnit ? ' ' + unit : '';

			// Format based on tolerance type
			return this.formatWithTolerance(
				formattedValue, unitSuffix, toleranceType, layer, precision
			);
		}

		/**
		 * Format value with tolerance annotation
		 *
		 * @param {string} value - Formatted main value
		 * @param {string} unitSuffix - Unit suffix (e.g., " mm")
		 * @param {string} toleranceType - Type of tolerance
		 * @param {Object} layer - Layer with tolerance settings
		 * @param {number} precision - Decimal precision
		 * @return {string} Formatted string with tolerance
		 */
		formatWithTolerance( value, unitSuffix, toleranceType, layer, precision ) {
			const numValue = parseFloat( value );

			switch ( toleranceType ) {
				case TOLERANCE_TYPES.SYMMETRIC: {
					// ±tolerance (e.g., "10.5 ±0.2 mm")
					// Parse as number - tolerance values may be stored as strings
					const tol = parseFloat( layer.toleranceValue ) || DEFAULTS.toleranceValue;
					if ( tol === 0 || isNaN( tol ) ) {
						return value + unitSuffix;
					}
					return value + ' ±' + tol.toFixed( precision ) + unitSuffix;
				}

				case TOLERANCE_TYPES.DEVIATION: {
					// +upper/-lower (e.g., "10.5 +0.2/-0.1 mm")
					// Parse as numbers - tolerance values may be stored as strings
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
					// min-max format (e.g., "10.3-10.7 mm")
					// Parse as numbers - tolerance values may be stored as strings
					const upper = layer.toleranceUpper !== undefined ? parseFloat( layer.toleranceUpper ) : DEFAULTS.toleranceUpper;
					const lower = layer.toleranceLower !== undefined ? parseFloat( layer.toleranceLower ) : DEFAULTS.toleranceLower;
					const safeUpper = isNaN( upper ) ? 0 : upper;
					const safeLower = isNaN( lower ) ? 0 : lower;
					const minVal = ( numValue - Math.abs( safeLower ) ).toFixed( precision );
					const maxVal = ( numValue + Math.abs( safeUpper ) ).toFixed( precision );
					return minVal + '-' + maxVal + unitSuffix;
				}

				case TOLERANCE_TYPES.BASIC:
					// Basic dimensions are drawn with a box around them (handled in rendering)
					// The text is just the value
					return value + unitSuffix;

				case TOLERANCE_TYPES.NONE:
				default:
					return value + unitSuffix;
			}
		}

		/**
		 * Calculate the measurement distance
		 *
		 * @param {Object} layer - Dimension layer
		 * @return {number} Distance in pixels
		 */
		calculateDistance( layer ) {
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			const dx = x2 - x1;
			const dy = y2 - y1;

			return Math.sqrt( dx * dx + dy * dy );
		}

		/**
		 * Draw a dimension layer
		 *
		 * @param {Object} layer - Dimension layer object
		 * @param {Object} [_options] - Rendering options (reserved for future use)
		 */
		draw( layer, _options ) {
			if ( !this.ctx || !layer ) {
				return;
			}

			try {
				this._drawInternal( layer, _options );
			} catch ( error ) {
				// Log error and continue - don't break rendering of other layers
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[DimensionRenderer] Error drawing dimension:', error.message || error );
				}
			}
		}

		/**
		 * Internal draw implementation
		 *
		 * @param {Object} layer - Dimension layer object
		 * @param {Object} [_options] - Rendering options
		 * @private
		 */
		_drawInternal( layer, _options ) {
			const ctx = this.ctx;
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;
			const stroke = layer.stroke || DEFAULTS.stroke;
			// Ensure strokeWidth is a valid positive number
			let strokeWidth = layer.strokeWidth;
			if ( typeof strokeWidth !== 'number' || isNaN( strokeWidth ) || strokeWidth <= 0 ) {
				strokeWidth = DEFAULTS.strokeWidth;
			}
			// Ensure fontSize is a valid positive number
			let fontSize = layer.fontSize;
			if ( typeof fontSize !== 'number' || isNaN( fontSize ) || fontSize <= 0 ) {
				fontSize = DEFAULTS.fontSize;
			}
			const fontFamily = layer.fontFamily || DEFAULTS.fontFamily;
			const color = layer.color || DEFAULTS.color;
			const endStyle = layer.endStyle || DEFAULTS.endStyle;
			const textPosition = layer.textPosition || DEFAULTS.textPosition;
			// Ensure extensionLength is a valid number (can be 0)
			let extensionLength = layer.extensionLength;
			if ( typeof extensionLength !== 'number' || isNaN( extensionLength ) ) {
				extensionLength = DEFAULTS.extensionLength;
			}
			// Ensure extensionGap is a valid number (can be 0)
			let extensionGap = layer.extensionGap;
			if ( typeof extensionGap !== 'number' || isNaN( extensionGap ) ) {
				extensionGap = DEFAULTS.extensionGap;
			}

			// Calculate angle and distance
			const dx = x2 - x1;
			const dy = y2 - y1;
			const angle = Math.atan2( dy, dx );
			const distance = Math.sqrt( dx * dx + dy * dy );

			if ( distance < 1 ) {
				return; // Too small to draw
			}

			ctx.save();

			// Apply opacity
			if ( typeof layer.opacity === 'number' ) {
				ctx.globalAlpha = Math.max( 0, Math.min( 1, layer.opacity ) );
			}

			// Set stroke style
			ctx.strokeStyle = stroke;
			ctx.lineWidth = strokeWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			// Calculate perpendicular direction for extension lines
			const perpX = -Math.sin( angle );
			const perpY = Math.cos( angle );

			// Draw extension lines
			this._drawExtensionLines( ctx, x1, y1, x2, y2, perpX, perpY, extensionLength, extensionGap );

			// Calculate dimension line offset (away from the measured points)
			const offsetDistance = extensionGap + extensionLength / 2;
			const dimX1 = x1 + perpX * offsetDistance;
			const dimY1 = y1 + perpY * offsetDistance;
			const dimX2 = x2 + perpX * offsetDistance;
			const dimY2 = y2 + perpY * offsetDistance;

			// Build measurement text with tolerance (need this for gap calculation)
			const measureText = this.buildDisplayText( distance, layer );

			// Check if we need to break the line at center text
			// Handle both boolean false and integer 0 (from PHP serialization)
			const showBackground = layer.showBackground !== false && layer.showBackground !== 0;
			const needsLineBreak = textPosition === TEXT_POSITIONS.CENTER && !showBackground;

			// Draw main dimension line (with optional gap for center text)
			if ( needsLineBreak ) {
				// Calculate text width for gap
				ctx.font = fontSize + 'px ' + fontFamily;
				const textMetrics = ctx.measureText( measureText );
				const gapWidth = textMetrics.width + 10; // Add padding

				// Calculate gap start and end points
				const centerX = ( dimX1 + dimX2 ) / 2;
				const centerY = ( dimY1 + dimY2 ) / 2;
				const halfGap = gapWidth / 2;
				const unitDx = dx / distance;
				const unitDy = dy / distance;

				// Draw line from start to gap start
				ctx.beginPath();
				ctx.moveTo( dimX1, dimY1 );
				ctx.lineTo( centerX - unitDx * halfGap, centerY - unitDy * halfGap );
				ctx.stroke();

				// Draw line from gap end to end
				ctx.beginPath();
				ctx.moveTo( centerX + unitDx * halfGap, centerY + unitDy * halfGap );
				ctx.lineTo( dimX2, dimY2 );
				ctx.stroke();
			} else {
				// Draw continuous line
				ctx.beginPath();
				ctx.moveTo( dimX1, dimY1 );
				ctx.lineTo( dimX2, dimY2 );
				ctx.stroke();
			}

			// Draw end markers
			this._drawEndMarker( ctx, dimX1, dimY1, angle, endStyle, layer );
			this._drawEndMarker( ctx, dimX2, dimY2, angle + Math.PI, endStyle, layer );

			// Draw measurement text
			this._drawMeasurementText(
				ctx, dimX1, dimY1, dimX2, dimY2, angle,
				measureText, fontSize, fontFamily, color, textPosition, layer
			);

			ctx.restore();
		}

		/**
		 * Build the full display text including value and tolerance
		 *
		 * @param {number} autoDistance - Auto-calculated distance in pixels
		 * @param {Object} layer - Layer object with text/tolerance settings
		 * @return {string} Full display text
		 */
		buildDisplayText( autoDistance, layer ) {
			// Use user-entered text if provided, otherwise auto-calculate
			const baseValue = layer.text || this.formatMeasurement( autoDistance, layer );

			// If user entered text, apply tolerance formatting to it
			if ( layer.text ) {
				return this.formatUserTextWithTolerance( layer.text, layer );
			}

			return baseValue;
		}

		/**
		 * Format user-entered text with tolerance annotation
		 *
		 * @param {string} text - User-entered dimension value
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
					return text + ' ±' + tol;
				}

				case TOLERANCE_TYPES.DEVIATION: {
					const upper = layer.toleranceUpper;
					const lower = layer.toleranceLower;
					if ( !upper && !lower ) {
						return text;
					}
					// Format upper with + prefix if not already present
					let upperStr = upper || '0';
					if ( upperStr && !upperStr.toString().startsWith( '+' ) && !upperStr.toString().startsWith( '-' ) ) {
						upperStr = '+' + upperStr;
					}
					// Format lower with - prefix if not already present (and not already negative)
					let lowerStr = lower || '0';
					if ( lowerStr && !lowerStr.toString().startsWith( '+' ) && !lowerStr.toString().startsWith( '-' ) ) {
						lowerStr = '-' + lowerStr;
					}
					return text + ' ' + upperStr + '/' + lowerStr;
				}

				case TOLERANCE_TYPES.LIMITS: {
					// For limits with user text, just show upper/lower as suffix
					const upper = layer.toleranceUpper;
					const lower = layer.toleranceLower;
					if ( !upper && !lower ) {
						return text;
					}
					return text + ' (' + ( lower || '0' ) + ' to ' + ( upper || '0' ) + ')';
				}

				case TOLERANCE_TYPES.BASIC:
					// Basic just draws a box around the text (handled in rendering)
					return text;

				case TOLERANCE_TYPES.NONE:
				default:
					return text;
			}
		}

		/**
		 * Draw extension lines from measurement points
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} x1 - Start X
		 * @param {number} y1 - Start Y
		 * @param {number} x2 - End X
		 * @param {number} y2 - End Y
		 * @param {number} perpX - Perpendicular X direction
		 * @param {number} perpY - Perpendicular Y direction
		 * @param {number} length - Extension line length
		 * @param {number} gap - Gap from measurement point
		 * @private
		 */
		_drawExtensionLines( ctx, x1, y1, x2, y2, perpX, perpY, length, gap ) {
			ctx.beginPath();

			// Extension line at start point
			ctx.moveTo( x1 + perpX * gap, y1 + perpY * gap );
			ctx.lineTo( x1 + perpX * ( gap + length ), y1 + perpY * ( gap + length ) );

			// Extension line at end point
			ctx.moveTo( x2 + perpX * gap, y2 + perpY * gap );
			ctx.lineTo( x2 + perpX * ( gap + length ), y2 + perpY * ( gap + length ) );

			ctx.stroke();
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
					const arrowAngle = Math.PI / 6; // 30 degrees
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
					// Diagonal tick mark
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
					// No marker
					break;
			}
		}

		/**
		 * Draw measurement text on dimension line
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas context
		 * @param {number} x1 - Dimension line start X
		 * @param {number} y1 - Dimension line start Y
		 * @param {number} x2 - Dimension line end X
		 * @param {number} y2 - Dimension line end Y
		 * @param {number} angle - Line angle (radians)
		 * @param {string} text - Measurement text
		 * @param {number} fontSize - Font size
		 * @param {string} fontFamily - Font family
		 * @param {string} color - Text color
		 * @param {string} position - Text position (above, below, center)
		 * @param {Object} [layer] - Layer object for tolerance settings
		 * @private
		 */
		_drawMeasurementText( ctx, x1, y1, x2, y2, angle, text, fontSize, fontFamily, color, position, layer ) {
			const centerX = ( x1 + x2 ) / 2;
			const centerY = ( y1 + y2 ) / 2;
			const toleranceType = layer?.toleranceType || DEFAULTS.toleranceType;

			// Calculate perpendicular offset for text
			const perpX = -Math.sin( angle );
			const perpY = Math.cos( angle );
			const textOffset = fontSize * 0.8;

			let textX = centerX;
			let textY = centerY;

			switch ( position ) {
				case TEXT_POSITIONS.ABOVE:
					textX -= perpX * textOffset;
					textY -= perpY * textOffset;
					break;
				case TEXT_POSITIONS.BELOW:
					textX += perpX * textOffset;
					textY += perpY * textOffset;
					break;
				case TEXT_POSITIONS.CENTER:
				default:
					// Text at center, with white background
					break;
			}

			// Determine text angle based on textDirection setting
			const textDirection = layer?.textDirection || 'auto';
			let textAngle;
			if ( textDirection === 'horizontal' ) {
				// Force horizontal text regardless of line angle
				textAngle = 0;
			} else if ( textDirection === 'auto-reversed' ) {
				// Auto reversed: follow line angle but flipped 180 degrees
				textAngle = angle + Math.PI;
				// Normalize for readability (keep text upright)
				if ( textAngle > Math.PI / 2 || textAngle < -Math.PI / 2 ) {
					textAngle += Math.PI;
				}
			} else {
				// Auto: follow line angle, normalized for readability (keep text upright)
				textAngle = angle;
				if ( textAngle > Math.PI / 2 || textAngle < -Math.PI / 2 ) {
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
			const backgroundColor = layer?.backgroundColor || '#ffffff';

			// Draw background for readability (optional, default on)
			if ( showBackground ) {
				ctx.fillStyle = backgroundColor;
				ctx.fillRect(
					-metrics.width / 2 - padding,
					-fontSize / 2 - padding,
					metrics.width + padding * 2,
					fontSize + padding * 2
				);
			}

			// For basic (reference) dimension, draw a box around the text
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
		 * Get the bounding box for a dimension layer
		 *
		 * @param {Object} layer - Dimension layer
		 * @return {Object} Bounding box {x, y, width, height}
		 */
		getBounds( layer ) {
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;
			const extensionLength = layer.extensionLength || DEFAULTS.extensionLength;
			const padding = extensionLength + 20; // Account for extension lines and text

			const minX = Math.min( x1, x2 ) - padding;
			const minY = Math.min( y1, y2 ) - padding;
			const maxX = Math.max( x1, x2 ) + padding;
			const maxY = Math.max( y1, y2 ) + padding;

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Hit test for dimension layer
		 *
		 * @param {Object} layer - Dimension layer
		 * @param {number} px - Test point X
		 * @param {number} py - Test point Y
		 * @return {boolean} True if point is near dimension line
		 */
		hitTest( layer, px, py ) {
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			// Check distance to main line
			const distance = this._pointToLineDistance( px, py, x1, y1, x2, y2 );
			return distance <= 10;
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
		 * Create a default dimension layer object
		 *
		 * @param {number} x1 - Start X position
		 * @param {number} y1 - Start Y position
		 * @param {number} x2 - End X position
		 * @param {number} y2 - End Y position
		 * @param {Object} [options] - Additional options
		 * @return {Object} Dimension layer object
		 */
		static createDimensionLayer( x1, y1, x2, y2, options ) {
			options = options || {};

			return {
				id: options.id || 'dimension-' + Date.now(),
				type: 'dimension',
				x1: x1,
				y1: y1,
				x2: x2,
				y2: y2,
				stroke: options.stroke || DEFAULTS.stroke,
				strokeWidth: options.strokeWidth || DEFAULTS.strokeWidth,
				fontSize: options.fontSize || DEFAULTS.fontSize,
				fontFamily: options.fontFamily || DEFAULTS.fontFamily,
				color: options.color || DEFAULTS.color,
				endStyle: options.endStyle || DEFAULTS.endStyle,
				textPosition: options.textPosition || DEFAULTS.textPosition,
				extensionLength: options.extensionLength || DEFAULTS.extensionLength,
				extensionGap: options.extensionGap || DEFAULTS.extensionGap,
				arrowSize: options.arrowSize || DEFAULTS.arrowSize,
				tickSize: options.tickSize || DEFAULTS.tickSize,
				unit: options.unit || DEFAULTS.unit,
				scale: options.scale || DEFAULTS.scale,
				showUnit: options.showUnit !== false,
				showBackground: options.showBackground !== false,
				backgroundColor: options.backgroundColor || DEFAULTS.backgroundColor,
				precision: options.precision !== undefined ? options.precision : DEFAULTS.precision,
				toleranceType: options.toleranceType || DEFAULTS.toleranceType,
				toleranceValue: options.toleranceValue !== undefined ? options.toleranceValue : DEFAULTS.toleranceValue,
				toleranceUpper: options.toleranceUpper !== undefined ? options.toleranceUpper : DEFAULTS.toleranceUpper,
				toleranceLower: options.toleranceLower !== undefined ? options.toleranceLower : DEFAULTS.toleranceLower,
				text: options.text || '', // Empty = auto-calculate
				visible: options.visible !== false,
				locked: options.locked || false,
				opacity: options.opacity !== undefined ? options.opacity : 1,
				name: options.name || 'Dimension'
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
		window.Layers.DimensionRenderer = DimensionRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = DimensionRenderer;
	}

} )();
