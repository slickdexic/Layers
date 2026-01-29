/**
 * RichTextUtils - Pure utility functions for rich text processing
 *
 * Extracted from TextBoxRenderer.js to reduce file size and improve reusability.
 * This module provides stateless utility functions for rich text operations:
 * - Rich text validation and detection
 * - Plain text extraction
 * - Character-to-run mapping
 * - Line metrics calculation
 *
 * @module RichTextUtils
 * @since 1.5.39
 */
( function () {
	'use strict';

	/**
	 * RichTextUtils class - Stateless utility functions for rich text
	 */
	class RichTextUtils {
		/**
		 * Check if layer has valid rich text content
		 *
		 * @param {Object} layer - Layer object
		 * @return {boolean} True if layer has rich text
		 */
		static hasRichText( layer ) {
			return Array.isArray( layer.richText ) &&
				layer.richText.length > 0 &&
				layer.richText.some( ( run ) => run && typeof run.text === 'string' );
		}

		/**
		 * Get plain text from rich text array for wrapping calculations
		 *
		 * @param {Array} richText - Rich text runs array
		 * @return {string} Combined plain text
		 */
		static getRichTextPlainText( richText ) {
			if ( !Array.isArray( richText ) ) {
				return '';
			}
			return richText
				.filter( ( run ) => run && typeof run.text === 'string' )
				.map( ( run ) => run.text )
				.join( '' );
		}

		/**
		 * Build a map of character positions to runs for efficient lookup
		 *
		 * @param {Array} richText - Rich text runs array
		 * @return {Array} Array where index is char position, value is {runIndex, localIndex}
		 */
		static buildCharToRunMap( richText ) {
			const map = [];
			let charPos = 0;

			for ( let runIndex = 0; runIndex < richText.length; runIndex++ ) {
				const run = richText[ runIndex ];
				if ( !run || typeof run.text !== 'string' ) {
					continue;
				}

				for ( let localIndex = 0; localIndex < run.text.length; localIndex++ ) {
					map[ charPos ] = { runIndex, localIndex };
					charPos++;
				}
			}

			return map;
		}

		/**
		 * Find the maximum font size used in a specific line range
		 *
		 * @param {Array} richText - Rich text runs array
		 * @param {number} lineStart - Starting character index
		 * @param {number} lineEnd - Ending character index
		 * @param {number} baseFontSize - Base font size (scaled)
		 * @param {Object} scale - Scale factors { avg }
		 * @return {number} Maximum font size in pixels
		 */
		static findMaxFontSizeForLine( richText, lineStart, lineEnd, baseFontSize, scale ) {
			let maxFontSize = baseFontSize;
			let charPos = 0;

			for ( const run of richText ) {
				if ( !run || typeof run.text !== 'string' ) {
					continue;
				}

				const runStart = charPos;
				const runEnd = charPos + run.text.length;
				charPos = runEnd;

				// Check if this run overlaps with the current line
				if ( runEnd <= lineStart || runStart >= lineEnd ) {
					continue;
				}

				// This run is on this line - check its font size
				const runFontSize = ( ( run.style && run.style.fontSize ) || ( baseFontSize / scale.avg ) ) * scale.avg;
				if ( runFontSize > maxFontSize ) {
					maxFontSize = runFontSize;
				}
			}

			return maxFontSize;
		}

		/**
		 * Calculate line metrics for all wrapped lines
		 *
		 * @param {Array} lines - Array of wrapped line strings
		 * @param {Array} richText - Rich text runs array
		 * @param {string} plainText - Full plain text
		 * @param {number} baseFontSize - Base font size (scaled)
		 * @param {number} lineHeightMultiplier - Line height multiplier
		 * @param {Object} scale - Scale factors { avg }
		 * @return {Array} Array of line metrics { text, start, end, maxFontSize, lineHeight }
		 */
		static calculateLineMetrics( lines, richText, plainText, baseFontSize, lineHeightMultiplier, scale ) {
			const lineMetrics = [];
			let charPos = 0;

			for ( let i = 0; i < lines.length; i++ ) {
				const lineText = lines[ i ];
				const lineStart = charPos;
				const lineEnd = charPos + lineText.length;

				// Find the maximum font size used in this line
				const maxFontSize = this.findMaxFontSizeForLine( richText, lineStart, lineEnd, baseFontSize, scale );

				// Line height based on the tallest text in this line
				const lineHeight = maxFontSize * lineHeightMultiplier;

				lineMetrics.push( {
					text: lineText,
					start: lineStart,
					end: lineEnd,
					maxFontSize: maxFontSize,
					lineHeight: lineHeight
				} );

				charPos = lineEnd;

				// Account for whitespace between lines
				if ( i < lines.length - 1 ) {
					const nextChar = plainText[ charPos ];
					if ( nextChar === ' ' || nextChar === '\n' ) {
						charPos++;
					}
				}
			}

			return lineMetrics;
		}

		/**
		 * Calculate total text height from line metrics
		 *
		 * @param {Array} lineMetrics - Array of line metrics
		 * @return {number} Total height in pixels
		 */
		static calculateTotalTextHeight( lineMetrics ) {
			return lineMetrics.reduce( ( sum, lm ) => sum + lm.lineHeight, 0 );
		}

		/**
		 * Calculate starting Y position based on vertical alignment
		 *
		 * @param {string} verticalAlign - 'top', 'middle', or 'bottom'
		 * @param {number} boxY - Box Y position
		 * @param {number} padding - Padding in pixels
		 * @param {number} availableHeight - Available height for text
		 * @param {number} totalTextHeight - Total height of text
		 * @return {number} Starting Y position
		 */
		static calculateTextStartY( verticalAlign, boxY, padding, availableHeight, totalTextHeight ) {
			switch ( verticalAlign ) {
				case 'middle':
					return boxY + padding + ( availableHeight - totalTextHeight ) / 2;
				case 'bottom':
					return boxY + padding + availableHeight - totalTextHeight;
				case 'top':
				default:
					return boxY + padding;
			}
		}

		/**
		 * Calculate line X position based on text alignment
		 *
		 * @param {string} textAlign - 'left', 'center', or 'right'
		 * @param {number} boxX - Box X position
		 * @param {number} boxWidth - Box width
		 * @param {number} lineWidth - Width of the line
		 * @param {number} padding - Padding in pixels
		 * @return {number} Line X position
		 */
		static calculateLineX( textAlign, boxX, boxWidth, lineWidth, padding ) {
			switch ( textAlign ) {
				case 'center':
					return boxX + ( boxWidth - lineWidth ) / 2;
				case 'right':
					return boxX + boxWidth - padding - lineWidth;
				case 'left':
				default:
					return boxX + padding;
			}
		}

		/**
		 * Build text style object from layer properties
		 *
		 * @param {Object} layer - Layer with text style properties
		 * @param {Object} shadowScale - Shadow scale factors
		 * @param {Object} scale - Scale factors
		 * @return {Object} Text style object
		 */
		static buildTextStyle( layer, shadowScale, scale ) {
			const hasTextShadow = layer.textShadow === true ||
				layer.textShadow === 'true' ||
				layer.textShadow === 1 ||
				layer.textShadow === '1';

			return {
				hasTextShadow,
				textShadowColor: layer.textShadowColor || 'rgba(0,0,0,0.5)',
				textShadowBlur: ( typeof layer.textShadowBlur === 'number' ? layer.textShadowBlur : 4 ) * shadowScale.avg,
				textShadowOffsetX: ( typeof layer.textShadowOffsetX === 'number' ? layer.textShadowOffsetX : 2 ) * shadowScale.avg,
				textShadowOffsetY: ( typeof layer.textShadowOffsetY === 'number' ? layer.textShadowOffsetY : 2 ) * shadowScale.avg,
				hasTextStroke: ( layer.textStrokeWidth || 0 ) > 0,
				textStrokeColor: layer.textStrokeColor || '#000000',
				textStrokeWidth: ( layer.textStrokeWidth || 0 ) * scale.avg
			};
		}

		/**
		 * Build base style object from layer properties
		 *
		 * @param {Object} layer - Layer with text properties
		 * @return {Object} Base style object
		 */
		static buildBaseStyle( layer ) {
			return {
				fontSize: layer.fontSize || 16,
				fontFamily: layer.fontFamily || 'Arial, sans-serif',
				fontWeight: layer.fontWeight || 'normal',
				fontStyle: layer.fontStyle || 'normal',
				color: layer.color || '#000000'
			};
		}
	}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.RichTextUtils = RichTextUtils;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = RichTextUtils;
	}

}() );
