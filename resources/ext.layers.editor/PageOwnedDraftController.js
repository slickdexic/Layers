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

		/**
		 * Inspect only the exact loaded base. Does not apply edits, advance the base, or retry a POST.
		 * @return {?Object} Candidate for explicit recovery; publicationBlocked requires reconciliation
		 */
		inspectRecovery() {
			const scope = this._scope();
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
			return this.store.listCandidates( this._scope() );
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

		/** @param {?string} writerId Select a source only; writes retain this editor's independent ID */
		selectRecovery( writerId ) {
			this.store.selectRecovery( writerId );
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
