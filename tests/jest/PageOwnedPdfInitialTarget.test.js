'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const Coordinator = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorCoordinator.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );

async function entry( page = 1 ) {
	const work = await fixture( true );
	const dependencies = { reader: work.session._reader, publisher: work.session._publisher,
		adapter: work.session._adapter };
	const options = { ...work.editor.config.pageOwned, pdfEntryPage: page };
	work.bridge.dispose();
	work.bridge.pdfCoordinator = null;
	const session = new Session( options, dependencies );
	work.editor.config.pageOwned = options;
	const bridge = new Bridge( work.editor, session );
	work.editor.apiManager.pageOwnedBridge = bridge;
	bridge.pdfCoordinator = new Coordinator( bridge, new PdfClient( work.api ) );
	const close = () => { bridge.dispose(); work.close(); work.editor.stateManager.destroy(); };
	return { ...work, session, bridge, close };
}

describe( 'Saved PDF entry targets an empty internal page', () => {
	it( 'opens page one through real navigation and preserves the stored page-two anchor', async () => {
		const work = await entry();
		try {
			const result = await work.bridge.load();
			expect( work.editor.page ).toBe( 1 );
			expect( result.layers ).toEqual( [] );
			expect( work.editor.stateManager.get( 'layers' ) ).toEqual( [] );
			expect( work.session.getDraft().surfaceId ).toBe( 'anchor' );
			expect( work.session.getDraft().snapshot ).toEqual( work.base );
			expect( work.session.getPdfStatus() ).toMatchObject( { page: 1, initialPage: 2, pageCount: 2 } );
			expect( work.api.get ).toHaveBeenCalledWith( expect.objectContaining( {
				binding: 'v1:7:anchor', editorpage: 1, revid: 12
			} ) );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( false );
			expect( work.bridge.pdfCoordinator.timelines.has( 2 ) ).toBe( true );
			expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Page 2' );
		} finally { work.close(); }
	} );

	it( 'saves page-one edits in the same set and leaves page two and another file exact', async () => {
		const work = await entry();
		try {
			await work.bridge.load();
			work.editor.stateManager.set( 'layers', [ { id: 'first', type: 'text', text: 'Page one edit', x: 11 } ] );
			work.editor.historyManager.saveState( 'Page one edit' );
			await work.bridge.save( 'Edit untouched PDF page' );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			const saved = JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data );
			expect( saved.surfaces.filter( item => item.id === 'anchor' || item.id === 'other-file' ) )
				.toEqual( work.base.surfaces );
			const added = saved.surfaces.find( item => item.source.page === 1 && item.source.fileTitle === 'File:Example.pdf' );
			expect( added.label ).toBe( 'ABC' );
			expect( added.layers[ 0 ].text ).toBe( 'Page one edit' );
		} finally { work.close(); }
	} );

	it.each( [ 0, -1, 3, 1.5, '1', null ] )( 'refuses invalid initial target %p before exposing a loaded editor', async page => {
		const work = await entry( page );
		try {
			await expect( work.bridge.load() ).rejects.toThrow( 'layers-editor-session-unavailable' );
			expect( work.bridge.loaded ).toBe( false );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it( 'refuses a changed owner response instead of opening the anchor as the requested page', async () => {
		const work = await entry();
		const get = work.api.get.getMockImplementation();
		work.api.get.mockImplementation( params => params.editorpage ?
			Promise.resolve( { layersread: { editor: work.context( 1, 13 ) } } ) : get( params ) );
		try {
			await expect( work.bridge.load() ).rejects.toThrow( 'layers-editor-session-unavailable' );
			expect( work.bridge.loaded ).toBe( false );
			expect( work.session.getPdfStatus().page ).toBe( 2 );
			expect( work.session.getDraft().snapshot ).toEqual( work.base );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );
