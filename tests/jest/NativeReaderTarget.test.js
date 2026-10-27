const admitTarget = require( '../perf/native-reader-target.js' );

describe( 'Read-only native reader target admission', () => {
	test.each( [ '8080', '8082' ] )( 'explicit maintained lane %s is admitted', port => {
		expect( admitTarget( { base: `http://127.0.0.1:${ port }`, readOnlyMaintainedWiki: true } ).port ).toBe( port );
	} );

	test( 'an existing approved disposable target remains admitted', () => {
		expect( admitTarget( { base: 'http://localhost:8099', disposable: true } ).port ).toBe( '8099' );
	} );

	test.each( [
		{ base: 'http://127.0.0.1:8080' },
		{ base: 'http://127.0.0.1:8080', disposable: true },
		{ base: 'http://127.0.0.1:8081', readOnlyMaintainedWiki: true },
		{ base: 'http://127.0.0.1:8081', disposable: true },
		{ base: 'http://127.0.0.1:8099', readOnlyMaintainedWiki: true },
		{ base: 'http://127.0.0.1:8082', disposable: true, readOnlyMaintainedWiki: true },
		{ base: 'http://127.0.0.1:8082', readOnlyMaintainedWiki: 'true' },
		{ base: 'http://example.invalid:8082', readOnlyMaintainedWiki: true },
		{ base: 'https://127.0.0.1:8082', readOnlyMaintainedWiki: true },
		{ base: 'http://name:secret@127.0.0.1:8082', readOnlyMaintainedWiki: true },
		{ base: 'http://127.0.0.1:8082/wiki/', readOnlyMaintainedWiki: true },
		{ base: 'http://127.0.0.1:8082/?x=1', readOnlyMaintainedWiki: true },
		{ base: 'http://127.0.0.1:8082/#page', readOnlyMaintainedWiki: true },
		{ base: 'http://127.0.0.1', readOnlyMaintainedWiki: true }
	] )( 'refuses unsafe or ambiguous target %# before requests', config => {
		expect( () => admitTarget( config ) ).toThrow();
	} );
} );
