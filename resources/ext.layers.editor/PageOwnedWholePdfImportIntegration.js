/** Separately invoked composition of the approved Import dialog for a stored PDF layer set. */
( function () {
	'use strict';
	const nameKey = value => value.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase();
	const choices = new WeakMap(), previews = new WeakMap();
	function unavailable() {
		const error = new Error( 'layers-working-copy-import-unavailable' ); error.code = error.message; return error;
	}
	class PageOwnedWholePdfImportIntegration {
		static supports( bridge ) {
			const session = bridge && bridge.session, editor = bridge && bridge.editor;
			return !!( bridge && bridge.loaded && !bridge.disposed && !bridge.saving && !bridge.reconciling && bridge.pdfCoordinator &&
				session && session._pdf && session._pdfContext && session._baseHasDrawings === true && !session._newSurface &&
				!session._readOnly && session.getStatus().phase === 'ready' && Number.isInteger( session._pageId ) &&
				session._pageId > 0 && session._pageId <= 2147483647 && editor && !editor.isDestroyed && editor.historyManager &&
				editor.canvasManager && editor.canvasManager.selectionManager );
		}

		constructor( bridge, api, classes ) {
			if ( !PageOwnedWholePdfImportIntegration.supports( bridge ) || !classes ||
				[ 'PageOwnedWholePdfImportCatalogClient', 'PageOwnedWholePdfImportSource', 'PageOwnedPdfEditorReadClient',
					'PageOwnedWholePdfImportSession', 'PageOwnedWholePdfImportApplication', 'PageOwnedWholePdfImportPublishClient',
					'PageOwnedImportControl' ].some( key => typeof classes[ key ] !== 'function' ) ) { throw unavailable(); }
			if ( bridge.editor.historyManager.hasPdfImportHistory() ) { throw unavailable(); }
			// Validate the transport before any route can be installed in the editor.
			const publisher = new classes.PageOwnedWholePdfImportPublishClient( api );
			this.bridge = bridge; this.classes = classes; this.disposed = false; this.control = null; this.drafts = null; this.controller = null;
			try {
				const catalog = new classes.PageOwnedWholePdfImportCatalogClient( api );
				this.catalog = Object.freeze( { search: async request => {
					const result = await catalog.search( request );
					for ( const choice of result ) { choices.set( choice.source, { integration: this, label: choice.label } ); }
					return result;
				}, dispose: () => catalog.dispose() } );
				this.source = new classes.PageOwnedWholePdfImportSource( api );
				this.binding = new classes.PageOwnedWholePdfImportSession( bridge.session, this.source, new classes.PageOwnedPdfEditorReadClient( api ) );
				this.application = new classes.PageOwnedWholePdfImportApplication( bridge, this.binding );
				this.application.enableHistory();
				this.application.enablePublication( publisher );
				// The existing dialog's two-argument preparation contract stays unchanged.
				this.coordinator = Object.freeze( {
					prepare: ( source, options ) => this._prepare( source, options ),
					inspect: handle => {
						const preview = this.application.inspect( handle );
						return { ...preview, source: { ...preview.source, label: previews.get( handle ) } };
					},
					apply: handle => this.application.apply( handle ), release: handle => {
						this.application.release( handle ); previews.delete( handle );
					}
				} );
			} catch ( error ) {
				this.disposed = true;
				for ( const resource of [ this.application, this.binding, this.source, this.catalog ].filter( Boolean ) ) {
					try { resource.dispose(); } catch ( ignored ) {}
				}
				throw unavailable();
			}
		}

		/** Install before constructing the actual lifecycle, so it captures the complete-PDF recovery actions. */
		enableDrafts( controller ) {
			if ( this.disposed || this.controller || !controller || controller.bridge !== this.bridge ) { throw unavailable(); }
			controller.enableWholePdfDrafts( this.application );
			this.controller = controller;
		}

		_target() {
			if ( this.disposed ) { throw unavailable(); }
			const session = this.bridge.session, draft = session.getDraft(), pdf = session.getPdfStatus();
			const saved = JSON.parse( session._savedJson ).surfaces.find( surface => surface.id === session._surfaceId );
			const anchor = draft.snapshot.surfaces.find( surface => surface.id === session._surfaceId ), live = this.bridge.getLiveState();
			if ( !saved || saved.kind !== 'pdf' || !anchor || anchor.kind !== 'pdf' ) { throw unavailable(); }
			const members = draft.snapshot.surfaces.filter( surface => surface.kind === 'pdf' &&
				surface.source.fileTitle === saved.source.fileTitle && nameKey( surface.label ) === nameKey( anchor.label ) );
			const layerCount = members.reduce( ( total, surface ) => total +
				( surface.id === pdf.activeSurfaceId ? live.layers.length : surface.layers.length ),
				members.some( surface => surface.id === pdf.activeSurfaceId ) ? 0 : live.layers.length );
			return { match: { pageId: session._pageId, kind: 'pdf', label: saved.label, fileTitle: saved.source.fileTitle },
				name: session.getLabel(), owner: draft.owner, kind: 'pdf', canvas: live.canvas, layerCount };
		}

		_canImport() {
			const drafts = this.drafts;
			return !!( !this.disposed && drafts && drafts.ready && !drafts.disposed && !drafts.finalized && !drafts.saving &&
				!drafts.checking && drafts.bridge === this.bridge && drafts.controller === this.controller &&
				PageOwnedWholePdfImportIntegration.supports( this.bridge ) );
		}

		async _prepare( source, options ) {
			const choice = choices.get( source );
			if ( !choice || choice.integration !== this || !this._canImport() || !this.control || !this.control.dialog ) { throw unavailable(); }
			const control = this.control, dialog = control.dialog, generation = control.generation, drafts = this.drafts;
			const selected = { pageId: source.pageId, revisionId: source.revisionId, surfaceId: source.surfaceId };
			const handle = await this.application.prepare( { source: selected, mode: options.mode, maxLayers: options.maxLayers, allocateId: options.allocateId,
				assertCurrent: () => {
					if ( !this._canImport() || this.drafts !== drafts || this.control !== control || control.disposed ||
						control.dialog !== dialog || control.generation !== generation ) { throw unavailable(); }
				} } );
			previews.set( handle, choice.label ); return handle;
		}

		mount( parent, before, drafts, allocateId, maxLayers, message ) {
			if ( this.disposed || this.control || !this.controller || !drafts || drafts.bridge !== this.bridge || drafts.controller !== this.controller ) { throw unavailable(); }
			this.drafts = drafts;
			this.control = new this.classes.PageOwnedImportControl( {
				getTarget: () => this._target(), canImport: () => this._canImport(), message, catalog: this.catalog,
				coordinator: this.coordinator, allocateId, maxLayers, onApplied: () => drafts.flush()
			} );
			this.control.mount( parent, before );
		}

		dispose() {
			if ( this.disposed ) { return; } this.disposed = true;
			if ( this.control ) { this.control.dispose(); }
			this.catalog.dispose(); this.application.dispose(); this.source.dispose();
		}
	}
	window.Layers = window.Layers || {}; window.Layers.Editor = window.Layers.Editor || {};
	window.Layers.Editor.PageOwnedWholePdfImportIntegration = PageOwnedWholePdfImportIntegration;
	if ( typeof module !== 'undefined' && module.exports ) { module.exports = PageOwnedWholePdfImportIntegration; }
}() );
