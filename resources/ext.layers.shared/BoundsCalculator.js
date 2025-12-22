/**
 * BoundsCalculator - Utility for calculating layer bounds
 *
 * Provides centralized bounds calculation for all layer types.
 * Extracted from SelectionManager.getLayerBoundsCompat() to reduce code duplication
 * and provide a reusable utility.
 *
 * @module BoundsCalculator
 * @since 0.9.2
 */
( function () {
	'use strict';

	/**
	 * BoundsCalculator class - Static utility methods for layer bounds calculations
	 */
	class BoundsCalculator {
		/**
		 * Calculate bounds for any layer type
		 *
		 * @param {Object} layer - Layer object
		 * @return {Object|null} Bounds {x, y, width, height} or null
		 */
		static getLayerBounds( layer ) {
			if ( !layer ) {
				return null;
			}

			// Try type-specific calculations in order of likelihood
			const bounds = BoundsCalculator.getRectangularBounds( layer ) ||
				BoundsCalculator.getLineBounds( layer ) ||
				BoundsCalculator.getEllipseBounds( layer ) ||
				BoundsCalculator.getPolygonBounds( layer ) ||
				BoundsCalculator.getTextBounds( layer );

			return bounds;
		}

		/**
		 * Calculate bounds for rectangular layers (rectangle, blur, etc.)
		 *
		 * @param {Object} layer - Layer with x, y, width, height properties
		 * @return {Object|null} Bounds or null if not rectangular
		 */
		static getRectangularBounds( layer ) {
			if ( typeof layer.x !== 'number' || typeof layer.y !== 'number' ||
				typeof layer.width !== 'number' || typeof layer.height !== 'number' ) {
				return null;
			}

			// Handle negative dimensions (drawn from right-to-left or bottom-to-top)
			const minX = Math.min( layer.x, layer.x + layer.width );
			const minY = Math.min( layer.y, layer.y + layer.height );

			return {
				x: minX,
				y: minY,
				width: Math.abs( layer.width ),
				height: Math.abs( layer.height )
			};
		}

		/**
		 * Calculate bounds for line/arrow layers
		 *
		 * @param {Object} layer - Layer with x1, y1, x2, y2 properties
		 * @return {Object|null} Bounds or null if not a line
		 */
		static getLineBounds( layer ) {
			if ( typeof layer.x1 !== 'number' || typeof layer.y1 !== 'number' ||
				typeof layer.x2 !== 'number' || typeof layer.y2 !== 'number' ) {
				return null;
			}

			const minX = Math.min( layer.x1, layer.x2 );
			const minY = Math.min( layer.y1, layer.y2 );
			const maxX = Math.max( layer.x1, layer.x2 );
			const maxY = Math.max( layer.y1, layer.y2 );

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Calculate bounds for ellipse/circle layers
		 *
		 * @param {Object} layer - Layer with center x, y and radius/radiusX/radiusY
		 * @return {Object|null} Bounds or null if not an ellipse
		 */
		static getEllipseBounds( layer ) {
			// Must have center coordinates
			if ( typeof layer.x !== 'number' || typeof layer.y !== 'number' ) {
				return null;
			}

			// Must have radius, radiusX, or radiusY
			const hasRadius = typeof layer.radius === 'number';
			const hasRadiusX = typeof layer.radiusX === 'number';
			const hasRadiusY = typeof layer.radiusY === 'number';

			if ( !hasRadius && !hasRadiusX && !hasRadiusY ) {
				return null;
			}

			// Determine radii - use specific radius if available, otherwise use radius
			const rx = Math.abs( hasRadiusX ? layer.radiusX : ( layer.radius || 0 ) );
			const ry = Math.abs( hasRadiusY ? layer.radiusY : ( layer.radius || 0 ) );

			return {
				x: layer.x - rx,
				y: layer.y - ry,
				width: rx * 2,
				height: ry * 2
			};
		}

		/**
		 * Calculate bounds for polygon/path/star layers with points array
		 *
		 * @param {Object} layer - Layer with points array
		 * @return {Object|null} Bounds or null if not a polygon
		 */
		static getPolygonBounds( layer ) {
			if ( !Array.isArray( layer.points ) || layer.points.length < 2 ) {
				return null;
			}

			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			for ( let i = 0; i < layer.points.length; i++ ) {
				const p = layer.points[ i ];
				if ( typeof p.x === 'number' && typeof p.y === 'number' ) {
					minX = Math.min( minX, p.x );
					minY = Math.min( minY, p.y );
					maxX = Math.max( maxX, p.x );
					maxY = Math.max( maxY, p.y );
				}
			}

			if ( minX === Infinity ) {
				return null;
			}

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Calculate bounds for text layers
		 *
		 * @param {Object} layer - Layer with text properties
		 * @return {Object|null} Bounds or null if not a text layer
		 */
		static getTextBounds( layer ) {
			if ( layer.type !== 'text' || typeof layer.x !== 'number' || typeof layer.y !== 'number' ) {
				return null;
			}

			// Text bounds are estimated based on fontSize and text content
			const fontSize = layer.fontSize || 16;
			const text = layer.text || '';

			// Estimate width based on character count (rough approximation)
			const charWidth = fontSize * 0.6;
			const estimatedWidth = text.length * charWidth;

			return {
				x: layer.x,
				y: layer.y - fontSize, // Text baseline is at y
				width: layer.width || estimatedWidth || fontSize * 5,
				height: layer.height || fontSize * 1.2
			};
		}

		/**
		 * Merge multiple bounds into one encompassing bounds
		 *
		 * @param {Array<Object>} boundsArray - Array of bounds objects
		 * @return {Object|null} Combined bounds or null if empty
		 */
		static mergeBounds( boundsArray ) {
			if ( !Array.isArray( boundsArray ) || boundsArray.length === 0 ) {
				return null;
			}

			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			for ( let i = 0; i < boundsArray.length; i++ ) {
				const b = boundsArray[ i ];
				if ( b && typeof b.x === 'number' ) {
					minX = Math.min( minX, b.x );
					minY = Math.min( minY, b.y );
					maxX = Math.max( maxX, b.x + b.width );
					maxY = Math.max( maxY, b.y + b.height );
				}
			}

			if ( minX === Infinity ) {
				return null;
			}

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Get bounds for multiple layers
		 *
		 * @param {Array<Object>} layers - Array of layer objects
		 * @return {Object|null} Combined bounds or null if empty
		 */
		static getMultiLayerBounds( layers ) {
			if ( !Array.isArray( layers ) || layers.length === 0 ) {
				return null;
			}

			const boundsArray = [];
			for ( let i = 0; i < layers.length; i++ ) {
				const bounds = BoundsCalculator.getLayerBounds( layers[ i ] );
				if ( bounds ) {
					boundsArray.push( bounds );
				}
			}

			return BoundsCalculator.mergeBounds( boundsArray );
		}

		/**
		 * Check if a point is inside bounds
		 *
		 * @param {Object} point - Point with x, y properties
		 * @param {Object} bounds - Bounds with x, y, width, height properties
		 * @return {boolean} True if point is inside bounds
		 */
		static isPointInBounds( point, bounds ) {
			if ( !point || !bounds ) {
				return false;
			}

			return point.x >= bounds.x &&
				point.x <= bounds.x + bounds.width &&
				point.y >= bounds.y &&
				point.y <= bounds.y + bounds.height;
		}

		/**
		 * Check if two bounds intersect
		 *
		 * @param {Object} bounds1 - First bounds
		 * @param {Object} bounds2 - Second bounds
		 * @return {boolean} True if bounds intersect
		 */
		static boundsIntersect( bounds1, bounds2 ) {
			if ( !bounds1 || !bounds2 ) {
				return false;
			}

			return !(
				bounds1.x + bounds1.width < bounds2.x ||
				bounds2.x + bounds2.width < bounds1.x ||
				bounds1.y + bounds1.height < bounds2.y ||
				bounds2.y + bounds2.height < bounds1.y
			);
		}

		/**
		 * Expand bounds by a given amount
		 *
		 * @param {Object} bounds - Bounds to expand
		 * @param {number} amount - Amount to expand (can be negative to shrink)
		 * @return {Object|null} Expanded bounds or null if invalid
		 */
		static expandBounds( bounds, amount ) {
			if ( !bounds || typeof amount !== 'number' ) {
				return bounds;
			}

			return {
				x: bounds.x - amount,
				y: bounds.y - amount,
				width: bounds.width + amount * 2,
				height: bounds.height + amount * 2
			};
		}

		/**
		 * Get the center point of bounds
		 *
		 * @param {Object} bounds - Bounds object
		 * @return {Object|null} Center point {x, y} or null
		 */
		static getBoundsCenter( bounds ) {
			if ( !bounds ) {
				return null;
			}

			return {
				x: bounds.x + bounds.width / 2,
				y: bounds.y + bounds.height / 2
			};
		}
	}

	// ========================================================================
	// Exports
	// ========================================================================

	// Primary export under Layers.Utils namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.BoundsCalculator = BoundsCalculator;
	}

	// CommonJS for testing
	if ( typeof module !== 'undefined' && typeof module.exports !== 'undefined' ) {
		module.exports = BoundsCalculator;
	}

}() );
