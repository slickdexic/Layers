'use strict';

const fixture = require( '../fixtures/revisions/slide-document-v1.json' );

describe( 'Page-owned inline read scheduling', () => {
	let oldReady, oldApi, oldConfig, oldMsg, oldState, oldLayers, api, config, ready, bundle;
	beforeEach( () => {
		jest.resetModules();
		oldReady = global.$; oldApi = mw.Api; oldConfig = mw.config.get;
		oldMsg = mw.msg; mw.msg = jest.fn( key => key );
		oldState = Object.getOwnPropertyDescriptor( document, 'readyState' );
		oldLayers = window.Layers;
		Object.defineProperty( document, 'readyState', { configurable: true, value: 'complete' } );
		document.body.innerHTML = '';
		require( '../../resources/ext.layers.shared/DrawingFields.js' );
		require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
		require( '../../resources/ext.layers/viewer/PageOwnedRevisionView.js' );
		require( '../../resources/ext.layers/viewer/ViewerOverlay.js' );
		require( '../../resources/ext.layers/viewer/PageOwnedViewerAdapter.js' );
		window.Layers.Viewer.renderPageOwnedRevision = jest.fn( () => jest.fn() );
		window.Layers.lightbox = { open: jest.fn(), close: jest.fn() };
		bundle = { owner: 'Owner', pageId: 10, revisionId: 42, surface: fixture.surfaces[ 0 ], editUrl: '/edit-exact' };
		api = { get: jest.fn( () => Promise.resolve( { layersread: { bindings: { 'v1:10:presentation': bundle } } } ) ) };
		config = { wgAction: 'view', wgPageName: 'Owner', wgRevisionId: 42, wgCurRevisionId: 42 };
		mw.config.get = key => config[ key ]; mw.Api = jest.fn( () => api );
		global.$ = callback => { ready = callback; };
	} );
	afterEach( () => {
		window.dispatchEvent( new Event( 'pagehide' ) );
		document.body.innerHTML = '';
		global.$ = oldReady; mw.Api = oldApi; mw.config.get = oldConfig; mw.msg = oldMsg; window.Layers = oldLayers;
		if ( oldState ) { Object.defineProperty( document, 'readyState', oldState ); }
		else { delete document.readyState; }
	} );
	function host( id = 'presentation', revision = 42 ) {
		const node = document.createElement( 'div' ); node.className = 'layers-bound-slide';
		node.dataset.layersBinding = 'v1:10:' + id; node.dataset.layersRevision = String( revision );
		node.textContent = 'Unavailable'; document.body.append( node ); return node;
	}
	function install() {
		let result;
		jest.isolateModules( () => {
			require( '../../resources/ext.layers/viewer/PageOwnedInlineRead.js' );
			result = require( '../../resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js' );
		} );
		return result;
	}
	async function settle() { for ( let i = 0; i < 12; i++ ) { await Promise.resolve(); } }

	it( 'starts one exact authorized read before ready but leaves mounting at ready', async () => {
		host(); install();
		expect( api.get ).toHaveBeenCalledTimes( 1 );
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersread', formatversion: 2, owner: 'Owner',
			revid: 42, binding: [ 'v1:10:presentation' ], controls: 1 } );
		await settle(); expect( document.querySelector( 'canvas' ) ).toBeNull();
		ready(); await settle();
		expect( api.get ).toHaveBeenCalledTimes( 1 );
		expect( document.querySelectorAll( '.layers-viewer-overlay-btn--view' ) ).toHaveLength( 1 );
	} );
	it( 'reuses a pending response once and preserves duplicate embed mounts', async () => {
		let resolve; api.get.mockReturnValue( new Promise( done => { resolve = done; } ) );
		host(); host(); install(); expect( api.get ).toHaveBeenCalledTimes( 1 );
		ready(); await settle(); expect( document.querySelector( 'canvas' ) ).toBeNull();
		resolve( { layersread: { bindings: { 'v1:10:presentation': bundle } } } ); await settle();
		expect( document.querySelectorAll( 'canvas' ) ).toHaveLength( 2 );
		expect( api.get ).toHaveBeenCalledTimes( 1 );
	} );
	it.each( [ 'owner', 'revision', 'bindings' ] )( 'reads afresh when %s changes before ready', async change => {
		const node = host(); api.get.mockResolvedValueOnce( { layersread: { bindings: { 'v1:10:presentation': bundle } } } );
		install(); expect( api.get ).toHaveBeenCalledTimes( 1 ); await settle();
		if ( change === 'owner' ) { config.wgPageName = 'Other owner'; }
		if ( change === 'revision' ) { config.wgRevisionId = 43; node.dataset.layersRevision = '43'; }
		if ( change === 'bindings' ) { node.dataset.layersBinding = 'v1:10:other'; }
		api.get.mockResolvedValue( { layersread: { bindings: {} } } );
		ready(); await settle(); expect( api.get ).toHaveBeenCalledTimes( 2 );
		expect( api.get.mock.calls[ 1 ][ 0 ] ).toMatchObject( { owner: config.wgPageName, revid: config.wgRevisionId,
			binding: [ node.dataset.layersBinding ] } );
		expect( document.querySelector( 'canvas' ) ).toBeNull();
	} );
	it( 'drops the early read after pagehide instead of reusing it later', async () => {
		host(); install(); expect( api.get ).toHaveBeenCalledTimes( 1 ); await settle();
		window.dispatchEvent( new Event( 'pagehide' ) ); api.get.mockResolvedValue( { layersread: { bindings: {} } } );
		ready(); await settle(); expect( api.get ).toHaveBeenCalledTimes( 2 );
		expect( document.querySelector( 'canvas' ) ).toBeNull();
	} );
	it.each( [ 'rejection', 'throw' ] )( 'does not retry or expose a transport %s', async failure => {
		host(); api.get.mockImplementation( () => {
			if ( failure === 'throw' ) { throw new Error( 'private refusal' ); }
			return Promise.reject( new Error( 'private refusal' ) );
		} );
		install(); expect( api.get ).toHaveBeenCalledTimes( 1 ); ready(); await settle();
		expect( api.get ).toHaveBeenCalledTimes( 1 );
		expect( document.body.textContent ).not.toContain( 'private refusal' );
		expect( document.querySelector( 'canvas' ) ).toBeNull();
	} );
	it( 'keeps existing deferred startup while the document is still parsing', async () => {
		Object.defineProperty( document, 'readyState', { configurable: true, value: 'loading' } );
		host(); install(); expect( api.get ).not.toHaveBeenCalled(); ready(); await settle();
		expect( api.get ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'registers the read module without renderer dependencies', () => {
		const modules = require( '../../extension.json' ).ResourceModules;
		expect( modules[ 'ext.layers.history' ].dependencies ).toContain( 'ext.layers.history.read' );
		expect( modules[ 'ext.layers.history.read' ].dependencies ).toEqual( [ 'jquery', 'mediawiki.api' ] );
		expect( modules[ 'ext.layers.history.read' ].scripts ).toEqual( [ 'ext.layers/viewer/PageOwnedInlineRead.js' ] );
	} );
	it.each( [ 'empty', 'history', 'comparison', 'other action' ] )( 'does not start an early read for %s', reason => {
		if ( reason !== 'empty' ) { host(); }
		if ( reason === 'history' ) { const node = document.createElement( 'div' ); node.id = 'layers-history-container'; document.body.append( node ); }
		if ( reason === 'comparison' ) { const node = document.createElement( 'div' ); node.className = 'layers-drawing-diff-view'; document.body.append( node ); }
		if ( reason === 'other action' ) { config.wgAction = 'edit'; }
		install(); expect( api.get ).not.toHaveBeenCalled();
	} );
	it( 'keeps the existing fifty-binding batches and ignores duplicate or other-revision hosts', () => {
		for ( let i = 0; i < 55; i++ ) { host( 'surface-' + i ); }
		host( 'surface-0' ); host( 'not-current', 41 ); install();
		expect( api.get ).toHaveBeenCalledTimes( 2 );
		expect( api.get.mock.calls[ 0 ][ 0 ].binding ).toHaveLength( 50 );
		expect( api.get.mock.calls[ 1 ][ 0 ].binding ).toHaveLength( 5 );
	} );
} );
