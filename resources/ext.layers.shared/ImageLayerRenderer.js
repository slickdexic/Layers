/**
 * ImageLayerRenderer - Renders image layers with caching and placeholder support
 *
 * Extracted from LayerRenderer.js to prevent that file from exceeding 1,000 lines.
 * This module handles:
 * - Image layer rendering with opacity, rotation, and shadow support
 * - LRU caching of loaded images (max defined by LayerDefaults)
 * - Placeholder display while images are loading
 *
 * @module ImageLayerRenderer
 * @since 1.5.0
 */
( function () {
	'use strict';

	// Default values fallback (for test environments where mw.ext may not be fully mocked)
	const DEFAULT_VALUES = {
		MAX_IMAGE_CACHE_SIZE: 50
	};

	// Import defaults from centralized constants (lazy-loaded, with fallback for tests)
	const getDefaults = () => {
		if ( typeof mw !== 'undefined' && mw.ext && mw.ext.layers && mw.ext.layers.LayerDefaults ) {
			return mw.ext.layers.LayerDefaults;
		}
		return DEFAULT_VALUES;
	};

	/**
	 * ImageLayerRenderer class - Renders image layers on a canvas
	 */
	class ImageLayerRenderer {
		/**
		 * Creates a new ImageLayerRenderer instance
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
		 * @param {Object} [config] - Configuration options
		 * @param {Object} [config.shadowRenderer] - ShadowRenderer instance for shadow effects
		 * @param {Function} [config.onImageLoad] - Callback when an image finishes loading
		 */
		constructor( ctx, config ) {
			this.ctx = ctx;
			this.config = config || {};
			this.shadowRenderer = this.config.shadowRenderer || null;
			this.onImageLoad = this.config.onImageLoad || null;

			// LRU cache for loaded images
			this._imageCache = new Map();
		}

		/**
		 * Set or update the shadow renderer
		 *
		 * @param {Object} shadowRenderer - ShadowRenderer instance
		 */
		setShadowRenderer( shadowRenderer ) {
			this.shadowRenderer = shadowRenderer;
		}

		/**
		 * Set or update the image load callback
		 *
		 * @param {Function} callback - Callback function
		 */
		setOnImageLoad( callback ) {
			this.onImageLoad = callback;
		}

		/**
		 * Set the canvas context (for context switching, e.g., export)
		 *
		 * @param {CanvasRenderingContext2D} ctx - New canvas context
		 */
		setContext( ctx ) {
			this.ctx = ctx;
		}

		/**
		 * Draw an image layer
		 *
		 * @param {Object} layer - Image layer with src, x, y, width, height properties
		 * @param {Object} [options] - Rendering options
		 * @param {Object} [options.scale] - Scale factors { sx, sy }
		 * @param {Object} [options.shadowScale] - Shadow scale factors for viewer mode
		 */
		draw( layer, options ) {
			const opts = options || {};
			const scale = opts.scale || { sx: 1, sy: 1 };

			// Get the cached image, or load it if not cached
			const img = this._getImageElement( layer );
			if ( !img || !img.complete || ( img.naturalWidth === 0 && img.naturalHeight === 0 ) ) {
				// Image not ready yet or failed to load - draw a placeholder
				this._drawPlaceholder( layer, scale );
				return;
			}

			// Calculate scaled position and dimensions
			const x = ( layer.x || 0 ) * scale.sx;
			const y = ( layer.y || 0 ) * scale.sy;
			const width = ( layer.width || img.naturalWidth ) * scale.sx;
			const height = ( layer.height || img.naturalHeight ) * scale.sy;

			this.ctx.save();

			// Apply opacity if specified
			if ( layer.opacity !== undefined && layer.opacity !== 1 ) {
				this.ctx.globalAlpha = layer.opacity;
			}

			// Apply rotation if specified
			if ( layer.rotation ) {
				const centerX = x + width / 2;
				const centerY = y + height / 2;
				this.ctx.translate( centerX, centerY );
				this.ctx.rotate( layer.rotation * Math.PI / 180 );
				this.ctx.translate( -centerX, -centerY );
			}

			// Apply shadow if enabled
			// Use shadowScale from options if provided (for viewer scaling), otherwise use 1:1 scale
			const shadowScale = opts.shadowScale || { sx: 1, sy: 1, avg: 1 };
			if ( this.shadowRenderer && this.shadowRenderer.hasShadowEnabled( layer ) ) {
				this.shadowRenderer.applyShadow( layer, shadowScale );
			}

			// Draw the image
			this.ctx.drawImage( img, x, y, width, height );

			// Clear shadow after drawing
			if ( this.shadowRenderer ) {
				this.shadowRenderer.clearShadow();
			}

			this.ctx.restore();
		}

		/**
		 * Get the maximum cache size
		 *
		 * @return {number} Maximum number of cached images
		 */
		static get MAX_CACHE_SIZE() {
			return getDefaults().MAX_IMAGE_CACHE_SIZE;
		}

		/**		 * Generate a simple hash from a string for cache keys
		 * Uses djb2 algorithm - fast and produces good distribution
		 *
		 * @private
		 * @param {string} str - String to hash
		 * @return {string} Hash string prefixed with 'img_'
		 */
		_hashString( str ) {
			let hash = 5381;
			for ( let i = 0; i < str.length; i++ ) {
				// hash * 33 + char (djb2 algorithm)
				hash = ( ( hash << 5 ) + hash ) + str.charCodeAt( i );
				hash |= 0; // Convert to 32-bit integer
			}
			// Convert to base36 for shorter key, make positive
			return 'img_' + ( hash >>> 0 ).toString( 36 );
		}

		/**		 * Get or create cached image element for a layer
		 *
		 * @param {Object} layer - Image layer
		 * @return {HTMLImageElement|null} - Image element or null if not available
		 */
		_getImageElement( layer ) {
			if ( !layer.src ) {
				return null;
			}

			// Use layer id + src hash as cache key so changing src invalidates cache,
			// or hash the src alone for layers without an id
			const cacheKey = layer.id
				? ( layer.id + '_' + this._hashString( layer.src ) )
				: this._hashString( layer.src );

			if ( this._imageCache.has( cacheKey ) ) {
				// Move to end for LRU tracking (delete and re-add)
				const img = this._imageCache.get( cacheKey );
				this._imageCache.delete( cacheKey );
				this._imageCache.set( cacheKey, img );
				return img;
			}

			// Evict oldest entry if cache is full (LRU eviction)
			if ( this._imageCache.size >= getDefaults().MAX_IMAGE_CACHE_SIZE ) {
				const oldestKey = this._imageCache.keys().next().value;
				this._imageCache.delete( oldestKey );
			}

			// Create new image element and start loading
			const img = new Image();
			this._imageCache.set( cacheKey, img );

			// Request redraw when image loads
			img.onload = () => {
				// Use the configured callback (preferred)
				if ( this.onImageLoad && typeof this.onImageLoad === 'function' ) {
					this.onImageLoad();
				}
				// Fallback to global requestRedraw if available
				else if ( typeof window !== 'undefined' && window.Layers && window.Layers.requestRedraw ) {
					window.Layers.requestRedraw();
				}
			};

			// Handle load errors gracefully
			img.onerror = () => {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[ImageLayerRenderer] Failed to load image layer:', cacheKey );
				}
			};

			// Set src after handlers to ensure events fire
			img.src = layer.src;

			return img;
		}

		/**
		 * Draw a placeholder while image is loading
		 *
		 * @param {Object} layer - Image layer
		 * @param {Object} scale - Scale factors { sx, sy }
		 */
		_drawPlaceholder( layer, scale ) {
			const x = ( layer.x || 0 ) * scale.sx;
			const y = ( layer.y || 0 ) * scale.sy;
			const width = ( layer.width || 100 ) * scale.sx;
			const height = ( layer.height || 100 ) * scale.sy;

			this.ctx.save();
			this.ctx.strokeStyle = '#888';
			this.ctx.lineWidth = 1;
			this.ctx.setLineDash( [ 5, 5 ] );
			this.ctx.strokeRect( x, y, width, height );

			// Draw loading indicator (diagonal lines)
			this.ctx.beginPath();
			this.ctx.moveTo( x, y );
			this.ctx.lineTo( x + width, y + height );
			this.ctx.moveTo( x + width, y );
			this.ctx.lineTo( x, y + height );
			this.ctx.stroke();
			this.ctx.restore();
		}

		/**
		 * Clear the image cache
		 */
		clearCache() {
			this._imageCache.clear();
		}

		/**
		 * Get the current cache size
		 *
		 * @return {number} Number of cached images
		 */
		getCacheSize() {
			return this._imageCache ? this._imageCache.size : 0;
		}

		/**
		 * Check if an image is cached
		 *
		 * @param {string} layerId - Layer ID or cache key
		 * @return {boolean} True if cached
		 */
		isCached( layerId ) {
			return this._imageCache && this._imageCache.has( layerId );
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			if ( this._imageCache ) {
				this._imageCache.clear();
				this._imageCache = null;
			}
			this.ctx = null;
			this.shadowRenderer = null;
			this.onImageLoad = null;
		}
	}

	// Export to namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.ImageLayerRenderer = ImageLayerRenderer;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = ImageLayerRenderer;
	}
}() );
