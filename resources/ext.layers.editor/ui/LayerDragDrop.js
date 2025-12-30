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
				// For folders, determine if collapsed by checking for collapsed class or data attribute
				const isCollapsed = targetItem.classList.contains( 'collapsed' ) ||
					targetItem.getAttribute( 'aria-expanded' ) === 'false';

				const rect = targetItem.getBoundingClientRect();
				const mouseY = e.clientY - rect.top;
				const height = rect.height;

				if ( isCollapsed ) {
					// Collapsed folder: only allow drop above/below, not into
					// The folder visually represents the entire group, so treat it like a single item
					if ( mouseY < height / 2 ) {
						targetItem.classList.add( 'drop-target-above' );
					} else {
						targetItem.classList.add( 'drop-target-below' );
					}
				} else {
					// Expanded folder: use zones for drop into vs reorder
					// Use a larger zone (15%-85%) for dropping INTO the folder
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

			// Capture drop position indicators BEFORE clearing highlights
			const isFolderDrop = targetItem && targetItem.classList &&
				targetItem.classList.contains( 'folder-drop-target' );
			const isDropAbove = targetItem && targetItem.classList &&
				targetItem.classList.contains( 'drop-target-above' );
			const isDropBelow = targetItem && targetItem.classList &&
				targetItem.classList.contains( 'drop-target-below' );

			this._clearDropHighlights();

			if ( !targetItem || !draggedId || draggedId === targetItem.dataset.layerId ) {
				return;
			}

			const targetId = targetItem.dataset.layerId;
			const isFolder = targetItem.classList && targetItem.classList.contains( 'layer-item-group' );

			// Check if dropping into a folder using the highlight class (more reliable than position)
			if ( isFolderDrop && isFolder ) {
				this.moveToFolder( draggedId, targetId );
				return;
			}

			// Fallback: Check if dropping into a folder by position
			// ONLY use this fallback if we don't already have a clear drop position indicator
			// (isDropAbove or isDropBelow means the dragover handler already determined position)
			if ( isFolder && !isDropAbove && !isDropBelow ) {
				const rect = targetItem.getBoundingClientRect();
				const mouseY = e.clientY - rect.top;
				const height = rect.height;

				// Use the same zone as dragover (15%-85% for folder drop)
				if ( mouseY > height * 0.15 && mouseY < height * 0.85 ) {
					// Drop INTO folder
					this.moveToFolder( draggedId, targetId );
					return;
				}
			}

			// Special case: dropping below a collapsed folder
			// When a folder is collapsed, its children are hidden visually but still exist
			// in the flat array. Dropping "below" a collapsed folder should place the layer
			// after all the folder's children, not between the folder and its first child.
			// We handle this directly here to avoid reorderLayers thinking we're joining the folder.
			if ( isFolder && isDropBelow ) {
				const folder = this.editor.getLayerById ? this.editor.getLayerById( targetId ) : null;
				if ( folder && folder.expanded === false && folder.children && folder.children.length > 0 ) {
					// Folder is collapsed and has children - find the last child
					const lastChildId = folder.children[ folder.children.length - 1 ];

					// First, remove from any current folder (if applicable)
					const draggedLayer = this.editor.getLayerById ? this.editor.getLayerById( draggedId ) : null;
					if ( draggedLayer && draggedLayer.parentGroup ) {
						if ( this.editor.groupManager && this.editor.groupManager.removeFromFolder ) {
							this.editor.groupManager.removeFromFolder( draggedId );
						}
					}

					// Directly reorder after the last child - bypass folder logic
					if ( this.editor.stateManager && this.editor.stateManager.reorderLayer ) {
						this.editor.stateManager.reorderLayer( draggedId, lastChildId, true );
					}

					if ( this.editor.canvasManager ) {
						this.editor.canvasManager.redraw();
					}
					if ( typeof this.renderLayerList === 'function' ) {
						this.renderLayerList();
					}
					return;
				}
			}

			// Special case: dropping onto the background layer item
			// The background layer item has ID '__background__' and is not a real layer
			// Dropping "above" it should move the layer to the end of the layers array
			if ( targetId === '__background__' ) {
				// First, remove from any current folder
				const draggedLayer = this.editor.getLayerById ? this.editor.getLayerById( draggedId ) : null;
				if ( draggedLayer && draggedLayer.parentGroup ) {
					if ( this.editor.groupManager && this.editor.groupManager.removeFromFolder ) {
						this.editor.groupManager.removeFromFolder( draggedId );
					}
				}

				// Move to end of layers array (bottom of stack, just above background visually)
				if ( this.editor.stateManager && this.editor.stateManager.sendToBack ) {
					this.editor.stateManager.sendToBack( draggedId );
				}

				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}
				if ( typeof this.renderLayerList === 'function' ) {
					this.renderLayerList();
				}
				return;
			}

			// Standard reorder - pass drop position for correct insertion
			this.reorderLayers( draggedId, targetId, isDropBelow );
		}

		/**
		 * Move a layer into a folder
		 *
		 * @param {string} layerId ID of the layer to move
		 * @param {string} folderId ID of the target folder
		 */
		moveToFolder( layerId, folderId ) {
			if ( this.editor && this.editor.groupManager &&
				typeof this.editor.groupManager.moveToFolder === 'function' ) {
				const success = this.editor.groupManager.moveToFolder( layerId, folderId );
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
		 * @param {boolean} [insertAfter=false] If true, insert after target; if false, insert before target
		 */
		reorderLayers( draggedId, targetId, insertAfter ) {
			// Get layer objects for context
			const draggedLayer = this.editor.getLayerById ? this.editor.getLayerById( draggedId ) : null;
			const targetLayer = this.editor.getLayerById ? this.editor.getLayerById( targetId ) : null;

			// Determine folder membership changes needed
			const draggedInFolder = draggedLayer && draggedLayer.parentGroup;
			const targetInFolder = targetLayer && targetLayer.parentGroup;
			const sameFolder = draggedInFolder && targetInFolder &&
				draggedLayer.parentGroup === targetLayer.parentGroup;

			// Case 1: Dragging INTO a folder (target is inside a folder, dragged is not in that folder)
			if ( targetInFolder && !sameFolder ) {
				const targetFolderId = targetLayer.parentGroup;

				// First remove from current folder if in one
				if ( draggedInFolder && draggedLayer.parentGroup !== targetFolderId ) {
					if ( this.editor.groupManager && this.editor.groupManager.removeFromFolder ) {
						this.editor.groupManager.removeFromFolder( draggedId );
					}
				}

				// Determine the correct beforeSiblingId based on drop position
				let beforeSiblingId = targetId;
				if ( insertAfter ) {
					// Find the next sibling in the folder
					const folder = this.editor.getLayerById ? this.editor.getLayerById( targetFolderId ) : null;
					if ( folder && folder.children ) {
						const targetIndex = folder.children.indexOf( targetId );
						if ( targetIndex >= 0 && targetIndex < folder.children.length - 1 ) {
							beforeSiblingId = folder.children[ targetIndex + 1 ];
						} else {
							// Target is last in folder, add at end (beforeSiblingId = null)
							beforeSiblingId = null;
						}
					}
				}

				// Add to target folder at the correct position
				if ( this.editor.groupManager && this.editor.groupManager.addToFolderAtPosition ) {
					// Use position-aware method - this handles both children array and flat array positioning
					this.editor.groupManager.addToFolderAtPosition( draggedId, targetFolderId, beforeSiblingId );
				} else if ( this.editor.groupManager && this.editor.groupManager.moveToFolder ) {
					// Fallback: add to folder (will go to end, then reorder separately)
					this.editor.groupManager.moveToFolder( draggedId, targetFolderId );
					// Only reorder as fallback when using moveToFolder (which doesn't position)
					if ( this.editor.stateManager && this.editor.stateManager.reorderLayer ) {
						this.editor.stateManager.reorderLayer( draggedId, targetId );
					}
				}

				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.redraw();
				}
				if ( typeof this.renderLayerList === 'function' ) {
					this.renderLayerList();
				}
				return;
			}

			// Case 2: Dragging OUT of a folder (dragged is in folder, target is not in that folder)
			if ( draggedInFolder && !sameFolder ) {
				// Remove from folder - this includes when dropping on the folder itself
				// (meaning the user wants to move the layer out of the folder)
				if ( this.editor.groupManager && this.editor.groupManager.removeFromFolder ) {
					this.editor.groupManager.removeFromFolder( draggedId );
				}
			}

			// Case 3: Standard reorder (both outside folders, or both in same folder)
			if ( this.editor.stateManager && this.editor.stateManager.reorderLayer ) {
				const result = this.editor.stateManager.reorderLayer( draggedId, targetId, insertAfter );
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

			// Check if moving layer out of its folder
			const movingLayer = layers[ index ];
			const targetLayer = layers[ newIndex ];

			if ( movingLayer.parentGroup ) {
				// Layer is in a folder - check if target is outside that folder
				const isTargetInSameFolder = targetLayer && targetLayer.parentGroup === movingLayer.parentGroup;
				const isTargetTheFolder = targetLayer && targetLayer.id === movingLayer.parentGroup;

				if ( !isTargetInSameFolder && !isTargetTheFolder ) {
					// Moving outside folder - remove from folder first
					if ( this.editor.groupManager && this.editor.groupManager.removeFromFolder ) {
						this.editor.groupManager.removeFromFolder( layerId );
						// Re-fetch layers after removal since state changed
						const updatedLayers = this._getLayers().slice();
						// Find new indices after folder removal
						let newMovingIndex = -1;
						let newTargetIndex = -1;
						for ( let i = 0; i < updatedLayers.length; i++ ) {
							if ( updatedLayers[ i ].id === layerId ) {
								newMovingIndex = i;
							}
							if ( updatedLayers[ i ].id === targetLayer.id ) {
								newTargetIndex = i;
							}
						}
						if ( newMovingIndex !== -1 && newTargetIndex !== -1 ) {
							// Swap with updated indices
							const temp = updatedLayers[ newMovingIndex ];
							updatedLayers[ newMovingIndex ] = updatedLayers[ newTargetIndex ];
							updatedLayers[ newTargetIndex ] = temp;

							if ( this.editor.stateManager ) {
								this.editor.stateManager.set( 'layers', updatedLayers );
							}
						}
						if ( this.editor.canvasManager ) {
							this.editor.canvasManager.redraw();
						}
						if ( typeof this.renderLayerList === 'function' ) {
							this.renderLayerList();
						}
						this.editor.saveState( 'Move Layer Out of Folder' );
						if ( typeof focusCallback === 'function' ) {
							focusCallback( layerId );
						}
						return;
					}
				}
			}

			// Standard swap (layer not in folder, or staying within folder)
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
