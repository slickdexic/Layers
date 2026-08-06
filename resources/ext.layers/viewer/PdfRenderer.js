/**
 * PdfRenderer - client-side PDF page rasterizer built on Mozilla's pdf.js.
 *
 * Renders a single page of a PDF document to an offscreen canvas and returns it
 * as a PNG data URL, so the rest of the viewer pipeline (which is image-based)
 * can display and overlay layers on top of a crisp, natively-rendered page
 * without the reader ever leaving the wiki.
 *
 * The heavy pdf.js library is only loaded on demand the first time a PDF is
 * actually rendered, so normal article page loads are unaffected. If pdf.js
 * cannot be loaded, or the document cannot be fetched (e.g. a cross-origin file
 * without CORS), callers are expected to fall back to the server-rasterized
 * page thumbnail.
 *
 * @module viewer/PdfRenderer
 */
( function () {
	'use strict';

	/**
	 * Path (relative to $wgExtensionAssetsPath) of the vendored pdf.js library.
	 *
	 * Deliberately fetched as a plain static script rather than through a
	 * ResourceLoader module. ResourceLoader pipes module content through
	 * Wikimedia\Minify\JavaScriptMinifier, which is token-based rather than a
	 * real parser and silently corrupts this bundle: it loses string-boundary
	 * sync partway through (turning `getContext("2d")` into `getContext("2 d")`)
	 * and truncates the remainder, so load.php serves a script that dies with
	 * "Uncaught SyntaxError: Invalid or unexpected token". Because the module
	 * script never executes, mw.loader.using() stays pending forever instead of
	 * rejecting, and the viewer has nothing to fall back from.
	 * @constant {string}
	 */
	const LIBRARY_PATH = 'Layers/resources/lib/pdfjs/pdf.min.js';

	/**
	 * Path (relative to $wgExtensionAssetsPath) of the vendored pdf.js worker.
	 * Referenced by URL so pdf.js can spawn its background worker; pdf.js falls
	 * back to main-thread rendering automatically if the worker cannot start
	 * (e.g. a strict Content-Security-Policy).
	 * @constant {string}
	 */
	const WORKER_PATH = 'Layers/resources/lib/pdfjs/pdf.worker.min.js';

	/**
	 * Vendored pdf.js version, appended to asset URLs as a cache buster. Static
	 * extension assets are not versioned by ResourceLoader, so without this a
	 * re-vendored library would be shadowed by the browser's cached copy.
	 * Kept in sync with the `pdfjs-dist` devDependency by tests/jest/pdfjsBundle.test.js.
	 * @constant {string}
	 */
	const PDFJS_VERSION = '4.10.38';

	/**
	 * Default rendered width (CSS px) for a page raster. Chosen to stay crisp at
	 * moderate zoom levels without producing an excessively large canvas.
	 * @constant {number}
	 */
	const DEFAULT_TARGET_WIDTH = 1600;

	/**
	 * Maximum number of PDF document proxies held open at once. Each proxy pins
	 * the parsed document plus its worker-side buffers, so an unbounded cache in
	 * a long-lived viewer session (a gallery of many PDFs, or repeated lightbox
	 * opens) grows without limit until the tab is closed. Least-recently-used
	 * entries beyond this are destroyed.
	 * @constant {number}
	 */
	const MAX_CACHED_DOCUMENTS = 8;

	/**
	 * Cap on the pixel count of any single image pdf.js will decode from a PDF.
	 * Viewer PDFs are user-uploaded and untrusted; without this a document
	 * declaring an enormous embedded image can exhaust memory before any of our
	 * own dimension checks run. 64 megapixels comfortably exceeds any legitimate
	 * page raster at DEFAULT_TARGET_WIDTH.
	 * @constant {number}
	 */
	const MAX_DECODED_IMAGE_PIXELS = 64 * 1024 * 1024;

	/**
	 * Hard cap on the largest side of a rendered page, to bound memory use for
	 * very large pages.
	 * @constant {number}
	 */
	const DEFAULT_MAX_DIMENSION = 4000;

	/**
	 * How long to wait for pdf.js to load before giving up (ms).
	 * @constant {number}
	 */
	const LIBRARY_TIMEOUT_MS = 15000;

	/**
	 * How long to wait for a page render before giving up (ms).
	 *
	 * pdf.js puts no timeout on its worker handshake: if the worker script fails
	 * to start in a way that never reaches `onerror` (a strict CSP, a proxy
	 * serving the module with the wrong MIME type, a stalled fetch of the PDF
	 * itself), `getDocument().promise` stays pending forever rather than
	 * rejecting. Callers treat rejection as "fall back to the server-rasterized
	 * thumbnail", but a promise that never settles gives them nothing to fall
	 * back from — the viewer just spins. Bounding the wait converts that stall
	 * into the ordinary fallback path.
	 * @constant {number}
	 */
	const RENDER_TIMEOUT_MS = 30000;

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
		 * library nor a DOM to inject the script into is present.
		 *
		 * @return {boolean} True if rendering may be attempted.
		 */
		isAvailable() {
			if ( this._pdfjsLib || this._loadLibrary ) {
				return true;
			}
			return typeof document !== 'undefined' &&
				typeof document.createElement === 'function';
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
			const loader = this._loadLibrary || ( () => this._loadViaScriptTag() );
			this._libPromise = this._withTimeout(
				Promise.resolve().then( loader ),
				'pdf.js failed to load within ' + LIBRARY_TIMEOUT_MS + 'ms',
				LIBRARY_TIMEOUT_MS
			).then( ( lib ) => {
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
		 * Reject with `message` if `promise` has not settled within `timeoutMs`.
		 *
		 * @param {Promise} promise Promise to bound.
		 * @param {string} message Rejection message on timeout.
		 * @param {number} timeoutMs Timeout in milliseconds.
		 * @return {Promise} Settles with `promise`, or rejects on timeout.
		 * @private
		 */
		_withTimeout( promise, message, timeoutMs ) {
			let timer = null;
			const expiry = new Promise( ( resolve, reject ) => {
				timer = setTimeout( () => {
					reject( new Error( message ) );
				}, timeoutMs );
			} );
			const clear = () => {
				if ( timer !== null ) {
					clearTimeout( timer );
					timer = null;
				}
			};
			return Promise.race( [ promise, expiry ] ).then( ( value ) => {
				clear();
				return value;
			}, ( err ) => {
				clear();
				throw err;
			} );
		}

		/**
		 * Load pdf.js by injecting a plain script tag for the vendored bundle.
		 *
		 * The promise is held on the class rather than the instance so that
		 * several PdfRenderers (the lightbox and an inline viewer, say) share one
		 * download instead of racing to append duplicate script tags.
		 *
		 * @return {Promise<Object>} Resolves to the pdf.js library.
		 * @private
		 */
		_loadViaScriptTag() {
			if ( typeof window !== 'undefined' && window.pdfjsLib ) {
				return Promise.resolve( window.pdfjsLib );
			}
			if ( typeof document === 'undefined' ||
				typeof document.createElement !== 'function' ) {
				return Promise.reject( new Error( 'DOM unavailable' ) );
			}
			if ( !PdfRenderer._scriptPromise ) {
				PdfRenderer._scriptPromise = new Promise( ( resolve, reject ) => {
					const script = document.createElement( 'script' );
					script.async = true;
					script.src = this._assetUrl( LIBRARY_PATH );
					script.onload = () => {
						resolve( ( typeof window !== 'undefined' && window.pdfjsLib ) || null );
					};
					script.onerror = () => {
						// Allow a later attempt to retry a transient network failure.
						PdfRenderer._scriptPromise = null;
						reject( new Error( 'Failed to load pdf.js from ' + script.src ) );
					};
					( document.head || document.documentElement ).appendChild( script );
				} );
			}
			return PdfRenderer._scriptPromise;
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
			return this._assetUrl( WORKER_PATH );
		}

		/**
		 * Build the absolute, cache-busted URL of a vendored static asset.
		 *
		 * @param {string} relPath Path relative to $wgExtensionAssetsPath.
		 * @return {string} Asset URL.
		 * @private
		 */
		_assetUrl( relPath ) {
			let base = '';
			if ( typeof mw !== 'undefined' && mw.config &&
				typeof mw.config.get === 'function' ) {
				base = mw.config.get( 'wgExtensionAssetsPath' ) || '';
			}
			if ( base && base.charAt( base.length - 1 ) !== '/' ) {
				base += '/';
			}
			return base + relPath + '?version=' + PDFJS_VERSION;
		}

		/**
		 * Load (and cache) a PDF document proxy for a URL.
		 *
		 * @param {string} url URL of the PDF file.
		 * @return {Promise<Object>} Resolves to a pdf.js PDFDocumentProxy.
		 */
		getDocument( url ) {
			if ( this._docCache.has( url ) ) {
				// Refresh LRU position: Map preserves insertion order, so deleting
				// and re-setting moves this entry to the most-recent end.
				const cached = this._docCache.get( url );
				this._docCache.delete( url );
				this._docCache.set( url, cached );
				return cached;
			}
			const promise = this.ensureLibrary().then( ( lib ) => {
				// isEvalSupported:false keeps pdf.js from compiling font programs
				// with `Function`. The vendored build (4.10.38) is past
				// CVE-2024-4367, but viewer PDFs are user-uploaded and untrusted,
				// so the eval path stays off as defence in depth and to keep the
				// viewer usable under a script-src CSP without 'unsafe-eval'.
				const task = lib.getDocument( {
					url: url,
					isEvalSupported: false,
					maxImageSize: MAX_DECODED_IMAGE_PIXELS
				} );
				return task.promise;
			} ).catch( ( err ) => {
				this._docCache.delete( url );
				throw err;
			} );
			this._docCache.set( url, promise );
			this._evictOldestDocuments();
			return promise;
		}

		/**
		 * Destroy least-recently-used documents beyond MAX_CACHED_DOCUMENTS.
		 *
		 * @private
		 */
		_evictOldestDocuments() {
			while ( this._docCache.size > MAX_CACHED_DOCUMENTS ) {
				const oldestUrl = this._docCache.keys().next().value;
				const evicted = this._docCache.get( oldestUrl );
				this._docCache.delete( oldestUrl );
				this.constructor.destroyDocument( evicted );
			}
		}

		/**
		 * Release a cached document promise's pdf.js resources.
		 *
		 * @param {Promise<Object>} promise Cached document promise.
		 * @private
		 */
		static destroyDocument( promise ) {
			Promise.resolve( promise ).then( ( doc ) => {
				if ( doc && typeof doc.destroy === 'function' ) {
					try {
						doc.destroy();
					} catch ( e ) {
						// Non-fatal.
					}
				}
			} ).catch( () => {} );
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
			const timeoutMs = options.timeoutMs > 0 ?
				options.timeoutMs : RENDER_TIMEOUT_MS;

			const work = this.getDocument( url ).then( ( doc ) => {
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

			return this._withTimeout(
				work,
				'pdf.js render timed out after ' + timeoutMs + 'ms',
				timeoutMs
			).catch( ( err ) => {
				// On timeout the cached document promise is still pending, so a
				// retry would queue behind the same stall. getDocument() only
				// self-evicts on rejection, so drop it here too.
				this._docCache.delete( url );
				this.debugLog( 'renderPage failed:', err && err.message );
				throw err;
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
				this.constructor.destroyDocument( promise );
			} );
			this._docCache.clear();
		}
	}

	// Shared across instances so the library is only downloaded once per page.
	PdfRenderer._scriptPromise = null;

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
