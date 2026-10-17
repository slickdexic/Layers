'use strict';

const Plan = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportPlan.js' );

const targetPin = { repository: 'local', fileTitle: 'File:Manual.pdf', timestamp: '20261001000000', sha1: '0'.repeat( 31 ) };
const sourcePin = { repository: 'local', fileTitle: 'File:Manual.pdf', timestamp: '20260901000000', sha1: '1'.repeat( 31 ) };
const canvas = { width: 800, height: 600, backgroundColor: '#fff', backgroundVisible: true, backgroundOpacity: 1 };

function member( id, page, pin, layers = [], overrides = {} ) {
	return { id, kind: 'pdf', label: 'ABC', canvas: { ...canvas },
		source: { ...pin, page }, layers, ...overrides };
}

function layer( id, text = id ) {
	return { id, type: 'text', text };
}

function snapshot( surfaces, metadata = { untouched: { token: 'document metadata' } } ) {
	return { schemaVersion: 1, surfaces, metadata };
}

function setup() {
	let id = 0;
	const targetAnchor = member( 'target-p2', 2, targetPin, [ layer( 'target-layer-p2' ) ] );
	const sourceAnchor = member( 'source-p2', 2, sourcePin, [ layer( 'source-layer-p2' ) ] );
	const targetSnapshot = snapshot( [
		member( 'target-p2', 2, targetPin, [ layer( 'target-layer-p2' ) ] ),
		member( 'target-p4', 4, targetPin, [ layer( 'target-layer-p4' ) ] ),
		{ id: 'same-name-other-file', kind: 'pdf', label: 'ABC', canvas: { ...canvas },
			source: { ...targetPin, fileTitle: 'File:Other.pdf', page: 1 }, layers: [ layer( 'other-file-layer' ) ] },
		{ id: 'same-name-slide', kind: 'slide', label: 'ABC', canvas: { ...canvas }, layers: [ layer( 'slide-layer' ) ] },
		{ id: 'other-set', kind: 'pdf', label: 'XYZ', canvas: { ...canvas },
			source: { ...targetPin, page: 1 }, layers: [ layer( 'other-set-layer' ) ] }
	] );
	const sourceSnapshot = snapshot( [
		member( 'source-p1', 1, sourcePin, [ layer( 'source-layer-p1' ) ] ),
		member( 'source-p2', 2, sourcePin, [ layer( 'source-layer-p2' ) ] ),
		member( 'source-p3', 3, sourcePin, [ layer( 'source-layer-p3' ) ] )
	], { sourceMetadata: 'must not be copied' } );
	const admittedTargetSurfaces = [ member( 'target-p1', 1, targetPin, [] ), member( 'target-p3', 3, targetPin, [] ) ];
	return {
		targetSnapshot, sourceSnapshot, targetSurfaceId: targetAnchor.id, sourceSurfaceId: sourceAnchor.id,
		admittedTargetSurfaces,
		allocateId: jest.fn( () => 'allocated-' + ++id ), maxLayers: 10, mode: 'append'
	};
}

function setGroupPin( input, which, field, value ) {
	const items = which === 'source' ? input.sourceSnapshot.surfaces : [
		...input.targetSnapshot.surfaces.filter( surface => surface.kind === 'pdf' &&
			surface.source.fileTitle === 'File:Manual.pdf' && surface.label === 'ABC' ),
		...input.admittedTargetSurfaces
	];
	for ( const surface of items ) {
		if ( value === undefined ) {
			delete surface.source[ field ];
		} else {
			surface.source[ field ] = value;
		}
	}
}

function changeGroupPage( input, offset ) {
	for ( const surface of input.sourceSnapshot.surfaces ) { surface.source.page += offset; }
	for ( const surface of input.targetSnapshot.surfaces.filter( item => item.kind === 'pdf' &&
		item.source.fileTitle === 'File:Manual.pdf' && item.label === 'ABC' ) ) { surface.source.page += offset; }
	for ( const surface of input.admittedTargetSurfaces ) { surface.source.page += offset; }
}

function refuse( input ) {
	try {
		Plan.prepare( input );
		throw new Error( 'Expected whole-PDF planning refusal' );
	} catch ( error ) {
		expect( error.message ).toBe( 'Invalid whole-PDF import plan' );
		expect( error.code ).toBe( 'layers-invalid-whole-pdf-import-plan' );
		expect( error.stack ).not.toContain( 'SECRET' );
		expect( Object.keys( error ) ).toEqual( [ 'code' ] );
	}
}

describe( 'PageOwnedWholePdfImportPlan', () => {
	it( 'exports an inactive planner class', () => {
		expect( window.Layers.Editor.PageOwnedWholePdfImportPlan ).toBe( Plan );
		expect( typeof Plan.prepare ).toBe( 'function' );
	} );

	it( 'imports all source pages into an empty group using separately admitted target pages', () => {
		const input = setup();
		input.mode = 'empty';
		input.targetSnapshot.surfaces[ 0 ].layers = [];
		input.targetSnapshot.surfaces[ 1 ].layers = [];
		input.sourceSnapshot.surfaces = input.sourceSnapshot.surfaces.slice( 0, 2 );
		input.admittedTargetSurfaces = input.admittedTargetSurfaces.slice( 0, 1 );
		const result = Plan.prepare( input );
		expect( result.pages.map( page => page.page ) ).toEqual( [ 1, 2 ] );
		expect( result.pages.map( page => page.surfaceId ) ).toEqual( [ 'target-p1', 'target-p2' ] );
		expect( result.pages.map( page => page.importedLayerIds ) ).toEqual( [ [ 'allocated-1' ], [ 'allocated-2' ] ] );
		expect( result.importedLayerIds ).toEqual( [ 'allocated-1', 'allocated-2' ] );
		const members = result.snapshot.surfaces.filter( surface => surface.label === 'ABC' &&
			surface.kind === 'pdf' && surface.source.fileTitle === 'File:Manual.pdf' );
		expect( members.map( surface => surface.source.page ) ).toEqual( [ 2, 4, 1 ] );
		expect( members.find( surface => surface.source.page === 1 ).source ).toEqual( { ...targetPin, page: 1 } );
		expect( members.find( surface => surface.source.page === 1 ).canvas ).toEqual( canvas );
	} );

	it( 'plans the owner-approved 99-page PDF as one layer set named 001', () => {
		const targetSnapshot = snapshot( [ { ...member( 'target-p99', 99, targetPin, [] ), label: '001' } ] );
		const sourceSnapshot = snapshot( Array.from( { length: 99 }, ( _, index ) => {
			const page = index + 1;
			return { ...member( 'source-p' + page, page, sourcePin, [ layer( 'source-layer-p' + page ) ] ), label: '001' };
		} ) );
		const admittedTargetSurfaces = Array.from( { length: 98 }, ( _, index ) => {
			const page = index + 1;
			return { ...member( 'target-p' + page, page, targetPin, [] ), label: '001' };
		} );
		let id = 0;
		const result = Plan.prepare( { targetSnapshot, targetSurfaceId: 'target-p99', sourceSnapshot,
			sourceSurfaceId: 'source-p99', admittedTargetSurfaces, mode: 'empty', maxLayers: 1,
			allocateId: () => 'imported-' + ++id } );
		expect( result.pages.map( item => item.page ) ).toEqual( Array.from( { length: 99 }, ( _, i ) => i + 1 ) );
		expect( result.snapshot.surfaces ).toHaveLength( 99 );
		expect( result.snapshot.surfaces.every( surface => surface.label === '001' ) ).toBe( true );
		expect( result.snapshot.surfaces.every( surface => surface.source.sha1 === targetPin.sha1 ) ).toBe( true );
		expect( result.importedLayerIds ).toHaveLength( 99 );
	} );

	it( 'Append maps by page, preserves target-only pages and leaves unrelated members in order', () => {
		const input = setup();
		const before = JSON.parse( JSON.stringify( input.targetSnapshot ) );
		const result = Plan.prepare( input );
		expect( result.snapshot.surfaces.map( surface => surface.id ) ).toEqual( [
			'target-p2', 'target-p4', 'same-name-other-file', 'same-name-slide', 'other-set', 'target-p1', 'target-p3'
		] );
		expect( result.snapshot.surfaces[ 0 ].layers.map( item => item.text ) ).toEqual( [ 'source-layer-p2', 'target-layer-p2' ] );
		expect( result.snapshot.surfaces[ 1 ] ).toEqual( before.surfaces[ 1 ] );
		for ( const index of [ 2, 3, 4 ] ) { expect( result.snapshot.surfaces[ index ] ).toEqual( before.surfaces[ index ] ); }
		expect( result.pages.map( item => item.page ) ).toEqual( [ 1, 2, 3 ] );
		expect( result.pages[ 0 ].surfaceId ).toBe( 'target-p1' );
		expect( result.snapshot.surfaces.at( -2 ).source ).toEqual( { ...targetPin, page: 1 } );
		expect( result.snapshot.surfaces.at( -1 ).source ).toEqual( { ...targetPin, page: 3 } );
		expect( input.targetSnapshot ).toEqual( before );
	} );

	it( 'Replace clears target-only pages across the group without copying source metadata or pins', () => {
		const input = setup();
		input.mode = 'replace';
		input.sourceSnapshot.surfaces = input.sourceSnapshot.surfaces.slice( 0, 2 );
		input.admittedTargetSurfaces = input.admittedTargetSurfaces.slice( 0, 1 );
		input.targetSnapshot.surfaces[ 1 ].readingOrder = [ 'target-layer-p4' ];
		const result = Plan.prepare( input );
		const targetMembers = result.snapshot.surfaces.filter( surface => surface.kind === 'pdf' &&
			surface.label === 'ABC' && surface.source.fileTitle === 'File:Manual.pdf' );
		expect( targetMembers.find( surface => surface.source.page === 4 ).layers ).toEqual( [] );
		expect( targetMembers.find( surface => surface.source.page === 4 ).readingOrder ).toEqual( [] );
		expect( targetMembers.find( surface => surface.source.page === 1 ).source ).toEqual( { ...targetPin, page: 1 } );
		expect( targetMembers.find( surface => surface.source.page === 2 ).source ).toEqual( { ...targetPin, page: 2 } );
		expect( result.snapshot.metadata ).toEqual( input.targetSnapshot.metadata );
		expect( result.snapshot.metadata ).not.toEqual( input.sourceSnapshot.metadata );
		expect( targetMembers.find( surface => surface.source.page === 2 ).canvas ).toEqual( canvas );
	} );

	it( 'allows a different source PDF version while retaining target identity and dimensions', () => {
		const input = setup();
		const targetBefore = JSON.parse( JSON.stringify( input.targetSnapshot ) );
		const result = Plan.prepare( input );
		const p2 = result.snapshot.surfaces.find( surface => surface.id === 'target-p2' );
		expect( p2.source ).toEqual( targetBefore.surfaces[ 0 ].source );
		expect( p2.canvas ).toEqual( targetBefore.surfaces[ 0 ].canvas );
		expect( result.snapshot.surfaces.find( surface => surface.id === 'target-p1' ).source.sha1 ).toBe( '0'.repeat( 31 ) );
		expect( input.sourceSnapshot.surfaces[ 1 ].source.sha1 ).toBe( '1'.repeat( 31 ) );
	} );

	it( 'requires every source page to have an existing or admitted empty target member', () => {
		const input = setup();
		input.sourceSnapshot.surfaces.push( member( 'source-p5', 5, sourcePin, [ layer( 'source-layer-p5' ) ] ) );
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'rejects extra or conflicting admitted target members before allocating', () => {
		for ( const admitted of [
			[ ...setup().admittedTargetSurfaces, member( 'unused', 9, targetPin, [] ) ],
			[ member( 'target-p1', 1, { ...targetPin, sha1: '2'.repeat( 31 ) }, [] ) ],
			[ member( 'target-p1', 1, targetPin, [ layer( 'must-be-empty' ) ] ) ],
			[ member( 'target-p1', 1, targetPin, [], { canvas: { ...canvas, width: 0 } } ) ]
		] ) {
			const input = setup(); input.admittedTargetSurfaces = admitted;
			refuse( input ); expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it( 'counts occupancy across the whole target group', () => {
		const emptyMode = setup(); emptyMode.mode = 'empty';
		emptyMode.targetSnapshot.surfaces[ 0 ].layers = [];
		refuse( emptyMode );
		expect( emptyMode.allocateId ).not.toHaveBeenCalled();
		for ( const mode of [ 'append', 'replace' ] ) {
			const input = setup(); input.mode = mode;
			input.targetSnapshot.surfaces[ 0 ].layers = [];
			input.targetSnapshot.surfaces[ 1 ].layers = [];
			refuse( input );
			expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it( 'allows total imported layers across pages to exceed the per-page limit', () => {
		const input = setup(); input.maxLayers = 2;
		for ( const surface of input.sourceSnapshot.surfaces ) { surface.layers = [ layer( 'source-' + surface.source.page ) ]; }
		const result = Plan.prepare( input );
		expect( result.importedLayerIds ).toHaveLength( 3 );
		expect( result.pages.map( page => page.importedLayerIds.length ) ).toEqual( [ 1, 1, 1 ] );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'accepts an empty source group for %s without allocating', mode => {
		const input = setup(); input.mode = mode;
		if ( mode === 'empty' ) {
			input.targetSnapshot.surfaces[ 0 ].layers = [];
			input.targetSnapshot.surfaces[ 1 ].layers = [];
		}
		input.sourceSnapshot.surfaces = input.sourceSnapshot.surfaces.map( surface => ( { ...surface, layers: [], readingOrder: [] } ) );
		const result = Plan.prepare( input );
		expect( result.importedLayerIds ).toEqual( [] );
		expect( result.pages.map( page => page.page ) ).toEqual( [ 1, 2, 3 ] );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'Cancel reads no other request field and does not allocate', () => {
		const getter = jest.fn( () => { throw new Error( 'SECRET getter' ); } );
		const input = { mode: 'cancel' };
		for ( const key of [ 'targetSnapshot', 'targetSurfaceId', 'sourceSnapshot', 'sourceSurfaceId',
			'admittedTargetSurfaces', 'maxLayers', 'allocateId' ] ) {
			Object.defineProperty( input, key, { enumerable: true, get: getter } );
		}
		expect( Plan.prepare( input ) ).toBeNull();
		expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'uses fresh IDs across both complete snapshots and remaps repeated page-local IDs independently', () => {
		const input = setup();
		const nested = page => [
			{ id: 'repeat', type: 'group', children: [ 'child' ], name: 'folder' },
			{ id: 'child', type: 'text', parentGroup: 'repeat', text: 'page ' + page,
				metadata: { oldId: 'repeat', sourcePage: page }, future: { keep: true } }
		];
		input.sourceSnapshot.surfaces = [ member( 'source-p1', 1, sourcePin, nested( 1 ), { readingOrder: [ 'child' ] } ),
			member( 'source-p2', 2, sourcePin, nested( 2 ), { readingOrder: [ 'child' ] } ) ];
		input.admittedTargetSurfaces = input.admittedTargetSurfaces.slice( 0, 1 );
		input.targetSnapshot.surfaces.push( member( 'unrelated-pdf', 8, { ...targetPin, fileTitle: 'File:Other.pdf' }, [ layer( 'allocated-1' ) ] ) );
		input.allocateId = jest.fn().mockReturnValueOnce( 'allocated-2' ).mockReturnValueOnce( 'allocated-3' )
			.mockReturnValueOnce( 'allocated-4' ).mockReturnValueOnce( 'allocated-5' );
		const result = Plan.prepare( input );
		const p1 = result.snapshot.surfaces.find( surface => surface.id === 'target-p1' );
		const p2 = result.snapshot.surfaces.find( surface => surface.id === 'target-p2' );
		expect( p1.layers.map( item => item.id ) ).toEqual( [ 'allocated-2', 'allocated-3' ] );
		expect( p2.layers.map( item => item.id ) ).toEqual( [ 'allocated-4', 'allocated-5', 'target-layer-p2' ] );
		expect( p1.layers[ 0 ].children ).toEqual( [ 'allocated-3' ] );
		expect( p1.layers[ 1 ].parentGroup ).toBe( 'allocated-2' );
		expect( p1.readingOrder ).toEqual( [ 'allocated-3' ] );
		expect( p1.layers[ 1 ].metadata ).toEqual( { oldId: 'repeat', sourcePage: 1 } );
		expect( p2.layers[ 0 ].children ).toEqual( [ 'allocated-5' ] );
		expect( p1.layers[ 0 ].id ).not.toBe( p2.layers[ 0 ].id );
	} );

	it( 'rejects malformed group pins, labels, duplicate pages and mismatched file or name before allocation', () => {
		const cases = [
			input => { input.sourceSnapshot.surfaces[ 0 ].source.sha1 = '2'.repeat( 31 ); },
			input => { input.targetSnapshot.surfaces[ 1 ].source.sha1 = '2'.repeat( 31 ); },
			input => { input.sourceSnapshot.surfaces[ 1 ].source.page = 1; },
			input => {
				input.targetSnapshot.surfaces[ 0 ].label = 'A BC';
				input.targetSnapshot.surfaces[ 1 ].label = 'A BC';
				input.sourceSnapshot.surfaces.forEach( surface => { surface.label = 'A BC'; } );
				input.sourceSnapshot.surfaces[ 2 ].label = 'A_BC';
			},
			input => { input.sourceSnapshot.surfaces.forEach( surface => { surface.source.fileTitle = 'File:Other.pdf'; } ); },
			input => { input.sourceSnapshot.surfaces.forEach( surface => { surface.label = 'Other'; } ); }
		];
		for ( const change of cases ) {
			const input = setup(); change( input ); refuse( input );
			expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it( 'validates native PDF pin format uniformly on selected target and source groups', () => {
		const invalid = [
			[ 'repository', undefined ], [ 'repository', 'shared' ],
			[ 'sha1', '2'.repeat( 30 ) ], [ 'sha1', 'A'.repeat( 31 ) ],
			[ 'sha1', '2'.repeat( 31 ) + '\n' ], [ 'sha1', '2'.repeat( 31 ) + '\r' ],
			[ 'timestamp', '2026x101000000' ], [ 'timestamp', '20260230000000' ],
			[ 'fileTitle', 'File:Bad#name.pdf' ], [ 'fileTitle', 'File:Bad[name].pdf' ],
			[ 'fileTitle', 'File:Bad|name.pdf' ], [ 'fileTitle', 'File:Bad\u0001name.pdf' ],
			[ 'fileTitle', 'File:' + 'é'.repeat( 126 ) ]
		];
		for ( const [ field, value ] of invalid ) {
			for ( const which of ( [ 'fileTitle', 'repository' ].includes( field ) ? [ 'both' ] : [ 'target', 'source' ] ) ) {
				const input = setup();
				if ( which === 'both' ) {
					setGroupPin( input, 'target', field, value ); setGroupPin( input, 'source', field, value );
				} else { setGroupPin( input, which, field, value ); }
				refuse( input ); expect( input.allocateId ).not.toHaveBeenCalled();
			}
		}
		const outOfRange = setup(); changeGroupPage( outOfRange, 100000 );
		refuse( outOfRange ); expect( outOfRange.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'accepts a valid leap-day timestamp and reordered native pin fields', () => {
		const input = setup();
		for ( const surface of input.targetSnapshot.surfaces.filter( item => item.kind === 'pdf' &&
			item.source.fileTitle === 'File:Manual.pdf' && item.label === 'ABC' ) ) {
			surface.source = { sha1: targetPin.sha1, timestamp: '20240229010203', fileTitle: targetPin.fileTitle,
				repository: targetPin.repository, page: surface.source.page };
		}
		for ( const surface of input.admittedTargetSurfaces ) {
			surface.source = { sha1: targetPin.sha1, timestamp: '20240229010203', fileTitle: targetPin.fileTitle,
				repository: targetPin.repository, page: surface.source.page };
		}
		const result = Plan.prepare( input );
		expect( result.pages.map( item => item.page ) ).toEqual( [ 1, 2, 3 ] );
	} );

	it( 'matches normalized source and target names while preserving target label', () => {
		const input = setup();
		for ( const surface of input.targetSnapshot.surfaces.filter( item => item.kind === 'pdf' &&
			item.source.fileTitle === 'File:Manual.pdf' && item.label === 'ABC' ) ) { surface.label = 'A B C'; }
		for ( const surface of input.admittedTargetSurfaces ) { surface.label = 'A B C'; }
		for ( const surface of input.sourceSnapshot.surfaces ) { surface.label = 'A_B_C'; }
		const result = Plan.prepare( input );
		expect( result.snapshot.surfaces.find( item => item.id === 'target-p2' ).label ).toBe( 'A B C' );
		expect( result.pages.map( item => item.page ) ).toEqual( [ 1, 2, 3 ] );
	} );

	it( 'refuses duplicate admitted page numbers and surface IDs', () => {
		for ( const extra of [ member( 'another-p1', 1, targetPin, [] ), member( 'target-p1', 3, targetPin, [] ) ] ) {
			const input = setup(); input.admittedTargetSurfaces.push( extra );
			refuse( input ); expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it.each( [ '', 'unknown', null, 'Append' ] )( 'rejects invalid mode %s before allocation', mode => {
		const input = setup(); input.mode = mode; refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it.each( [ 0, -1, 1.5, NaN, Infinity, '10' ] )( 'rejects invalid per-page layer limit %s before allocation', maxLayers => {
		const input = setup(); input.maxLayers = maxLayers; refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'applies maxLayers per page and validates later pages before allocating any IDs', () => {
		const input = setup(); input.maxLayers = 1;
		input.sourceSnapshot.surfaces[ 2 ].layers = [ layer( 'a' ), layer( 'b' ) ];
		refuse( input );
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'rejects invalid later members and unsafe JSON before allocation', () => {
		const invalidMember = setup(); invalidMember.sourceSnapshot.surfaces[ 2 ].source.page = 0;
		refuse( invalidMember ); expect( invalidMember.allocateId ).not.toHaveBeenCalled();
		const cycle = {}; cycle.self = cycle;
		for ( const payload of [ cycle, undefined, NaN, Infinity, 1n, new Date(), Symbol( 'secret' ) ] ) {
			const input = setup(); input.sourceSnapshot.futurePayload = payload;
			refuse( input ); expect( input.allocateId ).not.toHaveBeenCalled();
		}
		const hidden = {}; Object.defineProperty( hidden, 'x', { value: 1 } );
		const symbol = { [ Symbol( 'hidden' ) ]: true };
		for ( const payload of [ hidden, symbol, Object.create( { inherited: true } ) ] ) {
			const input = setup(); input.targetSnapshot.payload = payload;
			refuse( input ); expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it( 'rejects accessor fields without invoking them', () => {
		const input = setup();
		const getter = jest.fn( () => { throw new Error( 'SECRET getter' ); } );
		Object.defineProperty( input.sourceSnapshot.surfaces[ 2 ], 'layers', { enumerable: true, get: getter } );
		refuse( input );
		expect( getter ).not.toHaveBeenCalled();
		expect( input.allocateId ).not.toHaveBeenCalled();
	} );

	it( 'does not allocate when any later source page is unmappable or over limit', () => {
		for ( const mutate of [
			input => { input.admittedTargetSurfaces = []; },
			input => { input.maxLayers = 1; input.sourceSnapshot.surfaces[ 2 ].layers = [ layer( 'x' ), layer( 'y' ) ]; }
		] ) {
			const input = setup(); mutate( input ); refuse( input );
			expect( input.allocateId ).not.toHaveBeenCalled();
		}
	} );

	it( 'rejects nonfresh allocator IDs without retrying', () => {
		for ( const collision of [ 'source-layer-p1', 'other-file-layer', 'target-layer-p2' ] ) {
			const input = setup(); input.allocateId = jest.fn( () => collision );
			refuse( input ); expect( input.allocateId ).toHaveBeenCalledTimes( 1 );
		}
	} );

	it( 'keeps source and target exact when a later ID allocation fails', () => {
		const input = setup();
		const targetBefore = JSON.stringify( input.targetSnapshot );
		const sourceBefore = JSON.stringify( input.sourceSnapshot );
		input.allocateId = jest.fn().mockReturnValueOnce( 'fresh-first' ).mockImplementationOnce( () => {
			throw new Error( 'SECRET allocator failure' );
		} );
		refuse( input );
		expect( input.allocateId ).toHaveBeenCalledTimes( 2 );
		expect( JSON.stringify( input.targetSnapshot ) ).toBe( targetBefore );
		expect( JSON.stringify( input.sourceSnapshot ) ).toBe( sourceBefore );
	} );

	it( 'detaches results from frozen source, target and admitted surfaces', () => {
		const input = setup();
		const deepFreeze = value => {
			if ( value && typeof value === 'object' && !Object.isFrozen( value ) ) {
				Object.values( value ).forEach( deepFreeze ); Object.freeze( value );
			}
			return value;
		};
		const targetBefore = JSON.stringify( input.targetSnapshot );
		const sourceBefore = JSON.stringify( input.sourceSnapshot );
		const admissionsBefore = JSON.stringify( input.admittedTargetSurfaces );
		deepFreeze( input.targetSnapshot ); deepFreeze( input.sourceSnapshot ); deepFreeze( input.admittedTargetSurfaces );
		const result = Plan.prepare( input );
		const added = result.snapshot.surfaces.find( surface => surface.id === 'target-p1' );
		added.layers[ 0 ].text = 'changed result';
		added.canvas.width = 1;
		expect( JSON.stringify( input.targetSnapshot ) ).toBe( targetBefore );
		expect( JSON.stringify( input.sourceSnapshot ) ).toBe( sourceBefore );
		expect( JSON.stringify( input.admittedTargetSurfaces ) ).toBe( admissionsBefore );
	} );
} );
