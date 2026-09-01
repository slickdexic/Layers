/**
 * Regression tests for multi-page (PDF) editing.
 *
 * Each test here corresponds to a defect found in the R4 review. They are kept
 * together because the defects were one story: `ls_page` reached the schema and
 * the API but never reached the editor's client-side state, so page 1's work
 * leaked onto page 2 and the guard that should have stopped it was inert.
 */
'use strict';

describe( 'Multi-page (PDF) editing', function () {
	let DraftManager;
	let mockLocalStorage;
	let originalLocalStorage;
	const key = require( '../../resources/ext.layers.shared/FreshnessCacheKey.js' );

	beforeAll( function () {
		const mockLog = jest.fn();
		mockLog.warn = jest.fn();
		mockLog.error = jest.fn();
		global.mw = {
			config: { get: jest.fn( function () {
				return false;
			} ) },
			message: jest.fn( function ( key ) {
				return { text: function () {
					return key;
				}, exists: function () {
					return true;
				} };
			} ),
			notify: jest.fn(),
			log: mockLog
		};
		require( '../../resources/ext.layers.editor/DraftManager.js' );
		DraftManager = window.Layers.Editor.DraftManager;
	} );

	beforeEach( function () {
		originalLocalStorage = global.localStorage;
		mockLocalStorage = {};
		global.localStorage = {
			getItem: jest.fn( function ( k ) {
				return mockLocalStorage[ k ] || null;
			} ),
			setItem: jest.fn( function ( k, v ) {
				mockLocalStorage[ k ] = v;
			} ),
			removeItem: jest.fn( function ( k ) {
				delete mockLocalStorage[ k ];
			} ),
			key: jest.fn( function ( i ) {
				return Object.keys( mockLocalStorage )[ i ] || null;
			} )
		};
		Object.defineProperty( global.localStorage, 'length', {
			get: function () {
				return Object.keys( mockLocalStorage ).length;
			},
			configurable: true
		} );
	} );

	afterEach( function () {
		global.localStorage = originalLocalStorage;
	} );

	/**
	 * Build a minimal editor stub pinned to one page of one file.
	 *
	 * @param {number} page 1-based page number
	 * @param {Array} layers Layers the stub reports as current
	 * @param {string} setName Current layer set name
	 * @return {Object} Editor stub
	 */
	function makeEditor( page, layers, setName ) {
		const state = {
			layers: layers || [],
			currentSetName: setName === undefined ? 'notes' : setName,
			backgroundVisible: true,
			backgroundOpacity: 1
		};
		return {
			filename: 'Doc.pdf',
			page: page,
			pageCount: 10,
			isDirty: function () {
				return true;
			},
			stateManager: {
				get: function ( key ) {
					return state[ key ];
				},
				set: jest.fn( function ( key, value ) {
					state[ key ] = value;
				} ),
				update: jest.fn(),
				subscribe: jest.fn()
			}
		};
	}

	describe( 'draft isolation between pages (R4.02)', function () {
		it( 'gives each page of a document its own storage key', function () {
			const p1 = new DraftManager( makeEditor( 1, [] ) );
			const p2 = new DraftManager( makeEditor( 2, [] ) );
			const p7 = new DraftManager( makeEditor( 7, [] ) );

			expect( p1.getStorageKey() ).not.toBe( p2.getStorageKey() );
			expect( p2.getStorageKey() ).not.toBe( p7.getStorageKey() );
		} );

		it( 'keeps page 1 on the legacy unsuffixed key so old drafts survive', function () {
			const p1 = new DraftManager( makeEditor( 1, [] ) );
			expect( p1.getStorageKey() ).not.toMatch( /-p\d+$/ );
			const p3 = new DraftManager( makeEditor( 3, [] ) );
			expect( p3.getStorageKey() ).toMatch( /-p3$/ );
		} );

		it( 'does not let editing page 2 destroy page 1\'s draft', function () {
			const page1 = new DraftManager( makeEditor( 1, [ { id: 'a' } ] ) );
			page1.saveDraft();
			const key1 = page1.getStorageKey();
			expect( mockLocalStorage[ key1 ] ).toBeDefined();

			const page2 = new DraftManager( makeEditor( 2, [ { id: 'b' } ] ) );
			page2.saveDraft();

			expect( mockLocalStorage[ key1 ] ).toBeDefined();
			expect( JSON.parse( mockLocalStorage[ key1 ] ).layers )
				.toEqual( [ { id: 'a' } ] );
		} );

		it( 'does not offer page 1\'s draft when page 2 is opened', function () {
			const page1 = new DraftManager( makeEditor( 1, [ { id: 'a' } ] ) );
			page1.saveDraft();

			const page2 = new DraftManager( makeEditor( 2, [] ) );

			expect( page2.hasDraft() ).toBe( false );
			expect( page2.loadDraft() ).toBeNull();
		} );

		it( 'records the page on the draft payload', function () {
			const page4 = new DraftManager( makeEditor( 4, [ { id: 'x' } ] ) );
			page4.saveDraft();

			const stored = JSON.parse( mockLocalStorage[ page4.getStorageKey() ] );
			expect( stored.page ).toBe( 4 );
		} );
	} );

	describe( 'draft context validation (R4.13)', function () {
		it( 'refuses a draft whose recorded page differs from the current page', function () {
			const manager = new DraftManager( makeEditor( 3, [] ) );
			mockLocalStorage[ manager.getStorageKey() ] = JSON.stringify( {
				version: 1,
				timestamp: Date.now(),
				page: 5,
				setName: 'notes',
				layers: [ { id: 'stale' } ]
			} );

			expect( manager.loadDraft() ).toBeNull();
		} );

		it( 'refuses a draft whose recorded set differs from the current set', function () {
			const manager = new DraftManager( makeEditor( 1, [], 'notes' ) );
			mockLocalStorage[ manager.getStorageKey() ] = JSON.stringify( {
				version: 1,
				timestamp: Date.now(),
				page: 1,
				setName: 'anatomy',
				layers: [ { id: 'stale' } ]
			} );

			expect( manager.loadDraft() ).toBeNull();
		} );

		it( 'accepts a legacy draft that predates the page and set fields', function () {
			const manager = new DraftManager( makeEditor( 1, [], 'notes' ) );
			mockLocalStorage[ manager.getStorageKey() ] = JSON.stringify( {
				version: 1,
				timestamp: Date.now(),
				layers: [ { id: 'legacy' } ]
			} );

			const draft = manager.loadDraft();
			expect( draft ).not.toBeNull();
			expect( draft.layers ).toEqual( [ { id: 'legacy' } ] );
		} );
	} );

	describe( 'autosave does not cry wolf (R4.14)', function () {
		it( 'reports no write failure when there is simply nothing to save', function () {
			const editor = makeEditor( 1, [] );
			editor.isDirty = function () {
				return false;
			};
			const manager = new DraftManager( editor );

			expect( manager.saveDraft() ).toBe( false );
			expect( manager.lastWriteFailed ).toBe( false );
		} );

		it( 'reports no write failure when the layer list is empty', function () {
			const manager = new DraftManager( makeEditor( 1, [] ) );

			expect( manager.saveDraft() ).toBe( false );
			expect( manager.lastWriteFailed ).toBe( false );
		} );

		it( 'reports a write failure when storage genuinely rejects the write', function () {
			const manager = new DraftManager( makeEditor( 1, [ { id: 'a' } ] ) );
			global.localStorage.setItem = jest.fn( function () {
				throw new Error( 'denied' );
			} );

			expect( manager.saveDraft() ).toBe( false );
			expect( manager.lastWriteFailed ).toBe( true );
		} );
	} );

	describe( 'freshness cache keys (R4.03)', function () {

		it( 'separates pages of the same file and set', function () {
			expect( key.build( 'Doc.pdf', 'notes', 1 ) )
				.not.toBe( key.build( 'Doc.pdf', 'notes', 2 ) );
		} );

		it( 'keeps page 1 on the legacy unsuffixed key', function () {
			expect( key.build( 'Doc.pdf', 'notes', 1 ) ).toBe( 'layers-fresh-Doc.pdf:notes' );
			expect( key.build( 'Doc.pdf', 'notes' ) ).toBe( 'layers-fresh-Doc.pdf:notes' );
		} );

		it( 'normalizes whitespace in filenames', function () {
			expect( key.build( 'My Doc.pdf', '', 1 ) ).toBe( 'layers-fresh-My_Doc.pdf:' );
		} );

		it( 'treats a missing or invalid page as page 1', function () {
			expect( key.build( 'Doc.pdf', 'n', 0 ) ).toBe( key.build( 'Doc.pdf', 'n', 1 ) );
			expect( key.build( 'Doc.pdf', 'n', 'abc' ) ).toBe( key.build( 'Doc.pdf', 'n', 1 ) );
		} );

		it( 'finds every page key for a file and nothing belonging to another', function () {
			const store = {
				'layers-fresh-Doc.pdf:notes': '{}',
				'layers-fresh-Doc.pdf:notes:p4': '{}',
				'layers-fresh-Other.pdf:notes': '{}'
			};
			global.sessionStorage = {
				key: function ( i ) {
					return Object.keys( store )[ i ] || null;
				}
			};
			Object.defineProperty( global.sessionStorage, 'length', {
				get: function () {
					return Object.keys( store ).length;
				}
			} );

			const found = key.findAllForFile( 'Doc.pdf' );
			expect( found ).toContain( 'layers-fresh-Doc.pdf:notes' );
			expect( found ).toContain( 'layers-fresh-Doc.pdf:notes:p4' );
			expect( found ).not.toContain( 'layers-fresh-Other.pdf:notes' );

			delete global.sessionStorage;
		} );
	} );
} );
