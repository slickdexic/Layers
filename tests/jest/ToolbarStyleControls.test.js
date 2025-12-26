/**
 * Tests for ToolbarStyleControls module
 */

'use strict';

// Mock ColorPickerDialog
const mockColorPickerOpen = jest.fn();
const mockUpdateColorButton = jest.fn();

// Setup namespace structure and load NamespaceHelper BEFORE requiring ToolbarStyleControls
window.Layers = window.Layers || {};
window.Layers.Utils = window.Layers.Utils || {};
window.Layers.UI = window.Layers.UI || {};
require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

// Load TextEffectsControls first (dependency of ToolbarStyleControls)
require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );

window.Layers.UI.ColorPickerDialog = jest.fn( function ( config ) {
	this.config = config;
	this.open = mockColorPickerOpen;
} );
window.Layers.UI.ColorPickerDialog.updateColorButton = mockUpdateColorButton;

const ToolbarStyleControls = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );

describe( 'ToolbarStyleControls', () => {
	let styleControls;
	let mockToolbar;
	let mockMsg;

	beforeEach( () => {
		jest.clearAllMocks();

		mockMsg = jest.fn( ( key, fallback ) => fallback || key );
		mockToolbar = {
			registerDialogCleanup: jest.fn(),
			onStyleChange: jest.fn(),
			updateColorButtonDisplay: jest.fn()
		};

		styleControls = new ToolbarStyleControls( {
			toolbar: mockToolbar,
			msg: mockMsg
		} );
	} );

	afterEach( () => {
		if ( styleControls ) {
			styleControls.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default config', () => {
			const controls = new ToolbarStyleControls();
			expect( controls.strokeColorValue ).toBe( '#000000' );
			expect( controls.fillColorValue ).toBe( '#ffffff' );
			expect( controls.strokeColorNone ).toBe( false );
			expect( controls.fillColorNone ).toBe( false );
			expect( controls.currentStrokeWidth ).toBe( 2.0 );
		} );

		it( 'should accept custom config', () => {
			expect( styleControls.toolbar ).toBe( mockToolbar );
			expect( styleControls.msgFn ).toBe( mockMsg );
		} );

		it( 'should use fallback msg function if none provided', () => {
			const controls = new ToolbarStyleControls( {} );
			expect( controls.msg( 'test-key', 'fallback' ) ).toBe( 'fallback' );
		} );
	} );

	describe( 'msg', () => {
		it( 'should delegate to msgFn', () => {
			styleControls.msg( 'test-key', 'fallback' );
			expect( mockMsg ).toHaveBeenCalledWith( 'test-key', 'fallback' );
		} );

		it( 'should return fallback when key not found', () => {
			mockMsg.mockReturnValue( 'localized' );
			const result = styleControls.msg( 'some-key', 'default' );
			expect( result ).toBe( 'localized' );
		} );
	} );

	describe( 'create', () => {
		it( 'should create style group container', () => {
			const container = styleControls.create();
			expect( container ).toBeInstanceOf( HTMLElement );
			expect( container.className ).toBe( 'toolbar-group style-group' );
		} );

		it( 'should store container reference', () => {
			const container = styleControls.create();
			expect( styleControls.container ).toBe( container );
		} );

		it( 'should create main style row', () => {
			const container = styleControls.create();
			const row = container.querySelector( '.style-controls-row' );
			expect( row ).not.toBeNull();
		} );

		it( 'should create stroke color button', () => {
			styleControls.create();
			expect( styleControls.strokeColorButton ).toBeInstanceOf( HTMLElement );
			expect( styleControls.strokeColorButton.className ).toContain( 'stroke-color' );
		} );

		it( 'should create fill color button', () => {
			styleControls.create();
			expect( styleControls.fillColorButton ).toBeInstanceOf( HTMLElement );
			expect( styleControls.fillColorButton.className ).toContain( 'fill-color' );
		} );

		it( 'should create stroke width input', () => {
			styleControls.create();
			expect( styleControls.strokeWidthInput ).toBeInstanceOf( HTMLInputElement );
			expect( styleControls.strokeWidthInput.type ).toBe( 'number' );
		} );

		it( 'should create font size container (hidden) via delegate', () => {
			styleControls.create();
			expect( styleControls.textEffectsControls.fontSizeContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.textEffectsControls.fontSizeContainer.style.display ).toBe( 'none' );
		} );

		it( 'should create text stroke container (hidden) via delegate', () => {
			styleControls.create();
			expect( styleControls.textEffectsControls.textStrokeContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.textEffectsControls.textStrokeContainer.style.display ).toBe( 'none' );
		} );

		it( 'should create shadow container (hidden) via delegate', () => {
			styleControls.create();
			expect( styleControls.textEffectsControls.shadowContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.textEffectsControls.shadowContainer.style.display ).toBe( 'none' );
		} );

		it( 'should create arrow container (hidden)', () => {
			styleControls.create();
			expect( styleControls.arrowContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.arrowContainer.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'createColorControlFallback', () => {
		it( 'should create control with label and button', () => {
			const result = styleControls.createColorControlFallback( {
				type: 'test',
				label: 'Test Label',
				initialColor: '#ff0000',
				onColorChange: jest.fn()
			} );

			expect( result.container ).toBeInstanceOf( HTMLElement );
			expect( result.button ).toBeInstanceOf( HTMLButtonElement );
			expect( result.container.querySelector( '.style-control-label' ).textContent ).toBe( 'Test Label' );
		} );

		it( 'should set proper ARIA attributes', () => {
			const result = styleControls.createColorControlFallback( {
				type: 'stroke',
				label: 'Stroke',
				initialColor: '#000000',
				onColorChange: jest.fn()
			} );

			expect( result.button.getAttribute( 'aria-label' ) ).toBe( 'Stroke' );
			expect( result.button.getAttribute( 'aria-haspopup' ) ).toBe( 'dialog' );
			expect( result.button.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		} );
	} );

	describe( 'createStrokeWidthControl', () => {
		it( 'should create input with proper attributes', () => {
			const result = styleControls.createStrokeWidthControl();
			const input = result.input;

			expect( input.type ).toBe( 'number' );
			expect( input.min ).toBe( '0' );
			expect( input.max ).toBe( '100' );
			expect( input.step ).toBe( '1' );
			expect( input.value ).toBe( '2' );
		} );
	} );

	describe( 'handleStrokeWidthInput', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should update stroke width for valid values', () => {
			const input = styleControls.strokeWidthInput;
			input.value = '5';
			styleControls.handleStrokeWidthInput( input );

			expect( styleControls.currentStrokeWidth ).toBe( 5 );
			expect( input.classList.contains( 'validation-error' ) ).toBe( false );
		} );

		it( 'should add validation error for invalid values', () => {
			const input = styleControls.strokeWidthInput;
			input.value = 'abc';
			styleControls.handleStrokeWidthInput( input );

			expect( input.classList.contains( 'validation-error' ) ).toBe( true );
		} );

		it( 'should add validation error for negative values', () => {
			const input = styleControls.strokeWidthInput;
			input.value = '-5';
			styleControls.handleStrokeWidthInput( input );

			expect( input.classList.contains( 'validation-error' ) ).toBe( true );
		} );

		it( 'should add validation error for values over 100', () => {
			const input = styleControls.strokeWidthInput;
			input.value = '150';
			styleControls.handleStrokeWidthInput( input );

			expect( input.classList.contains( 'validation-error' ) ).toBe( true );
		} );

		it( 'should notify style change on valid input', () => {
			const input = styleControls.strokeWidthInput;
			input.value = '10';
			styleControls.handleStrokeWidthInput( input );

			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );
	} );

	describe( 'handleStrokeWidthBlur', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should reset invalid value on blur', () => {
			const input = styleControls.strokeWidthInput;
			styleControls.currentStrokeWidth = 5;
			input.value = 'invalid';
			input.classList.add( 'validation-error' );

			styleControls.handleStrokeWidthBlur( input );

			expect( input.value ).toBe( '5' );
			expect( input.classList.contains( 'validation-error' ) ).toBe( false );
		} );

		it( 'should keep valid value on blur', () => {
			const input = styleControls.strokeWidthInput;
			input.value = '10';

			styleControls.handleStrokeWidthBlur( input );

			expect( input.value ).toBe( '10' );
		} );
	} );

	describe( 'getColorPickerStrings', () => {
		it( 'should return object with all required keys', () => {
			const strings = styleControls.getColorPickerStrings();

			expect( strings ).toHaveProperty( 'title' );
			expect( strings ).toHaveProperty( 'standard' );
			expect( strings ).toHaveProperty( 'saved' );
			expect( strings ).toHaveProperty( 'customSection' );
			expect( strings ).toHaveProperty( 'none' );
			expect( strings ).toHaveProperty( 'emptySlot' );
			expect( strings ).toHaveProperty( 'cancel' );
			expect( strings ).toHaveProperty( 'apply' );
			expect( strings ).toHaveProperty( 'transparent' );
			expect( strings ).toHaveProperty( 'swatchTemplate' );
			expect( strings ).toHaveProperty( 'previewTemplate' );
		} );

		it( 'should use msg function for localization', () => {
			styleControls.getColorPickerStrings();
			expect( mockMsg ).toHaveBeenCalled();
		} );
	} );

	describe( 'openColorPicker', () => {
		it( 'should create ColorPickerDialog with correct config', () => {
			const button = document.createElement( 'button' );
			const onApply = jest.fn();

			styleControls.openColorPicker( button, '#ff0000', { onApply } );

			expect( window.Layers.UI.ColorPickerDialog ).toHaveBeenCalled();
			const config = window.Layers.UI.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			expect( config.currentColor ).toBe( '#ff0000' );
			expect( config.anchorElement ).toBe( button );
		} );

		it( 'should handle none value', () => {
			const button = document.createElement( 'button' );
			styleControls.openColorPicker( button, 'none', {} );

			const config = window.Layers.UI.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			expect( config.currentColor ).toBe( 'none' );
		} );

		it( 'should call open on the picker', () => {
			const button = document.createElement( 'button' );
			styleControls.openColorPicker( button, '#000000', {} );

			expect( mockColorPickerOpen ).toHaveBeenCalled();
		} );

		it( 'should not throw if ColorPickerDialog not available', () => {
			const originalDialog = window.Layers.UI.ColorPickerDialog;
			window.Layers.UI.ColorPickerDialog = undefined;

			expect( () => {
				styleControls.openColorPicker( document.createElement( 'button' ), '#000', {} );
			} ).not.toThrow();

			window.Layers.UI.ColorPickerDialog = originalDialog;
		} );
	} );

	describe( 'updateColorButtonDisplay', () => {
		it( 'should delegate to ColorPickerDialog.updateColorButton', () => {
			const button = document.createElement( 'button' );
			styleControls.updateColorButtonDisplay( button, '#ff0000' );

			expect( mockUpdateColorButton ).toHaveBeenCalledWith(
				button,
				'#ff0000',
				expect.any( Object )
			);
		} );

		it( 'should use fallback when ColorPickerDialog not available', () => {
			const originalUpdateFn = window.Layers.UI.ColorPickerDialog.updateColorButton;
			window.Layers.UI.ColorPickerDialog.updateColorButton = undefined;

			const button = document.createElement( 'button' );
			styleControls.updateColorButtonDisplay( button, '#ff0000' );

			expect( button.style.background ).toBe( 'rgb(255, 0, 0)' );
			expect( button.classList.contains( 'is-transparent' ) ).toBe( false );

			window.Layers.UI.ColorPickerDialog.updateColorButton = originalUpdateFn;
		} );

		it( 'should handle transparent color in fallback', () => {
			const originalUpdateFn = window.Layers.UI.ColorPickerDialog.updateColorButton;
			window.Layers.UI.ColorPickerDialog.updateColorButton = undefined;

			const button = document.createElement( 'button' );
			styleControls.updateColorButtonDisplay( button, 'none' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );

			window.Layers.UI.ColorPickerDialog.updateColorButton = originalUpdateFn;
		} );
	} );

	describe( 'getStyleOptions', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should return current style options', () => {
			styleControls.strokeColorValue = '#ff0000';
			styleControls.fillColorValue = '#00ff00';
			styleControls.currentStrokeWidth = 5;

			const options = styleControls.getStyleOptions();

			expect( options.color ).toBe( '#ff0000' );
			expect( options.fill ).toBe( '#00ff00' );
			expect( options.strokeWidth ).toBe( 5 );
		} );

		it( 'should return transparent for none colors', () => {
			styleControls.strokeColorNone = true;
			styleControls.fillColorNone = true;

			const options = styleControls.getStyleOptions();

			expect( options.color ).toBe( 'transparent' );
			expect( options.fill ).toBe( 'transparent' );
		} );

		it( 'should include font size', () => {
			styleControls.textEffectsControls.fontSizeInput.value = '24';
			const options = styleControls.getStyleOptions();
			expect( options.fontSize ).toBe( 24 );
		} );

		it( 'should include text stroke options', () => {
			styleControls.textEffectsControls.textStrokeColor.value = '#0000ff';
			styleControls.textEffectsControls.textStrokeWidth.value = '3';

			const options = styleControls.getStyleOptions();

			expect( options.textStrokeColor ).toBe( '#0000ff' );
			expect( options.textStrokeWidth ).toBe( 3 );
		} );

		it( 'should include shadow options', () => {
			styleControls.textEffectsControls.textShadowToggle.checked = true;
			styleControls.textEffectsControls.textShadowColor.value = '#333333';

			const options = styleControls.getStyleOptions();

			expect( options.textShadow ).toBe( true );
			expect( options.shadow ).toBe( true );
			expect( options.textShadowColor ).toBe( '#333333' );
			expect( options.shadowColor ).toBe( '#333333' );
		} );

		it( 'should include arrow style', () => {
			styleControls.arrowStyleSelect.value = 'double';
			const options = styleControls.getStyleOptions();
			expect( options.arrowStyle ).toBe( 'double' );
		} );
	} );

	describe( 'updateForTool', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should show text options for text tool', () => {
			styleControls.updateForTool( 'text' );

			expect( styleControls.textEffectsControls.fontSizeContainer.style.display ).toBe( 'flex' );
			expect( styleControls.textEffectsControls.textStrokeContainer.style.display ).toBe( 'flex' );
			expect( styleControls.textEffectsControls.shadowContainer.style.display ).toBe( 'flex' );
			expect( styleControls.arrowContainer.style.display ).toBe( 'none' );
		} );

		it( 'should show arrow options for arrow tool', () => {
			styleControls.updateForTool( 'arrow' );

			expect( styleControls.textEffectsControls.fontSizeContainer.style.display ).toBe( 'none' );
			expect( styleControls.textEffectsControls.textStrokeContainer.style.display ).toBe( 'none' );
			expect( styleControls.textEffectsControls.shadowContainer.style.display ).toBe( 'none' );
			expect( styleControls.arrowContainer.style.display ).toBe( 'block' );
		} );

		it( 'should hide all extra options for other tools', () => {
			styleControls.updateForTool( 'rectangle' );

			expect( styleControls.textEffectsControls.fontSizeContainer.style.display ).toBe( 'none' );
			expect( styleControls.textEffectsControls.textStrokeContainer.style.display ).toBe( 'none' );
			expect( styleControls.textEffectsControls.shadowContainer.style.display ).toBe( 'none' );
			expect( styleControls.arrowContainer.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'setStrokeColor', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should set stroke color value', () => {
			styleControls.setStrokeColor( '#ff0000' );
			expect( styleControls.strokeColorValue ).toBe( '#ff0000' );
			expect( styleControls.strokeColorNone ).toBe( false );
		} );

		it( 'should handle none value', () => {
			styleControls.setStrokeColor( 'none' );
			expect( styleControls.strokeColorNone ).toBe( true );
		} );

		it( 'should handle transparent value', () => {
			styleControls.setStrokeColor( 'transparent' );
			expect( styleControls.strokeColorNone ).toBe( true );
		} );

		it( 'should update button display', () => {
			styleControls.setStrokeColor( '#00ff00' );
			expect( mockUpdateColorButton ).toHaveBeenCalledWith(
				styleControls.strokeColorButton,
				'#00ff00',
				expect.any( Object )
			);
		} );
	} );

	describe( 'setFillColor', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should set fill color value', () => {
			styleControls.setFillColor( '#0000ff' );
			expect( styleControls.fillColorValue ).toBe( '#0000ff' );
			expect( styleControls.fillColorNone ).toBe( false );
		} );

		it( 'should handle none value', () => {
			styleControls.setFillColor( 'none' );
			expect( styleControls.fillColorNone ).toBe( true );
		} );

		it( 'should update button display', () => {
			styleControls.setFillColor( '#ff00ff' );
			expect( mockUpdateColorButton ).toHaveBeenCalledWith(
				styleControls.fillColorButton,
				'#ff00ff',
				expect.any( Object )
			);
		} );
	} );

	describe( 'setStrokeWidth', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should set stroke width value', () => {
			styleControls.setStrokeWidth( 10 );
			expect( styleControls.currentStrokeWidth ).toBe( 10 );
			expect( styleControls.strokeWidthInput.value ).toBe( '10' );
		} );

		it( 'should clamp to minimum', () => {
			styleControls.setStrokeWidth( -5 );
			expect( styleControls.currentStrokeWidth ).toBe( 0 );
		} );

		it( 'should clamp to maximum', () => {
			styleControls.setStrokeWidth( 150 );
			expect( styleControls.currentStrokeWidth ).toBe( 100 );
		} );

		it( 'should round to integer', () => {
			styleControls.setStrokeWidth( 5.7 );
			expect( styleControls.currentStrokeWidth ).toBe( 6 );
		} );
	} );

	describe( 'notifyStyleChange', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should call toolbar.onStyleChange with style options', () => {
			styleControls.notifyStyleChange();
			expect( mockToolbar.onStyleChange ).toHaveBeenCalledWith(
				expect.objectContaining( {
					color: expect.any( String ),
					fill: expect.any( String ),
					strokeWidth: expect.any( Number )
				} )
			);
		} );

		it( 'should not throw if toolbar not set', () => {
			styleControls.toolbar = null;
			expect( () => styleControls.notifyStyleChange() ).not.toThrow();
		} );

		it( 'should not throw if onStyleChange not available', () => {
			styleControls.toolbar = {};
			expect( () => styleControls.notifyStyleChange() ).not.toThrow();
		} );
	} );

	describe( 'setupValidation', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should not throw if no validator provided', () => {
			expect( () => styleControls.setupValidation( null ) ).not.toThrow();
		} );

		it( 'should register validators for inputs', () => {
			const mockValidator = {
				createInputValidator: jest.fn( () => ( {} ) )
			};

			styleControls.setupValidation( mockValidator );

			expect( mockValidator.createInputValidator ).toHaveBeenCalled();
			expect( styleControls.inputValidators.length ).toBeGreaterThan( 0 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear references', () => {
			styleControls.create();
			styleControls.destroy();

			expect( styleControls.container ).toBeNull();
			expect( styleControls.strokeColorButton ).toBeNull();
			expect( styleControls.fillColorButton ).toBeNull();
			expect( styleControls.strokeWidthInput ).toBeNull();
			expect( styleControls.textEffectsControls ).toBeNull();
			expect( styleControls.inputValidators ).toEqual( [] );
		} );
	} );

	describe( 'addListener fallback', () => {
		it( 'should use direct addEventListener when EventTracker not available', () => {
			const controls = new ToolbarStyleControls( {
				toolbar: mockToolbar,
				msg: mockMsg
			} );
			controls.eventTracker = null;

			const element = document.createElement( 'button' );
			const handler = jest.fn();

			controls.addListener( element, 'click', handler );
			element.click();

			expect( handler ).toHaveBeenCalled();
		} );

		it( 'should skip if element is null', () => {
			expect( () => styleControls.addListener( null, 'click', jest.fn() ) ).not.toThrow();
		} );

		it( 'should skip if handler is not a function', () => {
			const element = document.createElement( 'button' );
			expect( () => styleControls.addListener( element, 'click', 'not-a-function' ) ).not.toThrow();
		} );
	} );

	describe( 'color button click handlers', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should open color picker when stroke color button is clicked', () => {
			const button = styleControls.strokeColorButton;
			button.click();

			expect( mockColorPickerOpen ).toHaveBeenCalled();
		} );

		it( 'should open color picker when fill color button is clicked', () => {
			const button = styleControls.fillColorButton;
			button.click();

			expect( mockColorPickerOpen ).toHaveBeenCalled();
		} );

		it( 'should update stroke color when color picker applies', () => {
			const button = styleControls.strokeColorButton;
			button.click();

			// Get the ColorPickerDialog constructor call
			const dialogConfig = window.Layers.UI.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			
			// Simulate applying a new color
			dialogConfig.onApply( '#ff0000' );

			expect( styleControls.strokeColorValue ).toBe( '#ff0000' );
			expect( styleControls.strokeColorNone ).toBe( false );
			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );

		it( 'should handle none value for stroke color', () => {
			const button = styleControls.strokeColorButton;
			button.click();

			const dialogConfig = window.Layers.UI.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			dialogConfig.onApply( 'none' );

			expect( styleControls.strokeColorNone ).toBe( true );
			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );

		it( 'should update fill color when color picker applies', () => {
			const button = styleControls.fillColorButton;
			button.click();

			const dialogConfig = window.Layers.UI.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			dialogConfig.onApply( '#00ff00' );

			expect( styleControls.fillColorValue ).toBe( '#00ff00' );
			expect( styleControls.fillColorNone ).toBe( false );
			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );

		it( 'should handle none value for fill color', () => {
			const button = styleControls.fillColorButton;
			button.click();

			const dialogConfig = window.Layers.UI.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			dialogConfig.onApply( 'none' );

			expect( styleControls.fillColorNone ).toBe( true );
			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );
	} );

	describe( 'stroke width input event handlers', () => {
		beforeEach( () => {
			styleControls.create();
		} );

		it( 'should update stroke width on input event', () => {
			const input = styleControls.strokeWidthInput;
			input.value = '10';
			
			const event = new Event( 'input' );
			input.dispatchEvent( event );

			expect( styleControls.currentStrokeWidth ).toBe( 10 );
		} );

		it( 'should handle blur event on stroke width input', () => {
			const input = styleControls.strokeWidthInput;
			input.value = 'invalid';
			
			const blurEvent = new Event( 'blur' );
			input.dispatchEvent( blurEvent );

			// Should reset to valid value
			expect( input.value ).toBe( '2' );
		} );
	} );

	describe( 'text stroke control event handlers', () => {
		beforeEach( () => {
			styleControls.create();
			styleControls.textEffectsControls.textStrokeContainer.style.display = 'block';
		} );

		it( 'should update text stroke color on change', () => {
			const colorInput = styleControls.textEffectsControls.textStrokeColor;
			colorInput.value = '#ff0000';
			
			const event = new Event( 'change' );
			colorInput.dispatchEvent( event );

			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );

		it( 'should update text stroke width on input', () => {
			const widthInput = styleControls.textEffectsControls.textStrokeWidth;
			widthInput.value = '5';
			
			const event = new Event( 'input' );
			widthInput.dispatchEvent( event );

			expect( styleControls.textEffectsControls.textStrokeValue.textContent ).toBe( '5' );
			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );
	} );

	describe( 'shadow control event handlers', () => {
		beforeEach( () => {
			styleControls.create();
			styleControls.textEffectsControls.shadowContainer.style.display = 'block';
		} );

		it( 'should show color input when shadow toggle is checked', () => {
			const toggle = styleControls.textEffectsControls.textShadowToggle;
			const colorInput = styleControls.textEffectsControls.textShadowColor;
			
			toggle.checked = true;
			const event = new Event( 'change' );
			toggle.dispatchEvent( event );

			expect( colorInput.style.display ).toBe( 'inline-block' );
			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );

		it( 'should hide color input when shadow toggle is unchecked', () => {
			const toggle = styleControls.textEffectsControls.textShadowToggle;
			const colorInput = styleControls.textEffectsControls.textShadowColor;
			
			toggle.checked = false;
			const event = new Event( 'change' );
			toggle.dispatchEvent( event );

			expect( colorInput.style.display ).toBe( 'none' );
		} );

		it( 'should notify style change when shadow color changes', () => {
			const colorInput = styleControls.textEffectsControls.textShadowColor;
			colorInput.value = '#ff0000';
			
			const event = new Event( 'change' );
			colorInput.dispatchEvent( event );

			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );
	} );

	describe( 'arrow style control event handlers', () => {
		beforeEach( () => {
			styleControls.create();
			styleControls.arrowContainer.style.display = 'block';
		} );

		it( 'should notify style change when arrow style changes', () => {
			const select = styleControls.arrowStyleSelect;
			select.value = 'circle';
			
			const event = new Event( 'change' );
			select.dispatchEvent( event );

			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );
	} );

	describe( 'font size input event handlers', () => {
		beforeEach( () => {
			styleControls.create();
			styleControls.textEffectsControls.fontSizeContainer.style.display = 'block';
		} );

		it( 'should notify style change on font size input', () => {
			const input = styleControls.textEffectsControls.fontSizeInput;
			input.value = '24';
			
			const event = new Event( 'input' );
			input.dispatchEvent( event );

			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
		} );
	} );

	describe( 'getClass fallback', () => {
		it( 'should work when window.Layers namespace exists but class does not', () => {
			// This is testing internal getClass behavior
			// Create a controls instance and verify it works with missing classes
			const originalEventTracker = window.Layers.Utils.EventTracker;
			window.Layers.Utils.EventTracker = undefined;

			const controls = new ToolbarStyleControls( {
				toolbar: mockToolbar,
				msg: mockMsg
			} );

			// Should fall back gracefully
			expect( controls.eventTracker ).toBeNull();

			window.Layers.Utils.EventTracker = originalEventTracker;
		} );
	} );

	describe( 'applyPresetStyleInternal', () => {
		it( 'should do nothing when style is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const origStroke = controls.strokeColorValue;
			controls.applyPresetStyleInternal( null );
			expect( controls.strokeColorValue ).toBe( origStroke );
		} );

		it( 'should apply stroke color from style', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { stroke: '#ff0000' } );
			expect( controls.strokeColorValue ).toBe( '#ff0000' );
			expect( controls.strokeColorNone ).toBe( false );
		} );

		it( 'should set strokeColorNone for transparent stroke', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { stroke: 'transparent' } );
			expect( controls.strokeColorNone ).toBe( true );
		} );

		it( 'should apply fill color from style', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { fill: '#00ff00' } );
			expect( controls.fillColorValue ).toBe( '#00ff00' );
			expect( controls.fillColorNone ).toBe( false );
		} );

		it( 'should set fillColorNone for none fill', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { fill: 'none' } );
			expect( controls.fillColorNone ).toBe( true );
		} );

		it( 'should apply strokeWidth from style', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { strokeWidth: 5 } );
			expect( controls.currentStrokeWidth ).toBe( 5 );
			expect( controls.strokeWidthInput.value ).toBe( '5' );
		} );

		it( 'should apply fontSize from style via delegate', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { fontSize: 24 } );
			expect( controls.textEffectsControls.fontSizeInput.value ).toBe( '24' );
		} );

		it( 'should apply arrowStyle from style', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { arrowStyle: 'double' } );
			expect( controls.arrowStyleSelect.value ).toBe( 'double' );
		} );
	} );

	describe( 'getCurrentStyle', () => {
		it( 'should return current style with all properties', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.strokeColorValue = '#123456';
			controls.strokeColorNone = false;
			controls.fillColorValue = '#654321';
			controls.fillColorNone = false;
			controls.currentStrokeWidth = 3;
			controls.textEffectsControls.fontSizeInput.value = '18';
			controls.arrowStyleSelect.value = 'single';

			const style = controls.getCurrentStyle();
			expect( style.stroke ).toBe( '#123456' );
			expect( style.fill ).toBe( '#654321' );
			expect( style.strokeWidth ).toBe( 3 );
			expect( style.fontSize ).toBe( 18 );
			expect( style.arrowStyle ).toBe( 'single' );
		} );

		it( 'should return transparent for none colors', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.strokeColorNone = true;
			controls.fillColorNone = true;

			const style = controls.getCurrentStyle();
			expect( style.stroke ).toBe( 'transparent' );
			expect( style.fill ).toBe( 'transparent' );
		} );
	} );

	describe( 'setCurrentTool', () => {
		it( 'should delegate to presetStyleManager when available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.presetStyleManager = { setCurrentTool: jest.fn() };
			controls.setCurrentTool( 'arrow' );
			expect( controls.presetStyleManager.setCurrentTool ).toHaveBeenCalledWith( 'arrow' );
		} );

		it( 'should not throw when presetStyleManager is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.presetStyleManager = null;
			expect( () => controls.setCurrentTool( 'text' ) ).not.toThrow();
		} );
	} );

	describe( 'updateForSelection', () => {
		it( 'should delegate to presetStyleManager when available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.presetStyleManager = { updateForSelection: jest.fn() };
			const layers = [ { id: '1', type: 'rectangle' } ];
			controls.updateForSelection( layers );
			expect( controls.presetStyleManager.updateForSelection ).toHaveBeenCalledWith( layers );
		} );

		it( 'should not throw when presetStyleManager is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.presetStyleManager = null;
			expect( () => controls.updateForSelection( [] ) ).not.toThrow();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export to window.Layers.UI namespace', () => {
			expect( window.Layers.UI.ToolbarStyleControls ).toBe( ToolbarStyleControls );
		} );

		it( 'should be a constructor function', () => {
			expect( typeof ToolbarStyleControls ).toBe( 'function' );
			expect( ToolbarStyleControls.prototype.create ).toBeDefined();
		} );
	} );
} );
