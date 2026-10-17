'use strict';
const { setup, preparation, copy } = require( './fixtures/pdfCreationHost.js' );
for ( const name of [ 'PageOwnedReadClient', 'PageOwnedPublishClient', 'PageOwnedSnapshotAdapter', 'PageOwnedPdfEditorReadClient',
	'PageOwnedPdfCreationReadClient', 'PageOwnedPdfCreationDraftController', 'PageOwnedPdfCreationLifecycle',
	'PageOwnedPdfCreationIntegration', 'PageOwnedDraftStore', 'PageOwnedDraftController', 'PageOwnedDraftLifecycle',
	'PageOwnedRecoveryDialog', 'PageOwnedRevisionControl', 'PageOwnedNameControl', 'PageOwnedSummaryField' ] ) {
	require( '../../resources/ext.layers.editor/' + name + '.js' );
}
window.Layers.Editor.APIErrorHandler = class { setEnableSaveButtonCallback() {} destroy() {} };
window.Layers.Editor.ExportController = class {};
require( '../../resources/ext.layers.editor/APIManager.js' );
require( '../../resources/ext.layers.editor/LayersEditor.js' );
const APIManager = window.Layers.Core.APIManager, Editor = window.Layers.Core.Editor;
function localStorage() {
	const records = new Map(); return { records, get length() { return records.size; }, key: i => Array.from( records.keys() )[ i ] || null,
		getItem: key => records.get( key ) ?? null, setItem: ( key, raw ) => records.set( key, raw ), removeItem: key => records.delete( key ) };
}
function make( slot = true, initial = 2, storage = localStorage() ) {
	const work = setup( slot, initial, initial, 2 ); work.host.dispose(); const editor = work.editor;
	window.localStorage = storage;
	const remote = { revisionId: 12, snapshot: work.native.baseBundle && work.native.baseBundle.snapshot };
	const context = page => {
		const value = preparation( slot, initial, page, 2 ).context; value.revisionId = remote.revisionId;
		const members = remote.snapshot.surfaces.slice( slot ? 2 : 0 );
		value.members = members.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) );
		const member = members.find( surface => surface.source.page === page ); value.stored = Boolean( member );
		if ( member ) value.surface = copy( member ); return value;
	};
	const api = { post: jest.fn( async options => ( { layerspdfcreationread: preparation( slot, initial, options.pdfpage, 2 ) } ) ),
		postWithToken: jest.fn( async ( token, options ) => {
			remote.snapshot = JSON.parse( options.data ); remote.revisionId = 13;
			return { layerspublish: { result: 'Success', revid: remote.revisionId } };
		} ), get: jest.fn( async options => options.action === 'query' ? { query: { pages: [ { pageid: 7, title: 'Owner', revisions: [ {
			revid: remote.revisionId, parentid: remote.revisionId - 1, slots: { main: { contentmodel: 'wikitext', content: work.native.mainText } }
		} ] } ] } } : { layersread: options.editorpage ? { editor: context( options.editorpage ) } :
			{ revisionId: remote.revisionId, snapshot: copy( remote.snapshot ), sourceGeometry: {} } } ) };
	mw.Api = jest.fn( () => api ); mw.msg = jest.fn( ( key, ...args ) => [ key, ...args ].join( '|' ) ); mw.notify = jest.fn();
	editor.config.pageOwned = { ...work.native.target, surfaceId: work.native.target.surfaceId, readOnly: false,
		pdfCreation: copy( work.native ), draftScope: { wiki: 'wiki', user: 'Editor' } };
	editor.uiManager = { container: document.createElement( 'div' ), showSpinner: jest.fn(), hideSpinner: jest.fn(), destroy: jest.fn(), showPromptDialog: jest.fn() };
	editor.uiManager.container.innerHTML = '<div class="layers-header"><div class="layers-header-right"></div></div>';
	editor.hasUnsavedChanges = Editor.prototype.hasUnsavedChanges.bind( editor );
	editor.unsavedPages = Editor.prototype.unsavedPages.bind( editor );
	editor.unsavedChangesMessage = Editor.prototype.unsavedChangesMessage.bind( editor );
	editor.save = Editor.prototype.save.bind( editor ); editor.saveCurrentPage = Editor.prototype.saveCurrentPage.bind( editor );
	editor.getMessage = ( key, fallback ) => fallback; editor.navigateBackToFileWithName = jest.fn();
	editor.apiManager = new APIManager( editor );
	return { ...work, api, remote, storage, manager: editor.apiManager, context,
		close() { editor.apiManager.destroy(); work.close(); } };
}

const Toolbar = require( '../../resources/ext.layers.editor/Toolbar.js' );
function presented() {
 const work = make(), editor = work.editor, container = document.createElement( 'div' );
 container.innerHTML = '<div role="group"><button></button><span></span><button></button></div>';
 document.body.appendChild( container );
 const group = container.firstChild;
 editor.toolbar = { container, editor, msg: ( key, fallback ) => fallback,
  pageNavEls: { group, prev: group.children[ 0 ], label: group.children[ 1 ], next: group.children[ 2 ] },
  updatePageNavState: Toolbar.prototype.updatePageNavState };
 editor.refreshPageControls = Editor.prototype.refreshPageControls.bind( editor );
 return { ...work, container, close() { work.close(); container.remove(); } };
}
it( 'keeps native page controls readable through first Save and saved-session installation', async () => {
 const work = presented();
 try {
  await work.manager.loadLayers(); work.edit( 'Two saved' );
  expect( await work.manager.pageOwnedCreation.turn( 1 ) ).toBe( true ); work.edit( 'One saved' );
  expect( await work.manager.pageOwnedCreation.turn( 2 ) ).toBe( true );
  const result = await work.manager.saveLayers();
  expect( result ).toMatchObject( { revisionId: 13, dirty: false, editorStateValid: true, draftPersisted: true } );
  expect( work.editor.toolbar.pageNavEls.label.textContent ).toContain( 'Page 2 / 2' );
  expect( work.manager.pageOwnedBridge.session.getStatus().phase ).toBe( 'ready' );
  expect( work.editor.layers[ 0 ].text ).toBe( 'Two saved' );
  expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
 } finally { work.close(); }
} );
it( 'refreshes explicit recovered work without failing the strict presentation read', async () => {
 const work = presented();
 try {
  await work.manager.loadLayers(); work.edit( 'Retained recovery' );
  const host = work.manager.pageOwnedCreation.host, envelope = host.captureExitEnvelope();
  work.edit( 'Current work' ); const plan = host.prepareDraftRecovery( envelope );
  expect( await host.commitDraftRecovery( plan.handle ) ).toBe( true );
  expect( host.getStatus().needsRefresh ).toBe( false );
  expect( work.editor.layers[ 0 ].text ).toBe( 'Retained recovery' );
  expect( work.editor.toolbar.pageNavEls.label.textContent ).toContain( 'Page 2 / 2' );
  expect( work.api.postWithToken ).not.toHaveBeenCalled();
 } finally { work.close(); }
} );
it.each( [ 'throw', 'promise' ] )( 'retires creation subscriptions when installation refuses with %s', async reason => {
 const work = presented(), subscriptions = [], store = work.editor.stateManager;
 const subscribe = store.subscribe.bind( store );
 store.subscribe = ( key, listener ) => {
  const remove = subscribe( key, listener ), row = { key, removed: false }; subscriptions.push( row );
  return () => { row.removed = true; remove(); };
 };
 let delivered;
 try {
  await work.manager.loadLayers(); work.edit( 'Known saved work' );
  const creation = work.manager.pageOwnedCreation;
  await creation.lifecycle.save( '' );
  delivered = await creation.host.handoffSavedSession( creation.savedDependencies, undefined, () => {
   if ( reason === 'throw' ) throw new Error( 'Installation refused' );
   return Promise.resolve();
  } );
  expect( delivered.needsRefresh ).toBe( true );
  expect( delivered.bridge.session.getStatus().phase ).toBe( 'uncertain' );
  expect( subscriptions.slice( 0, 6 ).every( row => row.removed ) ).toBe( true );
  expect( work.editor.layers[ 0 ].text ).toBe( 'Known saved work' );
  expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
 } finally { if ( delivered ) delivered.bridge.dispose(); work.close(); }
} );
