// mw.layers bootstrap
// Initializes viewers for annotated images and refreshes on content changes
mw.layers = {
	debug: false,

	/**
	 * Log a debug message if debug mode is enabled.
	 * @param {...any} args Arguments to log.
	 */
	debugLog: function ( ...args ) {
		if ( this.debug ) {
			// eslint-disable-next-line no-console
			console.log( '[Layers]', ...args );
		}
	},

	/**
	 * Log a warning message if debug mode is enabled.
	 * @param {...any} args Arguments to log.
	 */
	debugWarn: function ( ...args ) {
		if ( this.debug ) {
			// eslint-disable-next-line no-console
			console.warn( '[Layers]', ...args );
		}
	},

	/** Initialize lightweight viewers and bind refresh on content changes */
	init: function () {
		const self = this;
		try {
			this.debug = !!( typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' ) );
		} catch ( e ) {}

		this.debugLog( 'init() starting' );
		try {
			this.debugLog( 'href:', String( window.location && window.location.href ) );
		} catch ( eHref ) { /* ignore */ }

		// Initialize viewers for images annotated by server hooks
		self.initializeLayerViewers();

		// File page fallback if nothing found via attributes (gated to explicit layers=)
		self.initializeFilePageFallback();

		// If an image is marked layered but lacks inline data, fetch via API
		self.initializeApiFallbackForMissingData();

		// Re-scan when the page content changes (guard if mw.hook is unavailable)
		try {
			if ( mw && mw.hook && typeof mw.hook === 'function' ) {
				mw.hook( 'wikipage.content' ).add( () => {
					self.initializeLayerViewers();
					self.initializeFilePageFallback();
					self.initializeApiFallbackForMissingData();
				} );
			}
		} catch ( e ) { /* ignore */ }
	},

	/**
	 * Get the page-level layers parameter value if present.
	 * Returns the raw value (string) or null.
	 *
	 * @return {string|null}
	 */
	getPageLayersParam: function () {
		let pageLayersVal = null;
		try {
			// Prefer server-provided value if available
			if ( mw.config && typeof mw.config.get === 'function' ) {
				const cfgVal = mw.config.get( 'wgLayersParam' );
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
			const loc = String( window.location.href || '' );
			if ( !pageLayersVal ) {
				try {
					const u = new URL( loc );
					pageLayersVal = u.searchParams.get( 'layers' ) || u.searchParams.get( 'Layers' );
					if ( !pageLayersVal && u.hash ) {
						const mh = u.hash.match( /(?:^|[?&#;])layers=([^&#;]+)/i );
						if ( mh && mh[ 1 ] ) {
							pageLayersVal = decodeURIComponent( mh[ 1 ] );
						}
					}
				} catch ( eUrl ) { /* ignore */ }
			}
			if ( !pageLayersVal ) {
				const mPage = loc.match( /[?&#;]layers=([^&#;]+)/i );
				if ( mPage && mPage[ 1 ] ) {
					pageLayersVal = decodeURIComponent( mPage[ 1 ] );
				}
			}
		} catch ( e ) { /* ignore */ }
		if ( pageLayersVal ) {
			this.debugLog( 'page-level layers param detected:', pageLayersVal );
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
		let out = s.replace( /&amp;/g, '&' );
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
						// If JSON parse fails, attempt to extract layers=... via regex
						try {
							const layersRegex = /layers\s*=\s*([^,;\]\s"']+)/i;
							const rm = String( raw ).match( layersRegex );
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
	 */
	initializeLayerViewers: function () {
		const self = this;
		// Primary: attributes directly on <img>
		const images = Array.prototype.slice.call( document.querySelectorAll( 'img[data-layer-data]' ) );
		// Ensure the marker class exists for any img we found
		images.forEach( ( img ) => {
			const cls = img.getAttribute( 'class' ) || '';
			if ( !cls.includes( 'layers-thumbnail' ) ) {
				img.setAttribute( 'class', ( cls + ' layers-thumbnail' ).trim() );
			}
		} );
		this.debugLog( 'Found', images.length, 'candidate <img> elements with data-layer-data' );

		// Fallback: attributes on wrapping <a>, move them to img for viewer
		const anchors = Array.prototype.slice.call(
			document.querySelectorAll( 'a[data-layer-data] > img' )
		);
		anchors.forEach( ( img ) => {
			if ( img.hasAttribute( 'data-layer-data' ) ) {
				return;
			}
			const a = img.parentNode && img.parentNode.nodeType === 1 ? img.parentNode : null;
			if ( a && a.hasAttribute( 'data-layer-data' ) ) {
				img.setAttribute( 'data-layer-data', a.getAttribute( 'data-layer-data' ) );
				const cls = img.getAttribute( 'class' ) || '';
				if ( !cls.includes( 'layers-thumbnail' ) ) {
					img.setAttribute( 'class', ( cls + ' layers-thumbnail' ).trim() );
				}
				images.push( img );
				this.debugLog( 'Moved data-layer-data from <a> to <img>' );
			}
		} );

		images.forEach( ( img ) => {
			if ( img.layersViewer ) {
				return;
			}
			try {
				const raw = img.getAttribute( 'data-layer-data' );
				if ( !raw ) {
					return;
				}
				let layerData = null;
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
				let container = img.parentNode || img;
				const style = window.getComputedStyle( container );
				if ( !style || style.position === 'static' ) {
					const wrapper = document.createElement( 'span' );
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
				let count = 0;
				if ( layerData.layers && layerData.layers.length ) {
					count = layerData.layers.length;
				}
				this.debugLog( 'Viewer initialized with', count );
				this.debugLog( 'baseWidth=', layerData.baseWidth, 'baseHeight=', layerData.baseHeight );
			} catch ( e ) {
				// swallow to avoid breaking page rendering
				this.debugWarn( 'Viewer init error:', e );
			}
		} );
	},

	/**
	 * Fallback: If an image is marked as a layers thumbnail but lacks data-layer-data,
	 * fetch the latest/specified layer set via API and initialize the viewer.
	 * This helps when server-side attribute injection was bypassed in a given render path.
	 */
	initializeApiFallbackForMissingData: function () {
		try {
			if ( typeof mw === 'undefined' || !mw.loader ||
				typeof mw.loader.using !== 'function' ) {
				return;
			}
			// Ensure mediawiki.api is present before proceeding
			mw.loader.using( 'mediawiki.api' ).then( () => {
				// Detect page-level explicit layers intent (?layers=... in URL)
				let pageAllow = false;
				const pageLayersVal = mw.layers.getPageLayersParam();
				if ( pageLayersVal ) {
					pageAllow = mw.layers.isAllowedLayersValue(
						String( pageLayersVal ).toLowerCase()
					);
				}

				// Namespace awareness: treat page-level gating as sufficient only on File pages
				let pageNsNum = -1;
				try {
					if ( mw.config && mw.config.get ) {
						pageNsNum = mw.config.get( 'wgNamespaceNumber' );
					} else {
						pageNsNum = -1;
					}
				} catch ( eNsNum ) { /* ignore */ }

				// Build candidate list (avoid duplicates)
				const candidates = [];
				const addAll = function ( selector ) {
					const list = document.querySelectorAll( selector );
					Array.prototype.forEach.call( list, ( el ) => {
						const idx = candidates.indexOf( el );
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

				this.debugLog( 'API fallback: pageAllow=', pageAllow, 'ns=', pageNsNum, 'candidates=', candidates.length );
				if ( !candidates.length ) {
					return;
				}

				// Localized File namespace name (default "File")
				let fileNs = 'File';
				try {
					const nsMap = mw.config && mw.config.get ? mw.config.get( 'wgFormattedNamespaces' ) : null;
					const name = nsMap && nsMap[ '6' ] ? String( nsMap[ '6' ] ) : null;
					if ( name ) {
						fileNs = name;
					}
				} catch ( eNs ) { /* ignore */ }
				const esc = function ( s ) {
					return mw.layers.escRe( s );
				};

				const api = new mw.Api();

				// Helper: try to extract filename from various attributes and URL patterns
				const inferFilename = function ( imgEl, fileNamespace ) {
					let filename = null;
					const a = imgEl.closest( 'a' );
					if ( a && a.getAttribute( 'href' ) ) {
						const href = a.getAttribute( 'href' );
						try {
							const decodedHref = href;
							// Prefer query param title=<FileNs>:
							const reTitle = new RegExp( '[?&]title=' + esc( fileNamespace ) + ':([^&#]+)', 'i' );
							const mTitle = decodedHref.match( reTitle );
							if ( mTitle && mTitle[ 1 ] ) {
								filename = decodeURIComponent( mTitle[ 1 ] ).replace( /_/g, ' ' );
							} else {
								// Path-style: /wiki/<FileNs>:... or /index.php/<FileNs>:...
								const rePath = new RegExp(
									'\\/(?:wiki\\/|index\\.php\\/)?' + esc( fileNamespace ) + ':([^?#]+)',
									'i'
								);
								const mPath = decodedHref.match( rePath );
								if ( mPath && mPath[ 1 ] ) {
									filename = decodeURIComponent( mPath[ 1 ] ).replace( /_/g, ' ' );
								}
							}
						} catch ( e ) { /* ignore */ }
					}

					// Some skins put the title in the anchor title attribute
					if ( !filename && a && a.getAttribute( 'title' ) ) {
						const aTitle = a.getAttribute( 'title' );
						try {
							const nsMap2 = mw.config && mw.config.get ? mw.config.get( 'wgFormattedNamespaces' ) : null;
							const name2 = nsMap2 && nsMap2[ '6' ] ? String( nsMap2[ '6' ] ) : 'File';
							const rePrefix = new RegExp( '^' + esc( name2 ) + ':', 'i' );
							if ( rePrefix.test( aTitle ) ) {
								filename = aTitle.replace( rePrefix, '' ).replace( /_/g, ' ' );
							}
						} catch ( eT ) { /* ignore */ }
					}

					// Try common data attributes on the image or its parent containers
					if ( !filename ) {
						const dataFile = imgEl.getAttribute( 'data-file' ) || ( a && a.getAttribute( 'data-file' ) );
						if ( dataFile ) {
							filename = String( dataFile ).replace( /_/g, ' ' );
						}
					}
					if ( !filename ) {
						const dataImageName = imgEl.getAttribute( 'data-image-name' ) || ( a && a.getAttribute( 'data-image-name' ) );
						if ( dataImageName ) {
							filename = String( dataImageName ).replace( /_/g, ' ' );
						}
					}

					// Parse from image src path (thumbnail/original)
					if ( !filename ) {
						const src = imgEl.getAttribute( 'src' ) || '';
						try {
							const rx = /\/([-A-Za-z0-9%_. ]+?\.(?:png|jpe?g|gif|svg|webp|tiff?))(?:[/?#]|$)/i;
							const mSrc = src.match( rx );
							if ( mSrc && mSrc[ 1 ] ) {
								filename = decodeURIComponent( mSrc[ 1 ] ).replace( /_/g, ' ' );
							}
						} catch ( eS ) { /* ignore */ }
					}

					return filename;
				};

				candidates.forEach( ( img ) => {
					if ( img.layersViewer ) {
						return;
					}

					// Early check: if image is explicitly marked as no-layers, skip it entirely
					if ( img.hasAttribute( 'data-layers-intent' ) ) {
						const intentEarly = ( img.getAttribute( 'data-layers-intent' ) || '' ).toLowerCase();
						if ( intentEarly === 'none' || intentEarly === 'off' ) {
							this.debugLog( 'Skipping image with explicit no-layers intent: ' + intentEarly );
							return;
						}
					}

					let filename = inferFilename( img, fileNs );
					if ( !filename ) {
						// As a last resort on file pages, fall back to wgPageName
						try {
							const curNsNum = mw.config.get( 'wgNamespaceNumber' );
							if ( curNsNum === 6 ) {
								const pageName = mw.config.get( 'wgPageName' ) || '';
								const canonNs = mw.config.get( 'wgCanonicalNamespace' ) || 'File';
								const prefix = canonNs + ':';
								const hasPrefix = pageName.indexOf( prefix ) === 0;
								if ( hasPrefix ) {
									filename = pageName.slice( prefix.length ).replace( /_/g, ' ' );
								} else {
									filename = null;
								}
							}
						} catch ( e2 ) { /* ignore */ }
					}
					if ( !filename ) {
						this.debugLog( 'API fallback skipped: no filename inferred for candidate' );
						this.debugLog( 'Attempted inference from href, title, data attributes, and src' );
						this.debugLog( 'Candidate image:', img );
						const a = img.closest( 'a' );
						if ( a ) {
							this.debugLog( 'Parent anchor href:', a.getAttribute( 'href' ) );
							this.debugLog( 'Parent anchor title:', a.getAttribute( 'title' ) );
						}
						this.debugLog( 'Image src:', img.getAttribute( 'src' ) );
						return;
					}

					// Gate: allow if per-image explicit intent is present.
					// Treat page-level intent as sufficient ONLY on File pages (NS 6),
					// or when the image clearly links to a File: page on non-File pages.
					let allow = false;
					let allowReason = '';
					if ( pageNsNum === 6 ) {
						allow = pageAllow;
						allowReason = 'File page with pageAllow=' + pageAllow;
					}
					const a2 = img.closest( 'a' );
					if ( !allow && a2 && a2.getAttribute( 'href' ) ) {
						const href2 = a2.getAttribute( 'href' );
						const m = href2.match( /[?&#]layers=([^&#]+)/i );
						if ( m && m[ 1 ] ) {
							const val = decodeURIComponent( m[ 1 ] ).toLowerCase();
							allow = mw.layers.isAllowedLayersValue( val );
							if ( allow ) {
								allowReason = 'per-image layers parameter: ' + val;
							}
						}
						// If page-level intent is present on a non-File page, and this image
						// links to a File: page, allow it narrowly.
						if ( !allow && pageAllow && pageNsNum !== 6 ) {
							try {
								const filePrefixEsc = esc( fileNs ) + ':';
								const reTitleFile = new RegExp( '[?&]title=' + filePrefixEsc, 'i' );
								const rePathFile = new RegExp( '\\/(?:wiki\\/|index\\.php\\/)?' + filePrefixEsc, 'i' );
								const reMediaViewer = new RegExp( '#\\/media\\/' + filePrefixEsc, 'i' );
								const reSpecialFilePath = /\/(?:wiki\/)?Special:(?:FilePath|Redirect\/file)\//i;
								const isTitleMatch = reTitleFile.test( href2 );
								const isPathMatch = rePathFile.test( href2 );
								const isMediaViewer = reMediaViewer.test( href2 );
								const isSpecial = reSpecialFilePath.test( href2 );
								let isFileLink = isTitleMatch || isPathMatch ||
									isMediaViewer || isSpecial;
								// Many skins wrap file images with <a class="mw-file-description">
								// linking to the file page
								if ( !isFileLink ) {
									const aCls2 = ( a2.getAttribute( 'class' ) || '' )
										.toLowerCase();
									if ( aCls2.includes( 'mw-file-description' ) ) {
										isFileLink = true;
									}
								}
								if ( isFileLink ) {
									allow = true;
									allowReason = 'non-File page with pageAllow + file link detected';
								}
								if ( !allow ) {
									const aTitle2 = a2.getAttribute( 'title' ) || '';
									const reATitle = new RegExp( '^' + filePrefixEsc, 'i' );
									if ( reATitle.test( aTitle2 ) ) {
										allow = true;
										allowReason = 'non-File page with pageAllow + file title detected';
									}
								}
							} catch ( eFileLink ) { /* ignore */ }
						}

						// As a narrow fallback: on non-File pages with pageAllow,
						// if we infer a filename and the image appears to be a content image
						if ( !allow && pageAllow && pageNsNum !== 6 ) {
							const cls = ( img.getAttribute( 'class' ) || '' ) + ' ';
							let looksContent = /(^|\s)(mw-file-element|thumbimage)(\s|$)/.test( cls );
							const a3 = img.closest( 'a' );
							const aCls = a3 ? ( a3.getAttribute( 'class' ) || '' ) + ' ' : '';
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
						const mwLayers = mw.layers.detectLayersFromDataMw( img );
						if ( mwLayers ) {
							const v = String( mwLayers ).toLowerCase();
							allow = mw.layers.isAllowedLayersValue( v );
							if ( allow ) {
								allowReason = 'data-mw layers parameter: ' + v;
							}
						}
					}
					// If server marked explicit intent, allow
					if ( !allow && img.hasAttribute( 'data-layers-intent' ) ) {
						const intent = ( img.getAttribute( 'data-layers-intent' ) || '' ).toLowerCase();
						if ( intent === 'none' || intent === 'off' ) {
							// Explicitly marked as no-layers, skip regardless of page-level intent
							this.debugLog( 'API fallback skipped: explicit no-layers intent' );
							this.debugLog( 'Reason: data-layers-intent=' + intent );
							return;
						}
						if ( mw.layers.isAllowedLayersValue( intent ) || intent === 'on' ) {
							allow = true;
							allowReason = 'server-marked intent: ' + intent;
						}
					}
					if ( !allow ) {
						this.debugLog( 'API fallback skipped: not allowed for this candidate' );
						this.debugLog( 'Reason: pageAllow=' + pageAllow +
								', pageNsNum=' + pageNsNum +
								', filename=' + ( filename || 'none' ) +
								', allowReason=' + ( allowReason || 'none' ) );
						this.debugLog( 'Candidate image:', img );
						return;
					}

					this.debugLog( 'API fallback proceeding for filename: ' + filename + ', reason: ' + allowReason );

					api.get( { action: 'layersinfo', format: 'json', filename: filename } ).then( ( data ) => {
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
							const baseW = ls.baseWidth || img.naturalWidth || img.width || null;
							const baseH = ls.baseHeight || img.naturalHeight || img.height || null;
							const payload = {
								layers: layersArr,
								baseWidth: baseW,
								baseHeight: baseH
							};

							// Ensure a positioned container
							let container = img.parentNode || img;
							const style = window.getComputedStyle( container );
							if ( !style || style.position === 'static' ) {
								const wrapper = document.createElement( 'span' );
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
							this.debugLog( 'API fallback initialized viewer for', filename );
						} catch ( e2 ) {
							this.debugWarn( 'API fallback error:', e2 );
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
			const ns = mw.config.get( 'wgNamespaceNumber' );
			if ( ns !== 6 ) {
				return; // NS_FILE only
			}

			// Require explicit layers= in URL (on|all or list). Prevent implicit overlays.
			const pageLayersVal = mw.layers.getPageLayersParam( debug );
			const hasLayersParam = !!pageLayersVal;
			if ( !hasLayersParam ) {
				if ( debug ) {
					console.info( '[Layers] Skipping file page fallback: no layers= in URL' );
				}
				return;
			}

			// Find the main file image on the file description page
			const selector = '#file img, .fullMedia a > img, .mw-filepage-content img';
			const img = document.querySelector( selector );
			if ( !img || img.layersViewer ) {
				return;
			}
			if ( img.getAttribute( 'data-layer-data' ) ) {
				return;
			}

			const pageName = mw.config.get( 'wgPageName' ) || '';
			const canonNs = mw.config.get( 'wgCanonicalNamespace' ) || 'File';
			const prefix = canonNs + ':';
			let filename;
			if ( pageName.indexOf( prefix ) === 0 ) {
				filename = pageName.slice( prefix.length );
			} else {
				filename = pageName;
			}
			try {
				filename = decodeURIComponent( filename );
			} catch ( e ) {}
			filename = filename.replace( /_/g, ' ' );

			const api = new mw.Api();
			api.get( { action: 'layersinfo', format: 'json', filename: filename } ).then( ( data ) => {
				try {
					if ( !data || !data.layersinfo || !data.layersinfo.layerset ) {
						return;
					}
					const layerset = data.layersinfo.layerset;
					let payload = null;
					if ( layerset && layerset.data && ( layerset.data.layers || layerset.data ) ) {
						let layersArr;
						const arrTag = Object.prototype.toString.call( layerset.data.layers );
						if ( layerset.data.layers && arrTag === '[object Array]' ) {
							layersArr = layerset.data.layers;
						} else {
							layersArr = layerset.data;
						}
						if ( layersArr && layersArr.length ) {
							const bw = layerset.baseWidth || img.naturalWidth || img.width || null;
							const bh = layerset.baseHeight || img.naturalHeight ||
								img.height || null;
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
					let container = img.parentNode || img;
					const style = window.getComputedStyle( container );
					if ( !style || style.position === 'static' ) {
						const wrapper = document.createElement( 'span' );
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
						let count2 = 0;
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
			} ).catch( () => { /* ignore */ } );
		} catch ( e ) {
			if ( debug ) {
				console.warn( '[Layers] File page fallback outer error:', e );
			}
		}
	}
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', () => {
		mw.layers.init();
	} );
} else {
	mw.layers.init();
}
