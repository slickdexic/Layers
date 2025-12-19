/**
 * Style Preset Manager for Layers Editor
 *
 * Manages tool-specific style presets stored in localStorage.
 * Allows users to save, load, and manage reusable style configurations.
 *
 * Storage key: 'mw-layers-style-presets'
 *
 * @class PresetManager
 */
( function () {
	'use strict';

	const STORAGE_KEY = 'mw-layers-style-presets';
	const SCHEMA_VERSION = 1;

	/**
	 * Default presets that ship with the extension
	 *
	 * @type {Object}
	 */
	const BUILT_IN_PRESETS = {
		arrow: [
			{
				id: 'builtin-arrow-default',
				name: 'Default Arrow',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 2,
					arrowStyle: 'single',
					arrowhead: 'arrow'
				}
			},
			{
				id: 'builtin-arrow-callout',
				name: 'Callout',
				builtIn: true,
				style: {
					stroke: '#cc0000',
					strokeWidth: 3,
					arrowStyle: 'single',
					arrowhead: 'arrow'
				}
			}
		],
		text: [
			{
				id: 'builtin-text-label',
				name: 'Label',
				builtIn: true,
				style: {
					color: '#000000',
					fontSize: 16,
					fontFamily: 'Arial, sans-serif',
					fontWeight: 'normal'
				}
			},
			{
				id: 'builtin-text-title',
				name: 'Title',
				builtIn: true,
				style: {
					color: '#000000',
					fontSize: 24,
					fontFamily: 'Arial, sans-serif',
					fontWeight: 'bold'
				}
			}
		],
		textbox: [
			{
				id: 'builtin-textbox-default',
				name: 'Default Box',
				builtIn: true,
				style: {
					fill: '#ffffff',
					stroke: '#000000',
					strokeWidth: 1,
					fontSize: 14,
					fontFamily: 'Arial, sans-serif',
					padding: 8,
					cornerRadius: 4
				}
			}
		],
		rectangle: [
			{
				id: 'builtin-rect-outline',
				name: 'Outline',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 2,
					fill: 'transparent'
				}
			},
			{
				id: 'builtin-rect-highlight',
				name: 'Highlight',
				builtIn: true,
				style: {
					stroke: 'transparent',
					strokeWidth: 0,
					fill: '#ffff00',
					fillOpacity: 0.3
				}
			}
		],
		circle: [
			{
				id: 'builtin-circle-outline',
				name: 'Outline',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 2,
					fill: 'transparent'
				}
			}
		],
		ellipse: [
			{
				id: 'builtin-ellipse-outline',
				name: 'Outline',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 2,
					fill: 'transparent'
				}
			}
		],
		line: [
			{
				id: 'builtin-line-default',
				name: 'Default Line',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 2
				}
			}
		],
		polygon: [
			{
				id: 'builtin-polygon-outline',
				name: 'Outline',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 2,
					fill: 'transparent'
				}
			}
		],
		star: [
			{
				id: 'builtin-star-filled',
				name: 'Filled Star',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 1,
					fill: '#ffd700'
				}
			}
		]
	};

	/**
	 * Tools that support presets
	 *
	 * @type {string[]}
	 */
	const SUPPORTED_TOOLS = [
		'arrow', 'text', 'textbox', 'rectangle', 'circle',
		'ellipse', 'line', 'polygon', 'star', 'path'
	];

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

			/**
			 * Storage key for localStorage
			 *
			 * @type {string}
			 */
			this.storageKey = opts.storageKey || STORAGE_KEY;

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
			try {
				const stored = localStorage.getItem( this.storageKey );
				if ( stored ) {
					const parsed = JSON.parse( stored );
					if ( parsed.version === SCHEMA_VERSION ) {
						this.cache = parsed;
						return this.cache;
					}
					// Future: handle migrations here
				}
			} catch ( err ) {
				this.logError( 'Failed to load presets:', err );
			}

			// Initialize with empty user presets
			this.cache = this.createEmptyData();
			return this.cache;
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
				defaultPresets: {} // Maps tool -> preset ID
			};

			// Initialize empty arrays for each supported tool
			SUPPORTED_TOOLS.forEach( ( tool ) => {
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
			try {
				localStorage.setItem( this.storageKey, JSON.stringify( this.cache ) );
				this.notifyListeners( 'save' );
				return true;
			} catch ( err ) {
				this.logError( 'Failed to save presets:', err );
				return false;
			}
		}

		/**
		 * Get all presets for a tool (built-in + user)
		 *
		 * @param {string} tool Tool type (e.g., 'arrow', 'text')
		 * @return {Array} Array of preset objects
		 */
		getPresetsForTool( tool ) {
			if ( !SUPPORTED_TOOLS.includes( tool ) ) {
				return [];
			}

			const builtIn = BUILT_IN_PRESETS[ tool ] || [];
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
			const builtIn = BUILT_IN_PRESETS[ tool ];
			return builtIn && builtIn.length > 0 ? builtIn[ 0 ] : null;
		}

		/**
		 * Set the default preset for a tool
		 *
		 * @param {string} tool Tool type
		 * @param {string} presetId Preset ID to set as default
		 * @return {boolean} Success
		 */
		setDefaultPreset( tool, presetId ) {
			if ( !SUPPORTED_TOOLS.includes( tool ) ) {
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
			if ( !SUPPORTED_TOOLS.includes( tool ) ) {
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
			const style = {};
			const styleProps = [
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

			styleProps.forEach( ( prop ) => {
				if ( layer[ prop ] !== undefined ) {
					style[ prop ] = layer[ prop ];
				}
			} );

			return style;
		}

		/**
		 * Export all user presets as JSON
		 *
		 * @return {string} JSON string
		 */
		exportPresets() {
			const exportData = {
				version: SCHEMA_VERSION,
				exportedAt: new Date().toISOString(),
				toolPresets: {},
				defaultPresets: { ...this.cache.defaultPresets }
			};

			// Only export user presets (not built-in)
			SUPPORTED_TOOLS.forEach( ( tool ) => {
				const userPresets = ( this.cache.toolPresets[ tool ] || [] )
					.filter( ( p ) => !p.builtIn );
				if ( userPresets.length > 0 ) {
					exportData.toolPresets[ tool ] = userPresets;
				}
			} );

			return JSON.stringify( exportData, null, 2 );
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
			const opts = Object.assign( { merge: true, overwrite: false }, options );
			const result = { success: false, imported: 0, skipped: 0, errors: [] };

			let importData;
			try {
				importData = JSON.parse( jsonString );
			} catch ( err ) {
				result.errors.push( 'Invalid JSON format' );
				return result;
			}

			if ( !importData.version || !importData.toolPresets ) {
				result.errors.push( 'Invalid preset file format' );
				return result;
			}

			// Clear existing if not merging
			if ( !opts.merge ) {
				this.cache = this.createEmptyData();
			}

			// Import presets for each tool
			Object.keys( importData.toolPresets ).forEach( ( tool ) => {
				if ( !SUPPORTED_TOOLS.includes( tool ) ) {
					result.errors.push( `Unsupported tool: ${ tool }` );
					return;
				}

				const presets = importData.toolPresets[ tool ];
				if ( !Array.isArray( presets ) ) {
					return;
				}

				presets.forEach( ( preset ) => {
					if ( !preset.id || !preset.name || !preset.style ) {
						result.skipped++;
						return;
					}

					// Check for existing
					const existing = this.getPreset( tool, preset.id );
					if ( existing && !opts.overwrite ) {
						result.skipped++;
						return;
					}

					// Remove existing if overwriting
					if ( existing && opts.overwrite ) {
						this.deletePreset( tool, preset.id );
					}

					// Add preset
					if ( !this.cache.toolPresets[ tool ] ) {
						this.cache.toolPresets[ tool ] = [];
					}
					this.cache.toolPresets[ tool ].push( {
						...preset,
						builtIn: false,
						importedAt: new Date().toISOString()
					} );
					result.imported++;
				} );
			} );

			// Import default preferences
			if ( importData.defaultPresets ) {
				Object.assign( this.cache.defaultPresets, importData.defaultPresets );
			}

			this.save();
			result.success = true;
			this.notifyListeners( 'presets-imported', result );

			return result;
		}

		/**
		 * Get list of supported tools
		 *
		 * @return {string[]} Supported tool types
		 */
		getSupportedTools() {
			return [ ...SUPPORTED_TOOLS ];
		}

		/**
		 * Check if a tool supports presets
		 *
		 * @param {string} tool Tool type
		 * @return {boolean} Whether tool supports presets
		 */
		isToolSupported( tool ) {
			return SUPPORTED_TOOLS.includes( tool );
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
		 * Sanitize style object (remove invalid properties)
		 *
		 * @param {Object} style Style object
		 * @return {Object} Sanitized style
		 */
		sanitizeStyle( style ) {
			const allowed = [
				'stroke', 'strokeWidth', 'strokeOpacity',
				'fill', 'fillOpacity',
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

			const sanitized = {};
			allowed.forEach( ( prop ) => {
				if ( style[ prop ] !== undefined ) {
					sanitized[ prop ] = style[ prop ];
				}
			} );

			return sanitized;
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
		}
	}

	// Export constants for testing
	PresetManager.STORAGE_KEY = STORAGE_KEY;
	PresetManager.SCHEMA_VERSION = SCHEMA_VERSION;
	PresetManager.SUPPORTED_TOOLS = SUPPORTED_TOOLS;
	PresetManager.BUILT_IN_PRESETS = BUILT_IN_PRESETS;

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
