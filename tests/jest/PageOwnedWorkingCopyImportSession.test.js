'use strict';

const Session = require( process.env.LAYERS_IMPORT_SESSION_SOURCE || '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Source = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
const Planner = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Reader = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );

const clone = value => JSON.parse( JSON.stringify( value ) );
const errorShape = { code: 'layers-working-copy-import-unavailable', message: 'Working-copy Import unavailable' };
const deferred = () => {
	let resolve, reject;
	const promise = new Promise( ( accept, refuse ) => { resolve = accept; reject = refuse; } );
	return { promise, resolve, reject };
};
async function refused( promise ) {
	try {
		await promise;
		throw new Error( 'Expected guarded session refusal' );
	} catch ( error ) {
		expect( { code: error.code, message: error.message } ).toEqual( errorShape );
		expect( Object.keys( error ) ).toEqual( [ 'code' ] );
	}
}
function refusedSync( callback ) {
	try {
		callback();
		throw new Error( 'Expected guarded session refusal' );
	} catch ( error ) {
		expect( { code: error.code, message: error.message } ).toEqual( errorShape );
	}
}
function descriptorCopy( value, ancestors = new Set() ) {
	if ( value === null || typeof value !== 'object' ) {
		return value;
	}
	if ( ancestors.has( value ) ) {
		return { cycle: value };
	}
	ancestors.add( value );
	const descriptors = Reflect.ownKeys( value ).map( key => {
		const descriptor = Object.getOwnPropertyDescriptor( value, key );
		return [ key, Object.hasOwn( descriptor, 'value' ) ? { ...descriptor, value: descriptorCopy( descriptor.value, ancestors ) } : descriptor ];
	} );
	ancestors.delete( value );
	return { prototype: Object.getPrototypeOf( value ), descriptors };
}
function witness( session ) {
	let status;
	try {
		status = session.getStatus();
	} catch ( error ) {
		status = error.code;
	}
	return { identity: session._snapshot, descriptors: Object.getOwnPropertyDescriptors( session ),
		snapshot: descriptorCopy( session._snapshot ), newSurface: descriptorCopy( session._newSurface ), status };
}
function preserved( session, before ) {
	expect( session._snapshot ).toBe( before.identity );
	expect( witness( session ) ).toEqual( before );
}
function surface( id, kind = 'image', populated = true ) {
	return { id, kind, label: 'Alpha_Set', canvas: { width: 500, height: 300, background: '#abc', locked: true, future: [ false, null ] },
		...( kind === 'image' ? { source: { fileTitle: 'File:Exact.jpg', timestamp: '20261001010101', sha1: 'target-sha', repository: 'local', futurePin: [ 0, false ] } } : {} ),
		layers: populated ? [ { id: 'old', type: 'textbox', text: 'old', future: { retain: true } } ] : [],
		readingOrder: populated ? [ 'old' ] : [], metadata: { retain: [ false, null, 0, 'literal' ] } };
}
function document( kind = 'image', populated = true ) {
	return { schemaVersion: 1, owner: 'literal root owner', revision: 99, rootData: { future: [ false, null, { id: 'old' } ] },
		surfaces: [ surface( 'target', kind, populated ), { id: 'other', kind: 'pdf', label: 'Other',
			source: { fileTitle: 'File:Other.pdf', page: 2 }, canvas: { width: 77, height: 88 },
			layers: [ { id: 'old', type: 'future', value: 'sibling' } ], readingOrder: [ 'old' ] } ] };
}
function sourceBundle( kind = 'image' ) {
	const selected = surface( 'selected', kind );
	selected.label = ' alpha  set ';
	selected.canvas = { width: 850, height: 650, background: '#def', locked: false, future: { full: true } };
	if ( kind === 'image' ) {
		selected.source.sha1 = 'source-sha';
	}
	selected.layers = [
		{ id: 'group', type: 'group', children: [ 'text', 'image' ], future: { id: 'group' } },
		{ id: 'text', type: 'textbox', parentGroup: 'group', text: 'imported', richText: [ { text: 'full', style: { fontSize: 24 } } ],
			gradient: { type: 'linear', colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] },
			points: [ { x: 2, y: 4 } ], future: { id: 'text', nested: [ null, false, 7 ] } },
		{ id: 'image', type: 'image', parentGroup: 'group', src: 'data:image/png;base64,AAAA', originalWidth: 12, originalHeight: 13 }
	];
	selected.readingOrder = [ 'image', 'text' ];
	return { revisionId: 42, sourceGeometry: { selected: { width: 850, height: 650 } }, snapshot: {
		schemaVersion: 1, owner: 'source root', surfaces: [ surface( 'compatible-but-not-selected', kind ), selected ]
	} };
}
async function context( kind = 'image', mode = 'replace', options = {} ) {
	const base = document( kind, mode !== 'empty' ), response = sourceBundle( kind );
	const targetReader = { read: jest.fn( async () => ( { revisionId: 12, snapshot: clone( base ), sourceGeometry: {} } ) ) };
	const sourceReader = { read: jest.fn( async () => clone( response ) ) }, adapter = new Adapter();
	const publisher = { publish: jest.fn( () => { throw new Error( 'Publication forbidden' ); } ) };
	const session = new Session( { owner: 'Target Page', pageId: 7, surfaceId: 'target', revisionId: 12, ...options },
		{ reader: targetReader, adapter, publisher } );
	await session.load();
	const component = new Source( { reader: sourceReader, adapter: new Adapter(), planner: Planner } );
	const source = Object.fromEntries( [ 'prepare', 'inspect', 'revalidate', 'release' ].map( key => [ key, jest.fn( component[ key ].bind( component ) ) ] ) );
	let counter = 0;
	const request = { source: { owner: ' Source_Page ', revisionId: 42, surfaceId: 'selected' }, mode,
		maxLayers: 30, allocateId: jest.fn( () => 'fresh-' + ++counter ) };
	return { base, response, session, targetReader, sourceReader, adapter, publisher, component, source, request };
}
function expected( ctx ) {
	const result = clone( ctx.session._snapshot ), imported = clone( ctx.response.snapshot.surfaces[ 1 ].layers );
	imported[ 0 ].id = 'fresh-1'; imported[ 0 ].children = [ 'fresh-2', 'fresh-3' ];
	imported[ 1 ].id = 'fresh-2'; imported[ 1 ].parentGroup = 'fresh-1';
	imported[ 2 ].id = 'fresh-3'; imported[ 2 ].parentGroup = 'fresh-1';
	const selected = result.surfaces[ 0 ];
	selected.layers = ctx.request.mode === 'append' ? imported.concat( selected.layers ) : imported;
	selected.readingOrder = ctx.request.mode === 'append' ? [ 'old', 'fresh-3', 'fresh-2' ] : [ 'fresh-3', 'fresh-2' ];
	if ( ctx.request.mode === 'empty' && selected.kind === 'slide' ) {
		selected.canvas = clone( ctx.response.snapshot.surfaces[ 1 ].canvas );
	}
	return result;
}
const mutations = [
	[ 'layer', session => { session._snapshot.surfaces[ 0 ].layers[ 0 ].text = 'newer'; } ],
	[ 'invalid layer', session => { session._snapshot.surfaces[ 0 ].layers[ 0 ].future = undefined; } ],
	[ 'canvas', session => { session._snapshot.surfaces[ 0 ].canvas.width = 999; } ],
	[ 'label', session => { session._snapshot.surfaces[ 0 ].label = 'Newer name'; } ],
	[ 'order', session => { session._snapshot.surfaces[ 0 ].readingOrder = []; } ],
	[ 'sibling', session => { session._snapshot.surfaces[ 1 ].layers[ 0 ].value = 'newer sibling'; } ],
	[ 'root', session => { session._snapshot.rootData.future.push( 'newer root' ); } ],
	[ 'pins', session => { session._snapshot.surfaces[ 0 ].source.sha1 = 'newer pin'; } ],
	[ 'equal replacement', session => { session._snapshot = clone( session._snapshot ); } ],
	[ 'saved base', session => { session._savedJson = JSON.stringify( document( 'slide' ) ); } ],
	[ 'revision', session => { session._revisionId = 13; } ],
	[ 'owner', session => { session._owner = 'New Owner'; } ],
	[ 'page', session => { session._pageId = 9; } ],
	[ 'surface', session => { session._surfaceId = 'other'; } ],
	[ 'saving', session => { session._phase = 'saving'; } ],
	[ 'conflict', session => { session._phase = 'conflict'; } ],
	[ 'uncertain', session => { session._phase = 'uncertain'; } ],
	[ 'reconcile', session => { session._reconciling = true; } ],
	[ 'readonly', session => { session._readOnly = true; } ],
	[ 'base admission', session => { session._baseHasDrawings = false; } ],
	[ 'new admission', session => { session._newSurface = surface( 'target', 'image', false ); } ],
	[ 'PDF context', session => { session._pdfContext = {}; } ],
	[ 'PDF state', session => { session._pdf = {}; } ],
	[ 'PDF recovery', session => { session._pdfRecovery = {}; } ],
	[ 'reader dependency', session => { session._reader = { read: jest.fn() }; } ],
	[ 'reader method', session => { session._reader.read = jest.fn(); } ],
	[ 'adapter dependency', session => { session._adapter = new Adapter(); } ],
	[ 'adapter method', session => { session._adapter.toEditorState = jest.fn(); } ],
	[ 'publisher dependency', session => { session._publisher = { publish: jest.fn() }; } ],
	[ 'disposal', session => session.dispose() ]
];

describe( 'PageOwnedWorkingCopyImportSession', () => {
	it.each( [ [ 'image', 'empty' ], [ 'image', 'append' ], [ 'image', 'replace' ], [ 'slide', 'empty' ], [ 'slide', 'append' ], [ 'slide', 'replace' ] ] )(
		'commits only the complete %s/%s working snapshot and returns detached bridge data', async ( kind, mode ) => {
			const ctx = await context( kind, mode ), wanted = expected( ctx ), before = witness( ctx.session );
			const handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
			expect( Object.isFrozen( handle ) ).toBe( true ); expect( Reflect.ownKeys( handle ) ).toEqual( [] ); expect( Object.getPrototypeOf( handle ) ).toBeNull();
			preserved( ctx.session, before );
			refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) );
			await ctx.session.revalidateWorkingCopyImport( handle ); preserved( ctx.session, before );
			expect( ctx.targetReader.read ).toHaveBeenLastCalledWith( { owner: 'Target Page', revisionId: 12 } );
			expect( ctx.sourceReader.read ).toHaveBeenLastCalledWith( { owner: ' Source_Page ', revisionId: 42 } );
			expect( ctx.targetReader.read ).toHaveBeenCalledTimes( 2 ); expect( ctx.sourceReader.read ).toHaveBeenCalledTimes( 2 );
			const result = ctx.session.commitWorkingCopyImport( handle );
			expect( result ).not.toBeInstanceOf( Promise ); expect( ctx.session._snapshot ).toEqual( wanted ); expect( ctx.session.getDraft().snapshot ).toEqual( wanted );
			expect( result ).toEqual( { editorState: { canvas: wanted.surfaces[ 0 ].canvas, layers: wanted.surfaces[ 0 ].layers },
				source: { ...ctx.request.source, label: ' alpha  set ' }, mode, importedLayerIds: [ 'fresh-1', 'fresh-2', 'fresh-3' ], differentFileVersion: kind === 'image' } );
			for ( const key of Object.keys( before.descriptors ).filter( key => key !== '_snapshot' ) ) {
				expect( Object.getOwnPropertyDescriptor( ctx.session, key ) ).toEqual( before.descriptors[ key ] );
			}
			expect( ctx.session.getStatus() ).toMatchObject( { dirty: true, revisionId: 12, phase: 'ready' } );
			expect( ctx.publisher.publish ).not.toHaveBeenCalled(); expect( ctx.source.release ).not.toHaveBeenCalled();
			expect( ctx.request.allocateId ).toHaveBeenCalledTimes( 3 );
			result.editorState.layers[ 0 ].future.id = 'mutated result'; result.editorState.canvas.width = 1; result.source.owner = 'mutated'; result.importedLayerIds.push( 'forged' );
			expect( ctx.session._snapshot ).toEqual( wanted ); refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) );
		} );
	it( 'cancels without source inspection, request getters, reading or allocation', async () => {
		const ctx = await context(), getter = jest.fn( () => { throw new Error( 'secret' ); } ), request = { mode: 'cancel' };
		for ( const key of [ 'source', 'maxLayers', 'allocateId' ] ) {
			Object.defineProperty( request, key, { enumerable: true, get: getter } );
		}
		const before = witness( ctx.session );
		await expect( ctx.session.prepareWorkingCopyImport( null, request ) ).resolves.toBeNull(); preserved( ctx.session, before );
		expect( getter ).not.toHaveBeenCalled(); expect( ctx.source.prepare ).not.toHaveBeenCalled(); expect( ctx.targetReader.read ).toHaveBeenCalledTimes( 1 );
	} );
	it.each( [ 'unloaded', 'loading', 'saving', 'conflict', 'uncertain', 'disposed', 'unknown' ] )( 'refuses phase %s before source reading', async phase => {
		const ctx = await context(); ctx.session._phase = phase; const before = witness( ctx.session );
		await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); preserved( ctx.session, before ); expect( ctx.source.prepare ).not.toHaveBeenCalled();
	} );
	it.each( mutations.filter( ( [ name ] ) => ![ 'layer', 'canvas', 'label', 'order', 'sibling', 'root', 'pins', 'equal replacement', 'saved base', 'revision', 'owner', 'page',
		'reader dependency', 'reader method', 'adapter dependency', 'publisher dependency' ].includes( name ) ) )(
		'refuses unavailable %s on entry without source reading', async ( name, mutate ) => {
			const ctx = await context(); mutate( ctx.session ); const before = witness( ctx.session );
			await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); preserved( ctx.session, before ); expect( ctx.source.prepare ).not.toHaveBeenCalled();
		} );
	it( 'explicitly refuses empty-base while ordinary empty session load/update still works', async () => {
		const fresh = surface( 'target', 'slide', false );
		const ctx = await context( 'slide', 'empty', { newSurface: fresh, emptyBase: true } ), before = witness( ctx.session );
		await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); preserved( ctx.session, before );
		expect( ctx.targetReader.read ).not.toHaveBeenCalled(); expect( ctx.sourceReader.read ).not.toHaveBeenCalled();
		ctx.session.update( { canvas: fresh.canvas, layers: [ { id: 'ordinary', type: 'text', text: 'ordinary update' } ] } );
		expect( ctx.session.getEditorState().layers[ 0 ].id ).toBe( 'ordinary' );
	} );
	it.each( [ 'image', 'slide' ] )( 'supports a new empty %s target in an existing document', async kind => {
		const ctx = await context( kind, 'empty' ); ctx.base.surfaces.shift();
		const fresh = surface( 'target', kind, false );
		const session = new Session( { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target', newSurface: fresh },
			{ reader: ctx.targetReader, publisher: ctx.publisher, adapter: ctx.adapter } );
		await session.load(); ctx.session = session; const wanted = expected( { ...ctx, session: { _snapshot: { ...session._snapshot, surfaces: [ session._snapshot.surfaces[ 1 ], session._snapshot.surfaces[ 0 ] ] } } } );
		const handle = await session.prepareWorkingCopyImport( ctx.source, ctx.request ); await session.revalidateWorkingCopyImport( handle ); session.commitWorkingCopyImport( handle );
		expect( session._snapshot ).toEqual( { ...wanted, surfaces: [ wanted.surfaces[ 1 ], wanted.surfaces[ 0 ] ] } ); expect( session.isUnsavedNew() ).toBe( true ); expect( session._newSurface ).toEqual( fresh );
	} );
	it.each( [ 'image', 'slide' ] )( 'retains no-op dirty comparison for empty %s imports', async kind => {
		const ctx = await context( kind, 'empty' ), selected = ctx.response.snapshot.surfaces[ 1 ];
		selected.layers = []; selected.readingOrder = []; selected.canvas = clone( ctx.base.surfaces[ 0 ].canvas );
		const before = ctx.session.getDraft(); const handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
		await ctx.session.revalidateWorkingCopyImport( handle ); ctx.session.commitWorkingCopyImport( handle );
		expect( ctx.session.getDraft() ).toEqual( before ); expect( ctx.session.getStatus().dirty ).toBe( false ); expect( ctx.request.allocateId ).not.toHaveBeenCalled();
	} );
	it( 'reports equal image versions without changing pins', async () => {
		const ctx = await context(); ctx.response.snapshot.surfaces[ 1 ].source = clone( ctx.base.surfaces[ 0 ].source );
		const handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); expect( ctx.session.inspectWorkingCopyImport( handle ).differentFileVersion ).toBe( false );
	} );
	it( 'captures descriptor-safe request and source methods before the first await', async () => {
		const ctx = await context(), gate = deferred(), wanted = expected( ctx ); ctx.sourceReader.read.mockReturnValueOnce( gate.promise );
		const pending = ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
		ctx.request.mode = 'empty'; ctx.request.source.owner = 'mutated'; ctx.request.maxLayers = 1; ctx.request.allocateId = () => { throw new Error( 'replaced' ); };
		gate.resolve( clone( ctx.response ) ); const handle = await pending; expect( ctx.session.inspectWorkingCopyImport( handle ).candidateSnapshot ).toEqual( wanted );
	} );
	it.each( [ 'source', 'mode', 'maxLayers', 'allocateId' ] )( 'refuses accessor request field %s without executing it', async key => {
		const ctx = await context(), getter = jest.fn( () => { throw new Error( 'secret' ); } ); Object.defineProperty( ctx.request, key, { enumerable: true, get: getter } );
		await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); expect( getter ).not.toHaveBeenCalled(); expect( ctx.sourceReader.read ).not.toHaveBeenCalled();
	} );
	it.each( [ 'targetSnapshot', 'targetSurfaceId', 'permission', 'readOnly', 'extra' ] )( 'refuses caller-supplied %s', async key => {
		const ctx = await context(); ctx.request[ key ] = true; await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); expect( ctx.sourceReader.read ).not.toHaveBeenCalled();
	} );
	it.each( [ 'prepare', 'inspect', 'revalidate', 'release' ] )( 'refuses unsafe source method descriptor %s before await', async key => {
		const ctx = await context(), getter = jest.fn(); Object.defineProperty( ctx.source, key, { get: getter } );
		await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); expect( getter ).not.toHaveBeenCalled(); expect( ctx.sourceReader.read ).not.toHaveBeenCalled();
	} );
	it.each( [ 'source', 'mode', 'target', 'root', 'sibling', 'pins', 'canvas', 'IDs' ] )( 'rejects forged preview %s rather than extracting only the target', async kind => {
		const ctx = await context(), original = ctx.source.inspect.getMockImplementation();
		ctx.source.inspect.mockImplementation( handle => {
			const preview = original( handle );
			if ( kind === 'source' ) { preview.source.owner = 'wrong'; }
			if ( kind === 'mode' ) { preview.mode = 'append'; }
			if ( kind === 'target' ) { preview.targetSurfaceId = 'other'; }
			if ( kind === 'root' ) { preview.candidateSnapshot.rootData.future.push( 'forged' ); }
			if ( kind === 'sibling' ) { preview.candidateSnapshot.surfaces[ 1 ].label = 'forged'; }
			if ( kind === 'pins' ) { preview.candidateSnapshot.surfaces[ 0 ].source.sha1 = 'forged'; }
			if ( kind === 'canvas' ) { preview.candidateSnapshot.surfaces[ 0 ].canvas.width = 1; }
			if ( kind === 'IDs' ) { preview.importedLayerIds.push( 'missing' ); }
			return preview;
		} );
		const before = witness( ctx.session ); await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); preserved( ctx.session, before ); expect( ctx.source.release ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'previews are detached and result mutation never aliases committed snapshots', async () => {
		const ctx = await context(), wanted = expected( ctx ), handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
		const preview = ctx.session.inspectWorkingCopyImport( handle ); preview.candidateSnapshot.rootData.future.push( 'forged' ); preview.source.owner = 'forged'; preview.importedLayerIds.push( 'forged' );
		expect( ctx.session.inspectWorkingCopyImport( handle ).candidateSnapshot ).toEqual( wanted );
		await ctx.session.revalidateWorkingCopyImport( handle ); const result = ctx.session.commitWorkingCopyImport( handle ); result.editorState.layers.length = 0; expect( ctx.session._snapshot ).toEqual( wanted );
	} );
	for ( const phase of [ 'prepare', 'target', 'source', 'commit' ] ) {
		it.each( mutations )( 'preserves complete newer %s work in ' + phase + ' gap', async ( name, mutate ) => {
			const ctx = await context(), gate = deferred(); let handle, pending;
			if ( phase === 'prepare' ) {
				ctx.sourceReader.read.mockReturnValueOnce( gate.promise ); pending = ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
			} else {
				handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
				if ( phase === 'commit' ) {
					await ctx.session.revalidateWorkingCopyImport( handle );
					const original = ctx.source.inspect.getMockImplementation(); let before;
					ctx.source.inspect.mockImplementationOnce( sourceHandle => { const preview = original( sourceHandle ); mutate( ctx.session ); before = witness( ctx.session ); return preview; } );
					refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); expect( before ).toBeDefined(); preserved( ctx.session, before ); return;
				}
				if ( phase === 'target' ) { ctx.targetReader.read.mockReturnValueOnce( gate.promise ); }
				if ( phase === 'source' ) { ctx.sourceReader.read.mockReturnValueOnce( gate.promise ); }
				pending = ctx.session.revalidateWorkingCopyImport( handle );
				if ( phase === 'source' ) { for ( let step = 0; step < 12 && ctx.sourceReader.read.mock.calls.length < 2; step++ ) { await Promise.resolve(); } expect( ctx.sourceReader.read ).toHaveBeenCalledTimes( 2 ); }
			}
			mutate( ctx.session ); const before = witness( ctx.session );
			gate.resolve( phase === 'target' ? { revisionId: 12, snapshot: clone( ctx.base ), sourceGeometry: {} } : clone( ctx.response ) );
			await refused( pending ); preserved( ctx.session, before ); expect( ctx.publisher.publish ).not.toHaveBeenCalled();
			if ( handle ) { refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); preserved( ctx.session, before ); }
		} );
	}
	it.each( [ 'revision', 'layers', 'root', 'sibling', 'pins', 'schema', 'missing', 'getter', 'undefined' ] )( 'refuses changed exact target-base %s and clears approval', async kind => {
		const ctx = await context(), handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); await ctx.session.revalidateWorkingCopyImport( handle );
		const response = { revisionId: 12, snapshot: clone( ctx.base ), sourceGeometry: {} };
		if ( kind === 'revision' ) { response.revisionId = 13; }
		if ( kind === 'layers' ) { response.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'altered exact base'; }
		if ( kind === 'root' ) { response.snapshot.rootData.future.push( 'changed' ); }
		if ( kind === 'sibling' ) { response.snapshot.surfaces[ 1 ].label = 'changed'; }
		if ( kind === 'pins' ) { response.snapshot.surfaces[ 0 ].source.sha1 = 'changed'; }
		if ( kind === 'schema' ) { response.snapshot.schemaVersion = 2; }
		if ( kind === 'missing' ) { delete response.snapshot; }
		if ( kind === 'getter' ) { Object.defineProperty( response, 'snapshot', { get: () => { throw new Error( 'private' ); } } ); }
		if ( kind === 'undefined' ) { response.snapshot.rootData.extra = undefined; }
		ctx.targetReader.read.mockResolvedValueOnce( response ); const before = witness( ctx.session );
		await refused( ctx.session.revalidateWorkingCopyImport( handle ) ); refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); preserved( ctx.session, before );
	} );
	it( 'accepts key-order-independent complete base equality through accepted API readers', async () => {
		const ctx = await context();
		const api = { get: jest.fn( async () => ( { layersread: { revisionId: 12, snapshot: { surfaces: clone( ctx.base.surfaces ), rootData: clone( ctx.base.rootData ), revision: 99, owner: ctx.base.owner, schemaVersion: 1 }, sourceGeometry: {} } } ) ) };
		ctx.session._reader = new Reader( api );
		const handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); await ctx.session.revalidateWorkingCopyImport( handle );
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersread', formatversion: 2, owner: 'Target Page', revid: 12 } ); ctx.session.commitWorkingCopyImport( handle );
	} );
	it.each( [ 'permissiondenied', 'deleted', 'hidden', 'suppressed', 'transport' ] )( 'redacts target/source %s failures and never approves commit', async code => {
		for ( const dependency of [ 'targetReader', 'sourceReader' ] ) {
			const ctx = await context(), handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ), before = witness( ctx.session );
			ctx[ dependency ].read.mockRejectedValueOnce( { code, message: 'secret source', private: 'sensitive' } );
			await refused( ctx.session.revalidateWorkingCopyImport( handle ) ); refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); preserved( ctx.session, before );
		}
	} );
	it( 'independent handles have separate approvals and release affects only its own source handle', async () => {
		const ctx = await context(), first = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ), second = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
		await ctx.session.revalidateWorkingCopyImport( first ); refusedSync( () => ctx.session.commitWorkingCopyImport( second ) );
		ctx.session.releaseWorkingCopyImport( first ); expect( ctx.source.release ).toHaveBeenCalledTimes( 1 );
		refusedSync( () => ctx.session.inspectWorkingCopyImport( first ) ); expect( ctx.session.inspectWorkingCopyImport( second ).importedLayerIds ).toEqual( [ 'fresh-4', 'fresh-5', 'fresh-6' ] );
		await ctx.session.revalidateWorkingCopyImport( second ); ctx.session.commitWorkingCopyImport( second ); expect( ctx.source.release ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'overlapping checks refuse without clearing the in-flight checking flag', async () => {
		const ctx = await context(), handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ), gate = deferred(); ctx.targetReader.read.mockReturnValueOnce( gate.promise );
		const checking = ctx.session.revalidateWorkingCopyImport( handle ); await refused( ctx.session.revalidateWorkingCopyImport( handle ) );
		await refused( ctx.session.revalidateWorkingCopyImport( handle ) ); refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); expect( ctx.targetReader.read ).toHaveBeenCalledTimes( 2 );
		gate.resolve( { revisionId: 12, snapshot: clone( ctx.base ), sourceGeometry: {} } ); await checking; ctx.session.commitWorkingCopyImport( handle );
	} );
	it.each( [ 'inspect', 'recheck', 'commit', 'release' ] )( 'refuses forged and foreign handles in %s', async method => {
		const ctx = await context(), other = await context(), foreign = await other.session.prepareWorkingCopyImport( other.source, other.request );
		for ( const handle of [ {}, Object.freeze( Object.create( null ) ), null, 1, foreign ] ) {
			if ( method === 'recheck' ) { await refused( ctx.session.revalidateWorkingCopyImport( handle ) ); } else {
				const name = { inspect: 'inspectWorkingCopyImport', commit: 'commitWorkingCopyImport', release: 'releaseWorkingCopyImport' }[ method ]; refusedSync( () => ctx.session[ name ]( handle ) );
			}
		}
	} );
	it.each( [ 'release', 'dispose' ] )( 'source %s invalidates lifetime before synchronous commit', async method => {
		const ctx = await context(), handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); await ctx.session.revalidateWorkingCopyImport( handle );
		if ( method === 'release' ) { ctx.component.release( ctx.source.prepare.mock.results[ 0 ].value && await ctx.source.prepare.mock.results[ 0 ].value ); } else { ctx.component.dispose(); }
		const before = witness( ctx.session ); refusedSync( () => ctx.session.inspectWorkingCopyImport( handle ) ); refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); preserved( ctx.session, before );
	} );
	it( 'cleanup is owned, permitted after disposal, and redacts throwing source cleanup', async () => {
		const ctx = await context(), handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); ctx.session.dispose();
		const before = witness( ctx.session ); ctx.source.release.mockImplementationOnce( () => { throw new Error( 'private cleanup' ); } );
		expect( () => ctx.session.releaseWorkingCopyImport( handle ) ).not.toThrow(); preserved( ctx.session, before ); expect( ctx.source.release ).toHaveBeenCalledTimes( 1 ); refusedSync( () => ctx.session.releaseWorkingCopyImport( handle ) );
	} );
	it.each( [ 'prepare', 'target', 'source' ] )( 'release/disposal during %s cannot revive late handles', async phase => {
		const ctx = await context(), gate = deferred(); let handle, pending;
		if ( phase === 'prepare' ) { ctx.sourceReader.read.mockReturnValueOnce( gate.promise ); pending = ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); ctx.session.dispose(); } else {
			handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request );
			if ( phase === 'target' ) { ctx.targetReader.read.mockReturnValueOnce( gate.promise ); } else { ctx.sourceReader.read.mockReturnValueOnce( gate.promise ); }
			pending = ctx.session.revalidateWorkingCopyImport( handle );
			if ( phase === 'source' ) { for ( let step = 0; step < 12 && ctx.sourceReader.read.mock.calls.length < 2; step++ ) { await Promise.resolve(); } }
			ctx.session.releaseWorkingCopyImport( handle );
		}
		const before = witness( ctx.session ); gate.resolve( phase === 'target' ? { revisionId: 12, snapshot: clone( ctx.base ), sourceGeometry: {} } : clone( ctx.response ) );
		await refused( pending ); preserved( ctx.session, before ); if ( handle ) { refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); }
	} );
	it.each( [ 'allocator', 'inspect', 'adapter' ] )( 'redacts throwing %s preflight callback and preserves newer work', async dependency => {
		const ctx = await context(); let before;
		const callback = () => { ctx.session._snapshot.rootData.future.push( 'newer callback work' ); before = witness( ctx.session ); throw new Error( 'private callback' ); };
		if ( dependency === 'allocator' ) { ctx.request.allocateId.mockImplementationOnce( callback ); await refused( ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ) ); } else {
			const handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); await ctx.session.revalidateWorkingCopyImport( handle );
			if ( dependency === 'inspect' ) { ctx.source.inspect.mockImplementationOnce( callback ); } else {
				const original = ctx.adapter.toEditorState.bind( ctx.adapter ); const spy = jest.spyOn( ctx.adapter, 'toEditorState' );
				ctx.session.releaseWorkingCopyImport( handle ); const fresh = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); await ctx.session.revalidateWorkingCopyImport( fresh );
				spy.mockImplementationOnce( callback ); refusedSync( () => ctx.session.commitWorkingCopyImport( fresh ) ); spy.mockImplementation( original );
			}
			if ( dependency === 'inspect' ) { refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); }
		}
		expect( before ).toBeDefined(); preserved( ctx.session, before );
	} );
	it( 'preflights assignment descriptors and makes no external call after snapshot mutation', async () => {
		const ctx = await context(), handle = await ctx.session.prepareWorkingCopyImport( ctx.source, ctx.request ); await ctx.session.revalidateWorkingCopyImport( handle );
		Object.defineProperty( ctx.session, '_snapshot', { writable: false } ); const before = witness( ctx.session ); refusedSync( () => ctx.session.commitWorkingCopyImport( handle ) ); preserved( ctx.session, before );
		const clean = await context(), original = clean.source.inspect.getMockImplementation(); let assigned = false;
		clean.source.inspect.mockImplementation( sourceHandle => { expect( assigned ).toBe( false ); return original( sourceHandle ); } );
		const prepared = await clean.session.prepareWorkingCopyImport( clean.source, clean.request ); await clean.session.revalidateWorkingCopyImport( prepared );
		const snapshot = clean.session._snapshot; clean.source.release.mockImplementation( () => { throw new Error( 'must not release after commit' ); } );
		const result = clean.session.commitWorkingCopyImport( prepared ); assigned = clean.session._snapshot !== snapshot;
		expect( assigned ).toBe( true ); expect( result.importedLayerIds ).toHaveLength( 3 ); expect( clean.source.release ).not.toHaveBeenCalled(); expect( clean.publisher.publish ).not.toHaveBeenCalled();
	} );
} );