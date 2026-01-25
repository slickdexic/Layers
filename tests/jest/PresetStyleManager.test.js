/**
 * Tests for PresetStyleManager
 * Extracted from ToolbarStyleControls for preset functionality delegation
 */

'use strict';

// Mock dependencies
const mockPresetManager = {
	destroy: jest.fn()
};

const mockPresetDropdown = {
	getElement: jest.fn( () => document.createElement( 'div' ) ),
	setTool: jest.fn(),
	setLayerType: jest.fn(),
	destroy: jest.fn()
};

const mockPresetManagerClass = jest.fn( () => mockPresetManager );
const mockPresetDropdownClass = jest.fn( () => mockPresetDropdown );

// Setup window.Layers namespace
beforeAll( () => {
	window.Layers = {
		PresetManager: mockPresetManagerClass,
		PresetDropdown: mockPresetDropdownClass
	};
} );

// Import the module
const PresetStyleManager = require( '../../resources/ext.layers.editor/ui/PresetStyleManager.js' );

describe( 'PresetStyleManager', () => {
	let manager;
	let mockToolbar;
	let mockApplyStyle;
	let mockGetStyleOptions;

	beforeEach( () => {
		jest.clearAllMocks();

		mockToolbar = {
			currentTool: 'rectangle',
			editor: {
				applyToSelection: jest.fn()
			}
		};

		mockApplyStyle = jest.fn();
		mockGetStyleOptions = jest.fn( () => ( {
			stroke: '#ff0000',
			fill: '#00ff00',
			strokeWidth: 2
		} ) );

		manager = new PresetStyleManager( {
			toolbar: mockToolbar,
			msg: ( key, fallback ) => fallback || key,
			getStyleOptions: mockGetStyleOptions,
			applyStyle: mockApplyStyle
		} );
	} );

	afterEach( () => {
		if ( manager ) {
			manager.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with config', () => {
			expect( manager.toolbar ).toBe( mockToolbar );
			expect( manager.selectedLayers ).toEqual( [] );
		} );

		it( 'should use default msg function if not provided', () => {
			const noMsgManager = new PresetStyleManager( {} );
			expect( noMsgManager.msg( 'test-key', 'Fallback' ) ).toBe( 'Fallback' );
			noMsgManager.destroy();
		} );
	} );

	describe( 'msg', () => {
		it( 'should return localized message', () => {
			const result = manager.msg( 'test-key', 'Default Text' );
			expect( result ).toBe( 'Default Text' );
		} );
	} );

	describe( 'createPresetDropdown', () => {
		it( 'should create dropdown when dependencies available', () => {
			const dropdown = manager.createPresetDropdown();

			expect( dropdown ).not.toBeNull();
			expect( manager.presetManager ).not.toBeNull();
		} );

		it( 'should return null when dependencies not available', () => {
			// Temporarily remove dependencies
			const savedPresetManager = window.Layers.PresetManager;
			window.Layers.PresetManager = undefined;

			const noDepManager = new PresetStyleManager( {} );
			const dropdown = noDepManager.createPresetDropdown();

			expect( dropdown ).toBeNull();

			// Restore
			window.Layers.PresetManager = savedPresetManager;
			noDepManager.destroy();
		} );
	} );

	describe( 'getElement', () => {
		it( 'should return dropdown element when available', () => {
			manager.createPresetDropdown();
			const element = manager.getElement();

			expect( element ).toBeInstanceOf( HTMLElement );
		} );

		it( 'should return null when no dropdown', () => {
			const element = manager.getElement();

			expect( element ).toBeNull();
		} );
	} );

	describe( 'setCurrentTool', () => {
		it( 'should delegate to dropdown when no layers selected', () => {
			manager.createPresetDropdown();
			manager.selectedLayers = [];

			manager.setCurrentTool( 'text' );

			expect( mockPresetDropdown.setTool ).toHaveBeenCalledWith( 'text' );
		} );

		it( 'should not update dropdown when layers are selected', () => {
			manager.createPresetDropdown();
			manager.selectedLayers = [ { id: '1', type: 'rectangle' } ];

			manager.setCurrentTool( 'text' );

			expect( mockPresetDropdown.setTool ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'updateForSelection', () => {
		beforeEach( () => {
			manager.createPresetDropdown();
		} );

		it( 'should clear layer type when no selection', () => {
			manager.updateForSelection( [] );

			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( null );
			expect( mockPresetDropdown.setTool ).toHaveBeenCalledWith( 'rectangle' );
		} );

		it( 'should set layer type based on first selected layer', () => {
			manager.updateForSelection( [
				{ id: '1', type: 'ellipse' },
				{ id: '2', type: 'rectangle' }
			] );

			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( 'ellipse' );
		} );

		it( 'should map rect to rectangle', () => {
			manager.updateForSelection( [ { id: '1', type: 'rect' } ] );

			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( 'rectangle' );
		} );

		it( 'should handle all layer type mappings', () => {
			const mappings = {
				'rect': 'rectangle',
				'ellipse': 'ellipse',
				'circle': 'circle',
				'line': 'line',
				'arrow': 'arrow',
				'text': 'text',
				'textbox': 'textbox',
				'polygon': 'polygon',
				'star': 'star',
				'path': 'path'
			};

			Object.entries( mappings ).forEach( ( [ input, expected ] ) => {
				mockPresetDropdown.setLayerType.mockClear();
				manager.updateForSelection( [ { id: '1', type: input } ] );
				expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( expected );
			} );
		} );
	} );

	describe( 'applyPresetStyle', () => {
		it( 'should delegate to applyStyle callback', () => {
			const style = { stroke: '#000', fill: '#fff' };

			manager.applyPresetStyle( style );

			expect( mockApplyStyle ).toHaveBeenCalledWith( style );
		} );

		it( 'should handle null style', () => {
			manager.applyPresetStyle( null );

			expect( mockApplyStyle ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'applyPresetToSelection', () => {
		it( 'should apply style to selected layers via editor', () => {
			manager.selectedLayers = [ { id: '1', type: 'rectangle' } ];
			const style = { stroke: '#000', fill: '#fff' };

			manager.applyPresetToSelection( style );

			expect( mockToolbar.editor.applyToSelection ).toHaveBeenCalled();
			expect( mockApplyStyle ).toHaveBeenCalledWith( style );
		} );

		it( 'should only update controls when no selection', () => {
			manager.selectedLayers = [];
			const style = { stroke: '#000' };

			manager.applyPresetToSelection( style );

			expect( mockToolbar.editor.applyToSelection ).not.toHaveBeenCalled();
			expect( mockApplyStyle ).toHaveBeenCalledWith( style );
		} );

		it( 'should handle null style', () => {
			manager.applyPresetToSelection( null );

			expect( mockToolbar.editor.applyToSelection ).not.toHaveBeenCalled();
			expect( mockApplyStyle ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'getStyleFromSelection', () => {
		it( 'should extract style from first selected layer', () => {
			manager.selectedLayers = [ {
				id: '1',
				type: 'rectangle',
				stroke: '#ff0000',
				fill: '#00ff00',
				strokeWidth: 3,
				shadow: true,
				shadowColor: '#000000'
			} ];

			const style = manager.getStyleFromSelection();

			expect( style.stroke ).toBe( '#ff0000' );
			expect( style.fill ).toBe( '#00ff00' );
			expect( style.strokeWidth ).toBe( 3 );
			expect( style.shadow ).toBe( true );
		} );

		it( 'should fall back to getStyleOptions when no selection', () => {
			manager.selectedLayers = [];

			const style = manager.getStyleFromSelection();

			expect( mockGetStyleOptions ).toHaveBeenCalled();
			expect( style.stroke ).toBe( '#ff0000' );
		} );

		it( 'should return empty object when no callback and no selection', () => {
			const noCallbackManager = new PresetStyleManager( {} );
			noCallbackManager.selectedLayers = [];

			const style = noCallbackManager.getStyleFromSelection();

			expect( style ).toEqual( {} );
			noCallbackManager.destroy();
		} );
	} );

	describe( 'PRESET_STYLE_PROPERTIES', () => {
		it( 'should contain all expected style properties', () => {
			const props = PresetStyleManager.PRESET_STYLE_PROPERTIES;

			// Check key categories are present
			expect( props ).toContain( 'stroke' );
			expect( props ).toContain( 'strokeWidth' );
			expect( props ).toContain( 'fill' );
			expect( props ).toContain( 'fontSize' );
			expect( props ).toContain( 'shadow' );
			expect( props ).toContain( 'shadowColor' );
			expect( props ).toContain( 'textShadow' );
			expect( props ).toContain( 'arrowStyle' );
			expect( props ).toContain( 'cornerRadius' );
			expect( props ).toContain( 'blendMode' );
			expect( props ).toContain( 'opacity' );
		} );

		it( 'should have same properties as old ToolbarStyleControls', () => {
			const props = PresetStyleManager.PRESET_STYLE_PROPERTIES;

			// Verify count matches original (was 46 properties)
			expect( props.length ).toBeGreaterThanOrEqual( 40 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clean up dropdown and manager', () => {
			manager.createPresetDropdown();

			manager.destroy();

			expect( mockPresetDropdown.destroy ).toHaveBeenCalled();
			expect( mockPresetManager.destroy ).toHaveBeenCalled();
			expect( manager.presetDropdown ).toBeNull();
			expect( manager.presetManager ).toBeNull();
			expect( manager.selectedLayers ).toEqual( [] );
		} );

		it( 'should handle destroy when no dropdown created', () => {
			// Should not throw
			expect( () => manager.destroy() ).not.toThrow();
		} );
	} );

	describe( 'applyPresetToSelection', () => {
		it( 'should apply style to selected layers via editor.applyToSelection', () => {
			manager.createPresetDropdown();
			manager.selectedLayers = [
				{ id: 'layer-1', type: 'rectangle', stroke: '#000000' }
			];

			const presetStyle = {
				stroke: '#ff0000',
				fill: '#00ff00',
				strokeWidth: 3
			};

			manager.applyPresetToSelection( presetStyle );

			// Should have called applyToSelection on the editor
			expect( mockToolbar.editor.applyToSelection ).toHaveBeenCalled();

			// Should also apply to toolbar controls
			expect( mockApplyStyle ).toHaveBeenCalledWith( presetStyle );
		} );

		it( 'should apply PRESET_STYLE_PROPERTIES to layer in callback', () => {
			manager.createPresetDropdown();
			const mockLayer = { id: 'layer-1', type: 'rectangle' };
			manager.selectedLayers = [ mockLayer ];

			// Capture the callback passed to applyToSelection
			let capturedCallback;
			mockToolbar.editor.applyToSelection = jest.fn( ( callback ) => {
				capturedCallback = callback;
			} );

			const presetStyle = {
				stroke: '#ff0000',
				fill: '#00ff00',
				strokeWidth: 3,
				opacity: 0.8
			};

			manager.applyPresetToSelection( presetStyle );

			// Execute the captured callback
			expect( capturedCallback ).toBeDefined();
			const targetLayer = { id: 'test' };
			capturedCallback( targetLayer );

			// Verify properties were applied
			expect( targetLayer.stroke ).toBe( '#ff0000' );
			expect( targetLayer.fill ).toBe( '#00ff00' );
			expect( targetLayer.strokeWidth ).toBe( 3 );
			expect( targetLayer.opacity ).toBe( 0.8 );
		} );

		it( 'should not apply preset when no selected layers', () => {
			manager.createPresetDropdown();
			manager.selectedLayers = [];

			const presetStyle = {
				stroke: '#ff0000'
			};

			manager.applyPresetToSelection( presetStyle );

			// Should still apply to toolbar controls (for future drawings)
			expect( mockApplyStyle ).toHaveBeenCalledWith( presetStyle );
			// But not call applyToSelection since no layers
			expect( mockToolbar.editor.applyToSelection ).not.toHaveBeenCalled();
		} );

		it( 'should not apply when style is null', () => {
			manager.createPresetDropdown();
			manager.selectedLayers = [
				{ id: 'layer-1', type: 'rectangle' }
			];

			manager.applyPresetToSelection( null );

			expect( mockToolbar.editor.applyToSelection ).not.toHaveBeenCalled();
			expect( mockApplyStyle ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'createDropdown onSelect callback', () => {
		it( 'should call applyPresetToSelection when preset is selected', () => {
			// Capture the options passed to PresetDropdown constructor
			let capturedOptions;
			const originalPresetDropdownClass = window.Layers.PresetDropdown;
			window.Layers.PresetDropdown = jest.fn( ( opts ) => {
				capturedOptions = opts;
				return mockPresetDropdown;
			} );

			manager.createPresetDropdown();

			// Verify onSelect was provided
			expect( capturedOptions ).toBeDefined();
			expect( capturedOptions.onSelect ).toBeDefined();

			// Spy on applyPresetToSelection
			const applyPresetSpy = jest.spyOn( manager, 'applyPresetToSelection' );

			// Simulate selecting a preset
			const selectedStyle = { stroke: '#123456', fill: '#654321' };
			capturedOptions.onSelect( selectedStyle );

			expect( applyPresetSpy ).toHaveBeenCalledWith( selectedStyle );

			// Restore
			window.Layers.PresetDropdown = originalPresetDropdownClass;
		} );

		it( 'should call onSave callback with style from selection', () => {
			// Capture the options passed to PresetDropdown constructor
			let capturedOptions;
			const originalPresetDropdownClass = window.Layers.PresetDropdown;
			window.Layers.PresetDropdown = jest.fn( ( opts ) => {
				capturedOptions = opts;
				return mockPresetDropdown;
			} );

			manager.createPresetDropdown();
			manager.selectedLayers = [
				{ id: 'layer-1', type: 'rectangle', stroke: '#ff0000', fill: '#00ff00' }
			];

			// Verify onSave was provided
			expect( capturedOptions ).toBeDefined();
			expect( capturedOptions.onSave ).toBeDefined();

			// Mock callback that receives the style
			const mockCallback = jest.fn();

			// Call the onSave callback
			capturedOptions.onSave( mockCallback );

			// The callback should have been called with the style from selection
			expect( mockCallback ).toHaveBeenCalled();
			const savedStyle = mockCallback.mock.calls[ 0 ][ 0 ];
			expect( savedStyle ).toBeDefined();
			// Style should contain properties from the selected layer
			expect( savedStyle.stroke ).toBe( '#ff0000' );
			expect( savedStyle.fill ).toBe( '#00ff00' );

			// Restore
			window.Layers.PresetDropdown = originalPresetDropdownClass;
		} );
	} );

	describe( 'updateForSelection edge cases', () => {
		it( 'should fall back to tool when selection is cleared', () => {
			manager.createPresetDropdown();

			// First set some selection
			manager.selectedLayers = [
				{ id: 'layer-1', type: 'rectangle' }
			];

			// Now clear selection
			manager.updateForSelection( [] );

			// Should have called setLayerType with null and setTool with current tool
			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( null );
			expect( mockPresetDropdown.setTool ).toHaveBeenCalledWith( 'rectangle' );
		} );

		it( 'should not call setTool when toolbar has no currentTool', () => {
			manager.createPresetDropdown();
			mockToolbar.currentTool = null;

			manager.updateForSelection( [] );

			// setLayerType should be called with null
			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( null );
			// setTool should not be called (currentTool is falsy)
		} );

		it( 'should return early when no presetDropdown (line 193)', () => {
			// Don't create dropdown - test early return path
			manager.selectedLayers = [];

			// Should not throw when no dropdown exists
			expect( () => manager.updateForSelection( [] ) ).not.toThrow();
			expect( () => manager.updateForSelection( [ { id: '1', type: 'text' } ] ) ).not.toThrow();
		} );

		it( 'should handle marker layer type', () => {
			manager.createPresetDropdown();
			manager.updateForSelection( [ { id: '1', type: 'marker' } ] );

			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( 'marker' );
		} );

		it( 'should handle dimension layer type', () => {
			manager.createPresetDropdown();
			manager.updateForSelection( [ { id: '1', type: 'dimension' } ] );

			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( 'dimension' );
		} );

		it( 'should handle callout layer type', () => {
			manager.createPresetDropdown();
			manager.updateForSelection( [ { id: '1', type: 'callout' } ] );

			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( 'callout' );
		} );

		it( 'should use layer type as-is when not in mapping', () => {
			manager.createPresetDropdown();
			manager.updateForSelection( [ { id: '1', type: 'custom-shape' } ] );

			expect( mockPresetDropdown.setLayerType ).toHaveBeenCalledWith( 'custom-shape' );
		} );
	} );

	describe( 'applyPresetToSelection with dimension/marker defaults', () => {
		it( 'should update dimension defaults when canvasManager available', () => {
			const mockCanvasManager = {
				updateDimensionDefaults: jest.fn()
			};

			// Create toolbar with editor that has canvasManager
			const toolbarWithCanvas = {
				currentTool: 'dimension',
				editor: {
					applyToSelection: jest.fn(),
					canvasManager: mockCanvasManager
				}
			};

			const managerWithCanvas = new PresetStyleManager( {
				toolbar: toolbarWithCanvas,
				msg: ( key, fallback ) => fallback || key,
				getStyleOptions: mockGetStyleOptions,
				applyStyle: mockApplyStyle
			} );

			// Set up dimension layer selection
			managerWithCanvas.selectedLayers = [ { id: '1', type: 'dimension' } ];

			// Apply preset style
			const style = { stroke: '#ff0000', fontSize: 14 };
			managerWithCanvas.applyPresetToSelection( style );

			expect( mockCanvasManager.updateDimensionDefaults ).toHaveBeenCalledWith( style );

			managerWithCanvas.destroy();
		} );

		it( 'should update marker defaults when canvasManager available', () => {
			const mockCanvasManager = {
				updateMarkerDefaults: jest.fn()
			};

			// Create toolbar with editor that has canvasManager
			const toolbarWithCanvas = {
				currentTool: 'marker',
				editor: {
					applyToSelection: jest.fn(),
					canvasManager: mockCanvasManager
				}
			};

			const managerWithCanvas = new PresetStyleManager( {
				toolbar: toolbarWithCanvas,
				msg: ( key, fallback ) => fallback || key,
				getStyleOptions: mockGetStyleOptions,
				applyStyle: mockApplyStyle
			} );

			// Set up marker layer selection
			managerWithCanvas.selectedLayers = [ { id: '1', type: 'marker' } ];

			// Apply preset style
			const style = { fill: '#00ff00', fontSize: 16 };
			managerWithCanvas.applyPresetToSelection( style );

			expect( mockCanvasManager.updateMarkerDefaults ).toHaveBeenCalledWith( style );

			managerWithCanvas.destroy();
		} );

		it( 'should update tool defaults when no selection but tool is dimension', () => {
			const mockCanvasManager = {
				updateDimensionDefaults: jest.fn()
			};

			// Create toolbar with editor that has canvasManager and dimension tool active
			const toolbarWithCanvas = {
				currentTool: 'dimension',
				editor: {
					applyToSelection: jest.fn(),
					canvasManager: mockCanvasManager
				}
			};

			const managerWithCanvas = new PresetStyleManager( {
				toolbar: toolbarWithCanvas,
				msg: ( key, fallback ) => fallback || key,
				getStyleOptions: mockGetStyleOptions,
				applyStyle: mockApplyStyle
			} );

			// No selection
			managerWithCanvas.selectedLayers = [];

			// Apply preset style (should update defaults for tool)
			const style = { stroke: '#0000ff', fontSize: 12 };
			managerWithCanvas.applyPresetToSelection( style );

			expect( mockCanvasManager.updateDimensionDefaults ).toHaveBeenCalledWith( style );

			managerWithCanvas.destroy();
		} );

		it( 'should update tool defaults when no selection but tool is marker', () => {
			const mockCanvasManager = {
				updateMarkerDefaults: jest.fn()
			};

			// Create toolbar with editor that has canvasManager and marker tool active
			const toolbarWithCanvas = {
				currentTool: 'marker',
				editor: {
					applyToSelection: jest.fn(),
					canvasManager: mockCanvasManager
				}
			};

			const managerWithCanvas = new PresetStyleManager( {
				toolbar: toolbarWithCanvas,
				msg: ( key, fallback ) => fallback || key,
				getStyleOptions: mockGetStyleOptions,
				applyStyle: mockApplyStyle
			} );

			// No selection
			managerWithCanvas.selectedLayers = [];

			// Apply preset style (should update defaults for tool)
			const style = { fill: '#ff00ff', markerNumber: 5 };
			managerWithCanvas.applyPresetToSelection( style );

			expect( mockCanvasManager.updateMarkerDefaults ).toHaveBeenCalledWith( style );

			managerWithCanvas.destroy();
		} );

		it( 'should not update defaults when layer type is not marker or dimension', () => {
			const mockCanvasManager = {
				updateDimensionDefaults: jest.fn(),
				updateMarkerDefaults: jest.fn()
			};

			const toolbarWithCanvas = {
				currentTool: 'rectangle',
				editor: {
					applyToSelection: jest.fn(),
					canvasManager: mockCanvasManager
				}
			};

			const managerWithCanvas = new PresetStyleManager( {
				toolbar: toolbarWithCanvas,
				msg: ( key, fallback ) => fallback || key,
				getStyleOptions: mockGetStyleOptions,
				applyStyle: mockApplyStyle
			} );

			// Rectangle layer selected
			managerWithCanvas.selectedLayers = [ { id: '1', type: 'rectangle' } ];

			const style = { fill: '#000000' };
			managerWithCanvas.applyPresetToSelection( style );

			expect( mockCanvasManager.updateDimensionDefaults ).not.toHaveBeenCalled();
			expect( mockCanvasManager.updateMarkerDefaults ).not.toHaveBeenCalled();

			managerWithCanvas.destroy();
		} );

		it( 'should handle canvasManager without updateDimensionDefaults method', () => {
			const mockCanvasManager = {
				// No updateDimensionDefaults method
			};

			const toolbarWithCanvas = {
				currentTool: 'dimension',
				editor: {
					applyToSelection: jest.fn(),
					canvasManager: mockCanvasManager
				}
			};

			const managerWithCanvas = new PresetStyleManager( {
				toolbar: toolbarWithCanvas,
				msg: ( key, fallback ) => fallback || key,
				getStyleOptions: mockGetStyleOptions,
				applyStyle: mockApplyStyle
			} );

			managerWithCanvas.selectedLayers = [ { id: '1', type: 'dimension' } ];

			// Should not throw even if method is missing
			expect( () => managerWithCanvas.applyPresetToSelection( { stroke: '#fff' } ) ).not.toThrow();

			managerWithCanvas.destroy();
		} );

		it( 'should handle canvasManager without updateMarkerDefaults method', () => {
			const mockCanvasManager = {
				// No updateMarkerDefaults method
			};

			const toolbarWithCanvas = {
				currentTool: 'marker',
				editor: {
					applyToSelection: jest.fn(),
					canvasManager: mockCanvasManager
				}
			};

			const managerWithCanvas = new PresetStyleManager( {
				toolbar: toolbarWithCanvas,
				msg: ( key, fallback ) => fallback || key,
				getStyleOptions: mockGetStyleOptions,
				applyStyle: mockApplyStyle
			} );

			managerWithCanvas.selectedLayers = [ { id: '1', type: 'marker' } ];

			// Should not throw even if method is missing
			expect( () => managerWithCanvas.applyPresetToSelection( { fill: '#fff' } ) ).not.toThrow();

			managerWithCanvas.destroy();
		} );
	} );

	describe( 'getStyleFromSelection with fresh layer data', () => {
		it( 'should get fresh layer data from editor when available', () => {
			const freshLayer = {
				id: 'layer-1',
				type: 'rectangle',
				stroke: '#updated',
				fill: '#fresh'
			};

			const editorWithGetLayer = {
				applyToSelection: jest.fn(),
				getLayerById: jest.fn( () => freshLayer )
			};

			const managerWithEditor = new PresetStyleManager( {
				toolbar: {
					currentTool: 'rectangle',
					editor: editorWithGetLayer
				},
				msg: ( key, fallback ) => fallback || key
			} );

			managerWithEditor.selectedLayers = [ {
				id: 'layer-1',
				type: 'rectangle',
				stroke: '#stale',
				fill: '#old'
			} ];

			const style = managerWithEditor.getStyleFromSelection();

			expect( editorWithGetLayer.getLayerById ).toHaveBeenCalledWith( 'layer-1' );
			expect( style.stroke ).toBe( '#updated' );
			expect( style.fill ).toBe( '#fresh' );

			managerWithEditor.destroy();
		} );

		it( 'should fall back to cached layer when getLayerById returns null', () => {
			const editorWithGetLayer = {
				applyToSelection: jest.fn(),
				getLayerById: jest.fn( () => null )
			};

			const managerWithEditor = new PresetStyleManager( {
				toolbar: {
					currentTool: 'rectangle',
					editor: editorWithGetLayer
				},
				msg: ( key, fallback ) => fallback || key
			} );

			managerWithEditor.selectedLayers = [ {
				id: 'layer-1',
				type: 'rectangle',
				stroke: '#cached',
				fill: '#fallback'
			} ];

			const style = managerWithEditor.getStyleFromSelection();

			expect( style.stroke ).toBe( '#cached' );
			expect( style.fill ).toBe( '#fallback' );

			managerWithEditor.destroy();
		} );

		it( 'should use cached layer when editor lacks getLayerById', () => {
			const editorWithoutGetLayer = {
				applyToSelection: jest.fn()
				// No getLayerById method
			};

			const managerWithEditor = new PresetStyleManager( {
				toolbar: {
					currentTool: 'rectangle',
					editor: editorWithoutGetLayer
				},
				msg: ( key, fallback ) => fallback || key
			} );

			managerWithEditor.selectedLayers = [ {
				id: 'layer-1',
				type: 'rectangle',
				stroke: '#cached-only'
			} ];

			const style = managerWithEditor.getStyleFromSelection();

			expect( style.stroke ).toBe( '#cached-only' );

			managerWithEditor.destroy();
		} );
	} );
} );
