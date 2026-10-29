/** Connect draft storage to a loaded editor; recovery always requires an explicit choice. */
( function () {
	'use strict';
	const keys = [ 'layers', 'slideCanvasWidth', 'slideCanvasHeight', 'slideBackgroundColor',
		'backgroundVisible', 'backgroundOpacity' ];
	const earlierCreationClients = new WeakMap();
	const wholePdfControllers = new WeakMap();
	const earlierPdfCreationClients = new WeakMap();

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

	// Independent sessions have different timestamps; compare recoverable history content.
	function workingCopyDraftChanged( bridge, candidate ) {
		if ( !candidate.workingCopyDraft ) { return false; }
		const current = bridge.captureWorkingCopyDraft().workingCopyDraft;
		const comparable = data => ( { ...data.timeline, history: data.timeline.history.map( entry => {
			const copy = { ...entry }; delete copy.timestamp; return copy;
		} ), workingState: data.workingState } );
		return canonical( comparable( candidate.workingCopyDraft ) ) !== canonical( comparable( current ) );
	}

	class PageOwnedDraftLifecycle {
		/** Existing explicit Restore/Keep actions, backed by the complete-PDF transaction. */
		async initializeWholePdfRecovery( candidate ) {
			const bridge = this.bridge, controller = this.controller, ui = this.ui, coordinator = bridge.pdfCoordinator;
			const actions = wholePdfControllers.get( this );
			if ( !actions ) { throw new Error( 'layers-invalid-page-owned-draft' ); }
			const witness = coordinator.witness( true ), version = coordinator.version;
			const check = () => {
				actions.preflight();
				if ( this.disposed || this.finalized || this.saving || this.checking || this.bridge !== bridge || this.controller !== controller ||
					this.ui !== ui || bridge.disposed || bridge.pdfCoordinator !== coordinator || coordinator.version !== version ||
					coordinator.witness( true ) !== witness ) { throw new Error( 'layers-editor-session-unavailable' ); }
			};
			check();
			if ( actions.changed( candidate ) ) {
				const restore = await ui.confirmRecovery( candidate ); check();
				if ( !restore ) {
					bridge.session.blockPublication(); ui.notifyBlocked(); return;
				}
				let handle;
				try {
					handle = await actions.prepare( candidate, check ); check();
					await actions.commit( handle );
				} finally { if ( handle ) { actions.release( handle ); } }
				if ( this.disposed || this.finalized ) { return; }
				if ( candidate.publicationBlocked ) { ui.notifyBlocked(); }
			}
			if ( this.disposed || this.finalized ) { return; }
			this.ready = true;
			for ( const key of keys ) {
				this.unsubscribers.push( bridge.editor.stateManager.subscribe( key, () => {
					if ( this.finalized || this.disposed ) { return; }
					clearTimeout( this.timer ); this.timer = setTimeout( () => this.flush(), 1000 );
				} ) );
			}
			window.addEventListener( 'pagehide', this.onPageHide );
		}

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
			const Controller = window.Layers && window.Layers.Editor && window.Layers.Editor.PageOwnedDraftController;
			if ( Controller && controller instanceof Controller && Controller.prototype.hasWholePdfDrafts.call( controller ) ) {
				const actions = Controller.prototype.getWholePdfDraftActions.call( controller );
				if ( !Controller.isWholePdfDraftActions( actions, controller ) ) { throw new Error( 'layers-invalid-page-owned-draft' ); }
				wholePdfControllers.set( this, actions );
			}
		}

		/** Opt in only through the admitted creation Import integration. */
		enableEarlierCreationRecovery( client ) {
			if ( this.ready || this.disposed || this.finalized || !this.bridge.session.hasCreationImport() ) {
				throw new Error( 'layers-editor-session-unavailable' );
			}
			earlierCreationClients.set( this, client );
		}

		/** Connect earlier complete creation backups to the same approved Review/Restore flow. */
		enableEarlierPdfCreationRecovery( dependencies ) {
			if ( this.ready || this.disposed || this.finalized || !wholePdfControllers.has( this ) || earlierCreationClients.has( this ) ||
				earlierPdfCreationClients.has( this ) ) throw new Error( 'layers-editor-session-unavailable' );
			this.controller.enableEarlierPdfCreationRecovery( dependencies ); earlierPdfCreationClients.set( this, dependencies );
		}

		/** Review private plans before listing them; cancellation never selects an earlier writer. */
		async _chooseEarlierCreationRecovery( client, pdf = false ) {
			const bridge = this.bridge, controller = this.controller, ui = this.ui, plans = [];
			const clients = pdf ? earlierPdfCreationClients : earlierCreationClients;
			const release = handle => pdf ? controller.releaseEarlierPdfCreationRecovery( handle ) : bridge.releaseEarlierCreationDraftRecovery( handle );
			let earlierSelected = false;
			const guard = () => {
				if ( this.disposed || this.finalized || this.saving || this.checking ||
					this.bridge !== bridge || this.controller !== controller || this.ui !== ui ||
					clients.get( this ) !== client ) { throw new Error( 'layers-editor-session-unavailable' ); }
			};
			const failed = () => { if ( !this.disposed && !this.finalized ) { ui.notifyEarlierFailure(); } };
			try {
				guard(); const handles = pdf ? controller.listEarlierPdfCreationCandidates() : controller.listEarlierCreationCandidates();
				if ( !handles.length ) { return null; }
				const current = controller.listCandidates(), descriptors = controller.describeCandidates( current );
				for ( const candidate of handles ) {
					let handle;
					try {
						guard(); handle = pdf ? await controller.prepareEarlierPdfCreationRecovery( candidate, guard ) :
							await controller.prepareEarlierCreationRecovery( candidate, client ); guard();
						const preview = pdf ? controller.reviewEarlierPdfCreationRecovery( handle ) : await bridge.reviewEarlierCreationDraftRecovery( handle, guard ); guard();
						plans.push( { handle, preview: { ...preview, earlierCreation: true, earlierNumber: plans.length + 1 } } );
					} catch ( error ) {
						if ( handle ) { try { release( handle ); } catch ( cleanupError ) {} }
						// An unprovable backup stays intact and is not offered as an eligible draft.
						guard();
					}
				}
				if ( !plans.length ) { return null; }
				const all = descriptors.concat( plans.map( plan => plan.preview ) );
				const choice = await ui.chooseEarlierDraft( all ); guard();
				if ( !choice || !Number.isInteger( choice.selected ) || choice.selected < 0 || choice.selected >= all.length ) {
					if ( current.length && !( choice && Number.isInteger( choice.cancelled ) &&
						choice.cancelled >= current.length && choice.cancelled < all.length ) ) {
						ui.notifyBlocked(); return { blocked: true };
					}
					return { completed: true, current: [] };
				}
				if ( choice.selected < current.length ) { return { current: [ current[ choice.selected ] ] }; }
				earlierSelected = true;
				const plan = plans[ choice.selected - current.length ];
				const restore = await ui.confirmRecovery( plan.preview ); guard();
				if ( restore ) {
					if ( pdf ) await controller.commitEarlierPdfCreationRecovery( plan.handle );
					else await bridge.commitEarlierCreationDraftRecovery( plan.handle, guard ); guard();
					if ( plan.preview.publicationBlocked ) { ui.notifyBlocked(); }
				}
				return { completed: true, current: [] };
			} catch ( error ) {
				failed(); return earlierSelected ? { completed: true, current: [] } : null;
			} finally {
				for ( const plan of plans ) {
					try { release( plan.handle ); } catch ( error ) {}
				}
			}
		}

		/** @return {Promise<void>} Authorization/exact revision loading must already have succeeded */
		async initialize() {
			const pdf = earlierPdfCreationClients.has( this ), client = pdf ? earlierPdfCreationClients.get( this ) : earlierCreationClients.get( this );
			const choice = client ? await this._chooseEarlierCreationRecovery( client, pdf ) : null;
			if ( this.disposed || this.finalized || ( choice && choice.blocked ) ) { return; }
			const candidates = choice ? choice.current : this.controller.listCandidates();
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
			const candidate = choice && choice.completed ? null : this.controller.inspectRecovery();
			if ( candidate && candidate.wholePdfImportDraft ) { return this.initializeWholePdfRecovery( candidate ); }
			if ( candidate && ( candidate.publicationBlocked ||
				workingCopyDraftChanged( this.bridge, candidate ) ||
				( typeof candidate.label === 'string' && candidate.label !== this.bridge.getName() ) ||
				( candidate.pdfDraft && canonical( candidate.pdfDraft.snapshot ) !==
					canonical( this.bridge.session.getDraft().snapshot ) ) ||
				canonical( candidate.editorState ) !== canonical( this.bridge.getLiveState() ) ) ) {
				const coordinator = this.bridge.pdfCoordinator;
				const witness = coordinator ? coordinator.witness() : null;
				const version = coordinator ? coordinator.version : null;
				const workingHandle = candidate.workingCopyDraft ? this.bridge.prepareWorkingCopyDraftRecovery( candidate ) : null;
				let recover;
				try {
					recover = await this.ui.confirmRecovery( candidate );
					if ( workingHandle && recover ) { this.bridge.preflightWorkingCopyDraftRecovery( workingHandle ); }
				} catch ( error ) {
					if ( workingHandle ) { this.bridge.releaseWorkingCopyDraftRecovery( workingHandle ); }
					throw error;
				}
				if ( this.disposed || ( workingHandle && this.finalized ) ) {
					if ( workingHandle ) { this.bridge.releaseWorkingCopyDraftRecovery( workingHandle ); }
					return;
				}
				if ( recover ) {
					if ( coordinator && ( coordinator.version !== version || coordinator.witness() !== witness ) ) {
						throw new Error( 'layers-editor-session-unavailable' );
					}
					if ( !candidate.pdfDraft && !workingHandle ) {
						await this.bridge.session.revalidate();
					}
					if ( this.disposed ) {
						return;
					}
					if ( workingHandle ) { await this.bridge.commitWorkingCopyDraftRecovery( workingHandle ); }
					else { await this.bridge.restoreDraft( candidate ); }
					if ( this.disposed || this.finalized ) {
						return;
					}
					if ( candidate.publicationBlocked ) {
						this.ui.notifyBlocked();
					}
				} else {
					if ( workingHandle ) { this.bridge.releaseWorkingCopyDraftRecovery( workingHandle ); }
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
			if ( this.bridge.pdfCoordinator && this.bridge.pdfCoordinator.recoveryOperation ) {
				this.bridge.pdfCoordinator.invalidate();
			}
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
			const previous = typeof this.controller._scope === 'function' ? this.controller._scope() : null;
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
					if ( persisted && result.editorStateValid === true && previous &&
						this.controller.store && typeof this.controller.store.retireConfirmed === 'function' ) {
						try {
							const current = this.controller._scope();
							if ( current.baseRevisionId === result.revisionId ) {
								this.controller.store.retireConfirmed( previous, current );
							}
						} catch ( error ) {
							// A failed cleanup leaves the confirmed replacement in place.
						}
					}
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
			if ( this.bridge.pdfCoordinator && this.bridge.pdfCoordinator.recoveryOperation ) {
				this.bridge.pdfCoordinator.invalidate();
			}
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
