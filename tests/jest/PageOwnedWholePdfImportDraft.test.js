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

async function applyImport( work, application, request ) {
	const handle = await application.prepare( request );
	return application.apply( handle );
}

function enableHistory( work, application ) {
	application.enableHistory();
	expect( work.editor.historyManager.hasPdfImportHistory( application ) ).toBe( true );
}

describe( 'PageOwnedWholePdfImportDraft capture', () => {
	async function imported( pages = [ 1, 2 ], mode = 'append', tweak = () => {} ) {
		const value = await setup( pages, mode, tweak );
		enableHistory( value.work, value.application );
		value.result = await applyImport( value.work, value.application, value.request );
		return value;
	}
	function capture( application ) { return application.captureDraft(); }
	function texts( timeline ) { return timeline.history.flatMap( entry => entry.layers.map( layer => layer.text ) ); }

	it( 'captures the initial PDF session without Import groups', async () => {
		const { work, application } = await setup();
		try {
			application.enableHistory();
			const value = capture( application );
			expect( value ).toMatchObject( { format: 'layers-whole-pdf-import-draft', version: 1 } );
			expect( value.session.sources ).toEqual( [] );
			expect( value.history.groups ).toEqual( [] );
			expect( value.history.activePage ).toBe( 2 );
		} finally { work.close(); }
	} );

	it( 'retains whole-PDF Import source citations', async () => {
		const { work, application, binding } = await imported();
		try {
			const captured = capture( application );
			expect( captured.session.sources ).toEqual( binding.getImportPublication().sources );
			expect( captured.session.sources ).toHaveLength( 1 );
			expect( captured.session.sources[ 0 ] ).toMatchObject( {
				targetSurfaceId: 'anchor', sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source-p2'
			} );
		} finally { work.close(); }
	} );

	it( 'retains offscreen page history', async () => {
		const { work, application } = await imported();
		try {
			await editPage( work, 1, 'offscreen persisted edit' );
			await work.bridge.pdfCoordinator.turn( 2 );
			const captured = capture( application );
			const pageOne = captured.history.timelines.find( item => item.page === 1 );
			expect( pageOne ).toBeDefined();
			expect( texts( pageOne.timeline ) ).toContain( 'offscreen persisted edit' );
			const anchor = captured.session.snapshot.surfaces.find( member => member.id === captured.session.scope.surfaceId );
			const pageOneMember = captured.session.snapshot.surfaces.find( member => member.kind === 'pdf' &&
				member.label === anchor.label && member.source.fileTitle === anchor.source.fileTitle && member.source.page === 1 );
			expect( pageOneMember.layers.map( layer => layer.text ) )
				.toContain( 'offscreen persisted edit' );
		} finally { work.close(); }
	} );

	it( 'retains both complete-group checkpoints', async () => {
		const { work, application, binding, result } = await imported();
		try {
			const group = capture( application ).history.groups[ 0 ];
			expect( group.checkpoints.before ).toEqual( binding.inspectImportCheckpoint( result.beforeCheckpoint ) );
			expect( group.checkpoints.after ).toEqual( binding.inspectImportCheckpoint( result.checkpoint ) );
			expect( group.checkpoints.before.snapshot.surfaces.find( member => member.id === 'anchor' ).layers )
				.toEqual( work.base.surfaces.find( member => member.id === 'anchor' ).layers );
			expect( group.checkpoints.after.snapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) )
				.toContain( 'source-layer-2' );
			expect( group.checkpoints.after.sources ).toEqual( capture( application ).session.sources );
		} finally { work.close(); }
	} );

	it( 'captures complete session maps and active PDF context as JSON data', async () => {
		const { work, application } = await imported();
		try {
			const captured = JSON.parse( JSON.stringify( capture( application ) ) );
			expect( Array.isArray( captured.session.temporary ) ).toBe( true );
			expect( Array.isArray( captured.session.admissions ) ).toBe( true );
			expect( captured.session.pdf.activeSurfaceId ).toBe( work.session.getPdfStatus().activeSurfaceId );
			expect( captured.session.pdf.page ).toBe( work.session.getPdfStatus().page );
			expect( captured.session.scope ).toMatchObject( { owner: 'Owner', pageId: 7, baseRevisionId: 12, surfaceId: 'anchor' } );
		} finally { work.close(); }
	} );

	it( 'captures complete page membership for a sparse append', async () => {
		const { work, application } = await imported( [ 1, 2 ], 'append' );
		try {
			const captured = capture( application );
			const anchor = captured.session.snapshot.surfaces.find( member => member.id === captured.session.scope.surfaceId );
			const members = captured.session.snapshot.surfaces.filter( member => member.kind === 'pdf' &&
				member.label === anchor.label && member.source.fileTitle === anchor.source.fileTitle );
			expect( members.map( member => member.source.page ).sort() )
				.toEqual( [ 1, 2 ] );
			expect( captured.session.admissionRevisions ).toEqual( captured.session.admissions.filter( ( [ , record ] ) =>
				record.revisionId < captured.session.scope.baseRevisionId ).map( ( [ , record ] ) =>
				( { surfaceId: record.surface.id, revisionId: record.revisionId } ) ) );
		} finally { work.close(); }
	} );

	it( 'captures replacement state including a deliberately empty imported page', async () => {
		const { work, application } = await imported( [ 1, 2 ], 'replace', result => {
			result.sourceBundle.snapshot.surfaces.find( member => member.source.page === 1 ).layers = [];
		} );
		try {
			const captured = capture( application );
			const anchor = captured.session.snapshot.surfaces.find( member => member.id === captured.session.scope.surfaceId );
			const importedPage = captured.session.snapshot.surfaces.find( member => member.kind === 'pdf' &&
				member.label === anchor.label && member.source.fileTitle === anchor.source.fileTitle && member.source.page === 1 );
			expect( importedPage ).toBeDefined();
			expect( importedPage.layers ).toEqual( [] );
			expect( captured.session.snapshot.surfaces.some( member => member.kind === 'pdf' && member.source.page === 2 ) ).toBe( true );
			expect( captured.session.snapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) )
				.toContain( 'source-layer-2' );
			expect( captured.history.groups[ 0 ].phase ).toBe( 'after' );
		} finally { work.close(); }
	} );

	it( 'captures the complete group after Undo and Redo with the current phase', async () => {
		const { work, application } = await imported();
		try {
			const history = work.editor.historyManager;
			expect( history.undo() ).toBe( true );
			expect( capture( application ).history.groups[ 0 ].phase ).toBe( 'before' );
			expect( history.redo() ).toBe( true );
			expect( capture( application ).history.groups[ 0 ].phase ).toBe( 'after' );
		} finally { work.close(); }
	} );

	it( 'captures separate complete checkpoints for multiple Imports', async () => {
		const { work, application } = await imported();
		try {
			const second = options( work, 'append' );
			await applyImport( work, application, second );
			const groups = capture( application ).history.groups;
			expect( groups ).toHaveLength( 2 );
			expect( groups[ 0 ].id ).not.toBe( groups[ 1 ].id );
			expect( groups.every( group => group.checkpoints.before && group.checkpoints.after ) ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'captures replacement source claims without retaining superseded append claims', async () => {
		const { work, application, api } = await imported();
		const original = api.post.getMockImplementation();
		try {
			api.post.mockImplementation( () => Promise.resolve( response( payload( work, [ 1, 2 ], result => {
				result.source.revisionId = 43;
				result.sourceBundle.revisionId = 43;
			} ) ) ) );
			const replacement = options( work, 'replace' ); replacement.source.revisionId = 43;
			await applyImport( work, application, replacement );
			const captured = capture( application );
			expect( captured.history.groups ).toHaveLength( 2 );
			expect( captured.session.sources ).toEqual( [ { targetSurfaceId: 'anchor', sourcePageId: 9,
				sourceRevisionId: 43, sourceSurfaceId: 'source-p2' } ] );
		} finally { api.post.mockImplementation( original ); work.close(); }
	} );

	it( 'deduplicates repeated citations for the same source group', async () => {
		const { work, application } = await imported();
		try {
			await applyImport( work, application, options( work, 'append' ) );
			expect( capture( application ).session.sources ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'returns detached JSON data without opaque command or checkpoint tokens', async () => {
		const { work, application, binding, result } = await imported();
		try {
			const captured = capture( application ), serialized = JSON.stringify( captured );
			expect( serialized ).not.toContain( 'beforeCheckpoint' );
			expect( serialized ).not.toContain( 'checkpointToken' );
			expect( serialized ).not.toContain( 'command' );
			captured.session.snapshot.surfaces[ 0 ].layers.push( textLayer( 'mutated-capture' ) );
			captured.history.groups[ 0 ].checkpoints.after.snapshot.surfaces[ 0 ].layers.push( textLayer( 'mutated-checkpoint' ) );
			expect( binding.inspectImportCheckpoint( result.checkpoint ) ).not.toEqual( captured.history.groups[ 0 ].checkpoints.after );
			expect( work.session._snapshot.surfaces.some( member => member.layers.some( layer => layer.id === 'mutated-capture' ) ) ).toBe( false );
		} finally { work.close(); }
	} );

	it( 'does not mutate editor state or call the API while capturing', async () => {
		const { work, application, api } = await imported();
		try {
			const before = witness( work ), calls = api.post.mock.calls.length;
			capture( application );
			expect( witness( work ) ).toBe( before );
			expect( api.post ).toHaveBeenCalledTimes( calls );
		} finally { work.close(); }
	} );

	it( 'refuses to capture before history is explicitly enabled', async () => {
		const { work, application } = await setup();
		try { expect( () => capture( application ) ).toThrow( CODE ); } finally { work.close(); }
	} );

	it( 'refuses calls through a forged application receiver', async () => {
		const { work, application } = await imported();
		try { expect( () => application.captureDraft.call( {} ) ).toThrow( CODE ); } finally { work.close(); }
	} );

	it( 'refuses capture through a forged session-binding receiver', async () => {
		const { work, application, binding } = await imported();
		try {
			expect( () => binding.captureImportDraft.call( {} ) ).toThrow( CODE );
			expect( capture( application ).session.scope.surfaceId ).toBe( 'anchor' );
		} finally { work.close(); }
	} );

	it( 'refuses capture while an Import commit is awaiting fresh native validation', async () => {
		const { work, application, api, request } = await setup();
		application.enableHistory();
		const handle = await application.prepare( request );
		let resolveStarted, resolveResponse, firstCall = true;
		const started = new Promise( resolve => { resolveStarted = resolve; } );
		api.post.mockImplementation( () => {
			if ( firstCall ) {
				firstCall = false; resolveStarted();
				return new Promise( resolve => { resolveResponse = resolve; } );
			}
			return Promise.resolve( response( payload( work ) ) );
		} );
		try {
			const applying = application.apply( handle );
			await started;
			expect( () => capture( application ) ).toThrow( CODE );
			resolveResponse( response( payload( work ) ) );
			expect( await applying ).toBeDefined();
		} finally { work.close(); }
	} );

	it( 'refuses capture after the history manager is destroyed', async () => {
		const { work, application } = await imported();
		const history = work.editor.historyManager, destroyed = history.isDestroyed;
		try {
			history.isDestroyed = true;
			expect( () => capture( application ) ).toThrow( CODE );
		} finally { history.isDestroyed = destroyed; work.close(); }
	} );

	it( 'refuses a session mutation during capture and returns no partial record', async () => {
		const { work, application, binding } = await imported();
		const originalMethod = binding.captureImportDraft, methodDescriptor = Object.getOwnPropertyDescriptor( binding, 'captureImportDraft' );
		const saved = copy( work.session._snapshot );
		try {
			binding.captureImportDraft = function () {
				const result = originalMethod.call( this );
				work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers[ 0 ].text = 'changed during capture';
				return result;
			};
			expect( () => capture( application ) ).toThrow( CODE );
		} finally {
			if ( methodDescriptor ) { Object.defineProperty( binding, 'captureImportDraft', methodDescriptor ); }
			else { delete binding.captureImportDraft; }
			work.session._snapshot = saved;
			work.close();
		}
	} );

	it( 'refuses unsynchronized live edits without changing them', async () => {
		const { work, application } = await imported();
		try {
			work.editor.stateManager.get( 'layers' )[ 0 ].text = 'uncaptured live edit';
			const live = copy( work.bridge.getLiveState() );
			expect( () => capture( application ) ).toThrow( CODE );
			expect( work.bridge.getLiveState() ).toEqual( live );
		} finally { work.close(); }
	} );

	it( 'refuses a changed saved base without changing the PDF session', async () => {
		const { work, application } = await imported();
		const saved = work.session._savedJson;
		try {
			work.session._savedJson = JSON.stringify( { schemaVersion: 1, surfaces: [] } );
			const snapshot = copy( work.session._snapshot );
			expect( () => capture( application ) ).toThrow( CODE );
			expect( work.session._snapshot ).toEqual( snapshot );
		} finally { work.session._savedJson = saved; work.close(); }
	} );

	it( 'refuses unknown or modified history markers rather than exporting unowned state', async () => {
		const { work, application } = await imported();
		try {
			const state = work.editor.historyManager.history[ work.editor.historyManager.historyIndex ];
			const original = state.pdfImportGroup;
			state.pdfImportGroup = { id: 'f'.repeat( 32 ), page: 2 };
			expect( () => capture( application ) ).toThrow( CODE );
			state.pdfImportGroup = original;
			expect( capture( application ).history.groups ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'refuses missing page timelines for a retained group marker', async () => {
		const { work, application } = await imported();
		const timeline = work.bridge.pdfCoordinator.timelines.get( 1 );
		try {
			work.bridge.pdfCoordinator.timelines.delete( 1 );
			expect( () => capture( application ) ).toThrow( CODE );
		} finally { work.bridge.pdfCoordinator.timelines.set( 1, timeline ); work.close(); }
	} );

	it( 'captures a retired marker only as a checkpoint-free refusal barrier', async () => {
		const { work, application } = await imported();
		try {
			const id = capture( application ).history.groups[ 0 ].id;
			work.editor.historyManager.setMaxHistorySteps( 1 );
			const retired = capture( application ).history.groups.find( group => group.id === id );
			expect( retired ).toMatchObject( { retired: true, checkpoints: null, timelines: null } );
			expect( retired.entries.length ).toBeGreaterThan( 0 );
		} finally { work.close(); }
	} );

	it( 'does not let serialized capture data act as an Undo token', async () => {
		const { work, application } = await imported();
		try {
			const group = capture( application ).history.groups[ 0 ];
			expect( () => application.undo( group ) ).toThrow( CODE );
			expect( work.editor.historyManager.historyIndex ).toBe( work.editor.historyManager.history.length - 1 );
		} finally { work.close(); }
	} );

	it( 'refuses capture after application disposal', async () => {
		const { work, application } = await imported();
		try {
			application.dispose();
			expect( () => capture( application ) ).toThrow( CODE );
		} finally { work.close(); }
	} );
} );
