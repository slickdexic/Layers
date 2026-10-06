/** Draft capture and recovery inspection after an authorized exact-revision load. */
( function () {
	'use strict';

	class PageOwnedDraftController {
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
			const scope = this._scope();
			let json;
			try {
				json = JSON.stringify( {
					version: 1, scope,
					phase: this.bridge.session.getStatus().phase,
					label: this.bridge.session.getLabel(),
					editorState: this._copyState( this.bridge.getLiveState() )
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
