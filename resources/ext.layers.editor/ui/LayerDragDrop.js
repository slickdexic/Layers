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
				this._handleDragOver( e );
			} );

			this.addTargetListener( this.layerList, 'dragleave', ( e ) => {
				this._handleDragLeave( e );
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
				e.dataTransfer.effectAllowed = 'move';
				li.classList.add( 'dragging' );
				this._draggedId = li.dataset.layerId;
			}
		}

		/**
		 * Handle drag over event - highlight drop targets
		 *
		 * @param {DragEvent} e Drag event
		 * @private
		 */
		_handleDragOver( e ) {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';

			const targetItem = e.target.closest( '.layer-item' );
			if ( !targetItem || targetItem.dataset.layerId === this._draggedId ) {
				return;
			}

			// Clear previous highlights
			this._clearDropHighlights();

			// Check if target is a folder (group)
			if ( targetItem.classList.contains( 'layer-item-group' ) ) {
				// For folders, the entire item is a drop target
				// Use a larger zone (15%-85%) for dropping INTO the folder
				const rect = targetItem.getBoundingClientRect();
				const mouseY = e.clientY - rect.top;
				const height = rect.height;

				if ( mouseY > height * 0.15 && mouseY < height * 0.85 ) {
					// Middle zone - drop INTO folder (most of the item)
					targetItem.classList.add( 'folder-drop-target' );
				} else if ( mouseY <= height * 0.15 ) {
					// Top zone - reorder above
					targetItem.classList.add( 'drop-target-above' );
				} else {
					// Bottom zone - reorder below
					targetItem.classList.add( 'drop-target-below' );
				}
			} else {
				// Regular layer - show reorder indicator
				const rect = targetItem.getBoundingClientRect();
				const mouseY = e.clientY - rect.top;

				if ( mouseY < rect.height / 2 ) {
					targetItem.classList.add( 'drop-target-above' );
				} else {
					targetItem.classList.add( 'drop-target-below' );
				}
			}
		}

		/**
		 * Handle drag leave event
		 *
		 * @param {DragEvent} e Drag event
		 * @private
		 */
		_handleDragLeave( e ) {
			const targetItem = e.target.closest( '.layer-item' );
			if ( targetItem ) {
				targetItem.classList.remove( 'folder-drop-target', 'drop-target-above', 'drop-target-below' );
			}
		}

		/**
		 * Clear all drop highlight classes
		 *
		 * @private
		 */
		_clearDropHighlights() {
			const highlighted = this.layerList.querySelectorAll( '.folder-drop-target, .drop-target-above, .drop-target-below' );
			highlighted.forEach( ( el ) => {
				el.classList.remove( 'folder-drop-target', 'drop-target-above', 'drop-target-below' );
			} );
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
			this._clearDropHighlights();
			this._draggedId = null;
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

			// Check for folder drop BEFORE clearing highlights (defensive check for classList)
			const isFolderDrop = targetItem && targetItem.classList &&
				targetItem.classList.contains( 'folder-drop-target' );

			this._clearDropHighlights();

			if ( !targetItem || !draggedId || draggedId === targetItem.dataset.layerId ) {
				return;
			}

			const targetId = targetItem.dataset.layerId;
			const isFolder = targetItem.classList && targetItem.classList.contains( 'layer-item-group' );

			// Debug logging
			if ( typeof console !== 'undefined' && console.log ) {
				console.log( '[LayerDragDrop] Drop event:', {
					draggedId,
					targetId,
					isFolder,
					isFolderDrop,
					targetClasses: targetItem.className
				} );
			}

			// Check if dropping into a folder using the highlight class (more reliable than position)
			if ( isFolderDrop && isFolder ) {
				if ( typeof console !== 'undefined' && console.log ) {
					console.log( '[LayerDragDrop] Dropping into folder via highlight class' );
				}
				this.moveToFolder( draggedId, targetId );
				return;
			}

			// Fallback: Check if dropping into a folder by position
			if ( isFolder ) {
				const rect = targetItem.getBoundingClientRect();
				const mouseY = e.clientY - rect.top;
				const height = rect.height;

				if ( typeof console !== 'undefined' && console.log ) {
					console.log( '[LayerDragDrop] Folder position check:', {
						mouseY,
						height,
						ratio: mouseY / height,
						inDropZone: mouseY > height * 0.15 && mouseY < height * 0.85
					} );
				}

				// Use the same zone as dragover (15%-85% for folder drop)
				if ( mouseY > height * 0.15 && mouseY < height * 0.85 ) {
					// Drop INTO folder
					this.moveToFolder( draggedId, targetId );
					return;
				}
			}

			// Standard reorder
			this.reorderLayers( draggedId, targetId );
		}

		/**
		 * Move a layer into a folder
		 *
		 * @param {string} layerId ID of the layer to move
		 * @param {string} folderId ID of the target folder
		 */
		moveToFolder( layerId, folderId ) {
			// Log for debugging
			if ( typeof console !== 'undefined' && console.log ) {
				console.log( '[LayerDragDrop] moveToFolder called:', {
					layerId,
					folderId,
					hasEditor: !!this.editor,
					hasGroupManager: !!( this.editor && this.editor.groupManager ),
					hasMoveToFolder: !!( this.editor && this.editor.groupManager && this.editor.groupManager.moveToFolder )
				} );
			}

			if ( this.editor && this.editor.groupManager &&
				typeof this.editor.groupManager.moveToFolder === 'function' ) {
				const success = this.editor.groupManager.moveToFolder( layerId, folderId );
				if ( typeof console !== 'undefined' && console.log ) {
					console.log( '[LayerDragDrop] moveToFolder result:', success );
				}
				if ( success ) {
					// Show success notification
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify( 'Layer moved to folder', { type: 'success', autoHide: true, autoHideSeconds: 2 } );
					}
					if ( this.editor.canvasManager ) {
						this.editor.canvasManager.redraw();
					}
					if ( typeof this.renderLayerList === 'function' ) {
						this.renderLayerList();
					}
				} else {
					// Show error notification
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify( 'Could not move layer to folder', { type: 'error' } );
					}
				}
			} else {
				if ( typeof console !== 'undefined' && console.error ) {
					console.error( '[LayerDragDrop] groupManager.moveToFolder not available:', {
						editor: this.editor,
						groupManager: this.editor && this.editor.groupManager
					} );
				}
				// Fallback notification
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify( 'Folder functionality not available - please reload', { type: 'error' } );
				}
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
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = { LayerDragDrop };
	}
}() );
