/**
 * ImageLoader - Handles background image loading for the Layers editor
 *
 * This module is responsible for:
 * - Loading background images from multiple sources (config, page, MediaWiki API)
 * - Fallback to test images when actual image unavailable
 * - Cross-origin handling
 *
 * @class ImageLoader
 */
( function () {
	'use strict';

	/**
	 * Timeout duration for image loading (ms)
	 *
	 * @type {number}
	 */
	const LOAD_TIMEOUT = 5000;

	/**
	 * Default placeholder image dimensions
	 *
	 * @type {Object}
	 */
	const PLACEHOLDER_SIZE = { width: 800, height: 600 };

	/**
	 * Safe logging helper that checks if mw.log is available
	 *
	 * @param {string} message - Message to log
	 * @private
	 */
	function safeLogWarn( message ) {
		if ( typeof mw !== 'undefined' && mw.log && typeof mw.log.warn === 'function' ) {
			mw.log.warn( message );
		}
	}

	/**
	 * ImageLoader class - handles background image loading with fallbacks
	 */
	class ImageLoader {
		/**
		 * Creates a new ImageLoader instance
		 *
		 * @param {Object} options - Configuration options
		 * @param {string} [options.filename] - The filename to load
		 * @param {string} [options.backgroundImageUrl] - Direct URL to background image
		 * @param {Function} [options.onLoad] - Callback when image loads successfully
		 * @param {Function} [options.onError] - Callback when all load attempts fail
		 */
		constructor( options ) {
			options = options || {};
			this.options = options;
			this.filename = options.filename || '';
			this.backgroundImageUrl = options.backgroundImageUrl || '';
			this.onLoad = options.onLoad || function () {};
			this.onError = options.onError || function () {};
			this.image = null;
			this.isLoading = false;
		}

		/**
		 * Start loading the background image
		 * Tries multiple sources in priority order
		 */
		load() {
			if ( this.isLoading ) {
				safeLogWarn( '[ImageLoader] Load already in progress' );
				return;
			}

			this.isLoading = true;
			const urls = this.buildUrlList();

			if ( urls.length > 0 ) {
				this.tryLoadImage( urls, 0 );
			} else {
				this.loadTestImage();
			}
		}

		/**
		 * Build a prioritized list of URLs to try loading
		 *
		 * @return {string[]} Array of URLs to try
		 */
		buildUrlList() {
			const imageUrls = [];
			const filename = this.filename;
			const currentOrigin = window.location.origin;

			// Priority 1: Use the specific background image URL from config
			if ( this.backgroundImageUrl ) {
				imageUrls.push( this.backgroundImageUrl );
			}

			// Priority 2: Try to find the current page image (same-origin, most reliable)
			const pageImages = document.querySelectorAll(
				'.mw-file-element img, .fullImageLink img, .filehistory img, img[src*="' + filename + '"]'
			);
			for ( let i = 0; i < pageImages.length; i++ ) {
				const imgSrc = pageImages[ i ].src;
				if ( imgSrc && imageUrls.indexOf( imgSrc ) === -1 ) {
					imageUrls.push( imgSrc );
				}
			}

			// Priority 3: Try MediaWiki patterns using CURRENT ORIGIN first (avoids CORS)
			// This handles the case where wgServer differs from the access URL
			if ( filename ) {
				const encodedFilename = encodeURIComponent( filename );

				// Try current origin paths first (same-origin, no CORS issues)
				const scriptPath = ( typeof mw !== 'undefined' && mw.config ) ?
					mw.config.get( 'wgScriptPath' ) : '';

				if ( scriptPath ) {
					// Special:Redirect/file endpoint using current origin
					imageUrls.push(
						currentOrigin + scriptPath + '/index.php?title=Special:Redirect/file/' + encodedFilename
					);
				}

				// Priority 4: Try wgServer-based URLs as fallback (may require CORS)
				if ( typeof mw !== 'undefined' && mw && mw.config ) {
					const server = mw.config.get( 'wgServer' );
					const articlePath = mw.config.get( 'wgArticlePath' );

					// Only add wgServer URLs if they differ from current origin
					if ( server && server !== currentOrigin ) {
						if ( scriptPath ) {
							// Special:Redirect/file endpoint
							imageUrls.push(
								server + scriptPath + '/index.php?title=Special:Redirect/file/' + encodedFilename
							);

							// Direct File: page
							imageUrls.push(
								server + scriptPath + '/index.php?title=File:' + encodedFilename
							);
						}

						// Article path format
						if ( articlePath ) {
							imageUrls.push(
								server + articlePath.replace( '$1', 'File:' + encodedFilename )
							);
						}
					}
				}
			}

			return imageUrls;
		}

		/**
		 * Check if a URL is same-origin
		 *
		 * @param {string} url - URL to check
		 * @return {boolean} True if same-origin
		 */
		isSameOrigin( url ) {
			try {
				const urlObj = new URL( url, window.location.origin );
				return urlObj.origin === window.location.origin;
			} catch ( e ) {
				// Relative URLs are same-origin
				return !url.startsWith( 'http://' ) && !url.startsWith( 'https://' ) && !url.startsWith( '//' );
			}
		}

		/**
		 * Try to load an image from a list of URLs
		 *
		 * @param {string[]} urls - Array of URLs to try
		 * @param {number} index - Current index in the array
		 * @param {boolean} [withCors=false] - Whether to retry with crossOrigin after failure
		 */
		tryLoadImage( urls, index, withCors = false ) {
			if ( index >= urls.length ) {
				// All URLs failed, try test image
				this.loadTestImage();
				return;
			}

			const currentUrl = urls[ index ];
			const isSameOrigin = this.isSameOrigin( currentUrl );
			this.image = new Image();

			// Only set crossOrigin for cross-origin URLs, and only if explicitly requested
			// Setting crossOrigin on same-origin requests is unnecessary and can cause issues
			if ( !isSameOrigin && withCors ) {
				this.image.crossOrigin = 'anonymous';
			}

			this.image.onload = () => {
				this.isLoading = false;
				this.onLoad( this.image, {
					width: this.image.width,
					height: this.image.height,
					source: 'url',
					url: currentUrl,
					isCrossOrigin: !isSameOrigin
				} );
			};

			this.image.onerror = () => {
				// If cross-origin failed without CORS, try with CORS
				// (in case server does support CORS but we need to request it)
				if ( !isSameOrigin && !withCors ) {
					this.tryLoadImage( urls, index, true );
				} else {
					// Try next URL
					this.tryLoadImage( urls, index + 1, false );
				}
			};

			this.image.src = currentUrl;
		}

		/**
		 * Load a test/placeholder image when actual image unavailable
		 */
		loadTestImage() {
			const svgData = this.createTestImageSvg( this.filename );
			const svgDataUrl = 'data:image/svg+xml;base64,' + btoa( svgData );

			this.image = new Image();
			this.image.crossOrigin = 'anonymous';

			this.image.onload = () => {
				this.isLoading = false;
				this.onLoad( this.image, {
					width: PLACEHOLDER_SIZE.width,
					height: PLACEHOLDER_SIZE.height,
					source: 'test',
					isPlaceholder: true
				} );
			};

			this.image.onerror = () => {
				this.isLoading = false;
				// Even SVG failed - call error handler
				safeLogWarn( '[ImageLoader] All image loading attempts failed' );
				this.onError( new Error( 'Failed to load any image' ) );
			};

			this.image.src = svgDataUrl;

			// Set a timeout fallback
			setTimeout( () => {
				if ( this.isLoading ) {
					this.isLoading = false;
					this.onError( new Error( 'Image load timeout' ) );
				}
			}, LOAD_TIMEOUT );
		}

		/**
		 * Create an SVG test image
		 *
		 * @param {string} filename - The filename to display
		 * @return {string} SVG markup
		 */
		createTestImageSvg( filename ) {
			const escapeMap = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
			const safeFilename = ( filename || 'Sample Image' )
				.replace( /[<>&"]/g, function ( match ) {
					return escapeMap[ match ];
				} );

			return '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">' +
				'<rect width="100%" height="100%" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>' +
				'<text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#495057">' +
				safeFilename + '</text>' +
				'<text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#6c757d">' +
				'Sample Image for Layer Editing</text>' +
				'<circle cx="200" cy="150" r="50" fill="none" stroke="#e9ecef" stroke-width="2"/>' +
				'<rect x="500" y="300" width="100" height="80" fill="none" stroke="#e9ecef" stroke-width="2"/>' +
				'<line x1="100" y1="400" x2="300" y2="500" stroke="#e9ecef" stroke-width="2"/>' +
				'<text x="50%" y="85%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#adb5bd">' +
				'Draw shapes and text using the tools above</text>' +
				'</svg>';
		}

		/**
		 * Get the loaded image
		 *
		 * @return {HTMLImageElement|null} The loaded image or null
		 */
		getImage() {
			return this.image;
		}

		/**
		 * Check if loading is in progress
		 *
		 * @return {boolean} True if loading
		 */
		isLoadingImage() {
			return this.isLoading;
		}

		/**
		 * Abort any pending load operation
		 */
		abort() {
			if ( this.image ) {
				this.image.onload = null;
				this.image.onerror = null;
				this.image.src = '';
			}
			this.isLoading = false;
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.abort();
			this.image = null;
			this.onLoad = null;
			this.onError = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.ImageLoader = ImageLoader;
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = ImageLoader;
	}

}() );
