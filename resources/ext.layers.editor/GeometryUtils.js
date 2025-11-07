/**
 * GeometryUtils.js - Coordinate transformation and geometric utility functions
 *
 * Extracted from CanvasManager.js as proof-of-concept for modular refactoring.
 * This module handles coordinate conversions, hit testing, and geometric calculations.
 *
 * Part of the MediaWiki Layers extension modularization effort.
 * See CANVAS_MANAGER_REFACTOR_PLAN.md for the complete refactoring strategy.
 */

( function () {
	'use strict';

	/**
	 * @class GeometryUtils
	 * @constructor
	 */
	function GeometryUtils() {
		// Static utility class - no instance properties needed
	}

	/**
	 * Convert a DOM client coordinate to canvas coordinate, robust against CSS transforms.
	 * Uses element's bounding rect to derive the pixel ratio instead of manual pan/zoom math.
	 *
	 * @param {HTMLCanvasElement} canvas - The canvas element
	 * @param {number} clientX - Client X coordinate
	 * @param {number} clientY - Client Y coordinate
	 * @param {Object} options - Optional parameters
	 * @param {boolean} options.snapToGrid - Whether to snap to grid
	 * @param {number} options.gridSize - Grid size for snapping
	 * @return {{x:number,y:number}} Canvas coordinates
	 */
	GeometryUtils.clientToCanvas = function ( canvas, clientX, clientY, options ) {
		options = options || {};
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
	};

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
	GeometryUtils.clientToRawCanvas = function ( canvas, clientX, clientY, panX, panY, zoom ) {
		const rect = canvas.getBoundingClientRect();
		const clientXRel = clientX - rect.left;
		const clientYRel = clientY - rect.top;

		return {
			canvasX: ( clientXRel - ( panX || 0 ) ) / zoom,
			canvasY: ( clientYRel - ( panY || 0 ) ) / zoom
		};
	};

	/**
	 * Test if a point is inside a rectangle
	 *
	 * @param {{x:number,y:number}} point - The point to test
	 * @param {{x:number,y:number,width:number,height:number}} rect - The rectangle
	 * @return {boolean} True if point is inside rectangle
	 */
	GeometryUtils.isPointInRect = function ( point, rect ) {
		return point.x >= rect.x && point.x <= rect.x + rect.width &&
			point.y >= rect.y && point.y <= rect.y + rect.height;
	};

	/**
	 * Test if a point is near a line segment within tolerance
	 *
	 * @param {{x:number,y:number}} point - The point to test
	 * @param {number} x1 - Line start X
	 * @param {number} y1 - Line start Y
	 * @param {number} x2 - Line end X
	 * @param {number} y2 - Line end Y
	 * @param {number} tolerance - Distance tolerance (default: 6)
	 * @return {boolean} True if point is near the line
	 */
	GeometryUtils.isPointNearLine = function ( point, x1, y1, x2, y2, tolerance ) {
		const dist = GeometryUtils.pointToSegmentDistance( point.x, point.y, x1, y1, x2, y2 );
		return dist <= ( tolerance || 6 );
	};

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
	GeometryUtils.pointToSegmentDistance = function ( px, py, x1, y1, x2, y2 ) {
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
	};

	/**
	 * Test if a point is inside a polygon using ray casting algorithm
	 *
	 * @param {{x:number,y:number}} point - The point to test
	 * @param {Array<{x:number,y:number}>} polygonPoints - Array of polygon vertices
	 * @return {boolean} True if point is inside polygon
	 */
	GeometryUtils.isPointInPolygon = function ( point, polygonPoints ) {
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
	};

	/**
	 * Calculate distance between two points
	 *
	 * @param {{x:number,y:number}} point1 - First point
	 * @param {{x:number,y:number}} point2 - Second point
	 * @return {number} Distance between points
	 */
	GeometryUtils.distance = function ( point1, point2 ) {
		const dx = point2.x - point1.x;
		const dy = point2.y - point1.y;
		return Math.sqrt( dx * dx + dy * dy );
	};

	/**
	 * Calculate the bounding box of a set of points
	 *
	 * @param {Array<{x:number,y:number}>} points - Array of points
	 * @return {{x:number,y:number,width:number,height:number}|null} Bounding box or null
	 */
	GeometryUtils.getBoundingBox = function ( points ) {
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
	};

	/**
	 * Clamp a number between min and max values
	 *
	 * @param {number} value - Value to clamp
	 * @param {number} min - Minimum value
	 * @param {number} max - Maximum value
	 * @return {number} Clamped value
	 */
	GeometryUtils.clamp = function ( value, min, max ) {
		return Math.min( Math.max( value, min ), max );
	};

	/**
	 * Convert degrees to radians
	 *
	 * @param {number} degrees - Angle in degrees
	 * @return {number} Angle in radians
	 */
	GeometryUtils.degToRad = function ( degrees ) {
		return degrees * Math.PI / 180;
	};

	/**
	 * Convert radians to degrees
	 *
	 * @param {number} radians - Angle in radians
	 * @return {number} Angle in degrees
	 */
	GeometryUtils.radToDeg = function ( radians ) {
		return radians * 180 / Math.PI;
	};

	// Export for different environments
	if ( typeof module !== 'undefined' && module.exports ) {
		// Node.js/CommonJS
		module.exports = GeometryUtils;
	} else if ( typeof window !== 'undefined' ) {
		// Browser global
		window.GeometryUtils = GeometryUtils;
	}

	// MediaWiki ResourceLoader support
	if ( typeof mw !== 'undefined' && mw.loader ) {
		mw.GeometryUtils = GeometryUtils;
	}

}() );
