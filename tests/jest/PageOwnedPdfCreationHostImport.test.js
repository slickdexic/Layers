'use strict';

global.TextEncoder = require( 'util' ).TextEncoder;
const fixture = require( './fixtures/pdfCreationHostImport.js' );
const { copy } = require( './fixtures/pdfCreationHost.js' );
const MissingPdfImportReadClient = require( '../../resources/ext.layers.editor/PageOwnedMissingPdfImportReadClient.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const CreationDraftController = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const opened = [];
const controllers = [];

async function imported( slot = true ) {
	const work = fixture.setup( slot );
	opened.push( work );
	expect( await work.host.load() ).toBe( true );
	const api = { post: work.nativeImport.api.post, postWithToken: work.publicationApi.postWithToken };
	work.api = api;
	work.host.enableImports( api );
	return work;
}

async function prepareImport( work, mode = 'empty', prefix = 'host-import-' ) {
	let next = 0;
	return work.host.prepareImport( copy( work.nativeImport.source ), {
		mode, maxLayers: 100, allocateId: () => prefix + ++next
	} );
}

async function applyImport( work, mode = 'empty' ) {
	const prepared = await prepareImport( work, mode );
	return { ...prepared, result: work.host.commitImport( prepared.handle ) };
}

afterEach( () => { for ( const controller of controllers.splice( 0 ) ) { controller.dispose(); }
	for ( const work of opened.splice( 0 ) ) { work.close(); } } );

function memoryStorage() {
	const data = new Map();
	return { get length() { return data.size; }, key: index => Array.from( data.keys() )[ index ] || null,
		getItem: key => data.has( key ) ? data.get( key ) : null,
		setItem: ( key, value ) => data.set( key, String( value ) ),
		removeItem: key => data.delete( key ), data };
}

function creationController( host, storage, writer ) {
	const controller = new CreationDraftController( host, new DraftStore( storage, writer ),
		{ wiki: 'wiki', user: 'user' }, { retainPublicationAttempt: true } );
	controllers.push( controller ); return controller;
}

describe( 'PDF creation host with explicit missing-target Import', () => {
	it( 'reads source and target admission through the registered missing-PDF client', async () => {
		const work = fixture.setup(); opened.push( work );
		const readClient = new MissingPdfImportReadClient( { post: work.nativeImport.api.post,
			postWithToken: work.publicationApi.postWithToken } );
		const target = work.nativeImport.value.targetAdmission;
		const result = await readClient.read( { target: target.target, selection: target.selection,
			source: work.nativeImport.source } );
		expect( result.targetAdmission ).toEqual( target );
		expect( result.source ).toEqual( work.nativeImport.source );
		expect( result.sourceGroup.members.map( member => member.page ) ).toEqual( [ 1, 2 ] );
	} );

	it( 'keeps the source-free creation draft and Save route unchanged', async () => {
		const work = fixture.setup(); opened.push( work );
		expect( await work.host.load() ).toBe( true );
		const envelope = work.host.captureDraftEnvelope();
		expect( envelope.version ).toBe( 1 );
		expect( envelope ).not.toHaveProperty( 'importPublication' );
		work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
		const result = await work.host.save( 'Ordinary creation', jest.fn() );
		expect( result.hostReady ).toBe( true );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
		expect( work.nativeImport.api.post ).not.toHaveBeenCalled();
	} );

	it( 'commits every PDF page and retains Import provenance in a complete version-3 draft', async () => {
		const work = await imported();
		const prepared = await applyImport( work );
		const envelope = work.host.captureDraftEnvelope();
		expect( prepared.preview.pages.map( page => page.page ) ).toEqual( [ 1, 2 ] );
		expect( envelope ).toMatchObject( { version: 3, importPublication: { version: 1 } } );
		expect( envelope.draft ).toEqual( envelope.importPublication.capsule.draft );
		expect( envelope.importPublication.capsule.sources ).toHaveLength( 1 );
		expect( envelope.importPublication.capsule.sources[ 0 ].source ).toEqual( work.nativeImport.source );
		expect( envelope.history.members.map( member => member.page ) ).toEqual( [ 1, 2 ] );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.id ) ).toEqual(
				prepared.preview.pages.find( page => page.page === work.editor.page ).importedLayerIds );
		expect( work.host.getDraft().snapshot.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === 'ABC' &&
			surface.source.fileTitle === 'File:Source.pdf' ) )
			.toHaveLength( 2 );
		expect( work.host.getStatus().phase ).toBe( 'ready' );
	} );

	it( 'keeps imported members and source claims when turning between pages', async () => {
		const work = await imported(); await applyImport( work );
		const initial = work.host.captureDraftEnvelope();
		expect( await work.host.turn( 1 ) ).toBe( true );
		const pageOne = work.editor.stateManager.get( 'layers' );
			expect( pageOne.map( layer => layer.id ) ).toEqual( initial.importPublication.capsule.draft.snapshot.surfaces.find( surface =>
				surface.source && surface.source.page === 1 && surface.source.fileTitle === 'File:Source.pdf' ).layers.map( layer => layer.id ) );
		expect( await work.host.turn( 2 ) ).toBe( true );
		const restored = work.host.captureDraftEnvelope();
		expect( restored.draft.snapshot.surfaces.slice( -2 ).map( member => member.source.page ) ).toEqual( [ 1, 2 ] );
		expect( restored.importPublication.capsule.sources ).toEqual( initial.importPublication.capsule.sources );
	} );

	it( 'allows prepared Import cancellation without changing editor, history, or draft', async () => {
		const work = await imported();
		const before = { witness: require( './fixtures/pdfCreationHost.js' ).witness( work ), envelope: work.host.captureDraftEnvelope() };
		const prepared = await prepareImport( work, 'empty', 'cancelled-import-' );
		work.host.releaseImport( prepared.handle );
		work.host.releaseImport( prepared.handle );
		expect( require( './fixtures/pdfCreationHost.js' ).witness( work ) ).toEqual( before.witness );
		expect( work.host.captureDraftEnvelope() ).toEqual( before.envelope );
	} );

	it( 'refuses a prepared Import after a late editor edit and preserves that edit', async () => {
		const work = await imported();
		const prepared = await prepareImport( work, 'empty', 'stale-import-' );
		work.edit( 'Newer editor work' );
		const before = { witness: require( './fixtures/pdfCreationHost.js' ).witness( work ), envelope: work.host.captureDraftEnvelope() };
		expect( () => work.host.commitImport( prepared.handle ) ).toThrow();
		expect( require( './fixtures/pdfCreationHost.js' ).witness( work ) ).toEqual( before.witness );
		expect( work.host.captureDraftEnvelope() ).toEqual( before.envelope );
	} );

	it( 'persists the complete attempt before source-aware first Save and sends exact source triples', async () => {
		const work = await imported(); await applyImport( work );
		let backup;
		const result = await work.host.save( 'Import source', () => {
			backup = work.host.captureDraftEnvelope();
			expect( backup.version ).toBe( 3 );
			expect( backup.importPublication.attempt.dispatchState ).toBe( 'prepared' );
		} );
		expect( result.hostReady ).toBe( true );
		expect( work.publicationApi.postWithToken ).toHaveBeenCalledTimes( 1 );
		const request = work.publicationApi.postWithToken.mock.calls[ 0 ];
		expect( request[ 0 ] ).toBe( 'csrf' );
		expect( request[ 1 ] ).toMatchObject( { action: 'layersmissingpdfimportpublish', targetpageid: 7,
			baserevid: 12, embedstart: work.native.selection.start, embedtext: work.native.selection.expected,
			summary: 'Import source' } );
		expect( JSON.parse( request[ 1 ].importsources ) ).toEqual( [ { sourcePageId: 8, sourceRevisionId: 21,
			sourceSurfaceId: work.nativeImport.source.surfaceId } ] );
		expect( JSON.parse( request[ 1 ].data ).surfaces.slice( -2 ).map( member => member.source.page ) ).toEqual( [ 1, 2 ] );
		expect( result.sourceReferences ).toEqual( backup.importPublication.capsule.sources );
	} );

	it( 'keeps the full Import draft and uncertain attempt after a lost first-Save response', async () => {
		const work = await imported(); await applyImport( work );
		const before = work.host.captureDraftEnvelope();
		work.publicationApi.postWithToken.mockRejectedValue( new Error( 'private network diagnostic' ) );
		await expect( work.host.save( 'Import source', jest.fn() ) ).rejects.toMatchObject( {
			code: 'layers-publication-outcome-unknown'
		} );
		const held = work.host.captureDraftEnvelope();
		expect( work.host.getStatus().phase ).toBe( 'uncertain' );
		expect( held.version ).toBe( 3 );
		expect( held.importPublication.capsule ).toEqual( before.importPublication.capsule );
		expect( held.importPublication.attempt ).toMatchObject( { dispatchState: 'unknown', revisionId: null,
			code: 'layers-publication-outcome-unknown' } );
		expect( held.importPublication.attempt.capsule ).toEqual( before.importPublication.capsule );
		await expect( work.host.save( 'Retry', jest.fn() ) ).rejects.toThrow();
		expect( work.publicationApi.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'persists and explicitly restores a version-3 uncertain attempt through the creation draft controller', async () => {
		const storage = memoryStorage(), work = await imported(), controller = creationController( work.host, storage, 'a'.repeat( 32 ) );
		await controller.review( { choose: async () => 0, confirm: async () => true } );
		await applyImport( work );
		work.publicationApi.postWithToken.mockRejectedValue( new Error( 'private network diagnostic' ) );
		await expect( controller.save( 'Import source' ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		const raw = Array.from( storage.data.values() )[ 0 ], saved = JSON.parse( raw ).pdfCreation;
		expect( saved.version ).toBe( 3 );
		expect( saved.importPublication.attempt.dispatchState ).toBe( 'unknown' );
		const receiver = await imported(), recovered = creationController( receiver.host, storage, 'b'.repeat( 32 ) );
		const restored = await recovered.review( { choose: async () => 0, confirm: async () => true } );
		expect( restored ).toBe( true );
		expect( receiver.host.getStatus().phase ).toBe( 'uncertain' );
		expect( receiver.host.captureDraftEnvelope().importPublication ).toEqual( saved.importPublication );
		expect( receiver.host.getDraft().snapshot.surfaces.slice( -2 ).map( member => member.source.page ) ).toEqual( [ 1, 2 ] );
	} );

	it.each( [ false, true ] )( 'hands confirmed Import to a saved session with complete source claims (newer edits=%s)', async newer => {
		const work = await imported();
		await applyImport( work );
		const saved = await work.host.save( 'Import source', jest.fn() ), sent = copy( saved.snapshot );
		if ( newer ) {
			const layers = copy( work.editor.stateManager.get( 'layers' ) ); layers[ 0 ].text = 'Newer imported work';
			work.editor.stateManager.set( 'layers', layers ); work.editor.historyManager.saveState( 'Newer work' );
		}
		const group = sent.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === 'ABC' &&
			surface.source.fileTitle === 'File:Source.pdf' );
		const pdfContext = page => {
			const context = require( './fixtures/pdfCreationHost.js' ).preparation( true, 2, page, 2 ).context;
			context.revisionId = 13; context.binding = 'v1:7:' + work.native.target.surfaceId;
			context.members = group.map( member => ( { page: member.source.page, surfaceId: member.id } ) );
			context.stored = true; context.surface = copy( group.find( member => member.source.page === page ) );
			return context;
		};
		const delivered = await work.host.handoffSavedSession( { reader: { read: jest.fn( async () => ( { revisionId: 13, snapshot: sent } ) ) },
			pdfReader: { read: jest.fn( async request => pdfContext( request.page ) ) }, publisher: work.publisher } );
		expect( delivered.needsRefresh ).toBe( false );
		expect( delivered.creationBackup.importPublication.capsule.sources ).toEqual( saved.sourceReferences );
		expect( delivered.creationBackup.history.members.map( member => member.page ) ).toEqual( [ 1, 2 ] );
		expect( delivered.bridge.session.getStatus().dirty ).toBe( newer );
		if ( newer ) expect( delivered.bridge.getLiveState().layers[ 0 ].text ).toBe( 'Newer imported work' );
		expect( delivered.bridge.session.getDraft().snapshot.surfaces.filter( surface => surface.kind === 'pdf' &&
			surface.label === 'ABC' && surface.source.fileTitle === 'File:Source.pdf' ) ).toHaveLength( 2 );
		delivered.bridge.dispose();
	} );
} );
