'use strict';

const publication = require( './PageOwnedWholePdfImportPublication.test.js' );
const en = require( '../../i18n/en.json' );

// Load the same MediaWiki module classes used by the saved editor startup path.
require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
require( '../../resources/ext.layers.editor/PageOwnedPdfCreationReadClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );
require( '../../resources/ext.layers.editor/PageOwnedRevisionControl.js' );
require( '../../resources/ext.layers.editor/PageOwnedNameControl.js' );
require( '../../resources/ext.layers.editor/PageOwnedCopyPicker.js' );
require( '../../resources/ext.layers.editor/PageOwnedSummaryField.js' );
require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCatalogClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportReadClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCoordinator.js' );
require( '../../resources/ext.layers.editor/PageOwnedImportControl.js' );
require( '../../resources/ext.layers.editor/PageOwnedImportIntegration.js' );
require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportCatalogClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportIntegration.js' );
require( '../../resources/ext.layers.editor/PageOwnedMissingPdfImportPublishClient.js' );

window.Layers.Editor.APIErrorHandler = class {
	setEnableSaveButtonCallback() {}
	destroy() {}
};
window.Layers.Editor.ExportController = class {};
window.Layers.Editor.APICacheManager = class {
	constructor() { this.responseCache = new Map(); }
	getCached() { return null; }
	setCache() {}
	invalidateCache() {}
	destroy() {}
	buildCacheKey( filename, options = {} ) { return filename + JSON.stringify( options ); }
};
require( '../../resources/ext.layers.editor/APIManager.js' );
const APIManager = window.Layers.Core.APIManager;

const tick = async () => { for ( let index = 0; index < 200; index++ ) await Promise.resolve(); };
const message = ( key, ...args ) => ( en[ key ] || key ).replace( /\$(\d+)/g, ( _, number ) => String( args[ number - 1 ] ) );
const byFile = bridge => bridge.session.getDraft().snapshot.surfaces.filter( surface =>
	surface.kind === 'pdf' && surface.source.fileTitle === 'File:Example.pdf' );
const memory = () => {
	const rows = new Map();
	return { rows, get length() { return rows.size; }, key: index => Array.from( rows.keys() )[ index ] ?? null,
		getItem: key => rows.get( key ) ?? null, setItem: ( key, value ) => rows.set( key, String( value ) ),
		removeItem: key => rows.delete( key ) };
};
let managerId = 0;

async function startSavedPdf( { readOnly = false } = {} ) {
	const value = await publication.setup( { optIn: false } ), { work, api, sourceApi } = value;
	api.post = sourceApi.post;
	const originalGet = api.get.getMockImplementation();
	api.get.mockImplementation( params => params.action === 'layersworkingcopypdfimportcatalog' ? Promise.resolve( {
		layersworkingcopypdfimportcatalog: { version: 1, data: JSON.stringify( { pages: [ {
			title: 'Source owner', owner: 'Source_owner', pageid: 9, revid: 42,
			layerSets: [ { id: 'source-p2', label: 'ABC', kind: 'pdf', fileTitle: 'File:Example.pdf', canvas: { width: 416, height: 208 } } ]
			} ] } ) }
	} ) : originalGet( params ) );
	work.editor.config.pageOwned.draftScope = { wiki: 'https://example.test/wiki', user: 'PdfStartupTest' };
	work.editor.config.pageOwned.readOnly = readOnly;
	const header = document.createElement( 'div' );
	header.className = 'layers-header';
	const right = document.createElement( 'div' ); right.className = 'layers-header-right'; header.appendChild( right );
	const container = document.createElement( 'div' ); container.appendChild( header );
	work.editor.uiManager = { container, showPromptDialog: jest.fn() };
	window.localStorage = memory();
	mw.msg = jest.fn( message ); mw.notify = jest.fn();
	mw.Api = jest.fn( () => api );
	const manager = Object.create( APIManager.prototype );
	Object.assign( manager, { editor: work.editor, api, pageOwnedBridge: work.bridge, pageOwnedCreation: null,
		generateLayerId: () => 'startup-layer-' + ( ++managerId ) } );
	let extraManager = null;
	return { ...value, manager, header, container, setExtraManager: value => { extraManager = value; }, close: () => {
		if ( extraManager ) extraManager.destroy();
		if ( manager.pageOwnedDrafts ) manager.pageOwnedDrafts.dispose();
		if ( manager.pageOwnedImport ) manager.pageOwnedImport.dispose();
		if ( manager.pageOwnedRevisionControl ) manager.pageOwnedRevisionControl.dispose();
		if ( manager.pageOwnedNameControl ) manager.pageOwnedNameControl.dispose();
		if ( manager.pageOwnedCopyPicker ) manager.pageOwnedCopyPicker.dispose();
		if ( manager.pageOwnedSummaryField ) manager.pageOwnedSummaryField.dispose();
		work.close(); header.remove(); container.remove();
	} };
}

describe( 'Native whole-PDF Import startup', () => {
	let opened;
	afterEach( () => { if ( opened ) { opened.close(); opened = null; } } );

	it( 'ships the native route in the page-owned editor module loaded at startup', () => {
		const scripts = require( '../../extension.json' ).ResourceModules[ 'ext.layers.editor.pageOwned' ].scripts;
		expect( scripts ).toEqual( expect.arrayContaining( [ 'PageOwnedWholePdfImportCatalogClient.js',
			'PageOwnedWholePdfImportSource.js', 'PageOwnedWholePdfImportSession.js', 'PageOwnedWholePdfImportApplication.js',
			'PageOwnedWholePdfImportPublishClient.js', 'PageOwnedWholePdfImportIntegration.js' ] ) );
	} );

	it( 'selects the whole-PDF route during saved editor startup and mounts the existing Import control', async () => {
		opened = await startSavedPdf();
		const state = await opened.manager.initializePageOwnedDrafts( {} );
		expect( state ).toEqual( {} );
		expect( opened.manager.pageOwnedImport ).toBeInstanceOf( window.Layers.Editor.PageOwnedWholePdfImportIntegration );
		expect( opened.manager.pageOwnedDrafts.ready ).toBe( true );
		expect( opened.header.querySelector( '.layers-page-import-button' ) ).not.toBeNull();
		expect( opened.work.editor.historyManager.hasPdfImportHistory( opened.manager.pageOwnedImport.application ) ).toBe( true );
		expect( opened.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'adopts a durable creation handoff without replacing its history owner or reviewing earlier drafts', async () => {
		opened = await startSavedPdf();
		const delivered = { bridge: opened.work.bridge, importApplication: opened.application, importBinding: opened.binding };
		delivered.importApplication.enableHistory();
		opened.manager.pageOwnedCreation = {};
		const earlierRecovery = jest.spyOn( window.Layers.Editor.PageOwnedDraftLifecycle.prototype, 'enableEarlierPdfCreationRecovery' );
		try {
			await opened.manager.initializePageOwnedDrafts( {}, true, delivered );
			expect( opened.manager.pageOwnedImport.application ).toBe( delivered.importApplication );
			expect( opened.manager.pageOwnedImport.binding ).toBe( delivered.importBinding );
			expect( opened.work.editor.historyManager.hasPdfImportHistory( delivered.importApplication ) ).toBe( true );
			expect( opened.work.editor.historyManager.hasPdfImportHistory() ).toBe( true );
			expect( opened.manager.pageOwnedCreation.savedDrafts ).toBe( opened.manager.pageOwnedDrafts );
			expect( earlierRecovery ).not.toHaveBeenCalled();
		} finally { earlierRecovery.mockRestore(); }
	} );

	it( 'uses the native catalog and read authority, then preserves whole-group Undo, Redo, draft and Save', async () => {
		opened = await startSavedPdf(); await opened.manager.initializePageOwnedDrafts( {} );
		const integration = opened.manager.pageOwnedImport, before = JSON.parse( JSON.stringify( opened.work.session.getDraft().snapshot ) );
		integration.control.open(); await tick();
		const choice = integration.control.dialog.list.querySelector( 'button' ); expect( choice ).not.toBeNull(); choice.click(); await tick();
		integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
		const imported = JSON.parse( JSON.stringify( opened.work.session.getDraft().snapshot ) );
		expect( byFile( opened.work.bridge ) ).toHaveLength( 2 );
		expect( opened.api.get.mock.calls.some( ( [ params ] ) => params.action === 'layersworkingcopypdfimportcatalog' ) ).toBe( true );
		expect( opened.sourceApi.post ).toHaveBeenCalledWith( expect.objectContaining( { action: 'layersworkingcopypdfimportread' } ) );
		expect( opened.work.editor.historyManager.undo() ).toBe( true );
		expect( opened.work.session.getDraft().snapshot ).toEqual( before );
		expect( opened.work.editor.historyManager.redo() ).toBe( true );
		expect( opened.work.session.getDraft().snapshot ).toEqual( imported );
		const saved = await opened.manager.pageOwnedDrafts.save( 'Imported PDF' );
		expect( saved ).toMatchObject( { revisionId: 13, dirty: false, draftPersisted: true } );
		const native = opened.api.postWithToken.mock.calls.filter( ( [ , params ] ) => params.action === 'layersworkingcopypdfimportpublish' );
		expect( native ).toHaveLength( 1 ); expect( JSON.parse( native[ 0 ][ 1 ].data ) ).toEqual( imported );
		expect( Array.from( window.localStorage.rows.values() ).some( raw => JSON.parse( raw ).scope.baseRevisionId === 13 ) ).toBe( true );
	} );

	it( 'keeps historical/read-only editors out of draft and Import startup', async () => {
		opened = await startSavedPdf( { readOnly: true } );
		opened.work.editor.config.pageOwned.readOnly = true;
		delete opened.work.editor.config.pageOwned.pdfContext;
		const manager = new APIManager( opened.work.editor ); opened.setExtraManager( manager );
		await manager.loadLayers();
		expect( manager.pageOwnedBridge.session.getStatus().readOnly ).toBe( true );
		expect( window.Layers.Editor.PageOwnedWholePdfImportIntegration.supports( manager.pageOwnedBridge ) ).toBe( false );
		expect( manager.pageOwnedImport ).toBeUndefined();
		expect( manager.pageOwnedDrafts ).toBeNull();
		expect( opened.header.querySelector( '.layers-page-import-button' ) ).toBeNull();
		expect( opened.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 'read-only history', 'adopted/legacy data' ] )( 'denies whole-PDF Import for %s', async reason => {
		opened = await startSavedPdf();
		if ( reason === 'read-only history' ) opened.work.session._readOnly = true;
		else opened.work.session._baseHasDrawings = false;
		expect( window.Layers.Editor.PageOwnedWholePdfImportIntegration.supports( opened.work.bridge ) ).toBe( false );
		expect( opened.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 'image', 'slide' ] )( 'preserves the established %s Import route', () => {
		const bridge = { loaded: true, disposed: false, pdfCoordinator: null,
			session: { _readOnly: false, _newSurface: null, _pdf: null, _pdfContext: null, _baseHasDrawings: true, _pageId: 7 },
			editor: { isDestroyed: false, historyManager: { enableWorkingCopyHistory() {} }, canvasManager: { selectionManager: {} } } };
		expect( window.Layers.Editor.PageOwnedImportIntegration.supports( bridge ) ).toBe( true );
		expect( window.Layers.Editor.PageOwnedWholePdfImportIntegration.supports( bridge ) ).toBe( false );
	} );
} );
