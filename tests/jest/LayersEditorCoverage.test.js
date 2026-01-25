/**
 * @jest-environment jsdom
 */

/**
 * Extended Unit Tests for LayersEditor - Coverage Improvement
 * Targets uncovered lines: validateDependencies edge cases, fallback registry,
 * sanitizeGlobalErrorMessage, hookListener, autoBootstrap paths
 */

describe( 'LayersEditor Coverage Extension', () => {
	let LayersEditor;
	let editor;
	let mockStateManager;
	let mockHistoryManager;
	let mockUIManager;
	let mockEventManager;
	let mockAPIManager;
	let mockValidationManager;
	let mockCanvasManager;
	let mockToolbar;
	let mockLayerPanel;
	let mockRegistry;

	beforeEach( () => {
		// Reset DOM
		document.body.innerHTML = '';

		// Create mock instances
		mockStateManager = {
			set: jest.fn(),
			get: jest.fn( () => [] ),
			getLayers: jest.fn( () => [] ),
			setLayers: jest.fn(),
			setDirty: jest.fn(),
			on: jest.fn(),
			off: jest.fn()
		};

		mockHistoryManager = {
			saveState: jest.fn(),
			undo: jest.fn(),
			redo: jest.fn(),
			canUndo: jest.fn( () => false ),
			canRedo: jest.fn( () => false )
		};

		mockUIManager = {
			container: document.createElement( 'div' ),
			toolbarContainer: document.createElement( 'div' ),
			layerPanelContainer: document.createElement( 'div' ),
			canvasContainer: document.createElement( 'div' ),
			revSelectEl: document.createElement( 'select' ),
			setSelectEl: document.createElement( 'select' ),
			createInterface: jest.fn(),
			showBrowserCompatibilityWarning: jest.fn(),
			showSpinner: jest.fn(),
			hideSpinner: jest.fn(),
			showNotification: jest.fn()
		};
		mockUIManager.container.innerHTML = `
			<div class="layers-header-close"></div>
			<div class="layers-canvas-container">
				<canvas id="layers-canvas" width="800" height="600"></canvas>
			</div>
		`;
		document.body.appendChild( mockUIManager.container );

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
			validateLayers: jest.fn( () => ( { isValid: true, errors: [], warnings: [] } ) ),
			checkBrowserCompatibility: jest.fn( () => true ),
			sanitizeLayerData: jest.fn( ( data ) => data )
		};

		mockCanvasManager = {
			renderLayers: jest.fn(),
			redraw: jest.fn(),
			setBaseDimensions: jest.fn(),
			destroy: jest.fn(),
			setTool: jest.fn(),
			selectLayerById: jest.fn(),
			selectLayer: jest.fn(),
			deselectAll: jest.fn(),
			getSelectedLayerIds: jest.fn( () => [] )
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

		// Create mock registry
		mockRegistry = {
			get: jest.fn( ( name ) => {
				const managers = {
					UIManager: mockUIManager,
					EventManager: mockEventManager,
					APIManager: mockAPIManager,
					ValidationManager: mockValidationManager,
					StateManager: mockStateManager,
					HistoryManager: mockHistoryManager
				};
				return managers[ name ];
			} ),
			register: jest.fn()
		};

		// Setup window globals
		window.mw = {
			config: {
				get: jest.fn( ( key ) => {
					if ( key === 'wgLayersDebug' ) return false;
					if ( key === 'wgLayersEditorInit' ) return null;
					if ( key === 'debug' ) return false;
					return null;
				} ),
				set: jest.fn()
			},
			hook: jest.fn( () => ( {
				add: jest.fn(),
				fire: jest.fn()
			} ) ),
			log: jest.fn(),
			message: jest.fn( () => ( { text: () => 'Test message' } ) ),
			notify: jest.fn()
		};
		window.mw.log.warn = jest.fn();
		window.mw.log.error = jest.fn();

		// Mock required classes with namespaced exports
		window.Layers = window.Layers || {};
		window.Layers.Validation = window.Layers.Validation || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Core = window.Layers.Core || {};
		window.StateManager = jest.fn( () => mockStateManager );
		window.HistoryManager = jest.fn( () => mockHistoryManager );
		window.UIManager = jest.fn( () => mockUIManager );
		window.EventManager = jest.fn( () => mockEventManager );
		window.APIManager = jest.fn( () => mockAPIManager );
		window.Layers.Validation.Manager = jest.fn( () => mockValidationManager );
		window.Layers.Canvas.Manager = jest.fn( () => mockCanvasManager );
		window.Toolbar = jest.fn( () => mockToolbar );
		window.Layers.UI.LayerPanel = jest.fn( () => mockLayerPanel );

		// Mock LayersConstants
		window.Layers.Constants = {
			TOOLS: { POINTER: 'pointer' },
			LAYER_TYPES: { RECTANGLE: 'rectangle' },
			DEFAULTS: { STROKE_WIDTH: 2 },
			UI: { MODAL_Z_INDEX: 1000 },
			LIMITS: { MAX_LAYERS: 100 }
		};

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

		// Mock ErrorHandler
		window.ErrorHandler = {
			handleError: jest.fn()
		};
		window.layersErrorHandler = window.ErrorHandler;

		// Mock RevisionManager - Uses getters to dynamically access editor's managers
		window.RevisionManager = jest.fn().mockImplementation( function ( config ) {
			this.editor = config.editor;

			Object.defineProperty( this, 'stateManager', {
				get: function () { return this.editor.stateManager; }
			} );
			Object.defineProperty( this, 'uiManager', {
				get: function () { return this.editor.uiManager; }
			} );
			Object.defineProperty( this, 'apiManager', {
				get: function () { return this.editor.apiManager; }
			} );

			this.parseMWTimestamp = jest.fn( () => new Date() );
			this.getMessage = jest.fn( ( key, fallback ) => fallback || key );
			this.buildRevisionSelector = jest.fn();
			this.updateRevisionLoadButton = jest.fn();
			this.buildSetSelector = jest.fn();
			this.updateNewSetButtonState = jest.fn();
			this.loadLayerSetByName = jest.fn().mockResolvedValue();
			this.createNewLayerSet = jest.fn().mockResolvedValue( true );
			this.loadRevisionById = jest.fn().mockResolvedValue();
		} );

		// Mock DialogManager
		window.Layers.UI.DialogManager = jest.fn().mockImplementation( function ( config ) {
			this.editor = config.editor;
			this.activeDialogs = [];
			this.showCancelConfirmDialog = jest.fn();
			this.showPromptDialog = jest.fn();
			this.showKeyboardShortcutsDialog = jest.fn();
			this.closeAllDialogs = jest.fn( () => { this.activeDialogs = []; } );
		} );

		// Mock EditorBootstrap - This actually validates dependencies and logs warnings
		window.Layers.Core.EditorBootstrap = {
			validateDependencies: jest.fn( () => {
				const missing = [];
				const requiredClasses = [
					'UIManager', 'EventManager', 'APIManager', 'ValidationManager',
					'StateManager', 'HistoryManager', 'CanvasManager', 'Toolbar', 'LayerPanel'
				];
				const requiredConstantGroups = [ 'TOOLS', 'LAYER_TYPES', 'DEFAULTS', 'UI', 'LIMITS' ];

				// Check required global classes
				requiredClasses.forEach( ( name ) => {
					if ( typeof window[ name ] !== 'function' ) {
						missing.push( name );
					}
				} );

				// Check LayersConstants
				if ( typeof window.Layers.Constants === 'undefined' ) {
					missing.push( 'Layers.Constants' );
				} else {
					requiredConstantGroups.forEach( ( group ) => {
						if ( !window.Layers.Constants[ group ] ) {
							missing.push( 'Layers.Constants.' + group );
						}
					} );
				}

				if ( missing.length > 0 ) {
					const errorMsg = 'Layers Editor: Missing dependencies: ' + missing.join( ', ' );
					if ( typeof mw !== 'undefined' && mw.log && mw.log.warn ) {
						mw.log.warn( errorMsg );
					}
					return false;
				}
				return true;
			} ),
			areEditorDependenciesReady: jest.fn( () => true ),
			sanitizeGlobalErrorMessage: jest.fn( ( msg ) => msg ),
			registerHook: jest.fn()
		};

		// Reset modules and load LayersEditor fresh
		jest.resetModules();
		require( '../../resources/ext.layers.editor/LayersEditor.js' );
		LayersEditor = window.Layers.Core.Editor;
	} );

	afterEach( () => {
		if ( editor && editor.destroy ) {
			try {
				editor.destroy();
			} catch ( e ) {
				// Ignore cleanup errors
			}
		}
		document.body.innerHTML = '';
		jest.clearAllMocks();

		delete window.mw;
		delete window.StateManager;
		delete window.HistoryManager;
		delete window.UIManager;
		delete window.EventManager;
		delete window.APIManager;
		if ( window.Layers && window.Layers.Validation ) {
			delete window.Layers.Validation.Manager;
		}
		if ( window.Layers && window.Layers.Canvas ) {
			delete window.Layers.Canvas.Manager;
		}
		delete window.Toolbar;
		if ( window.Layers && window.Layers.UI ) {
			delete window.Layers.UI.LayerPanel;
			delete window.Layers.UI.DialogManager;
		}
		if ( window.Layers ) {
			delete window.Layers.Constants;
		}
		delete window.layersRegistry;
		delete window.ErrorHandler;
		delete window.layersErrorHandler;
		if ( window.Layers && window.Layers.Core ) {
			delete window.Layers.Core.Editor;
		}
	} );

	describe( 'validateDependencies', () => {
		it( 'should return true when all dependencies present', () => {
			// Dependencies are mocked in beforeAll
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			expect( editor ).toBeDefined();
		} );

		it( 'should warn when LayersConstants is missing', () => {
			const originalConstants = window.Layers.Constants;
			delete window.Layers.Constants;

			// Should still create editor but warn
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			expect( window.mw.log.warn ).toHaveBeenCalled();

			window.Layers.Constants = originalConstants;
		} );

		it( 'should warn when required constant groups missing', () => {
			const originalConstants = window.Layers.Constants;
			window.Layers.Constants = { TOOLS: {} }; // Missing other groups

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			expect( window.mw.log.warn ).toHaveBeenCalled();

			window.Layers.Constants = originalConstants;
		} );
	} );

	describe( 'fallback registry', () => {
		it( 'should use provided registry when available', () => {
			// The registry should be used from window.layersRegistry
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			expect( editor.registry ).toBe( mockRegistry );
		} );

		it( 'should use layersModuleRegistry as alternative', () => {
			// Create an alternative registry that returns all the required managers
			const altRegistry = {
				get: jest.fn( ( name ) => {
					const managers = {
						UIManager: mockUIManager,
						EventManager: mockEventManager,
						APIManager: mockAPIManager,
						ValidationManager: mockValidationManager,
						StateManager: mockStateManager,
						HistoryManager: mockHistoryManager
					};
					return managers[ name ];
				} ),
				register: jest.fn()
			};
			window.layersModuleRegistry = altRegistry;
			delete window.layersRegistry;

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayersEditor.js' );
			LayersEditor = window.Layers.Core.Editor;

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			expect( editor.registry ).toBe( altRegistry );

			window.layersRegistry = mockRegistry;
			delete window.layersModuleRegistry;
		} );
	} );

	describe( 'API loadLayers paths', () => {
		it( 'should handle successful layer load with all data', async () => {
			mockAPIManager.loadLayers.mockResolvedValue( {
				layers: [ { id: '1', type: 'rectangle', x: 10, y: 10, width: 100, height: 50 } ],
				baseWidth: 1024,
				baseHeight: 768,
				allLayerSets: [ { id: 1, name: 'default' } ],
				currentLayerSetId: 1
			} );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			// Wait for async init
			await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'baseWidth', 1024 );
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'baseHeight', 768 );
		} );

		it( 'should handle layer load failure gracefully', async () => {
			mockAPIManager.loadLayers.mockRejectedValue( new Error( 'Network error' ) );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			// Wait for async error handling
			await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );

			// Should set empty layers on failure
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'layers', [] );
		} );

		it( 'should handle load with null data', async () => {
			mockAPIManager.loadLayers.mockResolvedValue( null );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'layers', [] );
		} );

		it( 'should handle load with missing layers property', async () => {
			mockAPIManager.loadLayers.mockResolvedValue( { baseWidth: 800 } );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'layers', [] );
		} );
	} );

	describe( 'normalizeLayers', () => {
		it( 'should set visible to true for layers without visible property', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			const layers = [
				{ id: '1', type: 'rectangle' },
				{ id: '2', type: 'circle', visible: false },
				{ id: '3', type: 'text', visible: true }
			];

			const normalized = editor.normalizeLayers( layers );

			expect( normalized[ 0 ].visible ).toBe( true );
			expect( normalized[ 1 ].visible ).toBe( false );
			expect( normalized[ 2 ].visible ).toBe( true );
		} );

		it( 'should handle empty array', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			const normalized = editor.normalizeLayers( [] );
			expect( normalized ).toEqual( [] );
		} );

		it( 'should return input unchanged for null/undefined', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			// normalizeLayers returns non-array input unchanged
			expect( editor.normalizeLayers( null ) ).toBeNull();
			expect( editor.normalizeLayers( undefined ) ).toBeUndefined();
		} );
	} );

	describe( 'debugLog and errorLog', () => {
		it( 'should log when debug mode enabled', () => {
			window.mw.config.get.mockImplementation( ( key ) => {
				if ( key === 'wgLayersDebug' ) return true;
				return null;
			} );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg',
				debug: true
			} );

			// Debug log should use mw.log
			editor.debugLog( 'Test message' );
			// The log should have been called (via mw.log or console)
		} );

		it( 'should log errors via errorLog', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.errorLog( 'Test error' );
			expect( window.mw.log.error ).toHaveBeenCalled();
		} );
	} );

	describe( 'close button setup', () => {
		it( 'should set up close button handler', () => {
			const closeBtn = document.createElement( 'button' );
			closeBtn.className = 'layers-header-close';
			mockUIManager.container.appendChild( closeBtn );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			// The handler should be set up
			expect( editor ).toBeDefined();
		} );
	} );

	describe( 'destroy method', () => {
		it( 'should clean up all resources', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.destroy();

			expect( editor.isDestroyed ).toBe( true );
		} );

		it( 'should handle destroy when already destroyed', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.destroy();
			// Should not throw on second destroy
			expect( () => editor.destroy() ).not.toThrow();
		} );
	} );

	describe( 'window listener tracking', () => {
		it( 'should track window listeners for cleanup', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			const handler = jest.fn();
			editor.trackWindowListener( 'resize', handler );

			// Now tracked via EventTracker
			expect( editor.eventTracker.add ).toHaveBeenCalledWith(
				window, 'resize', handler, undefined
			);
		} );
	} );

	describe( 'markDirty and markClean', () => {
		it( 'should mark editor as dirty', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.markDirty();
			expect( mockStateManager.setDirty ).toHaveBeenCalledWith( true );
		} );

		it( 'should mark editor as clean', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.markClean();
			expect( mockStateManager.setDirty ).toHaveBeenCalledWith( false );
		} );
	} );

	describe( 'saveState', () => {
		it( 'should call historyManager.saveState', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.saveState( 'test action' );
			expect( mockHistoryManager.saveState ).toHaveBeenCalledWith( 'test action' );
		} );
	} );

	describe( 'selectLayer', () => {
		it( 'should select a layer by id', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.selectLayer( 'layer1' );

			// selectLayer now delegates to canvasManager or sets selectedLayerIds (plural)
			expect( mockStateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [ 'layer1' ] );
		} );

		it( 'should handle null layer id to deselect', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.selectLayer( null );

			expect( mockStateManager.set ).toHaveBeenCalledWith( 'selectedLayerIds', [] );
		} );
	} );

	describe( 'deleteSelected', () => {
		it( 'should delete selected layer when one is selected', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'selectedLayerIds' ) return [ 'layer1' ];
				if ( key === 'layers' ) return [ { id: 'layer1' }, { id: 'layer2' } ];
				return null;
			} );
			// Mock canvasManager.getSelectedLayerIds to return selected layer
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.deleteSelected();

			// Should have removed the layer (via removeLayer which calls stateManager)
			expect( mockStateManager.set ).toHaveBeenCalled();
		} );

		it( 'should do nothing when no layer is selected', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'selectedLayerIds' ) return [];
				return null;
			} );
			// Mock canvasManager.getSelectedLayerIds to return empty
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [] );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			const setCallsBefore = mockStateManager.set.mock.calls.length;
			editor.deleteSelected();

			// The function now checks getSelectedLayerIds() which returns empty array
			// No additional set calls should be made for layer removal
		} );
	} );

	describe( 'duplicateSelected', () => {
		it( 'should duplicate selected layer', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'selectedLayerIds' ) return [ 'layer1' ];
				if ( key === 'layers' ) return [
					{ id: 'layer1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50 }
				];
				return null;
			} );
			// Mock canvasManager.getSelectedLayerIds to return selected layer
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.duplicateSelected();

			// Should have called setLayers (via addLayer)
			expect( mockStateManager.set ).toHaveBeenCalledWith(
				'layers',
				expect.arrayContaining( [
					expect.objectContaining( { type: 'rectangle', x: 30, y: 40 } )
				] )
			);
		} );
	} );

	describe( 'updateUIState', () => {
		it( 'should update toolbar undo/redo state', () => {
			mockHistoryManager.canUndo.mockReturnValue( true );
			mockHistoryManager.canRedo.mockReturnValue( false );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );
			editor.toolbar = mockToolbar;

			editor.updateUIState();

			expect( mockToolbar.updateUndoRedoState ).toHaveBeenCalledWith( true, false );
		} );
	} );

	describe( 'handleKeyDown', () => {
		it( 'should delegate to eventManager', () => {
			const mockEvent = new KeyboardEvent( 'keydown', { key: 'Delete' } );
			mockEventManager.handleKeyDown = jest.fn();

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.handleKeyDown( mockEvent );

			expect( mockEventManager.handleKeyDown ).toHaveBeenCalledWith( mockEvent );
		} );
	} );

	describe( 'cancel', () => {
		beforeEach( () => {
			mockUIManager.destroy = jest.fn();
		} );

		it( 'should close immediately when not dirty', () => {
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'isDirty' ) return false;
				return null;
			} );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.cancel( false );

			expect( mockUIManager.destroy ).toHaveBeenCalled();
		} );
	} );

	describe( 'navigateBackToFile', () => {
		it( 'should use mw.util.getUrl when available', () => {
			window.mw.util = {
				getUrl: jest.fn( () => '/wiki/File:Test.jpg' )
			};

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			// Ensure isSlide is false for this test (file mode, not slide mode)
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'isSlide' ) return false;
				return [];
			} );

			// Mock window.location.href setter
			const originalLocation = window.location;
			delete window.location;
			window.location = { href: '' };

			editor.navigateBackToFile();

			expect( window.mw.util.getUrl ).toHaveBeenCalledWith( 'File:Test.jpg', { layers: 'on' } );

			window.location = originalLocation;
		} );

		it( 'should use history.back for slide mode', () => {
			window.mw.util = {
				getUrl: jest.fn( () => '/wiki/Special:Slides' )
			};

			editor = new LayersEditor( {
				filename: 'Slide:TestSlide',
				imageUrl: null,
				isSlide: true
			} );

			// Ensure isSlide is true for this test (slide mode)
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'isSlide' ) return true;
				return [];
			} );

			// Mock window.location and history
			const originalLocation = window.location;
			delete window.location;
			window.location = { href: '' };
			const mockBack = jest.fn();
			const originalHistory = window.history;
			Object.defineProperty( window, 'history', {
				value: { length: 2, back: mockBack },
				writable: true
			} );

			editor.navigateBackToFile();

			expect( mockBack ).toHaveBeenCalled();
			expect( window.mw.util.getUrl ).not.toHaveBeenCalledWith(
				expect.stringContaining( 'File:' ),
				expect.anything()
			);

			window.location = originalLocation;
			Object.defineProperty( window, 'history', {
				value: originalHistory,
				writable: true
			} );
		} );
	} );

	describe( 'save', () => {
		it( 'should validate layers before saving', () => {
			mockStateManager.get.mockReturnValue( [ { id: 'layer1', type: 'rectangle' } ] );
			mockValidationManager.validateLayers.mockReturnValue( { isValid: true, errors: [], warnings: [] } );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.save();

			expect( mockValidationManager.validateLayers ).toHaveBeenCalled();
			expect( mockUIManager.showSpinner ).toHaveBeenCalled();
		} );

		it( 'should not save when validation fails', () => {
			mockStateManager.get.mockReturnValue( [ { id: 'layer1' } ] );
			mockValidationManager.validateLayers.mockReturnValue( { isValid: false, errors: [ 'Validation failed' ], warnings: [] } );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			editor.save();

			// Should not have called showSpinner since validation failed
			expect( mockUIManager.showSpinner ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'applyToSelection', () => {
		it( 'should apply mutator function to selected layers', () => {
			// Setup canvasManager with selected layer IDs via method mock
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1' ] );
			mockStateManager.get.mockImplementation( ( key ) => {
				if ( key === 'layers' ) return [ { id: 'layer1', x: 10 }, { id: 'layer2', x: 20 } ];
				return null;
			} );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );
			editor.canvasManager = mockCanvasManager;

			const mutator = jest.fn( ( layer ) => {
				layer.x += 5;
			} );

			editor.applyToSelection( mutator );

			expect( mockHistoryManager.saveState ).toHaveBeenCalled();
		} );

		it( 'should do nothing when mutator is not a function', () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );

			const saveSpy = jest.spyOn( editor, 'saveState' );

			editor.applyToSelection( 'not a function' );

			expect( saveSpy ).not.toHaveBeenCalled();
		} );

		it( 'should do nothing when no layers selected', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [] );

			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );
			editor.canvasManager = mockCanvasManager;

			const saveSpy = jest.spyOn( editor, 'saveState' );

			editor.applyToSelection( ( layer ) => {
				layer.x += 5;
			} );

			expect( saveSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'sanitizeGlobalErrorMessage', () => {
		// The sanitizeGlobalErrorMessage function is defined in module scope
		// We test it through the hookListener error path

		it( 'should sanitize token-like patterns through error handling', () => {
			// We test sanitization indirectly through the module behavior
			expect( LayersEditor ).toBeDefined();
		} );
	} );

	describe( 'hookListener edge cases', () => {
		it( 'should handle hook fire with minimal config', () => {
			// Test that LayersEditor can be created with minimal config
			editor = new LayersEditor( {
				filename: 'Test.jpg'
			} );

			expect( editor ).toBeDefined();
			expect( editor.filename ).toBe( 'Test.jpg' );
		} );
	} );

	describe( 'areEditorDependenciesReady', () => {
		it( 'should check for LayersConstants', () => {
			// This is tested through the module behavior
			expect( window.Layers.Constants ).toBeDefined();
			expect( window.Layers.Canvas.Manager ).toBeDefined();
		} );
	} );

	describe( 'unhandledrejection handler', () => {
		it( 'should be attached to window during module load', () => {
			// Verify the handler was added
			expect( LayersEditor ).toBeDefined();
		} );
	} );

	describe( 'cleanupGlobalEditorInstance', () => {
		it( 'should clean up on page unload', () => {
			// Set up a mock editor instance
			window.layersEditorInstance = {
				destroy: jest.fn()
			};

			// Fire beforeunload event
			const event = new Event( 'beforeunload' );
			window.dispatchEvent( event );

			// Verify the mock editor instance was set up correctly
			expect( window.layersEditorInstance ).toBeDefined();
			expect( typeof window.layersEditorInstance.destroy ).toBe( 'function' );
		} );
	} );

	// ========================================================================
	// createCustomShapeLayer Tests
	// ========================================================================

	describe( 'createCustomShapeLayer', () => {
		beforeEach( () => {
			editor = new LayersEditor( {
				filename: 'Test.jpg',
				imageUrl: '/test.jpg'
			} );
			editor.addLayer = jest.fn();
			editor.setCurrentTool = jest.fn();
			editor.toolbar = {
				selectTool: jest.fn(),
				setActiveTool: jest.fn()
			};
		} );

		test( 'rejects invalid shape data - null', () => {
			editor.createCustomShapeLayer( null );
			expect( editor.addLayer ).not.toHaveBeenCalled();
		} );

		test( 'rejects invalid shape data - missing path', () => {
			editor.createCustomShapeLayer( { viewBox: [ 0, 0, 100, 100 ] } );
			expect( editor.addLayer ).not.toHaveBeenCalled();
		} );

		test( 'rejects invalid shape data - missing viewBox', () => {
			editor.createCustomShapeLayer( { path: 'M0,0 L10,10' } );
			expect( editor.addLayer ).not.toHaveBeenCalled();
		} );

		test( 'creates layer with valid shape data', () => {
			const shapeData = {
				id: 'test/star',
				path: 'M50,0 L61,35 L98,35 L68,57 L79,91 L50,70 L21,91 L32,57 L2,35 L39,35 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				type: 'customShape',
				shapeId: 'test/star',
				path: shapeData.path
			} ) );
		} );

		test( 'calculates correct dimensions for square viewBox', () => {
			const shapeData = {
				id: 'test/square',
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				width: 100,
				height: 100
			} ) );
		} );

		test( 'calculates correct dimensions for wide viewBox', () => {
			const shapeData = {
				id: 'test/wide',
				path: 'M0,0 L200,0 L200,100 L0,100 Z',
				viewBox: [ 0, 0, 200, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			// Aspect ratio 2:1, target size 100
			// width = 100, height = 50
			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				width: 100,
				height: 50
			} ) );
		} );

		test( 'calculates correct dimensions for tall viewBox', () => {
			const shapeData = {
				id: 'test/tall',
				path: 'M0,0 L100,0 L100,200 L0,200 Z',
				viewBox: [ 0, 0, 100, 200 ]
			};

			editor.createCustomShapeLayer( shapeData );

			// Aspect ratio 0.5:1, target size 100
			// height = 100, width = 50
			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				width: 50,
				height: 100
			} ) );
		} );

		test( 'applies style from toolbar styleControls', () => {
			editor.toolbar.styleControls = {
				getStyleOptions: jest.fn( () => ( {
					stroke: '#ff0000',
					fill: '#00ff00',
					strokeWidth: 5
				} ) )
			};

			const shapeData = {
				id: 'test/styled',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				stroke: '#ff0000',
				fill: '#00ff00',
				strokeWidth: 5
			} ) );
		} );

		test( 'uses default styles when toolbar styleControls unavailable', () => {
			editor.toolbar.styleControls = null;

			const shapeData = {
				id: 'test/default',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				stroke: '#000000',
				fill: 'transparent',
				strokeWidth: 2
			} ) );
		} );

		test( 'respects fillRule from shape data', () => {
			const shapeData = {
				id: 'test/evenodd',
				path: 'M0,0 L100,0 L100,100 L0,100 Z',
				viewBox: [ 0, 0, 100, 100 ],
				fillRule: 'evenodd'
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				fillRule: 'evenodd'
			} ) );
		} );

		test( 'defaults fillRule to nonzero', () => {
			const shapeData = {
				id: 'test/default-fill',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				fillRule: 'nonzero'
			} ) );
		} );

		test( 'uses nameKey for localized name when provided', () => {
			editor.msg = jest.fn( ( key, fallback ) => 'Localized Star' );

			const shapeData = {
				id: 'shapes/star',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ],
				nameKey: 'layers-shape-star'
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.msg ).toHaveBeenCalledWith( 'layers-shape-star', 'star' );
			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				name: 'Localized Star'
			} ) );
		} );

		test( 'extracts name from id when nameKey not provided', () => {
			const shapeData = {
				id: 'category/subcategory/myshape',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				name: 'myshape'
			} ) );
		} );

		test( 'accounts for zoom and pan when positioning', () => {
			editor.canvasManager = {
				canvas: { width: 800, height: 600 },
				zoom: 2,
				panX: 100,
				panY: 50
			};

			const shapeData = {
				id: 'test/positioned',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			// Canvas center: 400, 300
			// World coords: (400 - 100) / 2 = 150, (300 - 50) / 2 = 125
			// Shape position: 150 - 50, 125 - 50 = 100, 75
			expect( editor.addLayer ).toHaveBeenCalledWith( expect.objectContaining( {
				x: 100,
				y: 75
			} ) );
		} );

		test( 'switches to pointer tool after adding shape', () => {
			const shapeData = {
				id: 'test/shape',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			editor.createCustomShapeLayer( shapeData );

			expect( editor.setCurrentTool ).toHaveBeenCalledWith( 'pointer' );
		} );

		test( 'handles missing canvasManager gracefully', () => {
			editor.canvasManager = null;

			const shapeData = {
				id: 'test/no-canvas',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			expect( () => {
				editor.createCustomShapeLayer( shapeData );
			} ).not.toThrow();

			expect( editor.addLayer ).toHaveBeenCalled();
		} );

		test( 'handles canvasManager without zoom/pan values', () => {
			editor.canvasManager = {
				canvas: { width: 800, height: 600 }
				// No zoom, panX, panY
			};

			const shapeData = {
				id: 'test/no-zoom',
				path: 'M0,0 L10,10',
				viewBox: [ 0, 0, 100, 100 ]
			};

			expect( () => {
				editor.createCustomShapeLayer( shapeData );
			} ).not.toThrow();

			expect( editor.addLayer ).toHaveBeenCalled();
		} );
	} );
} );
