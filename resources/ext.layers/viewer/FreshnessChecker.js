/**
 * Freshness checker for layer data.
 *
 * Checks if inline layer data (embedded in HTML) is stale by comparing
 * the revision number with the latest revision from the API.
 *
 * This enables FR-10: Live Preview Without Page Edit/Save - changes made
 * in the editor are visible on article pages immediately after saving layers,
 * without needing to edit and save the wiki page.
 *
 * Strategy:
 * 1. When viewer initializes, check if data-layer-revision attribute exists
 * 2. If it does, make a lightweight API call to get latest revision number
 * 3. If API revision > inline revision, fetch full layer data and re-initialize
 * 4. Cache freshness checks briefly (30s) to avoid repeated API calls
 *
 * @module viewer/FreshnessChecker
 */
( function () {
	'use strict';

	/**
	 * Cache duration for freshness checks in milliseconds.
	 * After this time, a new API call will be made to check for updates.
	 * @type {number}
	 */
	const CACHE_DURATION_MS = 30000; // 30 seconds

	/**
	 * Storage key prefix for cached freshness data
	 * @type {string}
	 */
	const STORAGE_KEY_PREFIX = 'layers-fresh-';

	/**
	 * FreshnessChecker class
	 */
	class FreshnessChecker {
		/**
		 * Creates a new FreshnessChecker instance
		 *
		 * @param {Object} [options] Configuration options
		 * @param {boolean} [options.debug=false] Enable debug logging
		 */
		constructor( options ) {
			this.debug = options && options.debug;
		}

		/**
		 * Log a debug message if debug mode is enabled.
		 *
		 * @private
		 * @param {...any} args Arguments to log
		 */
		debugLog( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log( '[Layers:FreshnessChecker]', ...args );
			}
		}

		/**
		 * Log a warning message if debug mode is enabled.
		 *
		 * @private
		 * @param {...any} args Arguments to log
		 */
		debugWarn( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[Layers:FreshnessChecker]', ...args );
			}
		}

		/**
		 * Get the storage key for a filename/setname combination.
		 *
		 * @private
		 * @param {string} filename The image filename
		 * @param {string} setName The layer set name
		 * @return {string} Storage key
		 */
		getStorageKey( filename, setName ) {
			// Normalize filename to handle spaces and special chars
			const normalizedFilename = ( filename || '' ).replace( /\s+/g, '_' );
			const normalizedSetName = setName || 'default';
			return STORAGE_KEY_PREFIX + normalizedFilename + ':' + normalizedSetName;
		}

		/**
		 * Get cached freshness data from sessionStorage.
		 *
		 * @private
		 * @param {string} filename The image filename
		 * @param {string} setName The layer set name
		 * @return {Object|null} Cached data with { revision, timestamp } or null
		 */
		getCachedFreshness( filename, setName ) {
			try {
				const key = this.getStorageKey( filename, setName );
				const cached = sessionStorage.getItem( key );
				if ( !cached ) {
					return null;
				}
				const data = JSON.parse( cached );
				// Check if cache is still valid
				if ( data && data.timestamp && Date.now() - data.timestamp < CACHE_DURATION_MS ) {
					this.debugLog( 'Using cached freshness for', filename, ':', setName );
					return data;
				}
				// Cache expired, remove it
				sessionStorage.removeItem( key );
				return null;
			} catch ( e ) {
				this.debugWarn( 'Error reading freshness cache:', e.message );
				return null;
			}
		}

		/**
		 * Cache freshness data in sessionStorage.
		 *
		 * @private
		 * @param {string} filename The image filename
		 * @param {string} setName The layer set name
		 * @param {number} revision The latest revision number
		 */
		setCachedFreshness( filename, setName, revision ) {
			try {
				const key = this.getStorageKey( filename, setName );
				const data = {
					revision: revision,
					timestamp: Date.now()
				};
				sessionStorage.setItem( key, JSON.stringify( data ) );
				this.debugLog( 'Cached freshness for', filename, ':', setName, '= rev', revision );
			} catch ( e ) {
				this.debugWarn( 'Error writing freshness cache:', e.message );
			}
		}

		/**
		 * Clear the freshness cache for a specific file/set.
		 *
		 * @param {string} filename The image filename
		 * @param {string} [setName='default'] The layer set name
		 */
		clearCache( filename, setName ) {
			try {
				const key = this.getStorageKey( filename, setName || 'default' );
				sessionStorage.removeItem( key );
				this.debugLog( 'Cleared freshness cache for', filename, ':', setName );
			} catch ( e ) {
				this.debugWarn( 'Error clearing freshness cache:', e.message );
			}
		}

		/**
		 * Check if an image's inline layer data is fresh (up-to-date).
		 *
		 * @param {HTMLImageElement} img Image element with layer data attributes
		 * @return {Promise<Object>} Promise resolving to { isFresh, latestRevision, inlineRevision, layerData }
		 */
		checkFreshness( img ) {
			return new Promise( ( resolve ) => {
				// Extract metadata from image attributes
				const inlineRevision = parseInt( img.getAttribute( 'data-layer-revision' ), 10 );
				const setName = img.getAttribute( 'data-layer-setname' ) || 'default';
				const filename = img.getAttribute( 'data-file-name' );

				// If no revision attribute, we can't check freshness - assume fresh
				if ( isNaN( inlineRevision ) || !filename ) {
					this.debugLog( 'No revision/filename info, assuming fresh' );
					resolve( { isFresh: true, inlineRevision: null, latestRevision: null, layerData: null } );
					return;
				}

				// Check cache first
				const cached = this.getCachedFreshness( filename, setName );
				if ( cached && cached.revision !== undefined ) {
					const isFresh = inlineRevision >= cached.revision;
					this.debugLog(
						'Cached check:', filename,
						'inline rev=', inlineRevision,
						'cached rev=', cached.revision,
						'isFresh=', isFresh
					);
					resolve( {
						isFresh: isFresh,
						inlineRevision: inlineRevision,
						latestRevision: cached.revision,
						layerData: null // Caller needs to fetch if stale
					} );
					return;
				}

				// No valid cache, need to query API
				if ( typeof mw === 'undefined' || !mw.Api ) {
					this.debugWarn( 'mw.Api not available for freshness check' );
					resolve( { isFresh: true, inlineRevision: inlineRevision, latestRevision: null, layerData: null } );
					return;
				}

				const api = new mw.Api();
				const params = {
					action: 'layersinfo',
					format: 'json',
					filename: filename,
					limit: 1 // We only need the latest revision
				};

				// If specific set name (not default), request it
				if ( setName && setName !== 'default' && setName !== 'on' ) {
					params.setname = setName;
				}

				this.debugLog( 'Querying API for freshness:', filename, setName );

				api.get( params ).then( ( data ) => {
					try {
						let latestRevision = null;
						let layerData = null;

						if ( data && data.layersinfo && data.layersinfo.layerset ) {
							const layerset = data.layersinfo.layerset;
							latestRevision = parseInt( layerset.revision, 10 ) || 0;

							// If stale, extract full layer data for re-initialization
							if ( inlineRevision < latestRevision && layerset.data ) {
								layerData = {
									layers: layerset.data.layers || [],
									baseWidth: layerset.baseWidth,
									baseHeight: layerset.baseHeight,
									backgroundVisible: layerset.data.backgroundVisible !== undefined
										? layerset.data.backgroundVisible : true,
									backgroundOpacity: layerset.data.backgroundOpacity !== undefined
										? layerset.data.backgroundOpacity : 1.0
								};
							}
						}

						// Cache the result
						if ( latestRevision !== null ) {
							this.setCachedFreshness( filename, setName, latestRevision );
						}

						const isFresh = latestRevision === null || inlineRevision >= latestRevision;
						this.debugLog(
							'API check:', filename,
							'inline rev=', inlineRevision,
							'latest rev=', latestRevision,
							'isFresh=', isFresh
						);

						resolve( {
							isFresh: isFresh,
							inlineRevision: inlineRevision,
							latestRevision: latestRevision,
							layerData: layerData
						} );
					} catch ( e ) {
						this.debugWarn( 'Error processing freshness response:', e.message );
						resolve( { isFresh: true, inlineRevision: inlineRevision, latestRevision: null, layerData: null } );
					}
				} ).catch( ( apiErr ) => {
					this.debugWarn( 'Freshness API request failed:', apiErr );
					// On error, assume fresh to avoid breaking the viewer
					resolve( { isFresh: true, inlineRevision: inlineRevision, latestRevision: null, layerData: null } );
				} );
			} );
		}

		/**
		 * Check multiple images for freshness in parallel.
		 *
		 * @param {HTMLImageElement[]} images Array of image elements
		 * @return {Promise<Map<HTMLImageElement, Object>>} Map of image to freshness result
		 */
		checkMultipleFreshness( images ) {
			const checks = images.map( ( img ) =>
				this.checkFreshness( img ).then( ( result ) => [ img, result ] )
			);
			return Promise.all( checks ).then( ( results ) => {
				const resultMap = new Map();
				results.forEach( ( [ img, result ] ) => {
					resultMap.set( img, result );
				} );
				return resultMap;
			} );
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.FreshnessChecker = FreshnessChecker;
	}

	// CommonJS export for Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = FreshnessChecker;
	}

}() );
