'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const root = path.resolve( __dirname, '../..' );

test( 'the shipped PDF runtime is included in the blocking production audit', () => {
	const manifest = JSON.parse( fs.readFileSync( path.join( root, 'package.json' ), 'utf8' ) );
	const lock = JSON.parse( fs.readFileSync( path.join( root, 'package-lock.json' ), 'utf8' ) );
	const workflow = fs.readFileSync( path.join( root, '.github/workflows/ci.yml' ), 'utf8' );
	expect( manifest.dependencies[ 'pdfjs-dist' ] ).toBeDefined();
	expect( manifest.devDependencies[ 'pdfjs-dist' ] ).toBeUndefined();
	expect( lock.packages[ '' ].dependencies[ 'pdfjs-dist' ] ).toBe( manifest.dependencies[ 'pdfjs-dist' ] );
	expect( lock.packages[ 'node_modules/pdfjs-dist' ].dev ).not.toBe( true );
	expect( workflow ).toMatch( /npm audit --omit=dev --audit-level=high/ );
} );
