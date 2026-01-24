/**
 * ValidationHelpers - Shared validation utilities for the Layers editor
 *
 * This module contains helper functions used by multiple validation classes.
 * Extracted from LayersValidator to reduce god class size.
 *
 * @module ValidationHelpers
 */
( function () {
	'use strict';

	/**
	 * ValidationHelpers class
	 * Provides shared validation utility methods
	 */
	class ValidationHelpers {
		/**
		 * Fallback messages in English (used when i18n unavailable)
		 *
		 * @type {Object<string, string>}
		 */
		static FALLBACK_MESSAGES = {
			'layers-validation-layer-invalid': 'Invalid layer object',
			'layers-validation-id-required': 'Layer ID is required',
			'layers-validation-type-required': 'Layer type is required',
			'layers-validation-type-invalid': 'Invalid layer type: $1',
			'layers-validation-id-type': 'Layer ID must be a string',
			'layers-validation-id-too-long': 'Layer ID cannot be longer than $1 characters',
			'layers-validation-id-invalid-chars': 'Layer ID contains invalid characters',
			'layers-validation-coordinate-invalid': 'Invalid coordinate value for $1',
			'layers-validation-coordinate-too-large': 'Coordinate $1 is too large (max: $2)',
			'layers-validation-fontsize-invalid': 'Invalid font size',
			'layers-validation-fontsize-range': 'Font size must be between $1 and $2',
			'layers-validation-strokewidth-invalid': 'Invalid stroke width',
			'layers-validation-strokewidth-range': 'Stroke width must be between $1 and $2',
			'layers-validation-opacity-invalid': 'Invalid opacity value',
			'layers-validation-opacity-range': 'Opacity must be between $1 and $2',
			'layers-validation-sides-invalid': 'Invalid number of sides',
			'layers-validation-sides-range': 'Number of sides must be between $1 and $2',
			'layers-validation-blurradius-invalid': 'Invalid blur radius',
			'layers-validation-blurradius-range': 'Blur radius must be between $1 and $2',
			'layers-validation-text-type': 'Text content must be a string',
			'layers-validation-text-too-long': 'Text content cannot be longer than $1 characters',
			'layers-validation-text-unsafe': 'Text content contains potentially unsafe content',
			'layers-validation-fontfamily-type': 'Font family must be a string',
			'layers-validation-fontfamily-too-long': 'Font family cannot be longer than $1 characters',
			'layers-validation-fontfamily-invalid': 'Font family contains invalid characters',
			'layers-validation-textalign-invalid': 'Invalid text alignment',
			'layers-validation-color-invalid': 'Invalid color value for $1',
			'layers-validation-points-array': 'Points must be an array',
			'layers-validation-points-too-many': 'Too many points (max: $1)',
			'layers-validation-point-invalid': 'Invalid point at index $1',
			'layers-validation-point-coordinates': 'Invalid coordinates for point at index $1',
			'layers-validation-point-too-large': 'Point coordinates too large at index $1',
			'layers-validation-arrowstyle-invalid': 'Invalid arrow style',
			'layers-validation-blendmode-invalid': 'Invalid blend mode',
			'layers-validation-layers-array': 'Layers must be an array',
			'layers-validation-too-many-layers': 'Too many layers (max: $1)',
			'layers-validation-layer-error': 'Layer $1: $2',
			'layers-validation-duplicate-id': 'Duplicate layer ID: $1',
			'layers-validation-star-points-invalid': 'Star points must be a whole number',
			'layers-validation-star-points-range': 'Star points must be between $1 and $2'
		};

		/**
		 * Strict whitelist of safe named CSS colors
		 *
		 * @type {Array<string>}
		 */
		static SAFE_COLORS = [
			'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
			'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime',
			'navy', 'maroon', 'olive', 'teal', 'silver', 'aqua', 'fuchsia'
		];

		/**
		 * Check if a value is a valid number
		 *
		 * @param {*} value - The value to check
		 * @return {boolean} True if value is a valid number
		 */
		static isValidNumber( value ) {
			return typeof value === 'number' && !isNaN( value ) && isFinite( value );
		}

		/**
		 * Validate color values
		 *
		 * Accepts hex colors, rgb/rgba, hsl/hsla, and safe named colors.
		 *
		 * @param {string} color - The color string to validate
		 * @return {boolean} True if color is valid
		 */
		static isValidColor( color ) {
			if ( typeof color !== 'string' ) {
				return false;
			}

			// Prevent extremely long color strings
			if ( color.length > 50 ) {
				return false;
			}

			// Allow hex colors (3, 4, 6, 8 digits)
			if ( /^#[0-9a-fA-F]{3,8}$/.test( color ) ) {
				return true;
			}

			// Allow rgb/rgba with strict validation
			if ( /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.test( color ) ) {
				const matches = color.match( /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/ );
				// Validate RGB values are in 0-255 range
				for ( let i = 1; i <= 3; i++ ) {
					if (
						matches[ i ] &&
						( parseInt( matches[ i ], 10 ) < 0 || parseInt( matches[ i ], 10 ) > 255 )
					) {
						return false;
					}
				}
				return true;
			}

			// Allow HSL/HSLA with strict validation
			if ( /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.test( color ) ) {
				const hslMatches = color.match( /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*(?:,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/ );
				// Validate HSL values
				if (
					hslMatches[ 1 ] &&
					( parseInt( hslMatches[ 1 ], 10 ) < 0 || parseInt( hslMatches[ 1 ], 10 ) > 360 )
				) {
					return false;
				}
					if (
					hslMatches[ 2 ] &&
					( parseInt( hslMatches[ 2 ], 10 ) < 0 || parseInt( hslMatches[ 2 ], 10 ) > 100 )
				) {
					return false;
				}
					if (
					hslMatches[ 3 ] &&
					( parseInt( hslMatches[ 3 ], 10 ) < 0 || parseInt( hslMatches[ 3 ], 10 ) > 100 )
				) {
					return false;
				}
				return true;
			}

			return ValidationHelpers.SAFE_COLORS.includes( color.toLowerCase() );
		}

		/**
		 * Check for potential script injection in text content
		 *
		 * @param {string} text - The text to check
		 * @return {boolean} True if text contains potential script injection
		 */
		static containsScriptInjection( text ) {
			return /<script|javascript:|data:|vbscript:|on\w+\s*=/i.test( text );
		}

		/**
		 * Get internationalized message with parameter support
		 *
		 * Delegates to MessageHelper for consistent i18n handling.
		 * Falls back to built-in English messages if MediaWiki i18n unavailable.
		 *
		 * @param {string} key - Message key (e.g., 'layers-validation-layer-invalid')
		 * @param {...*} args - Message parameters for substitution ($1, $2, etc.)
		 * @return {string} Localized message
		 */
		static getMessage( key, ...args ) {
			const fallback = ValidationHelpers.FALLBACK_MESSAGES[ key ] || key;

			// Use MessageHelper if available (handles mw.message delegation)
			if ( window.layersMessages && typeof window.layersMessages.getWithParams === 'function' ) {
				if ( args.length > 0 ) {
					return window.layersMessages.getWithParams( key, ...args ) || fallback;
				}
				return window.layersMessages.get( key, fallback );
			}

			// Direct mw.message fallback (when MessageHelper not loaded yet)
			if ( window.mw && window.mw.message ) {
				try {
					const msg = mw.message( key );
					if ( msg && typeof msg.text === 'function' ) {
						if ( args.length > 0 ) {
							return msg.params( args ).text();
						}
						return msg.text();
					}
				} catch ( e ) {
					// Fall through to fallback substitution
				}
			}

			// Manual parameter substitution for fallback messages
			let message = fallback;
			if ( args.length > 0 ) {
				args.forEach( ( arg, index ) => {
					message = message.replace( '$' + ( index + 1 ), String( arg ) );
				} );
			}

			return message;
		}

		/**
		 * Show validation errors to the user
		 *
		 * @param {Array<string>} errors - Array of error messages
		 */
		static showValidationErrors( errors ) {
			if ( !errors || errors.length === 0 ) {
				return;
			}

			const message = 'Validation errors:\n' + errors.join( '\n' );

			// Use MediaWiki notification if available
			if ( window.mw && window.mw.notify ) {
				mw.notify( message, { type: 'error', autoHide: false } );
			} else if ( window.mw && window.mw.log ) {
				// Use MediaWiki logging as fallback
				mw.log.error( 'Layers validation errors:', errors );
			}
		}

		/**
		 * Validate that a number is within a given range
		 *
		 * @param {*} value - The value to validate
		 * @param {number} min - Minimum allowed value
		 * @param {number} max - Maximum allowed value
		 * @return {Object} Result with isValid and numericValue
		 */
		static validateNumberRange( value, min, max ) {
			if ( !ValidationHelpers.isValidNumber( value ) ) {
				return { isValid: false, numericValue: null };
			}

			const numericValue = parseFloat( value );
			const isValid = numericValue >= min && numericValue <= max;

			return { isValid, numericValue };
		}

		/**
		 * Validate that a value is a whole number (integer)
		 *
		 * @param {*} value - The value to validate
		 * @return {boolean} True if value is a valid integer
		 */
		static isValidInteger( value ) {
			if ( !ValidationHelpers.isValidNumber( value ) ) {
				return false;
			}
			return value % 1 === 0;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Validation = window.Layers.Validation || {};
		window.Layers.Validation.ValidationHelpers = ValidationHelpers;
	}

	// CommonJS export for Node.js/Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ValidationHelpers;
	}
}() );
