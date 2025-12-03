/**
 * Tests for ToolbarStyleControls module
 */

'use strict';

// Mock ColorPickerDialog
const mockColorPickerOpen = jest.fn();
const mockUpdateColorButton = jest.fn();

window.ColorPickerDialog = jest.fn( function ( config ) {
	this.config = config;
	this.open = mockColorPickerOpen;
} );
window.ColorPickerDialog.updateColorButton = mockUpdateColorButton;

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
			onStyleChange: jest.fn()
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

		it( 'should create font size container (hidden)', () => {
			styleControls.create();
			expect( styleControls.fontSizeContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.fontSizeContainer.style.display ).toBe( 'none' );
		} );

		it( 'should create text stroke container (hidden)', () => {
			styleControls.create();
			expect( styleControls.strokeContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.strokeContainer.style.display ).toBe( 'none' );
		} );

		it( 'should create shadow container (hidden)', () => {
			styleControls.create();
			expect( styleControls.shadowContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.shadowContainer.style.display ).toBe( 'none' );
		} );

		it( 'should create arrow container (hidden)', () => {
			styleControls.create();
			expect( styleControls.arrowContainer ).toBeInstanceOf( HTMLElement );
			expect( styleControls.arrowContainer.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'createColorControl', () => {
		it( 'should create control with label and button', () => {
			const result = styleControls.createColorControl( {
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
			const result = styleControls.createColorControl( {
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

			expect( window.ColorPickerDialog ).toHaveBeenCalled();
			const config = window.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			expect( config.currentColor ).toBe( '#ff0000' );
			expect( config.anchorElement ).toBe( button );
		} );

		it( 'should handle none value', () => {
			const button = document.createElement( 'button' );
			styleControls.openColorPicker( button, 'none', {} );

			const config = window.ColorPickerDialog.mock.calls[ 0 ][ 0 ];
			expect( config.currentColor ).toBe( 'none' );
		} );

		it( 'should call open on the picker', () => {
			const button = document.createElement( 'button' );
			styleControls.openColorPicker( button, '#000000', {} );

			expect( mockColorPickerOpen ).toHaveBeenCalled();
		} );

		it( 'should not throw if ColorPickerDialog not available', () => {
			const originalDialog = window.ColorPickerDialog;
			window.ColorPickerDialog = undefined;

			expect( () => {
				styleControls.openColorPicker( document.createElement( 'button' ), '#000', {} );
			} ).not.toThrow();

			window.ColorPickerDialog = originalDialog;
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
			const originalUpdateFn = window.ColorPickerDialog.updateColorButton;
			window.ColorPickerDialog.updateColorButton = undefined;

			const button = document.createElement( 'button' );
			styleControls.updateColorButtonDisplay( button, '#ff0000' );

			expect( button.style.background ).toBe( 'rgb(255, 0, 0)' );
			expect( button.classList.contains( 'is-transparent' ) ).toBe( false );

			window.ColorPickerDialog.updateColorButton = originalUpdateFn;
		} );

		it( 'should handle transparent color in fallback', () => {
			const originalUpdateFn = window.ColorPickerDialog.updateColorButton;
			window.ColorPickerDialog.updateColorButton = undefined;

			const button = document.createElement( 'button' );
			styleControls.updateColorButtonDisplay( button, 'none' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );

			window.ColorPickerDialog.updateColorButton = originalUpdateFn;
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
			styleControls.fontSizeInput.value = '24';
			const options = styleControls.getStyleOptions();
			expect( options.fontSize ).toBe( 24 );
		} );

		it( 'should include text stroke options', () => {
			styleControls.textStrokeColor.value = '#0000ff';
			styleControls.textStrokeWidth.value = '3';

			const options = styleControls.getStyleOptions();

			expect( options.textStrokeColor ).toBe( '#0000ff' );
			expect( options.textStrokeWidth ).toBe( 3 );
		} );

		it( 'should include shadow options', () => {
			styleControls.textShadowToggle.checked = true;
			styleControls.textShadowColor.value = '#333333';

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

			expect( styleControls.fontSizeContainer.style.display ).toBe( 'block' );
			expect( styleControls.strokeContainer.style.display ).toBe( 'block' );
			expect( styleControls.shadowContainer.style.display ).toBe( 'block' );
			expect( styleControls.arrowContainer.style.display ).toBe( 'none' );
		} );

		it( 'should show arrow options for arrow tool', () => {
			styleControls.updateForTool( 'arrow' );

			expect( styleControls.fontSizeContainer.style.display ).toBe( 'none' );
			expect( styleControls.strokeContainer.style.display ).toBe( 'none' );
			expect( styleControls.shadowContainer.style.display ).toBe( 'none' );
			expect( styleControls.arrowContainer.style.display ).toBe( 'block' );
		} );

		it( 'should hide all extra options for other tools', () => {
			styleControls.updateForTool( 'rectangle' );

			expect( styleControls.fontSizeContainer.style.display ).toBe( 'none' );
			expect( styleControls.strokeContainer.style.display ).toBe( 'none' );
			expect( styleControls.shadowContainer.style.display ).toBe( 'none' );
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
			expect( styleControls.fontSizeInput ).toBeNull();
			expect( styleControls.inputValidators ).toEqual( [] );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export to window', () => {
			expect( window.ToolbarStyleControls ).toBe( ToolbarStyleControls );
		} );

		it( 'should be a constructor function', () => {
			expect( typeof ToolbarStyleControls ).toBe( 'function' );
			expect( ToolbarStyleControls.prototype.create ).toBeDefined();
		} );
	} );
} );
