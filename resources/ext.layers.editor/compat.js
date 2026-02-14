(function (){
	'use strict';
	if ( typeof window === 'undefined' ) {
		return;
	}

	// Helper for safe MediaWiki logging
	function logWarn( msg ) {
		if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
			mw.log.warn( msg );
		}
	}

	// Map of deprecated global exports to their namespaced replacements
	// These globals will be removed in a future major version
	const deprecatedGlobals = {
		// Utils
		EventTracker: 'window.Layers.Utils.EventTracker',
		DeepClone: 'window.Layers.Utils.DeepClone',
		GeometryUtils: 'window.Layers.Utils.Geometry',
		TextUtils: 'window.Layers.Utils.Text',
		ImageLoader: 'window.Layers.Utils.ImageLoader',
		// Core
		StyleController: 'window.Layers.Core.StyleController',
		HistoryManager: 'window.Layers.Core.HistoryManager',
		StateManager: 'window.Layers.Core.StateManager',
		EventManager: 'window.Layers.Core.EventManager',
		ModuleRegistry: 'window.Layers.Core.ModuleRegistry',
		// Canvas
		CanvasManager: 'window.Layers.Canvas.Manager',
		CanvasRenderer: 'window.Layers.Canvas.Renderer',
		CanvasUtilities: 'window.Layers.Canvas.Utilities',
		SelectionManager: 'window.Layers.Canvas.SelectionManager',
		TransformationEngine: 'window.Layers.Canvas.TransformationEngine',
		// UI
		Toolbar: 'window.Layers.UI.Toolbar',
		LayerPanel: 'window.Layers.UI.LayerPanel',
		UIManager: 'window.Layers.UI.Manager',
		// Validation
		LayersValidator: 'window.Layers.Validation.Validator',
		ValidationManager: 'window.Layers.Validation.Manager',
		ErrorHandler: 'window.Layers.Validation.ErrorHandler'
	};

	// Only emit deprecation warnings in debug mode to avoid console spam in production
	// Developers can enable by setting localStorage.layersDebug = 'true'
	const debugEnabled = typeof localStorage !== 'undefined' &&
		localStorage.getItem( 'layersDebug' ) === 'true';

	if ( debugEnabled ) {
		const found = [];
		for ( const oldName in deprecatedGlobals ) {
			if ( Object.prototype.hasOwnProperty.call( window, oldName ) ) {
				found.push( oldName + ' -> ' + deprecatedGlobals[ oldName ] );
			}
		}

		if ( found.length ) {
			logWarn( '[Layers] Deprecated global exports detected. These will be removed in v1.0:' );
			found.forEach( ( item ) => {
				logWarn( '  ' + item );
			} );
			logWarn( '[Layers] To disable this warning, use localStorage.removeItem("layersDebug")' );
		}
	}
}());
