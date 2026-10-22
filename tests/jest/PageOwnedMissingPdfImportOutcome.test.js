'use strict';
const Client = require( '../../resources/ext.layers.editor/PageOwnedMissingPdfImportPublishClient.js' );
const fixture = require( './fixtures/missingPdfImportData.js' );
const copy = fixture.copy;

function request() {
	const native = fixture.preparation();
	return { pageId: 7, baseRevisionId: 12, selection: copy( native.targetAdmission.selection ),
		snapshotJson: JSON.stringify( native.sourceBundle.snapshot ), sources: [ { sourcePageId: 8,
			sourceRevisionId: 21, sourceSurfaceId: native.source.surfaceId } ], summary: fixture.literal };
}

const response = revisionId => ( { layersmissingpdfimportoutcome: {
	version: 1, result: 'Confirmed', revid: revisionId
} } );

describe( 'Explicit missing-PDF Import outcome confirmation client', () => {
	it( 'sends the exact captured Unicode request, ordered source triples, owner and CSRF token', async () => {
		const api = { postWithToken: jest.fn().mockResolvedValue( response( 13 ) ) };
		const client = new Client( api ), input = request(), saved = copy( input );
		const owner = 'Main page π';
		const pending = client.check( input, owner );
		input.selection.expected = 'Changed'; input.sources[ 0 ].sourceRevisionId = 999;
		const proof = await pending;

		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( api.postWithToken ).toHaveBeenCalledWith( 'csrf', {
			action: 'layersmissingpdfimportoutcome', targetpageid: 7, baserevid: 12, owner,
			embedstart: saved.selection.start, embedtext: saved.selection.expected, data: saved.snapshotJson,
			importsources: JSON.stringify( saved.sources ), summary: saved.summary
		} );
		expect( saved.selection.start ).toBeGreaterThan( 'Préface e\u0301 π\n'.length );
		expect( Client.isOutcomeConfirmationFor( proof, client, saved, owner ) ).toBe( true );
		expect( Object.isFrozen( proof ) ).toBe( true );
	} );

	it( 'deduplicates exact source triples while keeping their first order and spelling', async () => {
		const api = { postWithToken: jest.fn().mockResolvedValue( response( 13 ) ) }, input = request();
		const first = copy( input.sources[ 0 ] );
		input.sources.push( copy( first ), { sourcePageId: 9, sourceRevisionId: 22, sourceSurfaceId: 'source-2' } );
		await new Client( api ).check( input, 'Owner' );
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ) ).toEqual( [
			first, { sourcePageId: 9, sourceRevisionId: 22, sourceSurfaceId: 'source-2' }
		] );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ].action ).toBe( 'layersmissingpdfimportoutcome' );
	} );

	it( 'binds proofs privately to the client, request, owner and outcome route', async () => {
		const api = { postWithToken: jest.fn( ( token, dto ) => dto.action === 'layersmissingpdfimportpublish' ?
			{ layersmissingpdfimportpublish: { version: 1, result: 'Success', revid: 13 } } : response( 13 ) ) };
		const client = new Client( api ), input = request(), saved = copy( input ), owner = 'Owner';
		const publishProof = await client.publish( input );
		const outcomeProof = await client.check( input, owner );
		expect( Client.isOutcomeConfirmationFor( publishProof, client, saved, owner ) ).toBe( false );
		expect( Client.isConfirmationFor( outcomeProof, client, saved ) ).toBe( false );
		expect( Client.isOutcomeConfirmationFor( Object.freeze( { revisionId: 13 } ), client, saved, owner ) ).toBe( false );
		expect( Client.isOutcomeConfirmationFor( copy( outcomeProof ), client, saved, owner ) ).toBe( false );
		expect( Client.isOutcomeConfirmationFor( outcomeProof, new Client( api ), saved, owner ) ).toBe( false );
		expect( Client.isOutcomeConfirmationFor( outcomeProof, client, saved, 'Other owner' ) ).toBe( false );
		saved.selection.expected += ' changed';
		expect( Client.isOutcomeConfirmationFor( outcomeProof, client, saved, owner ) ).toBe( false );
		expect( api.postWithToken.mock.calls.map( call => call[ 1 ].action ) ).toEqual( [
			'layersmissingpdfimportpublish', 'layersmissingpdfimportoutcome'
		] );
	} );

	it.each( [
		[ 'extra request field', value => { value.extra = true; } ],
		[ 'invalid owner', ( value, setOwner ) => setOwner( '' ) ],
		[ 'same source and target page', value => { value.sources[ 0 ].sourcePageId = value.pageId; } ],
		[ 'malformed source ID', value => { value.sources[ 0 ].sourceSurfaceId = 'bad/ID'; } ],
		[ 'sparse source list', value => { delete value.sources[ 0 ]; } ]
	] )( 'refuses %s before sending a request', async ( label, mutate ) => {
		const api = { postWithToken: jest.fn() }, input = request(), options = { owner: 'Owner' };
		mutate( input, value => { options.owner = value; } );
		await expect( new Client( api ).check( input, options.owner ) ).rejects.toMatchObject( {
			code: 'layers-invalid-publication-request'
		} );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'does not invoke request or response getters', async () => {
		const responseValue = {}, getter = jest.fn(), input = request();
		Object.defineProperty( responseValue, 'layersmissingpdfimportoutcome', { get: getter, enumerable: true } );
		const api = { postWithToken: jest.fn().mockResolvedValueOnce( responseValue ).mockResolvedValue( {} ) };
		Object.defineProperty( input, 'selection', { get: getter, enumerable: true } );
		await expect( new Client( api ).check( input, 'Owner' ) ).rejects.toMatchObject( {
			code: 'layers-invalid-publication-request'
		} );
		await expect( new Client( api ).check( request(), 'Owner' ) ).rejects.toMatchObject( {
			code: 'layers-invalid-publication-request'
		} );
		expect( getter ).not.toHaveBeenCalled();
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [
		undefined, {}, { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 12 } },
		{ layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13, extra: true } },
		{ layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: '13' } },
		{ layersmissingpdfimportoutcome: { version: 1, result: 'Success', revid: 13 } },
		{ layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 }, extra: true },
		{ error: { code: 'layers-publication-failed', info: 'PRIVATE' } }
	] )( 'does not create a proof for malformed, stale or refused response %#', async result => {
		const api = { postWithToken: jest.fn().mockResolvedValue( result ) };
		await expect( new Client( api ).check( request(), 'Owner' ) ).rejects.toBeTruthy();
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ].action ).toBe( 'layersmissingpdfimportoutcome' );
	} );

	it( 'maps transport failures and hostile response objects without retrying or publishing', async () => {
		const hostile = new Proxy( {}, { ownKeys() { throw new Error( 'PRIVATE' ); } } );
		const api = { postWithToken: jest.fn().mockResolvedValue( hostile ) }, client = new Client( api );
		await expect( client.check( request(), 'Owner' ) ).rejects.toMatchObject( {
			code: 'layers-publication-outcome-unknown', message: 'layers-publication-outcome-unknown'
		} );
		api.postWithToken.mockRejectedValue( new Error( 'transport private' ) );
		await expect( client.check( request(), 'Owner' ) ).rejects.toMatchObject( {
			code: 'layers-publication-outcome-unknown', message: 'layers-publication-outcome-unknown'
		} );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 2 );
		expect( api.postWithToken.mock.calls.every( call =>
			call[ 1 ].action === 'layersmissingpdfimportoutcome' ) ).toBe( true );
	} );
} );
