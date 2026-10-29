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
} );
