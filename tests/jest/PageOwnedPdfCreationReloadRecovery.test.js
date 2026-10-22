'use strict';
const fixture = require( './fixtures/pdfCreationSavedImport.js' );
const hostFixture = require( './fixtures/pdfCreationHost.js' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const Coordinator = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorCoordinator.js' );
const Binding = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSession.js' );
const Application = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportApplication.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const DraftController = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const Client = require( '../../resources/ext.layers.editor/PageOwnedMissingPdfImportPublishClient.js' );
const Dialog = require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );
const en = require( '../../i18n/en.json' );
const { copy } = fixture, opened = [], resources = [];
const message = ( key, ...args ) => ( en[ key ] || key ).replace( /\$(\d+)/g, ( _, number ) => String( args[ number - 1 ] ) );
const tick = async predicate => { for ( let index = 0; index < 800 && !predicate(); index++ ) await Promise.resolve(); expect( predicate() ).toBe( true ); };
const memory = () => { const rows = new Map(); return { rows, get length() { return rows.size; }, key: index => Array.from( rows.keys() )[ index ] ?? null,
	getItem: key => rows.get( key ) ?? null, setItem: ( key, value ) => rows.set( key, String( value ) ), removeItem: key => rows.delete( key ) }; };

async function setup( options = {} ) {
	const remote = await fixture.build( { undo: !!options.sourceFree } ); opened.push( remote ); const saved = await remote.save();
	const old = await fixture.build( { undo: !!options.sourceFree } ); opened.push( old );
	if ( options.sourceFree ) old.work.publisher.publish.mockRejectedValue( new Error( 'Connection lost' ) );
	else old.work.publicationApi.postWithToken.mockRejectedValue( new Error( 'Connection lost' ) );
	await expect( old.work.host.save( 'Import source', () => {} ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
	if ( options.newer ) old.work.edit( 'Newer recovered work' );
	const backup = old.work.host.captureDraftEnvelope(), storage = memory(), scope = { wiki: 'wiki', user: 'user',
		owner: old.work.native.target.owner, baseRevisionId: 12, surfaceId: old.work.native.target.surfaceId };
	const key = new DraftStore( storage )._validateAndBuildKey( scope ) + '#' + 'a'.repeat( 32 );
	storage.rows.set( key, JSON.stringify( { version: 1, scope, pdfCreation: backup } ) );
	const fresh = hostFixture.setup(); opened.push( { work: fresh } ); fresh.host.dispose();
	const dependencies = { ...saved.dependencies, outcomeClient: new Client( { postWithToken: jest.fn().mockResolvedValue( {
		layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 } } ) } ),
		creationReader: old.work.reader, api: { get: jest.fn().mockResolvedValue( { query: { pages: [ { pageid: 7, title: scope.owner,
			revisions: [ { revid: 13, parentid: 12, slots: { main: { contentmodel: 'wikitext', content: old.work.native.mainText } } } ] } ] } } ) } };
	const api = { postWithToken: jest.fn().mockResolvedValue( { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 } } ) };
	dependencies.outcomeClient = new Client( api );
	const context = await dependencies.pdfReader.read( { owner: scope.owner, revisionId: 13, binding: 'v1:7:' + scope.surfaceId, page: 2 } );
	const session = new Session( { owner: scope.owner, pageId: 7, revisionId: 13, surfaceId: scope.surfaceId, pdfContext: context },
		{ reader: dependencies.reader, publisher: dependencies.publisher, adapter: new Adapter() } );
	const bridge = new Bridge( fresh.editor, session ), coordinator = new Coordinator( bridge, dependencies.pdfReader ); bridge.pdfCoordinator = coordinator;
	fresh.editor.config.isSlide = false; fresh.editor.config.imageUrl = context.rendition.url;
	await bridge.load();
	const binding = new Binding( session, dependencies.importSource, dependencies.pdfReader ), application = new Application( bridge, binding );
	application.enableHistory(); application.enablePublication( dependencies.importPublisher ); application.enableReconciliation();
	const controller = new DraftController( bridge, new DraftStore( storage, 'b'.repeat( 32 ) ), new Adapter(), { wiki: 'wiki', user: 'user' } );
	controller.enableWholePdfDrafts( application );
	const ui = { chooseEarlierDraft: jest.fn().mockResolvedValue( { selected: 0 } ), chooseDraft: jest.fn().mockResolvedValue( 0 ),
		confirmRecovery: jest.fn().mockResolvedValue( true ), notifyBlocked: jest.fn(), notifyEarlierFailure: jest.fn(), notifyFailure: jest.fn() };
	const lifecycle = new Lifecycle( bridge, controller, ui ); lifecycle.enableEarlierPdfCreationRecovery( dependencies );
	const c = { old, remote, saved, fresh, storage, key, backup, dependencies, api, bridge, session, application, binding, controller, ui, lifecycle };
	resources.push( c ); return c;
}
function witness( c ) { return { snapshot: copy( c.session.getDraft() ), state: copy( c.fresh.editor.stateManager.state ),
	history: c.fresh.editor.historyManager.captureTimeline(), fullDraft: c.application.captureDraftForStorage(), records: Array.from( c.storage.rows ),
	page: c.fresh.editor.page, pageCount: c.fresh.editor.pageCount }; }
afterEach( () => {
	for ( const c of resources.splice( 0 ).reverse() ) { if ( c.dialog ) c.dialog.dispose(); c.lifecycle.dispose(); c.application.dispose(); c.binding.dispose(); c.bridge.dispose(); }
	for ( const value of opened.splice( 0 ).reverse() ) value.work.close();
} );

describe( 'Reopened saved editor recovers a complete earlier PDF creation backup', () => {
	it( 'prepares without mutation, explicitly restores newer work and keeps group Undo/Redo and both scoped backups', async () => {
		const c = await setup( { newer: true } ), before = witness( c ); let offered;
		c.ui.confirmRecovery.mockImplementation( async candidate => { offered = candidate; expect( witness( c ) ).toEqual( before ); return true; } );
		await c.lifecycle.initialize();
		expect( c.lifecycle.ready ).toBe( true ); expect( offered.editorState.layers[ 0 ].text ).toBe( 'Newer recovered work' );
		expect( c.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer recovered work' ); expect( c.session.getStatus().revisionId ).toBe( 13 );
		expect( c.fresh.editor.historyManager.undo() ).toBe( true ); expect( c.fresh.editor.historyManager.undo() ).toBe( true );
		expect( c.application.captureDraft().session.sources ).toEqual( [] );
		expect( c.fresh.editor.historyManager.redo() ).toBe( true ); expect( c.fresh.editor.historyManager.redo() ).toBe( true );
		expect( c.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer recovered work' );
		expect( Array.from( c.storage.rows ) ).toEqual( before.records ); c.controller.persist();
		expect( c.storage.rows.get( c.key ) ).toBe( before.records[ 0 ][ 1 ] ); expect( c.storage.rows.size ).toBe( 2 );
		expect( c.api.postWithToken.mock.calls.map( row => row[ 1 ].action ) ).toEqual( [ 'layersmissingpdfimportoutcome', 'layersmissingpdfimportoutcome' ] );
	} );
	it.each( [ 'chooser', 'confirm' ] )( 'keeps saved work and every original backup unchanged on %s cancellation', async stage => {
		const c = await setup( { newer: true } ), before = witness( c );
		if ( stage === 'chooser' ) c.ui.chooseEarlierDraft.mockResolvedValue( { cancelled: 0 } ); else c.ui.confirmRecovery.mockResolvedValue( false );
		await c.lifecycle.initialize(); expect( witness( c ) ).toEqual( before ); expect( c.lifecycle.ready ).toBe( true );
	} );
	it( 'saves recovered complete work to the current owner revision with native source attribution', async () => {
		const c = await setup( { newer: true } ), original = c.storage.rows.get( c.key ); await c.lifecycle.initialize();
		const result = await c.lifecycle.save( 'Recovered complete layer set' ); expect( result.revisionId ).toBe( 14 );
		const requests = c.remote.importPublishApi.postWithToken.mock.calls.map( row => row[ 1 ] ); expect( requests ).toHaveLength( 1 );
		expect( requests[ 0 ].baserevid ).toBe( 13 ); expect( requests[ 0 ].targetpageid ).toBe( 7 );
		const snapshot = JSON.parse( requests[ 0 ].data );
		expect( snapshot.surfaces.find( surface => surface.source?.fileTitle === 'File:Source.pdf' && surface.source.page === 2 ).layers[ 0 ] )
			.toMatchObject( { text: 'Newer recovered work', future: null } );
		expect( snapshot.surfaces.slice( 0, 2 ) ).toEqual( c.saved.snapshot.surfaces.slice( 0, 2 ) );
		expect( JSON.parse( requests[ 0 ].importsources ) ).toHaveLength( 1 ); expect( c.storage.rows.get( c.key ) ).toBe( original );
	} );
	it( 'rechecks every pinned destination page after Review before applying any recovery state', async () => {
		const c = await setup( { newer: true } ), before = witness( c );
		c.ui.confirmRecovery.mockImplementation( async () => {
			const original = c.remote.pdfApi.get.getMockImplementation();
			c.remote.pdfApi.get.mockImplementation( request => {
				if ( request.editorpage === 1 ) return Promise.reject( { code: 'layers-revision-unavailable' } );
				return original( request );
			} ); return true;
		} );
		await c.lifecycle.initialize(); expect( witness( c ) ).toEqual( before ); expect( c.ui.notifyEarlierFailure ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'undoes the recovered group across both native page geometries and retains Redo source authority', async () => {
		const c = await setup(); await c.lifecycle.initialize();
		expect( c.ui.confirmRecovery ).toHaveBeenCalled(); expect( c.fresh.editor.historyManager.undo() ).toBe( true );
		const before = c.application.captureDraft(); expect( before.session.sources ).toEqual( [] );
		expect( before.session.snapshot.surfaces.filter( surface => surface.source?.fileTitle === 'File:Source.pdf' )
			.map( surface => [ surface.source.page, surface.canvas.width, surface.canvas.height, surface.layers.length ] ).sort( ( a, b ) => a[ 0 ] - b[ 0 ] ) )
			.toEqual( [ [ 1, 416, 208, 0 ], [ 2, 208, 416, 0 ] ] );
		expect( c.fresh.editor.historyManager.redo() ).toBe( true ); expect( c.application.captureDraft().session.sources ).toHaveLength( 1 );
		for ( const page of [ 1, 2 ] ) expect( await c.bridge.pdfCoordinator.turn( page ) ).toBe( true );
	} );
	it( 'checks the source-free ordinary first Save after Import Undo and preserves whole-group Redo', async () => {
		const c = await setup( { sourceFree: true } ); await c.lifecycle.initialize();
		expect( c.ui.confirmRecovery ).toHaveBeenCalled(); expect( c.api.postWithToken ).not.toHaveBeenCalled();
		expect( c.fresh.editor.historyManager.redo() ).toBe( true ); expect( c.application.captureDraft().session.sources ).toHaveLength( 1 );
	} );
	it.each( [ 'nativeRefusal', 'differentSuccessor', 'clonedProof', 'changedBackup', 'changedSource', 'changedPin', 'changedSnapshot' ] )(
		'refuses %s without offering or altering work', async boundary => {
			const c = await setup( { newer: true } );
			if ( boundary === 'nativeRefusal' ) c.api.postWithToken.mockRejectedValue( { code: 'layers-working-copy-import-unavailable' } );
			if ( boundary === 'differentSuccessor' ) c.api.postWithToken.mockResolvedValue( { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 14 } } );
			if ( boundary === 'clonedProof' ) c.dependencies.outcomeClient.check = jest.fn().mockResolvedValue( { revisionId: 13 } );
			if ( boundary === 'changedBackup' ) { const original = c.api.postWithToken.getMockImplementation(); c.api.postWithToken.mockImplementation( async request => {
				c.storage.rows.set( c.key, c.storage.rows.get( c.key ) + ' ' ); return original( request ); } ); }
			if ( boundary === 'changedSource' ) c.remote.sourceApi.post.mockRejectedValue( { code: 'permissiondenied' } );
			if ( boundary === 'changedPin' ) { const original = c.remote.pdfApi.get.getMockImplementation(); c.remote.pdfApi.get.mockImplementation( request => {
				const response = copy( original( request ) ); response.layersread.editor.surface.source.sha1 = 'b'.repeat( 31 ); return response; } ); }
			if ( boundary === 'changedSnapshot' ) { const raw = JSON.parse( c.storage.rows.get( c.key ) ); raw.pdfCreation.importPublication.attempt.request.snapshotJson = '{}';
				c.storage.rows.set( c.key, JSON.stringify( raw ) ); }
			const before = witness( c ); await c.lifecycle.initialize(); const after = witness( c );
			if ( boundary === 'changedBackup' ) after.records = before.records;
			expect( after ).toEqual( before ); expect( c.ui.confirmRecovery ).not.toHaveBeenCalled(); expect( c.ui.chooseEarlierDraft ).not.toHaveBeenCalled();
		} );
	it.each( [ 'check', 'review', 'restore', 'finalNativeRead' ] )( 'preserves newer destination work during %s', async stage => {
		const c = await setup( { newer: true } ); let release;
		if ( stage === 'check' ) c.api.postWithToken.mockImplementationOnce( () => new Promise( done => { release = () => done( {
			layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 } } ); } ) );
		if ( stage === 'review' ) c.ui.chooseEarlierDraft.mockImplementation( () => new Promise( done => { release = () => done( { selected: 0 } ); } ) );
		if ( stage === 'restore' ) c.ui.confirmRecovery.mockImplementation( () => new Promise( done => { release = () => done( true ); } ) );
		if ( stage === 'finalNativeRead' ) c.api.postWithToken.mockImplementationOnce( () => ( { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 } } ) )
			.mockImplementationOnce( () => new Promise( done => { release = () => done( { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 } } ); } ) );
		const pending = c.lifecycle.initialize(); await tick( () => !!release );
		c.fresh.editor.stateManager.set( 'layers', [ { id: 'live', type: 'text', text: 'Live destination edit' } ] );
		c.fresh.editor.historyManager.saveState( 'Live edit' );
		const newer = witness( c ); release(); await pending; expect( witness( c ) ).toEqual( newer );
		expect( c.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Live destination edit' );
	} );
	it( 'uses the actual approved dialog for Review, Restore and preserved keyboard focus', async () => {
		const c = await setup( { newer: true } ); mw.msg = message;
		HTMLDialogElement.prototype.showModal = jest.fn( function () { this.open = true; } );
		HTMLDialogElement.prototype.close = jest.fn( function () { this.open = false; } );
		const opener = document.createElement( 'button' ); document.body.appendChild( opener ); opener.focus();
		c.dialog = new Dialog( message ); c.ui.chooseEarlierDraft = rows => c.dialog.chooseEarlierCreation( rows ); c.ui.confirmRecovery = row => c.dialog.confirm( row );
		const before = witness( c ), pending = c.lifecycle.initialize(); await tick( () => !!document.querySelector( 'dialog.layers-page-recovery' ) );
		const modal = () => document.querySelector( 'dialog.layers-page-recovery' );
		expect( modal().querySelector( 'option' ).textContent ).toBe( 'Earlier draft 1' ); modal().querySelector( 'button' ).click();
		await tick( () => !!modal()?.querySelector( 'pre' ) ); expect( modal().querySelector( 'pre' ).textContent ).toContain( 'Newer recovered work' );
		expect( document.activeElement.textContent ).toBe( 'Keep drafts unchanged' ); expect( witness( c ) ).toEqual( before );
		modal().querySelector( 'button' ).click(); await pending; expect( c.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer recovered work' );
		expect( document.activeElement ).toBe( opener ); opener.remove();
	} );
} );
