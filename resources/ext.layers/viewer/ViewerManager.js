/**
 * Viewer initialization and management for Layers.
 *
 * Handles finding images with layer data and initializing LayersViewer instances.
 *
 * @module viewer/ViewerManager
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
	 * ViewerManager class
	 */
class ViewerManager {
	/**
	 * Creates a new ViewerManager instance
	 *
	 * @param {Object} [options] Configuration options
	 * @param {boolean} [options.debug=false] Enable debug logging
	 * @param {LayersUrlParser} [options.urlParser] URL parser instance
	 */
	constructor( options ) {
		this.debug = options && options.debug;
		const LayersUrlParser = getClass( 'Utils.UrlParser', 'LayersUrlParser' );
		this.urlParser = ( options && options.urlParser ) || new LayersUrlParser( { debug: this.debug } );
	}

	/**
	 * Log a debug message if debug mode is enabled.
	 *
	 * @private
	 * @param {...any} args Arguments to log
	 */
	debugLog( ...args ) {
		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log( '[Layers:ViewerManager]', ...args );
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
			mw.log.warn( '[Layers:ViewerManager]', ...args );
		}
	}

	/**
	 * Ensure an element has a positioned container for the viewer overlay.
	 *
	 * @private
	 * @param {HTMLImageElement} img Image element
	 * @return {HTMLElement} Positioned container
	 */
	ensurePositionedContainer ( img ) {
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
		return container;
	}

	/**
	 * Initialize a viewer for an image element with layer data.
	 *
	 * @param {HTMLImageElement} img Image element
	 * @param {Object|Array} layerData Layer data (object with layers array or array directly)
	 * @return {boolean} True if viewer was initialized
	 */
	initializeViewer ( img, layerData ) {
		if ( img.layersViewer ) {
			return false;
		}

		try {
			// Normalize payload to { layers: [...], baseWidth, baseHeight }
			let data = layerData;
			if ( Array.isArray( data ) ) {
				data = { layers: data };
			}

			const container = this.ensurePositionedContainer( img );
			const LayersViewer = getClass( 'Viewer.LayersViewer', 'LayersViewer' );

			img.layersViewer = new LayersViewer( {
				container: container,
				imageElement: img,
				layerData: data
			} );

			let count = 0;
			if ( data.layers && data.layers.length ) {
				count = data.layers.length;
			}
			this.debugLog( 'Viewer initialized with', count, 'layers' );
			this.debugLog( 'baseWidth=', data.baseWidth, 'baseHeight=', data.baseHeight );
			return true;
		} catch ( e ) {
			this.debugWarn( 'Viewer init error:', e );
			return false;
		}
	}

	/**
	 * Find all images with server-provided layer data and initialize viewers.
	 *
	 * Searches for:
	 * 1. img[data-layer-data] - images with direct layer data
	 * 2. a[data-layer-data] > img - images inside links with layer data
	 */
	initializeLayerViewers () {
		// Primary: attributes directly on <img>
		const images = Array.prototype.slice.call(
			document.querySelectorAll( 'img[data-layer-data]' )
		);

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

		// Initialize viewers for each image
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
					layerData = JSON.parse( this.urlParser.decodeHtmlEntities( raw ) );
				} catch ( eParse ) {
					layerData = null;
				}
				if ( !layerData ) {
					return;
				}
				this.initializeViewer( img, layerData );
			} catch ( e ) {
				this.debugWarn( 'Error processing image:', e );
			}
		} );
	}

	/**
	 * On File pages, initialize the main image by fetching layer data via API
	 * if server-side attributes are missing.
	 *
	 * @return {Promise|undefined} API promise or undefined if not applicable
	 */
	initializeFilePageFallback () {
		try {
			if ( typeof mw === 'undefined' ) {
				return;
			}

			const ns = this.urlParser.getNamespaceNumber();
			if ( ns !== 6 ) {
				return; // NS_FILE only
			}

			// Require explicit layers= in URL
			const pageLayersVal = this.urlParser.getPageLayersParam();
			if ( !pageLayersVal ) {
				this.debugLog( 'Skipping file page fallback: no layers= in URL' );
				return;
			}

			// Find the main file image
			const selector = '#file img, .fullMedia a > img, .mw-filepage-content img';
			const img = document.querySelector( selector );
			if ( !img || img.layersViewer ) {
				return;
			}
			if ( img.getAttribute( 'data-layer-data' ) ) {
				return;
			}

			// Get filename from page
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
			} catch ( decodeError ) {
				this.debugWarn( 'Failed to decode filename URI:', decodeError.message );
			}
			filename = filename.replace( /_/g, ' ' );

			// Fetch layer data via API
			const api = new mw.Api();
			return api.get( {
				action: 'layersinfo',
				format: 'json',
				filename: filename
			} ).then( ( data ) => {
				try {
					if ( !data || !data.layersinfo || !data.layersinfo.layerset ) {
						return;
					}

					const layerset = data.layersinfo.layerset;
					let layersArr = null;

					if ( layerset && layerset.data ) {
						const arrTag = Object.prototype.toString.call( layerset.data.layers );
						if ( layerset.data.layers && arrTag === '[object Array]' ) {
							layersArr = layerset.data.layers;
						} else if ( Array.isArray( layerset.data ) ) {
							layersArr = layerset.data;
						}
					}

					if ( !layersArr || !layersArr.length ) {
						return;
					}

					const payload = {
						layers: layersArr,
						baseWidth: layerset.baseWidth || img.naturalWidth || img.width || null,
						baseHeight: layerset.baseHeight || img.naturalHeight || img.height || null
					};

					this.initializeViewer( img, payload );
					this.debugLog( 'File page fallback initialized with', layersArr.length, 'layers' );
				} catch ( e2 ) {
					this.debugWarn( 'File page fallback error:', e2 );
				}
			} ).catch( ( apiErr ) => {
				this.debugWarn( 'File page API request failed:', apiErr );
			} );
		} catch ( e ) {
			this.debugWarn( 'File page fallback outer error:', e );
		}
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.Manager = ViewerManager;
	}

	// CommonJS export for Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ViewerManager;
	}

}() );
