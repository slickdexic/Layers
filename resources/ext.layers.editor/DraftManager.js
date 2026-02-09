/**
 * Draft Manager for Layers Editor
 * Handles auto-save to localStorage and draft recovery
 *
 * Features:
 * - Debounced auto-save every 30 seconds when dirty
 * - Draft detection on editor open
 * - Recovery dialog for unsaved drafts
 * - Clears draft on successful save
 */
( function () {
	'use strict';

	/**
	 * Auto-save interval in milliseconds (30 seconds)
	 * @constant {number}
	 */
	const AUTO_SAVE_INTERVAL_MS = 30000;

	/**
	 * Debounce delay for auto-save trigger (5 seconds)
	 * Prevents saving on every keystroke
	 * @constant {number}
	 */
	const AUTO_SAVE_DEBOUNCE_MS = 5000;

	/**
	 * Maximum draft age in milliseconds (24 hours)
	 * Drafts older than this are automatically discarded
	 * @constant {number}
	 */
	const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;

	/**
	 * LocalStorage key prefix for drafts
	 * @constant {string}
	 */
	const STORAGE_KEY_PREFIX = 'layers-draft-';

	/**
	 * DraftManager class
	 */
	class DraftManager {
		/**
		 * Create a DraftManager instance
		 *
		 * @param {Object} editor - The LayersEditor instance
		 */
		constructor( editor ) {
			this.editor = editor;
			this.filename = editor.filename || '';
			this.storageKey = STORAGE_KEY_PREFIX + this.filename.replace( /[^a-zA-Z0-9_.-]/g, '_' );
			this.autoSaveTimer = null;
			this.debounceTimer = null;
			this.isRecoveryMode = false;
			this.stateSubscription = null;

			this.initialize();
		}

		/**
		 * Initialize the draft manager
		 */
		initialize() {
			// Clean up existing subscription before creating new one (MEM-2 leak prevention)
			if ( this.stateSubscription && typeof this.stateSubscription === 'function' ) {
				this.stateSubscription();
				this.stateSubscription = null;
			}

			// Subscribe to layer changes to trigger auto-save
			if ( this.editor.stateManager ) {
				this.stateSubscription = this.editor.stateManager.subscribe( 'layers', () => {
					this.scheduleAutoSave();
				} );
			}

			// Start periodic auto-save check
			this.startAutoSaveTimer();
		}

		/**
		 * Generate a unique storage key for the current context
		 *
		 * @return {string} Storage key
		 */
		getStorageKey() {
			const setName = this.editor.stateManager ?
				this.editor.stateManager.get( 'currentSetName' ) || 'default' :
				'default';
			return this.storageKey + '-' + setName.replace( /[^a-zA-Z0-9_.-]/g, '_' );
		}

		/**
		 * Check if localStorage is available
		 *
		 * @return {boolean} True if localStorage is available
		 */
		isStorageAvailable() {
			try {
				const test = '__layers_storage_test__';
				localStorage.setItem( test, test );
				localStorage.removeItem( test );
				return true;
			} catch ( e ) {
				return false;
			}
		}

		/**
		 * Schedule an auto-save with debouncing
		 */
		scheduleAutoSave() {
			// Don't save during recovery mode or if already saving
			if ( this.isRecoveryMode ) {
				return;
			}

			// Clear existing debounce timer
			if ( this.debounceTimer ) {
				clearTimeout( this.debounceTimer );
			}

			// Debounce the save
			this.debounceTimer = setTimeout( () => {
				this.saveDraft();
			}, AUTO_SAVE_DEBOUNCE_MS );
		}

		/**
		 * Start the periodic auto-save timer
		 */
		startAutoSaveTimer() {
			// Clear any existing timer
			if ( this.autoSaveTimer ) {
				clearInterval( this.autoSaveTimer );
			}

			// Set up periodic auto-save
			this.autoSaveTimer = setInterval( () => {
				if ( this.editor.isDirty && this.editor.isDirty() ) {
					this.saveDraft();
				}
			}, AUTO_SAVE_INTERVAL_MS );
		}

		/**
		 * Stop the auto-save timer
		 */
		stopAutoSaveTimer() {
			if ( this.autoSaveTimer ) {
				clearInterval( this.autoSaveTimer );
				this.autoSaveTimer = null;
			}
			if ( this.debounceTimer ) {
				clearTimeout( this.debounceTimer );
				this.debounceTimer = null;
			}
		}

		/**
		 * Save current layers to localStorage as a draft
		 *
		 * @return {boolean} True if save was successful
		 */
		saveDraft() {
			if ( !this.isStorageAvailable() ) {
				return false;
			}

			// Only save drafts when there are unsaved changes
			if ( this.editor.isDirty && !this.editor.isDirty() ) {
				return false;
			}

			try {
				const layers = this.editor.stateManager ?
					this.editor.stateManager.get( 'layers' ) || [] :
					[];

				// Don't save empty drafts
				if ( layers.length === 0 ) {
					return false;
				}

				const draft = {
					version: 1,
					timestamp: Date.now(),
					filename: this.filename,
					setName: this.editor.stateManager ?
						this.editor.stateManager.get( 'currentSetName' ) || 'default' :
						'default',
					// Strip base64 image src data to avoid localStorage overflow
					layers: layers.map( ( l ) => {
						if ( l.type === 'image' && l.src && l.src.length > 1024 ) {
							const copy = Object.assign( {}, l );
							delete copy.src;
							copy._srcStripped = true;
							return copy;
						}
						return l;
					} ),
					backgroundVisible: this.editor.stateManager ?
						this.editor.stateManager.get( 'backgroundVisible' ) :
						true,
					backgroundOpacity: this.editor.stateManager ?
						this.editor.stateManager.get( 'backgroundOpacity' ) :
						1.0
				};

				localStorage.setItem( this.getStorageKey(), JSON.stringify( draft ) );

				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log( '[DraftManager] Draft saved:', layers.length, 'layers' );
				}

				return true;
			} catch ( e ) {
				// localStorage might be full or unavailable
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[DraftManager] Failed to save draft:', e.message );
				}
				return false;
			}
		}

		/**
		 * Load a draft from localStorage
		 *
		 * @return {Object|null} The draft object or null if not found/expired
		 */
		loadDraft() {
			if ( !this.isStorageAvailable() ) {
				return null;
			}

			try {
				const stored = localStorage.getItem( this.getStorageKey() );
				if ( !stored ) {
					return null;
				}

				const draft = JSON.parse( stored );

				// Check if draft is too old
				if ( draft.timestamp && ( Date.now() - draft.timestamp ) > MAX_DRAFT_AGE_MS ) {
					this.clearDraft();
					return null;
				}

				// Validate draft structure
				if ( !draft.layers || !Array.isArray( draft.layers ) ) {
					this.clearDraft();
					return null;
				}

				return draft;
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.warn( '[DraftManager] Failed to load draft:', e.message );
				}
				return null;
			}
		}

		/**
		 * Check if a recoverable draft exists
		 *
		 * @return {boolean} True if a valid draft exists
		 */
		hasDraft() {
			const draft = this.loadDraft();
			return draft !== null && draft.layers && draft.layers.length > 0;
		}

		/**
		 * Get draft info for display
		 *
		 * @return {Object|null} Draft info or null
		 */
		getDraftInfo() {
			const draft = this.loadDraft();
			if ( !draft ) {
				return null;
			}

			return {
				layerCount: draft.layers.length,
				timestamp: draft.timestamp,
				setName: draft.setName,
				age: Date.now() - draft.timestamp
			};
		}

		/**
		 * Clear the stored draft
		 */
		clearDraft() {
			if ( !this.isStorageAvailable() ) {
				return;
			}

			try {
				localStorage.removeItem( this.getStorageKey() );
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log( '[DraftManager] Draft cleared' );
				}
			} catch ( e ) {
				// Ignore errors when clearing
			}
		}

		/**
		 * Recover layers from draft
		 *
		 * @return {boolean} True if recovery was successful
		 */
		recoverDraft() {
			const draft = this.loadDraft();
			if ( !draft || !draft.layers ) {
				return false;
			}

			this.isRecoveryMode = true;

			try {
				// Set the layers from draft
				if ( this.editor.stateManager ) {
					this.editor.stateManager.update( {
						layers: draft.layers,
						backgroundVisible: draft.backgroundVisible !== undefined ?
							draft.backgroundVisible : true,
						backgroundOpacity: draft.backgroundOpacity !== undefined ?
							draft.backgroundOpacity : 1.0,
						isDirty: true
					} );
				}

				// Re-render the layers
				if ( this.editor.canvasManager ) {
					this.editor.canvasManager.renderLayers( draft.layers );
				}

				// Update the layer panel
				if ( this.editor.layerPanel && typeof this.editor.layerPanel.updateLayers === 'function' ) {
					this.editor.layerPanel.updateLayers( draft.layers );
				}

				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log( '[DraftManager] Recovered', draft.layers.length, 'layers from draft' );
				}

				return true;
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log.error( '[DraftManager] Failed to recover draft:', e.message );
				}
				return false;
			} finally {
				this.isRecoveryMode = false;
			}
		}

		/**
		 * Show the recovery dialog
		 *
		 * @return {Promise<boolean>} Resolves to true if user chose to recover
		 */
		showRecoveryDialog() {
			return new Promise( ( resolve ) => {
				const draftInfo = this.getDraftInfo();
				if ( !draftInfo ) {
					resolve( false );
					return;
				}

				// Format the timestamp
				const date = new Date( draftInfo.timestamp );
				const timeStr = date.toLocaleString();

				// Get message text
				const getMessage = ( key, fallback ) => {
					if ( typeof mw !== 'undefined' && mw.message ) {
						const msg = mw.message( key );
						return msg.exists() ? msg.text() : fallback;
					}
					return fallback;
				};

				const title = getMessage( 'layers-draft-recovery-title', 'Recover Unsaved Changes?' );
				const message = getMessage( 'layers-draft-recovery-message', 
					'Found unsaved changes from {time} with {count} layer(s). Would you like to recover them?' )
					.replace( '{time}', timeStr )
					.replace( '{count}', String( draftInfo.layerCount ) );
				const recoverBtn = getMessage( 'layers-draft-recover', 'Recover' );
				const discardBtn = getMessage( 'layers-draft-discard', 'Discard' );

				// Use OOUI dialog if available (OO is a MediaWiki global)
				// eslint-disable-next-line no-undef
				if ( typeof OO !== 'undefined' && OO.ui && OO.ui.confirm ) {
					// eslint-disable-next-line no-undef
					OO.ui.confirm( message, {
						title: title,
						actions: [
							{ label: discardBtn, action: 'reject' },
							{ label: recoverBtn, action: 'accept', flags: [ 'primary', 'progressive' ] }
						]
					} ).then( ( confirmed ) => {
						resolve( confirmed );
					} );
				} else {
					// Fallback to native confirm
					const confirmed = window.confirm( message );
					resolve( confirmed );
				}
			} );
		}

		/**
		 * Check for drafts and prompt user to recover
		 * Should be called after initial layer load
		 *
		 * @return {Promise<boolean>} Resolves to true if draft was recovered
		 */
		async checkAndRecoverDraft() {
			if ( !this.hasDraft() ) {
				return false;
			}

			const shouldRecover = await this.showRecoveryDialog();

			if ( shouldRecover ) {
				const recovered = this.recoverDraft();
				if ( recovered ) {
					// Clear the draft after successful recovery
					this.clearDraft();
					
					// Show notification
					if ( typeof mw !== 'undefined' && mw.notify ) {
						mw.notify(
							mw.message( 'layers-draft-recovered' ).exists() ?
								mw.message( 'layers-draft-recovered' ).text() :
								'Draft recovered successfully',
							{ type: 'success' }
						);
					}
				}
				return recovered;
			} else {
				// User chose to discard
				this.clearDraft();
				return false;
			}
		}

		/**
		 * Called when a successful save occurs
		 * Clears the draft since changes are now persisted
		 */
		onSaveSuccess() {
			this.clearDraft();
		}

		/**
		 * Clean up resources
		 */
		destroy() {
			this.stopAutoSaveTimer();

			if ( this.stateSubscription && typeof this.stateSubscription === 'function' ) {
				this.stateSubscription();
				this.stateSubscription = null;
			}
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.DraftManager = DraftManager;

	// Legacy global export
	window.DraftManager = DraftManager;

} )();
