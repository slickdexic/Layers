'use strict';

const { TextEncoder } = require( 'util' );
global.TextEncoder = TextEncoder;
const Client = require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportReadClient.js' );
const { exactTextResponse } = require( './fixtures/workingCopyImportContext.js' );
const CODE = 'layers-working-copy-import-unavailable';
const clone = ( value ) => JSON.parse( JSON.stringify( value ) );
const OPTIONS = { targetPageId: 1, targetBaseRevisionId: 2, targetSurfaceId: 'presentation',
	sourcePageId: 2, sourceRevisionId: 4, sourceSurfaceId: 'presentation' };
const NATIVE_SNAPSHOT = { schemaVersion: 1, surfaces: [ {
	canvas: { backgroundColor: '#ffffff', backgroundOpacity: 0, backgroundVisible: false, height: 600, width: 800 },
	id: 'presentation', kind: 'slide', label: 'Welcome Slide',
	layers: [ { color: '#000000', fontSize: 24, id: 'title', text: 'Visual ideas \u2014 \u4e16\u754c',
		type: 'text', x: 40, y: 60 } ], readingOrder: [ 'title' ]
} ] };

function response() {
	return { layersworkingcopyimportread: {
		target: { pageId: 1, owner: 'Target_page', revisionId: 2, surfaceId: 'presentation' },
		source: { pageId: 2, owner: 'Source_page', revisionId: 4, surfaceId: 'presentation' },
		targetBundle: { revisionId: 2, snapshot: clone( NATIVE_SNAPSHOT ), sourceGeometry: [] },
		sourceBundle: { revisionId: 4, snapshot: clone( NATIVE_SNAPSHOT ), sourceGeometry: [] }
	} };
}

describe( 'PageOwnedWorkingCopyImportReadClient', () => {
	let api, client;
	beforeEach( () => {
		api = { get: jest.fn( () => Promise.resolve( response() ) ) };
		client = new Client( { get: async params => exactTextResponse( await api.get( params ), 'layersworkingcopyimportread' ) } );
	} );

	async function fixedRefusal( options = OPTIONS ) {
		let caught;
		try {
			await client.read( options );
		} catch ( error ) {
			caught = error;
		}
		expect( caught ).toBeInstanceOf( Error );
		expect( caught.message ).toBe( CODE );
		expect( Object.keys( caught ) ).toStrictEqual( [ 'code' ] );
		expect( caught.code ).toBe( CODE );
		return caught;
	}

	test( 'exports without constructing any caller and rejects invalid API', () => {
		expect( window.Layers.Editor.PageOwnedWorkingCopyImportReadClient ).toBe( Client );
		for ( const invalid of [ null, {}, { get: true } ] ) {
			expect( () => new Client( invalid ) ).toThrow( CODE );
		}
	} );

	test( 'native-generated complete JSON fixture and exact six-parameter request', async () => {
		const result = await client.read( OPTIONS );
		expect( result ).toStrictEqual( response().layersworkingcopyimportread );
		expect( api.get ).toHaveBeenCalledWith( { action: 'layersworkingcopyimportread', formatversion: 2,
			targetpageid: 1, baserevid: 2, targetsurface: 'presentation', sourcepageid: 2,
			sourcerevid: 4, sourcesurface: 'presentation', exacttext: true } );
		if ( process.env.LAYERS_IMPORT_NATIVE_FIXTURE ) {
			const records = require( 'fs' ).readFileSync( process.env.LAYERS_IMPORT_NATIVE_FIXTURE, 'utf8' )
				.trim().split( /\r?\n/ ).map( ( line ) => JSON.parse( line ) );
			const nativeValue = records[ 0 ].response.layersworkingcopyimportread;
			const native = nativeValue && nativeValue.version === 1 && typeof nativeValue.data === 'string' ? JSON.parse( nativeValue.data ) : nativeValue;
			expect( native.targetBundle.snapshot ).toStrictEqual( NATIVE_SNAPSHOT );
			expect( native.sourceBundle.snapshot ).toStrictEqual( NATIVE_SNAPSHOT );
			api.get.mockResolvedValueOnce( records[ 0 ].response );
			await expect( client.read( {
				targetPageId: native.target.pageId, targetBaseRevisionId: native.target.revisionId,
				targetSurfaceId: native.target.surfaceId, sourcePageId: native.source.pageId,
				sourceRevisionId: native.source.revisionId, sourceSurfaceId: native.source.surfaceId
			} ) ).resolves.toStrictEqual( native );
		}
	} );

	test( 'captures each primitive once synchronously and ignores in-flight option mutation', async () => {
		let finish;
		api.get.mockImplementationOnce( () => new Promise( ( resolve ) => { finish = resolve; } ) );
		const options = {};
		const counts = {};
		for ( const [ key, value ] of Object.entries( OPTIONS ) ) {
			Object.defineProperty( options, key, { configurable: true, enumerable: true,
				get: () => { counts[ key ] = ( counts[ key ] || 0 ) + 1; return value; } } );
		}
		const pending = client.read( options );
		for ( const key of Object.keys( OPTIONS ) ) {
			Object.defineProperty( options, key, { value: 'changed', enumerable: true } );
			expect( counts[ key ] ).toBe( 1 );
		}
		finish( response() );
		await expect( pending ).resolves.toStrictEqual( response().layersworkingcopyimportread );
	} );

	test.each( [ 'targetPageId', 'targetBaseRevisionId', 'sourcePageId', 'sourceRevisionId' ] )(
		'validates bounded integer %s before transport', async ( field ) => {
			for ( const invalid of [ 0, -1, 2147483648, 1.5, '2', null, undefined, NaN, Infinity, {} ] ) {
				await fixedRefusal( { ...OPTIONS, [ field ]: invalid } );
			}
			expect( api.get ).not.toHaveBeenCalled();
		}
	);

	test.each( [ 'targetSurfaceId', 'sourceSurfaceId' ] )( 'validates member %s as bytes without trimming',
		async ( field ) => {
			for ( const invalid of [ '', null, undefined, 3, {}, 'a'.repeat( 129 ), '\u754c'.repeat( 43 ) ] ) {
				await fixedRefusal( { ...OPTIONS, [ field ]: invalid } );
			}
			expect( api.get ).not.toHaveBeenCalled();
			const options = { ...OPTIONS, [ field ]: ' ' };
			const data = response();
			const role = field === 'targetSurfaceId' ? 'target' : 'source';
			data.layersworkingcopyimportread[ role ].surfaceId = ' ';
			data.layersworkingcopyimportread[ role + 'Bundle' ].snapshot.surfaces[ 0 ].id = ' ';
			api.get.mockResolvedValueOnce( data );
			await expect( client.read( options ) ).resolves.toBeDefined();
		} );

	test( 'rejects missing, extra, symbolic and same-native-owner identity locally', async () => {
		for ( const key of Object.keys( OPTIONS ) ) {
			const options = { ...OPTIONS }; delete options[ key ]; await fixedRefusal( options );
		}
		for ( const options of [ null, [], {}, { ...OPTIONS, owner: 'Title' },
			{ ...OPTIONS, authority: true }, { ...OPTIONS, [ Symbol( 'identity' ) ]: 1 },
			{ ...OPTIONS, sourcePageId: OPTIONS.targetPageId } ] ) {
			await fixedRefusal( options );
		}
		expect( api.get ).not.toHaveBeenCalled();
	} );

	test( 'fresh request on every invocation, no sharing, no retry after refusal', async () => {
		await Promise.all( [ client.read( OPTIONS ), client.read( OPTIONS ) ] );
		expect( api.get ).toHaveBeenCalledTimes( 2 );
		api.get.mockResolvedValueOnce( { error: { code: 'permissiondenied', secret: 'private' } } );
		const first = await fixedRefusal();
		api.get.mockRejectedValueOnce( 'private source denied' );
		const second = await fixedRefusal();
		expect( first ).not.toBe( second );
		expect( api.get ).toHaveBeenCalledTimes( 4 );
	} );

	test( 'safe sync, promise, jquery-style and error-response failures', async () => {
		api.get.mockImplementationOnce( () => { throw new Error( 'private secret' ); } );
		await fixedRefusal();
		api.get.mockImplementationOnce( () => ( { then: ( resolve, reject ) => reject( 'private', {} ) } ) );
		await fixedRefusal();
		api.get.mockResolvedValueOnce( { error: { code: 'private', info: 'secret' } } );
		await fixedRefusal();
	} );

	test.each( [ [ 'target', 'pageId', 99 ], [ 'source', 'pageId', 99 ],
		[ 'target', 'revisionId', 99 ], [ 'source', 'revisionId', 99 ],
		[ 'target', 'surfaceId', 'other' ], [ 'source', 'surfaceId', 'other' ],
		[ 'target', 'owner', '' ], [ 'source', 'owner', 1 ] ] )(
		'refuses mismatched descriptor %s %s', async ( role, key, value ) => {
			const data = response(); data.layersworkingcopyimportread[ role ][ key ] = value;
			api.get.mockResolvedValueOnce( data ); await fixedRefusal();
		}
	);

	test( 'moved owner labels and equal labels on distinct native IDs are not identity proof', async () => {
		const data = response();
		data.layersworkingcopyimportread.target.owner = 'Moved_page';
		data.layersworkingcopyimportread.source.owner = 'Moved_page';
		api.get.mockResolvedValueOnce( data );
		await expect( client.read( OPTIONS ) ).resolves.toStrictEqual( data.layersworkingcopyimportread );
	} );

	test.each( [ 'target', 'source' ] )( 'refuses extra or missing descriptor keys for %s', async ( role ) => {
		let data = response(); data.layersworkingcopyimportread[ role ].canEdit = true;
		api.get.mockResolvedValueOnce( data ); await fixedRefusal();
		data = response(); delete data.layersworkingcopyimportread[ role ].owner;
		api.get.mockResolvedValueOnce( data ); await fixedRefusal();
	} );

	test.each( [ 'wrong-revision', 'wrong-schema', 'missing', 'duplicate', 'pdf', 'geometry', 'geometry-entry' ] )(
		'refuses malformed complete bundles: %s', async ( failure ) => {
			const data = response(), bundle = data.layersworkingcopyimportread.sourceBundle;
			if ( failure === 'wrong-revision' ) { bundle.revisionId = 99; }
			if ( failure === 'wrong-schema' ) { bundle.snapshot.schemaVersion = 2; }
			if ( failure === 'missing' ) { bundle.snapshot.surfaces = []; }
			if ( failure === 'duplicate' ) { bundle.snapshot.surfaces.push( clone( bundle.snapshot.surfaces[ 0 ] ) ); }
			if ( failure === 'pdf' ) { bundle.snapshot.surfaces[ 0 ].kind = 'pdf'; }
			if ( failure === 'geometry' ) { bundle.sourceGeometry = [ {} ]; }
			if ( failure === 'geometry-entry' ) { bundle.sourceGeometry = { presentation: { width: 0, height: 10 } }; }
			api.get.mockResolvedValueOnce( data ); await fixedRefusal();
		}
	);

	test( 'preserves complete finite data and unresolved unrelated members with full detachment', async () => {
		const data = response(), bundle = data.layersworkingcopyimportread.sourceBundle;
		bundle.unknown = { null: null, false: false, zero: 0, empty: [], nested: { value: 0.125 } };
		bundle.snapshot.surfaces.push( { id: 'unavailable-sibling', kind: 'image',
			source: { fileTitle: 'File:Unavailable.png', timestamp: '20260906120000', sha1: 'pin' } } );
		api.get.mockResolvedValueOnce( data );
		const expected = clone( data.layersworkingcopyimportread );
		const result = await client.read( OPTIONS );
		expect( result ).toStrictEqual( expected );
		bundle.unknown.nested.value = 9;
		result.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'changed';
		expect( result.sourceBundle.unknown.nested.value ).toBe( 0.125 );
		expect( bundle.snapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( NATIVE_SNAPSHOT.surfaces[ 0 ].layers[ 0 ].text );
	} );

	test.each( [ undefined, NaN, Infinity, 9007199254740992, () => 1, 1n, new Date(), Symbol( 'bad' ) ] )(
		'refuses non-JSON finite unsafe value %#', async ( value ) => {
			const data = response(); data.layersworkingcopyimportread.sourceBundle.unknown = value;
			api.get.mockResolvedValueOnce( data ); await fixedRefusal();
		}
	);

	test( 'does not invoke response getters or toJSON, rejects cycles, sparse arrays and dangerous keys', async () => {
		const getter = jest.fn( () => { throw new Error( 'secret' ); } );
		const hook = jest.fn( () => 'secret' );
		const accessor = response();
		Object.defineProperty( accessor.layersworkingcopyimportread.source, 'owner', { enumerable: true, get: getter } );
		const hooked = response(); hooked.toJSON = hook;
		const cycle = response(); cycle.loop = cycle;
		const sparse = response(); sparse.layersworkingcopyimportread.sourceBundle.unknown = Array( 2 );
		const dangerous = response();
		Object.defineProperty( dangerous, '__proto__', { enumerable: true, value: {} } );
		for ( const data of [ accessor, hooked, cycle, sparse, dangerous, null, 'bad JSON', {} ] ) {
			api.get.mockResolvedValueOnce( data ); await fixedRefusal();
		}
		expect( getter ).not.toHaveBeenCalled();
		expect( hook ).not.toHaveBeenCalled();
	} );
} );
