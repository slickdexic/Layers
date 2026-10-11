'use strict';

const { context, clone, State, Coordinator } = require( './fixtures/workingCopyImportContext.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );

const records = new Map();
const storage = { getItem: key => records.get( key ) || null,
	setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
	key: index => Array.from( records.keys() )[ index ], get length() { return records.size; } };

function controller( ctx, writer, enable = true ) {
	const result = new Controller( ctx.bridge, new Store( storage, writer ), ctx.adapter,
		{ wiki: 'test-wiki', user: '1' } );
	if ( enable && typeof result.enableWorkingCopyDrafts === 'function' ) { result.enableWorkingCopyDrafts(); }
	return result;
}

async function imported( kind = 'slide', mode = 'replace' ) {
	const ctx = await context( kind, true ), coordinator = new Coordinator( ctx.dependencies );
	const handle = await coordinator.prepare( ctx.choice, ctx.options( mode ) );
	await coordinator.apply( handle ); coordinator.release( handle ); coordinator.dispose();
	return ctx;
}

beforeEach( () => { records.clear(); mw.msg = key => key; } );

describe( 'complete working-copy draft recovery', () => {
	test.each( [ 'slide', 'image' ] )( '%s Import recovery retains reading order and actual one-step Undo/Redo', async kind => {
		const source = await imported( kind ), writer = controller( source, 'a'.repeat( 32 ) );
		writer.persist(); const before = clone( source.session.getDraft().snapshot );
		const destination = await context( kind, true ), reader = controller( destination, 'b'.repeat( 32 ) );
		reader.selectRecovery( 'a'.repeat( 32 ) ); const candidate = reader.inspectRecovery();
		await destination.bridge.restoreDraft( candidate );
		expect( destination.session.getDraft().snapshot ).toStrictEqual( before );
		expect( destination.history.history ).toHaveLength( 2 );
		expect( destination.history.undo() ).toBe( true );
		expect( destination.session.getDraft().snapshot ).toStrictEqual( destination.base );
		expect( destination.history.redo() ).toBe( true );
		expect( destination.session.getDraft().snapshot ).toStrictEqual( before );
		expect( destination.publisher.publish ).not.toHaveBeenCalled();
	} );
} );

module.exports = { imported, controller, Lifecycle, State };

function witness( ctx ) {
	return [ State.observeWorkingCopyObject( ctx.session, false ), State.observeWorkingCopyObject( ctx.session._snapshot ),
		State.observeWorkingCopyObject( ctx.store, false ), State.observeWorkingCopyObject( ctx.store.state ),
		State.observeWorkingCopyObject( ctx.history, false ), State.observeWorkingCopyObject( ctx.history.history ),
		State.observeWorkingCopyObject( ctx.selection, false ), State.observeWorkingCopyObject( ctx.selection._selectionState ),
		State.observeWorkingCopyObject( ctx.selection.selectedLayerIds ), State.observeWorkingCopyObject( ctx.editor.canvasManager, false ) ];
}

function preserved( observations ) { observations.forEach( State.checkWorkingCopyObservation ); }

function ui( confirm = async () => true ) {
	return { confirmRecovery: jest.fn( confirm ), chooseDraft: jest.fn( async () => 0 ),
		notifyBlocked: jest.fn(), notifyFailure: jest.fn() };
}

async function pair( kind = 'slide', mode = 'replace' ) {
	const source = await imported( kind, mode ), writer = controller( source, 'a'.repeat( 32 ) ); writer.persist();
	const original = Array.from( records.entries() ), destination = await context( kind, true );
	const reader = controller( destination, 'b'.repeat( 32 ) ); reader.selectRecovery( 'a'.repeat( 32 ) );
	return { source, writer, original, destination, reader, candidate: reader.inspectRecovery() };
}

describe( 'native-identity draft admission and full transactions', () => {
	test.each( [ 'slide', 'image' ] )( '%s Append preserves groups, nulls, pin, offscreen members and one history step', async kind => {
		const p = await pair( kind, 'append' ), before = clone( p.source.session.getDraft().snapshot );
		await p.destination.bridge.restoreDraft( p.candidate );
		expect( p.destination.session.getDraft().snapshot ).toStrictEqual( before );
		expect( p.destination.history.history[ 1 ].workingState.layers.find( layer => layer.type === 'textbox' ).extra ).toBeNull();
		expect( p.destination.history.undo() ).toBe( true ); expect( p.destination.session.getDraft().snapshot ).toStrictEqual( p.destination.base );
		expect( p.destination.history.redo() ).toBe( true ); expect( p.destination.session.getDraft().snapshot ).toStrictEqual( before );
		expect( Array.from( records.entries() ) ).toStrictEqual( p.original );
	} );

	test( 'pending edits become one recovered history step without changing source draft bytes', async () => {
		const p = await pair(); p.source.store.state.layers[ 1 ].text = 'unrecorded'; p.writer.persist();
		const raw = Array.from( records.entries() );
		await p.destination.bridge.restoreDraft( p.reader.inspectRecovery() );
		expect( p.destination.history.history ).toHaveLength( 3 );
		expect( p.destination.store.state.layers[ 1 ].text ).toBe( 'unrecorded' );
		expect( p.destination.history.undo() ).toBe( true ); expect( p.destination.store.state.layers[ 1 ].text ).toBe( 'first' );
		expect( p.destination.history.redo() ).toBe( true ); expect( p.destination.store.state.layers[ 1 ].text ).toBe( 'unrecorded' );
		expect( Array.from( records.entries() ) ).toStrictEqual( raw );
	} );

	test( 'removed layers prune reading order while retaining complete unrelated snapshot data', async () => {
		const p = await pair(); const old = p.source.store.state.layers;
		p.source.store.state.layers = old.filter( layer => layer.type !== 'image' ); p.writer.persist();
		await p.destination.bridge.restoreDraft( p.reader.inspectRecovery() );
		expect( p.destination.session.getDraft().snapshot.surfaces[ 0 ].readingOrder ).toStrictEqual( [ 'fresh-2' ] );
		expect( p.destination.session.getDraft().snapshot.surfaces[ 1 ] ).toStrictEqual( p.destination.base.surfaces[ 1 ] );
		expect( p.destination.session.getDraft().snapshot.metadata ).toStrictEqual( p.destination.base.metadata );
		p.destination.bridge.capture(); expect( p.destination.store.state.layers[ 1 ].extra ).toBeNull();
	} );

	test( 'an unsaved rename is restored independently of the layer history', async () => {
		const p = await pair(); p.source.bridge.rename( 'New name' ); p.writer.persist();
		await p.destination.bridge.restoreDraft( p.reader.inspectRecovery() );
		expect( p.destination.session.getLabel() ).toBe( 'New name' );
		expect( p.destination.history.undo() ).toBe( true ); expect( p.destination.session.getLabel() ).toBe( 'New name' );
	} );

	test.each( [ 'saving', 'conflict', 'uncertain' ] )( '%s draft is recoverable but cannot publish', async phase => {
		const p = await pair(); p.source.session._phase = phase; p.writer.persist();
		await p.destination.bridge.restoreDraft( p.reader.inspectRecovery() );
		expect( p.destination.session.getStatus().phase ).toBe( 'conflict' );
		expect( p.destination.store.state.layers ).toStrictEqual( p.source.store.state.layers );
		expect( p.destination.history.history ).toHaveLength( 2 );
		controller( p.destination, 'c'.repeat( 32 ) ).persist();
		await expect( p.destination.bridge.save() ).rejects.toThrow();
		expect( p.destination.publisher.publish ).not.toHaveBeenCalled();
	} );

	test( 'save-phase backup preserves null fields and captures newer edits after a refusal', async () => {
		const source = await imported(), writer = controller( source, 'a'.repeat( 32 ) );
		const lifecycle = new Lifecycle( source.bridge, writer, ui() ); await lifecycle.initialize();
		source.publisher.publish.mockImplementation( async request => {
			expect( JSON.parse( request.snapshotJson ).surfaces[ 0 ].layers[ 1 ].extra ).toBeNull();
			expect( JSON.parse( Array.from( records.values() )[ 0 ] ).phase ).toBe( 'saving' );
			source.store.state.layers[ 1 ].text = 'newer during Save';
			const error = new Error( 'refused' ); error.code = 'layers-edit-conflict'; throw error;
		} );
		await expect( lifecycle.save( 'explicit summary' ) ).rejects.toThrow( 'refused' );
		expect( source.history.lastSaveHistoryIndex ).toBe( 0 );
		const destination = await context( 'slide', true ), reader = controller( destination, 'b'.repeat( 32 ) );
		reader.selectRecovery( 'a'.repeat( 32 ) ); await destination.bridge.restoreDraft( reader.inspectRecovery() );
		expect( destination.store.state.layers[ 1 ].text ).toBe( 'newer during Save' );
		expect( destination.store.state.layers[ 1 ].extra ).toBeNull();
		lifecycle.dispose();
	} );

	test( 'confirmed Save recovery uses its native base without marking newer work saved', async () => {
		const source = await imported(), writer = controller( source, 'a'.repeat( 32 ) );
		const lifecycle = new Lifecycle( source.bridge, writer, ui() ); await lifecycle.initialize();
		let saved;
		source.publisher.publish.mockImplementation( async request => {
			saved = JSON.parse( request.snapshotJson ); source.store.state.layers[ 1 ].text = 'later'; return { revisionId: 13 };
		} );
		const result = await lifecycle.save(); expect( result.dirty ).toBe( true ); expect( result.draftPersisted ).toBe( true );
		const destination = await context( 'slide', true, saved, 13 ), reader = controller( destination, 'b'.repeat( 32 ) );
		reader.selectRecovery( 'a'.repeat( 32 ) ); await destination.bridge.restoreDraft( reader.inspectRecovery() );
		expect( destination.history.lastSaveHistoryIndex ).toBe( 1 ); expect( destination.history.historyIndex ).toBe( 2 );
		expect( destination.history.undo() ).toBe( true ); expect( destination.session.getStatus().dirty ).toBe( false );
		expect( destination.history.redo() ).toBe( true ); expect( destination.session.getStatus().dirty ).toBe( true ); lifecycle.dispose();
	} );

	test.each( [ 'owner', 'pageId', 'revisionId', 'surfaceId' ] )( 'refuses a forged %s without live writes', async key => {
		const p = await pair(), before = witness( p.destination );
		p.candidate.workingCopyDraft.identity[ key ] = key.endsWith( 'Id' ) && key !== 'surfaceId' ? 999 : 'other';
		await expect( Promise.resolve().then( () => p.destination.bridge.restoreDraft( p.candidate ) ) ).rejects.toThrow();
		preserved( before );
	} );

	test.each( [
		[ 'foreign member', c => { c.workingCopyDraft.workingState.surfaceId = 'other'; } ],
		[ 'source pin', c => { c.workingCopyDraft.timeline.history[ 1 ].workingState.source = { sha1: 'foreign' }; } ],
		[ 'false saved marker', c => { c.workingCopyDraft.timeline.lastSaveHistoryIndex = 1; } ],
		[ 'duplicate layer IDs', c => { c.workingCopyDraft.timeline.history[ 1 ].workingState.layers[ 1 ].id = 'fresh-1'; } ],
		[ 'unknown reading ID', c => { c.workingCopyDraft.timeline.history[ 1 ].workingState.readingOrder = [ 'missing' ]; } ],
		[ 'wrong editor state', c => { c.editorState.layers[ 1 ].text = 'forged'; } ],
		[ 'PDF envelope', c => { c.pdfDraft = {}; } ],
		[ 'missing timeline', c => { delete c.workingCopyDraft.timeline; } ]
	] )( 'refuses %s without altering participants or source draft', async ( label, mutate ) => {
		const p = await pair(), before = witness( p.destination ); mutate( p.candidate );
		await expect( Promise.resolve().then( () => p.destination.bridge.restoreDraft( p.candidate ) ) ).rejects.toThrow();
		preserved( before ); expect( Array.from( records.entries() ) ).toStrictEqual( p.original );
	} );

	test.each( [
		[ 'StateManager edit', c => { c.store.state.layers[ 0 ].text = 'newer'; } ],
		[ 'offscreen edit', c => { c.session._snapshot.surfaces[ 1 ].layers[ 0 ].text = 'newer'; } ],
		[ 'history edit', c => { c.history.history[ 0 ].timestamp++; } ],
		[ 'selection edit', c => { c.selection.selectedLayerIds.push( 'old' ); } ],
		[ 'bridge disposal', c => { c.bridge.dispose(); } ],
		[ 'StateManager destruction', c => { c.store.destroy(); } ],
		[ 'permission refusal', c => { c.reader.read.mockRejectedValueOnce( new Error( 'denied' ) ); } ],
		[ 'method replacement', c => { c.session.inspectWorkingCopyDraftRestore = () => ( {} ); } ],
		[ 'frozen history', c => { Object.defineProperty( c.history, 'historyIndex', { writable: false } ); } ]
	] )( 'refuses late %s after preparation and preserves it', async ( label, mutate ) => {
		const p = await pair(), handle = p.destination.bridge.prepareWorkingCopyDraftRecovery( p.candidate );
		mutate( p.destination ); const before = p.destination.bridge.disposed || !p.destination.store.isWorkingCopyAlive() ? null : witness( p.destination );
		await expect( p.destination.bridge.commitWorkingCopyDraftRecovery( handle ) ).rejects.toThrow();
		if ( before ) { preserved( before ); }
		expect( Array.from( records.entries() ) ).toStrictEqual( p.original ); expect( p.destination.publisher.publish ).not.toHaveBeenCalled();
	} );

	test( 'native revalidation await cannot overwrite a late edit', async () => {
		const p = await pair(); let changed;
		p.destination.hooks.target = async () => { p.destination.store.state.layers[ 0 ].text = 'while reading'; changed = witness( p.destination ); };
		await expect( Promise.resolve().then( () => p.destination.bridge.restoreDraft( p.candidate ) ) ).rejects.toThrow();
		preserved( changed );
	} );

	test( 'confirmation await cannot overwrite a late edit', async () => {
		const p = await pair(); let changed;
		const lifecycle = new Lifecycle( p.destination.bridge, p.reader, ui( async () => {
			p.destination.store.state.layers[ 0 ].text = 'while deciding'; changed = witness( p.destination ); return true;
		} ) );
		await expect( lifecycle.initialize() ).rejects.toThrow(); preserved( changed );
		expect( Array.from( records.entries() ) ).toStrictEqual( p.original );
	} );

	test( 'Cancel preserves the original draft and offers no publication', async () => {
		const p = await pair(), before = clone( p.destination.session.getDraft().snapshot );
		const lifecycle = new Lifecycle( p.destination.bridge, p.reader, ui( async () => false ) ); await lifecycle.initialize();
		expect( p.destination.session.getDraft().snapshot ).toStrictEqual( before ); expect( lifecycle.ready ).toBe( false );
		expect( p.destination.session.getStatus().phase ).toBe( 'uncertain' ); expect( Array.from( records.entries() ) ).toStrictEqual( p.original );
	} );

	test( 'a draft at the clean canvas still recovers its Redo branch', async () => {
		const p = await pair(); p.source.history.undo(); p.writer.persist();
		const callbacks = ui(), lifecycle = new Lifecycle( p.destination.bridge, p.reader, callbacks ); await lifecycle.initialize();
		expect( callbacks.confirmRecovery ).toHaveBeenCalledTimes( 1 ); expect( p.destination.history.redo() ).toBe( true );
		expect( p.destination.store.state.layers[ 1 ].text ).toBe( 'first' ); lifecycle.dispose();
	} );

	test( 'independent clean sessions do not repeatedly prompt for timestamp differences', async () => {
		const source = await context( 'slide', true ), writer = controller( source, 'a'.repeat( 32 ) ); writer.persist();
		const destination = await context( 'slide', true ), reader = controller( destination, 'b'.repeat( 32 ) );
		reader.selectRecovery( 'a'.repeat( 32 ) ); destination.history.history[ 0 ].timestamp += 100;
		const callbacks = ui(), lifecycle = new Lifecycle( destination.bridge, reader, callbacks ); await lifecycle.initialize();
		expect( callbacks.confirmRecovery ).not.toHaveBeenCalled(); expect( lifecycle.ready ).toBe( true ); lifecycle.dispose();
	} );

	test( 'foreign, released and replayed handles are refused', async () => {
		const p = await pair(), other = await context( 'slide', true ), handle = p.destination.bridge.prepareWorkingCopyDraftRecovery( p.candidate );
		await expect( other.bridge.commitWorkingCopyDraftRecovery( handle ) ).rejects.toThrow();
		p.destination.bridge.releaseWorkingCopyDraftRecovery( handle ); await expect( p.destination.bridge.commitWorkingCopyDraftRecovery( handle ) ).rejects.toThrow();
		const fresh = p.destination.bridge.prepareWorkingCopyDraftRecovery( p.candidate ); await p.destination.bridge.commitWorkingCopyDraftRecovery( fresh );
		const after = witness( p.destination ); await expect( p.destination.bridge.commitWorkingCopyDraftRecovery( fresh ) ).rejects.toThrow();
		preserved( after );
	} );

	test( 'notification failures report committed recovery and preserve newer listener edits', async () => {
		const p = await pair(); p.destination.store.subscribe( 'layers', () => {
			p.destination.store.state.layers[ 1 ].text = 'newer listener'; throw new Error( 'notification' );
		} );
		p.destination.editor.canvasManager.renderLayers.mockImplementation( () => { throw new Error( 'render failure' ); } );
		const result = await p.destination.bridge.restoreDraft( p.candidate );
		expect( result.diagnostics.length ).toBeGreaterThan( 0 ); expect( p.destination.history.history ).toHaveLength( 2 );
		expect( p.destination.store.state.layers[ 1 ].text ).toBe( 'newer listener' );
	} );

	test( 'default controller writes the original envelope and declines the new draft format', async () => {
		const source = await context( 'slide', true ), writer = controller( source, 'a'.repeat( 32 ), false ); writer.persist();
		const envelope = JSON.parse( Array.from( records.values() )[ 0 ] );
		expect( Object.keys( envelope ).sort() ).toStrictEqual( [ 'editorState', 'label', 'phase', 'scope', 'version' ] );
		writer.enableWorkingCopyDrafts(); writer.persist();
		const destination = await context( 'slide', true ), reader = controller( destination, 'b'.repeat( 32 ), false ); reader.selectRecovery( 'a'.repeat( 32 ) );
		expect( () => reader.inspectRecovery() ).toThrow();
	} );
} );
