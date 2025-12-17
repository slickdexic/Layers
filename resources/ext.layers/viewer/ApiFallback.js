/**
 * API fallback for loading layer data when server-side injection is missing.
 *
 * Handles complex logic for determining which images should have layers loaded
 * via API when the server didn't inject data-layer-data attributes.
 *
 * @module viewer/ApiFallback
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

	/**
	 * ApiFallback class
	 */
class ApiFallback {
	/**
	 * Creates a new ApiFallback instance
	 *
	 * @param {Object} [options] Configuration options
	 * @param {boolean} [options.debug=false] Enable debug logging
	 * @param {LayersUrlParser} [options.urlParser] URL parser instance
	 * @param {LayersViewerManager} [options.viewerManager] Viewer manager instance
	 */
	constructor( options ) {
		this.debug = options && options.debug;
		const LayersUrlParser = getClass( 'Utils.UrlParser', 'LayersUrlParser' );
		const LayersViewerManager = getClass( 'Viewer.Manager', 'LayersViewerManager' );
		this.urlParser = ( options && options.urlParser ) ||
			new LayersUrlParser( { debug: this.debug } );
		this.viewerManager = ( options && options.viewerManager ) ||
			new LayersViewerManager( {
				debug: this.debug,
				urlParser: this.urlParser
			} );
	}

	/**
	 * Log a debug message if debug mode is enabled.
	 *
	 * @private
	 * @param {...any} args Arguments to log
	 */
	debugLog( ...args ) {
		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log( '[Layers:ApiFallback]', ...args );
		}
	}

	/**
	 * Log a warning message if debug mode is enabled.
	 *
	 * @private
	 * @param {...any} args Arguments to log
	 */
	debugWarn ( ...args ) {
		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( '[Layers:ApiFallback]', ...args );
		}
	}

	/**
	 * Build list of candidate images that might need API fallback.
	 *
	 * @private
	 * @param {boolean} pageAllow Whether page-level layers param allows loading
	 * @return {HTMLImageElement[]} Array of candidate images
	 */
	buildCandidateList ( pageAllow ) {
		const candidates = [];

		const addAll = function ( selector ) {
			const list = document.querySelectorAll( selector );
			Array.prototype.forEach.call( list, ( el ) => {
				if ( candidates.indexOf( el ) === -1 ) {
					candidates.push( el );
				}
			} );
		};

		// Images already marked as layered but missing inline data
		addAll( 'img.layers-thumbnail:not([data-layer-data])' );

		// Images explicitly marked by server intent
		addAll( 'img[data-layers-intent="on"]:not([data-layer-data])' );

		// Images inside links that explicitly request layers=
		addAll( 'a[href*="layers="] > img:not([data-layer-data])' );

		// Common content images (stricter gating below)
		[ 'a.image > img:not([data-layer-data])',
			'img.mw-file-element:not([data-layer-data])',
			'img.thumbimage:not([data-layer-data])'
		].forEach( addAll );

		// If page-level intent, add images linking to File: pages
		if ( pageAllow ) {
			[ 'a[href*="/File:"] > img:not([data-layer-data])',
				'a[href*="/wiki/File:"] > img:not([data-layer-data])',
				'a[href*="title=File:"] > img:not([data-layer-data])',
				'a[title^="File:"] > img:not([data-layer-data])'
			].forEach( addAll );
		}

		return candidates;
	}

	/**
	 * Determine if an image should be allowed to load layers.
	 *
	 * @private
	 * @param {HTMLImageElement} img Image element
	 * @param {boolean} pageAllow Page-level layers permission
	 * @param {number} pageNsNum Current page namespace number
	 * @param {string} fileNs File namespace name
	 * @return {Object} Result with allow boolean and reason string
	 */
	checkImageAllowed ( img, pageAllow, pageNsNum, fileNs ) {
		let allow = false;
		let allowReason = '';

		// On File pages, page-level intent is sufficient
		if ( pageNsNum === 6 ) {
			allow = pageAllow;
			allowReason = 'File page with pageAllow=' + pageAllow;
			if ( allow ) {
				return { allow: allow, reason: allowReason };
			}
		}

		const anchor = img.closest( 'a' );

		// Check for per-image layers= in href
		if ( anchor && anchor.getAttribute( 'href' ) ) {
			const href = anchor.getAttribute( 'href' );
			const m = href.match( /[?&#]layers=([^&#]+)/i );
			if ( m && m[ 1 ] ) {
				const val = decodeURIComponent( m[ 1 ] ).toLowerCase();
				allow = this.urlParser.isAllowedLayersValue( val );
				if ( allow ) {
					return { allow: true, reason: 'per-image layers parameter: ' + val };
				}
			}

			// On non-File pages with pageAllow, check if this links to a File: page
			if ( pageAllow && pageNsNum !== 6 ) {
				if ( this.urlParser.isFileLinkAnchor( anchor, fileNs ) ) {
					return { allow: true, reason: 'non-File page with pageAllow + file link detected' };
				}
			}
		}

		// On non-File pages with pageAllow, check if image looks like content
		if ( pageAllow && pageNsNum !== 6 ) {
			const cls = ( img.getAttribute( 'class' ) || '' ) + ' ';
			let looksContent = /(^|\s)(mw-file-element|thumbimage)(\s|$)/.test( cls );

			if ( !looksContent && anchor ) {
				const aCls = ( anchor.getAttribute( 'class' ) || '' ) + ' ';
				looksContent = /(^|\s)(image|internal)(\s|$)/i.test( aCls );
			}

			if ( looksContent ) {
				return {
					allow: true,
					reason: 'non-File page with pageAllow + content image class detected'
				};
			}
		}

		// Check data-mw for layers intent
		const mwLayers = this.urlParser.detectLayersFromDataMw( img );
		if ( mwLayers ) {
			const v = String( mwLayers ).toLowerCase();
			allow = this.urlParser.isAllowedLayersValue( v );
			if ( allow ) {
				return { allow: true, reason: 'data-mw layers parameter: ' + v };
			}
		}

		// Check data-layers-intent attribute
		if ( img.hasAttribute( 'data-layers-intent' ) ) {
			const intent = ( img.getAttribute( 'data-layers-intent' ) || '' ).toLowerCase();
			if ( intent === 'none' || intent === 'off' ) {
				return { allow: false, reason: 'explicit no-layers intent: ' + intent };
			}
			if ( this.urlParser.isAllowedLayersValue( intent ) || intent === 'on' ) {
				return { allow: true, reason: 'server-marked intent: ' + intent };
			}
		}

		return { allow: false, reason: allowReason || 'no matching criteria' };
	}

	/**
	 * Infer filename from image, with fallback to wgPageName on File pages.
	 *
	 * @private
	 * @param {HTMLImageElement} img Image element
	 * @param {string} fileNs File namespace name
	 * @return {string|null} Filename or null
	 */
	inferFilenameWithFallback ( img, fileNs ) {
		let filename = this.urlParser.inferFilename( img, fileNs );

		// Fallback to wgPageName on File pages
		if ( !filename ) {
			try {
				const curNsNum = mw.config.get( 'wgNamespaceNumber' );
				if ( curNsNum === 6 ) {
					const pageName = mw.config.get( 'wgPageName' ) || '';
					const canonNs = mw.config.get( 'wgCanonicalNamespace' ) || 'File';
					const prefix = canonNs + ':';
					if ( pageName.indexOf( prefix ) === 0 ) {
						filename = pageName.slice( prefix.length ).replace( /_/g, ' ' );
					}
				}
			} catch ( e ) {
				// wgPageName fallback failed
			}
		}

		return filename;
	}

	/**
	 * Process a single candidate image for API fallback.
	 *
	 * @private
	 * @param {HTMLImageElement} img Image element
	 * @param {mw.Api} api MediaWiki API instance
	 * @param {boolean} pageAllow Page-level layers permission
	 * @param {number} pageNsNum Current page namespace number
	 * @param {string} fileNs File namespace name
	 */
	processCandidate ( img, api, pageAllow, pageNsNum, fileNs ) {
		if ( img.layersViewer ) {
			return;
		}

		// Check for explicit no-layers intent early
		if ( img.hasAttribute( 'data-layers-intent' ) ) {
			const intentEarly = ( img.getAttribute( 'data-layers-intent' ) || '' ).toLowerCase();
			if ( intentEarly === 'none' || intentEarly === 'off' ) {
				this.debugLog( 'Skipping image with explicit no-layers intent:', intentEarly );
				return;
			}
		}

		// Infer filename
		const filename = this.inferFilenameWithFallback( img, fileNs );
		if ( !filename ) {
			this.debugLog( 'API fallback skipped: no filename inferred for candidate' );
			this.debugLog( 'Candidate image:', img );
			return;
		}

		// Check if image is allowed
		const check = this.checkImageAllowed( img, pageAllow, pageNsNum, fileNs );
		if ( !check.allow ) {
			this.debugLog( 'API fallback skipped: not allowed -', check.reason );
			this.debugLog( 'filename=' + filename + ', pageAllow=' + pageAllow + ', pageNsNum=' + pageNsNum );
			return;
		}

		this.debugLog( 'API fallback proceeding for filename:', filename, ', reason:', check.reason );

		// Fetch layer data via API
		api.get( {
			action: 'layersinfo',
			format: 'json',
			filename: filename
		} ).then( ( data ) => {
			try {
				if ( !data || !data.layersinfo || !data.layersinfo.layerset ) {
					return;
				}

				const ls = data.layersinfo.layerset;
				let layersArr = null;

				if ( ls && ls.data ) {
					if ( Array.isArray( ls.data.layers ) ) {
						layersArr = ls.data.layers;
					} else if ( Array.isArray( ls.data ) ) {
						layersArr = ls.data;
					}
				}

				if ( !layersArr || !layersArr.length ) {
					return;
				}

				const payload = {
					layers: layersArr,
					baseWidth: ls.baseWidth || img.naturalWidth || img.width || null,
					baseHeight: ls.baseHeight || img.naturalHeight || img.height || null
				};

				this.viewerManager.initializeViewer( img, payload );
				this.debugLog( 'API fallback initialized viewer for', filename );
			} catch ( e2 ) {
				this.debugWarn( 'API fallback processing error:', e2 );
			}
		} );
	}

	/**
	 * Initialize API fallback for images missing data-layer-data.
	 *
	 * This handles cases where server-side attribute injection was bypassed.
	 */
	initialize () {
		try {
			if ( typeof mw === 'undefined' || !mw.loader ||
				typeof mw.loader.using !== 'function' ) {
				return;
			}

			// Ensure mediawiki.api is loaded
			mw.loader.using( 'mediawiki.api' ).then( () => {
				// Detect page-level layers intent
				let pageAllow = false;
				const pageLayersVal = this.urlParser.getPageLayersParam();
				if ( pageLayersVal ) {
					pageAllow = this.urlParser.isAllowedLayersValue(
						String( pageLayersVal ).toLowerCase()
					);
				}

				const pageNsNum = this.urlParser.getNamespaceNumber();
				const fileNs = this.urlParser.getFileNamespace();

				// Build candidate list
				const candidates = this.buildCandidateList( pageAllow );

				this.debugLog( 'API fallback: pageAllow=', pageAllow,
					'ns=', pageNsNum, 'candidates=', candidates.length );

				if ( !candidates.length ) {
					return;
				}

				const api = new mw.Api();

				// Process each candidate
				candidates.forEach( ( img ) => {
					this.processCandidate( img, api, pageAllow, pageNsNum, fileNs );
				} );
			} );
		} catch ( e ) {
			this.debugWarn( 'API fallback initialization failed:', e.message );
		}
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.ApiFallback = ApiFallback;
	}

	// CommonJS export for Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ApiFallback;
	}

}() );
