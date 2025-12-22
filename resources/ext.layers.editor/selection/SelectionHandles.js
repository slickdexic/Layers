/**
 * Selection Handles Manager for Layers Editor
 * Handles creation and hit-testing of selection handles for resize/rotate
 *
 * @class SelectionHandles
 */
( function () {
	'use strict';

	/**
	 * SelectionHandles class
	 * Manages selection handles (resize corners, edges, rotation handle)
	 */
	class SelectionHandles {
		/**
		 * Create a SelectionHandles instance
		 *
		 * @param {Object} options Configuration options
		 * @param {number} [options.handleSize=8] Size of handle rectangles
		 * @param {number} [options.rotationHandleOffset=20] Offset for rotation handle above selection
		 */
		constructor( options = {} ) {
			this.options = options;
			this.handleSize = options.handleSize || 8;
			this.rotationHandleOffset = options.rotationHandleOffset || 20;

			// Current handles
			this.handles = [];
		}

		/**
		 * Create handles for a single layer selection
		 *
		 * @param {Object} bounds Layer bounds { x, y, width, height }
		 * @param {Object} options Additional options
		 * @param {boolean} [options.includeRotation=true] Whether to include rotation handle
		 * @param {boolean} [options.includeEdges=true] Whether to include edge handles
		 * @return {Array} Array of handle objects
		 */
		createSingleSelectionHandles( bounds, options = {} ) {
			if ( !bounds ) {
				this.handles = [];
				return this.handles;
			}

			const includeRotation = options.includeRotation !== false;
			const includeEdges = options.includeEdges !== false;

			const handlePositions = [];

			// Corner handles (always included)
			handlePositions.push(
				{ x: bounds.x, y: bounds.y, type: 'nw', cursor: 'nw-resize' },
				{ x: bounds.x + bounds.width, y: bounds.y, type: 'ne', cursor: 'ne-resize' },
				{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se', cursor: 'se-resize' },
				{ x: bounds.x, y: bounds.y + bounds.height, type: 'sw', cursor: 'sw-resize' }
			);

			// Edge handles
			if ( includeEdges ) {
				handlePositions.push(
					{ x: bounds.x + bounds.width / 2, y: bounds.y, type: 'n', cursor: 'n-resize' },
					{ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, type: 'e', cursor: 'e-resize' },
					{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, type: 's', cursor: 's-resize' },
					{ x: bounds.x, y: bounds.y + bounds.height / 2, type: 'w', cursor: 'w-resize' }
				);
			}

			// Rotation handle
			if ( includeRotation ) {
				handlePositions.push( {
					x: bounds.x + bounds.width / 2,
					y: bounds.y - this.rotationHandleOffset,
					type: 'rotate',
					cursor: 'crosshair'
				} );
			}

			this.handles = this.createHandleObjects( handlePositions );
			return this.handles;
		}

		/**
		 * Create handles for multi-layer selection
		 *
		 * @param {Object} bounds Combined bounds { x, y, width, height }
		 * @param {Object} options Additional options
		 * @param {boolean} [options.includeRotation=false] Whether to include rotation handle
		 * @return {Array} Array of handle objects
		 */
		createMultiSelectionHandles( bounds, options = {} ) {
			if ( !bounds ) {
				this.handles = [];
				return this.handles;
			}

			const includeRotation = options.includeRotation === true;

			const handlePositions = [
				// Corner handles only for multi-selection
				{ x: bounds.x, y: bounds.y, type: 'nw', cursor: 'nw-resize' },
				{ x: bounds.x + bounds.width, y: bounds.y, type: 'ne', cursor: 'ne-resize' },
				{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se', cursor: 'se-resize' },
				{ x: bounds.x, y: bounds.y + bounds.height, type: 'sw', cursor: 'sw-resize' }
			];

			// Optional rotation handle for multi-selection
			if ( includeRotation ) {
				handlePositions.push( {
					x: bounds.x + bounds.width / 2,
					y: bounds.y - this.rotationHandleOffset,
					type: 'rotate',
					cursor: 'crosshair'
				} );
			}

			this.handles = this.createHandleObjects( handlePositions );
			return this.handles;
		}

		/**
		 * Create handle objects from position array
		 *
		 * @param {Array} positions Array of position objects
		 * @return {Array} Array of handle objects with rects
		 */
		createHandleObjects( positions ) {
			const halfSize = this.handleSize / 2;

			return positions.map( ( pos ) => ( {
				x: pos.x,
				y: pos.y,
				type: pos.type,
				cursor: pos.cursor || 'default',
				rect: {
					x: pos.x - halfSize,
					y: pos.y - halfSize,
					width: this.handleSize,
					height: this.handleSize
				}
			} ) );
		}

		/**
		 * Clear all handles
		 */
		clear() {
			this.handles = [];
		}

		/**
		 * Get current handles
		 *
		 * @return {Array} Array of handle objects
		 */
		getHandles() {
			return this.handles;
		}

		/**
		 * Hit test selection handles
		 *
		 * @param {Object} point Point to test { x, y }
		 * @return {Object|null} Handle object if hit, null otherwise
		 */
		hitTest( point ) {
			for ( let i = 0; i < this.handles.length; i++ ) {
				const handle = this.handles[ i ];
				if ( this.pointInRect( point, handle.rect ) ) {
					return handle;
				}
			}
			return null;
		}

		/**
		 * Check if point is in rectangle
		 *
		 * @param {Object} point Point to test { x, y }
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
		 * Get cursor for a handle type
		 *
		 * @param {string} handleType Handle type (nw, ne, se, sw, n, e, s, w, rotate)
		 * @param {number} [layerRotation=0] Current layer rotation in degrees (reserved for future use)
		 * @return {string} CSS cursor value
		 */
		getCursor( handleType, layerRotation = 0 ) {
			// layerRotation parameter reserved for future cursor adjustment based on layer rotation
			void layerRotation;

			if ( handleType === 'rotate' ) {
				return 'crosshair';
			}

			// Map handle types to base cursors
			const cursors = {
				nw: 'nwse-resize',
				se: 'nwse-resize',
				ne: 'nesw-resize',
				sw: 'nesw-resize',
				n: 'ns-resize',
				s: 'ns-resize',
				e: 'ew-resize',
				w: 'ew-resize'
			};

			const baseCursor = cursors[ handleType ];
			if ( !baseCursor ) {
				return 'default';
			}

			// For rotated layers, we could adjust cursor based on rotation
			// For now, return base cursor
			return baseCursor;
		}

		/**
		 * Get handle type opposite to given type
		 *
		 * @param {string} handleType Handle type
		 * @return {string} Opposite handle type
		 */
		getOppositeHandle( handleType ) {
			const opposites = {
				nw: 'se',
				ne: 'sw',
				se: 'nw',
				sw: 'ne',
				n: 's',
				s: 'n',
				e: 'w',
				w: 'e'
			};
			return opposites[ handleType ] || handleType;
		}

		/**
		 * Check if handle type is a corner
		 *
		 * @param {string} handleType Handle type
		 * @return {boolean} True if corner handle
		 */
		isCornerHandle( handleType ) {
			return [ 'nw', 'ne', 'se', 'sw' ].indexOf( handleType ) !== -1;
		}

		/**
		 * Check if handle type is an edge
		 *
		 * @param {string} handleType Handle type
		 * @return {boolean} True if edge handle
		 */
		isEdgeHandle( handleType ) {
			return [ 'n', 'e', 's', 'w' ].indexOf( handleType ) !== -1;
		}

		/**
		 * Check if handle type is rotation
		 *
		 * @param {string} handleType Handle type
		 * @return {boolean} True if rotation handle
		 */
		isRotationHandle( handleType ) {
			return handleType === 'rotate';
		}

		/**
		 * Get rendering info for all handles
		 *
		 * @return {Array} Array of handle render info
		 */
		getRenderInfo() {
			return this.handles.map( ( handle ) => ( {
				x: handle.x,
				y: handle.y,
				type: handle.type,
				size: this.handleSize,
				rect: { ...handle.rect }
			} ) );
		}

		/**
		 * Update handle size
		 *
		 * @param {number} size New handle size
		 */
		setHandleSize( size ) {
			this.handleSize = size;
			// Recalculate rects for existing handles
			const halfSize = size / 2;
			this.handles.forEach( ( handle ) => {
				handle.rect = {
					x: handle.x - halfSize,
					y: handle.y - halfSize,
					width: size,
					height: size
				};
			} );
		}

		/**
		 * Update rotation handle offset
		 *
		 * @param {number} offset New offset distance
		 */
		setRotationHandleOffset( offset ) {
			this.rotationHandleOffset = offset;
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.handles = [];
			this.options = {};
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Selection = window.Layers.Selection || {};
		window.Layers.Selection.SelectionHandles = SelectionHandles;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SelectionHandles;
	}

}() );
