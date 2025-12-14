/**
 * PolygonGeometry - Geometry utilities for polygon and star shapes
 * Extracted from ShapeRenderer.js for reusability
 */
( function () {
	'use strict';

	/**
	 * Static utility class for polygon and star geometry calculations
	 */
	class PolygonGeometry {
		/**
		 * Generate vertices for a regular polygon
		 *
		 * @param {number} x - Center X coordinate
		 * @param {number} y - Center Y coordinate
		 * @param {number} radius - Radius of the polygon
		 * @param {number} sides - Number of sides (minimum 3)
		 * @return {Array<{x: number, y: number}>} Array of vertex points
		 */
		static getPolygonVertices( x, y, radius, sides ) {
			const numSides = Math.max( 3, Math.floor( sides ) );
			const points = [];
			for ( let i = 0; i < numSides; i++ ) {
				const angle = ( i * 2 * Math.PI ) / numSides - Math.PI / 2;
				points.push( {
					x: x + radius * Math.cos( angle ),
					y: y + radius * Math.sin( angle )
				} );
			}
			return points;
		}

		/**
		 * Generate vertices for a star shape
		 *
		 * @param {number} x - Center X coordinate
		 * @param {number} y - Center Y coordinate
		 * @param {number} outerRadius - Outer radius of the star points
		 * @param {number} innerRadius - Inner radius (valley between points)
		 * @param {number} numPoints - Number of star points (minimum 3)
		 * @return {Array<{x: number, y: number}>} Array of vertex points (2 * numPoints)
		 */
		static getStarVertices( x, y, outerRadius, innerRadius, numPoints ) {
			const starPoints = Math.max( 3, Math.floor( numPoints ) );
			const vertices = [];
			for ( let i = 0; i < starPoints * 2; i++ ) {
				const angle = ( i * Math.PI ) / starPoints - Math.PI / 2;
				const r = i % 2 === 0 ? outerRadius : innerRadius;
				vertices.push( {
					x: x + r * Math.cos( angle ),
					y: y + r * Math.sin( angle )
				} );
			}
			return vertices;
		}

		/**
		 * Draw a polygon path on a canvas context from vertices
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points
		 * @param {boolean} [close=true] - Whether to close the path
		 */
		static drawPath( ctx, vertices, close ) {
			if ( !vertices || vertices.length < 2 ) {
				return;
			}
			const shouldClose = close !== false;
			ctx.beginPath();
			ctx.moveTo( vertices[ 0 ].x, vertices[ 0 ].y );
			for ( let i = 1; i < vertices.length; i++ ) {
				ctx.lineTo( vertices[ i ].x, vertices[ i ].y );
			}
			if ( shouldClose ) {
				ctx.closePath();
			}
		}

		/**
		 * Draw a polygon path directly from parameters
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
		 * @param {number} x - Center X coordinate
		 * @param {number} y - Center Y coordinate
		 * @param {number} radius - Radius of the polygon
		 * @param {number} sides - Number of sides
		 */
		static drawPolygonPath( ctx, x, y, radius, sides ) {
			const vertices = PolygonGeometry.getPolygonVertices( x, y, radius, sides );
			PolygonGeometry.drawPath( ctx, vertices );
		}

		/**
		 * Draw a star path directly from parameters
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
		 * @param {number} x - Center X coordinate
		 * @param {number} y - Center Y coordinate
		 * @param {number} outerRadius - Outer radius
		 * @param {number} innerRadius - Inner radius
		 * @param {number} numPoints - Number of points
		 */
		static drawStarPath( ctx, x, y, outerRadius, innerRadius, numPoints ) {
			const vertices = PolygonGeometry.getStarVertices( x, y, outerRadius, innerRadius, numPoints );
			PolygonGeometry.drawPath( ctx, vertices );
		}

		/**
		 * Calculate the bounding box of a polygon
		 *
		 * @param {number} x - Center X coordinate
		 * @param {number} y - Center Y coordinate
		 * @param {number} radius - Radius of the polygon
		 * @param {number} sides - Number of sides
		 * @return {{x: number, y: number, width: number, height: number}} Bounding box
		 */
		static getPolygonBounds( x, y, radius, sides ) {
			const vertices = PolygonGeometry.getPolygonVertices( x, y, radius, sides );
			return PolygonGeometry.getBoundsFromVertices( vertices );
		}

		/**
		 * Calculate the bounding box of a star
		 *
		 * @param {number} x - Center X coordinate
		 * @param {number} y - Center Y coordinate
		 * @param {number} outerRadius - Outer radius
		 * @param {number} innerRadius - Inner radius
		 * @param {number} numPoints - Number of points
		 * @return {{x: number, y: number, width: number, height: number}} Bounding box
		 */
		static getStarBounds( x, y, outerRadius, innerRadius, numPoints ) {
			const vertices = PolygonGeometry.getStarVertices( x, y, outerRadius, innerRadius, numPoints );
			return PolygonGeometry.getBoundsFromVertices( vertices );
		}

		/**
		 * Calculate bounding box from an array of vertices
		 *
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points
		 * @return {{x: number, y: number, width: number, height: number}} Bounding box
		 */
		static getBoundsFromVertices( vertices ) {
			if ( !vertices || vertices.length === 0 ) {
				return { x: 0, y: 0, width: 0, height: 0 };
			}
			let minX = Infinity, minY = Infinity;
			let maxX = -Infinity, maxY = -Infinity;
			for ( let i = 0; i < vertices.length; i++ ) {
				const v = vertices[ i ];
				if ( v.x < minX ) {
					minX = v.x;
				}
				if ( v.y < minY ) {
					minY = v.y;
				}
				if ( v.x > maxX ) {
					maxX = v.x;
				}
				if ( v.y > maxY ) {
					maxY = v.y;
				}
			}
			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Check if a point is inside a polygon using ray casting algorithm
		 *
		 * @param {number} px - Point X coordinate
		 * @param {number} py - Point Y coordinate
		 * @param {Array<{x: number, y: number}>} vertices - Polygon vertices
		 * @return {boolean} True if point is inside the polygon
		 */
		static isPointInPolygon( px, py, vertices ) {
			if ( !vertices || vertices.length < 3 ) {
				return false;
			}
			let inside = false;
			const n = vertices.length;
			for ( let i = 0, j = n - 1; i < n; j = i++ ) {
				const xi = vertices[ i ].x, yi = vertices[ i ].y;
				const xj = vertices[ j ].x, yj = vertices[ j ].y;
				if ( ( ( yi > py ) !== ( yj > py ) ) &&
					( px < ( xj - xi ) * ( py - yi ) / ( yj - yi ) + xi ) ) {
					inside = !inside;
				}
			}
			return inside;
		}
	}

	// Register in namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.PolygonGeometry = PolygonGeometry;
	}

	// CommonJS export for testing
	// eslint-disable-next-line no-undef
	if ( typeof module !== 'undefined' && module.exports ) {
		// eslint-disable-next-line no-undef
		module.exports = PolygonGeometry;
	}
}() );
