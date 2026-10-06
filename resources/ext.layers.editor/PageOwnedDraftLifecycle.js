/** Connect draft storage to a loaded editor; recovery always requires an explicit choice. */
( function () {
	'use strict';
	const keys = [ 'layers', 'slideCanvasWidth', 'slideCanvasHeight', 'slideBackgroundColor',
		'backgroundVisible', 'backgroundOpacity' ];

	// Stored revisions have sorted keys while editor objects keep creation order; order is not content.
	function canonical( value ) {
		if ( Array.isArray( value ) ) {
			return '[' + value.map( canonical ).join( ',' ) + ']';
		}
		if ( value && typeof value === 'object' ) {
			return '{' + Object.keys( value ).sort().map( ( key ) =>
				JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		}
		return JSON.stringify( value );
	}

	class PageOwnedDraftLifecycle {
		/**
		 * @param {Object} bridge Loaded editor bridge
		 * @param {Object} controller Draft controller
		 * @param {Object} ui Injected async confirmRecovery and notifyFailure/notifyBlocked callbacks
		 */
		constructor( bridge, controller, ui ) {
			this.bridge = bridge;
			this.controller = controller;
			this.ui = ui;
			this.ready = false;
			this.checking = false;
			this.saving = false;
			this.finalized = false;
			this.disposed = false;
			this.timer = null;
			this.unsubscribers = [];
			this.onPageHide = () => this.flush();
		}

		/** @return {Promise<void>} Authorization/exact revision loading must already have succeeded */
		async initialize() {
			const candidates = this.controller.listCandidates();
			if ( candidates.length ) {
				const selected = candidates.length === 1 ? 0 :
					await this.ui.chooseDraft( this.controller.describeCandidates( candidates ) );
				if ( this.disposed ) {
					return;
				}
				if ( !Number.isInteger( selected ) || selected < 0 || selected >= candidates.length ) {
					this.ui.notifyBlocked();
					return;
				}
				this.controller.selectRecovery( candidates[ selected ] );
			}
			const candidate = this.controller.inspectRecovery();
			if ( candidate && ( candidate.publicationBlocked ||
				( typeof candidate.label === 'string' && candidate.label !== this.bridge.getName() ) ||
				canonical( candidate.editorState ) !== canonical( this.bridge.getLiveState() ) ) ) {
				const recover = await this.ui.confirmRecovery( candidate );
				if ( this.disposed ) {
					return;
				}
				if ( recover ) {
					await this.bridge.session.revalidate();
					if ( this.disposed ) {
						return;
					}
					this.bridge.restoreDraft( candidate );
					if ( candidate.publicationBlocked ) {
						this.ui.notifyBlocked();
					}
				} else {
					// Cancel is not permission to overwrite the stored draft with server content.
					this.bridge.session.blockPublication();
					this.ui.notifyBlocked();
					return;
				}
			}
			this.ready = true;
			for ( const key of keys ) {
				this.unsubscribers.push( this.bridge.editor.stateManager.subscribe( key, () => {
					if ( this.finalized || this.disposed ) {
						return;
					}
					clearTimeout( this.timer );
					this.timer = setTimeout( () => this.flush(), 1000 );
				} ) );
			}
			window.addEventListener( 'pagehide', this.onPageHide );
		}

		/** @return {boolean} A failed backup never replaces or clears current editor data */
		flush() {
			clearTimeout( this.timer );
			if ( !this.ready || this.disposed || this.finalized ) {
				return false;
			}
			try {
				this.controller.persist();
				return true;
			} catch ( error ) {
				this.ui.notifyFailure();
				return false;
			}
		}

		/**
		 * @param {boolean} discard Explicit Discard, rather than a completed clean close
		 * @return {boolean} Failure keeps the editor and its unsaved state open
		 */
		finalizeClose( discard = false ) {
			if ( this.finalized ) {
				return true;
			}
			if ( this.disposed || this.saving || this.checking ||
				this.bridge.session.getStatus().phase === 'saving' ||
				( !discard && this.bridge.session.getStatus().phase !== 'ready' ) ) {
				return false;
			}
			try {
				this.controller.retireOwned();
			} catch ( error ) {
				this.ui.notifyFailure();
				return false;
			}
			this.finalized = true;
			this.ready = false;
			clearTimeout( this.timer );
			this.unsubscribers.forEach( ( unsubscribe ) => unsubscribe() );
			this.unsubscribers = [];
			window.removeEventListener( 'pagehide', this.onPageHide );
			return true;
		}

		/**
		 * @param {string} name Proposed drawing name
		 * @return {string} The name as it will be saved; the draft keeps it until then
		 */
		rename( name ) {
			if ( !this.ready || this.disposed ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			const label = this.bridge.rename( name );
			this.flush();
			return label;
		}

		/** @param {string} summary History summary @return {Promise<Object>} */
		async save( summary = '' ) {
			if ( !this.ready || this.disposed || this.checking || this.saving ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			this.saving = true;
			let result;
			try {
				result = await this.bridge.save( summary, () => {
					if ( this.finalized || this.disposed ) {
						throw new Error( 'layers-editor-session-unavailable' );
					}
					this.controller.persist();
				} );
			} finally {
				this.saving = false;
				// Persist the confirmed new base or the conflict/uncertain state plus latest edits.
				const persisted = this.flush();
				if ( result ) {
					result.draftPersisted = persisted;
				}
			}
			return result;
		}

		/**
		 * Preserve the draft before discovering and comparing the current server revision.
		 * @param {Function} resolveRevision Read-only current revision discovery
		 * @return {Promise<Object>} Reconciliation status; never publishes
		 */
		async reconcile( resolveRevision ) {
			if ( !this.ready || this.disposed || this.checking ||
				this.bridge.session.getStatus().phase === 'saving' ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			this.checking = true;
			let result;
			try {
				if ( !this.flush() ) {
					throw new Error( 'layers-draft-storage-failed' );
				}
				const revisionId = await resolveRevision();
				if ( this.disposed ) {
					throw new Error( 'layers-editor-session-unavailable' );
				}
				result = await this.bridge.reconcile( revisionId );
				return result;
			} finally {
				this.checking = false;
				const persisted = this.flush();
				if ( result ) {
					result.draftPersisted = persisted;
				}
			}
		}

		/** Flush before disposing the bridge. */
		dispose() {
			this.flush();
			this.disposed = true;
			clearTimeout( this.timer );
			this.unsubscribers.forEach( ( unsubscribe ) => unsubscribe() );
			window.removeEventListener( 'pagehide', this.onPageHide );
		}
	}
	window.Layers = window.Layers || {};
	window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedDraftLifecycle = PageOwnedDraftLifecycle;
	if ( typeof module !== 'undefined' && module.exports ) {
		module.exports = PageOwnedDraftLifecycle;
	}
}() );
