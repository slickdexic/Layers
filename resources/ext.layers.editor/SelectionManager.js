/**
 * Selection Manager for Layers Editor
 * Handles layer selection, manipulation, and transformation
 */
( function () {
	'use strict';

	// Import extracted modules if available
	const SelectionState = window.SelectionState ||
		( window.Layers && window.Layers.Selection && window.Layers.Selection.SelectionState );
	const MarqueeSelection = window.MarqueeSelection ||
		( window.Layers && window.Layers.Selection && window.Layers.Selection.MarqueeSelection );
	const SelectionHandles = window.SelectionHandles ||
		( window.Layers && window.Layers.Selection && window.Layers.Selection.SelectionHandles );
	const BoundsCalculator = window.Layers && window.Layers.Utils && window.Layers.Utils.BoundsCalculator;

	/**
	 * Minimal typedef for CanvasManager used for JSDoc references in this file.
	 *
	 * @typedef {Object} CanvasManager
	 * @property {HTMLCanvasElement} canvas
	 * @property {CanvasRenderingContext2D} ctx
	 */

	/**
	 * SelectionManager class
	 * Manages layer selection, manipulation, and transformation operations
	 */
	class SelectionManager {
		/**
		 * Create a SelectionManager instance
		 *
		 * @param {Object} config Configuration object
		 * @param {CanvasManager} canvasManager Reference to the canvas manager
		 */
		constructor( config, canvasManager ) {
			// Back-compat: allow new SelectionManager(canvasManager)
			if ( config && !canvasManager && ( config.canvas || config.layers ) ) {
				canvasManager = config;
				config = {};
			}

			this.config = config || {};
			this.canvasManager = canvasManager;

			// Initialize extracted modules if available
			this._initializeModules();

			// Selection state (kept for backward compatibility when module not loaded)
			this.selectedLayerIds = [];
			this.selectionHandles = [];
			this.isResizing = false;
			this.isRotating = false;
			this.isDragging = false;
			this.resizeHandle = null;
			this.dragStartPoint = null;
			this.originalLayerState = null;

			// Marquee selection (kept for backward compatibility)
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
		 * Initialize extracted modules
		 */
		_initializeModules() {
			const self = this;

			// Initialize SelectionState if available
			if ( SelectionState ) {
				this._selectionState = new SelectionState( {
					getLayersArray: () => self._getLayersArray(),
					onSelectionChange: ( ids ) => self._handleSelectionChange( ids )
				} );
			}

			// Initialize MarqueeSelection if available
			if ( MarqueeSelection ) {
				this._marqueeSelection = new MarqueeSelection( {
					getLayersArray: () => self._getLayersArray(),
					getLayerBounds: ( layer ) => self.getLayerBoundsCompat( layer ),
					onSelectionUpdate: ( ids ) => {
						self.selectedLayerIds = ids;
						// Update lastSelectedId for key object alignment
						if ( ids.length > 0 ) {
							self.lastSelectedId = ids[ ids.length - 1 ];
						} else {
							self.lastSelectedId = null;
						}
						self.notifySelectionChange();
					}
				} );
			}

			// Initialize SelectionHandles if available
			if ( SelectionHandles ) {
				this._selectionHandles = new SelectionHandles( {
					handleSize: 8,
					rotationHandleOffset: 20
				} );
			}
		}

		/**
		 * Get layers array from canvas manager
		 *
		 * @return {Array} Layers array
		 */
		_getLayersArray() {
			return ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
				this.canvasManager.layers || [];
		}

		/**
		 * Handle selection change from SelectionState module
		 *
		 * @param {Array} ids Selected layer IDs
		 */
		_handleSelectionChange( ids ) {
			this.selectedLayerIds = ids;
			if ( this._selectionState ) {
				this.lastSelectedId = this._selectionState.getLastSelectedId();
			}
			this.updateSelectionHandles();
			this.notifySelectionChange();
		}

		/**
		 * Select a layer by ID
		 *
		 * @param {string|null} layerId Layer ID to select, or null to clear
		 * @param {boolean} addToSelection Whether to add to existing selection
		 */
		selectLayer( layerId, addToSelection ) {
			// Delegate to SelectionState module if available
			if ( this._selectionState ) {
				this._selectionState.selectLayer( layerId, addToSelection );
				this.selectedLayerIds = this._selectionState.getSelectedIds();
				this.lastSelectedId = this._selectionState.getLastSelectedId();
			} else {
				// Fallback for tests
				if ( !addToSelection ) {
					this.selectedLayerIds = [];
					this.lastSelectedId = null;
				}
				// Toggle behavior when adding to selection and already selected
				if ( addToSelection && layerId && this.isSelected( layerId ) ) {
					this.deselectLayer( layerId );
					return;
				}
				// Skip locked or invisible layers
				const layer = this.getLayerById( layerId );
				if ( layerId && layer && layer.locked !== true && layer.visible !== false &&
					this.selectedLayerIds.indexOf( layerId ) === -1 ) {
					this.selectedLayerIds.push( layerId );
					this.lastSelectedId = layerId;
				}
			}

			// Announce selection for screen readers
			const layer = this.getLayerById( layerId );
			if ( window.layersAnnouncer && layer ) {
				const layerName = layer.name || this.getDefaultLayerName( layer );
				window.layersAnnouncer.announceLayerSelection( layerName );
			}

			this.updateSelectionHandles();
			this.notifySelectionChange();
		}

		/**
		 * Get default name for a layer (for accessibility announcements)
		 *
		 * @param {Object} layer Layer object
		 * @return {string} Default layer name
		 */
		getDefaultLayerName( layer ) {
			if ( !layer || !layer.type ) {
				return 'Layer';
			}
			// Use i18n messages if available
			if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
				const msgKey = 'layers-type-' + layer.type;
				const msg = window.layersMessages.get( msgKey, '' );
				if ( msg ) {
					return msg;
				}
			}
			// Fallback to capitalized type
			return layer.type.charAt( 0 ).toUpperCase() + layer.type.slice( 1 );
		}

		/**
		 * Deselect a layer by ID
		 *
		 * @param {string} layerId Layer ID to deselect
		 */
		deselectLayer( layerId ) {
			if ( this._selectionState ) {
				this._selectionState.deselectLayer( layerId );
				this.selectedLayerIds = this._selectionState.getSelectedIds();
				this.lastSelectedId = this._selectionState.getLastSelectedId();
			} else {
				const index = this.selectedLayerIds.indexOf( layerId );
				if ( index !== -1 ) {
					this.selectedLayerIds.splice( index, 1 );
					if ( this.lastSelectedId === layerId ) {
						this.lastSelectedId = this.selectedLayerIds.length > 0
							? this.selectedLayerIds[ this.selectedLayerIds.length - 1 ]
							: null;
					}
				}
			}
			this.updateSelectionHandles();
			this.notifySelectionChange();
		}

		/**
		 * Clear all selections
		 */
		clearSelection() {
			if ( this._selectionState ) {
				this._selectionState.clearSelection( false );
			}
			this.selectedLayerIds = [];
			this.selectionHandles = [];
			this.lastSelectedId = null;
			this.notifySelectionChange();
		}

		/**
		 * Select all layers
		 */
		selectAll() {
			if ( this._selectionState ) {
				this._selectionState.selectAll();
				this.selectedLayerIds = this._selectionState.getSelectedIds();
				this.lastSelectedId = this._selectionState.getLastSelectedId();
			} else {
				const layers = this._getLayersArray();
				this.selectedLayerIds = layers.map( ( layer ) => layer.id );
				this.lastSelectedId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ] || null;
			}
			this.updateSelectionHandles();
			this.notifySelectionChange();
		}

		/**
		 * Check if a layer is selected
		 *
		 * @param {string} layerId Layer ID to check
		 * @return {boolean} True if selected
		 */
		isSelected( layerId ) {
			if ( this._selectionState ) {
				return this._selectionState.isSelected( layerId );
			}
			return this.selectedLayerIds.indexOf( layerId ) !== -1;
		}

		/**
		 * Get the number of selected layers
		 *
		 * @return {number} Number of selected layers
		 */
		getSelectionCount() {
			if ( this._selectionState ) {
				return this._selectionState.getSelectionCount();
			}
			return this.selectedLayerIds.length;
		}

		/**
		 * Get all selected layers
		 *
		 * @return {Array} Array of selected layer objects
		 */
		getSelectedLayers() {
			if ( this._selectionState ) {
				return this._selectionState.getSelectedLayers();
			}
			const layers = this._getLayersArray();
			return layers.filter( ( layer ) => this.isSelected( layer.id ) );
		}

		/**
		 * Start marquee selection
		 *
		 * @param {Object|number} xOrPoint Starting point or x coordinate
		 * @param {number} [y] y coordinate when using numeric args
		 */
		startMarqueeSelection( xOrPoint, y ) {
			const pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
			if ( this._marqueeSelection ) {
				this._marqueeSelection.start( pt );
			}
			this.isMarqueeSelecting = true;
			this.marqueeStart = { x: pt.x, y: pt.y };
			this.marqueeEnd = { x: pt.x, y: pt.y };
		}

		/**
		 * Update marquee selection
		 *
		 * @param {Object|number} xOrPoint Current point or x coordinate
		 * @param {number} [y] y coordinate when using numeric args
		 */
		updateMarqueeSelection( xOrPoint, y ) {
			if ( !this.isMarqueeSelecting ) {
				return;
			}

			const pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
			this.marqueeEnd = { x: pt.x, y: pt.y };

			if ( this._marqueeSelection ) {
				this.selectedLayerIds = this._marqueeSelection.update( pt );
			} else {
				// Minimal fallback for tests
				const marqueeRect = this.getMarqueeRect();
				const layers = this._getLayersArray();
				this.selectedLayerIds = layers
					.filter( ( layer ) => {
						const bounds = this.getLayerBoundsCompat( layer );
						return bounds && this.rectIntersects( marqueeRect, bounds );
					} )
					.map( ( layer ) => layer.id );
			}

			// Update lastSelectedId for key object alignment (use last in selection)
			if ( this.selectedLayerIds.length > 0 ) {
				this.lastSelectedId = this.selectedLayerIds[ this.selectedLayerIds.length - 1 ];
			} else {
				this.lastSelectedId = null;
			}

			this.notifySelectionChange();
			if ( this.canvasManager && typeof this.canvasManager.redraw === 'function' ) {
				this.canvasManager.redraw();
			}
		}

		/**
		 * Finish marquee selection
		 */
		finishMarqueeSelection() {
			if ( this._marqueeSelection ) {
				this._marqueeSelection.finish();
			}
			this.isMarqueeSelecting = false;
			this.updateSelectionHandles();
			this.marqueeStart = null;
			this.marqueeEnd = null;
		}

		/**
		 * Get marquee selection rectangle
		 *
		 * @return {Object} Rectangle object
		 */
		getMarqueeRect() {
			if ( this._marqueeSelection ) {
				return this._marqueeSelection.getRect();
			}
			if ( !this.marqueeStart || !this.marqueeEnd ) {
				return { x: 0, y: 0, width: 0, height: 0 };
			}
			return {
				x: Math.min( this.marqueeStart.x, this.marqueeEnd.x ),
				y: Math.min( this.marqueeStart.y, this.marqueeEnd.y ),
				width: Math.abs( this.marqueeEnd.x - this.marqueeStart.x ),
				height: Math.abs( this.marqueeEnd.y - this.marqueeStart.y )
			};
		}

		/**
		 * Check if two rectangles intersect
		 *
		 * @param {Object} rect1 First rectangle
		 * @param {Object} rect2 Second rectangle
		 * @return {boolean} True if intersecting
		 */
		rectIntersects( rect1, rect2 ) {
			return rect1.x < rect2.x + rect2.width &&
				rect1.x + rect1.width > rect2.x &&
				rect1.y < rect2.y + rect2.height &&
				rect1.y + rect1.height > rect2.y;
		}

		/**
		 * Update selection handles
		 */
		updateSelectionHandles() {
			if ( this.selectedLayerIds.length === 0 ) {
				if ( this._selectionHandles ) {
					this._selectionHandles.clear();
				}
				this.selectionHandles = [];
				return;
			}

			const bounds = this.selectedLayerIds.length === 1
				? this.getLayerBoundsCompat( this.getLayerById( this.selectedLayerIds[ 0 ] ) )
				: this.getMultiSelectionBounds();

			if ( !bounds ) {
				if ( this._selectionHandles ) {
					this._selectionHandles.clear();
				}
				this.selectionHandles = [];
				return;
			}

			if ( this._selectionHandles ) {
				if ( this.selectedLayerIds.length === 1 ) {
					this._selectionHandles.createSingleSelectionHandles( bounds );
				} else {
					this._selectionHandles.createMultiSelectionHandles( bounds );
				}
				this.selectionHandles = this._selectionHandles.getHandles();
			} else {
				// Minimal fallback for tests
				this.selectionHandles = this._createHandlesFromBounds( bounds, this.selectedLayerIds.length === 1 );
			}
		}

		/**
		 * Create handles from bounds (minimal fallback for tests)
		 *
		 * @param {Object} bounds Bounds object
		 * @param {boolean} isSingle Whether this is single selection
		 * @return {Array} Handle objects
		 */
		_createHandlesFromBounds( bounds, isSingle ) {
			const handleSize = 8;
			const handles = [
				{ x: bounds.x, y: bounds.y, type: 'nw' },
				{ x: bounds.x + bounds.width, y: bounds.y, type: 'ne' },
				{ x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: 'se' },
				{ x: bounds.x, y: bounds.y + bounds.height, type: 'sw' }
			];
			if ( isSingle ) {
				handles.push(
					{ x: bounds.x + bounds.width / 2, y: bounds.y, type: 'n' },
					{ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, type: 'e' },
					{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, type: 's' },
					{ x: bounds.x, y: bounds.y + bounds.height / 2, type: 'w' },
					{ x: bounds.x + bounds.width / 2, y: bounds.y - 20, type: 'rotate' }
				);
			}
			return handles.map( ( h ) => ( {
				x: h.x, y: h.y, type: h.type,
				rect: { x: h.x - handleSize / 2, y: h.y - handleSize / 2, width: handleSize, height: handleSize }
			} ) );
		}

		/**
		 * Create selection handles for single layer (legacy method, delegates to _createHandlesFromBounds)
		 *
		 * @param {Object} layer Layer object
		 */
		createSingleSelectionHandles( layer ) {
			const bounds = this.getLayerBoundsCompat( layer );
			if ( bounds ) {
				if ( this._selectionHandles ) {
					this._selectionHandles.createSingleSelectionHandles( bounds );
					this.selectionHandles = this._selectionHandles.getHandles();
				} else {
					this.selectionHandles = this._createHandlesFromBounds( bounds, true );
				}
			}
		}

		/**
		 * Create selection handles for multiple layers (legacy method, delegates to _createHandlesFromBounds)
		 */
		createMultiSelectionHandles() {
			const bounds = this.getMultiSelectionBounds();
			if ( bounds ) {
				if ( this._selectionHandles ) {
					this._selectionHandles.createMultiSelectionHandles( bounds );
					this.selectionHandles = this._selectionHandles.getHandles();
				} else {
					this.selectionHandles = this._createHandlesFromBounds( bounds, false );
				}
			}
		}

		/**
		 * Get bounds for multi-selection
		 *
		 * @return {Object|null} Bounds object or null
		 */
		getMultiSelectionBounds() {
			const selectedLayers = this.getSelectedLayers();
			if ( selectedLayers.length === 0 ) {
				return null;
			}

			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			selectedLayers.forEach( ( layer ) => {
				const bounds = this.getLayerBoundsCompat( layer );
				if ( bounds ) {
					minX = Math.min( minX, bounds.x );
					minY = Math.min( minY, bounds.y );
					maxX = Math.max( maxX, bounds.x + bounds.width );
					maxY = Math.max( maxY, bounds.y + bounds.height );
				}
			} );

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
		 * Hit test selection handles
		 *
		 * @param {Object} point Point to test
		 * @return {Object|null} Handle object or null
		 */
		hitTestSelectionHandles( point ) {
			if ( this._selectionHandles ) {
				return this._selectionHandles.hitTest( point );
			}
			// Fallback for tests
			for ( let i = 0; i < this.selectionHandles.length; i++ ) {
				const handle = this.selectionHandles[ i ];
				if ( handle.rect && this.pointInRect( point, handle.rect ) ) {
					return handle;
				}
			}
			return null;
		}

		/**
		 * Convenience: get layer at point, preferring CanvasManager implementation.
		 * Accepts (x, y) or {x, y}.
		 *
		 * @param {Object|number} xOrPoint Point object or x coordinate
		 * @param {number} [y] y coordinate when using numeric args
		 * @return {Object|null} Layer object if hit, otherwise null
		 */
		getLayerAtPoint( xOrPoint, y ) {
			const pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
			if ( this.canvasManager && typeof this.canvasManager.getLayerAtPoint === 'function' ) {
				return this.canvasManager.getLayerAtPoint( pt );
			}
			const layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
				this.canvasManager.layers || [];
			for ( let i = layers.length - 1; i >= 0; i-- ) {
				const layer = layers[ i ];
				if ( layer.visible === false ) {
					continue;
				}
				if ( typeof layer.x === 'number' && typeof layer.y === 'number' && typeof layer.width === 'number' && typeof layer.height === 'number' ) {
					const minX = Math.min( layer.x, layer.x + layer.width );
					const minY = Math.min( layer.y, layer.y + layer.height );
					const w = Math.abs( layer.width );
					const h = Math.abs( layer.height );
					if ( pt.x >= minX && pt.x <= minX + w && pt.y >= minY && pt.y <= minY + h ) {
						return layer;
					}
				}
			}
			return null;
		}

		/**
		 * Check if point is in rectangle
		 *
		 * @param {Object} point Point to test
		 * @param {Object} rect Rectangle to test against
		 * @return {boolean} True if point is in rectangle
		 */
		pointInRect( point, rect ) {
			return point.x >= rect.x &&
				point.x <= rect.x + rect.width &&
				point.y >= rect.y &&
				point.y <= rect.y + rect.height;
		}

		/**
		 * Start resize operation
		 *
		 * @param {Object} handle Resize handle
		 * @param {Object} point Starting point
		 */
		startResize( handle, point ) {
			this.isResizing = true;
			this.resizeHandle = handle;
			this.dragStartPoint = point;
			this.originalLayerState = this.saveSelectedLayersState();
		}

		/**
		 * Update resize operation
		 *
		 * @param {Object} point Current point
		 * @param {Object} modifiers Modifier keys
		 */
		updateResize( point, modifiers ) {
			if ( !this.isResizing || !this.dragStartPoint || !this.resizeHandle ) {
				return;
			}

			const deltaX = point.x - this.dragStartPoint.x;
			const deltaY = point.y - this.dragStartPoint.y;

			// Apply resize to selected layers
			this.selectedLayerIds.forEach( ( layerId ) => {
				const layer = this.getLayerById( layerId );
				const originalLayer = this.originalLayerState[ layerId ];

				if ( layer && originalLayer ) {
					this.applyResize( layer, originalLayer, deltaX, deltaY, modifiers );
				}
			} );

			this.updateSelectionHandles();
		}

		/**
		 * Finish resize operation
		 */
		finishResize() {
			this.isResizing = false;
			this.resizeHandle = null;
			this.dragStartPoint = null;
			this.originalLayerState = null;

			// Save state for undo
			if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
				this.canvasManager.saveState();
			}
		}

		/**
		 * Start rotation operation
		 *
		 * @param {Object} point Starting point
		 */
		startRotation( point ) {
			this.isRotating = true;
			this.dragStartPoint = point;
			this.originalLayerState = this.saveSelectedLayersState();
		}

		/**
		 * Update rotation operation
		 *
		 * @param {Object} point Current point
		 */
		updateRotation( point ) {
			if ( !this.isRotating || !this.dragStartPoint ) {
				return;
			}

			// Calculate rotation angle
			const bounds = this.getMultiSelectionBounds() ||
				this.canvasManager.getLayerBounds( this.getLayerById( this.selectedLayerIds[ 0 ] ) );

			if ( !bounds ) {
				return;
			}

			const centerX = bounds.x + bounds.width / 2;
			const centerY = bounds.y + bounds.height / 2;

			const startAngle = Math.atan2(
				this.dragStartPoint.y - centerY,
				this.dragStartPoint.x - centerX
			);
			const currentAngle = Math.atan2(
				point.y - centerY,
				point.x - centerX
			);
			const deltaAngle = ( currentAngle - startAngle ) * 180 / Math.PI;

			// Apply rotation to selected layers
			this.selectedLayerIds.forEach( ( layerId ) => {
				const layer = this.getLayerById( layerId );
				const originalLayer = this.originalLayerState[ layerId ];

				if ( layer && originalLayer ) {
					layer.rotation = ( originalLayer.rotation || 0 ) + deltaAngle;
				}
			} );

			this.updateSelectionHandles();
		}

		/**
		 * Finish rotation operation
		 */
		finishRotation() {
			this.isRotating = false;
			this.dragStartPoint = null;
			this.originalLayerState = null;

			// Save state for undo
			if ( this.canvasManager && typeof this.canvasManager.saveState === 'function' ) {
				this.canvasManager.saveState();
			}
		}

		/**
		 * Start drag operation
		 *
		 * @param {Object|number} xOrPoint Starting point or x coordinate
		 * @param {number} [y] y coordinate when using numeric args
		 */
		startDrag( xOrPoint, y ) {
			this.isDragging = true;
			const pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
			this.dragStartPoint = pt;
			this.dragStart = { x: pt.x, y: pt.y };
			this.originalLayerState = this.saveSelectedLayersState();
		}

		/**
		 * Update drag operation
		 *
		 * @param {Object|number} xOrPoint Current point or x coordinate
		 * @param {number} [y] y coordinate when using numeric args
		 */
		updateDrag( xOrPoint, y ) {
			if ( !this.isDragging || !this.dragStartPoint ) {
				return;
			}

			const pt = ( typeof xOrPoint === 'object' ) ? xOrPoint : { x: xOrPoint, y: y };
			let deltaX = pt.x - this.dragStartPoint.x;
			let deltaY = pt.y - this.dragStartPoint.y;

			// Apply grid snapping if enabled
			if ( this.canvasManager.snapToGrid ) {
				const gridSize = this.canvasManager.gridSize || 20;
				deltaX = Math.round( deltaX / gridSize ) * gridSize;
				deltaY = Math.round( deltaY / gridSize ) * gridSize;
			}

			// Apply drag to selected layers
			this.selectedLayerIds.forEach( ( layerId ) => {
				const layer = this.getLayerById( layerId );
				const originalLayer = this.originalLayerState[ layerId ];

				if ( layer && originalLayer ) {
					this.applyDrag( layer, originalLayer, deltaX, deltaY );
				}
			} );

			this.updateSelectionHandles();
		}

		/**
		 * Finish drag operation
		 */
		finishDrag() {
			this.isDragging = false;
			this.dragStartPoint = null;
			this.dragStart = null;
			this.originalLayerState = null;

			// Save state for undo
			this.canvasManager.saveState();
		}

		/**
		 * Apply resize to a layer
		 *
		 * @param {Object} layer Layer to resize
		 * @param {Object} originalLayer Original layer state
		 * @param {number} deltaX X delta
		 * @param {number} deltaY Y delta
		 * @param {Object} modifiers Modifier keys
		 */
		applyResize( layer, originalLayer, deltaX, deltaY, modifiers ) {
			// Delegate to canvas manager's existing implementation
			if ( typeof this.canvasManager.calculateResize === 'function' ) {
				const newProps = this.canvasManager.calculateResize(
					originalLayer, this.resizeHandle.type, deltaX, deltaY, modifiers
				);
				// Use manual property assignment instead of Object.assign for IE11 compatibility
				for ( const prop in newProps ) {
					if ( Object.prototype.hasOwnProperty.call( newProps, prop ) ) {
						layer[ prop ] = newProps[ prop ];
					}
				}
			}
		}

		/**
		 * Apply drag to a layer
		 *
		 * @param {Object} layer Layer to drag
		 * @param {Object} originalLayer Original layer state
		 * @param {number} deltaX X delta
		 * @param {number} deltaY Y delta
		 */
		applyDrag( layer, originalLayer, deltaX, deltaY ) {
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
				layer.points = originalLayer.points.map( ( point ) => ( {
					x: point.x + deltaX,
					y: point.y + deltaY
				} ) );
			}
		}

		/**
		 * Save state of selected layers
		 *
		 * @return {Object} Saved state
		 */
		saveSelectedLayersState() {
			const state = {};
			this.selectedLayerIds.forEach( ( layerId ) => {
				const layer = this.getLayerById( layerId );
				if ( layer ) {
					state[ layerId ] = JSON.parse( JSON.stringify( layer ) );
				}
			} );
			return state;
		}

		/**
		 * Get layer by ID
		 *
		 * @param {string} layerId Layer ID
		 * @return {Object|null} Layer object or null
		 */
		getLayerById( layerId ) {
			const layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
				this.canvasManager.layers || [];
			for ( let i = 0; i < layers.length; i++ ) {
				if ( layers[ i ].id === layerId ) {
					return layers[ i ];
				}
			}
			return null;
		}

		/**
		 * Notify selection change
		 */
		notifySelectionChange() {
			// Keep CanvasManager in sync for legacy tests/UI
			if ( this.canvasManager ) {
				this.canvasManager.selectedLayerIds = this.selectedLayerIds.slice( 0 );
				if ( typeof this.canvasManager.redraw === 'function' ) {
					this.canvasManager.redraw();
				}
			}

			// Sync selection state to StateManager so UI components can read it
			if ( this.canvasManager.editor && this.canvasManager.editor.stateManager ) {
				this.canvasManager.editor.stateManager.set(
					'selectedLayerIds',
					this.selectedLayerIds.slice( 0 )
				);
			}

			if ( this.canvasManager.editor && typeof this.canvasManager.editor.updateStatus === 'function' ) {
				this.canvasManager.editor.updateStatus( {
					selection: this.selectedLayerIds.length
				} );
			}

			// Update layer panel if available
			if ( this.canvasManager.editor && this.canvasManager.editor.layerPanel &&
				typeof this.canvasManager.editor.layerPanel.updateSelection === 'function' ) {
				this.canvasManager.editor.layerPanel.updateSelection( this.selectedLayerIds );
			}

			// Update toolbar preset dropdown with selected layers
			this.notifyToolbarOfSelection();
		}

		/**
		 * Notify toolbar of selection change for preset dropdown
		 */
		notifyToolbarOfSelection() {
			const editor = this.canvasManager && this.canvasManager.editor;
			if ( !editor || !editor.toolbar || !editor.toolbar.styleControls ) {
				return;
			}

			// Get selected IDs - try multiple sources
			let selectedIds = this.selectedLayerIds || [];
			if ( selectedIds.length === 0 && this._selectionState ) {
				selectedIds = this._selectionState.getSelectedIds() || [];
			}
			// Also check CanvasManager directly
			if ( selectedIds.length === 0 && this.canvasManager && this.canvasManager.selectedLayerIds ) {
				selectedIds = this.canvasManager.selectedLayerIds;
			}

			// Get the actual layer objects for selected IDs
			const layers = this._getLayersArray();
			const selectedLayers = selectedIds
				.map( ( id ) => layers.find( ( l ) => l.id === id ) )
				.filter( ( l ) => l != null );

			// Notify style controls of selection change
			if ( typeof editor.toolbar.styleControls.updateForSelection === 'function' ) {
				editor.toolbar.styleControls.updateForSelection( selectedLayers );
			}
		}

		/**
		 * Delete selected layers
		 */
		deleteSelected() {
			if ( this.selectedLayerIds.length === 0 ) {
				return;
			}

			// Remove selected layers via StateManager
			const stateManager = this.canvasManager.editor && this.canvasManager.editor.stateManager;
			if ( stateManager ) {
				// Use atomic operation for batch removal
				const idsToRemove = this.selectedLayerIds.slice();
				idsToRemove.forEach( ( id ) => {
					stateManager.removeLayer( id );
				} );
			} else {
				// Legacy fallback for tests/environments without StateManager
				const layers = ( this.canvasManager.editor && this.canvasManager.editor.layers ) ||
					this.canvasManager.layers || [];
				const remaining = layers.filter( ( layer ) =>
					this.selectedLayerIds.indexOf( layer.id ) === -1
				);
				if ( this.canvasManager.editor && this.canvasManager.editor.stateManager ) {
					this.canvasManager.editor.stateManager.set( 'layers', remaining );
				} else if ( this.canvasManager.editor ) {
					this.canvasManager.editor.layers = remaining;
				} else {
					this.canvasManager.layers = remaining;
				}
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
		}

		/**
		 * Duplicate selected layers
		 */
		duplicateSelected() {
			if ( this.selectedLayerIds.length === 0 ) {
				return;
			}

			const selectedLayers = this.getSelectedLayers();
			const newLayers = [];
			const newSelection = [];

			selectedLayers.forEach( ( layer ) => {
				const clone = JSON.parse( JSON.stringify( layer ) );
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
			} );

			// Add new layers via StateManager
			const stateManager = this.canvasManager.editor && this.canvasManager.editor.stateManager;
			if ( stateManager ) {
				newLayers.forEach( ( layer ) => {
					stateManager.addLayer( layer );
				} );
			} else {
				// Legacy fallback for tests/environments without StateManager
				if ( this.canvasManager.editor && this.canvasManager.editor.stateManager ) {
					const currentLayers = this.canvasManager.editor.layers || [];
					this.canvasManager.editor.stateManager.set( 'layers', currentLayers.concat( newLayers ) );
				} else if ( this.canvasManager.editor ) {
					this.canvasManager.editor.layers = ( this.canvasManager.editor.layers || [] ).concat( newLayers );
				} else {
					this.canvasManager.layers = ( this.canvasManager.layers || [] ).concat( newLayers );
				}
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
		}

		/**
		 * Generate unique layer ID
		 *
		 * @return {string} Unique layer ID
		 */
		generateLayerId() {
			return 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 11 );
		}

		/**
		 * Bounds for current selection; null if none.
		 *
		 * @return {Object|null} Bounds of selection or null
		 */
		getSelectionBounds() {
			if ( this.selectedLayerIds.length === 0 ) {
				return null;
			}
			if ( this.selectedLayerIds.length === 1 ) {
				const single = this.getLayerById( this.selectedLayerIds[ 0 ] );
				return single ? this.getLayerBoundsCompat( single ) : null;
			}
			return this.getMultiSelectionBounds();
		}

		/**
		 * Compute layer bounds with graceful fallback when CanvasManager.getLayerBounds
		 * is unavailable in tests.
		 *
		 * @param {Object} layer Layer object
		 * @return {Object|null} Bounds {x,y,width,height} or null
		 */
		getLayerBoundsCompat( layer ) {
			// Prefer CanvasManager.getLayerBounds if available
			if ( this.canvasManager && typeof this.canvasManager.getLayerBounds === 'function' ) {
				return this.canvasManager.getLayerBounds( layer );
			}

			// Use BoundsCalculator utility if available
			if ( BoundsCalculator ) {
				return BoundsCalculator.getLayerBounds( layer );
			}

			// Fallback: inline implementation for when BoundsCalculator not loaded
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
		 * Clean up resources and clear state
		 */
		destroy() {
			// Destroy extracted modules
			if ( this._selectionState ) {
				this._selectionState.destroy();
				this._selectionState = null;
			}
			if ( this._marqueeSelection ) {
				this._marqueeSelection.destroy();
				this._marqueeSelection = null;
			}
			if ( this._selectionHandles ) {
				this._selectionHandles.destroy();
				this._selectionHandles = null;
			}

			// Clear selection state
			this.selectedLayerIds = [];
			this.selectionHandles = [];
			this.marqueeStart = null;
			this.marqueeEnd = null;
			this.dragStart = null;
			this.originalLayerState = null;
			this.lastSelectedId = null;

			// Clear references
			this.canvasManager = null;
			this.config = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.SelectionManager = SelectionManager;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SelectionManager;
	}

}() );
