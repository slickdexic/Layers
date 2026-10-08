'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
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
	if ( process.env.LAYERS_T4_WITNESSES ) {
		require( 'fs' ).appendFileSync( process.env.LAYERS_T4_WITNESSES,
			JSON.stringify( { name, before, after } ) + '\n' );
	}
}

async function editBoth( work ) {
	for ( const page of [ 1, 2 ] ) {
		expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
		work.edit( 'Unsaved page ' + page );
		const layers = copy( work.editor.stateManager.get( 'layers' ) );
		layers[ 0 ].unknownClientField = { nested: [ null, false, 0, 'retain' ] };
		layers[ 0 ].gradient = { type: 'linear', angle: 999,
			colors: [ { offset: 0, color: '#123456' }, { offset: 1, color: '#fedcba' } ] };
		work.editor.stateManager.set( 'layers', layers );
		work.editor.stateManager.set( 'backgroundOpacity', -0.25 );
		work.editor.historyManager.saveState( 'Retain invalid properties' );
	}
	work.editor.stateManager.set( 'selectedLayerIds', [ 'edit-2' ] );
	work.bridge.capture();
}

describe( 'PDF save confirmation and reconciliation boundaries', () => {
	it.each( [ 'root', 'surface' ] )( 'preserves complete refused %s work and independently keyed drafts', async location => {
		const records = new Map();
		const storage = { getItem: key => records.get( key ) ?? null,
			setItem: ( key, value ) => records.set( key, value ), removeItem: key => records.delete( key ),
			key: index => Array.from( records.keys() )[ index ] ?? null, get length() { return records.size; } };
		const work = await fixture();
		const controller = writer => new Controller( work.bridge, new Store( storage, writer.repeat( 32 ) ),
			new Adapter(), { wiki: 'wiki', user: '7' } );
		const lifecycle = new Lifecycle( work.bridge, controller( 'b' ), {
			chooseDraft: jest.fn().mockResolvedValue( 0 ), confirmRecovery: jest.fn().mockResolvedValue( false ),
			notifyBlocked: jest.fn(), notifyFailure: jest.fn() } );
		try {
			await lifecycle.initialize();
			await editBoth( work );
			controller( 'a' ).persist();
			const source = new Map( records ), before = witness( work );
			const background = work.editor.canvasManager.backgroundImage;
			const success = jest.fn();
			work.api.postWithToken.mockImplementationOnce( location === 'root' ?
				() => Promise.resolve( { error: { code: 'layers-invalid-snapshot' } } ) :
				() => ( { then: ( resolve, reject ) => reject( 'layers-invalid-snapshot',
					{ error: { code: 'layers-invalid-snapshot' } } ) } ) );
			await expect( lifecycle.save( 'Keep both pages' ).then( success ) )
				.rejects.toMatchObject( { code: 'layers-invalid-snapshot' } );
			const after = witness( work );
			record( 'save refusal ' + location, before, after );
			expect( after ).toStrictEqual( before );
			expect( success ).not.toHaveBeenCalled();
			expect( work.editor.canvasManager.backgroundImage ).toBe( background );
			for ( const [ key, raw ] of source ) expect( records.get( key ) ).toBe( raw );
			const owned = Array.from( records ).filter( ( [ key ] ) => !source.has( key ) );
			expect( owned ).toHaveLength( 1 );
			expect( JSON.parse( owned[ 0 ][ 1 ] ).pdfDraft ).toStrictEqual( before.draft );
			expect( Array.from( source.values() ) ).toContain( owned[ 0 ][ 1 ] );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			expect( JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toStrictEqual( before.draft.snapshot );
			expect( work.api.postWithToken.mock.calls[ 0 ][ 1 ].baserevid ).toBe( 12 );
			expect( lifecycle.finalized ).toBe( false );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		} finally { lifecycle.dispose(); work.close(); }
	} );

	it( 'confirms a successful save without marking newer pending edits saved', async () => {
		const work = await fixture( false );
		try {
			work.edit( 'Submitted second' );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			work.edit( 'Submitted first' );
			expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
			work.bridge.capture();
			const submitted = work.session.getDraft().snapshot;
			const publish = work.api.postWithToken.getMockImplementation();
			let finish;
			work.api.postWithToken.mockImplementationOnce( ( token, params ) =>
				new Promise( resolve => { finish = () => resolve( publish( token, params ) ); } ) );
			const saving = work.bridge.save( 'Submitted pages' );
			work.edit( 'Newer second' );
			finish();
			expect( await saving ).toMatchObject( { revisionId: 13, dirty: true, editorStateValid: true } );
			expect( work.session.getDraft().pdf.baseSnapshot ).toStrictEqual( submitted );
			expect( JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data ) ).toStrictEqual( submitted );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Newer second' );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBeLessThan( work.editor.historyManager.historyIndex );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Submitted second' );
			expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
			expect( work.editor.stateManager.get( 'layers' )[ 0 ].text ).toBe( 'Submitted first' );
			expect( work.editor.historyManager.lastSaveHistoryIndex ).toBe( work.editor.historyManager.historyIndex );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		} finally { work.close(); }
	} );

	it( 'preserves the complete witness when reconciliation reading is refused', async () => {
		const work = await fixture();
		try {
			await editBoth( work );
			const before = witness( work );
			work.api.get.mockImplementationOnce( () => Promise.resolve( { error: { code: 'layers-revision-unavailable' } } ) );
			await expect( work.bridge.reconcile( 13 ) ).rejects.toMatchObject( { code: 'layers-revision-unavailable' } );
			const after = witness( work );
			record( 'reconcile refusal', before, after );
			expect( after ).toStrictEqual( before );
			expect( work.api.postWithToken ).not.toHaveBeenCalled();
		} finally { work.close(); }
	} );
} );