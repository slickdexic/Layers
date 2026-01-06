/* eslint-env node */
/**
 * CustomShapeRenderer - Renders validated SVG path data to canvas
 *
 * Uses the Path2D API for efficient path rendering with full styling support.
 * All paths are validated before rendering through ShapePathValidator.
 *
 * @class
 */
class CustomShapeRenderer {
	/**
	 * Create a CustomShapeRenderer
	 *
	 * @param {Object} [options] - Renderer options
	 * @param {number} [options.cacheSize=100] - Maximum cached Path2D objects
	 */
	constructor( options = {} ) {
		/**
		 * LRU cache for Path2D objects keyed by path string
		 *
		 * @private
		 * @type {Map<string, Path2D>}
		 */
		this.pathCache = new Map();

		/**
		 * Maximum cache size
		 *
		 * @private
		 * @type {number}
		 */
		this.maxCacheSize = options.cacheSize || 100;
	}

	/**
	 * Get or create a Path2D object for a path string
	 *
	 * @private
	 * @param {string} pathData - SVG path data string
	 * @returns {Path2D} Path2D object
	 */
	getPath2D( pathData ) {
		// Check cache first
		if ( this.pathCache.has( pathData ) ) {
			// Move to end (LRU behavior)
			const path = this.pathCache.get( pathData );
			this.pathCache.delete( pathData );
			this.pathCache.set( pathData, path );
			return path;
		}

		// Create new Path2D
		const path = new Path2D( pathData );

		// Add to cache with LRU eviction
		if ( this.pathCache.size >= this.maxCacheSize ) {
			// Delete oldest entry (first in map)
			const oldestKey = this.pathCache.keys().next().value;
			this.pathCache.delete( oldestKey );
		}
		this.pathCache.set( pathData, path );

		return path;
	}

	/**
	 * Render a custom shape layer to the canvas
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {Object} shapeData - Shape definition from library (path, viewBox, fillRule)
	 * @param {Object} layer - Layer data (position, size, styling)
	 * @param {Object} [_options] - Render options (reserved for future use)
	 * @param {boolean} [_options.isSelected] - Whether layer is selected
	 * @param {number} [_options.scale] - Canvas scale factor
	 */
	render( ctx, shapeData, layer, _options = {} ) {
		if ( !shapeData || !shapeData.path || !shapeData.viewBox ) {
			// eslint-disable-next-line no-console
			console.warn( 'CustomShapeRenderer: Invalid shape data', shapeData );
			return;
		}

		const path = this.getPath2D( shapeData.path );
		const viewBox = shapeData.viewBox;

		// Calculate transform to fit shape into layer bounds
		const scaleX = ( layer.width || 100 ) / viewBox[ 2 ];
		const scaleY = ( layer.height || 100 ) / viewBox[ 3 ];

		ctx.save();

		// Apply layer position
		ctx.translate( layer.x || 0, layer.y || 0 );

		// Apply rotation if present
		if ( layer.rotation ) {
			const centerX = ( layer.width || 100 ) / 2;
			const centerY = ( layer.height || 100 ) / 2;
			ctx.translate( centerX, centerY );
			ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			ctx.translate( -centerX, -centerY );
		}

		// Apply scale to fit viewBox into layer dimensions
		ctx.scale( scaleX, scaleY );

		// Offset by viewBox origin
		ctx.translate( -viewBox[ 0 ], -viewBox[ 1 ] );

		// Apply fill
		if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' ) {
			ctx.fillStyle = layer.fill;
			ctx.globalAlpha = this.getOpacity( layer.fillOpacity, layer.opacity );
			ctx.fill( path, shapeData.fillRule || 'nonzero' );
		}

		// Apply stroke
		if ( layer.stroke && layer.stroke !== 'none' && layer.stroke !== 'transparent' ) {
			ctx.strokeStyle = layer.stroke;
			// Adjust stroke width for scale
			ctx.lineWidth = ( layer.strokeWidth || 1 ) / Math.min( scaleX, scaleY );
			ctx.globalAlpha = this.getOpacity( layer.strokeOpacity, layer.opacity );
			ctx.stroke( path );
		}

		ctx.restore();
	}

	/**
	 * Render with shadow effects
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {Object} shapeData - Shape definition from library
	 * @param {Object} layer - Layer data
	 * @param {Object} [options] - Render options
	 */
	renderWithEffects( ctx, shapeData, layer, options = {} ) {
		if ( !layer.shadow ) {
			return this.render( ctx, shapeData, layer, options );
		}

		ctx.save();

		// Apply shadow
		ctx.shadowColor = layer.shadowColor || 'rgba(0, 0, 0, 0.5)';
		ctx.shadowBlur = layer.shadowBlur || 10;
		ctx.shadowOffsetX = layer.shadowOffsetX || 5;
		ctx.shadowOffsetY = layer.shadowOffsetY || 5;

		this.render( ctx, layer, shapeData, options );

		ctx.restore();
	}

	/**
	 * Get effective opacity from layer properties
	 *
	 * @private
	 * @param {number|undefined} specificOpacity - Fill or stroke opacity
	 * @param {number|undefined} layerOpacity - Overall layer opacity
	 * @returns {number} Effective opacity (0-1)
	 */
	getOpacity( specificOpacity, layerOpacity ) {
		const specific = specificOpacity !== undefined ? specificOpacity : 1;
		const overall = layerOpacity !== undefined ? layerOpacity : 1;
		return specific * overall;
	}

	/**
	 * Test if a point is inside the shape
	 *
	 * @param {Object} layer - Layer data
	 * @param {Object} shapeData - Shape definition from library
	 * @param {number} x - Point X coordinate
	 * @param {number} y - Point Y coordinate
	 * @returns {boolean} True if point is inside shape
	 */
	hitTest( layer, shapeData, x, y ) {
		if ( !shapeData || !shapeData.path || !shapeData.viewBox ) {
			return false;
		}

		// Quick bounding box check first
		const layerX = layer.x || 0;
		const layerY = layer.y || 0;
		const layerWidth = layer.width || 100;
		const layerHeight = layer.height || 100;

		if ( x < layerX || x > layerX + layerWidth ||
			y < layerY || y > layerY + layerHeight ) {
			return false;
		}

		// Transform point to path coordinate space
		const viewBox = shapeData.viewBox;
		const scaleX = layerWidth / viewBox[ 2 ];
		const scaleY = layerHeight / viewBox[ 3 ];

		// Inverse transform
		let localX = ( x - layerX ) / scaleX + viewBox[ 0 ];
		let localY = ( y - layerY ) / scaleY + viewBox[ 1 ];

		// Handle rotation
		if ( layer.rotation ) {
			const centerX = layerWidth / 2;
			const centerY = layerHeight / 2;
			const radians = ( -layer.rotation * Math.PI ) / 180;
			const cos = Math.cos( radians );
			const sin = Math.sin( radians );

			const relX = x - layerX - centerX;
			const relY = y - layerY - centerY;

			const rotatedX = relX * cos - relY * sin + centerX;
			const rotatedY = relX * sin + relY * cos + centerY;

			localX = rotatedX / scaleX + viewBox[ 0 ];
			localY = rotatedY / scaleY + viewBox[ 1 ];
		}

		// Use Path2D and canvas context for accurate hit testing
		const path = this.getPath2D( shapeData.path );

		// Create temporary canvas for hit testing
		const canvas = document.createElement( 'canvas' );
		canvas.width = 1;
		canvas.height = 1;
		const ctx = canvas.getContext( '2d' );

		return ctx.isPointInPath( path, localX, localY, shapeData.fillRule || 'nonzero' );
	}

	/**
	 * Clear the path cache
	 */
	clearCache() {
		this.pathCache.clear();
	}

	/**
	 * Get current cache size
	 *
	 * @returns {number} Number of cached paths
	 */
	getCacheSize() {
		return this.pathCache.size;
	}
}

// Export for browser (MediaWiki ResourceLoader)
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.ShapeLibrary = window.Layers.ShapeLibrary || {};
	window.Layers.ShapeLibrary.CustomShapeRenderer = CustomShapeRenderer;
	window.CustomShapeRenderer = CustomShapeRenderer;
}

// Export for Node.js (Jest tests)
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = CustomShapeRenderer;
}
