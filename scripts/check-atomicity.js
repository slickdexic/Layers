#!/usr/bin/env node
/**
 * check-atomicity.js
 *
 * IDatabase::endAtomic() marks an atomic section *successfully completed* and
 * lets its writes commit. Calling it from a catch block therefore commits
 * exactly the partial write the catch exists to prevent — and then the caller
 * usually returns false, so the user is told the operation failed while some of
 * it silently succeeded.
 *
 * cancelAtomic() is the correct call, and it only works if the section was
 * opened with IDatabase::ATOMIC_CANCELABLE (which establishes the savepoint).
 * Without it, cancelAtomic() throws, and on PostgreSQL the transaction is left
 * aborted.
 *
 * This was found, documented and fixed in saveLayerSet() for v1.5.80 — and the
 * two other methods with the identical pattern were not touched, because
 * nothing checked. That is what this script is for.
 *
 * Usage: node scripts/check-atomicity.js
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const SRC_DIRS = [ 'src', 'maintenance' ];

const errors = [];

/**
 * Recursively collect .php files under a repo-relative directory.
 *
 * @param {string} rel Repo-relative directory
 * @param {string[]} [acc] Accumulator
 * @return {string[]} Repo-relative php file paths
 */
function phpFiles( rel, acc = [] ) {
	const abs = path.join( ROOT, rel );
	if ( !fs.existsSync( abs ) ) {
		return acc;
	}
	for ( const entry of fs.readdirSync( abs, { withFileTypes: true } ) ) {
		const childRel = path.posix.join( rel, entry.name );
		if ( entry.isDirectory() ) {
			phpFiles( childRel, acc );
		} else if ( entry.name.endsWith( '.php' ) ) {
			acc.push( childRel );
		}
	}
	return acc;
}

/**
 * Find the line number (1-based) of a character offset.
 *
 * @param {string} text Source text
 * @param {number} offset Character offset
 * @return {number} 1-based line number
 */
function lineAt( text, offset ) {
	return text.slice( 0, offset ).split( '\n' ).length;
}

/**
 * Return the body of every `catch ( ... ) { ... }` block, brace-matched.
 *
 * @param {string} text PHP source
 * @return {Array<{body: string, offset: number}>} Catch bodies with offsets
 */
function catchBlocks( text ) {
	const out = [];
	const re = /\bcatch\s*\([^)]*\)\s*\{/g;
	let m;
	while ( ( m = re.exec( text ) ) !== null ) {
		let depth = 1;
		let i = m.index + m[ 0 ].length;
		while ( i < text.length && depth > 0 ) {
			const ch = text[ i ];
			if ( ch === '{' ) {
				depth++;
			} else if ( ch === '}' ) {
				depth--;
			}
			i++;
		}
		out.push( { body: text.slice( m.index, i ), offset: m.index } );
	}
	return out;
}

/**
 * Blank out comments and string literals so prose mentioning endAtomic() is not
 * mistaken for a call. Offsets are preserved so line numbers stay accurate.
 *
 * @param {string} text PHP source
 * @return {string} Source with comments and strings replaced by spaces
 */
function stripNonCode( text ) {
	const out = text.split( '' );
	let i = 0;
	const blank = ( from, to ) => {
		for ( let j = from; j < to && j < out.length; j++ ) {
			if ( out[ j ] !== '\n' ) {
				out[ j ] = ' ';
			}
		}
	};
	while ( i < text.length ) {
		const two = text.substr( i, 2 );
		if ( two === '/*' ) {
			const end = text.indexOf( '*/', i + 2 );
			const stop = end === -1 ? text.length : end + 2;
			blank( i, stop );
			i = stop;
		} else if ( two === '//' || text[ i ] === '#' ) {
			const end = text.indexOf( '\n', i );
			const stop = end === -1 ? text.length : end;
			blank( i, stop );
			i = stop;
		} else if ( text[ i ] === '\'' || text[ i ] === '"' ) {
			const quote = text[ i ];
			let j = i + 1;
			while ( j < text.length && text[ j ] !== quote ) {
				j += text[ j ] === '\\' ? 2 : 1;
			}
			blank( i, j + 1 );
			i = j + 1;
		} else {
			i++;
		}
	}
	return out.join( '' );
}

for ( const dir of SRC_DIRS ) {
	for ( const rel of phpFiles( dir ) ) {
		const raw = fs.readFileSync( path.join( ROOT, rel ), 'utf8' );

		if ( !raw.includes( 'Atomic(' ) ) {
			continue;
		}
		const text = stripNonCode( raw );

		// 1. endAtomic() inside a catch block.
		for ( const block of catchBlocks( text ) ) {
			const idx = block.body.indexOf( 'endAtomic(' );
			if ( idx !== -1 ) {
				errors.push(
					rel + ':' + lineAt( text, block.offset + idx ) +
						' \u2014 endAtomic() inside a catch block commits the partial write.\n' +
						'      Use cancelAtomic(), and open the section with ' +
						'IDatabase::ATOMIC_CANCELABLE.'
				);
			}
		}

		// 2. cancelAtomic() only works on a section opened as cancelable.
		const starts = [];
		const startRe = /startAtomic\(\s*([^)]*)\)/g;
		let sm;
		while ( ( sm = startRe.exec( text ) ) !== null ) {
			starts.push( { args: sm[ 1 ], offset: sm.index } );
		}
		if ( text.includes( 'cancelAtomic(' ) &&
			!starts.some( ( s ) => s.args.includes( 'ATOMIC_CANCELABLE' ) )
		) {
			errors.push(
				rel + ' \u2014 cancelAtomic() is called but no startAtomic() passes ' +
					'IDatabase::ATOMIC_CANCELABLE. Without the savepoint, cancelAtomic() throws.'
			);
		}
	}
}

if ( errors.length ) {
	process.stdout.write( '\n\u274c Atomicity check failed\n\n' );
	errors.forEach( ( e ) => process.stdout.write( '  ' + e + '\n\n' ) );
	process.exit( 1 );
}

process.stdout.write( 'Atomic section usage OK.\n' );
