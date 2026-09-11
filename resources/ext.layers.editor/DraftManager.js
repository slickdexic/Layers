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
	 * LocalStorage key prefix for legacy drafts (v1)
	 * @constant {string}
	 */
	const STORAGE_KEY_PREFIX = 'layers-draft-';

	/**
	 * LocalStorage key prefix for versioned injective drafts (v2)
	 * @constant {string}
	 */
	const STORAGE_KEY_PREFIX_V2 = 'layers-draft-v2:';

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
			this.wikiScope = ( editor && editor.wikiScope !== undefined && editor.wikiScope !== null ) ?
				String( editor.wikiScope ) :
				DraftManager.getWikiScope();
			this.userScope = ( editor && editor.userScope !== undefined && editor.userScope !== null ) ?
				String( editor.userScope ) :
				DraftManager.getUserScope();
			// Retain legacy key prefix for backward-compatible lookups
			this.storageKey = STORAGE_KEY_PREFIX +
				this.userScope + '-' +
				this.filename.replace( /[^a-zA-Z0-9_.-]/g, '_' ) +
				'_' + DraftManager.fnv1a( this.filename );
			this.autoSaveTimer = null;
			this.debounceTimer = null;
			this.isRecoveryMode = false;
			this.lastWriteFailed = false;
			this.stateSubscription = null;
			this.ambiguousLegacyRecord = null;

			this.initialize();
		}

		/**
		 * Identify the current wiki for draft key scoping.
		 *
		 * @return {string} Stable wiki identifier ('default' when unknown)
		 */
		static getWikiScope() {
			if ( typeof mw === 'undefined' || !mw.config || !mw.config.get ) {
				return 'default';
			}
			return mw.config.get( 'wgWikiId' ) || mw.config.get( 'wgDBname' ) || 'default';
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
		 * Injective encoding of the complete draft identity tuple:
		 * [ wikiScope, userScope, filename, setName, page ]
		 *
		 * @param {string} wikiScope Wiki scope
		 * @param {string} userScope User scope
		 * @param {string} filename Original filename
		 * @param {string} setName Original set name
		 * @param {number|string} page Normalized page number
		 * @return {string} Versioned storage key
		 */
		static encodeKey( wikiScope, userScope, filename, setName, page ) {
			const w = ( wikiScope !== undefined && wikiScope !== null ) ? String( wikiScope ) : 'default';
			const u = ( userScope !== undefined && userScope !== null ) ? String( userScope ) : 'anon';
			const f = ( filename !== undefined && filename !== null ) ? String( filename ) : '';
			const s = ( setName !== undefined && setName !== null ) ? String( setName ) : '';
			const p = Math.max( 1, parseInt( page, 10 ) || 1 );
			return STORAGE_KEY_PREFIX_V2 + JSON.stringify( [ w, u, f, s, p ] );
		}

		/**
		 * Decode a versioned storage key into its identity tuple.
		 *
		 * @param {string} key Storage key
		 * @return {Object|null} Decoded tuple or null if not a valid v2 key
		 */
		static decodeKey( key ) {
			if ( typeof key !== 'string' || key.indexOf( STORAGE_KEY_PREFIX_V2 ) !== 0 ) {
				return null;
			}
			try {
				const tuple = JSON.parse( key.slice( STORAGE_KEY_PREFIX_V2.length ) );
				if ( Array.isArray( tuple ) && tuple.length === 5 ) {
					return {
						wikiScope: tuple[ 0 ],
						userScope: tuple[ 1 ],
						filename: tuple[ 2 ],
						setName: tuple[ 3 ],
						page: tuple[ 4 ]
					};
				}
			} catch ( e ) {
				return null;
			}
			return null;
		}

		/**
		 * Short FNV-1a hash of a string for collision avoidance in storage keys
		 *
		 * @param {string} s Input string
		 * @return {string} 4-character base36 hash
		 */
		static fnv1a( s ) {
			s = ( s !== undefined && s !== null ) ? String( s ) : '';
			let h = 2166136261;
			for ( let i = 0; i < s.length; i++ ) {
				h = Math.imul( h ^ s.charCodeAt( i ), 16777619 ) >>> 0;
			}
			return ( h >>> 0 ).toString( 36 ).slice( 0, 4 );
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
		 * Remove expired Layers drafts for the current user and wiki.
		 *
		 * Does not sweep other users' drafts. Unparseable drafts belonging to
		 * the current user are removed as dead weight.
		 *
		 * @param {boolean} [aggressive] Also drop the oldest surviving drafts
		 *   for the current user, used to free space after a quota failure
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
			const legacyUserPrefix = STORAGE_KEY_PREFIX + this.userScope + '-';
			const survivors = [];
			let removed = 0;
			try {
				for ( let i = localStorage.length - 1; i >= 0; i-- ) {
					const key = localStorage.key( i );
					if ( !key || key === currentKey ) {
						continue;
					}

					let isCandidate = false;

					// Check if v2 key belonging to current user and wiki
					if ( key.indexOf( STORAGE_KEY_PREFIX_V2 ) === 0 ) {
						const decoded = DraftManager.decodeKey( key );
						if ( decoded && decoded.userScope === this.userScope && decoded.wikiScope === this.wikiScope ) {
							isCandidate = true;
						}
					} else if ( key.indexOf( legacyUserPrefix ) === 0 ) {
						// Legacy key belonging to current user scope
						// Note: legacy keys do not record wiki identity; we do not infer cross-wiki ownership
						isCandidate = true;
					}

					if ( !isCandidate ) {
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
		 * Build an unambiguous v2 storage key for an explicit file, set name, and page.
		 *
		 * @param {string} [filename] Target filename
		 * @param {string} [setName] Target set name
		 * @param {number|string} [page] Target page number
		 * @param {Object} [options] Context options override
		 * @param {string} [options.wikiScope] Explicit wiki scope override
		 * @param {string} [options.userScope] Explicit user scope override
		 * @return {string} Storage key
		 */
		buildStorageKey( filename, setName, page, options ) {
			const opts = ( typeof options === 'object' && options !== null ) ? options : {};
			const wiki = ( opts.wikiScope !== undefined ) ? opts.wikiScope : this.wikiScope;
			const user = ( opts.userScope !== undefined ) ? opts.userScope : this.userScope;
			const file = ( opts.filename !== undefined ) ?
				opts.filename :
				( ( filename !== undefined && filename !== null ) ? filename : ( this.filename || '' ) );
			const set = ( opts.setName !== undefined ) ?
				opts.setName :
				( ( setName !== undefined && setName !== null ) ? setName : '' );
			const pageVal = ( opts.page !== undefined ) ?
				opts.page :
				( page !== undefined ? page : 1 );

			return DraftManager.encodeKey( wiki, user, file, set, pageVal );
		}

		/**
		 * Build a legacy v1 storage key for backward-compatibility lookups.
		 *
		 * @param {string} [filename] Target filename
		 * @param {string} [setName] Target set name
		 * @param {number|string} [page] Target page number
		 * @param {string} [userScope] Target user scope
		 * @return {string} Legacy storage key
		 */
		buildLegacyStorageKey( filename, setName, page, userScope ) {
			const file = ( filename !== undefined && filename !== null ) ?
				String( filename ) :
				( this.filename || '' );
			const set = ( setName !== undefined && setName !== null ) ?
				String( setName ) :
				'';
			const pageNum = Math.max( 1, parseInt( page, 10 ) || 1 );
			const pageSuffix = pageNum > 1 ? '-p' + pageNum : '';
			const u = ( userScope !== undefined && userScope !== null ) ?
				String( userScope ) :
				( this.userScope || 'anon' );

			if ( file === this.filename && u === this.userScope && this.storageKey ) {
				return this.storageKey + '-' + set.replace( /[^a-zA-Z0-9_.-]/g, '_' ) + pageSuffix;
			}

			return STORAGE_KEY_PREFIX +
				u + '-' +
				file.replace( /[^a-zA-Z0-9_.-]/g, '_' ) +
				'_' + DraftManager.fnv1a( file ) + '-' +
				set.replace( /[^a-zA-Z0-9_.-]/g, '_' ) +
				pageSuffix;
		}

		/**
		 * Build the storage key for the current set and page, or an explicit target context.
		 *
		 * @param {Object|number} [options] Target context options or explicit page number
		 * @return {string} Storage key
		 */
		getStorageKey( options ) {
			let filename;
			let setName;
			let page;
			let wikiScope;
			let userScope;

			if ( typeof options === 'number' ) {
				page = options;
			} else if ( options && typeof options === 'object' ) {
				filename = options.filename;
				setName = options.setName;
				page = options.page;
				wikiScope = options.wikiScope;
				userScope = options.userScope;
			}

			if ( filename === undefined ) {
				filename = this.filename;
			}
			if ( setName === undefined ) {
				setName = ( this.editor && this.editor.stateManager ) ?
					this.editor.stateManager.get( 'currentSetName' ) || '' :
					'';
			}
			if ( page === undefined ) {
				page = ( this.editor && this.editor.page !== undefined ) ?
					this.editor.page :
					1;
			}

			return this.buildStorageKey( filename, setName, page, { wikiScope, userScope } );
		}

		/**
		 * Build the legacy storage key for the current set and page, or an explicit target context.
		 *
		 * @param {Object|number} [options] Target context options or explicit page number
		 * @return {string} Legacy storage key
		 */
		getLegacyStorageKey( options ) {
			let filename;
			let setName;
			let page;
			let userScope;

			if ( typeof options === 'number' ) {
				page = options;
			} else if ( options && typeof options === 'object' ) {
				filename = options.filename;
				setName = options.setName;
				page = options.page;
				userScope = options.userScope;
			}

			if ( filename === undefined ) {
				filename = this.filename;
			}
			if ( setName === undefined ) {
				setName = ( this.editor && this.editor.stateManager ) ?
					this.editor.stateManager.get( 'currentSetName' ) || '' :
					'';
			}
			if ( page === undefined ) {
				page = ( this.editor && this.editor.page !== undefined ) ?
					this.editor.page :
					1;
			}

			return this.buildLegacyStorageKey( filename, setName, page, userScope );
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
				if ( this.lastWriteFailed && !this._saveFailNotified ) {
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
					this.saveDraft();
					if ( this.lastWriteFailed && !this._saveFailNotified ) {
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
			// Distinguish "nothing to save" from "the write failed". Both used to
			// return false, so a clean, freshly-loaded editor told the user their
			// changes might be lost.
			this.lastWriteFailed = false;
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

				const currentSetName = this.editor.stateManager ?
					this.editor.stateManager.get( 'currentSetName' ) || '' :
					'';
				const currentPage = Math.max( 1, parseInt( this.editor.page, 10 ) || 1 );

				serialized = JSON.stringify( {
					version: 2,
					timestamp: Date.now(),
					wikiScope: this.wikiScope,
					userScope: this.userScope,
					filename: this.filename,
					setName: currentSetName,
					page: currentPage,
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
				this.lastWriteFailed = true;
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
		 * Load a draft from localStorage (supporting v2 and validated legacy formats).
		 *
		 * @param {Object|number} [options] Target context options or explicit page number
		 * @return {Object|null} The draft object or null if not found/expired
		 */
		loadDraft( options ) {
			const targetKey = this.getStorageKey( options );
			const legacyKey = this.getLegacyStorageKey( options );

			// Determine target identity tuple
			let targetFilename = this.filename;
			let targetSetName = ( this.editor && this.editor.stateManager ) ?
				this.editor.stateManager.get( 'currentSetName' ) || '' : '';
			let targetPage = ( this.editor && this.editor.page !== undefined ) ?
				Math.max( 1, parseInt( this.editor.page, 10 ) || 1 ) : 1;

			if ( typeof options === 'number' ) {
				targetPage = Math.max( 1, parseInt( options, 10 ) || 1 );
			} else if ( options && typeof options === 'object' ) {
				if ( options.filename !== undefined ) {
					targetFilename = options.filename;
				}
				if ( options.setName !== undefined ) {
					targetSetName = options.setName;
				}
				if ( options.page !== undefined ) {
					targetPage = Math.max( 1, parseInt( options.page, 10 ) || 1 );
				}
			}

			try {
				let stored = localStorage.getItem( targetKey );

				if ( !stored ) {
					// Fallback to legacy key lookup
					const legacyStored = localStorage.getItem( legacyKey );
					if ( legacyStored ) {
						try {
							const legacyDraft = JSON.parse( legacyStored );
							if ( legacyDraft && Array.isArray( legacyDraft.layers ) ) {
								// Check for ambiguity (missing explicit identity fields)
								const hasFilename = legacyDraft.filename !== undefined && legacyDraft.filename !== null;
								const hasSetName = legacyDraft.setName !== undefined && legacyDraft.setName !== null;
								const hasPage = legacyDraft.page !== undefined && legacyDraft.page !== null;

								if ( !hasFilename || !hasSetName ) {
									this.ambiguousLegacyRecord = {
										key: legacyKey,
										draft: legacyDraft
									};
									if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
										mw.log.warn( '[DraftManager] Ambiguous legacy draft missing explicit tuple fields preserved at key:', legacyKey );
									}
									// Do not auto-apply or auto-delete ambiguous record
									return null;
								}

								// Check for mismatch against requested target tuple
								if ( legacyDraft.filename !== targetFilename ||
									legacyDraft.setName !== targetSetName ||
									( hasPage && Number( legacyDraft.page ) !== targetPage )
								) {
									// Identity mismatch; do not apply or delete
									return null;
								}

								// Check age of matching legacy draft
								if ( legacyDraft.timestamp && ( Date.now() - legacyDraft.timestamp ) > MAX_DRAFT_AGE_MS ) {
									localStorage.removeItem( legacyKey );
									return null;
								}

								// Migrate: write to v2 key before removing legacy record
								legacyDraft.version = 2;
								legacyDraft.wikiScope = this.wikiScope;
								legacyDraft.userScope = this.userScope;
								const migratedSerialized = JSON.stringify( legacyDraft );
								try {
									localStorage.setItem( targetKey, migratedSerialized );
									// Successfully written to new key: remove legacy record
									localStorage.removeItem( legacyKey );
									stored = migratedSerialized;
								} catch ( quotaError ) {
									// Quota failure: preserve legacy record, do NOT delete old data
									if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
										mw.log.warn( '[DraftManager] Quota exceeded migrating legacy draft; preserving legacy key' );
									}
									// Allow in-memory recovery
									return legacyDraft;
								}
							} else {
								localStorage.removeItem( legacyKey );
								return null;
							}
						} catch ( parseErr ) {
							localStorage.removeItem( legacyKey );
							return null;
						}
					}
				}

				if ( !stored ) {
					return null;
				}

				const draft = JSON.parse( stored );

				// Check if draft is too old
				if ( draft.timestamp && ( Date.now() - draft.timestamp ) > MAX_DRAFT_AGE_MS ) {
					this.clearDraft( options );
					return null;
				}

				// Validate draft structure
				if ( !draft.layers || !Array.isArray( draft.layers ) ) {
					this.clearDraft( options );
					return null;
				}

				// Verify context match
				if ( !this.matchesCurrentContext( draft, options ) ) {
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
		 * Check that a stored draft belongs to the set and page now being edited.
		 *
		 * @param {Object} draft The parsed draft
		 * @param {Object|number} [options] Expected context options
		 * @return {boolean} True when the draft is safe to apply
		 */
		matchesCurrentContext( draft, options ) {
			let expectedPage = ( this.editor && this.editor.page !== undefined ) ?
				Math.max( 1, parseInt( this.editor.page, 10 ) || 1 ) : 1;
			let expectedSet = ( this.editor && this.editor.stateManager ) ?
				this.editor.stateManager.get( 'currentSetName' ) || '' : '';
			let expectedFilename = this.filename;

			if ( typeof options === 'number' ) {
				expectedPage = Math.max( 1, parseInt( options, 10 ) || 1 );
			} else if ( options && typeof options === 'object' ) {
				if ( options.page !== undefined ) {
					expectedPage = Math.max( 1, parseInt( options.page, 10 ) || 1 );
				}
				if ( options.setName !== undefined ) {
					expectedSet = options.setName;
				}
				if ( options.filename !== undefined ) {
					expectedFilename = options.filename;
				}
			}

			if ( draft.page !== undefined && Number( draft.page ) !== expectedPage ) {
				return false;
			}
			if ( draft.setName !== undefined && String( draft.setName ) !== expectedSet ) {
				return false;
			}
			if ( draft.filename !== undefined ) {
				const normDraft = String( draft.filename ).replace( / /g, '_' );
				const normExpected = String( expectedFilename ).replace( / /g, '_' );
				if ( normDraft !== normExpected ) {
					return false;
				}
			}
			if ( draft.userScope !== undefined && String( draft.userScope ) !== this.userScope ) {
				return false;
			}
			if ( draft.wikiScope !== undefined && String( draft.wikiScope ) !== this.wikiScope ) {
				return false;
			}
			return true;
		}

		/**
		 * Get information about any ambiguous legacy draft record preserved during load.
		 *
		 * @return {Object|null} Ambiguous record info or null
		 */
		getAmbiguousLegacyRecord() {
			return this.ambiguousLegacyRecord;
		}

		/**
		 * Check if a recoverable draft exists
		 *
		 * @param {Object|number} [options] Context options
		 * @return {boolean} True if a valid draft exists
		 */
		hasDraft( options ) {
			const draft = this.loadDraft( options );
			return draft !== null && draft.layers && draft.layers.length > 0;
		}

		/**
		 * Get draft info for display
		 *
		 * @param {Object|number} [options] Context options
		 * @return {Object|null} Draft info or null
		 */
		getDraftInfo( options ) {
			const draft = this.loadDraft( options );
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
		 * Capture the exact stored draft before starting a save. Undefined means
		 * storage could not be read; null means no draft existed.
		 *
		 * @param {Object} options Explicit target identity
		 * @return {string|null|undefined} Stored value
		 */
		captureDraft( options ) {
			try {
				const v2Val = localStorage.getItem( this.getStorageKey( options ) );
				if ( v2Val !== null ) {
					return v2Val;
				}
				return localStorage.getItem( this.getLegacyStorageKey( options ) );
			} catch ( e ) {
				return undefined;
			}
		}

		/**
		 * Clear the stored draft for the current context or an explicit target.
		 *
		 * @param {Object|number} [options] Target context options or explicit page number
		 * @param {string} [options.filename] Explicit filename
		 * @param {string} [options.setName] Explicit set name
		 * @param {number|string} [options.page] Explicit page number
		 * @param {number} [options.maxTimestamp] Only delete if stored draft timestamp <= maxTimestamp
		 * @param {string|null} [options.expectedDraft] Delete only this exact previously captured value
		 */
		clearDraft( options ) {
			if ( !this.isStorageAvailable() ) {
				return;
			}

			try {
				const targetKey = this.getStorageKey( options );
				const legacyKey = this.getLegacyStorageKey( options );

				if ( options && Object.prototype.hasOwnProperty.call( options, 'expectedDraft' ) ) {
					const actual = localStorage.getItem( targetKey ) ?? localStorage.getItem( legacyKey );
					if ( options.expectedDraft === undefined || actual !== options.expectedDraft ) {
						return;
					}
				}

				if ( options && typeof options === 'object' && typeof options.maxTimestamp === 'number' ) {
					const existing = localStorage.getItem( targetKey ) ?? localStorage.getItem( legacyKey );
					if ( existing ) {
						try {
							const parsed = JSON.parse( existing );
							if ( parsed && typeof parsed.timestamp === 'number' && parsed.timestamp > options.maxTimestamp ) {
								// In-flight race protection: a newer draft was written
								// while the earlier save was in flight. Retain it.
								if ( typeof mw !== 'undefined' && mw.log ) {
									mw.log( '[DraftManager] Preserving newer draft created while save was in flight' );
								}
								return;
							}
						} catch ( parseError ) {
							// Unparseable draft can be safely removed
						}
					}
				}

				localStorage.removeItem( targetKey );

				// Clean matching legacy key if present (do not delete ambiguous or mismatched records)
				const legacyItem = localStorage.getItem( legacyKey );
				if ( legacyItem ) {
					try {
						const parsedLegacy = JSON.parse( legacyItem );
						if ( parsedLegacy && parsedLegacy.filename !== undefined && parsedLegacy.setName !== undefined ) {
							let targetFilename = this.filename;
							let targetSetName = ( this.editor && this.editor.stateManager ) ?
								this.editor.stateManager.get( 'currentSetName' ) || '' : '';
							let targetPage = ( this.editor && this.editor.page !== undefined ) ?
								Math.max( 1, parseInt( this.editor.page, 10 ) || 1 ) : 1;

							if ( typeof options === 'number' ) {
								targetPage = Math.max( 1, parseInt( options, 10 ) || 1 );
							} else if ( options && typeof options === 'object' ) {
								if ( options.filename !== undefined ) {
									targetFilename = options.filename;
								}
								if ( options.setName !== undefined ) {
									targetSetName = options.setName;
								}
								if ( options.page !== undefined ) {
									targetPage = Math.max( 1, parseInt( options.page, 10 ) || 1 );
								}
							}

							if ( parsedLegacy.filename === targetFilename &&
								parsedLegacy.setName === targetSetName &&
								( parsedLegacy.page === undefined || Number( parsedLegacy.page ) === targetPage )
							) {
								localStorage.removeItem( legacyKey );
							}
						}
					} catch ( e ) {
						localStorage.removeItem( legacyKey );
					}
				}

				if ( typeof mw !== 'undefined' && mw.log ) {
					mw.log( '[DraftManager] Draft cleared for key:', targetKey );
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
				// en.json uses $1/$2; the code substituted {time}/{count}, so the real
				// message reached the user with its placeholders intact.
				const message = getMessage( 'layers-draft-recovery-message',
					'Found unsaved changes from $1 with $2 layer(s). Would you like to recover them?' )
					.replace( '$1', timeStr )
					.replace( '$2', String( draftInfo.layerCount ) );
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
		 *
		 * @param {Object|number} [options] Target context options or explicit page number
		 */
		onSaveSuccess( options ) {
			this.clearDraft( options );
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
			this.ambiguousLegacyRecord = null;
		}
	}

	// Export to namespace
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.DraftManager = DraftManager;

	// Legacy global export
	window.DraftManager = DraftManager;

} )();
