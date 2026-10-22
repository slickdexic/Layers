'use strict';
global.TextEncoder = global.TextEncoder || require( 'util' ).TextEncoder;
const { setup } = require( './fixtures/pdfCreationHostImport.js' );
const { preparation, copy, wait, witness } = require( './fixtures/pdfCreationHost.js' );
const { asciiJson } = require( './fixtures/pdfCreationSavedImport.js' );
for ( const script of require( '../../extension.json' ).ResourceModules[ 'ext.layers.editor.pageOwned' ].scripts ) {
	require( '../../resources/ext.layers.editor/' + script );
}
window.Layers.Editor.APIErrorHandler = class { setEnableSaveButtonCallback() {} destroy() {} };
window.Layers.Editor.ExportController = class {};
require( '../../resources/ext.layers.editor/APIManager.js' );
const APIManager = window.Layers.Core.APIManager;
const tick = async () => { for ( let index = 0; index < 500; index++ ) await Promise.resolve(); };
function memory( entries = [] ) {
	const records = new Map( entries );
	return { records, get length() { return records.size; }, key: index => Array.from( records.keys() )[ index ] ?? null,
		getItem: key => records.get( key ) ?? null, setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ) };
}
function make( slot = true, storage = memory(), saved ) {
	const work = setup( slot ), editor = work.editor; work.host.dispose(); window.localStorage = storage;
	const remote = saved ? copy( saved ) : { revisionId: 12, snapshot: work.native.baseBundle && copy( work.native.baseBundle.snapshot ), lost: false, denied: false };
	const context = page => {
		const value = preparation( slot, 2, page, 2 ).context; value.revisionId = remote.revisionId;
		const members = remote.snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === 'ABC' && surface.source.fileTitle === 'File:Source.pdf' );
		value.members = members.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) );
		const member = members.find( surface => surface.source.page === page ); value.stored = Boolean( member );
		if ( member ) {
			value.surface = copy( member ); value.sourceGeometry = { page, width: member.canvas.width, height: member.canvas.height, units: 'file-handler-pixels' };
			value.rendition = { url: 'https://example.test/exact/pdf-page-' + page + '.jpg', width: member.canvas.width, height: member.canvas.height + ( page === 2 ? 1 : 0 ) };
		}
		return value;
	};
	const source = work.nativeImport.source;
	const savedImport = () => {
		const data = copy( work.nativeImport.value ); delete data.targetAdmission;
		const group = remote.snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.source.fileTitle === 'File:Source.pdf' );
		const contexts = [ context( 1 ), context( 2 ) ];
		data.target = { ...work.native.target, revisionId: remote.revisionId };
		data.targetBundle = { revisionId: remote.revisionId, snapshot: copy( remote.snapshot ),
			sourceGeometry: Object.fromEntries( group.map( surface => [ surface.id, contexts.find( value => value.page === surface.source.page ).sourceGeometry ] ) ),
			sourceRenditions: Object.fromEntries( group.map( surface => [ surface.id, contexts.find( value => value.page === surface.source.page ).rendition ] ) ) };
		data.targetGroup = { label: 'ABC', source: { ...data.sourceGroup.source, timestamp: work.native.anchorSurface.source.timestamp,
			sha1: work.native.anchorSurface.source.sha1 }, pageCount: 2, members: group.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) };
		data.admittedTargetSurfaces = []; data.admittedTargetGeometry = {}; data.admittedTargetRenditions = {};
		return { layersworkingcopypdfimportread: { version: 1, data: asciiJson( data ) } };
	};
	const api = {
		post: jest.fn( async request => {
			if ( request.action === 'layersmissingpdfimportread' ) return { layersmissingpdfimportread: { version: 1, data: asciiJson( work.nativeImport.value ) } };
			if ( request.action === 'layersworkingcopypdfimportread' ) return savedImport();
			if ( request.action !== 'layerspdfcreationread' ) throw new Error( 'Unexpected native read' );
			const value = preparation( slot, 2, request.pdfpage, 2 ); value.mainText = work.native.mainText;
			return { layerspdfcreationread: { version: 1, data: asciiJson( value ) } };
		} ),
		postWithToken: jest.fn( async ( token, request ) => {
			if ( request.action === 'layersmissingpdfimportoutcome' ) return { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: remote.revisionId } };
			if ( remote.denied ) throw { error: { code: 'layers-edit-conflict' } };
			remote.snapshot = JSON.parse( request.data ); remote.revisionId++;
			if ( remote.lost ) throw new Error( 'Response lost after native commit' );
			return { [ request.action ]: request.action === 'layerspublish' ? { result: 'Success', revid: remote.revisionId } :
				{ version: 1, result: 'Success', revid: remote.revisionId } };
		} ),
		get: jest.fn( async request => {
			if ( request.action === 'layersworkingcopypdfimportcatalog' ) return { layersworkingcopypdfimportcatalog: { version: 1, data: asciiJson( { pages: [ {
				title: 'Source owner', owner: source.owner, pageid: source.pageId, revid: source.revisionId,
				layerSets: [ { id: source.surfaceId, kind: 'pdf', label: 'ABC', fileTitle: 'File:Source.pdf', canvas: { width: 416, height: 208 } } ]
			} ] } ) } };
			if ( request.action === 'query' ) return { query: { pages: [ { pageid: 7, title: 'Owner', revisions: [ {
				revid: remote.revisionId, parentid: remote.revisionId - 1, slots: { main: { contentmodel: 'wikitext', content: work.native.mainText } }
			} ] } ] } };
			return { layersread: request.editorpage ? { editor: context( request.editorpage ) } :
				{ revisionId: remote.revisionId, snapshot: copy( remote.snapshot ), sourceGeometry: {} } };
		} )
	};
	mw.Api = jest.fn( () => api ); mw.msg = jest.fn( ( key, ...args ) => [ key, ...args ].join( '|' ) ); mw.notify = jest.fn();
	editor.config.pageOwned = { ...work.native.target, readOnly: false, pdfCreation: copy( work.native ), draftScope: { wiki: 'wiki', user: 'Editor' } };
	if ( saved ) {
		delete editor.config.pageOwned.pdfCreation; editor.config.pageOwned.revisionId = saved.revisionId;
		editor.config.pageOwned.pdfContext = context( 2 ); editor.config.isSlide = false; editor.config.imageUrl = context( 2 ).rendition.url;
	}
	editor.uiManager = { container: document.createElement( 'div' ), showSpinner: jest.fn(), hideSpinner: jest.fn(), destroy: jest.fn() };
	editor.uiManager.container.innerHTML = '<div class="layers-header"><div class="layers-header-right"></div></div>';
	editor.apiManager = new APIManager( editor );
	return { ...work, api, remote, storage, manager: editor.apiManager, close() { editor.apiManager.destroy(); work.close(); } };
}
async function choose( work ) {
	const control = work.manager.pageOwnedCreation.importControl; control.open(); await tick();
	expect( control.dialog.list.querySelector( 'button' ) ).not.toBeNull();
	control.dialog.list.querySelector( 'button' ).click(); await tick(); return control;
}
const members = work => work.remote.snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.source.fileTitle === 'File:Source.pdf' );

describe( 'Native missing-PDF editor Import startup', () => {
	let work;
	afterEach( () => { if ( work ) { work.close(); work = null; } } );
	it( 'opens ordinary creation without opting its draft or Save path into Import', async () => {
		work = make(); await work.manager.loadLayers();
		expect( work.manager.pageOwnedCreation.importsEnabled ).toBe( false );
		expect( work.manager.pageOwnedCreation.host.captureExitEnvelope().version ).toBe( 1 );
		expect( work.manager.pageOwnedCreation.importControl.button.textContent ).toBe( 'layers-page-import-button' );
		work.edit( 'Manual' ); expect( await work.manager.saveLayers() ).toMatchObject( { revisionId: 13, editorStateValid: true } );
		expect( work.api.postWithToken.mock.calls[ 0 ][ 1 ].action ).toBe( 'layerspublish' );
	} );
	it.each( [ true, false ] )( 'imports every PDF page immediately into an empty target, then hands off one actual history (slot %s)', async slot => {
		work = make( slot ); await work.manager.loadLayers(); const control = await choose( work );
		expect( control.dialog ).toBeNull(); expect( work.manager.pageOwnedCreation.importsEnabled ).toBe( true );
		const host = work.manager.pageOwnedCreation.host, imported = copy( host.getDraft().snapshot );
		expect( work.editor.stateManager.get( 'selectedLayerIds' ) ).toEqual( work.editor.layers.map( layer => layer.id ) );
		expect( await work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.layers ).toEqual( [] );
		expect( await work.editor.historyManager.redo() ).toBe( true ); expect( host.getDraft().snapshot ).toEqual( imported );
		const result = await work.manager.saveLayers();
		expect( result ).toMatchObject( { revisionId: 13, dirty: false, editorStateValid: true, draftPersisted: true } );
		expect( work.api.postWithToken.mock.calls[ 0 ][ 1 ].action ).toBe( 'layersmissingpdfimportpublish' );
		expect( members( work ) ).toHaveLength( 2 ); expect( work.remote.snapshot ).toEqual( imported );
		expect( work.manager.pageOwnedImport.application ).toBeDefined();
		expect( work.editor.historyManager.hasPdfImportHistory( work.manager.pageOwnedImport.application ) ).toBe( true );
		expect( work.editor.uiManager.container.querySelectorAll( '.layers-page-import-button' ) ).toHaveLength( 1 );
		expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.layers ).toEqual( [] );
		expect( work.editor.historyManager.redo() ).toBe( true );
		expect( await work.manager.pageOwnedBridge.pdfCoordinator.turn( 1 ) ).toBe( true );
		expect( work.editor.layers.length ).toBeGreaterThan( 0 );
		const raw = Array.from( work.storage.records.values() ).map( JSON.parse ).find( value => value.wholePdfImportDraft );
		expect( raw.scope.baseRevisionId ).toBe( 13 );
	} );
	it( 'counts existing work on an offscreen page and requires a decision without changing it on cancellation', async () => {
		work = make(); await work.manager.loadLayers(); work.edit( 'Keep page two' );
		await work.manager.pageOwnedCreation.turn( 1 ); const before = witness( work ), control = await choose( work );
		expect( control.dialog.decision.hidden ).toBe( false ); expect( control.dialog.decision.textContent ).toContain( 'layers-page-import-replace-warning|1' );
		control.dialog.cancel.click(); expect( witness( work ) ).toEqual( before );
		expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'keeps manual edits, then appends imported layers and selects just the imported active-page layers', async () => {
		work = make(); await work.manager.loadLayers(); work.edit( 'Keep' ); const control = await choose( work );
		control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
		expect( work.editor.layers.find( layer => layer.id === 'text-2' ).text ).toBe( 'Keep' );
		expect( work.editor.stateManager.get( 'selectedLayerIds' ) ).toEqual( work.editor.layers.filter( layer => layer.id !== 'text-2' ).map( layer => layer.id ) );
		expect( await work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.layers.map( layer => layer.text ) ).toEqual( [ 'Keep' ] );
	} );
	it( 'delivers the approved empty-Import notice from the actual native version difference', async () => {
		work = make(); const pin = { timestamp: '20250901000000', sha1: 'b'.repeat( 31 ) };
		Object.assign( work.nativeImport.value.sourceGroup.source, pin );
		for ( const surface of work.nativeImport.value.sourceBundle.snapshot.surfaces ) Object.assign( surface.source, pin );
		await work.manager.loadLayers(); const control = await choose( work );
		expect( control.dialog ).toBeNull();
		expect( mw.notify ).toHaveBeenCalledWith( 'layers-page-import-file-version', {
			type: 'info', autoHide: false, classes: 'layers-page-import-version-notice'
		} );
		expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'uses native Check after a committed but lost first-Save response and never publishes twice', async () => {
		work = make(); await work.manager.loadLayers(); await choose( work ); work.remote.lost = true;
		await expect( work.manager.saveLayers() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		const before = work.api.postWithToken.mock.calls.length;
		expect( await work.manager.checkPageOwnedRevision() ).toMatchObject( { revisionId: 13, editorStateValid: true } );
		expect( work.api.postWithToken.mock.calls.slice( before ).map( ( [ , request ] ) => request.action ) ).toEqual( [ 'layersmissingpdfimportoutcome' ] );
		expect( work.manager.pageOwnedCreation.transferred ).toBe( true );
	} );
	it( 'preserves the complete imported editor and Undo when first Save is refused', async () => {
		work = make(); await work.manager.loadLayers(); await choose( work ); const before = witness( work ); work.remote.denied = true;
		await expect( work.manager.saveLayers() ).rejects.toMatchObject( { code: 'layers-edit-conflict' } );
		expect( witness( work ) ).toEqual( before ); expect( work.manager.pageOwnedCreation.transferred ).toBe( false );
		expect( Array.from( work.storage.records.values() ).some( raw => JSON.parse( raw ).pdfCreation.version === 4 ) ).toBe( true );
	} );
	it( 'refuses a canceled late preparation and preserves newer live work', async () => {
		work = make(); await work.manager.loadLayers(); const control = work.manager.pageOwnedCreation.importControl;
		control.open(); await tick(); const pending = wait(), original = work.api.post.getMockImplementation();
		work.api.post.mockImplementation( async request => request.action === 'layersmissingpdfimportread' ? pending.promise : original( request ) );
		control.dialog.list.querySelector( 'button' ).click(); await tick(); control.dialog.cancel.click(); work.edit( 'Newer' );
		const before = witness( work ); pending.resolve( { layersmissingpdfimportread: { version: 1, data: asciiJson( work.nativeImport.value ) } } ); await tick();
		expect( witness( work ) ).toEqual( before ); expect( control.dialog ).toBeNull(); expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'restores a same-base Import backup through actual startup review before enabling publication', async () => {
		work = make(); await work.manager.loadLayers(); await choose( work ); const expected = copy( work.manager.pageOwnedCreation.host.getDraft().snapshot );
		work.manager.pageOwnedCreation.lifecycle.flush(); const entries = Array.from( work.storage.records ); work.close(); work = null;
		const chooseDraft = jest.spyOn( window.Layers.Editor.PageOwnedRecoveryDialog.prototype, 'choose' ).mockResolvedValue( 0 );
		const confirm = jest.spyOn( window.Layers.Editor.PageOwnedRecoveryDialog.prototype, 'confirm' ).mockResolvedValue( true );
		try {
			work = make( true, memory( entries ) ); await work.manager.loadLayers();
			expect( work.manager.pageOwnedCreation.importsEnabled ).toBe( true ); expect( confirm ).toHaveBeenCalled();
			expect( work.manager.pageOwnedCreation.host.getDraft().snapshot ).toEqual( expected );
			expect( await work.editor.historyManager.undo() ).toBe( true ); expect( await work.editor.historyManager.redo() ).toBe( true );
			for ( const [ key, raw ] of entries ) expect( work.storage.records.get( key ) ).toBe( raw );
			expect( await work.manager.saveLayers() ).toMatchObject( { revisionId: 13, editorStateValid: true } );
		} finally { chooseDraft.mockRestore(); confirm.mockRestore(); }
	} );
	it( 'discovers and restores an earlier creation backup through fresh saved-editor startup and native Check', async () => {
		work = make(); await work.manager.loadLayers(); await choose( work );
		expect( await work.manager.saveLayers() ).toMatchObject( { revisionId: 13, editorStateValid: true } );
		const expected = copy( work.remote.snapshot ), saved = copy( work.remote );
		const entries = Array.from( work.storage.records ).filter( ( [ , raw ] ) => JSON.parse( raw ).scope.baseRevisionId === 12 );
		expect( entries.length ).toBeGreaterThan( 0 ); work.close(); work = null;
		const earlier = jest.spyOn( window.Layers.Editor.PageOwnedRecoveryDialog.prototype, 'chooseEarlierCreation' ).mockResolvedValue( { selected: 0 } );
		const confirm = jest.spyOn( window.Layers.Editor.PageOwnedRecoveryDialog.prototype, 'confirm' ).mockResolvedValue( true );
		try {
			work = make( true, memory( entries ), saved ); await work.manager.loadLayers();
			expect( earlier ).toHaveBeenCalled(); expect( confirm ).toHaveBeenCalled(); expect( work.manager.pageOwnedDrafts.ready ).toBe( true );
			expect( work.manager.pageOwnedBridge.session.getDraft().snapshot ).toEqual( expected );
			expect( work.api.postWithToken.mock.calls.every( ( [ , request ] ) => request.action === 'layersmissingpdfimportoutcome' ) ).toBe( true );
			expect( work.api.postWithToken ).toHaveBeenCalled();
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.layers ).toEqual( [] );
			expect( work.editor.historyManager.redo() ).toBe( true );
			for ( const [ key, raw ] of entries ) expect( work.storage.records.get( key ) ).toBe( raw );
		} finally { earlier.mockRestore(); confirm.mockRestore(); }
	} );
} );
