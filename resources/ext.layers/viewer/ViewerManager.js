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

		// Create SlideController for slide-related operations
		const SlideController = getClass( 'Viewer.SlideController', 'SlideController' );
		this._slideController = SlideController ? new SlideController( { debug: this.debug } ) : null;

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
	 * Delegates to SlideController.
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Fresh layer data payload
	 * @return {boolean} True if slide viewer was reinitialized
	 */
	reinitializeSlideViewer( container, payload ) {
		if ( this._slideController ) {
			return this._slideController.reinitializeSlideViewer( container, payload );
		}
		this.debugWarn( 'reinitializeSlideViewer: SlideController not available' );
		return false;
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
		if ( this._slideController ) {
			return this._slideController.refreshAllSlides();
		}
		this.debugWarn( 'refreshAllSlides: SlideController not available' );
		return Promise.resolve( { refreshed: 0, failed: 0, total: 0, errors: [] } );
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
	 * Delegates to SlideController.
	 */
	initializeSlides() {
		if ( this._slideController ) {
			this._slideController.initializeSlides();
		} else {
			this.debugWarn( 'initializeSlides: SlideController not available' );
		}
	}

	/**
	 * Initialize a slide viewer for a container element.
	 * Delegates to SlideController.
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Layer data payload
	 */
	initializeSlideViewer( container, payload ) {
		if ( this._slideController ) {
			this._slideController.initializeSlideViewer( container, payload );
		} else {
			this.debugWarn( 'initializeSlideViewer: SlideController not available' );
		}
	}

	/**
	 * Check if current user has edit permission for layers.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @return {boolean} True if user can edit layers
	 */
	canUserEdit() {
		if ( this._slideController ) {
			return this._slideController.canUserEdit();
		}
		return false;
	}

	/**
	 * Set up click handler for slide edit button.
	 * Delegates to SlideController.
	 *
	 * @param {HTMLElement} container Slide container element
	 */
	setupSlideEditButton( container ) {
		if ( this._slideController ) {
			this._slideController.setupSlideEditButton( container );
		}
	}

	/**
	 * Set up the slide overlay with edit and view buttons.
	 * Delegates to SlideController.
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Layer data payload
	 */
	setupSlideOverlay( container, payload ) {
		if ( this._slideController ) {
			this._slideController.setupSlideOverlay( container, payload );
		}
	}

	/**
	 * Handle click on slide edit button.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @param {HTMLElement} container Slide container element
	 */
	handleSlideEditClick( container ) {
		if ( this._slideController ) {
			this._slideController.handleSlideEditClick( container );
		}
	}

	/**
	 * Handle click on slide view (full size) button.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @param {HTMLElement} container Slide container element
	 * @param {Object} payload Layer data payload
	 */
	handleSlideViewClick( container, payload ) {
		if ( this._slideController ) {
			this._slideController.handleSlideViewClick( container, payload );
		}
	}

	/**
	 * Get localized message with fallback.
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
	 * Kept in ViewerManager as it's also used by ViewerOverlay.
	 *
	 * @private
	 * @return {SVGElement} Pencil icon
	 */
	_createPencilIcon() {
		const SVG_NS = 'http://www.w3.org/2000/svg';

		// Try to use IconFactory if available
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.UI &&
			window.Layers.UI.IconFactory && window.Layers.UI.IconFactory.createPencilIcon ) {
			return window.Layers.UI.IconFactory.createPencilIcon( { size: 16, color: '#fff' } );
		}

		// Fallback: pencil with document icon
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
	 * Kept in ViewerManager as it's also used by ViewerOverlay.
	 *
	 * @private
	 * @return {SVGElement} Expand icon
	 */
	_createExpandIcon() {
		// Use IconFactory if available
		if ( typeof window !== 'undefined' && window.Layers && window.Layers.UI &&
			window.Layers.UI.IconFactory && window.Layers.UI.IconFactory.createFullscreenIcon ) {
			return window.Layers.UI.IconFactory.createFullscreenIcon( { size: 16, color: '#fff' } );
		}

		// Fallback: expand arrows icon
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
	 * Delegates to SlideController.
	 *
	 * @param {Object} slideData Slide configuration data
	 */
	openSlideEditor( slideData ) {
		if ( this._slideController ) {
			this._slideController.openSlideEditor( slideData );
		} else {
			this.debugWarn( 'openSlideEditor: SlideController not available' );
		}
	}

	/**
	 * Check if modal editor should be used for slides.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @return {boolean} True if modal should be used
	 */
	_shouldUseModalForSlide() {
		if ( this._slideController ) {
			return this._slideController._shouldUseModalForSlide();
		}
		return false;
	}

	/**
	 * Build the URL for the slide editor.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @param {Object} slideData Slide data
	 * @return {string} Editor URL
	 */
	buildSlideEditorUrl( slideData ) {
		if ( this._slideController ) {
			return this._slideController.buildSlideEditorUrl( slideData );
		}
		return '';
	}

	/**
	 * Render an empty slide (placeholder for slides with no content).
	 * Delegates to SlideController.
	 *
	 * @param {HTMLElement} container Slide container element
	 * @param {number} width Canvas width
	 * @param {number} height Canvas height
	 */
	renderEmptySlide( container, width, height ) {
		if ( this._slideController ) {
			this._slideController.renderEmptySlide( container, width, height );
		}
	}

	/**
	 * Draw empty state content on canvas.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @param {CanvasRenderingContext2D} ctx Canvas context
	 * @param {number} width Canvas width
	 * @param {number} height Canvas height
	 * @param {HTMLElement} container Slide container
	 */
	drawEmptyStateContent( ctx, width, height, container ) {
		if ( this._slideController ) {
			this._slideController.drawEmptyStateContent( ctx, width, height, container );
		}
	}

	/**
	 * Get the empty state main message.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @return {string} Message text
	 */
	getEmptyStateMessage() {
		if ( this._slideController ) {
			return this._slideController.getEmptyStateMessage();
		}
		return 'Empty Slide';
	}

	/**
	 * Get the empty state hint text.
	 * Delegates to SlideController.
	 *
	 * @private
	 * @return {string} Hint text
	 */
	getEmptyStateHint() {
		if ( this._slideController ) {
			return this._slideController.getEmptyStateHint();
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
