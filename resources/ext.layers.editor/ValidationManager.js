/**
 * Validation Manager for Layers Editor
 * Handles data validation and sanitization
 */
class ValidationManager {
	constructor( editor ) {
		this.editor = editor;
	}

	/**
	 * Sanitize layer data before processing
	 */
	sanitizeLayerData( layerData ) {
		if ( !layerData || typeof layerData !== 'object' ) {
			return layerData;
		}

		// Handle arrays separately to preserve array type
		if ( Array.isArray( layerData ) ) {
			return layerData.map( item => this.sanitizeLayerData( item ) );
		}

		const sanitized = {};
		for ( const key in layerData ) {
			if ( Object.prototype.hasOwnProperty.call( layerData, key ) ) {
				if ( typeof layerData[ key ] === 'string' ) {
					sanitized[ key ] = this.sanitizeString( layerData[ key ] );
				} else if ( Array.isArray( layerData[ key ] ) ) {
					// Preserve array type (important for points array in path layers)
					sanitized[ key ] = layerData[ key ].map( item => this.sanitizeLayerData( item ) );
				} else if ( typeof layerData[ key ] === 'object' && layerData[ key ] !== null ) {
					sanitized[ key ] = this.sanitizeLayerData( layerData[ key ] );
				} else {
					sanitized[ key ] = layerData[ key ];
				}
			}
		}
		return sanitized;
	}

	/**
	 * Sanitize string input
	 */
	sanitizeString( input ) {
		if ( typeof input !== 'string' ) {
			return '';
		}
		return input
			.replace( /[<>]/g, '' )
			.replace( /javascript:/gi, '' )
			.replace( /on\w+\s*=/gi, '' )
			.trim();
	}

	/**
	 * Sanitize input for general use
	 */
	sanitizeInput( input ) {
		return this.sanitizeString( input );
	}

	/**
	 * Validate layer data structure
	 */
	validateLayer( layer ) {
		const errors = [];

		if ( !layer.id || typeof layer.id !== 'string' ) {
			errors.push( this.getMessage( 'layers-validation-id-required' ) );
		}

		if ( !layer.type || typeof layer.type !== 'string' ) {
			errors.push( this.getMessage( 'layers-validation-type-required' ) );
		} else {
			const validTypes = [ 'text', 'textbox', 'callout', 'arrow', 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'path', 'blur', 'image', 'group', 'customShape' ];
			if ( !validTypes.includes( layer.type ) ) {
				errors.push( this.getMessage( 'layers-validation-type-invalid' ) );
			}
		}

		// Validate coordinates
		const coordFields = [ 'x', 'y', 'width', 'height', 'radius', 'radiusX', 'radiusY', 'rotation' ];
		coordFields.forEach( field => {
			if ( layer[ field ] !== undefined && ( typeof layer[ field ] !== 'number' || isNaN( layer[ field ] ) ) ) {
				errors.push( this.getMessage( 'layers-validation-coordinate-invalid' ).replace( '$1', field ) );
			}
		} );

		// Validate text-specific fields
		if ( layer.type === 'text' ) {
			if ( layer.text && typeof layer.text !== 'string' ) {
				errors.push( this.getMessage( 'layers-validation-text-type' ) );
			}
			if ( layer.text && layer.text.length > 1000 ) {
				errors.push( this.getMessage( 'layers-validation-text-too-long' ) );
			}
			// FIX 2025-11-14: Updated max from 200 to 1000
			if ( layer.fontSize && ( typeof layer.fontSize !== 'number' || layer.fontSize < 8 || layer.fontSize > 1000 ) ) {
				errors.push( this.getMessage( 'layers-validation-fontsize-range' ) );
			}
		}

		// Validate stroke width
		if ( layer.strokeWidth && ( typeof layer.strokeWidth !== 'number' || layer.strokeWidth < 0 || layer.strokeWidth > 50 ) ) {
			errors.push( this.getMessage( 'layers-validation-strokewidth-range' ) );
		}

		// Validate opacity
		const opacityFields = [ 'opacity', 'fillOpacity', 'strokeOpacity' ];
		opacityFields.forEach( field => {
			if ( layer[ field ] !== undefined && ( typeof layer[ field ] !== 'number' || layer[ field ] < 0 || layer[ field ] > 1 ) ) {
				errors.push( this.getMessage( 'layers-validation-opacity-range' ) );
			}
		} );

		// Validate sides for polygons/stars
		if ( ( layer.type === 'polygon' || layer.type === 'star' ) && layer.sides ) {
			if ( typeof layer.sides !== 'number' || layer.sides < 3 || layer.sides > 20 ) {
				errors.push( this.getMessage( 'layers-validation-sides-range' ) );
			}
		}

		// Validate blur radius
		const blurFields = [ 'shadowBlur', 'glowBlur' ];
		blurFields.forEach( field => {
			if ( layer[ field ] && ( typeof layer[ field ] !== 'number' || layer[ field ] < 0 || layer[ field ] > 100 ) ) {
				errors.push( this.getMessage( 'layers-validation-blurradius-range' ) );
			}
		} );

		return {
			isValid: errors.length === 0,
			errors: errors
		};
	}

	/**
	 * Validate all layers
	 */
	validateLayers( layers, maxCount = 100 ) {
		const errors = [];
		const warnings = [];

		if ( !Array.isArray( layers ) ) {
			errors.push( this.getMessage( 'layers-validation-layers-array' ) );
			return { isValid: false, errors, warnings };
		}

		if ( layers.length > maxCount ) {
			errors.push( this.getMessage( 'layers-validation-too-many-layers' ) );
			return { isValid: false, errors, warnings };
		}

		const ids = new Set();
		layers.forEach( ( layer, index ) => {
			const layerValidation = this.validateLayer( layer );
			if ( !layerValidation.isValid ) {
				errors.push( `Layer ${ index + 1 }: ${ layerValidation.errors.join( ', ' ) }` );
			}

			// Check for duplicate IDs
			if ( layer.id ) {
				if ( ids.has( layer.id ) ) {
					errors.push( this.getMessage( 'layers-validation-duplicate-id' ).replace( '$1', layer.id ) );
				}
				ids.add( layer.id );
			}
		} );

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Check browser compatibility
	 */
	checkBrowserCompatibility() {
		const requiredFeatures = [
			'HTMLCanvasElement' in window,
			'JSON' in window,
			'addEventListener' in document,
			'querySelector' in document,
			'FileReader' in window,
			'Blob' in window
		];

		if ( window.HTMLCanvasElement ) {
			try {
				const testCanvas = document.createElement( 'canvas' );
				const ctx = testCanvas.getContext( '2d' );
				requiredFeatures.push( !!ctx );
			} catch ( e ) {
				requiredFeatures.push( false );
			}
		}

		return requiredFeatures.every( feature => feature === true );
	}

	/**
	 * Sanitize log messages for security
	 */
	sanitizeLogMessage( message ) {
		if ( typeof message !== 'string' ) {
			if ( typeof message === 'object' && message !== null ) {
				const safeKeys = [ 'type', 'action', 'status', 'tool', 'layer', 'count', 'x', 'y', 'width', 'height' ];
				const obj = {};
				for ( const key in message ) {
					if ( Object.prototype.hasOwnProperty.call( message, key ) ) {
						if ( safeKeys.includes( key ) ) {
							obj[ key ] = message[ key ];
						} else {
							obj[ key ] = '[FILTERED]';
						}
					}
				}
				return obj;
			}
			return message;
		}

		let result = String( message );

		// Remove potentially sensitive patterns
		result = result.replace( /[a-zA-Z0-9+/=]{20,}/g, '[TOKEN]' );
		result = result.replace( /[a-fA-F0-9]{16,}/g, '[HEX]' );
		result = result.replace( /\/[\w\s.-]+/g, '[PATH]' );
		result = result.replace( /https?:\/\/[^\s'"<>&]*/gi, '[URL]' );
		result = result.replace( /\w+:\/\/[^\s'"<>&]*/gi, '[CONNECTION]' );
		result = result.replace( /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]' );
		result = result.replace( /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]' );

		if ( result.length > 200 ) {
			result = result.slice( 0, 200 ) + '[TRUNCATED]';
		}

		return result;
	}

	getMessage( key, fallback = '' ) {
		return window.layersMessages.get( key, fallback );
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.editor = null;
	}
}

// Export to window.Layers namespace
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.Validation = window.Layers.Validation || {};
	window.Layers.Validation.Manager = ValidationManager;
}

// CommonJS export for Jest testing
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = ValidationManager;
}