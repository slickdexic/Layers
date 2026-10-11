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
const copy = State.copyWorkingCopyValue;
const applicationError = { code: 'layers-working-copy-import-application-unavailable', message: 'Working-copy Import unavailable' };
const sessionError = { code: 'layers-working-copy-import-unavailable' };

async function make( options = {} ) {
	const surface = { id: 'target', kind: options.image ? 'image' : 'slide', label: 'Current name', canvas: { width: 100, height: 50, backgroundColor: 'white', extra: [ null, false, 0, '' ] },
		layers: options.populated ? [ { id: 'old', type: 'text', text: 'before' } ] : [], ...( options.populated ? { readingOrder: [ 'old' ] } : {} ),
		...( options.image ? { source: { fileTitle: 'File:Exact.png', sha1: 'pinned', timestamp: '20261001010101' } } : {} ) };
	const base = { schemaVersion: 1, metadata: { keep: [ null, false ] }, surfaces: [ surface, { ...copy( surface ), id: 'sibling' } ] };
	const sourceSurface = { ...copy( surface ), id: 'source', label: 'Current name', canvas: { width: 200, height: 120, backgroundColor: '#123456', extra: { keep: [ null, false ] } },
		layers: [ { id: 'one', type: 'text', text: 'first', extra: null }, { id: 'two', type: 'text', text: 'second' } ], readingOrder: [ 'two', 'one' ] };
	const sourceBundle = { revisionId: 42, snapshot: { schemaVersion: 1, surfaces: [ sourceSurface ] } };
	const hooks = { target: null, source: null }, calls = { target: 0, source: 0, allocate: 0 }, events = [];
	const targetReader = { read: jest.fn( async request => { calls.target++; events.push( 'target' ); if ( hooks.target ) { await hooks.target( request ); } return { revisionId: 12, snapshot: copy( base ) }; } ) };
	const sourceReader = { read: jest.fn( async request => { calls.source++; events.push( 'source' ); if ( hooks.source ) { await hooks.source( request ); } return copy( sourceBundle ); } ) };
	const publisher = { publish: jest.fn( () => { throw new Error( 'never publish' ); } ) }, adapter = new Adapter();
	const editor = { config: { isSlide: !options.image, imageUrl: 'exact-pin-url' }, updateStatus: jest.fn(),
		canvasManager: { selectedLayerIds: [], selectedLayerId: null, renderLayers: jest.fn(), redraw: jest.fn(),
			setBaseDimensions: jest.fn( function ( width, height ) { this.baseWidth = width; this.baseHeight = height; } ) }, layerPanel: { updateLayers: jest.fn(), updateSelection: jest.fn() } };
	editor.canvasManager.editor = editor; const store = new State( editor ); editor.stateManager = store;
	Object.defineProperty( editor, 'layers', { get: () => store.state.layers } );
	const history = new History( { editor, maxHistorySteps: 60 } ); editor.historyManager = history;
	const session = new Session( { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' }, { reader: targetReader, publisher, adapter } );
	const bridge = new Bridge( editor, session ); await bridge.load();
	const selection = new Selection( {}, editor.canvasManager ); editor.canvasManager.selectionManager = selection;
	if ( !options.disabled ) { history.enableWorkingCopyHistory( bridge ); }
	const source = new Source( { reader: sourceReader, adapter: new Adapter(), planner: Planner } );
	const request = mode => ( { source: { owner: 'Source Page', revisionId: 42, surfaceId: 'source' }, mode: mode || ( options.populated ? 'append' : 'empty' ), maxLayers: 30, allocateId: () => 'new-' + ++calls.allocate } );
	return { base, sourceBundle, sourceSurface, hooks, calls, events, targetReader, sourceReader, publisher, adapter, editor, store, history, session, bridge, selection, source, request };
}

function observe( ctx ) {
	const objects = [ ctx.session, ctx.session._snapshot, ctx.session._snapshot.surfaces, ctx.history, ctx.history.history, ctx.history.batchChanges,
		ctx.store, ctx.store.state, ctx.store.state.layers, ctx.store.state.selectedLayerIds, ctx.store.pendingOperations, ctx.store.lockingQueue,
		ctx.editor, ctx.editor.config, ctx.editor.canvasManager, ctx.editor.canvasManager.selectedLayerIds, ctx.selection, ctx.selection.selectedLayerIds,
		ctx.selection._selectionState, ctx.selection._selectionState && ctx.selection._selectionState.selectedLayerIds ];
	const observations = objects.filter( object => object && typeof object === 'object' ).map( object => State.observeWorkingCopyObject( object, false ) );
	for ( const member of ctx.session._snapshot.surfaces ) { observations.push( State.observeWorkingCopyObject( member ) ); }
	for ( const member of ctx.history.history ) { observations.push( State.observeWorkingCopyObject( member ) ); }
	for ( const member of ctx.store.state.layers ) { observations.push( State.observeWorkingCopyObject( member, false ) ); }
	return { check: () => observations.forEach( State.checkWorkingCopyObservation ), snapshot: copy( ctx.session._snapshot ) };
}
function selectionEquals( ctx, ids ) {
	expect( ctx.store.state.selectedLayerIds ).toEqual( ids ); expect( ctx.selection.selectedLayerIds ).toEqual( ids );
	expect( ctx.selection._selectionState.selectedLayerIds ).toEqual( ids ); expect( ctx.editor.canvasManager.selectedLayerIds ).toEqual( ids );
	expect( ctx.selection.lastSelectedId ).toBe( ids.at( -1 ) || null ); expect( ctx.selection._selectionState.lastSelectedId ).toBe( ids.at( -1 ) || null );
}
async function sessionHandle( ctx ) { return ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request() ); }

describe( 'D optional synchronous participant guard', () => {
	test( 'omission retains exact target/source arguments and ordering without mutation', async () => {
		const ctx = await make(), handle = await sessionHandle( ctx ), before = observe( ctx ); ctx.events.length = 0;
		expect( await ctx.session.revalidateWorkingCopyImport( handle ) ).toBeUndefined(); before.check();
		expect( ctx.events ).toEqual( [ 'target', 'source' ] ); expect( ctx.targetReader.read ).toHaveBeenLastCalledWith( { owner: 'Target Page', revisionId: 12 } );
		expect( ctx.sourceReader.read ).toHaveBeenLastCalledWith( { owner: 'Source Page', revisionId: 42 } ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
		ctx.session.releaseWorkingCopyImport( handle );
	} );
	test( 'D invokes one captured guard at all three exact synchronous boundaries', async () => {
		const ctx = await make(), original = ctx.adapter.toEditorState.bind( ctx.adapter );
		ctx.adapter.toEditorState = ( ...args ) => { const result = original( ...args ); if ( /revalidateWorkingCopyImport/.test( new Error().stack ) ) { ctx.events.push( 'copy' ); } return result; };
		const handle = await sessionHandle( ctx ), before = observe( ctx ); ctx.events.length = 0;
		const guard = jest.fn( () => { ctx.events.push( 'guard' ); } );
		await ctx.session.revalidateWorkingCopyImport( handle, guard ); before.check();
		expect( guard ).toHaveBeenCalledTimes( 3 ); expect( ctx.events ).toEqual( [ 'target', 'guard', 'copy', 'guard', 'source', 'guard' ] );
		expect( ctx.session.prepareWorkingCopyImportCommit( handle ) ).toBeTruthy();
	} );
	test.each( [ undefined, null, true, false, 1, 'guard', {}, [] ] )( 'explicit invalid guard %p refuses before reads or private readiness changes', async value => {
		const ctx = await make(), handle = await sessionHandle( ctx ); await ctx.session.revalidateWorkingCopyImport( handle );
		const before = observe( ctx ), counts = { ...ctx.calls };
		await expect( ctx.session.revalidateWorkingCopyImport( handle, value ) ).rejects.toMatchObject( sessionError ); before.check(); expect( ctx.calls ).toEqual( counts );
		const prepared = ctx.session.prepareWorkingCopyImportCommit( handle ); ctx.session.releasePreparedWorkingCopyImportCommit( prepared ); ctx.session.releaseWorkingCopyImport( handle );
	} );
	test.each( [ 'throw', 'number', 'null', 'promise', 'async', 'thenable' ] )( '%s callback refuses synchronously and never proceeds to source', async type => {
		const ctx = await make(), handle = await sessionHandle( ctx ), before = observe( ctx ), sourceReads = ctx.calls.source;
		const guards = { throw: () => { throw new Error( 'SECRET' ); }, number: () => 1, null: () => null, promise: () => Promise.resolve(), async: async () => {}, thenable: () => ( { then() {} } ) };
		await expect( ctx.session.revalidateWorkingCopyImport( handle, guards[ type ] ) ).rejects.toMatchObject( sessionError ); before.check(); expect( ctx.calls.source ).toBe( sourceReads );
		expect( () => ctx.session.prepareWorkingCopyImportCommit( handle ) ).toThrow();
		await ctx.session.revalidateWorkingCopyImport( handle ); ctx.session.releaseWorkingCopyImport( handle );
	} );
	test.each( [ 1, 2, 3 ] )( 'throw at boundary %i clears checking/ready without changing work', async stop => {
		const ctx = await make(), handle = await sessionHandle( ctx ), before = observe( ctx ), reads = ctx.calls.source; let boundary = 0;
		await expect( ctx.session.revalidateWorkingCopyImport( handle, () => { if ( ++boundary === stop ) { throw new Error( 'stop' ); } } ) ).rejects.toMatchObject( sessionError );
		before.check(); expect( ctx.calls.source ).toBe( reads + ( stop === 3 ? 1 : 0 ) ); expect( () => ctx.session.prepareWorkingCopyImportCommit( handle ) ).toThrow();
		await ctx.session.revalidateWorkingCopyImport( handle ); ctx.session.releaseWorkingCopyImport( handle );
	} );
	test( 'reentrant D invocation cannot clear the owning invocation checking flag', async () => {
		const ctx = await make(), handle = await sessionHandle( ctx ); let nested;
		await ctx.session.revalidateWorkingCopyImport( handle, () => { if ( !nested ) { nested = ctx.session.revalidateWorkingCopyImport( handle ).catch( error => error ); } } );
		expect( await nested ).toMatchObject( sessionError ); const prepared = ctx.session.prepareWorkingCopyImportCommit( handle ); ctx.session.releasePreparedWorkingCopyImportCommit( prepared );
	} );
	test( 'foreign, fabricated and released D handles refuse without reading', async () => {
		const ctx = await make(), other = await make(), handle = await sessionHandle( ctx ), before = observe( ctx ), counts = { ...ctx.calls };
		await expect( other.session.revalidateWorkingCopyImport( handle, () => {} ) ).rejects.toMatchObject( sessionError );
		await expect( ctx.session.revalidateWorkingCopyImport( Object.freeze( Object.create( null ) ), () => {} ) ).rejects.toMatchObject( sessionError );
		ctx.session.releaseWorkingCopyImport( handle ); await expect( ctx.session.revalidateWorkingCopyImport( handle, () => {} ) ).rejects.toMatchObject( sessionError );
		before.check(); expect( ctx.calls ).toEqual( counts );
	} );
} );

const mutations = {
	valid: ctx => { ctx.store.state.slideCanvasWidth = 333; ctx.store.state.layers.push( { id: 'newer', type: 'text', text: 'keep' } ); },
	invalid: ctx => { ctx.store.state.layers.push( { id: 'invalid', type: 'text', value: NaN } ); },
	undefined: ctx => { ctx.store.state.layers[ 0 ] = { id: 'newer', type: 'text', value: undefined }; },
	selection: ctx => { ctx.selection._selectionState.selectedLayerIds.push( 'newer' ); },
	mirror: ctx => { ctx.editor.canvasManager.selectedLayerIds.push( 'newer' ); },
	selectionIdentity: ctx => { ctx.editor.canvasManager.selectionManager = { selectedLayerIds: [ 'newer' ] }; },
	coreIdentity: ctx => { ctx.selection._selectionState = { selectedLayerIds: [ 'newer' ] }; },
	storeIdentity: ctx => { ctx.editor.stateManager = { state: { layers: [ 'newer' ] } }; },
	historyIdentity: ctx => { ctx.editor.historyManager = {}; },
	canvasIdentity: ctx => { ctx.editor.canvasManager = { selectedLayerIds: [ 'newer' ] }; },
	method: ctx => { ctx.session.revalidateWorkingCopyImport = () => Promise.resolve(); },
	sourceMethod: ctx => { ctx.source.inspect = () => ( {} ); },
	base: ctx => { ctx.session._savedJson = JSON.stringify( { ...ctx.base, newer: true } ); },
	name: ctx => { ctx.session._snapshot.surfaces[ 0 ].label = 'newer name'; },
	owner: ctx => { ctx.session._owner = 'New owner'; },
	revision: ctx => { ctx.session._revisionId = 99; },
	permission: ctx => { ctx.session._readOnly = true; },
	phase: ctx => { ctx.session._phase = 'saving'; },
	gesture: ctx => { ctx.selection.isDragging = true; },
	destroy: ctx => { ctx.store.destroy(); },
	queue: ctx => { ctx.store.pendingOperations.push( { key: 'layers', value: [ 'newer' ] } ); }
};

describe( 'actual Import remaining G matrix with D reuse', () => {
	test.each( [ [ 'source', false ], [ 'source', true ], [ 'adapter', false ], [ 'adapter', true ] ] )( 'last %s callback invalid=%s preserves newer complete work', async ( dependency, invalid ) => {
		const ctx = await make(); let latest, fired = false;
		const owner = dependency === 'source' ? ctx.source : ctx.adapter, key = dependency === 'source' ? 'inspect' : 'toEditorState', original = owner[ key ].bind( owner );
		owner[ key ] = ( ...args ) => { const result = original( ...args ); if ( !fired && /commitPreparedWorkingCopyImport/.test( new Error().stack ) ) {
			fired = true; ctx.store.state.slideCanvasWidth = 444;
			ctx.store.state.layers.push( { id: 'newer', type: 'text', value: invalid ? NaN : null } ); ctx.selection.selectedLayerIds.push( 'newer' ); latest = observe( ctx );
		} return result; };
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() );
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( applicationError ); expect( fired ).toBe( true ); latest.check(); ctx.bridge.releaseWorkingCopyImport( handle );
	} );
	test( 'prepared checkpoint data are detached and callback return cannot promote authority', async () => {
		const ctx = await make(), handle = await sessionHandle( ctx ); await ctx.session.revalidateWorkingCopyImport( handle );
		const before = observe( ctx ), prepared = ctx.session.prepareWorkingCopyImportCommit( handle );
		const preview = ctx.session.inspectPreparedWorkingCopyImportCommit( prepared ); preview.workingState.canvas.width = 888;
		expect( () => ctx.session.commitPreparedWorkingCopyImport( prepared, () => Promise.resolve() ) ).toThrow(); before.check();
		expect( ctx.session.inspectPreparedWorkingCopyImportCommit( prepared ).workingState.canvas.width ).toBe( 200 );
		const other = await make(); expect( () => other.session.commitPreparedWorkingCopyImport( prepared ) ).toThrow();
		ctx.session.releasePreparedWorkingCopyImportCommit( prepared ); expect( () => ctx.session.commitPreparedWorkingCopyImport( prepared ) ).toThrow(); ctx.session.releaseWorkingCopyImport( handle );
	} );
	test( 'listener destruction after commit retains truthful success and suppresses stale refresh', async () => {
		const ctx = await make(), handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() );
		ctx.store.subscribe( 'layers', () => ctx.store.destroy() ); const result = await ctx.bridge.applyWorkingCopyImport( handle );
		expect( result.importedLayerIds ).toHaveLength( 2 ); expect( ctx.session._snapshot.surfaces[ 0 ].layers ).toHaveLength( 2 ); expect( ctx.history.history ).toHaveLength( 2 );
		expect( result.diagnostics.length ).toBeGreaterThan( 0 ); expect( ctx.publisher.publish ).not.toHaveBeenCalled(); ctx.bridge.releaseWorkingCopyImport( handle );
	} );
	test.each( Object.keys( mutations ).flatMap( type => [ [ 'target', type ], [ 'source', type ], [ 'copy', type ] ] ) )( '%s boundary %s preserves complete newer participants', async ( stage, type ) => {
		const ctx = await make(); let latest, active = false;
		const original = ctx.adapter.toEditorState.bind( ctx.adapter );
		if ( stage === 'copy' ) { ctx.adapter.toEditorState = ( ...args ) => { const result = original( ...args ); if ( active && /revalidateWorkingCopyImport/.test( new Error().stack ) ) {
			active = false; mutations[ type ]( ctx ); latest = observe( ctx ); } return result; }; }
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ), sourceReads = ctx.calls.source;
		const change = () => { mutations[ type ]( ctx ); latest = observe( ctx ); };
		if ( stage === 'copy' ) { active = true; } else { ctx.hooks[ stage ] = change; }
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( applicationError ); expect( latest ).toBeDefined(); latest.check();
		if ( stage !== 'source' ) { expect( ctx.calls.source ).toBe( sourceReads ); }
		ctx.bridge.releaseWorkingCopyImport( handle ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test( 'actual successful Import invokes D once with three guards and commits every participant before notification', async () => {
		const ctx = await make( { populated: true } ), original = ctx.session.revalidateWorkingCopyImport.bind( ctx.session ); let invocations = 0, guards = 0;
		ctx.session.revalidateWorkingCopyImport = ( handle, guard ) => { invocations++; return original( handle, () => { guards++; guard(); } ); };
		ctx.store.set( 'slideCanvasWidth', 110 ); ctx.history.saveState( 'Before Import' ); const previous = copy( ctx.session._snapshot ), prior = ctx.history.history.slice();
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() );
		ctx.store.subscribe( 'layers', () => { expect( ctx.history.historyIndex ).toBe( 2 ); expect( ctx.history.history[ 2 ].description ).toBe( 'Import' );
			selectionEquals( ctx, ctx.history.history[ 2 ].importedLayerIds ); expect( ctx.session._snapshot.surfaces[ 0 ].layers ).toEqual( ctx.store.state.layers ); } );
		const result = await ctx.bridge.applyWorkingCopyImport( handle ); ctx.store.listeners = {};
		expect( invocations ).toBe( 1 ); expect( guards ).toBe( 3 ); selectionEquals( ctx, result.importedLayerIds ); expect( ctx.history.history.slice( 0, 2 ) ).toEqual( prior );
		expect( ctx.history.history[ 0 ] ).toBe( prior[ 0 ] ); expect( ctx.history.history[ 1 ] ).toBe( prior[ 1 ] ); expect( ctx.history.lastSaveHistoryIndex ).toBe( 0 );
		const imported = copy( ctx.session._snapshot ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( previous );
		expect( ctx.history.redo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( imported );
		ctx.store.set( 'layers', ctx.store.state.layers.map( layer => ( { ...layer, name: 'later' } ) ) ); ctx.history.saveState( 'Later' );
		expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( imported ); expect( ctx.history.redo() ).toBe( true );
		expect( ctx.session._revisionId ).toBe( 12 ); expect( ctx.session._savedJson ).toBe( JSON.stringify( ctx.base ) ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test.each( [ 'target', 'source', 'reupload' ] )( 'stale %s refuses without changing participants', async type => {
		const ctx = await make( { image: true } ), handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ), before = observe( ctx );
		if ( type === 'target' ) { ctx.base.surfaces[ 0 ].label = 'changed target'; }
		if ( type === 'source' ) { ctx.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'changed source'; }
		if ( type === 'reupload' ) { ctx.sourceBundle.snapshot.surfaces[ 0 ].source.sha1 = 'changed pin'; }
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( applicationError ); before.check(); ctx.bridge.releaseWorkingCopyImport( handle );
	} );
	test.each( [ 'disabled', 'pending', 'locked', 'lockingQueue', 'processing', 'timer', 'batch', 'destroyed', 'missingHistory', 'missingSelection', 'missingCore', 'gesture', 'transform', 'pdf', 'emptyBase', 'saving', 'reconcile' ] )( 'admission %s refuses unchanged before source reads', async type => {
		const ctx = await make( { disabled: type === 'disabled' } );
		const changes = { pending: () => { ctx.store.state.layers.push( { id: 'pending', type: 'text' } ); }, locked: () => { ctx.store.isLocked = true; },
			lockingQueue: () => { ctx.store.lockingQueue.push( {} ); }, processing: () => { ctx.store._isProcessingPending = true; }, timer: () => { ctx.store.lockTimeout = 4; },
			batch: () => { ctx.history.batchMode = true; }, destroyed: () => ctx.store.destroy(), missingHistory: () => { ctx.editor.historyManager = null; },
			missingSelection: () => { ctx.editor.canvasManager.selectionManager = null; }, missingCore: () => { ctx.selection._selectionState = null; }, gesture: () => { ctx.selection.isRotating = true; },
			transform: () => { ctx.editor.canvasManager.transformController = { isResizing: true }; }, pdf: () => { ctx.session._pdfContext = {}; }, emptyBase: () => { ctx.session._baseHasDrawings = false; },
			saving: () => { ctx.bridge.saving = true; }, reconcile: () => { ctx.bridge.reconciling = true; } };
		if ( changes[ type ] ) { changes[ type ](); } const before = observe( ctx ), sourceReads = ctx.calls.source;
		await expect( ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ) ).rejects.toMatchObject( applicationError ); before.check(); expect( ctx.calls.source ).toBe( sourceReads );
	} );
	test.each( [ 'snapshot', 'state', 'selection', 'core', 'canvas', 'history' ] )( 'non-writable %s refuses before any commit', async type => {
		const ctx = await make(), targets = { snapshot: [ ctx.session, '_snapshot' ], state: [ ctx.store.state, 'layers' ], selection: [ ctx.selection, 'selectedLayerIds' ],
			core: [ ctx.selection._selectionState, 'selectedLayerIds' ], canvas: [ ctx.editor.canvasManager, 'selectedLayerIds' ], history: [ ctx.history, 'history' ] };
		const [ object, key ] = targets[ type ]; Object.defineProperty( object, key, { writable: false } ); const before = observe( ctx );
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() );
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( applicationError ); before.check(); ctx.bridge.releaseWorkingCopyImport( handle );
	} );
	test( 'foreign/released/fabricated/consumed handles never consume another operation and disposal permits cleanup', async () => {
		const ctx = await make(), other = await make(), handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ), before = observe( ctx );
		await expect( other.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( applicationError ); expect( () => other.bridge.releaseWorkingCopyImport( handle ) ).toThrow();
		await expect( ctx.bridge.applyWorkingCopyImport( Object.freeze( Object.create( null ) ) ) ).rejects.toMatchObject( applicationError ); before.check();
		const result = await ctx.bridge.applyWorkingCopyImport( handle ); selectionEquals( ctx, result.importedLayerIds );
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( applicationError ); ctx.bridge.releaseWorkingCopyImport( handle );
		await expect( ctx.bridge.applyWorkingCopyImport( handle ) ).rejects.toMatchObject( applicationError );
		const cleanup = await other.bridge.prepareWorkingCopyImport( other.source, other.request() ); other.bridge.disposed = true; expect( () => other.bridge.releaseWorkingCopyImport( cleanup ) ).not.toThrow();
	} );
	test( 'concurrent application refuses without clearing active owner or consuming its second handle', async () => {
		const ctx = await make(), first = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ), second = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() );
		let continueRead, entered; const waiting = new Promise( resolve => { entered = resolve; } );
		ctx.hooks.target = () => { entered(); return new Promise( resolve => { continueRead = resolve; } ); };
		const application = ctx.bridge.applyWorkingCopyImport( first ); await waiting;
		await expect( ctx.bridge.applyWorkingCopyImport( second ) ).rejects.toMatchObject( applicationError );
		await expect( ctx.bridge.applyWorkingCopyImport( first ) ).rejects.toMatchObject( applicationError ); continueRead(); const result = await application;
		selectionEquals( ctx, result.importedLayerIds ); ctx.bridge.releaseWorkingCopyImport( second );
	} );
	test( 'source preparation callback cannot reenter Bridge', async () => {
		const ctx = await make(); let nested; ctx.hooks.source = () => { if ( !nested ) { nested = ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ).catch( error => error ); } };
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ); expect( await nested ).toMatchObject( applicationError );
		ctx.hooks.source = null; const result = await ctx.bridge.applyWorkingCopyImport( handle ); selectionEquals( ctx, result.importedLayerIds );
	} );
	test( 'successful Import truncates redo only then, retains capacity and saved marker', async () => {
		const ctx = await make(); ctx.history.maxHistorySteps = 3;
		ctx.store.set( 'slideCanvasWidth', 110 ); ctx.history.saveState( 'First' ); ctx.store.set( 'slideCanvasWidth', 120 ); ctx.history.saveState( 'Redo action' ); ctx.history.undo();
		const first = ctx.history.history[ 1 ], handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ); const result = await ctx.bridge.applyWorkingCopyImport( handle );
		expect( ctx.history.history ).toHaveLength( 3 ); expect( ctx.history.history[ 1 ] ).toBe( first ); expect( ctx.history.history[ 2 ].description ).toBe( 'Import' );
		expect( ctx.history.maxHistorySteps ).toBe( 3 ); expect( ctx.history.lastSaveHistoryIndex ).toBe( 0 ); selectionEquals( ctx, result.importedLayerIds );
	} );
	test.each( [ true, false ] )( 'reading-order presence %s and hidden/locked/group membership remain native', async hasOrder => {
		const ctx = await make(); if ( !hasOrder ) { delete ctx.sourceSurface.readingOrder; }
		ctx.sourceSurface.layers.push( { id: 'locked', type: 'text', locked: true }, { id: 'hidden', type: 'text', visible: false } );
		const handle = await ctx.bridge.prepareWorkingCopyImport( ctx.source, ctx.request() ), result = await ctx.bridge.applyWorkingCopyImport( handle );
		expect( Object.hasOwn( ctx.session._snapshot.surfaces[ 0 ], 'readingOrder' ) ).toBe( hasOrder );
		expect( ctx.store.state.layers.find( layer => layer.locked ).locked ).toBe( true ); expect( ctx.store.state.layers.find( layer => layer.visible === false ).visible ).toBe( false );
		selectionEquals( ctx, result.importedLayerIds.slice( 0, 2 ) );
	} );
} );