/**
 * @jest-environment jsdom
 */
'use strict';

// Mock localStorage
const localStorageMock = {
	store: {},
	getItem: jest.fn( ( key ) => localStorageMock.store[ key ] || null ),
	setItem: jest.fn( ( key, value ) => {
		localStorageMock.store[ key ] = value;
	} ),
	clear: jest.fn( () => {
		localStorageMock.store = {};
	} )
};
Object.defineProperty( window, 'localStorage', { value: localStorageMock } );

// Load the module
require( '../../resources/ext.layers.editor/ui/ColorPickerDialog.js' );

describe( 'ColorPickerDialog', () => {
	let ColorPickerDialog;

	beforeEach( () => {
		ColorPickerDialog = window.Layers && window.Layers.UI && window.Layers.UI.ColorPickerDialog;
		// Clear document body and localStorage before each test
		document.body.innerHTML = '';
		localStorageMock.store = {};
		localStorageMock.getItem.mockClear();
		localStorageMock.setItem.mockClear();
	} );

	afterEach( () => {
		// Clean up any remaining dialogs
		document.querySelectorAll( '.color-picker-overlay, .color-picker-dialog' ).forEach( ( el ) => {
			el.remove();
		} );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default options', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			expect( dialog.currentColor ).toBe( '#000000' );
			expect( dialog.selectedColor ).toBe( '#000000' );
			expect( typeof dialog.onApply ).toBe( 'function' );
		} );

		it( 'should accept custom current color', () => {
			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply: () => {}
			} );
			expect( dialog.currentColor ).toBe( '#ff0000' );
			expect( dialog.selectedColor ).toBe( '#ff0000' );
		} );

		it( 'should accept custom strings', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				strings: {
					title: 'Pick a color',
					apply: 'OK'
				}
			} );
			expect( dialog.strings.title ).toBe( 'Pick a color' );
			expect( dialog.strings.apply ).toBe( 'OK' );
		} );
	} );

	describe( 'formatTemplate', () => {
		it( 'should replace $1 with value', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			const result = dialog.formatTemplate( 'Color: $1', '#ff0000' );
			expect( result ).toBe( 'Color: #ff0000' );
		} );

		it( 'should append value if no $1 placeholder', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			const result = dialog.formatTemplate( 'Color:', '#ff0000' );
			expect( result ).toBe( 'Color: #ff0000' );
		} );

		it( 'should return value if template is not a string', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			const result = dialog.formatTemplate( null, '#ff0000' );
			expect( result ).toBe( '#ff0000' );
		} );
	} );

	describe( 'getSavedColors', () => {
		it( 'should return empty array when no saved colors', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			const colors = dialog.getSavedColors();
			expect( colors ).toEqual( [] );
		} );

		it( 'should return saved colors from localStorage', () => {
			localStorageMock.store[ 'layers-custom-colors' ] = JSON.stringify( [ '#ff0000', '#00ff00' ] );
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			const colors = dialog.getSavedColors();
			expect( colors ).toEqual( [ '#ff0000', '#00ff00' ] );
		} );

		it( 'should handle invalid JSON gracefully', () => {
			localStorageMock.store[ 'layers-custom-colors' ] = 'invalid json';
			localStorageMock.getItem.mockReturnValue( 'invalid json' );
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			const colors = dialog.getSavedColors();
			expect( colors ).toEqual( [] );
		} );
	} );

	describe( 'saveCustomColor', () => {
		it( 'should save new color to localStorage', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.saveCustomColor( '#ff0000' );
			expect( localStorageMock.setItem ).toHaveBeenCalled();
		} );

		it( 'should not save "none" color', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.saveCustomColor( 'none' );
			expect( localStorageMock.setItem ).not.toHaveBeenCalled();
		} );

		it( 'should not save empty color', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.saveCustomColor( '' );
			expect( localStorageMock.setItem ).not.toHaveBeenCalled();
		} );

		it( 'should not save duplicate colors', () => {
			// Set up existing colors in storage
			const existingColors = [ '#ff0000' ];
			localStorageMock.store[ 'layers-custom-colors' ] = JSON.stringify( existingColors );
			localStorageMock.getItem.mockImplementation( ( key ) => localStorageMock.store[ key ] || null );
			localStorageMock.setItem.mockClear();

			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.saveCustomColor( '#ff0000' );

			// setItem shouldn't be called for duplicate
			expect( localStorageMock.setItem ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'open', () => {
		it( 'should add overlay and dialog to document body', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			expect( document.querySelector( '.color-picker-overlay' ) ).not.toBeNull();
			expect( document.querySelector( '.color-picker-dialog' ) ).not.toBeNull();
		} );

		it( 'should display title', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				strings: { title: 'Test Title' }
			} );
			dialog.open();

			const title = document.querySelector( '.color-picker-title' );
			expect( title.textContent ).toBe( 'Test Title' );
		} );

		it( 'should have standard color palette', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			const swatches = document.querySelectorAll( '.color-picker-swatch-btn' );
			// At least 30+ standard colors plus custom slots
			expect( swatches.length ).toBeGreaterThan( 30 );
		} );

		it( 'should have "none" button for transparent', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			const noneBtn = document.querySelector( '.color-picker-none-btn' );
			expect( noneBtn ).not.toBeNull();
		} );

		it( 'should have custom color input', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			const customInput = document.querySelector( '.color-picker-custom-input' );
			expect( customInput ).not.toBeNull();
			expect( customInput.type ).toBe( 'color' );
		} );

		it( 'should have cancel and apply buttons', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			expect( document.querySelector( '.color-picker-btn--secondary' ) ).not.toBeNull();
			expect( document.querySelector( '.color-picker-btn--primary' ) ).not.toBeNull();
		} );
	} );

	describe( 'close', () => {
		it( 'should remove overlay and dialog from DOM', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();
			dialog.close();

			expect( document.querySelector( '.color-picker-overlay' ) ).toBeNull();
			expect( document.querySelector( '.color-picker-dialog' ) ).toBeNull();
		} );

		it( 'should restore focus to previously focused element', () => {
			const button = document.createElement( 'button' );
			button.id = 'test-button';
			document.body.appendChild( button );
			button.focus();

			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();
			dialog.close();

			expect( document.activeElement ).toBe( button );
		} );

		it( 'should update anchor element aria-expanded', () => {
			const anchor = document.createElement( 'button' );
			anchor.setAttribute( 'aria-expanded', 'false' );
			document.body.appendChild( anchor );

			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				anchorElement: anchor
			} );
			dialog.open();
			expect( anchor.getAttribute( 'aria-expanded' ) ).toBe( 'true' );

			dialog.close();
			expect( anchor.getAttribute( 'aria-expanded' ) ).toBe( 'false' );
		} );
	} );

	describe( 'callbacks', () => {
		it( 'should call onApply with selected color', () => {
			const onApply = jest.fn();
			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply
			} );
			dialog.open();

			// Click apply button
			const applyBtn = document.querySelector( '.color-picker-btn--primary' );
			applyBtn.click();

			expect( onApply ).toHaveBeenCalledWith( '#ff0000' );
		} );

		it( 'should call onCancel when cancel button clicked', () => {
			const onCancel = jest.fn();
			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				onCancel
			} );
			dialog.open();

			const cancelBtn = document.querySelector( '.color-picker-btn--secondary' );
			cancelBtn.click();

			expect( onCancel ).toHaveBeenCalled();
		} );

		it( 'should close dialog after apply', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			const applyBtn = document.querySelector( '.color-picker-btn--primary' );
			applyBtn.click();

			expect( document.querySelector( '.color-picker-dialog' ) ).toBeNull();
		} );
	} );

	describe( 'color selection', () => {
		it( 'should select color when swatch clicked', () => {
			const onApply = jest.fn();
			const dialog = new ColorPickerDialog( {
				onApply
			} );
			dialog.open();

			// Click a color swatch
			const swatch = document.querySelector( '.color-picker-swatch-btn' );
			swatch.click();

			// The swatch should be selected
			expect( swatch.classList.contains( 'selected' ) ).toBe( true );
		} );

		it( 'should select none when none button clicked', () => {
			const onApply = jest.fn();
			const dialog = new ColorPickerDialog( {
				onApply
			} );
			dialog.open();

			// Click none button
			const noneBtn = document.querySelector( '.color-picker-none-btn' );
			noneBtn.click();

			// Apply
			const applyBtn = document.querySelector( '.color-picker-btn--primary' );
			applyBtn.click();

			expect( onApply ).toHaveBeenCalledWith( 'none' );
		} );
	} );

	describe( 'keyboard handling', () => {
		it( 'should close on Escape key', () => {
			const onCancel = jest.fn();
			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				onCancel
			} );
			dialog.open();

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( onCancel ).toHaveBeenCalled();
			expect( document.querySelector( '.color-picker-dialog' ) ).toBeNull();
		} );
	} );

	describe( 'static methods', () => {
		describe( 'createColorButton', () => {
			it( 'should create a color display button', () => {
				const onClick = jest.fn();
				const button = ColorPickerDialog.createColorButton( {
					color: '#ff0000',
					onClick
				} );

				expect( button.tagName.toLowerCase() ).toBe( 'button' );
				expect( button.className ).toBe( 'color-display-button' );
				expect( button.style.background ).toContain( 'rgb(255, 0, 0)' );
			} );

			it( 'should show striped background for transparent', () => {
				const button = ColorPickerDialog.createColorButton( {
					color: 'none',
					onClick: () => {}
				} );

				expect( button.style.background ).toContain( 'repeating-linear-gradient' );
			} );

			it( 'should call onClick when clicked', () => {
				const onClick = jest.fn();
				const button = ColorPickerDialog.createColorButton( {
					color: '#ff0000',
					onClick
				} );

				button.click();
				expect( onClick ).toHaveBeenCalled();
			} );
		} );

		describe( 'updateColorButton', () => {
			it( 'should update button appearance for color', () => {
				const button = document.createElement( 'button' );
				ColorPickerDialog.updateColorButton( button, '#00ff00' );

				expect( button.style.background ).toContain( 'rgb(0, 255, 0)' );
				expect( button.title ).toBe( '#00ff00' );
			} );

			it( 'should update button appearance for transparent', () => {
				const button = document.createElement( 'button' );
				ColorPickerDialog.updateColorButton( button, 'none' );

				expect( button.style.background ).toContain( 'repeating-linear-gradient' );
			} );
		} );
	} );

	describe( 'accessibility', () => {
		it( 'should have proper ARIA attributes on dialog', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			const dialogEl = document.querySelector( '.color-picker-dialog' );
			expect( dialogEl.getAttribute( 'role' ) ).toBe( 'dialog' );
			expect( dialogEl.getAttribute( 'aria-modal' ) ).toBe( 'true' );
		} );

		it( 'should have labeled title', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			const dialogEl = document.querySelector( '.color-picker-dialog' );
			const titleId = dialogEl.getAttribute( 'aria-labelledby' );
			expect( titleId ).toBeTruthy();
			expect( document.getElementById( titleId ) ).not.toBeNull();
		} );

		it( 'should have accessible swatches', () => {
			const dialog = new ColorPickerDialog( {
				onApply: () => {}
			} );
			dialog.open();

			const swatches = document.querySelectorAll( '.color-picker-swatch-btn' );
			swatches.forEach( ( swatch ) => {
				expect( swatch.hasAttribute( 'aria-label' ) ).toBe( true );
			} );
		} );
	} );

	describe( 'cleanup registration', () => {
		it( 'should call registerCleanup with close function', () => {
			const registerCleanup = jest.fn();
			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				registerCleanup
			} );
			dialog.open();

			expect( registerCleanup ).toHaveBeenCalled();
			const cleanupFn = registerCleanup.mock.calls[ 0 ][ 0 ];
			expect( typeof cleanupFn ).toBe( 'function' );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ColorPickerDialog for Node.js', () => {
			const exported = require( '../../resources/ext.layers.editor/ui/ColorPickerDialog.js' );
			expect( typeof exported ).toBe( 'function' );
			expect( typeof exported.createColorButton ).toBe( 'function' );
			expect( typeof exported.updateColorButton ).toBe( 'function' );
		} );
	} );
} );
