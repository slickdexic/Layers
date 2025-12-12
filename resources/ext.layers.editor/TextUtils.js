/**
 * TextUtils.js - Text measurement and sanitization utilities
 *
 * Provides shared text handling functions used by CanvasManager and CanvasRenderer.
 * Consolidates duplicate implementations to ensure consistent behavior.
 *
 * Part of the MediaWiki Layers extension modularization effort.
 *
 * @module TextUtils
 */

( function () {
	'use strict';

	/**
	 * Static utility class for text operations
	 * @class TextUtils
	 */
	class TextUtils {
		/**
		 * Sanitize text content by removing control characters and HTML tags
		 *
		 * @param {string} text - The text to sanitize
		 * @return {string} Sanitized text
		 */
		static sanitizeTextContent( text ) {
			let safeText = text == null ? '' : String( text );
			// Remove control characters but keep printable ASCII and extended Unicode
			safeText = safeText.replace( /[^\x20-\x7E\u00A0-\uFFFF]/g, '' );
			// Strip HTML tags
			safeText = safeText.replace( /<[^>]+>/g, '' );
			return safeText;
		}

		/**
		 * Wrap text into multiple lines based on maximum width
		 *
		 * @param {string} text - The text to wrap
		 * @param {number} maxWidth - Maximum width in pixels
		 * @param {CanvasRenderingContext2D} ctx - Canvas context for measuring text
		 * @return {Array<string>} Array of text lines
		 */
		static wrapText( text, maxWidth, ctx ) {
			if ( !text || !maxWidth || maxWidth <= 0 ) {
				return [ text || '' ];
			}

			const words = text.split( ' ' );
			const lines = [];
			let currentLine = '';

			for ( let i = 0; i < words.length; i++ ) {
				const word = words[ i ];
				const testLine = currentLine + ( currentLine ? ' ' : '' ) + word;
				const metrics = ctx.measureText( testLine );
				const testWidth = metrics.width;

				if ( testWidth > maxWidth && currentLine !== '' ) {
					// Current line is full, start a new line
					lines.push( currentLine );
					currentLine = word;
				} else {
					currentLine = testLine;
				}
			}

			// Add the last line
			if ( currentLine ) {
				lines.push( currentLine );
			}

			return lines.length > 0 ? lines : [ '' ];
		}

		/**
		 * Measure a text layer to get dimensions and positioning info
		 *
		 * @param {Object} layer - The text layer object
		 * @param {CanvasRenderingContext2D} ctx - Canvas context for measuring
		 * @param {number} canvasWidth - Canvas width for max line width calculation
		 * @return {Object|null} Text metrics object or null if invalid
		 */
		static measureTextLayer( layer, ctx, canvasWidth ) {
			if ( !layer ) {
				return null;
			}

			const fontSize = layer.fontSize || 16;
			const fontFamily = layer.fontFamily || 'Arial';
			const sanitizedText = TextUtils.sanitizeTextContent( layer.text || '' );
			const lineHeight = fontSize * 1.2;
			const maxLineWidth = layer.maxWidth ||
				( canvasWidth ? canvasWidth * 0.8 : fontSize * Math.max( sanitizedText.length, 1 ) );

			// Fallback for headless/test environments without context
			if ( !ctx ) {
				return {
					lines: [ sanitizedText ],
					fontSize: fontSize,
					fontFamily: fontFamily,
					lineHeight: lineHeight,
					width: Math.max( sanitizedText.length * fontSize * 0.6, fontSize ),
					height: lineHeight,
					originX: layer.x || 0,
					originY: ( layer.y || 0 ) - fontSize,
					ascent: fontSize * 0.8,
					descent: fontSize * 0.2,
					baselineY: layer.y || 0,
					alignOffset: 0
				};
			}

			ctx.save();
			ctx.font = fontSize + 'px ' + fontFamily;
			let lines = TextUtils.wrapText( sanitizedText, maxLineWidth, ctx );
			if ( !lines.length ) {
				lines = [ '' ];
			}

			let totalTextWidth = 0;
			let metricsForLongest = null;
			for ( let i = 0; i < lines.length; i++ ) {
				const lineMetrics = ctx.measureText( lines[ i ] || ' ' );
				if ( lineMetrics.width > totalTextWidth ) {
					totalTextWidth = lineMetrics.width;
					metricsForLongest = lineMetrics;
				}
			}
			if ( totalTextWidth === 0 ) {
				const fallbackMetrics = ctx.measureText( sanitizedText || ' ' );
				totalTextWidth = fallbackMetrics.width;
				metricsForLongest = fallbackMetrics;
			}

			ctx.restore();

			const ascent = metricsForLongest &&
				typeof metricsForLongest.actualBoundingBoxAscent === 'number' ?
				metricsForLongest.actualBoundingBoxAscent : fontSize * 0.8;
			const descent = metricsForLongest &&
				typeof metricsForLongest.actualBoundingBoxDescent === 'number' ?
				metricsForLongest.actualBoundingBoxDescent : fontSize * 0.2;
			let totalHeight = ascent + descent;
			if ( lines.length > 1 ) {
				totalHeight = ascent + descent + ( lines.length - 1 ) * lineHeight;
			}

			const textAlign = layer.textAlign || 'left';
			let alignOffset = 0;
			switch ( textAlign ) {
				case 'center':
					alignOffset = totalTextWidth / 2;
					break;
				case 'right':
				case 'end':
					alignOffset = totalTextWidth;
					break;
				default:
					alignOffset = 0;
			}

			const originX = ( layer.x || 0 ) - alignOffset;
			const originY = ( layer.y || 0 ) - ascent;

			return {
				lines: lines,
				fontSize: fontSize,
				fontFamily: fontFamily,
				lineHeight: lineHeight,
				width: totalTextWidth,
				height: totalHeight,
				originX: originX,
				originY: originY,
				ascent: ascent,
				descent: descent,
				baselineY: layer.y || 0,
				alignOffset: alignOffset
			};
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.Text = TextUtils;

		// DEPRECATED: Direct window export - use window.Layers.Utils.Text instead
		// This will be removed in a future version
		window.TextUtils = TextUtils;
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TextUtils;
	}

}() );
