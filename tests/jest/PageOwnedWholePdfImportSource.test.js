'use strict';

const { TextEncoder } = require( 'util' );
global.TextEncoder = TextEncoder;
const Source = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSource.js' );
const CODE = 'layers-working-copy-import-unavailable';
const requestIdentity = { targetPageId: 7, targetBaseRevisionId: 12, targetSurfaceId: 'target-p2',
	sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source-p2' };
const targetPin = { repository: 'local', fileTitle: 'File:Manual.pdf', timestamp: '20261001000000', sha1: '0'.repeat( 31 ) };
const sourcePin = { repository: 'local', fileTitle: 'File:Manual.pdf', timestamp: '20260901000000', sha1: '1'.repeat( 31 ) };
const canvas = { width: 800, height: 600, backgroundColor: '#fff', backgroundVisible: true, backgroundOpacity: 1 };
const layer = id => ( { id, type: 'text', text: id } );

function member( id, page, pin, layers = [ layer( id + '-layer' ) ], label = 'ABC' ) {
	return { id, kind: 'pdf', label, canvas: { ...canvas }, source: { ...pin, page }, layers };
}

function data() {
	const targetSurfaces = [ member( 'target-p2', 2, targetPin ), member( 'target-p4', 4, targetPin ) ];
	const sourceSurfaces = [ member( 'source-p1', 1, sourcePin ), member( 'source-p2', 2, sourcePin ),
		member( 'source-p3', 3, sourcePin ) ];
	sourceSurfaces.forEach( surface => { surface.label = 'abc'; } );
	const bundle = ( revisionId, surfaces ) => ( { revisionId, snapshot: { schemaVersion: 1, surfaces },
		sourceGeometry: Object.fromEntries( surfaces.map( surface => [ surface.id, {
			page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels'
		} ] ) ),
		sourceRenditions: Object.fromEntries( surfaces.map( surface => [ surface.id, {
			url: 'https://example.test/' + surface.id + '.jpg', width: 415, height: 207
		} ] ) ) } );
	const admitted = [ member( 'target-p1', 1, targetPin, [] ), member( 'target-p3', 3, targetPin, [] ) ];
	const geometry = Object.fromEntries( admitted.map( surface => [ surface.id, {
		page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels'
	} ] ) );
	const renditions = Object.fromEntries( admitted.map( surface => [ surface.id, {
		url: 'https://example.test/' + surface.id + '.jpg', width: 415, height: 207
	} ] ) );
	return { target: { pageId: 7, owner: 'Target_page', revisionId: 12, surfaceId: 'target-p2' },
		source: { pageId: 9, owner: 'Source_page', revisionId: 42, surfaceId: 'source-p2' },
		targetBundle: bundle( 12, targetSurfaces ), sourceBundle: bundle( 42, sourceSurfaces ),
		targetGroup: { label: 'ABC', source: { ...targetPin }, pageCount: 4,
			members: [ { page: 2, surfaceId: 'target-p2' }, { page: 4, surfaceId: 'target-p4' } ] },
		sourceGroup: { label: 'abc', source: { ...sourcePin }, pageCount: 3,
			members: [ { page: 1, surfaceId: 'source-p1' }, { page: 2, surfaceId: 'source-p2' },
				{ page: 3, surfaceId: 'source-p3' } ] },
		admittedTargetSurfaces: admitted, admittedTargetGeometry: geometry, admittedTargetRenditions: renditions };
}

function envelope( payload = data() ) {
	const json = Array.from( JSON.stringify( payload ), char => {
		const point = char.codePointAt( 0 );
		if ( point <= 127 ) { return char; }
		if ( point <= 0xffff ) { return '\\u' + point.toString( 16 ).padStart( 4, '0' ); }
		const adjusted = point - 0x10000;
		return '\\u' + ( 0xd800 + ( adjusted >> 10 ) ).toString( 16 ) +
			'\\u' + ( 0xdc00 + ( adjusted & 0x3ff ) ).toString( 16 );
	} ).join( '' );
	return { layersworkingcopypdfimportread: { version: 1, data: json } };
}

function setup( mode = 'append' ) {
	let next = 0;
	const saved = data().targetBundle.snapshot;
	const live = JSON.parse( JSON.stringify( saved ) );
	live.metadata = { keep: { nested: true } };
	const unrelatedFile = member( 'unrelated-pdf', 1, { ...targetPin, fileTitle: 'File:Other.pdf' }, [ layer( 'unrelated-layer' ) ], 'ABC' );
	unrelatedFile.canvas.width = 1024;
	const unrelatedSlide = { id: 'unrelated-slide', kind: 'slide', label: 'Other', canvas: { ...canvas, height: 720 },
		layers: [ layer( 'slide-layer' ) ] };
	live.surfaces.push( unrelatedFile, unrelatedSlide );
	live.surfaces[ 0 ].layers.push( layer( 'unsaved-target-layer' ) );
	live.surfaces[ 0 ].canvas.backgroundColor = '#123456';
	const api = { post: jest.fn( () => Promise.resolve( envelope() ) ) };
	const post = api.post;
	const source = new Source( api );
	const supplied = { identity: { ...requestIdentity }, baseSnapshot: saved, targetSnapshot: live,
		mode, maxLayers: 20, allocateId: jest.fn( () => 'imported-' + ++next ), assertCurrent: jest.fn() };
	return { api, post, source, supplied, saved, live };
}

async function refused( promise ) {
	let error;
	try { await promise; } catch ( caught ) { error = caught; }
	expect( error ).toBeInstanceOf( Error );
	expect( error.message ).toBe( CODE );
	expect( error.code ).toBe( CODE );
	expect( Object.keys( error ) ).toStrictEqual( [ 'code' ] );
}

describe( 'PageOwnedWholePdfImportSource', () => {
	test( 'exports an inactive source and captures native identities in one POST', async () => {
		const { post, source, supplied } = setup();
		expect( window.Layers.Editor.PageOwnedWholePdfImportSource ).toBe( Source );
		const handle = await source.prepare( supplied );
		expect( post ).toHaveBeenCalledTimes( 1 );
		expect( post ).toHaveBeenCalledWith( { action: 'layersworkingcopypdfimportread', formatversion: 2,
			targetpageid: 7, baserevid: 12, targetsurface: 'target-p2', sourcepageid: 9,
			sourcerevid: 42, sourcesurface: 'source-p2' } );
		expect( handle ).toBeTruthy();
	} );

	test.each( [ 'empty', 'append', 'replace' ] )( 'prepares detached %s work and retains the complete live target', async mode => {
		const { source, supplied, saved, live } = setup( mode );
		if ( mode === 'empty' ) {
			live.surfaces.slice( 0, 2 ).forEach( surface => { surface.layers = []; } );
			supplied.targetSnapshot = live;
			supplied.baseSnapshot = saved;
		}
		const before = JSON.stringify( live );
		const handle = await source.prepare( supplied );
		const preview = source.inspect( handle );
		expect( preview.mode ).toBe( mode );
		expect( preview.candidateSnapshot.metadata ).toStrictEqual( live.metadata );
		expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'target-p2' ).source )
			.toStrictEqual( { ...targetPin, page: 2 } );
		expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'target-p2' ).canvas.backgroundColor )
			.toBe( '#123456' );
		if ( mode === 'append' ) {
			expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'target-p2' ).layers )
				.toContainEqual( layer( 'unsaved-target-layer' ) );
		}
		if ( mode === 'replace' ) {
			expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'target-p2' ).layers )
				.not.toContainEqual( layer( 'unsaved-target-layer' ) );
			expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'target-p4' ).layers ).toStrictEqual( [] );
		}
		expect( preview.candidateSnapshot.surfaces ).toHaveLength( 6 );
		expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'unrelated-pdf' ) )
			.toStrictEqual( live.surfaces.find( item => item.id === 'unrelated-pdf' ) );
		expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'unrelated-slide' ) )
			.toStrictEqual( live.surfaces.find( item => item.id === 'unrelated-slide' ) );
		expect( preview.candidateSnapshot.surfaces.find( item => item.id === 'target-p2' ).canvas )
			.toStrictEqual( live.surfaces[ 0 ].canvas );
		expect( preview.pages.map( page => page.page ) ).toStrictEqual( [ 1, 2, 3 ] );
		expect( preview.differentFileVersion ).toBe( true );
		preview.candidateSnapshot.surfaces[ 0 ].canvas.width = 1;
		preview.pages[ 0 ].importedLayerIds.push( 'mutated' );
		expect( JSON.stringify( live ) ).toBe( before );
		const evidence = source.getReadEvidence( handle );
		evidence.result.targetGroup.label = 'mutated evidence';
		expect( source.getReadEvidence( handle ).result.targetGroup.label ).toBe( 'ABC' );
	} );

	test( 'Cancel makes no transport, guard or allocator calls', async () => {
		const { post, source, supplied } = setup( 'cancel' );
		await expect( source.prepare( supplied ) ).resolves.toBeNull();
		expect( post ).not.toHaveBeenCalled();
		expect( supplied.assertCurrent ).not.toHaveBeenCalled();
		expect( supplied.allocateId ).not.toHaveBeenCalled();
	} );

	test( 'refuses an unsaved extra PDF member without allocating IDs', async () => {
		const { source, supplied } = setup();
		supplied.targetSnapshot.surfaces.push( member( 'temporary-page-1', 1, targetPin, [], 'ABC' ) );
		await refused( source.prepare( supplied ) );
		expect( supplied.allocateId ).not.toHaveBeenCalled();
	} );

	test( 'synchronous current guard prevents read, and a change during read prevents planning', async () => {
		const first = setup();
		first.supplied.assertCurrent.mockImplementation( () => { throw new Error( 'stale editor' ); } );
		await refused( first.source.prepare( first.supplied ) );
		expect( first.post ).not.toHaveBeenCalled();
		const second = setup();
		const expected = JSON.stringify( second.supplied.targetSnapshot );
		second.supplied.assertCurrent.mockImplementation( () => {
			if ( JSON.stringify( second.supplied.targetSnapshot ) !== expected ) { throw new Error( 'stale editor' ); }
		} );
		second.post.mockImplementationOnce( () => {
			second.supplied.targetSnapshot.surfaces[ 0 ].layers.push( layer( 'late edit' ) );
			return Promise.resolve( envelope() );
		} );
		await refused( second.source.prepare( second.supplied ) );
		expect( second.supplied.allocateId ).not.toHaveBeenCalled();
	} );

	test( 'checks freshness around each allocator callback and retains later live edits', async () => {
		const { source, supplied, live } = setup();
		const expected = JSON.stringify( live );
		supplied.assertCurrent.mockImplementation( () => {
			if ( JSON.stringify( live ) !== expected ) { throw new Error( 'stale editor' ); }
		} );
		supplied.allocateId.mockImplementation( () => {
			live.metadata.keep.nested = false;
			return 'allocated-before-stale-check';
		} );
		await refused( source.prepare( supplied ) );
		expect( supplied.allocateId ).toHaveBeenCalledTimes( 1 );
		expect( live.metadata.keep.nested ).toBe( false );
	} );

	test( 'revalidates the exact complete read and refuses changed DTO or denied read', async () => {
		for ( const mutate of [ payload => { payload.sourceGroup.pageCount++; }, null ] ) {
			const { source, supplied, post } = setup();
			const handle = await source.prepare( supplied );
			if ( mutate ) {
				post.mockResolvedValueOnce( envelope( ( () => { const changed = data(); mutate( changed ); return changed; } )() ) );
			} else { post.mockRejectedValueOnce( new Error( 'private denial detail' ) ); }
			await refused( source.revalidate( handle ) );
		}
		const valid = setup();
		const validHandle = await valid.source.prepare( valid.supplied );
		await expect( valid.source.revalidate( validHandle ) ).resolves.toBeUndefined();
	} );

	test( 'protects handles, detached evidence, release and disposal across pending reads', async () => {
		const { source, supplied, post } = setup();
		const handle = await source.prepare( supplied );
		expect( () => source.inspect( Object.freeze( Object.create( null ) ) ) ).toThrow( CODE );
		const other = new Source( { post: jest.fn( () => Promise.resolve( envelope() ) ) } );
		expect( () => other.inspect( handle ) ).toThrow( CODE );
		const preview = source.inspect( handle );
		preview.candidateSnapshot.surfaces[ 0 ].layers[ 0 ].text = 'tampered';
		expect( source.inspect( handle ).candidateSnapshot.surfaces[ 0 ].layers[ 0 ].text ).not.toBe( 'tampered' );
		let finish;
		post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
		const checking = source.revalidate( handle );
		await refused( source.revalidate( handle ) );
		source.release( handle );
		finish( envelope() );
		await refused( checking );
		const second = await source.prepare( supplied );
		source.dispose();
		expect( () => source.inspect( second ) ).toThrow( CODE );
		await refused( source.prepare( supplied ) );
	} );

	test( 'rejects mismatched saved base and malformed request descriptors before publication', async () => {
		const mismatch = setup();
		mismatch.supplied.baseSnapshot.surfaces[ 0 ].layers[ 0 ].text = 'wrong saved base';
		await refused( mismatch.source.prepare( mismatch.supplied ) );
		expect( mismatch.supplied.allocateId ).not.toHaveBeenCalled();
		const malformed = setup();
		let invoked = false;
		Object.defineProperty( malformed.supplied, 'identity', { enumerable: true, get: () => {
			invoked = true;
			return requestIdentity;
		} } );
		await refused( malformed.source.prepare( malformed.supplied ) );
		expect( invoked ).toBe( false );
		expect( malformed.post ).not.toHaveBeenCalled();
	} );

	test( 'refuses API method replacement and disposal during a pending preparation', async () => {
		const replaced = setup();
		const changed = jest.fn( () => Promise.resolve( envelope() ) );
		replaced.source.dispose();
		replaced.source = new Source( { post: replaced.post } );
		const handle = await replaced.source.prepare( replaced.supplied );
		replaced.source.dispose();
		expect( () => replaced.source.inspect( handle ) ).toThrow( CODE );
		const pending = setup();
		let finish;
		pending.post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
		const preparing = pending.source.prepare( pending.supplied );
		pending.source.dispose();
		finish( envelope() );
		await refused( preparing );
		const methodSwap = setup();
		const pendingHandle = await methodSwap.source.prepare( methodSwap.supplied );
		methodSwap.api.post = changed;
		await refused( Promise.resolve().then( () => methodSwap.source.inspect( pendingHandle ) ) );
	} );

	test.each( [ 'metadata', 'offscreen layers', 'geometry', 'rendition', 'admission' ] )(
		'fresh revalidation refuses complete native drift: %s', async issue => {
			const { source, supplied, post } = setup(), handle = await source.prepare( supplied );
			const changed = data();
			if ( issue === 'metadata' ) { changed.sourceBundle.snapshot.unknown = { preserved: null }; }
			if ( issue === 'offscreen layers' ) { changed.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'changed'; }
			if ( issue === 'geometry' ) { changed.sourceBundle.sourceGeometry[ 'source-p3' ].height++; }
			if ( issue === 'rendition' ) { changed.targetBundle.sourceRenditions[ 'target-p4' ].url += '?changed'; }
			if ( issue === 'admission' ) { changed.admittedTargetSurfaces[ 0 ].canvas.backgroundColor = '#000'; }
			post.mockResolvedValueOnce( envelope( changed ) );
			await refused( source.revalidate( handle ) );
		}
	);

	test.each( [ 'missing page', 'changed pin', 'renamed group', 'duplicate page' ] )(
		'refuses changed live member identity before allocating: %s', async issue => {
			const { source, supplied } = setup(), members = supplied.targetSnapshot.surfaces;
			if ( issue === 'missing page' ) { members.splice( 1, 1 ); }
			if ( issue === 'changed pin' ) { members[ 0 ].source.sha1 = '2'.repeat( 31 ); }
			if ( issue === 'renamed group' ) { members[ 0 ].label = 'Elsewhere'; }
			if ( issue === 'duplicate page' ) { members[ 1 ].source.page = 2; }
			const before = JSON.stringify( supplied.targetSnapshot );
			await refused( source.prepare( supplied ) );
			expect( supplied.allocateId ).not.toHaveBeenCalled();
			expect( JSON.stringify( supplied.targetSnapshot ) ).toBe( before );
		}
	);

	test.each( [ 'layer limit', 'duplicate allocated ID', 'throwing allocator' ] )(
		'refuses the whole candidate and preserves input on %s', async issue => {
			const { source, supplied } = setup(), before = JSON.stringify( supplied.targetSnapshot );
			if ( issue === 'layer limit' ) { supplied.maxLayers = 1; }
			if ( issue === 'duplicate allocated ID' ) { supplied.allocateId.mockReturnValue( 'unsaved-target-layer' ); }
			if ( issue === 'throwing allocator' ) { supplied.allocateId.mockImplementation( () => { throw new Error( 'private allocation detail' ); } ); }
			await refused( source.prepare( supplied ) );
			expect( JSON.stringify( supplied.targetSnapshot ) ).toBe( before );
		}
	);

	test( 'rejects non-synchronous success and malformed data without invoking getters', async () => {
		for ( const result of [ true, false, Promise.resolve(), null ] ) {
			const { source, supplied, post } = setup();
			supplied.assertCurrent.mockReturnValue( result );
			await refused( source.prepare( supplied ) );
			expect( post ).not.toHaveBeenCalled();
		}
		const current = setup(), getter = jest.fn();
		Object.defineProperty( current.live.metadata, 'secret', { enumerable: true, get: getter } );
		await refused( current.source.prepare( current.supplied ) );
		expect( getter ).not.toHaveBeenCalled();
		expect( current.post ).not.toHaveBeenCalled();
	} );

	test( 'cleanup remains possible after a complete-work guard refuses and handles cannot be reused', async () => {
		const { source, supplied } = setup(), handle = await source.prepare( supplied );
		expect( Object.isFrozen( handle ) ).toBe( true );
		expect( Object.getPrototypeOf( handle ) ).toBeNull();
		expect( Reflect.ownKeys( handle ) ).toStrictEqual( [] );
		supplied.assertCurrent.mockImplementation( () => { throw new Error( 'later work' ); } );
		expect( () => source.inspect( handle ) ).toThrow( CODE );
		expect( () => source.getReadEvidence( handle ) ).toThrow( CODE );
		expect( () => source.release( handle ) ).not.toThrow();
		expect( () => source.release( handle ) ).toThrow( CODE );
	} );

	test( 'captures mutable request values before awaiting while the live participant guard remains authoritative', async () => {
		const { source, supplied, post } = setup();
		let finish;
		post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
		const pending = source.prepare( supplied );
		supplied.identity.sourceRevisionId = 99;
		supplied.mode = 'replace';
		supplied.maxLayers = 1;
		finish( envelope() );
		const handle = await pending;
		expect( source.inspect( handle ).mode ).toBe( 'append' );
		expect( source.getReadEvidence( handle ).request.sourceRevisionId ).toBe( 42 );
	} );
} );
