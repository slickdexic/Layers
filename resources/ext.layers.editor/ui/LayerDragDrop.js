/**
 * Layer Drag and Drop Controller
 * Handles drag-and-drop reordering of layers in the layer panel
 *
 * Extracted from LayerPanel.js for better separation of concerns
 */
( function () {
	'use strict';

	/**
	 * LayerDragDrop class
	 * Manages drag-and-drop layer reordering in the layer panel
	 */
	class LayerDragDrop {
		/**
		 * Create a LayerDragDrop instance
		 *
		 * @param {Object} config Configuration object
		 * @param {HTMLElement} config.layerList The layer list container element
		 * @param {Object} config.editor Reference to the main editor instance
		 * @param {Function} config.renderLayerList Callback to re-render the layer list
		 * @param {Function} [config.addTargetListener] Event listener helper (for EventTracker)
		 */
		constructor( config ) {
			this.layerList = config.layerList;
			this.editor = config.editor;
			this.renderLayerList = config.renderLayerList;
			this.addTargetListener = config.addTargetListener || this._defaultAddListener.bind( this );

			this.setup();
		}

		/**
		 * Default event listener adder (fallback if EventTracker not available)
		 *
		 * @param {Element} target Target element
		 * @param {string} event Event type
		 * @param {Function} handler Event handler
		 * @param {Object} [options] Event listener options
		 * @private
		 */
		_defaultAddListener( target, event, handler, options ) {
			if ( target && typeof target.addEventListener === 'function' ) {
				target.addEventListener( event, handler, options );
			}
		}

		/**
		 * Get layers from StateManager
		 *
		 * @return {Array} Current layers array
		 * @private
		 */
		_getLayers() {
			if ( this.editor && this.editor.stateManager ) {
				return this.editor.stateManager.get( 'layers' ) || [];
			}
			return [];
		}

		/**
		 * Set up drag and drop event handlers
		 */
		setup() {
			if ( !this.layerList ) {
				return;
			}

			this.addTargetListener( this.layerList, 'dragstart', ( e ) => {
				this._handleDragStart( e );
			} );

			this.addTargetListener( this.layerList, 'dragend', ( e ) => {
				this._handleDragEnd( e );
			} );

			this.addTargetListener( this.layerList, 'dragover', ( e ) => {
				e.preventDefault();
			} );

			this.addTargetListener( this.layerList, 'drop', ( e ) => {
				this._handleDrop( e );
			} );
		}

		/**
		 * Handle drag start event
		 *
		 * @param {DragEvent} e Drag event
		 * @private
		 */
		_handleDragStart( e ) {
			const li = e.target.closest( '.layer-item' );
			if ( li ) {
				e.dataTransfer.setData( 'text/plain', li.dataset.layerId );
				li.classList.add( 'dragging' );
			}
		}

		/**
		 * Handle drag end event
		 *
		 * @param {DragEvent} e Drag event
		 * @private
		 */
		_handleDragEnd( e ) {
			const li = e.target.closest( '.layer-item' );
			if ( li ) {
				li.classList.remove( 'dragging' );
			}
		}

		/**
		 * Handle drop event
		 *
		 * @param {DragEvent} e Drop event
		 * @private
		 */
		_handleDrop( e ) {
			e.preventDefault();
			const draggedId = e.dataTransfer.getData( 'text/plain' );
			const targetItem = e.target.closest( '.layer-item' );

			if ( targetItem && draggedId && draggedId !== targetItem.dataset.layerId ) {
				this.reorderLayers( draggedId, targetItem.dataset.layerId );
			}
		}

		/**
		 * Reorder layers by moving dragged layer to target position
		 *
		 * @param {string} draggedId Dragged layer ID
		 * @param {string} targetId Target layer ID
		 */
		reorderLayers( draggedId, targetId ) {
			// Use StateManager's reorderLayer method if available
			if ( this.editor.stateManager && this.editor.stateManager.reorderLayer ) {
				const result = this.editor.stateManager.reorderLayer( draggedId, targetId );
				if ( result ) {
					if ( this.editor.canvasManager ) {
						this.editor.canvasManager.redraw();
					}
					if ( typeof this.renderLayerList === 'function' ) {
						this.renderLayerList();
					}
				}
				return;
			}

			// Fallback for legacy support (when StateManager doesn't have reorderLayer)
			const layers = this._getLayers().slice(); // Make a copy to modify
			let draggedIndex = -1;
			let targetIndex = -1;
			let i;

			for ( i = 0; i < layers.length; i++ ) {
				if ( layers[ i ].id === draggedId ) {
					draggedIndex = i;
					break;
				}
			}

			for ( i = 0; i < layers.length; i++ ) {
				if ( layers[ i ].id === targetId ) {
					targetIndex = i;
					break;
				}
			}

			if ( draggedIndex !== -1 && targetIndex !== -1 ) {
				const draggedLayer = layers.splice( draggedIndex, 1 )[ 0 ];
				layers.splice( targetIndex, 0, draggedLayer );

				if ( this.editor.stateManager ) {
					this.editor.stateManager.set( 'layers', layers );
				}
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}
				if ( typeof this.renderLayerList === 'function' ) {
					this.renderLayerList();
				}
				this.editor.saveState( 'Reorder Layers' );
			}
		}

		/**
		 * Move a layer up or down in the list (keyboard reordering)
		 *
		 * @param {string} layerId Layer ID to move
		 * @param {number} direction Direction to move (-1 for up, 1 for down)
		 * @param {Function} [focusCallback] Optional callback to restore focus after move
		 */
		moveLayer( layerId, direction, focusCallback ) {
			const layers = this._getLayers().slice(); // Make a copy to modify
			let index = -1;

			for ( let i = 0; i < layers.length; i++ ) {
				if ( layers[ i ].id === layerId ) {
					index = i;
					break;
				}
			}

			if ( index === -1 ) {
				return;
			}

			const newIndex = index + direction;
			if ( newIndex < 0 || newIndex >= layers.length ) {
				return;
			}

			// Swap
			const temp = layers[ index ];
			layers[ index ] = layers[ newIndex ];
			layers[ newIndex ] = temp;

			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'layers', layers );
			}
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.redraw();
			}
			if ( typeof this.renderLayerList === 'function' ) {
				this.renderLayerList();
			}
			this.editor.saveState( 'Reorder Layers' );

			// Call focus callback if provided (for keyboard navigation)
			if ( typeof focusCallback === 'function' ) {
				focusCallback( layerId );
			}
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.LayerDragDrop = LayerDragDrop;

		// Backward compatibility - direct window export
		window.LayerDragDrop = LayerDragDrop;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { LayerDragDrop };
	}
}() );
