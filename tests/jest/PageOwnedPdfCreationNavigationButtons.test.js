'use strict';
global.TextEncoder = require( 'util' ).TextEncoder;
const fixture = require( './fixtures/pdfCreationHostImport.js' );
const { copy } = require( './fixtures/pdfCreationHost.js' );
const opened = [];

async function setup( imported = true ) {
	const work = fixture.setup(); opened.push( work ); await work.host.load();
	work.host.enableImports( { post: work.nativeImport.api.post, postWithToken: work.publicationApi.postWithToken } );
	work.host.enableImportHistory();
	work.editor.toolbar = { updateUndoRedoState: jest.fn() };
	if ( !imported ) return work;
	let count = 0;
	const plan = await work.host.prepareImport( copy( work.nativeImport.source ), {
		mode: 'empty', maxLayers: 100, allocateId: () => 'navigation-import-' + ++count
	} );
	work.host.commitImport( plan.handle );
	return work;
}

afterEach( () => { for ( const work of opened.splice( 0 ).reverse() ) work.close(); } );

describe( 'Creation PDF navigation toolbar history', () => {
	it( 'keeps the actual Undo button enabled after turning an imported PDF page', async () => {
		const work = await setup();
		expect( await work.host.turn( 1 ) ).toBe( true );
		expect( work.editor.toolbar.updateUndoRedoState ).toHaveBeenLastCalledWith( true, false );
		expect( await work.editor.historyManager.undo() ).toBe( true );
	});

	it( 'keeps the actual Redo button enabled across page turns after group Undo', async () => {
		const work = await setup();
		expect( await work.editor.historyManager.undo() ).toBe( true );
		for ( const page of [ 1, 2 ] ) {
			expect( await work.host.turn( page ) ).toBe( true );
			expect( work.editor.toolbar.updateUndoRedoState ).toHaveBeenLastCalledWith( false, true );
		}
		expect( await work.editor.historyManager.redo() ).toBe( true );
	});

	it.each( [ false, true ] )( 'refreshes recovered group controls after the recovery hold ends: undone=%s', async undone => {
		const source = await setup();
		expect( await source.host.turn( 1 ) ).toBe( true );
		if ( undone ) expect( await source.editor.historyManager.undo() ).toBe( true );
		const backup = source.host.captureDraftEnvelope(), receiver = await setup( false );
		const plan = receiver.host.prepareDraftRecovery( backup );
		expect( await receiver.host.commitDraftRecovery( plan.handle ) ).toBe( true );
		expect( receiver.editor.page ).toBe( 1 );
		expect( receiver.editor.toolbar.updateUndoRedoState ).toHaveBeenLastCalledWith( !undone, undone );
	} );
} );
