'use strict';
const Client = require( '../../resources/ext.layers.editor/PageOwnedMissingPdfImportPublishClient.js' );
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const fixture = require( './fixtures/missingPdfImportData.js' );
const { copy, asciiJson } = fixture, opened = [];
const success = revisionId => ( { layersmissingpdfimportpublish: { version: 1, result: 'Success', revid: revisionId } } );
const deferred = () => { let resolve; const promise = new Promise( done => { resolve = done; } ); return { promise, resolve }; };
function request() {
	const native = fixture.preparation();
	return { pageId: 7, baseRevisionId: 12, selection: copy( native.targetAdmission.selection ),
		snapshotJson: JSON.stringify( native.sourceBundle.snapshot ), sources: [ { sourcePageId: 8, sourceRevisionId: 21,
			sourceSurfaceId: native.source.surfaceId } ], summary: fixture.literal };
}
function preparation( admission, page = admission.initialPage ) {
	const entry = admission.pages[ page - 1 ];
	return { target: copy( admission.target ), selection: copy( admission.selection ), hasLayersSlot: admission.hasLayersSlot,
		mainText: admission.mainText, baseText: admission.baseText, baseBundle: copy( admission.baseBundle ),
		anchorSurface: copy( admission.pages[ admission.initialPage - 1 ].surface ),
		context: { ...copy( admission.target ), binding: 'v1:' + admission.target.pageId + ':' + admission.target.surfaceId,
			kind: 'pdf', label: admission.label, initialPage: admission.initialPage, pageCount: admission.pageCount, page,
			stored: false, members: [], surface: copy( entry.surface ), sourceGeometry: copy( entry.sourceGeometry ), rendition: copy( entry.rendition ) } };
}
async function setup( slot = true, imported = true ) {
	const native = fixture.setup( slot ), reader = { read: jest.fn( async input => preparation( native.value.targetAdmission, input.page ) ) };
	const ordinary = { publish: jest.fn() }, api = { postWithToken: jest.fn().mockResolvedValue( success( 13 ) ) };
	const transaction = new Transaction( preparation( native.value.targetAdmission ), { reader, publisher: ordinary } );
	transaction.enableImports( native.api ); transaction.enableImportPublication( api );
	const work = { transaction, native, reader, ordinary, api }; opened.push( work );
	if ( imported ) {
		let next = 0;
		const plan = await transaction.prepareImport( { source: copy( native.value.source ), mode: 'empty', maxLayers: 100,
			allocateId: () => 'import-' + ++next } ); transaction.commitImportPlan( plan.handle );
	}
	return work;
}
function edit( work, value ) {
	const state = work.transaction.getEditorState(); state.layers[ 0 ].text = value; work.transaction.update( state );
}
const readResponse = value => ( { layersmissingpdfimportread: { version: 1, data: asciiJson( value ) } } );
afterEach( () => { for ( const work of opened.splice( 0 ) ) { work.transaction.dispose(); work.native.client.dispose(); } } );

describe( 'Explicit missing-PDF Import publication client', () => {
	it( 'sends exact Unicode byte selection, snapshot, source triples and CSRF to the native route', async () => {
		const api = { postWithToken: jest.fn().mockResolvedValue( success( 13 ) ) }, client = new Client( api ), input = request(), saved = copy( input );
		const pending = client.publish( input ); input.selection.expected = 'Changed'; input.sources[ 0 ].sourceRevisionId = 999;
		const proof = await pending;
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( api.postWithToken ).toHaveBeenCalledWith( 'csrf', { action: 'layersmissingpdfimportpublish', targetpageid: 7, baserevid: 12,
			embedstart: saved.selection.start, embedtext: saved.selection.expected, data: saved.snapshotJson,
			importsources: JSON.stringify( saved.sources ), summary: saved.summary } );
		expect( saved.selection.start ).toBeGreaterThan( 'Préface e\u0301 π\n'.length );
		expect( Client.isConfirmationFor( proof, client, saved ) ).toBe( true );
		expect( Client.isConfirmationFor( proof, client, input ) ).toBe( false );
		expect( Client.isConfirmationFor( copy( proof ), client, saved ) ).toBe( false );
		expect( Client.isConfirmationFor( proof, new Client( api ), saved ) ).toBe( false );
		expect( Object.isFrozen( proof ) ).toBe( true );
	} );
	it( 'deduplicates exact native source triples without changing first spelling or order', async () => {
		const api = { postWithToken: jest.fn().mockResolvedValue( success( 13 ) ) }, input = request();
		input.sources.push( copy( input.sources[ 0 ] ) ); await new Client( api ).publish( input );
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ) ).toEqual( [ input.sources[ 0 ] ] );
	} );
	it( 'accepts native source IDs with hyphens', async () => {
		const input = request(), api = { postWithToken: jest.fn().mockResolvedValue( success( 13 ) ) };
		input.sources[ 0 ].sourceSurfaceId = 'source-page-1'; await new Client( api ).publish( input );
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].importsources )[ 0 ].sourceSurfaceId ).toBe( 'source-page-1' );
	} );
	it.each( [
		[ 'extra request field', v => { v.mainText = ''; } ], [ 'zero owner', v => { v.pageId = 0; } ],
		[ 'fractional revision', v => { v.baseRevisionId = 1.1; } ], [ 'negative offset', v => { v.selection.start = -1; } ],
		[ 'empty embedding', v => { v.selection.expected = ''; } ], [ 'malformed Unicode', v => { v.selection.expected = '\ud800'; } ],
		[ 'oversized bytes', v => { v.snapshotJson = 'π'.repeat( 1048577 ); } ], [ 'long summary', v => { v.summary = 'x'.repeat( 501 ); } ],
		[ 'no sources', v => { v.sources = []; } ], [ 'too many sources', v => { v.sources = Array( 33 ).fill( v.sources[ 0 ] ); } ],
		[ 'foreign field', v => { v.sources[ 0 ].targetSurfaceId = 'wrong'; } ], [ 'same owner', v => { v.sources[ 0 ].sourcePageId = 7; } ],
		[ 'invalid source ID', v => { v.sources[ 0 ].sourceSurfaceId = 'bad/ID'; } ], [ 'invalid source revision', v => { v.sources[ 0 ].sourceRevisionId = 0; } ],
		[ 'array property', v => { v.sources.extra = null; } ], [ 'sparse sources', v => { delete v.sources[ 0 ]; } ]
	] )( 'refuses %s before dispatch', async ( label, mutate ) => {
		const api = { postWithToken: jest.fn() }, input = request(); mutate( input );
		await expect( new Client( api ).publish( input ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'refuses request and source-array accessors without invoking them', async () => {
		const api = { postWithToken: jest.fn() }, getter = jest.fn(), input = request();
		Object.defineProperty( input, 'selection', { get: getter, enumerable: true } );
		await expect( new Client( api ).publish( input ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		const second = request(); Object.defineProperty( second.sources, '0', { get: getter, enumerable: true } );
		await expect( new Client( api ).publish( second ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
		expect( getter ).not.toHaveBeenCalled(); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'badtoken', 'layers-edit-conflict', 'layers-source-unavailable', 'layers-revision-save-failed',
		'layers-working-copy-import-unavailable', 'layers-invalid-snapshot' ] )( 'preserves the native refusal %s safely', async code => {
		const api = { postWithToken: () => ( { then: ( resolve, reject ) => reject( 'http', { error: { code, info: 'PRIVATE' } } ) } ) };
		await expect( new Client( api ).publish( request() ) ).rejects.toMatchObject( { code, message: code } );
	} );
	it.each( [ undefined, {}, { layersmissingpdfimportpublish: { version: 1, result: 'Success', revid: 12 } },
		{ layersmissingpdfimportpublish: { version: 1, result: 'Success', revid: 13, extra: true } },
		{ layersmissingpdfimportpublish: { version: 1, result: 'Success', revid: '13' } },
		{ error: { code: 'layers-publication-failed', info: 'PRIVATE' } } ] )( 'retains unknown outcome for malformed success %#', async response => {
		await expect( new Client( { postWithToken: () => Promise.resolve( response ) } ).publish( request() ) )
			.rejects.toMatchObject( { code: 'layers-publication-outcome-unknown', message: 'layers-publication-outcome-unknown' } );
	} );
	it( 'maps synchronous transport failure and hostile error descriptors to unknown without leaking detail', async () => {
		const hostile = new Proxy( {}, { ownKeys() { throw new Error( 'PRIVATE' ); } } );
		await expect( new Client( { postWithToken() { throw hostile; } } ).publish( request() ) )
			.rejects.toMatchObject( { code: 'layers-publication-outcome-unknown', message: 'layers-publication-outcome-unknown' } );
	} );
	it( 'does not invoke response accessors and cannot accept fabricated confirmations', async () => {
		const getter = jest.fn(), response = {}; Object.defineProperty( response, 'layersmissingpdfimportpublish', { get: getter } );
		const client = new Client( { postWithToken: () => response } );
		await expect( client.publish( request() ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		expect( getter ).not.toHaveBeenCalled(); expect( Client.isConfirmationFor( { revisionId: 13 }, client, request() ) ).toBe( false );
	} );
} );

describe( 'Explicit creation transaction first Save after whole-PDF Import', () => {
	it.each( [ false, true ] )( 'publishes every target page with exact native source attribution; saved slot=%s', async slot => {
		const work = await setup( slot ), before = work.transaction.getImportPublicationState();
		const persist = jest.fn( () => {
			const staged = work.transaction.getImportPublicationState(); expect( staged.attempt.dispatchState ).toBe( 'prepared' );
			expect( staged.attempt.capsule ).toEqual( before.capsule ); expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} );
		const result = await work.transaction.saveImport( fixture.literal, persist );
		expect( result.snapshot ).toEqual( before.capsule.draft.snapshot ); expect( result.sourceReferences ).toEqual( before.capsule.sources );
		expect( result.snapshot.surfaces.slice( slot ? 3 : 0 ).map( value => value.source.page ) ).toEqual( [ 1, 2 ] );
		expect( work.transaction.getStatus() ).toMatchObject( { phase: 'confirmed', confirmedRevisionId: 13, dirty: false } );
		const saved = work.transaction.getImportPublicationState(); expect( saved.capsule ).toEqual( before.capsule );
		expect( saved.attempt ).toMatchObject( { dispatchState: 'confirmed', revisionId: 13, code: null } );
		expect( saved.attempt.request.selection ).toEqual( work.native.value.targetAdmission.selection );
		expect( JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toEqual( result.snapshot );
		expect( work.ordinary.publish ).not.toHaveBeenCalled(); expect( persist ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'preserves newer edits made during dispatch and confirms only the sent snapshot', async () => {
		const work = await setup(), pending = deferred(), dispatched = deferred(), sent = work.transaction.getImportPublicationState();
		work.api.postWithToken.mockImplementation( () => { dispatched.resolve(); return pending.promise; } );
		const saving = work.transaction.saveImport(); await dispatched.promise; edit( work, 'Newer work' );
		pending.resolve( success( 13 ) ); const result = await saving;
		expect( result.snapshot ).toEqual( sent.capsule.draft.snapshot );
		expect( result.currentSnapshot.surfaces.at( -1 ).layers[ 0 ].text ).toBe( 'Newer work' );
		expect( work.transaction.getStatus() ).toMatchObject( { phase: 'confirmed', dirty: true } );
		expect( work.transaction.getImportPublicationState().capsule.sources ).toEqual( sent.capsule.sources );
	} );
	it( 'retains the complete sent attempt on a lost response and refuses retry and ordinary reconciliation', async () => {
		const work = await setup(), before = work.transaction.getImportPublicationState();
		work.api.postWithToken.mockRejectedValue( new Error( 'network private' ) );
		await expect( work.transaction.saveImport() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		const state = work.transaction.getImportPublicationState(); expect( state.capsule ).toEqual( before.capsule );
		expect( work.transaction.getStatus().phase ).toBe( 'uncertain' );
		expect( state.attempt ).toMatchObject( { dispatchState: 'unknown', revisionId: null, code: 'layers-publication-outcome-unknown' } );
		expect( state.attempt.capsule ).toEqual( before.capsule ); edit( work, 'After interruption' );
		await expect( work.transaction.saveImport() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		await expect( work.transaction.inspectPublication( {} ) ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		await expect( work.transaction.preparePublicationReconciliation( {} ) ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( work.transaction.getImportPublicationState().attempt ).toEqual( state.attempt );
	} );
	it( 'preserves all work and references after native stale-Save refusal', async () => {
		const work = await setup(), before = work.transaction.getImportPublicationState();
		work.api.postWithToken.mockRejectedValue( { error: { code: 'layers-edit-conflict' } } );
		await expect( work.transaction.saveImport() ).rejects.toMatchObject( { code: 'layers-edit-conflict' } );
		expect( work.transaction.getStatus().phase ).toBe( 'conflict' );
		expect( work.transaction.getImportPublicationState().capsule ).toEqual( before.capsule );
		await expect( work.transaction.saveImport() ).rejects.toThrow(); expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'refuses changed native source evidence before dispatch without changing current work', async () => {
		const work = await setup(), before = work.transaction.getImportPublicationState(), changed = copy( work.native.value );
		changed.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'Changed';
		work.native.api.post.mockResolvedValueOnce( readResponse( work.native.value ) ).mockResolvedValueOnce( readResponse( changed ) );
		await expect( work.transaction.saveImport() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( work.api.postWithToken ).not.toHaveBeenCalled(); expect( work.transaction.getImportPublicationState().capsule ).toEqual( before.capsule );
		expect( work.transaction.getStatus().phase ).toBe( 'ready' );
	} );
	it( 'refuses lost source authorization before dispatch', async () => {
		const work = await setup(); work.native.api.post.mockRejectedValue( new Error( 'denied' ) );
		await expect( work.transaction.saveImport() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'requires backup persistence before any native revalidation or dispatch', async () => {
		const work = await setup(), count = work.native.api.post.mock.calls.length;
		await expect( work.transaction.saveImport( '', () => { throw new Error( 'full' ); } ) )
			.rejects.toMatchObject( { code: 'layers-draft-storage-failed' } );
		expect( work.api.postWithToken ).not.toHaveBeenCalled(); expect( work.native.api.post ).toHaveBeenCalledTimes( count );
		expect( work.transaction.getImportPublicationState().attempt.dispatchState ).toBe( 'refused' );
	} );
	it( 'repeats the host guard immediately before dispatch', async () => {
		const work = await setup(); let allowed = true;
		work.native.api.post.mockImplementation( async () => { allowed = false; return readResponse( work.native.value ); } );
		await expect( work.transaction.saveImport( '', undefined, { guard: () => { if ( !allowed ) throw new Error( 'changed' ); } } ) ).rejects.toThrow();
		expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'supports source-free Save after explicit publication opt-in', async () => {
		const work = await setup( true, false ); work.ordinary.publish.mockResolvedValue( { revisionId: 13 } );
		await work.transaction.saveImport();
		expect( work.api.postWithToken ).not.toHaveBeenCalled();
		expect( work.ordinary.publish ).toHaveBeenCalledTimes( 1 );
		expect( work.transaction.getImportPublicationState().attempt ).toMatchObject( { version: 2, dispatchState: 'confirmed' } );
		expect( () => work.transaction.enableImportPublication( work.api ) ).toThrow();
	} );
	it( 'isolates every returned capsule, attempt and request from live publication authority', async () => {
		const work = await setup(); await work.transaction.saveImport(); const original = work.transaction.getImportPublicationState();
		const changed = work.transaction.getImportPublicationState(); changed.attempt.request.sources = []; changed.capsule.sources = [];
		expect( work.transaction.getImportPublicationState() ).toEqual( original );
	} );
	it( 'disposal during dispatch never confirms or overwrites a disposed session', async () => {
		const work = await setup(), pending = deferred(), dispatched = deferred();
		work.api.postWithToken.mockImplementation( () => { dispatched.resolve(); return pending.promise; } );
		const saving = work.transaction.saveImport(); await dispatched.promise; work.transaction.dispose(); pending.resolve( success( 13 ) );
		await expect( saving ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
		expect( () => work.transaction.getStatus() ).toThrow();
	} );
	it( 'revalidates every independently owned source before dispatch and retains their exact descriptors', async () => {
		const work = await setup(), other = copy( work.native.value );
		other.source = { ...other.source, pageId: 9, owner: 'Another owner', revisionId: 22 }; other.sourceBundle.revisionId = 22;
		work.native.api.post.mockImplementation( async input => readResponse( input.sourcepageid === 9 ? other : work.native.value ) );
		let next = 0; const plan = await work.transaction.prepareImport( { source: copy( other.source ), mode: 'append', maxLayers: 100,
			allocateId: () => 'second-source-' + ++next } ); work.transaction.commitImportPlan( plan.handle );
		const before = work.native.api.post.mock.calls.length; await work.transaction.saveImport();
		expect( work.native.api.post.mock.calls.slice( before ).map( row => row[ 0 ].sourcepageid ) ).toEqual( [ 8, 9, 8, 9 ] );
		expect( JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].importsources ).map( value => value.sourcePageId ) ).toEqual( [ 8, 9 ] );
		expect( work.transaction.getImportPublicationState().attempt.capsule.sources ).toHaveLength( 2 );
	} );
	it( 'permits only an explicit new attempt after a known safe refusal', async () => {
		const work = await setup(), before = work.transaction.getImportPublicationState();
		work.api.postWithToken.mockRejectedValueOnce( { error: { code: 'badtoken' } } );
		await expect( work.transaction.saveImport() ).rejects.toMatchObject( { code: 'badtoken' } );
		expect( work.transaction.getStatus().phase ).toBe( 'ready' ); expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( work.transaction.getImportPublicationState().attempt ).toMatchObject( { sequence: 1, dispatchState: 'refused' } );
		await work.transaction.saveImport(); expect( work.api.postWithToken ).toHaveBeenCalledTimes( 2 );
		expect( work.transaction.getImportPublicationState().attempt ).toMatchObject( { sequence: 2, dispatchState: 'confirmed' } );
		expect( work.transaction.getImportPublicationState().capsule ).toEqual( before.capsule );
	} );
	it( 'refuses changed target admission after backup persistence without publishing', async () => {
		const work = await setup(), changed = copy( work.native.value ); changed.targetAdmission.mainText += '\nChanged';
		await expect( work.transaction.saveImport( '', () => { work.native.api.post.mockResolvedValue( readResponse( changed ) ); } ) ).rejects.toThrow();
		expect( work.api.postWithToken ).not.toHaveBeenCalled(); expect( work.transaction.getStatus().phase ).toBe( 'ready' );
	} );
	it( 'rejects publication methods without explicit opt-in and invalid Save arguments before recording attempts', async () => {
		const work = await setup(); const persist = jest.fn();
		await expect( work.transaction.saveImport( null, persist ) ).rejects.toThrow(); expect( persist ).not.toHaveBeenCalled();
		expect( work.transaction.getImportPublicationState().attempt ).toBeNull();
		const transaction = new Transaction( preparation( work.native.value.targetAdmission ), { reader: work.reader, publisher: work.ordinary } );
		try {
			await expect( transaction.saveImport() ).rejects.toThrow(); expect( () => transaction.getImportPublicationState() ).toThrow();
		} finally { transaction.dispose(); }
		expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
} );
