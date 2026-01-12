/**
 * MarkerRenderer - Renders number/letter sequence markers with optional arrows
 *
 * This module handles rendering of marker annotations:
 * - Circled numbers: ①②③④⑤
 * - Parenthesized: (1)(2)(3)
 * - Plain: 1. 2. 3.
 * - Letters: A B C
 * - Optional arrow/leader line pointing to target
 *
 * @module MarkerRenderer
 * @since 1.5.4
 */
( function () {
	'use strict';

	/**
	 * Marker style constants
	 * @constant {Object}
	 */
	const MARKER_STYLES = {
		CIRCLED: 'circled',
		PARENTHESES: 'parentheses',
		PLAIN: 'plain',
		LETTER: 'letter',
		LETTER_CIRCLED: 'letter-circled'
	};

	/**
	 * Default marker configuration
	 * @constant {Object}
	 */
	const DEFAULTS = {
		size: 24,
		fontSizeAdjust: 0,
		fill: '#ffffff',
		stroke: '#000000',
		strokeWidth: 2,
		color: '#000000',
		arrowStyle: 'arrow',
		style: MARKER_STYLES.CIRCLED
	};

	/**
	 * MarkerRenderer class - Renders number sequence markers on canvas
	 */
	class MarkerRenderer {
		/**
		 * Creates a new MarkerRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shadowRenderer] - ShadowRenderer instance for shadow operations
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
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
		 * Set the shadow renderer
		 *
		 * @param {Object} shadowRenderer - ShadowRenderer instance
		 */
		setShadowRenderer( shadowRenderer ) {
			this.shadowRenderer = shadowRenderer;
		}

		/**
		 * Convert value to display text based on style
		 *
		 * @param {number|string} value - Value (numeric or custom text)
		 * @param {string} style - Marker style
		 * @return {string} Formatted display value
		 */
		formatValue( value, style ) {
			// If value is a string (custom value), use it directly
			// unless it's a pure number string
			if ( typeof value === 'string' && !/^\d+$/.test( value ) ) {
				// Custom text value - apply minimal formatting based on style
				switch ( style ) {
					case MARKER_STYLES.PARENTHESES:
						return '(' + value + ')';
					case MARKER_STYLES.PLAIN:
						return value + '.';
					default:
						return value;
				}
			}

			const num = parseInt( value, 10 ) || 1;

			switch ( style ) {
				case MARKER_STYLES.LETTER:
				case MARKER_STYLES.LETTER_CIRCLED: {
					// Convert 1-26 to A-Z, then AA, AB, etc.
					if ( num <= 26 ) {
						return String.fromCharCode( 64 + num );
					}
					// For values > 26, use AA, AB, etc.
					const first = Math.floor( ( num - 1 ) / 26 );
					const second = ( ( num - 1 ) % 26 ) + 1;
					return String.fromCharCode( 64 + first ) + String.fromCharCode( 64 + second );
				}

				case MARKER_STYLES.PARENTHESES:
					return '(' + num + ')';

				case MARKER_STYLES.PLAIN:
					return num + '.';

				case MARKER_STYLES.CIRCLED:
				default:
					return String( num );
			}
		}

		/**
		 * Draw a marker layer
		 *
		 * @param {Object} layer - Marker layer object
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.shadowScale] - Scale factors for shadow rendering
		 */
		draw( layer, options ) {
			if ( !this.ctx || !layer ) {
				return;
			}

			const opts = options || {};
			const ctx = this.ctx;
			const x = layer.x || 0;
			const y = layer.y || 0;
			const size = layer.size || DEFAULTS.size;
			const radius = size / 2;
			const value = layer.value !== undefined ? layer.value : 1;
			const style = layer.style || DEFAULTS.style;
			const fill = layer.fill || DEFAULTS.fill;
			const stroke = layer.stroke || DEFAULTS.stroke;
			const strokeWidth = layer.strokeWidth || DEFAULTS.strokeWidth;
			const color = layer.color || DEFAULTS.color;
			// Calculate font size: base is 58% of marker size, adjusted by fontSizeAdjust
			const fontSizeAdjust = layer.fontSizeAdjust || 0;
			const baseFontSize = Math.round( size * 0.58 );
			const fontSize = Math.max( 6, baseFontSize + fontSizeAdjust );
			const fontFamily = layer.fontFamily || 'Arial, sans-serif';
			const fontWeight = layer.fontWeight || 'bold';

			ctx.save();

			// Apply rotation if specified
			if ( layer.rotation ) {
				ctx.translate( x, y );
				ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
				ctx.translate( -x, -y );
			}

			// Apply opacity
			const baseOpacity = typeof layer.opacity === 'number' ?
				Math.max( 0, Math.min( 1, layer.opacity ) ) : 1;
			ctx.globalAlpha = baseOpacity;

			// Check for shadow with spread support
			const hasShadow = this.shadowRenderer &&
				this.shadowRenderer.hasShadowEnabled( layer );
			// Use shadowScale from options for proper scaling on article pages
			const shadowScale = opts.shadowScale || { sx: 1, sy: 1, avg: 1 };
			const spread = hasShadow && this.shadowRenderer.getShadowSpread ?
				this.shadowRenderer.getShadowSpread( layer, shadowScale ) : 0;

			// Draw marker circle/shape
			const needsCircle = style === MARKER_STYLES.CIRCLED ||
				style === MARKER_STYLES.LETTER_CIRCLED;
			const hasArrow = layer.hasArrow && layer.arrowX !== undefined && layer.arrowY !== undefined;

			// Draw shadow for marker using offscreen canvas
			// Pattern: draw fill shadow, then stroke shadow (if applicable) separately
			if ( hasShadow && this.shadowRenderer.drawSpreadShadow ) {
				const hasFill = fill && fill !== 'none' && fill !== 'transparent';
				const hasStroke = stroke && stroke !== 'none' && strokeWidth > 0;
				const expandedRadius = radius + spread;

				// Draw fill shadow for circle (including visual area under stroke)
				if ( needsCircle && ( hasFill || hasStroke ) ) {
					// For shadow, include the full visual area (fill + half stroke width)
					const fillShadowRadius = expandedRadius + ( hasStroke ? strokeWidth / 2 : 0 );
					this.shadowRenderer.drawSpreadShadow( layer, shadowScale, spread, ( tempCtx ) => {
						tempCtx.beginPath();
						tempCtx.arc( x, y, fillShadowRadius, 0, Math.PI * 2 );
						// Note: do NOT call fill() here - drawSpreadShadow handles it
					}, baseOpacity );
				}

				// Draw arrow shadow (stroked shape with round caps)
				if ( hasArrow ) {
					const effectiveStrokeWidth = strokeWidth + ( spread > 0 ? spread * 2 : 0 );
					this.shadowRenderer.drawSpreadShadowStroke( layer, shadowScale, effectiveStrokeWidth, ( tempCtx ) => {
						this._drawArrowPathOnly( tempCtx, layer, x, y, radius );
					}, baseOpacity );
				}
			} else if ( hasShadow && !needsCircle ) {
				// For non-circled markers (text only), use simple shadow
				this.shadowRenderer.applyShadow( layer, shadowScale );
			}

			// Draw arrow/leader line first (behind marker) - NO shadow here
			if ( hasArrow ) {
				this._drawArrow( layer, x, y, radius );
			}

			if ( needsCircle ) {
				// Draw filled circle (shadow already handled above)
				ctx.beginPath();
				ctx.arc( x, y, radius, 0, Math.PI * 2 );

				if ( fill && fill !== 'none' && fill !== 'transparent' ) {
					ctx.fillStyle = fill;
					ctx.fill();
				}

				if ( stroke && stroke !== 'none' && strokeWidth > 0 ) {
					ctx.strokeStyle = stroke;
					ctx.lineWidth = strokeWidth;
					ctx.stroke();
				}
			}

			// Draw the text value
			const displayValue = this.formatValue( value, style );
			ctx.font = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = color;

			// Apply text stroke if specified
			if ( layer.textStrokeWidth && layer.textStrokeWidth > 0 ) {
				ctx.strokeStyle = layer.textStrokeColor || '#ffffff';
				ctx.lineWidth = layer.textStrokeWidth;
				ctx.lineJoin = 'round';
				ctx.strokeText( displayValue, x, y );
			}

			ctx.fillText( displayValue, x, y );

			// Clear shadow
			if ( hasShadow ) {
				this.shadowRenderer.clearShadow();
			}

			ctx.restore();
		}

		/**
		 * Draw the arrow/leader line from marker to target point
		 *
		 * @param {Object} layer - Marker layer
		 * @param {number} markerX - Marker center X
		 * @param {number} markerY - Marker center Y
		 * @param {number} radius - Marker radius
		 * @private
		 */
		_drawArrow( layer, markerX, markerY, radius ) {
			const ctx = this.ctx;
			const targetX = layer.arrowX;
			const targetY = layer.arrowY;
			const arrowStyle = layer.arrowStyle || DEFAULTS.arrowStyle;
			const stroke = layer.stroke || DEFAULTS.stroke;
			const strokeWidth = layer.strokeWidth || DEFAULTS.strokeWidth;

			// Calculate angle from marker to target
			const dx = targetX - markerX;
			const dy = targetY - markerY;
			const angle = Math.atan2( dy, dx );
			const distance = Math.sqrt( dx * dx + dy * dy );

			// Start point is on the edge of the marker circle
			const startX = markerX + Math.cos( angle ) * radius;
			const startY = markerY + Math.sin( angle ) * radius;

			// Arrow size scales with marker size (40% of diameter, clamped 8-20)
			const size = radius * 2;
			const arrowLength = Math.max( 8, Math.min( 20, size * 0.4 ) );
			const endX = targetX;
			const endY = targetY;

			ctx.save();
			ctx.strokeStyle = stroke;
			ctx.lineWidth = strokeWidth;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			// Draw line
			ctx.beginPath();
			ctx.moveTo( startX, startY );
			ctx.lineTo( endX, endY );
			ctx.stroke();

			// Draw arrowhead at target end
			if ( arrowStyle === 'arrow' && distance > radius + arrowLength ) {
				const arrowAngle = Math.PI / 6; // 30 degrees

				ctx.beginPath();
				ctx.moveTo( endX, endY );
				ctx.lineTo(
					endX - arrowLength * Math.cos( angle - arrowAngle ),
					endY - arrowLength * Math.sin( angle - arrowAngle )
				);
				ctx.moveTo( endX, endY );
				ctx.lineTo(
					endX - arrowLength * Math.cos( angle + arrowAngle ),
					endY - arrowLength * Math.sin( angle + arrowAngle )
				);
				ctx.stroke();
			} else if ( arrowStyle === 'dot' ) {
				// Draw a small dot at target
				ctx.beginPath();
				ctx.arc( endX, endY, 3, 0, Math.PI * 2 );
				ctx.fillStyle = stroke;
				ctx.fill();
			}

			ctx.restore();
		}

		/**
		 * Draw arrow path only (no stroke) for shadow rendering with drawSpreadShadowStroke
		 *
		 * This defines the arrow path using the same geometry as _drawArrow.
		 * The caller (drawSpreadShadowStroke) will handle the actual stroke.
		 *
		 * @param {CanvasRenderingContext2D} tempCtx - Temp context for shadow
		 * @param {Object} layer - Marker layer
		 * @param {number} markerX - Marker center X
		 * @param {number} markerY - Marker center Y
		 * @param {number} radius - Marker radius
		 * @private
		 */
		_drawArrowPathOnly( tempCtx, layer, markerX, markerY, radius ) {
			const targetX = layer.arrowX;
			const targetY = layer.arrowY;
			const arrowStyle = layer.arrowStyle || DEFAULTS.arrowStyle;

			// Calculate angle from marker to target
			const dx = targetX - markerX;
			const dy = targetY - markerY;
			const angle = Math.atan2( dy, dx );
			const distance = Math.sqrt( dx * dx + dy * dy );

			// Start point is on the edge of the marker circle
			const startX = markerX + Math.cos( angle ) * radius;
			const startY = markerY + Math.sin( angle ) * radius;

			// Arrow size scales with marker size
			const size = radius * 2;
			const arrowLength = Math.max( 8, Math.min( 20, size * 0.4 ) );

			// Set round caps/joins to match actual arrow rendering
			tempCtx.lineCap = 'round';
			tempCtx.lineJoin = 'round';

			// Define the main arrow line path
			tempCtx.beginPath();
			tempCtx.moveTo( startX, startY );
			tempCtx.lineTo( targetX, targetY );
			// Note: do NOT stroke here - drawSpreadShadowStroke handles it

			// Define arrowhead path
			if ( arrowStyle === 'arrow' && distance > radius + arrowLength ) {
				const arrowAngle = Math.PI / 6; // 30 degrees

				// Continue the path with arrowhead lines
				tempCtx.moveTo( targetX, targetY );
				tempCtx.lineTo(
					targetX - arrowLength * Math.cos( angle - arrowAngle ),
					targetY - arrowLength * Math.sin( angle - arrowAngle )
				);
				tempCtx.moveTo( targetX, targetY );
				tempCtx.lineTo(
					targetX - arrowLength * Math.cos( angle + arrowAngle ),
					targetY - arrowLength * Math.sin( angle + arrowAngle )
				);
			}
			// Note: dot style uses fill, which would need separate handling
		}

		/**
		 * Get the bounding box for a marker layer
		 *
		 * @param {Object} layer - Marker layer
		 * @return {Object} Bounding box {x, y, width, height}
		 */
		getBounds( layer ) {
			const x = layer.x || 0;
			const y = layer.y || 0;
			const size = layer.size || DEFAULTS.size;
			const radius = size / 2;
			const strokeWidth = layer.strokeWidth || DEFAULTS.strokeWidth;

			let minX = x - radius - strokeWidth;
			let minY = y - radius - strokeWidth;
			let maxX = x + radius + strokeWidth;
			let maxY = y + radius + strokeWidth;

			// Include arrow target in bounds
			if ( layer.hasArrow && layer.arrowX !== undefined && layer.arrowY !== undefined ) {
				minX = Math.min( minX, layer.arrowX - 5 );
				minY = Math.min( minY, layer.arrowY - 5 );
				maxX = Math.max( maxX, layer.arrowX + 5 );
				maxY = Math.max( maxY, layer.arrowY + 5 );
			}

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Hit test for marker layer
		 *
		 * @param {Object} layer - Marker layer
		 * @param {number} px - Test point X
		 * @param {number} py - Test point Y
		 * @return {boolean} True if point is within marker
		 */
		hitTest( layer, px, py ) {
			const x = layer.x || 0;
			const y = layer.y || 0;
			const size = layer.size || DEFAULTS.size;
			const radius = size / 2;

			// Check if point is within marker circle
			const dx = px - x;
			const dy = py - y;
			const distance = Math.sqrt( dx * dx + dy * dy );

			if ( distance <= radius + 5 ) {
				return true;
			}

			// Check if point is near the arrow line
			if ( layer.hasArrow && layer.arrowX !== undefined && layer.arrowY !== undefined ) {
				const arrowDist = this._pointToLineDistance(
					px, py,
					x, y,
					layer.arrowX, layer.arrowY
				);
				if ( arrowDist <= 8 ) {
					return true;
				}
			}

			return false;
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
				// Line is a point
				return Math.sqrt( ( px - x1 ) * ( px - x1 ) + ( py - y1 ) * ( py - y1 ) );
			}

			// Project point onto line
			let t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / lengthSq;
			t = Math.max( 0, Math.min( 1, t ) );

			const projX = x1 + t * dx;
			const projY = y1 + t * dy;

			return Math.sqrt( ( px - projX ) * ( px - projX ) + ( py - projY ) * ( py - projY ) );
		}

		/**
		 * Get the next marker value based on existing markers
		 *
		 * @param {Array} layers - Array of all layers
		 * @param {string} [style] - Marker style to match
		 * @return {number} Next value to use
		 */
		static getNextValue( layers, style ) {
			if ( !layers || !Array.isArray( layers ) ) {
				return 1;
			}

			let maxValue = 0;

			for ( const layer of layers ) {
				if ( layer.type === 'marker' ) {
					// If style specified, only count matching style
					if ( style && layer.style !== style ) {
						continue;
					}
					const val = parseInt( layer.value, 10 ) || 0;
					if ( val > maxValue ) {
						maxValue = val;
					}
				}
			}

			return maxValue + 1;
		}

		/**
		 * Create a default marker layer object
		 *
		 * @param {number} x - Center X position
		 * @param {number} y - Center Y position
		 * @param {Object} [options] - Additional options
		 * @return {Object} Marker layer object
		 */
		static createMarkerLayer( x, y, options ) {
			options = options || {};

			// Use custom text value if provided, otherwise numeric value
			const numericValue = options.value || 1;
			const displayValue = options.customValue || numericValue;

			return {
				id: options.id || 'marker-' + Date.now(),
				type: 'marker',
				x: x,
				y: y,
				value: displayValue,
				style: options.style || DEFAULTS.style,
				size: options.size || DEFAULTS.size,
				fontSizeAdjust: options.fontSizeAdjust !== undefined ? options.fontSizeAdjust : DEFAULTS.fontSizeAdjust,
				fontFamily: options.fontFamily || 'Arial, sans-serif',
				fontWeight: options.fontWeight || 'bold',
				fill: options.fill || DEFAULTS.fill,
				stroke: options.stroke || DEFAULTS.stroke,
				strokeWidth: options.strokeWidth || DEFAULTS.strokeWidth,
				color: options.color || DEFAULTS.color,
				hasArrow: options.hasArrow || false,
				arrowX: options.arrowX,
				arrowY: options.arrowY,
				arrowStyle: options.arrowStyle || DEFAULTS.arrowStyle,
				visible: options.visible !== false,
				locked: options.locked || false,
				opacity: options.opacity !== undefined ? options.opacity : 1,
				name: options.name || 'Marker ' + displayValue
			};
		}

		/**
		 * Get available marker styles
		 *
		 * @return {Object} Marker style constants
		 */
		static get STYLES() {
			return MARKER_STYLES;
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
		window.Layers.MarkerRenderer = MarkerRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = MarkerRenderer;
	}

} )();
