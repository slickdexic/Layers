'use strict';
global.TextEncoder = require( 'util' ).TextEncoder;
const { build } = require( './fixtures/pdfCreationSavedImport.js' );
require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportApplication.js' );

const opened = [], delivered = [];
afterEach( () => {
	for ( const result of delivered.splice( 0 ).reverse() ) {
		result.importApplication.dispose(); result.importBinding.dispose(); result.bridge.dispose();
	}
	for ( const value of opened.splice( 0 ).reverse() ) { value.work.close(); }
} );

it.each( [ 'undo', 'redo' ] )( 'refreshes existing button state immediately after saved Import group %s', async action => {
	const value = await build(); opened.push( value );
	const saved = await value.save();
	const result = await value.work.host.handoffSavedSession( saved.dependencies ); delivered.push( result );
	const updateUndoRedoState = jest.fn();
	value.work.editor.toolbar = { updateUndoRedoState };
	if ( action === 'redo' ) expect( value.work.editor.historyManager.undo() ).toBe( true );
	updateUndoRedoState.mockClear();
	expect( value.work.editor.historyManager[ action ]() ).toBe( true );
	expect( updateUndoRedoState ).toHaveBeenLastCalledWith( action === 'redo', action === 'undo' );
} );

it.each( [ false, true ] )( 'refreshes button state after saved Import recovery (before side %s)', async undone => {
	const value = await build(); opened.push( value );
	const saved = await value.save();
	const result = await value.work.host.handoffSavedSession( saved.dependencies ); delivered.push( result );
	if ( undone ) { expect( value.work.editor.historyManager.undo() ).toBe( true ); }
	const draft = result.importApplication.captureDraft();
	const updateUndoRedoState = jest.fn();
	value.work.editor.toolbar = { updateUndoRedoState };
	updateUndoRedoState.mockClear();
	const handle = await result.importApplication.prepareDraftRecovery( draft, () => {} );
	try {
		await result.importApplication.commitDraftRecovery( handle );
		expect( updateUndoRedoState ).toHaveBeenLastCalledWith( !undone, undone );
	} finally { result.importApplication.releaseDraftRecovery( handle ); }
} );
