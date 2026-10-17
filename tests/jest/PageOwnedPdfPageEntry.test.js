'use strict';

const load = require( '../../resources/ext.layers/viewer/PageOwnedPdfPageBootstrap.js' );
const Adapter = require( '../../resources/ext.layers/viewer/PageOwnedViewerAdapter.js' );

describe( 'Sparse page-owned PDF page overlays', () => {
	let root, surface, bundle, viewer, api, overlays, lightbox, originalImage, oldConfigGet;
	const binding = 'v1:10:plan';
	const targetPage = 1;
	const pdfUrl = '/rest.php/layers/v0/pdf?owner=Owner&revid=42&binding=v1%3A10%3Aplan';
	const renditionUrl = '/rest.php/layers/v0/pdf-page?owner=Owner&revid=42&page=1';

	class TestOverlay {
		constructor( options ) { this.options = options; overlays.push( this ); }
		init() {
			this.node = document.createElement( 'div' );
			this.node.className = 'layers-viewer-overlay';
			if ( this.options.canEdit ) {
				const edit = document.createElement( 'button' );
				edit.className = 'layers-viewer-overlay-btn--edit';
				edit.addEventListener( 'click', () => this.options.onEdit( edit ) );
				this.node.append( edit );
			}
			const view = document.createElement( 'button' );
			view.className = 'layers-viewer-overlay-btn--view';
			view.addEventListener( 'click', () => this.options.onView( view ) );
			this.node.append( view );
			this.options.container.append( this.node );
		}
		destroy() { if ( this.node ) this.node.remove(); }
	}

	class TestImage {
		set src( value ) {
			this._src = value;
			if ( this.onload ) this.onload();
		}
		get src() { return this._src; }
	}

	function makeViewer() {
		return { owner: 'Owner', pageId: 10, revisionId: 42, binding, kind: 'pdf', label: 'Plan',
			initialPage: 2, targetPage, pageCount: 3,
			source: { url: pdfUrl, exactVersion: true },
			pages: [ { page: 2, surface } ],
			display: { page: targetPage, canvas: { width: 800, height: 600 },
				source: { repository: 'local', fileTitle: 'File:Plan.pdf', timestamp: '20261005120000',
					sha1: 'abcdefghijklmnopqrstuvwxyz12345', page: targetPage },
				rendition: { url: renditionUrl, width: 1600, height: 1200 } } };
	}
	function imageHost( attrs = {} ) {
		const link = document.createElement( 'a' );
		link.href = '/wiki/File:Plan.pdf';
		const image = document.createElement( 'img' );
		image.className = 'layers-bound-pdf-page';
		image.setAttribute( 'src', '/thumb/current-page1.jpg' );
		image.setAttribute( 'alt', 'Plan page 1' );
		image.setAttribute( 'width', '320' );
		image.setAttribute( 'srcset', '/thumb/current-small.jpg 1x, /thumb/current-large.jpg 2x' );
		image.setAttribute( 'sizes', '(max-width: 320px) 100vw, 320px' );
		image.style.maxWidth = '100%';
		image.setAttribute( 'data-layers-pdf-anchor', binding );
		image.setAttribute( 'data-layers-pdf-revision', '42' );
		image.setAttribute( 'data-layers-pdf-page', '1' );
		Object.entries( attrs ).forEach( ( [ key, value ] ) => image.setAttribute( key, value ) );
		link.append( image );
		const caption = document.createElement( 'figcaption' );
		caption.textContent = 'Plan caption';
		root.append( link, caption );
		return { link, image, caption };
	}
	function apiFor() {
		return { get: jest.fn( params => {
			if ( params.controls ) {
				return Promise.resolve( { layersread: { bindings: { [ binding ]: bundle } } } );
			}
			return Promise.resolve( { layersread: { viewer: viewer } } );
		} ) };
	}
	async function mounted( opts = {} ) {
		const host = imageHost( opts.attrs );
		api = opts.api || apiFor();
		const dispose = await load( root, api, opts.owner || 'Owner', opts.revisionId || 42, {} );
		await new Promise( resolve => setTimeout( resolve, 0 ) );
		return { ...host, dispose };
	}

	beforeEach( () => {
		require( '../../resources/ext.layers.shared/DrawingFields.js' );
		root = document.createElement( 'figure' );
		document.body.append( root );
		surface = { id: 'plan', kind: 'pdf', label: 'Plan',
			canvas: { width: 800, height: 600 }, layers: [ { id: 'stored', type: 'text', text: 'page 2 only' } ],
			source: { repository: 'local', fileTitle: 'File:Plan.pdf', timestamp: '20261005120000',
				sha1: 'abcdefghijklmnopqrstuvwxyz12345', page: 2 } };
		bundle = { owner: 'Owner', pageId: 10, revisionId: 42, surface, editUrl: '/wiki/Special:EditLayersPage?owner=Owner&surface=plan&revid=42' };
		viewer = makeViewer();
		overlays = [];
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};
		window.Layers.Viewer.Overlay = TestOverlay;
		window.Layers.Viewer.PageOwnedViewerAdapter = Adapter;
		lightbox = { open: jest.fn( config => { lightbox.pageOwned = config.pageOwned; lightbox._sessionToken++; } ),
			close: jest.fn( () => { lightbox.pageOwned = null; } ), pageOwned: null, _sessionToken: 0 };
		window.Layers.lightbox = lightbox;
		mw.msg = jest.fn( key => key );
		oldConfigGet = mw.config.get;
		mw.config.get = jest.fn( key => ( { wgAction: 'view', wgRevisionId: 42, wgCurRevisionId: 42 } )[ key ] );
		originalImage = window.Image;
		window.Image = TestImage;
	} );
	afterEach( () => {
		window.Image = originalImage;
		mw.config.get = oldConfigGet;
		root.remove();
	} );

	it( 'keeps the native link and caption, displays the archived page rendition, and overlays both controls', async () => {
		const { link, image, caption, dispose } = await mounted();
		expect( api.get ).toHaveBeenNthCalledWith( 1, { action: 'layersread', formatversion: 2,
			owner: 'Owner', revid: 42, binding, controls: 1 } );
		expect( api.get ).toHaveBeenNthCalledWith( 2, { action: 'layersread', formatversion: 2,
			owner: 'Owner', revid: 42, binding, viewer: 1, viewpage: 1 } );
		expect( image.getAttribute( 'src' ) ).toBe( renditionUrl );
		expect( image.getAttribute( 'alt' ) ).toBe( 'Plan page 1' );
		expect( image.getAttribute( 'width' ) ).toBe( '320' );
		expect( image.getAttribute( 'height' ) ).toBe( '240' );
		expect( image.hasAttribute( 'srcset' ) ).toBe( false );
		expect( image.hasAttribute( 'sizes' ) ).toBe( false );
		expect( image.style.aspectRatio ).toBe( '800 / 600' );
		expect( image.parentElement.style.width ).toBe( '320px' );
		expect( image.parentElement.classList.contains( 'layers-bound-controls' ) ).toBe( true );
		expect( link.contains( image ) ).toBe( true );
		expect( caption.textContent ).toBe( 'Plan caption' );
		expect( root.querySelector( '.layers-viewer-overlay-btn--edit' ) ).not.toBeNull();
		expect( root.querySelector( '.layers-viewer-overlay-btn--view' ) ).not.toBeNull();
		expect( load.editUrlForPage( bundle.editUrl, 1 ) ).toContain( 'pdfpage=1' );
		expect( image.getAttribute( 'data-layers-pdf-anchor' ) ).toBe( binding );
		expect( image.hasAttribute( 'data-layers-revision' ) ).toBe( false );
		expect( dispose ).toEqual( expect.any( Function ) );
		dispose();
		expect( image.getAttribute( 'src' ) ).toBe( '/thumb/current-page1.jpg' );
		expect( image.getAttribute( 'srcset' ) ).toBe( '/thumb/current-small.jpg 1x, /thumb/current-large.jpg 2x' );
		expect( image.getAttribute( 'sizes' ) ).toBe( '(max-width: 320px) 100vw, 320px' );
		expect( image.hasAttribute( 'height' ) ).toBe( false );
		expect( image.style.aspectRatio ).toBe( '' );
		expect( link.contains( image ) ).toBe( true );
	} );

	it( 'opens View with the stored anchor and requested target while never using page 2 layers inline', async () => {
		const { dispose } = await mounted();
		root.querySelector( '.layers-viewer-overlay-btn--view' ).click();
		const opened = lightbox.open.mock.calls[ 0 ][ 0 ];
		expect( opened.pageOwned.bundle ).toBe( bundle );
		expect( opened.pageOwned.binding ).toBe( binding );
		expect( opened.pageOwned.targetPage ).toBe( 1 );
		expect( viewer.pages[ 0 ].surface.layers[ 0 ].text ).toBe( 'page 2 only' );
		await opened.pageOwned.read();
		expect( api.get ).toHaveBeenLastCalledWith( { action: 'layersread', formatversion: 2,
			owner: 'Owner', revid: 42, binding, viewer: 1, viewpage: 1 } );
		dispose();
		expect( lightbox.close ).toHaveBeenCalledWith( true );
	} );

	it.each( [
		[ 'noedit marker', { 'data-layers-noedit': '1' }, null ],
		[ 'historical page', {}, 43 ]
	] )( 'keeps View and suppresses Edit for %s', async ( label, attrs, revision ) => {
		if ( revision ) {
			mw.config.get = key => ( { wgAction: 'view', wgRevisionId: 42, wgCurRevisionId: 43 } )[ key ];
		}
		const { dispose } = await mounted( { attrs, revisionId: 42 } );
		expect( root.querySelector( '.layers-viewer-overlay-btn--edit' ) ).toBeNull();
		expect( root.querySelector( '.layers-viewer-overlay-btn--view' ) ).not.toBeNull();
		dispose();
	} );

	it.each( [
		[ 'foreign owner', { owner: 'Other' } ],
		[ 'mismatched revision', { revisionId: 43 } ],
		[ 'malformed anchor', { attrs: { 'data-layers-pdf-anchor': 'bad' } } ],
		[ 'malformed target', { attrs: { 'data-layers-pdf-page': '0' } } ]
	] )( 'shows the fixed refusal for %s without legacy or save requests', async ( label, options ) => {
		const { dispose } = await mounted( options );
		expect( root.textContent ).toContain( 'layers-page-history-render-failed' );
		expect( api.get.mock.calls.every( ( [ params ] ) => params.action === 'layersread' ) ).toBe( true );
		dispose();
	} );

	it( 'refuses a missing stored group before looking for an archived page display', async () => {
		const api = { get: jest.fn( () => Promise.resolve( { layersread: { bindings: {} } } ) ) };
		const { dispose } = await mounted( { api } );
		expect( api.get ).toHaveBeenCalledTimes( 1 );
		expect( root.textContent ).toContain( 'layers-page-history-render-failed' );
		dispose();
	} );

	it( 'refuses a missing display result without opening a fallback source', async () => {
		const api = apiFor();
		api.get.mockImplementation( params => params.controls ?
			Promise.resolve( { layersread: { bindings: { [ binding ]: bundle } } } ) :
			Promise.resolve( { layersread: { viewer: { ...viewer, display: undefined } } } ) );
		const { dispose } = await mounted( { api } );
		expect( root.textContent ).toContain( 'layers-page-history-render-failed' );
		expect( api.get.mock.calls.map( ( [ params ] ) => params.action ) ).toEqual( [ 'layersread', 'layersread' ] );
		dispose();
	} );

	it( 'does not apply a late response or create controls after disposal', async () => {
		let resolve;
		api = { get: jest.fn( () => new Promise( complete => { resolve = complete; } ) ) };
		const { image, dispose } = await mounted( { api } );
		dispose();
		resolve( { layersread: { bindings: { [ binding ]: bundle } } } );
		await new Promise( resolveTurn => setTimeout( resolveTurn, 0 ) );
		expect( root.querySelector( '.layers-viewer-overlay' ) ).toBeNull();
		expect( image.getAttribute( 'src' ) ).toBe( '/thumb/current-page1.jpg' );
	} );

	it.each( [ 'bundle read', 'viewer read' ] )( 'does not preload a stale occurrence after a delayed %s', async phase => {
		for ( const [ change, mutate ] of [
			[ 'detachment', image => image.remove() ],
			[ 'source', image => image.setAttribute( 'src', '/thumb/replaced.jpg' ) ],
			[ 'binding marker', image => image.setAttribute( 'data-layers-pdf-anchor', 'v1:10:other' ) ],
			[ 'target marker', image => image.setAttribute( 'data-layers-pdf-page', '2' ) ],
			[ 'srcset', image => image.setAttribute( 'srcset', '/thumb/replaced.jpg 1x' ) ],
			[ 'sizes', image => image.setAttribute( 'sizes', '50vw' ) ]
		] ) {
			const pendingImages = [];
			window.Image = class {
				constructor() { pendingImages.push( this ); }
				set src( value ) { this._src = value; if ( this.onload ) this.onload(); }
				get src() { return this._src; }
			};
			root.replaceChildren();
			const host = imageHost();
			const requests = [];
			api = { get: jest.fn( params => new Promise( resolve => requests.push( { params, resolve } ) ) ) };
			const dispose = await load( root, api, 'Owner', 42, {} );
			await new Promise( resolve => setTimeout( resolve, 0 ) );
			expect( requests ).toHaveLength( 1 );
			if ( phase === 'viewer read' ) {
				requests[ 0 ].resolve( { layersread: { bindings: { [ binding ]: bundle } } } );
				await new Promise( resolve => setTimeout( resolve, 0 ) );
				expect( requests ).toHaveLength( 2 );
			}
			mutate( host.image );
			requests[ requests.length - 1 ].resolve( phase === 'bundle read' ?
				{ layersread: { bindings: { [ binding ]: bundle } } } : { layersread: { viewer } } );
			await new Promise( resolve => setTimeout( resolve, 0 ) );
			expect( pendingImages ).toHaveLength( 0 );
			expect( root.querySelector( '.layers-bound-controls' ) ).toBeNull();
			expect( root.querySelector( '.layers-viewer-overlay' ) ).toBeNull();
			expect( root.querySelector( '.layers-page-history-render-error' ) ).toBeNull();
			expect( api.get ).toHaveBeenCalledTimes( phase === 'bundle read' ? 1 : 2 );
			dispose();
			if ( change === 'source' ) expect( host.image.getAttribute( 'src' ) ).toBe( '/thumb/replaced.jpg' );
			if ( change === 'binding marker' ) expect( host.image.getAttribute( 'data-layers-pdf-anchor' ) ).toBe( 'v1:10:other' );
			if ( change === 'target marker' ) expect( host.image.getAttribute( 'data-layers-pdf-page' ) ).toBe( '2' );
		}
	} );

	it( 'does not replace the native image after a pending rendition load is disposed', async () => {
		const pending = [];
		window.Image = class {
			set src( value ) { this._src = value; pending.push( this ); }
			get src() { return this._src; }
		};
		const { image, dispose } = await mounted();
		expect( pending ).toHaveLength( 1 );
		dispose();
		expect( pending[ 0 ].onload ).toBeNull();
		expect( pending[ 0 ].src ).toBe( '' );
		if ( pending[ 0 ].onload ) pending[ 0 ].onload();
		expect( image.getAttribute( 'src' ) ).toBe( '/thumb/current-page1.jpg' );
		expect( root.querySelector( '.layers-bound-controls' ) ).toBeNull();
	} );

	it.each( [
		[ 'detachment', image => image.remove() ],
		[ 'source change', image => image.setAttribute( 'src', '/thumb/replaced.jpg' ) ],
		[ 'srcset change', image => image.setAttribute( 'srcset', '/thumb/replaced-srcset.jpg 1x' ) ],
		[ 'sizes change', image => image.setAttribute( 'sizes', '50vw' ) ],
		[ 'marker change', image => image.setAttribute( 'data-layers-pdf-page', '2' ) ]
	] )( 'cancels a stalled preload after %s without resurrecting controls', async ( label, mutate ) => {
		const pending = [];
		window.Image = class {
			set src( value ) { this._src = value; pending.push( this ); }
			get src() { return this._src; }
		};
		const { image } = await mounted();
		expect( pending ).toHaveLength( 1 );
		mutate( image );
		await new Promise( resolve => setTimeout( resolve, 0 ) );
		expect( pending[ 0 ].onload ).toBeNull();
		expect( pending[ 0 ].onerror ).toBeNull();
		expect( pending[ 0 ].src ).toBe( '' );
		if ( pending[ 0 ].onload ) pending[ 0 ].onload();
		expect( root.querySelector( '.layers-bound-controls' ) ).toBeNull();
		expect( root.querySelector( '.layers-viewer-overlay' ) ).toBeNull();
		expect( root.querySelector( '.layers-page-history-render-error' ) ).toBeNull();
		if ( label === 'source change' ) {
			expect( image.getAttribute( 'src' ) ).toBe( '/thumb/replaced.jpg' );
		}
	} );

	it( 'restores responsive source attributes on teardown but preserves external replacement', async () => {
		const { image, dispose } = await mounted();
		image.setAttribute( 'src', '/thumb/external.jpg' );
		image.setAttribute( 'srcset', '/thumb/external.jpg 1x' );
		image.setAttribute( 'sizes', '50vw' );
		dispose();
		expect( image.getAttribute( 'src' ) ).toBe( '/thumb/external.jpg' );
		expect( image.getAttribute( 'srcset' ) ).toBe( '/thumb/external.jpg 1x' );
		expect( image.getAttribute( 'sizes' ) ).toBe( '50vw' );
		expect( root.querySelector( '.layers-bound-controls' ) ).toBeNull();
	} );

	it( 'does not restore old responsive candidates after an external src-only replacement', async () => {
		const { image, dispose } = await mounted();
		image.setAttribute( 'src', '/thumb/external.jpg' );
		dispose();
		expect( image.getAttribute( 'src' ) ).toBe( '/thumb/external.jpg' );
		expect( image.hasAttribute( 'srcset' ) ).toBe( false );
		expect( image.hasAttribute( 'sizes' ) ).toBe( false );
		expect( root.querySelector( '.layers-bound-controls' ) ).toBeNull();
	} );

	it( 'closes only its own lightbox session during teardown', async () => {
		const { dispose } = await mounted();
		root.querySelector( '.layers-viewer-overlay-btn--view' ).click();
		lightbox.pageOwned = { other: true };
		lightbox._sessionToken++;
		dispose();
		expect( lightbox.close ).not.toHaveBeenCalled();
	} );
} );
