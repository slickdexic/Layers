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

	// Mirrors src/Revision/DrawingName.php; the server makes the final decision.
	function normalizeName( name ) {
		name = String( name ).replace( /\s+/gu, ' ' ).trim();
		const chars = Array.from( name );
		return chars.length === 0 || chars.length > 255 || chars.some( ( char ) =>
			char.charCodeAt( 0 ) < 32 || char.charCodeAt( 0 ) === 127 || '|[]{}<>:'.includes( char ) ) ? null : name;
	}

	function nameKey( name ) {
		return String( name ).replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	}

	function labelOf( surface ) {
		return typeof surface.label === 'string' ? surface.label : '';
	}

	function isNewSurface( surface, surfaceId ) {
		return Boolean( surface ) && Object.getPrototypeOf( surface ) === Object.prototype &&
			surface.id === surfaceId && [ 'slide', 'image', 'pdf' ].includes( surface.kind ) &&
			typeof surface.label === 'string' && Boolean( surface.canvas ) && typeof surface.canvas === 'object' &&
			Array.isArray( surface.layers ) && surface.layers.length === 0;
	}

	class PageOwnedEditorSession {
		/**
		 * @param {Object} options Immutable owner, revisionId, surfaceId and optional pageId/readOnly; newSurface
		 *  starts a drawing the page does not have yet, and emptyBase says the base revision has no drawings
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
				( options.newSurface !== undefined && !isNewSurface( options.newSurface, options.surfaceId ) ) ||
				( options.emptyBase !== undefined &&
					( typeof options.emptyBase !== 'boolean' || options.newSurface === undefined ) ) ||
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
			this._newSurface = options.newSurface ? JSON.parse( JSON.stringify( options.newSurface ) ) : null;
			this._baseHasDrawings = options.emptyBase !== true;
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
				// A revision without drawings has no document to read; the new drawing is its first.
				const bundle = this._baseHasDrawings ? await this._reader.read( {
					owner: this._owner, revisionId: this._revisionId
				} ) : { revisionId: this._revisionId, snapshot: { schemaVersion: 1, surfaces: [] } };
				if ( this._phase === 'disposed' ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				if ( bundle.revisionId !== this._revisionId ) {
					throw failure( 'layers-invalid-read-response' );
				}
				let snapshot = bundle.snapshot;
				let saved = null;
				if ( this._newSurface ) {
					const name = nameKey( this._newSurface.label );
					if ( !snapshot || !Array.isArray( snapshot.surfaces ) || snapshot.surfaces.some( ( surface ) =>
						surface.id === this._surfaceId || nameKey( labelOf( surface ) ) === name ) ) {
						throw failure( 'layers-editor-session-unavailable' );
					}
					// The page does not have this drawing until a save adds it, so it starts out unsaved.
					saved = snapshot;
					snapshot = Object.assign( {}, snapshot, { surfaces: snapshot.surfaces.concat( [ this._newSurface ] ) } );
				}
				const state = this._adapter.toEditorState( snapshot, this._surfaceId );
				this._snapshot = this._adapter.withEditorState( snapshot, this._surfaceId, state );
				this._savedJson = JSON.stringify( saved || this._snapshot );
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
			if ( !this._baseHasDrawings ) {
				return;
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

		/** @return {string} The drawing's name, including a rename not yet saved */
		getLabel() {
			this._requireLoaded();
			const label = this._selected( this._snapshot ).label;
			return typeof label === 'string' ? label : '';
		}

		/**
		 * Rename the drawing as part of the current edits; the next save publishes it.
		 * @param {string} name Proposed name
		 * @return {string} The name as it will be saved, with spacing tidied
		 */
		rename( name ) {
			this._requireLoaded();
			if ( this._readOnly ) {
				throw failure( 'layers-editor-read-only' );
			}
			const label = typeof name === 'string' ? normalizeName( name ) : null;
			if ( label === null ) {
				throw failure( 'layers-page-drawing-rename-invalid' );
			}
			// The page's embed names the new drawing; renaming it before its first save would lose that link.
			if ( this.isUnsavedNew() ) {
				throw failure( 'layers-page-drawing-rename-new' );
			}
			if ( this._snapshot.surfaces.some( ( surface ) => surface.id !== this._surfaceId &&
				nameKey( typeof surface.label === 'string' ? surface.label : '' ) === nameKey( label ) ) ) {
				throw failure( 'layers-page-drawing-rename-taken' );
			}
			this._selected( this._snapshot ).label = label;
			return label;
		}

		/** @return {boolean} The drawing exists only in this editor; no save has added it to the page yet */
		isUnsavedNew() {
			this._requireLoaded();
			return !this._selected( JSON.parse( this._savedJson ) );
		}

		/** @param {Object} snapshot @return {Object} This session's surface @private */
		_selected( snapshot ) {
			return snapshot.surfaces.find( ( surface ) => surface.id === this._surfaceId );
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
				this._baseHasDrawings = true;
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
				if ( !bundle.snapshot.surfaces.some( ( surface ) => surface.id === this._surfaceId ) ) {
					return this._reconcileUnsavedNew( bundle.snapshot, revisionId );
				}
				const serverState = this._adapter.toEditorState( bundle.snapshot, this._surfaceId );
				const server = this._adapter.withEditorState( bundle.snapshot, this._surfaceId, serverState );
				const remote = comparable( this._selected( server ) );
				if ( remote !== comparable( this._selected( JSON.parse( this._savedJson ) ) ) &&
					remote !== comparable( this._selected( this._snapshot ) ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				// Retain every newer server-owned field/surface; carry only this surface's local name, canvas and layers.
				const merged = this._adapter.withEditorState( server, this._surfaceId, this.getEditorState() );
				this._selected( merged ).label = this._selected( this._snapshot ).label;
				this._snapshot = merged;
				this._savedJson = JSON.stringify( server );
				this._revisionId = revisionId;
				this._phase = 'ready';
				return this.getStatus();
			} finally {
				this._reconciling = false;
			}
		}

		/**
		 * The server revision lacks this drawing: fine only if it was never saved and its name is still free.
		 * @param {Object} server Newer revision's document
		 * @param {number} revisionId
		 * @return {Object} Status
		 * @private
		 */
		_reconcileUnsavedNew( server, revisionId ) {
			const local = this._selected( this._snapshot );
			if ( !this.isUnsavedNew() ||
				server.surfaces.some( ( surface ) => nameKey( labelOf( surface ) ) === nameKey( labelOf( local ) ) ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			const merged = Object.assign( {}, server, { surfaces: server.surfaces.concat( [ local ] ) } );
			this._snapshot = this._adapter.withEditorState( merged, this._surfaceId, this.getEditorState() );
			this._savedJson = JSON.stringify( server );
			this._revisionId = revisionId;
			this._baseHasDrawings = true;
			this._phase = 'ready';
			return this.getStatus();
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
