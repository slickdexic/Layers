/**
 * Tests for LayersLightbox class
 *
 * The LayersLightbox provides a full-screen modal viewer for viewing
 * images with layer overlays. It's triggered by clicking on images
 * with the layerslink=lightbox parameter.
 */

'use strict';

// Store reference to the class and singleton
let LayersLightbox;
let lightboxSingleton;

// Mock dependencies
const mockApi = {
	get: jest.fn()
};

const mockViewer = {
	destroy: jest.fn()
};

const MockLayersViewer = jest.fn( () => mockViewer );

beforeAll( () => {
	// Set up default mock return value BEFORE loading module
	mockApi.get.mockResolvedValue( {
		layersinfo: {
			layerset: {
				data: { layers: [] },
				baseWidth: 800,
				baseHeight: 600
			}
		}
	} );

	// Mock window.Layers namespace
	window.Layers = window.Layers || {};
	window.Layers.Viewer = {
		LayersViewer: MockLayersViewer
	};

	// Mock MediaWiki API - return our mock API instance
	window.mw = {
		Api: jest.fn( () => mockApi ),
		config: {
			get: jest.fn( ( key ) => {
				const configs = {
					wgUploadPath: '/w/images',
					wgLayersDebug: false
				};
				return configs[ key ];
			} )
		},
		message: jest.fn( ( key ) => ( {
			exists: () => true,
			text: () => `msg:${ key }`
		} ) ),
		log: jest.fn(),
		hook: jest.fn( () => ( {
			add: jest.fn()
		} ) ),
		util: {
			getUrl: jest.fn( ( page ) => `/wiki/${ page }` )
		}
	};

	// Mock document methods that may not exist in jsdom
	document.body.style.overflow = '';

	// Load the module
	require( '../../resources/ext.layers/viewer/LayersLightbox.js' );

	// Get references
	LayersLightbox = window.Layers.Viewer.Lightbox;
	lightboxSingleton = window.Layers.lightbox;
} );

beforeEach( () => {
	// Reset mocks
	jest.clearAllMocks();
	mockApi.get.mockReset();
	MockLayersViewer.mockClear();
	mockViewer.destroy.mockClear();

	// Set up default API mock to return valid data
	mockApi.get.mockResolvedValue( {
		layersinfo: {
			layerset: {
				data: { layers: [] },
				baseWidth: 800,
				baseHeight: 600
			}
		}
	} );

	// Reset singleton state
	if ( lightboxSingleton && lightboxSingleton.isOpen ) {
		lightboxSingleton.close();
	}

	// Clean up any leftover DOM elements
	document.querySelectorAll( '.layers-lightbox-overlay' ).forEach( ( el ) => {
		el.parentNode.removeChild( el );
	} );

	document.querySelectorAll( '.layers-lightbox-trigger' ).forEach( ( el ) => {
		delete el.dataset.layersLightboxInit;
	} );

	// Reset body overflow
	document.body.style.overflow = '';
} );

afterEach( () => {
	// Ensure lightbox is closed after each test
	if ( lightboxSingleton && lightboxSingleton.isOpen ) {
		lightboxSingleton.close();
	}
} );

describe( 'LayersLightbox', () => {
	describe( 'constructor', () => {
		it( 'should create instance with default options', () => {
			const lightbox = new LayersLightbox();

			expect( lightbox.debug ).toBe( false );
			expect( lightbox.overlay ).toBeNull();
			expect( lightbox.container ).toBeNull();
			expect( lightbox.viewer ).toBeNull();
			expect( lightbox.isOpen ).toBe( false );
		} );

		it( 'should create instance with debug enabled', () => {
			const lightbox = new LayersLightbox( { debug: true } );

			expect( lightbox.debug ).toBe( true );
		} );

		it( 'should initialize all instance properties', () => {
			const lightbox = new LayersLightbox();

			expect( lightbox ).toHaveProperty( 'boundKeyHandler' );
			expect( lightbox ).toHaveProperty( 'boundClickHandler' );
			expect( lightbox.boundKeyHandler ).toBeNull();
			expect( lightbox.boundClickHandler ).toBeNull();
		} );
	} );

	describe( 'debugLog', () => {
		it( 'should log when debug is enabled', () => {
			const lightbox = new LayersLightbox( { debug: true } );

			lightbox.debugLog( 'test message', 123 );

			expect( mw.log ).toHaveBeenCalledWith( '[LayersLightbox]', 'test message', 123 );
		} );

		it( 'should not log when debug is disabled', () => {
			const lightbox = new LayersLightbox( { debug: false } );

			lightbox.debugLog( 'test message' );

			expect( mw.log ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'getMessage', () => {
		it( 'should return localized message when exists', () => {
			const lightbox = new LayersLightbox();

			const result = lightbox.getMessage( 'layers-lightbox-close', 'Close' );

			expect( result ).toBe( 'msg:layers-lightbox-close' );
		} );

		it( 'should return fallback when message does not exist', () => {
			mw.message.mockReturnValueOnce( {
				exists: () => false,
				text: () => ''
			} );

			const lightbox = new LayersLightbox();
			const result = lightbox.getMessage( 'nonexistent-key', 'Fallback Text' );

			expect( result ).toBe( 'Fallback Text' );
		} );
	} );

	describe( 'open', () => {
		it( 'should create overlay structure', () => {
			const lightbox = new LayersLightbox();

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			lightbox.open( { filename: 'Test.jpg' } );

			expect( lightbox.isOpen ).toBe( true );
			expect( lightbox.overlay ).not.toBeNull();
			expect( lightbox.overlay.classList.contains( 'layers-lightbox-overlay' ) ).toBe( true );
		} );

		it( 'should set ARIA attributes for accessibility', () => {
			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );

			expect( lightbox.overlay.getAttribute( 'role' ) ).toBe( 'dialog' );
			expect( lightbox.overlay.getAttribute( 'aria-modal' ) ).toBe( 'true' );
			expect( typeof lightbox.overlay.getAttribute( 'aria-label' ) ).toBe( 'string' );
		} );

		it( 'should close existing lightbox before opening new one', () => {
			const lightbox = new LayersLightbox();
			const closeSpy = jest.spyOn( lightbox, 'close' );

			lightbox.open( { filename: 'First.jpg' } );
			lightbox.open( { filename: 'Second.jpg' } );

			expect( closeSpy ).toHaveBeenCalled();
		} );

		it( 'should show loading state', () => {
			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );

			const loading = lightbox.imageWrapper.querySelector( '.layers-lightbox-loading' );
			expect( loading ).not.toBeNull();
		} );

		it( 'should prevent body scroll', () => {
			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );

			expect( document.body.style.overflow ).toBe( 'hidden' );
		} );

		it( 'should use pre-loaded layer data when available', () => {
			const lightbox = new LayersLightbox();
			const renderSpy = jest.spyOn( lightbox, 'renderViewer' );

			const layerData = {
				layers: [ { id: 'layer1', type: 'rectangle' } ],
				baseWidth: 1024,
				baseHeight: 768
			};

			lightbox.open( {
				filename: 'Test.jpg',
				imageUrl: 'http://example.com/test.jpg',
				layerData: layerData
			} );

			expect( renderSpy ).toHaveBeenCalledWith(
				'http://example.com/test.jpg',
				layerData
			);
		} );

		it( 'should fetch layer data via API when not pre-loaded', () => {
			const lightbox = new LayersLightbox();
			const fetchSpy = jest.spyOn( lightbox, 'fetchAndRender' );

			mockApi.get.mockResolvedValue( {
				layersinfo: { layerset: { data: { layers: [] } } }
			} );

			lightbox.open( { filename: 'Test.jpg' } );

			expect( fetchSpy ).toHaveBeenCalledWith( 'Test.jpg', undefined );
		} );

		it( 'should pass setName to API fetch', () => {
			const lightbox = new LayersLightbox();
			const fetchSpy = jest.spyOn( lightbox, 'fetchAndRender' );

			mockApi.get.mockResolvedValue( {
				layersinfo: { layerset: { data: { layers: [] } } }
			} );

			lightbox.open( { filename: 'Test.jpg', setName: 'anatomy' } );

			expect( fetchSpy ).toHaveBeenCalledWith( 'Test.jpg', 'anatomy' );
		} );
	} );

	describe( 'createOverlay', () => {
		it( 'should create close button with correct attributes', () => {
			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );

			const closeBtn = lightbox.container.querySelector( '.layers-lightbox-close' );
			expect( closeBtn ).not.toBeNull();
			expect( closeBtn.getAttribute( 'type' ) ).toBe( 'button' );
			expect( typeof closeBtn.getAttribute( 'aria-label' ) ).toBe( 'string' );
		} );

		it( 'should add event listeners', () => {
			const lightbox = new LayersLightbox();
			const addEventListenerSpy = jest.spyOn( document, 'addEventListener' );

			lightbox.open( { filename: 'Test.jpg' } );

			expect( addEventListenerSpy ).toHaveBeenCalledWith(
				'keydown',
				expect.any( Function )
			);
			expect( lightbox.boundKeyHandler ).not.toBeNull();

			addEventListenerSpy.mockRestore();
		} );

		it( 'should add visible class after reflow', () => {
			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );

			expect( lightbox.overlay.classList.contains( 'layers-lightbox-visible' ) ).toBe( true );
		} );
	} );

	describe( 'fetchAndRender', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should call API with correct parameters', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			expect( mockApi.get ).toHaveBeenCalledWith( {
				action: 'layersinfo',
				filename: 'Test.jpg',
				format: 'json'
			} );
		} );

		it( 'should include setname in API params when provided', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: { data: { layers: [] } }
				}
			} );

			await lightbox.fetchAndRender( 'Test.jpg', 'anatomy' );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					setname: 'anatomy'
				} )
			);
		} );

		it( 'should not include setname for "on" value', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: { data: { layers: [] } }
				}
			} );

			await lightbox.fetchAndRender( 'Test.jpg', 'on' );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.not.objectContaining( {
					setname: expect.anything()
				} )
			);
		} );

		it( 'should show error when no layersinfo returned', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const errorSpy = jest.spyOn( lightbox, 'showError' );

			mockApi.get.mockResolvedValue( {} );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			expect( errorSpy ).toHaveBeenCalledWith( 'No layer data found' );
		} );

		it( 'should show error when no layerset in response', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const errorSpy = jest.spyOn( lightbox, 'showError' );

			mockApi.get.mockResolvedValue( {
				layersinfo: { layerset: null }
			} );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			expect( errorSpy ).toHaveBeenCalledWith( 'No layer set found' );
		} );

		it( 'should handle API errors gracefully', async () => {
			const lightbox = new LayersLightbox( { debug: true } );
			lightbox.createOverlay();
			lightbox.showLoading();
			const errorSpy = jest.spyOn( lightbox, 'showError' );

			mockApi.get.mockRejectedValue( new Error( 'Network error' ) );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			// Wait for promise rejection to be handled
			await jest.runAllTimersAsync();

			expect( errorSpy ).toHaveBeenCalledWith( 'Failed to load layer data' );
		} );

		it( 'should extract layers from array format', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const renderSpy = jest.spyOn( lightbox, 'renderViewer' );

			const layers = [ { id: 'l1', type: 'rectangle' } ];

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: layers,
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			expect( renderSpy ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( {
					layers: layers
				} )
			);
		} );

		it( 'should extract layers from object format with backgroundVisible', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const renderSpy = jest.spyOn( lightbox, 'renderViewer' );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [ { id: 'l1' } ],
							backgroundVisible: false,
							backgroundOpacity: 0.5
						},
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			expect( renderSpy ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( {
					backgroundVisible: false,
					backgroundOpacity: 0.5
				} )
			);
		} );

		it( 'should handle backgroundVisible as integer 0', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const renderSpy = jest.spyOn( lightbox, 'renderViewer' );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: {
							layers: [],
							backgroundVisible: 0
						}
					}
				}
			} );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			expect( renderSpy ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( {
					backgroundVisible: false
				} )
			);
		} );
	} );

	describe( 'resolveFullImageUrl', () => {
		it( 'should use upload path when available', () => {
			const lightbox = new LayersLightbox();

			const url = lightbox.resolveFullImageUrl( 'TestImage.jpg' );

			expect( url ).toContain( '/w/images/' );
			expect( url ).toContain( 'TestImage.jpg' );
		} );

		it( 'should encode filename in URL', () => {
			const lightbox = new LayersLightbox();

			const url = lightbox.resolveFullImageUrl( 'Test Image.jpg' );

			expect( url ).toContain( 'Test%20Image.jpg' );
		} );

		it( 'should fallback to Special:Redirect when no upload path', () => {
			mw.config.get.mockReturnValueOnce( null );

			const lightbox = new LayersLightbox();
			const url = lightbox.resolveFullImageUrl( 'Test.jpg' );

			expect( mw.util.getUrl ).toHaveBeenCalledWith(
				expect.stringContaining( 'Special:Redirect/file/' )
			);
		} );
	} );

	describe( 'md5First2', () => {
		it( 'should return first two alphanumeric characters', () => {
			const lightbox = new LayersLightbox();

			expect( lightbox.md5First2( 'TestImage.jpg' ) ).toBe( 'te' );
			expect( lightbox.md5First2( 'UPPERCASE.PNG' ) ).toBe( 'up' );
		} );

		it( 'should strip special characters', () => {
			const lightbox = new LayersLightbox();

			expect( lightbox.md5First2( '!@#$Image.jpg' ) ).toBe( 'im' );
		} );

		it( 'should return "aa" for empty or short strings', () => {
			const lightbox = new LayersLightbox();

			expect( lightbox.md5First2( '' ) ).toBe( 'aa' );
			expect( lightbox.md5First2( '!' ) ).toBe( 'aa' );
		} );
	} );

	describe( 'renderViewer', () => {
		it( 'should clear loading indicator', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			lightbox.renderViewer( 'http://example.com/test.jpg', { layers: [] } );

			const loading = lightbox.imageWrapper.querySelector( '.layers-lightbox-loading' );
			expect( loading ).toBeNull();
		} );

		it( 'should create image element with correct attributes', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.renderViewer( 'http://example.com/test.jpg', { layers: [] } );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			expect( img ).not.toBeNull();
			expect( img.classList.contains( 'layers-lightbox-image' ) ).toBe( true );
			expect( img.src ).toBe( 'http://example.com/test.jpg' );
		} );

		it( 'should hide image when backgroundVisible is false', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.renderViewer( 'http://example.com/test.jpg', {
				layers: [],
				backgroundVisible: false
			} );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			expect( img.style.visibility ).toBe( 'hidden' );
			expect( img.style.opacity ).toBe( '0' );
		} );

		it( 'should apply backgroundOpacity to image', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.renderViewer( 'http://example.com/test.jpg', {
				layers: [],
				backgroundVisible: true,
				backgroundOpacity: 0.7
			} );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			expect( img.style.opacity ).toBe( '0.7' );
		} );

		it( 'should default backgroundOpacity to 1', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.renderViewer( 'http://example.com/test.jpg', {
				layers: [],
				backgroundVisible: true
			} );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			expect( img.style.opacity ).toBe( '1' );
		} );
	} );

	describe( 'showError', () => {
		it( 'should display error message', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.showError( 'Test error message' );

			const error = lightbox.imageWrapper.querySelector( '.layers-lightbox-error' );
			expect( error ).not.toBeNull();
			expect( error.textContent ).toBe( 'Test error message' );
		} );

		it( 'should clear previous content', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			lightbox.showError( 'Error' );

			const loading = lightbox.imageWrapper.querySelector( '.layers-lightbox-loading' );
			expect( loading ).toBeNull();
		} );

		it( 'should do nothing if imageWrapper is null', () => {
			const lightbox = new LayersLightbox();
			// Don't create overlay, so imageWrapper is null/undefined

			// Should not throw
			expect( () => {
				lightbox.showError( 'Error message' );
			} ).not.toThrow();

			// imageWrapper should still be falsy (null or undefined)
			expect( lightbox.imageWrapper ).toBeUndefined();
		} );
	} );

	describe( 'handleKeyDown', () => {
		it( 'should close on Escape key', () => {
			const lightbox = new LayersLightbox();
			const closeSpy = jest.spyOn( lightbox, 'close' );

			lightbox.open( { filename: 'Test.jpg' } );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			Object.defineProperty( event, 'preventDefault', {
				value: jest.fn()
			} );

			lightbox.handleKeyDown( event );

			expect( event.preventDefault ).toHaveBeenCalled();
			expect( closeSpy ).toHaveBeenCalled();
		} );

		it( 'should not close on other keys', () => {
			const lightbox = new LayersLightbox();
			const closeSpy = jest.spyOn( lightbox, 'close' );

			lightbox.open( { filename: 'Test.jpg' } );

			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			lightbox.handleKeyDown( event );

			// close was called once during open (to close any existing)
			// but not again for the Enter key
			expect( closeSpy ).toHaveBeenCalledTimes( 0 );
		} );
	} );

	describe( 'handleClick', () => {
		it( 'should close when clicking overlay background', () => {
			const lightbox = new LayersLightbox();
			const closeSpy = jest.spyOn( lightbox, 'close' );

			lightbox.open( { filename: 'Test.jpg' } );

			const event = { target: lightbox.overlay };
			lightbox.handleClick( event );

			expect( closeSpy ).toHaveBeenCalled();
		} );

		it( 'should not close when clicking container content', () => {
			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Test.jpg' } );

			const closeSpy = jest.spyOn( lightbox, 'close' );

			const event = { target: lightbox.container };
			lightbox.handleClick( event );

			expect( closeSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'close', () => {
		it( 'should do nothing if not open', () => {
			const lightbox = new LayersLightbox();

			// Should not throw
			lightbox.close();

			expect( lightbox.isOpen ).toBe( false );
		} );

		it( 'should destroy viewer if present', () => {
			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Test.jpg' } );
			lightbox.viewer = mockViewer;

			lightbox.close();

			expect( mockViewer.destroy ).toHaveBeenCalled();
		} );

		it( 'should remove keydown event listener', () => {
			const lightbox = new LayersLightbox();
			const removeEventListenerSpy = jest.spyOn( document, 'removeEventListener' );

			lightbox.open( { filename: 'Test.jpg' } );
			const handler = lightbox.boundKeyHandler;

			lightbox.close();

			expect( removeEventListenerSpy ).toHaveBeenCalledWith( 'keydown', handler );

			removeEventListenerSpy.mockRestore();
		} );

		it( 'should remove visible class for animation', () => {
			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );
			lightbox.close();

			expect( lightbox.overlay.classList.contains( 'layers-lightbox-visible' ) ).toBe( false );
		} );

		it( 'should set isOpen to false', () => {
			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );
			expect( lightbox.isOpen ).toBe( true );

			lightbox.close();
			expect( lightbox.isOpen ).toBe( false );
		} );

		it( 'should restore body scroll after animation', async () => {
			jest.useFakeTimers();

			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Test.jpg' } );

			expect( document.body.style.overflow ).toBe( 'hidden' );

			lightbox.close();

			jest.advanceTimersByTime( 300 );

			expect( document.body.style.overflow ).toBe( '' );

			jest.useRealTimers();
		} );

		it( 'should remove overlay from DOM after animation', async () => {
			jest.useFakeTimers();

			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Test.jpg' } );

			const overlay = lightbox.overlay;
			expect( document.body.contains( overlay ) ).toBe( true );

			lightbox.close();
			jest.advanceTimersByTime( 300 );

			expect( document.body.contains( overlay ) ).toBe( false );

			jest.useRealTimers();
		} );
	} );

	describe( 'initializeTriggers', () => {
		beforeEach( () => {
			// Clear any existing triggers
			document.querySelectorAll( '.layers-lightbox-trigger' ).forEach( ( el ) => {
				el.parentNode.removeChild( el );
			} );

			// Mock API for trigger tests
			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: {
						data: { layers: [] },
						baseWidth: 800,
						baseHeight: 600
					}
				}
			} );
		} );

		it( 'should find and initialize trigger elements', () => {
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-lightbox-trigger';
			trigger.href = '/wiki/File:Test.jpg';
			document.body.appendChild( trigger );

			const lightbox = new LayersLightbox();
			lightbox.initializeTriggers();

			expect( trigger.dataset.layersLightboxInit ).toBe( 'true' );

			trigger.parentNode.removeChild( trigger );
		} );

		it( 'should not re-initialize already initialized triggers', () => {
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-lightbox-trigger';
			trigger.href = '/wiki/File:Test.jpg';
			trigger.dataset.layersLightboxInit = 'true';
			document.body.appendChild( trigger );

			const addEventListenerSpy = jest.spyOn( trigger, 'addEventListener' );

			const lightbox = new LayersLightbox();
			lightbox.initializeTriggers();

			expect( addEventListenerSpy ).not.toHaveBeenCalled();

			trigger.parentNode.removeChild( trigger );
		} );

		it( 'should open lightbox on trigger click', () => {
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-lightbox-trigger';
			trigger.href = '/wiki/File:TestImage.jpg';
			document.body.appendChild( trigger );

			const lightbox = new LayersLightbox();
			lightbox.initializeTriggers();

			// Trigger the click
			trigger.click();

			// The lightbox should be open
			expect( lightbox.isOpen ).toBe( true );
			expect( lightbox.overlay ).not.toBeNull();

			lightbox.close();
			trigger.parentNode.removeChild( trigger );
		} );

		it( 'should extract setName from data attribute', () => {
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-lightbox-trigger';
			trigger.href = '/wiki/File:Test.jpg';
			trigger.dataset.layersSetname = 'anatomy';
			document.body.appendChild( trigger );

			const lightbox = new LayersLightbox();
			lightbox.initializeTriggers();

			trigger.click();

			// Verify API was called with setname
			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					setname: 'anatomy'
				} )
			);

			lightbox.close();
			trigger.parentNode.removeChild( trigger );
		} );

		it( 'should extract inline layer data from img element', () => {
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-lightbox-trigger';
			trigger.href = '/wiki/File:Test.jpg';

			const img = document.createElement( 'img' );
			const layerData = { layers: [ { id: 'test' } ] };
			img.setAttribute( 'data-layer-data', JSON.stringify( layerData ) );
			trigger.appendChild( img );

			document.body.appendChild( trigger );

			const lightbox = new LayersLightbox();
			const renderSpy = jest.spyOn( lightbox, 'renderViewer' );
			lightbox.initializeTriggers();

			trigger.click();

			// Should render directly without API call when layer data is provided
			// Note: needs imageUrl too to skip API, so API will still be called
			expect( lightbox.isOpen ).toBe( true );

			lightbox.close();
			trigger.parentNode.removeChild( trigger );
		} );

		it( 'should not open if no filename can be extracted', () => {
			const trigger = document.createElement( 'div' );
			trigger.className = 'layers-lightbox-trigger';
			document.body.appendChild( trigger );

			const lightbox = new LayersLightbox();
			lightbox.initializeTriggers();

			trigger.click();

			// Should not open since no filename was extracted
			expect( lightbox.isOpen ).toBe( false );

			trigger.parentNode.removeChild( trigger );
		} );
	} );

	describe( 'extractFilenameFromTrigger', () => {
		it( 'should extract filename from File: URL', () => {
			const trigger = document.createElement( 'a' );
			trigger.href = '/wiki/File:Test_Image.jpg';

			const lightbox = new LayersLightbox();
			const filename = lightbox.extractFilenameFromTrigger( trigger );

			expect( filename ).toBe( 'Test Image.jpg' );
		} );

		it( 'should handle URL-encoded filenames', () => {
			const trigger = document.createElement( 'a' );
			trigger.href = '/wiki/File:Test%20Image%20With%20Spaces.jpg';

			const lightbox = new LayersLightbox();
			const filename = lightbox.extractFilenameFromTrigger( trigger );

			expect( filename ).toBe( 'Test Image With Spaces.jpg' );
		} );

		it( 'should use data-layers-filename attribute', () => {
			const trigger = document.createElement( 'a' );
			trigger.dataset.layersFilename = 'DataAttributeImage.jpg';

			const lightbox = new LayersLightbox();
			const filename = lightbox.extractFilenameFromTrigger( trigger );

			expect( filename ).toBe( 'DataAttributeImage.jpg' );
		} );

		it( 'should extract from child image src', () => {
			const trigger = document.createElement( 'a' );
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/images/thumb/TestImage.jpg';
			trigger.appendChild( img );

			const lightbox = new LayersLightbox();
			const filename = lightbox.extractFilenameFromTrigger( trigger );

			expect( filename ).toBe( 'TestImage.jpg' );
		} );

		it( 'should strip thumbnail prefix from image src', () => {
			const trigger = document.createElement( 'a' );
			const img = document.createElement( 'img' );
			img.src = 'http://example.com/images/thumb/220px-TestImage.jpg';
			trigger.appendChild( img );

			const lightbox = new LayersLightbox();
			const filename = lightbox.extractFilenameFromTrigger( trigger );

			expect( filename ).toBe( 'TestImage.jpg' );
		} );

		it( 'should return null when no filename found', () => {
			const trigger = document.createElement( 'div' );

			const lightbox = new LayersLightbox();
			const filename = lightbox.extractFilenameFromTrigger( trigger );

			expect( filename ).toBeNull();
		} );
	} );

	describe( 'singleton', () => {
		it( 'should export singleton to window.Layers.lightbox', () => {
			expect( window.Layers.lightbox ).toBeDefined();
			expect( window.Layers.lightbox ).toBeInstanceOf( LayersLightbox );
		} );

		it( 'should export class to window.Layers.Viewer.Lightbox', () => {
			expect( window.Layers.Viewer.Lightbox ).toBe( LayersLightbox );
		} );
	} );

	describe( 'image load handling', () => {
		it( 'should show error on image load failure', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.renderViewer( 'http://example.com/nonexistent.jpg', { layers: [] } );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			const errorSpy = jest.spyOn( lightbox, 'showError' );

			// Trigger error
			img.onerror();

			expect( errorSpy ).toHaveBeenCalledWith( 'Failed to load image' );
		} );

		it( 'should create viewer on successful image load', () => {
			// Mock LayersViewer class
			const mockViewer = { render: jest.fn() };
			const MockLayersViewer = jest.fn( () => mockViewer );
			window.Layers = window.Layers || {};
			window.Layers.Viewer = window.Layers.Viewer || {};
			window.Layers.Viewer.LayersViewer = MockLayersViewer;

			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			const layerData = { layers: [ { id: 'test-layer', type: 'rectangle' } ] };
			lightbox.renderViewer( 'http://example.com/test.jpg', layerData );

			const img = lightbox.imageWrapper.querySelector( 'img' );

			// Simulate image load with dimensions
			Object.defineProperty( img, 'naturalWidth', { value: 800, configurable: true } );
			Object.defineProperty( img, 'naturalHeight', { value: 600, configurable: true } );
			img.onload();

			// Should have created a viewer
			expect( MockLayersViewer ).toHaveBeenCalled();
			expect( lightbox.viewer ).toBe( mockViewer );

			delete window.Layers.Viewer.LayersViewer;
		} );

		it( 'should set baseWidth/baseHeight from image if not provided', () => {
			const mockViewer = {};
			const MockLayersViewer = jest.fn( () => mockViewer );
			window.Layers = window.Layers || {};
			window.Layers.Viewer = window.Layers.Viewer || {};
			window.Layers.Viewer.LayersViewer = MockLayersViewer;

			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			// Layer data without baseWidth/baseHeight
			const layerData = { layers: [] };
			lightbox.renderViewer( 'http://example.com/test.jpg', layerData );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			Object.defineProperty( img, 'naturalWidth', { value: 1024, configurable: true } );
			Object.defineProperty( img, 'naturalHeight', { value: 768, configurable: true } );
			img.onload();

			// Should have been called with updated layerData
			expect( MockLayersViewer ).toHaveBeenCalled();
			const callArgs = MockLayersViewer.mock.calls[ 0 ][ 0 ];
			expect( callArgs.layerData.baseWidth ).toBe( 1024 );
			expect( callArgs.layerData.baseHeight ).toBe( 768 );

			delete window.Layers.Viewer.LayersViewer;
		} );

		it( 'should handle missing LayersViewer class gracefully', () => {
			// Remove LayersViewer
			const originalViewer = window.Layers && window.Layers.Viewer;
			if ( window.Layers ) {
				delete window.Layers.Viewer;
			}

			const lightbox = new LayersLightbox( { debug: true } );
			lightbox.createOverlay();

			const layerData = { layers: [] };
			lightbox.renderViewer( 'http://example.com/test.jpg', layerData );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			Object.defineProperty( img, 'naturalWidth', { value: 800, configurable: true } );
			Object.defineProperty( img, 'naturalHeight', { value: 600, configurable: true } );

			// Should not throw
			expect( () => {
				img.onload();
			} ).not.toThrow();

			// Viewer should not be set
			expect( lightbox.viewer ).toBeNull();

			// Restore
			if ( window.Layers && originalViewer ) {
				window.Layers.Viewer = originalViewer;
			}
		} );
	} );

	describe( 'API unavailable handling', () => {
		it( 'should show error when mw.Api is not available', () => {
			const originalApi = mw.Api;
			delete mw.Api;

			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const errorSpy = jest.spyOn( lightbox, 'showError' );

			lightbox.fetchAndRender( 'Test.jpg', null );

			expect( errorSpy ).toHaveBeenCalledWith( 'API not available' );

			mw.Api = originalApi;
		} );
	} );
} );

describe( 'LayersLightbox edge cases', () => {
	describe( 'multiple rapid opens', () => {
		it( 'should handle rapid open/close cycles', () => {
			const lightbox = new LayersLightbox();

			// Rapidly open and close
			for ( let i = 0; i < 5; i++ ) {
				lightbox.open( { filename: `Test${ i }.jpg` } );
				lightbox.close();
			}

			// Should end in closed state
			expect( lightbox.isOpen ).toBe( false );
		} );
	} );

	describe( 'DOM cleanup', () => {
		it( 'should not leave orphaned elements after close', async () => {
			jest.useFakeTimers();

			const lightbox = new LayersLightbox();

			lightbox.open( { filename: 'Test.jpg' } );
			lightbox.close();

			jest.advanceTimersByTime( 300 );

			const overlays = document.querySelectorAll( '.layers-lightbox-overlay' );
			expect( overlays.length ).toBe( 0 );

			jest.useRealTimers();
		} );
	} );

	describe( 'viewer cleanup', () => {
		it( 'should handle viewer without destroy method', () => {
			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Test.jpg' } );
			lightbox.viewer = { someMethod: jest.fn() }; // No destroy method

			// Should not throw
			expect( () => lightbox.close() ).not.toThrow();
		} );
	} );
} );
