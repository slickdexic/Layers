/** Closing waits for durable draft cleanup without clearing live work early. */
'use strict';
require( '../../resources/ext.layers.editor/LayersEditor.js' );
const Editor = window.Layers.Core.Editor;

describe( 'Close with asynchronous draft storage', () => {
	let editor, controller, finish, reject, notify;
	beforeEach( () => {
		notify = jest.fn();
		global.mw = { notify, log: { error: jest.fn() } };
		controller = { finalizeCloseAsync: jest.fn( () => new Promise( ( resolve, fail ) => {
			finish = resolve; reject = fail;
		} ) ) };
		editor = Object.create( Editor.prototype );
		editor.filename = 'Synthetic';
		editor.hasUnsavedChanges = () => false;
		editor.uiManager = { destroy: jest.fn(), hideSpinner: jest.fn() };
		editor.stateManager = { set: jest.fn() };
		editor.draftManager = { clearDraft: jest.fn() };
		editor.navigateBackToFileWithName = jest.fn();
		editor.apiManager = { pageOwnedDrafts: controller };
	} );

	test.each( [ true, false ] )( 'waits for cleanup result %s and suppresses repeated Close', async ok => {
		editor.cancel( true ); editor.cancel( true );
		expect( controller.finalizeCloseAsync ).toHaveBeenCalledTimes( 1 );
		expect( editor.draftManager.clearDraft ).not.toHaveBeenCalled();
		expect( editor.uiManager.destroy ).not.toHaveBeenCalled();
		finish( ok ); await Promise.resolve();
		expect( editor.uiManager.destroy ).toHaveBeenCalledTimes( ok ? 1 : 0 );
		expect( editor.navigateBackToFileWithName ).toHaveBeenCalledTimes( ok ? 1 : 0 );
		expect( editor._closePending ).toBe( false );
	} );

	test( 'a rejected cleanup preserves the open editor and permits a later retry', async () => {
		editor.cancel( true ); reject( new Error( 'layers-draft-storage-failed' ) );
		await Promise.resolve();
		expect( editor.uiManager.destroy ).not.toHaveBeenCalled();
		expect( editor.draftManager.clearDraft ).not.toHaveBeenCalled();
		expect( notify ).toHaveBeenCalled();
		editor.cancel( true );
		expect( controller.finalizeCloseAsync ).toHaveBeenCalledTimes( 2 );
		finish( false ); await Promise.resolve();
	} );

	test( 'Discard waits for the active PDF creation controller before clearing dirty state', async () => {
		editor.apiManager = { pageOwnedCreation: controller, pageOwnedDrafts: { finalizeClose: jest.fn() } };
		editor.hasUnsavedChanges = () => true;
		editor.unsavedChangesMessage = () => 'Unsaved layers';
		editor.dialogManager = { showSaveDiscardDialog: () => Promise.resolve( 'discard' ) };
		editor.cancel( false ); await Promise.resolve();
		expect( controller.finalizeCloseAsync ).toHaveBeenCalledWith( true );
		expect( editor.stateManager.set ).not.toHaveBeenCalled();
		finish( true ); await Promise.resolve();
		expect( editor.stateManager.set ).toHaveBeenCalledWith( 'isDirty', false );
		expect( editor.uiManager.destroy ).toHaveBeenCalledTimes( 1 );
		expect( editor.apiManager.pageOwnedDrafts.finalizeClose ).not.toHaveBeenCalled();
	} );
} );
