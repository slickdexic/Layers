'use strict';

const { ToolbarKeyboard } = require( '../../resources/ext.layers.editor/ToolbarKeyboard.js' );

function setup( config ) {
	const editor = { config, cancel: jest.fn(), layers: [] };
	const toolbar = { editor, selectTool: jest.fn() };
	const keyboard = new ToolbarKeyboard( toolbar );
	const escape = { key: 'Escape', target: { tagName: 'BUTTON' }, ctrlKey: false, metaKey: false };
	return { editor, toolbar, keyboard, escape };
}

describe( 'Page-owned toolbar Escape', () => {
	it( 'requests the same owning-page return as header Close', () => {
		const { editor, keyboard, escape } = setup( { pageOwned: true } );
		keyboard.handleKeyboardShortcuts( escape );
		expect( editor.cancel ).toHaveBeenCalledTimes( 1 );
		expect( editor.cancel ).toHaveBeenCalledWith( true );
	} );

	it.each( [ undefined, {}, { pageOwned: false } ] )( 'preserves the legacy no-argument cancellation for %p', config => {
		const { editor, keyboard, escape } = setup( config );
		keyboard.handleKeyboardShortcuts( escape );
		expect( editor.cancel ).toHaveBeenCalledTimes( 1 );
		expect( editor.cancel.mock.calls[ 0 ] ).toEqual( [] );
	} );

	it( 'keeps unfinished angle-dimension cancellation ahead of closing the page', () => {
		const { editor, toolbar, keyboard, escape } = setup( { pageOwned: true } );
		editor.canvasManager = { tempLayer: {}, renderLayers: jest.fn(), drawingController: {
			isAngleDimensionInProgress: jest.fn( () => true ), cancelAngleDimension: jest.fn()
		} };
		keyboard.handleKeyboardShortcuts( escape );
		expect( editor.cancel ).not.toHaveBeenCalled();
		expect( editor.canvasManager.drawingController.cancelAngleDimension ).toHaveBeenCalledTimes( 1 );
		expect( editor.canvasManager.tempLayer ).toBeNull();
		expect( toolbar.selectTool ).toHaveBeenCalledWith( 'pointer' );
	} );

	it( 'continues to ignore toolbar shortcuts while typing', () => {
		const { editor, keyboard, escape } = setup( { pageOwned: true } );
		escape.target.tagName = 'INPUT';
		keyboard.handleKeyboardShortcuts( escape );
		expect( editor.cancel ).not.toHaveBeenCalled();
	} );
} );
