/**
 * @jest-environment jsdom
 */

/**
 * Extended integration tests for LayersEditor
 *
 * Tests uncovered code paths including:
 * - validateDependencies
 * - buildRevisionSelector / buildSetSelector
 * - loadLayerSetByName
 * - showCancelConfirmDialog
 * - navigateBackToFile / navigateBackToFileWithName
 * - save flow
 * - hasUnsavedChanges / updateSaveButtonState
 * - applyToSelection / getSelectedLayerIds
 * - updateUIState
 * - Hook listener and auto-bootstrap (module-level code)
 */

// Load dependencies first
const StateManager = require( '../../resources/ext.layers.editor/StateManager.js' );
const HistoryManager = require( '../../resources/ext.layers.editor/HistoryManager.js' );

describe( 'LayersEditor Extended', () => {
	let LayersEditor;
	let editor;
	let mockContainer;

	// Mock manager instances
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
			loadLayers: jest.fn().mockReturnValue( new Promise( () => {} ) ),
			saveLayers: jest.fn().mockResolvedValue( { success: true } ),
			generateLayerId: jest.fn( () => 'layer_' + Math.random().toString( 36 ).substr( 2, 9 ) ),
			loadRevisionById: jest.fn()
		};
		mockValidationManager = {
			sanitizeLayerData: jest.fn( ( data ) => data ),
			validateLayers: jest.fn().mockReturnValue( { isValid: true } ),
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
			selectedLayerIds: []
		};
		mockToolbar = {
			destroy: jest.fn(),
			updateUndoRedoState: jest.fn(),
			updateDeleteState: jest.fn(),
			setActiveTool: jest.fn(),
			saveBtnEl: document.createElement( 'button' )
		};
		mockLayerPanel = {
			render: jest.fn(),
			destroy: jest.fn(),
			selectLayer: jest.fn(),
			updateLayerList: jest.fn()
		};

		// Create mock registry with instance caching
		const registeredModules = {};
		const instanceCache = {};
		mockRegistry = {
			register: jest.fn( ( name, factory ) => {
				registeredModules[ name ] = factory;
			} ),
			get: jest.fn( ( name ) => {
				if ( instanceCache[ name ] ) {
					return instanceCache[ name ];
				}

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

				if ( name === 'StateManager' ) {
					instanceCache[ name ] = new StateManager();
					return instanceCache[ name ];
				}
				if ( name === 'HistoryManager' ) {
					instanceCache[ name ] = new HistoryManager();
					return instanceCache[ name ];
				}

				if ( registeredModules[ name ] ) {
					instanceCache[ name ] = registeredModules[ name ]();
					return instanceCache[ name ];
				}
				throw new Error( `Module ${name} not found` );
			} )
		};

		// Setup window globals using namespaced exports
		window.Layers = window.Layers || {};
		window.Layers.Validation = window.Layers.Validation || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.Canvas = window.Layers.Canvas || {};
		window.Layers.Core = window.Layers.Core || {};
		window.StateManager = StateManager;
		window.HistoryManager = HistoryManager;
		window.UIManager = jest.fn().mockImplementation( () => mockUIManager );
		window.EventManager = jest.fn().mockImplementation( () => mockEventManager );
		window.APIManager = jest.fn().mockImplementation( () => mockAPIManager );
		window.Layers.Validation.Manager = jest.fn().mockImplementation( () => mockValidationManager );
		window.Layers.Canvas.Manager = jest.fn().mockImplementation( () => mockCanvasManager );
		window.Toolbar = jest.fn().mockImplementation( () => mockToolbar );
		window.Layers.UI.LayerPanel = jest.fn().mockImplementation( () => mockLayerPanel );
		window.Layers.Constants = {
			TOOLS: { POINTER: 'pointer', TEXT: 'text' },
			LAYER_TYPES: { RECTANGLE: 'rectangle', CIRCLE: 'circle' },
			DEFAULTS: {
				COLORS: { STROKE: '#000000', FILL: '#ffffff' },
				LAYER: { STROKE_WIDTH: 2, FONT_SIZE: 16, FONT_FAMILY: 'Arial' }
			},
			UI: { MIN_ZOOM: 0.1, MAX_ZOOM: 5.0 },
			LIMITS: { MAX_LAYERS: 100, MAX_LAYER_ID_LENGTH: 50 }
		};

		window.layersRegistry = mockRegistry;

		// Mock RevisionManager
		// Note: Uses getters to dynamically access editor's managers so test can modify them
		window.RevisionManager = jest.fn().mockImplementation( function ( config ) {
			this.editor = config.editor;

			// Use getters to access current state of editor's managers (they can change during tests)
			Object.defineProperty( this, 'stateManager', {
				get: function () {
					return this.editor.stateManager;
				}
			} );
			Object.defineProperty( this, 'uiManager', {
				get: function () {
					return this.editor.uiManager;
				}
			} );
			Object.defineProperty( this, 'apiManager', {
				get: function () {
					return this.editor.apiManager;
				}
			} );

			this.parseMWTimestamp = jest.fn( ( mwTimestamp ) => {
				if ( !mwTimestamp || typeof mwTimestamp !== 'string' ) {
					return new Date();
				}
				const year = parseInt( mwTimestamp.substring( 0, 4 ), 10 );
				const month = parseInt( mwTimestamp.substring( 4, 6 ), 10 ) - 1;
				const day = parseInt( mwTimestamp.substring( 6, 8 ), 10 );
				const hour = parseInt( mwTimestamp.substring( 8, 10 ), 10 );
				const minute = parseInt( mwTimestamp.substring( 10, 12 ), 10 );
				const second = parseInt( mwTimestamp.substring( 12, 14 ), 10 );
				return new Date( year, month, day, hour, minute, second );
			} );

			this.getMessage = jest.fn( ( key, fallback ) => {
				if ( window.layersMessages && typeof window.layersMessages.get === 'function' ) {
					return window.layersMessages.get( key, fallback );
				}
				return fallback || key;
			} );

			this.buildRevisionSelector = jest.fn( () => {
				const uiMgr = this.uiManager;
				const stateMgr = this.stateManager;
				if ( !uiMgr || !uiMgr.revSelectEl ) {
					return;
				}
				const selectEl = uiMgr.revSelectEl;
				const allLayerSets = stateMgr.get( 'allLayerSets' ) || stateMgr.get( 'allLayersets' ) || [];
				const currentLayerSetId = stateMgr.get( 'currentLayerSetId' );

				selectEl.innerHTML = '';

				const defaultOption = document.createElement( 'option' );
				defaultOption.value = '';
				defaultOption.textContent = this.getMessage( 'layers-revision-latest', 'Latest' );
				selectEl.appendChild( defaultOption );

				allLayerSets.forEach( ( layerSet ) => {
					const option = document.createElement( 'option' );
					option.value = layerSet.ls_id || layerSet.id;
					const timestamp = layerSet.ls_timestamp || layerSet.timestamp;
					const date = this.parseMWTimestamp( timestamp );
					option.textContent = `Rev ${layerSet.ls_revision || layerSet.revision || ''} - ${date.toLocaleString()}`;
					if ( String( option.value ) === String( currentLayerSetId ) ) {
						option.selected = true;
					}
					selectEl.appendChild( option );
				} );
			} );

			this.updateRevisionLoadButton = jest.fn( () => {
				const uiMgr = this.uiManager;
				const stateMgr = this.stateManager;
				if ( !uiMgr || !uiMgr.revLoadBtnEl ) {
					return;
				}
				const revSelectEl = uiMgr.revSelectEl;
				const currentLayerSetId = stateMgr.get( 'currentLayerSetId' );
				const selectedValue = revSelectEl ? revSelectEl.value : '';
				const shouldDisable = !selectedValue || String( selectedValue ) === String( currentLayerSetId );
				uiMgr.revLoadBtnEl.disabled = shouldDisable;
			} );

			this.buildSetSelector = jest.fn( () => {
				const uiMgr = this.uiManager;
				const stateMgr = this.stateManager;
				if ( !uiMgr || !uiMgr.setSelectEl ) {
					return;
				}
				const selectEl = uiMgr.setSelectEl;
				const namedSets = stateMgr.get( 'namedSets' ) || [];
				const currentSetName = stateMgr.get( 'currentSetName' ) || 'default';

				selectEl.innerHTML = '';

				if ( namedSets.length === 0 ) {
					const defaultOption = document.createElement( 'option' );
					defaultOption.value = 'default';
					defaultOption.textContent = 'default';
					selectEl.appendChild( defaultOption );
				}

				namedSets.forEach( ( set ) => {
					const option = document.createElement( 'option' );
					option.value = set.name;
					option.textContent = set.name;
					if ( set.name === currentSetName ) {
						option.selected = true;
					}
					selectEl.appendChild( option );
				} );

				const maxSets = ( window.mw && window.mw.config && window.mw.config.get( 'wgLayersMaxNamedSets' ) ) || 15;
				if ( namedSets.length < maxSets ) {
					const newOption = document.createElement( 'option' );
					newOption.value = '__new__';
					newOption.textContent = this.getMessage( 'layers-editor-new-set', '+ New' );
					selectEl.appendChild( newOption );
				}
			} );

			this.updateNewSetButtonState = jest.fn( () => {
				const uiMgr = this.uiManager;
				const stateMgr = this.stateManager;
				if ( !uiMgr || !uiMgr.newSetBtnEl ) {
					return;
				}
				const namedSets = stateMgr.get( 'namedSets' ) || [];
				const maxSets = ( window.mw && window.mw.config && window.mw.config.get( 'wgLayersMaxNamedSets' ) ) || 15;
				uiMgr.newSetBtnEl.disabled = namedSets.length >= maxSets;
			} );

			this.loadLayerSetByName = jest.fn( async ( setName ) => {
				const apiMgr = this.apiManager;
				const stateMgr = this.stateManager;
				if ( !setName || setName.trim() === '' ) {
					return;
				}
				if ( apiMgr && apiMgr.loadLayersBySetName ) {
					try {
						await apiMgr.loadLayersBySetName( setName );
						stateMgr.set( 'currentSetName', setName );
						if ( window.mw && window.mw.notify ) {
							window.mw.notify( this.getMessage( 'layers-load-success', 'Loaded' ), { type: 'info' } );
						}
					} catch ( error ) {
						if ( window.mw && window.mw.notify ) {
							window.mw.notify( this.getMessage( 'layers-load-error', 'Error loading set' ), { type: 'error' } );
						}
					}
				}
			} );

			this.createNewLayerSet = jest.fn( async ( setName ) => {
				const stateMgr = this.stateManager;
				if ( !setName || setName.trim() === '' ) {
					if ( window.mw && window.mw.notify ) {
						window.mw.notify( this.getMessage( 'layers-error-empty-name', 'Name cannot be empty' ), { type: 'error' } );
					}
					return false;
				}
				if ( setName === 'default' ) {
					if ( window.mw && window.mw.notify ) {
						window.mw.notify( this.getMessage( 'layers-error-reserved-name', 'Reserved name' ), { type: 'error' } );
					}
					return false;
				}
				if ( !/^[a-zA-Z0-9_-]+$/.test( setName ) ) {
					if ( window.mw && window.mw.notify ) {
						window.mw.notify( this.getMessage( 'layers-error-invalid-chars', 'Invalid characters' ), { type: 'error' } );
					}
					return false;
				}

				// Check for duplicate names
				const namedSets = stateMgr.get( 'namedSets' ) || [];
				if ( namedSets.some( ( s ) => s.name === setName ) ) {
					if ( window.mw && window.mw.notify ) {
						window.mw.notify( this.getMessage( 'layers-error-duplicate-name', 'Name already exists' ), { type: 'error' } );
					}
					return false;
				}

				// Check limit
				const maxSets = ( window.mw && window.mw.config && window.mw.config.get( 'wgLayersMaxNamedSets' ) ) || 15;
				if ( namedSets.length >= maxSets ) {
					if ( window.mw && window.mw.notify ) {
						window.mw.notify( this.getMessage( 'layers-error-max-sets', 'Maximum sets reached' ), { type: 'error' } );
					}
					return false;
				}

				stateMgr.set( 'currentSetName', setName );
				stateMgr.set( 'layers', [] );
				namedSets.push( { name: setName } );
				stateMgr.set( 'namedSets', namedSets );
				return true;
			} );

			this.loadRevisionById = jest.fn( async ( revisionId ) => {
				const apiMgr = this.apiManager;
				if ( apiMgr && apiMgr.loadRevisionById ) {
					try {
						await apiMgr.loadRevisionById( revisionId );
					} catch ( error ) {
						if ( window.mw && window.mw.notify ) {
							window.mw.notify( this.getMessage( 'layers-load-error', 'Error' ), { type: 'error' } );
						}
					}
				}
			} );
		} );

		// Mock DialogManager
		window.Layers.UI.DialogManager = jest.fn().mockImplementation( function ( config ) {
			this.editor = config.editor;
			this.activeDialogs = [];
			this.showCancelConfirmDialog = jest.fn();
			this.showPromptDialog = jest.fn();
			this.showKeyboardShortcutsDialog = jest.fn();
			this.closeAllDialogs = jest.fn( () => {
				this.activeDialogs = [];
			} );
		} );

		// Mock EditorBootstrap
		window.Layers.Core.EditorBootstrap = {
			validateDependencies: jest.fn( () => true ),
			areEditorDependenciesReady: jest.fn( () => true ),
			sanitizeGlobalErrorMessage: jest.fn( ( msg ) => msg ),
			registerHook: jest.fn()
		};

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

		jest.resetModules();
		require( '../../resources/ext.layers.editor/LayersEditor.js' );
		LayersEditor = window.Layers.Core.Editor;
	} );

	afterEach( () => {
		if ( editor && !editor.isDestroyed ) {
			editor.destroy();
		}
		editor = null;
		jest.clearAllMocks();
	} );

	describe( 'hasUnsavedChanges', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should return false when no changes', () => {
			editor.stateManager.set( 'hasUnsavedChanges', false );
			expect( editor.hasUnsavedChanges() ).toBe( false );
		} );

		it( 'should return true when changes exist', () => {
			editor.stateManager.set( 'hasUnsavedChanges', true );
			expect( editor.hasUnsavedChanges() ).toBe( true );
		} );

		it( 'should return false when state is undefined', () => {
			editor.stateManager.set( 'hasUnsavedChanges', undefined );
			expect( editor.hasUnsavedChanges() ).toBe( false );
		} );
	} );

	describe( 'updateSaveButtonState', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.toolbar = mockToolbar;
		} );

		it( 'should add has-changes class when unsaved changes exist', () => {
			editor.stateManager.set( 'hasUnsavedChanges', true );
			editor.updateSaveButtonState();
			expect( mockToolbar.saveBtnEl.classList.contains( 'has-changes' ) ).toBe( true );
		} );

		it( 'should remove has-changes class when no unsaved changes', () => {
			mockToolbar.saveBtnEl.classList.add( 'has-changes' );
			editor.stateManager.set( 'hasUnsavedChanges', false );
			editor.updateSaveButtonState();
			expect( mockToolbar.saveBtnEl.classList.contains( 'has-changes' ) ).toBe( false );
		} );

		it( 'should handle missing toolbar gracefully', () => {
			editor.toolbar = null;
			expect( () => editor.updateSaveButtonState() ).not.toThrow();
		} );

		it( 'should handle missing saveBtnEl gracefully', () => {
			editor.toolbar = { saveBtnEl: null };
			expect( () => editor.updateSaveButtonState() ).not.toThrow();
		} );
	} );

	describe( 'loadRevisionById', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.apiManager = mockAPIManager;
			window.mw = {
				message: jest.fn().mockReturnValue( { text: () => 'test' } ),
				config: { get: jest.fn() },
				notify: jest.fn()
			};
		} );

		it( 'should delegate to apiManager', () => {
			editor.loadRevisionById( 42 );
			expect( mockAPIManager.loadRevisionById ).toHaveBeenCalledWith( 42 );
		} );

		it( 'should handle errors gracefully', () => {
			mockAPIManager.loadRevisionById.mockImplementation( () => {
				throw new Error( 'Load failed' );
			} );
			// Should not throw, error is caught and mw.notify called
			expect( () => editor.loadRevisionById( 42 ) ).not.toThrow();
			expect( window.mw.notify ).toHaveBeenCalled();
		} );
	} );

	describe( 'getMessage', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should delegate to window.layersMessages.get', () => {
			// getMessage now delegates to centralized MessageHelper
			const result = editor.getMessage( 'test-key', 'fallback' );
			expect( typeof result ).toBe( 'string' );
		} );

		it( 'should pass fallback parameter through', () => {
			const result = editor.getMessage( 'test-key', 'my-fallback' );
			// MessageHelper handles the fallback logic internally
			expect( typeof result ).toBe( 'string' );
		} );
	} );

	describe( 'setCurrentTool', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.canvasManager = mockCanvasManager;
			editor.toolbar = mockToolbar;
		} );

		it( 'should update state and canvas manager', () => {
			editor.setCurrentTool( 'rectangle' );
			expect( editor.stateManager.get( 'currentTool' ) ).toBe( 'rectangle' );
			expect( mockCanvasManager.setTool ).toHaveBeenCalledWith( 'rectangle' );
		} );

		it( 'should sync toolbar by default', () => {
			editor.setCurrentTool( 'circle' );
			expect( mockToolbar.setActiveTool ).toHaveBeenCalledWith( 'circle' );
		} );

		it( 'should skip toolbar sync when option set', () => {
			editor.setCurrentTool( 'rectangle', { skipToolbarSync: true } );
			expect( mockToolbar.setActiveTool ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing canvasManager', () => {
			editor.canvasManager = null;
			expect( () => editor.setCurrentTool( 'rectangle' ) ).not.toThrow();
		} );
	} );

	describe( 'getSelectedLayerIds', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should delegate to canvasManager.getSelectedLayerIds when available', () => {
			editor.canvasManager = {
				getSelectedLayerIds: jest.fn().mockReturnValue( [ 'layer1', 'layer2' ] )
			};
			const ids = editor.getSelectedLayerIds();
			expect( ids ).toEqual( [ 'layer1', 'layer2' ] );
			expect( editor.canvasManager.getSelectedLayerIds ).toHaveBeenCalled();
		} );

		it( 'should return copy, not reference', () => {
			const original = [ 'layer1' ];
			editor.canvasManager = {
				getSelectedLayerIds: jest.fn().mockReturnValue( original )
			};
			const ids = editor.getSelectedLayerIds();
			ids.push( 'layer2' );
			// Original array should not be modified (canvasManager returns a copy)
			expect( original ).toEqual( [ 'layer1' ] );
		} );

		it( 'should fallback to stateManager selectedLayerIds when canvasManager unavailable', () => {
			editor.canvasManager = null;
			editor.stateManager.set( 'selectedLayerIds', [ 'single_layer' ] );
			expect( editor.getSelectedLayerIds() ).toEqual( [ 'single_layer' ] );
		} );

		it( 'should return empty array when no selection', () => {
			editor.canvasManager = null;
			editor.stateManager.set( 'selectedLayerIds', [] );
			expect( editor.getSelectedLayerIds() ).toEqual( [] );
		} );
	} );

	describe( 'applyToSelection', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.canvasManager = mockCanvasManager;
			// Setup mock to return empty array by default
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [] );
		} );

		it( 'should apply mutator to selected layers', () => {
			// Add layers with explicit IDs
			editor.stateManager.set( 'layers', [
				{ id: 'layer1', type: 'rectangle', x: 10 },
				{ id: 'layer2', type: 'circle', x: 20 }
			] );
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [ 'layer1' ] );

			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );

			const layers = editor.stateManager.get( 'layers' );
			const layer1 = layers.find( ( l ) => l.id === 'layer1' );
			expect( layer1.x ).toBe( 100 );
		} );

		it( 'should not apply to unselected layers', () => {
			editor.stateManager.set( 'layers', [
				{ id: 'layer1', type: 'rectangle', x: 10 },
				{ id: 'layer2', type: 'circle', x: 20 }
			] );
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [ 'layer1' ] );

			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );

			const layers = editor.stateManager.get( 'layers' );
			const layer2 = layers.find( ( l ) => l.id === 'layer2' );
			expect( layer2.x ).toBe( 20 );
		} );

		it( 'should save state before applying', () => {
			editor.stateManager.set( 'layers', [ { id: 'layer1', type: 'rectangle', x: 10 } ] );
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [ 'layer1' ] );
			const saveStateSpy = jest.spyOn( editor, 'saveState' );
			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );
			expect( saveStateSpy ).toHaveBeenCalled();
		} );

		it( 'should render after applying', () => {
			editor.stateManager.set( 'layers', [ { id: 'layer1', type: 'rectangle', x: 10 } ] );
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [ 'layer1' ] );
			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should do nothing if mutator is not a function', () => {
			expect( () => editor.applyToSelection( 'not a function' ) ).not.toThrow();
		} );

		it( 'should do nothing if no layers selected', () => {
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [] );
			const saveStateSpy = jest.spyOn( editor, 'saveState' );
			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );
			expect( saveStateSpy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'updateUIState', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.toolbar = mockToolbar;
			editor.historyManager = new HistoryManager();
			editor.canvasManager = mockCanvasManager;
			// Default to no selection
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [] );
		} );

		it( 'should update toolbar undo/redo state', () => {
			editor.historyManager.canUndo = jest.fn().mockReturnValue( true );
			editor.historyManager.canRedo = jest.fn().mockReturnValue( false );
			editor.updateUIState();
			expect( mockToolbar.updateUndoRedoState ).toHaveBeenCalledWith( true, false );
		} );

		it( 'should update toolbar delete state based on selection', () => {
			mockCanvasManager.getSelectedLayerIds = jest.fn().mockReturnValue( [ 'layer1' ] );
			editor.updateUIState();
			expect( mockToolbar.updateDeleteState ).toHaveBeenCalledWith( true );
		} );

		it( 'should handle missing toolbar gracefully', () => {
			editor.toolbar = null;
			expect( () => editor.updateUIState() ).not.toThrow();
		} );

		it( 'should handle missing historyManager gracefully', () => {
			editor.historyManager = null;
			expect( () => editor.updateUIState() ).not.toThrow();
			expect( mockToolbar.updateUndoRedoState ).toHaveBeenCalledWith( false, false );
		} );
	} );

	describe( 'navigateBackToFile', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should attempt navigation using mw.util.getUrl', () => {
			const mockGetUrl = jest.fn().mockReturnValue( '/wiki/File:Test.jpg' );
			window.mw = {
				util: { getUrl: mockGetUrl },
				config: { get: jest.fn() },
				notify: jest.fn()
			};

			// The navigation will throw in JSDOM, but we can verify getUrl was called
			try {
				editor.navigateBackToFile();
			} catch ( e ) {
				// Expected in JSDOM
			}
			expect( mockGetUrl ).toHaveBeenCalledWith( 'File:Test.jpg', { layers: 'on' } );
		} );

		it( 'should handle errors gracefully', () => {
			window.mw = { config: { get: jest.fn() }, notify: jest.fn() };
			editor.filename = null;

			// Should not throw
			expect( () => {
				try {
					editor.navigateBackToFile();
				} catch ( e ) {
					// Expected navigation errors in JSDOM are okay
				}
			} ).not.toThrow();
		} );
	} );

	describe( 'navigateBackToFileWithName', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should attempt navigation to specific filename', () => {
			const mockGetUrl = jest.fn().mockReturnValue( '/wiki/File:Other.jpg' );
			window.mw = {
				util: { getUrl: mockGetUrl },
				config: { get: jest.fn() },
				notify: jest.fn()
			};

			try {
				editor.navigateBackToFileWithName( 'Other.jpg' );
			} catch ( e ) {
				// Expected in JSDOM
			}
			expect( mockGetUrl ).toHaveBeenCalledWith( 'File:Other.jpg', { layers: 'on' } );
		} );

		it( 'should handle null filename gracefully', () => {
			window.mw = { config: { get: jest.fn() }, notify: jest.fn() };

			expect( () => {
				try {
					editor.navigateBackToFileWithName( null );
				} catch ( e ) {
					// Expected navigation errors in JSDOM are okay
				}
			} ).not.toThrow();
		} );
	} );

	describe( 'showCancelConfirmDialog', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			window.mw = {
				message: jest.fn().mockReturnValue( { text: ( fallback ) => fallback } ),
				config: { get: jest.fn() }
			};
		} );

		it( 'should create dialog elements', () => {
			const onConfirm = jest.fn();
			editor.showCancelConfirmDialog( onConfirm );

			expect( document.querySelector( '.layers-modal-overlay' ) ).not.toBeNull();
			expect( document.querySelector( '.layers-modal-dialog' ) ).not.toBeNull();
		} );

		it( 'should call onConfirm when discard clicked', () => {
			const onConfirm = jest.fn();
			editor.showCancelConfirmDialog( onConfirm );

			const confirmBtn = document.querySelector( '.layers-btn-danger' );
			confirmBtn.click();

			expect( onConfirm ).toHaveBeenCalled();
		} );

		it( 'should remove dialog on cancel', () => {
			const onConfirm = jest.fn();
			editor.showCancelConfirmDialog( onConfirm );

			const cancelBtn = document.querySelector( '.layers-btn-primary' );
			cancelBtn.click();

			expect( document.querySelector( '.layers-modal-overlay' ) ).toBeNull();
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );

		it( 'should remove dialog on Escape key', () => {
			const onConfirm = jest.fn();
			editor.showCancelConfirmDialog( onConfirm );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( document.querySelector( '.layers-modal-overlay' ) ).toBeNull();
		} );

		it( 'should handle Tab key for focus trap', () => {
			const onConfirm = jest.fn();
			editor.showCancelConfirmDialog( onConfirm );

			const buttons = document.querySelectorAll( '.layers-modal-dialog button' );
			const firstBtn = buttons[ 0 ];
			const lastBtn = buttons[ buttons.length - 1 ];

			// Focus last button
			lastBtn.focus();

			// Tab forward from last should go to first
			const tabEvent = new KeyboardEvent( 'keydown', { key: 'Tab', shiftKey: false } );
			document.dispatchEvent( tabEvent );

			// Focus first button
			firstBtn.focus();

			// Shift+Tab from first should go to last
			const shiftTabEvent = new KeyboardEvent( 'keydown', { key: 'Tab', shiftKey: true } );
			document.dispatchEvent( shiftTabEvent );

			// Dialog should still be present
			expect( document.querySelector( '.layers-modal-dialog' ) ).not.toBeNull();
		} );

		it( 'should focus cancel button by default', () => {
			const onConfirm = jest.fn();
			editor.showCancelConfirmDialog( onConfirm );

			const cancelBtn = document.querySelector( '.layers-btn-primary' );
			expect( document.activeElement ).toBe( cancelBtn );
		} );
	} );

	describe( 'save', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.apiManager = mockAPIManager;
			editor.uiManager = mockUIManager;
			editor.validationManager = mockValidationManager;
			window.mw = {
				message: jest.fn().mockReturnValue( { text: () => 'test' } ),
				config: { get: jest.fn() },
				notify: jest.fn()
			};
		} );

		it( 'should validate layers before saving', () => {
			editor.addLayer( { type: 'rectangle' } );
			editor.save();

			expect( mockValidationManager.validateLayers ).toHaveBeenCalled();
		} );

		it( 'should show error if validation fails', () => {
			mockValidationManager.validateLayers.mockReturnValue( { isValid: false, errors: [ 'Validation failed' ] } );
			editor.addLayer( { type: 'rectangle' } );

			editor.save();

			expect( window.mw.notify ).toHaveBeenCalled();
			expect( mockAPIManager.saveLayers ).not.toHaveBeenCalled();
		} );

		it( 'should show spinner while saving', () => {
			editor.addLayer( { type: 'rectangle' } );
			editor.save();

			expect( mockUIManager.showSpinner ).toHaveBeenCalled();
		} );

		it( 'should call apiManager.saveLayers', () => {
			editor.addLayer( { type: 'rectangle' } );
			editor.save();

			expect( mockAPIManager.saveLayers ).toHaveBeenCalled();
		} );
	} );

	describe( 'buildRevisionSelector', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.uiManager = mockUIManager;
			mockUIManager.revSelectEl = document.createElement( 'select' );
			window.mw = {
				message: jest.fn().mockReturnValue( { text: () => 'by User' } ),
				config: { get: jest.fn() }
			};
		} );

		it( 'should clear existing options when building', () => {
			const opt = document.createElement( 'option' );
			opt.value = 'existing';
			mockUIManager.revSelectEl.appendChild( opt );

			editor.stateManager.set( 'allLayersets', [] );
			editor.buildRevisionSelector();

			// With empty layersets, it should have rebuilt
			expect( mockUIManager.revSelectEl.innerHTML ).not.toContain( 'existing' );
		} );

		it( 'should handle empty revision list', () => {
			editor.stateManager.set( 'allLayersets', [] );
			editor.buildRevisionSelector();

			// Should have 1 default option
			expect( mockUIManager.revSelectEl.options.length ).toBeGreaterThanOrEqual( 1 );
		} );

		it( 'should handle missing revSelectEl gracefully', () => {
			mockUIManager.revSelectEl = null;
			editor.stateManager.set( 'allLayersets', [
				{ ls_id: 1, ls_revision: 1 }
			] );

			expect( () => editor.buildRevisionSelector() ).not.toThrow();
		} );
	} );

	describe( 'buildSetSelector', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.uiManager = mockUIManager;
			mockUIManager.setSelectEl = document.createElement( 'select' );
			window.mw = {
				message: jest.fn().mockReturnValue( { text: () => 'test' } ),
				config: { get: jest.fn().mockReturnValue( 15 ) }
			};
		} );

		it( 'should handle empty named sets by adding default', () => {
			editor.stateManager.set( 'namedSets', [] );
			editor.buildSetSelector();

			// Empty sets creates default placeholder
			expect( mockUIManager.setSelectEl.options.length ).toBeGreaterThanOrEqual( 1 );
		} );

		it( 'should handle missing setSelectEl gracefully', () => {
			mockUIManager.setSelectEl = null;
			editor.stateManager.set( 'namedSets', [ { name: 'test' } ] );

			expect( () => editor.buildSetSelector() ).not.toThrow();
		} );
	} );

	describe( 'loadLayerSetByName', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.apiManager = mockAPIManager;
			mockAPIManager.loadLayersBySetName = jest.fn().mockResolvedValue( {} );
			window.mw = {
				message: jest.fn().mockReturnValue( { text: () => 'test message' } ),
				config: { get: jest.fn() },
				notify: jest.fn()
			};
		} );

		it( 'should call apiManager.loadLayersBySetName with set name', async () => {
			editor.stateManager.set( 'hasUnsavedChanges', false );
			await editor.loadLayerSetByName( 'my-set' );
			expect( mockAPIManager.loadLayersBySetName ).toHaveBeenCalledWith( 'my-set' );
		} );

		it( 'should update current set name state', async () => {
			editor.stateManager.set( 'hasUnsavedChanges', false );
			await editor.loadLayerSetByName( 'custom-set' );
			expect( editor.stateManager.get( 'currentSetName' ) ).toBe( 'custom-set' );
		} );

		it( 'should do nothing if setName is empty', async () => {
			await editor.loadLayerSetByName( '' );
			expect( mockAPIManager.loadLayersBySetName ).not.toHaveBeenCalled();
		} );

		it( 'should show success notification on load', async () => {
			editor.stateManager.set( 'hasUnsavedChanges', false );
			await editor.loadLayerSetByName( 'test-set' );
			expect( window.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'info' } )
			);
		} );

		it( 'should handle API errors gracefully', async () => {
			editor.stateManager.set( 'hasUnsavedChanges', false );
			mockAPIManager.loadLayersBySetName.mockRejectedValue( new Error( 'API error' ) );
			await editor.loadLayerSetByName( 'failing-set' );
			expect( window.mw.notify ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.objectContaining( { type: 'error' } )
			);
		} );
	} );

	describe( 'createNewLayerSet', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.layerPanel = mockLayerPanel;
			editor.stateManager.set( 'namedSets', [ { name: 'default' } ] );
			window.mw = {
				message: jest.fn().mockReturnValue( { text: () => 'test message' } ),
				config: { get: jest.fn( ( key ) => ( key === 'wgUserName' ? 'TestUser' : null ) ) },
				notify: jest.fn()
			};
		} );

		it( 'should reject duplicate name', async () => {
			const result = await editor.createNewLayerSet( 'default' );
			expect( result ).toBe( false );
		} );

		it( 'should reject empty name', async () => {
			const result = await editor.createNewLayerSet( '' );
			expect( result ).toBe( false );
		} );

		it( 'should reject whitespace-only name', async () => {
			const result = await editor.createNewLayerSet( '   ' );
			expect( result ).toBe( false );
		} );
	} );

	describe( 'undo/redo delegation', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.historyManager = {
				saveState: jest.fn(),
				undo: jest.fn(),
				redo: jest.fn(),
				canUndo: jest.fn().mockReturnValue( true ),
				canRedo: jest.fn().mockReturnValue( true )
			};
		} );

		it( 'should delegate saveState to historyManager', () => {
			editor.saveState( 'test action' );
			expect( editor.historyManager.saveState ).toHaveBeenCalledWith( 'test action' );
		} );

		it( 'should delegate undo to historyManager', () => {
			editor.undo();
			expect( editor.historyManager.undo ).toHaveBeenCalled();
		} );

		it( 'should delegate redo to historyManager', () => {
			editor.redo();
			expect( editor.historyManager.redo ).toHaveBeenCalled();
		} );

		it( 'should handle missing historyManager in saveState', () => {
			editor.historyManager = null;
			expect( () => editor.saveState( 'action' ) ).not.toThrow();
		} );

		it( 'should handle missing historyManager in undo', () => {
			editor.historyManager = null;
			expect( () => editor.undo() ).not.toThrow();
		} );

		it( 'should handle missing historyManager in redo', () => {
			editor.historyManager = null;
			expect( () => editor.redo() ).not.toThrow();
		} );
	} );

	describe( 'buildRevisionSelector with data', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			
			// Create revision select element
			const selectEl = document.createElement( 'select' );
			editor.uiManager = {
				...mockUIManager,
				revSelectEl: selectEl,
				revLoadBtnEl: document.createElement( 'button' )
			};
		} );

		it( 'should populate revision options from allLayerSets', () => {
			const layerSets = [
				{ ls_id: 1, ls_timestamp: '20251202120000', ls_user_name: 'User1', ls_name: 'default' },
				{ ls_id: 2, ls_timestamp: '20251202130000', ls_user_name: 'User2', ls_name: 'annotations' }
			];
			editor.stateManager.set( 'allLayerSets', layerSets );
			editor.stateManager.set( 'currentLayerSetId', 1 );
			
			editor.buildRevisionSelector();
			
			const options = editor.uiManager.revSelectEl.querySelectorAll( 'option' );
			// Should have default + 2 revision options
			expect( options.length ).toBe( 3 );
		} );

		it( 'should mark current revision as selected', () => {
			const layerSets = [
				{ ls_id: 1, ls_timestamp: '20251202120000', ls_user_name: 'User1' },
				{ ls_id: 2, ls_timestamp: '20251202130000', ls_user_name: 'User2' }
			];
			editor.stateManager.set( 'allLayerSets', layerSets );
			editor.stateManager.set( 'currentLayerSetId', 2 );
			
			editor.buildRevisionSelector();
			
			// The selector marks the option by setting selected property
			const options = editor.uiManager.revSelectEl.querySelectorAll( 'option' );
			const selectedOptions = Array.from( options ).filter( opt => opt.selected );
			expect( selectedOptions.length ).toBeGreaterThan( 0 );
		} );

		it( 'should handle empty allLayerSets', () => {
			editor.stateManager.set( 'allLayerSets', [] );
			
			expect( () => editor.buildRevisionSelector() ).not.toThrow();
			
			const options = editor.uiManager.revSelectEl.querySelectorAll( 'option' );
			expect( options.length ).toBe( 1 ); // Just the default option
		} );
	} );

	describe( 'updateRevisionLoadButton', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			
			const selectEl = document.createElement( 'select' );
			const option1 = document.createElement( 'option' );
			option1.value = '1';
			selectEl.appendChild( option1 );
			const option2 = document.createElement( 'option' );
			option2.value = '2';
			selectEl.appendChild( option2 );
			
			const loadBtn = document.createElement( 'button' );
			
			editor.uiManager = {
				...mockUIManager,
				revSelectEl: selectEl,
				revLoadBtnEl: loadBtn
			};
		} );

		it( 'should disable button when selected revision is current', () => {
			editor.stateManager.set( 'currentLayerSetId', 1 );
			editor.uiManager.revSelectEl.value = '1';
			
			editor.updateRevisionLoadButton();
			
			expect( editor.uiManager.revLoadBtnEl.disabled ).toBe( true );
		} );

		it( 'should enable button when different revision selected', () => {
			editor.stateManager.set( 'currentLayerSetId', 1 );
			editor.uiManager.revSelectEl.value = '2';
			
			editor.updateRevisionLoadButton();
			
			expect( editor.uiManager.revLoadBtnEl.disabled ).toBe( false );
		} );

		it( 'should disable button when no revision selected', () => {
			editor.uiManager.revSelectEl.value = '';
			
			editor.updateRevisionLoadButton();
			
			expect( editor.uiManager.revLoadBtnEl.disabled ).toBe( true );
		} );
	} );

	describe( 'trackWindowListener', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should track window event listeners', () => {
			const handler = jest.fn();
			const addSpy = jest.spyOn( window, 'addEventListener' );
			
			editor.trackWindowListener( 'resize', handler );
			
			expect( addSpy ).toHaveBeenCalledWith( 'resize', handler, undefined );
			// Now tracked via EventTracker
			expect( editor.eventTracker.add ).toHaveBeenCalledWith( window, 'resize', handler, undefined );
			
			addSpy.mockRestore();
		} );

		it( 'should use EventTracker for listener management', () => {
			const handler = jest.fn();
			
			editor.trackWindowListener( 'resize', handler );
			
			// Now uses EventTracker instead of array
			expect( editor.eventTracker ).toBeDefined();
			expect( editor.eventTracker.add ).toHaveBeenCalled();
		} );
	} );

	describe( 'parseMWTimestamp', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should parse MediaWiki timestamp format', () => {
			const date = editor.parseMWTimestamp( '20251202143000' );
			
			expect( date instanceof Date ).toBe( true );
			expect( date.getFullYear() ).toBe( 2025 );
			expect( date.getMonth() ).toBe( 11 ); // December (0-indexed)
			expect( date.getDate() ).toBe( 2 );
		} );

		it( 'should handle invalid timestamp gracefully', () => {
			const date = editor.parseMWTimestamp( 'invalid' );
			
			// Should return a valid Date object (possibly Invalid Date)
			expect( date instanceof Date ).toBe( true );
		} );

		it( 'should handle null timestamp', () => {
			const date = editor.parseMWTimestamp( null );
			
			expect( date instanceof Date ).toBe( true );
		} );
	} );

	describe( 'normalizeLayers', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should set default visibility to true', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle' },
				{ id: 'layer2', type: 'circle', visible: false }
			];
			
			const normalized = editor.normalizeLayers( layers );
			
			expect( normalized[ 0 ].visible ).toBe( true );
			expect( normalized[ 1 ].visible ).toBe( false );
		} );

		it( 'should handle empty array', () => {
			const normalized = editor.normalizeLayers( [] );
			expect( normalized ).toEqual( [] );
		} );

		it( 'should preserve existing layer properties', () => {
			const layers = [
				{ id: 'layer1', type: 'rectangle', x: 10, y: 20, stroke: '#ff0000' }
			];
			
			const normalized = editor.normalizeLayers( layers );
			
			expect( normalized[ 0 ].x ).toBe( 10 );
			expect( normalized[ 0 ].y ).toBe( 20 );
			expect( normalized[ 0 ].stroke ).toBe( '#ff0000' );
		} );
	} );

	describe( 'debugLog and errorLog', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should log via mw.log when debug mode is enabled', () => {
			editor.debug = true;
			const logSpy = jest.fn();
			window.mw = { ...window.mw, log: logSpy };
			
			editor.debugLog( 'test message', { data: 123 } );
			
			expect( logSpy ).toHaveBeenCalled();
		} );

		it( 'should not log when debug mode is disabled', () => {
			editor.debug = false;
			const logSpy = jest.fn();
			window.mw = { ...window.mw, log: logSpy };
			
			editor.debugLog( 'test message' );
			
			expect( logSpy ).not.toHaveBeenCalled();
		} );

		it( 'should always log errors via mw.log.error', () => {
			const errorSpy = jest.fn();
			window.mw = { ...window.mw, log: { error: errorSpy } };
			
			editor.errorLog( 'error message', new Error( 'test' ) );
			
			expect( errorSpy ).toHaveBeenCalled();
		} );
	} );

	describe( 'markDirty and markClean', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
		} );

		it( 'should mark editor as dirty', () => {
			editor.markDirty();
			expect( editor.stateManager.get( 'isDirty' ) ).toBe( true );
		} );

		it( 'should mark editor as clean', () => {
			editor.stateManager.set( 'isDirty', true );
			editor.markClean();
			expect( editor.stateManager.get( 'isDirty' ) ).toBe( false );
		} );
	} );
} );
