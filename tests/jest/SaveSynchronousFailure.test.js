/** Unexpected synchronous Save failures must preserve work and report failure. */
'use strict';
require( '../../resources/ext.layers.editor/LayersEditor.js' );
const Editor = window.Layers.Core.Editor;

describe( 'synchronous Save failure feedback', () => {
	let editor, notify, layers;
	beforeEach( () => {
		notify = jest.fn();
		global.mw = { config: { get: () => false }, notify, log: { error: jest.fn() } };
		window.layersMessages = { get: key => key === 'layers-save-error' ? 'Localized Save failure' : 'Saving' };
		layers = [ { id: 'unsaved', type: 'rectangle', x: 7 } ];
		editor = Object.create( Editor.prototype );
		editor.config = { pageOwned: true };
		editor.stateManager = { get: key => key === 'layers' ? layers : true };
		editor.layerPanel = { settleGradientControls: jest.fn() };
		editor.uiManager = { showSpinner: jest.fn(), hideSpinner: jest.fn() };
		editor.apiManager = { saveLayers: jest.fn() };
	} );
	afterEach( () => { delete window.layersMessages; } );

	test.each( [ [ true, false ], [ false, false ], [ true, true ], [ false, true ] ] )(
		'localizes draft-storage refusal (synchronous=%s, quota=%s) without retry or data loss', async ( synchronous, quota ) => {
		const message = quota ? 'Your browser has no room for this local draft. Keep this editor open to preserve your changes. If storage becomes available, try Save again. Clearing this site’s data removes its local drafts.' :
			'Your local draft could not be saved. Keep this editor open to avoid losing changes.';
		window.layersMessages.get = ( key ) => key === ( quota ? 'layers-page-draft-quota' : 'layers-page-draft-failed' ) ? message : 'Saving';
		const error = new Error( quota ? 'layers-draft-storage-quota' : 'layers-draft-storage-failed' );
		if ( synchronous ) {
			error.code = error.message;
			editor.apiManager.saveLayers.mockImplementation( () => { throw error; } );
		} else {
			editor.apiManager.saveLayers.mockRejectedValue( error );
		}
		await expect( editor.saveCurrentPage() ).resolves.toBe( false );
		expect( notify ).toHaveBeenCalledWith( message, { type: 'error', classes: 'layers-save-error' } );
		expect( editor.apiManager.saveLayers ).toHaveBeenCalledTimes( 1 );
		expect( layers ).toEqual( [ { id: 'unsaved', type: 'rectangle', x: 7 } ] );
	} );

	test.each( [ 'preparation', 'dispatch' ] )( 'reports %s failure without retrying or losing work', async stage => {
		if ( stage === 'preparation' ) {
			editor.layerPanel.settleGradientControls.mockImplementation( () => { throw new Error( 'synthetic' ); } );
		} else {
			editor.apiManager.saveLayers.mockImplementation( () => { throw new Error( 'synthetic' ); } );
		}
		await expect( editor.saveCurrentPage() ).resolves.toBe( false );
		expect( notify ).toHaveBeenCalledWith( 'Localized Save failure',
			{ type: 'error', classes: 'layers-save-error' } );
		expect( editor.uiManager.hideSpinner ).toHaveBeenCalled();
		expect( editor.apiManager.saveLayers ).toHaveBeenCalledTimes( stage === 'preparation' ? 0 : 1 );
		expect( layers ).toEqual( [ { id: 'unsaved', type: 'rectangle', x: 7 } ] );
	} );

	test( 'marks an asynchronous Save error for visibility without retrying', async () => {
		editor.apiManager.saveLayers.mockRejectedValue( new Error( 'Synthetic async failure' ) );
		await expect( editor.saveCurrentPage() ).resolves.toBe( false );
		expect( notify ).toHaveBeenCalledWith( 'Synthetic async failure',
			{ type: 'error', classes: 'layers-save-error' } );
		expect( editor.apiManager.saveLayers ).toHaveBeenCalledTimes( 1 );
		expect( layers ).toEqual( [ { id: 'unsaved', type: 'rectangle', x: 7 } ] );
	} );

	test( 'marks a legacy Save validation error for visibility without publishing', async () => {
		editor.config = {};
		editor.validationManager = { validateLayers: () => ( { isValid: false, errors: [ 'Invalid layer' ] } ) };
		await expect( editor.saveCurrentPage() ).resolves.toBe( false );
		expect( notify ).toHaveBeenCalledWith( 'Saving: Invalid layer',
			{ type: 'error', classes: 'layers-save-error' } );
		expect( editor.apiManager.saveLayers ).not.toHaveBeenCalled();
		expect( layers ).toEqual( [ { id: 'unsaved', type: 'rectangle', x: 7 } ] );
	} );
} );
