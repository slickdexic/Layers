'use strict';
const CanvasManager = require( '../../resources/ext.layers.editor/CanvasManager.js' );
const ImageLoader = require( '../../resources/ext.layers.editor/ImageLoader.js' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const ReadClient = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const Publisher = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const WorkingSet = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const Coordinator = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorCoordinator.js' );
const History = require( '../../resources/ext.layers.editor/HistoryManager.js' );
const State = require( '../../resources/ext.layers.editor/StateManager.js' );
require( '../../resources/ext.layers.editor/LayersEditor.js' );
const Editor = window.Layers.Core.Editor;
const copy = value => JSON.parse( JSON.stringify( value ) );

async function fixture( sparse = true, initialRevision = 12 ) {
	const source = { repository: 'local', fileTitle: 'File:Example.pdf',
		timestamp: '20261007120000', sha1: 'a'.repeat( 31 ) };
	const surface = page => ( { id: page === 2 ? 'anchor' : 'stored-first', kind: 'pdf', label: 'ABC',
		source: { ...source, page }, canvas: { width: page === 2 ? 333 : 208, height: page === 2 ? 111 : 416,
			backgroundVisible: true, backgroundOpacity: 0.75 },
		layers: [ { id: 'layer-' + page, type: 'text', text: 'Page ' + page, x: page * 10 } ],
		metadata: { nested: [ null, false, page ] } } );
	const unrelated = surface( 1 );
	unrelated.id = 'other-file';
	unrelated.source.fileTitle = 'File:Other.pdf';
	const base = { schemaVersion: 1, metadata: { unknown: [ null, false, 0 ] },
		surfaces: [ ...( sparse ? [] : [ surface( 1 ) ] ), surface( 2 ), unrelated ] };
	let server = copy( base ), revision = initialRevision;
	const context = ( page, at = revision, snapshot = server ) => {
		const anchor = snapshot.surfaces.find( member => member.id === 'anchor' );
		const group = snapshot.surfaces.filter( member => member.kind === 'pdf' &&
			member.label === anchor.label && member.source.fileTitle === source.fileTitle );
		const stored = group.find( member => member.source.page === page );
		return copy( { owner: 'Owner', pageId: 7, revisionId: at, binding: 'v1:7:anchor',
			kind: 'pdf', label: anchor.label, initialPage: 2, pageCount: 2, page, stored: Boolean( stored ),
			members: group.slice().sort( ( left, right ) => left.source.page - right.source.page )
				.map( member => ( { page: member.source.page, surfaceId: member.id } ) ),
			surface: stored || { id: WorkingSet.surfaceId( 7, at, source.fileTitle, anchor.label, page ),
				kind: 'pdf', label: anchor.label, source: { ...source, page },
				canvas: { width: 208, height: 416, backgroundVisible: true, backgroundOpacity: 1 }, layers: [] },
			sourceGeometry: { page, width: page === 1 ? 208 : 416, height: page === 1 ? 416 : 208,
				units: 'file-handler-pixels' },
			rendition: { url: '/exact/page-' + page + '?revision=' + at, width: page === 1 ? 208 : 333,
				height: page === 1 ? 416 : 167 } } );
	};
	const api = { get: jest.fn( params => Promise.resolve( { layersread: params.editorpage ?
		{ editor: context( params.editorpage, params.revid ) } :
		{ revisionId: params.revid, snapshot: copy( server ), sourceGeometry: [] } } ) ),
	postWithToken: jest.fn( ( token, params ) => {
		server = JSON.parse( params.data );
		revision++;
		return Promise.resolve( { layerspublish: { result: 'Success', revid: revision } } );
	} ) };
	const options = { owner: 'Owner', pageId: 7, revisionId: initialRevision, surfaceId: 'anchor', pdfContext: context( 2 ) };
	const session = new Session( options, { reader: new ReadClient( api ),
		publisher: new Publisher( api ), adapter: new Adapter() } );
	const editor = Object.create( Editor.prototype );
	editor.config = { isSlide: false, imageUrl: '/exact/page-2?revision=' + initialRevision, pageOwned: options };
	editor.filename = 'Example.pdf';
	editor.stateManager = new State( editor );
	global.ImageLoader = ImageLoader;
	const container = document.createElement( 'div' );
	editor.canvasManager = new CanvasManager( { editor, container, canvas: document.createElement( 'canvas' ),
		exactBackground: true } );
	editor.historyManager = new History( { editor } );
	const bridge = new Bridge( editor, session );
	editor.apiManager = { pageOwnedBridge: bridge };
	bridge.pdfCoordinator = new Coordinator( bridge, new PdfClient( api ) );
	await bridge.load();
	editor.canvasManager.config.backgroundImageUrl = editor.config.imageUrl;
	editor.canvasManager.backgroundImage = { initial: true };
	const Original = global.Image;
	global.Image = class {
		constructor() { this.width = 208; this.height = 416; }
		decode() { return Promise.resolve(); }
		set src( value ) {
			this.value = value;
			if ( value && value.includes( 'page-2' ) ) { this.width = 333; this.height = 167; }
			if ( value ) queueMicrotask( () => this.onload && this.onload() );
		}
		get src() { return this.value; }
	};
	const edit = text => {
		editor.stateManager.set( 'layers', [ { id: 'edit-' + editor.page, type: 'text', text, x: -17 } ] );
		editor.historyManager.saveState( text );
	};
	const close = () => {
		bridge.dispose();
		editor.canvasManager.destroy();
		global.Image = Original;
	};
	return { editor, bridge, session, api, base, context, edit, close };
}

module.exports = { fixture };
if ( expect.getState().testPath.endsWith( 'PageOwnedPdfEditorIntegration.test.js' ) ) {
describe( 'Complete PDF editor routing through accepted components', () => {
	it( 'starts on 2/2, keeps sparse blank unpersisted and retains both edited pages and native IDs', async () => {
		const work = await fixture();
		try {
			expect( [ work.editor.page, work.editor.pageCount ] ).toStrictEqual( [ 2, 2 ] );
			expect( work.editor.stateManager.get( 'baseWidth' ) ).toBe( 333 );
			work.edit( 'Second edited' );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.session.getDraft().snapshot.surfaces ).toHaveLength( 2 );
			work.edit( 'First edited' );
			const firstId = work.session.getPdfStatus().activeSurfaceId;
			expect( firstId ).toBe( WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 ) );
			expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Second edited' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.session.getPdfStatus().activeSurfaceId ).toBe( firstId );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'First edited' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ) ).toStrictEqual( [] );
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( false );
			expect( work.session.getDraft().snapshot ).toStrictEqual( work.base );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'denial', 'wrong pin', 'live edit' ] )( 'refuses %s without changing full live state, background, URL or history', async reason => {
		const work = await fixture();
		try {
			work.edit( 'Keep second' );
			const background = work.editor.canvasManager.backgroundImage;
			let resolve;
			work.api.get.mockImplementationOnce( () => new Promise( done => { resolve = done; } ) );
			const pending = work.bridge.pdfCoordinator.turn( 1 );
			if ( reason === 'live edit' ) work.edit( 'During wait' );
			const before = work.bridge.pdfCoordinator.witness();
			const context = work.context( 1 );
			if ( reason === 'wrong pin' ) context.surface.source.sha1 = 'b'.repeat( 31 );
			resolve( reason === 'denial' ? { error: { code: 'permissiondenied' } } : { layersread: { editor: context } } );
			expect( await pending ).toBe( false );
			expect( work.bridge.pdfCoordinator.witness() ).toBe( before );
			expect( work.editor.canvasManager.backgroundImage ).toBe( background );
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'publishes exactly one complete renamed document and obtains the next context at the confirmed base', async () => {
		const work = await fixture();
		try {
			work.edit( 'Second saved' );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			work.edit( 'First saved' );
			work.bridge.rename( 'One name' );
			const expected = work.session.getDraft().snapshot;
			const result = await work.bridge.save( 'Both pages' );
			expect( result ).toMatchObject( { revisionId: 13, dirty: false } );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			expect( JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toStrictEqual( expected );
			expect( expected.surfaces.filter( member => member.source.fileTitle === 'File:Example.pdf' )
				.map( member => member.label ) ).toStrictEqual( [ 'One name', 'One name' ] );
			expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
			expect( work.api.get.mock.calls.at( -1 )[ 0 ] ).toMatchObject( { revid: 13, binding: 'v1:7:anchor', editorpage: 2 } );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Second saved' );
		} finally { work.close(); }
	} );
	it( 'reconciles without writing and retains an edited older-issued member across fresh exact turns', async () => {
		const work = await fixture();
		try {
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			work.edit( 'Old native member' );
			const retained = work.session.getPdfStatus().activeSurfaceId;
			await work.bridge.reconcile( 13 );
			expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.session.getPdfStatus().activeSurfaceId ).toBe( retained );
			expect( retained ).not.toBe( WorkingSet.surfaceId( 7, 13, 'File:Example.pdf', 'ABC', 1 ) );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Old native member' );
			expect( work.session.getDraft().pdf.admissions[ 0 ].revisionId ).toBe( 12 );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );
describe( 'PDF exact background staging', () => {
	it( 'failed exact load preserves current background, URL and dimensions', async () => {
		const Original = global.Image;
		global.Image = class {
			set src( value ) { if ( value ) queueMicrotask( () => this.onerror && this.onerror() ); }
		};
		window.Layers.Utils = window.Layers.Utils || {};
		window.Layers.Utils.ImageLoader = ImageLoader;
		global.ImageLoader = ImageLoader;
		const canvas = Object.create( CanvasManager.prototype );
		canvas.editor = { filename: 'File:Example.pdf' };
		canvas.config = { backgroundImageUrl: '/original.png' };
		canvas.backgroundImage = { original: true };
		canvas.baseWidth = 333;
		canvas.baseHeight = 111;
		try {
			const stage = canvas.stageExactBackground( '/failed-exact.png' );
			await expect( stage.promise ).rejects.toThrow( 'layers-page-load-failed' );
			expect( canvas.config.backgroundImageUrl ).toBe( '/original.png' );
			expect( canvas.backgroundImage ).toStrictEqual( { original: true } );
			expect( [ canvas.baseWidth, canvas.baseHeight ] ).toStrictEqual( [ 333, 111 ] );
			expect( canvas.exactStages.size ).toBe( 0 );
		} finally {
			global.Image = Original;
		}
	} );
} );
}