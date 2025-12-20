/**
 * Tool Registry for Layers Editor
 * Manages tool definitions, cursors, and display names
 * Extracted from ToolManager.js for better separation of concerns
 */
( function () {
	'use strict';

	/**
	 * Tool definition structure
	 *
	 * @typedef {Object} ToolDefinition
	 * @property {string} name - Internal tool name
	 * @property {string} cursor - CSS cursor value
	 * @property {string} category - Tool category (drawing, shape, selection, etc.)
	 * @property {boolean} createsLayer - Whether the tool creates new layers
	 */

	/**
	 * ToolRegistry class
	 * Centralized registry for tool definitions and properties
	 */
	class ToolRegistry {
		/**
		 * Create a ToolRegistry instance
		 */
		constructor() {
			/**
			 * Map of tool names to their definitions
			 *
			 * @type {Map<string, ToolDefinition>}
			 */
			this.tools = new Map();

			/**
			 * Map of tool names to CSS cursor values
			 *
			 * @type {Map<string, string>}
			 */
			this.cursors = new Map();

			/**
			 * Map of category names to tool names in that category
			 *
			 * @type {Map<string, string[]>}
			 */
			this.categories = new Map();

			// Register default tools
			this.registerDefaultTools();
		}

		/**
		 * Register all default tools
		 */
		registerDefaultTools() {
			// Selection tools
			this.register( 'pointer', {
				cursor: 'default',
				category: 'selection',
				createsLayer: false
			} );

			this.register( 'pan', {
				cursor: 'grab',
				category: 'navigation',
				createsLayer: false
			} );

			// Drawing tools
			this.register( 'pen', {
				cursor: 'crosshair',
				category: 'drawing',
				createsLayer: true
			} );

			this.register( 'path', {
				cursor: 'crosshair',
				category: 'drawing',
				createsLayer: true
			} );

			// Shape tools
			this.register( 'rectangle', {
				cursor: 'crosshair',
				category: 'shape',
				createsLayer: true
			} );

			this.register( 'circle', {
				cursor: 'crosshair',
				category: 'shape',
				createsLayer: true
			} );

			this.register( 'ellipse', {
				cursor: 'crosshair',
				category: 'shape',
				createsLayer: true
			} );

			this.register( 'polygon', {
				cursor: 'crosshair',
				category: 'shape',
				createsLayer: true
			} );

			this.register( 'star', {
				cursor: 'crosshair',
				category: 'shape',
				createsLayer: true
			} );

			// Line tools
			this.register( 'line', {
				cursor: 'crosshair',
				category: 'line',
				createsLayer: true
			} );

			this.register( 'arrow', {
				cursor: 'crosshair',
				category: 'line',
				createsLayer: true
			} );

			// Annotation tools
			this.register( 'text', {
				cursor: 'text',
				category: 'annotation',
				createsLayer: true
			} );

			this.register( 'blur', {
				cursor: 'crosshair',
				category: 'annotation',
				createsLayer: true
			} );

			// Utility tools
			this.register( 'eyedropper', {
				cursor: 'crosshair',
				category: 'utility',
				createsLayer: false
			} );
		}

		/**
		 * Register a tool
		 *
		 * @param {string} name Tool name
		 * @param {Object} definition Tool definition
		 * @param {string} definition.cursor CSS cursor value
		 * @param {string} definition.category Tool category
		 * @param {boolean} definition.createsLayer Whether tool creates layers
		 */
		register( name, definition ) {
			const toolDef = {
				name: name,
				cursor: definition.cursor || 'default',
				category: definition.category || 'other',
				createsLayer: definition.createsLayer !== false
			};

			this.tools.set( name, toolDef );
			this.cursors.set( name, toolDef.cursor );

			// Add to category
			const category = toolDef.category;
			if ( !this.categories.has( category ) ) {
				this.categories.set( category, [] );
			}
			const categoryTools = this.categories.get( category );
			if ( categoryTools.indexOf( name ) === -1 ) {
				categoryTools.push( name );
			}
		}

		/**
		 * Unregister a tool
		 *
		 * @param {string} name Tool name
		 * @return {boolean} True if tool was removed
		 */
		unregister( name ) {
			const toolDef = this.tools.get( name );
			if ( !toolDef ) {
				return false;
			}

			this.tools.delete( name );
			this.cursors.delete( name );

			// Remove from category
			const categoryTools = this.categories.get( toolDef.category );
			if ( categoryTools ) {
				const index = categoryTools.indexOf( name );
				if ( index !== -1 ) {
					categoryTools.splice( index, 1 );
				}
			}

			return true;
		}

		/**
		 * Get tool definition
		 *
		 * @param {string} name Tool name
		 * @return {ToolDefinition|null} Tool definition or null
		 */
		get( name ) {
			return this.tools.get( name ) || null;
		}

		/**
		 * Check if a tool is registered
		 *
		 * @param {string} name Tool name
		 * @return {boolean} True if tool exists
		 */
		has( name ) {
			return this.tools.has( name );
		}

		/**
		 * Get cursor for a tool
		 *
		 * @param {string} name Tool name
		 * @return {string} CSS cursor value
		 */
		getCursor( name ) {
			return this.cursors.get( name ) || 'default';
		}

		/**
		 * Get display name for a tool
		 *
		 * @param {string} name Tool name
		 * @return {string} Human-readable tool name
		 */
		getDisplayName( name ) {
			// Use i18n messages if available
			if ( typeof window !== 'undefined' && window.layersMessages &&
				typeof window.layersMessages.get === 'function' ) {
				const msgKey = 'layers-tool-' + name;
				const msg = window.layersMessages.get( msgKey, '' );
				if ( msg ) {
					return msg;
				}
			}

			// Fallback to capitalized tool name
			return name.charAt( 0 ).toUpperCase() + name.slice( 1 );
		}

		/**
		 * Get all tool names
		 *
		 * @return {string[]} Array of tool names
		 */
		getToolNames() {
			return Array.from( this.tools.keys() );
		}

		/**
		 * Get tools in a category
		 *
		 * @param {string} category Category name
		 * @return {string[]} Array of tool names in category
		 */
		getToolsByCategory( category ) {
			return this.categories.get( category ) || [];
		}

		/**
		 * Get all categories
		 *
		 * @return {string[]} Array of category names
		 */
		getCategories() {
			return Array.from( this.categories.keys() );
		}

		/**
		 * Check if tool creates layers
		 *
		 * @param {string} name Tool name
		 * @return {boolean} True if tool creates layers
		 */
		createsLayer( name ) {
			const toolDef = this.tools.get( name );
			return toolDef ? toolDef.createsLayer : false;
		}

		/**
		 * Check if tool is a drawing tool (creates layer via drag)
		 *
		 * @param {string} name Tool name
		 * @return {boolean} True if tool is a drawing tool
		 */
		isDrawingTool( name ) {
			const toolDef = this.tools.get( name );
			if ( !toolDef ) {
				return false;
			}
			return [ 'drawing', 'shape', 'line', 'annotation' ].indexOf( toolDef.category ) !== -1;
		}

		/**
		 * Check if tool is a selection tool
		 *
		 * @param {string} name Tool name
		 * @return {boolean} True if tool is a selection tool
		 */
		isSelectionTool( name ) {
			const toolDef = this.tools.get( name );
			return toolDef ? toolDef.category === 'selection' : false;
		}

		/**
		 * Check if tool is a shape tool
		 *
		 * @param {string} name Tool name
		 * @return {boolean} True if tool is a shape tool
		 */
		isShapeTool( name ) {
			const toolDef = this.tools.get( name );
			return toolDef ? toolDef.category === 'shape' : false;
		}

		/**
		 * Get default cursor map (for backward compatibility)
		 *
		 * @return {Object} Map of tool names to cursors
		 */
		getCursorMap() {
			const map = {};
			this.cursors.forEach( ( cursor, name ) => {
				map[ name ] = cursor;
			} );
			return map;
		}

		/**
		 * Clear all tools
		 */
		clear() {
			this.tools.clear();
			this.cursors.clear();
			this.categories.clear();
		}

		/**
		 * Reset to default tools
		 */
		reset() {
			this.clear();
			this.registerDefaultTools();
		}
	}

	// Create singleton instance
	const registry = new ToolRegistry();

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Tools = window.Layers.Tools || {};
		window.Layers.Tools.ToolRegistry = ToolRegistry;
		window.Layers.Tools.registry = registry;
	}

	// CommonJS export for testing
	/* eslint-disable-next-line no-undef */
	if ( typeof module !== 'undefined' && module.exports ) {
		/* eslint-disable-next-line no-undef */
		module.exports = ToolRegistry;
	}
}() );
