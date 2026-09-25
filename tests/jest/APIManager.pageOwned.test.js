'use strict';

const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const fixture = require( '../fixtures/revisions/slide-document-v1.json' );
require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );
require( '../../resources/ext.layers.editor/PageOwnedRevisionControl.js' );

describe( 'APIManager page-owned routing', () => {
	let APIManager, manager, editor, api;
	beforeAll( () => {
		window.Layers.Editor.APIErrorHandler = class {
			setEnableSaveButtonCallback() {}
			destroy() {}
		};
		window.Layers.Editor.ExportController = class {};
		require( '../../resources/ext.layers.editor/APIManager.js' );
		APIManager = window.Layers.Core.APIManager;
		require( '../../resources/ext.layers.editor/LayersEditor.js' );
	} );
	beforeEach( () => {
		const records = new Map();
		window.localStorage = {
			getItem: ( key ) => records.get( key ) ?? null,
			setItem: ( key, value ) => records.set( key, value ),
			key: ( index ) => Array.from( records.keys() )[ index ] ?? null,
			get length() { return records.size; }
		};
		mw.msg = jest.fn( ( key ) => key );
		mw.notify = jest.fn();
		api = {
			get: jest.fn().mockResolvedValue( { layersread: {
				revisionId: 12, snapshot: fixture, sourceGeometry: {}
			} } ),
			postWithToken: jest.fn().mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } )
		};
		mw.Api = jest.fn( () => api );
		editor = {
			config: { pageOwned: { owner: 'Owner', revisionId: 12, surfaceId: 'presentation', draftScope: { wiki: 'test', user: '1' } } },
			filename: 'Slide:Legacy-name-must-not-be-used',
			stateManager: new StateManager(),
			uiManager: { hideSpinner: jest.fn(), container: document.createElement( 'div' ) }
		};
		manager = new APIManager( editor );
	} );
	afterEach( () => {
		manager.destroy();
		editor.stateManager.destroy();
	} );

	it( 'uses exact read and page publication through the existing load/save entry points', async () => {
		await manager.loadLayers();
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersread', formatversion: 2, owner: 'Owner', revid: 12 } );
		editor.stateManager.set( 'slideCanvasWidth', 901 );
		const result = await manager.saveLayers();
		expect( result ).toMatchObject( { revisionId: 13, dirty: false } );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ] ).toMatchObject( {
			action: 'layerspublish', owner: 'Owner', baserevid: 12
		} );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ] ).not.toHaveProperty( 'filename' );
		expect( editor.stateManager.get( 'currentLayerSetId' ) ).not.toBe( 13 );
	} );

	it( 'mounts the revision check only after load and removes it on disposal', async () => {
		expect( editor.uiManager.container.children ).toHaveLength( 0 );
		await manager.loadLayers();
		const button = editor.uiManager.container.querySelector( '.layers-page-revision-check-button' );
		expect( button.textContent ).toBe( 'layers-page-revision-check-button' );
		expect( api.get ).toHaveBeenCalledTimes( 1 );
		const check = jest.spyOn( manager, 'checkPageOwnedRevision' ).mockResolvedValue( {
			phase: 'ready', revisionId: 12, dirty: false, editorStateValid: true, draftPersisted: true
		} );
		button.click();
		await Promise.resolve();
		expect( check ).toHaveBeenCalledTimes( 1 );
		expect( editor.uiManager.container.textContent ).toContain( 'layers-page-revision-check-matched' );
		manager.destroy();
		expect( editor.uiManager.container.children ).toHaveLength( 0 );
	} );

	it( 'never mounts revision controls for a historical read-only session', async () => {
		manager.destroy();
		editor.config.pageOwned.readOnly = true;
		manager = new APIManager( editor );
		await manager.loadLayers();
		expect( manager.pageOwnedDrafts ).toBeNull();
		expect( editor.uiManager.container.children ).toHaveLength( 0 );
	} );

	it( 'discovers the current owner revision, then authorizes an exact read without publishing', async () => {
		await manager.loadLayers();
		editor.stateManager.set( 'slideCanvasWidth', 901 );
		manager.pageOwnedBridge.session.blockPublication();
		api.get.mockResolvedValueOnce( { query: { pages: [ { revisions: [ { revid: 14 } ] } ] } } )
			.mockResolvedValueOnce( { layersread: { revisionId: 14, snapshot: fixture, sourceGeometry: {} } } );
		expect( await manager.checkPageOwnedRevision() ).toMatchObject( { revisionId: 14, dirty: true, draftPersisted: true } );
		expect( api.get.mock.calls[ 1 ][ 0 ] ).toEqual( {
			action: 'query', prop: 'revisions', titles: 'Owner', rvprop: 'ids', rvlimit: 1, formatversion: 2
		} );
		expect( api.get.mock.calls[ 2 ][ 0 ] ).toEqual( { action: 'layersread', formatversion: 2, owner: 'Owner', revid: 14 } );
		expect( editor.stateManager.get( 'slideCanvasWidth' ) ).toBe( 901 );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'retains edits made on the canvas while the exact reconciliation read is pending', async () => {
		await manager.loadLayers();
		let resolveRead, signalRead;
		const started = new Promise( ( done ) => { signalRead = done; } );
		api.get.mockResolvedValueOnce( { query: { pages: [ { revisions: [ { revid: 14 } ] } ] } } )
			.mockImplementationOnce( () => {
				signalRead();
				return new Promise( ( done ) => { resolveRead = done; } );
			} );
		const checking = manager.checkPageOwnedRevision();
		await started;
		editor.stateManager.set( 'slideCanvasWidth', 999 );
		resolveRead( { layersread: { revisionId: 14, snapshot: fixture, sourceGeometry: {} } } );
		expect( await checking ).toMatchObject( { dirty: true, revisionId: 14 } );
		expect( manager.pageOwnedBridge.session.getEditorState().canvas.width ).toBe( 999 );
		expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ {}, { query: { pages: [] } }, { query: { pages: [ { missing: true } ] } },
		{ query: { pages: [ { revisions: [ { revid: '14' } ] } ] } } ] )(
		'rejects malformed or unavailable current-revision discovery without an exact read', async ( response ) => {
			await manager.loadLayers();
			api.get.mockResolvedValueOnce( response );
			await expect( manager.checkPageOwnedRevision() ).rejects.toThrow( 'layers-revision-unavailable' );
			expect( api.get ).toHaveBeenCalledTimes( 2 );
			expect( api.postWithToken ).not.toHaveBeenCalled();
			expect( manager.pageOwnedBridge.session.getStatus().revisionId ).toBe( 12 );
		} );

	it( 'blocks legacy set/revision/buffered operations before any transport', async () => {
		await expect( manager.loadRevisionById( 5 ) ).rejects.toThrow( 'layers-editor-legacy-operation-denied' );
		await expect( manager.loadLayersBySetName( 'other' ) ).rejects.toThrow( 'layers-editor-legacy-operation-denied' );
		await expect( manager.savePageLayers( {} ) ).rejects.toThrow( 'layers-editor-legacy-operation-denied' );
		await expect( manager.deleteLayerSet( 'other' ) ).rejects.toThrow( 'layers-editor-legacy-operation-denied' );
		await expect( manager.renameLayerSet( 'a', 'b' ) ).rejects.toThrow( 'layers-editor-legacy-operation-denied' );
		expect( () => manager.buildSavePayload() ).toThrow( 'layers-editor-legacy-operation-denied' );
		manager.reloadRevisions();
		const rejected = jest.fn();
		manager.performSaveWithRetry( {}, 0, jest.fn(), rejected );
		expect( rejected ).toHaveBeenCalledTimes( 1 );
		expect( api.get ).not.toHaveBeenCalled();
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'does not fall back to a legacy read when the revision is unavailable', async () => {
		api.get.mockRejectedValue( { code: 'layers-revision-unavailable' } );
		await expect( manager.loadLayers() ).rejects.toMatchObject( { code: 'layers-revision-unavailable' } );
		expect( api.get ).toHaveBeenCalledTimes( 1 );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ true, false ] )( 'does not overwrite legacy IDs and allows leaving only a clean confirmed save (dirty=%s)', async ( dirty ) => {
		editor.apiManager = { saveLayers: jest.fn().mockResolvedValue( {
			revisionId: 13, dirty, editorStateValid: true
		} ) };
		editor.validationManager = { validateLayers: () => ( { isValid: true } ) };
		editor.uiManager.showSpinner = jest.fn();
		editor.stateManager.set( 'currentLayerSetId', 55 );
		const saved = await window.Layers.Core.Editor.prototype.saveCurrentPage.call( editor );
		expect( saved ).toBe( !dirty );
		expect( editor.stateManager.get( 'currentLayerSetId' ) ).toBe( 55 );
	} );

	it( 'does not clear editor data or auto-create a legacy set on failed page-owned initialization', async () => {
		editor.config.initialSetName = 'legacy';
		editor.config.autoCreate = true;
		editor.debugLog = jest.fn();
		editor.autoCreateLayerSet = jest.fn();
		editor.stateManager.set( 'layers', [ { id: 'retain' } ] );
		editor.apiManager = manager;
		api.get.mockRejectedValue( { code: 'layers-revision-unavailable' } );
		window.Layers.Core.Editor.prototype.loadInitialLayers.call( editor );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( editor.stateManager.get( 'layers' ) ).toEqual( [ { id: 'retain' } ] );
		expect( editor.autoCreateLayerSet ).not.toHaveBeenCalled();
		expect( api.get ).toHaveBeenCalledTimes( 1 );
	} );
} );
