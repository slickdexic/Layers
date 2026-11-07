#!/usr/bin/env node
/* eslint-env node */
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const baseline = require( './code-growth-baseline.json' );

// Generated shape and emoji indexes grow with their data, not handwritten logic.
const generated = /^resources\/ext\.layers\.editor\/shapeLibrary\/(?:ShapeLibraryData(?:\.[a-z0-9-]+)?|EmojiLibraryIndex)\.js$/;

function inspect( root ) {
	const counts = {};
	function walk( relative ) {
		for ( const entry of fs.readdirSync( path.join( root, relative ), { withFileTypes: true } ) ) {
			const name = `${relative}/${entry.name}`;
			if ( entry.isDirectory() && entry.name !== 'dist' && !entry.name.includes( 'backup' ) ) {
				walk( name );
			} else if ( entry.isFile() && name.endsWith( '.js' ) && !name.includes( 'backup' ) &&
				!generated.test( name ) ) {
				const contents = fs.readFileSync( path.join( root, name ), 'utf8' );
				counts[ name ] = ( contents.match( /\n/g ) || [] ).length;
			}
		}
	}
	walk( 'resources' );
	return counts;
}

function evaluate( counts, limits ) {
	const failures = [];
	const total = Object.values( counts ).reduce( ( sum, count ) => sum + count, 0 );
	if ( total > limits.totalLimit ) {
		failures.push( `Handwritten JavaScript: ${total} lines exceeds ${limits.totalLimit}` );
	}
	for ( const [ file, count ] of Object.entries( counts ) ) {
		const maximum = Object.hasOwn( limits.largeFiles, file ) ? limits.largeFiles[ file ] : 1000;
		if ( count > maximum ) {
			failures.push( `${file}: ${count} lines exceeds ${maximum}` );
		}
	}
	return { total, failures };
}

if ( require.main === module ) {
	const result = evaluate( inspect( path.resolve( __dirname, '..' ) ), baseline );
	console.log( `Handwritten JavaScript: ${result.total}/${baseline.totalLimit} lines` );
	if ( result.failures.length ) {
		console.error( result.failures.join( '\n' ) );
		process.exitCode = 1;
	} else {
		console.log( 'Code growth check passed.' );
	}
}

module.exports = { evaluate, inspect };
