/**
 * Preset Storage Manager for Layers Editor
 *
 * Handles localStorage operations for style presets including
 * loading, saving, export, and import functionality.
 *
 * @module PresetStorage
 */
( function () {
	'use strict';

	const DEFAULT_STORAGE_KEY = 'mw-layers-style-presets';
	const SCHEMA_VERSION = 1;

	/**
	 * Allowed style properties for sanitization
	 *
	 * @type {string[]}
	 */
	const ALLOWED_STYLE_PROPERTIES = [
		// Stroke
		'stroke', 'strokeWidth', 'strokeOpacity',
		// Fill
		'fill', 'fillOpacity',
		// Text
		'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
		'textAlign', 'verticalAlign', 'lineHeight', 'padding',
		// Text stroke
		'textStrokeColor', 'textStrokeWidth',
		// Shape
		'cornerRadius',
		// Arrow
		'arrowStyle', 'arrowhead', 'arrowSize', 'arrowHeadType', 'headScale', 'tailWidth',
		// Polygon/Star
		'sides', 'points', 'innerRadius', 'outerRadius', 'pointRadius', 'valleyRadius',
		// Shadow
		'shadow', 'shadowColor', 'shadowBlur',
		'shadowOffsetX', 'shadowOffsetY', 'shadowSpread',
		// Text shadow
		'textShadow', 'textShadowColor', 'textShadowBlur',
		'textShadowOffsetX', 'textShadowOffsetY',
		// Glow
		'glow',
		// Blend mode
		'blendMode',
		// Opacity
		'opacity'
	];

	/**
	 * PresetStorage class
	 *
	 * Manages localStorage operations for preset data
	 */
	class PresetStorage {
		/**
		 * Create a PresetStorage instance
		 *
		 * @param {Object} [options] Configuration options
		 * @param {string} [options.storageKey] Custom storage key
		 * @param {string[]} [options.supportedTools] List of supported tool types
		 */
		constructor( options ) {
			const opts = options || {};

			/**
			 * Storage key for localStorage
			 *
			 * @type {string}
			 */
			this.storageKey = opts.storageKey || DEFAULT_STORAGE_KEY;

			/**
			 * Supported tool types
			 *
			 * @type {string[]}
			 */
			this.supportedTools = opts.supportedTools || [
				'arrow', 'text', 'textbox', 'rectangle', 'circle',
				'ellipse', 'line', 'polygon', 'star', 'path'
			];
		}

		/**
		 * Load presets from localStorage
		 *
		 * @return {Object|null} Loaded data or null if not found/invalid
		 */
		load() {
			try {
				const stored = localStorage.getItem( this.storageKey );
				if ( stored ) {
					const parsed = JSON.parse( stored );
					if ( parsed.version === SCHEMA_VERSION ) {
						return parsed;
					}
					// Future: handle migrations here
					this.logWarn( 'Schema version mismatch, ignoring stored data' );
				}
			} catch ( err ) {
				this.logError( 'Failed to load presets:', err );
			}
			return null;
		}

		/**
		 * Save presets to localStorage
		 *
		 * @param {Object} data Data to save
		 * @return {boolean} Success
		 */
		save( data ) {
			try {
				// Ensure version is set
				const saveData = {
					...data,
					version: SCHEMA_VERSION
				};
				localStorage.setItem( this.storageKey, JSON.stringify( saveData ) );
				return true;
			} catch ( err ) {
				this.logError( 'Failed to save presets:', err );
				return false;
			}
		}

		/**
		 * Create empty preset data structure
		 *
		 * @return {Object} Empty data structure
		 */
		createEmptyData() {
			const data = {
				version: SCHEMA_VERSION,
				toolPresets: {},
				defaultPresets: {}
			};

			// Initialize empty arrays for each supported tool
			this.supportedTools.forEach( ( tool ) => {
				data.toolPresets[ tool ] = [];
			} );

			return data;
		}

		/**
		 * Clear all stored data
		 *
		 * @return {boolean} Success
		 */
		clear() {
			try {
				localStorage.removeItem( this.storageKey );
				return true;
			} catch ( err ) {
				this.logError( 'Failed to clear presets:', err );
				return false;
			}
		}

		/**
		 * Check if storage is available
		 *
		 * @return {boolean} True if localStorage is available
		 */
		isAvailable() {
			try {
				const testKey = '__preset_storage_test__';
				localStorage.setItem( testKey, 'test' );
				localStorage.removeItem( testKey );
				return true;
			} catch ( err ) {
				return false;
			}
		}

		/**
		 * Export presets to JSON string
		 *
		 * @param {Object} data Data to export
		 * @param {Object} [options] Export options
		 * @param {boolean} [options.includeBuiltIn] Include built-in presets (default: false)
		 * @return {string} JSON string
		 */
		exportToJson( data, options ) {
			const opts = Object.assign( { includeBuiltIn: false }, options );

			const exportData = {
				version: SCHEMA_VERSION,
				exportedAt: new Date().toISOString(),
				toolPresets: {},
				defaultPresets: { ...( data.defaultPresets || {} ) }
			};

			// Export presets, optionally filtering out built-ins
			this.supportedTools.forEach( ( tool ) => {
				const presets = ( data.toolPresets && data.toolPresets[ tool ] ) || [];
				const filtered = opts.includeBuiltIn ?
					presets :
					presets.filter( ( p ) => !p.builtIn );

				if ( filtered.length > 0 ) {
					exportData.toolPresets[ tool ] = filtered;
				}
			} );

			return JSON.stringify( exportData, null, 2 );
		}

		/**
		 * Import presets from JSON string
		 *
		 * @param {string} jsonString JSON string to import
		 * @param {Object} currentData Current preset data
		 * @param {Object} [options] Import options
		 * @param {boolean} [options.merge] Merge with existing (default: true)
		 * @param {boolean} [options.overwrite] Overwrite duplicates (default: false)
		 * @return {Object} Import result { success, data, imported, skipped, errors }
		 */
		importFromJson( jsonString, currentData, options ) {
			const opts = Object.assign( { merge: true, overwrite: false }, options );
			const result = {
				success: false,
				data: null,
				imported: 0,
				skipped: 0,
				errors: []
			};

			// Parse JSON
			let importData;
			try {
				importData = JSON.parse( jsonString );
			} catch ( err ) {
				result.errors.push( 'Invalid JSON format' );
				return result;
			}

			// Validate structure
			if ( !importData.version || !importData.toolPresets ) {
				result.errors.push( 'Invalid preset file format' );
				return result;
			}

			// Start with current data or empty
			let newData;
			if ( opts.merge && currentData ) {
				newData = JSON.parse( JSON.stringify( currentData ) );
			} else {
				newData = this.createEmptyData();
			}

			// Import presets for each tool
			Object.keys( importData.toolPresets ).forEach( ( tool ) => {
				if ( !this.supportedTools.includes( tool ) ) {
					result.errors.push( `Unsupported tool: ${ tool }` );
					return;
				}

				const presets = importData.toolPresets[ tool ];
				if ( !Array.isArray( presets ) ) {
					return;
				}

				if ( !newData.toolPresets[ tool ] ) {
					newData.toolPresets[ tool ] = [];
				}

				presets.forEach( ( preset ) => {
					// Validate required fields
					if ( !preset.id || !preset.name || !preset.style ) {
						result.skipped++;
						return;
					}

					// Check for existing
					const existingIndex = newData.toolPresets[ tool ]
						.findIndex( ( p ) => p.id === preset.id );

					if ( existingIndex !== -1 ) {
						if ( opts.overwrite ) {
							// Remove existing
							newData.toolPresets[ tool ].splice( existingIndex, 1 );
						} else {
							result.skipped++;
							return;
						}
					}

					// Add preset
					newData.toolPresets[ tool ].push( {
						...preset,
						builtIn: false,
						importedAt: new Date().toISOString()
					} );
					result.imported++;
				} );
			} );

			// Import default preferences
			if ( importData.defaultPresets ) {
				newData.defaultPresets = {
					...newData.defaultPresets,
					...importData.defaultPresets
				};
			}

			result.success = true;
			result.data = newData;

			return result;
		}

		/**
		 * Sanitize a style object (remove invalid properties)
		 *
		 * @param {Object} style Style object
		 * @return {Object} Sanitized style
		 */
		sanitizeStyle( style ) {
			const sanitized = {};

			ALLOWED_STYLE_PROPERTIES.forEach( ( prop ) => {
				if ( style[ prop ] !== undefined ) {
					sanitized[ prop ] = style[ prop ];
				}
			} );

			return sanitized;
		}

		/**
		 * Extract style properties from a layer
		 *
		 * @param {Object} layer Layer object
		 * @return {Object} Style properties
		 */
		extractStyleFromLayer( layer ) {
			const style = {};

			ALLOWED_STYLE_PROPERTIES.forEach( ( prop ) => {
				if ( layer[ prop ] !== undefined ) {
					style[ prop ] = layer[ prop ];
				}
			} );

			return style;
		}

		/**
		 * Generate unique preset ID
		 *
		 * @param {string} tool Tool type
		 * @param {string} name Preset name
		 * @return {string} Unique ID
		 */
		generateId( tool, name ) {
			const slug = name.toLowerCase()
				.replace( /[^a-z0-9]+/g, '-' )
				.replace( /^-|-$/g, '' );
			const timestamp = Date.now().toString( 36 );
			return `${ tool }-${ slug }-${ timestamp }`;
		}

		/**
		 * Get storage size in bytes
		 *
		 * @return {number} Size in bytes, or -1 if error
		 */
		getStorageSize() {
			try {
				const data = localStorage.getItem( this.storageKey );
				return data ? new Blob( [ data ] ).size : 0;
			} catch ( err ) {
				return -1;
			}
		}

		/**
		 * Log warning message
		 *
		 * @param {...*} args Log arguments
		 */
		logWarn( ...args ) {
			if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
				mw.log.warn( '[PresetStorage]', ...args );
			}
		}

		/**
		 * Log error message
		 *
		 * @param {...*} args Log arguments
		 */
		logError( ...args ) {
			if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
				mw.log.error( '[PresetStorage]', ...args );
			}
		}
	}

	// Expose constants
	PresetStorage.STORAGE_KEY = DEFAULT_STORAGE_KEY;
	PresetStorage.SCHEMA_VERSION = SCHEMA_VERSION;
	PresetStorage.ALLOWED_STYLE_PROPERTIES = ALLOWED_STYLE_PROPERTIES;

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.PresetStorage = PresetStorage;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PresetStorage;
	}
}() );
