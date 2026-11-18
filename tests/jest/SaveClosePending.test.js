/** Close must wait for the whole Save, including its confirmed-base backup. */
'use strict';
require( '../../resources/ext.layers.editor/LayersEditor.js' );
const Editor = window.Layers.Core.Editor;

describe( 'Save followed immediately by Close', () => {
	let editor, dirty, finish, result, layers;
	beforeEach( () => {
		global.mw = { config: { get: () => false }, notify: jest.fn(), log: { error: jest.fn() } };
		editor = Object.create( Editor.prototype ); dirty = true;
		layers = [ { id: 'arrow', type: 'arrow', x1: 10, x2: 200 } ];
		result = { dirty: false, editorStateValid: true, draftPersisted: true };
		editor.config = { pageOwned: true }; editor.filename = 'Owner';
		editor.stateManager = { get: key => key === 'layers' ? layers : dirty };
		editor.uiManager = { showSpinner: jest.fn(), hideSpinner: jest.fn(), destroy: jest.fn() };
		editor.layerPanel = { settleGradientControls: jest.fn() };
		editor.dialogManager = { showSaveDiscardDialog: jest.fn().mockResolvedValue( 'cancel' ) };
		editor.navigateBackToFileWithName = jest.fn();
		editor.apiManager = {
			pageOwnedDrafts: { finalizeCloseAsync: jest.fn().mockResolvedValue( true ) },
			saveLayers: jest.fn( () => new Promise( resolve => { finish = () => {
				dirty = result.dirty; resolve( result );
			}; } ) )
		};
	} );
	const settle = async () => { for ( let turn = 0; turn < 8; turn++ ) { await Promise.resolve(); } };

	test( 'repeated Save and Close wait for one completed publication and backup', async () => {
		const saving = editor.save();
		expect( editor.save() ).toBe( saving );
		editor.cancel( true ); editor.cancel( true );
		expect( editor.apiManager.saveLayers ).toHaveBeenCalledTimes( 1 );
		expect( editor.dialogManager.showSaveDiscardDialog ).not.toHaveBeenCalled();
		expect( editor.apiManager.pageOwnedDrafts.finalizeCloseAsync ).not.toHaveBeenCalled();
		finish(); await saving; await settle();
		expect( editor.uiManager.destroy ).toHaveBeenCalledTimes( 1 );
		expect( editor.navigateBackToFileWithName ).toHaveBeenCalledWith( 'Owner' );
		expect( editor.apiManager.pageOwnedDrafts.finalizeCloseAsync ).toHaveBeenCalledWith( false );
		expect( mw.notify ).not.toHaveBeenCalled();
	} );

	test.each( [ 'newer edits', 'failed final backup' ] )(
		'%s keeps the editor open without an automatic second publication', async reason => {
		const saving = editor.save(); editor.cancel( true );
		if ( reason === 'failed final backup' ) { result.draftPersisted = false; }
		else { result.dirty = true; }
		finish(); expect( await saving ).toBe( false ); await settle();
		expect( editor.uiManager.destroy ).not.toHaveBeenCalled();
		expect( editor.apiManager.pageOwnedDrafts.finalizeCloseAsync ).not.toHaveBeenCalled();
		expect( editor.apiManager.saveLayers ).toHaveBeenCalledTimes( 1 );
		expect( editor._closePending ).toBe( false );
		expect( editor.stateManager.get( 'layers' ) ).toBe( layers );
		const retry = editor.save(); finish(); await retry;
		expect( editor.apiManager.saveLayers ).toHaveBeenCalledTimes( 2 );
	} );

	test( 'an asynchronous publication refusal reports once and leaves the work open', async () => {
		let reject;
		editor.apiManager.saveLayers.mockImplementation( () => new Promise( ( resolve, fail ) => { reject = fail; } ) );
		const saving = editor.save(); editor.cancel( true );
		reject( new Error( 'layers-publication-outcome-unknown' ) );
		expect( await saving ).toBe( false ); await settle();
		expect( editor.uiManager.destroy ).not.toHaveBeenCalled();
		expect( mw.notify ).toHaveBeenCalledTimes( 1 );
		expect( editor._savePromise ).toBe( null );
		expect( editor._closePending ).toBe( false );
		expect( dirty ).toBe( true );
	} );
} );
