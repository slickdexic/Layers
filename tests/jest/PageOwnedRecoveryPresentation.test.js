'use strict';
const Dialog = require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );
const messages = require( '../../i18n/en.json' );
const msg = ( key, ...args ) => messages[ key ].replace( /\$(\d+)/g, ( _, n ) => String( args[ n - 1 ] ) );
describe( 'PageOwnedRecoveryPresentation', () => {
	let view, opener;
	beforeEach( () => {
		HTMLDialogElement.prototype.showModal = jest.fn( function () { this.open = true; } );
		HTMLDialogElement.prototype.close = jest.fn( function () { this.open = false; } );
		view = new Dialog( msg ); opener = document.createElement( 'button' ); document.body.appendChild( opener ); opener.focus();
	} );
	afterEach( () => { view.dispose(); opener.remove(); } );
	test( 'earlier preview explains source revision, complete recovery and explicit Save without displaying internal IDs', async () => {
		const row = { label: 'Installation notes <img src=x onerror=alert(1)>', earlierCreation: true, earlierNumber: 1,
			editorState: { layers: [ { text: '<img src=x onerror=alert(1)>' } ] }, writer: 'private-writer', pageId: 700123 };
		const before = JSON.stringify( row ), pending = view.chooseEarlierCreation( [ row ] );
		const dialog = document.querySelector( 'dialog' );
		expect( dialog.querySelector( 'h2' ).textContent ).toBe( 'Recover local layer edits' );
		expect( dialog.textContent ).toContain( 'From an earlier page revision' ); expect( dialog.textContent ).toContain( 'Undo/Redo history' );
		expect( dialog.textContent ).toContain( 'Layer set: Installation notes <img src=x onerror=alert(1)>' ); expect( dialog.textContent ).not.toContain( 'private-writer' );
		expect( dialog.textContent ).not.toContain( '700123' ); expect( dialog.querySelector( 'img' ) ).toBeNull();
		expect( dialog.querySelector( 'option' ).textContent ).toBe( 'Earlier draft 1' );
		dialog.querySelectorAll( 'button' )[ 1 ].click(); expect( await pending ).toEqual( { selected: null, cancelled: 0 } );
		expect( JSON.stringify( row ) ).toBe( before ); expect( document.activeElement ).toBe( opener );
	} );
	test( 'held recovery explains Check saved page while retaining explicit Restore and cancellation focus', async () => {
		const pending = view.confirm( { publicationBlocked: true, earlierCreation: true, earlierNumber: 1, editorState: { layers: [] } } );
		const dialog = document.querySelector( 'dialog' ); expect( dialog.querySelector( '.layers-page-recovery-warning' ).hidden ).toBe( false );
		expect( dialog.textContent ).toContain( 'After Restore, saving stays blocked.' ); expect( dialog.textContent ).toContain( 'Check saved page' );
		expect( document.activeElement.textContent ).toBe( 'Keep drafts unchanged' );
		expect( dialog.querySelector( 'button' ).textContent ).toBe( 'Restore local edits' ); dialog.querySelector( 'button' ).click();
		expect( await pending ).toBe( true );
	} );
	test( 'current choices retain order, wording and current cancellation guidance', async () => {
		const pending = view.chooseEarlierCreation( [ { editorState: { layers: [] } },
			{ editorState: { layers: [] } }, { earlierCreation: true, earlierNumber: 1, editorState: { layers: [] } } ] );
		const dialog = document.querySelector( 'dialog' );
		expect( Array.from( dialog.querySelectorAll( 'option' ), n => n.textContent ) ).toEqual( [ 'Draft 1', 'Draft 2', 'Earlier draft 1' ] );
		expect( dialog.querySelector( '.layers-page-recovery-cancellation' ).textContent ).toContain( 'Reopen the editor' );
		dialog.querySelectorAll( 'button' )[ 1 ].click(); expect( await pending ).toEqual( { selected: null, cancelled: 0 } );
	} );
	test( 'empty text has an explanation rather than claiming that other layers are absent', async () => {
		const pending = view.choose( [ { editorState: { layers: [ { type: 'rectangle' } ] } } ] ), dialog = document.querySelector( 'dialog' );
		expect( dialog.querySelector( 'pre' ).textContent ).toBe( 'No layer text to preview.' );
		expect( dialog.textContent ).toContain( 'Shapes and other non-text layers are not shown.' );
		expect( dialog.querySelector( 'button' ).disabled ).toBe( false ); view.dispose(); expect( await pending ).toBeNull();
	} );
	test( 'unreadable drafts still refuse Review and preserve the existing unavailable explanation', async () => {
		const pending = view.choose( [ {} ] ), dialog = document.querySelector( 'dialog' );
		expect( dialog.querySelector( 'button' ).disabled ).toBe( true );
		expect( dialog.querySelector( 'p' ).textContent ).toBe( 'This draft could not be read. It has been left unchanged.' );
		view.dispose(); expect( await pending ).toBeNull();
	} );
} );
