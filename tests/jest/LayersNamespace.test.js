/**
 * LayersNamespace tests
 *
 * Tests for the unified Layers namespace that consolidates global exports
 */

describe( 'LayersNamespace', () => {
	let originalWindow;
	let mockMw;
	let LayersNamespace;

	beforeEach( () => {
		// Store original window state
		originalWindow = { ...global.window };

		// Reset window.Layers
		delete global.window.Layers;

		// Mock mw object
		mockMw = {
			log: {
				warn: jest.fn()
			},
			hook: jest.fn( () => ( {
				add: jest.fn()
			} ) )
		};
		global.mw = mockMw;

		// Mock the component classes that would be exported
		global.window.StateManager = class StateManager {};
		global.window.HistoryManager = class HistoryManager {};
		global.window.EventManager = class EventManager {};
		global.window.LayersModuleRegistry = class LayersModuleRegistry {};
		global.window.Toolbar = class Toolbar {};
		global.window.LayerPanel = class LayerPanel {};
		global.window.UIManager = class UIManager {};
		global.window.ColorPickerDialog = class ColorPickerDialog {};
		global.window.ConfirmDialog = class ConfirmDialog {};
		global.window.PropertiesForm = class PropertiesForm {};
		global.window.IconFactory = class IconFactory {};
		global.window.CanvasManager = class CanvasManager {};
		global.window.CanvasRenderer = class CanvasRenderer {};
		global.window.CanvasUtilities = class CanvasUtilities {};
		global.window.CanvasEvents = class CanvasEvents {};
		global.window.LayersSelectionManager = class LayersSelectionManager {};
		global.window.ShapeRenderer = class ShapeRenderer {};
		global.window.DrawingController = class DrawingController {};
		global.window.TransformController = class TransformController {};
		global.window.HitTestController = class HitTestController {};
		global.window.ClipboardController = class ClipboardController {};
		global.window.RenderCoordinator = class RenderCoordinator {};
		global.window.InteractionController = class InteractionController {};
		global.window.ZoomPanController = class ZoomPanController {};
		global.window.GridRulersController = class GridRulersController {};
		global.window.GeometryUtils = { normalize: jest.fn() };
		global.window.TextUtils = { measure: jest.fn() };
		global.window.EventTracker = class EventTracker {};
		global.window.LayersErrorHandler = class LayersErrorHandler {};
		global.window.TransformationEngine = class TransformationEngine {};
		global.window.ImageLoader = class ImageLoader {};
		global.window.ImportExportManager = class ImportExportManager {};
		global.window.LayersValidator = class LayersValidator {};
		global.window.ValidationManager = class ValidationManager {};
		global.window.LayersEditor = class LayersEditor {};
		global.window.LayersToolManager = class LayersToolManager {};
		global.window.StyleController = class StyleController {};
		global.window.APIManager = class APIManager {};
		global.window.LayersMessageHelper = { get: jest.fn() };
		global.window.LayerSetManager = class LayerSetManager {};

		// Clear module cache and require fresh
		jest.resetModules();
		LayersNamespace = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
	} );

	afterEach( () => {
		// Restore window
		global.window = originalWindow;
		jest.clearAllMocks();
	} );

	describe( 'Namespace structure', () => {
		it( 'should create window.Layers namespace', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers ).toBeDefined();
			expect( typeof global.window.Layers ).toBe( 'object' );
		} );

		it( 'should create Core subgroup', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.Core ).toBeDefined();
			expect( typeof global.window.Layers.Core ).toBe( 'object' );
		} );

		it( 'should create UI subgroup', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.UI ).toBeDefined();
			expect( typeof global.window.Layers.UI ).toBe( 'object' );
		} );

		it( 'should create Canvas subgroup', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.Canvas ).toBeDefined();
			expect( typeof global.window.Layers.Canvas ).toBe( 'object' );
		} );

		it( 'should create Utils subgroup', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.Utils ).toBeDefined();
			expect( typeof global.window.Layers.Utils ).toBe( 'object' );
		} );

		it( 'should create Validation subgroup', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.Validation ).toBeDefined();
			expect( typeof global.window.Layers.Validation ).toBe( 'object' );
		} );

		it( 'should set version', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.VERSION ).toBe( '0.8.1-dev' );
		} );

		it( 'should set initialized flag', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.initialized ).toBe( true );
		} );
	} );

	describe( 'Core exports', () => {
		beforeEach( () => {
			LayersNamespace.initializeNamespace();
		} );

		it( 'should export StateManager to Core', () => {
			expect( global.window.Layers.Core.StateManager ).toBe( global.window.StateManager );
		} );

		it( 'should export HistoryManager to Core', () => {
			expect( global.window.Layers.Core.HistoryManager ).toBe( global.window.HistoryManager );
		} );

		it( 'should export EventManager to Core', () => {
			expect( global.window.Layers.Core.EventManager ).toBe( global.window.EventManager );
		} );

		it( 'should export ModuleRegistry to Core', () => {
			expect( global.window.Layers.Core.ModuleRegistry ).toBe( global.window.LayersModuleRegistry );
		} );
	} );

	describe( 'UI exports', () => {
		beforeEach( () => {
			LayersNamespace.initializeNamespace();
		} );

		it( 'should export Toolbar to UI', () => {
			expect( global.window.Layers.UI.Toolbar ).toBe( global.window.Toolbar );
		} );

		it( 'should export LayerPanel to UI', () => {
			expect( global.window.Layers.UI.LayerPanel ).toBe( global.window.LayerPanel );
		} );

		it( 'should export UIManager to UI.Manager', () => {
			expect( global.window.Layers.UI.Manager ).toBe( global.window.UIManager );
		} );

		it( 'should export ColorPickerDialog to UI', () => {
			expect( global.window.Layers.UI.ColorPickerDialog ).toBe( global.window.ColorPickerDialog );
		} );

		it( 'should export ConfirmDialog to UI', () => {
			expect( global.window.Layers.UI.ConfirmDialog ).toBe( global.window.ConfirmDialog );
		} );

		it( 'should export PropertiesForm to UI', () => {
			expect( global.window.Layers.UI.PropertiesForm ).toBe( global.window.PropertiesForm );
		} );

		it( 'should export IconFactory to UI', () => {
			expect( global.window.Layers.UI.IconFactory ).toBe( global.window.IconFactory );
		} );
	} );

	describe( 'Canvas exports', () => {
		beforeEach( () => {
			LayersNamespace.initializeNamespace();
		} );

		it( 'should export CanvasManager to Canvas', () => {
			expect( global.window.Layers.Canvas.Manager ).toBe( global.window.CanvasManager );
		} );

		it( 'should export CanvasRenderer to Canvas', () => {
			expect( global.window.Layers.Canvas.Renderer ).toBe( global.window.CanvasRenderer );
		} );

		it( 'should export SelectionManager to Canvas', () => {
			expect( global.window.Layers.Canvas.SelectionManager ).toBe( global.window.LayersSelectionManager );
		} );

		it( 'should export DrawingController to Canvas', () => {
			expect( global.window.Layers.Canvas.DrawingController ).toBe( global.window.DrawingController );
		} );

		it( 'should export TransformController to Canvas', () => {
			expect( global.window.Layers.Canvas.TransformController ).toBe( global.window.TransformController );
		} );

		it( 'should export HitTestController to Canvas', () => {
			expect( global.window.Layers.Canvas.HitTestController ).toBe( global.window.HitTestController );
		} );

		it( 'should export ClipboardController to Canvas', () => {
			expect( global.window.Layers.Canvas.ClipboardController ).toBe( global.window.ClipboardController );
		} );

		it( 'should export ZoomPanController to Canvas', () => {
			expect( global.window.Layers.Canvas.ZoomPanController ).toBe( global.window.ZoomPanController );
		} );

		it( 'should export GridRulersController to Canvas', () => {
			expect( global.window.Layers.Canvas.GridRulersController ).toBe( global.window.GridRulersController );
		} );

		it( 'should export LayerRenderer to Canvas', () => {
			expect( global.window.Layers.Canvas.LayerRenderer ).toBe( global.window.LayerRenderer );
		} );
	} );

	describe( 'Utils exports', () => {
		beforeEach( () => {
			LayersNamespace.initializeNamespace();
		} );

		it( 'should export GeometryUtils to Utils', () => {
			expect( global.window.Layers.Utils.Geometry ).toBe( global.window.GeometryUtils );
		} );

		it( 'should export TextUtils to Utils', () => {
			expect( global.window.Layers.Utils.Text ).toBe( global.window.TextUtils );
		} );

		it( 'should export EventTracker to Utils', () => {
			expect( global.window.Layers.Utils.EventTracker ).toBe( global.window.EventTracker );
		} );

		it( 'should export ErrorHandler to Utils', () => {
			expect( global.window.Layers.Utils.ErrorHandler ).toBe( global.window.LayersErrorHandler );
		} );

		it( 'should export TransformationEngine to Utils', () => {
			expect( global.window.Layers.Utils.TransformationEngine ).toBe( global.window.TransformationEngine );
		} );

		it( 'should export ImageLoader to Utils', () => {
			expect( global.window.Layers.Utils.ImageLoader ).toBe( global.window.ImageLoader );
		} );

		it( 'should export ImportExportManager to Utils', () => {
			expect( global.window.Layers.Utils.ImportExport ).toBe( global.window.ImportExportManager );
		} );
	} );

	describe( 'Validation exports', () => {
		beforeEach( () => {
			LayersNamespace.initializeNamespace();
		} );

		it( 'should export LayersValidator to Validation', () => {
			expect( global.window.Layers.Validation.LayersValidator ).toBe( global.window.LayersValidator );
		} );

		it( 'should export ValidationManager to Validation', () => {
			expect( global.window.Layers.Validation.Manager ).toBe( global.window.ValidationManager );
		} );
	} );

	describe( 'Top-level exports', () => {
		beforeEach( () => {
			LayersNamespace.initializeNamespace();
		} );

		it( 'should export LayersEditor at top level', () => {
			expect( global.window.Layers.Editor ).toBe( global.window.LayersEditor );
		} );

		it( 'should export ToolManager at top level', () => {
			expect( global.window.Layers.ToolManager ).toBe( global.window.LayersToolManager );
		} );

		it( 'should export StyleController at top level', () => {
			expect( global.window.Layers.StyleController ).toBe( global.window.StyleController );
		} );

		it( 'should export APIManager at top level', () => {
			expect( global.window.Layers.APIManager ).toBe( global.window.APIManager );
		} );

		it( 'should export MessageHelper at top level', () => {
			expect( global.window.Layers.MessageHelper ).toBe( global.window.LayersMessageHelper );
		} );

		it( 'should export LayerSetManager at top level', () => {
			expect( global.window.Layers.LayerSetManager ).toBe( global.window.LayerSetManager );
		} );
	} );

	describe( 'Missing exports handling', () => {
		it( 'should handle missing components gracefully', () => {
			// Remove some components
			delete global.window.StateManager;
			delete global.window.CanvasManager;

			// Should not throw
			expect( () => {
				LayersNamespace.initializeNamespace();
			} ).not.toThrow();

			// Should still create namespace structure
			expect( global.window.Layers ).toBeDefined();
			expect( global.window.Layers.Core ).toBeDefined();
			expect( global.window.Layers.Canvas ).toBeDefined();

			// Missing components should be undefined
			expect( global.window.Layers.Core.StateManager ).toBeUndefined();
			expect( global.window.Layers.Canvas.Manager ).toBeUndefined();
		} );
	} );

	describe( 'Double initialization protection', () => {
		it( 'should not reinitialize if already initialized', () => {
			LayersNamespace.initializeNamespace();

			// Store reference to original subgroup
			const originalCore = global.window.Layers.Core;

			// Try to initialize again
			LayersNamespace.initializeNamespace();

			// Should be the same object
			expect( global.window.Layers.Core ).toBe( originalCore );
		} );
	} );

	describe( 'Export registry', () => {
		it( 'should have all expected exports in registry', () => {
			const registry = LayersNamespace.getExportRegistry();

			expect( registry ).toBeDefined();
			expect( registry.StateManager ).toBeDefined();
			expect( registry.LayersEditor ).toBeDefined();
			expect( registry.CanvasManager ).toBeDefined();
			expect( registry.Toolbar ).toBeDefined();
		} );

		it( 'should map exports to correct namespace locations', () => {
			const registry = LayersNamespace.getExportRegistry();

			expect( registry.StateManager.ns ).toBe( 'Core' );
			expect( registry.Toolbar.ns ).toBe( 'UI' );
			expect( registry.CanvasManager.ns ).toBe( 'Canvas' );
			expect( registry.GeometryUtils.ns ).toBe( 'Utils' );
			expect( registry.LayersValidator.ns ).toBe( 'Validation' );
		} );

		it( 'should use null namespace for top-level exports', () => {
			const registry = LayersNamespace.getExportRegistry();

			expect( registry.LayersEditor.ns ).toBe( null );
			expect( registry.LayersToolManager.ns ).toBe( null );
		} );
	} );

	describe( 'Module exports', () => {
		it( 'should export initializeNamespace function', () => {
			expect( typeof LayersNamespace.initializeNamespace ).toBe( 'function' );
		} );

		it( 'should export getExportRegistry function', () => {
			expect( typeof LayersNamespace.getExportRegistry ).toBe( 'function' );
		} );
	} );
} );
