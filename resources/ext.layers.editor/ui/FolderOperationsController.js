/**
 * Folder Operations Controller
 * Handles folder/group layer operations: creation, deletion, visibility cascading
 *
 * Extracted from LayerPanel.js for better separation of concerns
 * @since 1.2.15
 */
( function () {
	'use strict';

	/**
	 * FolderOperationsController class
	 * Manages folder-specific operations in the layer panel
	 */
	class FolderOperationsController {
		/**
		 * Create a FolderOperationsController instance
		 *
		 * @param {Object} config Configuration object
		 * @param {Object} config.editor Reference to the LayersEditor instance
		 * @param {Function} config.msg Message getter function for i18n
		 * @param {Function} config.getSelectedLayerIds Function to get selected layer IDs
		 * @param {Function} config.renderLayerList Function to re-render the layer list
		 * @param {Function} config.updateCodePanel Function to update code panel
		 * @param {Function} config.updatePropertiesPanel Function to update properties panel
		 * @param {Function} config.registerDialogCleanup Function to register dialog cleanup
		 */
		constructor( config ) {
			this.editor = config.editor;
			this.msg = config.msg || ( ( key, fallback ) => fallback || key );
			this.getSelectedLayerIds = config.getSelectedLayerIds || ( () => [] );
			this.renderLayerList = config.renderLayerList || ( () => {} );
			this.updateCodePanel = config.updateCodePanel || ( () => {} );
			this.updatePropertiesPanel = config.updatePropertiesPanel || ( () => {} );
			this.registerDialogCleanup = config.registerDialogCleanup || ( () => {} );
		}

		/**
		 * Create a folder (group) - can be empty or include selected layers
		 *
		 * @return {Object|null} The created folder layer or null on failure
		 */
		createFolder() {
			const selectedIds = this.getSelectedLayerIds();

			// Use GroupManager if available
			if ( this.editor && this.editor.groupManager ) {
				const createdFolder = this.editor.groupManager.createFolder( selectedIds );
				if ( createdFolder ) {
					// Select the new folder
					if ( this.editor.stateManager ) {
						this.editor.stateManager.set( 'selectedLayerIds', [ createdFolder.id ] );
					}
					// Notify success
					if ( typeof mw !== 'undefined' && mw.notify ) {
						const msg = selectedIds.length > 0 ?
							this.msg( 'layers-folder-created-with-layers', 'Folder created with ' + selectedIds.length + ' layer(s)' ) :
							this.msg( 'layers-folder-created', 'Folder created' );
						mw.notify( msg, { type: 'success', tag: 'layers-folder' } );
					}
					// Refresh the layer list
					this.renderLayerList();
					return createdFolder;
				}
				// Folder creation failed
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.msg( 'layers-folder-failed', 'Failed to create folder' ),
						{ type: 'error', tag: 'layers-folder' }
					);
				}
			} else {
				// Fallback: notify that folders are not available
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.msg( 'layers-folder-unavailable', 'Folders are not available' ),
						{ type: 'error', tag: 'layers-folder' }
					);
				}
			}
			return null;
		}

		/**
		 * Delete a layer, with special handling for folders
		 *
		 * @param {string} layerId Layer ID to delete
		 * @param {Function} createConfirmDialog Confirm dialog function
		 */
		deleteLayer( layerId, createConfirmDialog ) {
			const layer = this.editor.getLayerById( layerId );

			if ( !layer ) {
				return;
			}

			// Check if this is a folder with children
			const isGroupWithChildren = layer.type === 'group' &&
				Array.isArray( layer.children ) && layer.children.length > 0;

			if ( isGroupWithChildren ) {
				// Show folder-specific dialog with options
				this.showFolderDeleteDialog( layerId, layer );
			} else {
				// Standard delete confirmation
				const confirmMessage = this.msg( 'layers-delete-confirm', 'Are you sure you want to delete this layer?' );
				createConfirmDialog( confirmMessage, () => {
					this.performLayerDelete( layerId );
					this.editor.saveState( layer.type === 'group' ? 'Delete Folder' : 'Delete Layer' );
				} );
			}
		}

		/**
		 * Show delete dialog for a folder with options
		 *
		 * @param {string} folderId Folder layer ID
		 * @param {Object} folder Folder layer object
		 */
		showFolderDeleteDialog( folderId, folder ) {
			const t = this.msg;
			const childCount = folder.children.length;

			// Create custom dialog with two options
			const overlay = document.createElement( 'div' );
			overlay.className = 'layers-modal-overlay';
			overlay.setAttribute( 'role', 'presentation' );

			const dialog = document.createElement( 'div' );
			dialog.className = 'layers-modal-dialog';
			dialog.setAttribute( 'role', 'alertdialog' );
			dialog.setAttribute( 'aria-modal', 'true' );
			dialog.setAttribute( 'aria-label', t( 'layers-delete-folder-title', 'Delete Folder' ) );

			const title = document.createElement( 'h3' );
			title.textContent = t( 'layers-delete-folder-title', 'Delete Folder' );
			title.style.margin = '0 0 12px 0';
			dialog.appendChild( title );

			const text = document.createElement( 'p' );
			text.textContent = t(
				'layers-delete-folder-message',
				'This folder contains ' + childCount + ' layer(s). What would you like to do?'
			).replace( '$1', childCount );
			dialog.appendChild( text );

			const buttons = document.createElement( 'div' );
			buttons.className = 'layers-modal-buttons';
			buttons.style.flexDirection = 'column';
			buttons.style.gap = '8px';

			// Option 1: Delete folder only (keep children)
			const keepChildrenBtn = document.createElement( 'button' );
			keepChildrenBtn.textContent = t( 'layers-delete-folder-keep-children', 'Delete folder only (keep layers)' );
			keepChildrenBtn.className = 'layers-btn layers-btn-secondary';
			keepChildrenBtn.style.width = '100%';

			// Option 2: Delete folder and all contents
			const deleteAllBtn = document.createElement( 'button' );
			deleteAllBtn.textContent = t( 'layers-delete-folder-delete-all', 'Delete folder and all layers inside' );
			deleteAllBtn.className = 'layers-btn layers-btn-danger';
			deleteAllBtn.style.width = '100%';

			// Cancel button
			const cancelBtn = document.createElement( 'button' );
			cancelBtn.textContent = t( 'layers-cancel', 'Cancel' );
			cancelBtn.className = 'layers-btn';
			cancelBtn.style.width = '100%';

			buttons.appendChild( keepChildrenBtn );
			buttons.appendChild( deleteAllBtn );
			buttons.appendChild( cancelBtn );
			dialog.appendChild( buttons );

			document.body.appendChild( overlay );
			document.body.appendChild( dialog );

			const cleanup = () => {
				if ( overlay.parentNode ) {
					overlay.parentNode.removeChild( overlay );
				}
				if ( dialog.parentNode ) {
					dialog.parentNode.removeChild( dialog );
				}
			};

			this.registerDialogCleanup( cleanup );

			// Handle option 1: Delete folder only, unparent children
			keepChildrenBtn.addEventListener( 'click', () => {
				cleanup();
				this.deleteFolderKeepChildren( folderId, folder );
			} );

			// Handle option 2: Delete folder and all contents
			deleteAllBtn.addEventListener( 'click', () => {
				cleanup();
				this.deleteFolderAndContents( folderId, folder );
			} );

			cancelBtn.addEventListener( 'click', cleanup );
			overlay.addEventListener( 'click', cleanup );

			// Focus the cancel button for accessibility
			cancelBtn.focus();
		}

		/**
		 * Delete a folder but keep its children (unparent them)
		 *
		 * @param {string} folderId Folder layer ID
		 * @param {Object} folder Folder layer object
		 */
		deleteFolderKeepChildren( folderId, folder ) {
			// Start batch mode so all operations are one undo step
			if ( this.editor.historyManager ) {
				this.editor.historyManager.startBatch( 'Delete Folder (Keep Layers)' );
			}

			// Unparent all children
			for ( const childId of folder.children ) {
				const child = this.editor.getLayerById( childId );
				if ( child ) {
					delete child.parentGroup;
				}
			}

			// Now delete the folder itself
			this.performLayerDelete( folderId );

			// End batch mode - saves as single history entry
			if ( this.editor.historyManager ) {
				this.editor.historyManager.endBatch();
			}
		}

		/**
		 * Delete a folder and all its contents recursively
		 *
		 * @param {string} folderId Folder layer ID
		 * @param {Object} folder Folder layer object
		 */
		deleteFolderAndContents( folderId, folder ) {
			// Start batch mode so all operations are one undo step
			if ( this.editor.historyManager ) {
				this.editor.historyManager.startBatch( 'Delete Folder and Contents' );
			}

			// Delete children first (recursively handles nested folders)
			this.deleteChildrenRecursively( folder.children );

			// Now delete the folder itself
			this.performLayerDelete( folderId );

			// End batch mode - saves as single history entry
			if ( this.editor.historyManager ) {
				this.editor.historyManager.endBatch();
			}
		}

		/**
		 * Recursively delete child layers
		 *
		 * @param {Array} childIds Array of child layer IDs
		 */
		deleteChildrenRecursively( childIds ) {
			for ( const childId of childIds ) {
				const child = this.editor.getLayerById( childId );
				if ( child ) {
					// If child is also a group, delete its children first
					if ( child.type === 'group' && Array.isArray( child.children ) ) {
						this.deleteChildrenRecursively( child.children );
					}
					this.editor.removeLayer( childId );
				}
			}
		}

		/**
		 * Perform the actual layer deletion
		 *
		 * @param {string} layerId Layer ID to delete
		 */
		performLayerDelete( layerId ) {
			this.editor.removeLayer( layerId );
			this.renderLayerList();
			this.updateCodePanel();
			// Clear selection if deleting the selected layer
			if ( this.editor && this.editor.stateManager ) {
				const selectedIds = this.editor.stateManager.get( 'selectedLayerIds' ) || [];
				if ( selectedIds.includes( layerId ) ) {
					this.editor.stateManager.set( 'selectedLayerIds', [] );
				}
			}
			this.updatePropertiesPanel( null );
		}

		/**
		 * Recursively set visibility on child layers
		 *
		 * @param {Array} childIds Array of child layer IDs
		 * @param {boolean} visible Visibility state to set
		 */
		setChildrenVisibility( childIds, visible ) {
			for ( const childId of childIds ) {
				const child = this.editor.getLayerById( childId );
				if ( child ) {
					child.visible = visible;
					// Recurse if child is also a group
					if ( child.type === 'group' && Array.isArray( child.children ) ) {
						this.setChildrenVisibility( child.children, visible );
					}
				}
			}
		}

		/**
		 * Toggle visibility for a layer, with cascading for groups
		 *
		 * @param {string} layerId Layer ID to toggle
		 */
		toggleLayerVisibility( layerId ) {
			const layer = this.editor.getLayerById( layerId );
			if ( layer ) {
				const newVisibility = !( layer.visible !== false );
				layer.visible = newVisibility;

				// If this is a group, cascade visibility to all children
				if ( layer.type === 'group' && Array.isArray( layer.children ) ) {
					this.setChildrenVisibility( layer.children, newVisibility );
				}

				if ( this.editor.canvasManager ) {
					const layers = this.editor.stateManager ? this.editor.stateManager.get( 'layers' ) || [] : [];
					this.editor.canvasManager.renderLayers( layers );
				}
				this.renderLayerList();
				this.updateCodePanel();
				this.editor.saveState( layer.visible ? 'Show Layer' : 'Hide Layer' );
			}
		}

		/**
		 * Ungroup a group layer
		 *
		 * @param {string} groupId Group layer ID
		 */
		ungroupLayer( groupId ) {
			if ( !groupId ) {
				return;
			}
			if ( this.editor && this.editor.groupManager ) {
				const success = this.editor.groupManager.ungroup( groupId );
				if ( success ) {
					// Show success notification
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify(
							this.msg( 'layers-ungrouped', 'Group removed' ),
							{ type: 'success', tag: 'layers-group' }
						);
					}
					this.renderLayerList();
					this.updateCodePanel();
					this.editor.saveState( 'Ungroup' );
				}
			}
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.UI = window.Layers.UI || {};
	window.Layers.UI.FolderOperationsController = FolderOperationsController;

	// Legacy global export for compatibility
	window.FolderOperationsController = FolderOperationsController;

	// CommonJS export for Jest
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = FolderOperationsController;
	}

} )();
