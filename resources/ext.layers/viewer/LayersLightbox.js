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
		 */
		open( config ) {
			if ( this.isOpen ) {
				this.close();
			}

			this.debugLog( 'Opening lightbox for:', config.filename );

			// Create overlay structure
			this.createOverlay();

			// Show loading state
			this.showLoading();

			// If we have layer data, render immediately
			if ( config.layerData && config.imageUrl ) {
				this.renderViewer( config.imageUrl, config.layerData );
			} else {
				// Fetch via API
				this.fetchAndRender( config.filename, config.setName );
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

			// Assemble structure
			this.container.appendChild( closeBtn );
			this.container.appendChild( this.imageWrapper );
			this.overlay.appendChild( this.container );
			document.body.appendChild( this.overlay );

			// Add event listeners
			this.boundKeyHandler = ( e ) => this.handleKeyDown( e );
			this.boundClickHandler = ( e ) => this.handleClick( e );

			document.addEventListener( 'keydown', this.boundKeyHandler );
			this.overlay.addEventListener( 'click', this.boundClickHandler );
			closeBtn.addEventListener( 'click', () => this.close() );

			// Prevent body scroll
			document.body.style.overflow = 'hidden';

			// Force reflow and add visible class for animation
			this.overlay.offsetHeight;
			this.overlay.classList.add( 'layers-lightbox-visible' );
		}

		/**
		 * Show loading indicator
		 * @private
		 */
		showLoading() {
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
		fetchAndRender( filename, setName ) {
			if ( typeof mw === 'undefined' || !mw.Api ) {
				this.showError( 'API not available' );
				return;
			}

			const api = new mw.Api();
			const params = {
				action: 'layersinfo',
				filename: filename,
				format: 'json'
			};

			if ( setName && setName !== 'on' && setName !== 'default' ) {
				params.setname = setName;
			}

			api.get( params ).then( ( data ) => {
				if ( !data || !data.layersinfo ) {
					this.showError( 'No layer data found' );
					return;
				}

				const layersInfo = data.layersinfo;
				if ( !layersInfo.layerset ) {
					this.showError( 'No layer set found' );
					return;
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

				// Get full-size image URL
				// Try to construct from known patterns
				const imageUrl = this.resolveFullImageUrl( filename );

				this.renderViewer( imageUrl, layerData );

			} ).catch( ( error ) => {
				this.debugLog( 'API error:', error );
				this.showError( 'Failed to load layer data' );
			} );
		}

		/**
		 * Resolve full-size image URL from filename
		 *
		 * @param {string} filename The filename
		 * @return {string} Full image URL
		 * @private
		 */
		resolveFullImageUrl( filename ) {
			// Try to get from MediaWiki config
			if ( typeof mw !== 'undefined' && mw.config ) {
				const uploadPath = mw.config.get( 'wgUploadPath' );
				if ( uploadPath ) {
					// Build hash path for MediaWiki uploads
					const hash1 = this.md5First2( filename );
					return uploadPath + '/' + hash1.charAt( 0 ) + '/' + hash1 + '/' +
						encodeURIComponent( filename );
				}
			}

			// Fallback: use Special:Redirect
			return mw.util.getUrl( 'Special:Redirect/file/' + encodeURIComponent( filename ) );
		}

		/**
		 * Simple hash function for MediaWiki's file path structure
		 * Returns first two characters of MD5 hash
		 *
		 * @param {string} filename The filename
		 * @return {string} First two hex characters
		 * @private
		 */
		md5First2( filename ) {
			// Simple approach: use first two chars of filename
			// This is a fallback; in production MediaWiki calculates actual MD5
			const clean = filename.replace( /[^a-zA-Z0-9]/g, '' ).toLowerCase();
			return clean.substring( 0, 2 ) || 'aa';
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
			if ( layerData.backgroundVisible === false ) {
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
			if ( e.key === 'Escape' ) {
				e.preventDefault();
				this.close();
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
		 */
		close() {
			if ( !this.isOpen || !this.overlay ) {
				return;
			}

			this.debugLog( 'Closing lightbox' );

			// Clean up viewer
			if ( this.viewer && typeof this.viewer.destroy === 'function' ) {
				this.viewer.destroy();
				this.viewer = null;
			}

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

			// Animate out
			this.overlay.classList.remove( 'layers-lightbox-visible' );

			// Cancel any pending close timeout
			if ( this.closeTimeoutId ) {
				clearTimeout( this.closeTimeoutId );
			}

			// Remove after animation
			this.closeTimeoutId = setTimeout( () => {
				this.closeTimeoutId = null;
				if ( this.overlay && this.overlay.parentNode ) {
					this.overlay.parentNode.removeChild( this.overlay );
				}
				this.overlay = null;
				this.container = null;
				this.imageWrapper = null;

				// Restore body scroll
				document.body.style.overflow = '';
			}, 300 );

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

					if ( filename ) {
						this.open( {
							filename: filename,
							setName: setName,
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
			// Try href first
			const href = trigger.getAttribute( 'href' ) || '';

			// Match File:Name.ext pattern
			const fileMatch = href.match( /\/File:([^?#]+)/ );
			if ( fileMatch ) {
				return decodeURIComponent( fileMatch[ 1 ].replace( /_/g, ' ' ) );
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
					let name = decodeURIComponent( srcMatch[ 1 ] );
					// Remove thumbnail prefix
					name = name.replace( /^\d+px-/, '' );
					return name;
				}
			}

			return null;
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
