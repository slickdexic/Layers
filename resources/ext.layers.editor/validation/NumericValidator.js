/**
 * NumericValidator - Validates numeric properties for layers
 *
 * Handles validation of font size, stroke width, opacity, blur radius,
 * shadow properties, arrow size, and polygon sides.
 *
 * @module NumericValidator
 */
( function () {
	'use strict';

	/**
	 * Get ValidationHelpers from namespace or require
	 *
	 * @return {Object} ValidationHelpers class or module
	 */
	function getValidationHelpers() {
		if ( window.Layers && window.Layers.Validation && window.Layers.Validation.ValidationHelpers ) {
			return window.Layers.Validation.ValidationHelpers;
		}
		// Fallback for CommonJS environments
		if ( typeof require === 'function' ) {
			try {
				return require( './ValidationHelpers.js' );
			} catch ( e ) {
				// Return stub for tests
				return {
					isValidNumber: ( v ) => typeof v === 'number' && !isNaN( v ) && isFinite( v ),
					getMessage: ( key ) => key
				};
			}
		}
		return null;
	}

	/**
	 * NumericValidator class
	 * Validates numeric properties in layer objects
	 */
	class NumericValidator {
		/**
		 * Default validation rules for numeric properties
		 *
		 * @type {Object}
		 */
		static DEFAULT_RULES = {
			fontSize: { min: 1, max: 1000 },
			strokeWidth: { min: 0, max: 100 },
			opacity: { min: 0, max: 1 },
			fillOpacity: { min: 0, max: 1 },
			strokeOpacity: { min: 0, max: 1 },
			blurRadius: { min: 0, max: 100 },
			shadowBlur: { min: 0, max: 100 },
			shadowOffsetX: { min: -100, max: 100 },
			shadowOffsetY: { min: -100, max: 100 },
			shadowSpread: { min: 0, max: 50 },
			arrowSize: { min: 1, max: 100 },
			sides: { min: 3, max: 20 },
			starPoints: { min: 3, max: 20 }
		};

		/**
		 * Create a new NumericValidator instance
		 *
		 * @param {Object} [rules] - Custom validation rules to merge with defaults
		 */
		constructor( rules ) {
			this.rules = Object.assign( {}, NumericValidator.DEFAULT_RULES, rules || {} );
			this.helpers = getValidationHelpers();
		}

		/**
		 * Helper to check if value is a valid number
		 *
		 * @param {*} value - Value to check
		 * @return {boolean} True if valid number
		 */
		isValidNumber( value ) {
			if ( this.helpers && this.helpers.isValidNumber ) {
				return this.helpers.isValidNumber( value );
			}
			return typeof value === 'number' && !isNaN( value ) && isFinite( value );
		}

		/**
		 * Get localized message
		 *
		 * @param {string} key - Message key
		 * @param {...*} args - Message parameters
		 * @return {string} Localized message
		 */
		getMessage( key, ...args ) {
			if ( this.helpers && this.helpers.getMessage ) {
				return this.helpers.getMessage( key, ...args );
			}
			return key;
		}

		/**
		 * Validate all numeric properties on a layer
		 *
		 * @param {Object} layer - Layer to validate
		 * @param {Object} result - Validation result object to populate
		 */
		validateNumericProperties( layer, result ) {
			this.validateFontSize( layer, result );
			this.validateStrokeWidth( layer, result );
			this.validateOpacity( layer, result );
			this.validateFillOpacity( layer, result );
			this.validateStrokeOpacity( layer, result );
			this.validateBlurRadius( layer, result );
			this.validateShadowProperties( layer, result );
			this.validateArrowSize( layer, result );
			this.validateSides( layer, result );
		}

		/**
		 * Validate font size
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateFontSize( layer, result ) {
			if ( layer.fontSize === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.fontSize ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-fontsize-invalid' ) );
				return;
			}

			const fontSize = parseFloat( layer.fontSize );
			const { min, max } = this.rules.fontSize;

			if ( fontSize < min || fontSize > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-fontsize-range', min, max ) );
			}
		}

		/**
		 * Validate stroke width
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateStrokeWidth( layer, result ) {
			if ( layer.strokeWidth === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.strokeWidth ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-strokewidth-invalid' ) );
				return;
			}

			const strokeWidth = parseFloat( layer.strokeWidth );
			const { min, max } = this.rules.strokeWidth;

			if ( strokeWidth < min || strokeWidth > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-strokewidth-range', min, max ) );
			}
		}

		/**
		 * Validate opacity
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateOpacity( layer, result ) {
			if ( layer.opacity === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.opacity ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-opacity-invalid' ) );
				return;
			}

			const opacity = parseFloat( layer.opacity );
			const { min, max } = this.rules.opacity;

			if ( opacity < min || opacity > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-opacity-range', min, max ) );
			}
		}

		/**
		 * Validate fill opacity
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateFillOpacity( layer, result ) {
			if ( layer.fillOpacity === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.fillOpacity ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-fillopacity-invalid' ) );
				return;
			}

			const fillOpacity = parseFloat( layer.fillOpacity );
			const { min, max } = this.rules.fillOpacity;

			if ( fillOpacity < min || fillOpacity > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-fillopacity-range', min, max ) );
			}
		}

		/**
		 * Validate stroke opacity
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateStrokeOpacity( layer, result ) {
			if ( layer.strokeOpacity === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.strokeOpacity ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-strokeopacity-invalid' ) );
				return;
			}

			const strokeOpacity = parseFloat( layer.strokeOpacity );
			const { min, max } = this.rules.strokeOpacity;

			if ( strokeOpacity < min || strokeOpacity > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-strokeopacity-range', min, max ) );
			}
		}

		/**
		 * Validate blur radius (for blur layers)
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateBlurRadius( layer, result ) {
			if ( layer.blurRadius === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.blurRadius ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-blurradius-invalid' ) );
				return;
			}

			const blurRadius = parseFloat( layer.blurRadius );
			const { min, max } = this.rules.blurRadius;

			if ( blurRadius < min || blurRadius > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-blurradius-range', min, max ) );
			}
		}

		/**
		 * Validate shadow properties (blur, offset, spread)
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateShadowProperties( layer, result ) {
			// Shadow blur
			if ( layer.shadowBlur !== undefined ) {
				if ( !this.isValidNumber( layer.shadowBlur ) ) {
					result.isValid = false;
					result.errors.push( 'Shadow blur must be a number' );
				} else {
					const shadowBlur = parseFloat( layer.shadowBlur );
					const { min, max } = this.rules.shadowBlur;
					if ( shadowBlur < min || shadowBlur > max ) {
						result.isValid = false;
						result.errors.push( `Shadow blur must be between ${ min } and ${ max }` );
					}
				}
			}

			// Shadow offset X
			if ( layer.shadowOffsetX !== undefined ) {
				if ( !this.isValidNumber( layer.shadowOffsetX ) ) {
					result.isValid = false;
					result.errors.push( 'Shadow offset X must be a number' );
				} else {
					const shadowOffsetX = parseFloat( layer.shadowOffsetX );
					const { min, max } = this.rules.shadowOffsetX;
					if ( shadowOffsetX < min || shadowOffsetX > max ) {
						result.isValid = false;
						result.errors.push( `Shadow offset X must be between ${ min } and ${ max }` );
					}
				}
			}

			// Shadow offset Y
			if ( layer.shadowOffsetY !== undefined ) {
				if ( !this.isValidNumber( layer.shadowOffsetY ) ) {
					result.isValid = false;
					result.errors.push( 'Shadow offset Y must be a number' );
				} else {
					const shadowOffsetY = parseFloat( layer.shadowOffsetY );
					const { min, max } = this.rules.shadowOffsetY;
					if ( shadowOffsetY < min || shadowOffsetY > max ) {
						result.isValid = false;
						result.errors.push( `Shadow offset Y must be between ${ min } and ${ max }` );
					}
				}
			}

			// Shadow spread
			if ( layer.shadowSpread !== undefined ) {
				if ( !this.isValidNumber( layer.shadowSpread ) ) {
					result.isValid = false;
					result.errors.push( 'Shadow spread must be a number' );
				} else {
					const shadowSpread = parseFloat( layer.shadowSpread );
					const { min, max } = this.rules.shadowSpread;
					if ( shadowSpread < min || shadowSpread > max ) {
						result.isValid = false;
						result.errors.push( `Shadow spread must be between ${ min } and ${ max }` );
					}
				}
			}
		}

		/**
		 * Validate arrow size
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateArrowSize( layer, result ) {
			if ( layer.arrowSize === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.arrowSize ) ) {
				result.isValid = false;
				result.errors.push( 'Arrow size must be a number' );
				return;
			}

			const arrowSize = parseFloat( layer.arrowSize );
			const { min, max } = this.rules.arrowSize;

			if ( arrowSize < min || arrowSize > max ) {
				result.isValid = false;
				result.errors.push( `Arrow size must be between ${ min } and ${ max }` );
			}
		}

		/**
		 * Validate polygon sides
		 *
		 * @param {Object} layer - Layer object
		 * @param {Object} result - Validation result
		 */
		validateSides( layer, result ) {
			if ( layer.sides === undefined ) {
				return;
			}

			// Check if it's a valid number
			const sidesNum = parseFloat( layer.sides );
			if ( !this.isValidNumber( layer.sides ) || ( sidesNum % 1 !== 0 ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-sides-invalid' ) );
				return;
			}

			const sides = parseInt( layer.sides, 10 );
			const { min, max } = this.rules.sides;

			if ( sides < min || sides > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-sides-range', min, max ) );
			}
		}

		/**
		 * Validate star points count
		 *
		 * @param {*} points - Points value (should be a number for stars)
		 * @param {Object} result - Validation result
		 */
		validateStarPoints( points, result ) {
			if ( points === undefined ) {
				return;
			}

			if ( !this.isValidNumber( points ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-star-points-invalid' ) );
				return;
			}

			const value = parseFloat( points );
			if ( value % 1 !== 0 ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-star-points-invalid' ) );
				return;
			}

			const { min, max } = this.rules.starPoints;
			if ( value < min || value > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-star-points-range', min, max ) );
			}
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Validation = window.Layers.Validation || {};
		window.Layers.Validation.NumericValidator = NumericValidator;
	}

	// CommonJS export for Node.js/Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = NumericValidator;
	}
}() );
