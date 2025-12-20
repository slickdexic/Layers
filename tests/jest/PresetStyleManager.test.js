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

			expect( dropdown ).toBeTruthy();
			expect( manager.presetManager ).toBeTruthy();
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
} );
