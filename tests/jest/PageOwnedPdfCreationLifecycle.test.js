'use strict';
const { setup, preparation, witness, wait, tickUntil, copy } = require( './fixtures/pdfCreationHost.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const ReadClient = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
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


const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationLifecycle.js' );
const fs = require( 'fs' ), path = require( 'path' ), vm = require( 'vm' );

function connect( work, local = storage(), retained = true ) {
	const value = controller( work, local, retained ), exit = new DraftStore( local, 'd'.repeat( 32 ) );
	const ui = { choose: jest.fn( async () => 0 ), confirm: jest.fn( async () => true ), notifyFailure: jest.fn(), notifyBlocked: jest.fn() };
	return { ...value, exit, ui, lifecycle: new Lifecycle( work.editor, work.host, value.controller, exit, ui ) };
}
function rawFor( value, writer ) { return Array.from( value.local.values.entries() ).find( entry => entry[ 0 ].endsWith( '#' + writer.repeat( 32 ) ) ); }
async function start( local = storage() ) {
	const work = setup( true, 2, 2, 3 ); expect( await work.host.load() ).toBe( true );
	const value = connect( work, local ); expect( await value.lifecycle.initialize() ).toBe( true ); return { work, value };
}
async function confirmed() {
	const { work, value } = await start(); work.edit( 'Saved' ); work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
	expect( ( await value.lifecycle.save() ).revisionId ).toBe( 13 ); return { work, value };
}
it( 'initializes only the actual loaded host/editor/controller and does not publish or create an exit candidate', async () => {
	const { work, value } = await start();
	try {
		expect( value.lifecycle.getStatus() ).toMatchObject( { ready: true, disposed: false } );
		expect( JSON.parse( rawFor( value, 'b' )[ 1 ] ).pdfCreation ).toEqual( work.host.captureDraftEnvelope( { publicationAttempt: true } ) );
		expect( rawFor( value, 'd' ) ).toBeUndefined(); expect( work.publisher.publish ).not.toHaveBeenCalled();
		await expect( value.lifecycle.initialize() ).rejects.toThrow();
	} finally { value.lifecycle.dispose(); work.close(); }
} );
it.each( [ 'foreign editor', 'foreign host', 'default controller', 'same writer', 'foreign storage', 'occupied exit' ] )(
	'refuses %s lifecycle admission without changing work or backups', async reason => {
		const work = setup( true, 2, 2, 3 );
		try {
			expect( await work.host.load() ).toBe( true ); const value = controller( work, storage(), reason !== 'default controller' );
			let exit = new DraftStore( value.local, 'd'.repeat( 32 ) ), editor = work.editor, host = work.host;
			if ( reason === 'foreign editor' ) editor = { ...editor };
			if ( reason === 'foreign host' ) host = {};
			if ( reason === 'same writer' ) exit = new DraftStore( value.local, 'b'.repeat( 32 ) );
			if ( reason === 'foreign storage' ) exit = new DraftStore( storage(), 'd'.repeat( 32 ) );
			if ( reason === 'occupied exit' ) { await value.controller.review( { choose: async () => 0, confirm: async () => true } );
				const raw = value.controller.persist(); exit.write( JSON.parse( raw ).scope, '{"keep":true}' ); }
			const before = complete( work ), stored = Array.from( value.local.values );
			expect( () => new Lifecycle( editor, host, value.controller, exit, { choose() {}, confirm() {}, notifyFailure() {}, notifyBlocked() {} } ) ).toThrow();
			expect( complete( work ) ).toEqual( before ); expect( Array.from( value.local.values ) ).toEqual( stored );
		} finally { work.close(); }
	} );
it( 'debounces complete both-page drafts including hidden Redo, background values and finite unknown data', async () => {
	const { work, value } = await start(); jest.useFakeTimers( { doNotFake: [ 'queueMicrotask' ] } );
	try {
		const initial = rawFor( value, 'b' )[ 1 ]; work.edit( 'Two' ); work.editor.stateManager.set( 'backgroundOpacity', 0.5 );
		expect( await work.host.turn( 1 ) ).toBe( true ); work.edit( 'One Redo' ); work.editor.historyManager.undo();
		jest.advanceTimersByTime( 999 ); expect( rawFor( value, 'b' )[ 1 ] ).toBe( initial );
		jest.advanceTimersByTime( 1 ); const saved = JSON.parse( rawFor( value, 'b' )[ 1 ] ).pdfCreation;
		expect( saved ).toEqual( work.host.captureDraftEnvelope( { publicationAttempt: true } ) );
		expect( saved.history.members.find( row => row.page === 1 ).timeline.history ).toHaveLength( 2 );
		expect( saved.draft.snapshot.surfaces[ 2 ].layers[ 0 ].future ).toBeNull(); expect( work.publisher.publish ).not.toHaveBeenCalled();
	} finally { value.lifecycle.dispose(); jest.useRealTimers(); work.close(); }
} );
it( 'reports active autosave storage failure without clearing live work or prior backup', async () => {
	const local = storage(), write = local.setItem; let fail = false;
	local.setItem = ( key, raw ) => { if ( fail ) throw new Error( 'quota' ); write( key, raw ); };
	const { work, value } = await start( local );
	try {
		const previous = rawFor( value, 'b' )[ 1 ]; work.edit( 'Keep me' ); fail = true;
		expect( value.lifecycle.flush() ).toBe( false ); expect( rawFor( value, 'b' )[ 1 ] ).toBe( previous );
		expect( work.editor.layers[ 0 ].text ).toBe( 'Keep me' ); expect( value.ui.notifyFailure ).toHaveBeenCalled();
		fail = false; expect( value.lifecycle.flush() ).toBe( true );
	} finally { fail = false; value.lifecycle.dispose(); work.close(); }
} );
it( 'keeps cancelled review and original writer intact while independently preserving current work on exit', async () => {
	const source = await uncertain(), work = setup( true, 2, 2, 3 ); let value;
	try {
		const local = storage(), earlier = controller( source, local, true, 'a'.repeat( 32 ) );
		await earlier.controller.review( { choose: async () => 0, confirm: async () => true } ); const original = earlier.controller.persist();
		expect( await work.host.load() ).toBe( true ); value = connect( work, local ); value.ui.confirm.mockResolvedValue( false );
		expect( await value.lifecycle.initialize() ).toBe( false ); work.edit( 'Current after cancellation' );
		expect( value.lifecycle.flush() ).toBe( false ); await expect( value.lifecycle.save() ).rejects.toThrow();
		expect( value.lifecycle.dispose() ).toBe( true ); const exit = JSON.parse( rawFor( value, 'd' )[ 1 ] ).pdfCreation;
		expect( exit.version ).toBe( 1 ); expect( exit.publicationBlocked ).toBe( true );
		expect( exit.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Current after cancellation' );
		expect( rawFor( value, 'a' )[ 1 ] ).toBe( original ); expect( rawFor( value, 'b' ) ).toBeUndefined();
	} finally { if ( value ) value.lifecycle.dispose( true ); source.close(); work.close(); }
} );
it( 'preserves current work during pending review and refuses any later recovery application after disposal', async () => {
	const source = await uncertain(), work = setup( true, 2, 2, 3 ); let value;
	try {
		const local = storage(), earlier = controller( source, local, true, 'a'.repeat( 32 ) );
		await earlier.controller.review( { choose: async () => 0, confirm: async () => true } ); const original = earlier.controller.persist();
		expect( await work.host.load() ).toBe( true ); value = connect( work, local ); const pending = wait(); value.ui.confirm.mockReturnValue( pending.promise );
		const initializing = value.lifecycle.initialize(); await tickUntil( () => value.ui.confirm.mock.calls.length === 1 );
		work.edit( 'Late review work' ); expect( value.lifecycle.dispose() ).toBe( true );
		pending.resolve( true ); await expect( initializing ).rejects.toThrow();
		expect( JSON.parse( rawFor( value, 'd' )[ 1 ] ).pdfCreation.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Late review work' );
		expect( rawFor( value, 'a' )[ 1 ] ).toBe( original ); expect( work.editor.layers[ 0 ].text ).toBe( 'Late review work' );
	} finally { if ( value ) value.lifecycle.dispose( true ); source.close(); work.close(); }
} );
it.each( [ 'unknown', 'confirmed' ] )( 'retains sent evidence and newer work on exit during a Save that later becomes %s', async outcome => {
	const { work, value } = await start();
	try {
		work.edit( 'Sent' ); const pending = wait(); work.publisher.publish.mockReturnValue( pending.promise ); const saving = value.lifecycle.save().catch( error => error );
		await tickUntil( () => work.publisher.publish.mock.calls.length === 1 ); work.edit( 'Newer before exit' );
		expect( value.lifecycle.dispose() ).toBe( true ); const raw = rawFor( value, 'd' )[ 1 ], exit = JSON.parse( raw ).pdfCreation;
		expect( exit.publicationAttempt.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Sent' );
		expect( exit.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Newer before exit' );
		if ( outcome === 'confirmed' ) pending.resolve( { revisionId: 13 } ); else pending.reject( new Error( 'lost' ) );
		const result = await saving;
		if ( outcome === 'confirmed' ) expect( result ).toMatchObject( { revisionId: 13, hostReady: false, draftPersisted: false } );
		else expect( result.code ).toBe( 'layers-publication-outcome-unknown' );
		expect( rawFor( value, 'd' )[ 1 ] ).toBe( raw ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it( 'preserves late work independently during a pending check, leaving both pre-check copies exact', async () => {
	const work = await uncertain(); let value;
	try {
		value = connect( work ); await value.lifecycle.initialize(); const native = remote( work ), pending = wait(); native.api.get.mockReturnValueOnce( pending.promise );
		const checking = value.lifecycle.reconcile( native.dependencies, new DraftStore( value.local, 'c'.repeat( 32 ) ) );
		await tickUntil( () => native.api.get.mock.calls.length === 1 ); const before = rawFor( value, 'b' )[ 1 ], checkpoint = rawFor( value, 'c' )[ 1 ];
		work.edit( 'Late during check' ); expect( value.lifecycle.dispose() ).toBe( true ); pending.resolve( query( work ) );
		await expect( checking ).rejects.toThrow(); const exit = JSON.parse( rawFor( value, 'd' )[ 1 ] ).pdfCreation;
		expect( exit.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Late during check' );
		expect( rawFor( value, 'b' )[ 1 ] ).toBe( before ); expect( rawFor( value, 'c' )[ 1 ] ).toBe( checkpoint );
		expect( work.host.getStatus().phase ).toBe( 'uncertain' );
	} finally { if ( value ) value.lifecycle.dispose( true ); work.close(); }
} );
it( 'captures pagehide before an earlier-registered bootstrap teardown listener', async () => {
	const work = setup( true, 2, 2, 3 ); let value, atTeardown;
	const teardown = () => { atTeardown = rawFor( value, 'd' ); work.editor.isDestroyed = true; work.host.dispose(); };
	window.addEventListener( 'pagehide', teardown );
	try {
		expect( await work.host.load() ).toBe( true ); value = connect( work ); await value.lifecycle.initialize(); work.edit( 'Last event work' );
		window.dispatchEvent( new Event( 'pagehide' ) ); expect( atTeardown ).toBeDefined();
		expect( JSON.parse( atTeardown[ 1 ] ).pdfCreation.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Last event work' );
		expect( value.lifecycle.getStatus().disposed ).toBe( true ); expect( work.publisher.publish ).not.toHaveBeenCalled();
	} finally { window.removeEventListener( 'pagehide', teardown ); if ( value ) value.lifecycle.dispose( true ); work.close(); }
} );
it( 'leaves voluntary disposal live after an exit-write failure and permits an exact retry', async () => {
	const local = storage(), write = local.setItem; let fail = false;
	local.setItem = ( key, raw ) => { if ( fail && key.endsWith( '#' + 'd'.repeat( 32 ) ) ) throw new Error( 'quota' ); write( key, raw ); };
	const { work, value } = await start( local );
	try {
		work.edit( 'Not disposable' ); fail = true; const before = complete( work );
		expect( value.lifecycle.dispose() ).toBe( false ); expect( value.lifecycle.getStatus().disposed ).toBe( false );
		expect( value.controller.getLifecycleStatus().ready ).toBe( true ); expect( complete( work ) ).toEqual( before );
		fail = false; expect( value.lifecycle.dispose() ).toBe( true ); const stored = Array.from( local.values );
		expect( value.lifecycle.dispose() ).toBe( true ); expect( Array.from( local.values ) ).toEqual( stored );
	} finally { fail = false; value.lifecycle.dispose( true ); work.close(); }
} );
it( 'reports terminal pagehide storage failure without claiming a clean close or changing current work', async () => {
	const local = storage(), write = local.setItem; let fail = false;
	local.setItem = ( key, raw ) => { if ( fail && key.endsWith( '#' + 'd'.repeat( 32 ) ) ) throw new Error( 'quota' ); write( key, raw ); };
	const { work, value } = await start( local );
	try {
		work.edit( 'Retain current' ); const before = complete( work ), active = rawFor( value, 'b' )[ 1 ]; fail = true;
		window.dispatchEvent( new Event( 'pagehide' ) ); expect( value.lifecycle.getStatus() ).toMatchObject( { disposed: true, finalized: false } );
		expect( value.ui.notifyFailure ).toHaveBeenCalled(); expect( complete( work ) ).toEqual( before ); expect( rawFor( value, 'b' )[ 1 ] ).toBe( active );
	} finally { fail = false; value.lifecycle.dispose( true ); work.close(); }
} );
it( 'prepares and commits a clean close with native owner return data while preserving all backups and the editor', async () => {
	const { work, value } = await confirmed();
	try {
		const before = complete( work ), plan = value.lifecycle.prepareCleanClose(); expect( plan.returnTarget ).toEqual( { owner: 'Owner', revisionId: 13 } );
		plan.returnTarget.owner = 'File:Source.pdf'; const stored = Array.from( value.local.values );
		expect( value.lifecycle.commitCleanClose( plan.handle ) ).toEqual( { closed: true, returnTarget: { owner: 'Owner', revisionId: 13 }, backupPreserved: true } );
		expect( complete( work ) ).toEqual( before ); expect( Array.from( value.local.values ) ).toEqual( stored );
		expect( value.lifecycle.getStatus() ).toMatchObject( { finalized: true, ready: false } );
		expect( () => value.lifecycle.commitCleanClose( plan.handle ) ).toThrow(); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it.each( [ 'late layers', 'Undo', 'history-only change', 'selection', 'URL', 'geometry', 'exit backup', 'exit writer', 'method', 'host invalidation', 'new operation', 'released', 'forged' ] )(
	'refuses clean Close after %s without finalizing or losing current work', async reason => {
		const { work, value } = await confirmed();
		try {
			const plan = value.lifecycle.prepareCleanClose(); let handle = plan.handle;
			if ( reason === 'late layers' ) work.edit( 'Late' );
			if ( reason === 'Undo' ) work.editor.historyManager.undo();
			if ( reason === 'history-only change' ) work.editor.historyManager.history[ 0 ].description += ' newer';
			if ( reason === 'selection' ) work.editor.canvasManager.selectedLayerIds = [ 'text-2' ];
			if ( reason === 'URL' ) window.history.replaceState( {}, '', '?elsewhere' );
			if ( reason === 'geometry' ) work.editor.canvasManager.canvas.height++;
			if ( reason === 'exit backup' ) value.local.values.set( rawFor( value, 'd' )[ 0 ], '{"foreign":true}' );
			if ( reason === 'exit writer' ) value.exit._writerId = 'e'.repeat( 32 );
			if ( reason === 'method' ) value.exit.read = () => null;
			if ( reason === 'host invalidation' ) work.host.invalidate();
			if ( reason === 'new operation' ) await expect( value.lifecycle.save() ).rejects.toThrow();
			if ( reason === 'released' ) value.lifecycle.releaseCleanClose( handle );
			if ( reason === 'forged' ) handle = { owner: 'Owner' };
			const before = complete( work ); expect( () => value.lifecycle.commitCleanClose( handle ) ).toThrow();
			expect( complete( work ) ).toEqual( before ); expect( value.lifecycle.getStatus().finalized ).toBe( false );
		} finally { value.lifecycle.dispose( true ); work.close(); }
	} );
it.each( [ 'unsaved', 'uncertain', 'newer work', 'refresh failure' ] )( 'refuses a %s creation as a clean Close', async reason => {
	const { work, value } = await start();
	try {
		if ( reason !== 'unsaved' ) {
			work.edit( 'Original' ); const pending = wait(); work.publisher.publish.mockReturnValue( pending.promise ); const saving = value.lifecycle.save().catch( error => error );
			await tickUntil( () => work.publisher.publish.mock.calls.length === 1 ); if ( reason === 'newer work' ) work.edit( 'Newer' );
			if ( reason === 'refresh failure' ) work.editor.toolbar = { updateUndoRedoState: () => { throw new Error( 'UI refresh' ); } };
			if ( reason === 'uncertain' ) pending.reject( new Error( 'lost' ) ); else pending.resolve( { revisionId: 13 } ); await saving;
		}
		expect( () => value.lifecycle.prepareCleanClose() ).toThrow(); expect( value.lifecycle.getStatus().finalized ).toBe( false );
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it( 'serializes Save, Check and handoff while publication is pending and never closes automatically', async () => {
	const { work, value } = await start();
	try {
		work.edit( 'Save' ); const pending = wait(); work.publisher.publish.mockReturnValue( pending.promise ); const saving = value.lifecycle.save();
		await tickUntil( () => work.publisher.publish.mock.calls.length === 1 ); await expect( value.lifecycle.save() ).rejects.toThrow();
		await expect( value.lifecycle.reconcile( {}, {} ) ).rejects.toThrow(); await expect( value.lifecycle.handoffSavedSession( {} ) ).rejects.toThrow();
		expect( () => value.lifecycle.prepareCleanClose() ).toThrow(); pending.resolve( { revisionId: 13 } ); await saving;
		expect( value.lifecycle.getStatus() ).toMatchObject( { finalized: false, transferred: false, ready: true } );
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it( 'passes fresh reconciliation through the independent controller checkpoint without publication', async () => {
	const work = await uncertain(); let value;
	try {
		value = connect( work ); await value.lifecycle.initialize(); const native = remote( work );
		const result = await value.lifecycle.reconcile( native.dependencies, new DraftStore( value.local, 'c'.repeat( 32 ) ) );
		expect( result ).toMatchObject( { outcome: 'base-current', applied: true } ); expect( work.host.getStatus().phase ).toBe( 'ready' );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 ); expect( rawFor( value, 'd' ) ).toBeUndefined();
	} finally { if ( value ) value.lifecycle.dispose( true ); work.close(); }
} );
it( 'refuses to share the checkpoint writer with the independent exit writer', async () => {
	const work = await uncertain(); let value;
	try {
		value = connect( work ); await value.lifecycle.initialize(); const native = remote( work );
		await expect( value.lifecycle.reconcile( native.dependencies, value.exit ) ).rejects.toThrow();
		await expect( value.lifecycle.reconcile( native.dependencies, new DraftStore( value.local, 'd'.repeat( 32 ) ) ) ).rejects.toThrow();
		expect( native.api.get ).not.toHaveBeenCalled(); expect( rawFor( value, 'd' ) ).toBeUndefined();
	} finally { if ( value ) value.lifecycle.dispose( true ); work.close(); }
} );
it( 'returns fresh saved ownership and preserves newer edits, active Undo and offscreen Redo', async () => {
	const work = await uncertain(); let value, delivered;
	try {
		value = connect( work ); await value.lifecycle.initialize(); const native = remote( work, 13 );
		await value.lifecycle.reconcile( native.dependencies, new DraftStore( value.local, 'c'.repeat( 32 ) ) );
		delivered = await value.lifecycle.handoffSavedSession( { reader: native.dependencies.reader, pdfReader: native.dependencies.pdfReader, publisher: work.publisher } );
		expect( delivered.needsRefresh ).toBe( false ); expect( JSON.parse( delivered.exitBackup ).pdfCreation.confirmation.revisionId ).toBe( 13 );
		expect( value.lifecycle.getStatus() ).toMatchObject( { transferred: true, ready: false } ); expect( value.lifecycle.flush() ).toBe( false );
		expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.layers[ 0 ].text ).toBe( 'Sent two' );
		expect( work.editor.historyManager.redo() ).toBe( true ); expect( await delivered.coordinator.turn( 1 ) ).toBe( true );
		expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.editor.layers[ 0 ].text ).toBe( 'History-only Redo' );
		expect( rawFor( value, 'd' )[ 1 ] ).toBe( delivered.exitBackup ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { if ( value ) value.lifecycle.dispose( true ); if ( delivered ) delivered.bridge.dispose(); work.close(); }
} );
it( 'refuses a pending saved handoff after lifecycle disposal before transferring editor ownership', async () => {
	const { work, value } = await confirmed(); let delivered;
	try {
		const native = remote( work, 13 ), pending = wait();
		native.dependencies.pdfReader.read = jest.fn( async request => native.context( request.page ) ).mockReturnValueOnce( pending.promise );
		const handing = value.lifecycle.handoffSavedSession( { reader: native.dependencies.reader, pdfReader: native.dependencies.pdfReader, publisher: work.publisher } )
			.then( result => { delivered = result; return result; } );
		await tickUntil( () => native.dependencies.pdfReader.read.mock.calls.length === 1 ); expect( value.lifecycle.dispose() ).toBe( true );
		const before = complete( work ); pending.resolve( native.context( 2 ) ); await expect( handing ).rejects.toThrow();
		expect( complete( work ) ).toEqual( before ); expect( work.editor.canvasManager.exactStages.size ).toBe( 0 );
	} finally { value.lifecycle.dispose( true ); if ( delivered ) delivered.bridge.dispose(); work.close(); }
} );
it.each( [ 'same bytes with another store', 'another controller' ] )( 'never claims an exit writer via %s', async reason => {
	const { work, value } = await start();
	try {
		const proof = value.controller.preserveForExit( value.exit ), stored = Array.from( value.local.values );
		if ( reason === 'same bytes with another store' ) {
			const other = new DraftStore( value.local, 'd'.repeat( 32 ) ); expect( () => value.controller.preserveForExit( other ) ).toThrow();
		} else {
			const other = new Controller( work.host, new DraftStore( value.local, 'e'.repeat( 32 ) ), { wiki: 'wiki', user: 'Editor' }, { retainPublicationAttempt: true } );
			expect( () => other.preserveForExit( value.exit ) ).toThrow();
		}
		expect( Array.from( value.local.values ) ).toEqual( stored ); expect( () => proof.preflight() ).not.toThrow();
	} finally { value.lifecycle.dispose( true ); work.close(); }
} );
it.each( [ 'missing readback', 'write callback changes work' ] )( 'refuses clean-close preparation when %s', async reason => {
	const local = storage(), write = local.setItem; let action = false, edit;
	local.setItem = ( key, raw ) => {
		if ( action && key.endsWith( '#' + 'd'.repeat( 32 ) ) ) {
			if ( reason === 'missing readback' ) return;
			write( key, raw ); edit( 'Current newer work' ); return;
		}
		write( key, raw );
	};
	const { work, value } = await start( local );
	try {
		work.edit( 'Saved' ); work.publisher.publish.mockResolvedValue( { revisionId: 13 } ); await value.lifecycle.save();
		edit = work.edit; action = true; expect( () => value.lifecycle.prepareCleanClose() ).toThrow();
		expect( value.lifecycle.getStatus().finalized ).toBe( false );
		if ( reason === 'write callback changes work' ) expect( work.editor.layers[ 0 ].text ).toBe( 'Current newer work' );
		else expect( rawFor( value, 'd' ) ).toBeUndefined();
	} finally { action = false; value.lifecycle.dispose( true ); work.close(); }
} );
it( 'defers autosave during Check and retains newer work after its refused transition', async () => {
	const work = await uncertain(); let value; jest.useFakeTimers( { doNotFake: [ 'queueMicrotask' ] } );
	try {
		value = connect( work ); await value.lifecycle.initialize(); const native = remote( work ), pending = wait(); native.api.get.mockReturnValueOnce( pending.promise );
		const checking = value.lifecycle.reconcile( native.dependencies, new DraftStore( value.local, 'c'.repeat( 32 ) ) );
		await tickUntil( () => native.api.get.mock.calls.length === 1 ); const before = rawFor( value, 'b' )[ 1 ], checkpoint = rawFor( value, 'c' )[ 1 ];
		work.edit( 'Late guarded autosave' ); jest.advanceTimersByTime( 1000 ); expect( rawFor( value, 'b' )[ 1 ] ).toBe( before );
		pending.resolve( query( work ) ); await expect( checking ).rejects.toThrow();
		expect( JSON.parse( rawFor( value, 'b' )[ 1 ] ).pdfCreation.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Late guarded autosave' );
		expect( rawFor( value, 'c' )[ 1 ] ).toBe( checkpoint ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { if ( value ) value.lifecycle.dispose( true ); jest.useRealTimers(); work.close(); }
} );
it( 'loads under ResourceLoader without resolving relative modules at definition time', () => {
	const source = fs.readFileSync( path.resolve( __dirname, '../../resources/ext.layers.editor/PageOwnedPdfCreationLifecycle.js' ), 'utf8' );
	const sandbox = { window: { Layers: { Editor: {} } }, module: { exports: {} }, require: jest.fn( () => { throw new Error( 'relative require' ); } ) };
	vm.runInNewContext( source, sandbox ); expect( typeof sandbox.module.exports ).toBe( 'function' ); expect( sandbox.require ).not.toHaveBeenCalled();
} );
