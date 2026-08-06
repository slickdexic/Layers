#!/usr/bin/env node
/**
 * PHP class-reference checker for the Layers extension.
 *
 * Catches the one defect class that every other gate is blind to: an
 * unqualified reference to a Layers class that PHP will resolve into the
 * *current* namespace instead of the class's own. `parallel-lint` only parses
 * syntax, `phpcs` only checks style, and PHPUnit only sees the lines it covers
 * — so a missing `use` statement inside a rarely-covered method ships happily
 * and then fatals at runtime with "Class ... not found", taking out every page
 * that reaches it.
 *
 * Two checks, both scoped to this extension's own namespace so there are no
 * false positives from MediaWiki core or PHP built-ins:
 *
 *   UNIMPORTED  A short name is used as a class, is not imported, is not
 *               declared in the file, does not exist in the file's own
 *               namespace, but *does* exist elsewhere in the extension.
 *   DEAD_IMPORT A `use MediaWiki\Extension\Layers\...` statement points at a
 *               class this extension does not define.
 *
 * Usage:
 *   node scripts/check-php-class-refs.js
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const NS_PREFIX = 'MediaWiki\\Extension\\Layers\\';
const SCAN_DIRS = [ 'src', 'maintenance' ];

/**
 * Recursively collect .php files under a directory.
 *
 * @param {string} dir Absolute directory path
 * @param {string[]} [acc] Accumulator
 * @return {string[]} Absolute file paths
 */
function collectPhpFiles( dir, acc = [] ) {
	if ( !fs.existsSync( dir ) ) {
		return acc;
	}
	for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
		const full = path.join( dir, entry.name );
		if ( entry.isDirectory() ) {
			collectPhpFiles( full, acc );
		} else if ( entry.isFile() && entry.name.endsWith( '.php' ) ) {
			acc.push( full );
		}
	}
	return acc;
}

/**
 * Strip comments and string literals so their contents are never mistaken for
 * code. Newlines are preserved so line numbers stay accurate.
 *
 * @param {string} src PHP source
 * @return {string} Source with comments and string bodies blanked out
 */
function stripNoise( src ) {
	let out = '';
	let i = 0;
	const keepNewlines = ( chunk ) => chunk.replace( /[^\n]/g, ' ' );
	while ( i < src.length ) {
		const two = src.slice( i, i + 2 );
		if ( two === '/*' ) {
			const end = src.indexOf( '*/', i + 2 );
			const stop = end === -1 ? src.length : end + 2;
			out += keepNewlines( src.slice( i, stop ) );
			i = stop;
		} else if ( two === '//' || src[ i ] === '#' ) {
			const end = src.indexOf( '\n', i );
			const stop = end === -1 ? src.length : end;
			out += keepNewlines( src.slice( i, stop ) );
			i = stop;
		} else if ( src[ i ] === "'" || src[ i ] === '"' ) {
			const quote = src[ i ];
			let j = i + 1;
			while ( j < src.length && src[ j ] !== quote ) {
				j += src[ j ] === '\\' ? 2 : 1;
			}
			out += quote + keepNewlines( src.slice( i + 1, j ) ) + quote;
			i = j + 1;
		} else {
			out += src[ i ];
			i += 1;
		}
	}
	return out;
}

/**
 * Convert a character offset into a 1-based line number.
 *
 * @param {string} src Source text
 * @param {number} offset Character offset
 * @return {number} Line number
 */
function lineAt( src, offset ) {
	let line = 1;
	for ( let i = 0; i < offset && i < src.length; i++ ) {
		if ( src[ i ] === '\n' ) {
			line++;
		}
	}
	return line;
}

const files = SCAN_DIRS.reduce(
	( acc, dir ) => collectPhpFiles( path.join( ROOT, dir ), acc ), []
);

// Pass 1: every fully-qualified class name this extension declares.
const declared = new Map(); // FQN -> relative file path
const parsed = [];

for ( const file of files ) {
	const raw = fs.readFileSync( file, 'utf8' );
	const code = stripNoise( raw );
	const nsMatch = code.match( /\bnamespace\s+([A-Za-z0-9_\\]+)\s*;/ );
	const ns = nsMatch ? nsMatch[ 1 ] : '';
	const names = [];
	const declRe = /\b(?:class|interface|trait|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
	let m;
	while ( ( m = declRe.exec( code ) ) !== null ) {
		names.push( m[ 1 ] );
		declared.set( ns ? ns + '\\' + m[ 1 ] : m[ 1 ], path.relative( ROOT, file ) );
	}
	parsed.push( { file, code, ns, names } );
}

// Short name -> list of FQNs that define it.
const byShortName = new Map();
for ( const fqn of declared.keys() ) {
	const short = fqn.slice( fqn.lastIndexOf( '\\' ) + 1 );
	if ( !byShortName.has( short ) ) {
		byShortName.set( short, [] );
	}
	byShortName.get( short ).push( fqn );
}

const problems = [];

for ( const { file, code, ns, names } of parsed ) {
	const rel = path.relative( ROOT, file ).replace( /\\/g, '/' );

	// Imports: `use A\B\C;`, `use A\B\C as D;`, and grouped `use A\B\{C, D};`.
	const imported = new Set();
	const useRe = /\buse\s+((?:function\s+|const\s+)?)([A-Za-z0-9_\\]+)(?:\s*\{([^}]*)\}|\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?\s*;/g;
	let u;
	while ( ( u = useRe.exec( code ) ) !== null ) {
		if ( u[ 1 ] ) {
			// `use function`/`use const` do not import class names.
			continue;
		}
		const target = u[ 2 ];
		if ( u[ 3 ] !== undefined ) {
			for ( const part of u[ 3 ].split( ',' ) ) {
				const piece = part.trim();
				if ( !piece ) {
					continue;
				}
				const aliasMatch = piece.match( /^([A-Za-z0-9_\\]+)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/ );
				if ( !aliasMatch ) {
					continue;
				}
				const full = target.replace( /\\$/, '' ) + '\\' + aliasMatch[ 1 ];
				const alias = aliasMatch[ 2 ] || aliasMatch[ 1 ].split( '\\' ).pop();
				imported.add( alias );
				if ( full.startsWith( NS_PREFIX ) && !declared.has( full ) ) {
					problems.push( {
						type: 'DEAD_IMPORT',
						file: rel,
						line: lineAt( code, u.index ),
						detail: full
					} );
				}
			}
			continue;
		}
		const alias = u[ 4 ] || target.split( '\\' ).pop();
		imported.add( alias );
		if ( target.startsWith( NS_PREFIX ) && !declared.has( target ) ) {
			problems.push( {
				type: 'DEAD_IMPORT',
				file: rel,
				line: lineAt( code, u.index ),
				detail: target
			} );
		}
	}

	// References: `Foo::bar()`, `new Foo(`, `instanceof Foo`, `catch ( Foo $e )`.
	const refs = new Map(); // short name -> first offset
	const record = ( name, offset ) => {
		if ( !refs.has( name ) ) {
			refs.set( name, offset );
		}
	};
	let r;
	const staticRe = /(\\?)\b([A-Za-z_][A-Za-z0-9_\\]*)\s*::/g;
	while ( ( r = staticRe.exec( code ) ) !== null ) {
		if ( !r[ 1 ] && !r[ 2 ].includes( '\\' ) ) {
			record( r[ 2 ], r.index );
		}
	}
	const newRe = /\bnew\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
	while ( ( r = newRe.exec( code ) ) !== null ) {
		record( r[ 1 ], r.index );
	}
	const instanceRe = /\binstanceof\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
	while ( ( r = instanceRe.exec( code ) ) !== null ) {
		record( r[ 1 ], r.index );
	}
	const catchRe = /\bcatch\s*\(\s*([A-Za-z_][A-Za-z0-9_|\s]*)\)/g;
	while ( ( r = catchRe.exec( code ) ) !== null ) {
		for ( const piece of r[ 1 ].split( '|' ) ) {
			const name = piece.trim().split( /\s/ )[ 0 ];
			if ( /^[A-Za-z_][A-Za-z0-9_]*$/.test( name ) ) {
				record( name, r.index );
			}
		}
	}

	const RESERVED = new Set( [
		'self', 'static', 'parent', 'class', 'this', 'true', 'false', 'null'
	] );

	for ( const [ name, offset ] of refs ) {
		if ( RESERVED.has( name ) || imported.has( name ) || names.includes( name ) ) {
			continue;
		}
		// A name resolves to the current namespace first; that is legitimate.
		if ( ns && declared.has( ns + '\\' + name ) ) {
			continue;
		}
		const owners = byShortName.get( name );
		if ( !owners ) {
			// Not an extension class: core or PHP built-in, out of scope here.
			continue;
		}
		problems.push( {
			type: 'UNIMPORTED',
			file: rel,
			line: lineAt( code, offset ),
			detail: name,
			owners: owners
		} );
	}
}

if ( problems.length === 0 ) {
	console.log(
		'PHP class references OK (' + files.length + ' files, ' +
		declared.size + ' extension classes).'
	);
	process.exit( 0 );
}

console.error( '\nPHP class reference errors:\n' );
for ( const p of problems ) {
	if ( p.type === 'UNIMPORTED' ) {
		console.error(
			'  ' + p.file + ':' + p.line + '  ' + p.detail +
			' is used but not imported; PHP will look for it in this file\'s ' +
			'own namespace. Add: use ' + p.owners[ 0 ] + ';'
		);
	} else {
		console.error(
			'  ' + p.file + ':' + p.line + '  imports ' + p.detail +
			', which this extension does not define.'
		);
	}
}
console.error( '\n' + problems.length + ' problem(s) found.\n' );
process.exit( 1 );
