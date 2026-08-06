#!/usr/bin/env node
/**
 * i18n wiring verifier for the Layers extension.
 *
 * `grunt banana` and scripts/verify-metrics.js both validate en.json against
 * qqq.json. Neither validates the relationship that actually determines whether
 * a message reaches a user:
 *
 *     extension.json messages[]  <->  i18n/en.json  <->  mw.message() calls in JS
 *
 * A key can be translated, documented and counted as healthy while still
 * rendering as a raw key in the browser, because ResourceLoader only ships keys
 * a module explicitly declares. This script closes that gap.
 *
 * Checks performed:
 *   1. UNDEFINED   - declared in a module's messages[] but missing from en.json.
 *   2. MISSING     - referenced by JS but absent from en.json.
 *   3. UNSHIPPED   - present in en.json and referenced by JS, but not declared
 *                    in the messages[] of any module that loads that file.
 *   4. UNUSED_DECL - declared in messages[] but referenced by no JS at all.
 *   5. FOREIGN     - defined in en.json but owned by MediaWiki core or another
 *                    extension, which would override it wiki-wide.
 *
 * Usage:
 *   node scripts/verify-i18n-wiring.js
 *   node scripts/verify-i18n-wiring.js --strict   (also fail on UNUSED_DECL)
 *
 * Exit codes:
 *   0 - No blocking problems
 *   1 - UNDEFINED, MISSING, UNSHIPPED or FOREIGN keys found (or --strict + UNUSED_DECL)
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const strict = process.argv.includes( '--strict' );

const extension = JSON.parse( fs.readFileSync( path.join( ROOT, 'extension.json' ), 'utf8' ) );
const enJson = JSON.parse( fs.readFileSync( path.join( ROOT, 'i18n', 'en.json' ), 'utf8' ) );
const enKeys = new Set( Object.keys( enJson ).filter( ( k ) => k !== '@metadata' ) );

/**
 * Keys that MediaWiki resolves without an explicit reference in our source.
 * Anything matching these is exempt from the "declared but unused" check.
 */
const IMPLICIT_KEY_PATTERNS = [
	/^layers-desc$/,
	/^right-/,
	/^action-/,
	/^apihelp-/,
	/^apierror-/,
	/^apiwarn-/,
	/^group-/,
	/^grouppage-/,
	/^log-/,
	/^logentry-/,
	/^special-/,
	/^tag-/,
	/^prefs-/
];

/**
 * Message keys owned by MediaWiki core that modules may legitimately declare.
 *
 * @type {Set<string>}
 */
const CORE_MESSAGE_KEYS = new Set( [
	'cancel',
	'ok',
	'delete',
	'edit',
	'save',
	'close',
	'search',
	'undo',
	'redo'
] );

/**
 * Message keys owned by MediaWiki core or other extensions. Defining these in
 * our en.json silently overrides them for the whole wiki.
 */
const FOREIGN_KEY_PREFIXES = [
	'echo-',
	'templatedata-',
	'cargo-',
	'visualeditor-',
	'mediawiki-'
];

// ── Collect message references ───────────────────────────────────────────────

/**
 * Recursively list files with the given extension, skipping build output and
 * vendored/generator code.
 *
 * @param {string} dir
 * @param {string} ext
 * @param {string[]} out
 * @return {string[]}
 */
function collectFiles( dir, ext, out ) {
	out = out || [];
	if ( !fs.existsSync( dir ) ) {
		return out;
	}
	for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
		const full = path.join( dir, entry.name );
		if ( entry.isDirectory() ) {
			if ( [ 'dist', 'lib', 'scripts', 'node_modules', 'vendor' ].includes( entry.name ) ) {
				continue;
			}
			collectFiles( full, ext, out );
		} else if ( entry.name.endsWith( ext ) ) {
			out.push( full );
		}
	}
	return out;
}

// Strict: an actual message lookup. Used for the checks that must not produce
// false positives (a key wrongly reported as missing or unshipped).
// Covers mw.message('k'), mw.msg('k'), msg('k'), t('k', 'fallback'),
// getMessage('k') and window.layersMessages.get('k', 'fallback').
const STRICT_REFERENCE_RE =
	/\b(?:mw\.message|mw\.msg|msg|t|getMessage|message|messages\.get|Messages\.get)\s*\(\s*['"]([a-z0-9-]*layers-[a-z0-9-]+)['"]/g;

// Loose: any message-key-shaped string literal. Used only to decide whether a
// declared key is dead, where a false "used" is harmless but a false "dead"
// would delete a working message.
const LOOSE_REFERENCE_RE = /['"]([a-z0-9]*layers-[a-z0-9-]+)['"]/g;

const jsFiles = collectFiles( path.join( ROOT, 'resources' ), '.js' );

/** @type {Map<string, Set<string>>} key -> set of files referencing it */
const referencedBy = new Map();
/** @type {Set<string>} keys appearing as a string literal in JS or PHP */
const mentionedAnywhere = new Set();

// PHP renders messages server-side (API errors, hooks, special pages), so a key
// with no JS reference is not necessarily dead.
for ( const file of collectFiles( path.join( ROOT, 'src' ), '.php' ) ) {
	const src = fs.readFileSync( file, 'utf8' );
	let m;
	LOOSE_REFERENCE_RE.lastIndex = 0;
	while ( ( m = LOOSE_REFERENCE_RE.exec( src ) ) ) {
		mentionedAnywhere.add( m[ 1 ] );
	}
}

for ( const file of jsFiles ) {
	const src = fs.readFileSync( file, 'utf8' );
	const relPath = path.relative( ROOT, file ).split( path.sep ).join( '/' );
	let m;

	STRICT_REFERENCE_RE.lastIndex = 0;
	while ( ( m = STRICT_REFERENCE_RE.exec( src ) ) ) {
		const key = m[ 1 ];
		// Keys ending in '-' are dynamic prefixes completed at runtime.
		if ( key.endsWith( '-' ) ) {
			continue;
		}
		if ( !referencedBy.has( key ) ) {
			referencedBy.set( key, new Set() );
		}
		referencedBy.get( key ).add( relPath );
	}

	LOOSE_REFERENCE_RE.lastIndex = 0;
	while ( ( m = LOOSE_REFERENCE_RE.exec( src ) ) ) {
		mentionedAnywhere.add( m[ 1 ] );
	}
}

// ── Map ResourceLoader modules to their files and declared messages ──────────

/** @type {Map<string, {messages: Set<string>, files: Set<string>}>} */
const modules = new Map();
/** @type {Map<string, string[]>} file path -> module names that load it */
const fileToModules = new Map();

for ( const [ name, mod ] of Object.entries( extension.ResourceModules || {} ) ) {
	if ( !mod.localBasePath ) {
		continue;
	}
	const base = mod.localBasePath.replace( /^\.\//, '' );
	const files = new Set();
	for ( const script of [].concat( mod.scripts || [], mod.packageFiles || [] ) ) {
		if ( typeof script !== 'string' ) {
			continue;
		}
		const rel = ( base + '/' + script ).replace( /\/+/g, '/' );
		files.add( rel );
		if ( !fileToModules.has( rel ) ) {
			fileToModules.set( rel, [] );
		}
		fileToModules.get( rel ).push( name );
	}
	modules.set( name, { messages: new Set( mod.messages || [] ), files } );
}

// ── Run the checks ───────────────────────────────────────────────────────────

const undefinedKeys = [];
const unshippedKeys = [];
const unusedDecls = [];

for ( const [ name, mod ] of modules ) {
	for ( const key of mod.messages ) {
		if ( CORE_MESSAGE_KEYS.has( key ) ) {
			continue;
		}
		if ( !enKeys.has( key ) ) {
			undefinedKeys.push( { key, module: name } );
		} else if (
			!mentionedAnywhere.has( key ) &&
			!IMPLICIT_KEY_PATTERNS.some( ( re ) => re.test( key ) )
		) {
			unusedDecls.push( { key, module: name } );
		}
	}
}

const missingKeys = [];
for ( const [ key, files ] of referencedBy ) {
	if ( !enKeys.has( key ) ) {
		missingKeys.push( { key, files: [ ...files ] } );
		continue;
	}
	// Every module that loads a referencing file must declare the key.
	const offenders = new Set();
	for ( const file of files ) {
		for ( const moduleName of fileToModules.get( file ) || [] ) {
			if ( !modules.get( moduleName ).messages.has( key ) ) {
				offenders.add( moduleName );
			}
		}
	}
	if ( offenders.size ) {
		unshippedKeys.push( { key, modules: [ ...offenders ], files: [ ...files ] } );
	}
}

const foreignKeys = [ ...enKeys ].filter(
	( key ) => FOREIGN_KEY_PREFIXES.some( ( prefix ) => key.startsWith( prefix ) )
);

// ── Report ───────────────────────────────────────────────────────────────────

if ( process.argv.includes( '--json' ) ) {
	process.stdout.write( JSON.stringify( {
		undefinedKeys,
		missingKeys,
		unshippedKeys,
		foreignKeys,
		unusedDecls
	}, null, 2 ) );
	process.exit( 0 );
}

console.log( 'Layers i18n wiring verifier' );
console.log( '===========================\n' );
console.log( `en.json keys: ${ enKeys.size }` );
console.log( `JS files scanned: ${ jsFiles.length }` );
console.log( `Distinct keys referenced in JS: ${ referencedBy.size }\n` );

let failed = false;

/**
 * Print a titled block of findings.
 *
 * @param {string} title
 * @param {Array} items
 * @param {Function} format
 * @param {boolean} blocking
 */
function report( title, items, format, blocking ) {
	if ( !items.length ) {
		console.log( `  OK  ${ title }: none` );
		return;
	}
	console.log( `\n${ blocking ? 'FAIL' : 'WARN' }  ${ title }: ${ items.length }` );
	for ( const item of items ) {
		console.log( '        ' + format( item ) );
	}
	if ( blocking ) {
		failed = true;
	}
}

report(
	'Declared in messages[] but missing from en.json',
	undefinedKeys,
	( i ) => `${ i.key }  (module: ${ i.module })`,
	true
);
report(
	'Referenced in JS but missing from en.json',
	missingKeys,
	( i ) => `${ i.key }  (${ i.files.join( ', ' ) })`,
	true
);
report(
	'In en.json and used in JS but not shipped by the loading module',
	unshippedKeys,
	( i ) => `${ i.key }  (add to: ${ i.modules.join( ', ' ) })`,
	true
);
report(
	'Owned by core or another extension (would override wiki-wide)',
	foreignKeys,
	( k ) => k,
	true
);
report(
	'Declared in messages[] but referenced by no JS',
	unusedDecls,
	( i ) => `${ i.key }  (module: ${ i.module })`,
	strict
);

console.log( '' );
if ( failed ) {
	console.error( 'i18n wiring check FAILED. See details above.' );
	process.exit( 1 );
}
console.log( 'i18n wiring check passed.' );
