'use strict';
const Dialog = require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );

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
