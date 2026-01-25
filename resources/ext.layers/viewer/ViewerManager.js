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
	 * @param {FreshnessChecker} [options.freshnessChecker] Freshness checker instance
	 */
	constructor( options ) {
		this.debug = options && options.debug;
		const LayersUrlParser = getClass( 'Utils.UrlParser', 'LayersUrlParser' );
		this.urlParser = ( options && options.urlParser ) || new LayersUrlParser( { debug: this.debug } );

		// Create freshness checker for FR-10: Live Preview Without Page Edit/Save
		if ( options && options.freshnessChecker ) {
			this.freshnessChecker = options.freshnessChecker;
		} else {
			const FreshnessChecker = getClass( 'Viewer.FreshnessChecker', 'FreshnessChecker' );
			this.freshnessChecker = FreshnessChecker ? new FreshnessChecker( { debug: this.debug } ) : null;
		}

		// Track created wrappers for cleanup
		this._createdWrappers = new WeakMap();
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

			// Track the wrapper we created for this image (for cleanup)
			if ( this._createdWrappers ) {
				this._createdWrappers.set( img, wrapper );
			}
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
			this.debugLog( 'initializeViewer: skipping, viewer already exists' );
			return false;
		}

		try {
			// Normalize payload to { layers: [...], baseWidth, baseHeight }
			let data = layerData;
			if ( Array.isArray( data ) ) {
				data = { layers: data };
			}

			this.debugLog( 'initializeViewer: creating viewer with data:', {
				layerCount: data.layers ? data.layers.length : 0,
				backgroundVisible: data.backgroundVisible,
				baseWidth: data.baseWidth,
				baseHeight: data.baseHeight
			} );

			const container = this.ensurePositionedContainer( img );
			const LayersViewer = getClass( 'Viewer.LayersViewer', 'LayersViewer' );

			img.layersViewer = new LayersViewer( {
				container: container,
				imageElement: img,
				layerData: data
			} );

			// Initialize hover overlay with edit/view buttons
			this._initializeOverlay( img, container );

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
	 * Initialize the hover overlay for an image with layers.
	 *
	 * @private
	 * @param {HTMLImageElement} img Image element
	 * @param {HTMLElement} container Positioned container
	 */
	_initializeOverlay( img, container ) {
		// Skip if overlay already exists
		if ( img.layersOverlay ) {
			return;
		}

		// Extract filename from image
		const filename = this.extractFilenameFromImg( img );
		if ( !filename ) {
			this.debugLog( 'No filename for overlay, skipping' );
			return;
		}

		// Get set name from data attribute
		// data-layer-setname is explicit set name from existing layer data
		// data-layers-intent may be 'on', 'true', or a specific set name
		let setname = img.getAttribute( 'data-layer-setname' );
		if ( !setname ) {
			const intent = img.getAttribute( 'data-layers-intent' ) || '';
			// Generic enable values should use 'default', specific names pass through
			const genericValues = [ 'on', 'true', 'all', '1' ];
			setname = genericValues.includes( intent.toLowerCase() ) ? 'default' : ( intent || 'default' );
		}

		// Get ViewerOverlay class
		const ViewerOverlay = getClass( 'Viewer.Overlay', 'ViewerOverlay' );
		if ( !ViewerOverlay ) {
			this.debugLog( 'ViewerOverlay class not available' );
			return;
		}

		try {
			img.layersOverlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: filename,
				setname: setname,
				debug: this.debug
			} );
			this.debugLog( 'Overlay initialized for', filename );
		} catch ( e ) {
			this.debugWarn( 'Overlay init error:', e );
		}
	}

	/**
	 * Reinitialize a viewer with fresh layer data (FR-10: Live Preview).
	 *
	 * This is called when the inline data is stale (outdated) and fresh data
	 * has been fetched from the API. It destroys the existing viewer and
	 * creates a new one with the updated data.
	 *
	 * @param {HTMLImageElement} img Image element with existing viewer
	 * @param {Object} layerData Fresh layer data from API
	 * @return {boolean} True if viewer was reinitialized
	 */
	reinitializeViewer ( img, layerData ) {
		try {
			// Destroy existing viewer if present
			if ( img.layersViewer ) {
				if ( typeof img.layersViewer.destroy === 'function' ) {
					img.layersViewer.destroy();
				}
				img.layersViewer = null;
			}

			// Note: We don't destroy the overlay on reinitialize since
			// the overlay is reused (same buttons, just viewer data changes)

			// Clear any pending flags
			img.layersPending = false;

			// Initialize with fresh data
			const success = this.initializeViewer( img, layerData );
			if ( success ) {
				this.debugLog( 'Viewer reinitialized with fresh data' );
			}
			return success;
		} catch ( e ) {
			this.debugWarn( 'Viewer reinit error:', e );
			return false;
		}
	}

	/**
	 * Reinitialize a slide viewer with fresh layer data.
	 *
	 * This is called when a slide's data needs to be refreshed after editing.
	 * It clears the canvas and re-renders all layers with the fresh data.
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Fresh layer data payload
	 * @return {boolean} True if slide viewer was reinitialized
	 */
	reinitializeSlideViewer( container, payload ) {
		try {
			const canvas = container.querySelector( 'canvas' );
			if ( !canvas ) {
				this.debugWarn( 'reinitializeSlideViewer: No canvas found' );
				return false;
			}

			const ctx = canvas.getContext( '2d' );
			if ( !ctx ) {
				this.debugWarn( 'reinitializeSlideViewer: Could not get 2d context' );
				return false;
			}

			// Get the original canvas/display dimensions from data attributes
			const origCanvasWidth = parseInt( container.getAttribute( 'data-canvas-width' ), 10 ) || 800;
			const origCanvasHeight = parseInt( container.getAttribute( 'data-canvas-height' ), 10 ) || 600;
			const origDisplayWidth = parseInt( container.getAttribute( 'data-display-width' ), 10 ) || origCanvasWidth;
			const origDisplayHeight = parseInt( container.getAttribute( 'data-display-height' ), 10 ) || origCanvasHeight;

			// Update canvas dimensions if payload specifies new ones
			if ( payload.baseWidth && payload.baseHeight ) {
				canvas.width = payload.baseWidth;
				canvas.height = payload.baseHeight;

				// Update data attributes to reflect new canvas size
				container.setAttribute( 'data-canvas-width', payload.baseWidth );
				container.setAttribute( 'data-canvas-height', payload.baseHeight );

				// Determine if this slide was originally unconstrained (display == canvas)
				// or constrained (display < canvas)
				const wasUnconstrained = origDisplayWidth === origCanvasWidth &&
					origDisplayHeight === origCanvasHeight;

				if ( wasUnconstrained ) {
					// Unconstrained slide: display at full canvas size
					const newDisplayWidth = payload.baseWidth;
					const newDisplayHeight = payload.baseHeight;

					canvas.style.width = newDisplayWidth + 'px';
					canvas.style.height = newDisplayHeight + 'px';
					container.style.width = newDisplayWidth + 'px';
					container.style.height = newDisplayHeight + 'px';

					// Update data attributes
					container.setAttribute( 'data-display-width', newDisplayWidth );
					container.setAttribute( 'data-display-height', newDisplayHeight );
					container.setAttribute( 'data-display-scale', '1' );

					this.debugLog( 'Slide resized (unconstrained): ' + newDisplayWidth + 'x' + newDisplayHeight );
				} else {
					// Constrained slide: recalculate display size to fit within original constraint
					// while maintaining new aspect ratio
					const newAspect = payload.baseWidth / payload.baseHeight;
					const constraintAspect = origDisplayWidth / origDisplayHeight;

					let newDisplayWidth, newDisplayHeight;
					if ( newAspect > constraintAspect ) {
						// New aspect is wider - fit to width
						newDisplayWidth = origDisplayWidth;
						newDisplayHeight = Math.round( origDisplayWidth / newAspect );
					} else {
						// New aspect is taller - fit to height
						newDisplayHeight = origDisplayHeight;
						newDisplayWidth = Math.round( origDisplayHeight * newAspect );
					}

					const newScale = newDisplayWidth / payload.baseWidth;

					canvas.style.width = newDisplayWidth + 'px';
					canvas.style.height = newDisplayHeight + 'px';
					container.style.width = newDisplayWidth + 'px';
					container.style.height = newDisplayHeight + 'px';

					// Update data attributes
					container.setAttribute( 'data-display-width', newDisplayWidth );
					container.setAttribute( 'data-display-height', newDisplayHeight );
					container.setAttribute( 'data-display-scale', newScale.toFixed( 4 ) );

					this.debugLog( 'Slide resized (constrained): ' + payload.baseWidth + 'x' + payload.baseHeight +
						' -> ' + newDisplayWidth + 'x' + newDisplayHeight );
				}
			}

			// Get background color
			const bgColor = payload.backgroundColor || container.getAttribute( 'data-background' ) || '#ffffff';
			const isTransparent = !bgColor || bgColor === 'transparent' || bgColor === 'none';
			// Check background visibility - handle both boolean and integer from API
			const bgVisible = payload.backgroundVisible !== false && payload.backgroundVisible !== 0;
			// Get background opacity - default to 1.0 (fully opaque)
			const bgOpacity = typeof payload.backgroundOpacity === 'number' ? payload.backgroundOpacity : 1.0;

			// Update container background style and data attribute
			if ( payload.backgroundColor ) {
				container.setAttribute( 'data-background', payload.backgroundColor );
				if ( isTransparent ) {
					// Transparent: show checkerboard pattern
					container.style.backgroundColor = 'transparent';
					container.style.backgroundImage = 'url(data:image/svg+xml,' +
						'base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+' +
						'PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4' +
						'IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=)';
				} else {
					// Clear container background - canvas handles the background with opacity
					// If we set container.style.backgroundColor, it shows through the semi-transparent
					// canvas background, making opacity appear as 100%
					container.style.backgroundColor = 'transparent';
					container.style.backgroundImage = '';
				}
			}

			// Get LayerRenderer for rendering
			const LayerRenderer = ( window.Layers && window.Layers.LayerRenderer ) || window.LayerRenderer;
			if ( !LayerRenderer ) {
				this.debugWarn( 'reinitializeSlideViewer: LayerRenderer not available' );
				return false;
			}

			/**
			 * Helper function to render all layers.
			 * Called initially and again when async resources (SVGs) finish loading.
			 */
			const renderAllLayers = () => {
				ctx.clearRect( 0, 0, canvas.width, canvas.height );
				if ( !isTransparent && bgVisible ) {
					// Draw background color with opacity (no checkerboard in viewer - that's editor-only)
					ctx.save();
					ctx.globalAlpha = bgOpacity;
					ctx.fillStyle = bgColor;
					ctx.fillRect( 0, 0, canvas.width, canvas.height );
					ctx.restore();
				}
				if ( payload.layers && Array.isArray( payload.layers ) ) {
					payload.layers.forEach( ( layer ) => {
						if ( layer.visible !== false && layer.visible !== 0 ) {
							renderer.drawLayer( layer );
						}
					} );
				}
			};

			// Render layers - use single renderer instance to maintain SVG image cache
			// onImageLoad callback triggers re-render when async SVGs finish loading
			const renderer = new LayerRenderer( ctx, {
				canvas: canvas,
				zoom: 1,
				onImageLoad: renderAllLayers
			} );

			// Initial render
			renderAllLayers();

			// Update the stored payload for the overlay (for view full size)
			container._layersPayload = payload;

			this.debugLog( 'Slide viewer reinitialized:', container.getAttribute( 'data-slide-name' ) );
			return true;
		} catch ( e ) {
			this.debugWarn( 'Slide viewer reinit error:', e );
			return false;
		}
	}

	/**
	 * Initialize only the edit/view overlay for an image, without a viewer.
	 *
	 * This is used when a layer set is referenced but doesn't exist yet,
	 * allowing users to click the edit button to create the new set.
	 *
	 * @param {HTMLImageElement} img Image element
	 * @param {string} [setname='default'] The layer set name
	 * @return {boolean} True if overlay was initialized
	 */
	initializeOverlayOnly( img, setname ) {
		if ( !img ) {
			return false;
		}

		// Skip if overlay already exists
		if ( img.layersOverlay ) {
			this.debugLog( 'initializeOverlayOnly: overlay already exists' );
			return false;
		}

		try {
			const container = this.ensurePositionedContainer( img );

			// Store the intended setname for overlay use
			if ( setname && setname !== 'default' ) {
				img.setAttribute( 'data-layer-setname', setname );
			}

			// Mark that this set needs to be auto-created when editing
			img.setAttribute( 'data-layer-autocreate', '1' );

			this._initializeOverlay( img, container );
			this.debugLog( 'Overlay-only initialized for non-existent set:', setname || 'default' );
			return true;
		} catch ( e ) {
			this.debugWarn( 'Overlay-only init error:', e );
			return false;
		}
	}

	/**
	 * Completely destroy a viewer and clean up all created DOM elements.
	 *
	 * This should be called when permanently removing a viewer from an image,
	 * such as during page teardown or when layers are removed from an image.
	 *
	 * @param {HTMLImageElement} img Image element with viewer to destroy
	 */
	destroyViewer( img ) {
		if ( !img ) {
			return;
		}

		// Destroy the viewer instance
		if ( img.layersViewer ) {
			if ( typeof img.layersViewer.destroy === 'function' ) {
				img.layersViewer.destroy();
			}
			img.layersViewer = null;
		}

		// Destroy the overlay
		if ( img.layersOverlay ) {
			if ( typeof img.layersOverlay.destroy === 'function' ) {
				img.layersOverlay.destroy();
			}
			img.layersOverlay = null;
		}

		// Clean up wrapper element if we created one
		if ( this._createdWrappers ) {
			const wrapper = this._createdWrappers.get( img );
			if ( wrapper && wrapper.parentNode ) {
				// Move image back to parent before removing wrapper
				wrapper.parentNode.insertBefore( img, wrapper );
				wrapper.parentNode.removeChild( wrapper );
				this._createdWrappers.delete( img );
			}
		}

		// Clear flags
		img.layersPending = false;

		this.debugLog( 'Viewer destroyed and cleaned up' );
	}

	/**
	 * Refresh all viewers on the page by fetching fresh data from the API.
	 *
	 * This is called when the modal editor closes after saving to ensure
	 * all viewers display the latest layer data without requiring a page refresh.
	 *
	 * @return {Promise<Object>} Promise resolving to result object:
	 *   - refreshed: number of viewers successfully refreshed
	 *   - failed: number of viewers that failed to refresh
	 *   - total: total number of viewers attempted
	 *   - errors: array of {filename, error} objects for failed refreshes
	 */
	refreshAllViewers() {
		this.debugLog( 'refreshAllViewers: starting' );

		// Find all images with layer viewers
		const viewerImages = Array.prototype.slice.call(
			document.querySelectorAll( 'img' )
		).filter( ( img ) => img.layersViewer );

		if ( viewerImages.length === 0 ) {
			this.debugLog( 'refreshAllViewers: no image viewers found, checking for slides' );
			// Even if no images, still refresh slides
			return this.refreshAllSlides();
		}

		this.debugLog( 'refreshAllViewers: found', viewerImages.length, 'viewers' );

		// Clear freshness cache for all images to force API fetch
		if ( this.freshnessChecker ) {
			viewerImages.forEach( ( img ) => {
				const filename = img.getAttribute( 'data-file-name' );
				const setName = img.getAttribute( 'data-layer-setname' ) || 'default';
				if ( filename ) {
					this.freshnessChecker.clearCache( filename, setName );
				}
			} );
		}

		// Fetch fresh data for each viewer via API
		if ( typeof mw === 'undefined' || !mw.Api ) {
			this.debugWarn( 'refreshAllViewers: mw.Api not available' );
			return Promise.resolve( {
				refreshed: 0,
				failed: viewerImages.length,
				total: viewerImages.length,
				errors: [ { filename: null, error: 'mw.Api not available' } ]
			} );
		}

		const api = new mw.Api();
		const self = this;
		let refreshCount = 0;
		const errors = [];

		const refreshPromises = viewerImages.map( ( img ) => {
			const filename = this.extractFilenameFromImg( img );
			const setName = img.getAttribute( 'data-layer-setname' ) || img.getAttribute( 'data-layers-intent' ) || 'default';

			if ( !filename ) {
				return Promise.resolve( false );
			}

			const params = {
				action: 'layersinfo',
				format: 'json',
				filename: filename,
				// Cache buster to ensure fresh data after save
				_: Date.now()
			};
			if ( setName && setName !== 'on' && setName !== 'default' ) {
				params.setname = setName;
			}

			return api.get( params ).then( ( data ) => {
				try {
					if ( !data || !data.layersinfo || !data.layersinfo.layerset ) {
						self.debugLog( 'refreshAllViewers: no layerset for', filename );
						return false;
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

					if ( !layersArr ) {
						layersArr = [];
					}

					// Normalize backgroundVisible: API returns 0/1 integers, convert to boolean
					let bgVisible = true;
					if ( layerset.data && layerset.data.backgroundVisible !== undefined ) {
						const bgVal = layerset.data.backgroundVisible;
						bgVisible = bgVal !== false && bgVal !== 0 && bgVal !== '0' && bgVal !== 'false';
					}

					const payload = {
						layers: layersArr,
						baseWidth: layerset.baseWidth || img.naturalWidth || img.width || null,
						baseHeight: layerset.baseHeight || img.naturalHeight || img.height || null,
						backgroundVisible: bgVisible,
						backgroundOpacity: layerset.data && layerset.data.backgroundOpacity !== undefined
							? parseFloat( layerset.data.backgroundOpacity ) : 1.0
					};

					const success = self.reinitializeViewer( img, payload );
					if ( success ) {
						refreshCount++;
						self.debugLog( 'refreshAllViewers: refreshed viewer for', filename );
					}
					return { success: success, filename: filename };
				} catch ( e ) {
					self.debugWarn( 'refreshAllViewers: error processing', filename, e );
					errors.push( { filename: filename, error: e.message || String( e ) } );
					return { success: false, filename: filename };
				}
			} ).catch( ( apiErr ) => {
				self.debugWarn( 'refreshAllViewers: API error for', filename, apiErr );
				const errMsg = apiErr && apiErr.message ? apiErr.message :
					( apiErr && apiErr.error && apiErr.error.info ? apiErr.error.info : String( apiErr ) );
				errors.push( { filename: filename, error: errMsg } );
				return { success: false, filename: filename };
			} );
		} );

		return Promise.all( refreshPromises ).then( ( results ) => {
			const failed = results.filter( ( r ) => !r.success ).length;
			self.debugLog( 'refreshAllViewers: completed, refreshed', refreshCount, 'of', viewerImages.length, 'image viewers' );
			if ( errors.length > 0 ) {
				self.debugWarn( 'refreshAllViewers:', errors.length, 'errors occurred:', errors );
			}

			// Also refresh all slide viewers
			return self.refreshAllSlides().then( ( slideResults ) => {
				return {
					refreshed: refreshCount + slideResults.refreshed,
					failed: failed + slideResults.failed,
					total: viewerImages.length + slideResults.total,
					errors: errors.concat( slideResults.errors )
				};
			} );
		} );
	}

	/**
	 * Refresh all slide viewers on the page by fetching fresh data from the API.
	 *
	 * This is called by refreshAllViewers() to ensure slides are also updated
	 * when the modal editor closes after saving.
	 *
	 * @return {Promise<Object>} Promise resolving to result object
	 */
	refreshAllSlides() {
		this.debugLog( 'refreshAllSlides: starting' );

		// Find all slide containers (don't require layersSlideInitialized flag
		// since this may be called after bfcache restore where DOM properties may be lost)
		const slideContainers = Array.prototype.slice.call(
			document.querySelectorAll( '.layers-slide-container[data-slide-name]' )
		);

		if ( slideContainers.length === 0 ) {
			this.debugLog( 'refreshAllSlides: no slides found' );
			return Promise.resolve( { refreshed: 0, failed: 0, total: 0, errors: [] } );
		}

		this.debugLog( 'refreshAllSlides: found', slideContainers.length, 'slides' );

		// Fetch fresh data for each slide via API
		if ( typeof mw === 'undefined' || !mw.Api ) {
			this.debugWarn( 'refreshAllSlides: mw.Api not available' );
			return Promise.resolve( {
				refreshed: 0,
				failed: slideContainers.length,
				total: slideContainers.length,
				errors: [ { slideName: null, error: 'mw.Api not available' } ]
			} );
		}

		const api = new mw.Api();
		const self = this;
		let refreshCount = 0;
		const errors = [];

		const refreshPromises = slideContainers.map( ( container ) => {
			const slideName = container.getAttribute( 'data-slide-name' );
			const setName = container.getAttribute( 'data-layerset' ) || 'default';
			const canvasWidth = parseInt( container.getAttribute( 'data-canvas-width' ), 10 ) || 800;
			const canvasHeight = parseInt( container.getAttribute( 'data-canvas-height' ), 10 ) || 600;

			if ( !slideName ) {
				return Promise.resolve( { success: false, slideName: null } );
			}

			return api.get( {
				action: 'layersinfo',
				slidename: slideName,
				setname: setName,
				format: 'json',
				formatversion: 2,
				// Cache buster to ensure fresh data after save
				_: Date.now()
			} ).then( ( data ) => {
				try {
					if ( !data || !data.layersinfo ) {
						self.debugLog( 'refreshAllSlides: no layersinfo for', slideName );
						return { success: false, slideName: slideName };
					}

					const layerset = data.layersinfo.layerset;
					let layersArr = [];

					if ( layerset && layerset.data && layerset.data.layers ) {
						layersArr = layerset.data.layers;
					}

					// Build payload for slide viewer
					const payload = {
						layers: layersArr,
						baseWidth: ( layerset && layerset.baseWidth ) || ( layerset && layerset.data && layerset.data.canvasWidth ) || canvasWidth,
						baseHeight: ( layerset && layerset.baseHeight ) || ( layerset && layerset.data && layerset.data.canvasHeight ) || canvasHeight,
						backgroundVisible: layerset && layerset.data && layerset.data.backgroundVisible !== undefined
							? ( layerset.data.backgroundVisible !== false && layerset.data.backgroundVisible !== 0 )
							: true,
						backgroundOpacity: layerset && layerset.data && typeof layerset.data.backgroundOpacity === 'number'
							? layerset.data.backgroundOpacity
							: ( layerset && layerset.data && layerset.data.backgroundOpacity !== undefined
								? parseFloat( layerset.data.backgroundOpacity )
								: 1.0 ),
						isSlide: true,
						backgroundColor: ( layerset && layerset.data && layerset.data.backgroundColor ) ||
							container.getAttribute( 'data-background' ) || '#ffffff'
					};

					const success = self.reinitializeSlideViewer( container, payload );
					if ( success ) {
						refreshCount++;
						self.debugLog( 'refreshAllSlides: refreshed slide', slideName );
					}
					return { success: success, slideName: slideName };
				} catch ( e ) {
					self.debugWarn( 'refreshAllSlides: error processing', slideName, e );
					errors.push( { slideName: slideName, error: e.message || String( e ) } );
					return { success: false, slideName: slideName };
				}
			} ).catch( ( apiErr ) => {
				self.debugWarn( 'refreshAllSlides: API error for', slideName, apiErr );
				const errMsg = apiErr && apiErr.message ? apiErr.message :
					( apiErr && apiErr.error && apiErr.error.info ? apiErr.error.info : String( apiErr ) );
				errors.push( { slideName: slideName, error: errMsg } );
				return { success: false, slideName: slideName };
			} );
		} );

		return Promise.all( refreshPromises ).then( ( results ) => {
			const failed = results.filter( ( r ) => !r.success ).length;
			self.debugLog( 'refreshAllSlides: completed, refreshed', refreshCount, 'of', slideContainers.length, 'slides' );
			if ( errors.length > 0 ) {
				self.debugWarn( 'refreshAllSlides:', errors.length, 'errors occurred:', errors );
			}
			return {
				refreshed: refreshCount,
				failed: failed,
				total: slideContainers.length,
				errors: errors
			};
		} );
	}

	/**
	 * Check freshness of initialized viewers and update stale ones (FR-10).
	 *
	 * After viewers are initialized with inline data, this method checks
	 * if the data is stale by comparing revision numbers with the API.
	 * If stale data is detected, the viewer is reinitialized with fresh data.
	 *
	 * @param {HTMLImageElement[]} images Array of images with initialized viewers
	 */
	checkAndRefreshStaleViewers ( images ) {
		if ( !this.freshnessChecker || !images || images.length === 0 ) {
			return;
		}

		// Filter to images that have revision info for freshness checking
		const checkableImages = images.filter( ( img ) =>
			img.hasAttribute( 'data-layer-revision' ) &&
			img.hasAttribute( 'data-file-name' )
		);

		if ( checkableImages.length === 0 ) {
			this.debugLog( 'No images with revision info to check' );
			return;
		}

		this.debugLog( 'Checking freshness for', checkableImages.length, 'images' );

		// Check freshness for all images
		this.freshnessChecker.checkMultipleFreshness( checkableImages )
			.then( ( resultMap ) => {
				resultMap.forEach( ( result, img ) => {
					if ( !result.isFresh && result.layerData ) {
						this.debugLog(
							'Stale data detected for image, reinitializing',
							'(inline rev=', result.inlineRevision,
							', latest rev=', result.latestRevision, ')'
						);
						this.reinitializeViewer( img, result.layerData );
					}
				} );
			} )
			.catch( ( err ) => {
				this.debugWarn( 'Freshness check failed:', err );
			} );
	}

	/**
	 * Find all images with server-provided layer data and initialize viewers.
	 *
	 * Searches for:
	 * 1. img[data-layer-data] - images with direct layer data
	 * 2. a[data-layer-data] > img - images inside links with layer data
	 * 3. img[data-layers-large] - images with large data that need API fetch
	 * 4. .layers-slide-container - slides (canvas without parent image)
	 */
	initializeLayerViewers () {
		// Primary: attributes directly on <img>
		const images = Array.prototype.slice.call(
			document.querySelectorAll( 'img[data-layer-data]' )
		);

		// Also find images that have large data marked for API fetch
		const largeImages = Array.prototype.slice.call(
			document.querySelectorAll( 'img[data-layers-large]' )
		);

		// Fetch layer data via API for large images
		this.initializeLargeImages( largeImages );

		// Initialize slides (canvas without parent image)
		this.initializeSlides();

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
		const initializedImages = [];
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
					const decoded = this.urlParser.decodeHtmlEntities( raw );
					layerData = JSON.parse( decoded );
				} catch ( eParse ) {
					this.debugWarn( 'JSON parse error:', eParse.message );
					layerData = null;
				}
				if ( !layerData ) {
					return;
				}
				this.initializeViewer( img, layerData );
				initializedImages.push( img );
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
					mw.log.error( '[ViewerManager] Error processing image:', e );
				}
			}
		} );

		// FR-10: Check freshness of initialized viewers and update stale ones
		// This ensures changes made in the editor are visible immediately
		// without requiring a page edit/save
		this.checkAndRefreshStaleViewers( initializedImages );
	}

	/**
	 * Initialize images with large layer data that requires API fetch.
	 *
	 * @param {HTMLImageElement[]} images Array of images with data-layers-large attribute
	 */
	initializeLargeImages( images ) {
		if ( !images || images.length === 0 ) {
			return;
		}

		if ( typeof mw === 'undefined' || !mw.Api ) {
			this.debugWarn( 'mw.Api not available for large image fetch' );
			return;
		}

		const api = new mw.Api();
		const self = this;

		images.forEach( ( img ) => {
			// Skip if already initialized or pending
			if ( img.layersViewer || img.layersPending ) {
				return;
			}

			// Mark as pending to prevent duplicate fetches
			img.layersPending = true;

			// Get the layer set name from intent attribute
			const setName = img.getAttribute( 'data-layers-intent' ) || 'default';

			// Get filename from the image source
			const filename = this.extractFilenameFromImg( img );
			if ( !filename ) {
				this.debugWarn( 'Could not extract filename from image for large data fetch' );
				return;
			}

			this.debugLog( 'Fetching large layer data for:', filename, 'set:', setName );

			const params = {
				action: 'layersinfo',
				format: 'json',
				filename: filename
			};
			if ( setName && setName !== 'on' && setName !== 'default' ) {
				params.setname = setName;
			}

			api.get( params ).then( ( data ) => {
				try {
					if ( !data || !data.layersinfo || !data.layersinfo.layerset ) {
						self.debugLog( 'No layerset returned for large image' );
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
						self.debugLog( 'No layers in fetched data for large image' );
						return;
					}

					// Normalize backgroundVisible: API returns 0/1 integers, convert to boolean
					let bgVisible = true;
					if ( layerset.data.backgroundVisible !== undefined ) {
						const bgVal = layerset.data.backgroundVisible;
						bgVisible = bgVal !== false && bgVal !== 0 && bgVal !== '0' && bgVal !== 'false';
					}

					const payload = {
						layers: layersArr,
						baseWidth: layerset.baseWidth || img.naturalWidth || img.width || null,
						baseHeight: layerset.baseHeight || img.naturalHeight || img.height || null,
						backgroundVisible: bgVisible,
						backgroundOpacity: layerset.data.backgroundOpacity !== undefined
							? parseFloat( layerset.data.backgroundOpacity ) : 1.0
					};

						const success = self.initializeViewer( img, payload );
					if ( !success ) {
						img.layersPending = false;
					}
				} catch ( e2 ) {
					self.debugWarn( 'Error processing fetched large image data:', e2 );
					img.layersPending = false;
				}
			} ).catch( ( apiErr ) => {
				self.debugWarn( 'API request failed for large image:', apiErr );
				img.layersPending = false;
			} );
		} );
	}

	/**
	 * Initialize slides (canvas-based layers without parent images).
	 * Finds all .layers-slide-container elements and fetches their layer data via API.
	 */
	initializeSlides() {
		const containers = Array.prototype.slice.call(
			document.querySelectorAll( '.layers-slide-container' )
		);

		if ( containers.length === 0 ) {
			return;
		}

		this.debugLog( 'Found', containers.length, 'slide containers' );

		if ( typeof mw === 'undefined' || !mw.Api ) {
			this.debugWarn( 'mw.Api not available for slide fetch' );
			return;
		}

		const api = new mw.Api();
		const self = this;

		containers.forEach( ( container ) => {
			// Skip if already initialized
			if ( container.layersSlideInitialized ) {
				return;
			}

			const slideName = container.getAttribute( 'data-slide-name' );
			if ( !slideName ) {
				self.debugWarn( 'Slide container missing data-slide-name attribute' );
				return;
			}

			// Get canvas dimensions from data attributes
			const canvasWidth = parseInt( container.getAttribute( 'data-canvas-width' ), 10 ) || 800;
			const canvasHeight = parseInt( container.getAttribute( 'data-canvas-height' ), 10 ) || 600;
			// Slides use data-layerset (from SlideHooks.php)
			const setName = container.getAttribute( 'data-layerset' ) || 'default';

			// Mark as pending
			container.layersSlideInitialized = true;

			self.debugLog( 'Fetching slide data for:', slideName, 'set:', setName );

			api.get( {
				action: 'layersinfo',
				slidename: slideName,
				setname: setName,
				format: 'json',
				formatversion: 2
			} ).then( ( data ) => {
				try {
					if ( !data || !data.layersinfo ) {
						self.debugLog( 'No layersinfo returned for slide:', slideName );
						self.renderEmptySlide( container, canvasWidth, canvasHeight );
						return;
					}

					const layersInfo = data.layersinfo;
					const layerset = layersInfo.layerset;

					if ( !layerset || !layerset.data || !layerset.data.layers || layerset.data.layers.length === 0 ) {
						self.debugLog( 'No layers in fetched data for slide:', slideName );
						self.renderEmptySlide( container, canvasWidth, canvasHeight );
						return;
					}

					// Build payload for slide viewer
					// Handle backgroundVisible - API returns 0/1 integers, need to normalize
					const bgVal = layerset.data.backgroundVisible;
					const bgVisible = bgVal !== false && bgVal !== 0 && bgVal !== '0' && bgVal !== 'false';
					const payload = {
						layers: layerset.data.layers,
						baseWidth: layerset.baseWidth || layerset.data.canvasWidth || canvasWidth,
						baseHeight: layerset.baseHeight || layerset.data.canvasHeight || canvasHeight,
						backgroundVisible: bgVisible,
						backgroundOpacity: typeof layerset.data.backgroundOpacity === 'number' ? layerset.data.backgroundOpacity : 1.0,
						isSlide: true,
						backgroundColor: layerset.data.backgroundColor || container.getAttribute( 'data-background-color' ) || '#ffffff'
					};

					self.initializeSlideViewer( container, payload );
				} catch ( e ) {
					self.debugWarn( 'Error processing slide data:', e );
					self.renderEmptySlide( container, canvasWidth, canvasHeight );
				}
			} ).catch( ( apiErr ) => {
				self.debugWarn( 'API request failed for slide:', slideName, apiErr );
				self.renderEmptySlide( container, canvasWidth, canvasHeight );
			} );
		} );
	}

	/**
	 * Initialize a slide viewer for a container element.
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Layer data payload
	 */
	initializeSlideViewer( container, payload ) {
		const canvas = container.querySelector( 'canvas' );
		if ( !canvas ) {
			this.debugWarn( 'No canvas found in slide container' );
			return;
		}

		// Get display dimensions from container data attributes (how slide appears on page)
		const displayWidth = parseInt( container.getAttribute( 'data-display-width' ), 10 );
		const displayHeight = parseInt( container.getAttribute( 'data-display-height' ), 10 );
		const displayScale = parseFloat( container.getAttribute( 'data-display-scale' ) ) || 1;

		// Set canvas internal dimensions (source resolution for rendering)
		canvas.width = payload.baseWidth;
		canvas.height = payload.baseHeight;

		// If display dimensions differ from canvas dimensions, scale the canvas with CSS
		if ( displayWidth && displayHeight && displayScale !== 1 ) {
			canvas.style.width = displayWidth + 'px';
			canvas.style.height = displayHeight + 'px';
			this.debugLog( 'Slide canvas scaled: ' + payload.baseWidth + 'x' + payload.baseHeight +
				' -> ' + displayWidth + 'x' + displayHeight + ' (scale: ' + displayScale + ')' );
		}

		// Get LayerRenderer for rendering
		const LayerRenderer = ( window.Layers && window.Layers.LayerRenderer ) || window.LayerRenderer;
		if ( !LayerRenderer ) {
			this.debugWarn( 'LayerRenderer not available for slide' );
			return;
		}

		const ctx = canvas.getContext( '2d' );
		if ( !ctx ) {
			this.debugWarn( 'Could not get 2d context for slide canvas' );
			return;
		}

		// Clear and fill background
		const bgColor = payload.backgroundColor || '#ffffff';
		const isTransparent = !bgColor || bgColor === 'transparent' || bgColor === 'none';
		// Check background visibility - handle both boolean and integer from API
		const bgVisible = payload.backgroundVisible !== false && payload.backgroundVisible !== 0;
		// Get background opacity - default to 1 if not specified
		const bgOpacity = typeof payload.backgroundOpacity === 'number' ? payload.backgroundOpacity : 1.0;

		// Clear container background since canvas handles it with opacity
		// The PHP-rendered HTML sets container background, but we need to clear it
		// so the canvas-drawn background (with opacity) is the only source
		if ( !isTransparent && bgOpacity < 1.0 ) {
			container.style.backgroundColor = 'transparent';
		}

		/**
		 * Helper function to render all layers.
		 * Called initially and again when async resources (SVGs) finish loading.
		 */
		const renderAllLayers = () => {
			ctx.clearRect( 0, 0, canvas.width, canvas.height );
			if ( !isTransparent && bgVisible ) {
				// Draw background color with opacity (no checkerboard in viewer - that's editor-only)
				ctx.save();
				ctx.globalAlpha = bgOpacity;
				ctx.fillStyle = bgColor;
				ctx.fillRect( 0, 0, canvas.width, canvas.height );
				ctx.restore();
			}
			payload.layers.forEach( ( layer ) => {
				if ( layer.visible !== false && layer.visible !== 0 ) {
					renderer.drawLayer( layer );
				}
			} );
		};

		// Render layers using single renderer instance to maintain SVG image cache
		// onImageLoad callback triggers re-render when async SVGs finish loading
		const renderer = new LayerRenderer( ctx, {
			canvas: canvas,
			zoom: 1,
			onImageLoad: renderAllLayers
		} );

		// Initial render
		renderAllLayers();

		// Remove loading placeholder
		const placeholder = container.querySelector( '.layers-slide-placeholder' );
		if ( placeholder ) {
			placeholder.style.display = 'none';
		}

		// Set up slide overlay with edit and view buttons
		this.setupSlideOverlay( container, payload );

		this.debugLog( 'Slide viewer initialized:', container.getAttribute( 'data-slide-name' ) );
	}

	/**
	 * Check if current user has edit permission for layers.
	 *
	 * @private
	 * @return {boolean} True if user can edit layers
	 */
	canUserEdit() {
		if ( typeof mw === 'undefined' || !mw.config ) {
			return false;
		}
		// Check the dedicated config var exposed by Layers extension
		const canEdit = mw.config.get( 'wgLayersCanEdit' );
		if ( canEdit !== null && canEdit !== undefined ) {
			return !!canEdit;
		}
		// Fallback: check wgUserRights if available
		const rights = mw.config.get( 'wgUserRights' );
		if ( rights && Array.isArray( rights ) ) {
			return rights.indexOf( 'editlayers' ) !== -1;
		}
		return false;
	}

	/**
	 * Set up click handler for slide edit button.
	 *
	 * @param {HTMLElement} container Slide container element
	 */
	setupSlideEditButton( container ) {
		const editButton = container.querySelector( '.layers-slide-edit-button' );
		if ( !editButton ) {
			return;
		}

		// Check if user has permission to edit - hide button if not
		if ( !this.canUserEdit() ) {
			editButton.style.display = 'none';
			this.debugLog( 'Edit button hidden - user lacks editlayers permission' );
			return;
		}

		// Prevent double-binding
		if ( editButton.layersClickBound ) {
			return;
		}
		editButton.layersClickBound = true;

		const self = this;

		editButton.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			e.stopPropagation();

			// Get slide data from container attributes
			const slideName = container.getAttribute( 'data-slide-name' );
			const lockMode = container.getAttribute( 'data-lock-mode' ) || 'none';
			const canvasWidth = parseInt( container.getAttribute( 'data-canvas-width' ), 10 ) || 800;
			const canvasHeight = parseInt( container.getAttribute( 'data-canvas-height' ), 10 ) || 600;
			const backgroundColor = container.getAttribute( 'data-background' ) || '#ffffff';
			const layerSetName = container.getAttribute( 'data-layerset' ) || 'default';

			self.debugLog( 'Slide edit clicked:', slideName, 'lockMode:', lockMode );

			self.openSlideEditor( {
				slideName: slideName,
				lockMode: lockMode,
				canvasWidth: canvasWidth,
				canvasHeight: canvasHeight,
				backgroundColor: backgroundColor,
				layerSetName: layerSetName
			} );
		} );
	}

	/**
	 * Set up the slide overlay with edit and view buttons.
	 * This replaces the old single edit button with a proper overlay.
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Layer data payload
	 */
	setupSlideOverlay( container, payload ) {
		// Remove old edit button if present (replaced by overlay)
		const oldEditButton = container.querySelector( '.layers-slide-edit-button' );
		if ( oldEditButton ) {
			oldEditButton.remove();
		}

		// Check if overlay already exists (from a previous init)
		if ( container.querySelector( '.layers-slide-overlay' ) ) {
			return;
		}

		const canEdit = this.canUserEdit();
		const self = this;

		// Create overlay container
		const overlay = document.createElement( 'div' );
		overlay.className = 'layers-slide-overlay';
		overlay.setAttribute( 'role', 'toolbar' );
		overlay.setAttribute( 'aria-label', this._msg( 'layers-viewer-overlay-label', 'Slide actions' ) );

		// Create edit button if user has permission
		if ( canEdit ) {
			const editBtn = document.createElement( 'button' );
			editBtn.className = 'layers-slide-overlay-btn layers-slide-overlay-btn--edit';
			editBtn.setAttribute( 'type', 'button' );
			editBtn.setAttribute( 'title', this._msg( 'layers-viewer-edit', 'Edit layers' ) );
			editBtn.setAttribute( 'aria-label', this._msg( 'layers-viewer-edit', 'Edit layers' ) );
			editBtn.appendChild( this._createPencilIcon() );

			editBtn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				self.handleSlideEditClick( container );
			} );

			overlay.appendChild( editBtn );
		}

		// Create view full size button (always visible)
		const viewBtn = document.createElement( 'button' );
		viewBtn.className = 'layers-slide-overlay-btn layers-slide-overlay-btn--view';
		viewBtn.setAttribute( 'type', 'button' );
		viewBtn.setAttribute( 'title', this._msg( 'layers-viewer-view', 'View full size' ) );
		viewBtn.setAttribute( 'aria-label', this._msg( 'layers-viewer-view', 'View full size' ) );
		viewBtn.appendChild( this._createExpandIcon() );

		viewBtn.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			e.stopPropagation();
			self.handleSlideViewClick( container, payload );
		} );

		overlay.appendChild( viewBtn );

		// Add overlay to container
		container.appendChild( overlay );

		this.debugLog( 'Slide overlay created for:', container.getAttribute( 'data-slide-name' ),
			'canEdit:', canEdit );
	}

	/**
	 * Handle click on slide edit button.
	 *
	 * @private
	 * @param {HTMLElement} container Slide container element
	 */
	handleSlideEditClick( container ) {
		const slideName = container.getAttribute( 'data-slide-name' );
		const lockMode = container.getAttribute( 'data-lock-mode' ) || 'none';
		const canvasWidth = parseInt( container.getAttribute( 'data-canvas-width' ), 10 ) || 800;
		const canvasHeight = parseInt( container.getAttribute( 'data-canvas-height' ), 10 ) || 600;
		const backgroundColor = container.getAttribute( 'data-background' ) || '#ffffff';
		const layerSetName = container.getAttribute( 'data-layerset' ) || 'default';

		this.debugLog( 'Slide edit clicked:', slideName );

		this.openSlideEditor( {
			slideName: slideName,
			lockMode: lockMode,
			canvasWidth: canvasWidth,
			canvasHeight: canvasHeight,
			backgroundColor: backgroundColor,
			layerSetName: layerSetName
		} );
	}

	/**
	 * Handle click on slide view (full size) button.
	 * Opens the slide in a lightbox for full-size viewing.
	 *
	 * @private
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Layer data payload
	 */
	handleSlideViewClick( container, payload ) {
		const slideName = container.getAttribute( 'data-slide-name' );
		this.debugLog( 'Slide view clicked:', slideName );

		// Get LayersLightbox class - check multiple export locations
		const LightboxClass = ( window.Layers && window.Layers.Viewer && window.Layers.Viewer.Lightbox ) ||
			( window.Layers && window.Layers.LayersLightbox ) ||
			window.LayersLightbox;
		if ( !LightboxClass ) {
			this.debugWarn( 'LayersLightbox not available for slide view' );
			return;
		}

		// Create a synthetic image data object for the lightbox
		const canvas = container.querySelector( 'canvas' );
		if ( !canvas ) {
			return;
		}

		// Create a data URL from the current canvas state
		const dataUrl = canvas.toDataURL( 'image/png' );

		// Create lightbox and open with proper config
		// LayersLightbox.open() expects { filename, imageUrl, layerData }
		const lightbox = new LightboxClass( { debug: this.debug } );
		lightbox.open( {
			filename: slideName,
			imageUrl: dataUrl,
			layerData: {
				layers: payload.layers || [],
				baseWidth: payload.baseWidth,
				baseHeight: payload.baseHeight,
				backgroundVisible: true,
				backgroundOpacity: 1.0,
				backgroundColor: payload.backgroundColor
			}
		} );
	}

	/**
	 * Get localized message with fallback (for slides).
	 *
	 * @private
	 * @param {string} key Message key
	 * @param {string} fallback Fallback text
	 * @return {string} Message text
	 */
	_msg( key, fallback ) {
		if ( typeof mw !== 'undefined' && mw.message ) {
			const msg = mw.message( key );
			if ( msg.exists() ) {
				return msg.text();
			}
		}
		return fallback;
	}

	/**
	 * Create pencil icon SVG for edit button.
	 *
	 * @private
	 * @return {SVGElement} Pencil icon
	 */
	_createPencilIcon() {
		const SVG_NS = 'http://www.w3.org/2000/svg';

		// Try to use IconFactory if available (matches ViewerOverlay)
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.UI &&
			window.Layers.UI.IconFactory && window.Layers.UI.IconFactory.createPencilIcon ) {
			return window.Layers.UI.IconFactory.createPencilIcon( { size: 16, color: '#fff' } );
		}

		// Fallback: same SVG as ViewerOverlay (pencil with document icon)
		const svg = document.createElementNS( SVG_NS, 'svg' );
		svg.setAttribute( 'width', '16' );
		svg.setAttribute( 'height', '16' );
		svg.setAttribute( 'viewBox', '0 0 24 24' );
		svg.setAttribute( 'fill', 'none' );
		svg.setAttribute( 'aria-hidden', 'true' );

		const path1 = document.createElementNS( SVG_NS, 'path' );
		path1.setAttribute( 'd', 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' );
		path1.setAttribute( 'stroke', '#fff' );
		path1.setAttribute( 'stroke-width', '2' );
		path1.setAttribute( 'stroke-linecap', 'round' );
		path1.setAttribute( 'stroke-linejoin', 'round' );
		svg.appendChild( path1 );

		const path2 = document.createElementNS( SVG_NS, 'path' );
		path2.setAttribute( 'd', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' );
		path2.setAttribute( 'stroke', '#fff' );
		path2.setAttribute( 'stroke-width', '2' );
		path2.setAttribute( 'stroke-linecap', 'round' );
		path2.setAttribute( 'stroke-linejoin', 'round' );
		svg.appendChild( path2 );

		return svg;
	}

	/**
	 * Create expand icon SVG for view button.
	 *
	 * @private
	 * @return {SVGElement} Expand icon
	 */
	_createExpandIcon() {
		// Use IconFactory if available for consistency with ViewerOverlay
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.UI &&
			window.Layers.UI.IconFactory && window.Layers.UI.IconFactory.createFullscreenIcon ) {
			return window.Layers.UI.IconFactory.createFullscreenIcon( { size: 16, color: '#fff' } );
		}

		// Fallback: same SVG as ViewerOverlay (expand arrows icon)
		const SVG_NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS( SVG_NS, 'svg' );
		svg.setAttribute( 'width', '16' );
		svg.setAttribute( 'height', '16' );
		svg.setAttribute( 'viewBox', '0 0 24 24' );
		svg.setAttribute( 'fill', 'none' );
		svg.setAttribute( 'aria-hidden', 'true' );

		// Top-right corner
		const path1 = document.createElementNS( SVG_NS, 'path' );
		path1.setAttribute( 'd', 'M15 3h6v6' );
		path1.setAttribute( 'stroke', '#fff' );
		path1.setAttribute( 'stroke-width', '2' );
		path1.setAttribute( 'stroke-linecap', 'round' );
		path1.setAttribute( 'stroke-linejoin', 'round' );
		svg.appendChild( path1 );

		// Bottom-left corner
		const path2 = document.createElementNS( SVG_NS, 'path' );
		path2.setAttribute( 'd', 'M9 21H3v-6' );
		path2.setAttribute( 'stroke', '#fff' );
		path2.setAttribute( 'stroke-width', '2' );
		path2.setAttribute( 'stroke-linecap', 'round' );
		path2.setAttribute( 'stroke-linejoin', 'round' );
		svg.appendChild( path2 );

		// Diagonal lines
		const line1 = document.createElementNS( SVG_NS, 'line' );
		line1.setAttribute( 'x1', '21' );
		line1.setAttribute( 'y1', '3' );
		line1.setAttribute( 'x2', '14' );
		line1.setAttribute( 'y2', '10' );
		line1.setAttribute( 'stroke', '#fff' );
		line1.setAttribute( 'stroke-width', '2' );
		line1.setAttribute( 'stroke-linecap', 'round' );
		svg.appendChild( line1 );

		const line2 = document.createElementNS( SVG_NS, 'line' );
		line2.setAttribute( 'x1', '3' );
		line2.setAttribute( 'y1', '21' );
		line2.setAttribute( 'x2', '10' );
		line2.setAttribute( 'y2', '14' );
		line2.setAttribute( 'stroke', '#fff' );
		line2.setAttribute( 'stroke-width', '2' );
		line2.setAttribute( 'stroke-linecap', 'round' );
		svg.appendChild( line2 );

		return svg;
	}

	/**
	 * Open the slide editor.
	 *
	 * @param {Object} slideData Slide configuration data
	 * @param {string} slideData.slideName Slide name
	 * @param {string} slideData.lockMode Lock mode (none, size, all)
	 * @param {number} slideData.canvasWidth Canvas width
	 * @param {number} slideData.canvasHeight Canvas height
	 * @param {string} slideData.backgroundColor Background color
	 * @param {string} slideData.layerSetName Layer set name
	 */
	openSlideEditor( slideData ) {
		// Fire a hook that the editor module can listen to
		// This allows the modal or inline editor to handle slide editing
		if ( typeof mw !== 'undefined' && mw.hook ) {
			mw.hook( 'layers.slide.edit' ).fire( {
				slideName: slideData.slideName,
				lockMode: slideData.lockMode,
				canvasWidth: slideData.canvasWidth,
				canvasHeight: slideData.canvasHeight,
				backgroundColor: slideData.backgroundColor,
				layerSetName: slideData.layerSetName,
				isSlide: true
			} );
		}

		// Check if modal editor should be used (same pattern as ViewerOverlay for images)
		const useModal = this._shouldUseModalForSlide();

		this.debugLog( 'openSlideEditor: useModal=', useModal );

		if ( useModal && typeof window !== 'undefined' && window.Layers &&
			window.Layers.Modal && window.Layers.Modal.LayersEditorModal ) {
			// Open in modal - build URL with modal flag
			const modal = new window.Layers.Modal.LayersEditorModal();
			const editorUrl = this.buildSlideEditorUrl( slideData ) + '&modal=1';

			// For slides, we pass the slide name as the "filename" for the modal
			const slideFilename = 'Slide:' + slideData.slideName;
			const setName = slideData.layerSetName || 'default';

			modal.open( slideFilename, setName, editorUrl ).then( ( result ) => {
				if ( result && result.saved ) {
					// Refresh all slide viewers when modal closes after save
					this.refreshAllViewers();
				}
			} );
		} else {
			// Fallback: Navigate to slide editor page (full page navigation)
			const editUrl = this.buildSlideEditorUrl( slideData );
			window.location.href = editUrl;
		}
	}

	/**
	 * Check if modal editor should be used for slides.
	 * Matches the logic in ViewerOverlay._shouldUseModal().
	 *
	 * @private
	 * @return {boolean} True if modal should be used
	 */
	_shouldUseModalForSlide() {
		// Use modal if modal module is available
		if ( typeof mw === 'undefined' || !mw.config ) {
			this.debugLog( '_shouldUseModalForSlide: mw or mw.config undefined' );
			return false;
		}

		// Check if modal module is available
		const hasLayers = !!window.Layers;
		const hasModal = !!( window.Layers && window.Layers.Modal );
		const hasClass = !!( window.Layers && window.Layers.Modal && window.Layers.Modal.LayersEditorModal );

		this.debugLog( '_shouldUseModalForSlide:',
			'window.Layers:', hasLayers,
			'window.Layers.Modal:', hasModal,
			'LayersEditorModal:', hasClass );

		return hasClass;
	}

	/**
	 * Build the URL for the slide editor.
	 *
	 * @private
	 * @param {Object} slideData Slide data
	 * @return {string} Editor URL
	 */
	buildSlideEditorUrl( slideData ) {
		if ( typeof mw === 'undefined' || !mw.util ) {
			// Fallback URL construction
			let url = '/wiki/Special:EditSlide/' + encodeURIComponent( slideData.slideName );
			url += '?setname=' + encodeURIComponent( slideData.layerSetName );
			if ( slideData.lockMode && slideData.lockMode !== 'none' ) {
				url += '&lockmode=' + encodeURIComponent( slideData.lockMode );
			}
			return url;
		}

		const params = new URLSearchParams();
		params.set( 'action', 'editslide' );
		params.set( 'slidename', slideData.slideName );
		if ( slideData.layerSetName && slideData.layerSetName !== 'default' ) {
			params.set( 'setname', slideData.layerSetName );
		}
		if ( slideData.lockMode && slideData.lockMode !== 'none' ) {
			params.set( 'lockmode', slideData.lockMode );
		}
		// Note: Do NOT pass canvaswidth/canvasheight here!
		// Saved dimensions take precedence; server will load from database.
		// Only pass lock mode and set name to let the API determine actual dimensions.

		// Use Special:Slides page for editing (will be created in Phase 3)
		// For now, use a slide-specific URL pattern
		return mw.util.getUrl( 'Special:EditSlide/' + slideData.slideName ) + '?' + params.toString();
	}

	/**
	 * Render an empty slide (placeholder for slides with no content).
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {number} width Canvas width
	 * @param {number} height Canvas height
	 */
	renderEmptySlide( container, width, height ) {
		const canvas = container.querySelector( 'canvas' );
		if ( !canvas ) {
			return;
		}

		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext( '2d' );
		if ( !ctx ) {
			return;
		}

		// Fill with background color
		const bgColor = container.getAttribute( 'data-background' ) || '#ffffff';
		ctx.fillStyle = bgColor;
		ctx.fillRect( 0, 0, width, height );

		// Draw empty state content
		this.drawEmptyStateContent( ctx, width, height, container );

		// Set up overlay with edit/view buttons even for empty slides
		// Build a minimal payload for the overlay
		const payload = {
			layers: [],
			baseWidth: width,
			baseHeight: height,
			isSlide: true,
			backgroundColor: container.getAttribute( 'data-background' ) || '#ffffff'
		};
		this.setupSlideOverlay( container, payload );

		this.debugLog( 'Rendered empty slide:', container.getAttribute( 'data-slide-name' ) );
	}

	/**
	 * Draw empty state content on canvas (icon, message, hint).
	 *
	 * @private
	 * @param {CanvasRenderingContext2D} ctx Canvas context
	 * @param {number} width Canvas width
	 * @param {number} height Canvas height
	 * @param {HTMLElement} container Slide container for placeholder text
	 */
	drawEmptyStateContent( ctx, width, height, container ) {
		const centerX = width / 2;
		const centerY = height / 2;

		// Get placeholder text from container or use default
		const placeholder = container.getAttribute( 'data-placeholder' ) || '';

		// Calculate scale based on canvas size (minimum readable size)
		const scale = Math.min( width, height ) / 400;
		const iconSize = Math.max( 32, Math.min( 64, 48 * scale ) );
		const fontSize = Math.max( 12, Math.min( 18, 14 * scale ) );
		const smallFontSize = Math.max( 10, Math.min( 14, 12 * scale ) );

		// Draw icon (📊 chart icon using simple shapes)
		ctx.save();
		ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
		ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
		ctx.lineWidth = 2;

		// Draw a simple chart/diagram icon
		const iconY = centerY - 40 * scale;
		const barWidth = iconSize * 0.2;
		const gap = iconSize * 0.15;
		const startX = centerX - iconSize * 0.4;

		// Three bars of different heights
		ctx.fillRect( startX, iconY, barWidth, iconSize * 0.4 );
		ctx.fillRect( startX + barWidth + gap, iconY - iconSize * 0.2, barWidth, iconSize * 0.6 );
		ctx.fillRect( startX + 2 * ( barWidth + gap ), iconY - iconSize * 0.1, barWidth, iconSize * 0.5 );

		ctx.restore();

		// Draw main message
		ctx.save();
		ctx.fillStyle = 'rgba(80, 80, 80, 0.6)';
		ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const message = this.getEmptyStateMessage();
		ctx.fillText( message, centerX, centerY + 20 * scale );

		// Draw placeholder or hint below
		ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
		ctx.font = `${smallFontSize}px system-ui, -apple-system, sans-serif`;

		const hint = placeholder || this.getEmptyStateHint();
		ctx.fillText( hint, centerX, centerY + 45 * scale );

		ctx.restore();
	}

	/**
	 * Get the empty state main message.
	 *
	 * @private
	 * @return {string} Message text
	 */
	getEmptyStateMessage() {
		if ( typeof mw !== 'undefined' && mw.message ) {
			return mw.message( 'layers-slide-empty' ).text();
		}
		return 'Empty Slide';
	}

	/**
	 * Get the empty state hint text.
	 *
	 * @private
	 * @return {string} Hint text
	 */
	getEmptyStateHint() {
		if ( typeof mw !== 'undefined' && mw.message ) {
			return mw.message( 'layers-slide-empty-hint' ).text();
		}
		return 'Use the Edit button to add content';
	}

	/**
	 * Regex patterns for filename extraction
	 *
	 * @private
	 * @type {Object}
	 */
	static FILENAME_PATTERNS = {
		// Matches: /images/a/ab/Filename.ext or /Filename.ext at end of URL
		// Captures the filename including extension
		SRC_URL: /\/(?:images\/.*?\/)?([^/]+\.[a-zA-Z]+)(?:[?]|$)/,

		// Matches: /File:Filename in href links
		// Captures the filename after "File:"
		FILE_HREF: /\/File:([^/?#]+)/,

		// Matches: MediaWiki thumbnail prefix like "123px-" or "800px-"
		THUMBNAIL_PREFIX: /^\d+px-/,

		// Matches: Wikitext bracket characters that should be stripped
		WIKITEXT_BRACKETS: /[\x5B\x5D]/g
	};

	/**
	 * Extract filename from an image element.
	 *
	 * @param {HTMLImageElement} img Image element
	 * @return {string|null} Filename or null if not found
	 */
	extractFilenameFromImg( img ) {
		let filename = null;
		const patterns = ViewerManager.FILENAME_PATTERNS;

		// Try data-file-name attribute first
		const fileNameAttr = img.getAttribute( 'data-file-name' );
		if ( fileNameAttr ) {
			filename = fileNameAttr;
		} else {
			// Try extracting from src URL
			const src = img.src || '';
			const srcMatch = src.match( patterns.SRC_URL );
			if ( srcMatch && srcMatch[ 1 ] ) {
				filename = decodeURIComponent( srcMatch[ 1 ] );
				// Remove any thumbnail prefix like "123px-"
				filename = filename.replace( patterns.THUMBNAIL_PREFIX, '' );
			} else {
				// Try extracting from parent link href
				const parent = img.parentNode;
				if ( parent && parent.tagName === 'A' ) {
					const href = parent.getAttribute( 'href' ) || '';
					const hrefMatch = href.match( patterns.FILE_HREF );
					if ( hrefMatch && hrefMatch[ 1 ] ) {
						filename = decodeURIComponent( hrefMatch[ 1 ].replace( /_/g, ' ' ) );
					}
				}
			}
		}

		// Sanitize: strip any wikitext brackets that might have leaked through
		if ( filename ) {
			filename = filename.replace( patterns.WIKITEXT_BRACKETS, '' );
		}

		return filename;
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

				// Normalize backgroundVisible: API returns 0/1 integers, convert to boolean
				let bgVisible = true;
				if ( layerset.data.backgroundVisible !== undefined ) {
					const bgVal = layerset.data.backgroundVisible;
					bgVisible = bgVal !== false && bgVal !== 0 && bgVal !== '0' && bgVal !== 'false';
				}

				const payload = {
					layers: layersArr,
					baseWidth: layerset.baseWidth || img.naturalWidth || img.width || null,
					baseHeight: layerset.baseHeight || img.naturalHeight || img.height || null,
					backgroundVisible: bgVisible,
					backgroundOpacity: layerset.data.backgroundOpacity !== undefined
						? parseFloat( layerset.data.backgroundOpacity ) : 1.0
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
