/**
 * Built-in Style Presets for Layers Editor
 *
 * Default presets that ship with the extension.
 * These cannot be modified or deleted by users.
 *
 * @module BuiltInPresets
 */
( function () {
	'use strict';

	/**
	 * Tools that support style presets
	 *
	 * @type {string[]}
	 */
	const SUPPORTED_TOOLS = [
		'arrow', 'text', 'textbox', 'rectangle', 'circle',
		'ellipse', 'line', 'polygon', 'star', 'path'
	];

	/**
	 * Default style presets organized by tool type
	 *
	 * @type {Object<string, Array<Object>>}
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
		],
		path: []
	};

	/**
	 * BuiltInPresets class
	 *
	 * Provides access to built-in preset definitions
	 */
	class BuiltInPresets {
		/**
		 * Get all built-in presets for a tool
		 *
		 * @param {string} tool Tool type (e.g., 'arrow', 'text')
		 * @return {Array<Object>} Array of preset objects (empty if tool not supported)
		 */
		static getForTool( tool ) {
			return BUILT_IN_PRESETS[ tool ] || [];
		}

		/**
		 * Get a specific built-in preset by ID
		 *
		 * @param {string} tool Tool type
		 * @param {string} presetId Preset ID
		 * @return {Object|null} Preset object or null
		 */
		static getById( tool, presetId ) {
			const presets = BuiltInPresets.getForTool( tool );
			return presets.find( ( p ) => p.id === presetId ) || null;
		}

		/**
		 * Get the first (default) built-in preset for a tool
		 *
		 * @param {string} tool Tool type
		 * @return {Object|null} First preset or null if none exist
		 */
		static getDefault( tool ) {
			const presets = BuiltInPresets.getForTool( tool );
			return presets.length > 0 ? presets[ 0 ] : null;
		}

		/**
		 * Get all supported tools
		 *
		 * @return {string[]} Array of tool type strings
		 */
		static getSupportedTools() {
			return [ ...SUPPORTED_TOOLS ];
		}

		/**
		 * Check if a tool supports presets
		 *
		 * @param {string} tool Tool type
		 * @return {boolean} True if tool supports presets
		 */
		static isToolSupported( tool ) {
			return SUPPORTED_TOOLS.includes( tool );
		}

		/**
		 * Check if a preset ID belongs to a built-in preset
		 *
		 * @param {string} presetId Preset ID to check
		 * @return {boolean} True if built-in
		 */
		static isBuiltIn( presetId ) {
			return Boolean( presetId && presetId.startsWith( 'builtin-' ) );
		}

		/**
		 * Get all built-in presets for all tools
		 *
		 * @return {Object<string, Array<Object>>} Map of tool to presets
		 */
		static getAll() {
			// Return a deep clone to prevent modification
			return JSON.parse( JSON.stringify( BUILT_IN_PRESETS ) );
		}

		/**
		 * Get count of built-in presets for a tool
		 *
		 * @param {string} tool Tool type
		 * @return {number} Number of presets
		 */
		static getCount( tool ) {
			return BuiltInPresets.getForTool( tool ).length;
		}

		/**
		 * Get total count of all built-in presets
		 *
		 * @return {number} Total number of presets
		 */
		static getTotalCount() {
			return SUPPORTED_TOOLS.reduce( ( sum, tool ) => {
				return sum + BuiltInPresets.getCount( tool );
			}, 0 );
		}
	}

	// Expose constants for external access
	BuiltInPresets.SUPPORTED_TOOLS = SUPPORTED_TOOLS;
	BuiltInPresets.PRESETS = BUILT_IN_PRESETS;

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.BuiltInPresets = BuiltInPresets;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = BuiltInPresets;
	}
}() );
