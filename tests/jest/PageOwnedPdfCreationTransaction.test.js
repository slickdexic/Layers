'use strict';

const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const PublishClient = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const deferred = () => { let resolve, reject; const promise = new Promise( ( yes, no ) => { resolve = yes; reject = no; } ); return { promise, resolve, reject }; };

function surface( page, count = 2 ) {
	return { id: Ids.surfaceId( 7, 12, 'File:Source.pdf', 'ABC', page ), kind: 'pdf', label: 'ABC',
		source: { repository: 'local', fileTitle: 'File:Source.pdf', timestamp: '20261001120000', sha1: 'a'.repeat( 31 ), page },
		canvas: { width: page === 1 ? 416 : 208, height: page === 1 ? 208 : 416,
			backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
		layers: [], metadata: { native: true, documentHint: count } };
}
function fixture( slot = false, initial = 2, page = initial, count = 2 ) {
	const anchor = surface( initial, count ), requested = surface( page, count );
	const other = surface( 1, count ); other.id = 'other-file'; other.source.fileTitle = 'File:Other.pdf';
	other.layers = [ { id: 'other-layer', type: 'text', text: 'Original sibling', unknown: null } ];
	const base = { schemaVersion: 1, metadata: { future: [ null, false, 0 ] }, surfaces: [ other,
		{ id: 'slide', kind: 'slide', label: 'ABC', canvas: { width: 400, height: 200 }, layers: [] } ] };
	return { target: { owner: 'Owner', pageId: 7, revisionId: 12, surfaceId: anchor.id },
		selection: { start: 13, expected: '[[File:Source.pdf|page=' + initial + '|layerset=ABC|Linked [[caption]]]]' },
		hasLayersSlot: slot, mainText: 'Préface π\n[[File:Source.pdf|layerset=ABC]]\nUnchanged',
		baseText: slot ? JSON.stringify( base, null, 2 ) : null,
		baseBundle: slot ? { revisionId: 12, snapshot: base, sourceGeometry: {} } : null,
		anchorSurface: anchor, context: { owner: 'Owner', pageId: 7, revisionId: 12,
			binding: 'v1:7:' + anchor.id, kind: 'pdf', label: 'ABC', initialPage: initial, pageCount: count,
			page, members: [], surface: requested, stored: false,
			sourceGeometry: { page, width: requested.canvas.width, height: requested.canvas.height, units: 'file-handler-pixels' },
			rendition: { url: '/pinned/page-' + page + '.jpg', width: requested.canvas.width, height: requested.canvas.height + ( page === 2 ? 1 : 0 ) } } };
}
function setup( slot = false, initial = 2, page = initial, count = 2 ) {
	const preparation = fixture( slot, initial, page, count );
	const reader = { read: jest.fn( async request => fixture( slot, initial, request.page, count ) ) };
	const api = { postWithToken: jest.fn().mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } ) };
	const publisher = new PublishClient( api ), transaction = new Transaction( preparation, { reader, publisher } );
	return { transaction, preparation, reader, publisher, api };
}
function edit( transaction, text ) {
	const state = transaction.getEditorState();
	state.layers = [ { id: 'page-' + transaction.getStatus().page, type: 'text', text,
		gradient: { angle: 0, colors: [ { offset: 0, color: '#f00' }, { offset: 1, color: '#00f' } ] }, unknown: null } ];
	transaction.update( state );
}
async function turn( transaction, page ) { const prepared = await transaction.preparePage( page ); transaction.commit( prepared.handle ); return prepared; }
function witness( transaction ) { return { draft: transaction.getDraft(), state: transaction.getEditorState(), status: transaction.getStatus() }; }

describe( 'Explicit missing-PDF creation transaction', () => {
	it.each( [ [ false, 1 ], [ false, 2 ], [ true, 1 ], [ true, 2 ] ] )(
		'keeps the actual base separate for slot=%s / initial=%s through first Save', async ( slot, initial ) => {
			const { transaction, preparation, api, reader } = setup( slot, initial );
			expect( transaction.getDraft().creation.baseText ).toBe( preparation.baseText );
			expect( transaction.getDraft().creation.baseBundle ).toEqual( preparation.baseBundle );
			expect( transaction.getStatus() ).toMatchObject( { page: initial, label: 'ABC', dirty: true } );
			edit( transaction, 'Initial edited' ); await turn( transaction, initial === 1 ? 2 : 1 ); edit( transaction, 'Other edited' );
			await turn( transaction, initial ); expect( transaction.getEditorState().layers[ 0 ].text ).toBe( 'Initial edited' );
			const result = await transaction.save( 'Create PDF set' );
			const request = api.postWithToken.mock.calls[ 0 ][ 1 ], sent = JSON.parse( request.data );
			expect( request ).toMatchObject( { action: 'layerspublish', owner: 'Owner', pageid: 7, baserevid: 12, summary: 'Create PDF set' } );
			expect( request ).not.toHaveProperty( 'maintext' );
			const original = preparation.baseBundle ? preparation.baseBundle.snapshot : { schemaVersion: 1, surfaces: [] };
			expect( sent.surfaces.slice( 0, original.surfaces.length ) ).toEqual( original.surfaces );
			expect( { ...sent, surfaces: [] } ).toEqual( { ...original, surfaces: [] } );
			expect( sent.surfaces.slice( original.surfaces.length ).map( member => [ member.label, member.source.page ] ) )
				.toEqual( [ [ 'ABC', 1 ], [ 'ABC', 2 ] ] );
			expect( reader.read ).toHaveBeenCalledWith( { ...preparation.target, selection: preparation.selection, page: 1 } );
			expect( result ).toMatchObject( { revisionId: 13, snapshot: sent, currentSnapshot: sent } );
			expect( transaction.getStatus() ).toMatchObject( { phase: 'confirmed', dirty: false, confirmedRevisionId: 13 } );
			await expect( transaction.save() ).rejects.toThrow();
		} );

	it( 'starts directly on the requested page without replacing it with the initial anchor', () => {
		const { transaction } = setup( false, 2, 1 );
		expect( transaction.getStatus().page ).toBe( 1 ); expect( transaction.getEditorState().canvas.width ).toBe( 416 );
		expect( transaction.getDraft().snapshot.surfaces.map( member => member.source.page ) ).toEqual( [ 2 ] );
	} );
	it( 'loads only visited pages even with a 99-page native count', async () => {
		const { transaction, reader } = setup( false, 2, 2, 99 );
		await turn( transaction, 99 ); expect( reader.read.mock.calls.map( call => call[ 0 ].page ) ).toEqual( [ 99 ] );
		expect( transaction.getDraft().snapshot.surfaces ).toHaveLength( 1 );
	} );
	it( 'removes a reverted blank optional member while retaining the explicit first-Save anchor', async () => {
		const { transaction } = setup(); const page = await turn( transaction, 1 ); edit( transaction, 'Change' );
		transaction.update( page.state ); expect( transaction.getDraft().snapshot.surfaces ).toHaveLength( 1 );
		await turn( transaction, 2 ); transaction.update( transaction.getEditorState() );
		expect( transaction.getDraft().snapshot.surfaces[ 0 ].source.page ).toBe( 2 );
	} );
	it( 'accepts native geometry independently of a one-pixel rounded rendition', () => {
		const { transaction, preparation } = setup(); expect( preparation.context.rendition.height ).toBe( 417 );
		expect( transaction.getEditorState().canvas.height ).toBe( 416 );
	} );
	it( 'uses the schema canvas bound for large native pages', () => {
		const prep = fixture(); prep.context.sourceGeometry.width = 8192; prep.context.sourceGeometry.height = 4096;
		prep.context.surface.canvas.width = 4096; prep.context.surface.canvas.height = 2048; prep.anchorSurface = copy( prep.context.surface );
		expect( new Transaction( prep, { reader: { read() {} }, publisher: { publish() {} } } ).getEditorState().canvas.width ).toBe( 4096 );
	} );

	it.each( [
		[ 'foreign owner', v => { v.context.owner = 'Other'; } ],
		[ 'foreign page ID', v => { v.context.pageId = 8; } ],
		[ 'stale revision', v => { v.context.revisionId = 11; } ],
		[ 'foreign binding', v => { v.context.binding = 'v1:7:foreign'; } ],
		[ 'changed selector', v => { v.selection.expected += '|off'; } ],
		[ 'changed main', v => { v.mainText += '\nCompeting work'; } ],
		[ 'changed slot', v => { v.hasLayersSlot = !v.hasLayersSlot; } ],
		[ 'changed raw base', v => { v.baseText += ' '; } ],
		[ 'changed sibling', v => { v.baseBundle.snapshot.surfaces[ 0 ].layers = []; } ],
		[ 'different file', v => { v.context.surface.source.fileTitle = 'File:Other.pdf'; } ],
		[ 'different pin', v => { v.context.surface.source.sha1 = 'b'.repeat( 31 ); } ],
		[ 'different page', v => { v.context.surface.source.page = 2; } ],
		[ 'different label', v => { v.context.label = v.context.surface.label = 'Other'; } ],
		[ 'changed count', v => { v.context.pageCount++; } ],
		[ 'fabricated member', v => { v.context.surface.id = 'fabricated'; } ],
		[ 'stored group', v => { v.context.members = [ { page: 2, surfaceId: v.anchorSurface.id } ]; } ],
		[ 'stored payload', v => { v.context.stored = true; } ],
		[ 'substitute payload', v => { v.context.surface.layers = [ { id: 'wrong', type: 'text', text: 'Saved page' } ]; } ],
		[ 'geometry mismatch', v => { v.context.sourceGeometry.width++; } ],
		[ 'invalid rendition', v => { v.context.rendition.url = 'javascript:alert(1)'; } ],
		[ 'control in rendition', v => { v.context.rendition.url = '/file\u0000.jpg'; } ]
	] )( 'refuses %s page without changing complete work', async ( name, mutate ) => {
		const { transaction, reader, api } = setup( true ); edit( transaction, 'Keep this' );
		const before = witness( transaction ), invalid = fixture( true, 2, 1 ); mutate( invalid );
		reader.read.mockResolvedValueOnce( invalid ); await expect( transaction.preparePage( 1 ) ).rejects.toThrow();
		expect( witness( transaction ) ).toEqual( before ); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 0, -1, 3, 2.5, '1', null, 2147483648 ] )( 'refuses invalid page %s before transport', async page => {
		const { transaction, reader } = setup(); await expect( transaction.preparePage( page ) ).rejects.toThrow();
		expect( reader.read ).not.toHaveBeenCalled();
	} );
	it.each( [ 'sparse', 'empty', 'different spelling', 'same-file image' ] )( 'refuses existing %s whole sets at startup', kind => {
		const prep = fixture( true ), stored = surface( kind === 'sparse' ? 1 : 2 ); stored.id = 'existing';
		if ( kind === 'different spelling' ) stored.label = 'abc';
		if ( kind === 'same-file image' ) stored.kind = 'image';
		prep.baseBundle.snapshot.surfaces.push( stored ); prep.baseText = JSON.stringify( prep.baseBundle.snapshot );
		expect( () => new Transaction( prep, { reader: { read() {} }, publisher: { publish() {} } } ) ).toThrow();
	} );
	it.each( [ 'null', 'raw mismatch', 'revision', 'anchor ID', 'bad source', 'too many' ] )( 'rejects invalid %s startup', kind => {
		const prep = fixture( true );
		if ( kind === 'null' ) prep.baseText = null;
		if ( kind === 'raw mismatch' ) prep.baseText = '{}';
		if ( kind === 'revision' ) prep.baseBundle.revisionId = 11;
		if ( kind === 'anchor ID' ) prep.target.surfaceId = prep.anchorSurface.id = 'invented';
		if ( kind === 'bad source' ) prep.anchorSurface.source.repository = 'remote';
		if ( kind === 'too many' ) prep.context.pageCount = 99;
		expect( () => new Transaction( prep, { reader: { read() {} }, publisher: { publish() {} } } ) ).toThrow();
	} );
	it( 'isolates preparation, transport results and every mutable output', async () => {
		const { transaction, preparation } = setup( true ); preparation.anchorSurface.canvas.width = 1;
		const draft = transaction.getDraft(); draft.creation.mainText = 'wrong'; draft.snapshot.surfaces[ 0 ].layers = [];
		const pending = await transaction.preparePage( 1 ); pending.context.surface.canvas.width = 1; pending.state.layers.push( { id: 'fake', type: 'text' } );
		transaction.commit( pending.handle ); expect( transaction.getEditorState().layers ).toEqual( [] );
		expect( transaction.getEditorState().canvas.width ).toBe( 416 );
		expect( transaction.getDraft().snapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'Original sibling' );
	} );
	it( 'does not invoke hostile accessors while cloning preparation or editor state', () => {
		const prep = fixture(), getter = jest.fn(); Object.defineProperty( prep, 'secret', { enumerable: true, get: getter } );
		expect( () => new Transaction( prep, { reader: { read() {} }, publisher: { publish() {} } } ) ).toThrow(); expect( getter ).not.toHaveBeenCalled();
		const { transaction } = setup(), input = { canvas: {}, layers: [] }; Object.defineProperty( input.canvas, 'width', { enumerable: true, get: getter } );
		expect( () => transaction.update( input ) ).toThrow(); expect( getter ).not.toHaveBeenCalled();
	} );

	it( 'refuses a prepared page after a late edit, leaving the active page intact', async () => {
		const { transaction } = setup(), prepared = await transaction.preparePage( 1 ); edit( transaction, 'Newer' ); const before = witness( transaction );
		expect( () => transaction.commit( prepared.handle ) ).toThrow(); expect( witness( transaction ) ).toEqual( before );
	} );
	it( 'refuses a page read completed after a late edit', async () => {
		const { transaction, reader } = setup(), wait = deferred(); reader.read.mockReturnValueOnce( wait.promise );
		const pending = transaction.preparePage( 1 ); edit( transaction, 'Newer' ); const before = witness( transaction );
		wait.resolve( fixture( false, 2, 1 ) ); await expect( pending ).rejects.toThrow(); expect( witness( transaction ) ).toEqual( before );
	} );
	it( 'makes handles single-use, cancelable and bound to their own transaction', async () => {
		const first = setup().transaction, second = setup().transaction, prepared = await first.preparePage( 1 );
		expect( () => second.commit( prepared.handle ) ).toThrow(); first.cancel( prepared.handle );
		expect( () => first.commit( prepared.handle ) ).toThrow(); const next = await first.preparePage( 1 ); first.commit( next.handle );
		expect( () => first.commit( next.handle ) ).toThrow();
	} );
	it( 'prevents stale overlapping page preparations from committing', async () => {
		const { transaction } = setup(), one = await transaction.preparePage( 1 ), two = await transaction.preparePage( 2 );
		transaction.commit( two.handle ); expect( () => transaction.commit( one.handle ) ).toThrow();
	} );
	it( 'invalidates the older handle as soon as another preparation begins', async () => {
		const { transaction, reader } = setup(), first = await transaction.preparePage( 1 ), wait = deferred();
		reader.read.mockReturnValueOnce( wait.promise ); const pending = transaction.preparePage( 2 );
		expect( () => transaction.commit( first.handle ) ).toThrow(); wait.resolve( fixture() );
		transaction.commit( ( await pending ).handle );
	} );
	it( 'invalidates outstanding handles even when a Save is refused', async () => {
		const { transaction, api } = setup(), first = await transaction.preparePage( 1 );
		api.postWithToken.mockRejectedValueOnce( { code: 'permissiondenied' } );
		await expect( transaction.save() ).rejects.toThrow(); expect( () => transaction.commit( first.handle ) ).toThrow();
	} );
	it.each( [ 'read pending', 'prepared', 'save pending' ] )( 'refuses destruction at %s', async boundary => {
		const { transaction, reader, api } = setup(), wait = deferred();
		if ( boundary === 'prepared' ) { const p = await transaction.preparePage( 1 ); transaction.dispose(); expect( () => transaction.commit( p.handle ) ).toThrow(); }
		if ( boundary === 'read pending' ) { reader.read.mockReturnValueOnce( wait.promise ); const p = transaction.preparePage( 1 ); transaction.dispose(); wait.resolve( fixture( false, 2, 1 ) ); await expect( p ).rejects.toThrow(); }
		if ( boundary === 'save pending' ) { const p = transaction.save( '', () => wait.promise ); transaction.dispose(); wait.resolve(); await expect( p ).rejects.toThrow(); }
		expect( () => transaction.getDraft() ).toThrow(); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'reader', 'publisher' ] )( 'refuses replaced %s participants before commit', async which => {
		const { transaction, reader, publisher } = setup(), prepared = await transaction.preparePage( 1 );
		if ( which === 'reader' ) reader.read = jest.fn(); else publisher.publish = jest.fn();
		expect( () => transaction.commit( prepared.handle ) ).toThrow();
	} );

	it.each( [ false, true ] )( 'prepares and explicitly restores same-base both-page drafts for slot=%s', async slot => {
		const original = setup( slot ).transaction; edit( original, 'Page two' ); await turn( original, 1 ); edit( original, 'Page one' );
		const draft = original.getDraft(), fresh = setup( slot ).transaction, before = witness( fresh );
		const prepared = await fresh.prepareDraft( draft ); expect( witness( fresh ) ).toEqual( before );
		prepared.draft.snapshot.surfaces = []; prepared.contexts[ 0 ].surface.layers = [];
		fresh.commit( prepared.handle ); expect( fresh.getDraft() ).toEqual( draft );
		expect( fresh.getEditorState().layers[ 0 ].text ).toBe( 'Page one' ); await turn( fresh, 2 );
		expect( fresh.getEditorState().layers[ 0 ].text ).toBe( 'Page two' );
	} );
	it.each( [
		[ 'owner', d => { d.creation.target.owner = 'Other'; } ],
		[ 'base', d => { d.creation.baseText += ' '; } ],
		[ 'sibling', d => { d.snapshot.surfaces[ 0 ].layers = []; } ],
		[ 'anchor removed', d => { d.snapshot.surfaces.pop(); } ],
		[ 'source', d => { d.snapshot.surfaces.at( -1 ).source.sha1 = 'b'.repeat( 31 ); } ],
		[ 'label', d => { d.snapshot.surfaces.at( -1 ).label = 'Other'; } ],
		[ 'member ID', d => { d.snapshot.surfaces.at( -1 ).id = 'fake'; } ],
		[ 'duplicate', d => { d.snapshot.surfaces.push( copy( d.snapshot.surfaces.at( -1 ) ) ); } ],
		[ 'extra root', d => { d.snapshot.future = true; } ],
		[ 'extra envelope', d => { d.authorization = true; } ],
		[ 'historical revision', d => { d.creation.target.revisionId--; } ]
	] )( 'refuses %s draft while preserving complete current work', async ( name, mutate ) => {
		const { transaction } = setup( true ); edit( transaction, 'Current work' ); const before = witness( transaction ), draft = transaction.getDraft();
		mutate( draft ); await expect( transaction.prepareDraft( draft ) ).rejects.toThrow(); expect( witness( transaction ) ).toEqual( before );
	} );
	it( 'revalidates recovery across every await and the final explicit commit', async () => {
		const { transaction, reader } = setup(), draft = transaction.getDraft(), wait = deferred();
		reader.read.mockReturnValueOnce( wait.promise ); const pending = transaction.prepareDraft( draft ); edit( transaction, 'Newer' );
		wait.resolve( fixture() ); await expect( pending ).rejects.toThrow();
		const prepared = await transaction.prepareDraft( draft ); edit( transaction, 'Newest' ); const before = witness( transaction );
		expect( () => transaction.commit( prepared.handle ) ).toThrow(); expect( witness( transaction ) ).toEqual( before );
	} );
	it( 'cancellation preserves both the input backup and current work', async () => {
		const { transaction } = setup(), backup = transaction.getDraft(), original = copy( backup ); edit( transaction, 'Current' );
		const before = witness( transaction ), prepared = await transaction.prepareDraft( backup ); transaction.cancel( prepared.handle );
		expect( witness( transaction ) ).toEqual( before ); expect( backup ).toEqual( original );
	} );

	it.each( [ 'permissiondenied', 'layers-source-unavailable', 'layers-invalid-snapshot', 'layers-edit-conflict', 'layers-publication-outcome-unknown' ] )(
		'preserves all model data on %s Save refusal', async code => {
			const { transaction, publisher } = setup( true ); edit( transaction, 'Keep' ); const draft = transaction.getDraft();
			// Keep the originally captured participant; refusal comes from its API transport.
			const api = publisher.api; api.postWithToken.mockRejectedValueOnce( { code } );
			await expect( transaction.save() ).rejects.toHaveProperty( 'code', code ); expect( transaction.getDraft() ).toEqual( draft );
			expect( transaction.getStatus().confirmedRevisionId ).toBeNull(); expect( transaction.getStatus().dirty ).toBe( true );
		} );
	it( 'rechecks native source and owner before first publication', async () => {
		const { transaction, reader, api } = setup(), changed = fixture(); changed.context.surface.source.sha1 = 'b'.repeat( 31 );
		reader.read.mockResolvedValueOnce( changed ); const before = transaction.getDraft();
		await expect( transaction.save() ).rejects.toThrow(); expect( api.postWithToken ).not.toHaveBeenCalled(); expect( transaction.getDraft() ).toEqual( before );
	} );
	it( 'does not confirm a base before a successful publication response', async () => {
		const { transaction, api } = setup(), wait = deferred(); api.postWithToken.mockReturnValueOnce( wait.promise );
		const pending = transaction.save(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
		expect( transaction.getStatus().confirmedRevisionId ).toBeNull();
		wait.reject( { code: 'layers-invalid-snapshot' } ); await expect( pending ).rejects.toThrow();
		expect( transaction.getStatus().confirmedRevisionId ).toBeNull();
	} );
	it( 'preserves edits made during draft storage, revalidation and publication', async () => {
		const { transaction, reader, api } = setup(), storage = deferred(), native = deferred(), publication = deferred();
		edit( transaction, 'Captured' ); reader.read.mockReturnValueOnce( native.promise ); api.postWithToken.mockReturnValueOnce( publication.promise );
		const pending = transaction.save( '', () => storage.promise ); edit( transaction, 'After draft capture' ); storage.resolve();
		await Promise.resolve(); edit( transaction, 'After native read started' ); native.resolve( fixture() );
		await Promise.resolve(); await Promise.resolve(); edit( transaction, 'After publication started' ); publication.resolve( { layerspublish: { result: 'Success', revid: 13 } } );
		const result = await pending; expect( result.snapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'Captured' );
		expect( result.currentSnapshot.surfaces[ 0 ].layers[ 0 ].text ).toBe( 'After publication started' );
		expect( transaction.getStatus().dirty ).toBe( true );
	} );
	it.each( [ 12, 11, null, '13', 2147483648 ] )( 'treats invalid confirmed revision %s as uncertain', async revisionId => {
		const { transaction, api } = setup(); api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: revisionId } } );
		await expect( transaction.save() ).rejects.toHaveProperty( 'code', 'layers-publication-outcome-unknown' );
		expect( transaction.getStatus() ).toMatchObject( { phase: 'uncertain', confirmedRevisionId: null } );
	} );
	it( 'refuses a failed draft-storage callback without publishing or losing work', async () => {
		const { transaction, api } = setup(); edit( transaction, 'Keep' ); const before = transaction.getDraft();
		await expect( transaction.save( '', async () => { throw new Error( 'Storage full' ); } ) ).rejects.toThrow();
		expect( api.postWithToken ).not.toHaveBeenCalled(); expect( transaction.getDraft() ).toEqual( before );
	} );
	it( 'refuses an inaccessible unvisited page without blocking first Save of visited work', async () => {
		const { transaction, reader, api } = setup(); edit( transaction, 'Save page two' );
		reader.read.mockRejectedValueOnce( new Error( 'Private file diagnostics' ) );
		await expect( transaction.preparePage( 1 ) ).rejects.toThrow( 'layers-editor-session-unavailable' );
		await transaction.save(); expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data ).surfaces ).toHaveLength( 1 );
	} );
	it( 'keeps Save uncertainty after a transport exception and prevents automatic retry', async () => {
		const preparation = fixture(), publisher = { publish: jest.fn().mockRejectedValue( new Error( 'Private network details' ) ) };
		const transaction = new Transaction( preparation, { reader: { read: async () => fixture() }, publisher } );
		await expect( transaction.save() ).rejects.toThrow( 'layers-publication-outcome-unknown' );
		expect( transaction.getStatus().phase ).toBe( 'uncertain' ); await expect( transaction.save() ).rejects.toThrow();
		expect( publisher.publish ).toHaveBeenCalledTimes( 1 );
	} );
	it.each( [ 'reader', 'publisher', 'dispose' ] )( 'checks %s changes during the last native await before publication', async which => {
		const { transaction, reader, publisher, api } = setup(), wait = deferred(); reader.read.mockReturnValueOnce( wait.promise );
		const pending = transaction.save();
		if ( which === 'reader' ) reader.read = jest.fn();
		if ( which === 'publisher' ) publisher.publish = jest.fn();
		if ( which === 'dispose' ) transaction.dispose();
		wait.resolve( fixture() ); await expect( pending ).rejects.toThrow(); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'keeps confirmed output isolated and permits pending newer edits for explicit handoff', async () => {
		const { transaction } = setup(); edit( transaction, 'Saved' ); const result = await transaction.save();
		result.snapshot.surfaces = []; result.currentSnapshot.surfaces = []; result.originalCreation.mainText = 'Wrong';
		expect( transaction.getDraft().snapshot.surfaces ).toHaveLength( 1 ); expect( transaction.getStatus().dirty ).toBe( false );
		edit( transaction, 'Newer after response' ); expect( transaction.getStatus().dirty ).toBe( true );
	} );
} );
