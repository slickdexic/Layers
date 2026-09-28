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

	it( 'renames the drawing, marks the editor dirty and restores a draft name', async () => {
		await bridge.load();
		expect( () => new Bridge( editor, session ).rename( 'Early' ) ).toThrow( 'layers-editor-session-unavailable' );
		expect( bridge.getName() ).toBe( 'Welcome' );
		expect( bridge.rename( 'Title slide' ) ).toBe( 'Title slide' );
		expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		editor.stateManager.set( 'isDirty', false );
		bridge.rename( 'Welcome' );
		expect( editor.stateManager.get( 'isDirty' ) ).toBe( false );
		bridge.restoreDraft( { editorState: bridge.getLiveState(), label: 'From draft', publicationBlocked: false } );
		expect( bridge.getName() ).toBe( 'From draft' );
		bridge.restoreDraft( { editorState: bridge.getLiveState(), publicationBlocked: false } );
		expect( bridge.getName() ).toBe( 'From draft' );
	} );

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

	it( 'publishes a property the editor cleared to null or undefined as absent', async () => {
		await bridge.load();
		const [ first, ...rest ] = editor.stateManager.get( 'layers' );
		editor.stateManager.set( 'layers', [ { ...first, gradient: null, headScale: undefined }, ...rest ] );
		api.postWithToken.mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } );
		await bridge.save( 'Cleared gradient' );
		const saved = JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data );
		expect( saved.surfaces[ 0 ].layers ).toStrictEqual( fixture.surfaces[ 0 ].layers );
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

	describe( 'image and PDF surfaces', () => {
		const forSurface = ( surfaceId, config ) => {
			editor.config = config;
			session = new Session( { owner: 'Owner', surfaceId, revisionId: 12 }, {
				reader: { read: jest.fn().mockResolvedValue( { revisionId: 12, snapshot: fixture } ) },
				publisher: new Publisher( api ), adapter: new Adapter()
			} );
			bridge = new Bridge( editor, session );
		};

		it( 'edits a PDF page in image mode with its canvas fixed to the pinned source page', async () => {
			forSurface( 'reference', { isSlide: false, imageUrl: 'https://wiki.test/thumb/page2-800px-Reference.pdf.jpg' } );
			editor.stateManager.set( 'slideCanvasWidth', 1234 );
			await bridge.load();
			expect( editor.stateManager.get( 'isSlide' ) ).toBe( false );
			expect( editor.stateManager.get( 'baseWidth' ) ).toBe( 800 );
			expect( editor.canvasManager.setBaseDimensions ).toHaveBeenCalledWith( 800, 600 );
			editor.stateManager.set( 'backgroundOpacity', 0.25 );
			editor.stateManager.set( 'slideBackgroundColor', '#000000' );
			api.postWithToken.mockResolvedValue( { layerspublish: { result: 'Success', revid: 13 } } );
			await bridge.save( 'Annotate page two' );
			const saved = JSON.parse( api.postWithToken.mock.calls[ 0 ][ 1 ].data );
			const pdf = saved.surfaces.find( ( surface ) => surface.id === 'reference' );
			expect( pdf.canvas ).toEqual( Object.assign( {}, fixture.surfaces[ 2 ].canvas, { backgroundOpacity: 0.25 } ) );
			expect( pdf.source ).toEqual( fixture.surfaces[ 2 ].source );
		} );

		it.each( [
			[ 'an image without its rendition', 'diagram', { isSlide: false } ],
			[ 'an image opened in slide mode', 'diagram', { isSlide: true, imageUrl: 'https://wiki.test/a.png' } ],
			[ 'a slide opened in image mode', 'presentation', { isSlide: false, imageUrl: 'https://wiki.test/a.png' } ]
		] )( 'refuses %s', async ( name, surfaceId, config ) => {
			forSurface( surfaceId, config );
			await expect( bridge.load() ).rejects.toMatchObject( { code: 'layers-editor-surface-unavailable' } );
			expect( editor.canvasManager.renderLayers ).not.toHaveBeenCalled();
		} );
	} );
} );
