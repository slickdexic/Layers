'use strict';

// Importing the sibling file supplies only its fixture helpers; its tests are
// registered only when Jest is running that sibling directly.
const { copy, setup, applyImport, importOptions, editPage, successfulSave, witness, nativeCalls, ordinaryCalls } = require( './PageOwnedWholePdfImportPublication.test.js' );

const groups = application => application.captureDraft().history.groups.map( group => ( {
	id: group.id, phase: group.phase, retired: group.retired, entries: group.entries
} ) );
const contents = timeline => ( { history: timeline.history, historyIndex: timeline.historyIndex,
	maxHistorySteps: timeline.maxHistorySteps } );

if ( typeof describe === 'function' && expect.getState().testPath.endsWith( 'PageOwnedWholePdfImportPublicationHistory.test.js' ) ) {
describe( 'PageOwnedWholePdfImportPublicationHistory', () => {
	it( 'keeps whole-PDF history unregistered until the application opts in', async () => {
		const { work, application } = await setup( { optIn: false } );
		try {
			const before = work.editor.historyManager.captureTimeline();
			expect( work.editor.historyManager.hasPdfImportHistory( application ) ).toBe( false );
			expect( before.history.some( entry => entry.pdfImportGroup ) ).toBe( false );
		} finally { work.close(); }
	} );

	it( 'keeps the complete group Undoable after Save from the after phase', async () => {
		const { work, request, application } = await setup();
		try {
			const base = copy( work.session._snapshot ); await applyImport( work, application, request );
			const imported = copy( work.session._snapshot );
			const before = application.captureDraft().history.groups.map( group => ( { id: group.id, phase: group.phase } ) );
			await successfulSave( work );
			expect( application.captureDraft().history.groups.map( group => ( { id: group.id, phase: group.phase } ) ) ).toEqual( before );
			expect( work.editor.historyManager.undo() ).toBe( true );
			for ( const member of base.surfaces ) {
				expect( work.session._snapshot.surfaces.find( value => value.id === member.id ) ).toEqual( member );
			}
			const blank = work.session._snapshot.surfaces.find( member => !base.surfaces.some( value => value.id === member.id ) );
			expect( blank.layers ).toEqual( [] );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session._snapshot ).toEqual( imported );
		} finally { work.close(); }
	} );

	it( 'preserves a before-phase group and its Redo after Save', async () => {
		const { work, request, application } = await setup();
		try {
			const base = copy( work.session._snapshot ); await applyImport( work, application, request );
			expect( work.editor.historyManager.undo() ).toBe( true );
			const before = application.captureDraft().history.groups.map( group => ( { id: group.id, phase: group.phase } ) );
			await successfulSave( work );
			expect( application.captureDraft().history.groups.map( group => ( { id: group.id, phase: group.phase } ) ) ).toEqual( before );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session._snapshot ).not.toEqual( base );
		} finally { work.close(); }
	} );

	it( 'saves the current before-phase snapshot without submitting undone citations', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request ); work.editor.historyManager.undo();
			await successfulSave( work );
			expect( nativeCalls( api ) ).toHaveLength( 0 );
			expect( ordinaryCalls( api ) ).toHaveLength( 1 );
			expect( work.binding.getImportPublication().sources ).toEqual( [] );
			expect( work.editor.historyManager.redo() ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'rebases all affected page checkpoints while preserving their command phases', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const before = groups( application );
			await successfulSave( work );
			expect( groups( application ) ).toEqual( before );
			for ( const group of application.captureDraft().history.groups ) {
				for ( const checkpoint of [ group.checkpoints.before, group.checkpoints.after ] ) {
					expect( checkpoint.sources ).toEqual( [] );
				}
			}
			expect( work.session._revisionId ).toBeGreaterThan( 12 );
		} finally { work.close(); }
	} );

	it( 'keeps both page-specific timeline contents available after Save and page turns', async () => {
		const { work, request, application } = await setup();
		try {
			await editPage( work, 1, 'page one before import' );
			await applyImport( work, application, request ); await successfulSave( work );
			for ( const page of [ 1, 2 ] ) {
				expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
				const member = work.session._snapshot.surfaces.find( item => item.id === work.session.getPdfStatus().activeSurfaceId );
				expect( work.editor.stateManager.get( 'layers' ) ).toEqual( member.layers );
			}
		} finally { work.close(); }
	} );

	it( 'keeps an ordinary same-page edit Undoable separately from the saved Import group', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			await editPage( work, 2, 'ordinary later edit' ); await successfulSave( work );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( JSON.stringify( work.session._snapshot ) ).not.toContain( 'ordinary later edit' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'does not discard later ordinary Redo entries when saving an undone Import', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			await editPage( work, 2, 'ordinary edit after Import' );
			work.editor.historyManager.undo(); // undo the ordinary edit
			work.editor.historyManager.undo(); // undo the complete Import
			const before = groups( application );
			await successfulSave( work );
			expect( groups( application ) ).toEqual( before );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( JSON.stringify( work.session._snapshot ) ).toContain( 'ordinary edit after Import' );
		} finally { work.close(); }
	} );

	it( 'keeps multiple Import checkpoints in their original LIFO order across Save', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			// A second Import uses a fresh native handle and preserves the same complete target group.
			const second = await application.prepare( importOptions( work ) );
			await application.apply( second );
			const importedTwice = copy( work.session._snapshot );
			const before = groups( application );
			expect( before.length ).toBeGreaterThanOrEqual( 2 );
			await successfulSave( work );
			expect( groups( application ) ).toEqual( before );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session._snapshot ).not.toEqual( importedTwice );
		} finally { work.close(); }
	} );

	it( 'preserves the retained native blank for an admitted page in every checkpoint', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			const imported = work.session._snapshot.surfaces.find( member => member.kind === 'pdf' &&
				member.source.fileTitle === 'File:Example.pdf' && member.source.page === 1 );
			await successfulSave( work );
			for ( const page of [ 1, 2 ] ) {
				expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
			}
			expect( work.editor.historyManager.undo() ).toBe( true );
			const restored = work.session._snapshot.surfaces.find( member => member.id === imported.id );
			expect( restored ).toBeDefined(); expect( restored.layers ).toEqual( [] );
		} finally { work.close(); }
	} );

	it( 'preserves the current active page even when the saved group was captured on another page', async () => {
		const { work, request, application } = await setup();
		try {
			await work.bridge.pdfCoordinator.turn( 1 ); await applyImport( work, application, request );
			await work.bridge.pdfCoordinator.turn( 2 );
			await successfulSave( work );
			expect( work.editor.page ).toBe( 2 );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'leaves the complete history witness unchanged when the native Save fails', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request ); const before = witness( work );
			api.postWithToken.mockRejectedValueOnce( new Error( 'offline' ) );
			await expect( successfulSave( work ) ).rejects.toBeInstanceOf( Error );
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'does not advance a history checkpoint when publication returns an unknown result', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request ); const before = witness( work );
			api.postWithToken.mockResolvedValueOnce( {} );
			await expect( successfulSave( work ) ).rejects.toBeInstanceOf( Error );
			expect( witness( work ) ).toBe( before );
			expect( work.session.getStatus().phase ).toBe( 'uncertain' );
		} finally { work.close(); }
	} );

	it( 'does not change the active group when beforePublish refuses the Save', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request ); const before = application.captureDraft().history;
			await expect( successfulSave( work, 'Refused', () => { throw new Error( 'refused' ); } ) ).rejects.toThrow();
			expect( application.captureDraft().history ).toEqual( before );
		} finally { work.close(); }
	} );

	it( 'keeps a dirty edit made during Save separate from the acknowledged group snapshot', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request );
			let resolve; api.postWithToken.mockImplementationOnce( ( _token, params ) => new Promise( done => {
				resolve = () => done( { layersworkingcopypdfimportpublish: { version: 1, result: 'Success', revid: params.baserevid + 1 } } );
			} ) );
			const pending = successfulSave( work );
			await editPage( work, 2, 'edit after request capture' );
			const expected = copy( work.session._snapshot ), history = contents( work.editor.historyManager.captureTimeline() );
			resolve(); await pending;
			expect( work.session._snapshot ).toEqual( expected );
			expect( contents( work.editor.historyManager.captureTimeline() ) ).toEqual( history );
			expect( work.session.getStatus().dirty ).toBe( true );
			expect( work.editor.historyManager.undo() ).toBe( true );
		} finally { work.close(); }
	} );

	it( 'does not publish or rebase when the application has been disposed', async () => {
		const { work, api, request, application } = await setup();
		try {
			await applyImport( work, application, request ); const before = witness( work );
			application.dispose();
			await expect( successfulSave( work ) ).rejects.toBeInstanceOf( Error );
			expect( api.postWithToken ).not.toHaveBeenCalled();
			expect( witness( work ) ).toBe( before );
		} finally { work.close(); }
	} );

	it( 'retains the after phase while later page-local commands are undone and redone', async () => {
		const { work, request, application } = await setup();
		try {
			await applyImport( work, application, request ); await successfulSave( work );
			await editPage( work, 1, 'page one after Save' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			const phase = application.captureDraft().history.groups.find( group => !group.retired ).phase;
			expect( phase ).toBe( 'after' );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( application.captureDraft().history.groups.find( group => !group.retired ).phase ).toBe( phase );
		} finally { work.close(); }
	} );

	it( 'keeps the same group usable across Save, Undo, Save, Redo and another Save', async () => {
		const { work, application, request, api } = await setup();
		try {
			await applyImport( work, application, request ); const imported = copy( work.session._snapshot );
			await successfulSave( work ); expect( work.session._revisionId ).toBe( 13 );
			expect( work.editor.historyManager.undo() ).toBe( true );
			await successfulSave( work ); expect( work.session._revisionId ).toBe( 14 );
			expect( work.session.getStatus().dirty ).toBe( false );
			expect( work.editor.historyManager.redo() ).toBe( true );
			expect( work.session._snapshot ).toEqual( imported ); expect( work.session.getStatus().dirty ).toBe( true );
			await successfulSave( work ); expect( work.session._revisionId ).toBe( 15 );
			expect( work.session.getStatus().dirty ).toBe( false );
			expect( nativeCalls( api ) ).toHaveLength( 1 ); expect( ordinaryCalls( api ) ).toHaveLength( 2 );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.historyManager.redo() ).toBe( true );
		} finally { work.close(); }
	} );
} );
}
