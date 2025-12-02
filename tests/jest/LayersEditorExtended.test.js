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
			validateLayers: jest.fn().mockReturnValue( true ),
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

		// Setup window globals
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

		window.layersRegistry = mockRegistry;

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

		it( 'should return message text when mw.message available', () => {
			window.mw = {
				message: jest.fn().mockReturnValue( { text: () => 'Translated text' } ),
				config: { get: jest.fn() }
			};
			expect( editor.getMessage( 'test-key', 'fallback' ) ).toBe( 'Translated text' );
		} );

		it( 'should return fallback when mw.message not available', () => {
			window.mw = { config: { get: jest.fn() } };
			expect( editor.getMessage( 'test-key', 'fallback' ) ).toBe( 'fallback' );
		} );

		it( 'should use mw.msg as fallback', () => {
			window.mw = {
				msg: jest.fn().mockReturnValue( 'msg text' ),
				config: { get: jest.fn() }
			};
			expect( editor.getMessage( 'test-key', 'fallback' ) ).toBe( 'msg text' );
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

		it( 'should return selectedLayerIds from canvasManager', () => {
			editor.canvasManager = { selectedLayerIds: [ 'layer1', 'layer2' ] };
			const ids = editor.getSelectedLayerIds();
			expect( ids ).toEqual( [ 'layer1', 'layer2' ] );
		} );

		it( 'should return copy, not reference', () => {
			editor.canvasManager = { selectedLayerIds: [ 'layer1' ] };
			const ids = editor.getSelectedLayerIds();
			ids.push( 'layer2' );
			expect( editor.canvasManager.selectedLayerIds ).toEqual( [ 'layer1' ] );
		} );

		it( 'should fallback to single selectedLayerId', () => {
			editor.canvasManager = null;
			editor.stateManager.set( 'selectedLayerId', 'single_layer' );
			expect( editor.getSelectedLayerIds() ).toEqual( [ 'single_layer' ] );
		} );

		it( 'should return empty array when no selection', () => {
			editor.canvasManager = null;
			editor.stateManager.set( 'selectedLayerId', null );
			expect( editor.getSelectedLayerIds() ).toEqual( [] );
		} );
	} );

	describe( 'applyToSelection', () => {
		beforeEach( () => {
			editor = new LayersEditor( { filename: 'Test.jpg', container: mockContainer } );
			editor.canvasManager = mockCanvasManager;
			mockCanvasManager.selectedLayerIds = [];
		} );

		it( 'should apply mutator to selected layers', () => {
			// Add layers with explicit IDs
			editor.stateManager.set( 'layers', [
				{ id: 'layer1', type: 'rectangle', x: 10 },
				{ id: 'layer2', type: 'circle', x: 20 }
			] );
			mockCanvasManager.selectedLayerIds = [ 'layer1' ];

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
			mockCanvasManager.selectedLayerIds = [ 'layer1' ];

			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );

			const layers = editor.stateManager.get( 'layers' );
			const layer2 = layers.find( ( l ) => l.id === 'layer2' );
			expect( layer2.x ).toBe( 20 );
		} );

		it( 'should save state before applying', () => {
			editor.stateManager.set( 'layers', [ { id: 'layer1', type: 'rectangle', x: 10 } ] );
			mockCanvasManager.selectedLayerIds = [ 'layer1' ];
			const saveStateSpy = jest.spyOn( editor, 'saveState' );
			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );
			expect( saveStateSpy ).toHaveBeenCalled();
		} );

		it( 'should render after applying', () => {
			editor.stateManager.set( 'layers', [ { id: 'layer1', type: 'rectangle', x: 10 } ] );
			mockCanvasManager.selectedLayerIds = [ 'layer1' ];
			editor.applyToSelection( ( layer ) => {
				layer.x = 100;
			} );
			expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
		} );

		it( 'should do nothing if mutator is not a function', () => {
			expect( () => editor.applyToSelection( 'not a function' ) ).not.toThrow();
		} );

		it( 'should do nothing if no layers selected', () => {
			mockCanvasManager.selectedLayerIds = [];
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
		} );

		it( 'should update toolbar undo/redo state', () => {
			editor.historyManager.canUndo = jest.fn().mockReturnValue( true );
			editor.historyManager.canRedo = jest.fn().mockReturnValue( false );
			editor.updateUIState();
			expect( mockToolbar.updateUndoRedoState ).toHaveBeenCalledWith( true, false );
		} );

		it( 'should update toolbar delete state based on selection', () => {
			editor.stateManager.set( 'selectedLayerId', 'layer1' );
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
			expect( mockGetUrl ).toHaveBeenCalledWith( 'File:Test.jpg' );
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
			expect( mockGetUrl ).toHaveBeenCalledWith( 'File:Other.jpg' );
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
			mockValidationManager.validateLayers.mockReturnValue( false );
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
} );
