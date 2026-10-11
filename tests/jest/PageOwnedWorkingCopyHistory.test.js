const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );

const clone = value => JSON.parse( JSON.stringify( value ) );

async function fixture() {
	const snapshot = { schemaVersion: 1, metadata: { retained: [ null, false, 0, '' ] }, surfaces: [ {
		id: 'target', kind: 'slide', label: 'Same', canvas: { width: 100, height: 50, backgroundColor: '#ffffff', extra: [ null, false ] }, layers: []
	}, { id: 'other', kind: 'image', label: 'Other', source: { fileTitle: 'File:Keep.png', sha1: 'keep-pin' }, canvas: { width: 10, height: 20 }, layers: [] } ] };
	const editor = { config: { isSlide: true }, updateStatus: jest.fn(),
		canvasManager: { setBaseDimensions: jest.fn(), renderLayers: jest.fn() }, layerPanel: { updateLayers: jest.fn() } };
	editor.canvasManager.editor = editor;
	editor.stateManager = new StateManager( editor );
	Object.defineProperty( editor, 'layers', { get: () => editor.stateManager.get( 'layers' ), configurable: true } );
	editor.historyManager = new HistoryManager( { editor, maxHistorySteps: 60 } );
	const session = new Session( { owner: 'TargetPage', pageId: 7, revisionId: 12, surfaceId: 'target' }, { adapter: new Adapter(),
		reader: { read: async () => ( { owner: 'TargetPage', pageId: 7, revisionId: 12, snapshot: clone( snapshot ) } ) },
		publisher: { publish: jest.fn( async () => ( { revisionId: 13 } ) ) } } );
	const bridge = new Bridge( editor, session );
	await bridge.load();
	return { editor, store: editor.stateManager, history: editor.historyManager, session, bridge, snapshot };
}

describe( 'opt-in working-copy history', () => {
	test( 'promotes a prepared Session checkpoint without any earlier capture', async () => {
		const { session } = await fixture();
		const state = session.getEditorState(); state.canvas.width = 120;
		const prepared = session.prepareWorkingCopyState( state );
		const result = session.commitPreparedWorkingCopyState( prepared );
		expect( session.inspectWorkingCopyCheckpoint( result.checkpoint ).canvas.width ).toBe( 120 );
		expect( result.dirty ).toBe( true );
		expect( () => session.commitPreparedWorkingCopyState( prepared ) ).toThrow( 'Working-copy restore unavailable' );
	} );

	test( 'adds writable owned keys and retains internal undefined without notifications during commit', async () => {
		const { store } = await fixture();
		delete store.state.baseWidth;
		store.state.unmentioned = undefined;
		const notify = jest.spyOn( store, 'notifyListeners' );
		const bag = store.state, prepared = store.prepareWorkingCopyPatch( { values: { baseWidth: 120 }, clear: [ 'backgroundOpacity' ] } );
		store.preflightWorkingCopyPatch( prepared ); store.commitWorkingCopyPatch( prepared );
		expect( store.state ).toBe( bag ); expect( notify ).not.toHaveBeenCalled();
		expect( Object.getOwnPropertyDescriptor( bag, 'baseWidth' ) ).toEqual( { value: 120, writable: true, enumerable: true, configurable: true } );
		expect( Object.hasOwn( bag, 'unmentioned' ) ).toBe( true ); expect( bag.backgroundOpacity ).toBeUndefined();
		store.notifyWorkingCopyPatch( prepared ); expect( notify ).toHaveBeenCalled();
	} );

	test( 'retains selection on ordinary recording and captures nested nulls', async () => {
		const { history, bridge, store, session } = await fixture();
		history.enableWorkingCopyHistory( bridge );
		store.set( 'layers', [ { id: 'one', type: 'text', text: 'Later', extra: null } ] );
		store.set( 'selectedLayerIds', [ 'one' ] ); store.set( 'slideCanvasWidth', 120 );
		history.saveState( 'Edit' );
		expect( store.state.selectedLayerIds ).toEqual( [ 'one' ] );
		expect( session.getEditorState().layers[ 0 ].extra ).toBeNull();
		expect( history.undo() ).toBe( true ); expect( store.state.slideCanvasWidth ).toBe( 100 );
		expect( history.redo() ).toBe( true ); expect( store.state.slideCanvasWidth ).toBe( 120 );
	} );

	test( 'refuses changed patches without queuing or destroying newer work', async () => {
		const { store } = await fixture();
		const prepared = store.prepareWorkingCopyPatch( { values: { isDirty: true }, clear: [] } );
		store.state.zoom = 4;
		expect( () => store.commitWorkingCopyPatch( prepared ) ).toThrow( 'Working-copy state unavailable' );
		expect( store.state.zoom ).toBe( 4 ); expect( store.state.isDirty ).toBe( false ); expect( store.pendingOperations ).toEqual( [] );
	} );

		test( 'refuses patch preparation after the existing StateManager destruction boundary', async () => {
			const { store } = await fixture();
			store.destroy();
			const before = Object.getOwnPropertyDescriptors( store.state ), version = store._layersVersion;
			expect( () => store.prepareWorkingCopyPatch( { values: { isDirty: true }, clear: [] } ) ).toThrow( 'Working-copy state unavailable' );
			expect( Object.getOwnPropertyDescriptors( store.state ) ).toEqual( before );
			expect( store._layersVersion ).toBe( version ); expect( store.pendingOperations ).toEqual( [] );
		} );

		test( 'refuses initial history activation after destruction of an empty loaded StateManager', async () => {
			const { store, history, bridge, session } = await fixture();
			store.destroy();
			const initial = history.history[ 0 ], before = clone( { state: store.state, draft: session.getDraft(), timeline: history.captureTimeline() } );
			expect( () => history.enableWorkingCopyHistory( bridge ) ).toThrow( 'Working-copy history unavailable' );
			expect( history.history[ 0 ] ).toBe( initial );
			expect( clone( { state: store.state, draft: session.getDraft(), timeline: history.captureTimeline() } ) ).toEqual( before );
		} );
} );