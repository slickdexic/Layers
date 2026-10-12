'use strict';
const { creationContext, clone, tick, choose, Controller, Store, Lifecycle } = require( './fixtures/creationImportContext.js' );
const { History } = require( './fixtures/workingCopyImportContext.js' );
const contexts = [];
async function setup( ...args ) { const c = await creationContext( ...args ); contexts.push( c ); return c; }
describe( 'native creation Import editor composition', () => {
    afterEach( () => { contexts.splice( 0 ).forEach( c => c.dispose() ); } );
    test.each( [ [ 'slide', false ], [ 'slide', true ], [ 'image', false ], [ 'image', true ] ] )( '%s absent member with siblings=%s stays separate until one native Save', async ( kind, siblings ) => {
        const c = await setup( kind, siblings ); const saved = c.session._savedJson;
        expect( c.history.lastSaveHistoryIndex ).toBe( -1 ); await choose( c );
        expect( c.integration.control.dialog ).toBeNull(); expect( c.store.state.layers ).toHaveLength( 3 );
        expect( c.session._savedJson ).toBe( saved ); expect( JSON.parse( saved ).surfaces.some( s => s.id === 'target' ) ).toBe( false );
        expect( c.api.postWithToken ).not.toHaveBeenCalled(); expect( c.history.undo() ).toBe( true );
        expect( c.store.state.layers ).toEqual( [] ); expect( c.history.lastSaveHistoryIndex ).toBe( -1 ); expect( c.history.redo() ).toBe( true );
        await c.drafts.save(); expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
        const [ token, posted ] = c.api.postWithToken.mock.calls[ 0 ]; expect( token ).toBe( 'csrf' );
        expect( posted.action ).toBe( 'layersworkingcopyimportcreationpublish' ); expect( posted.embedtext ).toBe( c.selection.expected );
        expect( JSON.parse( posted.importsources ) ).toEqual( [ { sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source' } ] );
        const proposal = JSON.parse( posted.data ); expect( proposal.surfaces.filter( s => s.id !== 'target' ) ).toEqual( c.base.surfaces );
        const selected = proposal.surfaces.find( s => s.id === 'target' );
        if ( kind === 'image' ) { expect( selected.source ).toEqual( c.added.source ); } else { expect( selected.canvas ).toEqual( c.bundle.snapshot.surfaces[ 0 ].canvas ); }
        expect( c.session.getStatus().revisionId ).toBe( 13 ); expect( c.session._newSurface ).toBeNull(); expect( c.session.hasCreationImport() ).toBe( false );
        expect( c.session.getStatus().dirty ).toBe( false );
    } );
    test( 'after successful first Save the same editor uses the existing stored read/publication path', async () => {
        const c = await setup(); await choose( c ); await c.drafts.save();
        const reads = c.api.post.mock.calls.length; await choose( c );
        c.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
        expect( c.api.post.mock.calls.length ).toBe( reads ); expect( c.api.get.mock.calls.some( ( [ p ] ) => p.action === 'layersworkingcopyimportread' && p.baserevid === 13 ) ).toBe( true );
        c.publisher.publish.mockResolvedValue( { revisionId: 14 } ); await c.drafts.save();
        expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 ); expect( c.publisher.publish ).toHaveBeenCalledTimes( 1 );
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources[ 0 ].targetSurfaceId ).toBe( 'target' );
    } );
    test.each( [ 'layers-edit-conflict', 'badtoken', 'layers-publication-outcome-unknown' ] )( '%s refusal preserves imported work, claims and offscreen members', async code => {
        const c = await setup( 'image', true ); await choose( c );
        const draft = clone( c.session.getDraft() ), timeline = clone( c.history.history ), marker = c.history.lastSaveHistoryIndex;
        c.api.postWithToken.mockRejectedValue( { error: { code, info: 'private diagnostic' } } ); await expect( c.drafts.save() ).rejects.toMatchObject( { code } );
        expect( c.session.getDraft().snapshot ).toEqual( draft.snapshot ); expect( c.session._savedJson ).toBe( JSON.stringify( c.base ) );
        expect( c.history.history ).toEqual( timeline ); expect( c.history.lastSaveHistoryIndex ).toBe( marker );
        expect( c.session.captureWorkingCopyImportProvenance() ).toHaveLength( 1 ); expect( c.session._newSurface ).toEqual( c.added );
        expect( c.api.postWithToken ).toHaveBeenCalledTimes( 1 );
    } );
    test.each( [ 'base', 'pin', 'owner', 'selector' ] )( 'changed native %s refuses before editor/history mutation', async boundary => {
        const c = await setup( 'image', true ), before = clone( c.session.getDraft() ), history = clone( c.history.history );
        c.hooks.response = data => {
            const creation = data.layersworkingcopyimportcreationread.creation;
            if ( boundary === 'base' ) { creation.baseBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'changed sibling'; }
            if ( boundary === 'pin' ) { creation.newSurface.source.sha1 = 'new pin'; }
            if ( boundary === 'owner' ) { creation.target.owner = 'Other'; }
            if ( boundary === 'selector' ) { creation.selection.expected = '{{#Slide:Other}}'; }
            return data;
        };
        await choose( c ); expect( c.session.getDraft() ).toEqual( before ); expect( c.history.history ).toEqual( history ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
    } );
    test( 'late native read cannot overwrite a newer editor edit', async () => {
        const c = await setup(); let finish; c.hooks.read = () => new Promise( resolve => { finish = resolve; } );
        c.integration.control.open(); await tick(); c.integration.control.dialog.list.querySelector( 'button' ).click(); await tick();
        c.store.set( 'layers', [ { id: 'later', type: 'text', text: 'keep' } ] ); const layers = clone( c.store.state.layers ), history = clone( c.history.history );
        finish(); await tick(); expect( c.store.state.layers ).toEqual( layers ); expect( c.history.history ).toEqual( history ); expect( c.api.postWithToken ).not.toHaveBeenCalled();
    } );
    test.each( [ 'slide', 'image' ] )( '%s independent-session recovery retains Import, Undo and first-Save citations', async kind => {
        const c = await setup( kind, true ); await choose( c ); const savedRecords = clone( Array.from( c.records ) );
        const fresh = await setup( kind, true, '22222222222222222222222222222222' ); fresh.drafts.dispose(); fresh.records.clear();
        savedRecords.forEach( ( [ key, value ] ) => fresh.records.set( key, value ) );
        const controller = new Controller( fresh.bridge, new Store( fresh.storage, '33333333333333333333333333333333' ), fresh.adapter, { wiki: 'wiki', user: 'user' } ); fresh.integration.enableDrafts( controller );
        const lifecycle = new Lifecycle( fresh.bridge, controller, { confirmRecovery: async () => true, chooseDraft: async () => 0, notifyFailure: jest.fn(), notifyBlocked: jest.fn() } );
        try { await lifecycle.initialize(); expect( fresh.store.state.layers ).toHaveLength( 3 );
            expect( fresh.history.undo() ).toBe( true ); expect( fresh.store.state.layers ).toEqual( [] ); expect( fresh.history.redo() ).toBe( true );
            await lifecycle.save(); expect( JSON.parse( fresh.api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ) ).toHaveLength( 1 );
            savedRecords.forEach( ( [ key, value ] ) => expect( fresh.records.get( key ) ).toBe( value ) );
        } finally { lifecycle.dispose(); }
    } );
    test( 'a newer edit arriving during first Save remains dirty after only the captured work is acknowledged', async () => {
        const c = await setup(); await choose( c ); let finish; c.hooks.publish = () => new Promise( resolve => { finish = resolve; } );
        const pending = c.drafts.save(); await tick(); c.store.set( 'layers', c.store.state.layers.concat( { id: 'later', type: 'text', text: 'newer work' } ) ); finish(); await pending;
        expect( c.store.state.layers.some( layer => layer.id === 'later' ) ).toBe( true ); expect( c.session.getStatus().dirty ).toBe( true );
        expect( JSON.parse( c.api.postWithToken.mock.calls[ 0 ][ 1 ].data ).surfaces.find( s => s.id === 'target' ).layers.some( layer => layer.id === 'later' ) ).toBe( false );
    } );
    test.each( [ 'image', 'slide' ] )( 'actual APIManager loads missing %s Import and preserves existing Copy', async kind => {
        const c = await setup( kind, true ); c.integration.dispose(); c.drafts.dispose(); c.bridge.dispose(); c.history.destroy();
        c.editor.historyManager = new History( { editor: c.editor, maxHistorySteps: 60 } ); c.editor.hasUnsavedChanges = () => false;
        c.editor.config.pageOwned.draftScope = { wiki: 'test', user: '1' };
        const container = document.createElement( 'div' ), header = document.createElement( 'div' ), right = document.createElement( 'div' );
        header.className = 'layers-header'; right.className = 'layers-header-right'; header.appendChild( right ); container.appendChild( header ); document.body.appendChild( container );
        c.editor.uiManager = { container }; const nativeGet = c.api.get;
        c.api.get = jest.fn( async params => params.action === 'layersread' ? { layersread: { revisionId: 12, snapshot: clone( c.base ), sourceGeometry: [] } } : nativeGet( params ) );
        const priorStorage = window.localStorage, records = new Map();
        window.localStorage = { getItem: key => records.get( key ) ?? null, setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
            key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
        mw.Api = jest.fn( () => c.api ); mw.msg = key => require( '../../i18n/en.json' )[ key ]; mw.notify = jest.fn();
        window.Layers.Editor.APIErrorHandler = class { setEnableSaveButtonCallback() {} destroy() {} }; window.Layers.Editor.ExportController = class {};
        for ( const file of [ 'PageOwnedReadClient', 'PageOwnedPublishClient', 'PageOwnedRecoveryDialog', 'PageOwnedRevisionControl', 'PageOwnedCopyPicker', 'APIManager' ] ) { require( '../../resources/ext.layers.editor/' + file + '.js' ); }
        const manager = new window.Layers.Core.APIManager( c.editor );
        try { await manager.loadLayers(); expect( header.querySelector( '.layers-page-import-button' ) ).not.toBeNull(); expect( header.querySelector( '.layers-page-drawing-copy' ) ).not.toBeNull();
            manager.pageOwnedImport.control.open(); await tick(); manager.pageOwnedImport.control.dialog.list.querySelector( 'button' ).click(); await tick();
            expect( manager.pageOwnedImport.control.dialog ).toBeNull(); expect( c.api.postWithToken ).not.toHaveBeenCalled();
            expect( c.editor.historyManager.undo() ).toBe( true ); expect( c.store.state.layers ).toEqual( [] ); expect( c.editor.historyManager.redo() ).toBe( true );
            await manager.saveLayers(); expect( c.api.postWithToken.mock.calls[ 0 ][ 1 ].action ).toBe( 'layersworkingcopyimportcreationpublish' );
        } finally { manager.destroy(); container.remove(); window.localStorage = priorStorage; }
        expect( header.querySelector( '.layers-page-import-button' ) ).toBeNull();
    } );
} );
