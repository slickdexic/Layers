#!/usr/bin/env node
/**
 * check-filename-extraction.js
 *
 * Deriving a file name from a link or a thumbnail URL is fiddly: MediaWiki
 * serves both `/wiki/File:X.jpg` and `/index.php?title=File:X.jpg`, the
 * namespace is localised, and thumbnails carry `220px-` plus, for paged or
 * layered source formats, `page3-` behind an optional `lossy-`/`lossless-`.
 *
 * Before v1.5.92 that knowledge existed in three places at three different
 * capability levels, and the weakest copy meant the full-screen viewer could
 * not open a layered PDF at all: the derived name was
 * "page1-500px-Doc.pdf.jpg" and the API answered filenotfound. Fixing one copy
 * left the other two wrong, which is the worst state for a triplicated
 * function and exactly the drift the other parallel-list gates exist to stop.
 *
 * `viewer/UrlParser.js` is now the single owner. This asserts nothing else
 * grows its own copy.
 *
 * Usage: node scripts/check-filename-extraction.js
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const OWNER = path.join( 'resources', 'ext.layers', 'viewer', 'UrlParser.js' );

// Patterns that indicate a module is deriving a file name itself rather than
// asking UrlParser. Each carries the message shown when it matches.
const FORBIDDEN = [
	{
		// A thumbnail width prefix, e.g. /^\d+px-/ or /^(?:page\d+-)?\d+px-/.
		re: /\\d\+px-/,
		what: 'a thumbnail width prefix',
		use: 'urlParser.stripThumbnailPrefix( name )'
	},
	{
		// A File:/Image: namespace match inside a regex literal.
		re: /\/[^\n]*\\\/(?:File|Image):/,
		what: 'a File:/Image: link pattern',
		use: 'urlParser.fileNameFromHref( href )'
	},
	{
		// A title= query parameter carrying a namespace prefix.
		re: /title=[^\n]*(?:File|Image)[^\n]*:\(/,
		what: 'a title= query pattern',
		use: 'urlParser.fileNameFromHref( href )'
	}
];

/**
 * Recursively collect JavaScript sources, skipping build output and backups.
 *
 * @param {string} dir Directory to walk
 * @param {string[]} out Accumulator
 * @return {string[]} Absolute file paths
 */
function collect( dir, out ) {
	for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
		const full = path.join( dir, entry.name );
		if ( entry.isDirectory() ) {
			// `lib` is vendored third-party code (pdf.js); it is not ours to own.
			if ( entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'lib' ) {
				continue;
			}
			collect( full, out );
		} else if ( entry.name.endsWith( '.js' ) && !/backup/i.test( entry.name ) ) {
			out.push( full );
		}
	}
	return out;
}

const violations = [];
for ( const file of collect( path.join( ROOT, 'resources' ), [] ) ) {
	const rel = path.relative( ROOT, file );
	if ( rel === OWNER ) {
		continue;
	}
	const lines = fs.readFileSync( file, 'utf8' ).split( /\r?\n/ );
	lines.forEach( ( line, i ) => {
		// Only regex-bearing code counts; prose in a comment is fine.
		if ( /^\s*(?:\/\/|\*|\/\*)/.test( line ) ) {
			return;
		}
		for ( const rule of FORBIDDEN ) {
			if ( rule.re.test( line ) ) {
				violations.push( {
					file: rel,
					line: i + 1,
					what: rule.what,
					use: rule.use,
					// Truncated: a minified source is one enormous line.
					text: line.trim().slice( 0, 120 )
				} );
			}
		}
	} );
}

console.log( '\n\uD83D\uDD0D File-name extraction ownership' );
console.log( '=================================\n' );

if ( !violations.length ) {
	console.log( `OK: ${ OWNER } is the only module deriving file names.\n` );
	process.exit( 0 );
}

console.log( `${ violations.length } module(s) derive file names independently:\n` );
for ( const v of violations ) {
	console.log( `  ${ v.file }:${ v.line } defines ${ v.what }` );
	console.log( `    ${ v.text }` );
	console.log( `    Use ${ v.use } instead.\n` );
}
console.log(
	'UrlParser owns these rules. A second copy will drift from it, and the last\n' +
	'time that happened the full-screen viewer could not open a layered PDF.\n'
);
process.exit( 1 );
