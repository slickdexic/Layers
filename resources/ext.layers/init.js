// mw.layers bootstrap
// Initializes viewers for annotated images and refreshes on content changes
mw.layers = {
	/** Initialize lightweight viewers and bind refresh on content changes */
	init: function () {
		var self = this;
		var debug = false;
		try {
			debug = !!( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) );
		} catch ( e ) {}

		if ( debug ) {
			console.info( '[Layers] init() starting' );
			try {
				console.info( '[Layers] href:', String( window.location && window.location.href ) );
			} catch ( eHref ) { /* ignore */ }
		}

		// Initialize viewers for images annotated by server hooks
		self.initializeLayerViewers( debug );

		// File page fallback if nothing found via attributes (gated to explicit layers=)
		self.initializeFilePageFallback( debug );

		// If an image is marked layered but lacks inline data, fetch via API
		self.initializeApiFallbackForMissingData( debug );

		// Re-scan when the page content changes (guard if mw.hook is unavailable)
		try {
			if ( mw && mw.hook && typeof mw.hook === 'function' ) {
				mw.hook( 'wikipage.content' ).add( function () {
					self.initializeLayerViewers( debug );
					self.initializeFilePageFallback( debug );
					self.initializeApiFallbackForMissingData( debug );
				} );
			}
		} catch ( e ) { /* ignore */ }
	},

	/**
	 * Get the page-level layers parameter value if present.
	 * Returns the raw value (string) or null.
	 *
	 * @param {boolean} debug
	 * @return {string|null}
	 */
	getPageLayersParam: function ( debug ) {
		var pageLayersVal = null;
		try {
			// Prefer server-provided value if available
			if ( mw.config && typeof mw.config.get === 'function' ) {
				var cfgVal = mw.config.get( 'wgLayersParam' );
				if ( cfgVal ) {
					pageLayersVal = String( cfgVal );
				}
			}
			if ( !pageLayersVal && mw.util && typeof mw.util.getParamValue === 'function' ) {
				pageLayersVal = mw.util.getParamValue( 'layers' ) || null;
				if ( !pageLayersVal ) {
					// Some setups might mistakenly capitalize the key
					pageLayersVal = mw.util.getParamValue( 'Layers' ) || null;
				}
			}
			var loc = String( window.location.href || '' );
			if ( !pageLayersVal ) {
				try {
					var u = new URL( loc );
					pageLayersVal = u.searchParams.get( 'layers' ) || u.searchParams.get( 'Layers' );
					if ( !pageLayersVal && u.hash ) {
						var mh = u.hash.match( /(?:^|[?&#;])layers=([^&#;]+)/i );
						if ( mh && mh[ 1 ] ) {
							pageLayersVal = decodeURIComponent( mh[ 1 ] );
						}
					}
				} catch ( eUrl ) { /* ignore */ }
			}
			if ( !pageLayersVal ) {
				var mPage = loc.match( /[?&#;]layers=([^&#;]+)/i );
				if ( mPage && mPage[ 1 ] ) {
					pageLayersVal = decodeURIComponent( mPage[ 1 ] );
				}
			}
		} catch ( e ) { /* ignore */ }
		if ( debug && pageLayersVal ) {
			console.info( '[Layers] page-level layers param detected:', pageLayersVal );
		}
		return pageLayersVal;
	},

	/**
	 * Decode common HTML entities that may appear in data attributes
	 *
	 * @param {string} s
	 * @return {string}
	 */
	decodeHtmlEntities: function ( s ) {
		if ( !s || typeof s !== 'string' ) {
			return s;
		}
		// Quick replacements for most-common entities in our payload
		var out = s.replace( /&amp;/g, '&' );
		out = out.replace( /&amp;quot;/g, '"' );
		out = out.replace( /&quot;/g, '"' );
		out = out.replace( /&#34;/g, '"' );
		out = out.replace( /&#x22;/gi, '"' );
		return out;
	},

	/**
	 * Determine whether a layers value denotes explicit enabling.
	 *
	 * @param {string} v
	 * @return {boolean}
	 */
	isAllowedLayersValue: function ( v ) {
		if ( !v ) {
			return false;
		}
		var val = String( v )
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
	},

	/**
	 * Escape a string for safe use within RegExp source.
	 *
	 * @param {string} s
	 * @return {string}
	 */
	escRe: function ( s ) {
		return s.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	},

	/**
	 * Inspect nearest ancestor with data-mw JSON to detect a layers intent
	 * from original wikitext args. Returns a normalized string like
	 * 'on'|'all'|'off'|'none' or specific selectors (id:..., name:..., CSV).
	 *
	 * @param {HTMLElement} el An element within the output of a File node
	 * @return {string|null}
	 */
	detectLayersFromDataMw: function ( el ) {
		var searchValue = function ( dmwRoot ) {
			var foundLocal = null;

			var visit = function ( v ) {
				if ( foundLocal !== null || v === null ) {
					return;
				}
				var t = Object.prototype.toString.call( v );
				if ( t === '[object String]' ) {
					var str = String( v );
					var m2 = str.match( /(^|\b)layers\s*=\s*([^,;\]]+)/i );
					if ( m2 ) {
						foundLocal = m2[ 2 ].trim().toLowerCase();
					}
					return;
				}
				if ( t === '[object Array]' ) {
					for ( var j = 0; j < v.length; j++ ) {
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
					for ( var k in v ) {
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
			var node = el;
			while ( node && node.nodeType === 1 ) {
				var raw = null;
				if ( node.getAttribute ) {
					raw = node.getAttribute( 'data-mw' );
				}
				if ( raw ) {
					try {
						var decoded = this.decodeHtmlEntities( raw );
						var dmw = JSON.parse( decoded );
						if ( dmw && typeof dmw === 'object' ) {
							var found = searchValue( dmw );
							if ( found ) {
								return found;
							}
						}
					} catch ( e2 ) {
						// If JSON parse fails, attempt to extract layers=... via regex from raw attribute
						try {
							var rm = String( raw ).match( /layers\s*=\s*([^,;\]\s"']+)/i );
							if ( rm && rm[ 1 ] ) {
								return rm[ 1 ].trim().toLowerCase();
							}
						} catch ( e2b ) { /* ignore */ }
					}
				}
				node = node.parentNode;
			}
		} catch ( e ) {
			// ignore
		}
		return null;
	},

	/**
	 * Find all images with server-provided layer data and overlay a canvas viewer.
	 *
	 * @param {boolean} debug Enable debug logging
	 */
	initializeLayerViewers: function ( debug ) {
		var self = this;
		// Primary: attributes directly on <img>
		var images = Array.prototype.slice.call( document.querySelectorAll( 'img[data-layer-data]' ) );
		// Ensure the marker class exists for any img we found
		images.forEach( function ( img ) {
			var cls = img.getAttribute( 'class' ) || '';
			if ( cls.indexOf( 'layers-thumbnail' ) === -1 ) {
				img.setAttribute( 'class', ( cls + ' layers-thumbnail' ).trim() );
			}
		} );
		if ( debug ) {
			console.info( '[Layers] Found', images.length, 'candidate <img> elements with data-layer-data' );
		}

		// Fallback: attributes on wrapping <a>, move them to img for viewer
		var anchors = Array.prototype.slice.call(
			document.querySelectorAll( 'a[data-layer-data] > img' )
		);
		anchors.forEach( function ( img ) {
			if ( img.hasAttribute( 'data-layer-data' ) ) {
				return;
			}
			var a = img.parentNode && img.parentNode.nodeType === 1 ? img.parentNode : null;
			if ( a && a.hasAttribute( 'data-layer-data' ) ) {
				img.setAttribute( 'data-layer-data', a.getAttribute( 'data-layer-data' ) );
				var cls = img.getAttribute( 'class' ) || '';
				if ( cls.indexOf( 'layers-thumbnail' ) === -1 ) {
					img.setAttribute( 'class', ( cls + ' layers-thumbnail' ).trim() );
				}
				images.push( img );
				if ( debug ) {
					console.info( '[Layers] Moved data-layer-data from <a> to <img>' );
				}
			}
		} );

		images.forEach( function ( img ) {
			if ( img.layersViewer ) {
				return;
			}
			try {
				var raw = img.getAttribute( 'data-layer-data' );
				if ( !raw ) {
					return;
				}
				var layerData = null;
				try {
					layerData = JSON.parse( self.decodeHtmlEntities( raw ) );
				} catch ( eParse ) {
					layerData = null;
				}
				if ( !layerData ) {
					return;
				}
				// Normalize payload to { layers: [...], baseWidth, baseHeight }
				if ( Array.isArray( layerData ) ) {
					layerData = { layers: layerData };
				}
				var container = img.parentNode || img;
				var style = window.getComputedStyle( container );
				if ( !style || style.position === 'static' ) {
					var wrapper = document.createElement( 'span' );
					wrapper.style.position = 'relative';
					wrapper.style.display = 'inline-block';
					container.insertBefore( wrapper, img );
					wrapper.appendChild( img );
					container = wrapper;
				}

				// Instantiate viewer overlaying the image
				img.layersViewer = new window.LayersViewer( {
					container: container,
					imageElement: img,
					layerData: layerData
				} );
				if ( debug ) {
					var count = 0;
					if ( layerData.layers && layerData.layers.length ) {
						count = layerData.layers.length;
					}
					console.info( '[Layers] Viewer initialized with', count );
					console.info( 'baseWidth=', layerData.baseWidth, 'baseHeight=', layerData.baseHeight );
				}
			} catch ( e ) {
				// swallow to avoid breaking page rendering
				if ( debug ) {
					console.warn( '[Layers] Viewer init error:', e );
				}
			}
		} );
	},

	/**
	 * Fallback: If an image is marked as a layers thumbnail but lacks data-layer-data,
	 * fetch the latest/specified layer set via API and initialize the viewer.
	 * This helps when server-side attribute injection was bypassed in a given render path.
	 *
	 * @param {boolean} debug Enable debug logging
	 */
	initializeApiFallbackForMissingData: function ( debug ) {
		try {
			if ( typeof mw === 'undefined' || !mw.loader ||
				typeof mw.loader.using !== 'function' ) {
				return;
			}
			// Ensure mediawiki.api is present before proceeding
			mw.loader.using( 'mediawiki.api' ).done( function () {
				// Detect page-level explicit layers intent (?layers=... in URL)
				var pageAllow = false;
				var pageLayersVal = mw.layers.getPageLayersParam( debug );
				if ( pageLayersVal ) {
					pageAllow = mw.layers.isAllowedLayersValue( String( pageLayersVal ).toLowerCase() );
				}

				// Namespace awareness: treat page-level gating as sufficient only on File pages
				var pageNsNum = -1;
				try {
					if ( mw.config && mw.config.get ) {
						pageNsNum = mw.config.get( 'wgNamespaceNumber' );
					} else {
						pageNsNum = -1;
					}
				} catch ( eNsNum ) { /* ignore */ }

				// Build candidate list (avoid duplicates)
				var candidates = [];
				var addAll = function ( selector ) {
					var list = document.querySelectorAll( selector );
					Array.prototype.forEach.call( list, function ( el ) {
						var idx = candidates.indexOf( el );
						if ( idx === -1 ) {
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
				// Also include common content images; stricter gating below ensures
				// we only act on per-image explicit layers intent
				[
					'a.image > img:not([data-layer-data])',
					'img.mw-file-element:not([data-layer-data])',
					'img.thumbimage:not([data-layer-data])'
				].forEach( addAll );
				// If page-level intent is present, add only images that link to File: pages.
				// This keeps scope narrow versus selecting all content images.
				if ( pageAllow ) {
					[
						'a[href*="/File:"] > img:not([data-layer-data])',
						'a[href*="/wiki/File:"] > img:not([data-layer-data])',
						'a[href*="title=File:"] > img:not([data-layer-data])',
						'a[title^="File:"] > img:not([data-layer-data])'
					].forEach( addAll );
				}

				if ( debug ) {
					console.info( '[Layers] API fallback: pageAllow=', pageAllow, 'ns=', pageNsNum, 'candidates=', candidates.length );
				}
				if ( !candidates.length ) {
					return;
				}

				// Localized File namespace name (default "File")
				var fileNs = 'File';
				try {
					var nsMap = mw.config && mw.config.get ? mw.config.get( 'wgFormattedNamespaces' ) : null;
					var name = nsMap && nsMap[ '6' ] ? String( nsMap[ '6' ] ) : null;
					if ( name ) {
						fileNs = name;
					}
				} catch ( eNs ) { /* ignore */ }
				var esc = function ( s ) {
					return mw.layers.escRe( s );
				};

				var api = new mw.Api();

				// Helper: try to extract filename from various attributes and URL patterns
				var inferFilename = function ( imgEl, fileNamespace ) {
					var filename = null;
					var a = imgEl.closest( 'a' );
					if ( a && a.getAttribute( 'href' ) ) {
						var href = a.getAttribute( 'href' );
						try {
							var decodedHref = href;
							// Prefer query param title=<FileNs>:
							var reTitle = new RegExp( '[?&]title=' + esc( fileNamespace ) + ':([^&#]+)', 'i' );
							var mTitle = decodedHref.match( reTitle );
							if ( mTitle && mTitle[ 1 ] ) {
								filename = decodeURIComponent( mTitle[ 1 ] ).replace( /_/g, ' ' );
							} else {
								// Path-style /wiki/<FileNs>:... or /index.php/<FileNs>:... or /<FileNs>:...
								var rePath = new RegExp( '\\/(?:wiki\\/|index\\.php\\/)?' + esc( fileNamespace ) + ':([^?#]+)', 'i' );
								var mPath = decodedHref.match( rePath );
								if ( mPath && mPath[ 1 ] ) {
									filename = decodeURIComponent( mPath[ 1 ] ).replace( /_/g, ' ' );
								}
							}
						} catch ( e ) { /* ignore */ }
					}

					// Some skins put the title in the anchor title attribute
					if ( !filename && a && a.getAttribute( 'title' ) ) {
						var aTitle = a.getAttribute( 'title' );
						try {
							var nsMap2 = mw.config && mw.config.get ? mw.config.get( 'wgFormattedNamespaces' ) : null;
							var name2 = nsMap2 && nsMap2[ '6' ] ? String( nsMap2[ '6' ] ) : 'File';
							var rePrefix = new RegExp( '^' + esc( name2 ) + ':', 'i' );
							if ( rePrefix.test( aTitle ) ) {
								filename = aTitle.replace( rePrefix, '' ).replace( /_/g, ' ' );
							}
						} catch ( eT ) { /* ignore */ }
					}

					// Try common data attributes on the image or its parent containers
					if ( !filename ) {
						var dataFile = imgEl.getAttribute( 'data-file' ) || ( a && a.getAttribute( 'data-file' ) );
						if ( dataFile ) {
							filename = String( dataFile ).replace( /_/g, ' ' );
						}
					}
					if ( !filename ) {
						var dataImageName = imgEl.getAttribute( 'data-image-name' ) || ( a && a.getAttribute( 'data-image-name' ) );
						if ( dataImageName ) {
							filename = String( dataImageName ).replace( /_/g, ' ' );
						}
					}

					// Parse from image src path (thumbnail/original)
					if ( !filename ) {
						var src = imgEl.getAttribute( 'src' ) || '';
						try {
							var rx = /\/([-A-Za-z0-9%_. ]+?\.(?:png|jpe?g|gif|svg|webp|tiff?))(?:[/?#]|$)/i;
							var mSrc = src.match( rx );
							if ( mSrc && mSrc[ 1 ] ) {
								filename = decodeURIComponent( mSrc[ 1 ] ).replace( /_/g, ' ' );
							}
						} catch ( eS ) { /* ignore */ }
					}

					return filename;
				};

				candidates.forEach( function ( img ) {
					if ( img.layersViewer ) {
						return;
					}
					
					// Early check: if image is explicitly marked as no-layers, skip it entirely
					if ( img.hasAttribute( 'data-layers-intent' ) ) {
						var intent = ( img.getAttribute( 'data-layers-intent' ) || '' ).toLowerCase();
						if ( intent === 'none' || intent === 'off' ) {
							if ( debug ) {
								console.info( '[Layers] Skipping image with explicit no-layers intent: ' + intent );
							}
							return;
						}
					}
					
					var filename = inferFilename( img, fileNs );
					if ( !filename ) {
						// As a last resort on file pages, fall back to wgPageName
						try {
							var curNsNum = mw.config.get( 'wgNamespaceNumber' );
							if ( curNsNum === 6 ) {
								var pageName = mw.config.get( 'wgPageName' ) || '';
								var canonNs = mw.config.get( 'wgCanonicalNamespace' ) || 'File';
								var prefix = canonNs + ':';
								var hasPrefix = pageName.indexOf( prefix ) === 0;
								if ( hasPrefix ) {
									filename = pageName.slice( prefix.length ).replace( /_/g, ' ' );
								} else {
									filename = null;
								}
							}
						} catch ( e2 ) { /* ignore */ }
					}
					if ( !filename ) {
						if ( debug ) {
							console.info( '[Layers] API fallback skipped: no filename inferred for candidate' );
							console.info( '[Layers] Attempted inference from href, title, data attributes, and src' );
							console.info( '[Layers] Candidate image:', img );
							var a = img.closest( 'a' );
							if ( a ) {
								console.info( '[Layers] Parent anchor href:', a.getAttribute( 'href' ) );
								console.info( '[Layers] Parent anchor title:', a.getAttribute( 'title' ) );
							}
							console.info( '[Layers] Image src:', img.getAttribute( 'src' ) );
						}
						return;
					}

					// Gate: allow if per-image explicit intent is present.
					// Treat page-level intent as sufficient ONLY on File pages (NS 6),
					// or when the image clearly links to a File: page on non-File pages.
					var allow = false;
					var allowReason = '';
					if ( pageNsNum === 6 ) {
						allow = pageAllow;
						allowReason = 'File page with pageAllow=' + pageAllow;
					}
					var a2 = img.closest( 'a' );
					if ( !allow && a2 && a2.getAttribute( 'href' ) ) {
						var href2 = a2.getAttribute( 'href' );
						var m = href2.match( /[?&#]layers=([^&#]+)/i );
						if ( m && m[ 1 ] ) {
							var val = decodeURIComponent( m[ 1 ] ).toLowerCase();
							allow = mw.layers.isAllowedLayersValue( val );
							if ( allow ) {
								allowReason = 'per-image layers parameter: ' + val;
							}
						}
						// If page-level intent is present on a non-File page, and this image
						// links to a File: page, allow it narrowly.
						if ( !allow && pageAllow && pageNsNum !== 6 ) {
							try {
								var filePrefixEsc = esc( fileNs ) + ':';
								var reTitleFile = new RegExp( '[?&]title=' + filePrefixEsc, 'i' );
								var rePathFile = new RegExp( '\\/(?:wiki\\/|index\\.php\\/)?' + filePrefixEsc, 'i' );
								var reMediaViewer = new RegExp( '#\\/media\\/' + filePrefixEsc, 'i' );
								var reSpecialFilePath = /\/(?:wiki\/)?Special:(?:FilePath|Redirect\/file)\//i;
								var isTitleMatch = reTitleFile.test( href2 );
								var isPathMatch = rePathFile.test( href2 );
								var isMediaViewer = reMediaViewer.test( href2 );
								var isSpecial = reSpecialFilePath.test( href2 );
								var isFileLink = isTitleMatch || isPathMatch || isMediaViewer || isSpecial;
								// Many skins wrap file images with <a class="mw-file-description"> linking to the file page
								if ( !isFileLink ) {
									var aCls2 = ( a2.getAttribute( 'class' ) || '' ).toLowerCase();
									if ( aCls2.indexOf( 'mw-file-description' ) !== -1 ) {
										isFileLink = true;
									}
								}
								if ( isFileLink ) {
									allow = true;
									allowReason = 'non-File page with pageAllow + file link detected';
								}
								if ( !allow ) {
									var aTitle2 = a2.getAttribute( 'title' ) || '';
									var reATitle = new RegExp( '^' + filePrefixEsc, 'i' );
									if ( reATitle.test( aTitle2 ) ) {
										allow = true;
										allowReason = 'non-File page with pageAllow + file title detected';
									}
								}
							} catch ( eFileLink ) { /* ignore */ }
						}

						// As a narrow fallback: on non-File pages with pageAllow, if we infer a filename
						// and the image appears to be a content image (typical classes), allow it.
						if ( !allow && pageAllow && pageNsNum !== 6 ) {
							var cls = ( img.getAttribute( 'class' ) || '' ) + ' ';
							var looksContent = /(^|\s)(mw-file-element|thumbimage)(\s|$)/.test( cls );
							var a3 = img.closest( 'a' );
							var aCls = a3 ? ( a3.getAttribute( 'class' ) || '' ) + ' ' : '';
							if ( !looksContent && aCls ) {
								looksContent = /(^|\s)(image|internal)(\s|$)/i.test( aCls );
							}
							if ( looksContent ) {
								allow = true;
								allowReason = 'non-File page with pageAllow + content image class detected';
							}
						}
					}
					// Final gate: consult data-mw on ancestors to detect explicit
					// wikitext layers= param
					if ( !allow ) {
						var mwLayers = mw.layers.detectLayersFromDataMw( img );
						if ( mwLayers ) {
							var v = String( mwLayers ).toLowerCase();
							allow = mw.layers.isAllowedLayersValue( v );
							if ( allow ) {
								allowReason = 'data-mw layers parameter: ' + v;
							}
						}
					}
					// If server marked explicit intent, allow
					if ( !allow && img.hasAttribute( 'data-layers-intent' ) ) {
						var intent = ( img.getAttribute( 'data-layers-intent' ) || '' ).toLowerCase();
						if ( intent === 'none' || intent === 'off' ) {
							// Explicitly marked as no-layers, skip regardless of page-level intent
							if ( debug ) {
								console.info( '[Layers] API fallback skipped: explicit no-layers intent' );
								console.info( '[Layers] Reason: data-layers-intent=' + intent );
							}
							return;
						}
						if ( mw.layers.isAllowedLayersValue( intent ) || intent === 'on' ) {
							allow = true;
							allowReason = 'server-marked intent: ' + intent;
						}
					}
					if ( !allow ) {
						if ( debug ) {
							console.info( '[Layers] API fallback skipped: not allowed for this candidate' );
							console.info( '[Layers] Reason: pageAllow=' + pageAllow + 
								', pageNsNum=' + pageNsNum + 
								', filename=' + ( filename || 'none' ) +
								', allowReason=' + ( allowReason || 'none' ) );
							console.info( '[Layers] Candidate image:', img );
						}
						return;
					}
					
					if ( debug ) {
						console.info( '[Layers] API fallback proceeding for filename: ' + filename + ', reason: ' + allowReason );
					}

					api.get( { action: 'layersinfo', format: 'json', filename: filename } ).done( function ( data ) {
						try {
							if ( !data || !data.layersinfo || !data.layersinfo.layerset ) {
								return;
							}
							var ls = data.layersinfo.layerset;
							var layersArr = null;
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
							var baseW = ls.baseWidth || img.naturalWidth || img.width || null;
							var baseH = ls.baseHeight || img.naturalHeight || img.height || null;
							var payload = {
								layers: layersArr,
								baseWidth: baseW,
								baseHeight: baseH
							};

							// Ensure a positioned container
							var container = img.parentNode || img;
							var style = window.getComputedStyle( container );
							if ( !style || style.position === 'static' ) {
								var wrapper = document.createElement( 'span' );
								wrapper.style.position = 'relative';
								wrapper.style.display = 'inline-block';
								container.insertBefore( wrapper, img );
								wrapper.appendChild( img );
								container = wrapper;
							}

							img.layersViewer = new window.LayersViewer( {
								container: container,
								imageElement: img,
								layerData: payload
							} );
							if ( debug ) {
								console.info( '[Layers] API fallback initialized viewer for', filename );
							}
						} catch ( e2 ) {
							if ( debug ) {
								console.warn( '[Layers] API fallback error:', e2 );
							}
						}
					} );
				} );
			} ); // end mw.loader.using('mediawiki.api')
		} catch ( e ) { /* ignore */ }
	},

	/**
	 * On File pages, initialize the main image by fetching layer data via API
	 * if server-side attributes are missing.
	 *
	 * @param {boolean} debug Enable debug logging
	 */
	initializeFilePageFallback: function ( debug ) {
		try {
			if ( typeof mw === 'undefined' ) {
				return;
			}
			var ns = mw.config.get( 'wgNamespaceNumber' );
			if ( ns !== 6 ) {
				return; // NS_FILE only
			}

			// Require explicit layers= in URL (on|all or list). Prevent implicit overlays.
			var pageLayersVal = mw.layers.getPageLayersParam( debug );
			var hasLayersParam = !!pageLayersVal;
			if ( !hasLayersParam ) {
				if ( debug ) {
					console.info( '[Layers] Skipping file page fallback: no layers= in URL' );
				}
				return;
			}

			// Find the main file image on the file description page
			var selector = '#file img, .fullMedia a > img, .mw-filepage-content img';
			var img = document.querySelector( selector );
			if ( !img || img.layersViewer ) {
				return;
			}
			if ( img.getAttribute( 'data-layer-data' ) ) {
				return;
			}

			var pageName = mw.config.get( 'wgPageName' ) || '';
			var canonNs = mw.config.get( 'wgCanonicalNamespace' ) || 'File';
			var prefix = canonNs + ':';
			var filename;
			if ( pageName.indexOf( prefix ) === 0 ) {
				filename = pageName.slice( prefix.length );
			} else {
				filename = pageName;
			}
			try {
				filename = decodeURIComponent( filename );
			} catch ( e ) {}
			filename = filename.replace( /_/g, ' ' );

			var api = new mw.Api();
			api.get( { action: 'layersinfo', format: 'json', filename: filename } ).done( function ( data ) {
				try {
					if ( !data || !data.layersinfo || !data.layersinfo.layerset ) {
						return;
					}
					var layerset = data.layersinfo.layerset;
					var payload = null;
					if ( layerset && layerset.data && ( layerset.data.layers || layerset.data ) ) {
						var layersArr;
						var arrTag = Object.prototype.toString.call( layerset.data.layers );
						if ( layerset.data.layers && arrTag === '[object Array]' ) {
							layersArr = layerset.data.layers;
						} else {
							layersArr = layerset.data;
						}
						if ( layersArr && layersArr.length ) {
							var bw = layerset.baseWidth || img.naturalWidth || img.width || null;
							var bh = layerset.baseHeight || img.naturalHeight || img.height || null;
							payload = {
								layers: layersArr,
								baseWidth: bw,
								baseHeight: bh
							};
						}
					}
					if ( !payload ) {
						return;
					}

					// Ensure container is positioned
					var container = img.parentNode || img;
					var style = window.getComputedStyle( container );
					if ( !style || style.position === 'static' ) {
						var wrapper = document.createElement( 'span' );
						wrapper.style.position = 'relative';
						wrapper.style.display = 'inline-block';
						container.insertBefore( wrapper, img );
						wrapper.appendChild( img );
						container = wrapper;
					}

					img.layersViewer = new window.LayersViewer( {
						container: container,
						imageElement: img,
						layerData: payload
					} );
					if ( debug ) {
						var count2 = 0;
						if ( payload.layers && payload.layers.length ) {
							count2 = payload.layers.length;
						}
						console.info( '[Layers] File page fallback initialized with', count2, 'layers' );
					}
				} catch ( e2 ) {
					if ( debug ) {
						console.warn( '[Layers] File page fallback error:', e2 );
					}
				}
			} ).fail( function () { /* ignore */ } );
		} catch ( e ) {
			if ( debug ) {
				console.warn( '[Layers] File page fallback outer error:', e );
			}
		}
	}
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', function () {
		mw.layers.init();
	} );
} else {
	mw.layers.init();
}
