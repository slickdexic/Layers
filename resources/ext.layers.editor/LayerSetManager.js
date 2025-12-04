/**
 * LayerSetManager - Manages named layer sets and revisions for the Layers editor
 *
 * Handles:
 * - Named layer set creation, loading, and switching
 * - Revision selector UI building
 * - Layer set dropdown UI building
 * - Timestamp parsing for MediaWiki format
 *
 * @class
 */
( function () {
	'use strict';

	/**
	 * LayerSetManager constructor
	 *
	 * @param {Object} config Configuration options
	 * @param {Object} config.editor Reference to the LayersEditor instance
	 * @param {Object} config.stateManager Reference to StateManager
	 * @param {Object} config.apiManager Reference to APIManager
	 * @param {Object} config.uiManager Reference to UIManager (for UI elements)
	 */
	function LayerSetManager( config ) {
		this.config = config || {};
		this.editor = config.editor || null;
		this.stateManager = config.stateManager || null;
		this.apiManager = config.apiManager || null;
		this.uiManager = config.uiManager || null;

		// Debug mode from config
		this.debug = config.debug || false;
	}

	/**
	 * Log debug message if debug mode enabled
	 * @param {...*} args Arguments to log
	 */
	LayerSetManager.prototype.debugLog = function () {
		if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
			mw.log.apply( mw, [ '[LayerSetManager]' ].concat( Array.from( arguments ) ) );
		}
	};

	/**
	 * Log error message
	 * @param {...*} args Arguments to log
	 */
	LayerSetManager.prototype.errorLog = function () {
		if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
			mw.log.error.apply( mw.log, [ '[LayerSetManager]' ].concat( Array.from( arguments ) ) );
		}
	};

	/**
	 * Get localized message
	 * @param {string} key Message key
	 * @param {string} [fallback=''] Fallback text
	 * @return {string}
	 */
	LayerSetManager.prototype.getMessage = function ( key, fallback ) {
		fallback = fallback || '';
		if ( typeof mw !== 'undefined' && mw.message ) {
			return mw.message( key ).text();
		}
		if ( typeof mw !== 'undefined' && mw.msg ) {
			return mw.msg( key );
		}
		return fallback;
	};

	/**
	 * Parse MediaWiki binary(14) timestamp format (YYYYMMDDHHmmss)
	 * @param {string} mwTimestamp The timestamp string
	 * @return {Date} Parsed date object
	 */
	LayerSetManager.prototype.parseMWTimestamp = function ( mwTimestamp ) {
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
	};

	/**
	 * Build the revision selector dropdown
	 * Populates the revision dropdown with available layer set revisions
	 */
	LayerSetManager.prototype.buildRevisionSelector = function () {
		try {
			const selectEl = this.uiManager && this.uiManager.revSelectEl;
			if ( !selectEl ) {
				return;
			}

			const allLayerSets = this.stateManager.get( 'allLayerSets' ) || [];
			const currentLayerSetId = this.stateManager.get( 'currentLayerSetId' );

			// Clear existing options
			selectEl.innerHTML = '';

			// Add default option
			const defaultOption = document.createElement( 'option' );
			defaultOption.value = '';
			defaultOption.textContent = this.getMessage( 'layers-revision-latest', 'Latest' );
			selectEl.appendChild( defaultOption );

			// Add revision options
			const self = this;
			allLayerSets.forEach( function ( layerSet ) {
				const option = document.createElement( 'option' );
				option.value = layerSet.ls_id || layerSet.id;
				const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
				const userName = layerSet.ls_user_name || layerSet.userName || 'Unknown';
				const name = layerSet.ls_name || layerSet.name || '';

				// Parse MediaWiki binary(14) timestamp format
				const date = self.parseMWTimestamp( timestamp );
				let displayText = date.toLocaleString();

				// Use MediaWiki message system with parameter replacement
				if ( typeof mw !== 'undefined' && mw.message ) {
					const byUserText = mw.message( 'layers-revision-by', userName ).text();
					displayText += ' ' + byUserText;
				} else {
					displayText += ' by ' + userName;
				}

				if ( name ) {
					displayText += ' (' + name + ')';
				}

				option.textContent = displayText;
				option.selected = ( layerSet.ls_id || layerSet.id ) === currentLayerSetId;
				selectEl.appendChild( option );
			} );

			// Update load button state
			this.updateRevisionLoadButton();
		} catch ( error ) {
			this.errorLog( 'Error building revision selector:', error );
		}
	};

	/**
	 * Update the revision load button state
	 * Disables button if no revision selected or if current revision is selected
	 */
	LayerSetManager.prototype.updateRevisionLoadButton = function () {
		try {
			const revLoadBtnEl = this.uiManager && this.uiManager.revLoadBtnEl;
			const revSelectEl = this.uiManager && this.uiManager.revSelectEl;

			if ( !revLoadBtnEl || !revSelectEl ) {
				return;
			}

			const selectedValue = revSelectEl.value;
			const currentLayerSetId = this.stateManager.get( 'currentLayerSetId' );
			const isCurrent = selectedValue && parseInt( selectedValue, 10 ) === currentLayerSetId;
			revLoadBtnEl.disabled = !selectedValue || isCurrent;
		} catch ( error ) {
			this.errorLog( 'Error updating revision load button:', error );
		}
	};

	/**
	 * Build and populate the named layer sets selector dropdown
	 */
	LayerSetManager.prototype.buildSetSelector = function () {
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
				const self = this;
				namedSets.forEach( function ( setInfo ) {
					const option = document.createElement( 'option' );
					option.value = setInfo.name;

					// Format: "SetName (X revisions)"
					const revCount = setInfo.revision_count || 1;
					let revLabel;
					if ( revCount === 1 ) {
						revLabel = self.getMessage( 'layers-set-revision-single', '1 revision' );
					} else {
						revLabel = self.getMessage( 'layers-set-revision-plural', revCount + ' revisions' )
							.replace( '$1', revCount );
					}

					option.textContent = setInfo.name + ' (' + revLabel + ')';
					option.selected = setInfo.name === currentSetName;
					selectEl.appendChild( option );
				} );
			}

			// Add "+ New" option at the end (if not at limit)
			const maxSets = ( typeof mw !== 'undefined' && mw.config ) ?
				mw.config.get( 'wgLayersMaxNamedSets', 15 ) : 15;
			if ( namedSets.length < maxSets ) {
				const newOption = document.createElement( 'option' );
				newOption.value = '__new__';
				newOption.textContent = this.getMessage( 'layers-set-new', '+ New' );
				selectEl.appendChild( newOption );
			}

			// Update new set button state (disable if at limit)
			this.updateNewSetButtonState();

			this.debugLog( 'Built set selector with ' + namedSets.length + ' sets, current: ' + currentSetName );
		} catch ( error ) {
			this.errorLog( 'Error building set selector:', error );
		}
	};

	/**
	 * Update the new set button's enabled/disabled state based on limits
	 */
	LayerSetManager.prototype.updateNewSetButtonState = function () {
		try {
			const newSetBtn = this.uiManager && this.uiManager.setNewBtnEl;
			if ( !newSetBtn ) {
				return;
			}

			const namedSets = this.stateManager.get( 'namedSets' ) || [];
			const maxSets = ( typeof mw !== 'undefined' && mw.config ) ?
				mw.config.get( 'wgLayersMaxNamedSets', 15 ) : 15;
			const atLimit = namedSets.length >= maxSets;

			newSetBtn.disabled = atLimit;
			newSetBtn.title = atLimit ?
				this.getMessage( 'layers-set-limit-reached', 'Maximum of ' + maxSets + ' sets reached' )
					.replace( '$1', maxSets ) :
				this.getMessage( 'layers-set-new-tooltip', 'Create a new layer set' );
		} catch ( error ) {
			this.errorLog( 'Error updating new set button state:', error );
		}
	};

	/**
	 * Load a layer set by its name
	 * @param {string} setName The name of the set to load
	 * @return {Promise<void>}
	 */
	LayerSetManager.prototype.loadLayerSetByName = async function ( setName ) {
		try {
			if ( !setName ) {
				this.errorLog( 'loadLayerSetByName: No set name provided' );
				return;
			}

			// Check for unsaved changes before switching
			if ( this.hasUnsavedChanges() ) {
				const confirmMsg = this.getMessage(
					'layers-unsaved-changes-warning',
					'You have unsaved changes. Switch sets without saving?'
				);
				// eslint-disable-next-line no-alert
				const confirmSwitch = confirm( confirmMsg );
				if ( !confirmSwitch ) {
					// Revert selector to current set
					this.buildSetSelector();
					return;
				}
			}

			this.debugLog( 'Loading layer set: ' + setName );

			// Update current set name in state
			this.stateManager.set( 'currentSetName', setName );

			// Load the set via API
			if ( this.apiManager && typeof this.apiManager.loadLayersBySetName === 'function' ) {
				await this.apiManager.loadLayersBySetName( setName );
			}

			// Notify user
			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify(
					this.getMessage( 'layers-set-loaded', 'Loaded layer set: ' + setName )
						.replace( '$1', setName ),
					{ type: 'info' }
				);
			}
		} catch ( error ) {
			this.errorLog( 'Error loading layer set by name:', error );
			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify(
					this.getMessage( 'layers-set-load-error', 'Failed to load layer set' ),
					{ type: 'error' }
				);
			}
		}
	};

	/**
	 * Create a new named layer set
	 * @param {string} setName The name for the new set
	 * @return {Promise<boolean>} True if creation succeeded
	 */
	LayerSetManager.prototype.createNewLayerSet = async function ( setName ) {
		try {
			if ( !setName || !setName.trim() ) {
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.getMessage( 'layers-set-name-required', 'Please enter a name for the new set' ),
						{ type: 'warn' }
					);
				}
				return false;
			}

			const trimmedName = setName.trim();

			// Validate name format (alphanumeric, hyphens, underscores)
			if ( !/^[a-zA-Z0-9_-]+$/.test( trimmedName ) ) {
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.getMessage( 'layers-set-name-invalid',
							'Set name can only contain letters, numbers, hyphens, and underscores' ),
						{ type: 'error' }
					);
				}
				return false;
			}

			// Check for duplicate names
			const namedSets = this.stateManager.get( 'namedSets' ) || [];
			const exists = namedSets.some( function ( s ) {
				return s.name.toLowerCase() === trimmedName.toLowerCase();
			} );
			if ( exists ) {
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.getMessage( 'layers-set-name-exists', 'A set with this name already exists' ),
						{ type: 'error' }
					);
				}
				return false;
			}

			// Check limit
			const maxSets = ( typeof mw !== 'undefined' && mw.config ) ?
				mw.config.get( 'wgLayersMaxNamedSets', 15 ) : 15;
			if ( namedSets.length >= maxSets ) {
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.getMessage( 'layers-set-limit-reached', 'Maximum of ' + maxSets + ' sets reached' )
							.replace( '$1', maxSets ),
						{ type: 'error' }
					);
				}
				return false;
			}

			this.debugLog( 'Creating new layer set: ' + trimmedName );

			// Clear current layers for fresh start
			this.stateManager.set( 'layers', [] );
			this.stateManager.set( 'currentSetName', trimmedName );
			this.stateManager.set( 'currentLayerSetId', null );
			this.stateManager.set( 'setRevisions', [] );

			// Update canvas if available through editor
			if ( this.editor && this.editor.canvasManager ) {
				if ( typeof this.editor.canvasManager.clearLayers === 'function' ) {
					this.editor.canvasManager.clearLayers();
				}
				if ( typeof this.editor.canvasManager.render === 'function' ) {
					this.editor.canvasManager.render();
				}
			}

			// Update layer panel if available
			if ( this.editor && this.editor.layerPanel ) {
				if ( typeof this.editor.layerPanel.updateLayerList === 'function' ) {
					this.editor.layerPanel.updateLayerList( [] );
				}
			}

			// Add to named sets list
			const userName = ( typeof mw !== 'undefined' && mw.config ) ?
				mw.config.get( 'wgUserName' ) : 'Anonymous';
			namedSets.push( {
				name: trimmedName,
				revision_count: 0,
				latest_revision: null,
				latest_timestamp: null,
				latest_user_name: userName
			} );
			this.stateManager.set( 'namedSets', namedSets );

			// Rebuild selector
			this.buildSetSelector();

			// Mark as having unsaved changes
			this.stateManager.set( 'hasUnsavedChanges', true );
			if ( this.editor && typeof this.editor.updateSaveButtonState === 'function' ) {
				this.editor.updateSaveButtonState();
			}

			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify(
					this.getMessage( 'layers-set-created', 'Created new set: ' + trimmedName + '. Add layers and save.' )
						.replace( '$1', trimmedName ),
					{ type: 'info' }
				);
			}

			return true;
		} catch ( error ) {
			this.errorLog( 'Error creating new layer set:', error );
			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify(
					this.getMessage( 'layers-set-create-error', 'Failed to create layer set' ),
					{ type: 'error' }
				);
			}
			return false;
		}
	};

	/**
	 * Check if there are unsaved changes
	 * @return {boolean}
	 */
	LayerSetManager.prototype.hasUnsavedChanges = function () {
		if ( this.stateManager ) {
			return this.stateManager.get( 'hasUnsavedChanges' ) || false;
		}
		return false;
	};

	/**
	 * Load a specific revision by ID
	 * @param {number} revisionId The revision ID to load
	 */
	LayerSetManager.prototype.loadRevisionById = function ( revisionId ) {
		try {
			if ( this.apiManager && typeof this.apiManager.loadRevisionById === 'function' ) {
				this.apiManager.loadRevisionById( revisionId );
			}
		} catch ( error ) {
			this.errorLog( 'Error loading revision:', error );
			if ( typeof mw !== 'undefined' && mw.notify ) {
				mw.notify(
					this.getMessage( 'layers-revision-load-error', 'Failed to load revision' ),
					{ type: 'error' }
				);
			}
		}
	};

	/**
	 * Reload revisions list from API
	 * @return {Promise<void>}
	 */
	LayerSetManager.prototype.reloadRevisions = async function () {
		try {
			this.debugLog( 'Reloading revisions list' );
			if ( this.apiManager && typeof this.apiManager.fetchLayerSetInfo === 'function' ) {
				await this.apiManager.fetchLayerSetInfo();
			}
			this.buildRevisionSelector();
			this.buildSetSelector();
		} catch ( error ) {
			this.errorLog( 'Error reloading revisions:', error );
		}
	};

	/**
	 * Get current set name
	 * @return {string}
	 */
	LayerSetManager.prototype.getCurrentSetName = function () {
		return this.stateManager ? ( this.stateManager.get( 'currentSetName' ) || 'default' ) : 'default';
	};

	/**
	 * Get named sets list
	 * @return {Array}
	 */
	LayerSetManager.prototype.getNamedSets = function () {
		return this.stateManager ? ( this.stateManager.get( 'namedSets' ) || [] ) : [];
	};

	/**
	 * Destroy and clean up
	 */
	LayerSetManager.prototype.destroy = function () {
		this.editor = null;
		this.stateManager = null;
		this.apiManager = null;
		this.uiManager = null;
		this.config = null;
	};

	// Export to window for MediaWiki ResourceLoader
	window.LayerSetManager = LayerSetManager;

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayerSetManager;
	}

}() );
