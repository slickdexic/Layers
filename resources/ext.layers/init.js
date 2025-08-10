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

		// Initialize viewers for images annotated by server hooks
		self.initializeLayerViewers( debug );

		// File page fallback if nothing found via attributes
		self.initializeFilePageFallback( debug );

		// Re-scan when the page content changes (guard if mw.hook is unavailable)
		try {
			if ( mw && mw.hook && typeof mw.hook === 'function' ) {
				mw.hook( 'wikipage.content' ).add( function () {
					self.initializeLayerViewers( debug );
					self.initializeFilePageFallback( debug );
				} );
			}
		} catch ( e ) { /* ignore */ }
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
		return s
			.replace( /&amp;quot;/g, '"' )
			.replace( /&quot;/g, '"' )
			.replace( /&#34;/g, '"' )
			.replace( /&#x22;/gi, '"' );
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
			// eslint-disable-next-line no-console
			console.debug( '[Layers] Found', images.length, 'candidate <img> elements with data-layer-data' );
		}

		// Fallback: attributes on wrapping <a>, move them to img for viewer
		var anchors = Array.prototype.slice.call( document.querySelectorAll( 'a[data-layer-data] > img' ) );
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
					// eslint-disable-next-line no-console
					console.debug( '[Layers] Moved data-layer-data from <a> to <img>' );
				}
			}
		} );

		images.forEach( function ( img ) {
			if ( img.layersViewer ) {
				return; // Already initialized
			}
			try {
				var json = img.getAttribute( 'data-layer-data' );
				if ( !json ) {
					return;
				}
				var layerData;
				try {
					layerData = JSON.parse( json );
				} catch ( eParse ) {
					// Attribute JSON can be entity-escaped by upstream HTML.
					// Decode entities and parse again.
					var unescaped = self.decodeHtmlEntities( json );
					if ( debug ) {
						// eslint-disable-next-line no-console
						console.debug( '[Layers] JSON parse failed, retrying after entity decode', eParse );
					}
					layerData = JSON.parse( unescaped );
				}
				if ( !layerData || !layerData.layers ) {
					if ( debug ) {
						// eslint-disable-next-line no-console
						console.debug( '[Layers] No usable layerData on element', img );
					}
					return;
				}
				// Ensure the overlay container is the image's immediate parent
				var container = img.parentNode || img;
				// If the parent isn't an element capable of positioning, wrap the image
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
					var count = ( layerData.layers && layerData.layers.length ) || 0;
					// eslint-disable-next-line no-console
					console.debug( '[Layers] Viewer initialized with', count, 'layers. baseWidth=', layerData.baseWidth, 'baseHeight=', layerData.baseHeight );
				}
			} catch ( e ) {
				// swallow to avoid breaking page rendering
				if ( debug ) {
					// eslint-disable-next-line no-console
					console.warn( '[Layers] Viewer init error:', e );
				}
			}
		} );
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
			} catch ( e ) {
				// ignore
			}
			filename = filename.replace( /_/g, ' ' );

			var api = new mw.Api();
			api.get( {
				action: 'layersinfo',
				format: 'json',
				filename: filename
			} ).done( function ( data ) {
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
							payload = {
								layers: layersArr,
								baseWidth: img.naturalWidth || img.width || null,
								baseHeight: img.naturalHeight || img.height || null
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
						var count2 = ( payload.layers && payload.layers.length ) || 0;
						// eslint-disable-next-line no-console
						console.debug( '[Layers] File page fallback initialized with', count2, 'layers' );
					}
				} catch ( e2 ) {
					// ignore
					if ( debug ) {
						// eslint-disable-next-line no-console
						console.warn( '[Layers] File page fallback error:', e2 );
					}
				}
			} ).fail( function () { /* ignore */ } );
		} catch ( e ) {
			// ignore
			if ( debug ) {
				// eslint-disable-next-line no-console
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
