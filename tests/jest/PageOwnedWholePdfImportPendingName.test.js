'use strict';
const { setup: publicationSetup, applyImport, copy, importPayload, importOptions, nativeCalls } = require( './PageOwnedWholePdfImportPublication.test.js' );
const { mapStorage, controllerFor, writerA, writerB, DraftController, DraftStore, SnapshotAdapter } = require( './PageOwnedWholePdfImportDraftStorage.test.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportCatalogClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedImportControl.js' );
const Integration = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportIntegration.js' );
const DraftPlan = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportDraftPlan.js' );
const messages = require( '../../i18n/en.json' );
const open = [];
async function setup( { sparse = false, enabled = true } = {} ) {
	const value = await publicationSetup( { sparse } ); open.push( value );
	value.application.enableReconciliation();
	if ( enabled && typeof value.binding.enablePendingRenames === 'function' ) { value.binding.enablePendingRenames(); }
	return value;
}
const group = work => work.session._snapshot.surfaces.filter( member => member.source.fileTitle === 'File:Example.pdf' );
function complete( value, allowInvalidDraft = false ) {
	const { work } = value;
	let draft; try { draft = value.application.captureDraftForStorage(); }
	catch ( error ) { if ( !allowInvalidDraft ) { throw error; } draft = { refused: error.code }; }
	return JSON.stringify( { snapshot: work.session._snapshot, base: work.session._savedJson, revision: work.session._revisionId,
		phase: work.session._phase, pdf: work.session.getPdfStatus(), temporary: Array.from( work.session._pdf.temporary ),
		admissions: Array.from( work.session._pdf.admissions ), live: work.bridge.getLiveState(),
		history: work.editor.historyManager.captureTimeline(), timelines: Array.from( work.bridge.pdfCoordinator.timelines ),
		draft } );
}
const tick = async () => { for ( let index = 0; index < 160; index++ ) { await Promise.resolve(); } };
async function setupControl() {
	const value = await publicationSetup( { optIn: false, sparse: true } ); open.push( value ); value.api.post = value.sourceApi.post;
	const get = value.api.get.getMockImplementation(); value.api.get.mockImplementation( params => params.action === 'layersworkingcopypdfimportcatalog' ?
		Promise.resolve( { layersworkingcopypdfimportcatalog: { version: 1, data: JSON.stringify( { pages: [ {
			title: 'Source owner', owner: 'Source_owner', pageid: 9, revid: 42, layerSets: [ {
				id: 'source-p2', label: 'ABC', kind: 'pdf', fileTitle: 'File:Example.pdf', canvas: { width: 416, height: 208 }
			} ] } ] } ) } } ) : get( params ) );
	value.integration = new Integration( value.work.bridge, value.api, window.Layers.Editor );
	value.binding = value.integration.binding; value.application = value.integration.application;
	value.integration.enablePendingRenames(); value.storage = mapStorage();
	value.controller = new DraftController( value.work.bridge, new DraftStore( value.storage, writerA ), new SnapshotAdapter(),
		{ wiki: 'https://fictionalexample.test/wiki', user: 'PendingNameTest' } );
	value.integration.enableDrafts( value.controller ); value.drafts = new Lifecycle( value.work.bridge, value.controller,
		{ notifyFailure: jest.fn(), notifyBlocked: jest.fn() } );
	value.header = document.createElement( 'div' ); const before = document.createElement( 'span' ); value.header.appendChild( before );
	document.body.appendChild( value.header ); let allocated = 0;
	value.integration.mount( value.header, before, value.drafts, () => 'renamed-picker-' + ++allocated, 100,
		( key, ...args ) => messages[ key ].replace( /\$(\d+)/g, ( _, at ) => String( args[ at - 1 ] ) ) );
	await value.drafts.initialize(); return value;
}
describe( 'Opted-in whole-PDF Import after a coherent pending rename', () => {
	afterEach( () => { for ( const value of open.splice( 0 ).reverse() ) {
		if ( value.drafts ) { value.drafts.dispose(); value.integration.dispose(); value.header.remove(); }
		value.work.close();
	} } );
	it( 'imports under the pending name while preserving the exact saved base and native source citation', async () => {
		const value = await setup(), { work } = value;
		work.bridge.rename( 'Edited name' ); const base = work.session._savedJson;
		const before = copy( work.session._snapshot ); await applyImport( work, value.application, value.request );
		expect( group( work ).every( member => member.label === 'Edited name' ) ).toBe( true );
		expect( group( work ).every( member => member.layers.some( layer => layer.text === 'Imported PDF page ' + member.source.page ) ) ).toBe( true );
		expect( work.session._savedJson ).toBe( base );
		expect( value.binding.getImportPublication().sources ).toEqual( [ { targetSurfaceId: 'anchor', sourcePageId: 9,
			sourceRevisionId: 42, sourceSurfaceId: 'source-p2' } ] );
		expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.session._snapshot ).toEqual( before );
		expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.session.getLabel() ).toBe( 'Edited name' );
		expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ [ false, 'append' ], [ false, 'replace' ], [ false, 'empty' ], [ true, 'append' ], [ true, 'replace' ], [ true, 'empty' ] ] )(
		'preserves exact names, pins and native identities with sparse=%s and %s', async ( sparse, mode ) => {
			const value = await setup( { sparse } ), { work } = value;
			if ( mode === 'empty' ) {
				for ( const page of ( sparse ? [ 2 ] : [ 1, 2 ] ) ) {
					if ( work.session.getPdfStatus().page !== page ) { expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true ); }
					work.editor.stateManager.set( 'layers', [] ); work.editor.historyManager.saveState( 'Clear target' ); work.bridge.capture();
				}
			}
			work.bridge.rename( 'Étage 001' ); const before = copy( work.session._snapshot );
			await applyImport( work, value.application, { ...value.request, mode } );
			expect( group( work ) ).toHaveLength( 2 );
			for ( const member of group( work ) ) {
				const previous = before.surfaces.find( item => item.id === member.id );
				expect( member.label ).toBe( 'Étage 001' );
				expect( member.layers ).toHaveLength( mode === 'append' && previous ? previous.layers.length + 1 : 1 );
				if ( previous ) { expect( member.source ).toEqual( previous.source ); expect( member.canvas ).toEqual( previous.canvas ); }
				else { expect( value.binding.getImportPublication().admissionRevisions ).toEqual( [] ); }
			}
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.session._snapshot ).toEqual( before );
			expect( work.editor.historyManager.redo() ).toBe( true );
			if ( sparse ) {
				const origin = work.session._pdf.admissions.values().next().value;
				expect( origin.surface.label ).toBe( 'ABC' ); expect( origin.surface.layers ).toEqual( [] );
				expect( group( work ).find( member => member.source.page === 1 ).id ).toBe( origin.surface.id );
			}
		} );
	it( 'keeps native Source evidence unchanged and prepares without touching live work', async () => {
		const value = await setup( { sparse: true } ), { work } = value; work.bridge.rename( 'Edited name' ); const before = complete( value );
		const handle = await value.binding.prepare( value.request ), preview = value.binding.inspect( handle ), evidence = value.binding.getReadEvidence( handle );
		expect( complete( value ) ).toBe( before ); expect( evidence.result.targetBundle.snapshot ).toEqual( JSON.parse( work.session._savedJson ) );
		expect( evidence.result.targetGroup.label ).toBe( 'ABC' ); expect( evidence.result.sourceGroup.label ).toBe( 'ABC' );
		expect( evidence.result.sourceBundle.snapshot.surfaces.every( member => member.label === 'ABC' ) ).toBe( true );
		expect( preview.admittedTargetSurfaces[ 0 ].label ).toBe( 'ABC' );
		expect( preview.candidateSnapshot.surfaces.filter( member => member.source.fileTitle === 'File:Example.pdf' ).every( member => member.label === 'Edited name' ) ).toBe( true );
		await value.binding.revalidate( handle ); value.binding.release( handle ); expect( complete( value ) ).toBe( before );
	} );
	it( 'retains the original default refusal and complete pending work', async () => {
		const value = await setup( { enabled: false } ); value.work.bridge.rename( 'Edited name' ); const before = complete( value );
		await expect( value.application.prepare( value.request ) ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( before );
	} );
	it( 'cancel does not read, allocate or change pending work', async () => {
		const value = await setup(); value.work.bridge.rename( 'Edited name' ); const before = complete( value );
		expect( await value.application.prepare( { mode: 'cancel' } ) ).toBeNull(); expect( complete( value ) ).toBe( before );
		expect( value.sourceApi.post ).not.toHaveBeenCalled(); expect( value.request.allocateId ).not.toHaveBeenCalled();
	} );
	it.each( [ 'partial rename', 'invalid name', 'changed pin', 'missing member', 'changed identity', 'duplicate page', 'foreign member', 'old-name collision' ] )(
		'refuses %s without projecting away the defect', async issue => {
			const value = await setup(), { work } = value; work.bridge.rename( 'Edited name' );
			const first = work.session._snapshot.surfaces.find( member => member.id === 'stored-first' );
			if ( issue === 'partial rename' ) { first.label = 'ABC'; }
			if ( issue === 'invalid name' ) { for ( const member of group( work ) ) { member.label = 'Bad|name'; } }
			if ( issue === 'changed pin' ) { for ( const member of group( work ) ) { member.source.sha1 = 'b'.repeat( 31 ); } }
			if ( issue === 'missing member' ) { work.session._snapshot.surfaces = work.session._snapshot.surfaces.filter( member => member !== first ); }
			if ( issue === 'changed identity' ) { first.id = 'fabricated-member'; }
			if ( issue === 'duplicate page' || issue === 'foreign member' || issue === 'old-name collision' ) {
				work.session._snapshot.surfaces.push( { ...copy( first ), id: 'extra-member',
					label: issue === 'old-name collision' ? 'ABC' : first.label, kind: issue === 'foreign member' ? 'image' : 'pdf' } );
			}
			const before = complete( value, true ); await expect( value.application.prepare( value.request ) ).rejects.toBeInstanceOf( Error );
			expect( complete( value, true ) ).toBe( before ); expect( value.api.postWithToken ).not.toHaveBeenCalled();
		} );
	it( 'refuses a changed complete native read at application without changing pending work', async () => {
		const value = await setup(); value.work.bridge.rename( 'Edited name' ); const handle = await value.application.prepare( value.request );
		const changed = importPayload( value.work ); changed.sourceBundle.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'Changed native read';
		value.sourceApi.post.mockImplementationOnce( () => Promise.resolve( { layersworkingcopypdfimportread: { version: 1, data: JSON.stringify( changed ) } } ) );
		const before = complete( value ); await expect( value.application.apply( handle ) ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( before );
	} );
	it.each( [ 'edit', 'rename', 'page turn' ] )( 'refuses a pending native read after a newer %s', async change => {
		const value = await setup(), { work } = value; work.bridge.rename( 'Edited name' ); const response = importPayload( work ); let finish;
		value.sourceApi.post.mockImplementationOnce( () => new Promise( done => { finish = done; } ) );
		const pending = value.application.prepare( value.request ); pending.catch( () => {} );
		if ( change === 'edit' ) { work.edit( 'Newer edit' ); work.bridge.capture(); }
		if ( change === 'rename' ) { work.bridge.rename( 'Newer name' ); }
		if ( change === 'page turn' ) { expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true ); }
		const before = complete( value ); finish( { layersworkingcopypdfimportread: { version: 1, data: JSON.stringify( response ) } } );
		await expect( pending ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( before );
	} );
	it( 'refuses enabling the mode across an already captured native read', async () => {
		const value = await setup( { enabled: false } ), response = importPayload( value.work ); let finish;
		value.sourceApi.post.mockImplementationOnce( () => new Promise( done => { finish = done; } ) );
		const pending = value.application.prepare( value.request ); pending.catch( () => {} ); value.binding.enablePendingRenames(); const before = complete( value );
		finish( { layersworkingcopypdfimportread: { version: 1, data: JSON.stringify( response ) } } );
		await expect( pending ).rejects.toBeInstanceOf( Error ); expect( complete( value ) ).toBe( before );
	} );
	it( 'keeps repeated Import commands and pending name usable through page turns and Undo/Redo', async () => {
		const value = await setup( { sparse: true } ), { work } = value; work.bridge.rename( 'Edited name' );
		await applyImport( work, value.application, value.request ); await applyImport( work, value.application, importOptions( work ) );
		const imported = copy( work.session._snapshot );
		expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
		for ( const action of [ 'undo', 'undo', 'redo', 'redo' ] ) { expect( work.editor.historyManager[ action ]() ).toBe( true ); expect( work.session.getLabel() ).toBe( 'Edited name' ); }
		expect( work.session._snapshot ).toEqual( imported ); expect( value.application.captureDraftForStorage().history.groups ).toHaveLength( 2 );
	} );
	it( 'publishes the pending name once and preserves usable Import Undo after confirmation', async () => {
		const value = await setup( { sparse: true } ), { work } = value; work.bridge.rename( 'Edited name' );
		await applyImport( work, value.application, value.request ); const imported = copy( work.session._snapshot );
		expect( ( await work.bridge.save() ).revisionId ).toBe( 13 );
		expect( JSON.parse( nativeCalls( value.api )[ 0 ][ 1 ].data ) ).toEqual( imported ); expect( JSON.parse( work.session._savedJson ) ).toEqual( imported );
		expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.session.getLabel() ).toBe( 'Edited name' );
		expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.session.getStatus().dirty ).toBe( false );
	} );
	it( 'preserves the pending name and both Import sides through disjoint reconciliation', async () => {
		const value = await setup(), { work } = value; work.bridge.rename( 'Edited name' ); await applyImport( work, value.application, value.request );
		const server = value.getServer(); server.surfaces.find( member => member.id === 'other-file' ).layers[ 0 ].text = 'Remote edit';
		value.setServer( server ); value.setRevision( 13 ); await work.bridge.reconcile( 13 );
		for ( const action of [ 'undo', 'redo' ] ) { expect( work.editor.historyManager[ action ]() ).toBe( true ); expect( work.session.getLabel() ).toBe( 'Edited name' ); }
		expect( value.binding.getImportPublication().sources ).toHaveLength( 1 );
	} );
	it( 'recovers the pending name and complete sparse Import history in a fresh session', async () => {
		const value = await setup( { sparse: true } ); value.work.bridge.rename( 'Edited name' ); await applyImport( value.work, value.application, value.request );
		const storage = mapStorage(), controller = controllerFor( value.work, value.application, storage, writerA ).controller;
		controller.persist(); const before = copy( value.work.session._snapshot ), backups = Array.from( storage.rows );
		const next = await setup( { sparse: true } ), recovered = controllerFor( next.work, next.application, storage, writerB ).controller;
		const lifecycle = new Lifecycle( next.work.bridge, recovered, { chooseDraft: async () => 0, confirmRecovery: async () => true,
			notifyFailure: jest.fn(), notifyBlocked: jest.fn() } );
		try {
			await lifecycle.initialize(); expect( lifecycle.ready ).toBe( true ); expect( next.work.session._snapshot ).toEqual( before );
			expect( next.work.editor.historyManager.undo() ).toBe( true ); expect( next.work.editor.historyManager.redo() ).toBe( true );
			await lifecycle.save(); expect( nativeCalls( next.api ) ).toHaveLength( 1 );
			for ( const [ key, raw ] of backups ) { expect( storage.rows.get( key ) ).toBe( raw ); }
		} finally { lifecycle.dispose(); }
	} );
	it( 'uses the unchanged approved dialog with saved-name discovery and pending-name target presentation', async () => {
		const value = await setupControl(); value.work.bridge.rename( 'Edited name' );
		value.integration.control.open(); await tick(); value.integration.control.dialog.list.querySelector( 'button' ).click(); await tick();
		expect( value.integration._target().match.label ).toBe( 'ABC' ); expect( value.integration._target().name ).toBe( 'Edited name' );
		expect( value.integration.control.dialog.decision.hidden ).toBe( false );
		value.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
		expect( value.integration.control.dialog ).toBeNull(); expect( group( value.work ).every( member => member.label === 'Edited name' ) ).toBe( true );
		expect( value.controller.inspectRecovery().wholePdfImportDraft.history.groups ).toHaveLength( 1 ); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it.each( [ 'Bad|name', 'Bad:name', ' leading', '' ] )( 'refuses an invalid renamed draft label %j', async label => {
		const value = await setup(); value.work.bridge.rename( 'Edited name' ); await applyImport( value.work, value.application, value.request );
		const draft = value.application.captureDraftForStorage();
		for ( const surface of draft.session.snapshot.surfaces ) { if ( surface.source.fileTitle === 'File:Example.pdf' ) { surface.label = label; } }
		expect( () => DraftPlan.prepare( draft, value.binding.captureImportDraftForStorage() ) ).toThrow();
	} );
	it( 'refuses forged native-origin labels during fresh recovery authorization while preserving live work', async () => {
		const value = await setup( { sparse: true } ); value.work.bridge.rename( 'Edited name' ); await applyImport( value.work, value.application, value.request );
		const draft = value.application.captureDraftForStorage();
		for ( const holder of [ draft.session, ...draft.history.groups.flatMap( item => [ item.checkpoints.before, item.checkpoints.after ] ) ] ) {
			for ( const row of holder.temporary ) { row[ 1 ].label = 'Forged native name'; }
			for ( const row of holder.admissions ) { row[ 1 ].surface.label = 'Forged native name'; }
		}
		expect( () => DraftPlan.prepare( draft, value.binding.captureImportDraftForStorage() ) ).not.toThrow();
		const before = complete( value ); await expect( value.application.prepareDraftRecovery( draft, () => {} ) ).rejects.toBeInstanceOf( Error );
		expect( complete( value ) ).toBe( before ); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'keeps drafts, pending name and saved markers unchanged when prepublication refuses', async () => {
		const value = await setup( { sparse: true } ); value.work.bridge.rename( 'Edited name' ); await applyImport( value.work, value.application, value.request );
		const before = complete( value );
		await expect( value.work.bridge.save( '', () => { throw new Error( 'Preserve work' ); } ) ).rejects.toBeInstanceOf( Error );
		expect( complete( value ) ).toBe( before ); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
	it( 'does not change modes while an existing native preview is retained', async () => {
		const value = await setup( { enabled: false } ), handle = await value.binding.prepare( value.request ), before = complete( value );
		expect( () => value.binding.enablePendingRenames() ).toThrow(); expect( complete( value ) ).toBe( before ); value.binding.release( handle );
		value.binding.enablePendingRenames(); value.binding.enablePendingRenames();
	} );
	it( 'refuses replaced opt-in methods before reading or changing work', async () => {
		const value = await setup(); value.work.bridge.rename( 'Edited name' ); const before = complete( value );
		value.binding.enablePendingRenames = jest.fn(); await expect( value.application.prepare( value.request ) ).rejects.toBeInstanceOf( Error );
		delete value.binding.enablePendingRenames; expect( complete( value ) ).toBe( before ); expect( value.sourceApi.post ).not.toHaveBeenCalled();
	} );
	it( 'inspects a renamed draft viewed on an absent native blank without rewriting its origin', async () => {
		const value = await setup( { sparse: true } ), { work } = value;
		value.sourceApi.post.mockImplementation( () => Promise.resolve( { layersworkingcopypdfimportread: {
			version: 1, data: JSON.stringify( importPayload( work, [ 2 ] ) ) } } ) );
		work.bridge.rename( 'Edited name' ); expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
		await applyImport( work, value.application, value.request ); const activeId = work.session.getPdfStatus().activeSurfaceId;
		expect( work.session._snapshot.surfaces.some( member => member.id === activeId ) ).toBe( false );
		const storage = mapStorage(), controller = controllerFor( work, value.application, storage ).controller; controller.persist();
		const before = complete( value ), candidate = controller.inspectRecovery(); expect( candidate.label ).toBe( 'Edited name' );
		expect( candidate.editorState.layers ).toEqual( [] ); expect( candidate.wholePdfImportDraft.session.pdf.page ).toBe( 1 );
		expect( candidate.wholePdfImportDraft.session.temporary.find( row => row[ 0 ] === activeId )[ 1 ].label ).toBe( 'ABC' );
		expect( complete( value ) ).toBe( before ); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );
} );
