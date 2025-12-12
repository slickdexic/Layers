/**
 * URL and parameter parsing utilities for Layers viewer initialization.
 *
 * Provides methods for extracting layer parameters from URLs, query strings,
 * and data-mw attributes.
 *
 * @module viewer/UrlParser
 */
( function () {
	'use strict';

	/**
	 * @class UrlParser
	 * @constructor
	 * @param {Object} [options] Configuration options
	 * @param {boolean} [options.debug=false] Enable debug logging
	 */
	function UrlParser( options ) {
		this.debug = options && options.debug;
	}

	/**
	 * Log a debug message if debug mode is enabled.
	 *
	 * @private
	 * @param {...any} args Arguments to log
	 */
	UrlParser.prototype.debugLog = function ( ...args ) {
		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log( '[Layers:UrlParser]', ...args );
		}
	};

	/**
	 * Log a warning message if debug mode is enabled.
	 *
	 * @private
	 * @param {...any} args Arguments to log
	 */
	UrlParser.prototype.debugWarn = function ( ...args ) {
		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log.warn( '[Layers:UrlParser]', ...args );
		}
	};

	/**
	 * Escape a string for safe use within RegExp source.
	 *
	 * @param {string} s String to escape
	 * @return {string} Escaped string
	 */
	UrlParser.prototype.escapeRegExp = function ( s ) {
		return s.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	};

	/**
	 * Decode common HTML entities that may appear in data attributes.
	 *
	 * @param {string} s String to decode
	 * @return {string} Decoded string
	 */
	UrlParser.prototype.decodeHtmlEntities = function ( s ) {
		if ( !s || typeof s !== 'string' ) {
			return s;
		}
		let out = s.replace( /&amp;/g, '&' );
		out = out.replace( /&amp;quot;/g, '"' );
		out = out.replace( /&quot;/g, '"' );
		out = out.replace( /&#34;/g, '"' );
		out = out.replace( /&#x22;/gi, '"' );
		return out;
	};

	/**
	 * Determine whether a layers value denotes explicit enabling.
	 *
	 * @param {string} v Value to check
	 * @return {boolean} True if value indicates layers should be enabled
	 */
	UrlParser.prototype.isAllowedLayersValue = function ( v ) {
		if ( !v ) {
			return false;
		}
		const val = String( v )
			.replace( /^\s+|\s+$/g, '' )
			.replace( /^['"]|['"]$/g, '' )
			.toLowerCase();
		if (
			val === 'on' ||
			val === 'all' ||
			val === 'true' ||
			val === '1' ||
			val === 'yes'
		) {
			return true;
		}
		if ( /^id:\d+$/.test( val ) ) {
			return true;
		}
		if ( /^name:.+/.test( val ) ) {
			return true;
		}
		if ( /^(?:[0-9a-f]{2,8})(?:\s*,\s*[0-9a-f]{2,8})*$/i.test( val ) ) {
			return true;
		}
		return false;
	};

	/**
	 * Get the page-level layers parameter value if present.
	 *
	 * Checks multiple sources in order:
	 * 1. Server-provided wgLayersParam config
	 * 2. mw.util.getParamValue('layers')
	 * 3. URL search params
	 * 4. URL hash params
	 * 5. Regex fallback on URL
	 *
	 * @return {string|null} Raw parameter value or null
	 */
	UrlParser.prototype.getPageLayersParam = function () {
		let pageLayersVal = null;

		try {
			// Prefer server-provided value if available
			if ( typeof mw !== 'undefined' && mw.config &&
				typeof mw.config.get === 'function' ) {
				const cfgVal = mw.config.get( 'wgLayersParam' );
				if ( cfgVal ) {
					pageLayersVal = String( cfgVal );
				}
			}

			// Try mw.util.getParamValue
			if ( !pageLayersVal && typeof mw !== 'undefined' && mw.util &&
				typeof mw.util.getParamValue === 'function' ) {
				pageLayersVal = mw.util.getParamValue( 'layers' ) || null;
				if ( !pageLayersVal ) {
					pageLayersVal = mw.util.getParamValue( 'Layers' ) || null;
				}
			}

			// Try URL API
			const loc = String( window.location.href || '' );
			if ( !pageLayersVal ) {
				try {
					const u = new URL( loc );
					pageLayersVal = u.searchParams.get( 'layers' ) ||
						u.searchParams.get( 'Layers' );
					if ( !pageLayersVal && u.hash ) {
						const mh = u.hash.match( /(?:^|[?&#;])layers=([^&#;]+)/i );
						if ( mh && mh[ 1 ] ) {
							pageLayersVal = decodeURIComponent( mh[ 1 ] );
						}
					}
				} catch ( eUrl ) {
					this.debugWarn( 'URL parsing failed, using regex fallback:', eUrl.message );
				}
			}

			// Regex fallback
			if ( !pageLayersVal ) {
				const mPage = loc.match( /[?&#;]layers=([^&#;]+)/i );
				if ( mPage && mPage[ 1 ] ) {
					pageLayersVal = decodeURIComponent( mPage[ 1 ] );
				}
			}
		} catch ( e ) {
			this.debugWarn( 'Error retrieving page layers param:', e.message );
		}

		if ( pageLayersVal ) {
			this.debugLog( 'page-level layers param detected:', pageLayersVal );
		}
		return pageLayersVal;
	};

	/**
	 * Inspect nearest ancestor with data-mw JSON to detect a layers intent
	 * from original wikitext args.
	 *
	 * @param {HTMLElement} el An element within the output of a File node
	 * @return {string|null} Normalized layers value or null
	 */
	UrlParser.prototype.detectLayersFromDataMw = function ( el ) {
		const searchValue = function ( dmwRoot ) {
			let foundLocal = null;

			const visit = function ( v ) {
				if ( foundLocal !== null || v === null ) {
					return;
				}
				const t = Object.prototype.toString.call( v );
				if ( t === '[object String]' ) {
					const str = String( v );
					const m2 = str.match( /(^|\b)layers\s*=\s*([^,;\]]+)/i );
					if ( m2 ) {
						foundLocal = m2[ 2 ].trim().toLowerCase();
					}
					return;
				}
				if ( t === '[object Array]' ) {
					for ( let j = 0; j < v.length; j++ ) {
						visit( v[ j ] );
						if ( foundLocal !== null ) {
							break;
						}
					}
					return;
				}
				if ( t === '[object Object]' ) {
					if ( typeof v.layers === 'string' && v.layers ) {
						foundLocal = v.layers.toLowerCase();
						return;
					}
					if ( typeof v.layer === 'string' && v.layer ) {
						foundLocal = v.layer.toLowerCase();
						return;
					}
					for ( const k in v ) {
						if ( Object.prototype.hasOwnProperty.call( v, k ) ) {
							visit( v[ k ] );
							if ( foundLocal !== null ) {
								break;
							}
						}
					}
				}
			};

			visit( dmwRoot );
			return foundLocal;
		};

		try {
			let node = el;
			while ( node && node.nodeType === 1 ) {
				let raw = null;
				if ( node.getAttribute ) {
					raw = node.getAttribute( 'data-mw' );
				}
				if ( raw ) {
					try {
						const decoded = this.decodeHtmlEntities( raw );
						const dmw = JSON.parse( decoded );
						if ( dmw && typeof dmw === 'object' ) {
							const found = searchValue( dmw );
							if ( found ) {
								return found;
							}
						}
					} catch ( e2 ) {
						try {
							const layersRegex = /layers\s*=\s*([^,;\]\s"']+)/i;
							const rm = String( raw ).match( layersRegex );
							if ( rm && rm[ 1 ] ) {
								return rm[ 1 ].trim().toLowerCase();
							}
						} catch ( e2b ) {
							// Regex extraction also failed
						}
					}
				}
				node = node.parentNode;
			}
		} catch ( e ) {
			this.debugWarn( 'detectLayersFromDataMw traversal error:', e.message );
		}
		return null;
	};

	/**
	 * Infer filename from an image element using various methods.
	 *
	 * Checks (in order):
	 * 1. Parent anchor href (query param or path)
	 * 2. Parent anchor title attribute
	 * 3. data-file or data-image-name attributes
	 * 4. Image src path
	 *
	 * @param {HTMLImageElement} imgEl Image element
	 * @param {string} fileNamespace Localized File namespace name
	 * @return {string|null} Inferred filename or null
	 */
	UrlParser.prototype.inferFilename = function ( imgEl, fileNamespace ) {
		let filename = null;
		const a = imgEl.closest( 'a' );

		// Try href patterns
		if ( a && a.getAttribute( 'href' ) ) {
			const href = a.getAttribute( 'href' );
			try {
				const decodedHref = href;
				// Query param title=<FileNs>:
				const reTitle = new RegExp(
					'[?&]title=' + this.escapeRegExp( fileNamespace ) + ':([^&#]+)',
					'i'
				);
				const mTitle = decodedHref.match( reTitle );
				if ( mTitle && mTitle[ 1 ] ) {
					filename = decodeURIComponent( mTitle[ 1 ] ).replace( /_/g, ' ' );
				} else {
					// Path-style: /wiki/<FileNs>:...
					const rePath = new RegExp(
						'\\/(?:wiki\\/|index\\.php\\/)?' +
							this.escapeRegExp( fileNamespace ) + ':([^?#]+)',
						'i'
					);
					const mPath = decodedHref.match( rePath );
					if ( mPath && mPath[ 1 ] ) {
						filename = decodeURIComponent( mPath[ 1 ] ).replace( /_/g, ' ' );
					}
				}
			} catch ( e ) {
				// Filename extraction from href failed
			}
		}

		// Try anchor title attribute
		if ( !filename && a && a.getAttribute( 'title' ) ) {
			const aTitle = a.getAttribute( 'title' );
			try {
				let nsName = fileNamespace;
				if ( typeof mw !== 'undefined' && mw.config && mw.config.get ) {
					const nsMap = mw.config.get( 'wgFormattedNamespaces' );
					const name = nsMap && nsMap[ '6' ] ? String( nsMap[ '6' ] ) : null;
					if ( name ) {
						nsName = name;
					}
				}
				const rePrefix = new RegExp( '^' + this.escapeRegExp( nsName ) + ':', 'i' );
				if ( rePrefix.test( aTitle ) ) {
					filename = aTitle.replace( rePrefix, '' ).replace( /_/g, ' ' );
				}
			} catch ( eT ) {
				// Title attribute parsing failed
			}
		}

		// Try data attributes
		if ( !filename ) {
			const dataFile = imgEl.getAttribute( 'data-file' ) ||
				( a && a.getAttribute( 'data-file' ) );
			if ( dataFile ) {
				filename = String( dataFile ).replace( /_/g, ' ' );
			}
		}
		if ( !filename ) {
			const dataImageName = imgEl.getAttribute( 'data-image-name' ) ||
				( a && a.getAttribute( 'data-image-name' ) );
			if ( dataImageName ) {
				filename = String( dataImageName ).replace( /_/g, ' ' );
			}
		}

		// Parse from image src path
		if ( !filename ) {
			const src = imgEl.getAttribute( 'src' ) || '';
			try {
				const rx = /\/([-A-Za-z0-9%_. ]+?\.(?:png|jpe?g|gif|svg|webp|tiff?))(?:[/?#]|$)/i;
				const mSrc = src.match( rx );
				if ( mSrc && mSrc[ 1 ] ) {
					filename = decodeURIComponent( mSrc[ 1 ] ).replace( /_/g, ' ' );
				}
			} catch ( eS ) {
				// Image src parsing failed
			}
		}

		return filename;
	};

	/**
	 * Get the localized File namespace name.
	 *
	 * @return {string} File namespace name (defaults to 'File')
	 */
	UrlParser.prototype.getFileNamespace = function () {
		let fileNs = 'File';
		try {
			if ( typeof mw !== 'undefined' && mw.config && mw.config.get ) {
				const nsMap = mw.config.get( 'wgFormattedNamespaces' );
				const name = nsMap && nsMap[ '6' ] ? String( nsMap[ '6' ] ) : null;
				if ( name ) {
					fileNs = name;
				}
			}
		} catch ( eNs ) {
			// File namespace lookup failed
		}
		return fileNs;
	};

	/**
	 * Get the current page namespace number.
	 *
	 * @return {number} Namespace number (-1 if unknown)
	 */
	UrlParser.prototype.getNamespaceNumber = function () {
		try {
			if ( typeof mw !== 'undefined' && mw.config && mw.config.get ) {
				return mw.config.get( 'wgNamespaceNumber' );
			}
		} catch ( e ) {
			// Namespace number not available
		}
		return -1;
	};

	/**
	 * Check if an anchor element links to a File: page.
	 *
	 * @param {HTMLAnchorElement} anchor Anchor element to check
	 * @param {string} fileNs File namespace name
	 * @return {boolean} True if links to File: page
	 */
	UrlParser.prototype.isFileLinkAnchor = function ( anchor, fileNs ) {
		if ( !anchor || !anchor.getAttribute ) {
			return false;
		}

		const href = anchor.getAttribute( 'href' );
		if ( !href ) {
			return false;
		}

		try {
			const filePrefixEsc = this.escapeRegExp( fileNs ) + ':';
			const reTitleFile = new RegExp( '[?&]title=' + filePrefixEsc, 'i' );
			const rePathFile = new RegExp(
				'\\/(?:wiki\\/|index\\.php\\/)?' + filePrefixEsc, 'i'
			);
			const reMediaViewer = new RegExp( '#\\/media\\/' + filePrefixEsc, 'i' );
			const reSpecialFilePath = /\/(?:wiki\/)?Special:(?:FilePath|Redirect\/file)\//i;

			if ( reTitleFile.test( href ) ) {
				return true;
			}
			if ( rePathFile.test( href ) ) {
				return true;
			}
			if ( reMediaViewer.test( href ) ) {
				return true;
			}
			if ( reSpecialFilePath.test( href ) ) {
				return true;
			}

			// Check for mw-file-description class
			const aCls = ( anchor.getAttribute( 'class' ) || '' ).toLowerCase();
			if ( aCls.includes( 'mw-file-description' ) ) {
				return true;
			}

			// Check title attribute
			const aTitle = anchor.getAttribute( 'title' ) || '';
			const reATitle = new RegExp( '^' + filePrefixEsc, 'i' );
			if ( reATitle.test( aTitle ) ) {
				return true;
			}
		} catch ( e ) {
			// File link detection failed
		}

		return false;
	};

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.UrlParser = UrlParser;

		// DEPRECATED: Direct window export - use window.Layers.Viewer.UrlParser instead
		// This will be removed in a future version
		window.LayersUrlParser = UrlParser;
	}

}() );
