/**
 * RevisionManager - Handles revision and named layer set management
 *
 * Extracted from LayersEditor.js for better separation of concerns.
 * Manages revision selectors, named sets, and loading/switching between sets.
 *
 * @class RevisionManager
 */
( function () {
	'use strict';

	/**
	 * RevisionManager handles all revision and named layer set operations
	 *
	 * @param {Object} config Configuration object
	 * @param {Object} config.editor Reference to the LayersEditor instance
	 */
	class RevisionManager {
		constructor( config ) {
			this.editor = config.editor;
			this.stateManager = config.editor.stateManager;
			this.uiManager = config.editor.uiManager;
			this.apiManager = config.editor.apiManager;
			this.debug = config.editor.debug || false;
		}

		/**
		 * Debug logging utility
		 * @param {...*} args Arguments to log
		 */
		debugLog( ...args ) {
			if ( this.debug && mw.log ) {
				mw.log( '[RevisionManager]', ...args );
			}
		}

		/**
		 * Parse MediaWiki binary(14) timestamp format (YYYYMMDDHHmmss) to Date
		 * @param {string} mwTimestamp MediaWiki timestamp string
		 * @return {Date} Parsed date object
		 */
		parseMWTimestamp( mwTimestamp ) {
			if ( !mwTimestamp || typeof mwTimestamp !== 'string' ) {
				return new Date();
			}

			// MediaWiki binary(14) format: YYYYMMDDHHmmss
			const year = parseInt( mwTimestamp.substring( 0, 4 ), 10 );
			const month = parseInt( mwTimestamp.substring( 4, 6 ), 10 ) - 1; // JS months are 0-indexed
			const day = parseInt( mwTimestamp.substring( 6, 8 ), 10 );
			const hour = parseInt( mwTimestamp.substring( 8, 10 ), 10 );
			const minute = parseInt( mwTimestamp.substring( 10, 12 ), 10 );
			const second = parseInt( mwTimestamp.substring( 12, 14 ), 10 );

			return new Date( year, month, day, hour, minute, second );
		}

		/**
		 * Get a localized message
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Localized message
		 */
		getMessage( key, fallback = '' ) {
			if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
				return window.layersMessages.get( key, fallback );
			}
			return fallback;
		}

		/**
		 * Build the revision selector dropdown
		 * @return {void}
		 */
		buildRevisionSelector() {
			// Delegate to LayerSetManager if available
			if ( this.editor.layerSetManager ) {
				this.editor.layerSetManager.buildRevisionSelector();
				return;
			}

			try {
				if ( this.uiManager && this.uiManager.revSelectEl ) {
					const selectEl = this.uiManager.revSelectEl;
					const allLayerSets = this.stateManager.get( 'allLayerSets' ) || [];
					const currentLayerSetId = this.stateManager.get( 'currentLayerSetId' );

					// Clear existing options
					selectEl.innerHTML = '';

					// Add default option
					const defaultOption = document.createElement( 'option' );
					defaultOption.value = '';
					defaultOption.textContent = this.getMessage( 'layers-revision-latest' );
					selectEl.appendChild( defaultOption );

					// Add revision options
					allLayerSets.forEach( ( layerSet ) => {
						const option = document.createElement( 'option' );
						option.value = layerSet.ls_id || layerSet.id;
						const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
						const userName = layerSet.ls_user_name || layerSet.userName || 'Unknown';
						const name = layerSet.ls_name || layerSet.name || '';

						// Parse MediaWiki binary(14) timestamp format
						const date = this.parseMWTimestamp( timestamp );
						let displayText = date.toLocaleString();

						// Use MessageHelper for parameter substitution
						const byUserText = window.layersMessages ?
							window.layersMessages.getWithParams( 'layers-revision-by', userName ) :
							'by ' + userName;
						displayText += ' ' + byUserText;

						if ( name ) {
							displayText += ' (' + name + ')';
						}

						option.textContent = displayText;
						option.selected = ( layerSet.ls_id || layerSet.id ) === currentLayerSetId;
						selectEl.appendChild( option );
					} );

					// Update load button state
					this.updateRevisionLoadButton();
				}
			} catch ( error ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[RevisionManager] Error building revision selector:', error );
				}
			}
		}

		/**
		 * Update the revision load button state
		 * @return {void}
		 */
		updateRevisionLoadButton() {
			// Delegate to LayerSetManager if available
			if ( this.editor.layerSetManager ) {
				this.editor.layerSetManager.updateRevisionLoadButton();
				return;
			}

			try {
				if ( this.uiManager && this.uiManager.revLoadBtnEl && this.uiManager.revSelectEl ) {
					const selectedValue = this.uiManager.revSelectEl.value;
					const currentLayerSetId = this.stateManager.get( 'currentLayerSetId' );
					const isCurrent = selectedValue && parseInt( selectedValue, 10 ) === currentLayerSetId;
					this.uiManager.revLoadBtnEl.disabled = !selectedValue || isCurrent;
				}
			} catch ( error ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[RevisionManager] Error updating revision load button:', error );
				}
			}
		}

		/**
		 * Build and populate the named layer sets selector dropdown
		 * @return {void}
		 */
		buildSetSelector() {
			// Delegate to LayerSetManager if available
			if ( this.editor.layerSetManager ) {
				this.editor.layerSetManager.buildSetSelector();
				return;
			}

			try {
				const namedSets = this.stateManager.get( 'namedSets' ) || [];
				const currentSetName = this.stateManager.get( 'currentSetName' ) || 'default';
				const selectEl = this.uiManager && this.uiManager.setSelectEl;

				if ( !selectEl ) {
					return;
				}

				// Clear existing options
				selectEl.innerHTML = '';

				if ( namedSets.length === 0 ) {
					// No sets exist yet - show default placeholder
					const option = document.createElement( 'option' );
					option.value = 'default';
					option.textContent = this.getMessage( 'layers-set-default', 'Default' );
					option.selected = true;
					selectEl.appendChild( option );
				} else {
					// Build options from named sets
					namedSets.forEach( ( setInfo ) => {
						const option = document.createElement( 'option' );
						option.value = setInfo.name;

						// Format: "SetName (X revisions)"
						const revCount = setInfo.revision_count || 1;
						const revLabel = revCount === 1 ?
							this.getMessage( 'layers-set-revision-single', '1 revision' ) :
							this.getMessage( 'layers-set-revision-plural', `${ revCount } revisions` )
								.replace( '$1', revCount );

						option.textContent = `${ setInfo.name } (${ revLabel })`;
						option.selected = setInfo.name === currentSetName;
						selectEl.appendChild( option );
					} );
				}

				// Add "+ New" option at the end (if not at limit)
				const maxSets = mw.config.get( 'wgLayersMaxNamedSets', 15 );
				if ( namedSets.length < maxSets ) {
					const newOption = document.createElement( 'option' );
					newOption.value = '__new__';
					newOption.textContent = this.getMessage( 'layers-set-new', '+ New' );
					selectEl.appendChild( newOption );
				}

				// Update new set button state (disable if at limit)
				this.updateNewSetButtonState();

				this.debugLog( `Built set selector with ${ namedSets.length } sets, current: ${ currentSetName }` );
			} catch ( error ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[RevisionManager] Error building set selector:', error );
				}
			}
		}

		/**
		 * Update the new set button's enabled/disabled state based on limits
		 * @return {void}
		 */
		updateNewSetButtonState() {
			// Delegate to LayerSetManager if available
			if ( this.editor.layerSetManager ) {
				this.editor.layerSetManager.updateNewSetButtonState();
				return;
			}

			try {
				const newSetBtn = this.uiManager && this.uiManager.setNewBtnEl;
				if ( !newSetBtn ) {
					return;
				}

				const namedSets = this.stateManager.get( 'namedSets' ) || [];
				const maxSets = mw.config.get( 'wgLayersMaxNamedSets', 15 );
				const atLimit = namedSets.length >= maxSets;

				newSetBtn.disabled = atLimit;
				newSetBtn.title = atLimit ?
					this.getMessage( 'layers-set-limit-reached', `Maximum of ${ maxSets } sets reached` )
						.replace( '$1', maxSets ) :
					this.getMessage( 'layers-set-new-tooltip', 'Create a new layer set' );
			} catch ( error ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[RevisionManager] Error updating new set button state:', error );
				}
			}
		}

		/**
		 * Load a layer set by its name
		 * @param {string} setName The name of the set to load
		 * @return {Promise<void>}
		 */
		async loadLayerSetByName( setName ) {
			// Delegate to LayerSetManager if available
			if ( this.editor.layerSetManager ) {
				return this.editor.layerSetManager.loadLayerSetByName( setName );
			}

			try {
				if ( !setName ) {
					if ( mw.log && mw.log.error ) {
						mw.log.error( '[RevisionManager] loadLayerSetByName: No set name provided' );
					}
					return;
				}

				// Check for unsaved changes before switching
				if ( this.editor.hasUnsavedChanges() ) {
					const confirmSwitch = confirm(
						this.getMessage( 'layers-unsaved-changes-warning',
							'You have unsaved changes. Switch sets without saving?' )
					);
					if ( !confirmSwitch ) {
						// Revert selector to current set
						this.buildSetSelector();
						return;
					}
				}

				this.debugLog( `Loading layer set: ${ setName }` );

				// Update current set name in state
				this.stateManager.set( 'currentSetName', setName );

				// Load the set via API
				await this.apiManager.loadLayersBySetName( setName );

				// Notify user
				mw.notify(
					this.getMessage( 'layers-set-loaded', `Loaded layer set: ${ setName }` )
						.replace( '$1', setName ),
					{ type: 'info' }
				);
			} catch ( error ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[RevisionManager] Error loading layer set by name:', error );
				}
				mw.notify(
					this.getMessage( 'layers-set-load-error', 'Failed to load layer set' ),
					{ type: 'error' }
				);
			}
		}

		/**
		 * Create a new named layer set
		 * @param {string} setName The name for the new set
		 * @return {Promise<boolean>} True if creation succeeded
		 */
		async createNewLayerSet( setName ) {
			// Delegate to LayerSetManager if available
			if ( this.editor.layerSetManager ) {
				return this.editor.layerSetManager.createNewLayerSet( setName );
			}

			try {
				if ( !setName || !setName.trim() ) {
					mw.notify(
						this.getMessage( 'layers-set-name-required', 'Please enter a name for the new set' ),
						{ type: 'warn' }
					);
					return false;
				}

				const trimmedName = setName.trim();

				// Validate name format (alphanumeric, hyphens, underscores)
				if ( !/^[a-zA-Z0-9_-]+$/.test( trimmedName ) ) {
					mw.notify(
						this.getMessage( 'layers-set-name-invalid',
							'Set name can only contain letters, numbers, hyphens, and underscores' ),
						{ type: 'error' }
					);
					return false;
				}

				// Check for duplicate names
				const namedSets = this.stateManager.get( 'namedSets' ) || [];
				const exists = namedSets.some( ( s ) => s.name.toLowerCase() === trimmedName.toLowerCase() );
				if ( exists ) {
					mw.notify(
						this.getMessage( 'layers-set-name-exists', 'A set with this name already exists' ),
						{ type: 'error' }
					);
					return false;
				}

				// Check limit
				const maxSets = mw.config.get( 'wgLayersMaxNamedSets', 15 );
				if ( namedSets.length >= maxSets ) {
					mw.notify(
						this.getMessage( 'layers-set-limit-reached', `Maximum of ${ maxSets } sets reached` )
							.replace( '$1', maxSets ),
						{ type: 'error' }
					);
					return false;
				}

				this.debugLog( `Creating new layer set: ${ trimmedName }` );

				// Clear current layers for fresh start
				this.stateManager.set( 'layers', [] );
				this.stateManager.set( 'currentSetName', trimmedName );
				this.stateManager.set( 'currentLayerSetId', null );
				this.stateManager.set( 'setRevisions', [] );

				// Update canvas
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.clearLayers();
					this.editor.canvasManager.render();
				}

				// Update layer panel
				if ( this.editor.layerPanel ) {
					this.editor.layerPanel.updateLayerList( [] );
				}

				// Add to named sets list
				namedSets.push( {
					name: trimmedName,
					revision_count: 0,
					latest_revision: null,
					latest_timestamp: null,
					latest_user_name: mw.config.get( 'wgUserName' )
				} );
				this.stateManager.set( 'namedSets', namedSets );

				// Rebuild selector
				this.buildSetSelector();

				// Mark as having unsaved changes
				this.stateManager.set( 'hasUnsavedChanges', true );
				this.editor.updateSaveButtonState();

				mw.notify(
					this.getMessage( 'layers-set-created', `Created new set: ${ trimmedName }. Add layers and save.` )
						.replace( '$1', trimmedName ),
					{ type: 'info' }
				);

				return true;
			} catch ( error ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[RevisionManager] Error creating new layer set:', error );
				}
				mw.notify(
					this.getMessage( 'layers-set-create-error', 'Failed to create layer set' ),
					{ type: 'error' }
				);
				return false;
			}
		}

		/**
		 * Load a specific revision by ID
		 * @param {number} revisionId The revision ID to load
		 * @return {void}
		 */
		loadRevisionById( revisionId ) {
			// Delegate to LayerSetManager if available
			if ( this.editor.layerSetManager ) {
				this.editor.layerSetManager.loadRevisionById( revisionId );
				return;
			}

			try {
				this.apiManager.loadRevisionById( revisionId );
			} catch ( error ) {
				if ( mw.log && mw.log.error ) {
					mw.log.error( '[RevisionManager] Error loading revision:', error );
				}
				mw.notify( this.getMessage( 'layers-revision-load-error' ), { type: 'error' } );
			}
		}

		/**
		 * Check if there are unsaved changes
		 * @return {boolean}
		 */
		hasUnsavedChanges() {
			return this.stateManager.get( 'hasUnsavedChanges' ) || false;
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.editor = null;
			this.stateManager = null;
			this.uiManager = null;
			this.apiManager = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.RevisionManager = RevisionManager;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = RevisionManager;
	}

}() );
