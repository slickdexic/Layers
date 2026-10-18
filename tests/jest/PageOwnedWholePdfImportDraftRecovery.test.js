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

function payload( work, pages = [ 1, 2 ], tweak = () => {}, sourceRevisionId = 42 ) {
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
		source: { pageId: 9, owner: 'Source_owner', revisionId: sourceRevisionId, surfaceId: 'source-p2' },
		targetBundle: { revisionId: work.session._revisionId, snapshot: base, sourceGeometry: targetGeometry, sourceRenditions: targetRenditions },
		sourceBundle: bundle( sourceRevisionId, sourceMembers ),
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
	const api = { post: jest.fn( params => Promise.resolve( response( payload( work, pages, tweak, params.sourcerevid ) ) ) ) };
	const source = new WholeSource( api ), binding = new Binding( work.session, source, new PdfClient( work.api ) );
	const application = new Application( work.bridge, binding );
	return { work, api, source, binding, application, request: options( work, mode ) };
}

async function applyImport( work, application, request ) {
	const handle = await application.prepare( request );
	return application.apply( handle );
}

function enableHistory( work, application ) {
	application.enableHistory();
	expect( work.editor.historyManager.hasPdfImportHistory( application ) ).toBe( true );
}

describe( 'PageOwnedWholePdfImportDraft recovery', () => {
	async function importedPair( pages = [ 1, 2 ], mode = 'append', tweak = () => {}, sparse = true ) {
		const old = await setup( pages, mode, tweak, sparse );
		try {
			enableHistory( old.work, old.application );
			old.result = await applyImport( old.work, old.application, old.request );
			old.record = JSON.parse( JSON.stringify( old.application.captureDraft() ) );
			const fresh = await setup( pages, mode, tweak, sparse );
			enableHistory( fresh.work, fresh.application );
			return { old, fresh, record: old.record };
		} catch ( error ) {
			try { old.application.dispose(); } catch ( ignored ) {}
			old.work.close(); throw error;
		}
	}
	async function emptyPair() {
		const old = await setup();
		try {
			enableHistory( old.work, old.application );
			const record = JSON.parse( JSON.stringify( old.application.captureDraft() ) );
			const fresh = await setup(); enableHistory( fresh.work, fresh.application );
			return { old, fresh, record };
		} catch ( error ) { try { old.application.dispose(); } catch ( ignored ) {} old.work.close(); throw error; }
	}
	async function prepared( pair, assertCurrent ) {
		const handle = await pair.fresh.application.prepareDraftRecovery( pair.record, assertCurrent );
		return { handle, preview: pair.fresh.application.inspectDraftRecovery( handle ) };
	}
	async function recover( pair, assertCurrent ) {
		const value = await prepared( pair, assertCurrent );
		value.result = await pair.fresh.application.commitDraftRecovery( value.handle );
		return value;
	}
	function closePair( pair ) {
		try { pair.fresh.application.dispose(); } catch ( ignored ) {}
		try { pair.fresh.work.close(); } catch ( ignored ) {}
		try { pair.old.application.dispose(); } catch ( ignored ) {}
		try { pair.old.work.close(); } catch ( ignored ) {}
	}
	function fullWitness( work ) {
		const background = work.editor.canvasManager.backgroundImage;
		return JSON.stringify( { participants: witness( work ), url: window.location.href,
			backgroundUrl: work.editor.canvasManager.config.backgroundImageUrl,
			background: background && { src: background.src || null, width: background.width || null, height: background.height || null },
			layers: copy( work.editor.stateManager.get( 'layers' ) ), dirty: work.editor.stateManager.get( 'isDirty' ), page: work.editor.page } );
	}
	function mutateFirstAdmission( record ) {
		if ( Array.isArray( record.session.admissions ) && record.session.admissions.length ) {
			const first = record.session.admissions[ 0 ];
			if ( Array.isArray( first ) && first.length > 1 ) { first[ 1 ] = 'forged-native-admission'; }
			else if ( first && typeof first === 'object' ) { first.id = 'forged-native-admission'; }
		} else { record.session.admissions = []; }
	}

	it( 'recovers the selected whole-PDF Import group and its source evidence into a fresh matching session', async () => {
		const pair = await importedPair();
		try {
			const beforeWrites = pair.fresh.work.api.postWithToken.mock.calls.length;
			await recover( pair );
			const restored = pair.fresh.application.captureDraft();
			expect( restored.session.snapshot ).toEqual( pair.record.session.snapshot );
			expect( restored.session.sources ).toEqual( pair.record.session.sources );
			expect( restored.session.admissionRevisions ).toEqual( pair.record.session.admissionRevisions );
			expect( restored.history.groups ).toHaveLength( pair.record.history.groups.length );
			expect( restored.history.timelines.map( row => row.page ) ).toEqual( pair.record.history.timelines.map( row => row.page ) );
			expect( pair.fresh.binding.getImportPublication().sources ).toEqual( pair.record.session.sources );
			expect( pair.fresh.work.api.postWithToken ).toHaveBeenCalledTimes( beforeWrites );
		} finally { closePair( pair ); }
	} );

	it( 'inspects a detached read-only preview without changing any live participant', async () => {
		const pair = await importedPair();
		try {
			const before = fullWitness( pair.fresh.work ), { handle, preview } = await prepared( pair );
			expect( preview && typeof preview ).toBe( 'object' );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
			JSON.parse( JSON.stringify( preview ) );
			expect( pair.fresh.application.inspectDraftRecovery( handle ) ).toEqual( preview );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
			pair.fresh.application.releaseDraftRecovery( handle );
		} finally { closePair( pair ); }
	} );

	it( 'preserves the fresh editor current PDF page while restoring the group', async () => {
		const pair = await importedPair();
		try {
			expect( await pair.old.work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			pair.record = JSON.parse( JSON.stringify( pair.old.application.captureDraft() ) );
			expect( pair.record.history.activePage ).toBe( 1 );
			await recover( pair );
			expect( pair.fresh.work.session.getPdfStatus().page ).toBe( 2 );
			expect( pair.fresh.work.editor.page ).toBe( 2 );
		} finally { closePair( pair ); }
	} );

	it( 'preserves a fresh page-one view when the saved draft viewed page two', async () => {
		const pair = await importedPair();
		try {
			await pair.fresh.work.bridge.pdfCoordinator.turn( 1 );
			await recover( pair );
			expect( pair.old.record.history.activePage ).toBe( 2 );
			expect( pair.fresh.work.session.getPdfStatus().page ).toBe( 1 );
			expect( pair.fresh.work.editor.page ).toBe( 1 );
		} finally { closePair( pair ); }
	} );

	it( 'restores complete group Undo after recovery', async () => {
		const pair = await importedPair();
		try {
			await recover( pair );
			const imported = copy( pair.fresh.work.session._snapshot );
			expect( pair.fresh.work.editor.historyManager.undo() ).toBe( true );
			expect( pair.fresh.work.session._snapshot ).toEqual( pair.old.work.base );
			expect( pair.fresh.work.editor.historyManager.redo() ).toBe( true );
			expect( pair.fresh.work.session._snapshot ).toEqual( imported );
			expect( pair.fresh.application.captureDraft().history.groups[ 0 ].checkpoints.before ).toBeDefined();
			expect( pair.fresh.application.captureDraft().history.groups[ 0 ].checkpoints.after ).toBeDefined();
		} finally { closePair( pair ); }
	} );

	it( 'preserves a retired group barrier after native history capacity trims its marker', async () => {
		const pair = await importedPair();
		try {
			pair.old.work.editor.historyManager.setMaxHistorySteps( 1 );
			pair.record = JSON.parse( JSON.stringify( pair.old.application.captureDraft() ) );
			expect( pair.record.history.groups.some( group => group.retired ) ).toBe( true );
			const oldActive = pair.record.history.timelines.find( row => row.page === pair.old.work.editor.page ).timeline;
			expect( oldActive.historyIndex ).toBe( 0 );
			expect( oldActive.lastSaveHistoryIndex ).toBe( 0 );
			await recover( pair );
			const history = pair.fresh.work.editor.historyManager;
			expect( history.lastSaveHistoryIndex ).toBe( -1 );
			expect( pair.fresh.work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
			expect( pair.fresh.work.session.getStatus().dirty ).toBe( true );
			const before = fullWitness( pair.fresh.work );
			expect( history.undo() ).toBe( false );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
			expect( pair.fresh.work.session._snapshot.surfaces.some( member => member.layers.some( layer => layer.text === 'source-layer-2' ) ) ).toBe( true );
		} finally { closePair( pair ); }
	} );

	it( 'restores both affected pages across native PDF turns after reload', async () => {
		const pair = await importedPair();
		try {
			await recover( pair );
			expect( await pair.fresh.work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( pair.fresh.work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'source-layer-1' );
			expect( await pair.fresh.work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
			expect( pair.fresh.work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'source-layer-2' );
		} finally { closePair( pair ); }
	} );

	it( 'preserves ordinary edit ordering around the recovered Import Undo boundary', async () => {
		const pair = await importedPair();
		try {
			await recover( pair );
			pair.fresh.work.edit( 'ordinary after recovery' ); pair.fresh.work.bridge.capture();
			expect( pair.fresh.work.editor.historyManager.undo() ).toBe( true );
			expect( pair.fresh.work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) ).toContain( 'source-layer-2' );
			expect( pair.fresh.work.editor.historyManager.undo() ).toBe( true );
			expect( pair.fresh.work.session._snapshot ).toEqual( pair.fresh.work.base );
			expect( pair.fresh.work.editor.historyManager.redo() ).toBe( true );
			expect( pair.fresh.work.editor.historyManager.redo() ).toBe( true );
			expect( pair.fresh.work.editor.stateManager.get( 'layers' ).map( layer => layer.text ) ).toContain( 'ordinary after recovery' );
		} finally { closePair( pair ); }
	} );

	it( 'recovers an intentionally empty newly admitted page in Replace mode', async () => {
		const pair = await importedPair( [ 1, 2 ], 'replace', data => {
			data.sourceBundle.snapshot.surfaces.find( member => member.source.page === 1 ).layers = [];
		} );
		try {
			await recover( pair );
			const importedPageOne = () => pair.fresh.work.session._snapshot.surfaces.find( member =>
				member.kind === 'pdf' && member.source.page === 1 && member.source.fileTitle === 'File:Example.pdf' && member.label === 'ABC' );
			const pageOne = importedPageOne();
			expect( pageOne ).toBeDefined(); expect( pageOne.layers ).toEqual( [] );
			expect( pair.fresh.work.editor.historyManager.undo() ).toBe( true );
			expect( pair.fresh.work.editor.historyManager.redo() ).toBe( true );
			expect( importedPageOne().layers ).toEqual( [] );
		} finally { closePair( pair ); }
	} );

	it( 'recovers multiple Imports with one group in the before phase', async () => {
		const pair = await importedPair();
		try {
			await applyImport( pair.old.work, pair.old.application, options( pair.old.work, 'append' ) );
			expect( pair.old.work.editor.historyManager.undo() ).toBe( true );
			pair.record = JSON.parse( JSON.stringify( pair.old.application.captureDraft() ) );
			expect( pair.record.history.groups ).toHaveLength( 2 );
			expect( pair.record.history.groups.some( group => group.phase === 'before' ) ).toBe( true );
			await recover( pair );
			const history = pair.fresh.work.editor.historyManager;
			expect( history.redo() ).toBe( true ); expect( history.undo() ).toBe( true );
			expect( pair.fresh.application.captureDraft().history.groups ).toHaveLength( 2 );
		} finally { closePair( pair ); }
	} );

	it( 'retains retired group barriers as non-actionable history markers', async () => {
		const pair = await importedPair();
		try {
			pair.old.application.releaseCommand( pair.old.result.command );
			pair.record = JSON.parse( JSON.stringify( pair.old.application.captureDraft() ) );
			expect( pair.record.history.groups.some( group => group.retired ) ).toBe( true );
			await recover( pair );
			const before = fullWitness( pair.fresh.work );
			expect( pair.fresh.work.editor.historyManager.undo() ).toBe( false );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
			expect( pair.fresh.application.captureDraft().history.groups.some( group => group.retired ) ).toBe( true );
		} finally { closePair( pair ); }
	} );

	it( 'rejects old opaque recovery and Import command capabilities in the fresh application', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair );
			expect( () => pair.fresh.application.inspectDraftRecovery( pair.old.result.command ) ).toThrow( CODE );
			await expect( pair.fresh.application.commitDraftRecovery( pair.old.result.command ) ).rejects.toMatchObject( { code: CODE } );
			pair.fresh.application.releaseDraftRecovery( handle );
		} finally { closePair( pair ); }
	} );

	it( 'accepts a mutable JSON copy and leaves the caller-owned record detached', async () => {
		const pair = await importedPair();
		try {
			const serialized = JSON.stringify( pair.record ), detached = JSON.parse( serialized );
			const handle = await pair.fresh.application.prepareDraftRecovery( detached );
			detached.session.snapshot.metadata.callerMutation = true;
			const preview = pair.fresh.application.inspectDraftRecovery( handle );
			expect( JSON.stringify( preview ) ).not.toContain( 'callerMutation' );
			await pair.fresh.application.commitDraftRecovery( handle );
			expect( pair.fresh.work.session._snapshot.metadata.callerMutation ).toBeUndefined();
		} finally { closePair( pair ); }
	} );

	it( 'recovers an empty source-citation list without source reads but with the native target read', async () => {
		const pair = await emptyPair();
		try {
			expect( pair.record.session.sources ).toEqual( [] );
			const sourceCalls = pair.fresh.api.post.mock.calls.length, readCalls = pair.fresh.work.api.get.mock.calls.length;
			await recover( pair );
			expect( pair.fresh.api.post.mock.calls.length ).toBe( sourceCalls );
			expect( pair.fresh.work.api.get.mock.calls.length ).toBeGreaterThan( readCalls );
			expect( pair.fresh.work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { closePair( pair ); }
	} );

	it.each( [ 'null', 'array', 'wrong format', 'wrong version', 'unknown field' ] )( 'rejects %s recovery records without changing the fresh editor', async issue => {
		const pair = await importedPair();
		try {
			if ( issue === 'null' ) { pair.record = null; }
			if ( issue === 'array' ) { pair.record = []; }
			if ( issue === 'wrong format' ) { pair.record.format = 'other-format'; }
			if ( issue === 'wrong version' ) { pair.record.version = 99; }
			if ( issue === 'unknown field' ) { pair.record.unknown = true; }
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it.each( [ 'wrong owner', 'wrong base revision', 'wrong surface pin', 'wrong file pin' ] )( 'rejects recovery across a %s boundary atomically', async issue => {
		const pair = await importedPair();
		try {
			if ( issue === 'wrong owner' ) { pair.record.session.scope.owner = 'Other_owner'; }
			if ( issue === 'wrong base revision' ) { pair.record.session.scope.baseRevisionId++; }
			if ( issue === 'wrong surface pin' ) { pair.record.session.scope.surfaceId = 'other-surface'; }
			if ( issue === 'wrong file pin' ) { pair.record.session.snapshot.surfaces.find( member => member.id === 'anchor' ).source.sha1 = 'c'.repeat( 31 ); }
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it.each( [ 'missing native admission', 'mismatched historical native origin', 'orphaned group marker' ] )( 'refuses a %s without partial recovery', async issue => {
		const pair = await importedPair();
		try {
			if ( issue === 'missing native admission' ) { mutateFirstAdmission( pair.record ); }
			if ( issue === 'mismatched historical native origin' ) {
				const [ surfaceId, origin ] = pair.record.session.admissions[ 0 ];
				const revisionId = pair.record.session.scope.baseRevisionId - 1;
				origin.revisionId = revisionId;
				pair.record.session.admissionRevisions = [ { surfaceId, revisionId } ];
			}
			if ( issue === 'orphaned group marker' ) { pair.record.history.groups[ 0 ].entries[ 0 ].entry.pdfImportGroup.id = 'f'.repeat( 32 ); }
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'reauthorizes a valid historical native admission before recovering its edited page', async () => {
		const pair = await importedPair();
		try {
			const historicalRevision = pair.old.work.session._revisionId - 1;
			const blank = pair.old.work.context( 1, historicalRevision, pair.old.work.base ).surface;
			const record = pair.record;
			const holders = [ record.session, ...record.history.groups.filter( group => !group.retired )
				.flatMap( group => [ group.checkpoints.before, group.checkpoints.after ] ) ];
			let rewritten = 0;
			for ( const holder of holders ) {
				const member = holder.snapshot.surfaces.find( surface => surface.kind === 'pdf' && surface.source.page === 1 &&
					surface.source.fileTitle === 'File:Example.pdf' && surface.label === 'ABC' &&
					!pair.old.work.base.surfaces.some( baseMember => baseMember.id === surface.id ) );
				if ( !member ) { continue; }
				const previousId = member.id;
				member.id = blank.id;
				holder.temporary = holder.temporary.map( ( [ key, value ] ) => [ key === previousId ? blank.id : key,
					key === previousId ? copy( blank ) : value ] );
				holder.admissions = holder.admissions.map( ( [ key, origin ] ) => [ key === previousId ? blank.id : key,
					key === previousId ? { revisionId: historicalRevision, surface: copy( blank ) } : origin ] );
				holder.admissionRevisions = [ { surfaceId: blank.id, revisionId: historicalRevision } ];
				rewritten++;
			}
			expect( rewritten ).toBeGreaterThan( 0 );
			expect( record.session.snapshot.surfaces.find( surface => surface.id === blank.id ).layers.map( layer => layer.text ) ).toContain( 'source-layer-1' );
			await recover( { ...pair, record } );
			expect( pair.fresh.work.session._snapshot.surfaces.find( surface => surface.kind === 'pdf' && surface.source.page === 1 &&
				surface.source.fileTitle === 'File:Example.pdf' && surface.label === 'ABC' ).layers.map( layer => layer.text ) ).toContain( 'source-layer-1' );
			expect( pair.fresh.work.api.get.mock.calls.some( ( [ params ] ) => params.revid === historicalRevision && !params.editorpage ) ).toBe( true );
		} finally { closePair( pair ); }
	} );

	it( 'rejects a source that is hidden from the current native reader', async () => {
		const pair = await importedPair();
		try {
			pair.fresh.api.post.mockRejectedValueOnce( { error: { code: 'permissiondenied' } } );
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'rejects a source revision response that no longer matches its saved citation', async () => {
		const pair = await importedPair();
		try {
			pair.fresh.api.post.mockImplementationOnce( () => Promise.resolve( response( payload( pair.fresh.work, [ 1, 2 ], data => { data.source.revisionId = 43; data.sourceBundle.revisionId = 43; } ) ) ) );
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'requires current target read permission even when the captured record has no source citations', async () => {
		const pair = await emptyPair();
		try {
			pair.fresh.work.api.get.mockImplementation( () => Promise.resolve( { error: { code: 'permissiondenied' } } ) );
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( pair.fresh.work.api.get ).toHaveBeenCalled();
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'reauthorizes retained source citations before recovery', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair );
			pair.fresh.api.post.mockRejectedValueOnce( { error: { code: 'permissiondenied' } } );
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.commitDraftRecovery( handle ) ).rejects.toMatchObject( { code: CODE } );
			expect( pair.fresh.api.post ).toHaveBeenCalled();
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'preserves later work when recovery finishes', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair ), original = pair.fresh.work.api.get.getMockImplementation();
			let started;
			const targetReadStarted = new Promise( resolve => { started = resolve; } );
			let releaseRead;
			pair.fresh.work.api.get.mockImplementation( params => {
				if ( params.editorpage ) {
					return new Promise( resolve => { releaseRead = resolve; started( params ); } );
				}
				return original( params );
			} );
			const pending = pair.fresh.application.commitDraftRecovery( handle );
			const rejected = expect( pending ).rejects.toMatchObject( { code: CODE } );
			const params = await targetReadStarted;
			pair.fresh.work.edit( 'late edit during final recovery read' ); pair.fresh.work.bridge.capture();
			const afterEdit = fullWitness( pair.fresh.work );
			releaseRead( await original( params ) );
			await rejected;
			expect( fullWitness( pair.fresh.work ) ).toBe( afterEdit );
		} finally { closePair( pair ); }
	} );

	it( 'rejects a current target native read whose page binding does not match the captured surface', async () => {
		const pair = await importedPair();
		try {
			const original = pair.fresh.work.api.get.getMockImplementation();
			pair.fresh.work.api.get.mockImplementation( params => {
				if ( params.editorpage ) {
					const context = pair.fresh.work.context( params.editorpage, params.revid ); context.pageId = 8;
					return Promise.resolve( { layersread: { editor: context } } );
				}
				return original( params );
			} );
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'keeps a concurrent late edit intact when native recovery completes after the editor changed', async () => {
		const pair = await importedPair();
		try {
			const native = response( payload( pair.fresh.work ) ); let finish;
			pair.fresh.api.post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
			const pending = pair.fresh.application.prepareDraftRecovery( pair.record );
			const rejected = expect( pending ).rejects.toMatchObject( { code: CODE } );
			pair.fresh.work.edit( 'late edit during recovery' ); pair.fresh.work.bridge.capture();
			const afterEdit = fullWitness( pair.fresh.work );
			finish( native );
			await rejected;
			expect( fullWitness( pair.fresh.work ) ).toBe( afterEdit );
		} finally { closePair( pair ); }
	} );

	it( 'performs final native reauthorization before the first recovery write', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair );
			pair.fresh.work.api.get.mockImplementation( () => Promise.resolve( { error: { code: 'permissiondenied' } } ) );
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.commitDraftRecovery( handle ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'refuses a stale assertCurrent guard and leaves the new session unchanged', async () => {
		const pair = await importedPair();
		try {
			let current = true; const assertCurrent = () => { if ( !current ) { throw new Error( 'stale editor' ); } };
			const { handle } = await prepared( pair, assertCurrent ); current = false;
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.commitDraftRecovery( handle ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'releases an uncommitted recovery handle exactly once and rejects later use', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair ), before = fullWitness( pair.fresh.work );
			pair.fresh.application.releaseDraftRecovery( handle );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
			expect( () => pair.fresh.application.releaseDraftRecovery( handle ) ).toThrow( CODE );
			expect( () => pair.fresh.application.inspectDraftRecovery( handle ) ).toThrow( CODE );
			await expect( pair.fresh.application.commitDraftRecovery( handle ) ).rejects.toMatchObject( { code: CODE } );
		} finally { closePair( pair ); }
	} );

	it( 'disposal invalidates pending recovery capabilities without changing the session', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair ), before = fullWitness( pair.fresh.work );
			pair.fresh.application.dispose();
			expect( () => pair.fresh.application.inspectDraftRecovery( handle ) ).toThrow( CODE );
			await expect( pair.fresh.application.commitDraftRecovery( handle ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );

	it( 'consumes a committed recovery handle and blocks a second commit', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair ); await pair.fresh.application.commitDraftRecovery( handle );
			const after = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.commitDraftRecovery( handle ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( after );
		} finally { closePair( pair ); }
	} );

	it( 'does not publish a revision while preparing, inspecting, recovering, undoing or redoing', async () => {
		const pair = await importedPair();
		try {
			const { handle } = await prepared( pair ); pair.fresh.application.inspectDraftRecovery( handle );
			await pair.fresh.application.commitDraftRecovery( handle );
			pair.fresh.work.editor.historyManager.undo(); pair.fresh.work.editor.historyManager.redo();
			expect( pair.old.work.api.postWithToken ).not.toHaveBeenCalled();
			expect( pair.fresh.work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { closePair( pair ); }
	} );

	it( 'keeps the recovery record detached from later live edits', async () => {
		const pair = await importedPair();
		try {
			const serialized = JSON.stringify( pair.record ); await recover( pair );
			pair.fresh.work.edit( 'later editor work' ); pair.fresh.work.bridge.capture();
			expect( JSON.stringify( pair.record ) ).toBe( serialized );
			expect( pair.record.history.timelines.some( row => row.timeline.history.some( entry => entry.layers.some( layer => layer.text === 'later editor work' ) ) ) ).toBe( false );
		} finally { closePair( pair ); }
	} );

	it.each( [ 'prepareDraftReads', 'inspectDraftReads', 'revalidateDraftReads' ] )( 'refuses a substituted %s verifier before native recovery', async key => {
		const pair = await importedPair();
		try {
			const original = Object.getOwnPropertyDescriptor( pair.fresh.source, key );
			Object.defineProperty( pair.fresh.source, key, { value: async () => {}, configurable: true, writable: true } );
			const before = fullWitness( pair.fresh.work );
			await expect( pair.fresh.application.prepareDraftRecovery( pair.record ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
			if ( original ) { Object.defineProperty( pair.fresh.source, key, original ); } else { delete pair.fresh.source[ key ]; }
		} finally { closePair( pair ); }
	} );

	it( 'refuses and drains asynchronous guards at both low-level recovery boundaries', async () => {
		const pair = await importedPair();
		try {
			const before = fullWitness( pair.fresh.work ), guard = () => Promise.reject( new Error( 'async guard' ) );
			await expect( pair.fresh.binding.prepareDraftRecovery( pair.record, guard ) ).rejects.toMatchObject( { code: CODE } );
			await expect( pair.fresh.source.prepareDraftReads( { target: { pageId: 7, baseRevisionId: 12, surfaceId: 'anchor' },
				sources: pair.record.session.sources, assertCurrent: guard } ) ).rejects.toMatchObject( { code: CODE } );
			expect( fullWitness( pair.fresh.work ) ).toBe( before );
		} finally { closePair( pair ); }
	} );
} );
