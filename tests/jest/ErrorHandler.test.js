/**
 * Jest tests for ErrorHandler.js
 * Tests centralized error handling, severity classification, and user notifications
 */
'use strict';

describe( 'ErrorHandler', function () {
	let ErrorHandler;
	let errorHandler;

	beforeAll( function () {
		// Set up JSDOM globals
		global.document = window.document;

		// Mock mw (MediaWiki) global
		global.mw = {
			config: {
				get: jest.fn( function ( key ) {
					if ( key === 'wgLayersDebug' ) {
						return false;
					}
					return null;
				} )
			},
			message: jest.fn( function ( key ) {
				return {
					text: function () {
						return key;
					},
					exists: function () {
						return key.startsWith( 'layers-error-' );
					}
				};
			} ),
			log: {
				warn: jest.fn(),
				error: jest.fn()
			},
			track: jest.fn(),
			notify: jest.fn()
		};

		// Mock console methods
		global.console = {
			log: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		};

		// Load ErrorHandler using require for proper coverage tracking
		const { ErrorHandler: LoadedErrorHandler } = require( '../../resources/ext.layers.editor/ErrorHandler.js' );
		ErrorHandler = LoadedErrorHandler;
	} );

	beforeEach( function () {
		// Clear global instance
		window.layersErrorHandler = null;

		// Create fresh instance
		errorHandler = new ErrorHandler();

		// Clear mocks
		jest.clearAllMocks();
	} );

	afterEach( function () {
		if ( errorHandler ) {
			errorHandler.destroy();
		}
	} );

	describe( 'constructor', function () {
		it( 'should create ErrorHandler with empty error queue', function () {
			expect( errorHandler.errorQueue ).toEqual( [] );
		} );

		it( 'should set maxErrors to 10', function () {
			expect( errorHandler.maxErrors ).toBe( 10 );
		} );

		it( 'should initialize notification container', function () {
			expect( errorHandler.notificationContainer ).not.toBeNull();
			expect( errorHandler.notificationContainer.className ).toBe( 'layers-error-notifications' );
		} );

		it( 'should set up global listeners array', function () {
			expect( Array.isArray( errorHandler.globalListeners ) ).toBe( true );
		} );

		it( 'should start with debugMode false', function () {
			expect( errorHandler.debugMode ).toBe( false );
		} );
	} );

	describe( 'initErrorContainer', function () {
		it( 'should create container with ARIA role', function () {
			expect( errorHandler.notificationContainer.getAttribute( 'role' ) ).toBe( 'alert' );
		} );

		it( 'should create container with aria-live attribute', function () {
			expect( errorHandler.notificationContainer.getAttribute( 'aria-live' ) ).toBe( 'polite' );
		} );

		it( 'should append container to document body', function () {
			expect( document.body.contains( errorHandler.notificationContainer ) ).toBe( true );
		} );
	} );

	describe( 'generateErrorId', function () {
		it( 'should generate unique error IDs', function () {
			const id1 = errorHandler.generateErrorId();
			const id2 = errorHandler.generateErrorId();

			expect( id1 ).not.toBe( id2 );
		} );

		it( 'should start with err_ prefix', function () {
			const id = errorHandler.generateErrorId();

			expect( id.startsWith( 'err_' ) ).toBe( true );
		} );

		it( 'should contain timestamp component', function () {
			const id = errorHandler.generateErrorId();
			const parts = id.split( '_' );

			expect( parts.length ).toBeGreaterThanOrEqual( 2 );
			expect( Number( parts[ 1 ] ) ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'determineSeverity', function () {
		it( 'should return critical for security type', function () {
			const result = errorHandler.determineSeverity( 'security', 'test message' );

			expect( result ).toBe( 'critical' );
		} );

		it( 'should return critical for data-loss type', function () {
			const result = errorHandler.determineSeverity( 'data-loss', 'test message' );

			expect( result ).toBe( 'critical' );
		} );

		it( 'should return critical for message containing xss', function () {
			const result = errorHandler.determineSeverity( 'unknown', 'XSS attack detected' );

			expect( result ).toBe( 'critical' );
		} );

		it( 'should return critical for message containing injection', function () {
			const result = errorHandler.determineSeverity( 'unknown', 'SQL injection attempt' );

			expect( result ).toBe( 'critical' );
		} );

		it( 'should return high for api type', function () {
			const result = errorHandler.determineSeverity( 'api', 'test message' );

			expect( result ).toBe( 'high' );
		} );

		it( 'should return high for save type', function () {
			const result = errorHandler.determineSeverity( 'save', 'test message' );

			expect( result ).toBe( 'high' );
		} );

		it( 'should return high for load type', function () {
			const result = errorHandler.determineSeverity( 'load', 'test message' );

			expect( result ).toBe( 'high' );
		} );

		it( 'should return medium for canvas type', function () {
			const result = errorHandler.determineSeverity( 'canvas', 'test message' );

			expect( result ).toBe( 'medium' );
		} );

		it( 'should return medium for validation type', function () {
			const result = errorHandler.determineSeverity( 'validation', 'test message' );

			expect( result ).toBe( 'medium' );
		} );

		it( 'should return low for unknown type', function () {
			const result = errorHandler.determineSeverity( 'unknown', 'test message' );

			expect( result ).toBe( 'low' );
		} );
	} );

	describe( 'addToErrorQueue', function () {
		it( 'should add error to queue', function () {
			const errorInfo = { id: 'test1', message: 'Test error' };

			errorHandler.addToErrorQueue( errorInfo );

			expect( errorHandler.errorQueue.length ).toBe( 1 );
			expect( errorHandler.errorQueue[ 0 ] ).toBe( errorInfo );
		} );

		it( 'should maintain maxErrors limit', function () {
			for ( let i = 0; i < 15; i++ ) {
				errorHandler.addToErrorQueue( { id: 'err' + i } );
			}

			expect( errorHandler.errorQueue.length ).toBe( 10 );
		} );

		it( 'should remove oldest errors when over limit', function () {
			for ( let i = 0; i < 12; i++ ) {
				errorHandler.addToErrorQueue( { id: 'err' + i } );
			}

			expect( errorHandler.errorQueue[ 0 ].id ).toBe( 'err2' );
			expect( errorHandler.errorQueue[ 9 ].id ).toBe( 'err11' );
		} );
	} );

	describe( 'getLogLevel', function () {
		it( 'should return error for critical severity', function () {
			const result = errorHandler.getLogLevel( 'critical' );

			expect( result ).toBe( 'error' );
		} );

		it( 'should return error for high severity', function () {
			const result = errorHandler.getLogLevel( 'high' );

			expect( result ).toBe( 'error' );
		} );

		it( 'should return warn for medium severity', function () {
			const result = errorHandler.getLogLevel( 'medium' );

			expect( result ).toBe( 'warn' );
		} );

		it( 'should return log for low severity', function () {
			const result = errorHandler.getLogLevel( 'low' );

			expect( result ).toBe( 'log' );
		} );

		it( 'should return log for unknown severity', function () {
			const result = errorHandler.getLogLevel( 'unknown' );

			expect( result ).toBe( 'log' );
		} );
	} );

	describe( 'getUserFriendlyMessage', function () {
		it( 'should return message for api type', function () {
			const errorInfo = { type: 'api' };

			const result = errorHandler.getUserFriendlyMessage( errorInfo );

			// Should return i18n key or fallback message
			expect( result ).toBeTruthy();
		} );

		it( 'should return message for canvas type', function () {
			const errorInfo = { type: 'canvas' };

			const result = errorHandler.getUserFriendlyMessage( errorInfo );

			expect( result ).toBeTruthy();
		} );

		it( 'should return message for validation type', function () {
			const errorInfo = { type: 'validation' };

			const result = errorHandler.getUserFriendlyMessage( errorInfo );

			expect( result ).toBeTruthy();
		} );

		it( 'should return message for load type', function () {
			const errorInfo = { type: 'load' };

			const result = errorHandler.getUserFriendlyMessage( errorInfo );

			expect( result ).toBeTruthy();
		} );

		it( 'should return message for unknown type', function () {
			const errorInfo = { type: 'unknown' };

			const result = errorHandler.getUserFriendlyMessage( errorInfo );

			expect( result ).toBeTruthy();
		} );

		it( 'should use fallback when mw.message not available', function () {
			const originalMw = window.mw;
			const originalLayersMessages = window.layersMessages;
			window.mw = null;
			window.layersMessages = null;

			const errorInfo = { type: 'api' };
			const result = errorHandler.getUserFriendlyMessage( errorInfo );

			window.mw = originalMw;
			window.layersMessages = originalLayersMessages;
			expect( result ).toContain( 'save' );
		} );
	} );

	describe( 'escapeHtml', function () {
		it( 'should escape ampersand', function () {
			const result = errorHandler.escapeHtml( 'test & test' );

			expect( result ).toBe( 'test &amp; test' );
		} );

		it( 'should escape less than', function () {
			const result = errorHandler.escapeHtml( '<script>' );

			expect( result ).toBe( '&lt;script&gt;' );
		} );

		it( 'should escape greater than', function () {
			const result = errorHandler.escapeHtml( '1 > 0' );

			expect( result ).toBe( '1 &gt; 0' );
		} );

		it( 'should escape double quotes', function () {
			const result = errorHandler.escapeHtml( 'say "hello"' );

			expect( result ).toBe( 'say &quot;hello&quot;' );
		} );

		it( 'should escape single quotes', function () {
			const result = errorHandler.escapeHtml( "it's" );

			expect( result ).toBe( 'it&#39;s' );
		} );

		it( 'should handle multiple special characters', function () {
			const result = errorHandler.escapeHtml( '<script>alert("xss")</script>' );

			expect( result ).toBe( '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;' );
		} );

		it( 'should handle empty string', function () {
			const result = errorHandler.escapeHtml( '' );

			expect( result ).toBe( '' );
		} );

		it( 'should convert non-string to string', function () {
			const result = errorHandler.escapeHtml( 123 );

			expect( result ).toBe( '123' );
		} );
	} );

	describe( 'getRecentErrors', function () {
		beforeEach( function () {
			for ( let i = 0; i < 8; i++ ) {
				errorHandler.addToErrorQueue( { id: 'err' + i } );
			}
		} );

		it( 'should return last 5 errors by default', function () {
			const result = errorHandler.getRecentErrors();

			expect( result.length ).toBe( 5 );
		} );

		it( 'should return specified number of errors', function () {
			const result = errorHandler.getRecentErrors( 3 );

			expect( result.length ).toBe( 3 );
		} );

		it( 'should return most recent errors', function () {
			const result = errorHandler.getRecentErrors( 2 );

			expect( result[ 0 ].id ).toBe( 'err6' );
			expect( result[ 1 ].id ).toBe( 'err7' );
		} );
	} );

	describe( 'clearErrors', function () {
		it( 'should clear error queue', function () {
			errorHandler.addToErrorQueue( { id: 'test1' } );
			errorHandler.addToErrorQueue( { id: 'test2' } );

			errorHandler.clearErrors();

			expect( errorHandler.errorQueue.length ).toBe( 0 );
		} );

		it( 'should clear notification container', function () {
			const child = document.createElement( 'div' );
			errorHandler.notificationContainer.appendChild( child );

			errorHandler.clearErrors();

			expect( errorHandler.notificationContainer.children.length ).toBe( 0 );
		} );
	} );

	describe( 'setDebugMode', function () {
		it( 'should enable debug mode', function () {
			errorHandler.setDebugMode( true );

			expect( errorHandler.debugMode ).toBe( true );
		} );

		it( 'should disable debug mode', function () {
			errorHandler.debugMode = true;
			errorHandler.setDebugMode( false );

			expect( errorHandler.debugMode ).toBe( false );
		} );

		it( 'should coerce truthy values to boolean', function () {
			errorHandler.setDebugMode( 1 );

			expect( errorHandler.debugMode ).toBe( true );
		} );

		it( 'should coerce falsy values to boolean', function () {
			errorHandler.setDebugMode( 0 );

			expect( errorHandler.debugMode ).toBe( false );
		} );
	} );

	describe( 'destroy', function () {
		it( 'should remove notification container from DOM', function () {
			const container = errorHandler.notificationContainer;

			errorHandler.destroy();

			expect( document.body.contains( container ) ).toBe( false );
		} );

		it( 'should clear error queue', function () {
			errorHandler.addToErrorQueue( { id: 'test' } );

			errorHandler.destroy();

			expect( errorHandler.errorQueue.length ).toBe( 0 );
		} );

		it( 'should set notificationContainer to null', function () {
			errorHandler.destroy();

			expect( errorHandler.notificationContainer ).toBeNull();
		} );

		it( 'should clear global listeners array', function () {
			errorHandler.destroy();

			expect( errorHandler.globalListeners.length ).toBe( 0 );
		} );

		it( 'should clear global instance if this is it', function () {
			window.layersErrorHandler = errorHandler;

			errorHandler.destroy();

			expect( window.layersErrorHandler ).toBeNull();
		} );
	} );

	describe( 'reportError', function () {
		it( 'should report critical errors to mw.track', function () {
			const errorInfo = {
				id: 'test',
				type: 'test',
				severity: 'critical',
				context: 'test context',
				message: 'test message',
				timestamp: '2025-01-01T00:00:00Z'
			};

			errorHandler.reportError( errorInfo );

			expect( mw.track ).toHaveBeenCalledWith( 'layers.error', expect.objectContaining( {
				errorId: 'test',
				severity: 'critical'
			} ) );
		} );

		it( 'should report high severity errors to mw.track', function () {
			const errorInfo = {
				id: 'test',
				type: 'api',
				severity: 'high',
				context: 'test',
				message: 'test',
				timestamp: '2025-01-01T00:00:00Z'
			};

			errorHandler.reportError( errorInfo );

			expect( mw.track ).toHaveBeenCalled();
		} );

		it( 'should not report medium severity errors', function () {
			const errorInfo = {
				severity: 'medium'
			};

			errorHandler.reportError( errorInfo );

			expect( mw.track ).not.toHaveBeenCalled();
		} );

		it( 'should not report low severity errors', function () {
			const errorInfo = {
				severity: 'low'
			};

			errorHandler.reportError( errorInfo );

			expect( mw.track ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'registerWindowListener', function () {
		it( 'should add event listener to window', function () {
			const handler = jest.fn();
			const addSpy = jest.spyOn( window, 'addEventListener' );

			errorHandler.registerWindowListener( 'resize', handler );

			expect( addSpy ).toHaveBeenCalledWith( 'resize', handler, undefined );
		} );

		it( 'should track listener for cleanup', function () {
			const handler = jest.fn();
			const initialLength = errorHandler.globalListeners.length;

			errorHandler.registerWindowListener( 'scroll', handler );

			expect( errorHandler.globalListeners.length ).toBe( initialLength + 1 );
		} );
	} );

	describe( 'ErrorHandler module exports', function () {
		it( 'should expose LayersErrorHandler on window', function () {
			expect( window.LayersErrorHandler ).toBeDefined();
		} );

		it( 'should be a constructor function', function () {
			expect( typeof window.LayersErrorHandler ).toBe( 'function' );
		} );

		it( 'should create instance with new', function () {
			const instance = new ErrorHandler();

			expect( instance ).toBeInstanceOf( ErrorHandler );
			instance.destroy();
		} );
	} );
} );
