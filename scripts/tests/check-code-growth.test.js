/* eslint-env node */
'use strict';

const { test } = require( 'node:test' );
const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const { evaluate, inspect } = require( '../check-code-growth.js' );

test( 'blocks growth of existing and new large modules and the total', () => {
	const limits = { totalLimit: 3000, largeFiles: { 'resources/large.js': 1200 } };
	assert.deepEqual( evaluate( { 'resources/large.js': 1200, 'resources/small.js': 1000 }, limits ).failures, [] );
	assert.match( evaluate( { 'resources/large.js': 1201 }, limits ).failures[ 0 ], /1201 lines exceeds 1200/ );
	assert.match( evaluate( { 'resources/new.js': 1001 }, limits ).failures[ 0 ], /1001 lines exceeds 1000/ );
	assert.match( evaluate( { a: 1000, b: 1000, c: 1000, d: 1 }, limits ).failures[ 0 ], /3001 lines/ );
} );

test( 'excludes generated indexes and distribution files without excluding handwritten neighbors', () => {
	const root = fs.mkdtempSync( path.join( os.tmpdir(), 'layers-growth-' ) );
	try {
		const base = path.join( root, 'resources/ext.layers.editor/shapeLibrary' );
		fs.mkdirSync( path.join( base, 'dist' ), { recursive: true } );
		fs.writeFileSync( path.join( base, 'ShapeLibraryData.js' ), 'x\n'.repeat( 1001 ) );
		fs.writeFileSync( path.join( base, 'EmojiLibraryIndex.js' ), 'x\n'.repeat( 1001 ) );
		fs.writeFileSync( path.join( base, 'dist/ignored.js' ), 'x\n'.repeat( 1001 ) );
		fs.writeFileSync( path.join( base, 'Other.js' ), 'x\n'.repeat( 1001 ) );
		const counts = inspect( root );
		assert.deepEqual( counts, { 'resources/ext.layers.editor/shapeLibrary/Other.js': 1001 } );
		assert.equal( evaluate( counts, { totalLimit: 10000, largeFiles: {} } ).failures.length, 1 );
	} finally {
		fs.rmSync( root, { recursive: true, force: true } );
	}
} );
