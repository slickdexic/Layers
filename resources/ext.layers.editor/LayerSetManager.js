/**
 * LayerSetManager - Manages named layer sets and revisions for the Layers editor
 *
 * Handles:
 * - Named layer set creation, loading, and switching
 * - Revision selector UI building
 * - Layer set dropdown UI building
 * - Timestamp parsing for MediaWiki format
 *
 * @class LayerSetManager
 */
( function () {
	'use strict';

	/**
	 * LayerSetManager class
	 */
	class LayerSetManager {
		/**
		 * LayerSetManager constructor
		 *
		 * @param {Object} config Configuration options
		 * @param {Object} config.editor Reference to the LayersEditor instance
		 * @param {Object} config.stateManager Reference to StateManager
		 * @param {Object} config.apiManager Reference to APIManager
		 * @param {Object} config.uiManager Reference to UIManager (for UI elements)
		 */
		constructor( config ) {
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
		debugLog( ...args ) {
			if ( this.debug && typeof mw !== 'undefined' && mw.log ) {
				mw.log( '[LayerSetManager]', ...args );
			}
		}

		/**
		 * Log error message
		 * @param {...*} args Arguments to log
		 */
		errorLog( ...args ) {
			if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
				mw.log.error( '[LayerSetManager]', ...args );
			}
		}

		/**
		 * Get localized message
		 * Delegates to centralized MessageHelper for consistent i18n handling.
		 * @param {string} key Message key
		 * @param {string} [fallback=''] Fallback text
		 * @return {string}
		 */
		getMessage( key, fallback ) {
			// Try centralized MessageHelper first
			if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
				return window.layersMessages.get( key, fallback || '' );
			}
			// Fall back to direct mw.message if MessageHelper unavailable
			if ( window.mw && window.mw.message ) {
				try {
					return mw.message( key ).text();
				} catch ( e ) {
					// Fall through to return fallback
				}
			}
			return fallback || '';
		}

		/**
		 * Name the first set for this image will be saved under when the user has
		 * not chosen one. Set names are user-defined and nothing is reserved, so
		 * this is only ever a seed for a brand-new set - never a lookup key.
		 *
		 * @return {string}
		 */
		getSeedSetName() {
			const configured = window.mw && window.mw.config &&
				window.mw.config.get( 'wgLayersDefaultSetName' );
			return configured || 'default';
		}

		/**
		 * Get localized message with parameter substitution
		 * Delegates to centralized MessageHelper for consistent i18n handling.
		 * @param {string} key Message key
		 * @param {Array} params Parameters to substitute
		 * @param {string} [fallback=''] Fallback text (can use $1, $2 placeholders)
		 * @return {string}
		 */
		getMessageWithParams( key, params, fallback ) {
			// Try centralized MessageHelper first
			if ( window.layersMessages && typeof window.layersMessages.getWithParams === 'function' ) {
				return window.layersMessages.getWithParams( key, params, fallback || '' );
			}
			// Fall back to direct mw.message with params if MessageHelper unavailable
			if ( window.mw && window.mw.message ) {
				try {
					const args = [ key ].concat( params || [] );
					return mw.message.apply( null, args ).text();
				} catch ( e ) {
					// Fall through to manual substitution
				}
			}
			// Manual substitution fallback
			let result = fallback || '';
			if ( params && params.length > 0 ) {
				params.forEach( ( param, index ) => {
					result = result.replace( '$' + ( index + 1 ), String( param ) );
				} );
			}
			return result;
		}

		/**
		 * Parse MediaWiki binary(14) timestamp format (YYYYMMDDHHmmss)
		 * MediaWiki timestamps are in UTC, so we parse them as UTC dates.
		 * @param {string} mwTimestamp The timestamp string
		 * @return {Date} Parsed date object (UTC)
		 */
		parseMWTimestamp( mwTimestamp ) {
			if ( !mwTimestamp || typeof mwTimestamp !== 'string' ) {
				return new Date();
			}

			// MediaWiki binary(14) format: YYYYMMDDHHmmss
			// Validate length before parsing to avoid Invalid Date
			if ( mwTimestamp.length < 14 ) {
				return new Date();
			}

			const year = parseInt( mwTimestamp.substring( 0, 4 ), 10 );
			const month = parseInt( mwTimestamp.substring( 4, 6 ), 10 ) - 1; // JS months are 0-indexed
			const day = parseInt( mwTimestamp.substring( 6, 8 ), 10 );
			const hour = parseInt( mwTimestamp.substring( 8, 10 ), 10 );
			const minute = parseInt( mwTimestamp.substring( 10, 12 ), 10 );
			const second = parseInt( mwTimestamp.substring( 12, 14 ), 10 );

			// Use Date.UTC to correctly interpret MediaWiki's UTC timestamps
			return new Date( Date.UTC( year, month, day, hour, minute, second ) );
		}

		/**
		 * Show a confirmation dialog
		 *
		 * @private
		 * @param {Object} options Dialog options
		 * @param {string} options.message The message to display
		 * @param {string} [options.title] Dialog title
		 * @param {string} [options.confirmText] Text for confirm button
		 * @param {boolean} [options.isDanger] Whether this is a destructive action
		 * @return {Promise<boolean>} Resolves to true if confirmed
		 */
		async showConfirmDialog( options ) {
			if ( this.editor && this.editor.dialogManager ) {
				return this.editor.dialogManager.showConfirmDialog( options );
			}
			if ( this.uiManager && typeof this.uiManager.showConfirmDialog === 'function' ) {
				return this.uiManager.showConfirmDialog( options );
			}
			// Fallback to native confirm
			// eslint-disable-next-line no-alert
			return window.confirm( options.message );
		}

		/**
		 * Build the revision selector dropdown
		 * Populates the revision dropdown with available layer set revisions
		 */
		buildRevisionSelector() {
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
				allLayerSets.forEach( ( layerSet ) => {
					const option = document.createElement( 'option' );
					const revId = layerSet.ls_id || layerSet.id;
					option.value = String( revId );
					const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
					const userName = layerSet.ls_user_name || layerSet.userName || 'Unknown';
					const name = layerSet.ls_name || layerSet.name || '';

					// Parse MediaWiki binary(14) timestamp format
					const date = this.parseMWTimestamp( timestamp );
					let displayText = date.toLocaleString();

					// Use MessageHelper for parameterized message
					const byUserText = this.getMessageWithParams( 'layers-revision-by', [ userName ], 'by $1' );
					displayText += ' ' + byUserText;

					if ( name ) {
						displayText += ' (' + name + ')';
					}

					option.textContent = displayText;
					// Coerce both sides: revision ids may arrive as strings or numbers
					// depending on the API path, and a type mismatch would leave the
					// loaded revision unmarked (selector shows "Latest" instead).
					option.selected = Number( revId ) === Number( currentLayerSetId );
					selectEl.appendChild( option );
				} );

				// Update load button state
				this.updateRevisionLoadButton();
			} catch ( error ) {
				this.errorLog( 'Error building revision selector:', error );
			}
		}

		/**
		 * Update the revision load button state
		 * Disables button if no revision selected or if current revision is selected
		 */
		updateRevisionLoadButton() {
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
		}

		/**
		 * Build and populate the named layer sets selector dropdown
		 */
		buildSetSelector() {
			try {
				const namedSets = this.stateManager.get( 'namedSets' ) || [];
				const currentSetName = this.stateManager.get( 'currentSetName' ) || this.getSeedSetName();
				const selectEl = this.uiManager && this.uiManager.setSelectEl;

				if ( !selectEl ) {
					return;
				}

				// Clear existing options
				selectEl.innerHTML = '';

				// Check if currentSetName exists in namedSets
				const currentSetExists = namedSets.some( ( s ) => s.name === currentSetName );

				if ( namedSets.length === 0 ) {
					// No sets exist yet - show the name this set will be saved under
					const option = document.createElement( 'option' );
					option.value = currentSetName;
					option.textContent = currentSetName + ' (' +
						this.getMessage( 'layers-set-new-unsaved', 'new' ) + ')';
					option.selected = true;
					selectEl.appendChild( option );
				} else {
					// If currentSetName is not in the named sets list (new unsaved set), add it first
					if ( !currentSetExists ) {
						const newSetOption = document.createElement( 'option' );
						newSetOption.value = currentSetName;
						newSetOption.textContent = currentSetName + ' (' +
							this.getMessage( 'layers-set-new-unsaved', 'new' ) + ')';
						newSetOption.selected = true;
						selectEl.appendChild( newSetOption );
					}

					// Build options from named sets
					namedSets.forEach( ( setInfo ) => {
						const option = document.createElement( 'option' );
						option.value = setInfo.name;

						// Format: "SetName (X revisions)"
						const revCount = setInfo.revision_count || 1;
						let revLabel;
						if ( revCount === 1 ) {
							revLabel = this.getMessage( 'layers-set-revision-single', '1 revision' );
						} else {
							revLabel = this.getMessage( 'layers-set-revision-plural', revCount + ' revisions' )
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
		}

		/**
		 * Update the new set button's enabled/disabled state based on limits
		 */
		updateNewSetButtonState() {
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
		}

		/**
		 * Restore the set selector dropdown value across available UI controllers
		 * @param {string} setName Set name to restore
		 */
		restoreSelectorDropdown( setName ) {
			if ( !setName ) {
				return;
			}
			this.buildSetSelector();

			const selectEl = ( this.uiManager && this.uiManager.setSelectEl ) ||
				( this.editor && this.editor.uiManager && this.editor.uiManager.setSelectEl );
			if ( selectEl ) {
				selectEl.value = setName;
			}

			if ( this.editor && this.editor.uiManager && this.editor.uiManager.setSelectorController ) {
				const ctrl = this.editor.uiManager.setSelectorController;
				const ctrlEl = typeof ctrl.getSelectElement === 'function' ?
					ctrl.getSelectElement() : ctrl.setSelectEl;
				if ( ctrlEl ) {
					ctrlEl.value = setName;
				}
			}
		}

		/**
		 * Capture a snapshot of edit state to detect changes made during async operations
		 * @private
		 * @return {Object}
		 */
		_captureEditSnapshot() {
			let layersVersion = null;
			if ( this.stateManager && typeof this.stateManager.getLayersVersion === 'function' ) {
				layersVersion = this.stateManager.getLayersVersion();
			}

			let historyLength = null;
			let historyIndex = null;
			if ( this.editor && this.editor.historyManager ) {
				if ( Array.isArray( this.editor.historyManager.history ) ) {
					historyLength = this.editor.historyManager.history.length;
				}
				if ( typeof this.editor.historyManager.historyIndex === 'number' ) {
					historyIndex = this.editor.historyManager.historyIndex;
				}
			}

			const isDirty = this.hasUnsavedChanges();
			const layersFingerprint = this._getLayersFingerprint();

			return {
				layersVersion,
				historyLength,
				historyIndex,
				isDirty,
				layersFingerprint
			};
		}

		/**
		 * Capture current content for a bounded switch-time comparison
		 * @private
		 * @return {string}
		 */
		_getLayersFingerprint() {
			try {
				const layers = ( this.stateManager && this.stateManager.get( 'layers' ) ) ||
					( this.editor && this.editor.layers ) || [];
				if ( !Array.isArray( layers ) ) {
					return 'empty';
				}
				return JSON.stringify( {
					layers,
					page: this.editor && this.editor.page,
					background: this.stateManager ? [
						'backgroundVisible', 'backgroundOpacity', 'slideBackgroundColor',
						'slideCanvasWidth', 'slideCanvasHeight', 'canvasWidth', 'canvasHeight'
					].map( ( key ) => this.stateManager.get( key ) ) : [],
					buffer: this.editor && this.editor.pageBuffer && this.editor.pageBuffer.pages ?
						Array.from( this.editor.pageBuffer.pages.entries() ) : []
				} );
			} catch ( e ) {
				return 'error';
			}
		}

		/**
		 * Check whether newer edits occurred since a snapshot was taken
		 * @private
		 * @param {Object} startSnapshot
		 * @return {boolean}
		 */
		_hasNewerEdits( startSnapshot ) {
			if ( !startSnapshot ) {
				return false;
			}

			// 1. If StateManager layersVersion changed
			if ( this.stateManager && typeof this.stateManager.getLayersVersion === 'function' && startSnapshot.layersVersion !== null ) {
				if ( this.stateManager.getLayersVersion() !== startSnapshot.layersVersion ) {
					return true;
				}
			}

			// 2. If HistoryManager recorded new steps
			if ( this.editor && this.editor.historyManager ) {
				const hm = this.editor.historyManager;
				if ( Array.isArray( hm.history ) && startSnapshot.historyLength !== null ) {
					if ( hm.history.length !== startSnapshot.historyLength ) {
						return true;
					}
				}
				if ( typeof hm.historyIndex === 'number' && startSnapshot.historyIndex !== null ) {
					if ( hm.historyIndex !== startSnapshot.historyIndex ) {
						return true;
					}
				}
			}

			// 3. If work was clean when load started, but became dirty during load
			if ( !startSnapshot.isDirty && this.hasUnsavedChanges() ) {
				return true;
			}

			// 4. Fingerprint check fallback
			const currentFingerprint = this._getLayersFingerprint();
			if ( startSnapshot.layersFingerprint && currentFingerprint !== startSnapshot.layersFingerprint ) {
				return true;
			}

			return false;
		}

		/**
		 * Load a layer set by its name (authoritative switch operation)
		 *
		 * @param {string} setName The name of the set to load
		 * @param {Object} [options={}] Switch options
		 * @param {boolean} [options.skipConfirm=false] Skip unsaved changes confirmation
		 * @return {Promise<Object>} Outcome object { status: 'success'|'cancelled'|'failed', ... }
		 */
		async loadLayerSetByName( setName, options = {} ) {
			this._switchGeneration = ( this._switchGeneration || 0 ) + 1;
			const switchId = this._switchGeneration;
			try {
				if ( !setName || typeof setName !== 'string' || !setName.trim() ) {
					this.errorLog( 'loadLayerSetByName: No set name provided' );
					return {
						status: 'failed',
						success: false,
						failed: true,
						setName: setName || '',
						reason: 'invalid_name',
						error: new Error( 'No set name provided' )
					};
				}

				const targetSetName = setName.trim();
				const currentSetName = this.getCurrentSetName();

				// Check for unsaved changes before switching (single authoritative confirmation)
				if ( !options.skipConfirm && this.hasUnsavedChanges() ) {
					const confirmMsg = this.getMessage(
						'layers-unsaved-changes-warning',
						'You have unsaved changes. Switch sets without saving?'
					);
					const confirmSwitch = await this.showConfirmDialog( {
						message: confirmMsg,
						title: this.getMessage( 'layers-unsaved-changes-title', 'Unsaved Changes' ),
						confirmText: this.getMessage( 'layers-switch-anyway', 'Switch Anyway' ),
						isDanger: true
					} );
					if ( switchId !== this._switchGeneration ) {
						return { status: 'failed', reason: 'superseded', success: false };
					}
					if ( !confirmSwitch ) {
						// Revert selector to current set
						this.restoreSelectorDropdown( currentSetName );
						return {
							status: 'cancelled',
							success: false,
							cancelled: true,
							setName: targetSetName
						};
					}
				}


				// Capture edit snapshot before async load to detect newer edits made during flight
				const editSnapshot = this._captureEditSnapshot();

				this.debugLog( 'Loading layer set: ' + targetSetName );

				const switchContext = {
					setName: targetSetName,
					switchId,
					editSnapshot,
					dataApplied: false,
					newerEditsDetected: false
				};
				this._activeSwitch = switchContext;

				// Load the set via API (keep currentSetName, layers, and dirty state intact until load succeeds)
				let loadResult = null;
				try {
					if ( this.apiManager && typeof this.apiManager.loadLayersBySetName === 'function' ) {
						loadResult = await this.apiManager.loadLayersBySetName( targetSetName, {
							shouldApply: () => switchId === this._switchGeneration &&
								this._activeSwitch === switchContext && this.canApplyLoadedSet( targetSetName )
						} );
					}
				} finally {
					if ( this._activeSwitch === switchContext ) {
						this._activeSwitch = null;
					}
				}

				// Check 1: Was this switch request superseded by a newer switch?
				if ( switchId !== this._switchGeneration || ( loadResult && loadResult.superseded ) ) {
					this.debugLog( 'Discarding load result for ' + targetSetName + ' because switch was superseded' );
					return {
						status: 'failed',
						success: false,
						failed: true,
						reason: 'superseded',
						setName: targetSetName
					};
				}

				// Check 2: Were newer edits made while the load was in-flight?
				const hasNewerEdits = switchContext.newerEditsDetected ||
					( !switchContext.dataApplied && this._hasNewerEdits( editSnapshot ) );
				if ( hasNewerEdits ) {
					this.debugLog( 'Preserving newer edits made during load of ' + targetSetName );
					this.restoreSelectorDropdown( currentSetName );
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify(
							this.getMessage( 'layers-switch-newer-edits-preserved', 'Newer edits were preserved; set switch cancelled.' ),
							{ type: 'warn' }
						);
					}
					return {
						status: 'failed',
						success: false,
						failed: true,
						reason: 'newer_edits',
						setName: targetSetName
					};
				}

				// Load succeeded: update current set name in state
				if ( this.stateManager ) {
					this.stateManager.set( 'currentSetName', targetSetName );
				}

				// Clear discarded buffered pages for previous set if present
				if ( this.editor && this.editor.pageBuffer && typeof this.editor.pageBuffer.clear === 'function' ) {
					this.editor.pageBuffer.clear();
				}

				// Notify user
				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.getMessage( 'layers-set-loaded', 'Loaded layer set: ' + targetSetName )
							.replace( '$1', targetSetName ),
						{ type: 'info' }
					);
				}

				return {
					status: 'success',
					success: true,
					setName: targetSetName
				};
			} catch ( error ) {
				if ( switchId !== this._switchGeneration ) {
					return { status: 'failed', reason: 'superseded', success: false };
				}
				this.errorLog( 'Error loading layer set by name:', error );

				// Keep current layers, current set and dirty state intact
				// Restore selector to current set
				const activeSet = this.getCurrentSetName();
				this.restoreSelectorDropdown( activeSet );

				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.getMessage( 'layers-set-load-error', 'Failed to load layer set' ),
						{ type: 'error' }
					);
				}

				return {
					status: 'failed',
					success: false,
					failed: true,
					error: error,
					setName: setName || ''
				};
			}
		}

		/**
		 * Switch layer set (alias for loadLayerSetByName)
		 * @param {string} setName The name of the set to load
		 * @param {Object} [options] Switch options
		 * @return {Promise<Object>}
		 */
		async switchLayerSet( setName, options ) {
			return this.loadLayerSetByName( setName, options );
		}

		/**
		 * Check whether an in-flight load can be applied to editor state
		 * @param {string} setName
		 * @return {boolean}
		 */
		canApplyLoadedSet( setName ) {
			if ( !this._activeSwitch ) {
				return true;
			}
			if ( this._activeSwitch.setName !== setName ) {
				return false;
			}
			if ( this._switchGeneration !== this._activeSwitch.switchId ) {
				return false;
			}
			if ( this._hasNewerEdits( this._activeSwitch.editSnapshot ) ) {
				this._activeSwitch.newerEditsDetected = true;
				return false;
			}
			this._activeSwitch.dataApplied = true;
			return true;
		}

		/**
		 * Create a new named layer set
		 * @param {string} setName The name for the new set
		 * @return {Promise<boolean>} True if creation succeeded
		 */
		async createNewLayerSet( setName ) {
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
				const exists = namedSets.some( ( s ) => s.name.toLowerCase() === trimmedName.toLowerCase() );
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

				// Add to named sets list (use immutable pattern for state tracking)
				const userName = ( typeof mw !== 'undefined' && mw.config ) ?
					mw.config.get( 'wgUserName' ) : 'Anonymous';
				const updatedNamedSets = [ ...namedSets, {
					name: trimmedName,
					revision_count: 0,
					latest_revision: null,
					latest_timestamp: null,
					latest_user_name: userName
				} ];
				this.stateManager.set( 'namedSets', updatedNamedSets );

				// Rebuild selector
				this.buildSetSelector();

				// Mark as having unsaved changes
				this.stateManager.set( 'isDirty', true );
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
		}

		/**
		 * Check if there are unsaved changes (document-level, including buffered pages)
		 * @return {boolean}
		 */
		hasUnsavedChanges() {
			if ( this.editor && typeof this.editor.hasUnsavedChanges === 'function' ) {
				return this.editor.hasUnsavedChanges();
			}
			if ( this.editor && this.editor.pageBuffer && typeof this.editor.pageBuffer.isEmpty === 'function' ) {
				if ( !this.editor.pageBuffer.isEmpty() ) {
					return true;
				}
			}
			if ( this.stateManager ) {
				return !!this.stateManager.get( 'isDirty' );
			}
			return false;
		}

		/**
		 * Load a specific revision by ID
		 * @param {number} revisionId The revision ID to load
		 */
		loadRevisionById( revisionId ) {
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
		}

		/**
		 * Reload revisions list from API
		 * @return {Promise<void>}
		 */
		async reloadRevisions() {
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
		}

		/**
		 * Get current set name
		 * @return {string}
		 */
		getCurrentSetName() {
			return this.stateManager ?
				( this.stateManager.get( 'currentSetName' ) || this.getSeedSetName() ) :
				this.getSeedSetName();
		}

		/**
		 * Get named sets list
		 * @return {Array}
		 */
		getNamedSets() {
			return this.stateManager ? ( this.stateManager.get( 'namedSets' ) || [] ) : [];
		}

		/**
		 * Destroy and clean up
		 */
		destroy() {
			this._switchGeneration = 0;
			this.editor = null;
			this.stateManager = null;
			this.apiManager = null;
			this.uiManager = null;
			this.config = null;
		}
	}

	// Export to window.Layers namespace (preferred)
	if ( typeof window !== 'undefined' ) {
		window.Layers = window.Layers || {};
		window.Layers.Core = window.Layers.Core || {};
		window.Layers.Core.LayerSetManager = LayerSetManager;
	}

	// CommonJS export for testing
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = LayerSetManager;
	}

}() );
