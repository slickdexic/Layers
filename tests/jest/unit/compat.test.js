/**
 * Tests for the compat module - deprecation warning system.
 * This module is an IIFE that checks for deprecated global exports.
 */

describe( 'compat module', () => {
	let originalLocalStorage;
	let originalWindow;
	let mockMw;

	beforeEach( () => {
		// Save original localStorage
		originalLocalStorage = global.localStorage;
		originalWindow = { ...global.window };

		// Create mock localStorage
		const storage = {};
		global.localStorage = {
			getItem: jest.fn( ( key ) => storage[ key ] || null ),
			setItem: jest.fn( ( key, value ) => {
				storage[ key ] = value;
			} ),
			removeItem: jest.fn( ( key ) => {
				delete storage[ key ];
			} )
		};

		// Mock mw.log.warn
		mockMw = {
			log: {
				warn: jest.fn()
			}
		};
		global.mw = mockMw;
	} );

	afterEach( () => {
		global.localStorage = originalLocalStorage;
		global.window = originalWindow;
		delete global.mw;
		jest.resetModules();
	} );

	it( 'should not warn when debug mode is disabled', () => {
		// Debug mode is disabled (default)
		global.localStorage.getItem.mockReturnValue( null );

		// Add a deprecated global
		global.window.EventTracker = {};

		// Load the compat module
		jest.isolateModules( () => {
			require( '../../../resources/ext.layers.editor/compat.js' );
		} );

		// Should not warn when debug is disabled
		expect( mockMw.log.warn ).not.toHaveBeenCalled();

		// Clean up
		delete global.window.EventTracker;
	} );

	it( 'should warn about deprecated globals when debug mode is enabled', () => {
		// Enable debug mode
		global.localStorage.getItem.mockReturnValue( 'true' );

		// Add deprecated globals
		global.window.EventTracker = {};
		global.window.DeepClone = {};

		// Load the compat module
		jest.isolateModules( () => {
			require( '../../../resources/ext.layers.editor/compat.js' );
		} );

		// Should warn about deprecated globals
		expect( mockMw.log.warn ).toHaveBeenCalledWith(
			'[Layers] Deprecated global exports detected. These will be removed in v1.0:'
		);
		expect( mockMw.log.warn ).toHaveBeenCalledWith(
			expect.stringContaining( 'EventTracker' )
		);
		expect( mockMw.log.warn ).toHaveBeenCalledWith(
			expect.stringContaining( 'DeepClone' )
		);

		// Clean up
		delete global.window.EventTracker;
		delete global.window.DeepClone;
	} );

	it( 'should not warn when no deprecated globals are found', () => {
		// Enable debug mode
		global.localStorage.getItem.mockReturnValue( 'true' );

		// Don't add any deprecated globals

		// Load the compat module
		jest.isolateModules( () => {
			require( '../../../resources/ext.layers.editor/compat.js' );
		} );

		// Should not warn if no deprecated globals found
		expect( mockMw.log.warn ).not.toHaveBeenCalled();
	} );

	it( 'should handle missing mw object gracefully', () => {
		// Enable debug mode
		global.localStorage.getItem.mockReturnValue( 'true' );

		// Remove mw object
		delete global.mw;

		// Add a deprecated global
		global.window.EventTracker = {};

		// Should not throw when mw is undefined
		expect( () => {
			jest.isolateModules( () => {
				require( '../../../resources/ext.layers.editor/compat.js' );
			} );
		} ).not.toThrow();

		// Clean up
		delete global.window.EventTracker;
	} );

	it( 'should include the disable warning message', () => {
		// Enable debug mode
		global.localStorage.getItem.mockReturnValue( 'true' );

		// Add a deprecated global
		global.window.CanvasManager = {};

		// Load the compat module
		jest.isolateModules( () => {
			require( '../../../resources/ext.layers.editor/compat.js' );
		} );

		// Should include the disable instruction
		expect( mockMw.log.warn ).toHaveBeenCalledWith(
			'[Layers] To disable this warning, use localStorage.removeItem("layersDebug")'
		);

		// Clean up
		delete global.window.CanvasManager;
	} );

	it( 'should list multiple deprecated globals correctly', () => {
		// Enable debug mode
		global.localStorage.getItem.mockReturnValue( 'true' );

		// Add multiple deprecated globals
		global.window.Toolbar = {};
		global.window.LayerPanel = {};
		global.window.UIManager = {};

		// Load the compat module
		jest.isolateModules( () => {
			require( '../../../resources/ext.layers.editor/compat.js' );
		} );

		// Should have called warn at least 5 times:
		// 1. Header message
		// 2-4. Three deprecated globals
		// 5. Disable instruction
		expect( mockMw.log.warn.mock.calls.length ).toBeGreaterThanOrEqual( 5 );

		// Clean up
		delete global.window.Toolbar;
		delete global.window.LayerPanel;
		delete global.window.UIManager;
	} );

	it( 'should handle missing localStorage gracefully', () => {
		// Remove localStorage completely
		delete global.localStorage;

		// Add a deprecated global
		global.window.EventTracker = {};

		// Should not throw when localStorage is undefined
		expect( () => {
			jest.isolateModules( () => {
				require( '../../../resources/ext.layers.editor/compat.js' );
			} );
		} ).not.toThrow();

		// Clean up
		delete global.window.EventTracker;
	} );

	it( 'should exit early when window is undefined', () => {
		// Save original window
		const savedWindow = global.window;

		// Remove window to simulate non-browser environment
		delete global.window;

		// Should not throw and should exit early
		expect( () => {
			jest.isolateModules( () => {
				require( '../../../resources/ext.layers.editor/compat.js' );
			} );
		} ).not.toThrow();

		// Restore window
		global.window = savedWindow;
	} );
} );
