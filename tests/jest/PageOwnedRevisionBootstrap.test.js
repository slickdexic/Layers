'use strict';
require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
require( '../../resources/ext.layers/viewer/PageOwnedRevisionView.js' );
const mount = require( '../../resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js' );
const fixture = require( '../fixtures/revisions/slide-document-v1.json' );

describe( 'Historical viewer bootstrap', () => {
	let container, cleanup, bundle;
	beforeEach( () => {
		container = document.createElement( 'div' );
		bundle = { owner: 'Owner', revisionId: 42, surface: fixture.surfaces[ 0 ] };
		cleanup = jest.fn();
		window.Layers.Viewer.renderPageOwnedRevision = jest.fn( () => cleanup );
		mw.msg = jest.fn( ( key ) => key );
	} );
	it( 'mounts only the supplied revision and disposes the renderer', () => {
		const dispose = mount( container, bundle );
		expect( mw.msg ).toHaveBeenCalledWith( 'layers-page-history-caption', 'Owner', 42, 'Welcome Slide' );
		expect( window.Layers.Viewer.renderPageOwnedRevision ).toHaveBeenCalledTimes( 1 );
		expect( container.querySelector( 'canvas' ).width ).toBe( 800 );
		dispose();
		dispose();
		expect( cleanup ).toHaveBeenCalledTimes( 1 );
		expect( container.children ).toHaveLength( 0 );
	} );
	it( 'mounts repeated inline bindings independently and leaves mismatched revisions unavailable', () => {
		const node = () => {
			const el = document.createElement( 'div' );
			el.className = 'layers-bound-slide';
			el.dataset.layersBinding = 'v1:10:a';
			el.dataset.layersRevision = '42';
			el.textContent = 'Unavailable';
			return el;
		};
		container.textContent = '';
		container.append( node(), node(), node(), node() );
		container.children[ 2 ].dataset.layersRevision = '43';
		container.children[ 3 ].dataset.layersBinding = 'v1:10:missing';
		const dispose = mount.mountInline( container, { 'v1:10:a': bundle } );
		expect( container.querySelectorAll( 'canvas' ) ).toHaveLength( 2 );
		expect( container.children[ 2 ].textContent ).toBe( 'Unavailable' );
		expect( container.children[ 3 ].textContent ).toBe( 'Unavailable' );
		dispose();
		dispose();
		expect( cleanup ).toHaveBeenCalledTimes( 2 );
	} );
	it( 'shows a fixed failure without attempting a fallback for invalid bootstrap data', () => {
		mount( container, null )();
		expect( container.textContent ).toBe( 'layers-page-history-render-failed' );
		expect( window.Layers.Viewer.renderPageOwnedRevision ).not.toHaveBeenCalled();
	} );
	it( 'removes failed canvas output without displaying renderer diagnostics', () => {
		window.Layers.Viewer.renderPageOwnedRevision.mockImplementation( () => { throw new Error( 'private' ); } );
		const dispose = mount( container, bundle );
		expect( container.querySelector( 'canvas' ) ).toBeNull();
		expect( container.textContent ).toContain( 'layers-page-history-render-failed' );
		expect( container.textContent ).not.toContain( 'private' );
		dispose();
	} );

	describe( 'inline loading through the read API', () => {
		function host( binding, revision ) {
			const el = document.createElement( 'div' );
			el.className = 'layers-bound-slide';
			el.dataset.layersBinding = binding;
			el.dataset.layersRevision = revision;
			el.textContent = 'Unavailable';
			container.append( el );
			return el;
		}

		it( 'requests only bindings of the displayed revision, once each, and mounts the reply', async () => {
			host( 'v1:10:a', '42' );
			host( 'v1:10:a', '42' );
			host( 'v1:10:b', '41' );
			const api = { get: jest.fn( () => Promise.resolve( { layersread: { bindings: { 'v1:10:a': bundle } } } ) ) };
			const dispose = await mount.loadInline( container, api, 'Owner', 42 );
			expect( api.get ).toHaveBeenCalledTimes( 1 );
			expect( api.get ).toHaveBeenCalledWith( { action: 'layersread', formatversion: 2, owner: 'Owner',
				revid: 42, binding: [ 'v1:10:a' ] } );
			expect( container.querySelectorAll( 'canvas' ) ).toHaveLength( 2 );
			expect( container.children[ 2 ].textContent ).toBe( 'Unavailable' );
			dispose();
		} );

		it( 'splits large pages into API-sized requests', async () => {
			for ( let i = 0; i < 51; i++ ) {
				host( 'v1:10:s' + i, '42' );
			}
			const api = { get: jest.fn( () => Promise.resolve( { layersread: { bindings: [] } } ) ) };
			await mount.loadInline( container, api, 'Owner', 42 );
			expect( api.get.mock.calls.map( ( call ) => call[ 0 ].binding.length ) ).toEqual( [ 50, 1 ] );
		} );

		it( 'leaves placeholders unavailable when the read fails or nothing is bound', async () => {
			host( 'v1:10:a', '42' );
			const failing = { get: jest.fn( () => Promise.reject( new Error( 'private' ) ) ) };
			( await mount.loadInline( container, failing, 'Owner', 42 ) )();
			expect( container.textContent ).toBe( 'Unavailable' );
			const unused = { get: jest.fn() };
			await mount.loadInline( container, unused, 'Owner', 7 );
			expect( unused.get ).not.toHaveBeenCalled();
		} );
	} );
} );
