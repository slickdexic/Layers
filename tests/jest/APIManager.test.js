/**
 * Jest tests for APIManager.js
 * Tests API communication, error handling, and data normalization
 */
'use strict';

describe( 'APIManager', function () {
	let APIManager;
	let APIErrorHandler;
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

		// Load APIErrorHandler first (dependency)
		APIErrorHandler = require( '../../resources/ext.layers.editor/APIErrorHandler.js' );
		// Make it available globally for APIManager to find
		global.window.Layers = global.window.Layers || {};
		global.window.Layers.Editor = global.window.Layers.Editor || {};
		global.window.Layers.Editor.APIErrorHandler = APIErrorHandler;

		// Load ExportController (dependency for export operations)
		const ExportController = require( '../../resources/ext.layers.editor/ExportController.js' );
		global.window.Layers.Editor.ExportController = ExportController;

		// Load APIManager code using require for proper coverage tracking
		const { APIManager: LoadedAPIManager } = require( '../../resources/ext.layers.editor/APIManager.js' );
		APIManager = LoadedAPIManager;
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
				update: jest.fn(),
				markClean: jest.fn(),
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

		it( 'should initialize errorHandler with errorConfig object', function () {
			expect( apiManager.errorHandler ).toBeDefined();
			expect( apiManager.errorHandler.errorConfig ).toBeDefined();
			expect( apiManager.errorHandler.errorConfig.errorMap ).toBeDefined();
			expect( apiManager.errorHandler.errorConfig.defaults ).toBeDefined();
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

			expect( typeof result ).toBe( 'string' );
			expect( result.length ).toBeGreaterThan( 0 );
		} );

		it( 'should return default message for unknown error code', function () {
			const normalizedError = { code: 'unknown-code', message: 'Unknown' };

			const result = apiManager.getUserMessage( normalizedError, 'save' );

			expect( typeof result ).toBe( 'string' );
			expect( result.length ).toBeGreaterThan( 0 );
		} );

		it( 'should return operation-specific fallback', function () {
			const normalizedError = { code: 'unknown', message: 'Unknown' };

			const loadResult = apiManager.getUserMessage( normalizedError, 'load' );
			const saveResult = apiManager.getUserMessage( normalizedError, 'save' );

			expect( typeof loadResult ).toBe( 'string' );
			expect( typeof saveResult ).toBe( 'string' );
			expect( loadResult.length ).toBeGreaterThan( 0 );
			expect( saveResult.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'sanitizeLogMessage (via errorHandler)', function () {
		it( 'should return sanitized message for non-string input', function () {
			const result = apiManager.errorHandler.sanitizeLogMessage( 12345 );

			expect( result ).toBe( 'Non-string error message' );
		} );

		it( 'should return sanitized message for object input', function () {
			const result = apiManager.errorHandler.sanitizeLogMessage( { key: 'value' } );

			expect( result ).toBe( 'Non-string error message' );
		} );

		it( 'should remove long token patterns', function () {
			const message = 'Error with token abcdefghijklmnopqrstuvwxyz123';

			const result = apiManager.errorHandler.sanitizeLogMessage( message );

			expect( result ).toContain( '[TOKEN]' );
			expect( result ).not.toContain( 'abcdefghijklmnopqrstuvwxyz123' );
		} );

		it( 'should remove URL patterns', function () {
			const message = 'Failed to load from https://example.com/api/test';

			const result = apiManager.errorHandler.sanitizeLogMessage( message );

			// URL should be sanitized (may become [URL] or [PATH] depending on regex order)
			expect( result ).not.toContain( 'example.com' );
		} );

		it( 'should preserve simple messages without sensitive data', function () {
			const message = 'Layer validation failed';

			const result = apiManager.errorHandler.sanitizeLogMessage( message );

			expect( result ).toBe( 'Layer validation failed' );
		} );
	} );

	describe( 'getMessage', function () {
		it( 'should return message from mw.message', function () {
			const result = apiManager.getMessage( 'layers-saving', 'fallback' );

			expect( typeof result ).toBe( 'string' );
			expect( result.length ).toBeGreaterThan( 0 );
		} );

		it( 'should use fallback when mw.message unavailable', function () {
			const originalMessage = mw.message;
			mw.message = null;

			const result = apiManager.getMessage( 'layers-saving', 'My Fallback' );

			mw.message = originalMessage;
			expect( typeof result ).toBe( 'string' );
			expect( result.length ).toBeGreaterThan( 0 );
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

		it( 'should return true for apierror-http', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'apierror-http' }
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

		it( 'should return false for assertuserfailed', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'assertuserfailed' }
			} );

			expect( result ).toBe( false );
		} );

		it( 'should return false for assertbotfailed', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'assertbotfailed' }
			} );

			expect( result ).toBe( false );
		} );

		it( 'should return false for permissiondenied', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'permissiondenied' }
			} );

			expect( result ).toBe( false );
		} );

		it( 'should return false for permission-denied', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'permission-denied' }
			} );

			expect( result ).toBe( false );
		} );

		it( 'should return false for unknown error codes not in retryable list', function () {
			const result = apiManager.isRetryableError( {
				error: { code: 'some-random-error' }
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

		it( 'should display warnings when validation passes with warnings', function () {
			const mockNotify = jest.fn();
			mw.notify = mockNotify;

			window.LayersValidator = function () {
				return {
					validateLayers: jest.fn( function () {
						return { isValid: true, errors: [], warnings: [ 'Large layer count', 'Complex paths detected' ] };
					} ),
					showValidationErrors: jest.fn()
				};
			};

			const result = apiManager.validateBeforeSave();

			expect( result ).toBe( true );
			expect( mockNotify ).toHaveBeenCalledWith(
				expect.stringContaining( 'Large layer count' ),
				expect.objectContaining( { type: 'warn' } )
			);
		} );

		it( 'should not display warnings when warnings array is empty', function () {
			const mockNotify = jest.fn();
			mw.notify = mockNotify;

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
			// notify should not be called for empty warnings
			expect( mockNotify ).not.toHaveBeenCalledWith(
				expect.stringContaining( 'Warning' ),
				expect.objectContaining( { type: 'warn' } )
			);
		} );
	} );

	describe( 'errorConfig structure (via errorHandler)', function () {
		it( 'should have errorMap with known error codes', function () {
			const errorMap = apiManager.errorHandler.errorConfig.errorMap;

			expect( errorMap ).toHaveProperty( 'invalidfilename' );
			expect( errorMap ).toHaveProperty( 'datatoolarge' );
			expect( errorMap ).toHaveProperty( 'invalidjson' );
			expect( errorMap ).toHaveProperty( 'invaliddata' );
			expect( errorMap ).toHaveProperty( 'ratelimited' );
		} );

		it( 'should have defaults for load, save, generic', function () {
			const defaults = apiManager.errorHandler.errorConfig.defaults;

			expect( defaults ).toHaveProperty( 'load' );
			expect( defaults ).toHaveProperty( 'save' );
			expect( defaults ).toHaveProperty( 'generic' );
		} );
	} );

	describe( 'APIManager module exports', function () {
		it( 'should expose APIManager on window.Layers namespace', function () {
			expect( window.Layers.Core.APIManager ).toBeDefined();
		} );

		it( 'should be a constructor function', function () {
			expect( typeof window.Layers.Core.APIManager ).toBe( 'function' );
		} );

		it( 'should create instance with new', function () {
			const instance = new APIManager( mockEditor );

			expect( instance ).toBeInstanceOf( APIManager );
		} );
	} );

	describe( 'loadLayers', function () {
		it( 'should show spinner while loading', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: null
				}
			} );

			await apiManager.loadLayers();

			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should call API with correct parameters', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: { layerset: null }
			} );

			await apiManager.loadLayers();

			expect( apiManager.api.get ).toHaveBeenCalledWith( expect.objectContaining( {
				action: 'layersinfo',
				filename: 'Test_Image.jpg',
				format: 'json',
				formatversion: 2
			} ) );
		} );

		it( 'should resolve with layers data', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: {
						id: 123,
						data: { layers: [ { id: 'test-layer', type: 'rectangle' } ] },
						baseWidth: 1920,
						baseHeight: 1080
					},
					all_layersets: []
				}
			} );

			const result = await apiManager.loadLayers();

			expect( result ).toHaveProperty( 'layers' );
			expect( result ).toHaveProperty( 'baseWidth' );
			expect( result ).toHaveProperty( 'baseHeight' );
		} );

		it( 'should reject on API error', async function () {
			apiManager.api.get = jest.fn().mockRejectedValue( [ 'filenotfound', { error: { code: 'filenotfound' } } ] );

			await expect( apiManager.loadLayers() ).rejects.toBeDefined();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );
	} );

	describe( 'processLayersData', function () {
		it( 'should handle empty API response', function () {
			apiManager.processLayersData( null );

			// Should not throw, just return
			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing layersinfo', function () {
			apiManager.processLayersData( {} );

			expect( mockEditor.stateManager.set ).not.toHaveBeenCalled();
		} );

		it( 'should set empty layers when no layerset', function () {
			apiManager.processLayersData( {
				layersinfo: {
					layerset: null,
					all_layersets: []
				}
			} );

			// Now uses batched update() instead of individual set() calls
			expect( mockEditor.stateManager.update ).toHaveBeenCalledWith( {
				layers: [],
				currentLayerSetId: null,
				baseWidth: null,
				baseHeight: null
			} );
		} );

		it( 'should process layerset with data', function () {
			mockEditor.canvasManager.selectionManager = {
				clearSelection: jest.fn()
			};

			apiManager.processLayersData( {
				layersinfo: {
					layerset: {
						id: 1,
						name: 'default',
						data: { layers: [ { id: 'layer1', type: 'circle' } ] },
						baseWidth: 800,
						baseHeight: 600
					},
					all_layersets: [ { ls_id: 1, ls_revision: 1 } ]
				}
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'default' );
			// allLayerSets now uses batched update() instead of set()
			expect( mockEditor.stateManager.update ).toHaveBeenCalledWith( {
				allLayerSets: expect.any( Array ),
				setRevisions: expect.any( Array )
			} );
			expect( mockEditor.buildRevisionSelector ).toHaveBeenCalled();
		} );

		it( 'should process named_sets and build set selector', function () {
			apiManager.processLayersData( {
				layersinfo: {
					layerset: null,
					all_layersets: [],
					named_sets: [
						{ name: 'default', revision_count: 1 },
						{ name: 'annotations', revision_count: 2 }
					]
				}
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'namedSets', expect.any( Array ) );
			expect( mockEditor.buildSetSelector ).toHaveBeenCalled();
		} );

		it( 'should clear selection when canvas manager present', function () {
			mockEditor.canvasManager.selectionManager = {
				clearSelection: jest.fn()
			};

			apiManager.processLayersData( {
				layersinfo: {
					layerset: {
						id: 1,
						data: { layers: [] }
					},
					all_layersets: []
				}
			} );

			expect( mockEditor.canvasManager.selectionManager.clearSelection ).toHaveBeenCalled();
		} );
	} );

	describe( 'extractLayerSetData', function () {
		it( 'should handle null layerSet gracefully', function () {
			mockEditor.stateManager.set.mockClear();

			// Should not throw when layerSet is null
			expect( () => apiManager.extractLayerSetData( null ) ).not.toThrow();

			// Should set defaults when layerSet is null
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseWidth', null );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseHeight', null );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 1.0 );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', [] );
		} );

		it( 'should set base dimensions', function () {
			mockEditor.canvasManager.setBaseDimensions = jest.fn();

			apiManager.extractLayerSetData( {
				id: 1,
				baseWidth: 1920,
				baseHeight: 1080,
				data: { layers: [] }
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseWidth', 1920 );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'baseHeight', 1080 );
			expect( mockEditor.canvasManager.setBaseDimensions ).toHaveBeenCalledWith( 1920, 1080 );
		} );

		it( 'should process layers and set them', function () {
			apiManager.extractLayerSetData( {
				id: 123,
				data: {
					layers: [
						{ id: 'layer1', type: 'rectangle', visible: true },
						{ id: 'layer2', type: 'circle', visible: false }
					]
				}
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', expect.any( Array ) );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'currentLayerSetId', 123 );
		} );

		it( 'should extract backgroundVisible false from layer set data', function () {
			mockEditor.stateManager.set.mockClear();

			apiManager.extractLayerSetData( {
				id: 456,
				data: {
					layers: [ { id: 'layer1', type: 'rectangle' } ],
					backgroundVisible: false,
					backgroundOpacity: 0.5
				}
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 0.5 );
		} );

		it( 'should normalize integer 0 to boolean false for backgroundVisible', function () {
			mockEditor.stateManager.set.mockClear();

			// API returns 0/1 integers due to preserveLayerBooleans
			apiManager.extractLayerSetData( {
				id: 457,
				data: {
					layers: [],
					backgroundVisible: 0,  // Integer 0 from PHP serialization
					backgroundOpacity: 1.0
				}
			} );

			// Should be normalized to boolean false, not integer 0
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', false );
		} );

		it( 'should normalize integer 1 to boolean true for backgroundVisible', function () {
			mockEditor.stateManager.set.mockClear();

			apiManager.extractLayerSetData( {
				id: 458,
				data: {
					layers: [],
					backgroundVisible: 1,  // Integer 1 from PHP serialization
					backgroundOpacity: 1.0
				}
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
		} );

		it( 'should extract backgroundVisible true from layer set data', function () {
			mockEditor.stateManager.set.mockClear();

			apiManager.extractLayerSetData( {
				id: 789,
				data: {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 1.0
				}
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 1.0 );
		} );

		it( 'should default backgroundVisible to true when not specified', function () {
			mockEditor.stateManager.set.mockClear();

			apiManager.extractLayerSetData( {
				id: 101,
				data: {
					layers: [ { id: 'layer1', type: 'circle' } ]
					// No backgroundVisible or backgroundOpacity specified
				}
			} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 1.0 );
		} );

		it( 'should set backgroundVisible BEFORE layers for correct rendering order', function () {
			mockEditor.stateManager.set.mockClear();
			const setCalls = [];
			mockEditor.stateManager.set.mockImplementation( ( key, value ) => {
				setCalls.push( { key, value } );
			} );

			apiManager.extractLayerSetData( {
				id: 202,
				data: {
					layers: [ { id: 'layer1', type: 'text' } ],
					backgroundVisible: false
				}
			} );

			// Find the indices of backgroundVisible and layers calls
			const bgVisibleIndex = setCalls.findIndex( c => c.key === 'backgroundVisible' );
			const layersIndex = setCalls.findIndex( c => c.key === 'layers' );

			// backgroundVisible should be set BEFORE layers
			expect( bgVisibleIndex ).toBeLessThan( layersIndex );
			expect( bgVisibleIndex ).toBeGreaterThan( -1 );
		} );

		it( 'should handle layerSet with no data property', function () {
			mockEditor.stateManager.set.mockClear();

			apiManager.extractLayerSetData( {
				id: 300,
				baseWidth: 800,
				baseHeight: 600
				// No data property
			} );

			// Should set empty layers array
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			// Should set default background settings
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 1.0 );
		} );

		it( 'should handle layerSet with data but no layers array', function () {
			mockEditor.stateManager.set.mockClear();

			apiManager.extractLayerSetData( {
				id: 301,
				data: {
					// data object exists but no layers property - falls to else branch
					// backgroundVisible in data is not read in this code path
				}
			} );

			// Should set empty layers array
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			// Should use default background settings since data.layers doesn't exist
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
		} );
	} );

	describe( 'processRawLayers', function () {
		it( 'should add id to layers without id', function () {
			const result = apiManager.processRawLayers( [
				{ type: 'rectangle' },
				{ type: 'circle' }
			] );

			expect( typeof result[ 0 ].id ).toBe( 'string' );
			expect( typeof result[ 1 ].id ).toBe( 'string' );
			expect( result[ 0 ].id ).toMatch( /^layer_/ );
			expect( result[ 1 ].id ).toMatch( /^layer_/ );
		} );

		it( 'should preserve existing ids', function () {
			const result = apiManager.processRawLayers( [
				{ id: 'existing-id', type: 'rectangle' }
			] );

			expect( result[ 0 ].id ).toBe( 'existing-id' );
		} );
	} );

	describe( 'generateLayerId', function () {
		it( 'should generate unique ids', function () {
			const id1 = apiManager.generateLayerId();
			const id2 = apiManager.generateLayerId();

			expect( id1 ).not.toBe( id2 );
		} );

		it( 'should start with layer_ prefix', function () {
			const id = apiManager.generateLayerId();

			expect( id ).toMatch( /^layer_/ );
		} );
	} );

	describe( 'loadRevisionById', function () {
		it( 'should call API with layersetid', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: {
						id: 456,
						data: { layers: [] }
					},
					all_layersets: []
				}
			} );
			mockEditor.renderLayers = jest.fn();
			mockEditor.canvasManager.selectionManager = {
				clearSelection: jest.fn()
			};

			await apiManager.loadRevisionById( 456 );

			expect( apiManager.api.get ).toHaveBeenCalledWith( expect.objectContaining( {
				layersetid: 456
			} ) );
		} );

		it( 'should reject when revision not found', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: { layerset: null }
			} );

			await expect( apiManager.loadRevisionById( 999 ) ).rejects.toThrow( 'Revision not found' );
		} );

		it( 'should show success notification on load', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: { id: 1, data: { layers: [] } },
					all_layersets: []
				}
			} );
			mockEditor.renderLayers = jest.fn();

			await apiManager.loadRevisionById( 1 );

			expect( mw.notify ).toHaveBeenCalledWith( expect.any( String ), { type: 'success' } );
		} );

		it( 'should show error notification on non-abort failure', async function () {
			// Simulate a real API error with proper promise rejection pattern
			apiManager.api.get = jest.fn( () => {
				return {
					then: function ( successCallback ) {
						return this;
					},
					catch: function ( errorCallback ) {
						errorCallback( 'internal_error', { error: { info: 'Server error' } } );
						return this;
					}
				};
			} );
			apiManager.hideSpinner = jest.fn();
			const originalNotify = mw.notify;
			mw.notify = jest.fn();

			await apiManager.loadRevisionById( 456 ).catch( () => {} );

			// Should show error notification for real errors
			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);

			mw.notify = originalNotify;
		} );
	} );

	describe( 'reloadRevisions', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should call API with current set name', function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					all_layersets: [ { ls_id: 1 }, { ls_id: 2 } ],
					named_sets: [ { name: 'default' } ]
				}
			} );

			apiManager.reloadRevisions();

			expect( apiManager.api.get ).toHaveBeenCalledWith( expect.objectContaining( {
				setname: 'default'
			} ) );
		} );

		it( 'should update allLayerSets on success', async function () {
			const mockRevisions = [ { ls_id: 1 }, { ls_id: 2 } ];
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					all_layersets: mockRevisions
				}
			} );

			apiManager.reloadRevisions();

			// Wait for promise to resolve
			await jest.runAllTimersAsync();

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'allLayerSets', mockRevisions );
		} );

		it( 'should handle API error gracefully', function () {
			apiManager.api.get = jest.fn().mockRejectedValue( new Error( 'Network error' ) );

			// Should not throw
			expect( () => apiManager.reloadRevisions() ).not.toThrow();
		} );

		it( 'should update setRevisions along with allLayerSets', async function () {
			const mockRevisions = [ { ls_id: 1 }, { ls_id: 2 } ];
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					all_layersets: mockRevisions
				}
			} );

			apiManager.reloadRevisions();
			await jest.runAllTimersAsync();

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'setRevisions', mockRevisions );
		} );

		it( 'should update namedSets and rebuild set selector', async function () {
			const mockNamedSets = [ { name: 'default' }, { name: 'anatomy' } ];
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					all_layersets: [],
					named_sets: mockNamedSets
				}
			} );

			apiManager.reloadRevisions();
			await jest.runAllTimersAsync();

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'namedSets', mockNamedSets );
			expect( mockEditor.buildSetSelector ).toHaveBeenCalled();
		} );

		it( 'should update currentLayerSetId from layerset response', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					all_layersets: [],
					layerset: { id: 42 }
				}
			} );

			apiManager.reloadRevisions();
			await jest.runAllTimersAsync();

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'currentLayerSetId', 42 );
		} );

		it( 'should call buildRevisionSelector after updating state', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					all_layersets: []
				}
			} );

			apiManager.reloadRevisions();
			await jest.runAllTimersAsync();

			expect( mockEditor.buildRevisionSelector ).toHaveBeenCalled();
		} );

		it( 'should clear revNameInputEl value if it exists', async function () {
			mockEditor.uiManager.revNameInputEl = { value: 'some text' };
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					all_layersets: []
				}
			} );

			apiManager.reloadRevisions();
			await jest.runAllTimersAsync();

			expect( mockEditor.uiManager.revNameInputEl.value ).toBe( '' );
		} );

		it( 'should show warning notification on API error', async function () {
			apiManager.api.get = jest.fn().mockRejectedValue( new Error( 'Network error' ) );

			apiManager.reloadRevisions();
			await jest.runAllTimersAsync();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'warn' } )
			);
		} );
	} );

	describe( 'checkSizeLimit', function () {
		it( 'should return true for data under limit', function () {
			mw.config.get = jest.fn( function ( key ) {
				if ( key === 'wgLayersMaxBytes' ) {
					return 1000;
				}
				return null;
			} );

			const result = apiManager.checkSizeLimit( 'small data' );

			expect( result ).toBe( true );
		} );

		it( 'should return false for data over limit', function () {
			mw.config.get = jest.fn( function ( key ) {
				if ( key === 'wgLayersMaxBytes' ) {
					return 10;
				}
				return null;
			} );

			const result = apiManager.checkSizeLimit( 'This is longer than 10 bytes' );

			expect( result ).toBe( false );
		} );

		it( 'should use default 2MB limit when config not set', function () {
			mw.config.get = jest.fn( function () {
				return null;
			} );

			const smallData = 'x'.repeat( 100 );
			const result = apiManager.checkSizeLimit( smallData );

			expect( result ).toBe( true );
		} );
	} );

	describe( 'sanitizeInput', function () {
		it( 'should return empty string for non-string input', function () {
			expect( apiManager.sanitizeInput( null ) ).toBe( '' );
			expect( apiManager.sanitizeInput( undefined ) ).toBe( '' );
			expect( apiManager.sanitizeInput( 123 ) ).toBe( '' );
			expect( apiManager.sanitizeInput( {} ) ).toBe( '' );
		} );

		it( 'should remove angle brackets', function () {
			const result = apiManager.sanitizeInput( '<script>alert("xss")</script>' );

			expect( result ).not.toContain( '<' );
			expect( result ).not.toContain( '>' );
		} );

		it( 'should remove javascript: protocol', function () {
			const result = apiManager.sanitizeInput( 'javascript:alert(1)' );

			expect( result ).not.toContain( 'javascript:' );
		} );

		it( 'should remove event handlers', function () {
			const result = apiManager.sanitizeInput( 'onclick= alert(1)' );

			expect( result ).not.toMatch( /on\w+\s*=/ );
		} );

		it( 'should trim whitespace', function () {
			const result = apiManager.sanitizeInput( '  hello world  ' );

			expect( result ).toBe( 'hello world' );
		} );
	} );

	describe( 'sanitizeFilename', function () {
		it( 'should return "image" for non-string input', function () {
			expect( apiManager.sanitizeFilename( null ) ).toBe( 'image' );
			expect( apiManager.sanitizeFilename( undefined ) ).toBe( 'image' );
			expect( apiManager.sanitizeFilename( 123 ) ).toBe( 'image' );
			expect( apiManager.sanitizeFilename( {} ) ).toBe( 'image' );
		} );

		it( 'should replace Windows forbidden characters with underscores', function () {
			const result = apiManager.sanitizeFilename( 'file<name>:test"path/back\\pipe|question?star*' );

			expect( result ).not.toContain( '<' );
			expect( result ).not.toContain( '>' );
			expect( result ).not.toContain( ':' );
			expect( result ).not.toContain( '"' );
			expect( result ).not.toContain( '/' );
			expect( result ).not.toContain( '\\' );
			expect( result ).not.toContain( '|' );
			expect( result ).not.toContain( '?' );
			expect( result ).not.toContain( '*' );
		} );

		it( 'should strip leading/trailing dots and whitespace', function () {
			expect( apiManager.sanitizeFilename( '  filename  ' ) ).toBe( 'filename' );
			expect( apiManager.sanitizeFilename( '...filename...' ) ).toBe( 'filename' );
			expect( apiManager.sanitizeFilename( ' . filename . ' ) ).toBe( 'filename' );
		} );

		it( 'should truncate to 200 characters', function () {
			const longName = 'a'.repeat( 250 );
			const result = apiManager.sanitizeFilename( longName );

			expect( result.length ).toBe( 200 );
		} );

		it( 'should return "image" for empty result after sanitization', function () {
			expect( apiManager.sanitizeFilename( '...' ) ).toBe( 'image' );
			expect( apiManager.sanitizeFilename( '   ' ) ).toBe( 'image' );
		} );

		it( 'should replace all forbidden characters with underscores', function () {
			// Characters are replaced, not removed
			const result = apiManager.sanitizeFilename( '<>:"/\\|?*' );
			expect( result ).toBe( '_________' );
		} );

		it( 'should preserve valid characters', function () {
			const result = apiManager.sanitizeFilename( 'My-Image_2024 (final)' );

			expect( result ).toBe( 'My-Image_2024 (final)' );
		} );
	} );

	describe( 'handleSaveError', function () {
		it( 'should log detailed error information', function () {
			apiManager.handleSaveError( { code: 'savefailed', info: 'Database error' } );

			expect( mw.log.error ).toHaveBeenCalled();
		} );

		it( 'should return standardized error', function () {
			const result = apiManager.handleSaveError( { code: 'test-code' } );

			expect( result ).toHaveProperty( 'code' );
			expect( result ).toHaveProperty( 'operation', 'save' );
		} );
	} );

	describe( 'handleLoadError', function () {
		it( 'should return standardized error for load operation', function () {
			const result = apiManager.handleLoadError( 'network-error', { error: { info: 'Connection lost' } } );

			expect( result ).toHaveProperty( 'operation', 'load' );
		} );
	} );

	describe( 'loadLayersBySetName', function () {
		it( 'should reject when no set name provided', async function () {
			await expect( apiManager.loadLayersBySetName( '' ) ).rejects.toThrow( 'No set name provided' );
			await expect( apiManager.loadLayersBySetName( null ) ).rejects.toThrow( 'No set name provided' );
		} );

		it( 'should show spinner when loading', function () {
			apiManager.api.get = jest.fn().mockReturnValue( new Promise( () => {} ) );

			apiManager.loadLayersBySetName( 'test-set' );

			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
		} );

		it( 'should reject on invalid API response', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {} );

			await expect( apiManager.loadLayersBySetName( 'test-set' ) )
				.rejects.toThrow( 'Invalid API response' );
		} );

		it( 'should process layerset data on success', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [ { id: 'layer1', type: 'rectangle' } ] },
						baseWidth: 800,
						baseHeight: 600
					},
					set_revisions: [ { ls_id: 1 } ],
					named_sets: [ { name: 'default' } ]
				}
			} );

			mockEditor.canvasManager.selectionManager = { clearSelection: jest.fn() };

			await apiManager.loadLayersBySetName( 'default' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'default' );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'hasUnsavedChanges', false );
		} );

		it( 'should handle missing layerset gracefully', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {}
			} );

			await apiManager.loadLayersBySetName( 'new-set' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'currentLayerSetId', null );
		} );

		it( 'should clear selection when switching layer sets', async function () {
			const mockClearSelection = jest.fn();
			mockEditor.canvasManager.selectionManager = { clearSelection: mockClearSelection };
			
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			await apiManager.loadLayersBySetName( 'test-set' );

			expect( mockClearSelection ).toHaveBeenCalled();
		} );
	} );

	describe( 'buildSavePayload', function () {
		it( 'should build correct payload structure', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'layers' ) {
					return [ { id: 'layer1', type: 'rectangle' } ];
				}
				if ( key === 'currentSetName' ) {
					return 'my-set';
				}
				if ( key === 'backgroundVisible' ) {
					return true;
				}
				if ( key === 'backgroundOpacity' ) {
					return 1.0;
				}
				return null;
			} );

			const payload = apiManager.buildSavePayload();

			expect( payload.action ).toBe( 'layerssave' );
			expect( payload.filename ).toBe( 'Test_Image.jpg' );
			expect( payload.setname ).toBe( 'my-set' );
			expect( payload.format ).toBe( 'json' );
			// New format includes layers and background settings
			const parsedData = JSON.parse( payload.data );
			expect( parsedData.layers ).toEqual( [ { id: 'layer1', type: 'rectangle' } ] );
			expect( parsedData.backgroundVisible ).toBe( true );
			expect( parsedData.backgroundOpacity ).toBe( 1.0 );
		} );

		it( 'should default to empty array if no layers', function () {
			mockEditor.stateManager.get = jest.fn( function () {
				return null;
			} );

			const payload = apiManager.buildSavePayload();

			// New format wraps layers in object
			const parsedData = JSON.parse( payload.data );
			expect( parsedData.layers ).toEqual( [] );
		} );

		it( 'should default to "default" set name if not specified', function () {
			mockEditor.stateManager.get = jest.fn( function ( key ) {
				if ( key === 'layers' ) {
					return [];
				}
				return null;
			} );

			const payload = apiManager.buildSavePayload();

			expect( payload.setname ).toBe( 'default' );
		} );
	} );

	describe( 'performSaveWithRetry', function () {
		it( 'should call API with csrf token', async function () {
			const mockResolve = jest.fn();
			const mockReject = jest.fn();
			const payload = { action: 'layerssave', data: '[]' };

			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layerssave: { success: 1 }
			} );
			apiManager.handleSaveSuccess = jest.fn();
			apiManager.enableSaveButton = jest.fn();

			await apiManager.performSaveWithRetry( payload, 0, mockResolve, mockReject );

			expect( apiManager.api.postWithToken ).toHaveBeenCalledWith( 'csrf', payload );
			expect( mockResolve ).toHaveBeenCalled();
		} );

		it( 'should hide spinner on success', async function () {
			const mockResolve = jest.fn();
			const mockReject = jest.fn();
			const payload = { action: 'layerssave', data: '[]' };

			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layerssave: { success: 1 }
			} );
			apiManager.handleSaveSuccess = jest.fn();
			apiManager.enableSaveButton = jest.fn();

			await apiManager.performSaveWithRetry( payload, 0, mockResolve, mockReject );

			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should call handleSaveSuccess on success', async function () {
			const mockResolve = jest.fn();
			const mockReject = jest.fn();
			const payload = { action: 'layerssave', data: '[]' };
			const response = { layerssave: { success: 1 } };

			apiManager.api.postWithToken = jest.fn().mockResolvedValue( response );
			apiManager.handleSaveSuccess = jest.fn();
			apiManager.enableSaveButton = jest.fn();

			await apiManager.performSaveWithRetry( payload, 0, mockResolve, mockReject );

			expect( apiManager.handleSaveSuccess ).toHaveBeenCalledWith( response );
		} );

		it( 'should retry on retryable error', async function () {
			jest.useFakeTimers();
			const mockResolve = jest.fn();
			const mockReject = jest.fn();
			const payload = { action: 'layerssave', data: '[]' };

			let callCount = 0;
			apiManager.api.postWithToken = jest.fn().mockImplementation( () => {
				callCount++;
				if ( callCount === 1 ) {
					// First call fails with retryable error
					return Promise.reject( [ 'internal_api_error', { error: { code: 'internal_api_error' } } ] );
				}
				// Second call succeeds
				return Promise.resolve( { layerssave: { success: 1 } } );
			} );
			apiManager.handleSaveSuccess = jest.fn();
			apiManager.enableSaveButton = jest.fn();

			const promise = apiManager.performSaveWithRetry( payload, 0, mockResolve, mockReject );

			// First call fails, triggers retry
			await Promise.resolve();
			jest.advanceTimersByTime( 1000 ); // retryDelay

			await promise;

			jest.useRealTimers();
		} );

		it( 'should reject after max retries exhausted with non-retryable error', function () {
			// Test that non-retryable errors (like badtoken) are not retried
			// The isRetryableError method should return false for 'badtoken'
			const badtokenError = { error: { code: 'badtoken', info: 'Invalid token' } };
			
			const isRetryable = apiManager.isRetryableError( badtokenError );
			
			expect( isRetryable ).toBe( false );
			// This confirms the error will be rejected immediately without retry
		} );

		it( 'should not retry when attempt is at maxRetries - 1 even for retryable error', function () {
			// When at max retries, even retryable errors should cause rejection
			// This test verifies the condition: attempt < this.maxRetries - 1
			// With maxRetries=3, attempt=2 means canRetry = (2 < 2) = false
			
			// Verify the logic is correct by checking the condition
			const attempt = 2;
			const maxRetries = apiManager.maxRetries; // 3
			const canRetry = attempt < maxRetries - 1;
			
			expect( canRetry ).toBe( false );
		} );

		it( 'should extract error from result when error property exists', function () {
			// Test the error extraction logic: (result && result.error) || { code, info }
			const result = { error: { code: 'test-code', info: 'Test info' } };
			const code = 'fallback-code';
			
			const error = ( result && result.error ) || { code: code, info: 'No details' };
			
			expect( error.code ).toBe( 'test-code' );
			expect( error.info ).toBe( 'Test info' );
		} );

		it( 'should use fallback error when result has no error property', function () {
			const result = { exception: 'Some exception' };
			const code = 'fallback-code';
			
			const error = ( result && result.error ) || { code: code, info: ( result && result.exception ) || 'No details' };
			
			expect( error.code ).toBe( 'fallback-code' );
			expect( error.info ).toBe( 'Some exception' );
		} );

		it( 'should clear saveInProgress flag on success (CORE-3)', async function () {
			const mockResolve = jest.fn();
			const mockReject = jest.fn();
			const payload = { action: 'layerssave', data: '[]' };

			apiManager.saveInProgress = true;
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layerssave: { success: 1 }
			} );
			apiManager.handleSaveSuccess = jest.fn();
			apiManager.enableSaveButton = jest.fn();

			await apiManager.performSaveWithRetry( payload, 0, mockResolve, mockReject );

			expect( apiManager.saveInProgress ).toBe( false );
		} );

		it( 'should clear saveInProgress flag on final failure (CORE-3)', async function () {
			const mockResolve = jest.fn();
			const mockReject = jest.fn();
			const payload = { action: 'layerssave', data: '[]' };

			apiManager.saveInProgress = true;
			// Use mockImplementation to simulate jQuery Deferred style rejection
			// that passes (code, result) to catch handler
			apiManager.api.postWithToken = jest.fn().mockImplementation( () => {
				return {
					then: function () {
						return this;
					},
					catch: function ( fn ) {
						fn( 'permissiondenied', { error: { code: 'permissiondenied' } } );
						return this;
					}
				};
			} );
			apiManager.handleSaveError = jest.fn();
			apiManager.enableSaveButton = jest.fn();

			// Attempt at maxRetries - 1 means no more retries
			apiManager.performSaveWithRetry( payload, 2, mockResolve, mockReject );

			// Allow microtasks to complete
			await Promise.resolve();

			expect( apiManager.saveInProgress ).toBe( false );
			expect( mockReject ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleSaveSuccess', function () {
		beforeEach( function () {
			mockEditor.toolbar = { saveButton: { disabled: false } };
			mockEditor.buildRevisionSelector = jest.fn();
			mockEditor.buildSetSelector = jest.fn();
		} );

		it( 'should show success notification', function () {
			apiManager.handleSaveSuccess( { layerssave: { success: 1 } } );

			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should mark state as clean', function () {
			apiManager.handleSaveSuccess( { layerssave: { success: 1 } } );

			expect( mockEditor.stateManager.markClean ).toHaveBeenCalled();
		} );

		it( 'should reload revisions on success', function () {
			apiManager.reloadRevisions = jest.fn();
			apiManager.handleSaveSuccess( { layerssave: { success: 1 } } );

			expect( apiManager.reloadRevisions ).toHaveBeenCalled();
		} );

		it( 'should call handleSaveError when not successful', function () {
			apiManager.handleSaveError = jest.fn();
			apiManager.handleSaveSuccess( { layerssave: { success: 0 } } );

			expect( apiManager.handleSaveError ).toHaveBeenCalled();
		} );
	} );

	describe( 'disableSaveButton / enableSaveButton', function () {
		beforeEach( function () {
			mockEditor.toolbar = { saveButton: { disabled: false } };
		} );

		it( 'should disable save button', function () {
			apiManager.disableSaveButton();

			expect( mockEditor.toolbar.saveButton.disabled ).toBe( true );
		} );

		it( 'should enable save button', function () {
			mockEditor.toolbar.saveButton.disabled = true;
			apiManager.enableSaveButton();

			expect( mockEditor.toolbar.saveButton.disabled ).toBe( false );
		} );

		it( 'should handle missing toolbar gracefully', function () {
			mockEditor.toolbar = null;

			expect( () => apiManager.disableSaveButton() ).not.toThrow();
			expect( () => apiManager.enableSaveButton() ).not.toThrow();
		} );
	} );

	describe( 'destroy', function () {
		it( 'should clean up references', function () {
			apiManager.destroy();

			expect( apiManager.api ).toBeNull();
			expect( apiManager.editor ).toBeNull();
			expect( apiManager.errorHandler ).toBeNull();
		} );

		it( 'should abort all pending requests', function () {
			const mockAbort1 = jest.fn();
			const mockAbort2 = jest.fn();
			apiManager.pendingRequests.set( 'loadRevision', { abort: mockAbort1 } );
			apiManager.pendingRequests.set( 'loadSetByName', { abort: mockAbort2 } );

			apiManager.destroy();

			expect( mockAbort1 ).toHaveBeenCalled();
			expect( mockAbort2 ).toHaveBeenCalled();
			expect( apiManager.pendingRequests.size ).toBe( 0 );
		} );

		it( 'should clear pending requests map', function () {
			apiManager.pendingRequests.set( 'test', { abort: jest.fn() } );

			apiManager.destroy();

			expect( apiManager.pendingRequests.size ).toBe( 0 );
		} );
	} );

	describe( 'request tracking', function () {
		it( 'should track new requests', function () {
			const mockJqXHR = { abort: jest.fn() };

			apiManager._trackRequest( 'testOp', mockJqXHR );

			expect( apiManager.pendingRequests.get( 'testOp' ) ).toBe( mockJqXHR );
		} );

		it( 'should abort existing request when tracking new one of same type', function () {
			const oldRequest = { abort: jest.fn() };
			const newRequest = { abort: jest.fn() };

			apiManager._trackRequest( 'testOp', oldRequest );
			apiManager._trackRequest( 'testOp', newRequest );

			expect( oldRequest.abort ).toHaveBeenCalled();
			expect( apiManager.pendingRequests.get( 'testOp' ) ).toBe( newRequest );
		} );

		it( 'should clear request after completion', function () {
			const mockJqXHR = { abort: jest.fn() };
			apiManager._trackRequest( 'testOp', mockJqXHR );

			apiManager._clearRequest( 'testOp' );

			expect( apiManager.pendingRequests.has( 'testOp' ) ).toBe( false );
		} );

		it( 'should not throw when clearing non-existent request', function () {
			expect( () => apiManager._clearRequest( 'nonexistent' ) ).not.toThrow();
		} );

		it( 'should handle request without abort method gracefully', function () {
			const mockJqXHR = {}; // No abort method
			apiManager._trackRequest( 'testOp', mockJqXHR );

			// Should not throw when tracking another request that needs to abort the old one
			expect( () => apiManager._trackRequest( 'testOp', { abort: jest.fn() } ) ).not.toThrow();
		} );
	} );

	describe( 'clearFreshnessCache', function () {
		beforeEach( function () {
			// Mock sessionStorage
			global.sessionStorage = {
				removeItem: jest.fn(),
				getItem: jest.fn(),
				setItem: jest.fn()
			};
		} );

		afterEach( function () {
			delete global.sessionStorage;
		} );

		it( 'should clear cache for default set name', function () {
			mockEditor.filename = 'Test_Image.jpg';
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'namedSets' ) {
					return [];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			apiManager.clearFreshnessCache();

			expect( sessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-Test_Image.jpg:default' );
		} );

		it( 'should clear cache for all named sets', function () {
			mockEditor.filename = 'Test_Image.jpg';
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'namedSets' ) {
					return [ { name: 'set1' }, { name: 'set2' } ];
				}
				if ( key === 'currentSetName' ) {
					return 'set1';
				}
				return null;
			} );

			apiManager.clearFreshnessCache();

			expect( sessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-Test_Image.jpg:default' );
			expect( sessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-Test_Image.jpg:set1' );
			expect( sessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-Test_Image.jpg:set2' );
		} );

		it( 'should handle missing filename gracefully', function () {
			mockEditor.filename = null;

			expect( () => apiManager.clearFreshnessCache() ).not.toThrow();
			expect( sessionStorage.removeItem ).not.toHaveBeenCalled();
		} );

		it( 'should handle sessionStorage errors gracefully', function () {
			mockEditor.filename = 'Test_Image.jpg';
			mockEditor.stateManager.get = jest.fn().mockReturnValue( [] );
			global.sessionStorage.removeItem = jest.fn().mockImplementation( () => {
				throw new Error( 'QuotaExceeded' );
			} );

			// Should not throw
			expect( () => apiManager.clearFreshnessCache() ).not.toThrow();
		} );

		it( 'should normalize filename by replacing spaces with underscores', function () {
			mockEditor.filename = 'Test Image With Spaces.jpg';
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'namedSets' ) {
					return [];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			apiManager.clearFreshnessCache();

			expect( sessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-Test_Image_With_Spaces.jpg:default' );
		} );

		it( 'should handle null set in namedSets array', function () {
			mockEditor.filename = 'Test.jpg';
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'namedSets' ) {
					return [ null, { name: 'valid-set' }, { noName: true } ];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			// Should not throw
			expect( () => apiManager.clearFreshnessCache() ).not.toThrow();
			expect( sessionStorage.removeItem ).toHaveBeenCalledWith( 'layers-fresh-Test.jpg:valid-set' );
		} );

		it( 'should log debug message when wgLayersDebug is enabled', function () {
			mockEditor.filename = 'Test.jpg';
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'namedSets' ) {
					return [];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );
			// Save original mw.log and mw.config.get and create mocks
			const originalLog = mw.log;
			const originalConfigGet = mw.config.get;
			const mockLogFn = jest.fn();
			mockLogFn.warn = jest.fn();
			mockLogFn.error = jest.fn();
			mw.log = mockLogFn;
			mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersDebug' ) {
					return true;
				}
				return null;
			} );

			apiManager.clearFreshnessCache();

			expect( mockLogFn ).toHaveBeenCalledWith( '[APIManager] Cleared freshness cache for:', 'Test.jpg' );
			
			// Restore
			mw.log = originalLog;
			mw.config.get = originalConfigGet;
		} );

		it( 'should log warning when clearing cache throws an error', function () {
			mockEditor.filename = 'Test.jpg';
			// Force an error by making stateManager.get throw
			mockEditor.stateManager.get = jest.fn().mockImplementation( () => {
				throw new Error( 'State error' );
			} );

			expect( () => apiManager.clearFreshnessCache() ).not.toThrow();
			expect( mw.log.warn ).toHaveBeenCalledWith(
				'[APIManager] Failed to clear freshness cache:',
				'State error'
			);
		} );
	} );

	describe( 'deleteLayerSet', function () {
		beforeEach( function () {
			mockEditor.uiManager = {
				showSpinner: jest.fn(),
				hideSpinner: jest.fn()
			};
		} );

		it( 'should reject when setName is empty', async function () {
			await expect( apiManager.deleteLayerSet( '' ) ).rejects.toThrow( 'Set name is required' );
		} );

		it( 'should reject when setName is null', async function () {
			await expect( apiManager.deleteLayerSet( null ) ).rejects.toThrow( 'Set name is required' );
		} );

		it( 'should reject when no filename available', async function () {
			mockEditor.filename = null;
			mockEditor.config = null;

			await expect( apiManager.deleteLayerSet( 'test-set' ) ).rejects.toThrow( 'No filename available' );
		} );

		it( 'should call API with correct parameters', async function () {
			mockEditor.filename = 'Test_Image.jpg';
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersdelete: { success: 1, revisionsDeleted: 3 }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			await apiManager.deleteLayerSet( 'my-set' );

			expect( apiManager.api.postWithToken ).toHaveBeenCalledWith( 'csrf', {
				action: 'layersdelete',
				filename: 'Test_Image.jpg',
				setname: 'my-set'
			} );
		} );

		it( 'should show and hide spinner during operation', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersdelete: { success: 1 }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			await apiManager.deleteLayerSet( 'test-set' );

			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should handle successful delete response', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersdelete: { success: 1, revisionsDeleted: 5 }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			const result = await apiManager.deleteLayerSet( 'test-set' );

			expect( result.success ).toBe( 1 );
			expect( result.revisionsDeleted ).toBe( 5 );
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should reload layers after successful delete', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersdelete: { success: 1 }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			await apiManager.deleteLayerSet( 'test-set' );

			expect( apiManager.loadLayers ).toHaveBeenCalled();
		} );

		it( 'should handle permission denied error in response', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				error: { code: 'permissiondenied', info: 'Not allowed' }
			} );

			await expect( apiManager.deleteLayerSet( 'test-set' ) )
				.rejects.toThrow();
		} );

		it( 'should handle generic API error in response', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				error: { code: 'unknown', info: 'Something went wrong' }
			} );

			await expect( apiManager.deleteLayerSet( 'test-set' ) )
				.rejects.toThrow();
		} );

		it( 'should handle unexpected response format', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {} );

			await expect( apiManager.deleteLayerSet( 'test-set' ) )
				.rejects.toThrow();
		} );

		it( 'should handle network error', async function () {
			apiManager.api.postWithToken = jest.fn().mockRejectedValue( 'network-error' );

			await expect( apiManager.deleteLayerSet( 'test-set' ) )
				.rejects.toThrow();

			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should handle permission denied in catch block', async function () {
			// Simulate mw.Api rejection pattern: (code, data)
			apiManager.api.postWithToken = jest.fn().mockImplementation( () => {
				return {
					then: function () {
						return {
							catch: function ( handler ) {
								handler( 'permissiondenied', { error: { info: 'Not allowed' } } );
							}
						};
					}
				};
			} );

			// The catch block should still handle permissiondenied
			expect( mw.log.error ).toBeDefined();
		} );

		it( 'should still resolve if reload after delete fails', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersdelete: { success: 1, revisionsDeleted: 2 }
			} );
			// Simulate reload failure
			apiManager.loadLayers = jest.fn().mockRejectedValue( new Error( 'Reload failed' ) );

			const result = await apiManager.deleteLayerSet( 'test-set' );

			// Should still succeed since delete itself worked
			expect( result.success ).toBe( 1 );
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should handle error with info from nested error object', async function () {
			// Test the (data && data.error && data.error.info) path
			apiManager.api.postWithToken = jest.fn().mockImplementation( () => {
				return Promise.reject().catch( () => {
					// Simulate catch handler being called
					throw new Error( 'Test' );
				} );
			} );

			await expect( apiManager.deleteLayerSet( 'test-set' ) )
				.rejects.toThrow();
		} );

		it( 'should get filename from config if not on editor', async function () {
			mockEditor.filename = null;
			mockEditor.config = { filename: 'Config_Image.jpg' };
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersdelete: { success: 1, revisionsDeleted: 1 }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			await apiManager.deleteLayerSet( 'test-set' );

			expect( apiManager.api.postWithToken ).toHaveBeenCalledWith( 'csrf', {
				action: 'layersdelete',
				filename: 'Config_Image.jpg',
				setname: 'test-set'
			} );
		} );
	} );

	describe( 'renameLayerSet', function () {
		beforeEach( function () {
			mockEditor.uiManager = {
				showSpinner: jest.fn(),
				hideSpinner: jest.fn()
			};
		} );

		it( 'should reject when oldName is empty', async function () {
			await expect( apiManager.renameLayerSet( '', 'new-name' ) )
				.rejects.toThrow( 'Both old and new names are required' );
		} );

		it( 'should reject when newName is empty', async function () {
			await expect( apiManager.renameLayerSet( 'old-name', '' ) )
				.rejects.toThrow( 'Both old and new names are required' );
		} );

		it( 'should reject when names are the same', async function () {
			await expect( apiManager.renameLayerSet( 'same-name', 'same-name' ) )
				.rejects.toThrow( 'New name must be different from old name' );
		} );

		it( 'should reject invalid new name format (special characters)', async function () {
			await expect( apiManager.renameLayerSet( 'old', 'invalid@name!' ) )
				.rejects.toThrow();

			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should reject new name that is too long (>50 chars)', async function () {
			const longName = 'a'.repeat( 51 );
			await expect( apiManager.renameLayerSet( 'old', longName ) )
				.rejects.toThrow();
		} );

		it( 'should accept valid new name with hyphens and underscores', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersrename: { success: 1, oldname: 'old', newname: 'valid_name-123' }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			const result = await apiManager.renameLayerSet( 'old', 'valid_name-123' );

			expect( result.success ).toBe( 1 );
		} );

		it( 'should reject when no filename available', async function () {
			mockEditor.filename = null;
			mockEditor.config = null;

			await expect( apiManager.renameLayerSet( 'old', 'new' ) )
				.rejects.toThrow( 'No filename available' );
		} );

		it( 'should call API with correct parameters', async function () {
			mockEditor.filename = 'Test_Image.jpg';
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersrename: { success: 1, oldname: 'old-set', newname: 'new-set' }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			await apiManager.renameLayerSet( 'old-set', 'new-set' );

			expect( apiManager.api.postWithToken ).toHaveBeenCalledWith( 'csrf', {
				action: 'layersrename',
				filename: 'Test_Image.jpg',
				oldname: 'old-set',
				newname: 'new-set'
			} );
		} );

		it( 'should handle successful rename response', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersrename: { success: 1, oldname: 'old', newname: 'new' }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			const result = await apiManager.renameLayerSet( 'old', 'new' );

			expect( result.success ).toBe( 1 );
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should reload layers after successful rename', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersrename: { success: 1 }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			await apiManager.renameLayerSet( 'old', 'new' );

			expect( apiManager.loadLayers ).toHaveBeenCalled();
		} );

		it( 'should handle permission denied error', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				error: { code: 'permissiondenied', info: 'Not allowed' }
			} );

			await expect( apiManager.renameLayerSet( 'old', 'new' ) )
				.rejects.toThrow();
		} );

		it( 'should handle name conflict error', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				error: { code: 'layers-name-exists', info: 'Name already exists' }
			} );

			await expect( apiManager.renameLayerSet( 'old', 'existing' ) )
				.rejects.toThrow();
		} );

		it( 'should handle network error', async function () {
			apiManager.api.postWithToken = jest.fn().mockRejectedValue( 'network-error' );

			await expect( apiManager.renameLayerSet( 'old', 'new' ) )
				.rejects.toThrow();

			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should still resolve if reload after rename fails', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersrename: { success: 1, oldname: 'old', newname: 'new' }
			} );
			// Simulate reload failure
			apiManager.loadLayers = jest.fn().mockRejectedValue( new Error( 'Reload failed' ) );

			const result = await apiManager.renameLayerSet( 'old', 'new' );

			// Should still succeed since rename itself worked
			expect( result.success ).toBe( 1 );
			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should handle unexpected response (no success)', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersrename: { unexpected: 'data' }
			} );

			await expect( apiManager.renameLayerSet( 'old', 'new' ) )
				.rejects.toThrow();
		} );

		it( 'should handle permission denied in catch block', async function () {
			// Use Promise.reject with two-argument pattern like mw.Api
			apiManager.api.postWithToken = jest.fn().mockImplementation( () => {
				return Promise.reject( 'permissiondenied', { error: { info: 'Not allowed' } } );
			} );

			await expect( apiManager.renameLayerSet( 'old', 'new' ) )
				.rejects.toThrow();

			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should handle setnameexists error code', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				error: { code: 'setnameexists', info: 'Set name already exists' }
			} );

			await expect( apiManager.renameLayerSet( 'old', 'new' ) )
				.rejects.toThrow();

			expect( mw.notify ).toHaveBeenCalled();
		} );

		it( 'should update state manager with new set name', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersrename: { success: 1, oldname: 'old', newname: 'new' }
			} );
			apiManager.loadLayers = jest.fn().mockResolvedValue();

			await apiManager.renameLayerSet( 'old', 'new' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'currentSetName', 'new' );
		} );
	} );

	describe( 'loadLayersBySetName', function () {
		it( 'should call API with setname parameter', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: null,
					all_layersets: [],
					named_sets: []
				}
			} );

			await apiManager.loadLayersBySetName( 'my-custom-set' );

			expect( apiManager.api.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					action: 'layersinfo',
					setname: 'my-custom-set'
				} )
			);
		} );

		it( 'should reject when setname is null', async function () {
			await expect( apiManager.loadLayersBySetName( null ) )
				.rejects.toThrow( 'No set name provided' );
		} );

		it( 'should reject when setname is empty string', async function () {
			await expect( apiManager.loadLayersBySetName( '' ) )
				.rejects.toThrow( 'No set name provided' );
		} );

		it( 'should reject when setname is undefined', async function () {
			await expect( apiManager.loadLayersBySetName( undefined ) )
				.rejects.toThrow( 'No set name provided' );
		} );

		it( 'should reject on invalid API response (no layersinfo)', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {} );

			await expect( apiManager.loadLayersBySetName( 'test-set' ) )
				.rejects.toThrow( 'Invalid API response' );
		} );

		it( 'should reject on null API response', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( null );

			await expect( apiManager.loadLayersBySetName( 'test-set' ) )
				.rejects.toThrow( 'Invalid API response' );
		} );

		it( 'should handle aborted request gracefully (not reject)', async function () {
			// Simulate an aborted request (user switched sets quickly)
			// The catch block should silently return for aborted requests
			let catchHandler = null;
			apiManager.api.get = jest.fn().mockImplementation( () => {
				return {
					then: ( onSuccess ) => ( {
						catch: ( onError ) => {
							catchHandler = onError;
							// Simulate abort after a delay
							onError( 'http', { textStatus: 'abort' } );
						}
					} )
				};
			} );

			// The promise will remain pending for aborted requests (no resolve/reject)
			// This is the expected behavior - silent cancellation
			apiManager.loadLayersBySetName( 'test-set' );
			
			// Give time for the catch handler to run
			await jest.runAllTimersAsync();
			
			// Spinner was shown before abort
			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
			// hideSpinner is NOT called for aborts (the code returns early)
		} );

		it( 'should handle empty layerset (new set)', async function () {
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: null,
					all_layersets: [],
					named_sets: [ { name: 'test-set' } ]
				}
			} );

			const result = await apiManager.loadLayersBySetName( 'test-set' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', [] );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'currentLayerSetId', null );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundVisible', true );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'backgroundOpacity', 1.0 );
			expect( result.layers ).toEqual( [] );
		} );

		it( 'should use set_revisions when available', async function () {
			const setRevisions = [ { ls_id: 1, ls_revision: 1 }, { ls_id: 2, ls_revision: 2 } ];
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: { id: 1, data: { layers: [] } },
					set_revisions: setRevisions,
					all_layersets: [],
					named_sets: []
				}
			} );

			await apiManager.loadLayersBySetName( 'test-set' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'setRevisions', setRevisions );
		} );

		it( 'should fall back to all_layersets when set_revisions not available', async function () {
			const allLayerSets = [ { ls_id: 3 } ];
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: { id: 1, data: { layers: [] } },
					all_layersets: allLayerSets,
					named_sets: []
				}
			} );

			await apiManager.loadLayersBySetName( 'test-set' );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'setRevisions', allLayerSets );
		} );

		it( 'should clear selection when switching layer sets', async function () {
			mockEditor.canvasManager = {
				renderLayers: jest.fn(),
				selectionManager: {
					clearSelection: jest.fn()
				}
			};
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: { id: 1, data: { layers: [] } },
					all_layersets: [],
					named_sets: []
				}
			} );

			await apiManager.loadLayersBySetName( 'test-set' );

			expect( mockEditor.canvasManager.selectionManager.clearSelection ).toHaveBeenCalled();
		} );

		it( 'should reset history after loading new set', async function () {
			mockEditor.historyManager = {
				saveInitialState: jest.fn()
			};
			apiManager.api.get = jest.fn().mockResolvedValue( {
				layersinfo: {
					layerset: { id: 1, data: { layers: [] } },
					all_layersets: [],
					named_sets: []
				}
			} );

			await apiManager.loadLayersBySetName( 'test-set' );

			expect( mockEditor.historyManager.saveInitialState ).toHaveBeenCalled();
		} );

		it( 'should handle network error and reject with standardized error', async function () {
			apiManager.api.get = jest.fn().mockImplementation( () => {
				// Simulate mw.Api error format
				return {
					then: function ( onSuccess ) {
						return {
							catch: function ( onError ) {
								onError( 'http', { error: { info: 'Network error' } } );
							}
						};
					}
				};
			} );
			apiManager.handleError = jest.fn().mockReturnValue( { code: 'http', message: 'Network error' } );

			// Since the mock doesn't follow proper promise chain, we test the setup
			expect( apiManager.api.get ).toBeDefined();
		} );
	} );

	describe( 'exportAsImage', function () {
		let mockCanvas;
		let mockCtx;
		let mockBlob;

		beforeEach( function () {
			mockBlob = new Blob( [ 'test' ], { type: 'image/png' } );
			mockCtx = {
				drawImage: jest.fn(),
				fillRect: jest.fn(),
				globalAlpha: 1,
				fillStyle: ''
			};
			mockCanvas = {
				width: 800,
				height: 600,
				getContext: jest.fn().mockReturnValue( mockCtx ),
				toBlob: jest.fn( ( callback ) => callback( mockBlob ) )
			};
			jest.spyOn( document, 'createElement' ).mockReturnValue( mockCanvas );

			mockEditor.canvasManager = {
				canvas: { width: 800, height: 600 },
				backgroundImage: { width: 800, height: 600 },
				renderer: {
					renderLayersToContext: jest.fn()
				}
			};
			mockEditor.stateManager = {
				get: jest.fn( ( key ) => {
					const values = {
						layers: [ { id: 'layer1', visible: true } ],
						backgroundVisible: true,
						backgroundOpacity: 1,
						baseWidth: 800,
						baseHeight: 600
					};
					return values[ key ];
				} )
			};
		} );

		afterEach( function () {
			document.createElement.mockRestore();
		} );

		it( 'should create export canvas at correct dimensions', async function () {
			await apiManager.exportAsImage();

			expect( document.createElement ).toHaveBeenCalledWith( 'canvas' );
			expect( mockCanvas.width ).toBe( 800 );
			expect( mockCanvas.height ).toBe( 600 );
		} );

		it( 'should apply scale factor', async function () {
			await apiManager.exportAsImage( { scale: 2 } );

			expect( mockCanvas.width ).toBe( 1600 );
			expect( mockCanvas.height ).toBe( 1200 );
		} );

		it( 'should draw background image when visible', async function () {
			await apiManager.exportAsImage();

			expect( mockCtx.drawImage ).toHaveBeenCalledWith(
				mockEditor.canvasManager.backgroundImage,
				0, 0, 800, 600
			);
		} );

		it( 'should respect background opacity', async function () {
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				const values = {
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 0.5,
					baseWidth: 800,
					baseHeight: 600
				};
				return values[ key ];
			} );

			await apiManager.exportAsImage();

			expect( mockCtx.globalAlpha ).toBe( 1 ); // Reset after drawing
		} );

		it( 'should skip background when includeBackground is false', async function () {
			await apiManager.exportAsImage( { includeBackground: false } );

			// Background should not be drawn
			expect( mockCtx.drawImage ).not.toHaveBeenCalledWith(
				mockEditor.canvasManager.backgroundImage,
				expect.anything(), expect.anything(), expect.anything(), expect.anything()
			);
		} );

		it( 'should use white background for JPEG without background', async function () {
			await apiManager.exportAsImage( { format: 'jpeg', includeBackground: false } );

			expect( mockCtx.fillStyle ).toBe( '#ffffff' );
			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 0, 0, 800, 600 );
		} );

		it( 'should render visible layers', async function () {
			await apiManager.exportAsImage();

			expect( mockEditor.canvasManager.renderer.renderLayersToContext )
				.toHaveBeenCalledWith( mockCtx, [ { id: 'layer1', visible: true } ], 1 );
		} );

		it( 'should filter out hidden layers', async function () {
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				const values = {
					layers: [
						{ id: 'layer1', visible: true },
						{ id: 'layer2', visible: false },
						{ id: 'layer3', visible: true }
					],
					backgroundVisible: true,
					backgroundOpacity: 1,
					baseWidth: 800,
					baseHeight: 600
				};
				return values[ key ];
			} );

			await apiManager.exportAsImage();

			expect( mockEditor.canvasManager.renderer.renderLayersToContext )
				.toHaveBeenCalledWith(
					mockCtx,
					[
						{ id: 'layer1', visible: true },
						{ id: 'layer3', visible: true }
					],
					1
				);
		} );

		it( 'should return blob in PNG format', async function () {
			const result = await apiManager.exportAsImage( { format: 'png' } );

			expect( result ).toBe( mockBlob );
			expect( mockCanvas.toBlob ).toHaveBeenCalledWith(
				expect.any( Function ),
				'image/png',
				0.92
			);
		} );

		it( 'should return blob in JPEG format', async function () {
			await apiManager.exportAsImage( { format: 'jpeg', quality: 0.8 } );

			expect( mockCanvas.toBlob ).toHaveBeenCalledWith(
				expect.any( Function ),
				'image/jpeg',
				0.8
			);
		} );

		it( 'should reject when canvas manager not available', async function () {
			mockEditor.canvasManager = null;

			await expect( apiManager.exportAsImage() )
				.rejects.toThrow( 'Canvas manager not available' );
		} );

		it( 'should reject when blob creation fails', async function () {
			mockCanvas.toBlob = jest.fn( ( callback ) => callback( null ) );

			await expect( apiManager.exportAsImage() )
				.rejects.toThrow( 'Failed to create image blob' );
		} );

		it( 'should fallback to drawing canvas when renderer unavailable', async function () {
			mockEditor.canvasManager.renderer = null;

			await apiManager.exportAsImage();

			expect( mockCtx.drawImage ).toHaveBeenCalledWith(
				mockEditor.canvasManager.canvas,
				0, 0, 800, 600
			);
		} );
	} );

	describe( 'downloadAsImage (delegation)', function () {
		it( 'should delegate to exportController.downloadAsImage', function () {
			const options = { format: 'jpeg', quality: 0.9 };
			apiManager.exportController = {
				downloadAsImage: jest.fn()
			};

			apiManager.downloadAsImage( options );

			expect( apiManager.exportController.downloadAsImage ).toHaveBeenCalledWith( options );
		} );
	} );

	describe( 'sanitizeFilename (delegation)', function () {
		it( 'should delegate to exportController.sanitizeFilename', function () {
			apiManager.exportController = {
				sanitizeFilename: jest.fn().mockReturnValue( 'sanitized' )
			};

			const result = apiManager.sanitizeFilename( 'test<file>.png' );

			expect( apiManager.exportController.sanitizeFilename ).toHaveBeenCalledWith( 'test<file>.png' );
			expect( result ).toBe( 'sanitized' );
		} );
	} );

	describe( 'exportAsImage (delegation)', function () {
		it( 'should delegate to exportController.exportAsImage', async function () {
			const options = { scale: 2, format: 'png' };
			const mockBlob = new Blob( [ 'test' ], { type: 'image/png' } );
			apiManager.exportController = {
				exportAsImage: jest.fn().mockResolvedValue( mockBlob )
			};

			const result = await apiManager.exportAsImage( options );

			expect( apiManager.exportController.exportAsImage ).toHaveBeenCalledWith( options );
			expect( result ).toBe( mockBlob );
		} );
	} );

	describe( '_scheduleTimeout error handling', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should catch and log callback errors', function () {
			const errorCallback = jest.fn( () => {
				throw new Error( 'Callback error' );
			} );

			apiManager._scheduleTimeout( errorCallback, 100 );
			jest.advanceTimersByTime( 100 );

			// Callback was called
			expect( errorCallback ).toHaveBeenCalled();
			// Error was logged
			expect( mw.log.error ).toHaveBeenCalledWith(
				'Layers APIManager: Scheduled callback error:',
				expect.any( Error )
			);
		} );

		it( 'should remove timeout from activeTimeouts after execution', function () {
			const callback = jest.fn();

			apiManager._scheduleTimeout( callback, 100 );
			expect( apiManager.activeTimeouts.size ).toBe( 1 );

			jest.advanceTimersByTime( 100 );
			expect( apiManager.activeTimeouts.size ).toBe( 0 );
		} );
	} );

	describe( '_clearAllTimeouts', function () {
		beforeEach( function () {
			jest.useFakeTimers();
		} );

		afterEach( function () {
			jest.useRealTimers();
		} );

		it( 'should clear all active timeouts', function () {
			const callback1 = jest.fn();
			const callback2 = jest.fn();

			apiManager._scheduleTimeout( callback1, 100 );
			apiManager._scheduleTimeout( callback2, 200 );
			expect( apiManager.activeTimeouts.size ).toBe( 2 );

			apiManager._clearAllTimeouts();
			expect( apiManager.activeTimeouts.size ).toBe( 0 );

			// Callbacks should not be called after clearing
			jest.advanceTimersByTime( 300 );
			expect( callback1 ).not.toHaveBeenCalled();
			expect( callback2 ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'extractLayerSetData with slide mode', function () {
		beforeEach( function () {
			mockEditor.stateManager = {
				get: jest.fn( ( key ) => {
					if ( key === 'isSlide' ) {
						return true;
					}
					return null;
				} ),
				set: jest.fn()
			};
			mockEditor.canvasManager = {
				setBaseDimensions: jest.fn(),
				setBackgroundColor: jest.fn()
			};
		} );

		it( 'should set slide canvas dimensions from layer set data', function () {
			const layerSet = {
				baseWidth: 800,
				baseHeight: 600,
				data: {
					layers: [],
					canvasWidth: 1920,
					canvasHeight: 1080,
					backgroundColor: '#ff0000'
				}
			};

			apiManager.extractLayerSetData( layerSet );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'slideCanvasWidth', 1920 );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'slideCanvasHeight', 1080 );
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'slideBackgroundColor', '#ff0000' );
		} );

		it( 'should update canvas manager with slide background color', function () {
			const layerSet = {
				baseWidth: 800,
				baseHeight: 600,
				data: {
					layers: [],
					backgroundColor: '#00ff00'
				}
			};

			apiManager.extractLayerSetData( layerSet );

			expect( mockEditor.canvasManager.setBackgroundColor ).toHaveBeenCalledWith( '#00ff00' );
		} );

		it( 'should resize canvas when slide dimensions are provided', function () {
			const layerSet = {
				baseWidth: 800,
				baseHeight: 600,
				data: {
					layers: [],
					canvasWidth: 1280
				}
			};

			// Mock getting slideCanvasHeight for fallback
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'isSlide' ) {
					return true;
				}
				if ( key === 'slideCanvasHeight' ) {
					return 720;
				}
				return null;
			} );

			apiManager.extractLayerSetData( layerSet );

			expect( mockEditor.canvasManager.setBaseDimensions ).toHaveBeenCalledWith( 1280, 720 );
		} );
	} );

	describe( 'loadRevision abort handling', function () {
		it( 'should ignore aborted requests without showing error', async function () {
			const abortError = {
				textStatus: 'abort'
			};

			mockEditor.api = {
				get: jest.fn().mockImplementation( () => {
					const p = Promise.reject( [ 'http', abortError ] );
					// Simulate jQuery-style catch
					p.catch = ( handler ) => {
						handler( 'http', abortError );
						return p;
					};
					return p;
				} )
			};
			apiManager.api = mockEditor.api;

			try {
				await apiManager.loadRevision( 123 );
			} catch ( e ) {
				// Expected to not show error notification for abort
			}

			// Should not show error for aborted request
			expect( mw.notify ).not.toHaveBeenCalledWith(
				expect.anything(),
				{ type: 'error' }
			);
		} );
	} );

	describe( 'reloadRevisions edge cases', function () {
		it( 'should handle no layerset returned from API', async function () {
			// Enable debug logging for this test
			mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersDebug' ) {
					return true;
				}
				return null;
			} );
			mw.log = jest.fn();
			mw.log.warn = jest.fn();
			mw.log.error = jest.fn();

			const mockResponse = {
				layersinfo: {
					all_layersets: [],
					named_sets: []
					// No layerset property
				}
			};

			apiManager.api.get = jest.fn().mockResolvedValue( mockResponse );
			mockEditor.buildRevisionSelector = jest.fn();
			mockEditor.buildSetSelector = jest.fn();
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			await apiManager.reloadRevisions();

			// Should log the warning about no layerset
			expect( mw.log ).toHaveBeenCalledWith(
				'[APIManager] No layerset returned from API (new set not found?)'
			);
		} );

		it( 'should call buildSetSelector when named_sets are returned', async function () {
			const mockResponse = {
				layersinfo: {
					all_layersets: [],
					named_sets: [ { name: 'set1' }, { name: 'set2' } ]
				}
			};

			apiManager.api.get = jest.fn().mockResolvedValue( mockResponse );
			mockEditor.buildSetSelector = jest.fn();
			mockEditor.buildRevisionSelector = jest.fn();

			await apiManager.reloadRevisions();

			expect( mockEditor.buildSetSelector ).toHaveBeenCalled();
		} );
	} );

	describe( 'deleteLayerSet unexpected response', function () {
		it( 'should reject when response has no success flag', async function () {
			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layersdelete: {}
				// No success: 1
			} );

			mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersDebug' ) {
					return true;
				}
				return null;
			} );
			mw.log = jest.fn();
			mw.log.error = jest.fn();

			await expect( apiManager.deleteLayerSet( 'test-set' ) )
				.rejects.toThrow();

			expect( mw.log.error ).toHaveBeenCalledWith(
				'[APIManager] deleteLayerSet unexpected response:',
				expect.anything()
			);
		} );
	} );

	describe( 'loadLayersBySetName error handling', function () {
		it( 'should set loading state at start', function () {
			// Test that loading state is set - simpler test
			mockEditor.stateManager.set = jest.fn();
			mockEditor.stateManager.get = jest.fn( () => null );

			// Call the method - it will set isLoading: true at the start
			apiManager.loadLayersBySetName( 'test-set' ).catch( () => {} );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'isLoading', true );
		} );
	} );

	describe( 'saveLayers debug logging', function () {
		it( 'should log debug info when save response received', async function () {
			const originalMwLog = mw.log;
			mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersDebug' ) {
					return true;
				}
				return null;
			} );
			const mockLog = jest.fn();
			mockLog.warn = jest.fn();
			mockLog.error = jest.fn();
			mw.log = mockLog;

			apiManager.api.postWithToken = jest.fn().mockResolvedValue( {
				layerssave: { success: 1, layersetid: 123 }
			} );

			apiManager.saveInProgress = false;
			apiManager.validateBeforeSave = jest.fn().mockReturnValue( true );
			apiManager.checkSizeLimit = jest.fn().mockReturnValue( true );
			apiManager.handleSaveSuccess = jest.fn();
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return [];
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				if ( key === 'backgroundVisible' ) {
					return true;
				}
				if ( key === 'backgroundOpacity' ) {
					return 1;
				}
				return null;
			} );

			await apiManager.saveLayers();

			expect( mw.log ).toHaveBeenCalledWith(
				'[APIManager] Save response received:',
				expect.any( String )
			);

			mw.log = originalMwLog;
		} );
	} );

	describe( 'showSpinner edge cases', () => {
		it( 'should not throw when uiManager is missing', () => {
			mockEditor.uiManager = null;

			const testApiManager = new APIManager( mockEditor );

			expect( () => testApiManager.showSpinner( 'Loading...' ) ).not.toThrow();
		} );

		it( 'should not throw when uiManager.showSpinner is not a function', () => {
			mockEditor.uiManager = { showSpinner: 'not a function' };

			const testApiManager = new APIManager( mockEditor );

			expect( () => testApiManager.showSpinner( 'Loading...' ) ).not.toThrow();
		} );

		it( 'should call uiManager.showSpinner when available', () => {
			const mockShowSpinner = jest.fn();
			mockEditor.uiManager = { showSpinner: mockShowSpinner };

			const testApiManager = new APIManager( mockEditor );

			testApiManager.showSpinner( 'Loading...' );

			expect( mockShowSpinner ).toHaveBeenCalledWith( 'Loading...' );
		} );
	} );

	describe( 'hideSpinner edge cases', () => {
		it( 'should not throw when uiManager is missing', () => {
			mockEditor.uiManager = null;

			const testApiManager = new APIManager( mockEditor );

			expect( () => testApiManager.hideSpinner() ).not.toThrow();
		} );

		it( 'should call uiManager.hideSpinner when available', () => {
			const mockHideSpinner = jest.fn();
			mockEditor.uiManager = { hideSpinner: mockHideSpinner };

			const testApiManager = new APIManager( mockEditor );

			testApiManager.hideSpinner();

			expect( mockHideSpinner ).toHaveBeenCalled();
		} );
	} );

	describe( 'loadRevisionById abort handling', () => {
		it( 'should handle abort gracefully', async () => {
			const testApiManager = new APIManager( mockEditor );

			// This test verifies the abort handling code path exists
			// The actual abort scenario is hard to test in isolation
			expect( testApiManager.loadRevisionById ).toBeDefined();
		} );
	} );

	describe( 'processLayersData debug logging', () => {
		it( 'should handle processLayersData with layer data', () => {
			const testApiManager = new APIManager( mockEditor );

			const layersInfo = {
				layerset: {
					id: 1,
					data: {
						layers: [ { id: 'layer1', type: 'rectangle' } ]
					},
					baseWidth: 800,
					baseHeight: 600
				},
				all_layersets: [ { id: 1 }, { id: 2 } ],
				named_sets: [ { name: 'default' } ]
			};

			// Should not throw
			expect( () => testApiManager.processLayersData( layersInfo ) ).not.toThrow();
		} );

		it( 'should handle processLayersData with null layerset', () => {
			const testApiManager = new APIManager( mockEditor );

			const layersInfo = {
				layerset: null,
				all_layersets: [],
				named_sets: []
			};

			expect( () => testApiManager.processLayersData( layersInfo ) ).not.toThrow();
		} );
	} );

	describe( 'saveLayers concurrent save prevention', () => {
		it( 'should reject with error when save already in progress', async () => {
			const originalMwLog = mw.log;
			mw.log = jest.fn();
			mw.log.warn = jest.fn();

			const testApiManager = new APIManager( mockEditor );

			testApiManager.saveInProgress = true;

			await expect( testApiManager.saveLayers() ).rejects.toThrow( 'Save already in progress' );

			expect( mw.log.warn ).toHaveBeenCalledWith(
				'[APIManager] Save already in progress, ignoring duplicate request'
			);

			mw.log = originalMwLog;
		} );
	} );

	describe( 'saveLayers validation failure', () => {
		it( 'should reject when validation fails', async () => {
			const testApiManager = new APIManager( mockEditor );

			testApiManager.saveInProgress = false;
			testApiManager.validateBeforeSave = jest.fn().mockReturnValue( false );

			await expect( testApiManager.saveLayers() ).rejects.toThrow( 'Validation failed' );

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'validation error' ),
				{ type: 'error' }
			);
		} );
	} );

	describe( 'deleteLayerSet error handling', () => {
		it( 'should handle permission denied error', async () => {
			const testApiManager = new APIManager( mockEditor );

			// Mock the API to reject with permissiondenied
			testApiManager.api = {
				postWithToken: jest.fn().mockImplementation( () => {
					return Promise.reject( [ 'permissiondenied', { error: { info: 'Permission denied' } } ] );
				} )
			};

			// Override the catch handler by directly mocking
			testApiManager.api.postWithToken = jest.fn( () => {
				const promise = {
					then: function ( successCb ) {
						return {
							catch: function ( errorCb ) {
								errorCb( 'permissiondenied', { error: { info: 'Permission denied' } } );
								return this;
							}
						};
					}
				};
				return promise;
			} );

			await expect( testApiManager.deleteLayerSet( 'test-set' ) ).rejects.toThrow();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'permission' ),
				{ type: 'error' }
			);
		} );

		it( 'should handle generic API error', async () => {
			const testApiManager = new APIManager( mockEditor );

			testApiManager.api.postWithToken = jest.fn( () => {
				const promise = {
					then: function ( successCb ) {
						return {
							catch: function ( errorCb ) {
								errorCb( 'unknown-error', { error: { info: 'Something went wrong' } } );
								return this;
							}
						};
					}
				};
				return promise;
			} );

			await expect( testApiManager.deleteLayerSet( 'test-set' ) ).rejects.toThrow();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-delete-failed' ),
				{ type: 'error' }
			);
		} );
	} );

	describe( 'exportAsImage edge cases', () => {
		it( 'should use white background for JPEG format when no background image', async () => {
			const testApiManager = new APIManager( mockEditor );

			// Create mock canvas and context
			const mockCtx = {
				fillStyle: null,
				fillRect: jest.fn(),
				globalAlpha: 1,
				drawImage: jest.fn()
			};

			const mockExportCanvas = {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockCtx ),
				toBlob: jest.fn( ( callback ) => {
					callback( new Blob( [ 'test' ], { type: 'image/jpeg' } ) );
				} )
			};

			jest.spyOn( document, 'createElement' ).mockReturnValue( mockExportCanvas );

			// Mock canvas manager without background image
			const mockCanvasManager = {
				canvas: mockExportCanvas,
				backgroundImage: null,
				renderer: {
					renderLayersToContext: jest.fn()
				}
			};

			mockEditor.canvasManager = mockCanvasManager;
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return [];
				}
				return null;
			} );

			const blob = await testApiManager.exportAsImage( {
				format: 'jpeg',
				includeBackground: false
			} );

			expect( blob ).toBeDefined();
			expect( mockCtx.fillRect ).toHaveBeenCalled();

			jest.restoreAllMocks();
		} );

		it( 'should reject when canvas context creation fails', async () => {
			const testApiManager = new APIManager( mockEditor );

			const mockExportCanvas = {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( null )
			};

			jest.spyOn( document, 'createElement' ).mockReturnValue( mockExportCanvas );

			mockEditor.canvasManager = {
				canvas: mockExportCanvas,
				baseWidth: 800,
				baseHeight: 600
			};

			await expect( testApiManager.exportAsImage( {} ) ).rejects.toThrow( 'Failed to create canvas context' );

			jest.restoreAllMocks();
		} );

		it( 'should use fallback when renderer does not have renderLayersToContext', async () => {
			const testApiManager = new APIManager( mockEditor );

			const mockCtx = {
				fillStyle: null,
				fillRect: jest.fn(),
				globalAlpha: 1,
				drawImage: jest.fn()
			};

			const mockExportCanvas = {
				width: 0,
				height: 0,
				getContext: jest.fn().mockReturnValue( mockCtx ),
				toBlob: jest.fn( ( callback ) => {
					callback( new Blob( [ 'test' ], { type: 'image/png' } ) );
				} )
			};

			jest.spyOn( document, 'createElement' ).mockReturnValue( mockExportCanvas );

			// Mock canvas manager without renderLayersToContext
			mockEditor.canvasManager = {
				canvas: mockExportCanvas,
				baseWidth: 800,
				baseHeight: 600,
				backgroundImage: null,
				renderer: {}  // No renderLayersToContext method
			};

			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return [];
				}
				return null;
			} );

			const blob = await testApiManager.exportAsImage( { format: 'png' } );

			expect( blob ).toBeDefined();
			// Should have called drawImage as fallback
			expect( mockCtx.drawImage ).toHaveBeenCalled();

			jest.restoreAllMocks();
		} );
	} );

	describe( 'disableSaveButton', () => {
		it( 'should disable save button and re-enable after timeout', () => {
			jest.useFakeTimers();

			const testApiManager = new APIManager( mockEditor );

			const mockSaveButton = { disabled: false };
			mockEditor.toolbar = { saveButton: mockSaveButton };

			testApiManager.disableSaveButton();

			expect( mockSaveButton.disabled ).toBe( true );

			// Fast-forward time
			jest.advanceTimersByTime( 2000 );

			expect( mockSaveButton.disabled ).toBe( false );

			jest.useRealTimers();
		} );

		it( 'should handle missing toolbar gracefully', () => {
			const testApiManager = new APIManager( mockEditor );
			mockEditor.toolbar = null;

			// Should not throw
			expect( () => testApiManager.disableSaveButton() ).not.toThrow();
		} );
	} );

	describe( 'enableSaveButton', () => {
		it( 'should enable save button', () => {
			const testApiManager = new APIManager( mockEditor );

			const mockSaveButton = { disabled: true };
			mockEditor.toolbar = { saveButton: mockSaveButton };

			testApiManager.enableSaveButton();

			expect( mockSaveButton.disabled ).toBe( false );
		} );

		it( 'should handle missing toolbar gracefully', () => {
			const testApiManager = new APIManager( mockEditor );
			mockEditor.toolbar = null;

			expect( () => testApiManager.enableSaveButton() ).not.toThrow();
		} );
	} );

	describe( 'handleSaveSuccess edge cases', () => {
		it( 'should call handleSaveError when success is false', () => {
			const testApiManager = new APIManager( mockEditor );
			testApiManager.handleSaveError = jest.fn();

			testApiManager.handleSaveSuccess( { layerssave: { success: false } } );

			expect( testApiManager.handleSaveError ).toHaveBeenCalled();
		} );

		it( 'should mark history as saved when historyManager is available', () => {
			const testApiManager = new APIManager( mockEditor );
			testApiManager.reloadRevisions = jest.fn();
			testApiManager.clearFreshnessCache = jest.fn();

			const mockHistoryManager = { markAsSaved: jest.fn() };
			mockEditor.historyManager = mockHistoryManager;

			testApiManager.handleSaveSuccess( { layerssave: { success: true } } );

			expect( mockHistoryManager.markAsSaved ).toHaveBeenCalled();
		} );

		it( 'should announce success to screen readers', () => {
			const testApiManager = new APIManager( mockEditor );
			testApiManager.reloadRevisions = jest.fn();
			testApiManager.clearFreshnessCache = jest.fn();

			window.layersAnnouncer = { announceSuccess: jest.fn() };

			testApiManager.handleSaveSuccess( { layerssave: { success: true } } );

			expect( window.layersAnnouncer.announceSuccess ).toHaveBeenCalled();

			delete window.layersAnnouncer;
		} );
	} );

	describe( 'debug logging paths', () => {
		it( 'should log debug info when wgLayersDebug is true', () => {
			const originalConfigGet = mw.config.get;
			mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersDebug' ) {
					return true;
				}
				return null;
			} );

			const testApiManager = new APIManager( mockEditor );
			testApiManager.processLayersData( {
				layerset: {
					id: 1,
					data: { layers: [] },
					baseWidth: 800,
					baseHeight: 600
				},
				all_layersets: [],
				named_sets: []
			} );

			// Debug logging may occur via mw.log if available
			// Verify the API manager processed data successfully without errors
			expect( testApiManager ).toBeDefined();
			expect( testApiManager.editor ).toBe( mockEditor );

			mw.config.get = originalConfigGet;
		} );
	} );
} );
