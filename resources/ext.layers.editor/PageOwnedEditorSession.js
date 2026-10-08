/**
 * One owner/revision/surface editing session. No legacy storage or automatic retry.
 * The UI owns draft persistence and deliberate conflict reconciliation.
 */
( function () {
	'use strict';

	const preparedPdfDrafts = new WeakMap();
	const pendingPdfDrafts = new WeakMap();

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
			this._pdfContext = options.pdfContext === undefined ? null : this._pdfCopy( options.pdfContext );
			if ( options.pdfContext !== undefined && ( !this._pdfContext ||
				this._readOnly || this._newSurface || this._pageId === undefined ) ) {
				throw failure( 'layers-invalid-editor-session' );
			}
			this._pdf = null;
			this._pdfRecovery = null;
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
				if ( this._pdfContext !== null ) {
					const context = this._pdfAdmit( this._pdfContext );
					if ( !context.stored || context.page !== context.initialPage || context.surface.id !== this._surfaceId ) {
						throw failure( 'layers-editor-session-unavailable' );
					}
					this._pdf = { pageCount: context.pageCount, initialPage: context.initialPage,
						activeSurfaceId: this._surfaceId, page: context.page,
						original: this._pdfPin( context.surface ), temporary: new Map(), admissions: new Map() };
				}
				this._phase = 'ready';
				return state;
			} catch ( error ) {
				if ( this._phase !== 'disposed' ) {
					this._phase = 'unloaded';
					if ( this._pdfContext !== null ) {
						this._snapshot = null;
						this._savedJson = null;
						this._pdf = null;
					}
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
			if ( this._pdf ) {
				return this._adapter.toEditorState( this._pdfView(), this._pdf.activeSurfaceId );
			}
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
			if ( this._pdf ) {
				const next = this._adapter.withEditorState( this._pdfView(), this._pdf.activeSurfaceId, state );
				const blank = this._pdfBlank( this._pdf.activeSurfaceId );
				if ( blank && !JSON.parse( this._savedJson ).surfaces.some( ( surface ) => surface.id === blank.id ) &&
					comparable( next.surfaces.find( ( surface ) => surface.id === blank.id ) ) === comparable( blank ) ) {
					next.surfaces = next.surfaces.filter( ( surface ) => surface.id !== blank.id );
				}
				this._snapshot = next;
				return;
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
			if ( this._pdfRecovery ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
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
			if ( this._pdf ) {
				const baseIds = new Set( JSON.parse( this._savedJson ).surfaces.map( surface => surface.id ) );
				const admissions = Array.from( this._pdf.admissions.values() ).filter( record =>
					record.revisionId < this._revisionId && !baseIds.has( record.surface.id ) &&
					this._snapshot.surfaces.some( surface => surface.id === record.surface.id ) &&
					this._pdfNativeId( record ) === record.surface.id );
				return this._pdfCopy( { owner: this._owner, baseRevisionId: this._revisionId,
					surfaceId: this._surfaceId, snapshot: this._snapshot, pdf: {
						...( admissions.length ? { admissions } : {} ),
						version: 1, pageId: this._pageId, binding: 'v1:' + this._pageId + ':' + this._surfaceId,
						initialPage: this._pdf.initialPage, pageCount: this._pdf.pageCount,
						activePage: this._pdf.page, original: this._pdf.original,
						baseSnapshot: JSON.parse( this._savedJson )
					} } );
			}
			return {
				owner: this._owner,
				baseRevisionId: this._revisionId,
				surfaceId: this._surfaceId,
				snapshot: this._adapter.withEditorState( this._snapshot, this._surfaceId, this.getEditorState() )
			};
		}

		_pdfCopy( value ) {
			return this._adapter.toEditorState( { schemaVersion: 1, surfaces: [ {
				id: 'json-copy', kind: 'slide', canvas: { value }, layers: []
			} ] }, 'json-copy' ).canvas.value;
		}

		_pdfPin( surface ) {
			const pin = Object.assign( {}, surface.source );
			delete pin.page;
			return pin;
		}

		_pdfGroup( snapshot, anchor, count ) {
			const members = snapshot.surfaces.filter( ( surface ) => sameSet( surface, anchor ) );
			const pages = new Set();
			for ( const member of members ) {
				if ( member.kind !== 'pdf' || !Number.isInteger( member.source.page ) ||
					member.source.page < 1 || member.source.page > count || pages.has( member.source.page ) ||
					member.label !== anchor.label ||
					comparable( this._pdfPin( member ) ) !== comparable( this._pdfPin( anchor ) ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				pages.add( member.source.page );
			}
			return members;
		}

		_pdfAdmit( input ) {
			const context = this._pdfCopy( input );
			const base = JSON.parse( this._savedJson );
			const anchor = this._selected( base );
			if ( !context || !anchor || anchor.kind !== 'pdf' || context.kind !== 'pdf' ||
				context.owner !== this._owner || context.pageId !== this._pageId ||
				context.revisionId !== this._revisionId || context.binding !== 'v1:' + this._pageId + ':' + this._surfaceId ||
				context.initialPage !== anchor.source.page || context.label !== anchor.label ||
				!Number.isInteger( context.pageCount ) || context.pageCount < 1 || context.pageCount > 2147483647 ||
				!Number.isInteger( context.page ) || context.page < 1 || context.page > context.pageCount ||
				( this._pdf && ( context.pageCount !== this._pdf.pageCount ||
					comparable( this._pdfPin( anchor ) ) !== comparable( this._pdf.original ) ) ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const group = this._pdfGroup( base, anchor, context.pageCount );
			const inventory = group.slice().sort( ( left, right ) => left.source.page - right.source.page )
				.map( ( surface ) => ( { page: surface.source.page, surfaceId: surface.id } ) );
			const stored = group.find( ( surface ) => surface.source.page === context.page );
			const surface = context.surface;
			const geometry = context.sourceGeometry;
			const rendition = context.rendition;
			if ( comparable( context.members ) !== comparable( inventory ) || !surface || surface.kind !== 'pdf' ||
				!sameSet( surface, anchor ) || surface.label !== anchor.label || surface.source.page !== context.page ||
				comparable( this._pdfPin( surface ) ) !== comparable( this._pdfPin( anchor ) ) ||
				context.stored !== Boolean( stored ) || ( stored && comparable( surface ) !== comparable( stored ) ) ||
				( !stored && ( !isNewSurface( surface, surface.id ) || base.surfaces.some( ( member ) =>
					member.id === surface.id ) ) ) || !geometry || geometry.page !== context.page ||
				geometry.units !== 'file-handler-pixels' || !Number.isInteger( geometry.width ) || geometry.width < 1 ||
				!Number.isInteger( geometry.height ) || geometry.height < 1 || !rendition ||
				typeof rendition.url !== 'string' || !rendition.url || !Number.isInteger( rendition.width ) ||
				rendition.width < 1 || !Number.isInteger( rendition.height ) || rendition.height < 1 ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._adapter.toEditorState( { schemaVersion: 1, surfaces: [ surface ] }, surface.id );
			if ( this._pdf && !stored ) {
				for ( const temporary of this._pdf.temporary.values() ) {
					if ( temporary.source.page === context.page || temporary.id === surface.id ) {
						const record = this._pdf.admissions.get( temporary.id );
						if ( !record || temporary.source.page !== context.page ||
							( record.revisionId === this._revisionId ? comparable( temporary ) !== comparable( surface ) :
								!this._pdfAssociation( record, context ) ) ) {
							throw failure( 'layers-editor-session-unavailable' );
						}
					}
				}
			}
			return context;
		}

		_pdfBlank( id ) {
			const blank = this._pdf.temporary.get( id );
			return blank ? Object.assign( {}, this._pdfCopy( blank ), { label: this.getLabel() } ) : null;
		}

		_pdfView() {
			if ( this._snapshot.surfaces.some( ( surface ) => surface.id === this._pdf.activeSurfaceId ) ) {
				return this._snapshot;
			}
			const blank = this._pdfBlank( this._pdf.activeSurfaceId );
			if ( !blank ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			return Object.assign( {}, this._snapshot, { surfaces: this._snapshot.surfaces.concat( [ blank ] ) } );
		}

		_pdfReady() {
			this._requireLoaded();
			if ( !this._pdf || this._phase !== 'ready' || this._reconciling || this._pdfRecovery ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}

		getPdfStatus() {
			return this._pdf ? { page: this._pdf.page, pageCount: this._pdf.pageCount,
				initialPage: this._pdf.initialPage, anchorSurfaceId: this._surfaceId,
				activeSurfaceId: this._pdf.activeSurfaceId } : null;
		}

		selectPdfPage( context ) {
			this._pdfReady();
			const admitted = this._pdfAdmit( context );
			let selectedId = admitted.surface.id;
			if ( !admitted.stored ) {
				const retained = this._snapshot.surfaces.find( surface => surface.kind === 'pdf' &&
					sameSet( surface, this._selected( this._snapshot ) ) && surface.source.page === admitted.page );
				if ( retained ) {
					selectedId = retained.id;
				} else {
					for ( const [ id, temporary ] of this._pdf.temporary ) {
						if ( temporary.source.page === admitted.page ) {
							this._pdf.temporary.delete( id );
							this._pdf.admissions.delete( id );
						}
					}
					this._pdf.temporary.set( selectedId, admitted.surface );
					this._pdf.admissions.set( selectedId, { revisionId: this._revisionId, surface: admitted.surface } );
				}
			}
			this._pdf.activeSurfaceId = selectedId;
			this._pdf.page = admitted.page;
			return this.getEditorState();
		}

		_pdfNativeId( record ) {
			const helper = typeof module !== 'undefined' && module.exports ?
				require( './PageOwnedPdfWorkingSet.js' ) : window.Layers.Editor.PageOwnedPdfWorkingSet;
			return helper.surfaceId( this._pageId, record.revisionId, record.surface.source.fileTitle,
				record.surface.label, record.surface.source.page );
		}

		_pdfOriginShape( record, context ) {
			if ( !record || comparable( Object.keys( record ).sort() ) !== comparable( [ 'revisionId', 'surface' ] ) ||
				!Number.isInteger( record.revisionId ) || record.revisionId < 1 || record.revisionId >= this._revisionId ||
				!record.surface || !isNewSurface( record.surface, record.surface.id ) || record.surface.kind !== 'pdf' ) {
				return false;
			}
			const equivalent = surface => Object.assign( {}, surface, { id: context.surface.id, label: context.label } );
			return comparable( equivalent( record.surface ) ) === comparable( context.surface );
		}

		_pdfAssociation( record, context ) {
			if ( !this._pdfOriginShape( record, context ) ) {
				return false;
			}
			return ( this._pdfNativeId( record ) === record.surface.id ?
				this._pdfNativeId( { revisionId: this._revisionId, surface: context.surface } ) === context.surface.id :
				record.surface.id === context.surface.id );
		}

		_pdfFixed( surface ) {
			const fixed = this._pdfCopy( surface );
			delete fixed.canvas;
			delete fixed.layers;
			delete fixed.label;
			return fixed;
		}

		restorePdfDraft( input, preparedPages ) {
			this._pdfReady();
			const plan = this._pdfRestorePlan( input, preparedPages );
			if ( plan.records.length ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			this._snapshot = plan.snapshot;
			this._pdf.temporary = plan.temporary;
			this._pdf.admissions = plan.admissions;
			return this.getEditorState();
		}

		_pdfRestorePlan( input, preparedPages ) {
			const draft = this._pdfCopy( input );
			preparedPages = this._pdfCopy( preparedPages );
			const expected = this.getDraft();
			const draftPdf = Object.assign( {}, draft && draft.pdf, { activePage: expected.pdf.activePage } );
			const expectedPdf = Object.assign( {}, expected.pdf );
			delete draftPdf.admissions;
			delete expectedPdf.admissions;
			if ( !draft || !draft.pdf || draft.owner !== expected.owner ||
				draft.surfaceId !== expected.surfaceId || draft.baseRevisionId !== expected.baseRevisionId ||
				!Number.isInteger( draft.pdf.activePage ) || draft.pdf.activePage < 1 ||
				draft.pdf.activePage > this._pdf.pageCount || !Array.isArray( preparedPages ) ||
				comparable( draftPdf ) !== comparable( expectedPdf ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const next = draft.snapshot;
			this._adapter.toEditorState( next, this._surfaceId );
			const base = JSON.parse( this._savedJson );
			const root = snapshot => {
				const result = Object.assign( {}, snapshot );
				delete result.surfaces;
				return result;
			};
			if ( comparable( root( next ) ) !== comparable( root( base ) ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const anchor = this._selected( base );
			const group = this._pdfGroup( base, anchor, this._pdf.pageCount );
			const ids = new Set( group.map( surface => surface.id ) );
			const nextById = new Map( next.surfaces.map( surface => [ surface.id, surface ] ) );
			for ( const member of base.surfaces ) {
				const local = nextById.get( member.id );
				if ( !local || comparable( ids.has( member.id ) ? this._pdfFixed( local ) : local ) !==
					comparable( ids.has( member.id ) ? this._pdfFixed( member ) : member ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
			}
			const temporary = new Map( this._pdf.temporary );
			const admissions = new Map( this._pdf.admissions );
			const provenance = draft.pdf.admissions === undefined ? [] : draft.pdf.admissions;
			if ( !Array.isArray( provenance ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const recordById = new Map();
			for ( const record of provenance ) {
				if ( !record || !record.surface || recordById.has( record.surface.id ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				recordById.set( record.surface.id, record );
			}
			const admittedById = new Map();
			const pages = new Set();
			const preparedIds = new Set();
			for ( const inputPage of preparedPages ) {
				const admitted = this._pdfAdmit( inputPage );
				if ( pages.has( admitted.page ) || preparedIds.has( admitted.surface.id ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				pages.add( admitted.page );
				preparedIds.add( admitted.surface.id );
				admittedById.set( admitted.page, admitted );
			}
			const baseIds = new Set( base.surfaces.map( surface => surface.id ) );
			for ( const member of next.surfaces.filter( surface => !baseIds.has( surface.id ) ) ) {
				const admitted = member.source && admittedById.get( member.source.page );
				const record = recordById.get( member.id );
				const blank = record ? record.surface : admitted && admitted.surface;
				if ( !admitted || admitted.stored || !sameSet( member, this._selected( next ) ) ||
					member.label !== this._selected( next ).label || ( record ?
						!this._pdfOriginShape( record, admitted ) ||
							this._pdfNativeId( { revisionId: this._revisionId, surface: admitted.surface } ) !== admitted.surface.id :
						member.id !== admitted.surface.id ) || comparable( this._pdfFixed( member ) ) !==
					comparable( this._pdfFixed( blank ) ) ||
					comparable( { canvas: member.canvas, layers: member.layers } ) ===
					comparable( { canvas: blank.canvas, layers: blank.layers } ) ) {
					throw failure( 'layers-editor-session-unavailable' );
				}
				temporary.set( member.id, blank );
				admissions.set( member.id, record || { revisionId: this._revisionId, surface: blank } );
				recordById.delete( member.id );
			}
			if ( recordById.size ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const localAnchor = this._selected( next );
			const restored = this._pdfGroup( next, localAnchor, this._pdf.pageCount );
			const restoredIds = new Set( restored.map( surface => surface.id ) );
			if ( restored.some( member => baseIds.has( member.id ) && !ids.has( member.id ) ) ||
				normalizeName( localAnchor.label ) !== localAnchor.label || next.surfaces.some( surface =>
				!restoredIds.has( surface.id ) && sameSet( surface, localAnchor ) ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			return { snapshot: next, temporary, admissions, records: provenance };
		}

		preparePdfDraftWithHistory( input, preparedPages ) {
			try {
				return this._preparePdfDraftWithHistory( input, preparedPages );
			} catch ( error ) {
				return Promise.reject( error );
			}
		}

		_preparePdfDraftWithHistory( input, preparedPages ) {
			this._pdfReady();
			const plan = this._pdfRestorePlan( input, preparedPages );
			const handle = Object.freeze( Object.create( null ) );
			const operation = { revisionId: this._revisionId, base: this._savedJson,
				snapshot: this._snapshot, pdf: this._pdf, selection: comparable( this.getPdfStatus() ),
				work: this._pdfRecoveryWitness(), session: this, plan, ready: false };
			const activeId = this._pdf.activeSurfaceId;
			const view = plan.snapshot.surfaces.some( surface => surface.id === activeId ) ? plan.snapshot :
				Object.assign( {}, plan.snapshot, { surfaces: plan.snapshot.surfaces.concat( [
					Object.assign( {}, plan.temporary.get( activeId ), { label: this._selected( plan.snapshot ).label } )
				] ) } );
			operation.state = this._adapter.toEditorState( view, activeId );
			preparedPdfDrafts.set( handle, operation );
			this._pdfRecovery = handle;
			const preparation = ( async () => {
			try {
				const histories = new Map();
				for ( const record of plan.records ) {
					if ( !histories.has( record.revisionId ) ) {
						const bundle = await this._reader.read( { owner: this._owner, revisionId: record.revisionId } );
						this._checkPreparedPdfDraft( handle );
						if ( !bundle || bundle.revisionId !== record.revisionId ) {
							throw failure( 'layers-invalid-read-response' );
						}
						const historical = this._pdfCopy( bundle.snapshot );
						this._adapter.toEditorState( historical, this._surfaceId );
						histories.set( record.revisionId, historical );
					}
					this._pdfHistoricalOrigin( record, histories.get( record.revisionId ) );
				}
				const current = await this._reader.read( { owner: this._owner, revisionId: operation.revisionId } );
				if ( !current || current.revisionId !== operation.revisionId ||
					comparable( this._pdfCopy( current.snapshot ) ) !== comparable( JSON.parse( operation.base ) ) ) {
					throw failure( 'layers-invalid-read-response' );
				}
				await Promise.resolve();
				this._checkPreparedPdfDraft( handle );
				operation.ready = true;
				return handle;
			} catch ( error ) {
				this.cancelPreparedPdfDraft( handle );
				throw error;
			}
			} )();
			operation.preparation = preparation;
			pendingPdfDrafts.set( preparation, handle );
			return preparation;
		}

		_pdfRecoveryWitness() {
			return comparable( { draft: this.getDraft(), selection: this.getPdfStatus(),
				temporary: Array.from( this._pdf.temporary ), admissions: Array.from( this._pdf.admissions ) } );
		}

		_checkPreparedPdfDraft( handle ) {
			this._requireLoaded();
			const operation = preparedPdfDrafts.get( handle );
			if ( !operation || operation.session !== this || this._pdfRecovery !== handle ||
				this._phase !== 'ready' || this._reconciling || this._readOnly ||
				this._revisionId !== operation.revisionId || this._savedJson !== operation.base ||
				this._snapshot !== operation.snapshot || this._pdf !== operation.pdf ||
				comparable( this.getPdfStatus() ) !== operation.selection || this._pdfRecoveryWitness() !== operation.work ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			return operation;
		}

		commitPreparedPdfDraft( handle ) {
			const operation = this._checkPreparedPdfDraft( handle );
			if ( !operation.ready ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const state = this._pdfCopy( operation.state );
			this.cancelPreparedPdfDraft( handle );
			this._snapshot = operation.plan.snapshot;
			this._pdf.temporary = operation.plan.temporary;
			this._pdf.admissions = operation.plan.admissions;
			return state;
		}

		cancelPreparedPdfDraft( handle ) {
			handle = pendingPdfDrafts.get( handle ) || handle;
			const operation = preparedPdfDrafts.get( handle );
			if ( operation && operation.session === this ) {
				preparedPdfDrafts.delete( handle );
				pendingPdfDrafts.delete( operation.preparation );
				if ( this._pdfRecovery === handle ) {
					this._pdfRecovery = null;
				}
			}
		}

		async restorePdfDraftWithHistory( input, preparedPages ) {
			let handle;
			try {
				handle = await this.preparePdfDraftWithHistory( input, preparedPages );
				return this.commitPreparedPdfDraft( handle );
			} finally {
				this.cancelPreparedPdfDraft( handle );
			}
		}

		_pdfHistoricalOrigin( record, snapshot ) {
			const anchor = this._selected( snapshot );
			if ( !anchor || anchor.kind !== 'pdf' || !anchor.source || anchor.source.page !== this._pdf.initialPage ||
				comparable( this._pdfPin( anchor ) ) !== comparable( this._pdf.original ) ||
				anchor.label !== record.surface.label || this._pdfGroup( snapshot, anchor, this._pdf.pageCount )
					.some( member => member.source.page === record.surface.source.page ) ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
			const actual = { revisionId: record.revisionId, surface: Object.assign( {}, record.surface, {
				label: anchor.label, source: Object.assign( {}, anchor.source, { page: record.surface.source.page } )
			} ) };
			if ( this._pdfNativeId( actual ) !== record.surface.id ) {
				throw failure( 'layers-editor-session-unavailable' );
			}
		}

		_pdfReconcile( input, revisionId ) {
			const server = this._pdfCopy( input );
			this._adapter.toEditorState( server, this._surfaceId );
			const base = JSON.parse( this._savedJson );
			const baseAnchor = this._selected( base );
			const localAnchor = this._selected( this._snapshot );
			const remoteAnchor = this._selected( server );
			if ( remoteAnchor.kind !== 'pdf' || remoteAnchor.source.page !== this._pdf.initialPage ||
				comparable( this._pdfPin( remoteAnchor ) ) !== comparable( this._pdf.original ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			const baseGroup = this._pdfGroup( base, baseAnchor, this._pdf.pageCount );
			const localGroup = this._pdfGroup( this._snapshot, localAnchor, this._pdf.pageCount );
			const remoteGroup = this._pdfGroup( server, remoteAnchor, this._pdf.pageCount );
			const baseById = new Map( baseGroup.map( member => [ member.id, member ] ) );
			const localById = new Map( localGroup.map( member => [ member.id, member ] ) );
			const remoteById = new Map( server.surfaces.map( member => [ member.id, member ] ) );
			const merged = this._pdfCopy( server );
			for ( const member of baseGroup ) {
				const local = localById.get( member.id );
				const remote = remoteById.get( member.id );
				const dirty = comparable( member ) !== comparable( local );
				if ( !local || ( !remote && ( dirty || member.id === this._pdf.activeSurfaceId ) ) ||
					( remote && ( remote.kind !== 'pdf' || remote.source.page !== member.source.page ||
						comparable( this._pdfPin( remote ) ) !== comparable( this._pdf.original ) ||
						remote.label !== remoteAnchor.label ) ) ||
					( dirty && comparable( remote ) !== comparable( member ) && comparable( remote ) !== comparable( local ) ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				if ( dirty ) {
					merged.surfaces[ merged.surfaces.findIndex( surface => surface.id === member.id ) ] = this._pdfCopy( local );
				}
			}
			for ( const local of localGroup.filter( member => !baseById.has( member.id ) ) ) {
				const remote = remoteById.get( local.id );
				if ( remote && comparable( remote ) !== comparable( local ) ) {
					throw failure( 'layers-editor-reconciliation-required' );
				}
				if ( !remote ) {
					merged.surfaces.push( this._pdfCopy( local ) );
				}
			}
			const label = localAnchor.label !== baseAnchor.label ? localAnchor.label : remoteAnchor.label;
			const ids = new Set( [ ...baseGroup, ...localGroup, ...remoteGroup ].map( member => member.id ) );
			if ( server.surfaces.some( member => !ids.has( member.id ) && sameScope( baseAnchor, member ) &&
				nameKey( labelOf( member ) ) === nameKey( label ) ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			merged.surfaces.forEach( member => {
				if ( ids.has( member.id ) ) {
					member.label = label;
				}
			} );
			this._adapter.toEditorState( merged, this._surfaceId );
			this._pdfGroup( merged, this._selected( merged ), this._pdf.pageCount );
			const active = merged.surfaces.find( member => member.id === this._pdf.activeSurfaceId );
			if ( !active && remoteGroup.some( member => member.source.page === this._pdf.page ) ) {
				throw failure( 'layers-editor-reconciliation-required' );
			}
			this._snapshot = merged;
			this._savedJson = JSON.stringify( server );
			this._revisionId = revisionId;
			this._phase = 'ready';
			return this.getStatus();
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
			if ( this._phase !== 'ready' || this._reconciling || this._pdfRecovery ) {
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
			if ( this._readOnly || this._reconciling || this._pdfRecovery ||
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
				if ( this._pdf ) {
					return this._pdfReconcile( bundle.snapshot, revisionId );
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
			this.cancelPreparedPdfDraft( this._pdfRecovery );
			this._phase = 'disposed';
			this._pdfRecovery = null;
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
