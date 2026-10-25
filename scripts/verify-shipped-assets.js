#!/usr/bin/env node
/* eslint-env node */
'use strict';

// Development/release check only. Never loaded by the MediaWiki extension.
const fs = require( 'fs' );
const path = require( 'path' );
const crypto = require( 'crypto' );
const vm = require( 'vm' );
const assert = require( 'assert' );
const args = process.argv.slice( 2 );
assert( args.length === 0 || ( args.length === 2 && args[ 0 ] === '--root' ),
	'Usage: node scripts/verify-shipped-assets.js [--root path]' );
const root = path.resolve( args[ 1 ] || path.join( __dirname, '..' ) );
const realRoot = fs.realpathSync( root );
const shapeDir = 'resources/ext.layers.editor/shapeLibrary';
const fontDir = 'resources/ext.layers.shared/fonts';
const manifest = JSON.parse( fs.readFileSync( path.join( root, 'resources/asset-licenses.json' ) ) );
assert.strictEqual( manifest.schemaVersion, 1 );
const checked = new Set();

function file( relative ) {
	const target = path.resolve( root, relative );
	assert( target.startsWith( root + path.sep ), 'Asset escaped package: ' + relative );
	assert( fs.statSync( target ).isFile(), 'Missing asset: ' + relative );
	assert( fs.realpathSync( target ).startsWith( realRoot + path.sep ), 'Linked asset escaped package: ' + relative );
	checked.add( relative );
	return target;
}

function hash( relative, expected ) {
	const actual = crypto.createHash( 'sha256' ).update( fs.readFileSync( file( relative ) ) ).digest( 'hex' );
	assert.strictEqual( actual, expected, 'Asset hash mismatch: ' + relative );
}

function inventory( directory, extension ) {
	const files = [];
	for ( const entry of fs.readdirSync( path.join( root, directory ), { withFileTypes: true } ) ) {
		const relative = directory + '/' + entry.name;
		assert( !entry.isSymbolicLink(), 'Linked asset refused: ' + relative );
		if ( entry.isDirectory() ) {
			files.push( ...inventory( relative, extension ) );
		} else if ( relative.endsWith( extension ) ) {
			files.push( relative );
		}
	}
	return files.sort();
}

// Resolve ResourceLoader's local files, plus relative stylesheet assets.
const extension = JSON.parse( fs.readFileSync( file( 'extension.json' ) ) );
let moduleFiles = 0;
for ( const module of Object.values( extension.ResourceModules ) ) {
	for ( const key of [ 'scripts', 'styles' ] ) {
		const entries = module[ key ] || [];
		assert( Array.isArray( entries ), 'Unrecognized ResourceLoader file declaration' );
		for ( const entry of entries ) {
			assert.strictEqual( typeof entry, 'string' );
			const relative = path.join( module.localBasePath || '', entry );
			const target = file( relative );
			moduleFiles++;
			if ( key === 'styles' ) {
				const css = fs.readFileSync( target, 'utf8' );
				for ( const match of css.matchAll( /url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g ) ) {
					if ( /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test( match[ 1 ] ) ) {
						continue;
					}
					file( path.relative( root, path.resolve( path.dirname( target ),
						decodeURIComponent( match[ 1 ].split( /[?#]/ )[ 0 ] ) ) ) );
				}
			}
		}
	}
}

for ( const relative of [ ...Object.values( manifest.licenseFiles ), ...manifest.noticeFiles ] ) {
	assert( fs.statSync( file( relative ) ).size > 0, 'Empty notice: ' + relative );
	hash( relative, manifest.noticeHashes[ relative ] );
}
for ( const rows of [ manifest.fonts, manifest.symbols ] ) {
	assert.strictEqual( new Set( rows.map( ( row ) => row.file ) ).size, rows.length );
	for ( const row of rows ) {
		hash( row.file, row.sha256 );
		assert( row.license === 'LicenseRef-Public-Domain' || manifest.licenseFiles[ row.license ],
			'Unmapped license: ' + row.file );
	}
}
assert.deepStrictEqual( inventory( fontDir, '.woff2' ), manifest.fonts.map( ( row ) => row.file ).sort() );
assert.deepStrictEqual( inventory( shapeDir + '/assets', '.svg' ), manifest.symbols.map( ( row ) => row.file ).sort() );
for ( const row of manifest.symbols.filter( ( item ) => /^CC-BY-SA|^GPL/.test( item.license ) ) ) {
	assert( row.author && row.source && row.descriptionRevision && row.sourceMatch === 'sanitized-svg-exact',
		'Incomplete attribution: ' + row.file );
}

// Execute only the repository's data modules in a context without browser/network APIs.
const context = { window: {} };
vm.createContext( context );
function load( relative ) {
	vm.runInContext( fs.readFileSync( file( relative ), 'utf8' ), context, { filename: relative, timeout: 5000 } );
}
load( shapeDir + '/ShapeLibraryData.js' );
for ( const [ name, expected ] of Object.entries( manifest.shapeChunks ) ) {
	hash( shapeDir + '/' + name, expected );
	if ( name !== 'ShapeLibraryData.js' ) {
		load( shapeDir + '/' + name );
	}
}
const shapes = context.window.Layers.ShapeLibrary;
const loaded = shapes.getAllShapes();
assert.strictEqual( loaded.length, manifest.symbols.length );
assert.strictEqual( shapes.getCount(), loaded.length );
assert.strictEqual( new Set( loaded.map( ( item ) => item.id ) ).size, loaded.length );

hash( shapeDir + '/EmojiLibraryIndex.js', manifest.emoji.indexSha256 );
load( shapeDir + '/EmojiLibraryIndex.js' );
const emojiIndex = context.window.Layers.EmojiLibraryData;
let emojiCount = 0;
for ( const category of emojiIndex.categories ) {
	const name = category.id + '.json';
	hash( shapeDir + '/emoji/' + name, manifest.emoji.shards[ name ] );
	const shard = JSON.parse( fs.readFileSync( file( shapeDir + '/emoji/' + name ) ) );
	const expected = Array.from( emojiIndex.byCategory[ category.id ], ( item ) => item.f ).sort();
	assert.deepStrictEqual( Object.keys( shard.emoji ).sort(), expected );
	assert.strictEqual( shard.category, category.id );
	assert.strictEqual( shard.count, expected.length );
	emojiCount += expected.length;
}
assert.strictEqual( emojiCount, manifest.emoji.count );
assert.strictEqual( Object.keys( manifest.emoji.shards ).length, emojiIndex.categories.length );

const lock = JSON.parse( fs.readFileSync( file( 'package-lock.json' ) ) );
assert.strictEqual( lock.packages[ 'node_modules/pdfjs-dist' ].version, manifest.pdfjs.version );
const renderer = fs.readFileSync( file( 'resources/ext.layers/viewer/PdfRenderer.js' ), 'utf8' );
assert( renderer.includes( "const PDFJS_VERSION = '" + manifest.pdfjs.version + "';" ), 'pdf.js runtime version drift' );
for ( const [ name, expected ] of Object.entries( manifest.pdfjs.files ) ) {
	hash( 'resources/lib/pdfjs/' + name, expected );
}
console.log( 'Shipped assets verified: ' + moduleFiles + ' ResourceLoader file references, ' +
	manifest.fonts.length + ' fonts, ' + loaded.length + ' symbols, ' + emojiCount +
	' emoji; notices and pinned pdf.js match.' );
