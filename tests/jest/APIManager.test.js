/**
 * Jest tests for APIManager.js
 * Tests API communication, error handling, and data normalization
 */
'use strict';

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

	describe( 'normalizeBooleanProperties', function () {
		it( 'should convert string "false" to boolean false', function () {
			const layer = { visible: 'false', locked: 'false' };

			apiManager.normalizeBooleanProperties( layer );

			expect( layer.visible ).toBe( false );
			expect( layer.locked ).toBe( false );
		} );

		it( 'should convert string "true" to boolean true', function () {
			const layer = { visible: 'true', locked: 'true' };

			apiManager.normalizeBooleanProperties( layer );

			expect( layer.visible ).toBe( true );
			expect( layer.locked ).toBe( true );
		} );

		it( 'should convert numeric 0 to boolean false', function () {
			const layer = { visible: 0, shadow: 0 };

			apiManager.normalizeBooleanProperties( layer );

			expect( layer.visible ).toBe( false );
			expect( layer.shadow ).toBe( false );
		} );

		it( 'should convert numeric 1 to boolean true', function () {
			const layer = { visible: 1, glow: 1 };

			apiManager.normalizeBooleanProperties( layer );

			expect( layer.visible ).toBe( true );
			expect( layer.glow ).toBe( true );
		} );

		it( 'should convert string "0" to boolean false', function () {
			const layer = { visible: '0' };

			apiManager.normalizeBooleanProperties( layer );

			expect( layer.visible ).toBe( false );
		} );

		it( 'should convert string "1" to boolean true', function () {
			const layer = { visible: '1' };

			apiManager.normalizeBooleanProperties( layer );

			expect( layer.visible ).toBe( true );
		} );

		it( 'should convert empty string to boolean true (legacy data)', function () {
			const layer = { textShadow: '' };

			apiManager.normalizeBooleanProperties( layer );

			expect( layer.textShadow ).toBe( true );
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

	describe( 'destroy', function () {
		it( 'should clean up references', function () {
			apiManager.destroy();

			expect( apiManager.api ).toBeNull();
			expect( apiManager.editor ).toBeNull();
			expect( apiManager.errorConfig ).toBeNull();
		} );

		it( 'should call abort if available', function () {
			apiManager.api.abort = jest.fn();

			apiManager.destroy();

			expect( apiManager.api ).toBeNull(); // Was set to null after abort
		} );
	} );
} );
