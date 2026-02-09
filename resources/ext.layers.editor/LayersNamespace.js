/**
 * Layers Namespace - Consolidated global exports for the Layers MediaWiki extension
 *
 * This module establishes the window.Layers namespace and organizes all public classes
 * under logical subgroups. Direct window.* exports are deprecated and will emit warnings.
 *
 * Usage:
 *   const editor = new window.Layers.Editor({ ... });
 *   const validator = new window.Layers.Validation.LayersValidator();
 *   const state = new window.Layers.Core.StateManager();
 *
 * Legacy usage (deprecated, will warn):
 *   const editor = new window.LayersEditor({ ... });
 */
( function () {
	'use strict';

	// Extension version - must match extension.json
	const VERSION = '1.5.54';

	// Skip in non-browser environments
	if ( typeof window === 'undefined' ) {
		return;
	}

	/**
	 * Check if deprecation warnings are enabled
	 * @return {boolean}
	 */
	function shouldWarn() {
		return typeof mw !== 'undefined' &&
			mw.config &&
			mw.config.get( 'wgLayersDebug' );
	}

	/**
	 * Log deprecation warning for legacy global access
	 * @param {string} oldName Legacy global name
	 * @param {string} newPath New namespace path
	 */
	function warnDeprecated( oldName, newPath ) {
		if ( shouldWarn() && typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
			mw.log.warn(
				'[Layers] window.' + oldName + ' is deprecated. ' +
				'Use window.Layers.' + newPath + ' instead.'
			);
		}
	}

	/**
	 * Create a deprecation proxy for a class/object
	 * @param {*} target The actual class or object
	 * @param {string} oldName Legacy global name
	 * @param {string} newPath New namespace path
	 * @return {*} Proxied class that warns on access
	 */
	function createDeprecatedProxy( target, oldName, newPath ) {
		// For functions (classes), wrap them
		if ( typeof target === 'function' ) {
			const warned = {};
			return function DeprecatedWrapper() {
				if ( !warned[ oldName ] ) {
					warnDeprecated( oldName, newPath );
					warned[ oldName ] = true;
				}
				// Support both new ClassName() and ClassName() calls
				if ( new.target ) {
					return new target( ...arguments );
				}
				return target.apply( this, arguments );
			};
		}
		// For objects, just return them (instances like layersRegistry)
		return target;
	}

	// Initialize the Layers namespace
	window.Layers = window.Layers || {};

	/**
	 * Layers.Core - Core infrastructure classes
	 * StateManager, HistoryManager, EventManager, ModuleRegistry
	 */
	window.Layers.Core = window.Layers.Core || {};

	/**
	 * Layers.UI - User interface components
	 * UIManager, Toolbar, LayerPanel, ColorPickerDialog, ConfirmDialog, etc.
	 */
	window.Layers.UI = window.Layers.UI || {};

	/**
	 * Layers.Canvas - Canvas rendering and interaction
	 * CanvasManager, CanvasRenderer, SelectionManager, controllers
	 */
	window.Layers.Canvas = window.Layers.Canvas || {};

	/**
	 * Layers.Utils - Utility classes
	 * GeometryUtils, TextUtils, ImageLoader, ErrorHandler, EventTracker
	 */
	window.Layers.Utils = window.Layers.Utils || {};

	/**
	 * Layers.Validation - Validation classes
	 * LayersValidator, ValidationManager
	 */
	window.Layers.Validation = window.Layers.Validation || {};

	/**
	 * Registry mapping: oldGlobalName -> { ns: 'Core|UI|Canvas|Utils|Validation'|null, name: 'NewName' }
	 * This defines where each class belongs in the new namespace structure.
	 * ns: null means export at top level (window.Layers.Name)
	 */
	const exportRegistry = {
		// Core infrastructure
		StateManager: { ns: 'Core', name: 'StateManager' },
		HistoryManager: { ns: 'Core', name: 'HistoryManager' },
		EventManager: { ns: 'Core', name: 'EventManager' },
		LayersModuleRegistry: { ns: 'Core', name: 'ModuleRegistry' },
		LayersConstants: { ns: 'Core', name: 'Constants' },

		// Main editor (top-level)
		LayersEditor: { ns: null, name: 'Editor' },
		LayersToolManager: { ns: null, name: 'ToolManager' },
		StyleController: { ns: null, name: 'StyleController' },
		APIManager: { ns: null, name: 'APIManager' },
		LayersMessageHelper: { ns: null, name: 'MessageHelper' },
		LayerSetManager: { ns: null, name: 'LayerSetManager' },

		// UI components
		UIManager: { ns: 'UI', name: 'Manager' },
		Toolbar: { ns: 'UI', name: 'Toolbar' },
		LayerPanel: { ns: 'UI', name: 'LayerPanel' },
		ToolbarKeyboard: { ns: 'UI', name: 'ToolbarKeyboard' },
		ToolbarStyleControls: { ns: 'UI', name: 'StyleControls' },
		ColorPickerDialog: { ns: 'UI', name: 'ColorPickerDialog' },
		ConfirmDialog: { ns: 'UI', name: 'ConfirmDialog' },
		PropertiesForm: { ns: 'UI', name: 'PropertiesForm' },
		IconFactory: { ns: 'UI', name: 'IconFactory' },

		// Canvas components
		CanvasManager: { ns: 'Canvas', name: 'Manager' },
		CanvasRenderer: { ns: 'Canvas', name: 'Renderer' },
		CanvasEvents: { ns: 'Canvas', name: 'Events' },
		CanvasUtilities: { ns: 'Canvas', name: 'Utilities' },
		LayersSelectionManager: { ns: 'Canvas', name: 'SelectionManager' },
		LayerRenderer: { ns: 'Canvas', name: 'LayerRenderer' },

		// Canvas controllers
		DrawingController: { ns: 'Canvas', name: 'DrawingController' },
		TransformController: { ns: 'Canvas', name: 'TransformController' },
		HitTestController: { ns: 'Canvas', name: 'HitTestController' },
		ClipboardController: { ns: 'Canvas', name: 'ClipboardController' },
		RenderCoordinator: { ns: 'Canvas', name: 'RenderCoordinator' },
		InteractionController: { ns: 'Canvas', name: 'InteractionController' },
		ZoomPanController: { ns: 'Canvas', name: 'ZoomPanController' },

		// Utilities
		GeometryUtils: { ns: 'Utils', name: 'Geometry' },
		TextUtils: { ns: 'Utils', name: 'Text' },
		ImageLoader: { ns: 'Utils', name: 'ImageLoader' },
		LayersErrorHandler: { ns: 'Utils', name: 'ErrorHandler' },
		EventTracker: { ns: 'Utils', name: 'EventTracker' },
		TransformationEngine: { ns: 'Utils', name: 'TransformationEngine' },
		ImportExportManager: { ns: 'Utils', name: 'ImportExport' },

		// Validation
		LayersValidator: { ns: 'Validation', name: 'LayersValidator' },
		ValidationManager: { ns: 'Validation', name: 'Manager' }
	};

	/**
	 * Register a class in both the new namespace and as a deprecated global
	 * @param {string} oldName Original window.* name
	 * @param {*} classOrObject The class or object to register
	 */
	function registerExport( oldName, classOrObject ) {
		const mapping = exportRegistry[ oldName ];
		if ( !mapping ) {
			// Unknown export - just keep it as-is in window
			return;
		}

		const { ns, name } = mapping;
		const newPath = ns ? ns + '.' + name : name;

		// Register in new namespace
		if ( ns ) {
			window.Layers[ ns ][ name ] = classOrObject;
		} else {
			window.Layers[ name ] = classOrObject;
		}

		// Create deprecated proxy for the old global name
		// Only if the global doesn't already have a deprecation wrapper
		if ( !window[ oldName ] || !window[ oldName ]._layersDeprecated ) {
			const proxy = createDeprecatedProxy( classOrObject, oldName, newPath );
			if ( typeof proxy === 'function' ) {
				proxy._layersDeprecated = true;
				// Copy static properties
				Object.keys( classOrObject ).forEach( function ( key ) {
					proxy[ key ] = classOrObject[ key ];
				} );
			}
			// Don't override - original modules set window.* directly
			// This registry just tracks and provides namespace access
		}
	}

	/**
	 * Initialize namespace from existing globals
	 * Called after all modules have loaded
	 */
	function initializeNamespace() {
		// Skip if already initialized
		if ( window.Layers.initialized ) {
			return;
		}

		// Set version and initialized flag
		window.Layers.VERSION = VERSION;
		window.Layers.initialized = true;

		Object.keys( exportRegistry ).forEach( function ( oldName ) {
			const existing = window[ oldName ];
			if ( existing ) {
				registerExport( oldName, existing );
			}
		} );

		// Also register singleton instances
		if ( window.layersRegistry ) {
			window.Layers.registry = window.layersRegistry;
		}
		if ( window.layersErrorHandler ) {
			window.Layers.errorHandler = window.layersErrorHandler;
		}
		if ( window.layersMessages ) {
			window.Layers.messages = window.layersMessages;
		}
	}

	/**
	 * Get the export registry (for testing/introspection)
	 * @return {Object} The export registry
	 */
	function getExportRegistry() {
		return exportRegistry;
	}

	// Export the initialization function for manual triggering if needed
	window.Layers.init = initializeNamespace;

	// Auto-initialize when DOM is ready (after all scripts loaded)
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initializeNamespace );
	} else {
		// DOM already ready, but defer to allow other scripts to load
		setTimeout( initializeNamespace, 0 );
	}

	// Also hook into MediaWiki's module system if available
	if ( typeof mw !== 'undefined' && mw.hook ) {
		mw.hook( 'ext.layers.loaded' ).add( initializeNamespace );
	}

	// Export for CommonJS/testing environments
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = {
			registerExport: registerExport,
			initializeNamespace: initializeNamespace,
			getExportRegistry: getExportRegistry,
			exportRegistry: exportRegistry,
			// Exposed for testing
			_createDeprecatedProxy: createDeprecatedProxy
		};
	}

}() );
