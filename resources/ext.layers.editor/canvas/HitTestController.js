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
		 * Uses expanded hit areas for easier clicking - the visual handle size
		 * is 8px (14px on touch) but the clickable area is 4px larger on each side.
		 *
		 * @param {Object} point Point with x, y coordinates
		 * @return {Object|null} The hit handle or null if none hit
		 */
		hitTestSelectionHandles( point ) {
			// Extra padding around handles for easier clicking (4px each side = 8px total)
			const hitTolerance = 4;

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
				// Expand rect by tolerance for easier clicking
				const expandedRect = {
					x: rect.x - hitTolerance,
					y: rect.y - hitTolerance,
					width: rect.width + hitTolerance * 2,
					height: rect.height + hitTolerance * 2
				};
				if ( this.isPointInRect( point, expandedRect ) ) {
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
				case 'callout':
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

				case 'customShape':
					// Custom shapes use bounding box hit testing
					return this.isPointInRectangleLayer( point, layer );

				case 'marker':
					// Markers use circular hit testing based on size
					return this.isPointInMarker( point, layer );

				case 'dimension':
					// Dimensions use line-based hit testing
					return this.isPointNearDimension( point, layer );

				case 'angleDimension':
					// Angle dimensions use arc and arm line hit testing
					return this.isPointNearAngleDimension( point, layer );

				default:
					return false;
			}
		}

		// ==================== Shape-Specific Hit Tests ====================

		/**
		 * Test if point is in a marker layer (circle centered at x,y)
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Marker layer
		 * @return {boolean} True if hit
		 */
		isPointInMarker( point, layer ) {
			const x = layer.x || 0;
			const y = layer.y || 0;
			const size = layer.size || 24;
			const radius = size / 2 + 5; // Add tolerance

			const dx = point.x - x;
			const dy = point.y - y;
			const distance = Math.sqrt( dx * dx + dy * dy );

			if ( distance <= radius ) {
				return true;
			}

			// Also check if point is near the arrow line
			if ( layer.hasArrow && layer.arrowX !== undefined && layer.arrowY !== undefined ) {
				const arrowDist = this.pointToLineDistance( point.x, point.y, x, y, layer.arrowX, layer.arrowY );
				return arrowDist <= 8;
			}

			return false;
		}

		/**
		 * Test if point is near a dimension layer (line between x1,y1 and x2,y2)
		 * The actual dimension line is offset from the measurement points by the extension lines
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Dimension layer
		 * @return {boolean} True if hit
		 */
		isPointNearDimension( point, layer ) {
			const x1 = layer.x1 || 0;
			const y1 = layer.y1 || 0;
			const x2 = layer.x2 || 0;
			const y2 = layer.y2 || 0;

			// Calculate the angle and perpendicular direction
			const dx = x2 - x1;
			const dy = y2 - y1;
			const distance = Math.sqrt( dx * dx + dy * dy );
			const angle = Math.atan2( dy, dx );
			const perpX = -Math.sin( angle );
			const perpY = Math.cos( angle );

			// Unit vector along the dimension line
			const unitDx = distance > 0 ? dx / distance : 1;
			const unitDy = distance > 0 ? dy / distance : 0;

			// Get offset distance (same logic as DimensionRenderer/SelectionRenderer)
			let offsetDistance;
			if ( typeof layer.dimensionOffset === 'number' && !isNaN( layer.dimensionOffset ) ) {
				offsetDistance = layer.dimensionOffset;
			} else {
				// Legacy/default: calculate from extensionGap and extensionLength
				let extensionLength = layer.extensionLength;
				if ( typeof extensionLength !== 'number' || isNaN( extensionLength ) ) {
					extensionLength = 10; // DEFAULTS.extensionLength from DimensionRenderer
				}
				let extensionGap = layer.extensionGap;
				if ( typeof extensionGap !== 'number' || isNaN( extensionGap ) ) {
					extensionGap = 3; // DEFAULTS.extensionGap from DimensionRenderer
				}
				offsetDistance = extensionGap + extensionLength / 2;
			}

			// Calculate dimension line endpoints
			// Positive offset = above the measurement line (negative perp direction)
			const dimX1 = x1 - perpX * offsetDistance;
			const dimY1 = y1 - perpY * offsetDistance;
			const dimX2 = x2 - perpX * offsetDistance;
			const dimY2 = y2 - perpY * offsetDistance;

			// Test 1: Distance to the dimension line itself
			const distanceToDimLine = this.pointToLineDistance( point.x, point.y, dimX1, dimY1, dimX2, dimY2 );
			if ( distanceToDimLine <= 15 ) {
				return true;
			}

			// Test 2: Distance to extension lines (from anchor to dimension line)
			const distanceToExt1 = this.pointToLineDistance( point.x, point.y, x1, y1, dimX1, dimY1 );
			if ( distanceToExt1 <= 8 ) {
				return true;
			}
			const distanceToExt2 = this.pointToLineDistance( point.x, point.y, x2, y2, dimX2, dimY2 );
			if ( distanceToExt2 <= 8 ) {
				return true;
			}

			// Test 3: Text area - account for textOffset (can be outside extension lines)
			// textOffset shifts text along the dimension line from center
			const textOffset = typeof layer.textOffset === 'number' ? layer.textOffset : 0;
			const textX = ( dimX1 + dimX2 ) / 2 + unitDx * textOffset;
			const textY = ( dimY1 + dimY2 ) / 2 + unitDy * textOffset;
			const fontSize = layer.fontSize || 12;
			const textHitRadius = Math.max( fontSize * 1.5, 25 ); // Generous hit area for text
			const distToText = Math.sqrt(
				( point.x - textX ) * ( point.x - textX ) +
				( point.y - textY ) * ( point.y - textY )
			);
			if ( distToText <= textHitRadius ) {
				return true;
			}

			return false;
		}

		/**
		 * Test if point is near an angle dimension layer
		 * Checks proximity to arc, arm lines, and text area
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Angle dimension layer
		 * @return {boolean} True if hit
		 */
		isPointNearAngleDimension( point, layer ) {
			const cx = layer.cx || 0;
			const cy = layer.cy || 0;
			const ax = layer.ax || 0;
			const ay = layer.ay || 0;
			const bx = layer.bx || 0;
			const by = layer.by || 0;
			const arcRadius = layer.arcRadius || 40;

			// Test 1: Near vertex point
			const distToVertex = Math.sqrt(
				( point.x - cx ) * ( point.x - cx ) +
				( point.y - cy ) * ( point.y - cy )
			);
			if ( distToVertex <= 10 ) {
				return true;
			}

			// Test 2: Near arm1 line (vertex to arm1 endpoint)
			const distToArm1 = this.pointToLineDistance( point.x, point.y, cx, cy, ax, ay );
			if ( distToArm1 <= 8 ) {
				return true;
			}

			// Test 3: Near arm2 line (vertex to arm2 endpoint)
			const distToArm2 = this.pointToLineDistance( point.x, point.y, cx, cy, bx, by );
			if ( distToArm2 <= 8 ) {
				return true;
			}

			// Test 4: Near the arc
			const distFromVertex = Math.sqrt(
				( point.x - cx ) * ( point.x - cx ) +
				( point.y - cy ) * ( point.y - cy )
			);
			// Check if distance from vertex is approximately arcRadius
			if ( Math.abs( distFromVertex - arcRadius ) <= 10 ) {
				// Also check point is within the angle sweep
				const pointAngle = Math.atan2( point.y - cy, point.x - cx );
				const startAngle = Math.atan2( ay - cy, ax - cx );
				const endAngle = Math.atan2( by - cy, bx - cx );

				// Determine sweep
				let sweep = endAngle - startAngle;
				const reflexAngle = layer.reflexAngle === true || layer.reflexAngle === 1;

				if ( !reflexAngle ) {
					if ( sweep < 0 ) {
						sweep += 2 * Math.PI;
					}
					if ( sweep > Math.PI ) {
						sweep = sweep - 2 * Math.PI;
					}
				} else {
					if ( sweep <= 0 ) {
						sweep += 2 * Math.PI;
					}
					if ( sweep <= Math.PI ) {
						sweep = sweep + 2 * Math.PI;
					}
					if ( sweep > 2 * Math.PI ) {
						sweep -= 2 * Math.PI;
					}
				}

				// Check if the point angle is within the arc sweep
				let testAngle = pointAngle - startAngle;
				if ( sweep >= 0 ) {
					while ( testAngle < 0 ) {
						testAngle += 2 * Math.PI;
					}
					while ( testAngle > 2 * Math.PI ) {
						testAngle -= 2 * Math.PI;
					}
					if ( testAngle <= sweep + 0.2 ) {
						return true;
					}
				} else {
					while ( testAngle > 0 ) {
						testAngle -= 2 * Math.PI;
					}
					while ( testAngle < -2 * Math.PI ) {
						testAngle += 2 * Math.PI;
					}
					if ( testAngle >= sweep - 0.2 ) {
						return true;
					}
				}
			}

			return false;
		}

		/**
		 * Calculate distance from point to line segment
		 *
		 * @param {number} px Point X
		 * @param {number} py Point Y
		 * @param {number} x1 Line start X
		 * @param {number} y1 Line start Y
		 * @param {number} x2 Line end X
		 * @param {number} y2 Line end Y
		 * @return {number} Distance from point to line
		 */
		pointToLineDistance( px, py, x1, y1, x2, y2 ) {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const lengthSq = dx * dx + dy * dy;

			if ( lengthSq === 0 ) {
				return Math.sqrt( ( px - x1 ) * ( px - x1 ) + ( py - y1 ) * ( py - y1 ) );
			}

			let t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / lengthSq;
			t = Math.max( 0, Math.min( 1, t ) );

			const projX = x1 + t * dx;
			const projY = y1 + t * dy;

			return Math.sqrt( ( px - projX ) * ( px - projX ) + ( py - projY ) * ( py - projY ) );
		}

		/**
		 * Test if point is in a rectangle or blur layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Rectangle/blur layer
		 * @return {boolean} True if hit
		 */
		isPointInRectangleLayer( point, layer ) {
			let testPoint = point;

			// Un-rotate test point around layer center if layer is rotated
			if ( layer.rotation ) {
				const cx = layer.x + layer.width / 2;
				const cy = layer.y + layer.height / 2;
				const rad = -( layer.rotation * Math.PI ) / 180;
				const cos = Math.cos( rad );
				const sin = Math.sin( rad );
				const dx = point.x - cx;
				const dy = point.y - cy;
				testPoint = {
					x: cx + dx * cos - dy * sin,
					y: cy + dx * sin + dy * cos
				};
			}

			const minX = Math.min( layer.x, layer.x + layer.width );
			const minY = Math.min( layer.y, layer.y + layer.height );
			const w = Math.abs( layer.width );
			const h = Math.abs( layer.height );
			return testPoint.x >= minX && testPoint.x <= minX + w &&
				testPoint.y >= minY && testPoint.y <= minY + h;
		}

		/**
		 * Test if point is in a circle layer
		 *
		 * @param {Object} point Point with x, y
		 * @param {Object} layer Circle layer
		 * @return {boolean} True if hit
		 */
		isPointInCircle( point, layer ) {
			let testPoint = point;

			// Un-rotate test point if layer is rotated
			if ( layer.rotation ) {
				const cx = layer.x || 0;
				const cy = layer.y || 0;
				const rad = -( layer.rotation * Math.PI ) / 180;
				const cos = Math.cos( rad );
				const sin = Math.sin( rad );
				const dx = point.x - cx;
				const dy = point.y - cy;
				testPoint = {
					x: cx + dx * cos - dy * sin,
					y: cy + dx * sin + dy * cos
				};
			}

			const ddx = testPoint.x - ( layer.x || 0 );
			const ddy = testPoint.y - ( layer.y || 0 );
			const r = layer.radius || 0;
			return ( ddx * ddx + ddy * ddy ) <= r * r;
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

			let testPoint = point;

			// Un-rotate test point if layer is rotated
			if ( layer.rotation ) {
				const rad = -( layer.rotation * Math.PI ) / 180;
				const cos = Math.cos( rad );
				const sin = Math.sin( rad );
				const dx = point.x - ex;
				const dy = point.y - ey;
				testPoint = {
					x: ex + dx * cos - dy * sin,
					y: ey + dx * sin + dy * cos
				};
			}

			const nx = ( testPoint.x - ex ) / radX;
			const ny = ( testPoint.y - ey ) / radY;
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
