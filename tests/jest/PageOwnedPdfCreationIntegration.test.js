'use strict';
const { setup, preparation, copy, witness, wait, tickUntil } = require( './fixtures/pdfCreationHost.js' );
for ( const name of [ 'PageOwnedReadClient', 'PageOwnedPublishClient', 'PageOwnedSnapshotAdapter', 'PageOwnedPdfEditorReadClient',
	'PageOwnedPdfCreationReadClient', 'PageOwnedPdfCreationDraftController', 'PageOwnedPdfCreationLifecycle',
	'PageOwnedPdfCreationIntegration', 'PageOwnedDraftStore', 'PageOwnedDraftController', 'PageOwnedDraftLifecycle',
	'PageOwnedRecoveryDialog', 'PageOwnedRevisionControl', 'PageOwnedNameControl', 'PageOwnedSummaryField' ] ) {
	require( '../../resources/ext.layers.editor/' + name + '.js' );
}
window.Layers.Editor.APIErrorHandler = class { setEnableSaveButtonCallback() {} destroy() {} };
window.Layers.Editor.ExportController = class {};
require( '../../resources/ext.layers.editor/APIManager.js' );
require( '../../resources/ext.layers.editor/LayersEditor.js' );
const APIManager = window.Layers.Core.APIManager, Editor = window.Layers.Core.Editor;
function exactTextResponse( value ) {
	const data = JSON.stringify( value.layerspdfcreationread ).split( '' ).map( character => character.charCodeAt( 0 ) > 127 ?
		'\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) : character ).join( '' );
	return { layerspdfcreationread: { version: 1, data } };
}
function localStorage() {
	const records = new Map(); return { records, get length() { return records.size; }, key: i => Array.from( records.keys() )[ i ] || null,
		getItem: key => records.get( key ) ?? null, setItem: ( key, raw ) => records.set( key, raw ), removeItem: key => records.delete( key ) };
}
function make( slot = true, initial = 2, storage = localStorage() ) {
	const work = setup( slot, initial, initial, 2 ); work.host.dispose(); const editor = work.editor;
	window.localStorage = storage;
	const remote = { revisionId: 12, snapshot: work.native.baseBundle && work.native.baseBundle.snapshot };
	const context = page => {
		const value = preparation( slot, initial, page, 2 ).context; value.revisionId = remote.revisionId;
		const members = remote.snapshot.surfaces.slice( slot ? 2 : 0 );
		value.members = members.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) );
		const member = members.find( surface => surface.source.page === page ); value.stored = Boolean( member );
		if ( member ) value.surface = copy( member ); return value;
	};
	const api = { post: jest.fn( async options => exactTextResponse( { layerspdfcreationread: preparation( slot, initial, options.pdfpage, 2 ) } ) ),
		postWithToken: jest.fn( async ( token, options ) => {
			remote.snapshot = JSON.parse( options.data ); remote.revisionId = 13;
			return { layerspublish: { result: 'Success', revid: remote.revisionId } };
		} ), get: jest.fn( async options => options.action === 'query' ? { query: { pages: [ { pageid: 7, title: 'Owner', revisions: [ {
			revid: remote.revisionId, parentid: remote.revisionId - 1, slots: { main: { contentmodel: 'wikitext', content: work.native.mainText } }
		} ] } ] } } : { layersread: options.editorpage ? { editor: context( options.editorpage ) } :
			{ revisionId: remote.revisionId, snapshot: copy( remote.snapshot ), sourceGeometry: {} } } ) };
	mw.Api = jest.fn( () => api ); mw.msg = jest.fn( ( key, ...args ) => [ key, ...args ].join( '|' ) ); mw.notify = jest.fn();
	editor.config.pageOwned = { ...work.native.target, surfaceId: work.native.target.surfaceId, readOnly: false,
		pdfCreation: copy( work.native ), draftScope: { wiki: 'wiki', user: 'Editor' } };
	editor.uiManager = { container: document.createElement( 'div' ), showSpinner: jest.fn(), hideSpinner: jest.fn(), destroy: jest.fn(), showPromptDialog: jest.fn() };
	editor.uiManager.container.innerHTML = '<div class="layers-header"><div class="layers-header-right"></div></div>';
	editor.hasUnsavedChanges = Editor.prototype.hasUnsavedChanges.bind( editor );
	editor.unsavedPages = Editor.prototype.unsavedPages.bind( editor );
	editor.unsavedChangesMessage = Editor.prototype.unsavedChangesMessage.bind( editor );
	editor.save = Editor.prototype.save.bind( editor ); editor.saveCurrentPage = Editor.prototype.saveCurrentPage.bind( editor );
	editor.getMessage = ( key, fallback ) => fallback; editor.navigateBackToFileWithName = jest.fn();
	editor.apiManager = new APIManager( editor );
	return { ...work, api, remote, storage, manager: editor.apiManager, context,
		close() { editor.apiManager.destroy(); work.close(); } };
}
it.each( [ true, false ] )( 'loads native PDF page two and navigates without legacy reads (layers slot %s)', async slot => {
	const work = make( slot );
	try {
		expect( work.manager.pageOwnedBridge ).toBeNull(); await work.manager.loadLayers();
		expect( work.editor.page ).toBe( 2 ); expect( work.editor.pageCount ).toBe( 2 );
		expect( work.editor.canvasManager.baseHeight ).toBe( 416 ); expect( work.editor.canvasManager.backgroundImage.height ).toBe( 417 );
		work.edit( 'Page two' ); expect( await Editor.prototype.navigateToPage.call( work.editor, 1 ) ).toBe( true );
		work.edit( 'Page one' ); expect( work.editor.unsavedPages() ).toEqual( [ 1, 2 ] );
		expect( await Editor.prototype.performPageNavigation.call( work.editor, 2 ) ).toBe( true );
		expect( work.editor.layers[ 0 ].text ).toBe( 'Page two' ); expect( work.editor.historyManager.undo() ).toBe( true );
		expect( work.editor.historyManager.redo() ).toBe( true );
		expect( work.api.get ).not.toHaveBeenCalled(); expect( work.api.postWithToken ).not.toHaveBeenCalled();
		expect( work.api.post.mock.calls.every( call => call[ 0 ].action === 'layerspdfcreationread' ) ).toBe( true );
	} finally { work.close(); }
} );
it.each( [ 'loadRevisionById', 'loadLayersBySetName', 'savePageLayers', 'deleteLayerSet', 'renameLayerSet' ] )(
	'refuses legacy %s while creation owns the editor', async method => {
		const work = make();
		try { await expect( work.manager[ method ]( 'ABC' ) ).rejects.toThrow( 'layers-editor-legacy-operation-denied' );
			expect( work.api.get ).not.toHaveBeenCalled(); expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
it.each( [ true, false ] )( 'first Save installs real saved ownership, complete drafts and per-page history (layers slot %s)', async slot => {
	const work = make( slot );
	try {
		await work.manager.loadLayers(); work.edit( 'Two saved' ); await work.manager.pageOwnedCreation.turn( 1 ); work.edit( 'One saved' );
		await work.manager.pageOwnedCreation.turn( 2 ); const summary = work.manager.pageOwnedSummaryField; summary.input.value = 'First PDF layer set';
		const result = await work.manager.saveLayers();
		expect( result ).toMatchObject( { revisionId: 13, dirty: false, editorStateValid: true, draftPersisted: true } );
		expect( work.manager.pageOwnedCreation.transferred ).toBe( true ); expect( work.manager.pageOwnedDrafts.ready ).toBe( true );
		expect( work.editor.config.pageOwned.pdfCreation ).toBeUndefined(); expect( work.manager.pageOwnedBridge.session.getDraft().baseRevisionId ).toBe( 13 );
		expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( work.api.postWithToken.mock.calls[ 0 ][ 1 ] ).toMatchObject( { owner: 'Owner', pageid: 7, baserevid: 12, summary: 'First PDF layer set' } );
		const sent = JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data ), members = sent.surfaces.slice( slot ? 2 : 0 );
		expect( members.map( surface => surface.label ) ).toEqual( [ 'ABC', 'ABC' ] );
		expect( members.map( surface => surface.layers[ 0 ].text ) ).toEqual( [ 'One saved', 'Two saved' ] );
		if ( slot ) expect( sent.surfaces.slice( 0, 2 ) ).toEqual( work.native.baseBundle.snapshot.surfaces );
		const savedDrafts = Array.from( work.storage.records.values() ).map( JSON.parse ).filter( value => value.pdfDraft );
		expect( savedDrafts ).toHaveLength( 1 ); expect( savedDrafts[ 0 ].scope.baseRevisionId ).toBe( 13 );
		expect( savedDrafts[ 0 ].pdfHistory.members ).toHaveLength( 2 );
		expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.layers ).toEqual( [] );
		expect( work.editor.historyManager.redo() ).toBe( true );
		expect( await Editor.prototype.navigateToPage.call( work.editor, 1 ) ).toBe( true );
		expect( work.editor.layers[ 0 ].text ).toBe( 'One saved' );
	} finally { work.close(); }
} );
it.each( [
	{ pages: [ 1, 2 ], expected: [ 1, 2 ], label: 'both edited pages' },
	{ pages: [ 2 ], expected: [ 2 ], label: 'only the saved page when the other PDF page is empty' }
] )( 'refreshes the page inventory after first Save for $label', async ( { pages, expected } ) => {
	const work = make();
	try {
		await work.manager.loadLayers();
		for ( const page of pages ) {
			if ( work.editor.page !== page ) await Editor.prototype.navigateToPage.call( work.editor, page );
			work.edit( 'Saved page ' + page );
		}
		const result = await work.manager.saveLayers();
		expect( result ).toMatchObject( { revisionId: 13, editorStateValid: true } );
		const committed = JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data ).surfaces
			.filter( surface => surface.kind === 'pdf' && surface.layers.length )
			.map( surface => surface.source.page ).sort( ( left, right ) => left - right );
		expect( committed ).toEqual( expected );
		expect( work.editor.stateManager.get( 'pagesWithLayers' ) ).toEqual( expected );
	} finally { work.close(); }
} );
it( 'preserves the existing page inventory when first-Save handoff admission fails', async () => {
	const work = make();
	try {
		await work.manager.loadLayers();
		work.editor.stateManager.set( 'pagesWithLayers', [ 1 ] );
		work.edit( 'Saved page two' );
		work.api.get.mockRejectedValueOnce( new Error( 'saved-session admission unavailable' ) );
		const result = await work.manager.saveLayers();
		expect( result ).toMatchObject( { revisionId: 13, editorStateValid: false } );
		expect( work.editor.stateManager.get( 'pagesWithLayers' ) ).toEqual( [ 1 ] );
	} finally { work.close(); }
} );
it( 'preserves edits made during first Save and never marks them saved during handoff', async () => {
	const work = make(), pending = wait();
	try {
		await work.manager.loadLayers(); work.edit( 'Sent' ); work.api.postWithToken.mockImplementationOnce( async ( token, options ) => {
			work.remote.snapshot = JSON.parse( options.data ); work.remote.revisionId = 13; return pending.promise;
		} );
		const saving = work.manager.saveLayers(); await tickUntil( () => work.api.postWithToken.mock.calls.length === 1 );
		work.edit( 'Newer' ); pending.resolve( { layerspublish: { result: 'Success', revid: 13 } } );
		expect( await saving ).toMatchObject( { revisionId: 13, dirty: true, editorStateValid: true, draftPersisted: true } );
		expect( work.editor.layers[ 0 ].text ).toBe( 'Newer' ); expect( work.editor.historyManager.undo() ).toBe( true );
		expect( work.editor.layers[ 0 ].text ).toBe( 'Sent' ); expect( work.editor.hasUnsavedChanges() ).toBe( false );
		expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.editor.hasUnsavedChanges() ).toBe( true );
	} finally { work.close(); }
} );
it( 'uses the existing Discard dialog and finalizes before the owning-page return', async () => {
	const work = make();
	try {
		await work.manager.loadLayers(); work.edit( 'Discard me' ); work.editor.dialogManager = { showSaveDiscardDialog: jest.fn( async () => 'discard' ) };
		Editor.prototype.cancel.call( work.editor, true ); await tickUntil( () => work.editor.navigateBackToFileWithName.mock.calls.length === 1 );
		expect( work.editor._closeCompleted ).toBe( true ); expect( work.manager.pageOwnedCreation.closed ).toBe( true );
		window.dispatchEvent( new Event( 'pagehide' ) ); expect( work.storage.records.size ).toBe( 0 );
		expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} finally { work.close(); }
} );
it( 'keeps the page navigator readable while Discard clears the final dirty state', async () => {
	const work = make(), reads = [];
	try {
		await work.manager.loadLayers(); work.edit( 'Discard me' );
		work.editor.stateManager.subscribe( 'isDirty', () => {
			try { reads.push( work.editor.unsavedPages() ); } catch ( error ) { reads.push( error ); }
		} );
		work.editor.dialogManager = { showSaveDiscardDialog: jest.fn( async () => 'discard' ) };
		Editor.prototype.cancel.call( work.editor, true );
		await tickUntil( () => work.editor.navigateBackToFileWithName.mock.calls.length === 1 );
		expect( reads ).toEqual( [ [] ] );
	} finally { work.close(); }
} );
it( 'refuses a stale first Save without changing work, Undo markers or publication evidence', async () => {
	const work = make();
	try {
		await work.manager.loadLayers(); work.edit( 'Keep me' );
		work.api.postWithToken.mockRejectedValueOnce( { error: { code: 'layers-edit-conflict' } } );
		const before = witness( work ); await expect( work.manager.saveLayers() ).rejects.toMatchObject( { code: 'layers-edit-conflict' } );
		expect( witness( work ) ).toEqual( before ); expect( work.manager.pageOwnedCreation.transferred ).toBe( false );
		expect( Array.from( work.storage.records.values() ).map( JSON.parse ).some( value => value.pdfCreation.publicationAttempt.dispatchState === 'refused' ) ).toBe( true );
	} finally { work.close(); }
} );
it( 'keeps an unknown Save held, and explicit Check never publishes again', async () => {
	const work = make();
	try {
		await work.manager.loadLayers(); work.edit( 'Sent' ); work.api.postWithToken.mockRejectedValueOnce( new Error( 'lost' ) );
		await expect( work.manager.saveLayers() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		const before = work.api.postWithToken.mock.calls.length; const result = await work.manager.checkPageOwnedRevision();
		expect( result ).toMatchObject( { phase: 'ready', revisionId: 12, dirty: true, editorStateValid: true, draftPersisted: true } );
		expect( work.api.postWithToken ).toHaveBeenCalledTimes( before ); expect( work.manager.pageOwnedCreation.finalizeClose( true ) ).toBe( false );
	} finally { work.close(); }
} );
it( 'keeps a known saved revision when saved-session admission later fails', async () => {
	const work = make();
	try {
		await work.manager.loadLayers(); work.edit( 'Saved' ); work.api.get.mockRejectedValueOnce( new Error( 'unavailable' ) );
		expect( await work.manager.saveLayers() ).toMatchObject( { revisionId: 13, dirty: true, editorStateValid: false, draftPersisted: false } );
		expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 ); expect( work.editor.layers[ 0 ].text ).toBe( 'Saved' );
		expect( work.manager.pageOwnedCreation.transferred ).toBe( false );
		expect( await work.manager.checkPageOwnedRevision() ).toMatchObject( { revisionId: 13, editorStateValid: true } );
		expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} finally { work.close(); }
} );
it( 'allows the existing explicit Discard choice after Keep drafts unchanged without deleting the source backup', async () => {
	const source = make(), storage = localStorage(); let target;
	const confirm = jest.spyOn( window.Layers.Editor.PageOwnedRecoveryDialog.prototype, 'confirm' ).mockResolvedValue( false );
	try {
		await source.manager.loadLayers(); source.edit( 'Earlier backup' ); source.manager.pageOwnedCreation.lifecycle.flush();
		const raw = Array.from( source.storage.records.values() )[ 0 ], scope = JSON.parse( raw ).scope;
		new window.Layers.Editor.PageOwnedDraftStore( storage, 'a'.repeat( 32 ) ).write( scope, raw );
		target = make( true, 2, storage ); await target.manager.loadLayers();
		expect( confirm ).toHaveBeenCalled(); expect( target.manager.pageOwnedCreation.lifecycle.getStatus().ready ).toBe( false );
		target.editor.dialogManager = { showSaveDiscardDialog: jest.fn( async () => 'discard' ) };
		Editor.prototype.cancel.call( target.editor, true ); await Promise.resolve(); await Promise.resolve();
		expect( target.editor.navigateBackToFileWithName ).toHaveBeenCalledTimes( 1 );
		expect( Array.from( storage.records.values() ) ).toEqual( [ raw ] );
		expect( target.api.postWithToken ).not.toHaveBeenCalled();
	} finally { confirm.mockRestore(); if ( target ) target.close(); source.close(); }
} );
it( 'runs the existing Save-and-Close choice only after durable saved ownership is installed', async () => {
	const work = make();
	try {
		await work.manager.loadLayers(); work.edit( 'Save and leave' ); work.editor.dialogManager = { showSaveDiscardDialog: jest.fn( async () => 'save' ) };
		Editor.prototype.cancel.call( work.editor, true );
		for ( let i = 0; i < 300 && !work.editor._closeCompleted; i++ ) await Promise.resolve();
		expect( work.editor._closeCompleted ).toBe( true ); expect( work.manager.pageOwnedDrafts.finalized ).toBe( true );
		expect( work.editor.navigateBackToFileWithName ).toHaveBeenCalledTimes( 1 ); expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( work.remote.snapshot.surfaces.at( -1 ).layers[ 0 ].text ).toBe( 'Save and leave' );
	} finally { work.close(); }
} );
it( 'preserves current saved-session edits in capture phase before bootstrap destruction', async () => {
	const work = make(); let atTeardown;
	const teardown = () => { atTeardown = Array.from( work.storage.records.values() ).map( JSON.parse ).find( value => value.pdfDraft ); work.editor.isDestroyed = true; };
	window.addEventListener( 'pagehide', teardown );
	try {
		await work.manager.loadLayers(); work.edit( 'First saved' ); await work.manager.saveLayers(); work.edit( 'Newest before exit' );
		window.dispatchEvent( new Event( 'pagehide' ) ); expect( atTeardown.pdfDraft.snapshot.surfaces.at( -1 ).layers[ 0 ].text ).toBe( 'Newest before exit' );
		expect( atTeardown.pdfHistory.members.find( member => member.page === 2 ).timeline.history.at( -1 ).layers[ 0 ].text ).toBe( 'Newest before exit' );
	} finally { window.removeEventListener( 'pagehide', teardown ); work.close(); }
} );
it( 'keeps later saved-session work live when a voluntary exit backup fails', async () => {
	const storage = localStorage(), write = storage.setItem; let fail = false;
	storage.setItem = ( key, raw ) => { if ( fail ) throw new Error( 'quota' ); write( key, raw ); };
	const work = make( true, 2, storage );
	try {
		await work.manager.loadLayers(); work.edit( 'Saved' ); await work.manager.saveLayers(); work.edit( 'Newest' ); fail = true;
		const before = witness( work ); expect( work.manager.prepareDestroy() ).toBe( false );
		expect( work.manager.pageOwnedCreation.disposed ).toBe( false ); expect( witness( work ) ).toEqual( before );
		fail = false; expect( work.manager.prepareDestroy() ).toBe( true );
		expect( Array.from( storage.records.values() ).map( JSON.parse ).find( value => value.pdfDraft ).editorState.layers[ 0 ].text ).toBe( 'Newest' );
	} finally { fail = false; work.close(); }
} );
it( 'never reclassifies a saved reply as an unpublished failure when the saved-draft write is refused', async () => {
	const storage = localStorage(), write = storage.setItem;
	storage.setItem = ( key, raw ) => { if ( JSON.parse( raw ).pdfDraft ) return; write( key, raw ); };
	const work = make( true, 2, storage );
	try {
		await work.manager.loadLayers(); work.edit( 'Saved' );
		expect( await work.manager.saveLayers() ).toMatchObject( { revisionId: 13, editorStateValid: false, draftPersisted: false } );
		expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 ); expect( work.editor.layers[ 0 ].text ).toBe( 'Saved' );
		expect( work.manager.pageOwnedBridge.session.getDraft().baseRevisionId ).toBe( 13 );
		expect( Array.from( storage.records.values() ).map( JSON.parse ).some( value => value.pdfCreation && value.pdfCreation.confirmation.revisionId === 13 ) ).toBe( true );
	} finally { work.close(); }
} );
it( 'hands off a freshly proven unknown Save without another publication and keeps newer work', async () => {
	const work = make();
	try {
		await work.manager.loadLayers(); work.edit( 'Sent' ); work.api.postWithToken.mockImplementationOnce( async ( token, options ) => {
			work.remote.snapshot = JSON.parse( options.data ); work.remote.revisionId = 13; throw new Error( 'reply lost' );
		} );
		await expect( work.manager.saveLayers() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		work.edit( 'Newer after uncertainty' );
		expect( await work.manager.checkPageOwnedRevision() ).toMatchObject( { phase: 'ready', revisionId: 13, dirty: true, draftPersisted: true } );
		expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 ); expect( work.editor.layers[ 0 ].text ).toBe( 'Newer after uncertainty' );
		expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.layers[ 0 ].text ).toBe( 'Sent' );
	} finally { work.close(); }
} );
it.each( [ 'owner', 'pageId', 'revisionId', 'surfaceId', 'readOnly' ] )( 'refuses inconsistent native %s admission before reading', async key => {
	const work = make();
	try {
		const config = work.editor.config.pageOwned; config[ key ] = key === 'readOnly' ? true : typeof config[ key ] === 'number' ? 999 : 'Wrong';
		expect( () => new window.Layers.Editor.PageOwnedPdfCreationIntegration( work.manager ) ).toThrow(); expect( work.api.post ).not.toHaveBeenCalled();
	} finally { work.close(); }
} );
it( 'refuses source changes during loading without falling back or replacing newer live layers', async () => {
	const work = make(), pending = wait();
	try {
		work.api.post.mockReturnValueOnce( pending.promise ); const loading = work.manager.loadLayers(); work.edit( 'New during load' );
		const value = preparation( true, 2, 2, 2 ); value.context.surface.source.sha1 = 'b'.repeat( 31 );
		pending.resolve( exactTextResponse( { layerspdfcreationread: value } ) ); await expect( loading ).rejects.toThrow();
		expect( work.editor.layers[ 0 ].text ).toBe( 'New during load' ); expect( work.api.get ).not.toHaveBeenCalled(); expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} finally { work.close(); }
} );
it.each( [ undefined, {}, { reviewCancelled: false }, { reviewCancelled: true, extra: true } ] )(
	'never treats an unheld or malformed cancelled-review option as Discard authority (%j)', async options => {
		const work = make();
		try {
			await work.manager.loadLayers(); work.edit( 'Keep' );
			if ( options === undefined ) options = { reviewCancelled: true };
			expect( () => work.manager.pageOwnedCreation.lifecycle.prepareDiscard( options ) ).toThrow();
			expect( work.editor.layers[ 0 ].text ).toBe( 'Keep' );
		} finally { work.close(); }
	} );
it( 'cancels the initial canvas background loader before exact native creation staging', async () => {
	const work = make(); let cancelled = false;
	try {
		const destroy = jest.fn( () => { cancelled = true; } ); work.editor.canvasManager.imageLoader = { destroy };
		work.api.post.mockImplementationOnce( async options => {
			if ( !cancelled ) { work.editor.canvasManager.backgroundImage = { lateInitialRaster: true }; work.editor.canvasManager.canvas.height++; }
			return exactTextResponse( { layerspdfcreationread: preparation( true, 2, options.pdfpage, 2 ) } );
		} );
		await work.manager.loadLayers(); expect( destroy ).toHaveBeenCalledTimes( 1 ); expect( work.editor.page ).toBe( 2 );
		expect( work.editor.canvasManager.imageLoader ).toBeNull(); expect( work.editor.canvasManager.backgroundImage.height ).toBe( 417 );
	} finally { work.close(); }
} );
it( 'preserves late saved work during handoff recovery review without changing the other writer', async () => {
	const source = make(), storage = localStorage(); let target, resolveReview;
	const original = window.Layers.Editor.PageOwnedRecoveryDialog.prototype.confirm;
	try {
		await source.manager.loadLayers(); source.edit( 'Earlier saved draft' ); await source.manager.saveLayers();
		const entry = Array.from( source.storage.records ).find( ( [ key, raw ] ) => JSON.parse( raw ).pdfDraft );
		storage.records.set( entry[ 0 ], entry[ 1 ] );
		target = make( true, 2, storage ); await target.manager.loadLayers(); target.edit( 'New first Save' );
		window.Layers.Editor.PageOwnedRecoveryDialog.prototype.confirm = jest.fn( () => new Promise( resolve => { resolveReview = resolve; } ) );
		const saving = target.manager.saveLayers(); for ( let i = 0; i < 500 && !resolveReview; i++ ) await Promise.resolve();
		expect( resolveReview ).toEqual( expect.any( Function ) ); target.edit( 'Late while reviewing saved draft' );
		window.dispatchEvent( new Event( 'pagehide' ) );
		expect( storage.records.get( entry[ 0 ] ) ).toBe( entry[ 1 ] );
		const preserved = Array.from( storage.records ).filter( ( [ key, raw ] ) => key !== entry[ 0 ] && JSON.parse( raw ).pdfDraft );
		expect( preserved ).toHaveLength( 1 );
		expect( JSON.parse( preserved[ 0 ][ 1 ] ).editorState.layers[ 0 ].text ).toBe( 'Late while reviewing saved draft' );
		resolveReview( false ); expect( await saving ).toMatchObject( { revisionId: 13, dirty: true, draftPersisted: false } );
		expect( target.editor.layers[ 0 ].text ).toBe( 'Late while reviewing saved draft' );
	} finally { window.Layers.Editor.PageOwnedRecoveryDialog.prototype.confirm = original; if ( target ) target.close(); source.close(); }
} );
it( 'verifies the saved writer rather than the selected recovery writer when persisting later work', async () => {
	const work = make();
	try {
		await work.manager.loadLayers(); work.edit( 'Saved' ); await work.manager.saveLayers();
		const controller = work.manager.pageOwnedDrafts.controller, raw = Array.from( work.storage.records.values() ).find( value => JSON.parse( value ).pdfDraft );
		const scope = JSON.parse( raw ).scope, other = new window.Layers.Editor.PageOwnedDraftStore( work.storage, 'a'.repeat( 32 ) );
		other.write( scope, raw ); controller.selectRecovery( 'a'.repeat( 32 ) ); work.edit( 'Later work' );
		expect( work.manager.pageOwnedDrafts.flush() ).toBe( true ); expect( other.read( scope ) ).toBe( raw );
		controller.store.selectRecovery( controller.store._writerId );
		expect( JSON.parse( controller.store.read( scope ) ).editorState.layers[ 0 ].text ).toBe( 'Later work' );
	} finally { work.close(); }
} );
