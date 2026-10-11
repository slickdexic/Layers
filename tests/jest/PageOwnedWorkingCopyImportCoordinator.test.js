'use strict';
const { TextEncoder } = require( 'util' );
global.TextEncoder = TextEncoder;
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const History = require( '../../resources/ext.layers.editor/HistoryManager.js' );
const State = require( '../../resources/ext.layers.editor/StateManager.js' );
require( '../../resources/ext.layers.editor/selection/SelectionState.js' );
const Selection = require( '../../resources/ext.layers.editor/SelectionManager.js' );
const Source = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Planner = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
const ReadClient = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportReadClient.js' );
const Coordinator = require( process.env.LAYERS_IMPORT_COORDINATOR_SOURCE || '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCoordinator.js' );
const clone = value => State.copyWorkingCopyValue( value );

beforeAll( () => {
	if ( process.env.LAYERS_IMPORT_LOAD_WITNESS ) {
		const fs = require( 'fs' ), crypto = require( 'crypto' );
		const resolved = require.resolve( process.env.LAYERS_IMPORT_COORDINATOR_SOURCE || '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCoordinator.js' );
		const loaded = Object.fromEntries( Object.keys( require.cache ).filter( file => file === resolved || /(?:PageOwned|StateManager|HistoryManager|SelectionManager|SelectionState).*\.js$/.test( file ) ).map( file =>
			[ file, crypto.createHash( 'sha256' ).update( fs.readFileSync( file ) ).digest( 'hex' ) ] ) );
		fs.writeFileSync( process.env.LAYERS_IMPORT_LOAD_WITNESS, JSON.stringify( { resolved, loaded }, null, 2 ) + '\n', { flag: 'wx' } );
	}
} );

function surface( id, kind, populated ) {
	return { id, kind, label: 'Same', canvas: { width: 100, height: 50, backgroundColor: 'white', extra: [ null, false, 0, '' ] },
		...( kind === 'image' ? { source: { fileTitle: 'File:Exact.png', sha1: 'pin', timestamp: '20261001010101', page: 1 } } : {} ),
		layers: populated ? [ { id: 'old', type: 'text', text: 'old' } ] : [], ...( populated ? { readingOrder: [ 'old' ] } : {} ) };
}

async function context( kind = 'slide', populated = false ) {
	const base = { schemaVersion: 1, metadata: { keep: [ null, false, 0, '' ] }, surfaces: [ surface( 'target', kind, populated ), surface( 'other', 'image', true ) ] };
	const selected = surface( 'source', kind, true );
	selected.canvas = { width: 200, height: 120, backgroundColor: '#123456', extra: { keep: [ null, false, 0, '' ] } };
	if ( kind === 'image' ) { selected.source.sha1 = 'older-version'; }
	selected.layers = [ { id: 'group', type: 'group', children: [ 'one', 'two' ] },
		{ id: 'one', type: 'textbox', parentGroup: 'group', text: 'first', extra: null, legacy: { list: [ null, false, 0, 1.25, 'Legacy 世界' ] } },
		{ id: 'two', type: 'image', parentGroup: 'group', src: 'data:image/png;base64,AAAA', originalWidth: 10, originalHeight: 12 } ];
	selected.readingOrder = [ 'two', 'one' ];
	const missing = surface( 'unavailable', 'image', true ); missing.source.fileTitle = 'File:NeverUploaded.png';
	const bundle = { revisionId: 42, snapshot: { schemaVersion: 1, surfaces: [ selected, missing ] },
		sourceGeometry: kind === 'image' ? { source: { page: 1, width: 1, height: 1, units: 'file-handler-pixels' } } : [],
		sourceRenditions: kind === 'image' ? { source: { url: 'https://example.test/pinned.png', width: 1, height: 1 } } : [] };
	const hooks = { target: null, native: null }, counts = { target: 0, native: 0, allocate: 0 };
	const reader = { read: jest.fn( async () => { counts.target++; if ( hooks.target ) { await hooks.target(); } return { revisionId: 12, snapshot: clone( base ) }; } ) };
	const publisher = { publish: jest.fn( () => { throw new Error( 'publication forbidden' ); } ) }, adapter = new Adapter();
	const editor = { config: { isSlide: kind === 'slide', imageUrl: 'exact-rendition' }, updateStatus: jest.fn(),
		canvasManager: { selectedLayerIds: [], selectedLayerId: null, redraw: jest.fn(), renderLayers: jest.fn(),
			setBaseDimensions: jest.fn( function ( width, height ) { this.baseWidth = width; this.baseHeight = height; } ) },
		layerPanel: { updateLayers: jest.fn(), updateSelection: jest.fn() } };
	editor.canvasManager.editor = editor; const store = new State( editor ); editor.stateManager = store;
	Object.defineProperty( editor, 'layers', { get: () => store.state.layers } ); const history = new History( { editor, maxHistorySteps: 60 } ); editor.historyManager = history;
	const session = new Session( { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' }, { reader, publisher, adapter } );
	const bridge = new Bridge( editor, session ); await bridge.load();
	const selection = new Selection( {}, editor.canvasManager ); editor.canvasManager.selectionManager = selection; history.enableWorkingCopyHistory( bridge );
	const choice = { owner: 'Source Page', pageId: 9, revisionId: 42, surfaceId: 'source' };
	const nativeOptions = { targetPageId: 7, targetBaseRevisionId: 12, targetSurfaceId: 'target', sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' };
	const api = { get: jest.fn( async params => {
		counts.native++; expect( params ).toStrictEqual( { action: 'layersworkingcopyimportread', formatversion: 2, targetpageid: 7, baserevid: 12, targetsurface: 'target', sourcepageid: 9, sourcerevid: 42, sourcesurface: 'source' } );
		if ( hooks.native ) { await hooks.native(); }
		return { layersworkingcopyimportread: { target: { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' }, source: clone( choice ),
			targetBundle: { revisionId: 12, snapshot: clone( base ), sourceGeometry: [] }, sourceBundle: clone( bundle ) } };
	} ) };
	const client = new ReadClient( api );
	return { base, bundle, hooks, counts, editor, store, history, session, bridge, selection, adapter, publisher, choice, nativeOptions, api, client,
		options: mode => ( { mode: mode || ( populated ? 'append' : 'empty' ), maxLayers: 30, allocateId: () => 'fresh-' + ++counts.allocate } ),
		dependencies: { bridge, session, readClient: client, Source, planner: Planner, adapter } };
}

function witness( ctx ) {
	return [ State.observeWorkingCopyObject( ctx.store, false ), State.observeWorkingCopyObject( ctx.store.state ), State.observeWorkingCopyObject( ctx.store.pendingOperations ),
		State.observeWorkingCopyObject( ctx.store.lockingQueue ), State.observeWorkingCopyObject( ctx.session, false ),
		...( ctx.session._snapshot === null ? [] : [ State.observeWorkingCopyObject( ctx.session._snapshot ) ] ),
		State.observeWorkingCopyObject( ctx.history, false ), State.observeWorkingCopyObject( ctx.history.history ), State.observeWorkingCopyObject( ctx.history.batchChanges ),
		State.observeWorkingCopyObject( ctx.selection, false ), State.observeWorkingCopyObject( ctx.selection._selectionState ), State.observeWorkingCopyObject( ctx.selection.selectedLayerIds ),
		State.observeWorkingCopyObject( ctx.editor.canvasManager, false ), State.observeWorkingCopyObject( ctx.editor.canvasManager.selectedLayerIds ), State.observeWorkingCopyObject( ctx.editor.config ) ];
}
function preserved( before ) { before.forEach( State.checkWorkingCopyObservation ); }

describe( 'read-only actual Session Import identity', () => {
	test.each( [ 'slide', 'image' ] )( '%s returns fresh detached identity without work changes', async kind => {
		const ctx = await context( kind ), before = witness( ctx ), counts = { ...ctx.counts };
		const first = ctx.session.getWorkingCopyImportIdentity(), second = ctx.session.getWorkingCopyImportIdentity();
		expect( first ).toStrictEqual( { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' } ); expect( second ).not.toBe( first );
		first.owner = 'forged'; preserved( before ); expect( ctx.counts ).toStrictEqual( counts ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test.each( [ [ '_readOnly', true ], [ '_phase', 'disposed' ], [ '_pageId', undefined ], [ '_pageId', 2147483648 ], [ '_newSurface', {} ], [ '_pdfContext', {} ], [ '_baseHasDrawings', false ] ] )( '%s %s refuses unchanged', async ( key, value ) => {
		const ctx = await context(); ctx.session[ key ] = value; const before = witness( ctx );
		expect( () => ctx.session.getWorkingCopyImportIdentity() ).toThrow(); preserved( before );
	} );
} );

describe( 'inactive native-ID Import composition through actual I/C/G1', () => {
	test.each( [ [ 'slide', false, 'empty' ], [ 'slide', true, 'append' ], [ 'slide', true, 'replace' ], [ 'image', false, 'empty' ], [ 'image', true, 'append' ], [ 'image', true, 'replace' ] ] )( '%s %s %s commits actual complete work with one-step Undo/Redo', async ( kind, populated, mode ) => {
		const ctx = await context( kind, populated ), coordinator = new Coordinator( ctx.dependencies ), before = witness( ctx ), snapshot = clone( ctx.session._snapshot );
		const handle = await coordinator.prepare( ctx.choice, ctx.options( mode ) ); preserved( before ); expect( ctx.counts.native ).toBe( 1 );
		const preview = coordinator.inspect( handle ); preview.candidateSnapshot.surfaces[ 0 ].label = 'forged'; preserved( before );
		const result = await coordinator.apply( handle ); expect( ctx.counts.native ).toBe( 2 ); expect( ctx.counts.target ).toBe( 2 );
		expect( ctx.history.history ).toHaveLength( 2 ); expect( ctx.store.state.layers ).toStrictEqual( ctx.session._snapshot.surfaces[ 0 ].layers );
		expect( ctx.store.state.selectedLayerIds ).toStrictEqual( result.importedLayerIds ); expect( ctx.selection.selectedLayerIds ).toStrictEqual( result.importedLayerIds );
		expect( ctx.selection._selectionState.getSelectedIds() ).toStrictEqual( result.importedLayerIds ); expect( ctx.editor.canvasManager.selectedLayerIds ).toStrictEqual( result.importedLayerIds );
		expect( ctx.store.state.layers.find( layer => layer.type === 'textbox' ).legacy ).toStrictEqual( { list: [ null, false, 0, 1.25, 'Legacy 世界' ] } );
		expect( ctx.store.state.layers.find( layer => layer.type === 'textbox' ).extra ).toBeNull(); expect( ctx.session._snapshot.surfaces[ 1 ] ).toStrictEqual( ctx.base.surfaces[ 1 ] );
		expect( ctx.session._snapshot.metadata ).toStrictEqual( ctx.base.metadata ); expect( ctx.editor.canvasManager.baseWidth ).toBe( kind === 'slide' && !populated ? 200 : 100 );
		if ( kind === 'image' ) { expect( ctx.session._snapshot.surfaces[ 0 ].source ).toStrictEqual( snapshot.surfaces[ 0 ].source ); }
		expect( result.differentFileVersion ).toBe( kind === 'image' ); expect( result.importedLayerIds ).toStrictEqual( [ 'fresh-1', 'fresh-2', 'fresh-3' ] );
		const imported = clone( ctx.session._snapshot ); expect( ctx.history.undo() ).toBe( true ); expect( ctx.session._snapshot ).toStrictEqual( snapshot );
		expect( ctx.history.redo() ).toBe( true ); expect( ctx.session._snapshot ).toStrictEqual( imported ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
		expect( ctx.session._revisionId ).toBe( 12 ); expect( ctx.session._savedJson ).toBe( JSON.stringify( ctx.base ) );
		await expect( coordinator.apply( handle ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } ); coordinator.release( handle ); coordinator.dispose();
	} );
	test( 'Cancel performs zero GETs, allocations, source construction or participant writes', async () => {
		const ctx = await context(), sourceConstructor = jest.fn( ctx.dependencies.Source );
		const coordinator = new Coordinator( { ...ctx.dependencies, Source: sourceConstructor } ), before = witness( ctx ), counts = { ...ctx.counts };
		expect( await coordinator.prepare( { get owner() { throw new Error( 'never read' ); } }, { mode: 'cancel' } ) ).toBeNull();
		expect( await coordinator.apply( null ) ).toBeNull(); preserved( before ); expect( ctx.counts ).toStrictEqual( counts ); expect( sourceConstructor ).not.toHaveBeenCalled();
	} );
	test( 'native request uses captured exact numeric identities, never owner dispatch', async () => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ), choice = { ...ctx.choice }, options = ctx.options();
		const pending = coordinator.prepare( choice, options ); choice.pageId = 88; choice.owner = 'later'; choice.surfaceId = 'later'; options.mode = 'replace';
		const handle = await pending; expect( ctx.api.get ).toHaveBeenCalledTimes( 1 );
		expect( ctx.api.get.mock.calls[ 0 ][ 0 ] ).toStrictEqual( { action: 'layersworkingcopyimportread', formatversion: 2, targetpageid: 7, baserevid: 12, targetsurface: 'target', sourcepageid: 9, sourcerevid: 42, sourcesurface: 'source' } );
		expect( coordinator.inspect( handle ).source.owner ).toBe( 'Source Page' ); coordinator.release( handle );
	} );
	test( 'complete detached native source bundle reaches actual C unchanged', async () => {
		const ctx = await context( 'image' ), received = [];
		function CapturedSource( dependencies ) {
			return new Source( { ...dependencies, reader: { read: async request => { const result = await dependencies.reader.read( request ); received.push( clone( result ) ); return result; } } } );
		}
		const coordinator = new Coordinator( { ...ctx.dependencies, Source: CapturedSource } ), handle = await coordinator.prepare( ctx.choice, ctx.options() );
		expect( received ).toStrictEqual( [ ctx.bundle ] ); await coordinator.apply( handle ); expect( received ).toStrictEqual( [ ctx.bundle, ctx.bundle ] );
		expect( received[ 0 ].snapshot.surfaces[ 1 ].source.fileTitle ).toBe( 'File:NeverUploaded.png' ); expect( received[ 0 ].sourceRenditions.source.url ).toBe( 'https://example.test/pinned.png' );
		coordinator.release( handle );
	} );
	test.each( [ 'source', 'target' ] )( 'canonical %s owner mismatch refuses without writes', async descriptor => {
		const ctx = await context(), original = ctx.api.get.getMockImplementation();
		ctx.api.get.mockImplementation( async params => { const response = await original( params ); response.layersworkingcopyimportread[ descriptor ].owner = 'Substituted Canonical Owner'; return response; } );
		const coordinator = new Coordinator( ctx.dependencies ), before = witness( ctx );
		await expect( coordinator.prepare( ctx.choice, ctx.options() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } ); preserved( before ); expect( ctx.counts.allocate ).toBe( 0 );
	} );
	test.each( [ 'pageId', 'revisionId', 'surfaceId' ] )( 'source %s response mismatch refuses without writes', async field => {
		const ctx = await context(), original = ctx.api.get.getMockImplementation();
		ctx.api.get.mockImplementation( async params => { const response = await original( params ); response.layersworkingcopyimportread.source[ field ] = field === 'surfaceId' ? 'other' : 99; return response; } );
		const coordinator = new Coordinator( ctx.dependencies ), before = witness( ctx ); await expect( coordinator.prepare( ctx.choice, ctx.options() ) ).rejects.toThrow(); preserved( before );
	} );
	test.each( [ [ 'pageId', 7 ], [ 'pageId', 0 ], [ 'pageId', 2147483648 ], [ 'pageId', '9' ], [ 'revisionId', 0 ], [ 'surfaceId', '' ], [ 'surfaceId', '世'.repeat( 43 ) ], [ 'owner', '' ] ] )( 'malformed or same-owner source %s %s is rejected before reads', async ( field, value ) => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ), before = witness( ctx );
		await expect( coordinator.prepare( { ...ctx.choice, [ field ]: value }, ctx.options() ) ).rejects.toThrow(); preserved( before ); expect( ctx.counts.native ).toBe( 0 ); expect( ctx.counts.allocate ).toBe( 0 );
	} );
	test.each( [ 'choice-getter', 'choice-extra', 'choice-symbol', 'options-getter', 'options-extra' ] )( '%s is refused without executing accessors', async type => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ), choice = { ...ctx.choice }, options = ctx.options(), getter = jest.fn( () => 9 );
		if ( type === 'choice-getter' ) { Object.defineProperty( choice, 'pageId', { enumerable: true, get: getter } ); }
		if ( type === 'choice-extra' ) { choice.extra = true; } if ( type === 'choice-symbol' ) { choice[ Symbol( 'extra' ) ] = true; }
		if ( type === 'options-getter' ) { Object.defineProperty( options, 'maxLayers', { enumerable: true, get: getter } ); } if ( type === 'options-extra' ) { options.extra = true; }
		const before = witness( ctx ); await expect( coordinator.prepare( choice, options ) ).rejects.toThrow(); preserved( before ); expect( getter ).not.toHaveBeenCalled(); expect( ctx.counts.native ).toBe( 0 );
	} );
	test.each( [ 'readonly', 'disposed', 'unloaded', 'historical', 'new-surface', 'pdf', 'destroyed-store' ] )( '%s actual target refuses without reads or participant writes', async type => {
		const ctx = await context();
		if ( type === 'readonly' || type === 'historical' ) { ctx.session._readOnly = true; }
		if ( type === 'disposed' ) { ctx.session.dispose(); } if ( type === 'unloaded' ) { ctx.bridge.loaded = false; }
		if ( type === 'new-surface' ) { ctx.session._newSurface = {}; } if ( type === 'pdf' ) { ctx.session._snapshot.surfaces[ 0 ].kind = 'pdf'; }
		if ( type === 'destroyed-store' ) { ctx.store.destroy(); }
		const coordinator = new Coordinator( ctx.dependencies ), before = witness( ctx ); await expect( coordinator.prepare( ctx.choice, ctx.options() ) ).rejects.toThrow(); preserved( before ); expect( ctx.counts.native ).toBe( 0 );
	} );
	test.each( [ 'target', 'source' ] )( 'fresh apply-time %s API admission refuses instead of using preparation approval', async boundary => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ), handle = await coordinator.prepare( ctx.choice, ctx.options() ), before = witness( ctx );
		const original = ctx.api.get.getMockImplementation(); ctx.api.get.mockImplementation( async params => { await original( params ); return { error: { code: 'layers-working-copy-import-unavailable', info: boundary + ' admission changed' } }; } );
		await expect( coordinator.apply( handle ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } ); expect( ctx.counts.native ).toBe( 2 ); preserved( before );
		expect( ctx.history.history ).toHaveLength( 1 ); expect( ctx.publisher.publish ).not.toHaveBeenCalled(); coordinator.release( handle );
	} );
	test( 'changed fresh complete source bundle refuses rather than reusing old source', async () => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ), handle = await coordinator.prepare( ctx.choice, ctx.options() ), before = witness( ctx );
		ctx.bundle.snapshot.surfaces[ 1 ].layers[ 0 ].text = 'changed sibling';
		await expect( coordinator.apply( handle ) ).rejects.toThrow(); preserved( before ); expect( ctx.counts.native ).toBe( 2 ); coordinator.release( handle );
	} );
	test.each( [ 'prepare-native', 'apply-target', 'apply-native' ] )( '%s await preserves newer complete editor/session/history/selection work', async stage => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ); let handle, newer;
		if ( stage !== 'prepare-native' ) { handle = await coordinator.prepare( ctx.choice, ctx.options() ); }
		ctx.hooks[ stage === 'apply-target' ? 'target' : 'native' ] = () => {
			ctx.store.state.slideCanvasWidth = 333; ctx.store.state.layers = [ { id: 'newer', type: 'text', text: 'pending' } ];
			ctx.store.pendingOperations.push( { kind: 'newer-pending' } ); ctx.session._snapshot.surfaces[ 1 ].layers[ 0 ].text = 'offscreen newer';
			ctx.history.batchChanges.push( { newer: true } ); ctx.selection._selectionState.setSelectedIds( [ 'newer' ], false ); newer = witness( ctx );
		};
		await expect( stage === 'prepare-native' ? coordinator.prepare( ctx.choice, ctx.options() ) : coordinator.apply( handle ) ).rejects.toThrow(); preserved( newer );
		expect( ctx.store.state.slideCanvasWidth ).toBe( 333 ); expect( ctx.publisher.publish ).not.toHaveBeenCalled(); if ( handle ) { coordinator.release( handle ); }
	} );
	test.each( [ 'readClient', 'identity', 'bridge', 'component' ] )( 'replaced %s method during native await refuses before application', async type => {
		const ctx = await context(); let component;
		function CapturedSource( dependencies ) { component = new Source( dependencies ); return component; }
		const coordinator = new Coordinator( { ...ctx.dependencies, Source: CapturedSource } );
		ctx.hooks.native = () => { if ( type === 'readClient' ) { ctx.client.read = () => Promise.reject( new Error( 'replaced' ) ); }
			if ( type === 'identity' ) { ctx.session.getWorkingCopyImportIdentity = () => ( {} ); }
			if ( type === 'bridge' ) { ctx.bridge.applyWorkingCopyImport = () => null; } if ( type === 'component' ) { component.inspect = () => ( {} ); } };
		await expect( coordinator.prepare( ctx.choice, ctx.options() ) ).rejects.toThrow(); expect( ctx.store.state.layers ).toHaveLength( 0 ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test.each( [ 'target-id', 'bridge-session', 'coordinator', 'session' ] )( '%s lifecycle change during await refuses without undoing newer work', async type => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ); let newer;
		ctx.hooks.native = () => { if ( type === 'target-id' ) { ctx.session._pageId = 77; } if ( type === 'bridge-session' ) { ctx.bridge.session = {}; }
			if ( type === 'coordinator' ) { coordinator.dispose(); } if ( type === 'session' ) { ctx.session.dispose(); } newer = witness( ctx ); };
		await expect( coordinator.prepare( ctx.choice, ctx.options() ) ).rejects.toThrow(); preserved( newer ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	test( 'foreign, fabricated, released and cross-instance handles never confer authority', async () => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ), other = new Coordinator( ctx.dependencies ), handle = await coordinator.prepare( ctx.choice, ctx.options() ), before = witness( ctx );
		for ( const foreign of [ {}, Object.freeze( Object.create( null ) ) ] ) { expect( () => coordinator.inspect( foreign ) ).toThrow(); await expect( coordinator.apply( foreign ) ).rejects.toThrow(); expect( () => coordinator.release( foreign ) ).toThrow(); }
		await expect( other.apply( handle ) ).rejects.toThrow(); expect( () => other.release( handle ) ).toThrow(); preserved( before ); coordinator.release( handle );
		await expect( coordinator.apply( handle ) ).rejects.toThrow(); expect( () => coordinator.inspect( handle ) ).toThrow(); expect( () => coordinator.release( handle ) ).toThrow();
	} );
	test.each( [ 'prepare', 'apply' ] )( 'concurrent %s refuses without invalidating the owned operation', async stage => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ); let unblock, entered;
		const gate = new Promise( resolve => { unblock = resolve; } ), ready = new Promise( resolve => { entered = resolve; } );
		let handle; if ( stage === 'apply' ) { handle = await coordinator.prepare( ctx.choice, ctx.options() ); }
		ctx.hooks.native = async () => { entered(); await gate; };
		const pending = stage === 'prepare' ? coordinator.prepare( ctx.choice, ctx.options() ) : coordinator.apply( handle ); await ready;
		await expect( coordinator.prepare( ctx.choice, ctx.options() ) ).rejects.toThrow(); if ( handle ) { await expect( coordinator.apply( handle ) ).rejects.toThrow(); expect( () => coordinator.release( handle ) ).toThrow(); }
		unblock(); const result = await pending; if ( stage === 'prepare' ) { coordinator.release( result ); } else { expect( result.importedLayerIds ).toHaveLength( 3 ); coordinator.release( handle ); }
	} );
	test( 'dispose invalidates owned handles without disposing Bridge or another coordinator', async () => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies ), other = new Coordinator( ctx.dependencies ), handle = await coordinator.prepare( ctx.choice, ctx.options() );
		coordinator.dispose(); expect( ctx.bridge.disposed ).toBe( false ); expect( ctx.session._phase ).toBe( 'ready' );
		await expect( coordinator.apply( handle ) ).rejects.toThrow(); const fresh = await other.prepare( ctx.choice, ctx.options() ); await other.apply( fresh ); other.release( fresh );
	} );
	test.each( [ 'newer-work', 'notification-error', 'dispose' ] )( '%s after commit returns truthful success and diagnostics', async type => {
		const ctx = await context(), coordinator = new Coordinator( ctx.dependencies );
		ctx.store.subscribe( 'layers', () => { if ( type === 'newer-work' ) { ctx.store.state.slideCanvasWidth = 777; ctx.store.state.layers = [ { id: 'newer', type: 'text' } ]; ctx.selection._selectionState.setSelectedIds( [ 'newer' ] ); }
			if ( type === 'notification-error' ) { throw new Error( 'notification failure' ); } if ( type === 'dispose' ) { coordinator.dispose(); } } );
		const handle = await coordinator.prepare( ctx.choice, ctx.options() ), result = await coordinator.apply( handle ); expect( result.importedLayerIds ).toHaveLength( 3 ); expect( ctx.history.history ).toHaveLength( 2 );
		if ( type === 'newer-work' ) { expect( ctx.store.state.slideCanvasWidth ).toBe( 777 ); expect( ctx.store.state.layers[ 0 ].id ).toBe( 'newer' ); }
		expect( Array.isArray( result.diagnostics ) ).toBe( true ); expect( ctx.publisher.publish ).not.toHaveBeenCalled(); if ( type !== 'dispose' ) { coordinator.release( handle ); }
	} );
} );