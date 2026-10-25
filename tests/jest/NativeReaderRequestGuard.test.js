const guardNativeReads = require( '../perf/native-request-guard.js' );

describe( 'Native reader benchmark request admission', () => {
	let session, page, handlers, errors;
	beforeEach( () => {
		handlers = {};
		errors = [];
		session = { on: jest.fn( ( name, handler ) => { handlers[ name ] = handler; } ),
			send: jest.fn().mockResolvedValue( {} ) };
		page = { context: () => ( { newCDPSession: jest.fn().mockResolvedValue( session ) } ) };
	} );
	const pause = ( method, url ) => ( { requestId: 'request-1', request: { method, url } } );

	it( 'enables admission before returning without disabling or clearing cache', async () => {
		expect( await guardNativeReads( page, 'http://127.0.0.1:8099', errors ) ).toBe( session );
		expect( session.send.mock.calls ).toEqual( [ [ 'Fetch.enable', {
			patterns: [ { urlPattern: '*', requestStage: 'Request' } ]
		} ] ] );
	} );
	it( 'continues an exact-origin GET including its original query', async () => {
		await guardNativeReads( page, 'http://127.0.0.1:8099', errors );
		handlers[ 'Fetch.requestPaused' ]( pause( 'GET', 'http://127.0.0.1:8099/api.php?action=layersread' ) );
		expect( session.send ).toHaveBeenLastCalledWith( 'Fetch.continueRequest', { requestId: 'request-1' } );
		expect( errors ).toEqual( [] );
	} );
	it.each( [ 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS' ] )( 'refuses %s before continuation', async method => {
		await guardNativeReads( page, 'http://127.0.0.1:8099', errors );
		handlers[ 'Fetch.requestPaused' ]( pause( method, 'http://127.0.0.1:8099/api.php?private=value' ) );
		expect( session.send ).toHaveBeenLastCalledWith( 'Fetch.failRequest', {
			requestId: 'request-1', errorReason: 'BlockedByClient'
		} );
		expect( errors ).toEqual( [ { method, url: 'http://127.0.0.1:8099/api.php' } ] );
	} );
	it.each( [ 'http://127.0.0.1:8080/api.php', 'http://localhost:8099/api.php',
		'https://127.0.0.1:8099/api.php', 'https://example.invalid/image.png', 'not a URL' ] )(
		'refuses another origin or malformed URL: %s', async url => {
			await guardNativeReads( page, 'http://127.0.0.1:8099', errors );
			handlers[ 'Fetch.requestPaused' ]( pause( 'GET', url ) );
			expect( session.send ).toHaveBeenLastCalledWith( 'Fetch.failRequest', {
				requestId: 'request-1', errorReason: 'BlockedByClient'
			} );
			expect( errors ).toHaveLength( 1 );
		} );
	it( 'fails closed when native admission cannot be enabled', async () => {
		session.send.mockRejectedValueOnce( new Error( 'unsupported' ) );
		await expect( guardNativeReads( page, 'http://127.0.0.1:8099', errors ) ).rejects.toThrow( 'unsupported' );
	} );
	it( 'records a continuation failure without exposing protocol diagnostics', async () => {
		await guardNativeReads( page, 'http://127.0.0.1:8099', errors );
		session.send.mockRejectedValueOnce( new Error( 'private protocol diagnostic' ) );
		handlers[ 'Fetch.requestPaused' ]( pause( 'GET', 'http://127.0.0.1:8099/image.png' ) );
		await Promise.resolve();
		expect( errors ).toEqual( [ { message: 'Native request guard failed' } ] );
	} );
} );
