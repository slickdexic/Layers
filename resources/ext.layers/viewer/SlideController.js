/**
 * Slide rendering and management controller.
 * Extracted from ViewerManager to handle slide-related functionality.
 * @module viewer/SlideController
 */
( function () {
	'use strict';

	/** SlideController class - manages slide rendering and interactions */
	class SlideController {
		/** Creates a new SlideController instance */
		constructor( options = {} ) {
			this.debug = options.debug || false;
			/** @private Tracks pending retry timeouts for cleanup */
			this._retryTimeouts = [];
		}

		/** Log a debug message if debug mode is enabled @private */
		debugLog( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log( '[Layers:SlideController]', ...args );
			}
		}

		/** Log a warning message if debug mode is enabled @private */
		debugWarn( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( '[Layers:SlideController]', ...args );
			}
		}

		/** Get a localized message @private @return {string} */
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
		 * Clean up resources and cancel pending timeouts.
		 * Call this method when the controller is no longer needed.
		 */
		destroy() {
			// Clear all pending retry timeouts
			this._retryTimeouts.forEach( ( timeoutId ) => {
				clearTimeout( timeoutId );
			} );
			this._retryTimeouts = [];
			this._retriesScheduled = false;
			this.debugLog( 'SlideController destroyed' );
		}

		/** Initialize all slides on the page */
		initializeSlides() {
			const containers = Array.from(
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

			containers.forEach( ( container ) => {
				// Skip if already initialized
				if ( container.layersSlideInitialized ) {
					return;
				}

				const slideName = container.getAttribute( 'data-slide-name' );
				if ( !slideName ) {
					this.debugWarn( 'Slide container missing data-slide-name attribute' );
					return;
				}

				// Get canvas dimensions from data attributes
				const canvasWidth = parseInt( container.getAttribute( 'data-canvas-width' ), 10 ) || 800;
				const canvasHeight = parseInt( container.getAttribute( 'data-canvas-height' ), 10 ) || 600;
				// Slides use data-layerset (from SlideHooks.php)
				const setName = container.getAttribute( 'data-layerset' ) || 'default';

				// Mark as pending - but will be reset to false on failure so retry is possible
				container.layersSlideInitialized = true;
				container.layersSlideInitSuccess = false;

				this.debugLog( 'Fetching slide data for:', slideName, 'set:', setName );

				api.get( {
					action: 'layersinfo',
					slidename: slideName,
					setname: setName,
					format: 'json',
					formatversion: 2,
					// Cache-bust to prevent stale responses (fixes slides in tables issue)
					_: Date.now()
				} ).then( ( data ) => {
					try {
						if ( !data || !data.layersinfo ) {
							this.debugLog( 'No layersinfo returned for slide:', slideName );
							container.layersSlideInitialized = false; // Allow retry
							this.renderEmptySlide( container, canvasWidth, canvasHeight );
							return;
						}

						const layersInfo = data.layersinfo;
						const layerset = layersInfo.layerset;

						if ( !layerset || !layerset.data || !layerset.data.layers || layerset.data.layers.length === 0 ) {
							this.debugLog( 'No layers in fetched data for slide:', slideName );
							container.layersSlideInitialized = false; // Allow retry
							this.renderEmptySlide( container, canvasWidth, canvasHeight );
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

						this.initializeSlideViewer( container, payload );
						container.layersSlideInitSuccess = true; // Mark as successfully initialized
						container.setAttribute( 'data-layers-init-success', 'true' ); // For DOM queries
					} catch ( e ) {
						this.debugWarn( 'Error processing slide data:', e );
						container.layersSlideInitialized = false; // Allow retry
						this.renderEmptySlide( container, canvasWidth, canvasHeight );
					}
				} ).catch( ( apiErr ) => {
					this.debugWarn( 'API request failed for slide:', slideName, apiErr );
					container.layersSlideInitialized = false; // Allow retry
					this.renderEmptySlide( container, canvasWidth, canvasHeight );
				} );
			} );

			// Schedule delayed retries for any slides that failed initialization
			// This helps with slides inside tables where timing may be an issue
			// Use multiple retries with increasing delays for robustness
			this._scheduleRetries();
		}

		/**
		 * Schedule multiple retries with increasing delays.
		 * This is more robust for handling slides that may not be ready initially.
		 *
		 * @private
		 */
		_scheduleRetries() {
			// Only schedule retries once per page load
			if ( this._retriesScheduled ) {
				return;
			}
			this._retriesScheduled = true;

			// Retry at 500ms, 1500ms, and 3000ms
			const delays = [ 500, 1500, 3000 ];

			delays.forEach( ( delay, index ) => {
				const timeoutId = setTimeout( () => {
					// Remove completed timeout from tracking array
					const idx = this._retryTimeouts.indexOf( timeoutId );
					if ( idx !== -1 ) {
						this._retryTimeouts.splice( idx, 1 );
					}
					this._retryFailedSlides( index + 1, delays.length );
				}, delay );
				// Track timeout for potential cleanup
				this._retryTimeouts.push( timeoutId );
			} );
		}

		/**
		 * Retry initialization for slides that failed on first attempt.
		 * This handles edge cases like slides inside tables where content may load late.
		 *
		 * @private
		 * @param {number} attemptNum Current retry attempt number
		 * @param {number} maxAttempts Total number of retry attempts
		 */
		_retryFailedSlides( attemptNum, maxAttempts ) {
			const failedContainers = Array.from(
				document.querySelectorAll( '.layers-slide-container' )
			).filter( ( container ) => {
				// Include containers that haven't been successfully initialized yet
				// This catches: never seen (undefined), attempted but failed, or in-progress
				// Critical for slides inside tables that may appear in DOM after initial run
				return container.layersSlideInitSuccess !== true;
			} );

			if ( failedContainers.length === 0 ) {
				if ( attemptNum === 1 ) {
					this.debugLog( 'No failed slides to retry' );
				}
				return;
			}

			this.debugLog( 'Retry attempt', attemptNum, 'of', maxAttempts, ':', failedContainers.length, 'failed slide containers' );

			// Reset flag to allow retry
			failedContainers.forEach( ( container ) => {
				container.layersSlideInitialized = false;
			} );

			// Retry initialization using refreshAllSlides which is more robust
			// It uses reinitializeSlideViewer which doesn't check flags
			this.refreshAllSlides().then( ( result ) => {
				if ( result.refreshed > 0 ) {
					this.debugLog( 'Retry', attemptNum, 'refreshed', result.refreshed, 'slides' );
				}
				if ( result.failed > 0 && attemptNum < maxAttempts ) {
					this.debugLog( 'Retry', attemptNum, 'still has', result.failed, 'failed slides, will retry again' );
				}
			} );
		}

		/** Initialize a slide viewer for a container element */
		initializeSlideViewer( container, payload ) {
			const canvas = container.querySelector( 'canvas' );
			if ( !canvas ) {
				this.debugWarn( 'No canvas found in slide container' );
				return;
			}

			// Remove empty marker if previously set (has content now)
			container.classList.remove( 'layers-slide-is-empty' );

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
					ctx.save();
					ctx.globalAlpha = bgOpacity;
					ctx.fillStyle = bgColor;
					ctx.fillRect( 0, 0, canvas.width, canvas.height );
					ctx.restore();
				}
				// Render layers from bottom to top (index 0 = top in panel, drawn last)
				const layers = payload.layers;
				for ( let i = layers.length - 1; i >= 0; i-- ) {
					const layer = layers[ i ];
					if ( layer.visible !== false && layer.visible !== 0 ) {
						renderer.drawLayer( layer );
					}
				}
			};

			// Render layers using single renderer instance
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

			// Store payload on container for later access (e.g., view full size button)
			container._layersPayload = payload;

			// Set up slide overlay with edit and view buttons
			this.setupSlideOverlay( container, payload );

			this.debugLog( 'Slide viewer initialized:', container.getAttribute( 'data-slide-name' ) );
		}

		/**
		 * Reinitialize a slide viewer with new layer data.
		 *
		 * @param {HTMLElement} container Slide container element
		 * @param {Object} payload Layer data payload
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

					// Determine if this slide was originally unconstrained
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

						container.setAttribute( 'data-display-width', newDisplayWidth );
						container.setAttribute( 'data-display-height', newDisplayHeight );
						container.setAttribute( 'data-display-scale', '1' );

						this.debugLog( 'Slide resized (unconstrained): ' + newDisplayWidth + 'x' + newDisplayHeight );
					} else {
						// Constrained slide: recalculate display size
						const newAspect = payload.baseWidth / payload.baseHeight;
						const constraintAspect = origDisplayWidth / origDisplayHeight;

						let newDisplayWidth, newDisplayHeight;
						if ( newAspect > constraintAspect ) {
							newDisplayWidth = origDisplayWidth;
							newDisplayHeight = Math.round( origDisplayWidth / newAspect );
						} else {
							newDisplayHeight = origDisplayHeight;
							newDisplayWidth = Math.round( origDisplayHeight * newAspect );
						}

						const newScale = newDisplayWidth / payload.baseWidth;

						canvas.style.width = newDisplayWidth + 'px';
						canvas.style.height = newDisplayHeight + 'px';
						container.style.width = newDisplayWidth + 'px';
						container.style.height = newDisplayHeight + 'px';

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
				const bgVisible = payload.backgroundVisible !== false && payload.backgroundVisible !== 0;
				const bgOpacity = typeof payload.backgroundOpacity === 'number' ? payload.backgroundOpacity : 1.0;

				// Update container background style
				if ( payload.backgroundColor ) {
					container.setAttribute( 'data-background', payload.backgroundColor );
					if ( isTransparent ) {
						container.style.backgroundColor = 'transparent';
						container.style.backgroundImage = 'url(data:image/svg+xml,' +
							'base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+' +
							'PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iI2NjYyIvPjxyZWN0IHg9IjgiIHk9IjgiIHdpZHRoPSI4' +
							'IiBoZWlnaHQ9IjgiIGZpbGw9IiNjY2MiLz48L3N2Zz4=)';
					} else {
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
				 */
				const renderAllLayers = () => {
					ctx.clearRect( 0, 0, canvas.width, canvas.height );
					if ( !isTransparent && bgVisible ) {
						ctx.save();
						ctx.globalAlpha = bgOpacity;
						ctx.fillStyle = bgColor;
						ctx.fillRect( 0, 0, canvas.width, canvas.height );
						ctx.restore();
					}
					if ( payload.layers && Array.isArray( payload.layers ) && payload.layers.length > 0 ) {
						const layers = payload.layers;
						for ( let i = layers.length - 1; i >= 0; i-- ) {
							const layer = layers[ i ];
							if ( layer.visible !== false && layer.visible !== 0 ) {
								renderer.drawLayer( layer );
							}
						}
						// Has content - remove empty marker
						container.classList.remove( 'layers-slide-is-empty' );
					} else {
						// No layers - draw empty state placeholder and mark for print hiding
						container.classList.add( 'layers-slide-is-empty' );
						this.drawEmptyStateContent( ctx, canvas.width, canvas.height, container );
					}
				};

				// Render layers
				const renderer = new LayerRenderer( ctx, {
					canvas: canvas,
					zoom: 1,
					onImageLoad: renderAllLayers
				} );

				renderAllLayers();

				// Update the stored payload for the overlay
				container._layersPayload = payload;

				this.debugLog( 'Slide viewer reinitialized:', container.getAttribute( 'data-slide-name' ) );
				return true;
			} catch ( e ) {
				this.debugWarn( 'Slide viewer reinit error:', e );
				return false;
			}
		}

		/**
		 * Refresh all slides on the page with fresh data from API.
		 *
		 * @return {Promise<Object>} Promise resolving to refresh summary
		 */
		refreshAllSlides() {
			this.debugLog( 'refreshAllSlides: starting' );

			const slideContainers = Array.from(
				document.querySelectorAll( '.layers-slide-container[data-slide-name]' )
			);

			if ( slideContainers.length === 0 ) {
				this.debugLog( 'refreshAllSlides: no slides found' );
				return Promise.resolve( { refreshed: 0, failed: 0, total: 0, errors: [] } );
			}

			this.debugLog( 'refreshAllSlides: found', slideContainers.length, 'slides' );

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
					_: Date.now()
				} ).then( ( data ) => {
					try {
						if ( !data || !data.layersinfo ) {
							this.debugLog( 'refreshAllSlides: no layersinfo for', slideName );
							return { success: false, slideName: slideName };
						}

						const layerset = data.layersinfo.layerset;
						let layersArr = [];

						if ( layerset && layerset.data && layerset.data.layers ) {
							layersArr = layerset.data.layers;
						}

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

						const success = this.reinitializeSlideViewer( container, payload );
						if ( success ) {
							refreshCount++;
							container.layersSlideInitSuccess = true;
							container.setAttribute( 'data-layers-init-success', 'true' );
							this.debugLog( 'refreshAllSlides: refreshed slide', slideName );
						}
						return { success: success, slideName: slideName };
					} catch ( e ) {
						this.debugWarn( 'refreshAllSlides: error processing', slideName, e );
						errors.push( { slideName: slideName, error: e.message || String( e ) } );
						return { success: false, slideName: slideName };
					}
				} ).catch( ( apiErr ) => {
					this.debugWarn( 'refreshAllSlides: API error for', slideName, apiErr );
					const errMsg = apiErr && apiErr.message ? apiErr.message :
						( apiErr && apiErr.error && apiErr.error.info ? apiErr.error.info : String( apiErr ) );
					errors.push( { slideName: slideName, error: errMsg } );
					return { success: false, slideName: slideName };
				} );
			} );

			return Promise.all( refreshPromises ).then( ( results ) => {
				const failed = results.filter( ( r ) => !r.success ).length;
				this.debugLog( 'refreshAllSlides: completed, refreshed', refreshCount, 'of', slideContainers.length, 'slides' );
				if ( errors.length > 0 ) {
					this.debugWarn( 'refreshAllSlides:', errors.length, 'errors occurred:', errors );
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
		 * Check if current user has edit permission for layers.
		 *
		 * @return {boolean} True if user can edit layers
		 */
		canUserEdit() {
			if ( typeof mw === 'undefined' || !mw.config ) {
				return false;
			}
			const canEdit = mw.config.get( 'wgLayersCanEdit' );
			if ( canEdit !== null && canEdit !== undefined ) {
				return !!canEdit;
			}
			const rights = mw.config.get( 'wgUserRights' );
			if ( rights && Array.isArray( rights ) ) {
				return rights.indexOf( 'editlayers' ) !== -1;
			}
			return false;
		}

		/**
		 * Set up click handler for slide edit button (legacy).
		 *
		 * @param {HTMLElement} container Slide container element
		 */
		setupSlideEditButton( container ) {
			const editButton = container.querySelector( '.layers-slide-edit-button' );
			if ( !editButton ) {
				return;
			}

			if ( !this.canUserEdit() ) {
				editButton.style.display = 'none';
				this.debugLog( 'Edit button hidden - user lacks editlayers permission' );
				return;
			}

			if ( editButton.layersClickBound ) {
				return;
			}
			editButton.layersClickBound = true;

			editButton.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();

				const slideName = container.getAttribute( 'data-slide-name' );
				const lockMode = container.getAttribute( 'data-lock-mode' ) || 'none';
				const canvasWidth = parseInt( container.getAttribute( 'data-canvas-width' ), 10 ) || 800;
				const canvasHeight = parseInt( container.getAttribute( 'data-canvas-height' ), 10 ) || 600;
				const backgroundColor = container.getAttribute( 'data-background' ) || '#ffffff';
				const layerSetName = container.getAttribute( 'data-layerset' ) || 'default';

				this.debugLog( 'Slide edit clicked:', slideName, 'lockMode:', lockMode );

				this.openSlideEditor( {
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
		 *
		 * @param {HTMLElement} container Slide container element
		 * @param {Object} payload Layer data payload
		 */
		setupSlideOverlay( container, payload ) {
			// Remove old edit button if present
			const oldEditButton = container.querySelector( '.layers-slide-edit-button' );
			if ( oldEditButton ) {
				oldEditButton.remove();
			}

			if ( container.querySelector( '.layers-slide-overlay' ) ) {
				return;
			}

			const canEdit = this.canUserEdit();

			// Create overlay container
			const overlay = document.createElement( 'div' );
			overlay.className = 'layers-slide-overlay';
			overlay.setAttribute( 'role', 'toolbar' );
			overlay.setAttribute( 'aria-label', this._msg( 'layers-viewer-overlay-label', 'Slide actions' ) );

			// Create edit button if user has permission
			if ( canEdit ) {
				const editBtn = document.createElement( 'button' );
				editBtn.className = 'layers-viewer-overlay-btn layers-viewer-overlay-btn--edit';
				editBtn.setAttribute( 'type', 'button' );
				editBtn.setAttribute( 'title', this._msg( 'layers-viewer-edit', 'Edit layers' ) );
				editBtn.setAttribute( 'aria-label', this._msg( 'layers-viewer-edit', 'Edit layers' ) );
				editBtn.appendChild( this._createPencilIcon() );

				editBtn.addEventListener( 'click', ( e ) => {
					e.preventDefault();
					e.stopPropagation();
					this.handleSlideEditClick( container );
				} );

				overlay.appendChild( editBtn );
			}

			// Create view full size button
			const viewBtn = document.createElement( 'button' );
			viewBtn.className = 'layers-viewer-overlay-btn layers-viewer-overlay-btn--view';
			viewBtn.setAttribute( 'type', 'button' );
			viewBtn.setAttribute( 'title', this._msg( 'layers-viewer-view', 'View full size' ) );
			viewBtn.setAttribute( 'aria-label', this._msg( 'layers-viewer-view', 'View full size' ) );
			viewBtn.appendChild( this._createExpandIcon() );

			viewBtn.addEventListener( 'click', ( e ) => {
				e.preventDefault();
				e.stopPropagation();
				this.handleSlideViewClick( container, payload );
			} );

			overlay.appendChild( viewBtn );
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

			this.debugLog( 'Slide edit clicked:', slideName, 'layerset:', layerSetName );

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
		 *
		 * @private
		 * @param {HTMLElement} container Slide container element
		 * @param {Object} payload Layer data payload (initial, may be stale)
		 */
		handleSlideViewClick( container, payload ) {
			const slideName = container.getAttribute( 'data-slide-name' );
			this.debugLog( 'Slide view clicked:', slideName );

			const LightboxClass = ( window.Layers && window.Layers.Viewer && window.Layers.Viewer.Lightbox ) ||
				( window.Layers && window.Layers.LayersLightbox ) ||
				window.LayersLightbox;
			if ( !LightboxClass ) {
				this.debugWarn( 'LayersLightbox not available for slide view' );
				return;
			}

			const canvas = container.querySelector( 'canvas' );
			if ( !canvas ) {
				return;
			}

			// Use stored/updated payload if available (set by reinitializeSlideViewer after save)
			// Fall back to original payload from initialization
			const currentPayload = container._layersPayload || payload;

			const dataUrl = canvas.toDataURL( 'image/png' );
			const lightbox = new LightboxClass( { debug: this.debug } );
			lightbox.open( {
				filename: slideName,
				imageUrl: dataUrl,
				layerData: {
					layers: currentPayload.layers || [],
					baseWidth: currentPayload.baseWidth,
					baseHeight: currentPayload.baseHeight,
					backgroundVisible: true,
					backgroundOpacity: 1.0,
					backgroundColor: currentPayload.backgroundColor
				}
			} );
		}

		/**
		 * Open slide editor (modal or full page).
		 *
		 * @param {Object} slideData Slide configuration data
		 */
		openSlideEditor( slideData ) {
			// Fire a hook for editor module
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

			const useModal = this._shouldUseModalForSlide();
			this.debugLog( 'openSlideEditor: useModal=', useModal );

			if ( useModal && typeof window !== 'undefined' && window.Layers &&
				window.Layers.Modal && window.Layers.Modal.LayersEditorModal ) {
				const modal = new window.Layers.Modal.LayersEditorModal();
				const editorUrl = this.buildSlideEditorUrl( slideData ) + '&modal=1';
				const slideFilename = 'Slide:' + slideData.slideName;
				const setName = slideData.layerSetName || 'default';

				modal.open( slideFilename, setName, editorUrl ).then( ( result ) => {
					if ( result && result.saved ) {
						this.refreshAllSlides();
					}
				} );
			} else {
				const editUrl = this.buildSlideEditorUrl( slideData );
				window.location.href = editUrl;
			}
		}

		/**
		 * Check if modal editor should be used for slides.
		 *
		 * @private
		 * @return {boolean} True if modal should be used
		 */
		_shouldUseModalForSlide() {
			if ( typeof mw === 'undefined' || !mw.config ) {
				this.debugLog( '_shouldUseModalForSlide: mw or mw.config undefined' );
				return false;
			}

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
				let url = '/wiki/Special:EditSlide/' + encodeURIComponent( slideData.slideName );
				url += '?setname=' + encodeURIComponent( slideData.layerSetName );
				if ( slideData.lockMode && slideData.lockMode !== 'none' ) {
					url += '&lockmode=' + encodeURIComponent( slideData.lockMode );
				}
				if ( slideData.canvasWidth && slideData.canvasHeight &&
					( slideData.canvasWidth !== 800 || slideData.canvasHeight !== 600 ) ) {
					url += '&canvaswidth=' + slideData.canvasWidth;
					url += '&canvasheight=' + slideData.canvasHeight;
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
			if ( slideData.canvasWidth && slideData.canvasHeight &&
				( slideData.canvasWidth !== 800 || slideData.canvasHeight !== 600 ) ) {
				params.set( 'canvaswidth', slideData.canvasWidth );
				params.set( 'canvasheight', slideData.canvasHeight );
			}

			const baseUrl = mw.util.getUrl( 'Special:EditSlide/' + slideData.slideName );
			const separator = baseUrl.includes( '?' ) ? '&' : '?';
			return baseUrl + separator + params.toString();
		}

		/**
		 * Render an empty slide placeholder.
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

			// Mark container as empty for print CSS
			container.classList.add( 'layers-slide-is-empty' );

			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext( '2d' );
			if ( !ctx ) {
				return;
			}

			const bgColor = container.getAttribute( 'data-background' ) || '#ffffff';
			ctx.fillStyle = bgColor;
			ctx.fillRect( 0, 0, width, height );

			this.drawEmptyStateContent( ctx, width, height, container );

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
		 * Draw empty state content on canvas.
		 *
		 * @private
		 * @param {CanvasRenderingContext2D} ctx Canvas context
		 * @param {number} width Canvas width
		 * @param {number} height Canvas height
		 * @param {HTMLElement} container Slide container
		 */
		drawEmptyStateContent( ctx, width, height, container ) {
			const centerX = width / 2;
			const centerY = height / 2;

			const placeholder = container.getAttribute( 'data-placeholder' ) || '';
			const scale = Math.min( width, height ) / 400;
			const iconSize = Math.max( 32, Math.min( 64, 48 * scale ) );
			const fontSize = Math.max( 12, Math.min( 18, 14 * scale ) );
			const smallFontSize = Math.max( 10, Math.min( 14, 12 * scale ) );

			// Draw icon
			ctx.save();
			ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
			ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
			ctx.lineWidth = 2;

			const iconY = centerY - 40 * scale;
			const barWidth = iconSize * 0.2;
			const gap = iconSize * 0.15;
			const startX = centerX - iconSize * 0.4;

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
		 * Create SVG pencil icon for edit button.
		 * Uses IconFactory if available, falls back to inline creation.
		 *
		 * @private
		 * @return {SVGElement} Pencil icon SVG
		 */
		_createPencilIcon() {
			const svgNs = 'http://www.w3.org/2000/svg';

			// Try to use IconFactory if available (consistent with ViewerOverlay)
			if ( typeof window !== 'undefined' && window.Layers && window.Layers.UI &&
				window.Layers.UI.IconFactory && window.Layers.UI.IconFactory.createPencilIcon ) {
				return window.Layers.UI.IconFactory.createPencilIcon( { size: 16, color: '#fff' } );
			}

			// Fallback inline SVG — matches ViewerOverlay exactly
			const svg = document.createElementNS( svgNs, 'svg' );
			svg.setAttribute( 'width', '16' );
			svg.setAttribute( 'height', '16' );
			svg.setAttribute( 'viewBox', '0 0 24 24' );
			svg.setAttribute( 'fill', 'none' );
			svg.setAttribute( 'aria-hidden', 'true' );

			const path1 = document.createElementNS( svgNs, 'path' );
			path1.setAttribute( 'd', 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' );
			path1.setAttribute( 'stroke', '#fff' );
			path1.setAttribute( 'stroke-width', '2' );
			path1.setAttribute( 'stroke-linecap', 'round' );
			path1.setAttribute( 'stroke-linejoin', 'round' );
			svg.appendChild( path1 );

			const path2 = document.createElementNS( svgNs, 'path' );
			path2.setAttribute( 'd', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' );
			path2.setAttribute( 'stroke', '#fff' );
			path2.setAttribute( 'stroke-width', '2' );
			path2.setAttribute( 'stroke-linecap', 'round' );
			path2.setAttribute( 'stroke-linejoin', 'round' );
			svg.appendChild( path2 );

			return svg;
		}

		/**
		 * Create SVG expand icon for view button.
		 * Uses IconFactory if available, falls back to inline creation.
		 *
		 * @private
		 * @return {SVGElement} Expand icon SVG
		 */
		_createExpandIcon() {
			const svgNs = 'http://www.w3.org/2000/svg';

			// Try to use IconFactory if available (consistent with ViewerOverlay)
			if ( typeof window !== 'undefined' && window.Layers && window.Layers.UI &&
				window.Layers.UI.IconFactory && window.Layers.UI.IconFactory.createFullscreenIcon ) {
				return window.Layers.UI.IconFactory.createFullscreenIcon( { size: 16, color: '#fff' } );
			}

			// Fallback inline SVG — matches ViewerOverlay exactly
			const svg = document.createElementNS( svgNs, 'svg' );
			svg.setAttribute( 'width', '16' );
			svg.setAttribute( 'height', '16' );
			svg.setAttribute( 'viewBox', '0 0 24 24' );
			svg.setAttribute( 'fill', 'none' );
			svg.setAttribute( 'aria-hidden', 'true' );

			// Top-right corner
			const path1 = document.createElementNS( svgNs, 'path' );
			path1.setAttribute( 'd', 'M15 3h6v6' );
			path1.setAttribute( 'stroke', '#fff' );
			path1.setAttribute( 'stroke-width', '2' );
			path1.setAttribute( 'stroke-linecap', 'round' );
			path1.setAttribute( 'stroke-linejoin', 'round' );
			svg.appendChild( path1 );

			// Bottom-left corner
			const path2 = document.createElementNS( svgNs, 'path' );
			path2.setAttribute( 'd', 'M9 21H3v-6' );
			path2.setAttribute( 'stroke', '#fff' );
			path2.setAttribute( 'stroke-width', '2' );
			path2.setAttribute( 'stroke-linecap', 'round' );
			path2.setAttribute( 'stroke-linejoin', 'round' );
			svg.appendChild( path2 );

			// Diagonal lines
			const line1 = document.createElementNS( svgNs, 'line' );
			line1.setAttribute( 'x1', '21' );
			line1.setAttribute( 'y1', '3' );
			line1.setAttribute( 'x2', '14' );
			line1.setAttribute( 'y2', '10' );
			line1.setAttribute( 'stroke', '#fff' );
			line1.setAttribute( 'stroke-width', '2' );
			line1.setAttribute( 'stroke-linecap', 'round' );
			svg.appendChild( line1 );

			const line2 = document.createElementNS( svgNs, 'line' );
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
	}

	// Export to namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.SlideController = SlideController;
		// Also expose at top level for backwards compatibility
		window.SlideController = SlideController;
	}

	// Export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SlideController;
	}
}() );
