/**
 * Image Loading Utility
 * Provides a clean, reliable way to load background images for the editor
 * Replaces the complex fallback mechanism in CanvasManager
 */

( function () {
	'use strict';

	/**
	 * Image Loader class
	 * @class
	 */
	function ImageLoader() {
		this.cache = new Map();
	}

	/**
	 * Load an image with proper error handling
	 * @param {string} imageUrl - Direct URL to the image
	 * @param {Object} options - Loading options
	 * @returns {Promise} Promise that resolves with the loaded image
	 */
	ImageLoader.prototype.loadImage = function ( imageUrl, options ) {
		options = options || {};
		var deferred = $.Deferred();
		var cacheKey = imageUrl + JSON.stringify( options );

		// Check cache first
		if ( this.cache.has( cacheKey ) ) {
			return $.Deferred().resolve( this.cache.get( cacheKey ) ).promise();
		}

		var img = new Image();
		var self = this;

		// Set crossOrigin if needed
		if ( options.crossOrigin ) {
			img.crossOrigin = options.crossOrigin;
		}

		img.onload = function () {
			// Cache the loaded image
			self.cache.set( cacheKey, img );
			deferred.resolve( img );
		};

		img.onerror = function () {
			deferred.reject( new Error( 'Failed to load image: ' + imageUrl ) );
		};

		// Set timeout if specified
		if ( options.timeout ) {
			setTimeout( function () {
				if ( deferred.state() === 'pending' ) {
					deferred.reject( new Error( 'Image loading timeout: ' + imageUrl ) );
				}
			}, options.timeout );
		}

		img.src = imageUrl;

		return deferred.promise();
	};

	/**
	 * Get the proper image URL from MediaWiki configuration
	 * This should be called from the backend and passed via mw.config
	 * @param {string} filename - The filename
	 * @param {number} width - Desired width (optional)
	 * @param {number} height - Desired height (optional)
	 * @returns {string} The image URL
	 */
	ImageLoader.prototype.getImageUrl = function ( filename, width, height ) {
		// Get the base URL from MediaWiki config (set by backend)
		var baseUrl = mw.config.get( 'wgLayersImageBaseUrl' );
		var imageUrl = mw.config.get( 'wgLayersCurrentImageUrl' );

		if ( imageUrl ) {
			// Backend provided direct URL - use it
			return imageUrl;
		}

		// Fallback: construct URL
		if ( baseUrl && filename ) {
			var url = baseUrl + encodeURIComponent( filename );
			
			// Add thumbnail parameters if specified
			if ( width || height ) {
				url += '?';
				if ( width ) {
					url += 'width=' + width;
				}
				if ( height ) {
					url += ( width ? '&' : '' ) + 'height=' + height;
				}
			}
			
			return url;
		}

		throw new Error( 'No image URL available. Backend should provide wgLayersCurrentImageUrl via mw.config.' );
	};

	/**
	 * Preload multiple images
	 * @param {Array} urls - Array of image URLs
	 * @param {Object} options - Loading options
	 * @returns {Promise} Promise that resolves when all images are loaded
	 */
	ImageLoader.prototype.preloadImages = function ( urls, options ) {
		var promises = urls.map( function ( url ) {
			return this.loadImage( url, options );
		}, this );

		return $.when.apply( $, promises );
	};

	/**
	 * Clear the image cache
	 */
	ImageLoader.prototype.clearCache = function () {
		this.cache.clear();
	};

	/**
	 * Get cache size
	 * @returns {number} Number of cached images
	 */
	ImageLoader.prototype.getCacheSize = function () {
		return this.cache.size;
	};

	// Export for use in other modules
	window.LayersImageLoader = ImageLoader;

}() );
