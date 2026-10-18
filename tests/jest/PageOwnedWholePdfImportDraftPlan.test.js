'use strict';

const { TextEncoder } = require( 'util' );
global.TextEncoder = TextEncoder;
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Binding = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSession.js' );
const WholeSource = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSource.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
require( '../../resources/ext.layers.editor/selection/SelectionState.js' );
require( '../../resources/ext.layers.editor/SelectionManager.js' );
const Application = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportApplication.js' );
const Plan = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportDraftPlan.js' );
const SelectionManager = window.Layers.Core.SelectionManager;
const CODE = 'layers-working-copy-import-unavailable';
const sourcePin = { repository: 'local', fileTitle: 'File:Example.pdf', timestamp: '20260906130000', sha1: 'b'.repeat( 31 ) };
let allocationGeneration = 0;
const copy = value => JSON.parse( JSON.stringify( value ) );
const textLayer = ( id, text = id ) => ( { id, type: 'text', text, x: -17 } );

function response( value ) {
	const json = Array.from( JSON.stringify( value ), char => {
		const point = char.codePointAt( 0 );
		if ( point <= 127 ) { return char; }
		if ( point <= 0xffff ) { return '\\u' + point.toString( 16 ).padStart( 4, '0' ); }
		const adjusted = point - 0x10000;
		return '\\u' + ( 0xd800 + ( adjusted >> 10 ) ).toString( 16 ) + '\\u' + ( 0xdc00 + ( adjusted & 0x3ff ) ).toString( 16 );
	} ).join( '' );
	return { layersworkingcopypdfimportread: { version: 1, data: json } };
}

function payload( work, pages = [ 1, 2 ], tweak = () => {} ) {
	const base = copy( JSON.parse( work.session._savedJson ) ), anchor = base.surfaces.find( surface => surface.id === 'anchor' );
	const targetPin = { ...anchor.source }; delete targetPin.page;
	const targetMembers = base.surfaces.filter( surface => surface.kind === 'pdf' && surface.label === anchor.label && surface.source.fileTitle === anchor.source.fileTitle );
	const sourceMembers = pages.map( page => {
		const target = page === 2 ? anchor : work.context( page ).surface;
		return { ...copy( target ), id: 'source-p' + page, label: 'ABC', source: { ...sourcePin, page }, layers: [ textLayer( 'source-layer-' + page ) ] };
	} );
	const bundle = ( revisionId, members ) => ( { revisionId, snapshot: { schemaVersion: 1, surfaces: members },
		sourceGeometry: Object.fromEntries( members.map( surface => [ surface.id, { page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels' } ] ) ),
		sourceRenditions: Object.fromEntries( members.map( surface => [ surface.id, { url: 'https://example.test/' + surface.id + '.jpg', width: 415, height: 207 } ] ) ) } );
	const admitted = pages.includes( 1 ) && !targetMembers.some( surface => surface.source.page === 1 ) ? [ copy( work.context( 1, work.session._revisionId, base ).surface ) ] : [];
	const targetGeometry = Object.fromEntries( targetMembers.map( surface => [ surface.id, { page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels' } ] ) );
	const targetRenditions = Object.fromEntries( targetMembers.map( surface => [ surface.id, { url: 'https://example.test/target-' + surface.source.page + '.jpg', width: 415, height: 207 } ] ) );
	const value = { target: { pageId: 7, owner: 'Owner', revisionId: work.session._revisionId, surfaceId: 'anchor' },
		source: { pageId: 9, owner: 'Source_owner', revisionId: 42, surfaceId: 'source-p2' },
		targetBundle: { revisionId: work.session._revisionId, snapshot: base, sourceGeometry: targetGeometry, sourceRenditions: targetRenditions },
		sourceBundle: bundle( 42, sourceMembers ), targetGroup: { label: anchor.label, source: targetPin, pageCount: 2,
			members: targetMembers.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) },
		sourceGroup: { label: 'ABC', source: sourcePin, pageCount: 2, members: sourceMembers.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) },
		admittedTargetSurfaces: admitted,
		admittedTargetGeometry: Object.fromEntries( admitted.map( surface => [ surface.id, { page: surface.source.page, width: 208, height: 416, units: 'file-handler-pixels' } ] ) ),
		admittedTargetRenditions: Object.fromEntries( admitted.map( surface => [ surface.id, { url: 'https://example.test/admitted-' + surface.source.page + '.jpg', width: 208, height: 416 } ] ) ) };
	tweak( value ); return value;
}

function request( work ) {
	let next = 0; const generation = ++allocationGeneration;
	let witness; const assertCurrent = () => { const value = work.bridge.pdfCoordinator.witness( true ); if ( witness === undefined ) { witness = value; } else if ( witness !== value ) { throw new Error( 'Changed' ); } };
	return { source: { pageId: 9, revisionId: 42, surfaceId: 'source-p2' }, mode: 'append', maxLayers: 20,
		allocateId: () => 'plan-import-' + generation + '-' + ++next, assertCurrent };
}

async function setup( pages = [ 1, 2 ] ) {
	const work = await fixture( true ); work.editor.canvasManager.selectionManager = new SelectionManager( {}, work.editor.canvasManager );
	const api = { post: jest.fn( () => Promise.resolve( response( payload( work, pages ) ) ) ) };
	const binding = new Binding( work.session, new WholeSource( api ), new PdfClient( work.api ) );
	const application = new Application( work.bridge, binding ); application.enableHistory();
	return { work, api, binding, application, request: request( work ) };
}
async function captureImported( value ) {
	const handle = await value.application.prepare( value.request ); await value.application.apply( handle );
	return value.application.captureDraft();
}
function prepare( draft, expected ) { return Plan.prepare( draft, expected ); }

describe( 'PageOwnedWholePdfImportDraftPlan', () => {
	it( 'returns a detached validated initial record', async () => {
		const value = await setup();
		try {
			const expected = value.binding.captureImportDraft(), input = value.application.captureDraft(), result = prepare( input, expected );
			expect( result ).toEqual( input ); expect( result ).not.toBe( input ); expect( result.session ).not.toBe( input.session );
			result.session.pdf.page = 1; expect( input.session.pdf.page ).toBe( 2 );
		} finally { value.work.close(); }
	} );

	it( 'accepts an authorized in-memory Import capture with complete checkpoints and citation', async () => {
		const value = await setup();
		try {
			const draft = await captureImported( value );
			const result = prepare( draft, value.binding.captureImportDraft() );
			expect( result.session.sources ).toHaveLength( 1 ); expect( result.history.groups[ 0 ].retired ).toBe( false );
			expect( result.history.groups[ 0 ].checkpoints.before.snapshot.surfaces ).toBeDefined();
			expect( result.history.groups[ 0 ].checkpoints.after.snapshot.surfaces ).toBeDefined();
		} finally { value.work.close(); }
	} );

	it( 'accepts retired markers only as checkpoint-free barriers', async () => {
		const value = await setup();
		try {
			await captureImported( value ); value.work.editor.historyManager.setMaxHistorySteps( 1 );
			const draft = value.application.captureDraft(), expected = value.binding.captureImportDraft();
			expect( draft.history.groups.some( group => group.retired ) ).toBe( true );
			expect( prepare( draft, expected ).history.groups.find( group => group.retired ) ).toMatchObject( { checkpoints: null, timelines: null } );
		} finally { value.work.close(); }
	} );

	it.each( [
		[ 'rejects an altered scope', ( draft ) => { draft.session.scope.baseRevisionId++; } ],
		[ 'rejects a different saved base', ( draft ) => { draft.session.scope.savedJson = '{}'; } ],
		[ 'rejects malformed admission rows before member lookup', ( draft ) => { draft.session.admissions = [ null ]; } ],
		[ 'rejects a changed file pin', ( draft ) => { draft.session.snapshot.surfaces.find( item => item.id === 'anchor' ).source.timestamp = '20200101000000'; } ],
		[ 'rejects a page-count mismatch', ( draft ) => { draft.session.scope.pageCount = 1; } ],
		[ 'rejects a duplicate source citation', ( draft ) => { draft.session.sources.push( copy( draft.session.sources[ 0 ] ) ); } ],
		[ 'rejects a citation to another target anchor', ( draft ) => { draft.session.sources[ 0 ].targetSurfaceId = 'other'; } ],
		[ 'rejects a changed historical admission origin', ( draft ) => { if ( draft.session.admissions.length ) { draft.session.admissions[ 0 ][ 1 ].revisionId = draft.session.scope.baseRevisionId + 1; } else { draft.session.admissionRevisions.push( { surfaceId: 'fake', revisionId: 1 } ); } } ],
		[ 'rejects an incomplete target group', ( draft ) => { draft.session.snapshot.surfaces = draft.session.snapshot.surfaces.filter( item => item.id !== 'anchor' ); } ],
		[ 'rejects an unknown timeline marker', ( draft ) => { draft.history.timelines[ 0 ].timeline.history[ 0 ].pdfImportGroup = { id: 'f'.repeat( 32 ), page: 1 }; } ],
		[ 'rejects a marker that names another page', ( draft ) => { const group = draft.history.groups[ 0 ]; group.entries[ 0 ].entry.pdfImportGroup.page++; } ],
		[ 'rejects a duplicate group identity', ( draft ) => { draft.history.groups.push( copy( draft.history.groups[ 0 ] ) ); } ],
		[ 'rejects a retired group carrying checkpoint authority', ( draft ) => { const group = draft.history.groups[ 0 ]; group.retired = true; group.checkpoints = { before: {}, after: {} }; group.timelines = { pages: [], before: [], after: [] }; } ],
		[ 'rejects a missing active checkpoint', ( draft ) => { draft.history.groups[ 0 ].checkpoints.after = null; } ],
		[ 'rejects a checkpoint with mismatched source claims', ( draft ) => { draft.history.groups[ 0 ].checkpoints.after.sources = []; } ],
		[ 'rejects a forged saved-history marker', ( draft ) => { const row = draft.history.timelines.find( item => item.page === 2 ); row.timeline.lastSaveHistoryIndex = row.timeline.historyIndex; } ],
		[ 'rejects a duplicate group marker with a different payload', ( draft ) => { const row = draft.history.timelines.find( item => item.page === 2 ); const extra = copy( row.timeline.history[ row.timeline.historyIndex ] ); extra.timestamp++; row.timeline.history.push( extra ); } ],
		[ 'rejects a duplicate marker in retained command history', ( draft ) => { const row = draft.history.groups[ 0 ].timelines.after.find( item => item.page === 2 ); const extra = copy( row.timeline.history[ row.timeline.historyIndex ] ); extra.timestamp++; row.timeline.history.push( extra ); } ],
		[ 'rejects a modified temporary blank canvas', ( draft ) => { draft.session.temporary[ 0 ][ 1 ].canvas.width++; } ],
		[ 'rejects a checkpoint with an invalid admission map', ( draft ) => { draft.history.groups[ 0 ].checkpoints.after.admissions.push( [ 'forged', {} ] ); } ],
		[ 'rejects non-finite snapshot values', ( draft ) => { draft.session.snapshot.poison = Number.NaN; } ]
	] )( '%s', async ( title, mutate ) => {
		const value = await setup();
		try {
			const draft = await captureImported( value ); mutate( draft );
			expect( () => prepare( draft, value.binding.captureImportDraft() ) ).toThrow( CODE );
		} finally { value.work.close(); }
	} );

	it( 'rejects getters, symbols, cycles, and unsafe object values without invoking accessors', async () => {
		const value = await setup();
		try {
			const valid = value.application.captureDraft(), expected = value.binding.captureImportDraft(); let called = false;
			const getter = copy( valid ); Object.defineProperty( getter.session, 'context', { enumerable: true, get() { called = true; return {}; } } );
			expect( () => prepare( getter, expected ) ).toThrow( CODE ); expect( called ).toBe( false );
			const symbol = copy( valid ); symbol[ Symbol( 'hidden' ) ] = true; expect( () => prepare( symbol, expected ) ).toThrow( CODE );
			const cycle = copy( valid ); cycle.session.snapshot.loop = cycle; expect( () => prepare( cycle, expected ) ).toThrow( CODE );
		} finally { value.work.close(); }
	} );

	it( 'refuses an active group marker whose predecessor was trimmed', async () => {
		const value = await setup();
		try {
			const draft = await captureImported( value ), group = draft.history.groups.find( item => !item.retired );
			const marker = group.entries[ 0 ], row = draft.history.timelines.find( item => item.page === marker.page ).timeline;
			const index = row.history.findIndex( item => JSON.stringify( item ) === JSON.stringify( marker.entry ) );
			expect( index ).toBeGreaterThan( 0 ); row.history = row.history.slice( index ); row.historyIndex = 0;
			row.lastSaveHistoryIndex = -1;
			expect( () => prepare( draft, value.binding.captureImportDraft() ) ).toThrow( CODE );
		} finally { value.work.close(); }
	} );

	it( 'refuses stale expected session content while leaving both records untouched', async () => {
		const value = await setup();
		try {
			const input = value.application.captureDraft(), expected = value.binding.captureImportDraft();
			expected.pdf.pageCount++;
			const before = JSON.stringify( input ); expect( () => prepare( input, expected ) ).toThrow( CODE );
			expect( JSON.stringify( input ) ).toBe( before );
		} finally { value.work.close(); }
	} );
} );
