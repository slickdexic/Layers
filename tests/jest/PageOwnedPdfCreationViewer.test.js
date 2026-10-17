'use strict';
const copy = value => JSON.parse( JSON.stringify( value ) );
function fixture() {
	const surface = { id: 'd123', kind: 'pdf', label: 'ABC', canvas: { width: 208, height: 416,
		backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 }, layers: [],
		source: { repository: 'local', fileTitle: 'File:Plan.pdf', timestamp: '20261001120000',
			sha1: 'a'.repeat( 31 ), page: 2 } };
	const viewer = { owner: 'Owner', pageId: 4, revisionId: 12, binding: 'v1:4:d123', kind: 'pdf',
		label: 'ABC', initialPage: 2, pageCount: 2, pages: [ { page: 2, surface } ],
		sourceKey: 'b'.repeat( 64 ), source: { exactVersion: true, url: '/rest.php/layers/v0/pdf/creation?verified=1' } };
	const selection = { pageId: 4, revisionId: 12, start: 12,
		expected: '[[File:Plan.pdf|page=2|layerset=ABC|Caption]]' };
	return { viewer, selection };
}
function setup() {
	const { viewer, selection } = fixture();
	const api = { post: jest.fn( async () => ( { layerspdfcreationview: copy( viewer ) } ) ),
		get: jest.fn(), postWithToken: jest.fn() };
	const pdfRenderer = { renderPage: jest.fn( async ( url, page ) => ( { pageCount: 2,
		width: page === 2 ? 800 : 1600, height: page === 2 ? 1600 : 800,
		dataUrl: 'data:image/png;base64,page' + page } ) ), destroy: jest.fn() };
	const Adapter = require( '../../resources/ext.layers/viewer/PageOwnedPdfCreationViewerAdapter.js' );
	return { viewer, selection, api, pdfRenderer, adapter: new Adapter( { api, viewer, selection, pdfRenderer } ) };
}
beforeEach( () => {
	jest.resetModules();
	document.body.innerHTML = '';
	window.history.replaceState( {}, '', '/' );
	window.Layers = { Viewer: {}, DrawingFields: { fillLayers: layers => layers } };
	require( '../../resources/ext.layers/viewer/PageOwnedViewerAdapter.js' );
	global.mw = { config: { get: jest.fn() }, message: jest.fn( key => ( { exists: () => true, text: () => key } ) ),
		msg: jest.fn( ( key, ...args ) => [ key, ...args ].join( '|' ) ) };
} );
afterEach( () => jest.restoreAllMocks() );

it( 'freshly admits only the saved occurrence without a legacy lookup or write', async () => {
	const work = setup();
	expect( await work.adapter.read() ).toEqual( work.viewer );
	expect( work.api.post ).toHaveBeenCalledWith( { action: 'layerspdfcreationview', formatversion: 2,
		pageid: 4, baserevid: 12, embedstart: 12, embedtext: work.selection.expected } );
	expect( work.api.get ).not.toHaveBeenCalled();
	expect( work.api.postWithToken ).not.toHaveBeenCalled();
	work.adapter.dispose();
} );
it.each( [ 'owner', 'revisionId', 'binding', 'pageCount', 'initialPage', 'sourceKey', 'source', 'pages' ] )(
	'refuses changed %s before native rendering', async key => {
		const work = setup();
		const changed = copy( work.viewer ); changed[ key ] = null;
		work.api.post.mockResolvedValue( { layerspdfcreationview: changed } );
		await expect( work.adapter.read() ).rejects.toThrow( 'layers-revision-unavailable' );
		expect( work.pdfRenderer.renderPage ).not.toHaveBeenCalled();
		expect( work.api.get ).not.toHaveBeenCalled(); work.adapter.dispose();
	}
);
it.each( [ 'layers', 'selection', 'sourceKey', 'page' ] )( 'rejects invalid initial %s', reason => {
	const work = fixture();
	if ( reason === 'layers' ) work.viewer.pages[ 0 ].surface.layers = [ { text: 'Foreign payload' } ];
	if ( reason === 'selection' ) work.selection.pageId = 9;
	if ( reason === 'sourceKey' ) work.viewer.sourceKey = 'invalid';
	if ( reason === 'page' ) work.viewer.initialPage = 1;
	const Adapter = require( '../../resources/ext.layers/viewer/PageOwnedPdfCreationViewerAdapter.js' );
	expect( () => new Adapter( { ...work, api: {} } ) ).toThrow( 'layers-revision-unavailable' );
} );
it( 'renders every requested page from the exact source with empty layers and native geometry', async () => {
	const work = setup(), viewer = await work.adapter.read();
	const first = await work.adapter.loadPage( viewer, 1 ), second = await work.adapter.loadPage( viewer, 2 );
	expect( first.layerData ).toMatchObject( { layers: [], baseWidth: 1600, baseHeight: 800 } );
	expect( second.layerData ).toMatchObject( { layers: [], baseWidth: 208, baseHeight: 416 } );
	expect( work.pdfRenderer.renderPage.mock.calls.map( call => call[ 1 ] ) ).toEqual( [ 1, 2 ] );
	for ( const call of work.pdfRenderer.renderPage.mock.calls ) {
		expect( call[ 0 ] ).toBe( viewer.source.url );
		expect( call[ 2 ] ).toMatchObject( { exactVersion: true, expectedPageCount: 2 } );
	}
	work.adapter.dispose();
} );
it( 'refuses a late read after disposal without another request', async () => {
	const work = setup(); work.adapter.dispose();
	await expect( work.adapter.read() ).rejects.toThrow( 'layers-revision-unavailable' );
	expect( work.api.post ).not.toHaveBeenCalled(); expect( work.pdfRenderer.destroy ).toHaveBeenCalledTimes( 1 );
} );

function lightbox( work ) {
	require( '../../resources/ext.layers/viewer/LayersLightbox.js' );
	const box = new window.Layers.Viewer.Lightbox();
	jest.spyOn( box, 'renderViewer' ).mockImplementation( () => {} );
	jest.spyOn( box, 'flattenPage' ).mockImplementation( async ( url, data ) =>
		( { src: 'data:image/jpeg;base64,prepared', width: data.baseWidth, height: data.baseHeight } ) );
	jest.spyOn( box, 'validatePageOwnedEncoding' ).mockResolvedValue();
	jest.spyOn( box, 'printImages' ).mockResolvedValue();
	jest.spyOn( box, 'buildPdfBlob' ).mockReturnValue( new Blob( [ 'PDF' ] ) );
	jest.spyOn( box, 'saveBlob' ).mockImplementation( () => {} );
	jest.spyOn( box, 'showExportError' ).mockImplementation( () => {} );
	box.open( { filename: 'ABC', pageOwned: work.adapter } );
	return box;
}
it.each( [ 'print', 'download' ] )( 'retains full-document %s with fresh authorization and both PDF pages', async mode => {
	const work = setup(), box = lightbox( work );
	try {
		await box._loadPromise;
		expect( box.currentPage ).toBe( 2 ); expect( box.pageCount ).toBe( 2 ); expect( box.isPdf ).toBe( true );
		await box[ mode === 'print' ? 'printDocument' : 'downloadPdf' ]();
		expect( work.api.post ).toHaveBeenCalledTimes( 2 );
		expect( box.flattenPage ).toHaveBeenCalledTimes( 2 );
		expect( box.flattenPage.mock.calls.every( call => call[ 1 ].layers.length === 0 ) ).toBe( true );
		if ( mode === 'print' ) expect( box.printImages.mock.calls[ 0 ][ 0 ] ).toHaveLength( 2 );
		else expect( box.buildPdfBlob.mock.calls[ 0 ][ 0 ] ).toHaveLength( 2 );
		expect( box.showExportError ).not.toHaveBeenCalled();
	} finally { box.close( true ); }
} );
it.each( [ 'fresh-read', 'second-page' ] )( 'produces no partial export after %s refusal', async reason => {
	const work = setup(), box = lightbox( work );
	try {
		await box._loadPromise;
		if ( reason === 'fresh-read' ) work.api.post.mockRejectedValueOnce( new Error( 'refused' ) );
		else work.pdfRenderer.renderPage.mockResolvedValueOnce( { pageCount: 2, width: 1600, height: 800,
			dataUrl: 'data:image/png;base64,page1' } ).mockRejectedValueOnce( new Error( 'page unavailable' ) );
		await box.downloadPdf();
		expect( box.saveBlob ).not.toHaveBeenCalled(); expect( box.showExportError ).toHaveBeenCalledTimes( 1 );
		expect( work.api.get ).not.toHaveBeenCalled();
	} finally { box.close( true ); }
} );

describe( 'PDF creation overlay mounting', () => {
	function mount( reason ) {
		const work = fixture(), identity = JSON.stringify( [ 4, 12, 'pdf', 'File:Plan.pdf', 'abc', 2 ] );
		const Overlay = jest.fn( () => ( { init: jest.fn(), destroy: jest.fn() } ) );
		window.Layers.Viewer.Overlay = Overlay;
		require( '../../resources/ext.layers/viewer/PageOwnedPdfCreationViewerAdapter.js' );
		const lightbox = window.Layers.lightbox = { open: jest.fn(), close: jest.fn(), _sessionToken: 0 };
		lightbox.open.mockImplementation( options => { lightbox.pageOwned = options.pageOwned; lightbox._sessionToken++; } );
		const entry = { identity, kind: 'pdf', label: 'ABC', editUrl: '/wiki/Special:EditLayersPage?verified=1',
			preview: { kind: 'pdf', layers: [], viewer: work.viewer, selection: work.selection } };
		if ( reason === 'reader' ) delete entry.editUrl;
		const config = { wgAction: 'view', wgArticleId: 4, wgRevisionId: 12, wgCurRevisionId: 12,
			wgLayersCreationOverlays: { [ identity ]: entry } };
		mw.config.get.mockImplementation( key => config[ key ] );
		const image = document.createElement( 'img' ); image.className = 'layers-creation-image';
		image.setAttribute( 'data-layers-creation', identity ); image.alt = 'Preserved caption';
		if ( reason === 'noedit' ) image.setAttribute( 'data-layers-noedit', '1' );
		document.body.appendChild( image );
		const api = { post: jest.fn( async () => ( { layerspdfcreationview: copy( work.viewer ) } ) ), get: jest.fn() };
		const bootstrap = require( '../../resources/ext.layers/viewer/PageOwnedRevisionBootstrap.js' );
		return { work, entry, config, image, api, Overlay, lightbox, bootstrap };
	}
	it.each( [ 'editor', 'reader', 'noedit' ] )( 'keeps View and exact permission-based Edit for %s', async reason => {
		const work = mount( reason ), dispose = await work.bootstrap.loadInline( document, work.api, 'Owner', 12 );
		expect( work.Overlay ).toHaveBeenCalledTimes( 1 );
		const controls = work.Overlay.mock.calls[ 0 ][ 0 ]; expect( controls.canEdit ).toBe( reason === 'editor' );
		controls.onView( document.createElement( 'button' ) );
		const options = work.lightbox.open.mock.calls[ 0 ][ 0 ];
		expect( options.pageOwned.bundle.surface.kind ).toBe( 'pdf' );
		expect( await options.pageOwned.read() ).toEqual( work.work.viewer );
		expect( work.api.get ).not.toHaveBeenCalled(); expect( work.image.alt ).toBe( 'Preserved caption' );
		dispose(); expect( work.lightbox.close ).toHaveBeenCalledWith( true );
		expect( work.image.parentElement ).toBe( document.body ); options.pageOwned.dispose();
	} );
	it.each( [ 'oldid', 'revision', 'foreign', 'page', 'payload', 'file', 'name' ] )(
		'refuses %s occurrence admission', async reason => {
		const work = mount();
		if ( reason === 'oldid' ) window.history.replaceState( {}, '', '?oldid=12' );
		if ( reason === 'revision' ) work.config.wgCurRevisionId = 13;
		if ( reason === 'foreign' ) work.config.wgArticleId = 9;
		if ( reason === 'page' ) work.entry.preview.viewer.initialPage = 1;
		if ( reason === 'payload' ) work.entry.preview.layers = [ {} ];
		if ( reason === 'file' ) work.entry.preview.viewer.pages[ 0 ].surface.source.fileTitle = 'File:Other.pdf';
		if ( reason === 'name' ) work.entry.preview.viewer.label = 'Other';
		const dispose = await work.bootstrap.loadInline( document, work.api, 'Owner', 12 );
		expect( work.Overlay ).not.toHaveBeenCalled(); expect( work.api.post ).not.toHaveBeenCalled(); dispose();
		}
	);
} );
