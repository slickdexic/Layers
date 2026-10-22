/** Connect native missing-PDF admission to the existing editor and saved-session lifecycle. */
( function () {
	'use strict';
	const unavailable = () => Object.assign( new Error( 'layers-editor-session-unavailable' ), { code: 'layers-editor-session-unavailable' } );
	function canonical( value ) {
		if ( Array.isArray( value ) ) return '[' + value.map( canonical ).join( ',' ) + ']';
		if ( value && typeof value === 'object' ) return '{' + Object.keys( value ).sort()
			.map( key => JSON.stringify( key ) + ':' + canonical( value[ key ] ) ).join( ',' ) + '}';
		return JSON.stringify( value );
	}
	class PageOwnedPdfCreationIntegration {
		constructor( manager ) {
			const classes = window.Layers.Editor, editor = manager.editor, config = editor.config.pageOwned;
			const preparation = window.Layers.Core.StateManager.copyWorkingCopyValue( config.pdfCreation );
			if ( !preparation || !preparation.target || config.owner !== preparation.target.owner || config.pageId !== preparation.target.pageId ||
				config.revisionId !== preparation.target.revisionId || config.surfaceId !== preparation.target.surfaceId || config.readOnly ) throw unavailable();
			this.manager = manager; this.editor = editor; this.classes = classes; this.api = manager.api;
			this.preparation = preparation; this.identity = window.Layers.Core.StateManager.copyWorkingCopyValue( config.draftScope );
			this.loaded = false; this.disposed = false; this.closed = false; this.transferred = false; this.operation = null;
			this.host = null; this.lifecycle = null; this.controller = null;
			this.importsEnabled = false; this.importControl = null; this.importCatalog = null; this.importChoices = new WeakMap();
			this.savedBridge = null; this.savedDrafts = null;
			this.onPageHide = () => { if ( this.transferred && !this.disposed ) this.preserveSavedExit(); };
			this.reader = new classes.PageOwnedPdfCreationReadClient( this.api );
			this.publisher = new classes.PageOwnedPublishClient( this.api );
			this.savedDependencies = { reader: new classes.PageOwnedReadClient( this.api ),
				pdfReader: new classes.PageOwnedPdfEditorReadClient( this.api ), publisher: this.publisher };
		}

		alive() {
			if ( this.disposed || this.closed || this.editor.isDestroyed || this.manager.editor !== this.editor ||
				this.manager.api !== this.api || this.editor.apiManager !== this.manager || this.manager.pageOwnedCreation !== this ) throw unavailable();
		}

		store() {
			const random = new Uint8Array( 16 ); window.crypto.getRandomValues( random );
			return new this.classes.PageOwnedDraftStore( window.localStorage,
				Array.from( random, value => value.toString( 16 ).padStart( 2, '0' ) ).join( '' ) );
		}

		notify( key, type = 'error' ) { try { mw.notify( mw.msg( key ), { type } ); } catch ( error ) {} }

		async load() {
			this.alive(); if ( this.loaded || this.operation || this.host ) throw unavailable(); this.operation = 'load';
			window.addEventListener( 'pagehide', this.onPageHide, true );
			this.editor.stateManager.set( 'isLoading', true );
			try {
				// The native creation host owns exact staging; an initial canvas load must not race it.
				if ( this.editor.canvasManager.imageLoader ) {
					this.editor.canvasManager.imageLoader.destroy(); this.editor.canvasManager.imageLoader = null;
				}
				this.host = new this.classes.PageOwnedPdfCreationHost( this.editor, this.preparation, { reader: this.reader, publisher: this.publisher } );
				if ( !await this.host.load() ) throw unavailable(); this.alive();
				this.controller = new this.classes.PageOwnedPdfCreationDraftController( this.host, this.store(), this.identity, { retainPublicationAttempt: true } );
				// Preserve ordinary creation recovery. Only complete Import backups require the Import host before review.
				for ( const candidate of this.controller.listCandidates() ) {
					try { if ( [ 3, 4 ].includes( this.controller.inspectCandidate( candidate ).version ) ) { this.enableImports(); break; } }
					catch ( error ) { /* The existing recovery review reports corrupt or unavailable backups. */ }
				}
				this.dialog = new this.classes.PageOwnedRecoveryDialog( ( ...args ) => mw.msg( ...args ) );
				this.lifecycle = new this.classes.PageOwnedPdfCreationLifecycle( this.editor, this.host, this.controller, this.store(), {
					choose: previews => this.dialog.choose( previews ), confirm: preview => this.dialog.confirm( preview ),
					notifyFailure: () => this.notify( 'layers-page-draft-failed' ), notifyBlocked: () => this.notify( 'layers-page-draft-blocked', 'warn' )
				} );
				await this.lifecycle.initialize(); this.alive(); this.loaded = true;
				// Recovery presentation ran before unsavedPages could read the initialized host.
				this.editor.refreshPageControls();
				this.manager.pageOwnedRevisionControl = new this.classes.PageOwnedRevisionControl( {
					check: () => this.manager.checkPageOwnedRevision(), message: ( ...args ) => mw.msg( ...args ) } );
				this.manager.pageOwnedRevisionControl.mount( this.editor.uiManager.container );
				const header = this.editor.uiManager.container.querySelector( '.layers-header' );
				if ( header && this.classes.PageOwnedSummaryField ) {
					this.manager.pageOwnedSummaryField = new this.classes.PageOwnedSummaryField( key => mw.msg( key ) );
					this.manager.pageOwnedSummaryField.mount( header, header.querySelector( '.layers-header-right' ) );
				}
				if ( header && this.classes.PageOwnedWholePdfImportCatalogClient ) this.mountImport( header );
				return this.host.getLiveState();
			} finally { this.operation = null; if ( !this.editor.isDestroyed ) this.editor.stateManager.set( 'isLoading', false ); }
		}

		enableImports() {
			if ( this.importsEnabled ) return;
			this.alive();
			this.savedDependencies.importSource = new this.classes.PageOwnedWholePdfImportSource( this.api );
			this.savedDependencies.importPublisher = new this.classes.PageOwnedWholePdfImportPublishClient( this.api );
			this.host.enableImports( this.api ); this.host.enableImportHistory(); this.importsEnabled = true;
		}

		canImport() {
			try {
				this.alive(); const status = this.host.getStatus(), lifecycle = this.lifecycle.getStatus();
				return this.loaded && !this.transferred && !this.operation && lifecycle.ready && !lifecycle.operation &&
					status.phase === 'ready' && !status.needsRefresh && !status.publicationBlocked && !status.saving && !status.recovering;
			} catch ( error ) { return false; }
		}

		mountImport( header ) {
			const catalog = new this.classes.PageOwnedWholePdfImportCatalogClient( this.api ); this.importCatalog = catalog;
			const match = { pageId: this.preparation.target.pageId, kind: 'pdf', label: this.preparation.context.label,
				fileTitle: this.preparation.anchorSurface.source.fileTitle };
			this.importControl = new this.classes.PageOwnedImportControl( {
				getTarget: () => {
					this.alive(); const draft = this.host.getDraft(), live = this.host.getLiveState();
					const baseCount = draft.creation.baseBundle ? draft.creation.baseBundle.snapshot.surfaces.length : 0;
					return { match, kind: 'pdf', name: match.label, owner: this.preparation.target.owner, canvas: live.canvas,
						layerCount: draft.snapshot.surfaces.slice( baseCount ).reduce( ( count, surface ) => count + surface.layers.length, 0 ) };
				},
				canImport: () => this.canImport(), message: ( ...args ) => mw.msg( ...args ),
				allocateId: () => this.manager.generateLayerId(), maxLayers: mw.config.get( 'wgLayersMaxLayerCount' ) || 100,
				catalog: { search: async request => {
					const result = await catalog.search( request ); this.alive();
					for ( const choice of result ) this.importChoices.set( choice.source, choice.label ); return result;
				} },
				coordinator: {
					prepare: async ( source, options ) => {
						if ( !this.canImport() || !this.importChoices.has( source ) || !this.importControl.dialog ) throw unavailable();
						const control = this.importControl, dialog = control.dialog, generation = control.generation;
						this.enableImports();
						const result = await this.host.prepareImport( { owner: source.owner, pageId: source.pageId,
							revisionId: source.revisionId, surfaceId: source.surfaceId }, options );
						if ( !this.canImport() || this.importControl !== control || control.dialog !== dialog || control.generation !== generation ) {
							this.host.releaseImport( result.handle ); throw unavailable();
						}
						return result.handle;
					},
					inspect: handle => {
						const preview = this.host.inspectImport( handle );
						return { ...preview, source: { ...preview.source, label: preview.sourceLabel } };
					},
					apply: handle => { if ( !this.canImport() || !this.host.commitImport( handle ).applied ) throw unavailable(); },
					release: handle => this.host.releaseImport( handle )
				},
				onApplied: () => this.lifecycle.flush()
			} );
			this.importControl.mount( header, header.querySelector( '.layers-header-right' ) );
		}

		disposeImportControl() {
			if ( this.importControl ) this.importControl.dispose();
			if ( this.importCatalog ) this.importCatalog.dispose();
			this.importControl = null; this.importCatalog = null;
		}

		turn( page ) {
			try { this.alive(); if ( !this.loaded || this.operation || !this.lifecycle.getStatus().ready ) return Promise.resolve( false );
				return this.host.turn( page ); } catch ( error ) { return Promise.resolve( false ); }
		}

		unsavedPages() {
			if ( this.closed ) return [];
			this.alive(); if ( !this.host || !this.loaded ) return [];
			const envelope = this.host.captureExitEnvelope(), draft = envelope.draft;
			const base = envelope.confirmation ? envelope.confirmation.snapshot.surfaces :
				( draft.creation.baseBundle ? draft.creation.baseBundle.snapshot.surfaces : [] );
			const count = draft.creation.baseBundle ? draft.creation.baseBundle.snapshot.surfaces.length : 0;
			return draft.snapshot.surfaces.slice( count ).filter( surface => {
				const previous = base.find( row => row.id === surface.id ); return !previous || canonical( previous ) !== canonical( surface );
			} ).map( surface => surface.source.page ).sort( ( left, right ) => left - right );
		}

		/** A known first-Save reply stays known if a later handoff or local backup fails. */
		async save() {
			this.alive(); if ( !this.loaded || this.operation ) throw unavailable(); this.operation = 'save';
			const summary = this.manager.pageOwnedSummaryField; let result;
			try {
				result = await this.lifecycle.save( summary ? summary.getValue() : '' );
				if ( summary ) summary.clear();
				if ( !result.hostReady ) return { ...result, dirty: true, editorStateValid: false };
				return { ...result, ...await this.handoff() };
			} catch ( error ) {
				if ( result ) { this.notify( 'layers-page-draft-failed' ); return { ...result, dirty: true, editorStateValid: false, draftPersisted: false }; }
				throw error;
			} finally { this.operation = null; }
		}

		async handoff() {
			this.alive();
			const delivered = await this.lifecycle.handoffSavedSession( this.savedDependencies, bridge => {
				this.alive(); this.manager.pageOwnedBridge = bridge; this.savedBridge = bridge; this.transferred = true;
				const draft = bridge.session.getDraft();
				this.editor.config.pageOwned = { owner: draft.owner, pageId: this.preparation.target.pageId,
					revisionId: draft.baseRevisionId, surfaceId: draft.surfaceId, readOnly: false, draftScope: this.identity };
			} );
			try { this.alive(); } catch ( error ) { delivered.bridge.dispose(); throw error; }
			const manager = this.manager, draft = delivered.bridge.session.getDraft();
			if ( manager.pageOwnedRevisionControl ) manager.pageOwnedRevisionControl.dispose();
			if ( manager.pageOwnedSummaryField ) manager.pageOwnedSummaryField.dispose();
			if ( this.dialog ) this.dialog.dispose();
			this.disposeImportControl();
			await manager.initializePageOwnedDrafts( delivered.bridge.getLiveState(), true,
				delivered.importApplication ? delivered : undefined );
			this.alive();
			const persisted = manager.pageOwnedDrafts.ready && manager.pageOwnedDrafts.flush();
			if ( delivered.needsRefresh || !persisted ) delivered.bridge.session.blockPublication();
			return { phase: 'ready', revisionId: draft.baseRevisionId, dirty: delivered.bridge.session.getStatus().dirty,
				editorStateValid: !delivered.needsRefresh && persisted, draftPersisted: Boolean( persisted ) };
		}

		async check() {
			this.alive(); if ( !this.loaded || this.operation ) throw unavailable(); this.operation = 'check';
			try {
				if ( this.host.getStatus().phase === 'confirmed' ) return await this.handoff();
				const envelope = this.host.captureExitEnvelope();
				if ( envelope.publicationAttempt || ( envelope.importPublication && envelope.importPublication.attempt ) ) {
					const result = await this.lifecycle.reconcile( { reader: this.savedDependencies.reader,
						pdfReader: this.savedDependencies.pdfReader, api: this.api }, this.store() );
					if ( !result.applied ) throw unavailable();
					if ( this.host.getStatus().phase === 'confirmed' ) return await this.handoff();
				} else {
					const witness = this.host.witnessLifecycleExit(), value = await this.reader.read( { ...this.preparation.target,
						selection: this.preparation.selection, page: this.host.getStatus().page } );
					this.alive(); witness();
					for ( const key of [ 'target', 'selection', 'hasLayersSlot', 'mainText', 'baseText', 'baseBundle', 'anchorSurface' ] ) {
						if ( canonical( value[ key ] ) !== canonical( this.preparation[ key ] ) ) throw unavailable();
					}
				}
				const status = this.host.getStatus();
				return { phase: 'ready', revisionId: status.baseRevisionId, dirty: status.dirty,
					editorStateValid: !status.needsRefresh && !status.publicationBlocked, draftPersisted: this.lifecycle.flush() };
			} finally { this.operation = null; }
		}

		finalizeClose( discard ) {
			if ( this.closed ) return true;
			try {
				this.alive(); if ( !this.loaded || this.operation ) return false;
				const cancelled = this.controller.getLifecycleStatus().cancelled;
				const plan = discard ? this.lifecycle.prepareDiscard( cancelled ? { reviewCancelled: true } : undefined ) : this.lifecycle.prepareCleanClose();
				if ( discard ) this.lifecycle.commitDiscard( plan.handle ); else this.lifecycle.commitCleanClose( plan.handle );
				this.closed = true; return true;
			} catch ( error ) { this.notify( 'layers-page-draft-failed' ); return false; }
		}

		/** The fresh saved writer also preserves edits during its recovery dialog, before editor teardown. */
		preserveSavedExit() {
			try {
				const drafts = this.savedDrafts;
				if ( !drafts || drafts.finalized || drafts.disposed ) return true;
				this.alive();
				if ( this.manager.pageOwnedBridge !== this.savedBridge || this.manager.pageOwnedDrafts !== drafts ||
					drafts.bridge !== this.savedBridge || drafts.controller.bridge !== this.savedBridge ) throw unavailable();
				drafts.controller.persist(); return true;
			} catch ( error ) { this.notify( 'layers-page-draft-failed' ); return false; }
		}

		dispose( terminal ) {
			if ( this.disposed ) return true;
			if ( this.transferred && !this.preserveSavedExit() && !terminal ) return false;
			if ( !this.transferred && this.lifecycle && !this.lifecycle.dispose( terminal ) && !terminal ) return false;
			window.removeEventListener( 'pagehide', this.onPageHide, true );
			this.disposeImportControl();
			if ( this.savedDependencies.importSource ) this.savedDependencies.importSource.dispose();
			if ( this.host ) this.host.dispose(); if ( this.dialog ) this.dialog.dispose(); this.disposed = true; return true;
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedPdfCreationIntegration = PageOwnedPdfCreationIntegration;
	if ( typeof module !== 'undefined' && module.exports ) module.exports = PageOwnedPdfCreationIntegration;
}() );
