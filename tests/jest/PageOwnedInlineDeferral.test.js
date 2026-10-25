'use strict';
require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
require( '../../resources/ext.layers.shared/DrawingFields.js' );
require( '../../resources/ext.layers/viewer/PageOwnedRevisionView.js' );
require( '../../resources/ext.layers/viewer/ViewerOverlay.js' );
require( '../../resources/ext.layers/viewer/PageOwnedViewerAdapter.js' );
const mount = require( '../../resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js' );
const fixture = require( '../fixtures/revisions/slide-document-v1.json' );

describe( 'Native inline slide viewport deferral', () => {
	let root, observers, render, cleanups, oldObserver, oldConfig, dispose;
	beforeEach( () => {
		root = document.createElement( 'div' ); document.body.append( root );
		observers = []; cleanups = []; dispose = null;
		oldObserver = window.IntersectionObserver;
		window.IntersectionObserver = jest.fn( function ( callback ) {
			this.callback = callback; this.observe = jest.fn( element => { this.element = element; } );
			this.disconnect = jest.fn(); observers.push( this );
		} );
		render = jest.fn( () => { const cleanup = jest.fn(); cleanups.push( cleanup ); return cleanup; } );
		window.Layers.Viewer.renderPageOwnedRevision = render;
		window.Layers.lightbox = { open: jest.fn(), close: jest.fn() };
		oldConfig = mw.config.get;
		mw.config.get = key => ( { wgAction: 'view', wgRevisionId: 42, wgCurRevisionId: 42 } )[ key ];
		mw.msg = key => key;
	} );
	afterEach( () => { if ( dispose ) { dispose(); } root.remove(); window.IntersectionObserver = oldObserver; mw.config.get = oldConfig; } );
	function create( count = 1, alter = () => {} ) {
		const bundles = {};
		for ( let n = 0; n < count; n++ ) {
			const surface = JSON.parse( JSON.stringify( fixture.surfaces[ 0 ] ) );
			surface.id = 'slide_' + n; alter( surface );
			const binding = 'v1:10:' + surface.id;
			const host = document.createElement( 'div' ); host.className = 'layers-bound-slide';
			host.dataset.layersBinding = binding; host.dataset.layersRevision = '42'; root.append( host );
			bundles[ binding ] = { owner: 'Owner', pageId: 10, revisionId: 42, surface, editUrl: '/edit-exact' };
		}
		dispose = mount.mountInline( root, bundles, {}, { get: jest.fn() } ); return bundles;
	}
	function enter( observer = observers[ 0 ] ) {
		observer.callback( [ { target: observer.element, isIntersecting: true } ] );
	}
	it( 'leaves twenty offscreen slide canvases unpainted while keeping all forty buttons and canvas dimensions', () => {
		create( 20 ); expect( render ).not.toHaveBeenCalled(); expect( observers ).toHaveLength( 20 );
		expect( root.querySelectorAll( 'canvas' ) ).toHaveLength( 20 );
		expect( root.querySelectorAll( '.layers-viewer-overlay-btn' ) ).toHaveLength( 40 );
		for ( const canvas of root.querySelectorAll( 'canvas' ) ) { expect( canvas.width ).toBe( fixture.surfaces[ 0 ].canvas.width ); }
	} );
	it( 'renders only the intersecting exact snapshot once', () => {
		const bundles = create( 20 ); enter( observers[ 4 ] ); enter( observers[ 4 ] );
		expect( render ).toHaveBeenCalledTimes( 1 );
		expect( render.mock.calls[ 0 ][ 1 ] ).toEqual( bundles[ 'v1:10:slide_4' ].surface );
		expect( observers[ 4 ].disconnect ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'ignores nonintersecting entries and callbacks for another canvas', () => {
		create(); observers[ 0 ].callback( [ { target: observers[ 0 ].element, isIntersecting: false } ] );
		observers[ 0 ].callback( [ { target: document.createElement( 'canvas' ), isIntersecting: true } ] );
		expect( render ).not.toHaveBeenCalled();
	} );
	it( 'prepares all pending vector slides synchronously before page printing', () => {
		create( 20 ); window.dispatchEvent( new Event( 'beforeprint' ) );
		expect( render ).toHaveBeenCalledTimes( 20 ); window.dispatchEvent( new Event( 'beforeprint' ) );
		expect( render ).toHaveBeenCalledTimes( 20 );
	} );
	it( 'renders on keyboard focus without waiting for the observer and retains full-size viewing', () => {
		const bundles = create(); const button = root.querySelector( '.layers-viewer-overlay-btn--view' );
		root.firstChild.focus(); expect( document.activeElement ).toBe( root.firstChild );
		expect( render ).toHaveBeenCalledTimes( 1 );
		button.click(); expect( window.Layers.lightbox.open.mock.calls[ 0 ][ 0 ].pageOwned.bundle ).toBe( bundles[ 'v1:10:slide_0' ] );
	} );
	it( 'cancels pending work, printing and focus callbacks on disposal', () => {
		create(); const observer = observers[ 0 ], host = root.firstChild; dispose();
		enter( observer ); window.dispatchEvent( new Event( 'beforeprint' ) ); host.dispatchEvent( new Event( 'focusin' ) );
		expect( render ).not.toHaveBeenCalled(); expect( observer.disconnect ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'cleans up an activated renderer exactly once', () => {
		create(); enter(); dispose(); dispose(); expect( cleanups[ 0 ] ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'keeps rendering eager when observers are unavailable', () => {
		window.IntersectionObserver = undefined; create(); expect( render ).toHaveBeenCalledTimes( 1 );
	} );
	it.each( [ 'construct', 'observe' ] )( 'falls back to immediate rendering if observer %s fails', phase => {
		if ( phase === 'construct' ) { window.IntersectionObserver = () => { throw new Error( 'observer failure' ); }; }
		else { window.IntersectionObserver = function () { this.disconnect = jest.fn(); this.observe = () => { throw new Error( 'observe failure' ); }; }; }
		create(); expect( render ).toHaveBeenCalledTimes( 1 );
	} );
	it.each( [ 'throw', 'invalid cleanup' ] )( 'shows the fixed failure state when a deferred renderer returns %s', mode => {
		render.mockImplementation( () => { if ( mode === 'throw' ) { throw new Error( 'private diagnostics' ); } return null; } );
		create(); enter(); expect( root.querySelector( 'canvas' ) ).toBeNull();
		expect( root.textContent ).toContain( 'layers-page-history-render-failed' ); expect( root.textContent ).not.toContain( 'private diagnostics' );
	} );
	it( 'preserves eager preparation for image layers inside slides', () => {
		create( 1, surface => { surface.layers.push( { id: 'img', type: 'image', x: 0, y: 0, width: 10, height: 10, src: 'data:image/png;base64,AA==' } ); surface.readingOrder.push( 'img' ); } );
		expect( render ).toHaveBeenCalledTimes( 1 ); expect( observers ).toHaveLength( 0 );
	} );
	it( 'preserves eager preparation for custom SVG shapes inside slides', () => {
		create( 1, surface => { surface.layers.push( { id: 'shape', type: 'customShape', x: 0, y: 0, width: 10, height: 10, shapeId: 'shape' } ); surface.readingOrder.push( 'shape' ); } );
		expect( render ).toHaveBeenCalledTimes( 1 ); expect( observers ).toHaveLength( 0 );
	} );
	it( 'keeps standalone historical rendering eager', () => {
		const bundle = { owner: 'Owner', pageId: 10, revisionId: 42, surface: fixture.surfaces[ 0 ] };
		dispose = mount( root, bundle ); expect( render ).toHaveBeenCalledTimes( 1 ); expect( observers ).toHaveLength( 0 );
	} );
} );
