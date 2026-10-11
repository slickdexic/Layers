'use strict';

const Session = require( process.env.LAYERS_CHECKPOINT_SESSION_SOURCE || '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Adapter = require( process.env.LAYERS_CHECKPOINT_ADAPTER_SOURCE || '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Source = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
const Planner = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
const clone = value => JSON.parse( JSON.stringify( value ) );
const sessionError = { code: 'layers-working-copy-restore-unavailable', message: 'Working-copy restore unavailable' };
const adapterError = { code: 'layers-invalid-editor-snapshot', message: 'Invalid editor snapshot' };
function refused( callback, expected = sessionError ) {
	try { callback(); throw new Error( 'Expected working-copy checkpoint refusal' ); } catch ( error ) {
		expect( { code: error.code, message: error.message } ).toEqual( expected );
		expect( Object.keys( error ) ).toEqual( [ 'code' ] );
	}
}
function inspectDescriptors( value, ancestors = new Set() ) {
	if ( value === null || typeof value !== 'object' ) { return value; }
	if ( ancestors.has( value ) ) { return { cycle: value }; }
	ancestors.add( value );
	const descriptors = Reflect.ownKeys( value ).map( key => {
		const descriptor = Object.getOwnPropertyDescriptor( value, key );
		return [ key, Object.hasOwn( descriptor, 'value' ) ? { ...descriptor, value: inspectDescriptors( descriptor.value, ancestors ) } : descriptor ];
	} );
	ancestors.delete( value );
	return { prototype: Object.getPrototypeOf( value ), descriptors };
}
function witness( session ) {
	let status;
	try { status = session.getStatus(); } catch ( error ) { status = error.code; }
	return { snapshotIdentity: session._snapshot, snapshot: inspectDescriptors( session._snapshot ),
		newSurface: inspectDescriptors( session._newSurface ), descriptors: Object.getOwnPropertyDescriptors( session ), status };
}
function preserved( session, before ) {
	expect( session._snapshot ).toBe( before.snapshotIdentity ); expect( witness( session ) ).toEqual( before );
}
function surface( id = 'target', kind = 'image', populated = true, order = true ) {
	return { id, kind, label: 'Alpha_Set', canvas: { width: 500, height: 300, background: '#abc', locked: true,
		future: { values: [ null, false, 0, '' ] } }, layers: populated ? [ { id: 'old', type: 'textbox', text: 'old', future: { full: true } } ] : [],
		...( order ? { readingOrder: populated ? [ 'old' ] : [] } : {} ),
		...( kind === 'image' ? { source: { fileTitle: 'File:Exact.jpg', timestamp: '20261001010101', sha1: 'target-pin', repository: 'local', future: [ false, null ] } } : {} ),
		metadata: { owner: 'literal', retain: [ false, null, 0, '' ] } };
}
function document( kind = 'image', populated = true, order = true ) {
	return { schemaVersion: 1, revision: 77, root: { values: [ false, null, 0, '' ] }, surfaces: [ surface( 'target', kind, populated, order ),
		{ id: 'other', kind: 'pdf', label: 'Other', source: { fileTitle: 'File:Other.pdf', page: 2 }, canvas: { width: 77, height: 88 },
			layers: [ { id: 'sibling', type: 'future', value: 'untouched' } ], readingOrder: [ 'sibling' ], metadata: { retain: true } } ] };
}
function working( selected ) {
	return clone( { surfaceId: selected.id, canvas: selected.canvas, layers: selected.layers,
		...( Object.hasOwn( selected, 'readingOrder' ) ? { readingOrder: selected.readingOrder } : {} ) } );
}
function expectedRestore( current, state ) {
	const result = clone( current ), target = result.surfaces.find( member => member.id === state.surfaceId );
	target.canvas = clone( state.canvas ); target.layers = clone( state.layers );
	if ( Object.hasOwn( state, 'readingOrder' ) ) { target.readingOrder = clone( state.readingOrder ); } else { delete target.readingOrder; }
	return result;
}
async function context( kind = 'image', populated = true, order = true, options = {} ) {
	const base = document( kind, populated, order ), adapter = new Adapter();
	const reader = { read: jest.fn( async () => ( { revisionId: 12, snapshot: clone( base ), sourceGeometry: {} } ) ) };
	const publisher = { publish: jest.fn( () => { throw new Error( 'Publication forbidden by checkpoint tests' ); } ) };
	const session = new Session( { owner: 'Target Page', pageId: 7, surfaceId: 'target', revisionId: 12, ...options }, { reader, publisher, adapter } );
	await session.load();
	return { base, session, adapter, reader, publisher };
}
async function importInto( ctx, mode ) {
	const selected = surface( 'selected', ctx.session._snapshot.surfaces[ 0 ].kind ); selected.label = ' alpha  set ';
	selected.canvas = { width: 850, height: 650, background: '#def', locked: false, future: { full: [ false, null, 0, '' ] } };
	if ( selected.kind === 'image' ) { selected.source.sha1 = 'source-pin'; }
	selected.layers = [ { id: 'group', type: 'group', children: [ 'text', 'image' ], future: { id: 'group' } },
		{ id: 'text', type: 'textbox', parentGroup: 'group', text: 'imported', richText: [ { text: 'full', style: { fontSize: 24 } } ],
			gradient: { type: 'linear', colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] }, points: [ { x: 2, y: 4 } ], future: [ null, false, 0, '' ] },
		{ id: 'image', type: 'image', parentGroup: 'group', src: 'data:image/png;base64,AAAA', originalWidth: 12, originalHeight: 13 } ];
	selected.readingOrder = [ 'image', 'text' ];
	const bundle = { revisionId: 42, sourceGeometry: {}, snapshot: { schemaVersion: 1, surfaces: [ selected ] } };
	const sourceReader = { read: jest.fn( async () => clone( bundle ) ) };
	const source = new Source( { reader: sourceReader, adapter: new Adapter(), planner: Planner } ); let counter = 0;
	const expected = clone( ctx.session._snapshot ), imported = clone( selected.layers );
	imported[ 0 ].id = 'fresh-1'; imported[ 0 ].children = [ 'fresh-2', 'fresh-3' ];
	imported[ 1 ].id = 'fresh-2'; imported[ 1 ].parentGroup = 'fresh-1'; imported[ 2 ].id = 'fresh-3'; imported[ 2 ].parentGroup = 'fresh-1';
	expected.surfaces[ 0 ].layers = mode === 'append' ? imported.concat( expected.surfaces[ 0 ].layers ) : imported;
	expected.surfaces[ 0 ].readingOrder = mode === 'append' ? [ 'old', 'fresh-3', 'fresh-2' ] : [ 'fresh-3', 'fresh-2' ];
	if ( mode === 'empty' && selected.kind === 'slide' ) { expected.surfaces[ 0 ].canvas = clone( selected.canvas ); }
	const handle = await ctx.session.prepareWorkingCopyImport( source, { source: { owner: 'Source Page', revisionId: 42, surfaceId: 'selected' },
		mode, maxLayers: 30, allocateId: () => 'fresh-' + ++counter } );
	await ctx.session.revalidateWorkingCopyImport( handle ); ctx.session.commitWorkingCopyImport( handle );
	expect( ctx.session._snapshot ).toEqual( expected ); return { expected, sourceReader };
}
const mutations = [
	[ 'layers', session => { session._snapshot.surfaces[ 0 ].layers.push( { id: 'newer', type: 'future' } ); } ],
	[ 'invalid layer', session => { session._snapshot.surfaces[ 0 ].layers.push( undefined ); } ],
	[ 'canvas', session => { session._snapshot.surfaces[ 0 ].canvas.future = 'newer canvas'; } ],
	[ 'order', session => { session._snapshot.surfaces[ 0 ].readingOrder = []; } ],
	[ 'name', session => { session._snapshot.surfaces[ 0 ].label = 'Newer label'; } ],
	[ 'pin', session => { session._snapshot.surfaces[ 0 ].source.sha1 = 'newer pin'; } ],
	[ 'root', session => { session._snapshot.root.values.push( 'newer root' ); } ],
	[ 'sibling', session => { session._snapshot.surfaces[ 1 ].metadata.retain = 'newer sibling'; } ],
	[ 'target metadata', session => { session._snapshot.surfaces[ 0 ].metadata.owner = 'newer metadata'; } ],
	[ 'equal snapshot replacement', session => { session._snapshot = clone( session._snapshot ); } ],
	[ 'base', session => { session._savedJson = JSON.stringify( document( 'slide' ) ); } ],
	[ 'revision', session => { session._revisionId = 13; } ],
	[ 'owner', session => { session._owner = 'Newer Owner'; } ],
	[ 'page', session => { session._pageId = 8; } ],
	[ 'surface', session => { session._surfaceId = 'other'; } ],
	[ 'readonly', session => { session._readOnly = true; } ],
	[ 'saving', session => { session._phase = 'saving'; } ],
	[ 'conflict', session => { session._phase = 'conflict'; } ],
	[ 'uncertain', session => { session._phase = 'uncertain'; } ],
	[ 'reconcile', session => { session._reconciling = true; } ],
	[ 'base admission', session => { session._baseHasDrawings = false; } ],
	[ 'new admission', session => { session._newSurface = surface( 'target', 'image', false ); } ],
	[ 'PDF context', session => { session._pdfContext = {}; } ],
	[ 'PDF state', session => { session._pdf = {}; } ],
	[ 'PDF recovery', session => { session._pdfRecovery = {}; } ],
	[ 'reader dependency', session => { session._reader = { read: jest.fn() }; } ],
	[ 'reader method', session => { session._reader.read = jest.fn(); } ],
	[ 'publisher dependency', session => { session._publisher = { publish: jest.fn() }; } ],
	[ 'adapter dependency', session => { session._adapter = new Adapter(); } ],
	[ 'restore method', session => { session._adapter.withWorkingCopyRestore = jest.fn(); } ],
	[ 'method descriptor', session => { Object.defineProperty( session._adapter, 'toEditorState', { enumerable: false } ); } ],
	[ 'assignment descriptor', session => { Object.defineProperty( session, '_snapshot', { writable: false } ); } ],
	[ 'disposal', session => session.dispose() ]
];
const malformed = [
	[ 'undefined', state => { state.canvas.future = undefined; } ], [ 'NaN', state => { state.canvas.future = NaN; } ],
	[ 'Infinity', state => { state.canvas.future = Infinity; } ], [ 'function', state => { state.canvas.future = () => {}; } ],
	[ 'BigInt', state => { state.canvas.future = 1n; } ], [ 'symbol value', state => { state.canvas.future = Symbol( 'private' ); } ],
	[ 'symbol key', state => { state[ Symbol( 'private' ) ] = true; } ], [ 'extra key', state => { state.extra = true; } ],
	[ 'sparse', state => { state.layers = new Array( 2 ); } ], [ 'array extra', state => { state.layers.extra = true; } ],
	[ 'array prototype', state => { Object.setPrototypeOf( state.layers, {} ); } ], [ 'cycle', state => { state.canvas.future = state; } ],
	[ 'unsafe prototype', state => { Object.setPrototypeOf( state.canvas, { unsafe: true } ); } ],
	[ 'nonenumerable', state => { Object.defineProperty( state, 'hidden', { value: true } ); } ],
	[ 'canvas accessor', state => { Object.defineProperty( state, 'canvas', { enumerable: true, get: () => { throw new Error( 'private accessor' ); } } ); } ],
	[ 'layer accessor', state => { Object.defineProperty( state.layers, '0', { enumerable: true, get: () => { throw new Error( 'private layer' ); } } ); } ],
	[ 'missing order ID', state => { state.readingOrder = [ 'missing' ]; } ], [ 'duplicate order', state => { state.readingOrder = [ 'old', 'old' ]; } ],
	[ 'ambiguous order ID', state => { state.layers.push( clone( state.layers[ 0 ] ) ); } ], [ 'order null', state => { state.readingOrder = null; } ]
];

describe( 'PageOwnedWorkingCopyCheckpoint', () => {
	it.each( [ [ 'slide', 'empty' ], [ 'image', 'append' ], [ 'image', 'replace' ] ] )(
		'repeatedly restores complete %s/%s Import before/after checkpoints with no restore IO', async ( kind, mode ) => {
			const ctx = await context( kind, mode !== 'empty', mode !== 'empty' ), initial = clone( ctx.session._snapshot );
			const before = ctx.session.captureWorkingCopyCheckpoint(), beforeState = working( initial.surfaces[ 0 ] );
			expect( Object.isFrozen( before ) ).toBe( true ); expect( Reflect.ownKeys( before ) ).toEqual( [] ); expect( Object.getPrototypeOf( before ) ).toBeNull();
			expect( ctx.session.inspectWorkingCopyCheckpoint( before ) ).toEqual( beforeState );
			const imported = await importInto( ctx, mode ), after = ctx.session.captureWorkingCopyCheckpoint(), afterState = working( imported.expected.surfaces[ 0 ] );
			const reads = ctx.reader.read.mock.calls.length, sourceReads = imported.sourceReader.read.mock.calls.length;
			for ( let turn = 0; turn < 3; turn++ ) {
				for ( const [ checkpoint, wanted, dirty ] of [ [ before, initial, false ], [ after, imported.expected, true ] ] ) {
					const unchanged = witness( ctx.session ), handle = ctx.session.prepareWorkingCopyRestore( checkpoint );
					expect( Object.isFrozen( handle ) ).toBe( true ); expect( Reflect.ownKeys( handle ) ).toEqual( [] );
					const preview = ctx.session.inspectPreparedWorkingCopyRestore( handle ); preserved( ctx.session, unchanged );
					expect( preview ).toEqual( { editorState: { canvas: wanted.surfaces[ 0 ].canvas, layers: wanted.surfaces[ 0 ].layers }, workingState: working( wanted.surfaces[ 0 ] ) } );
					preview.editorState.layers.push( { id: 'forged' } ); preview.workingState.canvas.width = -1;
					const result = ctx.session.commitWorkingCopyRestore( handle ); expect( result ).not.toBeInstanceOf( Promise );
					expect( ctx.session._snapshot ).toEqual( wanted ); expect( ctx.session.getDraft().snapshot ).toEqual( wanted ); expect( ctx.session.getStatus().dirty ).toBe( dirty );
					result.editorState.canvas.width = 1; result.workingState.layers.length = 0; expect( ctx.session._snapshot ).toEqual( wanted );
					refused( () => ctx.session.commitWorkingCopyRestore( handle ) );
				}
			}
			expect( ctx.session.inspectWorkingCopyCheckpoint( before ) ).toEqual( beforeState ); expect( ctx.session.inspectWorkingCopyCheckpoint( after ) ).toEqual( afterState );
			expect( ctx.reader.read ).toHaveBeenCalledTimes( reads ); expect( imported.sourceReader.read ).toHaveBeenCalledTimes( sourceReads ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
		} );
	it( 'preserves current root siblings label pin and metadata from before preparation', async () => {
		const ctx = await context(), checkpoint = ctx.session.captureWorkingCopyCheckpoint(), state = ctx.session.inspectWorkingCopyCheckpoint( checkpoint );
		ctx.session._snapshot.root.values.push( 'current root' ); ctx.session._snapshot.surfaces[ 1 ].metadata.retain = 'current sibling';
		ctx.session.rename( 'Current name' ); ctx.session._snapshot.surfaces[ 0 ].metadata.owner = 'current target metadata';
		ctx.session._snapshot.surfaces[ 0 ].layers[ 0 ].text = 'later work';
		const wanted = expectedRestore( ctx.session._snapshot, state ), handle = ctx.session.prepareWorkingCopyRestore( checkpoint );
		ctx.session.commitWorkingCopyRestore( handle ); expect( ctx.session._snapshot ).toEqual( wanted ); expect( ctx.session.getLabel() ).toBe( 'Current name' );
	} );
	it( 'preserves optional reading order absence rather than inventing an empty list', async () => {
		const ctx = await context( 'slide', false, false ), checkpoint = ctx.session.captureWorkingCopyCheckpoint();
		await importInto( ctx, 'empty' ); ctx.session.commitWorkingCopyRestore( ctx.session.prepareWorkingCopyRestore( checkpoint ) );
		expect( Object.hasOwn( ctx.session._snapshot.surfaces[ 0 ], 'readingOrder' ) ).toBe( false );
		expect( ctx.session.inspectWorkingCopyCheckpoint( checkpoint ) ).toEqual( { surfaceId: 'target', canvas: ctx.base.surfaces[ 0 ].canvas, layers: [] } );
	} );
	it( 'preserves present empty order independently from absent order', async () => {
		const ctx = await context( 'slide', false, true ), checkpoint = ctx.session.captureWorkingCopyCheckpoint(); delete ctx.session._snapshot.surfaces[ 0 ].readingOrder;
		ctx.session.commitWorkingCopyRestore( ctx.session.prepareWorkingCopyRestore( checkpoint ) );
		expect( Object.hasOwn( ctx.session._snapshot.surfaces[ 0 ], 'readingOrder' ) ).toBe( true ); expect( ctx.session._snapshot.surfaces[ 0 ].readingOrder ).toEqual( [] );
	} );
	it( 'keeps current successful-save revision/base and restores dirty relative to that current base', async () => {
		const ctx = await context(), before = ctx.session.captureWorkingCopyCheckpoint(); await importInto( ctx, 'replace' ); const after = ctx.session.captureWorkingCopyCheckpoint();
		ctx.publisher.publish.mockResolvedValueOnce( { revisionId: 15 } ); await ctx.session.save( 'ordinary save' ); const base = ctx.session._savedJson;
		ctx.session.commitWorkingCopyRestore( ctx.session.prepareWorkingCopyRestore( before ) ); expect( ctx.session.getStatus() ).toMatchObject( { revisionId: 15, dirty: true, phase: 'ready' } );
		expect( ctx.session._savedJson ).toBe( base ); ctx.session.commitWorkingCopyRestore( ctx.session.prepareWorkingCopyRestore( after ) );
		expect( ctx.session.getStatus() ).toMatchObject( { revisionId: 15, dirty: false } ); expect( ctx.session._savedJson ).toBe( base ); expect( ctx.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'stores at least 50 distinct complete checkpoints without timestamps or a visible history stack', async () => {
		const ctx = await context( 'slide' ), checkpoints = [], expected = [];
		for ( let index = 0; index < 55; index++ ) {
			ctx.session._snapshot.surfaces[ 0 ].canvas.width = 500 + index; ctx.session._snapshot.surfaces[ 0 ].layers[ 0 ].text = 'state-' + index;
			ctx.session._snapshot.surfaces[ 0 ].canvas.future.index = index; checkpoints.push( ctx.session.captureWorkingCopyCheckpoint() ); expected.push( working( ctx.session._snapshot.surfaces[ 0 ] ) );
		}
		expect( new Set( checkpoints ).size ).toBe( 55 );
		for ( const index of [ ...Array( 55 ).keys() ].reverse() ) {
			ctx.session.commitWorkingCopyRestore( ctx.session.prepareWorkingCopyRestore( checkpoints[ index ] ) );
			expect( working( ctx.session._snapshot.surfaces[ 0 ] ) ).toEqual( expected[ index ] );
		}
		expect( ctx.reader.read ).toHaveBeenCalledTimes( 1 ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
	} );
	it( 'no-op restore remains a no-op and checkpoints survive equivalent dependency replacement before preparation', async () => {
		const ctx = await context(), checkpoint = ctx.session.captureWorkingCopyCheckpoint(), before = clone( ctx.session._snapshot ); ctx.session._adapter = new Adapter();
		ctx.session.commitWorkingCopyRestore( ctx.session.prepareWorkingCopyRestore( checkpoint ) ); expect( ctx.session._snapshot ).toEqual( before ); expect( ctx.session.getStatus().dirty ).toBe( false );
	} );
	it.each( [ 'sha1', 'timestamp', 'fileTitle', 'repository', 'future' ] )( 'refuses changed source pin %s without overwriting current work', async key => {
		const ctx = await context(), checkpoint = ctx.session.captureWorkingCopyCheckpoint(); ctx.session._snapshot.surfaces[ 0 ].source[ key ] = 'changed'; const before = witness( ctx.session );
		refused( () => ctx.session.prepareWorkingCopyRestore( checkpoint ) ); refused( () => ctx.session.inspectWorkingCopyCheckpoint( checkpoint ) ); preserved( ctx.session, before );
	} );
	it.each( [ 'unloaded', 'loading', 'saving', 'conflict', 'uncertain', 'disposed', 'unknown' ] )( 'refuses all new use paths in phase %s before adapter callbacks', async phase => {
		const ctx = await context(), checkpoint = ctx.session.captureWorkingCopyCheckpoint(), handle = ctx.session.prepareWorkingCopyRestore( checkpoint ); ctx.session._phase = phase;
		const spy = jest.spyOn( ctx.adapter, 'toEditorState' ), before = witness( ctx.session );
		for ( const callback of [ () => ctx.session.captureWorkingCopyCheckpoint(), () => ctx.session.inspectWorkingCopyCheckpoint( checkpoint ), () => ctx.session.prepareWorkingCopyRestore( checkpoint ),
			() => ctx.session.inspectPreparedWorkingCopyRestore( handle ), () => ctx.session.commitWorkingCopyRestore( handle ) ] ) { refused( callback ); preserved( ctx.session, before ); }
		expect( spy ).not.toHaveBeenCalled();
	} );
	it.each( [ '_readOnly', '_reconciling', '_pdfContext', '_pdf', '_pdfRecovery', '_baseHasDrawings' ] )( 'refuses unavailable flag %s before callbacks', async key => {
		const ctx = await context(); ctx.session[ key ] = key === '_baseHasDrawings' ? false : true; const spy = jest.spyOn( ctx.adapter, 'toEditorState' ), before = witness( ctx.session );
		refused( () => ctx.session.captureWorkingCopyCheckpoint() ); preserved( ctx.session, before ); expect( spy ).not.toHaveBeenCalled();
	} );
	it( 'refuses empty-base checkpointing but preserves ordinary empty editor behavior', async () => {
		const fresh = surface( 'target', 'slide', false, false ), ctx = await context( 'slide', false, false, { newSurface: fresh, emptyBase: true } ), before = witness( ctx.session );
		refused( () => ctx.session.captureWorkingCopyCheckpoint() ); preserved( ctx.session, before ); expect( ctx.reader.read ).not.toHaveBeenCalled();
		ctx.session.update( { canvas: fresh.canvas, layers: [ { id: 'ordinary', text: 'ordinary' } ] } ); expect( ctx.session.getEditorState().layers[ 0 ].id ).toBe( 'ordinary' );
	} );
	it( 'supports a new empty target in an existing document and retains current admission after first save', async () => {
		const ctx = await context( 'slide', false, false ); ctx.base.surfaces.shift(); const fresh = surface( 'target', 'slide', false, false );
		const session = new Session( { owner: 'Target Page', pageId: 7, surfaceId: 'target', revisionId: 12, newSurface: fresh }, { reader: ctx.reader, publisher: ctx.publisher, adapter: ctx.adapter } );
		await session.load(); const checkpoint = session.captureWorkingCopyCheckpoint(); session.update( { canvas: fresh.canvas, layers: [ { id: 'new', type: 'text' } ] } );
		ctx.publisher.publish.mockResolvedValueOnce( { revisionId: 16 } ); await session.save(); const saved = session._savedJson;
		session.commitWorkingCopyRestore( session.prepareWorkingCopyRestore( checkpoint ) ); expect( session._newSurface ).toEqual( fresh ); expect( session._baseHasDrawings ).toBe( true );
		expect( session._revisionId ).toBe( 16 ); expect( session._savedJson ).toBe( saved ); expect( session.isUnsavedNew() ).toBe( false );
	} );
	it.each( [ 'checkpoint', 'prepared' ] )( 'foreign forged serialized released handles never become %s authority', async kind => {
		const ctx = await context(), other = await context(), checkpoint = ctx.session.captureWorkingCopyCheckpoint(), foreign = other.session.captureWorkingCopyCheckpoint();
		const handle = ctx.session.prepareWorkingCopyRestore( checkpoint ), foreignHandle = other.session.prepareWorkingCopyRestore( foreign );
		for ( const forged of [ null, 1, {}, Object.freeze( Object.create( null ) ), JSON.stringify( ctx.session.inspectWorkingCopyCheckpoint( checkpoint ) ),
			ctx.session.inspectWorkingCopyCheckpoint( checkpoint ), kind === 'checkpoint' ? foreign : foreignHandle ] ) {
			if ( kind === 'checkpoint' ) { refused( () => ctx.session.prepareWorkingCopyRestore( forged ) ); refused( () => ctx.session.inspectWorkingCopyCheckpoint( forged ) ); } else {
				refused( () => ctx.session.inspectPreparedWorkingCopyRestore( forged ) ); refused( () => ctx.session.commitWorkingCopyRestore( forged ) );
			}
		}
		expect( ctx.session.inspectPreparedWorkingCopyRestore( handle ).workingState.surfaceId ).toBe( 'target' );
	} );
	it( 'release invalidates derived restores but not independent checkpoints; cleanup works after disposal', async () => {
		const ctx = await context(), first = ctx.session.captureWorkingCopyCheckpoint(), second = ctx.session.captureWorkingCopyCheckpoint();
		const firstRestore = ctx.session.prepareWorkingCopyRestore( first ), another = ctx.session.prepareWorkingCopyRestore( first ), independent = ctx.session.prepareWorkingCopyRestore( second );
		ctx.session.releasePreparedWorkingCopyRestore( firstRestore ); expect( ctx.session.inspectWorkingCopyCheckpoint( first ).surfaceId ).toBe( 'target' );
		ctx.session.releaseWorkingCopyCheckpoint( first ); refused( () => ctx.session.commitWorkingCopyRestore( another ) );
		expect( ctx.session.inspectPreparedWorkingCopyRestore( independent ).workingState.surfaceId ).toBe( 'target' ); ctx.session.dispose(); const before = witness( ctx.session );
		ctx.session.releaseWorkingCopyCheckpoint( second ); ctx.session.releasePreparedWorkingCopyRestore( another ); ctx.session.releasePreparedWorkingCopyRestore( independent ); preserved( ctx.session, before );
		refused( () => ctx.session.releaseWorkingCopyCheckpoint( second ) ); refused( () => ctx.session.releasePreparedWorkingCopyRestore( independent ) );
	} );
	it( 'overlapping prepared restores do not overwrite a prior restore and reusable checkpoints remain alive', async () => {
		const ctx = await context(), checkpoint = ctx.session.captureWorkingCopyCheckpoint(); ctx.session._snapshot.surfaces[ 0 ].layers[ 0 ].text = 'later';
		const first = ctx.session.prepareWorkingCopyRestore( checkpoint ), second = ctx.session.prepareWorkingCopyRestore( checkpoint ); ctx.session.commitWorkingCopyRestore( first );
		const before = witness( ctx.session ); refused( () => ctx.session.commitWorkingCopyRestore( second ) ); preserved( ctx.session, before );
		ctx.session.commitWorkingCopyRestore( ctx.session.prepareWorkingCopyRestore( checkpoint ) ); expect( ctx.session.getStatus().dirty ).toBe( false );
	} );
	for ( const phase of [ 'prepare', 'checkpoint inspect', 'prepared inspect', 'commit' ] ) {
		it.each( mutations )( 'preserves complete newer %s work in ' + phase + ' callback gap', async ( name, mutate ) => {
			const ctx = await context(), originalCopy = ctx.adapter.toEditorState.bind( ctx.adapter ), originalRestore = ctx.adapter.withWorkingCopyRestore.bind( ctx.adapter );
			const copy = jest.spyOn( ctx.adapter, 'toEditorState' ), apply = jest.spyOn( ctx.adapter, 'withWorkingCopyRestore' );
			const checkpoint = ctx.session.captureWorkingCopyCheckpoint(), handle = ctx.session.prepareWorkingCopyRestore( checkpoint ); let before;
			const callback = ( original, ...args ) => { const result = original( ...args ); mutate( ctx.session ); before = witness( ctx.session ); return result; };
			if ( phase === 'prepare' ) { apply.mockImplementationOnce( ( ...args ) => callback( originalRestore, ...args ) ); refused( () => ctx.session.prepareWorkingCopyRestore( checkpoint ) ); } else {
				copy.mockImplementationOnce( ( ...args ) => callback( originalCopy, ...args ) );
				const action = phase === 'checkpoint inspect' ? () => ctx.session.inspectWorkingCopyCheckpoint( checkpoint ) :
					phase === 'prepared inspect' ? () => ctx.session.inspectPreparedWorkingCopyRestore( handle ) : () => ctx.session.commitWorkingCopyRestore( handle );
				refused( action );
			}
			expect( before ).toBeDefined(); preserved( ctx.session, before ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
		} );
	}
	it.each( [ 'capture', 'prepare', 'inspect', 'commit' ] )( 'redacts throwing callbacks and retains newer work during %s', async phase => {
		const ctx = await context(), copy = jest.spyOn( ctx.adapter, 'toEditorState' ), apply = jest.spyOn( ctx.adapter, 'withWorkingCopyRestore' );
		const checkpoint = ctx.session.captureWorkingCopyCheckpoint(), handle = ctx.session.prepareWorkingCopyRestore( checkpoint ); let before;
		const callback = () => { ctx.session._snapshot.root.values.push( 'newer before throw' ); before = witness( ctx.session ); throw new Error( 'private callback' ); };
		if ( phase === 'prepare' ) { apply.mockImplementationOnce( callback ); refused( () => ctx.session.prepareWorkingCopyRestore( checkpoint ) ); } else {
			copy.mockImplementationOnce( callback ); refused( phase === 'capture' ? () => ctx.session.captureWorkingCopyCheckpoint() : phase === 'inspect' ?
				() => ctx.session.inspectPreparedWorkingCopyRestore( handle ) : () => ctx.session.commitWorkingCopyRestore( handle ) );
		}
		preserved( ctx.session, before );
	} );
	it.each( [ 'root', 'sibling', 'label', 'pin', 'target metadata', 'unexpected state' ] )( 'rejects forged adapter candidate %s as a whole document', async kind => {
		const ctx = await context(), original = ctx.adapter.withWorkingCopyRestore.bind( ctx.adapter );
		const spy = jest.spyOn( ctx.adapter, 'withWorkingCopyRestore' ), checkpoint = ctx.session.captureWorkingCopyCheckpoint();
		spy.mockImplementationOnce( ( ...args ) => {
			const candidate = original( ...args );
			if ( kind === 'root' ) { candidate.root.values.push( 'forged' ); }
			if ( kind === 'sibling' ) { candidate.surfaces[ 1 ].label = 'forged'; }
			if ( kind === 'label' ) { candidate.surfaces[ 0 ].label = 'forged'; }
			if ( kind === 'pin' ) { candidate.surfaces[ 0 ].source.sha1 = 'forged'; }
			if ( kind === 'target metadata' ) { candidate.surfaces[ 0 ].metadata.owner = 'forged'; }
			if ( kind === 'unexpected state' ) { candidate.surfaces[ 0 ].canvas.width = 1; }
			return candidate;
		} );
		const before = witness( ctx.session ); refused( () => ctx.session.prepareWorkingCopyRestore( checkpoint ) ); preserved( ctx.session, before );
	} );
	it( 'checks checkpoint lifetime after callbacks and rejects a forged editor view', async () => {
		const ctx = await context(), copy = jest.spyOn( ctx.adapter, 'toEditorState' ), checkpoint = ctx.session.captureWorkingCopyCheckpoint(), handle = ctx.session.prepareWorkingCopyRestore( checkpoint );
		copy.mockImplementationOnce( () => { ctx.session.releaseWorkingCopyCheckpoint( checkpoint ); return { canvas: {}, layers: [] }; } );
		const before = witness( ctx.session ); refused( () => ctx.session.commitWorkingCopyRestore( handle ) ); preserved( ctx.session, before );
	} );
	it( 'executes no external callback after assignment and result objects have no internal aliases', async () => {
		const ctx = await context(), copy = jest.spyOn( ctx.adapter, 'toEditorState' ), checkpoint = ctx.session.captureWorkingCopyCheckpoint();
		ctx.session._snapshot.surfaces[ 0 ].layers[ 0 ].text = 'later'; const old = ctx.session._snapshot, handle = ctx.session.prepareWorkingCopyRestore( checkpoint );
		const original = copy.getMockImplementation(); copy.mockImplementation( ( ...args ) => { expect( ctx.session._snapshot ).toBe( old ); return original( ...args ); } );
		const result = ctx.session.commitWorkingCopyRestore( handle ); expect( ctx.session._snapshot ).not.toBe( old ); expect( result.workingState.layers[ 0 ].text ).toBe( 'old' );
		result.workingState.layers[ 0 ].text = 'forged'; expect( ctx.session._snapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'old' );
	} );

	describe( 'lossless adapter restore', () => {
		it.each( [ 'image', 'slide' ] )( 'preserves full finite %s data and independent input/output references', kind => {
			const adapter = new Adapter(), snapshot = document( kind ), state = { canvas: clone( snapshot.surfaces[ 0 ].canvas ), layers: [ null, false, 0, '', { id: 'new', payload: [ null, false, 0, '' ] } ], readingOrder: [ 'new' ] };
			if ( kind === 'slide' ) { state.canvas.width = 850; state.canvas.height = 650; }
			state.canvas.future = Object.create( null ); Object.defineProperty( state.canvas.future, '__proto__', { value: [ false, null ], enumerable: true });
			const before = clone( snapshot ), result = adapter.withWorkingCopyRestore( snapshot, 'target', state );
			expect( result.surfaces[ 0 ].layers ).toEqual( state.layers ); expect( result.surfaces[ 0 ].canvas ).toEqual( state.canvas ); expect( result.surfaces[ 1 ] ).toEqual( before.surfaces[ 1 ] );
			result.surfaces[ 0 ].layers[ 4 ].payload.push( 'mutated' ); expect( state.layers[ 4 ].payload ).toHaveLength( 4 ); expect( snapshot ).toEqual( before );
		} );
		it( 'does not apply Import planner group/publication validation to ordinary recoverable local data', () => {
			const adapter = new Adapter(), snapshot = document( 'slide' ), state = { canvas: { width: 0, height: 0, future: false },
				layers: [ { id: 'group', type: 'group', children: [ 'not-yet-attached' ] }, { id: 'local', type: 'future', parentGroup: 'unknown', extra: '' } ] };
			expect( adapter.withWorkingCopyRestore( snapshot, 'target', state ).surfaces[ 0 ].layers ).toEqual( state.layers );
		} );
		it( 'does not weaken ordinary retained-reading-order refusal', () => {
			const adapter = new Adapter(), snapshot = document(), state = { canvas: snapshot.surfaces[ 0 ].canvas, layers: [ { id: 'replacement' } ] };
			refused( () => adapter.withEditorState( snapshot, 'target', state ), adapterError );
			expect( adapter.withWorkingCopyRestore( snapshot, 'target', state ).surfaces[ 0 ] ).not.toHaveProperty( 'readingOrder' );
		} );
		it.each( malformed )( 'refuses malformed %s without leaking or mutating input', ( name, mutate ) => {
			const adapter = new Adapter(), snapshot = document(), state = { canvas: clone( snapshot.surfaces[ 0 ].canvas ), layers: clone( snapshot.surfaces[ 0 ].layers ), readingOrder: [ 'old' ] };
			mutate( state ); const before = inspectDescriptors( snapshot ), stateBefore = inspectDescriptors( state );
			refused( () => adapter.withWorkingCopyRestore( snapshot, 'target', state ), adapterError ); expect( inspectDescriptors( snapshot ) ).toEqual( before ); expect( inspectDescriptors( state ) ).toEqual( stateBefore );
		} );
		it.each( [ 'missing', 'duplicate', 'PDF', 'name match', 'image width', 'image height', 'missing canvas', 'missing layers' ] )( 'refuses exact target/state %s', kind => {
			const adapter = new Adapter(), snapshot = document(), state = { canvas: clone( snapshot.surfaces[ 0 ].canvas ), layers: [] }; let id = 'target';
			if ( kind === 'missing' || kind === 'name match' ) { id = kind === 'missing' ? 'missing' : 'Alpha_Set'; }
			if ( kind === 'duplicate' ) { snapshot.surfaces.push( clone( snapshot.surfaces[ 0 ] ) ); }
			if ( kind === 'PDF' ) { snapshot.surfaces[ 0 ].kind = 'pdf'; }
			if ( kind === 'image width' ) { state.canvas.width++; }
			if ( kind === 'image height' ) { state.canvas.height++; }
			if ( kind === 'missing canvas' ) { delete state.canvas; }
			if ( kind === 'missing layers' ) { delete state.layers; }
			refused( () => adapter.withWorkingCopyRestore( snapshot, id, state ), adapterError );
		} );
	} );
} );