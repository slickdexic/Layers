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
			// Append a short FNV-1a hash of the original filename to prevent key
			// collisions when two filenames sanitize to the same string
			// (e.g. "Foo/bar.jpg" and "Foo_bar.jpg" both become "Foo_bar.jpg")
			const _fnv = ( s ) => {
				let h = 2166136261;
				for ( let i = 0; i < s.length; i++ ) {
					h = Math.imul( h ^ s.charCodeAt( i ), 16777619 ) >>> 0;
				}
				return ( h >>> 0 ).toString( 36 ).slice( 0, 4 );			};
			this.storageKey = STORAGE_KEY_PREFIX +
				DraftManager.getUserScope() + '-' +
				this.filename.replace( /[^a-zA-Z0-9_.-]/g, '_' ) +
				'_' + _fnv( this.filename );
			this.autoSaveTimer = null;
			this.debounceTimer = null;
			this.isRecoveryMode = false;
			this.stateSubscription = null;

			this.initialize();
		}

		/**
		 * Identify the current user for draft key scoping.
		 *
		 * Drafts used to be keyed by filename alone, so on a shared browser profile
		 * the next person to open the same file was offered the previous person's
		 * unsaved annotations.
		 *
		 * @return {string} Stable per-user token ('anon' when logged out)
		 */
		static getUserScope() {
			if ( typeof mw === 'undefined' || !mw.config || !mw.config.get ) {
				return 'anon';
			}
			const id = mw.config.get( 'wgUserId' );
			return id ? 'u' + id : 'anon';
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

			// Nothing else ever removes a draft for a file the user will not reopen,
			// so without this sweep localStorage fills up and every consumer on the
			// wiki starts failing, not just the editor.
			this.sweepExpiredDrafts();

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
		 * Remove every Layers draft past MAX_DRAFT_AGE_MS, for any file or user.
		 *
		 * @param {boolean} [aggressive] Also drop the oldest surviving drafts, used
		 *   to free space after a quota failure
		 * @return {number} Number of keys removed
		 */
		sweepExpiredDrafts( aggressive ) {
			// Deliberately not isStorageAvailable(): that probes with a write, and
			// the sweep runs on every editor open. The try/catch below covers a
			// storage-denied environment just as well.
			if ( typeof localStorage === 'undefined' || !localStorage ||
				typeof localStorage.key !== 'function'
			) {
				return 0;
			}
			const currentKey = this.getStorageKey();
			const survivors = [];
			let removed = 0;
			try {
				for ( let i = localStorage.length - 1; i >= 0; i-- ) {
					const key = localStorage.key( i );
					if ( !key || key.indexOf( STORAGE_KEY_PREFIX ) !== 0 || key === currentKey ) {
						continue;
					}
					let timestamp = 0;
					try {
						timestamp = ( JSON.parse( localStorage.getItem( key ) ) || {} ).timestamp || 0;
					} catch ( parseError ) {
						// Unparseable draft is dead weight regardless of age.
					}
					if ( !timestamp || ( Date.now() - timestamp ) > MAX_DRAFT_AGE_MS ) {
						localStorage.removeItem( key );
						removed++;
					} else {
						survivors.push( { key: key, timestamp: timestamp } );
					}
				}

				if ( aggressive ) {
					survivors.sort( ( a, b ) => a.timestamp - b.timestamp );
					const drop = survivors.slice( 0, Math.ceil( survivors.length / 2 ) );
					drop.forEach( ( entry ) => {
						localStorage.removeItem( entry.key );
						removed++;
					} );
				}
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
					mw.log.warn( '[DraftManager] Draft sweep failed:', e.message );
				}
			}
			return removed;
		}

		/**
		 * Generate a unique storage key for the current context
		 *
		 * @return {string} Storage key
		 */
		getStorageKey() {
			const setName = this.editor.stateManager ?
				this.editor.stateManager.get( 'currentSetName' ) || '' :
				'';
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
				if ( !this.saveDraft() && !this._saveFailNotified ) {
					this._saveFailNotified = true;
					mw.notify(
						mw.message( 'layers-draft-save-failed' ).text(),
						{ type: 'warn', autoHideSeconds: 5 }
					);
				}
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
				if ( this.isRecoveryMode ) {
					return;
				}
				if ( this.editor.isDirty && this.editor.isDirty() ) {
					if ( !this.saveDraft() && !this._saveFailNotified ) {
						this._saveFailNotified = true;
						mw.notify(
							mw.message( 'layers-draft-save-failed' ).text(),
							{ type: 'warn', autoHideSeconds: 5 }
						);
					}
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
			// Deliberately no isStorageAvailable() gate: it probes with a write, so
			// when the quota is actually full it fails too and short-circuits the
			// recovery below. The try/catch covers a denied or missing store.
			// Only save drafts when there are unsaved changes
			if ( this.editor.isDirty && !this.editor.isDirty() ) {
				return false;
			}

			let serialized;
			try {
				const layers = this.editor.stateManager ?
					this.editor.stateManager.get( 'layers' ) || [] :
					[];

				// Don't save empty drafts
				if ( layers.length === 0 ) {
					return false;
				}

				serialized = JSON.stringify( {
					version: 1,
					timestamp: Date.now(),
					filename: this.filename,
					setName: this.editor.stateManager ?
						this.editor.stateManager.get( 'currentSetName' ) || '' :
						'',
					// Strip base64 image src data to avoid localStorage overflow
					layers: layers.map( ( l ) => {
						if ( l.type === 'image' && l.src && l.src.length > 1024 ) {
							const copy = { ...l };
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
				} );

				localStorage.setItem( this.getStorageKey(), serialized );

				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log( '[DraftManager] Draft saved:', layers.length, 'layers' );
				}

				return true;
			} catch ( e ) {
				// A full origin quota is recoverable: expired and stale drafts for
				// other files are dead weight, so drop them and try once more.
				// Previously this just gave up, and autosave stayed dead for the
				// rest of the session.
				if ( serialized && DraftManager.isQuotaError( e ) &&
					this.sweepExpiredDrafts( true ) > 0
				) {
					try {
						localStorage.setItem( this.getStorageKey(), serialized );
						return true;
					} catch ( retryError ) {
						// Genuinely out of space; fall through to the warning.
					}
				}
				if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
					mw.log.warn( '[DraftManager] Failed to save draft:', e.message );
				}
				return false;
			}
		}

		/**
		 * Recognise a storage-quota failure across browsers.
		 *
		 * Firefox reports NS_ERROR_DOM_QUOTA_REACHED, Safari a bare
		 * QuotaExceededError with code 22, older WebKit code 1014.
		 *
		 * @param {Error} e The caught error
		 * @return {boolean} True when the write failed for lack of space
		 */
		static isQuotaError( e ) {
			if ( !e ) {
				return false;
			}
			return e.name === 'QuotaExceededError' ||
				e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
				e.code === 22 || e.code === 1014;
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

				// Warn user if any image layers had their data stripped
				const strippedCount = draft.layers.filter(
					( l ) => l._srcStripped === true
				).length;
				if ( strippedCount > 0 ) {
					// Clean the internal flag so it doesn't persist into saved data
					draft.layers.forEach( ( l ) => {
						delete l._srcStripped;
					} );
					if ( typeof mw !== 'undefined' && mw.notify && mw.message ) {
						mw.notify(
							mw.message( 'layers-draft-images-lost', strippedCount ).text(),
							{ type: 'warn', autoHide: false }
						);
					}
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

			// Clear references to allow GC
			this.editor = null;
			this.filename = null;
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.DraftManager = DraftManager;

	// Legacy global export
	window.DraftManager = DraftManager;

} )();
