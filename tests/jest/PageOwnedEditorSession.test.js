'use strict';

const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Publisher = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const fixture = require( '../fixtures/revisions/mixed-document-v1.json' );

function deferred() {
	let resolve, reject;
	const promise = new Promise( ( yes, no ) => { resolve = yes; reject = no; } );
	return { promise, resolve, reject };
}

describe( 'PageOwnedEditorSession', () => {
	let session, reader, api, options;

	it( 'persists saving-phase recovery information before dispatching a POST', async () => {
		await session.load();
		await session.save( 'Save', () => {
			expect( session.getStatus().phase ).toBe( 'saving' );
			expect( api.postWithToken ).not.toHaveBeenCalled();
		} );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'aborts publication when pre-publication draft persistence fails', async () => {
		await session.load();
		edit( 777 );
		await expect( session.save( '', () => { throw new Error( 'private storage failure' ); } ) )
			.rejects.toMatchObject( { code: 'layers-draft-storage-failed', message: 'layers-draft-storage-failed' } );
		expect( session.getStatus() ).toMatchObject( { phase: 'ready', revisionId: 12, dirty: true } );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );
	beforeEach( () => {
		reader = { read: jest.fn().mockResolvedValue( { revisionId: 12, snapshot: fixture } ) };
		api = { postWithToken: jest.fn().mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } ) };
		options = { owner: 'Owner', revisionId: 12, surfaceId: fixture.surfaces[ 0 ].id };
		session = new Session( options, { reader, publisher: new Publisher( api ), adapter: new Adapter() } );
	} );

	it.each( [ null, '1', true, 0, -1, 1.5, NaN, Infinity, 2147483648 ] )(
		'rejects invalid PageID %s before reading or publishing', ( pageId ) => {
			expect( () => new Session( { ...options, pageId }, {
				reader, publisher: new Publisher( api ), adapter: new Adapter()
			} ) ).toThrow( 'layers-invalid-editor-session' );
			expect( reader.read ).not.toHaveBeenCalled();
			expect( api.postWithToken ).not.toHaveBeenCalled();
		}
	);

	it.each( [ 1, 2147483647 ] )( 'retains PageID %s across reconciliation and repeated saves', async ( pageId ) => {
		options.pageId = pageId;
		session = new Session( options, { reader, publisher: new Publisher( api ), adapter: new Adapter() } );
		options.pageId = 999;
		await session.load();
		await session.save();
		reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: fixture } );
		await session.reconcile( 15 );
		api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 16 } } );
		await session.save();
		expect( api.postWithToken.mock.calls.map( ( call ) => call[ 1 ].pageid ) ).toEqual( [ pageId, pageId ] );
		expect( api.postWithToken.mock.calls[ 1 ][ 1 ].baserevid ).toBe( 15 );
	} );

	function edit( width ) {
		const state = session.getEditorState();
		state.canvas.width = width;
		session.update( state );
	}

	it( 'reconciles unrelated server changes while preserving local edits and requiring a deliberate save', async () => {
		await session.load();
		edit( 777 );
		session.blockPublication();
		const server = JSON.parse( JSON.stringify( fixture ) );
		server.surfaces[ 1 ].label = 'New server label';
		server.extensionMetadata = { retained: true };
		reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } );
		expect( await session.reconcile( 15 ) ).toMatchObject( { phase: 'ready', revisionId: 15, dirty: true } );
		expect( session.getEditorState().canvas.width ).toBe( 777 );
		expect( session.getDraft().snapshot.surfaces[ 1 ] ).toEqual( server.surfaces[ 1 ] );
		expect( session.getDraft().snapshot.extensionMetadata ).toEqual( { retained: true } );
		expect( api.postWithToken ).not.toHaveBeenCalled();
		api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 16 } } );
		await session.save();
		expect( api.postWithToken.mock.calls[ 0 ][ 1 ].baserevid ).toBe( 15 );
	} );

	it( 'renames the drawing as an edit that the next save publishes', async () => {
		await session.load();
		expect( session.getLabel() ).toBe( 'Welcome' );
		expect( session.rename( '  Title   slide ' ) ).toBe( 'Title slide' );
		expect( session.getLabel() ).toBe( 'Title slide' );
		expect( session.getStatus().dirty ).toBe( true );
		expect( api.postWithToken ).not.toHaveBeenCalled();
		await session.save( 'Renamed' );
		const sent = JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data );
		expect( sent.surfaces.map( ( surface ) => surface.label ) )
			.toEqual( [ 'Title slide', 'Annotated diagram', 'Reference sheet' ] );
		expect( session.getStatus().dirty ).toBe( false );
	} );

	it.each( [
		[ '', 'layers-page-drawing-rename-invalid' ],
		[ '   ', 'layers-page-drawing-rename-invalid' ],
		[ 'a|b', 'layers-page-drawing-rename-invalid' ],
		[ 'x:y', 'layers-page-drawing-rename-invalid' ],
		[ '[[z]]', 'layers-page-drawing-rename-invalid' ],
		[ 'bell\u0007', 'layers-page-drawing-rename-invalid' ],
		[ 'x'.repeat( 256 ), 'layers-page-drawing-rename-invalid' ],
		[ 'annotated_DIAGRAM', 'layers-page-drawing-rename-taken' ],
		[ ' Reference   sheet', 'layers-page-drawing-rename-taken' ]
	] )( 'refuses the name %j without changing the drawing', async ( name, code ) => {
		await session.load();
		expect( () => session.rename( name ) ).toThrow( expect.objectContaining( { code } ) );
		expect( session.getLabel() ).toBe( 'Welcome' );
		expect( session.getStatus().dirty ).toBe( false );
	} );

	it( 'accepts a 255-character name and a change of case to its own name', async () => {
		await session.load();
		expect( session.rename( 'é'.repeat( 255 ) ) ).toBe( 'é'.repeat( 255 ) );
		expect( session.rename( 'WELCOME' ) ).toBe( 'WELCOME' );
	} );

	it( 'refuses to rename in a read-only session', async () => {
		session = new Session( { ...options, readOnly: true }, {
			reader, publisher: new Publisher( api ), adapter: new Adapter()
		} );
		await session.load();
		expect( () => session.rename( 'Other' ) ).toThrow( 'layers-editor-read-only' );
	} );

	it( 'keeps a rename not yet saved when reconciling with unrelated server changes', async () => {
		await session.load();
		session.rename( 'Title slide' );
		const server = JSON.parse( JSON.stringify( fixture ) );
		server.surfaces[ 1 ].label = 'New server label';
		reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } );
		expect( await session.reconcile( 15 ) ).toMatchObject( { revisionId: 15, dirty: true } );
		expect( session.getLabel() ).toBe( 'Title slide' );
		expect( session.getDraft().snapshot.surfaces[ 1 ].label ).toBe( 'New server label' );
	} );

	it( 'requires reconciliation when the server renamed the same drawing', async () => {
		await session.load();
		session.rename( 'Title slide' );
		const server = JSON.parse( JSON.stringify( fixture ) );
		server.surfaces[ 0 ].label = 'Renamed elsewhere';
		reader.read.mockResolvedValueOnce( { revisionId: 15, snapshot: server } );
		await expect( session.reconcile( 15 ) ).rejects.toThrow( 'layers-editor-reconciliation-required' );
		expect( session.getLabel() ).toBe( 'Title slide' );
	} );

	it( 'recognizes already-saved content despite object key order without posting again', async () => {
		await session.load();
		edit( 777 );
		session.blockPublication();
		const server = session.getDraft().snapshot;
		server.surfaces[ 0 ].canvas = Object.fromEntries( Object.entries( server.surfaces[ 0 ].canvas ).reverse() );
		reader.read.mockResolvedValueOnce( { revisionId: 13, snapshot: server } );
		expect( await session.reconcile( 13 ) ).toMatchObject( { phase: 'ready', dirty: false, revisionId: 13 } );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 0, 11, 2147483648, 12.5, '13', null ] )( 'rejects invalid or older reconciliation revision %s before reading', async ( revisionId ) => {
		await session.load();
		await expect( session.reconcile( revisionId ) ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( reader.read ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not reconcile a historical read-only session', async () => {
		session = new Session( { ...options, readOnly: true }, {
			reader, publisher: new Publisher( api ), adapter: new Adapter()
		} );
		await session.load();
		await expect( session.reconcile( 13 ) ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( reader.read ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [ 'canvas', 'source', 'label' ] )( 'rejects incompatible selected-surface %s changes without altering the draft', async ( field ) => {
		await session.load();
		edit( 777 );
		session.blockPublication();
		const before = session.getDraft();
		const server = JSON.parse( JSON.stringify( fixture ) );
		server.surfaces[ 0 ][ field ] = field === 'canvas' ? { width: 555, height: 600 } : 'changed';
		reader.read.mockResolvedValueOnce( { revisionId: 13, snapshot: server } );
		await expect( session.reconcile( 13 ) ).rejects.toMatchObject( { code: 'layers-editor-reconciliation-required' } );
		expect( session.getDraft() ).toEqual( before );
		expect( session.getStatus().phase ).toBe( 'uncertain' );
		await expect( session.save() ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'blocks concurrent checks and publication, retaining edits made during the read', async () => {
		await session.load();
		const pending = deferred();
		reader.read.mockReturnValueOnce( pending.promise );
		const checking = session.reconcile( 13 );
		edit( 888 );
		await expect( session.save() ).rejects.toThrow( 'layers-editor-session-unavailable' );
		await expect( session.reconcile( 13 ) ).rejects.toThrow( 'layers-editor-session-unavailable' );
		pending.resolve( { revisionId: 13, snapshot: fixture } );
		expect( await checking ).toMatchObject( { revisionId: 13, dirty: true } );
		expect( session.getEditorState().canvas.width ).toBe( 888 );
		expect( reader.read ).toHaveBeenCalledTimes( 2 );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'does not revive a disposed session after reconciliation', async () => {
		await session.load();
		const pending = deferred();
		reader.read.mockReturnValueOnce( pending.promise );
		const checking = session.reconcile( 13 );
		session.dispose();
		pending.resolve( { revisionId: 13, snapshot: fixture } );
		await expect( checking ).rejects.toThrow( 'layers-editor-session-unavailable' );
		expect( session.getStatus().phase ).toBe( 'disposed' );
	} );

	it.each( [ 'denied', 'mismatched', 'invalid' ] )( 'preserves the base and draft after %s reconciliation read', async ( mode ) => {
		await session.load();
		edit( 777 );
		session.blockPublication();
		const before = session.getDraft();
		if ( mode === 'denied' ) {
			reader.read.mockRejectedValueOnce( new Error( 'layers-revision-unavailable' ) );
		} else {
			reader.read.mockResolvedValueOnce( { revisionId: mode === 'mismatched' ? 14 : 13,
				snapshot: mode === 'invalid' ? {} : fixture } );
		}
		await expect( session.reconcile( 13 ) ).rejects.toBeInstanceOf( Error );
		expect( session.getDraft() ).toEqual( before );
		expect( session.getStatus().phase ).toBe( 'uncertain' );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'captures owner identity and reads only the selected page revision', async () => {
		options.owner = 'Other';
		options.revisionId = 999;
		await session.load();
		expect( reader.read ).toHaveBeenCalledWith( { owner: 'Owner', revisionId: 12 } );
		await expect( session.load() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( reader.read ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'publishes the complete document and advances only the confirmed page revision', async () => {
		await session.load();
		edit( 777 );
		const status = await session.save( 'Change drawing' );
		const payload = api.postWithToken.mock.calls[ 0 ][ 1 ];
		expect( payload ).toMatchObject( { action: 'layerspublish', owner: 'Owner', baserevid: 12, summary: 'Change drawing' } );
		expect( payload ).not.toHaveProperty( 'maintext' );
		const saved = JSON.parse( payload.data );
		expect( saved.surfaces.slice( 1 ) ).toEqual( fixture.surfaces.slice( 1 ) );
		expect( saved.surfaces[ 0 ].canvas.width ).toBe( 777 );
		expect( status ).toMatchObject( { revisionId: 13, dirty: false, phase: 'ready' } );
	} );

	it( 'preserves edits made during a save and uses the confirmed base for the next save', async () => {
		await session.load();
		edit( 777 );
		const pending = deferred();
		api.postWithToken.mockReturnValueOnce( pending.promise );
		const saving = session.save();
		edit( 888 );
		await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		pending.resolve( { layerspublish: { result: 'Success', revid: 13 } } );
		expect( await saving ).toMatchObject( { revisionId: 13, dirty: true } );
		expect( session.getEditorState().canvas.width ).toBe( 888 );
		api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 14 } } );
		await session.save();
		expect( api.postWithToken.mock.calls[ 1 ][ 1 ].baserevid ).toBe( 13 );
		expect( session.getStatus().dirty ).toBe( false );
	} );

	it.each( [
		[ 'layers-edit-conflict', 'conflict' ],
		[ 'network failure', 'uncertain' ]
	] )( 'retains drafts and blocks repeat publication after %s', async ( code, phase ) => {
		await session.load();
		edit( 777 );
		api.postWithToken.mockRejectedValueOnce( { code } );
		await expect( session.save() ).rejects.toBeInstanceOf( Error );
		expect( session.getStatus() ).toMatchObject( { phase, revisionId: 12, dirty: true } );
		edit( 888 );
		expect( session.getDraft().snapshot.surfaces[ 0 ].canvas.width ).toBe( 888 );
		await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'preserves drafts after a definite rejection and permits deliberate correction', async () => {
		await session.load();
		edit( 777 );
		api.postWithToken.mockRejectedValueOnce( { code: 'layers-invalid-snapshot' } );
		await expect( session.save() ).rejects.toMatchObject( { code: 'layers-invalid-snapshot' } );
		expect( session.getStatus() ).toMatchObject( { phase: 'ready', dirty: true, revisionId: 12 } );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not allow mutation or publication from a historical read-only session', async () => {
		session = new Session( { ...options, readOnly: true }, {
			reader, publisher: new Publisher( api ), adapter: new Adapter()
		} );
		const state = await session.load();
		expect( () => session.update( state ) ).toThrow( 'layers-editor-read-only' );
		await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-read-only' } );
		expect( api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'isolates returned draft and rendering data from saved state', async () => {
		const state = await session.load();
		state.canvas.width = 999;
		const draft = session.getDraft();
		draft.snapshot.surfaces[ 0 ].layers.length = 0;
		expect( session.getDraft().snapshot ).toEqual( fixture );
		expect( session.getStatus().dirty ).toBe( false );
	} );

	it( 'cannot revive a disposed session with a late read', async () => {
		const pending = deferred();
		reader.read.mockReturnValueOnce( pending.promise );
		const loading = session.load();
		session.dispose();
		pending.resolve( { revisionId: 12, snapshot: fixture } );
		await expect( loading ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( session.getStatus().phase ).toBe( 'disposed' );
	} );

	it( 'cannot revive a disposed session with a late publication', async () => {
		await session.load();
		const pending = deferred();
		api.postWithToken.mockReturnValueOnce( pending.promise );
		const saving = session.save();
		session.dispose();
		pending.resolve( { layerspublish: { result: 'Success', revid: 13 } } );
		await expect( saving ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( session.getStatus() ).toMatchObject( { phase: 'disposed', revisionId: 12 } );
	} );

	describe( 'J49 session edge-case acceptance', () => {
		describe( 'case 1: initial read failures and load guards', () => {
			it( 'failed initial read leaves session unloaded without calling publication, and explicit later load may succeed', async () => {
				reader.read.mockRejectedValueOnce( new Error( 'read-failure' ) );
				await expect( session.load() ).rejects.toThrow( 'read-failure' );
				expect( session.getStatus().phase ).toBe( 'unloaded' );
				expect( api.postWithToken ).not.toHaveBeenCalled();
				expect( () => session.getDraft() ).toThrow( expect.objectContaining( { code: 'layers-editor-session-unavailable' } ) );
				expect( () => session.getEditorState() ).toThrow( expect.objectContaining( { code: 'layers-editor-session-unavailable' } ) );
				await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );

				reader.read.mockResolvedValueOnce( { revisionId: 12, snapshot: fixture } );
				const state = await session.load();
				expect( session.getStatus().phase ).toBe( 'ready' );
				expect( state.canvas.width ).toBe( 800 );
			} );

			it( 'rejects an in-flight second load without making a second read', async () => {
				const pending = deferred();
				reader.read.mockReturnValueOnce( pending.promise );
				const loading = session.load();
				expect( session.getStatus().phase ).toBe( 'loading' );
				await expect( session.load() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
				expect( reader.read ).toHaveBeenCalledTimes( 1 );
				pending.resolve( { revisionId: 12, snapshot: fixture } );
				await loading;
				expect( session.getStatus().phase ).toBe( 'ready' );
			} );

			it( 'wrong revision response rejects and never establishes a draft', async () => {
				reader.read.mockResolvedValueOnce( { revisionId: 999, snapshot: fixture } );
				await expect( session.load() ).rejects.toMatchObject( { code: 'layers-invalid-read-response' } );
				expect( session.getStatus().phase ).toBe( 'unloaded' );
				expect( () => session.getDraft() ).toThrow( expect.objectContaining( { code: 'layers-editor-session-unavailable' } ) );
				expect( () => session.getEditorState() ).toThrow( expect.objectContaining( { code: 'layers-editor-session-unavailable' } ) );
			} );
		} );

		describe( 'case 2: publication outcome boundaries and valid no-ops', () => {
			it( 'backwards publication revision leaves old base and draft, enters uncertain, and prevents repeat save', async () => {
				await session.load();
				edit( 777 );
				api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 11 } } );
				await expect( session.save() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
				expect( session.getStatus() ).toMatchObject( { phase: 'uncertain', revisionId: 12, dirty: true } );
				expect( session.getDraft().baseRevisionId ).toBe( 12 );
				expect( session.getDraft().snapshot.surfaces[ 0 ].canvas.width ).toBe( 777 );
				await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
				expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
			} );

			it.each( [ null, 12.5 ] )( 'malformed publication result %s leaves old base and draft, enters uncertain, and prevents repeat save', async ( revid ) => {
				await session.load();
				edit( 777 );
				api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid } } );
				await expect( session.save() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
				expect( session.getStatus() ).toMatchObject( { phase: 'uncertain', revisionId: 12, dirty: true } );
				expect( session.getDraft().baseRevisionId ).toBe( 12 );
				await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
				expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
			} );

			it( 'confirms a valid no-op response at the same revision without entering uncertain', async () => {
				await session.load();
				api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 12 } } );
				const status = await session.save( 'Valid no-op' );
				expect( status ).toMatchObject( { phase: 'ready', revisionId: 12, dirty: false } );
				expect( session.getStatus() ).toMatchObject( { phase: 'ready', revisionId: 12, dirty: false } );
				edit( 999 );
				api.postWithToken.mockResolvedValueOnce( { layerspublish: { result: 'Success', revid: 13 } } );
				const nextStatus = await session.save( 'Subsequent edit' );
				expect( nextStatus ).toMatchObject( { phase: 'ready', revisionId: 13, dirty: false } );
			} );
		} );

		describe( 'case 3: in-flight edits during rejected save', () => {
			it( 'preserves in-flight edits and old base on conflict, with no implicit reload or second POST', async () => {
				await session.load();
				edit( 777 );
				const pending = deferred();
				api.postWithToken.mockReturnValueOnce( pending.promise );
				const saving = session.save( 'First save' );
				edit( 888 );
				pending.reject( { code: 'layers-edit-conflict' } );
				await expect( saving ).rejects.toMatchObject( { code: 'layers-edit-conflict' } );
				expect( session.getStatus() ).toMatchObject( { phase: 'conflict', revisionId: 12, dirty: true } );
				expect( session.getEditorState().canvas.width ).toBe( 888 );
				expect( session.getDraft().snapshot.surfaces[ 0 ].canvas.width ).toBe( 888 );
				expect( session.getDraft().baseRevisionId ).toBe( 12 );
				expect( reader.read ).toHaveBeenCalledTimes( 1 );
				expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
				await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
			} );

			it( 'preserves in-flight edits and old base on unknown outcome, with no implicit reload or second POST', async () => {
				await session.load();
				edit( 777 );
				const pending = deferred();
				api.postWithToken.mockReturnValueOnce( pending.promise );
				const saving = session.save( 'First save' );
				edit( 999 );
				pending.reject( new Error( 'network failure' ) );
				await expect( saving ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
				expect( session.getStatus() ).toMatchObject( { phase: 'uncertain', revisionId: 12, dirty: true } );
				expect( session.getEditorState().canvas.width ).toBe( 999 );
				expect( session.getDraft().snapshot.surfaces[ 0 ].canvas.width ).toBe( 999 );
				expect( session.getDraft().baseRevisionId ).toBe( 12 );
				expect( reader.read ).toHaveBeenCalledTimes( 1 );
				expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
				await expect( session.save() ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
			} );
		} );

		describe( 'case 4: image and PDF fixtures, source identity, and reading order', () => {
			it( 'edits image surface while preserving source identity, other surfaces, and reading order', async () => {
				const imageOptions = { owner: 'Owner', revisionId: 12, surfaceId: 'diagram' };
				const imageSession = new Session( imageOptions, {
					reader, publisher: new Publisher( api ), adapter: new Adapter()
				} );
				await imageSession.load();
				const state = imageSession.getEditorState();
				expect( state.canvas.width ).toBe( 800 );
				state.canvas.height = 950;
				state.layers.push( { id: 'marker', type: 'rect', x: 10.5, y: 20.25 } );
				imageSession.update( state );
				await imageSession.save( 'Update diagram' );

				const payload = api.postWithToken.mock.calls[ 0 ][ 1 ];
				const doc = JSON.parse( payload.data );
				expect( doc.surfaces[ 1 ].canvas.height ).toBe( 950 );
				expect( doc.surfaces[ 1 ].layers[ 1 ].x ).toBe( 10.5 );
				expect( doc.surfaces[ 1 ].layers[ 1 ].y ).toBe( 20.25 );
				expect( doc.surfaces[ 1 ].source ).toEqual( fixture.surfaces[ 1 ].source );
				expect( doc.surfaces[ 1 ].readingOrder ).toEqual( fixture.surfaces[ 1 ].readingOrder );
				expect( doc.surfaces[ 0 ] ).toEqual( fixture.surfaces[ 0 ] );
				expect( doc.surfaces[ 2 ] ).toEqual( fixture.surfaces[ 2 ] );
				expect( reader.read ).toHaveBeenCalledWith( { owner: 'Owner', revisionId: 12 } );
			} );

			it( 'edits PDF surface while preserving PDF source identity, other surfaces, and reading order', async () => {
				const pdfOptions = { owner: 'Owner', revisionId: 12, surfaceId: 'reference' };
				const pdfSession = new Session( pdfOptions, {
					reader, publisher: new Publisher( api ), adapter: new Adapter()
				} );
				await pdfSession.load();
				const state = pdfSession.getEditorState();
				state.canvas.width = 1024;
				pdfSession.update( state );
				await pdfSession.save( 'Update PDF sheet' );

				const doc = JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data );
				expect( doc.surfaces[ 2 ].canvas.width ).toBe( 1024 );
				expect( doc.surfaces[ 2 ].source ).toEqual( fixture.surfaces[ 2 ].source );
				expect( doc.surfaces[ 2 ].readingOrder ).toEqual( fixture.surfaces[ 2 ].readingOrder );
				expect( doc.surfaces[ 0 ] ).toEqual( fixture.surfaces[ 0 ] );
				expect( doc.surfaces[ 1 ] ).toEqual( fixture.surfaces[ 1 ] );
			} );

			it( 'rejects referenced-layer deletion without altering last valid snapshot', async () => {
				const imageSession = new Session( { owner: 'Owner', revisionId: 12, surfaceId: 'diagram' }, {
					reader, publisher: new Publisher( api ), adapter: new Adapter()
				} );
				await imageSession.load();
				const invalidState = {
					canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
					layers: []
				};
				expect( () => imageSession.update( invalidState ) ).toThrow(
					expect.objectContaining( { code: 'layers-invalid-editor-snapshot' } )
				);
				expect( imageSession.getEditorState().layers ).toHaveLength( 1 );
				expect( imageSession.getEditorState().layers[ 0 ].id ).toBe( 'title' );
				expect( imageSession.getStatus().dirty ).toBe( false );
				expect( imageSession.getDraft().snapshot.surfaces[ 1 ].layers ).toHaveLength( 1 );
			} );
		} );

		describe( 'case 5: caller boundary validation and encapsulation', () => {
			it.each( [
				[ 'null options', null ],
				[ 'missing owner', { surfaceId: 'presentation', revisionId: 12 } ],
				[ 'empty owner', { owner: '', surfaceId: 'presentation', revisionId: 12 } ],
				[ 'whitespace owner', { owner: '   ', surfaceId: 'presentation', revisionId: 12 } ],
				[ 'non-string owner', { owner: 123, surfaceId: 'presentation', revisionId: 12 } ],
				[ 'missing surfaceId', { owner: 'Owner', revisionId: 12 } ],
				[ 'empty surfaceId', { owner: 'Owner', surfaceId: '', revisionId: 12 } ],
				[ 'non-string surfaceId', { owner: 'Owner', surfaceId: 456, revisionId: 12 } ],
				[ 'zero revisionId', { owner: 'Owner', surfaceId: 'presentation', revisionId: 0 } ],
				[ 'negative revisionId', { owner: 'Owner', surfaceId: 'presentation', revisionId: -1 } ],
				[ 'fractional revisionId', { owner: 'Owner', surfaceId: 'presentation', revisionId: 1.5 } ],
				[ 'overflow revisionId', { owner: 'Owner', surfaceId: 'presentation', revisionId: 2147483648 } ],
				[ 'string revisionId', { owner: 'Owner', surfaceId: 'presentation', revisionId: '12' } ],
				[ 'string readOnly', { owner: 'Owner', surfaceId: 'presentation', revisionId: 12, readOnly: 'true' } ],
				[ 'number readOnly', { owner: 'Owner', surfaceId: 'presentation', revisionId: 12, readOnly: 1 } ]
			] )( 'rejects invalid constructor option: %s', ( _label, invalidOptions ) => {
				expect( () => new Session( invalidOptions, {
					reader, publisher: new Publisher( api ), adapter: new Adapter()
				} ) ).toThrow( expect.objectContaining( { code: 'layers-invalid-editor-session' } ) );
				expect( reader.read ).not.toHaveBeenCalled();
				expect( api.postWithToken ).not.toHaveBeenCalled();
			} );

			it( 'accepts valid boundary revision IDs and explicit readOnly values', () => {
				const minRev = new Session( { owner: 'Owner', surfaceId: 'presentation', revisionId: 1 }, {
					reader, publisher: new Publisher( api ), adapter: new Adapter()
				} );
				expect( minRev.getStatus().revisionId ).toBe( 1 );

				const maxRev = new Session( { owner: 'Owner', surfaceId: 'presentation', revisionId: 2147483647, readOnly: false }, {
					reader, publisher: new Publisher( api ), adapter: new Adapter()
				} );
				expect( maxRev.getStatus().revisionId ).toBe( 2147483647 );
				expect( maxRev.getStatus().readOnly ).toBe( false );
			} );

			it.each( [
				[ 'missing dependencies', () => null ],
				[ 'missing reader', () => ( { publisher: new Publisher( api ), adapter: new Adapter() } ) ],
				[ 'invalid reader', () => ( { reader: {}, publisher: new Publisher( api ), adapter: new Adapter() } ) ],
				[ 'missing publisher', () => ( { reader, adapter: new Adapter() } ) ],
				[ 'invalid publisher', () => ( { reader, publisher: {}, adapter: new Adapter() } ) ],
				[ 'missing adapter', () => ( { reader, publisher: new Publisher( api ) } ) ],
				[ 'incomplete adapter', () => ( { reader, publisher: new Publisher( api ), adapter: { toEditorState: () => {} } } ) ]
			] )( 'rejects invalid dependencies: %s', ( _label, getDeps ) => {
				expect( () => new Session( options, getDeps() ) ).toThrow(
					expect.objectContaining( { code: 'layers-invalid-editor-session' } )
				);
				expect( reader.read ).not.toHaveBeenCalled();
				expect( api.postWithToken ).not.toHaveBeenCalled();
			} );

			it( 'ensures draft and render copies cannot mutate internal session state', async () => {
				await session.load();
				const state = session.getEditorState();
				state.canvas.width = 1234;
				state.layers.push( { id: 'extra' } );
				expect( session.getEditorState().canvas.width ).toBe( 800 );
				expect( session.getEditorState().layers ).toHaveLength( 1 );

				const draft = session.getDraft();
				draft.snapshot.surfaces.splice( 0, 1 );
				draft.snapshot.schemaVersion = 999;
				expect( session.getDraft().snapshot.surfaces ).toHaveLength( 3 );
				expect( session.getDraft().snapshot.schemaVersion ).toBe( 1 );
				expect( session.getStatus().dirty ).toBe( false );
			} );

			it( 'rejects non-string save summary without calling transport and exposes safe error code', async () => {
				await session.load();
				await expect( session.save( 12345 ) ).rejects.toMatchObject( { code: 'layers-invalid-publication-request' } );
				expect( api.postWithToken ).not.toHaveBeenCalled();
			} );
		} );
	} );
} );
