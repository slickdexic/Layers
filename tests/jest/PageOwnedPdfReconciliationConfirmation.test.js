'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );

function witness( work ) {
	const history = work.editor.historyManager;
	return { draft: work.session.getDraft(), status: work.session.getStatus(), pdf: work.session.getPdfStatus(),
		live: work.bridge.getLiveState(), state: copy( work.editor.stateManager.state ),
		history: copy( { stack: history.history, index: history.historyIndex, saved: history.lastSaveHistoryIndex,
			max: history.maxHistorySteps, batchMode: history.batchMode, destroyed: history.isDestroyed } ),
		retained: copy( Array.from( work.bridge.pdfCoordinator.timelines ) ), config: copy( work.editor.config ),
		page: work.editor.page, pageCount: work.editor.pageCount, url: window.location.href,
		geometry: [ work.editor.canvasManager.baseWidth, work.editor.canvasManager.baseHeight,
			work.editor.canvasManager.canvas.width, work.editor.canvasManager.canvas.height ], savedJson: work.session._savedJson };
}

function record( name, before, after ) {
	if ( process.env.LAYERS_T5_WITNESSES ) {
		require( 'fs' ).appendFileSync( process.env.LAYERS_T5_WITNESSES,
			JSON.stringify( { name, before, after } ) + '\n' );
	}
}

async function edits( work ) {
	for ( const page of [ 1, 2 ] ) {
		expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
		work.edit( 'Local page ' + page );
		const layers = copy( work.editor.stateManager.get( 'layers' ) );
		layers[ 0 ].unknownClientField = { nested: [ null, false, 0, 'keep' ] };
		layers[ 0 ].gradient = { type: 'linear', angle: 999,
			colors: [ { offset: 0, color: '#123456' }, { offset: 1, color: '#fedcba' } ] };
		work.editor.stateManager.set( 'layers', layers );
		work.editor.stateManager.set( 'backgroundOpacity', -0.25 );
		work.editor.historyManager.saveState( 'Keep complete client properties' );
	}
	work.editor.stateManager.set( 'selectedLayerIds', [ 'edit-2' ] );
	work.bridge.capture();
}

describe( 'Confirmed exact PDF reconciliation', () => {
	it.each( [ false, true ] )( 'retains complete work and correct Undo with pending newer edits=%s', async delayed => {
		const work = await fixture( false );
		try {
			await edits( work );
			const remote = copy( work.base );
			remote.surfaces.find( member => member.id === 'other-file' ).layers[ 0 ].text = 'Authorized sibling revision';
			const background = work.editor.canvasManager.backgroundImage;
			let finish;
			work.api.get.mockImplementationOnce( () => delayed ? new Promise( resolve => { finish = resolve; } ) :
				Promise.resolve( { layersread: { revisionId: 13, snapshot: remote, sourceGeometry: [] } } ) );
			const pending = work.bridge.reconcile( 13 );
			if ( delayed ) {
				const layers = copy( work.editor.stateManager.get( 'layers' ) );
				layers[ 0 ].text = 'Newer while reconciliation waits';
				layers[ 0 ].gradient.angle = 888;
				work.editor.stateManager.set( 'layers', layers );
				work.editor.historyManager.saveState( 'Newer pending edit' );
				finish( { layersread: { revisionId: 13, snapshot: remote, sourceGeometry: [] } } );
			}
			const live = work.bridge.getLiveState();
			expect( await pending ).toMatchObject( { phase: 'ready', revisionId: 13, dirty: true, editorStateValid: true } );
			expect( work.bridge.getLiveState() ).toStrictEqual( live );
			expect( work.session.getDraft().pdf.baseSnapshot ).toStrictEqual( remote );
			expect( JSON.parse( work.session._savedJson ) ).toStrictEqual( remote );
			expect( work.session.getDraft().snapshot.surfaces.find( member => member.id === 'other-file' ) )
				.toStrictEqual( remote.surfaces.find( member => member.id === 'other-file' ) );
			expect( work.editor.canvasManager.backgroundImage ).toBe( background );
			expect( work.editor.stateManager.get( 'selectedLayerIds' ) ).toStrictEqual( [ 'edit-2' ] );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( 0 );
			expect( work.editor.historyManager.historyIndex ).toBeGreaterThan( 0 );
			const draft = work.session.getDraft().snapshot;
			expect( draft.surfaces.find( member => member.source.page === 1 && member.source.fileTitle === 'File:Example.pdf' )
				.layers[ 0 ].unknownClientField ).toStrictEqual( { nested: [ null, false, 0, 'keep' ] } );
			while ( work.editor.historyManager.historyIndex > 0 ) expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ) ).toStrictEqual( remote.surfaces.find( member => member.id === 'anchor' ).layers );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.api.get.mock.calls.at( -1 )[ 0 ] ).toMatchObject( { revid: 13, binding: 'v1:7:anchor', editorpage: 1 } );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].gradient.angle ).toBe( 999 );
			while ( work.editor.historyManager.historyIndex > 0 ) expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' ) ).toStrictEqual( remote.surfaces.find( member => member.id === 'stored-first' ).layers );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( work.editor.historyManager.historyIndex );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );

	it.each( [ 'ready', 'conflict', 'uncertain' ] )( 'keeps complete %s work when the exact read is denied', async phase => {
		const work = await fixture();
		try {
			await edits( work );
			if ( phase !== 'ready' ) {
				work.api.postWithToken.mockImplementationOnce( () => phase === 'conflict' ?
					Promise.resolve( { error: { code: 'layers-edit-conflict' } } ) : Promise.reject( new Error( 'Lost response' ) ) );
				await expect( work.bridge.save() ).rejects.toMatchObject( {
					code: phase === 'conflict' ? 'layers-edit-conflict' : 'layers-publication-outcome-unknown' } );
			}
			expect( work.session.getStatus().phase ).toBe( phase );
			const before = witness( work ), posts = work.api.postWithToken.mock.calls.length;
			const background = work.editor.canvasManager.backgroundImage;
			work.api.get.mockResolvedValueOnce( { error: { code: 'permissiondenied' } } );
			await expect( work.bridge.reconcile( 13 ) ).rejects.toMatchObject( { code: 'permissiondenied' } );
			const after = witness( work );
			record( 'denied ' + phase, before, after );
			expect( after ).toStrictEqual( before );
			expect( work.editor.canvasManager.backgroundImage ).toBe( background );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( posts );
		} finally { work.close(); }
	} );

	it.each( [ 'source pin', 'competing content', 'wrong revision' ] )( 'refuses incompatible %s without any confirmed-state mutation', async reason => {
		const work = await fixture();
		try {
			await edits( work );
			const remote = copy( work.base ), anchor = remote.surfaces.find( member => member.id === 'anchor' );
			if ( reason === 'source pin' ) anchor.source.sha1 = 'b'.repeat( 31 );
			if ( reason === 'competing content' ) anchor.layers[ 0 ].text = 'Other editor';
			const before = witness( work );
			work.api.get.mockResolvedValueOnce( { layersread: { revisionId: reason === 'wrong revision' ? 12 : 13,
				snapshot: remote, sourceGeometry: [] } } );
			await expect( work.bridge.reconcile( 13 ) ).rejects.toMatchObject( {
				code: reason === 'wrong revision' ? 'layers-reading-failed' : 'layers-editor-reconciliation-required' } );
			const after = witness( work );
			record( 'incompatible ' + reason, before, after );
			expect( after ).toStrictEqual( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );