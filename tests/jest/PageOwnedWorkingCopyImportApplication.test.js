'use strict';
const Session = require( process.env.LAYERS_HISTORY_SESSION_SOURCE || '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( process.env.LAYERS_HISTORY_BRIDGE_SOURCE || '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const History = require( process.env.LAYERS_HISTORY_MANAGER_SOURCE || '../../resources/ext.layers.editor/HistoryManager.js' );
const State = require( '../../resources/ext.layers.editor/StateManager.js' );
require( '../../resources/ext.layers.editor/selection/SelectionState.js' );
const Selection = require( process.env.LAYERS_IMPORT_SELECTION_SOURCE || '../../resources/ext.layers.editor/SelectionManager.js' );
const Source = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Planner = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
const clone = value => State.copyWorkingCopyValue( value );

function surface( id, kind, populated ) {
	return { id, kind, label: 'Same', canvas: { width: 100, height: 50, backgroundColor: 'white', extra: [ null, false, 0, '' ] },
		...( kind === 'image' ? { source: { fileTitle: 'File:Exact.png', sha1: 'pin', timestamp: '20261001010101' } } : {} ),
		layers: populated ? [ { id: 'old', type: 'text', text: 'old' } ] : [], ...( populated ? { readingOrder: [ 'old' ] } : {} ) };
}

async function context( kind = 'slide', populated = false, enabled = true ) {
	const base = { schemaVersion: 1, metadata: { keep: [ null, false, 0, '' ] }, surfaces: [ surface( 'target', kind, populated ), surface( 'other', 'image', true ) ] };
	const sourceSurface = surface( 'source', kind, true );
	sourceSurface.canvas = { width: 200, height: 120, backgroundColor: '#123456', extra: { keep: [ null, false, 0, '' ] } };
	if ( kind === 'image' ) { sourceSurface.source.sha1 = 'older-version'; }
	sourceSurface.layers = [ { id: 'group', type: 'group', children: [ 'one', 'two' ] },
		{ id: 'one', type: 'textbox', parentGroup: 'group', text: 'first', extra: null, richText: [ { text: 'rich', style: { fontSize: 24 } } ], nested: [ null, false, 0, '' ] },
		{ id: 'two', type: 'image', parentGroup: 'group', src: 'data:image/png;base64,AAAA', originalWidth: 10, originalHeight: 12 } ];
	sourceSurface.readingOrder = [ 'two', 'one' ];
	const bundle = { revisionId: 42, snapshot: { schemaVersion: 1, surfaces: [ sourceSurface ] } };
	const hooks = { target: null, source: null }, counts = { target: 0, source: 0, allocate: 0 };
	const reader = { read: jest.fn( async () => { counts.target++; if ( hooks.target ) { await hooks.target(); } return { revisionId: 12, snapshot: clone( base ) }; } ) };
	const sourceReader = { read: jest.fn( async () => { counts.source++; if ( hooks.source ) { await hooks.source(); } return clone( bundle ); } ) };
	const publisher = { publish: jest.fn( () => { throw new Error( 'publication forbidden' ); } ) }, adapter = new Adapter();
	const editor = { config: { isSlide: kind === 'slide', imageUrl: 'exact-rendition' }, updateStatus: jest.fn(),
		canvasManager: { selectedLayerIds: [], selectedLayerId: null, redraw: jest.fn(), renderLayers: jest.fn(),
			setBaseDimensions: jest.fn( function ( width, height ) { this.baseWidth = width; this.baseHeight = height; } ) },
		layerPanel: { updateLayers: jest.fn(), updateSelection: jest.fn() } };
	editor.canvasManager.editor = editor; const store = new State( editor ); editor.stateManager = store;
	Object.defineProperty( editor, 'layers', { get: () => store.state.layers } ); const history = new History( { editor, maxHistorySteps: 60 } ); editor.historyManager = history;
	const session = new Session( { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' }, { reader, publisher, adapter } );
	const bridge = new Bridge( editor, session ); await bridge.load();
	const selection = new Selection( {}, editor.canvasManager ); editor.canvasManager.selectionManager = selection;
	if ( enabled ) { history.enableWorkingCopyHistory( bridge ); }
	const source = new Source( { reader: sourceReader, adapter: new Adapter(), planner: Planner } );
	const request = mode => ( { source: { owner: 'Source Page', revisionId: 42, surfaceId: 'source' }, mode: mode || ( populated ? 'append' : 'empty' ), maxLayers: 30, allocateId: () => 'fresh-' + ++counts.allocate } );
	return { base, bundle, hooks, counts, editor, store, history, session, bridge, selection, source, request, adapter, publisher };
}

function witness( ctx ) {
	const observations = [ State.observeWorkingCopyObject( ctx.store, false ), State.observeWorkingCopyObject( ctx.store.state ), State.observeWorkingCopyObject( ctx.store.pendingOperations ),
		State.observeWorkingCopyObject( ctx.store.lockingQueue ), State.observeWorkingCopyObject( ctx.session, false ), State.observeWorkingCopyObject( ctx.session._snapshot ),
		State.observeWorkingCopyObject( ctx.history, false ), State.observeWorkingCopyObject( ctx.history.history ), State.observeWorkingCopyObject( ctx.history.batchChanges ),
		State.observeWorkingCopyObject( ctx.selection, false ), State.observeWorkingCopyObject( ctx.selection._selectionState ), State.observeWorkingCopyObject( ctx.selection.selectedLayerIds ),
		State.observeWorkingCopyObject( ctx.editor.canvasManager, false ), State.observeWorkingCopyObject( ctx.editor.canvasManager.selectedLayerIds ), State.observeWorkingCopyObject( ctx.editor.config ) ];
	return { observations, snapshot: clone( ctx.session._snapshot ), timeline: clone( ctx.history.history ) };
}
function preserved( before ) { before.observations.forEach( State.checkWorkingCopyObservation ); }
function selectedTogether( ctx, ids ) {
	expect( ctx.store.state.selectedLayerIds ).toEqual( ids ); expect( ctx.selection.selectedLayerIds ).toEqual( ids );
	expect( ctx.selection._selectionState.getSelectedIds() ).toEqual( ids ); expect( ctx.editor.canvasManager.selectedLayerIds ).toEqual( ids );
	expect( ctx.selection.lastSelectedId ).toBe( ids.at( -1 ) || null ); expect( ctx.selection._selectionState.lastSelectedId ).toBe( ids.at( -1 ) || null );
}

describe( 'actual asynchronous editor Import application', () => {
	test.each( [ [ 'slide', false, 'empty' ], [ 'slide', true, 'append' ], [ 'slide', true, 'replace' ], [ 'image', true, 'append' ], [ 'image', true, 'replace' ] ] )( '%s %s %s keeps prior and later actions with complete native selection', async ( kind, populated, mode ) => {
		const ctx = await context( kind, populated ); ctx.store.set( 'backgroundOpacity', 0.5 ); ctx.history.saveState( 'Before Import' );
		const before = witness( ctx ), handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request( mode ) ); preserved( before );
		const preview = ctx.bridge.inspectWorkingCopyImport( handle ); preview.candidateSnapshot.surfaces[ 0 ].label = 'forged preview'; preserved( before );
		let observed = false; ctx.store.subscribe( 'layers', () => { observed = true; expect( ctx.history.historyIndex ).toBe( 2 ); expect( ctx.session._snapshot.surfaces[ 0 ].layers ).toEqual( ctx.store.state.layers ); selectedTogether( ctx, ctx.history.history[ 2 ].importedLayerIds ); } );
		const result = await ctx.bridge.applyWorkingCopyImport( handle ); ctx.store.listeners = {};
		expect( observed ).toBe( true ); expect( ctx.history.history ).toHaveLength( 3 ); expect( ctx.history.lastSaveHistoryIndex ).toBe( 0 ); selectedTogether( ctx, result.importedLayerIds );
		expect( ctx.store.state.layers.find( layer => layer.type === 'textbox' ).nested ).toEqual( [ null, false, 0, '' ] ); expect( ctx.store.state.layers.find( layer => layer.type === 'textbox' ).extra ).toBeNull();
		expect( ctx.session._snapshot.metadata ).toEqual( ctx.base.metadata ); expect( ctx.session._snapshot.surfaces[ 1 ] ).toEqual( ctx.base.surfaces[ 1 ] );
		expect( ctx.editor.canvasManager.baseWidth ).toBe( populated ? 100 : 200 ); expect( result.differentFileVersion ).toBe( kind === 'image' );
		const imported = clone( ctx.session._snapshot ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( before.snapshot );
		expect( ctx.history.redo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( imported );
		ctx.store.set( 'layers', ctx.store.state.layers.map( layer => ( { ...layer, name: 'later' } ) ) ); ctx.history.saveState( 'After Import' );
		expect( ctx.history.history ).toHaveLength( 4 ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( imported );
		expect( ctx.history.redo() ).toBe( true ); expect( ctx.publisher.publish ).not.toHaveBeenCalled(); expect( ctx.session._revisionId ).toBe( 12 ); expect( ctx.session._savedJson ).toBe( JSON.stringify( ctx.base ) );
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-application-unavailable' } ); ctx.bridge.releaseWorkingCopyImport( handle );
	} );
	test( 'cancel has no reads, allocation or participant writes', async () => {
		const ctx = await context(), before = witness( ctx ), counts = { ...ctx.counts };
		expect( await ctx.bridge.prepareWorkingCopyImport( null, { mode: 'cancel' } ) ).toBeNull(); expect( await ctx.bridge.applyWorkingCopyImport( null ) ).toBeNull();
		preserved( before ); expect( ctx.counts ).toEqual( counts ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test.each( [ 'target', 'source' ] )( '%s await preserves newer complete valid work', async stage => {
		const ctx = await context(), handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ); let newer;
		ctx.hooks[ stage ] = () => { ctx.store.set( 'slideCanvasWidth', 333 ); ctx.selection._selectionState.setSelectedIds( [ 'newer' ], false ); newer = witness( ctx ); };
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-application-unavailable' } );
		expect( ctx.store.state.slideCanvasWidth ).toBe( 333 ); preserved( newer ); ctx.bridge.releaseWorkingCopyImport( handle ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test.each( [ 'target', 'source' ] )( '%s await preserves invalid editor work', async stage => {
		const ctx = await context(), handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ); let newer;
		ctx.hooks[ stage ] = () => { ctx.store.state.layers.push( { id: 'bad', type: 'text', value: NaN } ); newer = witness( ctx ); };
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toThrow( 'Working-copy Import unavailable' ); preserved( newer ); ctx.bridge.releaseWorkingCopyImport( handle );
	} );
	test.each( [ 'source', 'adapter' ] )( 'last %s callback preserves newer work before any commit', async stage => {
		const ctx = await context(); let fired = false, newer;
		const owner = stage === 'source' ? ctx.source : ctx.adapter, key = stage === 'source' ? 'inspect' : 'toEditorState', original = owner[ key ].bind( owner );
		owner[ key ] = ( ...args ) => { const result = original( ...args ); if ( !fired && /commitPreparedWorkingCopyImport/.test( new Error().stack ) ) {
			fired = true; ctx.store.state.slideCanvasWidth = 444; ctx.selection.selectedLayerIds.push( 'newer' ); newer = witness( ctx ); } return result; };
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() );
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-application-unavailable' } );
		expect( fired ).toBe( true ); expect( ctx.store.state.slideCanvasWidth ).toBe( 444 ); preserved( newer ); ctx.bridge.releaseWorkingCopyImport( handle );
	} );
	test.each( [ 'state', 'native', 'inPlace' ] )( 'newer %s selection and geometry after commit remain current', async type => {
		const ctx = await context(); ctx.store.subscribe( 'layers', () => { ctx.store.state.slideCanvasWidth = 777; ctx.store.state.layers = [ { id: 'newer', type: 'text' } ];
			if ( type === 'state' ) { ctx.store.state.selectedLayerIds = [ 'newer' ]; }
			else if ( type === 'native' ) { ctx.selection._selectionState.setSelectedIds( [ 'newer' ] ); }
			else { ctx.selection.selectedLayerIds.splice( 0, ctx.selection.selectedLayerIds.length, 'newer' ); }
		} );
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ), result = await ctx.bridge.applyWorkingCopyImport( handle );
		expect( result.importedLayerIds ).toHaveLength( 3 ); selectedTogether( ctx, [ 'newer' ] ); expect( ctx.store.state.slideCanvasWidth ).toBe( 777 );
		expect( ctx.editor.canvasManager.baseWidth ).toBe( 777 ); expect( ctx.editor.canvasManager.renderLayers ).toHaveBeenLastCalledWith( [ { id: 'newer', type: 'text' } ] );
	} );
	test.each( [ 'render', 'listener', 'cleanup' ] )( '%s failure after commit returns truthful success', async type => {
		const ctx = await context(); if ( type === 'render' ) { ctx.editor.canvasManager.renderLayers = () => { throw new Error( 'render' ); }; }
		if ( type === 'listener' ) { ctx.store.subscribe( 'layers', () => { throw new Error( 'listener' ); } ); }
		if ( type === 'cleanup' ) { ctx.source.release = () => { throw new Error( 'cleanup' ); }; }
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ), result = await ctx.bridge.applyWorkingCopyImport( handle );
		expect( ctx.history.history ).toHaveLength( 2 ); expect( ctx.store.state.layers ).toHaveLength( 3 ); selectedTogether( ctx, result.importedLayerIds );
		if ( type === 'listener' ) { expect( mw.log.error ).toHaveBeenCalledWith( 'State listener error:', 'listener' ); }
		else { expect( result.diagnostics.length ).toBeGreaterThan( 0 ); }
		expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
} );