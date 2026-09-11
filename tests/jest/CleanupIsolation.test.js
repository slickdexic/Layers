/**
 * @jest-environment jsdom
 */

/**
 * Cleanup Isolation & Teardown Failure Propagation Unit Tests (J24)
 *
 * Behavior tests for the cleanup selection rule and failure propagation using test API responses:
 * 1. Tracked current-run name (eligible and deleted)
 * 2. Untracked same-prefix name (strictly preserved; never deleted)
 * 3. Another run's name (strictly preserved; never deleted)
 * 4. Missing author metadata (unknown provenance is not ownership; preserved)
 * 5. System/base sets (default, 001, 002 strictly preserved)
 * 6. Network failure during layersinfo query (propagates failure cleanly)
 * 7. API delete failure (records failure in failed list; causes overall failure)
 * 8. Network failure during delete (records failure in failed list; causes overall failure)
 * 9. Mutation-style proof that restoring broad prefix sweeps causes isolation failure
 * 10. Interrupted run recording for manual reconciliation with zero secrets/credentials
 */

'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );
const {
	isEligibleForCleanup,
	buildCleanupPlan,
	executeCleanupWithApi,
	recordInterruptedRun
} = require( '../e2e/cleanupHelper.js' );

describe( 'Cleanup Isolation & Teardown Failure Propagation (J24)', () => {
	const currentRunPrefix = 'j21_run12345';
	let tempLogDir;

	beforeEach( () => {
		tempLogDir = path.join( os.tmpdir(), 'cleanup-isolation-test-' + Date.now() + '-' + Math.random().toString( 36 ).slice( 2, 6 ) );
	} );

	afterEach( () => {
		if ( fs.existsSync( tempLogDir ) ) {
			fs.rmSync( tempLogDir, { recursive: true, force: true } );
		}
	} );

	describe( 'Selection Rule: isEligibleForCleanup', () => {
		const targetSets = [
			`${ currentRunPrefix }_setA`,
			`${ currentRunPrefix }_setB_renamed`
		];

		it( 'selects exact tracked current-run names', () => {
			const setA = { name: `${ currentRunPrefix }_setA`, author: 'LayersQA' };
			const setB = { name: `${ currentRunPrefix }_setB_renamed`, author: 'LayersQA' };

			expect( isEligibleForCleanup( setA, targetSets, currentRunPrefix ) ).toBe( true );
			expect( isEligibleForCleanup( setB, targetSets, currentRunPrefix ) ).toBe( true );
		} );

		it( 'rejects untracked names that share the same prefix (protecting orphaned/unregistered sets)', () => {
			// A set that starts with the same prefix but was NOT tracked in targetSets
			const untrackedSamePrefix = {
				name: `${ currentRunPrefix }_untracked_stray`,
				author: 'LayersQA'
			};

			expect( isEligibleForCleanup( untrackedSamePrefix, targetSets, currentRunPrefix ) ).toBe( false );
		} );

		it( 'rejects names belonging to other or prior test runs', () => {
			const otherRun1 = { name: 'j21_run99999_setA', author: 'LayersQA' };
			const otherRun2 = { name: 'j20_setA', author: 'LayersQA' };
			const otherRun3 = { name: 'j21_prior_test', author: 'LayersQA' };

			expect( isEligibleForCleanup( otherRun1, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( otherRun2, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( otherRun3, targetSets, currentRunPrefix ) ).toBe( false );
		} );

		it( 'never assumes missing author metadata is ownership', () => {
			// Unknown provenance is not ownership: even if author is missing, null, or empty,
			// it must NOT be eligible unless explicitly tracked in targetSets
			const missingAuthor1 = { name: 'unrelated_set_no_author', author: null };
			const missingAuthor2 = { name: `${ currentRunPrefix }_untracked_no_author` };
			const missingAuthor3 = { name: 'orphan_set', author: '' };

			expect( isEligibleForCleanup( missingAuthor1, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( missingAuthor2, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( missingAuthor3, targetSets, currentRunPrefix ) ).toBe( false );
		} );

		it( 'strictly protects system and base sets (default, 001, 002) even if accidentally in targetSets', () => {
			const corruptedTargets = [ ...targetSets, 'default', '001', '002' ];

			expect( isEligibleForCleanup( { name: 'default' }, corruptedTargets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( { name: '001' }, corruptedTargets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( { name: '002' }, corruptedTargets, currentRunPrefix ) ).toBe( false );
		} );

		it( 'handles malformed inputs safely without throwing', () => {
			expect( isEligibleForCleanup( null, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( undefined, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( {}, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( { name: '' }, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( { name: 123 }, targetSets, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( { name: 'valid' }, null, currentRunPrefix ) ).toBe( false );
			expect( isEligibleForCleanup( { name: 'valid' }, targetSets, null ) ).toBe( false );
		} );
	} );

	describe( 'Plan Building: buildCleanupPlan', () => {
		it( 'correctly partitions eligible and preserved sets', () => {
			const targetSets = [ `${ currentRunPrefix }_test1`, `${ currentRunPrefix }_test2` ];
			const apiNamedSets = [
				{ name: 'default' },
				{ name: '001' },
				{ name: '002' },
				{ name: `${ currentRunPrefix }_test1` },
				{ name: `${ currentRunPrefix }_test2` },
				{ name: `${ currentRunPrefix }_untracked` },
				{ name: 'j21_other_run_set' }
			];

			const plan = buildCleanupPlan( apiNamedSets, targetSets, currentRunPrefix );

			expect( plan.eligible ).toEqual( [
				`${ currentRunPrefix }_test1`,
				`${ currentRunPrefix }_test2`
			] );

			expect( plan.preserved ).toEqual( [
				'default',
				'001',
				'002',
				`${ currentRunPrefix }_untracked`,
				'j21_other_run_set'
			] );
		} );
	} );

	describe( 'Execution & Failure Propagation: executeCleanupWithApi', () => {
		const targetSets = [ `${ currentRunPrefix }_set1`, `${ currentRunPrefix }_set2` ];

		it( 'successfully deletes eligible sets and reports complete success', async () => {
			const mockApi = {
				get: jest.fn().mockResolvedValue( {
					layersinfo: {
						named_sets: [
							{ name: '001' },
							{ name: `${ currentRunPrefix }_set1` },
							{ name: `${ currentRunPrefix }_set2` },
							{ name: 'unrelated_set' }
						]
					}
				} ),
				postWithToken: jest.fn().mockResolvedValue( { layersdelete: { result: 'Success' } } )
			};

			const result = await executeCleanupWithApi( mockApi, 'ImageTest.png', targetSets, currentRunPrefix );

			expect( result.success ).toBe( true );
			expect( result.deleted ).toEqual( [
				`${ currentRunPrefix }_set1`,
				`${ currentRunPrefix }_set2`
			] );
			expect( result.failed ).toHaveLength( 0 );

			// Verification: postWithToken was only called for the 2 eligible sets
			expect( mockApi.postWithToken ).toHaveBeenCalledTimes( 2 );
			expect( mockApi.postWithToken ).toHaveBeenCalledWith( 'csrf', {
				action: 'layersdelete',
				filename: 'ImageTest.png',
				setname: `${ currentRunPrefix }_set1`
			} );
			expect( mockApi.postWithToken ).toHaveBeenCalledWith( 'csrf', {
				action: 'layersdelete',
				filename: 'ImageTest.png',
				setname: `${ currentRunPrefix }_set2`
			} );
		} );

		it( 'rejects malformed inventory instead of reporting cleanup success', async () => {
			const api = { get: jest.fn().mockResolvedValue( {} ), postWithToken: jest.fn() };
			const result = await executeCleanupWithApi( api, 'Test.png', [], currentRunPrefix );
			expect( result.success ).toBe( false );
			expect( result.phase ).toBe( 'query' );
			expect( api.postWithToken ).not.toHaveBeenCalled();
		} );

		it( 'handles and propagates network failure during layersinfo query', async () => {
			const mockApi = {
				get: jest.fn().mockRejectedValue( new Error( 'Network timeout on layersinfo query' ) ),
				postWithToken: jest.fn()
			};

			const result = await executeCleanupWithApi( mockApi, 'ImageTest.png', targetSets, currentRunPrefix );

			expect( result.success ).toBe( false );
			expect( result.phase ).toBe( 'query' );
			expect( result.error ).toContain( 'Network timeout on layersinfo query' );
			expect( result.deleted ).toHaveLength( 0 );
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );

		it( 'records API delete failures in failed list and sets success: false', async () => {
			const mockApi = {
				get: jest.fn().mockResolvedValue( {
					layersinfo: {
						named_sets: [
							{ name: `${ currentRunPrefix }_set1` },
							{ name: `${ currentRunPrefix }_set2` }
						]
					}
				} ),
				postWithToken: jest.fn()
					.mockResolvedValueOnce( { layersdelete: { result: 'Success' } } )
					.mockRejectedValueOnce( new Error( 'permissiondenied: User cannot delete layer set' ) )
			};

			const result = await executeCleanupWithApi( mockApi, 'ImageTest.png', targetSets, currentRunPrefix );

			expect( result.success ).toBe( false );
			expect( result.deleted ).toEqual( [ `${ currentRunPrefix }_set1` ] );
			expect( result.failed ).toEqual( [
				{
					setname: `${ currentRunPrefix }_set2`,
					error: expect.stringContaining( 'permissiondenied' )
				}
			] );
		} );

		it( 'records network drop during delete in failed list and sets success: false', async () => {
			const mockApi = {
				get: jest.fn().mockResolvedValue( {
					layersinfo: {
						named_sets: [
							{ name: `${ currentRunPrefix }_set1` }
						]
					}
				} ),
				postWithToken: jest.fn().mockRejectedValue( new Error( 'ECONNRESET' ) )
			};

			const result = await executeCleanupWithApi( mockApi, 'ImageTest.png', targetSets, currentRunPrefix );

			expect( result.success ).toBe( false );
			expect( result.failed ).toHaveLength( 1 );
			expect( result.failed[ 0 ].setname ).toBe( `${ currentRunPrefix }_set1` );
			expect( result.failed[ 0 ].error ).toContain( 'ECONNRESET' );
		} );
	} );

	describe( 'Mutation-style Proof: Broad Prefix Deletion Fails Isolation', () => {
		it( 'proves that naive broad-prefix deletion deletes untracked sets, while exact-tracked prevents it', () => {
			const targetSets = [ `${ currentRunPrefix }_valid` ];
			const apiNamedSets = [
				{ name: `${ currentRunPrefix }_valid` },
				{ name: `${ currentRunPrefix }_untracked_stray` } // Untracked set with same prefix!
			];

			// Naive broad-prefix implementation (what J21 originally had):
			const broadPrefixCleanup = ( setList, prefix ) =>
				setList.filter( ( s ) => s.name.startsWith( prefix + '_' ) ).map( ( s ) => s.name );

			// Exact-tracked implementation (J24 requirement):
			const isolatedPlan = buildCleanupPlan( apiNamedSets, targetSets, currentRunPrefix );

			// MUTATION PROOF:
			// Broad prefix deletion erroneously includes the untracked stray set:
			const flawedSelected = broadPrefixCleanup( apiNamedSets, currentRunPrefix );
			expect( flawedSelected ).toContain( `${ currentRunPrefix }_untracked_stray` );

			// Isolated implementation strictly excludes the untracked set:
			expect( isolatedPlan.eligible ).not.toContain( `${ currentRunPrefix }_untracked_stray` );
			expect( isolatedPlan.preserved ).toContain( `${ currentRunPrefix }_untracked_stray` );
			expect( isolatedPlan.eligible ).toEqual( [ `${ currentRunPrefix }_valid` ] );
		} );
	} );

	describe( 'Interrupted Run Recording for Manual Reconciliation', () => {
		it( 'creates structured reconciliation JSON with failed sets and zero credentials', () => {
			const runDetails = {
				filename: 'ImageTest03.png',
				runPrefix: currentRunPrefix,
				targetSets: [ `${ currentRunPrefix }_set1`, `${ currentRunPrefix }_set2` ],
				failedSets: [
					{ setname: `${ currentRunPrefix }_set2`, error: 'csrf-secret-token-xyz' }
				],
				error: new Error( 'SecretPassword123!' ),
				// Simulate accidental inclusion of sensitive credential fields in surrounding scope
				password: 'SecretPassword123!',
				token: 'csrf-secret-token-xyz',
				authCookie: 'session=abcdef123456'
			};

			const { logPath, safeRecord } = recordInterruptedRun( runDetails, { logDir: tempLogDir } );

			expect( logPath ).toBeTruthy();
			expect( fs.existsSync( logPath ) ).toBe( true );

			// Read written file directly from disk
			const rawContent = fs.readFileSync( logPath, 'utf8' );
			const written = JSON.parse( rawContent );

			// Verify operational contents
			expect( written.filename ).toBe( 'ImageTest03.png' );
			expect( written.runPrefix ).toBe( currentRunPrefix );
			expect( written.trackedCount ).toBe( 2 );
			expect( written.failedCount ).toBe( 1 );
			expect( written.failedSets[ 0 ].setname ).toBe( `${ currentRunPrefix }_set2` );
			expect( written.reconciliationInstructions ).toBeTruthy();

			// CRITICAL SECURITY ASSERTION:
			// Zero secrets/credentials embedded in reconciliation log!
			expect( rawContent ).not.toContain( 'SecretPassword123!' );
			expect( rawContent ).not.toContain( 'csrf-secret-token-xyz' );
			expect( rawContent ).not.toContain( 'session=abcdef123456' );
			expect( safeRecord.password ).toBeUndefined();
			expect( safeRecord.token ).toBeUndefined();
			expect( safeRecord.authCookie ).toBeUndefined();
			expect( written.password ).toBeUndefined();
			expect( written.token ).toBeUndefined();
		} );
	} );
} );
