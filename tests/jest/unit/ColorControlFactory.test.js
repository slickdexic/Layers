/**
 * ColorControlFactory unit tests
 *
 * Tests for color control creation and management.
 */
'use strict';

const ColorControlFactory = require( '../../../resources/ext.layers.editor/ui/ColorControlFactory.js' );

describe( 'ColorControlFactory', () => {
	let factory;
	let mockMsgFn;
	let mockAddListener;
	let mockRegisterCleanup;
	let addedListeners;

	beforeEach( () => {
		addedListeners = [];
		mockMsgFn = jest.fn( ( key, fallback ) => fallback || key );
		mockAddListener = jest.fn( ( el, evt, handler ) => {
			addedListeners.push( { el, evt, handler } );
			el.addEventListener( evt, handler );
		} );
		mockRegisterCleanup = jest.fn();

		factory = new ColorControlFactory( {
			msg: mockMsgFn,
			addListener: mockAddListener,
			registerDialogCleanup: mockRegisterCleanup
		} );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with config', () => {
			expect( factory ).toBeInstanceOf( ColorControlFactory );
			expect( factory.config ).toBeDefined();
		} );

		it( 'should store message function', () => {
			expect( factory.msgFn ).toBe( mockMsgFn );
		} );

		it( 'should store addListener function', () => {
			expect( factory.addListenerFn ).toBe( mockAddListener );
		} );

		it( 'should store registerDialogCleanup function', () => {
			expect( factory.registerDialogCleanupFn ).toBe( mockRegisterCleanup );
		} );

		it( 'should use default msg function if not provided', () => {
			const defaultFactory = new ColorControlFactory();
			expect( defaultFactory.msg( 'test-key', 'fallback' ) ).toBe( 'fallback' );
			expect( defaultFactory.msg( 'test-key' ) ).toBe( 'test-key' );
		} );

		it( 'should use default addListener function if not provided', () => {
			const defaultFactory = new ColorControlFactory();
			const button = document.createElement( 'button' );
			const handler = jest.fn();
			// Should not throw
			expect( () => {
				defaultFactory.addListenerFn( button, 'click', handler );
			} ).not.toThrow();
		} );

		it( 'should use default registerDialogCleanup function if not provided', () => {
			const defaultFactory = new ColorControlFactory();
			// Should not throw
			expect( () => {
				defaultFactory.registerDialogCleanupFn();
			} ).not.toThrow();
		} );
	} );

	describe( 'msg', () => {
		it( 'should delegate to msgFn', () => {
			factory.msg( 'test-key', 'fallback' );
			expect( mockMsgFn ).toHaveBeenCalledWith( 'test-key', 'fallback' );
		} );

		it( 'should return result from msgFn', () => {
			mockMsgFn.mockReturnValue( 'translated' );
			expect( factory.msg( 'key', 'fallback' ) ).toBe( 'translated' );
		} );
	} );

	describe( 'getColorPickerStrings', () => {
		it( 'should return object with all required keys', () => {
			const strings = factory.getColorPickerStrings();
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

		it( 'should call msg function for each string', () => {
			factory.getColorPickerStrings();
			expect( mockMsgFn ).toHaveBeenCalledWith( 'layers-color-picker-title', 'Choose color' );
			expect( mockMsgFn ).toHaveBeenCalledWith( 'layers-color-picker-standard', 'Standard colors' );
			expect( mockMsgFn ).toHaveBeenCalledWith( 'layers-color-picker-saved', 'Saved colors' );
		} );
	} );

	describe( 'createColorControl', () => {
		let result;
		let onColorChangeMock;

		beforeEach( () => {
			onColorChangeMock = jest.fn();
			result = factory.createColorControl( {
				type: 'fill',
				label: 'Fill Color',
				initialColor: '#ff0000',
				initialNone: false,
				onColorChange: onColorChangeMock
			} );
		} );

		it( 'should return object with container', () => {
			expect( result.container ).toBeInstanceOf( HTMLElement );
			expect( result.container.className ).toBe( 'style-control-item' );
		} );

		it( 'should return object with button', () => {
			expect( result.button ).toBeInstanceOf( HTMLButtonElement );
			expect( result.button.className ).toContain( 'color-display-button' );
			expect( result.button.className ).toContain( 'fill-color' );
		} );

		it( 'should create label element', () => {
			const label = result.container.querySelector( '.style-control-label' );
			expect( label ).not.toBeNull();
			expect( label.textContent ).toBe( 'Fill Color' );
		} );

		it( 'should set ARIA attributes on button', () => {
			// aria-label gets overwritten by updateColorButtonDisplay after creation
			// so we just check it exists and has relevant content
			expect( result.button.getAttribute( 'aria-label' ) ).toBeTruthy();
			expect( result.button.getAttribute( 'aria-haspopup' ) ).toBe( 'dialog' );
			expect( result.button.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		} );

		it( 'should set button type to button', () => {
			expect( result.button.type ).toBe( 'button' );
		} );

		it( 'should register click listener', () => {
			expect( mockAddListener ).toHaveBeenCalledWith(
				result.button,
				'click',
				expect.any( Function )
			);
		} );

		it( 'should return getColor method', () => {
			expect( typeof result.getColor ).toBe( 'function' );
			expect( result.getColor() ).toBe( '#ff0000' );
		} );

		it( 'should return isNone method', () => {
			expect( typeof result.isNone ).toBe( 'function' );
			expect( result.isNone() ).toBe( false );
		} );

		it( 'should return setColor method', () => {
			expect( typeof result.setColor ).toBe( 'function' );
			result.setColor( '#00ff00', false );
			expect( result.getColor() ).toBe( '#00ff00' );
		} );

		it( 'should handle initialNone=true', () => {
			const noneResult = factory.createColorControl( {
				type: 'stroke',
				label: 'Stroke',
				initialColor: '#000000',
				initialNone: true,
				onColorChange: jest.fn()
			} );
			expect( noneResult.isNone() ).toBe( true );
		} );

		it( 'should work with stroke type', () => {
			const strokeResult = factory.createColorControl( {
				type: 'stroke',
				label: 'Stroke',
				initialColor: '#0000ff',
				initialNone: false,
				onColorChange: jest.fn()
			} );
			expect( strokeResult.button.className ).toContain( 'stroke-color' );
		} );

		it( 'setColor should update isNone state', () => {
			result.setColor( '#000000', true );
			expect( result.isNone() ).toBe( true );
		} );

		it( 'setColor should not update color when none=true', () => {
			result.setColor( '#000000', true );
			// Color should remain unchanged when setting to none
			expect( result.getColor() ).toBe( '#ff0000' );
		} );

		it( 'should use default color when initialColor not provided', () => {
			const noColorResult = factory.createColorControl( {
				type: 'fill',
				label: 'Fill',
				onColorChange: jest.fn()
			} );
			expect( noColorResult.getColor() ).toBe( '#000000' );
		} );
	} );

	describe( 'updateColorButtonDisplay', () => {
		let button;

		beforeEach( () => {
			button = document.createElement( 'button' );
		} );

		it( 'should set background color for valid color', () => {
			factory.updateColorButtonDisplay( button, '#ff0000' );
			expect( button.style.background ).toBe( 'rgb(255, 0, 0)' );
		} );

		it( 'should remove is-transparent class for valid color', () => {
			button.classList.add( 'is-transparent' );
			factory.updateColorButtonDisplay( button, '#00ff00' );
			expect( button.classList.contains( 'is-transparent' ) ).toBe( false );
		} );

		it( 'should add is-transparent class for none', () => {
			factory.updateColorButtonDisplay( button, 'none' );
			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );

		it( 'should add is-transparent class for transparent', () => {
			factory.updateColorButtonDisplay( button, 'transparent' );
			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );

		it( 'should add is-transparent class for empty string', () => {
			factory.updateColorButtonDisplay( button, '' );
			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );

		it( 'should add is-transparent class for null', () => {
			factory.updateColorButtonDisplay( button, null );
			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );

		it( 'should set title attribute for color', () => {
			factory.updateColorButtonDisplay( button, '#0000ff' );
			expect( button.title ).toBe( '#0000ff' );
		} );

		it( 'should set aria-label attribute', () => {
			factory.updateColorButtonDisplay( button, '#123456' );
			expect( button.getAttribute( 'aria-label' ) ).toContain( '#123456' );
		} );

		it( 'should clear background style for transparent', () => {
			button.style.background = '#ff0000';
			factory.updateColorButtonDisplay( button, 'none' );
			expect( button.style.background ).toBe( '' );
		} );
	} );

	describe( 'createSimpleColorInput', () => {
		it( 'should create input element with type color', () => {
			const input = factory.createSimpleColorInput( {} );
			expect( input.tagName ).toBe( 'INPUT' );
			expect( input.type ).toBe( 'color' );
		} );

		it( 'should set initial color value', () => {
			const input = factory.createSimpleColorInput( {
				initialColor: '#abcdef'
			} );
			expect( input.value ).toBe( '#abcdef' );
		} );

		it( 'should use default color when not provided', () => {
			const input = factory.createSimpleColorInput( {} );
			expect( input.value ).toBe( '#000000' );
		} );

		it( 'should set className', () => {
			const input = factory.createSimpleColorInput( {
				className: 'my-color-input'
			} );
			expect( input.className ).toBe( 'my-color-input' );
		} );

		it( 'should set title', () => {
			const input = factory.createSimpleColorInput( {
				title: 'Pick a color'
			} );
			expect( input.title ).toBe( 'Pick a color' );
		} );

		it( 'should register change listener when onChange provided', () => {
			const onChangeMock = jest.fn();
			const input = factory.createSimpleColorInput( {
				onChange: onChangeMock
			} );

			expect( mockAddListener ).toHaveBeenCalledWith(
				input,
				'change',
				expect.any( Function )
			);
		} );

		it( 'should not register listener when onChange not provided', () => {
			const listenerCountBefore = addedListeners.length;
			factory.createSimpleColorInput( {} );
			expect( addedListeners.length ).toBe( listenerCountBefore );
		} );

		it( 'should call onChange with new value when changed', () => {
			const onChangeMock = jest.fn();
			const input = factory.createSimpleColorInput( {
				onChange: onChangeMock
			} );

			input.value = '#fedcba';
			// Trigger the change event
			const changeEvent = new Event( 'change' );
			input.dispatchEvent( changeEvent );

			expect( onChangeMock ).toHaveBeenCalledWith( '#fedcba' );
		} );
	} );

	describe( 'openColorPicker', () => {
		let anchorButton;

		beforeEach( () => {
			anchorButton = document.createElement( 'button' );
		} );

		it( 'should not throw when ColorPickerDialog not available', () => {
			// ColorPickerDialog is not in global scope in tests
			expect( () => {
				factory.openColorPicker( anchorButton, '#ff0000', {} );
			} ).not.toThrow();
		} );

		it( 'should accept options parameter', () => {
			expect( () => {
				factory.openColorPicker( anchorButton, '#ff0000', {
					onApply: jest.fn(),
					onCancel: jest.fn()
				} );
			} ).not.toThrow();
		} );

		it( 'should handle none as initial value', () => {
			expect( () => {
				factory.openColorPicker( anchorButton, 'none', {} );
			} ).not.toThrow();
		} );

		it( 'should handle undefined options', () => {
			expect( () => {
				factory.openColorPicker( anchorButton, '#000000' );
			} ).not.toThrow();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ColorControlFactory class', () => {
			expect( ColorControlFactory ).toBeDefined();
			expect( typeof ColorControlFactory ).toBe( 'function' );
		} );

		it( 'should be instantiable', () => {
			const instance = new ColorControlFactory();
			expect( instance ).toBeInstanceOf( ColorControlFactory );
		} );
	} );
} );
