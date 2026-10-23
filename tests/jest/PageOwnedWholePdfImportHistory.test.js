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

const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );

async function applyImport( work, application, request ) {
	const handle = await application.prepare( request );
	return application.apply( handle );
}

function enableHistory( work, application ) {
	application.enableHistory();
	expect( work.editor.historyManager.hasPdfImportHistory( application ) ).toBe( true );
}

describe( 'PageOwnedWholePdfImportHistory', () => {
	it( 'leaves ordinary per-page history unchanged until explicit opt-in', async () => {
		const { work, application } = await setup();
		try {
			const history = work.editor.historyManager, before = copy( history.captureTimeline() );
			expect( history.hasPdfImportHistory( application ) ).toBe( false );
			work.edit( 'ordinary edit' );
			expect( history.undo() ).toBe( true ); expect( history.redo() ).toBe( true );
			expect( history.hasPdfImportHistory( application ) ).toBe( false );
			expect( history.captureTimeline().maxHistorySteps ).toBe( before.maxHistorySteps );
		} finally { work.close(); }
	} );

	it( 'registers only through the explicit application opt-in', async () => {
		const { work, application } = await setup();
		try {
			expect( work.editor.historyManager ).toBeInstanceOf( HistoryManager );
			expect( work.editor.historyManager.hasPdfImportHistory( application ) ).toBe( false );
			expect( application.enableHistory() ).toBeUndefined();
			expect( work.editor.historyManager.hasPdfImportHistory( application ) ).toBe( true );
			expect( work.editor.historyManager.hasPdfImportHistory() ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'refuses route registration after the HistoryManager is associated with another editor', async () => {
		const first = await setup(), second = await setup();
		const history = first.work.editor.historyManager, owner = history.editor;
		try {
			history.editor = second.work.editor;
			expect( () => first.application.enableHistory() ).toThrow( CODE );
			expect( history.hasPdfImportHistory( first.application ) ).toBe( false );
		} finally { history.editor = owner; first.work.close(); second.work.close(); }
	} );

	it( 'refuses to attach an application to a replacement HistoryManager', async () => {
		const first = await setup(), second = await setup();
		const editor = first.work.editor, original = editor.historyManager;
		try {
			editor.historyManager = second.work.editor.historyManager;
			expect( () => first.application.enableHistory() ).toThrow( CODE );
			expect( second.work.editor.historyManager.hasPdfImportHistory( first.application ) ).toBe( false );
		} finally { editor.historyManager = original; first.work.close(); second.work.close(); }
	} );

	it( 'rejects forged history routes and does not install them', async () => {
		const { work, application } = await setup();
		try {
			const history = work.editor.historyManager;
			let error; try { history.enablePdfImportHistory( application, {} ); } catch ( caught ) { error = caught; }
			expect( error ).toBeInstanceOf( Error );
			expect( error.code ).toBe( 'layers-working-copy-history-unavailable' );
			expect( error.message ).toBe( 'Working-copy history unavailable' );
			expect( history.hasPdfImportHistory( application ) ).toBe( false );
			expect( Application.isPdfImportHistoryRoute( {} ) ).toBe( false );
		} finally { work.close(); }
	} );

	it( 'writes internal page-specific group markers only after opted-in Import', async () => {
		const { work, application, request } = await setup();
		try {
			const history = work.editor.historyManager;
			expect( history.captureTimeline().history.some( state => state.pdfImportGroup ) ).toBe( false );
			enableHistory( work, application ); await applyImport( work, application, request );
			const active = history.captureTimeline().history[ history.historyIndex ].pdfImportGroup;
			const offscreen = work.bridge.pdfCoordinator.timelines.get( 1 ).history.slice(-1)[ 0 ].pdfImportGroup;
			expect( active ).toEqual( { id: expect.stringMatching( /^[a-f0-9]{32}$/ ), page: 2 } );
			expect( offscreen ).toEqual( { id: active.id, page: 1 } );
		} finally { work.close(); }
	} );

	it( 'refreshes existing Undo and Redo buttons immediately after applying a saved-editor Import', async () => {
		const { work, application, request } = await setup();
		try {
			const updateUndoRedoState = jest.fn();
			work.editor.toolbar = { updateUndoRedoState };
			enableHistory( work, application );
			await applyImport( work, application, request );
			expect( updateUndoRedoState ).toHaveBeenLastCalledWith( true, false );
		} finally { work.close(); }
	} );

	it( 'routes one Undo at the Import boundary to the complete group', async () => {
		const { work, application, request } = await setup();
		try {
			const before = copy( work.session._snapshot ); enableHistory( work, application );
			await applyImport( work, application, request );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.session._snapshot ).toEqual( before );
			expect( work.bridge.pdfCoordinator.timelines.get( 1 ).historyIndex ).toBe( 0 );
		} finally { work.close(); }
	} );

	it( 'routes Redo from the group boundary to all affected pages', async () => {
		const { work, application, request } = await setup();
		try {
			const before = copy( work.session._snapshot ); enableHistory( work, application );
			await applyImport( work, application, request ); const imported = copy( work.session._snapshot );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session._snapshot ).toEqual( imported ); expect( work.session._snapshot ).not.toEqual( before );
		} finally { work.close(); }
	} );

	it( 'keeps same-page later edits on native per-page Undo before the group boundary', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			work.edit( 'later same-page edit' ); work.bridge.capture();
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'source-layer-2' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text ).toBe( 'Page 2' );
		} finally { work.close(); }
	} );

	it( 'keeps same-page later Redo entries when the group is undone and redone', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			work.edit( 'later edit' ); work.bridge.capture();
			work.editor.historyManager.undo(); work.editor.historyManager.undo();
			expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text ).toBe( 'Page 2' );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) ).toContain( 'source-layer-2' );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'later edit' );
		} finally { work.close(); }
	} );

	it( 'blocks group Undo while another page has later work, then permits it after that work is undone', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			await editPage( work, 1, 'offscreen later edit' ); await work.bridge.pdfCoordinator.turn( 2 );
			const before = witness( work ); expect( work.editor.historyManager.undo() ).toBe( false );
			expect( witness( work ) ).toBe( before );
			await work.bridge.pdfCoordinator.turn( 1 ); expect( work.editor.historyManager.undo() ).toBe( true );
			await work.bridge.pdfCoordinator.turn( 2 ); expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text ).toBe( 'Page 2' );
		} finally { work.close(); }
	} );

	it( 'preserves active PDF page, URL, and background across group Undo', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			await work.bridge.pdfCoordinator.turn( 1 );
			const active = { page: work.editor.page, url: window.location.href, image: work.editor.canvasManager.config.backgroundImageUrl };
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.page ).toBe( active.page ); expect( window.location.href ).toBe( active.url );
			expect( work.editor.canvasManager.config.backgroundImageUrl ).toBe( active.image );
		} finally { work.close(); }
	} );

	it( 'keeps group Undo markers through PDF page turns and timeline capture/restore', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const timeline = work.editor.historyManager.captureTimeline();
			work.editor.historyManager.restoreTimeline( timeline );
			await work.bridge.pdfCoordinator.turn( 1 ); await work.bridge.pdfCoordinator.turn( 2 );
			expect( work.editor.historyManager.undo() ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'supports Undo from the admitted empty page after navigation', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			await work.bridge.pdfCoordinator.turn( 1 );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.session._snapshot.surfaces.some( member => member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 ) ).toBe( false );
		} finally { work.close(); }
	} );

	it( 'orders multiple group Imports as one LIFO sequence', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const one = copy( work.session._snapshot ); await applyImport( work, application, options( work ) );
			const two = copy( work.session._snapshot );
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.session._snapshot ).toEqual( one );
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers ).toEqual( work.base.surfaces.find( member => member.id === 'anchor' ).layers );
			expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.session._snapshot ).toEqual( one );
			expect( work.editor.historyManager.redo() ).toBe( true ); expect( work.session._snapshot ).toEqual( two );
		} finally { work.close(); }
	} );

	it( 'does not redo a group after a new edit branches from group Undo', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			work.editor.historyManager.undo(); work.edit( 'branch after undo' ); work.bridge.capture();
			const before = copy( work.session._snapshot );
			expect( work.editor.historyManager.canRedo() ).toBe( false );
			expect( work.editor.historyManager.redo() ).toBe( false );
			expect( work.session._snapshot ).toEqual( before );
		} finally { work.close(); }
	} );

	it( 'reports group boundary Undo and Redo availability to existing controls', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			expect( work.editor.historyManager.canUndo() ).toBe( true );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.canRedo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'never falls back to partial Undo for an unknown raw marker', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const current = work.editor.historyManager.history[ work.editor.historyManager.historyIndex ];
			const original = current.pdfImportGroup; current.pdfImportGroup = { id: 'f'.repeat( 32 ), page: 2 };
			const before = copy( work.session._snapshot ); expect( work.editor.historyManager.undo() ).toBe( false );
			expect( work.session._snapshot ).toEqual( before ); current.pdfImportGroup = original;
		} finally { work.close(); }
	} );

	it( 'never falls back to page-only Undo after application disposal', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const before = copy( work.session._snapshot ); application.dispose();
			expect( work.editor.historyManager.undo() ).toBe( false ); expect( work.session._snapshot ).toEqual( before );
		} finally { work.close(); }
	} );

	it( 'refuses direct restoreState across the group boundary before changing the index', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const history = work.editor.historyManager, index = history.historyIndex, target = history.history[ index - 1 ];
			expect( history.restoreState( target ) ).toBe( false ); expect( history.historyIndex ).toBe( index );
		} finally { work.close(); }
	} );

	it( 'refuses restoreTimeline across group phase before changing live state', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const history = work.editor.historyManager, before = witness( work ), timeline = history.captureTimeline();
			timeline.historyIndex--;
			let error; try { history.restoreTimeline( timeline ); } catch ( caught ) { error = caught; }
			expect( error ).toBeInstanceOf( Error ); expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses revertTo jumps across an Import marker before changing the index', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const history = work.editor.historyManager, index = history.historyIndex;
			expect( history.revertTo( index - 1 ) ).toBe( false ); expect( history.historyIndex ).toBe( index );
		} finally { work.close(); }
	} );

	it( 'does not enable the PDF route while HistoryManager is in a batch', async () => {
		const { work, application } = await setup();
		try {
			work.editor.historyManager.batchMode = true;
			expect( () => application.enableHistory() ).toThrow( CODE );
			expect( work.editor.historyManager.hasPdfImportHistory( application ) ).toBe( false );
		} finally { work.editor.historyManager.batchMode = false; work.close(); }
	} );

	it( 'preserves an ordinary redo tail on another page through group Undo and Redo', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			await editPage( work, 1, 'offscreen redo tail' ); expect( work.editor.historyManager.undo() ).toBe( true );
			const timeline = work.editor.historyManager.captureTimeline();
			expect( timeline.historyIndex ).toBeLessThan( timeline.history.length - 1 );
			await work.bridge.pdfCoordinator.turn( 2 );
			expect( work.editor.historyManager.undo() ).toBe( true ); expect( work.editor.historyManager.redo() ).toBe( true );
			await work.bridge.pdfCoordinator.turn( 1 );
			expect( work.editor.historyManager.canRedo() ).toBe( true ); expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'offscreen redo tail' );
		} finally { work.close(); }
	} );

	it( 'leaves ordinary Undo available for edits before the Import marker', async () => {
		const { work, application, request } = await setup();
		try {
			work.edit( 'pre-import edit' ); work.bridge.capture();
			enableHistory( work, application ); await applyImport( work, application, request );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text ).toBe( 'pre-import edit' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toEqual( [ 'Page 2' ] );
		} finally { work.close(); }
	} );

	it( 'does not partially traverse a marker when the active history is trimmed', async () => {
		const { work, application, request } = await setup();
		try {
			const base = copy( work.session._snapshot ); enableHistory( work, application ); await applyImport( work, application, request );
			const imported = copy( work.session._snapshot ); work.editor.historyManager.setMaxHistorySteps( 1 );
			const result = work.editor.historyManager.undo();
			expect( [ true, false ] ).toContain( result );
			expect( work.session._snapshot ).toEqual( result ? base : imported );
		} finally { work.close(); }
	} );

	it( 'does not allow history compression to perform partial group Undo', async () => {
		const { work, application, request } = await setup();
		try {
			const base = copy( work.session._snapshot ); enableHistory( work, application ); await applyImport( work, application, request );
			const imported = copy( work.session._snapshot ); work.editor.historyManager.compressHistory();
			const result = work.editor.historyManager.undo();
			expect( [ true, false ] ).toContain( result );
			expect( work.session._snapshot ).toEqual( result ? base : imported );
		} finally { work.close(); }
	} );

	it( 'makes a cleared timeline unable to trigger partial page Undo', async () => {
		const { work, application, request } = await setup();
		try {
			const base = copy( work.session._snapshot ); enableHistory( work, application ); await applyImport( work, application, request );
			const imported = copy( work.session._snapshot ); work.editor.historyManager.clearHistory();
			const result = work.editor.historyManager.undo(); expect( [ true, false ] ).toContain( result );
			expect( work.session._snapshot ).toEqual( result ? base : imported );
		} finally { work.close(); }
	} );

	it( 'blocks group Undo when one offscreen member history is trimmed or cleared', async () => {
		for ( const operation of [ 'trim', 'clear' ] ) {
			const { work, application, request } = await setup();
			try {
				enableHistory( work, application ); await applyImport( work, application, request );
				await work.bridge.pdfCoordinator.turn( 1 );
				if ( operation === 'trim' ) { work.editor.historyManager.setMaxHistorySteps( 1 ); }
				else { work.editor.historyManager.clearHistory(); }
				await work.bridge.pdfCoordinator.turn( 2 );
				const before = copy( work.session._snapshot );
				expect( work.editor.historyManager.undo() ).toBe( false );
				expect( work.session._snapshot ).toEqual( before );
			} finally { work.close(); }
		}
	} );

	it( 'refuses a malformed unvisited PDF timeline before changing the active page or display', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const target = work.bridge.pdfCoordinator.timelines.get( 1 );
			target.history[ target.history.length - 1 ].pdfImportGroup.id = 'bad-group-id';
			const before = { snapshot: copy( work.session._snapshot ), page: work.editor.page,
				active: work.session.getPdfStatus().activeSurfaceId, url: window.location.href,
				image: work.editor.canvasManager.config.backgroundImageUrl,
				layers: copy( work.editor.stateManager.get( 'layers' ) ) };
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( false );
			expect( work.session._snapshot ).toEqual( before.snapshot ); expect( work.editor.page ).toBe( before.page );
			expect( work.session.getPdfStatus().activeSurfaceId ).toBe( before.active );
			expect( window.location.href ).toBe( before.url );
			expect( work.editor.canvasManager.config.backgroundImageUrl ).toBe( before.image );
			expect( work.editor.stateManager.get( 'layers' ) ).toEqual( before.layers );
		} finally { work.close(); }
	} );

	it( 'keeps released group command markers behind an atomic refusal barrier', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application );
			const result = await applyImport( work, application, request ), before = copy( work.session._snapshot );
			application.releaseCommand( result.command );
			expect( work.editor.historyManager.undo() ).toBe( false );
			expect( work.session._snapshot ).toEqual( before );
		} finally { work.close(); }
	} );

	it( 'does not report opt-in success if a replaced HistoryManager registrar fails to install the route', async () => {
		const { work, application } = await setup();
		const history = work.editor.historyManager, original = history.enablePdfImportHistory;
		try {
			history.enablePdfImportHistory = jest.fn();
			let failed = false; try { application.enableHistory(); } catch ( error ) { failed = true; }
			if ( failed ) { expect( history.hasPdfImportHistory( application ) ).toBe( false ); }
			else { expect( history.hasPdfImportHistory( application ) ).toBe( true ); }
		} finally { history.enablePdfImportHistory = original; work.close(); }
	} );

	it( 'allows ordinary per-page history to continue after group Redo', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			work.editor.historyManager.undo(); work.editor.historyManager.redo();
			work.edit( 'ordinary after redo' ); work.bridge.capture();
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) ).toContain( 'source-layer-2' );
		} finally { work.close(); }
	} );

	it( 'reports no PDF group route for a different application instance', async () => {
		const first = await setup(), second = await setup();
		try {
			enableHistory( first.work, first.application );
			expect( first.work.editor.historyManager.hasPdfImportHistory( second.application ) ).toBe( false );
			expect( second.work.editor.historyManager.hasPdfImportHistory( first.application ) ).toBe( false );
		} finally { first.work.close(); second.work.close(); }
	} );

	it( 'keeps route and markers isolated from unregistered editor instances', async () => {
		const first = await setup(), second = await setup();
		try {
			enableHistory( first.work, first.application ); await applyImport( first.work, first.application, first.request );
			expect( second.work.editor.historyManager.hasPdfImportHistory( second.application ) ).toBe( false );
			expect( second.work.editor.historyManager.undo() ).toBe( false );
			expect( first.work.editor.historyManager.undo() ).toBe( true );
		} finally { first.work.close(); second.work.close(); }
	} );

	it( 'keeps ordinary Undo and Redo usable after trimming the Import marker', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const importedPageOne = copy( work.session._snapshot.surfaces.find( surface => surface.kind === 'pdf' && surface.source.page === 1 ) );
			await work.bridge.pdfCoordinator.turn( 2 );
			const history = work.editor.historyManager; history.setMaxHistorySteps( 3 );
			for ( let index = 1; index <= 3; index++ ) { work.edit( 'trim history ' + index ); work.bridge.capture(); }
			expect( history.captureTimeline().history.some( entry => entry.pdfImportGroup ) ).toBe( false );
			expect( history.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'trim history 2' );
			expect( work.session._snapshot.surfaces.find( surface => surface.id === importedPageOne.id ) ).toEqual( importedPageOne );
			expect( history.redo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'trim history 3' );
			expect( work.session._snapshot.surfaces.find( surface => surface.id === importedPageOne.id ) ).toEqual( importedPageOne );
		} finally { work.close(); }
	} );

	it( 'keeps ordinary branch Undo usable and refuses stale group Redo on another page', async () => {
		const { work, application, request } = await setup();
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			expect( work.editor.historyManager.undo() ).toBe( true );
			work.edit( 'branch after group Undo' ); work.bridge.capture();
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toEqual( [ 'Page 2' ] );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			const beforeRedo = copy( work.session._snapshot );
			expect( work.editor.historyManager.redo() ).toBe( false );
			expect( work.session._snapshot ).toEqual( beforeRedo );
		} finally { work.close(); }
	} );

	it( 'releases both private checkpoints when trimming retires an Import command', async () => {
		const { work, application, request, binding } = await setup();
		const release = jest.spyOn( binding, 'releaseImportCheckpoint' );
		try {
			enableHistory( work, application ); await applyImport( work, application, request );
			const beforeTrim = release.mock.calls.length;
			await work.bridge.pdfCoordinator.turn( 2 );
			const history = work.editor.historyManager; history.setMaxHistorySteps( 3 );
			for ( let index = 1; index <= 3; index++ ) { work.edit( 'checkpoint trim ' + index ); work.bridge.capture(); }
			expect( history.captureTimeline().history.some( entry => entry.pdfImportGroup ) ).toBe( false );
			expect( release.mock.calls.length - beforeTrim ).toBe( 2 );
		} finally { release.mockRestore(); work.close(); }
	} );
} );
