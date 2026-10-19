'use strict';
const { setup: originalSetup, applyImport, copy, editPage, nativeCalls, importPayload, importOptions } = require( './PageOwnedWholePdfImportPublication.test.js' );
const { mapStorage, controllerFor, writerA, writerB } = require( './PageOwnedWholePdfImportDraftStorage.test.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const contexts = [];
async function setup( options = {} ) {
	const value = await originalSetup( options ); contexts.push( value );
	const original = value.api.get.getMockImplementation();
	value.api.get.mockImplementation( params => params.action === 'layersread' && params.revid === 12 && value.getRevision() !== 12 ?
		Promise.resolve( { layersread: params.editorpage ? { editor: value.work.context( params.editorpage, 12, value.work.base ) } :
			{ revisionId: 12, snapshot: copy( value.work.base ), sourceGeometry: [] } } ) : original( params ) );
	if ( typeof value.application.enableReconciliation === 'function' ) { value.application.enableReconciliation(); }
	return value;
}
function complete( value ) {
	const { work, application } = value;
	return JSON.stringify( { snapshot: work.session._snapshot, base: work.session._savedJson, revision: work.session._revisionId,
		phase: work.session._phase, pdf: work.session.getPdfStatus(), maps: [ Array.from( work.session._pdf.temporary ), Array.from( work.session._pdf.admissions ) ],
		live: work.bridge.getLiveState(), history: work.editor.historyManager.captureTimeline(),
		timelines: Array.from( work.bridge.pdfCoordinator.timelines ), selection: work.editor.canvasManager.selectionManager.selectedLayerIds,
		draft: application.captureDraftForStorage() } );
}
async function unrelatedRevision( value, at = 13 ) {
	const server = value.getServer(); server.surfaces.find( member => member.id === 'other-file' ).layers[ 0 ].text = 'Independent server edit';
	value.setServer( server ); value.setRevision( at ); return server;
}
describe( 'Whole-PDF Import reconciliation through the actual Bridge', () => {
	afterEach( () => { for ( const value of contexts.splice( 0 ).reverse() ) { value.work.close(); } } );
	it( 'keeps complete-group Undo and drafts usable after a disjoint revision check', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		const imported = copy( value.work.session._snapshot ); await unrelatedRevision( value );
		expect( ( await value.work.bridge.reconcile( 13 ) ).revisionId ).toBe( 13 );
		expect( value.work.session._snapshot.surfaces.find( member => member.id === 'other-file' ).layers[ 0 ].text ).toBe( 'Independent server edit' );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( value.application.captureDraftForStorage().history.groups ).toHaveLength( 1 );
		expect( value.work.session._snapshot.surfaces.filter( member => member.id !== 'other-file' ) ).toEqual( imported.surfaces.filter( member => member.id !== 'other-file' ) );
		expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'keeps source citations until an actual successful Save at the reconciled base', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		const sources = value.work.binding.getImportPublication().sources; await unrelatedRevision( value );
		await value.work.bridge.reconcile( 13 );
		expect( value.work.binding.getImportPublication().sources ).toEqual( sources );
		expect( value.work.binding.getImportPublication().baseRevisionId ).toBe( 13 );
		expect( ( await value.work.bridge.save() ).revisionId ).toBe( 14 );
		expect( nativeCalls( value.api )[ 0 ][ 1 ].baserevid ).toBe( 13 );
		expect( value.work.binding.getImportPublication().sources ).toEqual( [] );
	} );
	it.each( [ 'ready', 'conflict', 'uncertain' ] )( 'safely reconciles from %s without publishing or losing dirty work', async phase => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		await editPage( value.work, 1, 'Newer ordinary edit' ); const before = copy( value.work.session._snapshot );
		await unrelatedRevision( value ); value.work.session._phase = phase;
		const result = await value.work.bridge.reconcile( 13 ); expect( result ).toMatchObject( { phase: 'ready', dirty: true, revisionId: 13 } );
		expect( value.work.session.getPdfStatus().page ).toBe( 1 );
		expect( value.work.session._snapshot.surfaces.filter( member => member.id !== 'other-file' ) ).toEqual( before.surfaces.filter( member => member.id !== 'other-file' ) );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( value.work.editor.historyManager.redo() ).toBe( true ); expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'clears an uncertain hold only after exact represented content is read, retaining claims and usable sparse-page Undo', async () => {
		const value = await setup(); await applyImport( value.work, value.application, value.request );
		const imported = copy( value.work.session._snapshot ), sources = value.work.binding.getImportPublication().sources;
		value.setServer( imported ); value.setRevision( 13 ); value.work.session._phase = 'uncertain';
		expect( await value.work.bridge.reconcile( 13 ) ).toMatchObject( { phase: 'ready', dirty: false } );
		expect( value.work.binding.getImportPublication().sources ).toEqual( sources );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		const blank = value.work.session._snapshot.surfaces.find( member => member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 );
		expect( blank.layers ).toEqual( [] ); expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( value.work.session.getStatus().dirty ).toBe( false ); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'retains a before-phase Import and its Redo after reconciliation', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		value.work.editor.historyManager.undo(); await unrelatedRevision( value ); await value.work.bridge.reconcile( 13 );
		expect( value.application.captureDraftForStorage().history.groups[ 0 ].phase ).toBe( 'before' );
		expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( value.work.binding.getImportPublication().sources ).toHaveLength( 1 );
	} );
	it( 'carries a new server-owned group page through both Undo checkpoint sides', async () => {
		const value = await setup();
		value.sourceApi.post.mockImplementation( () => Promise.resolve( { layersworkingcopypdfimportread: {
			version: 1, data: JSON.stringify( importPayload( value.work, [ 2 ] ) ) } } ) );
		await applyImport( value.work, value.application, value.request );
		const server = value.getServer(), remote = { ...copy( value.work.context( 1 ).surface ), id: 'server-owned-first',
			layers: [ { id: 'server-layer', type: 'text', text: 'Independent server PDF page' } ] };
		server.surfaces.push( remote ); value.setServer( server ); value.setRevision( 13 ); await value.work.bridge.reconcile( 13 );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( value.work.session._snapshot.surfaces.find( member => member.id === remote.id ) ).toEqual( remote );
		expect( value.work.editor.historyManager.redo() ).toBe( true );
		expect( value.work.session._snapshot.surfaces.find( member => member.id === remote.id ) ).toEqual( remote );
		expect( await value.work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true ); expect( value.work.editor.stateManager.get( 'layers' ) ).toEqual( remote.layers );
	} );
	it( 'rebases remote-only layers on an untouched page in every timeline and group marker', async () => {
		const value = await setup( { sparse: false } );
		value.sourceApi.post.mockImplementation( () => Promise.resolve( { layersworkingcopypdfimportread: {
			version: 1, data: JSON.stringify( importPayload( value.work, [ 2 ] ) ) } } ) );
		await applyImport( value.work, value.application, value.request ); const server = value.getServer();
		const remote = server.surfaces.find( member => member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 );
		remote.layers[ 0 ].text = 'Remote untouched first page'; value.setServer( server ); value.setRevision( 13 );
		await value.work.bridge.reconcile( 13 );
		for ( const page of [ 1, 2 ] ) { expect( await value.work.bridge.pdfCoordinator.turn( page ) ).toBe( true ); }
		for ( const action of [ 'undo', 'redo' ] ) {
			expect( value.work.editor.historyManager[ action ]() ).toBe( true );
			expect( value.work.session._snapshot.surfaces.find( member => member.id === remote.id ).layers ).toEqual( remote.layers );
		}
	} );
	it( 'refuses a timeline that cannot be rebased before changing any session or private checkpoint', async () => {
		const value = await setup( { sparse: false } ); const original = copy( value.work.base.surfaces.find( member => member.source.page === 1 ) );
		await editPage( value.work, 1, 'Earlier unsaved state' ); value.work.editor.stateManager.set( 'layers', original.layers );
		value.work.editor.historyManager.saveState( 'Return to original content' ); value.work.bridge.capture();
		expect( await value.work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
		value.sourceApi.post.mockImplementation( () => Promise.resolve( { layersworkingcopypdfimportread: {
			version: 1, data: JSON.stringify( importPayload( value.work, [ 2 ] ) ) } } ) );
		await applyImport( value.work, value.application, value.request ); const server = value.getServer();
		server.surfaces.find( member => member.id === original.id ).layers[ 0 ].text = 'Remote first-page work';
		value.setServer( server ); value.setRevision( 13 ); const before = complete( value );
		await expect( value.work.bridge.reconcile( 13 ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
		expect( complete( value ) ).toBe( before );
	} );
	it.each( [ 'ready', 'conflict', 'uncertain' ] )( 'preserves the complete %s state on an overlapping server edit', async phase => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		const server = value.getServer(); server.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text = 'Conflicting server layers';
		value.setServer( server ); value.setRevision( 13 ); value.work.session._phase = phase; const before = complete( value );
		await expect( value.work.bridge.reconcile( 13 ) ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( before );
	} );
	it.each( [ 'revision mismatch', 'source pin', 'missing anchor', 'denied read' ] )( 'refuses %s before changing complete work', async reason => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); await unrelatedRevision( value );
		const server = value.getServer();
		if ( reason === 'revision mismatch' ) { value.api.get.mockResolvedValueOnce( { layersread: { revisionId: 14, snapshot: server, sourceGeometry: [] } } ); }
		if ( reason === 'source pin' ) { server.surfaces.find( member => member.id === 'anchor' ).source.sha1 = 'b'.repeat( 31 ); value.setServer( server ); }
		if ( reason === 'missing anchor' ) { server.surfaces = server.surfaces.filter( member => member.id !== 'anchor' ); value.setServer( server ); }
		if ( reason === 'denied read' ) { value.api.get.mockRejectedValueOnce( { error: { code: 'permissiondenied' } } ); }
		const before = complete( value ); await expect( value.work.bridge.reconcile( 13 ) ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( before );
	} );
	it.each( [ 0, 11, 2147483648, '13' ] )( 'refuses invalid revision %s without changing work', async revision => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); const before = complete( value );
		await expect( value.work.bridge.reconcile( revision ) ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( before );
	} );
	it( 'preserves edits made during the exact read and leaves the saved base unchanged', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); const server = await unrelatedRevision( value );
		let finish; value.api.get.mockImplementationOnce( () => new Promise( done => { finish = done; } ) );
		const pending = value.work.bridge.reconcile( 13 ); pending.catch( () => {} );
		await editPage( value.work, 2, 'New work during revision read' ); const latest = complete( value );
		finish( { layersread: { revisionId: 13, snapshot: server, sourceGeometry: [] } } );
		await expect( pending ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( latest ); expect( value.work.session._revisionId ).toBe( 12 );
	} );
	it( 'preserves a page turn completed during the revision read', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); const server = await unrelatedRevision( value );
		let finish; value.api.get.mockImplementationOnce( () => new Promise( done => { finish = done; } ) );
		const pending = value.work.bridge.reconcile( 13 ); pending.catch( () => {} );
		expect( await value.work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true ); const latest = complete( value );
		finish( { layersread: { revisionId: 13, snapshot: server, sourceGeometry: [] } } ); await expect( pending ).rejects.toBeInstanceOf( Error );
		expect( complete( value ) ).toBe( latest ); expect( value.work.session.getPdfStatus().page ).toBe( 1 );
	} );
	it( 'checks for newer edits again after the final native editor read', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); await unrelatedRevision( value );
		const original = value.api.get.getMockImplementation(); let finish;
		value.api.get.mockImplementation( params => params.editorpage && params.revid === 13 ? new Promise( done => { finish = () => original( params ).then( done ); } ) : original( params ) );
		const pending = value.work.bridge.reconcile( 13 ); pending.catch( () => {} );
		for ( let tick = 0; tick < 80 && !finish; tick++ ) { await Promise.resolve(); }
		expect( finish ).toEqual( expect.any( Function ) ); await editPage( value.work, 2, 'Late native-read work' ); const latest = complete( value );
		finish(); await expect( pending ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( latest );
	} );
	it( 'repeats the complete witness check after the final synchronous commit callback', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); await unrelatedRevision( value );
		const record = value.application.captureDraftForStorage(), tokens = [];
		// Use the binding's actual opaque checkpoints returned by a separate prepared Import.
		const isolated = await setup( { sparse: false } ); await unrelatedRevision( isolated );
		const prepared = await isolated.work.binding.prepareImportReconciliation( tokens, 13, () => {} );
		try {
			expect( record.history.groups ).toHaveLength( 1 ); let latest;
			expect( () => isolated.work.binding.commitImportReconciliation( prepared, () => {
				isolated.work.edit( 'Edit at final preflight' ); isolated.work.bridge.capture(); latest = complete( isolated );
			} ) ).toThrow();
			expect( complete( isolated ) ).toBe( latest ); expect( isolated.work.session._revisionId ).toBe( 12 );
		} finally { isolated.work.binding.releaseImportReconciliation( prepared ); }
	} );
	it( 'flushes the complete backup before discovery and retains usable final drafts through the actual lifecycle', async () => {
		const value = await setup(); await applyImport( value.work, value.application, value.request );
		const storage = mapStorage(), { controller } = controllerFor( value.work, value.application, storage, writerA );
		const lifecycle = new Lifecycle( value.work.bridge, controller, { notifyFailure: jest.fn(), notifyBlocked: jest.fn() } );
		try {
			await lifecycle.initialize(); await unrelatedRevision( value );
			const result = await lifecycle.reconcile( async () => {
				expect( Array.from( storage.rows.values() ).some( raw => JSON.parse( raw ).wholePdfImportDraft.session.sources.length === 1 ) ).toBe( true ); return 13;
			} );
			expect( result.draftPersisted ).toBe( true ); expect( controller.inspectRecovery().wholePdfImportDraft.session.scope.baseRevisionId ).toBe( 13 );
			expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( lifecycle.flush() ).toBe( true );
		} finally { lifecycle.dispose(); }
	} );
	it( 'leaves the ordinary non-opted PDF path available without installing a reconciliation route', async () => {
		const value = await originalSetup( { optIn: false, sparse: false } ); contexts.push( value );
		await unrelatedRevision( value ); expect( await value.work.bridge.reconcile( 13 ) ).toMatchObject( { revisionId: 13, phase: 'ready' } );
		expect( value.work.editor.historyManager.hasPdfImportHistory() ).toBe( false );
	} );
	it( 'keeps both reachable Import commands and provenance transitions usable', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		await applyImport( value.work, value.application, importOptions( value.work ) ); await unrelatedRevision( value );
		await value.work.bridge.reconcile( 13 ); expect( value.application.captureDraftForStorage().history.groups ).toHaveLength( 2 );
		for ( let step = 0; step < 2; step++ ) { expect( value.work.editor.historyManager.undo() ).toBe( true ); }
		expect( value.work.binding.getImportPublication().sources ).toEqual( [] );
		for ( let step = 0; step < 2; step++ ) { expect( value.work.editor.historyManager.redo() ).toBe( true ); }
		expect( value.work.binding.getImportPublication().sources ).toHaveLength( 1 );
	} );
	it( 'preserves acknowledged source state and saved markers after Save followed by another revision', async () => {
		const value = await setup(); await applyImport( value.work, value.application, value.request ); await value.work.bridge.save();
		await unrelatedRevision( value, 14 ); expect( await value.work.bridge.reconcile( 14 ) ).toMatchObject( { dirty: false, revisionId: 14 } );
		expect( value.work.binding.getImportPublication().sources ).toEqual( [] );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( value.work.session.getStatus().dirty ).toBe( true );
		expect( value.work.editor.historyManager.redo() ).toBe( true ); expect( value.work.session.getStatus().dirty ).toBe( false );
	} );
	it( 'rechecks the same revision without losing sparse admissions or group history', async () => {
		const value = await setup(); await applyImport( value.work, value.application, value.request );
		expect( await value.work.bridge.reconcile( 12 ) ).toMatchObject( { revisionId: 12, dirty: true } );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( value.work.editor.historyManager.redo() ).toBe( true );
	} );
	it( 'preserves a local complete-group rename during disjoint reconciliation', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		value.work.bridge.rename( 'Pending whole-group name' ); await unrelatedRevision( value );
		await value.work.bridge.reconcile( 13 );
		expect( value.work.session.getLabel() ).toBe( 'Pending whole-group name' );
		expect( value.work.editor.historyManager.undo() ).toBe( true );
		expect( value.work.session.getLabel() ).toBe( 'Pending whole-group name' );
	} );
	it( 'releases pending work on application disposal without applying a late read', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); const server = await unrelatedRevision( value );
		let finish; value.api.get.mockImplementationOnce( () => new Promise( done => { finish = done; } ) );
		const pending = value.work.bridge.reconcile( 13 ); pending.catch( () => {} );
		const before = copy( value.work.session._snapshot ), history = value.work.editor.historyManager.captureTimeline();
		value.application.dispose(); finish( { layersread: { revisionId: 13, snapshot: server, sourceGeometry: [] } } );
		await expect( pending ).rejects.toBeInstanceOf( Error ); expect( value.work.session._snapshot ).toEqual( before );
		expect( value.work.editor.historyManager.captureTimeline() ).toEqual( history ); expect( value.work.session._revisionId ).toBe( 12 );
	} );
	it( 'refuses a late read after Bridge disposal without changing the retained editor work', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); const server = await unrelatedRevision( value );
		let finish; value.api.get.mockImplementationOnce( () => new Promise( done => { finish = done; } ) );
		const pending = value.work.bridge.reconcile( 13 ); pending.catch( () => {} );
		const layers = copy( value.work.editor.stateManager.get( 'layers' ) );
		value.work.bridge.dispose(); const disposedSnapshot = value.work.session._snapshot;
		finish( { layersread: { revisionId: 13, snapshot: server, sourceGeometry: [] } } );
		await expect( pending ).rejects.toBeInstanceOf( Error ); expect( value.work.session._snapshot ).toBe( disposedSnapshot );
		expect( value.work.editor.stateManager.get( 'layers' ) ).toEqual( layers ); expect( value.work.session._phase ).toBe( 'disposed' );
	} );
	it( 'refuses another owner returned by the final native editor read', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); await unrelatedRevision( value );
		const original = value.api.get.getMockImplementation();
		value.api.get.mockImplementation( async params => {
			const response = await original( params ); if ( params.editorpage && params.revid === 13 ) { response.layersread.editor.owner = 'Another owner'; } return response;
		} );
		const before = complete( value ); await expect( value.work.bridge.reconcile( 13 ) ).rejects.toBeInstanceOf( Error );
		expect( complete( value ) ).toBe( before );
	} );
	it( 'refuses revision discovery when the complete pre-check backup cannot be persisted', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		const storage = mapStorage(), { controller } = controllerFor( value.work, value.application, storage, writerA );
		const lifecycle = new Lifecycle( value.work.bridge, controller, { notifyFailure: jest.fn(), notifyBlocked: jest.fn() } );
		try {
			await lifecycle.initialize(); const backups = Array.from( storage.rows ), before = complete( value ), discover = jest.fn();
			storage.setItem.mockImplementation( () => { throw new Error( 'Storage refused' ); } );
			await expect( lifecycle.reconcile( discover ) ).rejects.toThrow( 'layers-draft-storage-failed' );
			expect( discover ).not.toHaveBeenCalled(); expect( Array.from( storage.rows ) ).toEqual( backups ); expect( complete( value ) ).toBe( before );
		} finally { lifecycle.dispose(); }
	} );
	it( 'refuses concurrent reconciliation and keeps the first operation valid', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request ); const server = await unrelatedRevision( value );
		let finish; value.api.get.mockImplementationOnce( () => new Promise( done => { finish = done; } ) );
		const pending = value.work.bridge.reconcile( 13 );
		await expect( value.work.bridge.reconcile( 13 ) ).rejects.toBeInstanceOf( Error );
		finish( { layersread: { revisionId: 13, snapshot: server, sourceGeometry: [] } } );
		expect( ( await pending ).revisionId ).toBe( 13 ); expect( value.work.editor.historyManager.undo() ).toBe( true );
	} );
	it( 'refuses a fabricated Bridge route and replaced reconciliation method', async () => {
		const value = await setup( { sparse: false } ), before = complete( value );
		expect( () => value.work.bridge.enableWholePdfImportReconciliation( value.application, {} ) ).toThrow();
		value.application.reconcilePublication = jest.fn();
		await expect( value.work.bridge.reconcile( 13 ) ).rejects.toBeInstanceOf( Error );
		delete value.application.reconcilePublication; expect( complete( value ) ).toBe( before );
	} );
	it( 'recovers a reconciled draft in a new actual session, then preserves group Undo and first-Save provenance', async () => {
		const value = await setup( { sparse: false } ); await applyImport( value.work, value.application, value.request );
		const server = await unrelatedRevision( value ); await value.work.bridge.reconcile( 13 );
		const storage = mapStorage(), original = controllerFor( value.work, value.application, storage, writerA ); original.controller.persist();
		const imported = copy( value.work.session._snapshot ), backups = Array.from( storage.rows );
		const next = await setup( { sparse: false } ); next.setServer( server ); next.setRevision( 13 ); await next.work.bridge.reconcile( 13 );
		const controller = controllerFor( next.work, next.application, storage, writerB ).controller;
		const lifecycle = new Lifecycle( next.work.bridge, controller, { chooseDraft: async () => 0, confirmRecovery: async () => true,
			notifyBlocked: jest.fn(), notifyFailure: jest.fn() } );
		try {
			await lifecycle.initialize(); expect( lifecycle.ready ).toBe( true ); expect( next.work.session._snapshot ).toEqual( imported );
			expect( next.work.editor.historyManager.undo() ).toBe( true ); expect( next.work.editor.historyManager.redo() ).toBe( true );
			await lifecycle.save(); expect( nativeCalls( next.api ) ).toHaveLength( 1 );
			for ( const [ key, raw ] of backups ) { expect( storage.rows.get( key ) ).toBe( raw ); }
		} finally { lifecycle.dispose(); }
	} );
} );
module.exports = { setup, complete, unrelatedRevision, applyImport, copy, editPage, mapStorage, controllerFor, writerA, Lifecycle };
