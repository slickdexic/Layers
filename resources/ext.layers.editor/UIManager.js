/**
 * UI Manager for Layers Editor
 * Handles all UI creation and management
 */
( function () {
	'use strict';

	// Use shared namespace helper (loaded via utils/NamespaceHelper.js)
	const getClass = ( typeof window !== 'undefined' && window.Layers && window.Layers.Utils && window.Layers.Utils.getClass ) ||
		( typeof window !== 'undefined' && window.layersGetClass ) ||
		function ( namespacePath, globalName ) {
			// Minimal fallback for environments where NamespaceHelper hasn't loaded
			if ( typeof window !== 'undefined' && window[ globalName ] ) {
				return window[ globalName ];
			}
			return null;
		};

	class UIManager {
	constructor( editor ) {
		this.editor = editor;
		this.container = null;
		this.statusBar = null;
		this.spinnerEl = null;
		// Named Set selector elements
		this.setSelectEl = null;
		this.newSetInputEl = null;
		this.newSetBtnEl = null;
		// Revision selector elements
		this.revSelectEl = null;
		this.revLoadBtnEl = null;
		this.revNameInputEl = null;
		this.zoomReadoutEl = null;

		// Initialize EventTracker for memory-safe event listener management
		const EventTracker = getClass( 'Utils.EventTracker', 'EventTracker' );
		this.eventTracker = EventTracker ? new EventTracker() : null;
	}

	/**
	 * Add event listener with memory-safe tracking
	 * @param {EventTarget} element - Element to attach listener to
	 * @param {string} event - Event type
	 * @param {Function} handler - Event handler
	 * @param {Object|boolean} [options] - Event listener options
	 */
	addListener( element, event, handler, options ) {
		if ( !element || typeof element.addEventListener !== 'function' ) {
			return;
		}
		if ( this.eventTracker ) {
			this.eventTracker.add( element, event, handler, options );
		} else {
			// Fallback if EventTracker not available
			element.addEventListener( event, handler, options );
		}
	}

	/**
	 * Create the main editor interface
	 */
	createInterface() {
		// Always create a full-screen overlay container at body level
		this.container = document.createElement( 'div' );
		this.container.className = 'layers-editor';
		this.container.setAttribute( 'role', 'application' );
		this.container.setAttribute( 'aria-label', 'Layers Image Editor' );
		document.body.appendChild( this.container );

		// Add body class to hide skin chrome while editor is open
		document.body.classList.add( 'layers-editor-open' );

		this.createHeader();
		this.createToolbar();
		this.createMainContent();
		this.createStatusBar();

		// Create jQuery-style references for compatibility
		this.editor.$canvasContainer = $( this.canvasContainer );
		this.editor.$layerPanel = $( this.layerPanelContainer );
		this.editor.$toolbar = $( this.toolbarContainer );

		this.setupStatusUpdates();
		this.setupRevisionControls();

		// SECURITY FIX: Use mw.log instead of console.log
		if ( mw.log && mw.config.get( 'wgLayersDebug' ) ) {
			mw.log( '[UIManager] createInterface() completed' );
		}
	}

	createHeader() {
		const header = document.createElement( 'div' );
		header.className = 'layers-header';
		header.setAttribute( 'role', 'banner' );

		const title = document.createElement( 'div' );
		title.className = 'layers-header-title';
		title.setAttribute( 'role', 'heading' );
		title.setAttribute( 'aria-level', '1' );
		title.textContent = this.getMessage( 'layers-editor-title' ) +
			( this.editor.filename ? ' — ' + this.editor.filename : '' );
		header.appendChild( title );

		const headerRight = this.createHeaderRight();
		header.appendChild( headerRight );

		this.container.appendChild( header );
	}

	createHeaderRight() {
		const headerRight = document.createElement( 'div' );
		headerRight.className = 'layers-header-right';

		// Zoom readout
		this.zoomReadoutEl = document.createElement( 'span' );
		this.zoomReadoutEl.className = 'layers-zoom-readout';
		this.zoomReadoutEl.setAttribute( 'aria-label', 'Current zoom level' );
		this.zoomReadoutEl.textContent = '100%';
		headerRight.appendChild( this.zoomReadoutEl );

		// Named Set selector (primary grouping)
		const setWrap = this.createSetSelector();
		headerRight.appendChild( setWrap );

		// Separator
		const separator = document.createElement( 'span' );
		separator.className = 'layers-header-separator';
		separator.setAttribute( 'aria-hidden', 'true' );
		headerRight.appendChild( separator );

		// Revision selector (within the selected set)
		const revWrap = this.createRevisionSelector();
		headerRight.appendChild( revWrap );

		// Close button
		const closeBtn = this.createCloseButton();
		headerRight.appendChild( closeBtn );

		return headerRight;
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

		return setWrap;
	}

	createRevisionSelector() {
		const revWrap = document.createElement( 'div' );
		revWrap.className = 'layers-revision-wrap';
		revWrap.setAttribute( 'role', 'group' );
		revWrap.setAttribute( 'aria-label', this.getMessage( 'layers-revision-group' ) );

		const revLabel = document.createElement( 'label' );
		revLabel.className = 'layers-revision-label';
		revLabel.textContent = this.getMessage( 'layers-revision-label' ) + ':';
		const revSelectId = 'layers-revision-select-' + Math.random().toString( 36 ).slice( 2, 11 );
		revLabel.setAttribute( 'for', revSelectId );
		revWrap.appendChild( revLabel );

		this.revSelectEl = document.createElement( 'select' );
		this.revSelectEl.className = 'layers-revision-select';
		this.revSelectEl.id = revSelectId;
		this.revSelectEl.setAttribute( 'aria-label', this.getMessage( 'layers-revision-select-aria' ) );
		revWrap.appendChild( this.revSelectEl );

		this.revLoadBtnEl = document.createElement( 'button' );
		this.revLoadBtnEl.type = 'button';
		this.revLoadBtnEl.className = 'layers-revision-load';
		this.revLoadBtnEl.textContent = this.getMessage( 'layers-revision-load' );
		this.revLoadBtnEl.setAttribute( 'aria-label', this.getMessage( 'layers-revision-load-aria' ) );
		revWrap.appendChild( this.revLoadBtnEl );

		return revWrap;
	}

	createCloseButton() {
		const closeBtn = document.createElement( 'button' );
		closeBtn.className = 'layers-header-close';
		closeBtn.type = 'button';
		closeBtn.setAttribute( 'aria-label', this.getMessage( 'layers-editor-close' ) );
		closeBtn.title = this.getMessage( 'layers-editor-close' );
		closeBtn.textContent = '×';
		return closeBtn;
	}

	createToolbar() {
		this.toolbarContainer = document.createElement( 'div' );
		this.toolbarContainer.className = 'layers-toolbar';
		this.container.appendChild( this.toolbarContainer );
	}

	createMainContent() {

		this.content = document.createElement( 'div' );
		this.content.className = 'layers-content';
		this.container.appendChild( this.content );

		const mainRow = document.createElement( 'div' );
		mainRow.className = 'layers-main';
		this.content.appendChild( mainRow );

		this.layerPanelContainer = document.createElement( 'div' );
		this.layerPanelContainer.className = 'layers-panel';
		mainRow.appendChild( this.layerPanelContainer );

		this.canvasContainer = document.createElement( 'div' );
		this.canvasContainer.className = 'layers-canvas-container';
		mainRow.appendChild( this.canvasContainer );
	}

	createStatusBar() {
		this.statusBar = document.createElement( 'div' );
		this.statusBar.className = 'layers-statusbar';

		const statusItems = [
			{ label: this.getMessage( 'layers-status-tool' ), key: 'tool', value: 'pointer' },
			{ label: this.getMessage( 'layers-status-zoom' ), key: 'zoom', value: '100%' },
			{ label: this.getMessage( 'layers-status-pos' ), key: 'pos', value: '0,0' },
			{ label: this.getMessage( 'layers-status-size' ), key: 'size', value: '-' },
			{ label: this.getMessage( 'layers-status-selection' ), key: 'selection', value: '0' }
		];

		statusItems.forEach( item => {
			this.statusBar.appendChild( this.createStatusItem( item.label, item.key, item.value ) );
		} );

		const spacer = document.createElement( 'span' );
		spacer.className = 'status-spacer';
		this.statusBar.appendChild( spacer );

		const statusCode = this.createStatusCode();
		this.statusBar.appendChild( statusCode );

		this.container.appendChild( this.statusBar );
	}

	createStatusItem( labelText, dataKey, initialText ) {
		const item = document.createElement( 'span' );
		item.className = 'status-item';

		const label = document.createElement( 'span' );
		label.className = 'status-label';
		label.textContent = labelText + ':';
		item.appendChild( label );

		const value = document.createElement( 'span' );
		value.className = 'status-value';
		if ( dataKey ) {
			value.setAttribute( 'data-status', dataKey );
		}
		value.textContent = initialText;
		item.appendChild( value );

		return item;
	}

	createStatusCode() {
		const statusCode = document.createElement( 'span' );
		statusCode.className = 'status-code';
		statusCode.setAttribute( 'aria-label', this.getMessage( 'layers-code-title' ) );

		const codeEl = document.createElement( 'code' );
		codeEl.className = 'status-code-text';
		codeEl.title = this.getMessage( 'layers-code-title' );
		statusCode.appendChild( codeEl );

		const copyBtn = document.createElement( 'button' );
		copyBtn.className = 'status-copy-btn';
		copyBtn.type = 'button';
		copyBtn.textContent = this.getMessage( 'layers-code-copy' );
		statusCode.appendChild( copyBtn );

		return statusCode;
	}

	setupStatusUpdates() {
		this.updateZoomReadout = ( percent ) => {
			if ( this.zoomReadoutEl ) {
				this.zoomReadoutEl.textContent = percent + '%';
			}
		};

		this.updateStatus = ( fields ) => {
			if ( !fields || !this.statusBar ) {
				return;
			}

			Object.keys( fields ).forEach( key => {
				const el = this.statusBar.querySelector( `[data-status="${ key }"]` );
				if ( el ) {
					let value = fields[ key ];
					if ( key === 'zoomPercent' ) {
						value = Math.round( value ) + '%';
					} else if ( key === 'pos' && value.x !== undefined && value.y !== undefined ) {
						value = Math.round( value.x ) + ',' + Math.round( value.y );
					} else if ( key === 'size' && value.width !== undefined && value.height !== undefined ) {
						value = Math.round( value.width ) + '×' + Math.round( value.height );
					}
					el.textContent = value;
				}
			} );
		};
	}

	setupRevisionControls() {
		// Set selector controls
		this.setupSetSelectorControls();

		// Revision load button
		if ( this.revLoadBtnEl ) {
			this.addListener( this.revLoadBtnEl, 'click', () => {
				const val = this.revSelectEl ? parseInt( this.revSelectEl.value, 10 ) || 0 : 0;
				if ( val ) {
					this.editor.loadRevisionById( val );
				}
			} );
		}

		// Revision selector change
		if ( this.revSelectEl ) {
			this.addListener( this.revSelectEl, 'change', () => {
				const v = parseInt( this.revSelectEl.value, 10 ) || 0;
				if ( this.revLoadBtnEl ) {
					const currentId = this.editor.stateManager ?
						this.editor.stateManager.get( 'currentLayerSetId' ) :
						this.editor.currentLayerSetId;
					const isCurrent = ( currentId && v === currentId );
					this.revLoadBtnEl.disabled = !v || isCurrent;
				}
			} );
		}
	}

	/**
	 * Set up event handlers for the Named Set selector
	 */
	setupSetSelectorControls() {
		if ( !this.setSelectEl ) {
			return;
		}

		// Handle set selection change
		this.addListener( this.setSelectEl, 'change', () => {
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
						const confirmed = window.confirm(
							this.getMessage( 'layers-switch-set-unsaved-confirm' )
						);
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
	deleteCurrentSet() {
		const currentSet = this.editor.stateManager ?
			this.editor.stateManager.get( 'currentSetName' ) : 'default';

		if ( !currentSet ) {
			return;
		}

		// For the default set, offer to clear all layers instead of deleting
		if ( currentSet === 'default' ) {
			const layers = this.editor.stateManager ?
				this.editor.stateManager.get( 'layers' ) : [];
			if ( !layers || layers.length === 0 ) {
				mw.notify( this.getMessage( 'layers-no-layers-to-clear', 'No layers to clear' ), { type: 'info' } );
				return;
			}

			// Confirm clearing all layers from default set
			const clearMsg = this.getMessage(
				'layers-clear-default-set-confirm',
				'Clear all layers from the default set? This will remove all annotations.'
			);
			// eslint-disable-next-line no-alert
			if ( !window.confirm( clearMsg ) ) {
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
						mw.log.error( '[UIManager] Failed to save cleared layers:', error );
					}
					mw.notify( this.getMessage( 'layers-save-failed', 'Failed to save changes' ), { type: 'error' } );
				} );
			} else {
				mw.notify(
					this.getMessage( 'layers-default-set-cleared', 'All layers cleared from default set.' ),
					{ type: 'success' }
				);
			}
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

		// eslint-disable-next-line no-alert
		if ( !window.confirm( confirmMsg ) ) {
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
					mw.log.error( '[UIManager] deleteCurrentSet error:', error );
				}
			} );
		} else {
			mw.notify( this.getMessage( 'layers-delete-failed' ), { type: 'error' } );
		}
	}

	/**
	 * Rename the current layer set
	 * Uses a prompt dialog to get the new name, then calls API to rename
	 */
	renameCurrentSet() {
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

		// Prompt for new name
		const promptMsg = this.getMessage(
			'layers-rename-set-prompt',
			'Enter new name for layer set:'
		);
		// eslint-disable-next-line no-alert
		const newName = window.prompt( promptMsg, currentSet );

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
					mw.log.error( '[UIManager] renameCurrentSet error:', error );
				}
			} );
		} else {
			mw.notify( this.getMessage( 'layers-rename-failed', 'Failed to rename layer set' ), { type: 'error' } );
		}
	}

	/**
	 * Add a new option to the set selector
	 * @param {string} name Set name
	 * @param {boolean} select Whether to select the new option
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

	getMessage( key, fallback = '' ) {
		const messages = getClass( 'Core.Messages', 'layersMessages' );
		return messages ? messages.get( key, fallback ) : fallback;
	}

	showSpinner( message ) {
		this.hideSpinner();
		this.spinnerEl = document.createElement( 'div' );
		this.spinnerEl.className = 'layers-spinner';
		this.spinnerEl.setAttribute( 'role', 'status' );
		this.spinnerEl.setAttribute( 'aria-live', 'polite' );

		const spinnerIcon = document.createElement( 'span' );
		spinnerIcon.className = 'spinner';
		this.spinnerEl.appendChild( spinnerIcon );

		const textNode = document.createElement( 'span' );
		textNode.className = 'spinner-text';
		textNode.textContent = ' ' + ( message || '' );
		this.spinnerEl.appendChild( textNode );

		this.container.appendChild( this.spinnerEl );
	}

	hideSpinner() {
		if ( this.spinnerEl ) {
			this.spinnerEl.remove();
			this.spinnerEl = null;
		}
	}

	showError( message ) {
		const errorEl = document.createElement( 'div' );
		errorEl.className = 'layers-error';
		errorEl.style.cssText = `
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			background: white;
			padding: 20px;
			border: 2px solid #d63638;
			border-radius: 8px;
			z-index: 10001;
			max-width: 400px;
			box-shadow: 0 4px 20px rgba(0,0,0,0.3);
		`;

		const h = document.createElement( 'h3' );
		h.textContent = this.getMessage( 'layers-alert-title', 'Error' );
		errorEl.appendChild( h );

		const p = document.createElement( 'p' );
		p.textContent = String( message || '' );
		errorEl.appendChild( p );

		this.container.appendChild( errorEl );

		setTimeout( () => {
			errorEl.style.opacity = '0';
			setTimeout( () => {
				if ( errorEl.parentNode ) {
					errorEl.parentNode.removeChild( errorEl );
				}
			}, 500 );
		}, 10000 );
	}

	destroy() {
		// Clean up all tracked event listeners
		if ( this.eventTracker ) {
			this.eventTracker.destroy();
			this.eventTracker = null;
		}

		if ( this.container && this.container.parentNode ) {
			this.container.parentNode.removeChild( this.container );
		}
		this.hideSpinner();
		document.body.classList.remove( 'layers-editor-open' );

		// Clear element references
		this.container = null;
		this.statusBar = null;
		this.setSelectEl = null;
		this.newSetInputEl = null;
		this.newSetBtnEl = null;
		this.revSelectEl = null;
		this.revLoadBtnEl = null;
		this.zoomReadoutEl = null;
	}
}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.Manager = UIManager;
	}

	// Export for Node.js/Jest testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = UIManager;
	}

}() );