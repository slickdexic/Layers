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

/// <reference path="./globals.d.ts" />

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Point with x, y coordinates
 */
export interface Point {
	x: number;
	y: number;
}

/**
 * Bounds rectangle
 */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Layer with rectangular properties
 */
interface RectangularLayer {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Layer with line properties
 */
interface LineLayer {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * Layer with ellipse/circle properties
 */
interface EllipseLayer {
	x: number;
	y: number;
	radius?: number;
	radiusX?: number;
	radiusY?: number;
}

/**
 * Layer with polygon/path properties
 */
interface PolygonLayer {
	points: Point[];
}

/**
 * Layer with text properties
 */
interface TextLayer {
	type: 'text';
	x: number;
	y: number;
	text?: string;
	fontSize?: number;
	width?: number;
	height?: number;
}

/**
 * Generic layer type (union of all layer types)
 */
export type Layer = Partial<RectangularLayer & LineLayer & EllipseLayer & PolygonLayer & TextLayer> & {
	type?: string;
};

// ============================================================================
// BoundsCalculator Class
// ============================================================================

/**
 * BoundsCalculator class - Static utility methods for layer bounds calculations
 */
export class BoundsCalculator {
	/**
	 * Calculate bounds for any layer type
	 *
	 * @param layer - Layer object
	 * @returns Bounds or null
	 */
	static getLayerBounds( layer: Layer | null | undefined ): Bounds | null {
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
	 * @param layer - Layer with x, y, width, height properties
	 * @returns Bounds or null if not rectangular
	 */
	static getRectangularBounds( layer: Layer ): Bounds | null {
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
	 * @param layer - Layer with x1, y1, x2, y2 properties
	 * @returns Bounds or null if not a line
	 */
	static getLineBounds( layer: Layer ): Bounds | null {
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
	 * @param layer - Layer with center x, y and radius/radiusX/radiusY
	 * @returns Bounds or null if not an ellipse
	 */
	static getEllipseBounds( layer: Layer ): Bounds | null {
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
		const rx = Math.abs( hasRadiusX ? layer.radiusX! : ( layer.radius || 0 ) );
		const ry = Math.abs( hasRadiusY ? layer.radiusY! : ( layer.radius || 0 ) );

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
	 * @param layer - Layer with points array
	 * @returns Bounds or null if not a polygon
	 */
	static getPolygonBounds( layer: Layer ): Bounds | null {
		if ( !Array.isArray( layer.points ) || layer.points.length < 2 ) {
			return null;
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for ( const p of layer.points ) {
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
	 * @param layer - Layer with text properties
	 * @returns Bounds or null if not a text layer
	 */
	static getTextBounds( layer: Layer ): Bounds | null {
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
	 * @param boundsArray - Array of bounds objects
	 * @returns Combined bounds or null if empty
	 */
	static mergeBounds( boundsArray: ( Bounds | null )[] ): Bounds | null {
		if ( !Array.isArray( boundsArray ) || boundsArray.length === 0 ) {
			return null;
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for ( const b of boundsArray ) {
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
	 * @param layers - Array of layer objects
	 * @returns Combined bounds or null if empty
	 */
	static getMultiLayerBounds( layers: Layer[] ): Bounds | null {
		if ( !Array.isArray( layers ) || layers.length === 0 ) {
			return null;
		}

		const boundsArray: ( Bounds | null )[] = [];
		for ( const layer of layers ) {
			const bounds = BoundsCalculator.getLayerBounds( layer );
			if ( bounds ) {
				boundsArray.push( bounds );
			}
		}

		return BoundsCalculator.mergeBounds( boundsArray );
	}

	/**
	 * Check if a point is inside bounds
	 *
	 * @param point - Point with x, y properties
	 * @param bounds - Bounds with x, y, width, height properties
	 * @returns True if point is inside bounds
	 */
	static isPointInBounds( point: Point | null | undefined, bounds: Bounds | null | undefined ): boolean {
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
	 * @param bounds1 - First bounds
	 * @param bounds2 - Second bounds
	 * @returns True if bounds intersect
	 */
	static boundsIntersect( bounds1: Bounds | null | undefined, bounds2: Bounds | null | undefined ): boolean {
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
	 * @param bounds - Bounds to expand
	 * @param amount - Amount to expand (can be negative to shrink)
	 * @returns Expanded bounds or original if invalid
	 */
	static expandBounds( bounds: Bounds | null | undefined, amount: number ): Bounds | null | undefined {
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
	 * @param bounds - Bounds object
	 * @returns Center point or null
	 */
	static getBoundsCenter( bounds: Bounds | null | undefined ): Point | null {
		if ( !bounds ) {
			return null;
		}

		return {
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2
		};
	}
}

// ============================================================================
// Exports
// ============================================================================

// Browser environment: Export to window.Layers namespace
if ( typeof window !== 'undefined' ) {
	window.Layers = window.Layers || {};
	window.Layers.Utils = window.Layers.Utils || {};
	window.Layers.Utils.BoundsCalculator = BoundsCalculator;
}

// Default export
export default BoundsCalculator;
