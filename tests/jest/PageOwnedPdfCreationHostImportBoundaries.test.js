'use strict';

global.TextEncoder = require( 'util' ).TextEncoder;
const { setup } = require( './fixtures/pdfCreationHostImport.js' );
const { copy, witness, wait, tickUntil } = require( './fixtures/pdfCreationHost.js' );
const opened = [];

async function work( enable = true ) {
	const value = setup(); opened.push( value );
	expect( await value.host.load() ).toBe( true );
	value.api = { post: value.nativeImport.api.post, postWithToken: value.publicationApi.postWithToken };
	if ( enable ) value.host.enableImports( value.api );
	return value;
}

async function apply( value ) {
	let id = 0;
	const prepared = await value.host.prepareImport( copy( value.nativeImport.source ), {
		mode: 'empty', maxLayers: 100, allocateId: () => 'import-boundary-' + ++id
	} );
	value.host.commitImport( prepared.handle );
}

afterEach( () => { for ( const value of opened.splice( 0 ).reverse() ) value.close(); } );

it( 'retains the entire editor and draft when fresh native Import authorization refuses', async () => {
	const value = await work(); value.edit( 'Existing work' );
	const before = { editor: witness( value ), draft: value.host.captureExitEnvelope() };
	value.api.post.mockRejectedValue( new Error( 'permissiondenied' ) );
	await expect( value.host.prepareImport( copy( value.nativeImport.source ), {
		mode: 'replace', maxLayers: 100, allocateId: () => 'denied-import'
	} ) ).rejects.toThrow();
	expect( { editor: witness( value ), draft: value.host.captureExitEnvelope() } ).toEqual( before );
	expect( value.publicationApi.postWithToken ).not.toHaveBeenCalled();
} );

it( 'restores a ready older source-free draft without inventing Import provenance', async () => {
	const original = await work( false ); original.edit( 'Earlier ordinary draft' );
	const envelope = original.host.captureDraftEnvelope();
	const next = await work();
	const prepared = next.host.prepareDraftRecovery( envelope );
	expect( await next.host.commitDraftRecovery( prepared.handle ) ).toBe( true );
	const restored = next.host.captureExitEnvelope();
	expect( restored.version ).toBe( 3 );
	expect( restored.draft ).toEqual( envelope.draft );
	expect( restored.history ).toEqual( envelope.history );
	expect( restored.importPublication.capsule.sources ).toEqual( [] );
	expect( restored.importPublication.attempt ).toBeNull();
	expect( next.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Earlier ordinary draft' );
	expect( next.api.post ).not.toHaveBeenCalled();
} );

it( 'refuses an Import draft on an ordinary host instead of dropping its source references', async () => {
	const original = await work(); await apply( original );
	const next = await work( false ), before = { editor: witness( next ), draft: next.host.captureExitEnvelope() };
	expect( () => next.host.prepareDraftRecovery( original.host.captureExitEnvelope() ) ).toThrow();
	expect( { editor: witness( next ), draft: next.host.captureExitEnvelope() } ).toEqual( before );
} );

it( 'refuses recovery if local edits arrive during native source revalidation', async () => {
	const original = await work(); await apply( original );
	const next = await work(), pending = wait();
	next.api.post.mockReturnValueOnce( pending.promise );
	const prepared = next.host.prepareDraftRecovery( original.host.captureExitEnvelope() );
	const restoring = next.host.commitDraftRecovery( prepared.handle );
	await tickUntil( () => next.api.post.mock.calls.length > 0 );
	next.edit( 'Newer work must win' );
	const before = { editor: witness( next ), draft: next.host.captureExitEnvelope() };
	pending.resolve( { layersmissingpdfimportread: { version: 1,
		data: require( './fixtures/missingPdfImportData.js' ).asciiJson( next.nativeImport.value ) } } );
	await expect( restoring ).rejects.toThrow();
	expect( { editor: witness( next ), draft: next.host.captureExitEnvelope() } ).toEqual( before );
	expect( next.publicationApi.postWithToken ).not.toHaveBeenCalled();
} );

it( 'cannot reconcile an Import attempt through the older snapshot-only publication reader', async () => {
	const value = await work(); await apply( value );
	value.publicationApi.postWithToken.mockRejectedValueOnce( new Error( 'lost response' ) );
	await expect( value.host.save( '', jest.fn() ) ).rejects.toThrow();
	const before = value.host.captureExitEnvelope();
	await expect( value.host.inspectPublication( {} ) ).rejects.toThrow();
	await expect( value.host.reconcilePublication( {}, jest.fn() ) ).rejects.toThrow();
	expect( value.host.captureExitEnvelope() ).toEqual( before );
	expect( value.publicationApi.postWithToken ).toHaveBeenCalledTimes( 1 );
} );

it( 'refuses prepared Import if a recovery hold is imposed before Apply', async () => {
	const value = await work();
	let id = 0;
	const prepared = await value.host.prepareImport( copy( value.nativeImport.source ), {
		mode: 'empty', maxLayers: 100, allocateId: () => 'held-import-' + ++id
	} );
	value.host.blockPublication();
	const before = { editor: witness( value ), draft: value.host.captureExitEnvelope() };
	expect( () => value.host.commitImport( prepared.handle ) ).toThrow();
	expect( { editor: witness( value ), draft: value.host.captureExitEnvelope() } ).toEqual( before );
	value.host.releaseImport( prepared.handle );
} );

it( 'does not dispatch first Save when a recovery hold arrives during source checks', async () => {
	const value = await work(); await apply( value );
	const pending = wait(); value.api.post.mockReturnValueOnce( pending.promise );
	const saving = value.host.save( 'Preserve work', jest.fn() );
	await tickUntil( () => value.api.post.mock.results.at( -1 ).value === pending.promise );
	value.host.blockPublication();
	const before = witness( value );
	pending.resolve( { layersmissingpdfimportread: { version: 1,
		data: require( './fixtures/missingPdfImportData.js' ).asciiJson( value.nativeImport.value ) } } );
	await expect( saving ).rejects.toThrow();
	expect( witness( value ) ).toEqual( before );
	expect( value.host.getStatus().publicationBlocked ).toBe( true );
	expect( value.publicationApi.postWithToken ).not.toHaveBeenCalled();
} );

it( 'can repeatedly release a prepared handle invalidated by a page turn', async () => {
	const value = await work();
	let id = 0;
	const prepared = await value.host.prepareImport( copy( value.nativeImport.source ), {
		mode: 'empty', maxLayers: 100, allocateId: () => 'released-import-' + ++id
	} );
	expect( await value.host.turn( 1 ) ).toBe( true );
	const before = { editor: witness( value ), draft: value.host.captureExitEnvelope() };
	expect( () => value.host.commitImport( prepared.handle ) ).toThrow();
	expect( () => value.host.releaseImport( prepared.handle ) ).not.toThrow();
	expect( () => value.host.releaseImport( prepared.handle ) ).not.toThrow();
	expect( { editor: witness( value ), draft: value.host.captureExitEnvelope() } ).toEqual( before );
} );
