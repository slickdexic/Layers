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

	describe( 'processError', function () {
		it( 'should process Error objects correctly', function () {
			const error = new Error( 'Test error message' );
			error.stack = 'Error: Test\n    at test.js:10';

			const result = errorHandler.processError( error, 'TestContext', 'api', { extra: 'data' } );

			expect( result.message ).toBe( 'Test error message' );
			expect( result.stack ).toContain( 'Error: Test' );
			expect( result.context ).toBe( 'TestContext' );
			expect( result.type ).toBe( 'api' );
			expect( result.metadata.extra ).toBe( 'data' );
			expect( result.severity ).toBe( 'high' );
		} );

		it( 'should process string errors', function () {
			const result = errorHandler.processError( 'String error', 'Context', 'canvas' );

			expect( result.message ).toBe( 'String error' );
			expect( result.stack ).toBe( '' );
		} );

		it( 'should handle non-Error non-string values', function () {
			const result = errorHandler.processError( { invalid: 'object' }, 'Context', 'test' );

			expect( result.message ).toBe( 'Unknown error occurred' );
		} );

		it( 'should handle null error', function () {
			const result = errorHandler.processError( null, 'Context', 'test' );

			expect( result.message ).toBe( 'Unknown error occurred' );
		} );

		it( 'should use defaults for missing parameters', function () {
			const result = errorHandler.processError( 'Error' );

			expect( result.context ).toBe( 'Unknown' );
			expect( result.type ).toBe( 'general' );
			expect( result.metadata ).toEqual( {} );
		} );

		it( 'should include timestamp, userAgent, and url', function () {
			const result = errorHandler.processError( 'Error', 'Context', 'test' );

			expect( result.timestamp ).toBeTruthy();
			expect( result.userAgent ).toBeTruthy();
			expect( result.url ).toBeTruthy();
			expect( result.id ).toMatch( /^err_/ );
		} );
	} );

	describe( 'logError', function () {
		it( 'should log to console based on severity', function () {
			const errorInfo = {
				context: 'Test',
				message: 'Error message',
				severity: 'critical'
			};

			errorHandler.logError( errorInfo );

			expect( console.error ).toHaveBeenCalled();
		} );

		it( 'should log warnings for medium severity', function () {
			const errorInfo = {
				context: 'Test',
				message: 'Warning message',
				severity: 'medium'
			};

			errorHandler.logError( errorInfo );

			expect( console.warn ).toHaveBeenCalled();
		} );

		it( 'should log to mw.log if available', function () {
			const errorInfo = {
				context: 'Test',
				message: 'Test message',
				severity: 'high'
			};

			errorHandler.logError( errorInfo );

			expect( mw.log.error ).toHaveBeenCalledWith(
				expect.stringContaining( 'Test' )
			);
		} );

		it( 'should log in debug mode', function () {
			errorHandler.setDebugMode( true );
			const errorInfo = {
				context: 'Debug',
				message: 'Debug message',
				severity: 'low'
			};

			errorHandler.logError( errorInfo );

			expect( console.log ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleError', function () {
		it( 'should process and queue the error', function () {
			errorHandler.handleError( new Error( 'Test' ), 'Context', 'api' );

			expect( errorHandler.errorQueue.length ).toBe( 1 );
			expect( errorHandler.errorQueue[ 0 ].message ).toBe( 'Test' );
		} );

		it( 'should call logError', function () {
			const logSpy = jest.spyOn( errorHandler, 'logError' );

			errorHandler.handleError( 'Error', 'Context', 'test' );

			expect( logSpy ).toHaveBeenCalled();
		} );

		it( 'should call showUserNotification for high severity', function () {
			const notifySpy = jest.spyOn( errorHandler, 'showUserNotification' );

			errorHandler.handleError( 'Error', 'Context', 'api' );

			expect( notifySpy ).toHaveBeenCalled();
		} );

		it( 'should attempt recovery', function () {
			const recoverySpy = jest.spyOn( errorHandler, 'attemptRecovery' );

			errorHandler.handleError( 'Error', 'Context', 'load' );

			expect( recoverySpy ).toHaveBeenCalled();
		} );

		it( 'should report critical errors', function () {
			const reportSpy = jest.spyOn( errorHandler, 'reportError' );

			errorHandler.handleError( 'Security breach', 'Context', 'security' );

			expect( reportSpy ).toHaveBeenCalled();
		} );
	} );

	describe( 'showUserNotification', function () {
		it( 'should create notification for high severity', function () {
			const createSpy = jest.spyOn( errorHandler, 'createUserNotification' );

			errorHandler.showUserNotification( { severity: 'high', type: 'api' } );

			expect( createSpy ).toHaveBeenCalled();
		} );

		it( 'should create notification for critical severity', function () {
			const createSpy = jest.spyOn( errorHandler, 'createUserNotification' );

			errorHandler.showUserNotification( { severity: 'critical', type: 'security' } );

			expect( createSpy ).toHaveBeenCalled();
		} );

		it( 'should not create notification for medium severity', function () {
			const createSpy = jest.spyOn( errorHandler, 'createUserNotification' );

			errorHandler.showUserNotification( { severity: 'medium' } );

			expect( createSpy ).not.toHaveBeenCalled();
		} );

		it( 'should not create notification for low severity', function () {
			const createSpy = jest.spyOn( errorHandler, 'createUserNotification' );

			errorHandler.showUserNotification( { severity: 'low' } );

			expect( createSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'createUserNotification', function () {
		it( 'should create notification element with correct class', function () {
			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const notification = errorHandler.notificationContainer.querySelector( '.layers-error-notification' );
			expect( notification ).not.toBeNull();
			expect( notification.classList.contains( 'layers-error-high' ) ).toBe( true );
		} );

		it( 'should create notification with error message', function () {
			const errorInfo = {
				severity: 'critical',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const message = errorHandler.notificationContainer.querySelector( '.error-message' );
			expect( message ).not.toBeNull();
			expect( message.textContent ).toBeTruthy();
		} );

		it( 'should include close button', function () {
			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const closeBtn = errorHandler.notificationContainer.querySelector( '.error-close' );
			expect( closeBtn ).not.toBeNull();
		} );

		it( 'should remove notification when close button clicked', function () {
			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const closeBtn = errorHandler.notificationContainer.querySelector( '.error-close' );
			const notification = errorHandler.notificationContainer.querySelector( '.layers-error-notification' );

			closeBtn.click();

			expect( errorHandler.notificationContainer.contains( notification ) ).toBe( false );
		} );

		it( 'should announce error for screen readers when layersAnnouncer is available', function () {
			// Set up mock layersAnnouncer
			const mockAnnouncer = {
				announceError: jest.fn()
			};
			window.layersAnnouncer = mockAnnouncer;

			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			expect( mockAnnouncer.announceError ).toHaveBeenCalled();

			// Clean up
			delete window.layersAnnouncer;
		} );

		it( 'should not fail when layersAnnouncer is not available', function () {
			// Ensure layersAnnouncer is not defined
			delete window.layersAnnouncer;

			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			// Should not throw
			expect( () => {
				errorHandler.createUserNotification( errorInfo );
			} ).not.toThrow();
		} );

		it( 'should auto-remove non-critical notifications after timeout', function () {
			jest.useFakeTimers();

			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const notification = errorHandler.notificationContainer.querySelector( '.layers-error-notification' );
			expect( notification ).not.toBeNull();

			jest.advanceTimersByTime( 9000 );

			expect( errorHandler.notificationContainer.contains( notification ) ).toBe( false );

			jest.useRealTimers();
		} );

		it( 'should not auto-remove critical notifications', function () {
			jest.useFakeTimers();

			const errorInfo = {
				severity: 'critical',
				type: 'security',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const notification = errorHandler.notificationContainer.querySelector( '.layers-error-notification' );

			jest.advanceTimersByTime( 10000 );

			expect( errorHandler.notificationContainer.contains( notification ) ).toBe( true );

			jest.useRealTimers();
		} );

		it( 'should include timestamp in notification', function () {
			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const timeEl = errorHandler.notificationContainer.querySelector( '.error-time' );
			expect( timeEl ).not.toBeNull();
			expect( timeEl.textContent ).toBeTruthy();
		} );

		it( 'should include error icon', function () {
			const errorInfo = {
				severity: 'high',
				type: 'api',
				timestamp: new Date().toISOString()
			};

			errorHandler.createUserNotification( errorInfo );

			const icon = errorHandler.notificationContainer.querySelector( '.error-icon' );
			expect( icon ).not.toBeNull();
			expect( icon.textContent ).toBe( '⚠' );
		} );
	} );

	describe( 'getRecoveryStrategy', function () {
		it( 'should return retry strategy for load errors', function () {
			const strategy = errorHandler.getRecoveryStrategy( { type: 'load' } );

			expect( strategy ).not.toBeNull();
			expect( strategy.action ).toBe( 'retry' );
			expect( strategy.delay ).toBe( 2000 );
			expect( strategy.maxAttempts ).toBe( 2 );
		} );

		it( 'should return retry strategy for save errors', function () {
			const strategy = errorHandler.getRecoveryStrategy( { type: 'save' } );

			expect( strategy ).not.toBeNull();
			expect( strategy.action ).toBe( 'retry' );
			expect( strategy.delay ).toBe( 3000 );
		} );

		it( 'should return refresh strategy for canvas errors', function () {
			const strategy = errorHandler.getRecoveryStrategy( { type: 'canvas' } );

			expect( strategy ).not.toBeNull();
			expect( strategy.action ).toBe( 'refresh' );
		} );

		it( 'should return notify strategy for validation errors', function () {
			const strategy = errorHandler.getRecoveryStrategy( { type: 'validation' } );

			expect( strategy ).not.toBeNull();
			expect( strategy.action ).toBe( 'notify' );
		} );

		it( 'should return null for unknown error types', function () {
			const strategy = errorHandler.getRecoveryStrategy( { type: 'unknown' } );

			expect( strategy ).toBeNull();
		} );
	} );

	describe( 'executeRecoveryStrategy', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should show notification and retry for retry action', function () {
			const notifySpy = jest.spyOn( errorHandler, 'showRecoveryNotification' );
			const retrySpy = jest.spyOn( errorHandler, 'retryOperation' );

			const strategy = { action: 'retry', delay: 1000, message: 'Retrying...' };
			const errorInfo = { type: 'load', message: 'Load failed' };

			errorHandler.executeRecoveryStrategy( strategy, errorInfo );

			expect( notifySpy ).toHaveBeenCalledWith( 'Retrying...' );

			jest.advanceTimersByTime( 1500 );

			expect( retrySpy ).toHaveBeenCalledWith( errorInfo );
		} );

		it( 'should show notification for notify action', function () {
			const notifySpy = jest.spyOn( errorHandler, 'showRecoveryNotification' );

			const strategy = { action: 'notify', message: 'Check input' };
			const errorInfo = { type: 'validation' };

			errorHandler.executeRecoveryStrategy( strategy, errorInfo );

			expect( notifySpy ).toHaveBeenCalledWith( 'Check input' );
		} );

		it( 'should schedule reload for refresh action', function () {
			const notifySpy = jest.spyOn( errorHandler, 'showRecoveryNotification' );
			// Note: window.location.reload cannot be mocked in JSDOM
			// Just verify the notification is shown and timeout is set

			const strategy = { action: 'refresh', message: 'Refreshing...' };
			const errorInfo = { type: 'canvas' };

			errorHandler.executeRecoveryStrategy( strategy, errorInfo );

			expect( notifySpy ).toHaveBeenCalledWith( 'Refreshing...' );

			// The setTimeout for reload was scheduled - advance past it
			// (reload won't actually happen in test environment)
			jest.advanceTimersByTime( 2500 );
		} );
	} );

	describe( 'attemptRecovery', function () {
		it( 'should execute recovery strategy when available', function () {
			const executeSpy = jest.spyOn( errorHandler, 'executeRecoveryStrategy' );

			errorHandler.attemptRecovery( { type: 'load' } );

			expect( executeSpy ).toHaveBeenCalled();
		} );

		it( 'should not execute when no strategy available', function () {
			const executeSpy = jest.spyOn( errorHandler, 'executeRecoveryStrategy' );

			errorHandler.attemptRecovery( { type: 'unknown-type' } );

			expect( executeSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'showRecoveryNotification', function () {
		it( 'should call mw.notify when available', function () {
			errorHandler.showRecoveryNotification( 'Recovery message' );

			expect( mw.notify ).toHaveBeenCalledWith( 'Recovery message', {
				type: 'info',
				autoHide: true
			} );
		} );

		it( 'should handle missing mw.notify gracefully', function () {
			const originalNotify = mw.notify;
			mw.notify = undefined;

			expect( () => {
				errorHandler.showRecoveryNotification( 'Test' );
			} ).not.toThrow();

			mw.notify = originalNotify;
		} );
	} );

	describe( 'retryOperation', function () {
		it( 'should log retry attempt', function () {
			const logSpy = jest.spyOn( errorHandler, 'logError' );

			errorHandler.retryOperation( { message: 'Original error', severity: 'high' } );

			expect( logSpy ).toHaveBeenCalledWith(
				expect.objectContaining( {
					message: expect.stringContaining( 'Recovery: Retrying operation' ),
					severity: 'low'
				} )
			);
		} );
	} );

	describe( 'global error handlers', function () {
		it( 'should handle unhandled promise rejections', function () {
			const handleSpy = jest.spyOn( errorHandler, 'handleError' );

			// Create a new instance to get fresh listeners
			const newHandler = new ErrorHandler();

			// Simulate unhandled rejection
			const event = new Event( 'unhandledrejection' );
			event.reason = new Error( 'Promise rejected' );
			window.dispatchEvent( event );

			expect( handleSpy ).toHaveBeenCalled();

			newHandler.destroy();
		} );

		it( 'should handle script errors', function () {
			const handleSpy = jest.spyOn( errorHandler, 'handleError' );

			// Create a new instance
			const newHandler = new ErrorHandler();

			// Simulate error event
			const event = new ErrorEvent( 'error', {
				error: new Error( 'Script error' ),
				filename: 'test.js',
				lineno: 10,
				colno: 5
			} );
			window.dispatchEvent( event );

			expect( handleSpy ).toHaveBeenCalled();

			newHandler.destroy();
		} );
	} );

	describe( 'ErrorHandler module exports', function () {
		it( 'should expose ErrorHandler on window.Layers.Utils', function () {
			expect( window.Layers.Utils.ErrorHandler ).toBeDefined();
		} );

		it( 'should be a constructor function', function () {
			expect( typeof window.Layers.Utils.ErrorHandler ).toBe( 'function' );
		} );

		it( 'should create instance with new', function () {
			const instance = new ErrorHandler();

			expect( instance ).toBeInstanceOf( ErrorHandler );
			instance.destroy();
		} );
	} );
} );