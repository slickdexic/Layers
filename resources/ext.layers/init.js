/**
 * MediaWiki Layers extension - viewer bootstrap.
 *
 * Initializes viewers for annotated images and refreshes on content changes.
 * This is a thin orchestration layer that delegates to extracted modules:
 * - UrlParser: URL and parameter parsing utilities
 * - ViewerManager: Viewer initialization and management
 * - ApiFallback: API fallback for missing server-side data
 *
 * @module ext.layers/init
 */
( function () {
	'use strict';

	// Helper to resolve classes from namespace with global fallback
	const getClass = window.layersGetClass || function ( namespacePath, globalName ) {
		if ( window.Layers ) {
			const parts = namespacePath.split( '.' );
			let obj = window.Layers;
			for ( const part of parts ) {
				if ( obj && obj[ part ] ) {
					obj = obj[ part ];
				} else {
					break;
				}
			}
			if ( typeof obj === 'function' ) {
				return obj;
			}
		}
		return window[ globalName ];
	};

	mw.layers = {
	debug: false,

	/**
	 * Log a debug message if debug mode is enabled.
	 *
	 * @param {...any} args Arguments to log.
	 */
	debugLog: function ( ...args ) {
		if ( this.debug && mw && mw.log ) {
			mw.log( '[Layers]', ...args );
		}
	},

	/**
	 * Log a warning message if debug mode is enabled.
	 *
	 * @param {...any} args Arguments to log.
	 */
	debugWarn: function ( ...args ) {
		if ( this.debug && mw && mw.log ) {
			mw.log.warn( '[Layers]', ...args );
		}
	},

	/**
	 * Initialize the layers system.
	 *
	 * Sets up debug mode, creates module instances, and binds refresh handlers.
	 */
	init: function () {
		// Initialize debug mode
		try {
			this.debug = !!(
				typeof mw !== 'undefined' &&
				mw.config &&
				mw.config.get( 'wgLayersDebug' )
			);
		} catch ( configError ) {
			this.debug = false;
		}

		this.debugLog( 'init() starting' );
		if ( this.debug && window.location ) {
			this.debugLog( 'href:', String( window.location.href || '' ) );
		}

		// Create module instances with shared debug setting
		const options = { debug: this.debug };
		const LayersUrlParser = getClass( 'Viewer.UrlParser', 'LayersUrlParser' );
		const LayersViewerManager = getClass( 'Viewer.Manager', 'LayersViewerManager' );
		const LayersApiFallback = getClass( 'Viewer.ApiFallback', 'LayersApiFallback' );

		this.urlParser = new LayersUrlParser( options );
		this.viewerManager = new LayersViewerManager( {
			debug: this.debug,
			urlParser: this.urlParser
		} );
		this.apiFallback = new LayersApiFallback( {
			debug: this.debug,
			urlParser: this.urlParser,
			viewerManager: this.viewerManager
		} );

		// Initialize viewers for images annotated by server hooks
		this.viewerManager.initializeLayerViewers();

		// File page fallback if nothing found via attributes
		this.viewerManager.initializeFilePageFallback();

		// API fallback for images marked layered but lacking inline data
		this.apiFallback.initialize();

		// Re-scan when page content changes
		// Using arrow function to preserve 'this' context
		try {
			if ( mw && mw.hook && typeof mw.hook === 'function' ) {
				mw.hook( 'wikipage.content' ).add( () => {
					this.viewerManager.initializeLayerViewers();
					this.viewerManager.initializeFilePageFallback();
					this.apiFallback.initialize();
				} );
			}
		} catch ( e ) {
			this.debugWarn( 'Failed to register wikipage.content hook:', e.message );
		}

		// Refresh slides when modal editor closes (even without save)
		// This fixes slides in tables that may not render on initial page load
		try {
			document.addEventListener( 'layers-modal-closed', () => {
				this.debugLog( 'Modal closed, refreshing viewers' );
				if ( this.viewerManager ) {
					this.viewerManager.refreshAllViewers();
				}
			} );
		} catch ( e ) {
			this.debugWarn( 'Failed to register layers-modal-closed listener:', e.message );
		}
	},

	// Delegate utility methods to urlParser for backwards compatibility
	// These are used by other code that may call mw.layers.* directly

	/**
	 * Get the page-level layers parameter value.
	 *
	 * @return {string|null} Parameter value or null
	 */
	getPageLayersParam: function () {
		if ( this.urlParser ) {
			return this.urlParser.getPageLayersParam();
		}
		return null;
	},

	/**
	 * Decode HTML entities in a string.
	 *
	 * @param {string} s String to decode
	 * @return {string} Decoded string
	 */
	decodeHtmlEntities: function ( s ) {
		if ( this.urlParser ) {
			return this.urlParser.decodeHtmlEntities( s );
		}
		return s;
	},

	/**
	 * Check if a layers value indicates enabling.
	 *
	 * @param {string} v Value to check
	 * @return {boolean} True if value enables layers
	 */
	isAllowedLayersValue: function ( v ) {
		if ( this.urlParser ) {
			return this.urlParser.isAllowedLayersValue( v );
		}
		return false;
	},

	/**
	 * Escape a string for use in RegExp.
	 *
	 * @param {string} s String to escape
	 * @return {string} Escaped string
	 */
	escRe: function ( s ) {
		if ( this.urlParser ) {
			return this.urlParser.escapeRegExp( s );
		}
		return s.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	},

	/**
	 * Detect layers intent from data-mw attribute.
	 *
	 * @param {HTMLElement} el Element to check
	 * @return {string|null} Layers value or null
	 */
	detectLayersFromDataMw: function ( el ) {
		if ( this.urlParser ) {
			return this.urlParser.detectLayersFromDataMw( el );
		}
		return null;
	},

	// Direct method delegates for backwards compatibility

	/**
	 * Initialize layer viewers.
	 */
	initializeLayerViewers: function () {
		if ( this.viewerManager ) {
			this.viewerManager.initializeLayerViewers();
		}
	},

	/**
	 * Initialize API fallback.
	 */
	initializeApiFallbackForMissingData: function () {
		if ( this.apiFallback ) {
			this.apiFallback.initialize();
		}
	},

	/**
	 * Initialize file page fallback.
	 */
	initializeFilePageFallback: function () {
		if ( this.viewerManager ) {
			this.viewerManager.initializeFilePageFallback();
		}
	}
};

// Initialize on DOM ready
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', () => {
			mw.layers.init();
		} );
	} else {
		mw.layers.init();
	}

	// Handle back-forward cache (bfcache) navigation
	// When user returns to page via browser back button (e.g., after closing slide editor),
	// the page may be restored from bfcache without running JavaScript.
	// The pageshow event fires in this case with event.persisted=true.
	window.addEventListener( 'pageshow', function ( event ) {
		if ( event.persisted ) {
			// Page was restored from bfcache - refresh all viewers to show latest data
			if ( mw && mw.layers && mw.layers.viewerManager ) {
				mw.layers.debugLog( 'pageshow: page restored from bfcache, refreshing viewers' );
				mw.layers.viewerManager.refreshAllViewers();
			}
		}
	} );

	// Final fallback for slides inside tables or other deferred content
	// window.load fires after all resources (stylesheets, images) are loaded
	// Tables may need this for proper layout calculations
	window.addEventListener( 'load', function () {
		if ( mw && mw.layers && mw.layers.viewerManager ) {
			// Check if any slides still need initialization
			const uninitSlides = document.querySelectorAll(
				'.layers-slide-container:not([data-layers-init-success="true"])'
			);
			if ( uninitSlides.length > 0 ) {
				mw.layers.debugLog( 'window.load: found', uninitSlides.length, 'uninit slides, refreshing' );
				mw.layers.viewerManager.refreshAllSlides();
			}
		}
	} );

}() );
