/**
 * Validation Manager for Layers Editor
 * Handles data validation and sanitization
 *
 * @class ValidationManager
 */
( function () {
	'use strict';

class ValidationManager {
	/**
	 * Creates a new ValidationManager instance
	 *
	 * @param {Object} editor - Reference to the LayersEditor instance
	 */
	constructor( editor ) {
		this.editor = editor;
	}

	/**
	 * Sanitize layer data before processing
	 * Recursively sanitizes all string properties to remove dangerous content
	 *
	 * @param {Object|Array|*} layerData - Layer data to sanitize
	 * @return {Object|Array|*} Sanitized layer data
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
					// SVG strings need special handling - they contain valid < and > characters
					// Security is handled server-side in ServerSideLayerValidator::validateSvgString()
					if ( key === 'svg' ) {
						sanitized[ key ] = this.sanitizeSvgString( layerData[ key ] );
					} else {
						sanitized[ key ] = this.sanitizeString( layerData[ key ] );
					}
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
	 * Sanitize SVG string input using DOM parser for robust defense-in-depth.
	 * Removes dangerous elements (script, style, foreignObject, etc.),
	 * dangerous attributes (event handlers, javascript:/vbscript: URLs),
	 * and dangerous CSS patterns. Falls back to regex stripping if DOM
	 * parsing is unavailable.
	 *
	 * Note: Server-side validation in ServerSideLayerValidator::validateSvgString()
	 * is the primary security boundary. This is defense-in-depth.
	 *
	 * @param {string} input - SVG string to sanitize
	 * @return {string} Sanitized SVG string
	 */
	sanitizeSvgString( input ) {
		if ( typeof input !== 'string' ) {
			return '';
		}

		// Dangerous elements to remove entirely (lowercase for comparison)
		const DANGEROUS_ELEMENTS = [
			'script', 'style', 'foreignobject', 'iframe', 'object',
			'embed', 'form', 'input', 'textarea', 'button', 'select',
			'link', 'meta', 'base'
		];
		// Include camelCase variants needed for XML-case-sensitive getElementsByTagName
		const DANGEROUS_ELEMENTS_VARIANTS = [
			...DANGEROUS_ELEMENTS, 'foreignObject'
		];

		// Dangerous URL schemes
		const DANGEROUS_URL_RE = /^\s*(javascript|vbscript|data\s*:\s*text\/html)/i;

		// Dangerous CSS patterns
		const DANGEROUS_CSS_RE = /(expression|javascript|vbscript|-moz-binding|behavior|@import)/i;

		// URL-bearing attributes
		const URL_ATTRS = [ 'href', 'xlink:href', 'src', 'action', 'formaction' ];

		try {
			if ( typeof DOMParser === 'undefined' ) {
				throw new Error( 'DOMParser not available' );
			}

			const parser = new DOMParser();
			const doc = parser.parseFromString( input, 'image/svg+xml' );

			// Check for XML parse error
			if ( doc.querySelector( 'parsererror' ) ) {
				return '';
			}

			// Remove dangerous elements (case-insensitive for XML/SVG)
			for ( const tag of DANGEROUS_ELEMENTS_VARIANTS ) {
				const elements = doc.getElementsByTagName( tag );
				while ( elements.length > 0 ) {
					elements[ 0 ].parentNode.removeChild( elements[ 0 ] );
				}
			}

			// Walk all remaining elements and sanitize attributes
			const allElements = doc.querySelectorAll( '*' );
			for ( const el of allElements ) {
				// Check if element tag is dangerous (case-insensitive catch-all)
				if ( DANGEROUS_ELEMENTS.includes( el.tagName.toLowerCase() ) ) {
					el.parentNode.removeChild( el );
					continue;
				}
				const attrs = Array.from( el.attributes );
				for ( const attr of attrs ) {
					const name = attr.name.toLowerCase();
					const value = ( attr.value || '' ).trim();

					// Remove event handler attributes (onclick, onload, etc.)
					if ( /^on/i.test( name ) ) {
						el.removeAttribute( attr.name );
						continue;
					}

					// Remove dangerous URL schemes from href-like attributes
					if ( URL_ATTRS.includes( name ) ) {
						if ( DANGEROUS_URL_RE.test( value ) ) {
							el.removeAttribute( attr.name );
							continue;
						}
					}

					// Remove dangerous CSS patterns from style attributes
					if ( name === 'style' && DANGEROUS_CSS_RE.test( value ) ) {
						el.removeAttribute( attr.name );
					}
				}
			}

			// Serialize back to string
			return new XMLSerializer().serializeToString( doc.documentElement );
		} catch ( e ) {
			// Fallback: regex stripping if DOM parsing unavailable or fails
			return input
				.replace( /<\s*\/?\s*(script|style|iframe|foreignobject|object|embed|form|input|textarea|button|select|link|meta|base)\b[^>]*>/gi, '' )
				.replace( /javascript\s*:/gi, '' )
				.replace( /vbscript\s*:/gi, '' )
				.replace( /on\w+\s*=/gi, '' )
				.trim();
		}
	}

	/**
	 * Sanitize string input
	 * Removes HTML tags and dangerous content
	 *
	 * @param {string} input - String to sanitize
	 * @return {string} Sanitized string
	 */
	sanitizeString( input ) {
		if ( typeof input !== 'string' ) {
			return '';
		}
		// Strip dangerous HTML tags (script, style, iframe, etc.) but preserve
		// standalone < and > characters for math expressions (e.g., x < 5).
		// Canvas2D fillText/strokeText renders text literally — it does not
		// parse HTML, so angle brackets are harmless in this context.
		return input
			.replace( /<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|button|select|link|meta|base)\b[^>]*>/gi, '' )
			.replace( /javascript:/gi, '' )
			.replace( /on\w+\s*=/gi, '' )
			.trim();
	}

	/**
	 * Sanitize input for general use
	 * Alias for sanitizeString for compatibility
	 *
	 * @param {string} input - Input string to sanitize
	 * @return {string} Sanitized string
	 */
	sanitizeInput( input ) {
		return this.sanitizeString( input );
	}

	/**
	 * Validate layer data structure
	 * Checks required fields, types, and value ranges
	 *
	 * @param {Object} layer - Layer object to validate
	 * @return {{isValid: boolean, errors: string[]}} Validation result
	 */
	validateLayer( layer ) {
		const errors = [];

		if ( !layer.id || typeof layer.id !== 'string' ) {
			errors.push( this.getMessage( 'layers-validation-id-required' ) );
		}

		if ( !layer.type || typeof layer.type !== 'string' ) {
			errors.push( this.getMessage( 'layers-validation-type-required' ) );
		} else {
			const validTypes = [ 'text', 'textbox', 'callout', 'arrow', 'rectangle', 'circle', 'ellipse', 'polygon', 'star', 'line', 'path', 'blur', 'image', 'group', 'customShape', 'marker', 'dimension', 'angleDimension' ];
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
	 * Checks layer count limits, individual layer validity, and duplicate IDs
	 *
	 * @param {Array} layers - Array of layer objects to validate
	 * @param {number} [maxCount=100] - Maximum allowed number of layers
	 * @return {{isValid: boolean, errors: string[], warnings: string[]}} Validation result
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
	 * Verifies required browser APIs are available
	 *
	 * @return {boolean} True if browser meets requirements
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
	 * Removes sensitive data like tokens, URLs, IPs, and emails before logging
	 *
	 * @param {string|Object|*} message - Message to sanitize
	 * @return {string|Object|*} Sanitized message safe for logging
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

	/**
	 * Get an i18n message by key
	 *
	 * @param {string} key - Message key
	 * @param {string} [fallback=''] - Fallback if message not found
	 * @return {string} Localized message or fallback
	 */
	getMessage( key, fallback = '' ) {
		if ( !window.layersMessages ) {
			return fallback || key;
		}
		return window.layersMessages.get( key, fallback );
	}

	/**
	 * Clean up resources
	 * Should be called when the editor is destroyed
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

}() );