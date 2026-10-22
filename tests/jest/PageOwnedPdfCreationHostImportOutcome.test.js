'use strict';
const fixture = require( './fixtures/pdfCreationSavedImport.js' );
const DraftController = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const { copy } = fixture, opened = [], bridges = [], controllers = [];
const confirmed = () => ( { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 } } );
const deferred = () => { let resolve; const promise = new Promise( done => { resolve = done; } ); return { promise, resolve }; };
function memory() {
	const rows = new Map(); return { rows, get length() { return rows.size; }, key: i => Array.from( rows.keys() )[ i ] || null,
		getItem: key => rows.get( key ) || null, setItem: ( key, value ) => rows.set( key, String( value ) ), removeItem: key => rows.delete( key ) };
}
async function setup() {
	const remote = await fixture.build(); opened.push( remote ); const saved = await remote.save();
	const value = await fixture.build(); opened.push( value );
	value.work.publicationApi.postWithToken.mockRejectedValue( new Error( 'Connection lost' ) );
	await expect( value.save() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
	value.work.publicationApi.postWithToken.mockResolvedValue( confirmed() ); return { value, work: value.work, saved, remote };
}
function edit( work, text ) {
	const layers = copy( work.editor.stateManager.get( 'layers' ) ); layers[ 0 ].text = text;
	work.editor.stateManager.set( 'layers', layers ); work.editor.historyManager.saveState( 'Newer work' );
}
afterEach( () => { for ( const c of controllers.splice( 0 ) ) c.dispose(); for ( const b of bridges.splice( 0 ) ) {
	b.importBinding.dispose(); b.importApplication.dispose(); b.coordinator.dispose(); b.bridge.dispose();
} for ( const value of opened.splice( 0 ) ) value.work.close(); } );

it( 'checks through the actual draft controller, preserves both backups and newer work, and hands group history to the saved editor', async () => {
	const { work, saved } = await setup(); edit( work, 'Newer after lost response' );
	const local = memory(), controller = new DraftController( work.host, new DraftStore( local, 'a'.repeat( 32 ) ),
		{ wiki: 'wiki', user: 'user' }, { retainPublicationAttempt: true } ); controllers.push( controller );
	await controller.review( { choose: async () => null, confirm: async () => false } );
	const checkpoint = new DraftStore( local, 'b'.repeat( 32 ) ), before = work.host.captureDraftEnvelope();
	const result = await controller.reconcilePublication( saved.dependencies, checkpoint );
	expect( result ).toMatchObject( { applied: true, holdCleared: true, draftPersisted: true } );
	expect( work.host.getStatus() ).toMatchObject( { phase: 'confirmed', dirty: true } );
	const old = Array.from( local.rows.values() ).map( JSON.parse ).find( row => row.pdfCreation.phase === 'uncertain' );
	expect( old.pdfCreation ).toEqual( before );
	const delivered = await work.host.handoffSavedSession( saved.dependencies ); bridges.push( delivered );
	expect( delivered.needsRefresh ).toBe( false );
	expect( delivered.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer after lost response' );
	expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.historyManager.undo() ).toBe( true );
	expect( delivered.importApplication.captureDraft().session.sources ).toEqual( [] );
	expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.editor.historyManager.redo() ).toBe( true );
	expect( delivered.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer after lost response' );
	expect( work.publicationApi.postWithToken.mock.calls.map( args => args[ 1 ].action ) ).toEqual( [ 'layersmissingpdfimportpublish', 'layersmissingpdfimportoutcome' ] );
} );
it( 'leaves all page timelines and saved markers intact on a refused check', async () => {
	const { work, saved } = await setup(), before = work.host.captureDraftEnvelope();
	work.publicationApi.postWithToken.mockRejectedValue( { code: 'layers-working-copy-import-unavailable' } );
	await expect( work.host.reconcilePublication( saved.dependencies, () => {} ) ).rejects.toThrow();
	expect( work.host.captureDraftEnvelope() ).toEqual( before ); expect( work.host.getStatus().phase ).toBe( 'uncertain' );
} );
it( 'preserves edits made while checking without changing any saved marker', async () => {
	const { work, saved } = await setup(), pending = deferred(), entered = deferred();
	work.publicationApi.postWithToken.mockImplementation( () => { entered.resolve(); return pending.promise; } );
	const checking = work.host.reconcilePublication( saved.dependencies, () => {} ); await entered.promise;
	edit( work, 'Edited during check' ); const newer = work.host.captureDraftEnvelope(); pending.resolve( confirmed() );
	await expect( checking ).rejects.toThrow(); expect( work.host.captureDraftEnvelope() ).toEqual( newer );
} );
it( 'refuses a changed independent backup before confirming anything', async () => {
	const { work, saved } = await setup(), before = work.host.captureDraftEnvelope(); let calls = 0;
	await expect( work.host.reconcilePublication( saved.dependencies, () => { if ( ++calls > 1 ) throw new Error( 'Backup changed' ); } ) ).rejects.toThrow();
	expect( work.host.captureDraftEnvelope() ).toEqual( before ); expect( work.host.getStatus().phase ).toBe( 'uncertain' );
} );
it( 'refuses a replaced transaction commit method before any model or saved-marker change', async () => {
	const { work, saved } = await setup(), before = work.host.captureDraftEnvelope();
	const original = Transaction.prototype.commitImportPublicationReconciliation, replaced = jest.fn();
	work.publicationApi.postWithToken.mockImplementation( () => {
		Transaction.prototype.commitImportPublicationReconciliation = replaced; return Promise.resolve( confirmed() );
	} );
	try { await expect( work.host.reconcilePublication( saved.dependencies, () => {} ) ).rejects.toThrow(); }
	finally { Transaction.prototype.commitImportPublicationReconciliation = original; }
	expect( replaced ).not.toHaveBeenCalled(); expect( work.host.captureDraftEnvelope() ).toEqual( before );
} );

async function sourceFree( revisionId = 13 ) {
	const remote = await fixture.build( { undo: true } ); opened.push( remote ); const saved = await remote.save();
	const value = await fixture.build( { undo: true } ); opened.push( value ); const work = value.work;
	work.publisher.publish.mockRejectedValue( new Error( 'Connection lost' ) );
	await expect( work.host.save( 'Local work', () => {} ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
	const api = { get: jest.fn().mockResolvedValue( { query: { pages: [ { pageid: 7, title: work.native.target.owner,
		revisions: [ { revid: revisionId, parentid: revisionId - 1, slots: { main: { contentmodel: 'wikitext', content: work.native.mainText } } } ] } ] } } ) };
	return { work, saved, dependencies: { api, reader: saved.dependencies.reader, pdfReader: saved.dependencies.pdfReader } };
}
it( 'checks a source-free Save after group Undo through the ordinary reader and preserves group Redo', async () => {
	const { work, saved, dependencies } = await sourceFree();
	expect( work.host.captureDraftEnvelope().importPublication.attempt.version ).toBe( 2 );
	const result = await work.host.reconcilePublication( dependencies, () => {} );
	expect( result ).toMatchObject( { applied: true, holdCleared: true, publicationRetried: false } );
	expect( work.publicationApi.postWithToken ).not.toHaveBeenCalled(); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	const delivered = await work.host.handoffSavedSession( saved.dependencies ); bridges.push( delivered );
	expect( delivered.needsRefresh ).toBe( false ); expect( work.editor.historyManager.redo() ).toBe( true );
	expect( delivered.importApplication.captureDraft().session.sources ).toHaveLength( 1 );
} );
it( 'does not clear a source-free hold merely because a delayed Save has not arrived yet', async () => {
	const { work, dependencies } = await sourceFree( 12 ), before = work.host.captureDraftEnvelope();
	await expect( work.host.reconcilePublication( dependencies, () => {} ) ).rejects.toThrow();
	expect( work.host.captureDraftEnvelope() ).toEqual( before ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
} );
