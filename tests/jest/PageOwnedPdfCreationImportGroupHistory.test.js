'use strict';
global.TextEncoder = require( 'util' ).TextEncoder;
const fixture = require( './fixtures/pdfCreationHostImport.js' );
const { copy, witness, wait } = require( './fixtures/pdfCreationHost.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const DraftController = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const opened = [];
async function setup() {
	const work = fixture.setup(); opened.push( work ); await work.host.load();
	work.host.enableImports( { post: work.nativeImport.api.post, postWithToken: work.publicationApi.postWithToken } );
	work.host.enableImportHistory(); return work;
}
async function apply( work, mode = 'empty' ) {
	let count = 0;
	const plan = await work.host.prepareImport( copy( work.nativeImport.source ), { mode, maxLayers: 100,
		allocateId: () => 'group-' + mode + '-' + ++count } );
	work.host.commitImport( plan.handle );
}
afterEach( () => { for ( const work of opened.splice( 0 ).reverse() ) work.close(); } );
describe( 'Whole-group history for missing PDF Import', () => {
	it( 'reverses every page and its source reference with the existing Undo and Redo controls', async () => {
		const work = await setup(); work.editor.toolbar = { updateUndoRedoState: jest.fn() }; await apply( work );
		expect( work.editor.toolbar.updateUndoRedoState ).toHaveBeenLastCalledWith( true, false );
		const after = work.host.captureDraftEnvelope();
		expect( after.version ).toBe( 4 ); expect( work.editor.historyManager.canUndo() ).toBe( true );
		expect( await work.editor.historyManager.undo() ).toBe( true );
		const before = work.host.captureDraftEnvelope();
		expect( before.importPublication.capsule.sources ).toEqual( [] );
		expect( before.history.members.every( row => row.timeline.historyIndex === 0 ) ).toBe( true );
		expect( before.draft.snapshot.surfaces.slice( work.native.baseBundle.snapshot.surfaces.length ).every( row => row.layers.length === 0 ) ).toBe( true );
		expect( await work.editor.historyManager.redo() ).toBe( true );
		const redone = work.host.captureDraftEnvelope();
		expect( redone.draft ).toEqual( after.draft );
		expect( redone.importPublication ).toEqual( after.importPublication );
	} );
	it( 'can undo from either page and keeps the viewed page through group restoration', async () => {
		const work = await setup(); await apply( work ); await work.host.turn( 1 );
		expect( await work.editor.historyManager.undo() ).toBe( true );
		expect( work.editor.page ).toBe( 1 ); expect( work.editor.layers ).toEqual( [] );
		expect( await work.host.turn( 2 ) ).toBe( true );
		expect( await work.editor.historyManager.redo() ).toBe( true );
		expect( work.editor.page ).toBe( 2 ); expect( work.editor.layers.length ).toBeGreaterThan( 0 );
	} );
	it( 'preserves later edits on an offscreen page until those edits are undone', async () => {
		const work = await setup(); await apply( work ); work.edit( 'Later on page two' ); await work.host.turn( 1 );
		const before = work.host.captureDraftEnvelope();
		expect( work.editor.historyManager.canUndo() ).toBe( false );
		expect( await work.editor.historyManager.undo() ).toBe( false );
		expect( work.host.captureDraftEnvelope() ).toEqual( before );
		await work.host.turn( 2 ); expect( work.editor.historyManager.undo() ).toBe( true );
		expect( await work.editor.historyManager.undo() ).toBe( true );
		expect( work.host.captureDraftEnvelope().importPublication.capsule.sources ).toEqual( [] );
	} );
	it( 'retains ordinary redo states beyond a group Undo and Redo', async () => {
		const work = await setup(); await apply( work ); work.edit( 'After Import' );
		expect( work.editor.historyManager.undo() ).toBe( true );
		expect( await work.editor.historyManager.undo() ).toBe( true );
		expect( await work.editor.historyManager.redo() ).toBe( true );
		expect( work.editor.historyManager.redo() ).toBe( true );
		expect( work.editor.layers[ 0 ].text ).toBe( 'After Import' );
	} );
	it( 'restores complete before and after layer values for Replace without changing the destination canvas', async () => {
		const work = await setup(); work.edit( 'Original on two' ); await work.host.turn( 1 ); work.edit( 'Original on one' );
		const before = work.host.getDraft(); await apply( work, 'replace' );
		const geometry = witness( work ).geometry;
		expect( await work.editor.historyManager.undo() ).toBe( true );
		expect( work.host.getDraft().snapshot ).toEqual( before.snapshot );
		expect( witness( work ).geometry ).toEqual( geometry );
		expect( await work.editor.historyManager.redo() ).toBe( true );
		expect( work.host.captureDraftEnvelope().importPublication.capsule.sources ).toHaveLength( 1 );
	} );
	it.each( [ false, true ] )( 'recovers a complete %s-side group draft and reauthorizes the next action', async undone => {
		const work = await setup(); await apply( work ); if ( undone ) await work.editor.historyManager.undo();
		const backup = work.host.captureDraftEnvelope(), receiver = await setup();
		const plan = receiver.host.prepareDraftRecovery( backup );
		expect( await receiver.host.commitDraftRecovery( plan.handle ) ).toBe( true );
		const method = undone ? 'redo' : 'undo';
		expect( await receiver.editor.historyManager[ method ]() ).toBe( true );
		expect( receiver.host.captureDraftEnvelope().importPublication.capsule.sources ).toHaveLength( undone ? 1 : 0 );
	} );
	it( 'refuses whole-group Redo after source authorization changes, preserving all work', async () => {
		const work = await setup(); await apply( work ); await work.editor.historyManager.undo();
		work.nativeImport.api.post.mockRejectedValue( Object.assign( new Error(), { code: 'permissiondenied' } ) );
		const before = { editor: witness( work ), draft: work.host.captureDraftEnvelope() };
		expect( await work.editor.historyManager.redo() ).toBe( false );
		expect( witness( work ) ).toEqual( before.editor ); expect( work.host.captureDraftEnvelope() ).toEqual( before.draft );
	} );
	it( 'refuses a late edit while group restoration awaits native admission', async () => {
		const work = await setup(); await apply( work ); const gate = wait();
		const original = work.reader.read.getMockImplementation(); work.reader.read.mockImplementationOnce( async request => { await gate.promise; return original( request ); } );
		const operation = work.editor.historyManager.undo(); work.edit( 'Must survive late edit' ); gate.resolve();
		expect( await operation ).toBe( false ); expect( work.editor.layers[ 0 ].text ).toBe( 'Must survive late edit' );
		expect( work.host.captureDraftEnvelope().importPublication.capsule.sources ).toHaveLength( 1 );
	} );
	it( 'does not let a direct history jump reverse only one PDF member', async () => {
		const work = await setup(); await apply( work ); const before = witness( work );
		expect( work.editor.historyManager.revertTo( 0 ) ).toBe( false );
		expect( work.editor.historyManager.restoreState( work.editor.historyManager.history[ 0 ] ) ).toBe( false );
		expect( witness( work ) ).toEqual( before );
	} );
	it( 'refuses a replacement timeline that drops the owned Import marker', async () => {
		const work = await setup(); await apply( work ); const before = witness( work );
		const timeline = work.editor.historyManager.captureTimeline(); timeline.history = timeline.history.slice( 0, 1 ); timeline.historyIndex = 0;
		expect( () => work.editor.historyManager.restoreTimeline( timeline ) ).toThrow();
		expect( witness( work ) ).toEqual( before );
	} );
	it( 'steps backward and forward across two whole-group Imports in order', async () => {
		const work = await setup(); await apply( work ); const first = work.host.getDraft(); await apply( work, 'append' );
		const second = work.host.getDraft(); expect( second.snapshot ).not.toEqual( first.snapshot );
		expect( await work.editor.historyManager.undo() ).toBe( true ); expect( work.host.getDraft().snapshot ).toEqual( first.snapshot );
		expect( await work.editor.historyManager.undo() ).toBe( true );
		expect( work.host.captureDraftEnvelope().importPublication.capsule.sources ).toEqual( [] );
		expect( await work.editor.historyManager.redo() ).toBe( true );
		expect( await work.editor.historyManager.redo() ).toBe( true ); expect( work.host.getDraft().snapshot ).toEqual( second.snapshot );
	} );
	it( 'keeps surviving Import markers as refusal barriers after another page branches away', async () => {
		const work = await setup(); await apply( work ); await work.editor.historyManager.undo();
		work.edit( 'Independent branch' ); await work.host.turn( 1 ); const before = work.host.captureDraftEnvelope();
		expect( work.editor.historyManager.canRedo() ).toBe( false ); expect( await work.editor.historyManager.redo() ).toBe( false );
		expect( work.host.captureDraftEnvelope() ).toEqual( before );
	} );
	it( 'preserves trimmed group barriers through recovery while allowing later ordinary work', async () => {
		const work = await setup(); await apply( work );
		work.editor.historyManager.setMaxHistorySteps( 1 );
		const backup = work.host.captureDraftEnvelope(), receiver = await setup();
		const plan = receiver.host.prepareDraftRecovery( backup ); await receiver.host.commitDraftRecovery( plan.handle );
		expect( await receiver.host.turn( 1 ) ).toBe( true );
		expect( receiver.editor.historyManager.canUndo() ).toBe( false );
		expect( await receiver.editor.historyManager.undo() ).toBe( false );
		receiver.edit( 'After trimmed history' ); expect( receiver.editor.historyManager.undo() ).toBe( true );
		expect( receiver.host.captureDraftEnvelope().importPublication.capsule.sources ).toHaveLength( 1 );
	} );
	it( 'reports a committed group transition accurately if presentation fails afterward', async () => {
		const work = await setup(); await apply( work );
		work.editor.toolbar = { updateUndoRedoState: () => { throw new Error( 'presentation failure' ); } };
		expect( await work.editor.historyManager.undo() ).toBe( true );
		expect( work.host.getStatus().needsRefresh ).toBe( true );
		expect( work.host.captureDraftEnvelope().importPublication.capsule.sources ).toEqual( [] );
		expect( work.host.captureDraftEnvelope().importHistory.groups[ 0 ].phase ).toBe( 'before' );
	} );
	it( 'retains the group and publication result when saved-session transfer is not yet supported', async () => {
		const work = await setup(); await apply( work ); await work.host.save( 'Import', jest.fn() );
		const before = work.host.captureDraftEnvelope();
		await expect( work.host.handoffSavedSession( {} ) ).rejects.toThrow();
		expect( work.host.captureDraftEnvelope() ).toEqual( before ); expect( work.host.getStatus().phase ).toBe( 'confirmed' );
	} );
	it( 'retains the exact source-free attempt and group Redo data before saving after Undo', async () => {
		const work = await setup(); await apply( work ); await work.editor.historyManager.undo();
		work.publisher.publish.mockResolvedValue( { revisionId: 13 } ); let backup;
		const result = await work.host.save( 'Create without Import', () => { backup = work.host.captureDraftEnvelope(); } );
		expect( result.hostReady ).toBe( true ); expect( work.publicationApi.postWithToken ).not.toHaveBeenCalled();
		expect( backup.importPublication.attempt.version ).toBe( 2 );
		expect( backup.importHistory.groups[ 0 ].phase ).toBe( 'before' );
		expect( backup.importHistory.groups[ 0 ].after.sources ).toHaveLength( 1 );
	} );
	it( 'refuses orphaned or altered group markers during draft review', async () => {
		const work = await setup(); await apply( work ); const backup = work.host.captureDraftEnvelope(), receiver = await setup();
		const altered = copy( backup ); altered.history.members[ 0 ].timeline.history[ 1 ].pdfImportGroup.id = 'f'.repeat( 32 );
		expect( () => receiver.host.prepareDraftRecovery( altered ) ).toThrow();
		const orphan = copy( backup ); orphan.importHistory.groups = [];
		expect( () => receiver.host.prepareDraftRecovery( orphan ) ).toThrow();
	} );
	it( 'persists and explicitly restores group Redo through the real draft controller', async () => {
		const values = new Map(), storage = { get length() { return values.size; }, key: index => Array.from( values.keys() )[ index ] || null,
			getItem: key => values.has( key ) ? values.get( key ) : null, setItem: ( key, value ) => values.set( key, value ), removeItem: key => values.delete( key ) };
		const work = await setup(), controller = new DraftController( work.host, new DraftStore( storage, 'a'.repeat( 32 ) ),
			{ wiki: 'wiki', user: 'user' }, { retainPublicationAttempt: true } );
		let receiverController;
		try {
			await controller.review( { choose: async () => 0, confirm: async () => true } );
			await apply( work ); await work.editor.historyManager.undo(); controller.persist();
			const retained = Array.from( values.values() )[ 0 ], receiver = await setup();
			receiverController = new DraftController( receiver.host, new DraftStore( storage, 'b'.repeat( 32 ) ),
				{ wiki: 'wiki', user: 'user' }, { retainPublicationAttempt: true } );
			expect( await receiverController.review( { choose: async () => 0, confirm: async () => true } ) ).toBe( true );
			expect( await receiver.editor.historyManager.redo() ).toBe( true );
			expect( receiver.host.captureDraftEnvelope().importPublication.capsule.sources ).toHaveLength( 1 );
			expect( Array.from( values.values() )[ 0 ] ).toBe( retained );
		} finally { controller.dispose(); if ( receiverController ) receiverController.dispose(); }
	} );
} );
