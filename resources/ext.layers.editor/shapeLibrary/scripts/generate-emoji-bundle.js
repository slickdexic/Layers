#!/usr/bin/env node
/**
 * Generate Emoji SVG Bundle for Layers Extension
 *
 * Creates a single JSON file containing all emoji SVG data for efficient loading.
 * This eliminates thousands of individual HTTP requests.
 *
 * Usage:
 *   node generate-emoji-bundle.js [--minify]
 *
 * Options:
 *   --minify   Minify SVG content to reduce file size
 *
 * Output:
 *   ../emoji-bundle.json (~8-10MB uncompressed, ~2MB gzipped)
 *
 * The bundle format:
 * {
 *   "version": "1.0.0",
 *   "generated": "2026-01-26T...",
 *   "count": 2817,
 *   "emoji": {
 *     "emoji_u1f600.svg": "<svg>...</svg>",
 *     ...
 *   }
 * }
 *
 * @file
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

// Configuration
const SCRIPT_DIR = __dirname;
const SHAPE_LIB_DIR = path.dirname( SCRIPT_DIR );
const ASSETS_DIR = path.join( SHAPE_LIB_DIR, 'assets', 'noto_emoji' );
const OUTPUT_FILE = path.join( SHAPE_LIB_DIR, 'emoji-bundle.json' );

// Parse command line arguments
const args = process.argv.slice( 2 );
const minify = args.includes( '--minify' );

/**
 * Minify SVG content
 *
 * Basic minification: remove comments, unnecessary whitespace, etc.
 *
 * @param {string} svg - SVG content
 * @return {string} Minified SVG
 */
function minifySvg( svg ) {
	return svg
		// Remove XML declaration
		.replace( /<\?xml[^?]*\?>\s*/gi, '' )
		// Remove comments
		.replace( /<!--[\s\S]*?-->/g, '' )
		// Remove newlines and tabs
		.replace( /[\r\n\t]/g, ' ' )
		// Collapse multiple spaces
		.replace( /\s{2,}/g, ' ' )
		// Remove spaces around < and >
		.replace( /\s*<\s*/g, '<' )
		.replace( /\s*>\s*/g, '>' )
		// Remove spaces before />
		.replace( /\s+\/>/g, '/>' )
		// Remove empty attributes
		.replace( /\s+([a-z-]+)=""\s*/gi, ' ' )
		// Trim
		.trim();
}

/**
 * Read all emoji SVG files
 *
 * @return {Object} Map of filename to SVG content
 */
function readAllEmoji() {
	const emoji = {};

	if ( !fs.existsSync( ASSETS_DIR ) ) {
		console.error( `Assets directory not found: ${ ASSETS_DIR }` );
		process.exit( 1 );
	}

	const files = fs.readdirSync( ASSETS_DIR )
		.filter( ( f ) => f.startsWith( 'emoji_u' ) && f.endsWith( '.svg' ) )
		.sort();

	console.log( `Found ${ files.length } emoji files` );

	let totalSize = 0;
	let minifiedSize = 0;

	for ( const file of files ) {
		const filepath = path.join( ASSETS_DIR, file );
		let content = fs.readFileSync( filepath, 'utf8' );

		totalSize += content.length;

		if ( minify ) {
			content = minifySvg( content );
		}

		minifiedSize += content.length;
		emoji[ file ] = content;
	}

	console.log( `Original size: ${ ( totalSize / 1024 / 1024 ).toFixed( 2 ) } MB` );
	if ( minify ) {
		console.log( `Minified size: ${ ( minifiedSize / 1024 / 1024 ).toFixed( 2 ) } MB` );
		console.log( `Reduction: ${ Math.round( ( 1 - minifiedSize / totalSize ) * 100 ) }%` );
	}

	return emoji;
}

/**
 * Main function
 */
function main() {
	console.log( '=== Emoji Bundle Generator ===' );
	console.log( `Minify: ${ minify }` );
	console.log( '' );

	// Read all emoji
	const emoji = readAllEmoji();

	// Create bundle
	const bundle = {
		version: '1.0.0',
		generated: new Date().toISOString(),
		count: Object.keys( emoji ).length,
		emoji: emoji
	};

	// Write bundle
	const output = JSON.stringify( bundle );
	fs.writeFileSync( OUTPUT_FILE, output, 'utf8' );

	const fileSize = fs.statSync( OUTPUT_FILE ).size;
	console.log( '' );
	console.log( `Bundle written: ${ OUTPUT_FILE }` );
	console.log( `File size: ${ ( fileSize / 1024 / 1024 ).toFixed( 2 ) } MB` );
	console.log( `Emoji count: ${ bundle.count }` );

	// Estimate gzipped size (roughly 25% of original for JSON with repeated patterns)
	console.log( `Estimated gzipped: ~${ ( fileSize * 0.25 / 1024 / 1024 ).toFixed( 2 ) } MB` );

	console.log( '' );
	console.log( '=== Done ===' );
	console.log( 'The bundle will be loaded by EmojiLibraryIndex.js when available.' );
}

main();
