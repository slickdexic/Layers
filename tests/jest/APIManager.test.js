/**
 * Jest tests for APIManager.js
 * Tests API communication, error handling, and data normalization
 */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

describe( 'APIManager', function () {
	let APIManager;
	let apiManager;
	let mockEditor;

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
						return true;
					}
				};
			} ),
			msg: jest.fn( function ( key ) {
				return key;
			} ),
			notify: jest.fn(),
			log: {
				warn: jest.fn(),
				error: jest.fn()
			},
			Api: jest.fn( function () {
				return {
					get: jest.fn( function () {
						return Promise.resolve( {} );
					} ),
					post: jest.fn( function () {
						return Promise.resolve( {} );
					} ),
					postWithToken: jest.fn( function () {
						return Promise.resolve( {} );
					} )
				};
			} )
		};

		// Load APIManager code
		const apiManagerCode = fs.readFileSync(
			path.join( __dirname, '../../resources/ext.layers.editor/APIManager.js' ),
			'utf8'
		);
		// eslint-disable-next-line no-eval
		eval( apiManagerCode );

		APIManager = window.APIManager;
	} );

	beforeEach( function () {
		// Create mock editor with all necessary methods
		mockEditor = {
			filename: 'Test_Image.jpg',
			canvasManager: {
				renderLayers: jest.fn()
			},
			layerPanel: {
				updateLayers: jest.fn()
			},
			uiManager: {
				showSpinner: jest.fn(),
				hideSpinner: jest.fn()
			},
			stateManager: {
				get: jest.fn( function ( key ) {
					if ( key === 'layers' ) {
						return [];
					}
					if ( key === 'currentSetName' ) {
						return 'default';
					}
					return null;
				} ),
				set: jest.fn(),
				subscribe: jest.fn( function () {
					return jest.fn();
				} )
			},
			errorLog: jest.fn(),
			buildSetSelector: jest.fn(),
			buildRevisionSelector: jest.fn()
		};

		apiManager = new APIManager( mockEditor );
	} );

	afterEach( function () {
		jest.clearAllMocks();
	} );

	describe( 'constructor', function () {
		it( 'should create APIManager with editor reference', function () {
			expect( apiManager.editor ).toBe( mockEditor );
		} );

		it( 'should initialize mw.Api instance', function () {
			expect( apiManager.api ).toBeDefined();
		} );

		it( 'should set maxRetries to 3', function () {
			expect( apiManager.maxRetries ).toBe( 3 );
		} );

		it( 'should set retryDelay to 1000', function () {
			expect( apiManager.retryDelay ).toBe( 1000 );
		} );

		it( 'should initialize errorConfig object', function () {
			expect( apiManager.errorConfig ).toBeDefined();
			expect( apiManager.errorConfig.errorMap ).toBeDefined();
			expect( apiManager.errorConfig.defaults ).toBeDefined();
		} );
	} );

	describe( 'normalizeError', function () {
		it( 'should normalize string error', function () {
			const result = apiManager.normalizeError( 'Simple error message' );

			expect( result.code ).toBe( 'string-error' );
			expect( result.message ).toBe( 'Simple error message' );
		} );

		it( 'should normalize MediaWiki API error format', function () {
			const apiError = {
				error: {
					code: 'badtoken',
					info: 'Invalid CSRF token'
				}
			};

			const result = apiManager.normalizeError( apiError );

			expect( result.code ).toBe( 'badtoken' );
			expect( result.message ).toBe( 'Invalid CSRF token' );
		} );

		it( 'should normalize JavaScript Error object', function () {
			const jsError = new TypeError( 'Cannot read property' );

			const result = apiManager.normalizeError( jsError );

			expect( result.code ).toBe( 'TypeError' );
			expect( result.message ).toBe( 'Cannot read property' );
		} );

		it( 'should handle unknown error format', function () {
			const unknownError = { someProperty: 'value' };

			const result = apiManager.normalizeError( unknownError );

			expect( result.code ).toBe( 'object-error' );
		} );

		it( 'should handle null error', function () {
			const result = apiManager.normalizeError( null );

			expect( result.code ).toBe( 'unknown' );
			expect( result.message ).toBe( 'An unknown error occurred' );
		} );

		it( 'should handle undefined error', function () {
			const result = apiManager.normalizeError( undefined );

			expect( result.code ).toBe( 'unknown' );
		} );
	} );

	describe( 'getUserMessage', function () {
		it( 'should return message for known error code', function () {
			const normalizedError = { code: 'invalidfilename', message: 'Bad filename' };

			const result = apiManager.getUserMessage( normalizedError, 'save' );

			expect( result ).toBeTruthy();
		} );

		it( 'should return default message for unknown error code', function () {
			const normalizedError = { code: 'unknown-code', message: 'Unknown' };

			const result = apiManager.getUserMessage( normalizedError, 'save' );

			expect( result ).toBeTruthy();
		} );

		it( 'should return operation-specific fallback', function () {
			const normalizedError = { code: 'unknown', message: 'Unknown' };

			const loadResult = apiManager.getUserMessage( normalizedError, 'load' );
			const saveResult = apiManager.getUserMessage( normalizedError, 'save' );

			expect( loadResult ).toBeTruthy();
			expect( saveResult ).toBeTruthy();
		} );
	} );

	describe( 'sanitizeLogMessage', function () {
		it( 'should return sanitized message for non-string input', function () {
			const result = apiManager.sanitizeLogMessage( 12345 );

			expect( result ).toBe( 'Non-string error message' );
		} );

		it( 'should return sanitized message for object input', function () {
			const result = apiManager.sanitizeLogMessage( { key: 'value' } );

			expect( result ).toBe( 'Non-string error message' );
		} );

		it( 'should remove long token patterns', function () {
			const message = 'Error with token abcdefghijklmnopqrstuvwxyz123';

			const result = apiManager.sanitizeLogMessage( message );

			expect( result ).toContain( '[TOKEN]' );
			expect( result ).not.toContain( 'abcdefghijklmnopqrstuvwxyz123' );
		} );

		it( 'should remove URL patterns', function () {
			const message = 'Failed to load from https://example.com/api/test';

			const result = apiManager.sanitizeLogMessage( message );

			// URL should be sanitized (may become [URL] or [PATH] depending on regex order)
			expect( result ).not.toContain( 'example.com' );
		} );

		it( 'should preserve simple messages without sensitive data', function () {
			const message = 'Layer validation failed';

			const result = apiManager.sanitizeLogMessage( message );

			expect( result ).toBe( 'Layer validation failed' );
		} );
	} );

	describe( 'getMessage', function () {
		it( 'should return message from mw.message', function () {
			const result = apiManager.getMessage( 'layers-saving', 'fallback' );

			expect( result ).toBeTruthy();
		} );

		it( 'should use fallback when mw.message unavailable', function () {
			const originalMessage = mw.message;
			mw.message = null;

			const result = apiManager.getMessage( 'layers-saving', 'My Fallback' );

			mw.message = originalMessage;
			expect( result ).toBeTruthy();
		} );
	} );

	describe( 'isRetryableError', function () {
		it( 'should return true for null error', function () {
			const result = apiManager.isRetryableError( null );

			expect( result ).toBe( true );
		} );

		it( 'should return true for undefined error', function () {
			const result = apiManager.isRetryableError( undefined );

			expect( result ).toBe( true );
		} );

		it( 'should return true for error without error property', function () {
			const result = apiManager.isRetryableError( { code: 'some-code' } );

			expect( result ).toBe( true );
		} );

		it( 'should return true for internal_api_error', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'internal_api_error' }
			} );

			expect( result ).toBe( true );
		} );

		it( 'should return true for apierror-timeout', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'apierror-timeout' }
			} );

			expect( result ).toBe( true );
		} );

		it( 'should return true for ratelimited', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'ratelimited' }
			} );

			expect( result ).toBe( true );
		} );

		it( 'should return false for non-retryable error', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'badtoken' }
			} );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'handleError', function () {
		it( 'should return standardized error object', function () {
			const result = apiManager.handleError( 'Test error', 'save' );

			expect( result ).toHaveProperty( 'code' );
			expect( result ).toHaveProperty( 'message' );
			expect( result ).toHaveProperty( 'operation', 'save' );
			expect( result ).toHaveProperty( 'timestamp' );
		} );

		it( 'should call mw.notify for error display', function () {
			apiManager.handleError( 'Test error', 'save' );

			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should log error to editor', function () {
			apiManager.handleError( 'Test error', 'load' );

			// Error logging happens in logError method
			expect( mockEditor.errorLog ).toHaveBeenCalled();
		} );
	} );

	describe( 'validateBeforeSave', function () {
		it( 'should return true when no validator available', function () {
			delete window.LayersValidator;

			const result = apiManager.validateBeforeSave();

			expect( result ).toBe( true );
		} );

		it( 'should return true for valid layers', function () {
			window.LayersValidator = function () {
				return {
					validateLayers: jest.fn( function () {
						return { isValid: true, errors: [], warnings: [] };
					} ),
					showValidationErrors: jest.fn()
				};
			};

			const result = apiManager.validateBeforeSave();

			expect( result ).toBe( true );
		} );

		it( 'should return false for invalid layers', function () {
			window.LayersValidator = function () {
				return {
					validateLayers: jest.fn( function () {
						return { isValid: false, errors: [ 'Error 1' ], warnings: [] };
					} ),
					showValidationErrors: jest.fn()
				};
			};

			const result = apiManager.validateBeforeSave();

			expect( result ).toBe( false );
		} );
	} );

	describe( 'errorConfig structure', function () {
		it( 'should have errorMap with known error codes', function () {
			const errorMap = apiManager.errorConfig.errorMap;

			expect( errorMap ).toHaveProperty( 'invalidfilename' );
			expect( errorMap ).toHaveProperty( 'datatoolarge' );
			expect( errorMap ).toHaveProperty( 'invalidjson' );
			expect( errorMap ).toHaveProperty( 'invaliddata' );
			expect( errorMap ).toHaveProperty( 'ratelimited' );
		} );

		it( 'should have defaults for load, save, generic', function () {
			const defaults = apiManager.errorConfig.defaults;

			expect( defaults ).toHaveProperty( 'load' );
			expect( defaults ).toHaveProperty( 'save' );
			expect( defaults ).toHaveProperty( 'generic' );
		} );
	} );

	describe( 'APIManager module exports', function () {
		it( 'should expose APIManager on window', function () {
			expect( window.APIManager ).toBeDefined();
		} );

		it( 'should be a constructor function', function () {
			expect( typeof window.APIManager ).toBe( 'function' );
		} );

		it( 'should create instance with new', function () {
			const instance = new APIManager( mockEditor );

			expect( instance ).toBeInstanceOf( APIManager );
		} );
	} );
} );
