/**
 * Emoji Library runtime API for the Layers extension.
 *
 * `EmojiLibraryIndex.js` is machine-generated and holds nothing but the emoji
 * metadata. This file holds the hand-maintained behaviour: fetching SVG data,
 * caching it, and exposing the `window.Layers.EmojiLibrary` API that
 * `EmojiPickerPanel.js` consumes.
 *
 * SVG data is stored as one JSON shard per category under `emoji/`. The picker
 * only ever displays one category at a time, so only that category's shard is
 * fetched. The previous single-file bundle forced a 30 MB download before the
 * first glyph could be drawn; the largest shard is a fraction of that and most
 * are under 2 MB.
 *
 * @file
 */

( function () {
	'use strict';

	const SHARD_PATH =
		'/Layers/resources/ext.layers.editor/shapeLibrary/emoji/';

	const data = ( window.Layers && window.Layers.EmojiLibraryData ) || {
		categories: [],
		byCategory: {},
		total: 0
	};

	// Resolved SVG markup, keyed by filename. Populated as shards arrive.
	const svgCache = {};

	// In-flight or settled shard fetches, keyed by category id.
	const shardPromises = {};

	// Category ids whose shard has been fully merged into svgCache.
	const loadedShards = {};

	// Lazily built filename -> category id lookup.
	let fileToCategory = null;

	/**
	 * Build (once) the filename -> category id lookup used to decide which
	 * shard holds a given emoji.
	 *
	 * @return {Object} Map of filename to category id
	 */
	function getFileToCategory() {
		if ( fileToCategory ) {
			return fileToCategory;
		}
		fileToCategory = {};
		for ( let i = 0; i < data.categories.length; i++ ) {
			const categoryId = data.categories[ i ].id;
			const entries = data.byCategory[ categoryId ] || [];
			for ( let j = 0; j < entries.length; j++ ) {
				if ( !fileToCategory[ entries[ j ].f ] ) {
					fileToCategory[ entries[ j ].f ] = categoryId;
				}
			}
		}
		return fileToCategory;
	}

	/**
	 * Absolute URL of a category shard.
	 *
	 * The extension version is appended as a cache buster. Shards are fetched
	 * directly rather than through ResourceLoader, so without it a browser or
	 * intermediate cache would keep serving the previous release's emoji data
	 * indefinitely.
	 *
	 * @param {string} categoryId Category id
	 * @return {string} Shard URL
	 */
	function shardUrl( categoryId ) {
		const assets = ( window.mw && window.mw.config &&
			window.mw.config.get( 'wgExtensionAssetsPath' ) ) || '';
		const version = ( window.mw && window.mw.config &&
			window.mw.config.get( 'wgLayersVersion' ) ) || '0';
		return assets + SHARD_PATH + categoryId + '.json' +
			'?version=' + encodeURIComponent( version );
	}

	/**
	 * Fetch and cache one category shard.
	 *
	 * @param {string} categoryId Category id
	 * @return {Promise} Resolves once the shard is merged into the cache
	 */
	function loadShard( categoryId ) {
		if ( loadedShards[ categoryId ] ) {
			return Promise.resolve();
		}
		if ( shardPromises[ categoryId ] ) {
			return shardPromises[ categoryId ];
		}

		shardPromises[ categoryId ] = fetch( shardUrl( categoryId ) )
			.then( ( response ) => {
				if ( !response.ok ) {
					throw new Error(
						'Failed to load emoji shard: ' + categoryId
					);
				}
				return response.json();
			} )
			.then( ( payload ) => {
				const svgs = payload.emoji || payload;
				for ( const filename in svgs ) {
					if ( Object.prototype.hasOwnProperty.call( svgs, filename ) ) {
						svgCache[ filename ] = svgs[ filename ];
					}
				}
				loadedShards[ categoryId ] = true;
			} )
			.catch( ( error ) => {
				// Drop the memoised rejection so a transient network failure
				// does not permanently disable the category.
				delete shardPromises[ categoryId ];
				throw error;
			} );

		return shardPromises[ categoryId ];
	}

	window.Layers = window.Layers || {};
	window.Layers.EmojiLibrary = {
		/**
		 * Get all categories.
		 *
		 * @return {Object[]} Category descriptors
		 */
		getCategories() {
			return data.categories;
		},

		/**
		 * Get the emoji list for a category (metadata only, no SVG).
		 *
		 * @param {string} categoryId Category id
		 * @return {Object[]} Array of { f: filename, c: char, ... }
		 */
		getByCategory( categoryId ) {
			return data.byCategory[ categoryId ] || [];
		},

		/**
		 * Load the SVG markup for one emoji.
		 *
		 * @param {string} filename e.g. "emoji_u1f600.svg"
		 * @return {Promise<string>} SVG content
		 */
		loadSVG( filename ) {
			if ( svgCache[ filename ] ) {
				return Promise.resolve( svgCache[ filename ] );
			}

			const categoryId = getFileToCategory()[ filename ];
			if ( !categoryId ) {
				return Promise.reject(
					new Error( 'Unknown emoji: ' + filename )
				);
			}

			return loadShard( categoryId ).then( () => {
				const svg = svgCache[ filename ];
				if ( !svg ) {
					throw new Error(
						'Emoji not found in shard ' + categoryId + ': ' + filename
					);
				}
				return svg;
			} );
		},

		/**
		 * Get already-loaded SVG markup without triggering a fetch.
		 *
		 * @param {string} filename Emoji filename
		 * @return {string|null} SVG content, or null when not yet loaded
		 */
		getCachedSVG( filename ) {
			return svgCache[ filename ] || null;
		},

		/**
		 * Fetch a whole category's SVG data up front.
		 *
		 * @param {string} categoryId Category id
		 * @return {Promise} Resolves once the category is available
		 */
		preloadCategory( categoryId ) {
			if ( !categoryId || !data.byCategory[ categoryId ] ) {
				return Promise.resolve();
			}
			return loadShard( categoryId );
		},

		/**
		 * Total number of emoji in the index.
		 *
		 * @return {number} Emoji count
		 */
		getTotalCount() {
			return data.total;
		},

		/**
		 * Whether a category's SVG data is resident.
		 *
		 * @param {string} [categoryId] Category id. When omitted, reports
		 *   whether every category has been loaded.
		 * @return {boolean} True when the requested data is in memory
		 */
		isBundleLoaded( categoryId ) {
			if ( categoryId ) {
				return loadedShards[ categoryId ] === true;
			}
			return data.categories.length > 0 &&
				data.categories.every(
					( category ) => loadedShards[ category.id ] === true
				);
		}
	};
}() );
