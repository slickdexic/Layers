#!/usr/bin/env node
/**
 * Shard the monolithic emoji SVG bundle into per-category files.
 *
 * Background
 * ----------
 * `emoji-bundle.json` was a single 30.3 MB file containing every Noto emoji
 * SVG. Opening the emoji picker downloaded all of it before a single glyph
 * could be drawn, and 9.3 MB of that payload was never reachable at all: the
 * bundle held 3,731 entries while `EmojiLibraryIndex.js` only references 2,817.
 *
 * This script rewrites the bundle as one file per category under
 * `shapeLibrary/emoji/`, dropping entries the index does not reference. The
 * picker then fetches only the category the user is actually looking at.
 *
 * Usage:
 *   node scripts/shard-emoji-bundle.js [--source <path>] [--check]
 *
 *   --source <path>  Monolithic bundle to shard. Defaults to
 *                    `shapeLibrary/emoji-bundle.json` when it still exists.
 *   --check          Verify the existing shards cover every indexed emoji and
 *                    contain nothing the index does not reference. Does not
 *                    write anything. This is the mode suitable for CI.
 *
 * @file
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const SHAPE_DIR = path.join(
	__dirname, '..', 'resources', 'ext.layers.editor', 'shapeLibrary'
);
const SHARD_DIR = path.join( SHAPE_DIR, 'emoji' );
const DEFAULT_SOURCE = path.join( SHAPE_DIR, 'emoji-bundle.json' );

/**
 * Load `EmojiLibraryIndex.js` outside a browser.
 *
 * The file is an IIFE that assigns to `window.Layers.EmojiLibraryData`. Give it
 * just enough of a global to run, then read the data back off it.
 *
 * @return {{categories: Object[], byCategory: Object}} Index data
 */
function loadIndex() {
	const previousWindow = global.window;
	global.window = {};
	try {
		const indexPath = path.join( SHAPE_DIR, 'EmojiLibraryIndex.js' );
		delete require.cache[ require.resolve( indexPath ) ];
		require( indexPath );
		const data = global.window.Layers && global.window.Layers.EmojiLibraryData;
		if ( !data || !data.categories || !data.byCategory ) {
			throw new Error(
				'EmojiLibraryIndex.js did not populate window.Layers.EmojiLibraryData'
			);
		}
		return data;
	} finally {
		global.window = previousWindow;
	}
}

/**
 * Build a filename -> category id map from the index.
 *
 * @param {{categories: Object[], byCategory: Object}} index Index data
 * @return {Map<string,string>} Filename to category id
 */
function buildFileToCategory( index ) {
	const map = new Map();
	for ( const category of index.categories ) {
		const entries = index.byCategory[ category.id ] || [];
		for ( const entry of entries ) {
			if ( !map.has( entry.f ) ) {
				map.set( entry.f, category.id );
			}
		}
	}
	return map;
}

/**
 * Write the per-category shards.
 *
 * @param {{categories: Object[], byCategory: Object}} index Index data
 * @param {string} sourcePath Path to the monolithic bundle
 */
function shard( index, sourcePath ) {
	if ( !fs.existsSync( sourcePath ) ) {
		throw new Error( 'Source bundle not found: ' + sourcePath );
	}
	const bundle = JSON.parse( fs.readFileSync( sourcePath, 'utf8' ) );
	const svgs = bundle.emoji || bundle;
	const fileToCategory = buildFileToCategory( index );

	const missing = [];
	const buckets = {};
	for ( const category of index.categories ) {
		buckets[ category.id ] = {};
	}
	for ( const [ filename, categoryId ] of fileToCategory ) {
		const svg = svgs[ filename ];
		if ( typeof svg !== 'string' ) {
			missing.push( filename );
			continue;
		}
		buckets[ categoryId ][ filename ] = svg;
	}
	if ( missing.length ) {
		throw new Error(
			'Indexed emoji missing from the source bundle: ' +
			missing.slice( 0, 10 ).join( ', ' ) +
			( missing.length > 10 ? ' (+' + ( missing.length - 10 ) + ' more)' : '' )
		);
	}

	fs.mkdirSync( SHARD_DIR, { recursive: true } );

	let total = 0;
	let bytes = 0;
	for ( const category of index.categories ) {
		const entries = buckets[ category.id ];
		const target = path.join( SHARD_DIR, category.id + '.json' );
		const payload = JSON.stringify( {
			category: category.id,
			count: Object.keys( entries ).length,
			emoji: entries
		} );
		fs.writeFileSync( target, payload );
		total += Object.keys( entries ).length;
		bytes += payload.length;
		process.stdout.write(
			'  ' + category.id.padEnd( 14 ) +
			String( Object.keys( entries ).length ).padStart( 5 ) + ' emoji  ' +
			( payload.length / 1048576 ).toFixed( 2 ) + ' MB\n'
		);
	}

	const dropped = Object.keys( svgs ).length - total;
	process.stdout.write(
		'\nWrote ' + index.categories.length + ' shards, ' + total + ' emoji, ' +
		( bytes / 1048576 ).toFixed( 1 ) + ' MB total.\n'
	);
	if ( dropped > 0 ) {
		process.stdout.write(
			'Dropped ' + dropped + ' bundle entries the index never references.\n'
		);
	}
}

/**
 * Verify the shards on disk match the index.
 *
 * @param {{categories: Object[], byCategory: Object}} index Index data
 * @return {string[]} Problem descriptions; empty when the shards are correct
 */
function check( index ) {
	const problems = [];
	for ( const category of index.categories ) {
		const target = path.join( SHARD_DIR, category.id + '.json' );
		if ( !fs.existsSync( target ) ) {
			problems.push( 'Missing shard: ' + category.id + '.json' );
			continue;
		}
		let payload;
		try {
			payload = JSON.parse( fs.readFileSync( target, 'utf8' ) );
		} catch ( e ) {
			problems.push( 'Unparseable shard ' + category.id + '.json: ' + e.message );
			continue;
		}
		const svgs = payload.emoji || {};
		const expected = new Set(
			( index.byCategory[ category.id ] || [] ).map( ( entry ) => entry.f )
		);
		for ( const filename of expected ) {
			if ( typeof svgs[ filename ] !== 'string' ) {
				problems.push(
					category.id + '.json is missing indexed emoji ' + filename
				);
			}
		}
		for ( const filename of Object.keys( svgs ) ) {
			if ( !expected.has( filename ) ) {
				problems.push(
					category.id + '.json contains unindexed emoji ' + filename
				);
			}
		}
	}
	return problems;
}

function main() {
	const args = process.argv.slice( 2 );
	const index = loadIndex();

	if ( args.includes( '--check' ) ) {
		const problems = check( index );
		if ( problems.length ) {
			process.stderr.write( 'Emoji shard check failed:\n' );
			for ( const problem of problems.slice( 0, 25 ) ) {
				process.stderr.write( '  - ' + problem + '\n' );
			}
			if ( problems.length > 25 ) {
				process.stderr.write( '  ... and ' + ( problems.length - 25 ) + ' more\n' );
			}
			process.exit( 1 );
		}
		process.stdout.write(
			'Emoji shards cover all ' + index.categories.length + ' categories.\n'
		);
		return;
	}

	const sourceFlag = args.indexOf( '--source' );
	const sourcePath = sourceFlag !== -1 ? args[ sourceFlag + 1 ] : DEFAULT_SOURCE;
	shard( index, sourcePath );
}

main();
