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
			// Strip only dangerous HTML tags; preserve standalone < and >
			// for math expressions (Canvas2D renders text literally)
			safeText = safeText.replace( /<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|button|select|link|meta|base)\b[^>]*>/gi, '' );
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
		 * @return {Object|null} Text metrics object or null if invalid
		 */
		static measureTextLayer( layer, ctx ) {
			if ( !layer ) {
				return null;
			}

			const fontSize = layer.fontSize || 16;
			const fontFamily = layer.fontFamily || 'Arial';
			// Plain text is painted literally on one line by TextRenderer. Measure
			// the same string rather than wrapping or stripping visible characters.
			const text = layer.text || '';
			const lineHeight = fontSize * 1.2;

			// Fallback for headless/test environments without context
			if ( !ctx ) {
				return {
					lines: [ text ],
					fontSize: fontSize,
					fontFamily: fontFamily,
					lineHeight: lineHeight,
					width: Math.max( text.length * fontSize * 0.6, fontSize ),
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
			const lines = [ text ];
			const metricsForLongest = ctx.measureText( text || ' ' );
			const totalTextWidth = metricsForLongest.width;

			ctx.restore();

			const ascent = metricsForLongest &&
				typeof metricsForLongest.actualBoundingBoxAscent === 'number' ?
				metricsForLongest.actualBoundingBoxAscent : fontSize * 0.8;
			const descent = metricsForLongest &&
				typeof metricsForLongest.actualBoundingBoxDescent === 'number' ?
				metricsForLongest.actualBoundingBoxDescent : fontSize * 0.2;
			const totalHeight = ascent + descent;

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

			let originX = ( layer.x || 0 ) - alignOffset;
			let originY = ( layer.y || 0 ) - ascent;

			// TextRenderer rotates about the baseline-derived text center, which
			// is not necessarily the center of the glyph bounds. Move the bounds
			// to the same rotated center before selection handles rotate them.
			if ( layer.rotation ) {
				const pivotX = textAlign === 'center' ? ( layer.x || 0 ) :
					( layer.x || 0 ) + ( textAlign === 'right' ? -totalTextWidth / 2 : totalTextWidth / 2 );
				const pivotY = ( layer.y || 0 ) - fontSize / 4;
				const dx = originX + totalTextWidth / 2 - pivotX;
				const dy = originY + totalHeight / 2 - pivotY;
				const radians = layer.rotation * Math.PI / 180;
				originX += ( Math.cos( radians ) - 1 ) * dx - Math.sin( radians ) * dy;
				originY += Math.sin( radians ) * dx + ( Math.cos( radians ) - 1 ) * dy;
			}

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
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = TextUtils;
	}

}() );
