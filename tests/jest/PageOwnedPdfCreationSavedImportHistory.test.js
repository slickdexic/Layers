'use strict';
global.TextEncoder = require( 'util' ).TextEncoder;
const { build, copy } = require( './fixtures/pdfCreationSavedImport.js' );
const { witness, wait } = require( './fixtures/pdfCreationHost.js' );
const DraftController = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Application = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportApplication.js' );
const opened = [], delivered = [];
async function setup( options ) { const value = await build( options ); opened.push( value ); return value; }
async function handoff( value, options ) {
	const saved = await value.save( options ), result = await value.work.host.handoffSavedSession( saved.dependencies );
	delivered.push( result ); return { saved, result };
}
afterEach( () => {
	for ( const result of delivered.splice( 0 ).reverse() ) { result.importApplication.dispose(); result.importBinding.dispose(); result.bridge.dispose(); }
	for ( const value of opened.splice( 0 ).reverse() ) value.work.close();
} );
describe( 'Whole-PDF creation Import history through confirmed first Save', () => {
	it( 'transfers one group Undo/Redo, complete provenance and drafts into the actual saved editor', async () => {
		const value = await setup(), { saved, result } = await handoff( value );
		expect( result.needsRefresh ).toBe( false ); expect( result.importApplication.ownsBridge( result.bridge ) ).toBe( true );
		expect( value.work.editor.historyManager.hasPdfImportHistory( result.importApplication ) ).toBe( true );
		expect( result.creationBackup.version ).toBe( 4 );
		expect( result.creationBackup.importPublication.capsule.sources ).toEqual( saved.sourceReferences );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( result.importApplication.captureDraft().session.sources ).toEqual( [] );
		expect( result.bridge.session.getStatus().dirty ).toBe( true );
		expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( result.bridge.session.getDraft().snapshot ).toEqual( saved.snapshot );
		expect( result.bridge.session.getStatus().dirty ).toBe( false );
	} );
	it( 'keeps source-free saved members and native remapping when Redo restores an undone Import', async () => {
		const value = await setup( { undo: true } ), { saved, result } = await handoff( value );
		expect( result.needsRefresh ).toBe( false );
		expect( result.importApplication.captureDraft().session.sources ).toEqual( [] );
		expect( value.work.editor.historyManager.redo() ).toBe( true );
		const draft = result.importApplication.captureDraft(); expect( draft.session.sources ).toHaveLength( 1 );
		expect( draft.session.snapshot.surfaces.filter( member => member.kind === 'pdf' && member.label === 'ABC' &&
			member.source.fileTitle === 'File:Source.pdf' ) ).toHaveLength( 2 );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( result.bridge.session.getDraft().snapshot ).toEqual( saved.snapshot );
	} );
	it( 'preserves newer edits through handoff and undoes them before reversing the whole group', async () => {
		const value = await setup(), { result } = await handoff( value, { newer: true } );
		expect( result.needsRefresh ).toBe( false ); expect( result.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer imported work' );
		expect( result.bridge.session.getStatus().dirty ).toBe( true );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( result.importApplication.captureDraft().session.sources ).toEqual( [] );
		expect( value.work.editor.historyManager.redo() ).toBe( true ); expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( result.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer imported work' );
	} );
	it( 'keeps grouped history and the native page binding through saved page turns', async () => {
		const value = await setup(), { result } = await handoff( value );
		expect( await result.coordinator.turn( 1 ) ).toBe( true );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( value.work.editor.page ).toBe( 1 ); expect( await result.coordinator.turn( 2 ) ).toBe( true );
		expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( result.importApplication.captureDraft().session.sources ).toHaveLength( 1 );
	} );
	it.each( [ false, true ] )( 'uses the correct saved publication route after group action (source-free %s)', async sourceFree => {
		const value = await setup(), { result } = await handoff( value );
		if ( sourceFree ) expect( value.work.editor.historyManager.undo() ).toBe( true );
		value.work.publisher.publish.mockClear().mockResolvedValue( { revisionId: 14 } ); let backup;
		const saved = await result.bridge.save( 'Save retained history', () => { backup = result.importApplication.captureDraftForStorage(); } );
		expect( saved.revisionId ).toBe( 14 ); expect( backup.history.groups ).toHaveLength( 1 );
		expect( backup.session.sources ).toHaveLength( sourceFree ? 0 : 1 );
		if ( sourceFree ) { expect( value.work.publisher.publish ).toHaveBeenCalledTimes( 1 ); expect( value.importPublishApi.postWithToken ).not.toHaveBeenCalled(); }
		else { expect( value.work.publisher.publish ).not.toHaveBeenCalled(); expect( value.importPublishApi.postWithToken ).toHaveBeenCalledTimes( 1 ); }
		expect( value.work.editor.historyManager[ sourceFree ? 'redo' : 'undo' ]() ).toBe( true );
	} );
	it( 'retains complete grouped work on a subsequent saved publication refusal', async () => {
		const value = await setup(), { result } = await handoff( value );
		value.importPublishApi.postWithToken.mockRejectedValue( { code: 'layers-edit-conflict' } );
		const before = result.importApplication.captureDraftForStorage();
		await expect( result.bridge.save( 'Refused', jest.fn() ) ).rejects.toMatchObject( { code: 'layers-edit-conflict' } );
		const after = result.importApplication.captureDraftForStorage();
		expect( after.history ).toEqual( before.history ); expect( after.session.snapshot ).toEqual( before.session.snapshot );
		expect( after.session.sources ).toEqual( before.session.sources );
	} );
	it( 'persists the transferred group through the actual saved draft controller', async () => {
		const value = await setup(), { result } = await handoff( value ); value.work.editor.historyManager.undo();
		const rows = new Map(), storage = { get length() { return rows.size; }, key: index => Array.from( rows.keys() )[ index ],
			getItem: key => rows.get( key ) || null, setItem: ( key, data ) => rows.set( key, data ), removeItem: key => rows.delete( key ) };
		const controller = new DraftController( result.bridge, new DraftStore( storage, 'a'.repeat( 32 ) ), new Adapter(), { wiki: 'wiki', user: 'user' } );
		controller.enableWholePdfDrafts( result.importApplication ); controller.persist();
		const candidate = controller.inspectRecovery();
		expect( candidate.wholePdfImportDraft.history.groups[ 0 ].phase ).toBe( 'before' );
		expect( candidate.wholePdfImportDraft.session.sources ).toEqual( [] );
		expect( candidate.wholePdfImportDraft.history.groups[ 0 ].checkpoints.after.sources ).toHaveLength( 1 );
		const raw = Array.from( rows.values() )[ 0 ], prepared = await controller.prepareWholePdfDraftRecovery( candidate, () => {} );
		await controller.commitWholePdfDraftRecovery( prepared ); controller.releaseWholePdfDraftRecovery( prepared );
		expect( value.work.editor.historyManager.redo() ).toBe( true ); expect( Array.from( rows.values() )[ 0 ] ).toBe( raw );
	} );
	it( 'refuses changed native source access without replacing the creation route or its confirmation', async () => {
		const value = await setup(), saved = await value.save();
		value.sourceApi.post.mockRejectedValue( { code: 'permissiondenied' } );
		const before = { editor: witness( value.work ), draft: value.work.host.captureDraftEnvelope() };
		await expect( value.work.host.handoffSavedSession( saved.dependencies ) ).rejects.toThrow();
		expect( witness( value.work ) ).toEqual( before.editor ); expect( value.work.host.captureDraftEnvelope() ).toEqual( before.draft );
		expect( value.work.editor.historyManager.hasPdfImportHistory( value.work.host ) ).toBe( true );
	} );
	it( 'preserves a late editor edit while native transfer admission is pending', async () => {
		const value = await setup(), saved = await value.save(), entered = wait(), gate = wait();
		const original = value.sourceApi.post.getMockImplementation();
		value.sourceApi.post.mockImplementationOnce( async request => { entered.resolve(); await gate.promise; return original( request ); } );
		const pending = value.work.host.handoffSavedSession( saved.dependencies ); await entered.promise;
		value.work.edit( 'Late work survives' ); gate.resolve(); await expect( pending ).rejects.toThrow();
		expect( value.work.editor.layers[ 0 ].text ).toBe( 'Late work survives' );
		expect( value.work.host.getStatus().phase ).toBe( 'confirmed' );
		expect( value.work.editor.historyManager.hasPdfImportHistory( value.work.host ) ).toBe( true );
	} );
	it( 'refuses a replaced publication capability before transferring any live ownership', async () => {
		const value = await setup(), saved = await value.save(), before = witness( value.work );
		saved.dependencies.importPublisher = { publish: jest.fn() };
		await expect( value.work.host.handoffSavedSession( saved.dependencies ) ).rejects.toThrow();
		expect( witness( value.work ) ).toEqual( before ); expect( value.work.editor.historyManager.hasPdfImportHistory( value.work.host ) ).toBe( true );
	} );
	it( 'rejects a fabricated history transfer certificate', async () => {
		const value = await setup(), history = value.work.editor.historyManager;
		expect( () => history.preparePdfImportHistoryTransfer( value.work.host, {}, {} ) ).toThrow();
		expect( history.hasPdfImportHistory( value.work.host ) ).toBe( true );
	} );
	it( 'transfers multiple Import groups in order without merging their history operations', async () => {
		const value = await setup(); let next = 0;
		const prepared = await value.work.host.prepareImport( copy( value.work.nativeImport.source ), { mode: 'append', maxLayers: 100,
			allocateId: () => 'second-import-' + ++next } ); value.work.host.commitImport( prepared.handle );
		const { result } = await handoff( value );
		expect( result.needsRefresh ).toBe( false ); expect( result.importApplication.captureDraft().history.groups ).toHaveLength( 2 );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( result.importApplication.captureDraft().session.sources ).toHaveLength( 1 );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( result.importApplication.captureDraft().session.sources ).toEqual( [] );
		expect( value.work.editor.historyManager.redo() ).toBe( true ); expect( value.work.editor.historyManager.redo() ).toBe( true );
	} );
	it( 'retains trimmed groups as refusal barriers during the saved transfer', async () => {
		const value = await setup(); value.work.editor.historyManager.setMaxHistorySteps( 2 );
		value.work.edit( 'First later edit' ); value.work.edit( 'Second later edit' );
		const { result } = await handoff( value ); expect( result.needsRefresh ).toBe( false );
		expect( result.importApplication.captureDraft().history.groups[ 0 ].retired ).toBe( true );
		expect( await result.coordinator.turn( 1 ) ).toBe( true ); expect( value.work.editor.historyManager.undo() ).toBe( false );
		expect( result.importApplication.captureDraft().session.sources ).toHaveLength( 1 );
	} );
	it( 'refuses altered staged timelines before replacing the creation owner', async () => {
		const value = await setup(), saved = await value.save(), before = witness( value.work );
		const original = Application.prototype.prepareCreationHistoryTransfer;
		const changed = jest.spyOn( Application.prototype, 'prepareCreationHistoryTransfer' ).mockImplementation( async function ( ...args ) {
			const prepared = await original.apply( this, args ); prepared.timelines.get( 1 ).historyIndex = 0; return prepared;
		} );
		try { await expect( value.work.host.handoffSavedSession( saved.dependencies ) ).rejects.toThrow(); }
		finally { changed.mockRestore(); }
		expect( witness( value.work ) ).toEqual( before ); expect( value.work.editor.historyManager.hasPdfImportHistory( value.work.host ) ).toBe( true );
	} );
	it( 'refuses a publication-method replacement during native revalidation', async () => {
		const value = await setup(), saved = await value.save(), entered = wait(), gate = wait(), before = witness( value.work );
		const original = value.sourceApi.post.getMockImplementation();
		value.sourceApi.post.mockImplementationOnce( async request => { entered.resolve(); await gate.promise; return original( request ); } );
		const pending = value.work.host.handoffSavedSession( saved.dependencies ); await entered.promise;
		saved.dependencies.importPublisher.publish = jest.fn(); gate.resolve(); await expect( pending ).rejects.toThrow();
		expect( witness( value.work ) ).toEqual( before ); expect( value.work.editor.historyManager.hasPdfImportHistory( value.work.host ) ).toBe( true );
	} );
} );
