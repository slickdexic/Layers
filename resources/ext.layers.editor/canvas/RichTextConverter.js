/**
 * RichTextConverter - Utility class for converting between richText arrays and HTML
 *
 * This module handles the bidirectional conversion between the richText data model
 * (array of {text, style} objects) and HTML strings used in contentEditable elements.
 *
 * Extracted from InlineTextEditor.js as part of the God Class Reduction Initiative.
 *
 * @since 1.5.39
 * @class
 */
( function () {
	'use strict';

	/**
	 * RichTextConverter class
	 *
	 * Provides static methods for rich text ↔ HTML conversion with support for:
	 * - Font styles (weight, style, size, family)
	 * - Text decoration (underline, line-through)
	 * - Colors (text and background/highlight)
	 * - Text stroke effects
	 * - Semantic HTML tags (b, i, u, s, etc.)
	 * - Legacy font tags from execCommand
	 *
	 * @class
	 */
	class RichTextConverter {

		/**
		 * Escape HTML special characters
		 *
		 * @static
		 * @param {string} text - Plain text to escape
		 * @return {string} HTML-escaped text
		 */
		static escapeHtml( text ) {
			const div = document.createElement( 'div' );
			div.textContent = text;
			return div.innerHTML;
		}

		/**
		 * Sanitize a CSS property value by removing characters that could
		 * break out of style attributes. Defense-in-depth: the server also
		 * sanitizes fontFamily via sanitizeIdentifier() (P2-044).
		 *
		 * @static
		 * @param {string} value - CSS value to sanitize
		 * @return {string} Safe CSS value
		 */
		static escapeCSSValue( value ) {
			return String( value ).replace( /["'<>&;{}()\\]/g, '' );
		}

		/**
		 * Convert richText array to HTML string for contentEditable
		 *
		 * @static
		 * @param {Array} richText - Array of {text, style} objects
		 * @param {number} [displayScale=1] - Scale factor for font sizes
		 * @return {string} HTML string
		 */
		static richTextToHtml( richText, displayScale = 1 ) {
			if ( !Array.isArray( richText ) || richText.length === 0 ) {
				return '';
			}

			// Ensure displayScale is valid
			const scale = ( displayScale && displayScale > 0 ) ? displayScale : 1;

			let html = '';
			for ( const run of richText ) {
				const text = run.text || '';
				const style = run.style || {};

				// Escape the text content
				let escapedText = RichTextConverter.escapeHtml( text );
				// Convert newlines to <br>
				escapedText = escapedText.replace( /\n/g, '<br>' );

				// Build inline style string
				const styleProps = [];
				// Track data attributes for unscaled values
				const dataAttrs = [];
				const esc = RichTextConverter.escapeCSSValue;

				if ( style.fontWeight && style.fontWeight !== 'normal' ) {
					styleProps.push( `font-weight: ${ esc( style.fontWeight ) }` );
				}
				if ( style.fontStyle && style.fontStyle !== 'normal' ) {
					styleProps.push( `font-style: ${ esc( style.fontStyle ) }` );
				}
				if ( style.fontSize ) {
					// Scale for display, store unscaled in data attribute
					const scaledSize = style.fontSize * scale;
					// Use !important to override container font-size
					styleProps.push( `font-size: ${ scaledSize }px !important` );
					dataAttrs.push( `data-font-size="${ style.fontSize }"` );
				}
				if ( style.fontFamily ) {
					styleProps.push( `font-family: ${ esc( style.fontFamily ) }` );
				}
				if ( style.color ) {
					styleProps.push( `color: ${ esc( style.color ) }` );
				}
				if ( style.textDecoration && style.textDecoration !== 'none' ) {
					styleProps.push( `text-decoration: ${ esc( style.textDecoration ) }` );
				}
				if ( style.backgroundColor ) {
					styleProps.push( `background-color: ${ esc( style.backgroundColor ) }` );
				}
				if ( style.textStrokeWidth && style.textStrokeColor ) {
					styleProps.push(
						`-webkit-text-stroke: ${ style.textStrokeWidth }px ${ esc( style.textStrokeColor ) }`
					);
				}

				// Wrap in span if has styles or data attrs, otherwise just add text
				if ( styleProps.length > 0 || dataAttrs.length > 0 ) {
					const styleAttr = styleProps.length > 0 ?
						`style="${ styleProps.join( '; ' ) }"` : '';
					const dataAttrStr = dataAttrs.join( ' ' );
					html += `<span ${ styleAttr } ${ dataAttrStr }>${ escapedText }</span>`;
				} else {
					html += escapedText;
				}
			}

			return html;
		}

		/**
		 * Convert HTML from contentEditable back to richText array
		 *
		 * @static
		 * @param {string} html - HTML string from contentEditable
		 * @param {number} [displayScale=1] - Scale factor to unscale font sizes
		 * @return {Array} Array of {text, style} objects
		 */
		static htmlToRichText( html, displayScale = 1 ) {
			// Use DOMParser for safer HTML parsing (avoids innerHTML)
			const doc = new DOMParser().parseFromString( html, 'text/html' );
			const container = doc.body;

			const runs = [];
			const scale = ( displayScale && displayScale > 0 ) ? displayScale : 1;

			/**
			 * Recursively extract text runs with computed styles
			 *
			 * @param {Node} node - DOM node to process
			 * @param {Object} inheritedStyle - Style inherited from parent
			 */
			const extractRuns = ( node, inheritedStyle = {} ) => {
				if ( node.nodeType === Node.TEXT_NODE ) {
					const text = node.textContent;
					if ( text ) {
						// Clone inherited style and add this run
						const runStyle = { ...inheritedStyle };
						runs.push( { text: text, style: runStyle } );
					}
					return;
				}

				if ( node.nodeType === Node.ELEMENT_NODE ) {
					// Handle <br> as newline
					if ( node.nodeName === 'BR' ) {
						runs.push( { text: '\n', style: {} } );
						return;
					}

					// Handle block elements (div, p) - add newline before if not first
					const tagName = node.nodeName;
					const isBlockElement = tagName === 'DIV' || tagName === 'P';
					if ( isBlockElement && runs.length > 0 ) {
						// Add newline before block element (unless it's the first)
						const lastRun = runs[ runs.length - 1 ];
						// Only add if the last run doesn't already end with newline
						if ( lastRun && lastRun.text && !lastRun.text.endsWith( '\n' ) ) {
							runs.push( { text: '\n', style: {} } );
						}
					}

					// Build style from this element
					const currentStyle = { ...inheritedStyle };

					// Check for data attribute (unscaled font size)
					if ( node.dataset && node.dataset.fontSize ) {
						currentStyle.fontSize = parseFloat( node.dataset.fontSize );
						// Debug logging for fontSize extraction
						if ( typeof mw !== 'undefined' && mw.config &&
							mw.config.get( 'wgLayersDebug' ) ) {
							// eslint-disable-next-line no-console
							console.log( '[RichTextConverter] fontSize from data-font-size:', {
								dataFontSize: node.dataset.fontSize,
								parsed: currentStyle.fontSize
							} );
						}
					}

					// Check for inline style
					const inlineStyle = node.style;
					if ( inlineStyle ) {
						if ( inlineStyle.fontWeight ) {
							currentStyle.fontWeight = inlineStyle.fontWeight;
						}
						if ( inlineStyle.fontStyle ) {
							currentStyle.fontStyle = inlineStyle.fontStyle;
						}
						// Only use inline style fontSize if we don't have data attribute
						if ( inlineStyle.fontSize && !currentStyle.fontSize ) {
							// Parse px value and unscale it
							const sizeMatch = inlineStyle.fontSize.match( /(\d+(?:\.\d+)?)/ );
							if ( sizeMatch ) {
								// Unscale the display value back to data model value
								const displaySize = parseFloat( sizeMatch[ 1 ] );
								currentStyle.fontSize = scale > 0 ?
									Math.round( displaySize / scale ) : displaySize;
								// Debug logging for fallback fontSize extraction (divided by scale)
								if ( typeof mw !== 'undefined' && mw.config &&
									mw.config.get( 'wgLayersDebug' ) ) {
									// eslint-disable-next-line no-console
									console.log( '[RichTextConverter] fontSize from inline style (FALLBACK):', {
										inlineStyleFontSize: inlineStyle.fontSize,
										displaySize: displaySize,
										scale: scale,
										computedFontSize: currentStyle.fontSize
									} );
								}
							}
						}
						if ( inlineStyle.fontFamily ) {
							currentStyle.fontFamily = inlineStyle.fontFamily.replace( /["']/g, '' );
						}
						if ( inlineStyle.color ) {
							currentStyle.color = inlineStyle.color;
						}
						if ( inlineStyle.textDecoration ) {
							currentStyle.textDecoration = inlineStyle.textDecoration;
						}
						if ( inlineStyle.backgroundColor ) {
							currentStyle.backgroundColor = inlineStyle.backgroundColor;
						}
						// -webkit-text-stroke parsing
						const webkitStroke = inlineStyle.getPropertyValue( '-webkit-text-stroke' );
						if ( webkitStroke ) {
							const strokeMatch = webkitStroke.match( /(\d+(?:\.\d+)?)px\s+(.+)/ );
							if ( strokeMatch ) {
								currentStyle.textStrokeWidth = parseFloat( strokeMatch[ 1 ] );
								currentStyle.textStrokeColor = strokeMatch[ 2 ].trim();
							}
						}
					}

					// Check for semantic tags
					if ( tagName === 'B' || tagName === 'STRONG' ) {
						currentStyle.fontWeight = 'bold';
					}
					if ( tagName === 'I' || tagName === 'EM' ) {
						currentStyle.fontStyle = 'italic';
					}
					if ( tagName === 'U' ) {
						currentStyle.textDecoration = 'underline';
					}
					if ( tagName === 'S' || tagName === 'STRIKE' || tagName === 'DEL' ) {
						currentStyle.textDecoration = 'line-through';
					}
					if ( tagName === 'MARK' ) {
						currentStyle.backgroundColor = currentStyle.backgroundColor || '#ffff00';
					}

					// Handle legacy <font> tag (created by execCommand)
					if ( tagName === 'FONT' ) {
						// Get color from font tag attribute
						const fontColor = node.getAttribute( 'color' );
						if ( fontColor ) {
							currentStyle.color = fontColor;
						}
						// Get size from font tag attribute (1-7 scale)
						const fontSize = node.getAttribute( 'size' );
						if ( fontSize ) {
							// Convert 1-7 scale to px (approximate mapping)
							const sizeMap = { 1: 10, 2: 13, 3: 16, 4: 18, 5: 24, 6: 32, 7: 48 };
							currentStyle.fontSize = sizeMap[ fontSize ] || 16;
						}
						// Get face (font family) from font tag
						const fontFace = node.getAttribute( 'face' );
						if ( fontFace ) {
							currentStyle.fontFamily = fontFace;
						}
					}

					// Process child nodes
					for ( const child of node.childNodes ) {
						extractRuns( child, currentStyle );
					}
				}
			};

			// Extract runs from the parsed HTML
			extractRuns( container );

			// Clean up runs - remove empty style objects
			const cleanedRuns = runs.map( ( run ) => {
				const hasStyle = Object.keys( run.style ).length > 0;
				return hasStyle ? run : { text: run.text };
			} );

			// Merge adjacent runs with identical styles
			return RichTextConverter.mergeAdjacentRuns( cleanedRuns );
		}

		/**
		 * Merge adjacent runs with identical styles
		 *
		 * @static
		 * @param {Array} runs - Array of {text, style?} objects
		 * @return {Array} Merged runs
		 */
		static mergeAdjacentRuns( runs ) {
			if ( !runs || runs.length === 0 ) {
				return [];
			}

			const merged = [];
			let current = { ...runs[ 0 ] };
			if ( current.style ) {
				current.style = { ...current.style };
			}

			for ( let i = 1; i < runs.length; i++ ) {
				const run = runs[ i ];
				const currentStyleStr = JSON.stringify( current.style || {} );
				const runStyleStr = JSON.stringify( run.style || {} );

				if ( currentStyleStr === runStyleStr ) {
					// Same style - merge text
					current.text += run.text;
				} else {
					// Different style - push current and start new
					merged.push( current );
					current = { ...run };
					if ( current.style ) {
						current.style = { ...current.style };
					}
				}
			}

			// Push final run
			merged.push( current );

			return merged;
		}

		/**
		 * Get plain text from an HTML string or contentEditable element
		 *
		 * @static
		 * @param {HTMLElement|string} source - Element or HTML string
		 * @return {string} Plain text content
		 */
		static getPlainText( source ) {
			if ( !source ) {
				return '';
			}

			// If it's a string, treat as HTML using DOMParser (avoids innerHTML)
			if ( typeof source === 'string' ) {
				const doc = new DOMParser().parseFromString( source, 'text/html' );
				return RichTextConverter.getPlainText( doc.body );
			}

			// Handle input/textarea elements
			if ( source.tagName === 'INPUT' || source.tagName === 'TEXTAREA' ) {
				return source.value || '';
			}

			// For contentEditable elements, extract text with newlines for <br>
			let text = '';
			const walk = ( node ) => {
				if ( node.nodeType === Node.TEXT_NODE ) {
					text += node.textContent;
				} else if ( node.nodeType === Node.ELEMENT_NODE ) {
					if ( node.nodeName === 'BR' ) {
						text += '\n';
					} else {
						for ( const child of node.childNodes ) {
							walk( child );
						}
						// Add newline after block elements
						if ( node.nodeName === 'DIV' || node.nodeName === 'P' ) {
							if ( !text.endsWith( '\n' ) ) {
								text += '\n';
							}
						}
					}
				}
			};
			walk( source );

			// Trim trailing newline
			return text.replace( /\n$/, '' );
		}
	}

	// Export to global namespace
	window.Layers = window.Layers || {};
	window.Layers.Canvas = window.Layers.Canvas || {};
	window.Layers.Canvas.RichTextConverter = RichTextConverter;

	// Also export for CommonJS (testing)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = RichTextConverter;
	}
}() );
