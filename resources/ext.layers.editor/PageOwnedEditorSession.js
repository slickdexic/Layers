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

	// File titles are already canonical. Their case, underscores and source versions are not name keys.
	function sameScope( left, right ) {
		if ( left.kind === 'slide' || right.kind === 'slide' ) {
			return left.kind === 'slide' && right.kind === 'slide';
		}
		return Boolean( left.source && right.source ) && typeof left.source.fileTitle === 'string' &&
			left.source.fileTitle === right.source.fileTitle;
	}

	function sameSet( left, right ) {
		return sameScope( left, right ) && nameKey( labelOf( left ) ) === nameKey( labelOf( right ) );
	}

	function newSurfaceCollides( existing, added ) {
		return existing.id === added.id || ( sameSet( existing, added ) &&
			( labelOf( existing ) !== labelOf( added ) || !( existing.kind === 'pdf' && added.kind === 'pdf' &&
				Number.isInteger( existing.source.page ) && Number.isInteger( added.source.page ) &&
				existing.source.page > 0 && added.source.page > 0 && existing.source.page !== added.source.page ) ) );
	}

	function setMembers( snapshot, selected ) {
		return snapshot.surfaces.filter( ( surface ) => surface.id === selected.id ||
			( selected.kind === 'pdf' && surface.kind === 'pdf' && sameSet( surface, selected ) ) );
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
					if ( !snapshot || !Array.isArray( snapshot.surfaces ) || snapshot.surfaces.some( ( surface ) =>
						newSurfaceCollides( surface, this._newSurface ) ) ) {
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
			const selected = this._selected( this._snapshot );
			const members = setMembers( this._snapshot, selected );
			const ids = new Set( members.map( ( surface ) => surface.id ) );
			if ( this._snapshot.surfaces.some( ( surface ) => !ids.has( surface.id ) && sameScope( surface, selected ) &&
				nameKey( labelOf( surface ) ) === nameKey( label ) ) ) {
				throw failure( 'layers-page-drawing-rename-taken' );
			}
			members.forEach( ( surface ) => { surface.label = label; } );
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
				const base = JSON.parse( this._savedJson );
				const remote = comparable( this._selected( server ) );
				if ( remote !== comparable( this._selected( base ) ) &&
					remote !== comparable( this._selected( this._snapshot ) ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				// Retain newer sibling content while carrying the selected edits and the complete set's rename.
				const merged = this._adapter.withEditorState( server, this._surfaceId, this.getEditorState() );
				this._selected( merged ).label = this._selected( this._snapshot ).label;
				this._reconcileRename( base, server, merged );
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
		 * Carry a pending name across stable group IDs without overwriting another editor's rename.
		 * New PDF pages may join the same set; newer layers/source versions remain server-owned.
		 * @param {Object} base Last confirmed document
		 * @param {Object} server Newer document
		 * @param {Object} merged Candidate with the selected surface's local content
		 * @private
		 */
		_reconcileRename( base, server, merged ) {
			const original = this._selected( base );
			if ( !original ) {
				return;
			}
			const members = setMembers( base, original );
			const label = labelOf( this._selected( this._snapshot ) );
			const localById = new Map( this._snapshot.surfaces.map( ( surface ) => [ surface.id, surface ] ) );
			if ( !members.some( ( member ) => labelOf( localById.get( member.id ) ) !== labelOf( member ) ) ) {
				return;
			}
			const remoteById = new Map( server.surfaces.map( ( surface ) => [ surface.id, surface ] ) );
			const ids = new Set( members.map( ( member ) => member.id ) );
			for ( const member of members ) {
				const remote = remoteById.get( member.id );
				if ( !remote || !sameScope( member, remote ) || member.kind !== remote.kind ||
					( member.kind === 'pdf' && member.source.page !== remote.source.page ) ||
					( labelOf( remote ) !== labelOf( member ) && labelOf( remote ) !== label ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
			}
			const alreadyRenamed = members.every( ( member ) => labelOf( remoteById.get( member.id ) ) === label );
			for ( const remote of server.surfaces ) {
				if ( ids.has( remote.id ) || !sameScope( original, remote ) ) {
					continue;
				}
				const originalName = sameSet( original, remote );
				const targetName = nameKey( labelOf( remote ) ) === nameKey( label );
				if ( original.kind === 'pdf' && remote.kind === 'pdf' &&
					( alreadyRenamed ? targetName : originalName ) ) {
					ids.add( remote.id );
				} else if ( targetName ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
			}
			merged.surfaces.forEach( ( surface ) => {
				if ( ids.has( surface.id ) ) {
					surface.label = label;
				}
			} );
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
			const baseMembers = setMembers( JSON.parse( this._savedJson ), local );
			const remoteById = new Map( server.surfaces.map( ( surface ) => [ surface.id, surface ] ) );
			if ( !this.isUnsavedNew() ||
				server.surfaces.some( ( surface ) => newSurfaceCollides( surface, local ) ) ||
				baseMembers.some( ( member ) => {
					const remote = remoteById.get( member.id );
					return !remote || !sameSet( remote, local ) || labelOf( remote ) !== labelOf( local ) ||
						remote.kind !== member.kind || comparable( remote.source ) !== comparable( member.source );
				} ) ) {
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
