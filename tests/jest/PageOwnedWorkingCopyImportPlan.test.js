'use strict';

const Plan = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );

function freeze( value ) {
	if ( value && typeof value === 'object' && !Object.isFrozen( value ) ) {
		Object.values( value ).forEach( freeze );
		Object.freeze( value );
	}
	return value;
}

const canvas = { width: 320, height: 200, backgroundColor: '#fff', backgroundVisible: false,
	backgroundOpacity: 0.5, extra: { locked: true } };
const target = freeze( {
	id: 'target', kind: 'image', label: 'ABC', canvas,
	source: { repository: 'local', fileTitle: 'File:Example.png', timestamp: '20261010000000', sha1: 'target-pin', page: 1 },
	layers: [ { id: 'existing', type: 'text', text: 'target text', richText: [ { text: 'keep' } ] } ],
	readingOrder: [ 'existing' ], metadata: { owner: 'unchanged', revision: 7 }
} );
const source = freeze( {
	id: 'other', kind: 'image', label: 'ABC', canvas: { width: 900, height: 500, backgroundColor: '#000' },
	source: { repository: 'local', fileTitle: 'File:Example.png', timestamp: '20260901000000', sha1: 'old-pin', page: 1 },
	layers: [
		{ id: 'outer', type: 'group', children: [ 'inner' ], name: 'outer' },
		{ id: 'inner', type: 'group', children: [ 'content' ], parentGroup: 'outer' },
		{ id: 'content', type: 'textbox', parentGroup: 'inner', text: 'outer', link: { url: 'inner' },
			richText: [ { text: 'content', style: { fontWeight: 'bold', color: '#123456' } } ],
			gradient: { type: 'linear', angle: 30, colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] },
			points: [ { x: 1, y: 2 } ], metadata: { ids: [ 'outer', 'content' ] }, visible: false }
	], readingOrder: [ 'content', 'inner' ], authorized: true, owner: 'not authorization'
} );
const imported = [
	{ id: 'new-1', type: 'group', children: [ 'new-2' ], name: 'outer' },
	{ id: 'new-2', type: 'group', children: [ 'new-3' ], parentGroup: 'new-1' },
	{ id: 'new-3', type: 'textbox', parentGroup: 'new-2', text: 'outer', link: { url: 'inner' },
		richText: [ { text: 'content', style: { fontWeight: 'bold', color: '#123456' } } ],
		gradient: { type: 'linear', angle: 30, colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] },
		points: [ { x: 1, y: 2 } ], metadata: { ids: [ 'outer', 'content' ] }, visible: false }
];

function request( overrides = {} ) {
	let next = 0;
	return { targetSurface: target, sourceSurface: source, mode: 'append', maxLayers: 10,
		allocateId: jest.fn( () => 'new-' + ++next ), ...overrides };
}

function refuse( input ) {
	expect( () => Plan.prepare( input ) ).toThrow( 'Invalid working-copy import plan' );
	try {
		Plan.prepare( input );
	} catch ( error ) {
		expect( error.code ).toBe( 'layers-invalid-working-copy-import-plan' );
		expect( error.stack ).not.toContain( 'SECRET' );
		expect( Object.keys( error ) ).toEqual( [ 'code' ] );
	}
}

describe( 'PageOwnedWorkingCopyImportPlan', () => {
	it( 'exports an inactive namespace class', () => {
		expect( window.Layers.Editor.PageOwnedWorkingCopyImportPlan ).toBe( Plan );
		expect( typeof Plan.prepare ).toBe( 'function' );
	} );

	it( 'remaps imported IDs and nested groups without rewriting ID-like content', () => {
		const result = Plan.prepare( request( { mode: 'replace' } ) );
		expect( result ).toEqual( { surface: { ...target, layers: imported, readingOrder: [ 'new-3', 'new-2' ] },
			importedLayerIds: [ 'new-1', 'new-2', 'new-3' ] } );
	} );

	it( 'appends above the existing stack but after existing reading order', () => {
		expect( Plan.prepare( request() ) ).toEqual( {
			surface: { ...target, layers: [ ...imported, ...target.layers ], readingOrder: [ 'existing', 'new-3', 'new-2' ] },
			importedLayerIds: [ 'new-1', 'new-2', 'new-3' ]
		} );
	} );

	it( 'imports into an empty image without changing its canvas, identity or file pins', () => {
		const empty = freeze( { ...target, layers: [], readingOrder: [] } );
		expect( Plan.prepare( request( { targetSurface: empty, mode: 'empty' } ) ) ).toEqual( {
			surface: { ...empty, layers: imported, readingOrder: [ 'new-3', 'new-2' ] },
			importedLayerIds: [ 'new-1', 'new-2', 'new-3' ]
		} );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'handles slide canvas policy for %s', mode => {
		const destination = freeze( { ...target, kind: 'slide', layers: mode === 'empty' ? [] : target.layers,
			readingOrder: mode === 'empty' ? [] : target.readingOrder } );
		const from = freeze( { ...source, kind: 'slide' } );
		expect( Plan.prepare( request( { targetSurface: destination, sourceSurface: from, mode } ) ) ).toEqual( {
			surface: { ...destination, canvas: mode === 'empty' ? from.canvas : destination.canvas,
				layers: mode === 'append' ? [ ...imported, ...target.layers ] : imported,
				readingOrder: mode === 'append' ? [ 'existing', 'new-3', 'new-2' ] : [ 'new-3', 'new-2' ] },
			importedLayerIds: [ 'new-1', 'new-2', 'new-3' ]
		} );
	} );

	it( 'Cancel inspects neither target nor source nor allocator', () => {
		const getter = jest.fn( () => { throw new Error( 'SECRET' ); } ), input = { mode: 'cancel' };
		for ( const key of [ 'sourceSurface', 'targetSurface', 'maxLayers', 'allocateId' ] ) {
			Object.defineProperty( input, key, { get: getter, enumerable: true } );
		}
		expect( Plan.prepare( input ) ).toBeNull();
		expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'returns isolated nested content even for shared acyclic values', () => {
		const shared = freeze( { data: [ { flag: 'keep' } ] } );
		const result = Plan.prepare( request( { sourceSurface: freeze( { ...source,
			layers: [ { id: 'payload', type: 'image', src: 'data:image/png;base64,YQ==',
				first: shared, second: shared, originalWidth: 10, originalHeight: 20 } ], readingOrder: [ 'payload' ] } ) } ) );
		result.surface.layers[ 0 ].first.data[ 0 ].flag = 'changed';
		result.surface.layers[ 1 ].richText[ 0 ].text = 'changed';
		result.surface.canvas.extra.locked = false;
		expect( result.surface.layers[ 0 ].second ).toEqual( shared );
		expect( shared.data[ 0 ].flag ).toBe( 'keep' );
		expect( target.canvas.extra.locked ).toBe( true );
		expect( target.layers[ 0 ].richText[ 0 ].text ).toBe( 'keep' );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'accepts a zero-layer source for %s', mode => {
		const destination = { ...target, kind: 'slide', layers: mode === 'empty' ? [] : target.layers,
			readingOrder: mode === 'empty' ? [] : target.readingOrder };
		const from = { ...source, kind: 'slide', layers: [], readingOrder: [] }, input = request( {
			targetSurface: destination, sourceSurface: from, mode } );
		expect( Plan.prepare( input ) ).toEqual( { surface: { ...destination,
			canvas: mode === 'empty' ? from.canvas : destination.canvas,
			layers: mode === 'append' ? target.layers : [], readingOrder: mode === 'append' ? [ 'existing' ] : [] },
		importedLayerIds: [] } );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'does not materialize absent reading order for %s', mode => {
		const destination = { ...target, layers: mode === 'empty' ? [] : target.layers }, from = { ...source };
		delete destination.readingOrder;
		delete from.readingOrder;
		const result = Plan.prepare( request( { targetSurface: destination, sourceSurface: from, mode } ) );
		expect( result.surface ).not.toHaveProperty( 'readingOrder' );
		expect( result.importedLayerIds ).toEqual( [ 'new-1', 'new-2', 'new-3' ] );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'refuses incompatible mode occupancy for %s', mode => {
		const input = request( { mode, targetSurface: mode === 'empty' ? target : { ...target, layers: [], readingOrder: [] } } );
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it.each( [ '', 'Append', 'unknown', null ] )( 'rejects invalid mode %s', mode => {
		const input = request( { mode } );
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it.each( [ 0, -1, 1.5, NaN, Infinity, '10' ] )( 'rejects invalid maxLayers %s', maxLayers => {
		const input = request( { maxLayers } );
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'applies limits to the result before allocation', () => {
		const input = request( { maxLayers: 3 } );
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
		expect( Plan.prepare( request( { maxLayers: 3, mode: 'replace' } ) ).surface.layers ).toHaveLength( 3 );
	} );

	it.each( [ '', null, 4, 'content', 'existing' ] )( 'rejects invalid or colliding allocated ID %s', id => {
		const input = request( { allocateId: jest.fn( () => id ) } );
		expect( () => Plan.prepare( input ) ).toThrow();
		expect( input.allocateId ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'rejects duplicate IDs and allocator failure without retry or diagnostics', () => {
		const duplicate = request( { allocateId: jest.fn( () => 'new' ) } );
		expect( () => Plan.prepare( duplicate ) ).toThrow();
		expect( duplicate.allocateId ).toHaveBeenCalledTimes( 2 );
		const failure = request( { allocateId: jest.fn( () => { throw new Error( 'SECRET owner text' ); } ) } );
		try {
			Plan.prepare( failure );
		} catch ( error ) {
			expect( error.stack ).not.toContain( 'SECRET' );
		}
		expect( failure.allocateId ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [ 'target', 'source' ] )( 'uses independent layer-order fallback for absent %s readingOrder', missing => {
		const destination = { ...target }, from = { ...source };
		delete ( missing === 'target' ? destination : from ).readingOrder;
		expect( Plan.prepare( request( { targetSurface: destination, sourceSurface: from } ) ) ).toEqual( {
			surface: { ...destination, layers: [ ...imported, ...target.layers ],
				readingOrder: missing === 'source' ? [ 'existing', 'new-1', 'new-2', 'new-3' ] : [ 'existing', 'new-3', 'new-2' ] },
			importedLayerIds: [ 'new-1', 'new-2', 'new-3' ]
		} );
	} );

	it( 'retains target groups exactly and leaves arbitrary non-group children untouched', () => {
		const destination = freeze( { ...target, layers: [
			{ id: 'folder', type: 'group', children: [ 'existing' ], parentGroup: null },
			{ id: 'existing', type: 'text', parentGroup: 'folder', text: 'keep' }
		], readingOrder: [ 'existing' ] } );
		const from = freeze( { ...source, layers: [
			{ id: 'future', type: 'future-kind', children: [ 'future' ], parentGroup: null,
				src: 'data:image/png;base64,YQ==', originalWidth: 4, originalHeight: 8,
				metadata: { revision: 9, authorized: true }, blendMode: 'multiply', opacity: 0.8 }
		], readingOrder: [] } );
		expect( Plan.prepare( request( { targetSurface: destination, sourceSurface: from } ) ) ).toEqual( {
			surface: { ...destination, layers: [
				{ id: 'new-1', type: 'future-kind', children: [ 'future' ], parentGroup: null,
					src: 'data:image/png;base64,YQ==', originalWidth: 4, originalHeight: 8,
					metadata: { revision: 9, authorized: true }, blendMode: 'multiply', opacity: 0.8 },
				{ id: 'folder', type: 'group', children: [ 'existing' ], parentGroup: null },
				{ id: 'existing', type: 'text', parentGroup: 'folder', text: 'keep' }
			], readingOrder: [ 'existing' ] }, importedLayerIds: [ 'new-1' ]
		} );
	} );

	it.each( [
		[ 'null surface', () => null ],
		[ 'missing canvas', value => ( delete value.canvas, value ) ],
		[ 'invalid canvas', value => ( value.canvas.width = 0, value ) ],
		[ 'invalid layers', value => ( value.layers = {}, value ) ],
		[ 'missing id', value => ( delete value.id, value ) ],
		[ 'invalid label', value => ( value.label = 5, value ) ],
		[ 'PDF', value => ( value.kind = 'pdf', value ) ],
		[ 'mixed kinds', value => ( value.kind = 'slide', value ) ],
		[ 'different file despite authorized flag', value => ( value.source.fileTitle = 'File:Other.png', value.authorized = true, value ) ],
		[ 'noncanonical file', value => ( value.source.fileTitle = 'file:Example.png', value ) ],
		[ 'case variant file', value => ( value.source.fileTitle = 'File:example.png', value ) ],
		[ 'missing source', value => ( delete value.source, value ) ],
		[ 'duplicate ID', value => ( value.layers.push( { id: 'content', type: 'text' } ), value ) ],
		[ 'invalid layer', value => ( value.layers[ 0 ] = null, value ) ],
		[ 'invalid layer ID', value => ( value.layers[ 0 ].id = '', value ) ],
		[ 'invalid layer type', value => ( value.layers[ 0 ].type = 2, value ) ],
		[ 'missing group children', value => ( delete value.layers[ 0 ].children, value ) ],
		[ 'dangling child', value => ( value.layers[ 0 ].children = [ 'missing' ], value ) ],
		[ 'duplicate child', value => ( value.layers[ 0 ].children.push( 'inner' ), value ) ],
		[ 'dangling parent', value => ( value.layers[ 2 ].parentGroup = 'missing', value ) ],
		[ 'non-group parent', value => ( value.layers[ 1 ].parentGroup = 'content', value ) ],
		[ 'missing reciprocal parent', value => ( delete value.layers[ 2 ].parentGroup, value ) ],
		[ 'multiple memberships', value => ( value.layers[ 0 ].children.push( 'content' ), value ) ],
		[ 'cycle', value => ( value.layers[ 0 ].parentGroup = 'inner', value.layers[ 1 ].children.push( 'outer' ), value ) ],
		[ 'duplicate reading order', value => ( value.readingOrder = [ 'content', 'content' ], value ) ],
		[ 'dangling reading order', value => ( value.readingOrder = [ 'missing' ], value ) ],
		[ 'invalid reading order', value => ( value.readingOrder = null, value ) ]
	] )( 'refuses %s before allocation without repair or mutation', ( name, change ) => {
		const bad = freeze( change( JSON.parse( JSON.stringify( source ) ) ) );
		const input = request( { sourceSurface: bad } ), before = JSON.stringify( bad );
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
		expect( JSON.stringify( bad ) ).toBe( before );
	} );

	it( 'validates target graph and reading order before allocating', () => {
		for ( const bad of [ { ...target, readingOrder: [ 'missing' ] },
			{ ...target, layers: [ { id: 'existing', type: 'text', parentGroup: 'missing' } ] } ] ) {
			const input = request( { targetSurface: freeze( bad ) } );
			refuse( input );
			expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it.each( [ undefined, () => {}, Symbol( 'secret' ), 1n, NaN, Infinity,
		new Date(), new Map(), Object.create( { custom: true } ), new Array( 2 ) ] )( 'refuses non-JSON payload %#', payload => {
		const input = request( { sourceSurface: { ...source, secret: payload } } );
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'refuses cycles, symbol keys, nonenumerables and extra array keys', () => {
		const cycle = {}; cycle.self = cycle;
		const symbol = { [ Symbol( 'secret' ) ]: 1 };
		const hidden = {}; Object.defineProperty( hidden, 'hidden', { value: 1 } );
		const extra = [ 1 ]; extra.custom = true;
		const customArray = [ 1 ]; Object.setPrototypeOf( customArray, null );
		for ( const payload of [ cycle, symbol, hidden, extra, customArray ] ) {
			const input = request( { sourceSurface: { ...source, payload } } );
			refuse( input );
			expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it.each( [ 'mode', 'targetSurface', 'sourceSurface', 'maxLayers', 'allocateId' ] )( 'refuses request %s accessor without invoking it', key => {
		const input = request(), getter = jest.fn( () => { throw new Error( 'SECRET getter' ); } );
		Object.defineProperty( input, key, { get: getter, enumerable: true } );
		refuse( input );
		expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'refuses nested object/array accessors and redacts reflection failures', () => {
		const getter = jest.fn( () => { throw new Error( 'SECRET getter' ); } );
		const nested = {}, array = [ 1 ];
		Object.defineProperty( nested, 'secret', { get: getter, enumerable: true } );
		Object.defineProperty( array, '0', { get: getter, enumerable: true } );
		const reflected = new Proxy( {}, { getPrototypeOf() { throw new Error( 'SECRET reflection' ); } } );
		for ( const payload of [ nested, array, reflected ] ) {
			const input = request( { sourceSurface: { ...source, payload } } );
			refuse( input );
			expect( input.allocateId ).not.toHaveBeenCalled();
		}
		expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'preserves null prototypes and own __proto__ data without prototype mutation', () => {
		const metadata = Object.assign( Object.create( null ), { data: [ 1 ] } );
		const payload = JSON.parse( '{"__proto__":{"flag":"preserve"},"constructor":"data"}' );
		const result = Plan.prepare( request( { sourceSurface: { ...source, layers: [
			{ id: 'payload', type: 'text', metadata, payload }
		], readingOrder: [ 'payload' ] } } ) );
		expect( Object.getPrototypeOf( result.surface.layers[ 0 ].metadata ) ).toBeNull();
		expect( Object.getPrototypeOf( result.surface.layers[ 0 ].payload ) ).toBe( Object.prototype );
		expect( Object.hasOwn( result.surface.layers[ 0 ].payload, '__proto__' ) ).toBe( true );
		expect( result.surface.layers[ 0 ].payload ).toEqual( payload );
		expect( {}.flag ).toBeUndefined();
	} );

	it( 'rejects removed target ID collisions in Replace and asynchronous allocators', () => {
		for ( const allocator of [ () => 'existing', () => Promise.resolve( 'new' ), null ] ) {
			refuse( request( { mode: 'replace', allocateId: allocator } ) );
		}
	} );

	it( 'does not mutate inputs or use DOM/storage/history/publication during success or refusal', () => {
		const before = { target: JSON.stringify( target ), source: JSON.stringify( source ),
			dom: document.documentElement.outerHTML, storage: JSON.stringify( localStorage ) };
		const historyLength = window.history.length;
		Plan.prepare( request() );
		refuse( request( { mode: 'invalid' } ) );
		expect( JSON.stringify( target ) ).toBe( before.target );
		expect( JSON.stringify( source ) ).toBe( before.source );
		expect( document.documentElement.outerHTML ).toBe( before.dom );
		expect( JSON.stringify( localStorage ) ).toBe( before.storage );
		expect( window.history.length ).toBe( historyLength );
	} );
} );