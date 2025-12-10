/**
 * @jest-environment jsdom
 */

/**
 * Integration Tests for Save/Load Workflow
 *
 * These tests verify the complete save/load cycle including:
 * - Save layers to API
 * - Load layers from API
 * - Named layer sets switching
 * - Revision management
 * - Error handling for API failures
 * - Data integrity through save/load cycles
 */

'use strict';

describe( 'Integration: Save/Load Workflow', () => {
	let APIManager;
	let apiManager;
	let mockEditor;
	let mockApi;

	// Sample layer data for testing
	const sampleLayers = [
		{
			id: 'layer_1',
			type: 'rectangle',
			x: 100,
			y: 100,
			width: 200,
			height: 150,
			fill: '#ff0000',
			stroke: '#000000',
			strokeWidth: 2,
			visible: true,
			locked: false,
			name: 'Red Rectangle'
		},
		{
			id: 'layer_2',
			type: 'circle',
			x: 300,
			y: 200,
			radius: 50,
			fill: '#00ff00',
			visible: true,
			locked: false,
			name: 'Green Circle'
		},
		{
			id: 'layer_3',
			type: 'text',
			x: 150,
			y: 50,
			text: 'Sample Text',
			fontSize: 24,
			fontFamily: 'Arial',
			fill: '#0000ff',
			visible: true,
			locked: false,
			name: 'Blue Text'
		}
	];

	beforeAll( () => {
		// Set up JSDOM globals
		global.document = window.document;

		// Mock mw (MediaWiki) global
		mockApi = {
			get: jest.fn(),
			post: jest.fn(),
			postWithToken: jest.fn()
		};

		global.mw = {
			config: {
				get: jest.fn( ( key ) => {
					if ( key === 'wgLayersDebug' ) {
						return false;
					}
					if ( key === 'wgLayersMaxBytes' ) {
						return 2097152; // 2MB
					}
					return null;
				} )
			},
			message: jest.fn( ( key ) => ( {
				text: () => key,
				exists: () => true
			} ) ),
			msg: jest.fn( ( key ) => key ),
			notify: jest.fn(),
			log: {
				warn: jest.fn(),
				error: jest.fn()
			},
			Api: jest.fn( () => mockApi )
		};

		// Mock LayersValidator
		window.LayersValidator = class {
			validateLayers( layers ) {
				return { isValid: true, errors: [], warnings: [] };
			}
			showValidationErrors() {}
		};

		// Load APIManager code via require for proper Jest coverage instrumentation
		const loaded = require( '../../../resources/ext.layers.editor/APIManager.js' );
		APIManager = loaded.APIManager;
	} );

	beforeEach( () => {
		// Reset all mocks
		jest.clearAllMocks();

		// Create mock editor with all necessary methods
		mockEditor = {
			filename: 'Test_Image.jpg',
			layers: [],
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
				get: jest.fn( ( key ) => {
					if ( key === 'layers' ) {
						return mockEditor.layers;
					}
					if ( key === 'currentSetName' ) {
						return 'default';
					}
					if ( key === 'isDirty' ) {
						return false;
					}
					return null;
				} ),
				set: jest.fn( ( key, value ) => {
					if ( key === 'layers' ) {
						mockEditor.layers = value;
					}
				} ),
				subscribe: jest.fn( () => jest.fn() ),
				markClean: jest.fn(),
				setDirty: jest.fn()
			},
			historyManager: {
				saveState: jest.fn()
			},
			buildRevisionSelector: jest.fn(),
			renderLayers: jest.fn(),
			validationManager: {
				sanitizeLayerData: jest.fn( ( data ) => data ),
				validateLayers: jest.fn( () => ( { isValid: true, errors: [] } ) )
			},
			debugLog: jest.fn(),
			errorLog: jest.fn()
		};

		apiManager = new APIManager( mockEditor );
	} );

	describe( 'Save Workflow', () => {
		test( 'should save layers successfully with correct API call structure', async () => {
			mockEditor.layers = [ ...sampleLayers ];
			// Mock stateManager.get to return layers
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			mockApi.postWithToken.mockResolvedValue( {
				layerssave: {
					success: 1,
					layersetid: 123,
					result: 'Success'
				}
			} );

			// Mock the reload to prevent extra calls
			apiManager.reloadRevisions = jest.fn();

			await apiManager.saveLayers();

			// Verify API was called with correct parameters
			expect( mockApi.postWithToken ).toHaveBeenCalledWith( 'csrf', expect.objectContaining( {
				action: 'layerssave',
				filename: 'Test_Image.jpg',
				setname: 'default',
				format: 'json',
				formatversion: 2
			} ) );

			// Verify data payload contains stringified layers
			const callArgs = mockApi.postWithToken.mock.calls[ 0 ][ 1 ];
			expect( callArgs.data ).toBeDefined();
			const parsedData = JSON.parse( callArgs.data );
			expect( parsedData ).toHaveLength( 3 );
			expect( parsedData[ 0 ].id ).toBe( 'layer_1' );
		} );

		test( 'should show spinner during save operation', async () => {
			mockEditor.layers = [ sampleLayers[ 0 ] ];
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );
			mockApi.postWithToken.mockResolvedValue( { layerssave: { success: 1 } } );
			apiManager.reloadRevisions = jest.fn();

			await apiManager.saveLayers();

			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		test( 'should handle save error gracefully', async () => {
			mockEditor.layers = [ sampleLayers[ 0 ] ];
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );
			// Permission denied errors are not retryable, so it will fail immediately
			mockApi.postWithToken.mockRejectedValue( [ 'permissiondenied', { error: { code: 'permissiondenied', info: 'User lacks editlayers right' } } ] );

			await expect( apiManager.saveLayers() ).rejects.toBeDefined();

			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		test( 'should reject save when validation fails', async () => {
			mockEditor.layers = [ sampleLayers[ 0 ] ];

			// Mock validation failure
			window.LayersValidator = class {
				validateLayers() {
					return { isValid: false, errors: [ 'Invalid layer data' ] };
				}
				showValidationErrors() {}
			};

			await expect( apiManager.saveLayers() ).rejects.toThrow( 'Validation failed' );
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );

		test( 'should reject save when data exceeds size limit', async () => {
			// Create oversized data
			const oversizedLayers = [];
			for ( let i = 0; i < 1000; i++ ) {
				oversizedLayers.push( {
					id: `layer_${i}`,
					type: 'text',
					text: 'A'.repeat( 10000 ) // 10KB per layer
				} );
			}
			mockEditor.layers = oversizedLayers;

			// Restore validation
			window.LayersValidator = class {
				validateLayers() {
					return { isValid: true, errors: [] };
				}
				showValidationErrors() {}
			};

			await expect( apiManager.saveLayers() ).rejects.toThrow( 'Data too large' );
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'Load Workflow', () => {
		test( 'should load layers by set name successfully', async () => {
			const mockResponse = {
				layersinfo: {
					layerset: {
						id: 123,
						imgName: 'Test_Image.jpg',
						userId: 1,
						timestamp: '2025-01-01T00:00:00Z',
						revision: 1,
						name: 'default',
						data: {
							schema: 1,
							revision: 1,
							layers: sampleLayers
						},
						baseWidth: 1920,
						baseHeight: 1080
					},
					all_layersets: [],
					named_sets: [ { name: 'default', revision_count: 1 } ]
				}
			};

			mockApi.get.mockResolvedValue( mockResponse );

			// Mock buildSetSelector and buildRevisionSelector
			mockEditor.buildSetSelector = jest.fn();

			const result = await apiManager.loadLayersBySetName( 'default' );

			expect( mockApi.get ).toHaveBeenCalledWith( expect.objectContaining( {
				action: 'layersinfo',
				filename: 'Test_Image.jpg',
				setname: 'default'
			} ) );

			// Verify layers were set
			expect( mockEditor.stateManager.set ).toHaveBeenCalled();
			expect( result.setName ).toBe( 'default' );
		} );

		test( 'should update editor state after loading layers', async () => {
			const loadedLayers = [ sampleLayers[ 0 ], sampleLayers[ 1 ] ];
			const mockResponse = {
				layersinfo: {
					layerset: {
						id: 456,
						data: {
							schema: 1,
							revision: 2,
							layers: loadedLayers
						}
					},
					all_layersets: [ { ls_id: 456, ls_revision: 2 } ]
				}
			};

			mockApi.get.mockResolvedValue( mockResponse );

			await apiManager.loadLayersBySetName( 'default' );

			// Verify state was updated
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', expect.any( Array ) );
		} );

		test( 'should handle missing layer set gracefully', async () => {
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: null,
					message: 'No layers found'
				}
			} );

			await apiManager.loadLayersBySetName( 'nonexistent' );

			// Should set empty layers array
			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', [] );
		} );

		test( 'should reject load when no set name provided', async () => {
			await expect( apiManager.loadLayersBySetName( '' ) ).rejects.toThrow( 'No set name provided' );
			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		test( 'should handle API error during load', async () => {
			mockApi.get.mockRejectedValue( [ 'filenotfound', { error: { code: 'filenotfound' } } ] );

			await expect( apiManager.loadLayersBySetName( 'default' ) ).rejects.toBeDefined();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );
	} );

	describe( 'Load Revision by ID', () => {
		test( 'should load specific revision successfully', async () => {
			const mockResponse = {
				layersinfo: {
					layerset: {
						id: 789,
						data: {
							schema: 1,
							revision: 5,
							layers: [ sampleLayers[ 0 ] ]
						}
					},
					all_layersets: []
				}
			};

			mockApi.get.mockResolvedValue( mockResponse );

			await apiManager.loadRevisionById( 789 );

			expect( mockApi.get ).toHaveBeenCalledWith( expect.objectContaining( {
				action: 'layersinfo',
				layersetid: 789
			} ) );
		} );

		test( 'should notify user when revision not found', async () => {
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: null
				}
			} );

			await expect( apiManager.loadRevisionById( 99999 ) ).rejects.toThrow( 'Revision not found' );
		} );
	} );

	describe( 'Named Layer Sets Workflow', () => {
		test( 'should save to specific named set', async () => {
			mockEditor.layers = [ sampleLayers[ 0 ] ];

			// Override stateManager.get to return the custom set name
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'anatomy-labels';
				}
				return null;
			} );

			mockApi.postWithToken.mockResolvedValue( { layerssave: { success: 1 } } );
			apiManager.reloadRevisions = jest.fn();

			await apiManager.saveLayers();

			const callArgs = mockApi.postWithToken.mock.calls[ 0 ][ 1 ];
			expect( callArgs.setname ).toBe( 'anatomy-labels' );
		} );

		test( 'should switch between named sets', async () => {
			// Mock buildSetSelector
			mockEditor.buildSetSelector = jest.fn();

			// First load 'default' set
			mockApi.get.mockResolvedValueOnce( {
				layersinfo: {
					layerset: {
						id: 1,
						name: 'default',
						data: { layers: [ sampleLayers[ 0 ] ] }
					},
					all_layersets: [],
					named_sets: []
				}
			} );

			await apiManager.loadLayersBySetName( 'default' );

			// Then load 'annotations' set
			mockApi.get.mockResolvedValueOnce( {
				layersinfo: {
					layerset: {
						id: 2,
						name: 'annotations',
						data: { layers: [ sampleLayers[ 1 ], sampleLayers[ 2 ] ] }
					},
					all_layersets: [],
					named_sets: []
				}
			} );

			await apiManager.loadLayersBySetName( 'annotations' );

			expect( mockApi.get ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	describe( 'Data Integrity', () => {
		test( 'should preserve all layer properties through save/load cycle', async () => {
			const originalLayer = {
				id: 'integrity_test',
				type: 'rectangle',
				x: 123.456,
				y: 789.012,
				width: 100,
				height: 50,
				fill: '#ff5500',
				stroke: '#000000',
				strokeWidth: 3,
				opacity: 0.75,
				rotation: 45,
				visible: true,
				locked: false,
				name: 'Integrity Test Layer'
			};

			mockEditor.layers = [ originalLayer ];
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			// Save
			mockApi.postWithToken.mockResolvedValue( { layerssave: { success: 1 } } );
			apiManager.reloadRevisions = jest.fn();
			await apiManager.saveLayers();

			// Capture what was sent
			const savedData = JSON.parse( mockApi.postWithToken.mock.calls[ 0 ][ 1 ].data );

			// Verify all properties are preserved
			expect( savedData[ 0 ] ).toEqual( originalLayer );
		} );

		test( 'should handle special characters in text layers', async () => {
			const textLayer = {
				id: 'text_special',
				type: 'text',
				x: 100,
				y: 100,
				text: 'Test with "quotes" and <brackets> and émojis 🎨',
				visible: true
			};

			mockEditor.layers = [ textLayer ];
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			mockApi.postWithToken.mockResolvedValue( { layerssave: { success: 1 } } );
			apiManager.reloadRevisions = jest.fn();
			await apiManager.saveLayers();

			const savedData = JSON.parse( mockApi.postWithToken.mock.calls[ 0 ][ 1 ].data );
			expect( savedData[ 0 ].text ).toBe( textLayer.text );
		} );

		test( 'should handle polygon with many points', async () => {
			const points = [];
			for ( let i = 0; i < 100; i++ ) {
				points.push( { x: Math.cos( i ) * 100, y: Math.sin( i ) * 100 } );
			}

			const polygonLayer = {
				id: 'polygon_many_points',
				type: 'polygon',
				x: 200,
				y: 200,
				points: points,
				fill: '#00ff00',
				visible: true
			};

			mockEditor.layers = [ polygonLayer ];
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			mockApi.postWithToken.mockResolvedValue( { layerssave: { success: 1 } } );
			apiManager.reloadRevisions = jest.fn();
			await apiManager.saveLayers();

			const savedData = JSON.parse( mockApi.postWithToken.mock.calls[ 0 ][ 1 ].data );
			expect( savedData[ 0 ].points ).toHaveLength( 100 );
		} );
	} );

	describe( 'Retry Logic', () => {
		test( 'should identify retryable error codes correctly', () => {
			// Unit test the isRetryableError method directly
			// Note: The method expects error in format { error: { code: '...' } }
			const retryableError = { error: { code: 'internal_api_error' } };
			const nonRetryableError = { error: { code: 'permissiondenied' } };
			const timeoutError = { error: { code: 'apierror-timeout' } };

			expect( apiManager.isRetryableError( retryableError ) ).toBe( true );
			expect( apiManager.isRetryableError( nonRetryableError ) ).toBe( false );
			expect( apiManager.isRetryableError( timeoutError ) ).toBe( true );
		} );

		test( 'should treat network errors as retryable', () => {
			// Network errors without proper error structure should be retryable
			expect( apiManager.isRetryableError( null ) ).toBe( true );
			expect( apiManager.isRetryableError( undefined ) ).toBe( true );
			expect( apiManager.isRetryableError( {} ) ).toBe( true );
		} );

		test( 'should execute save and receive response', async () => {
			mockEditor.layers = [ sampleLayers[ 0 ] ];
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			mockApi.postWithToken.mockResolvedValue( { layerssave: { success: 1 } } );
			apiManager.reloadRevisions = jest.fn();

			const result = await apiManager.saveLayers();

			expect( mockApi.postWithToken ).toHaveBeenCalledTimes( 1 );
			expect( result.layerssave.success ).toBe( 1 );
		} );
	} );

	describe( 'Error Handling', () => {
		test( 'should handle permission denied error and hide spinner', async () => {
			mockEditor.layers = [ sampleLayers[ 0 ] ];
			mockEditor.stateManager.get = jest.fn( ( key ) => {
				if ( key === 'layers' ) {
					return mockEditor.layers;
				}
				if ( key === 'currentSetName' ) {
					return 'default';
				}
				return null;
			} );

			mockApi.postWithToken.mockRejectedValue(
				[ 'permissiondenied', { error: { code: 'permissiondenied', info: 'User lacks editlayers right' } } ]
			);

			await expect( apiManager.saveLayers() ).rejects.toBeDefined();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		test( 'should normalize error objects correctly', () => {
			// Test the normalizeError method directly
			const stringError = apiManager.normalizeError( 'Simple error message' );
			expect( stringError.code ).toBe( 'string-error' );
			expect( stringError.message ).toBe( 'Simple error message' );

			const apiError = apiManager.normalizeError( { error: { code: 'ratelimited', info: 'Too many requests' } } );
			expect( apiError.code ).toBe( 'ratelimited' );
			expect( apiError.message ).toBe( 'Too many requests' );

			const jsError = apiManager.normalizeError( new Error( 'JavaScript error' ) );
			expect( jsError.code ).toBe( 'Error' );
			expect( jsError.message ).toBe( 'JavaScript error' );
		} );

		test( 'should get user-friendly messages for known error codes', () => {
			// Test getUserMessage method
			const ratelimitMsg = apiManager.getUserMessage( { code: 'ratelimited' }, 'save' );
			// Should return the i18n key since mw.message is mocked to return the key
			expect( ratelimitMsg ).toBe( 'layers-rate-limited' );

			const timeoutMsg = apiManager.getUserMessage( { code: 'timeout' }, 'save' );
			expect( timeoutMsg ).toBe( 'layers-timeout-error' );

			// Unknown error code should return operation default
			const unknownMsg = apiManager.getUserMessage( { code: 'unknown-code-123' }, 'save' );
			expect( unknownMsg ).toBe( 'layers-save-error' );
		} );

		test( 'should sanitize log messages to prevent info disclosure', () => {
			const sensitiveMessage = 'Error at C:\\Users\\admin\\secret\\file.js with token abc123xyz456789012345';
			const sanitized = apiManager.sanitizeLogMessage( sensitiveMessage );

			expect( sanitized ).not.toContain( 'C:\\Users\\admin' );
			expect( sanitized ).not.toContain( 'abc123xyz456789012345' );
			expect( sanitized ).toContain( '[PATH]' );
			expect( sanitized ).toContain( '[TOKEN]' );
		} );
	} );
} );
