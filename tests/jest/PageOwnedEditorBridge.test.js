'use strict';
const Bridge = require( '../../resources/ext.layers.editor/PageOwnedEditorBridge.js' );
const Session = require( '../../resources/ext.layers.editor/PageOwnedEditorSession.js' );
const Adapter = require( '../../resources/ext.layers.editor/PageOwnedSnapshotAdapter.js' );
const Publisher = require( '../../resources/ext.layers.editor/PageOwnedPublishClient.js' );
const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const fixture = require( '../fixtures/revisions/mixed-document-v1.json' );

describe( 'PageOwnedEditorBridge', () => {
	let editor, session, bridge, api;
	beforeEach( () => {
		editor = {
			stateManager: new StateManager(),
			canvasManager: { setBaseDimensions: jest.fn(), renderLayers: jest.fn() },
			layerPanel: { updateLayers: jest.fn() },
			historyManager: { saveInitialState: jest.fn() }
		};
		api = { postWithToken: jest.fn() };
		session = new Session( { owner: 'Owner', surfaceId: 'presentation', revisionId: 12 }, {
			reader: { read: jest.fn().mockResolvedValue( { revisionId: 12, snapshot: fixture } ) },
			publisher: new Publisher( api ), adapter: new Adapter()
		} );
		bridge = new Bridge( editor, session );
	} );
	afterEach( () => editor.stateManager.destroy() );

	it( 'loads exact layers and canvas into the existing StateManager and initializes rendering/undo', async () => {
		await bridge.load();
		expect( editor.stateManager.get( 'layers' ) ).toEqual( fixture.surfaces[ 0 ].layers );
		expect( editor.stateManager.get( 'slideCanvasWidth' ) ).toBe( 800 );
		expect( editor.canvasManager.setBaseDimensions ).toHaveBeenCalledWith( 800, 600 );
		expect( editor.historyManager.saveInitialState ).toHaveBeenCalledTimes( 1 );
		expect( editor.stateManager.get( 'isDirty' ) ).toBe( false );
	} );

	it( 'saves actual editor values without truthy defaults or changing other surfaces', async () => {
		await bridge.load();
		editor.stateManager.set( 'backgroundVisible', false );
		editor.stateManager.set( 'backgroundOpacity', 0 );
		editor.stateManager.set( 'slideBackgroundColor', '' );
		api.postWithToken.mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } );
		await bridge.save( 'Editor change' );
		const saved = JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data );
		expect( saved.surfaces[ 0 ].canvas ).toMatchObject( {
			backgroundVisible: false, backgroundOpacity: 0, backgroundColor: ''
		} );
		expect( saved.surfaces.slice( 1 ) ).toEqual( fixture.surfaces.slice( 1 ) );
		expect( editor.stateManager.get( 'isDirty' ) ).toBe( false );
	} );

	it.each( [ true, false ] )( 'keeps newer editor edits dirty when an in-flight save succeeds=%s', async ( succeeds ) => {
		await bridge.load();
		let complete;
		api.postWithToken.mockReturnValue( new Promise( ( resolve, reject ) => {
			complete = () => succeeds ? resolve( { layerspublish: { result: 'Success', revid: 13 } } ) :
				reject( { code: 'layers-edit-conflict' } );
		} ) );
		editor.stateManager.set( 'slideCanvasWidth', 700 );
		const saving = bridge.save();
		editor.stateManager.set( 'slideCanvasWidth', 900 );
		complete();
		if ( succeeds ) {
			expect( await saving ).toMatchObject( { revisionId: 13, dirty: true, editorStateValid: true } );
		} else {
			await expect( saving ).rejects.toMatchObject( { code: 'layers-edit-conflict' } );
		}
		expect( session.getDraft().snapshot.surfaces[ 0 ].canvas.width ).toBe( 900 );
		expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		expect( api.postWithToken ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'keeps newer invalid editor data dirty without misreporting a confirmed save as failed', async () => {
		await bridge.load();
		let resolve;
		api.postWithToken.mockReturnValue( new Promise( ( done ) => { resolve = done; } ) );
		const saving = bridge.save();
		editor.stateManager.set( 'layers', undefined );
		resolve( { layerspublish: { result: 'Success', revid: 13 } } );
		expect( await saving ).toMatchObject( { revisionId: 13, dirty: true, editorStateValid: false } );
		expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		expect( editor.stateManager.get( 'layers' ) ).toBeUndefined();
	} );

	it( 'does not touch a destroyed editor when a save completes late', async () => {
		await bridge.load();
		let resolve;
		api.postWithToken.mockReturnValue( new Promise( ( done ) => { resolve = done; } ) );
		const saving = bridge.save();
		bridge.dispose();
		const set = jest.spyOn( editor.stateManager, 'set' );
		resolve( { layerspublish: { result: 'Success', revid: 13 } } );
		await expect( saving ).rejects.toMatchObject( { code: 'layers-editor-session-unavailable' } );
		expect( set ).not.toHaveBeenCalled();
	} );
} );
