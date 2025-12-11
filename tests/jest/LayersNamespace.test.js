/**
 * LayersNamespace tests
 *
 * Tests for the unified Layers namespace that consolidates global exports.
 * Note: As of the namespace consolidation, modules export directly to window.Layers.*
 * rather than to window.* with backward compatibility aliases.
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

		// Initialize the Layers namespace structure that modules now export to directly
		global.window.Layers = {
			Core: {
				StateManager: class StateManager {},
				HistoryManager: class HistoryManager {},
				EventManager: class EventManager {},
				ModuleRegistry: class ModuleRegistry {}
			},
			UI: {
				Toolbar: class Toolbar {},
				LayerPanel: class LayerPanel {},
				Manager: class UIManager {},
				ColorPickerDialog: class ColorPickerDialog {},
				ConfirmDialog: class ConfirmDialog {},
				PropertiesForm: class PropertiesForm {},
				IconFactory: class IconFactory {}
			},
			Canvas: {
				Manager: class CanvasManager {},
				Renderer: class CanvasRenderer {},
				Utilities: class CanvasUtilities {},
				Events: class CanvasEvents {},
				SelectionManager: class SelectionManager {},
				LayerRenderer: class LayerRenderer {},
				DrawingController: class DrawingController {},
				TransformController: class TransformController {},
				HitTestController: class HitTestController {},
				ClipboardController: class ClipboardController {},
				RenderCoordinator: class RenderCoordinator {},
				InteractionController: class InteractionController {},
				ZoomPanController: class ZoomPanController {},
				GridRulersController: class GridRulersController {},
				TransformationEngine: class TransformationEngine {}
			},
			Utils: {
				Geometry: { normalize: jest.fn() },
				Text: { measure: jest.fn() },
				EventTracker: class EventTracker {},
				ErrorHandler: class ErrorHandler {},
				ImageLoader: class ImageLoader {},
				ImportExport: class ImportExportManager {},
				MessageHelper: { get: jest.fn() }
			},
			Validation: {
				LayersValidator: class LayersValidator {},
				Manager: class ValidationManager {}
			},
			// Top-level exports
			Editor: class LayersEditor {},
			ToolManager: class ToolManager {},
			StyleController: class StyleController {},
			APIManager: class APIManager {},
			LayerSetManager: class LayerSetManager {},
			Constants: {}
		};

		// Singleton instances
		global.window.layersRegistry = {};
		global.window.layersErrorHandler = {};
		global.window.layersMessages = { get: jest.fn() };

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
		it( 'should have window.Layers namespace', () => {
			expect( global.window.Layers ).toBeDefined();
			expect( typeof global.window.Layers ).toBe( 'object' );
		} );

		it( 'should have Core subgroup', () => {
			expect( global.window.Layers.Core ).toBeDefined();
			expect( typeof global.window.Layers.Core ).toBe( 'object' );
		} );

		it( 'should have UI subgroup', () => {
			expect( global.window.Layers.UI ).toBeDefined();
			expect( typeof global.window.Layers.UI ).toBe( 'object' );
		} );

		it( 'should have Canvas subgroup', () => {
			expect( global.window.Layers.Canvas ).toBeDefined();
			expect( typeof global.window.Layers.Canvas ).toBe( 'object' );
		} );

		it( 'should have Utils subgroup', () => {
			expect( global.window.Layers.Utils ).toBeDefined();
			expect( typeof global.window.Layers.Utils ).toBe( 'object' );
		} );

		it( 'should have Validation subgroup', () => {
			expect( global.window.Layers.Validation ).toBeDefined();
			expect( typeof global.window.Layers.Validation ).toBe( 'object' );
		} );
	} );

	describe( 'Core exports', () => {
		it( 'should have StateManager in Core', () => {
			expect( global.window.Layers.Core.StateManager ).toBeDefined();
		} );

		it( 'should have HistoryManager in Core', () => {
			expect( global.window.Layers.Core.HistoryManager ).toBeDefined();
		} );

		it( 'should have EventManager in Core', () => {
			expect( global.window.Layers.Core.EventManager ).toBeDefined();
		} );

		it( 'should have ModuleRegistry in Core', () => {
			expect( global.window.Layers.Core.ModuleRegistry ).toBeDefined();
		} );
	} );

	describe( 'UI exports', () => {
		it( 'should have Toolbar in UI', () => {
			expect( global.window.Layers.UI.Toolbar ).toBeDefined();
		} );

		it( 'should have LayerPanel in UI', () => {
			expect( global.window.Layers.UI.LayerPanel ).toBeDefined();
		} );

		it( 'should have Manager (UIManager) in UI', () => {
			expect( global.window.Layers.UI.Manager ).toBeDefined();
		} );

		it( 'should have ColorPickerDialog in UI', () => {
			expect( global.window.Layers.UI.ColorPickerDialog ).toBeDefined();
		} );

		it( 'should have ConfirmDialog in UI', () => {
			expect( global.window.Layers.UI.ConfirmDialog ).toBeDefined();
		} );

		it( 'should have PropertiesForm in UI', () => {
			expect( global.window.Layers.UI.PropertiesForm ).toBeDefined();
		} );

		it( 'should have IconFactory in UI', () => {
			expect( global.window.Layers.UI.IconFactory ).toBeDefined();
		} );
	} );

	describe( 'Canvas exports', () => {
		it( 'should have Manager (CanvasManager) in Canvas', () => {
			expect( global.window.Layers.Canvas.Manager ).toBeDefined();
		} );

		it( 'should have Renderer in Canvas', () => {
			expect( global.window.Layers.Canvas.Renderer ).toBeDefined();
		} );

		it( 'should have SelectionManager in Canvas', () => {
			expect( global.window.Layers.Canvas.SelectionManager ).toBeDefined();
		} );

		it( 'should have DrawingController in Canvas', () => {
			expect( global.window.Layers.Canvas.DrawingController ).toBeDefined();
		} );

		it( 'should have TransformController in Canvas', () => {
			expect( global.window.Layers.Canvas.TransformController ).toBeDefined();
		} );

		it( 'should have HitTestController in Canvas', () => {
			expect( global.window.Layers.Canvas.HitTestController ).toBeDefined();
		} );

		it( 'should have ClipboardController in Canvas', () => {
			expect( global.window.Layers.Canvas.ClipboardController ).toBeDefined();
		} );

		it( 'should have ZoomPanController in Canvas', () => {
			expect( global.window.Layers.Canvas.ZoomPanController ).toBeDefined();
		} );

		it( 'should have GridRulersController in Canvas', () => {
			expect( global.window.Layers.Canvas.GridRulersController ).toBeDefined();
		} );

		it( 'should have LayerRenderer in Canvas', () => {
			expect( global.window.Layers.Canvas.LayerRenderer ).toBeDefined();
		} );
	} );

	describe( 'Utils exports', () => {
		it( 'should have Geometry (GeometryUtils) in Utils', () => {
			expect( global.window.Layers.Utils.Geometry ).toBeDefined();
		} );

		it( 'should have Text (TextUtils) in Utils', () => {
			expect( global.window.Layers.Utils.Text ).toBeDefined();
		} );

		it( 'should have EventTracker in Utils', () => {
			expect( global.window.Layers.Utils.EventTracker ).toBeDefined();
		} );

		it( 'should have ErrorHandler in Utils', () => {
			expect( global.window.Layers.Utils.ErrorHandler ).toBeDefined();
		} );

		it( 'should have ImageLoader in Utils', () => {
			expect( global.window.Layers.Utils.ImageLoader ).toBeDefined();
		} );

		it( 'should have ImportExport (ImportExportManager) in Utils', () => {
			expect( global.window.Layers.Utils.ImportExport ).toBeDefined();
		} );
	} );

	describe( 'Validation exports', () => {
		it( 'should have LayersValidator in Validation', () => {
			expect( global.window.Layers.Validation.LayersValidator ).toBeDefined();
		} );

		it( 'should have Manager (ValidationManager) in Validation', () => {
			expect( global.window.Layers.Validation.Manager ).toBeDefined();
		} );
	} );

	describe( 'Top-level exports', () => {
		it( 'should have Editor at top level', () => {
			expect( global.window.Layers.Editor ).toBeDefined();
		} );

		it( 'should have ToolManager at top level', () => {
			expect( global.window.Layers.ToolManager ).toBeDefined();
		} );

		it( 'should have StyleController at top level', () => {
			expect( global.window.Layers.StyleController ).toBeDefined();
		} );

		it( 'should have APIManager at top level', () => {
			expect( global.window.Layers.APIManager ).toBeDefined();
		} );

		it( 'should have LayerSetManager at top level', () => {
			expect( global.window.Layers.LayerSetManager ).toBeDefined();
		} );
	} );

	describe( 'Singleton instances', () => {
		it( 'should have layersRegistry available', () => {
			expect( global.window.layersRegistry ).toBeDefined();
		} );

		it( 'should have layersErrorHandler available', () => {
			expect( global.window.layersErrorHandler ).toBeDefined();
		} );

		it( 'should have layersMessages available', () => {
			expect( global.window.layersMessages ).toBeDefined();
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
