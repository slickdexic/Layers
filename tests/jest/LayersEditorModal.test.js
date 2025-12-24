/**
 * @jest-environment jsdom
 */

/**
 * Tests for LayersEditorModal
 */

describe( 'LayersEditorModal', () => {
	let LayersEditorModal;
	let mockMw;

	beforeEach( () => {
		// Reset DOM
		document.body.innerHTML = '';

		// Mock window.scrollTo (JSDOM doesn't implement it)
		window.scrollTo = jest.fn();

		// Setup mw mock
		mockMw = {
			hook: jest.fn( () => ( {
				add: jest.fn()
			} ) ),
			message: jest.fn( ( key ) => ( {
				exists: jest.fn( () => true ),
				text: jest.fn( () => key )
			} ) ),
			util: {
				getUrl: jest.fn( ( title ) => '/wiki/' + title )
			},
			notify: jest.fn()
		};
		window.mw = mockMw;

		// Mock jQuery (as some MediaWiki code expects it)
		window.jQuery = jest.fn( ( selector ) => ( {
			0: typeof selector === 'string' ? document.querySelector( selector ) : selector
		} ) );
		window.$ = window.jQuery;

		// Clear Layers namespace before each test
		delete window.Layers;

		// Mock announcer
		window.layersAnnouncer = {
			announce: jest.fn()
		};

		// Load the module (executes IIFE which sets up window.Layers)
		jest.resetModules();
		require( '../../resources/ext.layers.modal/LayersEditorModal.js' );
		LayersEditorModal = window.Layers.Modal.LayersEditorModal;
	} );

	afterEach( () => {
		delete window.mw;
		delete window.Layers;
		delete window.layersAnnouncer;
		jest.clearAllMocks();
	} );

	describe( 'constructor', () => {
		it( 'should create instance with null properties', () => {
			const modal = new LayersEditorModal();
			expect( modal.overlay ).toBeNull();
			expect( modal.iframe ).toBeNull();
			expect( modal.escapeHandler ).toBeNull();
			expect( modal.messageHandler ).toBeNull();
		} );
	} );

	describe( 'open', () => {
		it( 'should create overlay element', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			// Modal should create overlay
			expect( modal.overlay ).not.toBeNull();
			expect( modal.overlay.className ).toBe( 'layers-editor-modal-overlay' );

			// Clean up
			modal.close( false );
			await openPromise;
		} );

		it( 'should set ARIA attributes on overlay', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			expect( modal.overlay.getAttribute( 'role' ) ).toBe( 'dialog' );
			expect( modal.overlay.getAttribute( 'aria-modal' ) ).toBe( 'true' );
			expect( modal.overlay.hasAttribute( 'aria-label' ) ).toBe( true );

			modal.close( false );
			await openPromise;
		} );

		it( 'should create close button', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			const closeBtn = modal.overlay.querySelector( '.layers-editor-modal-close' );
			expect( closeBtn ).not.toBeNull();
			expect( closeBtn.hasAttribute( 'aria-label' ) ).toBe( true );

			modal.close( false );
			await openPromise;
		} );

		it( 'should create iframe with correct URL', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'anatomy' );

			expect( modal.iframe ).not.toBeNull();
			expect( modal.iframe.className ).toBe( 'layers-editor-modal-iframe' );
			expect( modal.iframe.src ).toContain( 'action=editlayers' );
			expect( modal.iframe.src ).toContain( 'setname=anatomy' );
			expect( modal.iframe.src ).toContain( 'modal=1' );

			modal.close( false );
			await openPromise;
		} );

		it( 'should use provided editor URL', async () => {
			const modal = new LayersEditorModal();
			const customUrl = '/wiki/File:Custom.jpg?action=editlayers&modal=1';
			const openPromise = modal.open( 'Test.jpg', 'default', customUrl );

			expect( modal.iframe.src ).toContain( customUrl );

			modal.close( false );
			await openPromise;
		} );

		it( 'should prevent body scroll', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			expect( document.body.classList.contains( 'layers-modal-open' ) ).toBe( true );
			expect( document.body.style.overflow ).toBe( 'hidden' );

			modal.close( false );
			await openPromise;
		} );

		it( 'should add overlay to document body', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			expect( document.body.contains( modal.overlay ) ).toBe( true );

			modal.close( false );
			await openPromise;
		} );

		it( 'should announce opening to screen readers', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			expect( window.layersAnnouncer.announce ).toHaveBeenCalled();

			modal.close( false );
			await openPromise;
		} );
	} );

	describe( 'close', () => {
		it( 'should remove overlay from DOM', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			modal.close( false );
			await openPromise;

			expect( modal.overlay ).toBeNull();
			expect( document.querySelector( '.layers-editor-modal-overlay' ) ).toBeNull();
		} );

		it( 'should restore body scroll', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			modal.close( false );
			await openPromise;

			expect( document.body.classList.contains( 'layers-modal-open' ) ).toBe( false );
			expect( document.body.style.overflow ).toBe( '' );
		} );

		it( 'should resolve promise with saved status', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			modal.close( true );
			const result = await openPromise;

			expect( result ).toEqual( { saved: true } );
		} );

		it( 'should dispatch layers-modal-closed event', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			const eventHandler = jest.fn();
			document.addEventListener( 'layers-modal-closed', eventHandler );

			modal.close( true );
			await openPromise;

			expect( eventHandler ).toHaveBeenCalled();
			expect( eventHandler.mock.calls[ 0 ][ 0 ].detail.saved ).toBe( true );

			document.removeEventListener( 'layers-modal-closed', eventHandler );
		} );

		it( 'should announce closing to screen readers', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			// Clear the opening announcement
			window.layersAnnouncer.announce.mockClear();

			modal.close( false );
			await openPromise;

			expect( window.layersAnnouncer.announce ).toHaveBeenCalled();
		} );
	} );

	describe( 'escape key handling', () => {
		it( 'should close modal on Escape key', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			// Simulate Escape key
			const escapeEvent = new KeyboardEvent( 'keydown', { key: 'Escape' } );
			document.dispatchEvent( escapeEvent );

			const result = await openPromise;

			expect( modal.overlay ).toBeNull();
			expect( result.saved ).toBe( false );
		} );

		it( 'should remove escape handler after close', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			modal.close( false );
			await openPromise;

			expect( modal.escapeHandler ).toBeNull();
		} );
	} );

	describe( 'close button', () => {
		it( 'should close modal when clicked', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			const closeBtn = modal.overlay.querySelector( '.layers-editor-modal-close' );
			closeBtn.click();

			const result = await openPromise;

			expect( modal.overlay ).toBeNull();
			expect( result.saved ).toBe( false );
		} );
	} );

	describe( 'postMessage handling', () => {
		it( 'should setup message listener on iframe load', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			// Simulate iframe load
			modal.iframe.dispatchEvent( new Event( 'load' ) );

			expect( modal.messageHandler ).not.toBeNull();

			modal.close( false );
			await openPromise;
		} );

		it( 'should close on layers-editor-close message', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			// Setup message listener
			modal.iframe.dispatchEvent( new Event( 'load' ) );

			// Simulate postMessage from iframe
			const messageEvent = new MessageEvent( 'message', {
				origin: window.location.origin,
				data: { type: 'layers-editor-close', saved: true }
			} );
			window.dispatchEvent( messageEvent );

			const result = await openPromise;

			expect( modal.overlay ).toBeNull();
			expect( result.saved ).toBe( true );
		} );

		it( 'should ignore messages from different origin', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			modal.iframe.dispatchEvent( new Event( 'load' ) );

			// Message from different origin
			const messageEvent = new MessageEvent( 'message', {
				origin: 'https://evil.com',
				data: { type: 'layers-editor-close', saved: true }
			} );
			window.dispatchEvent( messageEvent );

			// Modal should still be open
			expect( modal.overlay ).not.toBeNull();

			modal.close( false );
			await openPromise;
		} );

		it( 'should dispatch layers-saved event on save message', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			modal.iframe.dispatchEvent( new Event( 'load' ) );

			const eventHandler = jest.fn();
			document.addEventListener( 'layers-saved', eventHandler );

			// Simulate save message
			const messageEvent = new MessageEvent( 'message', {
				origin: window.location.origin,
				data: { type: 'layers-editor-save', filename: 'Test.jpg' }
			} );
			window.dispatchEvent( messageEvent );

			expect( eventHandler ).toHaveBeenCalled();

			document.removeEventListener( 'layers-saved', eventHandler );
			modal.close( false );
			await openPromise;
		} );
	} );

	describe( 'initModalTriggers', () => {
		it( 'should initialize click handlers on modal trigger links', () => {
			const initModalTriggers = window.Layers.Modal.initModalTriggers;

			// Create a trigger element
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-editor-modal-trigger';
			trigger.dataset.layersFilename = 'Test.jpg';
			trigger.dataset.layersSetname = 'default';
			document.body.appendChild( trigger );

			initModalTriggers( document.body );

			expect( trigger.dataset.layersModalInit ).toBe( '1' );
		} );

		it( 'should skip already initialized triggers', () => {
			const initModalTriggers = window.Layers.Modal.initModalTriggers;

			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-editor-modal-trigger';
			trigger.dataset.layersFilename = 'Test.jpg';
			trigger.dataset.layersModalInit = '1';
			document.body.appendChild( trigger );

			const addEventListenerSpy = jest.spyOn( trigger, 'addEventListener' );

			initModalTriggers( document.body );

			expect( addEventListenerSpy ).not.toHaveBeenCalled();
		} );

		it( 'should handle null container', () => {
			const initModalTriggers = window.Layers.Modal.initModalTriggers;

			// Should not throw when passed null
			expect( () => initModalTriggers( null ) ).not.toThrow();
		} );

		it( 'should warn and not open modal when trigger missing filename', () => {
			const initModalTriggers = window.Layers.Modal.initModalTriggers;
			const warnSpy = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );

			// Create trigger without filename
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-editor-modal-trigger';
			// Intentionally missing data-layers-filename
			document.body.appendChild( trigger );

			initModalTriggers( document.body );

			// Simulate click
			trigger.click();

			expect( warnSpy ).toHaveBeenCalledWith(
				'[LayersModal] Missing data-layers-filename attribute'
			);

			warnSpy.mockRestore();
		} );

		it( 'should open modal when trigger clicked with valid filename', () => {
			const initModalTriggers = window.Layers.Modal.initModalTriggers;

			// Create trigger with filename
			const trigger = document.createElement( 'a' );
			trigger.className = 'layers-editor-modal-trigger';
			trigger.dataset.layersFilename = 'ValidFile.jpg';
			trigger.dataset.layersSetname = 'annotations';
			trigger.dataset.layersEditorUrl = '/wiki/File:ValidFile.jpg?action=editlayers&modal=1';
			document.body.appendChild( trigger );

			initModalTriggers( document.body );

			// Simulate click
			trigger.click();

			// Modal should be created
			const modal = document.querySelector( '.layers-editor-modal-overlay' );
			expect( modal ).not.toBeNull();

			// Clean up
			modal.remove();
			document.body.style.overflow = '';
			document.body.classList.remove( 'layers-modal-open' );
		} );
	} );

	describe( 'postMessage edge cases', () => {
		it( 'should ignore messages with invalid data structure', async () => {
			const modal = new LayersEditorModal();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			modal.iframe.dispatchEvent( new Event( 'load' ) );

			// Message with null data
			const nullDataEvent = new MessageEvent( 'message', {
				origin: window.location.origin,
				data: null
			} );
			window.dispatchEvent( nullDataEvent );

			// Message with non-string type
			const invalidTypeEvent = new MessageEvent( 'message', {
				origin: window.location.origin,
				data: { type: 123 }
			} );
			window.dispatchEvent( invalidTypeEvent );

			// Modal should still be open
			expect( modal.overlay ).not.toBeNull();

			modal.close( false );
			await openPromise;
		} );
	} );

	describe( 'getMessage fallback', () => {
		it( 'should return fallback when mw.message is not available', async () => {
			// Temporarily remove mw.message but keep mw.util
			const originalMessage = window.mw.message;
			delete window.mw.message;

			// Reload module to pick up the change
			jest.resetModules();
			delete window.Layers;
			require( '../../resources/ext.layers.modal/LayersEditorModal.js' );
			const ModalClass = window.Layers.Modal.LayersEditorModal;

			const modal = new ModalClass();
			const openPromise = modal.open( 'Test.jpg', 'default' );

			// The overlay title should use fallback text
			const title = modal.overlay.querySelector( '.layers-editor-modal-title' );
			expect( title.textContent ).toContain( 'Edit Layers' );

			modal.close( false );
			await openPromise;

			// Restore mw.message
			window.mw.message = originalMessage;
		} );
	} );
} );
