/** Focused contract tests for the whole-PDF import publisher. */
'use strict';

global.TextEncoder = global.TextEncoder || require( 'util' ).TextEncoder;
window.Layers = window.Layers || {};
window.Layers.Editor = window.Layers.Editor || {};
const Client = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportPublishClient.js' );

const BASE = {
	pageId: 40, baseRevisionId: 100, snapshotJson: '{"futureField":{"未知":true},"version":1}',
	sources: [ { targetSurfaceId: 'pdf/頁/2', sourcePageId: 41, sourceRevisionId: 18, sourceSurfaceId: 'pdf/頁/2' } ],
	admissionRevisions: [ { surfaceId: 'pdf/頁/2', revisionId: 99 } ], summary: 'Imported PDF layers'
};

describe( 'PageOwnedWholePdfImportPublishClient', () => {
	let api;
	let client;
	beforeEach( () => {
		api = { postWithToken: jest.fn().mockResolvedValue( {
			layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: 101 }
		} ) };
		client = new Client( api );
	} );

	it( 'exports the new class without replacing the existing publisher', () => {
		expect( window.Layers.Editor.PageOwnedWholePdfImportPublishClient ).toBe( Client );
		expect( require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' ) ).toBeDefined();
	} );

	it( 'publishes the exact canonical native payload and retains complete Unicode snapshot JSON', async () => {
		await expect( client.publish( BASE ) ).resolves.toEqual( { revisionId: 101 } );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( api.postWithToken ).toHaveBeenCalledWith( 'csrf', {
			action: 'layersworkingcopypdfimportpublish', targetpageid: 40, baserevid: 100,
			data: BASE.snapshotJson,
			importsources: '[{"targetSurfaceId":"pdf/頁/2","sourcePageId":41,"sourceRevisionId":18,"sourceSurfaceId":"pdf/頁/2"}]',
			admissionrevisions: '[{"surfaceId":"pdf/頁/2","revisionId":99}]', summary: 'Imported PDF layers'
		} );
	} );

	it.each( [
		[ 'defaults the optional summary', { summary: undefined }, 'summary', '' ],
		[ 'defaults omitted admissions', { admissionRevisions: undefined }, 'admissionrevisions', '[]' ]
	] )( '%s', async ( _name, replace, key, expected ) => {
		const req = { ...BASE, ...replace };
		if ( replace[ key === 'summary' ? 'summary' : 'admissionRevisions' ] === undefined ) {
			delete req[ key === 'summary' ? 'summary' : 'admissionRevisions' ];
		}
		await client.publish( req );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ][ key ] ).toBe( expected );
	} );

	it.each( [ null, 4, 'request', [], Object.create( { pageId: 40 } ) ] )( 'rejects invalid request shape %p without transport', async ( request ) => {
		await expect( client.publish( request ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'rejects request accessors without invoking them', async () => {
		let called = false;
		const req = { ...BASE };
		Object.defineProperty( req, 'pageId', { enumerable: true, get: () => { called = true; return 40; } } );
		await expect( client.publish( req ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		expect( called ).toBe( false );
	} );

	it( 'rejects symbol, extra, nonenumerable and custom-prototype request fields', async () => {
		const cases = [];
		cases.push( Object.assign( { ...BASE }, { extra: true } ) );
		const symbol = { ...BASE }; symbol[ Symbol( 'hidden' ) ] = 1; cases.push( symbol );
		const hidden = { ...BASE }; Object.defineProperty( hidden, 'unused', { value: 1 } ); cases.push( hidden );
		cases.push( Object.assign( Object.create( { custom: true } ), BASE ) );
		for ( const req of cases ) {
			await expect( client.publish( req ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		}
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [
		[ 'pageId', 0 ], [ 'pageId', 2147483648 ], [ 'baseRevisionId', NaN ],
		[ 'baseRevisionId', 0 ], [ 'baseRevisionId', 2147483648 ], [ 'snapshotJson', {} ], [ 'summary', 2 ]
	] )( 'rejects invalid %s value %p', async ( key, value ) => {
		await expect( client.publish( { ...BASE, [ key ]: value } ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'captures all native strings before transport so later caller mutation cannot alter the request', async () => {
		let release;
		api.postWithToken.mockReturnValue( new Promise( ( resolve ) => { release = resolve; } ) );
		const req = JSON.parse( JSON.stringify( BASE ) );
		const pending = client.publish( req );
		req.snapshotJson = 'changed'; req.sources[ 0 ].targetSurfaceId = 'changed'; req.admissionRevisions[ 0 ].revisionId = 1;
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ].data ).toBe( BASE.snapshotJson );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ).toContain( 'pdf/頁/2' );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ].admissionrevisions ).toContain( '99' );
		release( { layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: 101 } } );
		await pending;
	} );

	it.each( [ [], new Array( 1 ), new Array( 33 ) ].map( sources => [ sources ] ) )( 'rejects source arrays with invalid length or holes', async ( sources ) => {
		await expect( client.publish( { ...BASE, sources } ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
	} );

	it( 'accepts the inclusive 32-source limit', async () => {
		const sources = Array.from( { length: 32 }, ( _, i ) => ( { ...BASE.sources[ 0 ], sourcePageId: i + 1 } ) );
		await client.publish( { ...BASE, sources } );
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ) ).toHaveLength( 32 );
	} );

	it( 'accepts the inclusive 100-origin limit and refuses an over-limit list', async () => {
		const admissionRevisions = Array.from( { length: 100 }, ( _, i ) => ( { surfaceId: 's' + i, revisionId: 1 } ) );
		await client.publish( { ...BASE, admissionRevisions } );
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].admissionrevisions ) ).toHaveLength( 100 );
		api.postWithToken.mockClear();
		await expect( client.publish( { ...BASE, admissionRevisions: [ ...admissionRevisions, { surfaceId: 'extra', revisionId: 1 } ] } ) )
			.rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
	} );

	it( 'rejects source and origin descriptors with getters without invoking them', async () => {
		let count = 0;
		const source = { ...BASE.sources[ 0 ] };
		Object.defineProperty( source, 'sourcePageId', { enumerable: true, get: () => { count++; return 41; } } );
		const origin = { ...BASE.admissionRevisions[ 0 ] };
		Object.defineProperty( origin, 'revisionId', { enumerable: true, get: () => { count++; return 99; } } );
		await expect( client.publish( { ...BASE, sources: [ source ] } ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		await expect( client.publish( { ...BASE, admissionRevisions: [ origin ] } ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		expect( count ).toBe( 0 );
	} );

	it( 'rejects sparse, decorated, custom-prototype source and origin arrays', async () => {
		const sparse = new Array( 1 );
		const decorated = [ BASE.sources[ 0 ] ]; decorated.extra = true;
		const custom = [ BASE.sources[ 0 ] ]; Object.setPrototypeOf( custom, { custom: true } );
		for ( const sources of [ sparse, decorated, custom ] ) {
			await expect( client.publish( { ...BASE, sources } ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		}
		const originArray = [ BASE.admissionRevisions[ 0 ] ]; originArray[ Symbol( 'x' ) ] = 1;
		await expect( client.publish( { ...BASE, admissionRevisions: originArray } ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
	} );

	it.each( [
		[ 'sourcePageId', 0 ], [ 'sourcePageId', 2147483648 ], [ 'sourceRevisionId', NaN ],
		[ 'sourceRevisionId', 2147483648 ], [ 'targetSurfaceId', '' ], [ 'sourceSurfaceId', 'x'.repeat( 129 ) ]
	] )( 'rejects source field %s=%p', async ( key, value ) => {
		await expect( client.publish( { ...BASE, sources: [ { ...BASE.sources[ 0 ], [ key ]: value } ] } ) )
			.rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
	} );

	it( 'rejects a source page equal to the target page and duplicate source tuples', async () => {
		await expect( client.publish( { ...BASE, sources: [ { ...BASE.sources[ 0 ], sourcePageId: 40 } ] } ) )
			.rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		await expect( client.publish( { ...BASE, sources: [ BASE.sources[ 0 ], { ...BASE.sources[ 0 ] } ] } ) )
			.rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
	} );

	it( 'accepts UTF-8 identifiers by byte length instead of imposing an ASCII rule', async () => {
		const unicode = '界'.repeat( 42 );
		await client.publish( { ...BASE, sources: [ { ...BASE.sources[ 0 ], targetSurfaceId: unicode } ] } );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ).toContain( unicode );
	} );

	it.each( [ [ 0, 100 ], [ 101, 100 ], [ 99, 0 ], [ 100, 2147483648 ] ] )( 'rejects admission revision %p with base %p when outside its valid range', async ( revisionId, baseRevisionId ) => {
		await expect( client.publish( { ...BASE, baseRevisionId, admissionRevisions: [ { surfaceId: 's', revisionId } ] } ) )
			.rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
	} );

	it( 'rejects duplicate admission origin identities', async () => {
		await expect( client.publish( { ...BASE, admissionRevisions: [ BASE.admissionRevisions[ 0 ], { surfaceId: 'pdf/頁/2', revisionId: 98 } ] } ) )
			.rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
	} );

	it.each( [
		[ 'badtoken', 'badtoken' ], [ 'missingparam', 'missingparam' ], [ 'layers-edit-conflict', 'layers-edit-conflict' ],
		[ 'unknown-secret', 'layers-publication-outcome-unknown' ]
	] )( 'maps native API rejection %s safely', async ( rawCode, expected ) => {
		api.postWithToken.mockReturnValue( { then: ( _resolve, reject ) => reject( rawCode, { info: 'private trace' } ) } );
		await expect( client.publish( BASE ) ).rejects.toMatchObject( { code: expected } );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'maps a rejected MediaWiki API promise with its code and result arguments', async () => {
		api.postWithToken.mockReturnValue( { then: ( _resolve, reject ) => reject( 'badtoken', { error: { code: 'badtoken', info: 'SECRET' } } ) } );
		const e = await client.publish( BASE ).catch( ( err ) => err );
		expect( e.code ).toBe( 'badtoken' );
		expect( e.message ).not.toContain( 'SECRET' );
	} );

	it( 'maps a native error response before looking for the success payload', async () => {
		api.postWithToken.mockResolvedValue( { error: { code: 'layers-edit-conflict', info: 'SECRET' }, warnings: {} } );
		const e = await client.publish( BASE ).catch( ( err ) => err );
		expect( e.code ).toBe( 'layers-edit-conflict' );
		expect( e.message ).not.toContain( 'SECRET' );
	} );

	it( 'preserves only bounded server reason text for invalid snapshots', async () => {
		api.postWithToken.mockResolvedValue( { error: { code: 'layers-invalid-snapshot', info: 'Layer 2 is invalid' } } );
		await expect( client.publish( BASE ) ).rejects.toMatchObject( {
			code: 'layers-invalid-snapshot', message: 'Layer 2 is invalid'
		} );
		api.postWithToken.mockResolvedValue( { error: { code: 'layers-invalid-snapshot', info: 'x'.repeat( 301 ) } } );
		await expect( client.publish( BASE ) ).rejects.toMatchObject( {
			code: 'layers-invalid-snapshot', message: 'Publication failed: layers-invalid-snapshot'
		} );
	} );

	it( 'maps synchronous transport throws to unknown without leaking text', async () => {
		api.postWithToken.mockImplementation( () => { throw new Error( 'SECRET transport details' ); } );
		const e = await client.publish( BASE ).catch( ( err ) => err );
		expect( e.code ).toBe( 'layers-publication-outcome-unknown' );
		expect( e.message ).not.toContain( 'SECRET' );
	} );

	it.each( [
		{}, { version: 2, result: 'Success', revid: 101 }, { version: 1, result: 'success', revid: 101 },
		{ version: 1, result: 'Success', revid: 100 }, { version: 1, result: 'Success', revid: 2147483648 },
		{ version: 1, result: 'Success', revid: 101, extra: true }
	] )( 'rejects malformed publication response %p as unknown', async ( payload ) => {
		api.postWithToken.mockResolvedValue( { layersworkingcopypdfimportpublish: payload } );
		await expect( client.publish( BASE ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
	} );

	it( 'rejects response aliases and accepts MediaWiki warning metadata', async () => {
		api.postWithToken.mockResolvedValue( { layerspublish: { result: 'Success', revid: 101 } } );
		await expect( client.publish( BASE ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		api.postWithToken.mockResolvedValue( {
			layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: 101 }, warnings: { main: { '*': 'informational' } }
		} );
		await expect( client.publish( BASE ) ).resolves.toEqual( { revisionId: 101 } );
	} );

	it( 'refuses a nonadvancing publication revision', async () => {
		api.postWithToken.mockResolvedValue( { layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: 100 } } );
		await expect( client.publish( BASE ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
	} );
} );
