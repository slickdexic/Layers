'use strict';
const crypto = require( 'crypto' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Publisher = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const WorkingSet = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );
const nativeId = ( revision, label, page, file = 'File:Example.pdf', pageId = 77 ) => 'd' + crypto.createHash( 'sha256' )
	.update( JSON.stringify( [ pageId, revision, file, label.replace( /[\s_]+/gu, ' ' ).trim().toLowerCase(), page ] ).replace( /\//g, '\\/' )
		.replace( /[\u0080-\uffff]/g, character => '\\u' + character.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' ) ) ).digest( 'hex' ).slice( 0, 24 );
const blank = ( revision, label, page ) => ( { id: nativeId( revision, label, page ), kind: 'pdf', label,
	source: { repository: 'local', fileTitle: 'File:Example.pdf', timestamp: '20261007120000', sha1: 'pinned', page },
	canvas: { width: page === 1 ? 416 : page === 2 ? 208 : 333, height: page === 1 ? 208 : page === 2 ? 416 : 333,
		backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 }, layers: [] } );
function document() {
	const anchor = blank( 12, 'ABC', 2 ); anchor.id = 'anchor'; anchor.layers = [ { id: 'anchor-layer', type: 'text', text: 'Anchor', x: 18, y: 22 } ];
	const other = copy( anchor ); other.id = 'other-file'; other.source.fileTitle = 'File:Other.pdf';
	const named = copy( anchor ); named.id = 'other-set'; named.label = 'Other';
	return { schemaVersion: 1, metadata: { preserved: [ 'root', { nested: true } ] }, surfaces: [ anchor, other, named,
		{ id: 'slide', kind: 'slide', label: 'ABC', canvas: { width: 800, height: 500 }, layers: [ { id: 'slide-layer', text: 'Unrelated' } ] } ] };
}
function context( snapshot, revision, page ) {
	const anchor = snapshot.surfaces.find( member => member.id === 'anchor' );
	const group = snapshot.surfaces.filter( member => member.kind === 'pdf' && member.source.fileTitle === anchor.source.fileTitle && member.label === anchor.label );
	const stored = group.find( member => member.source.page === page ), surface = stored || blank( revision, anchor.label, page );
	return copy( { owner: 'Example owner', pageId: 77, revisionId: revision, binding: 'v1:77:anchor', kind: 'pdf', label: anchor.label,
		initialPage: 2, pageCount: 3, page, stored: Boolean( stored ), surface,
		members: group.slice().sort( ( left, right ) => left.source.page - right.source.page ).map( member => ( { page: member.source.page, surfaceId: member.id } ) ),
		sourceGeometry: { page, width: surface.canvas.width, height: surface.canvas.height, units: 'file-handler-pixels' },
		rendition: { url: 'https://example.invalid/pinned/' + page, width: surface.canvas.width, height: surface.canvas.height } } );
}
function setup( snapshot = document(), revision = 12 ) {
	const reader = { read: jest.fn( options => Promise.resolve( { revisionId: options.revisionId, snapshot: options.revisionId === revision ? snapshot : document() } ) ) };
	const api = { postWithToken: jest.fn().mockResolvedValue( { layerspublish: { result: 'Success', revid: revision + 1 } } ) };
	const session = new Session( { owner: 'Example owner', pageId: 77, revisionId: revision, surfaceId: 'anchor', pdfContext: context( snapshot, revision, 2 ) },
		{ reader, publisher: new Publisher( api ), adapter: new Adapter() } );
	return { session, snapshot, reader, api };
}
function edit( session, text ) {
	const state = session.getEditorState(); state.layers.push( { id: 'local-' + session.getPdfStatus().page, type: 'rectangle', x: 9, y: 7, width: 25, height: 19, name: text,
		gradient: { type: 'linear', angle: 31, colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#00ff00' } ] } } );
	state.canvas.backgroundColor = '#abcdef'; session.update( state ); return state;
}
const complete = session => ( { draft: session.getDraft(), status: session.getStatus(), selection: session.getPdfStatus(), state: session.getEditorState() } );
async function retained() {
	const fixture = setup(); await fixture.session.load(); const blanks = {}, edits = {};
	for ( const page of [ 1, 3 ] ) { blanks[ page ] = fixture.session.selectPdfPage( context( fixture.snapshot, 12, page ) ); edits[ page ] = edit( fixture.session, 'Keep ' + page ); }
	fixture.session.selectPdfPage( context( fixture.snapshot, 12, 2 ) ); const server = copy( fixture.snapshot ); server.metadata.newer = 'server'; server.surfaces[ 3 ].layers[ 0 ].text = 'New server slide';
	fixture.reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } ); await fixture.session.reconcile( 15 );
	const expected = copy( server ); for ( const page of [ 1, 3 ] ) expected.surfaces.push( Object.assign( blank( 12, 'ABC', page ), edits[ page ] ) );
	return { ...fixture, blanks, edits, server, expected };
}
describe( 'PDF member readmission', () => {
	it.each( [ [ 12, 'ABC', 1, 'd83c5b4d7d0827fa91cf07d8a' ], [ 12, 'ABC', 3, 'de73068f6804fe34c194fe162' ],
		[ 13, 'Renamed', 1, 'd2b218ddf291d61451d59b1f6' ], [ 15, 'ABC', 3, 'dd901329b14f0dc0ccb02de65' ] ] )( 'matches actual PHP witness %i:%s:%i', ( revision, label, page, id ) => {
		expect( nativeId( revision, label, page ) ).toBe( id ); expect( WorkingSet.surfaceId( 77, revision, 'File:Example.pdf', label, page ) ).toBe( id );
	} );
	it.each( [ 'ABC', 'Long_ mixed Name', '\u00c9tude \ud83d\ude00', 'A'.repeat( 255 ) ] )( 'cross-checks escaped multibyte/block identity %s', label => {
		for ( const revision of [ 1, 12, 15, 2147483647 ] ) for ( const page of [ 1, 3, 2147483647 ] ) expect( WorkingSet.surfaceId( 77, revision, 'File:Path/\u00e9.pdf', label, page ) ).toBe( nativeId( revision, label, page, 'File:Path/\u00e9.pdf' ) );
	} );
	it.each( [ 'anchor edit', 'saved rename', 'remote rename' ] )( 'renews multiple clean pages after %s without new surfaces', async kind => {
		const { session, snapshot, reader, api } = setup(); await session.load(); const blanks = [ 1, 3 ].map( page => session.selectPdfPage( context( snapshot, 12, page ) ) ); session.selectPdfPage( context( snapshot, 12, 2 ) ); const expected = copy( snapshot ); let revision = 13;
		if ( kind === 'anchor edit' ) { Object.assign( expected.surfaces[ 0 ], edit( session, 'Saved' ) ); await session.save(); }
		else if ( kind === 'saved rename' ) { session.rename( 'Renamed' ); expected.surfaces[ 0 ].label = 'Renamed'; await session.save(); }
		else { revision = 15; expected.surfaces[ 0 ].label = 'Renamed'; reader.read.mockResolvedValueOnce( { revisionId: revision, snapshot: expected } ); await session.reconcile( revision ); }
		for ( const [ index, page ] of [ 1, 3 ].entries() ) { expect( session.selectPdfPage( context( expected, revision, page ) ) ).toEqual( blanks[ index ] ); expect( session.getPdfStatus().activeSurfaceId ).toBe( nativeId( revision, expected.surfaces[ 0 ].label, page ) ); expect( session.getDraft().snapshot ).toEqual( expected ); }
		expect( session.getStatus().dirty ).toBe( false ); expect( api.postWithToken ).toHaveBeenCalledTimes( kind === 'remote rename' ? 0 : 1 );
	} );
	it( 'independently assembles the complete retained snapshot and envelope', async () => {
		const { session, server, expected, edits, api } = await retained(); const pin = copy( server.surfaces[ 0 ].source ); delete pin.page;
		expect( session.getDraft() ).toEqual( { owner: 'Example owner', baseRevisionId: 15, surfaceId: 'anchor', snapshot: expected, pdf: { version: 1, pageId: 77, binding: 'v1:77:anchor', initialPage: 2, pageCount: 3, activePage: 2, original: pin, baseSnapshot: server, admissions: [ 1, 3 ].map( page => ( { revisionId: 12, surface: blank( 12, 'ABC', page ) } ) ) } } );
		for ( const page of [ 1, 3 ] ) { expect( session.selectPdfPage( context( server, 15, page ) ) ).toEqual( edits[ page ] ); expect( session.getDraft().snapshot ).toEqual( expected ); expect( session.getPdfStatus().activeSurfaceId ).toBe( nativeId( 12, 'ABC', page ) ); }
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ false, true ] )( 'restores all members asynchronously with pending rename=%s and keeps loaded selection', async rename => {
		const { session, server, expected, edits } = await retained(); if ( rename ) { session.rename( 'Pending name' ); expected.surfaces.filter( member => member.kind === 'pdf' && member.source.fileTitle === 'File:Example.pdf' && member.label === 'ABC' ).forEach( member => { member.label = 'Pending name'; } ); }
		session.selectPdfPage( context( server, 15, 3 ) ); const draft = session.getDraft(), second = setup( server, 15 ); await second.session.load(); const input = copy( draft ), prepared = [ 1, 3 ].map( page => context( server, 15, page ) );
		await second.session.restorePdfDraftWithHistory( input, prepared ); input.snapshot.surfaces = []; input.pdf.admissions[ 0 ].surface.source.sha1 = 'Caller'; prepared[ 0 ].surface.canvas.width = 999;
		expect( second.session.getDraft().snapshot ).toEqual( expected ); expect( second.session.getPdfStatus().page ).toBe( 2 ); for ( const page of [ 1, 3 ] ) expect( second.session.selectPdfPage( context( server, 15, page ) ) ).toEqual( edits[ page ] );
		const isolated = second.session.getDraft(); isolated.pdf.admissions[ 0 ].surface.canvas.width = 999; expect( second.session.getDraft().snapshot ).toEqual( expected ); expect( second.reader.read.mock.calls.map( call => call[ 0 ] ) ).toEqual( [ { owner: 'Example owner', revisionId: 15 }, { owner: 'Example owner', revisionId: 12 }, { owner: 'Example owner', revisionId: 15 } ] ); expect( second.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'keeps additions through repeated advances and uses actual stored IDs after publication and rename', async () => {
		const { session, server, expected, edits, reader, api } = await retained(); const newer = copy( server ); newer.metadata.newer = 'second'; reader.read.mockResolvedValueOnce( { revisionId: 18, snapshot: newer } ); await session.reconcile( 18 ); expected.metadata.newer = 'second';
		for ( const page of [ 1, 3 ] ) expect( session.selectPdfPage( context( newer, 18, page ) ) ).toEqual( edits[ page ] ); api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 19 } } ); await session.save();
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toEqual( expected ); expect( session.getDraft().pdf.admissions ).toBeUndefined(); for ( const page of [ 1, 3 ] ) { expect( session.selectPdfPage( context( expected, 19, page ) ) ).toEqual( edits[ page ] ); expect( session.getPdfStatus().activeSurfaceId ).toBe( nativeId( 12, 'ABC', page ) ); }
		session.rename( 'Renamed' ); expected.surfaces.filter( member => member.kind === 'pdf' && member.source.fileTitle === 'File:Example.pdf' && member.label === 'ABC' ).forEach( member => { member.label = 'Renamed'; } ); api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 20 } } ); await session.save(); expect( session.getDraft().snapshot ).toEqual( expected ); expect( api.postWithToken ).toHaveBeenCalledTimes( 2 );
	} );
	it( 'undo-to-original-empty removes only one addition while preserving rename and siblings', async () => {
		const { session, server, expected, blanks } = await retained(); session.rename( 'Pending name' ); expected.surfaces.filter( member => member.kind === 'pdf' && member.source.fileTitle === 'File:Example.pdf' && member.label === 'ABC' ).forEach( member => { member.label = 'Pending name'; } ); session.selectPdfPage( context( server, 15, 1 ) ); session.update( blanks[ 1 ] ); expected.surfaces = expected.surfaces.filter( member => member.id !== nativeId( 12, 'ABC', 1 ) ); expect( session.getDraft().snapshot ).toEqual( expected ); expect( session.getDraft().pdf.admissions ).toEqual( [ { revisionId: 12, surface: blank( 12, 'ABC', 3 ) } ] );
	} );
	it( 'recognizes matching prior publication without duplicates', async () => {
		const { session, expected, reader, edits, api } = await retained(); reader.read.mockResolvedValueOnce( { revisionId: 18, snapshot: expected } ); await session.reconcile( 18 ); expect( session.getDraft().snapshot ).toEqual( expected ); expect( session.getStatus().dirty ).toBe( false ); expect( session.getDraft().pdf.admissions ).toBeUndefined(); for ( const page of [ 1, 3 ] ) expect( session.selectPdfPage( context( expected, 18, page ) ) ).toEqual( edits[ page ] ); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'owner', 'pageId', 'binding', 'revision', 'count', 'pin', 'canvas', 'metadata', 'id', 'page', 'inventory' ] )( 'refuses changed fresh %s atomically', async kind => {
		const { session, server, api } = await retained(); const invalid = context( server, 15, 1 );
		if ( kind === 'owner' ) invalid.owner = 'Other'; if ( kind === 'pageId' ) invalid.pageId = 78; if ( kind === 'binding' ) invalid.binding = 'v1:77:slide'; if ( kind === 'revision' ) invalid.revisionId = 12; if ( kind === 'count' ) invalid.pageCount = 4; if ( kind === 'pin' ) invalid.surface.source.sha1 = 'Other'; if ( kind === 'canvas' ) invalid.surface.canvas.width++; if ( kind === 'metadata' ) invalid.surface.metadata = { fabricated: true }; if ( kind === 'id' ) invalid.surface.id = nativeId( 15, 'ABC', 3 ); if ( kind === 'page' ) invalid.surface.source.page = 3; if ( kind === 'inventory' ) invalid.members = [];
		const before = complete( session ); expect( () => session.selectPdfPage( invalid ) ).toThrow(); expect( complete( session ) ).toEqual( before ); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'refuses same-base contradictory native ID', async () => {
		const { session, snapshot } = setup(); await session.load(); session.selectPdfPage( context( snapshot, 12, 1 ) ); edit( session, 'Keep' ); const before = complete( session ), invalid = context( snapshot, 12, 1 ); invalid.surface.id = nativeId( 13, 'ABC', 1 ); expect( () => session.selectPdfPage( invalid ) ).toThrow(); expect( complete( session ) ).toEqual( before );
	} );
	it.each( [ 'missing admission', 'omitted context', 'edited ID', 'forged ID', 'future revision', 'same revision', 'old owner', 'old file', 'old page', 'original', 'geometry', 'metadata', 'duplicate', 'unused', 'root', 'unrelated', 'collision', 'mixed name', 'unknown field', 'nonfinite' ] )( 'refuses async draft %s with no partial restore', async kind => {
		const { session, server } = await retained(); const draft = session.getDraft(), prepared = [ 1, 3 ].map( page => context( server, 15, page ) ), member = draft.snapshot.surfaces.find( surface => surface.id === nativeId( 12, 'ABC', 1 ) ), record = draft.pdf.admissions[ 0 ];
		if ( kind === 'missing admission' ) delete draft.pdf.admissions; if ( kind === 'omitted context' ) prepared.pop(); if ( kind === 'edited ID' ) member.id = 'arbitrary'; if ( kind === 'forged ID' ) member.id = record.surface.id = 'arbitrary'; if ( kind === 'future revision' ) record.revisionId = 18; if ( kind === 'same revision' ) record.revisionId = 15; if ( kind === 'old owner' ) member.id = record.surface.id = nativeId( 12, 'ABC', 1, 'File:Example.pdf', 78 ); if ( kind === 'old file' ) member.id = record.surface.id = nativeId( 12, 'ABC', 1, 'File:Other.pdf' ); if ( kind === 'old page' ) member.id = record.surface.id = nativeId( 12, 'ABC', 3 );
		if ( kind === 'original' ) record.surface.source.sha1 = 'Other'; if ( kind === 'geometry' ) record.surface.canvas.width++; if ( kind === 'metadata' ) record.surface.metadata = { fabricated: true }; if ( kind === 'duplicate' ) draft.pdf.admissions.push( copy( record ) ); if ( kind === 'unused' ) draft.pdf.admissions.push( { revisionId: 11, surface: blank( 11, 'ABC', 1 ) } ); if ( kind === 'root' ) draft.snapshot.metadata.preserved = []; if ( kind === 'unrelated' ) draft.snapshot.surfaces[ 3 ].layers = []; if ( kind === 'collision' ) member.id = 'slide'; if ( kind === 'mixed name' ) member.label = 'Other'; if ( kind === 'unknown field' ) record.trust = true; if ( kind === 'nonfinite' ) member.layers[ 0 ].x = Infinity;
		const second = setup( server, 15 ); await second.session.load(); const before = complete( second.session ); await expect( second.session.restorePdfDraftWithHistory( draft, prepared ) ).rejects.toThrow(); expect( complete( second.session ) ).toEqual( before ); expect( second.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'collision', 'deletion', 'competing edit', 'changed pin' ] )( 'preserves all work on reconciliation %s', async kind => {
		const { session, server, expected, reader, api } = await retained(); const invalid = copy( server ); if ( kind === 'collision' ) { const member = blank( 15, 'ABC', 1 ); member.layers = [ { id: 'remote', text: 'Competing' } ]; invalid.surfaces.push( member ); } if ( kind === 'deletion' ) invalid.surfaces.shift(); if ( kind === 'changed pin' ) invalid.surfaces[ 0 ].source.sha1 = 'Other'; if ( kind === 'competing edit' ) { session.selectPdfPage( context( server, 15, 2 ) ); Object.assign( expected.surfaces[ 0 ], edit( session, 'Local' ) ); invalid.surfaces[ 0 ].layers[ 0 ].text = 'Remote'; } const before = complete( session ); reader.read.mockResolvedValueOnce( { revisionId: 18, snapshot: invalid } ); await expect( session.reconcile( 18 ) ).rejects.toThrow(); expect( complete( session ) ).toEqual( before ); expect( session.getDraft().snapshot ).toEqual( expected ); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ false, true ] )( 'preserves pending Save newer edits with dispose=%s', async disposed => {
		const { session, server, expected, edits, api } = await retained(); session.selectPdfPage( context( server, 15, 1 ) ); let resolve; api.postWithToken.mockImplementationOnce( () => new Promise( done => { resolve = done; } ) ); const saving = session.save(); expect( () => session.selectPdfPage( context( server, 15, 3 ) ) ).toThrow(); const updated = copy( edits[ 1 ] ); updated.layers[ 0 ].x = 999; session.update( updated ); if ( disposed ) session.dispose(); resolve( { layerspublish: { result: 'Success', revid: 16 } } ); if ( disposed ) { await expect( saving ).rejects.toThrow(); expect( session.getStatus().phase ).toBe( 'disposed' ); } else { await saving; const next = copy( expected ); Object.assign( next.surfaces.find( member => member.id === nativeId( 12, 'ABC', 1 ) ), updated ); expect( session.getDraft().snapshot ).toEqual( next ); expect( session.getStatus().dirty ).toBe( true ); expect( session.selectPdfPage( context( expected, 16, 1 ) ) ).toEqual( updated ); } expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toEqual( expected ); expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );
	it( 'keeps synchronous same-base envelope compatibility', async () => {
		const first = setup(); await first.session.load(); first.session.selectPdfPage( context( first.snapshot, 12, 1 ) ); edit( first.session, 'Same base' ); const draft = first.session.getDraft(); expect( draft.pdf.admissions ).toBeUndefined(); const second = setup(); await second.session.load(); second.session.restorePdfDraft( draft, [ context( second.snapshot, 12, 1 ) ] ); expect( second.session.getDraft().snapshot ).toEqual( draft.snapshot ); expect( second.reader.read ).toHaveBeenCalledTimes( 1 ); expect( second.api.postWithToken ).not.toHaveBeenCalled();
	} );
} );