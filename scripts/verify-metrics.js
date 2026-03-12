#!/usr/bin/env node
/**
 * Metrics Verifier for Layers Extension
 *
 * Checks performed:
 *  1. i18n sync: counts "layers-" keys in i18n/en.json and i18n/qqq.json,
 *     reports orphaned/undocumented keys.
 *  2. Coverage drift (optional): if coverage/coverage-summary.json exists,
 *     compares the documented coverage percentages in README.md against the
 *     actual values and warns when they diverge by more than 1%.
 *     Use --require-coverage to fail when coverage-summary.json is absent.
 *
 * Usage:
 *   node scripts/verify-metrics.js
 *   node scripts/verify-metrics.js --strict           (fail on undocumented i18n keys)
 *   node scripts/verify-metrics.js --require-coverage (fail if coverage file missing)
 *
 * Exit codes:
 *   0 - All checks passed (warnings do not affect exit code)
 *   1 - Hard error: orphaned qqq.json keys, --strict undocumented keys,
 *       README coverage divergence > 1%, or --require-coverage + no file
 *
 * @since 1.5.63
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const EN_JSON = path.join( ROOT, 'i18n', 'en.json' );
const QQQ_JSON = path.join( ROOT, 'i18n', 'qqq.json' );
const COVERAGE_JSON = path.join( ROOT, 'coverage', 'coverage-summary.json' );
const README_FILE = path.join( ROOT, 'README.md' );

const strictMode = process.argv.includes( '--strict' );
const requireCoverage = process.argv.includes( '--require-coverage' );

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJsonKeys( filePath ) {
	const raw = fs.readFileSync( filePath, 'utf8' );
	const obj = JSON.parse( raw );
	// Exclude the @metadata key; return only "layers-" prefixed keys
	return Object.keys( obj ).filter( ( k ) => k.startsWith( 'layers-' ) );
}

function setDifference( setA, setB ) {
	return setA.filter( ( k ) => !setB.includes( k ) );
}

// ── Main ─────────────────────────────────────────────────────────────────────

let exitCode = 0;

console.log( 'Layers i18n metrics verifier' );
console.log( '============================\n' );

const enKeys = readJsonKeys( EN_JSON );
const qqqKeys = readJsonKeys( QQQ_JSON );

const orphaned = setDifference( qqqKeys, enKeys );    // in qqq but not en
const undocumented = setDifference( enKeys, qqqKeys ); // in en but not qqq

console.log( `en.json  messages : ${ enKeys.length }` );
console.log( `qqq.json entries  : ${ qqqKeys.length }` );
console.log();

if ( orphaned.length ) {
	console.error( `ERROR: ${ orphaned.length } orphaned entry/entries in qqq.json (no matching en.json key):` );
	orphaned.forEach( ( k ) => console.error( `  - ${ k }` ) );
	console.error();
	exitCode = 1;
} else {
	console.log( 'OK: No orphaned qqq.json entries.' );
}

if ( undocumented.length ) {
	const level = strictMode ? 'ERROR' : 'WARN';
	console.log( `${ level }: ${ undocumented.length } en.json key(s) missing from qqq.json:` );
	undocumented.forEach( ( k ) => console.log( `  - ${ k }` ) );
	console.log();
	if ( strictMode ) {
		exitCode = 1;
	}
} else {
	console.log( 'OK: All en.json keys are documented in qqq.json.' );
}

console.log();
console.log( `Summary: ${ enKeys.length } i18n messages, ${ orphaned.length } orphaned, ${ undocumented.length } undocumented.` );
console.log( 'Use this count to keep README.md / codebase_review.md in sync.' );

// ── Coverage drift check ──────────────────────────────────────────────────────
// Compares documented coverage in README.md against coverage/coverage-summary.json.
// This check is optional: if the file doesn't exist, we skip (or fail with
// --require-coverage). Skipped in CI because coverage is not run there by default.

console.log( '\nCoverage drift check' );
console.log( '====================\n' );

if ( !fs.existsSync( COVERAGE_JSON ) ) {
	if ( requireCoverage ) {
		console.error( 'ERROR: coverage/coverage-summary.json not found.' );
		console.error( '  Run `npm run test:coverage` first, then re-run this script.' );
		exitCode = 1;
	} else {
		console.log( 'SKIP: coverage/coverage-summary.json not found.' );
		console.log( '  Run `npm run test:coverage` to generate it, then re-run to check docs.' );
	}
} else {
	try {
		const coverageData = JSON.parse( fs.readFileSync( COVERAGE_JSON, 'utf8' ) );
		const total = coverageData.total;
		if ( !total ) {
			throw new Error( '"total" key missing from coverage-summary.json' );
		}

		const actual = {
			statements: total.statements.pct,
			branches: total.branches.pct,
			functions: total.functions.pct,
			lines: total.lines.pct
		};

		console.log( `Actual coverage: stmt=${ actual.statements }%  branch=${ actual.branches }%  fn=${ actual.functions }%  lines=${ actual.lines }%` );
		console.log();

		const readme = fs.readFileSync( README_FILE, 'utf8' );

		// Tolerance: docs are considered stale when > 1% off from actual
		const TOLERANCE = 1.0;
		let driftFound = false;

		/**
		 * Check a single documented value against the actual coverage.
		 *
		 * @param {string} label Human-readable metric name
		 * @param {RegExp} pattern Regex with one capture group for the percentage
		 * @param {number} actualPct Actual coverage percentage
		 */
		function checkDoc( label, pattern, actualPct ) {
			const match = readme.match( pattern );
			if ( !match ) {
				console.log( `SKIP: ${ label } — pattern not found in README.md` );
				return;
			}
			const docVal = parseFloat( match[ 1 ] );
			const diff = Math.abs( docVal - actualPct );
			if ( diff > TOLERANCE ) {
				console.error( `ERROR: ${ label } — README says ${ docVal }% but actual is ${ actualPct }% (drift: ${ diff.toFixed( 2 ) }%)` );
				driftFound = true;
				exitCode = 1;
			} else {
				console.log( `OK: ${ label } — README (${ docVal }%) matches actual (${ actualPct }%)` );
			}
		}

		// Badge URL: coverage-91.32%25
		checkDoc( 'Badge (statement)', /coverage-([\d.]+)%25/, actual.statements );
		// Coverage table rows in README.md
		checkDoc( 'Statement coverage (table)', /Statement coverage\s*\|\s*([\d.]+)%/, actual.statements );
		checkDoc( 'Branch coverage (table)', /Branch coverage\s*\|\s*([\d.]+)%/, actual.branches );
		checkDoc( 'Function coverage (table)', /Function coverage\s*\|\s*([\d.]+)%/, actual.functions );
		checkDoc( 'Line coverage (table)', /Line coverage\s*\|\s*([\d.]+)%/, actual.lines );

		if ( !driftFound ) {
			console.log( '\nOK: README coverage metrics are within tolerance of actual values.' );
		} else {
			console.error( '\nFix: update README.md coverage values, then commit.' );
		}
	} catch ( e ) {
		console.warn( `WARN: Could not parse ${ COVERAGE_JSON }: ${ e.message }` );
	}
}

process.exit( exitCode );
