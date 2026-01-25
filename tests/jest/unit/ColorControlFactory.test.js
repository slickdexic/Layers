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

		it( 'should use window.layersMessages when available', () => {
			const mockStrings = {
				title: 'Mock Title',
				standard: 'Mock Standard',
				saved: 'Mock Saved'
			};
			window.layersMessages = {
				getColorPickerStrings: jest.fn( () => mockStrings )
			};

			const strings = factory.getColorPickerStrings();
			expect( window.layersMessages.getColorPickerStrings ).toHaveBeenCalled();
			expect( strings ).toBe( mockStrings );

			// Clean up
			delete window.layersMessages;
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
			expect( typeof result.button.getAttribute( 'aria-label' ) ).toBe( 'string' );
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

	describe( 'createColorControl click handler', () => {
		it( 'should open color picker when button is clicked', () => {
			const onColorChange = jest.fn();
			const control = factory.createColorControl( {
				type: 'stroke',
				label: 'Stroke',
				initialColor: '#ff0000',
				onColorChange
			} );

			// Mock openColorPicker
			factory.openColorPicker = jest.fn();

			// Click the button
			control.button.click();

			expect( factory.openColorPicker ).toHaveBeenCalledWith(
				control.button,
				'#ff0000',
				expect.objectContaining( {
					onApply: expect.any( Function )
				} )
			);
		} );

		it( 'should pass "none" to openColorPicker when isNone is true', () => {
			const onColorChange = jest.fn();
			const control = factory.createColorControl( {
				type: 'stroke',
				label: 'Stroke',
				initialColor: '#ff0000',
				initialNone: true,
				onColorChange
			} );

			// Mock openColorPicker
			factory.openColorPicker = jest.fn();

			// Click the button
			control.button.click();

			expect( factory.openColorPicker ).toHaveBeenCalledWith(
				control.button,
				'none',
				expect.any( Object )
			);
		} );
	} );

	describe( 'updateColorButtonDisplay fallback', () => {
		it( 'should use fallback when ColorPickerDialog not available', () => {
			const button = document.createElement( 'button' );

			// Ensure no ColorPickerDialog available
			const savedColorPickerDialog = window.Layers?.UI?.ColorPickerDialog;
			if ( window.Layers?.UI ) {
				window.Layers.UI.ColorPickerDialog = undefined;
			}

			// Should not throw and should handle the fallback
			expect( () => {
				factory.updateColorButtonDisplay( button, '#ff0000' );
			} ).not.toThrow();

			// Restore
			if ( window.Layers?.UI && savedColorPickerDialog ) {
				window.Layers.UI.ColorPickerDialog = savedColorPickerDialog;
			}
		} );

		it( 'should add is-transparent class for none color in fallback', () => {
			const button = document.createElement( 'button' );

			// Ensure no ColorPickerDialog available
			const savedColorPickerDialog = window.Layers?.UI?.ColorPickerDialog;
			if ( window.Layers?.UI ) {
				window.Layers.UI.ColorPickerDialog = undefined;
			}

			factory.updateColorButtonDisplay( button, 'none' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );

			// Restore
			if ( window.Layers?.UI && savedColorPickerDialog ) {
				window.Layers.UI.ColorPickerDialog = savedColorPickerDialog;
			}
		} );

		it( 'should add is-transparent class for transparent color in fallback', () => {
			const button = document.createElement( 'button' );

			// Ensure no ColorPickerDialog available
			if ( window.Layers?.UI ) {
				window.Layers.UI.ColorPickerDialog = undefined;
			}

			factory.updateColorButtonDisplay( button, 'transparent' );

			expect( button.classList.contains( 'is-transparent' ) ).toBe( true );
		} );
	} );

	describe( 'openColorPicker', () => {
		it( 'should open ColorPickerDialog when available', () => {
			const mockOpen = jest.fn();
			const MockColorPickerDialog = jest.fn().mockImplementation( () => ( {
				open: mockOpen
			} ) );

			// Save and set mock
			const savedColorPickerDialog = window.Layers?.UI?.ColorPickerDialog;
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.ColorPickerDialog = MockColorPickerDialog;

			const anchorButton = document.createElement( 'button' );
			const onApply = jest.fn();

			factory.openColorPicker( anchorButton, '#ff0000', { onApply } );

			expect( MockColorPickerDialog ).toHaveBeenCalled();
			expect( mockOpen ).toHaveBeenCalled();

			// Restore
			if ( savedColorPickerDialog ) {
				window.Layers.UI.ColorPickerDialog = savedColorPickerDialog;
			} else {
				delete window.Layers.UI.ColorPickerDialog;
			}
		} );

		it( 'should do nothing when ColorPickerDialog not available', () => {
			// Ensure no ColorPickerDialog available
			const savedColorPickerDialog = window.Layers?.UI?.ColorPickerDialog;
			if ( window.Layers?.UI ) {
				window.Layers.UI.ColorPickerDialog = undefined;
			}

			const anchorButton = document.createElement( 'button' );

			// Should not throw
			expect( () => {
				factory.openColorPicker( anchorButton, '#ff0000', {} );
			} ).not.toThrow();

			// Restore
			if ( window.Layers?.UI && savedColorPickerDialog ) {
				window.Layers.UI.ColorPickerDialog = savedColorPickerDialog;
			}
		} );

		it( 'should handle none as initial value', () => {
			const mockOpen = jest.fn();
			const MockColorPickerDialog = jest.fn().mockImplementation( () => ( {
				open: mockOpen
			} ) );

			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			const saved = window.Layers.UI.ColorPickerDialog;
			window.Layers.UI.ColorPickerDialog = MockColorPickerDialog;

			const anchorButton = document.createElement( 'button' );

			factory.openColorPicker( anchorButton, 'none', {} );

			expect( MockColorPickerDialog ).toHaveBeenCalledWith(
				expect.objectContaining( {
					currentColor: 'none'
				} )
			);

			window.Layers.UI.ColorPickerDialog = saved;
		} );

		it( 'should use empty object for options when not provided', () => {
			const mockOpen = jest.fn();
			const MockColorPickerDialog = jest.fn().mockImplementation( () => ( {
				open: mockOpen
			} ) );

			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			const saved = window.Layers.UI.ColorPickerDialog;
			window.Layers.UI.ColorPickerDialog = MockColorPickerDialog;

			const anchorButton = document.createElement( 'button' );

			// Call without options
			expect( () => {
				factory.openColorPicker( anchorButton, '#00ff00' );
			} ).not.toThrow();

			window.Layers.UI.ColorPickerDialog = saved;
		} );
	} );

	describe( 'createColorControl click handler', () => {
		it( 'should open color picker on button click', () => {
			const openColorPickerSpy = jest.spyOn( factory, 'openColorPicker' ).mockImplementation( () => {} );

			const control = factory.createColorControl( {
				className: 'test-button',
				initialColor: '#ff0000',
				onColorChange: jest.fn()
			} );

			// Simulate click
			control.button.click();

			expect( openColorPickerSpy ).toHaveBeenCalled();

			openColorPickerSpy.mockRestore();
		} );

		it( 'should pass isNone state to color picker', () => {
			const openColorPickerSpy = jest.spyOn( factory, 'openColorPicker' ).mockImplementation( () => {} );

			const control = factory.createColorControl( {
				className: 'test-button',
				initialColor: '#ff0000',
				initialNone: true,
				onColorChange: jest.fn()
			} );

			// Simulate click - should pass 'none' as value since initialNone is true
			control.button.click();

			expect( openColorPickerSpy ).toHaveBeenCalledWith(
				control.button,
				'none',
				expect.any( Object )
			);

			openColorPickerSpy.mockRestore();
		} );
	} );

	describe( 'live preview (onColorPreview)', () => {
		it( 'should pass onPreview wrapper to openColorPicker when onColorPreview provided', () => {
			const openColorPickerSpy = jest.spyOn( factory, 'openColorPicker' ).mockImplementation( () => {} );
			const onColorPreview = jest.fn();

			const control = factory.createColorControl( {
				className: 'test-button',
				initialColor: '#ff0000',
				onColorChange: jest.fn(),
				onColorPreview: onColorPreview
			} );

			control.button.click();

			// The factory wraps onColorPreview in its own function
			expect( openColorPickerSpy ).toHaveBeenCalled();
			const callOptions = openColorPickerSpy.mock.calls[ 0 ][ 2 ];
			expect( callOptions.onPreview ).toBeInstanceOf( Function );

			openColorPickerSpy.mockRestore();
		} );

		it( 'should call onColorPreview when onPreview wrapper is invoked', () => {
			const openColorPickerSpy = jest.spyOn( factory, 'openColorPicker' ).mockImplementation( () => {} );
			const onColorPreview = jest.fn();

			const control = factory.createColorControl( {
				className: 'test-button',
				initialColor: '#ff0000',
				onColorChange: jest.fn(),
				onColorPreview: onColorPreview
			} );

			control.button.click();

			// Get the wrapped onPreview function
			const callOptions = openColorPickerSpy.mock.calls[ 0 ][ 2 ];
			const onPreviewWrapper = callOptions.onPreview;

			// Call the wrapper with a preview color
			onPreviewWrapper( '#00ff00' );

			expect( onColorPreview ).toHaveBeenCalledWith( '#00ff00', false );

			openColorPickerSpy.mockRestore();
		} );

		it( 'should pass none=true when preview color is none', () => {
			const openColorPickerSpy = jest.spyOn( factory, 'openColorPicker' ).mockImplementation( () => {} );
			const onColorPreview = jest.fn();

			const control = factory.createColorControl( {
				className: 'test-button',
				initialColor: '#ff0000',
				onColorChange: jest.fn(),
				onColorPreview: onColorPreview
			} );

			control.button.click();

			const callOptions = openColorPickerSpy.mock.calls[ 0 ][ 2 ];
			const onPreviewWrapper = callOptions.onPreview;

			// Call with 'none' color
			onPreviewWrapper( 'none' );

			// When none, onColorPreview gets the original colorValue (ff0000) with none=true
			expect( onColorPreview ).toHaveBeenCalledWith( '#ff0000', true );

			openColorPickerSpy.mockRestore();
		} );

		it( 'should pass onPreview to ColorPickerDialog when provided in options', () => {
			// Save original
			const saved = window.Layers?.UI?.ColorPickerDialog;
			const mockDialog = {
				open: jest.fn()
			};
			const MockColorPickerDialog = jest.fn().mockReturnValue( mockDialog );
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.ColorPickerDialog = MockColorPickerDialog;

			const onPreview = jest.fn();
			const anchorButton = document.createElement( 'button' );

			factory.openColorPicker( anchorButton, '#ff0000', {
				onColorChange: jest.fn(),
				onPreview: onPreview
			} );

			// Verify ColorPickerDialog was called with onPreview
			expect( MockColorPickerDialog ).toHaveBeenCalled();
			const callArgs = MockColorPickerDialog.mock.calls[ 0 ][ 0 ];
			expect( callArgs.onPreview ).toBe( onPreview );

			window.Layers.UI.ColorPickerDialog = saved;
		} );

		it( 'should pass null for onPreview when not provided in options', () => {
			const saved = window.Layers?.UI?.ColorPickerDialog;
			const MockColorPickerDialog = jest.fn().mockReturnValue( {
				open: jest.fn()
			} );
			window.Layers = window.Layers || {};
			window.Layers.UI = window.Layers.UI || {};
			window.Layers.UI.ColorPickerDialog = MockColorPickerDialog;

			const anchorButton = document.createElement( 'button' );

			factory.openColorPicker( anchorButton, '#ff0000', {
				onColorChange: jest.fn()
				// No onPreview
			} );

			// Verify ColorPickerDialog was called with onPreview=null
			expect( MockColorPickerDialog ).toHaveBeenCalled();
			const callArgs = MockColorPickerDialog.mock.calls[ 0 ][ 0 ];
			expect( callArgs.onPreview ).toBeNull();

			window.Layers.UI.ColorPickerDialog = saved;
		} );
	} );
} );
