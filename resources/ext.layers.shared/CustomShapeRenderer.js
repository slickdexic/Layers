/* eslint-env node */
/**
 * CustomShapeRenderer - Renders SVG shapes to canvas
 *
 * Supports two rendering modes:
 * 1. Complete SVG markup (new format) - renders via Image for pixel-perfect quality
 * 2. Path2D API (legacy format) - for shapes defined with just path data
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
		 * Cache for SVG Image objects keyed by SVG string hash
		 *
		 * @private
		 * @type {Map<string, HTMLImageElement>}
		 */
		this.svgImageCache = new Map();

		/**
		 * Set of cache keys currently being loaded
		 * Prevents duplicate loads during async image creation
		 *
		 * @private
		 * @type {Set<string>}
		 */
		this.pendingLoads = new Set();

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
	 * Supports three formats:
	 * 1. Complete SVG string (new format) - rendered via Image for native quality
	 * 2. Multi-path shapes (legacy compound) - uses paths array
	 * 3. Single-path shapes (legacy) - uses Path2D
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {Object} shapeData - Shape definition from library
	 * @param {string} [shapeData.svg] - Complete SVG markup string (new format)
	 * @param {string} [shapeData.path] - Single path (legacy format)
	 * @param {Array} [shapeData.paths] - Multi-path array [{path, fill, stroke, strokeWidth, fillRule}]
	 * @param {number[]} shapeData.viewBox - ViewBox [x, y, width, height]
	 * @param {Object} layer - Layer data (position, size, styling)
	 * @param {Object} [_options] - Render options (reserved for future use)
	 * @param {boolean} [_options.isSelected] - Whether layer is selected
	 * @param {number} [_options.scale] - Canvas scale factor
	 */
	render( ctx, shapeData, layer, _options = {} ) {
		if ( !shapeData ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( 'CustomShapeRenderer: Missing shape data' );
			}
			return;
		}

		// New format: complete SVG string - render as Image
		if ( shapeData.svg ) {
			return this.renderSVG( ctx, shapeData, layer, _options );
		}

		// Legacy: multi-path shapes
		if ( shapeData.paths && Array.isArray( shapeData.paths ) ) {
			return this.renderMultiPath( ctx, shapeData, layer, _options );
		}

		// Legacy: single-path shapes
		if ( !shapeData.path || !shapeData.viewBox ) {
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( 'CustomShapeRenderer: Invalid shape data' );
			}
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

		// For stroke-only shapes, set line properties
		if ( shapeData.strokeOnly ) {
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
		}

		// Apply fill (skip for stroke-only shapes)
		if ( !shapeData.strokeOnly && layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' ) {
			ctx.fillStyle = layer.fill;
			ctx.globalAlpha = this.getOpacity( layer.fillOpacity, layer.opacity );
			ctx.fill( path, shapeData.fillRule || 'nonzero' );
		}

		// Apply stroke
		if ( layer.stroke && layer.stroke !== 'none' && layer.stroke !== 'transparent' ) {
			ctx.strokeStyle = layer.stroke;
			// Adjust stroke width for scale
			ctx.lineWidth = ( layer.strokeWidth || ( shapeData.strokeOnly ? 2 : 1 ) ) / Math.min( scaleX, scaleY );
			ctx.globalAlpha = this.getOpacity( layer.strokeOpacity, layer.opacity );
			ctx.stroke( path );
		}

		ctx.restore();
	}

	/**
	 * Render a complete SVG markup string to canvas via Image
	 *
	 * This method uses the browser's native SVG renderer for pixel-perfect quality.
	 * The SVG is converted to a data URL, loaded as an Image, and drawn to canvas.
	 *
	 * @private
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {Object} shapeData - Shape definition with svg string
	 * @param {Object} layer - Layer data
	 * @param {Object} [_options] - Render options
	 */
	renderSVG( ctx, shapeData, layer, _options = {} ) {
		const layerWidth = layer.width || 100;
		const layerHeight = layer.height || 100;
		const layerX = layer.x || 0;
		const layerY = layer.y || 0;

		// Build a compact cache key from shape ID and style properties.
		// Do NOT use the full SVG string - it can be thousands of characters
		// and Map key comparison would be O(n) on every lookup.
		// Do NOT include size - SVGs scale perfectly.
		// Do NOT include strokeWidth - we don't modify stroke-width in SVG shapes.
		const shapeId = shapeData.id || layer.shapeId || layer.id || '';
		const stroke = layer.stroke || '';
		const fill = layer.fill || '';
		const cacheKey = `${ shapeId }|${ stroke }|${ fill }`;

		// Check if we have a cached image FIRST, before doing any string manipulation
		if ( this.svgImageCache.has( cacheKey ) ) {
			// Draw the cached image - this is the fast path
			// No LRU reordering - not worth the overhead for ~100 items
			this.drawSVGImage( ctx, this.svgImageCache.get( cacheKey ), layer, _options );
			return;
		}

		// If already loading this shape, just draw placeholder and wait
		// This prevents a cascade of duplicate loads during drag/resize
		if ( this.pendingLoads.has( cacheKey ) ) {
			ctx.save();
			ctx.strokeStyle = '#ccc';
			ctx.lineWidth = 1;
			ctx.setLineDash( [ 4, 4 ] );
			ctx.strokeRect( layerX, layerY, layerWidth, layerHeight );
			ctx.restore();
			return;
		}

		// Mark as loading to prevent duplicate requests
		this.pendingLoads.add( cacheKey );

		// Cache miss - need to create the image (slow path, only happens once per shape)
		// Apply stroke color by replacing currentColor in SVG
		let svgString = shapeData.svg;
		if ( layer.stroke && layer.stroke !== 'none' ) {
			svgString = svgString.replace( /stroke="currentColor"/g, `stroke="${ layer.stroke }"` );
		}
		if ( layer.fill && layer.fill !== 'none' && layer.fill !== 'transparent' ) {
			svgString = svgString.replace( /fill="currentColor"/g, `fill="${ layer.fill }"` );
		}

		// NOTE: We intentionally do NOT override stroke-width here.
		// SVG shapes from the library have their stroke-width values designed
		// to scale correctly with the viewBox. Replacing them with layer.strokeWidth
		// (which defaults to 2) would make the strokes appear pencil-thin.
		// The stroke-width in the SVG coordinate system scales proportionally
		// when the image is drawn to the layer dimensions.

		// Convert SVG to data URL
		const svgBlob = new Blob( [ svgString ], { type: 'image/svg+xml;charset=utf-8' } );
		const url = URL.createObjectURL( svgBlob );

		// Create image and draw when loaded
		const img = new Image();
		img.onload = () => {
			// Remove from pending
			this.pendingLoads.delete( cacheKey );

			// Cache the loaded image
			if ( this.svgImageCache.size >= this.maxCacheSize ) {
				const oldestKey = this.svgImageCache.keys().next().value;
				this.svgImageCache.delete( oldestKey );
			}
			this.svgImageCache.set( cacheKey, img );

			// Draw the image
			this.drawSVGImage( ctx, img, layer, _options );

			// Clean up blob URL
			URL.revokeObjectURL( url );

			// Request re-render if we have a callback
			if ( _options.onLoad ) {
				_options.onLoad();
			}
		};
		img.onerror = () => {
			// Remove from pending on error too
			this.pendingLoads.delete( cacheKey );
			URL.revokeObjectURL( url );
			if ( typeof mw !== 'undefined' && mw.log ) {
				mw.log.warn( 'CustomShapeRenderer: Failed to load SVG as image' );
			}
		};
		img.src = url;

		// Draw placeholder rectangle while loading
		ctx.save();
		ctx.strokeStyle = '#ccc';
		ctx.lineWidth = 1;
		ctx.setLineDash( [ 4, 4 ] );
		ctx.strokeRect( layerX, layerY, layerWidth, layerHeight );
		ctx.restore();
	}

	/**
	 * Draw an SVG image to canvas with layer transforms and shadow support
	 *
	 * @private
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {HTMLImageElement} img - Loaded image
	 * @param {Object} layer - Layer data
	 * @param {Object} [options] - Render options including scale
	 */
	drawSVGImage( ctx, img, layer, options = {} ) {
		const layerWidth = layer.width || 100;
		const layerHeight = layer.height || 100;
		const layerX = layer.x || 0;
		const layerY = layer.y || 0;

		// Get shadow scale factor (used on article pages for proper scaling)
		// Prefer shadowScale over scale for consistency with other renderers
		const shadowScale = options.shadowScale || options.scale || { sx: 1, sy: 1, avg: 1 };
		const scaleAvg = shadowScale.avg || 1;

		ctx.save();

		// Apply opacity
		const baseOpacity = layer.opacity !== undefined ? layer.opacity : 1;
		ctx.globalAlpha = baseOpacity;

		// Apply rotation if present
		if ( layer.rotation ) {
			const centerX = layerX + layerWidth / 2;
			const centerY = layerY + layerHeight / 2;
			ctx.translate( centerX, centerY );
			ctx.rotate( ( layer.rotation * Math.PI ) / 180 );
			ctx.translate( -centerX, -centerY );
		}

		// Apply shadow if enabled
		if ( this.hasShadowEnabled( layer ) ) {
			// Get unscaled values, then apply scale for article page rendering
			const spreadUnscaled = this.getShadowSpread( layer );
			const shadowColor = layer.shadowColor || 'rgba(0, 0, 0, 0.5)';
			// Use typeof check to allow 0 values (|| treats 0 as falsy)
			const blurUnscaled = typeof layer.shadowBlur === 'number' ? layer.shadowBlur : 10;
			const offsetXUnscaled = typeof layer.shadowOffsetX === 'number' ? layer.shadowOffsetX : 0;
			const offsetYUnscaled = typeof layer.shadowOffsetY === 'number' ? layer.shadowOffsetY : 0;

			// Apply scale to shadow properties (important for article page viewing)
			const spread = spreadUnscaled * scaleAvg;
			const shadowBlur = blurUnscaled * scaleAvg;
			const shadowOffsetX = offsetXUnscaled * ( shadowScale.sx || scaleAvg );
			const shadowOffsetY = offsetYUnscaled * ( shadowScale.sy || scaleAvg );

			if ( spread > 0 ) {
				// For spread shadows, we need to draw an expanded shape behind the image
				// Use a rect slightly larger than the image as the shadow source
				this.drawSpreadShadowForImage(
					ctx, img, layer,
					layerX, layerY, layerWidth, layerHeight,
					spread, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY,
					baseOpacity
				);
			} else {
				// Simple shadow - just apply CSS shadow properties
				ctx.shadowColor = shadowColor;
				ctx.shadowBlur = shadowBlur;
				ctx.shadowOffsetX = shadowOffsetX;
				ctx.shadowOffsetY = shadowOffsetY;
			}
		}

		// Draw the image scaled to layer dimensions
		ctx.drawImage( img, layerX, layerY, layerWidth, layerHeight );

		// Clear shadow
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;

		ctx.restore();
	}

	/**
	 * Check if shadow is enabled for a layer
	 *
	 * @private
	 * @param {Object} layer - Layer data
	 * @returns {boolean} True if shadow is enabled
	 */
	hasShadowEnabled( layer ) {
		return layer.shadow === true ||
			layer.shadow === 'true' ||
			layer.shadow === 1 ||
			layer.shadow === '1' ||
			( typeof layer.shadow === 'object' && !!layer.shadow );
	}

	/**
	 * Get shadow spread value from layer
	 *
	 * @private
	 * @param {Object} layer - Layer data
	 * @returns {number} Spread value in pixels
	 */
	getShadowSpread( layer ) {
		if ( typeof layer.shadowSpread === 'number' && layer.shadowSpread > 0 ) {
			return layer.shadowSpread;
		}
		if ( layer.shadow && typeof layer.shadow === 'object' &&
			typeof layer.shadow.spread === 'number' && layer.shadow.spread > 0 ) {
			return layer.shadow.spread;
		}
		return 0;
	}

	/**
	 * Draw spread shadow for an image using offscreen canvas technique
	 *
	 * @private
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {HTMLImageElement} img - Image to draw
	 * @param {Object} layer - Layer data
	 * @param {number} x - X position
	 * @param {number} y - Y position
	 * @param {number} width - Width
	 * @param {number} height - Height
	 * @param {number} spread - Spread amount
	 * @param {string} shadowColor - Shadow color
	 * @param {number} shadowBlur - Shadow blur
	 * @param {number} offsetX - Shadow X offset
	 * @param {number} offsetY - Shadow Y offset
	 * @param {number} opacity - Opacity
	 */
	drawSpreadShadowForImage( ctx, img, layer, x, y, width, height, spread, shadowColor, shadowBlur, offsetX, offsetY, opacity ) {
		// Use dilation technique for uniform spread on all edges (including angled ones).
		// Instead of scaling (which only works for axis-aligned shapes), we draw the image
		// multiple times at offset positions around a circle. This creates uniform perpendicular
		// distance from all edges, matching CSS box-shadow spread behavior.

		const FAR_OFFSET_X = 5000;
		const FAR_OFFSET_Y = spread + shadowBlur + Math.abs( offsetY ) + 100;
		const canvasWidth = ctx.canvas ? ctx.canvas.width : 1600;
		const canvasHeight = ctx.canvas ? ctx.canvas.height : 1200;

		// Create temporary canvas for the dilated shape
		const tempCanvas = document.createElement( 'canvas' );
		tempCanvas.width = canvasWidth + FAR_OFFSET_X + shadowBlur + Math.abs( offsetX ) + spread * 2;
		tempCanvas.height = canvasHeight + FAR_OFFSET_Y + shadowBlur + Math.abs( offsetY ) + spread * 2;
		const tempCtx = tempCanvas.getContext( '2d' );

		if ( !tempCtx ) {
			// Fallback to simple shadow
			ctx.shadowColor = shadowColor;
			ctx.shadowBlur = shadowBlur;
			ctx.shadowOffsetX = offsetX;
			ctx.shadowOffsetY = offsetY;
			return;
		}

		// Copy transform (excluding rotation which is already applied)
		const currentTransform = ctx.getTransform ? ctx.getTransform() : null;
		if ( currentTransform ) {
			tempCtx.setTransform( 1, 0, 0, 1, currentTransform.e, currentTransform.f );
		}

		// Shift by FAR_OFFSET in both X and Y to prevent clipping
		tempCtx.translate( FAR_OFFSET_X, FAR_OFFSET_Y );

		// Set up shadow with compensated offset for both axes
		tempCtx.shadowColor = shadowColor;
		tempCtx.shadowBlur = shadowBlur;
		tempCtx.shadowOffsetX = offsetX - FAR_OFFSET_X;
		tempCtx.shadowOffsetY = offsetY - FAR_OFFSET_Y;

		// DILATION: Draw the image multiple times at offset positions around a circle
		// to create uniform spread on all edges (works correctly for angled shapes like triangles).
		// Number of samples increases with spread size for smooth edges.
		const numSamples = Math.max( 16, Math.ceil( spread * 1.5 ) );

		for ( let i = 0; i < numSamples; i++ ) {
			const angle = ( i / numSamples ) * 2 * Math.PI;
			const dx = Math.cos( angle ) * spread;
			const dy = Math.sin( angle ) * spread;
			tempCtx.drawImage( img, x + dx, y + dy, width, height );
		}

		// Also draw at center to fill any gaps
		tempCtx.drawImage( img, x, y, width, height );

		// Erase the dilated shape (leaving only its shadow)
		tempCtx.globalCompositeOperation = 'destination-out';
		tempCtx.shadowColor = 'transparent';
		tempCtx.shadowBlur = 0;
		tempCtx.shadowOffsetX = 0;
		tempCtx.shadowOffsetY = 0;

		// Erase using the same dilation pattern
		for ( let i = 0; i < numSamples; i++ ) {
			const angle = ( i / numSamples ) * 2 * Math.PI;
			const dx = Math.cos( angle ) * spread;
			const dy = Math.sin( angle ) * spread;
			tempCtx.drawImage( img, x + dx, y + dy, width, height );
		}
		tempCtx.drawImage( img, x, y, width, height );

		// Draw shadow to main canvas
		ctx.save();
		ctx.setTransform( 1, 0, 0, 1, 0, 0 );
		ctx.globalAlpha = opacity;
		ctx.drawImage( tempCanvas, 0, 0 );
		ctx.restore();
	}

	/**
	 * Render a multi-path shape (compound shapes like safety signs)
	 *
	 * Each path in the paths array is rendered in order with its own styling.
	 * This enables shapes like warning signs (yellow triangle + black symbol).
	 *
	 * @private
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {Object} shapeData - Shape definition with paths array
	 * @param {Object} layer - Layer data
	 * @param {Object} [_options] - Render options
	 */
	renderMultiPath( ctx, shapeData, layer, _options = {} ) {
		if ( !shapeData.viewBox ) {
			return;
		}

		const viewBox = shapeData.viewBox;
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

		// Render each path in order
		const layerOpacity = layer.opacity !== undefined ? layer.opacity : 1;

		for ( const pathDef of shapeData.paths ) {
			if ( !pathDef.path ) {
				continue;
			}

			const path2d = this.getPath2D( pathDef.path );
			const fillRule = pathDef.fillRule || 'nonzero';

			// Apply fill if specified
			if ( pathDef.fill && pathDef.fill !== 'none' && pathDef.fill !== 'transparent' ) {
				ctx.fillStyle = pathDef.fill;
				ctx.globalAlpha = layerOpacity;
				ctx.fill( path2d, fillRule );
			}

			// Apply stroke if specified
			if ( pathDef.stroke && pathDef.stroke !== 'none' && pathDef.stroke !== 'transparent' ) {
				ctx.strokeStyle = pathDef.stroke;
				ctx.lineWidth = ( pathDef.strokeWidth || 2 ) / Math.min( scaleX, scaleY );
				ctx.globalAlpha = layerOpacity;
				ctx.stroke( path2d );
			}
		}

		ctx.restore();
	}

	/**
	 * Render with shadow effects
	 *
	 * Note: Shadows are now handled directly in drawSVGImage() with proper spread support.
	 * This method is kept for backwards compatibility with any code that calls it directly.
	 *
	 * @param {CanvasRenderingContext2D} ctx - Canvas context
	 * @param {Object} shapeData - Shape definition from library
	 * @param {Object} layer - Layer data
	 * @param {Object} [options] - Render options
	 */
	renderWithEffects( ctx, shapeData, layer, options = {} ) {
		// Shadows are now handled in drawSVGImage, so just delegate to render
		return this.render( ctx, shapeData, layer, options );
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
