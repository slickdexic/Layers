/**
 * Tests for PageBuffer - unsaved work for pages the reader has left.
 */

require( '../../resources/ext.layers.editor/PageBuffer.js' );

const PageBuffer = window.Layers.Editor.PageBuffer;

describe( 'PageBuffer', () => {
	let buffer;

	beforeEach( () => {
		buffer = new PageBuffer();
	} );

	it( 'starts empty', () => {
		expect( buffer.isEmpty() ).toBe( true );
		expect( buffer.size() ).toBe( 0 );
		expect( buffer.dirtyPages() ).toEqual( [] );
	} );

	it( 'holds and returns a page', () => {
		const entry = { page: 3, layers: [ { id: 'a' } ] };
		buffer.stash( 3, entry );

		expect( buffer.has( 3 ) ).toBe( true );
		expect( buffer.get( 3 ) ).toBe( entry );
		expect( buffer.isEmpty() ).toBe( false );
	} );

	it( 'returns null rather than undefined for a page it does not hold', () => {
		expect( buffer.get( 9 ) ).toBeNull();
		expect( buffer.has( 9 ) ).toBe( false );
	} );

	it( 'accepts a page number given as a string', () => {
		buffer.stash( '4', { layers: [] } );

		expect( buffer.has( 4 ) ).toBe( true );
		expect( buffer.get( '4' ) ).not.toBeNull();
		expect( buffer.dirtyPages() ).toEqual( [ 4 ] );
	} );

	it( 'ignores an unusable page number', () => {
		buffer.stash( 0, { layers: [] } );
		buffer.stash( -2, { layers: [] } );
		buffer.stash( 'x', { layers: [] } );
		buffer.stash( null, { layers: [] } );

		expect( buffer.isEmpty() ).toBe( true );
	} );

	it( 'ignores a missing entry', () => {
		buffer.stash( 2, null );

		expect( buffer.isEmpty() ).toBe( true );
	} );

	it( 'replaces an earlier stash of the same page', () => {
		buffer.stash( 2, { layers: [ { id: 'old' } ] } );
		buffer.stash( 2, { layers: [ { id: 'new' } ] } );

		expect( buffer.size() ).toBe( 1 );
		expect( buffer.get( 2 ).layers[ 0 ].id ).toBe( 'new' );
	} );

	it( 'lists held pages in reading order, not the order they were edited', () => {
		buffer.stash( 7, { layers: [] } );
		buffer.stash( 2, { layers: [] } );
		buffer.stash( 11, { layers: [] } );

		expect( buffer.dirtyPages() ).toEqual( [ 2, 7, 11 ] );
	} );

	it( 'sorts numerically rather than as text', () => {
		buffer.stash( 10, { layers: [] } );
		buffer.stash( 9, { layers: [] } );

		expect( buffer.dirtyPages() ).toEqual( [ 9, 10 ] );
	} );

	it( 'releases one page without disturbing the others', () => {
		buffer.stash( 1, { layers: [] } );
		buffer.stash( 5, { layers: [] } );

		buffer.forget( 1 );

		expect( buffer.has( 1 ) ).toBe( false );
		expect( buffer.has( 5 ) ).toBe( true );
		expect( buffer.size() ).toBe( 1 );
	} );

	it( 'forgetting a page it does not hold is harmless', () => {
		buffer.stash( 1, { layers: [] } );

		expect( () => buffer.forget( 99 ) ).not.toThrow();
		expect( buffer.size() ).toBe( 1 );
	} );

	it( 'clears everything', () => {
		buffer.stash( 1, { layers: [] } );
		buffer.stash( 2, { layers: [] } );

		buffer.clear();

		expect( buffer.isEmpty() ).toBe( true );
	} );
} );
