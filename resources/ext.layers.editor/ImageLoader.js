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
	 * Creates a new ImageLoader instance
	 *
	 * @constructor
	 * @param {Object} options - Configuration options
	 * @param {string} [options.filename] - The filename to load
	 * @param {string} [options.backgroundImageUrl] - Direct URL to background image
	 * @param {Function} [options.onLoad] - Callback when image loads successfully
	 * @param {Function} [options.onError] - Callback when all load attempts fail
	 */
	function ImageLoader( options ) {
		this.options = options || {};
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
	 *
	 * @return {void}
	 */
	ImageLoader.prototype.load = function () {
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
	};

	/**
	 * Build a prioritized list of URLs to try loading
	 *
	 * @return {string[]} Array of URLs to try
	 */
	ImageLoader.prototype.buildUrlList = function () {
		const imageUrls = [];
		const filename = this.filename;

		// Priority 1: Use the specific background image URL from config
		if ( this.backgroundImageUrl ) {
			imageUrls.push( this.backgroundImageUrl );
		}

		// Priority 2: Try to find the current page image
		const pageImages = document.querySelectorAll(
			'.mw-file-element img, .fullImageLink img, .filehistory img, img[src*="' + filename + '"]'
		);
		for ( let i = 0; i < pageImages.length; i++ ) {
			const imgSrc = pageImages[ i ].src;
			if ( imgSrc && imageUrls.indexOf( imgSrc ) === -1 ) {
				imageUrls.push( imgSrc );
			}
		}

		// Priority 3: Try MediaWiki patterns if mw is available
		if ( filename && typeof mw !== 'undefined' && mw && mw.config ) {
			const server = mw.config.get( 'wgServer' );
			const scriptPath = mw.config.get( 'wgScriptPath' );
			const articlePath = mw.config.get( 'wgArticlePath' );

			if ( server && scriptPath ) {
				const encodedFilename = encodeURIComponent( filename );

				// Special:Redirect/file endpoint
				imageUrls.push(
					server + scriptPath + '/index.php?title=Special:Redirect/file/' + encodedFilename
				);

				// Direct File: page
				imageUrls.push(
					server + scriptPath + '/index.php?title=File:' + encodedFilename
				);

				// Article path format
				if ( articlePath ) {
					imageUrls.push(
						server + articlePath.replace( '$1', 'File:' + encodedFilename )
					);
				}
			}
		}

		return imageUrls;
	};

	/**
	 * Try to load an image from a list of URLs
	 *
	 * @param {string[]} urls - Array of URLs to try
	 * @param {number} index - Current index in the array
	 * @return {void}
	 */
	ImageLoader.prototype.tryLoadImage = function ( urls, index ) {
		const self = this;

		if ( index >= urls.length ) {
			// All URLs failed, try test image
			this.loadTestImage();
			return;
		}

		const currentUrl = urls[ index ];
		this.image = new Image();
		this.image.crossOrigin = 'anonymous';

		this.image.onload = function () {
			self.isLoading = false;
			self.onLoad( self.image, {
				width: self.image.width,
				height: self.image.height,
				source: 'url',
				url: currentUrl
			} );
		};

		this.image.onerror = function () {
			// Try next URL
			self.tryLoadImage( urls, index + 1 );
		};

		this.image.src = currentUrl;
	};

	/**
	 * Load a test/placeholder image when actual image unavailable
	 *
	 * @return {void}
	 */
	ImageLoader.prototype.loadTestImage = function () {
		const self = this;
		const svgData = this.createTestImageSvg( this.filename );
		const svgDataUrl = 'data:image/svg+xml;base64,' + btoa( svgData );

		this.image = new Image();
		this.image.crossOrigin = 'anonymous';

		this.image.onload = function () {
			self.isLoading = false;
			self.onLoad( self.image, {
				width: 800,
				height: 600,
				source: 'test',
				isPlaceholder: true
			} );
		};

		this.image.onerror = function () {
			self.isLoading = false;
			// Even SVG failed - call error handler
			safeLogWarn( '[ImageLoader] All image loading attempts failed' );
			self.onError( new Error( 'Failed to load any image' ) );
		};

		this.image.src = svgDataUrl;

		// Set a timeout fallback
		setTimeout( function () {
			if ( self.isLoading ) {
				self.isLoading = false;
				self.onError( new Error( 'Image load timeout' ) );
			}
		}, 5000 );
	};

	/**
	 * Create an SVG test image
	 *
	 * @param {string} filename - The filename to display
	 * @return {string} SVG markup
	 */
	ImageLoader.prototype.createTestImageSvg = function ( filename ) {
		const safeFilename = ( filename || 'Sample Image' ).replace( /[<>&"]/g, function ( match ) {
			return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ match ];
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
	};

	/**
	 * Get the loaded image
	 *
	 * @return {HTMLImageElement|null} The loaded image or null
	 */
	ImageLoader.prototype.getImage = function () {
		return this.image;
	};

	/**
	 * Check if loading is in progress
	 *
	 * @return {boolean} True if loading
	 */
	ImageLoader.prototype.isLoadingImage = function () {
		return this.isLoading;
	};

	/**
	 * Abort any pending load operation
	 *
	 * @return {void}
	 */
	ImageLoader.prototype.abort = function () {
		if ( this.image ) {
			this.image.onload = null;
			this.image.onerror = null;
			this.image.src = '';
		}
		this.isLoading = false;
	};

	/**
	 * Clean up resources
	 *
	 * @return {void}
	 */
	ImageLoader.prototype.destroy = function () {
		this.abort();
		this.image = null;
		this.onLoad = null;
		this.onError = null;
	};

	// Export to window for MediaWiki ResourceLoader
	window.ImageLoader = ImageLoader;

}() );
