'use strict';
const { copy, setup: publicationSetup, witness, nativeCalls } = require( './PageOwnedWholePdfImportPublication.test.js' );
const { DraftController, DraftStore, SnapshotAdapter, mapStorage, writerA, writerB } = require( './PageOwnedWholePdfImportDraftStorage.test.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportCatalogClient.js' );
require( '../../resources/ext.layers.editor/PageOwnedImportControl.js' );
const Integration = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportIntegration.js' );
const en = require( '../../i18n/en.json' );
const message = ( key, ...args ) => en[ key ].replace( /\$(\d+)/g, ( _, index ) => String( args[ index - 1 ] ) );
const tick = async () => { for ( let index = 0; index < 160; index++ ) { await Promise.resolve(); } };
const open = [];

async function setup( { sparse = false, storage = mapStorage(), writer = writerA, ui = {} } = {} ) {
	const value = await publicationSetup( { optIn: false, sparse } ), { work, api, sourceApi } = value;
	api.post = sourceApi.post;
	const originalGet = api.get.getMockImplementation();
	api.get.mockImplementation( params => params.action === 'layersworkingcopypdfimportcatalog' ? Promise.resolve( {
		layersworkingcopypdfimportcatalog: { version: 1, data: JSON.stringify( { pages: [ {
			title: 'Source owner', owner: 'Source_owner', pageid: 9, revid: 42,
			layerSets: [ { id: 'source-p2', label: 'ABC', kind: 'pdf', fileTitle: 'File:Example.pdf', canvas: { width: 416, height: 208 } } ]
		} ] } ) }
	} ) : originalGet( params ) );
	const integration = new Integration( work.bridge, api, window.Layers.Editor );
	const controller = new DraftController( work.bridge, new DraftStore( storage, writer ), new SnapshotAdapter(),
		{ wiki: 'https://fictionalexample.test/wiki', user: 'PdfIntegrationTest' } );
	integration.enableDrafts( controller );
	const drafts = new Lifecycle( work.bridge, controller, { notifyFailure: jest.fn(), notifyBlocked: jest.fn(), ...ui } );
	const header = document.createElement( 'div' ), before = document.createElement( 'span' ); header.appendChild( before ); document.body.appendChild( header );
	let allocated = 0;
	integration.mount( header, before, drafts, () => 'picker-pdf-layer-' + ++allocated, 100, message );
	const result = { ...value, integration, controller, drafts, storage, header, before };
	open.push( result ); await drafts.initialize(); return result;
}

async function choose( value ) {
	value.integration.control.open(); await tick();
	const result = value.integration.control.dialog.list.querySelector( 'button' ); expect( result ).not.toBeNull();
	result.click(); await tick();
}
async function apply( value, mode = 'append' ) {
	await choose( value ); value.integration.control.dialog.decision.querySelector( '.layers-page-import-' + mode ).click(); await tick();
	expect( value.integration.control.dialog ).toBeNull();
}
const group = work => work.session.getDraft().snapshot.surfaces.filter( surface => surface.source.fileTitle === 'File:Example.pdf' );

describe( 'Stored whole-PDF Import composition through the approved control', () => {
	afterEach( () => {
		for ( const value of open.splice( 0 ).reverse() ) {
			value.drafts.dispose(); value.integration.dispose(); value.work.close(); value.header.remove();
		}
	} );

	it( 'mounts the existing control without changing existing header siblings or publishing', async () => {
		const value = await setup();
		expect( value.header.children[ 0 ] ).toBe( value.integration.control.button ); expect( value.header.children[ 1 ] ).toBe( value.before );
		expect( value.controller.hasWholePdfDrafts() ).toBe( true );
		expect( value.work.editor.historyManager.hasPdfImportHistory( value.integration.application ) ).toBe( true );
		expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'validates the publication transport before installing any editor route', async () => {
		const value = await publicationSetup( { optIn: false } );
		try {
			const before = witness( value.work );
			expect( () => new Integration( value.work.bridge, { get: value.api.get, post: value.sourceApi.post }, window.Layers.Editor ) ).toThrow();
			expect( value.work.editor.historyManager.hasPdfImportHistory() ).toBe( false ); expect( witness( value.work ) ).toBe( before );
		} finally { value.work.close(); }
	} );

	it( 'disposes resources already created when a later constructor refuses', async () => {
		const value = await publicationSetup( { optIn: false } ); value.api.post = value.sourceApi.post;
		const Source = window.Layers.Editor.PageOwnedWholePdfImportSource, dispose = jest.spyOn( Source.prototype, 'dispose' );
		try {
			const classes = { ...window.Layers.Editor, PageOwnedWholePdfImportSession: class { constructor() { throw new Error( 'Refuse setup' ); } } };
			expect( () => new Integration( value.work.bridge, value.api, classes ) ).toThrow( 'layers-working-copy-import-unavailable' );
			expect( dispose ).toHaveBeenCalledTimes( 1 ); expect( value.work.editor.historyManager.hasPdfImportHistory() ).toBe( false );
		} finally { dispose.mockRestore(); value.work.close(); }
	} );

	it( 'refuses duplicate composition without disturbing the already installed routes', async () => {
		const value = await setup(), before = witness( value.work );
		expect( () => new Integration( value.work.bridge, value.api, window.Layers.Editor ) ).toThrow( 'layers-working-copy-import-unavailable' );
		expect( witness( value.work ) ).toBe( before ); await apply( value );
		expect( ( await value.drafts.save() ).revisionId ).toBe( 13 );
	} );

	it( 'discovers by the saved name and preserves a pending rename when existing preparation refuses it', async () => {
		const value = await setup(); value.work.bridge.rename( 'Edited name' ); await choose( value );
		expect( value.integration._target().match ).toEqual( { pageId: 7, kind: 'pdf', label: 'ABC', fileTitle: 'File:Example.pdf' } );
		expect( value.integration._target().name ).toBe( 'Edited name' );
		expect( value.integration.control.dialog.status.textContent ).toBe( en[ 'layers-page-import-failed' ] );
		expect( group( value.work ).every( member => member.label === 'Edited name' ) ).toBe( true );
		expect( value.api.postWithToken ).not.toHaveBeenCalled();
		expect( value.api.get.mock.calls.find( ( [ params ] ) => params.action === 'layersworkingcopypdfimportcatalog' )[ 0 ] ).toMatchObject( { exclude: 7 } );
	} );

	it( 'counts all matching PDF pages, including uncaptured active edits, and excludes other files', async () => {
		const value = await setup(); const store = value.work.editor.stateManager;
		store.set( 'layers', [ ...store.get( 'layers' ), { id: 'pending-layer', type: 'text', text: 'Pending' } ] );
		expect( value.integration._target().layerCount ).toBe( 3 );
		expect( value.work.base.surfaces.find( member => member.id === 'anchor' ).layers ).toHaveLength( 1 );
	} );

	it( 'requires Append or Replace when only an offscreen PDF page contains layers', async () => {
		const value = await setup(); value.work.editor.stateManager.set( 'layers', [] );
		value.work.editor.historyManager.saveState( 'Clear visible page' ); value.work.bridge.capture();
		await choose( value );
		expect( value.integration.control.dialog.decision.hidden ).toBe( false );
		expect( value.integration.control.dialog.decision.querySelector( '.layers-page-import-warning' ).textContent ).toContain( '1' );
		expect( value.work.editor.stateManager.get( 'layers' ) ).toEqual( [] ); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'counts uncaptured layers on a native temporary page that is absent from the snapshot', async () => {
		const value = await setup( { sparse: true } ); expect( await value.work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
		const id = value.work.session.getPdfStatus().activeSurfaceId;
		value.work.editor.stateManager.state.layers = [ { id: 'not-yet-observed', type: 'text', text: 'Live blank page work' } ];
		expect( value.work.session.getDraft().snapshot.surfaces.some( member => member.id === id ) ).toBe( false );
		expect( value.integration._target().layerCount ).toBe( 2 );
	} );

	it.each( [ 'append', 'replace' ] )( '%s applies the whole group and keeps canvas, source and unrelated content exact', async mode => {
		const value = await setup(), original = copy( value.work.session.getDraft().snapshot ); await apply( value, mode );
		const members = group( value.work ); expect( members ).toHaveLength( 2 );
		for ( const member of members ) {
			const previous = original.surfaces.find( surface => surface.id === member.id );
			expect( member.canvas ).toEqual( previous.canvas ); expect( member.source ).toEqual( previous.source );
			expect( member.layers ).toHaveLength( mode === 'append' ? 2 : 1 );
			expect( member.layers.some( layer => layer.text === 'Imported PDF page ' + member.source.page ) ).toBe( true );
			if ( mode === 'append' ) { expect( member.layers ).toContainEqual( previous.layers[ 0 ] ); }
		}
		expect( value.work.session.getDraft().snapshot.surfaces.find( member => member.id === 'other-file' ) ).toEqual( original.surfaces.at( -1 ) );
		expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'uses empty mode only when the entire live group is empty and retains the preceding edit history', async () => {
		const value = await setup();
		for ( const page of [ 1, 2 ] ) {
			expect( await value.work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
			value.work.editor.stateManager.set( 'layers', [] ); value.work.editor.historyManager.saveState( 'Clear page' ); value.work.bridge.capture();
		}
		expect( value.integration._target().layerCount ).toBe( 0 ); await choose( value );
		expect( value.integration.control.dialog ).toBeNull(); expect( group( value.work ).every( member => member.layers.length === 1 ) ).toBe( true );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( group( value.work ).every( member => member.layers.length === 0 ) ).toBe( true );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( value.work.editor.stateManager.get( 'layers' ) ).toHaveLength( 1 );
	} );

	it( 'keeps whole-group Undo and Redo usable after an actual page turn', async () => {
		const value = await setup(), before = copy( value.work.session.getDraft().snapshot ); await apply( value );
		const imported = copy( value.work.session.getDraft().snapshot );
		expect( await value.work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( value.work.session.getDraft().snapshot ).toEqual( before );
		expect( value.work.editor.historyManager.redo() ).toBe( true ); expect( value.work.session.getDraft().snapshot ).toEqual( imported );
	} );

	it( 'publishes one complete document with one source citation through lifecycle Save', async () => {
		const value = await setup(); await apply( value );
		const expected = copy( value.work.session.getDraft().snapshot ), result = await value.drafts.save( 'Imported complete PDF' );
		expect( result ).toMatchObject( { revisionId: 13, dirty: false, draftPersisted: true } );
		expect( nativeCalls( value.api ) ).toHaveLength( 1 );
		const posted = nativeCalls( value.api )[ 0 ][ 1 ]; expect( JSON.parse( posted.data ) ).toEqual( expected );
		expect( JSON.parse( posted.importsources ) ).toHaveLength( 1 );
		expect( Array.from( value.storage.rows.values() ).some( raw => JSON.parse( raw ).scope.baseRevisionId === 13 ) ).toBe( true );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( value.work.session.getStatus().dirty ).toBe( true );
	} );

	it( 'Cancel and Escape preserve complete work, selection and page histories', async () => {
		const value = await setup(); const before = witness( value.work ); await choose( value );
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true, cancelable: true } ) );
		expect( witness( value.work ) ).toBe( before ); expect( value.integration.control.dialog ).toBeNull(); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it.each( [ 'checking', 'saving', 'finalized', 'disposed', 'not ready' ] )( 'refuses Import when the lifecycle is %s', async reason => {
		const value = await setup(); if ( reason === 'not ready' ) { value.drafts.ready = false; } else { value.drafts[ reason ] = true; }
		value.integration.control.open(); expect( value.integration.control.dialog ).toBeNull();
		if ( reason === 'not ready' ) { value.drafts.ready = true; } else { value.drafts[ reason ] = false; }
	} );

	it.each( [ 'readOnly', 'new', 'missing PDF', 'no owner', 'conflict', 'uncertain' ] )( 'does not support %s targets', async reason => {
		const value = await setup(), session = value.work.session, saved = { readOnly: session._readOnly, newSurface: session._newSurface,
			pdf: session._pdf, pageId: session._pageId, phase: session._phase };
		if ( reason === 'readOnly' ) { session._readOnly = true; } if ( reason === 'new' ) { session._newSurface = {}; }
		if ( reason === 'missing PDF' ) { session._pdf = null; } if ( reason === 'no owner' ) { session._pageId = 0; }
		if ( [ 'conflict', 'uncertain' ].includes( reason ) ) { session._phase = reason; }
		expect( Integration.supports( value.work.bridge ) ).toBe( false );
		Object.assign( session, { _readOnly: saved.readOnly, _newSurface: saved.newSurface, _pdf: saved.pdf, _pageId: saved.pageId, _phase: saved.phase } );
	} );

	it( 'refuses fresh source denial without changing complete work or usable histories', async () => {
		const value = await setup(); await choose( value ); const before = witness( value.work );
		value.sourceApi.post.mockRejectedValueOnce( { error: { code: 'permissiondenied' } } );
		value.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
		expect( witness( value.work ) ).toBe( before ); expect( value.integration.control.dialog.status.textContent ).toBe( en[ 'layers-page-import-failed' ] );
		expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'cancels a pending preparation without applying late work or preventing another choice', async () => {
		const value = await setup(), original = value.sourceApi.post.getMockImplementation(); let finish;
		value.sourceApi.post.mockImplementationOnce( params => new Promise( done => { finish = () => original( params ).then( done ); } ) );
		value.integration.control.open(); await tick(); value.integration.control.dialog.list.querySelector( 'button' ).click(); await tick();
		const before = witness( value.work ); value.integration.control.close(); finish(); await tick();
		expect( witness( value.work ) ).toBe( before ); await apply( value ); expect( group( value.work )[ 0 ].layers ).toHaveLength( 2 );
	} );

	it( 'disposes a pending Apply without late editor mutation or leaked controls', async () => {
		const value = await setup(); await choose( value ); const before = witness( value.work );
		const original = value.sourceApi.post.getMockImplementation(); let finish;
		value.sourceApi.post.mockImplementationOnce( params => new Promise( done => { finish = () => original( params ).then( done ); } ) );
		value.integration.control.dialog.decision.querySelector( '.layers-page-import-append' ).click(); await tick();
		value.integration.dispose(); finish(); await tick();
		expect( witness( value.work ) ).toBe( before ); expect( value.header.querySelector( 'button' ) ).toBeNull();
		expect( document.querySelector( '.layers-page-import-overlay' ) ).toBeNull(); expect( value.api.postWithToken ).not.toHaveBeenCalled();
	} );

	it( 'rechecks lifecycle readiness during native preparation and preserves newer work', async () => {
		const value = await setup(), original = value.sourceApi.post.getMockImplementation(); let finish;
		value.sourceApi.post.mockImplementationOnce( params => new Promise( done => { finish = () => original( params ).then( done ); } ) );
		value.integration.control.open(); await tick(); value.integration.control.dialog.list.querySelector( 'button' ).click(); await tick();
		value.drafts.checking = true; const before = witness( value.work ); finish(); await tick();
		expect( witness( value.work ) ).toBe( before ); expect( value.integration.control.dialog.status.textContent ).toBe( en[ 'layers-page-import-failed' ] );
		value.drafts.checking = false; value.integration.control.close(); await apply( value );
	} );

	it( 'imports a missing internal PDF member while preserving its native temporary identity', async () => {
		const value = await setup( { sparse: true } );
		expect( await value.work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
		const id = value.work.session.getPdfStatus().activeSurfaceId; await apply( value );
		expect( value.work.session.getPdfStatus().activeSurfaceId ).toBe( id );
		expect( group( value.work ).find( member => member.source.page === 1 ).id ).toBe( id );
		expect( value.work.editor.historyManager.undo() ).toBe( true ); expect( value.work.editor.stateManager.get( 'layers' ) ).toEqual( [] );
		expect( value.work.editor.historyManager.redo() ).toBe( true ); await value.drafts.save();
		expect( JSON.parse( nativeCalls( value.api )[ 0 ][ 1 ].data ).surfaces.find( member => member.id === id ) ).toBeDefined();
	} );

	it( 'recovers a picker-produced whole-PDF draft after explicit confirmation in a fresh composition', async () => {
		const value = await setup(); await apply( value ); const imported = copy( value.work.session.getDraft().snapshot );
		const backups = Array.from( value.storage.rows );
		const next = await setup( { storage: mapStorage( backups ), writer: writerB,
			ui: { chooseDraft: jest.fn().mockResolvedValue( 0 ), confirmRecovery: jest.fn().mockResolvedValue( true ) } } );
		expect( next.drafts.ready ).toBe( true ); expect( next.work.session.getDraft().snapshot ).toEqual( imported );
		expect( next.work.editor.historyManager.undo() ).toBe( true ); expect( next.work.editor.historyManager.redo() ).toBe( true );
		await next.drafts.save(); expect( nativeCalls( next.api ) ).toHaveLength( 1 );
		for ( const [ key, raw ] of backups ) { expect( next.storage.rows.get( key ) ).toBe( raw ); }
	} );

	it( 'leaves the production composition and ResourceLoader callers inactive', () => {
		const module = require( '../../extension.json' ).ResourceModules[ 'ext.layers.editor.pageOwned' ];
		expect( module.scripts ).not.toContain( 'PageOwnedWholePdfImportIntegration.js' );
		const fs = require( 'fs' ), path = require( 'path' );
		expect( fs.readFileSync( path.resolve( __dirname, '../../resources/ext.layers.editor/APIManager.js' ), 'utf8' ) ).not.toContain( 'PageOwnedWholePdfImportIntegration' );
	} );
} );
