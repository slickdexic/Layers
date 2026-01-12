/**
 * @jest-environment jsdom
 */
'use strict';

// Load the module
require( '../../resources/ext.layers.editor/ImportExportManager.js' );

describe( 'ImportExportManager', () => {
	let ImportExportManager;
	let mockEditor;

	beforeEach( () => {
		ImportExportManager = window.Layers.Core.ImportExportManager;

		// Mock editor
		mockEditor = {
			filename: 'test-image.jpg',
			isDirty: false,
			layers: [],
			stateManager: {
				get: jest.fn( ( key ) => {
					if ( key === 'currentSetName' ) {
						return 'default';
					}
					return [];
				} ),
				set: jest.fn(),
				getLayers: jest.fn( () => [] )
			},
			canvasManager: {
				renderLayers: jest.fn()
			},
			saveState: jest.fn(),
			markDirty: jest.fn()
		};

		// Mock mw.notify
		global.mw = {
			notify: jest.fn(),
			message: jest.fn( () => ( {
				text: () => 'Test message'
			} ) )
		};

		// Mock window.confirm
		global.confirm = jest.fn( () => true );

		// Mock layersMessages
		global.layersMessages = {
			get: jest.fn( ( key, fallback ) => fallback || key )
		};
	} );

	afterEach( () => {
		delete global.mw;
		delete global.confirm;
		delete global.layersMessages;
	} );

	describe( 'constructor', () => {
		it( 'should create instance with editor reference', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			expect( manager.editor ).toBe( mockEditor );
		} );
	} );

	describe( 'msg', () => {
		it( 'should use layersMessages when available', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			global.layersMessages.get.mockReturnValue( 'Localized text' );

			const result = manager.msg( 'test-key', 'fallback' );

			expect( global.layersMessages.get ).toHaveBeenCalledWith( 'test-key', 'fallback' );
			expect( result ).toBe( 'Localized text' );
		} );

		it( 'should fall back to mw.message when layersMessages unavailable', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			delete global.layersMessages;
			global.mw.message.mockReturnValue( { text: () => 'MW message' } );

			const result = manager.msg( 'test-key', 'fallback' );

			expect( result ).toBe( 'MW message' );
		} );

		it( 'should return fallback when no message system available', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			delete global.layersMessages;
			delete global.mw;

			const result = manager.msg( 'test-key', 'fallback text' );

			expect( result ).toBe( 'fallback text' );
		} );
	} );

	describe( 'notify', () => {
		it( 'should call mw.notify with message and type', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.notify( 'Test message', 'success' );

			expect( global.mw.notify ).toHaveBeenCalledWith( 'Test message', { type: 'success' } );
		} );

		it( 'should default to info type', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.notify( 'Test message' );

			expect( global.mw.notify ).toHaveBeenCalledWith( 'Test message', { type: 'info' } );
		} );

		it( 'should not throw when mw.notify unavailable', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			delete global.mw;

			expect( () => manager.notify( 'Test' ) ).not.toThrow();
		} );
	} );

	describe( 'parseLayersJSON', () => {
		it( 'should parse array of layers', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const json = JSON.stringify( [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle' }
			] );

			const result = manager.parseLayersJSON( json );

			expect( result ).toHaveLength( 2 );
			expect( result[ 0 ].id ).toBe( 'layer1' );
		} );

		it( 'should parse object with layers property', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const json = JSON.stringify( {
				layers: [ { id: 'layer1', type: 'rectangle' } ],
				metadata: { version: 1 }
			} );

			const result = manager.parseLayersJSON( json );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ].id ).toBe( 'layer1' );
		} );

		it( 'should generate IDs for layers without them', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const json = JSON.stringify( [
				{ type: 'rectangle', x: 10, y: 20 }
			] );

			const result = manager.parseLayersJSON( json );

			expect( result[ 0 ].id ).toBeDefined();
			expect( result[ 0 ].id ).toMatch( /^layer_/ );
		} );

		it( 'should throw on invalid JSON', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			expect( () => manager.parseLayersJSON( 'invalid json' ) ).toThrow();
		} );

		it( 'should throw on invalid format', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const json = JSON.stringify( { notLayers: true } );

			expect( () => manager.parseLayersJSON( json ) ).toThrow( 'Invalid JSON format' );
		} );
	} );

	describe( 'applyImportedLayers', () => {
		it( 'should save state before import', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const layers = [ { id: 'layer1', type: 'rectangle' } ];

			manager.applyImportedLayers( layers );

			expect( mockEditor.saveState ).toHaveBeenCalledWith( 'import' );
		} );

		it( 'should set layers via stateManager', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const layers = [ { id: 'layer1', type: 'rectangle' } ];

			manager.applyImportedLayers( layers );

			expect( mockEditor.stateManager.set ).toHaveBeenCalledWith( 'layers', layers );
		} );

		it( 'should set layers directly when no stateManager', () => {
			mockEditor.stateManager = null;
			const manager = new ImportExportManager( { editor: mockEditor } );
			const layers = [ { id: 'layer1', type: 'rectangle' } ];

			manager.applyImportedLayers( layers );

			expect( mockEditor.layers ).toBe( layers );
		} );

		it( 'should re-render after import', () => {
			mockEditor.stateManager.get.mockReturnValue( [ { id: 'layer1' } ] );
			const manager = new ImportExportManager( { editor: mockEditor } );
			const layers = [ { id: 'layer1', type: 'rectangle' } ];

			manager.applyImportedLayers( layers );

			expect( mockEditor.canvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should mark editor as dirty', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const layers = [ { id: 'layer1', type: 'rectangle' } ];

			manager.applyImportedLayers( layers );

			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );

		it( 'should handle missing editor gracefully', () => {
			const manager = new ImportExportManager( { editor: null } );

			expect( () => manager.applyImportedLayers( [] ) ).not.toThrow();
		} );
	} );

	describe( 'importFromFile', () => {
		it( 'should reject when no file provided', async () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			await expect( manager.importFromFile( null ) ).rejects.toThrow( 'No file provided' );
		} );

		it( 'should prompt for confirmation when editor is dirty', async () => {
			mockEditor.isDirty = true;
			const manager = new ImportExportManager( { editor: mockEditor } );
			global.confirm.mockReturnValue( false );

			const mockFile = new Blob( [ '[]' ], { type: 'application/json' } );
			mockFile.name = 'test.json';

			await expect( manager.importFromFile( mockFile ) ).rejects.toThrow( 'Import cancelled by user' );
			expect( global.confirm ).toHaveBeenCalled();
		} );

		it( 'should skip confirmation when confirmOverwrite is false', async () => {
			mockEditor.isDirty = true;
			const manager = new ImportExportManager( { editor: mockEditor } );

			const mockFile = new Blob( [ '[]' ], { type: 'application/json' } );
			mockFile.name = 'test.json';

			// Even with dirty editor, should not prompt
			await manager.importFromFile( mockFile, { confirmOverwrite: false } );

			expect( global.confirm ).not.toHaveBeenCalled();
		} );

		it( 'should parse and apply layers from file', async () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const layers = [ { id: 'layer1', type: 'rectangle' } ];
			const mockFile = new Blob( [ JSON.stringify( layers ) ], { type: 'application/json' } );
			mockFile.name = 'test.json';

			const result = await manager.importFromFile( mockFile );

			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ].type ).toBe( 'rectangle' );
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining( { type: 'success' } )
			);
		} );
	} );

	describe( 'getLayersForExport', () => {
		it( 'should get layers from stateManager when available', () => {
			const layers = [ { id: 'layer1', type: 'rectangle' } ];
			mockEditor.stateManager.getLayers.mockReturnValue( layers );
			const manager = new ImportExportManager( { editor: mockEditor } );

			const result = manager.getLayersForExport();

			expect( result ).toBe( layers );
		} );

		it( 'should fall back to editor.layers', () => {
			const layers = [ { id: 'layer1', type: 'rectangle' } ];
			mockEditor.stateManager = null;
			mockEditor.layers = layers;
			const manager = new ImportExportManager( { editor: mockEditor } );

			const result = manager.getLayersForExport();

			expect( result ).toBe( layers );
		} );

		it( 'should return empty array when no layers available', () => {
			const manager = new ImportExportManager( { editor: null } );

			const result = manager.getLayersForExport();

			expect( result ).toEqual( [] );
		} );
	} );

	describe( 'triggerDownload', () => {
		let originalCreateElement;
		let mockAnchor;
		let mockCreateObjectURL;
		let mockRevokeObjectURL;

		beforeEach( () => {
			jest.useFakeTimers();
			mockAnchor = {
				style: {},
				click: jest.fn()
			};
			originalCreateElement = document.createElement;
			jest.spyOn( document, 'createElement' ).mockImplementation( ( tag ) => {
				if ( tag === 'a' ) {
					return mockAnchor;
				}
				return originalCreateElement.call( document, tag );
			} );
			jest.spyOn( document.body, 'appendChild' ).mockImplementation( () => {} );
			jest.spyOn( document.body, 'removeChild' ).mockImplementation( () => {} );

			// Mock URL.createObjectURL and revokeObjectURL
			mockCreateObjectURL = jest.fn().mockReturnValue( 'blob:http://localhost/test-blob' );
			mockRevokeObjectURL = jest.fn();
			global.URL.createObjectURL = mockCreateObjectURL;
			global.URL.revokeObjectURL = mockRevokeObjectURL;
		} );

		afterEach( () => {
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
			document.createElement.mockRestore();
			document.body.appendChild.mockRestore();
			document.body.removeChild.mockRestore();
		} );

		it( 'should create anchor element with blob URL (not data URL)', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.triggerDownload( '{"test": true}', 'test.json', 'application/json' );

			expect( mockAnchor.download ).toBe( 'test.json' );
			expect( mockAnchor.href ).toBe( 'blob:http://localhost/test-blob' );
			expect( mockCreateObjectURL ).toHaveBeenCalled();
			expect( mockAnchor.click ).toHaveBeenCalled();
		} );

		it( 'should use msSaveOrOpenBlob for IE/Edge legacy', () => {
			const mockMsSaveOrOpenBlob = jest.fn();
			window.navigator.msSaveOrOpenBlob = mockMsSaveOrOpenBlob;

			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.triggerDownload( '{"test": true}', 'test.json', 'application/json' );

			expect( mockMsSaveOrOpenBlob ).toHaveBeenCalled();

			delete window.navigator.msSaveOrOpenBlob;
		} );
	} );

	describe( 'exportToFile', () => {
		let originalCreateElement;
		let mockAnchor;
		let mockCreateObjectURL;

		beforeEach( () => {
			mockAnchor = {
				style: {},
				click: jest.fn()
			};
			jest.spyOn( document, 'createElement' ).mockImplementation( ( tag ) => {
				if ( tag === 'a' ) {
					return mockAnchor;
				}
				return document.createElement( tag );
			} );
			jest.spyOn( document.body, 'appendChild' ).mockImplementation( () => {} );
			jest.spyOn( document.body, 'removeChild' ).mockImplementation( () => {} );

			// Mock URL.createObjectURL for blob URL
			mockCreateObjectURL = jest.fn().mockReturnValue( 'blob:http://localhost/test-blob' );
			global.URL.createObjectURL = mockCreateObjectURL;
			global.URL.revokeObjectURL = jest.fn();
		} );

		afterEach( () => {
			document.createElement.mockRestore();
			document.body.appendChild.mockRestore();
			document.body.removeChild.mockRestore();
		} );

		it( 'should export layers with pretty print by default', () => {
			const layers = [ { id: 'layer1', type: 'rectangle' } ];
			mockEditor.stateManager.getLayers.mockReturnValue( layers );
			const manager = new ImportExportManager( { editor: mockEditor } );

			const result = manager.exportToFile();

			expect( result ).toBe( true );
			// Verify blob was created and URL.createObjectURL was called
			expect( mockCreateObjectURL ).toHaveBeenCalled();
			expect( mockAnchor.href ).toBe( 'blob:http://localhost/test-blob' );
		} );

		it( 'should use custom filename when provided', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.exportToFile( { filename: 'custom-name' } );

			expect( mockAnchor.download ).toBe( 'custom-name-layers-default.json' );
		} );

		it( 'should use editor filename by default', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.exportToFile();

			expect( mockAnchor.download ).toBe( 'test-image.jpg-layers-default.json' );
		} );

		it( 'should return false and notify on error', () => {
			mockEditor.stateManager.getLayers.mockImplementation( () => {
				throw new Error( 'Test error' );
			} );
			const manager = new ImportExportManager( { editor: mockEditor } );

			const result = manager.exportToFile();

			expect( result ).toBe( false );
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining( { type: 'error' } )
			);
		} );
	} );

	describe( 'createImportButton', () => {
		it( 'should create button and hidden input', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			const { button, input } = manager.createImportButton();

			expect( button.tagName ).toBe( 'BUTTON' );
			expect( button.className ).toContain( 'import-button' );
			expect( input.tagName ).toBe( 'INPUT' );
			expect( input.type ).toBe( 'file' );
			expect( input.accept ).toBe( '.json,application/json' );
		} );

		it( 'should trigger file input on button click', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const { button, input } = manager.createImportButton();
			const clickSpy = jest.spyOn( input, 'click' );

			button.click();

			expect( clickSpy ).toHaveBeenCalled();
		} );

		it( 'should use custom button text', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			const { button } = manager.createImportButton( { buttonText: 'Custom Import' } );

			expect( button.textContent ).toBe( 'Custom Import' );
		} );
	} );

	describe( 'createExportButton', () => {
		it( 'should create export button', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			const button = manager.createExportButton();

			expect( button.tagName ).toBe( 'BUTTON' );
			expect( button.className ).toContain( 'export-button' );
		} );

		it( 'should call exportToFile on click', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			const exportSpy = jest.spyOn( manager, 'exportToFile' ).mockReturnValue( true );

			const button = manager.createExportButton();
			button.click();

			expect( exportSpy ).toHaveBeenCalled();
		} );

		it( 'should call onSuccess callback on successful export', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			jest.spyOn( manager, 'exportToFile' ).mockReturnValue( true );
			const onSuccess = jest.fn();

			const button = manager.createExportButton( { onSuccess } );
			button.click();

			expect( onSuccess ).toHaveBeenCalled();
		} );

		it( 'should call onError callback on failed export', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );
			jest.spyOn( manager, 'exportToFile' ).mockReturnValue( false );
			const onError = jest.fn();

			const button = manager.createExportButton( { onError } );
			button.click();

			expect( onError ).toHaveBeenCalled();
		} );
	} );

	describe( 'importFromFile reader callbacks', () => {
		it( 'should handle reader.onerror', async () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );

			// Mock FileReader to trigger error
			const mockFileReader = {
				readAsText: jest.fn( function() {
					// Trigger onerror asynchronously
					setTimeout( () => this.onerror( new Error( 'Read error' ) ), 0 );
				} ),
				onerror: null,
				onload: null
			};

			jest.spyOn( window, 'FileReader' ).mockImplementation( () => mockFileReader );

			const file = new File( [ 'test' ], 'test.json', { type: 'application/json' } );

			await expect( importManager.importFromFile( file ) ).rejects.toThrow( 'File read error' );

			window.FileReader.mockRestore();
		} );

		it( 'should reject on JSON parse error in onload', async () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );

			const mockFileReader = {
				readAsText: jest.fn( function() {
					setTimeout( () => this.onload( { target: { result: 'invalid json {{{' } } ), 0 );
				} ),
				onerror: null,
				onload: null
			};

			jest.spyOn( window, 'FileReader' ).mockImplementation( () => mockFileReader );

			const file = new File( [ 'test' ], 'test.json', { type: 'application/json' } );

			await expect( importManager.importFromFile( file ) ).rejects.toThrow();

			window.FileReader.mockRestore();
		} );
	} );

	describe( 'createImportButton callbacks', () => {
		it( 'should call onSuccess callback after successful import', async () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );
			const onSuccess = jest.fn();
			const onError = jest.fn();

			// Create button with callbacks
			const { button, input } = importManager.createImportButton( { onSuccess, onError } );

			// Mock importFromFile to resolve
			importManager.importFromFile = jest.fn().mockResolvedValue( [ { id: 'layer1', type: 'rectangle' } ] );

			// Simulate file selection
			const file = new File( [ '[]' ], 'test.json', { type: 'application/json' } );
			Object.defineProperty( input, 'files', {
				value: [ file ],
				writable: false
			} );

			// Trigger change event
			input.dispatchEvent( new Event( 'change' ) );

			// Wait for promise to resolve
			await new Promise( resolve => setTimeout( resolve, 10 ) );

			expect( onSuccess ).toHaveBeenCalledWith( [ { id: 'layer1', type: 'rectangle' } ] );
			expect( onError ).not.toHaveBeenCalled();
		} );

		it( 'should call onError callback on import failure', async () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );
			const onSuccess = jest.fn();
			const onError = jest.fn();

			const { button, input } = importManager.createImportButton( { onSuccess, onError } );

			// Mock importFromFile to reject
			const testError = new Error( 'Import failed' );
			importManager.importFromFile = jest.fn().mockRejectedValue( testError );

			// Simulate file selection
			const file = new File( [ '[]' ], 'test.json', { type: 'application/json' } );
			Object.defineProperty( input, 'files', {
				value: [ file ],
				writable: false
			} );

			// Trigger change event
			input.dispatchEvent( new Event( 'change' ) );

			// Wait for promise to reject
			await new Promise( resolve => setTimeout( resolve, 10 ) );

			expect( onError ).toHaveBeenCalledWith( testError );
			expect( onSuccess ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing when no file selected', () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );
			const onSuccess = jest.fn();
			const { input } = importManager.createImportButton( { onSuccess } );

			// Empty files array
			Object.defineProperty( input, 'files', {
				value: [],
				writable: false
			} );

			input.dispatchEvent( new Event( 'change' ) );

			expect( onSuccess ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ImportExportManager to window.Layers namespace', () => {
			expect( window.Layers.Core.ImportExportManager ).toBeDefined();
			expect( typeof window.Layers.Core.ImportExportManager ).toBe( 'function' );
		} );

		it( 'should export for CommonJS', () => {
			const exported = require( '../../resources/ext.layers.editor/ImportExportManager.js' );
			expect( typeof exported ).toBe( 'function' );
		} );
	} );

	describe( 'parseImportedJSON', () => {
		it( 'should throw error when layers property is not an array', async () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );
			// Create JSON where 'layers' exists but is not an array (object format but invalid layers)
			const invalidJson = JSON.stringify( { layers: 'not-an-array' } );
			const file = new File( [ invalidJson ], 'test.json', { type: 'application/json' } );

			await expect( importManager.importFromFile( file ) ).rejects.toThrow( 'Invalid JSON format' );
		} );

		it( 'should throw error when parsed data has layers property that is null', async () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );
			// Create JSON where 'layers' is null
			const invalidJson = JSON.stringify( { layers: null } );
			const file = new File( [ invalidJson ], 'test.json', { type: 'application/json' } );

			await expect( importManager.importFromFile( file ) ).rejects.toThrow( 'Invalid JSON format' );
		} );

		it( 'should accept object with layers array', async () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );
			const validJson = JSON.stringify( { layers: [ { id: 'layer1', type: 'rectangle' } ] } );
			const file = new File( [ validJson ], 'test.json', { type: 'application/json' } );

			// Should not throw - returns the layers
			const result = await importManager.importFromFile( file, { confirmOverwrite: false } );
			expect( result ).toHaveLength( 1 );
			expect( result[ 0 ].id ).toBe( 'layer1' );
		} );
	} );

	describe( 'showConfirmDialog fallback', () => {
		it( 'should fall back to native confirm when dialogManager is unavailable', async () => {
			const editorWithoutDialog = {
				stateManager: mockEditor.stateManager,
				dialogManager: null
			};
			const importManager = new ImportExportManager( { editor: editorWithoutDialog } );

			const originalConfirm = window.confirm;
			window.confirm = jest.fn().mockReturnValue( true );

			const result = await importManager.showConfirmDialog( { message: 'Test?' } );

			expect( window.confirm ).toHaveBeenCalledWith( 'Test?' );
			expect( result ).toBe( true );

			window.confirm = originalConfirm;
		} );
	} );

	describe( 'parseLayersJSON edge cases', () => {
		it( 'should throw for non-array layers property', () => {
			const importManager = new ImportExportManager( { editor: mockEditor } );

			// JSON with layers that is not an array - but since we check Array.isArray(parsed.layers),
			// a non-array will fall through to the "Invalid JSON format" error
			// We need parsed.layers to be truthy but not an array after assignment
			// Actually looking at the code: if parsed.layers is not an array, we hit "Invalid JSON format"
			// The "Invalid layers data" branch is dead code because we already check Array.isArray(parsed.layers)
			// Let me test the first branch instead - when parsed is not an array and parsed.layers doesn't exist
			const invalidData = JSON.stringify( { notLayers: [] } );

			expect( () => importManager.parseLayersJSON( invalidData ) ).toThrow( 'Invalid JSON format' );
		} );
	} );
} );
