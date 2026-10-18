'use strict';

const { TextEncoder } = require( 'util' );
global.TextEncoder = TextEncoder;
const Client = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportReadClient.js' );
const Plan = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportPlan.js' );
const CODE = 'layers-working-copy-import-unavailable';
const options = Object.freeze( { targetPageId: 7, targetBaseRevisionId: 12, targetSurfaceId: 'target-p2',
	sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source-p2' } );
const targetPin = { repository: 'local', fileTitle: 'File:Manual.pdf', timestamp: '20261001000000', sha1: '0'.repeat( 31 ) };
const sourcePin = { repository: 'local', fileTitle: 'File:Manual.pdf', timestamp: '20260901000000', sha1: '1'.repeat( 31 ) };
const canvas = { width: 800, height: 600, backgroundColor: '#fff', backgroundVisible: true, backgroundOpacity: 1 };
const layer = id => ( { id, type: 'text', text: id } );

function surface( id, page, pin, layers = [ layer( id + '-layer' ) ], label = 'ABC' ) {
	return { id, kind: 'pdf', label, canvas: { ...canvas }, source: { ...pin, page }, layers };
}

function validData() {
	const targetSurfaces = [ surface( 'target-p2', 2, targetPin ), surface( 'target-p4', 4, targetPin ) ];
	const sourceSurfaces = [ surface( 'source-p1', 1, sourcePin ), surface( 'source-p2', 2, sourcePin ),
		surface( 'source-p3', 3, sourcePin ) ];
	sourceSurfaces.forEach( member => { member.label = 'abc'; } );
	const bundle = ( revisionId, surfaces ) => ( { revisionId,
		snapshot: { schemaVersion: 1, surfaces },
		sourceGeometry: Object.fromEntries( surfaces.map( member => [ member.id, {
			page: member.source.page, width: 416, height: 208, units: 'file-handler-pixels'
		} ] ) ),
		sourceRenditions: Object.fromEntries( surfaces.map( member => [ member.id, {
			url: 'https://example.test/' + member.id + '.jpg', width: 415, height: 207
		} ] ) )
	} );
	const admitted = [ surface( 'target-p1', 1, targetPin, [] ), surface( 'target-p3', 3, targetPin, [] ) ];
	const geometry = Object.fromEntries( admitted.map( member => [ member.id, {
		page: member.source.page, width: 416, height: 208, units: 'file-handler-pixels'
	} ] ) );
	const renditions = Object.fromEntries( admitted.map( member => [ member.id, {
		url: 'https://example.test/' + member.id + '.jpg', width: 415, height: 207
	} ] ) );
	return {
		target: { pageId: 7, owner: 'Target_page', revisionId: 12, surfaceId: 'target-p2' },
		source: { pageId: 9, owner: 'Source_page', revisionId: 42, surfaceId: 'source-p2' },
		targetBundle: bundle( 12, targetSurfaces ), sourceBundle: bundle( 42, sourceSurfaces ),
		targetGroup: { label: 'ABC', source: { ...targetPin }, pageCount: 4,
			members: [ { page: 2, surfaceId: 'target-p2' }, { page: 4, surfaceId: 'target-p4' } ] },
		sourceGroup: { label: 'abc', source: { ...sourcePin }, pageCount: 3,
			members: [ { page: 1, surfaceId: 'source-p1' }, { page: 2, surfaceId: 'source-p2' },
				{ page: 3, surfaceId: 'source-p3' } ] },
		admittedTargetSurfaces: admitted, admittedTargetGeometry: geometry, admittedTargetRenditions: renditions
	};
}

function response( data = validData() ) {
	const json = Array.from( JSON.stringify( data ), char => {
		const point = char.codePointAt( 0 );
		if ( point <= 127 ) { return char; }
		if ( point <= 0xffff ) { return '\\u' + point.toString( 16 ).padStart( 4, '0' ); }
		const adjusted = point - 0x10000;
		return '\\u' + ( 0xd800 + ( adjusted >> 10 ) ).toString( 16 ) +
			'\\u' + ( 0xdc00 + ( adjusted & 0x3ff ) ).toString( 16 );
	} ).join( '' );
	return { layersworkingcopypdfimportread: { version: 1, data: json } };
}

describe( 'PageOwnedWholePdfImportReadClient', () => {
	let api, client;
	beforeEach( () => {
		api = { post: jest.fn( () => Promise.resolve( response() ) ) };
		client = new Client( api );
	} );

	async function refuse( supplied = options ) {
		let caught;
		try { await client.read( supplied ); } catch ( error ) { caught = error; }
		expect( caught ).toBeInstanceOf( Error );
		expect( caught.message ).toBe( CODE );
		expect( Object.keys( caught ) ).toStrictEqual( [ 'code' ] );
		expect( caught.code ).toBe( CODE );
	}

	test( 'exports an inactive client and requires an injected POST API', () => {
		expect( window.Layers.Editor.PageOwnedWholePdfImportReadClient ).toBe( Client );
		for ( const invalid of [ null, {}, { post: true } ] ) { expect( () => new Client( invalid ) ).toThrow( CODE ); }
	} );

	test( 'posts only the captured native identities and returns a detached complete response', async () => {
		const data = validData(), raw = response( data );
		api.post.mockResolvedValueOnce( raw );
		const result = await client.read( options );
		expect( api.post ).toHaveBeenCalledTimes( 1 );
		expect( api.post ).toHaveBeenCalledWith( { action: 'layersworkingcopypdfimportread', formatversion: 2,
			targetpageid: 7, baserevid: 12, targetsurface: 'target-p2', sourcepageid: 9,
			sourcerevid: 42, sourcesurface: 'source-p2' } );
		expect( result ).toStrictEqual( data );
		data.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'mutated';
		expect( result.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'source-p1-layer' );
	} );

	test( 'reads each option primitive once before awaiting and ignores later mutation', async () => {
		let finish;
		api.post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
		const supplied = {}, reads = {};
		for ( const [ key, value ] of Object.entries( options ) ) {
			Object.defineProperty( supplied, key, { enumerable: true, get: () => { reads[ key ] = ( reads[ key ] || 0 ) + 1; return value; } } );
		}
		const pending = client.read( supplied );
		for ( const key of Object.keys( options ) ) { expect( reads[ key ] ).toBe( 1 ); }
		finish( response() );
		await expect( pending ).resolves.toStrictEqual( validData() );
	} );

	test.each( [ 'targetPageId', 'targetBaseRevisionId', 'sourcePageId', 'sourceRevisionId' ] )(
		'refuses invalid bounded integer %s before transport', async key => {
			for ( const value of [ 0, -1, 2147483648, 1.5, '7', null, NaN, Infinity ] ) {
				await refuse( { ...options, [ key ]: value } );
			}
			expect( api.post ).not.toHaveBeenCalled();
		}
	);

	test( 'refuses malformed options without exposing input values', async () => {
		for ( const supplied of [ null, [], { ...options, extra: 'secret' },
			{ ...options, sourcePageId: options.targetPageId },
			{ ...options, targetSurfaceId: 'x'.repeat( 129 ) },
			{ ...options, sourceSurfaceId: '界'.repeat( 43 ) } ] ) { await refuse( supplied ); }
		expect( api.post ).not.toHaveBeenCalled();
	} );

	test.each( [ 'wrong descriptor', 'wrong revision', 'duplicate id', 'wrong pin', 'missing admission',
		'extra admission', 'duplicate member page', 'unsorted members', 'wrong geometry', 'missing rendition' ] )(
		'refuses incomplete or inconsistent data: %s', async issue => {
			const data = validData();
			if ( issue === 'wrong descriptor' ) { data.source.surfaceId = 'elsewhere'; }
			if ( issue === 'wrong revision' ) { data.targetBundle.revisionId++; }
			if ( issue === 'duplicate id' ) { data.sourceBundle.snapshot.surfaces[ 0 ].id = 'source-p2'; }
			if ( issue === 'wrong pin' ) { data.sourceGroup.source.sha1 = '2'.repeat( 31 ); }
			if ( issue === 'missing admission' ) { data.admittedTargetSurfaces.pop(); }
			if ( issue === 'extra admission' ) {
				const extra = surface( 'extra-admission', 4, targetPin, [] );
				data.admittedTargetSurfaces.push( extra );
				data.admittedTargetGeometry[ extra.id ] = { page: 4, width: 416, height: 208, units: 'file-handler-pixels' };
				data.admittedTargetRenditions[ extra.id ] = { url: 'https://example.test/extra.jpg', width: 415, height: 207 };
			}
			if ( issue === 'duplicate member page' ) { data.sourceGroup.members[ 1 ].page = 1; }
			if ( issue === 'unsorted members' ) { data.targetGroup.members.reverse(); }
			if ( issue === 'wrong geometry' ) { data.targetBundle.sourceGeometry[ 'target-p2' ].page = 1; }
			if ( issue === 'missing rendition' ) { delete data.sourceBundle.sourceRenditions[ 'source-p3' ]; }
			api.post.mockResolvedValueOnce( response( data ) );
			await refuse();
		}
	);

	test( 'accepts equal IDs across owners, numeric map keys and native empty admission maps', async () => {
		const data = validData();
		for ( const role of [ 'target', 'source' ] ) {
			const bundle = data[ role + 'Bundle' ], group = data[ role + 'Group' ];
			const selected = bundle.snapshot.surfaces.find( item => item.source.page === 2 );
			const geometry = bundle.sourceGeometry[ selected.id ], rendition = bundle.sourceRenditions[ selected.id ];
			selected.id = '0';
			data[ role ].surfaceId = '0';
			bundle.snapshot.surfaces = [ selected ];
			bundle.sourceGeometry = [ geometry ];
			bundle.sourceRenditions = [ rendition ];
			group.members = [ { page: 2, surfaceId: '0' } ];
		}
		data.admittedTargetSurfaces = [];
		data.admittedTargetGeometry = [];
		data.admittedTargetRenditions = [];
		api.post.mockResolvedValueOnce( response( data ) );
		await expect( client.read( { ...options, targetSurfaceId: '0', sourceSurfaceId: '0' } ) ).resolves.toStrictEqual( data );
	} );

	test( 'preserves unknown JSON metadata, numeric keys, empty objects, nulls and prototype-like keys', async () => {
		const data = validData();
		const future = JSON.parse( '{"__proto__":{"polluted":true},"constructor":"kept","007":[],"empty":{},"nil":null,"_type":"future","_content":{"text":"e\\u0301 Ω"}}' );
		data.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].future = future;
		api.post.mockResolvedValueOnce( response( data ) );
		const result = await client.read( options );
		const actual = result.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].future;
		expect( Object.hasOwn( actual, '__proto__' ) ).toBe( true );
		expect( actual.__proto__ ).toStrictEqual( { polluted: true } );
		expect( actual.constructor ).toBe( 'kept' );
		expect( actual[ '007' ] ).toStrictEqual( [] );
		expect( actual.empty ).toStrictEqual( {} );
		expect( actual.nil ).toBeNull();
		expect( actual._type ).toBe( 'future' );
		expect( actual._content.text ).toBe( 'e\u0301 Ω' );
		expect( {}.polluted ).toBeUndefined();
	} );

	test( 'rejects bad envelope, non-ASCII JSON, unsafe values and hostile response accessors', async () => {
		for ( const responseValue of [ null, {}, { layersworkingcopypdfimportread: { version: 2, data: '{}' } },
			{ layersworkingcopypdfimportread: { version: 1, data: 'é' } },
			{ layersworkingcopypdfimportread: { version: 1, data: '{' } },
			{ error: { info: 'private diagnostic' } } ] ) {
			api.post.mockResolvedValueOnce( responseValue ); await refuse();
		}
		const hostile = response();
		let invoked = false;
		Object.defineProperty( hostile.layersworkingcopypdfimportread, 'data', { enumerable: true,
			get: () => { invoked = true; throw new Error( 'private' ); } } );
		api.post.mockResolvedValueOnce( hostile ); await refuse();
		expect( invoked ).toBe( false );
	} );

	test( 'rejects network and synchronous failures without retry or diagnostic leakage', async () => {
		api.post.mockRejectedValueOnce( new Error( 'private transport detail' ) ); await refuse();
		api.post.mockImplementationOnce( () => { throw new Error( 'secret' ); } ); await refuse();
		expect( api.post ).toHaveBeenCalledTimes( 2 );
	} );

	test.each( [ 'top-level', 'nested', 'escaped key' ] )( 'refuses duplicate JSON keys: %s', async issue => {
		const raw = response();
		if ( issue === 'top-level' ) {
			raw.layersworkingcopypdfimportread.data = raw.layersworkingcopypdfimportread.data.replace(
				'"target":', '"target":null,"target":' );
		} else {
			const data = validData();
			data.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].future = { repeated: 'retained' };
			raw.layersworkingcopypdfimportread.data = response( data ).layersworkingcopypdfimportread.data.replace(
				'"repeated":"retained"', issue === 'nested' ? '"repeated":null,"repeated":"retained"' :
					'"repeated":null,"\\u0072epeated":"retained"' );
		}
		api.post.mockResolvedValueOnce( raw );
		await refuse();
	} );

	test( 'validated transport output feeds the detached whole-PDF planner without losing pins or unrelated data', async () => {
		const data = validData();
		data.targetBundle.snapshot.metadata = { note: 'target stays whole' };
		data.sourceBundle.snapshot.surfaces.push( { id: 'source-unrelated', kind: 'image', label: 'Other',
			canvas: { ...canvas }, source: { repository: 'local', fileTitle: 'File:Other.png',
				timestamp: '20261001000000', sha1: '2'.repeat( 31 ), page: 1 }, layers: [] } );
		api.post.mockResolvedValueOnce( response( data ) );
		const received = await client.read( options );
		const live = JSON.parse( JSON.stringify( received.targetBundle.snapshot ) );
		live.surfaces[ 0 ].layers.push( layer( 'unsaved-local-work' ) );
		let next = 0;
		const planned = Plan.prepare( { targetSnapshot: live, sourceSnapshot: received.sourceBundle.snapshot,
			targetSurfaceId: received.target.surfaceId, sourceSurfaceId: received.source.surfaceId,
			admittedTargetSurfaces: received.admittedTargetSurfaces, mode: 'append', maxLayers: 20,
			allocateId: () => 'new-' + ++next } );
		expect( planned.snapshot.metadata.note ).toBe( 'target stays whole' );
		expect( planned.snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.source.fileTitle === 'File:Manual.pdf' ) )
			.toHaveLength( 4 );
		expect( planned.snapshot.surfaces.find( surface => surface.id === 'target-p2' ).source ).toStrictEqual( { ...targetPin, page: 2 } );
		expect( planned.snapshot.surfaces.find( surface => surface.id === 'target-p4' ).layers ).toStrictEqual( [ layer( 'target-p4-layer' ) ] );
		expect( planned.pages.map( item => item.page ) ).toStrictEqual( [ 1, 2, 3 ] );
		expect( planned.snapshot.surfaces[ 0 ].layers.some( item => item.id === 'unsaved-local-work' ) ).toBe( true );
	} );

	if ( process.env.LAYERS_PDF_IMPORT_NATIVE_FIXTURE ) {
		test( 'accepts the complete retained native formatter responses', async () => {
			const records = require( 'fs' ).readFileSync( process.env.LAYERS_PDF_IMPORT_NATIVE_FIXTURE, 'utf8' )
				.trim().split( /\r?\n/u ).map( row => JSON.parse( row ) );
			expect( records.length ).toBeGreaterThan( 0 );
			for ( const record of records ) {
				const data = JSON.parse( record.response.layersworkingcopypdfimportread.data );
				api.post.mockResolvedValueOnce( record.response );
				await expect( client.read( { targetPageId: data.target.pageId,
					targetBaseRevisionId: data.target.revisionId, targetSurfaceId: data.target.surfaceId,
					sourcePageId: data.source.pageId, sourceRevisionId: data.source.revisionId,
					sourceSurfaceId: data.source.surfaceId } ) ).resolves.toStrictEqual( data );
			}
		} );
	}
} );
