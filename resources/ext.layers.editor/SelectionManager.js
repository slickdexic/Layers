/**
 * Selection Manager for Layers Editor
 * Handles layer selection, manipulation, and transformation
 */
( function () {
	'use strict';

	/**
	 * Minimal typedef for CanvasManager used for JSDoc references in this file.
	 *
	 * @typedef {Object} CanvasManager
	 * @property {HTMLCanvasElement} canvas
	 * @property {CanvasRenderingContext2D} ctx
	 */

	/**
	 * SelectionManager class
	 *
	 * @param {Object} config Configuration object
	 * @param {CanvasManager} canvasManager Reference to the canvas manager
	 * @class
	 */
	function SelectionManager( config, canvasManager ) {
		// Back-compat: allow new SelectionManager(canvasManager)
		if ( config && !canvasManager && ( config.canvas || config.layers ) ) {
			canvasManager = config;
			config = {};
		}

		this.config = config || {};
		this.canvasManager = canvasManager;

		// Selection state
		this.selectedLayerIds = [];
		this.selectionHandles = [];
		this.isResizing = false;
		this.isRotating = false;
		this.isDragging = false;
		this.resizeHandle = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;

		// Marquee selection
		this.isMarqueeSelecting = false;
		this.marqueeStart = null;
		this.marqueeEnd = null;
		// Legacy property used in tests
		this.dragStart = null;

		// Multi-selection support
		this.multiSelectMode = false;
		this.lastSelectedId = null;
	}

	/**
	 * Select a layer by ID
	 *
	 * @param {string|null} layerId Layer ID to select, or null to clear
	 * @param {boolean} addToSelection Whether to add to existing selection
	 */
	SelectionManager.prototype.selectLayer = function ( layerId, addToSelection ) {
		if ( !addToSelection ) {
			this.clearSelection();
		}

		// Toggle behavior when adding to selection and already selected
		if ( addToSelection && layerId && this.isSelected( layerId ) ) {
			this.deselectLayer( layerId );
			return;
		}

		// Skip locked or invisible layers
		var layer = this.getLayerById( layerId );
		if (
			layerId && layer &&
			layer.locked !== true &&
			layer.visible !== false &&
			this.selectedLayerIds.indexOf( layerId ) === -1
		) {
			this.selectedLayerIds.push( layerId );
			this.lastSelectedId = layerId;
		}

		this.updateSelectionHandles();
		this.notifySelectionChange();
	};

	/**
	 * Deselect a layer by ID
	 *
	 * @param {string} layerId Layer ID to deselect
	 */
	SelectionManager.prototype.deselectLayer = function ( layerId ) {
		var index = this.selectedLayerIds.indexOf( layerId );
		if ( index !== -1 ) {
			this.selectedLayerIds.splice( index, 1 );

			if ( this.lastSelectedId === layerId ) {
				this.lastSelectedId = this.selectedLayerIds.length > 0 ?
					this.selectedLayerIds[ this.selectedLayerIds.length - 1 ] : null;
			}
		}

		this.updateSelectionHandles();
		this.notifySelectionChange();
	};

	/**
	 * Clear all selections
	 */
	SelectionManager.prototype.clearSelection = function () {
		this.selectedLayerIds = [];
		this.selectionHandles = [];
		this.lastSelectedId = null;
		this.notifySelectionChange();
	};

	/**
	 * Select all layers
	 */
	SelectionManager.prototype.selectAll = function () {
		var layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
			this.canvasManager.layers || [];
		this.selectedLayerIds = layers.map( function ( layer ) {
			return layer.id;
		} );

		if ( this.selectedLayerIds.length > 0 ) {
			this.lastSelectedId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ];
		}

		this.updateSelectionHandles();
		this.notifySelectionChange();
	};

	/**
	 * Check if a layer is selected
	 *
	 * @param {string} layerId Layer ID to check
	 * @return {boolean} True if selected
	 */
	SelectionManager.prototype.isSelected = function ( layerId ) {
		return this.selectedLayerIds.indexOf( layerId ) !== -1;
	};

	/**
	 * Get the number of selected layers
	 *
	 * @return {number} Number of selected layers
	 */
	SelectionManager.prototype.getSelectionCount = function () {
		return this.selectedLayerIds.length;
	};

	/**
	 * Get all selected layers
	 *
	 * @return {Array} Array of selected layer objects
	 */
	SelectionManager.prototype.getSelectedLayers = function () {
		var layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
			this.canvasManager.layers || [];
		return layers.filter( function ( layer ) {
			return this.isSelected( layer.id );
		}.bind( this ) );
	};

	/**
	 * Start marquee selection
	 *
	 * @param {Object|number} xOrPoint Starting point or x coordinate
	 * @param {number} [y] y coordinate when using numeric args
	 */
	SelectionManager.prototype.startMarqueeSelection = function ( xOrPoint, y ) {
		this.isMarqueeSelecting = true;
		var pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
		this.marqueeStart = { x: pt.x, y: pt.y };
		this.marqueeEnd = { x: pt.x, y: pt.y };
	};

	/**
	 * Update marquee selection
	 *
	 * @param {Object|number} xOrPoint Current point or x coordinate
	 * @param {number} [y] y coordinate when using numeric args
	 */
	SelectionManager.prototype.updateMarqueeSelection = function ( xOrPoint, y ) {
		if ( !this.isMarqueeSelecting ) {
			return;
		}

		var pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
		this.marqueeEnd = { x: pt.x, y: pt.y };

		// Find layers within marquee
		var marqueeRect = this.getMarqueeRect();
		var layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
			this.canvasManager.layers || [];
		var newSelection = [];

		layers.forEach( function ( layer ) {
			var bounds = this.getLayerBoundsCompat( layer );
			if ( bounds && this.rectIntersects( marqueeRect, bounds ) ) {
				newSelection.push( layer.id );
			}
		}.bind( this ) );

		// Update selection
		this.selectedLayerIds = newSelection;
		this.notifySelectionChange();
		if ( this.canvasManager && typeof this.canvasManager.redraw === 'function' ) {
			this.canvasManager.redraw();
		}
	};

	/**
	 * Finish marquee selection
	 */
	SelectionManager.prototype.finishMarqueeSelection = function () {
		this.isMarqueeSelecting = false;
		this.updateSelectionHandles();
		this.marqueeStart = null;
		this.marqueeEnd = null;
	};

	/**
	 * Get marquee selection rectangle
	 *
	 * @return {Object} Rectangle object
	 */
	SelectionManager.prototype.getMarqueeRect = function () {
		if ( !this.marqueeStart || !this.marqueeEnd ) {
			return { x: 0, y: 0, width: 0, height: 0 };
		}
		var minX = Math.min( this.marqueeStart.x, this.marqueeEnd.x );
		var minY = Math.min( this.marqueeStart.y, this.marqueeEnd.y );
		var maxX = Math.max( this.marqueeStart.x, this.marqueeEnd.x );
		var maxY = Math.max( this.marqueeStart.y, this.marqueeEnd.y );

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	};

	/**
	 * Check if two rectangles intersect
	 *
	 * @param {Object} rect1 First rectangle
	 * @param {Object} rect2 Second rectangle
	 * @return {boolean} True if intersecting
	 */
	SelectionManager.prototype.rectIntersects = function ( rect1, rect2 ) {
		return rect1.x < rect2.x + rect2.width &&
			rect1.x + rect1.width > rect2.x &&
			rect1.y < rect2.y + rect2.height &&
			rect1.y + rect1.height > rect2.y;
	};

	/**
	 * Update selection handles
	 */
	SelectionManager.prototype.updateSelectionHandles = function () {
		this.selectionHandles = [];

		if ( this.selectedLayerIds.length === 1 ) {
			// Single selection - show transformation handles
			var layer = this.getLayerById( this.selectedLayerIds[ 0 ] );
			if ( layer ) {
				this.createSingleSelectionHandles( layer );
			}
		} else if ( this.selectedLayerIds.length > 1 ) {
			// Multi-selection - show group handles
			this.createMultiSelectionHandles();
		}
	};

	/**
	 * Create selection handles for single layer
	 *
	 * @param {Object} layer Layer object
	 */
	SelectionManager.prototype.createSingleSelectionHandles = function ( layer ) {
		var bounds = this.getLayerBoundsCompat( layer );
		if ( !bounds ) {
			return;
		}

		var handleSize = 8;
		var handles = [
			// Corner handles
			{ x: bounds.x, y: bounds.y, type: 'nw' },
			{ x: bounds.x + bounds.width, y: bounds.y, type: 'ne' },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' },
			{ x: bounds.x, y: bounds.y + bounds.height, type: 'sw' },

			// Edge handles
			{ x: bounds.x + bounds.width / 2, y: bounds.y, type: 'n' },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, type: 'e' },
			{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, type: 's' },
			{ x: bounds.x, y: bounds.y + bounds.height / 2, type: 'w' }
		];

		// Add rotation handle
		handles.push( {
			x: bounds.x + bounds.width / 2,
			y: bounds.y - 20,
			type: 'rotate'
		} );

		this.selectionHandles = handles.map( function ( handle ) {
			return {
				x: handle.x,
				y: handle.y,
				type: handle.type,
				rect: {
					x: handle.x - handleSize / 2,
					y: handle.y - handleSize / 2,
					width: handleSize,
					height: handleSize
				}
			};
		} );
	};

	/**
	 * Create selection handles for multiple layers
	 */
	SelectionManager.prototype.createMultiSelectionHandles = function () {
		var bounds = this.getMultiSelectionBounds();
		if ( !bounds ) {
			return;
		}

		var handleSize = 8;
		var handles = [
			// Corner handles only for multi-selection
			{ x: bounds.x, y: bounds.y, type: 'nw' },
			{ x: bounds.x + bounds.width, y: bounds.y, type: 'ne' },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' },
			{ x: bounds.x, y: bounds.y + bounds.height, type: 'sw' }
		];

		this.selectionHandles = handles.map( function ( handle ) {
			return {
				x: handle.x,
				y: handle.y,
				type: handle.type,
				rect: {
					x: handle.x - handleSize / 2,
					y: handle.y - handleSize / 2,
					width: handleSize,
					height: handleSize
				}
			};
		} );
	};

	/**
	 * Get bounds for multi-selection
	 *
	 * @return {Object|null} Bounds object or null
	 */
	SelectionManager.prototype.getMultiSelectionBounds = function () {
		var selectedLayers = this.getSelectedLayers();
		if ( selectedLayers.length === 0 ) {
			return null;
		}

		var minX = Infinity;
		var minY = Infinity;
		var maxX = -Infinity;
		var maxY = -Infinity;

		selectedLayers.forEach( function ( layer ) {
			var bounds = this.getLayerBoundsCompat( layer );
			if ( bounds ) {
				minX = Math.min( minX, bounds.x );
				minY = Math.min( minY, bounds.y );
				maxX = Math.max( maxX, bounds.x + bounds.width );
				maxY = Math.max( maxY, bounds.y + bounds.height );
			}
		}.bind( this ) );

		if ( minX === Infinity ) {
			return null;
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	};

	/**
	 * Hit test selection handles
	 *
	 * @param {Object} point Point to test
	 * @return {Object|null} Handle object or null
	 */
	SelectionManager.prototype.hitTestSelectionHandles = function ( point ) {
		for ( var i = 0; i < this.selectionHandles.length; i++ ) {
			var handle = this.selectionHandles[ i ];
			if ( this.pointInRect( point, handle.rect ) ) {
				return handle;
			}
		}
		return null;
	};

	/**
	 * Convenience: get layer at point, preferring CanvasManager implementation.
	 * Accepts (x, y) or {x, y}.
	 *
	 * @param {Object|number} xOrPoint Point object or x coordinate
	 * @param {number} [y] y coordinate when using numeric args
	 * @return {Object|null} Layer object if hit, otherwise null
	 */
	SelectionManager.prototype.getLayerAtPoint = function ( xOrPoint, y ) {
		var pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
		if ( this.canvasManager && typeof this.canvasManager.getLayerAtPoint === 'function' ) {
			return this.canvasManager.getLayerAtPoint( pt );
		}
		var layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
			this.canvasManager.layers || [];
		for ( var i = layers.length - 1; i >= 0; i-- ) {
			var layer = layers[ i ];
			if ( layer.visible === false ) {
				continue;
			}
			if ( typeof layer.x === 'number' && typeof layer.y === 'number' && typeof layer.width === 'number' && typeof layer.height === 'number' ) {
				var minX = Math.min( layer.x, layer.x + layer.width );
				var minY = Math.min( layer.y, layer.y + layer.height );
				var w = Math.abs( layer.width );
				var h = Math.abs( layer.height );
				if ( pt.x >= minX && pt.x <= minX + w && pt.y >= minY && pt.y <= minY + h ) {
					return layer;
				}
			}
		}
		return null;
	};

	/**
	 * Check if point is in rectangle
	 *
	 * @param {Object} point Point to test
	 * @param {Object} rect Rectangle to test against
	 * @return {boolean} True if point is in rectangle
	 */
	SelectionManager.prototype.pointInRect = function ( point, rect ) {
		return point.x >= rect.x &&
			point.x <= rect.x + rect.width &&
			point.y >= rect.y &&
			point.y <= rect.y + rect.height;
	};

	/**
	 * Start resize operation
	 *
	 * @param {Object} handle Resize handle
	 * @param {Object} point Starting point
	 */
	SelectionManager.prototype.startResize = function ( handle, point ) {
		this.isResizing = true;
		this.resizeHandle = handle;
		this.dragStartPoint = point;
		this.originalLayerState = this.saveSelectedLayersState();
	};

	/**
	 * Update resize operation
	 *
	 * @param {Object} point Current point
	 * @param {Object} modifiers Modifier keys
	 */
	SelectionManager.prototype.updateResize = function ( point, modifiers ) {
		if ( !this.isResizing || !this.dragStartPoint || !this.resizeHandle ) {
			return;
		}

		var deltaX = point.x - this.dragStartPoint.x;
		var deltaY = point.y - this.dragStartPoint.y;

		// Apply resize to selected layers
		this.selectedLayerIds.forEach( function ( layerId ) {
			var layer = this.getLayerById( layerId );
			var originalLayer = this.originalLayerState[ layerId ];

			if ( layer && originalLayer ) {
				this.applyResize( layer, originalLayer, deltaX, deltaY, modifiers );
			}
		}.bind( this ) );

		this.updateSelectionHandles();
	};

	/**
	 * Finish resize operation
	 */
	SelectionManager.prototype.finishResize = function () {
		this.isResizing = false;
		this.resizeHandle = null;
		this.dragStartPoint = null;
		this.originalLayerState = null;

		// Save state for undo
		if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
			this.canvasManager.saveState();
		}
	};

	/**
	 * Start rotation operation
	 *
	 * @param {Object} point Starting point
	 */
	SelectionManager.prototype.startRotation = function ( point ) {
		this.isRotating = true;
		this.dragStartPoint = point;
		this.originalLayerState = this.saveSelectedLayersState();
	};

	/**
	 * Update rotation operation
	 *
	 * @param {Object} point Current point
	 */
	SelectionManager.prototype.updateRotation = function ( point ) {
		if ( !this.isRotating || !this.dragStartPoint ) {
			return;
		}

		// Calculate rotation angle
		var bounds = this.getMultiSelectionBounds() ||
			this.canvasManager.getLayerBounds( this.getLayerById( this.selectedLayerIds[ 0 ] ) );

		if ( !bounds ) {
			return;
		}

		var centerX = bounds.x + bounds.width / 2;
		var centerY = bounds.y + bounds.height / 2;

		var startAngle = Math.atan2(
			this.dragStartPoint.y - centerY,
			this.dragStartPoint.x - centerX
		);
		var currentAngle = Math.atan2(
			point.y - centerY,
			point.x - centerX
		);
		var deltaAngle = ( currentAngle - startAngle ) * 180 / Math.PI;

		// Apply rotation to selected layers
		this.selectedLayerIds.forEach( function ( layerId ) {
			var layer = this.getLayerById( layerId );
			var originalLayer = this.originalLayerState[ layerId ];

			if ( layer && originalLayer ) {
				layer.rotation = ( originalLayer.rotation || 0 ) + deltaAngle;
			}
		}.bind( this ) );

		this.updateSelectionHandles();
	};

	/**
	 * Finish rotation operation
	 */
	SelectionManager.prototype.finishRotation = function () {
		this.isRotating = false;
		this.dragStartPoint = null;
		this.originalLayerState = null;

		// Save state for undo
		if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
			this.canvasManager.saveState();
		}
	};

	/**
	 * Start drag operation
	 *
	 * @param {Object|number} xOrPoint Starting point or x coordinate
	 * @param {number} [y] y coordinate when using numeric args
	 */
	SelectionManager.prototype.startDrag = function ( xOrPoint, y ) {
		this.isDragging = true;
		var pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
		this.dragStartPoint = pt;
		this.dragStart = { x: pt.x, y: pt.y };
		this.originalLayerState = this.saveSelectedLayersState();
	};

	/**
	 * Update drag operation
	 *
	 * @param {Object|number} xOrPoint Current point or x coordinate
	 * @param {number} [y] y coordinate when using numeric args
	 */
	SelectionManager.prototype.updateDrag = function ( xOrPoint, y ) {
		if ( !this.isDragging || !this.dragStartPoint ) {
			return;
		}

		var pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
		var deltaX = pt.x - this.dragStartPoint.x;
		var deltaY = pt.y - this.dragStartPoint.y;

		// Apply grid snapping if enabled
		if ( this.canvasManager.snapToGrid ) {
			var gridSize = this.canvasManager.gridSize || 20;
			deltaX = Math.round( deltaX / gridSize ) * gridSize;
			deltaY = Math.round( deltaY / gridSize ) * gridSize;
		}

		// Apply drag to selected layers
		this.selectedLayerIds.forEach( function ( layerId ) {
			var layer = this.getLayerById( layerId );
			var originalLayer = this.originalLayerState[ layerId ];

			if ( layer && originalLayer ) {
				this.applyDrag( layer, originalLayer, deltaX, deltaY );
			}
		}.bind( this ) );

		this.updateSelectionHandles();
	};

	/**
	 * Finish drag operation
	 */
	SelectionManager.prototype.finishDrag = function () {
		this.isDragging = false;
		this.dragStartPoint = null;
		this.dragStart = null;
		this.originalLayerState = null;

		// Save state for undo
		this.canvasManager.saveState();
	};

	/**
	 * Apply resize to a layer
	 *
	 * @param {Object} layer Layer to resize
	 * @param {Object} originalLayer Original layer state
	 * @param {number} deltaX X delta
	 * @param {number} deltaY Y delta
	 * @param {Object} modifiers Modifier keys
	 */
	SelectionManager.prototype.applyResize = function (
		layer, originalLayer, deltaX, deltaY, modifiers
	) {
		// Delegate to canvas manager's existing implementation
		if ( typeof this.canvasManager.calculateResize === 'function' ) {
			var newProps = this.canvasManager.calculateResize(
				originalLayer, this.resizeHandle.type, deltaX, deltaY, modifiers
			);
			// Use manual property assignment instead of Object.assign for IE11 compatibility
			for ( var prop in newProps ) {
				if ( Object.prototype.hasOwnProperty.call( newProps, prop ) ) {
					layer[ prop ] = newProps[ prop ];
				}
			}
		}
	};

	/**
	 * Apply drag to a layer
	 *
	 * @param {Object} layer Layer to drag
	 * @param {Object} originalLayer Original layer state
	 * @param {number} deltaX X delta
	 * @param {number} deltaY Y delta
	 */
	SelectionManager.prototype.applyDrag = function ( layer, originalLayer, deltaX, deltaY ) {
		// Apply position changes based on layer type
		if ( typeof layer.x === 'number' ) {
			layer.x = originalLayer.x + deltaX;
		}
		if ( typeof layer.y === 'number' ) {
			layer.y = originalLayer.y + deltaY;
		}
		if ( typeof layer.x1 === 'number' ) {
			layer.x1 = originalLayer.x1 + deltaX;
		}
		if ( typeof layer.y1 === 'number' ) {
			layer.y1 = originalLayer.y1 + deltaY;
		}
		if ( typeof layer.x2 === 'number' ) {
			layer.x2 = originalLayer.x2 + deltaX;
		}
		if ( typeof layer.y2 === 'number' ) {
			layer.y2 = originalLayer.y2 + deltaY;
		}
		if ( layer.points && originalLayer.points ) {
			layer.points = originalLayer.points.map( function ( point ) {
				return {
					x: point.x + deltaX,
					y: point.y + deltaY
				};
			} );
		}
	};

	/**
	 * Save state of selected layers
	 *
	 * @return {Object} Saved state
	 */
	SelectionManager.prototype.saveSelectedLayersState = function () {
		var state = {};
		this.selectedLayerIds.forEach( function ( layerId ) {
			var layer = this.getLayerById( layerId );
			if ( layer ) {
				state[ layerId ] = JSON.parse( JSON.stringify( layer ) );
			}
		}.bind( this ) );
		return state;
	};

	/**
	 * Get layer by ID
	 *
	 * @param {string} layerId Layer ID
	 * @return {Object|null} Layer object or null
	 */
	SelectionManager.prototype.getLayerById = function ( layerId ) {
		var layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
			this.canvasManager.layers || [];
		for ( var i = 0; i < layers.length; i++ ) {
			if ( layers[ i ].id === layerId ) {
				return layers[ i ];
			}
		}
		return null;
	};

	/**
	 * Notify selection change
	 */
	SelectionManager.prototype.notifySelectionChange = function () {
		// Keep CanvasManager in sync for legacy tests/UI
		if ( this.canvasManager ) {
			this.canvasManager.selectedLayerIds = this.selectedLayerIds.slice( 0 );
			if ( typeof this.canvasManager.redraw === 'function' ) {
				this.canvasManager.redraw();
			}
		}

		if ( this.canvasManager.editor && typeof this.canvasManager.editor.updateStatus === 'function' ) {
			this.canvasManager.editor.updateStatus( {
				selectionCount: this.selectedLayerIds.length
			} );
		}

		// Update layer panel if available
		if ( this.canvasManager.editor && this.canvasManager.editor.layerPanel &&
			typeof this.canvasManager.editor.layerPanel.updateSelection === 'function' ) {
			this.canvasManager.editor.layerPanel.updateSelection( this.selectedLayerIds );
		}
	};

	/**
	 * Delete selected layers
	 */
	SelectionManager.prototype.deleteSelected = function () {
		if ( this.selectedLayerIds.length === 0 ) {
			return;
		}

		var layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
			this.canvasManager.layers || [];

		// Remove selected layers
		var remaining = layers.filter( function ( layer ) {
			return this.selectedLayerIds.indexOf( layer.id ) === -1;
		}.bind( this ) );
		if ( this.canvasManager.editor ) {
			this.canvasManager.editor.layers = remaining;
		} else {
			this.canvasManager.layers = remaining;
		}

		// Clear selection
		this.clearSelection();

		// Save state and update
		if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
			this.canvasManager.saveState();
		}
		if ( this.canvasManager && this.canvasManager.editor && typeof this.canvasManager.editor.markDirty === 'function' ) {
			this.canvasManager.editor.markDirty();
		}
	};

	/**
	 * Duplicate selected layers
	 */
	SelectionManager.prototype.duplicateSelected = function () {
		if ( this.selectedLayerIds.length === 0 ) {
			return;
		}

		var selectedLayers = this.getSelectedLayers();
		var newLayers = [];
		var newSelection = [];

		selectedLayers.forEach( function ( layer ) {
			var clone = JSON.parse( JSON.stringify( layer ) );
			clone.id = this.generateLayerId();

			// Offset duplicate
			if ( typeof clone.x === 'number' ) {
				clone.x += 20;
			}
			if ( typeof clone.y === 'number' ) {
				clone.y += 20;
			}

			newLayers.push( clone );
			newSelection.push( clone.id );
		}.bind( this ) );

		// Add new layers
		if ( this.canvasManager.editor ) {
			this.canvasManager.editor.layers = this.canvasManager.editor.layers.concat( newLayers );
		} else {
			this.canvasManager.layers = ( this.canvasManager.layers || [] ).concat( newLayers );
		}

		// Select new layers
		this.selectedLayerIds = newSelection;
		this.updateSelectionHandles();

		// Save state and update
		if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
			this.canvasManager.saveState();
		}
		if ( this.canvasManager && this.canvasManager.editor && typeof this.canvasManager.editor.markDirty === 'function' ) {
			this.canvasManager.editor.markDirty();
		}
	};

	/**
	 * Generate unique layer ID
	 *
	 * @return {string} Unique layer ID
	 */
	SelectionManager.prototype.generateLayerId = function () {
		return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
	};

	/**
	 * Bounds for current selection; null if none.
	 *
	 * @return {Object|null} Bounds of selection or null
	 */
	SelectionManager.prototype.getSelectionBounds = function () {
		if ( this.selectedLayerIds.length === 0 ) {
			return null;
		}
		if ( this.selectedLayerIds.length === 1 ) {
			var single = this.getLayerById( this.selectedLayerIds[ 0 ] );
			return single ? this.getLayerBoundsCompat( single ) : null;
		}
		return this.getMultiSelectionBounds();
	};

	/**
	 * Compute layer bounds with graceful fallback when CanvasManager.getLayerBounds
	 * is unavailable in tests.
	 *
	 * @param {Object} layer Layer object
	 * @return {Object|null} Bounds {x,y,width,height} or null
	 */
	SelectionManager.prototype.getLayerBoundsCompat = function ( layer ) {
		if ( this.canvasManager && typeof this.canvasManager.getLayerBounds === 'function' ) {
			return this.canvasManager.getLayerBounds( layer );
		}

		if ( !layer ) {
			return null;
		}

		// Common case: rectangular bounds
		if ( typeof layer.x === 'number' && typeof layer.y === 'number' &&
			typeof layer.width === 'number' && typeof layer.height === 'number' ) {
			var minX = Math.min( layer.x, layer.x + layer.width );
			var minY = Math.min( layer.y, layer.y + layer.height );
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
			var lx1 = Math.min( layer.x1, layer.x2 );
			var ly1 = Math.min( layer.y1, layer.y2 );
			var lx2 = Math.max( layer.x1, layer.x2 );
			var ly2 = Math.max( layer.y1, layer.y2 );
			return { x: lx1, y: ly1, width: lx2 - lx1, height: ly2 - ly1 };
		}

		// Ellipse/circle with center + radii
		if ( typeof layer.x === 'number' && typeof layer.y === 'number' &&
			( typeof layer.radius === 'number' ||
				typeof layer.radiusX === 'number' || typeof layer.radiusY === 'number' ) ) {
			var hasRX = ( layer.radiusX !== null && layer.radiusX !== undefined );
			var hasRY = ( layer.radiusY !== null && layer.radiusY !== undefined );
			var rx = Math.abs( hasRX ? layer.radiusX : ( layer.radius || 0 ) );
			var ry = Math.abs( hasRY ? layer.radiusY : ( layer.radius || 0 ) );
			return { x: layer.x - rx, y: layer.y - ry, width: rx * 2, height: ry * 2 };
		}

		// Path/polygon points
		if ( Array.isArray( layer.points ) && layer.points.length ) {
			var minPX = Infinity, minPY = Infinity, maxPX = -Infinity, maxPY = -Infinity;
			for ( var i = 0; i < layer.points.length; i++ ) {
				var p = layer.points[ i ];
				minPX = Math.min( minPX, p.x );
				minPY = Math.min( minPY, p.y );
				maxPX = Math.max( maxPX, p.x );
				maxPY = Math.max( maxPY, p.y );
			}
			return { x: minPX, y: minPY, width: maxPX - minPX, height: maxPY - minPY };
		}

		return null;
	};

	// Export SelectionManager to global scope
	window.LayersSelectionManager = SelectionManager;

	// Also export via CommonJS when available (for Jest tests)
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SelectionManager;
	}

}() );
