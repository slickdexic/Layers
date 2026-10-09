'use strict';

describe( 'Missing page-owned layer-set overlays', () => {
	let bootstrap;
	let Overlay;
	let api;
	let identity;
	let values;

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';
		window.history.replaceState( {}, '', '/' );
		identity = JSON.stringify( [ 4, 12, 'image', 'File:A.png', 'abc' ] );
		Overlay = jest.fn().mockImplementation( () => ( { init: jest.fn(), destroy: jest.fn() } ) );
		window.Layers = { Viewer: { Overlay }, lightbox: { open: jest.fn(), close: jest.fn() } };
		values = { wgAction: 'view', wgArticleId: 4, wgRevisionId: 12, wgCurRevisionId: 12,
			wgLayersCreationOverlays: { [ identity ]: { identity, label: 'ABC', kind: 'image',
				editUrl: '/wiki/Special:EditLayersPage?pageid=4&revid=12&drawing=ABC',
				preview: { kind: 'image', layers: [], imageUrl: '/test-files/A.png',
					baseWidth: 80, baseHeight: 40 } } } };
		global.mw = { config: { get: jest.fn( ( key ) => values[ key ] ) }, msg: jest.fn( ( key ) => key ) };
		api = { get: jest.fn(), post: jest.fn() };
		bootstrap = require( '../../resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js' );
	} );

	function host( key = identity, noEdit = false ) {
		const parts = JSON.parse( key );
		const element = document.createElement( parts[ 2 ] === 'image' ? 'img' : 'div' );
		element.className = parts[ 2 ] === 'image' ? 'layers-creation-image' : 'layers-creation-slide';
		element.setAttribute( 'data-layers-creation', key );
		if ( noEdit ) {
			element.setAttribute( 'data-layers-noedit', '1' );
		}
		document.body.appendChild( element );
		return element;
	}

	test( 'mounts an admitted missing image overlay without any legacy lookup', async () => {
		const image = document.createElement( 'img' );
		image.className = 'layers-creation-image';
		image.setAttribute( 'data-layers-creation', identity );
		image.setAttribute( 'width', '80' );
		image.setAttribute( 'height', '40' );
		image.setAttribute( 'alt', 'Original image caption' );
		document.body.appendChild( image );
		const dispose = await bootstrap.loadInline( document, api, 'Owner', 12 );
		expect( Overlay ).toHaveBeenCalledTimes( 1 );
		expect( Overlay.mock.calls[ 0 ][ 0 ].canEdit ).toBe( true );
		expect( api.get ).not.toHaveBeenCalled();
		expect( api.post ).not.toHaveBeenCalled();
		expect( image.getAttribute( 'alt' ) ).toBe( 'Original image caption' );
		dispose();
	} );

	test( 'separates two files and a slide with one name, while duplicates share their route', async () => {
		const second = JSON.stringify( [ 4, 12, 'image', 'File:B.png', 'abc' ] );
		const slide = JSON.stringify( [ 4, 12, 'slide', null, 'abc' ] );
		for ( const key of [ second, slide ] ) {
			values.wgLayersCreationOverlays[ key ] = { ...values.wgLayersCreationOverlays[ identity ], identity: key,
				kind: JSON.parse( key )[ 2 ], editUrl: '/different/' + encodeURIComponent( key ),
				preview: { kind: JSON.parse( key )[ 2 ], layers: [], baseWidth: 80, baseHeight: 40 } };
		}
		[ identity, second, slide, identity ].forEach( ( key ) => host( key ) );
		const dispose = await bootstrap.loadInline( document, api, 'Owner', 12 );
		expect( Overlay ).toHaveBeenCalledTimes( 4 );
		const opener = document.createElement( 'button' );
		Overlay.mock.calls.forEach( ( [ entry ] ) => entry.onView( opener ) );
		expect( window.Layers.lightbox.open.mock.calls.map( ( [ entry ] ) => entry.kind ) )
			.toEqual( [ 'image', 'image', 'slide', 'image' ] );
		expect( window.Layers.lightbox.open.mock.calls[ 0 ][ 0 ] ).toEqual(
			expect.objectContaining( { filename: 'ABC', layers: [], explicitEmpty: true, opener } ) );
		expect( api.get ).not.toHaveBeenCalled();
		dispose();
	} );

	test.each( [ 'reader', 'noedit' ] )( 'retains View without Edit for %s', async ( reason ) => {
		if ( reason === 'reader' ) {
			delete values.wgLayersCreationOverlays[ identity ].editUrl;
		}
		host( identity, reason === 'noedit' );
		const dispose = await bootstrap.loadInline( document, api, 'Owner', 12 );
		const entry = Overlay.mock.calls[ 0 ][ 0 ];
		expect( entry.canEdit ).toBe( false );
		entry.onView( document.createElement( 'button' ) );
		expect( window.Layers.lightbox.open ).toHaveBeenCalledTimes( 1 );
		expect( api.post ).not.toHaveBeenCalled();
		dispose();
	} );

	test.each( [ 'owner', 'revision', 'oldid', 'diff', 'action', 'missing-config', 'payload' ] )(
		'refuses mounting for %s', async ( reason ) => {
			host();
			if ( reason === 'owner' ) { values.wgArticleId = 9; }
			if ( reason === 'revision' ) { values.wgCurRevisionId = 13; }
			if ( reason === 'oldid' ) { window.history.replaceState( {}, '', '?oldid=12' ); }
			if ( reason === 'diff' ) { window.history.replaceState( {}, '', '?diff=12' ); }
			if ( reason === 'action' ) { values.wgAction = 'edit'; }
			if ( reason === 'missing-config' ) { values.wgLayersCreationOverlays = null; }
			if ( reason === 'payload' ) { values.wgLayersCreationOverlays[ identity ].preview.layers = [ {} ]; }
			const dispose = await bootstrap.loadInline( document, api, 'Owner', 12 );
			expect( Overlay ).not.toHaveBeenCalled();
			expect( api.get ).not.toHaveBeenCalled();
			dispose();
		} );

	test( 'mounts delayed configuration once and old disposers cannot remove remounted controls', async () => {
		const image = host();
		const entries = values.wgLayersCreationOverlays;
		values.wgLayersCreationOverlays = null;
		const early = await bootstrap.loadInline( document, api, 'Owner', 12 );
		values.wgLayersCreationOverlays = entries;
		const first = await bootstrap.loadInline( document, api, 'Owner', 12 );
		const duplicate = await bootstrap.loadInline( document, api, 'Owner', 12 );
		expect( Overlay ).toHaveBeenCalledTimes( 1 );
		early(); duplicate();
		expect( document.body.contains( image ) ).toBe( true );
		first();
		expect( image.parentElement ).toBe( document.body );
		const second = await bootstrap.loadInline( document, api, 'Owner', 12 );
		first();
		expect( Overlay ).toHaveBeenCalledTimes( 2 );
		expect( image.parentElement ).not.toBe( document.body );
		second();
	} );

	test( 'reuses real overlay focus and tap without stealing native image/link navigation', async () => {
		require( '../../resources/ext.layers/viewer/ViewerOverlay.js' );
		const image = host();
		const link = document.createElement( 'a' );
		link.href = '#native-photo';
		image.replaceWith( link );
		link.appendChild( image );
		const navigation = jest.fn();
		link.addEventListener( 'click', navigation );
		const original = document.createElement( 'button' );
		document.body.appendChild( original );
		original.focus();
		const dispose = await bootstrap.loadInline( document, api, 'Owner', 12 );
		expect( document.activeElement ).toBe( original );
		const wrapper = image.parentElement;
		wrapper.dispatchEvent( new MouseEvent( 'mouseenter' ) );
		const tap = new Event( 'touchstart', { bubbles: true, cancelable: true } );
		wrapper.dispatchEvent( tap );
		expect( tap.defaultPrevented ).toBe( false );
		const view = Array.from( wrapper.querySelectorAll( 'button' ) )
			.find( ( button ) => button.getAttribute( 'aria-label' ).toLowerCase().includes( 'view' ) );
		expect( view ).toBeDefined();
		view.focus();
		expect( document.activeElement ).toBe( view );
		view.click();
		expect( window.Layers.lightbox.open ).toHaveBeenCalledWith( expect.objectContaining( { opener: view } ) );
		expect( navigation ).not.toHaveBeenCalled();
		image.click();
		expect( navigation ).toHaveBeenCalledTimes( 1 );
		expect( api.get ).not.toHaveBeenCalled();
		dispose();
		expect( image.parentElement ).toBe( link );
		expect( link.querySelectorAll( 'button' ) ).toHaveLength( 0 );
	} );

	test( 'disposing closes only this occurrence\'s still-current empty viewer session', async () => {
		host();
		const lightbox = window.Layers.lightbox;
		lightbox.open.mockImplementation( () => { lightbox._sessionToken = 7; lightbox.explicitEmpty = true; } );
		const dispose = await bootstrap.loadInline( document, api, 'Owner', 12 );
		Overlay.mock.calls[ 0 ][ 0 ].onView( document.createElement( 'button' ) );
		dispose();
		expect( lightbox.close ).toHaveBeenCalledWith( true );
	} );
} );

describe( 'Explicit-empty full-size viewer', () => {
	let box;
	let api;
	let render;

	beforeEach( () => {
		jest.resetModules();
		document.body.innerHTML = '';
		window.Layers = { Viewer: {} };
		api = { get: jest.fn(), postWithToken: jest.fn() };
		global.mw = { Api: jest.fn( () => api ), config: { get: jest.fn() },
			message: jest.fn( ( key ) => ( { exists: () => true, text: () => key } ) ) };
		require( '../../resources/ext.layers/viewer/LayersLightbox.js' );
		box = new window.Layers.Viewer.Lightbox();
		render = jest.spyOn( box, 'renderViewer' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		box.close( true );
		jest.restoreAllMocks();
	} );

	function openImage( opener ) {
		box.open( { filename: 'ABC', explicitEmpty: true, kind: 'image', imageUrl: '/test-files/A.png',
			baseWidth: 80, baseHeight: 40, layers: [], opener } );
	}

	test( 'renders only the admitted image and explicitly empty layers without an API lookup', () => {
		const fetch = jest.spyOn( box, 'fetchAndRender' );
		openImage();
		expect( render ).toHaveBeenCalledWith( '/test-files/A.png', { layers: [], baseWidth: 80, baseHeight: 40,
			backgroundVisible: true, backgroundOpacity: 1 } );
		expect( fetch ).not.toHaveBeenCalled();
		expect( api.get ).not.toHaveBeenCalled();
	} );

	test( 'uses the admitted blank slide dimensions and background without legacy slide data', () => {
		const context = { fillStyle: '', fillRect: jest.fn() };
		jest.spyOn( HTMLCanvasElement.prototype, 'getContext' ).mockReturnValue( context );
		jest.spyOn( HTMLCanvasElement.prototype, 'toDataURL' ).mockReturnValue( 'data:image/png;base64,blank' );
		box.open( { filename: 'ABC', explicitEmpty: true, kind: 'slide', layers: [], baseWidth: 800,
			baseHeight: 600, backgroundColor: '#ff0000' } );
		expect( context.fillStyle ).toBe( '#ff0000' );
		expect( context.fillRect ).toHaveBeenCalledWith( 0, 0, 800, 600 );
		expect( render.mock.calls[ 0 ][ 0 ] ).toBe( 'data:image/png;base64,blank' );
		expect( box.isSlide ).toBe( true );
		expect( api.get ).not.toHaveBeenCalled();
	} );

	test( 'prepares Print and Download locally from the identical admitted source', async () => {
		openImage();
		const image = { src: 'data:image/jpeg;base64,empty', width: 80, height: 40 };
		const flatten = jest.spyOn( box, 'flattenPage' ).mockResolvedValue( image );
		const print = jest.spyOn( box, 'printImages' ).mockImplementation( () => {} );
		const build = jest.spyOn( box, 'buildPdfBlob' ).mockReturnValue( new Blob( [ 'PDF' ] ) );
		jest.spyOn( box, 'saveBlob' ).mockImplementation( () => {} );
		const server = jest.spyOn( box, 'requestServerPdf' );
		await box.printDocument();
		await box.downloadPdf();
		expect( flatten.mock.calls.every( ( [ url, data ] ) => url === '/test-files/A.png' && data.layers.length === 0 ) )
			.toBe( true );
		expect( print ).toHaveBeenCalledWith( [ image.src ] );
		expect( build ).toHaveBeenCalledWith( [ image ] );
		expect( server ).not.toHaveBeenCalled();
		expect( api.get ).not.toHaveBeenCalled();
	} );

	test( 'never falls back to a legacy lookup or export when an empty preview cannot compose', async () => {
		openImage();
		jest.spyOn( box, 'flattenPage' ).mockResolvedValue( null );
		jest.spyOn( box, 'showError' ).mockImplementation( () => {} );
		const server = jest.spyOn( box, 'requestServerPdf' );
		await box.printDocument();
		await box.downloadPdf();
		expect( await box.composePage( 2 ) ).toBeNull();
		expect( server ).not.toHaveBeenCalled();
		expect( api.get ).not.toHaveBeenCalled();
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	test( 'cannot send a failed pending empty export to a later saved-set session', async () => {
		openImage();
		let reject;
		const flatten = jest.spyOn( box, 'flattenPage' )
			.mockReturnValue( new Promise( ( resolve, fail ) => { reject = fail; } ) );
		const server = jest.spyOn( box, 'requestServerPdf' ).mockResolvedValue();
		const pending = box.printDocument();
		await Promise.resolve();
		expect( flatten ).toHaveBeenCalledTimes( 1 );
		box.open( { filename: 'Saved.png', imageUrl: '/test-files/Saved.png', layerData: { layers: [] } } );
		reject( new Error( 'controlled composition failure' ) );
		await pending;
		expect( server ).not.toHaveBeenCalled();
	} );

	test( 'keeps keyboard Fit and restores the opener on Close', () => {
		const opener = document.createElement( 'button' );
		document.body.appendChild( opener );
		opener.focus();
		openImage( opener );
		const fit = jest.spyOn( box, 'fitToScreen' ).mockImplementation( () => {} );
		box.handleKeyDown( new KeyboardEvent( 'keydown', { key: 'f', cancelable: true } ) );
		expect( fit ).toHaveBeenCalledTimes( 1 );
		box.close( true );
		expect( document.activeElement ).toBe( opener );
	} );
} );

describe( 'J115B2 overlay navigation and cancellation companions', () => {
	afterEach( () => {
		jest.restoreAllMocks();
	} );

	function creation() {
		jest.resetModules();
		document.body.innerHTML = '';
		window.history.replaceState( {}, '', '/' );
		const identity = JSON.stringify( [ 4, 12, 'image', 'File:A.png', 'abc' ] );
		const Overlay = jest.fn().mockImplementation( () => ( { init: jest.fn(), destroy: jest.fn() } ) );
		const lightbox = { open: jest.fn(), close: jest.fn(), explicitEmpty: true, _sessionToken: 42 };
		window.Layers = { Viewer: { Overlay }, lightbox };
		const entry = { identity, kind: 'image', label: 'ABC', editUrl: '#exact-owner-route',
			preview: { kind: 'image', layers: [], imageUrl: '/test-files/A.png', baseWidth: 80, baseHeight: 40 } };
		const values = { wgAction: 'view', wgArticleId: 4, wgRevisionId: 12, wgCurRevisionId: 12,
			wgLayersCreationOverlays: { [ identity ]: entry } };
		global.mw = { config: { get: ( key ) => values[ key ] }, msg: ( key ) => key };
		const image = document.createElement( 'img' );
		image.className = 'layers-creation-image';
		image.setAttribute( 'data-layers-creation', identity );
		document.body.appendChild( image );
		const api = { get: jest.fn(), post: jest.fn() };
		return { entry, Overlay, lightbox, image, api,
			bootstrap: require( '../../resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js' ) };
	}

	test( 'Edit follows only the exact admitted route and disposed View callbacks are inert', async () => {
		const fixture = creation();
		const dispose = await fixture.bootstrap.loadInline( document, fixture.api, 'Owner', 12 );
		const control = fixture.Overlay.mock.calls[ 0 ][ 0 ];
		control.onEdit();
		expect( window.location.hash ).toBe( fixture.entry.editUrl );
		dispose();
		control.onView( document.createElement( 'button' ) );
		expect( fixture.lightbox.open ).not.toHaveBeenCalled();
		expect( fixture.api.get ).not.toHaveBeenCalled();
		expect( fixture.api.post ).not.toHaveBeenCalled();
	} );

	test.each( [ 'identity', 'kind', 'preview-kind' ] )( 'mismatched %s cannot borrow a route', async ( field ) => {
		const fixture = creation();
		if ( field === 'identity' ) { fixture.entry.identity = JSON.stringify( [ 4, 12, 'image', 'File:B.png', 'abc' ] ); }
		if ( field === 'kind' ) { fixture.entry.kind = 'slide'; }
		if ( field === 'preview-kind' ) { fixture.entry.preview.kind = 'slide'; }
		const dispose = await fixture.bootstrap.loadInline( document, fixture.api, 'Owner', 12 );
		expect( fixture.Overlay ).not.toHaveBeenCalled();
		expect( fixture.api.get ).not.toHaveBeenCalled();
		dispose();
	} );

	test( 'disposing an old occurrence does not close a newer empty viewer session', async () => {
		const fixture = creation();
		const dispose = await fixture.bootstrap.loadInline( document, fixture.api, 'Owner', 12 );
		fixture.Overlay.mock.calls[ 0 ][ 0 ].onView( document.createElement( 'button' ) );
		fixture.lightbox._sessionToken = 43;
		dispose();
		expect( fixture.lightbox.close ).not.toHaveBeenCalled();
	} );

	test( 'empty image retains wheel zoom, pan and Escape without any legacy request', () => {
		jest.resetModules();
		document.body.innerHTML = '';
		window.Layers = { Viewer: {} };
		const api = { get: jest.fn(), postWithToken: jest.fn() };
		global.mw = { Api: jest.fn( () => api ), config: { get: jest.fn() },
			message: ( key ) => ( { exists: () => true, text: () => key } ) };
		require( '../../resources/ext.layers/viewer/LayersLightbox.js' );
		const box = new window.Layers.Viewer.Lightbox();
		jest.spyOn( box, 'renderViewer' ).mockImplementation( () => {} );
		const opener = document.createElement( 'button' );
		document.body.appendChild( opener );
		box.open( { filename: 'ABC', explicitEmpty: true, kind: 'image', imageUrl: '/test-files/A.png',
			baseWidth: 80, baseHeight: 40, layers: [], opener } );
		box.handleWheel( new WheelEvent( 'wheel', { deltaY: -1, cancelable: true } ) );
		expect( box.zoom ).toBeGreaterThan( 1 );
		box.startPan( new MouseEvent( 'mousedown', { clientX: 10, clientY: 20, cancelable: true } ) );
		box.movePan( new MouseEvent( 'mousemove', { clientX: 35, clientY: 50 } ) );
		box.endPan();
		expect( [ box.panX, box.panY ] ).toEqual( [ 25, 30 ] );
		box.handleKeyDown( new KeyboardEvent( 'keydown', { key: 'Escape', cancelable: true } ) );
		expect( document.activeElement ).toBe( opener );
		expect( api.get ).not.toHaveBeenCalled();
		expect( api.postWithToken ).not.toHaveBeenCalled();
		box.close( true );
	} );

	test( 'closing cancels a pending empty Download instead of publishing or exporting another session', async () => {
		jest.resetModules();
		document.body.innerHTML = '';
		window.Layers = { Viewer: {} };
		const api = { get: jest.fn(), postWithToken: jest.fn() };
		global.mw = { Api: jest.fn( () => api ), config: { get: jest.fn() },
			message: ( key ) => ( { exists: () => true, text: () => key } ) };
		require( '../../resources/ext.layers/viewer/LayersLightbox.js' );
		const box = new window.Layers.Viewer.Lightbox();
		jest.spyOn( box, 'renderViewer' ).mockImplementation( () => {} );
		box.open( { filename: 'ABC', explicitEmpty: true, kind: 'image', imageUrl: '/test-files/A.png',
			baseWidth: 80, baseHeight: 40, layers: [] } );
		let finish;
		jest.spyOn( box, 'flattenPage' ).mockReturnValue( new Promise( ( resolve ) => { finish = resolve; } ) );
		const save = jest.spyOn( box, 'saveBlob' ).mockImplementation( () => {} );
		const server = jest.spyOn( box, 'requestServerPdf' );
		const pending = box.downloadPdf();
		await Promise.resolve();
		box.close( true );
		finish( { src: 'data:image/jpeg;base64,empty', width: 80, height: 40 } );
		await pending;
		expect( save ).not.toHaveBeenCalled();
		expect( server ).not.toHaveBeenCalled();
		expect( api.get ).not.toHaveBeenCalled();
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	test( 'blank slide Print and Download compose the same local background without shared data', async () => {
		jest.resetModules();
		document.body.innerHTML = '';
		window.Layers = { Viewer: {} };
		const api = { get: jest.fn(), postWithToken: jest.fn() };
		global.mw = { Api: jest.fn( () => api ), config: { get: jest.fn() },
			message: ( key ) => ( { exists: () => true, text: () => key } ) };
		const context = { fillStyle: '', fillRect: jest.fn() };
		jest.spyOn( HTMLCanvasElement.prototype, 'getContext' ).mockReturnValue( context );
		jest.spyOn( HTMLCanvasElement.prototype, 'toDataURL' ).mockReturnValue( 'data:image/png;base64,blank' );
		require( '../../resources/ext.layers/viewer/LayersLightbox.js' );
		const box = new window.Layers.Viewer.Lightbox();
		jest.spyOn( box, 'renderViewer' ).mockImplementation( () => {} );
		box.open( { filename: 'ABC', explicitEmpty: true, kind: 'slide', layers: [],
			baseWidth: 200, baseHeight: 100, backgroundColor: '#ff0000' } );
		const image = { src: 'data:image/jpeg;base64,empty', width: 200, height: 100 };
		const flatten = jest.spyOn( box, 'flattenPage' ).mockResolvedValue( image );
		jest.spyOn( box, 'printImages' ).mockImplementation( () => {} );
		jest.spyOn( box, 'buildPdfBlob' ).mockReturnValue( new Blob( [ 'PDF' ] ) );
		jest.spyOn( box, 'saveBlob' ).mockImplementation( () => {} );
		const server = jest.spyOn( box, 'requestServerPdf' );
		await box.printDocument();
		await box.downloadPdf();
		expect( context.fillStyle ).toBe( '#ff0000' );
		expect( context.fillRect ).toHaveBeenCalledWith( 0, 0, 200, 100 );
		expect( flatten.mock.calls ).toHaveLength( 2 );
		expect( flatten.mock.calls[ 0 ] ).toEqual( flatten.mock.calls[ 1 ] );
		expect( flatten.mock.calls[ 0 ][ 0 ] ).toBe( 'data:image/png;base64,blank' );
		expect( flatten.mock.calls[ 0 ][ 1 ].layers ).toEqual( [] );
		expect( server ).not.toHaveBeenCalled();
		expect( api.get ).not.toHaveBeenCalled();
		expect( api.postWithToken ).not.toHaveBeenCalled();
		box.close( true );
	} );
} );