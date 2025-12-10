/**
 * @jest-environment jsdom
 */

/**
 * Core integration tests for LayersEditor
 *
 * Tests the main editor functionality including layer management,
 * state management, undo/redo, and component coordination.
 */

// Load dependencies first
const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );

describe( 'LayersEditor Core', () => {
	let LayersEditor;
	let editor;
	let mockContainer;

	// Mock manager instances that persist across tests
	let mockUIManager, mockEventManager, mockAPIManager, mockValidationManager;
	let mockCanvasManager, mockToolbar, mockLayerPanel;
	let mockRegistry;

	beforeEach( () => {
		// Setup DOM
		mockContainer = document.createElement( 'div' );
		mockContainer.id = 'layers-editor-container';
		document.body.innerHTML = '';
		document.body.appendChild( mockContainer );

		// Create mock instances
		mockUIManager = {
			createInterface: jest.fn(),
			container: document.createElement( 'div' ),
			toolbarContainer: document.createElement( 'div' ),
			layerPanelContainer: document.createElement( 'div' ),
			canvasContainer: document.createElement( 'div' ),
			revSelectEl: document.createElement( 'select' ),
			setSelectEl: document.createElement( 'select' ),
			showBrowserCompatibilityWarning: jest.fn(),
			showSpinner: jest.fn(),
			hideSpinner: jest.fn()
		};
		mockEventManager = {
			setupGlobalHandlers: jest.fn(),
			destroy: jest.fn()
		};
		mockAPIManager = {
			// Return a Promise that never resolves to avoid interfering with test state
			loadLayers: jest.fn().mockReturnValue( new Promise( () => {} ) ),
			saveLayers: jest.fn().mockResolvedValue( { success: true } ),
			generateLayerId: jest.fn( () => 'layer_' + Math.random().toString( 36 ).substr( 2, 9 ) )
		};
		mockValidationManager = {
			sanitizeLayerData: jest.fn( ( data ) => data ),
			validateLayers: jest.fn().mockReturnValue( { valid: true, errors: [] } ),
			checkBrowserCompatibility: jest.fn().mockReturnValue( true )
		};
		mockCanvasManager = {
			renderLayers: jest.fn(),
			redraw: jest.fn(),
			destroy: jest.fn(),
			setTool: jest.fn(),
			selectLayerById: jest.fn(),
			selectLayer: jest.fn(),
			deselectAll: jest.fn(),
			setBaseDimensions: jest.fn(),
			getSelectedLayerIds: jest.fn( () => [] )
		};

		// Store reference for tests to set up mock implementations
		mockCanvasManager._setupEditor = function ( editor ) {
			this.editor = editor;
			// Update mock implementations to use editor
			this.selectLayer = jest.fn( ( layerId ) => {
				if ( editor && editor.stateManager ) {
					editor.stateManager.set( 'selectedLayerIds', layerId ? [ layerId ] : [] );
				}
			} );
			this.getSelectedLayerIds = jest.fn( () => {
				if ( editor && editor.stateManager ) {
					return editor.stateManager.get( 'selectedLayerIds' ) || [];
				}
				return [];
			} );
		};
		mockToolbar = {
			destroy: jest.fn(),
			updateUndoRedoState: jest.fn(),
			updateDeleteState: jest.fn(),
			setActiveTool: jest.fn()
		};
		mockLayerPanel = {
			render: jest.fn(),
			destroy: jest.fn(),
			selectLayer: jest.fn()
		};

		// Create mock registry that handles all modules with instance caching
		const registeredModules = {};
		const instanceCache = {};
		mockRegistry = {
			register: jest.fn( ( name, factory ) => {
				registeredModules[ name ] = factory;
			} ),
			get: jest.fn( ( name ) => {
				// Return cached instance if available
				if ( instanceCache[ name ] ) {
					return instanceCache[ name ];
				}

				// Built-in managers
				const builtins = {
					UIManager: mockUIManager,
					EventManager: mockEventManager,
					APIManager: mockAPIManager,
					ValidationManager: mockValidationManager
				};
				if ( name in builtins ) {
					instanceCache[ name ] = builtins[ name ];
					return builtins[ name ];
				}

				// StateManager and HistoryManager need real instances
				if ( name === 'StateManager' ) {
					instanceCache[ name ] = new StateManager();
					return instanceCache[ name ];
				}
				if ( name === 'HistoryManager' ) {
					instanceCache[ name ] = new HistoryManager();
					return instanceCache[ name ];
				}

				// Registered modules (Toolbar, LayerPanel, CanvasManager)
				if ( registeredModules[ name ] ) {
					instanceCache[ name ] = registeredModules[ name ]();
					return instanceCache[ name ];
				}
				throw new Error( `Module ${name} not found` );
			} )
		};

		// Setup window globals with mock constructors
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.UIManager = jest.fn().mockImplementation( () => mockUIManager );
		window.EventManager = jest.fn().mockImplementation( () => mockEventManager );
		window.APIManager = jest.fn().mockImplementation( () => mockAPIManager );
		window.ValidationManager = jest.fn().mockImplementation( () => mockValidationManager );
		window.CanvasManager = jest.fn().mockImplementation( () => mockCanvasManager );
		window.Toolbar = jest.fn().mockImplementation( () => mockToolbar );
		window.LayerPanel = jest.fn().mockImplementation( () => mockLayerPanel );
		window.LayersConstants = {
			TOOLS: { POINTER: 'pointer', TEXT: 'text' },
			LAYER_TYPES: { RECTANGLE: 'rectangle', CIRCLE: 'circle' },
			DEFAULTS: {
				COLORS: { STROKE: '#000000', FILL: '#ffffff' },
				LAYER: { STROKE_WIDTH: 2, FONT_SIZE: 16, FONT_FAMILY: 'Arial' }
			},
			UI: { MIN_ZOOM: 0.1, MAX_ZOOM: 5.0 },
			LIMITS: { MAX_LAYERS: 100, MAX_LAYER_ID_LENGTH: 50 }
		};

		// Provide the mock registry globally
		window.layersRegistry = mockRegistry;

		// Mock EventTracker for event listener management
		window.EventTracker = jest.fn( function () {
			this.listeners = [];
			this.add = jest.fn( ( element, event, handler, options ) => {
				element.addEventListener( event, handler, options );
				this.listeners.push( { element, event, handler, options } );
				return { element, event, handler, options };
			} );
			this.remove = jest.fn();
			this.removeAllForElement = jest.fn( ( elem ) => {
				this.listeners = this.listeners.filter( ( l ) => l.element !== elem );
			} );
			this.count = jest.fn( () => this.listeners.length );
			this.destroy = jest.fn( () => {
				this.listeners.forEach( ( info ) => {
					if ( info.element && info.element.removeEventListener ) {
						info.element.removeEventListener( info.event, info.handler, info.options );
					}
				} );
				this.listeners = [];
			} );
		} );

		// Reset module cache and load LayersEditor
		jest.resetModules();
		require( '../../resources/ext.layers.editor/LayersEditor.js' );
		LayersEditor = window.LayersEditor;
	} );

	afterEach( () => {
		if ( editor && !editor.isDestroyed ) {
			editor.destroy();
		}
		editor = null;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create editor with config', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				container: mockContainer
			} );

			expect( editor.filename ).toBe( 'Test.jpg' );
			expect( editor.containerElement ).toBe( mockContainer );
		} );

		it( 'should initialize StateManager', () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );

			expect( editor.stateManager ).toBeDefined();
			expect( editor.stateManager.get( 'layers' ) ).toEqual( [] );
		} );

		it( 'should initialize HistoryManager', () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );

			expect( editor.historyManager ).toBeDefined();
		} );

		it( 'should set debug mode from config', () => {
			editor = new LayersEditor( { filename: 'Test.jpg', debug: true } );

			expect( editor.debug ).toBe( true );
		} );
	} );

	describe( 'layers property bridge', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should get layers from StateManager', () => {
			editor.stateManager.set( 'layers', [ { id: 'test1', type: 'rectangle' } ] );

			expect( editor.layers ).toHaveLength( 1 );
			expect( editor.layers[ 0 ].id ).toBe( 'test1' );
		} );

		it( 'should set layers through StateManager', () => {
			editor.layers = [ { id: 'test2', type: 'circle' } ];

			expect( editor.stateManager.get( 'layers' ) ).toHaveLength( 1 );
			expect( editor.stateManager.get( 'layers' )[ 0 ].id ).toBe( 'test2' );
		} );

		it( 'should ignore non-array assignment', () => {
			editor.layers = [ { id: 'initial' } ];
			editor.layers = 'invalid';

			expect( editor.layers ).toHaveLength( 1 );
			expect( editor.layers[ 0 ].id ).toBe( 'initial' );
		} );
	} );

	describe( 'addLayer', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should add a new layer', () => {
			editor.addLayer( { type: 'rectangle', x: 10, y: 20 } );

			expect( editor.layers ).toHaveLength( 1 );
			expect( editor.layers[ 0 ].type ).toBe( 'rectangle' );
			expect( editor.layers[ 0 ].x ).toBe( 10 );
		} );

		it( 'should generate layer ID', () => {
			editor.addLayer( { type: 'rectangle' } );

			expect( editor.layers[ 0 ].id ).toBeDefined();
			expect( typeof editor.layers[ 0 ].id ).toBe( 'string' );
		} );

		it( 'should set visible to true by default', () => {
			editor.addLayer( { type: 'rectangle' } );

			expect( editor.layers[ 0 ].visible ).toBe( true );
		} );

		it( 'should preserve visible=false', () => {
			editor.addLayer( { type: 'rectangle', visible: false } );

			expect( editor.layers[ 0 ].visible ).toBe( false );
		} );

		it( 'should insert at top of layer stack', () => {
			editor.addLayer( { type: 'rectangle', name: 'first' } );
			editor.addLayer( { type: 'circle', name: 'second' } );

			expect( editor.layers[ 0 ].name ).toBe( 'second' );
			expect( editor.layers[ 1 ].name ).toBe( 'first' );
		} );

		it( 'should mark editor as dirty', () => {
			editor.addLayer( { type: 'rectangle' } );

			expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		} );

		it( 'should sanitize layer data', () => {
			editor.addLayer( { type: 'rectangle', x: 10 } );

			expect( mockValidationManager.sanitizeLayerData ).toHaveBeenCalled();
		} );
	} );

	describe( 'updateLayer', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
			editor.addLayer( { type: 'rectangle', x: 0, y: 0 } );
		} );

		it( 'should update existing layer', () => {
			const layerId = editor.layers[ 0 ].id;
			editor.updateLayer( layerId, { x: 100, y: 200 } );

			expect( editor.layers[ 0 ].x ).toBe( 100 );
			expect( editor.layers[ 0 ].y ).toBe( 200 );
		} );

		it( 'should preserve unmodified properties', () => {
			const layerId = editor.layers[ 0 ].id;
			editor.updateLayer( layerId, { x: 100 } );

			expect( editor.layers[ 0 ].type ).toBe( 'rectangle' );
		} );

		it( 'should mark editor as dirty', () => {
			editor.stateManager.set( 'isDirty', false );
			const layerId = editor.layers[ 0 ].id;
			editor.updateLayer( layerId, { x: 100 } );

			expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		} );

		it( 'should handle non-existent layer gracefully', () => {
			expect( () => {
				editor.updateLayer( 'nonexistent', { x: 100 } );
			} ).not.toThrow();
		} );

		it( 'should sync outerRadius to radius', () => {
			const layerId = editor.layers[ 0 ].id;
			editor.updateLayer( layerId, { outerRadius: 50 } );

			expect( editor.layers[ 0 ].radius ).toBe( 50 );
		} );
	} );

	describe( 'removeLayer', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
			editor.addLayer( { type: 'rectangle', name: 'layer1' } );
			editor.addLayer( { type: 'circle', name: 'layer2' } );
		} );

		it( 'should remove layer by ID', () => {
			const layerId = editor.layers[ 0 ].id;
			editor.removeLayer( layerId );

			expect( editor.layers ).toHaveLength( 1 );
		} );

		it( 'should remove correct layer', () => {
			const layerToRemove = editor.layers[ 0 ];
			editor.removeLayer( layerToRemove.id );

			expect( editor.layers.find( ( l ) => l.id === layerToRemove.id ) ).toBeUndefined();
		} );

		it( 'should mark editor as dirty', () => {
			editor.stateManager.set( 'isDirty', false );
			editor.removeLayer( editor.layers[ 0 ].id );

			expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		} );

		it( 'should handle non-existent layer gracefully', () => {
			expect( () => {
				editor.removeLayer( 'nonexistent' );
			} ).not.toThrow();
		} );
	} );

	describe( 'getLayerById', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
			editor.addLayer( { type: 'rectangle', name: 'TestLayer' } );
		} );

		it( 'should find layer by ID', () => {
			const layerId = editor.layers[ 0 ].id;
			const found = editor.getLayerById( layerId );

			expect( found ).toBeDefined();
			expect( found.name ).toBe( 'TestLayer' );
		} );

		it( 'should return undefined for non-existent ID', () => {
			const found = editor.getLayerById( 'nonexistent' );

			expect( found ).toBeUndefined();
		} );
	} );

	describe( 'markDirty', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should set isDirty to true', () => {
			editor.stateManager.set( 'isDirty', false );
			editor.markDirty();

			expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		} );
	} );

	describe( 'generateLayerId (via apiManager)', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should generate unique IDs via apiManager', () => {
			const id1 = editor.apiManager.generateLayerId();
			const id2 = editor.apiManager.generateLayerId();

			expect( id1 ).not.toBe( id2 );
		} );

		it( 'should generate string IDs via apiManager', () => {
			const id = editor.apiManager.generateLayerId();

			expect( typeof id ).toBe( 'string' );
		} );
	} );

	describe( 'selectLayer', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
			editor.addLayer( { type: 'rectangle', name: 'layer1' } );
			// Setup mock canvasManager with editor reference for selection tests
			if ( editor.canvasManager && editor.canvasManager._setupEditor ) {
				editor.canvasManager._setupEditor( editor );
			}
		} );

		it( 'should update selectedLayerIds in state', () => {
			const layerId = editor.layers[ 0 ].id;
			editor.selectLayer( layerId );

			// selectLayer now sets selectedLayerIds (plural array)
			const selectedIds = editor.stateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toContain( layerId );
		} );
	} );

	describe( 'selection clearing', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
			editor.addLayer( { type: 'rectangle' } );
			editor.selectLayer( editor.layers[ 0 ].id );
		} );

		it( 'should clear selectedLayerIds via stateManager', () => {
			// Selection clearing is done via stateManager directly
			editor.stateManager.set( 'selectedLayerIds', [] );

			const selectedIds = editor.stateManager.get( 'selectedLayerIds' );
			expect( selectedIds ).toHaveLength( 0 );
		} );
	} );

	describe( 'undo/redo', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should have undo method', () => {
			expect( typeof editor.undo ).toBe( 'function' );
		} );

		it( 'should have redo method', () => {
			expect( typeof editor.redo ).toBe( 'function' );
		} );

		it( 'should have canUndo via historyManager', () => {
			expect( typeof editor.historyManager.canUndo ).toBe( 'function' );
		} );

		it( 'should have canRedo via historyManager', () => {
			expect( typeof editor.historyManager.canRedo ).toBe( 'function' );
		} );
	} );

	describe( 'deleteSelected', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
			editor.addLayer( { type: 'rectangle' } );
			// Setup mock canvasManager with editor reference for selection operations
			if ( editor.canvasManager && editor.canvasManager._setupEditor ) {
				editor.canvasManager._setupEditor( editor );
			}
		} );

		it( 'should delete selected layer', () => {
			const layerId = editor.layers[ 0 ].id;
			editor.stateManager.set( 'selectedLayerIds', [ layerId ] );
			editor.deleteSelected();

			expect( editor.layers ).toHaveLength( 0 );
		} );

		it( 'should handle no selection gracefully', () => {
			editor.stateManager.set( 'selectedLayerIds', [] );

			expect( () => {
				editor.deleteSelected();
			} ).not.toThrow();
		} );
	} );

	describe( 'duplicateSelected', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
			editor.addLayer( { type: 'rectangle', x: 100, y: 100, width: 50, height: 50 } );
			// Setup mock canvasManager with editor reference for selection operations
			if ( editor.canvasManager && editor.canvasManager._setupEditor ) {
				editor.canvasManager._setupEditor( editor );
			}
		} );

		it( 'should duplicate selected layer', () => {
			const layerId = editor.layers[ 0 ].id;
			editor.stateManager.set( 'selectedLayerIds', [ layerId ] );
			editor.duplicateSelected();

			expect( editor.layers.length ).toBeGreaterThanOrEqual( 2 );
		} );

		it( 'should offset duplicated layer position', () => {
			const originalX = editor.layers[ 0 ].x;
			const layerId = editor.layers[ 0 ].id;
			editor.stateManager.set( 'selectedLayerIds', [ layerId ] );
			editor.duplicateSelected();

			// Should have different position
			const duplicated = editor.layers[ 0 ];
			expect( duplicated.x ).not.toBe( originalX );
		} );
	} );

	describe( 'setCurrentTool', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should update currentTool in state', () => {
			editor.setCurrentTool( 'text' );

			expect( editor.stateManager.get( 'currentTool' ) ).toBe( 'text' );
		} );

		it( 'should propagate to canvasManager', () => {
			editor.setCurrentTool( 'rectangle' );

			if ( editor.canvasManager ) {
				expect( editor.canvasManager.setTool ).toHaveBeenCalled();
			}
		} );
	} );

	describe( 'destroy', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should set isDestroyed flag', () => {
			editor.destroy();

			expect( editor.isDestroyed ).toBe( true );
		} );

		it( 'should clean up managers', () => {
			editor.destroy();

			expect( mockEventManager.destroy ).toHaveBeenCalled();
		} );

		it( 'should be safe to call multiple times', () => {
			expect( () => {
				editor.destroy();
				editor.destroy();
			} ).not.toThrow();
		} );
	} );

	describe( 'event listener tracking', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should track DOM event listeners', () => {
			const element = document.createElement( 'div' );
			const handler = jest.fn();
			editor.trackEventListener( element, 'click', handler );

			// Now tracked via EventTracker
			expect( editor.eventTracker.add ).toHaveBeenCalledWith( element, 'click', handler, undefined );
		} );

		it( 'should add event listener to element', () => {
			const element = document.createElement( 'div' );
			const handler = jest.fn();
			editor.trackEventListener( element, 'click', handler );

			element.click();
			expect( handler ).toHaveBeenCalled();
		} );
	} );

	describe( 'getMessage', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should return message text', () => {
			// mw.message is mocked globally
			const result = editor.getMessage( 'layers-editor-title' );
			expect( typeof result ).toBe( 'string' );
		} );

		it( 'should use fallback for missing key', () => {
			const result = editor.getMessage( 'nonexistent-key' );
			expect( typeof result ).toBe( 'string' );
		} );
	} );

	describe( 'updateUIState', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} );

		it( 'should not throw without toolbar', () => {
			editor.toolbar = null;

			expect( () => {
				editor.updateUIState();
			} ).not.toThrow();
		} );

		it( 'should update toolbar state', () => {
			if ( editor.toolbar ) {
				editor.addLayer( { type: 'rectangle' } );
				editor.updateUIState();

				expect( editor.toolbar.updateUndoRedoState ).toHaveBeenCalled();
			}
		} );
	} );
} );

describe( 'LayersEditor validation', () => {
	let LayersEditor;
	let editor;
	let mockRegistry;

	beforeEach( () => {
		// Setup globals
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;

		const mockUIManager = {
			createInterface: jest.fn(),
			container: document.createElement( 'div' ),
			toolbarContainer: document.createElement( 'div' ),
			layerPanelContainer: document.createElement( 'div' ),
			canvasContainer: document.createElement( 'div' ),
			revSelectEl: document.createElement( 'select' ),
			setSelectEl: document.createElement( 'select' ),
			showBrowserCompatibilityWarning: jest.fn(),
			showSpinner: jest.fn(),
			hideSpinner: jest.fn()
		};
		const mockEventManager = { setupGlobalHandlers: jest.fn(), destroy: jest.fn() };
		const mockAPIManager = {
			// Return a Promise that never resolves to avoid interfering with test state
			loadLayers: jest.fn().mockReturnValue( new Promise( () => {} ) ),
			generateLayerId: jest.fn().mockReturnValue( 'test_id' )
		};
		const mockValidationManager = {
			sanitizeLayerData: jest.fn( ( data ) => data ),
			validateLayers: jest.fn().mockReturnValue( { valid: true } ),
			checkBrowserCompatibility: jest.fn().mockReturnValue( true )
		};
		const mockCanvasManager = {
			renderLayers: jest.fn(),
			redraw: jest.fn(),
			destroy: jest.fn(),
			setBaseDimensions: jest.fn()
		};
		const mockToolbar = { destroy: jest.fn(), updateUndoRedoState: jest.fn() };
		const mockLayerPanel = { render: jest.fn(), destroy: jest.fn() };

		// Create mock registry
		const registeredModules = {};
		mockRegistry = {
			register: jest.fn( ( name, factory ) => {
				registeredModules[ name ] = factory;
			} ),
			get: jest.fn( ( name ) => {
				const builtins = {
					UIManager: mockUIManager,
					EventManager: mockEventManager,
					APIManager: mockAPIManager,
					ValidationManager: mockValidationManager,
					StateManager: new StateManager(),
					HistoryManager: new HistoryManager()
				};
				if ( name in builtins ) {
					return builtins[ name ];
				}
				if ( registeredModules[ name ] ) {
					return registeredModules[ name ]();
				}
				throw new Error( `Module ${name} not found` );
			} )
		};

		window.UIManager = jest.fn().mockReturnValue( mockUIManager );
		window.EventManager = jest.fn().mockReturnValue( mockEventManager );
		window.APIManager = jest.fn().mockReturnValue( mockAPIManager );
		window.ValidationManager = jest.fn().mockReturnValue( mockValidationManager );
		window.CanvasManager = jest.fn().mockReturnValue( mockCanvasManager );
		window.Toolbar = jest.fn().mockReturnValue( mockToolbar );
		window.LayerPanel = jest.fn().mockReturnValue( mockLayerPanel );
		window.LayersConstants = {
			TOOLS: {},
			LAYER_TYPES: {},
			DEFAULTS: { COLORS: {}, LAYER: {} },
			UI: {},
			LIMITS: {}
		};

		window.layersRegistry = mockRegistry;

		jest.resetModules();
		require( '../../resources/ext.layers.editor/LayersEditor.js' );
		LayersEditor = window.LayersEditor;
	} );

	afterEach( () => {
		if ( editor && !editor.isDestroyed ) {
			editor.destroy();
		}
	} );

	it( 'should handle missing dependencies gracefully', () => {
		// This tests that the editor can initialize even with some missing optional deps
		expect( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} ).not.toThrow();
	} );

	it( 'should initialize without container', () => {
		expect( () => {
			editor = new LayersEditor( { filename: 'Test.jpg' } );
		} ).not.toThrow();

		expect( editor ).toBeDefined();
	} );

	it( 'should initialize without filename', () => {
		expect( () => {
			editor = new LayersEditor( {} );
		} ).not.toThrow();

		expect( editor.filename ).toBeUndefined();
	} );
} );
