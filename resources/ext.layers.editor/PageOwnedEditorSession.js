/**
 * One owner/revision/surface editing session. No legacy storage or automatic retry.
 * The UI owns draft persistence and deliberate conflict reconciliation.
 */
( function () {
	'use strict';

	function failure( code ) {
		const error = new Error( code );
		error.code = code;
		return error;
	}

	// Snapshots have already passed finite-JSON copying; object key order is not a content change.
	function comparable( value ) {
		if ( Array.isArray( value ) ) {
			return '[' + value.map( comparable ).join( ',' ) + ']';
		}
		if ( value && typeof value === 'object' ) {
			return '{' + Object.keys( value ).sort().map( ( key ) =>
				JSON.stringify( key ) + ':' + comparable( value[ key ] ) ).join( ',' ) + '}';
		}
		return JSON.stringify( value );
	}

	class PageOwnedEditorSession {
		/**
		 * @param {Object} options Immutable owner, revisionId, surfaceId and optional pageId/readOnly
		 * @param {Object} dependencies Accepted reader, publisher and snapshot adapter
		 */
		constructor( options, dependencies ) {
			if ( !options || typeof options.owner !== 'string' || !options.owner.trim() ||
				typeof options.surfaceId !== 'string' || !options.surfaceId ||
				!Number.isInteger( options.revisionId ) || options.revisionId < 1 ||
				options.revisionId > 2147483647 ||
				( options.pageId !== undefined && ( !Number.isInteger( options.pageId ) ||
					options.pageId < 1 || options.pageId > 2147483647 ) ) ||
				( options.readOnly !== undefined && typeof options.readOnly !== 'boolean' ) ||
				!dependencies || !dependencies.reader || typeof dependencies.reader.read !== 'function' ||
				!dependencies.publisher || typeof dependencies.publisher.publish !== 'function' ||
				!dependencies.adapter || typeof dependencies.adapter.toEditorState !== 'function' ||
				typeof dependencies.adapter.withEditorState !== 'function' ) {
				throw failure( 'layers-invalid-editor-session' );
			}
			this._owner = options.owner;
			this._pageId = options.pageId;
			this._surfaceId = options.surfaceId;
			this._revisionId = options.revisionId;
			this._readOnly = options.readOnly === true;
			this._reader = dependencies.reader;
			this._publisher = dependencies.publisher;
			this._adapter = dependencies.adapter;
			this._phase = 'unloaded';
			this._snapshot = null;
			this._savedJson = null;
			this._reconciling = false;
		}

		/** @return {Promise<Object>} Initial editor state; never refreshes over a draft */
		async load() {
			if ( this._phase !== 'unloaded' ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._phase = 'loading';
			try {
				const bundle = await this._reader.read( {
					owner: this._owner, revisionId: this._revisionId
				} );
				if ( this._phase === 'disposed' ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				if ( bundle.revisionId !== this._revisionId ) {
					throw failure( 'layers-invalid-read-response' );
				}
				const state = this._adapter.toEditorState( bundle.snapshot, this._surfaceId );
				this._snapshot = this._adapter.withEditorState( bundle.snapshot, this._surfaceId, state );
				this._savedJson = JSON.stringify( this._snapshot );
				this._phase = 'ready';
				return state;
			} catch ( error ) {
				if ( this._phase !== 'disposed' ) {
					this._phase = 'unloaded';
				}
				throw error;
			}
		}

		/** @return {Promise<void>} Recheck revision visibility/source access before applying local recovery */
		async revalidate() {
			this._requireLoaded();
			if ( this._phase !== 'ready' || this._reconciling ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const bundle = await this._reader.read( { owner: this._owner, revisionId: this._revisionId } );
			this._requireLoaded();
			if ( this._phase !== 'ready' || bundle.revisionId !== this._revisionId ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}

		/** @return {Object} Isolated copy for rendering */
		getEditorState() {
			this._requireLoaded();
			return this._adapter.toEditorState( this._snapshot, this._surfaceId );
		}

		/**
		 * Accept edits even while saving or resolving a conflict; never overwrite them on completion.
		 * @param {Object} state Exact canvas/layers pair
		 */
		update( state ) {
			this._requireLoaded();
			if ( this._readOnly ) {
				throw failure( 'layers-editor-read-only' );
			}
			this._snapshot = this._adapter.withEditorState( this._snapshot, this._surfaceId, state );
		}

		/** @return {Object} Draft envelope; returned objects share no mutable references */
		getDraft() {
			this._requireLoaded();
			return {
				owner: this._owner,
				baseRevisionId: this._revisionId,
				surfaceId: this._surfaceId,
				snapshot: this._adapter.withEditorState( this._snapshot, this._surfaceId, this.getEditorState() )
			};
		}

		/** @return {Object} UI state; conflict/uncertain requires explicit reconciliation */
		getStatus() {
			return {
				phase: this._phase,
				revisionId: this._revisionId,
				readOnly: this._readOnly,
				dirty: this._snapshot !== null && comparable( this._snapshot ) !== comparable( JSON.parse( this._savedJson ) )
			};
		}

		/**
		 * @param {string} summary Page-history edit summary
		 * @param {Function} [beforePublish] Persist the saving-phase draft before any POST
		 * @return {Promise<Object>} Confirmed revision and current dirty state
		 */
		async save( summary = '', beforePublish ) {
			this._requireLoaded();
			if ( this._readOnly ) {
				throw failure( 'layers-editor-read-only' );
			}
			if ( this._phase !== 'ready' || this._reconciling ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			if ( typeof summary !== 'string' || ( beforePublish !== undefined && typeof beforePublish !== 'function' ) ) {
				throw failure( 'layers-invalid-publication-request' );
			}
			const snapshotJson = JSON.stringify( this._snapshot );
			this._phase = 'saving';
			try {
				if ( beforePublish ) {
					try {
						await beforePublish();
					} catch ( error ) {
						throw failure( 'layers-draft-storage-failed' );
					}
					if ( this._phase === 'disposed' ) {
						throw failure( 'layers-editor-session-unavailable' );
					}
				}
				const request = {
					owner: this._owner, baseRevisionId: this._revisionId, snapshotJson, summary
				};
				if ( this._pageId !== undefined ) {
					request.pageId = this._pageId;
				}
				const result = await this._publisher.publish( request );
				if ( this._phase === 'disposed' ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				if ( !result || !Number.isInteger( result.revisionId ) ||
					result.revisionId < this._revisionId || result.revisionId > 2147483647 ) {
					throw failure( 'layers-publication-outcome-unknown' );
				}
				this._revisionId = result.revisionId;
				this._savedJson = snapshotJson;
				this._phase = 'ready';
				return this.getStatus();
			} catch ( error ) {
				const safeError = error && typeof error.code === 'string' ? error :
					failure( 'layers-publication-outcome-unknown' );
				if ( this._phase !== 'disposed' ) {
					this._phase = safeError.code === 'layers-edit-conflict' ? 'conflict' :
						safeError.code === 'layers-publication-outcome-unknown' ? 'uncertain' : 'ready';
				}
				throw safeError;
			}
		}

		/**
		 * Reconcile with an explicitly selected server revision without publishing or dropping local edits.
		 * @param {number} revisionId Authorized revision to compare
		 * @return {Promise<Object>}
		 */
		async reconcile( revisionId ) {
			this._requireLoaded();
			if ( this._readOnly || this._reconciling ||
				![ 'ready', 'conflict', 'uncertain' ].includes( this._phase ) ||
				!Number.isInteger( revisionId ) || revisionId < this._revisionId || revisionId > 2147483647 ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._reconciling = true;
			try {
				const bundle = await this._reader.read( { owner: this._owner, revisionId } );
				this._requireLoaded();
				if ( bundle.revisionId !== revisionId ) {
					throw failure( 'layers-invalid-read-response' );
				}
				const serverState = this._adapter.toEditorState( bundle.snapshot, this._surfaceId );
				const server = this._adapter.withEditorState( bundle.snapshot, this._surfaceId, serverState );
				const selected = ( snapshot ) => snapshot.surfaces.find( ( surface ) => surface.id === this._surfaceId );
				const remote = comparable( selected( server ) );
				if ( remote !== comparable( selected( JSON.parse( this._savedJson ) ) ) &&
					remote !== comparable( selected( this._snapshot ) ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				// Retain every newer server-owned field/surface; carry only this surface's local canvas/layers.
				const merged = this._adapter.withEditorState( server, this._surfaceId, this.getEditorState() );
				this._snapshot = merged;
				this._savedJson = JSON.stringify( server );
				this._revisionId = revisionId;
				this._phase = 'ready';
				return this.getStatus();
			} finally {
				this._reconciling = false;
			}
		}

		/** Preserve a recovery hold until the UI explicitly reconciles with server history. */
		blockPublication() {
			this._requireLoaded();
			if ( this._phase !== 'ready' ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._phase = 'uncertain';
		}

		/** Stop late results from changing this session. Export any draft before disposal. */
		dispose() {
			this._phase = 'disposed';
			this._snapshot = null;
			this._savedJson = null;
		}

		/** @private */
		_requireLoaded() {
			if ( this._snapshot === null || this._phase === 'disposed' ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedEditorSession = PageOwnedEditorSession;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedEditorSession;
	}
}() );
