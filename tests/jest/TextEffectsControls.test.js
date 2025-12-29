/**
 * Tests for TextEffectsControls module
 */

'use strict';

// Setup namespace structure
window.Layers = window.Layers || {};
window.Layers.Utils = window.Layers.Utils || {};
window.Layers.UI = window.Layers.UI || {};
require( '../../resources/ext.layers.editor/utils/NamespaceHelper.js' );

const TextEffectsControls = require( '../../resources/ext.layers.editor/ui/TextEffectsControls.js' );

describe( 'TextEffectsControls', () => {
	let textEffects;
	let mockMsg;
	let mockAddListener;
	let mockNotifyStyleChange;

	beforeEach( () => {
		jest.clearAllMocks();

		mockMsg = jest.fn( ( key, fallback ) => fallback || key );
		mockAddListener = jest.fn( ( element, event, handler ) => {
			if ( element && typeof handler === 'function' ) {
				element.addEventListener( event, handler );
			}
		} );
		mockNotifyStyleChange = jest.fn();

		textEffects = new TextEffectsControls( {
			msg: mockMsg,
			addListener: mockAddListener,
			notifyStyleChange: mockNotifyStyleChange
		} );
	} );

	afterEach( () => {
		if ( textEffects ) {
			textEffects.destroy();
		}
	} );

	describe( 'constructor', () => {
		it( 'should initialize with default config', () => {
			const te = new TextEffectsControls();
			expect( te ).toBeDefined();
			expect( te.fontSizeInput ).toBeNull();
			te.destroy();
		} );

		it( 'should accept custom config', () => {
			expect( textEffects.msgFn ).toBe( mockMsg );
			expect( textEffects.addListenerFn ).toBe( mockAddListener );
			expect( textEffects.notifyStyleChangeFn ).toBe( mockNotifyStyleChange );
		} );

		it( 'should use fallback msg function if none provided', () => {
			const te = new TextEffectsControls( {} );
			expect( te.msg( 'test-key', 'fallback' ) ).toBe( 'fallback' );
			te.destroy();
		} );
	} );

	describe( 'msg', () => {
		it( 'should delegate to msgFn', () => {
			textEffects.msg( 'test-key', 'Test Value' );
			expect( mockMsg ).toHaveBeenCalledWith( 'test-key', 'Test Value' );
		} );
	} );

	describe( 'createFontSizeControl', () => {
		it( 'should create font size container', () => {
			const container = textEffects.createFontSizeControl();

			expect( container ).toBeInstanceOf( HTMLElement );
			expect( container.className ).toContain( 'font-size-container' );
		} );

		it( 'should create font size input', () => {
			textEffects.createFontSizeControl();

			expect( textEffects.fontSizeInput ).toBeInstanceOf( HTMLInputElement );
			expect( textEffects.fontSizeInput.type ).toBe( 'number' );
			expect( textEffects.fontSizeInput.min ).toBe( '8' );
			expect( textEffects.fontSizeInput.max ).toBe( '72' );
		} );

		it( 'should start hidden', () => {
			const container = textEffects.createFontSizeControl();
			expect( container.style.display ).toBe( 'none' );
		} );

		it( 'should register input event listener', () => {
			textEffects.createFontSizeControl();

			// Simulate input event
			textEffects.fontSizeInput.value = '24';
			textEffects.fontSizeInput.dispatchEvent( new Event( 'input' ) );

			// The addListener was called with the event handler
			expect( mockAddListener ).toHaveBeenCalled();
		} );
	} );

	describe( 'createTextStrokeControl', () => {
		it( 'should create text stroke container', () => {
			const container = textEffects.createTextStrokeControl();

			expect( container ).toBeInstanceOf( HTMLElement );
			expect( container.className ).toContain( 'text-stroke-container' );
		} );

		it( 'should create color and width inputs', () => {
			textEffects.createTextStrokeControl();

			expect( textEffects.textStrokeColor ).toBeInstanceOf( HTMLInputElement );
			expect( textEffects.textStrokeColor.type ).toBe( 'color' );
			expect( textEffects.textStrokeWidth ).toBeInstanceOf( HTMLInputElement );
			expect( textEffects.textStrokeWidth.type ).toBe( 'range' );
		} );

		it( 'should start hidden', () => {
			const container = textEffects.createTextStrokeControl();
			expect( container.style.display ).toBe( 'none' );
		} );

		it( 'should update value display on width change', () => {
			textEffects.createTextStrokeControl();
			textEffects.textStrokeWidth.value = '5';
			textEffects.textStrokeWidth.dispatchEvent( new Event( 'input' ) );

			expect( textEffects.textStrokeValue.textContent ).toBe( '5' );
		} );

		it( 'should notify style change on color change', () => {
			textEffects.createTextStrokeControl();
			textEffects.textStrokeColor.value = '#ff0000';
			textEffects.textStrokeColor.dispatchEvent( new Event( 'change' ) );

			expect( mockNotifyStyleChange ).toHaveBeenCalled();
		} );
	} );

	describe( 'createShadowControl', () => {
		it( 'should create shadow container', () => {
			const container = textEffects.createShadowControl();

			expect( container ).toBeInstanceOf( HTMLElement );
			expect( container.className ).toContain( 'shadow-container' );
		} );

		it( 'should create toggle and color inputs', () => {
			textEffects.createShadowControl();

			expect( textEffects.textShadowToggle ).toBeInstanceOf( HTMLInputElement );
			expect( textEffects.textShadowToggle.type ).toBe( 'checkbox' );
			expect( textEffects.textShadowColor ).toBeInstanceOf( HTMLInputElement );
			expect( textEffects.textShadowColor.type ).toBe( 'color' );
		} );

		it( 'should start hidden', () => {
			const container = textEffects.createShadowControl();
			expect( container.style.display ).toBe( 'none' );
		} );

		it( 'should show color input when toggle is checked', () => {
			textEffects.createShadowControl();
			textEffects.textShadowToggle.checked = true;
			textEffects.textShadowToggle.dispatchEvent( new Event( 'change' ) );

			expect( textEffects.textShadowColor.style.display ).toBe( 'inline-block' );
		} );

		it( 'should hide color input when toggle is unchecked', () => {
			textEffects.createShadowControl();
			textEffects.textShadowToggle.checked = false;
			textEffects.textShadowToggle.dispatchEvent( new Event( 'change' ) );

			expect( textEffects.textShadowColor.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'getStyleValues', () => {
		it( 'should return default values when no controls exist', () => {
			const values = textEffects.getStyleValues();
			expect( values.fontSize ).toBe( 16 );
			expect( values.textStrokeColor ).toBe( '#000000' );
			expect( values.textStrokeWidth ).toBe( 0 );
			expect( values.textShadow ).toBe( false );
			expect( values.textShadowColor ).toBe( '#000000' );
		} );

		it( 'should return font size when control exists', () => {
			textEffects.createFontSizeControl();
			textEffects.fontSizeInput.value = '24';

			const values = textEffects.getStyleValues();
			expect( values.fontSize ).toBe( 24 );
		} );

		it( 'should return text stroke values when control exists', () => {
			textEffects.createTextStrokeControl();
			textEffects.textStrokeColor.value = '#ff0000';
			textEffects.textStrokeWidth.value = '3';

			const values = textEffects.getStyleValues();
			expect( values.textStrokeColor ).toBe( '#ff0000' );
			expect( values.textStrokeWidth ).toBe( 3 );
		} );

		it( 'should return shadow values when control exists', () => {
			textEffects.createShadowControl();
			textEffects.textShadowToggle.checked = true;
			textEffects.textShadowColor.value = '#333333';

			const values = textEffects.getStyleValues();
			expect( values.textShadow ).toBe( true );
			expect( values.textShadowColor ).toBe( '#333333' );
		} );

		it( 'should return NaN for empty font size (parseInt behavior)', () => {
			textEffects.createFontSizeControl();
			textEffects.fontSizeInput.value = '';

			const values = textEffects.getStyleValues();
			// parseInt('', 10) returns NaN - this is expected behavior
			expect( Number.isNaN( values.fontSize ) ).toBe( true );
		} );
	} );

	describe( 'applyStyle', () => {
		beforeEach( () => {
			textEffects.createFontSizeControl();
			textEffects.createTextStrokeControl();
			textEffects.createShadowControl();
		} );

		it( 'should do nothing when style is null', () => {
			textEffects.applyStyle( null );
			// Should not throw
		} );

		it( 'should apply fontSize', () => {
			textEffects.applyStyle( { fontSize: 32 } );
			expect( textEffects.fontSizeInput.value ).toBe( '32' );
		} );

		it( 'should apply textStrokeColor', () => {
			textEffects.applyStyle( { textStrokeColor: '#00ff00' } );
			expect( textEffects.textStrokeColor.value ).toBe( '#00ff00' );
		} );

		it( 'should apply textStrokeWidth', () => {
			textEffects.applyStyle( { textStrokeWidth: 5 } );
			expect( textEffects.textStrokeWidth.value ).toBe( '5' );
			expect( textEffects.textStrokeValue.textContent ).toBe( '5' );
		} );

		it( 'should apply textShadow toggle', () => {
			textEffects.applyStyle( { textShadow: true } );
			expect( textEffects.textShadowToggle.checked ).toBe( true );
			expect( textEffects.textShadowColor.style.display ).toBe( 'inline-block' );
		} );

		it( 'should apply textShadowColor', () => {
			textEffects.applyStyle( { textShadowColor: '#999999' } );
			expect( textEffects.textShadowColor.value ).toBe( '#999999' );
		} );
	} );

	describe( 'updateForTool', () => {
		beforeEach( () => {
			textEffects.createFontSizeControl();
			textEffects.createTextStrokeControl();
			textEffects.createShadowControl();
		} );

		it( 'should show controls for text tool', () => {
			textEffects.updateForTool( 'text' );

			expect( textEffects.fontSizeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.textStrokeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.shadowContainer.style.display ).toBe( 'flex' );
		} );

		it( 'should show controls for textbox tool', () => {
			textEffects.updateForTool( 'textbox' );

			expect( textEffects.fontSizeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.textStrokeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.shadowContainer.style.display ).toBe( 'flex' );
		} );

		it( 'should hide controls for other tools', () => {
			textEffects.updateForTool( 'rectangle' );

			expect( textEffects.fontSizeContainer.style.display ).toBe( 'none' );
			expect( textEffects.textStrokeContainer.style.display ).toBe( 'none' );
			expect( textEffects.shadowContainer.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'updateFromLayer', () => {
		beforeEach( () => {
			textEffects.createFontSizeControl();
			textEffects.createTextStrokeControl();
			textEffects.createShadowControl();
		} );

		it( 'should do nothing when layer is null', () => {
			textEffects.updateFromLayer( null );
			// Should not throw
		} );

		it( 'should update fontSize from layer', () => {
			textEffects.updateFromLayer( { fontSize: 28 } );
			expect( textEffects.fontSizeInput.value ).toBe( '28' );
		} );

		it( 'should update text stroke from layer', () => {
			textEffects.updateFromLayer( {
				textStrokeColor: '#0000ff',
				textStrokeWidth: 2
			} );
			expect( textEffects.textStrokeColor.value ).toBe( '#0000ff' );
			expect( textEffects.textStrokeWidth.value ).toBe( '2' );
		} );

		it( 'should update shadow from layer', () => {
			textEffects.updateFromLayer( {
				textShadow: true,
				textShadowColor: '#444444'
			} );
			expect( textEffects.textShadowToggle.checked ).toBe( true );
			expect( textEffects.textShadowColor.value ).toBe( '#444444' );
		} );
	} );

	describe( 'setupValidation', () => {
		it( 'should not throw if validator is null', () => {
			expect( () => textEffects.setupValidation( null, [] ) ).not.toThrow();
		} );

		it( 'should not throw if inputValidators is null', () => {
			expect( () => textEffects.setupValidation( {}, null ) ).not.toThrow();
		} );

		it( 'should register validators for inputs', () => {
			textEffects.createFontSizeControl();
			textEffects.createTextStrokeControl();
			textEffects.createShadowControl();

			const validators = [];
			const mockValidator = {
				createInputValidator: jest.fn().mockReturnValue( { destroy: jest.fn() } )
			};

			textEffects.setupValidation( mockValidator, validators );

			// Should create validators for fontSizeInput, textStrokeWidth, textStrokeColor, textShadowColor
			expect( mockValidator.createInputValidator ).toHaveBeenCalledTimes( 4 );
			expect( validators.length ).toBe( 4 );
		} );
	} );

	describe( 'destroy', () => {
		it( 'should clear all DOM references', () => {
			textEffects.createFontSizeControl();
			textEffects.createTextStrokeControl();
			textEffects.createShadowControl();

			textEffects.destroy();

			expect( textEffects.fontSizeInput ).toBeNull();
			expect( textEffects.fontSizeContainer ).toBeNull();
			expect( textEffects.textStrokeColor ).toBeNull();
			expect( textEffects.textStrokeWidth ).toBeNull();
			expect( textEffects.textStrokeValue ).toBeNull();
			expect( textEffects.textStrokeContainer ).toBeNull();
			expect( textEffects.textShadowToggle ).toBeNull();
			expect( textEffects.textShadowColor ).toBeNull();
			expect( textEffects.shadowContainer ).toBeNull();
		} );
	} );

	describe( 'hideAll', () => {
		beforeEach( () => {
			textEffects.createFontSizeControl();
			textEffects.createTextStrokeControl();
			textEffects.createShadowControl();
		} );

		it( 'should hide all text effect controls', () => {
			// First show them
			textEffects.updateForTool( 'text' );
			expect( textEffects.fontSizeContainer.style.display ).toBe( 'flex' );

			// Then hide all
			textEffects.hideAll();

			expect( textEffects.fontSizeContainer.style.display ).toBe( 'none' );
			expect( textEffects.textStrokeContainer.style.display ).toBe( 'none' );
			expect( textEffects.shadowContainer.style.display ).toBe( 'none' );
		} );

		it( 'should not throw if containers are null', () => {
			textEffects.fontSizeContainer = null;
			textEffects.textStrokeContainer = null;
			textEffects.shadowContainer = null;

			expect( () => textEffects.hideAll() ).not.toThrow();
		} );
	} );

	describe( 'updateForSelectedTypes', () => {
		beforeEach( () => {
			textEffects.createFontSizeControl();
			textEffects.createTextStrokeControl();
			textEffects.createShadowControl();
		} );

		it( 'should show controls for pure text layers', () => {
			textEffects.hideAll(); // Start hidden

			textEffects.updateForSelectedTypes( true, false );

			expect( textEffects.fontSizeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.textStrokeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.shadowContainer.style.display ).toBe( 'flex' );
		} );

		it( 'should show controls for textbox layers', () => {
			textEffects.hideAll(); // Start hidden

			textEffects.updateForSelectedTypes( false, true );

			expect( textEffects.fontSizeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.textStrokeContainer.style.display ).toBe( 'flex' );
			expect( textEffects.shadowContainer.style.display ).toBe( 'flex' );
		} );

		it( 'should hide controls for non-text layers', () => {
			textEffects.updateForTool( 'text' ); // Start shown

			textEffects.updateForSelectedTypes( false, false );

			expect( textEffects.fontSizeContainer.style.display ).toBe( 'none' );
			expect( textEffects.textStrokeContainer.style.display ).toBe( 'none' );
			expect( textEffects.shadowContainer.style.display ).toBe( 'none' );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export to window.Layers.UI namespace', () => {
			expect( window.Layers.UI.TextEffectsControls ).toBe( TextEffectsControls );
		} );

		it( 'should be a constructor function', () => {
			expect( typeof TextEffectsControls ).toBe( 'function' );
		} );
	} );
} );
