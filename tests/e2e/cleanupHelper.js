/* eslint-env node */
/**
 * Layers Extension - Test Cleanup Isolation Helper (J24)
 *
 * Implements strict ownership-isolated set selection and teardown for test runs:
 * - Only exact tracked identities registered during the current run may be deleted
 * - Never assumes unknown provenance or missing author metadata is ownership
 * - Strictly protects base/system sets (default, 001, 002) and prior/other runs
 * - Records interrupted runs for explicit manual reconciliation with zero secrets
 *
 * @module cleanupHelper
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

/**
 * Check whether a named set entry is eligible for cleanup in this run.
 *
 * Requirements:
 * 1. Must NOT be a system set ('default', '001', '002').
 * 2. Must strictly match the current run prefix (`${runPrefix}_`).
 * 3. Must be an exact registered target identity in `targetSets`.
 * 4. Untracked sets (even with the same prefix or missing author metadata) are NOT eligible.
 *
 * @param {Object} setEntry - Named set entry from layersinfo API (e.g. { name, author, revision_count })
 * @param {string[]|Set<string>} targetSets - Exact tracked set names created in this run
 * @param {string} runPrefix - Current run's unique prefix (e.g. 'j21_abc123')
 * @return {boolean} True if eligible for deletion
 */
function isEligibleForCleanup( setEntry, targetSets, runPrefix ) {
	if ( !setEntry || typeof setEntry !== 'object' ) {
		return false;
	}

	const name = setEntry.name;
	if ( !name || typeof name !== 'string' ) {
		return false;
	}

	// Strictly preserve base/system sets regardless of tracking
	if ( name === 'default' || name === '001' || name === '002' ) {
		return false;
	}

	// Must have a valid run prefix
	if ( !runPrefix || typeof runPrefix !== 'string' ) {
		return false;
	}

	// Must match current run prefix pattern
	if ( !name.startsWith( runPrefix + '_' ) ) {
		return false;
	}

	// Must be an exact tracked current-run identity
	const targetList = Array.isArray( targetSets ) ? targetSets : ( targetSets && Array.from( targetSets ) ) || [];
	if ( !targetList.includes( name ) ) {
		// Untracked same-prefix names, orphaned sets, or unknown provenance must NEVER be deleted
		return false;
	}

	return true;
}

/**
 * Filter a list of named sets into eligible for deletion and preserved sets.
 *
 * @param {Array<Object>} namedSets - Array of set entries from API
 * @param {string[]|Set<string>} targetSets - Tracked set names for current run
 * @param {string} runPrefix - Current run prefix
 * @return {{eligible: string[], preserved: string[]}}
 */
function buildCleanupPlan( namedSets, targetSets, runPrefix ) {
	const eligible = [];
	const preserved = [];

	for ( const s of ( namedSets || [] ) ) {
		if ( isEligibleForCleanup( s, targetSets, runPrefix ) ) {
			eligible.push( s.name );
		} else if ( s && s.name ) {
			preserved.push( s.name );
		}
	}

	return { eligible, preserved };
}

/**
 * Execute cleanup of test-owned sets against a MediaWiki API instance.
 *
 * @param {Object} api - mw.Api or compatible mock with get() and postWithToken()
 * @param {string} filename - Target image filename
 * @param {string[]|Set<string>} targetSets - Tracked sets created in current run
 * @param {string} runPrefix - Current run prefix
 * @return {Promise<{success: boolean, deleted: string[], failed: Array<{setname: string, error: string}>, error?: string, phase: string}>}
 */
async function executeCleanupWithApi( api, filename, targetSets, runPrefix ) {
	const deleted = [];
	const failed = [];

	if ( !api || typeof api.get !== 'function' || typeof api.postWithToken !== 'function' ) {
		return {
			success: false,
			deleted,
			failed,
			error: 'Invalid API client provided for cleanup',
			phase: 'initialization'
		};
	}

	let infoRes;
	try {
		infoRes = await api.get( {
			action: 'layersinfo',
			filename: filename,
			format: 'json'
		} );
	} catch ( netErr ) {
		return {
			success: false,
			deleted,
			failed,
			error: String( ( netErr && netErr.message ) || netErr ),
			phase: 'query'
		};
	}

	const namedSets = infoRes && infoRes.layersinfo && infoRes.layersinfo.named_sets;
	if ( !Array.isArray( namedSets ) ) {
		return { success: false, deleted, failed, error: 'Invalid inventory response', phase: 'query' };
	}
	const { eligible } = buildCleanupPlan( namedSets, targetSets, runPrefix );

	for ( const setName of eligible ) {
		try {
			await api.postWithToken( 'csrf', {
				action: 'layersdelete',
				filename: filename,
				setname: setName
			} );
			deleted.push( setName );
		} catch ( delErr ) {
			failed.push( {
				setname: setName,
				error: String( ( delErr && delErr.message ) || delErr )
			} );
		}
	}

	return {
		success: failed.length === 0,
		deleted,
		failed,
		phase: 'deletion'
	};
}

/**
 * Record interrupted run details to a structured JSON file for explicit manual reconciliation.
 * Strictly guarantees that NO secrets, passwords, tokens, or credentials are recorded.
 *
 * @param {Object} runDetails
 * @param {string} runDetails.filename
 * @param {string} runDetails.runPrefix
 * @param {string[]|Set<string>} [runDetails.targetSets]
 * @param {Array<{setname: string, error: string}>} [runDetails.failedSets]
 * @param {Error|string} [runDetails.error]
 * @param {Object} [options]
 * @param {string} [options.logDir]
 * @return {{logPath: string, safeRecord: Object}}
 */
function recordInterruptedRun( runDetails, options = {} ) {
	const {
		filename,
		runPrefix,
		targetSets = [],
		failedSets = [],
		error = null
	} = runDetails || {};

	const targetList = Array.isArray( targetSets ) ? targetSets : ( targetSets && Array.from( targetSets ) ) || [];

	const safeRecord = {
		timestamp: new Date().toISOString(),
		filename: filename || 'unknown',
		runPrefix: runPrefix || 'unknown',
		trackedCount: targetList.length,
		trackedSets: targetList,
		failedCount: failedSets.length,
		failedSets: failedSets.map( ( entry ) => ( { setname: entry.setname, error: 'Deletion failed' } ) ),
		error: error ? 'Run interrupted; reconcile tracked identities' : null,
		reconciliationInstructions: 'Manual reconciliation required. Inspect failedSets and delete using layersdelete API or Special:Layers.'
	};

	const outDir = options.logDir || path.resolve( __dirname, '../../.interrupted_runs' );
	try {
		if ( !fs.existsSync( outDir ) ) {
			fs.mkdirSync( outDir, { recursive: true } );
		}
		const safePrefix = ( runPrefix || 'interrupted' ).replace( /[^a-zA-Z0-9_-]/g, '_' );
		const logPath = path.join( outDir, `interrupted_${ safePrefix }_${ Date.now() }.json` );
		fs.writeFileSync( logPath, JSON.stringify( safeRecord, null, 2 ), 'utf8' );
		return { logPath, safeRecord };
	} catch ( writeErr ) {
		return { logPath: null, safeRecord, writeError: String( writeErr ) };
	}
}

module.exports = {
	isEligibleForCleanup,
	buildCleanupPlan,
	executeCleanupWithApi,
	recordInterruptedRun
};
