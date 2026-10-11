'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const vm = require( 'vm' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Planner = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' );

function freeze( value ) {
	if ( value && typeof value === 'object' && !Object.isFrozen( value ) ) {
		Object.values( value ).forEach( freeze );
		Object.freeze( value );
	}
	return value;
}

const target = freeze( {
	id: 'target', kind: 'image', label: 'Same',
	source: { fileTitle: 'File:Example.png', timestamp: '20261001000000', sha1: 'target-pin', repository: 'local' },
	canvas: { width: 100, height: 50, backgroundVisible: false, backgroundOpacity: 0.5, backgroundColor: '#fff', extra: { locked: true } },
	layers: [ { id: 'old', type: 'text', text: 'Old target', metadata: { preserve: [ 'old' ] } } ],
	readingOrder: [ 'old' ], extra: { owner: 'target-owner', revision: 7, ids: [ 'old' ] }
} );
const other = freeze( { id: 'other', kind: 'slide', label: 'Same', canvas: { width: 12, height: 8 },
	layers: [ { id: 'old', type: 'text', text: 'Scoped ID reuse' } ], readingOrder: [ 'old' ], metadata: { retain: true } } );
const imported = freeze( [
	{ id: 'fresh-group', type: 'group', children: [ 'fresh-nested' ], name: 'source-group' },
	{ id: 'fresh-nested', type: 'group', children: [ 'fresh-text', 'fresh-image' ], parentGroup: 'fresh-group' },
	{ id: 'fresh-text', type: 'future-layer', parentGroup: 'fresh-nested', text: 'source-group',
		link: { url: 'source-text' }, children: [ 'source-text' ],
		richText: [ { text: 'source-text', style: { fontWeight: 'bold', color: '#123456' } } ],
		gradient: { type: 'linear', angle: 30, colors: [ { offset: 0, color: '#fff' }, { offset: 1, color: '#000' } ] },
		points: [ { x: 12, y: 13 } ], metadata: { arbitrary: [ false, null, 2, 'source-text' ] } },
	{ id: 'fresh-image', type: 'image', parentGroup: 'fresh-nested', src: 'data:image/png;base64,YQ==',
		originalWidth: 4, originalHeight: 8, visible: false, blendMode: 'multiply', metadata: { nested: { keep: true } } }
] );
const rootMetadata = freeze( { owner: 'page-owner', revision: 8, fields: [ 'complete document' ] } );

function snapshot( destination = target ) {
	return { schemaVersion: 1, metadata: rootMetadata, surfaces: [ destination, other ], extra: { keep: [ 1, 2 ] } };
}

function plan( destination = target, mode = 'replace' ) {
	return { surface: { ...destination, layers: mode === 'append' ? [ ...imported, ...destination.layers ] : imported,
		readingOrder: mode === 'append' ? [ ...destination.readingOrder, 'fresh-image', 'fresh-text' ] : [ 'fresh-image', 'fresh-text' ] },
	importedLayerIds: [ 'fresh-group', 'fresh-nested', 'fresh-text', 'fresh-image' ] };
}

function clone( value ) {
	return JSON.parse( JSON.stringify( value ) );
}

function refuse( document, candidate, mode = 'replace', surfaceId = 'target' ) {
	let failure;
	try {
		new Adapter().withWorkingCopyImport( document, surfaceId, candidate, mode );
	} catch ( error ) {
		failure = error;
	}
	if ( !failure ) {
		throw new Error( 'Expected complete-snapshot refusal' );
	}
	expect( failure.code ).toBe( 'layers-invalid-editor-snapshot' );
	expect( failure.message ).toBe( 'Invalid editor snapshot' );
	expect( failure.stack ).not.toContain( 'SECRET' );
	expect( Object.keys( failure ) ).toEqual( [ 'code' ] );
}

describe( 'PageOwnedWorkingCopyImportBoundary', () => {
	it.each( [ 'empty', 'append', 'replace' ] )( 'preserves the full image snapshot for %s', mode => {
		const destination = mode === 'empty' ? { ...target, layers: [], readingOrder: [] } : target;
		const input = freeze( snapshot( destination ) ), candidate = freeze( plan( destination, mode ) );
		const expected = { schemaVersion: 1, metadata: { owner: 'page-owner', revision: 8, fields: [ 'complete document' ] },
			surfaces: [ { ...destination, layers: mode === 'append' ? [ ...imported, ...target.layers ] : imported,
				readingOrder: mode === 'append' ? [ 'old', 'fresh-image', 'fresh-text' ] : [ 'fresh-image', 'fresh-text' ] }, other ],
			extra: { keep: [ 1, 2 ] } };
		expect( new Adapter().withWorkingCopyImport( input, 'target', candidate, mode ) ).toEqual( expected );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'obeys complete slide canvas/background policy for %s', mode => {
		const destination = { ...target, kind: 'slide', layers: mode === 'empty' ? [] : target.layers,
			readingOrder: mode === 'empty' ? [] : target.readingOrder };
		const input = freeze( snapshot( destination ) ), candidate = plan( destination, mode );
		const copiedCanvas = { width: 900, height: 500, backgroundColor: '#000', backgroundVisible: true,
			backgroundOpacity: 0.8, metadata: { imported: [ 2 ] } };
		if ( mode === 'empty' ) {
			candidate.surface.canvas = copiedCanvas;
		}
		freeze( candidate );
		expect( new Adapter().withWorkingCopyImport( input, 'target', candidate, mode ) ).toEqual( {
			schemaVersion: 1, metadata: rootMetadata, surfaces: [ { ...destination,
				canvas: mode === 'empty' ? copiedCanvas : target.canvas,
				layers: mode === 'append' ? [ ...imported, ...target.layers ] : imported,
				readingOrder: mode === 'append' ? [ 'old', 'fresh-image', 'fresh-text' ] : [ 'fresh-image', 'fresh-text' ] }, other ],
			extra: { keep: [ 1, 2 ] }
		} );
	} );

	it( 'applies a planner result across file-version differences while ordinary update stays strict', () => {
		const input = freeze( snapshot() );
		const source = freeze( { ...target, id: 'source', source: { ...target.source, sha1: 'source-pin', timestamp: '20261002000000' },
			canvas: { width: 400, height: 200 }, layers: [ { id: 'source-old', type: 'text', text: 'Imported' } ], readingOrder: [ 'source-old' ] } );
		const candidate = freeze( Planner.prepare( { targetSurface: target, sourceSurface: source,
			mode: 'replace', maxLayers: 10, allocateId: () => 'fresh' } ) );
		expect( () => new Adapter().withEditorState( input, 'target', { canvas: candidate.surface.canvas, layers: candidate.surface.layers } ) ).toThrow( 'Invalid editor snapshot' );
		expect( new Adapter().withWorkingCopyImport( input, 'target', candidate, 'replace' ) ).toEqual( {
			schemaVersion: 1, metadata: rootMetadata, surfaces: [ { ...target,
				layers: [ { id: 'fresh', type: 'text', text: 'Imported' } ], readingOrder: [ 'fresh' ] }, other ], extra: { keep: [ 1, 2 ] }
		} );
	} );

	it( 'isolates snapshot, plan and every other surface from returned nested mutations', () => {
		const input = freeze( snapshot() ), candidate = freeze( plan() );
		const before = [ clone( input ), clone( candidate ) ];
		const output = new Adapter().withWorkingCopyImport( input, 'target', candidate, 'replace' );
		output.metadata.fields[ 0 ] = 'changed';
		output.surfaces[ 0 ].source.sha1 = 'changed';
		output.surfaces[ 0 ].extra.ids.push( 'changed' );
		output.surfaces[ 0 ].canvas.extra.locked = false;
		output.surfaces[ 0 ].layers[ 2 ].richText[ 0 ].style.color = '#000';
		output.surfaces[ 0 ].layers[ 2 ].gradient.colors[ 0 ].offset = 0.5;
		output.surfaces[ 0 ].layers[ 3 ].metadata.nested.keep = false;
		output.surfaces[ 1 ].layers[ 0 ].text = 'changed';
		expect( input ).toEqual( before[ 0 ] );
		expect( candidate ).toEqual( before[ 1 ] );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'accepts zero imported layers for %s', mode => {
		const destination = mode === 'empty' ? { ...target, layers: [], readingOrder: [] } : target;
		const candidate = { surface: { ...destination, layers: mode === 'append' ? target.layers : [],
			readingOrder: mode === 'append' ? [ 'old' ] : [] }, importedLayerIds: [] };
		expect( new Adapter().withWorkingCopyImport( freeze( snapshot( destination ) ), 'target', freeze( candidate ), mode ) ).toEqual( {
			...snapshot( destination ), surfaces: [ { ...destination, layers: mode === 'append' ? target.layers : [],
				readingOrder: mode === 'append' ? [ 'old' ] : [] }, other ]
		} );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'preserves absent reading order or accepts an explicit valid order for %s', mode => {
		const destination = { ...target, layers: mode === 'empty' ? [] : target.layers };
		delete destination.readingOrder;
		const candidate = { surface: { ...destination, layers: mode === 'append' ? [ ...imported, ...target.layers ] : imported },
			importedLayerIds: [ 'fresh-group', 'fresh-nested', 'fresh-text', 'fresh-image' ] };
		const adapter = new Adapter();
		expect( adapter.withWorkingCopyImport( snapshot( destination ), 'target', candidate, mode ).surfaces[ 0 ] ).not.toHaveProperty( 'readingOrder' );
		candidate.surface.readingOrder = mode === 'append' ? [ 'old', 'fresh-text' ] : [ 'fresh-text' ];
		expect( adapter.withWorkingCopyImport( snapshot( destination ), 'target', candidate, mode ) ).toEqual( {
			...snapshot( destination ), surfaces: [ { ...candidate.surface }, other ]
		} );
	} );

	it( 'allows object key reordering, scoped imported IDs and null-prototype metadata', () => {
		const destination = { ...target, extra: Object.assign( Object.create( null ), { owner: 'target-owner', items: [ 1 ] } ) };
		const candidate = plan( destination );
		candidate.surface.source = { repository: 'local', sha1: 'target-pin', timestamp: '20261001000000', fileTitle: 'File:Example.png' };
		const document = snapshot( destination );
		document.surfaces[ 1 ] = { ...other, layers: [ { id: 'fresh-text', type: 'text' } ], readingOrder: [ 'fresh-text' ] };
		const result = new Adapter().withWorkingCopyImport( freeze( document ), 'target', freeze( candidate ), 'replace' );
		expect( result ).toEqual( { ...document, surfaces: [ candidate.surface, document.surfaces[ 1 ] ] } );
		expect( Object.getPrototypeOf( result.surfaces[ 0 ].extra ) ).toBeNull();
	} );

	it( 'refuses changed candidate source pins in a complete snapshot', () => {
		const candidate = clone( plan() );
		candidate.surface.source.sha1 = 'fabricated-source-pin';
		refuse( freeze( snapshot() ), freeze( candidate ) );
	} );

	it.each( [
		[ 'file', value => { value.surface.source.fileTitle = 'File:Other.png'; } ],
		[ 'timestamp', value => { value.surface.source.timestamp = 'new'; } ],
		[ 'id', value => { value.surface.id = 'other'; } ],
		[ 'name', value => { value.surface.label = 'Other'; } ],
		[ 'owner', value => { value.surface.extra.owner = 'other-owner'; } ],
		[ 'revision', value => { value.surface.extra.revision = 8; } ],
		[ 'ID-like metadata', value => { value.surface.extra.ids = [ 'fresh-text' ]; } ],
		[ 'dropped metadata', value => { delete value.surface.extra; } ],
		[ 'added metadata', value => { value.surface.injected = true; } ],
		[ 'source removal', value => { delete value.surface.source; } ],
		[ 'image canvas', value => { value.surface.canvas.width = 101; } ],
		[ 'dropped order', value => { delete value.surface.readingOrder; } ],
		[ 'dangling order', value => { value.surface.readingOrder = [ 'missing' ]; } ],
		[ 'duplicate order', value => { value.surface.readingOrder = [ 'fresh-text', 'fresh-text' ]; } ],
		[ 'old order', value => { value.surface.readingOrder = [ 'old' ]; } ],
		[ 'duplicate imports', value => { value.importedLayerIds[ 1 ] = 'fresh-group'; } ],
		[ 'old import', value => { value.surface.layers[ 0 ].id = 'old'; value.importedLayerIds[ 0 ] = 'old'; } ],
		[ 'empty import ID', value => { value.importedLayerIds[ 0 ] = ''; } ],
		[ 'wrong prefix', value => { value.importedLayerIds.reverse(); } ],
		[ 'missing import', value => { value.importedLayerIds.pop(); } ],
		[ 'extra import', value => { value.importedLayerIds.push( 'missing' ); } ],
		[ 'duplicate layer', value => { value.surface.layers.push( { id: 'fresh-text', type: 'text' } ); } ],
		[ 'invalid type', value => { value.surface.layers[ 2 ].type = ''; } ],
		[ 'missing children', value => { delete value.surface.layers[ 0 ].children; } ],
		[ 'dangling children', value => { value.surface.layers[ 0 ].children = [ 'missing' ]; } ],
		[ 'duplicate children', value => { value.surface.layers[ 0 ].children.push( 'fresh-nested' ); } ],
		[ 'nonreciprocal parent', value => { delete value.surface.layers[ 2 ].parentGroup; } ],
		[ 'dangling parent', value => { value.surface.layers[ 2 ].parentGroup = 'missing'; } ],
		[ 'non-group parent', value => { value.surface.layers[ 2 ].parentGroup = 'fresh-image'; } ],
		[ 'cycle', value => { value.surface.layers[ 0 ].parentGroup = 'fresh-nested'; value.surface.layers[ 1 ].children.push( 'fresh-group' ); } ],
		[ 'multiple memberships', value => { value.surface.layers[ 0 ].children.push( 'fresh-text' ); } ],
		[ 'invalid canvas', value => { value.surface.canvas.width = 0; } ],
		[ 'PDF candidate', value => { value.surface.kind = 'pdf'; } ],
		[ 'mixed kind', value => { value.surface.kind = 'slide'; } ],
		[ 'plan extra', value => { value.authorized = true; } ]
	] )( 'refuses forged %s without input mutation', ( name, mutate ) => {
		const candidate = clone( plan() ); mutate( candidate ); freeze( candidate );
		const document = freeze( snapshot() ), before = [ clone( document ), clone( candidate ) ];
		refuse( document, candidate );
		expect( document ).toEqual( before[ 0 ] );
		expect( candidate ).toEqual( before[ 1 ] );
	} );

	it.each( [ 'modified payload', 'wrong stack', 'changed group', 'wrong reading prefix', 'old order in suffix' ] )( 'refuses append %s', defect => {
		const destination = { ...target, layers: [ { id: 'old-group', type: 'group', children: [ 'old' ] },
			{ ...target.layers[ 0 ], parentGroup: 'old-group' } ] };
		const candidate = clone( plan( destination, 'append' ) );
		if ( defect === 'modified payload' ) { candidate.surface.layers[ 5 ].text = 'changed'; }
		if ( defect === 'wrong stack' ) { candidate.surface.layers.reverse(); }
		if ( defect === 'changed group' ) { candidate.surface.layers[ 4 ].name = 'changed'; }
		if ( defect === 'wrong reading prefix' ) { candidate.surface.readingOrder = [ 'fresh-text', 'old' ]; }
		if ( defect === 'old order in suffix' ) { candidate.surface.readingOrder = [ 'old', 'old-group' ]; }
		refuse( snapshot( destination ), candidate, 'append' );
	} );

	it.each( [ 'empty', 'append', 'replace' ] )( 'refuses wrong occupancy for %s', mode => {
		const destination = mode === 'empty' ? target : { ...target, layers: [], readingOrder: [] };
		refuse( snapshot( destination ), plan( destination, mode ), mode );
	} );

	it.each( [ 'cancel', '', 'Replace', null, undefined ] )( 'refuses invalid mode %s', mode => {
		expect( () => new Adapter().withWorkingCopyImport( snapshot(), 'target', plan(), mode ) ).toThrow( 'Invalid editor snapshot' );
	} );

	it.each( [ null, {}, [], { surface: target }, { surface: target, importedLayerIds: null } ] )( 'refuses malformed plan %#', candidate => {
		refuse( snapshot(), candidate );
	} );

	it( 'refuses missing/duplicate target IDs, PDF and invalid target structures', () => {
		refuse( snapshot(), plan(), 'replace', 'missing' );
		refuse( { ...snapshot(), surfaces: [ target, target ] }, plan() );
		for ( const destination of [ { ...target, kind: 'pdf' }, { ...target, canvas: { width: Infinity, height: 1 } },
			{ ...target, layers: [ { id: 'old', type: 'text', parentGroup: 'missing' } ] },
			{ ...target, readingOrder: [ 'missing' ] } ] ) { refuse( snapshot( destination ), plan( destination ) ); }
	} );

	it( 'refuses changed populated-slide canvas and image canvas even when empty', () => {
		for ( const mode of [ 'append', 'replace' ] ) {
			const destination = { ...target, kind: 'slide' }, candidate = clone( plan( destination, mode ) );
			candidate.surface.canvas.backgroundColor = '#000'; refuse( snapshot( destination ), candidate, mode );
		}
		const destination = { ...target, layers: [], readingOrder: [] }, candidate = clone( plan( destination, 'empty' ) );
		candidate.surface.canvas.width = 200; refuse( snapshot( destination ), candidate, 'empty' );
	} );

	it.each( [ undefined, () => {}, Symbol( 'secret' ), 1n, NaN, Infinity, new Date(), new Map(),
		Object.create( { custom: true } ), new Array( 2 ) ] )( 'refuses non-JSON snapshot and plan payload %#', payload => {
		refuse( { ...snapshot(), payload }, plan() );
		const candidate = plan(); candidate.surface = { ...candidate.surface, payload }; refuse( snapshot(), candidate );
	} );

	it( 'refuses accessors, reflection errors, cycles, symbol/nonenumerable/array-extra keys without invoking getters', () => {
		const getter = jest.fn( () => { throw new Error( 'SECRET getter' ); } );
		const object = {}, array = [ 1 ], hidden = {}, symbol = { [ Symbol( 'secret' ) ]: 1 }, cycle = {};
		Object.defineProperty( object, 'value', { enumerable: true, get: getter } );
		Object.defineProperty( array, '0', { enumerable: true, get: getter } );
		Object.defineProperty( hidden, 'secret', { value: 1 } ); cycle.self = cycle;
		const extra = [ 1 ]; extra.custom = true;
		const proxy = new Proxy( {}, { getPrototypeOf() { throw new Error( 'SECRET reflection' ); } } );
		for ( const payload of [ object, array, hidden, symbol, cycle, extra, proxy ] ) {
			refuse( { ...snapshot(), payload }, plan() );
			refuse( snapshot(), { ...plan(), payload } );
		}
		for ( const key of [ 'surface', 'importedLayerIds' ] ) {
			const candidate = plan(); Object.defineProperty( candidate, key, { get: getter, enumerable: true } ); refuse( snapshot(), candidate );
		}
		expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'preserves own __proto__ metadata and clones shared acyclic values independently', () => {
		const shared = freeze( { values: [ 1 ] } ), metadata = JSON.parse( '{"__proto__":{"keep":true},"constructor":"data"}' );
		const destination = { ...target, extra: { first: shared, second: shared, metadata } }, candidate = plan( destination );
		const result = new Adapter().withWorkingCopyImport( freeze( snapshot( destination ) ), 'target', freeze( candidate ), 'replace' );
		expect( result.surfaces[ 0 ].extra ).toEqual( destination.extra );
		expect( Object.getPrototypeOf( result.surfaces[ 0 ].extra.metadata ) ).toBe( Object.prototype );
		expect( Object.hasOwn( result.surfaces[ 0 ].extra.metadata, '__proto__' ) ).toBe( true );
		result.surfaces[ 0 ].extra.first.values.push( 2 );
		expect( result.surfaces[ 0 ].extra.second ).toEqual( shared );
		expect( {}.keep ).toBeUndefined();
	} );

	it( 'has no DOM, storage or browser-history effects', () => {
		const before = [ document.documentElement.outerHTML, JSON.stringify( localStorage ), window.history.length ];
		new Adapter().withWorkingCopyImport( snapshot(), 'target', plan(), 'replace' );
		refuse( snapshot(), null );
		expect( [ document.documentElement.outerHTML, JSON.stringify( localStorage ), window.history.length ] ).toEqual( before );
	} );

	describe( 'dependency selection without loader activity', () => {
		const adapterSource = fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' ), 'utf8' );
		const plannerSource = fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportPlan.js' ), 'utf8' );
		const expression = `window.Layers.Editor.PageOwnedWorkingCopyImportPlan.prepare({mode:'empty',maxLayers:10,allocateId:()=> 'fresh',
targetSurface:{id:'target',kind:'slide',label:'Same',canvas:{width:1,height:1},layers:[]},
sourceSurface:{id:'source',kind:'slide',label:'Same',canvas:{width:2,height:3},layers:[{id:'old',type:'text',text:'Keep'}]}})`;
		it.each( [ 'browser', 'classic', 'node' ] )( 'supports %s without an unsupported relative require', kind => {
			const context = vm.createContext( { window: {}, module: { exports: {} } } );
			vm.runInContext( adapterSource, context );
			const loaded = context.window.Layers.Editor.PageOwnedSnapshotAdapter, requireSpy = jest.fn( () => loaded );
			if ( kind === 'node' ) {
				delete context.window.Layers.Editor.PageOwnedSnapshotAdapter;
				context.module = { exports: {}, require: requireSpy };
			} else {
				context.require = jest.fn( () => { throw new Error( 'Unsupported relative require' ); } );
				context.module = kind === 'classic' ? { exports: {} } : undefined;
			}
			vm.runInContext( plannerSource, context );
			expect( JSON.parse( JSON.stringify( vm.runInContext( expression, context ) ) ) ).toEqual( {
				surface: { id: 'target', kind: 'slide', label: 'Same', canvas: { width: 2, height: 3 }, layers: [ { id: 'fresh', type: 'text', text: 'Keep' } ] },
				importedLayerIds: [ 'fresh' ]
			} );
			if ( kind === 'node' ) { expect( requireSpy ).toHaveBeenCalledWith( './PageOwnedSnapshotAdapter.js' ); }
			else { expect( context.require ).not.toHaveBeenCalled(); }
		} );
		it( 'prefers the loaded namespace even when module.require is available', () => {
			const requireSpy = jest.fn( () => { throw new Error( 'Do not load' ); } );
			const context = vm.createContext( { window: {}, module: { exports: {}, require: requireSpy } } );
			vm.runInContext( adapterSource, context ); vm.runInContext( plannerSource, context );
			vm.runInContext( expression, context ); expect( requireSpy ).not.toHaveBeenCalled();
		} );
		it( 'refuses missing adapter with a fixed error and no classic-loader require', () => {
			const unsupported = jest.fn( () => { throw new Error( 'SECRET relative loader' ); } );
			const context = vm.createContext( { window: {}, module: { exports: {} }, require: unsupported } );
			vm.runInContext( plannerSource, context );
			let error; try { vm.runInContext( expression, context ); } catch ( caught ) { error = caught; }
			expect( error.code ).toBe( 'layers-invalid-working-copy-import-plan' );
			expect( error.message ).toBe( 'Invalid working-copy import plan' );
			expect( error.stack ).not.toContain( 'SECRET' ); expect( unsupported ).not.toHaveBeenCalled();
		} );
	} );
} );