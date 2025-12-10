/**
 * Marquee Selection for Layers Editor
 * Handles drag-to-select rectangle logic for selecting multiple layers
 *
 * @class MarqueeSelection
 */
( function () {
	'use strict';

	/**
	 * MarqueeSelection class
	 * Manages marquee (lasso) selection for selecting multiple layers by drawing a rectangle
	 */
	class MarqueeSelection {
		/**
		 * Create a MarqueeSelection instance
		 *
		 * @param {Object} options Configuration options
		 * @param {Function} [options.getLayersArray] Function to retrieve layers array
		 * @param {Function} [options.getLayerBounds] Function to get bounds of a layer
		 * @param {Function} [options.onSelectionUpdate] Callback when selection updates during marquee
		 */
		constructor( options = {} ) {
			this.options = options;

			// Marquee state
			this.isSelecting = false;
			this.startPoint = null;
			this.endPoint = null;
		}

		/**
		 * Get the layers array from the configured source
		 *
		 * @return {Array} Array of layer objects
		 */
		getLayersArray() {
			if ( typeof this.options.getLayersArray === 'function' ) {
				return this.options.getLayersArray() || [];
			}
			return [];
		}

		/**
		 * Get bounds for a layer
		 *
		 * @param {Object} layer Layer object
		 * @return {Object|null} Bounds { x, y, width, height } or null
		 */
		getLayerBounds( layer ) {
			if ( typeof this.options.getLayerBounds === 'function' ) {
				return this.options.getLayerBounds( layer );
			}
			return this.calculateLayerBounds( layer );
		}

		/**
		 * Start marquee selection
		 *
		 * @param {Object|number} xOrPoint Starting point or x coordinate
		 * @param {number} [y] y coordinate when using numeric args
		 */
		start( xOrPoint, y ) {
			this.isSelecting = true;
			const pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
			this.startPoint = { x: pt.x, y: pt.y };
			this.endPoint = { x: pt.x, y: pt.y };
		}

		/**
		 * Update marquee selection
		 *
		 * @param {Object|number} xOrPoint Current point or x coordinate
		 * @param {number} [y] y coordinate when using numeric args
		 * @return {Array} Array of layer IDs within the marquee
		 */
		update( xOrPoint, y ) {
			if ( !this.isSelecting ) {
				return [];
			}

			const pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
			this.endPoint = { x: pt.x, y: pt.y };

			// Find layers within marquee
			const marqueeRect = this.getRect();
			const layers = this.getLayersArray();
			const selectedIds = [];

			layers.forEach( ( layer ) => {
				// Skip invisible or locked layers
				if ( layer.visible === false || layer.locked === true ) {
					return;
				}

				const bounds = this.getLayerBounds( layer );
				if ( bounds && this.rectIntersects( marqueeRect, bounds ) ) {
					selectedIds.push( layer.id );
				}
			} );

			// Notify callback
			if ( typeof this.options.onSelectionUpdate === 'function' ) {
				this.options.onSelectionUpdate( selectedIds );
			}

			return selectedIds;
		}

		/**
		 * Finish marquee selection
		 *
		 * @return {Array} Final array of selected layer IDs
		 */
		finish() {
			const selectedIds = this.isSelecting ? this.getSelectedIds() : [];
			this.isSelecting = false;
			this.startPoint = null;
			this.endPoint = null;
			return selectedIds;
		}

		/**
		 * Cancel marquee selection without selecting
		 */
		cancel() {
			this.isSelecting = false;
			this.startPoint = null;
			this.endPoint = null;
		}

		/**
		 * Check if marquee selection is active
		 *
		 * @return {boolean} True if selecting
		 */
		isActive() {
			return this.isSelecting;
		}

		/**
		 * Get current marquee selection rectangle
		 *
		 * @return {Object} Rectangle { x, y, width, height }
		 */
		getRect() {
			if ( !this.startPoint || !this.endPoint ) {
				return { x: 0, y: 0, width: 0, height: 0 };
			}

			const minX = Math.min( this.startPoint.x, this.endPoint.x );
			const minY = Math.min( this.startPoint.y, this.endPoint.y );
			const maxX = Math.max( this.startPoint.x, this.endPoint.x );
			const maxY = Math.max( this.startPoint.y, this.endPoint.y );

			return {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY
			};
		}

		/**
		 * Get selected layer IDs based on current marquee
		 *
		 * @return {Array} Array of layer IDs within the marquee
		 */
		getSelectedIds() {
			if ( !this.isSelecting ) {
				return [];
			}

			const marqueeRect = this.getRect();
			const layers = this.getLayersArray();
			const selectedIds = [];

			layers.forEach( ( layer ) => {
				// Skip invisible or locked layers
				if ( layer.visible === false || layer.locked === true ) {
					return;
				}

				const bounds = this.getLayerBounds( layer );
				if ( bounds && this.rectIntersects( marqueeRect, bounds ) ) {
					selectedIds.push( layer.id );
				}
			} );

			return selectedIds;
		}

		/**
		 * Check if two rectangles intersect
		 *
		 * @param {Object} rect1 First rectangle { x, y, width, height }
		 * @param {Object} rect2 Second rectangle { x, y, width, height }
		 * @return {boolean} True if rectangles intersect
		 */
		rectIntersects( rect1, rect2 ) {
			return rect1.x < rect2.x + rect2.width &&
				rect1.x + rect1.width > rect2.x &&
				rect1.y < rect2.y + rect2.height &&
				rect1.y + rect1.height > rect2.y;
		}

		/**
		 * Check if a point is inside a rectangle
		 *
		 * @param {Object} point Point { x, y }
		 * @param {Object} rect Rectangle { x, y, width, height }
		 * @return {boolean} True if point is inside rectangle
		 */
		pointInRect( point, rect ) {
			return point.x >= rect.x &&
				point.x <= rect.x + rect.width &&
				point.y >= rect.y &&
				point.y <= rect.y + rect.height;
		}

		/**
		 * Calculate layer bounds (fallback when no getLayerBounds option provided)
		 *
		 * @param {Object} layer Layer object
		 * @return {Object|null} Bounds { x, y, width, height } or null
		 */
		calculateLayerBounds( layer ) {
			if ( !layer ) {
				return null;
			}

			// Common case: rectangular bounds
			if ( typeof layer.x === 'number' && typeof layer.y === 'number' &&
				typeof layer.width === 'number' && typeof layer.height === 'number' ) {
				const minX = Math.min( layer.x, layer.x + layer.width );
				const minY = Math.min( layer.y, layer.y + layer.height );
				return {
					x: minX,
					y: minY,
					width: Math.abs( layer.width ),
					height: Math.abs( layer.height )
				};
			}

			// Line/arrow
			if ( typeof layer.x1 === 'number' && typeof layer.y1 === 'number' &&
				typeof layer.x2 === 'number' && typeof layer.y2 === 'number' ) {
				const lx1 = Math.min( layer.x1, layer.x2 );
				const ly1 = Math.min( layer.y1, layer.y2 );
				const lx2 = Math.max( layer.x1, layer.x2 );
				const ly2 = Math.max( layer.y1, layer.y2 );
				return { x: lx1, y: ly1, width: lx2 - lx1, height: ly2 - ly1 };
			}

			// Ellipse/circle with center + radii
			if ( typeof layer.x === 'number' && typeof layer.y === 'number' &&
				( typeof layer.radius === 'number' ||
					typeof layer.radiusX === 'number' || typeof layer.radiusY === 'number' ) ) {
				const hasRX = ( layer.radiusX !== null && layer.radiusX !== undefined );
				const hasRY = ( layer.radiusY !== null && layer.radiusY !== undefined );
				const rx = Math.abs( hasRX ? layer.radiusX : ( layer.radius || 0 ) );
				const ry = Math.abs( hasRY ? layer.radiusY : ( layer.radius || 0 ) );
				return { x: layer.x - rx, y: layer.y - ry, width: rx * 2, height: ry * 2 };
			}

			// Path/polygon points
			if ( Array.isArray( layer.points ) && layer.points.length >= 3 ) {
				let minPX = Infinity, minPY = Infinity, maxPX = -Infinity, maxPY = -Infinity;
				for ( let i = 0; i < layer.points.length; i++ ) {
					const p = layer.points[ i ];
					minPX = Math.min( minPX, p.x );
					minPY = Math.min( minPY, p.y );
					maxPX = Math.max( maxPX, p.x );
					maxPY = Math.max( maxPY, p.y );
				}
				return { x: minPX, y: minPY, width: maxPX - minPX, height: maxPY - minPY };
			}

			return null;
		}

		/**
		 * Get rendering info for drawing the marquee rectangle
		 *
		 * @return {Object|null} Rendering info or null if not selecting
		 */
		getRenderInfo() {
			if ( !this.isSelecting || !this.startPoint || !this.endPoint ) {
				return null;
			}

			return {
				rect: this.getRect(),
				startPoint: { ...this.startPoint },
				endPoint: { ...this.endPoint }
			};
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.isSelecting = false;
			this.startPoint = null;
			this.endPoint = null;
			this.options = {};
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Selection = window.Layers.Selection || {};
		window.Layers.Selection.MarqueeSelection = MarqueeSelection;

		// Backward compatibility - direct window export
		window.MarqueeSelection = MarqueeSelection;
	}

	// Export for Node.js/Jest testing
	/* eslint-disable-next-line no-undef */
	if ( typeof module !== 'undefined' && module.exports ) {
		/* eslint-disable-next-line no-undef */
		module.exports = MarqueeSelection;
	}

}() );
