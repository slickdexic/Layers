'use strict';
const Picker = require( '../../resources/ext.layers.editor/PageOwnedCopyPicker.js' );

describe( 'PageOwnedCopyPicker', () => {
	let header, right, options, dirty;
	const settle = async () => {
		for ( let i = 0; i < 8; i++ ) {
			await Promise.resolve();
		}
	};
	const pages = [
		{ title: 'Pump manual', pageid: 7, revid: 70, drawings: [
			{ id: 'a', label: 'Overview', kind: 'image' },
			{ id: 'b', label: 'Parts', kind: 'slide' }
		] }
	];

	beforeEach( () => {
		jest.useFakeTimers();
		dirty = false;
		header = document.createElement( 'div' );
		right = document.createElement( 'div' );
		header.appendChild( right );
		document.body.appendChild( header );
		options = {
			search: jest.fn().mockResolvedValue( pages ),
			copyUrl: ( page, drawing ) => `/copy?p=${ page.pageid }&d=${ drawing.id }`,
			isDirty: () => dirty,
			message: ( key, ...args ) => [ key, ...args ].join( '|' )
		};
	} );
	afterEach( () => {
		document.querySelectorAll( '.layers-page-copy-overlay' ).forEach( ( el ) => el.remove() );
		header.remove();
		jest.useRealTimers();
	} );

	async function opened() {
		const picker = new Picker( options );
		picker.mount( header, right );
		header.querySelector( '.layers-page-drawing-copy' ).click();
		await settle();
		return picker;
	}

	it( 'rejects missing callbacks and a bad mount target', () => {
		expect( () => new Picker( { ...options, search: null } ) ).toThrow( 'layers-invalid-copy-picker' );
		expect( () => new Picker( options ).mount( null ) ).toThrow( 'layers-invalid-mount-target' );
	} );

	it( 'mounts a named button before the other header controls', () => {
		const picker = new Picker( options );
		picker.mount( header, right );
		expect( header.firstChild.textContent ).toBe( 'layers-page-copy-from-page' );
		expect( header.children[ 1 ] ).toBe( right );
	} );

	it( 'opens an accessible dialog and lists every drawing with a link to its confirmation page', async () => {
		await opened();
		const dialog = document.querySelector( '[role="dialog"]' );
		expect( dialog.getAttribute( 'aria-modal' ) ).toBe( 'true' );
		expect( document.getElementById( dialog.getAttribute( 'aria-labelledby' ) ).textContent )
			.toBe( 'layers-page-copy-title' );
		expect( options.search ).toHaveBeenCalledWith( '' );
		const links = Array.from( dialog.querySelectorAll( 'li a' ) );
		expect( links.map( ( a ) => [ a.getAttribute( 'href' ), a.textContent ] ) ).toEqual( [
			[ '/copy?p=7&d=a', 'layers-page-copy-result|Overview|Pump manual' ],
			[ '/copy?p=7&d=b', 'layers-page-copy-result|Parts|Pump manual' ]
		] );
		expect( dialog.querySelector( '[role="status"]' ).textContent ).toBe( 'layers-page-copy-count|2' );
		expect( document.activeElement.type ).toBe( 'search' );
	} );

	it( 'searches after typing stops and ignores an answer to an older search', async () => {
		let resolveFirst;
		options.search = jest.fn()
			.mockImplementationOnce( () => new Promise( ( resolve ) => {
				resolveFirst = resolve;
			} ) )
			.mockResolvedValueOnce( [] );
		const picker = new Picker( options );
		picker.mount( header, right );
		header.querySelector( '.layers-page-drawing-copy' ).click();
		const input = document.querySelector( '.layers-page-copy-search' );
		input.value = 'Pump';
		input.dispatchEvent( new Event( 'input' ) );
		jest.advanceTimersByTime( 300 );
		await settle();
		expect( options.search ).toHaveBeenLastCalledWith( 'Pump' );
		resolveFirst( pages );
		await settle();
		expect( document.querySelectorAll( 'li a' ) ).toHaveLength( 0 );
		expect( document.querySelector( '[role="status"]' ).textContent ).toBe( 'layers-page-copy-none' );
	} );

	it( 'says when the list cannot be loaded', async () => {
		options.search = jest.fn().mockRejectedValue( new Error( 'x' ) );
		await opened();
		expect( document.querySelector( '[role="status"]' ).textContent ).toBe( 'layers-page-copy-failed' );
	} );

	it( 'warns about unsaved changes', async () => {
		dirty = true;
		await opened();
		expect( document.querySelector( '.layers-page-copy-unsaved' ).textContent ).toBe( 'layers-page-copy-unsaved' );
	} );

	it( 'closes on Escape without letting the editor handle the key, and returns focus to the button', async () => {
		await opened();
		const editorHandler = jest.fn();
		document.addEventListener( 'keydown', editorHandler );
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true, cancelable: true } ) );
		document.removeEventListener( 'keydown', editorHandler );
		expect( document.querySelector( '[role="dialog"]' ) ).toBeNull();
		expect( editorHandler ).not.toHaveBeenCalled();
		expect( document.activeElement ).toBe( header.querySelector( '.layers-page-drawing-copy' ) );
	} );

	it( 'keeps Tab inside the dialog', async () => {
		await opened();
		const close = document.querySelector( '.layers-page-copy-close' );
		close.focus();
		const event = new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true, cancelable: true } );
		document.dispatchEvent( event );
		expect( event.defaultPrevented ).toBe( true );
		expect( document.activeElement.type ).toBe( 'search' );
	} );

	it( 'is removed cleanly and stops answering once disposed', async () => {
		const picker = await opened();
		picker.dispose();
		picker.dispose();
		expect( document.querySelector( '.layers-page-copy-overlay' ) ).toBeNull();
		expect( header.querySelector( '.layers-page-drawing-copy' ) ).toBeNull();
	} );
} );
