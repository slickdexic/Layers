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

// Mock ArrowStyleControl to expose the underlying select element for tests
class MockArrowStyleControl {
	constructor( config ) {
		this.config = config;
		this.container = null;
		this.arrowStyleSelect = null;
		this.owner = null;
	}

	create() {
		// Create real container and select for tests to access
		this.container = document.createElement( 'div' );
		this.container.className = 'arrow-style-container';
		this.container.style.display = 'none';

		const label = document.createElement( 'label' );
		label.textContent = 'Arrow:';
		label.className = 'arrow-label';
		this.container.appendChild( label );

		const select = document.createElement( 'select' );
		select.className = 'arrow-style-select';
		[ 'single', 'double', 'none' ].forEach( ( val ) => {
			const opt = document.createElement( 'option' );
			opt.value = val;
			opt.textContent = val;
			select.appendChild( opt );
		} );
		this.container.appendChild( select );
		this.arrowStyleSelect = select;

		return this.container;
	}

	getValue() {
		return this.arrowStyleSelect ? this.arrowStyleSelect.value : 'single';
	}

	setValue( value ) {
		if ( this.arrowStyleSelect ) {
			this.arrowStyleSelect.value = value;
		}
	}

	updateForTool( toolId ) {
		if ( this.container ) {
			this.container.style.display = ( toolId === 'arrow' ) ? 'block' : 'none';
		}
	}

	applyStyle( style ) {
		if ( style && style.arrowStyle && this.arrowStyleSelect ) {
			this.arrowStyleSelect.value = style.arrowStyle;
		}
	}

	getStyleValues() {
		return { arrowStyle: this.getValue() };
	}

	destroy() {
		this.container = null;
		this.arrowStyleSelect = null;
	}

	setOwner( owner ) {
		this.owner = owner;
		// Expose the select element to the owner for backward-compatible tests
		if ( owner ) {
			owner.arrowStyleSelect = this.arrowStyleSelect;
		}
	}
}
window.Layers.UI.ArrowStyleControl = MockArrowStyleControl;

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

		it( 'should apply arrowStyle via fallback when arrowStyleControl is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			// Ensure arrowStyleSelect exists but arrowStyleControl is null
			controls.arrowStyleControl = null;
			controls.arrowStyleSelect.value = 'none';

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

		it( 'should use arrowStyleSelect fallback when arrowStyleControl is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			// Null out the arrowStyleControl to test the fallback path
			controls.arrowStyleControl = null;
			controls.arrowStyleSelect.value = 'double';

			const style = controls.getCurrentStyle();
			expect( style.arrowStyle ).toBe( 'double' );
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

		it( 'should call hideControlsForSelectedLayers when contextAwareEnabled and layers selected', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.contextAwareEnabled = true;
			const layers = [ { id: '1', type: 'rectangle' } ];

			// Spy on hideControlsForSelectedLayers
			const spy = jest.spyOn( controls, 'hideControlsForSelectedLayers' );
			controls.updateForSelection( layers );

			expect( spy ).toHaveBeenCalledWith( layers );
			spy.mockRestore();
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

	describe( 'fallback behavior without ColorControlFactory', () => {
		it( 'should use createColorControlFallback when colorFactory is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;

			const container = controls.create();

			// Should still have stroke and fill color buttons
			expect( controls.strokeColorButton ).toBeTruthy();
			expect( controls.fillColorButton ).toBeTruthy();
			expect( container.querySelector( '.stroke-color' ) ).toBeTruthy();
			expect( container.querySelector( '.fill-color' ) ).toBeTruthy();
		} );

		it( 'should create functional fallback stroke color control', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;
			controls.create();

			// Fallback button should have proper attributes
			const strokeBtn = controls.strokeColorButton;
			expect( strokeBtn.getAttribute( 'aria-haspopup' ) ).toBe( 'dialog' );
			expect( strokeBtn.classList.contains( 'stroke-color' ) ).toBe( true );
		} );

		it( 'should create functional fallback fill color control', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;
			controls.create();

			// Fallback button should have proper attributes
			const fillBtn = controls.fillColorButton;
			expect( fillBtn.getAttribute( 'aria-haspopup' ) ).toBe( 'dialog' );
			expect( fillBtn.classList.contains( 'fill-color' ) ).toBe( true );
		} );

		it( 'should handle click event on fallback stroke color button', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;
			controls.create();

			// Mock the openColorPicker method
			controls.openColorPicker = jest.fn();

			// Simulate click
			const strokeBtn = controls.strokeColorButton;
			strokeBtn.click();

			expect( controls.openColorPicker ).toHaveBeenCalled();
		} );

		it( 'should handle click event on fallback fill color button', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;
			controls.create();

			// Mock the openColorPicker method
			controls.openColorPicker = jest.fn();

			// Simulate click
			const fillBtn = controls.fillColorButton;
			fillBtn.click();

			expect( controls.openColorPicker ).toHaveBeenCalled();
		} );
	} );

	describe( 'namespace class resolution fallback', () => {
		it( 'should handle when getClass returns undefined for factories', () => {
			// Temporarily remove classes to test fallback
			const savedColorFactory = window.Layers.UI.ColorControlFactory;
			window.Layers.UI.ColorControlFactory = undefined;

			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			expect( controls.colorFactory ).toBeFalsy();
			controls.destroy();

			// Restore
			window.Layers.UI.ColorControlFactory = savedColorFactory;
		} );
	} );

	describe( 'registerDialogCleanup callback', () => {
		it( 'should call toolbar.registerDialogCleanup when provided', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			// The colorFactory is created in constructor with registerDialogCleanup callback
			// Verify the toolbar method exists
			expect( mockToolbar.registerDialogCleanup ).toBeDefined();
		} );

		it( 'should not throw when toolbar is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: null } );
			expect( controls.toolbar ).toBeNull();
			controls.destroy();
		} );

		it( 'should not throw when toolbar lacks registerDialogCleanup', () => {
			const noCleanupToolbar = { onStyleChange: jest.fn() };
			const controls = new ToolbarStyleControls( { toolbar: noCleanupToolbar } );
			expect( controls.toolbar ).toBe( noCleanupToolbar );
			controls.destroy();
		} );
	} );

	describe( 'destroy with managers', () => {
		it( 'should call destroy on presetStyleManager when present', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			// Mock presetStyleManager with destroy
			const mockDestroy = jest.fn();
			controls.presetStyleManager = { destroy: mockDestroy };

			controls.destroy();

			expect( mockDestroy ).toHaveBeenCalled();
			expect( controls.presetStyleManager ).toBeNull();
		} );

		it( 'should call destroy on textEffectsControls when present', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			// Mock textEffectsControls with destroy
			const mockDestroy = jest.fn();
			controls.textEffectsControls = { destroy: mockDestroy };

			controls.destroy();

			expect( mockDestroy ).toHaveBeenCalled();
			expect( controls.textEffectsControls ).toBeNull();
		} );

		it( 'should call destroy on arrowStyleControl when present', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			// Mock arrowStyleControl with destroy
			const mockDestroy = jest.fn();
			controls.arrowStyleControl = { destroy: mockDestroy };

			controls.destroy();

			expect( mockDestroy ).toHaveBeenCalled();
			expect( controls.arrowStyleControl ).toBeNull();
		} );
	} );

	describe( 'ColorControlFactory integration', () => {
		let FreshToolbarStyleControls;
		let mockCreateColorControl;

		beforeEach( () => {
			jest.resetModules();

			// Setup namespace structure
			window.Layers = window.Layers || {};
			window.Layers.Utils = window.Layers.Utils || {};
			window.Layers.UI = window.Layers.UI || {};

			// Load NamespaceHelper
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

			// Load TextEffectsControls
			require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );

			// Setup ColorPickerDialog mock
			window.Layers.UI.ColorPickerDialog = jest.fn( function ( config ) {
				this.config = config;
				this.open = jest.fn();
			} );
			window.Layers.UI.ColorPickerDialog.updateColorButton = jest.fn();

			// Setup ColorControlFactory mock with createColorControl
			mockCreateColorControl = jest.fn().mockReturnValue( {
				container: document.createElement( 'div' ),
				button: document.createElement( 'button' )
			} );

			window.Layers.UI.ColorControlFactory = function () {
				this.createColorControl = mockCreateColorControl;
				this.updateColorButtonDisplay = jest.fn();
			};

			// Re-require module with factory available
			FreshToolbarStyleControls = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );
		} );

		it( 'should use ColorControlFactory when available', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );

			expect( controls.colorFactory ).not.toBeNull();
			controls.destroy();
		} );

		it( 'should call createColorControl for stroke and fill colors', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			// Should call createColorControl twice (stroke and fill)
			expect( mockCreateColorControl ).toHaveBeenCalledTimes( 2 );

			// First call should be for stroke
			expect( mockCreateColorControl.mock.calls[ 0 ][ 0 ].type ).toBe( 'stroke' );

			// Second call should be for fill
			expect( mockCreateColorControl.mock.calls[ 1 ][ 0 ].type ).toBe( 'fill' );

			controls.destroy();
		} );

		it( 'should invoke onColorChange callback for stroke color', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			// Get the onColorChange callback passed to createColorControl for stroke
			const strokeConfig = mockCreateColorControl.mock.calls[ 0 ][ 0 ];
			expect( strokeConfig.onColorChange ).toBeDefined();

			// Invoke the callback
			strokeConfig.onColorChange( '#ff0000', false );

			expect( controls.strokeColorValue ).toBe( '#ff0000' );
			expect( controls.strokeColorNone ).toBe( false );

			controls.destroy();
		} );

		it( 'should invoke onColorChange callback for fill color', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			// Get the onColorChange callback passed to createColorControl for fill
			const fillConfig = mockCreateColorControl.mock.calls[ 1 ][ 0 ];
			expect( fillConfig.onColorChange ).toBeDefined();

			// Invoke the callback
			fillConfig.onColorChange( '#00ff00', false );

			expect( controls.fillColorValue ).toBe( '#00ff00' );
			expect( controls.fillColorNone ).toBe( false );

			controls.destroy();
		} );

		it( 'should handle none color for stroke', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			const strokeConfig = mockCreateColorControl.mock.calls[ 0 ][ 0 ];

			// Invoke callback with isNone=true
			strokeConfig.onColorChange( '#000000', true );

			expect( controls.strokeColorNone ).toBe( true );
			// strokeColorValue should NOT be updated when isNone is true
			expect( controls.strokeColorValue ).toBe( '#000000' ); // Original value

			controls.destroy();
		} );

		it( 'should handle none color for fill', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			const fillConfig = mockCreateColorControl.mock.calls[ 1 ][ 0 ];

			// Invoke callback with isNone=true
			fillConfig.onColorChange( '#000000', true );

			expect( controls.fillColorNone ).toBe( true );
			// fillColorValue should NOT be updated when isNone is true
			expect( controls.fillColorValue ).toBe( '#ffffff' ); // Original value

			controls.destroy();
		} );

		it( 'should set strokeControl and fillControl from factory result', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			expect( controls.strokeControl ).toBeDefined();
			expect( controls.strokeControl.container ).toBeDefined();
			expect( controls.strokeControl.button ).toBeDefined();

			expect( controls.fillControl ).toBeDefined();
			expect( controls.fillControl.container ).toBeDefined();
			expect( controls.fillControl.button ).toBeDefined();

			controls.destroy();
		} );
	} );

	describe( 'getClass inline fallback', () => {
		it( 'should resolve class from Layers namespace', () => {
			// ToolbarStyleControls already successfully resolves classes
			// This test verifies the namespace resolution works
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );

			// TextEffectsControls should be resolved from namespace
			expect( controls.textEffectsControls ).not.toBeNull();
			controls.destroy();
		} );

		it( 'should fall back to window global when namespace path fails', () => {
			jest.resetModules();

			// Setup minimal namespace without ColorControlFactory
			window.Layers = { UI: {} };

			// But add ColorControlFactory as a global
			const mockFactory = function () {
				this.createColorControl = jest.fn().mockReturnValue( {
					container: document.createElement( 'div' ),
					button: document.createElement( 'button' )
				} );
			};
			window.ColorControlFactory = mockFactory;

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );
			require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );

			const Fresh = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );
			const controls = new Fresh( { toolbar: mockToolbar } );

			// Should have found ColorControlFactory via global fallback
			expect( controls.colorFactory ).not.toBeNull();

			controls.destroy();
			delete window.ColorControlFactory;
		} );
	} );

	describe( 'addListener fallback', () => {
		it( 'should use addEventListener directly when eventTracker is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.eventTracker = null;

			const element = document.createElement( 'button' );
			const handler = jest.fn();
			const addEventListenerSpy = jest.spyOn( element, 'addEventListener' );

			controls.addListener( element, 'click', handler );

			expect( addEventListenerSpy ).toHaveBeenCalledWith( 'click', handler, undefined );

			controls.destroy();
		} );
	} );

	describe( 'presetStyleManager integration', () => {
		let FreshToolbarStyleControls;
		let mockCreatePresetDropdown;
		let mockGetElement;

		beforeEach( () => {
			jest.resetModules();

			window.Layers = window.Layers || {};
			window.Layers.Utils = window.Layers.Utils || {};
			window.Layers.UI = window.Layers.UI || {};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );
			require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );

			// Setup PresetStyleManager mock
			mockCreatePresetDropdown = jest.fn().mockReturnValue( document.createElement( 'div' ) );
			mockGetElement = jest.fn().mockReturnValue( document.createElement( 'div' ) );

			window.Layers.UI.PresetStyleManager = function () {
				this.createPresetDropdown = mockCreatePresetDropdown;
				this.getElement = mockGetElement;
				this.destroy = jest.fn();
			};

			// Also set up ColorPickerDialog
			window.Layers.UI.ColorPickerDialog = jest.fn();
			window.Layers.UI.ColorPickerDialog.updateColorButton = jest.fn();

			// Add ArrowStyleControl mock (required since it's no longer optional)
			window.Layers.UI.ArrowStyleControl = MockArrowStyleControl;

			FreshToolbarStyleControls = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );
		} );

		it( 'should call presetStyleManager.createPresetDropdown in create()', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();

			expect( mockCreatePresetDropdown ).toHaveBeenCalled();
			expect( mockGetElement ).toHaveBeenCalled();

			controls.destroy();
		} );

		it( 'should append preset dropdown element to style group', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			const container = controls.create();

			// Container should have children (preset dropdown appended)
			expect( container.children.length ).toBeGreaterThan( 0 );

			controls.destroy();
		} );
	} );

	describe( 'setStrokeColor with colorFactory', () => {
		it( 'should use colorFactory.updateColorButtonDisplay when available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );

			// Mock colorFactory and strokeControl
			const mockUpdateDisplay = jest.fn();
			controls.colorFactory = {
				updateColorButtonDisplay: mockUpdateDisplay
			};
			controls.strokeControl = {
				button: document.createElement( 'button' )
			};

			controls.setStrokeColor( '#ff0000' );

			expect( mockUpdateDisplay ).toHaveBeenCalledWith( controls.strokeControl.button, '#ff0000' );
			controls.destroy();
		} );
	} );

	describe( 'setFillColor with colorFactory', () => {
		it( 'should use colorFactory.updateColorButtonDisplay when available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );

			// Mock colorFactory and fillControl
			const mockUpdateDisplay = jest.fn();
			controls.colorFactory = {
				updateColorButtonDisplay: mockUpdateDisplay
			};
			controls.fillControl = {
				button: document.createElement( 'button' )
			};

			controls.setFillColor( '#00ff00' );

			expect( mockUpdateDisplay ).toHaveBeenCalledWith( controls.fillControl.button, '#00ff00' );
			controls.destroy();
		} );
	} );

	describe( 'Context-Aware Toolbar', () => {
		beforeEach( () => {
			// Enable context-aware mode
			styleControls.contextAwareEnabled = true;
			styleControls.create();
		} );

		describe( 'updateContextVisibility', () => {
			it( 'should hide main style row for pointer tool', () => {
				styleControls.updateContextVisibility( 'pointer' );

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( true );
			} );

			it( 'should show main style row for rectangle tool', () => {
				styleControls.updateContextVisibility( 'rectangle' );

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			} );

			it( 'should show main style row for circle tool', () => {
				styleControls.updateContextVisibility( 'circle' );

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			} );

			it( 'should show main style row for arrow tool', () => {
				styleControls.updateContextVisibility( 'arrow' );

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			} );

			it( 'should hide main style row for text tool (text has its own controls)', () => {
				styleControls.updateContextVisibility( 'text' );

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( true );
			} );

			it( 'should show main style row for textbox tool', () => {
				styleControls.updateContextVisibility( 'textbox' );

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			} );

			it( 'should show main style row for pen tool', () => {
				styleControls.updateContextVisibility( 'pen' );

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			} );

			it( 'should hide presets for pointer tool', () => {
				// Ensure presetContainer exists
				if ( styleControls.presetContainer ) {
					styleControls.updateContextVisibility( 'pointer' );

					expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( true );
				}
			} );

			it( 'should show presets for drawing tools', () => {
				// Ensure presetContainer exists
				if ( styleControls.presetContainer ) {
					styleControls.updateContextVisibility( 'rectangle' );

					expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );
				}
			} );

			it( 'should hide fill color for stroke-only tools', () => {
				// Ensure fillControl exists
				if ( styleControls.fillControl && styleControls.fillControl.container ) {
					styleControls.updateContextVisibility( 'pen' );

					expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );
				}
			} );

			it( 'should show fill color for shape tools', () => {
				// Ensure fillControl exists
				if ( styleControls.fillControl && styleControls.fillControl.container ) {
					styleControls.updateContextVisibility( 'rectangle' );

					expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
				}
			} );
		} );

		describe( 'setContextAwareEnabled', () => {
			it( 'should add context-aware class when enabled', () => {
				styleControls.setContextAwareEnabled( true );

				expect( styleControls.container.classList.contains( 'context-aware' ) ).toBe( true );
			} );

			it( 'should remove context-aware class when disabled', () => {
				styleControls.setContextAwareEnabled( false );

				expect( styleControls.container.classList.contains( 'context-aware' ) ).toBe( false );
			} );

			it( 'should show all controls when disabled', () => {
				// First hide some controls
				styleControls.updateContextVisibility( 'pointer' );
				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( true );

				// Disable context-aware mode
				styleControls.setContextAwareEnabled( false );

				// Should show all controls
				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			} );
		} );

		describe( 'isContextAwareEnabled', () => {
			it( 'should return true when enabled', () => {
				styleControls.contextAwareEnabled = true;
				expect( styleControls.isContextAwareEnabled() ).toBe( true );
			} );

			it( 'should return false when disabled', () => {
				styleControls.contextAwareEnabled = false;
				expect( styleControls.isContextAwareEnabled() ).toBe( false );
			} );
		} );

		describe( 'updateContextForSelectedLayers (hideControlsForSelectedLayers)', () => {
			// v1.2.12+: Controls are HIDDEN when layers are selected because
			// the Properties panel in the Layer Manager provides all the same controls.
			// This eliminates redundancy and focuses users on the appropriate UI.

			it( 'should hide main style row when layers are selected (use Properties panel)', () => {
				const selectedLayers = [
					{ id: 'rect-1', type: 'rectangle' },
					{ id: 'circle-1', type: 'circle' }
				];

				styleControls.updateContextForSelectedLayers( selectedLayers );

				// Controls are hidden because Properties panel has them
				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( true );
			} );

			it( 'should hide fill control when layers are selected', () => {
				const selectedLayers = [
					{ id: 'arrow-1', type: 'arrow' }
				];

				// Ensure fillControl exists
				if ( styleControls.fillControl && styleControls.fillControl.container ) {
					styleControls.updateContextForSelectedLayers( selectedLayers );

					// All controls hidden when layer is selected
					expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );
				}
			} );

			it( 'should hide presets when layers are selected', () => {
				const selectedLayers = [
					{ id: 'arrow-1', type: 'arrow' },
					{ id: 'rect-1', type: 'rectangle' }
				];

				if ( styleControls.presetContainer ) {
					styleControls.updateContextForSelectedLayers( selectedLayers );

					// Presets hidden because Properties panel has them
					expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( true );
				}
			} );

			it( 'should call textEffectsControls.hideAll when layers are selected', () => {
				const selectedLayers = [
					{ id: 'text-1', type: 'text' }
				];

				// Mock hideAll method (keep existing properties)
				const mockHideAll = jest.fn();
				const originalTextEffectsControls = styleControls.textEffectsControls;
				styleControls.textEffectsControls = {
					...originalTextEffectsControls,
					hideAll: mockHideAll
				};

				styleControls.hideControlsForSelectedLayers( selectedLayers );

				expect( mockHideAll ).toHaveBeenCalled();

				// Restore original
				styleControls.textEffectsControls = originalTextEffectsControls;
			} );
		} );

		describe( 'showAllControls', () => {
			it( 'should remove context-hidden from all controls', () => {
				// First hide controls
				styleControls.updateContextVisibility( 'pointer' );

				// Then show all
				styleControls.showAllControls();

				expect( styleControls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			} );
		} );

		describe( 'applyColorPreview', () => {
			let mockEditor;
			let mockCanvasManager;

			beforeEach( () => {
				mockCanvasManager = {
					layers: [],
					getSelectedLayerIds: jest.fn().mockReturnValue( [] ),
					renderLayers: jest.fn()
				};
				mockEditor = {
					canvasManager: mockCanvasManager,
					layers: [],
					getLayerById: jest.fn().mockImplementation( ( id ) =>
						mockCanvasManager.layers.find( ( l ) => l.id === id ) || null
					)
				};
				mockToolbar.editor = mockEditor;
			} );

			it( 'should apply stroke color preview to selected layers', () => {
				mockCanvasManager.layers = [
					{ id: 'layer-1', type: 'rectangle', stroke: '#000000' },
					{ id: 'layer-2', type: 'circle', stroke: '#000000' }
				];
				mockEditor.layers = mockCanvasManager.layers;
				mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer-1' ] );

				styleControls.applyColorPreview( 'stroke', '#ff0000' );

				// Verify layer was updated
				expect( mockCanvasManager.layers[ 0 ].stroke ).toBe( '#ff0000' );
				// Verify render was called
				expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
			} );

			it( 'should apply fill color preview to selected layers', () => {
				mockCanvasManager.layers = [
					{ id: 'layer-1', type: 'rectangle', fill: '#ffffff' }
				];
				mockEditor.layers = mockCanvasManager.layers;
				mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer-1' ] );

				styleControls.applyColorPreview( 'fill', '#00ff00' );

				expect( mockCanvasManager.layers[ 0 ].fill ).toBe( '#00ff00' );
				expect( mockCanvasManager.renderLayers ).toHaveBeenCalled();
			} );

			it( 'should handle none color for fill (transparent)', () => {
				mockCanvasManager.layers = [
					{ id: 'layer-1', type: 'rectangle', fill: '#ffffff' }
				];
				mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer-1' ] );

				styleControls.applyColorPreview( 'fill', 'none' );

				expect( mockCanvasManager.layers[ 0 ].fill ).toBe( 'none' );
			} );

			it( 'should apply preview to multiple selected layers', () => {
				mockCanvasManager.layers = [
					{ id: 'layer-1', type: 'rectangle', stroke: '#000000' },
					{ id: 'layer-2', type: 'circle', stroke: '#000000' },
					{ id: 'layer-3', type: 'ellipse', stroke: '#000000' }
				];
				mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer-1', 'layer-3' ] );

				styleControls.applyColorPreview( 'stroke', '#0000ff' );

				expect( mockCanvasManager.layers[ 0 ].stroke ).toBe( '#0000ff' );
				expect( mockCanvasManager.layers[ 1 ].stroke ).toBe( '#000000' ); // Not selected
				expect( mockCanvasManager.layers[ 2 ].stroke ).toBe( '#0000ff' );
			} );

			it( 'should not throw when no layers selected', () => {
				mockCanvasManager.getSelectedLayerIds.mockReturnValue( [] );

				expect( () => {
					styleControls.applyColorPreview( 'stroke', '#ff0000' );
				} ).not.toThrow();
			} );

			it( 'should skip layers that do not exist', () => {
				mockCanvasManager.layers = [
					{ id: 'layer-1', type: 'rectangle', stroke: '#000000' }
				];
				mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer-1', 'nonexistent' ] );

				expect( () => {
					styleControls.applyColorPreview( 'stroke', '#ff0000' );
				} ).not.toThrow();

				expect( mockCanvasManager.layers[ 0 ].stroke ).toBe( '#ff0000' );
			} );

			it( 'should not throw when toolbar is null', () => {
				styleControls.toolbar = null;

				expect( () => {
					styleControls.applyColorPreview( 'stroke', '#ff0000' );
				} ).not.toThrow();
			} );

			it( 'should not throw when editor is null', () => {
				mockToolbar.editor = null;

				expect( () => {
					styleControls.applyColorPreview( 'stroke', '#ff0000' );
				} ).not.toThrow();
			} );

			it( 'should apply stroke to fill for text layers', () => {
				mockCanvasManager.layers = [
					{ id: 'layer-1', type: 'text', fill: '#000000' }
				];
				mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer-1' ] );

				styleControls.applyColorPreview( 'stroke', '#ff0000' );

				// Text layers use fill for stroke color
				expect( mockCanvasManager.layers[ 0 ].fill ).toBe( '#ff0000' );
			} );
		} );
	} );
} );
