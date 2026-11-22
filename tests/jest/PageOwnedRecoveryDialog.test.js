'use strict';
const Dialog = require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );
const EventManager = require( '../../resources/ext.layers.editor/EventManager.js' );
const CanvasEvents = require( '../../resources/ext.layers.editor/CanvasEvents.js' );
const { ToolbarKeyboard } = require( '../../resources/ext.layers.editor/ToolbarKeyboard.js' );

describe( 'PageOwnedRecoveryDialog', () => {
	let view, opener;
	beforeEach( () => {
		HTMLDialogElement.prototype.showModal = jest.fn( function () { this.open = true; } );
		HTMLDialogElement.prototype.close = jest.fn( function () { this.open = false; } );
		view = new Dialog( ( key, number ) => key + ( number || '' ) );
		opener = document.createElement( 'button' );
		document.body.appendChild( opener );
		opener.focus();
	} );
	afterEach( () => { view.dispose(); opener.remove(); } );

	it( 'keeps editor shortcuts out of recovery and lets native Escape cancel one decision at a time', async () => {
		const editor = { save: jest.fn(), deleteSelected: jest.fn(), cancel: jest.fn() };
		const manager = new EventManager( editor );
		const toolbar = new ToolbarKeyboard( { editor } );
		const canvas = { canvas: document.createElement( 'canvas' ), selectAll: jest.fn() };
		const events = new CanvasEvents( canvas );
		manager.setupGlobalHandlers();
		manager.registerListener( document, 'keydown', toolbar.handleKeyboardShortcuts.bind( toolbar ) );
		const keydown = ( key, options = {} ) => document.activeElement.dispatchEvent(
			new KeyboardEvent( 'keydown', { key, bubbles: true, cancelable: true, ...options } ) );
		try {
			const pending = view.decide( { editorState: { layers: [ { text: 'Draft' } ] } } );
			const dialog = document.querySelector( 'dialog[open]' );
			const [ proceed, discard, cancel ] = dialog.querySelectorAll( 'button' );
			for ( const button of [ proceed, discard, cancel ] ) {
				button.focus();
				keydown( 's', { ctrlKey: true } );
				keydown( 'Delete' );
				keydown( 'a', { ctrlKey: true } );
			}
			expect( editor.save ).not.toHaveBeenCalled();
			expect( editor.deleteSelected ).not.toHaveBeenCalled();
			expect( canvas.selectAll ).not.toHaveBeenCalled();

			discard.click();
			expect( document.activeElement ).toBe( cancel );
			// jsdom does not synthesize the native cancel event for an unhandled Escape.
			expect( keydown( 'Escape' ) ).toBe( true );
			dialog.dispatchEvent( new Event( 'cancel', { cancelable: true } ) );
			expect( dialog.open ).toBe( true );
			expect( proceed.hidden ).toBe( false );
			expect( document.activeElement ).toBe( cancel );
			expect( keydown( 'Escape' ) ).toBe( true );
			dialog.dispatchEvent( new Event( 'cancel', { cancelable: true } ) );
			expect( await pending ).toBe( 'cancel' );
			expect( editor.cancel ).not.toHaveBeenCalled();
			expect( document.activeElement ).toBe( opener );
		} finally {
			manager.destroy();
			events.destroy();
		}
	} );

	it( 'requires explicit Discard confirmation and returns to recovery when confirmation is cancelled', async () => {
		const pending = view.decide( { editorState: { layers: [ { text: 'Draft' } ] } } );
		const dialog = document.querySelector( 'dialog' ), buttons = dialog.querySelectorAll( 'button' );
		expect( Array.from( buttons, button => button.textContent ) ).toEqual( [
			'layers-page-draft-dialog-continue', 'layers-page-draft-dialog-discard-open', 'layers-page-draft-dialog-cancel-opening' ] );
		buttons[ 1 ].click(); expect( document.activeElement ).toBe( buttons[ 2 ] );
		expect( buttons[ 1 ].textContent ).toBe( 'layers-page-draft-dialog-discard' );
		buttons[ 2 ].click(); expect( buttons[ 0 ].hidden ).toBe( false );
		expect( buttons[ 1 ].textContent ).toBe( 'layers-page-draft-dialog-discard-open' );
		buttons[ 1 ].click(); buttons[ 1 ].click(); expect( await pending ).toBe( 'discard' );
	} );

	it( 'renders markup as text and returns the selected index without modifying draft data', async () => {
		const candidates = [ { editorState: { layers: [ { text: '<img src=x onerror=alert(1)>' } ] } },
			{ editorState: { layers: [ { text: 'Second draft' } ] } } ];
		const result = view.choose( candidates );
		const dialog = document.querySelector( 'dialog' );
		expect( dialog.querySelector( 'img' ) ).toBeNull();
		expect( dialog.querySelector( 'pre' ).textContent ).toContain( '<img' );
		const select = dialog.querySelector( 'select' );
		expect( document.activeElement ).toBe( select );
		select.value = '1';
		select.dispatchEvent( new Event( 'change' ) );
		expect( dialog.querySelector( 'pre' ).textContent ).toBe( 'Second draft' );
		dialog.querySelector( 'button' ).click();
		expect( await result ).toBe( 1 );
		expect( candidates[ 0 ].editorState.layers[ 0 ].text ).toContain( '<img' );
		expect( document.activeElement ).toBe( opener );
	} );

	it( 'handles Escape cancellation without selecting or deleting a draft', async () => {
		const result = view.confirm( { editorState: { layers: [] }, publicationBlocked: true } );
		const dialog = document.querySelector( 'dialog' );
		expect( dialog.querySelector( 'p' ).textContent ).toBe( 'layers-page-draft-blocked' );
		dialog.dispatchEvent( new Event( 'cancel', { cancelable: true } ) );
		expect( await result ).toBe( false );
		expect( document.querySelector( 'dialog' ) ).toBeNull();
		expect( document.activeElement ).toBe( opener );
	} );

	it( 'disables unreadable records and bounds hostile or unusually long preview text', async () => {
		const result = view.choose( [ {}, { editorState: { layers: [ null, { text: 'x'.repeat( 10000 ) } ] } } ] );
		const dialog = document.querySelector( 'dialog' );
		expect( dialog.querySelector( 'button' ).disabled ).toBe( true );
		const select = dialog.querySelector( 'select' );
		select.value = '1';
		select.dispatchEvent( new Event( 'change' ) );
		expect( dialog.querySelector( 'pre' ).textContent ).toHaveLength( 200 );
		view.dispose();
		expect( await result ).toBeNull();
	} );

	it( 'disposal resolves a pending decision and removes its modal', async () => {
		const result = view.choose( [ { editorState: { layers: [] } } ] );
		view.dispose();
		expect( await result ).toBeNull();
		expect( document.querySelector( 'dialog' ) ).toBeNull();
	} );

	it( 'fails closed if native modal support is unavailable', async () => {
		HTMLDialogElement.prototype.showModal = undefined;
		expect( await view.confirm( { editorState: { layers: [] } } ) ).toBe( false );
		expect( document.querySelector( 'dialog' ) ).toBeNull();
	} );
} );
