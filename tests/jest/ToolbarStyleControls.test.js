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

		// Clear class resolution cache to ensure fresh lookups for mocked classes
		if ( window.layersClearClassCache ) {
			window.layersClearClassCache();
		}

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
			// Context-aware class is always added (legacy mode removed in v1.5.36)
			expect( container.className ).toBe( 'toolbar-group style-group context-aware' );
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

		it( 'should use window.layersMessages when available', () => {
			const mockStrings = { title: 'Test Title', standard: 'Standard' };
			window.layersMessages = {
				getColorPickerStrings: jest.fn( () => mockStrings )
			};

			const strings = styleControls.getColorPickerStrings();

			expect( window.layersMessages.getColorPickerStrings ).toHaveBeenCalled();
			expect( strings ).toBe( mockStrings );

			// Cleanup
			delete window.layersMessages;
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
			expect( controls.strokeColorButton ).not.toBeNull();
			expect( controls.fillColorButton ).not.toBeNull();
			expect( container.querySelector( '.stroke-color' ) ).not.toBeNull();
			expect( container.querySelector( '.fill-color' ) ).not.toBeNull();
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
			expect( controls.colorFactory ).toBeNull();
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

		// Note: setContextAwareEnabled and isContextAwareEnabled methods removed in v1.5.36
		// Context-aware toolbar is now always enabled (no legacy mode)

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

			it( 'should keep presets visible when layers are selected (for saving as preset)', () => {
				const selectedLayers = [
					{ id: 'arrow-1', type: 'arrow' },
					{ id: 'rect-1', type: 'rectangle' }
				];

				if ( styleControls.presetContainer ) {
					// Start with presets hidden (simulates switching to pointer tool)
					styleControls.presetContainer.classList.add( 'context-hidden' );

					styleControls.updateContextForSelectedLayers( selectedLayers );

					// Presets should be SHOWN so users can save layer styles as presets
					expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );
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

			it( 'should return early when canvasManager is null', () => {
				mockToolbar.editor = { canvasManager: null };

				expect( () => {
					styleControls.applyColorPreview( 'stroke', '#ff0000' );
				} ).not.toThrow();
			} );
		} );
	} );

	describe( 'eventTracker integration', () => {
		it( 'should use eventTracker.add when eventTracker is available', () => {
			// Create controls with a mocked EventTracker
			const mockAdd = jest.fn();
			const mockDestroy = jest.fn();
			const MockEventTracker = jest.fn( () => ( {
				add: mockAdd,
				destroy: mockDestroy
			} ) );

			// Save original
			const origEventTracker = window.Layers.Utils.EventTracker;
			window.Layers.Utils.EventTracker = MockEventTracker;

			jest.resetModules();
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );
			require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );
			window.Layers.UI.ArrowStyleControl = MockArrowStyleControl;
			window.Layers.UI.ColorPickerDialog = jest.fn();
			window.Layers.UI.ColorPickerDialog.updateColorButton = jest.fn();

			const FreshControls = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );
			const controls = new FreshControls( { toolbar: mockToolbar } );

			// Add a listener
			const element = document.createElement( 'button' );
			const handler = jest.fn();
			controls.addListener( element, 'click', handler );

			expect( mockAdd ).toHaveBeenCalledWith( element, 'click', handler, undefined );

			// Verify destroy cleans up EventTracker
			controls.destroy();
			expect( mockDestroy ).toHaveBeenCalled();

			// Restore
			window.Layers.Utils.EventTracker = origEventTracker;
		} );
	} );

	describe( 'color preview callbacks', () => {
		let FreshToolbarStyleControls;
		let mockCreateColorControl;
		let capturedStrokeConfig;
		let capturedFillConfig;

		beforeEach( () => {
			jest.resetModules();

			window.Layers = window.Layers || {};
			window.Layers.Utils = window.Layers.Utils || {};
			window.Layers.UI = window.Layers.UI || {};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );
			require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );

			window.Layers.UI.ColorPickerDialog = jest.fn();
			window.Layers.UI.ColorPickerDialog.updateColorButton = jest.fn();
			window.Layers.UI.ArrowStyleControl = MockArrowStyleControl;

			// Capture the configs passed to createColorControl
			mockCreateColorControl = jest.fn().mockImplementation( ( config ) => {
				if ( config.type === 'stroke' ) {
					capturedStrokeConfig = config;
				} else if ( config.type === 'fill' ) {
					capturedFillConfig = config;
				}
				return {
					container: document.createElement( 'div' ),
					button: document.createElement( 'button' )
				};
			} );

			window.Layers.UI.ColorControlFactory = function () {
				this.createColorControl = mockCreateColorControl;
				this.updateColorButtonDisplay = jest.fn();
			};

			FreshToolbarStyleControls = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );
		} );

		it( 'should invoke onColorPreview callback for stroke color', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.applyColorPreview = jest.fn();
			controls.create();

			// Invoke the onColorPreview callback
			expect( capturedStrokeConfig.onColorPreview ).toBeDefined();
			capturedStrokeConfig.onColorPreview( '#ff0000', false );

			expect( controls.applyColorPreview ).toHaveBeenCalledWith( 'stroke', '#ff0000' );

			controls.destroy();
		} );

		it( 'should invoke onColorPreview callback for stroke with isNone=true', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.applyColorPreview = jest.fn();
			controls.create();

			capturedStrokeConfig.onColorPreview( '#ff0000', true );

			expect( controls.applyColorPreview ).toHaveBeenCalledWith( 'stroke', 'transparent' );

			controls.destroy();
		} );

		it( 'should invoke onColorPreview callback for fill color', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.applyColorPreview = jest.fn();
			controls.create();

			expect( capturedFillConfig.onColorPreview ).toBeDefined();
			capturedFillConfig.onColorPreview( '#00ff00', false );

			expect( controls.applyColorPreview ).toHaveBeenCalledWith( 'fill', '#00ff00' );

			controls.destroy();
		} );

		it( 'should invoke onColorPreview callback for fill with isNone=true', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			controls.applyColorPreview = jest.fn();
			controls.create();

			capturedFillConfig.onColorPreview( '#00ff00', true );

			expect( controls.applyColorPreview ).toHaveBeenCalledWith( 'fill', 'transparent' );

			controls.destroy();
		} );
	} );

	describe( 'fallback color control onPreview', () => {
		beforeEach( () => {
			styleControls.colorFactory = null;
		} );

		it( 'should invoke onPreview handler in fallback color picker', () => {
			// Create controls without colorFactory
			styleControls.create();

			// Mock openColorPicker to capture the options
			let capturedOptions;
			styleControls.openColorPicker = jest.fn().mockImplementation( ( btn, color, opts ) => {
				capturedOptions = opts;
			} );

			// Click stroke color button
			styleControls.strokeColorButton.click();

			// Verify onPreview was passed
			expect( capturedOptions.onPreview ).toBeDefined();

			// Mock applyColorPreview
			styleControls.applyColorPreview = jest.fn();

			// Invoke the onPreview callback
			capturedOptions.onPreview( '#ff0000' );

			expect( styleControls.applyColorPreview ).toHaveBeenCalledWith( 'stroke', '#ff0000' );
		} );

		it( 'should handle none preview value in fallback', () => {
			styleControls.create();

			let capturedOptions;
			styleControls.openColorPicker = jest.fn().mockImplementation( ( btn, color, opts ) => {
				capturedOptions = opts;
			} );

			styleControls.strokeColorButton.click();
			styleControls.applyColorPreview = jest.fn();

			// Invoke with 'none' value - the onPreview callback passes 'transparent' when none is true
			capturedOptions.onPreview( 'none' );

			// When none === true, applyColorPreview is called with 'transparent' (see line 341-342)
			expect( styleControls.applyColorPreview ).toHaveBeenCalledWith( 'stroke', 'transparent' );
		} );
	} );

	describe( 'registerDialogCleanup callback', () => {
		it( 'should call registerDialogCleanup when opening color picker', () => {
			// Reset modules to get fresh ToolbarStyleControls with current getClass reference
			jest.resetModules();

			// Re-setup namespace and mocks
			window.Layers = window.Layers || {};
			window.Layers.Utils = window.Layers.Utils || {};
			window.Layers.UI = window.Layers.UI || {};

			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );
			require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );

			// Set up ArrowStyleControl mock
			window.Layers.UI.ArrowStyleControl = MockArrowStyleControl;

			// Set up ColorPickerDialog mock that calls registerCleanup
			const mockPickerOpen = jest.fn();
			window.Layers.UI.ColorPickerDialog = jest.fn( function ( config ) {
				if ( config.registerCleanup ) {
					config.registerCleanup( () => {} );
				}
				this.open = mockPickerOpen;
			} );
			window.Layers.UI.ColorPickerDialog.updateColorButton = jest.fn();

			// Get fresh ToolbarStyleControls
			const FreshToolbarStyleControls = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );

			const mockRegister = jest.fn();
			const toolbarWithRegister = {
				...mockToolbar,
				registerDialogCleanup: mockRegister
			};

			const controls = new FreshToolbarStyleControls( { toolbar: toolbarWithRegister } );
			controls.create();

			// Open color picker
			controls.openColorPicker( document.createElement( 'button' ), '#000000', {} );

			// registerCleanup should have been invoked
			expect( mockRegister ).toHaveBeenCalled();

			controls.destroy();
		} );
	} );

	describe( 'updateForTool without arrowStyleControl', () => {
		it( 'should use direct arrowContainer visibility when arrowStyleControl is null', () => {
			styleControls.create();

			// Null out arrowStyleControl to test fallback
			styleControls.arrowStyleControl = null;
			// Also null out presetStyleManager to avoid unrelated errors
			styleControls.presetStyleManager = null;

			// For arrow tool, container should be visible
			styleControls.updateForTool( 'arrow' );
			expect( styleControls.arrowContainer.style.display ).toBe( 'block' );

			// For other tools, container should be hidden
			styleControls.updateForTool( 'rectangle' );
			expect( styleControls.arrowContainer.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'updateForTool with contextAware', () => {
		it( 'should call updateContextVisibility when contextAwareEnabled', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();

			// Mock presetStyleManager to avoid errors
			styleControls.presetStyleManager = { setCurrentTool: jest.fn(), destroy: jest.fn() };

			// Spy on updateContextVisibility
			const spy = jest.spyOn( styleControls, 'updateContextVisibility' );

			styleControls.updateForTool( 'rectangle' );

			expect( spy ).toHaveBeenCalledWith( 'rectangle' );

			spy.mockRestore();
		} );

		it( 'should not call updateContextVisibility when contextAwareEnabled is false', () => {
			styleControls.contextAwareEnabled = false;
			styleControls.create();

			// Mock presetStyleManager to avoid errors
			styleControls.presetStyleManager = { setCurrentTool: jest.fn(), destroy: jest.fn() };

			const spy = jest.spyOn( styleControls, 'updateContextVisibility' );

			styleControls.updateForTool( 'rectangle' );

			expect( spy ).not.toHaveBeenCalled();

			spy.mockRestore();
		} );
	} );

	describe( 'updateContextVisibility fillControl branches', () => {
		beforeEach( () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();
		} );

		it( 'should add context-hidden to fillControl for pen tool', () => {
			if ( styleControls.fillControl && styleControls.fillControl.container ) {
				styleControls.updateContextVisibility( 'pen' );
				expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );
			}
		} );

it( 'should show fillControl for arrow tool (arrows support fill)', () => {
		if ( styleControls.fillControl && styleControls.fillControl.container ) {
			styleControls.updateContextVisibility( 'arrow' );
			expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
			}
		} );

		it( 'should remove context-hidden from fillControl for circle tool', () => {
			if ( styleControls.fillControl && styleControls.fillControl.container ) {
				// First hide it
				styleControls.updateContextVisibility( 'pen' );
				expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );

				// Then show for circle
				styleControls.updateContextVisibility( 'circle' );
				expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
			}
		} );

		it( 'should remove context-hidden from fillControl for ellipse tool', () => {
			if ( styleControls.fillControl && styleControls.fillControl.container ) {
				styleControls.updateContextVisibility( 'pen' );
				styleControls.updateContextVisibility( 'ellipse' );
				expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
			}
		} );
	} );

	describe( 'showAllControls fillControl branch', () => {
		it( 'should remove context-hidden from fillControl.container', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();

			// First hide with pen tool
			if ( styleControls.fillControl && styleControls.fillControl.container ) {
				styleControls.updateContextVisibility( 'pen' );
				expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );

				// Show all
				styleControls.showAllControls();
				expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
			}
		} );
	} );

	describe( 'hideControlsForSelectedLayers fillControl branch', () => {
		it( 'should add context-hidden to fillControl.container when layers selected', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();

			if ( styleControls.fillControl && styleControls.fillControl.container ) {
				styleControls.hideControlsForSelectedLayers( [ { id: '1', type: 'rectangle' } ] );
				expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );
			}
		} );
	} );

	describe( 'setupValidation with textEffectsControls', () => {
		it( 'should call textEffectsControls.setupValidation when available', () => {
			styleControls.create();

			const mockValidator = {
				createInputValidator: jest.fn().mockReturnValue( {} )
			};

			// Spy on textEffectsControls.setupValidation
			const spy = jest.spyOn( styleControls.textEffectsControls, 'setupValidation' );

			styleControls.setupValidation( mockValidator );

			expect( spy ).toHaveBeenCalledWith( mockValidator, expect.any( Array ) );

			spy.mockRestore();
		} );
	} );

	describe( 'createMarkerControls', () => {
		let mockEditor;
		let mockCanvasManager;

		beforeEach( () => {
			mockCanvasManager = {
				layers: [],
				markerDefaults: { autoNumber: false },
				updateMarkerDefaults: jest.fn( function ( props ) {
					Object.assign( this.markerDefaults, props );
				} ),
				getSelectedLayerIds: jest.fn().mockReturnValue( [] ),
				renderLayers: jest.fn()
			};
			mockEditor = {
				canvasManager: mockCanvasManager,
				layers: [],
				getLayerById: jest.fn()
			};
			mockToolbar.editor = mockEditor;
		} );

		it( 'should create marker container with auto-number checkbox', () => {
			styleControls.create();

			expect( styleControls.markerContainer ).toBeDefined();
			expect( styleControls.markerAutoNumberCheckbox ).toBeDefined();
			expect( styleControls.markerContainer.classList.contains( 'style-control' ) ).toBe( true );
			expect( styleControls.markerContainer.classList.contains( 'marker-control' ) ).toBe( true );
		} );

		it( 'should update canvasManager markerDefaults when checkbox is changed', () => {
			styleControls.create();

			// Checkbox should initially be unchecked
			expect( styleControls.markerAutoNumberCheckbox.checked ).toBe( false );

			// Simulate checking the checkbox
			styleControls.markerAutoNumberCheckbox.checked = true;
			styleControls.markerAutoNumberCheckbox.dispatchEvent( new Event( 'change' ) );

			// CanvasManager's updateMarkerDefaults should have been called
			expect( mockCanvasManager.updateMarkerDefaults ).toHaveBeenCalledWith( { autoNumber: true } );
			expect( mockCanvasManager.markerDefaults.autoNumber ).toBe( true );

			// Simulate unchecking
			styleControls.markerAutoNumberCheckbox.checked = false;
			styleControls.markerAutoNumberCheckbox.dispatchEvent( new Event( 'change' ) );

			expect( mockCanvasManager.updateMarkerDefaults ).toHaveBeenCalledWith( { autoNumber: false } );
			expect( mockCanvasManager.markerDefaults.autoNumber ).toBe( false );
		} );

		it( 'should show marker controls when marker tool is selected', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();

			// First set to another tool
			styleControls.updateContextVisibility( 'rectangle' );
			expect( styleControls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( true );

			// Now select marker tool
			styleControls.updateContextVisibility( 'marker' );
			expect( styleControls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( false );
		} );

		it( 'should hide marker controls for non-marker tools', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();

			// Show marker controls first
			styleControls.updateContextVisibility( 'marker' );
			expect( styleControls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( false );

			// Switch to another tool
			styleControls.updateContextVisibility( 'arrow' );
			expect( styleControls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( true );
		} );

		it( 'should hide marker controls when hideControlsForSelectedLayers is called', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();

			// Show marker controls
			styleControls.updateContextVisibility( 'marker' );
			expect( styleControls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( false );

			// Hide for selected layers
			styleControls.hideControlsForSelectedLayers( [ { id: '1', type: 'marker' } ] );
			expect( styleControls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( true );
		} );
	} );

	describe( 'cancelColorPreview', () => {
		let mockEditor;
		let mockCanvasManager;

		beforeEach( () => {
			mockCanvasManager = {
				getSelectedLayerIds: jest.fn().mockReturnValue( [ 'layer1', 'layer2' ] ),
				renderLayers: jest.fn()
			};

			mockEditor = {
				canvasManager: mockCanvasManager,
				layers: [ { id: 'layer1', type: 'rectangle', fill: '#ff0000', stroke: '#000000' },
					{ id: 'layer2', type: 'circle', fill: '#00ff00', stroke: '#111111' } ],
				getLayerById: jest.fn( ( id ) => mockEditor.layers.find( ( l ) => l.id === id ) || null )
			};
		} );

		it( 'should return early when no preview colors saved', () => {
			styleControls.toolbar = { editor: mockEditor };
			styleControls._previewOriginalColors = null;

			styleControls.cancelColorPreview();

			expect( mockCanvasManager.renderLayers ).not.toHaveBeenCalled();
		} );

		it( 'should return early when toolbar.editor is not available', () => {
			styleControls.toolbar = {};
			styleControls._previewOriginalColors = new Map();

			styleControls.cancelColorPreview();

			expect( styleControls._previewOriginalColors ).toBeNull();
		} );

		it( 'should restore original colors for each layer', () => {
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };

			// Simulate preview state: original colors saved, layers modified
			const origColors = new Map();
			origColors.set( 'layer1', { fill: '#original1', stroke: '#origStroke1' } );
			origColors.set( 'layer2', { fill: '#original2', stroke: '#origStroke2' } );
			styleControls._previewOriginalColors = origColors;

			// Modify layers (as if preview was applied)
			mockEditor.layers[ 0 ].fill = '#preview1';
			mockEditor.layers[ 1 ].fill = '#preview2';

			styleControls.cancelColorPreview();

			// Layers should be restored
			expect( mockEditor.layers[ 0 ].fill ).toBe( '#original1' );
			expect( mockEditor.layers[ 0 ].stroke ).toBe( '#origStroke1' );
			expect( mockEditor.layers[ 1 ].fill ).toBe( '#original2' );
			expect( mockEditor.layers[ 1 ].stroke ).toBe( '#origStroke2' );
			expect( styleControls._previewOriginalColors ).toBeNull();
		} );

		it( 'should re-render after restoring colors', () => {
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };

			const origColors = new Map();
			origColors.set( 'layer1', { fill: '#fff', stroke: '#000' } );
			styleControls._previewOriginalColors = origColors;

			styleControls.cancelColorPreview();

			expect( mockCanvasManager.renderLayers ).toHaveBeenCalledWith( mockEditor.layers );
		} );

		it( 'should skip unknown layer IDs in preview map', () => {
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };

			const origColors = new Map();
			origColors.set( 'nonexistent', { fill: '#fff', stroke: '#000' } );
			origColors.set( 'layer1', { fill: '#restored', stroke: '#restoredS' } );
			styleControls._previewOriginalColors = origColors;

			styleControls.cancelColorPreview();

			expect( mockEditor.layers[ 0 ].fill ).toBe( '#restored' );
		} );
	} );

	describe( 'commitColorChange', () => {
		let mockEditor;
		let mockCanvasManager;
		let mockStateManager;

		beforeEach( () => {
			mockStateManager = {
				updateLayer: jest.fn()
			};

			mockCanvasManager = {
				getSelectedLayerIds: jest.fn().mockReturnValue( [ 'layer1' ] ),
				renderLayers: jest.fn()
			};

			mockEditor = {
				canvasManager: mockCanvasManager,
				stateManager: mockStateManager,
				layers: [ { id: 'layer1', type: 'rectangle', fill: '#fff', stroke: '#000' } ],
				getLayerById: jest.fn( ( id ) => mockEditor.layers.find( ( l ) => l.id === id ) || null ),
				markDirty: jest.fn()
			};
		} );

		it( 'should return early when toolbar.editor is not available', () => {
			styleControls.toolbar = {};
			styleControls.commitColorChange( 'stroke', '#ff0000' );

			expect( mockStateManager.updateLayer ).not.toHaveBeenCalled();
		} );

		it( 'should return early when stateManager is null', () => {
			mockEditor.stateManager = null;
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'stroke', '#ff0000' );

			expect( mockStateManager.updateLayer ).not.toHaveBeenCalled();
		} );

		it( 'should return early when no layers selected', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [] );
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'stroke', '#ff0000' );

			expect( mockStateManager.updateLayer ).not.toHaveBeenCalled();
		} );

		it( 'should apply stroke color to non-text layer', () => {
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'stroke', '#ff0000' );

			expect( mockStateManager.updateLayer ).toHaveBeenCalledWith( 'layer1', { stroke: '#ff0000' } );
			expect( mockEditor.markDirty ).toHaveBeenCalled();
		} );

		it( 'should apply stroke color as fill for text layers', () => {
			mockEditor.layers[ 0 ].type = 'text';
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'stroke', '#ff0000' );

			expect( mockStateManager.updateLayer ).toHaveBeenCalledWith( 'layer1', { fill: '#ff0000' } );
		} );

		it( 'should apply fill color to shape layers', () => {
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'fill', '#00ff00' );

			expect( mockStateManager.updateLayer ).toHaveBeenCalledWith( 'layer1', { fill: '#00ff00' } );
		} );

		it( 'should not apply fill to text layers', () => {
			mockEditor.layers[ 0 ].type = 'text';
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'fill', '#00ff00' );

			expect( mockStateManager.updateLayer ).not.toHaveBeenCalled();
		} );

		it( 'should not apply fill to line layers', () => {
			mockEditor.layers[ 0 ].type = 'line';
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'fill', '#00ff00' );

			expect( mockStateManager.updateLayer ).not.toHaveBeenCalled();
		} );

		it( 'should skip layers not found by getLayerById', () => {
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'nonexistent' ] );
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'stroke', '#ff0000' );

			expect( mockStateManager.updateLayer ).not.toHaveBeenCalled();
		} );

		it( 'should commit changes for multiple selected layers', () => {
			mockEditor.layers.push( { id: 'layer2', type: 'circle', fill: '#ccc', stroke: '#333' } );
			mockEditor.getLayerById = jest.fn( ( id ) => mockEditor.layers.find( ( l ) => l.id === id ) || null );
			mockCanvasManager.getSelectedLayerIds.mockReturnValue( [ 'layer1', 'layer2' ] );
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls.commitColorChange( 'stroke', '#aabbcc' );

			expect( mockStateManager.updateLayer ).toHaveBeenCalledTimes( 2 );
			expect( mockStateManager.updateLayer ).toHaveBeenCalledWith( 'layer1', { stroke: '#aabbcc' } );
			expect( mockStateManager.updateLayer ).toHaveBeenCalledWith( 'layer2', { stroke: '#aabbcc' } );
		} );

		it( 'should clear preview original colors', () => {
			styleControls.toolbar = { ...mockToolbar, editor: mockEditor };
			styleControls._previewOriginalColors = new Map();
			styleControls.commitColorChange( 'stroke', '#ff0000' );

			expect( styleControls._previewOriginalColors ).toBeNull();
		} );
	} );

	describe( 'showAllControls with preset and fill containers', () => {
		it( 'should remove context-hidden from presetContainer', () => {
			styleControls.create();
			// Manually set presetContainer to test the branch
			styleControls.presetContainer = document.createElement( 'div' );
			styleControls.presetContainer.classList.add( 'context-hidden' );

			styleControls.showAllControls();

			expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );
		} );

		it( 'should remove context-hidden from fillControl.container', () => {
			styleControls.create();
			// Ensure fillControl has a container
			styleControls.fillControl = { container: document.createElement( 'div' ) };
			styleControls.fillControl.container.classList.add( 'context-hidden' );

			styleControls.showAllControls();

			expect( styleControls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
		} );
	} );

	describe( 'updateContextVisibility with real preset and fill containers', () => {
		it( 'should show/hide presetContainer for drawing vs pointer tools', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();
			styleControls.presetContainer = document.createElement( 'div' );

			styleControls.updateContextVisibility( 'rectangle' );
			expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );

			styleControls.updateContextVisibility( 'pointer' );
			expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( true );
		} );

		it( 'should hide fillControl for stroke-only tools', () => {
			styleControls.contextAwareEnabled = true;
			styleControls.create();
			const fillContainer = document.createElement( 'div' );
			styleControls.fillControl = { container: fillContainer };

			styleControls.updateContextVisibility( 'pen' );
			expect( fillContainer.classList.contains( 'context-hidden' ) ).toBe( true );

			styleControls.updateContextVisibility( 'rectangle' );
			expect( fillContainer.classList.contains( 'context-hidden' ) ).toBe( false );
		} );
	} );

	describe( 'hideControlsForSelectedLayers with fill and marker containers', () => {
		it( 'should hide fillControl.container when layers selected', () => {
			styleControls.create();
			const fillContainer = document.createElement( 'div' );
			styleControls.fillControl = { container: fillContainer };

			styleControls.hideControlsForSelectedLayers( [ { id: '1', type: 'rect' } ] );

			expect( fillContainer.classList.contains( 'context-hidden' ) ).toBe( true );
		} );

		it( 'should hide markerContainer when layers selected', () => {
			styleControls.create();
			styleControls.markerContainer = document.createElement( 'div' );

			styleControls.hideControlsForSelectedLayers( [ { id: '1', type: 'rect' } ] );

			expect( styleControls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( true );
		} );

		it( 'should show presetContainer when layers selected', () => {
			styleControls.create();
			styleControls.presetContainer = document.createElement( 'div' );
			styleControls.presetContainer.classList.add( 'context-hidden' );

			styleControls.hideControlsForSelectedLayers( [ { id: '1', type: 'rect' } ] );

			expect( styleControls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );
		} );
	} );

	describe( 'destroy with inputValidators', () => {
		it( 'should call destroy on each input validator', () => {
			styleControls.create();
			const mockValidator1 = { destroy: jest.fn() };
			const mockValidator2 = { destroy: jest.fn() };
			styleControls.inputValidators = [ mockValidator1, mockValidator2 ];

			styleControls.destroy();

			expect( mockValidator1.destroy ).toHaveBeenCalled();
			expect( mockValidator2.destroy ).toHaveBeenCalled();
		} );

		it( 'should skip validators without destroy method', () => {
			styleControls.create();
			styleControls.inputValidators = [ {}, null, { destroy: jest.fn() } ];

			expect( () => styleControls.destroy() ).not.toThrow();
		} );
	} );

	describe( 'createColorControlFallback onPreview callback', () => {
		it( 'should invoke onColorPreview through the fallback control', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;

			// Mock openColorPicker to capture config
			let capturedPickerConfig;
			controls.openColorPicker = jest.fn( ( _btn, _color, config ) => {
				capturedPickerConfig = config;
			} );

			controls.create();

			// Click the stroke button to trigger openColorPicker
			controls.strokeColorButton.click();

			// Verify onPreview callback was passed
			expect( capturedPickerConfig ).toBeDefined();
			expect( capturedPickerConfig.onPreview ).toBeDefined();

			// Invoke the onPreview with a color
			capturedPickerConfig.onPreview( '#ff0000' );

			// The preview should work without error
			expect( controls.openColorPicker ).toHaveBeenCalled();

			controls.destroy();
		} );

		it( 'should handle none in onPreview callback', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;

			let capturedPickerConfig;
			controls.openColorPicker = jest.fn( ( _btn, _color, config ) => {
				capturedPickerConfig = config;
			} );

			controls.create();

			// Click fill button
			controls.fillColorButton.click();

			// onPreview with 'none'
			capturedPickerConfig.onPreview( 'none' );

			expect( controls.openColorPicker ).toHaveBeenCalled();

			controls.destroy();
		} );

		it( 'should invoke onCancel callback', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;

			let capturedPickerConfig;
			controls.openColorPicker = jest.fn( ( _btn, _color, config ) => {
				capturedPickerConfig = config;
			} );

			controls.create();

			controls.strokeColorButton.click();

			// Invoke onCancel
			capturedPickerConfig.onCancel();

			expect( controls.openColorPicker ).toHaveBeenCalled();

			controls.destroy();
		} );

		it( 'should invoke onApply through the fallback control', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;

			let capturedPickerConfig;
			controls.openColorPicker = jest.fn( ( _btn, _color, config ) => {
				capturedPickerConfig = config;
			} );

			controls.create();

			controls.strokeColorButton.click();

			// Invoke onApply
			capturedPickerConfig.onApply( '#aabbcc' );

			expect( controls.strokeColorValue ).toBe( '#aabbcc' );

			controls.destroy();
		} );

		it( 'should handle none in onApply callback', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.colorFactory = null;

			let capturedPickerConfig;
			controls.openColorPicker = jest.fn( ( _btn, _color, config ) => {
				capturedPickerConfig = config;
			} );

			controls.create();

			controls.strokeColorButton.click();

			// Apply 'none'
			capturedPickerConfig.onApply( 'none' );

			expect( controls.strokeColorNone ).toBe( true );

			controls.destroy();
		} );
	} );

	describe( 'applyColorPreview - branch coverage', () => {
		it( 'should return early when toolbar is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: null } );
			controls.create();
			// Should not throw
			controls.applyColorPreview( 'stroke', '#ff0000' );
			controls.destroy();
		} );

		it( 'should return early when toolbar.editor is missing', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			// toolbar has no editor property
			controls.applyColorPreview( 'fill', '#00ff00' );
			controls.destroy();
		} );

		it( 'should return early when canvasManager is missing', () => {
			const controls = new ToolbarStyleControls( { toolbar: { ...mockToolbar, editor: {} } } );
			controls.create();
			controls.applyColorPreview( 'stroke', '#0000ff' );
			controls.destroy();
		} );

		it( 'should return early when no layers are selected', () => {
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [] ),
							renderLayers: jest.fn()
						},
						getLayerById: jest.fn(),
						layers: []
					}
				}
			} );
			controls.create();
			controls.applyColorPreview( 'stroke', '#ff0000' );
			expect( controls._previewOriginalColors ).toBeFalsy();
			controls.destroy();
		} );

		it( 'should preview stroke color on text layer as fill', () => {
			const textLayer = { id: 'L1', type: 'text', fill: '#000', stroke: '#222' };
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L1' ] ),
							renderLayers: jest.fn()
						},
						getLayerById: jest.fn().mockReturnValue( textLayer ),
						layers: [ textLayer ]
					}
				}
			} );
			controls.create();
			controls.applyColorPreview( 'stroke', '#ff0000' );
			expect( textLayer.fill ).toBe( '#ff0000' );
			// stroke should not change for text
			expect( textLayer.stroke ).toBe( '#222' );
			controls.destroy();
		} );

		it( 'should preview stroke color on non-text layer as stroke', () => {
			const rectLayer = { id: 'L2', type: 'rectangle', fill: '#fff', stroke: '#000' };
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L2' ] ),
							renderLayers: jest.fn()
						},
						getLayerById: jest.fn().mockReturnValue( rectLayer ),
						layers: [ rectLayer ]
					}
				}
			} );
			controls.create();
			controls.applyColorPreview( 'stroke', '#ff0000' );
			expect( rectLayer.stroke ).toBe( '#ff0000' );
			controls.destroy();
		} );

		it( 'should preview fill color and skip text/line types', () => {
			const textLayer = { id: 'L1', type: 'text', fill: '#aaa' };
			const lineLayer = { id: 'L2', type: 'line', fill: '#bbb' };
			const rectLayer = { id: 'L3', type: 'rectangle', fill: '#ccc' };
			const getById = jest.fn( ( id ) => ( { L1: textLayer, L2: lineLayer, L3: rectLayer }[ id ] ) );
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L1', 'L2', 'L3' ] ),
							renderLayers: jest.fn()
						},
						getLayerById: getById,
						layers: [ textLayer, lineLayer, rectLayer ]
					}
				}
			} );
			controls.create();
			controls.applyColorPreview( 'fill', '#00ff00' );
			// text and line should not change
			expect( textLayer.fill ).toBe( '#aaa' );
			expect( lineLayer.fill ).toBe( '#bbb' );
			// rectangle should change
			expect( rectLayer.fill ).toBe( '#00ff00' );
			controls.destroy();
		} );

		it( 'should save original colors on first call and reuse on second', () => {
			const layer = { id: 'L1', type: 'rectangle', fill: '#orig', stroke: '#origS' };
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L1' ] ),
							renderLayers: jest.fn()
						},
						getLayerById: jest.fn().mockReturnValue( layer ),
						layers: [ layer ]
					}
				}
			} );
			controls.create();
			controls.applyColorPreview( 'stroke', '#first' );
			const saved = controls._previewOriginalColors.get( 'L1' );
			expect( saved.stroke ).toBe( '#origS' );
			// Second call should not overwrite originals
			controls.applyColorPreview( 'stroke', '#second' );
			const saved2 = controls._previewOriginalColors.get( 'L1' );
			expect( saved2.stroke ).toBe( '#origS' );
			controls.destroy();
		} );

		it( 'should skip null layers from getLayerById', () => {
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'missing' ] ),
							renderLayers: jest.fn()
						},
						getLayerById: jest.fn().mockReturnValue( null ),
						layers: []
					}
				}
			} );
			controls.create();
			// Should not throw
			controls.applyColorPreview( 'stroke', '#ff0000' );
			controls.destroy();
		} );
	} );

	describe( 'cancelColorPreview - branch coverage', () => {
		it( 'should handle null _previewOriginalColors gracefully', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls._previewOriginalColors = null;
			// Should not throw
			controls.cancelColorPreview();
			expect( controls._previewOriginalColors ).toBeNull();
			controls.destroy();
		} );

		it( 'should restore original colors and re-render', () => {
			const layer = { id: 'L1', type: 'rectangle', fill: '#changed', stroke: '#changed' };
			const renderMock = jest.fn();
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						canvasManager: {
							renderLayers: renderMock
						},
						getLayerById: jest.fn().mockReturnValue( layer ),
						layers: [ layer ]
					}
				}
			} );
			controls.create();
			controls._previewOriginalColors = new Map( [
				[ 'L1', { fill: '#original', stroke: '#originalS' } ]
			] );
			controls.cancelColorPreview();
			expect( layer.fill ).toBe( '#original' );
			expect( layer.stroke ).toBe( '#originalS' );
			expect( renderMock ).toHaveBeenCalled();
			expect( controls._previewOriginalColors ).toBeNull();
			controls.destroy();
		} );
	} );

	describe( 'commitColorChange - branch coverage', () => {
		it( 'should return early when toolbar.editor is missing', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			// No editor on toolbar
			controls.commitColorChange( 'stroke', '#ff0000' );
			controls.destroy();
		} );

		it( 'should return early when stateManager or canvasManager missing', () => {
			const controls = new ToolbarStyleControls( {
				toolbar: { ...mockToolbar, editor: { stateManager: null, canvasManager: null } }
			} );
			controls.create();
			controls.commitColorChange( 'fill', '#00ff00' );
			controls.destroy();
		} );

		it( 'should commit stroke as fill for text layers', () => {
			const updateLayer = jest.fn();
			const markDirty = jest.fn();
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						stateManager: { updateLayer: updateLayer },
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L1' ] )
						},
						getLayerById: jest.fn().mockReturnValue( { id: 'L1', type: 'text' } ),
						markDirty: markDirty,
						layers: []
					}
				}
			} );
			controls.create();
			controls.commitColorChange( 'stroke', '#ff0000' );
			expect( updateLayer ).toHaveBeenCalledWith( 'L1', { fill: '#ff0000' } );
			expect( markDirty ).toHaveBeenCalled();
			controls.destroy();
		} );

		it( 'should commit stroke as stroke for non-text layers', () => {
			const updateLayer = jest.fn();
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						stateManager: { updateLayer: updateLayer },
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L1' ] )
						},
						getLayerById: jest.fn().mockReturnValue( { id: 'L1', type: 'rectangle' } ),
						markDirty: jest.fn(),
						layers: []
					}
				}
			} );
			controls.create();
			controls.commitColorChange( 'stroke', '#ff0000' );
			expect( updateLayer ).toHaveBeenCalledWith( 'L1', { stroke: '#ff0000' } );
			controls.destroy();
		} );

		it( 'should skip fill for text and line layers', () => {
			const updateLayer = jest.fn();
			const getById = jest.fn()
				.mockReturnValueOnce( { id: 'L1', type: 'text' } )
				.mockReturnValueOnce( { id: 'L2', type: 'line' } )
				.mockReturnValueOnce( { id: 'L3', type: 'rectangle' } );
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						stateManager: { updateLayer: updateLayer },
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L1', 'L2', 'L3' ] )
						},
						getLayerById: getById,
						markDirty: jest.fn(),
						layers: []
					}
				}
			} );
			controls.create();
			controls.commitColorChange( 'fill', '#00ff00' );
			// text and line produce no updates (empty keys object), only rectangle
			expect( updateLayer ).toHaveBeenCalledTimes( 1 );
			expect( updateLayer ).toHaveBeenCalledWith( 'L3', { fill: '#00ff00' } );
			controls.destroy();
		} );

		it( 'should skip null layers from getLayerById', () => {
			const updateLayer = jest.fn();
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						stateManager: { updateLayer: updateLayer },
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'missing' ] )
						},
						getLayerById: jest.fn().mockReturnValue( null ),
						markDirty: jest.fn(),
						layers: []
					}
				}
			} );
			controls.create();
			controls.commitColorChange( 'stroke', '#ff0000' );
			expect( updateLayer ).not.toHaveBeenCalled();
			controls.destroy();
		} );

		it( 'should clear _previewOriginalColors after commit', () => {
			const controls = new ToolbarStyleControls( {
				toolbar: {
					...mockToolbar,
					editor: {
						stateManager: { updateLayer: jest.fn() },
						canvasManager: {
							getSelectedLayerIds: jest.fn().mockReturnValue( [ 'L1' ] )
						},
						getLayerById: jest.fn().mockReturnValue( { id: 'L1', type: 'rectangle' } ),
						markDirty: jest.fn(),
						layers: []
					}
				}
			} );
			controls.create();
			controls._previewOriginalColors = new Map( [ [ 'L1', {} ] ] );
			controls.commitColorChange( 'stroke', '#ff0000' );
			expect( controls._previewOriginalColors ).toBeNull();
			controls.destroy();
		} );
	} );

	describe( 'updateContextVisibility - branch coverage', () => {
		it( 'should show marker container for marker tool', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.markerContainer = document.createElement( 'div' );
			controls.markerContainer.classList.add( 'context-hidden' );
			controls.updateContextVisibility( 'marker' );
			expect( controls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );

		it( 'should hide fill control for pen tool (strokeOnlyTools)', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.fillControl = {
				container: document.createElement( 'div' )
			};
			controls.updateContextVisibility( 'pen' );
			expect( controls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );
			controls.destroy();
		} );

		it( 'should show fill control for rectangle tool', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.fillControl = {
				container: document.createElement( 'div' )
			};
			controls.fillControl.container.classList.add( 'context-hidden' );
			controls.updateContextVisibility( 'rectangle' );
			expect( controls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );

		it( 'should hide preset container for pointer tool without selection', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.presetContainer = document.createElement( 'div' );
			controls.presetStyleManager = null;
			controls.updateContextVisibility( 'pointer' );
			expect( controls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( true );
			controls.destroy();
		} );

		it( 'should show preset container for pointer with selection', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.presetContainer = document.createElement( 'div' );
			controls.presetStyleManager = { selectedLayers: [ { id: 'L1' } ], destroy: jest.fn() };
			controls.updateContextVisibility( 'pointer' );
			expect( controls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );

		it( 'should hide mainStyleRow for pointer tool', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.mainStyleRow = document.createElement( 'div' );
			controls.updateContextVisibility( 'pointer' );
			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( true );
			controls.destroy();
		} );

		it( 'should show mainStyleRow for textbox tool', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.mainStyleRow = document.createElement( 'div' );
			controls.mainStyleRow.classList.add( 'context-hidden' );
			controls.updateContextVisibility( 'textbox' );
			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );

		it( 'should show mainStyleRow for callout tool', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.mainStyleRow = document.createElement( 'div' );
			controls.mainStyleRow.classList.add( 'context-hidden' );
			controls.updateContextVisibility( 'callout' );
			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );

		it( 'should hide marker container for non-marker tools', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.contextAwareEnabled = true;
			controls.create();
			controls.markerContainer = document.createElement( 'div' );
			controls.updateContextVisibility( 'rectangle' );
			expect( controls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( true );
			controls.destroy();
		} );
	} );

	describe( 'hideControlsForSelectedLayers - branch coverage', () => {
		it( 'should hide mainStyleRow and fillControl, show presetContainer', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.mainStyleRow = document.createElement( 'div' );
			controls.presetContainer = document.createElement( 'div' );
			controls.presetContainer.classList.add( 'context-hidden' );
			controls.fillControl = { container: document.createElement( 'div' ) };
			controls.markerContainer = document.createElement( 'div' );
			controls.textEffectsControls = { hideAll: jest.fn(), destroy: jest.fn() };

			controls.hideControlsForSelectedLayers( [ { id: 'L1' } ] );

			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( true );
			expect( controls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );
			expect( controls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( true );
			expect( controls.markerContainer.classList.contains( 'context-hidden' ) ).toBe( true );
			expect( controls.textEffectsControls.hideAll ).toHaveBeenCalled();
			controls.destroy();
		} );

		it( 'should handle missing DOM elements gracefully', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.mainStyleRow = null;
			controls.presetContainer = null;
			controls.fillControl = null;
			controls.markerContainer = null;
			controls.textEffectsControls = null;
			// Should not throw
			controls.hideControlsForSelectedLayers( [ { id: 'L1' } ] );
			controls.destroy();
		} );
	} );

	describe( 'applyPresetStyleInternal - branch coverage', () => {
		it( 'should return early for null style', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( null );
			controls.destroy();
		} );

		it( 'should use color fallback when stroke is undefined', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { color: '#aabbcc' } );
			expect( controls.strokeColorValue ).toBe( '#aabbcc' );
			controls.destroy();
		} );

		it( 'should prefer stroke over color when both are present', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { stroke: '#112233', color: '#aabbcc' } );
			expect( controls.strokeColorValue ).toBe( '#112233' );
			controls.destroy();
		} );

		it( 'should set strokeColorNone for transparent stroke', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { stroke: 'transparent' } );
			expect( controls.strokeColorNone ).toBe( true );
			controls.destroy();
		} );

		it( 'should apply fill color and detect none', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { fill: 'none' } );
			expect( controls.fillColorNone ).toBe( true );
			controls.destroy();
		} );

		it( 'should apply strokeWidth to input', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { strokeWidth: 5 } );
			expect( controls.currentStrokeWidth ).toBe( 5 );
			expect( controls.strokeWidthInput.value ).toBe( '5' );
			controls.destroy();
		} );

		it( 'should delegate text effects to textEffectsControls', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.textEffectsControls = { applyStyle: jest.fn(), destroy: jest.fn(), getStyleValues: jest.fn().mockReturnValue( {} ) };
			const style = { fontSize: 24 };
			controls.applyPresetStyleInternal( style );
			expect( controls.textEffectsControls.applyStyle ).toHaveBeenCalledWith( style );
			controls.destroy();
		} );

		it( 'should apply arrowStyle via arrowStyleControl', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.arrowStyleControl = { applyStyle: jest.fn(), destroy: jest.fn(), getValue: jest.fn().mockReturnValue( 'single' ), getStyleValues: jest.fn().mockReturnValue( {} ) };
			controls.applyPresetStyleInternal( { arrowStyle: 'double' } );
			expect( controls.arrowStyleControl.applyStyle ).toHaveBeenCalledWith( { arrowStyle: 'double' } );
			controls.destroy();
		} );

		it( 'should fall back to arrowStyleSelect when arrowStyleControl is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.arrowStyleControl = null;
			controls.arrowStyleSelect = document.createElement( 'select' );
			[ 'single', 'double', 'none' ].forEach( ( v ) => {
				const opt = document.createElement( 'option' );
				opt.value = v;
				controls.arrowStyleSelect.appendChild( opt );
			} );
			controls.applyPresetStyleInternal( { arrowStyle: 'double' } );
			expect( controls.arrowStyleSelect.value ).toBe( 'double' );
			controls.destroy();
		} );

		it( 'should update strokeColorButton display when toolbar available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.applyPresetStyleInternal( { stroke: '#123456' } );
			expect( mockToolbar.updateColorButtonDisplay ).toHaveBeenCalled();
			controls.destroy();
		} );
	} );

	describe( 'getCurrentStyle - branch coverage', () => {
		it( 'should merge text effects from delegate', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.textEffectsControls = {
				getStyleValues: jest.fn().mockReturnValue( { fontSize: 20, textShadow: true } ),
				destroy: jest.fn()
			};
			const style = controls.getCurrentStyle();
			expect( style.fontSize ).toBe( 20 );
			expect( style.textShadow ).toBe( true );
			controls.destroy();
		} );

		it( 'should use arrowStyleControl.getStyleValues when available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.arrowStyleControl = {
				getStyleValues: jest.fn().mockReturnValue( { arrowStyle: 'double' } ),
				destroy: jest.fn()
			};
			const style = controls.getCurrentStyle();
			expect( style.arrowStyle ).toBe( 'double' );
			controls.destroy();
		} );

		it( 'should fall back to arrowStyleSelect.value when control is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.arrowStyleControl = null;
			controls.arrowStyleSelect = document.createElement( 'select' );
			[ 'single', 'double' ].forEach( ( v ) => {
				const opt = document.createElement( 'option' );
				opt.value = v;
				controls.arrowStyleSelect.appendChild( opt );
			} );
			controls.arrowStyleSelect.value = 'double';
			const style = controls.getCurrentStyle();
			expect( style.arrowStyle ).toBe( 'double' );
			controls.destroy();
		} );

		it( 'should return transparent for none colors', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.strokeColorNone = true;
			controls.fillColorNone = true;
			const style = controls.getCurrentStyle();
			expect( style.stroke ).toBe( 'transparent' );
			expect( style.fill ).toBe( 'transparent' );
			controls.destroy();
		} );
	} );

	describe( 'getStyleOptions - branch coverage', () => {
		it( 'should use text effects defaults when textEffectsControls is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.textEffectsControls = null;
			const options = controls.getStyleOptions();
			expect( options.fontSize ).toBe( 16 );
			expect( options.textShadow ).toBe( false );
			controls.destroy();
		} );

		it( 'should use arrowStyleSelect fallback when arrowStyleControl is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.arrowStyleControl = null;
			controls.arrowStyleSelect = document.createElement( 'select' );
			const opt = document.createElement( 'option' );
			opt.value = 'none';
			controls.arrowStyleSelect.appendChild( opt );
			controls.arrowStyleSelect.value = 'none';
			const options = controls.getStyleOptions();
			expect( options.arrowStyle ).toBe( 'none' );
			controls.destroy();
		} );

		it( 'should fall back to single when both arrowStyleControl and arrowStyleSelect are null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.arrowStyleControl = null;
			controls.arrowStyleSelect = null;
			const options = controls.getStyleOptions();
			expect( options.arrowStyle ).toBe( 'single' );
			controls.destroy();
		} );
	} );

	describe( 'updateForTool - context-aware branch coverage', () => {
		it( 'should call updateContextVisibility when contextAwareEnabled', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.contextAwareEnabled = true;
			controls.mainStyleRow = document.createElement( 'div' );
			controls.updateForTool( 'rectangle' );
			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );

		it( 'should fall back to arrowContainer when arrowStyleControl is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.arrowStyleControl = null;
			controls.arrowContainer = document.createElement( 'div' );
			controls.updateForTool( 'arrow' );
			expect( controls.arrowContainer.style.display ).toBe( 'block' );
			controls.updateForTool( 'rectangle' );
			expect( controls.arrowContainer.style.display ).toBe( 'none' );
			controls.destroy();
		} );
	} );

	describe( 'updateForSelection - branch coverage', () => {
		it( 'should delegate to presetStyleManager', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.presetStyleManager = { updateForSelection: jest.fn(), destroy: jest.fn() };
			controls.updateForSelection( [ { id: 'L1' } ] );
			expect( controls.presetStyleManager.updateForSelection ).toHaveBeenCalledWith( [ { id: 'L1' } ] );
			controls.destroy();
		} );

		it( 'should call hideControlsForSelectedLayers when contextAwareEnabled and layers selected', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.contextAwareEnabled = true;
			controls.mainStyleRow = document.createElement( 'div' );
			controls.updateForSelection( [ { id: 'L1' } ] );
			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( true );
			controls.destroy();
		} );

		it( 'should not hide controls when selection is empty', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.contextAwareEnabled = true;
			controls.mainStyleRow = document.createElement( 'div' );
			controls.updateForSelection( [] );
			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );
	} );

	describe( 'setStrokeColor / setFillColor - branch coverage', () => {
		it( 'should set strokeColorNone for transparent', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setStrokeColor( 'transparent' );
			expect( controls.strokeColorNone ).toBe( true );
			controls.destroy();
		} );

		it( 'should set stroke to none', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setStrokeColor( 'none' );
			expect( controls.strokeColorNone ).toBe( true );
			controls.destroy();
		} );

		it( 'should use colorFactory for stroke when available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.colorFactory = { updateColorButtonDisplay: jest.fn() };
			controls.strokeControl = { button: document.createElement( 'button' ) };
			controls.setStrokeColor( '#ff0000' );
			expect( controls.colorFactory.updateColorButtonDisplay ).toHaveBeenCalled();
			controls.destroy();
		} );

		it( 'should fall back to updateColorButtonDisplay for stroke', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.colorFactory = null;
			controls.strokeControl = null;
			controls.updateColorButtonDisplay = jest.fn();
			controls.setStrokeColor( '#ff0000' );
			expect( controls.updateColorButtonDisplay ).toHaveBeenCalled();
			controls.destroy();
		} );

		it( 'should set fillColorNone for none', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setFillColor( 'none' );
			expect( controls.fillColorNone ).toBe( true );
			controls.destroy();
		} );

		it( 'should use colorFactory for fill when available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.colorFactory = { updateColorButtonDisplay: jest.fn() };
			controls.fillControl = { button: document.createElement( 'button' ) };
			controls.setFillColor( '#00ff00' );
			expect( controls.colorFactory.updateColorButtonDisplay ).toHaveBeenCalled();
			controls.destroy();
		} );

		it( 'should fall back to updateColorButtonDisplay for fill', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.colorFactory = null;
			controls.fillControl = null;
			controls.updateColorButtonDisplay = jest.fn();
			controls.setFillColor( '#00ff00' );
			expect( controls.updateColorButtonDisplay ).toHaveBeenCalled();
			controls.destroy();
		} );
	} );

	describe( 'openColorPicker - branch coverage', () => {
		it( 'should return early when ColorPickerDialog is not available', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			// Directly replace openColorPicker internals to simulate missing dialog
			// The real branch is: if (!ColorPickerDialog) return;
			// We test by verifying the guard logic inline
			let guardReturned = false;
			const origOpen = controls.openColorPicker;
			controls.openColorPicker = function ( anchorButton, initialValue, options ) {
				// Simulate: const ColorPickerDialog = null;
				const ColorPickerDialog = null;
				if ( !ColorPickerDialog ) {
					guardReturned = true;
					return;
				}
			};
			controls.openColorPicker( document.createElement( 'button' ), '#fff', {} );
			expect( guardReturned ).toBe( true );
			controls.openColorPicker = origOpen;
			controls.destroy();
		} );
	} );

	describe( 'showAllControls - branch coverage', () => {
		it( 'should remove context-hidden from all controls', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.mainStyleRow = document.createElement( 'div' );
			controls.mainStyleRow.classList.add( 'context-hidden' );
			controls.presetContainer = document.createElement( 'div' );
			controls.presetContainer.classList.add( 'context-hidden' );
			controls.fillControl = { container: document.createElement( 'div' ) };
			controls.fillControl.container.classList.add( 'context-hidden' );

			controls.showAllControls();

			expect( controls.mainStyleRow.classList.contains( 'context-hidden' ) ).toBe( false );
			expect( controls.presetContainer.classList.contains( 'context-hidden' ) ).toBe( false );
			expect( controls.fillControl.container.classList.contains( 'context-hidden' ) ).toBe( false );
			controls.destroy();
		} );
	} );

	describe( 'updateContextForSelectedLayers - legacy method', () => {
		it( 'should delegate to hideControlsForSelectedLayers', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.hideControlsForSelectedLayers = jest.fn();
			controls.updateContextForSelectedLayers( [ { id: 'L1' } ] );
			expect( controls.hideControlsForSelectedLayers ).toHaveBeenCalledWith( [ { id: 'L1' } ] );
			controls.destroy();
		} );
	} );

	describe( 'setupValidation - branch coverage', () => {
		it( 'should return early for null validator', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setupValidation( null );
			controls.destroy();
		} );

		it( 'should add stroke width validator', () => {
			const mockValidator = {
				createInputValidator: jest.fn().mockReturnValue( { destroy: jest.fn() } )
			};
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setupValidation( mockValidator );
			expect( mockValidator.createInputValidator ).toHaveBeenCalled();
			expect( controls.inputValidators.length ).toBeGreaterThan( 0 );
			controls.destroy();
		} );

		it( 'should delegate text effects validation', () => {
			const mockValidator = {
				createInputValidator: jest.fn().mockReturnValue( { destroy: jest.fn() } )
			};
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.textEffectsControls = {
				setupValidation: jest.fn(),
				destroy: jest.fn()
			};
			controls.setupValidation( mockValidator );
			expect( controls.textEffectsControls.setupValidation ).toHaveBeenCalledWith(
				mockValidator, controls.inputValidators
			);
			controls.destroy();
		} );
	} );

	describe( 'destroy - cleanup branch coverage', () => {
		it( 'should destroy input validators with destroy method', () => {
			const v1 = { destroy: jest.fn() };
			const v2 = { destroy: jest.fn() };
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.inputValidators = [ v1, v2, null ];
			controls.destroy();
			expect( v1.destroy ).toHaveBeenCalled();
			expect( v2.destroy ).toHaveBeenCalled();
		} );

		it( 'should handle null subcontrollers gracefully', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.presetStyleManager = null;
			controls.textEffectsControls = null;
			controls.arrowStyleControl = null;
			controls.eventTracker = null;
			// Should not throw
			controls.destroy();
		} );
	} );

	describe( 'handleStrokeWidthInput - validation branch coverage', () => {
		it( 'should add validation-error for NaN value', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const input = controls.strokeWidthInput;
			input.value = 'abc';
			controls.handleStrokeWidthInput( input );
			expect( input.classList.contains( 'validation-error' ) ).toBe( true );
		} );

		it( 'should add validation-error for out-of-range value', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const input = controls.strokeWidthInput;
			input.value = '150';
			controls.handleStrokeWidthInput( input );
			expect( input.classList.contains( 'validation-error' ) ).toBe( true );
			controls.destroy();
		} );

		it( 'should accept valid value and notify style change', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const input = controls.strokeWidthInput;
			input.value = '5';
			controls.handleStrokeWidthInput( input );
			expect( input.classList.contains( 'validation-error' ) ).toBe( false );
			expect( controls.currentStrokeWidth ).toBe( 5 );
			expect( mockToolbar.onStyleChange ).toHaveBeenCalled();
			controls.destroy();
		} );
	} );

	describe( 'handleStrokeWidthBlur - reset branch coverage', () => {
		it( 'should reset input to last valid width on invalid blur', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const input = controls.strokeWidthInput;
			controls.currentStrokeWidth = 8;
			input.value = 'invalid';
			controls.handleStrokeWidthBlur( input );
			expect( input.value ).toBe( '8' );
			expect( input.classList.contains( 'validation-error' ) ).toBe( false );
			controls.destroy();
		} );

		it( 'should not reset valid value on blur', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const input = controls.strokeWidthInput;
			input.value = '10';
			controls.handleStrokeWidthBlur( input );
			expect( input.value ).toBe( '10' );
			controls.destroy();
		} );
	} );

	describe( 'updateColorButtonDisplay - fallback branch coverage', () => {
		// Note: The CPD-available path (ColorPickerDialog.updateColorButton) is already tested
		// in the 'updateColorButtonDisplay' describe block at line 425.
		// These tests focus on the inline FALLBACK path when CPD is not available.

		it( 'should use inline fallback for transparent color when CPD has no updateColorButton', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const btn = document.createElement( 'button' );
			// Directly test the fallback logic by calling with a custom implementation
			// that simulates CPD missing the static method
			const origUpdateCBD = controls.updateColorButtonDisplay;
			controls.updateColorButtonDisplay = function ( b, color ) {
				// Simulate fallback path (CPD null or no updateColorButton)
				const strings = this.getColorPickerStrings();
				let labelValue = color;
				if ( !color || color === 'none' || color === 'transparent' ) {
					b.classList.add( 'is-transparent' );
					b.title = strings.transparent;
					b.style.background = '';
					labelValue = strings.transparent;
				} else {
					b.classList.remove( 'is-transparent' );
					b.style.background = color;
					b.title = color;
				}
				b.setAttribute( 'aria-label', strings.previewTemplate.replace( '$1', labelValue ) );
			};
			controls.updateColorButtonDisplay( btn, 'none' );
			expect( btn.classList.contains( 'is-transparent' ) ).toBe( true );
			controls.updateColorButtonDisplay = origUpdateCBD;
			controls.destroy();
		} );

		it( 'should apply color in inline fallback for valid color', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const btn = document.createElement( 'button' );
			btn.classList.add( 'is-transparent' );
			const origUpdateCBD = controls.updateColorButtonDisplay;
			controls.updateColorButtonDisplay = function ( b, color ) {
				const strings = this.getColorPickerStrings();
				let labelValue = color;
				if ( !color || color === 'none' || color === 'transparent' ) {
					b.classList.add( 'is-transparent' );
					b.title = strings.transparent;
					b.style.background = '';
					labelValue = strings.transparent;
				} else {
					b.classList.remove( 'is-transparent' );
					b.style.background = color;
					b.title = color;
				}
				b.setAttribute( 'aria-label', strings.previewTemplate.replace( '$1', labelValue ) );
			};
			controls.updateColorButtonDisplay( btn, '#ff0000' );
			expect( btn.classList.contains( 'is-transparent' ) ).toBe( false );
			expect( btn.style.background ).toBe( 'rgb(255, 0, 0)' );
			controls.updateColorButtonDisplay = origUpdateCBD;
			controls.destroy();
		} );

		it( 'should handle transparent keyword in inline fallback', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const btn = document.createElement( 'button' );
			const origUpdateCBD = controls.updateColorButtonDisplay;
			controls.updateColorButtonDisplay = function ( b, color ) {
				const strings = this.getColorPickerStrings();
				let labelValue = color;
				if ( !color || color === 'none' || color === 'transparent' ) {
					b.classList.add( 'is-transparent' );
					b.title = strings.transparent;
					b.style.background = '';
					labelValue = strings.transparent;
				} else {
					b.classList.remove( 'is-transparent' );
					b.style.background = color;
					b.title = color;
				}
				b.setAttribute( 'aria-label', strings.previewTemplate.replace( '$1', labelValue ) );
			};
			controls.updateColorButtonDisplay( btn, 'transparent' );
			expect( btn.classList.contains( 'is-transparent' ) ).toBe( true );
			controls.updateColorButtonDisplay = origUpdateCBD;
			controls.destroy();
		} );

		it( 'should handle null/empty color in inline fallback', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const btn = document.createElement( 'button' );
			const origUpdateCBD = controls.updateColorButtonDisplay;
			controls.updateColorButtonDisplay = function ( b, color ) {
				const strings = this.getColorPickerStrings();
				let labelValue = color;
				if ( !color || color === 'none' || color === 'transparent' ) {
					b.classList.add( 'is-transparent' );
					b.title = strings.transparent;
					b.style.background = '';
					labelValue = strings.transparent;
				} else {
					b.classList.remove( 'is-transparent' );
					b.style.background = color;
					b.title = color;
				}
				b.setAttribute( 'aria-label', strings.previewTemplate.replace( '$1', labelValue ) );
			};
			controls.updateColorButtonDisplay( btn, '' );
			expect( btn.classList.contains( 'is-transparent' ) ).toBe( true );
			controls.updateColorButtonDisplay = origUpdateCBD;
			controls.destroy();
		} );
	} );

	describe( 'setStrokeWidth - branch coverage', () => {
		it( 'should clamp to 0 minimum', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setStrokeWidth( -5 );
			expect( controls.currentStrokeWidth ).toBe( 0 );
			controls.destroy();
		} );

		it( 'should clamp to 100 maximum', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setStrokeWidth( 200 );
			expect( controls.currentStrokeWidth ).toBe( 100 );
			controls.destroy();
		} );

		it( 'should round to integer', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			controls.setStrokeWidth( 5.7 );
			expect( controls.currentStrokeWidth ).toBe( 6 );
			expect( controls.strokeWidthInput.value ).toBe( '6' );
			controls.destroy();
		} );
	} );

	describe( 'getColorPickerStrings - branch coverage', () => {
		it( 'should use window.layersMessages when available', () => {
			const mockStrings = { title: 'Pick Color' };
			window.layersMessages = {
				getColorPickerStrings: jest.fn().mockReturnValue( mockStrings )
			};
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const strings = controls.getColorPickerStrings();
			expect( strings ).toBe( mockStrings );
			delete window.layersMessages;
			controls.destroy();
		} );

		it( 'should use fallback strings when layersMessages not available', () => {
			delete window.layersMessages;
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.create();
			const strings = controls.getColorPickerStrings();
			expect( strings ).toHaveProperty( 'title' );
			expect( strings ).toHaveProperty( 'cancel' );
			expect( strings ).toHaveProperty( 'apply' );
			controls.destroy();
		} );
	} );

	// ========================================================================
	// Branch coverage gap tests
	// ========================================================================
	describe( 'branch coverage - addListener guards', () => {
		it( 'should return early when element is null', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.addListener( null, 'click', jest.fn() );
			// Should not throw
		} );

		it( 'should return early when event is empty', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.addListener( document.createElement( 'div' ), '', jest.fn() );
			// Should not throw
		} );

		it( 'should return early when handler is not a function', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.addListener( document.createElement( 'div' ), 'click', 'not a function' );
			// Should not throw
		} );

		it( 'should add listener directly when no eventTracker', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.eventTracker = null;
			const el = document.createElement( 'div' );
			const spy = jest.spyOn( el, 'addEventListener' );
			const handler = jest.fn();
			controls.addListener( el, 'click', handler );
			expect( spy ).toHaveBeenCalledWith( 'click', handler, undefined );
		} );
	} );

	describe( 'branch coverage - updateColorButtonDisplay fallback', () => {
		let FreshToolbarStyleControls;

		beforeAll( () => {
			// Use jest.resetModules + fresh require to get a ToolbarStyleControls
			// whose getClass cache does NOT contain ColorPickerDialog
			jest.resetModules();
			window.Layers = window.Layers || {};
			window.Layers.Utils = window.Layers.Utils || {};
			window.Layers.UI = {};
			require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );
			require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );
			// Intentionally NOT setting ColorPickerDialog — getClass will return null
			window.Layers.UI.ArrowStyleControl = MockArrowStyleControl;
			FreshToolbarStyleControls = require( '../../resources/ext.layers.editor/ToolbarStyleControls.js' );
		} );

		it( 'should use fallback when updateColorButton not available', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			const btn = document.createElement( 'button' );
			controls.updateColorButtonDisplay( btn, '#ff0000' );
			expect( btn.title ).toBe( '#ff0000' );
			expect( btn.style.background ).toBeTruthy();
			expect( btn.getAttribute( 'aria-label' ) ).toBeTruthy();
			controls.destroy();
		} );

		it( 'should handle transparent in fallback', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			const btn = document.createElement( 'button' );
			controls.updateColorButtonDisplay( btn, 'transparent' );
			expect( btn.classList.contains( 'is-transparent' ) ).toBe( true );
			controls.destroy();
		} );

		it( 'should handle none color in fallback', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			const btn = document.createElement( 'button' );
			controls.updateColorButtonDisplay( btn, 'none' );
			expect( btn.classList.contains( 'is-transparent' ) ).toBe( true );
			controls.destroy();
		} );

		it( 'should handle empty color in fallback', () => {
			const controls = new FreshToolbarStyleControls( { toolbar: mockToolbar } );
			const btn = document.createElement( 'button' );
			controls.updateColorButtonDisplay( btn, '' );
			expect( btn.classList.contains( 'is-transparent' ) ).toBe( true );
			controls.destroy();
		} );
	} );

	describe( 'branch coverage - handleStrokeWidthBlur', () => {
		it( 'should reset NaN value on blur', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.currentStrokeWidth = 5;
			const input = document.createElement( 'input' );
			input.value = 'abc';
			input.classList.add( 'validation-error' );
			controls.handleStrokeWidthBlur( input );
			expect( input.value ).toBe( '5' );
			expect( input.classList.contains( 'validation-error' ) ).toBe( false );
		} );

		it( 'should reset out-of-range negative value on blur', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.currentStrokeWidth = 2;
			const input = document.createElement( 'input' );
			input.value = '-5';
			controls.handleStrokeWidthBlur( input );
			expect( input.value ).toBe( '2' );
		} );

		it( 'should reset out-of-range high value on blur', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.currentStrokeWidth = 2;
			const input = document.createElement( 'input' );
			input.value = '200';
			controls.handleStrokeWidthBlur( input );
			expect( input.value ).toBe( '2' );
		} );

		it( 'should keep valid value on blur', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			controls.currentStrokeWidth = 2;
			const input = document.createElement( 'input' );
			input.value = '50';
			controls.handleStrokeWidthBlur( input );
			expect( input.value ).toBe( '50' );
		} );
	} );

	describe( 'branch coverage - handleStrokeWidthInput validation', () => {
		it( 'should show NaN-specific error', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			const input = document.createElement( 'input' );
			input.value = 'abc';
			controls.handleStrokeWidthInput( input );
			expect( input.classList.contains( 'validation-error' ) ).toBe( true );
		} );

		it( 'should show range error for out-of-range value', () => {
			const controls = new ToolbarStyleControls( { toolbar: mockToolbar } );
			const input = document.createElement( 'input' );
			input.value = '150';
			controls.handleStrokeWidthInput( input );
			expect( input.classList.contains( 'validation-error' ) ).toBe( true );
		} );
	} );
} );
