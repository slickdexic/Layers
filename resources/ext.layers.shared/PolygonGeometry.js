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
		 * @param {number} [cornerRadius=0] - Corner radius for rounded corners
		 */
		static drawPolygonPath( ctx, x, y, radius, sides, cornerRadius ) {
			const vertices = PolygonGeometry.getPolygonVertices( x, y, radius, sides );
			if ( cornerRadius && cornerRadius > 0 ) {
				PolygonGeometry.drawRoundedPath( ctx, vertices, cornerRadius );
			} else {
				PolygonGeometry.drawPath( ctx, vertices );
			}
		}

		/**
		 * Draw a path with rounded corners using arcTo
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points
		 * @param {number} cornerRadius - Radius for rounded corners
		 */
		static drawRoundedPath( ctx, vertices, cornerRadius ) {
			if ( !vertices || vertices.length < 3 ) {
				return;
			}
			const n = vertices.length;
			ctx.beginPath();

			// Start at midpoint of edge from vertex 0 to vertex 1
			// This ensures we're not near any corner
			ctx.moveTo(
				( vertices[ 0 ].x + vertices[ 1 ].x ) / 2,
				( vertices[ 0 ].y + vertices[ 1 ].y ) / 2
			);

			// Arc around vertices 1, 2, ..., n-1
			for ( let i = 1; i < n; i++ ) {
				const curr = vertices[ i ];
				const next = vertices[ ( i + 1 ) % n ];
				if ( cornerRadius > 0 ) {
					ctx.arcTo( curr.x, curr.y, next.x, next.y, cornerRadius );
				} else {
					ctx.lineTo( curr.x, curr.y );
				}
			}

			// Arc around vertex 0
			if ( cornerRadius > 0 ) {
				ctx.arcTo( vertices[ 0 ].x, vertices[ 0 ].y, vertices[ 1 ].x, vertices[ 1 ].y, cornerRadius );
			} else {
				ctx.lineTo( vertices[ 0 ].x, vertices[ 0 ].y );
			}

			// Close path - connects back to our starting midpoint
			ctx.closePath();
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
		 * @param {number} [pointRadius=0] - Corner radius at star points (outer tips)
		 * @param {number} [valleyRadius=0] - Corner radius at star valleys (inner corners)
		 */
		static drawStarPath( ctx, x, y, outerRadius, innerRadius, numPoints, pointRadius, valleyRadius ) {
			const vertices = PolygonGeometry.getStarVertices( x, y, outerRadius, innerRadius, numPoints );
			if ( ( pointRadius && pointRadius > 0 ) || ( valleyRadius && valleyRadius > 0 ) ) {
				PolygonGeometry.drawRoundedStarPath( ctx, vertices, pointRadius || 0, valleyRadius || 0 );
			} else {
				PolygonGeometry.drawPath( ctx, vertices );
			}
		}

		/**
		 * Draw a path with rounded corners for stars, with different radii for points and valleys
		 *
		 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
		 * @param {Array<{x: number, y: number}>} vertices - Array of vertex points (alternating outer/inner)
		 * @param {number} pointRadius - Radius for outer point corners
		 * @param {number} valleyRadius - Radius for inner valley corners
		 */
		static drawRoundedStarPath( ctx, vertices, pointRadius, valleyRadius ) {
			if ( !vertices || vertices.length < 3 ) {
				return;
			}
			const n = vertices.length;
			ctx.beginPath();

			// Helper to get radius for a vertex (even = point, odd = valley)
			const getRadius = ( i ) => ( i % 2 === 0 ? pointRadius : valleyRadius );

			// Start at midpoint of edge from vertex 0 to vertex 1
			// This ensures we're not near any corner
			ctx.moveTo(
				( vertices[ 0 ].x + vertices[ 1 ].x ) / 2,
				( vertices[ 0 ].y + vertices[ 1 ].y ) / 2
			);

			// Arc around vertices 1, 2, ..., n-1
			for ( let i = 1; i < n; i++ ) {
				const curr = vertices[ i ];
				const next = vertices[ ( i + 1 ) % n ];
				const r = getRadius( i );
				if ( r > 0 ) {
					ctx.arcTo( curr.x, curr.y, next.x, next.y, r );
				} else {
					ctx.lineTo( curr.x, curr.y );
				}
			}

			// Arc around vertex 0
			const r0 = getRadius( 0 );
			if ( r0 > 0 ) {
				ctx.arcTo( vertices[ 0 ].x, vertices[ 0 ].y, vertices[ 1 ].x, vertices[ 1 ].y, r0 );
			} else {
				ctx.lineTo( vertices[ 0 ].x, vertices[ 0 ].y );
			}

			// Close path - connects back to our starting midpoint
			ctx.closePath();
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
