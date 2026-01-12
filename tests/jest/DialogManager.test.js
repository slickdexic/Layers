/**
 * @jest-environment jsdom
 */

/**
 * Tests for DialogManager
 *
 * DialogManager handles modal dialogs for confirmation, prompts, and keyboard shortcuts.
 */

const DialogManager = require( '../../resources/ext.layers.editor/editor/DialogManager.js' );

describe( 'DialogManager', () => {
	let dialogManager;
	let mockEditor;

	beforeEach( () => {
		// Clear document body
		document.body.innerHTML = '';

		// Mock editor
		mockEditor = {
			isDirty: jest.fn().mockReturnValue( false )
		};

		// Mock window.layersMessages
		window.layersMessages = {
			get: jest.fn( ( key, fallback ) => fallback )
		};

		// Register in namespace
		window.Layers = window.Layers || {};
		window.Layers.UI = window.Layers.UI || {};
		window.Layers.UI.DialogManager = DialogManager;

		dialogManager = new DialogManager( { editor: mockEditor } );
	} );

	afterEach( () => {
		if ( dialogManager ) {
			dialogManager.destroy();
		}
		document.body.innerHTML = '';
		delete window.layersMessages;
	} );

	describe( 'constructor', () => {
		it( 'should initialize with editor reference', () => {
			expect( dialogManager.editor ).toBe( mockEditor );
		} );

		it( 'should initialize with empty activeDialogs array', () => {
			expect( dialogManager.activeDialogs ).toEqual( [] );
		} );
	} );

	describe( 'getMessage', () => {
		it( 'should return fallback when layersMessages is available', () => {
			const result = dialogManager.getMessage( 'some-key', 'Fallback Text' );
			expect( result ).toBe( 'Fallback Text' );
			expect( window.layersMessages.get ).toHaveBeenCalledWith( 'some-key', 'Fallback Text' );
		} );

		it( 'should return fallback when layersMessages is not available', () => {
			delete window.layersMessages;
			const result = dialogManager.getMessage( 'some-key', 'Fallback Text' );
			expect( result ).toBe( 'Fallback Text' );
		} );

		it( 'should return empty string when no fallback provided', () => {
			delete window.layersMessages;
			const result = dialogManager.getMessage( 'some-key' );
			expect( result ).toBe( '' );
		} );
	} );

	describe( 'createOverlay', () => {
		it( 'should create overlay element with correct class', () => {
			const overlay = dialogManager.createOverlay();
			expect( overlay.tagName ).toBe( 'DIV' );
			expect( overlay.className ).toBe( 'layers-modal-overlay' );
		} );

		it( 'should set role to presentation', () => {
			const overlay = dialogManager.createOverlay();
			expect( overlay.getAttribute( 'role' ) ).toBe( 'presentation' );
		} );
	} );

	describe( 'createDialog', () => {
		it( 'should create dialog element with correct class', () => {
			const dialog = dialogManager.createDialog( 'Test Dialog' );
			expect( dialog.tagName ).toBe( 'DIV' );
			expect( dialog.className ).toBe( 'layers-modal-dialog' );
		} );

		it( 'should set ARIA attributes correctly', () => {
			const dialog = dialogManager.createDialog( 'Test Dialog' );
			expect( dialog.getAttribute( 'role' ) ).toBe( 'alertdialog' );
			expect( dialog.getAttribute( 'aria-modal' ) ).toBe( 'true' );
			expect( dialog.getAttribute( 'aria-label' ) ).toBe( 'Test Dialog' );
		} );
	} );

	describe( 'createButton', () => {
		it( 'should create button with text and class', () => {
			const button = dialogManager.createButton( 'Click Me', 'test-class' );
			expect( button.tagName ).toBe( 'BUTTON' );
			expect( button.textContent ).toBe( 'Click Me' );
			expect( button.className ).toBe( 'test-class' );
		} );
	} );

	describe( 'showCancelConfirmDialog', () => {
		it( 'should create and display overlay and dialog', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );

			const overlay = document.querySelector( '.layers-modal-overlay' );
			const dialog = document.querySelector( '.layers-modal-dialog' );

			expect( overlay ).not.toBeNull();
			expect( dialog ).not.toBeNull();
		} );

		it( 'should track dialog in activeDialogs', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );
			expect( dialogManager.activeDialogs.length ).toBe( 1 );
		} );

		it( 'should display confirmation message', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );

			const dialog = document.querySelector( '.layers-modal-dialog' );
			const message = dialog.querySelector( 'p' );

			expect( message.textContent ).toContain( 'unsaved changes' );
		} );

		it( 'should have Continue Editing and Discard buttons', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );

			const buttons = document.querySelectorAll( '.layers-modal-buttons button' );
			expect( buttons.length ).toBe( 2 );
			expect( buttons[ 0 ].textContent ).toBe( 'Continue Editing' );
			expect( buttons[ 1 ].textContent ).toBe( 'Discard Changes' );
		} );

		it( 'should focus Continue Editing button by default', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );

			const continueBtn = document.querySelector( '.layers-btn-primary' );
			expect( document.activeElement ).toBe( continueBtn );
		} );

		it( 'should close dialog when Continue Editing is clicked', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );

			const continueBtn = document.querySelector( '.layers-btn-primary' );
			continueBtn.click();

			expect( document.querySelector( '.layers-modal-overlay' ) ).toBeNull();
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
			expect( dialogManager.activeDialogs.length ).toBe( 0 );
		} );

		it( 'should call onConfirm and close when Discard is clicked', () => {
			const onConfirm = jest.fn();
			dialogManager.showCancelConfirmDialog( onConfirm );

			const discardBtn = document.querySelector( '.layers-btn-danger' );
			discardBtn.click();

			expect( onConfirm ).toHaveBeenCalled();
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );

		it( 'should close dialog when Escape key is pressed', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );
	} );

	describe( 'showPromptDialog', () => {
		it( 'should create dialog with title', () => {
			dialogManager.showPromptDialog( {
				title: 'Enter Name',
				onConfirm: jest.fn()
			} );

			const title = document.querySelector( '.layers-modal-title' );
			expect( title.textContent ).toBe( 'Enter Name' );
		} );

		it( 'should create dialog with message', () => {
			dialogManager.showPromptDialog( {
				message: 'Please enter a name',
				onConfirm: jest.fn()
			} );

			const message = document.querySelector( '.layers-modal-dialog p' );
			expect( message.textContent ).toBe( 'Please enter a name' );
		} );

		it( 'should create input with placeholder and default value', () => {
			dialogManager.showPromptDialog( {
				placeholder: 'Type here...',
				defaultValue: 'Default',
				onConfirm: jest.fn()
			} );

			const input = document.querySelector( '.layers-modal-input' );
			expect( input.placeholder ).toBe( 'Type here...' );
			expect( input.value ).toBe( 'Default' );
		} );

		it( 'should focus and select input', () => {
			dialogManager.showPromptDialog( {
				defaultValue: 'Test',
				onConfirm: jest.fn()
			} );

			const input = document.querySelector( '.layers-modal-input' );
			expect( document.activeElement ).toBe( input );
		} );

		it( 'should call onConfirm with input value when OK clicked', () => {
			const onConfirm = jest.fn();
			dialogManager.showPromptDialog( {
				defaultValue: 'Test Value',
				onConfirm
			} );

			const okBtn = document.querySelector( '.layers-btn-primary' );
			okBtn.click();

			expect( onConfirm ).toHaveBeenCalledWith( 'Test Value' );
		} );

		it( 'should call onCancel when Cancel clicked', () => {
			const onCancel = jest.fn();
			dialogManager.showPromptDialog( {
				onConfirm: jest.fn(),
				onCancel
			} );

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

			expect( onCancel ).toHaveBeenCalled();
		} );

		it( 'should call onConfirm when Enter key pressed', () => {
			const onConfirm = jest.fn();
			dialogManager.showPromptDialog( {
				defaultValue: 'Enter Test',
				onConfirm
			} );

			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			document.dispatchEvent( event );

			expect( onConfirm ).toHaveBeenCalledWith( 'Enter Test' );
		} );

		it( 'should call onCancel when Escape key pressed', () => {
			const onCancel = jest.fn();
			dialogManager.showPromptDialog( {
				onConfirm: jest.fn(),
				onCancel
			} );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( onCancel ).toHaveBeenCalled();
		} );

		it( 'should handle missing onCancel gracefully', () => {
			dialogManager.showPromptDialog( {
				onConfirm: jest.fn()
				// No onCancel
			} );

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );

			// Should not throw
			expect( () => cancelBtn.click() ).not.toThrow();
		} );

		it( 'should trap Tab focus at last element', () => {
			dialogManager.showPromptDialog( {
				onConfirm: jest.fn()
			} );

			const confirmBtn = document.querySelector( '.layers-btn-primary' );
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );

			// Focus confirm button (last focusable)
			confirmBtn.focus();

			// Tab should wrap to input (first focusable)
			const tabEvent = new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true } );
			Object.defineProperty( tabEvent, 'preventDefault', { value: jest.fn() } );
			document.dispatchEvent( tabEvent );

			expect( tabEvent.preventDefault ).toHaveBeenCalled();

			// Clean up
			cancelBtn.click();
		} );

		it( 'should trap Shift+Tab focus at first element', () => {
			dialogManager.showPromptDialog( {
				onConfirm: jest.fn()
			} );

			const input = document.querySelector( '.layers-modal-input' );
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );

			// Focus input (first focusable)
			input.focus();

			// Shift+Tab should wrap to confirm button (last focusable)
			const tabEvent = new KeyboardEvent( 'keydown', {
				key: 'Tab',
				shiftKey: true,
				bubbles: true
			} );
			Object.defineProperty( tabEvent, 'preventDefault', { value: jest.fn() } );
			document.dispatchEvent( tabEvent );

			expect( tabEvent.preventDefault ).toHaveBeenCalled();

			// Clean up
			cancelBtn.click();
		} );
	} );

	describe( 'showKeyboardShortcutsDialog', () => {
		it( 'should create dialog with shortcuts list', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const dialog = document.querySelector( '.layers-shortcuts-dialog' );
			expect( dialog ).not.toBeNull();
		} );

		it( 'should display keyboard shortcuts', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const list = document.querySelector( '.layers-shortcuts-list' );
			const kbdElements = list.querySelectorAll( 'kbd' );

			expect( kbdElements.length ).toBeGreaterThan( 0 );
			// Check for some expected shortcuts
			const shortcuts = Array.from( kbdElements ).map( ( kbd ) => kbd.textContent );
			expect( shortcuts ).toContain( 'Ctrl+Z' );
			expect( shortcuts ).toContain( 'Escape' );
		} );

		it( 'should include clipboard shortcuts', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const list = document.querySelector( '.layers-shortcuts-list' );
			const kbdElements = list.querySelectorAll( 'kbd' );
			const shortcuts = Array.from( kbdElements ).map( ( kbd ) => kbd.textContent );

			expect( shortcuts ).toContain( 'Ctrl+C' );
			expect( shortcuts ).toContain( 'Ctrl+X' );
			expect( shortcuts ).toContain( 'Ctrl+V' );
		} );

		it( 'should include group/ungroup shortcuts', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const list = document.querySelector( '.layers-shortcuts-list' );
			const kbdElements = list.querySelectorAll( 'kbd' );
			const shortcuts = Array.from( kbdElements ).map( ( kbd ) => kbd.textContent );

			expect( shortcuts ).toContain( 'Ctrl+G' );
			expect( shortcuts ).toContain( 'Ctrl+Shift+G' );
		} );

		it( 'should include smart guides and help shortcuts', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const list = document.querySelector( '.layers-shortcuts-list' );
			const kbdElements = list.querySelectorAll( 'kbd' );
			const shortcuts = Array.from( kbdElements ).map( ( kbd ) => kbd.textContent );

			expect( shortcuts ).toContain( ';' );
			expect( shortcuts ).toContain( 'Shift+?' );
		} );

		it( 'should have Close button', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const closeBtn = document.querySelector( '.layers-btn-primary' );
			expect( closeBtn.textContent ).toBe( 'Close' );
		} );

		it( 'should close when Close button clicked', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const closeBtn = document.querySelector( '.layers-btn-primary' );
			closeBtn.click();

			expect( document.querySelector( '.layers-shortcuts-dialog' ) ).toBeNull();
		} );

		it( 'should close when overlay clicked', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const overlay = document.querySelector( '.layers-modal-overlay' );
			overlay.click();

			expect( document.querySelector( '.layers-shortcuts-dialog' ) ).toBeNull();
		} );

		it( 'should close when Escape key pressed', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			expect( document.querySelector( '.layers-shortcuts-dialog' ) ).toBeNull();
		} );

		it( 'should focus close button', () => {
			dialogManager.showKeyboardShortcutsDialog();

			const closeBtn = document.querySelector( '.layers-btn-primary' );
			expect( document.activeElement ).toBe( closeBtn );
		} );
	} );

	describe( 'setupKeyboardHandler', () => {
		it( 'should trap Tab focus within dialog', () => {
			const dialog = document.createElement( 'div' );
			const button1 = document.createElement( 'button' );
			button1.textContent = 'First';
			const button2 = document.createElement( 'button' );
			button2.textContent = 'Last';
			dialog.appendChild( button1 );
			dialog.appendChild( button2 );
			document.body.appendChild( dialog );

			const onEscape = jest.fn();
			dialogManager.setupKeyboardHandler( dialog, onEscape );

			// Focus last button
			button2.focus();

			// Tab should wrap to first
			const tabEvent = new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true } );
			Object.defineProperty( tabEvent, 'preventDefault', { value: jest.fn() } );
			document.dispatchEvent( tabEvent );

			expect( tabEvent.preventDefault ).toHaveBeenCalled();
		} );

		it( 'should trap Shift+Tab focus at first element', () => {
			const dialog = document.createElement( 'div' );
			const button1 = document.createElement( 'button' );
			button1.textContent = 'First';
			const button2 = document.createElement( 'button' );
			button2.textContent = 'Last';
			dialog.appendChild( button1 );
			dialog.appendChild( button2 );
			document.body.appendChild( dialog );

			const onEscape = jest.fn();
			dialogManager.setupKeyboardHandler( dialog, onEscape );

			// Focus first button
			button1.focus();

			// Shift+Tab should wrap to last
			const tabEvent = new KeyboardEvent( 'keydown', {
				key: 'Tab',
				shiftKey: true,
				bubbles: true
			} );
			Object.defineProperty( tabEvent, 'preventDefault', { value: jest.fn() } );
			document.dispatchEvent( tabEvent );

			expect( tabEvent.preventDefault ).toHaveBeenCalled();
		} );

		it( 'should call onEscape when Escape is pressed', () => {
			const dialog = document.createElement( 'div' );
			document.body.appendChild( dialog );

			const onEscape = jest.fn();
			dialogManager.setupKeyboardHandler( dialog, onEscape );

			const escapeEvent = new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true } );
			document.dispatchEvent( escapeEvent );

			expect( onEscape ).toHaveBeenCalled();
		} );
	} );

	describe( 'showConfirmDialog (Promise-based)', () => {
		it( 'should return a Promise', () => {
			const result = dialogManager.showConfirmDialog( { message: 'Test?' } );
			expect( result ).toBeInstanceOf( Promise );
			// Clean up by clicking cancel
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should create dialog with message', () => {
			dialogManager.showConfirmDialog( { message: 'Are you sure?' } );

			const message = document.querySelector( '.layers-modal-dialog p' );
			expect( message.textContent ).toBe( 'Are you sure?' );

			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should display title when provided', () => {
			dialogManager.showConfirmDialog( {
				title: 'Confirm Action',
				message: 'Test'
			} );

			const title = document.querySelector( '.layers-modal-title' );
			expect( title.textContent ).toBe( 'Confirm Action' );

			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should resolve to true when confirm is clicked', async () => {
			const promise = dialogManager.showConfirmDialog( { message: 'Confirm?' } );

			const confirmBtn = document.querySelector( '.layers-btn-primary' );
			confirmBtn.click();

			const result = await promise;
			expect( result ).toBe( true );
		} );

		it( 'should resolve to false when cancel is clicked', async () => {
			const promise = dialogManager.showConfirmDialog( { message: 'Confirm?' } );

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

			const result = await promise;
			expect( result ).toBe( false );
		} );

		it( 'should resolve to false when Escape is pressed', async () => {
			const promise = dialogManager.showConfirmDialog( { message: 'Confirm?' } );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			const result = await promise;
			expect( result ).toBe( false );
		} );

		it( 'should use custom button text', () => {
			dialogManager.showConfirmDialog( {
				message: 'Delete item?',
				confirmText: 'Delete',
				cancelText: 'Keep'
			} );

			const buttons = document.querySelectorAll( '.layers-modal-buttons button' );
			expect( buttons[ 0 ].textContent ).toBe( 'Keep' );
			expect( buttons[ 1 ].textContent ).toBe( 'Delete' );

			// Clean up
			buttons[ 0 ].click();
		} );

		it( 'should apply danger styling when isDanger is true', () => {
			dialogManager.showConfirmDialog( {
				message: 'Delete permanently?',
				isDanger: true
			} );

			const confirmBtn = document.querySelector( '.layers-btn-primary' );
			expect( confirmBtn.className ).toContain( 'layers-btn-danger' );

			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should focus cancel button by default', () => {
			dialogManager.showConfirmDialog( { message: 'Confirm?' } );

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			expect( document.activeElement ).toBe( cancelBtn );

			// Clean up
			cancelBtn.click();
		} );

		it( 'should remove dialog from DOM after resolution', async () => {
			const promise = dialogManager.showConfirmDialog( { message: 'Confirm?' } );

			expect( document.querySelector( '.layers-modal-dialog' ) ).not.toBeNull();

			const confirmBtn = document.querySelector( '.layers-btn-primary' );
			confirmBtn.click();

			await promise;

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
			expect( document.querySelector( '.layers-modal-overlay' ) ).toBeNull();
		} );

		it( 'should track and untrack dialog in activeDialogs', async () => {
			const promise = dialogManager.showConfirmDialog( { message: 'Confirm?' } );

			expect( dialogManager.activeDialogs.length ).toBe( 1 );

			const confirmBtn = document.querySelector( '.layers-btn-primary' );
			confirmBtn.click();

			await promise;

			expect( dialogManager.activeDialogs.length ).toBe( 0 );
		} );
	} );

	describe( 'showAlertDialog (Promise-based)', () => {
		it( 'should return a Promise', () => {
			const result = dialogManager.showAlertDialog( { message: 'Alert!' } );
			expect( result ).toBeInstanceOf( Promise );
			// Clean up
			const okBtn = document.querySelector( '.layers-btn-primary' );
			okBtn.click();
		} );

		it( 'should display message', () => {
			dialogManager.showAlertDialog( { message: 'Something happened!' } );

			const message = document.querySelector( '.layers-modal-dialog p' );
			expect( message.textContent ).toBe( 'Something happened!' );

			// Clean up
			const okBtn = document.querySelector( '.layers-btn-primary' );
			okBtn.click();
		} );

		it( 'should display title when provided', () => {
			dialogManager.showAlertDialog( {
				title: 'Error',
				message: 'Something went wrong'
			} );

			const title = document.querySelector( '.layers-modal-title' );
			expect( title.textContent ).toBe( 'Error' );

			// Clean up
			const okBtn = document.querySelector( '.layers-btn-primary' );
			okBtn.click();
		} );

		it( 'should have only OK button', () => {
			dialogManager.showAlertDialog( { message: 'Alert!' } );

			const buttons = document.querySelectorAll( '.layers-modal-buttons button' );
			expect( buttons.length ).toBe( 1 );
			expect( buttons[ 0 ].textContent ).toBe( 'OK' );

			// Clean up
			buttons[ 0 ].click();
		} );

		it( 'should apply type class when specified', () => {
			dialogManager.showAlertDialog( {
				message: 'Error occurred',
				type: 'error'
			} );

			const dialog = document.querySelector( '.layers-modal-dialog' );
			expect( dialog.className ).toContain( 'layers-modal-error' );

			// Clean up
			const okBtn = document.querySelector( '.layers-btn-primary' );
			okBtn.click();
		} );

		it( 'should resolve when OK is clicked', async () => {
			const promise = dialogManager.showAlertDialog( { message: 'Alert!' } );

			const okBtn = document.querySelector( '.layers-btn-primary' );
			okBtn.click();

			// Should resolve without value
			await expect( promise ).resolves.toBeUndefined();
		} );

		it( 'should resolve when Escape is pressed', async () => {
			const promise = dialogManager.showAlertDialog( { message: 'Alert!' } );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			await expect( promise ).resolves.toBeUndefined();
		} );

		it( 'should focus OK button', () => {
			dialogManager.showAlertDialog( { message: 'Alert!' } );

			const okBtn = document.querySelector( '.layers-btn-primary' );
			expect( document.activeElement ).toBe( okBtn );

			// Clean up
			okBtn.click();
		} );

		it( 'should clean up dialog after resolution', async () => {
			const promise = dialogManager.showAlertDialog( { message: 'Alert!' } );

			const okBtn = document.querySelector( '.layers-btn-primary' );
			okBtn.click();

			await promise;

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
			expect( dialogManager.activeDialogs.length ).toBe( 0 );
		} );
	} );

	describe( 'showPromptDialogAsync (Promise-based)', () => {
		it( 'should return a Promise', () => {
			const result = dialogManager.showPromptDialogAsync( {} );
			expect( result ).toBeInstanceOf( Promise );
			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should create input field', () => {
			dialogManager.showPromptDialogAsync( {} );

			const input = document.querySelector( '.layers-modal-input' );
			expect( input ).not.toBeNull();
			expect( input.type ).toBe( 'text' );

			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should set placeholder and default value', () => {
			dialogManager.showPromptDialogAsync( {
				placeholder: 'Enter name...',
				defaultValue: 'Default Name'
			} );

			const input = document.querySelector( '.layers-modal-input' );
			expect( input.placeholder ).toBe( 'Enter name...' );
			expect( input.value ).toBe( 'Default Name' );

			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should display title and message when provided', () => {
			dialogManager.showPromptDialogAsync( {
				title: 'Enter Value',
				message: 'Please type something'
			} );

			const title = document.querySelector( '.layers-modal-title' );
			const message = document.querySelector( '.layers-modal-dialog p' );

			expect( title.textContent ).toBe( 'Enter Value' );
			expect( message.textContent ).toBe( 'Please type something' );

			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should use custom button text', () => {
			dialogManager.showPromptDialogAsync( {
				confirmText: 'Save',
				cancelText: 'Discard'
			} );

			const buttons = document.querySelectorAll( '.layers-modal-buttons button' );
			expect( buttons[ 0 ].textContent ).toBe( 'Discard' );
			expect( buttons[ 1 ].textContent ).toBe( 'Save' );

			// Clean up
			buttons[ 0 ].click();
		} );

		it( 'should focus and select input', () => {
			dialogManager.showPromptDialogAsync( {
				defaultValue: 'Selected Text'
			} );

			const input = document.querySelector( '.layers-modal-input' );
			expect( document.activeElement ).toBe( input );

			// Clean up
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();
		} );

		it( 'should resolve with input value when confirm clicked', async () => {
			const promise = dialogManager.showPromptDialogAsync( {
				defaultValue: 'Test Value'
			} );

			const confirmBtn = document.querySelector( '.layers-btn-primary' );
			confirmBtn.click();

			const result = await promise;
			expect( result ).toBe( 'Test Value' );
		} );

		it( 'should resolve with modified input value', async () => {
			const promise = dialogManager.showPromptDialogAsync( {
				defaultValue: 'Original'
			} );

			const input = document.querySelector( '.layers-modal-input' );
			input.value = 'Modified Value';

			const confirmBtn = document.querySelector( '.layers-btn-primary' );
			confirmBtn.click();

			const result = await promise;
			expect( result ).toBe( 'Modified Value' );
		} );

		it( 'should resolve with null when cancel clicked', async () => {
			const promise = dialogManager.showPromptDialogAsync( {
				defaultValue: 'Some Value'
			} );

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

			const result = await promise;
			expect( result ).toBeNull();
		} );

		it( 'should resolve with input value when Enter pressed', async () => {
			const promise = dialogManager.showPromptDialogAsync( {
				defaultValue: 'Enter Test'
			} );

			const event = new KeyboardEvent( 'keydown', { key: 'Enter' } );
			document.dispatchEvent( event );

			const result = await promise;
			expect( result ).toBe( 'Enter Test' );
		} );

		it( 'should resolve with null when Escape pressed', async () => {
			const promise = dialogManager.showPromptDialogAsync( {
				defaultValue: 'Escape Test'
			} );

			const event = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( event );

			const result = await promise;
			expect( result ).toBeNull();
		} );

		it( 'should trap Tab focus within dialog', () => {
			dialogManager.showPromptDialogAsync( {} );

			const input = document.querySelector( '.layers-modal-input' );
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			const confirmBtn = document.querySelector( '.layers-btn-primary' );

			// Focus confirm button (last focusable)
			confirmBtn.focus();

			// Tab should wrap to input (first focusable)
			const tabEvent = new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true } );
			Object.defineProperty( tabEvent, 'preventDefault', { value: jest.fn() } );
			document.dispatchEvent( tabEvent );

			expect( tabEvent.preventDefault ).toHaveBeenCalled();

			// Clean up
			cancelBtn.click();
		} );

		it( 'should trap Shift+Tab focus at first element', () => {
			dialogManager.showPromptDialogAsync( {} );

			const input = document.querySelector( '.layers-modal-input' );
			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			const confirmBtn = document.querySelector( '.layers-btn-primary' );

			// Focus input (first focusable)
			input.focus();

			// Shift+Tab should wrap to confirm button (last focusable)
			const tabEvent = new KeyboardEvent( 'keydown', {
				key: 'Tab',
				shiftKey: true,
				bubbles: true
			} );
			Object.defineProperty( tabEvent, 'preventDefault', { value: jest.fn() } );
			document.dispatchEvent( tabEvent );

			expect( tabEvent.preventDefault ).toHaveBeenCalled();

			// Clean up
			cancelBtn.click();
		} );

		it( 'should clean up dialog after resolution', async () => {
			const promise = dialogManager.showPromptDialogAsync( {} );

			expect( document.querySelector( '.layers-modal-dialog' ) ).not.toBeNull();
			expect( dialogManager.activeDialogs.length ).toBe( 1 );

			const cancelBtn = document.querySelector( '.layers-btn-secondary' );
			cancelBtn.click();

			await promise;

			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
			expect( dialogManager.activeDialogs.length ).toBe( 0 );
		} );
	} );

	describe( 'closeAllDialogs', () => {
		it( 'should close multiple open dialogs', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );
			dialogManager.showKeyboardShortcutsDialog();

			expect( dialogManager.activeDialogs.length ).toBe( 2 );
			expect( document.querySelectorAll( '.layers-modal-dialog' ).length ).toBe( 2 );

			dialogManager.closeAllDialogs();

			expect( dialogManager.activeDialogs.length ).toBe( 0 );
			expect( document.querySelectorAll( '.layers-modal-dialog' ).length ).toBe( 0 );
		} );

		it( 'should handle empty activeDialogs', () => {
			expect( () => dialogManager.closeAllDialogs() ).not.toThrow();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should close all dialogs and clear editor reference', () => {
			dialogManager.showCancelConfirmDialog( jest.fn() );

			dialogManager.destroy();

			expect( dialogManager.editor ).toBeNull();
			expect( dialogManager.activeDialogs.length ).toBe( 0 );
			expect( document.querySelector( '.layers-modal-dialog' ) ).toBeNull();
		} );
	} );

	describe( 'module exports', () => {
		it( 'should export DialogManager to window.Layers.UI', () => {
			expect( window.Layers.UI.DialogManager ).toBe( DialogManager );
		} );
	} );
} );
