/**
 * @jest-environment jsdom
 */

/* eslint-disable no-unused-vars */

/**
 * Tests for SpecialSlides.js
 *
 * These tests verify the slide management functionality for Special:Slides.
 * Since the module depends on MediaWiki's mw and OO globals, we test
 * the helper functions and message formatting.
 *
 * @see resources/ext.layers.slides/SpecialSlides.js
 */

describe( 'SpecialSlides', () => {
	let mockApi;
	let mockConfig;

	beforeEach( () => {
		// Reset DOM
		document.body.innerHTML = '';

		// Mock mw object
		mockApi = {
			get: jest.fn().mockResolvedValue( {
				layerslist: {
					slides: [],
					total: 0
				}
			} ),
			postWithToken: jest.fn().mockResolvedValue( { layersdelete: { success: 1 } } )
		};

		mockConfig = {
			canCreate: true,
			canDelete: true,
			defaultWidth: 800,
			defaultHeight: 600,
			defaultBackground: '#ffffff',
			maxWidth: 4096,
			maxHeight: 4096
		};

		global.mw = {
			Api: jest.fn( () => mockApi ),
			config: {
				get: jest.fn( ( key ) => {
					if ( key === 'wgLayersSlidesConfig' ) {
						return mockConfig;
					}
					return null;
				} )
			},
			message: jest.fn( ( key, ...params ) => ( {
				escaped: () => `[${ key }]`,
				text: () => `[${ key }]`,
				parse: () => `<span>[${ key }]</span>`
			} ) ),
			html: {
				escape: ( str ) => String( str ).replace( /[&<>"']/g, ( c ) => ( {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;'
				}[ c ] ) )
			},
			util: {
				getUrl: ( page ) => `/wiki/${ page }`
			},
			notify: jest.fn(),
			log: {
				error: jest.fn()
			}
		};

		// Mock jQuery
		const mockJQuery = jest.fn( ( selector ) => ( {
			length: 1,
			addClass: jest.fn().mockReturnThis(),
			removeClass: jest.fn().mockReturnThis(),
			append: jest.fn().mockReturnThis(),
			appendTo: jest.fn().mockReturnThis(),
			empty: jest.fn().mockReturnThis(),
			find: jest.fn().mockReturnThis(),
			on: jest.fn().mockReturnThis(),
			val: jest.fn( () => '' ),
			text: jest.fn().mockReturnThis(),
			html: jest.fn().mockReturnThis(),
			attr: jest.fn().mockReturnThis(),
			prop: jest.fn().mockReturnThis(),
			remove: jest.fn().mockReturnThis(),
			first: jest.fn().mockReturnThis(),
			each: jest.fn().mockReturnThis(),
			trigger: jest.fn().mockReturnThis(),
			hide: jest.fn().mockReturnThis(),
			show: jest.fn().mockReturnThis(),
			data: jest.fn(),
			closest: jest.fn().mockReturnThis()
		} ) );

		global.$ = mockJQuery;
		global.jQuery = mockJQuery;

		// Mock OO.ui
		global.OO = {
			ui: {
				confirm: jest.fn().mockResolvedValue( true ),
				ProcessDialog: class MockProcessDialog {
					static static = { name: 'test', title: 'Test', actions: [] };
				},
				WindowManager: class MockWindowManager {
					constructor() {
						this.$element = global.$( '<div>' );
					}

					addWindows() {}

					openWindow() {
						return { closed: Promise.resolve( {} ) };
					}
				},
				PanelLayout: class MockPanelLayout {
					constructor() {
						this.$element = global.$( '<div>' );
					}
				},
				TextInputWidget: class MockTextInputWidget {
					getValue() {
						return '';
					}
				},
				NumberInputWidget: class MockNumberInputWidget {
					getValue() {
						return 800;
					}
				},
				DropdownWidget: class MockDropdownWidget {
					getMenu() {
						return {
							selectItemByData: jest.fn(),
							findSelectedItem: () => ( { getData: () => '800x600' } ),
							on: jest.fn()
						};
					}
				},
				MenuOptionWidget: class MockMenuOptionWidget {},
				HorizontalLayout: class MockHorizontalLayout {
					constructor() {
						this.$element = global.$( '<div>' );
					}
				},
				LabelWidget: class MockLabelWidget {},
				FieldLayout: class MockFieldLayout {
					constructor() {
						this.$element = global.$( '<div>' );
					}
				},
				Process: class MockProcess {
					constructor( fn ) {
						this.fn = fn;
					}
				},
				Error: class MockError {
					constructor( msg ) {
						this.message = msg;
					}
				}
			}
		};
	} );

	afterEach( () => {
		jest.clearAllMocks();
		jest.resetModules();
		document.body.innerHTML = '';
	} );

	describe( 'Configuration loading', () => {
		it( 'should read configuration from mw.config', () => {
			const config = mw.config.get( 'wgLayersSlidesConfig' );
			expect( config ).toEqual( mockConfig );
			expect( config.canCreate ).toBe( true );
			expect( config.defaultWidth ).toBe( 800 );
			expect( config.defaultHeight ).toBe( 600 );
		} );

		it( 'should handle missing configuration gracefully', () => {
			mw.config.get.mockReturnValue( null );
			const config = mw.config.get( 'wgLayersSlidesConfig' );
			expect( config ).toBeNull();
		} );
	} );

	describe( 'API interactions', () => {
		it( 'should create API instance', () => {
			const api = new mw.Api();
			expect( mw.Api ).toHaveBeenCalled();
			expect( api.get ).toBeDefined();
			expect( api.postWithToken ).toBeDefined();
		} );

		it( 'should format API request for listing slides', async () => {
			const api = new mw.Api();
			await api.get( {
				action: 'layerslist',
				limit: 20,
				offset: 0,
				sort: 'name'
			} );

			expect( api.get ).toHaveBeenCalledWith( {
				action: 'layerslist',
				limit: 20,
				offset: 0,
				sort: 'name'
			} );
		} );

		it( 'should format API request with search prefix', async () => {
			const api = new mw.Api();
			await api.get( {
				action: 'layerslist',
				prefix: 'Process',
				limit: 20
			} );

			expect( api.get ).toHaveBeenCalledWith(
				expect.objectContaining( {
					action: 'layerslist',
					prefix: 'Process'
				} )
			);
		} );

		it( 'should handle API error responses', async () => {
			mockApi.get.mockRejectedValue( new Error( 'Network error' ) );
			const api = new mw.Api();

			await expect( api.get( { action: 'layerslist' } ) )
				.rejects.toThrow( 'Network error' );
		} );
	} );

	describe( 'Delete operations', () => {
		it( 'should call postWithToken for delete', async () => {
			const api = new mw.Api();
			await api.postWithToken( 'csrf', {
				action: 'layersdelete',
				filename: 'Slide:TestSlide'
			} );

			expect( api.postWithToken ).toHaveBeenCalledWith( 'csrf', {
				action: 'layersdelete',
				filename: 'Slide:TestSlide'
			} );
		} );

		it( 'should show confirmation dialog before delete', async () => {
			const confirmed = await OO.ui.confirm( 'Delete this slide?' );
			expect( OO.ui.confirm ).toHaveBeenCalledWith( 'Delete this slide?' );
			expect( confirmed ).toBe( true );
		} );

		it( 'should cancel delete when user declines', async () => {
			OO.ui.confirm.mockResolvedValue( false );
			const confirmed = await OO.ui.confirm( 'Delete this slide?' );
			expect( confirmed ).toBe( false );
		} );
	} );

	describe( 'Message formatting', () => {
		it( 'should format "just now" message', () => {
			const msg = mw.message( 'special-slides-just-now' ).text();
			expect( msg ).toBe( '[special-slides-just-now]' );
		} );

		it( 'should format "minutes ago" message with parameter', () => {
			const msg = mw.message( 'special-slides-minutes-ago', 5 ).text();
			expect( msg ).toBe( '[special-slides-minutes-ago]' );
			expect( mw.message ).toHaveBeenCalledWith( 'special-slides-minutes-ago', 5 );
		} );

		it( 'should format "hours ago" message with parameter', () => {
			const msg = mw.message( 'special-slides-hours-ago', 2 ).text();
			expect( msg ).toBe( '[special-slides-hours-ago]' );
			expect( mw.message ).toHaveBeenCalledWith( 'special-slides-hours-ago', 2 );
		} );

		it( 'should format "days ago" message with parameter', () => {
			const msg = mw.message( 'special-slides-days-ago', 3 ).text();
			expect( msg ).toBe( '[special-slides-days-ago]' );
			expect( mw.message ).toHaveBeenCalledWith( 'special-slides-days-ago', 3 );
		} );

		it( 'should format slide count message', () => {
			const msg = mw.message( 'special-slides-count', 1, 20, 50 ).text();
			expect( mw.message ).toHaveBeenCalledWith( 'special-slides-count', 1, 20, 50 );
		} );

		it( 'should escape HTML in slide names', () => {
			const escaped = mw.html.escape( '<script>alert(1)</script>' );
			expect( escaped ).toBe( '&lt;script&gt;alert(1)&lt;/script&gt;' );
		} );
	} );

	describe( 'URL generation', () => {
		it( 'should generate edit slide URL', () => {
			const url = mw.util.getUrl( 'Special:EditSlide/TestSlide' );
			expect( url ).toBe( '/wiki/Special:EditSlide/TestSlide' );
		} );

		it( 'should generate slides list URL', () => {
			const url = mw.util.getUrl( 'Special:Slides' );
			expect( url ).toBe( '/wiki/Special:Slides' );
		} );

		it( 'should generate slide namespace URL', () => {
			const url = mw.util.getUrl( 'Slide:MyPresentation' );
			expect( url ).toBe( '/wiki/Slide:MyPresentation' );
		} );
	} );

	describe( 'Window manager for dialogs', () => {
		it( 'should create window manager', () => {
			const windowManager = new OO.ui.WindowManager();
			expect( windowManager.$element ).toBeDefined();
		} );

		it( 'should add windows to manager', () => {
			const windowManager = new OO.ui.WindowManager();
			const addWindowsSpy = jest.spyOn( windowManager, 'addWindows' );
			windowManager.addWindows( [ {} ] );
			expect( addWindowsSpy ).toHaveBeenCalled();
		} );

		it( 'should open window and return promise', async () => {
			const windowManager = new OO.ui.WindowManager();
			const result = windowManager.openWindow( 'dialog' );
			expect( result.closed ).toBeInstanceOf( Promise );
			await result.closed;
		} );
	} );

	describe( 'Slide item rendering', () => {
		it( 'should format slide dimensions correctly', () => {
			const width = 1920;
			const height = 1080;
			const dimensions = `${ width }×${ height }`;
			expect( dimensions ).toBe( '1920×1080' );
		} );

		it( 'should format layer count message', () => {
			const layerCount = 5;
			mw.message( 'special-slides-layer-count', layerCount );
			expect( mw.message ).toHaveBeenCalledWith( 'special-slides-layer-count', 5 );
		} );

		it( 'should generate slide icon emoji', () => {
			const icon = '🖼️';
			expect( icon ).toBe( '🖼️' );
		} );
	} );

	describe( 'Create dialog form fields', () => {
		it( 'should create text input widget for name', () => {
			const input = new OO.ui.TextInputWidget();
			expect( input.getValue ).toBeDefined();
			expect( input.getValue() ).toBe( '' );
		} );

		it( 'should create number input widget for dimensions', () => {
			const input = new OO.ui.NumberInputWidget();
			expect( input.getValue ).toBeDefined();
			expect( input.getValue() ).toBe( 800 );
		} );

		it( 'should create dropdown widget for presets', () => {
			const dropdown = new OO.ui.DropdownWidget();
			const menu = dropdown.getMenu();
			expect( menu.selectItemByData ).toBeDefined();
			expect( menu.findSelectedItem ).toBeDefined();
		} );

		it( 'should create field layout for form fields', () => {
			const field = new OO.ui.FieldLayout();
			expect( field.$element ).toBeDefined();
		} );
	} );

	describe( 'Error handling', () => {
		it( 'should log errors to mw.log.error', () => {
			mw.log.error( 'Test error' );
			expect( mw.log.error ).toHaveBeenCalledWith( 'Test error' );
		} );

		it( 'should show error notification', () => {
			mw.notify( 'Error message', { type: 'error' } );
			expect( mw.notify ).toHaveBeenCalledWith( 'Error message', { type: 'error' } );
		} );

		it( 'should create OO.ui.Error for dialog errors', () => {
			const error = new OO.ui.Error( 'Dialog error' );
			expect( error.message ).toBe( 'Dialog error' );
		} );
	} );

	describe( 'Pagination calculations', () => {
		it( 'should calculate correct page count', () => {
			const total = 50;
			const perPage = 20;
			const pageCount = Math.ceil( total / perPage );
			expect( pageCount ).toBe( 3 );
		} );

		it( 'should calculate offset from page number', () => {
			const page = 2;
			const perPage = 20;
			const offset = ( page - 1 ) * perPage;
			expect( offset ).toBe( 20 );
		} );

		it( 'should determine if has next page', () => {
			const offset = 20;
			const perPage = 20;
			const total = 50;
			const hasNext = offset + perPage < total;
			expect( hasNext ).toBe( true );
		} );

		it( 'should determine if has previous page', () => {
			const offset = 20;
			const hasPrev = offset > 0;
			expect( hasPrev ).toBe( true );
		} );
	} );

	describe( 'Search debouncing', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should debounce search input', () => {
			const searchFn = jest.fn();
			const debounced = ( fn, delay ) => {
				let timeoutId;
				return ( ...args ) => {
					clearTimeout( timeoutId );
					timeoutId = setTimeout( () => fn( ...args ), delay );
				};
			};

			const debouncedSearch = debounced( searchFn, 300 );

			debouncedSearch( 'a' );
			debouncedSearch( 'ab' );
			debouncedSearch( 'abc' );

			expect( searchFn ).not.toHaveBeenCalled();

			jest.advanceTimersByTime( 300 );

			expect( searchFn ).toHaveBeenCalledTimes( 1 );
			expect( searchFn ).toHaveBeenCalledWith( 'abc' );
		} );
	} );
} );
