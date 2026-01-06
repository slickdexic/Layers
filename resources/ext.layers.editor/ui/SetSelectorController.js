/**
 * Set Selector Controller for Layers Editor
 * Manages named layer set selection, creation, deletion, and renaming
 *
 * Extracted from UIManager.js to reduce complexity and improve maintainability.
 *
 * @class SetSelectorController
 */
( function () {
	'use strict';

	class SetSelectorController {
		/**
		 * @param {Object} uiManager - Reference to the parent UIManager
		 */
		constructor( uiManager ) {
			this.uiManager = uiManager;
			this.editor = uiManager.editor;

			// Element references (will be set during createSetSelector)
			this.setSelectEl = null;
			this.newSetInputEl = null;
			this.newSetBtnEl = null;
			this.setRenameBtnEl = null;
			this.setDeleteBtnEl = null;
		}

		/**
		 * Get a localized message
		 * @param {string} key - Message key
		 * @param {string} [fallback=''] - Fallback text
		 * @return {string}
		 */
		getMessage( key, fallback = '' ) {
			return this.uiManager.getMessage( key, fallback );
		}

		/**
		 * Add an event listener with memory-safe tracking
		 * @param {EventTarget} element - Element to attach listener to
		 * @param {string} event - Event type
		 * @param {Function} handler - Event handler
		 * @param {Object|boolean} [options] - Event listener options
		 */
		addListener( element, event, handler, options ) {
			this.uiManager.addListener( element, event, handler, options );
		}

		/**
		 * Show a confirmation dialog
		 * @param {Object} options - Dialog options
		 * @return {Promise<boolean>}
		 */
		showConfirmDialog( options ) {
			return this.uiManager.showConfirmDialog( options );
		}

		/**
		 * Show a prompt dialog
		 * @param {Object} options - Dialog options
		 * @return {Promise<string|null>}
		 */
		showPromptDialog( options ) {
			return this.uiManager.showPromptDialog( options );
		}

		/**
		 * Create the Named Set selector UI
		 * Allows users to switch between different annotation sets (e.g., "default", "anatomy-labels")
		 * @return {HTMLElement} The set selector wrapper element
		 */
		createSetSelector() {
			const setWrap = document.createElement( 'div' );
			setWrap.className = 'layers-set-wrap';
			setWrap.setAttribute( 'role', 'group' );
			setWrap.setAttribute( 'aria-label', this.getMessage( 'layers-set-selector-group' ) );

			// Set label
			const setLabel = document.createElement( 'label' );
			setLabel.className = 'layers-set-label';
			setLabel.textContent = this.getMessage( 'layers-set-label' ) + ':';
			const setSelectId = 'layers-set-select-' + Math.random().toString( 36 ).slice( 2, 11 );
			setLabel.setAttribute( 'for', setSelectId );
			setWrap.appendChild( setLabel );

			// Set dropdown
			this.setSelectEl = document.createElement( 'select' );
			this.setSelectEl.className = 'layers-set-select';
			this.setSelectEl.id = setSelectId;
			this.setSelectEl.setAttribute( 'aria-label', this.getMessage( 'layers-set-select-aria' ) );
			setWrap.appendChild( this.setSelectEl );

			// New set input (hidden by default, shown when "+ New" is selected)
			this.newSetInputEl = document.createElement( 'input' );
			this.newSetInputEl.type = 'text';
			this.newSetInputEl.className = 'layers-new-set-input';
			this.newSetInputEl.placeholder = this.getMessage( 'layers-new-set-placeholder' );
			this.newSetInputEl.setAttribute( 'aria-label', this.getMessage( 'layers-new-set-aria' ) );
			this.newSetInputEl.maxLength = 255;
			this.newSetInputEl.style.display = 'none';
			setWrap.appendChild( this.newSetInputEl );

			// Create new set button (hidden by default)
			this.newSetBtnEl = document.createElement( 'button' );
			this.newSetBtnEl.type = 'button';
			this.newSetBtnEl.className = 'layers-new-set-btn';
			this.newSetBtnEl.textContent = this.getMessage( 'layers-new-set-create' );
			this.newSetBtnEl.setAttribute( 'aria-label', this.getMessage( 'layers-new-set-create-aria' ) );
			this.newSetBtnEl.style.display = 'none';
			setWrap.appendChild( this.newSetBtnEl );

			// Rename set button - allows renaming the current set (only for owner/admin)
			this.setRenameBtnEl = document.createElement( 'button' );
			this.setRenameBtnEl.type = 'button';
			this.setRenameBtnEl.className = 'layers-set-action-btn layers-set-rename-btn';
			this.setRenameBtnEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
			this.setRenameBtnEl.title = this.getMessage( 'layers-rename-set-tooltip', 'Rename this layer set' );
			this.setRenameBtnEl.setAttribute( 'aria-label', this.getMessage( 'layers-rename-set', 'Rename set' ) );
			setWrap.appendChild( this.setRenameBtnEl );

			// Delete set button - allows deleting the current set (only for owner/admin)
			this.setDeleteBtnEl = document.createElement( 'button' );
			this.setDeleteBtnEl.type = 'button';
			this.setDeleteBtnEl.className = 'layers-set-action-btn layers-set-delete-btn';
			this.setDeleteBtnEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
			this.setDeleteBtnEl.title = this.getMessage( 'layers-delete-set-tooltip', 'Delete this layer set' );
			this.setDeleteBtnEl.setAttribute( 'aria-label', this.getMessage( 'layers-delete-set', 'Delete set' ) );
			setWrap.appendChild( this.setDeleteBtnEl );

			// Store references in UIManager for backward compatibility
			this.uiManager.setSelectEl = this.setSelectEl;
			this.uiManager.newSetInputEl = this.newSetInputEl;
			this.uiManager.newSetBtnEl = this.newSetBtnEl;
			this.uiManager.setRenameBtnEl = this.setRenameBtnEl;
			this.uiManager.setDeleteBtnEl = this.setDeleteBtnEl;

			return setWrap;
		}

		/**
		 * Set up event handlers for the Named Set selector
		 */
		setupControls() {
			if ( !this.setSelectEl ) {
				return;
			}

			// Handle set selection change
			this.addListener( this.setSelectEl, 'change', async () => {
				const selectedValue = this.setSelectEl.value;

				if ( selectedValue === '__new__' ) {
					// Show new set input
					this.showNewSetInput( true );
				} else {
					// Hide new set input
					this.showNewSetInput( false );

					// Load selected set
					if ( selectedValue && this.editor.loadLayerSetByName ) {
						// Check for unsaved changes
						const isDirty = this.editor.stateManager ?
							this.editor.stateManager.get( 'isDirty' ) : false;

						if ( isDirty ) {
							const confirmed = await this.showConfirmDialog( {
								message: this.getMessage( 'layers-switch-set-unsaved-confirm' ),
								title: this.getMessage( 'layers-unsaved-changes-title', 'Unsaved Changes' ),
								confirmText: this.getMessage( 'layers-switch-anyway', 'Switch Anyway' ),
								isDanger: true
							} );
							if ( !confirmed ) {
								// Restore previous selection
								const currentSet = this.editor.stateManager ?
									this.editor.stateManager.get( 'currentSetName' ) : 'default';
								this.setSelectEl.value = currentSet;
								return;
							}
						}

						this.editor.loadLayerSetByName( selectedValue );
					}
				}
			} );

			// Handle new set creation
			if ( this.newSetBtnEl ) {
				this.addListener( this.newSetBtnEl, 'click', () => {
					this.createNewSet();
				} );
			}

			// Handle set deletion
			if ( this.setDeleteBtnEl ) {
				this.addListener( this.setDeleteBtnEl, 'click', () => {
					this.deleteCurrentSet();
				} );
			}

			// Handle set renaming
			if ( this.setRenameBtnEl ) {
				this.addListener( this.setRenameBtnEl, 'click', () => {
					this.renameCurrentSet();
				} );
			}

			// Handle Enter key in new set input
			if ( this.newSetInputEl ) {
				this.addListener( this.newSetInputEl, 'keydown', ( e ) => {
					if ( e.key === 'Enter' ) {
						e.preventDefault();
						this.createNewSet();
					} else if ( e.key === 'Escape' ) {
						this.showNewSetInput( false );
						// Restore previous selection
						const currentSet = this.editor.stateManager ?
							this.editor.stateManager.get( 'currentSetName' ) : 'default';
						this.setSelectEl.value = currentSet;
					}
				} );
			}
		}

		/**
		 * Show or hide the new set input field
		 * @param {boolean} show Whether to show the input
		 */
		showNewSetInput( show ) {
			if ( this.newSetInputEl ) {
				this.newSetInputEl.style.display = show ? 'inline-block' : 'none';
				if ( show ) {
					this.newSetInputEl.value = '';
					this.newSetInputEl.focus();
				}
			}
			if ( this.newSetBtnEl ) {
				this.newSetBtnEl.style.display = show ? 'inline-block' : 'none';
			}
		}

		/**
		 * Create a new named set from the input field
		 */
		createNewSet() {
			if ( !this.newSetInputEl ) {
				return;
			}

			const newName = this.newSetInputEl.value.trim();

			if ( !newName ) {
				mw.notify( this.getMessage( 'layers-new-set-name-required' ), { type: 'warn' } );
				this.newSetInputEl.focus();
				return;
			}

			// Validate name (allow letters, numbers, underscores, dashes, spaces - matches server)
			if ( !/^[\p{L}\p{N}_\-\s]+$/u.test( newName ) ) {
				mw.notify( this.getMessage( 'layers-invalid-setname' ), { type: 'error' } );
				this.newSetInputEl.focus();
				return;
			}

			// Check if name already exists
			const namedSets = this.editor.stateManager ?
				this.editor.stateManager.get( 'namedSets' ) : [];
			const exists = namedSets.some( set => set.name.toLowerCase() === newName.toLowerCase() );

			if ( exists ) {
				mw.notify( this.getMessage( 'layers-set-name-exists' ), { type: 'warn' } );
				this.newSetInputEl.focus();
				return;
			}

			// Hide input and set the new name as current
			this.showNewSetInput( false );

			// Update state to use new set name
			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'currentSetName', newName );
				this.editor.stateManager.set( 'currentLayerSetId', null ); // New set has no ID yet
				this.editor.stateManager.set( 'setRevisions', [] ); // No revisions yet
				this.editor.stateManager.set( 'isDirty', true );

				// Clear existing layers - new set starts blank
				this.editor.stateManager.set( 'layers', [] );
				this.editor.stateManager.set( 'selectedLayerIds', [] );

				// Add to namedSets array so it's tracked properly
				const updatedSets = [ ...namedSets, {
					name: newName,
					revision_count: 0,
					latest_revision: null,
					latest_timestamp: null,
					latest_user_name: mw.config.get( 'wgUserName' )
				} ];
				this.editor.stateManager.set( 'namedSets', updatedSets );
			}

			// Render empty canvas for new set
			if ( this.editor.canvasManager && typeof this.editor.canvasManager.renderLayers === 'function' ) {
				this.editor.canvasManager.renderLayers( [] );
			}

			// Update layer panel to reflect empty state
			if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateList === 'function' ) {
				this.editor.layerPanel.updateList();
			}

			// Add to set selector and select it
			this.addSetOption( newName, true );

			mw.notify(
				this.getMessage( 'layers-new-set-created' ).replace( '$1', newName ),
				{ type: 'success' }
			);
		}

		/**
		 * Delete the current layer set with confirmation
		 * Only the original creator or an admin can delete a set
		 */
		async deleteCurrentSet() {
			const currentSet = this.editor.stateManager ?
				this.editor.stateManager.get( 'currentSetName' ) : 'default';

			if ( !currentSet ) {
				return;
			}

			// For the default set, offer to clear all layers instead of deleting
			if ( currentSet === 'default' ) {
				await this.clearDefaultSet();
				return;
			}

			// Get revision count for confirmation message
			const namedSets = this.editor.stateManager ?
				this.editor.stateManager.get( 'namedSets' ) : [];
			const setInfo = namedSets.find( set => set.name === currentSet );
			const revisionCount = setInfo ? ( setInfo.revision_count || 1 ) : 1;

			// Build confirmation message with set name and revision count
			const confirmMsg = this.getMessage( 'layers-delete-set-confirm' )
				.replace( '$1', currentSet )
				.replace( '$2', revisionCount );

			const confirmed = await this.showConfirmDialog( {
				message: confirmMsg,
				title: this.getMessage( 'layers-confirm-delete-title', 'Delete Layer Set' ),
				confirmText: this.getMessage( 'layers-delete', 'Delete' ),
				isDanger: true
			} );

			if ( !confirmed ) {
				return;
			}

			// Call API to delete the set
			if ( this.editor.apiManager && typeof this.editor.apiManager.deleteLayerSet === 'function' ) {
				this.editor.apiManager.deleteLayerSet( currentSet ).then( () => {
					// The APIManager reloads layers after delete, so we just update the selector
					if ( this.editor.buildSetSelector ) {
						this.editor.buildSetSelector();
					} else if ( this.editor.revisionManager ) {
						this.editor.revisionManager.buildSetSelector();
					}
				} ).catch( ( error ) => {
					// Error notification is handled by APIManager
					if ( mw.log && mw.log.error ) {
						mw.log.error( '[SetSelectorController] deleteCurrentSet error:', error );
					}
				} );
			} else {
				mw.notify( this.getMessage( 'layers-delete-failed' ), { type: 'error' } );
			}
		}

		/**
		 * Clear all layers from the default set (cannot delete default)
		 * @private
		 */
		async clearDefaultSet() {
			const layers = this.editor.stateManager ?
				this.editor.stateManager.get( 'layers' ) : [];
			if ( !layers || layers.length === 0 ) {
				mw.notify( this.getMessage( 'layers-no-layers-to-clear', 'No layers to clear' ), { type: 'info' } );
				return;
			}

			// Confirm clearing all layers from default set using DialogManager
			const clearMsg = this.getMessage(
				'layers-clear-default-set-confirm',
				'Clear all layers from the default set? This will remove all annotations.'
			);

			const confirmed = await this.showConfirmDialog( {
				message: clearMsg,
				title: this.getMessage( 'layers-confirm-clear-title', 'Clear Layers' ),
				confirmText: this.getMessage( 'layers-clear', 'Clear' ),
				isDanger: true
			} );

			if ( !confirmed ) {
				return;
			}

			// Clear all layers and save immediately
			if ( this.editor.stateManager ) {
				this.editor.stateManager.set( 'layers', [] );
			}
			if ( this.editor.canvasManager ) {
				this.editor.canvasManager.renderLayers( [] );
			}
			if ( this.editor.layerPanel ) {
				this.editor.layerPanel.renderLayerList();
			}
			if ( this.editor.selectionManager ) {
				this.editor.selectionManager.clearSelection();
			}

			// Save the empty layer set immediately via API
			if ( this.editor.apiManager && typeof this.editor.apiManager.saveLayers === 'function' ) {
				this.editor.apiManager.saveLayers( [], 'default' ).then( () => {
					if ( this.editor.stateManager ) {
						this.editor.stateManager.set( 'isDirty', false );
					}
					mw.notify(
						this.getMessage( 'layers-default-set-cleared', 'All layers cleared from default set.' ),
						{ type: 'success' }
					);
				} ).catch( ( error ) => {
					if ( mw.log && mw.log.error ) {
						mw.log.error( '[SetSelectorController] Failed to save cleared layers:', error );
					}
					mw.notify( this.getMessage( 'layers-save-failed', 'Failed to save changes' ), { type: 'error' } );
				} );
			} else {
				mw.notify(
					this.getMessage( 'layers-default-set-cleared', 'All layers cleared from default set.' ),
					{ type: 'success' }
				);
			}
		}

		/**
		 * Rename the current layer set
		 * Uses a prompt dialog to get the new name, then calls API to rename
		 */
		async renameCurrentSet() {
			const currentSet = this.editor.stateManager ?
				this.editor.stateManager.get( 'currentSetName' ) : 'default';

			// For default set, don't allow rename
			if ( currentSet === 'default' ) {
				mw.notify(
					this.getMessage( 'layers-cannot-rename-default', 'The default layer set cannot be renamed' ),
					{ type: 'warn' }
				);
				return;
			}

			// Prompt for new name using DialogManager
			const promptMsg = this.getMessage(
				'layers-rename-set-prompt',
				'Enter new name for layer set:'
			);
			const newName = await this.showPromptDialog( {
				message: promptMsg,
				title: this.getMessage( 'layers-rename-set', 'Rename Set' ),
				defaultValue: currentSet,
				confirmText: this.getMessage( 'layers-rename', 'Rename' )
			} );

			// User cancelled or empty input
			if ( !newName || newName.trim() === '' ) {
				return;
			}

			const trimmedName = newName.trim();

			// No change
			if ( trimmedName === currentSet ) {
				return;
			}

			// Validate name format
			if ( !/^[a-zA-Z0-9_-]{1,50}$/.test( trimmedName ) ) {
				mw.notify(
					this.getMessage(
						'layers-invalid-setname',
						'Invalid set name. Use only letters, numbers, hyphens, and underscores (1-50 characters).'
					),
					{ type: 'error' }
				);
				return;
			}

			// Call API to rename the set
			if ( this.editor.apiManager && typeof this.editor.apiManager.renameLayerSet === 'function' ) {
				this.editor.apiManager.renameLayerSet( currentSet, trimmedName ).then( () => {
					// The APIManager reloads layers after rename, so we just update the selector
					if ( this.editor.buildSetSelector ) {
						this.editor.buildSetSelector();
					} else if ( this.editor.revisionManager ) {
						this.editor.revisionManager.buildSetSelector();
					}
				} ).catch( ( error ) => {
					// Error notification is handled by APIManager
					if ( mw.log && mw.log.error ) {
						mw.log.error( '[SetSelectorController] renameCurrentSet error:', error );
					}
				} );
			} else {
				mw.notify( this.getMessage( 'layers-rename-failed', 'Failed to rename layer set' ), { type: 'error' } );
			}
		}

		/**
		 * Add a new option to the set selector
		 * @param {string} name Set name
		 * @param {boolean} [select=false] Whether to select the new option
		 */
		addSetOption( name, select = false ) {
			if ( !this.setSelectEl ) {
				return;
			}

			const option = document.createElement( 'option' );
			option.value = name;
			option.textContent = name;

			// Insert before the "+ New" option
			const newOption = this.setSelectEl.querySelector( 'option[value="__new__"]' );
			if ( newOption ) {
				this.setSelectEl.insertBefore( option, newOption );
			} else {
				this.setSelectEl.appendChild( option );
			}

			if ( select ) {
				this.setSelectEl.value = name;
			}
		}

		/**
		 * Get the current set selector element
		 * @return {HTMLSelectElement|null}
		 */
		getSelectElement() {
			return this.setSelectEl;
		}

		/**
		 * Clean up controller resources
		 */
		destroy() {
			// Element references are cleaned by UIManager's eventTracker
			this.setSelectEl = null;
			this.newSetInputEl = null;
			this.newSetBtnEl = null;
			this.setRenameBtnEl = null;
			this.setDeleteBtnEl = null;
			this.uiManager = null;
			this.editor = null;
		}
	}

	// Export to window.Layers namespace
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.SetSelectorController = SetSelectorController;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = SetSelectorController;
	}

}() );
