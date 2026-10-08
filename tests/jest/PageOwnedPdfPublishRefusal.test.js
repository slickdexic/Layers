'use strict';
const { fixture } = require( './PageOwnedPdfEditorIntegration.test.js' );
const Controller = require( '../../resources/ext.layers.editor/PageOwnedDraftController.js' );
const Store = require( '../../resources/ext.layers.editor/PageOwnedDraftStore.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Lifecycle = require( '../../resources/ext.layers.editor/PageOwnedDraftLifecycle.js' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const Reader = require( '../../resources/ext.layers.editor/PageOwnedReadClient.js' );
const Publisher = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const PdfClient = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorReadClient.js' );
const Coordinator = require( '../../resources/ext.layers.editor/PageOwnedPdfEditorCoordinator.js' );
const copy = value => JSON.parse( JSON.stringify( value ) );

function storageFixture() {
	const records = new Map();
	return { records, storage: {
		getItem: key => records.get( key ) ?? null,
		setItem: ( key, value ) => records.set( key, value ),
		removeItem: key => records.delete( key ),
		key: index => Array.from( records.keys() )[ index ] ?? null,
		get length() { return records.size; }
	} };
}

function controller( work, storage, writer ) {
	return new Controller( work.bridge, new Store( storage, writer.repeat( 32 ) ),
		new Adapter(), { wiki: 'wiki', user: '7' } );
}

function witness( work ) {
	const history = work.editor.historyManager;
	return {
		draft: work.session.getDraft(), status: work.session.getStatus(), pdf: work.session.getPdfStatus(),
		live: work.bridge.getLiveState(), state: copy( work.editor.stateManager.state ),
		history: copy( { stack: history.history, index: history.historyIndex,
			saved: history.lastSaveHistoryIndex, max: history.maxHistorySteps,
			batchMode: history.batchMode, destroyed: history.isDestroyed } ),
		retained: copy( Array.from( work.bridge.pdfCoordinator.timelines ) ),
		config: copy( work.editor.config ), page: work.editor.page, pageCount: work.editor.pageCount,
		geometry: [ work.editor.canvasManager.baseWidth, work.editor.canvasManager.baseHeight,
			work.editor.canvasManager.canvas.width, work.editor.canvasManager.canvas.height ],
		url: window.location.href, savedJson: work.session._savedJson
	};
}

async function editBoth( work ) {
	work.edit( 'Second unsaved' );
	const change = () => {
		const layers = copy( work.editor.stateManager.get( 'layers' ) );
		layers[ 0 ].unknownClientField = { nested: [ null, false, 0, 'retain' ] };
		layers[ 0 ].gradient = { type: 'linear', angle: 999,
			colors: [ { offset: 0, color: '#123456' }, { offset: 1, color: '#fedcba' } ] };
		work.editor.stateManager.set( 'layers', layers );
		work.editor.stateManager.set( 'backgroundOpacity', -0.25 );
		work.editor.historyManager.saveState( 'Finite invalid and unknown work' );
	};
	change();
	expect( await work.bridge.pdfCoordinator.turn( 1 ) ).toBe( true );
	work.edit( 'First unsaved' );
	change();
	expect( await work.bridge.pdfCoordinator.turn( 2 ) ).toBe( true );
	work.editor.stateManager.set( 'selectedLayerIds', [ 'edit-2' ] );
	work.bridge.capture();
}

function attachLifecycle( work, storage, writer ) {
	const ui = { chooseDraft: jest.fn().mockResolvedValue( 0 ), confirmRecovery: jest.fn().mockResolvedValue( false ),
		notifyBlocked: jest.fn(), notifyFailure: jest.fn() };
	return { lifecycle: new Lifecycle( work.bridge, controller( work, storage, writer ), ui ), ui };
}

async function supportedFixture() {
	const work = await fixture( false );
	const clean = snapshot => {
		delete snapshot.metadata;
		for ( const surface of snapshot.surfaces || [] ) delete surface.metadata;
		return snapshot;
	};
	const read = work.api.get.getMockImplementation();
	work.api.get.mockImplementation( params => read( params ).then( response => {
		if ( response.layersread.snapshot ) clean( response.layersread.snapshot );
		if ( response.layersread.editor ) delete response.layersread.editor.surface.metadata;
		return response;
	} ) );
	const options = copy( work.editor.config.pageOwned );
	delete options.pdfContext.surface.metadata;
	const session = new Session( options, { reader: new Reader( work.api ),
		publisher: new Publisher( work.api ), adapter: new Adapter() } );
	const bridge = new Bridge( work.editor, session );
	bridge.pdfCoordinator = new Coordinator( bridge, new PdfClient( work.api ) );
	work.editor.apiManager.pageOwnedBridge = bridge;
	await bridge.load();
	const close = work.close;
	return { ...work, bridge, session, close: () => { bridge.dispose(); close(); } };
}

describe( 'Complete PDF native publication refusal', () => {
	it.each( [ 'root', 'surface' ] )( 'retains all work when native %s fields are refused', async location => {
		const backing = storageFixture();
		const work = await fixture();
		const { lifecycle, ui } = attachLifecycle( work, backing.storage, 'b' );
		try {
			await lifecycle.initialize();
			await editBoth( work );
			const source = await fixture();
			let sourceHistory;
			try {
				await editBoth( source );
				sourceHistory = source.bridge.pdfCoordinator.captureDraftHistory();
				controller( source, backing.storage, 'a' ).persist();
			} finally { source.close(); }
			const sourceBytes = Object.fromEntries( backing.records );
			work.bridge.capture();
			const before = witness( work );
			const historyBefore = work.bridge.pdfCoordinator.captureDraftHistory();
			const background = work.editor.canvasManager.backgroundImage;
			const success = jest.fn();
			const request = location === 'root' ? () => Promise.resolve( { error: { code: 'layers-invalid-snapshot' } } ) :
				() => ( { then: ( resolve, reject ) => reject( 'layers-invalid-snapshot',
					{ error: { code: 'layers-invalid-snapshot' } } ) } );
			work.api.postWithToken.mockImplementationOnce( request );
			await expect( lifecycle.save( 'Keep complete work' ).then( success ) )
				.rejects.toMatchObject( { code: 'layers-invalid-snapshot' } );
			expect( success ).not.toHaveBeenCalled();
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.editor.canvasManager.backgroundImage ).toBe( background );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			const sent = JSON.parse( work.api.postWithToken.mock.calls[ 0 ][ 1 ].data );
			expect( sent ).toStrictEqual( before.draft.snapshot );
			expect( work.api.postWithToken.mock.calls[ 0 ][ 1 ].baserevid ).toBe( 12 );
			const members = sent.surfaces.filter( member => member.source.fileTitle === 'File:Example.pdf' );
			expect( members.map( member => member.layers[ 0 ].text ) ).toStrictEqual( [ 'Second unsaved', 'First unsaved' ] );
			expect( members.every( member => member.layers[ 0 ].gradient.angle === 999 &&
				member.layers[ 0 ].unknownClientField.nested[ 3 ] === 'retain' && member.canvas.backgroundOpacity === -0.25 ) )
				.toBe( true );
			expect( work.session.getStatus() ).toMatchObject( { revisionId: 12, phase: 'ready', dirty: true } );
			expect( work.editor.stateManager.get( 'isDirty' ) ).toBe( true );
			expect( lifecycle.saving ).toBe( false );
			expect( lifecycle.finalized ).toBe( false );
			expect( ui.notifyFailure ).not.toHaveBeenCalled();
			for ( const [ key, value ] of Object.entries( sourceBytes ) ) expect( backing.records.get( key ) ).toBe( value );
			expect( backing.records.size ).toBeGreaterThan( Object.keys( sourceBytes ).length );
			const scope = { wiki: 'wiki', user: '7', owner: 'Owner', baseRevisionId: 12, surfaceId: 'anchor' };
			const scopedKey = Store.STORAGE_KEY_PREFIX + JSON.stringify( [ scope.wiki, scope.user,
				scope.owner, scope.baseRevisionId, scope.surfaceId ] );
			const ownedKey = scopedKey + '#' + 'b'.repeat( 32 );
			const ownedKeys = Array.from( backing.records.keys() ).filter( key => !Object.hasOwn( sourceBytes, key ) );
			expect( ownedKeys ).toStrictEqual( [ ownedKey ] );
			const owned = backing.records.get( ownedKey );
			expect( JSON.parse( owned ).scope ).toStrictEqual( scope );
			const ownedEnvelope = JSON.parse( owned );
			const sourceEnvelope = JSON.parse( sourceBytes[ scopedKey + '#' + 'a'.repeat( 32 ) ] );
			expect( ownedEnvelope.pdfHistory ).toStrictEqual( historyBefore );
			expect( sourceEnvelope.pdfHistory ).toStrictEqual( sourceHistory );
			delete ownedEnvelope.pdfHistory;
			delete sourceEnvelope.pdfHistory;
			expect( ownedEnvelope ).toStrictEqual( sourceEnvelope );
			expect( JSON.parse( owned ).pdfDraft ).toStrictEqual( before.draft );
			expect( work.editor.historyManager.undo() ).toBe( true );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
		} finally { lifecycle.dispose(); work.close(); }
	} );

	it( 'only an explicit corrected save publishes once using the original confirmed base', async () => {
		const work = await supportedFixture();
		const backing = storageFixture();
		const { lifecycle } = attachLifecycle( work, backing.storage, 'c' );
		try {
			await lifecycle.initialize();
			await editBoth( work );
			const before = witness( work );
			work.api.postWithToken.mockImplementationOnce( () => Promise.resolve( { error: { code: 'layers-invalid-snapshot' } } ) );
			await expect( lifecycle.save( 'Refuse invalid fields' ) ).rejects.toMatchObject( { code: 'layers-invalid-snapshot' } );
			expect( witness( work ) ).toStrictEqual( before );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 1 );
			for ( const page of [ 1, 2 ] ) {
				expect( await work.bridge.pdfCoordinator.turn( page ) ).toBe( true );
				const layers = copy( work.editor.stateManager.get( 'layers' ) );
				delete layers[ 0 ].unknownClientField;
				layers[ 0 ].gradient.angle = 90;
				work.editor.stateManager.set( 'layers', layers );
				work.editor.stateManager.set( 'backgroundOpacity', 0.75 );
				work.editor.historyManager.saveState( 'Explicit user correction' );
			}
			work.bridge.capture();
			const corrected = work.session.getDraft().snapshot;
			expect( corrected.metadata ).toBeUndefined();
			expect( corrected.surfaces.every( member => member.metadata === undefined ) ).toBe( true );
			const result = await lifecycle.save( 'Explicit corrected save' );
			expect( result ).toMatchObject( { revisionId: 13, dirty: false, draftPersisted: true } );
			expect( work.api.postWithToken ).toHaveBeenCalledTimes( 2 );
			expect( work.api.postWithToken.mock.calls[ 1 ][ 1 ].baserevid ).toBe( 12 );
			expect( JSON.parse( work.api.postWithToken.mock.calls[ 1 ][ 1 ].data ) ).toStrictEqual( corrected );
			expect( corrected.surfaces.filter( member => member.source.fileTitle === 'File:Example.pdf' )
				.map( member => member.layers[ 0 ].text ) ).toStrictEqual( [ 'First unsaved', 'Second unsaved' ] );
			expect( backing.records.size ).toBeGreaterThan( 0 );
		} finally { lifecycle.dispose(); work.close(); }
	} );
} );