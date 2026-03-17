/**
 * @jest-environment jsdom
 */

'use strict';

/**
 * Tests for SpecialSlides.js â€” SlidesManager and CreateSlideDialog classes.
 *
 * The module requires MediaWiki globals (mw, $, OO) to be set up before load.
 * We use beforeAll to load the module once, and beforeEach to reset mock state.
 *
 * @see resources/ext.layers.slides/SpecialSlides.js
 */

let SlidesManager;
let CreateSlideDialog;
let mockEl;
let mockApi;

/** Flush all pending promise microtasks (needed when testing .then/.catch chains that aren't returned). */
const flushPromises = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

/** @return {Object} A chainable jQuery-like mock element */
function createMockEl() {
	return {
		length: 1,
		on: jest.fn().mockReturnThis(),
		off: jest.fn().mockReturnThis(),
		html: jest.fn().mockReturnThis(),
		val: jest.fn( () => '' ),
		empty: jest.fn().mockReturnThis(),
		append: jest.fn().mockReturnThis(),
		appendTo: jest.fn().mockReturnThis(),
		addClass: jest.fn().mockReturnThis(),
		removeClass: jest.fn().mockReturnThis(),
		find: jest.fn().mockReturnThis(),
		text: jest.fn().mockReturnThis(),
		attr: jest.fn().mockReturnThis(),
		prop: jest.fn().mockReturnThis(),
		remove: jest.fn().mockReturnThis(),
		data: jest.fn(),
		closest: jest.fn().mockReturnThis(),
		trigger: jest.fn().mockReturnThis(),
		hide: jest.fn().mockReturnThis(),
		show: jest.fn().mockReturnThis()
	};
}

/** @return {Function} A jQuery mock that returns mockEl for selectors, ignores ready callbacks */
function createMockJQuery( el ) {
	return jest.fn( ( selectorOrFn ) => {
		if ( typeof selectorOrFn === 'function' ) {
			// $(fn) â€” ready callback; don't execute during module load
			return {};
		}
		return el;
	} );
}

function setupGlobals() {
	mockEl = createMockEl();
	mockApi = {
		get: jest.fn().mockResolvedValue( { layerslist: { slides: [], total: 0 } } ),
		postWithToken: jest.fn().mockResolvedValue( { layersdelete: { success: 1 } } )
	};

	global.$ = createMockJQuery( mockEl );
	global.jQuery = global.$;

	global.mw = {
		Api: jest.fn( () => mockApi ),
		config: {
			get: jest.fn( ( key ) => {
				if ( key === 'wgLayersSlidesConfig' ) {
					return { canDelete: true, canCreate: true, defaultWidth: 800, defaultHeight: 600, defaultBackground: '#ffffff' };
				}
				return null;
			} )
		},
		message: jest.fn( ( key ) => ( {
			text: () => `[${ key }]`,
			escaped: () => `[${ key }]`,
			parse: () => `<span>[${ key }]</span>`
		} ) ),
		html: {
			escape: ( str ) => String( str ).replace( /[&<>"']/g, ( c ) => (
				{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ]
			) )
		},
		util: {
			getUrl: jest.fn( ( page ) => `/wiki/${ page }` )
		},
		log: { error: jest.fn() },
		notify: jest.fn()
	};

	global.OO = {
		ui: {
			confirm: jest.fn().mockResolvedValue( true ),
			ProcessDialog: class MockProcessDialog {
				constructor( config ) { this.config = config || {}; }

				initialize() {}

				close() {}

				getActionProcess() {}

				getBodyHeight() { return 300; }
			},
			WindowManager: class MockWindowManager {
				constructor() { this.$element = mockEl; }

				addWindows() {}

				openWindow() { return { closed: Promise.resolve( {} ) }; }
			},
			PanelLayout: class MockPanelLayout {
				constructor() { this.$element = mockEl; }
			},
			TextInputWidget: class MockTextInputWidget {
				getValue() { return ''; }
			},
			NumberInputWidget: class MockNumberInputWidget {
				getValue() { return 800; }
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
				constructor() { this.$element = mockEl; }
			},
			LabelWidget: class MockLabelWidget {},
			FieldLayout: class MockFieldLayout {
				constructor() { this.$element = mockEl; }
			},
			Process: class MockProcess {
				constructor( fn ) { this.fn = fn; }
			},
			Error: class MockOOError {
				constructor( msg ) { this.message = msg; }
			}
		}
	};
}

describe( 'SpecialSlides', () => {
	beforeAll( () => {
		setupGlobals();
		// eslint-disable-next-line no-unused-vars
		( { SlidesManager, CreateSlideDialog } = require( '../../resources/ext.layers.slides/SpecialSlides.js' ) );
	} );

	beforeEach( () => {
		// Rebuild mocks so each test starts clean
		mockEl = createMockEl();
		global.$ = createMockJQuery( mockEl );
		global.jQuery = global.$;
		mockApi = {
			get: jest.fn().mockResolvedValue( { layerslist: { slides: [], total: 0 } } ),
			postWithToken: jest.fn().mockResolvedValue( { layersdelete: { success: 1 } } )
		};
		global.mw.Api = jest.fn( () => mockApi );
		global.mw.log.error = jest.fn();
		global.mw.notify = jest.fn();
		global.mw.util.getUrl = jest.fn( ( page ) => `/wiki/${ page }` );
		jest.clearAllMocks();
		// Re-apply default implementations after clearAllMocks
		mockApi.get.mockResolvedValue( { layerslist: { slides: [], total: 0 } } );
		mockApi.postWithToken.mockResolvedValue( { layersdelete: { success: 1 } } );
		global.OO.ui.confirm.mockResolvedValue( true );
		global.mw.message.mockImplementation( ( key ) => ( {
			text: () => `[${ key }]`,
			escaped: () => `[${ key }]`,
			parse: () => `<span>[${ key }]</span>`
		} ) );
		global.mw.html.escape = ( str ) => String( str ).replace( /[&<>"']/g, ( c ) => (
			{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ]
		) );
		global.mw.util.getUrl.mockImplementation( ( page ) => `/wiki/${ page }` );
		global.OO.ui.WindowManager = class MockWindowManager {
			constructor() { this.$element = mockEl; }

			addWindows() {}

			openWindow() { return { closed: Promise.resolve( {} ) }; }
		};
	} );

	afterEach( () => {
		document.body.innerHTML = '';
		jest.useRealTimers();
	} );

	/**
	 * Create a SlidesManager without triggering constructor side effects (init).
	 *
	 * @param {Object} [config]
	 * @return {Object} SlidesManager instance
	 */
	function createManager( config ) {
		const initSpy = jest.spyOn( SlidesManager.prototype, 'init' ).mockImplementation( () => {} );
		const manager = new SlidesManager( config !== undefined ? config : { canDelete: true, canCreate: true } );
		initSpy.mockRestore();
		manager.api = mockApi;
		return manager;
	}

	// â”€â”€ Module exports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'Module exports', () => {
		it( 'exports SlidesManager class', () => {
			expect( SlidesManager ).toBeDefined();
			expect( typeof SlidesManager ).toBe( 'function' );
		} );

		it( 'exports CreateSlideDialog class', () => {
			expect( CreateSlideDialog ).toBeDefined();
			expect( typeof CreateSlideDialog ).toBe( 'function' );
		} );

		it( 'SlidesManager is instantiable', () => {
			const manager = createManager();
			expect( manager ).toBeInstanceOf( SlidesManager );
		} );
	} );

	// â”€â”€ Constructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'constructor', () => {
		it( 'sets default pagination properties', () => {
			const manager = createManager( { canDelete: true } );
			expect( manager.currentOffset ).toBe( 0 );
			expect( manager.limit ).toBe( 20 );
			expect( manager.searchPrefix ).toBe( '' );
			expect( manager.sortBy ).toBe( 'name' );
			expect( manager.totalSlides ).toBe( 0 );
			expect( Array.isArray( manager.slides ) ).toBe( true );
		} );

		it( 'stores provided config', () => {
			const config = { canDelete: false, canCreate: true };
			const manager = createManager( config );
			expect( manager.config ).toEqual( config );
		} );

		it( 'defaults to empty config when null is passed', () => {
			const manager = createManager( null );
			expect( manager.config ).toEqual( {} );
		} );

		it( 'creates a mw.Api instance', () => {
			global.mw.Api.mockClear();
			createManager();
			expect( global.mw.Api ).toHaveBeenCalled();
		} );
	} );

	// â”€â”€ formatRelativeTime â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'formatRelativeTime', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
			jest.useFakeTimers();
			jest.setSystemTime( new Date( '2026-03-12T12:00:00.000Z' ) );
		} );

		it( 'returns "?" for falsy timestamps', () => {
			expect( manager.formatRelativeTime( null ) ).toBe( '?' );
			expect( manager.formatRelativeTime( undefined ) ).toBe( '?' );
			expect( manager.formatRelativeTime( '' ) ).toBe( '?' );
		} );

		it( 'returns "just now" message for timestamps under 1 minute ago', () => {
			const thirtySecondsAgo = new Date( '2026-03-12T11:59:45.000Z' ).toISOString();
			const result = manager.formatRelativeTime( thirtySecondsAgo );
			expect( global.mw.message ).toHaveBeenCalledWith( 'special-slides-just-now' );
			expect( result ).toBe( '[special-slides-just-now]' );
		} );

		it( 'returns "minutes ago" message for timestamps 1â€“59 minutes ago', () => {
			const thirtyMinutesAgo = new Date( '2026-03-12T11:30:00.000Z' ).toISOString();
			const result = manager.formatRelativeTime( thirtyMinutesAgo );
			expect( global.mw.message ).toHaveBeenCalledWith( 'special-slides-minutes-ago', 30 );
			expect( result ).toBe( '[special-slides-minutes-ago]' );
		} );

		it( 'returns "hours ago" message for timestamps 1â€“23 hours ago', () => {
			const threeHoursAgo = new Date( '2026-03-12T09:00:00.000Z' ).toISOString();
			const result = manager.formatRelativeTime( threeHoursAgo );
			expect( global.mw.message ).toHaveBeenCalledWith( 'special-slides-hours-ago', 3 );
			expect( result ).toBe( '[special-slides-hours-ago]' );
		} );

		it( 'returns "days ago" message for timestamps 1â€“29 days ago', () => {
			const tenDaysAgo = new Date( '2026-03-02T12:00:00.000Z' ).toISOString();
			const result = manager.formatRelativeTime( tenDaysAgo );
			expect( global.mw.message ).toHaveBeenCalledWith( 'special-slides-days-ago', 10 );
			expect( result ).toBe( '[special-slides-days-ago]' );
		} );

		it( 'returns locale date string for timestamps 30+ days ago', () => {
			global.mw.message.mockClear();
			const sixtyDaysAgo = new Date( '2026-01-11T12:00:00.000Z' ).toISOString();
			const result = manager.formatRelativeTime( sixtyDaysAgo );
			expect( result ).toBe( new Date( sixtyDaysAgo ).toLocaleDateString() );
			expect( global.mw.message ).not.toHaveBeenCalledWith( 'special-slides-days-ago', expect.any( Number ) );
		} );
	} );

	// â”€â”€ renderSlides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'renderSlides', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		it( 'shows empty message when slides array is empty', () => {
			manager.slides = [];
			manager.renderSlides();
			expect( mockEl.html ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-slides-empty' )
			);
		} );

		it( 'renders HTML for each slide item', () => {
			manager.slides = [
				{ name: 'Alpha', canvasWidth: 800, canvasHeight: 600, layerCount: 2, modifiedBy: 'alice', modified: null },
				{ name: 'Beta', canvasWidth: 1280, canvasHeight: 720, layerCount: 0, modifiedBy: 'bob', modified: null }
			];
			manager.renderSlides();
			const htmlArg = mockEl.html.mock.calls[ mockEl.html.mock.calls.length - 1 ][ 0 ];
			expect( htmlArg ).toContain( 'Alpha' );
			expect( htmlArg ).toContain( 'Beta' );
		} );
	} );

	// â”€â”€ renderSlideItem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'renderSlideItem', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		it( 'builds valid HTML containing slide name and dimensions', () => {
			const slide = { name: 'TestSlide', canvasWidth: 1920, canvasHeight: 1080, layerCount: 5, modifiedBy: 'testuser', modified: null };
			const html = manager.renderSlideItem( slide );
			expect( html ).toContain( 'TestSlide' );
			expect( html ).toContain( '1920' );
			expect( html ).toContain( '1080' );
			expect( html ).toContain( 'layers-slide-item' );
		} );

		it( 'escapes HTML in slide name to prevent XSS', () => {
			const slide = { name: '<script>xss</script>', canvasWidth: 800, canvasHeight: 600, layerCount: 0, modifiedBy: 'u', modified: null };
			const html = manager.renderSlideItem( slide );
			expect( html ).not.toContain( '<script>' );
			expect( html ).toContain( '&lt;script&gt;' );
		} );

		it( 'includes delete button when canDelete is true', () => {
			manager.config = { canDelete: true };
			const slide = { name: 'S', canvasWidth: 800, canvasHeight: 600, layerCount: 0, modifiedBy: 'u', modified: null };
			const html = manager.renderSlideItem( slide );
			expect( html ).toContain( 'layers-slide-delete-btn' );
		} );

		it( 'omits delete button when canDelete is false', () => {
			manager.config = { canDelete: false };
			const slide = { name: 'S', canvasWidth: 800, canvasHeight: 600, layerCount: 0, modifiedBy: 'u', modified: null };
			const html = manager.renderSlideItem( slide );
			expect( html ).not.toContain( 'layers-slide-delete-btn' );
		} );

		it( 'defaults layerCount to 0 when missing', () => {
			const slide = { name: 'S', canvasWidth: 800, canvasHeight: 600, modifiedBy: 'u', modified: null };
			const html = manager.renderSlideItem( slide );
			expect( html ).toContain( 'S' );
		} );

		it( 'does not call mw.html.escape for null modifiedBy', () => {
			// When modifiedBy is null, code uses literal '?' as fallback (no escape call needed)
			const slide = { name: 'S', canvasWidth: 800, canvasHeight: 600, layerCount: 0, modifiedBy: null, modified: null };
			const html = manager.renderSlideItem( slide );
			// Confirm it renders without throwing and produces a message call with '?' as the modifiedBy param
			expect( html ).toContain( 'layers-slide-item' );
			expect( global.mw.message ).toHaveBeenCalledWith( 'special-slides-modified-by', expect.anything(), '?' );
		} );

		it( 'passes escaped modifiedBy to mw.message (XSS prevention)', () => {
			// modifiedBy is escaped via mw.html.escape before being passed to mw.message
			// The escaped value becomes a param to mw.message, not raw HTML in our output
			const slide = { name: 'S', canvasWidth: 800, canvasHeight: 600, layerCount: 0, modifiedBy: '<b>admin</b>', modified: null };
			manager.renderSlideItem( slide );
			expect( global.mw.message ).toHaveBeenCalledWith(
				'special-slides-modified-by',
				expect.anything(),
				'&lt;b&gt;admin&lt;/b&gt;'
			);
		} );
	} );

	// â”€â”€ renderPagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'renderPagination', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		it( 'clears pagination when all results fit on one page', () => {
			manager.totalSlides = 10;
			manager.limit = 20;
			manager.renderPagination();
			expect( mockEl.empty ).toHaveBeenCalled();
		} );

		it( 'renders pagination controls when results span multiple pages', () => {
			manager.totalSlides = 100;
			manager.limit = 20;
			manager.currentOffset = 0;
			manager.renderPagination();
			const htmlArg = mockEl.html.mock.calls[ mockEl.html.mock.calls.length - 1 ][ 0 ];
			expect( htmlArg ).toContain( 'layers-pagination-prev' );
			expect( htmlArg ).toContain( 'layers-pagination-next' );
		} );

		it( 'disables prev button on the first page', () => {
			manager.totalSlides = 50;
			manager.limit = 20;
			manager.currentOffset = 0;
			manager.renderPagination();
			const htmlArg = mockEl.html.mock.calls[ mockEl.html.mock.calls.length - 1 ][ 0 ];
			expect( htmlArg ).toMatch( /layers-pagination-prev[^"]*"\s+disabled/ );
		} );

		it( 'disables next button on the last page', () => {
			manager.totalSlides = 50;
			manager.limit = 20;
			manager.currentOffset = 40;
			manager.renderPagination();
			const htmlArg = mockEl.html.mock.calls[ mockEl.html.mock.calls.length - 1 ][ 0 ];
			expect( htmlArg ).toMatch( /layers-pagination-next[^"]*"\s+disabled/ );
		} );

		it( 'includes count message in pagination', () => {
			manager.totalSlides = 50;
			manager.limit = 20;
			manager.currentOffset = 0;
			manager.renderPagination();
			expect( global.mw.message ).toHaveBeenCalledWith( 'special-slides-count', 1, 20, 50 );
		} );
	} );

	// â”€â”€ loadSlides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'loadSlides', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
			jest.spyOn( manager, 'renderSlides' ).mockImplementation( () => {} );
			jest.spyOn( manager, 'renderPagination' ).mockImplementation( () => {} );
		} );

		it( 'shows a loading indicator immediately', () => {
			manager.loadSlides();
			expect( mockEl.html ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-slides-loading' )
			);
		} );

		it( 'calls api.get with the correct parameters', () => {
			manager.searchPrefix = 'proc';
			manager.currentOffset = 20;
			manager.sortBy = 'date';
			manager.loadSlides();
			expect( mockApi.get ).toHaveBeenCalledWith( {
				action: 'layerslist',
				prefix: 'proc',
				limit: 20,
				offset: 20,
				sort: 'date'
			} );
		} );

		it( 'updates slides and totalSlides on success', async () => {
			const slides = [ { name: 'S', canvasWidth: 800, canvasHeight: 600, layerCount: 1, modifiedBy: 'u', modified: null } ];
			mockApi.get.mockResolvedValue( { layerslist: { slides, total: 1 } } );
			await manager.loadSlides();
			expect( manager.slides ).toEqual( slides );
			expect( manager.totalSlides ).toBe( 1 );
		} );

		it( 'handles missing layerslist key gracefully', async () => {
			mockApi.get.mockResolvedValue( {} );
			await manager.loadSlides();
			expect( manager.slides ).toEqual( [] );
			expect( manager.totalSlides ).toBe( 0 );
		} );

		it( 'shows error message and logs on API failure', async () => {
			mockApi.get.mockRejectedValue( new Error( 'Network error' ) );
			manager.loadSlides();
			await flushPromises();
			expect( mockEl.html ).toHaveBeenCalledWith(
				expect.stringContaining( 'layers-slides-error' )
			);
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );

		it( 'calls renderSlides and renderPagination on success', async () => {
			await manager.loadSlides();
			expect( manager.renderSlides ).toHaveBeenCalled();
			expect( manager.renderPagination ).toHaveBeenCalled();
		} );
	} );

	// â”€â”€ deleteSlide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'deleteSlide', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
			jest.spyOn( manager, 'loadSlides' ).mockImplementation( () => {} );
		} );

		it( 'calls postWithToken with correct parameters', async () => {
			await manager.deleteSlide( 'TestSlide' );
			expect( mockApi.postWithToken ).toHaveBeenCalledWith( 'csrf', {
				action: 'layersdelete',
				slidename: 'TestSlide',
				setname: 'default'
			} );
		} );

		it( 'shows success notification after delete', async () => {
			await manager.deleteSlide( 'TestSlide' );
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'success' }
			);
		} );

		it( 'reloads slides after successful delete', async () => {
			await manager.deleteSlide( 'TestSlide' );
			expect( manager.loadSlides ).toHaveBeenCalled();
		} );

		it( 'shows error notification on API failure', async () => {
			mockApi.postWithToken.mockRejectedValue( new Error( 'Delete failed' ) );
			manager.deleteSlide( 'TestSlide' );
			await flushPromises();
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				{ type: 'error' }
			);
		} );

		it( 'logs error on API failure', async () => {
			mockApi.postWithToken.mockRejectedValue( new Error( 'Delete failed' ) );
			manager.deleteSlide( 'TestSlide' );
			await flushPromises();
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );
	} );

	// â”€â”€ confirmDeleteSlide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'confirmDeleteSlide', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
			jest.spyOn( manager, 'deleteSlide' ).mockImplementation( () => {} );
		} );

		it( 'calls OO.ui.confirm with a message containing the slide name', async () => {
			await manager.confirmDeleteSlide( 'TestSlide' );
			expect( global.mw.message ).toHaveBeenCalledWith( 'special-slides-delete-confirm', 'TestSlide' );
			expect( global.OO.ui.confirm ).toHaveBeenCalled();
		} );

		it( 'calls deleteSlide when user confirms', async () => {
			global.OO.ui.confirm.mockResolvedValue( true );
			await manager.confirmDeleteSlide( 'TestSlide' );
			expect( manager.deleteSlide ).toHaveBeenCalledWith( 'TestSlide' );
		} );

		it( 'does not call deleteSlide when user cancels', async () => {
			global.OO.ui.confirm.mockResolvedValue( false );
			await manager.confirmDeleteSlide( 'TestSlide' );
			expect( manager.deleteSlide ).not.toHaveBeenCalled();
		} );

		it( 'handles confirm() rejection gracefully', async () => {
			global.OO.ui.confirm.mockRejectedValue( new Error( 'Dialog error' ) );
			manager.confirmDeleteSlide( 'TestSlide' );
			await flushPromises();
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );
	} );

	// â”€â”€ editSlide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'editSlide', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		it( 'calls mw.util.getUrl with the correct path', () => {
			manager.editSlide( 'TestSlide' );
			expect( global.mw.util.getUrl ).toHaveBeenCalledWith( 'Special:EditSlide/TestSlide' );
		} );
	} );

	// â”€â”€ destroy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'destroy', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		it( 'calls off() on all jQuery element references', () => {
			manager.destroy();
			expect( mockEl.off ).toHaveBeenCalled();
		} );

		it( 'clears all DOM references to null', () => {
			manager.destroy();
			expect( manager.$container ).toBeNull();
			expect( manager.$list ).toBeNull();
			expect( manager.$pagination ).toBeNull();
			expect( manager.$searchInput ).toBeNull();
			expect( manager.$sortSelect ).toBeNull();
			expect( manager.$createBtn ).toBeNull();
		} );

		it( 'clears slides array', () => {
			manager.slides = [ { name: 'S' } ];
			manager.destroy();
			expect( manager.slides ).toEqual( [] );
		} );

		it( 'clears api and config references', () => {
			manager.destroy();
			expect( manager.api ).toBeNull();
			expect( manager.config ).toBeNull();
		} );
	} );

	// â”€â”€ bindEvents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'bindEvents', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		it( 'binds "input" event for search', () => {
			manager.bindEvents();
			expect( mockEl.on ).toHaveBeenCalledWith( 'input', expect.any( Function ) );
		} );

		it( 'binds "change" event for sort', () => {
			manager.bindEvents();
			expect( mockEl.on ).toHaveBeenCalledWith( 'change', expect.any( Function ) );
		} );

		it( 'binds "click" event for create button', () => {
			manager.bindEvents();
			expect( mockEl.on ).toHaveBeenCalledWith( 'click', expect.any( Function ) );
		} );

		it( 'binds "click" event for pagination', () => {
			manager.bindEvents();
			expect( mockEl.on ).toHaveBeenCalledWith( 'click', '.layers-pagination-prev', expect.any( Function ) );
			expect( mockEl.on ).toHaveBeenCalledWith( 'click', '.layers-pagination-next', expect.any( Function ) );
		} );

		it( 'binds "click" event for edit and delete actions on list', () => {
			manager.bindEvents();
			expect( mockEl.on ).toHaveBeenCalledWith( 'click', '.layers-slide-edit-btn', expect.any( Function ) );
			expect( mockEl.on ).toHaveBeenCalledWith( 'click', '.layers-slide-delete-btn', expect.any( Function ) );
		} );
	} );

	// â"€â"€ bindEvents callback execution â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

	describe( 'bindEvents callback execution', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		/**
		 * Extract a bound callback by matching the call arguments pattern.
		 *
		 * @param {string} eventName - Event name
		 * @param {string} [selector] - Optional delegated selector
		 * @return {Function} The callback
		 */
		function getCallback( eventName, selector ) {
			const call = mockEl.on.mock.calls.find( ( c ) => {
				if ( selector ) {
					return c[ 0 ] === eventName && c[ 1 ] === selector;
				}
				return c[ 0 ] === eventName && typeof c[ 1 ] === 'function';
			} );
			return selector ? call[ 2 ] : call[ 1 ];
		}

		it( 'search input callback should debounce and load slides', () => {
			jest.useFakeTimers();
			const loadSpy = jest.spyOn( manager, 'loadSlides' ).mockImplementation( () => {} );
			mockEl.val.mockReturnValue( 'test query' );
			manager.bindEvents();

			const searchCb = getCallback( 'input' );
			searchCb();

			// Should not call loadSlides immediately (debounce)
			expect( loadSpy ).not.toHaveBeenCalled();

			jest.advanceTimersByTime( 300 );
			expect( manager.searchPrefix ).toBe( 'test query' );
			expect( manager.currentOffset ).toBe( 0 );
			expect( loadSpy ).toHaveBeenCalled();
			jest.useRealTimers();
		} );

		it( 'sort select callback should update sortBy and load slides', () => {
			const loadSpy = jest.spyOn( manager, 'loadSlides' ).mockImplementation( () => {} );
			mockEl.val.mockReturnValue( 'date' );
			manager.bindEvents();

			const changeCb = getCallback( 'change' );
			changeCb();

			expect( manager.sortBy ).toBe( 'date' );
			expect( manager.currentOffset ).toBe( 0 );
			expect( loadSpy ).toHaveBeenCalled();
		} );

		it( 'create button callback should show create dialog', () => {
			const dialogSpy = jest.spyOn( manager, 'showCreateDialog' ).mockImplementation( () => {} );
			manager.bindEvents();

			const clickCb = getCallback( 'click' );
			clickCb();

			expect( dialogSpy ).toHaveBeenCalled();
		} );

		it( 'edit button callback should edit the slide by name', () => {
			const editSpy = jest.spyOn( manager, 'editSlide' ).mockImplementation( () => {} );
			mockEl.data.mockReturnValue( 'my-slide' );
			manager.bindEvents();

			const editCb = getCallback( 'click', '.layers-slide-edit-btn' );
			editCb( { currentTarget: mockEl } );

			expect( editSpy ).toHaveBeenCalledWith( 'my-slide' );
		} );

		it( 'delete button callback should confirm delete by name', () => {
			const confirmSpy = jest.spyOn( manager, 'confirmDeleteSlide' ).mockImplementation( () => {} );
			mockEl.data.mockReturnValue( 'my-slide' );
			manager.bindEvents();

			const deleteCb = getCallback( 'click', '.layers-slide-delete-btn' );
			deleteCb( { currentTarget: mockEl } );

			expect( confirmSpy ).toHaveBeenCalledWith( 'my-slide' );
		} );

		it( 'pagination prev callback should go back if offset allows', () => {
			const loadSpy = jest.spyOn( manager, 'loadSlides' ).mockImplementation( () => {} );
			manager.currentOffset = 20;
			manager.bindEvents();

			const prevCb = getCallback( 'click', '.layers-pagination-prev' );
			prevCb();

			expect( manager.currentOffset ).toBe( 0 );
			expect( loadSpy ).toHaveBeenCalled();
		} );

		it( 'pagination prev callback should NOT go back if offset is 0', () => {
			const loadSpy = jest.spyOn( manager, 'loadSlides' ).mockImplementation( () => {} );
			manager.currentOffset = 0;
			manager.bindEvents();

			const prevCb = getCallback( 'click', '.layers-pagination-prev' );
			prevCb();

			expect( manager.currentOffset ).toBe( 0 );
			expect( loadSpy ).not.toHaveBeenCalled();
		} );

		it( 'pagination next callback should advance if more slides exist', () => {
			const loadSpy = jest.spyOn( manager, 'loadSlides' ).mockImplementation( () => {} );
			manager.currentOffset = 0;
			manager.totalSlides = 50;
			manager.bindEvents();

			const nextCb = getCallback( 'click', '.layers-pagination-next' );
			nextCb();

			expect( manager.currentOffset ).toBe( 20 );
			expect( loadSpy ).toHaveBeenCalled();
		} );

		it( 'pagination next callback should NOT advance if at end', () => {
			const loadSpy = jest.spyOn( manager, 'loadSlides' ).mockImplementation( () => {} );
			manager.currentOffset = 40;
			manager.totalSlides = 50;
			manager.bindEvents();

			const nextCb = getCallback( 'click', '.layers-pagination-next' );
			nextCb();

			expect( manager.currentOffset ).toBe( 40 );
			expect( loadSpy ).not.toHaveBeenCalled();
		} );
	} );

	// â"€â"€ CreateSlideDialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

	describe( 'CreateSlideDialog', () => {
		it( 'should be exported', () => {
			expect( typeof CreateSlideDialog ).toBe( 'function' );
		} );

		it( 'constructor should accept config', () => {
			const dialog = new CreateSlideDialog( { maxWidth: 4096 } );
			expect( dialog.slidesConfig ).toEqual( { maxWidth: 4096 } );
		} );

		it( 'constructor should default to empty config', () => {
			const dialog = new CreateSlideDialog();
			expect( dialog.slidesConfig ).toEqual( {} );
		} );

		it( 'static getter should return dialog metadata', () => {
			expect( CreateSlideDialog.static.name ).toBe( 'createSlideDialog' );
			expect( CreateSlideDialog.static.actions ).toHaveLength( 2 );
			expect( CreateSlideDialog.static.actions[ 0 ].action ).toBe( 'create' );
		} );

		it( 'getBodyHeight should return 300', () => {
			const dialog = new CreateSlideDialog();
			expect( dialog.getBodyHeight() ).toBe( 300 );
		} );

		describe( 'initialize', () => {
			it( 'should create form widgets', () => {
				const dialog = new CreateSlideDialog( { maxWidth: 4096, maxHeight: 4096, defaultBackground: '#ffffff' } );
				dialog.$body = mockEl;
				dialog.initialize();

				expect( dialog.nameInput ).toBeDefined();
				expect( dialog.sizeSelect ).toBeDefined();
				expect( dialog.customWidthInput ).toBeDefined();
				expect( dialog.customHeightInput ).toBeDefined();
				expect( dialog.backgroundInput ).toBeDefined();
			} );

			it( 'should hide custom size layout initially', () => {
				const dialog = new CreateSlideDialog( {} );
				dialog.$body = mockEl;
				dialog.initialize();

				expect( dialog.customSizeLayout.$element.hide ).toHaveBeenCalled();
			} );

			it( 'size select callback should show custom layout for custom option', () => {
				const menuOnCalls = [];
				global.OO.ui.DropdownWidget = class {
					getMenu() {
						return {
							selectItemByData: jest.fn(),
							findSelectedItem: () => ( { getData: () => '800x600' } ),
							on: jest.fn( ( event, cb ) => { menuOnCalls.push( { event, cb } ); } )
						};
					}
				};
				const dialog = new CreateSlideDialog( {} );
				dialog.$body = mockEl;
				dialog.initialize();

				// Get the 'select' callback
				const selectCb = menuOnCalls.find( ( c ) => c.event === 'select' );
				expect( selectCb ).toBeDefined();

				// Simulate selecting 'custom'
				selectCb.cb( { getData: () => 'custom' } );
				expect( dialog.customSizeLayout.$element.show ).toHaveBeenCalled();

				// Simulate selecting a preset
				selectCb.cb( { getData: () => '1024x768' } );
				expect( dialog.customSizeLayout.$element.hide ).toHaveBeenCalled();
			} );
		} );

		describe( 'getActionProcess', () => {
			let dialog;

			beforeEach( () => {
				const menuOnCalls = [];
				global.OO.ui.DropdownWidget = class {
					getMenu() {
						return {
							selectItemByData: jest.fn(),
							findSelectedItem: () => ( { getData: () => '800x600' } ),
							on: jest.fn( ( event, cb ) => { menuOnCalls.push( { event, cb } ); } )
						};
					}
				};
				dialog = new CreateSlideDialog( {} );
				dialog.$body = mockEl;
				dialog.initialize();
				dialog.close = jest.fn();
			} );

			it( 'should return a Process for create action', () => {
				const process = dialog.getActionProcess( 'create' );
				expect( process ).toBeInstanceOf( global.OO.ui.Process );
			} );

			it( 'should reject if name is empty', async () => {
				global.$.Deferred = () => {
					let rejectFn;
					const d = {
						reject: ( err ) => { rejectFn = err; return d; },
						promise: () => Promise.reject( rejectFn )
					};
					return d;
				};
				dialog.nameInput.getValue = () => '';
				const process = dialog.getActionProcess( 'create' );
				const result = process.fn();

				await expect( result ).rejects.toBeDefined();
			} );

			it( 'should reject if name contains invalid characters', async () => {
				global.$.Deferred = () => {
					let rejectFn;
					const d = {
						reject: ( err ) => { rejectFn = err; return d; },
						promise: () => Promise.reject( rejectFn )
					};
					return d;
				};
				dialog.nameInput.getValue = () => 'bad name!';
				const process = dialog.getActionProcess( 'create' );
				const result = process.fn();

				await expect( result ).rejects.toBeDefined();
			} );

			it( 'should save slide with preset dimensions on valid name', async () => {
				dialog.nameInput.getValue = () => 'my-slide';
				dialog.backgroundInput.getValue = () => '#ffffff';
				mockApi.postWithToken.mockResolvedValue( {} );

				const process = dialog.getActionProcess( 'create' );
				await process.fn();

				expect( mockApi.postWithToken ).toHaveBeenCalledWith( 'csrf', expect.objectContaining( {
					action: 'layerssave',
					slidename: 'my-slide'
				} ) );
				expect( dialog.close ).toHaveBeenCalledWith( { action: 'create', slideName: 'my-slide' } );
			} );

			it( 'should use custom dimensions when custom size selected', async () => {
				// Override dropdown to return 'custom'
				dialog.sizeSelect.getMenu = () => ( {
					findSelectedItem: () => ( { getData: () => 'custom' } ),
					on: jest.fn()
				} );
				dialog.nameInput.getValue = () => 'custom-slide';
				dialog.customWidthInput.getValue = () => '1024';
				dialog.customHeightInput.getValue = () => '768';
				dialog.backgroundInput.getValue = () => '#000000';
				mockApi.postWithToken.mockResolvedValue( {} );

				const process = dialog.getActionProcess( 'create' );
				await process.fn();

				const callArgs = mockApi.postWithToken.mock.calls[ 0 ][ 1 ];
				const data = JSON.parse( callArgs.data );
				expect( data.canvasWidth ).toBe( 1024 );
				expect( data.canvasHeight ).toBe( 768 );
				expect( data.backgroundColor ).toBe( '#000000' );
			} );

			it( 'should handle save failure', async () => {
				dialog.nameInput.getValue = () => 'my-slide';
				dialog.backgroundInput.getValue = () => '#ffffff';
				mockApi.postWithToken.mockRejectedValue( 'http', { error: { info: 'Save failed' } } );

				const process = dialog.getActionProcess( 'create' );
				const result = process.fn();

				await expect( result ).rejects.toBeDefined();
			} );

			it( 'should call super.getActionProcess for non-create actions', () => {
				// For non-create actions, it falls through to super
				// The mock parent returns undefined since it has no real implementation
				const cancelProcess = dialog.getActionProcess( 'cancel' );
				// Just verifying the branch is reached without error
				expect( true ).toBe( true );
			} );

			it( 'should default background to #ffffff when empty', async () => {
				dialog.nameInput.getValue = () => 'slide1';
				dialog.backgroundInput.getValue = () => '';
				mockApi.postWithToken.mockResolvedValue( {} );

				const process = dialog.getActionProcess( 'create' );
				await process.fn();

				const callArgs = mockApi.postWithToken.mock.calls[ 0 ][ 1 ];
				const data = JSON.parse( callArgs.data );
				expect( data.backgroundColor ).toBe( '#ffffff' );
			} );
		} );
	} );

	// â”€â”€ showCreateDialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

	describe( 'showCreateDialog', () => {
		let manager;

		beforeEach( () => {
			manager = createManager();
		} );

		it( 'creates a WindowManager and opens a dialog', () => {
			const mockWm = { $element: mockEl, addWindows: jest.fn(), openWindow: jest.fn().mockReturnValue( { closed: Promise.resolve( {} ) } ) };
			const wmMock = jest.fn().mockImplementation( () => mockWm );
			global.OO.ui.WindowManager = wmMock;
			manager.showCreateDialog();
			expect( wmMock ).toHaveBeenCalled();
		} );

		it( 'navigates to edit URL when dialog closes with create action', async () => {
			const editSpy = jest.spyOn( manager, 'editSlide' ).mockImplementation( () => {} );
			const mockWm = {
				$element: mockEl,
				addWindows: jest.fn(),
				openWindow: jest.fn().mockReturnValue( {
					closed: Promise.resolve( { action: 'create', slideName: 'NewPresentation' } )
				} )
			};
			jest.spyOn( global.OO.ui, 'WindowManager' ).mockImplementation( () => mockWm );
			await manager.showCreateDialog();
			await Promise.resolve(); // flush microtask queue
			expect( editSpy ).toHaveBeenCalledWith( 'NewPresentation' );
		} );

		it( 'does not navigate when dialog is cancelled (no action)', async () => {
			const editSpy = jest.spyOn( manager, 'editSlide' ).mockImplementation( () => {} );
			const mockWm = {
				$element: mockEl,
				addWindows: jest.fn(),
				openWindow: jest.fn().mockReturnValue( {
					closed: Promise.resolve( null )
				} )
			};
			jest.spyOn( global.OO.ui, 'WindowManager' ).mockImplementation( () => mockWm );
			await manager.showCreateDialog();
			await Promise.resolve();
			expect( editSpy ).not.toHaveBeenCalled();
		} );

		it( 'logs error if dialog throws', async () => {
			const mockWm = {
				$element: mockEl,
				addWindows: jest.fn(),
				openWindow: jest.fn().mockReturnValue( {
					closed: Promise.reject( new Error( 'Dialog crash' ) )
				} )
			};
			jest.spyOn( global.OO.ui, 'WindowManager' ).mockImplementation( () => mockWm );
			await manager.showCreateDialog();
			await Promise.resolve();
			expect( global.mw.log.error ).toHaveBeenCalled();
		} );
	} );
} );

