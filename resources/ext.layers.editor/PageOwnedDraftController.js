/** Draft capture and recovery inspection after an authorized exact-revision load. */
( function () {
	'use strict';
	const workingCopyDraftControllers = new WeakSet();
	const earlierCreationInspections = new WeakSet();
	const wholePdfDraftControllers = new WeakMap(), wholePdfCandidates = new WeakMap(), wholePdfRecoveries = new WeakMap();
	const wholePdfDraftActions = new WeakMap();
	function wholePdfMode( controller ) {
		const mode = wholePdfDraftControllers.get( controller );
		if ( !mode ) { throw controller._error(); }
		mode.Store.checkWorkingCopyMethods( mode.methods );
		if ( controller.bridge !== mode.bridge || controller.store !== mode.store || controller.adapter !== mode.adapter ||
			controller.wiki !== mode.wiki || controller.user !== mode.user || mode.bridge.disposed ||
			!mode.application.ownsBridge( mode.bridge ) || mode.bridge.session.getStatus().readOnly ||
			!mode.bridge.session.getPdfStatus() ) { throw controller._error(); }
		return mode;
	}
	function wholePdfSource( controller, candidate ) {
		const mode = wholePdfMode( controller ), record = wholePdfCandidates.get( candidate );
		if ( !record || record.controller !== controller || record.mode !== mode ||
			JSON.stringify( controller._scope() ) !== record.scope || mode.store._readWriterId !== record.writer ||
			mode.store.read( JSON.parse( record.scope ) ) !== record.raw ) { throw controller._error(); }
		return record;
	}

	class PageOwnedDraftController {
		/** Explicit complete-PDF storage integration; legacy drafts retain their existing route. */
		enableWholePdfDrafts( application ) {
			const Application = window.Layers.Editor.PageOwnedWholePdfImportApplication, Store = window.Layers.Core.StateManager;
			const Plan = window.Layers.Editor.PageOwnedWholePdfImportDraftPlan ||
				( typeof module !== 'undefined' && module.require ? module.require( './PageOwnedWholePdfImportDraftPlan.js' ) : null );
			if ( wholePdfDraftControllers.has( this ) || workingCopyDraftControllers.has( this ) || typeof Application !== 'function' ||
				!( application instanceof Application ) || !this.bridge.session.getPdfStatus() || this.bridge.session.getStatus().readOnly || !Plan ) {
				throw this._error();
			}
			const methods = [ 'ownsBridge', 'captureDraftForStorage', 'prepareDraftRecovery', 'inspectDraftRecovery',
				'commitDraftRecovery', 'releaseDraftRecovery', 'holdDraftRecoveryPublication' ].map( key => Store.captureWorkingCopyMethod( application, key ) );
			if ( methods.some( captured => captured.owner !== Application.prototype ) ) { throw this._error(); }
			if ( !application.ownsBridge( this.bridge ) ) { throw this._error(); }
			methods.push( Store.captureWorkingCopyMethod( Plan, 'prepare' ), Store.captureWorkingCopyMethod( this.bridge.session, 'blockPublication' ),
				...[ '_scope', '_copyState', 'persistWholePdfDraft', 'inspectWholePdfDraft', 'wholePdfDraftChanged',
					'prepareWholePdfDraftRecovery', 'commitWholePdfDraftRecovery', 'releaseWholePdfDraftRecovery', 'getWholePdfDraftActions' ]
					.map( key => Store.captureWorkingCopyMethod( this, key ) ),
				...[ 'read', 'write' ].map( key => Store.captureWorkingCopyMethod( this.store, key ) ) );
			application.captureDraftForStorage();
			wholePdfDraftControllers.set( this, { application, bridge: this.bridge, store: this.store, adapter: this.adapter,
				wiki: this.wiki, user: this.user, Store, Plan, methods } );
		}

		hasWholePdfDrafts() { return wholePdfDraftControllers.has( this ); }

		static isWholePdfDraftActions( value, controller ) { return wholePdfDraftActions.get( value ) === controller; }

		getWholePdfDraftActions() {
			const mode = wholePdfMode( this );
			const invoke = ( key, ...args ) => {
				wholePdfMode( this ); const method = mode.methods.find( value => value.object === this && value.key === key );
				return method.method.apply( this, args );
			};
			const actions = Object.freeze( { preflight: () => { wholePdfMode( this ); },
				changed: candidate => invoke( 'wholePdfDraftChanged', candidate ),
				prepare: ( candidate, check ) => invoke( 'prepareWholePdfDraftRecovery', candidate, check ),
				commit: handle => invoke( 'commitWholePdfDraftRecovery', handle ),
				release: handle => invoke( 'releaseWholePdfDraftRecovery', handle ) } );
			wholePdfDraftActions.set( actions, this ); return actions;
		}

		persistWholePdfDraft() {
			const mode = wholePdfMode( this ); this.bridge.capture();
			const scope = this._scope(), draft = mode.application.captureDraftForStorage();
			const json = JSON.stringify( { version: 1, scope, phase: this.bridge.session.getStatus().phase,
				label: this.bridge.session.getLabel(), editorState: this._copyState( this.bridge.getLiveState() ), wholePdfImportDraft: draft } );
			wholePdfMode( this ); mode.store.write( scope, json );
		}

		inspectWholePdfDraft( envelope, scope, raw ) {
			try {
				const mode = wholePdfMode( this );
				if ( envelope.version !== 1 || !envelope.scope || Object.keys( envelope.scope ).length !== Object.keys( scope ).length ||
					Object.keys( scope ).some( key => envelope.scope[ key ] !== scope[ key ] ) ||
					![ 'ready', 'saving', 'conflict', 'uncertain' ].includes( envelope.phase ) || typeof envelope.label !== 'string' ||
					[ 'pdfDraft', 'pdfHistory', 'workingCopyDraft', 'creationOrigin' ].some( key => Object.hasOwn( envelope, key ) ) ) { throw this._error(); }
				const draft = mode.Plan.prepare( envelope.wholePdfImportDraft, mode.application.captureDraftForStorage().session );
				const identity = draft.session.scope;
				if ( identity.owner !== scope.owner || identity.baseRevisionId !== scope.baseRevisionId || identity.surfaceId !== scope.surfaceId ) { throw this._error(); }
				const activeId = draft.session.pdf.activeSurfaceId, surface = draft.session.snapshot.surfaces.find( value => value.id === activeId ) ||
					draft.session.temporary.find( row => row[ 0 ] === activeId )?.[ 1 ];
				if ( !surface || surface.label !== envelope.label ) { throw this._error(); }
				const editorState = this.adapter.toEditorState( { schemaVersion: 1, surfaces: [ surface ] }, activeId );
				const candidate = { editorState, label: envelope.label, publicationBlocked: envelope.phase !== 'ready', wholePdfImportDraft: draft };
				wholePdfMode( this );
				wholePdfCandidates.set( candidate, { controller: this, mode, scope: JSON.stringify( scope ), writer: mode.store._readWriterId,
					raw, draft: mode.Store.copyWorkingCopyValue( draft ), publicationBlocked: candidate.publicationBlocked } ); return candidate;
			} catch ( error ) { throw this._error(); }
		}

		wholePdfDraftChanged( candidate ) {
			const record = wholePdfSource( this, candidate ), current = record.mode.application.captureDraftForStorage();
			const comparable = value => {
				const result = record.mode.Store.copyWorkingCopyValue( value );
				const trim = timeline => { for ( const entry of timeline.history ) { delete entry.timestamp; } };
				for ( const row of result.history.timelines ) { trim( row.timeline ); }
				for ( const group of result.history.groups ) {
					if ( group.timelines ) { for ( const phase of [ 'before', 'after' ] ) { for ( const row of group.timelines[ phase ] ) { trim( row.timeline ); } } }
				}
				const canonical = data => !data || typeof data !== 'object' ? JSON.stringify( data ) : Array.isArray( data ) ?
					'[' + data.map( canonical ).join( ',' ) + ']' : '{' + Object.keys( data ).sort().map( key => JSON.stringify( key ) + ':' + canonical( data[ key ] ) ).join( ',' ) + '}';
				return canonical( result );
			};
			return record.publicationBlocked || comparable( record.draft ) !== comparable( current );
		}

		async prepareWholePdfDraftRecovery( candidate, assertCurrent ) {
			const record = wholePdfSource( this, candidate );
			if ( typeof assertCurrent !== 'function' ) { throw this._error(); }
			const check = () => { wholePdfSource( this, candidate ); if ( assertCurrent() !== undefined ) { throw this._error(); } };
			check(); const handle = await record.mode.application.prepareDraftRecovery( record.draft, check );
			try {
				check(); if ( record.publicationBlocked ) { record.mode.application.holdDraftRecoveryPublication( handle ); }
				wholePdfRecoveries.set( handle, { controller: this, candidate, record, check } ); return handle;
			}
			catch ( error ) { record.mode.application.releaseDraftRecovery( handle ); throw error; }
		}

		async commitWholePdfDraftRecovery( handle ) {
			const prepared = wholePdfRecoveries.get( handle );
			if ( !prepared || prepared.controller !== this ) { throw this._error(); }
			prepared.check(); const result = await prepared.record.mode.application.commitDraftRecovery( handle );
			return result;
		}

		releaseWholePdfDraftRecovery( handle ) {
			const prepared = wholePdfRecoveries.get( handle );
			if ( !prepared || prepared.controller !== this ) { throw this._error(); }
			wholePdfRecoveries.delete( handle ); prepared.record.mode.application.releaseDraftRecovery( handle );
		}

		/** Inactive preparation only; successful plans own the inspection until commit or release. */
		async prepareEarlierCreationRecovery( handle, client ) {
			let inspection;
			try {
				const Store = window.Layers.Core.StateManager;
				const methods = [ [ this, 'prepareEarlierCreationInspection' ], [ this.bridge, 'prepareEarlierCreationDraftRecovery' ] ]
					.map( ( [ object, key ] ) => Store.captureWorkingCopyMethod( object, key ) );
				inspection = await methods[ 0 ].method.call( this, handle, client );
				Store.checkWorkingCopyMethods( methods ); inspection.preflight();
				return methods[ 1 ].method.call( this.bridge, inspection );
			} catch ( error ) {
				if ( inspection ) { try { inspection.release(); } catch ( cleanupError ) {} }
				throw this._error();
			}
		}

		static isEarlierCreationInspection( value ) { return earlierCreationInspections.has( value ); }

		/** Inactive earlier-base discovery; existing exact-base recovery remains unchanged. */
		listEarlierCreationCandidates() {
			if ( !workingCopyDraftControllers.has( this ) || !this.bridge.session.hasCreationImport() ) { throw this._error(); }
			return this.store.listEarlierCreationCandidates( this._scope() );
		}

		/** Native admission inspection only; no history reconstruction, application or backup writes. */
		async prepareEarlierCreationInspection( handle, client ) {
			let proof, returned = false;
			try {
				const Store = window.Layers.Core.StateManager, clone = Store.copyWorkingCopyValue;
				const session = this.bridge.session, editor = this.bridge.editor, history = editor.historyManager;
				if ( !workingCopyDraftControllers.has( this ) || !session.hasCreationImport() || session.getStatus().phase !== 'ready' ) { throw this._error(); }
				const scope = clone( this._scope() ), current = clone( session.captureCreationImportOrigin() );
				const draft = clone( session.getDraft() ), record = this.store.inspectEarlierCreationCandidate( handle );
				const envelope = clone( JSON.parse( record.raw ) );
				if ( ![ 'ready', 'saving', 'conflict', 'uncertain' ].includes( envelope.phase ) || envelope.pdfDraft || envelope.pdfHistory ||
					!envelope.creationOrigin || !envelope.workingCopyDraft || envelope.creationOrigin.origin.pageId !== current.origin.pageId ) { throw this._error(); }
				const observations = [ [ this, false ], [ this.bridge, false ], [ this.store, false ], [ session, false ],
					[ editor, false ], [ editor.config, true ], [ editor.stateManager, false ], [ editor.stateManager.state, true ] ]
					.map( ( [ object, deep ] ) => Store.observeWorkingCopyObject( object, deep ) );
				const methods = [ [ this, '_scope' ], [ this.store, 'inspectEarlierCreationCandidate' ], [ session, 'captureCreationImportOrigin' ],
					[ session, 'getDraft' ], [ history, 'captureWorkingCopyImportHistory' ], [ client, 'prepareDraftRebase' ] ]
					.map( ( [ object, key ] ) => Store.captureWorkingCopyMethod( object, key ) );
				const historyWitness = history.captureWorkingCopyImportHistory( this.bridge );
				if ( !history.constructor.isWorkingCopyImportHistory( historyWitness ) ) { throw this._error(); }
				let released = false;
				const check = () => {
					if ( released || window.Layers.Core.StateManager !== Store ) { throw this._error(); }
					observations.forEach( Store.checkWorkingCopyObservation ); Store.checkWorkingCopyMethods( methods ); historyWitness.preflight();
					if ( JSON.stringify( this._scope() ) !== JSON.stringify( scope ) ||
						JSON.stringify( session.captureCreationImportOrigin() ) !== JSON.stringify( current ) ||
						JSON.stringify( session.getDraft() ) !== JSON.stringify( draft ) ||
						this.store.inspectEarlierCreationCandidate( handle ).raw !== record.raw ) { throw this._error(); }
					if ( proof ) { proof.preflight(); }
				};
				check(); proof = await client.prepareDraftRebase( { pageId: current.origin.pageId,
					currentRevisionId: current.origin.revisionId, origin: envelope.creationOrigin } );
				if ( !window.Layers.Editor.PageOwnedCreationImportClient.isPreparedDraftRebase( proof ) ) { throw this._error(); }
				check(); const verified = proof.inspect(), native = verified.creation;
				const base = clone( draft.snapshot ); base.surfaces = base.surfaces.filter( surface => surface.id !== scope.surfaceId );
				const expectedBase = native.hasLayersSlot ? native.baseBundle.snapshot : { schemaVersion: 1, surfaces: [] };
				// Compare complete finite data independently of object member ordering.
				const same = ( left, right ) => {
					if ( left === right ) { return true; }
					if ( !left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray( left ) !== Array.isArray( right ) ) { return false; }
					const keys = Object.keys( left ); return keys.length === Object.keys( right ).length && keys.every( key => Object.hasOwn( right, key ) && same( left[ key ], right[ key ] ) );
				};
				const retainedOrigin = envelope.creationOrigin.origin;
				if ( !same( verified.origin, { pageId: retainedOrigin.pageId, revisionId: retainedOrigin.revisionId,
					surfaceId: retainedOrigin.surfaceId, selection: retainedOrigin.selection } ) ||
					native.target.owner !== scope.owner || native.target.surfaceId !== scope.surfaceId ||
					!same( native.selection, current.origin.selection ) || !same( native.newSurface, current.newSurface ) ||
					native.hasLayersSlot !== current.hasLayersSlot || !same( expectedBase, base ) ) { throw this._error(); }
				const prepared = Object.freeze( {
					inspect: () => { check(); return { scope: clone( record.scope ), writerId: record.writerId, envelope: clone( envelope ), native: proof.inspect() }; },
					preflight: check,
					revalidate: async () => { check(); await proof.revalidate(); check(); },
					readSource: async options => { check(); const result = await proof.read( options ); check(); return result; },
					release: () => { released = true; proof.release(); }
				} );
				check(); earlierCreationInspections.add( prepared ); returned = true; return prepared;
			} catch ( error ) { throw this._error(); }
			finally { if ( proof && !returned ) { try { proof.release(); } catch ( error ) {} } }
		}

		/** Explicit opt-in after actual full working-copy history has been enabled. */
		enableWorkingCopyDrafts() {
			this.bridge.captureWorkingCopyDraft();
			workingCopyDraftControllers.add( this );
		}

		/**
		 * @param {Object} bridge Loaded PageOwnedEditorBridge
		 * @param {Object} store PageOwnedDraftStore
		 * @param {Object} adapter PageOwnedSnapshotAdapter for lossless JSON copying
		 * @param {Object} scope Explicit wiki/user scope; document identity comes from the session
		 */
		constructor( bridge, store, adapter, scope ) {
			this.bridge = bridge;
			this.store = store;
			this.adapter = adapter;
			this.wiki = scope.wiki;
			this.user = scope.user;
			this._legacySurface = this._legacyOption( scope );
			this._legacyCandidates = new WeakSet();
			this._selectedLegacy = null;
		}

		/** @param {Object} scope Server-authorized draft options @return {?Object} @private */
		_legacyOption( scope ) {
			try {
				const option = Object.getOwnPropertyDescriptor( scope, 'legacySurface' );
				if ( !option ) {
					return null;
				}
				if ( !Object.prototype.hasOwnProperty.call( option, 'value' ) ) {
					throw this._error();
				}
				const value = option.value;
				const keys = value && typeof value === 'object' && !Array.isArray( value ) ?
					Reflect.ownKeys( value ) : [];
				if ( keys.length !== 2 || !keys.includes( 'surfaceId' ) || !keys.includes( 'baseRevisionId' ) ) {
					throw this._error();
				}
				const surface = Object.getOwnPropertyDescriptor( value, 'surfaceId' );
				const base = Object.getOwnPropertyDescriptor( value, 'baseRevisionId' );
				if ( !surface || !base || !Object.prototype.hasOwnProperty.call( surface, 'value' ) ||
					!Object.prototype.hasOwnProperty.call( base, 'value' ) ||
					typeof surface.value !== 'string' || surface.value.length === 0 ||
					!Number.isInteger( base.value ) || base.value < 1 || base.value > 2147483647 ) {
					throw this._error();
				}
				return Object.freeze( { surfaceId: surface.value, baseRevisionId: base.value } );
			} catch ( error ) {
				throw this._error();
			}
		}

		/** @param {Object} scope Current exact identity @return {?Object} @private */
		_legacyScope( scope ) {
			if ( !this._legacySurface || this._legacySurface.baseRevisionId !== scope.baseRevisionId ||
				this._legacySurface.surfaceId === scope.surfaceId ||
				typeof this.bridge.session.isUnsavedNew !== 'function' || !this.bridge.session.isUnsavedNew() ) {
				return null;
			}
			return Object.assign( {}, scope, { surfaceId: this._legacySurface.surfaceId } );
		}

		/** @return {Object} Current identity; rejects unloaded, disposed and historical sessions */
		_scope() {
			if ( this.bridge.session.getStatus().readOnly ) {
				throw this._error();
			}
			const draft = this.bridge.session.getDraft();
			return {
				wiki: this.wiki, user: this.user, owner: draft.owner,
				baseRevisionId: draft.baseRevisionId, surfaceId: draft.surfaceId
			};
		}

		/**
		 * Copy finite JSON without enforcing server layer validity or retained reading-order references.
		 * Invalid drawing edits must remain recoverable, but undefined/cycles must not be silently lost.
		 * @param {Object} state Canvas/layers pair
		 * @return {Object}
		 */
		_copyState( state ) {
			return this.adapter.toEditorState( {
				schemaVersion: 1,
				surfaces: [ { id: 'draft', kind: 'slide', canvas: state.canvas, layers: state.layers } ]
			}, 'draft' );
		}

		/** Explicit persistence; the UI handles storage errors and scheduling. */
		persist() {
			if ( wholePdfDraftControllers.has( this ) ) { return this.persistWholePdfDraft(); }
			const scope = this._scope();
			let json;
			try {
				const pdf = typeof this.bridge.session.getPdfStatus === 'function' && this.bridge.session.getPdfStatus();
				if ( pdf ) {
					this.bridge.capture();
				}
				const working = workingCopyDraftControllers.has( this ) ? this.bridge.captureWorkingCopyDraft() : null;
				const creationOrigin = working && typeof this.bridge.session.hasCreationImport === 'function' &&
					this.bridge.session.hasCreationImport() ? this.bridge.session.captureCreationImportOrigin() : null;
				json = JSON.stringify( {
					version: 1, scope,
					phase: this.bridge.session.getStatus().phase,
					label: this.bridge.session.getLabel(),
					...( pdf ? { pdfDraft: this.bridge.session.getDraft(),
						pdfHistory: this.bridge.pdfCoordinator.captureDraftHistory() } : {} ),
					editorState: this._copyState( working ? working.editorState : this.bridge.getLiveState() ),
					...( creationOrigin ? { creationOrigin } : {} ),
					...( working ? { workingCopyDraft: working.workingCopyDraft } : {} )
				} );
			} catch ( error ) {
				throw this._error();
			}
			this.store.write( scope, json );
		}

		/** Explicit close permission never transfers ownership of a recovery source. */
		retireOwned() {
			this.store.retireOwned();
		}

		/**
		 * Inspect only the exact loaded base. Does not apply edits, advance the base, or retry a POST.
		 * @return {?Object} Candidate for explicit recovery; publicationBlocked requires reconciliation
		 */
		inspectRecovery() {
			const current = this._scope();
			const scope = this._selectedLegacy ? this._legacyScope( current ) : current;
			if ( !scope || ( this._selectedLegacy && this._selectedLegacy.surfaceId !== scope.surfaceId ) ) {
				throw this._error();
			}
			const raw = this.store.read( scope );
			if ( raw === null ) {
				return null;
			}
			try {
				const envelope = JSON.parse( raw );
				if ( Object.hasOwn( envelope, 'wholePdfImportDraft' ) ) { return this.inspectWholePdfDraft( envelope, scope, raw ); }
				if ( envelope.version !== 1 || !envelope.scope ||
					Object.keys( envelope.scope ).length !== Object.keys( scope ).length ||
					Object.keys( scope ).some( ( key ) => envelope.scope[ key ] !== scope[ key ] ) ||
					![ 'ready', 'saving', 'conflict', 'uncertain' ].includes( envelope.phase ) ) {
					throw this._error();
				}
				const candidate = {
					editorState: this._copyState( envelope.editorState ),
					publicationBlocked: envelope.phase !== 'ready'
				};
				// Drafts written before drawings could be renamed have no name.
				if ( typeof envelope.label === 'string' ) {
					candidate.label = envelope.label;
				}
				if ( Object.prototype.hasOwnProperty.call( envelope, 'workingCopyDraft' ) ) {
					if ( !workingCopyDraftControllers.has( this ) || envelope.pdfDraft || envelope.pdfHistory ) { throw this._error(); }
					const carrier = { id: 'working-copy-draft', kind: 'slide', canvas: {}, layers: [] };
					candidate.workingCopyDraft = this.adapter.withEditorState( {
						schemaVersion: 1, surfaces: [ carrier ], workingCopyDraft: envelope.workingCopyDraft
					}, carrier.id, { canvas: {}, layers: [] } ).workingCopyDraft;
				}
				if ( envelope.pdfDraft !== undefined ) {
					if ( typeof this.bridge.session.getPdfStatus !== 'function' || !this.bridge.session.getPdfStatus() ) {
						throw this._error();
					}
					const carrier = { id: 'pdf-draft', kind: 'slide', canvas: {}, layers: [] };
					candidate.pdfDraft = this.adapter.withEditorState( { schemaVersion: 1, surfaces: [ carrier ],
						pdfDraft: envelope.pdfDraft }, carrier.id, { canvas: {}, layers: [] } ).pdfDraft;
					if ( !candidate.pdfDraft || candidate.pdfDraft.owner !== scope.owner ||
						candidate.pdfDraft.baseRevisionId !== scope.baseRevisionId ||
						candidate.pdfDraft.surfaceId !== scope.surfaceId || !candidate.pdfDraft.pdf ||
						candidate.pdfDraft.pdf.version !== 1 ) {
						throw this._error();
					}
				}
				if ( Object.prototype.hasOwnProperty.call( envelope, 'pdfHistory' ) ) {
					if ( !candidate.pdfDraft || !this.bridge.pdfCoordinator ) throw this._error();
					candidate.pdfHistory = this.bridge.pdfCoordinator.copyDraftHistory( envelope.pdfHistory, candidate.pdfDraft );
				}
				return candidate;
			} catch ( error ) {
				throw this._error();
			}
		}

		/** @return {Array} IDs of independent records for this authorized exact revision */
		listCandidates() {
			const scope = this._scope();
			const candidates = this.store.listCandidates( scope );
			const legacy = this._legacyScope( scope );
			if ( legacy ) {
				for ( const writerId of this.store.listCandidates( legacy ) ) {
					const candidate = Object.freeze( { surfaceId: legacy.surfaceId, writerId } );
					this._legacyCandidates.add( candidate );
					candidates.push( candidate );
				}
			}
			return candidates;
		}

		/** @param {Array} ids Record IDs @return {Array} Text-preview data; corrupt records remain untouched */
		describeCandidates( ids ) {
			return ids.map( ( id ) => {
				try {
					this.selectRecovery( id );
					return this.inspectRecovery() || {};
				} catch ( error ) {
					return {};
				}
			} );
		}

		/** @param {string|Object|null} candidate Source only; writes retain this editor's independent ID */
		selectRecovery( candidate ) {
			if ( candidate !== null && typeof candidate === 'object' ) {
				const legacy = this._legacyScope( this._scope() );
				if ( !this._legacyCandidates.has( candidate ) || !legacy || candidate.surfaceId !== legacy.surfaceId ) {
					throw this._error();
				}
				this.store.selectRecovery( candidate.writerId );
				this._selectedLegacy = candidate;
			} else {
				this.store.selectRecovery( candidate );
				this._selectedLegacy = null;
			}
		}

		/** @return {Error} @private */
		_error() {
			const error = new Error( 'layers-invalid-page-owned-draft' );
			error.code = 'layers-invalid-page-owned-draft';
			return error;
		}
	}

	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedDraftController = PageOwnedDraftController;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedDraftController;
	}
}() );
