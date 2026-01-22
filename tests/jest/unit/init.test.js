'use strict';

/**
 * Tests for ext.layers/init.js
 * Viewer bootstrap module
 */

describe( 'mw.layers (init.js)', () => {
	let originalMw;
	let originalLayers;
	let mockUrlParser;
	let mockViewerManager;
	let mockApiFallback;

	beforeEach( () => {
		// Store originals
		originalMw = global.mw;
		originalLayers = global.window.Layers;

		// Reset Jest module cache to get fresh module
		jest.resetModules();

		// Create mock classes
		mockUrlParser = {
			getPageLayersParam: jest.fn( () => 'test-param' ),
			decodeHtmlEntities: jest.fn( ( s ) => s + '-decoded' ),
			isAllowedLayersValue: jest.fn( () => true ),
			escapeRegExp: jest.fn( ( s ) => s + '-escaped' ),
			detectLayersFromDataMw: jest.fn( () => 'detected-value' )
		};

		mockViewerManager = {
			initializeLayerViewers: jest.fn(),
			initializeFilePageFallback: jest.fn()
		};

		mockApiFallback = {
			initialize: jest.fn()
		};

		// Set up window.Layers namespace with mock constructors
		global.window.Layers = {
			Viewer: {
				UrlParser: jest.fn( function () {
					Object.assign( this, mockUrlParser );
				} ),
				Manager: jest.fn( function () {
					Object.assign( this, mockViewerManager );
				} ),
				ApiFallback: jest.fn( function () {
					Object.assign( this, mockApiFallback );
				} )
			}
		};

		// Set up mw mock with hook support
		global.mw = {
			config: {
				get: jest.fn( ( key ) => {
					if ( key === 'wgLayersDebug' ) {
						return false;
					}
					return null;
				} )
			},
			log: jest.fn(),
			hook: jest.fn( () => ( {
				add: jest.fn()
			} ) )
		};
		global.mw.log.warn = jest.fn();
	} );

	afterEach( () => {
		global.mw = originalMw;
		global.window.Layers = originalLayers;
		delete global.window.layersGetClass;
	} );

	describe( 'module initialization', () => {
		test( 'should create mw.layers object', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.layers ).toBeDefined();
		} );

		test( 'should call init on DOM ready when complete', () => {
			require( '../../../resources/ext.layers/init.js' );

			// init() should have been called since document.readyState is 'complete'
			expect( global.window.Layers.Viewer.UrlParser ).toHaveBeenCalled();
		} );
	} );

	describe( 'debug mode', () => {
		test( 'should set debug to true when wgLayersDebug is true', () => {
			global.mw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersDebug' ) {
					return true;
				}
				return null;
			} );

			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.layers.debug ).toBe( true );
		} );

		test( 'should set debug to false when wgLayersDebug is false', () => {
			global.mw.config.get.mockReturnValue( false );

			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.layers.debug ).toBe( false );
		} );

		test( 'should set debug to false on config error', () => {
			global.mw.config.get.mockImplementation( () => {
				throw new Error( 'Config error' );
			} );

			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.layers.debug ).toBe( false );
		} );
	} );

	describe( 'debugLog', () => {
		test( 'should log when debug is true', () => {
			global.mw.config.get.mockReturnValue( true );

			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.debugLog( 'test message' );

			expect( global.mw.log ).toHaveBeenCalled();
		} );

		test( 'should not log when debug is false', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.log.mockClear();
			global.mw.layers.debug = false;
			global.mw.layers.debugLog( 'test message' );

			expect( global.mw.log ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'debugWarn', () => {
		test( 'should warn when debug is true', () => {
			global.mw.config.get.mockReturnValue( true );

			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.debugWarn( 'test warning' );

			expect( global.mw.log.warn ).toHaveBeenCalled();
		} );

		test( 'should not warn when debug is false', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.log.warn.mockClear();
			global.mw.layers.debug = false;
			global.mw.layers.debugWarn( 'test warning' );

			expect( global.mw.log.warn ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'init', () => {
		test( 'should create urlParser instance', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.layers.urlParser ).toBeDefined();
		} );

		test( 'should create viewerManager instance', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.layers.viewerManager ).toBeDefined();
		} );

		test( 'should create apiFallback instance', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.layers.apiFallback ).toBeDefined();
		} );

		test( 'should call initializeLayerViewers', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( mockViewerManager.initializeLayerViewers ).toHaveBeenCalled();
		} );

		test( 'should call initializeFilePageFallback', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( mockViewerManager.initializeFilePageFallback ).toHaveBeenCalled();
		} );

		test( 'should call apiFallback.initialize', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( mockApiFallback.initialize ).toHaveBeenCalled();
		} );

		test( 'should register wikipage.content hook', () => {
			require( '../../../resources/ext.layers/init.js' );

			expect( global.mw.hook ).toHaveBeenCalledWith( 'wikipage.content' );
		} );

		test( 'should handle mw.hook failure gracefully', () => {
			global.mw.hook.mockImplementation( () => {
				throw new Error( 'Hook error' );
			} );
			global.mw.config.get.mockReturnValue( true );

			expect( () => {
				require( '../../../resources/ext.layers/init.js' );
			} ).not.toThrow();

			expect( global.mw.log.warn ).toHaveBeenCalled();
		} );
	} );

	describe( 'getPageLayersParam', () => {
		test( 'should delegate to urlParser', () => {
			require( '../../../resources/ext.layers/init.js' );

			const result = global.mw.layers.getPageLayersParam();

			expect( result ).toBe( 'test-param' );
		} );

		test( 'should return null when urlParser is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.urlParser = null;

			const result = global.mw.layers.getPageLayersParam();

			expect( result ).toBe( null );
		} );
	} );

	describe( 'decodeHtmlEntities', () => {
		test( 'should delegate to urlParser', () => {
			require( '../../../resources/ext.layers/init.js' );

			const result = global.mw.layers.decodeHtmlEntities( 'test' );

			expect( result ).toBe( 'test-decoded' );
		} );

		test( 'should return input when urlParser is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.urlParser = null;

			const result = global.mw.layers.decodeHtmlEntities( 'test' );

			expect( result ).toBe( 'test' );
		} );
	} );

	describe( 'isAllowedLayersValue', () => {
		test( 'should delegate to urlParser', () => {
			require( '../../../resources/ext.layers/init.js' );

			const result = global.mw.layers.isAllowedLayersValue( 'on' );

			expect( result ).toBe( true );
		} );

		test( 'should return false when urlParser is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.urlParser = null;

			const result = global.mw.layers.isAllowedLayersValue( 'on' );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'escRe', () => {
		test( 'should delegate to urlParser.escapeRegExp', () => {
			require( '../../../resources/ext.layers/init.js' );

			const result = global.mw.layers.escRe( 'test' );

			expect( result ).toBe( 'test-escaped' );
		} );

		test( 'should use fallback when urlParser is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.urlParser = null;

			const result = global.mw.layers.escRe( 'test.*?+' );

			expect( result ).toBe( 'test\\.\\*\\?\\+' );
		} );
	} );

	describe( 'detectLayersFromDataMw', () => {
		test( 'should delegate to urlParser', () => {
			require( '../../../resources/ext.layers/init.js' );

			const el = document.createElement( 'div' );
			const result = global.mw.layers.detectLayersFromDataMw( el );

			expect( result ).toBe( 'detected-value' );
		} );

		test( 'should return null when urlParser is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.urlParser = null;

			const el = document.createElement( 'div' );
			const result = global.mw.layers.detectLayersFromDataMw( el );

			expect( result ).toBe( null );
		} );
	} );

	describe( 'initializeLayerViewers', () => {
		test( 'should delegate to viewerManager', () => {
			require( '../../../resources/ext.layers/init.js' );

			global.mw.layers.initializeLayerViewers();

			// Called once during init, once by our call
			expect( mockViewerManager.initializeLayerViewers ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'should do nothing when viewerManager is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.viewerManager = null;

			expect( () => {
				global.mw.layers.initializeLayerViewers();
			} ).not.toThrow();
		} );
	} );

	describe( 'initializeApiFallbackForMissingData', () => {
		test( 'should delegate to apiFallback', () => {
			require( '../../../resources/ext.layers/init.js' );

			global.mw.layers.initializeApiFallbackForMissingData();

			// Called once during init, once by our call
			expect( mockApiFallback.initialize ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'should do nothing when apiFallback is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.apiFallback = null;

			expect( () => {
				global.mw.layers.initializeApiFallbackForMissingData();
			} ).not.toThrow();
		} );
	} );

	describe( 'initializeFilePageFallback', () => {
		test( 'should delegate to viewerManager', () => {
			require( '../../../resources/ext.layers/init.js' );

			global.mw.layers.initializeFilePageFallback();

			// Called once during init, once by our call
			expect( mockViewerManager.initializeFilePageFallback ).toHaveBeenCalledTimes( 2 );
		} );

		test( 'should do nothing when viewerManager is not available', () => {
			require( '../../../resources/ext.layers/init.js' );
			global.mw.layers.viewerManager = null;

			expect( () => {
				global.mw.layers.initializeFilePageFallback();
			} ).not.toThrow();
		} );
	} );

	describe( 'getClass helper', () => {
		test( 'should resolve classes from Layers namespace', () => {
			require( '../../../resources/ext.layers/init.js' );

			// The module was able to resolve UrlParser from Layers.Viewer.UrlParser
			expect( global.window.Layers.Viewer.UrlParser ).toHaveBeenCalled();
		} );

		test( 'should fall back to global when namespace path fails', () => {
			// Remove the namespace path
			delete global.window.Layers.Viewer;

			// Add global fallback
			global.window.LayersUrlParser = jest.fn( function () {
				Object.assign( this, mockUrlParser );
			} );
			global.window.LayersViewerManager = jest.fn( function () {
				Object.assign( this, mockViewerManager );
			} );
			global.window.LayersApiFallback = jest.fn( function () {
				Object.assign( this, mockApiFallback );
			} );

			require( '../../../resources/ext.layers/init.js' );

			expect( global.window.LayersUrlParser ).toHaveBeenCalled();
		} );
	} );

	describe( 'wikipage.content hook callback', () => {
		test( 'should re-initialize viewers when hook fires', () => {
			let hookCallback;
			global.mw.hook.mockImplementation( () => ( {
				add: jest.fn( ( cb ) => {
					hookCallback = cb;
				} )
			} ) );

			require( '../../../resources/ext.layers/init.js' );

			// Reset call counts
			mockViewerManager.initializeLayerViewers.mockClear();
			mockViewerManager.initializeFilePageFallback.mockClear();
			mockApiFallback.initialize.mockClear();

			// Fire the hook callback
			hookCallback();

			expect( mockViewerManager.initializeLayerViewers ).toHaveBeenCalled();
			expect( mockViewerManager.initializeFilePageFallback ).toHaveBeenCalled();
			expect( mockApiFallback.initialize ).toHaveBeenCalled();
		} );
	} );

	describe( 'pageshow event (bfcache navigation)', () => {
		test( 'should refresh viewers when page is restored from bfcache', () => {
			// Add refreshAllViewers to mock
			mockViewerManager.refreshAllViewers = jest.fn().mockResolvedValue( { refreshed: 1 } );

			// Track event listeners
			const eventListeners = {};
			const originalAddEventListener = window.addEventListener;
			window.addEventListener = jest.fn( ( event, handler ) => {
				eventListeners[ event ] = handler;
			} );

			require( '../../../resources/ext.layers/init.js' );

			// Restore addEventListener
			window.addEventListener = originalAddEventListener;

			// Verify pageshow listener was registered
			expect( eventListeners.pageshow ).toBeDefined();

			// Simulate bfcache restoration (event.persisted = true)
			eventListeners.pageshow( { persisted: true } );

			// Should have called refreshAllViewers
			expect( mockViewerManager.refreshAllViewers ).toHaveBeenCalled();
		} );

		test( 'should not refresh viewers on normal page load', () => {
			// Add refreshAllViewers to mock
			mockViewerManager.refreshAllViewers = jest.fn().mockResolvedValue( { refreshed: 0 } );

			// Track event listeners
			const eventListeners = {};
			const originalAddEventListener = window.addEventListener;
			window.addEventListener = jest.fn( ( event, handler ) => {
				eventListeners[ event ] = handler;
			} );

			require( '../../../resources/ext.layers/init.js' );

			// Restore addEventListener
			window.addEventListener = originalAddEventListener;

			// Simulate normal page load (event.persisted = false)
			eventListeners.pageshow( { persisted: false } );

			// Should NOT have called refreshAllViewers
			expect( mockViewerManager.refreshAllViewers ).not.toHaveBeenCalled();
		} );
	} );
} );
