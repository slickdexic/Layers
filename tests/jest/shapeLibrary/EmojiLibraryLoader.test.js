/**
 * Tests for EmojiLibraryLoader.js
 *
 * Covers the per-category shard loading introduced in v1.5.80 (R1.18), which
 * replaced a single 30 MB emoji-bundle.json fetch.
 */

'use strict';

const path = require( 'path' );

const LOADER_PATH = path.join(
	__dirname, '..', '..', '..', 'resources', 'ext.layers.editor',
	'shapeLibrary', 'EmojiLibraryLoader.js'
);

const INDEX_DATA = {
	categories: [
		{ id: 'smileys', name: 'Smileys', icon: '😀', count: 2 },
		{ id: 'hearts', name: 'Hearts', icon: '❤️', count: 1 }
	],
	byCategory: {
		smileys: [
			{ f: 'grin.svg', c: '😀' },
			{ f: 'wink.svg', c: '😉' }
		],
		hearts: [
			{ f: 'heart.svg', c: '❤️' }
		]
	},
	total: 3
};

const SHARDS = {
	smileys: { category: 'smileys', count: 2, emoji: { 'grin.svg': '<svg>grin</svg>', 'wink.svg': '<svg>wink</svg>' } },
	hearts: { category: 'hearts', count: 1, emoji: { 'heart.svg': '<svg>heart</svg>' } }
};

let fetchMock;

/**
 * Load a fresh copy of the loader against a fresh set of globals.
 *
 * @param {Object} [options] Options
 * @param {Object} [options.data] Index data to expose
 * @param {Function} [options.fetch] fetch implementation
 * @return {Object} The window.Layers.EmojiLibrary API
 */
function loadLibrary( options ) {
	const opts = options || {};
	if ( !global.window ) {
		global.window = {};
	}
	global.window.Layers = {
		EmojiLibraryData: opts.data === undefined ? INDEX_DATA : opts.data
	};
	global.window.mw = {
		config: {
			get( key ) {
				if ( key === 'wgExtensionAssetsPath' ) {
					return '/w/extensions';
				}
				if ( key === 'wgLayersVersion' ) {
					return '1.5.80';
				}
				return null;
			}
		}
	};
	global.fetch = opts.fetch || fetchMock;
	global.window.fetch = global.fetch;
	jest.isolateModules( () => {
		require( LOADER_PATH );
	} );
	return global.window.Layers.EmojiLibrary;
}

/**
 * Build a fetch mock that serves the shard fixtures.
 *
 * @return {Function} jest mock
 */
function makeShardFetch() {
	return jest.fn( ( url ) => {
		const match = /emoji\/([a-z]+)\.json/.exec( url );
		const shard = match && SHARDS[ match[ 1 ] ];
		if ( !shard ) {
			return Promise.resolve( { ok: false, status: 404 } );
		}
		return Promise.resolve( {
			ok: true,
			json: () => Promise.resolve( shard )
		} );
	} );
}

describe( 'EmojiLibraryLoader', () => {
	beforeEach( () => {
		fetchMock = makeShardFetch();
	} );

	afterEach( () => {
		if ( global.window ) {
			delete global.window.Layers;
			delete global.window.mw;
			delete global.window.fetch;
		}
		delete global.fetch;
	} );

	describe( 'index passthrough', () => {
		it( 'exposes the categories from the index', () => {
			const lib = loadLibrary();
			expect( lib.getCategories() ).toHaveLength( 2 );
			expect( lib.getCategories()[ 0 ].id ).toBe( 'smileys' );
		} );

		it( 'returns the emoji list for a category', () => {
			const lib = loadLibrary();
			expect( lib.getByCategory( 'smileys' ) ).toHaveLength( 2 );
		} );

		it( 'returns an empty array for an unknown category', () => {
			const lib = loadLibrary();
			expect( lib.getByCategory( 'nope' ) ).toEqual( [] );
		} );

		it( 'reports the total emoji count', () => {
			const lib = loadLibrary();
			expect( lib.getTotalCount() ).toBe( 3 );
		} );

		it( 'degrades to empty data when the index has not loaded', () => {
			const lib = loadLibrary( { data: null } );
			expect( lib.getCategories() ).toEqual( [] );
			expect( lib.getTotalCount() ).toBe( 0 );
		} );
	} );

	describe( 'shard loading', () => {
		it( 'fetches only the shard containing the requested emoji', async () => {
			const lib = loadLibrary();
			await expect( lib.loadSVG( 'grin.svg' ) ).resolves.toBe( '<svg>grin</svg>' );
			expect( fetchMock ).toHaveBeenCalledTimes( 1 );
			expect( fetchMock.mock.calls[ 0 ][ 0 ] ).toContain( 'emoji/smileys.json' );
		} );

		it( 'does not fetch other categories', async () => {
			const lib = loadLibrary();
			await lib.loadSVG( 'grin.svg' );
			expect( fetchMock.mock.calls[ 0 ][ 0 ] ).not.toContain( 'hearts' );
		} );

		it( 'serves a second emoji from the same shard without refetching', async () => {
			const lib = loadLibrary();
			await lib.loadSVG( 'grin.svg' );
			await expect( lib.loadSVG( 'wink.svg' ) ).resolves.toBe( '<svg>wink</svg>' );
			expect( fetchMock ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'deduplicates concurrent requests for the same shard', async () => {
			const lib = loadLibrary();
			await Promise.all( [ lib.loadSVG( 'grin.svg' ), lib.loadSVG( 'wink.svg' ) ] );
			expect( fetchMock ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'fetches a second shard when a different category is needed', async () => {
			const lib = loadLibrary();
			await lib.loadSVG( 'grin.svg' );
			await expect( lib.loadSVG( 'heart.svg' ) ).resolves.toBe( '<svg>heart</svg>' );
			expect( fetchMock ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'builds the URL from wgExtensionAssetsPath', async () => {
			const lib = loadLibrary();
			await lib.loadSVG( 'grin.svg' );
			expect( fetchMock.mock.calls[ 0 ][ 0 ] ).toContain(
				'/w/extensions/Layers/resources/ext.layers.editor/shapeLibrary/emoji/smileys.json'
			);
		} );

		it( 'cache-busts the shard URL with the extension version', async () => {
			const lib = loadLibrary();
			await lib.loadSVG( 'grin.svg' );
			expect( fetchMock.mock.calls[ 0 ][ 0 ] ).toContain( 'version=1.5.80' );
		} );

		it( 'accepts a bare filename-to-svg shard payload', async () => {
			const bare = jest.fn( () => Promise.resolve( {
				ok: true,
				json: () => Promise.resolve( { 'grin.svg': '<svg>bare</svg>' } )
			} ) );
			const lib = loadLibrary( { fetch: bare } );
			await expect( lib.loadSVG( 'grin.svg' ) ).resolves.toBe( '<svg>bare</svg>' );
		} );
	} );

	describe( 'error handling', () => {
		it( 'rejects for an emoji that is not in the index', async () => {
			const lib = loadLibrary();
			await expect( lib.loadSVG( 'nope.svg' ) ).rejects.toThrow( 'Unknown emoji' );
			expect( fetchMock ).not.toHaveBeenCalled();
		} );

		it( 'rejects when the shard request fails', async () => {
			const failing = jest.fn( () => Promise.resolve( { ok: false, status: 500 } ) );
			const lib = loadLibrary( { fetch: failing } );
			await expect( lib.loadSVG( 'grin.svg' ) ).rejects.toThrow( 'Failed to load emoji shard' );
		} );

		it( 'retries after a transient shard failure', async () => {
			let calls = 0;
			const flaky = jest.fn( () => {
				calls++;
				if ( calls === 1 ) {
					return Promise.resolve( { ok: false, status: 503 } );
				}
				return Promise.resolve( {
					ok: true,
					json: () => Promise.resolve( SHARDS.smileys )
				} );
			} );
			const lib = loadLibrary( { fetch: flaky } );
			await expect( lib.loadSVG( 'grin.svg' ) ).rejects.toThrow();
			await expect( lib.loadSVG( 'grin.svg' ) ).resolves.toBe( '<svg>grin</svg>' );
			expect( flaky ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'rejects when the shard omits an indexed emoji', async () => {
			const partial = jest.fn( () => Promise.resolve( {
				ok: true,
				json: () => Promise.resolve( { category: 'smileys', emoji: {} } )
			} ) );
			const lib = loadLibrary( { fetch: partial } );
			await expect( lib.loadSVG( 'grin.svg' ) ).rejects.toThrow( 'Emoji not found in shard' );
		} );
	} );

	describe( 'getCachedSVG', () => {
		it( 'returns null before the shard is loaded', () => {
			const lib = loadLibrary();
			expect( lib.getCachedSVG( 'grin.svg' ) ).toBeNull();
		} );

		it( 'returns the markup once the shard is loaded', async () => {
			const lib = loadLibrary();
			await lib.loadSVG( 'grin.svg' );
			expect( lib.getCachedSVG( 'grin.svg' ) ).toBe( '<svg>grin</svg>' );
		} );

		it( 'never triggers a fetch', () => {
			const lib = loadLibrary();
			lib.getCachedSVG( 'grin.svg' );
			expect( fetchMock ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'preloadCategory', () => {
		it( 'loads the whole category in one request', async () => {
			const lib = loadLibrary();
			await lib.preloadCategory( 'smileys' );
			expect( fetchMock ).toHaveBeenCalledTimes( 1 );
			expect( lib.getCachedSVG( 'wink.svg' ) ).toBe( '<svg>wink</svg>' );
		} );

		it( 'resolves without fetching for an unknown category', async () => {
			const lib = loadLibrary();
			await expect( lib.preloadCategory( 'nope' ) ).resolves.toBeUndefined();
			expect( fetchMock ).not.toHaveBeenCalled();
		} );

		it( 'resolves without fetching when no category is given', async () => {
			const lib = loadLibrary();
			await expect( lib.preloadCategory() ).resolves.toBeUndefined();
			expect( fetchMock ).not.toHaveBeenCalled();
		} );

		it( 'is a no-op once the category is resident', async () => {
			const lib = loadLibrary();
			await lib.preloadCategory( 'smileys' );
			await lib.preloadCategory( 'smileys' );
			expect( fetchMock ).toHaveBeenCalledTimes( 1 );
		} );
	} );

	describe( 'isBundleLoaded', () => {
		it( 'is false for a category that has not been fetched', () => {
			const lib = loadLibrary();
			expect( lib.isBundleLoaded( 'smileys' ) ).toBe( false );
		} );

		it( 'is true for a category that has been fetched', async () => {
			const lib = loadLibrary();
			await lib.preloadCategory( 'smileys' );
			expect( lib.isBundleLoaded( 'smileys' ) ).toBe( true );
		} );

		it( 'is false overall until every category is resident', async () => {
			const lib = loadLibrary();
			await lib.preloadCategory( 'smileys' );
			expect( lib.isBundleLoaded() ).toBe( false );
		} );

		it( 'is true overall once every category is resident', async () => {
			const lib = loadLibrary();
			await lib.preloadCategory( 'smileys' );
			await lib.preloadCategory( 'hearts' );
			expect( lib.isBundleLoaded() ).toBe( true );
		} );

		it( 'is false overall when there are no categories at all', () => {
			const lib = loadLibrary( { data: null } );
			expect( lib.isBundleLoaded() ).toBe( false );
		} );
	} );
} );
