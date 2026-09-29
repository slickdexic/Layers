'use strict';
require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
require( '../../resources/ext.layers.shared/DrawingFields.js' );
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
	it( 'fills {{name}} tokens from the page fields of that drawing only, leaving the bundle untouched', () => {
		const surface = Object.assign( {}, fixture.surfaces[ 0 ], { layers: [
			Object.assign( {}, fixture.surfaces[ 0 ].layers[ 0 ], { text: 'Pressure {{ pressure }}, {{unknown}}' } ),
			{ id: 'rich', type: 'textbox', x: 1, y: 1, width: 50, height: 20, text: '',
				richText: [ { text: 'Status: ' }, { text: '{{status}}', style: { fontWeight: 'bold' } } ] }
		] } );
		const fielded = { owner: 'Owner', revisionId: 42, surface };
		const el = document.createElement( 'div' );
		el.className = 'layers-bound-slide';
		el.dataset.layersBinding = 'v1:10:a';
		el.dataset.layersRevision = '42';
		container.append( el );
		mount.mountInline( container, { 'v1:10:a': fielded },
			{ presentation: { pressure: '12 bar', status: 'OK', number: 5 }, other: { unknown: 'no' } } );
		const drawn = window.Layers.Viewer.renderPageOwnedRevision.mock.calls[ 0 ][ 1 ];
		expect( drawn.layers[ 0 ].text ).toBe( 'Pressure 12 bar, {{unknown}}' );
		expect( drawn.layers[ 1 ].richText ).toEqual( [ { text: 'Status: ' },
			{ text: 'OK', style: { fontWeight: 'bold' } } ] );
		expect( surface.layers[ 0 ].text ).toBe( 'Pressure {{ pressure }}, {{unknown}}' );
		// A value that is not text is ignored.
		expect( mount.withFields( fielded, { pressure: 5 } ).surface.layers[ 0 ].text )
			.toBe( 'Pressure {{ pressure }}, {{unknown}}' );
		expect( mount.withFields( fielded, undefined ) ).toBe( fielded );
	} );
	it( 'builds field values from the page entries, leaving out conflicting and malformed ones', () => {
		const entry = ( ...parts ) => JSON.stringify( parts );
		expect( mount.fieldsFromConfig( {
			[ entry( 'presentation', 'pressure', '12 bar' ) ]: true,
			[ entry( 'presentation', 'status', 'OK' ) ]: true,
			[ entry( 'presentation', 'status', 'Stopped' ) ]: true,
			[ entry( 'other', 'a', '' ) ]: true,
			[ entry( 'bad', 5, 'x' ) ]: true,
			'not json': true
		} ) ).toEqual( { presentation: { pressure: '12 bar' }, other: { a: '' } } );
		expect( mount.fieldsFromConfig( null ) ).toEqual( {} );
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

	describe( 'bound file embeds', () => {
		const pdfBundle = {
			owner: 'Owner', revisionId: 42,
			surface: Object.assign( {}, fixture.surfaces[ 0 ], { id: 'plan', kind: 'pdf', source: {
				repository: 'local', fileTitle: 'File:Plan.pdf', timestamp: '20260906120000',
				sha1: 'abcdefghijklmnopqrstuvwxyz01234', page: 2 } } ),
			source: { url: 'https://wiki.test/thumb/archive/page2-800px-Plan.pdf.jpg', width: 800, height: 600 }
		};
		function image( binding, revision ) {
			const link = document.createElement( 'a' );
			link.href = '/wiki/File:Plan.pdf';
			const img = document.createElement( 'img' );
			img.className = 'mw-file-element layers-bound-file';
			img.setAttribute( 'width', '240' );
			img.setAttribute( 'alt', 'Site plan' );
			img.dataset.layersBinding = binding;
			img.dataset.layersRevision = revision;
			link.append( img );
			container.append( link );
			return link;
		}

		it( 'replaces the image inside its link with a labelled canvas of the exact rendition', async () => {
			const link = image( 'v1:10:plan', '42' );
			const api = { get: jest.fn( () => Promise.resolve( { layersread: { bindings: { 'v1:10:plan': pdfBundle } } } ) ) };
			const dispose = await mount.loadInline( container, api, 'Owner', 42 );
			expect( api.get.mock.calls[ 0 ][ 0 ].binding ).toEqual( [ 'v1:10:plan' ] );
			expect( link.querySelector( 'img' ) ).toBeNull();
			const host = link.querySelector( '.layers-bound-file-view' );
			expect( host.style.width ).toBe( '240px' );
			const canvas = host.querySelector( 'canvas' );
			expect( canvas.getAttribute( 'role' ) ).toBe( 'img' );
			expect( canvas.getAttribute( 'aria-label' ) ).toBe( 'Site plan' );
			expect( host.querySelector( 'figcaption' ) ).toBeNull();
			const call = window.Layers.Viewer.renderPageOwnedRevision.mock.calls[ 0 ];
			expect( call[ 5 ] ).toEqual( pdfBundle.source );
			dispose();
		} );

		it( 'gives the canvas host the image\'s own box, so the page layout does not move', () => {
			const link = image( 'v1:10:plan', '42' );
			const img = link.querySelector( 'img' );
			img.style.verticalAlign = 'middle';
			img.style.border = '1px solid rgb(200, 204, 209)';
			img.style.padding = '0px';
			img.style.margin = '3px';
			mount.mountInline( container, { 'v1:10:plan': pdfBundle } );
			const host = link.querySelector( '.layers-bound-file-view' );
			expect( host.style.verticalAlign ).toBe( 'middle' );
			expect( host.style.borderTopWidth ).toBe( '1px' );
			expect( host.style.borderLeftStyle ).toBe( 'solid' );
			expect( host.style.borderBottomColor ).toBe( 'rgb(200, 204, 209)' );
			expect( host.style.marginRight ).toBe( '3px' );
			expect( host.style.display ).toBe( 'inline-block' );
		} );

		it( 'never puts an image surface in a slide host or a slide in an image host', () => {
			const link = image( 'v1:10:a', '42' );
			const slide = document.createElement( 'div' );
			slide.className = 'layers-bound-slide';
			slide.dataset.layersBinding = 'v1:10:plan';
			slide.dataset.layersRevision = '42';
			slide.textContent = 'Unavailable';
			container.append( slide );
			mount.mountInline( container, { 'v1:10:a': bundle, 'v1:10:plan': pdfBundle } );
			expect( link.querySelector( 'img' ) ).not.toBeNull();
			expect( slide.textContent ).toBe( 'Unavailable' );
			expect( window.Layers.Viewer.renderPageOwnedRevision ).not.toHaveBeenCalled();
		} );

		it( 'leaves the plain image when its drawing is unavailable or from another revision', () => {
			const current = image( 'v1:10:plan', '42' );
			const stale = image( 'v1:10:plan', '41' );
			mount.mountInline( container, {} );
			expect( container.querySelectorAll( 'img' ) ).toHaveLength( 2 );
			mount.mountInline( container, { 'v1:10:plan': pdfBundle } );
			expect( current.querySelector( 'img' ) ).toBeNull();
			expect( stale.querySelector( 'img' ) ).not.toBeNull();
		} );
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

	describe( 'diff comparison', () => {
		function side( binding, revision ) {
			const el = document.createElement( 'div' );
			el.className = 'layers-drawing-diff-view';
			el.dataset.layersBinding = binding;
			el.dataset.layersRevision = revision;
			el.textContent = 'Unavailable';
			container.append( el );
			return el;
		}

		it( 'reads each side at its own revision and mounts only matching replies', async () => {
			const before = side( 'v1:10:a', '41' );
			const after = side( 'v1:10:a', '42' );
			const reply = ( revision ) => ( { layersread: { bindings: {
				'v1:10:a': Object.assign( {}, bundle, { revisionId: revision } ) } } } );
			const api = { get: jest.fn( ( params ) => Promise.resolve( reply( params.revid === 41 ? 41 : 99 ) ) ) };
			const dispose = await mount.loadComparison( container, api, 'Owner' );
			expect( api.get.mock.calls.map( ( call ) => [ call[ 0 ].revid, call[ 0 ].binding ] ) )
				.toEqual( [ [ 41, [ 'v1:10:a' ] ], [ 42, [ 'v1:10:a' ] ] ] );
			expect( before.querySelector( 'canvas' ) ).not.toBeNull();
			// A reply for a different revision never fills a side.
			expect( after.textContent ).toBe( 'Unavailable' );
			dispose();
			expect( cleanup ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'leaves sides unavailable when a read fails and ignores malformed hosts', async () => {
			side( 'v1:10:a', '41' );
			side( 'v1:10:b', 'latest' );
			const api = { get: jest.fn( () => Promise.reject( new Error( 'private' ) ) ) };
			( await mount.loadComparison( container, api, 'Owner' ) )();
			expect( api.get ).toHaveBeenCalledTimes( 1 );
			expect( container.textContent ).toBe( 'UnavailableUnavailable' );
		} );
	} );
} );
