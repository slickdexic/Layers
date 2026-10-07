'use strict';
const crypto = require( 'crypto' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Reader = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
const Publisher = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const nativeId = ( revision, label, page ) => 'd' + crypto.createHash( 'sha256' ).update( JSON.stringify( [ 77, revision, 'File:Example.pdf', label.toLowerCase(), page ] ) ).digest( 'hex' ).slice( 0, 24 );
function blank( revision, label, page ) {
	return { id: nativeId( revision, label, page ), kind: 'pdf', label,
		source: { repository: 'local', fileTitle: 'File:Example.pdf', timestamp: '20261007120000', sha1: 'pinned', page },
		canvas: { width: page === 1 ? 416 : page === 2 ? 208 : 333, height: page === 1 ? 208 : page === 2 ? 416 : 333,
			backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 }, layers: [] };
}
function document( label = 'ABC' ) {
	const anchor = blank( 12, label, 2 ); anchor.id = 'anchor'; anchor.layers = [ { id: 'anchor-layer', text: 'Anchor', x: 18, y: 22 } ];
	const other = copy( anchor ); other.id = 'other-set'; other.label = 'Other';
	const otherFile = copy( anchor ); otherFile.id = 'other-file'; otherFile.source.fileTitle = 'File:Other.pdf';
	return { schemaVersion: 1, metadata: { keep: [ 'root', { nested: true } ] }, surfaces: [ anchor, other, otherFile,
		{ id: 'slide', kind: 'slide', label: 'ABC', canvas: { width: 800, height: 500 }, layers: [ { id: 'slide-layer', text: 'Keep slide' } ] } ] };
}
function context( snapshot, page ) {
	const anchor = snapshot.surfaces[ 0 ], surface = page === 2 ? anchor : blank( 15, anchor.label, page );
	return copy( { owner: 'Example owner', pageId: 77, revisionId: 15, binding: 'v1:77:anchor', kind: 'pdf', label: anchor.label,
		initialPage: 2, pageCount: 3, page, stored: page === 2, surface, members: [ { page: 2, surfaceId: 'anchor' } ],
		sourceGeometry: { page, width: surface.canvas.width, height: surface.canvas.height, units: 'file-handler-pixels' },
		rendition: { url: 'https://example.invalid/exact/' + page, width: surface.canvas.width, height: surface.canvas.height } } );
}
function setup( label = 'ABC' ) {
	const prior = document(), current = document( label ); current.metadata.newer = 'server';
	const histories = new Map( [ [ 12, prior ], [ 13, document( 'Renamed' ) ], [ 15, current ] ] );
	const api = { get: jest.fn( options => options.owner === 'Example owner' && histories.has( options.revid ) ?
		Promise.resolve( { layersread: { revisionId: options.revid, snapshot: copy( histories.get( options.revid ) ), sourceGeometry: {} } } ) :
		Promise.reject( { error: { code: 'layers-revision-unavailable' } } ) ), postWithToken: jest.fn() };
	const session = new Session( { owner: 'Example owner', pageId: 77, revisionId: 15, surfaceId: 'anchor', pdfContext: context( current, 2 ) },
		{ reader: new Reader( api ), publisher: new Publisher( api ), adapter: new Adapter() } );
	return { prior, current, histories, api, session };
}
function draftFor( session, current, origins = [ [ 1, 12, 'ABC' ], [ 3, 12, 'ABC' ] ] ) {
	const draft = session.getDraft(), expected = copy( current );
	for ( const [ page, revision, label ] of origins ) {
		const original = blank( revision, label, page ); expected.surfaces.push( { ...copy( original ), label: current.surfaces[ 0 ].label,
			layers: [ { id: 'retained-' + page, type: 'rectangle', x: 17, y: 23, width: 31, height: 19,
				gradient: { type: 'linear', angle: 29, colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#00ff00' } ] } } ] } );
	}
	draft.snapshot = copy( expected ); draft.pdf.admissions = origins.map( ( [ page, revision, label ] ) => ( { revisionId: revision, surface: blank( revision, label, page ) } ) );
	return { draft, expected, prepared: origins.map( ( [ page ] ) => context( current, page ) ) };
}
const complete = session => ( { draft: session.getDraft(), status: session.getStatus(), selection: session.getPdfStatus(), state: session.getEditorState() } );
function deferredRead( fixture, revision ) {
	let resolve, reject, notify; const requested = new Promise( done => { notify = done; } ), normal = fixture.api.get.getMockImplementation();
	fixture.api.get.mockImplementation( options => options.revid === revision ? new Promise( ( done, fail ) => { resolve = done; reject = fail; notify(); } ) : normal( options ) );
	return { requested, resolve: value => resolve( value ), reject: value => reject( value ), normal };
}
const response = ( revision, snapshot ) => ( { layersread: { revisionId: revision, snapshot, sourceGeometry: {} } } );

describe( 'Authorized complete PDF recovery', () => {
	it.each( [ 'ABC', 'Renamed' ] )( 'restores every retained page through exact authorized history (current name %s)', async label => {
		const fixture = setup( label ); await fixture.session.load(); const { draft, prepared, expected } = draftFor( fixture.session, fixture.current );
		expect( await fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).toEqual( { canvas: fixture.current.surfaces[ 0 ].canvas, layers: fixture.current.surfaces[ 0 ].layers } );
		expect( fixture.session.getDraft().snapshot ).toEqual( expected ); expect( fixture.session.getPdfStatus().page ).toBe( 2 );
		for ( const page of [ 1, 3 ] ) { const member = expected.surfaces.find( surface => surface.id === nativeId( 12, 'ABC', page ) ); expect( fixture.session.selectPdfPage( context( fixture.current, page ) ) ).toEqual( { canvas: member.canvas, layers: member.layers } ); expect( fixture.session.getPdfStatus().activeSurfaceId ).toBe( member.id ); }
		expect( fixture.api.get.mock.calls.map( call => call[ 0 ] ) ).toEqual( [ 15, 12, 15 ].map( revid => ( { action: 'layersread', formatversion: 2, owner: 'Example owner', revid } ) ) ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'reads each distinct claimed origin once, including an actual older renamed anchor', async () => {
		const fixture = setup( 'Renamed' ); await fixture.session.load(); const { draft, prepared, expected } = draftFor( fixture.session, fixture.current, [ [ 1, 12, 'ABC' ], [ 3, 13, 'Renamed' ] ] );
		await fixture.session.restorePdfDraftWithHistory( draft, prepared ); expect( fixture.session.getDraft().snapshot ).toEqual( expected ); expect( fixture.api.get.mock.calls.map( call => call[ 0 ].revid ) ).toEqual( [ 15, 12, 13, 15 ] ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'refuses fabricated Other history with complete state unchanged', async () => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current, [ [ 1, 12, 'Other' ] ] );
		const before = complete( fixture.session ); let refused = false;
		try { await fixture.session.restorePdfDraftWithHistory( draft, prepared ); } catch ( error ) { refused = true; }
		expect( complete( fixture.session ) ).toEqual( before ); expect( refused ).toBe( true ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'anchor absent', 'anchor replaced', 'wrong initial page', 'wrong file', 'wrong pin', 'wrong label', 'wrong kind', 'stored target', 'duplicate page', 'mixed name', 'mixed pin', 'nonfinite', 'invalid snapshot' ] )( 'refuses exact older snapshot %s atomically', async kind => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ), invalid = copy( fixture.prior );
		if ( kind === 'anchor absent' ) invalid.surfaces.shift(); if ( kind === 'anchor replaced' ) invalid.surfaces[ 0 ].id = 'replacement'; if ( kind === 'wrong initial page' ) invalid.surfaces[ 0 ].source.page = 1; if ( kind === 'wrong file' ) invalid.surfaces[ 0 ].source.fileTitle = 'File:Other.pdf'; if ( kind === 'wrong pin' ) invalid.surfaces[ 0 ].source.timestamp = '20261006120000'; if ( kind === 'wrong label' ) invalid.surfaces[ 0 ].label = 'Other'; if ( kind === 'wrong kind' ) invalid.surfaces[ 0 ].kind = 'image';
		if ( kind === 'stored target' ) { const stored = blank( 12, 'ABC', 1 ); stored.id = 'already-stored'; invalid.surfaces.push( stored ); }
		if ( [ 'duplicate page', 'mixed name', 'mixed pin' ].includes( kind ) ) { const member = copy( invalid.surfaces[ 0 ] ); member.id = 'duplicate'; if ( kind === 'mixed name' ) member.label = 'abc'; if ( kind === 'mixed pin' ) member.source.sha1 = 'Other'; invalid.surfaces.push( member ); }
		if ( kind === 'nonfinite' ) invalid.metadata.keep = Infinity; if ( kind === 'invalid snapshot' ) invalid.schemaVersion = 2;
		fixture.api.get.mockImplementation( options => Promise.resolve( response( options.revid, options.revid === 12 ? invalid : fixture.current ) ) ); const before = complete( fixture.session ); await expect( fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toThrow(); expect( complete( fixture.session ) ).toEqual( before ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'older denied', 'older suppressed', 'confirmed denied', 'confirmed suppressed', 'wrong old revision', 'wrong confirmed revision', 'malformed older', 'changed confirmed snapshot' ] )( 'keeps complete work after %s and permits a fresh explicit attempt', async kind => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared, expected } = draftFor( fixture.session, fixture.current ), normal = fixture.api.get.getMockImplementation(), before = complete( fixture.session ), exported = copy( draft );
		fixture.api.get.mockImplementation( options => {
			if ( options.revid === ( kind.startsWith( 'older' ) ? 12 : 15 ) && /denied|suppressed/.test( kind ) ) return Promise.reject( { error: { code: kind.endsWith( 'denied' ) ? 'permissiondenied' : 'layers-revision-unavailable' } } );
			if ( kind === 'wrong old revision' && options.revid === 12 ) return Promise.resolve( response( 13, fixture.prior ) ); if ( kind === 'wrong confirmed revision' && options.revid === 15 ) return Promise.resolve( response( 18, fixture.current ) );
			if ( kind === 'malformed older' && options.revid === 12 ) return Promise.resolve( { layersread: {} } ); if ( kind === 'changed confirmed snapshot' && options.revid === 15 ) { const changed = copy( fixture.current ); changed.metadata.changed = 'unrelated'; return Promise.resolve( response( 15, changed ) ); } return normal( options );
		} );
		await expect( fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toThrow(); expect( complete( fixture.session ) ).toEqual( before ); expect( draft ).toEqual( exported ); fixture.api.get.mockImplementation( normal );
		await fixture.session.restorePdfDraftWithHistory( draft, prepared ); expect( fixture.session.getDraft().snapshot ).toEqual( expected ); expect( fixture.api.get.mock.calls.filter( call => call[ 0 ].revid === 12 ).length ).toBe( 2 ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'does not cache history authorization across successful attempts or changed permissions', async () => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ); await fixture.session.restorePdfDraftWithHistory( draft, prepared ); const before = complete( fixture.session );
		const normal = fixture.api.get.getMockImplementation(); fixture.api.get.mockImplementation( options => options.revid === 12 ? Promise.reject( { error: { code: 'layers-revision-unavailable' } } ) : normal( options ) );
		await expect( fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toThrow(); expect( complete( fixture.session ) ).toEqual( before ); expect( fixture.api.get.mock.calls.filter( call => call[ 0 ].revid === 12 ).length ).toBe( 2 ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'refuses failure between distinct origin reads without adding a single restored member', async () => {
		const fixture = setup( 'Renamed' ); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current, [ [ 1, 12, 'ABC' ], [ 3, 13, 'Renamed' ] ] ), normal = fixture.api.get.getMockImplementation(), before = complete( fixture.session );
		fixture.api.get.mockImplementation( options => options.revid === 13 ? Promise.reject( { error: { code: 'layers-reading-failed' } } ) : normal( options ) ); await expect( fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toMatchObject( { code: 'layers-reading-failed' } ); expect( complete( fixture.session ) ).toEqual( before ); expect( fixture.api.get.mock.calls.map( call => call[ 0 ].revid ) ).toEqual( [ 15, 12, 13 ] ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'owner', 'pageId', 'binding', 'record revision', 'record blank', 'record ID', 'unused record', 'duplicate record' ] )( 'refuses untrusted %s before any historical read', async kind => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ); if ( kind === 'owner' ) draft.owner = 'Other'; if ( kind === 'pageId' ) draft.pdf.pageId = 78; if ( kind === 'binding' ) draft.pdf.binding = 'v1:78:anchor'; if ( kind === 'record revision' ) draft.pdf.admissions[ 0 ].revisionId = 0; if ( kind === 'record blank' ) draft.pdf.admissions[ 0 ].surface.layers = [ { id: 'fake', text: 'Not blank' } ]; if ( kind === 'record ID' ) draft.pdf.admissions[ 0 ].surface.id = 'forged'; if ( kind === 'unused record' ) draft.pdf.admissions.push( { revisionId: 11, surface: blank( 11, 'ABC', 1 ) } ); if ( kind === 'duplicate record' ) draft.pdf.admissions.push( copy( draft.pdf.admissions[ 0 ] ) ); const before = complete( fixture.session );
		await expect( fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toThrow(); expect( complete( fixture.session ) ).toEqual( before ); expect( fixture.api.get ).toHaveBeenCalledTimes( 1 ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'keeps synchronous older-ID recovery strict and does not query history', async () => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ), before = complete( fixture.session ); expect( () => fixture.session.restorePdfDraft( draft, prepared ) ).toThrow(); expect( complete( fixture.session ) ).toEqual( before ); expect( fixture.api.get ).toHaveBeenCalledTimes( 1 ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'handles same-base async recovery with only confirmed-base revalidation', async () => {
		const fixture = setup(); await fixture.session.load(); const draft = fixture.session.getDraft(), added = blank( 15, 'ABC', 1 ); added.layers = [ { id: 'same-base', text: 'Keep' } ]; draft.snapshot.surfaces.push( added ); const expected = copy( draft.snapshot );
		await fixture.session.restorePdfDraftWithHistory( draft, [ context( fixture.current, 1 ) ] ); expect( fixture.session.getDraft().snapshot ).toEqual( expected ); expect( fixture.api.get.mock.calls.map( call => call[ 0 ].revid ) ).toEqual( [ 15, 15 ] ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 12, 15 ] )( 'captures isolated inputs before pending revision %i and blocks concurrent operations', async revision => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared, expected } = draftFor( fixture.session, fixture.current ), gate = deferredRead( fixture, revision );
		const pending = fixture.session.restorePdfDraftWithHistory( draft, prepared ); await gate.requested; draft.snapshot.surfaces = []; draft.pdf.admissions[ 0 ].surface.source.sha1 = 'Caller'; prepared[ 0 ].surface.canvas.width = 999;
		await expect( fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toThrow(); await expect( fixture.session.save() ).rejects.toThrow(); await expect( fixture.session.reconcile( 18 ) ).rejects.toThrow(); expect( () => fixture.session.selectPdfPage( context( fixture.current, 1 ) ) ).toThrow(); expect( () => fixture.session.rename( 'Caller rename' ) ).toThrow(); expect( () => fixture.session.restorePdfDraft( draft, prepared ) ).toThrow();
		gate.resolve( response( revision, copy( fixture.histories.get( revision ) ) ) ); const state = await pending; state.canvas.width = 999;
		expect( fixture.session.getDraft().snapshot ).toEqual( expected ); expect( fixture.session.getPdfStatus().page ).toBe( 2 ); const isolated = fixture.session.getDraft(); isolated.pdf.admissions[ 0 ].surface.canvas.width = 999; expect( fixture.session.getDraft().snapshot ).toEqual( expected ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 12, 15 ] )( 'keeps newer updates during pending revision %i instead of restoring late work', async revision => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ), gate = deferredRead( fixture, revision );
		const pending = fixture.session.restorePdfDraftWithHistory( draft, prepared ); await gate.requested; const newer = fixture.session.getEditorState(); newer.layers.push( { id: 'newer-edit', text: 'Keep newest', x: 99, y: 31 } ); fixture.session.update( newer ); const beforeCompletion = complete( fixture.session ); let refused = false;
		gate.resolve( response( revision, copy( fixture.histories.get( revision ) ) ) ); try { await pending; } catch ( error ) { refused = true; }
		expect( complete( fixture.session ) ).toEqual( beforeCompletion ); expect( refused ).toBe( true ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
		fixture.api.get.mockImplementation( gate.normal ); await fixture.session.restorePdfDraftWithHistory( draft, prepared ); expect( fixture.session.getDraft().snapshot ).toEqual( draft.snapshot );
	} );
	it( 'notices an intervening edit and undo even when complete content returns to its original value', async () => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ), gate = deferredRead( fixture, 15 ), original = fixture.session.getEditorState();
		const pending = fixture.session.restorePdfDraftWithHistory( draft, prepared ); await gate.requested; const newer = copy( original ); newer.layers.push( { id: 'temporary', text: 'Undo me' } ); fixture.session.update( newer ); fixture.session.update( original ); const before = complete( fixture.session ); gate.resolve( response( 15, copy( fixture.current ) ) ); await expect( pending ).rejects.toThrow(); expect( complete( fixture.session ) ).toEqual( before ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ [ 12, 'success' ], [ 12, 'failure' ], [ 15, 'success' ], [ 15, 'failure' ] ] )( 'does not revive disposal after late revision %i %s', async ( revision, outcome ) => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ), gate = deferredRead( fixture, revision ); const pending = fixture.session.restorePdfDraftWithHistory( draft, prepared ); await gate.requested; const exported = copy( draft ); fixture.session.dispose(); if ( outcome === 'success' ) gate.resolve( response( revision, copy( fixture.histories.get( revision ) ) ) ); else gate.reject( { error: { code: 'layers-revision-unavailable' } } ); await expect( pending ).rejects.toThrow(); expect( fixture.session.getStatus().phase ).toBe( 'disposed' ); expect( () => fixture.session.getDraft() ).toThrow(); expect( draft ).toEqual( exported ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'preserves invalid-but-finite edits, canvas, coordinates and matching fixed metadata without sanitization', async () => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current );
		for ( const [ index, member ] of draft.snapshot.surfaces.slice( -2 ).entries() ) { member.layers[ 0 ].gradient.angle = 999; member.layers[ 0 ].type = 'unknown-finite-type'; member.canvas.backgroundColor = 'not-a-color'; member.canvas.width += 7; member.metadata = { preserved: [ 'native hint' ] }; draft.pdf.admissions[ index ].surface.metadata = copy( member.metadata ); prepared[ index ].surface.metadata = copy( member.metadata ); }
		const expected = copy( draft.snapshot ); await fixture.session.restorePdfDraftWithHistory( draft, prepared ); expect( fixture.session.getDraft().snapshot ).toEqual( expected ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'rejects changed originally admitted fixed metadata rather than repairing a complete draft', async () => {
		const fixture = setup(); await fixture.session.load(); const { draft, prepared } = draftFor( fixture.session, fixture.current ), before = complete( fixture.session ); draft.pdf.admissions[ 0 ].surface.metadata = { invented: true }; await expect( fixture.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toThrow(); expect( complete( fixture.session ) ).toEqual( before ); expect( fixture.api.postWithToken ).not.toHaveBeenCalled();
	} );
} );