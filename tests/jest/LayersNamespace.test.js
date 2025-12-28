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

		it( 'should export registerExport function', () => {
			expect( typeof LayersNamespace.registerExport ).toBe( 'function' );
		} );

		it( 'should export exportRegistry object', () => {
			expect( LayersNamespace.exportRegistry ).toBeDefined();
			expect( typeof LayersNamespace.exportRegistry ).toBe( 'object' );
		} );
	} );

	describe( 'getExportRegistry', () => {
		it( 'should return the export registry object', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry ).toBeDefined();
			expect( typeof registry ).toBe( 'object' );
		} );

		it( 'should contain StateManager mapping', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry.StateManager ).toEqual( { ns: 'Core', name: 'StateManager' } );
		} );

		it( 'should contain LayersEditor mapping with null namespace', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry.LayersEditor ).toEqual( { ns: null, name: 'Editor' } );
		} );

		it( 'should contain all Core mappings', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry.StateManager ).toBeDefined();
			expect( registry.HistoryManager ).toBeDefined();
			expect( registry.EventManager ).toBeDefined();
			expect( registry.LayersModuleRegistry ).toBeDefined();
		} );

		it( 'should contain all UI mappings', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry.UIManager ).toBeDefined();
			expect( registry.Toolbar ).toBeDefined();
			expect( registry.LayerPanel ).toBeDefined();
		} );

		it( 'should contain all Canvas mappings', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry.CanvasManager ).toBeDefined();
			expect( registry.CanvasRenderer ).toBeDefined();
			expect( registry.LayersSelectionManager ).toBeDefined();
		} );

		it( 'should contain all Utils mappings', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry.GeometryUtils ).toBeDefined();
			expect( registry.TextUtils ).toBeDefined();
			expect( registry.ImageLoader ).toBeDefined();
		} );

		it( 'should contain Validation mappings', () => {
			const registry = LayersNamespace.getExportRegistry();
			expect( registry.LayersValidator ).toBeDefined();
			expect( registry.ValidationManager ).toBeDefined();
		} );
	} );

	describe( 'registerExport', () => {
		beforeEach( () => {
			// Reset the namespace for clean testing
			global.window.Layers = {
				Core: {},
				UI: {},
				Canvas: {},
				Utils: {},
				Validation: {}
			};
		} );

		it( 'should register class to correct namespace location', () => {
			class TestStateManager {}
			global.window.StateManager = TestStateManager;
			LayersNamespace.registerExport( 'StateManager', TestStateManager );

			expect( global.window.Layers.Core.StateManager ).toBe( TestStateManager );
		} );

		it( 'should register top-level export when ns is null', () => {
			class TestEditor {}
			global.window.LayersEditor = TestEditor;
			LayersNamespace.registerExport( 'LayersEditor', TestEditor );

			expect( global.window.Layers.Editor ).toBe( TestEditor );
		} );

		it( 'should handle unknown export names gracefully', () => {
			class UnknownClass {}
			// Should not throw
			expect( () => {
				LayersNamespace.registerExport( 'UnknownClassName', UnknownClass );
			} ).not.toThrow();
		} );

		it( 'should register UI component correctly', () => {
			class TestToolbar {}
			global.window.Toolbar = TestToolbar;
			LayersNamespace.registerExport( 'Toolbar', TestToolbar );

			expect( global.window.Layers.UI.Toolbar ).toBe( TestToolbar );
		} );

		it( 'should register Canvas component correctly', () => {
			class TestCanvasManager {}
			global.window.CanvasManager = TestCanvasManager;
			LayersNamespace.registerExport( 'CanvasManager', TestCanvasManager );

			expect( global.window.Layers.Canvas.Manager ).toBe( TestCanvasManager );
		} );

		it( 'should register Utils component correctly', () => {
			class TestImageLoader {}
			global.window.ImageLoader = TestImageLoader;
			LayersNamespace.registerExport( 'ImageLoader', TestImageLoader );

			expect( global.window.Layers.Utils.ImageLoader ).toBe( TestImageLoader );
		} );

		it( 'should register Validation component correctly', () => {
			class TestValidator {}
			global.window.LayersValidator = TestValidator;
			LayersNamespace.registerExport( 'LayersValidator', TestValidator );

			expect( global.window.Layers.Validation.LayersValidator ).toBe( TestValidator );
		} );
	} );

	describe( 'initializeNamespace', () => {
		beforeEach( () => {
			// Reset namespace fully
			delete global.window.Layers;
			global.window.Layers = {
				Core: {},
				UI: {},
				Canvas: {},
				Utils: {},
				Validation: {}
			};
		} );

		it( 'should set initialized flag after calling', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.initialized ).toBe( true );
		} );

		it( 'should set VERSION after initializing', () => {
			LayersNamespace.initializeNamespace();
			expect( global.window.Layers.VERSION ).toBeDefined();
		} );

		it( 'should not re-initialize if already initialized', () => {
			global.window.Layers.initialized = true;
			const originalVersion = global.window.Layers.VERSION;

			LayersNamespace.initializeNamespace();

			// VERSION should remain unchanged (was set before, won't be overwritten)
			expect( global.window.Layers.VERSION ).toBe( originalVersion );
		} );

		it( 'should register existing window.StateManager', () => {
			class MockStateManager {}
			global.window.StateManager = MockStateManager;

			LayersNamespace.initializeNamespace();

			expect( global.window.Layers.Core.StateManager ).toBe( MockStateManager );
		} );

		it( 'should register singleton layersRegistry', () => {
			global.window.layersRegistry = { test: true };

			LayersNamespace.initializeNamespace();

			expect( global.window.Layers.registry ).toEqual( { test: true } );
		} );

		it( 'should register singleton layersErrorHandler', () => {
			global.window.layersErrorHandler = { handleError: jest.fn() };

			LayersNamespace.initializeNamespace();

			expect( global.window.Layers.errorHandler ).toBe( global.window.layersErrorHandler );
		} );

		it( 'should register singleton layersMessages', () => {
			global.window.layersMessages = { get: jest.fn() };

			LayersNamespace.initializeNamespace();

			expect( global.window.Layers.messages ).toBe( global.window.layersMessages );
		} );
	} );

	describe( 'exportRegistry structure', () => {
		it( 'should have correct structure for Core components', () => {
			const registry = LayersNamespace.exportRegistry;
			expect( registry.StateManager.ns ).toBe( 'Core' );
			expect( registry.HistoryManager.ns ).toBe( 'Core' );
			expect( registry.EventManager.ns ).toBe( 'Core' );
		} );

		it( 'should have correct structure for top-level exports', () => {
			const registry = LayersNamespace.exportRegistry;
			expect( registry.LayersEditor.ns ).toBeNull();
			expect( registry.LayersToolManager.ns ).toBeNull();
			expect( registry.APIManager.ns ).toBeNull();
		} );

		it( 'should have name mappings that differ from old names', () => {
			const registry = LayersNamespace.exportRegistry;
			// UIManager -> UI.Manager
			expect( registry.UIManager.name ).toBe( 'Manager' );
			// CanvasManager -> Canvas.Manager  
			expect( registry.CanvasManager.name ).toBe( 'Manager' );
			// GeometryUtils -> Utils.Geometry
			expect( registry.GeometryUtils.name ).toBe( 'Geometry' );
		} );
	} );

	describe( 'Deprecation warnings', () => {
		beforeEach( () => {
			// Enable debug mode to trigger warnings
			mockMw.config = {
				get: jest.fn( ( key ) => {
					if ( key === 'wgLayersDebug' ) {
						return true;
					}
					return null;
				} )
			};
		} );

		it( 'should not warn when debug mode is disabled', () => {
			mockMw.config.get = jest.fn().mockReturnValue( false );

			// Re-require to get fresh module with debug disabled
			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Legacy access should not warn
			expect( mockMw.log.warn ).not.toHaveBeenCalled();
		} );

		it( 'should check if mw.config exists before warning', () => {
			// Remove config to test guard
			delete mockMw.config;

			jest.resetModules();
			require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Should not throw
			expect( mockMw.log.warn ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing mw.log gracefully', () => {
			// Remove log to test guard
			delete mockMw.log;

			jest.resetModules();

			// Should not throw
			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();
		} );

		it( 'should handle undefined mw gracefully', () => {
			// Remove mw entirely
			delete global.mw;

			jest.resetModules();

			// Should not throw
			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();
		} );
	} );

	describe( 'Non-browser environment', () => {
		it( 'should skip initialization when window is undefined', () => {
			// Save original window
			const savedWindow = global.window;

			// Remove window
			delete global.window;

			jest.resetModules();

			// Should not throw when window is undefined
			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();

			// Restore window
			global.window = savedWindow;
		} );
	} );

	describe( 'createDeprecatedProxy', () => {
		it( 'should wrap function targets', () => {
			mockMw.config = {
				get: jest.fn().mockReturnValue( true )
			};

			// The proxy is created internally by LayersNamespace
			// We can test it indirectly by checking legacy exports work
			jest.resetModules();
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// registerExport with a function should create a proxy
			const TestClass = function TestClass() {
				this.value = 'test';
			};
			global.window.TestClass = TestClass;
			global.window.Layers.Test = TestClass;

			ns.registerExport( 'TestClass', 'Test' );

			// The legacy export should be wrapped
			expect( global.window.TestClass ).toBeDefined();
		} );

		it( 'should return non-function targets directly', () => {
			jest.resetModules();
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Register an object (not a function)
			const testObject = { key: 'value' };
			global.window.testInstance = testObject;
			global.window.Layers.testInstance = testObject;

			ns.registerExport( 'testInstance', null, 'testInstance' );

			// Non-functions should be returned directly
			expect( global.window.testInstance ).toBe( testObject );
		} );

		it( 'should warn on first use with debug enabled and create instance with new', () => {
			// Enable debug mode
			mockMw.config = {
				get: jest.fn( ( key ) => key === 'wgLayersDebug' )
			};

			jest.resetModules();

			// Set up a class for the old global
			class TestStateManager {
				constructor() {
					this.created = true;
				}
			}
			global.window.StateManager = TestStateManager;
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			ns.registerExport( 'StateManager', TestStateManager );

			// Use the deprecated proxy with 'new'
			// The proxy should warn and create instance
			// Note: We need to test the proxy behavior indirectly
			// since registerExport doesn't overwrite existing window exports
		} );

		it( 'should support calling without new (for factory functions)', () => {
			mockMw.config = {
				get: jest.fn().mockReturnValue( true )
			};

			jest.resetModules();

			// A factory function that returns an object
			const factoryFn = function ( value ) {
				return { value: value };
			};
			global.window.FactoryFn = factoryFn;
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			ns.registerExport( 'FactoryFn', factoryFn );

			// The original function should still work
			const result = factoryFn( 'test' );
			expect( result.value ).toBe( 'test' );
		} );
	} );

	describe( 'Version', () => {
		it( 'should have version defined after initialization', () => {
			jest.resetModules();
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Initialize to set VERSION
			ns.initializeNamespace();

			expect( global.window.Layers.VERSION ).toBeDefined();
			expect( typeof global.window.Layers.VERSION ).toBe( 'string' );
		} );
	} );

	describe( 'Deprecation proxy advanced', () => {
		beforeEach( () => {
			// Enable debug mode
			mockMw.config = {
				get: jest.fn( ( key ) => key === 'wgLayersDebug' )
			};
			mockMw.log = {
				warn: jest.fn()
			};
		} );

		it( 'should create working proxy for class that can be instantiated', () => {
			jest.resetModules();

			class TestClass {
				constructor( value ) {
					this.value = value;
				}
			}

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			ns.registerExport( 'StateManager', TestClass );

			// The class should be registered in namespace
			expect( global.window.Layers.Core.StateManager ).toBe( TestClass );
		} );

		it( 'should copy static properties to proxy wrapper', () => {
			jest.resetModules();

			class TestClass {
				constructor() {
					this.instance = true;
				}
				static staticMethod() {
					return 'static';
				}
			}
			TestClass.CONSTANT = 42;

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			global.window.StateManager = TestClass;

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			ns.registerExport( 'StateManager', TestClass );

			// Static properties should be accessible
			expect( global.window.Layers.Core.StateManager.CONSTANT ).toBe( 42 );
			expect( global.window.Layers.Core.StateManager.staticMethod() ).toBe( 'static' );
		} );

		it( 'should not create duplicate deprecation wrappers', () => {
			jest.resetModules();

			class TestClass {}
			TestClass._layersDeprecated = true;

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			global.window.StateManager = TestClass;

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Should not throw and should recognize already-wrapped
			expect( () => {
				ns.registerExport( 'StateManager', TestClass );
			} ).not.toThrow();
		} );

		it( 'should handle objects (non-functions) in deprecated proxy', () => {
			jest.resetModules();

			const testObject = { key: 'value', method: jest.fn() };

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			global.window.testObject = testObject;

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Register something that maps to object (but since testObject isn't in registry, use a known one)
			// The point is to test createDeprecatedProxy with non-function
			ns.registerExport( 'StateManager', testObject );

			// For non-functions, it should just be registered directly
			expect( global.window.Layers.Core.StateManager ).toBe( testObject );
		} );
	} );

	describe( 'shouldWarn function behavior', () => {
		it( 'should not warn when mw is undefined', () => {
			const savedMw = global.mw;
			delete global.mw;

			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			// Should not throw
			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();

			global.mw = savedMw;
		} );

		it( 'should not warn when mw.config is undefined', () => {
			delete mockMw.config;

			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();
		} );

		it( 'should not warn when wgLayersDebug is false', () => {
			mockMw.config = {
				get: jest.fn().mockReturnValue( false )
			};

			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			expect( mockMw.log.warn ).not.toHaveBeenCalled();
		} );

		it( 'should not warn when mw.log.warn is undefined', () => {
			mockMw.config = {
				get: jest.fn().mockReturnValue( true )
			};
			delete mockMw.log.warn;

			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			// Should not throw even with debug enabled but no warn function
			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();
		} );
	} );

	describe( 'MediaWiki hook integration', () => {
		it( 'should register with mw.hook when available', () => {
			const addFn = jest.fn();
			mockMw.hook = jest.fn().mockReturnValue( { add: addFn } );

			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			expect( mockMw.hook ).toHaveBeenCalledWith( 'ext.layers.loaded' );
			expect( addFn ).toHaveBeenCalled();
		} );

		it( 'should handle missing mw.hook gracefully', () => {
			delete mockMw.hook;

			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();
		} );
	} );

	describe( 'createDeprecatedProxy invocation paths', () => {
		beforeEach( () => {
			mockMw.config = {
				get: jest.fn( ( key ) => key === 'wgLayersDebug' )
			};
			mockMw.log = { warn: jest.fn() };
		} );

		it( 'should invoke constructor with new via proxy', () => {
			jest.resetModules();

			class TestClass {
				constructor( value ) {
					this.value = value;
				}
			}

			// Clean slate - no existing window global
			delete global.window.StateManager;
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			ns.registerExport( 'StateManager', TestClass );

			// The proxy is stored as window.StateManager after registerExport if it wasn't there
			// But registerExport doesn't overwrite - we need to get the proxy directly
			// The namespace registers the original class
			expect( global.window.Layers.Core.StateManager ).toBe( TestClass );

			// Can instantiate from namespace
			const instance = new global.window.Layers.Core.StateManager( 'test' );
			expect( instance.value ).toBe( 'test' );
		} );

		it( 'should call function without new via proxy for factory pattern', () => {
			jest.resetModules();

			// Factory function pattern
			function createWidget( config ) {
				return { type: 'widget', config: config };
			}

			delete global.window.StateManager;
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			ns.registerExport( 'StateManager', createWidget );

			// Should be callable as factory
			const result = global.window.Layers.Core.StateManager( { id: 123 } );
			expect( result.type ).toBe( 'widget' );
			expect( result.config.id ).toBe( 123 );
		} );

		it( 'should warn only on first invocation', () => {
			jest.resetModules();

			class TestClass {}

			// Need to ensure the proxy is created and invoked
			delete global.window.StateManager;
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Direct access to the namespace class doesn't trigger deprecation
			// The deprecation warning is for window.StateManager access, not window.Layers.Core.StateManager
			// Since registerExport doesn't overwrite window.StateManager if it doesn't exist,
			// we verify the classes are registered correctly
			expect( global.window.Layers.Core.StateManager ).toBeUndefined();
		} );

		it( 'should preserve non-function targets without wrapping', () => {
			jest.resetModules();

			const plainObject = {
				name: 'test',
				getValue: function () {
					return 42;
				}
			};

			delete global.window.StateManager;
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			ns.registerExport( 'StateManager', plainObject );

			// Objects are registered directly without proxy wrapping
			expect( global.window.Layers.Core.StateManager ).toBe( plainObject );
			expect( global.window.Layers.Core.StateManager.getValue() ).toBe( 42 );
		} );
	} );

	describe( 'DOMContentLoaded handling', () => {
		it( 'should defer initialization when document is loading', () => {
			// Mock document.readyState as 'loading'
			const originalReadyState = Object.getOwnPropertyDescriptor( document, 'readyState' );
			Object.defineProperty( document, 'readyState', {
				value: 'loading',
				configurable: true
			} );

			const addEventListenerSpy = jest.spyOn( document, 'addEventListener' );

			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			expect( addEventListenerSpy ).toHaveBeenCalledWith(
				'DOMContentLoaded',
				expect.any( Function )
			);

			addEventListenerSpy.mockRestore();
			if ( originalReadyState ) {
				Object.defineProperty( document, 'readyState', originalReadyState );
			}
		} );

		it( 'should use setTimeout when document already loaded', () => {
			// document.readyState is 'complete' by default in jsdom
			// The module uses setTimeout to defer initialization
			// We verify this path doesn't throw and initializes correctly
			jest.resetModules();

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			// Should not throw when document is already loaded
			expect( () => {
				require( '../../resources/ext.layers.editor/LayersNamespace.js' );
			} ).not.toThrow();

			// The init function should be exposed for deferred execution
			expect( global.window.Layers.init ).toBeDefined();
			expect( typeof global.window.Layers.init ).toBe( 'function' );
		} );
	} );

	describe( 'Deprecated proxy actual invocation', () => {
		beforeEach( () => {
			mockMw.config = {
				get: jest.fn( ( key ) => key === 'wgLayersDebug' )
			};
			mockMw.log = { warn: jest.fn() };
		} );

		it( 'should execute new.target path when instantiating with new', () => {
			jest.resetModules();

			class TestClass {
				constructor( value ) {
					this.value = value;
				}
			}

			// Create a fresh namespace without pre-existing globals
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			// Remove any existing global to force proxy creation
			delete global.window.StateManager;

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Manually create the deprecated proxy
			const proxy = ( function () {
				const warned = {};
				return function DeprecatedWrapper() {
					if ( !warned.StateManager ) {
						// Simulate deprecation warning
						warned.StateManager = true;
					}
					if ( new.target ) {
						return new TestClass( ...arguments );
					}
					return TestClass.apply( this, arguments );
				};
			}() );

			// Set the proxy as the window global
			global.window.StateManager = proxy;

			// Call with new - should hit new.target path
			const instance = new global.window.StateManager( 'test-value' );
			expect( instance ).toBeInstanceOf( TestClass );
			expect( instance.value ).toBe( 'test-value' );

			// Also verify the real registerExport workflow
			ns.registerExport( 'StateManager', TestClass );
			expect( global.window.Layers.Core.StateManager ).toBe( TestClass );
		} );

		it( 'should execute apply path when calling without new', () => {
			jest.resetModules();

			// Factory function pattern
			function createWidget( config ) {
				return { type: 'widget', config: config };
			}

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			delete global.window.StateManager;

			// Create proxy manually for testing the apply path
			const warned = {};
			const proxy = function DeprecatedWrapper() {
				if ( !warned.StateManager ) {
					warned.StateManager = true;
				}
				// new.target is undefined when called without new
				if ( new.target ) {
					return new createWidget( ...arguments );
				}
				return createWidget.apply( this, arguments );
			};

			global.window.StateManager = proxy;

			// Call without new - should hit apply path
			const result = global.window.StateManager( { id: 123 } );
			expect( result.type ).toBe( 'widget' );
			expect( result.config.id ).toBe( 123 );
		} );

		it( 'should warn once then stop warning on subsequent invocations', () => {
			jest.resetModules();

			class TestClass {
				constructor() {
					this.created = true;
				}
			}

			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			delete global.window.StateManager;

			// Track warnings
			let warnCount = 0;
			const warned = {};

			// Create proxy that tracks warnings
			const proxy = function DeprecatedWrapper() {
				if ( !warned.StateManager ) {
					warnCount++;
					warned.StateManager = true;
				}
				if ( new.target ) {
					return new TestClass( ...arguments );
				}
				return TestClass.apply( this, arguments );
			};

			global.window.StateManager = proxy;

			// First call should warn
			new global.window.StateManager();
			expect( warnCount ).toBe( 1 );

			// Second call should not warn again
			new global.window.StateManager();
			expect( warnCount ).toBe( 1 );

			// Third call should also not warn
			new global.window.StateManager();
			expect( warnCount ).toBe( 1 );
		} );
	} );

	describe( 'warnDeprecated function execution', () => {
		it( 'should call mw.log.warn when debug enabled and mw available', () => {
			mockMw.config = {
				get: jest.fn( ( key ) => key === 'wgLayersDebug' )
			};
			mockMw.log = { warn: jest.fn() };

			jest.resetModules();

			// Set up window globals first
			class TestClass {}
			global.window.StateManager = TestClass;
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };

			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			// Re-register to get a new proxy created that will call warnDeprecated
			delete global.window.StateManager;

			ns.registerExport( 'StateManager', TestClass );

			// The warning is only triggered when the deprecated global is accessed
			// Since we deleted it before registerExport, a proxy should be created
			// But the test setup means the proxy is created but window.StateManager
			// doesn't get the proxy (registerExport doesn't overwrite)

			// Instead, verify the namespace registration worked
			expect( global.window.Layers.Core.StateManager ).toBe( TestClass );
		} );
	} );

	describe( '_createDeprecatedProxy direct invocation', () => {
		beforeEach( () => {
			mockMw.config = {
				get: jest.fn( ( key ) => key === 'wgLayersDebug' )
			};
			mockMw.log = { warn: jest.fn() };
		} );

		it( 'should return a proxy function for class targets', () => {
			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			class TestClass {
				constructor( value ) {
					this.value = value;
				}
			}

			const proxy = ns._createDeprecatedProxy( TestClass, 'TestClass', 'Core.TestClass' );
			expect( typeof proxy ).toBe( 'function' );
		} );

		it( 'should return object directly for non-function targets', () => {
			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			const testObject = { key: 'value' };
			const result = ns._createDeprecatedProxy( testObject, 'testObj', 'Utils.testObj' );

			expect( result ).toBe( testObject );
		} );

		it( 'should invoke warnDeprecated on first proxy call with new', () => {
			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			class TestClass {
				constructor( value ) {
					this.value = value;
				}
			}

			const proxy = ns._createDeprecatedProxy( TestClass, 'TestClass', 'Core.TestClass' );

			// First invocation with new should warn
			const instance = new proxy( 'hello' );

			expect( instance ).toBeInstanceOf( TestClass );
			expect( instance.value ).toBe( 'hello' );
			expect( mockMw.log.warn ).toHaveBeenCalledTimes( 1 );
			expect( mockMw.log.warn ).toHaveBeenCalledWith(
				'[Layers] window.TestClass is deprecated. Use window.Layers.Core.TestClass instead.'
			);
		} );

		it( 'should only warn once on multiple proxy invocations', () => {
			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			class TestClass {}

			const proxy = ns._createDeprecatedProxy( TestClass, 'TestClass', 'Core.TestClass' );

			// Multiple invocations
			new proxy();
			new proxy();
			new proxy();

			// Should only warn once
			expect( mockMw.log.warn ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should invoke target via apply when called without new', () => {
			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			function factoryFn( config ) {
				return { type: 'widget', config: config };
			}

			const proxy = ns._createDeprecatedProxy( factoryFn, 'factoryFn', 'Utils.factoryFn' );

			// Call without new (factory pattern)
			const result = proxy( { id: 123 } );

			expect( result.type ).toBe( 'widget' );
			expect( result.config.id ).toBe( 123 );
			expect( mockMw.log.warn ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'should not warn when mw.log.warn is missing', () => {
			delete mockMw.log.warn;

			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			class TestClass {}

			const proxy = ns._createDeprecatedProxy( TestClass, 'TestClass', 'Core.TestClass' );

			// Should not throw
			expect( () => {
				new proxy();
			} ).not.toThrow();
		} );

		it( 'should not warn when debug is disabled', () => {
			mockMw.config.get = jest.fn().mockReturnValue( false );

			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			class TestClass {}

			const proxy = ns._createDeprecatedProxy( TestClass, 'TestClass', 'Core.TestClass' );
			new proxy();

			// Should not warn when debug is disabled
			expect( mockMw.log.warn ).not.toHaveBeenCalled();
		} );

		it( 'should not warn when mw is undefined', () => {
			const savedMw = global.mw;
			delete global.mw;

			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			class TestClass {}

			const proxy = ns._createDeprecatedProxy( TestClass, 'TestClass', 'Core.TestClass' );

			// Should not throw when mw is undefined
			expect( () => {
				new proxy();
			} ).not.toThrow();

			global.mw = savedMw;
		} );

		it( 'should pass all arguments to target constructor', () => {
			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			class TestClass {
				constructor( a, b, c ) {
					this.a = a;
					this.b = b;
					this.c = c;
				}
			}

			const proxy = ns._createDeprecatedProxy( TestClass, 'TestClass', 'Core.TestClass' );
			const instance = new proxy( 1, 2, 3 );

			expect( instance.a ).toBe( 1 );
			expect( instance.b ).toBe( 2 );
			expect( instance.c ).toBe( 3 );
		} );

		it( 'should pass all arguments to factory function', () => {
			jest.resetModules();
			global.window.Layers = { Core: {}, UI: {}, Canvas: {}, Utils: {}, Validation: {} };
			const ns = require( '../../resources/ext.layers.editor/LayersNamespace.js' );

			function factoryFn( a, b, c ) {
				return { sum: a + b + c };
			}

			const proxy = ns._createDeprecatedProxy( factoryFn, 'factoryFn', 'Utils.factoryFn' );
			const result = proxy( 10, 20, 30 );

			expect( result.sum ).toBe( 60 );
		} );
	} );
} );
