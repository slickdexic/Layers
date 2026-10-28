'use strict';

const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const { spawnSync } = require( 'child_process' );

describe( 'version documentation verification', () => {
	let fixture;
	const root = path.resolve( __dirname, '../..' );
	const files = [ 'scripts/update-version.js', 'extension.json', 'CHANGELOG.md', 'README.md',
		'Mediawiki-Extension-Layers.mediawiki', 'wiki/Home.md', 'wiki/Installation.md', 'improvement_plan.md',
		'resources/ext.layers.editor/LayersNamespace.js' ];
	beforeEach( () => {
		fixture = fs.mkdtempSync( path.join( os.tmpdir(), 'layers-version-docs-' ) );
		for ( const file of files ) {
			const target = path.join( fixture, file );
			fs.mkdirSync( path.dirname( target ), { recursive: true } );
			fs.copyFileSync( path.join( root, file ), target );
		}
	} );
	afterEach( () => {
		if ( path.dirname( fixture ) !== path.resolve( os.tmpdir() ) ||
			!path.basename( fixture ).startsWith( 'layers-version-docs-' ) ) {
			throw new Error( 'Unexpected test directory' );
		}
		fs.rmSync( fixture, { recursive: true, force: true } );
	} );
	function check() {
		return spawnSync( process.execPath, [ path.join( fixture, 'scripts/update-version.js' ), '--check' ],
			{ cwd: fixture, encoding: 'utf8' } );
	}
	it( 'checks both wiki versions and the Home release date', () => {
		const version = JSON.parse( fs.readFileSync( path.join( fixture, 'extension.json' ), 'utf8' ) ).version;
		const home = fs.readFileSync( path.join( fixture, 'wiki/Home.md' ), 'utf8' );
		const date = home.match( /\| \*\*Release date for this version\*\* \| ([^|]+?) \|/ );
		expect( date ).not.toBeNull();
		const result = check();
		expect( result.status ).toBe( 0 );
		expect( result.stdout ).not.toContain( 'PATTERN NOT FOUND' );
		expect( result.stdout ).toContain( 'wiki/Home.md - ' + version );
		expect( result.stdout ).toContain( 'wiki/Installation.md - ' + version );
		expect( result.stdout ).toContain( 'wiki/Home.md - ' + date[ 1 ] );
	} );
	it.each( [ 'wiki/Home.md', 'wiki/Installation.md' ] )( 'fails if the version in %s is wrong', ( file ) => {
		const target = path.join( fixture, file );
		const text = fs.readFileSync( target, 'utf8' );
		const version = JSON.parse( fs.readFileSync( path.join( fixture, 'extension.json' ), 'utf8' ) ).version;
		const marker = file === 'wiki/Home.md' ? '**Manifest version** | ' + version : 'manifest still says **' + version + '**';
		expect( text ).toContain( marker );
		fs.writeFileSync( target, text.replace( marker, marker.replace( version, version === '0.0.0' ? '0.0.1' : '0.0.0' ) ) );
		expect( check().status ).not.toBe( 0 );
	} );
	it( 'fails if the wiki Home release date is wrong', () => {
		const target = path.join( fixture, 'wiki/Home.md' );
		const text = fs.readFileSync( target, 'utf8' );
		const marker = text.match( /\| \*\*Release date for this version\*\* \| ([^|]+?) \|/ );
		expect( marker ).not.toBeNull();
		fs.writeFileSync( target, text.replace( marker[ 0 ], marker[ 0 ].replace( marker[ 1 ], 'January 1, 1900' ) ) );
		expect( check().status ).not.toBe( 0 );
	} );
} );
