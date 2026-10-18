'use strict';

const { TextEncoder } = require( 'util' );
global.TextEncoder = TextEncoder;
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Binding = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSession.js' );
const WholeSource = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSource.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const WorkingSet = require( '../../resources/ext.layers.editor/PageOwnedPdfWorkingSet.js' );
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
		return '\\u' + ( 0xd800 + ( adjusted >> 10 ) ).toString( 16 ) +
			'\\u' + ( 0xdc00 + ( adjusted & 0x3ff ) ).toString( 16 );
	} ).join( '' );
	return { layersworkingcopypdfimportread: { version: 1, data: json } };
}

function payload( work, pages = [ 1, 2 ], tweak = () => {} ) {
	const base = copy( JSON.parse( work.session._savedJson ) );
	const anchor = base.surfaces.find( surface => surface.id === 'anchor' );
	const targetPin = { ...anchor.source };
	delete targetPin.page;
	const targetMembers = base.surfaces.filter( surface => surface.kind === 'pdf' &&
		surface.label === anchor.label && surface.source.fileTitle === anchor.source.fileTitle );
	const sourceMembers = pages.map( page => {
		const target = page === 2 ? anchor : work.context( page ).surface;
		return { ...copy( target ), id: 'source-p' + page, label: 'ABC',
			source: { ...sourcePin, page }, layers: [ textLayer( 'source-layer-' + page ) ] };
	} );
	const bundle = ( revisionId, snapshotMembers ) => ( { revisionId,
		snapshot: { schemaVersion: 1, surfaces: snapshotMembers },
		sourceGeometry: Object.fromEntries( snapshotMembers.filter( surface => surface.kind === 'pdf' )
			.map( surface => [ surface.id, { page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels' } ] ) ),
		sourceRenditions: Object.fromEntries( snapshotMembers.filter( surface => surface.kind === 'pdf' )
			.map( surface => [ surface.id, { url: 'https://example.test/' + surface.id + '.jpg', width: 415, height: 207 } ] ) ) } );
	const admitted = pages.includes( 1 ) && !targetMembers.some( surface => surface.source.page === 1 ) ?
		[ copy( work.context( 1, work.session._revisionId, base ).surface ) ] : [];
	const admittedGeometry = Object.fromEntries( admitted.map( surface => [ surface.id,
		{ page: surface.source.page, width: 208, height: 416, units: 'file-handler-pixels' } ] ) );
	const admittedRenditions = Object.fromEntries( admitted.map( surface => [ surface.id,
		{ url: 'https://example.test/admitted-' + surface.source.page + '.jpg', width: 208, height: 416 } ] ) );
	const targetGeometry = Object.fromEntries( targetMembers.map( surface => [ surface.id,
		{ page: surface.source.page, width: 416, height: 208, units: 'file-handler-pixels' } ] ) );
	const targetRenditions = Object.fromEntries( targetMembers.map( surface => [ surface.id,
		{ url: 'https://example.test/target-' + surface.source.page + '.jpg', width: 415, height: 207 } ] ) );
	const result = {
		target: { pageId: 7, owner: 'Owner', revisionId: work.session._revisionId, surfaceId: 'anchor' },
		source: { pageId: 9, owner: 'Source_owner', revisionId: 42, surfaceId: 'source-p2' },
		targetBundle: { revisionId: work.session._revisionId, snapshot: base,
			sourceGeometry: targetGeometry, sourceRenditions: targetRenditions },
		sourceBundle: bundle( 42, sourceMembers ),
		targetGroup: { label: anchor.label, source: targetPin, pageCount: 2,
			members: targetMembers.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) },
		sourceGroup: { label: 'ABC', source: sourcePin, pageCount: 2,
			members: sourceMembers.map( surface => ( { page: surface.source.page, surfaceId: surface.id } ) ) },
		admittedTargetSurfaces: admitted, admittedTargetGeometry: admittedGeometry,
		admittedTargetRenditions: admittedRenditions
	};
	tweak( result );
	return result;
}

function witness( work ) {
	return JSON.stringify( { draft: work.session.getDraft(), status: work.session.getStatus(),
		pdf: work.session.getPdfStatus(), coordinator: work.bridge.pdfCoordinator.witness( true ),
		timelines: Array.from( work.bridge.pdfCoordinator.timelines ) } );
}

function options( work, mode = 'append', assertCurrent ) {
	let next = 0;
	const generation = ++allocationGeneration;
	let original;
	assertCurrent = assertCurrent || ( () => {
		const current = work.bridge.pdfCoordinator.witness( true );
		if ( original === undefined ) { original = current; }
		if ( original !== current ) { throw new Error( 'Editor participants changed' ); }
	} );
	return { source: { pageId: 9, revisionId: 42, surfaceId: 'source-p2' }, mode, maxLayers: 20,
		allocateId: jest.fn( () => 'imported-' + generation + '-' + ++next ), assertCurrent };
}

async function unavailable( promise ) {
	let error;
	try { await promise; } catch ( caught ) { error = caught; }
	expect( error ).toBeInstanceOf( Error );
	expect( error.message ).toBe( CODE );
	expect( error.code ).toBe( CODE );
}

async function setup( pages = [ 1, 2 ], mode = 'append', mutate = () => {}, sparse = true ) {
	const work = await fixture( sparse );
	const api = { post: jest.fn( () => Promise.resolve( response( payload( work, pages, mutate ) ) ) ) };
	const source = new WholeSource( api );
	const binding = new Binding( work.session, source, new PdfClient( work.api ) );
	return { work, api, source, binding, request: options( work, mode ) };
}

async function editedPage( work, page, text ) {
	if ( work.editor.page !== page ) {
		if ( !await work.bridge.pdfCoordinator.turn( page ) ) { throw new Error( 'fixture page turn failed' ); }
	}
	work.edit( text );
	work.bridge.capture();
}

describe( 'PageOwnedWholePdfImportCommit', () => {
	async function prepareCommit( binding, request ) {
		const sessionHandle = await binding.prepare( request );
		const prepared = await binding.prepareImportCommit( sessionHandle );
		return { sessionHandle, prepared, preview: binding.inspectImportCommit( prepared ) };
	}

	function uiState( work ) {
		return JSON.stringify( { live: work.bridge.getLiveState(), history: work.editor.historyManager.captureTimeline(),
			page: work.editor.page, pageCount: work.editor.pageCount, url: window.location.href,
			imageUrl: work.editor.canvasManager.config.backgroundImageUrl,
			timelines: Array.from( work.bridge.pdfCoordinator.timelines ) } );
	}

	it( 'commits every sparse source page and complete target metadata atomically, without changing live UI or history', async () => {
		const { work, binding, request } = await setup();
		try {
			await editedPage( work, 2, 'Unsaved target page two' );
			await editedPage( work, 1, 'Unsaved temporary page one' );
			const beforeUi = uiState( work ), beforeDraft = witness( work ), { prepared, preview } = await prepareCommit( binding, request );
			expect( preview.candidateSnapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) )
				.toEqual( [ 'source-layer-2', 'Unsaved target page two' ] );
			expect( preview.candidateSnapshot.surfaces.find( member => member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 )
				.layers.map( layer => layer.text ) ).toEqual( [ 'source-layer-1', 'Unsaved temporary page one' ] );
			expect( preview.candidateSnapshot.metadata ).toEqual( work.session._snapshot.metadata );
			expect( preview.activePage ).toBe( 1 );
			expect( preview.activeSurfaceId ).toBe( work.session.getPdfStatus().activeSurfaceId );
			expect( preview.sources ).toHaveLength( 1 );
			const committed = binding.commitPreparedImport( prepared, () => undefined );
			expect( committed.candidateSnapshot ).toEqual( preview.candidateSnapshot );
			expect( committed.beforeCheckpoint ).toBeDefined();
			expect( committed.checkpoint ).toBeDefined();
			expect( work.session._snapshot ).toEqual( preview.candidateSnapshot );
			expect( uiState( work ) ).toBe( beforeUi );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
			expect( witness( work ) ).not.toBe( beforeDraft );
		} finally { work.close(); }
	} );

	it( 'replace clears only target-only page layers while retaining its full page member and target pin', async () => {
		const { work, binding, request } = await setup( [ 2 ], 'replace' );
		try {
			await editedPage( work, 1, 'Target only temporary page' );
			const { prepared, preview } = await prepareCommit( binding, request );
			const targetOnly = preview.candidateSnapshot.surfaces.find( member => member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 );
			expect( targetOnly ).toBeDefined();
			expect( targetOnly.layers ).toEqual( [] );
			expect( targetOnly.source ).toEqual( { ...work.base.surfaces.find( member => member.id === 'anchor' ).source, page: 1 } );
			binding.commitPreparedImport( prepared, () => undefined );
			const checkpoint = binding.getImportPublication();
			expect( work.session._snapshot.surfaces.find( member => member.id === targetOnly.id ) ).toEqual( targetOnly );
			expect( checkpoint.admissionRevisions ).toEqual( [] );
		} finally { work.close(); }
	} );

	it( 'keeps an untouched blank temporary page out of the snapshot while retaining its display and admission', async () => {
		const { work, binding, request } = await setup( [ 2 ], 'append' );
		try {
			await work.bridge.pdfCoordinator.turn( 1 );
			const temporaryId = work.session.getPdfStatus().activeSurfaceId;
			const { prepared, preview } = await prepareCommit( binding, request );
			expect( preview.activeSurfaceId ).toBe( temporaryId );
			expect( preview.activePage ).toBe( 1 );
			expect( preview.candidateSnapshot.surfaces.some( member => member.id === temporaryId ) ).toBe( false );
			expect( preview.editorState.layers ).toEqual( [] );
			binding.commitPreparedImport( prepared, () => undefined );
			expect( work.session._pdf.temporary.has( temporaryId ) ).toBe( true );
			expect( work.session._pdf.admissions.has( temporaryId ) ).toBe( true );
			expect( work.session.getPdfStatus().activeSurfaceId ).toBe( temporaryId );
			expect( work.session.getDraft().snapshot.surfaces.some( member => member.id === temporaryId ) ).toBe( false );
			expect( work.session.getEditorState().layers ).toEqual( [] );
		} finally { work.close(); }
	} );

	it( 'retains old-revision temporary IDs and returns their historical admission provenance', async () => {
		const { work, binding, request } = await setup();
		try {
			await editedPage( work, 1, 'Earlier-revision work' );
			const next = copy( work.base ); next.metadata.server = 'revision 13';
			work.api.get.mockImplementation( params => Promise.resolve( params.editorpage ?
				{ layersread: { editor: work.context( params.editorpage, params.revid, next ) } } :
				{ layersread: { revisionId: params.revid, snapshot: copy( next ), sourceGeometry: [] } } ) );
			await work.session.reconcile( 13 );
			const beforeId = WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 );
			const { prepared, preview } = await prepareCommit( binding, request );
			expect( preview.candidateSnapshot.surfaces.some( member => member.id === beforeId ) ).toBe( true );
			expect( preview.admissionRevisions ).toContainEqual( { surfaceId: beforeId, revisionId: 12 } );
			binding.commitPreparedImport( prepared, () => undefined );
			expect( work.session._pdf.admissions.get( beforeId ).revisionId ).toBe( 12 );
		} finally { work.close(); }
	} );

	it( 'leaves the entire session unchanged when preparation is refused or cancelled', async () => {
		const { work, binding, request, api } = await setup( [ 1, 2 ], 'append', data => { data.targetGroup.pageCount = 1; } );
		try {
			const before = witness( work );
			await unavailable( binding.prepare( request ) );
			expect( witness( work ) ).toBe( before );
			request.mode = 'cancel';
			const posts = api.post.mock.calls.length;
			await expect( binding.prepare( request ) ).resolves.toBeNull();
			expect( api.post ).toHaveBeenCalledTimes( posts );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'maps a cancelled source handle to a cancelled commit preparation', async () => {
		const { work, binding, request, api } = await setup();
		try {
			request.mode = 'cancel';
			const before = witness( work );
			const handle = await binding.prepare( request );
			expect( handle ).toBeNull();
			await expect( binding.prepareImportCommit( handle ) ).resolves.toBeNull();
			expect( api.post ).not.toHaveBeenCalled();
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'requires the final participant callback, and refuses callback throws or non-synchronous success', async () => {
		for ( const outcome of [ 'missing', 'throw', 'promise', 'rejectedPromise', 'value' ] ) {
			const { work, binding, request } = await setup();
			try {
				const { prepared } = await prepareCommit( binding, request ), before = witness( work );
				const call = outcome === 'missing' ? () => binding.commitPreparedImport( prepared ) :
					() => binding.commitPreparedImport( prepared, () => outcome === 'throw' ? (() => { throw new Error( 'guard' ); })() :
						outcome === 'promise' ? Promise.resolve() : outcome === 'rejectedPromise' ? Promise.reject( new Error( 'guard' ) ) : true );
				await unavailable( Promise.resolve().then( call ) );
				expect( witness( work ) ).toBe( before );
			} finally { work.close(); }
		}
	} );

	it( 'does not commit when the final participant callback changes PDF session state', async () => {
		const { work, binding, request } = await setup();
		try {
			const { prepared } = await prepareCommit( binding, request ), before = witness( work );
			await unavailable( Promise.resolve().then( () => binding.commitPreparedImport( prepared, () => {
				work.session._pdf.page++;
				return undefined;
			} ) ) );
			expect( witness( work ) ).not.toBe( before );
			expect( work.session._snapshot ).toEqual( work.base );
		} finally { work.close(); }
	} );

	it( 'rejects stale preparations after edits and leaves the later edit intact', async () => {
		const { work, binding, request } = await setup();
		try {
			const { prepared } = await prepareCommit( binding, request );
			await editedPage( work, 2, 'Edit after Import preparation' );
			const current = witness( work );
			await unavailable( Promise.resolve().then( () => binding.commitPreparedImport( prepared, () => undefined ) ) );
			expect( witness( work ) ).toBe( current );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) )
				.toContain( 'Edit after Import preparation' );
		} finally { work.close(); }
	} );

	it( 'allows only one concurrent commit preparation for a source handle', async () => {
		const { work, binding, request, api } = await setup();
		try {
			const sourceHandle = await binding.prepare( request );
			let resolveRead;
			api.post.mockImplementation( () => new Promise( resolve => { resolveRead = resolve; } ) );
			const first = binding.prepareImportCommit( sourceHandle );
			await Promise.resolve();
			await unavailable( Promise.resolve().then( () => binding.prepareImportCommit( sourceHandle ) ) );
			resolveRead( response( payload( work ) ) );
			const transaction = await first;
			binding.releaseImportCommit( transaction );
			binding.release( sourceHandle );
		} finally { work.close(); }
	} );

	it( 'refuses changed native source evidence during fresh preparation without touching the live session', async () => {
		const { work, binding, request, api } = await setup();
		try {
			const sourceHandle = await binding.prepare( request ), before = witness( work );
			api.post.mockImplementation( () => Promise.resolve( response( payload( work, [ 1, 2 ], data => {
				data.sourceBundle.snapshot.surfaces.find( member => member.id === 'source-p1' ).layers[ 0 ].text = 'Changed source';
			} ) ) ) );
			await unavailable( binding.prepareImportCommit( sourceHandle ) );
			expect( witness( work ) ).toBe( before );
			binding.release( sourceHandle );
		} finally { work.close(); }
	} );

	it( 'binds prepared transactions to the issuing session and rejects released or disposed handles', async () => {
		const first = await setup(), second = await setup();
		try {
			const prepared = await prepareCommit( first.binding, first.request );
			await unavailable( Promise.resolve().then( () => second.binding.commitPreparedImport( prepared.prepared, () => undefined ) ) );
			first.binding.releaseImportCommit( prepared.prepared );
			await unavailable( Promise.resolve().then( () => first.binding.commitPreparedImport( prepared.prepared, () => undefined ) ) );
			const again = await prepareCommit( first.binding, first.request );
			first.binding.dispose();
			await unavailable( Promise.resolve().then( () => first.binding.commitPreparedImport( again.prepared, () => undefined ) ) );
		} finally { first.work.close(); second.work.close(); }
	} );

	it( 'shares source-set citations across a new binding and deduplicates a second anchor of that set', async () => {
		const { work, binding, request, api } = await setup();
		try {
			let prepared = await prepareCommit( binding, request );
			binding.commitPreparedImport( prepared.prepared, () => undefined );
			const otherApi = { post: jest.fn( () => {
				const data = payload( work );
				data.source.surfaceId = 'source-p1';
				return Promise.resolve( response( data ) );
			} ) };
			const nextBinding = new Binding( work.session, new WholeSource( otherApi ), new PdfClient( work.api ) );
			const nextRequest = options( work );
			nextRequest.source.surfaceId = 'source-p1';
			prepared = await prepareCommit( nextBinding, nextRequest );
			expect( prepared.preview.sources ).toHaveLength( 1 );
			nextBinding.commitPreparedImport( prepared.prepared, () => undefined );
			expect( nextBinding.getImportPublication().sources ).toHaveLength( 1 );
			expect( api.post ).toHaveBeenCalledTimes( 2 );
			expect( otherApi.post ).toHaveBeenCalledTimes( 2 );
		} finally { work.close(); }
	} );

	it( 'returns detached previews and privately owned before/after checkpoint snapshots', async () => {
		const { work, binding, request } = await setup();
		try {
			const { prepared, preview } = await prepareCommit( binding, request );
			const detached = binding.inspectImportCommit( prepared );
			detached.candidateSnapshot.surfaces[ 0 ].layers[ 0 ].text = 'tampered';
			expect( binding.inspectImportCommit( prepared ) ).toEqual( preview );
			const result = binding.commitPreparedImport( prepared, () => undefined );
			await unavailable( Promise.resolve().then( () => new Binding( work.session,
				new WholeSource( { post: jest.fn( () => Promise.resolve( response( payload( work ) ) ) ) } ),
				new PdfClient( work.api ) ).inspectImportCheckpoint( result.checkpoint ) ) );
			const before = binding.inspectImportCheckpoint( result.beforeCheckpoint );
			const after = binding.inspectImportCheckpoint( result.checkpoint );
			expect( before.snapshot ).toEqual( work.base );
			expect( after.snapshot ).toEqual( preview.candidateSnapshot );
			expect( after.admissionRevisions ).toEqual( [] );
			expect( before.temporary ).toEqual( [] );
			expect( before.admissions ).toEqual( [] );
			expect( after.temporary ).toHaveLength( 1 );
			expect( after.admissions ).toHaveLength( 1 );
			before.snapshot.surfaces[ 0 ].layers[ 0 ].text = 'changed copy';
			expect( binding.inspectImportCheckpoint( result.beforeCheckpoint ).snapshot ).toEqual( work.base );
			binding.releaseImportCheckpoint( result.beforeCheckpoint );
			binding.releaseImportCheckpoint( result.checkpoint );
			await unavailable( Promise.resolve().then( () => binding.inspectImportCheckpoint( result.checkpoint ) ) );
		} finally { work.close(); }
	} );

	it( 'allows checkpoint release after binding disposal', async () => {
		const { work, binding, request } = await setup();
		try {
			const { prepared } = await prepareCommit( binding, request );
			const result = binding.commitPreparedImport( prepared, () => undefined );
			binding.dispose();
			binding.releaseImportCheckpoint( result.beforeCheckpoint );
			binding.releaseImportCheckpoint( result.checkpoint );
		} finally { work.close(); }
	} );

	it( 'consumes a source handle once while leaving it releasable', async () => {
		const { work, binding, request } = await setup();
		try {
			const sourceHandle = await binding.prepare( request );
			const prepared = await binding.prepareImportCommit( sourceHandle );
			binding.commitPreparedImport( prepared, () => undefined );
			await unavailable( binding.prepareImportCommit( sourceHandle ) );
			binding.release( sourceHandle );
		} finally { work.close(); }
	} );

	it( 'keeps future PDF selection and draft capture compatible with committed temporary members', async () => {
		const { work, binding, request } = await setup();
		try {
			const { prepared } = await prepareCommit( binding, request );
			binding.commitPreparedImport( prepared, () => undefined );
			const draft = work.session.getDraft();
			expect( draft.snapshot.surfaces.some( member => member.id === 'anchor' && member.source.page === 2 ) ).toBe( true );
			expect( draft.snapshot.surfaces.some( member => member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 ) ).toBe( true );
			expect( draft.pdf.admissions ).toBeUndefined();
			const pageTwo = work.session.selectPdfPage( work.context( 2 ) );
			expect( pageTwo.layers.map( layer => layer.text ) ).toContain( 'source-layer-2' );
			const pageOne = work.session.selectPdfPage( work.context( 1 ) );
			expect( pageOne.layers.map( layer => layer.text ) ).toContain( 'source-layer-1' );
			expect( work.session.getPdfStatus().page ).toBe( 1 );
			expect( work.session.getDraft().snapshot.surfaces.some( member => member.source.page === 2 ) ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'records one source layer-set citation and correct historical admission claims', async () => {
		const { work, binding, request } = await setup();
		try {
			await editedPage( work, 1, 'Historical page one' );
			const next = copy( work.base ); next.metadata.server = 'revision 13';
			work.api.get.mockImplementation( params => Promise.resolve( params.editorpage ?
				{ layersread: { editor: work.context( params.editorpage, params.revid, next ) } } :
				{ layersread: { revisionId: params.revid, snapshot: copy( next ), sourceGeometry: [] } } ) );
			await work.session.reconcile( 13 );
			const prepared = await prepareCommit( binding, request );
			const publication = prepared.preview;
			expect( publication.sources ).toEqual( [ { targetSurfaceId: 'anchor', sourcePageId: 9,
				sourceRevisionId: 42, sourceSurfaceId: 'source-p2' } ] );
			expect( publication.admissionRevisions ).toEqual( [ { surfaceId: WorkingSet.surfaceId( 7, 12,
				'File:Example.pdf', 'ABC', 1 ), revisionId: 12 } ] );
			binding.commitPreparedImport( prepared.prepared, () => undefined );
			expect( binding.getImportPublication().sources ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'append deduplicates prior source-set claims and replace starts a fresh claim list', async () => {
		const { work, binding, request: initialRequest, api } = await setup();
		try {
			let request = initialRequest;
			let prepared = await prepareCommit( binding, request );
			binding.commitPreparedImport( prepared.prepared, () => undefined );
			expect( binding.getImportPublication().sources ).toHaveLength( 1 );
			api.post.mockImplementation( () => {
				const data = payload( work );
				data.source.pageId = 10; data.source.owner = 'Other_source'; data.source.revisionId = 43;
				data.sourceBundle.revisionId = 43;
				return Promise.resolve( response( data ) );
			} );
			request = options( work );
			request.source.pageId = 10; request.source.revisionId = 43;
			prepared = await prepareCommit( binding, request );
			binding.commitPreparedImport( prepared.prepared, () => undefined );
			expect( binding.getImportPublication().sources ).toHaveLength( 2 );
			request = options( work, 'replace' );
			request.source.pageId = 10; request.source.revisionId = 43;
			prepared = await prepareCommit( binding, request );
			binding.commitPreparedImport( prepared.prepared, () => undefined );
			expect( binding.getImportPublication().sources ).toHaveLength( 1 );
			expect( binding.getImportPublication().sources[ 0 ].sourcePageId ).toBe( 10 );
		} finally { work.close(); }
	} );

	it( 'refuses commit when snapshot or admission-map properties cannot be atomically replaced', async () => {
		for ( const property of [ '_snapshot', 'temporary', 'admissions' ] ) {
			const { work, binding, request } = await setup();
			let target, key, old;
			try {
				const { prepared } = await prepareCommit( binding, request );
				target = property === '_snapshot' ? work.session : work.session._pdf;
				key = property;
				old = Object.getOwnPropertyDescriptor( target, key );
				Object.defineProperty( target, key, { ...old, writable: false } );
				await unavailable( Promise.resolve().then( () => binding.commitPreparedImport( prepared, () => undefined ) ) );
				expect( work.session._snapshot ).toEqual( work.base );
			} finally {
				if ( target && old ) { Object.defineProperty( target, key, old ); }
				work.close();
			}
		}
	} );

	it( 'keeps ordinary Save and history untouched until later integration', async () => {
		const { work, binding, request } = await setup();
		try {
			const beforeHistory = work.editor.historyManager.captureTimeline();
			const beforeUi = uiState( work );
			const { prepared } = await prepareCommit( binding, request );
			binding.commitPreparedImport( prepared, () => undefined );
			expect( work.editor.historyManager.captureTimeline() ).toEqual( beforeHistory );
			expect( uiState( work ) ).toBe( beforeUi );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );
