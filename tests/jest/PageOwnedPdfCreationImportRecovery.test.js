'use strict';
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const fixture = require( './fixtures/missingPdfImportData.js' );
const { copy, asciiJson } = fixture, opened = [];
const success = { layersmissingpdfimportpublish: { version: 1, result: 'Success', revid: 13 } };
const readResponse = value => ( { layersmissingpdfimportread: { version: 1, data: asciiJson( value ) } } );
function preparation( admission, page = admission.initialPage ) {
	const entry = admission.pages[ page - 1 ];
	return { target: copy( admission.target ), selection: copy( admission.selection ), hasLayersSlot: admission.hasLayersSlot,
		mainText: admission.mainText, baseText: admission.baseText, baseBundle: copy( admission.baseBundle ),
		anchorSurface: copy( admission.pages[ admission.initialPage - 1 ].surface ),
		context: { ...copy( admission.target ), binding: 'v1:' + admission.target.pageId + ':' + admission.target.surfaceId,
			kind: 'pdf', label: admission.label, initialPage: admission.initialPage, pageCount: admission.pageCount, page,
			stored: false, members: [], surface: copy( entry.surface ), sourceGeometry: copy( entry.sourceGeometry ), rendition: copy( entry.rendition ) } };
}
function setup( slot = true ) {
	const native = fixture.setup( slot ), reader = { read: jest.fn( async input => preparation( native.value.targetAdmission, input.page ) ) };
	const api = { postWithToken: jest.fn().mockResolvedValue( success ) }, ordinary = { publish: jest.fn() };
	const transaction = new Transaction( preparation( native.value.targetAdmission ), { reader, publisher: ordinary } );
	transaction.enableImports( native.api ); transaction.enableImportPublication( api );
	const work = { transaction, native, reader, api, ordinary }; opened.push( work ); return work;
}
function edit( work, text ) {
	const state = work.transaction.getEditorState(); state.layers = [ { id: 'local', type: 'text', text, unknown: null } ];
	work.transaction.update( state );
}
async function backup( dispatchState = 'unknown', slot = true ) {
	const work = setup( slot ); let next = 0, retained;
	const plan = await work.transaction.prepareImport( { source: copy( work.native.value.source ), mode: 'empty', maxLayers: 100,
		allocateId: () => 'recovery-layer-' + ++next } ); work.transaction.commitImportPlan( plan.handle );
	if ( dispatchState === null ) return work.transaction.getImportPublicationState();
	work.api.postWithToken.mockImplementation( () => {
		if ( dispatchState === 'dispatched' ) retained = work.transaction.getImportPublicationState();
		return dispatchState === 'confirmed' ? success : Promise.reject( { error: { code: dispatchState === 'refused' ? 'badtoken' : 'http' } } );
	} );
	try { await work.transaction.saveImport( fixture.literal, () => {
		if ( dispatchState === 'prepared' ) retained = work.transaction.getImportPublicationState();
	} ); } catch ( error ) { if ( ![ 'badtoken', 'layers-publication-outcome-unknown' ].includes( error.code ) ) throw error; }
	return retained || work.transaction.getImportPublicationState();
}
const view = work => ( { publication: work.transaction.getImportPublicationState(), status: work.transaction.getStatus(), state: work.transaction.getEditorState() } );
const deferred = () => { let resolve; const promise = new Promise( done => { resolve = done; } ); return { promise, resolve }; };
afterEach( () => { for ( const work of opened.splice( 0 ) ) { work.transaction.dispose(); work.native.client.dispose(); } } );

describe( 'Explicit same-base recovery of complete PDF Import publication state', () => {
	it.each( [ 'prepared', 'dispatched', 'unknown', 'refused', 'confirmed' ] )(
		'restores serialized %s attempts only as held uncertain work, without confirmation or retry', async dispatchState => {
			const input = await backup( dispatchState ), original = copy( input ), work = setup(), before = view( work );
			input.capsule.draft.snapshot.surfaces.at( -1 ).layers[ 0 ].text = 'Newer unsaved work';
			const prepared = await work.transaction.prepareImportPublicationRecovery( input );
			expect( view( work ) ).toEqual( before ); expect( prepared.preview ).toMatchObject( { phase: 'uncertain', confirmation: null, holdCleared: false } );
			const result = work.transaction.commitImportPublicationRecovery( prepared.handle );
			expect( result.publicationState ).toEqual( input ); expect( work.transaction.getImportPublicationState() ).toEqual( input );
			expect( work.transaction.getStatus() ).toMatchObject( { phase: 'uncertain', confirmedRevisionId: null, dirty: true } );
			expect( work.transaction.getEditorState().layers[ 0 ].text ).toBe( 'Newer unsaved work' );
			expect( work.transaction.getImportPublicationState().attempt ).toEqual( original.attempt );
			await expect( work.transaction.saveImport() ).rejects.toThrow( 'layers-editor-session-unavailable' );
			await expect( work.transaction.preparePublicationReconciliation( {} ) ).rejects.toThrow();
			expect( work.api.postWithToken ).not.toHaveBeenCalled(); expect( work.ordinary.publish ).not.toHaveBeenCalled();
		} );
	it.each( [ false, true ] )( 'recovers a source-aware draft without an attempt against original saved slot=%s', async slot => {
		const input = await backup( null, slot ), work = setup( slot ), prepared = await work.transaction.prepareImportPublicationRecovery( input );
		work.transaction.commitImportPublicationRecovery( prepared.handle );
		expect( work.transaction.getStatus() ).toMatchObject( { phase: 'ready', confirmedRevisionId: null } );
		expect( work.transaction.getImportPublicationState() ).toEqual( input ); expect( work.api.postWithToken ).not.toHaveBeenCalled();
		expect( input.capsule.draft.creation.hasLayersSlot ).toBe( slot );
	} );
	it( 'validates sent and live source groups independently when work changed after a refused Save', async () => {
		const input = await backup( 'refused' ), work = setup(), other = copy( work.native.value );
		other.source = { ...other.source, pageId: 9, owner: 'Another owner', revisionId: 22 }; other.sourceBundle.revisionId = 22;
		input.capsule.sources[ 0 ].source = copy( other.source );
		work.native.api.post.mockImplementation( async request => readResponse( request.sourcepageid === 9 ? other : work.native.value ) );
		const prepared = await work.transaction.prepareImportPublicationRecovery( input );
		work.transaction.commitImportPublicationRecovery( prepared.handle );
		expect( work.native.api.post.mock.calls.map( row => row[ 0 ].sourcepageid ) ).toEqual( [ 9, 9, 8, 8 ] );
		expect( work.transaction.getImportPublicationState() ).toEqual( input ); expect( work.transaction.getStatus().phase ).toBe( 'uncertain' );
	} );
	it.each( [
		[ 'envelope version', v => { v.version = 2; } ], [ 'extra envelope field', v => { v.confirmation = { revisionId: 13 }; } ],
		[ 'attempt version', v => { v.attempt.version = 2; } ], [ 'zero sequence', v => { v.attempt.sequence = 0; } ],
		[ 'extra proof', v => { v.attempt.proof = { revisionId: 13 }; } ], [ 'unknown status', v => { v.attempt.dispatchState = 'ready'; } ],
		[ 'unknown code', v => { v.attempt.code = 'PRIVATE'; } ], [ 'unknown revision', v => { v.attempt.revisionId = 13; } ],
		[ 'forged refused code', v => { v.attempt.dispatchState = 'refused'; } ],
		[ 'empty attempted references', v => { v.attempt.capsule.sources = []; } ],
		[ 'too many attempted references', v => { v.attempt.capsule.sources = Array( 33 ).fill( v.attempt.capsule.sources[ 0 ] ); } ],
		[ 'duplicated source group', v => { v.attempt.capsule.sources.push( copy( v.attempt.capsule.sources[ 0 ] ) ); } ],
		[ 'attempt owner', v => { v.attempt.capsule.draft.creation.target.pageId = 99; } ],
		[ 'attempt anchor', v => { v.attempt.capsule.sources[ 0 ].targetSurfaceId = 'foreign'; } ],
		[ 'attempt source owner', v => { v.attempt.capsule.sources[ 0 ].source.owner = 'Foreign'; } ],
		[ 'request owner', v => { v.attempt.request.pageId = 99; } ], [ 'request base', v => { v.attempt.request.baseRevisionId = 99; } ],
		[ 'UTF-8 byte offset', v => { v.attempt.request.selection.start--; } ],
		[ 'normalized embedding text', v => { v.attempt.request.selection.expected = v.attempt.request.selection.expected.normalize( 'NFC' ); } ],
		[ 'request source revision', v => { v.attempt.request.sources[ 0 ].sourceRevisionId++; } ],
		[ 'extra request main text', v => { v.attempt.request.mainText = ''; } ],
		[ 'extra native descriptor', v => { v.attempt.request.sources[ 0 ].targetSurfaceId = 'extra'; } ],
		[ 'sent snapshot bytes', v => { v.attempt.request.snapshotJson += ' '; } ],
		[ 'attempt geometry', v => { v.attempt.capsule.draft.snapshot.surfaces.at( -1 ).canvas.height++; } ],
		[ 'missing attempted page', v => { v.attempt.capsule.draft.snapshot.surfaces.pop(); } ],
		[ 'changed original sibling', v => { v.attempt.capsule.draft.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'Changed'; } ],
		[ 'long summary', v => { v.attempt.request.summary = 'x'.repeat( 501 ); } ],
		[ 'prepared attempt with error code', v => { v.attempt.dispatchState = 'prepared'; } ],
		[ 'live source anchor', v => { v.capsule.sources[ 0 ].targetSurfaceId = 'foreign'; } ]
	] )( 'refuses malformed %s without changing work or input backup', async ( label, mutate ) => {
		const input = await backup(), work = setup(); edit( work, 'Current work' ); mutate( input ); const original = copy( input ), before = view( work );
		await expect( work.transaction.prepareImportPublicationRecovery( input ) ).rejects.toThrow();
		expect( input ).toEqual( original ); expect( view( work ) ).toEqual( before ); expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'refuses a claimed confirmed revision that does not advance its original base', async () => {
		const input = await backup( 'confirmed' ), work = setup(); input.attempt.revisionId = 12;
		await expect( work.transaction.prepareImportPublicationRecovery( input ) ).rejects.toThrow();
		expect( work.transaction.getImportPublicationState().attempt ).toBeNull();
	} );
	it( 'refuses accessors without invoking them', async () => {
		const input = await backup(), work = setup(), getter = jest.fn(); Object.defineProperty( input.attempt, 'request', { get: getter, enumerable: true } );
		await expect( work.transaction.prepareImportPublicationRecovery( input ) ).rejects.toThrow();
		expect( getter ).not.toHaveBeenCalled(); expect( work.transaction.getImportPublicationState().attempt ).toBeNull();
	} );
	it( 'refuses changed-base native admission and preserves the complete backup', async () => {
		const input = await backup(), original = copy( input ), work = setup(), before = view( work );
		work.native.api.post.mockRejectedValue( { error: { code: 'layers-edit-conflict' } } );
		await expect( work.transaction.prepareImportPublicationRecovery( input ) ).rejects.toThrow();
		expect( input ).toEqual( original ); expect( view( work ) ).toEqual( before ); expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'refuses missing authorization of the attempted source even when the live source is readable', async () => {
		const input = await backup(), work = setup();
		work.native.api.post.mockResolvedValueOnce( readResponse( work.native.value ) ).mockResolvedValueOnce( readResponse( work.native.value ) )
			.mockRejectedValueOnce( new Error( 'denied' ) );
		await expect( work.transaction.prepareImportPublicationRecovery( input ) ).rejects.toThrow();
		expect( work.transaction.getImportPublicationState().attempt ).toBeNull();
	} );
	it( 'repeats attempted-source evidence and refuses a changed final read', async () => {
		const input = await backup(), work = setup(), changed = copy( work.native.value );
		changed.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'Changed';
		work.native.api.post.mockResolvedValueOnce( readResponse( work.native.value ) ).mockResolvedValueOnce( readResponse( work.native.value ) )
			.mockResolvedValueOnce( readResponse( work.native.value ) ).mockResolvedValueOnce( readResponse( changed ) );
		await expect( work.transaction.prepareImportPublicationRecovery( input ) ).rejects.toThrow();
		expect( work.transaction.getImportPublicationState().attempt ).toBeNull();
	} );
	it( 'preserves newer work during an asynchronous attempted-source read', async () => {
		const input = await backup(), work = setup(), pending = deferred(), started = deferred();
		work.native.api.post.mockResolvedValueOnce( readResponse( work.native.value ) ).mockResolvedValueOnce( readResponse( work.native.value ) )
			.mockImplementationOnce( () => { started.resolve(); return pending.promise; } );
		const preparing = work.transaction.prepareImportPublicationRecovery( input ); await started.promise; edit( work, 'Newer work' );
		const before = view( work ); pending.resolve( readResponse( work.native.value ) ); await expect( preparing ).rejects.toThrow();
		expect( view( work ) ).toEqual( before );
	} );
	it( 'rechecks complete live work after the final confirmation callback', async () => {
		const input = await backup(), work = setup(), prepared = await work.transaction.prepareImportPublicationRecovery( input );
		expect( () => work.transaction.commitImportPublicationRecovery( prepared.handle, () => { edit( work, 'Late edit' ); } ) ).toThrow();
		expect( work.transaction.getEditorState().layers[ 0 ].text ).toBe( 'Late edit' );
		expect( work.transaction.getImportPublicationState().attempt ).toBeNull(); expect( work.transaction.getStatus().phase ).toBe( 'ready' );
	} );
	it( 'treats handles as owned, single-use capabilities and isolates all preview data', async () => {
		const input = await backup(), work = setup(), other = setup(), prepared = await work.transaction.prepareImportPublicationRecovery( input );
		const preview = work.transaction.inspectImportPublicationRecovery( prepared.handle ); preview.publicationState.attempt.request.sources = [];
		prepared.preview.phase = 'ready'; prepared.preview.publicationState.capsule.sources = [];
		expect( () => other.transaction.commitImportPublicationRecovery( prepared.handle ) ).toThrow();
		expect( () => work.transaction.commitImportPublicationRecovery( {} ) ).toThrow();
		work.transaction.commitImportPublicationRecovery( prepared.handle ); expect( work.transaction.getImportPublicationState() ).toEqual( input );
		expect( () => work.transaction.commitImportPublicationRecovery( prepared.handle ) ).toThrow();
	} );
	it( 'release and rejected confirmation preserve current work and backups', async () => {
		const input = await backup(), original = copy( input ), work = setup(), before = view( work );
		const prepared = await work.transaction.prepareImportPublicationRecovery( input );
		expect( () => work.transaction.commitImportPublicationRecovery( prepared.handle, () => false ) ).toThrow();
		work.transaction.releaseImportPublicationRecovery( prepared.handle ); expect( view( work ) ).toEqual( before ); expect( input ).toEqual( original );
		expect( () => work.transaction.commitImportPublicationRecovery( prepared.handle ) ).toThrow();
	} );
	it( 'cannot downgrade an already held live attempt by restoring a no-attempt backup', async () => {
		const input = await backup( null ), work = setup(), prepared = await work.transaction.prepareImportPublicationRecovery( await backup() );
		work.transaction.commitImportPublicationRecovery( prepared.handle ); const before = view( work );
		await expect( work.transaction.prepareImportPublicationRecovery( input ) ).rejects.toThrow();
		await expect( work.transaction.prepareImportRecovery( input.capsule ) ).rejects.toThrow();
		expect( view( work ) ).toEqual( before ); expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'refuses a plan after disposal without granting confirmation', async () => {
		const input = await backup(), work = setup(), prepared = await work.transaction.prepareImportPublicationRecovery( input ); work.transaction.dispose();
		expect( () => work.transaction.commitImportPublicationRecovery( prepared.handle ) ).toThrow(); expect( work.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'preserves complete group references, reading order, coordinates and unknown/null values', async () => {
		const input = await backup(), work = setup();
		for ( const capsule of [ input.capsule, input.attempt.capsule ] ) {
			const page = capsule.draft.snapshot.surfaces[ 3 ];
			page.layers = [ { id: 'group', type: 'group', children: [ 'text' ] }, { id: 'text', type: 'text', parentGroup: 'group',
				x: 37.5, y: 0, text: fixture.literal, future: { value: null } } ]; page.readingOrder = [ 'text', 'group' ];
		}
		input.attempt.request.snapshotJson = JSON.stringify( input.attempt.capsule.draft.snapshot );
		const prepared = await work.transaction.prepareImportPublicationRecovery( input ); work.transaction.commitImportPublicationRecovery( prepared.handle );
		expect( work.transaction.getImportPublicationState() ).toEqual( input );
		expect( work.transaction.getImportPublicationState().capsule.draft.snapshot.surfaces[ 3 ].readingOrder ).toEqual( [ 'text', 'group' ] );
	} );
	it( 'allows an explicit first Save only after recovering a backup with no prior attempt', async () => {
		const input = await backup( null ), work = setup(), prepared = await work.transaction.prepareImportPublicationRecovery( input );
		work.transaction.commitImportPublicationRecovery( prepared.handle ); expect( work.api.postWithToken ).not.toHaveBeenCalled();
		await work.transaction.saveImport(); expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( work.transaction.getImportPublicationState().attempt ).toMatchObject( { sequence: 1, dispatchState: 'confirmed' } );
	} );
} );
