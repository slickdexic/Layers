/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for SlideManager
 *
 * SlideManager handles slide-specific editor functionality including:
 * - Canvas dimension management and validation
 * - Dirty state tracking
 * - Editor initialization and configuration
 */

describe( 'SlideManager', () => {
	let SlideManager;
	let mockMw;
	let mockApi;

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';

		// Create mock API
		mockApi = {
			postWithToken: jest.fn( () => Promise.resolve( {
				layerssave: { success: 1, layersetid: 123 }
			} ) )
		};

		// Create mock mw object
		mockMw = {
			config: {
				get: jest.fn( ( key ) => {
					const config = {
						wgLayersSlideMode: true,
						wgPageName: 'Test_Slide'
					};
					return config[ key ];
				} )
			},
			log: {
				error: jest.fn(),
				warn: jest.fn()
			},
			Api: jest.fn( () => mockApi ),
			message: jest.fn( ( key ) => ( {
				exists: jest.fn( () => true ),
				text: jest.fn( () => key )
			} ) ),
			loader: {
				using: jest.fn( () => Promise.resolve() )
			}
		};

		// Setup global mw
		global.mw = mockMw;

		// Load SlideManager module - it exports to window
		require( '../../resources/ext.layers.slides/SlideManager.js' );
		SlideManager = window.SlideManager;
	} );

	afterEach( () => {
		delete global.mw;
		delete window.SlideManager;
		delete window.SlideViewer;
		delete window.Layers;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should initialize with config values', () => {
			const config = {
				slideName: 'TestSlide',
				isNew: false,
				canvasWidth: 1024,
				canvasHeight: 768,
				backgroundColor: '#ff0000',
				layers: [ { id: 'layer1' } ],
				revision: 5
			};

			const manager = new SlideManager( config );

			expect( manager.slideName ).toBe( 'TestSlide' );
			expect( manager.isNew ).toBe( false );
			expect( manager.canvasWidth ).toBe( 1024 );
			expect( manager.canvasHeight ).toBe( 768 );
			expect( manager.backgroundColor ).toBe( '#ff0000' );
			expect( manager.layers ).toEqual( [ { id: 'layer1' } ] );
			expect( manager.revision ).toBe( 5 );
			expect( manager.isDirty ).toBe( false );
		} );

		it( 'should use default values when config is minimal', () => {
			const config = { slideName: 'MinimalSlide' };

			const manager = new SlideManager( config );

			expect( manager.canvasWidth ).toBe( 800 );
			expect( manager.canvasHeight ).toBe( 600 );
			expect( manager.backgroundColor ).toBe( '#ffffff' );
			expect( manager.backgroundVisible ).toBe( true );
			expect( manager.backgroundOpacity ).toBe( 1.0 );
			expect( manager.layers ).toEqual( [] );
			expect( manager.revision ).toBe( 0 );
		} );

		it( 'should handle backgroundVisible false correctly', () => {
			const config = {
				slideName: 'TestSlide',
				backgroundVisible: false
			};

			const manager = new SlideManager( config );

			expect( manager.backgroundVisible ).toBe( false );
		} );

		it( 'should handle backgroundOpacity of 0 correctly', () => {
			const config = {
				slideName: 'TestSlide',
				backgroundOpacity: 0
			};

			const manager = new SlideManager( config );

			expect( manager.backgroundOpacity ).toBe( 0 );
		} );
	} );

	describe( 'getCanvasDimensions', () => {
		it( 'should return current dimensions', () => {
			const config = {
				slideName: 'TestSlide',
				canvasWidth: 1920,
				canvasHeight: 1080
			};

			const manager = new SlideManager( config );
			const dimensions = manager.getCanvasDimensions();

			expect( dimensions ).toEqual( { width: 1920, height: 1080 } );
		} );
	} );

	describe( 'setCanvasDimensions', () => {
		it( 'should set valid dimensions', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 1024, 768 );

			expect( manager.canvasWidth ).toBe( 1024 );
			expect( manager.canvasHeight ).toBe( 768 );
			expect( manager.isDirty ).toBe( true );
		} );

		it( 'should clamp dimensions below minimum (50)', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 10, 25 );

			expect( manager.canvasWidth ).toBe( 50 );
			expect( manager.canvasHeight ).toBe( 50 );
		} );

		it( 'should clamp dimensions above maximum (4096)', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 10000, 5000 );

			expect( manager.canvasWidth ).toBe( 4096 );
			expect( manager.canvasHeight ).toBe( 4096 );
		} );

		it( 'should handle string inputs by parsing them', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( '1280', '720' );

			expect( manager.canvasWidth ).toBe( 1280 );
			expect( manager.canvasHeight ).toBe( 720 );
		} );

		it( 'should use default 800x600 for invalid/NaN inputs', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 'invalid', null );

			expect( manager.canvasWidth ).toBe( 800 );
			expect( manager.canvasHeight ).toBe( 600 );
		} );

		it( 'should use default 800x600 for undefined inputs', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( undefined, undefined );

			expect( manager.canvasWidth ).toBe( 800 );
			expect( manager.canvasHeight ).toBe( 600 );
		} );

		it( 'should update canvas element dimensions when canvas exists', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			// Create mock canvas
			manager.canvas = document.createElement( 'canvas' );
			manager.canvas.width = 100;
			manager.canvas.height = 100;

			manager.setCanvasDimensions( 1024, 768 );

			expect( manager.canvas.width ).toBe( 1024 );
			expect( manager.canvas.height ).toBe( 768 );
		} );

		it( 'should update canvas container style when container exists', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			// Create mock container
			manager.canvasContainer = document.createElement( 'div' );

			manager.setCanvasDimensions( 1024, 768 );

			expect( manager.canvasContainer.style.width ).toBe( '1024px' );
			expect( manager.canvasContainer.style.height ).toBe( '768px' );
		} );

		it( 'should call editor.setCanvasSize when editor exists', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			// Create mock editor
			manager.editor = {
				setCanvasSize: jest.fn()
			};

			manager.setCanvasDimensions( 1024, 768 );

			expect( manager.editor.setCanvasSize ).toHaveBeenCalledWith( 1024, 768 );
		} );

		it( 'should set isDirty to true', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			expect( manager.isDirty ).toBe( false );

			manager.setCanvasDimensions( 1024, 768 );

			expect( manager.isDirty ).toBe( true );
		} );

		it( 'should handle edge case at exact minimum', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 50, 50 );

			expect( manager.canvasWidth ).toBe( 50 );
			expect( manager.canvasHeight ).toBe( 50 );
		} );

		it( 'should handle edge case at exact maximum', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 4096, 4096 );

			expect( manager.canvasWidth ).toBe( 4096 );
			expect( manager.canvasHeight ).toBe( 4096 );
		} );

		it( 'should handle negative numbers by clamping to minimum', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( -100, -500 );

			expect( manager.canvasWidth ).toBe( 50 );
			expect( manager.canvasHeight ).toBe( 50 );
		} );

		it( 'should handle zero by using default 800x600', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 0, 0 );

			expect( manager.canvasWidth ).toBe( 800 );
			expect( manager.canvasHeight ).toBe( 600 );
		} );

		it( 'should handle float inputs by parsing to int', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			manager.setCanvasDimensions( 1024.7, 768.3 );

			expect( manager.canvasWidth ).toBe( 1024 );
			expect( manager.canvasHeight ).toBe( 768 );
		} );
	} );

	describe( 'handleDirty', () => {
		it( 'should update isDirty state', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			expect( manager.isDirty ).toBe( false );

			manager.handleDirty( true );

			expect( manager.isDirty ).toBe( true );

			manager.handleDirty( false );

			expect( manager.isDirty ).toBe( false );
		} );
	} );

	describe( 'createEditorStructure', () => {
		it( 'should create canvas container and canvas elements', () => {
			const manager = new SlideManager( {
				slideName: 'TestSlide',
				canvasWidth: 1024,
				canvasHeight: 768
			} );

			const container = document.createElement( 'div' );
			manager.createEditorStructure( container );

			expect( manager.container ).toBe( container );
			expect( manager.canvasContainer ).toBeDefined();
			expect( manager.canvas ).toBeDefined();
			expect( manager.canvas.width ).toBe( 1024 );
			expect( manager.canvas.height ).toBe( 768 );
		} );

		it( 'should set correct CSS classes', () => {
			const manager = new SlideManager( { slideName: 'TestSlide' } );

			const container = document.createElement( 'div' );
			manager.createEditorStructure( container );

			expect( manager.canvasContainer.classList.contains( 'layers-canvas-container' ) ).toBe( true );
			expect( manager.canvasContainer.classList.contains( 'layers-slide-canvas-container' ) ).toBe( true );
			expect( manager.canvas.classList.contains( 'layers-canvas' ) ).toBe( true );
		} );
	} );
} );

describe( 'SlideViewer', () => {
	let SlideViewer;
	let mockMw;

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';

		mockMw = {
			config: {
				get: jest.fn()
			},
			log: {
				error: jest.fn(),
				warn: jest.fn()
			}
		};

		global.mw = mockMw;

		require( '../../resources/ext.layers.slides/SlideManager.js' );
		SlideViewer = window.SlideViewer;
	} );

	afterEach( () => {
		delete global.mw;
		delete window.SlideManager;
		delete window.SlideViewer;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should parse container data attributes', () => {
			const container = document.createElement( 'div' );
			container.dataset.slideName = 'TestSlide';
			container.dataset.canvasWidth = '1024';
			container.dataset.canvasHeight = '768';
			container.dataset.backgroundColor = '#ff0000';

			const viewer = new SlideViewer( container );

			expect( viewer.slideName ).toBe( 'TestSlide' );
			expect( viewer.canvasWidth ).toBe( 1024 );
			expect( viewer.canvasHeight ).toBe( 768 );
			expect( viewer.backgroundColor ).toBe( '#ff0000' );
		} );

		it( 'should use default values for missing attributes', () => {
			const container = document.createElement( 'div' );

			const viewer = new SlideViewer( container );

			expect( viewer.canvasWidth ).toBe( 800 );
			expect( viewer.canvasHeight ).toBe( 600 );
			expect( viewer.backgroundColor ).toBe( '' );
		} );

		it( 'should parse layer data from JSON attribute', () => {
			const container = document.createElement( 'div' );
			const layerData = {
				layers: [ { id: 'layer1', type: 'rectangle' } ]
			};
			container.dataset.layers = JSON.stringify( layerData );

			const viewer = new SlideViewer( container );

			expect( viewer.layerData ).toEqual( layerData );
		} );

		it( 'should handle invalid JSON in layers attribute gracefully', () => {
			const container = document.createElement( 'div' );
			container.dataset.layers = 'not valid json';

			const viewer = new SlideViewer( container );

			expect( viewer.layerData ).toBe( null );
		} );
	} );
} );
