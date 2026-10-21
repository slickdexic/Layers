'use strict';
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const fixture = require( './fixtures/missingPdfImportData.js' );
const { copy, asciiJson } = fixture;
const opened = [];
function preparation( admission, page = admission.initialPage ) {
	const entry = admission.pages[ page - 1 ];
	return { target: copy( admission.target ), selection: copy( admission.selection ), hasLayersSlot: admission.hasLayersSlot,
		mainText: admission.mainText, baseText: admission.baseText, baseBundle: copy( admission.baseBundle ),
		anchorSurface: copy( admission.pages[ admission.initialPage - 1 ].surface ),
		context: { ...copy( admission.target ), binding: 'v1:' + admission.target.pageId + ':' + admission.target.surfaceId,
			kind: 'pdf', label: admission.label, initialPage: admission.initialPage, pageCount: admission.pageCount, page,
			stored: false, members: [], surface: copy( entry.surface ), sourceGeometry: copy( entry.sourceGeometry ), rendition: copy( entry.rendition ) } };
}
function setup( slot = true, active = 2, sparse = false, enable = true ) {
	const native = fixture.setup( slot, sparse ), reader = { read: jest.fn( async request => preparation( native.value.targetAdmission, request.page ) ) };
	const publisher = { publish: jest.fn().mockResolvedValue( { revisionId: 13 } ) };
	const transaction = new Transaction( preparation( native.value.targetAdmission, active ), { reader, publisher } );
	if ( enable ) transaction.enableImports( native.api );
	const work = { transaction, native, reader, publisher, next: 0 }; opened.push( work ); return work;
}
const request = ( work, mode = 'empty' ) => ( { source: copy( work.native.value.source ), mode, maxLayers: 100,
	allocateId: () => 'creation-import-' + ++work.next } );
const witness = work => copy( { draft: work.transaction.getImportCapsule().draft, status: work.transaction.getStatus(), state: work.transaction.getEditorState(),
	capsule: work.transaction.getImportCapsule(), attempt: work.transaction.getPublicationAttempt() } );
async function apply( work, mode = 'empty' ) {
	const value = await work.transaction.prepareImport( request( work, mode ) );
	const state = work.transaction.commitImportPlan( value.handle ); return { ...value, state };
}
async function turn( work, page ) { const value = await work.transaction.preparePage( page ); work.transaction.commit( value.handle ); }
function edit( work, text ) {
	const state = work.transaction.getEditorState(); state.layers = [ { id: 'manual-' + work.transaction.getStatus().page,
		type: 'text', text, unknown: null } ]; work.transaction.update( state );
}
const envelope = value => ( { layersmissingpdfimportread: { version: 1, data: asciiJson( value ) } } );
const deferred = () => { let resolve; const promise = new Promise( done => { resolve = done; } ); return { promise, resolve }; };

describe( 'Opt-in missing-PDF creation Import model', () => {
	afterEach( () => { for ( const work of opened.splice( 0 ) ) { work.transaction.dispose(); work.native.client.dispose(); } } );

	it.each( [ [ false, 1 ], [ false, 2 ], [ true, 1 ], [ true, 2 ] ] )(
		'prepares and atomically commits all pages with slot=%s and active=%s', async ( slot, active ) => {
			const work = setup( slot, active ), before = witness( work );
			const plan = await work.transaction.prepareImport( request( work ) );
			expect( witness( work ) ).toEqual( before ); expect( work.native.api.post ).toHaveBeenCalledTimes( 2 );
			const state = work.transaction.commitImportPlan( plan.handle );
			const capsule = work.transaction.getImportCapsule(), base = work.native.value.targetAdmission.baseBundle;
			expect( capsule.draft.creation.baseBundle ).toEqual( base );
			expect( capsule.draft.creation.baseText ).toBe( work.native.value.targetAdmission.baseText );
			expect( capsule.draft.creation.mainText ).toBe( work.native.value.targetAdmission.mainText );
			const members = capsule.draft.snapshot.surfaces.slice( base ? base.snapshot.surfaces.length : 0 );
			expect( members.map( value => [ value.label, value.source.page ] ) ).toEqual( [ [ 'A_BC', 1 ], [ 'A_BC', 2 ] ] );
			for ( const member of members ) {
				const blank = work.native.value.targetAdmission.pages[ member.source.page - 1 ].surface;
				expect( member.canvas ).toEqual( blank.canvas ); expect( member.source ).toEqual( blank.source );
				expect( member.layers ).toHaveLength( 1 );
			}
			expect( state ).toEqual( work.transaction.getEditorState() ); expect( capsule.draft.activePage ).toBe( active );
			expect( capsule.sources ).toEqual( [ { targetSurfaceId: work.native.value.targetAdmission.target.surfaceId, source: work.native.value.source } ] );
			expect( work.publisher.publish ).not.toHaveBeenCalled(); expect( work.transaction.getPublicationAttempt() ).toBeNull();
			expect( () => work.transaction.commitImportPlan( plan.handle ) ).toThrow();
		} );

	it( 'keeps sparse source pages separate while materializing every admitted target page', async () => {
		const work = setup( false, 1, true ); await apply( work );
		expect( work.transaction.getImportCapsule().draft.snapshot.surfaces.map( value => [ value.source.page, value.layers.length ] ) ).toEqual( [ [ 1, 0 ], [ 2, 1 ] ] );
		const current = work.transaction.getEditorState(); work.transaction.update( current );
		expect( work.transaction.getImportCapsule().draft.snapshot.surfaces ).toHaveLength( 2 );
		await turn( work, 2 ); expect( work.transaction.getEditorState().layers ).toHaveLength( 1 );
		await turn( work, 1 ); expect( work.transaction.getEditorState().layers ).toEqual( [] );
	} );

	it( 'preserves complete group IDs, reading order, unknown data and source coordinates without scaling', async () => {
		const work = setup(), source = work.native.value.sourceBundle.snapshot.surfaces[ 0 ];
		source.layers = [ { id: 'g', type: 'group', children: [ 't' ] }, { id: 't', type: 'text', parentGroup: 'g',
			text: fixture.literal, x: 37.5, y: 0, future: { nullValue: null } } ]; source.readingOrder = [ 't', 'g' ];
		work.native.api.post.mockImplementation( () => Promise.resolve( envelope( work.native.value ) ) );
		await apply( work );
		const page = work.transaction.getImportCapsule().draft.snapshot.surfaces.find( value => value.id === work.native.value.targetAdmission.pages[ 0 ].surface.id );
		expect( page.layers[ 0 ].children ).toEqual( [ page.layers[ 1 ].id ] );
		expect( page.layers[ 1 ] ).toMatchObject( { parentGroup: page.layers[ 0 ].id, text: fixture.literal, x: 37.5, y: 0, future: { nullValue: null } } );
		expect( page.readingOrder ).toEqual( [ page.layers[ 1 ].id, page.layers[ 0 ].id ] );
		expect( page.canvas ).toEqual( work.native.value.targetAdmission.pages[ 0 ].surface.canvas );
	} );

	it.each( [ 'append', 'replace' ] )( '%s keeps destination work or replaces the complete group as requested', async mode => {
		const work = setup(); edit( work, 'Existing page two' ); await turn( work, 1 ); edit( work, 'Existing page one' );
		await apply( work, mode ); const capsule = work.transaction.getImportCapsule();
		for ( const member of capsule.draft.snapshot.surfaces.slice( 3 ) ) {
			expect( member.layers ).toHaveLength( mode === 'append' ? 2 : 1 );
			if ( mode === 'append' ) expect( member.layers.at( -1 ).text ).toBe( member.source.page === 1 ? 'Existing page one' : 'Existing page two' );
		}
		expect( capsule.draft.snapshot.surfaces.slice( 0, 3 ) ).toEqual( work.native.value.targetAdmission.baseBundle.snapshot.surfaces );
	} );

	it( 'Cancel, release and output mutation cannot change the complete current state', async () => {
		const work = setup(), before = witness( work );
		expect( await work.transaction.prepareImport( { mode: 'cancel' } ) ).toBeNull();
		expect( work.native.api.post ).not.toHaveBeenCalled();
		const value = await work.transaction.prepareImport( request( work ) );
		value.preview.capsule.draft.snapshot.surfaces = []; value.preview.capsule.sources = [];
		const inspection = work.transaction.inspectImportPlan( value.handle ); expect( inspection.capsule.sources ).toHaveLength( 1 );
		work.transaction.releaseImportPlan( value.handle ); expect( witness( work ) ).toEqual( before );
		expect( () => work.transaction.commitImportPlan( value.handle ) ).toThrow();
	} );

	it( 'restores all pages and source references together through owned before/after checkpoints', async () => {
		const work = setup(); edit( work, 'Before Import' ); const before = work.transaction.getImportCapsule();
		const undo = work.transaction.captureImportCheckpoint(); await apply( work, 'append' );
		const after = work.transaction.getImportCapsule(), redo = work.transaction.captureImportCheckpoint();
		const undoPlan = await work.transaction.prepareImportRestore( undo );
		expect( work.transaction.getImportCapsule() ).toEqual( after );
		work.transaction.commitImportPlan( undoPlan.handle ); expect( work.transaction.getImportCapsule() ).toEqual( before );
		const redoPlan = await work.transaction.prepareImportRestore( redo );
		work.transaction.commitImportPlan( redoPlan.handle ); expect( work.transaction.getImportCapsule() ).toEqual( after );
		work.transaction.releaseImportCheckpoint( undo ); work.transaction.releaseImportCheckpoint( redo );
		await expect( work.transaction.prepareImportRestore( undo ) ).rejects.toThrow();
	} );

	it( 'recovers a serialized Import capsule only after fresh source/target reads', async () => {
		const first = setup( true, 1 ); await apply( first ); const capsule = first.transaction.getImportCapsule();
		const other = setup( true, 2 ), before = witness( other );
		const prepared = await other.transaction.prepareImportRecovery( JSON.parse( JSON.stringify( capsule ) ) );
		expect( witness( other ) ).toEqual( before ); expect( other.native.api.post ).toHaveBeenCalledTimes( 2 );
		other.transaction.commitImportPlan( prepared.handle ); expect( other.transaction.getImportCapsule() ).toEqual( capsule );
	} );

	it.each( [ 'source owner', 'source revision', 'target anchor', 'extra source field', 'duplicate group', 'source limit', 'base', 'main', 'page pin', 'geometry', 'missing member' ] )(
		'refuses invalid capsule %s without changing current work', async reason => {
			const first = setup(); await apply( first ); const capsule = first.transaction.getImportCapsule(), other = setup();
			if ( reason === 'source owner' ) capsule.sources[ 0 ].source.owner = 'Wrong';
			if ( reason === 'source revision' ) capsule.sources[ 0 ].source.revisionId++;
			if ( reason === 'target anchor' ) capsule.sources[ 0 ].targetSurfaceId = 'foreign';
			if ( reason === 'extra source field' ) capsule.sources[ 0 ].injected = true;
			if ( reason === 'duplicate group' ) capsule.sources.push( copy( capsule.sources[ 0 ] ) );
			if ( reason === 'source limit' ) capsule.sources = Array.from( { length: 33 }, () => copy( capsule.sources[ 0 ] ) );
			if ( reason === 'base' ) capsule.draft.creation.baseText += '\n';
			if ( reason === 'main' ) capsule.draft.creation.mainText += 'Changed';
			if ( reason === 'page pin' ) capsule.draft.snapshot.surfaces.at( -1 ).source.sha1 = 'x'.repeat( 31 );
			if ( reason === 'geometry' ) capsule.draft.snapshot.surfaces.at( -1 ).canvas.width++;
			if ( reason === 'missing member' ) capsule.draft.snapshot.surfaces.pop();
			edit( other, 'Keep current work' ); const before = witness( other );
			await expect( other.transaction.prepareImportRecovery( capsule ) ).rejects.toThrow(); expect( witness( other ) ).toEqual( before );
		} );

	it.each( [ 'empty on nonempty', 'append on empty', 'replace on empty', 'limit', 'duplicate IDs', 'reentrant allocator' ] )(
		'refuses invalid Import %s before any complete-model commit', async reason => {
			const work = setup(), input = request( work );
			if ( reason === 'empty on nonempty' ) edit( work, 'Keep' );
			if ( reason === 'append on empty' ) input.mode = 'append';
			if ( reason === 'replace on empty' ) input.mode = 'replace';
			if ( reason === 'limit' ) input.maxLayers = 0;
			if ( reason === 'duplicate IDs' ) input.allocateId = () => 'repeated';
			if ( reason === 'reentrant allocator' ) input.allocateId = () => { edit( work, 'Newer allocator edit' ); return 'new'; };
			const before = witness( work ); await expect( work.transaction.prepareImport( input ) ).rejects.toThrow();
			if ( reason === 'reentrant allocator' ) expect( work.transaction.getEditorState().layers[ 0 ].text ).toBe( 'Newer allocator edit' );
			else expect( witness( work ) ).toEqual( before );
		} );

	it.each( [ 'first read', 'second read', 'restore read' ] )( 'preserves newer work during pending %s', async boundary => {
		const work = setup(), waiting = deferred(); let pending;
		if ( boundary === 'restore read' ) {
			await apply( work ); const checkpoint = work.transaction.captureImportCheckpoint();
			work.native.api.post.mockReturnValueOnce( waiting.promise ); pending = work.transaction.prepareImportRestore( checkpoint );
		} else {
			if ( boundary === 'second read' ) work.native.api.post.mockResolvedValueOnce( envelope( work.native.value ) );
			work.native.api.post.mockReturnValueOnce( waiting.promise ); pending = work.transaction.prepareImport( request( work ) );
		}
		const result = pending.then( () => null, error => error );
		for ( let i = 0; i < 24; i++ ) await Promise.resolve();
		edit( work, 'Newer pending edit' ); const newer = witness( work );
		waiting.resolve( envelope( work.native.value ) ); expect( await result ).toBeInstanceOf( Error ); expect( witness( work ) ).toEqual( newer );
	} );

	it( 'refuses changed source bytes on the final read and denied Redo reauthorization', async () => {
		const work = setup(), changed = copy( work.native.value ); changed.sourceBundle.snapshot.metadata.future = 'Changed';
		work.native.api.post.mockResolvedValueOnce( envelope( work.native.value ) ).mockResolvedValueOnce( envelope( changed ) );
		const before = witness( work ); await expect( work.transaction.prepareImport( request( work ) ) ).rejects.toThrow(); expect( witness( work ) ).toEqual( before );
		await apply( work ); const redo = work.transaction.captureImportCheckpoint();
		work.native.api.post.mockRejectedValueOnce( new Error( 'Private denial' ) ); const imported = witness( work );
		await expect( work.transaction.prepareImportRestore( redo ) ).rejects.toThrow(); expect( witness( work ) ).toEqual( imported );
	} );

	it( 'requires a fresh final commit guard and refuses foreign or cloned handles', async () => {
		const work = setup(), other = setup(), value = await work.transaction.prepareImport( request( work ) ), before = witness( work );
		expect( () => other.transaction.commitImportPlan( value.handle ) ).toThrow();
		expect( () => work.transaction.commitImportPlan( { ...value.handle } ) ).toThrow();
		expect( () => work.transaction.commitImportPlan( value.handle, () => true ) ).toThrow(); expect( witness( work ) ).toEqual( before );
		expect( () => work.transaction.commitImportPlan( value.handle, () => { edit( work, 'Final newer work' ); } ) ).toThrow();
		expect( work.transaction.getEditorState().layers[ 0 ].text ).toBe( 'Final newer work' );
	} );

	it( 'invalidates an outstanding plan on page navigation and disposal', async () => {
		const work = setup(), first = await work.transaction.prepareImport( request( work ) ); await turn( work, 1 );
		expect( () => work.transaction.commitImportPlan( first.handle ) ).toThrow();
		const second = await work.transaction.prepareImport( request( work ) ); work.transaction.dispose();
		expect( () => work.transaction.commitImportPlan( second.handle ) ).toThrow(); work.transaction.releaseImportPlan( second.handle );
	} );

	it( 'blocks ordinary Save and recovery after opt-in before attempts, callbacks or writes', async () => {
		const work = setup(), before = witness( work ), callback = jest.fn();
		await expect( work.transaction.save( 'Unsafe ordinary route', callback ) ).rejects.toThrow();
		await expect( work.transaction.prepareDraft( before.draft ) ).rejects.toThrow();
		expect( callback ).not.toHaveBeenCalled(); expect( work.publisher.publish ).not.toHaveBeenCalled(); expect( witness( work ) ).toEqual( before );
		await apply( work ); const imported = witness( work );
		await expect( work.transaction.save() ).rejects.toThrow(); expect( witness( work ) ).toEqual( imported );
	} );

	it( 'preserves the ordinary transaction defaults and refuses Import without explicit opt-in', async () => {
		const work = setup( false, 2, false, false ); edit( work, 'Ordinary edit' ); const before = work.transaction.getDraft();
		await expect( work.transaction.prepareImport( request( work ) ) ).rejects.toThrow();
		expect( work.transaction.getDraft() ).toEqual( before );
		expect( await work.transaction.save() ).toMatchObject( { revisionId: 13 } ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
		expect( work.native.api.post ).not.toHaveBeenCalled();
	} );

	it( 'deduplicates one source group even when another stored page is selected as its anchor', async () => {
		const work = setup(); await apply( work );
		const another = copy( work.native.value ); another.source.surfaceId = another.sourceGroup.members[ 1 ].surfaceId;
		work.native.api.post.mockImplementation( () => Promise.resolve( envelope( another ) ) );
		const next = request( work, 'append' ); next.source = copy( another.source );
		const plan = await work.transaction.prepareImport( next ); work.transaction.commitImportPlan( plan.handle );
		expect( work.transaction.getImportCapsule().sources ).toHaveLength( 1 );
		expect( work.transaction.getImportCapsule().sources[ 0 ].source.surfaceId ).toBe( work.native.value.source.surfaceId );
		expect( work.transaction.getImportCapsule().draft.snapshot.surfaces.at( -1 ).layers ).toHaveLength( 2 );
	} );

	it( 'retains independent source owners on Append and resets the references on Replace', async () => {
		const work = setup(); await apply( work ); const other = copy( work.native.value );
		other.source.pageId = 9; other.source.owner = 'Another_source';
		work.native.api.post.mockImplementation( () => Promise.resolve( envelope( other ) ) );
		const appended = request( work, 'append' ); appended.source = copy( other.source );
		const append = await work.transaction.prepareImport( appended ); work.transaction.commitImportPlan( append.handle );
		expect( work.transaction.getImportCapsule().sources.map( value => value.source.pageId ) ).toEqual( [ 8, 9 ] );
		const replaced = request( work, 'replace' ); replaced.source = copy( other.source );
		const replace = await work.transaction.prepareImport( replaced ); work.transaction.commitImportPlan( replace.handle );
		expect( work.transaction.getImportCapsule().sources.map( value => value.source.pageId ) ).toEqual( [ 9 ] );
	} );

	it( 'isolates serialized capsules, checkpoint inspection and preparation outputs', async () => {
		const work = setup(); await apply( work ); const before = witness( work ), checkpoint = work.transaction.captureImportCheckpoint();
		const capsule = work.transaction.getImportCapsule(); capsule.sources[ 0 ].source.owner = 'Changed'; capsule.draft.snapshot.surfaces = [];
		const inspected = work.transaction.inspectImportCheckpoint( checkpoint ); inspected.sources = [];
		const plan = await work.transaction.prepareImportRestore( checkpoint ); plan.preview.capsule.sources = []; plan.preview.state.layers = [];
		expect( witness( work ) ).toEqual( before ); work.transaction.commitImportPlan( plan.handle ); expect( witness( work ) ).toEqual( before );
	} );

	it( 'refuses request accessors without invocation and preserves the allocator receiver contract', async () => {
		const work = setup(), getter = jest.fn(), invalid = request( work );
		Object.defineProperty( invalid, 'source', { enumerable: true, get: getter } );
		await expect( work.transaction.prepareImport( invalid ) ).rejects.toThrow(); expect( getter ).not.toHaveBeenCalled();
		expect( work.native.api.post ).not.toHaveBeenCalled();
		const valid = request( work ), receivers = [];
		valid.allocateId = function () { receivers.push( this ); return 'new-receiver-' + receivers.length; };
		const plan = await work.transaction.prepareImport( valid ); work.transaction.commitImportPlan( plan.handle );
		expect( receivers ).toEqual( [ undefined, undefined ] );
	} );

	it( 'invalidates a pending native read on disposal without producing a reusable plan', async () => {
		const work = setup(), waiting = deferred(); work.native.api.post.mockReturnValueOnce( waiting.promise );
		const outcome = work.transaction.prepareImport( request( work ) ).then( () => null, error => error );
		work.transaction.dispose(); waiting.resolve( envelope( work.native.value ) ); expect( await outcome ).toBeInstanceOf( Error );
		expect( work.publisher.publish ).not.toHaveBeenCalled();
	} );

	it( 'accepts 32 reauthorized source groups and refuses a 33rd without partial changes', async () => {
		const work = setup(); await apply( work ); const capsule = work.transaction.getImportCapsule();
		capsule.sources = Array.from( { length: 32 }, ( _, index ) => ( {
			targetSurfaceId: capsule.draft.creation.target.surfaceId,
			source: { ...work.native.value.source, owner: 'Independent_source_' + index, pageId: 100 + index }
		} ) );
		const extra = { ...work.native.value.source, owner: 'Additional_source', pageId: 200 };
		work.native.api.post.mockImplementation( params => {
			const value = copy( work.native.value );
			value.source = copy( params.sourcepageid === extra.pageId ? extra : capsule.sources.find( entry => entry.source.pageId === params.sourcepageid ).source );
			return Promise.resolve( envelope( value ) );
		} );
		const restore = await work.transaction.prepareImportRecovery( capsule ); work.transaction.commitImportPlan( restore.handle );
		expect( work.transaction.getImportCapsule().sources ).toHaveLength( 32 );
		const before = witness( work ), input = request( work, 'append' ); input.source = extra;
		await expect( work.transaction.prepareImport( input ) ).rejects.toThrow(); expect( witness( work ) ).toEqual( before );
	} );

	it( 'refuses ordinary draft export that would discard the active Import source references', async () => {
		const work = setup(); await apply( work );
		expect( work.transaction.getImportCapsule().sources ).toHaveLength( 1 );
		expect( () => work.transaction.getDraft() ).toThrow( 'layers-editor-session-unavailable' );
	} );
} );
