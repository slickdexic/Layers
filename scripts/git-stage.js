#!/usr/bin/env node
/**
 * git-stage.js — stage files for commit, tolerating a real-time virus scanner.
 *
 * Git writes each loose object to a temp file, marks it read-only, then renames
 * it into .git/objects. An on-access scanner that opens the new file in between
 * causes a Windows sharing violation, which git reports as:
 *
 *     error: unable to write file .git/objects/ab/cdef…: Permission denied
 *     error: <path>: failed to insert into database
 *     fatal: updating files failed
 *
 * It is intermittent, hits a different file each run, and gets more likely the
 * more files a single `git add` touches — so it shows up on exactly the large
 * commits you least want to retry by hand. On this project it also explains why
 * `git stash` had appeared "broken" for months.
 *
 * The real fix is an exclusion for the repository in the scanner's settings;
 * see docs/DEVELOPER_ONBOARDING.md. This script is the safety net for when that
 * has not been done, or an update silently resets it: it retries the failures
 * individually until the set stops shrinking.
 *
 * Usage: node scripts/git-stage.js [pathspec…]     (default: -A)
 */

'use strict';

const { execFileSync, spawnSync } = require( 'child_process' );

const MAX_PASSES = 6;

/**
 * Run git and return stdout, or null when it failed.
 *
 * @param {string[]} args Arguments to git
 * @return {string|null} Trimmed stdout, or null on failure
 */
function git( args ) {
	const r = spawnSync( 'git', args, { encoding: 'utf8' } );
	return r.status === 0 ? ( r.stdout || '' ) : null;
}

/**
 * Paths that are modified, added, deleted or untracked but not yet staged.
 *
 * @return {string[]} Repo-relative paths
 */
function unstagedPaths() {
	// -uall matters: without it git collapses an untracked directory into a
	// single "sub/" entry, and retrying that re-runs the same bulk add that just
	// failed. Individual retries only help if the paths are individual.
	const out = execFileSync(
		'git', [ 'status', '--porcelain', '-z', '-uall' ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
	);
	const paths = [];
	// -z output is NUL-separated; a rename entry carries a second NUL-separated
	// path that must not be treated as a status line.
	const parts = out.split( '\0' );
	for ( let i = 0; i < parts.length; i++ ) {
		const entry = parts[ i ];
		if ( entry.length < 4 ) {
			continue;
		}
		const worktreeStatus = entry[ 1 ];
		const path = entry.slice( 3 );
		if ( entry[ 0 ] === 'R' ) {
			// Consume the rename source that follows.
			i++;
		}
		if ( worktreeStatus !== ' ' ) {
			paths.push( path );
		}
	}
	return paths;
}

const pathspec = process.argv.slice( 2 );

// One bulk attempt first: it succeeds outright on a machine without an
// interfering scanner, and is far faster than staging file by file.
if ( git( [ 'add', ...( pathspec.length ? pathspec : [ '-A' ] ) ] ) !== null ) {
	process.stdout.write( 'Staged in one pass.\n' );
	process.exit( 0 );
}

process.stdout.write(
	'Bulk `git add` failed; retrying individually.\n' +
	'This is the on-access scanner holding new object files — see the header of\n' +
	'scripts/git-stage.js for the permanent fix.\n\n'
);

let remaining = unstagedPaths();
for ( let pass = 1; pass <= MAX_PASSES && remaining.length; pass++ ) {
	const before = remaining.length;
	for ( const p of remaining ) {
		git( [ 'add', '--', p ] );
	}
	remaining = unstagedPaths();
	process.stdout.write(
		`  pass ${ pass }: ${ before } \u2192 ${ remaining.length } remaining\n`
	);
	if ( remaining.length === before ) {
		// No progress: retrying again will not help.
		break;
	}
}

if ( remaining.length ) {
	process.stdout.write(
		'\n\u274c Could not stage ' + remaining.length + ' path(s):\n' +
		remaining.slice( 0, 20 ).map( ( p ) => '  ' + p ).join( '\n' ) + '\n\n' +
		'Add a scanner exclusion for this repository and try again.\n'
	);
	process.exit( 1 );
}

process.stdout.write( '\n\u2705 All changes staged.\n' );
