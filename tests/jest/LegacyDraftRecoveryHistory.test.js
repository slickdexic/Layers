/** Legacy draft recovery must be reversible without publishing or losing its backup. */
'use strict';
const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );
require( '../../resources/ext.layers.editor/DraftManager.js' );

describe( 'legacy draft recovery history', () => {
	let editor, draft, history, state, originalStorage;
	beforeEach( () => {
		originalStorage = global.localStorage;
		const stored = new Map();
		global.localStorage = { getItem: key => stored.get( key ) ?? null,
			setItem: ( key, value ) => stored.set( key, value ), removeItem: key => stored.delete( key ) };
		const log = Object.assign( jest.fn(), { error: jest.fn(), warn: jest.fn() } );
		global.mw = { config: { get: () => false }, log, notify: jest.fn(), message: () => ( {
			exists: () => true, text: () => 'Recovered'
		} ) };
		state = { layers: [ { id: 'before', type: 'rectangle' } ], backgroundVisible: true,
			backgroundOpacity: 1, currentSetName: 'default' };
		editor = { filename: 'Example.png', page: 1,
			stateManager: { get: key => state[ key ], getLayers: () => state.layers, set: ( key, value ) => { state[ key ] = value; },
				update: values => Object.assign( state, values ), subscribe: () => () => {} },
			canvasManager: { renderLayers: jest.fn() }, layerPanel: { updateLayers: jest.fn() },
			markDirty: jest.fn(), isDirty: () => true };
		history = editor.historyManager = new HistoryManager( { editor } );
		history.saveState( 'initial' );
		draft = new window.Layers.Editor.DraftManager( editor );
	} );
	afterEach( () => { draft.destroy(); history.destroy(); global.localStorage = originalStorage; } );

	test.each( [ { layers: [] }, { layers: [ { id: 'image', type: 'image', src: 'data:image/png;base64,QUJD' } ] } ] )(
		'restores and undoes a recovered draft with layers %j', async ( { layers } ) => {
			const raw = JSON.stringify( { version: 2, timestamp: Date.now(), setName: 'default',
				layers, backgroundVisible: false, backgroundOpacity: 0.4 } );
			localStorage.setItem( draft.getStorageKey(), raw );
			draft.showRecoveryDialog = jest.fn().mockResolvedValue( true );
			expect( await draft.checkAndRecoverDraft() ).toBe( true );
			expect( localStorage.getItem( draft.getStorageKey() ) ).toBe( raw );
			expect( state.layers ).toEqual( layers );
			expect( history.undo() ).toBe( true );
			expect( state.layers ).toEqual( [ { id: 'before', type: 'rectangle' } ] );
			expect( [ state.backgroundVisible, state.backgroundOpacity ] ).toEqual( [ true, 1 ] );
			expect( history.redo() ).toBe( true );
			expect( state.layers ).toEqual( layers );
			expect( [ state.backgroundVisible, state.backgroundOpacity ] ).toEqual( [ false, 0.4 ] );
			state.layers = [ ...layers, { id: 'later', type: 'circle' } ];
			history.saveState( 'Later edit' );
			expect( history.undo() ).toBe( true );
			expect( state.layers ).toEqual( layers );
			expect( [ state.backgroundVisible, state.backgroundOpacity ] ).toEqual( [ false, 0.4 ] );
		}
	);

	test( 'dismissal leaves the backup and history untouched', async () => {
		const raw = JSON.stringify( { timestamp: Date.now(), layers: [], setName: 'default' } );
		localStorage.setItem( draft.getStorageKey(), raw );
		draft.showRecoveryDialog = jest.fn().mockResolvedValue( null );
		expect( await draft.checkAndRecoverDraft() ).toBe( false );
		expect( localStorage.getItem( draft.getStorageKey() ) ).toBe( raw );
		expect( history.history ).toHaveLength( 1 );
		expect( history.canUndo() ).toBe( false );
	} );

	test( 'preserves a pre-recovery edit that was not in the last history entry', async () => {
		state.layers = [ { id: 'newer', type: 'circle' } ];
		state.backgroundVisible = false;
		const raw = JSON.stringify( { timestamp: Date.now(), layers: [], setName: 'default',
			backgroundVisible: true, backgroundOpacity: 0.2 } );
		localStorage.setItem( draft.getStorageKey(), raw );
		draft.showRecoveryDialog = jest.fn().mockResolvedValue( true );
		expect( await draft.checkAndRecoverDraft() ).toBe( true );
		expect( history.undo() ).toBe( true );
		expect( state.layers ).toEqual( [ { id: 'newer', type: 'circle' } ] );
		expect( state.backgroundVisible ).toBe( false );
		expect( history.redo() ).toBe( true );
		expect( state.layers ).toEqual( [] );
		expect( state.backgroundOpacity ).toBe( 0.2 );
	} );
} );
