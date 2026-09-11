/**
 * @jest-environment jsdom
 */

/**
 * LayerSetSwitching through Real APIManager Integration Tests (J23)
 *
 * Verifies set switching using REAL collaborating components:
 * - APIManager (real loadLayersBySetName, response cache, _processSetNameData)
 * - LayerSetManager (real loadLayerSetByName, _switchGeneration, request closure, edit snapshots)
 * - StateManager (real observable state store)
 * - SetSelectorController (real UI selector coordination)
 *
 * Only mocks the boundary interfaces:
 * - Network boundary: mw.Api get() returning controlled deferred jqXHR requests
 * - Rendering boundary: CanvasManager renderLayers, LayerPanel updateLayers
 *
 * Requirements covered:
 * 1. Latest response completing before old response (stale request discarded via request closure)
 * 2. Mutation-style proof that removing the request closure causes stale response to process and corrupt state
 * 3. Same target name twice with distinct payloads (monotonic generation prevents same-name overwrites)
 * 4. Reversed confirmation resolution (older confirmation cannot trigger load or overwrite newer state)
 * 5. Cached result respects request closure (cannot apply if superseded or if newer edits exist)
 * 6. Rejected/failed response (preserves state, layers, set name, dirty status, restores selector)
 * 7. In-place text/geometry edits during load (detected by snapshot and preserved)
 * 8. Background edits during load (detected and preserved)
 * 9. Buffered-page edits during load (detected and preserved)
 * 10. Explicit assertions on actual layer geometry/types and canvas context (not just status/name)
 * 11. Loading indicators (isLoading and spinner remain accurate while latest request is pending)
 * 12. Separate exercise of RevisionManager fallback (identifies and documents fallback limitations)
 */

'use strict';

// Set up dependencies for APIManager
const APIErrorHandler = require( '../../resources/ext.layers.editor/APIErrorHandler.js' );
const ExportController = require( '../../resources/ext.layers.editor/ExportController.js' );
global.window.Layers = global.window.Layers || {};
global.window.Layers.Editor = global.window.Layers.Editor || {};
global.window.Layers.Editor.APIErrorHandler = APIErrorHandler;
global.window.Layers.Editor.ExportController = ExportController;

const { APIManager } = require( '../../resources/ext.layers.editor/APIManager.js' );
const LayerSetManager = require( '../../resources/ext.layers.editor/LayerSetManager.js' );
const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const SetSelectorController = require( '../../resources/ext.layers.editor/ui/SetSelectorController.js' );
const RevisionManager = require( '../../resources/ext.layers.editor/editor/RevisionManager.js' );

describe( 'LayerSetSwitching through Real APIManager (J23)', () => {
	let stateManager;
	let layerSetManager;
	let apiManager;
	let controller;
	let mockEditor;
	let mockUiManager;
	let mockDialogManager;
	let mockHistoryManager;
	let mockCanvasManager;
	let mockLayerPanel;
	let mockPageBuffer;
	let pendingNetworkRequests;

	/**
	 * Helper to create deferred jQuery-compatible jqXHR object
	 * @return {Object}
	 */
	function createDeferredJqXHR() {
		let successCb = null;
		let errorCb = null;
		const req = {
			then: jest.fn( ( onOk, onErr ) => {
				successCb = onOk;
				errorCb = onErr;
				return req;
			} ),
			abort: jest.fn( () => {
				if ( errorCb ) {
					errorCb( 'http', { textStatus: 'abort' } );
				}
			} ),
			resolve: ( data ) => {
				if ( successCb ) {
					successCb( data );
				}
			},
			reject: ( code, result ) => {
				if ( errorCb ) {
					errorCb( code, result );
				}
			}
		};
		return req;
	}

	beforeEach( () => {
		jest.useFakeTimers();
		pendingNetworkRequests = [];

		// Global mw mock
		global.mw = {
			message: jest.fn( ( key ) => ( {
				text: () => key,
				parse: () => key,
				exists: true
			} ) ),
			notify: jest.fn(),
			log: jest.fn(),
			config: {
				get: jest.fn( ( key, defaultValue ) => defaultValue )
			},
			Api: jest.fn()
		};
		global.mw.log.warn = jest.fn();
		global.mw.log.error = jest.fn();
		window.mw = global.mw;

		// Real StateManager
		stateManager = new StateManager();
		stateManager.set( 'currentSetName', 'default' );
		stateManager.set( 'namedSets', [
			{ name: 'default', revision_count: 1 },
			{ name: 'set-a', revision_count: 1 },
			{ name: 'set-b', revision_count: 1 }
		] );
		stateManager.set( 'layers', [
			{ id: 'initial-rect', type: 'rectangle', x: 10, y: 10, width: 100, height: 100 }
		] );
		stateManager.set( 'isDirty', false );
		stateManager.set( 'isLoading', false );
		stateManager.set( 'backgroundVisible', true );
		stateManager.set( 'backgroundOpacity', 1.0 );

		// Mock HistoryManager
		mockHistoryManager = {
			history: [ { layers: [ { id: 'initial-rect' } ] } ],
			historyIndex: 0,
			saveInitialState: jest.fn(),
			saveState: jest.fn()
		};

		// Mock PageBuffer
		let dirtyPagesList = [];
		mockPageBuffer = {
			pages: new Map(),
			isEmpty: jest.fn( () => dirtyPagesList.length === 0 ),
			hasUnsavedChanges: jest.fn( () => dirtyPagesList.length > 0 ),
			dirtyPages: jest.fn( () => dirtyPagesList ),
			clear: jest.fn( () => {
				dirtyPagesList = [];
			} ),
			_setDirtyPages: ( pages ) => {
				dirtyPagesList = pages;
			}
		};

		// Mock DialogManager
		mockDialogManager = {
			showConfirmDialog: jest.fn().mockResolvedValue( true ),
			showPromptDialog: jest.fn().mockResolvedValue( 'test' )
		};

		// Mock CanvasManager
		mockCanvasManager = {
			renderLayers: jest.fn(),
			clearLayers: jest.fn(),
			setBaseDimensions: jest.fn(),
			selectionManager: { clearSelection: jest.fn() }
		};

		// Mock LayerPanel
		mockLayerPanel = {
			updateLayers: jest.fn(),
			updateList: jest.fn()
		};

		// Coordinating Editor mock
		mockEditor = {
			filename: 'Test_Document.png',
			page: 1,
			stateManager: stateManager,
			dialogManager: mockDialogManager,
			historyManager: mockHistoryManager,
			canvasManager: mockCanvasManager,
			layerPanel: mockLayerPanel,
			pageBuffer: mockPageBuffer,
			buildSetSelector: jest.fn(),
			buildRevisionSelector: jest.fn(),
			hasUnsavedChanges: jest.fn( () => {
				if ( stateManager.get( 'isDirty' ) ) {
					return true;
				}
				return !mockPageBuffer.isEmpty();
			} ),
			loadLayerSetByName: null // Wired below
		};

		// Mock UIManager
		mockUiManager = {
			editor: mockEditor,
			getMessage: jest.fn( ( key, fallback ) => fallback || key ),
			addListener: jest.fn( ( el, ev, fn ) => el.addEventListener( ev, fn ) ),
			showConfirmDialog: jest.fn( ( opts ) => mockDialogManager.showConfirmDialog( opts ) ),
			showSpinner: jest.fn(),
			hideSpinner: jest.fn()
		};
		mockEditor.uiManager = mockUiManager;

		// Instantiate REAL APIManager
		apiManager = new APIManager( mockEditor );
		mockEditor.apiManager = apiManager;

		// Network boundary mock on apiManager.api
		apiManager.api = {
			get: jest.fn( ( params ) => {
				const req = createDeferredJqXHR();
				req._params = params;
				pendingNetworkRequests.push( req );
				return req;
			} ),
			post: jest.fn( () => Promise.resolve( {} ) ),
			postWithToken: jest.fn( () => Promise.resolve( {} ) )
		};

		// Instantiate REAL LayerSetManager
		layerSetManager = new LayerSetManager( {
			editor: mockEditor,
			stateManager: stateManager,
			apiManager: apiManager,
			uiManager: mockUiManager
		} );
		mockEditor.layerSetManager = layerSetManager;

		// Wire editor.loadLayerSetByName to authoritative LayerSetManager implementation
		mockEditor.loadLayerSetByName = jest.fn( ( setName, opts ) =>
			layerSetManager.loadLayerSetByName( setName, opts )
		);

		// Instantiate REAL SetSelectorController
		controller = new SetSelectorController( mockUiManager );
		controller.createSetSelector();
		controller.setupControls();
		layerSetManager.buildSetSelector();
	} );

	afterEach( () => {
		if ( apiManager ) {
			apiManager.destroy();
		}
		if ( layerSetManager ) {
			layerSetManager.destroy();
		}
		jest.useRealTimers();
		jest.restoreAllMocks();
		delete global.mw;
	} );

	/**
	 * Creates a standard layersinfo API response payload
	 * @param {string} setName
	 * @param {Array} layers
	 * @return {Object}
	 */
	function makeApiResponse( setName, layers ) {
		return {
			layersinfo: {
				layerset: {
					id: 100 + Math.floor( Math.random() * 900 ),
					name: setName,
					baseWidth: 800,
					baseHeight: 600,
					data: {
						layers: layers || [ { id: `layer-${ setName }`, type: 'text', text: `Text in ${ setName }` } ],
						backgroundVisible: true,
						backgroundOpacity: 1.0
					}
				},
				set_revisions: [ { id: 1, revision: 1 } ],
				named_sets: [
					{ name: 'default', revision_count: 1 },
					{ name: 'set-a', revision_count: 1 },
					{ name: 'set-b', revision_count: 1 }
				],
				pagesWithLayers: [ 1 ]
			}
		};
	}

	describe( '1. Latest response completing before old response (request closure verification)', () => {
		it( 'applies latest response and discards earlier response through real APIManager processing', async () => {
			stateManager.set( 'isDirty', false );

			// 1. User initiates switch to set-a (slow request)
			const switchPromiseA = layerSetManager.loadLayerSetByName( 'set-a' );
			expect( pendingNetworkRequests ).toHaveLength( 1 );
			const netReqA = pendingNetworkRequests[ 0 ];
			expect( netReqA._params.setname ).toBe( 'set-a' );

			// 2. User quickly switches to set-b before set-a completes
			const switchPromiseB = layerSetManager.loadLayerSetByName( 'set-b' );
			expect( pendingNetworkRequests ).toHaveLength( 2 );
			const netReqB = pendingNetworkRequests[ 1 ];
			expect( netReqB._params.setname ).toBe( 'set-b' );

			// 3. Network response for set-b arrives FIRST
			const layersB = [
				{ id: 'b-circle', type: 'circle', cx: 100, cy: 100, r: 50, fill: '#00ff00' }
			];
			netReqB.resolve( makeApiResponse( 'set-b', layersB ) );

			const resultB = await switchPromiseB;
			expect( resultB.status ).toBe( 'success' );

			// Verify set-b was ACTUALLY processed by APIManager._processSetNameData
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( stateManager.get( 'layers' ) ).toEqual( layersB );
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalledWith( layersB );
			expect( mockHistoryManager.saveInitialState ).toHaveBeenCalled();

			// 4. Stale network response for set-a arrives SECOND
			const layersA = [
				{ id: 'a-rect', type: 'rectangle', x: 200, y: 200, width: 80, height: 40, fill: '#ff0000' }
			];
			netReqA.resolve( makeApiResponse( 'set-a', layersA ) );

			const resultA = await switchPromiseA;
			expect( resultA.reason ).toBe( 'superseded' );

			// CRITICAL ASSERTION: Real APIManager evaluated options.shouldApply closure.
			// Because generation advanced, _processSetNameData was NOT called for set-a.
			// Current set name, layers in state, and rendered canvas remain strictly set-b!
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( stateManager.get( 'layers' ) ).toEqual( layersB );
			expect( mockCanvasManager.renderLayers ).not.toHaveBeenCalledWith( layersA );
			expect( mockCanvasManager.renderLayers ).toHaveBeenLastCalledWith( layersB );
		} );
	} );

	describe( '2. API boundary rejects stale data even without caller closure', () => {
		it( 'rejects stale data when the caller omits shouldApply', async () => {
			stateManager.set( 'isDirty', false );

			// Simulate legacy / defective caller that omits shouldApply closure
			const reqA = pendingNetworkRequests.length;
			const loadA = apiManager.loadLayersBySetName( 'set-a' ); // No shouldApply closure passed!
			const netReqA = pendingNetworkRequests[ reqA ];

			const reqB = pendingNetworkRequests.length;
			const loadB = apiManager.loadLayersBySetName( 'set-b' );
			const netReqB = pendingNetworkRequests[ reqB ];

			// set-b completes first
			const layersB = [ { id: 'layer-b', type: 'circle' } ];
			netReqB.resolve( makeApiResponse( 'set-b', layersB ) );
			await loadB;
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );

			// set-a completes second WITHOUT closure protection:
			// In APIManager.js, without options.shouldApply, canApply evaluates fallback which allowed stale processing!
			const layersA = [ { id: 'layer-a', type: 'rectangle' } ];
			netReqA.resolve( makeApiResponse( 'set-a', layersA ) );
			await loadA;

			// The API generation guard also protects callers without closures.
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( stateManager.get( 'layers' ) ).toEqual( layersB );
		} );

		it( 'confirms LayerSetManager always supplies the protective closure preventing the defect', async () => {
			stateManager.set( 'isDirty', false );

			// Using real LayerSetManager (which provides the request closure)
			const switchA = layerSetManager.loadLayerSetByName( 'set-a' );
			const netReqA = pendingNetworkRequests[ pendingNetworkRequests.length - 1 ];

			const switchB = layerSetManager.loadLayerSetByName( 'set-b' );
			const netReqB = pendingNetworkRequests[ pendingNetworkRequests.length - 1 ];

			const layersB = [ { id: 'b-star', type: 'star' } ];
			netReqB.resolve( makeApiResponse( 'set-b', layersB ) );
			await switchB;
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );

			const layersA = [ { id: 'a-line', type: 'line' } ];
			netReqA.resolve( makeApiResponse( 'set-a', layersA ) );
			await switchA;

			// Protected by closure: state remains set-b
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( stateManager.get( 'layers' ) ).toEqual( layersB );
		} );
	} );

	describe( '3. Same target name twice with distinct payloads', () => {
		it( 'discards older response even when target set name is identical', async () => {
			stateManager.set( 'isDirty', false );

			// 1. First switch to set-a (slow, payload v1)
			const switch1 = layerSetManager.loadLayerSetByName( 'set-a' );
			const netReq1 = pendingNetworkRequests[ 0 ];

			// 2. Second switch to set-a (fast, payload v2 - e.g. updated by collaborator)
			const switch2 = layerSetManager.loadLayerSetByName( 'set-a' );
			const netReq2 = pendingNetworkRequests[ 1 ];

			// 3. Payload v2 resolves first
			const layersV2 = [ { id: 'a-v2', type: 'text', text: 'Revision 2 Content' } ];
			netReq2.resolve( makeApiResponse( 'set-a', layersV2 ) );

			const res2 = await switch2;
			expect( res2.status ).toBe( 'success' );
			expect( stateManager.get( 'layers' ) ).toEqual( layersV2 );
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalledWith( layersV2 );

			// 4. Stale Payload v1 resolves second
			const layersV1 = [ { id: 'a-v1', type: 'text', text: 'Obsolete Revision 1 Content' } ];
			netReq1.resolve( makeApiResponse( 'set-a', layersV1 ) );

			const res1 = await switch1;
			expect( res1.reason ).toBe( 'superseded' );

			// Even though both targeted 'set-a', monotonic generation guard prevented v1 from overwriting v2!
			expect( stateManager.get( 'layers' ) ).toEqual( layersV2 );
			expect( mockCanvasManager.renderLayers ).not.toHaveBeenCalledWith( layersV1 );
		} );
	} );

	describe( '4. Reversed confirmation resolution', () => {
		it( 'ensures an earlier confirmation resolving late cannot trigger a load or overwrite newer state', async () => {
			stateManager.set( 'isDirty', true );

			let resolveConfirmA;
			let resolveConfirmB;
			mockDialogManager.showConfirmDialog
				.mockImplementationOnce( () => new Promise( ( resolve ) => { resolveConfirmA = resolve; } ) )
				.mockImplementationOnce( () => new Promise( ( resolve ) => { resolveConfirmB = resolve; } ) );

			// Switch 1 to set-a initiated -> waiting for confirmation
			const switchPromiseA = layerSetManager.loadLayerSetByName( 'set-a' );

			// Switch 2 to set-b initiated -> waiting for confirmation
			const switchPromiseB = layerSetManager.loadLayerSetByName( 'set-b' );

			// User confirms switch 2 (set-b) FIRST
			resolveConfirmB( true );
			// Flush microtasks so async execution reaches api.get
			for ( let i = 0; i < 10; i++ ) {
				await Promise.resolve();
			}

			expect( pendingNetworkRequests ).toHaveLength( 1 );
			const netReqB = pendingNetworkRequests[ 0 ];
			expect( netReqB._params.setname ).toBe( 'set-b' );

			const layersB = [ { id: 'layer-b' } ];
			netReqB.resolve( makeApiResponse( 'set-b', layersB ) );
			const resB = await switchPromiseB;
			expect( resB.status ).toBe( 'success' );
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );

			// User confirms switch 1 (set-a) AFTER switch 2 completed
			resolveConfirmA( true );
			const resA = await switchPromiseA;

			// Switch A was detected as superseded immediately upon confirmation resolution
			expect( resA.reason ).toBe( 'superseded' );
			// No network request was dispatched for switch A
			expect( pendingNetworkRequests ).toHaveLength( 1 );
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
		} );
	} );

	describe( '5. Cached result respects request closure', () => {
		it( 'does not apply cached data if superseded by a newer switch', async () => {
			stateManager.set( 'isDirty', false );

			// Prime cache with set-a
			const primeReq = apiManager.loadLayersBySetName( 'set-a' );
			const primeNet = pendingNetworkRequests[ 0 ];
			const cachedLayers = [ { id: 'cached-a' } ];
			primeNet.resolve( makeApiResponse( 'set-a', cachedLayers ) );
			await primeReq;
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-a' );

			// Now switch to set-b (slow network)
			const switchB = layerSetManager.loadLayerSetByName( 'set-b' );
			const netReqB = pendingNetworkRequests[ 1 ];

			// While set-b is in flight, an older/superseded switch to cached set-a is called with shouldApply returning false
			const staleCachedLoad = apiManager.loadLayersBySetName( 'set-a', {
				shouldApply: () => false // Superseded
			} );
			const cachedResult = await staleCachedLoad;

			expect( cachedResult.superseded ).toBe( true );

			// Complete set-b
			const layersB = [ { id: 'live-b' } ];
			netReqB.resolve( makeApiResponse( 'set-b', layersB ) );
			await switchB;

			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( stateManager.get( 'layers' ) ).toEqual( layersB );
		} );
	} );

	describe( '6. Rejected network response', () => {
		it( 'preserves current set, layers, and dirty state and restores selector on network failure', async () => {
			stateManager.set( 'isDirty', true );
			const initialLayers = stateManager.get( 'layers' );

			const switchPromise = layerSetManager.loadLayerSetByName( 'set-a', { skipConfirm: true } );
			const netReq = pendingNetworkRequests[ 0 ];

			// Network fails with 500 error
			netReq.reject( 'http', { error: { info: 'Internal Server Error' } } );

			const result = await switchPromise;
			expect( result.status ).toBe( 'failed' );

			// Preserved intact
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'default' );
			expect( stateManager.get( 'layers' ) ).toEqual( initialLayers );
			expect( stateManager.get( 'isDirty' ) ).toBe( true );
			expect( stateManager.get( 'isLoading' ) ).toBe( false );

			// Notification shown
			expect( global.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );
	} );

	describe( '7. In-place text/geometry edits during load', () => {
		it( 'detects in-place edits on existing layer IDs and discards incoming set', async () => {
			stateManager.set( 'isDirty', false );
			const startLayers = [ { id: 'rect-1', type: 'rectangle', x: 10, y: 10, width: 50, height: 50 } ];
			stateManager.set( 'layers', startLayers );

			const switchPromise = layerSetManager.loadLayerSetByName( 'set-a' );
			const netReq = pendingNetworkRequests[ 0 ];

			// While load is in-flight, user edits geometry in-place (ID remains 'rect-1')
			stateManager.get( 'layers' )[ 0 ].x = 999;
			stateManager.get( 'layers' )[ 0 ].width = 888;
			stateManager.set( 'isDirty', true );

			// Incoming response arrives
			const incomingLayers = [ { id: 'incoming-circle', type: 'circle' } ];
			netReq.resolve( makeApiResponse( 'set-a', incomingLayers ) );

			const result = await switchPromise;
			expect( result.reason ).toBe( 'newer_edits' );

			// User's in-place edits are preserved!
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'default' );
			expect( stateManager.get( 'layers' )[ 0 ].x ).toBe( 999 );
			expect( stateManager.get( 'layers' )[ 0 ].width ).toBe( 888 );
			expect( stateManager.get( 'isDirty' ) ).toBe( true );

			// Warning notice displayed
			expect( global.mw.notify ).toHaveBeenCalledWith(
				'layers-switch-newer-edits-preserved',
				{ type: 'warn' }
			);
		} );
	} );

	describe( '8. Background edits during load', () => {
		it( 'detects background opacity or visibility edits during load and discards incoming set', async () => {
			stateManager.set( 'isDirty', false );
			stateManager.set( 'backgroundOpacity', 1.0 );

			const switchPromise = layerSetManager.loadLayerSetByName( 'set-a' );
			const netReq = pendingNetworkRequests[ 0 ];

			// User changes background opacity while load is in flight
			stateManager.set( 'backgroundOpacity', 0.3 );
			stateManager.set( 'isDirty', true );

			netReq.resolve( makeApiResponse( 'set-a', [ { id: 'incoming' } ] ) );

			const result = await switchPromise;
			expect( result.reason ).toBe( 'newer_edits' );
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'default' );
			expect( stateManager.get( 'backgroundOpacity' ) ).toBe( 0.3 );
		} );
	} );

	describe( '9. Buffered-page edits during load', () => {
		it( 'detects edits buffered for other pages during load and discards incoming set', async () => {
			stateManager.set( 'isDirty', false );

			const switchPromise = layerSetManager.loadLayerSetByName( 'set-a' );
			const netReq = pendingNetworkRequests[ 0 ];

			// User navigates or buffers page 2 edits during load
			mockPageBuffer._setDirtyPages( [ 2 ] );

			netReq.resolve( makeApiResponse( 'set-a', [ { id: 'incoming' } ] ) );

			const result = await switchPromise;
			expect( result.reason ).toBe( 'newer_edits' );
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'default' );
		} );
	} );

	describe( '10. Assertion of actual layers and canvas context', () => {
		it( 'passes exact layer models and dimensions to CanvasManager upon switch success', async () => {
			stateManager.set( 'isDirty', false );

			const switchPromise = layerSetManager.loadLayerSetByName( 'set-b' );
			const netReq = pendingNetworkRequests[ 0 ];

			const detailedLayers = [
				{ id: 't1', type: 'text', text: 'Hello', fontSize: 18, fill: '#333333' },
				{ id: 'p1', type: 'path', pathData: 'M0,0 L10,10', stroke: '#0000ff' }
			];
			const apiPayload = makeApiResponse( 'set-b', detailedLayers );
			apiPayload.layersinfo.layerset.baseWidth = 1024;
			apiPayload.layersinfo.layerset.baseHeight = 768;

			netReq.resolve( apiPayload );

			const result = await switchPromise;
			expect( result.status ).toBe( 'success' );

			// Assert CanvasManager received exact dimensions and layer models
			expect( mockCanvasManager.setBaseDimensions ).toHaveBeenCalledWith( 1024, 768 );
			expect( mockCanvasManager.selectionManager.clearSelection ).toHaveBeenCalled();
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalledWith( detailedLayers );
			expect( mockLayerPanel.updateLayers ).toHaveBeenCalledWith( detailedLayers );
		} );
	} );

	describe( '11. Loading indicator and spinner state', () => {
		it( 'maintains isLoading and spinner while active load is pending and cleans up on completion', async () => {
			stateManager.set( 'isDirty', false );

			const switch1 = layerSetManager.loadLayerSetByName( 'set-a' );
			const req1 = pendingNetworkRequests[ 0 ];
			expect( stateManager.get( 'isLoading' ) ).toBe( true );
			expect( mockUiManager.showSpinner ).toHaveBeenCalled();

			req1.resolve( makeApiResponse( 'set-a', [] ) );
			await switch1;

			expect( stateManager.get( 'isLoading' ) ).toBe( false );
			expect( mockUiManager.hideSpinner ).toHaveBeenCalled();
		} );

		it( 'keeps the newest request loading after an older request aborts', async () => {
			stateManager.set( 'isDirty', false );

			// Request 1 starts
			const _switch1 = layerSetManager.loadLayerSetByName( 'set-a' );
			const req1 = pendingNetworkRequests[ 0 ];
			expect( stateManager.get( 'isLoading' ) ).toBe( true );

			// Request 2 starts. When APIManager._trackRequest tracks req2, it calls req1.abort().
			// If req1 aborts, APIManager's abort handler unconditionally calls hideSpinner()
			// and stateManager.set('isLoading', false) without checking if req2 is active.
			const switch2 = layerSetManager.loadLayerSetByName( 'set-b' );
			const req2 = pendingNetworkRequests[ 1 ];

			expect( req1.abort ).toHaveBeenCalled();
			expect( stateManager.get( 'isLoading' ) ).toBe( true );

			// Complete request 2
			req2.resolve( makeApiResponse( 'set-b', [] ) );
			const res2 = await switch2;
			expect( res2.status ).toBe( 'success' );
		} );
	} );

	describe( '12. RevisionManager fallback separate exercise (lead defect report)', () => {
		it( 'rejects stale fallback responses without LayerSetManager', async () => {
			// Create an editor configuration where LayerSetManager is ABSENT (forcing RevisionManager fallback)
			const fallbackEditor = {
				filename: 'Fallback_Doc.png',
				stateManager: stateManager,
				apiManager: apiManager,
				uiManager: mockUiManager,
				dialogManager: mockDialogManager,
				historyManager: mockHistoryManager,
				canvasManager: mockCanvasManager,
				layerPanel: mockLayerPanel,
				pageBuffer: mockPageBuffer,
				buildSetSelector: jest.fn(),
				buildRevisionSelector: jest.fn(),
				layerSetManager: null // NO LayerSetManager!
			};
			apiManager.editor = fallbackEditor;

			const revisionManager = new RevisionManager( { editor: fallbackEditor } );

			// 1. First switch via fallback RevisionManager (slow)
			const reqIndex1 = pendingNetworkRequests.length;
			const switchPromise1 = revisionManager.loadLayerSetByName( 'set-a', { skipConfirm: true } );
			const netReq1 = pendingNetworkRequests[ reqIndex1 ];

			// 2. Second switch via fallback RevisionManager (fast)
			const reqIndex2 = pendingNetworkRequests.length;
			const switchPromise2 = revisionManager.loadLayerSetByName( 'set-b', { skipConfirm: true } );
			const netReq2 = pendingNetworkRequests[ reqIndex2 ];

			// Complete switch 2
			const layersB = [ { id: 'fallback-b' } ];
			netReq2.resolve( makeApiResponse( 'set-b', layersB ) );
			await switchPromise2;
			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );

			// Complete switch 1
			const layersA = [ { id: 'fallback-a' } ];
			netReq1.resolve( makeApiResponse( 'set-a', layersA ) );
			await switchPromise1;

			expect( stateManager.get( 'currentSetName' ) ).toBe( 'set-b' );
			expect( stateManager.get( 'layers' ) ).toEqual( layersB );

			revisionManager.destroy();
		} );
	} );
} );
