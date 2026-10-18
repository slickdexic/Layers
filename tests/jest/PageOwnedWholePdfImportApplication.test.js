'use strict';

// Fixture helpers and the whole-PDF reader DTO are shared with the qualified
// whole-PDF import tests; this suite exercises only the new opt-in application.
const { TextEncoder } = require( 'util' );
global.TextEncoder = TextEncoder;
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Binding = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSession.js' );
const WholeSource = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSource.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
require( '../../resources/ext.layers.editor/selection/SelectionState.js' );
require( '../../resources/ext.layers.editor/SelectionManager.js' );
const Application = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportApplication.js' );
const SelectionManager = window.Layers.Core.SelectionManager;
const CODE = 'layers-working-copy-import-unavailable';
const sourcePin = { repository: 'local', fileTitle: 'File:Example.pdf', timestamp: '20260906130000', sha1: 'b'.repeat( 31 ) };
let allocationGeneration = 0;

const copy = value => JSON.parse( JSON.stringify( value ) );
const textLayer = ( id, text = id ) => ( { id, type: 'text', text, x: -17 } );

function response( payload ) {
	const json = Array.from( JSON.stringify( payload ), char => {
		const point = char.codePointAt( 0 );
		if ( point <= 127 ) { return char; }
		if ( point <= 0xffff ) { return '\\u' + point.toString( 16 ).padStart( 4, '0' ); }
		const adjusted = point - 0x10000;
		return '\\u' + ( 0xd800 + ( adjusted >> 10 ) ).toString( 16 ) + '\\u' + ( 0xdc00 + ( adjusted & 0x3ff ) ).toString( 16 );
	} ).join( '' );
	return { layersworkingcopypdfimportread: { version: 1, data: json } };
}

function payload( work, pages = [ 1, 2 ], tweak = () => {} ) {
	const base = copy( JSON.parse( work.session._savedJson ) );
	const anchor = base.surfaces.find( surface => surface.id === 'anchor' );
	const targetPin = { ...anchor.source }; delete targetPin.page;
	const targetMembers = base.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === anchor.label && surface.source.fileTitle === anchor.source.fileTitle );
	const sourceMembers = pages.map( page => {
		const target = page === 2 ? anchor : work.context( page ).surface;
		return { ...copy( target ), id: 'source-p' + page, label: 'ABC', source: { ...sourcePin, page }, layers: [ textLayer( 'source-layer-' + page ) ] };
	} );
	const bundle = ( revisionId, members ) => ( { revisionId, snapshot: { schemaVersion: 1, surfaces: members },
		sourceGeometry: Object.fromEntries( members.filter( surface => surface.kind === 'pdf' ).map( surface => [ surface.id, { page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels' } ] ) ),
		sourceRenditions: Object.fromEntries( members.filter( surface => surface.kind === 'pdf' ).map( surface => [ surface.id, { url: 'https://example.test/' + surface.id + '.jpg', width: 415, height: 207 } ] ) ) } );
	const admitted = pages.includes( 1 ) && !targetMembers.some( surface => surface.source.page === 1 ) ? [ copy( work.context( 1, work.session._revisionId, base ).surface ) ] : [];
	const targetGeometry = Object.fromEntries( targetMembers.map( surface => [ surface.id, { page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels' } ] ) );
	const targetRenditions = Object.fromEntries( targetMembers.map( surface => [ surface.id, { url: 'https://example.test/target-' + surface.source.page + '.jpg', width: 415, height: 207 } ] ) );
	const result = {
		target: { pageId: 7, owner: 'Owner', revisionId: work.session._revisionId, surfaceId: 'anchor' },
		source: { pageId: 9, owner: 'Source_owner', revisionId: 42, surfaceId: 'source-p2' },
		targetBundle: { revisionId: work.session._revisionId, snapshot: base, sourceGeometry: targetGeometry, sourceRenditions: targetRenditions },
		sourceBundle: bundle( 42, sourceMembers ),
		targetGroup: { label: anchor.label, source: targetPin, pageCount: 2, members: targetMembers.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) },
		sourceGroup: { label: 'ABC', source: sourcePin, pageCount: 2, members: sourceMembers.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) },
		admittedTargetSurfaces: admitted,
		admittedTargetGeometry: Object.fromEntries( admitted.map( surface => [ surface.id, { page: surface.source.page, width: 208, height: 416, units: 'file-handler-pixels' } ] ) ),
		admittedTargetRenditions: Object.fromEntries( admitted.map( surface => [ surface.id, { url: 'https://example.test/admitted-' + surface.source.page + '.jpg', width: 208, height: 416 } ] ) )
	};
	tweak( result ); return result;
}

function options( work, mode = 'append', assertCurrent ) {
	let next = 0; const generation = ++allocationGeneration; let original;
	assertCurrent = assertCurrent || ( () => {
		const current = work.bridge.pdfCoordinator.witness( true );
		if ( original === undefined ) { original = current; }
		if ( original !== current ) { throw new Error( 'Editor participants changed' ); }
	} );
	return { source: { pageId: 9, revisionId: 42, surfaceId: 'source-p2' }, mode, maxLayers: 20,
		allocateId: jest.fn( () => 'imported-' + generation + '-' + ++next ), assertCurrent };
}

function witness( work ) {
	return JSON.stringify( { draft: work.session.getDraft(), status: work.session.getStatus(), pdf: work.session.getPdfStatus(),
		coordinator: work.bridge.pdfCoordinator.witness( true ), timelines: Array.from( work.bridge.pdfCoordinator.timelines ),
		live: work.bridge.getLiveState(), history: work.editor.historyManager.captureTimeline(), page: work.editor.page } );
}

async function unavailable( promise ) {
	let error; try { await promise; } catch ( caught ) { error = caught; }
	expect( error ).toBeInstanceOf( Error ); expect( error.message ).toBe( CODE ); expect( error.code ).toBe( CODE );
}

async function setup( pages = [ 1, 2 ], mode = 'append', tweak = () => {}, sparse = true ) {
	const work = await fixture( sparse );
	work.editor.canvasManager.selectionManager = new SelectionManager( {}, work.editor.canvasManager );
	const api = { post: jest.fn( () => Promise.resolve( response( payload( work, pages, tweak ) ) ) ) };
	const source = new WholeSource( api ), binding = new Binding( work.session, source, new PdfClient( work.api ) );
	const application = new Application( work.bridge, binding );
	return { work, api, source, binding, application, request: options( work, mode ) };
}

async function editPage( work, page, text ) {
	if ( work.editor.page !== page && !await work.bridge.pdfCoordinator.turn( page ) ) { throw new Error( 'fixture page turn failed' ); }
	work.edit( text ); work.bridge.capture();
}

async function prepared( application, request ) {
	const handle = await application.prepare( request );
	return { handle, preview: application.inspect( handle ) };
}

describe( 'PageOwnedWholePdfImportApplication', () => {
	it( 'applies append atomically to sparse/offscreen pages while preserving unrelated snapshot data and active page', async () => {
		const { work, application, request } = await setup();
		try {
			await editPage( work, 2, 'Unsaved page two' ); await editPage( work, 1, 'Unsaved temporary page one' );
			const { handle, preview } = await prepared( application, request ), before = witness( work );
			expect( preview.candidateSnapshot.metadata ).toEqual( work.session._snapshot.metadata );
			expect( preview.candidateSnapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) )
				.toEqual( [ 'source-layer-2', 'Unsaved page two' ] );
			const result = await application.apply( handle );
			expect( result.candidateSnapshot ).toEqual( work.session._snapshot );
			expect( result.activePage ).toBe( preview.activePage );
			expect( result.importedLayerIds.length ).toBeGreaterThan( 0 );
			expect( witness( work ) ).not.toBe( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it( 'replaces selected-group layers, retaining whole-group pages and their file pins', async () => {
		const { work, application, request } = await setup( [ 2 ], 'replace' );
		try {
			await editPage( work, 1, 'Target-only layer' );
			const { handle, preview } = await prepared( application, request );
			const page1 = preview.candidateSnapshot.surfaces.find( member => member.kind === 'pdf' &&
				member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 );
			expect( page1 ).toBeDefined(); expect( page1.layers ).toEqual( [] );
			await application.apply( handle );
			expect( work.session._snapshot.surfaces.find( member => member.id === page1.id ).source ).toEqual( page1.source );
		} finally { work.close(); }
	} );

	it( 'keeps an untouched active temporary page out of the snapshot and preserves its displayed context', async () => {
		const { work, application, request } = await setup( [ 2 ] );
		try {
			await work.bridge.pdfCoordinator.turn( 1 ); const id = work.session.getPdfStatus().activeSurfaceId;
			const { handle, preview } = await prepared( application, request );
			expect( preview.activeSurfaceId ).toBe( id ); expect( preview.activePage ).toBe( 1 );
			expect( preview.candidateSnapshot.surfaces.some( member => member.id === id ) ).toBe( false );
			await application.apply( handle );
			expect( work.session._pdf.temporary.has( id ) ).toBe( true );
			expect( work.editor.page ).toBe( 1 ); expect( work.editor.stateManager.get( 'layers' ) ).toEqual( [] );
		} finally { work.close(); }
	} );

	it( 'updates the active editor display from the committed session and preserves imported pages on later turns', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), result = await application.apply( handle );
			expect( work.editor.stateManager.get( 'layers' ) ).toEqual( result.editorState.layers );
			for ( const page of [ 1, 2 ] ) {
				expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
				const active = work.session.getPdfStatus().activeSurfaceId;
				const member = work.session._snapshot.surfaces.find( surface => surface.id === active );
				expect( work.editor.stateManager.get( 'layers' ) ).toEqual( member.layers );
			}
		} finally { work.close(); }
	} );

	it( 'records one complete-group Undo and Redo across all pages', async () => {
		const { work, application, request } = await setup();
		try {
			const before = copy( work.session._snapshot ), { handle } = await prepared( application, request );
			const applied = await application.apply( handle );
			const after = copy( work.session._snapshot );
			expect( after ).toEqual( applied.candidateSnapshot );
			const undone = application.undo( applied.command );
			expect( undone.candidateSnapshot ).toEqual( before );
			expect( work.session._snapshot ).toEqual( before );
			const redone = application.redo( applied.command );
			expect( redone.candidateSnapshot ).toEqual( after );
			expect( work.session._snapshot ).toEqual( after );
		} finally { work.close(); }
	} );

	it( 'restores one source-group citation across Apply, Undo, and Redo', async () => {
		const { work, application, binding } = await setup();
		try {
			const { handle } = await prepared( application, options( work ) ), applied = await application.apply( handle );
			expect( binding.getImportPublication().sources ).toHaveLength( 1 );
			application.undo( applied.command );
			expect( binding.getImportPublication().sources ).toHaveLength( 0 );
			application.redo( applied.command );
			expect( binding.getImportPublication().sources ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'refuses Redo before Undo and refuses to consume one Import command twice', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), applied = await application.apply( handle );
			const before = witness( work );
			await unavailable( Promise.resolve().then( () => application.redo( applied.command ) ) );
			expect( witness( work ) ).toBe( before );
			application.undo( applied.command ); application.redo( applied.command );
			const afterRedo = witness( work );
			await unavailable( Promise.resolve().then( () => application.redo( applied.command ) ) );
			expect( witness( work ) ).toBe( afterRedo );
		} finally { work.close(); }
	} );

	it( 'keeps the current active page and its context when group Undo follows a page turn', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), applied = await application.apply( handle );
			await work.bridge.pdfCoordinator.turn( 1 );
			const active = { page: work.editor.page, surfaceId: work.session.getPdfStatus().activeSurfaceId,
				url: window.location.href, background: work.editor.canvasManager.config.backgroundImageUrl };
			application.undo( applied.command );
			expect( work.editor.page ).toBe( active.page );
			expect( work.session.getPdfStatus().activeSurfaceId ).toBe( active.surfaceId );
			expect( window.location.href ).toBe( active.url );
			expect( work.editor.canvasManager.config.backgroundImageUrl ).toBe( active.background );
		} finally { work.close(); }
	} );

	it( 'refuses group Undo after a selected-group page edit without partial restoration', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), applied = await application.apply( handle );
			await editPage( work, 1, 'Later unrelated page edit' );
			const before = witness( work );
			await unavailable( Promise.resolve().then( () => application.undo( applied.command ) ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses stale preparations after a live edit without changing that edit', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ); await editPage( work, 2, 'Late page edit' );
			const before = witness( work ); await unavailable( application.apply( handle ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses application while a selection drag is active and leaves the editor untouched', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request );
			work.editor.canvasManager.selectionManager.isDragging = true;
			const before = witness( work ); await unavailable( application.apply( handle ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses malformed fresh source evidence before changing session, display, selection, or timelines', async () => {
		const { work, application, request, api } = await setup();
		try {
			const { handle } = await prepared( application, request );
			api.post.mockImplementation( () => Promise.resolve( response( payload( work, [ 2 ], value => {
				value.sourceGroup.members[ 0 ].page = 1;
			} ) ) ) );
			const before = witness( work ); await unavailable( application.apply( handle ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'makes cancel a no-I/O no-op', async () => {
		const { work, application, request, api } = await setup();
		try {
			request.mode = 'cancel'; const before = witness( work );
			expect( await application.prepare( request ) ).toBeNull(); expect( api.post ).not.toHaveBeenCalled(); expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses accessor-backed request fields without invoking them or making a native read', async () => {
		const { work, application, request, api } = await setup();
		try {
			let getterCalled = false;
			Object.defineProperty( request, 'source', { enumerable: true, configurable: true,
				get: () => { getterCalled = true; return { pageId: 9, revisionId: 42, surfaceId: 'source-p2' }; } } );
			const before = witness( work ); await unavailable( application.prepare( request ) );
			expect( getterCalled ).toBe( false ); expect( api.post ).not.toHaveBeenCalled(); expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses invalid native group admission without opening an application handle', async () => {
		const { work, application, request, api } = await setup( [ 1, 2 ], 'append', value => {
			value.sourceGroup.members[ 1 ].surfaceId = value.sourceGroup.members[ 0 ].surfaceId;
		} );
		try {
			const before = witness( work ); await unavailable( application.prepare( request ) );
			expect( witness( work ) ).toBe( before ); expect( api.post ).toHaveBeenCalledTimes( 1 );
		} finally { work.close(); }
	} );

	it( 'refuses locked state and batched history before any editor/session commit', async () => {
		for ( const participant of [ 'locked', 'batch' ] ) {
			const { work, application, request } = await setup();
			try {
				const { handle } = await prepared( application, request );
				if ( participant === 'locked' ) { work.editor.stateManager.isLocked = true; }
				else { work.editor.historyManager.batchMode = true; }
				const snapshot = copy( work.session._snapshot ), active = work.session.getPdfStatus();
				await unavailable( application.apply( handle ) );
				expect( work.session._snapshot ).toEqual( snapshot );
				expect( work.session.getPdfStatus() ).toEqual( active );
			} finally {
				work.editor.stateManager.isLocked = false; work.editor.historyManager.batchMode = false; work.close();
			}
		}
	} );

	it( 'refuses a frozen HistoryManager slot and allows cleanup after restoring its descriptor', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), history = work.editor.historyManager;
			const descriptor = Object.getOwnPropertyDescriptor( history, 'historyIndex' );
			Object.defineProperty( history, 'historyIndex', { ...descriptor, writable: false } );
			try { await unavailable( application.apply( handle ) ); } finally { Object.defineProperty( history, 'historyIndex', descriptor ); }
			expect( work.session._snapshot ).toEqual( work.base );
		} finally { work.close(); }
	} );

	it( 'rejects foreign, released, repeated, and disposed handles', async () => {
		const first = await setup(), second = await setup();
		try {
			const { handle } = await prepared( first.application, first.request );
			const applied = await first.application.apply( handle );
			await unavailable( first.application.apply( handle ) );
			first.application.releaseCommand( applied.command );
			const own = await prepared( first.application, options( first.work ) );
			await unavailable( second.application.apply( own.handle ) );
			first.application.release( own.handle ); await unavailable( first.application.apply( own.handle ) );
			const next = await prepared( first.application, options( first.work ) ); first.application.dispose();
			await unavailable( first.application.apply( next.handle ) );
		} finally { first.work.close(); second.work.close(); }
	} );

	it( 'keeps group command tokens private to their owning application and releaseable', async () => {
		const first = await setup(), second = await setup();
		try {
			const { handle } = await prepared( first.application, first.request ), applied = await first.application.apply( handle );
			const before = witness( second.work );
			await unavailable( Promise.resolve().then( () => second.application.undo( applied.command ) ) );
			expect( witness( second.work ) ).toBe( before );
			first.application.releaseCommand( applied.command );
			await unavailable( Promise.resolve().then( () => first.application.undo( applied.command ) ) );
		} finally { first.work.close(); second.work.close(); }
	} );

	it( 'rejects same-class foreign coordinator and participant instances at construction', async () => {
		const first = await setup(), second = await setup();
		const { bridge, editor } = first.work;
		const original = { coordinator: bridge.pdfCoordinator, store: editor.stateManager, history: editor.historyManager,
			canvas: editor.canvasManager, selection: editor.canvasManager.selectionManager };
		try {
			const ownsSession = first.binding.ownsSession;
			first.binding.ownsSession = () => true;
			const session = bridge.session; bridge.session = second.work.session;
			try { expect( () => new Application( bridge, first.binding ) ).toThrow( CODE ); }
			finally { first.binding.ownsSession = ownsSession; bridge.session = session; }
			const substitutions = [
				[ () => { bridge.pdfCoordinator = second.work.bridge.pdfCoordinator; }, () => { bridge.pdfCoordinator = original.coordinator; } ],
				[ () => { editor.stateManager = second.work.editor.stateManager; }, () => { editor.stateManager = original.store; } ],
				[ () => { editor.historyManager = second.work.editor.historyManager; }, () => { editor.historyManager = original.history; } ],
				[ () => { editor.canvasManager = second.work.editor.canvasManager; }, () => { editor.canvasManager = original.canvas; } ],
				[ () => { original.canvas.selectionManager = second.work.editor.canvasManager.selectionManager; }, () => { original.canvas.selectionManager = original.selection; } ]
			];
			for ( const [ substitute, restore ] of substitutions ) {
				try { substitute(); expect( () => new Application( bridge, first.binding ) ).toThrow( CODE ); }
				finally { restore(); }
			}
		} finally {
			bridge.pdfCoordinator = original.coordinator; editor.stateManager = original.store; editor.historyManager = original.history;
			editor.canvasManager = original.canvas; original.canvas.selectionManager = original.selection;
			first.work.close(); second.work.close();
		}
	} );

	it( 'revalidates the whole source read at apply time and leaves state intact on changed evidence', async () => {
		const { work, application, request, api } = await setup();
		try {
			const { handle } = await prepared( application, request ), before = witness( work );
			api.post.mockImplementation( () => Promise.resolve( response( payload( work, [ 2 ], value => { value.sourceGroup.pageCount = 1; } ) ) ) );
			await unavailable( application.apply( handle ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'serializes concurrent apply calls while fresh source evidence is pending', async () => {
		const { work, application, request, api } = await setup();
		try {
			const { handle } = await prepared( application, request );
			let release; api.post.mockImplementation( () => new Promise( resolve => { release = resolve; } ) );
			const first = application.apply( handle ); await Promise.resolve();
			await unavailable( application.apply( handle ) );
			release( response( payload( work ) ) ); await first;
			expect( work.session._snapshot.surfaces.some( member => member.id === 'anchor' ) ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'refuses pending application after disposal and makes no partial change', async () => {
		const { work, application, request, api } = await setup();
		try {
			const { handle } = await prepared( application, request ), before = witness( work );
			let release; api.post.mockImplementation( () => new Promise( resolve => { release = resolve; } ) );
			const applying = application.apply( handle ); await Promise.resolve(); application.dispose();
			release( response( payload( work ) ) ); await unavailable( applying );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'preserves unrelated snapshot metadata and other-file layer edits across group Undo', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), applied = await application.apply( handle );
			work.session._snapshot.metadata.externalNote = { retained: true };
			const other = work.session._snapshot.surfaces.find( member => member.id === 'other-file' );
			other.layers.push( textLayer( 'unrelated-edit', 'Keep unrelated edit' ) );
			application.undo( applied.command );
			expect( work.session._snapshot.metadata.externalNote ).toEqual( { retained: true } );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'other-file' ).layers )
				.toContainEqual( textLayer( 'unrelated-edit', 'Keep unrelated edit' ) );
		} finally { work.close(); }
	} );

	it( 'refuses Undo after an offscreen selected-group member changes without a history entry', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), applied = await application.apply( handle );
			const page1 = work.session._snapshot.surfaces.find( member => member.kind === 'pdf' &&
				member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 );
			page1.layers.push( textLayer( 'offscreen-change' ) );
			const before = witness( work ); await unavailable( Promise.resolve().then( () => application.undo( applied.command ) ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'detaches inspection and returned snapshots from live state', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle, preview } = await prepared( application, request );
			preview.candidateSnapshot.surfaces.length = 0;
			const second = application.inspect( handle ); expect( second.candidateSnapshot.surfaces.length ).toBeGreaterThan( 0 );
			const result = await application.apply( handle ); result.candidateSnapshot.surfaces.length = 0;
			expect( work.session._snapshot.surfaces.length ).toBeGreaterThan( 0 );
		} finally { work.close(); }
	} );

	it( 'does not change ordinary HistoryManager routing or invoke Save', async () => {
		const { work, application, request } = await setup();
		try {
			const undo = work.editor.historyManager.undo, redo = work.editor.historyManager.redo;
			const { handle } = await prepared( application, request ); await application.apply( handle );
			expect( work.editor.historyManager.undo ).toBe( undo ); expect( work.editor.historyManager.redo ).toBe( redo );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it( 'preserves unrelated file members and metadata in the applied full snapshot', async () => {
		const { work, application, request } = await setup();
		try {
			const unrelated = copy( work.session._snapshot.surfaces.find( member => member.id === 'other-file' ) );
			const metadata = copy( work.session._snapshot.metadata );
			const { handle } = await prepared( application, request ), result = await application.apply( handle );
			expect( result.candidateSnapshot.surfaces.find( member => member.id === 'other-file' ) ).toEqual( unrelated );
			expect( result.candidateSnapshot.metadata ).toEqual( metadata );
		} finally { work.close(); }
	} );

	it( 'keeps selection valid for the committed active page without selecting offscreen layer IDs', async () => {
		const { work, application, request } = await setup();
		try {
			const { handle } = await prepared( application, request ), result = await application.apply( handle );
			const selected = work.editor.canvasManager.selectionManager.selectedLayerIds;
			const activeIds = new Set( result.editorState.layers.map( layer => layer.id ) );
			expect( selected.every( id => activeIds.has( id ) ) ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'reports post-commit rendering failure while retaining the complete committed result', async () => {
		const { work, application, request } = await setup();
		const canvas = work.editor.canvasManager, original = canvas.renderLayers;
		try {
			canvas.renderLayers = () => { throw new Error( 'render unavailable' ); };
			const { handle, preview } = await prepared( application, request ), result = await application.apply( handle );
			expect( result.candidateSnapshot ).toEqual( preview.candidateSnapshot );
			expect( work.session._snapshot ).toEqual( preview.candidateSnapshot );
			expect( result.diagnostics.length ).toBeGreaterThan( 0 );
		} finally { canvas.renderLayers = original; work.close(); }
	} );
} );
