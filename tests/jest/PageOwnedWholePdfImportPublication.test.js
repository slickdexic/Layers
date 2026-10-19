'use strict';

// The companion history suite imports helpers without registering these cases.
global.TextEncoder = global.TextEncoder || require( 'util' ).TextEncoder;
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Binding = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSession.js' );
const WholeSource = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportSource.js' );
const PdfReadClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const PublishClient = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportPublishClient.js' );
require( '../../resources/ext.layers.editor/selection/SelectionState.js' );
require( '../../resources/ext.layers.editor/SelectionManager.js' );
const Application = require( '../../resources/ext.layers.editor/PageOwnedWholePdfImportApplication.js' );
const SelectionManager = window.Layers.Core.SelectionManager;

const copy = value => JSON.parse( JSON.stringify( value ) );
const nativeCalls = api => api.postWithToken.mock.calls.filter( ( [ , params ] ) => params.action === 'layersworkingcopypdfimportpublish' );
const ordinaryCalls = api => api.postWithToken.mock.calls.filter( ( [ , params ] ) => params.action === 'layerspublish' );
const sourcePin = { repository: 'local', fileTitle: 'File:Example.pdf', timestamp: '20261007120000', sha1: 'a'.repeat( 31 ) };
let allocation = 0;

function readResponse( payload ) {
	const json = Array.from( JSON.stringify( payload ), char => {
		const point = char.codePointAt( 0 );
		if ( point <= 127 ) { return char; }
		if ( point <= 0xffff ) { return '\\u' + point.toString( 16 ).padStart( 4, '0' ); }
		const adjusted = point - 0x10000;
		return '\\u' + ( 0xd800 + ( adjusted >> 10 ) ).toString( 16 ) + '\\u' + ( 0xdc00 + ( adjusted & 0x3ff ) ).toString( 16 );
	} ).join( '' );
	return { layersworkingcopypdfimportread: { version: 1, data: json } };
}

function layer( id, text = id ) { return { id, type: 'text', text, x: -17 }; }

function importPayload( work, pages = [ 1, 2 ], tweak = () => {}, sourceRevisionId = 42 ) {
	const base = copy( JSON.parse( work.session._savedJson ) );
	const anchor = base.surfaces.find( member => member.id === 'anchor' );
	const pin = { ...anchor.source }; delete pin.page;
	const targetMembers = base.surfaces.filter( member => member.kind === 'pdf' &&
		member.label === anchor.label && member.source.fileTitle === anchor.source.fileTitle );
	const sourceMembers = pages.map( page => {
		const target = page === 2 ? anchor : work.context( page ).surface;
		return { ...copy( target ), id: 'source-p' + page, label: 'ABC', source: { ...pin, page },
			layers: [ layer( 'source-layer-' + page, 'Imported PDF page ' + page ) ] };
	} );
	const bundle = ( revisionId, members ) => ( { revisionId,
		snapshot: { schemaVersion: 1, surfaces: members },
		sourceGeometry: Object.fromEntries( members.map( member => [ member.id,
			{ page: member.source.page, width: 416, height: 208, units: 'file-handler-pixels' } ] ) ),
		sourceRenditions: Object.fromEntries( members.map( member => [ member.id,
			{ url: 'https://example.test/source/' + member.id, width: 415, height: 207 } ] ) ) } );
	const admitted = pages.includes( 1 ) && !targetMembers.some( member => member.source.page === 1 ) ?
		[ copy( work.context( 1, work.session._revisionId, base ).surface ) ] : [];
	const result = {
		target: { pageId: 7, owner: 'Owner', revisionId: work.session._revisionId, surfaceId: 'anchor' },
		source: { pageId: 9, owner: 'Source_owner', revisionId: sourceRevisionId, surfaceId: 'source-p2' },
		targetBundle: { ...bundle( work.session._revisionId, targetMembers ), snapshot: base },
		sourceBundle: bundle( sourceRevisionId, sourceMembers ),
		targetGroup: { label: 'ABC', source: pin, pageCount: 2,
			members: targetMembers.map( member => ( { page: member.source.page, surfaceId: member.id } ) ) },
		sourceGroup: { label: 'ABC', source: pin, pageCount: 2,
			members: sourceMembers.map( member => ( { page: member.source.page, surfaceId: member.id } ) ) },
		admittedTargetSurfaces: admitted,
		admittedTargetGeometry: Object.fromEntries( admitted.map( member => [ member.id,
			{ page: member.source.page, width: 208, height: 416, units: 'file-handler-pixels' } ] ) ),
		admittedTargetRenditions: Object.fromEntries( admitted.map( member => [ member.id,
			{ url: 'https://example.test/admitted/' + member.id, width: 208, height: 416 } ] ) )
	};
	tweak( result ); return result;
}

function importOptions( work, sourceRevisionId = 42 ) {
	const generation = ++allocation; let next = 0;
	let initial;
	return { source: { pageId: 9, revisionId: sourceRevisionId, surfaceId: 'source-p2' }, mode: 'append', maxLayers: 20,
		allocateId: jest.fn( () => 'publication-import-' + generation + '-' + ++next ),
		assertCurrent: () => {
			const now = work.bridge.pdfCoordinator.witness( true );
			if ( initial === undefined ) { initial = now; }
			if ( now !== initial ) { throw new Error( 'Editor participants changed' ); }
		} };
}

function witness( work ) {
	return JSON.stringify( { base: work.session._savedJson, revision: work.session._revisionId,
		snapshot: work.session._snapshot, temporary: Array.from( work.session._pdf.temporary ),
		admissions: Array.from( work.session._pdf.admissions ),
		live: work.bridge.getLiveState(), pdf: work.session.getPdfStatus(),
		timelines: Array.from( work.bridge.pdfCoordinator.timelines ),
		history: work.editor.historyManager.captureTimeline() } );
}

async function setup( { optIn = true, sparse = true } = {} ) {
	const work = await fixture( sparse );
	work.editor.canvasManager.selectionManager = new SelectionManager( {}, work.editor.canvasManager );
	let server = copy( work.base ), revisionId = 12;
	work.api.get.mockImplementation( params => Promise.resolve( { layersread: params.editorpage ?
		{ editor: work.context( params.editorpage, revisionId, server ) } :
		{ revisionId: params.revid, snapshot: copy( server ), sourceGeometry: [] } } ) );
	const api = work.api, ordinaryPost = work.api.postWithToken;
	ordinaryPost.mockImplementation( ( _token, params ) => {
		server = JSON.parse( params.data ); revisionId++;
		return Promise.resolve( params.action === 'layersworkingcopypdfimportpublish' ?
			{ layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: revisionId } } :
			{ layerspublish: { result: 'Success', revid: revisionId } } );
	} );
	const sourceApi = { post: jest.fn( () => Promise.resolve( readResponse( importPayload( work ) ) ) ) };
	const source = new WholeSource( sourceApi );
	const binding = new Binding( work.session, source, new PdfReadClient( work.api ) );
	const application = new Application( work.bridge, binding );
	const publishClient = new PublishClient( api );
	if ( optIn ) { application.enableHistory(); application.enablePublication( publishClient ); }
	work.binding = binding;
	return { work, api, sourceApi, source, binding, application, publishClient, ordinaryPost,
		request: importOptions( work ), setServer: value => { server = copy( value ); }, getServer: () => copy( server ),
		setRevision: value => { revisionId = value; }, getRevision: () => revisionId };
}

async function applyImport( work, application, request ) {
	const handle = await application.prepare( request ); return application.apply( handle );
}

async function editPage( work, page, text ) {
	if ( work.editor.page !== page && !await work.bridge.pdfCoordinator.turn( page ) ) { throw new Error( 'PDF page turn failed' ); }
	work.edit( text ); work.bridge.capture();
}

async function successfulSave( work, summary = 'Whole PDF Import Save test', beforePublish ) {
	return work.bridge.save( summary, beforePublish );
}

const helpers = { copy, layer, importPayload, importOptions, witness, setup, applyImport, editPage, successfulSave, nativeCalls, ordinaryCalls };
module.exports = helpers;

if ( typeof describe === 'function' && expect.getState().testPath.endsWith( 'PageOwnedWholePdfImportPublication.test.js' ) ) {
describe( 'PageOwnedWholePdfImportPublication', () => {
	it( 'keeps the ordinary Save path unchanged until explicit publication opt-in', async () => {
		const { work, api, application } = await setup( { optIn: false } );
		try {
			expect( application.enablePublication ).toBeInstanceOf( Function );
			expect( nativeCalls( api ) ).toHaveLength( 0 );
			await successfulSave( work );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
			expect( nativeCalls( api ) ).toHaveLength( 0 );
		} finally { work.close(); }
	} );

	it( 'routes ordinary bridge Save through the native whole-PDF endpoint after explicit opt-in', async () => {
		const { work, api, request, application } = await setup();
		try {
			const applied = await applyImport( work, application, request );
			const result = await successfulSave( work, 'Import complete' );
			expect( result.revisionId ).toBeGreaterThan( 12 );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
			const [ token, params ] = nativeCalls( api )[ 0 ];
			expect( token ).toBe( 'csrf' );
			expect( params.action ).toBe( 'layersworkingcopypdfimportpublish' );
			expect( params.targetpageid ).toBe( 7 );
			expect( params.baserevid ).toBe( 12 );
			expect( JSON.parse( params.importsources ) ).toEqual( expect.arrayContaining( [
				expect.objectContaining( { sourcePageId: 9, sourceRevisionId: 42, sourceSurfaceId: 'source-p2' } )
			] ) );
			expect( JSON.parse( params.data ).surfaces ).toEqual( applied.candidateSnapshot.surfaces );
		} finally { work.close(); }
	} );

	it( 'publishes the exact complete snapshot and binds the acknowledged native base', async () => {
		const { work, api, request, application } = await setup();
		try {
			const applied = await applyImport( work, application, request );
			const requestJson = copy( work.session._snapshot );
			const saved = await successfulSave( work, 'Complete imported PDF' );
			const params = nativeCalls( api )[ 0 ][ 1 ];
			expect( JSON.parse( params.data ) ).toEqual( requestJson );
			expect( saved.revisionId ).toBe( work.session._revisionId );
			expect( work.session._savedJson ).toBe( params.data );
			expect( JSON.parse( work.session._savedJson ).surfaces ).toHaveLength( applied.candidateSnapshot.surfaces.length );
			expect( work.session.getStatus().dirty ).toBe( false );
		} finally { work.close(); }
	} );

	it( 'forwards a source citation and exact historical admission records once', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const pending = work.binding.getImportPublication();
			expect( pending.sources.length ).toBeGreaterThan( 0 );
			const expected = copy( pending );
			await successfulSave( work );
			const params = nativeCalls( api )[ 0 ][ 1 ];
			expect( JSON.parse( params.importsources ) ).toEqual( expected.sources );
			expect( JSON.parse( params.admissionrevisions ) ).toEqual( expected.admissionRevisions );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'does not call the whole-PDF publisher when there are no retained source citations', async () => {
		const { work, api } = await setup();
		try {
			await successfulSave( work, 'Ordinary edit' );
			expect( nativeCalls( api ) ).toHaveLength( 0 );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'uses the ordinary publisher for an opted-in Save after an Import citation is fully acknowledged', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request ); await successfulSave( work );
			work.edit( 'Later ordinary text edit' ); work.bridge.capture();
			await successfulSave( work, 'Later ordinary Save' );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'keeps newly admitted whole-PDF page identity and pins in the saved snapshot', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request ); await successfulSave( work );
			const saved = JSON.parse( nativeCalls( api )[ 0 ][ 1 ].data );
			const pages = saved.surfaces.filter( member => member.kind === 'pdf' && member.source.fileTitle === 'File:Example.pdf' );
			expect( pages.map( member => member.source.page ).sort() ).toEqual( [ 1, 2 ] );
			for ( const member of pages ) {
				expect( member.label ).toBe( 'ABC' );
				expect( member.source.repository ).toBe( 'local' );
				expect( member.source.timestamp ).toBe( sourcePin.timestamp );
				expect( member.source.sha1 ).toBe( sourcePin.sha1 );
			}
		} finally { work.close(); }
	} );

	it( 'preserves unrelated slides and PDF members in the complete saved snapshot', async () => {
		const { work, api, request, application } = await setup( { sparse: false } );
		try {
			await applyImport( work, application, request ); await successfulSave( work );
			const saved = JSON.parse( nativeCalls( api )[ 0 ][ 1 ].data );
			expect( saved.surfaces.find( member => member.id === 'other-file' ) ).toEqual( work.base.surfaces.find( member => member.id === 'other-file' ) );
			expect( saved.metadata ).toEqual( work.base.metadata );
		} finally { work.close(); }
	} );

	it( 'uses exactly one native request and never retries an unknown response', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const before = witness( work );
			api.postWithToken.mockRejectedValueOnce( { error: { code: 'layers-publication-outcome-unknown' } } );
			await expect( successfulSave( work ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
			expect( work.session._revisionId ).toBe( 12 );
			expect( JSON.parse( witness( work ) ).snapshot ).toEqual( JSON.parse( before ).snapshot );
			expect( JSON.parse( witness( work ) ).base ).toBe( JSON.parse( before ).base );
		} finally { work.close(); }
	} );

	it.each( [ 'nonadvancing revision', 'wrong result version', 'wrong action envelope', 'extra response field' ] )(
		'refuses malformed native success without confirming Save: %s', async issue => {
			const { work, api, request, application } = await setup();
			try {
				await applyImport( work, application, request );
				const before = witness( work ), normal = api.postWithToken.getMockImplementation();
				api.postWithToken.mockImplementationOnce( ( token, params ) => {
					const base = params.baserevid;
					if ( issue === 'nonadvancing revision' ) { return Promise.resolve( { layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: base } } ); }
					if ( issue === 'wrong result version' ) { return Promise.resolve( { layersworkingcopypdfimportpublish: { version: 2, result: 'Success', revid: base + 1 } } ); }
					if ( issue === 'wrong action envelope' ) { return Promise.resolve( { other: { version: 1, result: 'Success', revid: base + 1 } } ); }
					return normal( token, params ).then( result => ( { ...result,
						layersworkingcopypdfimportpublish: { ...result.layersworkingcopypdfimportpublish, extra: true } } ) );
				} );
				await expect( successfulSave( work ) ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
				expect( nativeCalls( api ) ).toHaveLength( 1 );
				expect( work.session._revisionId ).toBe( 12 );
				expect( JSON.parse( witness( work ) ).snapshot ).toEqual( JSON.parse( before ).snapshot );
				expect( witness( work ) ).toBe( before );
			} finally { work.close(); }
		}
	);

	it( 'keeps private import claims and history unchanged when beforePublish refuses', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const before = witness( work ), claims = copy( work.binding.getImportPublication().sources );
			await expect( successfulSave( work, 'Refused', () => { throw new Error( 'preflight refused' ); } ) ).rejects.toThrow();
			expect( nativeCalls( api ) ).toHaveLength( 0 );
			expect( work.binding.getImportPublication().sources ).toEqual( claims );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'does not post when source identity or retained private claims change during beforePublish', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const claims = work.binding.getImportPublication().sources;
			await expect( successfulSave( work, 'Tampered source', () => {
				work.session._pdf.admissions.clear();
			} ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
			expect( claims.length ).toBeGreaterThan( 0 );
			expect( nativeCalls( api ) ).toHaveLength( 0 );
		} finally { work.close(); }
	} );

	it( 'keeps newer ordinary edits made while the native request is pending', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			let resolve;
			api.postWithToken.mockImplementationOnce( ( _token, params ) => new Promise( done => {
				resolve = () => done( { layersworkingcopypdfimportpublish:
					{ version: 1, result: 'Success', revid: params.baserevid + 1 } } );
			} ) );
			const pending = successfulSave( work, 'Pending Import Save' );
			const sent = nativeCalls( api )[ 0 ][ 1 ].data;
			await editPage( work, 2, 'Newer edit while Save is pending' );
			resolve(); await pending;
			expect( work.session._savedJson ).toBe( sent );
			expect( JSON.stringify( work.session._snapshot ) ).toContain( 'Newer edit while Save is pending' );
			expect( work.session.getStatus().dirty ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'clears only acknowledged current source claims and retains unsubmitted redo claims', async () => {
		const { work, api, sourceApi, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const acknowledged = copy( work.binding.getImportPublication().sources );
			sourceApi.post.mockImplementation( () => Promise.resolve( readResponse( importPayload( work,
				[ 1, 2 ], () => {}, 43 ) ) ) );
			const second = await application.prepare( importOptions( work, 43 ) ); await application.apply( second );
			const unsubmitted = copy( work.binding.getImportPublication().sources ).filter( citation => citation.sourceRevisionId === 43 );
			const submitted = copy( work.binding.getImportPublication().sources ).filter( citation => citation.sourceRevisionId === 42 );
			expect( unsubmitted ).not.toEqual( acknowledged );
			work.editor.historyManager.undo();
			expect( work.binding.getImportPublication().sources ).toEqual( submitted );
			await successfulSave( work );
			expect( work.binding.getImportPublication().sources ).toEqual( [] );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.binding.getImportPublication().sources ).toEqual( expect.arrayContaining( unsubmitted ) );
			expect( work.binding.getImportPublication().sources ).not.toEqual( expect.arrayContaining( submitted ) );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'retains whole-group Undo and Redo commands after a successful Save', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const imported = copy( work.session._snapshot );
			const before = application.captureDraft().history.groups.map( group => ( { id: group.id, phase: group.phase, retired: group.retired } ) );
			await successfulSave( work );
			const after = application.captureDraft().history.groups.map( group => ( { id: group.id, phase: group.phase, retired: group.retired } ) );
			expect( after ).toEqual( before );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session._snapshot ).toEqual( imported );
		} finally { work.close(); }
	} );

	it( 'reconciles the saved blank admission into prior group checkpoints without changing unrelated members', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const importedPage = work.session._snapshot.surfaces.find( member => member.kind === 'pdf' &&
				member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 );
			const unrelated = copy( work.base.surfaces.find( member => member.id === 'other-file' ) );
			await successfulSave( work );
			expect( work.editor.historyManager.undo() ).toBe( true );
			const page = work.session._snapshot.surfaces.find( member => member.id === importedPage.id &&
				member.source.fileTitle === 'File:Example.pdf' );
			expect( page ).toBeDefined(); expect( page.source ).toEqual( importedPage.source ); expect( page.layers ).toEqual( [] );
			expect( work.session._snapshot.surfaces.find( member => member.id === 'other-file' ) ).toEqual( unrelated );
		} finally { work.close(); }
	} );

	it( 'preserves the active PDF page through native Save and later page turns', async () => {
		const { work, request, application } = await setup();
		try {
			await work.bridge.pdfCoordinator.turn( 1 ); await applyImport( work, application, request );
			const page = work.editor.page; await successfulSave( work );
			expect( work.editor.page ).toBe( page );
			for ( const next of [ 2, 1 ] ) {
				expect( await work.bridge.pdfCoordinator.turn( next ) ).toBe( true );
				const member = work.session._snapshot.surfaces.find( value => value.id === work.session.getPdfStatus().activeSurfaceId );
				expect( work.editor.stateManager.get( 'layers' ) ).toEqual( member.layers );
			}
		} finally { work.close(); }
	} );

	it( 'does not activate publication routing before explicit opt-in', async () => {
		const { work, api, application } = await setup( { optIn: false } );
		try {
			const before = application.captureDraft;
			expect( typeof before ).toBe( 'function' );
			expect( work.editor.apiManager.pageOwnedBridge ).toBe( work.bridge );
			expect( nativeCalls( api ) ).toHaveLength( 0 );
			expect( work.bridge.save ).toBeInstanceOf( Function );
		} finally { work.close(); }
	} );

	it( 'releases publication route cleanly on application disposal without confirming outstanding claims', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const before = witness( work );
			application.dispose();
			await expect( successfulSave( work ) ).rejects.toBeInstanceOf( Error );
			expect( nativeCalls( api ) ).toHaveLength( 0 );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it.each( [ 'layers-owner-edit-denied', 'layers-invalid-publication-request', 'layers-invalid-snapshot',
		'layers-source-unavailable', 'layers-admission-unauthorized', 'layers-slot-removal-denied',
		'layers-content-not-renderable', 'layers-edit-filtered', 'layers-publication-disabled',
		'layers-main-model-change-denied', 'badtoken', 'permissiondenied', 'ratelimited', 'layers-edit-conflict' ] )(
		'preserves complete work and saved markers on native refusal: %s', async code => {
			const { work, api, request, application } = await setup();
			try {
				await applyImport( work, application, request );
				const before = witness( work ), claims = copy( work.binding.getImportPublication().sources );
				api.postWithToken.mockRejectedValueOnce( { error: { code } } );
				await expect( successfulSave( work ) ).rejects.toMatchObject( { code } );
				expect( witness( work ) ).toBe( before );
				expect( nativeCalls( api ) ).toHaveLength( 1 );
				expect( work.session.getStatus().phase ).toBe( code === 'layers-edit-conflict' ? 'conflict' : 'ready' );
				if ( code !== 'layers-edit-conflict' ) { expect( work.binding.getImportPublication().sources ).toEqual( claims ); }
			} finally { work.close(); }
		}
	);

	it( 'refuses a fabricated confirmation proof without changing the saved base or history', async () => {
		const { work, binding, api } = await setup();
		try {
			const before = witness( work ), receipt = binding.prepareImportPublication( [], () => {}, () => {} );
			binding.beginImportPublication( receipt );
			expect( () => binding.preparePublicationConfirmation( receipt, { revisionId: 13 } ) ).toThrow();
			expect( witness( work ) ).toBe( before );
			expect( api.postWithToken ).not.toHaveBeenCalled(); binding.releaseImportPublication( receipt );
		} finally { work.close(); }
	} );

	it( 'does not install a fabricated bridge route certificate', async () => {
		const { work, application, api } = await setup( { optIn: false } );
		try {
			expect( () => work.bridge.enableWholePdfImportPublication( application, {} ) ).toThrow();
			await successfulSave( work );
			expect( nativeCalls( api ) ).toHaveLength( 0 ); expect( ordinaryCalls( api ) ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'does not grant confirmation authority to a replacement publisher method', async () => {
		const { work, application, publishClient, api } = await setup( { optIn: false } );
		try {
			application.enableHistory(); publishClient.publish = jest.fn( () => Promise.resolve( { revisionId: 13 } ) );
			expect( () => application.enablePublication( publishClient ) ).toThrow();
			expect( api.postWithToken ).not.toHaveBeenCalled(); expect( publishClient.publish ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it( 'refuses Save while an unapplied Import preview remains open', async () => {
		const { work, application, request, api } = await setup();
		try {
			const handle = await application.prepare( request ), before = witness( work );
			await expect( successfulSave( work ) ).rejects.toMatchObject( { code: 'layers-working-copy-import-unavailable' } );
			expect( witness( work ) ).toBe( before ); expect( api.postWithToken ).not.toHaveBeenCalled();
			application.release( handle ); await successfulSave( work ); expect( ordinaryCalls( api ) ).toHaveLength( 1 );
		} finally { work.close(); }
	} );

	it( 'treats changed participants after dispatch as uncertain without confirming the request', async () => {
		const { work, application, request, api } = await setup();
		try {
			await applyImport( work, application, request ); const before = witness( work );
			let resolve; api.postWithToken.mockImplementationOnce( () => new Promise( done => { resolve = done; } ) );
			const pending = successfulSave( work ); pending.catch( () => {} );
			work.editor.canvasManager.editor = {};
			resolve( { layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: 13 } } );
			await expect( pending ).rejects.toMatchObject( { code: 'layers-publication-outcome-unknown' } );
			work.editor.canvasManager.editor = work.editor;
			expect( witness( work ) ).toBe( before ); expect( work.session.getStatus().phase ).toBe( 'uncertain' );
			expect( nativeCalls( api ) ).toHaveLength( 1 );
		} finally { work.close(); }
	} );
} );
}
