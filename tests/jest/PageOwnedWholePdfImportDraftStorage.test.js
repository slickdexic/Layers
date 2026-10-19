'use strict';

// Shared helpers are registered only for this suite when imported by its companion.
const { copy, setup, applyImport, successfulSave, witness, nativeCalls, ordinaryCalls } =
	require( './PageOwnedWholePdfImportPublication.test.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const DraftController = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const SnapshotAdapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );

const writerA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const writerB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function mapStorage( seed ) {
	const rows = new Map( seed || [] );
	return {
		get length() { return rows.size; },
		getItem: jest.fn( key => rows.has( key ) ? rows.get( key ) : null ),
		setItem: jest.fn( ( key, value ) => { rows.set( key, String( value ) ); } ),
		removeItem: jest.fn( key => { rows.delete( key ); } ),
		key: jest.fn( index => Array.from( rows.keys() )[ index ] ?? null ),
		rows
	};
}

function controllerFor( work, application, storage, writerId = writerA ) {
	const draftStore = new DraftStore( storage, writerId );
	const draftScope = work.editor.config.pageOwned.draftScope;
	const controller = new DraftController( work.bridge, draftStore, new SnapshotAdapter(), {
		wiki: 'https://fictionalexample.test/wiki',
		user: 'DraftStorageTest',
		...draftScope
	} );
	controller.enableWholePdfDrafts( application );
	return { controller, draftStore };
}

async function importedContext( options = {} ) {
	const context = await setup( options );
	await applyImport( context.work, context.application, context.request );
	return context;
}

module.exports = { copy, setup, applyImport, successfulSave, witness, nativeCalls, ordinaryCalls, DraftController, DraftStore, SnapshotAdapter, mapStorage, controllerFor, importedContext, writerA, writerB };

if ( expect.getState().testPath.endsWith( 'PageOwnedWholePdfImportDraftStorage.test.js' ) ) {
describe( 'PageOwnedWholePdfImportDraftStorage', () => {
	it( 'captures a detached complete whole-PDF Import draft through controller.persist', async () => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			controller.persist();
			const candidate = controller.inspectRecovery();
			expect( candidate.wholePdfImportDraft ).toMatchObject( {
				format: 'layers-whole-pdf-import-draft', version: 1,
				session: expect.any( Object ), history: expect.any( Object )
			} );
			expect( candidate.editorState ).toEqual( expect.any( Object ) );
			candidate.wholePdfImportDraft.session.sources.length = 0;
			expect( controller.inspectRecovery().wholePdfImportDraft.session.sources.length ).toBeGreaterThan( 0 );
		} finally { context.work.close(); }
	} );

	it( 'writes the saving-phase backup before native publication dispatch', async () => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			const result = await successfulSave( context.work, 'Import Save', () => controller.persist() );
			expect( result.revisionId ).toBeGreaterThan( 12 );
			expect( nativeCalls( context.api ) ).toHaveLength( 1 );
			const raw = Array.from( storage.rows.values() ).map( JSON.parse )[ 0 ];
			expect( raw.phase ).toBe( 'saving' );
			expect( raw.wholePdfImportDraft.format ).toBe( 'layers-whole-pdf-import-draft' );
		} finally { context.work.close(); }
	} );

	it( 'refuses publication when durable storage fails and preserves the prior backup', async () => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			controller.persist();
			const before = Array.from( storage.rows.entries() );
			storage.setItem.mockImplementationOnce( () => { throw new Error( 'quota' ); } );
			await expect( successfulSave( context.work, 'Import Save', () => controller.persist() ) )
				.rejects.toMatchObject( { code: 'layers-draft-storage-failed' } );
			expect( nativeCalls( context.api ) ).toHaveLength( 0 );
			expect( Array.from( storage.rows.entries() ) ).toEqual( before );
		} finally { context.work.close(); }
	} );

	it.each( [ 'layers-edit-conflict', 'layers-owner-edit-denied', 'ratelimited' ] )(
		'keeps the complete recovery record and Import authority on a native refusal (%s)', async code => {
			const context = await importedContext(), storage = mapStorage();
			try {
				const { controller } = controllerFor( context.work, context.application, storage );
				const before = witness( context.work );
				context.api.postWithToken.mockRejectedValueOnce( { error: { code } } );
				await expect( successfulSave( context.work, 'Import Save', () => controller.persist() ) ).rejects.toMatchObject( { code } );
				expect( nativeCalls( context.api ) ).toHaveLength( 1 );
				expect( controller.inspectRecovery().wholePdfImportDraft ).toBeDefined();
				expect( witness( context.work ) ).toBe( before );
			} finally { context.work.close(); }
		}
	);

	it( 'retains the latest live layers and full histories when the publication outcome is unknown', async () => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			let rejectPost;
			context.api.postWithToken.mockImplementationOnce( () => new Promise( ( _resolve, reject ) => { rejectPost = reject; } ) );
			const pending = successfulSave( context.work, 'Import Save', () => controller.persist() );
			pending.catch( () => {} );
			await Promise.resolve();
			rejectPost( new Error( 'connection lost' ) );
			await expect( pending ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
			expect( context.work.session.getStatus().phase ).toBe( 'uncertain' );
			expect( controller.inspectRecovery().wholePdfImportDraft ).toBeDefined();
			expect( nativeCalls( context.api ) ).toHaveLength( 1 );
		} finally { context.work.close(); }
	} );

	it( 'keeps each editor writer partition independent when both persist the same scope', async () => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const first = controllerFor( context.work, context.application, storage, writerA );
			const second = controllerFor( context.work, context.application, storage, writerB );
			first.controller.persist();
			const firstRaw = Array.from( storage.rows.entries() )[ 0 ];
			second.controller.persist();
			expect( storage.rows.size ).toBe( 2 );
			expect( storage.rows.get( firstRaw[ 0 ] ) ).toBe( firstRaw[ 1 ] );
		} finally { context.work.close(); }
	} );

	it( 'continues to discover the older PDF draft envelope without a whole-PDF Import field', async () => {
		const context = await setup(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			const scope = controller._scope();
			const legacy = { version: 1, scope, phase: 'ready', label: 'ABC',
				pdfDraft: context.work.session.getDraft(),
				pdfHistory: context.work.bridge.pdfCoordinator.captureDraftHistory(),
				editorState: context.work.bridge.getLiveState() };
			controller.store.write( scope, JSON.stringify( legacy ) );
			expect( controller.listCandidates() ).toHaveLength( 1 );
			controller.selectRecovery( controller.listCandidates()[ 0 ] );
			expect( controller.inspectRecovery() ).toMatchObject( { label: 'ABC', pdfDraft: expect.any( Object ) } );
		} finally { context.work.close(); }
	} );

	it.each( [
		[ 'wrong format', draft => { draft.format = 'other'; } ],
		[ 'wrong version', draft => { draft.version = 2; } ],
		[ 'mixed legacy PDF payload', draft => { draft.pdfDraft = {}; } ],
		[ 'wrong document scope', draft => { draft.session.scope.owner = 'Other owner'; } ],
		[ 'missing history', draft => { delete draft.history; } ]
	] )( 'refuses malformed or mixed stored whole-PDF payloads without deleting the record (%s)', async ( _label, alter ) => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			controller.persist();
			const [ key, raw ] = Array.from( storage.rows.entries() )[ 0 ], envelope = JSON.parse( raw );
			alter( envelope.wholePdfImportDraft ); storage.rows.set( key, JSON.stringify( envelope ) );
			controller.selectRecovery( controller.listCandidates()[ 0 ] );
			expect( () => controller.inspectRecovery() ).toThrow( 'layers-invalid-page-owned-draft' );
			expect( storage.rows.get( key ) ).toBe( JSON.stringify( envelope ) );
		} finally { context.work.close(); }
	} );

	it( 'does not turn a copied stored payload into import authority', async () => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			controller.persist();
			const candidate = controller.inspectRecovery();
			const copied = copy( candidate.wholePdfImportDraft );
			copied.session.sources[ 0 ].sourceRevisionId += 1000;
			const before = witness( context.work );
			await expect( context.application.prepareDraftRecovery( copied ) ).rejects.toBeInstanceOf( Error );
			expect( witness( context.work ) ).toBe( before );
			expect( controller.inspectRecovery().wholePdfImportDraft.session.sources[ 0 ].sourceRevisionId )
				.toBe( candidate.wholePdfImportDraft.session.sources[ 0 ].sourceRevisionId );
		} finally { context.work.close(); }
	} );

	it( 'does not issue a publish request while inspecting or refusing a backup', async () => {
		const context = await importedContext(), storage = mapStorage();
		try {
			const { controller } = controllerFor( context.work, context.application, storage );
			controller.persist();
			const before = witness( context.work );
			controller.inspectRecovery();
			expect( witness( context.work ) ).toBe( before );
			expect( nativeCalls( context.api ) ).toHaveLength( 0 );
			expect( ordinaryCalls( context.api ) ).toHaveLength( 0 );
		} finally { context.work.close(); }
	} );
} );
}
