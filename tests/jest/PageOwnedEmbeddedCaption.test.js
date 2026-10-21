'use strict';

require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
require( '../../resources/ext.layers.shared/DrawingFields.js' );
require( '../../resources/ext.layers/viewer/PageOwnedRevisionView.js' );
require( '../../resources/ext.layers/viewer/ViewerOverlay.js' );
require( '../../resources/ext.layers/viewer/PageOwnedViewerAdapter.js' );
const mount = require( '../../resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js' );
const fixture = require( '../fixtures/revisions/slide-document-v1.json' );

describe( 'Embedded slide presentation', () => {
	let root, bundle, oldConfig, oldMessage, oldPainter, oldLightbox;
	beforeEach( () => {
		root = document.createElement( 'div' );
		document.body.append( root );
		bundle = { owner: 'Owner_Page', pageId: 10, revisionId: 42,
			surface: fixture.surfaces[ 0 ], editUrl: '/edit-exact' };
		oldConfig = mw.config.get;
		oldMessage = mw.msg;
		oldPainter = window.Layers.Viewer.renderPageOwnedRevision;
		oldLightbox = window.Layers.lightbox;
		mw.config.get = jest.fn( ( key ) => ( {
			wgAction: 'view', wgRevisionId: 42, wgCurRevisionId: 42
		} )[ key ] );
		mw.msg = jest.fn( ( key, owner, revision, label ) =>
			key === 'layers-page-history-caption' ? `Page ${ owner }, revision ${ revision } — ${ label }` : key );
		window.Layers.Viewer.renderPageOwnedRevision = jest.fn( () => jest.fn() );
		window.Layers.lightbox = { open: jest.fn(), close: jest.fn() };
	} );
	afterEach( () => {
		mw.config.get = oldConfig;
		mw.msg = oldMessage;
		window.Layers.Viewer.renderPageOwnedRevision = oldPainter;
		window.Layers.lightbox = oldLightbox;
		root.remove();
	} );

	it.each( [ false, true ] )( 'keeps revision captions out of embedded slides (historical=%s)', ( historical ) => {
		if ( historical ) {
			mw.config.get = ( key ) => ( {
				wgAction: 'view', wgRevisionId: 42, wgCurRevisionId: 43
			} )[ key ];
		}
		for ( let index = 0; index < 2; index++ ) {
			const host = document.createElement( 'div' );
			host.className = 'layers-bound-slide';
			host.dataset.layersBinding = 'v1:10:presentation';
			host.dataset.layersRevision = '42';
			root.append( host );
		}
		const dispose = mount.mountInline( root, { 'v1:10:presentation': bundle }, {}, { get: jest.fn() } );
		try {
			expect( root.querySelector( 'figcaption' ) ).toBeNull();
			expect( root.textContent ).not.toContain( 'Page Owner_Page, revision 42' );
			expect( root.querySelectorAll( 'canvas' ) ).toHaveLength( 2 );
			expect( root.querySelector( 'canvas' ).getAttribute( 'aria-label' ) ).toContain( 'Welcome Slide' );
			expect( root.querySelectorAll( '.layers-viewer-overlay-btn--view' ) ).toHaveLength( 2 );
			expect( root.querySelectorAll( '.layers-viewer-overlay-btn--edit' ) ).toHaveLength( historical ? 0 : 2 );
			root.querySelector( '.layers-viewer-overlay-btn--view' ).click();
			expect( window.Layers.lightbox.open.mock.calls[ 0 ][ 0 ].pageOwned.bundle ).toBe( bundle );
			expect( window.Layers.Viewer.renderPageOwnedRevision ).toHaveBeenCalledTimes( 2 );
		} finally {
			dispose();
		}
	} );

	it( 'retains revision context in the dedicated historical view', () => {
		const dispose = mount( root, bundle );
		try {
			expect( root.querySelector( 'figcaption' ).textContent ).toContain( 'Page Owner_Page, revision 42' );
		} finally {
			dispose();
		}
	} );
} );
