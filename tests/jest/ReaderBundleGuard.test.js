'use strict';

const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const { spawnSync } = require( 'child_process' );

describe( 'reader bundle budget guard', () => {
	let fixture, extension, budgets;
	beforeEach( () => {
		fixture = fs.mkdtempSync( path.join( os.tmpdir(), 'layers-reader-budget-' ) );
		fs.mkdirSync( path.join( fixture, 'scripts' ) );
		fs.copyFileSync( path.resolve( __dirname, '../../scripts/check-bundle-size.js' ),
			path.join( fixture, 'scripts/check-bundle-size.js' ) );
		extension = { ResourceModules: {
			'ext.layers': { scripts: [ 'viewer.js' ], dependencies: [ 'ext.layers.core', 'jquery' ] },
			'ext.layers.history': { scripts: [ 'history.js' ], dependencies: [ 'ext.layers.core' ] },
			'ext.layers.core': { scripts: [ 'core.js' ], dependencies: [ 'ext.layers.history' ] }
		} };
		budgets = Object.keys( extension.ResourceModules ).map( resourceModule => ( { resourceModule, maxSize: '8 B' } ) );
		for ( const name of [ 'viewer.js', 'history.js', 'core.js' ] ) {
			fs.writeFileSync( path.join( fixture, name ), 'small' );
		}
	} );
	afterEach( () => {
		if ( path.dirname( fixture ) !== path.resolve( os.tmpdir() ) ||
			!path.basename( fixture ).startsWith( 'layers-reader-budget-' ) ) {
			throw new Error( 'Unexpected test directory' );
		}
		fs.rmSync( fixture, { recursive: true, force: true } );
	} );
	function check( args = [] ) {
		fs.writeFileSync( path.join( fixture, 'extension.json' ), JSON.stringify( extension ) );
		fs.writeFileSync( path.join( fixture, 'bundlesize.config.json' ), JSON.stringify( budgets ) );
		return spawnSync( process.execPath, [ path.join( fixture, 'scripts/check-bundle-size.js' ), ...args ],
			{ cwd: fixture, encoding: 'utf8' } );
	}
	it( 'accepts a budgeted shared dependency, including a cycle and external modules', () => {
		expect( check().status ).toBe( 0 );
	} );
	it( 'rejects a new transitive Layers dependency without a budget', () => {
		extension.ResourceModules[ 'ext.layers.core' ].dependencies.push( 'ext.layers.new' );
		extension.ResourceModules[ 'ext.layers.new' ] = { scripts: [] };
		const result = check();
		expect( result.status ).not.toBe( 0 );
		expect( result.stdout ).toContain( 'Reader module has no size budget: ext.layers.new' );
	} );
	it( 'rejects a missing transitive Layers dependency', () => {
		extension.ResourceModules[ 'ext.layers.core' ].dependencies.push( 'ext.layers.missing' );
		const result = check();
		expect( result.status ).not.toBe( 0 );
		expect( result.stdout ).toContain( 'Reader references an unknown Layers module: ext.layers.missing' );
	} );
	it( 'rejects growth beyond an existing module budget', () => {
		fs.writeFileSync( path.join( fixture, 'core.js' ), 'too large' );
		const result = check();
		expect( result.status ).not.toBe( 0 );
		expect( result.stdout ).toContain( 'ext.layers.core is' );
	} );
} );
