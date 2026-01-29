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
				fillStyle: '',
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
} );
