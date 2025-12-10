/**
 * Client-side validation for the Layers editor
 * Provides immediate feedback to users about invalid input
 */
( function () {
	'use strict';

	/**
	 * LayersValidator class
	 * Provides validation methods and user feedback for layer data
	 */
	function LayersValidator() {
		const limits = ( window.LayersConstants && window.LayersConstants.LIMITS ) || {};
		this.validationRules = {
			// Layer type whitelist (must match server-side validation)
			validTypes: [
				'text', 'arrow', 'rectangle', 'circle', 'ellipse',
				'polygon', 'star', 'line', 'highlight', 'path', 'blur'
			],

			// Coordinate limits
			maxCoordinate: 10000,
			minCoordinate: -10000,

			// Text limits
			maxTextLength: 500,

			// Layer ID validation
			maxIdLength: 100,
			idPattern: /^[a-zA-Z0-9_-]+$/,

			// Numeric field limits
			// FIX 2025-11-14: Increased from 200 to 1000 to match server validation
			maxFontSize: 1000,
			minFontSize: 1,
			maxStrokeWidth: 50,
			minStrokeWidth: 0,
			maxOpacity: 1,
			minOpacity: 0,
			maxSides: limits.MAX_POLYGON_SIDES || 20,
			minSides: limits.MIN_POLYGON_SIDES || 3,
			maxBlurRadius: 100,
			minBlurRadius: 1,

			// Star point limits
			minStarPoints: limits.MIN_STAR_POINTS || 3,
			maxStarPoints: limits.MAX_STAR_POINTS || 20,

			// Font family validation
			fontFamilyPattern: /^[a-zA-Z0-9\s,-]+$/,
			maxFontFamilyLength: 100,

			// Points array limits
			maxPoints: 500,

			// Valid blend modes
			validBlendModes: [
				'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
				'color-dodge', 'color-burn', 'hard-light', 'soft-light',
				'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
			],

			// Valid text alignments
			validTextAlignments: [ 'left', 'center', 'right', 'start', 'end' ],

			// Valid arrow styles
			validArrowStyles: [ 'single', 'double', 'none' ]
		};
	}

	/**
	 * Validate a complete layer object
	 *
	 * @param {Object} layer The layer to validate
	 * @return {Object} Validation result with isValid flag and errors array
	 */
	LayersValidator.prototype.validateLayer = function ( layer ) {
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

		// Validate points array
		this.validatePoints( layer, result );

		// Validate type-specific properties
		this.validateTypeSpecificProperties( layer, result );

		return result;
	};

	/**
	 * Validate required fields
	 *
	 * @param {Object} layer Layer data object
	 * @param {Object} result Validation result object
	 */
	LayersValidator.prototype.validateRequired = function ( layer, result ) {
		if ( !layer.id ) {
			result.isValid = false;
			result.errors.push( this.getMessage( 'layers-validation-id-required' ) );
		}

		if ( !layer.type ) {
			result.isValid = false;
			result.errors.push( this.getMessage( 'layers-validation-type-required' ) );
		}
	};

	/**
	 * Validate layer type
	 *
	 * @param {Object} layer Layer data object
	 * @param {Object} result Validation result object
	 */
	LayersValidator.prototype.validateLayerType = function ( layer, result ) {
		if ( layer.type && !this.validationRules.validTypes.includes( layer.type ) ) {
			result.isValid = false;
			result.errors.push( this.getMessage( 'layers-validation-type-invalid', layer.type ) );
		}
	};

	/**
	 * Validate layer ID
	 *
	 * @param {Object} layer
	 * @param {Object} result
	 */
	LayersValidator.prototype.validateLayerId = function ( layer, result ) {
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
	};

	/**
	 * Validate coordinate fields
	 *
	 * @param {Object} layer
	 * @param {Object} result
	 */
	LayersValidator.prototype.validateCoordinates = function ( layer, result ) {
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
	};

	/**
	 * Validate numeric properties with specific ranges
	 *
	 * @param {Object} layer
	 * @param {Object} result
	 */
	LayersValidator.prototype.validateNumericProperties = function ( layer, result ) {
		// Font size validation
		if ( layer.fontSize !== undefined ) {
			if ( !this.isValidNumber( layer.fontSize ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-fontsize-invalid' ) );
			} else {
				const fontSize = parseFloat( layer.fontSize );
				if ( fontSize < this.validationRules.minFontSize ||
					fontSize > this.validationRules.maxFontSize ) {
					result.isValid = false;
					result.errors.push(
						this.getMessage(
							'layers-validation-fontsize-range',
							this.validationRules.minFontSize,
							this.validationRules.maxFontSize
						)
					);
				}
			}
		}

		// Stroke width validation
		if ( layer.strokeWidth !== undefined ) {
			if ( !this.isValidNumber( layer.strokeWidth ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-strokewidth-invalid' ) );
			} else {
				const strokeWidth = parseFloat( layer.strokeWidth );
				if (
					strokeWidth < this.validationRules.minStrokeWidth ||
					strokeWidth > this.validationRules.maxStrokeWidth
				) {
					result.isValid = false;
					result.errors.push(
						this.getMessage(
							'layers-validation-strokewidth-range',
							this.validationRules.minStrokeWidth,
							this.validationRules.maxStrokeWidth
						)
					);
				}
			}
		}

		// Opacity validation
		if ( layer.opacity !== undefined ) {
			if ( !this.isValidNumber( layer.opacity ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-opacity-invalid' ) );
			} else {
				const opacity = parseFloat( layer.opacity );
				if (
					opacity < this.validationRules.minOpacity ||
					opacity > this.validationRules.maxOpacity
				) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-opacity-range',
						this.validationRules.minOpacity, this.validationRules.maxOpacity ) );
				}
			}
		}

		// Sides validation for polygons
		if ( layer.sides !== undefined ) {
			// Use parseFloat and modulo instead of Number.isInteger for IE11 compatibility
			const sidesNum = parseFloat( layer.sides );
			if ( !this.isValidNumber( layer.sides ) || ( sidesNum % 1 !== 0 ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-sides-invalid' ) );
			} else {
				const sides = parseInt( layer.sides );
				if (
					sides < this.validationRules.minSides ||
					sides > this.validationRules.maxSides
				) {
					result.isValid = false;
					result.errors.push(
						this.getMessage(
							'layers-validation-sides-range',
							this.validationRules.minSides,
							this.validationRules.maxSides
						)
					);
				}
			}
		}

		// Blur radius validation
		if ( layer.blurRadius !== undefined ) {
			if ( !this.isValidNumber( layer.blurRadius ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-blurradius-invalid' ) );
			} else {
				const blurRadius = parseFloat( layer.blurRadius );
				if (
					blurRadius < this.validationRules.minBlurRadius ||
					blurRadius > this.validationRules.maxBlurRadius
				) {
					result.isValid = false;
					result.errors.push(
						this.getMessage(
							'layers-validation-blurradius-range',
							this.validationRules.minBlurRadius,
							this.validationRules.maxBlurRadius
						)
					);
				}
			}
		}

		// Shadow blur validation
		if ( layer.shadowBlur !== undefined ) {
			if ( !this.isValidNumber( layer.shadowBlur ) ) {
				result.isValid = false;
				result.errors.push( 'Shadow blur must be a number' );
			} else {
				const shadowBlur = parseFloat( layer.shadowBlur );
				if ( shadowBlur < 0 || shadowBlur > 100 ) {
					result.isValid = false;
					result.errors.push( 'Shadow blur must be between 0 and 100' );
				}
			}
		}

		// Shadow offset validation
		if ( layer.shadowOffsetX !== undefined ) {
			if ( !this.isValidNumber( layer.shadowOffsetX ) ) {
				result.isValid = false;
				result.errors.push( 'Shadow offset X must be a number' );
			} else {
				const shadowOffsetX = parseFloat( layer.shadowOffsetX );
				if ( shadowOffsetX < -100 || shadowOffsetX > 100 ) {
					result.isValid = false;
					result.errors.push( 'Shadow offset X must be between -100 and 100' );
				}
			}
		}

		if ( layer.shadowOffsetY !== undefined ) {
			if ( !this.isValidNumber( layer.shadowOffsetY ) ) {
				result.isValid = false;
				result.errors.push( 'Shadow offset Y must be a number' );
			} else {
				const shadowOffsetY = parseFloat( layer.shadowOffsetY );
				if ( shadowOffsetY < -100 || shadowOffsetY > 100 ) {
					result.isValid = false;
					result.errors.push( 'Shadow offset Y must be between -100 and 100' );
				}
			}
		}

		// Shadow spread validation
		if ( layer.shadowSpread !== undefined ) {
			if ( !this.isValidNumber( layer.shadowSpread ) ) {
				result.isValid = false;
				result.errors.push( 'Shadow spread must be a number' );
			} else {
				const shadowSpread = parseFloat( layer.shadowSpread );
				if ( shadowSpread < 0 || shadowSpread > 50 ) {
					result.isValid = false;
					result.errors.push( 'Shadow spread must be between 0 and 50' );
				}
			}
		}

		// Arrow size validation
		if ( layer.arrowSize !== undefined ) {
			if ( !this.isValidNumber( layer.arrowSize ) ) {
				result.isValid = false;
				result.errors.push( 'Arrow size must be a number' );
			} else {
				const arrowSize = parseFloat( layer.arrowSize );
				if ( arrowSize < 1 || arrowSize > 100 ) {
					result.isValid = false;
					result.errors.push( 'Arrow size must be between 1 and 100' );
				}
			}
		}
	};

	/**
	 * Validate text content
	 *
	 * @param {Object} layer
	 * @param {Object} result
	 */
	LayersValidator.prototype.validateTextContent = function ( layer, result ) {
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
	};

	/**
	 * Validate color values
	 *
	 * @param {Object} layer
	 * @param {Object} result
	 */
	LayersValidator.prototype.validateColors = function ( layer, result ) {
		const colorFields = [ 'stroke', 'fill', 'textStrokeColor', 'textShadowColor', 'shadowColor' ];

		colorFields.forEach( ( field ) => {
			if ( layer[ field ] !== undefined ) {
				if ( !this.isValidColor( layer[ field ] ) ) {
					result.isValid = false;
					result.errors.push( this.getMessage( 'layers-validation-color-invalid', field ) );
				}
			}
		} );
	};

	/**
	 * Validate points array for path layers
	 *
	 * @param {Object} layer
	 * @param {Object} result
	 */
	LayersValidator.prototype.validatePoints = function ( layer, result ) {
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
	};

	LayersValidator.prototype.validateStarPointCount = function ( layer, result ) {
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
	};

	/**
	 * Validate type-specific properties
	 *
	 * @param {Object} layer
	 * @param {Object} result
	 */
	LayersValidator.prototype.validateTypeSpecificProperties = function ( layer, result ) {
		// Arrow style validation
		if ( layer.type === 'arrow' && layer.arrowStyle !== undefined ) {
			if ( !this.validationRules.validArrowStyles.includes( layer.arrowStyle ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-arrowstyle-invalid' ) );
			}
		}

		// Blend mode validation
		if ( layer.blendMode !== undefined || layer.blend !== undefined ) {
			const blendValue = layer.blendMode || layer.blend;
			if ( !this.validationRules.validBlendModes.includes( blendValue ) ) {
				result.isValid = false;
				result.errors.push( this.getMessage( 'layers-validation-blendmode-invalid' ) );
			}
		}
	};

	/**
	 * Validate a complete layers array (multiple layers)
	 *
	 * @param {Array} layers
	 * @param {number} maxLayers
	 * @return {Object} Validation result with isValid and errors properties
	 */
	LayersValidator.prototype.validateLayers = function ( layers, maxLayers ) {
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
	};

	/**
	 * Helper function to check if a value is a valid number
	 *
	 * @param {*} value
	 * @return {boolean} True if value is a valid number
	 */
	LayersValidator.prototype.isValidNumber = function ( value ) {
		return typeof value === 'number' && !isNaN( value ) && isFinite( value );
	};

	/**
	 * Helper function to validate color values
	 *
	 * @param {string} color
	 * @return {boolean} True if color is valid
	 */
	LayersValidator.prototype.isValidColor = function ( color ) {
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
					( parseInt( matches[ i ] ) < 0 || parseInt( matches[ i ] ) > 255 )
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
				( parseInt( hslMatches[ 1 ] ) < 0 || parseInt( hslMatches[ 1 ] ) > 360 )
			) {
				return false;
			}
			if (
				hslMatches[ 2 ] &&
				( parseInt( hslMatches[ 2 ] ) < 0 || parseInt( hslMatches[ 2 ] ) > 100 )
			) {
				return false;
			}
			if (
				hslMatches[ 3 ] &&
				( parseInt( hslMatches[ 3 ] ) < 0 || parseInt( hslMatches[ 3 ] ) > 100 )
			) {
				return false;
			}
			return true;
		}

		// Strict whitelist of named colors
		const safeColors = [
			'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
			'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime',
			'navy', 'maroon', 'olive', 'teal', 'silver', 'aqua', 'fuchsia'
		];

		return safeColors.includes( color.toLowerCase() );
	};

	/**
	 * Check for potential script injection in text content
	 *
	 * @param {string} text
	 * @return {boolean} True if text contains potential script injection
	 */
	LayersValidator.prototype.containsScriptInjection = function ( text ) {
		return /<script|javascript:|data:|vbscript:|on\w+\s*=/i.test( text );
	};

	/**
	 * Get localized message or fallback
	 *
	 * @param key
	 */
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
	LayersValidator.prototype.getMessage = function ( key ) {
		const args = Array.prototype.slice.call( arguments, 1 );

		// Fallback messages in English (used when i18n unavailable)
		const fallbacks = {
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
			'layers-validation-duplicate-id': 'Duplicate layer ID: $1'
		};

		const fallback = fallbacks[ key ] || key;

		// Use MessageHelper if available (handles mw.message delegation)
		if ( window.layersMessages && typeof window.layersMessages.getWithParams === 'function' ) {
			if ( args.length > 0 ) {
				return window.layersMessages.getWithParams.apply( window.layersMessages, [ key ].concat( args ) ) || fallback;
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
	};

	/**
	 * Show validation errors to the user
	 *
	 * @param {Array<string>} errors Array of error messages
	 * @param {Object} [context] Context information (unused)
	 */
	// eslint-disable-next-line no-unused-vars
	LayersValidator.prototype.showValidationErrors = function ( errors, context ) {
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
	};

	/**
	 * Create input validation helper for real-time validation
	 *
	 * @param {*} input
	 * @param {string} validationType
	 * @param {Object} options
	 * @return {Object} Input validator with enable and disable methods
	 */
	LayersValidator.prototype.createInputValidator = function ( input, validationType, options ) {
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

		return {
			validate: validate,
			destroy: () => {
				hideError();
				input.removeEventListener( 'input', validate );
				input.removeEventListener( 'blur', validate );
			}
		};
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Validation = window.Layers.Validation || {};
		window.Layers.Validation.LayersValidator = LayersValidator;

		// Backward compatibility - direct window export
		window.LayersValidator = LayersValidator;
	}

}() );
