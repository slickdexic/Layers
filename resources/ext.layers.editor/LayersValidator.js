/**
 * Client-side validation for the Layers editor
 * Provides immediate feedback to users about invalid input
 *
 * Delegates to ValidationHelpers and NumericValidator for shared utilities.
 *
 * @class LayersValidator
 */
( function () {
	'use strict';

	/**
	 * WeakMap tracking active input validators to prevent listener accumulation.
	 * When createInputValidator is called on an input that already has a validator,
	 * the previous one is automatically destroyed first.
	 * @type {WeakMap<Element, Object>}
	 */
	const activeValidators = new WeakMap();

	/**
	 * Get ValidationHelpers from namespace or require
	 *
	 * @return {Object|null} ValidationHelpers class
	 */
	function getValidationHelpers() {
		if ( window.Layers && window.Layers.Validation && window.Layers.Validation.ValidationHelpers ) {
			return window.Layers.Validation.ValidationHelpers;
		}
		if ( typeof require === 'function' ) {
			try {
				return require( './validation/ValidationHelpers.js' );
			} catch ( e ) {
				return null;
			}
		}
		return null;
	}

	/**
	 * Get NumericValidator from namespace or require
	 *
	 * @return {Object|null} NumericValidator class
	 */
	function getNumericValidator() {
		if ( window.Layers && window.Layers.Validation && window.Layers.Validation.NumericValidator ) {
			return window.Layers.Validation.NumericValidator;
		}
		if ( typeof require === 'function' ) {
			try {
				return require( './validation/NumericValidator.js' );
			} catch ( e ) {
				return null;
			}
		}
		return null;
	}

	/**
	 * LayersValidator class
	 * Provides validation methods and user feedback for layer data
	 */
	class LayersValidator {
		/**
		 * Create a new LayersValidator instance
		 *
		 * @constructor
		 */
		constructor() {
			const LayersConstants = ( window.Layers && window.Layers.Constants ) || {};
			const limits = LayersConstants.LIMITS || {};

			// Get helper classes
			this.ValidationHelpers = getValidationHelpers();
			const NumericValidatorClass = getNumericValidator();
			this.numericValidator = NumericValidatorClass ? new NumericValidatorClass() : null;
			this.validationRules = {
				// Layer type whitelist (must match server-side validation)
				validTypes: [
					'text', 'textbox', 'callout', 'arrow', 'rectangle', 'circle', 'ellipse',
					'polygon', 'star', 'line', 'path', 'blur', 'image', 'group', 'customShape', 'marker',
					'dimension'
				],

				// Coordinate limits
				maxCoordinate: 10000,
				minCoordinate: -10000,

				// Text limits (use shared LayerDefaults constant)
				maxTextLength: limits.MAX_TEXT_LENGTH || 1000,

				// Layer ID validation
				maxIdLength: 100,
				idPattern: /^[a-zA-Z0-9_-]+$/,

				// Numeric field limits
				// FIX 2025-11-14: Increased from 200 to 1000 to match server validation
				maxFontSize: 1000,
				minFontSize: 1,
				maxStrokeWidth: 100,
				minStrokeWidth: 0,
				maxOpacity: 1,
				minOpacity: 0,
				maxSides: limits.MAX_POLYGON_SIDES || 20,
				minSides: limits.MIN_POLYGON_SIDES || 3,
				maxBlurRadius: 100,
				minBlurRadius: 0,

				// Star point limits
				minStarPoints: limits.MIN_STAR_POINTS || 3,
				maxStarPoints: limits.MAX_STAR_POINTS || 20,

				// Font family validation
				fontFamilyPattern: /^[a-zA-Z0-9\s,-]+$/,
				maxFontFamilyLength: 100,

				// Points array limits
				maxPoints: 500,

				// Valid blend modes - must match Canvas 2D globalCompositeOperation values
				// 'source-over' is the default/normal blend mode used by Canvas 2D
				validBlendModes: [
					'source-over', 'source-in', 'source-out', 'source-atop',
					'destination-over', 'destination-in', 'destination-out', 'destination-atop',
					'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay',
					'darken', 'lighten', 'color-dodge', 'color-burn',
					'hard-light', 'soft-light', 'difference', 'exclusion',
					'hue', 'saturation', 'color', 'luminosity',
					'normal' // Alias for 'source-over', kept for backward compatibility
				],

				// Valid text alignments
				validTextAlignments: [ 'left', 'center', 'right', 'start', 'end' ],

				// Valid arrow styles (sync with server: single, double, none, arrow, dot)
				validArrowStyles: [ 'single', 'double', 'none', 'arrow', 'dot' ]
			};
		}

		/**
		 * Validate a complete layer object
		 *
		 * @param {Object} layer The layer to validate
		 * @return {Object} Validation result with isValid flag and errors array
		 */
		validateLayer( layer ) {
			const result = {
				isValid: true,
				errors: [],
				warnings: []
			};

			if ( !layer || typeof layer !== 'object' ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-layer-invalid' ) );
				return result;
			}

			// Validate required fields
			this.validateRequired( layer, result );

			// Validate layer type
			this.validateLayerType( layer, result );

			// Validate layer ID
			this.validateLayerId( layer, result );

			// Validate coordinates
			this.validateCoordinates( layer, result );

			// Validate numeric properties
			this.validateNumericProperties( layer, result );

			// Validate text content
			this.validateTextContent( layer, result );

			// Validate colors
			this.validateColors( layer, result );

			// Validate gradient fill
			this.validateGradient( layer, result );

			// Validate points array
			this.validatePoints( layer, result );

			// Validate type-specific properties
			this.validateTypeSpecificProperties( layer, result );

			return result;
		}

		/**
		 * Validate required fields
		 *
		 * @param {Object} layer Layer data object
		 * @param {Object} result Validation result object
		 */
		validateRequired( layer, result ) {
			if ( !layer.id ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-id-required' ) );
			}

			if ( !layer.type ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-type-required' ) );
			}
		}

		/**
		 * Validate layer type
		 *
		 * @param {Object} layer Layer data object
		 * @param {Object} result Validation result object
		 */
		validateLayerType( layer, result ) {
			if ( layer.type && !this.validationRules.validTypes.includes( layer.type ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-type-invalid', layer.type ) );
			}
		}

		/**
		 * Validate layer ID
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validateLayerId( layer, result ) {
			if ( layer.id ) {
				if ( typeof layer.id !== 'string' ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-id-type' ) );
				} else {
					if ( layer.id.length > this.validationRules.maxIdLength ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-id-too-long', this.validationRules.maxIdLength ) );
					}

					if ( !this.validationRules.idPattern.test( layer.id ) ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-id-invalid-chars' ) );
					}
				}
			}
		}

		/**
		 * Validate coordinate fields
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validateCoordinates( layer, result ) {
			const coordinateFields = [ 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'radius', 'radiusX', 'radiusY' ];

			coordinateFields.forEach( ( field ) => {
				if ( layer[ field ] !== undefined ) {
					if ( !this.isValidNumber( layer[ field ] ) ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-coordinate-invalid', field ) );
					} else {
						const value = parseFloat( layer[ field ] );
						if ( Math.abs( value ) > this.validationRules.maxCoordinate ) {
							result.isValid = false;
							result.errors.push( this.getMessage( 'layers-validation-coordinate-too-large', field, this.validationRules.maxCoordinate ) );
						}
					}
				}
			} );
		}

		/**
		 * Validate numeric properties with specific ranges.
		 * Delegates to NumericValidator for centralized validation logic.
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validateNumericProperties( layer, result ) {
			if ( this.numericValidator ) {
				this.numericValidator.validateNumericProperties( layer, result );
			}
		}

		/**
		 * Validate text content
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validateTextContent( layer, result ) {
			if ( layer.type === 'text' && layer.text !== undefined ) {
				if ( typeof layer.text !== 'string' ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-text-type' ) );
				} else {
					if ( layer.text.length > this.validationRules.maxTextLength ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-text-too-long', this.validationRules.maxTextLength ) );
					}

					// Check for potentially dangerous content
					if ( this.containsScriptInjection( layer.text ) ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-text-unsafe' ) );
					}
				}
			}

			// Font family validation
			if ( layer.fontFamily !== undefined ) {
				if ( typeof layer.fontFamily !== 'string' ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-fontfamily-type' ) );
				} else {
					if ( layer.fontFamily.length > this.validationRules.maxFontFamilyLength ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-fontfamily-too-long', this.validationRules.maxFontFamilyLength ) );
					}

					if ( !this.validationRules.fontFamilyPattern.test( layer.fontFamily ) ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-fontfamily-invalid' ) );
					}
				}
			}

			// Text alignment validation
			if ( layer.textAlign !== undefined ) {
				if ( !this.validationRules.validTextAlignments.includes( layer.textAlign ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-textalign-invalid' ) );
				}
			}
		}

		/**
		 * Validate color values
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validateColors( layer, result ) {
			const colorFields = [ 'stroke', 'fill', 'textStrokeColor', 'textShadowColor', 'shadowColor' ];

			colorFields.forEach( ( field ) => {
				if ( layer[ field ] !== undefined ) {
					// Special case: 'blur' is a valid fill value (blur fill effect)
					if ( field === 'fill' && layer[ field ] === 'blur' ) {
						return;
					}
					// Special case: 'none' is valid for fill and stroke (SVG standard)
					if ( ( field === 'fill' || field === 'stroke' ) && layer[ field ] === 'none' ) {
						return;
					}
					if ( !this.isValidColor( layer[ field ] ) ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-color-invalid', field ) );
					}
				}
			} );
		}

		/**
		 * Validate gradient fill object
		 * Synced with server-side validation in ServerSideLayerValidator.php
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validateGradient( layer, result ) {
			if ( layer.gradient === undefined ) {
				return;
			}

			const gradient = layer.gradient;

			// Gradient must be an object
			if ( typeof gradient !== 'object' || gradient === null || Array.isArray( gradient ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-gradient-invalid' ) );
				return;
			}

			// Validate required type
			if ( !gradient.type || ![ 'linear', 'radial' ].includes( gradient.type ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-gradient-type-invalid' ) );
				return;
			}

			// Validate colors array
			if ( !Array.isArray( gradient.colors ) || gradient.colors.length < 2 ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-gradient-colors-required' ) );
				return;
			}

			// Server allows max 10 color stops
			if ( gradient.colors.length > 10 ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-gradient-colors-max' ) );
				return;
			}

			// Validate each color stop
			for ( let i = 0; i < gradient.colors.length; i++ ) {
				const stop = gradient.colors[ i ];
				if ( typeof stop !== 'object' || stop === null ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-gradient-stop-invalid', i ) );
					continue;
				}

				// Validate offset (0-1)
				if ( typeof stop.offset !== 'number' || stop.offset < 0 || stop.offset > 1 ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-gradient-offset-invalid', i ) );
				}

				// Validate color
				if ( !stop.color || !this.isValidColor( stop.color ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-gradient-color-invalid', i ) );
				}
			}

			// Validate angle for linear gradients (0-360)
			if ( gradient.type === 'linear' && gradient.angle !== undefined ) {
				if ( typeof gradient.angle !== 'number' || gradient.angle < 0 || gradient.angle > 360 ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-gradient-angle-invalid' ) );
				}
			}

			// Validate center/radius for radial gradients
			if ( gradient.type === 'radial' ) {
				if ( gradient.centerX !== undefined &&
					( typeof gradient.centerX !== 'number' || gradient.centerX < 0 || gradient.centerX > 1 ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-gradient-centerx-invalid' ) );
				}
				if ( gradient.centerY !== undefined &&
					( typeof gradient.centerY !== 'number' || gradient.centerY < 0 || gradient.centerY > 1 ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-gradient-centery-invalid' ) );
				}
				if ( gradient.radius !== undefined &&
					( typeof gradient.radius !== 'number' || gradient.radius < 0 || gradient.radius > 2 ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-gradient-radius-invalid' ) );
				}
			}
		}

		/**
		 * Validate points array for path layers
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validatePoints( layer, result ) {
			if ( layer.type === 'star' ) {
				this.validateStarPointCount( layer, result );
				return;
			}

			if ( layer.points === undefined ) {
				return;
			}

			if ( !Array.isArray( layer.points ) ) {
				// Only path (and future freehand types) require coordinate arrays.
				if ( layer.type === 'path' ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-points-array' ) );
				}
				return;
			}

			if ( layer.points.length > this.validationRules.maxPoints ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-points-too-many', this.validationRules.maxPoints ) );
				return;
			}

			layer.points.forEach( ( point, index ) => {
				if ( !point || typeof point !== 'object' ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-point-invalid', index ) );
				} else {
					if ( !this.isValidNumber( point.x ) || !this.isValidNumber( point.y ) ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-point-coordinates', index ) );
					} else {
						if ( Math.abs( point.x ) > this.validationRules.maxCoordinate ||
							Math.abs( point.y ) > this.validationRules.maxCoordinate ) {
							result.isValid = false;
							result.errors.push( this.getMessage( 'layers-validation-point-too-large', index ) );
						}
					}
				}
			} );
		}

		validateStarPointCount( layer, result ) {
			if ( layer.points === undefined ) {
				return;
			}

			if ( !this.isValidNumber( layer.points ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-star-points-invalid' ) );
				return;
			}

			const value = parseFloat( layer.points );
			if ( value % 1 !== 0 ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-star-points-invalid' ) );
				return;
			}

			const min = this.validationRules.minStarPoints;
			const max = this.validationRules.maxStarPoints;
			if ( value < min || value > max ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-star-points-range', min, max ) );
			}
		}

		/**
		 * Validate type-specific properties
		 *
		 * @param {Object} layer
		 * @param {Object} result
		 */
		validateTypeSpecificProperties( layer, result ) {
			// Arrow style validation
			if ( layer.type === 'arrow' && layer.arrowStyle !== undefined ) {
				if ( !this.validationRules.validArrowStyles.includes( layer.arrowStyle ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-arrowstyle-invalid' ) );
				}
			}

			// Blend mode validation
			// Note: 'blur' is a special fill type, not a blend mode - skip validation for it
			if ( layer.blendMode !== undefined || layer.blend !== undefined ) {
				const blendValue = layer.blendMode || layer.blend;
				// 'blur' is used as a fill type indicator, not a blend mode
				if ( blendValue !== 'blur' && !this.validationRules.validBlendModes.includes( blendValue ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-blendmode-invalid' ) );
				}
			}

			// Rich text validation for textbox and callout layers
			if ( ( layer.type === 'textbox' || layer.type === 'callout' ) && layer.richText ) {
				this.validateRichText( layer.richText, result );
			}
		}

		/**
		 * Validate rich text formatting array
		 *
		 * Rich text enables mixed formatting within a single text layer.
		 * Each "run" contains text and optional style overrides.
		 *
		 * @param {Array} richText Array of text runs
		 * @param {Object} result Validation result object
		 */
		validateRichText( richText, result ) {
			if ( !Array.isArray( richText ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-richtext-not-array' ) );
				return;
			}

			// Limit number of runs
			const maxRuns = 100;
			if ( richText.length > maxRuns ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-richtext-too-many-runs', maxRuns ) );
				return;
			}

			// Track total text length
			let totalLength = 0;
			const maxTotalLength = 50000;

			// Allowed style properties
			const allowedStyleProps = [
				'fontWeight', 'fontStyle', 'fontSize', 'fontFamily',
				'color', 'textDecoration', 'backgroundColor',
				'textStrokeColor', 'textStrokeWidth'
			];

			const validFontWeights = [ 'normal', 'bold', 'lighter', 'bolder' ];
			const validFontStyles = [ 'normal', 'italic', 'oblique' ];
			const validTextDecorations = [ 'none', 'underline', 'line-through', 'overline' ];

			for ( let i = 0; i < richText.length; i++ ) {
				const run = richText[ i ];

				if ( typeof run !== 'object' || run === null ) {
					result.warnings.push( `Rich text run ${ i } is not an object` );
					continue;
				}

				// Each run must have text
				if ( typeof run.text !== 'string' ) {
					result.warnings.push( `Rich text run ${ i } missing text property` );
					continue;
				}

				totalLength += run.text.length;
				if ( totalLength > maxTotalLength ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-richtext-too-long' ) );
					return;
				}

				// Check for script injection in text
				if ( this.containsScriptInjection( run.text ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-text-unsafe' ) );
					return;
				}

				// Validate style object if present
				if ( run.style && typeof run.style === 'object' ) {
					for ( const prop of Object.keys( run.style ) ) {
						if ( !allowedStyleProps.includes( prop ) ) {
							result.warnings.push( `Unknown style property '${ prop }' in run ${ i }` );
							continue;
						}

						const value = run.style[ prop ];

						// Validate enum values
						if ( prop === 'fontWeight' && !validFontWeights.includes( value ) ) {
							result.warnings.push( `Invalid fontWeight '${ value }' in run ${ i }` );
						}
						if ( prop === 'fontStyle' && !validFontStyles.includes( value ) ) {
							result.warnings.push( `Invalid fontStyle '${ value }' in run ${ i }` );
						}
						if ( prop === 'textDecoration' && !validTextDecorations.includes( value ) ) {
							result.warnings.push( `Invalid textDecoration '${ value }' in run ${ i }` );
						}

						// Validate numeric ranges
						if ( prop === 'fontSize' ) {
							const size = Number( value );
							if ( isNaN( size ) || size < 1 || size > 500 ) {
								result.warnings.push( `Invalid fontSize '${ value }' in run ${ i }` );
							}
						}
						if ( prop === 'textStrokeWidth' ) {
							const width = Number( value );
							if ( isNaN( width ) || width < 0 || width > 20 ) {
								result.warnings.push( `Invalid textStrokeWidth '${ value }' in run ${ i }` );
							}
						}
					}
				}
			}
		}

		/**
		 * Validate a complete layers array (multiple layers)
		 *
		 * @param {Array} layers
		 * @param {number} maxLayers
		 * @return {Object} Validation result with isValid and errors properties
		 */
		validateLayers( layers, maxLayers ) {
			const result = {
				isValid: true,
				errors: [],
				warnings: [],
				layerResults: []
			};

			if ( !Array.isArray( layers ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-layers-array' ) );
				return result;
			}

			// Check layer count limit
			maxLayers = maxLayers || 100;
			if ( layers.length > maxLayers ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-too-many-layers', maxLayers ) );
			}

			// Validate each layer
			const layerIds = [];
			layers.forEach( ( layer, index ) => {
				const layerResult = this.validateLayer( layer );
				result.layerResults.push( layerResult );

				if ( !layerResult.isValid ) {
					result.isValid = false;
					// Add layer index to error messages
					layerResult.errors.forEach( ( error ) => {
						result.errors.push( this.getMessage( 'layers-validation-layer-error', index + 1, error ) );
					} );
				}

				// Check for duplicate IDs
				if ( layer.id ) {
					if ( layerIds.includes( layer.id ) ) {
						result.isValid = false;
						result.errors.push( this.getMessage( 'layers-validation-duplicate-id', layer.id ) );
					} else {
						layerIds.push( layer.id );
					}
				}
			} );

			return result;
		}

		/**
		 * Helper function to check if a value is a valid number
		 * Delegates to ValidationHelpers when available.
		 *
		 * @param {*} value
		 * @return {boolean} True if value is a valid number
		 */
		isValidNumber( value ) {
			if ( this.ValidationHelpers && this.ValidationHelpers.isValidNumber ) {
				return this.ValidationHelpers.isValidNumber( value );
			}
			return typeof value === 'number' && !isNaN( value ) && isFinite( value );
		}

		/**
		 * Helper function to validate color values
		 * Delegates to ValidationHelpers when available.
		 *
		 * @param {string} color
		 * @return {boolean} True if color is valid
		 */
		isValidColor( color ) {
			if ( this.ValidationHelpers && this.ValidationHelpers.isValidColor ) {
				return this.ValidationHelpers.isValidColor( color );
			}
			// Minimal fallback: accept hex colors only when ValidationHelpers unavailable
			return typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test( color );
		}

		/**
		 * Check for potential script injection in text content
		 * Delegates to ValidationHelpers when available.
		 *
		 * @param {string} text
		 * @return {boolean} True if text contains potential script injection
		 */
		containsScriptInjection( text ) {
			if ( this.ValidationHelpers && this.ValidationHelpers.containsScriptInjection ) {
				return this.ValidationHelpers.containsScriptInjection( text );
			}
			// Minimal fallback
			return typeof text === 'string' &&
				/<script|javascript:|data:|vbscript:|on\w+\s*=|expression\s*\(/i.test( text );
		}

		/**
		 * Get internationalized message with parameter support
		 *
		 * Delegates to ValidationHelpers for consistent i18n handling.
		 * Falls back to built-in English messages if MediaWiki i18n unavailable.
		 *
		 * @param {string} key - Message key (e.g., 'layers-validation-layer-invalid')
		 * @param {...*} args - Message parameters for substitution ($1, $2, etc.)
		 * @return {string} Localized message
		 */
		getMessage( key, ...args ) {
			// Delegate to ValidationHelpers when available
			if ( this.ValidationHelpers && this.ValidationHelpers.getMessage ) {
				return this.ValidationHelpers.getMessage( key, ...args );
			}
			// Minimal fallback: return key with parameter substitution
			let message = key;
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
		 * @param {Array<string>} errors Array of error messages
		 * @param {Object} [_context] Context information (unused)
		 */
		showValidationErrors( errors, _context ) {
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
			} else {
				// Console logging disabled - rely on MediaWiki logging only
			}
		}

		/**
		 * Create input validation helper for real-time validation
		 *
		 * @param {*} input
		 * @param {string} validationType
		 * @param {Object} options
		 * @return {Object} Input validator with enable and disable methods
		 */
		createInputValidator( input, validationType, options ) {
			// Auto-destroy any previous validator on this input to prevent
			// listener accumulation (P3-057)
			const existingValidator = activeValidators.get( input );
			if ( existingValidator && typeof existingValidator.destroy === 'function' ) {
				existingValidator.destroy();
			}

			options = options || {};
			let errorElement = null;

			const showError = ( message ) => {
				// Remove existing error
				hideError();

				// Create error element
				errorElement = document.createElement( 'div' );
				errorElement.className = 'layers-validation-error';
				errorElement.textContent = message;
				// Apply minimal inline styles safely without cssText
				errorElement.style.color = '#d63638';
				errorElement.style.fontSize = '12px';
				errorElement.style.marginTop = '2px';

				// Insert after input
				if ( input.parentNode ) {
					input.parentNode.insertBefore( errorElement, input.nextSibling );
				}

				// Add error styling to input
				input.style.borderColor = '#d63638';
			};

			const hideError = () => {
				if ( errorElement && errorElement.parentNode ) {
					errorElement.parentNode.removeChild( errorElement );
					errorElement = null;
				}
				input.style.borderColor = '';
			};

			const validate = () => {
				const value = input.value;
				let isValid = true;
				let errorMessage = '';

				switch ( validationType ) {
					case 'number':
						if ( value && !this.isValidNumber( parseFloat( value ) ) ) {
							isValid = false;
							errorMessage = 'Must be a valid number';
						} else if ( value ) {
							const num = parseFloat( value );
							if ( options.min !== undefined && num < options.min ) {
								isValid = false;
								errorMessage = 'Minimum value: ' + options.min;
							}
							if ( options.max !== undefined && num > options.max ) {
								isValid = false;
								errorMessage = 'Maximum value: ' + options.max;
							}
						}
						break;

					case 'color':
						if ( value && !this.isValidColor( value ) ) {
							isValid = false;
							errorMessage = 'Invalid color format';
						}
						break;

					case 'text':
						if (
							value &&
							value.length > ( options.maxLength || this.validationRules.maxTextLength )
						) {
							isValid = false;
							errorMessage = 'Text too long (max: ' + ( options.maxLength || this.validationRules.maxTextLength ) + ')';
						}
						if ( value && this.containsScriptInjection( value ) ) {
							isValid = false;
							errorMessage = 'Text contains unsafe content';
						}
						break;
				}

				if ( isValid ) {
					hideError();
				} else {
					showError( errorMessage );
				}

				return isValid;
			};

			// Add event listeners
			input.addEventListener( 'input', validate );
			input.addEventListener( 'blur', validate );

			// Initial validation
			if ( input.value ) {
				validate();
			}

			const validator = {
				validate: validate,
				destroy: () => {
					hideError();
					input.removeEventListener( 'input', validate );
					input.removeEventListener( 'blur', validate );
					activeValidators.delete( input );
				}
			};

			// Track this validator for auto-cleanup on re-creation
			activeValidators.set( input, validator );

			return validator;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Validation = window.Layers.Validation || {};
		window.Layers.Validation.LayersValidator = LayersValidator;
	}

}() );
