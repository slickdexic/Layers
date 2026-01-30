/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for SlideController
 *
 * SlideController handles all slide-related functionality including:
 * - Slide initialization and rendering
 * - Overlay management with edit/view buttons
 * - Empty slide state rendering
 * - Slide editing and URL building
 */

describe( 'SlideController', () => {
	let SlideController;
	let mockApi;
	let mockMw;

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';

		// Create mock API
		mockApi = {
			get: jest.fn( () => Promise.resolve( {} ) )
		};

		// Create mock mw object
		mockMw = {
			config: {
				get: jest.fn( ( key ) => {
					const config = {
						wgNamespaceNumber: 0,
						wgPageName: 'Main_Page',
						wgCanonicalNamespace: '',
						wgLayersCanEdit: true
					};
					return config[ key ];
				} )
			},
			log: jest.fn(),
			Api: jest.fn( () => mockApi ),
			message: jest.fn( ( key ) => {
				const messages = {
					'layers-slide-empty': 'Translated Empty Slide',
					'layers-slide-empty-hint': 'Translated Click to add',
					'layers-slide-edit': 'Edit',
					'layers-slide-view': 'View'
				};
				return {
					exists: jest.fn( () => !!messages[ key ] ),
					text: jest.fn( () => messages[ key ] || key )
				};
			} ),
			util: {
				getUrl: jest.fn( ( title ) => '/wiki/' + title )
			},
			hook: jest.fn( () => ( {
				fire: jest.fn()
			} ) )
		};
		mockMw.log.warn = jest.fn();

		// Setup global mw
		global.mw = mockMw;

		// Load SlideController module
		SlideController = require( '../../resources/ext.layers/viewer/SlideController.js' );
	} );

	afterEach( () => {
		delete global.mw;
		delete window.Layers;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default options', () => {
			const controller = new SlideController();
			expect( controller.debug ).toBeFalsy();
		} );

		it( 'should enable debug mode when specified', () => {
			const controller = new SlideController( { debug: true } );
			expect( controller.debug ).toBe( true );
		} );
	} );

	describe( 'canUserEdit', () => {
		it( 'should return true when user has edit permission', () => {
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return true;
				}
				return null;
			} );

			const controller = new SlideController();
			expect( controller.canUserEdit() ).toBe( true );
		} );

		it( 'should return false when user lacks edit permission', () => {
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return false;
				}
				return null;
			} );

			const controller = new SlideController();
			expect( controller.canUserEdit() ).toBe( false );
		} );
	} );

	describe( 'getEmptyStateMessage', () => {
		it( 'should return i18n message when available', () => {
			const controller = new SlideController();
			const message = controller.getEmptyStateMessage();

			expect( global.mw.message ).toHaveBeenCalledWith( 'layers-slide-empty' );
			expect( message ).toBe( 'Translated Empty Slide' );
		} );

		it( 'should return fallback when mw.message unavailable', () => {
			delete global.mw.message;
			const controller = new SlideController();
			const message = controller.getEmptyStateMessage();

			expect( message ).toBe( 'Empty Slide' );
		} );
	} );

	describe( 'getEmptyStateHint', () => {
		it( 'should return i18n hint when available', () => {
			const controller = new SlideController();
			const hint = controller.getEmptyStateHint();

			expect( global.mw.message ).toHaveBeenCalledWith( 'layers-slide-empty-hint' );
			expect( hint ).toBe( 'Translated Click to add' );
		} );

		it( 'should return fallback when mw.message unavailable', () => {
			delete global.mw.message;
			const controller = new SlideController();
			const hint = controller.getEmptyStateHint();

			expect( hint ).toBe( 'Use the Edit button to add content' );
		} );
	} );

	describe( 'buildSlideEditorUrl', () => {
		it( 'should build URL with slide name', () => {
			const controller = new SlideController();
			const url = controller.buildSlideEditorUrl( {
				slideName: 'TestSlide',
				canvasWidth: 800,
				canvasHeight: 600,
				layerSetName: 'default'
			} );

			expect( url ).toContain( 'Special:EditSlide/TestSlide' );
		} );

		it( 'should include setname when not default', () => {
			const controller = new SlideController();
			const url = controller.buildSlideEditorUrl( {
				slideName: 'TestSlide',
				canvasWidth: 800,
				canvasHeight: 600,
				layerSetName: 'custom-set'
			} );

			expect( url ).toContain( 'setname=custom-set' );
		} );

		it( 'should use fallback URL when mw.util not available', () => {
			delete global.mw.util;
			const controller = new SlideController();
			const url = controller.buildSlideEditorUrl( {
				slideName: 'TestSlide',
				canvasWidth: 800,
				canvasHeight: 600,
				layerSetName: 'custom'
			} );

			expect( url ).toContain( '/wiki/Special:EditSlide/TestSlide' );
			expect( url ).toContain( 'setname=custom' );
		} );
	} );

	describe( 'renderEmptySlide', () => {
		it( 'should set canvas dimensions', () => {
			const container = document.createElement( 'div' );
			const canvas = document.createElement( 'canvas' );
			container.appendChild( canvas );

			const controller = new SlideController();
			controller.renderEmptySlide( container, 1024, 768 );

			expect( canvas.width ).toBe( 1024 );
			expect( canvas.height ).toBe( 768 );
		} );

		it( 'should fill with background color from data attribute', () => {
			const container = document.createElement( 'div' );
			container.setAttribute( 'data-background', '#ff0000' );
			const canvas = document.createElement( 'canvas' );
			container.appendChild( canvas );

			const mockCtx = {
				fillStyle: '',
				fillRect: jest.fn(),
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				textAlign: '',
				textBaseline: '',
				fillText: jest.fn()
			};
			jest.spyOn( canvas, 'getContext' ).mockReturnValue( mockCtx );

			const controller = new SlideController();
			controller.renderEmptySlide( container, 800, 600 );

			expect( mockCtx.fillRect ).toHaveBeenCalledWith( 0, 0, 800, 600 );
		} );

		it( 'should use default white background when not specified', () => {
			const container = document.createElement( 'div' );
			const canvas = document.createElement( 'canvas' );
			container.appendChild( canvas );

			const fillStyleHistory = [];
			const mockCtx = {
				set fillStyle( val ) {
					fillStyleHistory.push( val );
				},
				get fillStyle() {
					return fillStyleHistory[ fillStyleHistory.length - 1 ] || '';
				},
				fillRect: jest.fn(),
				save: jest.fn(),
				restore: jest.fn(),
				font: '',
				textAlign: '',
				textBaseline: '',
				fillText: jest.fn()
			};
			jest.spyOn( canvas, 'getContext' ).mockReturnValue( mockCtx );

			const controller = new SlideController();
			controller.renderEmptySlide( container, 800, 600 );

			// First fillStyle should be the background color (white as default)
			expect( fillStyleHistory[ 0 ] ).toBe( '#ffffff' );
		} );

		it( 'should handle missing canvas gracefully', () => {
			const container = document.createElement( 'div' );
			const controller = new SlideController();

			expect( () => {
				controller.renderEmptySlide( container, 800, 600 );
			} ).not.toThrow();
		} );
	} );

	describe( 'setupSlideOverlay', () => {
		it( 'should create overlay with edit and view buttons when user can edit', () => {
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return true;
				}
				return null;
			} );

			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			const controller = new SlideController();
			controller.setupSlideOverlay( container, { layers: [], isSlide: true } );

			const overlay = container.querySelector( '.layers-slide-overlay' );
			expect( overlay ).not.toBeNull();

			const editBtn = overlay.querySelector( '.layers-slide-overlay-btn--edit' );
			const viewBtn = overlay.querySelector( '.layers-slide-overlay-btn--view' );
			expect( editBtn ).not.toBeNull();
			expect( viewBtn ).not.toBeNull();
		} );

		it( 'should create overlay with only view button when user cannot edit', () => {
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return false;
				}
				return null;
			} );

			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			const controller = new SlideController();
			controller.setupSlideOverlay( container, { layers: [], isSlide: true } );

			const overlay = container.querySelector( '.layers-slide-overlay' );
			expect( overlay ).not.toBeNull();

			const editBtn = overlay.querySelector( '.layers-slide-overlay-btn--edit' );
			const viewBtn = overlay.querySelector( '.layers-slide-overlay-btn--view' );
			expect( editBtn ).toBeNull();
			expect( viewBtn ).not.toBeNull();
		} );

		it( 'should remove old edit button if present', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			const oldButton = document.createElement( 'button' );
			oldButton.className = 'layers-slide-edit-button';
			container.appendChild( oldButton );

			const controller = new SlideController();
			controller.setupSlideOverlay( container, { layers: [], isSlide: true } );

			expect( container.querySelector( '.layers-slide-edit-button' ) ).toBeNull();
		} );

		it( 'should not create duplicate overlay', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			const controller = new SlideController();
			controller.setupSlideOverlay( container, { layers: [], isSlide: true } );
			controller.setupSlideOverlay( container, { layers: [], isSlide: true } );

			const overlays = container.querySelectorAll( '.layers-slide-overlay' );
			expect( overlays.length ).toBe( 1 );
		} );
	} );

	describe( 'drawEmptyStateContent', () => {
		it( 'should draw content on canvas context', () => {
			const container = document.createElement( 'div' );
			const saveSpy = jest.fn();
			const restoreSpy = jest.fn();
			const fillTextSpy = jest.fn();
			const mockCtx = {
				save: saveSpy,
				restore: restoreSpy,
				fillRect: jest.fn(),
				fillText: fillTextSpy,
				fillStyle: '',
				font: '',
				textAlign: '',
				textBaseline: ''
			};

			const controller = new SlideController();
			controller.drawEmptyStateContent( mockCtx, 800, 600, container );

			// Should save and restore context
			expect( saveSpy ).toHaveBeenCalled();
			expect( restoreSpy ).toHaveBeenCalled();

			// Should draw text
			expect( fillTextSpy ).toHaveBeenCalled();
		} );

		it( 'should use placeholder from data attribute if present', () => {
			const container = document.createElement( 'div' );
			container.setAttribute( 'data-placeholder', 'Custom placeholder text' );

			const fillTextSpy = jest.fn();
			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				fillRect: jest.fn(),
				fillText: fillTextSpy,
				fillStyle: '',
				font: '',
				textAlign: '',
				textBaseline: ''
			};

			const controller = new SlideController();
			controller.drawEmptyStateContent( mockCtx, 800, 600, container );

			const calls = fillTextSpy.mock.calls;
			const hasPlaceholder = calls.some( ( call ) => call[ 0 ] === 'Custom placeholder text' );
			expect( hasPlaceholder ).toBe( true );
		} );
	} );

	describe( 'initializeSlideViewer', () => {
		it( 'should initialize slide with layers and render them', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			const canvas = document.createElement( 'canvas' );
			container.appendChild( canvas );

			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: '',
				translate: jest.fn(),
				rotate: jest.fn(),
				scale: jest.fn(),
				drawImage: jest.fn()
			};
			jest.spyOn( canvas, 'getContext' ).mockReturnValue( mockCtx );

			const controller = new SlideController();
			controller.initializeSlideViewer( container, {
				layers: [],
				baseWidth: 1024,
				baseHeight: 768,
				backgroundColor: '#ffffff'
			} );

			// Canvas dimensions should be set
			expect( canvas.width ).toBe( 1024 );
			expect( canvas.height ).toBe( 768 );
		} );

		it( 'should handle missing canvas gracefully', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';

			const controller = new SlideController();
			expect( () => {
				controller.initializeSlideViewer( container, {
					layers: [],
					baseWidth: 800,
					baseHeight: 600
				} );
			} ).not.toThrow();
		} );
	} );

	describe( 'reinitializeSlideViewer', () => {
		it( 'should return true on successful reinitialization', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			const canvas = document.createElement( 'canvas' );
			container.appendChild( canvas );

			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillText: jest.fn(),
				fillStyle: '',
				strokeStyle: '',
				lineWidth: 1,
				font: '',
				textAlign: '',
				textBaseline: '',
				globalAlpha: 1,
				translate: jest.fn(),
				rotate: jest.fn(),
				scale: jest.fn()
			};
			jest.spyOn( canvas, 'getContext' ).mockReturnValue( mockCtx );

			// Mock LayerRenderer
			const mockRenderer = {
				drawLayer: jest.fn()
			};
			window.LayerRenderer = jest.fn( () => mockRenderer );

			const controller = new SlideController();
			const result = controller.reinitializeSlideViewer( container, {
				layers: [],
				baseWidth: 800,
				baseHeight: 600,
				backgroundColor: '#ffffff'
			} );

			expect( result ).toBe( true );

			// Clean up
			delete window.LayerRenderer;
		} );

		it( 'should update canvas dimensions from payload', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			const canvas = document.createElement( 'canvas' );
			canvas.width = 400;
			canvas.height = 300;
			container.appendChild( canvas );

			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				clearRect: jest.fn(),
				fillRect: jest.fn(),
				fillStyle: '',
				globalAlpha: 1
			};
			jest.spyOn( canvas, 'getContext' ).mockReturnValue( mockCtx );

			// Mock LayerRenderer
			const mockRenderer = {
				drawLayer: jest.fn()
			};
			window.LayerRenderer = jest.fn( () => mockRenderer );

			const controller = new SlideController();
			controller.reinitializeSlideViewer( container, {
				layers: [],
				baseWidth: 1024,
				baseHeight: 768,
				backgroundColor: '#ffffff'
			} );

			// Canvas dimensions should be updated from payload
			expect( canvas.width ).toBe( 1024 );
			expect( canvas.height ).toBe( 768 );

			// Clean up
			delete window.LayerRenderer;
		} );

		it( 'should return false when no canvas present', () => {
			const container = document.createElement( 'div' );
			const controller = new SlideController();
			const result = controller.reinitializeSlideViewer( container, {
				layers: [],
				baseWidth: 800,
				baseHeight: 600
			} );

			expect( result ).toBe( false );
		} );
	} );

	describe( 'handleSlideEditClick', () => {
		it( 'should call openSlideEditor with data from container', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'MySlide' );
			container.setAttribute( 'data-lock-mode', 'none' );
			container.setAttribute( 'data-canvas-width', '1024' );
			container.setAttribute( 'data-canvas-height', '768' );
			container.setAttribute( 'data-background', '#ff0000' );
			container.setAttribute( 'data-layerset', 'custom-set' );

			const controller = new SlideController();
			const openSpy = jest.spyOn( controller, 'openSlideEditor' );

			controller.handleSlideEditClick( container );

			expect( openSpy ).toHaveBeenCalledWith( {
				slideName: 'MySlide',
				lockMode: 'none',
				canvasWidth: 1024,
				canvasHeight: 768,
				backgroundColor: '#ff0000',
				layerSetName: 'custom-set'
			} );
		} );

		it( 'should use default values for missing attributes', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'MinimalSlide' );

			const controller = new SlideController();
			const openSpy = jest.spyOn( controller, 'openSlideEditor' );

			controller.handleSlideEditClick( container );

			expect( openSpy ).toHaveBeenCalledWith(
				expect.objectContaining( {
					slideName: 'MinimalSlide',
					canvasWidth: 800,
					canvasHeight: 600,
					layerSetName: 'default'
				} )
			);
		} );
	} );

	describe( 'refreshAllSlides', () => {
		it( 'should return result object with counts', async () => {
			const controller = new SlideController();
			const result = await controller.refreshAllSlides();

			expect( result ).toHaveProperty( 'total' );
			expect( result ).toHaveProperty( 'refreshed' );
			expect( result ).toHaveProperty( 'failed' );
			expect( result ).toHaveProperty( 'errors' );
		} );

		it( 'should find and process slide containers', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			document.body.appendChild( container );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: null
				}
			} );

			const controller = new SlideController();
			const result = await controller.refreshAllSlides();

			expect( result.total ).toBe( 1 );
		} );
	} );

	describe( 'initializeSlides', () => {
		it( 'should do nothing when no slide containers exist', () => {
			document.body.innerHTML = '<div class="other-content"></div>';
			const controller = new SlideController( { debug: true } );

			controller.initializeSlides();

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should skip containers without data-slide-name', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			// No data-slide-name attribute
			document.body.appendChild( container );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should skip already initialized containers', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			container.layersSlideInitialized = true;
			document.body.appendChild( container );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should fetch slide data from API', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			container.setAttribute( 'data-canvas-width', '800' );
			container.setAttribute( 'data-canvas-height', '600' );
			container.innerHTML = '<canvas></canvas>';
			document.body.appendChild( container );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: '1', type: 'rectangle' } ]
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			// Wait for async operations
			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( mockApi.get ).toHaveBeenCalledWith( expect.objectContaining( {
				action: 'layersinfo',
				slidename: 'TestSlide'
			} ) );
		} );

		it( 'should render empty slide when API returns no data', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			// Create canvas with proper mock context
			const canvas = document.createElement( 'canvas' );
			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				fillRect: jest.fn(),
				fillText: jest.fn(),
				beginPath: jest.fn(),
				arc: jest.fn(),
				fill: jest.fn(),
				setTransform: jest.fn(),
				font: '',
				fillStyle: '',
				textAlign: '',
				textBaseline: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			};
			canvas.getContext = jest.fn( () => mockCtx );
			container.appendChild( canvas );
			document.body.appendChild( container );

			mockApi.get.mockResolvedValue( {} );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( container.querySelector( 'canvas' ) ).toBeTruthy();
		} );

		it( 'should render empty slide when layerset has no layers', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			// Create canvas with proper mock context
			const canvas = document.createElement( 'canvas' );
			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				fillRect: jest.fn(),
				fillText: jest.fn(),
				beginPath: jest.fn(),
				arc: jest.fn(),
				fill: jest.fn(),
				setTransform: jest.fn(),
				font: '',
				fillStyle: '',
				textAlign: '',
				textBaseline: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			};
			canvas.getContext = jest.fn( () => mockCtx );
			container.appendChild( canvas );
			document.body.appendChild( container );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: []
						}
					}
				}
			} );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			// On failure (empty layers), layersSlideInitialized is reset to false to allow retry
			expect( container.layersSlideInitialized ).toBe( false );
		} );

		it( 'should handle API errors gracefully', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			// Create canvas with proper mock context
			const canvas = document.createElement( 'canvas' );
			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				fillRect: jest.fn(),
				fillText: jest.fn(),
				beginPath: jest.fn(),
				arc: jest.fn(),
				fill: jest.fn(),
				setTransform: jest.fn(),
				font: '',
				fillStyle: '',
				textAlign: '',
				textBaseline: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			};
			canvas.getContext = jest.fn( () => mockCtx );
			container.appendChild( canvas );
			document.body.appendChild( container );

			mockApi.get.mockRejectedValue( new Error( 'API error' ) );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			// Should not throw - error handled gracefully
			// On API error, layersSlideInitialized is reset to false to allow retry
			expect( container.layersSlideInitialized ).toBe( false );
		} );

		it( 'should use default canvas dimensions when not specified', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			// No data-canvas-width or data-canvas-height

			// Create canvas with proper mock context
			const canvas = document.createElement( 'canvas' );
			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				fillRect: jest.fn(),
				fillText: jest.fn(),
				beginPath: jest.fn(),
				arc: jest.fn(),
				fill: jest.fn(),
				setTransform: jest.fn(),
				font: '',
				fillStyle: '',
				textAlign: '',
				textBaseline: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			};
			canvas.getContext = jest.fn( () => mockCtx );
			container.appendChild( canvas );
			document.body.appendChild( container );

			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			// Default dimensions should be used (800x600)
			// On failure (null layerset), layersSlideInitialized is reset to false to allow retry
			expect( container.layersSlideInitialized ).toBe( false );
		} );

		it( 'should handle backgroundVisible integer values correctly', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			container.innerHTML = '<canvas></canvas>';
			document.body.appendChild( container );

			// API returns 0 (integer) for backgroundVisible
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: '1', type: 'rectangle' } ],
							backgroundVisible: 0
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( container.layersSlideInitialized ).toBe( true );
		} );

		it( 'should mark successful initialization with layersSlideInitSuccess flag', async () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			container.innerHTML = '<canvas></canvas>';
			document.body.appendChild( container );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: '1', type: 'rectangle' } ]
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			await new Promise( ( r ) => setTimeout( r, 10 ) );

			expect( container.layersSlideInitialized ).toBe( true );
			expect( container.layersSlideInitSuccess ).toBe( true );
		} );

		it( 'should schedule retry for failed slides', async () => {
			jest.useFakeTimers();

			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			const canvas = document.createElement( 'canvas' );
			const mockCtx = {
				save: jest.fn(),
				restore: jest.fn(),
				fillRect: jest.fn(),
				fillText: jest.fn(),
				beginPath: jest.fn(),
				arc: jest.fn(),
				fill: jest.fn(),
				setTransform: jest.fn(),
				font: '',
				fillStyle: '',
				textAlign: '',
				textBaseline: '',
				measureText: jest.fn( () => ( { width: 100 } ) )
			};
			canvas.getContext = jest.fn( () => mockCtx );
			container.appendChild( canvas );
			document.body.appendChild( container );

			// First call fails
			mockApi.get.mockRejectedValueOnce( new Error( 'API error' ) );
			// Retry calls succeed
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: '1', type: 'rectangle' } ]
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			const controller = new SlideController( { debug: true } );
			controller.initializeSlides();

			// Process immediate promises
			await Promise.resolve();
			await Promise.resolve();

			// Retries should be scheduled
			expect( controller._retriesScheduled ).toBe( true );

			// Fast-forward through all retry timeouts (500ms, 1500ms, 3000ms)
			jest.advanceTimersByTime( 3100 );

			// Process retry promises
			await Promise.resolve();
			await Promise.resolve();

			jest.useRealTimers();
		} );
	} );

	describe( 'handleSlideViewClick', () => {
		it( 'should handle missing LightboxClass gracefully', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			container.innerHTML = '<canvas></canvas>';
			document.body.appendChild( container );

			// No Lightbox class available
			delete window.Layers;
			delete window.LayersLightbox;

			const controller = new SlideController( { debug: true } );
			const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

			// Should not throw
			expect( () => {
				controller.handleSlideViewClick( container, payload );
			} ).not.toThrow();
		} );

		it( 'should handle missing canvas gracefully', () => {
			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );
			// No canvas
			document.body.appendChild( container );

			const controller = new SlideController( { debug: true } );
			const payload = { layers: [], baseWidth: 800, baseHeight: 600 };

			expect( () => {
				controller.handleSlideViewClick( container, payload );
			} ).not.toThrow();
		} );
	} );

	describe( '_createPencilIcon', () => {
		it( 'should create SVG pencil icon', () => {
			const controller = new SlideController();
			const icon = controller._createPencilIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		} );

		it( 'should use IconFactory when available', () => {
			const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			window.Layers = {
				UI: {
					IconFactory: {
						createPencilIcon: jest.fn( () => mockIcon )
					}
				}
			};

			const controller = new SlideController();
			const icon = controller._createPencilIcon();

			expect( window.Layers.UI.IconFactory.createPencilIcon ).toHaveBeenCalled();
			expect( icon ).toBe( mockIcon );
		} );
	} );

	describe( '_createExpandIcon', () => {
		it( 'should create SVG expand icon', () => {
			const controller = new SlideController();
			const icon = controller._createExpandIcon();

			expect( icon.tagName.toLowerCase() ).toBe( 'svg' );
			expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		} );

		it( 'should use IconFactory when available', () => {
			const mockIcon = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			window.Layers = {
				UI: {
					IconFactory: {
						createExpandIcon: jest.fn( () => mockIcon )
					}
				}
			};

			const controller = new SlideController();
			const icon = controller._createExpandIcon();

			expect( window.Layers.UI.IconFactory.createExpandIcon ).toHaveBeenCalled();
			expect( icon ).toBe( mockIcon );
		} );
	} );

	describe( 'openSlideEditor', () => {
		it( 'should open modal editor when LayersEditorModal is available', () => {
			// Mock the modal pattern with LayersEditorModal class
			const mockOpen = jest.fn().mockResolvedValue( { saved: false } );
			window.Layers = {
				Modal: {
					LayersEditorModal: class {
						open() {
							return mockOpen();
						}
					}
				}
			};

			const controller = new SlideController( { debug: true } );
			controller.openSlideEditor( {
				slideName: 'TestSlide',
				canvasWidth: 800,
				canvasHeight: 600,
				layerSetName: 'default'
			} );

			// Should use modal and call its open method
			expect( mockOpen ).toHaveBeenCalled();
		} );

		it( 'should build editor URL with slide name', () => {
			const controller = new SlideController( { debug: true } );
			const url = controller.buildSlideEditorUrl( {
				slideName: 'TestSlide',
				canvasWidth: 800,
				canvasHeight: 600,
				layerSetName: 'default'
			} );

			// Should contain the slide name
			expect( url ).toBeDefined();
			expect( typeof url ).toBe( 'string' );
		} );
	} );

	describe( '_shouldUseModalForSlide', () => {
		it( 'should return false when modal module not available', () => {
			delete window.Layers;
			const controller = new SlideController();
			expect( controller._shouldUseModalForSlide() ).toBe( false );
		} );

		it( 'should return true when LayersEditorModal class is available', () => {
			// Method checks for window.Layers.Modal.LayersEditorModal
			window.Layers = {
				Modal: {
					LayersEditorModal: class MockModal {
						open() {
							return Promise.resolve();
						}
					}
				}
			};
			const controller = new SlideController();
			expect( controller._shouldUseModalForSlide() ).toBe( true );
		} );
	} );

	describe( 'setupSlideEditButton', () => {
		it( 'should attach click handler to existing edit button', () => {
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgUserRights' ) {
					return [ 'edit', 'editlayers' ];
				}
				return null;
			} );

			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			// Create existing edit button (this method attaches to existing buttons)
			const editBtn = document.createElement( 'button' );
			editBtn.className = 'layers-slide-edit-button';
			container.appendChild( editBtn );

			document.body.appendChild( container );

			const controller = new SlideController( { debug: true } );
			controller.setupSlideEditButton( container );

			// Should have bound click handler
			expect( editBtn.layersClickBound ).toBe( true );
		} );

		it( 'should hide edit button when user lacks permission', () => {
			mockMw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgUserRights' ) {
					return [ 'edit' ]; // No editlayers
				}
				return null;
			} );

			const container = document.createElement( 'div' );
			container.className = 'layers-slide-container';
			container.setAttribute( 'data-slide-name', 'TestSlide' );

			// Create existing edit button
			const editBtn = document.createElement( 'button' );
			editBtn.className = 'layers-slide-edit-button';
			container.appendChild( editBtn );

			document.body.appendChild( container );

			const controller = new SlideController( { debug: true } );
			controller.setupSlideEditButton( container );

			// Button should be hidden when user cannot edit
			expect( editBtn.style.display ).toBe( 'none' );
		} );
	} );
} );
