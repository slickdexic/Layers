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

	describe( 'localStorage error handling', () => {
		it( 'should return empty array when localStorage.getItem throws', () => {
			const originalGetItem = localStorageMock.getItem;
			localStorageMock.getItem = jest.fn( () => {
				throw new Error( 'localStorage unavailable' );
			} );

			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			const colors = dialog.getSavedColors();
			expect( colors ).toEqual( [] );

			localStorageMock.getItem = originalGetItem;
		} );

		it( 'should handle localStorage.setItem throwing when saving color', () => {
			const originalSetItem = localStorageMock.setItem;
			localStorageMock.setItem = jest.fn( () => {
				throw new Error( 'Quota exceeded' );
			} );

			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			// Should not throw
			expect( () => dialog.saveCustomColor( '#ff0000' ) ).not.toThrow();

			localStorageMock.setItem = originalSetItem;
		} );
	} );

	describe( 'updateSelection edge cases', () => {
		it( 'should handle null button parameter', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.selectedButton = null;

			// Should not throw when passing null
			expect( () => dialog.updateSelection( null ) ).not.toThrow();
		} );
	} );

	describe( 'calculatePosition edge cases', () => {
		it( 'should clamp left position when exceeding maxLeft', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );

			// Create anchor element positioned far right
			const anchor = document.createElement( 'div' );
			anchor.getBoundingClientRect = () => ( {
				top: 100,
				bottom: 120,
				left: window.innerWidth + 100,
				right: window.innerWidth + 200
			} );
			dialog.anchorElement = anchor;

			const pos = dialog.calculatePosition();
			expect( pos.left ).toBeLessThanOrEqual( window.innerWidth - 300 );
		} );

		it( 'should clamp left position when too far left', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );

			// Create anchor element positioned far left
			const anchor = document.createElement( 'div' );
			anchor.getBoundingClientRect = () => ( {
				top: 100,
				bottom: 120,
				left: -100,
				right: 0
			} );
			dialog.anchorElement = anchor;

			const pos = dialog.calculatePosition();
			expect( pos.left ).toBeGreaterThanOrEqual( 10 );
		} );
	} );

	describe( 'selectedColor initialization', () => {
		it( 'should select none button when currentColor is none', () => {
			const dialog = new ColorPickerDialog( {
				currentColor: 'none',
				onApply: () => {}
			} );
			dialog.open();

			const noneBtn = document.querySelector( '.color-picker-none-btn' );
			expect( noneBtn.classList.contains( 'selected' ) ).toBe( true );
		} );
	} );

	describe( 'saved colors display', () => {
		it( 'should display saved colors with click handlers', () => {
			localStorageMock.store[ 'layers-custom-colors' ] = JSON.stringify( [ '#ff0000', '#00ff00' ] );

			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.open();

			// Find saved color buttons (they're in the second grid section)
			const grids = document.querySelectorAll( '.color-picker-grid' );
			const customGrid = grids[ 1 ];
			const savedButton = customGrid.querySelector( '[style*="rgb(255, 0, 0)"]' );

			expect( savedButton ).not.toBeNull();
			expect( savedButton.title ).toBe( '#ff0000' );

			// Click the saved color button
			savedButton.click();
			expect( dialog.selectedColor ).toBe( '#ff0000' );
		} );
	} );

	describe( 'Apply button behavior', () => {
		it( 'should save new custom color when applying different color', () => {
			const onApply = jest.fn();
			const dialog = new ColorPickerDialog( {
				currentColor: '#000000',
				onApply: onApply
			} );
			dialog.open();

			// Change color via custom input
			dialog.selectedColor = '#abcdef';

			// Click OK button
			const okBtn = document.querySelector( '.color-picker-btn--primary' );
			okBtn.click();

			expect( onApply ).toHaveBeenCalledWith( '#abcdef' );
			expect( localStorageMock.setItem ).toHaveBeenCalled();
		} );

		it( 'should not save when applying same color as current', () => {
			localStorageMock.setItem.mockClear();

			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply: () => {}
			} );
			dialog.open();

			// Keep the same color
			dialog.selectedColor = '#ff0000';

			// Click OK button
			const okBtn = document.querySelector( '.color-picker-btn--primary' );
			okBtn.click();

			expect( localStorageMock.setItem ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'overlay click behavior', () => {
		it( 'should close and cancel when clicking overlay', () => {
			const onCancel = jest.fn();
			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				onCancel: onCancel
			} );
			dialog.open();

			const overlay = document.querySelector( '.color-picker-overlay' );
			overlay.click();

			expect( onCancel ).toHaveBeenCalled();
			expect( document.querySelector( '.color-picker-dialog' ) ).toBeNull();
		} );

		it( 'should not close when clicking inside dialog', () => {
			const onCancel = jest.fn();
			const dialog = new ColorPickerDialog( {
				onApply: () => {},
				onCancel: onCancel
			} );
			dialog.open();

			const dialogEl = document.querySelector( '.color-picker-dialog' );
			const overlay = document.querySelector( '.color-picker-overlay' );

			// Create click event on overlay but with dialog as target
			const event = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( event, 'target', { value: dialogEl } );
			overlay.dispatchEvent( event );

			expect( onCancel ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'focus trap', () => {
		it( 'should trap Tab key at end of dialog', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.open();

			const focusable = dialog.dialog.querySelectorAll( 'button, input' );
			const first = focusable[ 0 ];
			const last = focusable[ focusable.length - 1 ];

			// Focus last element
			last.focus();
			expect( document.activeElement ).toBe( last );

			// Tab key should wrap to first
			const tabEvent = new KeyboardEvent( 'keydown', {
				key: 'Tab',
				shiftKey: false,
				bubbles: true
			} );
			const preventDefault = jest.spyOn( tabEvent, 'preventDefault' );
			dialog.dialog.dispatchEvent( tabEvent );

			expect( preventDefault ).toHaveBeenCalled();
		} );

		it( 'should trap Shift+Tab at start of dialog', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.open();

			const focusable = dialog.dialog.querySelectorAll( 'button, input' );
			const first = focusable[ 0 ];

			// Focus first element
			first.focus();
			expect( document.activeElement ).toBe( first );

			// Shift+Tab should wrap to last
			const tabEvent = new KeyboardEvent( 'keydown', {
				key: 'Tab',
				shiftKey: true,
				bubbles: true
			} );
			const preventDefault = jest.spyOn( tabEvent, 'preventDefault' );
			dialog.dialog.dispatchEvent( tabEvent );

			expect( preventDefault ).toHaveBeenCalled();
		} );

		it( 'should ignore non-Tab keys in focus trap', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.open();

			const enterEvent = new KeyboardEvent( 'keydown', {
				key: 'Enter',
				bubbles: true
			} );
			const preventDefault = jest.spyOn( enterEvent, 'preventDefault' );
			dialog.dialog.dispatchEvent( enterEvent );

			expect( preventDefault ).not.toHaveBeenCalled();
		} );

		it( 'should handle dialog with no focusable elements', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );
			dialog.open();

			// Remove all focusable elements (simulate edge case)
			const focusable = dialog.dialog.querySelectorAll( 'button, input' );
			focusable.forEach( ( el ) => el.remove() );

			// Tab key should not throw
			const tabEvent = new KeyboardEvent( 'keydown', {
				key: 'Tab',
				bubbles: true
			} );
			expect( () => dialog.dialog.dispatchEvent( tabEvent ) ).not.toThrow();
		} );
	} );

	describe( 'open focus behavior', () => {
		it( 'should focus dialog when no focusable elements', () => {
			const dialog = new ColorPickerDialog( { onApply: () => {} } );

			// Override createDialogDOM to return dialog without buttons
			const originalCreateDialogDOM = dialog.createDialogDOM.bind( dialog );
			dialog.createDialogDOM = () => {
				const result = originalCreateDialogDOM();
				// Remove all buttons and inputs
				result.dialog.querySelectorAll( 'button, input' ).forEach( ( el ) => el.remove() );
				return result;
			};

			dialog.open();

			// Dialog itself should be focused
			expect( document.activeElement ).toBe( dialog.dialog );
		} );
	} );

	describe( 'live preview (onPreview callback)', () => {
		it( 'should store originalColor for cancel restoration', () => {
			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply: () => {}
			} );
			expect( dialog.originalColor ).toBe( '#ff0000' );
		} );

		it( 'should call onPreview when color is selected', () => {
			const onPreview = jest.fn();
			const dialog = new ColorPickerDialog( {
				currentColor: '#000000',
				onApply: () => {},
				onPreview: onPreview
			} );
			dialog.open();

			// Click a color swatch
			const swatch = dialog.dialog.querySelector( '.color-picker-swatch-btn' );
			swatch.click();

			expect( onPreview ).toHaveBeenCalled();
			dialog.close();
		} );

		it( 'should call onPreview with the selected color value', () => {
			const onPreview = jest.fn();
			const dialog = new ColorPickerDialog( {
				currentColor: '#000000',
				onApply: () => {},
				onPreview: onPreview
			} );
			dialog.open();

			// Change the custom color input
			const customInput = dialog.dialog.querySelector( '.color-picker-custom-input' );
			customInput.value = '#00ff00';
			customInput.dispatchEvent( new Event( 'input' ) );

			expect( onPreview ).toHaveBeenCalledWith( '#00ff00' );
			dialog.close();
		} );

		it( 'should restore original color on cancel', () => {
			const onPreview = jest.fn();
			const onCancel = jest.fn();
			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply: () => {},
				onCancel: onCancel,
				onPreview: onPreview
			} );
			dialog.open();

			// Change color
			dialog.selectedColor = '#00ff00';
			dialog.triggerPreview();
			expect( onPreview ).toHaveBeenCalledWith( '#00ff00' );

			// Click cancel
			const cancelBtn = dialog.dialog.querySelector( '.color-picker-btn--secondary' );
			cancelBtn.click();

			// Should restore original color
			expect( onPreview ).toHaveBeenCalledWith( '#ff0000' );
			expect( onCancel ).toHaveBeenCalled();
		} );

		it( 'should restore original color on Escape key', () => {
			const onPreview = jest.fn();
			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply: () => {},
				onPreview: onPreview
			} );
			dialog.open();

			// Change color
			dialog.selectedColor = '#00ff00';
			dialog.triggerPreview();
			onPreview.mockClear();

			// Press Escape
			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			// Should restore original color
			expect( onPreview ).toHaveBeenCalledWith( '#ff0000' );
		} );

		it( 'should restore original color on overlay click', () => {
			const onPreview = jest.fn();
			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply: () => {},
				onPreview: onPreview
			} );
			dialog.open();

			// Change color
			dialog.selectedColor = '#00ff00';
			dialog.triggerPreview();
			onPreview.mockClear();

			// Click overlay
			dialog.overlay.click();

			// Should restore original color
			expect( onPreview ).toHaveBeenCalledWith( '#ff0000' );
		} );

		it( 'should not call onPreview if not provided', () => {
			const dialog = new ColorPickerDialog( {
				currentColor: '#000000',
				onApply: () => {}
				// No onPreview provided
			} );
			dialog.open();

			// This should not throw
			expect( () => {
				dialog.triggerPreview();
			} ).not.toThrow();

			dialog.close();
		} );

		it( 'restoreOriginalColor should not throw if onPreview is null', () => {
			const dialog = new ColorPickerDialog( {
				currentColor: '#ff0000',
				onApply: () => {}
				// No onPreview
			} );

			expect( () => {
				dialog.restoreOriginalColor();
			} ).not.toThrow();
		} );
	} );
} );
