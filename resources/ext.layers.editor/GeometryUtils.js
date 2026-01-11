/**
 * GeometryUtils.js - Coordinate transformation and geometric utility functions
 *
 * Extracted from CanvasManager.js as proof-of-concept for modular refactoring.
 * This module handles coordinate conversions, hit testing, and geometric calculations.
 *
 * Part of the MediaWiki Layers extension modularization effort.
 * See CANVAS_MANAGER_REFACTOR_PLAN.md for the complete refactoring strategy.
 *
 * @module GeometryUtils
 */

( function () {
	'use strict';

	/**
	 * Static utility class for geometric calculations
	 * @class GeometryUtils
	 */
	class GeometryUtils {
		/**
		 * Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.
		 * Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.
		 *
		 * @param {HTMLCanvasElement} canvas - The canvas element
		 * @param {number} clientX - Client X coordinate
		 * @param {number} clientY - Client Y coordinate
		 * @param {Object} [options={}] - Optional parameters
		 * @param {boolean} [options.snapToGrid] - Whether to snap to grid
		 * @param {number} [options.gridSize] - Grid size for snapping
		 * @return {{x:number,y:number}} Canvas coordinates
		 */
		static clientToCanvas( canvas, clientX, clientY, options = {} ) {
			const rect = canvas.getBoundingClientRect();

			// Position within the displayed (transformed) element
			const relX = clientX - rect.left;
			const relY = clientY - rect.top;

			// Scale to logical canvas pixels
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;
			let canvasX = relX * scaleX;
			let canvasY = relY * scaleY;

			// Apply grid snapping if requested
			if ( options.snapToGrid && options.gridSize > 0 ) {
				const gridSize = options.gridSize;
				canvasX = Math.round( canvasX / gridSize ) * gridSize;
				canvasY = Math.round( canvasY / gridSize ) * gridSize;
			}

			return { x: canvasX, y: canvasY };
		}

		/**
		 * Raw coordinate mapping without snapping, useful for precise calculations
		 *
		 * @param {HTMLCanvasElement} canvas - The canvas element
		 * @param {number} clientX - Client X coordinate
		 * @param {number} clientY - Client Y coordinate
		 * @param {number} panX - Current pan X offset
		 * @param {number} panY - Current pan Y offset
		 * @param {number} zoom - Current zoom level
		 * @return {{canvasX:number,canvasY:number}} Raw canvas coordinates
		 */
		static clientToRawCanvas( canvas, clientX, clientY, panX, panY, zoom ) {
			const rect = canvas.getBoundingClientRect();
			const clientXRel = clientX - rect.left;
			const clientYRel = clientY - rect.top;

			return {
				canvasX: ( clientXRel - ( panX || 0 ) ) / zoom,
				canvasY: ( clientYRel - ( panY || 0 ) ) / zoom
			};
		}

		/**
		 * Test if a point is inside a rectangle
		 *
		 * @param {{x:number,y:number}} point - The point to test
		 * @param {{x:number,y:number,width:number,height:number}} rect - The rectangle
		 * @return {boolean} True if point is inside rectangle
		 */
		static isPointInRect( point, rect ) {
			return point.x >= rect.x && point.x <= rect.x + rect.width &&
				point.y >= rect.y && point.y <= rect.y + rect.height;
		}

		/**
		 * Test if a point is near a line segment within tolerance
		 *
		 * @param {{x:number,y:number}} point - The point to test
		 * @param {number} x1 - Line start X
		 * @param {number} y1 - Line start Y
		 * @param {number} x2 - Line end X
		 * @param {number} y2 - Line end Y
		 * @param {number} [tolerance=6] - Distance tolerance
		 * @return {boolean} True if point is near the line
		 */
		static isPointNearLine( point, x1, y1, x2, y2, tolerance = 6 ) {
			const dist = GeometryUtils.pointToSegmentDistance( point.x, point.y, x1, y1, x2, y2 );
			return dist <= tolerance;
		}

		/**
		 * Calculate the shortest distance from a point to a line segment
		 *
		 * @param {number} px - Point X coordinate
		 * @param {number} py - Point Y coordinate
		 * @param {number} x1 - Line start X
		 * @param {number} y1 - Line start Y
		 * @param {number} x2 - Line end X
		 * @param {number} y2 - Line end Y
		 * @return {number} Distance from point to line segment
		 */
		static pointToSegmentDistance( px, py, x1, y1, x2, y2 ) {
			const dx = x2 - x1;
			const dy = y2 - y1;

			// Handle degenerate case where line segment is just a point
			if ( dx === 0 && dy === 0 ) {
				return Math.sqrt( Math.pow( px - x1, 2 ) + Math.pow( py - y1, 2 ) );
			}

			// Project point onto line segment
			let t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / ( dx * dx + dy * dy );
			t = Math.max( 0, Math.min( 1, t ) ); // Clamp to segment

			const projX = x1 + t * dx;
			const projY = y1 + t * dy;

			return Math.sqrt( Math.pow( px - projX, 2 ) + Math.pow( py - projY, 2 ) );
		}

		/**
		 * Test if a point is inside a polygon using ray casting algorithm
		 *
		 * @param {{x:number,y:number}} point - The point to test
		 * @param {Array<{x:number,y:number}>} polygonPoints - Array of polygon vertices
		 * @return {boolean} True if point is inside polygon
		 */
		static isPointInPolygon( point, polygonPoints ) {
			const x = point.x;
			const y = point.y;
			let inside = false;

			for ( let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++ ) {
				const xi = polygonPoints[ i ].x;
				const yi = polygonPoints[ i ].y;
				const xj = polygonPoints[ j ].x;
				const yj = polygonPoints[ j ].y;

				if ( ( ( yi > y ) !== ( yj > y ) ) &&
					( x < ( xj - xi ) * ( y - yi ) / ( yj - yi ) + xi ) ) {
					inside = !inside;
				}
			}

			return inside;
		}

		/**
		 * Calculate distance between two points
		 *
		 * @param {{x:number,y:number}} point1 - First point
		 * @param {{x:number,y:number}} point2 - Second point
		 * @return {number} Distance between points
		 */
		static distance( point1, point2 ) {
			const dx = point2.x - point1.x;
			const dy = point2.y - point1.y;
			return Math.sqrt( dx * dx + dy * dy );
		}

		/**
		 * Calculate the bounding box of a set of points
		 *
		 * @param {Array<{x:number,y:number}>} points - Array of points
		 * @return {{x:number,y:number,width:number,height:number}|null} Bounding box or null
		 */
		static getBoundingBox( points ) {
			if ( !points || points.length === 0 ) {
				return null;
			}

			let minX = points[ 0 ].x;
			let minY = points[ 0 ].y;
			let maxX = points[ 0 ].x;
			let maxY = points[ 0 ].y;

			for ( let i = 1; i < points.length; i++ ) {
				minX = Math.min( minX, points[ i ].x );
				minY = Math.min( minY, points[ i ].y );
				maxX = Math.max( maxX, points[ i ].x );
				maxY = Math.max( maxY, points[ i ].y );
			}

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Clamp a number between min and max values
		 *
		 * @param {number} value - Value to clamp
		 * @param {number} min - Minimum value
		 * @param {number} max - Maximum value
		 * @return {number} Clamped value
		 */
		static clamp( value, min, max ) {
			return Math.min( Math.max( value, min ), max );
		}

		/**
		 * Convert degrees to radians
		 *
		 * @param {number} degrees - Angle in degrees
		 * @return {number} Angle in radians
		 */
		static degToRad( degrees ) {
			return degrees * Math.PI / 180;
		}

		/**
		 * Convert radians to degrees
		 *
		 * @param {number} radians - Angle in radians
		 * @return {number} Angle in degrees
		 */
		static radToDeg( radians ) {
			return radians * 180 / Math.PI;
		}

		/**
		 * Get raw bounds for a layer based on its type (excludes text layers - use TextUtils for those)
		 *
		 * @param {Object} layer - The layer object
		 * @return {{x:number,y:number,width:number,height:number}|null} Bounding box or null
		 */
		static getLayerBoundsForType( layer ) {
			if ( !layer || !layer.type ) {
				return null;
			}

			let rectX, rectY, safeWidth, safeHeight;
			switch ( layer.type ) {
				case 'text':
					// Text bounds require canvas context - caller should handle this with TextUtils
					return null;
				case 'rectangle':
				case 'textbox':
				case 'callout':
				case 'image': {
					rectX = layer.x || 0;
					rectY = layer.y || 0;
					safeWidth = layer.width || 0;
					safeHeight = layer.height || 0;
					if ( safeWidth < 0 ) {
						rectX += safeWidth;
						safeWidth = Math.abs( safeWidth );
					}
					if ( safeHeight < 0 ) {
						rectY += safeHeight;
						safeHeight = Math.abs( safeHeight );
					}
					return { x: rectX, y: rectY, width: safeWidth, height: safeHeight };
				}
				case 'circle': {
					const radius = Math.abs( layer.radius || 0 );
					return {
						x: ( layer.x || 0 ) - radius,
						y: ( layer.y || 0 ) - radius,
						width: radius * 2,
						height: radius * 2
					};
				}
				case 'ellipse': {
					const radiusX = Math.abs( layer.radiusX || layer.radius || 0 );
					const radiusY = Math.abs( layer.radiusY || layer.radius || 0 );
					return {
						x: ( layer.x || 0 ) - radiusX,
						y: ( layer.y || 0 ) - radiusY,
						width: radiusX * 2,
						height: radiusY * 2
					};
				}
				case 'line':
				case 'arrow': {
					const x1 = layer.x1 !== undefined ? layer.x1 : ( layer.x || 0 );
					const y1 = layer.y1 !== undefined ? layer.y1 : ( layer.y || 0 );
					const x2 = layer.x2 !== undefined ? layer.x2 : ( layer.x || 0 );
					const y2 = layer.y2 !== undefined ? layer.y2 : ( layer.y || 0 );
					return {
						x: Math.min( x1, x2 ),
						y: Math.min( y1, y2 ),
						width: Math.max( Math.abs( x2 - x1 ), 1 ),
						height: Math.max( Math.abs( y2 - y1 ), 1 )
					};
				}
				case 'polygon':
				case 'star':
				case 'path': {
					if ( Array.isArray( layer.points ) && layer.points.length >= 3 ) {
						return GeometryUtils.getBoundingBox( layer.points );
					}
					// Fallback for polygon/star without points array
					let r = layer.radius;
					if ( layer.type === 'star' && layer.outerRadius ) {
						r = layer.outerRadius;
					}
					const radiusFallback = Math.abs( r || 50 );
					return {
						x: ( layer.x || 0 ) - radiusFallback,
						y: ( layer.y || 0 ) - radiusFallback,
						width: radiusFallback * 2,
						height: radiusFallback * 2
					};
				}
				case 'marker': {
					// Marker is a circle centered at x,y with size as diameter
					// If it has an arrow, include the arrow endpoint in bounds
					const markerSize = layer.size || 24;
					const markerRadius = markerSize / 2;
					const mx = layer.x || 0;
					const my = layer.y || 0;

					if ( layer.hasArrow && layer.arrowX !== undefined && layer.arrowY !== undefined ) {
						// Include both marker circle and arrow endpoint
						const minX = Math.min( mx - markerRadius, layer.arrowX );
						const minY = Math.min( my - markerRadius, layer.arrowY );
						const maxX = Math.max( mx + markerRadius, layer.arrowX );
						const maxY = Math.max( my + markerRadius, layer.arrowY );
						return {
							x: minX,
							y: minY,
							width: maxX - minX,
							height: maxY - minY
						};
					}

					// Just the marker circle
					return {
						x: mx - markerRadius,
						y: my - markerRadius,
						width: markerSize,
						height: markerSize
					};
				}
				case 'dimension': {
					// Dimension is a line from x1,y1 to x2,y2 (like arrow)
					const dx1 = layer.x1 !== undefined ? layer.x1 : ( layer.x || 0 );
					const dy1 = layer.y1 !== undefined ? layer.y1 : ( layer.y || 0 );
					const dx2 = layer.x2 !== undefined ? layer.x2 : ( layer.x || 0 );
					const dy2 = layer.y2 !== undefined ? layer.y2 : ( layer.y || 0 );
					return {
						x: Math.min( dx1, dx2 ),
						y: Math.min( dy1, dy2 ),
						width: Math.max( Math.abs( dx2 - dx1 ), 1 ),
						height: Math.max( Math.abs( dy2 - dy1 ), 1 )
					};
				}
				default: {
					// Default fallback for unknown types
					rectX = layer.x || 0;
					rectY = layer.y || 0;
					safeWidth = Math.abs( layer.width || 50 ) || 50;
					safeHeight = Math.abs( layer.height || 50 ) || 50;
					return { x: rectX, y: rectY, width: safeWidth, height: safeHeight };
				}
			}
		}

		/**
		 * Compute axis-aligned bounding box for a rotated rectangle
		 *
		 * @param {{x:number,y:number,width:number,height:number}} rect - The rectangle
		 * @param {number} rotationDegrees - Rotation in degrees
		 * @return {{left:number,top:number,right:number,bottom:number}} Axis-aligned bounds
		 */
		static computeAxisAlignedBounds( rect, rotationDegrees ) {
			if ( !rect ) {
				return { left: 0, top: 0, right: 0, bottom: 0 };
			}

			const rotation = ( rotationDegrees || 0 ) * Math.PI / 180;
			if ( rotation === 0 ) {
				return {
					left: rect.x,
					top: rect.y,
					right: rect.x + rect.width,
					bottom: rect.y + rect.height
				};
			}

			const centerX = rect.x + ( rect.width / 2 );
			const centerY = rect.y + ( rect.height / 2 );
			const corners = [
				{ x: rect.x, y: rect.y },
				{ x: rect.x + rect.width, y: rect.y },
				{ x: rect.x + rect.width, y: rect.y + rect.height },
				{ x: rect.x, y: rect.y + rect.height }
			];
			const cosR = Math.cos( rotation );
			const sinR = Math.sin( rotation );
			const rotated = corners.map( ( point ) => {
				const dx = point.x - centerX;
				const dy = point.y - centerY;
				return {
					x: centerX + dx * cosR - dy * sinR,
					y: centerY + dx * sinR + dy * cosR
				};
			} );

			let minX = rotated[ 0 ].x;
			let maxX = rotated[ 0 ].x;
			let minY = rotated[ 0 ].y;
			let maxY = rotated[ 0 ].y;
			for ( let i = 1; i < rotated.length; i++ ) {
				minX = Math.min( minX, rotated[ i ].x );
				maxX = Math.max( maxX, rotated[ i ].x );
				minY = Math.min( minY, rotated[ i ].y );
				maxY = Math.max( maxY, rotated[ i ].y );
			}

			return { left: minX, top: minY, right: maxX, bottom: maxY };
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.Geometry = GeometryUtils;
	}

	// CommonJS export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = GeometryUtils;
	}

}() );
