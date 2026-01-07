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

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', [] );
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
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'allLayerSets', expect.any( Array ) );
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
	} );

	describe( 'processRawLayers', function () {
		it( 'should add id to layers without id', function () {
			const result = apiManager.processRawLayers( [
				{ type: 'rectangle' },
				{ type: 'circle' }
			] );

			expect( result[ 0 ].id ).toBeTruthy();
			expect( result[ 1 ].id ).toBeTruthy();
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
	} );

	describe( 'reloadRevisions', function () {
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
			await new Promise( resolve => setTimeout( resolve, 10 ) );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'allLayerSets', mockRevisions );
		} );

		it( 'should handle API error gracefully', function () {
			apiManager.api.get = jest.fn().mockRejectedValue( new Error( 'Network error' ) );

			// Should not throw
			expect( () => apiManager.reloadRevisions() ).not.toThrow();
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

	describe( 'downloadAsImage', function () {
		let mockBlob;
		let mockAnchor;
		let mockUrl;

		beforeEach( function () {
			mockBlob = new Blob( [ 'test' ], { type: 'image/png' } );
			mockUrl = 'blob:test-url';
			mockAnchor = {
				href: '',
				download: '',
				click: jest.fn()
			};

			// Mock URL APIs
			global.URL.createObjectURL = jest.fn().mockReturnValue( mockUrl );
			global.URL.revokeObjectURL = jest.fn();

			// Mock document methods
			jest.spyOn( document.body, 'appendChild' ).mockImplementation( () => {} );
			jest.spyOn( document.body, 'removeChild' ).mockImplementation( () => {} );

			mockEditor.uiManager = {
				showSpinner: jest.fn(),
				hideSpinner: jest.fn()
			};
			mockEditor.stateManager = {
				get: jest.fn( ( key ) => {
					const values = {
						filename: 'File:TestImage.jpg',
						currentSetName: 'default',
						layers: [],
						backgroundVisible: true,
						backgroundOpacity: 1,
						baseWidth: 800,
						baseHeight: 600
					};
					return values[ key ];
				} )
			};

			// Mock exportAsImage
			apiManager.exportAsImage = jest.fn().mockResolvedValue( mockBlob );
		} );

		afterEach( function () {
			document.body.appendChild.mockRestore();
			document.body.removeChild.mockRestore();
		} );

		it( 'should show and hide spinner', async function () {
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage();

			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();

			createElementSpy.mockRestore();
		} );

		it( 'should call exportAsImage with options', async function () {
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage( { format: 'jpeg', quality: 0.8 } );

			expect( apiManager.exportAsImage ).toHaveBeenCalledWith( { format: 'jpeg', quality: 0.8 } );

			createElementSpy.mockRestore();
		} );

		it( 'should create download link with correct filename', async function () {
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage();

			expect( mockAnchor.download ).toBe( 'TestImage.png' );
			expect( mockAnchor.click ).toHaveBeenCalled();

			createElementSpy.mockRestore();
		} );

		it( 'should include set name in filename for non-default sets', async function () {
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				const values = {
					filename: 'File:TestImage.jpg',
					currentSetName: 'anatomy',
					layers: [],
					backgroundVisible: true,
					backgroundOpacity: 1
				};
				return values[ key ];
			} );

			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage();

			expect( mockAnchor.download ).toBe( 'TestImage-anatomy.png' );

			createElementSpy.mockRestore();
		} );

		it( 'should use jpg extension for jpeg format', async function () {
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage( { format: 'jpeg' } );

			expect( mockAnchor.download ).toBe( 'TestImage.jpg' );

			createElementSpy.mockRestore();
		} );

		it( 'should use custom filename when provided', async function () {
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage( { filename: 'custom-export.png' } );

			expect( mockAnchor.download ).toBe( 'custom-export.png' );

			createElementSpy.mockRestore();
		} );

		it( 'should revoke object URL after download', async function () {
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage();

			expect( global.URL.revokeObjectURL ).toHaveBeenCalledWith( mockUrl );

			createElementSpy.mockRestore();
		} );

		it( 'should show success notification', async function () {
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			await apiManager.downloadAsImage();

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'success' }
			);

			createElementSpy.mockRestore();
		} );

		it( 'should handle export failure gracefully', async function () {
			apiManager.exportAsImage = jest.fn().mockRejectedValue( new Error( 'Export failed' ) );
			const createElementSpy = jest.spyOn( document, 'createElement' ).mockReturnValue( mockAnchor );

			// downloadAsImage doesn't return a promise, so we use a spy to detect the error path
			apiManager.downloadAsImage();

			// Wait for the promise chain to complete using Jest's fake timers approach
			await new Promise( process.nextTick );

			expect( mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);

			createElementSpy.mockRestore();
		} );
	} );
} );
