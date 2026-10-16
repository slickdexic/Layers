'use strict';
const { setup, preparation, witness, wait, tickUntil, copy } = require( './fixtures/pdfCreationHost.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const PublishClient = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
const State = require( '../../resources/ext.layers.editor/StateManager.js' );
const fs = require( 'fs' ), path = require( 'path' ), vm = require( 'vm' );

function storage() {
	const values = new Map();
	return { values, get length() { return values.size; }, key: index => Array.from( values.keys() )[ index ] || null,
		getItem: jest.fn( key => values.has( key ) ? values.get( key ) : null ),
		setItem: jest.fn( ( key, value ) => values.set( key, value ) ), removeItem: jest.fn( key => values.delete( key ) ) };
}
const identity = { wiki: 'wiki', user: 'Editor' };
function controller( work, local = storage(), writer = 'b'.repeat( 32 ) ) {
	const store = new Store( local, writer ), controller = new Controller( work.host, store, identity );
	return { controller, store, local, writer };
}
function put( local, work, draft, writer = 'a'.repeat( 32 ) ) {
	const target = work.host.getDraft().creation.target, scope = { ...identity, owner: target.owner, baseRevisionId: target.revisionId, surfaceId: target.surfaceId };
	const raw = JSON.stringify( { version: 1, scope, pdfCreation: draft } );
	new Store( local, writer ).write( scope, raw ); return raw;
}
const yes = () => ( { choose: jest.fn( async () => 0 ), confirm: jest.fn( async () => true ) } );
async function draftFixture( slot = true, count = 3 ) {
	const work = setup( slot, 2, 2, count );
	try {
		expect( await work.host.load() ).toBe( true ); work.edit( 'Second recovered' );
		expect( await work.host.turn( 1 ) ).toBe( true ); work.edit( 'First Redo' ); work.editor.historyManager.undo();
		if ( count > 2 ) { expect( await work.host.turn( 3 ) ).toBe( true ); work.edit( 'Third recovered' ); }
		expect( await work.host.turn( 2 ) ).toBe( true );
		return work.host.captureDraftEnvelope();
	} finally { work.close(); }
}
function complete( work ) { return { editor: witness( work ), draft: work.host.getDraft(), history: work.host.captureDraftHistory() }; }

describe( 'Explicit creation recovery with actual per-page histories', () => {
	it.each( [ false, true ] )( 'restores prospective members and history-only blank Redo pages with slot=%s', async slot => {
		const backup = await draftFixture( slot ), work = setup( slot, 2, 2, 3 );
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Current second' ); const before = complete( work );
			const prepared = work.host.prepareDraftRecovery( backup ); expect( prepared.preview.editorState.layers[ 0 ].text ).toBe( 'Second recovered' );
			expect( complete( work ) ).toEqual( before ); expect( await work.host.commitDraftRecovery( prepared.handle ) ).toBe( true );
			expect( work.host.getDraft() ).toEqual( backup.draft ); expect( work.host.captureDraftHistory() ).toEqual( backup.history );
			expect( work.reader.read.mock.calls.slice( 1 ).map( call => call[ 0 ].page ) ).toEqual( [ 2, 3, 1 ] );
			expect( await work.host.turn( 1 ) ).toBe( true ); expect( work.editor.stateManager.get( 'layers' ) ).toEqual( [] );
			expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'First Redo' );
			expect( work.host.getDraft().snapshot.surfaces.slice( slot ? 2 : 0 ).map( member => member.source.page ) ).toEqual( [ 1, 2, 3 ] );
			expect( work.publisher.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'cancels a prepared handle without changing current work or the backup', async () => {
		const backup = await draftFixture(), original = copy( backup ), work = setup( true, 2, 2, 3 );
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Current' ); const before = complete( work );
			const prepared = work.host.prepareDraftRecovery( backup ); work.host.releaseDraftRecovery( prepared.handle );
			await expect( work.host.commitDraftRecovery( prepared.handle ) ).rejects.toThrow(); expect( complete( work ) ).toEqual( before ); expect( backup ).toEqual( original );
		} finally { work.close(); }
	} );
	it.each( [ 'creation', 'owner', 'historical base', 'sibling', 'label', 'source', 'duplicate', 'timeline payload', 'saved marker', 'missing active', 'missing history-only authority' ] )(
		'refuses %s recovery before replacing current work', async reason => {
			const backup = await draftFixture(), work = setup( true, 2, 2, 3 );
			try {
				expect( await work.host.load() ).toBe( true ); work.edit( 'Keep' ); const before = complete( work );
				if ( reason === 'creation' ) backup.draft.creation.selection.expected += '|off';
				if ( reason === 'owner' ) backup.history.creation.target.owner = 'Other';
				if ( reason === 'historical base' ) backup.draft.creation.target.revisionId--;
				if ( reason === 'sibling' ) backup.draft.snapshot.surfaces[ 0 ].layers = [];
				if ( reason === 'label' ) backup.draft.snapshot.surfaces[ 2 ].label = 'Other';
				if ( reason === 'source' ) backup.history.members[ 0 ].source.sha1 = 'b'.repeat( 31 );
				if ( reason === 'duplicate' ) backup.history.members.push( copy( backup.history.members[ 0 ] ) );
				if ( reason === 'timeline payload' ) backup.history.members[ 1 ].timeline.history[ 1 ].layers[ 0 ].text = 'Mismatched';
				if ( reason === 'saved marker' ) backup.history.members[ 1 ].timeline.lastSaveHistoryIndex = 0;
				if ( reason === 'missing active' ) backup.history.members = backup.history.members.filter( member => member.page !== 2 );
				if ( reason === 'missing history-only authority' ) work.reader.read.mockImplementation( async options => { if ( options.page === 1 ) throw new Error( 'Denied' ); return preparation( true, 2, options.page, 3 ); } );
				await expect( ( async () => { const plan = work.host.prepareDraftRecovery( backup ); await work.host.commitDraftRecovery( plan.handle ); } )() ).rejects.toThrow();
				expect( complete( work ) ).toEqual( before ); expect( work.publisher.publish ).not.toHaveBeenCalled();
			} finally { work.close(); }
		} );
	it.each( [ 'first read', 'middle read', 'decode', 'confirmation' ] )( 'refuses newer current work during %s', async boundary => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), deferred = wait();
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Before' ); const plan = work.host.prepareDraftRecovery( backup );
			if ( boundary === 'confirmation' ) { work.edit( 'While confirming' ); const before = complete( work ); await expect( work.host.commitDraftRecovery( plan.handle ) ).rejects.toThrow(); expect( complete( work ) ).toEqual( before ); return; }
			let requested = 0;
			if ( boundary !== 'decode' ) work.reader.read.mockImplementation( options => { requested++; return requested === ( boundary === 'first read' ? 1 : 2 ) ? deferred.promise : Promise.resolve( preparation( true, 2, options.page, 3 ) ); } );
			else global.Image.prototype.decode = () => deferred.promise;
			const pending = work.host.commitDraftRecovery( plan.handle );
			if ( boundary === 'middle read' ) await tickUntil( () => requested === 2 );
			if ( boundary === 'decode' ) await tickUntil( () => work.editor.canvasManager.exactStages.size > 0 );
			work.edit( 'Newer ' + boundary ); const before = complete( work ); deferred.resolve( boundary === 'decode' ? undefined : preparation( true, 2, boundary === 'first read' ? 2 : 3, 3 ) );
			await expect( pending ).rejects.toThrow(); expect( complete( work ) ).toEqual( before );
		} finally { work.close(); }
	} );
	it( 'stops before another native read when the complete Undo witness changes during the first read', async () => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), deferred = wait();
		try {
			expect( await work.host.load() ).toBe( true ); const plan = work.host.prepareDraftRecovery( backup ); work.reader.read.mockReturnValueOnce( deferred.promise );
			const pending = work.host.commitDraftRecovery( plan.handle ); work.editor.historyManager.lastSaveHistoryIndex = 0;
			deferred.resolve( preparation( true, 2, 2, 3 ) ); await expect( pending ).rejects.toThrow(); expect( work.reader.read ).toHaveBeenCalledTimes( 2 );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( 0 );
		} finally { work.close(); }
	} );
	it.each( [ 'dispose', 'history participant', 'decode failure', 'wrong rendition' ] )( 'preserves current work and the backup on recovery %s', async reason => {
		const backup = await draftFixture(), original = copy( backup ), work = setup( true, 2, 2, 3 ), deferred = wait();
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Current' );
			const plan = work.host.prepareDraftRecovery( backup ); work.reader.read.mockReturnValueOnce( deferred.promise );
			const pending = work.host.commitDraftRecovery( plan.handle ), history = work.editor.historyManager;
			if ( reason === 'dispose' ) work.host.dispose();
			if ( reason === 'history participant' ) work.editor.historyManager = Object.create( history );
			if ( reason === 'decode failure' ) global.Image.prototype.decode = () => Promise.reject( new Error( 'Decode' ) );
			if ( reason === 'wrong rendition' ) Object.defineProperty( global.Image.prototype, 'width', { get: () => 999, set() {}, configurable: true } );
			const before = witness( work ); deferred.resolve( preparation( true, 2, 2, 3 ) );
			await expect( pending ).rejects.toThrow(); expect( witness( work ) ).toEqual( before ); expect( backup ).toEqual( original );
			work.editor.historyManager = history;
		} finally { work.close(); }
	} );
	it( 'never clears an existing uncertainty hold by restoring a ready-phase backup', async () => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ); try {
			expect( await work.host.load() ).toBe( true ); work.host.blockPublication(); const plan = work.host.prepareDraftRecovery( backup );
			expect( await work.host.commitDraftRecovery( plan.handle ) ).toBe( true ); expect( work.host.getStatus().publicationBlocked ).toBe( true );
			await expect( work.host.save( '', () => {} ) ).rejects.toThrow(); expect( work.publisher.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );

describe( 'Scoped creation draft storage and the approved recovery dialog interface', () => {
	it( 'requires review before first persistence or Save and discovers only the exact scope', async () => {
		const work = setup(), local = storage(); try {
			expect( await work.host.load() ).toBe( true ); const c = controller( work, local );
			expect( () => c.controller.persist() ).toThrow(); await expect( c.controller.save() ).rejects.toThrow();
			expect( await c.controller.review( yes() ) ).toBe( false ); work.edit( 'Local' ); const raw = c.controller.persist();
			expect( JSON.parse( raw ).pdfCreation.draft ).toEqual( work.host.getDraft() ); expect( c.controller.listCandidates() ).toHaveLength( 1 );
			local.values.set( Store.STORAGE_KEY_PREFIX + JSON.stringify( [ 'other-wiki', 'Editor', 'Owner', 12, work.native.target.surfaceId ] ) + '#' + 'c'.repeat( 32 ), raw );
			expect( c.controller.listCandidates() ).toHaveLength( 1 ); expect( local.removeItem ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'lets the owner choose either candidate and restores only after confirmation without changing source bytes', async () => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), local = storage();
		try {
			expect( await work.host.load() ).toBe( true ); const original = put( local, work, backup ), second = copy( backup );
			second.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text = 'Alternative'; second.history.members[ 1 ].timeline.history[ 1 ].layers[ 0 ].text = 'Alternative';
			put( local, work, second, 'c'.repeat( 32 ) ); const stored = new Map( local.values ); const c = controller( work, local ), ui = yes();
			expect( await c.controller.review( ui ) ).toBe( true ); expect( ui.choose ).toHaveBeenCalledTimes( 1 ); expect( ui.confirm ).toHaveBeenCalledTimes( 1 );
			expect( local.values ).toEqual( stored ); expect( local.values.values().next().value ).toBe( original );
			expect( c.store._readWriterId ).toBe( c.writer ); expect( c.store._writerId ).toBe( c.writer );
			c.controller.persist(); expect( local.values.size ).toBe( 3 ); expect( local.removeItem ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'choose', 'confirm' ] )( 'keeps backups and current work on %s cancellation and blocks unreviewed overwrite', async step => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), local = storage();
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Current' ); put( local, work, backup ); if ( step === 'choose' ) put( local, work, backup, 'c'.repeat( 32 ) );
			const c = controller( work, local ), before = complete( work ), stored = new Map( local.values ), ui = yes();
			if ( step === 'choose' ) ui.choose.mockResolvedValue( null ); else ui.confirm.mockResolvedValue( false );
			expect( await c.controller.review( ui ) ).toBe( false ); expect( complete( work ) ).toEqual( before ); expect( local.values ).toEqual( stored );
			expect( () => c.controller.persist() ).toThrow(); await expect( c.controller.save() ).rejects.toThrow(); expect( work.host.getStatus().publicationBlocked ).toBe( true );
		} finally { work.close(); }
	} );
	it( 'refuses a backup changed during confirmation without overwriting either local record', async () => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), local = storage(), deferred = wait();
		try {
			expect( await work.host.load() ).toBe( true ); put( local, work, backup ); const c = controller( work, local ), ui = yes(); ui.confirm.mockReturnValue( deferred.promise );
			const pending = c.controller.review( ui ); const key = Array.from( local.values.keys() )[ 0 ]; local.values.set( key, local.values.get( key ) + ' ' );
			const before = complete( work ), stored = new Map( local.values ); deferred.resolve( true ); await expect( pending ).rejects.toThrow();
			expect( complete( work ) ).toEqual( before ); expect( local.values ).toEqual( stored ); expect( local.removeItem ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'restores the second independent writer choice rather than the first matching payload', async () => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), local = storage(); try {
			expect( await work.host.load() ).toBe( true ); put( local, work, backup ); const alternative = copy( backup );
			alternative.draft.snapshot.surfaces[ 2 ].layers[ 0 ].text = 'Second writer'; alternative.history.members[ 1 ].timeline.history[ 1 ].layers[ 0 ].text = 'Second writer';
			put( local, work, alternative, 'c'.repeat( 32 ) ); const c = controller( work, local ), ui = yes(); ui.choose.mockResolvedValue( 1 );
			expect( await c.controller.review( ui ) ).toBe( true ); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Second writer' ); expect( local.values.size ).toBe( 2 );
		} finally { work.close(); }
	} );
	it.each( [ 'confirmation edit', 'later native read', 'replaced storage read', 'disposed controller' ] )( 'refuses recovery after %s', async reason => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), local = storage(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); put( local, work, backup ); const c = controller( work, local ), ui = yes(), originalRead = c.store._read;
			if ( reason === 'later native read' ) work.reader.read.mockReturnValueOnce( deferred.promise ); else ui.confirm.mockReturnValue( deferred.promise );
			const pending = c.controller.review( ui );
			if ( reason === 'later native read' ) { await tickUntil( () => work.reader.read.mock.calls.length === 2 ); const key = Array.from( local.values.keys() )[ 0 ]; local.values.set( key, local.values.get( key ) + ' ' ); }
			if ( reason === 'confirmation edit' ) work.edit( 'Newer during confirmation' );
			if ( reason === 'replaced storage read' ) c.store._read = () => null;
			if ( reason === 'disposed controller' ) c.controller.dispose();
			const before = complete( work ), stored = new Map( local.values ); deferred.resolve( reason === 'later native read' ? preparation( true, 2, 2, 3 ) : true );
			await expect( pending ).rejects.toThrow(); expect( complete( work ) ).toEqual( before ); expect( local.values ).toEqual( stored ); c.store._read = originalRead;
		} finally { work.close(); }
	} );
	it( 'does not overwrite a pre-existing record with a reused writer ID', async () => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), local = storage(); try {
			expect( await work.host.load() ).toBe( true ); put( local, work, backup, 'b'.repeat( 32 ) ); const stored = new Map( local.values ), c = controller( work, local );
			expect( await c.controller.review( yes() ) ).toBe( true ); expect( () => c.controller.persist() ).toThrow();
			await expect( c.controller.save() ).rejects.toThrow(); expect( local.values ).toEqual( stored ); expect( work.publisher.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it( 'reuses the actual unchanged dialog for explicit Restore', async () => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ), local = storage();
		const Dialog = require( '../../resources/ext.layers.editor/PageOwnedRecoveryDialog.js' );
		const show = HTMLDialogElement.prototype.showModal, close = HTMLDialogElement.prototype.close;
		HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; };
		const ui = new Dialog( key => key ); try {
			expect( await work.host.load() ).toBe( true ); put( local, work, backup ); const c = controller( work, local ), pending = c.controller.review( ui );
			const dialog = document.querySelector( 'dialog.layers-page-recovery' ); expect( dialog ).not.toBeNull();
			expect( dialog.querySelector( 'pre' ).textContent ).toContain( 'Second recovered' );
			dialog.querySelector( '.layers-page-recovery-primary' ).click(); expect( await pending ).toBe( true ); expect( document.querySelector( 'dialog.layers-page-recovery' ) ).toBeNull();
			expect( local.removeItem ).not.toHaveBeenCalled();
		} finally { ui.dispose(); HTMLDialogElement.prototype.showModal = show; HTMLDialogElement.prototype.close = close; work.close(); }
	} );
	it.each( [ 'saving', 'conflict', 'uncertain' ] )( 'restores %s layers and Undo while keeping publication blocked', async phase => {
		const backup = await draftFixture(), work = setup( true, 2, 2, 3 ); backup.phase = phase;
		try {
			expect( await work.host.load() ).toBe( true ); const plan = work.host.prepareDraftRecovery( backup ); expect( plan.preview.publicationBlocked ).toBe( true );
			expect( await work.host.commitDraftRecovery( plan.handle ) ).toBe( true ); expect( work.host.getStatus().publicationBlocked ).toBe( true );
			await expect( work.host.save( '', () => {} ) ).rejects.toThrow(); expect( work.publisher.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );

describe( 'Explicit first Save and success-only history markers', () => {
	it( 'persists before dispatch, publishes the complete set, and retains the confirmed/current bases for handoff', async () => {
		const work = setup(), cLocal = storage(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Second saved' ); expect( await work.host.turn( 1 ) ).toBe( true ); work.edit( 'First saved' );
			const c = controller( work, cLocal ); await c.controller.review( yes() );
			work.publisher.publish.mockImplementation( async request => {
				const saved = Array.from( cLocal.values.values() ).map( JSON.parse ); expect( saved ).toHaveLength( 1 ); expect( saved[ 0 ].pdfCreation.phase ).toBe( 'saving' );
				expect( request ).not.toHaveProperty( 'mainText' ); expect( JSON.parse( request.snapshotJson ).surfaces ).toHaveLength( 4 ); return { revisionId: 13 };
			} );
			const result = await c.controller.save( 'Create PDF set' ); expect( result ).toMatchObject( { revisionId: 13, hostReady: true, draftPersisted: true } );
			expect( result.snapshot ).toEqual( result.currentSnapshot ); expect( work.host.getStatus() ).toMatchObject( { phase: 'confirmed', dirty: false } );
			expect( work.host.captureDraftHistory().members.map( member => member.timeline.lastSaveHistoryIndex ) ).toEqual( [ 1, 1 ] );
			const persisted = JSON.parse( Array.from( cLocal.values.values() )[ 0 ] ).pdfCreation;
			expect( persisted.confirmation ).toEqual( { revisionId: 13, snapshot: result.snapshot } ); expect( persisted.phase ).toBe( 'confirmed' );
			expect( persisted.draft.creation.baseText ).toBe( work.native.baseText ); await expect( c.controller.save() ).rejects.toThrow(); expect( cLocal.removeItem ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
	it.each( [ 'storage', 'read', 'publish' ] )( 'retains newer edits and marks only the sent history state during pending %s', async boundary => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Sent' ); work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
			if ( boundary === 'read' ) work.reader.read.mockReturnValueOnce( deferred.promise );
			if ( boundary === 'publish' ) work.publisher.publish.mockReturnValueOnce( deferred.promise );
			const pending = work.host.save( 'Save', () => boundary === 'storage' ? deferred.promise : undefined );
			if ( boundary === 'publish' ) await tickUntil( () => work.publisher.publish.mock.calls.length === 1 );
			work.edit( 'Newer' ); deferred.resolve( boundary === 'read' ? preparation( true, 2, 2 ) : boundary === 'publish' ? { revisionId: 13 } : undefined );
			const result = await pending; expect( result.hostReady ).toBe( true ); expect( work.host.getStatus().dirty ).toBe( true );
			expect( result.snapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Sent' ); expect( result.currentSnapshot.surfaces[ 2 ].layers[ 0 ].text ).toBe( 'Newer' );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( 1 ); expect( work.editor.historyManager.historyIndex ).toBe( 2 );
		} finally { work.close(); }
	} );
	it.each( [ 'permissiondenied', 'layers-invalid-snapshot', 'layers-source-unavailable', 'layers-edit-conflict', 'missingparam', 'outofrange', 'maxbytes', 'mustbeposted', 'layers-main-model-change-denied', 'layers-publication-outcome-unknown' ] )(
		'preserves offscreen and active Undo markers on %s refusal', async code => {
			const work = setup(); try {
				expect( await work.host.load() ).toBe( true ); work.edit( 'Second' ); expect( await work.host.turn( 1 ) ).toBe( true ); work.edit( 'First' );
				const before = complete( work ); work.publisher.publish.mockRejectedValue( Object.assign( new Error( 'Bounded native refusal' ), { code } ) );
				await expect( work.host.save( 'Save', () => {} ) ).rejects.toMatchObject( { code } ); expect( complete( work ) ).toEqual( before );
				expect( work.host.captureDraftHistory().members.map( member => member.timeline.lastSaveHistoryIndex ) ).toEqual( [ -1, -1 ] );
			} finally { work.close(); }
		} );
	it( 'retains a safe bounded native invalid-snapshot description', async () => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true );
			const api = { postWithToken: () => Promise.resolve( { error: { code: 'layers-invalid-snapshot', info: 'Unsupported field on layer text-2.' } } ) };
			const client = new PublishClient( api ); work.publisher.publish.mockImplementation( options => client.publish( options ) );
			await expect( work.host.save( '', () => {} ) ).rejects.toMatchObject( { code: 'layers-invalid-snapshot', message: 'Unsupported field on layer text-2.' } );
		} finally { work.close(); }
	} );
	it( 'refuses failed backup storage before publication and retains previous backup bytes', async () => {
		const work = setup(), local = storage(); try {
			expect( await work.host.load() ).toBe( true ); const c = controller( work, local ); await c.controller.review( yes() ); work.edit( 'Backed up' ); c.controller.persist();
			const stored = new Map( local.values ); local.setItem.mockImplementation( () => { throw new Error( 'Quota' ); } ); work.edit( 'Current' );
			await expect( c.controller.save() ).rejects.toMatchObject( { code: 'layers-draft-storage-failed' } );
			expect( local.values ).toEqual( stored ); expect( work.publisher.publish ).not.toHaveBeenCalled(); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Current' );
		} finally { work.close(); }
	} );
	it( 'refuses a disposed draft owner before dispatch during native revalidation', async () => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); const c = controller( work ); await c.controller.review( yes() ); work.edit( 'Keep' );
			work.reader.read.mockReturnValueOnce( deferred.promise ); const pending = c.controller.save();
			await tickUntil( () => work.reader.read.mock.calls.length === 2 ); c.controller.dispose(); deferred.resolve( preparation( true, 2, 2 ) );
			await expect( pending ).rejects.toThrow(); expect( work.publisher.publish ).not.toHaveBeenCalled(); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Keep' );
		} finally { work.close(); }
	} );
	it.each( [ [ false, 1, 1 ], [ false, 2, 1 ], [ true, 1, 2 ], [ true, 2, 2 ] ] )( 'explicitly saves an empty initial anchor with slot=%s initial=%s requested=%s', async ( slot, initial, requested ) => {
		const work = setup( slot, initial, requested ); try {
			expect( await work.host.load() ).toBe( true ); work.publisher.publish.mockResolvedValue( { revisionId: 13 } );
			const result = await work.host.save( 'Create empty set', () => {} ); expect( result.hostReady ).toBe( true );
			expect( result.snapshot.surfaces.slice( slot ? 2 : 0 ).map( surface => [ surface.label, surface.source.page, surface.layers ] ) ).toEqual( [ [ 'ABC', initial, [] ] ] );
			expect( work.host.getStatus() ).toMatchObject( { page: requested, phase: 'confirmed', dirty: false } );
		} finally { work.close(); }
	} );
	it.each( [ 'missing result', 'invalid revision', 'unknown transport' ] )( 'keeps uncertainty and backup work after %s', async reason => {
		const work = setup(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Keep' ); const c = controller( work ); await c.controller.review( yes() ); const before = complete( work );
			if ( reason === 'missing result' ) work.publisher.publish.mockResolvedValue( null );
			if ( reason === 'invalid revision' ) work.publisher.publish.mockResolvedValue( { revisionId: 12 } );
			if ( reason === 'unknown transport' ) work.publisher.publish.mockRejectedValue( new Error( 'Secret transport diagnostic' ) );
			await expect( c.controller.save() ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown', message: 'layers-publication-outcome-unknown' } );
			expect( complete( work ) ).toEqual( before ); expect( work.host.getStatus().phase ).toBe( 'uncertain' ); await expect( c.controller.save() ).rejects.toThrow();
			expect( JSON.parse( Array.from( c.local.values.values() )[ 0 ] ).pdfCreation.phase ).toBe( 'uncertain' );
		} finally { work.close(); }
	} );
	it( 'records a confirmed Save after owner disposal without marking any Undo history saved', async () => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Sent' ); const c = controller( work ); await c.controller.review( yes() );
			work.publisher.publish.mockReturnValueOnce( deferred.promise ); const pending = c.controller.save(); await tickUntil( () => work.publisher.publish.mock.calls.length === 1 );
			c.controller.dispose(); const history = work.editor.historyManager.captureTimeline(); deferred.resolve( { revisionId: 13 } );
			const result = await pending; expect( result ).toMatchObject( { revisionId: 13, hostReady: false, draftPersisted: false } );
			expect( work.editor.historyManager.captureTimeline() ).toEqual( history ); expect( work.host.getStatus() ).toMatchObject( { phase: 'confirmed', needsRefresh: true } );
			expect( work.host.captureDraftEnvelope().confirmation.revisionId ).toBe( 13 );
		} finally { work.close(); }
	} );
	it( 'preserves both state-manager participants after replacement during the publication response', async () => {
		const work = setup(), deferred = wait(); const original = work.editor.stateManager;
		try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'Original participant' ); work.publisher.publish.mockReturnValueOnce( deferred.promise );
			const pending = work.host.save( '', () => {} ); await tickUntil( () => work.publisher.publish.mock.calls.length === 1 );
			const newer = new State( work.editor ); newer.set( 'layers', [ { id: 'new', type: 'text', text: 'Replacement participant' } ] ); work.editor.stateManager = newer;
			const history = work.editor.historyManager.captureTimeline(); deferred.resolve( { revisionId: 13 } );
			const result = await pending; expect( result ).toMatchObject( { revisionId: 13, hostReady: false } );
			expect( original.get( 'layers' )[ 0 ].text ).toBe( 'Original participant' ); expect( newer.get( 'layers' )[ 0 ].text ).toBe( 'Replacement participant' );
			expect( work.editor.historyManager.captureTimeline() ).toEqual( history );
		} finally { work.editor.stateManager = original; work.close(); }
	} );
	it( 'preserves a Redo branch back to the confirmed sent state when Undo occurs during publication', async () => {
		const work = setup(), deferred = wait(); try {
			expect( await work.host.load() ).toBe( true ); work.edit( 'First' ); work.edit( 'Sent second' ); work.publisher.publish.mockReturnValueOnce( deferred.promise );
			const pending = work.host.save( '', () => {} ); await tickUntil( () => work.publisher.publish.mock.calls.length === 1 ); work.editor.historyManager.undo();
			deferred.resolve( { revisionId: 13 } ); expect( ( await pending ).hostReady ).toBe( true ); expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( 2 );
			expect( work.host.getStatus().dirty ).toBe( true ); work.editor.historyManager.redo(); expect( work.host.getStatus().dirty ).toBe( false );
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( false );
		} finally { work.close(); }
	} );
} );

describe( 'Bounded optional creation transaction guards', () => {
	it.each( [ [ 1, 1 ], [ 0 ], [ 4 ], [ '1' ], [ NaN ] ].map( pages => [ pages ] ) )( 'refuses invalid history-only pages %j without transport', async pages => {
		const reader = { read: jest.fn() }, transaction = new Transaction( preparation( false, 2, 2, 3 ), { reader, publisher: { publish() {} } } );
		await expect( transaction.prepareDraft( transaction.getDraft(), { pages } ) ).rejects.toThrow(); expect( reader.read ).not.toHaveBeenCalled();
	} );
	it( 'does not invoke options accessors and rejects an async guard', async () => {
		const reader = { read: jest.fn() }, transaction = new Transaction( preparation( false, 2, 2, 3 ), { reader, publisher: { publish() {} } } ), getter = jest.fn();
		const options = {}; Object.defineProperty( options, 'guard', { get: getter, enumerable: true } );
		await expect( transaction.prepareDraft( transaction.getDraft(), options ) ).rejects.toThrow(); expect( getter ).not.toHaveBeenCalled();
		await expect( transaction.prepareDraft( transaction.getDraft(), { guard: async () => {} } ) ).rejects.toThrow(); expect( reader.read ).not.toHaveBeenCalled();
		await expect( transaction.prepareDraft( transaction.getDraft(), { guard: async () => { throw new Error( 'Rejected asynchronous hook' ); } } ) ).rejects.toThrow();
	} );
	it( 'loads the unregistered controller in MediaWiki script mode without relative imports', () => {
		const forbidden = jest.fn( () => { throw new Error( 'Relative require unavailable' ); } );
		const sandbox = vm.createContext( { window: {}, module: { exports: {} }, require: forbidden } );
		vm.runInContext( fs.readFileSync( path.join( __dirname, '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' ), 'utf8' ), sandbox );
		expect( vm.runInContext( 'typeof window.Layers.Editor.PageOwnedPdfCreationDraftController', sandbox ) ).toBe( 'function' ); expect( forbidden ).not.toHaveBeenCalled();
	} );
} );
