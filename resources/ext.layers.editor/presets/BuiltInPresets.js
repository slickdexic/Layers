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
		'arrow', 'text', 'textbox', 'callout', 'rectangle', 'circle',
		'ellipse', 'line', 'polygon', 'star', 'path', 'dimension', 'marker', 'angleDimension'
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
					fill: '#000000',
					stroke: '#000000',
					strokeWidth: 2,
					arrowStyle: 'single',
					arrowhead: 'arrow',
					arrowSize: 15
				}
			},
			{
				id: 'builtin-arrow-callout',
				name: 'Callout',
				builtIn: true,
				style: {
					fill: '#cc0000',
					stroke: '#cc0000',
					strokeWidth: 3,
					arrowStyle: 'single',
					arrowhead: 'arrow',
					arrowSize: 18
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
		callout: [
			{
				id: 'builtin-callout-speech',
				name: 'Speech Bubble',
				builtIn: true,
				style: {
					fill: '#ffffff',
					stroke: '#000000',
					strokeWidth: 2,
					fontSize: 14,
					fontFamily: 'Arial, sans-serif',
					padding: 12,
					cornerRadius: 12,
					tailDirection: 'bottom',
					tailPosition: 0.3,
					tailSize: 20
				}
			},
			{
				id: 'builtin-callout-thought',
				name: 'Thought Bubble',
				builtIn: true,
				style: {
					fill: '#f0f0f0',
					stroke: '#666666',
					strokeWidth: 1,
					fontSize: 12,
					fontFamily: 'Arial, sans-serif',
					fontStyle: 'italic',
					padding: 10,
					cornerRadius: 15,
					tailDirection: 'bottom',
					tailPosition: 0.2,
					tailSize: 15
				}
			},
			{
				id: 'builtin-callout-shout',
				name: 'Shout',
				builtIn: true,
				style: {
					fill: '#ffff00',
					stroke: '#ff0000',
					strokeWidth: 3,
					fontSize: 18,
					fontFamily: 'Arial, sans-serif',
					fontWeight: 'bold',
					padding: 15,
					cornerRadius: 8,
					tailDirection: 'bottom',
					tailPosition: 0.5,
					tailSize: 25
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
		path: [],
		dimension: [
			{
				id: 'builtin-dimension-default',
				name: 'Default',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 1,
					color: '#000000',
					fontSize: 12,
					fontFamily: 'Arial, sans-serif',
					endStyle: 'arrow',
					textPosition: 'above',
					extensionLength: 10,
					arrowSize: 8,
					showBackground: true,
					backgroundColor: '#ffffff'
				}
			},
			{
				id: 'builtin-dimension-technical',
				name: 'Technical Drawing',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 0.5,
					color: '#000000',
					fontSize: 10,
					fontFamily: 'Arial, sans-serif',
					endStyle: 'arrow',
					textPosition: 'above',
					extensionLength: 8,
					arrowSize: 6,
					showBackground: false
				}
			},
			{
				id: 'builtin-dimension-bold',
				name: 'Bold',
				builtIn: true,
				style: {
					stroke: '#cc0000',
					strokeWidth: 2,
					color: '#cc0000',
					fontSize: 16,
					fontFamily: 'Arial, sans-serif',
					endStyle: 'arrow',
					textPosition: 'above',
					extensionLength: 12,
					arrowSize: 10,
					showBackground: true,
					backgroundColor: '#ffffff'
				}
			},
			{
				id: 'builtin-dimension-tick',
				name: 'Tick Marks',
				builtIn: true,
				style: {
					stroke: '#000000',
					strokeWidth: 1,
					color: '#000000',
					fontSize: 12,
					fontFamily: 'Arial, sans-serif',
					endStyle: 'tick',
					textPosition: 'above',
					extensionLength: 10,
					tickSize: 8,
					showBackground: true,
					backgroundColor: '#ffffff'
				}
			}
		],
		marker: [
			{
				id: 'builtin-marker-circled',
				name: 'Circled Number',
				builtIn: true,
				style: {
					style: 'circled',
					size: 24,
					fill: '#ffffff',
					stroke: '#000000',
					strokeWidth: 2,
					color: '#000000',
					fontSizeAdjust: 0
				}
			},
			{
				id: 'builtin-marker-red',
				name: 'Red Marker',
				builtIn: true,
				style: {
					style: 'circled',
					size: 28,
					fill: '#cc0000',
					stroke: '#ffffff',
					strokeWidth: 2,
					color: '#ffffff',
					fontSizeAdjust: 2
				}
			},
			{
				id: 'builtin-marker-letter',
				name: 'Letter (A, B, C)',
				builtIn: true,
				style: {
					style: 'letter-circled',
					size: 24,
					fill: '#4a90d9',
					stroke: '#ffffff',
					strokeWidth: 2,
					color: '#ffffff',
					fontSizeAdjust: 0
				}
			},
			{
				id: 'builtin-marker-plain',
				name: 'Plain Number',
				builtIn: true,
				style: {
					style: 'plain',
					size: 20,
					fill: 'transparent',
					stroke: 'transparent',
					strokeWidth: 0,
					color: '#000000',
					fontSizeAdjust: 4
				}
			}
		]
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
