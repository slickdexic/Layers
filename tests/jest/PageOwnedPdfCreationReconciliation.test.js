'use strict';
const { setup, preparation, witness, wait, tickUntil, copy } = require( './fixtures/pdfCreationHost.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationDraftController.js' );
const DraftStore = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Ids = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
const ReadClient = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const Transaction = require( '../../resources/ext.layers.editor/PageOwnedPdfCreationTransaction.js' );
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

async function readyController( work, local = storage(), retained = true ) {
	const value = controller( work, local, retained );
	await value.controller.review( { choose: async () => 0, confirm: async () => true } );
	return { ...value, checkpoint: new DraftStore( local, 'c'.repeat( 32 ) ) };
}
it.each( [ false, true ] )( 'applies a freshly unchanged base without retrying or changing layers, selection and Undo, slot=%s', async slot => {
	const work = await uncertain( slot );
	try {
		const value = await readyController( work ), before = complete( work ), native = remote( work );
		const result = await value.controller.reconcilePublication( native.dependencies, value.checkpoint );
		expect( result ).toMatchObject( { outcome: 'base-current', applied: true, holdCleared: true, publicationRetried: false, draftPersisted: true } );
		expect( work.host.getStatus() ).toMatchObject( { phase: 'ready', publicationBlocked: false, dirty: true } );
		expect( witness( work ) ).toEqual( before.editor ); expect( work.host.captureDraftHistory() ).toEqual( before.envelope.history );
		expect( work.host.captureDraftEnvelope( { publicationAttempt: true } ).publicationAttempt ).toEqual( before.envelope.publicationAttempt );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
		const checkpoint = value.checkpoint.read( JSON.parse( Array.from( value.local.values.values() )[ 0 ] ).scope );
		expect( JSON.parse( checkpoint ).pdfCreation ).toEqual( before.envelope );
	} finally { work.close(); }
} );
it.each( [ false, true ] )( 'recognizes only the sent payload and preserves newer work plus history-only Redo, slot=%s', async slot => {
	const work = await uncertain( slot );
	try {
		const value = await readyController( work ), before = complete( work ), native = remote( work, 13 );
		const result = await value.controller.reconcilePublication( native.dependencies, value.checkpoint );
		expect( result ).toMatchObject( { outcome: 'payload-current', applied: true, revisionId: 13, draftPersisted: true } );
		expect( work.host.getStatus() ).toMatchObject( { phase: 'confirmed', confirmedRevisionId: 13, dirty: true, publicationBlocked: false } );
		const after = work.host.captureDraftEnvelope( { publicationAttempt: true } );
		expect( after.draft ).toEqual( before.envelope.draft ); expect( after.confirmation.snapshot ).toEqual( native.sent );
		expect( after.publicationAttempt ).toEqual( before.envelope.publicationAttempt ); expect( after.publicationAttempt.dispatchState ).toBe( 'unknown' );
		expect( after.history.members.map( row => row.timeline.history ) ).toEqual( before.envelope.history.members.map( row => row.timeline.history ) );
		const active = after.history.members.find( row => row.page === 2 ).timeline;
		expect( active.lastSaveHistoryIndex ).toBe( 1 ); expect( active.historyIndex ).toBe( 2 );
		expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Newer two' );
		expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 ); await expect( value.controller.save() ).rejects.toThrow();
	} finally { work.close(); }
} );
it( 'does not confirm a changed native page or clear its existing hold', async () => {
	const work = await uncertain();
	try {
		const value = await readyController( work ), before = complete( work ), native = remote( work );
		native.api.get.mockResolvedValue( query( work, 14, 13 ) );
		expect( await value.controller.reconcilePublication( native.dependencies, value.checkpoint ) ).toMatchObject( { outcome: 'changed', applied: false, holdCleared: false } );
		expect( complete( work ) ).toEqual( before ); await expect( value.controller.save() ).rejects.toThrow();
	} finally { work.close(); }
} );
it( 'retains the old attempt independently when a later explicit Save is refused', async () => {
	const work = await uncertain();
	try {
		const value = await readyController( work ), before = complete( work );
		await value.controller.reconcilePublication( remote( work ).dependencies, value.checkpoint );
		const saved = Array.from( value.local.values.entries() ).find( row => row[ 0 ].endsWith( '#' + 'c'.repeat( 32 ) ) );
		work.publisher.publish.mockRejectedValue( Object.assign( new Error( 'conflict' ), { code: 'layers-edit-conflict' } ) );
		await expect( value.controller.save() ).rejects.toThrow(); expect( work.publisher.publish ).toHaveBeenCalledTimes( 2 );
		expect( work.host.captureDraftEnvelope( { publicationAttempt: true } ).publicationAttempt.sequence ).toBe( 2 );
		expect( value.local.values.get( saved[ 0 ] ) ).toBe( saved[ 1 ] ); expect( JSON.parse( saved[ 1 ] ).pdfCreation ).toEqual( before.envelope );
	} finally { work.close(); }
} );
it( 'keeps cancellation held even when an unrelated controller requests reconciliation', async () => {
	const source = await uncertain(), work = setup( true, 2, 2, 3 );
	try {
		const local = storage(), earlier = controller( source, local, true, 'a'.repeat( 32 ) );
		await earlier.controller.review( { choose: async () => 0, confirm: async () => true } ); earlier.controller.persist();
		expect( await work.host.load() ).toBe( true ); const first = await readyController( work, local );
		await first.controller.review( { choose: async () => 0, confirm: async () => false } );
		const before = complete( work ), second = await readyController( work ), native = remote( work );
		await expect( second.controller.reconcilePublication( native.dependencies, second.checkpoint ) ).rejects.toThrow();
		expect( native.api.get ).not.toHaveBeenCalled(); expect( complete( work ) ).toEqual( before );
	} finally { source.close(); work.close(); }
} );
it( 'applies base evidence after explicit recovery of a held uncertain draft without making a publication', async () => {
	const source = await uncertain(), work = setup( true, 2, 2, 3 );
	try {
		const local = storage(), earlier = controller( source, local, true, 'a'.repeat( 32 ) );
		await earlier.controller.review( { choose: async () => 0, confirm: async () => true } ); earlier.controller.persist();
		expect( await work.host.load() ).toBe( true ); const value = await readyController( work, local );
		expect( work.host.getStatus() ).toMatchObject( { phase: 'ready', publicationBlocked: true } );
		expect( ( await value.controller.reconcilePublication( remote( work ).dependencies, value.checkpoint ) ).applied ).toBe( true );
		expect( work.host.getStatus().publicationBlocked ).toBe( false ); expect( work.publisher.publish ).not.toHaveBeenCalled();
	} finally { source.close(); work.close(); }
} );
it.each( [ 'live layers', 'active Undo', 'selection', 'URL', 'cancel hold', 'destroyed host', 'destroyed state', 'controller disposal', 'active backup', 'checkpoint backup', 'checkpoint writer', 'checkpoint methods' ] )(
	'refuses %s changes across native awaits without partial application', async reason => {
		const work = await uncertain();
		try {
			const value = await readyController( work ), native = remote( work, 13 ), pending = wait();
			native.api.get.mockReturnValueOnce( pending.promise ); const checking = value.controller.reconcilePublication( native.dependencies, value.checkpoint );
			await tickUntil( () => native.api.get.mock.calls.length === 1 );
			if ( reason === 'live layers' ) work.edit( 'Keep late work' );
			if ( reason === 'active Undo' ) work.editor.historyManager.history[ 0 ].description += ' newer';
			if ( reason === 'selection' ) work.editor.canvasManager.selectedLayerIds = [ 'new' ];
			if ( reason === 'URL' ) window.history.replaceState( {}, '', '?other' );
			if ( reason === 'cancel hold' ) work.host.blockPublication();
			if ( reason === 'destroyed host' ) work.host.dispose();
			if ( reason === 'destroyed state' ) work.editor.stateManager.destroy();
			if ( reason === 'controller disposal' ) value.controller.dispose();
			if ( reason === 'active backup' || reason === 'checkpoint backup' ) {
				const writer = reason === 'active backup' ? 'b' : 'c', key = Array.from( value.local.values.keys() ).find( name => name.endsWith( '#' + writer.repeat( 32 ) ) );
				value.local.values.set( key, '{"changed":true}' );
			}
			if ( reason === 'checkpoint writer' ) value.checkpoint._writerId = 'd'.repeat( 32 );
			if ( reason === 'checkpoint methods' ) value.checkpoint.read = () => null;
			const liveBefore = copy( work.editor.stateManager.state ), historyBefore = work.editor.historyManager.captureTimeline();
			pending.resolve( query( work, 13, 12 ) ); await expect( checking ).rejects.toThrow();
			expect( work.editor.stateManager.state ).toEqual( liveBefore ); expect( work.editor.historyManager.captureTimeline() ).toEqual( historyBefore );
			expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
		} finally { work.close(); }
	} );
it.each( [ 'same writer', 'different storage', 'occupied checkpoint', 'write refusal', 'readback mismatch', 'not opted in', 'missing store' ] )(
	'refuses %s before native inspection and retains work', async reason => {
		const work = await uncertain();
		try {
			const value = await readyController( work, storage(), reason !== 'not opted in' ), native = remote( work ), before = complete( work );
			let checkpoint = value.checkpoint;
			if ( reason === 'same writer' ) checkpoint = value.store;
			if ( reason === 'different storage' ) checkpoint = new DraftStore( storage(), 'c'.repeat( 32 ) );
			if ( reason === 'missing store' ) checkpoint = undefined;
			if ( reason === 'occupied checkpoint' ) { value.controller.persist(); const envelope = JSON.parse( Array.from( value.local.values.values() )[ 0 ] ); checkpoint.write( envelope.scope, '{"keep":true}' ); }
			if ( reason === 'write refusal' ) checkpoint._write = () => { throw new Error( 'quota' ); };
			if ( reason === 'readback mismatch' ) checkpoint._write = () => {};
			await expect( value.controller.reconcilePublication( native.dependencies, checkpoint ) ).rejects.toThrow();
			expect( native.api.get ).not.toHaveBeenCalled(); expect( complete( work ) ).toEqual( before );
		} finally { work.close(); }
	} );
it( 'excludes concurrent Save, recovery, persistence and page turns while a check is pending', async () => {
	const work = await uncertain();
	try {
		const value = await readyController( work ), native = remote( work ), pending = wait(); native.api.get.mockReturnValueOnce( pending.promise );
		const checking = value.controller.reconcilePublication( native.dependencies, value.checkpoint ); await tickUntil( () => native.api.get.mock.calls.length === 1 );
		await expect( value.controller.save() ).rejects.toThrow(); await expect( value.controller.review( {} ) ).rejects.toThrow();
		expect( () => value.controller.persist() ).toThrow(); expect( await work.host.turn( 1 ) ).toBe( false );
		pending.resolve( query( work ) ); await expect( checking ).resolves.toMatchObject( { applied: true } );
	} finally { work.close(); }
} );
it( 'preserves a known outcome if final active-backup persistence fails', async () => {
	const work = await uncertain();
	try {
		const local = storage(), original = local.setItem;
		local.setItem = ( key, raw ) => { if ( JSON.parse( raw ).pdfCreation.phase === 'confirmed' ) throw new Error( 'quota' ); original( key, raw ); };
		const value = await readyController( work, local ), native = remote( work, 13 );
		const result = await value.controller.reconcilePublication( native.dependencies, value.checkpoint );
		expect( result ).toMatchObject( { applied: true, outcome: 'payload-current', draftPersisted: false } );
		expect( work.host.getStatus() ).toMatchObject( { phase: 'confirmed', confirmedRevisionId: 13 } );
		expect( value.local.values.size ).toBe( 2 ); expect( Array.from( value.local.values.values() ).every( raw => JSON.parse( raw ).pdfCreation.phase === 'uncertain' ) ).toBe( true );
	} finally { work.close(); }
} );

it( 'does not clear an ambiguous persisted hold after a fresh explicit Restore', async () => {
	const source = await uncertain(), work = setup( true, 2, 2, 3 );
	try {
		source.host.blockPublication(); const envelope = source.host.captureDraftEnvelope( { publicationAttempt: true } );
		expect( await work.host.load() ).toBe( true ); const prepared = work.host.prepareDraftRecovery( envelope );
		expect( await work.host.commitDraftRecovery( prepared.handle ) ).toBe( true );
		const value = await readyController( work ), before = complete( work ), native = remote( work );
		await expect( value.controller.reconcilePublication( native.dependencies, value.checkpoint ) ).rejects.toThrow();
		expect( complete( work ) ).toEqual( before ); expect( native.api.get ).not.toHaveBeenCalled();
	} finally { source.close(); work.close(); }
} );
it( 'hands recognized sent content to the unchanged saved-session boundary and retains both-page Undo/Redo', async () => {
	const work = await uncertain(); let handoff;
	try {
		const value = await readyController( work ), native = remote( work, 13 );
		await value.controller.reconcilePublication( native.dependencies, value.checkpoint );
		const before = work.host.captureDraftHistory();
		handoff = await work.host.handoffSavedSession( { reader: native.dependencies.reader, pdfReader: native.dependencies.pdfReader, publisher: work.publisher } );
		expect( handoff.needsRefresh ).toBe( false ); expect( handoff.bridge.session.getStatus() ).toMatchObject( { phase: 'ready', revisionId: 13, dirty: true } );
		expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Sent two' );
		expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( false ); expect( work.editor.historyManager.redo() ).toBe( true );
		expect( await handoff.coordinator.turn( 1 ) ).toBe( true ); expect( work.editor.historyManager.redo() ).toBe( true );
		expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'History-only Redo' );
		expect( handoff.creationBackup.history ).toEqual( before ); expect( work.publisher.publish ).toHaveBeenCalledTimes( 1 );
	} finally { if ( handoff ) handoff.bridge.dispose(); work.close(); }
} );
it( 'retains a checked outcome on refresh failure and blocks further operations', async () => {
	const work = await uncertain();
	try {
		work.editor.historyManager.undo(); const value = await readyController( work ), native = remote( work, 13 );
		work.editor.toolbar = { updateUndoRedoState: () => { throw new Error( 'UI refresh' ); } };
		const result = await value.controller.reconcilePublication( native.dependencies, value.checkpoint );
		expect( result ).toMatchObject( { applied: true, needsRefresh: true, outcome: 'payload-current' } );
		expect( work.host.getStatus() ).toMatchObject( { phase: 'confirmed', confirmedRevisionId: 13, needsRefresh: true } );
		await expect( work.host.handoffSavedSession( native.dependencies ) ).rejects.toThrow(); await expect( value.controller.save() ).rejects.toThrow();
	} finally { work.close(); }
} );

it.each( [ 'forged', 'foreign', 'stale', 'disposed', 'reused', 'released' ] )( 'refuses a %s reconciliation handle', async reason => {
	const work = await uncertain(); let model, other;
	try {
		model = new Transaction( work.native, { reader: work.reader, publisher: work.publisher } );
		model.update( work.host.getLiveState() ); work.publisher.publish.mockRejectedValue( new Error( 'unknown' ) );
		await expect( model.save( '', async () => {} ) ).rejects.toThrow();
		const prepared = await model.preparePublicationReconciliation( remote( work ).dependencies );
		let owner = model, handle = prepared.handle;
		if ( reason === 'forged' ) handle = { outcome: 'base-current' };
		if ( reason === 'foreign' ) { other = new Transaction( work.native, { reader: work.reader, publisher: work.publisher } ); owner = other; }
		if ( reason === 'stale' ) model.update( model.getEditorState() );
		if ( reason === 'disposed' ) model.dispose();
		if ( reason === 'reused' ) expect( model.commitPublicationReconciliation( handle ).applied ).toBe( true );
		if ( reason === 'released' ) model.releasePublicationReconciliation( handle );
		expect( () => owner.commitPublicationReconciliation( handle ) ).toThrow();
	} finally { if ( model ) model.dispose(); if ( other ) other.dispose(); work.close(); }
} );
it( 'does not accept an overridden inspection method or a mutated public preview as authority', async () => {
	const work = await uncertain(); let model;
	try {
		model = new Transaction( work.native, { reader: work.reader, publisher: work.publisher } ); model.update( work.host.getLiveState() );
		work.publisher.publish.mockRejectedValue( new Error( 'unknown' ) ); await expect( model.save( '', async () => {} ) ).rejects.toThrow();
		model.inspectPublication = jest.fn( async () => ( { outcome: 'payload-current', revisionId: 999 } ) );
		const native = remote( work ), prepared = await model.preparePublicationReconciliation( native.dependencies );
		expect( native.api.get ).toHaveBeenCalledTimes( 2 ); expect( model.inspectPublication ).not.toHaveBeenCalled();
		prepared.outcome.outcome = 'payload-current'; prepared.outcome.revisionId = 999; prepared.confirmation = { revisionId: 999 };
		expect( model.commitPublicationReconciliation( prepared.handle ) ).toMatchObject( { outcome: 'base-current', revisionId: 12, applied: true } );
		expect( model.getStatus() ).toMatchObject( { phase: 'ready', confirmedRevisionId: null } );
	} finally { if ( model ) model.dispose(); work.close(); }
} );
it.each( [ 12, 13 ] )( 'repeats backup checks at the closing native query for revision %s', async revision => {
	const work = await uncertain();
	try {
		const value = await readyController( work ), native = remote( work, revision ), original = native.api.get.getMockImplementation(); let queries = 0;
		native.api.get.mockImplementation( async options => {
			if ( options.action === 'query' && ++queries === 2 ) {
				const key = Array.from( value.local.values.keys() ).find( name => name.endsWith( '#' + 'c'.repeat( 32 ) ) ); value.local.values.delete( key );
			}
			return original( options );
		} );
		const before = complete( work ); await expect( value.controller.reconcilePublication( native.dependencies, value.checkpoint ) ).rejects.toThrow();
		expect( complete( work ) ).toEqual( before ); expect( queries ).toBe( 2 );
	} finally { work.close(); }
} );
