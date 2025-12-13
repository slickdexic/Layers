/**
 * @jest-environment jsdom
 */
'use strict';

// Load the module
require( '../../resources/ext.layers.editor/ui/ConfirmDialog.js' );

describe( 'ConfirmDialog', () => {
	let ConfirmDialog;

	beforeEach( () => {
		ConfirmDialog = window.Layers && window.Layers.UI && window.Layers.UI.ConfirmDialog;
		// Clear document body before each test
		document.body.innerHTML = '';
	} );

	afterEach( () => {
		// Clean up any remaining dialogs
		document.querySelectorAll( '.layers-modal-overlay, .layers-modal-dialog' ).forEach( ( el ) => {
			el.remove();
		} );
	} );

	describe( 'constructor', () => {
		it( 'should create instance with default options', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test message'
			} );
			expect( dialog.message ).toBe( 'Test message' );
			expect( typeof dialog.onConfirm ).toBe( 'function' );
			expect( typeof dialog.onCancel ).toBe( 'function' );
		} );

		it( 'should accept custom strings', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test',
				strings: {
					title: 'Custom Title',
					cancel: 'No',
					confirm: 'Yes'
				}
			} );
			expect( dialog.strings.title ).toBe( 'Custom Title' );
			expect( dialog.strings.cancel ).toBe( 'No' );
			expect( dialog.strings.confirm ).toBe( 'Yes' );
		} );
	} );

	describe( 'open', () => {
		it( 'should add overlay and dialog to document body', () => {
			const dialog = new ConfirmDialog( {
				message: 'Are you sure?'
			} );
			dialog.open();

			expect( document.querySelector( '.layers-modal-overlay' ) ).not.toBeNull();
			expect( document.querySelector( '.layers-modal-dialog' ) ).not.toBeNull();
		} );

		it( 'should display the message', () => {
			const dialog = new ConfirmDialog( {
				message: 'Custom message here'
			} );
			dialog.open();

			const textEl = document.querySelector( '.layers-modal-dialog p' );
			expect( textEl.textContent ).toBe( 'Custom message here' );
		} );

		it( 'should have cancel and confirm buttons', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test'
			} );
			dialog.open();

			const buttons = document.querySelectorAll( '.layers-modal-dialog button' );
			expect( buttons.length ).toBe( 2 );
		} );

		it( 'should focus the confirm button', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test'
			} );
			dialog.open();

			const confirmBtn = document.querySelector( '.layers-btn-danger' );
			expect( document.activeElement ).toBe( confirmBtn );
		} );
	} );

	describe( 'close', () => {
		it( 'should remove overlay and dialog from DOM', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test'
			} );
			dialog.open();
			dialog.close();

			expect( document.querySelector( '.layers-modal-overlay' ) ).toBeNull();
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );

		it( 'should restore focus to previously focused element', () => {
			const button = document.createElement( 'button' );
			button.id = 'test-button';
			document.body.appendChild( button );
			button.focus();

			const dialog = new ConfirmDialog( {
				message: 'Test'
			} );
			dialog.open();
			dialog.close();

			expect( document.activeElement ).toBe( button );
		} );
	} );

	describe( 'callbacks', () => {
		it( 'should call onConfirm when confirm button clicked', () => {
			const onConfirm = jest.fn();
			const dialog = new ConfirmDialog( {
				message: 'Test',
				onConfirm
			} );
			dialog.open();

			const confirmBtn = document.querySelector( '.layers-btn-danger' );
			confirmBtn.click();

			expect( onConfirm ).toHaveBeenCalled();
		} );

		it( 'should call onCancel when cancel button clicked', () => {
			const onCancel = jest.fn();
			const dialog = new ConfirmDialog( {
				message: 'Test',
				onCancel
			} );
			dialog.open();

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

			expect( onCancel ).toHaveBeenCalled();
		} );

		it( 'should close dialog after confirm', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test',
				onConfirm: () => {}
			} );
			dialog.open();

			const confirmBtn = document.querySelector( '.layers-btn-danger' );
			confirmBtn.click();

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );

		it( 'should close dialog after cancel', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test',
				onCancel: () => {}
			} );
			dialog.open();

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );
	} );

	describe( 'keyboard handling', () => {
		it( 'should close on Escape key', () => {
			const onCancel = jest.fn();
			const dialog = new ConfirmDialog( {
				message: 'Test',
				onCancel
			} );
			dialog.open();

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( onCancel ).toHaveBeenCalled();
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );
	} );

	describe( 'static methods', () => {
		describe( 'simpleConfirm', () => {
			it( 'should use native confirm when available', () => {
				const originalConfirm = window.confirm;
				window.confirm = jest.fn().mockReturnValue( true );

				const result = ConfirmDialog.simpleConfirm( 'Test message' );

				expect( window.confirm ).toHaveBeenCalledWith( 'Test message' );
				expect( result ).toBe( true );

				window.confirm = originalConfirm;
			} );

			it( 'should return false when native confirm returns false', () => {
				const originalConfirm = window.confirm;
				window.confirm = jest.fn().mockReturnValue( false );

				const result = ConfirmDialog.simpleConfirm( 'Test message' );

				expect( result ).toBe( false );

				window.confirm = originalConfirm;
			} );

			it( 'should auto-confirm and log when confirm unavailable', () => {
				const originalConfirm = window.confirm;
				delete window.confirm;
				const logger = jest.fn();

				const result = ConfirmDialog.simpleConfirm( 'Test message', logger );

				expect( result ).toBe( true );
				expect( logger ).toHaveBeenCalled();

				window.confirm = originalConfirm;
			} );
		} );

		describe( 'show', () => {
			it( 'should create and open a dialog', () => {
				const instance = ConfirmDialog.show( {
					message: 'Quick show test'
				} );

				expect( instance instanceof ConfirmDialog ).toBe( true );
				expect( document.querySelector( '.layers-modal-dialog' ) ).not.toBeNull();

				instance.close();
			} );
		} );
	} );

	describe( 'accessibility', () => {
		it( 'should have proper ARIA attributes', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test'
			} );
			dialog.open();

			const dialogEl = document.querySelector( '.layers-modal-dialog' );
			expect( dialogEl.getAttribute( 'role' ) ).toBe( 'alertdialog' );
			expect( dialogEl.getAttribute( 'aria-modal' ) ).toBe( 'true' );
		} );

		it( 'should have accessible buttons', () => {
			const dialog = new ConfirmDialog( {
				message: 'Test'
			} );
			dialog.open();

			const buttons = document.querySelectorAll( '.layers-modal-dialog button' );
			buttons.forEach( ( btn ) => {
				expect( btn.getAttribute( 'type' ) ).toBe( 'button' );
			} );
		} );
	} );

	describe( 'cleanup registration', () => {
		it( 'should call registerCleanup with close function', () => {
			const registerCleanup = jest.fn();
			const dialog = new ConfirmDialog( {
				message: 'Test',
				registerCleanup
			} );
			dialog.open();

			expect( registerCleanup ).toHaveBeenCalled();
			const cleanupFn = registerCleanup.mock.calls[ 0 ][ 0 ];
			expect( typeof cleanupFn ).toBe( 'function' );
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export ConfirmDialog for Node.js', () => {
			const exported = require( '../../resources/ext.layers.editor/ui/ConfirmDialog.js' );
			expect( typeof exported ).toBe( 'function' );
			expect( typeof exported.simpleConfirm ).toBe( 'function' );
			expect( typeof exported.show ).toBe( 'function' );
		} );
	} );
} );
