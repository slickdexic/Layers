'use strict';

const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Publisher = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );

function document( sparse = false ) {
	const pdf = page => ( { id: 'pdf-' + page, kind: 'pdf', label: 'ABC',
		source: { fileTitle: 'File:Example.pdf', timestamp: '20260101120000', sha1: 'original', page },
		canvas: { width: page === 1 ? 600 : 300, height: page === 1 ? 300 : 600,
			backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 0.75 },
		layers: [ { id: 'layer-' + page, type: 'text', text: 'Page ' + page, x: page * 10 } ],
		metadata: { preserved: page } } );
	const other = pdf( 1 ); other.id = 'other-file'; other.source.fileTitle = 'File:Other.pdf';
	const named = pdf( 1 ); named.id = 'other-name'; named.label = 'Other';
	return { schemaVersion: 1, metadata: { untouched: true }, surfaces: [
		...( sparse ? [] : [ pdf( 1 ) ] ), pdf( 2 ), other, named,
		{ id: 'slide', kind: 'slide', label: 'ABC', canvas: { width: 500, height: 500 }, layers: [] }
	] };
}

function context( snapshot, page = 2, revisionId = 12 ) {
	const members = snapshot.surfaces.filter( surface => surface.kind === 'pdf' &&
		surface.source.fileTitle === 'File:Example.pdf' && surface.label === 'ABC' );
	const stored = members.find( surface => surface.source.page === page );
	const surface = stored || { ...copy( members[ 0 ] ), id: 'missing-' + page,
		source: { ...members[ 0 ].source, page }, layers: [],
		canvas: { width: 600, height: 300, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 } };
	return copy( { owner: 'Owner', pageId: 7, revisionId, binding: 'v1:7:pdf-2', kind: 'pdf', label: 'ABC',
		initialPage: 2, pageCount: 2, page, stored: Boolean( stored ), surface,
		members: members.sort( ( left, right ) => left.source.page - right.source.page )
			.map( member => ( { page: member.source.page, surfaceId: member.id } ) ),
		sourceGeometry: { page, width: surface.canvas.width, height: surface.canvas.height, units: 'file-handler-pixels' },
		rendition: { url: 'https://example.invalid/pinned/page-' + page, width: surface.canvas.width, height: surface.canvas.height }
	} );
}

function setup( sparse = false ) {
	const snapshot = document( sparse );
	const reader = { read: jest.fn().mockResolvedValue( { revisionId: 12, snapshot } ) };
	const api = { postWithToken: jest.fn().mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } ) };
	const options = { owner: 'Owner', pageId: 7, revisionId: 12, surfaceId: 'pdf-2', pdfContext: context( snapshot ) };
	const session = new Session( options, { reader, publisher: new Publisher( api ), adapter: new Adapter() } );
	return { snapshot, reader, api, options, session };
}

function edit( session, text ) {
	const state = session.getEditorState();
	state.layers = [ { id: 'local-' + session.getPdfStatus().page, type: 'text', text,
		gradient: { type: 'linear', colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#00ff00' } ] } } ];
	session.update( state );
}

describe( 'Opt-in complete PDF session', () => {
	it.each( [ 'before', 'after' ] )( 'preserves one pending rename %s absent-member navigation', async when => {
		const { session, snapshot, api } = setup( true ); await session.load();
		if ( when === 'before' ) { session.rename( 'Abc renamed' ); }
		const blank = session.selectPdfPage( context( snapshot, 1 ) );
		if ( when === 'after' ) { session.rename( 'Abc renamed' ); }
		edit( session, 'Added' ); session.selectPdfPage( context( snapshot, 2 ) );
		const draft = session.getDraft();
		expect( draft.snapshot.surfaces.filter( surface => [ 'pdf-2', 'missing-1' ].includes( surface.id ) )
			.map( surface => surface.label ) ).toEqual( [ 'Abc renamed', 'Abc renamed' ] );
		expect( draft.snapshot.surfaces.filter( surface => ![ 'pdf-2', 'missing-1' ].includes( surface.id ) ) )
			.toEqual( snapshot.surfaces.filter( surface => surface.id !== 'pdf-2' ) );
		session.selectPdfPage( context( snapshot, 1 ) ); session.update( blank );
		expect( session.getDraft().snapshot.surfaces.some( surface => surface.id === 'missing-1' ) ).toBe( false );
		await session.save( 'Rename' );
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data ).surfaces[ 0 ].label ).toBe( 'Abc renamed' );
	} );

	it.each( [
		[ 'foreign owner', value => { value.owner = 'Other'; } ],
		[ 'foreign page', value => { value.pageId = 8; } ],
		[ 'stale revision', value => { value.revisionId = 11; } ],
		[ 'foreign binding', value => { value.binding = 'v1:7:other-file'; } ],
		[ 'changed count', value => { value.pageCount = 3; } ],
		[ 'invalid count', value => { value.pageCount = 0; } ],
		[ 'invalid page', value => { value.page = 3; } ],
		[ 'changed pin', value => { value.surface.source.sha1 = 'replacement'; } ],
		[ 'changed canvas', value => { value.surface.canvas.width++; } ],
		[ 'changed member', value => { value.surface.id = 'imposter'; } ],
		[ 'bad inventory', value => { value.members.reverse(); } ],
		[ 'non PDF', value => { value.kind = 'image'; } ],
		[ 'not stored', value => { value.stored = false; } ]
	] )( 'refuses %s context without changing any complete state', async ( name, mutate ) => {
		const { session, snapshot, api } = setup(); await session.load(); edit( session, 'Keep' );
		const before = { draft: session.getDraft(), status: session.getStatus(), pdf: session.getPdfStatus() };
		const invalid = context( snapshot, 1 ); mutate( invalid );
		expect( () => session.selectPdfPage( invalid ) ).toThrow();
		expect( { draft: session.getDraft(), status: session.getStatus(), pdf: session.getPdfStatus() } ).toEqual( before );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 'readOnly', 'mixedPin', 'duplicatePage', 'foreign', 'image' ] )( 'rejects %s startup before mode entry', async kind => {
		const { snapshot, options, reader, api } = setup();
		if ( kind === 'readOnly' ) {
			options.readOnly = true;
			expect( () => new Session( options, { reader, publisher: new Publisher( api ), adapter: new Adapter() } ) ).toThrow();
		} else {
			if ( kind === 'mixedPin' ) { snapshot.surfaces[ 0 ].source.sha1 = 'different'; }
			if ( kind === 'duplicatePage' ) { snapshot.surfaces[ 0 ].source.page = 2; }
			if ( kind === 'foreign' ) { options.pdfContext.owner = 'Other'; }
			if ( kind === 'image' ) { snapshot.surfaces[ 1 ].kind = 'image'; }
			const session = new Session( options, { reader, publisher: new Publisher( api ), adapter: new Adapter() } );
			await expect( session.load() ).rejects.toThrow();
			expect( session.getPdfStatus() ).toBeNull(); expect( session.getStatus().phase ).toBe( 'unloaded' );
		}
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'isolates every mutable constructor, selected context, editor and draft/status output', async () => {
		const { session, snapshot, options, api } = setup( true );
		options.pdfContext.surface.layers[ 0 ].text = 'Caller'; await session.load();
		const input = context( snapshot, 1 ); const state = session.selectPdfPage( input );
		input.surface.canvas.width = 999; input.surface.source.sha1 = 'Caller'; state.canvas.width = 888;
		edit( session, 'Owned' );
		const expected = session.getDraft();
		const draft = session.getDraft(); draft.snapshot.surfaces[ 0 ].layers = [];
		draft.pdf.original.sha1 = 'Caller'; session.getPdfStatus().pageCount = 99;
		expect( session.getDraft() ).toEqual( expected );
		expect( session.getEditorState().canvas.width ).toBe( 600 );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 'failed', 'unknown', 'disposed' ] )( 'preserves complete recovery work after %s Save', async kind => {
		const { session, snapshot, api } = setup(); await session.load();
		edit( session, 'Second' ); session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'First' );
		let reject;
		api.postWithToken.mockImplementationOnce( () => new Promise( ( resolve, no ) => { reject = no; } ) );
		const saving = session.save(); edit( session, 'Latest' );
		const draft = session.getDraft();
		if ( kind === 'disposed' ) { session.dispose(); }
		reject( kind === 'failed' ? { error: { code: 'permissiondenied' } } : new Error( 'network' ) );
		await expect( saving ).rejects.toThrow();
		if ( kind === 'disposed' ) {
			expect( () => session.getDraft() ).toThrow();
			expect( session.getStatus().phase ).toBe( 'disposed' );
			expect( draft.snapshot.surfaces.find( surface => surface.id === 'pdf-2' ).layers[ 0 ].text ).toBe( 'Second' );
		} else {
			expect( session.getDraft() ).toEqual( draft );
			expect( session.getStatus() ).toMatchObject( { phase: kind === 'failed' ? 'ready' : 'uncertain', dirty: true } );
			if ( kind === 'unknown' ) { expect( () => session.selectPdfPage( context( snapshot, 2 ) ) ).toThrow(); }
		}
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [ 'layers', 'canvas', 'pin', 'rename', 'deletion', 'lostAnchor', 'duplicate' ] )(
		'refuses competing %s on a dirty non-visible member atomically', async kind => {
			const { session, snapshot, reader, api } = setup(); await session.load(); edit( session, 'Second local' );
			session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'First local' );
			const before = session.getDraft(); const status = session.getStatus(); const server = copy( snapshot );
			const member = server.surfaces.find( surface => surface.id === 'pdf-2' );
			if ( kind === 'layers' ) { member.layers = [ { text: 'Competing' } ]; }
			if ( kind === 'canvas' ) { member.canvas.width++; }
			if ( kind === 'pin' ) { member.source.sha1 = 'Changed'; }
			if ( kind === 'rename' ) { member.label = 'Competing'; }
			if ( [ 'deletion', 'lostAnchor' ].includes( kind ) ) { server.surfaces = server.surfaces.filter( surface => surface.id !== member.id ); }
			if ( kind === 'duplicate' ) { server.surfaces.push( { ...copy( member ), id: 'duplicate' } ); }
			reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } );
			await expect( session.reconcile( 15 ) ).rejects.toThrow();
			expect( session.getDraft() ).toEqual( before ); expect( session.getStatus() ).toEqual( status );
			expect( api.postWithToken ).not.toHaveBeenCalled();
		} );

	it( 'recognizes complete matching published work without reposting and retains clean remote edits', async () => {
		const { session, snapshot, reader, api } = setup(); await session.load();
		edit( session, 'Second' ); session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'First' );
		const server = session.getDraft().snapshot; server.surfaces.find( surface => surface.id === 'other-file' ).layers = [ { text: 'Remote' } ];
		session.blockPublication(); reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } );
		await session.reconcile( 15 );
		expect( session.getDraft().snapshot ).toEqual( server ); expect( session.getStatus().dirty ).toBe( false );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 'page', 'id', 'targetName' ] )( 'refuses new-member %s collision without partial merge', async kind => {
		const { session, snapshot, reader, api } = setup( true ); await session.load();
		const added = context( snapshot, 1 ); session.selectPdfPage( added ); edit( session, 'Local addition' );
		if ( kind === 'targetName' ) { session.rename( 'Remote name' ); }
		const before = session.getDraft(); const server = copy( snapshot );
		const remote = copy( added.surface ); remote.id = kind === 'id' ? 'missing-1' : 'remote-addition';
		remote.layers = [ { text: 'Remote addition' } ];
		if ( kind === 'targetName' ) { remote.label = 'Remote name'; }
		server.surfaces.push( remote ); reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } );
		await expect( session.reconcile( 15 ) ).rejects.toThrow();
		expect( session.getDraft() ).toEqual( before ); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'carries case-only group rename and addition through reconciliation and one deliberate Save', async () => {
		const { session, snapshot, reader, api } = setup( true ); await session.load();
		session.rename( 'abc' ); session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'Added' );
		const expected = session.getDraft().snapshot;
		reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: copy( snapshot ) } );
		await session.reconcile( 15 ); expect( session.getDraft().snapshot ).toEqual( expected );
		expect( api.postWithToken ).not.toHaveBeenCalled();
		api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 16 } } );
		await session.save(); expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toEqual( expected );
		expect( session.getStatus().dirty ).toBe( false );
	} );

	it.each( [ 'base', 'owner', 'pin', 'id', 'unrelated', 'missingAdmission', 'duplicateContext' ] )(
		'refuses complete draft %s corruption atomically', async kind => {
			const first = setup( true ); await first.session.load(); edit( first.session, 'Second' );
			first.session.selectPdfPage( context( first.snapshot, 1 ) ); edit( first.session, 'Added' );
			const draft = first.session.getDraft(); const prepared = [ context( first.snapshot, 1 ) ];
			if ( kind === 'base' ) { draft.baseRevisionId++; }
			if ( kind === 'owner' ) { draft.owner = 'Other'; }
			if ( kind === 'pin' ) { draft.pdf.original.sha1 = 'Changed'; }
			if ( kind === 'id' ) { draft.snapshot.surfaces.at( -1 ).id = 'foreign'; }
			if ( kind === 'unrelated' ) { draft.snapshot.surfaces.find( surface => surface.id === 'slide' ).layers = [ { text: 'Corrupt' } ]; }
			if ( kind === 'missingAdmission' ) { prepared.length = 0; }
			if ( kind === 'duplicateContext' ) { prepared.push( copy( prepared[ 0 ] ) ); }
			const second = setup( true ); await second.session.load(); const before = second.session.getDraft();
			expect( () => second.session.restorePdfDraft( draft, prepared ) ).toThrow();
			expect( second.session.getDraft() ).toEqual( before ); expect( second.session.getStatus().dirty ).toBe( false );
			expect( second.api.postWithToken ).not.toHaveBeenCalled();
		} );

	it( 'preserves invalid-but-finite edits on every recovered member and rejects nonfinite export input', async () => {
		const first = setup(); await first.session.load(); edit( first.session, 'Second' );
		first.session.selectPdfPage( context( first.snapshot, 1 ) ); edit( first.session, 'First' );
		const draft = first.session.getDraft(); draft.snapshot.surfaces[ 0 ].layers[ 0 ].x = 'not a server number';
		draft.snapshot.surfaces[ 1 ].layers[ 0 ].fontSize = -100;
		const second = setup(); await second.session.load(); second.session.restorePdfDraft( draft, [] );
		expect( second.session.getDraft().snapshot ).toEqual( draft.snapshot );
		const before = second.session.getDraft(); draft.snapshot.surfaces[ 0 ].layers[ 0 ].x = Infinity;
		expect( () => second.session.restorePdfDraft( draft, [] ) ).toThrow();
		expect( second.session.getDraft() ).toEqual( before ); expect( second.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 'authorized', 'denied', 'invalid' ] )( 'does not revive disposed state after %s in-flight reconciliation', async kind => {
		const { session, snapshot, reader, api } = setup(); await session.load(); edit( session, 'Keep' );
		const draft = session.getDraft(); let finish, deny;
		reader.read.mockImplementationOnce( () => new Promise( ( resolve, reject ) => { finish = resolve; deny = reject; } ) );
		const pending = session.reconcile( 15 ); session.dispose();
		if ( kind === 'denied' ) { deny( new Error( 'Denied' ) ); }
		else { finish( { revisionId: kind === 'invalid' ? 14 : 15, snapshot } ); }
		await expect( pending ).rejects.toThrow(); expect( session.getStatus().phase ).toBe( 'disposed' );
		expect( () => session.restorePdfDraft( draft, [] ) ).toThrow(); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'publishes one complete snapshot and retains newer edits on another member during Save', async () => {
		const { session, snapshot, api } = setup(); await session.load();
		edit( session, 'Second' ); session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'First' );
		const dispatched = session.getDraft().snapshot;
		let finish;
		api.postWithToken.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
		const saving = session.save( 'Both pages' );
		expect( () => session.selectPdfPage( context( snapshot, 2 ) ) ).toThrow();
		edit( session, 'First newer' );
		finish( { layerspublish: { result: 'Success', revid: 13 } } ); await saving;
		expect( JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toEqual( dispatched );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
		expect( session.getDraft().pdf.baseSnapshot ).toEqual( dispatched );
		expect( session.getEditorState().layers[ 0 ].text ).toBe( 'First newer' );
		expect( session.getStatus().dirty ).toBe( true );
	} );

	it( 'reconciles every dirty member, retains unrelated remote work and reads latest in-flight edits', async () => {
		const { session, snapshot, reader, api } = setup(); await session.load();
		edit( session, 'Second' ); session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'First' );
		let finish;
		reader.read.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
		const merging = session.reconcile( 15 );
		expect( () => session.selectPdfPage( context( snapshot, 2 ) ) ).toThrow();
		edit( session, 'First latest' );
		const server = copy( snapshot ); server.surfaces.find( surface => surface.id === 'slide' ).layers = [ { text: 'Remote' } ];
		finish( { revisionId: 15, snapshot: server } ); await merging;
		const expected = copy( server );
		expected.surfaces.find( surface => surface.id === 'pdf-1' ).layers = session.getEditorState().layers;
		expected.surfaces.find( surface => surface.id === 'pdf-2' ).layers = [ { id: 'local-2', type: 'text', text: 'Second',
			gradient: { type: 'linear', colors: [ { offset: 0, color: '#ff0000' }, { offset: 1, color: '#00ff00' } ] } } ];
		expect( session.getDraft().snapshot ).toEqual( expected );
		expect( session.getDraft().pdf.baseSnapshot ).toEqual( server );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'exports and restores the complete same-base draft without selecting its last active page', async () => {
		const first = setup( true ); await first.session.load();
		edit( first.session, 'Second' ); const secondState = first.session.getEditorState();
		first.session.rename( 'Renamed' );
		first.session.selectPdfPage( context( first.snapshot, 1 ) ); edit( first.session, 'First' );
		const expected = copy( first.snapshot );
		Object.assign( expected.surfaces[ 0 ], secondState, { label: 'Renamed' } );
		expected.surfaces.push( { ...context( first.snapshot, 1 ).surface,
			...first.session.getEditorState(), label: 'Renamed' } );
		const draft = first.session.getDraft();
		expect( draft.snapshot ).toEqual( expected );
		const second = setup( true ); await second.session.load();
		const state = second.session.restorePdfDraft( draft, [ context( second.snapshot, 1 ) ] );
		expect( state.layers[ 0 ].text ).toBe( 'Second' );
		expect( second.session.getPdfStatus().page ).toBe( 2 );
		expect( second.session.getDraft().snapshot ).toEqual( draft.snapshot );
		expect( second.session.getDraft().surfaceId ).toBe( 'pdf-2' );
		second.session.selectPdfPage( context( second.snapshot, 1 ) );
		expect( second.session.getEditorState().layers[ 0 ].text ).toBe( 'First' );
		expect( second.session.getLabel() ).toBe( 'Renamed' );
		expect( first.api.postWithToken ).not.toHaveBeenCalled(); expect( second.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'keeps defaults outside explicit opt-in and refuses navigation/recovery', async () => {
		const { snapshot, reader, api, options } = setup(); delete options.pdfContext;
		const session = new Session( options, { reader, publisher: new Publisher( api ), adapter: new Adapter() } );
		await session.load(); expect( session.getPdfStatus() ).toBeNull();
		expect( session.getDraft() ).toEqual( { owner: 'Owner', baseRevisionId: 12, surfaceId: 'pdf-2', snapshot } );
		expect( () => session.selectPdfPage( context( snapshot, 1 ) ) ).toThrow();
		expect( () => session.restorePdfDraft( {}, [] ) ).toThrow(); expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ true, false ] )( 'never resurrects deleted stored sibling (dirty=%s)', async dirty => {
		const { session, snapshot, reader, api } = setup(); await session.load();
		if ( dirty ) { session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'Keep deleted work' ); session.selectPdfPage( context( snapshot, 2 ) ); }
		const before = session.getDraft(); const server = copy( snapshot );
		server.surfaces = server.surfaces.filter( surface => surface.id !== 'pdf-1' );
		reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } );
		if ( dirty ) {
			await expect( session.reconcile( 15 ) ).rejects.toThrow(); expect( session.getDraft() ).toEqual( before );
		} else {
			await session.reconcile( 15 ); expect( session.getDraft().snapshot ).toEqual( server ); expect( session.getStatus().dirty ).toBe( false );
		}
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'starts at page 2 with exact whole snapshot and immutable draft scope', async () => {
		const { session, snapshot, api, options } = setup();
		options.pdfContext.pageCount = 99;
		await session.load();
		expect( session.getPdfStatus() ).toEqual( { page: 2, pageCount: 2, initialPage: 2,
			anchorSurfaceId: 'pdf-2', activeSurfaceId: 'pdf-2' } );
		expect( session.getDraft().snapshot ).toEqual( snapshot );
		expect( session.getStatus().dirty ).toBe( false );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'retains every edited member across 2 -> 1 -> 2 and repeated visits', async () => {
		const { session, snapshot, api } = setup(); await session.load();
		edit( session, 'Second edit' );
		session.selectPdfPage( context( snapshot, 1 ) ); edit( session, 'First edit' );
		const expected = session.getDraft().snapshot;
		session.selectPdfPage( context( snapshot, 2 ) );
		expect( session.getDraft().snapshot ).toEqual( expected );
		expect( session.getEditorState().layers[ 0 ].text ).toBe( 'Second edit' );
		session.selectPdfPage( context( snapshot, 1 ) );
		expect( session.getDraft().snapshot ).toEqual( expected );
		expect( session.getDraft().surfaceId ).toBe( 'pdf-2' );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'keeps absent navigation clean, adds only actual edits and undoes back to absent', async () => {
		const { session, snapshot, api } = setup( true ); await session.load();
		const blank = session.selectPdfPage( context( snapshot, 1 ) );
		expect( session.getDraft().snapshot ).toEqual( snapshot );
		expect( session.getStatus().dirty ).toBe( false );
		edit( session, 'New page' );
		expect( session.getDraft().snapshot.surfaces.at( -1 ).id ).toBe( 'missing-1' );
		session.update( blank );
		expect( session.getDraft().snapshot ).toEqual( snapshot );
		expect( session.getStatus().dirty ).toBe( false );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
} );