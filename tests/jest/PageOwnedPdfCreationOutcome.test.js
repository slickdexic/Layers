'use strict';
const { setup, preparation, witness, wait, tickUntil, copy } = require( './fixtures/pdfCreationHost.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const ReadClient = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const fs = require( 'fs' ), path = require( 'path' ), vm = require( 'vm' );
function storage() {
	const values = new Map(); return { values, get length() { return values.size; }, key: index => Array.from( values.keys() )[ index ] || null,
		getItem: key => values.has( key ) ? values.get( key ) : null, setItem: ( key, value ) => values.set( key, value ), removeItem: key => values.delete( key ) };
}
function controller( work, local = storage(), retained = true, writer = 'b'.repeat( 32 ) ) {
	const store = new DraftStore( local, writer ), value = new Controller( work.host, store, { wiki: 'wiki', user: 'Editor' }, retained ? { retainPublicationAttempt: true } : undefined );
	return { controller: value, store, local };
}
function complete( work ) { return { editor: witness( work ), envelope: work.host.captureDraftEnvelope( { publicationAttempt: true } ) }; }
function query( work, revisionId = 12, parentId = revisionId - 1, main = work.native.mainText ) {
	return { query: { pages: [ { pageid: 7, title: 'Owner', revisions: [ { revid: revisionId, parentid: parentId,
		slots: { main: { contentmodel: 'wikitext', content: main } } } ] } ] } };
}
function remote( work, revisionId = 12 ) {
	const evidence = work.host.captureDraftEnvelope( { publicationAttempt: true } ), sent = evidence.publicationAttempt.snapshot;
	const context = page => { const value = preparation( work.native.hasLayersSlot, 2, page, 3 ).context;
		value.revisionId = revisionId; const members = sent.surfaces.slice( work.native.hasLayersSlot ? 2 : 0 );
		value.members = members.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) );
		const member = members.find( surface => surface.source.page === page ); value.stored = Boolean( member );
		value.surface = member ? copy( member ) : { ...value.surface, id: Ids.surfaceId( 7, revisionId, 'File:Source.pdf', 'ABC', page ) }; return value; };
	const api = { get: jest.fn( async options => options.action === 'query' ? query( work, revisionId, revisionId === 13 ? 12 : revisionId - 1 ) :
		( { layersread: options.editorpage ? { editor: context( options.editorpage ) } : { revisionId, snapshot: copy( sent ), sourceGeometry: {} } } ) ) };
	return { dependencies: { api, reader: new ReadClient( api ), pdfReader: new PdfClient( api ) }, api, context, sent };
}
async function uncertain( slot = true ) {
	const work = setup( slot, 2, 2, 3 ); expect( await work.host.load() ).toBe( true ); work.edit( 'Sent two' );
	expect( await work.host.turn( 1 ) ).toBe( true ); work.edit( 'History-only Redo' ); work.editor.historyManager.undo();
	expect( await work.host.turn( 2 ) ).toBe( true );
	const pending = wait(); work.publisher.publish.mockReturnValue( pending.promise ); let savingBackup;
	const saving = work.host.save( 'First Save', async () => { savingBackup = work.host.captureDraftEnvelope( { publicationAttempt: true } ); } ).catch( error => error );
	await tickUntil( () => work.publisher.publish.mock.calls.length === 1 ); work.edit( 'Newer two' ); pending.reject( new Error( 'connection lost' ) );
	expect( ( await saving ).code ).toBe( 'layers-publication-outcome-unknown' ); return { ...work, savingBackup };
}
it.each( [ false, true ] )( 'retains exact sent payload before dispatch and after uncertainty independently from current edits, slot=%s', async slot => {
	const work = await uncertain( slot );
	try {
		const envelope = work.host.captureDraftEnvelope( { publicationAttempt: true } ), sent = JSON.parse( work.publisher.publish.mock.calls[ 0 ][ 0 ].snapshotJson );
		expect( work.savingBackup.publicationAttempt ).toMatchObject( { dispatchState: 'prepared', snapshot: sent, revisionId: null } );
		expect( envelope.publicationAttempt ).toMatchObject( { dispatchState: 'unknown', snapshot: sent, code: 'layers-publication-outcome-unknown' } );
		expect( envelope.draft.snapshot ).not.toEqual( sent ); const original = copy( envelope ); envelope.publicationAttempt.snapshot.surfaces = [];
		expect( work.host.captureDraftEnvelope( { publicationAttempt: true } ) ).toEqual( original );
		expect( work.host.captureDraftEnvelope() ).not.toHaveProperty( 'publicationAttempt' );
		expect( work.host.captureDraftEnvelope().version ).toBe( 1 );
	} finally { work.close(); }
} );
it.each( [ false, true ] )( 'checks an unchanged base with all Redo pages and preserves every hold/work/history, slot=%s', async slot => {
	const work = await uncertain( slot );
	try {
		const { dependencies, api } = remote( work ), before = complete( work ), reads = work.reader.read.mock.calls.length;
		expect( await work.host.inspectPublication( dependencies ) ).toMatchObject( { outcome: 'base-current', revisionId: 12,
			publicationRetried: false, holdCleared: false, attemptSequence: 1 } );
		expect( complete( work ) ).toEqual( before ); expect( work.reader.read.mock.calls.slice( reads ).map( row => row[ 0 ].page ) ).toEqual( [ 2, 1, 2, 1 ] );
		expect( api.get.mock.calls.every( row => row[ 0 ].action === 'query' && row[ 0 ].maxage === 0 && row[ 0 ].smaxage === 0 && !row[ 0 ].redirects ) ).toBe( true );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 ); await expect( work.host.save( '', async () => {} ) ).rejects.toThrow();
	} finally { work.close(); }
} );
it.each( [ false, true ] )( 'recognizes exact sent content at the native direct successor without confirming newer work, slot=%s', async slot => {
	const work = await uncertain( slot );
	try {
		const { dependencies } = remote( work, 13 ), before = complete( work );
		expect( await work.host.inspectPublication( dependencies ) ).toMatchObject( { outcome: 'payload-current', revisionId: 13, holdCleared: false } );
		expect( complete( work ) ).toEqual( before ); expect( work.host.getStatus().phase ).toBe( 'uncertain' );
		expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( -1 ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { work.close(); }
} );
it.each( [ 'different layers', 'changed main', 'later parent' ] )( 'leaves genuine %s changes held rather than merging or retrying', async reason => {
	const work = await uncertain();
	try {
		const { dependencies, api, sent, context } = remote( work, 13 ), changed = copy( sent ); changed.surfaces[ 2 ].layers[ 0 ].text = 'Someone else';
		api.get.mockImplementation( async options => {
			if ( options.action === 'query' ) return query( work, reason === 'later parent' ? 14 : 13, reason === 'later parent' ? 13 : 12,
				reason === 'changed main' ? 'Changed embed' : work.native.mainText );
			const value = context( options.editorpage || 2 ); if ( options.editorpage === 2 ) value.surface = copy( changed.surfaces[ 2 ] );
			return { layersread: options.editorpage ? { editor: value } : { revisionId: 13, snapshot: changed, sourceGeometry: {} } };
		} );
		const before = complete( work ); expect( ( await work.host.inspectPublication( dependencies ) ).outcome ).toBe( 'changed' );
		expect( complete( work ) ).toEqual( before ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { work.close(); }
} );
it.each( [ 'missing', 'wrong page ID', 'wrong title', 'redirect', 'two pages', 'two revisions', 'hidden text', 'missing content', 'wrong model', 'error', 'changed closing read' ] )(
	'refuses %s core discovery while preserving complete work', async reason => {
		const work = await uncertain();
		try {
			const { dependencies, api } = remote( work ), response = query( work ), page = response.query.pages[ 0 ], revision = page.revisions[ 0 ];
			if ( reason === 'missing' ) page.missing = true; if ( reason === 'wrong page ID' ) page.pageid++;
			if ( reason === 'wrong title' ) page.title = 'Other'; if ( reason === 'redirect' ) response.query.redirects = [];
			if ( reason === 'two pages' ) response.query.pages.push( copy( page ) ); if ( reason === 'two revisions' ) page.revisions.push( copy( revision ) );
			if ( reason === 'hidden text' ) revision.texthidden = true; if ( reason === 'missing content' ) delete revision.slots.main.content;
			if ( reason === 'wrong model' ) revision.slots.main.contentmodel = 'json';
			if ( reason === 'error' ) response.error = { code: 'permissiondenied' };
			api.get.mockResolvedValue( response ); if ( reason === 'changed closing read' ) api.get.mockResolvedValueOnce( query( work ) ).mockResolvedValue( query( work, 13, 12 ) );
			const before = complete( work ); await expect( work.host.inspectPublication( dependencies ) ).rejects.toThrow(); expect( complete( work ) ).toEqual( before );
		} finally { work.close(); }
	} );
it.each( [ 'native creation refusal', 'changed creation base', 'wrong count', 'saved source refusal', 'changed saved bundle', 'changed saved context' ] )(
	'never infers a safe outcome from %s', async reason => {
		const work = await uncertain();
		try {
			const { dependencies, api, context, sent } = remote( work, reason.startsWith( 'saved' ) || reason.startsWith( 'changed saved' ) ? 13 : 12 );
			if ( reason === 'native creation refusal' ) work.reader.read.mockRejectedValue( new Error( 'denied' ) );
			if ( reason === 'changed creation base' || reason === 'wrong count' ) work.reader.read.mockImplementation( async request => {
				const prepared = preparation( true, 2, request.page, 3 );
				if ( reason === 'wrong count' ) prepared.context.pageCount++; else prepared.mainText += ' Changed'; return prepared;
			} );
			if ( reason === 'saved source refusal' ) api.get.mockImplementation( async options => {
				if ( options.action === 'query' ) return query( work, 13, 12 ); throw new Error( 'source unavailable' );
			} );
			if ( reason === 'changed saved bundle' ) {
				let reads = 0; api.get.mockImplementation( async options => {
					if ( options.action === 'query' ) return query( work, 13, 12 );
					if ( options.editorpage ) return { layersread: { editor: context( options.editorpage ) } };
					return { layersread: { revisionId: 13, snapshot: ++reads === 1 ? copy( sent ) : { ...copy( sent ), future: 'changed' }, sourceGeometry: {} } };
				} );
			}
			if ( reason === 'changed saved context' ) {
				let reads = 0; api.get.mockImplementation( async options => {
					if ( options.action === 'query' ) return query( work, 13, 12 );
					if ( options.editorpage ) { const value = context( options.editorpage ); if ( ++reads > 3 ) value.rendition.url += '?changed=1'; return { layersread: { editor: value } }; }
					return { layersread: { revisionId: 13, snapshot: copy( sent ), sourceGeometry: {} } };
				} );
			}
			const before = complete( work ); await expect( work.host.inspectPublication( dependencies ) ).rejects.toThrow(); expect( complete( work ) ).toEqual( before );
		} finally { work.close(); }
	} );
it.each( [ 'new layer', 'offscreen history', 'URL', 'dispose', 'dependency' ] )( 'stops on %s during a native inspection await', async reason => {
	const work = await uncertain();
	try {
		const { dependencies, api } = remote( work ), pending = wait(), readsBefore = work.reader.read.mock.calls.length; api.get.mockReturnValueOnce( pending.promise );
		const checking = work.host.inspectPublication( dependencies );
		if ( reason === 'new layer' ) work.edit( 'Keep newer' ); if ( reason === 'offscreen history' ) work.editor.historyManager.history[ 0 ].description += ' changed';
		if ( reason === 'URL' ) window.history.replaceState( {}, '', '?changed=1' ); if ( reason === 'dispose' ) work.host.dispose();
		if ( reason === 'dependency' ) api.get = jest.fn(); const before = witness( work ); pending.resolve( query( work ) );
		await expect( checking ).rejects.toThrow(); expect( witness( work ) ).toEqual( before );
		expect( work.reader.read.mock.calls ).toHaveLength( readsBefore );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { work.close(); }
} );
it( 'opt-in backups recover exact sent and current snapshots with Redo, keeping source writers and uncertainty held', async () => {
	const source = await uncertain(), target = setup( true, 2, 2, 3 ), local = storage();
	try {
		const stored = controller( source, local, true, 'a'.repeat( 32 ) ); await stored.controller.review( { choose: async () => 0, confirm: async () => true } );
		const raw = stored.controller.persist(), initialValues = Array.from( local.values );
		expect( await target.host.load() ).toBe( true ); const destination = controller( target, local );
		expect( await destination.controller.review( { choose: async () => 0, confirm: async () => true } ) ).toBe( true );
		expect( target.host.captureDraftEnvelope( { publicationAttempt: true } ) ).toEqual( { ...source.host.captureDraftEnvelope( { publicationAttempt: true } ), publicationBlocked: true } );
		expect( Array.from( local.values ) ).toEqual( initialValues ); expect( raw ).toContain( '"version":2' );
		destination.controller.persist(); expect( local.values.size ).toBe( 2 );
		const before = complete( target ), native = remote( target, 13 );
		expect( ( await target.host.inspectPublication( native.dependencies ) ).outcome ).toBe( 'payload-current' ); expect( complete( target ) ).toEqual( before );
		await expect( destination.controller.save() ).rejects.toThrow();
	} finally { source.close(); target.close(); }
} );
it( 'default controller does not consume or overwrite a version-2 backup it did not opt into', async () => {
	const source = await uncertain(), target = setup( true, 2, 2, 3 ), local = storage();
	try {
		const stored = controller( source, local, true, 'a'.repeat( 32 ) ); await stored.controller.review( { choose: async () => 0, confirm: async () => true } ); stored.controller.persist();
		expect( await target.host.load() ).toBe( true ); const before = complete( target ), values = Array.from( local.values ), destination = controller( target, local, false );
		await expect( destination.controller.review( { choose: async () => 0, confirm: async () => true } ) ).rejects.toThrow();
		expect( complete( target ) ).toEqual( before ); expect( Array.from( local.values ) ).toEqual( values );
	} finally { source.close(); target.close(); }
} );
it.each( [ 'foreign base', 'sibling', 'source', 'duplicate page', 'bad sequence', 'fake confirmation' ] )(
	'refuses %s retained evidence before replacing recovered work', async reason => {
		const source = await uncertain(), work = setup( true, 2, 2, 3 );
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep current' ); const envelope = source.host.captureDraftEnvelope( { publicationAttempt: true } );
			const attempt = envelope.publicationAttempt;
			if ( reason === 'foreign base' ) attempt.baseRevisionId++; if ( reason === 'sibling' ) attempt.snapshot.surfaces[ 0 ].layers = [];
			if ( reason === 'source' ) attempt.snapshot.surfaces[ 2 ].source.sha1 = 'b'.repeat( 31 );
			if ( reason === 'duplicate page' ) attempt.snapshot.surfaces.push( copy( attempt.snapshot.surfaces[ 2 ] ) );
			if ( reason === 'bad sequence' ) attempt.sequence = 0; if ( reason === 'fake confirmation' ) { attempt.dispatchState = 'confirmed'; attempt.revisionId = 13; }
			const before = complete( work ), plan = work.host.prepareDraftRecovery( envelope );
			await expect( work.host.commitDraftRecovery( plan.handle ) ).rejects.toThrow(); expect( complete( work ) ).toEqual( before );
		} finally { source.close(); work.close(); }
	} );
it( 'new inspection component loads under ResourceLoader without relative require', () => {
	const source = fs.readFileSync( path.resolve( __dirname, '../../resources/ext.layers.editor/PageOwnedPdfCreationOutcomeReader.js' ), 'utf8' );
	const sandbox = { window: { Layers: { Editor: {}, Core: {} } }, module: { exports: {} }, require: jest.fn( () => { throw new Error( 'relative require' ); } ) };
	vm.runInNewContext( source, sandbox ); expect( typeof sandbox.module.exports.inspect ).toBe( 'function' ); expect( sandbox.require ).not.toHaveBeenCalled();
} );

it( 'refuses missing sent evidence in an uncertain version-2 backup and preserves the destination', async () => {
	const source = await uncertain(), work = setup( true, 2, 2, 3 );
	try {
		expect( await work.host.load() ).toBe( true ); const before = complete( work ), envelope = source.host.captureDraftEnvelope( { publicationAttempt: true } );
		envelope.publicationAttempt = null; expect( () => work.host.prepareDraftRecovery( envelope ) ).toThrow(); expect( complete( work ) ).toEqual( before );
	} finally { source.close(); work.close(); }
} );
it( 'accepts an opted-in pre-save backup with a null attempt without inventing a publication', async () => {
	const source = setup( true, 2, 2, 3 ), work = setup( true, 2, 2, 3 );
	try {
		expect( await source.host.load() ).toBe( true ); source.edit( 'Unsaved' ); const envelope = source.host.captureDraftEnvelope( { publicationAttempt: true } );
		expect( envelope.publicationAttempt ).toBeNull(); expect( await work.host.load() ).toBe( true );
		const prepared = work.host.prepareDraftRecovery( envelope ); expect( await work.host.commitDraftRecovery( prepared.handle ) ).toBe( true );
		expect( work.host.captureDraftEnvelope( { publicationAttempt: true } ).publicationAttempt ).toBeNull();
		await expect( work.host.inspectPublication( { api: { get: jest.fn() }, reader: { read: jest.fn() }, pdfReader: { read: jest.fn() } } ) ).rejects.toThrow();
	} finally { source.close(); work.close(); }
} );
it( 'captures the original payload even if backup persistence causes a newer editor edit', async () => {
	const work = setup( true, 2, 2, 3 );
	try {
		expect( await work.host.load() ).toBe( true ); work.edit( 'Original' ); let backup;
		work.publisher.publish.mockRejectedValue( new Error( 'lost reply' ) );
		await expect( work.host.save( '', async () => { work.edit( 'Newer during backup' ); backup = work.host.captureDraftEnvelope( { publicationAttempt: true } ); } ) ).rejects.toThrow();
		const sent = JSON.parse( work.publisher.publish.mock.calls[ 0 ][ 0 ].snapshotJson );
		expect( backup.publicationAttempt.snapshot ).toEqual( sent ); expect( backup.draft.snapshot ).not.toEqual( sent );
		expect( work.host.captureDraftEnvelope( { publicationAttempt: true } ).publicationAttempt.snapshot ).toEqual( sent );
	} finally { work.close(); }
} );

it( 'the opt-in controller durably retains the original sent payload and newer work on a lost response', async () => {
	const work = setup( true, 2, 2, 3 );
	try {
		expect( await work.host.load() ).toBe( true ); work.edit( 'Original durable' ); const value = controller( work );
		await value.controller.review( { choose: async () => 0, confirm: async () => true } );
		const pending = wait(); work.publisher.publish.mockReturnValue( pending.promise ); const saving = value.controller.save().catch( error => error );
		await tickUntil( () => work.publisher.publish.mock.calls.length === 1 );
		const before = JSON.parse( Array.from( value.local.values.values() )[ 0 ] ).pdfCreation;
		expect( before.publicationAttempt.dispatchState ).toBe( 'prepared' );
		work.edit( 'Newer durable' ); pending.reject( new Error( 'lost' ) ); await saving;
		const after = JSON.parse( Array.from( value.local.values.values() )[ 0 ] ).pdfCreation;
		expect( after.publicationAttempt.snapshot ).toEqual( before.publicationAttempt.snapshot );
		expect( after.publicationAttempt.dispatchState ).toBe( 'unknown' ); expect( after.draft.snapshot ).not.toEqual( after.publicationAttempt.snapshot );
	} finally { work.close(); }
} );
it( 'refuses a missing offscreen timeline for a sent page later undone to blank', async () => {
	const source = setup( true, 2, 2, 3 ), work = setup( true, 2, 2, 3 );
	try {
		expect( await source.host.load() ).toBe( true ); source.edit( 'Anchor' ); expect( await source.host.turn( 1 ) ).toBe( true ); source.edit( 'Sent one' );
		const pending = wait(); source.publisher.publish.mockReturnValue( pending.promise );
		const saving = source.host.save( '', async () => {} ).catch( error => error ); await tickUntil( () => source.publisher.publish.mock.calls.length === 1 );
		source.editor.historyManager.undo(); pending.reject( new Error( 'lost' ) ); await saving;
		const envelope = source.host.captureDraftEnvelope( { publicationAttempt: true } );
		expect( envelope.draft.snapshot.surfaces ).toHaveLength( 3 ); expect( envelope.publicationAttempt.snapshot.surfaces ).toHaveLength( 4 );
		expect( await work.host.load() ).toBe( true ); const plan = work.host.prepareDraftRecovery( envelope );
		expect( await work.host.commitDraftRecovery( plan.handle ) ).toBe( true ); expect( work.editor.historyManager.redo() ).toBe( true );
		expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Sent one' );
		// Missing active history already refuses; make the sent-only page offscreen to exercise the extra requirement.
		envelope.history.activePage = 2; envelope.draft.activePage = 2; envelope.history.members = envelope.history.members.filter( member => member.page !== 1 );
		expect( () => work.host.prepareDraftRecovery( envelope ) ).toThrow();
	} finally { source.close(); work.close(); }
} );
it( 'refuses publication-evidence or transport accessors without invoking them', async () => {
	const work = await uncertain();
	try {
		const getter = jest.fn(), options = {}; Object.defineProperty( options, 'publicationAttempt', { enumerable: true, get: getter } );
		expect( () => work.host.captureDraftEnvelope( options ) ).toThrow(); expect( getter ).not.toHaveBeenCalled();
		const deps = { reader: { read: jest.fn() }, pdfReader: { read: jest.fn() } }; Object.defineProperty( deps, 'api', { enumerable: true, get: getter } );
		await expect( work.host.inspectPublication( deps ) ).rejects.toThrow(); expect( getter ).not.toHaveBeenCalled();
	} finally { work.close(); }
} );
