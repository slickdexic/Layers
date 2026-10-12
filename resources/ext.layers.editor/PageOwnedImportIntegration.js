/** Compose qualified Import, history and drafts in existing writable image/slide editors. */
( function () {
	'use strict';
	class PageOwnedImportIntegration {
		static supports( bridge ) {
			const editor = bridge && bridge.editor, session = bridge && bridge.session;
			return !!( bridge && bridge.loaded && !bridge.disposed && !bridge.pdfCoordinator && session &&
				!session._readOnly && !session._newSurface && !session._pdf && !session._pdfContext && session._baseHasDrawings === true &&
				Number.isInteger( session._pageId ) && session._pageId > 0 && session._pageId <= 2147483647 && editor && !editor.isDestroyed && editor.historyManager &&
				typeof editor.historyManager.enableWorkingCopyHistory === 'function' && editor.canvasManager && editor.canvasManager.selectionManager );
		}

		constructor( bridge, api, classes ) {
			if ( !PageOwnedImportIntegration.supports( bridge ) ) { throw new Error( 'layers-working-copy-import-unavailable' ); }
			this.bridge = bridge; this.classes = classes; this.disposed = false; this.control = null;
			this.catalog = new classes.PageOwnedWorkingCopyImportCatalogClient( api );
			this.coordinator = new classes.PageOwnedWorkingCopyImportCoordinator( { bridge, session: bridge.session,
				readClient: new classes.PageOwnedWorkingCopyImportReadClient( api ), Source: classes.PageOwnedWorkingCopyImportSource,
				planner: classes.PageOwnedWorkingCopyImportPlan, adapter: new classes.PageOwnedSnapshotAdapter() } );
			if ( !bridge.editor.historyManager.hasWorkingCopyHistory( bridge ) ) { bridge.editor.historyManager.enableWorkingCopyHistory( bridge ); }
			this.coordinator.enablePublicationProvenance();
		}

		enableDrafts( controller ) { controller.enableWorkingCopyDrafts(); }

		_target() {
			const session = this.bridge.session, identity = session.getWorkingCopyImportIdentity();
			const saved = JSON.parse( session._savedJson ).surfaces.find( surface => surface.id === identity.surfaceId );
			const live = this.bridge.getWorkingCopyLiveState();
			return { match: { pageId: identity.pageId, kind: saved.kind, label: saved.label,
				fileTitle: saved.kind === 'image' ? saved.source.fileTitle : null },
				name: session.getLabel(), owner: identity.owner, kind: saved.kind, canvas: live.canvas, layerCount: live.layers.length };
		}

		mount( parent, before, drafts, allocateId, maxLayers, message ) {
			if ( this.disposed || this.control ) { throw new Error( 'layers-working-copy-import-unavailable' ); }
			this.control = new this.classes.PageOwnedImportControl( {
				getTarget: () => this._target(), message, catalog: this.catalog, coordinator: this.coordinator, allocateId, maxLayers,
				canImport: () => !this.disposed && drafts.ready && !drafts.disposed && !drafts.finalized && !drafts.saving && !drafts.checking &&
					this.bridge.session.getStatus().phase === 'ready' && !this.bridge.session.getStatus().readOnly && !this.bridge.editor.isDestroyed && !this.bridge.disposed,
				onApplied: () => drafts.flush()
			} );
			this.control.mount( parent, before );
		}

		dispose() {
			if ( this.disposed ) { return; } this.disposed = true;
			this.coordinator.dispose(); this.catalog.dispose(); if ( this.control ) { this.control.dispose(); }
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedImportIntegration = PageOwnedImportIntegration;
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedImportIntegration; }
}() );
