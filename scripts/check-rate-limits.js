#!/usr/bin/env node
/**
 * check-rate-limits.js
 *
 * RateLimiter::checkRateLimit() resolves to User::pingLimiter(), which reports
 * "not limited" for a bucket nobody configured. A limiter enforced in code but
 * absent from extension.json's RateLimits block is therefore not a limiter — it
 * is a comment that costs a function call.
 *
 * This shipped twice. v1.5.83 fixed it for editlayers-save/render/list after all
 * three were found inert, and left editlayers-delete/rename/info enforced but
 * undeclared, which the R4 review found still inert. Nothing checked, so the
 * regression was free.
 *
 * Usage: node scripts/check-rate-limits.js
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const SRC_DIRS = [ 'src', 'maintenance' ];
const PREFIX = 'editlayers-';

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
		const childRel = path.join( rel, entry.name );
		if ( entry.isDirectory() ) {
			phpFiles( childRel, acc );
		} else if ( entry.name.endsWith( '.php' ) ) {
			acc.push( childRel );
		}
	}
	return acc;
}

// 1. Buckets enforced in code.
const enforced = new Map();
const callRe = /checkRateLimit\(\s*\$\w+\s*,\s*'([^']+)'\s*\)/g;

for ( const rel of SRC_DIRS.flatMap( ( d ) => phpFiles( d ) ) ) {
	const text = fs.readFileSync( path.join( ROOT, rel ), 'utf8' );
	let m;
	while ( ( m = callRe.exec( text ) ) !== null ) {
		const bucket = PREFIX + m[ 1 ];
		if ( !enforced.has( bucket ) ) {
			enforced.set( bucket, [] );
		}
		enforced.get( bucket ).push( rel.replace( /\\/g, '/' ) );
	}
}

// 2. Buckets shipped with a default.
const manifest = JSON.parse(
	fs.readFileSync( path.join( ROOT, 'extension.json' ), 'utf8' )
);
const declared = new Set( Object.keys( manifest.RateLimits || {} ) );

const errors = [];

for ( const [ bucket, sites ] of enforced ) {
	if ( !declared.has( bucket ) ) {
		errors.push(
			'"' + bucket + '" is enforced at ' + [ ...new Set( sites ) ].join( ', ' ) +
				' but has no default in extension.json RateLimits.\n' +
				'    pingLimiter() reports "not limited" for an unconfigured bucket, so ' +
				'this limit does nothing on a default install.'
		);
	}
}

for ( const bucket of declared ) {
	if ( bucket.startsWith( PREFIX ) && !enforced.has( bucket ) ) {
		errors.push(
			'"' + bucket + '" has a default in extension.json RateLimits but no ' +
				'checkRateLimit() call enforces it. Either wire it up or remove it.'
		);
	}
}

if ( errors.length ) {
	process.stdout.write( '\n\u274c Rate limit check failed\n\n' );
	errors.forEach( ( e ) => process.stdout.write( '  ' + e + '\n\n' ) );
	process.exit( 1 );
}

process.stdout.write(
	'Rate limit buckets agree (' + enforced.size + ' enforced and declared).\n'
);
