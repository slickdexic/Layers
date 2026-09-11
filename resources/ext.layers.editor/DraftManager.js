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
			this.legacyNoticeElement = null;
			this.legacyOverlayElement = null;
			this.legacyDialogElement = null;
			this.legacyDialogKeyHandler = null;
			this.previousDialogFocus = null;

			this.initialize();
		}

		/**
		 * Identify the current wiki for draft key scoping.
		 *
		 * Standardizes discovery on MediaWiki's canonical wgWikiID (WikiMap::getCurrentWikiId(),
		 * e.g. 'my_wiki-T01') with fallback to wgDBname and table prefix wgDBprefix.
		 * For multiple wikis sharing an origin with different script paths, appends
		 * wgScriptPath (e.g. 'my_wiki-T01:/wiki2') to guarantee origin-isolated scoping.
		 *
		 * @return {string} Stable wiki identifier ('default' when unknown)
		 */
		static getWikiScope() {
			if ( typeof mw === 'undefined' || !mw.config || !mw.config.get ) {
				return 'default';
			}
			const wikiId = mw.config.get( 'wgWikiID' ) || mw.config.get( 'wgWikiId' );
			let scope;
			if ( wikiId ) {
				scope = String( wikiId );
			} else {
				const dbName = mw.config.get( 'wgDBname' ) || 'default';
				const dbPrefix = mw.config.get( 'wgDBprefix' );
				scope = ( dbPrefix && dbName !== 'default' ) ? dbName + '-' + dbPrefix : dbName;
			}
			const scriptPath = mw.config.get( 'wgScriptPath' );
			if ( scriptPath && typeof scriptPath === 'string' && scriptPath !== '' && scriptPath !== '/' ) {
				scope = scope + ':' + scriptPath;
			}
			return scope;
		}

		/**
		 * Get candidate wiki scopes for discovering drafts created under prior branches.
		 *
		 * @return {string[]} Array of candidate wiki scopes
		 */
		static getCandidateWikiScopes() {
			const scopes = [];
			const current = DraftManager.getWikiScope();
			scopes.push( current );

			if ( typeof mw !== 'undefined' && mw.config && mw.config.get ) {
				const wikiId = mw.config.get( 'wgWikiID' ) || mw.config.get( 'wgWikiId' );
				if ( wikiId && !scopes.includes( String( wikiId ) ) ) {
					scopes.push( String( wikiId ) );
				}
				const dbName = mw.config.get( 'wgDBname' );
				if ( dbName ) {
					const dbStr = String( dbName );
					if ( !scopes.includes( dbStr ) ) {
						scopes.push( dbStr );
					}
					const dbPrefix = mw.config.get( 'wgDBprefix' );
					if ( dbPrefix ) {
						const prefixed = dbStr + '-' + String( dbPrefix );
						if ( !scopes.includes( prefixed ) ) {
							scopes.push( prefixed );
						}
					}
				}
			}

			if ( !scopes.includes( 'default' ) ) {
				scopes.push( 'default' );
			}
			return scopes;
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
		 * Validates tuple types strictly: 5 elements, all strings except page which
		 * must be an integer >= 1.
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
				if ( Array.isArray( tuple ) && tuple.length === 5 &&
					typeof tuple[ 0 ] === 'string' && tuple[ 0 ].length > 0 &&
					typeof tuple[ 1 ] === 'string' && tuple[ 1 ].length > 0 &&
					typeof tuple[ 2 ] === 'string' &&
					typeof tuple[ 3 ] === 'string' &&
					Number.isInteger( tuple[ 4 ] ) && tuple[ 4 ] >= 1
				) {
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
			if ( this.editor.stateManager && typeof this.editor.stateManager.subscribe === 'function' ) {
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
			this.ambiguousLegacyRecord = null;
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

				// Candidate wiki scope lookup fallback for prior review branch keys
				if ( !stored && ( !options || options.wikiScope === undefined ) ) {
					const candidateScopes = DraftManager.getCandidateWikiScopes();
					for ( let i = 0; i < candidateScopes.length; i++ ) {
						const cand = candidateScopes[ i ];
						if ( cand === this.wikiScope ) {
							continue;
						}
						const candKey = this.buildStorageKey( targetFilename, targetSetName, targetPage, {
							wikiScope: cand,
							userScope: this.userScope
						} );
						const candStored = localStorage.getItem( candKey );
						if ( candStored ) {
							stored = candStored;
							break;
						}
					}
				}

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

								if ( !hasFilename || !hasSetName || !hasPage ||
									legacyDraft.wikiScope !== this.wikiScope ||
									legacyDraft.userScope !== this.userScope ) {
									this.recordLegacyDraft( legacyKey, legacyStored, {
										targetFilename,
										targetSetName,
										targetPage
									} );
									if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
										mw.log.warn( '[DraftManager] Ambiguous legacy draft missing explicit tuple fields preserved at key:', legacyKey );
									}
									// Legacy records normally have no wiki identity. Never infer it.
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
								this.recordLegacyDraft( legacyKey, legacyStored, {
									targetFilename,
									targetSetName,
									targetPage
								} );
								return null;
							}
						} catch ( parseErr ) {
							this.recordLegacyDraft( legacyKey, legacyStored, {
								targetFilename,
								targetSetName,
								targetPage
							} );
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
			// Exact filename equality; no normalizing spaces to underscores or vice-versa
			if ( draft.filename !== undefined && String( draft.filename ) !== String( expectedFilename ) ) {
				return false;
			}
			if ( draft.userScope !== undefined && String( draft.userScope ) !== this.userScope ) {
				return false;
			}
			if ( draft.wikiScope !== undefined &&
				String( draft.wikiScope ) !== this.wikiScope &&
				!DraftManager.getCandidateWikiScopes().includes( String( draft.wikiScope ) )
			) {
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
				return localStorage.getItem( this.getStorageKey( options ) );
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

				if ( options && Object.prototype.hasOwnProperty.call( options, 'expectedDraft' ) ) {
					const actual = localStorage.getItem( targetKey );
					if ( options.expectedDraft === undefined || actual !== options.expectedDraft ) {
						return;
					}
				}

				if ( options && typeof options === 'object' && typeof options.maxTimestamp === 'number' ) {
					const existing = localStorage.getItem( targetKey );
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

				// Legacy records are preserved; their wiki ownership may be unknown.

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
		 * Retrieve a localized message text with a fallback.
		 *
		 * @param {string} key Message key
		 * @param {string} fallback Fallback text
		 * @return {string} Message text
		 */
		getMessage( key, fallback ) {
			if ( typeof mw !== 'undefined' && mw.message ) {
				const msg = mw.message( key );
				if ( msg && typeof msg.exists === 'function' && msg.exists() ) {
					return msg.text();
				}
				if ( msg && typeof msg.text === 'function' ) {
					const text = msg.text();
					if ( text && text !== key ) {
						return text;
					}
				}
			}
			return fallback || '';
		}

		/**
		 * Record a detected legacy draft for manual review and recovery.
		 *
		 * @param {string} key Storage key of the legacy record
		 * @param {string} rawString Raw string from localStorage
		 * @param {Object} [context] Optional target context
		 * @return {Object} The recorded legacy info
		 */
		recordLegacyDraft( key, rawString, context ) {
			let parsed = null;
			let isMalformed = false;
			try {
				parsed = JSON.parse( rawString );
				if ( !parsed || typeof parsed !== 'object' || !Array.isArray( parsed.layers ) ) {
					isMalformed = true;
				}
			} catch ( e ) {
				isMalformed = true;
			}

			this.ambiguousLegacyRecord = {
				key: key,
				raw: rawString,
				draft: parsed,
				isMalformed: isMalformed,
				context: context || null
			};

			return this.ambiguousLegacyRecord;
		}

		/**
		 * Detect whether an unscoped legacy draft exists in storage.
		 *
		 * @param {Object|number} [options] Target context options
		 * @return {Object|null} The recorded legacy draft or null
		 */
		detectLegacyDraft( options ) {
			if ( typeof localStorage === 'undefined' || !localStorage ||
				typeof localStorage.getItem !== 'function'
			) {
				return null;
			}
			const legacyKey = this.getLegacyStorageKey( options );
			try {
				const legacyStored = localStorage.getItem( legacyKey );
				if ( legacyStored !== null && legacyStored !== undefined ) {
					return this.recordLegacyDraft( legacyKey, legacyStored );
				}
			} catch ( e ) {
				// Storage access error
			}
			return null;
		}

		/**
		 * Check if an unscoped or ambiguous legacy draft exists.
		 *
		 * @param {Object|number} [options] Target context options
		 * @return {boolean} True if a legacy draft exists
		 */
		hasLegacyDraft( options ) {
			if ( this.ambiguousLegacyRecord ) {
				return true;
			}
			return this.detectLegacyDraft( options ) !== null;
		}

		/**
		 * Show a localized, keyboard-accessible banner notice for preserved legacy draft.
		 *
		 * @param {Object} [record] Optional legacy record override
		 * @return {HTMLElement|null} The notice element, or null if no record
		 */
		showLegacyNotice( record ) {
			const rec = record || this.ambiguousLegacyRecord || this.detectLegacyDraft();
			if ( !rec ) {
				return null;
			}

			// Dismiss any existing notice first
			this.dismissLegacyNotice();

			if ( typeof document === 'undefined' || !document.createElement ) {
				return null;
			}

			const notice = document.createElement( 'div' );
			notice.className = 'layers-legacy-draft-notice';
			notice.setAttribute( 'role', 'status' );
			notice.setAttribute( 'aria-live', 'polite' );

			const textSpan = document.createElement( 'span' );
			textSpan.className = 'layers-legacy-draft-notice-text';
			textSpan.textContent = this.getMessage(
				'layers-legacy-draft-notice',
				'Found a preserved legacy draft for this image from an earlier version.'
			);
			notice.appendChild( textSpan );

			const actions = document.createElement( 'div' );
			actions.className = 'layers-legacy-draft-notice-actions';

			const reviewBtn = document.createElement( 'button' );
			reviewBtn.type = 'button';
			reviewBtn.className = 'layers-btn layers-btn-primary layers-legacy-review-btn';
			reviewBtn.textContent = this.getMessage(
				'layers-legacy-draft-review',
				'Review & Recover'
			);
			reviewBtn.addEventListener( 'click', () => {
				this.showLegacyRecoveryDialog( rec );
			} );

			const dismissBtn = document.createElement( 'button' );
			dismissBtn.type = 'button';
			dismissBtn.className = 'layers-btn layers-btn-secondary layers-legacy-dismiss-btn';
			dismissBtn.textContent = this.getMessage(
				'layers-legacy-draft-dismiss',
				'Dismiss'
			);
			dismissBtn.addEventListener( 'click', () => {
				this.dismissLegacyNotice();
			} );

			actions.appendChild( reviewBtn );
			actions.appendChild( dismissBtn );
			notice.appendChild( actions );

			// Keyboard handler for notice: Escape dismisses notice
			notice.addEventListener( 'keydown', ( e ) => {
				if ( e.key === 'Escape' ) {
					this.dismissLegacyNotice();
				}
			} );

			// Mount notice
			let mounted = false;
			if ( this.editor && this.editor.uiManager && this.editor.uiManager.container ) {
				const container = this.editor.uiManager.container;
				if ( container.firstChild ) {
					container.insertBefore( notice, container.firstChild );
				} else {
					container.appendChild( notice );
				}
				mounted = true;
			}
			if ( !mounted && document.body ) {
				document.body.appendChild( notice );
			}

			this.legacyNoticeElement = notice;
			return notice;
		}

		/**
		 * Dismiss the legacy draft notice.
		 */
		dismissLegacyNotice() {
			if ( this.legacyNoticeElement ) {
				if ( this.legacyNoticeElement.parentNode ) {
					this.legacyNoticeElement.parentNode.removeChild( this.legacyNoticeElement );
				}
				this.legacyNoticeElement = null;
			}
		}

		/**
		 * Show the explicit local export & recovery dialog for preserved legacy draft.
		 *
		 * @param {Object} [record] Legacy record
		 * @return {HTMLElement|null} The dialog element
		 */
		showLegacyRecoveryDialog( record ) {
			const rec = record || this.ambiguousLegacyRecord || this.detectLegacyDraft();
			if ( !rec ) {
				return null;
			}

			this.closeLegacyRecoveryDialog();

			if ( typeof document === 'undefined' || !document.createElement ) {
				return null;
			}

			// Capture focus origin
			if ( document.activeElement &&
				document.activeElement !== document.body &&
				typeof document.activeElement.focus === 'function'
			) {
				this.previousDialogFocus = document.activeElement;
			} else {
				this.previousDialogFocus = null;
			}

			const overlay = document.createElement( 'div' );
			overlay.className = 'layers-modal-overlay layers-legacy-dialog-overlay';

			const dialog = document.createElement( 'div' );
			dialog.className = 'layers-modal-dialog layers-legacy-dialog';
			dialog.setAttribute( 'role', 'dialog' );
			dialog.setAttribute( 'aria-modal', 'true' );
			dialog.setAttribute( 'aria-labelledby', 'layers-legacy-dialog-title' );

			const title = document.createElement( 'h2' );
			title.id = 'layers-legacy-dialog-title';
			title.className = 'layers-legacy-dialog-title';
			title.textContent = this.getMessage(
				'layers-legacy-draft-dialog-title',
				'Preserved Legacy Draft Recovery'
			);
			dialog.appendChild( title );

			const desc = document.createElement( 'p' );
			desc.className = 'layers-legacy-dialog-desc';
			desc.textContent = this.getMessage(
				'layers-legacy-draft-dialog-desc',
				'This draft was created before wiki scoping was introduced. Verify the metadata below before recovering into your current set. The original draft will remain preserved in your browser.'
			);
			dialog.appendChild( desc );

			// Warning banner: unscoped wiki
			const warning = document.createElement( 'div' );
			warning.className = 'layers-legacy-warning';
			warning.setAttribute( 'role', 'note' );
			warning.textContent = this.getMessage(
				'layers-legacy-draft-unscoped-warning',
				'Note: This draft has no verified wiki ownership.'
			);
			dialog.appendChild( warning );

			// Metadata container (escaped text via textContent only)
			const metaContainer = document.createElement( 'div' );
			metaContainer.className = 'layers-legacy-metadata';

			const draftObj = rec.draft;
			const isMalformed = rec.isMalformed || !draftObj;

			const metaFilename = document.createElement( 'div' );
			metaFilename.className = 'layers-legacy-meta-row';
			const metaFilenameLabel = document.createElement( 'strong' );
			metaFilenameLabel.textContent = 'File: ';
			metaFilename.appendChild( metaFilenameLabel );
			const metaFilenameVal = document.createElement( 'span' );
			metaFilenameVal.className = 'layers-legacy-meta-filename';
			metaFilenameVal.textContent = ( draftObj && draftObj.filename !== undefined && draftObj.filename !== null ) ?
				String( draftObj.filename ) : ( this.filename || 'Unknown' );
			metaFilename.appendChild( metaFilenameVal );
			metaContainer.appendChild( metaFilename );

			const metaSet = document.createElement( 'div' );
			metaSet.className = 'layers-legacy-meta-row';
			const metaSetLabel = document.createElement( 'strong' );
			metaSetLabel.textContent = 'Set: ';
			metaSet.appendChild( metaSetLabel );
			const metaSetVal = document.createElement( 'span' );
			metaSetVal.className = 'layers-legacy-meta-set';
			metaSetVal.textContent = ( draftObj && draftObj.setName !== undefined && draftObj.setName !== null ) ?
				String( draftObj.setName ) : 'Unknown';
			metaSet.appendChild( metaSetVal );
			metaContainer.appendChild( metaSet );

			const metaPage = document.createElement( 'div' );
			metaPage.className = 'layers-legacy-meta-row';
			const metaPageLabel = document.createElement( 'strong' );
			metaPageLabel.textContent = 'Page: ';
			metaPage.appendChild( metaPageLabel );
			const metaPageVal = document.createElement( 'span' );
			metaPageVal.className = 'layers-legacy-meta-page';
			metaPageVal.textContent = ( draftObj && draftObj.page !== undefined && draftObj.page !== null ) ?
				String( draftObj.page ) : 'Unknown';
			metaPage.appendChild( metaPageVal );
			metaContainer.appendChild( metaPage );

			const metaTime = document.createElement( 'div' );
			metaTime.className = 'layers-legacy-meta-row';
			const metaTimeLabel = document.createElement( 'strong' );
			metaTimeLabel.textContent = 'Saved: ';
			metaTime.appendChild( metaTimeLabel );
			const metaTimeVal = document.createElement( 'span' );
			metaTimeVal.className = 'layers-legacy-meta-time';
			metaTimeVal.textContent = ( draftObj && draftObj.timestamp ) ?
				new Date( draftObj.timestamp ).toLocaleString() : 'Unknown';
			metaTime.appendChild( metaTimeVal );
			metaContainer.appendChild( metaTime );

			if ( isMalformed ) {
				const malformedNotice = document.createElement( 'div' );
				malformedNotice.className = 'layers-legacy-malformed-warning';
				malformedNotice.textContent = this.getMessage(
					'layers-legacy-draft-malformed',
					'This draft record contains invalid or unparseable JSON data. It cannot be imported, but you may still export the raw data.'
				);
				metaContainer.appendChild( malformedNotice );
			} else {
				const metaLayers = document.createElement( 'div' );
				metaLayers.className = 'layers-legacy-meta-row';
				const metaLayersLabel = document.createElement( 'strong' );
				metaLayersLabel.textContent = 'Layers: ';
				metaLayers.appendChild( metaLayersLabel );
				const metaLayersVal = document.createElement( 'span' );
				metaLayersVal.className = 'layers-legacy-meta-layers';
				metaLayersVal.textContent = Array.isArray( draftObj.layers ) ?
					String( draftObj.layers.length ) : '0';
				metaLayers.appendChild( metaLayersVal );
				metaContainer.appendChild( metaLayers );
			}

			dialog.appendChild( metaContainer );

			// Actions
			const actions = document.createElement( 'div' );
			actions.className = 'layers-modal-buttons layers-legacy-dialog-actions';

			const exportBtn = document.createElement( 'button' );
			exportBtn.type = 'button';
			exportBtn.className = 'layers-btn layers-btn-secondary layers-legacy-export-btn';
			exportBtn.textContent = this.getMessage(
				'layers-legacy-draft-export',
				'Export Original (JSON)'
			);
			exportBtn.addEventListener( 'click', () => {
				this.exportLegacyRecord( rec );
			} );
			actions.appendChild( exportBtn );

			const importBtn = document.createElement( 'button' );
			importBtn.type = 'button';
			importBtn.className = 'layers-btn layers-btn-primary layers-legacy-import-btn';
			importBtn.textContent = this.getMessage(
				'layers-legacy-draft-import',
				'Import into Current Set'
			);

			const canImport = !isMalformed && draftObj && Array.isArray( draftObj.layers ) && draftObj.layers.length > 0;
			if ( !canImport ) {
				importBtn.disabled = true;
				importBtn.setAttribute( 'aria-disabled', 'true' );
			} else {
				importBtn.addEventListener( 'click', () => {
					this.importLegacyRecord( rec );
					this.closeLegacyRecoveryDialog();
					this.dismissLegacyNotice();
				} );
			}
			actions.appendChild( importBtn );

			const closeBtn = document.createElement( 'button' );
			closeBtn.type = 'button';
			closeBtn.className = 'layers-btn layers-btn-secondary layers-legacy-close-btn';
			closeBtn.textContent = this.getMessage(
				'layers-legacy-draft-close',
				'Close'
			);
			closeBtn.addEventListener( 'click', () => {
				this.closeLegacyRecoveryDialog();
			} );
			actions.appendChild( closeBtn );

			dialog.appendChild( actions );

			// Keyboard handler: Tab trap and Escape to close
			const keyHandler = ( e ) => {
				if ( e.key === 'Escape' ) {
					this.closeLegacyRecoveryDialog();
				} else if ( e.key === 'Tab' ) {
					const focusable = dialog.querySelectorAll( 'button:not([disabled]), [tabindex]:not([tabindex="-1"])' );
					if ( focusable.length > 0 ) {
						const first = focusable[ 0 ];
						const last = focusable[ focusable.length - 1 ];
						if ( e.shiftKey && document.activeElement === first ) {
							e.preventDefault();
							last.focus();
						} else if ( !e.shiftKey && document.activeElement === last ) {
							e.preventDefault();
							first.focus();
						}
					}
				}
			};
			document.addEventListener( 'keydown', keyHandler );
			this.legacyDialogKeyHandler = keyHandler;

			if ( document.body ) {
				document.body.appendChild( overlay );
				document.body.appendChild( dialog );
			}

			this.legacyOverlayElement = overlay;
			this.legacyDialogElement = dialog;

			// Focus initial button
			if ( exportBtn && typeof exportBtn.focus === 'function' ) {
				exportBtn.focus();
			}

			return dialog;
		}

		/**
		 * Close the legacy recovery dialog and restore focus.
		 */
		closeLegacyRecoveryDialog() {
			if ( this.legacyDialogKeyHandler ) {
				document.removeEventListener( 'keydown', this.legacyDialogKeyHandler );
				this.legacyDialogKeyHandler = null;
			}
			if ( this.legacyOverlayElement && this.legacyOverlayElement.parentNode ) {
				this.legacyOverlayElement.parentNode.removeChild( this.legacyOverlayElement );
			}
			if ( this.legacyDialogElement && this.legacyDialogElement.parentNode ) {
				this.legacyDialogElement.parentNode.removeChild( this.legacyDialogElement );
			}
			this.legacyOverlayElement = null;
			this.legacyDialogElement = null;

			if ( this.previousDialogFocus && typeof this.previousDialogFocus.focus === 'function' ) {
				if ( typeof document !== 'undefined' && document.body && document.body.contains( this.previousDialogFocus ) ) {
					this.previousDialogFocus.focus();
				}
				this.previousDialogFocus = null;
			}
		}

		/**
		 * Export raw legacy record bytes as a client-side JSON download.
		 * Never logs annotation content or transmits to any server.
		 *
		 * @param {Object} record Legacy draft record
		 * @return {boolean} True if export was initiated
		 */
		exportLegacyRecord( record ) {
			if ( !record || ( record.raw === undefined && record.draft === undefined ) ) {
				return false;
			}
			const rawContent = ( typeof record.raw === 'string' ) ?
				record.raw :
				JSON.stringify( record.draft, null, 2 );

			try {
				let blob;
				if ( typeof Blob !== 'undefined' ) {
					blob = new Blob( [ rawContent ], { type: 'application/json;charset=utf-8' } );
				} else {
					blob = { content: rawContent, type: 'application/json;charset=utf-8' };
				}

				if ( typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' &&
					typeof document !== 'undefined' && typeof document.createElement === 'function'
				) {
					const url = URL.createObjectURL( blob );
					const a = document.createElement( 'a' );
					a.style.display = 'none';
					a.href = url;
					const safeName = ( this.filename || 'export' ).replace( /[^a-zA-Z0-9_.-]/g, '_' );
					a.download = 'layers-legacy-draft-' + safeName + '.json';
					document.body.appendChild( a );
					a.click();
					setTimeout( () => {
						if ( a.parentNode ) {
							a.parentNode.removeChild( a );
						}
						if ( typeof URL.revokeObjectURL === 'function' ) {
							URL.revokeObjectURL( url );
						}
					}, 100 );
				}

				return true;
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
					mw.log.warn( '[DraftManager] Export failed:', e.message );
				}
				return false;
			}
		}

		/**
		 * Manually import a legacy draft record into the current active editor set.
		 * Validates layers, marks editor dirty, updates canvas and panel,
		 * and never auto-publishes or removes the legacy record.
		 *
		 * @param {Object} record Legacy draft record
		 * @return {boolean} True if imported successfully
		 */
		importLegacyRecord( record ) {
			if ( !record || record.isMalformed || !record.draft || !Array.isArray( record.draft.layers ) ) {
				return false;
			}

			let layersToImport = null;

			// Boundary validation: Use ImportExportManager if available
			if ( this.editor && this.editor.importExportManager &&
				typeof this.editor.importExportManager.parseLayersJSON === 'function' &&
				typeof record.raw === 'string'
			) {
				try {
					layersToImport = this.editor.importExportManager.parseLayersJSON( record.raw );
				} catch ( e ) {
					layersToImport = null;
				}
			}

			if ( !layersToImport ) {
				// Sanitized fallback validation
				const validTypes = [
					'text', 'textbox', 'callout', 'arrow', 'rectangle', 'circle', 'ellipse',
					'polygon', 'star', 'line', 'path', 'blur', 'image', 'group', 'customShape',
					'marker', 'dimension', 'angleDimension'
				];
				layersToImport = record.draft.layers.map( ( layer ) => {
					const obj = { ...layer };
					if ( !obj.id ) {
						obj.id = 'layer_' + Date.now() + '_' + Math.random().toString( 36 ).slice( 2, 9 );
					}
					if ( obj.type && !validTypes.includes( obj.type ) ) {
						obj.type = 'rectangle';
					}
					if ( typeof obj.text === 'string' ) {
						obj.text = obj.text.replace( /<[^>]*>/g, '' );
					}
					if ( typeof obj.name === 'string' ) {
						obj.name = obj.name.replace( /<[^>]*>/g, '' );
					}
					delete obj.__proto__;
					delete obj.constructor;
					return obj;
				} );
			}

			if ( !Array.isArray( layersToImport ) || layersToImport.length === 0 ) {
				return false;
			}

			this.isRecoveryMode = true;
			try {
				if ( this.editor && this.editor.stateManager ) {
					this.editor.stateManager.update( {
						layers: layersToImport,
						isDirty: true
					} );
				} else if ( this.editor ) {
					this.editor.layers = layersToImport;
				}

				if ( this.editor && typeof this.editor.markDirty === 'function' ) {
					this.editor.markDirty();
				}

				if ( this.editor && this.editor.canvasManager &&
					typeof this.editor.canvasManager.renderLayers === 'function'
				) {
					this.editor.canvasManager.renderLayers( layersToImport );
				}

				if ( this.editor && this.editor.layerPanel &&
					typeof this.editor.layerPanel.updateLayers === 'function'
				) {
					this.editor.layerPanel.updateLayers( layersToImport );
				}

				if ( typeof mw !== 'undefined' && mw.notify ) {
					mw.notify(
						this.getMessage(
							'layers-legacy-draft-imported',
							'Legacy draft imported into current set. Changes are not published until saved.'
						),
						{ type: 'success' }
					);
				}

				return true;
			} catch ( e ) {
				if ( typeof mw !== 'undefined' && mw.log && mw.log.error ) {
					mw.log.error( '[DraftManager] Failed to import legacy draft:', e.message );
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

				const title = this.getMessage( 'layers-draft-recovery-title', 'Recover Unsaved Changes?' );
				// en.json uses $1/$2; the code substituted {time}/{count}, so the real
				// message reached the user with its placeholders intact.
				const message = this.getMessage( 'layers-draft-recovery-message',
					'Found unsaved changes from $1 with $2 layer(s). Would you like to recover them?' )
					.replace( '$1', timeStr )
					.replace( '$2', String( draftInfo.layerCount ) );
				const recoverBtn = this.getMessage( 'layers-draft-recover', 'Recover' );
				const discardBtn = this.getMessage( 'layers-draft-discard', 'Discard' );

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
			if ( this.hasDraft() ) {
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
					// User chose to discard v2 draft
					this.clearDraft();
					if ( this.hasLegacyDraft() ) {
						this.showLegacyNotice();
					}
					return false;
				}
			}

			// If no current v2 draft, check for preserved legacy draft
			if ( this.hasLegacyDraft() ) {
				this.showLegacyNotice();
				return false;
			}

			return false;
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

			this.dismissLegacyNotice();
			this.closeLegacyRecoveryDialog();

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
