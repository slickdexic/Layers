'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const vm = require( 'vm' );
const { spawnSync } = require( 'child_process' );
const Source = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
const Planner = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Reader = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );

const clone = value => JSON.parse( JSON.stringify( value ) );
const freeze = value => {
	if ( value && typeof value === 'object' ) {
		Object.values( value ).forEach( freeze );
		Object.freeze( value );
	}
	return value;
};
const deferred = () => {
	let resolve, reject;
	const promise = new Promise( ( accept, refuse ) => { resolve = accept; reject = refuse; } );
	return { promise, resolve, reject };
};
const errorShape = { code: 'layers-working-copy-import-unavailable', message: 'Working-copy Import unavailable' };
async function refused( promise ) {
	try {
		await promise;
		throw new Error( 'Expected exact-source refusal' );
	} catch ( error ) {
		expect( { code: error.code, message: error.message } ).toEqual( errorShape );
		expect( Object.keys( error ) ).toEqual( [ 'code' ] );
	}
}
function refusedSync( action ) {
	try {
		action();
		throw new Error( 'Expected exact-source refusal' );
	} catch ( error ) {
		expect( { code: error.code, message: error.message } ).toEqual( errorShape );
	}
}
function surface( id = 'target', kind = 'image', populated = true ) {
	const result = {
		id, kind, label: 'Alpha_Set', canvas: { width: 500, height: 300, background: '#abc', future: { id } },
		layers: populated ? [ { id: 'old', type: 'textbox', text: 'old', richText: [ { text: 'retained', style: { color: '#123' } } ] } ] : [],
		readingOrder: populated ? [ 'old' ] : [], owner: 'Target Owner', metadata: { id, source: 'literal', revision: 123 }
	};
	if ( kind === 'image' ) {
		result.source = { fileTitle: 'File:Exact.jpg', timestamp: '20261001010101', sha1: 'target-sha', repository: 'local', width: 500, futurePin: { keep: true } };
	}
	return result;
}
function target( kind = 'image', populated = true ) {
	return { schemaVersion: 1, revision: 17, owner: 'Target Owner', rootData: { values: [ null, false, 0, 'old' ] }, surfaces: [ surface( 'target', kind, populated ), {
		id: 'unrelated', kind: 'pdf', label: 'Alpha_Set', source: { fileTitle: 'File:Other.pdf', page: 4 },
		canvas: { width: 200, height: 250 }, layers: [ { id: 'old', type: 'future', full: [ 1, 2 ] } ], readingOrder: [ 'old' ]
	} ] };
}
function bundle( kind = 'image' ) {
	const selected = surface( 'selected', kind );
	selected.label = ' alpha  set ';
	selected.owner = 'Source Owner';
	selected.canvas = { width: 850, height: 650, background: '#def', locked: true, future: { untouched: [ 1, 2 ] } };
	if ( kind === 'image' ) {
		selected.source.timestamp = '20260901010101';
		selected.source.sha1 = 'source-sha';
		selected.source.repository = 'foreign';
	}
	selected.layers = [
		{ id: 'group', type: 'group', children: [ 'text', 'image' ], future: { id: 'group' } },
		{ id: 'text', type: 'textbox', parentGroup: 'group', text: 'text', richText: [ { text: 'full', style: { fontSize: 24 } } ],
			gradient: { type: 'linear', colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] },
			points: [ { x: 2, y: 4 } ], future: { literal: 'old', nested: [ null, false, 7 ] } },
		{ id: 'image', type: 'image', parentGroup: 'group', src: 'data:image/png;base64,AAAA', originalWidth: 12, originalHeight: 13, children: [ 'literal' ] }
	];
	selected.readingOrder = [ 'image', 'text' ];
	const wrongFile = surface( 'wrong-file', kind );
	if ( kind === 'image' ) {
		wrongFile.source.fileTitle = 'File:Other.jpg';
	}
	return { revisionId: 42, sourceGeometry: { selected: { width: 850, height: 650 } }, snapshot: {
		schemaVersion: 1, revision: 42, owner: 'Source Owner', unknown: { full: true },
		surfaces: [ wrongFile, surface( 'compatible-but-not-selected', kind ), selected ]
	} };
}
function context( kind = 'image', mode = 'append', response = bundle( kind ) ) {
	const reader = { read: jest.fn().mockResolvedValue( response ) }, allocator = jest.fn();
	let counter = 0;
	allocator.mockImplementation( () => 'fresh-' + ++counter );
	const adapter = new Adapter(), planner = { prepare: jest.fn( Planner.prepare.bind( Planner ) ) };
	const component = new Source( { reader, planner, adapter } );
	const request = { targetSnapshot: target( kind, mode !== 'empty' ), targetSurfaceId: 'target',
		source: { owner: ' Source_Page ', revisionId: 42, surfaceId: 'selected' }, mode, maxLayers: 30, allocateId: allocator };
	return { reader, planner, adapter, allocator, component, request, response };
}
function expected( request, response ) {
	const result = clone( request.targetSnapshot ), chosen = clone( response.snapshot.surfaces[ 2 ] );
	const selected = result.surfaces[ 0 ], imported = chosen.layers;
	imported[ 0 ].id = 'fresh-1'; imported[ 0 ].children = [ 'fresh-2', 'fresh-3' ];
	imported[ 1 ].id = 'fresh-2'; imported[ 1 ].parentGroup = 'fresh-1';
	imported[ 2 ].id = 'fresh-3'; imported[ 2 ].parentGroup = 'fresh-1';
	selected.layers = request.mode === 'append' ? imported.concat( selected.layers ) : imported;
	selected.readingOrder = request.mode === 'append' ? [ 'old', 'fresh-3', 'fresh-2' ] : [ 'fresh-3', 'fresh-2' ];
	if ( request.mode === 'empty' && selected.kind === 'slide' ) {
		selected.canvas = chosen.canvas;
	}
	return result;
}

describe( 'PageOwnedWorkingCopyImportSource', () => {
	it.each( [ [ 'image', 'empty' ], [ 'image', 'append' ], [ 'image', 'replace' ], [ 'slide', 'empty' ], [ 'slide', 'append' ], [ 'slide', 'replace' ] ] )(
		'prepares the exact complete %s/%s candidate and literal provenance', async ( kind, mode ) => {
			const ctx = context( kind, mode ), wanted = expected( ctx.request, ctx.response );
			freeze( ctx.request ); freeze( ctx.response );
			const handle = await ctx.component.prepare( ctx.request );
			expect( Object.isFrozen( handle ) ).toBe( true ); expect( Reflect.ownKeys( handle ) ).toEqual( [] );
			expect( Object.getPrototypeOf( handle ) ).toBeNull();
			expect( ctx.component.inspect( handle ) ).toEqual( {
				source: { ...ctx.request.source, label: ' alpha  set ' }, targetSurfaceId: 'target', mode,
				importedLayerIds: [ 'fresh-1', 'fresh-2', 'fresh-3' ], candidateSnapshot: wanted, differentFileVersion: kind === 'image'
			} );
			expect( ctx.reader.read ).toHaveBeenCalledWith( { owner: ' Source_Page ', revisionId: 42 } );
			expect( ctx.allocator ).toHaveBeenCalledTimes( 3 );
			await expect( ctx.component.revalidate( handle ) ).resolves.toBeUndefined();
			expect( ctx.reader.read ).toHaveBeenCalledTimes( 2 );
		} );

	it( 'cancels without source/snapshot inspection, read or allocation', async () => {
		const ctx = context(), getters = jest.fn( () => { throw new Error( 'sensitive' ); } );
		const request = { mode: 'cancel' };
		for ( const name of [ 'source', 'targetSnapshot', 'allocateId' ] ) {
			Object.defineProperty( request, name, { enumerable: true, get: getters } );
		}
		await expect( ctx.component.prepare( request ) ).resolves.toBeNull();
		expect( getters ).not.toHaveBeenCalled(); expect( ctx.reader.read ).not.toHaveBeenCalled(); expect( ctx.allocator ).not.toHaveBeenCalled();
	} );
	it( 'refuses an inexact returned revision', async () => {
		const ctx = context(); ctx.response.revisionId = 43;
		await refused( ctx.component.prepare( ctx.request ) ); expect( ctx.allocator ).not.toHaveBeenCalled();
	} );
	it( 'refuses a missing exact source ID despite a compatible first surface', async () => {
		const ctx = context(); ctx.request.source.surfaceId = 'absent';
		ctx.response.snapshot.surfaces[ 0 ] = surface( 'first-compatible' );
		await refused( ctx.component.prepare( ctx.request ) ); expect( ctx.allocator ).not.toHaveBeenCalled();
	} );
	it( 'rereads on every revalidation and refuses changed complete source data', async () => {
		const ctx = context(), handle = await ctx.component.prepare( ctx.request ), changed = clone( ctx.response );
		changed.snapshot.surfaces[ 2 ].layers[ 1 ].text = 'changed';
		ctx.reader.read.mockResolvedValueOnce( changed );
		await refused( ctx.component.revalidate( handle ) ); expect( ctx.reader.read ).toHaveBeenCalledTimes( 2 );
		await expect( ctx.component.revalidate( handle ) ).resolves.toBeUndefined(); expect( ctx.reader.read ).toHaveBeenCalledTimes( 3 );
		expect( ctx.allocator ).toHaveBeenCalledTimes( 3 );
	} );
	it.each( [ 'permissiondenied', 'layers-revision-unavailable', 'layers-reading-disabled', 'layers-reading-failed', 'deleted', 'suppressed', 'hidden', 'transport' ] )(
		'refuses and redacts native reader category %s on preparation and recheck', async code => {
			const ctx = context(), handle = await ctx.component.prepare( ctx.request );
			ctx.reader.read.mockRejectedValue( { code, message: 'private content', secret: 'sensitive', stack: 'private trace' } );
			await refused( ctx.component.prepare( ctx.request ) ); await refused( ctx.component.revalidate( handle ) );
		} );
	it.each( [
		[ 'duplicate source ID', ctx => ctx.response.snapshot.surfaces.push( clone( ctx.response.snapshot.surfaces[ 2 ] ) ) ],
		[ 'wrong canonical file', ctx => { ctx.response.snapshot.surfaces[ 2 ].source.fileTitle = 'File:Other.jpg'; } ],
		[ 'case-changed file', ctx => { ctx.response.snapshot.surfaces[ 2 ].source.fileTitle = 'File:exact.jpg'; } ],
		[ 'wrong kind', ctx => { ctx.response.snapshot.surfaces[ 2 ].kind = 'slide'; } ],
		[ 'PDF source', ctx => { ctx.response.snapshot.surfaces[ 2 ].kind = 'pdf'; } ],
		[ 'wrong name', ctx => { ctx.response.snapshot.surfaces[ 2 ].label = 'Another'; } ],
		[ 'missing source snapshot', ctx => { delete ctx.response.snapshot; } ],
		[ 'bad schema', ctx => { ctx.response.snapshot.schemaVersion = 2; } ],
		[ 'duplicate target ID', ctx => ctx.request.targetSnapshot.surfaces.push( clone( ctx.request.targetSnapshot.surfaces[ 0 ] ) ) ],
		[ 'missing target ID', ctx => { ctx.request.targetSurfaceId = 'absent'; } ],
		[ 'PDF target', ctx => { ctx.request.targetSnapshot.surfaces[ 0 ].kind = 'pdf'; } ],
		[ 'wrong occupancy', ctx => { ctx.request.mode = 'empty'; } ],
		[ 'layer cap', ctx => { ctx.request.maxLayers = 3; } ],
		[ 'broken group', ctx => { ctx.response.snapshot.surfaces[ 2 ].layers[ 0 ].children = [ 'missing' ]; } ],
		[ 'invalid order', ctx => { ctx.response.snapshot.surfaces[ 2 ].readingOrder = [ 'missing' ]; } ]
	] )( 'refuses %s', async ( name, mutate ) => {
		const ctx = context(); mutate( ctx ); await refused( ctx.component.prepare( ctx.request ) );
	} );
	it.each( [ 'timestamp', 'sha1', 'repository' ] )( 'reports the captured %s version difference without changing pins', async key => {
		const ctx = context(); ctx.response.snapshot.surfaces[ 2 ].source = clone( ctx.request.targetSnapshot.surfaces[ 0 ].source );
		ctx.response.snapshot.surfaces[ 2 ].source[ key ] = 'other';
		const handle = await ctx.component.prepare( ctx.request );
		expect( ctx.component.inspect( handle ).differentFileVersion ).toBe( true );
		expect( ctx.component.inspect( handle ).candidateSnapshot.surfaces[ 0 ].source ).toEqual( ctx.request.targetSnapshot.surfaces[ 0 ].source );
	} );
	it( 'reports equal image versions and preserves normalized-name spelling', async () => {
		const ctx = context(); ctx.response.snapshot.surfaces[ 2 ].source = clone( ctx.request.targetSnapshot.surfaces[ 0 ].source );
		ctx.request.targetSnapshot.surfaces[ 0 ].label = '  ALPHA__SET  ';
		const handle = await ctx.component.prepare( ctx.request ), preview = ctx.component.inspect( handle );
		expect( preview.differentFileVersion ).toBe( false ); expect( preview.candidateSnapshot.surfaces[ 0 ].label ).toBe( '  ALPHA__SET  ' );
	} );
	it( 'captures request values and complete target before the first await', async () => {
		const ctx = context(), pending = deferred(), wanted = expected( ctx.request, ctx.response );
		ctx.reader.read.mockReturnValueOnce( pending.promise );
		const promise = ctx.component.prepare( ctx.request );
		ctx.request.source.owner = 'Other'; ctx.request.source.revisionId = 999; ctx.request.source.surfaceId = 'wrong-file';
		ctx.request.targetSnapshot.surfaces[ 0 ].layers[ 0 ].text = 'mutated'; ctx.request.targetSnapshot.rootData.values.push( 'mutated' );
		ctx.request.targetSurfaceId = 'unrelated'; ctx.request.mode = 'replace'; ctx.request.maxLayers = 1;
		ctx.request.allocateId = () => { throw new Error( 'replacement allocator' ); };
		pending.resolve( ctx.response ); const handle = await promise;
		expect( ctx.component.inspect( handle ).candidateSnapshot ).toEqual( wanted );
		expect( ctx.component.inspect( handle ).source ).toEqual( { owner: ' Source_Page ', revisionId: 42, surfaceId: 'selected', label: ' alpha  set ' } );
	} );
	it( 'keeps no reader/request/preview aliases after copying', async () => {
		const ctx = context(), wanted = expected( ctx.request, ctx.response ), handle = await ctx.component.prepare( ctx.request );
		ctx.response.snapshot.surfaces[ 2 ].layers[ 1 ].text = 'mutated reader'; ctx.request.targetSnapshot.rootData.values.push( 'mutated request' );
		const preview = ctx.component.inspect( handle ); preview.candidateSnapshot.surfaces[ 0 ].layers[ 1 ].text = 'mutated preview';
		preview.candidateSnapshot.rootData.values.push( 'mutated preview' ); preview.source.owner = 'forged'; preview.importedLayerIds.push( 'forged' );
		expect( ctx.component.inspect( handle ).candidateSnapshot ).toEqual( wanted );
		await refused( ctx.component.revalidate( handle ) );
	} );
	it( 'revalidation compares complete source content independent of object key order', async () => {
		const ctx = context(), handle = await ctx.component.prepare( ctx.request );
		const reorder = value => Array.isArray( value ) ? value.map( reorder ) : value && typeof value === 'object' ?
			Object.fromEntries( Object.keys( value ).reverse().map( key => [ key, reorder( value[ key ] ) ] ) ) : value;
		ctx.reader.read.mockResolvedValue( reorder( ctx.response ) ); await expect( ctx.component.revalidate( handle ) ).resolves.toBeUndefined();
	} );
	it.each( [
		[ 'revision', data => { data.revisionId = 43; } ],
		[ 'source pin', data => { data.snapshot.surfaces[ 2 ].source.sha1 = 'new'; } ],
		[ 'source label', data => { data.snapshot.surfaces[ 2 ].label = 'ALPHA_SET'; } ],
		[ 'source id', data => { data.snapshot.surfaces[ 2 ].id = 'gone'; } ],
		[ 'other source surface', data => { data.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'changed'; } ],
		[ 'root metadata', data => { data.snapshot.unknown.full = false; } ],
		[ 'source geometry', data => { data.sourceGeometry.selected.width = 2; } ],
		[ 'layer order', data => { data.snapshot.surfaces[ 2 ].layers.reverse(); } ]
	] )( 'refuses fresh changed %s without refreshing candidate or allocating IDs', async ( name, mutate ) => {
		const ctx = context(), handle = await ctx.component.prepare( ctx.request ), preview = ctx.component.inspect( handle ), changed = clone( ctx.response );
		mutate( changed ); ctx.reader.read.mockResolvedValueOnce( changed ); await refused( ctx.component.revalidate( handle ) );
		expect( ctx.component.inspect( handle ) ).toEqual( preview ); expect( ctx.allocator ).toHaveBeenCalledTimes( 3 );
	} );
	it.each( [ null, undefined, {}, Object.freeze( {} ), { candidateSnapshot: target(), authorized: true } ] )( 'refuses forged handle %s', async handle => {
		const ctx = context(); refusedSync( () => ctx.component.inspect( handle ) ); refusedSync( () => ctx.component.release( handle ) );
		await refused( ctx.component.revalidate( handle ) ); expect( ctx.reader.read ).not.toHaveBeenCalled();
	} );
	it( 'refuses foreign and released handles without reading and does not invalidate others', async () => {
		const ctx = context(), other = context(), handle = await ctx.component.prepare( ctx.request ), second = await ctx.component.prepare( ctx.request );
		refusedSync( () => other.component.inspect( handle ) ); await refused( other.component.revalidate( handle ) );
		ctx.component.release( handle ); refusedSync( () => ctx.component.inspect( handle ) ); await refused( ctx.component.revalidate( handle ) );
		refusedSync( () => ctx.component.release( handle ) ); expect( ctx.component.inspect( second ).mode ).toBe( 'append' );
	} );
	it( 'dispose invalidates all handles and pending preparation', async () => {
		const ctx = context(), handle = await ctx.component.prepare( ctx.request ), wait = deferred();
		ctx.reader.read.mockReturnValueOnce( wait.promise ); const preparation = ctx.component.prepare( ctx.request );
		ctx.component.dispose(); ctx.component.dispose(); wait.resolve( ctx.response ); await refused( preparation );
		refusedSync( () => ctx.component.inspect( handle ) ); await refused( ctx.component.revalidate( handle ) );
		await refused( ctx.component.prepare( { mode: 'cancel' } ) ); expect( ctx.allocator ).toHaveBeenCalledTimes( 3 );
	} );
	it.each( [ 'release', 'dispose' ] )( 'refuses a late revalidation after %s', async operation => {
		const ctx = context(), handle = await ctx.component.prepare( ctx.request ), wait = deferred();
		ctx.reader.read.mockReturnValueOnce( wait.promise ); const pending = ctx.component.revalidate( handle );
		ctx.component[ operation ]( handle ); wait.resolve( ctx.response ); await refused( pending );
	} );
	it( 'independent concurrent preparations retain exact descriptor and result', async () => {
		const ctx = context(), first = deferred(), second = deferred(), otherResponse = clone( ctx.response ), secondRequest = { ...ctx.request, source: { ...ctx.request.source, owner: 'Other Owner', revisionId: 75 } };
		otherResponse.revisionId = 75; otherResponse.snapshot.surfaces[ 2 ].layers[ 1 ].text = 'second';
		ctx.reader.read.mockReturnValueOnce( first.promise ).mockReturnValueOnce( second.promise );
		const firstResult = ctx.component.prepare( ctx.request ), secondResult = ctx.component.prepare( secondRequest );
		second.resolve( otherResponse ); const secondHandle = await secondResult; first.resolve( ctx.response ); const firstHandle = await firstResult;
		expect( ctx.component.inspect( firstHandle ).source.revisionId ).toBe( 42 ); expect( ctx.component.inspect( secondHandle ).source.revisionId ).toBe( 75 );
		expect( ctx.component.inspect( firstHandle ).candidateSnapshot.surfaces[ 0 ].layers[ 1 ].text ).toBe( 'text' );
		expect( ctx.component.inspect( secondHandle ).candidateSnapshot.surfaces[ 0 ].layers[ 1 ].text ).toBe( 'second' );
	} );
	it( 'independent concurrent rechecks reread each retained descriptor', async () => {
		const ctx = context(), firstHandle = await ctx.component.prepare( ctx.request ), secondHandle = await ctx.component.prepare( ctx.request ), first = deferred(), second = deferred();
		ctx.reader.read.mockReturnValueOnce( first.promise ).mockReturnValueOnce( second.promise );
		const checkFirst = ctx.component.revalidate( firstHandle ), checkSecond = ctx.component.revalidate( secondHandle );
		ctx.component.release( firstHandle ); second.resolve( ctx.response ); await expect( checkSecond ).resolves.toBeUndefined(); first.resolve( ctx.response ); await refused( checkFirst );
		expect( ctx.reader.read ).toHaveBeenCalledTimes( 4 );
	} );
	it.each( [ 'owner', 'revisionId', 'surfaceId' ] )( 'refuses source descriptor accessor %s without execution', async key => {
		const ctx = context(), getter = jest.fn(); Object.defineProperty( ctx.request.source, key, { enumerable: true, get: getter } );
		await refused( ctx.component.prepare( ctx.request ) ); expect( getter ).not.toHaveBeenCalled(); expect( ctx.reader.read ).not.toHaveBeenCalled();
	} );
	it.each( [ 'targetSnapshot', 'targetSurfaceId', 'source', 'mode', 'maxLayers', 'allocateId' ] )( 'refuses request accessor %s without execution', async key => {
		const ctx = context(), getter = jest.fn(); Object.defineProperty( ctx.request, key, { enumerable: true, get: getter } );
		await refused( ctx.component.prepare( ctx.request ) ); expect( getter ).not.toHaveBeenCalled();
	} );
	it.each( [
		[ 'permission field', ctx => { ctx.request.authorized = true; } ],
		[ 'supplied snapshot', ctx => { ctx.request.source.snapshot = ctx.response.snapshot; } ],
		[ 'source permission', ctx => { ctx.request.source.canRead = true; } ],
		[ 'request symbol', ctx => { ctx.request[ Symbol( 'secret' ) ] = true; } ],
		[ 'source symbol', ctx => { ctx.request.source[ Symbol( 'secret' ) ] = true; } ],
		[ 'nonenumerable', ctx => Object.defineProperty( ctx.request, 'source', { value: ctx.request.source, enumerable: false } ) ],
		[ 'inherited source', ctx => { ctx.request.source = Object.create( ctx.request.source ); } ],
		[ 'inherited request', ctx => { ctx.request = Object.create( ctx.request ); } ],
		[ 'blank owner', ctx => { ctx.request.source.owner = ' \t '; } ],
		[ 'zero revision', ctx => { ctx.request.source.revisionId = 0; } ],
		[ 'large revision', ctx => { ctx.request.source.revisionId = 2147483648; } ],
		[ 'fraction revision', ctx => { ctx.request.source.revisionId = 1.1; } ],
		[ 'string revision', ctx => { ctx.request.source.revisionId = '42'; } ],
		[ 'empty source id', ctx => { ctx.request.source.surfaceId = ''; } ],
		[ 'invalid max', ctx => { ctx.request.maxLayers = 0; } ],
		[ 'invalid mode', ctx => { ctx.request.mode = 'Replace'; } ],
		[ 'missing allocator', ctx => { ctx.request.allocateId = null; } ]
	] )( 'refuses %s before a read', async ( name, mutate ) => {
		const ctx = context(); mutate( ctx ); await refused( ctx.component.prepare( ctx.request ) ); expect( ctx.reader.read ).not.toHaveBeenCalled();
	} );
	it.each( [ undefined, NaN, Infinity, 1n, () => {}, Symbol( 'secret' ), new Date(), new Array( 2 ) ] )(
		'refuses unsafe finite-JSON payload %s in target and returned source', async value => {
			const ctx = context(); ctx.request.targetSnapshot.unsafe = value; await refused( ctx.component.prepare( ctx.request ) );
			delete ctx.request.targetSnapshot.unsafe; ctx.response.snapshot.unsafe = value; await refused( ctx.component.prepare( ctx.request ) );
		} );
	it( 'refuses source getters, cycles, reflection failures and extra array keys without leakage', async () => {
		const getter = jest.fn( () => 'secret' );
		const cases = [ data => Object.defineProperty( data.snapshot, 'unsafe', { enumerable: true, get: getter } ),
			data => { data.snapshot.unsafe = data.snapshot; }, data => { data.snapshot.surfaces.extra = true; },
			data => { data.snapshot = new Proxy( {}, { ownKeys() { throw new Error( 'private reflection' ); } } ); } ];
		for ( const mutate of cases ) { const ctx = context(); mutate( ctx.response ); await refused( ctx.component.prepare( ctx.request ) ); }
		expect( getter ).not.toHaveBeenCalled();
	} );
	it( 'preserves null prototypes, own __proto__ and shared acyclic unknown payload', async () => {
		const ctx = context(), shared = { full: [ false, null, 3 ] };
		ctx.request.targetSnapshot.rootData = Object.assign( Object.create( null ), { first: shared, second: shared } );
		Object.defineProperty( ctx.request.targetSnapshot.rootData, '__proto__', { value: { literal: true }, enumerable: true } );
		const handle = await ctx.component.prepare( ctx.request ), preview = ctx.component.inspect( handle );
		expect( Object.getPrototypeOf( preview.candidateSnapshot.rootData ) ).toBeNull();
		expect( preview.candidateSnapshot.rootData.__proto__ ).toEqual( { literal: true } );
		expect( preview.candidateSnapshot.rootData.first ).not.toBe( preview.candidateSnapshot.rootData.second );
	} );
	it( 'redacts allocator, planner and reflection errors', async () => {
		const ctx = context(); ctx.allocator.mockImplementation( () => { throw new Error( 'private allocator' ); } ); await refused( ctx.component.prepare( ctx.request ) );
		const other = context(); other.request = new Proxy( {}, { getOwnPropertyDescriptor() { throw new Error( 'private reflection' ); } } );
		await refused( other.component.prepare( other.request ) );
	} );
	it( 'disposal inside allocator cannot issue a handle', async () => {
		const ctx = context(); ctx.allocator.mockImplementation( () => { ctx.component.dispose(); return 'fresh-' + ctx.allocator.mock.calls.length; } );
		await refused( ctx.component.prepare( ctx.request ) );
	} );
	it( 'uses the accepted reader with exact literal request and no alternate API', async () => {
		const ctx = context(), api = { get: jest.fn().mockResolvedValue( { layersread: ctx.response } ) };
		const component = new Source( { reader: new Reader( api ), planner: Planner, adapter: ctx.adapter } );
		const handle = await component.prepare( ctx.request ); await component.revalidate( handle );
		expect( api.get.mock.calls ).toEqual( [ [ { action: 'layersread', formatversion: 2, owner: ' Source_Page ', revid: 42 } ], [ { action: 'layersread', formatversion: 2, owner: ' Source_Page ', revid: 42 } ] ] );
	} );
	it( 'does not mutate DOM, storage, browser history, publisher or editor state', async () => {
		const ctx = context(), before = clone( ctx.request.targetSnapshot ), html = document.body.innerHTML;
		const storage = jest.spyOn( Storage.prototype, 'setItem' ), history = jest.spyOn( window.history, 'pushState' ), log = jest.spyOn( console, 'log' );
		const publisher = jest.fn(), editor = { snapshot: before, selection: [ 'old' ], history: [], draft: 'retained', saved: false };
		const oldPublisher = window.layersTestPublisher; window.layersTestPublisher = publisher;
		const handle = await ctx.component.prepare( ctx.request ); ctx.component.inspect( handle ); await ctx.component.revalidate( handle ); ctx.component.release( handle ); ctx.component.dispose();
		expect( document.body.innerHTML ).toBe( html ); expect( storage ).not.toHaveBeenCalled(); expect( history ).not.toHaveBeenCalled(); expect( log ).not.toHaveBeenCalled(); expect( publisher ).not.toHaveBeenCalled();
		expect( editor ).toEqual( { snapshot: before, selection: [ 'old' ], history: [], draft: 'retained', saved: false } ); expect( ctx.request.targetSnapshot ).toEqual( before );
		window.layersTestPublisher = oldPublisher; storage.mockRestore(); history.mockRestore(); log.mockRestore();
	} );
	it.each( [ {}, { reader: {}, planner: Planner, adapter: new Adapter() }, { reader: { read() {} }, planner: {}, adapter: new Adapter() } ] )( 'refuses missing injected dependency %s', dependencies => {
		refusedSync( () => new Source( dependencies ) );
	} );
	it( 'loads in a classic ResourceLoader VM without any relative require', async () => {
		const code = fs.readFileSync( path.resolve( __dirname, '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' ), 'utf8' );
		const requireTrap = jest.fn( () => { throw new Error( 'relative require forbidden' ); } );
		const sandbox = { window: {}, module: { exports: {} }, require: requireTrap }; vm.createContext( sandbox ); vm.runInContext( code, sandbox );
		expect( typeof sandbox.window.Layers.Editor.PageOwnedWorkingCopyImportSource ).toBe( 'function' ); expect( requireTrap ).not.toHaveBeenCalled();
		vm.runInContext( "globalThis.instance = new window.Layers.Editor.PageOwnedWorkingCopyImportSource({reader:{read() {throw Error('unused');}},planner:{prepare() {}},adapter:{toEditorState() {},withWorkingCopyImport() {}}}); globalThis.cancel = instance.prepare({mode:'cancel'});", sandbox );
		await expect( sandbox.cancel ).resolves.toBeNull(); expect( requireTrap ).not.toHaveBeenCalled();
	} );
	it( 'exports in actual Node without window or relative dependencies', () => {
		const file = path.resolve( __dirname, '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportSource.js' );
		const result = spawnSync( process.execPath, [ '-e', 'delete global.window;const Source=require(' + JSON.stringify( file ) + ');if(typeof Source!=="function")process.exit(1);' ], { encoding: 'utf8' } );
		expect( result.status ).toBe( 0 ); expect( result.stdout ).toBe( '' ); expect( result.stderr ).toBe( '' );
	} );
} );