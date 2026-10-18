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
	let original;
	assertCurrent = assertCurrent || ( () => {
		const current = work.bridge.pdfCoordinator.witness( true );
		if ( original === undefined ) { original = current; }
		if ( original !== current ) { throw new Error( 'Editor participants changed' ); }
	} );
	return { source: { pageId: 9, revisionId: 42, surfaceId: 'source-p2' }, mode, maxLayers: 20,
		allocateId: jest.fn( () => 'imported-' + ++next ), assertCurrent };
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

describe( 'PageOwnedWholePdfImportSession', () => {
	it( 'prepares a complete append candidate from the live PDF session without mutating editor or history', async () => {
		const { work, binding, request } = await setup();
		try {
			await editedPage( work, 2, 'Unsaved page two' );
			await editedPage( work, 1, 'Unsaved temporary page one' );
			const before = witness( work );
			expect( binding.commit ).toBeUndefined();
			expect( binding.apply ).toBeUndefined();
			const handle = await binding.prepare( request );
			const preview = binding.inspect( handle );
			const p1 = preview.candidateSnapshot.surfaces.find( surface => surface.source.page === 1 && surface.source.fileTitle === 'File:Example.pdf' );
			expect( p1.layers.map( layer => layer.text ) ).toEqual( [ 'source-layer-1', 'Unsaved temporary page one' ] );
			expect( p1.id ).toBe( WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 ) );
			expect( preview.candidateSnapshot.surfaces.find( surface => surface.id === 'anchor' ).layers.map( layer => layer.text ) )
				.toEqual( [ 'source-layer-2', 'Unsaved page two' ] );
			expect( preview.editorState.layers.map( layer => layer.text ) ).toContain( 'Unsaved temporary page one' );
			expect( preview.activeSurfaceId ).toBe( WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 ) );
			expect( preview.preparedMembers.map( member => member.page ).sort() ).toEqual( [ 1 ] );
			expect( binding.getReadEvidence( handle ).result.targetGroup.members ).toEqual( [ { page: 2, surfaceId: 'anchor' } ] );
			expect( witness( work ) ).toBe( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it( 'supports replace while preserving file pins, canvas geometry and unrelated surfaces in the candidate', async () => {
		const { work, binding, request } = await setup( [ 1, 2 ], 'replace' );
		try {
			await editedPage( work, 1, 'Target only' );
			const before = witness( work ), handle = await binding.prepare( request ), preview = binding.inspect( handle );
			const targetOnly = preview.candidateSnapshot.surfaces.find( surface => surface.source.page === 1 &&
				surface.source.fileTitle === 'File:Example.pdf' );
			expect( targetOnly.layers.map( layer => layer.text ) ).toEqual( [ 'source-layer-1' ] );
			expect( targetOnly.source ).toEqual( { ...work.base.surfaces.find( surface => surface.id === 'anchor' ).source, page: 1 } );
			expect( targetOnly.canvas.width ).toBe( 208 );
			expect( preview.candidateSnapshot.surfaces.find( surface => surface.id === 'other-file' ) )
				.toEqual( work.base.surfaces.find( surface => surface.id === 'other-file' ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'keeps target only temporary pages when absent from source in append and clears only their layers in replace', async () => {
		for ( const mode of [ 'append', 'replace' ] ) {
			const { work, binding, request } = await setup( [ 2 ], mode );
			try {
				await editedPage( work, 1, 'Target only unsaved' );
				const before = witness( work ), preview = binding.inspect( await binding.prepare( request ) );
				const only = preview.candidateSnapshot.surfaces.find( surface => surface.source.fileTitle === 'File:Example.pdf' && surface.source.page === 1 );
				expect( only.id ).toBe( WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 ) );
				expect( only.layers.some( layer => layer.text === 'Target only unsaved' ) ).toBe( mode === 'append' );
				expect( witness( work ) ).toBe( before );
			} finally { work.close(); }
		}
	} );

	it( 'uses native blank admissions only when no live temporary member exists', async () => {
		const { work, binding, request } = await setup();
		try {
			const preview = binding.inspect( await binding.prepare( request ) );
			const admitted = preview.preparedMembers.find( member => member.page === 1 );
			expect( admitted.surfaceId ).toBe( WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 ) );
			expect( admitted.context.surface.layers ).toEqual( [] );
			expect( admitted.origin ).toBeDefined();
		} finally { work.close(); }
	} );

	it( 'retains and reconciles a historical temporary admission after the target page advances', async () => {
		const { work, binding, request } = await setup();
		try {
			await editedPage( work, 1, 'Historical temporary work' );
			const next = copy( work.base );
			next.metadata.server = 'revision 13';
			work.api.get.mockImplementation( params => Promise.resolve( params.editorpage ?
				{ layersread: { editor: work.context( params.editorpage, params.revid, next ) } } :
				{ layersread: { revisionId: params.revid, snapshot: copy( next ), sourceGeometry: [] } } ) );
			await work.session.reconcile( 13 );
			const readsBeforePrepare = work.api.get.mock.calls.length;
			const before = witness( work ), handle = await binding.prepare( request ), preview = binding.inspect( handle );
			const page = preview.candidateSnapshot.surfaces.find( surface => surface.source.fileTitle === 'File:Example.pdf' && surface.source.page === 1 );
			expect( page.id ).toBe( WorkingSet.surfaceId( 7, 12, 'File:Example.pdf', 'ABC', 1 ) );
			expect( page.layers.map( layer => layer.text ) ).toContain( 'Historical temporary work' );
			expect( work.api.get.mock.calls.slice( readsBeforePrepare ).some( call =>
				call[ 0 ].revid === 12 && call[ 0 ].editorpage === undefined ) ).toBe( true );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses a fabricated prior admission association without changing the draft', async () => {
		const { work, binding, request } = await setup();
		try {
			await editedPage( work, 1, 'Associated temporary page' );
			const admission = work.session._pdf.admissions.get( work.session.getPdfStatus().activeSurfaceId );
			admission.surface.id = 'fabricated-id';
			const before = witness( work );
			await unavailable( binding.prepare( request ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'cancels without reads or allocation', async () => {
		const { work, api, binding, request } = await setup();
		try {
			request.mode = 'cancel';
			request.allocateId.mockClear();
			const beforeReads = work.api.get.mock.calls.length;
			await expect( binding.prepare( request ) ).resolves.toBeNull();
			expect( api.post ).not.toHaveBeenCalled();
			expect( work.api.get ).toHaveBeenCalledTimes( beforeReads );
			expect( request.allocateId ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it.each( [ 'wrong target pin', 'wrong source owner', 'wrong target count', 'duplicate page admission', 'foreign admission id' ] )(
		'refuses malformed native data without changing session/history: %s', async issue => {
			const { work, binding, request } = await setup( [ 1, 2 ], 'append', data => {
				if ( issue === 'wrong target pin' ) { data.admittedTargetSurfaces[ 0 ].source.sha1 = 'c'.repeat( 31 ); }
				if ( issue === 'wrong source owner' ) { data.source.owner = 'Owner'; }
				if ( issue === 'wrong target count' ) { data.targetGroup.pageCount = 1; }
				if ( issue === 'duplicate page admission' ) { data.admittedTargetSurfaces.push( copy( data.admittedTargetSurfaces[ 0 ] ) ); }
				if ( issue === 'foreign admission id' ) { data.admittedTargetSurfaces[ 0 ].id = 'foreign-id'; }
			} );
			try {
				const before = witness( work );
				await unavailable( binding.prepare( request ) );
				expect( witness( work ) ).toBe( before );
				expect( work.api.postWithToken ).not.toHaveBeenCalled();
			} finally { work.close(); }
		}
	);

	it( 'detects live page or history changes while the native read is pending', async () => {
		for ( const change of [ 'page edit', 'history' ] ) {
			const { work, api, binding, request } = await setup();
			try {
				await work.bridge.capture();
				let finish;
				api.post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
				const promise = binding.prepare( request );
				if ( change === 'page edit' ) { work.edit( 'Late edit' ); work.bridge.capture(); }
				else { work.editor.historyManager.saveState( 'Late history state' ); }
				finish( response( payload( work ) ) );
				await unavailable( promise );
				expect( work.api.postWithToken ).not.toHaveBeenCalled();
			} finally { work.close(); }
		}
	} );

	it( 'revalidates native data and rejects denial or changed membership without mutating editor state', async () => {
		const valid = await setup();
		try {
			const before = witness( valid.work ), handle = await valid.binding.prepare( valid.request );
			await expect( valid.binding.revalidate( handle ) ).resolves.toBeUndefined();
			expect( witness( valid.work ) ).toBe( before );
		} finally { valid.work.close(); }
		for ( const mode of [ 'changed', 'denied' ] ) {
			const { work, api, binding, request } = await setup();
			try {
				const before = witness( work ), handle = await binding.prepare( request );
				if ( mode === 'changed' ) { api.post.mockResolvedValueOnce( response( payload( work, [ 2 ] ) ) ); }
				else { api.post.mockRejectedValueOnce( new Error( 'private server detail' ) ); }
				await unavailable( binding.revalidate( handle ) );
				expect( witness( work ) ).toBe( before );
			} finally { work.close(); }
		}
	} );

	it( 'rejects API replacement and release during a pending revalidation', async () => {
		const replaced = await setup();
		try {
			const handle = await replaced.binding.prepare( replaced.request );
			replaced.api.post = jest.fn( () => Promise.resolve( response( payload( replaced.work ) ) ) );
			await unavailable( Promise.resolve().then( () => replaced.binding.inspect( handle ) ) );
		} finally { replaced.work.close(); }
		const pending = await setup();
		try {
			const handle = await pending.binding.prepare( pending.request );
			let finish;
			pending.api.post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
			const check = pending.binding.revalidate( handle );
			pending.binding.release( handle );
			finish( response( payload( pending.work ) ) );
			await unavailable( check );
		} finally { pending.work.close(); }
	} );

	it( 'returns detached read evidence and preview, refuses counterfeit and released handles', async () => {
		const { work, binding, request } = await setup();
		try {
			const handle = await binding.prepare( request );
			const preview = binding.inspect( handle );
			preview.candidateSnapshot.surfaces[ 0 ].layers.push( textLayer( 'mutated-preview' ) );
			expect( binding.inspect( handle ).candidateSnapshot.surfaces[ 0 ].layers ).not.toContainEqual( textLayer( 'mutated-preview' ) );
			const evidence = binding.getReadEvidence( handle );
			evidence.result.targetGroup.label = 'mutated-evidence';
			expect( binding.getReadEvidence( handle ).result.targetGroup.label ).toBe( 'ABC' );
			await unavailable( Promise.resolve().then( () => binding.inspect( Object.freeze( Object.create( null ) ) ) ) );
			binding.release( handle );
			await unavailable( Promise.resolve().then( () => binding.inspect( handle ) ) );
		} finally { work.close(); }
	} );

	it( 'detects dispose during a pending native read and performs no partial session update', async () => {
		const { work, api, binding, request } = await setup();
		try {
			const before = witness( work );
			let finish;
			api.post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
			const pending = binding.prepare( request );
			binding.dispose();
			finish( response( payload( work ) ) );
			await unavailable( pending );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses a consistent fabricated fresh admission ID without issuing an application handle', async () => {
		const { work, binding, request } = await setup( [ 1, 2 ], 'append', data => {
			const old = data.admittedTargetSurfaces[ 0 ].id;
			data.admittedTargetSurfaces[ 0 ].id = 'fabricated-native-id';
			for ( const key of [ 'admittedTargetGeometry', 'admittedTargetRenditions' ] ) {
				data[ key ][ 'fabricated-native-id' ] = data[ key ][ old ]; delete data[ key ][ old ];
			}
		} );
		try {
			const before = witness( work );
			await unavailable( binding.prepare( request ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'rejects a plausible historical origin when the authorized old revision already had that PDF member', async () => {
		const { work, binding, request } = await setup();
		try {
			await editedPage( work, 1, 'Historical pending layers' );
			await work.bridge.reconcile( 13 );
			const original = work.api.get.getMockImplementation();
			work.api.get.mockImplementation( params => {
				if ( params.revid === 12 && !params.editorpage ) {
					const snapshot = copy( work.base );
					snapshot.surfaces.push( { ...copy( work.context( 1 ).surface ), id: 'already-stored-at-12' } );
					return Promise.resolve( { layersread: { revisionId: 12, snapshot, sourceGeometry: [] } } );
				}
				return original( params );
			} );
			const before = witness( work );
			await unavailable( binding.prepare( request ) );
			expect( witness( work ) ).toBe( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it( 'rejects offscreen nested edits with its independent complete-session witness', async () => {
		const { work, api, binding, request } = await setup();
		try {
			request.assertCurrent = () => {};
			let finish;
			api.post.mockImplementationOnce( () => new Promise( resolve => { finish = resolve; } ) );
			const preparing = binding.prepare( request );
			work.session._snapshot.surfaces.find( member => member.id === 'other-file' ).layers[ 0 ].text = 'Latest offscreen edit';
			const before = witness( work );
			finish( response( payload( work ) ) );
			await unavailable( preparing );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'imports into a completely empty live group without changing its saved base', async () => {
		const { work, binding, request } = await setup( [ 1, 2 ], 'empty' );
		try {
			work.editor.stateManager.set( 'layers', [] );
			work.editor.historyManager.saveState( 'Clear target' );
			work.bridge.capture();
			const before = witness( work ), preview = binding.inspect( await binding.prepare( request ) );
			expect( preview.candidateSnapshot.surfaces.find( member => member.id === 'anchor' ).layers.map( layer => layer.text ) )
				.toStrictEqual( [ 'source-layer-2' ] );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'freshly admits an unedited active target-only page without inserting it into the candidate document', async () => {
		const { work, binding, request } = await setup( [ 2 ] );
		try {
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			const before = witness( work ), activeId = work.session.getPdfStatus().activeSurfaceId;
			const preview = binding.inspect( await binding.prepare( request ) );
			expect( preview.activeSurfaceId ).toBe( activeId );
			expect( preview.editorState.layers ).toStrictEqual( [] );
			expect( preview.candidateSnapshot.surfaces.some( member => member.id === activeId ) ).toBe( false );
			expect( preview.preparedMembers.find( member => member.page === 1 ).context.stored ).toBe( false );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses changed target-only native rendition evidence during fresh revalidation', async () => {
		const { work, binding, request } = await setup( [ 2 ] );
		try {
			await editedPage( work, 1, 'Keep target-only work' );
			const handle = await binding.prepare( request ), original = work.api.get.getMockImplementation();
			work.api.get.mockImplementation( async params => {
				const result = await original( params );
				if ( params.editorpage ) { result.layersread.editor.rendition.width++; }
				return result;
			} );
			const before = witness( work );
			await unavailable( binding.revalidate( handle ) );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'refuses a late history edit during the separate native admission read', async () => {
		const { work, binding, request } = await setup( [ 2 ] );
		try {
			await editedPage( work, 1, 'Current target-only work' );
			const original = work.api.get.getMockImplementation();
			let finish, reached;
			const waiting = new Promise( resolve => { reached = resolve; } );
			work.api.get.mockImplementation( params => {
				if ( params.editorpage ) {
					reached(); return new Promise( resolve => { finish = () => resolve( original( params ) ); } );
				}
				return original( params );
			} );
			const preparing = binding.prepare( request );
			await waiting;
			work.editor.historyManager.saveState( 'Newer history entry' );
			const before = witness( work );
			finish();
			await unavailable( preparing );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'rejects request accessors without invoking them or contacting native transport', async () => {
		const { work, api, binding, request } = await setup();
		try {
			const getter = jest.fn();
			Object.defineProperty( request, 'source', { enumerable: true, get: getter } );
			await unavailable( binding.prepare( request ) );
			expect( getter ).not.toHaveBeenCalled();
			expect( api.post ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );
