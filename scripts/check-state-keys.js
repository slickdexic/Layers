#!/usr/bin/env node
/**
 * check-state-keys.js
 *
 * StateManager.get() is a bare property read, so a misspelled or never-declared
 * key returns undefined forever. Callers almost always write
 * `get( 'x' ) || false`, which turns that undefined into a plausible-looking
 * `false` and hides the mistake completely.
 *
 * That is exactly how `hasUnsavedChanges` shipped: it was read by four
 * navigation guards and written by nothing that runs during ordinary editing,
 * so every guard was inert while 14,199 tests passed — the tests stubbed
 * stateManager.get() and therefore asserted the getter, never the writer.
 *
 * This script fails on any stateManager.get()/set() key that is not declared in
 * StateManager's initial state.
 *
 * Usage: node scripts/check-state-keys.js
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const STATE_MANAGER = 'resources/ext.layers.editor/StateManager.js';
const SCAN_DIRS = [ 'resources/ext.layers.editor', 'resources/ext.layers.slides' ];

// Keys that are legitimately created outside the declared initial state.
// Keep this list short and justified; it is the escape hatch the whole check
// exists to constrain.
const ALLOWED_EXTRA = new Set( [
	// Set by the editor bootstrap from server config before the first render.
	'currentSetName', 'namedSets', 'baseWidth', 'baseHeight',
	'pagesWithLayers', 'setRevisions', 'imageUrl',
	// Slide mode extends the same store.
	'isSlide'
] );

/**
 * Recursively collect .js files under a repo-relative directory.
 *
 * @param {string} rel Repo-relative directory
 * @param {string[]} [acc] Accumulator
 * @return {string[]} Repo-relative js file paths
 */
function jsFiles( rel, acc = [] ) {
	const abs = path.join( ROOT, rel );
	if ( !fs.existsSync( abs ) ) {
		return acc;
	}
	for ( const entry of fs.readdirSync( abs, { withFileTypes: true } ) ) {
		const childRel = path.join( rel, entry.name );
		if ( entry.isDirectory() ) {
			jsFiles( childRel, acc );
		} else if ( entry.name.endsWith( '.js' ) ) {
			acc.push( childRel );
		}
	}
	return acc;
}

// 1. Keys declared in StateManager's initial state object.
const smText = fs.readFileSync( path.join( ROOT, STATE_MANAGER ), 'utf8' );
const stateStart = smText.indexOf( 'this.state = {' );
if ( stateStart === -1 ) {
	process.stdout.write(
		'\u274c Could not find "this.state = {" in ' + STATE_MANAGER + '\n'
	);
	process.exit( 1 );
}
// Walk braces to find the end of the object literal.
let depth = 0;
let stateEnd = stateStart;
for ( let i = smText.indexOf( '{', stateStart ); i < smText.length; i++ ) {
	if ( smText[ i ] === '{' ) {
		depth++;
	} else if ( smText[ i ] === '}' ) {
		depth--;
		if ( depth === 0 ) {
			stateEnd = i;
			break;
		}
	}
}
const declared = new Set( ALLOWED_EXTRA );
const declRe = /^\s*([A-Za-z_$][\w$]*)\s*:/gm;
let dm;
const stateBody = smText.slice( stateStart, stateEnd );
while ( ( dm = declRe.exec( stateBody ) ) !== null ) {
	declared.add( dm[ 1 ] );
}

// 2. Keys used by callers.
const useRe = /stateManager\s*\.\s*(?:get|set)\(\s*'([^']+)'/g;
const offenders = new Map();

for ( const rel of SCAN_DIRS.flatMap( ( d ) => jsFiles( d ) ) ) {
	const text = fs.readFileSync( path.join( ROOT, rel ), 'utf8' );
	let m;
	while ( ( m = useRe.exec( text ) ) !== null ) {
		const key = m[ 1 ];
		if ( declared.has( key ) ) {
			continue;
		}
		if ( !offenders.has( key ) ) {
			offenders.set( key, new Set() );
		}
		offenders.get( key ).add( rel.replace( /\\/g, '/' ) );
	}
}

if ( offenders.size ) {
	process.stdout.write( '\n\u274c State key check failed\n\n' );
	for ( const [ key, files ] of offenders ) {
		process.stdout.write(
			'  "' + key + '" is read or written via stateManager but is not declared\n' +
				'    in StateManager\'s initial state. get() returns undefined for it, and\n' +
				'    the usual `|| false` turns that into a silent, permanent false.\n' +
				'    Used in: ' + [ ...files ].join( ', ' ) + '\n\n'
		);
	}
	process.stdout.write(
		'  Fix by declaring the key in StateManager, correcting the spelling, or\n' +
			'  adding it to ALLOWED_EXTRA in scripts/check-state-keys.js with a reason.\n\n'
	);
	process.exit( 1 );
}

process.stdout.write(
	'State keys OK (' + declared.size + ' declared, no undeclared usage).\n'
);
