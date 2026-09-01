/**
 * APICacheManager - Extracted from APIManager for god class reduction.
 * Manages LRU response cache and FreshnessChecker session cache.
 *
 * @class APICacheManager
 */
'use strict';

( function () {
	/**
	 * @param {Object} [options]
	 * @param {number} [options.maxSize=20] Maximum number of cache entries
	 * @param {number} [options.ttl=300000] Cache TTL in milliseconds (default 5 min)
	 */
	class APICacheManager {
		constructor( options = {} ) {
			this.responseCache = new Map();
			this.cacheMaxSize = options.maxSize || 20;
			this.cacheTTL = options.ttl || 5 * 60 * 1000;
		}

		/**
		 * Get a cached API response if available and not expired.
		 *
		 * @param {string} key Cache key
		 * @return {Object|null} Cached data or null if not found/expired
		 */
		getCached( key ) {
			const entry = this.responseCache.get( key );
			if ( !entry ) {
				return null;
			}
			if ( Date.now() - entry.timestamp > this.cacheTTL ) {
				this.responseCache.delete( key );
				return null;
			}
			// LRU behavior: move to end by re-inserting
			this.responseCache.delete( key );
			this.responseCache.set( key, entry );
			return entry.data;
		}

		/**
		 * Store data in the response cache.
		 *
		 * @param {string} key Cache key
		 * @param {Object} data Data to cache
		 */
		setCache( key, data ) {
			while ( this.responseCache.size >= this.cacheMaxSize ) {
				const firstKey = this.responseCache.keys().next().value;
				this.responseCache.delete( firstKey );
			}
			this.responseCache.set( key, {
				data: data,
				timestamp: Date.now()
			} );
		}

		/**
		 * Invalidate cache entries for a specific file or all entries.
		 *
		 * @param {string} [filename] Filename to invalidate, or omit to clear all
		 */
		invalidateCache( filename ) {
			if ( !filename ) {
				this.responseCache.clear();
				return;
			}
			for ( const key of this.responseCache.keys() ) {
				if ( key.startsWith( filename + ':' ) ) {
					this.responseCache.delete( key );
				}
			}
		}

		/**
		 * Build a cache key for layersinfo requests.
		 *
		 * @param {string} filename File name
		 * @param {Object} [options] Options: setname or layersetid
		 * @return {string} Cache key
		 */
		buildCacheKey( filename, options = {} ) {
			if ( options.layersetid ) {
				return `${ filename }:id:${ options.layersetid }`;
			}
			if ( options.setname ) {
				return `${ filename }:set:${ options.setname }`;
			}
			return `${ filename }:default`;
		}

		/**
		 * Clear the FreshnessChecker sessionStorage cache for a file.
		 *
		 * Scans the store rather than reconstructing keys: the viewer may hold
		 * entries for sets and pages the editor never loaded, and the previous
		 * hand-built key format silently omitted the page.
		 *
		 * @param {string} filename File name
		 */
		clearFreshnessCache( filename ) {
			try {
				if ( !filename ) {
					return;
				}

				const keyUtil = ( typeof window !== 'undefined' && window.Layers &&
					window.Layers.FreshnessCacheKey ) || null;
				if ( !keyUtil ) {
					return;
				}

				keyUtil.findAllForFile( filename ).forEach( ( key ) => {
					try {
						sessionStorage.removeItem( key );
					} catch ( e ) {
						// Ignore sessionStorage errors
					}
				} );

				if ( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) && mw.log ) {
					mw.log( '[APICacheManager] Cleared freshness cache for:', filename );
				}
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[APICacheManager] Failed to clear freshness cache:', e.message );
				}
			}
		}

		/**
		 * Clear all cached data.
		 */
		destroy() {
			this.responseCache.clear();
		}
	}

	// Export for ResourceLoader
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.APICacheManager = APICacheManager;

	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = APICacheManager;
	}
}() );
