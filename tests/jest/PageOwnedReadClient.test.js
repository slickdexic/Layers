/**
 * Tests for PageOwnedReadClient
 */
'use strict';

window.Layers = window.Layers || {};
window.Layers.Editor = window.Layers.Editor || {};

const PageOwnedReadClient = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );

describe( 'PageOwnedReadClient', () => {
	let mockApi;
	let client;

	beforeEach( () => {
		mockApi = {
			get: jest.fn()
		};
		client = new PageOwnedReadClient( mockApi );
	} );

	describe( 'constructor', () => {
		it( 'should instantiate with valid api object', () => {
			expect( client ).toBeInstanceOf( PageOwnedReadClient );
			expect( client.api ).toBe( mockApi );
		} );

		it( 'should export to window.Layers.Editor.PageOwnedReadClient', () => {
			expect( window.Layers.Editor.PageOwnedReadClient ).toBe( PageOwnedReadClient );
		} );

		it( 'should throw layers-invalid-read-request if api is missing or invalid', () => {
			expect( () => new PageOwnedReadClient() ).toThrow();
			expect( () => new PageOwnedReadClient( null ) ).toThrow();
			expect( () => new PageOwnedReadClient( {} ) ).toThrow();
			expect( () => new PageOwnedReadClient( { get: 'not-a-func' } ) ).toThrow();

			try {
				new PageOwnedReadClient( null );
			} catch ( err ) {
				expect( err.code ).toBe( 'layers-invalid-read-request' );
			}
		} );
	} );

	describe( 'input validation', () => {
		it( 'should reject non-object options with layers-invalid-read-request', async () => {
			for ( const invalid of [ null, undefined, 'string', 123, true, [] ] ) {
				await expect( client.read( invalid ) ).rejects.toMatchObject( {
					code: 'layers-invalid-read-request'
				} );
			}
			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should reject missing or invalid owner with layers-invalid-read-request', async () => {
			for ( const badOwner of [ '', '   ', '\t\n', null, undefined, 123, {}, [] ] ) {
				await expect( client.read( { owner: badOwner, revisionId: 10 } ) ).rejects.toMatchObject( {
					code: 'layers-invalid-read-request'
				} );
			}
			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should reject invalid revisionId with layers-invalid-read-request', async () => {
			for ( const badRevid of [ 0, -1, -100, 1.5, '10', null, undefined, NaN, Infinity, 2147483648 ] ) {
				await expect( client.read( { owner: 'SlidePage', revisionId: badRevid } ) ).rejects.toMatchObject( {
					code: 'layers-invalid-read-request'
				} );
			}
			expect( mockApi.get ).not.toHaveBeenCalled();
		} );

		it( 'should accept valid revisionId boundaries 1 and 2147483647', async () => {
			mockApi.get.mockResolvedValueOnce( {
				layersread: {
					revisionId: 1,
					snapshot: { schemaVersion: 1, surfaces: [] },
					sourceGeometry: []
				}
			} ).mockResolvedValueOnce( {
				layersread: {
					revisionId: 2147483647,
					snapshot: { schemaVersion: 1, surfaces: [] },
					sourceGeometry: []
				}
			} );

			await expect( client.read( { owner: 'SlidePage', revisionId: 1 } ) ).resolves.toEqual( {
				revisionId: 1,
				snapshot: { schemaVersion: 1, surfaces: [] },
				sourceGeometry: []
			} );

			await expect( client.read( { owner: 'SlidePage', revisionId: 2147483647 } ) ).resolves.toEqual( {
				revisionId: 2147483647,
				snapshot: { schemaVersion: 1, surfaces: [] },
				sourceGeometry: []
			} );

			expect( mockApi.get ).toHaveBeenCalledTimes( 2 );
		} );
	} );

	describe( 'request mapping and parameter immutability', () => {
		it( 'should send exact action, owner and revid parameters', async () => {
			mockApi.get.mockResolvedValue( {
				layersread: {
					revisionId: 42,
					snapshot: { schemaVersion: 1, surfaces: [] },
					sourceGeometry: []
				}
			} );

			await client.read( {
				owner: 'TestOwner',
				revisionId: 42
			} );

			expect( mockApi.get ).toHaveBeenCalledTimes( 1 );
			expect( mockApi.get ).toHaveBeenCalledWith( {
				action: 'layersread',
				formatversion: 2,
				owner: 'TestOwner',
				revid: 42
			} );
		} );

		it( 'should capture parameters immutably at invocation', async () => {
			let resolveGet;
			mockApi.get.mockImplementation( () => new Promise( ( resolve ) => {
				resolveGet = resolve;
			} ) );

			const req = {
				owner: 'OriginalOwner',
				revisionId: 50
			};

			const readPromise = client.read( req );

			// Mutate original object immediately after invocation
			req.owner = 'MutatedOwner';
			req.revisionId = 999;

			resolveGet( {
				layersread: {
					revisionId: 50,
					snapshot: { schemaVersion: 1, surfaces: [ { id: 's1' } ] },
					sourceGeometry: []
				}
			} );

			const result = await readPromise;
			expect( result.revisionId ).toBe( 50 );
			expect( mockApi.get ).toHaveBeenCalledWith( {
				action: 'layersread',
				formatversion: 2,
				owner: 'OriginalOwner',
				revid: 50
			} );
		} );

		it( 'should not mutate caller input object', async () => {
			mockApi.get.mockResolvedValue( {
				layersread: {
					revisionId: 15,
					snapshot: { schemaVersion: 1, surfaces: [] },
					sourceGeometry: []
				}
			} );

			const input = {
				owner: 'UntouchedOwner',
				revisionId: 15
			};
			const clone = { ...input };

			await client.read( input );
			expect( input ).toEqual( clone );
		} );

		it( 'should safely convert synchronous transport exceptions into rejected promises', async () => {
			mockApi.get.mockImplementation( () => {
				throw new Error( 'Synchronous network failure' );
			} );

			await expect( client.read( {
				owner: 'FailOwner',
				revisionId: 12
			} ) ).rejects.toMatchObject( {
				code: 'layers-reading-failed'
			} );
		} );
	} );

	describe( 'successful responses and geometry forms', () => {
		it( 'should accept slide document with empty array sourceGeometry', async () => {
			const expectedSnapshot = {
				schemaVersion: 1,
				surfaces: [ { id: 'slide-1', layers: [] } ]
			};
			mockApi.get.mockResolvedValue( {
				layersread: {
					revisionId: 100,
					snapshot: expectedSnapshot,
					sourceGeometry: []
				}
			} );

			const result = await client.read( {
				owner: 'SlideDoc',
				revisionId: 100
			} );

			expect( result ).toEqual( {
				revisionId: 100,
				snapshot: expectedSnapshot,
				sourceGeometry: []
			} );
		} );

		it( 'should accept image/PDF document with object sourceGeometry', async () => {
			const expectedSnapshot = {
				schemaVersion: 1,
				surfaces: [ { id: 'pdf-page-1', layers: [] } ]
			};
			const expectedGeometry = {
				'pdf-page-1': {
					page: 1,
					width: 1200,
					height: 1600,
					units: 'file-handler-pixels'
				}
			};
			mockApi.get.mockResolvedValue( {
				layersread: {
					revisionId: 101,
					snapshot: expectedSnapshot,
					sourceGeometry: expectedGeometry
				}
			} );

			const result = await client.read( {
				owner: 'PdfDoc',
				revisionId: 101
			} );

			expect( result ).toEqual( {
				revisionId: 101,
				snapshot: expectedSnapshot,
				sourceGeometry: expectedGeometry
			} );
		} );

		it( 'should return only the contracted three fields', async () => {
			mockApi.get.mockResolvedValue( {
				layersread: {
					revisionId: 102,
					snapshot: { schemaVersion: 1, surfaces: [] },
					sourceGeometry: {},
					extraField: 'should be ignored',
					author: 'should not be returned'
				}
			} );

			const result = await client.read( {
				owner: 'Doc',
				revisionId: 102
			} );

			expect( Object.keys( result ).sort() ).toEqual( [ 'revisionId', 'snapshot', 'sourceGeometry' ] );
		} );
	} );

	describe( 'envelope rejections and malformed responses', () => {
		it( 'should reject when layersread property is missing, null, or array', async () => {
			for ( const badEnvelope of [ {}, null, undefined, { layersread: null }, { layersread: [] }, { layersread: 'bad' } ] ) {
				mockApi.get.mockResolvedValue( badEnvelope );
				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );

		it( 'should reject when response revisionId does not match requested revisionId', async () => {
			mockApi.get.mockResolvedValue( {
				layersread: {
					revisionId: 99, // requested 5
					snapshot: { schemaVersion: 1, surfaces: [] },
					sourceGeometry: []
				}
			} );

			await expect( client.read( {
				owner: 'Doc',
				revisionId: 5
			} ) ).rejects.toMatchObject( {
				code: 'layers-reading-failed'
			} );
		} );

		it( 'should reject when response revisionId is not an integer', async () => {
			for ( const badRevid of [ '5', 5.5, null, undefined, NaN ] ) {
				mockApi.get.mockResolvedValue( {
					layersread: {
						revisionId: badRevid,
						snapshot: { schemaVersion: 1, surfaces: [] },
						sourceGeometry: []
					}
				} );

				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );

		it( 'should reject when snapshot is missing, not an object, or an array', async () => {
			for ( const badSnapshot of [ null, undefined, [], 'json', 123 ] ) {
				mockApi.get.mockResolvedValue( {
					layersread: {
						revisionId: 5,
						snapshot: badSnapshot,
						sourceGeometry: []
					}
				} );

				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );

		it( 'should reject when snapshot.schemaVersion is not integer 1', async () => {
			for ( const badVersion of [ 2, 0, -1, '1', null, undefined ] ) {
				mockApi.get.mockResolvedValue( {
					layersread: {
						revisionId: 5,
						snapshot: { schemaVersion: badVersion, surfaces: [] },
						sourceGeometry: []
					}
				} );

				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );

		it( 'should reject when snapshot.surfaces is not an array', async () => {
			for ( const badSurfaces of [ null, undefined, {}, 'surfaces', 123 ] ) {
				mockApi.get.mockResolvedValue( {
					layersread: {
						revisionId: 5,
						snapshot: { schemaVersion: 1, surfaces: badSurfaces },
						sourceGeometry: []
					}
				} );

				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );

		it( 'should reject when sourceGeometry is neither an object nor an empty array', async () => {
			// A non-empty array is invalid because PHP maps serialize as objects or empty arrays
			for ( const badGeom of [ [ { invalid: true } ], null, undefined, 'geometry', 123, true ] ) {
				mockApi.get.mockResolvedValue( {
					layersread: {
						revisionId: 5,
						snapshot: { schemaVersion: 1, surfaces: [] },
						sourceGeometry: badGeom
					}
				} );

				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );
	} );

	describe( 'safe error propagation and mapping', () => {
		it.each( [ 'sync', 'async' ] )( 'sanitizes a %s transport error using the local-only validation code', async ( mode ) => {
			const raw = Object.assign( new Error( 'SECRET server diagnostic' ), {
				code: 'layers-invalid-read-request', diagnostics: 'SECRET'
			} );
			mockApi.get.mockImplementation( () => {
				if ( mode === 'sync' ) {
					throw raw;
				}
				return Promise.reject( raw );
			} );
			const error = await client.read( { owner: 'Doc', revisionId: 5 } ).catch( ( err ) => err );
			expect( error ).toBeInstanceOf( Error );
			expect( error ).not.toBe( raw );
			expect( error.code ).toBe( 'layers-reading-failed' );
			expect( error.message ).toBe( 'Reading failed: layers-reading-failed' );
			expect( error.diagnostics ).toBeUndefined();
			expect( error.stack ).not.toContain( 'SECRET' );
			expect( mockApi.get ).toHaveBeenCalledTimes( 1 );
		} );

		const recognizedCodes = [
			'missingparam',
			'outofrange',
			'maxbytes',
			'permissiondenied',
			'layers-reading-disabled',
			'layers-revision-unavailable',
			'layers-reading-failed'
		];

		recognizedCodes.forEach( ( code ) => {
			it( `should propagate recognized error code: ${ code }`, async () => {
				mockApi.get.mockRejectedValue( code );
				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: code
				} );
			} );
		} );

		it( 'should handle array-format error rejections [ code, result ]', async () => {
			mockApi.get.mockRejectedValue( [ 'permissiondenied', { error: { code: 'permissiondenied' } } ] );
			await expect( client.read( {
				owner: 'Doc',
				revisionId: 5
			} ) ).rejects.toMatchObject( {
				code: 'permissiondenied'
			} );
		} );

		it( 'should handle resolved response with error property', async () => {
			mockApi.get.mockResolvedValue( {
				error: { code: 'layers-revision-unavailable' }
			} );
			await expect( client.read( {
				owner: 'Doc',
				revisionId: 5
			} ) ).rejects.toMatchObject( {
				code: 'layers-revision-unavailable'
			} );
		} );

		it( 'should handle MediaWiki-style thenable rejection', async () => {
			mockApi.get.mockImplementation( () => ( {
				then: ( _onFulfilled, onRejected ) => {
					onRejected( 'layers-reading-disabled', { error: { code: 'layers-reading-disabled' } } );
				}
			} ) );

			await expect( client.read( {
				owner: 'Doc',
				revisionId: 5
			} ) ).rejects.toMatchObject( {
				code: 'layers-reading-disabled'
			} );
		} );

		it( 'should map unknown server error codes to layers-reading-failed', async () => {
			for ( const unknownCode of [ 'internal_api_error_DBError', 'custom_error', 'layers-edit-conflict', 'badtoken' ] ) {
				mockApi.get.mockRejectedValue( unknownCode );
				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );

		it( 'should map transport network failures to layers-reading-failed', async () => {
			for ( const transportErr of [ 'http', new Error( 'Connection reset' ), 'timeout' ] ) {
				mockApi.get.mockRejectedValue( transportErr );
				await expect( client.read( {
					owner: 'Doc',
					revisionId: 5
				} ) ).rejects.toMatchObject( {
					code: 'layers-reading-failed'
				} );
			}
		} );

		it( 'should not copy server diagnostics, HTML, stack traces, or tokens into Error message', async () => {
			mockApi.get.mockRejectedValue( {
				error: {
					code: 'permissiondenied',
					info: '<html><body>Stack trace: secret_token=read123 at line 99</body></html>'
				}
			} );

			let threw = false;
			try {
				await client.read( {
					owner: 'Doc',
					revisionId: 5
				} );
			} catch ( err ) {
				threw = true;
				expect( err.code ).toBe( 'permissiondenied' );
				expect( err.message ).not.toContain( '<html>' );
				expect( err.message ).not.toContain( 'secret_token' );
				expect( err.message ).not.toContain( 'read123' );
			}
			expect( threw ).toBe( true );
		} );
	} );

	describe( 'strict absence of application retries and global side effects', () => {
		it( 'should make exactly one call and not retry on transport failure', async () => {
			mockApi.get.mockRejectedValue( 'http' );

			await expect( client.read( {
				owner: 'Doc',
				revisionId: 5
			} ) ).rejects.toMatchObject( {
				code: 'layers-reading-failed'
			} );

			expect( mockApi.get ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should not access or mutate window.wgPageName, mw.config, or legacy layer_sets', async () => {
			mockApi.get.mockResolvedValue( {
				layersread: {
					revisionId: 5,
					snapshot: { schemaVersion: 1, surfaces: [] },
					sourceGeometry: []
				}
			} );

			const prevConfig = typeof mw !== 'undefined' ? mw.config : undefined;

			await client.read( {
				owner: 'StrictRead',
				revisionId: 5
			} );

			if ( typeof mw !== 'undefined' ) {
				expect( mw.config ).toBe( prevConfig );
			}
			expect( mockApi.get ).not.toHaveBeenCalledWith( expect.objectContaining( {
				action: 'layersload'
			} ) );
		} );
	} );
} );
