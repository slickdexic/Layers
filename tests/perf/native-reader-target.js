/* eslint-env node */
const assert = require( 'assert' );

/** Admit a deliberately selected read-only target before launching any page requests. */
module.exports = function admitNativeReaderTarget( config ) {
	const base = new URL( config.base );
	assert.strictEqual( base.protocol, 'http:' );
	assert( [ 'localhost', '127.0.0.1' ].includes( base.hostname ) );
	assert.strictEqual( base.username + base.password + base.search + base.hash, '' );
	assert.strictEqual( base.pathname, '/' );
	if ( config.readOnlyMaintainedWiki === true ) {
		assert.notStrictEqual( config.disposable, true, 'A maintained wiki is not disposable' );
		assert( [ '8080', '8082' ].includes( base.port ), 'Select a maintained supported-version lane' );
	} else {
		assert.strictEqual( config.disposable, true, 'Explicit target admission is required' );
		assert( ![ '', '80', '8080', '8081' ].includes( base.port ) );
	}
	return base;
};
