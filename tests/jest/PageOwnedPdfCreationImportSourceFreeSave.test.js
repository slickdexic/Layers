'use strict';
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const fixture = require( './fixtures/missingPdfImportData.js' );
const { copy } = fixture, opened = [];
const success = revisionId => ( { revisionId } );
function preparation( admission, page = admission.initialPage ) {
	const entry = admission.pages[ page - 1 ];
	return { target: copy( admission.target ), selection: copy( admission.selection ), hasLayersSlot: admission.hasLayersSlot,
		mainText: admission.mainText, baseText: admission.baseText, baseBundle: copy( admission.baseBundle ),
		anchorSurface: copy( admission.pages[ admission.initialPage - 1 ].surface ),
		context: { ...copy( admission.target ), binding: 'v1:' + admission.target.pageId + ':' + admission.target.surfaceId,
			kind: 'pdf', label: admission.label, initialPage: admission.initialPage, pageCount: admission.pageCount, page,
			stored: false, members: [], surface: copy( entry.surface ), sourceGeometry: copy( entry.sourceGeometry ), rendition: copy( entry.rendition ) } };
}
function setup() {
	const native = fixture.setup( true ), reader = { read: jest.fn( async input => preparation( native.value.targetAdmission, input.page ) ) };
	const api = { postWithToken: jest.fn() }, ordinary = { publish: jest.fn().mockResolvedValue( success( 13 ) ) };
	const transaction = new Transaction( preparation( native.value.targetAdmission ), { reader, publisher: ordinary } );
	transaction.enableImports( native.api ); transaction.enableImportPublication( api );
	const work = { transaction, native, reader, api, ordinary }; opened.push( work ); return work;
}
async function importSource( work ) {
	let next = 0;
	const plan = await work.transaction.prepareImport( { source: copy( work.native.value.source ), mode: 'empty', maxLayers: 100,
		allocateId: () => 'source-free-' + ++next } );
	work.transaction.commitImportPlan( plan.handle );
}
async function removeSourceClaims( work ) {
	const capsule = work.transaction.getImportPublicationState().capsule; capsule.sources = [];
	const plan = await work.transaction.prepareImportRecovery( capsule ); work.transaction.commitImportPlan( plan.handle );
}
afterEach( () => { for ( const work of opened.splice( 0 ) ) { work.transaction.dispose(); work.native.client.dispose(); } } );

describe( 'source-free first Save after PDF Import opt-in', () => {
	it( 'uses ordinary publication with a pre-dispatch exact attempt backup and no source references', async () => {
		const work = setup(); await importSource( work ); await removeSourceClaims( work );
		const capsule = work.transaction.getImportPublicationState().capsule;
		const persist = jest.fn( () => {
			const state = work.transaction.getImportPublicationState();
			expect( state.attempt ).toMatchObject( { version: 2, sequence: 1, dispatchState: 'prepared', capsule, revisionId: null, code: null } );
			expect( state.attempt.request ).toEqual( { owner: 'Owner', pageId: 7, baseRevisionId: 12,
			snapshotJson: JSON.stringify( capsule.draft.snapshot ), summary: 'local layers' } );
			expect( work.ordinary.publish ).not.toHaveBeenCalled(); expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} );
		const result = await work.transaction.saveImport( 'local layers', persist );
		expect( work.ordinary.publish ).toHaveBeenCalledWith( { owner: 'Owner', pageId: 7, baseRevisionId: 12,
			snapshotJson: JSON.stringify( capsule.draft.snapshot ), summary: 'local layers' } );
		expect( work.api.postWithToken ).not.toHaveBeenCalled(); expect( result.sourceReferences ).toBeUndefined();
		expect( result.snapshot ).toEqual( capsule.draft.snapshot );
		expect( work.transaction.getImportPublicationState().attempt ).toMatchObject( { version: 2, dispatchState: 'confirmed', revisionId: 13 } );
		expect( work.transaction.getImportPublicationState().capsule.sources ).toEqual( [] );
		expect( work.transaction.getStatus() ).toMatchObject( { phase: 'confirmed', confirmedRevisionId: 13, dirty: false } );
	} );

	it.each( [ 'refused', 'unknown' ] )( 'retains the exact source-free %s attempt for recovery', async outcome => {
		const source = setup(); await importSource( source ); await removeSourceClaims( source );
		if ( outcome === 'refused' ) source.ordinary.publish.mockRejectedValue( Object.assign( new Error( 'badtoken' ), { code: 'badtoken' } ) );
		else source.ordinary.publish.mockResolvedValue( { revisionId: 12 } );
		await expect( source.transaction.saveImport( 'attempted' ) ).rejects.toMatchObject( {
			code: outcome === 'refused' ? 'badtoken' : 'layers-publication-outcome-unknown'
		} );
		const retained = source.transaction.getImportPublicationState();
		expect( retained.attempt ).toMatchObject( { version: 2, dispatchState: outcome === 'refused' ? 'refused' : 'unknown',
			code: outcome === 'refused' ? 'badtoken' : 'layers-publication-outcome-unknown', request: { summary: 'attempted' } } );
		expect( source.transaction.getStatus().phase ).toBe( outcome === 'refused' ? 'ready' : 'uncertain' );
		const restored = setup();
		const prepared = await restored.transaction.prepareImportPublicationRecovery( copy( retained ) );
		expect( prepared.preview ).toMatchObject( { phase: 'uncertain', confirmation: null, holdCleared: false } );
		restored.transaction.commitImportPublicationRecovery( prepared.handle );
		expect( restored.transaction.getStatus() ).toMatchObject( { phase: 'uncertain', confirmedRevisionId: null } );
		expect( restored.transaction.getImportPublicationState().attempt ).toEqual( retained.attempt );
		expect( restored.ordinary.publish ).not.toHaveBeenCalled(); expect( restored.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'recovers a source-free attempt while preserving newer source claims and work', async () => {
		const source = setup(); await importSource( source );
		const sourceBearingCapsule = copy( source.transaction.getImportPublicationState().capsule ); await removeSourceClaims( source );
		source.ordinary.publish.mockRejectedValue( Object.assign( new Error( 'badtoken' ), { code: 'badtoken' } ) );
		await expect( source.transaction.saveImport() ).rejects.toMatchObject( { code: 'badtoken' } );
		const sent = source.transaction.getImportPublicationState().attempt.capsule;
		const live = source.transaction.getImportPublicationState(); live.capsule = sourceBearingCapsule;
		expect( live.capsule.sources ).toHaveLength( 1 ); expect( live.attempt.capsule ).toEqual( sent );
		const restored = setup(), prepared = await restored.transaction.prepareImportPublicationRecovery( copy( live ) );
		restored.transaction.commitImportPublicationRecovery( prepared.handle );
		expect( restored.transaction.getImportPublicationState().capsule.sources ).toEqual( live.capsule.sources );
		expect( restored.transaction.getImportPublicationState().attempt.capsule.sources ).toEqual( [] );
		expect( restored.transaction.getStatus() ).toMatchObject( { phase: 'uncertain', dirty: true } );
	} );

	it.each( [
		[ 'version', value => { value.attempt.version = 1; } ],
		[ 'request citation', value => { value.attempt.request.sources = []; } ],
		[ 'attempt claims', value => { value.attempt.capsule.sources.push( { forged: true } ); } ],
		[ 'request snapshot', value => { value.attempt.request.snapshotJson = '{}' ; } ]
	] )( 'refuses a forged source-free attempt %s', async ( label, mutate ) => {
		const source = setup(); await importSource( source ); await removeSourceClaims( source );
		source.ordinary.publish.mockRejectedValue( Object.assign( new Error( 'badtoken' ), { code: 'badtoken' } ) );
		await expect( source.transaction.saveImport() ).rejects.toMatchObject( { code: 'badtoken' } );
		const retained = copy( source.transaction.getImportPublicationState() ); mutate( retained );
		const restored = setup(); await expect( restored.transaction.prepareImportPublicationRecovery( retained ) ).rejects.toThrow();
		expect( restored.transaction.getImportPublicationState().attempt ).toBeNull();
	} );
} );
