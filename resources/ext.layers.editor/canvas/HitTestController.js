/**
 * HitTestController - Handles hit testing for layers and selection handles
 *
 * Extracted from CanvasManager.js to reduce file size and improve maintainability.
 * This module manages all hit-testing operations including:
 * - Layer hit testing (detecting which layer is under a point)
 * - Selection handle hit testing (detecting which resize/rotate handle is under a point)
 * - Point-in-shape calculations for all layer types
 *
 * @module canvas/HitTestController
 */
( function () {
	'use strict';

	/**
	 * HitTestController - Manages hit testing operations
	 *
	 * @class
	 */
	class HitTestController {
		/**
		 * Create a new HitTestController instance
		 *
		 * @param {Object} canvasManager Reference to parent CanvasManager
		 */
		constructor( canvasManager ) {
			this.manager = canvasManager;
		}

		// ==================== Selection Handle Hit Testing ====================

		/**
		 * Test if a point is within any selection handle
		 *
		 * @param {Object} point Point with x, y coordinates
		 * @return {Object|null} The hit handle or null if none hit
		 */
		hitTestSelectionHandles( point ) {
			let handles = [];

			// Get handles from renderer, selection manager, or canvas manager
			if ( this.manager.renderer &&
				this.manager.renderer.selectionHandles &&
				this.manager.renderer.selectionHandles.length > 0 ) {
				handles = this.manager.renderer.selectionHandles;
			} else if ( this.manager.selectionManager &&
				this.manager.selectionManager.selectionHandles &&
				this.manager.selectionManager.selectionHandles.length > 0 ) {
				handles = this.manager.selectionManager.selectionHandles;
			} else {
				handles = this.manager.selectionHandles;
			}

			for ( let i = 0; i < handles.length; i++ ) {
				const handle = handles[ i ];
				const rect = handle.rect || handle;
				if ( this.isPointInRect( point, rect ) ) {
					return handle;
				}
			}
			return null;
		}

		/**
		 * Test if a point is within a rectangle
		 *
		 * @param {Object} point Point with x, y coordinates
		 * @param {Object} rect Rectangle with x, y, width, height
		 * @return {boolean} True if point is in rectangle
		 */
		isPointInRect( point, rect ) {
			return point.x >= rect.x && point.x <= rect.x + rect.width &&
				point.y >= rect.y && point.y <= rect.y + rect.height;
		}

		// ==================== Layer Hit Testing ====================

		/**
		 * Find the topmost layer at a given point
		 *
		 * @param {Object} point Point with x, y coordinates
		 * @return {Object|null} The layer at the point or null if none
		 */
		getLayerAtPoint( point ) {
			const layers = this.manager.editor.layers;

			// Layers are drawn from end to start, so index 0 is visually on top
			for ( let i = 0; i < layers.length; i++ ) {
				const layer = layers[ i ];
				if ( layer.visible === false || layer.locked === true ) {
					continue;
				}
				if ( this.isPointInLayer( point, layer ) ) {
					return layer;
				}
			}
			return null;
		}

		/**
		 * Test if a point is within a layer's bounds
		 *
		 * @param {Object} point Point with x, y coordinates
		 * @param {Object} layer The layer to test
		 * @return {boolean} True if point is in layer
		 */
		isPointInLayer( point, layer ) {
			if ( !layer ) {
				return false;
			}

			switch ( layer.type ) {
				case 'rectangle':
				case 'textbox':
				case 'blur':
				case 'image':
					return this.isPointInRectangleLayer( point, layer );

				case 'circle':
					return this.isPointInCircle( point, layer );

				case 'ellipse':
					return this.isPointInEllipse( point, layer );

				case 'text':
					return this.isPointInTextLayer( point, layer );

				case 'line':
				case 'arrow': {
					const tolerance = Math.max( 6, ( layer.strokeWidth || 2 ) + 4 );
					// Check if arrow is curved (has non-default control point)
					const hasCurve = layer.controlX !== undefined &&
						layer.controlY !== undefined &&
						( layer.controlX !== ( layer.x1 + layer.x2 ) / 2 ||
						layer.controlY !== ( layer.y1 + layer.y2 ) / 2 );
					if ( hasCurve ) {
						return this.isPointNearQuadraticBezier(
							point,
							layer.x1, layer.y1,
							layer.controlX, layer.controlY,
							layer.x2, layer.y2,
							tolerance
						);
					}
					return this.isPointNearLine(
						point,
						layer.x1, layer.y1,
						layer.x2, layer.y2,
						tolerance
					);
				}

				case 'path':
					return this.isPointInPath( point, layer );

				case 'polygon':
				case 'star':
					return this.isPointInPolygonOrStar( point, layer );

				default:
					return false;
			}
		}

		// ==================== Shape-Specific Hit Tests ====================

		/**
		 * Test if point is in a rectangle or blur layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Rectangle/blur layer
		 * @return {boolean} True if hit
		 */
		isPointInRectangleLayer( point, layer ) {
			const minX = Math.min( layer.x, layer.x + layer.width );
			const minY = Math.min( layer.y, layer.y + layer.height );
			const w = Math.abs( layer.width );
			const h = Math.abs( layer.height );
			return point.x >= minX && point.x <= minX + w &&
				point.y >= minY && point.y <= minY + h;
		}

		/**
		 * Test if point is in a circle layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Circle layer
		 * @return {boolean} True if hit
		 */
		isPointInCircle( point, layer ) {
			const dx = point.x - ( layer.x || 0 );
			const dy = point.y - ( layer.y || 0 );
			const r = layer.radius || 0;
			return ( dx * dx + dy * dy ) <= r * r;
		}

		/**
		 * Test if point is in an ellipse layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Ellipse layer
		 * @return {boolean} True if hit
		 */
		isPointInEllipse( point, layer ) {
			const ex = layer.x || 0;
			const ey = layer.y || 0;
			const radX = Math.abs( layer.radiusX || 0 );
			const radY = Math.abs( layer.radiusY || 0 );

			if ( radX === 0 || radY === 0 ) {
				return false;
			}

			const nx = ( point.x - ex ) / radX;
			const ny = ( point.y - ey ) / radY;
			return nx * nx + ny * ny <= 1;
		}

		/**
		 * Test if point is in a text layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Text layer
		 * @return {boolean} True if hit
		 */
		isPointInTextLayer( point, layer ) {
			const bounds = this.manager.getLayerBounds( layer );
			return bounds &&
				point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
				point.y >= bounds.y && point.y <= bounds.y + bounds.height;
		}

		/**
		 * Test if point is in a path layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Path layer with points array
		 * @return {boolean} True if hit
		 */
		isPointInPath( point, layer ) {
			if ( !layer.points || layer.points.length < 2 ) {
				return false;
			}

			const tolerance = Math.max( 6, ( layer.strokeWidth || 2 ) + 4 );

			for ( let i = 0; i < layer.points.length - 1; i++ ) {
				if ( this.isPointNearLine(
					point,
					layer.points[ i ].x, layer.points[ i ].y,
					layer.points[ i + 1 ].x, layer.points[ i + 1 ].y,
					tolerance
				) ) {
					return true;
				}
			}
			return false;
		}

		/**
		 * Test if point is in a polygon or star layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Polygon/star layer
		 * @return {boolean} True if hit
		 */
		isPointInPolygonOrStar( point, layer ) {
			const polyX = layer.x || 0;
			const polyY = layer.y || 0;
			const polyRotation = ( layer.rotation || 0 ) * Math.PI / 180;
			const polyPoints = [];

			if ( layer.type === 'polygon' ) {
				const polySides = layer.sides || 6;
				const polyRadius = Math.abs( layer.radius || layer.outerRadius || 50 );

				for ( let si = 0; si < polySides; si++ ) {
					const angle = ( si * 2 * Math.PI ) / polySides - Math.PI / 2 + polyRotation;
					polyPoints.push( {
						x: polyX + polyRadius * Math.cos( angle ),
						y: polyY + polyRadius * Math.sin( angle )
					} );
				}
			} else {
				// Star
				const starPoints = ( typeof layer.points === 'number' ? layer.points : null ) ||
					layer.starPoints || 5;
				const outerRadius = Math.abs( layer.outerRadius || layer.radius || 50 );
				const innerRadius = Math.abs( layer.innerRadius || outerRadius * 0.4 );

				for ( let sti = 0; sti < starPoints * 2; sti++ ) {
					const starAngle = ( sti * Math.PI ) / starPoints - Math.PI / 2 + polyRotation;
					const starR = ( sti % 2 === 0 ) ? outerRadius : innerRadius;
					polyPoints.push( {
						x: polyX + starR * Math.cos( starAngle ),
						y: polyY + starR * Math.sin( starAngle )
					} );
				}
			}

			return this.isPointInPolygon( point, polyPoints );
		}


		/**
		 * Test if a point is near a line segment
		 *
		 * @param {Object} point Point with x, y
		 * @param {number} x1 Line start x
		 * @param {number} y1 Line start y
		 * @param {number} x2 Line end x
		 * @param {number} y2 Line end y
		 * @param {number} tolerance Distance tolerance
		 * @return {boolean} True if point is within tolerance of line
		 */
		isPointNearLine( point, x1, y1, x2, y2, tolerance ) {
			const dist = this.pointToSegmentDistance( point.x, point.y, x1, y1, x2, y2 );
			return dist <= ( tolerance || 6 );
		}

		/**
		 * Calculate distance from a point to a line segment
		 *
		 * @param {number} px Point x
		 * @param {number} py Point y
		 * @param {number} x1 Line start x
		 * @param {number} y1 Line start y
		 * @param {number} x2 Line end x
		 * @param {number} y2 Line end y
		 * @return {number} Distance to nearest point on segment
		 */
		pointToSegmentDistance( px, py, x1, y1, x2, y2 ) {
			const dx = x2 - x1;
			const dy = y2 - y1;

			if ( dx === 0 && dy === 0 ) {
				return Math.sqrt( Math.pow( px - x1, 2 ) + Math.pow( py - y1, 2 ) );
			}

			let t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / ( dx * dx + dy * dy );
			t = Math.max( 0, Math.min( 1, t ) );

			const projX = x1 + t * dx;
			const projY = y1 + t * dy;

			return Math.sqrt( Math.pow( px - projX, 2 ) + Math.pow( py - projY, 2 ) );
		}

		/**
		 * Test if a point is near a quadratic Bézier curve
		 *
		 * @param {Object} point Point with x, y
		 * @param {number} x1 Start x
		 * @param {number} y1 Start y
		 * @param {number} cx Control point x
		 * @param {number} cy Control point y
		 * @param {number} x2 End x
		 * @param {number} y2 End y
		 * @param {number} tolerance Distance tolerance
		 * @return {boolean} True if point is within tolerance of curve
		 */
		isPointNearQuadraticBezier( point, x1, y1, cx, cy, x2, y2, tolerance ) {
			const dist = this.pointToQuadraticBezierDistance( point.x, point.y, x1, y1, cx, cy, x2, y2 );
			return dist <= ( tolerance || 6 );
		}

		/**
		 * Calculate minimum distance from a point to a quadratic Bézier curve
		 * Uses adaptive subdivision for accuracy
		 *
		 * @param {number} px Point x
		 * @param {number} py Point y
		 * @param {number} x1 Start x
		 * @param {number} y1 Start y
		 * @param {number} cx Control point x
		 * @param {number} cy Control point y
		 * @param {number} x2 End x
		 * @param {number} y2 End y
		 * @return {number} Minimum distance to curve
		 */
		pointToQuadraticBezierDistance( px, py, x1, y1, cx, cy, x2, y2 ) {
			// Sample the curve at multiple points and find minimum distance
			// Use 20 samples for a good balance of accuracy and performance
			const numSamples = 20;
			let minDist = Infinity;

			for ( let i = 0; i <= numSamples; i++ ) {
				const t = i / numSamples;
				// Quadratic Bézier formula: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
				const invT = 1 - t;
				const bx = invT * invT * x1 + 2 * invT * t * cx + t * t * x2;
				const by = invT * invT * y1 + 2 * invT * t * cy + t * t * y2;

				const dist = Math.sqrt( Math.pow( px - bx, 2 ) + Math.pow( py - by, 2 ) );
				if ( dist < minDist ) {
					minDist = dist;
				}
			}

			return minDist;
		}

		/**
		 * Test if a point is inside a polygon using ray casting
		 *
		 * @param {Object} point Point with x, y
		 * @param {Array} polygonPoints Array of points defining polygon vertices
		 * @return {boolean} True if point is inside polygon
		 */
		isPointInPolygon( point, polygonPoints ) {
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
		 * Clean up resources
		 */
		destroy() {
			this.manager = null;
		}
	}

	// ==================== Export ====================

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Canvas.HitTestController = HitTestController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = HitTestController;
	}

}() );
