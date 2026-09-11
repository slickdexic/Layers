/**
 * @jest-environment jsdom
 */

/**
 * LayerSetSwitching acceptance tests (J20)
 *
 * Tests collaborating components:
 * - SetSelectorController (UI)
 * - LayerSetManager (Core)
 * - StateManager
 * - APIManager
 *
 * Requirements:
 * 1. One dialog on successful dirty switch
 * 2. Cancel preserves state and restores selector
 * 3. Rejected/timed-out load preserves state and restores selector
 * 4. Clean switch requires 0 confirmation dialogs
 * 5. Buffered edits are included in the unsaved-work decision
 * 6. Newer edits during in-flight load are preserved
 * 7. Overlapping rapid requests apply in order without older loads overwriting newer ones
 */

'use strict';

const LayerSetManager = require( '../../resources/ext.layers.editor/LayerSetManager.js' );
const SetSelectorController = require( '../../resources/ext.layers.editor/ui/SetSelectorController.js' );
const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );

describe( 'LayerSetSwitching (J20)', () => {
	let stateManager;
	let layerSetManager;
	let controller;
	let mockEditor;
	let mockUiManager;
	let mockApiManager;
	let mockDialogManager;
	let mockHistoryManager;
	let mockPageBuffer;

	beforeEach( () => {
		jest.useFakeTimers();

		// Set up global mw
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: () => key,
				parse: () => key
			} ) ),
			notify: jest.fn(),
			log: jest.fn(),
			config: {
				get: jest.fn( ( key, defaultValue ) => defaultValue )
			}
		};
		global.mw.log.error = jest.fn();

		// Real StateManager instance
		stateManager = new StateManager();
		stateManager.set( 'currentSetName', 'default' );
		stateManager.set( 'namedSets', [
			{ name: 'default', revision_count: 1 },
			{ name: 'set-a', revision_count: 1 },
			{ name: 'set-b', revision_count: 1 }
		] );
		stateManager.set( 'layers', [ { id: 'layer-1', type: 'rect' } ] );
		stateManager.set( 'isDirty', false );

		// Mock HistoryManager
		mockHistoryManager = {
			history: [ { layers: [ { id: 'layer-1' } ] } ],
			historyIndex: 0,
			saveInitialState: jest.fn(),
			saveState: jest.fn()
		};

		// Mock PageBuffer
		let bufferedChanges = false;
		mockPageBuffer = {
			isEmpty: jest.fn( () => !bufferedChanges ),
			hasUnsavedChanges: jest.fn( () => bufferedChanges ),
			dirtyPages: jest.fn( () => ( bufferedChanges ? [ 2 ] : [] ) ),
			clear: jest.fn( () => {
				bufferedChanges = false;
			} ),
			_setDirty: ( val ) => {
				bufferedChanges = val;
			}
		};

		// Mock DialogManager
		mockDialogManager = {
			showConfirmDialog: jest.fn().mockResolvedValue( true ),
			showPromptDialog: jest.fn().mockResolvedValue( 'test' )
		};

		// Mock APIManager
		mockApiManager = {
			loadLayersBySetName: jest.fn().mockImplementation( async ( setName ) => {
				if ( layerSetManager && !layerSetManager.canApplyLoadedSet( setName ) ) {
					return { superseded: true };
				}
				stateManager.set( 'layers', [ { id: `loaded-${ setName }` } ] );
				return { layersinfo: { layerset: { name: setName } } };
			} )
		};

		// Mock Editor coordinating components
		mockEditor = {
			stateManager: stateManager,
			apiManager: mockApiManager,
			dialogManager: mockDialogManager,
			historyManager: mockHistoryManager,
			pageBuffer: mockPageBuffer,
			hasUnsavedChanges: jest.fn( () => {
				if ( stateManager.get( 'isDirty' ) ) {
					return true;
				}
				return !mockPageBuffer.isEmpty();
			} ),
			canvasManager: {
				renderLayers: jest.fn(),
				clearLayers: jest.fn(),
				selectionManager: { clearSelection: jest.fn() }
			},
			layerPanel: {
				updateLayers: jest.fn(),
				updateList: jest.fn()
			},
			loadLayerSetByName: null // Will be wired below
		};

		// Mock UIManager
		mockUiManager = {
			editor: mockEditor,
			getMessage: jest.fn( ( key, fallback ) => fallback || key ),
			addListener: jest.fn( ( el, ev, fn ) => el.addEventListener( ev, fn ) ),
			showConfirmDialog: jest.fn( ( opts ) => mockDialogManager.showConfirmDialog( opts ) )
		};

		// Instantiate LayerSetManager
		layerSetManager = new LayerSetManager( {
			editor: mockEditor,
			stateManager: stateManager,
			apiManager: mockApiManager,
			uiManager: mockUiManager
		} );
		mockEditor.layerSetManager = layerSetManager;

		// Wire editor.loadLayerSetByName to authoritative LayerSetManager implementation
		mockEditor.loadLayerSetByName = jest.fn( ( setName, opts ) =>
			layerSetManager.loadLayerSetByName( setName, opts )
		);

		// Instantiate SetSelectorController
		controller = new SetSelectorController( mockUiManager );
		controller.createSetSelector();
		controller.setupControls();

		// Populate select element with options
		layerSetManager.buildSetSelector();
	} );

	afterEach( () => {
		jest.useRealTimers();
		jest.restoreAllMocks();
		delete global.mw;
	} );

	describe( '1. One dialog on successful dirty switch', () => {
		it( 'should show exactly one confirmation dialog and switch cleanly on confirm', async () => {
			stateManager.set( 'isDirty', true );
			mockDialogManager.showConfirmDialog.mockResolvedValue( true );

			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			await jest.runAllTimersAsync();

			// Exactly one confirmation dialog
			expect( mockDialogManager.showConfirmDialog ).toHaveBeenCalledTimes( 1 );
			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'set-a', expect.objectContaining( { shouldApply: expect.any( Function ) } ) );

			// New set is active
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-a' );
			expect( controller.setSelectEl.value ).toBe( 'set-a' );
		} );
	} );

	describe( '2. Cancel preserves state and restores selector', () => {
		it( 'should cancel load, restore dropdown, and keep original layers and dirty status intact', async () => {
			stateManager.set( 'isDirty', true );
			const originalLayers = [ ...stateManager.get( 'layers' ) ];
			mockDialogManager.showConfirmDialog.mockResolvedValue( false );

			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			await jest.runAllTimersAsync();

			expect( mockDialogManager.showConfirmDialog ).toHaveBeenCalledTimes( 1 );
			expect( mockApiManager.loadLayersBySetName ).not.toHaveBeenCalled();

			// State preserved
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'default' );
			expect( stateManager.get( 'isDirty' ) ).toBe( true );
			expect( stateManager.get( 'layers' ) ).toEqual( originalLayers );

			// Selector restored to original
			expect( controller.setSelectEl.value ).toBe( 'default' );
		} );
	} );

	describe( '3. Rejected or timed-out load', () => {
		it( 'should keep original layers, set name, and dirty status, and restore selector on error', async () => {
			stateManager.set( 'isDirty', true );
			const originalLayers = [ ...stateManager.get( 'layers' ) ];
			mockDialogManager.showConfirmDialog.mockResolvedValue( true );
			mockApiManager.loadLayersBySetName.mockRejectedValue( new Error( 'Connection timed out' ) );

			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			await jest.runAllTimersAsync();

			expect( mockDialogManager.showConfirmDialog ).toHaveBeenCalledTimes( 1 );
			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'set-a', expect.objectContaining( { shouldApply: expect.any( Function ) } ) );

			// Failure notification shown
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);

			// Original state preserved
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'default' );
			expect( stateManager.get( 'isDirty' ) ).toBe( true );
			expect( stateManager.get( 'layers' ) ).toEqual( originalLayers );

			// Dropdown restored
			expect( controller.setSelectEl.value ).toBe( 'default' );
		} );
	} );

	describe( '4. Clean switch', () => {
		it( 'should require 0 confirmation dialogs when work is clean', async () => {
			stateManager.set( 'isDirty', false );

			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			await jest.runAllTimersAsync();

			expect( mockDialogManager.showConfirmDialog ).not.toHaveBeenCalled();
			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'set-a', expect.objectContaining( { shouldApply: expect.any( Function ) } ) );
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-a' );
			expect( controller.setSelectEl.value ).toBe( 'set-a' );
		} );
	} );

	describe( '5. Buffered edits in unsaved-work decision', () => {
		it( 'should prompt for confirmation when canvas is clean but pageBuffer has edits', async () => {
			stateManager.set( 'isDirty', false );
			mockPageBuffer._setDirty( true ); // buffered changes on another page
			mockDialogManager.showConfirmDialog.mockResolvedValue( false );

			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			await jest.runAllTimersAsync();

			// Confirmation dialog was shown because of buffered changes
			expect( mockDialogManager.showConfirmDialog ).toHaveBeenCalledTimes( 1 );
			expect( mockApiManager.loadLayersBySetName ).not.toHaveBeenCalled();
			expect( controller.setSelectEl.value ).toBe( 'default' );
			expect( mockPageBuffer.isEmpty() ).toBe( false );
		} );

		it( 'should clear discarded pageBuffer on successful switch', async () => {
			stateManager.set( 'isDirty', false );
			mockPageBuffer._setDirty( true );
			mockDialogManager.showConfirmDialog.mockResolvedValue( true );

			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			await jest.runAllTimersAsync();

			expect( mockDialogManager.showConfirmDialog ).toHaveBeenCalledTimes( 1 );
			expect( mockApiManager.loadLayersBySetName ).toHaveBeenCalledWith( 'set-a', expect.objectContaining( { shouldApply: expect.any( Function ) } ) );
			expect( mockPageBuffer.clear ).toHaveBeenCalled();
		} );
	} );

	describe( '6. Newer edits during load are preserved', () => {
		it( 'should preserve newer edits made while load is in flight and discard incoming set', async () => {
			stateManager.set( 'isDirty', false );

			// Slow API request
			let resolveApi;
			const apiPromise = new Promise( ( resolve ) => {
				resolveApi = resolve;
			} );
			mockApiManager.loadLayersBySetName.mockReturnValue( apiPromise );

			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			// While load is in flight, user adds a new layer
			const newerLayer = { id: 'newer-layer', type: 'circle' };
			stateManager.set( 'layers', [ ...stateManager.get( 'layers' ), newerLayer ] );
			stateManager.set( 'isDirty', true );

			// API load resolves late
			resolveApi( { layersinfo: { layerset: { name: 'set-a' } } } );
			await jest.runAllTimersAsync();

			// Newer edits were preserved!
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'default' );
			expect( stateManager.get( 'layers' ) ).toEqual(
				expect.arrayContaining( [ expect.objectContaining( { id: 'newer-layer' } ) ] )
			);
			expect( stateManager.get( 'isDirty' ) ).toBe( true );

			// Dropdown was reverted
			expect( controller.setSelectEl.value ).toBe( 'default' );

			// Warning notification shown
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'warn' } )
			);
		} );
	} );

	describe( '7. Overlapping rapid requests (request sequencing)', () => {
		it( 'rejects an old response after the newer switch has fully completed, including identical names', async () => {
			stateManager.set( 'isDirty', false );
			const responses = [];
			mockApiManager.loadLayersBySetName.mockImplementation( ( name, options ) => new Promise( ( resolve ) => {
				const id = responses.length ? 'newest' : 'stale';
				responses.push( () => {
					if ( !options.shouldApply() ) {
						resolve( { superseded: true } );
						return;
					}
					stateManager.set( 'layers', [ { id } ] );
					resolve( {} );
				} );
			} ) );
			const first = layerSetManager.loadLayerSetByName( 'set-a' );
			const second = layerSetManager.loadLayerSetByName( 'set-a' );
			responses[ 1 ]();
			expect( ( await second ).status ).toBe( 'success' );
			responses[ 0 ]();
			expect( ( await first ).reason ).toBe( 'superseded' );
			expect( stateManager.get( 'layers' ) ).toEqual( [ { id: 'newest' } ] );
		} );

		it( 'detects content edits that preserve layer IDs and dirty state', () => {
			stateManager.set( 'isDirty', true );
			stateManager.set( 'layers', [ { id: 'same', x: 1 } ] );
			const snapshot = layerSetManager._captureEditSnapshot();
			stateManager.get( 'layers' )[ 0 ].x = 100;
			expect( layerSetManager._hasNewerEdits( snapshot ) ).toBe( true );
		} );

		it( 'should discard late-resolving older requests and apply the latest selection', async () => {
			stateManager.set( 'isDirty', false );

			let resolveFirst;
			const firstApiPromise = new Promise( ( resolve ) => {
				resolveFirst = resolve;
			} );
			let resolveSecond;
			const secondApiPromise = new Promise( ( resolve ) => {
				resolveSecond = resolve;
			} );

			mockApiManager.loadLayersBySetName
				.mockReturnValueOnce( firstApiPromise )
				.mockReturnValueOnce( secondApiPromise );

			// User switches to set-a
			controller.setSelectEl.value = 'set-a';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			// User quickly switches to set-b before set-a completes
			controller.setSelectEl.value = 'set-b';
			controller.setSelectEl.dispatchEvent( new Event( 'change' ) );

			// set-b completes first
			resolveSecond( { layersinfo: { layerset: { name: 'set-b' } } } );
			await jest.runAllTimersAsync();

			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( controller.setSelectEl.value ).toBe( 'set-b' );

			// set-a completes later
			resolveFirst( { layersinfo: { layerset: { name: 'set-a' } } } );
			await jest.runAllTimersAsync();

			// set-b is still the active set; set-a was discarded
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( controller.setSelectEl.value ).toBe( 'set-b' );
		} );
	} );
} );
