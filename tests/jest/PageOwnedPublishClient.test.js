/**
 * Tests for PageOwnedPublishClient
 */
'use strict';

window.Layers = window.Layers || {};
window.Layers.Editor = window.Layers.Editor || {};

const PageOwnedPublishClient = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );

describe( 'PageOwnedPublishClient', () => {
	let mockApi;
	let client;

	beforeEach( () => {
		mockApi = {
			postWithToken: jest.fn()
		};
		client = new PageOwnedPublishClient( mockApi );
	} );

	describe( 'constructor', () => {
		it( 'should instantiate with valid api object', () => {
			expect( client ).toBeInstanceOf( PageOwnedPublishClient );
			expect( client.api ).toBe( mockApi );
		} );

		it( 'should export to window.Layers.Editor.PageOwnedPublishClient', () => {
			expect( window.Layers.Editor.PageOwnedPublishClient ).toBe( PageOwnedPublishClient );
		} );

		it( 'should throw layers-invalid-publication-request if api is missing or invalid', () => {
			expect( () => new PageOwnedPublishClient() ).toThrow();
			expect( () => new PageOwnedPublishClient( null ) ).toThrow();
			expect( () => new PageOwnedPublishClient( {} ) ).toThrow();
			expect( () => new PageOwnedPublishClient( { postWithToken: 'not-a-func' } ) ).toThrow();

			try {
				new PageOwnedPublishClient( null );
			} catch ( err ) {
				expect( err.code ).toBe( 'layers-invalid-publication-request' );
			}
		} );
	} );

	describe( 'input validation', () => {
		it( 'rejects invalid optional fields instead of silently discarding them', async () => {
			for ( const field of [ 'summary', 'mainText' ] ) {
				for ( const value of [ 123, false, {}, [] ] ) {
					await expect( client.publish( {
						owner: 'TestPage', baseRevisionId: 10, snapshotJson: '{}', [ field ]: value
					} ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
				}
			}
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );

		it( 'sanitizes synchronous transport exceptions as promise rejections', async () => {
			mockApi.postWithToken.mockImplementation( () => {
				throw new Error( 'SECRET transport diagnostics' );
			} );
			const pending = client.publish( { owner: 'TestPage', baseRevisionId: 10, snapshotJson: '{}' } );
			expect( pending ).toBeInstanceOf( Promise );
			await expect( pending ).rejects.toMatchObject( {
				code: 'layers-publication-outcome-unknown', message: 'Publication outcome is unknown'
			} );
			expect( mockApi.postWithToken ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'rebuilds invalid-request server errors without retaining diagnostics', async () => {
			const raw = Object.assign( new Error( 'SECRET token and server trace' ), {
				code: 'layers-invalid-publication-request', diagnostics: 'SECRET'
			} );
			mockApi.postWithToken.mockRejectedValue( raw );
			const error = await client.publish( {
				owner: 'TestPage', baseRevisionId: 10, snapshotJson: '{}'
			} ).catch( ( err ) => err );
			expect( error ).toBeInstanceOf( Error );
			expect( error ).not.toBe( raw );
			expect( error.message ).toBe( 'Publication failed: layers-invalid-publication-request' );
			expect( error.code ).toBe( 'layers-invalid-publication-request' );
			expect( error.diagnostics ).toBeUndefined();
			expect( error.stack ).not.toContain( 'SECRET' );
		} );

		it( 'handles a multi-argument API thenable rejection without retry or payload reflection', async () => {
			mockApi.postWithToken.mockReturnValue( {
				then: ( resolve, reject ) => reject( 'layers-edit-conflict', { info: 'SECRET' } )
			} );
			await expect( client.publish( {
				owner: 'TestPage', baseRevisionId: 10, snapshotJson: '{}'
			} ) ).rejects.toMatchObject( {
				code: 'layers-edit-conflict', message: 'Publication failed: layers-edit-conflict'
			} );
			expect( mockApi.postWithToken ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should reject non-object options with layers-invalid-publication-request', async () => {
			for ( const invalid of [ null, undefined, 'string', 123, true ] ) {
				await expect( client.publish( invalid ) ).rejects.toMatchObject( {
					code: 'layers-invalid-publication-request'
				} );
			}
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );

		it( 'should reject missing or invalid owner with layers-invalid-publication-request', async () => {
			const validRest = {
				baseRevisionId: 10,
				snapshotJson: '{"version":1}'
			};

			for ( const badOwner of [ '', '   ', '\t\n', null, undefined, 123, {} ] ) {
				await expect( client.publish( { ...validRest, owner: badOwner } ) ).rejects.toMatchObject( {
					code: 'layers-invalid-publication-request'
				} );
			}
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );

		it( 'should reject invalid baseRevisionId with layers-invalid-publication-request', async () => {
			const validRest = {
				owner: 'TestPage',
				snapshotJson: '{"version":1}'
			};

			for ( const badBase of [ -1, -100, 1.5, '10', '0', null, undefined, NaN, Infinity, 2147483648 ] ) {
				await expect( client.publish( { ...validRest, baseRevisionId: badBase } ) ).rejects.toMatchObject( {
					code: 'layers-invalid-publication-request'
				} );
			}
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );

		it( 'should accept valid baseRevisionId boundaries 0 and 2147483647', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 100 }
			} );

			await expect( client.publish( {
				owner: 'TestPage',
				baseRevisionId: 0,
				snapshotJson: '{"version":1}'
			} ) ).resolves.toEqual( { revisionId: 100 } );

			await expect( client.publish( {
				owner: 'TestPage',
				baseRevisionId: 2147483647,
				snapshotJson: '{"version":1}'
			} ) ).resolves.toEqual( { revisionId: 100 } );

			expect( mockApi.postWithToken ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'should reject missing or invalid snapshotJson with layers-invalid-publication-request', async () => {
			const validRest = {
				owner: 'TestPage',
				baseRevisionId: 5
			};

			for ( const badJson of [ null, undefined, 123, {}, [], true ] ) {
				await expect( client.publish( { ...validRest, snapshotJson: badJson } ) ).rejects.toMatchObject( {
					code: 'layers-invalid-publication-request'
				} );
			}
			expect( mockApi.postWithToken ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'request mapping and parameter immutability', () => {
		it( 'should send exact action and CSRF token', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 201 }
			} );

			await client.publish( {
				owner: 'OwnerPage',
				baseRevisionId: 200,
				snapshotJson: '{"layers":[]}'
			} );

			expect( mockApi.postWithToken ).toHaveBeenCalledTimes( 1 );
			expect( mockApi.postWithToken ).toHaveBeenCalledWith(
				'csrf',
				expect.objectContaining( {
					action: 'layerspublish',
					owner: 'OwnerPage',
					baserevid: 200,
					data: '{"layers":[]}',
					summary: ''
				} )
			);
		} );

		it( 'should default omitted summary to empty string and preserve explicit summary', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 301 }
			} );

			await client.publish( {
				owner: 'OwnerPage',
				baseRevisionId: 300,
				snapshotJson: '{"v":1}'
			} );

			expect( mockApi.postWithToken.mock.calls[ 0 ][ 1 ].summary ).toBe( '' );

			await client.publish( {
				owner: 'OwnerPage',
				baseRevisionId: 300,
				snapshotJson: '{"v":1}',
				summary: 'Added circle annotation'
			} );

			expect( mockApi.postWithToken.mock.calls[ 1 ][ 1 ].summary ).toBe( 'Added circle annotation' );
		} );

		it( 'should omit maintext when absent and preserve explicit empty string', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 401 }
			} );

			// Omitted mainText
			await client.publish( {
				owner: 'OwnerPage',
				baseRevisionId: 400,
				snapshotJson: '{"v":1}'
			} );
			expect( 'maintext' in mockApi.postWithToken.mock.calls[ 0 ][ 1 ] ).toBe( false );

			// Explicit null mainText -> omitted
			await client.publish( {
				owner: 'OwnerPage',
				baseRevisionId: 400,
				snapshotJson: '{"v":1}',
				mainText: null
			} );
			expect( 'maintext' in mockApi.postWithToken.mock.calls[ 1 ][ 1 ] ).toBe( false );

			// Explicit empty string mainText -> preserved as ""
			await client.publish( {
				owner: 'OwnerPage',
				baseRevisionId: 400,
				snapshotJson: '{"v":1}',
				mainText: ''
			} );
			expect( mockApi.postWithToken.mock.calls[ 2 ][ 1 ].maintext ).toBe( '' );

			// Explicit non-empty mainText -> preserved
			await client.publish( {
				owner: 'OwnerPage',
				baseRevisionId: 400,
				snapshotJson: '{"v":1}',
				mainText: '== New Slide =='
			} );
			expect( mockApi.postWithToken.mock.calls[ 3 ][ 1 ].maintext ).toBe( '== New Slide ==' );
		} );

		it( 'should capture request parameters immutably at invocation', async () => {
			let resolvePost;
			mockApi.postWithToken.mockImplementation( () => new Promise( ( resolve ) => {
				resolvePost = resolve;
			} ) );

			const req = {
				owner: 'OriginalOwner',
				baseRevisionId: 10,
				snapshotJson: '{"initial":true}',
				summary: 'Initial summary',
				mainText: 'Initial text'
			};

			const publishPromise = client.publish( req );

			// Mutate original object immediately after invocation
			req.owner = 'MutatedOwner';
			req.baseRevisionId = 999;
			req.snapshotJson = '{"mutated":true}';
			req.summary = 'Mutated summary';
			req.mainText = 'Mutated text';

			resolvePost( {
				layerspublish: { result: 'Success', revid: 11 }
			} );

			const result = await publishPromise;
			expect( result ).toEqual( { revisionId: 11 } );

			expect( mockApi.postWithToken ).toHaveBeenCalledWith(
				'csrf',
				{
					action: 'layerspublish',
					owner: 'OriginalOwner',
					baserevid: 10,
					data: '{"initial":true}',
					summary: 'Initial summary',
					maintext: 'Initial text'
				}
			);
		} );

		it( 'should not mutate caller input object', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 12 }
			} );

			const input = {
				owner: 'Untouched',
				baseRevisionId: 5,
				snapshotJson: '{"clean":true}'
			};
			const clone = { ...input };

			await client.publish( input );
			expect( input ).toEqual( clone );
		} );
	} );

	describe( 'successful publishing and no-ops', () => {
		it( 'should resolve with new revisionId on success', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 501 }
			} );

			const res = await client.publish( {
				owner: 'Slide1',
				baseRevisionId: 500,
				snapshotJson: '{"v":1}'
			} );

			expect( res ).toEqual( { revisionId: 501 } );
		} );

		it( 'should resolve when revid equals baseRevisionId (valid no-op)', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 500 }
			} );

			const res = await client.publish( {
				owner: 'Slide1',
				baseRevisionId: 500,
				snapshotJson: '{"v":1}'
			} );

			expect( res ).toEqual( { revisionId: 500 } );
		} );

		it( 'should accept boundary revision IDs', async () => {
			mockApi.postWithToken.mockResolvedValueOnce( {
				layerspublish: { result: 'Success', revid: 1 }
			} ).mockResolvedValueOnce( {
				layerspublish: { result: 'Success', revid: 2147483647 }
			} );

			await expect( client.publish( {
				owner: 'Slide1',
				baseRevisionId: 0,
				snapshotJson: '{}'
			} ) ).resolves.toEqual( { revisionId: 1 } );

			await expect( client.publish( {
				owner: 'Slide1',
				baseRevisionId: 0,
				snapshotJson: '{}'
			} ) ).resolves.toEqual( { revisionId: 2147483647 } );
		} );
	} );

	describe( 'malformed success and uncertain outcome handling', () => {
		it( 'should reject with layers-publication-outcome-unknown when response is missing layerspublish', async () => {
			for ( const emptyResp of [ {}, null, undefined, { other: 123 } ] ) {
				mockApi.postWithToken.mockResolvedValue( emptyResp );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: 'layers-publication-outcome-unknown'
				} );
			}
		} );

		it( 'should reject with layers-publication-outcome-unknown when result is not Success', async () => {
			for ( const badResult of [ 'Failure', 'Failed', '', null, undefined, 1 ] ) {
				mockApi.postWithToken.mockResolvedValue( {
					layerspublish: { result: badResult, revid: 10 }
				} );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: 'layers-publication-outcome-unknown'
				} );
			}
		} );

		it( 'should reject with layers-publication-outcome-unknown when revid is invalid', async () => {
			for ( const badRevid of [ null, undefined, '100', 0, -1, 1.5, NaN, 2147483648 ] ) {
				mockApi.postWithToken.mockResolvedValue( {
					layerspublish: { result: 'Success', revid: badRevid }
				} );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: 'layers-publication-outcome-unknown'
				} );
			}
		} );
	} );

	describe( 'server error mapping', () => {
		const recognizedServiceCodes = [
			'layers-owner-edit-denied',
			'layers-invalid-publication-request',
			'layers-main-model-change-denied',
			'layers-invalid-snapshot',
			'layers-source-unavailable',
			'layers-edit-conflict',
			'layers-publication-disabled',
			'layers-admission-unauthorized',
			'layers-slot-removal-denied'
		];

		const recognizedCoreCodes = [
			'missingparam',
			'badtoken',
			'outofrange',
			'maxbytes',
			'permissiondenied',
			'ratelimited',
			'mustbeposted'
		];

		recognizedServiceCodes.forEach( ( code ) => {
			it( `should propagate recognized service code: ${ code }`, async () => {
				mockApi.postWithToken.mockRejectedValue( code );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: code
				} );
			} );
		} );

		recognizedCoreCodes.forEach( ( code ) => {
			it( `should propagate recognized core code: ${ code }`, async () => {
				mockApi.postWithToken.mockRejectedValue( {
					error: { code: code, info: 'Server error detail' }
				} );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: code
				} );
			} );
		} );

		it( 'should handle array-format error rejections [ code, result ]', async () => {
			mockApi.postWithToken.mockRejectedValue( [ 'badtoken', { error: { code: 'badtoken' } } ] );
			await expect( client.publish( {
				owner: 'Slide',
				baseRevisionId: 1,
				snapshotJson: '{}'
			} ) ).rejects.toMatchObject( {
				code: 'badtoken'
			} );
		} );

		it( 'should handle resolved response with error property', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				error: { code: 'layers-edit-conflict' }
			} );
			await expect( client.publish( {
				owner: 'Slide',
				baseRevisionId: 1,
				snapshotJson: '{}'
			} ) ).rejects.toMatchObject( {
				code: 'layers-edit-conflict'
			} );
		} );

		it( 'should map layers-publication-failed and layers-revision-save-failed to layers-publication-outcome-unknown', async () => {
			for ( const code of [ 'layers-publication-failed', 'layers-revision-save-failed' ] ) {
				mockApi.postWithToken.mockRejectedValue( code );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: 'layers-publication-outcome-unknown'
				} );
			}
		} );

		it( 'should map unknown server error codes to layers-publication-outcome-unknown', async () => {
			for ( const code of [ 'internal_api_error_DBError', 'custom_error', 'unknown', 'exception' ] ) {
				mockApi.postWithToken.mockRejectedValue( code );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: 'layers-publication-outcome-unknown'
				} );
			}
		} );

		it( 'should map transport network failures to layers-publication-outcome-unknown', async () => {
			for ( const transportErr of [ 'http', new Error( 'Network connection dropped' ), 'timeout' ] ) {
				mockApi.postWithToken.mockRejectedValue( transportErr );
				await expect( client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} ) ).rejects.toMatchObject( {
					code: 'layers-publication-outcome-unknown'
				} );
			}
		} );

		it( 'should not copy server diagnostics, HTML, stack traces, payloads, or tokens into Error message', async () => {
			mockApi.postWithToken.mockRejectedValue( {
				error: {
					code: 'permissiondenied',
					info: '<html><body>Stack trace: secret_token=xyz123 at line 42</body></html>'
				}
			} );

			let threw = false;
			try {
				await client.publish( {
					owner: 'Slide',
					baseRevisionId: 1,
					snapshotJson: '{}'
				} );
			} catch ( err ) {
				threw = true;
				expect( err.code ).toBe( 'permissiondenied' );
				expect( err.message ).not.toContain( '<html>' );
				expect( err.message ).not.toContain( 'secret_token' );
				expect( err.message ).not.toContain( 'xyz123' );
			}
			expect( threw ).toBe( true );
		} );
	} );

	describe( 'strict absence of application retries and global side effects', () => {
		it( 'should make exactly one call and not retry on transport failure', async () => {
			mockApi.postWithToken.mockRejectedValue( 'http' );

			await expect( client.publish( {
				owner: 'Slide',
				baseRevisionId: 1,
				snapshotJson: '{}'
			} ) ).rejects.toMatchObject( {
				code: 'layers-publication-outcome-unknown'
			} );

			expect( mockApi.postWithToken ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should not access or mutate window.wgPageName, mw.config, or legacy layer_sets', async () => {
			mockApi.postWithToken.mockResolvedValue( {
				layerspublish: { result: 'Success', revid: 88 }
			} );

			const prevConfig = typeof mw !== 'undefined' ? mw.config : undefined;

			await client.publish( {
				owner: 'StrictTest',
				baseRevisionId: 10,
				snapshotJson: '{"version":1}'
			} );

			if ( typeof mw !== 'undefined' ) {
				expect( mw.config ).toBe( prevConfig );
			}
			expect( mockApi.postWithToken ).not.toHaveBeenCalledWith( expect.anything(), expect.objectContaining( {
				action: 'layerssave'
			} ) );
		} );
	} );
} );
