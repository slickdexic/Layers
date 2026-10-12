'use strict';

const PageOwnedPublishClient = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );

describe( 'explicit working-copy Import publication transport', () => {
    const descriptor = () => ( { sourcePageId: 9, sourceRevisionId: 42,
        sourceSurfaceId: 'source', targetSurfaceId: 'target' } );
    const options = () => ( { owner: 'Target Page', pageId: 7, baseRevisionId: 12,
        snapshotJson: '{"schemaVersion":1,"surfaces":[]}', summary: 'Owner note 世界',
        importSources: [ descriptor() ] } );
    let api, client;
    beforeEach( () => {
        api = { postWithToken: jest.fn().mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } ) };
        client = new PageOwnedPublishClient( api );
    } );

    test( 'captures exact source identities and the complete original request before asynchronous completion', async () => {
        const input = options();
        const pending = client.publish( input );
        input.importSources[ 0 ].sourcePageId = 100;
        input.importSources.push( descriptor() );
        input.summary = 'Later note';
        input.snapshotJson = 'later';
        expect( api.postWithToken ).toHaveBeenCalledWith( 'csrf', {
            action: 'layerspublish', owner: 'Target Page', pageid: 7, baserevid: 12,
            data: '{"schemaVersion":1,"surfaces":[]}', summary: 'Owner note 世界',
            importsources: JSON.stringify( [ descriptor() ] )
        } );
        await expect( pending ).resolves.toEqual( { revisionId: 13 } );
        expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
    } );

    test( 'omission preserves the original request shape and ordinary simultaneous text publication', async () => {
        const input = options();
        delete input.importSources;
        input.mainText = '';
        await client.publish( input );
        expect( api.postWithToken.mock.calls[ 0 ][ 1 ] ).toEqual( {
            action: 'layerspublish', owner: 'Target Page', pageid: 7, baserevid: 12,
            data: input.snapshotJson, summary: input.summary, maintext: ''
        } );
    } );

    test.each( [ null, [], {}, '[]', [ null ], [ [] ], [ {} ], new Array( 1 ),
        Array.from( { length: 33 }, descriptor ) ] )( 'rejects malformed source list %# before transport', async ( value ) => {
        await expect( client.publish( { ...options(), importSources: value } ) ).rejects.toMatchObject( {
            code: 'layers-invalid-publication-request'
        } );
        expect( api.postWithToken ).not.toHaveBeenCalled();
    } );

    test.each( [ [ 'sourcePageId', 0 ], [ 'sourcePageId', '9' ], [ 'sourcePageId', NaN ],
        [ 'sourceRevisionId', 2147483648 ], [ 'sourceRevisionId', 1.5 ],
        [ 'sourceSurfaceId', '' ], [ 'sourceSurfaceId', 'x'.repeat( 81 ) ],
        [ 'sourceSurfaceId', 'Wrong name' ], [ 'sourceSurfaceId', 'source\n' ],
        [ 'targetSurfaceId', 'target\r\n' ], [ 'targetSurfaceId', null ], [ 'extra', 'No authority' ] ] )(
        'rejects invalid literal descriptor %s = %s', async ( name, value ) => {
            await expect( client.publish( { ...options(), importSources: [ { ...descriptor(), [ name ]: value } ] } ) )
                .rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
            expect( api.postWithToken ).not.toHaveBeenCalled();
        }
    );

    test.each( [ { pageId: undefined }, { baseRevisionId: 0 }, { mainText: '' }, { mainText: 'Text' } ] )(
        'refuses unbound targets and simultaneous main-text changes %#', async ( overrides ) => {
            await expect( client.publish( { ...options(), ...overrides } ) )
                .rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
            expect( api.postWithToken ).not.toHaveBeenCalled();
        }
    );

    test( 'does not invoke descriptor accessors or serialize client-controlled methods', async () => {
        const value = descriptor(), getter = jest.fn( () => 9 );
        Object.defineProperty( value, 'sourcePageId', { get: getter, enumerable: true } );
        await expect( client.publish( { ...options(), importSources: [ value ] } ) )
            .rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
        expect( getter ).not.toHaveBeenCalled();
        const second = descriptor(), toJSON = jest.fn( () => descriptor() );
        second.toJSON = toJSON;
        await expect( client.publish( { ...options(), importSources: [ second ] } ) )
            .rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
        expect( toJSON ).not.toHaveBeenCalled();
        expect( api.postWithToken ).not.toHaveBeenCalled();
    } );

    test( 'accepts the exact bounded maximum and ordinary null-prototype descriptor data', async () => {
        const value = Object.assign( Object.create( null ), descriptor() );
        await client.publish( { ...options(), mainText: null, importSources: Array.from( { length: 32 }, () => value ) } );
        expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ) ).toHaveLength( 32 );
    } );

    test( 'maps a confirmed native Import refusal safely without retaining source or trace text', async () => {
        api.postWithToken.mockReturnValue( { then: ( resolve, reject ) => reject(
            'layers-working-copy-import-unavailable', { error: {
                code: 'layers-working-copy-import-unavailable', info: 'PRIVATE source details', trace: 'PRIVATE'
            } }
        ) } );
        const error = await client.publish( options() ).catch( ( value ) => value );
        expect( error.code ).toBe( 'layers-working-copy-import-unavailable' );
        expect( error.message ).toBe( 'Publication failed: layers-working-copy-import-unavailable' );
        expect( JSON.stringify( error ) + error.stack ).not.toContain( 'PRIVATE' );
        expect( error.info ).toBeUndefined();
        expect( error.trace ).toBeUndefined();
        expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
    } );

    test.each( [ new Error( 'PRIVATE transport failure' ), { layerspublish: { result: 'Success' } },
        { error: { code: 'unknown-import-error', info: 'PRIVATE' } } ] )(
        'uncertain publication outcomes remain uncertain and are never automatically retried %#', async ( response ) => {
            if ( response instanceof Error ) {
                api.postWithToken.mockRejectedValue( response );
            } else {
                api.postWithToken.mockResolvedValue( response );
            }
            await expect( client.publish( options() ) ).rejects.toMatchObject( {
                code: 'layers-publication-outcome-unknown', message: 'Publication outcome is unknown'
            } );
            expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
        }
    );
} );
