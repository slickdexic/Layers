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

			expect( fetchSpy ).toHaveBeenCalledWith( 'Test.jpg', undefined, 1 );
		} );

		it( 'should pass setName to API fetch', () => {
			const lightbox = new LayersLightbox();
			const fetchSpy = jest.spyOn( lightbox, 'fetchAndRender' );

			mockApi.get.mockResolvedValue( {
				layersinfo: { layerset: { data: { layers: [] } } }
			} );

			lightbox.open( { filename: 'Test.jpg', setName: 'anatomy' } );

			expect( fetchSpy ).toHaveBeenCalledWith( 'Test.jpg', 'anatomy', 1 );
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

		it( 'should show image full-size when no layerset in response (no layers saved yet)', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const errorSpy = jest.spyOn( lightbox, 'showError' );
			const renderSpy = jest.spyOn( lightbox, 'renderViewer' );

			mockApi.get.mockResolvedValue( {
				layersinfo: { layerset: null }
			} );

			await lightbox.fetchAndRender( 'Test.jpg', null );

			expect( errorSpy ).not.toHaveBeenCalled();
			expect( renderSpy ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { layers: [], backgroundVisible: true } )
			);
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

	describe( 'multi-page (PDF) support', () => {
		it( 'should default currentPage to 1 and pageCount to 1 on open', () => {
			const lightbox = new LayersLightbox();
			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			lightbox.open( { filename: 'Doc.pdf' } );

			expect( lightbox.currentPage ).toBe( 1 );
			expect( lightbox.pageCount ).toBe( 1 );
		} );

		it( 'should store the requested page from open config', () => {
			const lightbox = new LayersLightbox();
			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			lightbox.open( { filename: 'Doc.pdf', page: 3 } );

			expect( lightbox.currentPage ).toBe( 3 );
		} );

		it( 'should include page in API params when page > 1', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			await lightbox.fetchAndRender( 'Doc.pdf', null, 2 );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( { page: 2 } )
			);
		} );

		it( 'should not include page in API params for page 1', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			await lightbox.fetchAndRender( 'Doc.pdf', null, 1 );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.not.objectContaining( { page: expect.anything() } )
			);
		} );

		it( 'should prefer server-provided imageUrl over Special:Redirect', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();
			const renderSpy = jest.spyOn( lightbox, 'renderViewer' );

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: null,
					imageUrl: '/images/thumb/Doc.pdf/page2-2048px.jpg'
				}
			} );

			await lightbox.fetchAndRender( 'Doc.pdf', null, 2 );

			expect( renderSpy ).toHaveBeenCalledWith(
				'/images/thumb/Doc.pdf/page2-2048px.jpg',
				expect.any( Object )
			);
		} );

		it( 'should track pageCount and page reported by the server', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: { data: { layers: [] } },
					page: 2,
					pageCount: 4
				}
			} );

			await lightbox.fetchAndRender( 'Doc.pdf', null, 2 );

			expect( lightbox.pageCount ).toBe( 4 );
			expect( lightbox.currentPage ).toBe( 2 );
		} );

		it( 'updateToolbar should show paging controls only for multi-page files', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: { data: { layers: [] } },
					page: 1,
					pageCount: 3
				}
			} );

			await lightbox.fetchAndRender( 'Doc.pdf', null, 1 );

			expect( lightbox.prevBtn.style.display ).toBe( '' );
			expect( lightbox.nextBtn.style.display ).toBe( '' );
			expect( lightbox.pageIndicator.style.display ).toBe( '' );
			expect( lightbox.prevBtn.disabled ).toBe( true );
			expect( lightbox.nextBtn.disabled ).toBe( false );
		} );

		it( 'updateToolbar should hide paging controls for single-page files', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.showLoading();

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					layerset: { data: { layers: [] } },
					page: 1,
					pageCount: 1
				}
			} );

			await lightbox.fetchAndRender( 'Doc.pdf', null, 1 );

			expect( lightbox.prevBtn.style.display ).toBe( 'none' );
			expect( lightbox.nextBtn.style.display ).toBe( 'none' );
			expect( lightbox.pageIndicator.style.display ).toBe( 'none' );
		} );

		it( 'goToPage should refetch with the target page', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.pageCount = 4;
			lightbox.currentPage = 1;
			lightbox.filename = 'Doc.pdf';
			lightbox.setName = null;
			const fetchSpy = jest.spyOn( lightbox, 'fetchAndRender' ).mockImplementation( () => {} );

			lightbox.goToPage( 3 );

			expect( lightbox.currentPage ).toBe( 3 );
			expect( fetchSpy ).toHaveBeenCalledWith( 'Doc.pdf', null, 3 );
		} );

		it( 'goToPage should ignore out-of-range or unchanged pages', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.pageCount = 4;
			lightbox.currentPage = 2;
			lightbox.filename = 'Doc.pdf';
			const fetchSpy = jest.spyOn( lightbox, 'fetchAndRender' ).mockImplementation( () => {} );

			lightbox.goToPage( 0 );
			lightbox.goToPage( 5 );
			lightbox.goToPage( 2 );

			expect( fetchSpy ).not.toHaveBeenCalled();
			expect( lightbox.currentPage ).toBe( 2 );
		} );

		it( 'printDocument should composite pages and print them from a hidden frame', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			lightbox.pageCount = 2;
			jest.spyOn( lightbox, 'composePageDataUrl' )
				.mockImplementation( ( p ) => Promise.resolve( 'data:img' + p ) );
			const printSpy = jest.spyOn( lightbox, 'printImages' ).mockImplementation( () => {} );
			const serverSpy = jest.spyOn( lightbox, 'printViaServer' ).mockImplementation( () => {} );

			await lightbox.printDocument();

			expect( printSpy ).toHaveBeenCalledWith( [ 'data:img1', 'data:img2' ] );
			expect( serverSpy ).not.toHaveBeenCalled();
			expect( lightbox.printBtn.disabled ).toBe( false );
		} );

		it( 'printDocument should fall back to the server when compositing fails', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			lightbox.pageCount = 1;
			jest.spyOn( lightbox, 'composePageDataUrl' )
				.mockImplementation( () => Promise.resolve( null ) );
			const printSpy = jest.spyOn( lightbox, 'printImages' ).mockImplementation( () => {} );
			const serverSpy = jest.spyOn( lightbox, 'printViaServer' ).mockImplementation( () => {} );

			await lightbox.printDocument();

			expect( printSpy ).not.toHaveBeenCalled();
			expect( serverSpy ).toHaveBeenCalled();
		} );

		it( 'close should tear down any hidden print frame', () => {
			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Doc.pdf' } );
			const frame = document.createElement( 'iframe' );
			document.body.appendChild( frame );
			lightbox.printFrame = frame;

			lightbox.close( true );

			expect( lightbox.printFrame ).toBeNull();
			expect( frame.parentNode ).toBeNull();
		} );
	} );

	describe( 'zoom and pan', () => {
		it( 'zoomBy should multiply the zoom factor', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.zoom = 1;

			lightbox.zoomBy( 1.25 );

			expect( lightbox.zoom ).toBeCloseTo( 1.25 );
		} );

		it( 'setZoom should clamp to the max zoom limit', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.setZoom( 100 );

			expect( lightbox.zoom ).toBe( 8 );
		} );

		it( 'setZoom should clamp to the min zoom limit', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.setZoom( 0.01 );

			expect( lightbox.zoom ).toBe( 0.25 );
		} );

		it( 'setZoom to 1 should clear any pan offset', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.panX = 40;
			lightbox.panY = -20;

			lightbox.setZoom( 1 );

			expect( lightbox.panX ).toBe( 0 );
			expect( lightbox.panY ).toBe( 0 );
		} );

		it( 'resetZoom should restore 100% and clear pan', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.zoom = 3;
			lightbox.panX = 50;
			lightbox.panY = 50;

			lightbox.resetZoom();

			expect( lightbox.zoom ).toBe( 1 );
			expect( lightbox.panX ).toBe( 0 );
			expect( lightbox.panY ).toBe( 0 );
		} );

		it( 'applyTransform should write a CSS transform and update the indicator', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.zoom = 2;
			lightbox.panX = 10;
			lightbox.panY = 20;

			lightbox.applyTransform();

			expect( lightbox.imageWrapper.style.transform ).toContain( 'scale(2)' );
			expect( lightbox.imageWrapper.style.transform ).toContain( 'translate(10px, 20px)' );
			expect( lightbox.zoomIndicator.textContent ).toBe( '200%' );
		} );

		it( 'handleWheel should zoom in on upward scroll and prevent default', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.zoom = 1;
			const preventDefault = jest.fn();

			lightbox.handleWheel( { deltaY: -100, preventDefault } );

			expect( preventDefault ).toHaveBeenCalled();
			expect( lightbox.zoom ).toBeGreaterThan( 1 );
		} );

		it( 'handleWheel should zoom out on downward scroll', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.zoom = 2;

			lightbox.handleWheel( { deltaY: 100, preventDefault: jest.fn() } );

			expect( lightbox.zoom ).toBeLessThan( 2 );
		} );

		it( 'panning should be ignored when not zoomed', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.zoom = 1;

			lightbox.startPan( { clientX: 0, clientY: 0, preventDefault: jest.fn(), stopPropagation: jest.fn() } );

			expect( lightbox.isPanning ).toBeFalsy();
		} );

		it( 'panning should update the pan offset when zoomed in', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.zoom = 2;

			lightbox.startPan( { clientX: 100, clientY: 100, preventDefault: jest.fn(), stopPropagation: jest.fn() } );
			lightbox.movePan( { clientX: 130, clientY: 90 } );

			expect( lightbox.isPanning ).toBe( true );
			expect( lightbox.panX ).toBe( 30 );
			expect( lightbox.panY ).toBe( -10 );

			lightbox.endPan();
			expect( lightbox.isPanning ).toBe( false );
		} );

		it( 'open should reset zoom and pan to defaults', () => {
			const lightbox = new LayersLightbox();
			mockApi.get.mockResolvedValue( { layersinfo: { layerset: null } } );

			lightbox.open( { filename: 'Doc.pdf' } );

			expect( lightbox.zoom ).toBe( 1 );
			expect( lightbox.panX ).toBe( 0 );
			expect( lightbox.panY ).toBe( 0 );
		} );

		it( 'Escape / +/- / 0 keys should control zoom and closing', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.isOpen = true;
			lightbox.zoom = 1;

			lightbox.handleKeyDown( { key: '+', preventDefault: jest.fn() } );
			expect( lightbox.zoom ).toBeGreaterThan( 1 );

			lightbox.handleKeyDown( { key: '0', preventDefault: jest.fn() } );
			expect( lightbox.zoom ).toBe( 1 );

			lightbox.handleKeyDown( { key: '-', preventDefault: jest.fn() } );
			expect( lightbox.zoom ).toBeLessThan( 1 );
		} );
	} );

	describe( 'print and download buttons', () => {
		it( 'should show both buttons for single-page files', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.pageCount = 1;
			lightbox.updateToolbar();

			expect( lightbox.printBtn.style.display ).not.toBe( 'none' );
			expect( lightbox.downloadBtn.style.display ).not.toBe( 'none' );
		} );

		it( 'should show both buttons for multi-page files', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.pageCount = 4;
			lightbox.updateToolbar();

			expect( lightbox.printBtn.style.display ).not.toBe( 'none' );
			expect( lightbox.downloadBtn.style.display ).not.toBe( 'none' );
		} );

		it( 'should do nothing when no filename is set', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = null;
			const composeSpy = jest.spyOn( lightbox, 'composePageDataUrl' );

			await lightbox.printDocument();

			expect( composeSpy ).not.toHaveBeenCalled();
		} );

		it( 'should composite every page client-side and print them', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			lightbox.pageCount = 3;

			jest.spyOn( lightbox, 'composePageDataUrl' ).mockImplementation(
				( page ) => Promise.resolve( 'data:image/png;base64,page' + page )
			);
			const printSpy = jest.spyOn( lightbox, 'printImages' )
				.mockImplementation( () => {} );
			const serverSpy = jest.spyOn( lightbox, 'printViaServer' )
				.mockImplementation( () => {} );

			await lightbox.printDocument();

			expect( lightbox.composePageDataUrl ).toHaveBeenCalledTimes( 3 );
			expect( printSpy ).toHaveBeenCalledWith( [
				'data:image/png;base64,page1',
				'data:image/png;base64,page2',
				'data:image/png;base64,page3'
			] );
			expect( serverSpy ).not.toHaveBeenCalled();
		} );

		it( 'should fall back to the server export when no page composites', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			lightbox.pageCount = 2;

			jest.spyOn( lightbox, 'composePageDataUrl' )
				.mockImplementation( () => Promise.resolve( null ) );
			const printSpy = jest.spyOn( lightbox, 'printImages' )
				.mockImplementation( () => {} );
			const serverSpy = jest.spyOn( lightbox, 'printViaServer' )
				.mockImplementation( () => {} );

			await lightbox.printDocument();

			expect( printSpy ).not.toHaveBeenCalled();
			expect( serverSpy ).toHaveBeenCalled();
		} );

		it( 'should fall back to the server export on client-side error', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			lightbox.pageCount = 1;

			jest.spyOn( lightbox, 'composePageDataUrl' )
				.mockImplementation( () => Promise.reject( new Error( 'tainted' ) ) );
			const serverSpy = jest.spyOn( lightbox, 'printViaServer' )
				.mockImplementation( () => {} );

			await lightbox.printDocument();

			expect( serverSpy ).toHaveBeenCalled();
		} );

		it( 'downloadPdf should build the PDF from client-composited pages', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Somepdf.pdf';
			lightbox.pageCount = 2;
			jest.spyOn( lightbox, 'composePage' ).mockImplementation(
				() => Promise.resolve( {
					src: 'data:image/jpeg;base64,/9j/', width: 800, height: 1000
				} )
			);
			const blob = { size: 1 };
			jest.spyOn( lightbox, 'buildPdfBlob' ).mockReturnValue( blob );
			const saveSpy = jest.spyOn( lightbox, 'saveBlob' ).mockImplementation( () => {} );
			const serverSpy = jest.spyOn( lightbox, 'downloadViaServer' )
				.mockImplementation( () => {} );

			await lightbox.downloadPdf();

			expect( lightbox.composePage ).toHaveBeenCalledTimes( 2 );
			expect( lightbox.composePage ).toHaveBeenCalledWith( 1, 'image/jpeg', 0.92 );
			expect( saveSpy ).toHaveBeenCalledWith( blob, 'Somepdf.pdf' );
			expect( serverSpy ).not.toHaveBeenCalled();
			expect( lightbox.downloadBtn.disabled ).toBe( false );
		} );

		it( 'downloadPdf should fall back to the server when nothing composites', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Somepdf.pdf';
			lightbox.pageCount = 1;
			jest.spyOn( lightbox, 'composePage' ).mockResolvedValue( null );
			const serverSpy = jest.spyOn( lightbox, 'downloadViaServer' )
				.mockImplementation( () => {} );

			await lightbox.downloadPdf();

			expect( serverSpy ).toHaveBeenCalled();
		} );

		it( 'downloadViaServer should save the export as an attachment', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			mockApi.get.mockResolvedValue( {
				layerspdfexport: { url: '/index.php?title=Special:LayersExport&key=abc' }
			} );
			const clickSpy = jest.fn();
			const created = [];
			const realCreate = document.createElement.bind( document );
			jest.spyOn( document, 'createElement' ).mockImplementation( ( tag ) => {
				const el = realCreate( tag );
				if ( tag === 'a' ) {
					el.click = clickSpy;
					created.push( el );
				}
				return el;
			} );

			await lightbox.downloadViaServer();

			document.createElement.mockRestore();
			expect( clickSpy ).toHaveBeenCalled();
			expect( created[ 0 ].href ).toContain( 'download=1' );
			expect( created[ 0 ].parentNode ).toBeNull();
		} );

		it( 'exportFileName should swap the extension and strip separators', () => {
			const lightbox = new LayersLightbox();
			lightbox.filename = 'My/Doc:2.pdf';

			expect( lightbox.exportFileName() ).toBe( 'My_Doc_2.pdf' );
		} );
	} );

	describe( 'composePageDataUrl', () => {
		it( 'should request layersinfo for the given page and flatten it', async () => {
			const lightbox = new LayersLightbox();
			lightbox.filename = 'Doc.pdf';
			lightbox.setName = '001';

			mockApi.get.mockResolvedValue( {
				layersinfo: {
					imageUrl: '/images/thumb/Doc.pdf/page2.jpg',
					baseWidth: 1275,
					baseHeight: 1650,
					layerset: { data: { layers: [ { id: 'a', type: 'rectangle' } ] } }
				}
			} );
			const flattenSpy = jest.spyOn( lightbox, 'flattenPage' )
				.mockResolvedValue( {
					src: 'data:image/png;base64,ok', width: 100, height: 200
				} );

			const result = await lightbox.composePageDataUrl( 2 );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					action: 'layersinfo',
					filename: 'Doc.pdf',
					setname: '001',
					page: 2
				} )
			);
			expect( flattenSpy ).toHaveBeenCalledWith(
				'/images/thumb/Doc.pdf/page2.jpg',
				expect.objectContaining( { layers: [ { id: 'a', type: 'rectangle' } ] } ),
				undefined,
				undefined
			);
			expect( result ).toBe( 'data:image/png;base64,ok' );
		} );

		it( 'should not send a page param for page 1', async () => {
			const lightbox = new LayersLightbox();
			lightbox.filename = 'Doc.pdf';
			lightbox.setName = null;

			mockApi.get.mockResolvedValue( { layersinfo: { imageUrl: '/x.jpg', layerset: null } } );
			jest.spyOn( lightbox, 'flattenPage' )
				.mockResolvedValue( { src: 'data:img', width: 1, height: 1 } );

			await lightbox.composePageDataUrl( 1 );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.not.objectContaining( { page: expect.anything() } )
			);
		} );

		it( 'should resolve null when the API rejects', async () => {
			const lightbox = new LayersLightbox();
			lightbox.filename = 'Doc.pdf';
			mockApi.get.mockRejectedValue( new Error( 'boom' ) );

			const result = await lightbox.composePageDataUrl( 1 );
			expect( result ).toBe( null );
		} );
	} );

	describe( 'composePage with pre-loaded layer data (slides)', () => {
		it( 'should composite from the supplied data without calling the API', async () => {
			const lightbox = new LayersLightbox();
			const layerData = { layers: [ { id: 'a', type: 'text' } ], baseWidth: 800, baseHeight: 600 };
			lightbox.open( {
				filename: 'MySlide',
				isSlide: true,
				imageUrl: 'data:image/png;base64,bg',
				layerData: layerData
			} );
			mockApi.get.mockClear();
			const flattenSpy = jest.spyOn( lightbox, 'flattenPage' )
				.mockResolvedValue( { src: 'data:image/jpeg;base64,ok', width: 800, height: 600 } );

			const result = await lightbox.composePage( 1, 'image/jpeg', 0.92 );

			expect( mockApi.get ).not.toHaveBeenCalled();
			expect( flattenSpy ).toHaveBeenCalledWith(
				'data:image/png;base64,bg', layerData, 'image/jpeg', 0.92
			);
			expect( result.src ).toBe( 'data:image/jpeg;base64,ok' );
			lightbox.close( true );
		} );

		it( 'should still use the API for later pages of a multi-page file', async () => {
			const lightbox = new LayersLightbox();
			lightbox.open( {
				filename: 'Doc.pdf',
				imageUrl: 'data:image/png;base64,bg',
				layerData: { layers: [] }
			} );
			mockApi.get.mockClear();
			mockApi.get.mockResolvedValue( { layersinfo: { imageUrl: '/p2.jpg', layerset: null } } );
			jest.spyOn( lightbox, 'flattenPage' )
				.mockResolvedValue( { src: 'data:img', width: 1, height: 1 } );

			await lightbox.composePage( 2 );

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( { action: 'layersinfo', page: 2 } )
			);
			lightbox.close( true );
		} );

		it( 'downloadPdf should produce a PDF for a slide', async () => {
			const lightbox = new LayersLightbox();
			lightbox.open( {
				filename: 'MySlide',
				isSlide: true,
				imageUrl: 'data:image/png;base64,bg',
				layerData: { layers: [], baseWidth: 800, baseHeight: 600 }
			} );
			jest.spyOn( lightbox, 'composePage' ).mockResolvedValue( {
				src: 'data:image/jpeg;base64,/9j/ok', width: 800, height: 600
			} );
			jest.spyOn( lightbox, 'buildPdfBlob' ).mockReturnValue( { size: 1 } );
			const saveSpy = jest.spyOn( lightbox, 'saveBlob' ).mockImplementation( () => {} );
			const serverSpy = jest.spyOn( lightbox, 'downloadViaServer' )
				.mockImplementation( () => {} );

			await lightbox.downloadPdf();

			expect( serverSpy ).not.toHaveBeenCalled();
			expect( saveSpy ).toHaveBeenCalledWith( expect.anything(), 'MySlide.pdf' );
			lightbox.close( true );
		} );
	} );

	describe( 'printImages', () => {
		it( 'should write a hidden frame with an img tag per page and print it', async () => {
			const lightbox = new LayersLightbox();
			lightbox.filename = 'Doc.pdf';
			jest.spyOn( lightbox, 'whenImagesReady' ).mockResolvedValue( [] );

			lightbox.printImages( [ 'data:img1', 'data:img2' ] );

			const frame = lightbox.printFrame;
			expect( frame ).not.toBeNull();
			expect( frame.tagName ).toBe( 'IFRAME' );
			expect( frame.parentNode ).toBe( document.body );
			const html = frame.contentWindow.document.documentElement.innerHTML;
			expect( html ).toContain( 'data:img1' );
			expect( html ).toContain( 'data:img2' );
			expect( ( html.match( /layers-print-page/g ) || [] ).length )
				.toBeGreaterThanOrEqual( 2 );

			const printSpy = jest.fn();
			frame.contentWindow.print = printSpy;
			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
			expect( printSpy ).toHaveBeenCalled();

			lightbox.destroyPrintFrame();
		} );

		it( 'should replace an existing frame rather than stacking them', () => {
			const lightbox = new LayersLightbox();
			lightbox.filename = 'Doc.pdf';
			jest.spyOn( lightbox, 'whenImagesReady' ).mockResolvedValue( [] );

			lightbox.printImages( [ 'data:img1' ] );
			const first = lightbox.printFrame;
			lightbox.printImages( [ 'data:img2' ] );

			expect( first.parentNode ).toBeNull();
			expect( lightbox.printFrame ).not.toBe( first );
			expect( document.querySelectorAll( '.layers-print-frame' ).length ).toBe( 1 );

			lightbox.destroyPrintFrame();
		} );

		it( 'whenImagesReady should resolve even if an image never settles', async () => {
			jest.useFakeTimers();
			const lightbox = new LayersLightbox();
			const pending = { complete: false, addEventListener: jest.fn() };
			const promise = lightbox.whenImagesReady( { images: [ pending ] } );
			jest.advanceTimersByTime( 5000 );
			await expect( promise ).resolves.toBeUndefined();
			jest.useRealTimers();
		} );

		it( 'buildPrintHtml should zero the page margins', () => {
			const lightbox = new LayersLightbox();
			lightbox.filename = 'Doc.pdf';

			// Zero margins are what suppress the browser's own header/footer.
			expect( lightbox.buildPrintHtml( [ 'data:img1' ] ) )
				.toContain( '@page{size:auto;margin:0;}' );
		} );

		it( 'destroyPrintFrame should be safe with no frame attached', () => {
			const lightbox = new LayersLightbox();
			expect( () => lightbox.destroyPrintFrame() ).not.toThrow();
			expect( lightbox.printFrame ).toBeNull();
		} );
	} );

	describe( 'escapeHtml', () => {
		it( 'should escape HTML-significant characters', () => {
			const lightbox = new LayersLightbox();
			expect( lightbox.escapeHtml( '<a href="x">&\'' ) )
				.toBe( '&lt;a href=&quot;x&quot;&gt;&amp;&#39;' );
		} );
	} );

	describe( 'requestServerPdf (fallback)', () => {
		it( 'should call the layerspdfexport API with filename and setname', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			lightbox.setName = '001';

			mockApi.get.mockResolvedValue( {
				layerspdfexport: { success: 1, url: '/images/thumb/layers/export/abc.pdf' }
			} );

			await lightbox.printViaServer();

			expect( mockApi.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					action: 'layerspdfexport',
					filename: 'Doc.pdf',
					setname: '001'
				} )
			);
		} );

		it( 'should open the returned PDF URL in a new tab', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			const openSpy = jest.spyOn( window, 'open' ).mockImplementation( () => {} );

			mockApi.get.mockResolvedValue( {
				layerspdfexport: { success: 1, url: '/images/thumb/layers/export/abc.pdf' }
			} );

			await lightbox.printViaServer();

			expect( openSpy ).toHaveBeenCalledWith(
				'/images/thumb/layers/export/abc.pdf', '_blank', 'noopener'
			);
			openSpy.mockRestore();
		} );

		it( 'should notify on export failure', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'Doc.pdf';
			mw.notify = jest.fn();

			mockApi.get.mockRejectedValue( new Error( 'boom' ) );

			await lightbox.printViaServer();

			expect( mw.notify ).toHaveBeenCalled();
			delete mw.notify;
		} );

		it( 'should report an error for slides instead of failing silently', async () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();
			lightbox.filename = 'MySlide';
			lightbox.isSlide = true;
			mw.notify = jest.fn();
			mockApi.get.mockClear();

			await lightbox.printViaServer();

			expect( mockApi.get ).not.toHaveBeenCalled();
			expect( mw.notify ).toHaveBeenCalled();
			delete mw.notify;
		} );
	} );

	describe( 'resolveFullImageUrl', () => {
		it( 'should use Special:Redirect for all filenames', () => {
			const lightbox = new LayersLightbox();

			lightbox.resolveFullImageUrl( 'TestImage.jpg' );

			expect( mw.util.getUrl ).toHaveBeenCalledWith(
				'Special:Redirect/file/TestImage.jpg'
			);
		} );

		it( 'should encode filename in URL', () => {
			const lightbox = new LayersLightbox();

			lightbox.resolveFullImageUrl( 'Test Image.jpg' );

			expect( mw.util.getUrl ).toHaveBeenCalledWith(
				'Special:Redirect/file/Test%20Image.jpg'
			);
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
			jest.spyOn( lightbox, 'renderViewer' );
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
			lightbox.isOpen = true;
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
			lightbox.isOpen = true;
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

	describe( 'i18n alt text', () => {
		it( 'should use mw.message for image alt text instead of hardcoded string', () => {
			const lightbox = new LayersLightbox();
			lightbox.createOverlay();

			lightbox.renderViewer( 'http://example.com/test.jpg', { layers: [] } );

			const img = lightbox.imageWrapper.querySelector( 'img' );
			expect( img ).not.toBeNull();
			// mw.message returns {text: () => 'msg:key'} in our mock
			expect( img.alt ).toBe( 'msg:layers-lightbox-alt' );
			expect( mw.message ).toHaveBeenCalledWith( 'layers-lightbox-alt' );
		} );
	} );

	describe( 'PDF rendering path', () => {
		it( 'flags PDF filenames on open()', () => {
			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Doc.pdf' } );
			expect( lightbox.isPdf ).toBe( true );
		} );

		it( 'does not flag image filenames on open()', () => {
			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Photo.JPG' } );
			expect( lightbox.isPdf ).toBe( false );
		} );

		it( 'preparePageImageUrl returns the fallback for non-PDF files', async () => {
			const lightbox = new LayersLightbox();
			lightbox.isPdf = false;
			const url = await lightbox.preparePageImageUrl( 'x.jpg', 1, 'server.jpg' );
			expect( url ).toBe( 'server.jpg' );
		} );

		it( 'preparePageImageUrl returns the fallback when no renderer is available', async () => {
			const lightbox = new LayersLightbox();
			lightbox.isPdf = true;
			lightbox._pdfRendererResolved = true;
			lightbox.pdfRenderer = null;
			const url = await lightbox.preparePageImageUrl( 'x.pdf', 1, 'server.jpg' );
			expect( url ).toBe( 'server.jpg' );
		} );

		it( 'preparePageImageUrl uses the pdf.js data URL and updates pageCount', async () => {
			const lightbox = new LayersLightbox();
			lightbox.isPdf = true;
			lightbox.pageCount = 1;
			lightbox._pdfRendererResolved = true;
			lightbox.pdfRenderer = {
				isAvailable: () => true,
				renderPage: jest.fn( () => Promise.resolve( {
					dataUrl: 'data:image/png;base64,pdf',
					width: 1600,
					height: 1200,
					pageCount: 5
				} ) )
			};
			const url = await lightbox.preparePageImageUrl( 'x.pdf', 2, 'server.jpg' );
			expect( url ).toBe( 'data:image/png;base64,pdf' );
			expect( lightbox.pageCount ).toBe( 5 );
			expect( lightbox.pdfRenderer.renderPage ).toHaveBeenCalled();
		} );

		it( 'preparePageImageUrl falls back to the server image on render failure', async () => {
			const lightbox = new LayersLightbox();
			lightbox.isPdf = true;
			lightbox._pdfRendererResolved = true;
			lightbox.pdfRenderer = {
				isAvailable: () => true,
				renderPage: jest.fn( () => Promise.reject( new Error( 'boom' ) ) )
			};
			const url = await lightbox.preparePageImageUrl( 'x.pdf', 1, 'server.jpg' );
			expect( url ).toBe( 'server.jpg' );
		} );

		it( 'close() destroys the pdf renderer and clears resolution state', () => {
			const lightbox = new LayersLightbox();
			lightbox.open( { filename: 'Doc.pdf' } );
			const destroy = jest.fn();
			lightbox.pdfRenderer = { destroy: destroy };
			lightbox._pdfRendererResolved = true;
			lightbox.close();
			expect( destroy ).toHaveBeenCalled();
			expect( lightbox.pdfRenderer ).toBeNull();
			expect( lightbox._pdfRendererResolved ).toBe( false );
		} );
	} );
} );
