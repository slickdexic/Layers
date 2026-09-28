'use strict';
const NameControl = require( '../../resources/ext.layers.editor/PageOwnedNameControl.js' );

describe( 'PageOwnedNameControl', () => {
	let header, right, options, name;
	const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
	beforeEach( () => {
		name = 'Welcome';
		header = document.createElement( 'div' );
		header.appendChild( document.createElement( 'div' ) );
		right = document.createElement( 'div' );
		header.appendChild( right );
		document.body.appendChild( header );
		options = {
			getName: () => name,
			rename: jest.fn( ( entered ) => {
				name = entered.trim();
				return name;
			} ),
			prompt: jest.fn().mockResolvedValue( 'Title slide' ),
			message: ( key, ...args ) => [ key, ...args ].join( '|' ),
			notify: jest.fn()
		};
	} );
	afterEach( () => header.remove() );

	function mount() {
		const control = new NameControl( options );
		control.mount( header, right );
		return control;
	}

	it( 'rejects missing callbacks and a bad mount target', () => {
		expect( () => new NameControl( { ...options, prompt: null } ) ).toThrow( 'layers-invalid-name-control' );
		expect( () => new NameControl( options ).mount( null ) ).toThrow( 'layers-invalid-mount-target' );
	} );

	it( 'shows the name before the header controls with a named button', () => {
		mount();
		const container = header.children[ 1 ];
		expect( container.className ).toBe( 'layers-page-drawing-name' );
		expect( header.children[ 2 ] ).toBe( right );
		expect( container.textContent ).toContain( 'layers-page-drawing-name|Welcome' );
		const button = container.querySelector( 'button' );
		expect( button.type ).toBe( 'button' );
		expect( button.textContent ).toBe( 'layers-page-drawing-rename' );
		expect( button.getAttribute( 'aria-label' ) ).toBe( 'layers-page-drawing-rename-title' );
	} );

	it( 'renames through the callback, shows the new name and says when it will be published', async () => {
		mount();
		const button = header.querySelector( '.layers-page-drawing-rename' );
		button.click();
		expect( button.disabled ).toBe( true );
		await flush();
		expect( options.prompt ).toHaveBeenCalledWith( expect.objectContaining( { defaultValue: 'Welcome' } ) );
		expect( options.rename ).toHaveBeenCalledWith( 'Title slide' );
		expect( header.textContent ).toContain( 'layers-page-drawing-name|Title slide' );
		expect( options.notify ).toHaveBeenCalledWith( 'layers-page-drawing-renamed|Title slide', 'info' );
		expect( button.disabled ).toBe( false );
		expect( document.activeElement ).toBe( button );
	} );

	it.each( [ null, '', '   ', 'Welcome' ] )( 'does nothing when the prompt returns %j', async ( entered ) => {
		options.prompt.mockResolvedValue( entered );
		mount();
		header.querySelector( '.layers-page-drawing-rename' ).click();
		await flush();
		expect( options.rename ).not.toHaveBeenCalled();
		expect( options.notify ).not.toHaveBeenCalled();
	} );

	it.each( [
		[ 'layers-page-drawing-rename-invalid', 'layers-page-drawing-rename-invalid|a|b|| [ ] { } < > :' ],
		[ 'layers-page-drawing-rename-taken', 'layers-page-drawing-rename-taken|a|b|| [ ] { } < > :' ],
		[ 'layers-editor-session-unavailable', 'layers-page-drawing-rename-failed' ]
	] )( 'reports %s without changing the shown name', async ( code, text ) => {
		options.prompt.mockResolvedValue( '  a|b ' );
		options.rename.mockImplementation( () => {
			throw Object.assign( new Error( code ), { code } );
		} );
		mount();
		header.querySelector( '.layers-page-drawing-rename' ).click();
		await flush();
		expect( options.notify ).toHaveBeenCalledWith( text, 'error' );
		expect( header.textContent ).toContain( 'layers-page-drawing-name|Welcome' );
	} );

	it( 'ignores a prompt that completes after disposal', async () => {
		let answer;
		options.prompt.mockReturnValue( new Promise( ( resolve ) => {
			answer = resolve;
		} ) );
		const control = mount();
		header.querySelector( '.layers-page-drawing-rename' ).click();
		control.dispose();
		control.dispose();
		answer( 'Late' );
		await flush();
		expect( options.rename ).not.toHaveBeenCalled();
		expect( header.querySelector( '.layers-page-drawing-name' ) ).toBeNull();
	} );
} );
