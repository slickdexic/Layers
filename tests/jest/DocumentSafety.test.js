/** @jest-environment jsdom */

require( '../../resources/ext.layers.editor/LayersEditor.js' );
require( '../../resources/ext.layers.editor/PageBuffer.js' );
const { APIManager } = require( '../../resources/ext.layers.editor/APIManager.js' );
const Editor = window.Layers.Core.Editor;
const PageBuffer = window.Layers.Editor.PageBuffer;

function deferred() {
	let resolve, reject;
	const promise = new Promise( ( yes, no ) => { resolve = yes; reject = no; } );
	return { promise, resolve, reject };
}

function editor() {
	const inst = Object.create( Editor.prototype );
	const state = { layers: [], isDirty: false, currentSetName: 'A' };
	Object.assign( inst, {
		page: 1, pageCount: 5, filename: 'Test.pdf', config: {},
		pageBuffer: new PageBuffer(),
		stateManager: {
			get: key => state[ key ],
			set: ( key, value ) => { state[ key ] = value; }
		},
		uiManager: { destroy: jest.fn() },
		canvasManager: { renderLayers: jest.fn(), setBackgroundImageUrl: jest.fn(), setBaseDimensions: jest.fn() },
		buildSetSelector: jest.fn(), buildRevisionSelector: jest.fn(),
		refreshPageControls: jest.fn(), syncPageInUrl: jest.fn(),
		notifyUser: jest.fn(), errorLog: jest.fn(), debugLog: jest.fn(),
		getMessage: ( key, fallback ) => fallback,
		apiManager: { savePageLayers: jest.fn().mockResolvedValue( {} ) },
		saveCurrentPage: jest.fn( () => { state.isDirty = false; return Promise.resolve( true ); } )
	} );
	return inst;
}

function attachLoader( inst ) {
	const manager = Object.create( APIManager.prototype );
	const requests = [];
	Object.assign( manager, {
		editor: inst,
		api: { get: jest.fn( params => {
			const pending = deferred();
			requests.push( { ...pending, page: params.page } );
			return pending.promise;
		} ) },
		showSpinner: jest.fn(), hideSpinner: jest.fn(), getMessage: key => key,
		handleLoadError: jest.fn(),
		processLayersData: jest.fn( data => {
			inst.stateManager.set( 'layers', data.layersinfo.layers );
		} )
	} );
	inst.apiManager = manager;
	return requests;
}

describe( 'Document save and page isolation', () => {
	test( 'Save on close keeps failed pages open, then closes after a successful retry', async () => {
		const inst = editor();
		const held = { page: 2, setName: 'A', layers: [ { id: 'unsaved' } ] };
		inst.pageBuffer.stash( 2, held );
		inst.apiManager.savePageLayers.mockRejectedValueOnce( new Error( 'offline' ) );
		inst.dialogManager = { showSaveDiscardDialog: jest.fn().mockResolvedValue( 'save' ) };
		inst.cancel( false );
		await new Promise( resolve => setTimeout( resolve, 0 ) );
		expect( inst.uiManager.destroy ).not.toHaveBeenCalled();
		expect( inst.pageBuffer.get( 2 ) ).toBe( held );
		expect( inst.hasUnsavedChanges() ).toBe( true );
		inst.cancel( false );
		await new Promise( resolve => setTimeout( resolve, 0 ) );
		expect( inst.uiManager.destroy ).toHaveBeenCalledTimes( 1 );
		expect( inst.hasUnsavedChanges() ).toBe( false );
	} );

	test( 'save returns false for a partial document failure even if the current page succeeds', async () => {
		const inst = editor();
		inst.pageBuffer.stash( 2, { page: 2, layers: [] } );
		inst.apiManager.savePageLayers.mockRejectedValueOnce( new Error( 'denied' ) );
		await expect( inst.save() ).resolves.toBe( false );
		expect( inst.saveCurrentPage ).toHaveBeenCalled();
	} );

	test( 'a buffered round trip restores the exact set and background in the next save payload', async () => {
		const inst = editor();
		Object.entries( { isDirty: true, currentSetName: 'A', backgroundVisible: false,
			backgroundOpacity: 0, currentLayerSetId: 17, layers: [ { id: 'page1' } ] }
		).forEach( ( [ key, value ] ) => inst.stateManager.set( key, value ) );
		inst.apiManager.loadLayers = jest.fn().mockResolvedValue( {} );
		await inst.performPageNavigation( 2 );
		inst.stateManager.set( 'currentSetName', 'B' );
		inst.stateManager.set( 'backgroundVisible', true );
		inst.stateManager.set( 'backgroundOpacity', 1 );
		await inst.performPageNavigation( 1 );
		const payload = APIManager.prototype.buildSavePayload.call( { editor: inst } );
		expect( payload ).toMatchObject( { page: 1, setname: 'A' } );
		expect( JSON.parse( payload.data ) ).toMatchObject( {
			layers: [ { id: 'page1' } ], backgroundVisible: false, backgroundOpacity: 0
		} );
		expect( inst.stateManager.get( 'currentLayerSetId' ) ).toBe( 17 );
	} );

	test( 'a slow previous page cannot change layer state or the displayed raster', async () => {
		const inst = editor();
		const pending = attachLoader( inst );
		const second = inst.performPageNavigation( 2 );
		const third = inst.performPageNavigation( 3 );
		pending[ 1 ].resolve( { layersinfo: { layers: [ { id: 'page3' } ], imageUrl: '/3.png' } } );
		await third;
		pending[ 0 ].resolve( { layersinfo: { layers: [ { id: 'page2' } ], imageUrl: '/2.png' } } );
		await second;
		expect( inst.page ).toBe( 3 );
		expect( inst.imageUrl ).toBe( '/3.png' );
		expect( inst.stateManager.get( 'layers' ) ).toEqual( [ { id: 'page3' } ] );
		expect( inst.apiManager.processLayersData ).toHaveBeenCalledTimes( 1 );
	} );

	test.each( [ 'resolve', 'reject' ] )( 'returning to a buffered page ignores an old request %s', async outcome => {
		const inst = editor();
		inst.stateManager.set( 'isDirty', true );
		inst.stateManager.set( 'layers', [ { id: 'kept' } ] );
		const pending = attachLoader( inst );
		const second = inst.performPageNavigation( 2 );
		await inst.performPageNavigation( 1 );
		pending[ 0 ][ outcome ]( { layersinfo: { layers: [] } } );
		await second;
		expect( inst.page ).toBe( 1 );
		expect( inst.stateManager.get( 'layers' ) ).toEqual( [ { id: 'kept' } ] );
		expect( inst.stateManager.get( 'isDirty' ) ).toBe( true );
		expect( inst.stateManager.get( 'isLoading' ) ).toBe( false );
		expect( inst.apiManager.processLayersData ).not.toHaveBeenCalled();
		expect( inst.apiManager.handleLoadError ).not.toHaveBeenCalled();
	} );
} );
