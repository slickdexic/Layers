/**
 * LayerDataNormalizer - Shared utility for normalizing layer data
 *
 * This module ensures consistent data types across the editor and viewer.
 * It handles the conversion of string/numeric representations of boolean
 * values to actual JavaScript booleans, which is critical for correct
 * rendering of boolean-dependent features like shadows and visibility.
 *
 * Why this exists:
 * - JSON data from the server may have string representations ("true", "1")
 * - Database storage or legacy data may use numeric values (1, 0)
 * - Canvas rendering code uses strict equality checks (=== true)
 * - Without normalization, features like text shadows fail to render
 *
 * @module LayerDataNormalizer
 * @since 1.1.2
 */
( function () {
	'use strict';

	/**
	 * Properties that should be normalized to boolean values.
	 * Add new boolean properties here to ensure they're handled consistently.
	 * @type {string[]}
	 */
	const BOOLEAN_PROPERTIES = [
		'shadow',
		'textShadow',
		'glow',
		'visible',
		'locked',
		'preserveAspectRatio',
		'hasArrow',
		// Group layer properties
		'expanded',
		// Custom shape properties
		'isMultiPath',
		'strokeOnly',
		// Dimension layer properties
		'showUnit',
		'showBackground'
	];

	/**
	 * Properties that should be normalized to numeric values.
	 * Handles string-to-number conversion for properties that must be numbers.
	 * @type {string[]}
	 */
	const NUMERIC_PROPERTIES = [
		'x', 'y', 'width', 'height',
		'x1', 'y1', 'x2', 'y2',
		'radius', 'radiusX', 'radiusY', 'innerRadius', 'outerRadius',
		'pointRadius', 'valleyRadius',
		'rotation', 'opacity', 'fillOpacity', 'strokeOpacity',
		'strokeWidth', 'fontSize', 'lineHeight', 'padding', 'cornerRadius',
		'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowSpread',
		'textShadowBlur', 'textShadowOffsetX', 'textShadowOffsetY',
		'textStrokeWidth', 'arrowSize', 'blurRadius', 'tailWidth',
		// Marker properties
		'size', 'arrowX', 'arrowY', 'fontSizeAdjust'
	];

	/**
	 * LayerDataNormalizer class - Provides static methods for normalizing layer data
	 *
	 * @class
	 */
	class LayerDataNormalizer {
		/**
		 * Normalize a single layer's properties
		 *
		 * Converts string/numeric representations to proper JavaScript types.
		 * Modifies the layer object in place for performance.
		 *
		 * @param {Object} layer - The layer object to normalize
		 * @returns {Object} The same layer object (for chaining)
		 */
		static normalizeLayer( layer ) {
			if ( !layer || typeof layer !== 'object' ) {
				return layer;
			}

			// Normalize boolean properties
			LayerDataNormalizer.normalizeBooleans( layer );

			// Normalize numeric properties
			LayerDataNormalizer.normalizeNumbers( layer );

			// Normalize property aliases (e.g., blendMode → blend)
			LayerDataNormalizer.normalizeAliases( layer );

			// Normalize nested points array if present
			if ( Array.isArray( layer.points ) ) {
				layer.points.forEach( ( point ) => {
					if ( point && typeof point === 'object' ) {
						if ( typeof point.x === 'string' ) {
							point.x = parseFloat( point.x ) || 0;
						}
						if ( typeof point.y === 'string' ) {
							point.y = parseFloat( point.y ) || 0;
						}
					}
				} );
			}

			// Normalize rich text array if present
			if ( Array.isArray( layer.richText ) ) {
				LayerDataNormalizer.normalizeRichText( layer.richText );
			}

			return layer;
		}

		/**
		 * Normalize rich text runs array
		 *
		 * Ensures consistent data types in rich text style properties.
		 * Handles edge cases like missing text or invalid style objects.
		 *
		 * @param {Array} richText - Array of text runs
		 */
		static normalizeRichText( richText ) {
			if ( !Array.isArray( richText ) ) {
				return;
			}

			richText.forEach( ( run ) => {
				if ( !run || typeof run !== 'object' ) {
					return;
				}

				// Ensure text is a string
				if ( run.text === undefined || run.text === null ) {
					run.text = '';
				} else if ( typeof run.text !== 'string' ) {
					run.text = String( run.text );
				}

				// Normalize style properties if present
				if ( run.style && typeof run.style === 'object' ) {
					// Normalize numeric style properties
					const numericProps = [ 'fontSize', 'textStrokeWidth' ];
					numericProps.forEach( ( prop ) => {
						if ( typeof run.style[ prop ] === 'string' ) {
							const parsed = parseFloat( run.style[ prop ] );
							if ( !isNaN( parsed ) ) {
								run.style[ prop ] = parsed;
							}
						}
					} );
				}
			} );
		}

		/**
		 * Normalize property aliases
		 *
		 * The server normalizes 'blend' to 'blendMode' and removes 'blend'.
		 * This ensures both properties are available for client code that
		 * may use either property name.
		 *
		 * @param {Object} layer - The layer object
		 */
		static normalizeAliases( layer ) {
			// blendMode → blend: Server saves as blendMode, client code uses blend
			if ( layer.blendMode !== undefined && layer.blend === undefined ) {
				layer.blend = layer.blendMode;
			}
			// blend → blendMode: Ensure blendMode is also set for code that reads it
			if ( layer.blend !== undefined && layer.blendMode === undefined ) {
				layer.blendMode = layer.blend;
			}
		}

		/**
		 * Normalize boolean properties on a layer
		 *
		 * @param {Object} layer - The layer object
		 */
		static normalizeBooleans( layer ) {
			BOOLEAN_PROPERTIES.forEach( ( prop ) => {
				const val = layer[ prop ];

				// Skip undefined values - don't add properties that don't exist
				if ( val === undefined ) {
					return;
				}

				// Convert string/numeric representations to actual booleans
				// Explicit false values: '0', 'false', numeric 0, false
				if ( val === '0' || val === 'false' || val === 0 || val === false ) {
					layer[ prop ] = false;
				// Explicit true values: '1', 'true', numeric 1, true, empty string (legacy)
				} else if ( val === '' || val === '1' || val === 'true' || val === 1 || val === true ) {
					layer[ prop ] = true;
				}
				// Note: null and other values are left as-is
			} );
		}

		/**
		 * Normalize numeric properties on a layer
		 *
		 * @param {Object} layer - The layer object
		 */
		static normalizeNumbers( layer ) {
			NUMERIC_PROPERTIES.forEach( ( prop ) => {
				const val = layer[ prop ];

				// Skip undefined values
				if ( val === undefined ) {
					return;
				}

				// Convert string numbers to actual numbers
				if ( typeof val === 'string' ) {
					const parsed = parseFloat( val );
					if ( !isNaN( parsed ) ) {
						layer[ prop ] = parsed;
					}
				}
			} );
		}

		/**
		 * Normalize an array of layers
		 *
		 * @param {Array} layers - Array of layer objects
		 * @returns {Array} The same array (for chaining)
		 */
		static normalizeLayers( layers ) {
			if ( !Array.isArray( layers ) ) {
				return layers;
			}

			layers.forEach( ( layer ) => {
				LayerDataNormalizer.normalizeLayer( layer );
			} );

			return layers;
		}

		/**
		 * Normalize a layer data structure (with layers array inside)
		 *
		 * Handles the common case where layer data is wrapped:
		 * { layers: [...], baseWidth: N, baseHeight: N, backgroundVisible: bool }
		 *
		 * Also normalizes top-level properties like backgroundVisible which
		 * come from the API as integers (0/1) due to PHP serialization.
		 *
		 * @param {Object} layerData - Layer data object with layers array
		 * @returns {Object} The same object (for chaining)
		 */
		static normalizeLayerData( layerData ) {
			if ( !layerData ) {
				return layerData;
			}

			// Normalize layers array
			if ( Array.isArray( layerData.layers ) ) {
				LayerDataNormalizer.normalizeLayers( layerData.layers );
			}

			// Normalize top-level backgroundVisible (API returns 0/1 integers)
			// This is the same pattern as layer-level boolean properties
			const bgVal = layerData.backgroundVisible;
			if ( bgVal !== undefined ) {
				if ( bgVal === '0' || bgVal === 'false' || bgVal === 0 || bgVal === false ) {
					layerData.backgroundVisible = false;
				} else if ( bgVal === '' || bgVal === '1' || bgVal === 'true' || bgVal === 1 || bgVal === true ) {
					layerData.backgroundVisible = true;
				}
			}

			// Normalize backgroundOpacity to number
			const bgOpacity = layerData.backgroundOpacity;
			if ( bgOpacity !== undefined && typeof bgOpacity === 'string' ) {
				const parsed = parseFloat( bgOpacity );
				if ( !isNaN( parsed ) ) {
					layerData.backgroundOpacity = parsed;
				}
			}

			return layerData;
		}

		/**
		 * Get the list of boolean properties that are normalized
		 * Useful for testing and documentation
		 *
		 * @returns {string[]} Array of property names
		 */
		static getBooleanProperties() {
			return [ ...BOOLEAN_PROPERTIES ];
		}

		/**
		 * Get the list of numeric properties that are normalized
		 * Useful for testing and documentation
		 *
		 * @returns {string[]} Array of property names
		 */
		static getNumericProperties() {
			return [ ...NUMERIC_PROPERTIES ];
		}

		/**
		 * Convert a value to boolean using the same logic as normalization
		 * Useful for checking values without modifying objects
		 *
		 * @param {*} val - Value to convert
		 * @returns {boolean|undefined} Boolean value, or undefined if not a boolean representation
		 */
		static toBoolean( val ) {
			if ( val === '0' || val === 'false' || val === 0 || val === false ) {
				return false;
			}
			if ( val === '' || val === '1' || val === 'true' || val === 1 || val === true ) {
				return true;
			}
			return undefined;
		}
	}

	// Export to Layers namespace (preferred)
	window.Layers = window.Layers || {};
	window.Layers.LayerDataNormalizer = LayerDataNormalizer;

	// Also export to window for backwards compatibility and easy access
	window.LayerDataNormalizer = LayerDataNormalizer;

}() );
