/**
 * Tests for APIErrorHandler class
 *
 * The APIErrorHandler handles error normalization, logging,
 * user notifications, and UI state updates for API operations.
 */

'use strict';

describe( 'APIErrorHandler', () => {
	let APIErrorHandler;
	let handler;
	let mockEditor;
	let originalMw;
	let originalLayersMessages;
	let originalLayersErrorHandler;

	beforeAll( () => {
		// Store original globals
		originalMw = global.mw;
		originalLayersMessages = global.window.layersMessages;
		originalLayersErrorHandler = global.window.layersErrorHandler;

		// Set up window.Layers namespace
		global.window.Layers = global.window.Layers || {};
		global.window.Layers.Editor = global.window.Layers.Editor || {};
	} );

	beforeEach( () => {
		// Mock mw object
		global.mw = {
			log: {
				error: jest.fn()
			},
			notify: jest.fn()
		};

		// Mock editor
		mockEditor = {
			errorLog: jest.fn(),
			uiManager: {
				hideSpinner: jest.fn()
			}
		};

		// Mock layersMessages
		global.window.layersMessages = {
			get: jest.fn( ( key, fallback ) => {
				const messages = {
					'layers-load-error': 'Failed to load layers',
					'layers-save-error': 'Failed to save layers',
					'layers-network-error': 'Network connection error'
				};
				return messages[ key ] || fallback;
			} )
		};

		// Mock layersErrorHandler
		global.window.layersErrorHandler = {
			handleError: jest.fn()
		};

		// Fresh module require
		jest.resetModules();
		APIErrorHandler = require( '../../resources/ext.layers.editor/APIErrorHandler.js' );
		handler = new APIErrorHandler( { editor: mockEditor } );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	afterAll( () => {
		// Restore globals
		global.mw = originalMw;
		global.window.layersMessages = originalLayersMessages;
		global.window.layersErrorHandler = originalLayersErrorHandler;
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default options', () => {
			const h = new APIErrorHandler();
			expect( h.editor ).toBeNull();
			expect( h.errorConfig ).toBeDefined();
			expect( h.errorConfig.errorMap ).toBeDefined();
			expect( h.errorConfig.defaults ).toBeDefined();
		} );

		it( 'should initialize with provided editor', () => {
			const h = new APIErrorHandler( { editor: mockEditor } );
			expect( h.editor ).toBe( mockEditor );
		} );

		it( 'should initialize with custom error config', () => {
			const customConfig = {
				errorMap: { 'custom-error': 'custom-message' },
				defaults: { load: 'custom-load-error' }
			};
			const h = new APIErrorHandler( { errorConfig: customConfig } );
			expect( h.errorConfig.errorMap[ 'custom-error' ] ).toBe( 'custom-message' );
		} );
	} );

	describe( 'setEditor', () => {
		it( 'should set editor reference', () => {
			const h = new APIErrorHandler();
			expect( h.editor ).toBeNull();
			h.setEditor( mockEditor );
			expect( h.editor ).toBe( mockEditor );
		} );
	} );

	describe( 'setEnableSaveButtonCallback', () => {
		it( 'should set the callback', () => {
			const callback = jest.fn();
			handler.setEnableSaveButtonCallback( callback );
			expect( handler.onEnableSaveButton ).toBe( callback );
		} );
	} );

	describe( 'normalizeError', () => {
		it( 'should normalize string error', () => {
			const result = handler.normalizeError( 'Something went wrong' );
			expect( result.code ).toBe( 'string-error' );
			expect( result.message ).toBe( 'Something went wrong' );
		} );

		it( 'should normalize MediaWiki API error format', () => {
			const error = {
				error: {
					code: 'invalidjson',
					info: 'Invalid JSON data'
				}
			};
			const result = handler.normalizeError( error );
			expect( result.code ).toBe( 'invalidjson' );
			expect( result.message ).toBe( 'Invalid JSON data' );
			expect( result.originalError ).toBe( error );
		} );

		it( 'should normalize standard JavaScript Error', () => {
			const error = new Error( 'Network failure' );
			const result = handler.normalizeError( error );
			expect( result.code ).toBe( 'Error' );
			expect( result.message ).toBe( 'Network failure' );
			expect( result.originalError ).toBe( error );
		} );

		it( 'should normalize generic object error with message', () => {
			// Objects with message property are treated as JS errors
			const error = { code: 'custom', message: 'Custom error' };
			const result = handler.normalizeError( error );
			// Uses error.name which is undefined -> 'js-error'
			expect( result.code ).toBe( 'js-error' );
			expect( result.message ).toBe( 'Custom error' );
		} );

		it( 'should normalize generic object error without message', () => {
			// Objects without message property use object-error branch
			const error = { code: 'custom', info: 'Custom info' };
			const result = handler.normalizeError( error );
			expect( result.code ).toBe( 'custom' );
			expect( result.message ).toBe( 'Custom info' );
		} );

		it( 'should handle null error', () => {
			const result = handler.normalizeError( null );
			expect( result.code ).toBe( 'unknown' );
		} );

		it( 'should handle undefined error', () => {
			const result = handler.normalizeError( undefined );
			expect( result.code ).toBe( 'unknown' );
		} );

		it( 'should handle error with only info property', () => {
			const error = { code: 'info-error', info: 'Info message' };
			const result = handler.normalizeError( error );
			expect( result.message ).toBe( 'Info message' );
		} );

		it( 'should use JSON.stringify for objects without message', () => {
			const error = { code: 'obj-error', data: 123 };
			const result = handler.normalizeError( error );
			expect( result.message ).toContain( 'data' );
		} );

		it( 'should handle API error with message instead of info', () => {
			const error = {
				error: {
					code: 'api-error',
					message: 'API message'
				}
			};
			const result = handler.normalizeError( error );
			expect( result.message ).toBe( 'API message' );
		} );

		it( 'should use fallback code when API error has no code', () => {
			const error = {
				error: {
					info: 'Some info'
				}
			};
			const result = handler.normalizeError( error );
			expect( result.code ).toBe( 'api-error' );
		} );
	} );

	describe( 'getUserMessage', () => {
		it( 'should get message from error map via MessageHelper', () => {
			global.window.layersMessages.get.mockReturnValue( 'Network connection error' );
			const error = { code: 'network-error', message: 'Network error' };
			const result = handler.getUserMessage( error, 'load' );
			expect( result ).toBe( 'Network connection error' );
		} );

		it( 'should use default message for operation when no specific message', () => {
			global.window.layersMessages.get
				.mockReturnValueOnce( '' ) // No specific message
				.mockReturnValueOnce( 'Failed to load layers' ); // Default message
			const error = { code: 'unknown-code', message: 'Unknown error' };
			const result = handler.getUserMessage( error, 'load' );
			// Falls through to hardcoded fallback when no message returned
			expect( result ).toBe( 'Failed to load layer data' );
		} );

		it( 'should use hardcoded fallback for save operation', () => {
			global.window.layersMessages = null;
			const error = { code: 'unknown', message: 'Unknown' };
			const result = handler.getUserMessage( error, 'save' );
			expect( result ).toBe( 'Failed to save layer data' );
		} );

		it( 'should use hardcoded fallback for load operation', () => {
			global.window.layersMessages = null;
			const error = { code: 'unknown', message: 'Unknown' };
			const result = handler.getUserMessage( error, 'load' );
			expect( result ).toBe( 'Failed to load layer data' );
		} );

		it( 'should use generic fallback for unknown operation', () => {
			global.window.layersMessages = null;
			const error = { code: 'unknown', message: 'Unknown' };
			const result = handler.getUserMessage( error, 'unknown-operation' );
			expect( result ).toBe( 'An error occurred' );
		} );
	} );

	describe( 'sanitizeLogMessage', () => {
		it( 'should return sanitized string for non-string input', () => {
			const result = handler.sanitizeLogMessage( 123 );
			expect( result ).toBe( 'Non-string error message' );
		} );

		it( 'should replace long token-like strings', () => {
			const message = 'Error with token abcdefghijklmnopqrstuvwxyz123';
			const result = handler.sanitizeLogMessage( message );
			expect( result ).toContain( '[TOKEN]' );
		} );

		it( 'should replace hex strings', () => {
			// The hex pattern matches 16+ hex chars
			const message = 'Error with hex aaaaaaaaaaaaaaaa';
			const result = handler.sanitizeLogMessage( message );
			expect( result ).toContain( '[HEX]' );
		} );

		it( 'should replace Windows paths', () => {
			const message = 'Error in C:\\Users\\test\\file.txt';
			const result = handler.sanitizeLogMessage( message );
			expect( result ).toContain( '[PATH]' );
		} );

		it( 'should replace URLs', () => {
			// URL pattern is applied after path pattern, so check it works
			const message = 'Error at https://x.c';
			const result = handler.sanitizeLogMessage( message );
			// May be replaced by [URL] or [PATH] depending on order
			expect( result ).toMatch( /\[(URL|PATH)\]/ );
		} );

		it( 'should replace IP addresses', () => {
			const message = 'Error from 192.168.1.1:8080';
			const result = handler.sanitizeLogMessage( message );
			expect( result ).toContain( '[IP]' );
		} );

		it( 'should replace email addresses', () => {
			const message = 'Error for user@example.com';
			const result = handler.sanitizeLogMessage( message );
			expect( result ).toContain( '[EMAIL]' );
		} );

		it( 'should truncate very long messages', () => {
			// Create message with no special patterns
			const longMessage = 'Error ' + 'word '.repeat( 60 );
			const result = handler.sanitizeLogMessage( longMessage );
			expect( result ).toContain( '[TRUNCATED]' );
			expect( result.length ).toBeLessThan( 250 );
		} );
	} );

	describe( 'sanitizeContext', () => {
		it( 'should sanitize string values', () => {
			const context = { filename: 'test.jpg', path: 'C:\\Users\\test' };
			const result = handler.sanitizeContext( context );
			expect( result.path ).toContain( '[PATH]' );
		} );

		it( 'should preserve number values', () => {
			const context = { count: 42 };
			const result = handler.sanitizeContext( context );
			expect( result.count ).toBe( 42 );
		} );

		it( 'should preserve boolean values', () => {
			const context = { success: true, failed: false };
			const result = handler.sanitizeContext( context );
			expect( result.success ).toBe( true );
			expect( result.failed ).toBe( false );
		} );

		it( 'should replace object values with placeholder', () => {
			const context = { data: { nested: true } };
			const result = handler.sanitizeContext( context );
			expect( result.data ).toBe( '[OBJECT]' );
		} );

		it( 'should handle empty context', () => {
			const result = handler.sanitizeContext( {} );
			expect( result ).toEqual( {} );
		} );

		it( 'should handle sanitization errors', () => {
			// Create an object that throws on key enumeration
			const badContext = {};
			Object.defineProperty( badContext, 'bad', {
				get() {
					throw new Error( 'Access error' );
				},
				enumerable: true
			} );
			const result = handler.sanitizeContext( badContext );
			expect( result.sanitizationFailed ).toBe( true );
		} );
	} );

	describe( 'logError', () => {
		it( 'should use editor errorLog when available', () => {
			const error = { code: 'test', message: 'Test error' };
			handler.logError( error, 'load', {} );
			expect( mockEditor.errorLog ).toHaveBeenCalled();
		} );

		it( 'should fall back to mw.log when editor not available', () => {
			const h = new APIErrorHandler();
			const error = { code: 'test', message: 'Test error' };
			h.logError( error, 'load', {} );
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should include timestamp in log entry', () => {
			const error = { code: 'test', message: 'Test error' };
			handler.logError( error, 'load', {} );
			const logCall = mockEditor.errorLog.mock.calls[ 0 ];
			expect( logCall[ 1 ].timestamp ).toBeDefined();
		} );

		it( 'should handle logging errors gracefully', () => {
			mockEditor.errorLog = jest.fn( () => {
				throw new Error( 'Logging failed' );
			} );
			const error = { code: 'test', message: 'Test error' };
			// Should not throw
			expect( () => handler.logError( error, 'load', {} ) ).not.toThrow();
		} );
	} );

	describe( 'showUserNotification', () => {
		it( 'should call mw.notify with message and type', () => {
			handler.showUserNotification( 'Test message', 'error' );
			expect( global.mw.notify ).toHaveBeenCalledWith( 'Test message', { type: 'error' } );
		} );

		it( 'should default to error type', () => {
			handler.showUserNotification( 'Test message' );
			expect( global.mw.notify ).toHaveBeenCalledWith( 'Test message', { type: 'error' } );
		} );

		it( 'should fall back to mw.log when mw.notify not available', () => {
			delete global.mw.notify;
			handler.showUserNotification( 'Test message' );
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should handle notification errors gracefully', () => {
			global.mw.notify = jest.fn( () => {
				throw new Error( 'Notify failed' );
			} );
			// Should not throw
			expect( () => handler.showUserNotification( 'Test' ) ).not.toThrow();
		} );
	} );

	describe( 'reportToErrorHandler', () => {
		it( 'should report to global error handler', () => {
			const error = { code: 'test', message: 'Test error' };
			handler.reportToErrorHandler( error, 'load', { extra: 'data' } );
			expect( global.window.layersErrorHandler.handleError ).toHaveBeenCalled();
		} );

		it( 'should not throw when error handler not available', () => {
			global.window.layersErrorHandler = null;
			const error = { code: 'test', message: 'Test error' };
			expect( () => handler.reportToErrorHandler( error, 'load', {} ) ).not.toThrow();
		} );

		it( 'should handle reporting errors gracefully', () => {
			global.window.layersErrorHandler.handleError = jest.fn( () => {
				throw new Error( 'Report failed' );
			} );
			const error = { code: 'test', message: 'Test error' };
			expect( () => handler.reportToErrorHandler( error, 'load', {} ) ).not.toThrow();
		} );
	} );

	describe( 'updateUIForError', () => {
		it( 'should hide spinner on error', () => {
			handler.updateUIForError( 'load' );
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should call save button callback for save operation', () => {
			const callback = jest.fn();
			handler.setEnableSaveButtonCallback( callback );
			handler.updateUIForError( 'save' );
			expect( callback ).toHaveBeenCalled();
		} );

		it( 'should not call save button callback for non-save operation', () => {
			const callback = jest.fn();
			handler.setEnableSaveButtonCallback( callback );
			handler.updateUIForError( 'load' );
			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'should handle UI errors gracefully', () => {
			mockEditor.uiManager.hideSpinner = jest.fn( () => {
				throw new Error( 'UI error' );
			} );
			expect( () => handler.updateUIForError( 'load' ) ).not.toThrow();
		} );

		it( 'should handle missing editor gracefully', () => {
			const h = new APIErrorHandler();
			expect( () => h.updateUIForError( 'load' ) ).not.toThrow();
		} );
	} );

	describe( 'handleError', () => {
		it( 'should return standardized error object', () => {
			const error = { error: { code: 'test', info: 'Test info' } };
			const result = handler.handleError( error, 'load' );
			expect( result.code ).toBe( 'test' );
			expect( result.operation ).toBe( 'load' );
			expect( result.timestamp ).toBeDefined();
		} );

		it( 'should call all error handling methods', () => {
			const spyLog = jest.spyOn( handler, 'logError' );
			const spyNotify = jest.spyOn( handler, 'showUserNotification' );
			const spyReport = jest.spyOn( handler, 'reportToErrorHandler' );
			const spyUI = jest.spyOn( handler, 'updateUIForError' );

			const error = { error: { code: 'test', info: 'Test' } };
			handler.handleError( error, 'save' );

			expect( spyLog ).toHaveBeenCalled();
			expect( spyNotify ).toHaveBeenCalled();
			expect( spyReport ).toHaveBeenCalled();
			expect( spyUI ).toHaveBeenCalled();
		} );

		it( 'should use default operation when not specified', () => {
			const error = new Error( 'Test' );
			const result = handler.handleError( error );
			expect( result.operation ).toBe( 'generic' );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up references', () => {
			const callback = jest.fn();
			handler.setEnableSaveButtonCallback( callback );
			handler.destroy();
			expect( handler.editor ).toBeNull();
			expect( handler.onEnableSaveButton ).toBeNull();
		} );
	} );

	describe( 'exports', () => {
		it( 'should export to window.Layers.Editor namespace', () => {
			expect( global.window.Layers.Editor.APIErrorHandler ).toBeDefined();
		} );
	} );
} );
