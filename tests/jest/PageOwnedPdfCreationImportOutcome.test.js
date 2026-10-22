'use strict';
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const Client = require( '../../resources/ext.layers.editor/PageOwnedMissingPdfImportPublishClient.js' );
const fixture = require( './fixtures/missingPdfImportData.js' );
const { copy } = fixture, opened = [];
const deferred = () => { let resolve; const promise = new Promise( done => { resolve = done; } ); return { promise, resolve }; };
const confirmed = () => ( { layersmissingpdfimportoutcome: { version: 1, result: 'Confirmed', revid: 13 } } );
function preparation( admission, page = admission.initialPage ) {
	const entry = admission.pages[ page - 1 ];
	return { target: copy( admission.target ), selection: copy( admission.selection ), hasLayersSlot: admission.hasLayersSlot,
		mainText: admission.mainText, baseText: admission.baseText, baseBundle: copy( admission.baseBundle ),
		anchorSurface: copy( admission.pages[ admission.initialPage - 1 ].surface ),
		context: { ...copy( admission.target ), binding: 'v1:' + admission.target.pageId + ':' + admission.target.surfaceId,
			kind: 'pdf', label: admission.label, initialPage: admission.initialPage, pageCount: admission.pageCount, page,
			stored: false, members: [], surface: copy( entry.surface ), sourceGeometry: copy( entry.sourceGeometry ), rendition: copy( entry.rendition ) } };
}
async function uncertain( slot = true ) {
	const native = fixture.setup( slot ), reader = { read: jest.fn( async input => preparation( native.value.targetAdmission, input.page ) ) };
	const ordinary = { publish: jest.fn() }, api = { postWithToken: jest.fn().mockRejectedValue( new Error( 'Connection lost' ) ) };
	const transaction = new Transaction( preparation( native.value.targetAdmission ), { reader, publisher: ordinary } );
	transaction.enableImports( native.api ); transaction.enableImportPublication( api );
	const work = { transaction, native, reader, ordinary, api }; opened.push( work );
	let next = 0;
	const plan = await transaction.prepareImport( { source: copy( native.value.source ), mode: 'empty', maxLayers: 100,
		allocateId: () => 'import-' + ++next } ); transaction.commitImportPlan( plan.handle );
	await expect( transaction.saveImport( 'Import note' ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
	api.postWithToken.mockResolvedValue( confirmed() ); return work;
}
function edit( work, text ) {
	const state = work.transaction.getEditorState(); state.layers[ 0 ].text = text; work.transaction.update( state );
}
afterEach( () => { jest.restoreAllMocks(); for ( const work of opened.splice( 0 ) ) { work.transaction.dispose(); work.native.client.dispose(); } } );

it.each( [ false, true ] )( 'privately checks the exact Import attempt and commits its sent snapshot only, slot=%s', async slot => {
	const work = await uncertain( slot ), sent = work.transaction.getImportPublicationState(); edit( work, 'Newer local work' );
	const before = work.transaction.getImportPublicationState(), prepared = await work.transaction.prepareImportPublicationReconciliation();
	expect( work.transaction.getImportPublicationState() ).toEqual( before );
	expect( work.transaction.getStatus().phase ).toBe( 'uncertain' );
	expect( prepared.confirmation.snapshot ).toEqual( sent.attempt.capsule.draft.snapshot );
	prepared.confirmation.snapshot.surfaces.length = 0;
	const result = work.transaction.commitImportPublicationReconciliation( prepared.handle );
	expect( result ).toMatchObject( { applied: true, holdCleared: true, publicationRetried: false, revisionId: 13 } );
	expect( work.transaction.getStatus() ).toMatchObject( { phase: 'confirmed', dirty: true, confirmedRevisionId: 13 } );
	const saved = work.transaction.getImportPublicationState();
	expect( saved.capsule ).toEqual( before.capsule ); expect( saved.attempt.request ).toEqual( sent.attempt.request );
	expect( saved.attempt ).toMatchObject( { dispatchState: 'confirmed', code: null, revisionId: 13 } );
	expect( work.api.postWithToken.mock.calls.map( args => args[ 1 ].action ) ).toEqual( [ 'layersmissingpdfimportpublish', 'layersmissingpdfimportoutcome' ] );
	expect( work.ordinary.publish ).not.toHaveBeenCalled();
	expect( () => work.transaction.commitImportPublicationReconciliation( prepared.handle ) ).toThrow();
} );
it( 'cancels a prepared check without changing work or its hold', async () => {
	const work = await uncertain(), before = work.transaction.getImportPublicationState();
	const prepared = await work.transaction.prepareImportPublicationReconciliation(); work.transaction.releaseImportPublicationReconciliation( prepared.handle );
	expect( work.transaction.getImportPublicationState() ).toEqual( before ); expect( work.transaction.getStatus().phase ).toBe( 'uncertain' );
	expect( () => work.transaction.commitImportPublicationReconciliation( prepared.handle ) ).toThrow();
} );
it.each( [ 'during check', 'after preparation' ] )( 'preserves newer edits made %s and refuses the obsolete plan', async when => {
	const work = await uncertain(), pending = deferred(), entered = deferred();
	work.api.postWithToken.mockImplementation( () => { entered.resolve(); return pending.promise; } );
	const preparing = work.transaction.prepareImportPublicationReconciliation(); await entered.promise;
	let prepared;
	if ( when === 'after preparation' ) { pending.resolve( confirmed() ); prepared = await preparing; }
	edit( work, 'Newer during check' ); const after = work.transaction.getImportPublicationState();
	if ( prepared ) expect( () => work.transaction.commitImportPublicationReconciliation( prepared.handle ) ).toThrow();
	else { pending.resolve( confirmed() ); await expect( preparing ).rejects.toThrow(); }
	expect( work.transaction.getImportPublicationState() ).toEqual( after ); expect( work.transaction.getStatus().phase ).toBe( 'uncertain' );
} );
it( 'cannot use fabricated outcome evidence to acknowledge a retained request', async () => {
	const work = await uncertain(), before = work.transaction.getImportPublicationState();
	const old = Client.prototype.check; Client.prototype.check = jest.fn().mockResolvedValue( { revisionId: 13 } );
	try { await expect( work.transaction.prepareImportPublicationReconciliation() ).rejects.toThrow(); }
	finally { Client.prototype.check = old; }
	expect( work.transaction.getImportPublicationState() ).toEqual( before );
} );
it( 'refused native confirmation preserves the complete attempt and live work', async () => {
	const work = await uncertain(), before = work.transaction.getImportPublicationState();
	work.api.postWithToken.mockRejectedValue( { code: 'layers-working-copy-import-unavailable' } );
	await expect( work.transaction.prepareImportPublicationReconciliation() ).rejects.toThrow();
	expect( work.transaction.getImportPublicationState() ).toEqual( before ); expect( work.transaction.getStatus().phase ).toBe( 'uncertain' );
} );
