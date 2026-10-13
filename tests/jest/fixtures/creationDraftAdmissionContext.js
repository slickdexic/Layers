'use strict';
const { context, clone, Session, Bridge, History } = require( './workingCopyImportContext.js' );
const CreationClient = require( process.env.LAYERS_CREATION_IMPORT_CLIENT_SOURCE || '../../../resources/ext.layers.editor/PageOwnedCreationImportClient.js' );
const Integration = require( '../../../resources/ext.layers.editor/PageOwnedImportIntegration.js' );
const CreationSession = process.env.LAYERS_CREATION_IMPORT_SESSION_SOURCE ? require( process.env.LAYERS_CREATION_IMPORT_SESSION_SOURCE ) : Session;
require( '../../../resources/ext.layers.editor/PageOwnedImportControl.js' );
require( '../../../resources/ext.layers.editor/PageOwnedWorkingCopyImportCatalogClient.js' );
const Controller = require( '../../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Lifecycle = require( '../../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const en = require( '../../../i18n/en.json' );
const msg = ( key, ...args ) => en[ key ].replace( /\$(\d+)/g, ( _, n ) => String( args[ n - 1 ] ) );
const tick = async () => { for ( let i = 0; i < 100; i++ ) { await Promise.resolve(); } };
async function creationContext( kind = 'slide', siblings = false, sessionId = '11111111111111111111111111111111' ) {
    const c = await context( kind ); c.bridge.dispose(); c.history.destroy();
    const added = clone( c.base.surfaces[ 0 ] );
    if ( kind === 'image' ) { added.source.repository = 'local'; }
    const base = siblings ? { ...clone( c.base ), surfaces: [ clone( c.base.surfaces[ 1 ] ) ] } : { schemaVersion: 1, surfaces: [] };
    if ( siblings ) { base.surfaces[ 0 ].label = 'Unrelated'; base.surfaces[ 0 ].source.fileTitle = 'File:Other.png'; }
    let nativeBase = clone( base ), revisionId = 12;
    const selection = { start: 7, expected: kind === 'slide' ? '{{#Slide:Same}}' : '[[File:Exact.png|layerset=Same]]' };
    const options = { owner: 'Target Page', pageId: 7, revisionId, surfaceId: 'target', newSurface: added, emptyBase: !siblings };
    c.editor.config.pageOwned = { ...options, creationSelection: selection };
    c.editor.historyManager = new History( { editor: c.editor, maxHistorySteps: 60 } );
    c.reader.read.mockImplementation( async () => ( { revisionId, snapshot: clone( nativeBase ) } ) );
    const session = new CreationSession( options, { reader: c.reader, publisher: c.publisher, adapter: c.adapter } ), bridge = new Bridge( c.editor, session );
    await bridge.load();
    const response = () => ( { layersworkingcopyimportcreationread: {
        creation: { target: { owner: 'Target Page', pageId: 7, revisionId: 12, surfaceId: 'target' }, selection: clone( selection ),
            hasLayersSlot: siblings, baseBundle: siblings ? { revisionId: 12, snapshot: clone( base ), sourceGeometry: [] } : null, newSurface: clone( added ) },
        source: clone( c.choice ), sourceBundle: clone( c.bundle ) } } );
    const hooks = { read: null, publish: null, response: null };
    const api = {
        post: jest.fn( async () => { if ( hooks.read ) { await hooks.read(); } return hooks.response ? hooks.response( response() ) : response(); } ),
        postWithToken: jest.fn( async ( token, params ) => { if ( hooks.publish ) { await hooks.publish(); } nativeBase = JSON.parse( params.data ); revisionId = 13; return { layersworkingcopyimportcreationpublish: { result: 'Success', revid: 13 } }; } ),
        get: jest.fn( async params => params.action === 'layersdrawings' ? { layersdrawings: { pages: [ {
            title: 'Source Page', owner: 'Source Page', pageid: 9, revid: 42, drawings: [ { id: 'source', kind, label: 'Same', canvas: { width: 200, height: 120 }, fileTitle: kind === 'image' ? 'File:Exact.png' : null } ] } ] } } :
            { layersworkingcopyimportread: { target: { owner: 'Target Page', pageId: 7, revisionId, surfaceId: 'target' }, source: clone( c.choice ),
                targetBundle: { revisionId, snapshot: clone( nativeBase ), sourceGeometry: [] }, sourceBundle: clone( c.bundle ) } } )
    };
    const integration = new Integration( bridge, api, window.Layers.Editor ), records = new Map();
    const storage = { getItem: key => records.get( key ) ?? null, setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
        key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
    const controller = new Controller( bridge, new Store( storage, sessionId ), c.adapter, { wiki: 'wiki', user: 'user' } ); integration.enableDrafts( controller );
    const drafts = new Lifecycle( bridge, controller, { notifyFailure: jest.fn(), notifyBlocked: jest.fn() } ); await drafts.initialize();
    const header = document.createElement( 'div' ); document.body.appendChild( header ); integration.mount( header, null, drafts, c.options().allocateId, 100, msg );
    const dispose = () => { integration.dispose(); drafts.dispose(); bridge.dispose(); c.editor.historyManager.destroy(); header.remove(); };
    return { ...c, session, bridge, history: c.editor.historyManager, api, hooks, selection, base, added, response, integration, controller, drafts, records, storage, header, dispose };
}
async function choose( c ) { c.integration.control.open(); await tick(); c.integration.control.dialog.list.querySelector( 'button' ).click(); await tick(); }
module.exports = { creationContext, clone, tick, choose, Controller, Store, Lifecycle, CreationClient };
