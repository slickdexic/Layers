/**
 * Tests for ExportController
 *
 * @jest-environment jsdom
 */

'use strict';

// Mock ExportController
let ExportController;

describe( 'ExportController', () => {
	let controller;
	let mockEditor;

	beforeEach( () => {
		// Reset ExportController module
		jest.resetModules();

		// Mock DOM
		document.body.innerHTML = '';

		// Mock URL APIs
		global.URL = {
			createObjectURL: jest.fn().mockReturnValue( 'blob:test-url' ),
			revokeObjectURL: jest.fn()
		};

		// Mock mw
		global.mw = {
			message: jest.fn().mockReturnValue( {
				exists: jest.fn().mockReturnValue( true ),
				text: jest.fn().mockReturnValue( 'Test message' )
			} ),
			notify: jest.fn(),
			log: {
				error: jest.fn()
			}
		};

		// Mock window.Layers
		global.window = global.window || {};
		window.Layers = {
			Editor: {}
		};

		// Mock canvas and context
		const mockContext = {
			drawImage: jest.fn(),
			fillRect: jest.fn(),
			fillStyle: '',
			globalAlpha: 1
		};

		const mockExportCanvas = {
			width: 800,
			height: 600,
			getContext: jest.fn().mockReturnValue( mockContext ),
			toBlob: jest.fn( ( callback, mimeType, _quality ) => {
				callback( new Blob( [ 'test' ], { type: mimeType } ) );
			} )
		};

		// Mock document.createElement for canvas
		const originalCreateElement = document.createElement.bind( document );
		document.createElement = jest.fn( ( tag ) => {
			if ( tag === 'canvas' ) {
				return mockExportCanvas;
			}
			if ( tag === 'a' ) {
				const anchor = originalCreateElement( 'a' );
				anchor.click = jest.fn();
				return anchor;
			}
			return originalCreateElement( tag );
		} );

		// Mock canvas manager
		const mockBackgroundImage = new Image();
		mockBackgroundImage.width = 800;
		mockBackgroundImage.height = 600;

		const mockCanvasManager = {
			canvas: {
				width: 800,
				height: 600
			},
			backgroundImage: mockBackgroundImage,
			renderer: {
				renderLayersToContext: jest.fn()
			}
		};

		// Mock state manager
		const mockStateManager = {
			get: jest.fn().mockImplementation( ( key ) => {
				const state = {
					backgroundVisible: true,
					backgroundOpacity: 1,
					baseWidth: 800,
					baseHeight: 600,
					layers: [
						{ id: 'layer1', type: 'rectangle', visible: true },
						{ id: 'layer2', type: 'text', visible: false }
					],
					filename: 'File:TestImage.jpg',
					currentSetName: 'default'
				};
				return state[ key ];
			} )
		};

		// Mock UI manager
		const mockUIManager = {
			showSpinner: jest.fn(),
			hideSpinner: jest.fn()
		};

		// Create mock editor
		mockEditor = {
			canvasManager: mockCanvasManager,
			stateManager: mockStateManager,
			uiManager: mockUIManager
		};

		// Load ExportController
		require( '../../resources/ext.layers.editor/ExportController.js' );
		ExportController = window.Layers.Editor.ExportController || window.ExportController;

		// Create controller instance
		controller = new ExportController( mockEditor );
	} );

	afterEach( () => {
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should store editor reference', () => {
			expect( controller.editor ).toBe( mockEditor );
		} );
	} );

	describe( 'sanitizeFilename', () => {
		it( 'should return "image" for non-string input', () => {
			expect( controller.sanitizeFilename( null ) ).toBe( 'image' );
			expect( controller.sanitizeFilename( undefined ) ).toBe( 'image' );
			expect( controller.sanitizeFilename( 123 ) ).toBe( 'image' );
		} );

		it( 'should remove Windows forbidden characters', () => {
			expect( controller.sanitizeFilename( 'file<name>.png' ) ).toBe( 'file_name_.png' );
			expect( controller.sanitizeFilename( 'file:name' ) ).toBe( 'file_name' );
			expect( controller.sanitizeFilename( 'file/name' ) ).toBe( 'file_name' );
			expect( controller.sanitizeFilename( 'file\\name' ) ).toBe( 'file_name' );
			expect( controller.sanitizeFilename( 'file|name' ) ).toBe( 'file_name' );
			expect( controller.sanitizeFilename( 'file?name' ) ).toBe( 'file_name' );
			expect( controller.sanitizeFilename( 'file*name' ) ).toBe( 'file_name' );
		} );

		it( 'should remove leading/trailing dots and whitespace', () => {
			expect( controller.sanitizeFilename( '  filename  ' ) ).toBe( 'filename' );
			expect( controller.sanitizeFilename( '...filename...' ) ).toBe( 'filename' );
			expect( controller.sanitizeFilename( '. .filename. .' ) ).toBe( 'filename' );
		} );

		it( 'should truncate long filenames', () => {
			const longName = 'a'.repeat( 300 );
			expect( controller.sanitizeFilename( longName ).length ).toBe( 200 );
		} );

		it( 'should return "image" for empty result', () => {
			expect( controller.sanitizeFilename( '...' ) ).toBe( 'image' );
			expect( controller.sanitizeFilename( '   ' ) ).toBe( 'image' );
		} );
	} );

	describe( 'exportAsImage', () => {
		it( 'should reject if canvas manager not available', async () => {
			controller.editor.canvasManager = null;
			await expect( controller.exportAsImage() ).rejects.toThrow( 'Canvas manager not available' );
		} );

		it( 'should export as PNG by default', async () => {
			const blob = await controller.exportAsImage();
			expect( blob ).toBeInstanceOf( Blob );
		} );

		it( 'should export as JPEG when specified', async () => {
			const blob = await controller.exportAsImage( { format: 'jpeg' } );
			expect( blob ).toBeInstanceOf( Blob );
		} );

		it( 'should respect scale option', async () => {
			const canvas = document.createElement( 'canvas' );
			await controller.exportAsImage( { scale: 2 } );
			// Canvas should be 2x size (1600x1200 for 800x600 base)
			expect( canvas.width ).toBe( 1600 );
			expect( canvas.height ).toBe( 1200 );
		} );

		it( 'should filter visible layers only', async () => {
			await controller.exportAsImage();
			const renderer = mockEditor.canvasManager.renderer;
			expect( renderer.renderLayersToContext ).toHaveBeenCalled();
			const visibleLayers = renderer.renderLayersToContext.mock.calls[ 0 ][ 1 ];
			expect( visibleLayers.length ).toBe( 1 );
			expect( visibleLayers[ 0 ].id ).toBe( 'layer1' );
		} );
	} );

	describe( 'downloadAsImage', () => {
		it( 'should create download link with correct filename', async () => {
			await controller.downloadAsImage();

			// Use setTimeout to allow promise to resolve
			await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

			expect( global.URL.createObjectURL ).toHaveBeenCalled();
			expect( global.mw.notify ).toHaveBeenCalled();
		} );

		it( 'should show and hide spinner during export', async () => {
			await controller.downloadAsImage();

			await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should use custom filename when provided', async () => {
			await controller.downloadAsImage( { filename: 'custom.png' } );

			await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

			expect( global.URL.createObjectURL ).toHaveBeenCalled();
		} );

		it( 'should sanitize generated filename', async () => {
			mockEditor.stateManager.get = jest.fn().mockImplementation( ( key ) => {
				if ( key === 'filename' ) return 'File:Test<Image>.jpg';
				if ( key === 'currentSetName' ) return 'test-set';
				return null;
			} );

			await controller.downloadAsImage();

			await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

			expect( global.URL.createObjectURL ).toHaveBeenCalled();
		} );
	} );

	describe( '_msg helper', () => {
		it( 'should return fallback when mw.message not available', () => {
			global.mw = undefined;
			const result = controller._msg( 'test-key', 'fallback' );
			expect( result ).toBe( 'fallback' );
		} );

		it( 'should return fallback when message does not exist', () => {
			global.mw.message.mockReturnValue( {
				exists: jest.fn().mockReturnValue( false ),
				text: jest.fn()
			} );
			const result = controller._msg( 'nonexistent-key', 'fallback' );
			expect( result ).toBe( 'fallback' );
		} );

		it( 'should return message text when it exists', () => {
			const result = controller._msg( 'test-key', 'fallback' );
			expect( result ).toBe( 'Test message' );
		} );
	} );

	describe( '_showSpinner and _hideSpinner', () => {
		it( 'should call uiManager.showSpinner if available', () => {
			controller._showSpinner();
			expect( mockEditor.uiManager.showSpinner ).toHaveBeenCalled();
		} );

		it( 'should call uiManager.hideSpinner if available', () => {
			controller._hideSpinner();
			expect( mockEditor.uiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'should not throw if uiManager not available', () => {
			controller.editor.uiManager = null;
			expect( () => controller._showSpinner() ).not.toThrow();
			expect( () => controller._hideSpinner() ).not.toThrow();
		} );
	} );
} );
