/**
 * Style Preset Manager for Layers Editor
 *
 * Manages tool-specific style presets stored in localStorage.
 * Allows users to save, load, and manage reusable style configurations.
 *
 * Delegates to:
 * - BuiltInPresets: Built-in preset definitions
 * - PresetStorage: localStorage operations
 *
 * @class PresetManager
 */
( function () {
	'use strict';

	// Get dependencies from Layers namespace or require for testing
	const getBuiltInPresets = () => {
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.BuiltInPresets ) {
			return window.Layers.BuiltInPresets;
		}
		/* eslint-disable-next-line no-undef */
		if ( typeof require !== 'undefined' ) {
			try {
				/* eslint-disable-next-line no-undef */
				return require( './BuiltInPresets' );
			} catch ( e ) {
				return null;
			}
		}
		return null;
	};

	const getPresetStorage = () => {
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.PresetStorage ) {
			return window.Layers.PresetStorage;
		}
		/* eslint-disable-next-line no-undef */
		if ( typeof require !== 'undefined' ) {
			try {
				/* eslint-disable-next-line no-undef */
				return require( './PresetStorage' );
			} catch ( e ) {
				return null;
			}
		}
		return null;
	};

	/**
	 * PresetManager class
	 */
	class PresetManager {
		/**
		 * Create a PresetManager instance
		 *
		 * @param {Object} [options] Configuration options
		 * @param {string} [options.storageKey] Custom storage key
		 */
		constructor( options ) {
			const opts = options || {};

			// Get dependencies
			const BuiltInPresets = getBuiltInPresets();
			const PresetStorage = getPresetStorage();

			/**
			 * Built-in presets provider
			 *
			 * @type {Object}
			 */
			this.builtInPresets = BuiltInPresets;

			/**
			 * Storage manager
			 *
			 * @type {PresetStorage}
			 */
			this.storage = PresetStorage ? new PresetStorage( opts ) : null;

			/**
			 * Storage key for localStorage (for backward compatibility)
			 *
			 * @type {string}
			 */
			this.storageKey = opts.storageKey || 'mw-layers-style-presets';

			/**
			 * Cached preset data
			 *
			 * @type {Object|null}
			 */
			this.cache = null;

			/**
			 * Change listeners
			 *
			 * @type {Function[]}
			 */
			this.listeners = [];

			// Load initial data
			this.load();
		}

		/**
		 * Load presets from localStorage
		 *
		 * @return {Object} Loaded preset data
		 */
		load() {
			if ( this.storage ) {
				const loaded = this.storage.load();
				this.cache = loaded || this.storage.createEmptyData();
			} else {
				// Fallback if storage not available
				this.cache = this.createEmptyData();
			}
			return this.cache;
		}

		/**
		 * Create empty preset data structure (fallback)
		 *
		 * @return {Object} Empty data structure
		 */
		createEmptyData() {
			if ( this.storage ) {
				return this.storage.createEmptyData();
			}

			const supportedTools = this.getSupportedTools();
			const data = {
				version: 1,
				toolPresets: {},
				defaultPresets: {}
			};
			supportedTools.forEach( ( tool ) => {
				data.toolPresets[ tool ] = [];
			} );
			return data;
		}

		/**
		 * Save presets to localStorage
		 *
		 * @return {boolean} Success
		 */
		save() {
			let success = false;
			if ( this.storage ) {
				success = this.storage.save( this.cache );
			}
			if ( success ) {
				this.notifyListeners( 'save' );
			}
			return success;
		}

		/**
		 * Get all presets for a tool (built-in + user)
		 *
		 * @param {string} tool Tool type (e.g., 'arrow', 'text')
		 * @return {Array} Array of preset objects
		 */
		getPresetsForTool( tool ) {
			if ( !this.isToolSupported( tool ) ) {
				return [];
			}

			const builtIn = this.builtInPresets ?
				this.builtInPresets.getForTool( tool ) :
				[];
			const user = ( this.cache && this.cache.toolPresets[ tool ] ) || [];

			// Combine: built-in first, then user presets
			return [ ...builtIn, ...user ];
		}

		/**
		 * Get a specific preset by ID
		 *
		 * @param {string} tool Tool type
		 * @param {string} presetId Preset ID
		 * @return {Object|null} Preset object or null
		 */
		getPreset( tool, presetId ) {
			const presets = this.getPresetsForTool( tool );
			return presets.find( ( p ) => p.id === presetId ) || null;
		}

		/**
		 * Get the default preset for a tool
		 *
		 * @param {string} tool Tool type
		 * @return {Object|null} Default preset or null
		 */
		getDefaultPreset( tool ) {
			if ( !this.cache ) {
				return null;
			}

			const defaultId = this.cache.defaultPresets[ tool ];
			if ( defaultId ) {
				return this.getPreset( tool, defaultId );
			}

			// Fall back to first built-in preset
			return this.builtInPresets ?
				this.builtInPresets.getDefault( tool ) :
				null;
		}

		/**
		 * Set the default preset for a tool
		 *
		 * @param {string} tool Tool type
		 * @param {string} presetId Preset ID to set as default
		 * @return {boolean} Success
		 */
		setDefaultPreset( tool, presetId ) {
			if ( !this.isToolSupported( tool ) ) {
				return false;
			}

			// Verify preset exists
			const preset = this.getPreset( tool, presetId );
			if ( !preset ) {
				return false;
			}

			this.cache.defaultPresets[ tool ] = presetId;
			this.save();
			this.notifyListeners( 'default-changed', { tool, presetId } );
			return true;
		}

		/**
		 * Clear the default preset for a tool (use built-in default)
		 *
		 * @param {string} tool Tool type
		 */
		clearDefaultPreset( tool ) {
			if ( this.cache && this.cache.defaultPresets[ tool ] ) {
				delete this.cache.defaultPresets[ tool ];
				this.save();
				this.notifyListeners( 'default-cleared', { tool } );
			}
		}

		/**
		 * Add a new user preset
		 *
		 * @param {string} tool Tool type
		 * @param {string} name Preset name
		 * @param {Object} style Style properties
		 * @param {Object} [options] Additional options
		 * @param {boolean} [options.setAsDefault] Set as default for this tool
		 * @return {Object|null} Created preset or null on failure
		 */
		addPreset( tool, name, style, options ) {
			if ( !this.isToolSupported( tool ) ) {
				this.logError( 'Unsupported tool type:', tool );
				return null;
			}

			if ( !name || typeof name !== 'string' ) {
				this.logError( 'Invalid preset name' );
				return null;
			}

			if ( !style || typeof style !== 'object' ) {
				this.logError( 'Invalid style object' );
				return null;
			}

			const opts = options || {};
			const id = this.generateId( tool, name );

			const preset = {
				id: id,
				name: name.trim(),
				builtIn: false,
				createdAt: new Date().toISOString(),
				style: this.sanitizeStyle( style )
			};

			// Add to cache
			if ( !this.cache.toolPresets[ tool ] ) {
				this.cache.toolPresets[ tool ] = [];
			}
			this.cache.toolPresets[ tool ].push( preset );

			// Optionally set as default
			if ( opts.setAsDefault ) {
				this.cache.defaultPresets[ tool ] = id;
			}

			this.save();
			this.notifyListeners( 'preset-added', { tool, preset } );

			return preset;
		}

		/**
		 * Update an existing user preset
		 *
		 * @param {string} tool Tool type
		 * @param {string} presetId Preset ID
		 * @param {Object} updates Properties to update
		 * @return {boolean} Success
		 */
		updatePreset( tool, presetId, updates ) {
			const presets = this.cache.toolPresets[ tool ];
			if ( !presets ) {
				return false;
			}

			const index = presets.findIndex( ( p ) => p.id === presetId );
			if ( index === -1 ) {
				return false;
			}

			const preset = presets[ index ];

			// Cannot update built-in presets
			if ( preset.builtIn ) {
				this.logError( 'Cannot update built-in preset' );
				return false;
			}

			// Apply updates
			if ( updates.name ) {
				preset.name = updates.name.trim();
			}
			if ( updates.style ) {
				preset.style = this.sanitizeStyle( updates.style );
			}
			preset.updatedAt = new Date().toISOString();

			this.save();
			this.notifyListeners( 'preset-updated', { tool, preset } );

			return true;
		}

		/**
		 * Delete a user preset
		 *
		 * @param {string} tool Tool type
		 * @param {string} presetId Preset ID
		 * @return {boolean} Success
		 */
		deletePreset( tool, presetId ) {
			const presets = this.cache.toolPresets[ tool ];
			if ( !presets ) {
				return false;
			}

			const index = presets.findIndex( ( p ) => p.id === presetId );
			if ( index === -1 ) {
				return false;
			}

			// Cannot delete built-in presets
			if ( presets[ index ].builtIn ) {
				this.logError( 'Cannot delete built-in preset' );
				return false;
			}

			// Remove preset
			presets.splice( index, 1 );

			// Clear default if this was the default
			if ( this.cache.defaultPresets[ tool ] === presetId ) {
				delete this.cache.defaultPresets[ tool ];
			}

			this.save();
			this.notifyListeners( 'preset-deleted', { tool, presetId } );

			return true;
		}

		/**
		 * Extract style from a layer and create a preset
		 *
		 * @param {Object} layer Layer object
		 * @param {string} name Preset name
		 * @param {Object} [options] Additional options
		 * @return {Object|null} Created preset or null
		 */
		createFromLayer( layer, name, options ) {
			if ( !layer || !layer.type ) {
				this.logError( 'Invalid layer object' );
				return null;
			}

			const tool = this.mapLayerTypeToTool( layer.type );
			if ( !tool ) {
				this.logError( 'Layer type not supported for presets:', layer.type );
				return null;
			}

			const style = this.extractStyleFromLayer( layer );
			return this.addPreset( tool, name, style, options );
		}

		/**
		 * Map layer type to tool type
		 *
		 * @param {string} layerType Layer type
		 * @return {string|null} Tool type or null
		 */
		mapLayerTypeToTool( layerType ) {
			const mapping = {
				arrow: 'arrow',
				text: 'text',
				textbox: 'textbox',
				rectangle: 'rectangle',
				circle: 'circle',
				ellipse: 'ellipse',
				line: 'line',
				polygon: 'polygon',
				star: 'star',
				path: 'path'
			};
			return mapping[ layerType ] || null;
		}

		/**
		 * Extract style properties from a layer
		 *
		 * @param {Object} layer Layer object
		 * @return {Object} Style properties
		 */
		extractStyleFromLayer( layer ) {
			if ( this.storage ) {
				return this.storage.extractStyleFromLayer( layer );
			}
			// Fallback
			return this.sanitizeStyle( layer );
		}

		/**
		 * Export all user presets as JSON
		 *
		 * @return {string} JSON string
		 */
		exportPresets() {
			if ( this.storage ) {
				return this.storage.exportToJson( this.cache );
			}
			// Fallback
			return JSON.stringify( this.cache, null, 2 );
		}

		/**
		 * Import presets from JSON
		 *
		 * @param {string} jsonString JSON string to import
		 * @param {Object} [options] Import options
		 * @param {boolean} [options.merge] Merge with existing (default: true)
		 * @param {boolean} [options.overwrite] Overwrite duplicates (default: false)
		 * @return {Object} Import result { success, imported, skipped, errors }
		 */
		importPresets( jsonString, options ) {
			if ( this.storage ) {
				const result = this.storage.importFromJson( jsonString, this.cache, options );
				if ( result.success && result.data ) {
					this.cache = result.data;
					this.save();
					this.notifyListeners( 'presets-imported', result );
				}
				return {
					success: result.success,
					imported: result.imported,
					skipped: result.skipped,
					errors: result.errors
				};
			}
			// Fallback - no import without storage
			return { success: false, imported: 0, skipped: 0, errors: [ 'Storage not available' ] };
		}

		/**
		 * Get list of supported tools
		 *
		 * @return {string[]} Supported tool types
		 */
		getSupportedTools() {
			if ( this.builtInPresets ) {
				return this.builtInPresets.getSupportedTools();
			}
			return [
				'arrow', 'text', 'textbox', 'rectangle', 'circle',
				'ellipse', 'line', 'polygon', 'star', 'path'
			];
		}

		/**
		 * Check if a tool supports presets
		 *
		 * @param {string} tool Tool type
		 * @return {boolean} Whether tool supports presets
		 */
		isToolSupported( tool ) {
			if ( this.builtInPresets ) {
				return this.builtInPresets.isToolSupported( tool );
			}
			return this.getSupportedTools().includes( tool );
		}

		/**
		 * Generate unique preset ID
		 *
		 * @param {string} tool Tool type
		 * @param {string} name Preset name
		 * @return {string} Unique ID
		 */
		generateId( tool, name ) {
			if ( this.storage ) {
				return this.storage.generateId( tool, name );
			}
			// Fallback
			const slug = name.toLowerCase()
				.replace( /[^a-z0-9]+/g, '-' )
				.replace( /^-|-$/g, '' );
			const timestamp = Date.now().toString( 36 );
			return `${ tool }-${ slug }-${ timestamp }`;
		}

		/**
		 * Sanitize style object (remove invalid properties)
		 *
		 * @param {Object} style Style object
		 * @return {Object} Sanitized style
		 */
		sanitizeStyle( style ) {
			if ( this.storage ) {
				return this.storage.sanitizeStyle( style );
			}
			// Fallback - just clone
			return { ...style };
		}

		/**
		 * Subscribe to preset changes
		 *
		 * @param {Function} listener Callback function(event, data)
		 * @return {Function} Unsubscribe function
		 */
		subscribe( listener ) {
			if ( typeof listener === 'function' ) {
				this.listeners.push( listener );
			}
			return () => {
				const index = this.listeners.indexOf( listener );
				if ( index !== -1 ) {
					this.listeners.splice( index, 1 );
				}
			};
		}

		/**
		 * Notify all listeners of an event
		 *
		 * @param {string} event Event name
		 * @param {*} [data] Event data
		 */
		notifyListeners( event, data ) {
			this.listeners.forEach( ( listener ) => {
				try {
					listener( event, data );
				} catch ( err ) {
					this.logError( 'Listener error:', err );
				}
			} );
		}

		/**
		 * Reset all user presets (keep built-in)
		 */
		reset() {
			this.cache = this.createEmptyData();
			this.save();
			this.notifyListeners( 'reset' );
		}

		/**
		 * Log error message
		 *
		 * @param {...*} args Log arguments
		 */
		logError( ...args ) {
			if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
				mw.log.error( '[PresetManager]', ...args );
			} else if ( typeof console !== 'undefined' ) {
				// eslint-disable-next-line no-console
				console.error( '[PresetManager]', ...args );
			}
		}

		/**
		 * Destroy and clean up
		 */
		destroy() {
			this.listeners = [];
			this.cache = null;
			this.storage = null;
			this.builtInPresets = null;
		}
	}

	// Export constants for backward compatibility
	PresetManager.STORAGE_KEY = 'mw-layers-style-presets';
	PresetManager.SCHEMA_VERSION = 1;
	PresetManager.SUPPORTED_TOOLS = [
		'arrow', 'text', 'textbox', 'rectangle', 'circle',
		'ellipse', 'line', 'polygon', 'star', 'path'
	];

	// For backward compatibility, expose BUILT_IN_PRESETS via getter
	Object.defineProperty( PresetManager, 'BUILT_IN_PRESETS', {
		get: function () {
			const BuiltInPresets = getBuiltInPresets();
			return BuiltInPresets ? BuiltInPresets.PRESETS : {};
		}
	} );

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.PresetManager = PresetManager;
	}

	// CommonJS export for testing
	/* eslint-disable-next-line no-undef */
	if ( typeof module !== 'undefined' && module.exports ) {
		/* eslint-disable-next-line no-undef */
		module.exports = PresetManager;
	}
}() );
