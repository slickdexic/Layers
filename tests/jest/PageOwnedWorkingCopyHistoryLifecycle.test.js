'use strict';

const Session = require( process.env.LAYERS_HISTORY_SESSION_SOURCE || '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( process.env.LAYERS_HISTORY_BRIDGE_SOURCE || '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const StateManager = require( process.env.LAYERS_HISTORY_STATE_SOURCE || '../../resources/ext.layers.editor/StateManager.js' );
const HistoryManager = require( process.env.LAYERS_HISTORY_MANAGER_SOURCE || '../../resources/ext.layers.editor/HistoryManager.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Source = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
const Planner = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
const clone = value => JSON.parse( JSON.stringify( value ) );
const finite = value => StateManager.copyWorkingCopyValue( value );

function surface( id, kind, populated = true ) {
	return { id, kind, label: 'Same', canvas: { width: 100, height: 50, backgroundColor: 'white', extra: [ null, false, 0, '' ] },
		...( kind === 'image' ? { source: { fileTitle: 'File:Exact.png', sha1: 'exact-pin', timestamp: '20261001010101' } } : {} ),
		layers: populated ? [ { id: 'old', type: 'text', text: 'old', extra: null } ] : [],
		...( populated ? { readingOrder: [ 'old' ] } : {} ) };
}

async function context( kind = 'slide', populated = true, enable = true ) {
	const base = { schemaVersion: 1, metadata: { keep: [ null, false, 0, '' ] }, surfaces: [ surface( 'target', kind, populated ), surface( 'other', 'image' ) ] };
	const adapter = new Adapter(), publisher = { publish: jest.fn( async () => ( { revisionId: 13 } ) ) };
	const session = new Session( { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' },
		{ adapter, reader: { read: async () => ( { revisionId: 12, snapshot: clone( base ) } ) }, publisher } );
	const editor = { config: { isSlide: kind === 'slide', imageUrl: 'exact-pinned-rendition' }, updateStatus: jest.fn(), layerPanel: { updateLayers: jest.fn() },
		canvasManager: { setBaseDimensions: jest.fn( function ( width, height ) { this.baseWidth = width; this.baseHeight = height; } ), renderLayers: jest.fn() } };
	const store = new StateManager( editor ); editor.stateManager = store; editor.canvasManager.editor = editor;
	Object.defineProperty( editor, 'layers', { get: () => store.state.layers, configurable: true } );
	const history = new HistoryManager( { editor, maxHistorySteps: 60 } ); editor.historyManager = history;
	const bridge = new Bridge( editor, session ); await bridge.load();
	if ( enable ) { history.enableWorkingCopyHistory( bridge ); }
	return { base, adapter, publisher, session, editor, store, history, bridge };
}

function witness( ctx ) {
	return { snapshot: ctx.session._snapshot, snapshotData: finite( ctx.session._snapshot ), saved: ctx.session._savedJson,
		phase: ctx.session._phase, revision: ctx.session._revisionId, history: ctx.history.history, timeline: finite( ctx.history.history ),
		index: ctx.history.historyIndex, marker: ctx.history.lastSaveHistoryIndex, bag: ctx.store.state,
		state: StateManager.observeWorkingCopyObject( ctx.store.state ), version: ctx.store._layersVersion,
		pending: ctx.store.pendingOperations.slice(), batch: ctx.history.batchMode, changes: ctx.history.batchChanges };
}
function preserved( ctx, before ) {
	expect( ctx.session._snapshot ).toBe( before.snapshot ); expect( ctx.session._snapshot ).toEqual( before.snapshotData );
	expect( ctx.session._savedJson ).toBe( before.saved ); expect( ctx.session._phase ).toBe( before.phase ); expect( ctx.session._revisionId ).toBe( before.revision );
	expect( ctx.history.history ).toBe( before.history ); expect( ctx.history.history ).toEqual( before.timeline );
	expect( ctx.history.historyIndex ).toBe( before.index ); expect( ctx.history.lastSaveHistoryIndex ).toBe( before.marker );
	expect( ctx.store.state ).toBe( before.bag ); StateManager.checkWorkingCopyObservation( before.state );
	expect( ctx.store._layersVersion ).toBe( before.version ); expect( ctx.store.pendingOperations ).toEqual( before.pending );
	expect( ctx.history.batchMode ).toBe( before.batch ); expect( ctx.history.batchChanges ).toBe( before.changes );
}
async function importFixture( ctx, mode ) {
	const selected = surface( 'source', ctx.bridge.isSlide ? 'slide' : 'image' );
	selected.canvas = { width: 240, height: 160, backgroundColor: '#123456', extra: { retained: [ null, false, 0, '' ] } };
	selected.layers = [ { id: 'group', type: 'group', children: [ 'text', 'image' ] },
		{ id: 'text', type: 'textbox', parentGroup: 'group', text: 'imported', extra: null, richText: [ { text: 'rich', style: { fontSize: 24 } } ], nested: [ null, false, 0, '' ] },
		{ id: 'image', type: 'image', parentGroup: 'group', src: 'data:image/png;base64,AAAA', originalWidth: 12, originalHeight: 13 } ];
	selected.readingOrder = [ 'image', 'text' ];
	const source = new Source( { reader: { read: async () => ( { revisionId: 42, snapshot: { schemaVersion: 1, surfaces: [ clone( selected ) ] } } ) }, adapter: new Adapter(), planner: Planner } );
	let sequence = 0;
	const handle = await ctx.session.prepareWorkingCopyImport( source, { source: { owner: 'Source Page', revisionId: 42, surfaceId: 'source' },
		mode, maxLayers: 30, allocateId: () => 'fresh-' + ++sequence } );
	await ctx.session.revalidateWorkingCopyImport( handle ); const result = ctx.session.commitWorkingCopyImport( handle );
	ctx.bridge._applyState( result.editorState, false );
	ctx.history.saveState( 'Import' );
	return finite( ctx.session._snapshot );
}
function lastCallback( ctx, mutation ) {
	const original = ctx.adapter.toEditorState.bind( ctx.adapter ); let fired = false, newer;
	ctx.adapter.toEditorState = ( ...args ) => {
		const result = original( ...args );
		const stack = new Error().stack;
		if ( !fired && /restoreResult/.test( stack ) && /commit(?:WorkingCopyRestore|PreparedWorkingCopyState)/.test( stack ) ) {
			fired = true; mutation( ctx ); newer = witness( ctx );
		}
		return result;
	};
	return () => { expect( fired ).toBe( true ); preserved( ctx, newer ); };
}

describe( 'working-copy lifecycle and full-state history', () => {
	test.each( [ false, true ] )( 'destruction is irreversible for populated=%s and cleanup remains usable', async populated => {
		const ctx = await context( 'slide', populated );
		const patch = ctx.store.prepareWorkingCopyPatch( { values: { isDirty: true }, clear: [] } );
		const commit = ctx.store.prepareWorkingCopyPatchCommit( patch );
		const display = ctx.bridge.prepareWorkingCopyDisplay( ctx.session.getEditorState(), true );
		ctx.store.destroy(); ctx.store.destroy(); ctx.store.reset(); ctx.store.isDestroyed = false;
		const before = witness( ctx );
		expect( () => ctx.store.prepareWorkingCopyPatch( { values: { isDirty: true }, clear: [] } ) ).toThrow( 'Working-copy state unavailable' );
		expect( () => ctx.store.preflightWorkingCopyPatch( patch ) ).toThrow(); expect( () => ctx.store.commitWorkingCopyPatch( patch ) ).toThrow();
		expect( () => commit.preflight() ).toThrow(); expect( () => commit.commit() ).toThrow();
		expect( () => ctx.bridge.prepareWorkingCopyDisplay( ctx.session.getEditorState(), true ) ).toThrow(); expect( () => ctx.bridge.commitWorkingCopyDisplay( display ) ).toThrow();
		expect( ctx.history.undo() ).toBe( false ); preserved( ctx, before );
		ctx.store.releaseWorkingCopyPatch( patch ); ctx.bridge.releaseWorkingCopyDisplay( display );
	} );
	test( 'cleanup failure marks lifetime before reset throws', async () => {
		const ctx = await context(); ctx.store.reset = () => { throw new Error( 'cleanup failed' ); };
		expect( () => ctx.store.destroy() ).toThrow( 'cleanup failed' ); expect( ctx.store.isWorkingCopyAlive() ).toBe( false );
		expect( () => ctx.history.saveState( 'refused' ) ).toThrow( 'Working-copy history unavailable' ); expect( ctx.store.pendingOperations ).toEqual( [] );
	} );
	test.each( [ [ 'slide', 'empty' ], [ 'image', 'append' ], [ 'image', 'replace' ], [ 'slide', 'append' ], [ 'slide', 'replace' ] ] )( '%s %s Import retains ordinary actions before and after', async ( kind, mode ) => {
		const ctx = await context( kind, mode !== 'empty' );
		ctx.store.set( 'backgroundOpacity', 0.5 ); ctx.history.saveState( 'Before Import' ); const before = finite( ctx.session._snapshot );
		const imported = await importFixture( ctx, mode );
		expect( ctx.history.history ).toHaveLength( 3 ); expect( ctx.history.lastSaveHistoryIndex ).toBe( 0 );
		expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( before );
		expect( ctx.history.redo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( imported );
		expect( ctx.editor.canvasManager.baseWidth ).toBe( mode === 'empty' ? 240 : 100 );
		const text = ctx.store.state.layers.find( layer => layer.type === 'textbox' ); expect( text.extra ).toBeNull(); expect( text.nested ).toEqual( [ null, false, 0, '' ] );
		ctx.store.set( 'layers', ctx.store.state.layers.map( layer => layer.type === 'textbox' ? { ...layer, text: 'later' } : layer ) ); ctx.history.saveState( 'Later edit' );
		expect( ctx.history.history ).toHaveLength( 4 ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot ).toEqual( imported );
		expect( ctx.history.redo() ).toBe( true ); expect( ctx.store.state.layers.find( layer => layer.type === 'textbox' ).text ).toBe( 'later' );
		expect( ctx.session._snapshot.metadata ).toEqual( ctx.base.metadata ); expect( ctx.session._snapshot.surfaces[ 1 ] ).toEqual( ctx.base.surfaces[ 1 ] ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test( '55 steps, branch removal, saved marker, cap and compression retain owned entries', async () => {
		const ctx = await context();
		for ( let step = 1; step <= 55; step++ ) { ctx.store.set( 'slideCanvasWidth', 100 + step ); ctx.history.saveState( 'step ' + step ); }
		expect( ctx.history.history ).toHaveLength( 56 ); expect( ctx.history.revertTo( 20 ) ).toBe( true ); expect( ctx.store.state.slideCanvasWidth ).toBe( 120 );
		ctx.history.markAsSaved(); ctx.store.set( 'slideCanvasWidth', 200 ); ctx.history.saveState( 'branch' ); expect( ctx.history.history ).toHaveLength( 22 ); expect( ctx.history.canRedo() ).toBe( false );
		ctx.history.setMaxHistorySteps( 10 ); expect( ctx.history.history ).toHaveLength( 10 ); expect( ctx.history.lastSaveHistoryIndex ).toBe( 8 );
		ctx.history.compressHistory(); expect( ctx.history.history ).toHaveLength( 5 ); expect( ctx.history.lastSaveHistoryIndex ).toBe( 3 );
		expect( ctx.history.undo() ).toBe( true ); expect( ctx.store.state.slideCanvasWidth ).toBe( 120 );
		ctx.history.clearHistory(); expect( ctx.history.history ).toEqual( [] ); expect( ctx.history.lastSaveHistoryIndex ).toBe( -1 );
		ctx.history.saveState( 'after clear' ); expect( ctx.history.history ).toHaveLength( 1 ); ctx.history.destroy(); expect( ctx.history.undo() ).toBe( false );
	} );
	test.each( [ 'cancel', 'end' ] )( 'batch %s captures complete actual start with one final step', async action => {
		const ctx = await context(); ctx.store.set( 'slideCanvasWidth', 110 ); ctx.history.saveState( 'before' );
		ctx.store.set( 'slideCanvasWidth', 115 ); const timeline = ctx.history.captureTimeline();
		ctx.history.startBatch( 'batch' ); ctx.store.set( 'slideCanvasWidth', 130 ); ctx.history.saveState( 'first' ); ctx.store.set( 'layers', [] ); ctx.history.saveState( 'delete' );
		expect( ctx.history.history ).toHaveLength( 2 ); expect( ctx.history.batchChanges ).toHaveLength( 2 ); expect( ctx.history.batchOperations ).toBe( ctx.history.batchChanges );
		if ( action === 'cancel' ) { expect( ctx.history.cancelBatch() ).toBe( true ); expect( ctx.store.state.slideCanvasWidth ).toBe( 115 ); expect( ctx.store.state.layers ).toHaveLength( 1 ); expect( ctx.history.captureTimeline() ).toEqual( timeline ); }
		else { ctx.history.endBatch(); expect( ctx.history.history ).toHaveLength( 3 ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.store.state.slideCanvasWidth ).toBe( 110 ); }
		expect( ctx.history.batchMode ).toBe( false ); expect( ctx.history.batchOperations ).toBe( ctx.history.batchChanges );
	} );
	test( 'timeline previews remain detached, observational while locked, and private authority survives owned copies only', async () => {
		const ctx = await context(); ctx.store.set( 'slideCanvasWidth', 120 ); ctx.history.saveState( 'resize' );
		ctx.store.isLocked = true; const before = witness( ctx ), copy = ctx.history.captureTimeline(); preserved( ctx, before ); ctx.store.isLocked = false;
		const second = ctx.history.preflightTimeline( copy ); ctx.history.restoreTimeline( second ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.store.state.slideCanvasWidth ).toBe( 100 );
		expect( () => ctx.history.restoreTimeline( clone( copy ) ) ).toThrow(); copy.history[ 0 ].layers[ 0 ].text = 'forged'; expect( () => ctx.history.restoreTimeline( copy ) ).toThrow();
		const foreign = await context(); expect( () => foreign.history.restoreTimeline( second ) ).toThrow();
	} );
	test( 'whole live canvas/order/name is dirty and successful save advances base without invalidating checkpoints', async () => {
		const ctx = await context(); expect( ctx.history.hasUnsavedChanges() ).toBe( false );
		ctx.store.set( 'slideCanvasWidth', 120 ); expect( ctx.history.hasUnsavedChanges() ).toBe( true ); ctx.history.saveState( 'resize' );
		await ctx.session.save( 'Mocked save' ); ctx.history.markAsSaved(); expect( ctx.history.hasUnsavedChanges() ).toBe( false );
		expect( ctx.history.undo() ).toBe( true ); expect( ctx.history.hasUnsavedChanges() ).toBe( true ); expect( ctx.session._revisionId ).toBe( 13 );
		expect( ctx.history.redo() ).toBe( true ); expect( ctx.history.hasUnsavedChanges() ).toBe( false );
		ctx.session._snapshot.surfaces[ 0 ].label = 'Renamed'; expect( ctx.history.hasUnsavedChanges() ).toBe( true );
	} );
	test( 'ordinary delete removes only actually removed reading references and never invents order', async () => {
		const ctx = await context(); ctx.store.set( 'layers', [ { id: 'new', type: 'text', text: 'new' } ] ); ctx.history.saveState( 'replace locally' );
		expect( ctx.session._snapshot.surfaces[ 0 ].readingOrder ).toEqual( [] ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot.surfaces[ 0 ].readingOrder ).toEqual( [ 'old' ] );
		const empty = await context( 'slide', false ); empty.store.set( 'layers', [ { id: 'new', type: 'text' } ] ); empty.history.saveState( 'new' ); expect( Object.hasOwn( empty.session._snapshot.surfaces[ 0 ], 'readingOrder' ) ).toBe( false );
	} );
	test.each( [ 'valid', 'invalid', 'history', 'selection', 'destroy' ] )( 'last dependency callback %s work is refused before any combined write', async type => {
		const ctx = await context(); ctx.store.set( 'slideCanvasWidth', 120 ); ctx.history.saveState( 'resize' );
		const mutations = { valid: value => { value.store.state.slideCanvasWidth = 170; }, invalid: value => { value.store.state.slideCanvasWidth = NaN; },
			history: value => { value.history.lastSaveHistoryIndex = 1; value.history.history[ 0 ].description = 'newer'; },
			selection: value => { value.store.state.selectedLayerIds.push( 'newer' ); }, destroy: value => value.store.destroy() };
		const check = lastCallback( ctx, mutations[ type ] ); const outcome = ctx.history.undo();
		if ( type === 'valid' ) { expect( ctx.store.state.slideCanvasWidth ).toBe( 170 ); }
		check(); expect( outcome ).toBe( false );
	} );
	test( 'post-commit newer listener values are used for dimensions and render without reassignment', async () => {
		const ctx = await context(); ctx.store.set( 'slideCanvasWidth', 120 ); ctx.history.saveState( 'resize' );
		ctx.store.subscribe( 'layers', () => { ctx.store.state.slideCanvasWidth = 175; ctx.store.state.layers = [ { id: 'newer', type: 'text' } ]; ctx.store.state.selectedLayerIds = [ 'newer' ]; } );
		expect( ctx.history.undo() ).toBe( true ); expect( ctx.history.historyIndex ).toBe( 0 ); expect( ctx.session._snapshot.surfaces[ 0 ].canvas.width ).toBe( 100 );
		expect( ctx.store.state.slideCanvasWidth ).toBe( 175 ); expect( ctx.editor.canvasManager.baseWidth ).toBe( 175 ); expect( ctx.editor.canvasManager.renderLayers ).toHaveBeenLastCalledWith( [ { id: 'newer', type: 'text' } ] );
		expect( ctx.store.state.selectedLayerIds ).toEqual( [ 'newer' ] );
	} );
	test.each( [ 'bag', 'layers', 'snapshot', 'root', 'sibling', 'order', 'pin', 'phase', 'readOnly', 'base', 'revision', 'owner', 'bridge', 'imageUrl',
		'pending', 'locking', 'lock', 'method', 'descriptor', 'historyArray', 'entry', 'batch', 'selectionController', 'destroyEqual' ] )( 'late %s mutation preserves all newer participant work', async type => {
		const ctx = await context( 'image' ); ctx.store.set( 'backgroundOpacity', 0.5 ); ctx.history.saveState( 'ordinary' );
		ctx.editor.canvasManager.selectionManager = { selectedIds: [ 'old' ] };
		const mutate = {
			bag: value => { value.store.state = { ...value.store.state }; }, layers: value => { value.store.state.layers = finite( value.store.state.layers ); },
			snapshot: value => { value.session._snapshot = finite( value.session._snapshot ); }, root: value => { value.session._snapshot.metadata.keep.push( 'newer' ); },
			sibling: value => { value.session._snapshot.surfaces[ 1 ].label = 'newer'; }, order: value => { value.session._snapshot.surfaces[ 0 ].readingOrder = []; },
			pin: value => { value.session._snapshot.surfaces[ 0 ].source.sha1 = 'newer-pin'; }, phase: value => { value.session._phase = 'saving'; },
			readOnly: value => { value.session._readOnly = true; }, base: value => { value.session._savedJson = JSON.stringify( value.session._snapshot ); },
			revision: value => { value.session._revisionId = 99; }, owner: value => { value.session._owner = 'New owner'; },
			bridge: value => { value.bridge.disposed = true; }, imageUrl: value => { value.editor.config.imageUrl = 'newer-url'; },
			pending: value => { value.store.pendingOperations.push( { type: 'newer' } ); }, locking: value => { value.store.lockingQueue.push( { type: 'newer' } ); },
			lock: value => { value.store.isLocked = true; }, method: value => { value.store.prepareWorkingCopyPatchCommit = () => { throw new Error( 'new method' ); }; },
			descriptor: value => { Object.defineProperty( value.store.state, 'isDirty', { writable: false } ); },
			historyArray: value => { value.history.history = value.history.history.slice(); }, entry: value => { value.history.history[ 0 ] = finite( value.history.history[ 0 ] ); },
			batch: value => { value.history.batchMode = true; value.history.batchChanges.push( 'newer' ); },
			selectionController: value => { value.editor.canvasManager.selectionManager.selectedIds.push( 'newer' ); },
			destroyEqual: value => { const state = value.store.state; value.store.destroy(); value.store.state = state; }
		};
		const check = lastCallback( ctx, mutate[ type ] ); expect( ctx.history.undo() ).toBe( false ); check();
		if ( type === 'selectionController' ) { expect( ctx.editor.canvasManager.selectionManager.selectedIds ).toEqual( [ 'old', 'newer' ] ); }
	} );
	test.each( [ 'state', 'history' ] )( 'nonwritable %s assignment refuses without participant writes', async type => {
		const ctx = await context(); ctx.store.set( 'slideCanvasWidth', 120 ); ctx.history.saveState( 'ordinary' );
		Object.defineProperty( type === 'state' ? ctx.store.state : ctx.history, type === 'state' ? 'layers' : 'historyIndex', { writable: false } );
		const before = witness( ctx ); expect( ctx.history.undo() ).toBe( false ); preserved( ctx, before );
	} );
	test( 'ordinary recording uses the same combined last-callback guard', async () => {
		const ctx = await context(); ctx.store.set( 'slideCanvasWidth', 120 ); const check = lastCallback( ctx, value => { value.store.state.slideCanvasWidth = 190; } );
		expect( () => ctx.history.saveState( 'ordinary' ) ).toThrow( 'Working-copy history unavailable' ); check();
	} );
	test.each( [ 'readOnly', 'pdf', 'emptyBase', 'saving', 'reconciling', 'lock', 'pending', 'batch', 'used', 'pin', 'foreign', 'destroyed' ] )( '%s initial admission refuses without erasing entries', async type => {
		const ctx = await context( 'slide', true, false );
		const changes = { readOnly: () => { ctx.session._readOnly = true; }, pdf: () => { ctx.session._pdfContext = {}; },
			emptyBase: () => { ctx.session._baseHasDrawings = false; }, saving: () => { ctx.session._phase = 'saving'; }, reconciling: () => { ctx.bridge.reconciling = true; },
			lock: () => { ctx.store.isLocked = true; }, pending: () => { ctx.store.pendingOperations.push( { type: 'pending' } ); },
			batch: () => { ctx.history.batchMode = true; }, used: () => { ctx.history.saveState( 'prior' ); },
			pin: () => { ctx.session._snapshot.surfaces[ 0 ].kind = 'image'; ctx.session._snapshot.surfaces[ 0 ].source = { fileTitle: 'File:New.png', sha1: 'new' }; },
			foreign: () => { ctx.editor.historyManager = {}; }, destroyed: () => ctx.store.destroy() };
		changes[ type ](); const before = witness( ctx ); expect( () => ctx.history.enableWorkingCopyHistory( ctx.bridge ) ).toThrow( 'Working-copy history unavailable' ); preserved( ctx, before );
	} );
	test( 'live empty initial admission is observational and duplicate opt-in refuses', async () => {
		const ctx = await context( 'slide', false, false ), before = witness( ctx ); ctx.history.enableWorkingCopyHistory( ctx.bridge ); preserved( ctx, before );
		expect( () => ctx.history.enableWorkingCopyHistory( ctx.bridge ) ).toThrow(); preserved( ctx, before );
	} );
	test( 'ambiguous referenced IDs refuse ordinary work without silently repairing order', async () => {
		const ctx = await context(); ctx.store.state.layers.push( { id: 'old', type: 'text', text: 'duplicate' } ); const before = witness( ctx );
		expect( () => ctx.history.saveState( 'ambiguous' ) ).toThrow(); preserved( ctx, before );
	} );
	test( 'failed batch cancel retains current complete batch and newer work', async () => {
		const ctx = await context(); ctx.history.startBatch( 'batch' ); ctx.store.set( 'slideCanvasWidth', 140 ); ctx.history.saveState( 'inside' );
		const check = lastCallback( ctx, value => { value.store.state.slideCanvasWidth = 195; } ); expect( ctx.history.cancelBatch() ).toBe( false ); check();
		expect( ctx.history.batchMode ).toBe( true ); expect( ctx.history.batchChanges ).toHaveLength( 1 );
	} );
	test.each( [ 'render', 'destroy', 'notify' ] )( 'post-commit %s failure stays truthful committed success', async type => {
		const ctx = await context(); ctx.store.set( 'slideCanvasWidth', 120 ); ctx.history.saveState( 'resize' );
		if ( type === 'render' ) { ctx.editor.canvasManager.renderLayers = () => { throw new Error( 'render' ); }; }
		if ( type === 'destroy' ) { ctx.store.subscribe( 'layers', () => ctx.store.destroy() ); }
		if ( type === 'notify' ) { ctx.store.notifyListeners = () => { throw new Error( 'notify' ); }; }
		expect( ctx.history.undo() ).toBe( true ); expect( ctx.history.historyIndex ).toBe( 0 ); expect( ctx.session._snapshot.surfaces[ 0 ].canvas.width ).toBe( 100 );
		if ( type !== 'destroy' ) { expect( ctx.history.getWorkingCopyHistoryDiagnostic().length ).toBeGreaterThan( 0 ); }
	} );
} );