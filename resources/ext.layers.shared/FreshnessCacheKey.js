/**
 * Canonical builder for the viewer's sessionStorage freshness-cache key.
 *
 * The format used to be written out by hand in three places — FreshnessChecker,
 * APIManager and APICacheManager — and two of the three omitted the page
 * number, so every page of a multi-page (PDF) file shared one cache entry and
 * cache invalidation after a save cleared a key nobody was reading. Both the
 * viewer and the editor depend on ext.layers.shared, so the format lives here
 * and nowhere else.
 *
 * @module FreshnessCacheKey
 */
( function () {
	'use strict';

	const STORAGE_KEY_PREFIX = 'layers-fresh-';

	const FreshnessCacheKey = {

		prefix: STORAGE_KEY_PREFIX,

		/**
		 * Build the sessionStorage key for one file/set/page combination.
		 *
		 * @param {string} filename Image file name
		 * @param {string} [setName] Layer set name; unnamed sets use ''
		 * @param {number|string} [page] 1-based page number for multi-page files
		 * @return {string} Storage key
		 */
		build: function ( filename, setName, page ) {
			const normalizedFilename = String( filename || '' ).replace( /\s+/g, '_' );
			const normalizedSetName = setName || '';
			const normalizedPage = Math.max( 1, parseInt( page, 10 ) || 1 );
			const pageSuffix = normalizedPage > 1 ? ':p' + normalizedPage : '';
			return STORAGE_KEY_PREFIX + normalizedFilename + ':' + normalizedSetName +
				pageSuffix;
		},

		/**
		 * List every key that could hold freshness data for a file.
		 *
		 * Used when invalidating after a save: the viewer may hold entries for
		 * sets and pages the editor has no reference to, so scan the store
		 * rather than guessing which combinations exist.
		 *
		 * @param {string} filename Image file name
		 * @return {string[]} Matching keys currently present in sessionStorage
		 */
		findAllForFile: function ( filename ) {
			const normalizedFilename = String( filename || '' ).replace( /\s+/g, '_' );
			if ( normalizedFilename === '' ) {
				return [];
			}
			const wanted = STORAGE_KEY_PREFIX + normalizedFilename + ':';
			const keys = [];
			try {
				for ( let i = 0; i < sessionStorage.length; i++ ) {
					const key = sessionStorage.key( i );
					if ( key && key.indexOf( wanted ) === 0 ) {
						keys.push( key );
					}
				}
			} catch ( e ) {
				return [];
			}
			return keys;
		}
	};

	Object.freeze( FreshnessCacheKey );

	if ( typeof mw !== 'undefined' ) {
		mw.ext = mw.ext || {};
		mw.ext.layers = mw.ext.layers || {};
		mw.ext.layers.FreshnessCacheKey = FreshnessCacheKey;
	}

	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.FreshnessCacheKey = FreshnessCacheKey;
	}

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = FreshnessCacheKey;
	}

}() );
