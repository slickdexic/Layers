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
		ImportExportManager = window.ImportExportManager;

		// Mock editor
		mockEditor = {
			filename: 'test-image.jpg',
			isDirty: false,
			layers: [],
			stateManager: {
				get: jest.fn( () => [] ),
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

		beforeEach( () => {
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
		} );

		afterEach( () => {
			document.createElement.mockRestore();
			document.body.appendChild.mockRestore();
			document.body.removeChild.mockRestore();
		} );

		it( 'should create anchor element with correct attributes', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.triggerDownload( '{"test": true}', 'test.json', 'application/json' );

			expect( mockAnchor.download ).toBe( 'test.json' );
			expect( mockAnchor.href ).toContain( 'data:application/json' );
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
			expect( mockAnchor.href ).toContain( encodeURIComponent( '  ' ) ); // Indentation in pretty print
		} );

		it( 'should use custom filename when provided', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.exportToFile( { filename: 'custom-name' } );

			expect( mockAnchor.download ).toBe( 'custom-name.layers.json' );
		} );

		it( 'should use editor filename by default', () => {
			const manager = new ImportExportManager( { editor: mockEditor } );

			manager.exportToFile();

			expect( mockAnchor.download ).toBe( 'test-image.jpg.layers.json' );
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

	describe( 'module exports', () => {
		it( 'should export ImportExportManager to window', () => {
			expect( window.ImportExportManager ).toBeDefined();
			expect( typeof window.ImportExportManager ).toBe( 'function' );
		} );

		it( 'should export for CommonJS', () => {
			const exported = require( '../../resources/ext.layers.editor/ImportExportManager.js' );
			expect( typeof exported ).toBe( 'function' );
		} );
	} );
} );
