#!/usr/bin/env node
/**
 * check-parallel-lists.js
 *
 * Several lists in this extension must agree with each other but live in
 * different files and different languages, so nothing links them. Every time
 * one has drifted it has shipped a silent, user-visible defect:
 *
 *   - The boolean-property lists drifted four times. MediaWiki's API drops
 *     boolean `false` during serialization, so ApiLayersInfo converts booleans
 *     to 0/1. A property in the validator's whitelist but missing from that
 *     conversion list is simply *dropped* when false, and the client then reads
 *     `undefined` and treats the setting as on. See
 *     docs/POSTMORTEM_BACKGROUND_VISIBILITY_BUG.md.
 *
 *   - The layer-type lists drifted silently: ThumbnailRenderer had a bare
 *     `default: return []` arm, so seven of the seventeen accepted layer types
 *     were dropped from PDF exports with no warning anywhere.
 *
 * Both classes were invisible to every other gate. This one parses the lists
 * out of source and asserts they agree.
 *
 * Usage: node scripts/check-parallel-lists.js
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );

const VALIDATOR = 'src/Validation/ServerSideLayerValidator.php';
const API_INFO = 'src/Api/ApiLayersInfo.php';
const NORMALIZER = 'resources/ext.layers.shared/LayerDataNormalizer.js';
const RENDERER = 'src/ThumbnailRenderer.php';
const RATE_LIMITER = 'src/Security/RateLimiter.php';

const errors = [];

/**
 * Read a repo-relative file.
 *
 * @param {string} rel Repo-relative path
 * @return {string} File contents
 */
function read( rel ) {
	return fs.readFileSync( path.join( ROOT, rel ), 'utf8' );
}

/**
 * Extract every capture group 1 match of a global regex.
 *
 * @param {string} text Text to scan
 * @param {RegExp} re Global regex with one capture group
 * @return {string[]} Captured values in source order
 */
function captureAll( text, re ) {
	const out = [];
	let m;
	while ( ( m = re.exec( text ) ) !== null ) {
		out.push( m[ 1 ] );
	}
	return out;
}

/**
 * Pull the body of a named PHP array assignment, e.g. `$booleanProps = [ ... ];`
 *
 * @param {string} text PHP source
 * @param {string} varName Variable name without the sigil
 * @return {string|null} Array body, or null when not found
 */
function phpArrayBody( text, varName ) {
	const re = new RegExp( '\\$' + varName + '\\s*=\\s*\\[([\\s\\S]*?)\\];' );
	const m = text.exec ? null : re.exec( text );
	return m ? m[ 1 ] : null;
}

/**
 * Pull the body of a JS const array, e.g. `const FOO = [ ... ];`
 *
 * @param {string} text JS source
 * @param {string} constName Constant name
 * @return {string|null} Array body, or null when not found
 */
function jsArrayBody( text, constName ) {
	const re = new RegExp( 'const\\s+' + constName + '\\s*=\\s*\\[([\\s\\S]*?)\\];' );
	const m = re.exec( text );
	return m ? m[ 1 ] : null;
}

/**
 * Pull the body of a PHP class constant array, e.g. `const FOO = [ ... ];`
 *
 * @param {string} text PHP source
 * @param {string} constName Constant name
 * @return {string|null} Array body, or null when not found
 */
function phpConstBody( text, constName ) {
	const re = new RegExp( 'const\\s+' + constName + '\\s*=\\s*\\[([\\s\\S]*?)\\];' );
	const m = re.exec( text );
	return m ? m[ 1 ] : null;
}

/**
 * Compare two sets and record a failure describing the difference.
 *
 * @param {string} label Human-readable description of the comparison
 * @param {string} nameA Name of the first source
 * @param {string[]} a First list
 * @param {string} nameB Name of the second source
 * @param {string[]} b Second list
 */
function assertSameSet( label, nameA, a, nameB, b ) {
	const setA = new Set( a );
	const setB = new Set( b );
	const missingFromB = [ ...setA ].filter( ( x ) => !setB.has( x ) );
	const missingFromA = [ ...setB ].filter( ( x ) => !setA.has( x ) );
	if ( missingFromB.length === 0 && missingFromA.length === 0 ) {
		return;
	}
	let msg = label + '\n';
	if ( missingFromB.length ) {
		msg += '    in ' + nameA + ' but not ' + nameB + ': ' + missingFromB.join( ', ' ) + '\n';
	}
	if ( missingFromA.length ) {
		msg += '    in ' + nameB + ' but not ' + nameA + ': ' + missingFromA.join( ', ' ) + '\n';
	}
	errors.push( msg.trimEnd() );
}

// ---------------------------------------------------------------------------
// 1. Boolean properties
// ---------------------------------------------------------------------------

const validatorSrc = read( VALIDATOR );
const validatorBooleans = captureAll(
	validatorSrc,
	/'([A-Za-z0-9_]+)'\s*=>\s*'boolean'/g
);

const apiInfoSrc = read( API_INFO );
const apiBooleansBody = ( () => {
	const m = /\$booleanProps\s*=\s*\[([\s\S]*?)\];/.exec( apiInfoSrc );
	return m ? m[ 1 ] : null;
} )();

const normalizerSrc = read( NORMALIZER );
const normalizerBooleansBody = jsArrayBody( normalizerSrc, 'BOOLEAN_PROPERTIES' );

if ( validatorBooleans.length === 0 ) {
	errors.push( 'Could not find any `=> \'boolean\'` entries in ' + VALIDATOR );
}
if ( apiBooleansBody === null ) {
	errors.push( 'Could not find `$booleanProps = [ ... ];` in ' + API_INFO );
}
if ( normalizerBooleansBody === null ) {
	errors.push( 'Could not find `const BOOLEAN_PROPERTIES = [ ... ];` in ' + NORMALIZER );
}

if ( apiBooleansBody !== null && normalizerBooleansBody !== null && validatorBooleans.length ) {
	const apiBooleans = captureAll( apiBooleansBody, /'([A-Za-z0-9_]+)'/g );
	const normalizerBooleans = captureAll( normalizerBooleansBody, /'([A-Za-z0-9_]+)'/g );

	assertSameSet(
		'Boolean properties differ between the validator whitelist and the API serializer.\n' +
			'  A property missing from ApiLayersInfo is DROPPED when false — the client\n' +
			'  then sees undefined and treats the setting as enabled.',
		VALIDATOR, validatorBooleans,
		API_INFO, apiBooleans
	);
	assertSameSet(
		'Boolean properties differ between the validator whitelist and the client normalizer.',
		VALIDATOR, validatorBooleans,
		NORMALIZER, normalizerBooleans
	);
}

// ---------------------------------------------------------------------------
// 2. Layer types
// ---------------------------------------------------------------------------

const allowedTypesBody = phpConstBody( validatorSrc, 'SUPPORTED_LAYER_TYPES' );
if ( allowedTypesBody === null ) {
	errors.push( 'Could not find `const SUPPORTED_LAYER_TYPES = [ ... ];` in ' + VALIDATOR );
}

const rendererSrc = read( RENDERER );
const unsupportedBody = phpConstBody( rendererSrc, 'UNSUPPORTED_SERVER_SIDE' );
if ( unsupportedBody === null ) {
	errors.push( 'Could not find `const UNSUPPORTED_SERVER_SIDE = [ ... ];` in ' + RENDERER );
}

// Types that draw nothing anywhere, so "not handled" is correct rather than a gap.
const nonVisualBody = phpConstBody( rendererSrc, 'NON_VISUAL_TYPES' );
if ( nonVisualBody === null ) {
	errors.push( 'Could not find `const NON_VISUAL_TYPES = [ ... ];` in ' + RENDERER );
}

if ( allowedTypesBody !== null && unsupportedBody !== null && nonVisualBody !== null ) {
	const allowedTypes = captureAll( allowedTypesBody, /'([A-Za-z0-9_]+)'/g );
	const unsupported = captureAll( unsupportedBody, /'([A-Za-z0-9_]+)'/g );
	const nonVisual = captureAll( nonVisualBody, /'([A-Za-z0-9_]+)'/g );

	// The renderer's switch cases are the types it can actually draw.
	const switchBody = ( () => {
		const m = /function buildLayerArguments\([\s\S]*?switch \( \$layer\['type'\] \) \{([\s\S]*?)\n\t\t\}/
			.exec( rendererSrc );
		return m ? m[ 1 ] : null;
	} )();

	if ( switchBody === null ) {
		errors.push( 'Could not find the buildLayerArguments() switch in ' + RENDERER );
	} else {
		const handled = captureAll( switchBody, /case '([A-Za-z0-9_]+)':/g );

		assertSameSet(
			'Every accepted layer type must either be drawn by ThumbnailRenderer or be\n' +
				'  listed in UNSUPPORTED_SERVER_SIDE. Anything else is silently dropped\n' +
				'  from PDF exports and server-composited thumbnails.',
			VALIDATOR + ' (SUPPORTED_LAYER_TYPES)', allowedTypes,
			RENDERER + ' (handled + declared-unsupported + non-visual)',
			handled.concat( unsupported, nonVisual )
		);

		const bothWays = handled.filter( ( t ) => unsupported.includes( t ) );
		if ( bothWays.length ) {
			errors.push(
				'Layer types are both handled and declared unsupported in ' + RENDERER +
					': ' + bothWays.join( ', ' )
			);
		}
	}

	// RateLimiter costs every type; an unlisted one falls to the expensive default,
	// which is safe but means the cost model was never considered for it.
	const complexityBody = ( () => {
		const m = /function isComplexityAllowed\([\s\S]*?switch \( \$type \) \{([\s\S]*?)\n\t\t\t\}/
			.exec( read( RATE_LIMITER ) );
		return m ? m[ 1 ] : null;
	} )();

	if ( complexityBody === null ) {
		errors.push( 'Could not find the isComplexityAllowed() switch in ' + RATE_LIMITER );
	} else {
		const costed = captureAll( complexityBody, /case '([A-Za-z0-9_]+)':/g );
		assertSameSet(
			'Layer types costed by RateLimiter::isComplexityAllowed() must match the\n' +
				'  validator whitelist, or the complexity guard is being applied to a\n' +
				'  different set of types than the one that can actually be saved.',
			VALIDATOR + ' (SUPPORTED_LAYER_TYPES)', allowedTypes,
			RATE_LIMITER + ' (isComplexityAllowed cases)', costed
		);
	}
}

// ---------------------------------------------------------------------------

if ( errors.length ) {
	process.stdout.write( '\n\u274c Parallel list check failed\n\n' );
	errors.forEach( ( e ) => process.stdout.write( '  ' + e + '\n\n' ) );
	process.exit( 1 );
}

process.stdout.write( 'Parallel lists agree (boolean properties, layer types).\n' );
