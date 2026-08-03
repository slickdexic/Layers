/**
 * PdfRenderer - client-side PDF page rasterizer built on Mozilla's pdf.js.
 *
 * Renders a single page of a PDF document to an offscreen canvas and returns it
 * as a PNG data URL, so the rest of the viewer pipeline (which is image-based)
 * can display and overlay layers on top of a crisp, natively-rendered page
 * without the reader ever leaving the wiki.
 *
 * The heavy pdf.js library is only loaded on demand (via the on-demand
 * ResourceLoader module `ext.layers.pdfjs`) the first time a PDF is actually
 * rendered, so normal article page loads are unaffected. If pdf.js cannot be
 * loaded, or the document cannot be fetched (e.g. a cross-origin file without
 * CORS), callers are expected to fall back to the server-rasterized page
 * thumbnail.
 *
 * @module viewer/PdfRenderer
 */
( function () {
	'use strict';

	/**
	 * Name of the on-demand ResourceLoader module that ships the vendored
	 * pdf.js library.
	 * @constant {string}
	 */
	const PDFJS_MODULE = 'ext.layers.pdfjs';

	/**
	 * Path (relative to $wgExtensionAssetsPath) of the vendored pdf.js worker.
	 * Referenced by URL so pdf.js can spawn its background worker; pdf.js falls
	 * back to main-thread rendering automatically if the worker cannot start
	 * (e.g. a strict Content-Security-Policy).
	 * @constant {string}
	 */
	const WORKER_PATH = 'Layers/resources/lib/pdfjs/pdf.worker.min.js';

	/**
	 * Default rendered width (CSS px) for a page raster. Chosen to stay crisp at
	 * moderate zoom levels without producing an excessively large canvas.
	 * @constant {number}
	 */
	const DEFAULT_TARGET_WIDTH = 1600;

	/**
	 * Hard cap on the largest side of a rendered page, to bound memory use for
	 * very large pages.
	 * @constant {number}
	 */
	const DEFAULT_MAX_DIMENSION = 4000;

	/**
	 * PdfRenderer class.
	 */
	class PdfRenderer {
		/**
		 * @param {Object} [options] Configuration options.
		 * @param {boolean} [options.debug=false] Enable debug logging.
		 * @param {Object} [options.pdfjsLib] Pre-resolved pdf.js library (mainly
		 *   for testing). When supplied, no loading is attempted.
		 * @param {Function} [options.loadLibrary] Custom loader returning a
		 *   Promise that resolves to the pdf.js library (mainly for testing).
		 */
		constructor( options = {} ) {
			this.debug = options.debug || false;
			this._pdfjsLib = options.pdfjsLib || null;
			this._loadLibrary = options.loadLibrary || null;
			this._libPromise = null;
			// url -> Promise<PDFDocumentProxy>
			this._docCache = new Map();
		}

		/**
		 * Debug logging helper.
		 *
		 * @param {...any} args Values to log.
		 * @private
		 */
		debugLog( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log( '[PdfRenderer]', ...args );
			}
		}

		/**
		 * Whether a client-side render can even be attempted in this
		 * environment. False on very old browsers or when neither an injected
		 * library nor MediaWiki's ResourceLoader is present.
		 *
		 * @return {boolean} True if rendering may be attempted.
		 */
		isAvailable() {
			if ( this._pdfjsLib || this._loadLibrary ) {
				return true;
			}
			return typeof mw !== 'undefined' && !!mw.loader &&
				typeof mw.loader.using === 'function';
		}

		/**
		 * Resolve the pdf.js library, loading it on demand the first time.
		 * The promise is cached; on failure the cache is cleared so a later
		 * attempt can retry.
		 *
		 * @return {Promise<Object>} Resolves to the pdf.js library.
		 */
		ensureLibrary() {
			if ( this._pdfjsLib ) {
				return Promise.resolve( this._pdfjsLib );
			}
			if ( this._libPromise ) {
				return this._libPromise;
			}
			const loader = this._loadLibrary || ( () => this._loadViaResourceLoader() );
			this._libPromise = Promise.resolve().then( loader ).then( ( lib ) => {
				if ( !lib || typeof lib.getDocument !== 'function' ) {
					throw new Error( 'pdf.js library unavailable' );
				}
				this._configureWorker( lib );
				this._pdfjsLib = lib;
				return lib;
			} ).catch( ( err ) => {
				this._libPromise = null;
				throw err;
			} );
			return this._libPromise;
		}

		/**
		 * Load pdf.js through MediaWiki's ResourceLoader on-demand module.
		 *
		 * @return {Promise<Object>} Resolves to the pdf.js library.
		 * @private
		 */
		_loadViaResourceLoader() {
			if ( typeof mw === 'undefined' || !mw.loader ||
				typeof mw.loader.using !== 'function' ) {
				return Promise.reject( new Error( 'ResourceLoader unavailable' ) );
			}
			return mw.loader.using( PDFJS_MODULE ).then( ( req ) => {
				let lib = null;
				// packageFiles module: the entry file returns the pdf.js library.
				if ( typeof req === 'function' ) {
					try {
						lib = req( PDFJS_MODULE );
					} catch ( e ) {
						lib = null;
					}
				}
				// The UMD build also assigns a global; use it as a fallback.
				if ( !lib && typeof window !== 'undefined' ) {
					lib = window.pdfjsLib || null;
				}
				return lib;
			} );
		}

		/**
		 * Point pdf.js at the vendored worker script (once). Best-effort: any
		 * failure leaves pdf.js to fall back to main-thread rendering.
		 *
		 * @param {Object} lib The pdf.js library.
		 * @private
		 */
		_configureWorker( lib ) {
			try {
				if ( lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc ) {
					lib.GlobalWorkerOptions.workerSrc = this._workerUrl();
				}
			} catch ( e ) {
				// Ignore: pdf.js will use its main-thread fallback worker.
			}
		}

		/**
		 * Build the absolute URL of the vendored pdf.js worker.
		 *
		 * @return {string} Worker URL.
		 * @private
		 */
		_workerUrl() {
			let base = '';
			if ( typeof mw !== 'undefined' && mw.config &&
				typeof mw.config.get === 'function' ) {
				base = mw.config.get( 'wgExtensionAssetsPath' ) || '';
			}
			if ( base && base.charAt( base.length - 1 ) !== '/' ) {
				base += '/';
			}
			return base + WORKER_PATH;
		}

		/**
		 * Load (and cache) a PDF document proxy for a URL.
		 *
		 * @param {string} url URL of the PDF file.
		 * @return {Promise<Object>} Resolves to a pdf.js PDFDocumentProxy.
		 */
		getDocument( url ) {
			if ( this._docCache.has( url ) ) {
				return this._docCache.get( url );
			}
			const promise = this.ensureLibrary().then( ( lib ) => {
				const task = lib.getDocument( { url: url } );
				return task.promise;
			} ).catch( ( err ) => {
				this._docCache.delete( url );
				throw err;
			} );
			this._docCache.set( url, promise );
			return promise;
		}

		/**
		 * Render a single page to a PNG data URL.
		 *
		 * @param {string} url URL of the PDF file.
		 * @param {number} pageNumber 1-based page number.
		 * @param {Object} [options] Rendering options.
		 * @param {number} [options.targetWidth=1600] Desired rendered width in px.
		 * @param {number} [options.maxDimension=4000] Cap on the largest side.
		 * @return {Promise<Object>} Resolves to
		 *   `{ dataUrl, width, height, pageCount }`.
		 */
		renderPage( url, pageNumber, options = {} ) {
			const targetWidth = options.targetWidth > 0 ?
				options.targetWidth : DEFAULT_TARGET_WIDTH;
			const maxDimension = options.maxDimension > 0 ?
				options.maxDimension : DEFAULT_MAX_DIMENSION;
			const requested = parseInt( pageNumber, 10 ) > 0 ?
				parseInt( pageNumber, 10 ) : 1;

			return this.getDocument( url ).then( ( doc ) => {
				const pageCount = doc.numPages || 1;
				const page = Math.min( Math.max( 1, requested ), pageCount );
				return doc.getPage( page ).then( ( pdfPage ) => {
					const base = pdfPage.getViewport( { scale: 1 } );
					let scale = targetWidth / ( base.width || targetWidth );
					if ( !( scale > 0 ) ) {
						scale = 1;
					}
					const largest = Math.max( base.width, base.height ) * scale;
					if ( largest > maxDimension ) {
						scale = scale * ( maxDimension / largest );
					}
					const viewport = pdfPage.getViewport( { scale: scale } );
					const canvas = document.createElement( 'canvas' );
					const width = Math.max( 1, Math.round( viewport.width ) );
					const height = Math.max( 1, Math.round( viewport.height ) );
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext( '2d' );
					const task = pdfPage.render( {
						canvasContext: ctx,
						viewport: viewport
					} );
					return task.promise.then( () => {
						let dataUrl = null;
						try {
							dataUrl = canvas.toDataURL( 'image/png' );
						} catch ( e ) {
							dataUrl = null;
						}
						if ( typeof pdfPage.cleanup === 'function' ) {
							try {
								pdfPage.cleanup();
							} catch ( e ) {
								// Non-fatal.
							}
						}
						return {
							dataUrl: dataUrl,
							width: width,
							height: height,
							pageCount: pageCount
						};
					} );
				} );
			} );
		}

		/**
		 * Get the number of pages in a PDF document.
		 *
		 * @param {string} url URL of the PDF file.
		 * @return {Promise<number>} Resolves to the page count.
		 */
		getPageCount( url ) {
			return this.getDocument( url ).then( ( doc ) => doc.numPages || 1 );
		}

		/**
		 * Release all cached documents and their pdf.js resources.
		 */
		destroy() {
			this._docCache.forEach( ( promise ) => {
				Promise.resolve( promise ).then( ( doc ) => {
					if ( doc && typeof doc.destroy === 'function' ) {
						try {
							doc.destroy();
						} catch ( e ) {
							// Non-fatal.
						}
					}
				} ).catch( () => {} );
			} );
			this._docCache.clear();
		}
	}

	// Export to the window.Layers namespace (and a flat global for getClass()).
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.PdfRenderer = PdfRenderer;
		window.LayersPdfRenderer = PdfRenderer;
	}

	// CommonJS export for Jest testing.
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PdfRenderer;
	}

}() );
