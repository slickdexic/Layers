'use strict';
const { creationContext, clone, CreationClient } = require( './fixtures/creationImportContext.js' );
const rows = [];
async function setup() { const c = await creationContext( 'image', true ); rows.push( c ); return c; }
const readOptions = () => ( { targetPageId: 7, targetBaseRevisionId: 12, targetSurfaceId: 'target', sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' } );
const publishOptions = () => ( { pageId: 7, baseRevisionId: 12, surfaceId: 'target', snapshotJson: '{"schemaVersion":1,"surfaces":[]}', summary: 'Editor note 世界',
    importSources: [ { sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source', targetSurfaceId: 'target' } ] } );
describe( 'native creation Import transport', () => {
    afterEach( () => { rows.splice( 0 ).forEach( c => c.dispose() ); } );
    test( 'POST read carries exact byte selection, separates absent member and retains complete unknown/rendition data', async () => {
        const c = await setup(), client = new CreationClient( c.api, c.selection );
        const native = c.response(); native.layersworkingcopyimportcreationread.sourceBundle.extra = { unknown: null, older: false, values: [ 0, '', '世界' ] };
        c.hooks.response = () => native;
        const input = readOptions(), pending = client.read( input ); input.sourcePageId = 99; const result = await pending;
        expect( c.api.post ).toHaveBeenLastCalledWith( { action: 'layersworkingcopyimportcreationread', formatversion: 2, targetpageid: 7, baserevid: 12, targetsurface: 'target',
            embedstart: c.selection.start, embedtext: c.selection.expected, sourcepageid: 9, sourcerevid: 42, sourcesurface: 'source', exacttext: true } );
        expect( result ).toEqual( native.layersworkingcopyimportcreationread ); expect( result ).not.toHaveProperty( 'targetBundle' );
        result.sourceBundle.extra.values.push( 'changed detached result' ); expect( native.layersworkingcopyimportcreationread.sourceBundle.extra.values ).toHaveLength( 3 );
    } );
    test( 'a no-slot admission retains explicit null instead of a fabricated stored member', async () => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ); c.hooks.response = data => {
            data.layersworkingcopyimportcreationread.creation.hasLayersSlot = false; data.layersworkingcopyimportcreationread.creation.baseBundle = null; return data;
        };
        expect( ( await client.read( readOptions() ) ).creation.baseBundle ).toBeNull();
    } );
    test.each( [ 0, -1, 1.5, 2147483648, '7', null ] )( 'invalid native ID %s is refused before transport', async value => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ); c.api.post.mockClear();
        await expect( client.read( { ...readOptions(), targetPageId: value } ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } ); expect( c.api.post ).not.toHaveBeenCalled();
    } );
    test.each( [ 'target', 'source', 'revision', 'selector', 'slot', 'stored', 'kind', 'member', 'file', 'error' ] )( 'malformed %s response refuses without repairing data', async boundary => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ); c.hooks.response = data => {
            const result = data.layersworkingcopyimportcreationread;
            if ( boundary === 'target' ) { result.creation.target.pageId++; }
            if ( boundary === 'source' ) { result.source.surfaceId = 'different'; }
            if ( boundary === 'revision' ) { result.sourceBundle.revisionId++; }
            if ( boundary === 'selector' ) { result.creation.selection.start++; }
            if ( boundary === 'slot' ) { result.creation.hasLayersSlot = false; }
            if ( boundary === 'stored' ) { result.creation.baseBundle.snapshot.surfaces.push( clone( result.creation.newSurface ) ); }
            if ( boundary === 'kind' ) { result.creation.newSurface.kind = 'pdf'; }
            if ( boundary === 'member' ) { result.sourceBundle.snapshot.surfaces.push( clone( result.sourceBundle.snapshot.surfaces[ 0 ] ) ); }
            if ( boundary === 'file' ) { result.sourceBundle.snapshot.surfaces[ 0 ].source.fileTitle = 'File:Other.png'; }
            if ( boundary === 'error' ) { data.error = { code: 'hidden', info: 'private server diagnostic' }; }
            return data;
        };
        await expect( client.read( readOptions() ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
    } );
    test( 'escaped Unicode selection is preserved and member identity sizes are measured in UTF-8', async () => {
        const c = await setup(), selection = { start: 12, expected: '[[File:Exact.png|layerset=Same|世界]]' }, client = new CreationClient( c.api, selection );
        c.hooks.response = data => { data.layersworkingcopyimportcreationread.creation.selection = { expected: selection.expected, start: selection.start }; return data; };
        await client.read( readOptions() ); expect( c.api.post.mock.calls.at( -1 )[ 0 ].embedtext ).toBe( selection.expected ); c.api.post.mockClear();
        await expect( client.read( { ...readOptions(), sourceSurfaceId: '界'.repeat( 43 ) } ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } ); expect( c.api.post ).not.toHaveBeenCalled();
    } );
    test( 'accessor-bearing identities are refused without invoking the accessor', async () => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ), input = readOptions(), getter = jest.fn( () => 7 );
        Object.defineProperty( input, 'targetPageId', { get: getter, enumerable: true } ); c.api.post.mockClear();
        await expect( client.read( input ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } ); expect( getter ).not.toHaveBeenCalled(); expect( c.api.post ).not.toHaveBeenCalled();
    } );
    test( 'first Save captures complete proposal and strictly scoped source list once', async () => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ), input = publishOptions();
        const pending = client.publish( input ); input.snapshotJson = 'changed'; input.importSources[ 0 ].sourcePageId = 100;
        await expect( pending ).resolves.toEqual( { revisionId: 13 } ); expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
        const [ token, params ] = c.api.postWithToken.mock.calls[ 0 ]; expect( token ).toBe( 'csrf' ); expect( params.action ).toBe( 'layersworkingcopyimportcreationpublish' );
        expect( params.data ).toBe( publishOptions().snapshotJson ); expect( JSON.parse( params.importsources ) ).toEqual( [ { sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' } ] ); expect( params ).not.toHaveProperty( 'maintext' );
    } );
    test.each( [ 'wrong-target', 'same-owner', 'zero-source', 'extra', 'empty', 'too-many', 'maintext', 'oversized', 'summary' ] )( '%s publication refuses before POST', async boundary => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ), input = publishOptions();
        if ( boundary === 'wrong-target' ) { input.importSources[ 0 ].targetSurfaceId = 'other'; }
        if ( boundary === 'same-owner' ) { input.importSources[ 0 ].sourcePageId = 7; }
        if ( boundary === 'zero-source' ) { input.importSources[ 0 ].sourceRevisionId = 0; }
        if ( boundary === 'extra' ) { input.importSources[ 0 ].permission = true; }
        if ( boundary === 'empty' ) { input.importSources = []; }
        if ( boundary === 'too-many' ) { input.importSources = Array( 33 ).fill( input.importSources[ 0 ] ); }
        if ( boundary === 'maintext' ) { input.mainText = ''; }
        if ( boundary === 'oversized' ) { input.snapshotJson = '界'.repeat( 699051 ); }
        if ( boundary === 'summary' ) { input.summary = 'a'.repeat( 501 ); }
        await expect( client.publish( input ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
    } );
    test.each( [ 'badtoken', 'ratelimited', 'layers-edit-conflict', 'unrecognized-private-code' ] )( 'native %s rejection never retries or leaks server text', async code => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ); c.api.postWithToken.mockImplementation( () => ( { then: ( resolve, reject ) => reject( code, { error: { code, info: 'Private server detail' } } ) } ) );
        await expect( client.publish( publishOptions() ) ).rejects.toMatchObject( { code: code === 'unrecognized-private-code' ? 'layers-publication-outcome-unknown' : code } ); expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
    } );
    test.each( [ null, {}, { result: 'Success', revid: 12 }, { result: 'Success', revid: 2147483648 } ] )( 'unconfirmed response %j preserves uncertain outcome', async response => {
        const c = await setup(), client = new CreationClient( c.api, c.selection ); c.api.postWithToken.mockResolvedValue( { layersworkingcopyimportcreationpublish: response } );
        await expect( client.publish( publishOptions() ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } ); expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
    } );
} );
