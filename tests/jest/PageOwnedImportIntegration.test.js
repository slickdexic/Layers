'use strict';
const { context, clone, History } = require( './fixtures/workingCopyImportContext.js' );
const Integration = require( '../../resources/ext.layers.editor/PageOwnedImportIntegration.js' );
require( '../../resources/ext.layers.editor/PageOwnedImportControl.js' );
require( '../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCatalogClient.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const en = require( '../../i18n/en.json' );
const msg = ( key, ...args ) => en[ key ].replace( /\$(\d+)/g, ( _, n ) => String( args[ n - 1 ] ) );
const tick = async () => { for ( let i = 0; i < 80; i++ ) { await Promise.resolve(); } };
const instances = [];
async function setup( kind = 'slide', populated = false ) {
    const c = await context( kind, populated ), nativeGet = c.api.get;
    c.api.get = jest.fn( async params => params.action === 'layersdrawings' ? { layersdrawings: { pages: [ {
        title: 'Source Page', owner: 'Source Page', pageid: 9, revid: 42, drawings: [ {
            id: 'source', kind, label: 'Same', canvas: { width: 200, height: 120 }, fileTitle: kind === 'image' ? 'File:Exact.png' : null } ] } ] } } : nativeGet( params ) );
    const integration = new Integration( c.bridge, c.api, window.Layers.Editor ), records = new Map();
    const storage = { getItem: key => records.get( key ) ?? null, setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
        key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
    const controller = new Controller( c.bridge, new Store( storage, '11111111111111111111111111111111' ), c.adapter, { wiki: 'wiki', user: 'user' } ); integration.enableDrafts( controller );
    const drafts = new Lifecycle( c.bridge, controller, { notifyFailure: jest.fn(), notifyBlocked: jest.fn() } ); await drafts.initialize();
    const header = document.createElement( 'div' ); document.body.appendChild( header );
    integration.mount( header, null, drafts, c.options().allocateId, 100, msg ); instances.push( { integration, drafts, header, c } );
    return { ...c, integration, drafts, controller, records, storage, header };
}
async function choose( c ) { c.integration.control.open(); await tick(); c.integration.control.dialog.list.querySelector( 'button' ).click(); await tick(); }
describe( 'actual editor Import composition', () => {
    afterEach( () => { for ( const row of instances.splice( 0 ) ) { row.integration.dispose(); row.drafts.dispose(); row.c.bridge.dispose(); row.header.remove(); } } );
    test.each( [ 'slide', 'image' ] )( 'empty %s Import is local, one-step undoable and its first Save cites native source', async kind => {
        const c = await setup( kind ); await choose( c ); expect( c.integration.control.dialog ).toBeNull();
        expect( c.store.state.layers ).toHaveLength( 3 ); expect( c.publisher.publish ).not.toHaveBeenCalled();
        expect( c.history.undo() ).toBe( true ); expect( c.store.state.layers ).toEqual( [] ); expect( c.history.redo() ).toBe( true );
        expect( c.records.size ).toBe( 1 ); expect( JSON.parse( Array.from( c.records.values() )[ 0 ] ).workingCopyDraft.version ).toBe( 2 );
        c.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await c.drafts.save();
        expect( c.publisher.publish.mock.calls[ 0 ][ 0 ].importSources ).toEqual( [ {
            sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source', targetSurfaceId: 'target' } ] );
        const saved = JSON.parse( c.publisher.publish.mock.calls[ 0 ][ 0 ].snapshotJson );
        expect( saved.surfaces[ 1 ] ).toEqual( c.base.surfaces[ 1 ] );
        if ( kind === 'image' ) { expect( saved.surfaces[ 0 ].source ).toEqual( c.base.surfaces[ 0 ].source ); }
        else { expect( saved.surfaces[ 0 ].canvas ).toEqual( c.bundle.snapshot.surfaces[ 0 ].canvas ); }
    } );
    test.each( [ 'append', 'replace' ] )( '%s preserves populated slide canvas, groups, reading order and full Undo', async mode => {
        const c = await setup( 'slide', true ), before = clone( c.session.getDraft().snapshot ); await choose( c );
        c.integration.control.dialog.decision.querySelector( '.layers-page-import-' + mode ).click(); await tick();
        expect( c.integration.control.dialog ).toBeNull(); expect( c.store.state.layers ).toHaveLength( mode === 'append' ? 4 : 3 );
        expect( c.session.getDraft().snapshot.surfaces[ 0 ].canvas ).toEqual( before.surfaces[ 0 ].canvas );
        expect( c.store.state.layers[ 0 ].children ).toEqual( c.store.state.layers.slice( 1, 3 ).map( layer => layer.id ) );
        expect( c.history.undo() ).toBe( true ); expect( c.session.getDraft().snapshot ).toEqual( before );
        expect( c.history.redo() ).toBe( true ); expect( c.publisher.publish ).not.toHaveBeenCalled();
    } );
    test( 'Cancel/Escape leaves every existing member and real Undo entry exact', async () => {
        const c = await setup( 'image', true ), before = clone( c.session.getDraft() ), timeline = clone( c.history.history ); await choose( c );
        document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true, cancelable: true } ) );
        expect( c.session.getDraft() ).toEqual( before ); expect( c.history.history ).toEqual( timeline ); expect( c.publisher.publish ).not.toHaveBeenCalled();
    } );
    test( 'a revoked native source refuses application while preserving real data and history', async () => {
        const c = await setup( 'image', true ), before = clone( c.session.getDraft() ), timeline = clone( c.history.history ); await choose( c );
        c.hooks.native = () => { throw Object.assign( new Error( 'hidden' ), { code: 'layers-working-copy-import-unavailable' } ); };
        c.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
        expect( c.session.getDraft() ).toEqual( before ); expect( c.history.history ).toEqual( timeline );
        expect( c.integration.control.dialog.status.textContent ).toBe( en[ 'layers-page-import-failed' ] );
    } );
    test( 'disposing the editor composition during a native apply read prevents late mutation', async () => {
        const c = await setup( 'image', true ); await choose( c ); const before = clone( c.session.getDraft() ); let finish;
        c.hooks.native = () => new Promise( resolve => { finish = resolve; } );
        c.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
        c.integration.dispose(); finish(); await tick(); expect( c.session.getDraft() ).toEqual( before );
        expect( document.querySelector( '.layers-page-import-overlay' ) ).toBeNull(); expect( c.publisher.publish ).not.toHaveBeenCalled();
    } );
    test( 'matching search uses the native base name even when the working name has changed', async () => {
        const c = await setup(); c.session.rename( 'Edited name' ); c.integration.control.open(); await tick();
        expect( c.integration.control.dialog.list.textContent ).toContain( 'Same on Source Page' );
        expect( c.integration._target().match.label ).toBe( 'Same' ); expect( c.integration._target().name ).toBe( 'Edited name' );
    } );
    test( 'the real picker draft recovers complete Import history and source citations in another editor', async () => {
        const c = await setup( 'image', true ); await choose( c );
        c.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
        const original = Array.from( c.records.entries() ); const fresh = await setup( 'image', true ); fresh.drafts.dispose(); fresh.records.clear();
        for ( const [ key, value ] of original ) { fresh.records.set( key, value ); }
        const controller = new Controller( fresh.bridge, new Store( fresh.storage, '22222222222222222222222222222222' ), fresh.adapter, { wiki: 'wiki', user: 'user' } );
        fresh.integration.enableDrafts( controller );
        const lifecycle = new Lifecycle( fresh.bridge, controller, { confirmRecovery: async () => true, chooseDraft: async () => 0, notifyBlocked: jest.fn(), notifyFailure: jest.fn() } );
        await lifecycle.initialize(); expect( fresh.store.state.layers ).toHaveLength( 4 );
        expect( fresh.history.undo() ).toBe( true ); expect( fresh.store.state.layers ).toHaveLength( 1 ); expect( fresh.history.redo() ).toBe( true );
        fresh.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await lifecycle.save();
        expect( fresh.publisher.publish.mock.calls[ 0 ][ 0 ].importSources[ 0 ].sourcePageId ).toBe( 9 );
        for ( const [ key, value ] of original ) { expect( fresh.records.get( key ) ).toBe( value ); }
        lifecycle.dispose();
    } );
    test.each( [ 'readOnly', 'new', 'pdf', 'unbound' ] )( 'unsupported %s targets retain the existing editor path', async reason => {
        const c = await setup();
        if ( reason === 'readOnly' ) { c.session._readOnly = true; } if ( reason === 'new' ) { c.session._newSurface = {}; }
        if ( reason === 'pdf' ) { c.bridge.pdfCoordinator = {}; } if ( reason === 'unbound' ) { c.session._pageId = 0; }
        expect( Integration.supports( c.bridge ) ).toBe( false ); if ( reason === 'pdf' ) { delete c.bridge.pdfCoordinator; }
        if ( reason === 'new' ) { c.session._newSurface = null; } if ( reason === 'readOnly' ) { c.session._readOnly = false; } if ( reason === 'unbound' ) { c.session._pageId = 7; }
    } );

    test( 'ResourceLoader contains every accepted Import class and fixed message', () => {
        const module = require( '../../extension.json' ).ResourceModules[ 'ext.layers.editor.pageOwned' ];
        for ( const name of [ 'PageOwnedWorkingCopyImportPlan', 'PageOwnedWorkingCopyImportSource', 'PageOwnedWorkingCopyImportReadClient',
            'PageOwnedWorkingCopyImportCoordinator', 'PageOwnedWorkingCopyImportCatalogClient', 'PageOwnedImportControl', 'PageOwnedImportIntegration' ] ) {
            expect( module.scripts ).toContain( name + '.js' );
        }
        for ( const key of Object.keys( en ).filter( name => name.startsWith( 'layers-page-import-' ) ) ) { expect( module.messages ).toContain( key ); }
        expect( module.styles ).toContain( 'PageOwnedImportControl.css' );
    } );

    test( 'real APIManager load, Import and Save carry citations and preserve Copy before disposal', async () => {
        const c = await context( 'image', true ); c.history.destroy(); c.editor.historyManager = new History( { editor: c.editor } );
        c.editor.config.pageOwned = { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target', draftScope: { wiki: 'q', user: '1' } };
        c.editor.uiManager = { container: document.createElement( 'div' ) }; c.editor.hasUnsavedChanges = () => false;
        const header = document.createElement( 'div' ); header.className = 'layers-header'; const right = document.createElement( 'div' ); right.className = 'layers-header-right';
        header.appendChild( right ); c.editor.uiManager.container.appendChild( header ); document.body.appendChild( c.editor.uiManager.container );
        c.api.get.mockImplementation( async params => {
            if ( params.action === 'layersread' ) { return { layersread: { revisionId: 12, snapshot: c.base, sourceGeometry: {} } }; }
            if ( params.action === 'layersdrawings' ) { return { layersdrawings: { pages: [ { title: 'Source Page', owner: 'Source Page', pageid: 9, revid: 42,
                drawings: [ { id: 'source', label: 'Same', kind: 'image', canvas: { width: 200, height: 120 }, fileTitle: 'File:Exact.png' } ] } ] } }; }
            return { layersworkingcopyimportread: { target: { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' }, source: c.choice,
                targetBundle: { revisionId: 12, snapshot: c.base, sourceGeometry: [] }, sourceBundle: c.bundle } };
        } );
        c.api.postWithToken = jest.fn().mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } );
        mw.Api = jest.fn( () => c.api ); mw.msg = msg; mw.notify = jest.fn();
        const priorStorage = window.localStorage, nativeRecords = new Map();
        window.localStorage = { getItem: key => nativeRecords.get( key ) ?? null, setItem: ( key, value ) => nativeRecords.set( key, value ),
            removeItem: key => nativeRecords.delete( key ), key: index => Array.from( nativeRecords.keys() )[ index ] ?? null, get length() { return nativeRecords.size; } };
        window.Layers.Editor.APIErrorHandler = class { setEnableSaveButtonCallback() {} destroy() {} };
        window.Layers.Editor.ExportController = class {};
        require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' ); require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
        require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' ); require( '../../resources/ext.layers.editor/PageOwnedRevisionControl.js' );
        require( '../../resources/ext.layers.editor/PageOwnedCopyPicker.js' ); require( '../../resources/ext.layers.editor/APIManager.js' );
        const manager = new window.Layers.Core.APIManager( c.editor );
        try { await manager.loadLayers(); expect( header.querySelector( '.layers-page-import-button' ) ).not.toBeNull();
            expect( header.querySelector( '.layers-page-drawing-copy' ) ).not.toBeNull();
            expect( manager.pageOwnedBridge.session.hasWorkingCopyImportProvenance() ).toBe( true );
            expect( c.api.postWithToken ).not.toHaveBeenCalled();
            manager.pageOwnedImport.control.open(); await tick(); manager.pageOwnedImport.control.dialog.list.querySelector( 'button' ).click(); await tick();
            manager.pageOwnedImport.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
            expect( manager.pageOwnedImport.control.dialog ).toBeNull(); expect( c.api.postWithToken ).not.toHaveBeenCalled();
            expect( c.editor.historyManager.undo() ).toBe( true ); expect( c.store.state.layers ).toHaveLength( 1 );
            expect( c.editor.historyManager.redo() ).toBe( true ); await manager.saveLayers();
            const posted = c.api.postWithToken.mock.calls[ 0 ][ 1 ]; expect( posted.action ).toBe( 'layerspublish' );
            expect( JSON.parse( posted.importsources ) ).toEqual( [ { sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source', targetSurfaceId: 'target' } ] );
            expect( JSON.parse( posted.data ).surfaces[ 1 ] ).toEqual( c.base.surfaces[ 1 ] );
        } finally { manager.destroy(); c.editor.uiManager.container.remove(); c.bridge.dispose(); window.localStorage = priorStorage; }
        expect( header.querySelector( '.layers-page-import-button' ) ).toBeNull(); expect( header.querySelector( '.layers-page-drawing-copy' ) ).toBeNull();
    } );
} );
