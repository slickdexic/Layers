/**
 * Layers Lightbox - Full-screen viewer with layer overlay
 *
 * Opens a modal lightbox showing the full-size image with layers rendered on top.
 * Triggered by images with layerslink=viewer|lightbox parameter.
 *
 * @module viewer/LayersLightbox
 */
( function () {
	'use strict';

	/**
	 * Breathing room, in CSS pixels, that fitToScreen() leaves between the image
	 * and the viewport edge, and between the image and the fixed toolbar. These
	 * mirror the offsets in LayersLightbox.css; keep them in step.
	 */
	const EDGE_MARGIN = 16;
	const TOOLBAR_GAP = 12;

	/**
	 * Whether a set reference names a specific layer set rather than a generic
	 * wikitext intent such as 'on'. Prefers the shared rules in
	 * ext.layers.shared/SetNameUtil.js and falls back to an equivalent local
	 * check. Set names are user-defined and nothing is reserved.
	 *
	 * @param {*} value Raw set reference
	 * @return {boolean}
	 */
	function isSpecificSetName( value ) {
		const util = window.Layers && window.Layers.SetNameUtil;
		if ( util && typeof util.isSpecificName === 'function' ) {
			return util.isSpecificName( value );
		}
		// Equivalent local rules, so a load-order surprise can never silently
		// drop a user-defined set name from a request.
		if ( typeof value !== 'string' ) {
			return false;
		}
		const normalized = value.trim().toLowerCase();
		return normalized !== '' && [
			'on', 'true', 'all', '1', 'off', 'none', 'false', '0'
		].indexOf( normalized ) === -1;
	}

	/**
	 * How long to wait for the composited page images to decode inside the print
	 * document before opening the print dialog anyway. Bounded so one image that
	 * never settles cannot strand the user on a dead Print button.
	 *
	 * @type {number}
	 */
	const IMAGE_DECODE_TIMEOUT_MS = 5000;

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
	 * LayersLightbox class - Modal viewer for full-size layered images
	 */
	class LayersLightbox {
		/**
		 * Create a LayersLightbox instance
		 *
		 * @param {Object} options Configuration options
		 * @param {boolean} [options.debug=false] Enable debug logging
		 */
		constructor( options = {} ) {
			this.debug = options.debug || false;
			this.overlay = null;
			this.container = null;
			this.viewer = null;
			this.isOpen = false;
			this.boundKeyHandler = null;
			this.boundClickHandler = null;
			this.closeTimeoutId = null; // Track animation timeout for cleanup
		}

		/**
		 * Debug logging utility
		 *
		 * @param {...any} args Arguments to log
		 * @private
		 */
		debugLog( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log( '[LayersLightbox]', ...args );
			}
		}

		/**
		 * Get localized message
		 *
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Localized message
		 * @private
		 */
		getMessage( key, fallback ) {
			if ( typeof mw !== 'undefined' && mw.message ) {
				const msg = mw.message( key );
				if ( msg.exists() ) {
					return msg.text();
				}
			}
			return fallback;
		}

		/**
		 * Open the lightbox with a specific image and layers
		 *
		 * @param {Object} config Configuration for what to show
		 * @param {string} config.filename The filename to load
		 * @param {string} [config.setName] Optional layer set name
		 * @param {string} [config.imageUrl] Full-size image URL (if known)
		 * @param {Object} [config.layerData] Pre-loaded layer data (if available)
		 * @param {boolean} [config.isSlide] True when `filename` names a slide
		 *   rather than an uploaded file. Slides have no `File:` page, so neither
		 *   the layersinfo lookup nor the server PDF exporter can resolve them;
		 *   Print and Download must work purely from the supplied layer data.
		 */
		open( config ) {
			// Cancel any pending close animation timeout to prevent it from
			// destroying the overlay we're about to create (P3-111 race fix)
			if ( this.closeTimeoutId ) {
				clearTimeout( this.closeTimeoutId );
				this.closeTimeoutId = null;
			}

			if ( this.isOpen || ( this.overlay && this.overlay.parentNode ) ) {
				// Force synchronous close to prevent duplicate overlays
				this.close( true );
			}

			this.debugLog( 'Opening lightbox for:', config.filename );

			// Track viewing context so multi-page (PDF) navigation can reload
			// the correct page image + that page's layer set.
			this.filename = config.filename;
			this.setName = config.setName || null;
			this.currentPage = parseInt( config.page, 10 ) > 1 ? parseInt( config.page, 10 ) : 1;
			this.pageCount = 1;
			this.isSlide = config.isSlide === true;

			// Keep whatever the caller already resolved. Print and Download
			// composite from this instead of re-fetching, which is what makes them
			// work for slides — and, for anything else, guarantees the exported
			// pages match what is on screen.
			this.presetImageUrl = config.imageUrl || null;
			this.presetLayerData = config.layerData || null;

			// Whether this file is a PDF. Client-side pdf.js rendering (crisp,
			// native, in-wiki) is only attempted for PDFs; all other files use
			// the server-provided page image.
			this.isPdf = /\.pdf$/i.test( String( config.filename || '' ) );
			// Rebuild the pdf.js renderer (and its per-document cache) for this
			// open() so switching files does not reuse a stale document.
			this._pdfRendererResolved = false;

			// Reset zoom/pan for a fresh view.
			this.zoom = 1;
			this.panX = 0;
			this.panY = 0;

			// Create overlay structure
			this.createOverlay();

			// Hide paging until the server reports the real page count.
			this.updateToolbar();

			// Show loading state
			this.showLoading();

			// If we have layer data, render immediately
			if ( config.layerData && config.imageUrl ) {
				this.renderViewer( config.imageUrl, config.layerData );
			} else {
				// Fetch via API
				this.fetchAndRender( config.filename, config.setName, this.currentPage );
			}

			this.isOpen = true;
		}

		/**
		 * Create the lightbox overlay structure
		 * @private
		 */
		createOverlay() {
			// Create overlay container
			this.overlay = document.createElement( 'div' );
			this.overlay.className = 'layers-lightbox-overlay';
			this.overlay.setAttribute( 'role', 'dialog' );
			this.overlay.setAttribute( 'aria-modal', 'true' );
			this.overlay.setAttribute( 'aria-label', this.getMessage( 'layers-link-viewer-title', 'Layers Viewer' ) );

			// Create content container
			this.container = document.createElement( 'div' );
			this.container.className = 'layers-lightbox-container';

			// Create close button
			const closeBtn = document.createElement( 'button' );
			closeBtn.className = 'layers-lightbox-close';
			closeBtn.type = 'button';
			closeBtn.innerHTML = '&times;';
			closeBtn.setAttribute( 'aria-label', this.getMessage( 'layers-lightbox-close', 'Close' ) );
			closeBtn.title = this.getMessage( 'layers-lightbox-close-tooltip', 'Close viewer (Escape)' );

			// Create image wrapper (will hold img + canvas)
			this.imageWrapper = document.createElement( 'div' );
			this.imageWrapper.className = 'layers-lightbox-image-wrapper';

			// Create toolbar (page navigation for multi-page files + print).
			// Hidden until we know there is something to show (pageCount > 1
			// enables paging; the print button is always available once loaded).
			this.toolbar = document.createElement( 'div' );
			this.toolbar.className = 'layers-lightbox-toolbar';

			// --- Zoom controls (always available) ---
			this.zoomOutBtn = document.createElement( 'button' );
			this.zoomOutBtn.type = 'button';
			this.zoomOutBtn.className = 'layers-lightbox-zoom-out';
			this.zoomOutBtn.innerHTML = '&#8722;';
			this.zoomOutBtn.setAttribute( 'aria-label', this.getMessage( 'layers-zoom-out', 'Zoom out' ) );
			this.zoomOutBtn.title = this.getMessage( 'layers-zoom-out', 'Zoom out' );
			this.zoomOutBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.zoomBy( 1 / 1.25 );
			} );

			this.zoomIndicator = document.createElement( 'button' );
			this.zoomIndicator.type = 'button';
			this.zoomIndicator.className = 'layers-lightbox-zoom-indicator';
			this.zoomIndicator.title = this.getMessage( 'layers-zoom-reset', 'Reset zoom' );
			this.zoomIndicator.setAttribute( 'aria-label', this.getMessage( 'layers-zoom-reset', 'Reset zoom' ) );
			this.zoomIndicator.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.resetZoom();
			} );

			this.zoomInBtn = document.createElement( 'button' );
			this.zoomInBtn.type = 'button';
			this.zoomInBtn.className = 'layers-lightbox-zoom-in';
			this.zoomInBtn.innerHTML = '&#43;';
			this.zoomInBtn.setAttribute( 'aria-label', this.getMessage( 'layers-zoom-in', 'Zoom in' ) );
			this.zoomInBtn.title = this.getMessage( 'layers-zoom-in', 'Zoom in' );
			this.zoomInBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.zoomBy( 1.25 );
			} );

			this.fitBtn = document.createElement( 'button' );
			this.fitBtn.type = 'button';
			this.fitBtn.className = 'layers-lightbox-zoom-fit';
			this.fitBtn.textContent = this.getMessage( 'layers-lightbox-fit', 'Fit' );
			this.fitBtn.setAttribute( 'aria-label', this.getMessage( 'layers-zoom-fit', 'Fit to Window' ) );
			this.fitBtn.title = this.getMessage( 'layers-zoom-fit', 'Fit to Window' ) + ' (F)';
			this.fitBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.fitToScreen();
			} );

			const zoomSep = document.createElement( 'span' );
			zoomSep.className = 'layers-lightbox-toolbar-sep';

			this.prevBtn = document.createElement( 'button' );
			this.prevBtn.type = 'button';
			this.prevBtn.className = 'layers-lightbox-page-prev';
			this.prevBtn.innerHTML = '&#8249;';
			this.prevBtn.setAttribute( 'aria-label', this.getMessage( 'layers-page-prev', 'Previous page' ) );
			this.prevBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.goToPage( this.currentPage - 1 );
			} );

			this.pageIndicator = document.createElement( 'span' );
			this.pageIndicator.className = 'layers-lightbox-page-indicator';

			this.nextBtn = document.createElement( 'button' );
			this.nextBtn.type = 'button';
			this.nextBtn.className = 'layers-lightbox-page-next';
			this.nextBtn.innerHTML = '&#8250;';
			this.nextBtn.setAttribute( 'aria-label', this.getMessage( 'layers-page-next', 'Next page' ) );
			this.nextBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.goToPage( this.currentPage + 1 );
			} );

			this.printBtn = document.createElement( 'button' );
			this.printBtn.type = 'button';
			this.printBtn.className = 'layers-lightbox-print';
			this.printBtn.textContent = this.getMessage( 'layers-lightbox-print', 'Print' );
			this.printBtn.title = this.getMessage(
				'layers-lightbox-print-tooltip', 'Print the marked-up document'
			);
			this.printBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.printDocument();
			} );

			this.downloadBtn = document.createElement( 'button' );
			this.downloadBtn.type = 'button';
			this.downloadBtn.className = 'layers-lightbox-download';
			this.downloadBtn.textContent = this.getMessage(
				'layers-lightbox-download', 'Download'
			);
			this.downloadBtn.title = this.getMessage(
				'layers-lightbox-download-tooltip',
				'Download the marked-up document as a PDF'
			);
			this.downloadBtn.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.downloadPdf();
			} );

			this.toolbar.appendChild( this.zoomOutBtn );
			this.toolbar.appendChild( this.zoomIndicator );
			this.toolbar.appendChild( this.zoomInBtn );
			this.toolbar.appendChild( this.fitBtn );
			this.toolbar.appendChild( zoomSep );
			this.toolbar.appendChild( this.prevBtn );
			this.toolbar.appendChild( this.pageIndicator );
			this.toolbar.appendChild( this.nextBtn );
			this.toolbar.appendChild( this.printBtn );
			this.toolbar.appendChild( this.downloadBtn );

			// The toolbar and close button are viewport chrome, not part of the
			// image stage: they are siblings of the container, not children of it.
			// While they lived inside the container they were positioned against the
			// *unzoomed* image box, so zooming - which is a CSS transform and does
			// not change layout size - left them stranded over or away from an image
			// that had visibly grown past them.
			this.container.appendChild( this.imageWrapper );
			this.overlay.appendChild( this.container );
			this.overlay.appendChild( this.toolbar );
			this.overlay.appendChild( closeBtn );
			document.body.appendChild( this.overlay );

			// Add event listeners
			this.boundKeyHandler = ( e ) => this.handleKeyDown( e );
			this.boundClickHandler = ( e ) => this.handleClick( e );

			document.addEventListener( 'keydown', this.boundKeyHandler );
			this.overlay.addEventListener( 'click', this.boundClickHandler );
			closeBtn.addEventListener( 'click', () => this.close() );

			// Zoom + pan interaction. The wheel listens on the whole overlay, not
			// just the image: in a full-screen viewer the dark surround is part of
			// the canvas as far as the user is concerned, and a wheel that only
			// worked while the pointer happened to be over the picture felt broken.
			this.boundWheelHandler = ( e ) => this.handleWheel( e );
			this.boundPanStart = ( e ) => this.startPan( e );
			this.boundPanMove = ( e ) => this.movePan( e );
			this.boundPanEnd = () => this.endPan();
			this.overlay.addEventListener( 'wheel', this.boundWheelHandler, { passive: false } );
			this.imageWrapper.addEventListener( 'mousedown', this.boundPanStart );
			document.addEventListener( 'mousemove', this.boundPanMove );
			document.addEventListener( 'mouseup', this.boundPanEnd );

			// Prevent body scroll
			document.body.style.overflow = 'hidden';

			// Reflect the initial (unzoomed) transform + indicator.
			this.applyTransform();

			// Force reflow and add visible class for animation
			this.overlay.offsetHeight;
			this.overlay.classList.add( 'layers-lightbox-visible' );
		}

		/**
		 * Show loading indicator
		 * @private
		 */
		showLoading() {
			if ( !this.imageWrapper ) {
				return;
			}
			this.imageWrapper.innerHTML = '';
			const loading = document.createElement( 'div' );
			loading.className = 'layers-lightbox-loading';
			loading.textContent = this.getMessage( 'layers-lightbox-loading', 'Loading layers...' );
			this.imageWrapper.appendChild( loading );
		}

		/**
		 * Fetch layer data via API and render
		 *
		 * @param {string} filename The filename to fetch
		 * @param {string} [setName] Optional layer set name
		 * @private
		 */
		fetchAndRender( filename, setName, page ) {
			if ( typeof mw === 'undefined' || !mw.Api ) {
				this.showError( 'API not available' );
				return;
			}

			const api = new mw.Api();
			const requestedPage = parseInt( page, 10 ) > 1 ? parseInt( page, 10 ) : 1;
			const params = {
				action: 'layersinfo',
				filename: filename,
				format: 'json'
			};

			if ( isSpecificSetName( setName ) ) {
				params.setname = setName;
			}
			if ( requestedPage > 1 ) {
				params.page = requestedPage;
			}

			return api.get( params ).then( ( data ) => {
				if ( !data || !data.layersinfo ) {
					this.showError( 'No layer data found' );
					return undefined;
				}

				const layersInfo = data.layersinfo;

				// Track multi-page context reported by the server so the paging
				// controls know the total page count and which page we are on.
				this.pageCount = parseInt( layersInfo.pageCount, 10 ) || 1;
				this.currentPage = parseInt( layersInfo.page, 10 ) || requestedPage;

				// Prefer the server-provided, page-aware image URL. For PDFs and
				// other non-web formats this is a rasterized page thumbnail; the
				// raw file URL cannot be shown in an <img>.
				const imageUrl = layersInfo.imageUrl || this.resolveFullImageUrl( filename );

				// No layer set yet — show the page image without an overlay.
				if ( !layersInfo.layerset ) {
					return this.renderPageImage( filename, imageUrl, {
						layers: [],
						baseWidth: null,
						baseHeight: null,
						backgroundVisible: true,
						backgroundOpacity: 1.0
					} );
				}

				// Extract layer data
				const layerSet = layersInfo.layerset;
				const layerData = {
					layers: [],
					baseWidth: layerSet.baseWidth || null,
					baseHeight: layerSet.baseHeight || null,
					backgroundVisible: true,
					backgroundOpacity: 1.0
				};

				if ( layerSet.data ) {
					if ( Array.isArray( layerSet.data ) ) {
						layerData.layers = layerSet.data;
					} else if ( layerSet.data.layers ) {
						layerData.layers = layerSet.data.layers;
						layerData.backgroundVisible = layerSet.data.backgroundVisible !== false &&
							layerSet.data.backgroundVisible !== 0;
						layerData.backgroundOpacity = layerSet.data.backgroundOpacity !== undefined
							? layerSet.data.backgroundOpacity : 1.0;
					}
				}

				return this.renderPageImage( filename, imageUrl, layerData );

			} ).catch( ( error ) => {
				this.debugLog( 'API error:', error );
				this.showError( 'Failed to load layer data' );
			} );
		}

		/**
		 * Render a page's background image + layer overlay. For PDFs this first
		 * attempts a crisp client-side pdf.js render of the page and uses that as
		 * the background; on any failure it falls back to the supplied
		 * server-rasterized page image. Non-PDF files always use the server image.
		 *
		 * @param {string} filename The filename being viewed
		 * @param {string} fallbackUrl Server-provided page image URL
		 * @param {Object} layerData Layer data for the page
		 * @private
		 */
		renderPageImage( filename, fallbackUrl, layerData ) {
			return this.preparePageImageUrl( filename, this.currentPage, fallbackUrl )
				.then( ( finalUrl ) => {
					this.renderViewer( finalUrl, layerData );
					this.updateToolbar();
				} );
		}

		/**
		 * Resolve the background image URL to display for a page. For PDFs this
		 * renders the page with pdf.js and returns a data URL; otherwise (or on
		 * failure) it returns the server-provided fallback URL.
		 *
		 * @param {string} filename The filename being viewed
		 * @param {number} page 1-based page number
		 * @param {string} fallbackUrl Server-provided page image URL
		 * @return {Promise<string>} Resolves to the image URL to display
		 * @private
		 */
		preparePageImageUrl( filename, page, fallbackUrl ) {
			const renderer = this._getPdfRenderer();
			if ( !this.isPdf || !renderer || !renderer.isAvailable() ) {
				return Promise.resolve( fallbackUrl );
			}
			const pdfUrl = this.resolvePdfSourceUrl( filename );
			return renderer.renderPage( pdfUrl, page, {} ).then( ( result ) => {
				if ( result && result.dataUrl ) {
					// pdf.js reports the authoritative page count.
					if ( result.pageCount > this.pageCount ) {
						this.pageCount = result.pageCount;
					}
					return result.dataUrl;
				}
				return fallbackUrl;
			} ).catch( ( err ) => {
				// Warn unconditionally: the reader still gets the page, but a
				// silent downgrade to the server raster is worth surfacing.
				if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
					mw.log.warn(
						'[Layers] pdf.js render failed, using server image: ' +
						( err && err.message )
					);
				}
				return fallbackUrl;
			} );
		}

		/**
		 * Resolve the URL of the raw PDF file for pdf.js to fetch.
		 *
		 * @param {string} filename The filename
		 * @return {string} URL of the PDF file
		 * @private
		 */
		resolvePdfSourceUrl( filename ) {
			// Special:Redirect/file resolves to the raw uploaded PDF regardless
			// of hashed-path or InstantCommons configuration; pdf.js follows the
			// redirect when fetching.
			return this.resolveFullImageUrl( filename );
		}

		/**
		 * Lazily construct the shared pdf.js renderer for this lightbox session.
		 *
		 * @return {Object|null} A PdfRenderer instance, or null if unavailable
		 * @private
		 */
		_getPdfRenderer() {
			if ( !this._pdfRendererResolved ) {
				this._pdfRendererResolved = true;
				const PdfRenderer = getClass( 'Viewer.PdfRenderer', 'LayersPdfRenderer' );
				this.pdfRenderer = ( typeof PdfRenderer === 'function' ) ?
					new PdfRenderer( { debug: this.debug } ) : null;
			}
			return this.pdfRenderer;
		}

		/**
		 * Navigate to a specific page of a multi-page file and reload its image
		 * and page-scoped layer set.
		 *
		 * @param {number} targetPage 1-based page number
		 * @private
		 */
		goToPage( targetPage ) {
			const p = parseInt( targetPage, 10 );
			if ( !p || p < 1 || p > this.pageCount || p === this.currentPage ) {
				return;
			}
			this.currentPage = p;
			// A new page is a fresh view: reset zoom/pan.
			this.resetZoom();
			this.showLoading();
			this.fetchAndRender( this.filename, this.setName, p );
		}

		/**
		 * Update the toolbar (page indicator + prev/next enabled state). Paging
		 * controls are only shown for multi-page files.
		 *
		 * @private
		 */
		updateToolbar() {
			if ( !this.toolbar ) {
				return;
			}
			const multiPage = this.pageCount > 1;
			this.prevBtn.style.display = multiPage ? '' : 'none';
			this.nextBtn.style.display = multiPage ? '' : 'none';
			this.pageIndicator.style.display = multiPage ? '' : 'none';
			if ( multiPage ) {
				this.pageIndicator.textContent = this.getMessage( 'layers-page-indicator', 'Page $1 / $2' )
					.replace( '$1', String( this.currentPage ) )
					.replace( '$2', String( this.pageCount ) );
				this.prevBtn.disabled = this.currentPage <= 1;
				this.nextBtn.disabled = this.currentPage >= this.pageCount;
			}
		}

		/**
		 * Minimum and maximum zoom factors for the full-screen viewer.
		 *
		 * @return {Object} { min, max }
		 * @private
		 */
		getZoomLimits() {
			return { min: 0.25, max: 8 };
		}

		/**
		 * Apply the current zoom + pan as a CSS transform on the image stage.
		 * Both the background image and the layer canvas live inside the wrapper,
		 * so a single transform scales them together and keeps them aligned.
		 *
		 * @private
		 */
		applyTransform() {
			if ( !this.imageWrapper ) {
				return;
			}
			const z = this.zoom || 1;
			const px = this.panX || 0;
			const py = this.panY || 0;
			this.imageWrapper.style.transformOrigin = 'center center';
			this.imageWrapper.style.transform =
				'translate(' + px + 'px, ' + py + 'px) scale(' + z + ')';
			this.imageWrapper.style.cursor = z > 1 ? 'grab' : '';
			this.updateZoomIndicator();
		}

		/**
		 * Update the zoom percentage label in the toolbar.
		 *
		 * @private
		 */
		updateZoomIndicator() {
			if ( this.zoomIndicator ) {
				this.zoomIndicator.textContent = Math.round( ( this.zoom || 1 ) * 100 ) + '%';
			}
		}

		/**
		 * Set an absolute zoom factor (clamped) and re-render the transform.
		 *
		 * @param {number} z Target zoom factor
		 * @private
		 */
		setZoom( z ) {
			const limits = this.getZoomLimits();
			this.zoom = Math.min( limits.max, Math.max( limits.min, z ) );
			if ( this.zoom === 1 ) {
				this.panX = 0;
				this.panY = 0;
			}
			this.applyTransform();
		}

		/**
		 * Multiply the current zoom by a factor (used by +/- buttons and wheel).
		 *
		 * @param {number} factor Multiplier ( >1 zooms in, <1 zooms out )
		 * @private
		 */
		zoomBy( factor ) {
			this.setZoom( ( this.zoom || 1 ) * factor );
		}

		/**
		 * Reset zoom to 100% and clear any pan offset.
		 *
		 * @private
		 */
		resetZoom() {
			this.zoom = 1;
			this.panX = 0;
			this.panY = 0;
			this.applyTransform();
		}

		/**
		 * Scale the image so it fills as much of the viewer as it can without
		 * being cropped, and re-centre it.
		 *
		 * This is not the same as resetting to 100%. The stage is capped by CSS at
		 * a fraction of the viewport, so a large image at zoom 1 is already
		 * letterboxed, but a small one sits at its natural size surrounded by dead
		 * space - fit scales that one up. Space taken by the fixed toolbar is
		 * measured rather than assumed, so the image never ends up underneath it.
		 *
		 * @private
		 */
		fitToScreen() {
			if ( !this.imageWrapper || !this.overlay ) {
				return;
			}
			// offsetWidth/Height are layout values, so they report the unscaled box
			// regardless of the transform currently applied.
			const naturalW = this.imageWrapper.offsetWidth;
			const naturalH = this.imageWrapper.offsetHeight;
			if ( !naturalW || !naturalH ) {
				return;
			}

			const chrome = this.toolbar ? this.toolbar.offsetHeight + TOOLBAR_GAP : 0;
			const availW = this.overlay.clientWidth - EDGE_MARGIN * 2;
			const availH = this.overlay.clientHeight - chrome * 2 - EDGE_MARGIN * 2;
			if ( availW <= 0 || availH <= 0 ) {
				return;
			}

			this.panX = 0;
			this.panY = 0;
			this.setZoom( Math.min( availW / naturalW, availH / naturalH ) );
		}

		/**
		 * Handle mouse-wheel zoom over the image stage.
		 *
		 * @param {WheelEvent} e Wheel event
		 * @private
		 */
		handleWheel( e ) {
			e.preventDefault();
			this.zoomBy( e.deltaY < 0 ? 1.1 : 1 / 1.1 );
		}

		/**
		 * Begin a drag-to-pan gesture (only meaningful when zoomed in).
		 *
		 * @param {MouseEvent} e Mouse event
		 * @private
		 */
		startPan( e ) {
			if ( ( this.zoom || 1 ) <= 1 ) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			this.isPanning = true;
			this.panStartX = e.clientX;
			this.panStartY = e.clientY;
			this.panOriginX = this.panX || 0;
			this.panOriginY = this.panY || 0;
			if ( this.imageWrapper ) {
				this.imageWrapper.style.cursor = 'grabbing';
			}
		}

		/**
		 * Update pan offset while dragging.
		 *
		 * @param {MouseEvent} e Mouse event
		 * @private
		 */
		movePan( e ) {
			if ( !this.isPanning ) {
				return;
			}
			this.panX = this.panOriginX + ( e.clientX - this.panStartX );
			this.panY = this.panOriginY + ( e.clientY - this.panStartY );
			this.applyTransform();
		}

		/**
		 * End a drag-to-pan gesture.
		 *
		 * @private
		 */
		endPan() {
			if ( !this.isPanning ) {
				return;
			}
			this.isPanning = false;
			if ( this.imageWrapper ) {
				this.imageWrapper.style.cursor = ( this.zoom || 1 ) > 1 ? 'grab' : '';
			}
		}

		/**
		 * Print the full marked-up document.
		 *
		 * Every page is composited client-side (background raster + layer overlay
		 * flattened onto one canvas via the shared renderer, so all layer types
		 * render correctly) and printed from a self-contained hidden document.
		 *
		 * Printing a purpose-built document rather than the wiki page is what
		 * keeps the output clean: browsers draw their URL/date/"page x of y"
		 * furniture in the page margin box, so only a document that can declare
		 * `@page { margin: 0 }` can suppress them — and this stylesheet cannot
		 * declare that globally without also zeroing the margins of every normal
		 * article print. If client-side compositing is not possible (e.g. a
		 * cross-origin, tainted canvas) it falls back to the server-side PDF.
		 *
		 * @return {Promise|undefined} Resolves once printing has been triggered.
		 * @private
		 */
		printDocument() {
			if ( !this.filename ) {
				return;
			}
			const btn = this.printBtn;
			const original = btn ? btn.textContent : '';
			const restore = () => {
				if ( btn ) {
					btn.disabled = false;
					btn.textContent = original;
				}
			};
			if ( btn ) {
				btn.disabled = true;
				btn.textContent = this.getMessage(
					'layers-lightbox-print-preparing', 'Preparing pages…'
				);
			}

			const pageCount = Math.max( 1, parseInt( this.pageCount, 10 ) || 1 );
			const tasks = [];
			for ( let p = 1; p <= pageCount; p++ ) {
				tasks.push( this.composePageDataUrl( p ) );
			}

			return Promise.all( tasks ).then( ( images ) => {
				const valid = images.filter( ( src ) => !!src );
				restore();
				if ( valid.length === 0 ) {
					return this.printViaServer();
				}
				this.printImages( valid );
			} ).catch( () => {
				restore();
				return this.printViaServer();
			} );
		}

		/**
		 * Download the full marked-up document as a PDF.
		 *
		 * The pages are composited client-side and wrapped in a PDF here rather
		 * than taken from the server export, so that Download and Print produce
		 * the same output. The server draws layers with ImageMagick primitives
		 * and silently omits every layer type without one — custom shapes, emoji,
		 * image layers, gradients, rich text — so its PDF can be missing exactly
		 * the annotations the user came for. It remains the fallback for when
		 * client-side compositing is impossible (e.g. a tainted canvas).
		 *
		 * @return {Promise|undefined} Resolves once the download has started.
		 * @private
		 */
		downloadPdf() {
			if ( !this.filename ) {
				return;
			}
			const btn = this.downloadBtn;
			const original = btn ? btn.textContent : '';
			const restore = () => {
				if ( btn ) {
					btn.disabled = false;
					btn.textContent = original;
				}
			};
			if ( btn ) {
				btn.disabled = true;
				btn.textContent = this.getMessage(
					'layers-lightbox-print-preparing', 'Preparing pages…'
				);
			}

			const pageCount = Math.max( 1, parseInt( this.pageCount, 10 ) || 1 );
			const tasks = [];
			for ( let p = 1; p <= pageCount; p++ ) {
				// JPEG because PDF can embed it verbatim via /DCTDecode; PNG would
				// need a deflate pass that not every supported browser can do.
				tasks.push( this.composePage( p, 'image/jpeg', 0.92 ) );
			}

			return Promise.all( tasks ).then( ( composited ) => {
				restore();
				const blob = this.buildPdfBlob( composited );
				if ( !blob ) {
					return this.downloadViaServer();
				}
				this.saveBlob( blob, this.exportFileName() );
			} ).catch( () => {
				restore();
				return this.downloadViaServer();
			} );
		}

		/**
		 * Wrap composited pages in a PDF.
		 *
		 * @param {Array<Object|null>} composited Results from composePage
		 * @return {Blob|null} PDF blob, or null if no page could be encoded
		 * @private
		 */
		buildPdfBlob( composited ) {
			const PdfBuilder = getClass( 'Viewer.PdfBuilder', 'LayersPdfBuilder' );
			if ( typeof PdfBuilder !== 'function' ) {
				return null;
			}
			const pages = [];
			composited.forEach( ( entry ) => {
				if ( !entry ) {
					return;
				}
				const data = PdfBuilder.decodeJpegDataUrl( entry.src );
				if ( data ) {
					pages.push( { data: data, width: entry.width, height: entry.height } );
				}
			} );
			return pages.length ? PdfBuilder.build( pages ) : null;
		}

		/**
		 * Save a blob to disk under a given name.
		 *
		 * @param {Blob} blob Blob to save
		 * @param {string} name Suggested file name
		 * @private
		 */
		saveBlob( blob, name ) {
			const url = URL.createObjectURL( blob );
			const link = document.createElement( 'a' );
			link.href = url;
			link.download = name;
			link.style.display = 'none';
			document.body.appendChild( link );
			link.click();
			if ( link.parentNode ) {
				link.parentNode.removeChild( link );
			}
			// Revoking immediately can cancel the download in some browsers.
			setTimeout( () => URL.revokeObjectURL( url ), 60000 );
		}

		/**
		 * Suggested name for the downloaded PDF, derived from the source file.
		 *
		 * @return {string} File name ending in .pdf
		 * @private
		 */
		exportFileName() {
			const base = String( this.filename || 'export' )
				.replace( /\.[^.]+$/, '' )
				.replace( /[\\/:*?"<>|]/g, '_' );
			return ( base || 'export' ) + '.pdf';
		}

		/**
		 * Fallback download path: save the server-generated PDF. `download=1`
		 * makes Special:LayersExport send `Content-Disposition: attachment`.
		 *
		 * @return {Promise|undefined} Resolves once the export has been handled
		 * @private
		 */
		downloadViaServer() {
			return this.requestServerPdf( this.downloadBtn, ( url ) => {
				this.triggerDownload( url );
			} );
		}

		/**
		 * Render a single page as a flattened composite image (background raster
		 * with its layer set drawn on top) and return it as a PNG data URL.
		 *
		 * @param {number} page 1-based page number
		 * @return {Promise<string|null>} Data URL, or null if the page cannot be
		 *   composited client-side.
		 * @private
		 */
		composePageDataUrl( page ) {
			return this.composePage( page ).then(
				( result ) => ( result ? result.src : null )
			);
		}

		/**
		 * Render a single page as a flattened composite image.
		 *
		 * @param {number} page 1-based page number
		 * @param {string} [type='image/png'] Canvas encoding MIME type
		 * @param {number} [quality] Encoder quality for lossy types
		 * @return {Promise<Object|null>} `{ src, width, height }`, or null if the
		 *   page cannot be composited client-side.
		 * @private
		 */
		composePage( page, type, quality ) {
			// Single-page sources opened with their layer data already in hand —
			// slides above all — are composited straight from it. A slide is
			// identified by name, not by a File: title, so asking layersinfo for
			// it would return nothing and every page would come back null.
			if ( page <= 1 && this.presetImageUrl && this.presetLayerData ) {
				return this.flattenPage(
					this.presetImageUrl, this.presetLayerData, type, quality
				);
			}
			if ( typeof mw === 'undefined' || !mw.Api ) {
				return Promise.resolve( null );
			}
			const api = new mw.Api();
			const params = {
				action: 'layersinfo',
				filename: this.filename,
				format: 'json'
			};
			if ( isSpecificSetName( this.setName ) ) {
				params.setname = this.setName;
			}
			if ( page > 1 ) {
				params.page = page;
			}

			return api.get( params ).then( ( data ) => {
				const info = data && data.layersinfo;
				if ( !info ) {
					return null;
				}
				const imageUrl = info.imageUrl || this.resolveFullImageUrl( this.filename );
				const layerData = {
					layers: [],
					baseWidth: info.baseWidth || null,
					baseHeight: info.baseHeight || null,
					backgroundVisible: true,
					backgroundOpacity: 1.0
				};
				const set = info.layerset;
				if ( set && set.data ) {
					if ( Array.isArray( set.data ) ) {
						layerData.layers = set.data;
					} else if ( set.data.layers ) {
						layerData.layers = set.data.layers;
						layerData.backgroundVisible = set.data.backgroundVisible !== false &&
							set.data.backgroundVisible !== 0;
						layerData.backgroundOpacity = set.data.backgroundOpacity !== undefined ?
							set.data.backgroundOpacity : 1.0;
					}
					if ( set.baseWidth ) {
						layerData.baseWidth = set.baseWidth;
					}
					if ( set.baseHeight ) {
						layerData.baseHeight = set.baseHeight;
					}
				}
				return this.flattenPage( imageUrl, layerData, type, quality );
			} ).catch( () => null );
		}

		/**
		 * Load a page image and flatten it together with its layers onto an
		 * offscreen canvas.
		 *
		 * @param {string} imageUrl Page background image URL (same-origin thumb)
		 * @param {Object} layerData Layer data for the page
		 * @param {string} [type='image/png'] Canvas encoding MIME type
		 * @param {number} [quality] Encoder quality for lossy types
		 * @return {Promise<Object|null>} `{ src, width, height }`, or null on failure
		 * @private
		 */
		flattenPage( imageUrl, layerData, type, quality ) {
			const LayersViewer = getClass( 'Viewer.LayersViewer', 'LayersViewer' ) ||
				( window.Layers && window.Layers.Viewer );
			if ( typeof LayersViewer !== 'function' ) {
				return Promise.resolve( null );
			}
			return new Promise( ( resolve ) => {
				const img = new Image();
				let settled = false;
				// A cross-origin image loaded without CORS taints the canvas, and a
				// tainted canvas makes toDataURL() throw — which used to send Print
				// and Download to the server exporter, and that silently omits seven
				// layer types. Ask for CORS first so the composite stays usable; if
				// the remote sends no CORS headers the load fails and we retry
				// without it, which is exactly the old behaviour.
				const crossOriginNeeded = !this.isSameOriginUrl( imageUrl );
				let corsAttempted = crossOriginNeeded;
				if ( crossOriginNeeded ) {
					img.crossOrigin = 'anonymous';
				}
				const done = ( result ) => {
					if ( settled ) {
						return;
					}
					settled = true;
					resolve( result );
				};
				img.onload = () => {
					// Hidden offscreen host so the viewer can build its canvas.
					const host = document.createElement( 'div' );
					host.style.position = 'absolute';
					host.style.left = '-99999px';
					host.style.top = '0';
					host.style.width = ( img.naturalWidth || 1 ) + 'px';
					host.style.height = ( img.naturalHeight || 1 ) + 'px';
					document.body.appendChild( host );
					let viewer = null;
					try {
						viewer = new LayersViewer( {
							container: host,
							imageElement: img,
							layerData: layerData
						} );
						// Wait for asynchronous layer images (SVG custom shapes,
						// image layers, emoji) to load and draw before capturing,
						// otherwise the composite would be missing that markup.
						viewer.renderFlattenedAsync().then( ( canvas ) => {
							let result = null;
							try {
								if ( canvas ) {
									result = {
										src: canvas.toDataURL( type || 'image/png', quality ),
										width: canvas.width,
										height: canvas.height
									};
								}
							} catch ( e ) {
								result = null;
							}
							if ( viewer && typeof viewer.destroy === 'function' ) {
								viewer.destroy();
							}
							if ( host.parentNode ) {
								host.parentNode.removeChild( host );
							}
							done( result );
						} );
					} catch ( e ) {
						if ( viewer && typeof viewer.destroy === 'function' ) {
							viewer.destroy();
						}
						if ( host.parentNode ) {
							host.parentNode.removeChild( host );
						}
						done( null );
					}
				};
				img.onerror = () => {
					if ( corsAttempted ) {
						corsAttempted = false;
						img.removeAttribute( 'crossorigin' );
						img.src = imageUrl;
						return;
					}
					done( null );
				};
				img.src = imageUrl;
			} );
		}

		/**
		 * Whether a URL resolves to this wiki's own origin.
		 *
		 * @param {string} url URL to test
		 * @return {boolean} True for same-origin or relative URLs
		 * @private
		 */
		isSameOriginUrl( url ) {
			try {
				return new URL( url, window.location.href ).origin === window.location.origin;
			} catch ( e ) {
				// Unparseable: treat as same-origin so we do not add a pointless CORS request.
				return true;
			}
		}

		/**
		 * Print the composited page images, one per printed sheet, from a hidden
		 * same-origin iframe. The iframe keeps the user in the lightbox — no new
		 * tab — and, because it is a document of our own, it can declare
		 * `@page { margin: 0 }`, which removes both the extra white border and the
		 * browser's own URL/date/"page x of y" furniture (that furniture is drawn
		 * inside the page margin box).
		 *
		 * @param {string[]} images Ordered page image data URLs
		 * @private
		 */
		printImages( images ) {
			this.destroyPrintFrame();

			const frame = document.createElement( 'iframe' );
			frame.className = 'layers-print-frame';
			frame.setAttribute( 'aria-hidden', 'true' );
			frame.setAttribute( 'title', 'print' );
			document.body.appendChild( frame );
			this.printFrame = frame;

			const win = frame.contentWindow;
			if ( !win ) {
				this.destroyPrintFrame();
				this.showExportError();
				return;
			}
			const doc = win.document;
			doc.open();
			doc.write( this.buildPrintHtml( images ) );
			doc.close();

			const triggerPrint = () => {
				try {
					win.focus();
					win.print();
				} catch ( e ) {
					// Printing is best-effort; a blocked dialog must not throw.
				}
				// The frame has to outlive the (modal, but asynchronous in some
				// browsers) print dialog, so tear it down on afterprint with a
				// generous timer as a backstop.
				const cleanup = () => this.destroyPrintFrame();
				if ( typeof win.addEventListener === 'function' ) {
					win.addEventListener( 'afterprint', cleanup );
				}
				setTimeout( cleanup, 60000 );
			};

			this.whenImagesReady( doc ).then( triggerPrint );
		}

		/**
		 * Resolve once every image in a document has finished decoding, so the
		 * print dialog never captures blank sheets. Bounded, so a single image
		 * that never settles cannot leave the user staring at a dead button.
		 *
		 * @param {Document} doc Document to wait on
		 * @return {Promise} Resolves when all images have settled or the wait
		 *   times out
		 * @private
		 */
		whenImagesReady( doc ) {
			const images = Array.prototype.slice.call( doc.images || [] );
			const settled = Promise.all( images.map( ( img ) => {
				if ( img.complete ) {
					return Promise.resolve();
				}
				return new Promise( ( resolve ) => {
					img.addEventListener( 'load', resolve );
					img.addEventListener( 'error', resolve );
				} );
			} ) );
			const deadline = new Promise( ( resolve ) => {
				setTimeout( resolve, IMAGE_DECODE_TIMEOUT_MS );
			} );
			return Promise.race( [ settled, deadline ] );
		}

		/**
		 * Build the standalone print document for a set of composited pages.
		 *
		 * @param {string[]} images Ordered page image data URLs
		 * @return {string} Complete HTML document
		 * @private
		 */
		buildPrintHtml( images ) {
			const title = this.getMessage( 'layers-lightbox-print', 'Print' ) +
				' – ' + this.filename;
			const parts = [
				'<!DOCTYPE html><html><head><meta charset="utf-8">',
				'<title>', this.escapeHtml( title ), '</title><style>',
				// Zero margins remove the default white border *and* the browser's
				// header/footer, which is painted in the margin box.
				'@page{size:auto;margin:0;}',
				'html,body{margin:0;padding:0;background:#fff;}',
				'.layers-print-page{page-break-after:always;break-after:page;',
				'break-inside:avoid;page-break-inside:avoid;}',
				'.layers-print-page:last-child{page-break-after:auto;break-after:auto;}',
				// Fill the page width edge-to-edge; height follows the aspect ratio.
				'.layers-print-page img{display:block;width:100%;height:auto;}',
				'</style></head><body>'
			];
			for ( let i = 0; i < images.length; i++ ) {
				parts.push(
					'<div class="layers-print-page"><img src="',
					this.escapeHtml( images[ i ] ), '" alt=""></div>'
				);
			}
			parts.push( '</body></html>' );
			return parts.join( '' );
		}

		/**
		 * Remove the hidden print iframe, if one is currently attached.
		 *
		 * @private
		 */
		destroyPrintFrame() {
			if ( this.printFrame && this.printFrame.parentNode ) {
				this.printFrame.parentNode.removeChild( this.printFrame );
			}
			this.printFrame = null;
		}

		/**
		 * Escape a string for safe insertion into the generated print document.
		 *
		 * @param {string} str Input string
		 * @return {string} Escaped string
		 * @private
		 */
		escapeHtml( str ) {
			return String( str ).replace( /[&<>"']/g, ( c ) => ( {
				'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
			} )[ c ] );
		}

		/**
		 * Generate the full annotated document as a PDF on the server and hand the
		 * resulting URL to a consumer. Shared by the Download button and by the
		 * Print fallback used when client-side compositing is impossible.
		 *
		 * @param {HTMLElement|null} btn Button to show progress on, if any
		 * @param {Function} onUrl Receives the export URL on success
		 * @return {Promise|undefined} Resolves once the export has been handled
		 * @private
		 */
		requestServerPdf( btn, onUrl ) {
			if ( this.isSlide ) {
				// A slide is only layer data; there is no uploaded file for the
				// server exporter to render, so there is no fallback to take.
				// Say so rather than leaving the button looking inert.
				this.showExportError();
				return;
			}
			if ( !this.filename || typeof mw === 'undefined' || !mw.Api ) {
				this.showExportError();
				return;
			}
			const original = btn ? btn.textContent : '';
			if ( btn ) {
				btn.disabled = true;
				btn.textContent = this.getMessage(
					'layers-lightbox-export-generating', 'Generating annotated PDF…'
				);
			}
			const restore = () => {
				if ( btn ) {
					btn.disabled = false;
					btn.textContent = original;
				}
			};
			const params = {
				action: 'layerspdfexport',
				format: 'json',
				filename: this.filename
			};
			if ( this.setName ) {
				params.setname = this.setName;
			}
			// POST + CSRF token: the export burns server CPU and writes a file,
			// so it must not be triggerable cross-site.
			return new mw.Api().postWithToken( 'csrf', params ).then( ( data ) => {
				restore();
				const result = data && data.layerspdfexport;
				if ( result && result.url ) {
					this.warnIfExportIncomplete( result );
					onUrl( result.url );
				} else {
					this.showExportError();
				}
			} ).catch( () => {
				restore();
				this.showExportError();
			} );
		}

		/**
		 * Tell the user when the server compositor could not draw every layer.
		 *
		 * The client-side Download path composites the same canvas the viewer
		 * shows, so it is always complete; only this server path can be lossy.
		 *
		 * @param {Object} result The layerspdfexport API result
		 * @private
		 */
		warnIfExportIncomplete( result ) {
			if ( !result.incomplete || typeof mw === 'undefined' || !mw.notify ) {
				return;
			}
			const types = Array.isArray( result.droppedtypes ) ?
				result.droppedtypes.join( ', ' ) :
				'';
			let text = 'Some annotations could not be included in the PDF: ' + types +
				'. Use Download instead for a complete copy.';
			if ( mw.message ) {
				const msg = mw.message( 'layers-export-incomplete', types );
				if ( msg.exists() ) {
					text = msg.text();
				}
			}
			mw.notify( text, { type: 'warn', autoHideSeconds: 10 } );
		}

		/**
		 * Fallback print path: open the server-generated PDF in a new tab so the
		 * user can print it from the browser's PDF viewer, which — like our own
		 * print document — adds no margins or header/footer.
		 *
		 * @return {Promise|undefined} Resolves once the export has been handled
		 * @private
		 */
		printViaServer() {
			return this.requestServerPdf( this.printBtn, ( url ) => {
				window.open( url, '_blank', 'noopener' );
			} );
		}

		/**
		 * Save an export URL to disk. `download=1` makes Special:LayersExport send
		 * `Content-Disposition: attachment`, so the browser stores the PDF under
		 * the source file's name instead of opening a viewer tab.
		 *
		 * @param {string} url Export URL from the API
		 * @private
		 */
		triggerDownload( url ) {
			const href = url + ( url.indexOf( '?' ) === -1 ? '?' : '&' ) + 'download=1';
			const link = document.createElement( 'a' );
			link.href = href;
			link.rel = 'noopener';
			link.style.display = 'none';
			document.body.appendChild( link );
			link.click();
			if ( link.parentNode ) {
				link.parentNode.removeChild( link );
			}
		}

		/**
		 * Show a non-blocking error notification if PDF export fails.
		 *
		 * @private
		 */
		showExportError() {
			const msg = this.getMessage(
				'layers-export-pdf-failed', 'Failed to export the marked-up file as a PDF.'
			);
			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify( msg, { type: 'error' } );
			}
		}

		/**
		 * Resolve full-size image URL from filename
		 *
		 * @param {string} filename The filename
		 * @return {string} Full image URL
		 * @private
		 */
		resolveFullImageUrl( filename ) {
			// Use MediaWiki's Special:Redirect which always resolves correctly
			// regardless of hash path configuration or InstantCommons setup
			return mw.util.getUrl( 'Special:Redirect/file/' + encodeURIComponent( filename ) );
		}

		/**
		 * Render the viewer with image and layers
		 *
		 * @param {string} imageUrl Full-size image URL
		 * @param {Object} layerData Layer data object
		 * @private
		 */
		renderViewer( imageUrl, layerData ) {
			// Guard against calling after close
			if ( !this.imageWrapper ) {
				return;
			}

			// Clear loading indicator
			this.imageWrapper.innerHTML = '';

			// Create image element
			const img = document.createElement( 'img' );
			img.className = 'layers-lightbox-image';
			img.alt = mw.message( 'layers-lightbox-alt' ).text();

			// Handle image load
			img.onload = () => {
				// Guard against callback after close (P3-206)
				if ( !this.imageWrapper || !this.isOpen ) {
					return;
				}

				this.debugLog( 'Image loaded:', img.naturalWidth, 'x', img.naturalHeight );

				// Create viewer overlay
				const LayersViewer = getClass( 'Viewer.LayersViewer', 'LayersViewer' ) ||
					( window.Layers && window.Layers.Viewer );

				if ( typeof LayersViewer === 'function' ) {
					// Update layerData with image dimensions if not set
					if ( !layerData.baseWidth ) {
						layerData.baseWidth = img.naturalWidth;
					}
					if ( !layerData.baseHeight ) {
						layerData.baseHeight = img.naturalHeight;
					}

					this.viewer = new LayersViewer( {
						container: this.imageWrapper,
						imageElement: img,
						layerData: layerData
					} );

					this.debugLog( 'Viewer initialized with', layerData.layers.length, 'layers' );
				} else {
					this.debugLog( 'LayersViewer class not available' );
				}
			};

			img.onerror = () => {
				this.showError( 'Failed to load image' );
			};

			// Apply background settings
			if ( layerData.backgroundVisible === false || layerData.backgroundVisible === 0 ) {
				img.style.visibility = 'hidden';
				img.style.opacity = '0';
			} else {
				img.style.opacity = String( layerData.backgroundOpacity || 1 );
			}

			this.imageWrapper.appendChild( img );
			img.src = imageUrl;
		}

		/**
		 * Show error message
		 *
		 * @param {string} message Error message
		 * @private
		 */
		showError( message ) {
			// Guard against calling after close
			if ( !this.imageWrapper ) {
				return;
			}
			this.imageWrapper.innerHTML = '';
			const error = document.createElement( 'div' );
			error.className = 'layers-lightbox-error';
			error.textContent = message;
			this.imageWrapper.appendChild( error );
		}

		/**
		 * Handle keyboard events
		 *
		 * @param {KeyboardEvent} e Keyboard event
		 * @private
		 */
		handleKeyDown( e ) {
			switch ( e.key ) {
				case 'Escape':
					e.preventDefault();
					this.close();
					break;
				case '+':
				case '=':
					e.preventDefault();
					this.zoomBy( 1.25 );
					break;
				case '-':
				case '_':
					e.preventDefault();
					this.zoomBy( 1 / 1.25 );
					break;
				case '0':
					e.preventDefault();
					this.resetZoom();
					break;
				case 'f':
				case 'F':
					e.preventDefault();
					this.fitToScreen();
					break;
				case 'ArrowLeft':
					if ( this.pageCount > 1 ) {
						e.preventDefault();
						this.goToPage( this.currentPage - 1 );
					}
					break;
				case 'ArrowRight':
					if ( this.pageCount > 1 ) {
						e.preventDefault();
						this.goToPage( this.currentPage + 1 );
					}
					break;
				default:
					break;
			}
		}

		/**
		 * Handle click events on overlay
		 *
		 * @param {MouseEvent} e Mouse event
		 * @private
		 */
		handleClick( e ) {
			// Close if clicking on the overlay background (not the container content)
			if ( e.target === this.overlay ) {
				this.close();
			}
		}

		/**
		 * Close the lightbox
		 * @param {boolean} [immediate=false] Skip animation and remove immediately
		 */
		close( immediate ) {
			if ( !this.isOpen || !this.overlay ) {
				return;
			}

			this.debugLog( 'Closing lightbox' );

			// Clean up viewer
			if ( this.viewer && typeof this.viewer.destroy === 'function' ) {
				this.viewer.destroy();
				this.viewer = null;
			}

			// Release pdf.js documents/resources for this session.
			if ( this.pdfRenderer && typeof this.pdfRenderer.destroy === 'function' ) {
				this.pdfRenderer.destroy();
			}
			this.pdfRenderer = null;
			this._pdfRendererResolved = false;

			// Drop any hidden print document still attached to the page.
			this.destroyPrintFrame();

			// Remove event listeners
			if ( this.boundKeyHandler ) {
				document.removeEventListener( 'keydown', this.boundKeyHandler );
				this.boundKeyHandler = null;
			}

			// Remove click handler from overlay (explicit cleanup for consistency)
			if ( this.boundClickHandler && this.overlay ) {
				this.overlay.removeEventListener( 'click', this.boundClickHandler );
				this.boundClickHandler = null;
			}

			// Remove zoom/pan listeners
			if ( this.boundWheelHandler && this.overlay ) {
				this.overlay.removeEventListener( 'wheel', this.boundWheelHandler );
				this.boundWheelHandler = null;
			}
			if ( this.boundPanStart && this.imageWrapper ) {
				this.imageWrapper.removeEventListener( 'mousedown', this.boundPanStart );
				this.boundPanStart = null;
			}
			if ( this.boundPanMove ) {
				document.removeEventListener( 'mousemove', this.boundPanMove );
				this.boundPanMove = null;
			}
			if ( this.boundPanEnd ) {
				document.removeEventListener( 'mouseup', this.boundPanEnd );
				this.boundPanEnd = null;
			}
			this.isPanning = false;

			// Cancel any pending close timeout
			if ( this.closeTimeoutId ) {
				clearTimeout( this.closeTimeoutId );
				this.closeTimeoutId = null;
			}

			if ( immediate ) {
				// Synchronous removal (used when re-opening to prevent duplicates)
				if ( this.overlay && this.overlay.parentNode ) {
					this.overlay.parentNode.removeChild( this.overlay );
				}
				this.overlay = null;
				this.container = null;
				this.imageWrapper = null;
				this.toolbar = null;
				document.body.style.overflow = '';
			} else {
				// Animate out
				this.overlay.classList.remove( 'layers-lightbox-visible' );

				// Remove after animation
				this.closeTimeoutId = setTimeout( () => {
					this.closeTimeoutId = null;
					if ( this.overlay && this.overlay.parentNode ) {
						this.overlay.parentNode.removeChild( this.overlay );
					}
					this.overlay = null;
					this.container = null;
					this.imageWrapper = null;
					this.toolbar = null;
					document.body.style.overflow = '';
				}, 300 );
			}

			this.isOpen = false;
		}

		/**
		 * Initialize lightbox triggers on the page
		 * Finds all elements with .layers-lightbox-trigger and adds click handlers
		 */
		initializeTriggers() {
			const triggers = document.querySelectorAll( '.layers-lightbox-trigger' );
			this.debugLog( 'Found', triggers.length, 'lightbox triggers' );

			triggers.forEach( ( trigger ) => {
				// Skip if already initialized
				if ( trigger.dataset.layersLightboxInit ) {
					return;
				}

				trigger.addEventListener( 'click', ( e ) => {
					e.preventDefault();

					// Extract filename from the link
					const filename = this.extractFilenameFromTrigger( trigger );
					const setName = trigger.dataset.layersSetname || null;

					// Check for inline layer data on the image
					const img = trigger.querySelector( 'img[data-layer-data]' );
					let layerData = null;
					if ( img ) {
						try {
							const raw = img.getAttribute( 'data-layer-data' );
							layerData = JSON.parse( raw );
						} catch ( err ) {
							this.debugLog( 'Failed to parse inline layer data' );
						}
					}

					// Multi-page (PDF) support
					const triggerImg = trigger.querySelector( 'img' );
					const triggerPage = triggerImg
						? parseInt( triggerImg.getAttribute( 'data-page' ), 10 )
						: NaN;

					if ( filename ) {
						this.open( {
							filename: filename,
							setName: setName,
							page: triggerPage > 1 ? triggerPage : 1,
							layerData: layerData
						} );
					}
				} );

				trigger.dataset.layersLightboxInit = 'true';
			} );
		}

		/**
		 * Extract filename from a trigger element
		 *
		 * @param {HTMLElement} trigger The trigger element
		 * @return {string|null} Filename or null
		 * @private
		 */
		extractFilenameFromTrigger( trigger ) {
			// Prefer the link target: it names the file exactly, where a
			// thumbnail URL only encodes a derived name.
			const parser = this.getUrlParser();
			const href = trigger.getAttribute( 'href' ) || '';
			const fromHref = parser && parser.fileNameFromHref( href );
			if ( fromHref ) {
				return fromHref;
			}

			// Try data attribute
			if ( trigger.dataset.layersFilename ) {
				return trigger.dataset.layersFilename;
			}

			// Try extracting from child image
			const img = trigger.querySelector( 'img' );
			if ( img ) {
				const src = img.src || '';
				const srcMatch = src.match( /\/([^/]+\.[a-zA-Z]+)(?:\?|$)/ );
				if ( srcMatch ) {
					const name = decodeURIComponent( srcMatch[ 1 ] );
					return parser ? parser.stripThumbnailPrefix( name ) : name;
				}
			}

			return null;
		}

		/**
		 * Lazily obtain a UrlParser, which owns every rule for turning a link or a
		 * thumbnail URL into a file name. This class used to carry its own copies,
		 * and they were a strict subset: only a pretty `/File:` path was matched, so
		 * a layered PDF could not be opened at all.
		 *
		 * @return {Object|null} Parser instance, or null if the class is unavailable
		 * @private
		 */
		getUrlParser() {
			if ( !this._urlParser ) {
				const UrlParser = getClass( 'Viewer.UrlParser', 'LayersUrlParser' );
				this._urlParser = UrlParser ? new UrlParser( { debug: this.debug } ) : null;
			}
			return this._urlParser;
		}
	}

	// Create singleton instance
	const lightbox = new LayersLightbox( {
		debug: typeof mw !== 'undefined' && mw.config && mw.config.get( 'wgLayersDebug' )
	} );

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.Lightbox = LayersLightbox;
		window.Layers.lightbox = lightbox;
	}

	// Initialize on DOM ready
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', () => {
			lightbox.initializeTriggers();
		} );
	} else {
		lightbox.initializeTriggers();
	}

	// Re-initialize on content updates
	if ( typeof mw !== 'undefined' && mw.hook ) {
		mw.hook( 'wikipage.content' ).add( () => {
			lightbox.initializeTriggers();
		} );
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayersLightbox;
	}

}() );
