'use strict';
const { TextEncoder } = require( 'util' ); global.TextEncoder = TextEncoder;
const Session = require( '../../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( '../../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const History = require( '../../../resources/ext.layers.editor/HistoryManager.js' );
const State = require( '../../../resources/ext.layers.editor/StateManager.js' );
require( '../../../resources/ext.layers.editor/selection/SelectionState.js' );
const Selection = require( '../../../resources/ext.layers.editor/SelectionManager.js' );
const Source = require( '../../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
const Adapter = require( '../../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Planner = require( '../../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
const ReadClient = require( '../../../resources/ext.layers.editor/PageOwnedWorkingCopyImportReadClient.js' );
const Coordinator = require( process.env.LAYERS_IMPORT_COORDINATOR_SOURCE || '../../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCoordinator.js' );
const clone = value => State.copyWorkingCopyValue( value );

function asciiJson( value ) {
	const seen = new Set();
	const visit = item => {
		if ( item === null || typeof item === 'string' || typeof item === 'boolean' ) { return; }
		if ( typeof item === 'number' ) { if ( !Number.isFinite( item ) ) { throw new Error( 'unsafe JSON' ); } return; }
		if ( typeof item !== 'object' || seen.has( item ) ) { throw new Error( 'unsafe JSON' ); }
		seen.add( item );
		if ( Array.isArray( item ) ) {
			for ( const key of Reflect.ownKeys( item ) ) {
				if ( typeof key !== 'string' || ( key !== 'length' && !/^(?:0|[1-9][0-9]*)$/.test( key ) ) ) { throw new Error( 'unsafe JSON' ); }
			}
			for ( let index = 0; index < item.length; index++ ) {
				if ( !Object.hasOwn( item, index ) ) { throw new Error( 'unsafe JSON' ); }
				visit( Object.getOwnPropertyDescriptor( item, String( index ) ).value );
			}
		} else {
			const prototype = Object.getPrototypeOf( item );
			if ( prototype !== Object.prototype && prototype !== null ) { throw new Error( 'unsafe JSON' ); }
			for ( const key of Reflect.ownKeys( item ) ) {
				if ( typeof key !== 'string' || key === '__proto__' ) { throw new Error( 'unsafe JSON' ); }
				const descriptor = Object.getOwnPropertyDescriptor( item, key );
				if ( !descriptor.enumerable || !Object.hasOwn( descriptor, 'value' ) || key === 'toJSON' ) { throw new Error( 'unsafe JSON' ); }
				visit( descriptor.value );
			}
		}
		seen.delete( item );
	};
	visit( value );
	return JSON.stringify( value ).replace( /[^\x00-\x7f]/g, character => '\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) );
}

function exactTextResponse( response, moduleName ) {
	if ( !response || typeof response !== 'object' || !Object.hasOwn( response, moduleName ) ) { return response; }
	const moduleDescriptor = Object.getOwnPropertyDescriptor( response, moduleName );
	if ( !moduleDescriptor || !Object.hasOwn( moduleDescriptor, 'value' ) ) { return { [ moduleName ]: { version: 1, data: '' } }; }
	const current = moduleDescriptor.value;
	if ( current && current.version === 1 && typeof current.data === 'string' ) { return response; }
	const envelope = value => ( { version: 1, data: value } );
	try {
		const safe = {};
		for ( const key of Reflect.ownKeys( response ) ) {
			const descriptor = Object.getOwnPropertyDescriptor( response, key );
			if ( typeof key !== 'string' || key === '__proto__' || key === 'toJSON' || !descriptor.enumerable || !Object.hasOwn( descriptor, 'value' ) ) { throw new Error( 'unsafe response' ); }
			safe[ key ] = key === moduleName ? envelope( asciiJson( current ) ) : descriptor.value;
		}
		return safe;
	} catch { return { [ moduleName ]: envelope( '' ) }; }
}

function rawExactTextResponse( response, moduleName ) {
	if ( !response || typeof response !== 'object' || !Object.hasOwn( response, moduleName ) ) { return response; }
	const value = response[ moduleName ];
	if ( !value || value.version !== 1 || typeof value.data !== 'string' ) { return response; }
	try { return { ...response, [ moduleName ]: JSON.parse( value.data ) }; } catch { return response; }
}

function surface( id, kind, populated ) {
	return { id, kind, label: 'Same', canvas: { width: 100, height: 50, backgroundColor: 'white', extra: [ null, false, 0, '' ] },
		...( kind === 'image' ? { source: { fileTitle: 'File:Exact.png', sha1: 'pin', timestamp: '20261001010101', page: 1 } } : {} ),
		layers: populated ? [ { id: 'old', type: 'text', text: 'old' } ] : [], ...( populated ? { readingOrder: [ 'old' ] } : {} ) };
}

async function context( kind = 'slide', populated = false, saved = null, revisionId = 12 ) {
	const base = saved ? clone( saved ) : { schemaVersion: 1, metadata: { keep: [ null, false, 0, '' ] }, surfaces: [ surface( 'target', kind, populated ), surface( 'other', 'image', true ) ] };
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
	const reader = { read: jest.fn( async () => { counts.target++; if ( hooks.target ) { await hooks.target(); } return { revisionId, snapshot: clone( base ) }; } ) };
	const publisher = { publish: jest.fn( () => { throw new Error( 'publication forbidden' ); } ) }, adapter = new Adapter();
	const editor = { config: { isSlide: kind === 'slide', imageUrl: 'exact-rendition' }, updateStatus: jest.fn(),
		canvasManager: { selectedLayerIds: [], selectedLayerId: null, redraw: jest.fn(), renderLayers: jest.fn(),
			setBaseDimensions: jest.fn( function ( width, height ) { this.baseWidth = width; this.baseHeight = height; } ) },
		layerPanel: { updateLayers: jest.fn(), updateSelection: jest.fn() } };
	editor.canvasManager.editor = editor; const store = new State( editor ); editor.stateManager = store;
	Object.defineProperty( editor, 'layers', { get: () => store.state.layers } ); const history = new History( { editor, maxHistorySteps: 60 } ); editor.historyManager = history;
	const session = new Session( { owner: 'Target Page', pageId: 7, revisionId, surfaceId: 'target' }, { reader, publisher, adapter } );
	const bridge = new Bridge( editor, session ); await bridge.load();
	const selection = new Selection( {}, editor.canvasManager ); editor.canvasManager.selectionManager = selection; history.enableWorkingCopyHistory( bridge );
	const choice = { owner: 'Source Page', pageId: 9, revisionId: 42, surfaceId: 'source' };
	const nativeOptions = { targetPageId: 7, targetBaseRevisionId: 12, targetSurfaceId: 'target', sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' };
	const api = { get: jest.fn( async params => {
		counts.native++; expect( params ).toStrictEqual( { action: 'layersworkingcopyimportread', formatversion: 2, targetpageid: 7, baserevid: 12, targetsurface: 'target', sourcepageid: 9, sourcerevid: 42, sourcesurface: 'source', exacttext: true } );
		if ( hooks.native ) { await hooks.native(); }
		return exactTextResponse( { layersworkingcopyimportread: { target: { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' }, source: clone( choice ),
			targetBundle: { revisionId: 12, snapshot: clone( base ), sourceGeometry: [] }, sourceBundle: clone( bundle ) } }, 'layersworkingcopyimportread' );
	} ) };
	const client = new ReadClient( api );
	return { reader, base, bundle, hooks, counts, editor, store, history, session, bridge, selection, adapter, publisher, choice, nativeOptions, api, client,
		options: mode => ( { mode: mode || ( populated ? 'append' : 'empty' ), maxLayers: 30, allocateId: () => 'fresh-' + ++counts.allocate } ),
		dependencies: { bridge, session, readClient: client, Source, planner: Planner, adapter } };
}

module.exports = { context, clone, exactTextResponse, rawExactTextResponse, Session, Bridge, History, State, Coordinator };
