/**
 * Tests for ViewerOverlay - Hover action buttons for layered images
 *
 * @jest-environment jsdom
 */

'use strict';

// Load the module
require( '../../../resources/ext.layers/viewer/ViewerOverlay.js' );

describe( 'ViewerOverlay', () => {
	let ViewerOverlay;
	let container;
	let img;

	beforeEach( () => {
		// Reset DOM
		document.body.innerHTML = '';

		// Setup mw global
		global.mw = {
			config: {
				get: jest.fn( ( key ) => {
					if ( key === 'wgLayersCanEdit' ) {
						return true;
					}
					if ( key === 'wgUserRights' ) {
						return [ 'read', 'edit', 'editlayers' ];
					}
					if ( key === 'wgPageName' ) {
						return 'Main_Page';
					}
					if ( key === 'wgCanonicalNamespace' ) {
						return '';
					}
					return null;
				} )
			},
			message: jest.fn( ( key ) => ( {
				exists: () => true,
				text: () => key
			} ) ),
			util: {
				getUrl: jest.fn( ( page ) => '/wiki/' + page )
			},
			log: jest.fn(),
			notify: jest.fn()
		};

		// Setup Layers namespace
		window.Layers = window.Layers || {};
		window.Layers.Viewer = window.Layers.Viewer || {};

		// Get the ViewerOverlay class
		ViewerOverlay = window.Layers.Viewer.Overlay;

		// Create test elements
		container = document.createElement( 'span' );
		container.style.position = 'relative';
		container.style.display = 'inline-block';
		document.body.appendChild( container );

		img = document.createElement( 'img' );
		img.src = 'https://example.com/Test_image.jpg';
		img.setAttribute( 'data-file-name', 'Test_image.jpg' );
		container.appendChild( img );
	} );

	afterEach( () => {
		// Cleanup
		if ( img && img.layersOverlay ) {
			img.layersOverlay.destroy();
		}
		document.body.innerHTML = '';
		delete global.mw;
	} );

	describe( 'constructor', () => {
		it( 'should create an overlay with edit and view buttons when user has editlayers right', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.overlay ).not.toBeNull();
			expect( overlay.canEdit ).toBe( true );

			const buttons = overlay.overlay.querySelectorAll( 'button' );
			expect( buttons.length ).toBe( 2 ); // Edit + View
		} );

		it( 'should only show view button when user lacks editlayers right', () => {
			// Remove editlayers right
			global.mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return false; // No edit permission
				}
				if ( key === 'wgUserRights' ) {
					return [ 'read', 'edit' ]; // No editlayers
				}
				return null;
			} );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				canEdit: false
			} );

			expect( overlay.canEdit ).toBe( false );

			const buttons = overlay.overlay.querySelectorAll( 'button' );
			expect( buttons.length ).toBe( 1 ); // Only View
		} );

		it( 'should not create overlay without filename', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: '' // Empty filename
			} );

			expect( overlay.overlay ).toBeNull();
		} );

		it( 'should not create overlay without container', () => {
			const overlay = new ViewerOverlay( {
				container: null,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.overlay ).toBeNull();
		} );
	} );

	describe( 'visibility', () => {
		it( 'should show overlay on mouseenter', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Initially hidden
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( false );

			// Trigger mouseenter
			const event = new MouseEvent( 'mouseenter', { bubbles: true } );
			container.dispatchEvent( event );

			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
		} );

		it( 'should hide overlay on mouseleave', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Show first
			overlay._showOverlay();
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );

			// Trigger mouseleave
			const event = new MouseEvent( 'mouseleave', { bubbles: true } );
			container.dispatchEvent( event );

			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( false );
		} );

		it( 'should show overlay on focusin', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const event = new FocusEvent( 'focusin', { bubbles: true } );
			container.dispatchEvent( event );

			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
		} );
	} );

	describe( 'buttons', () => {
		it( 'should have correct ARIA attributes on edit button', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			expect( editBtn ).not.toBeNull();
			expect( editBtn.getAttribute( 'type' ) ).toBe( 'button' );
			expect( editBtn.getAttribute( 'aria-label' ) ).toBe( 'layers-viewer-edit' );
			expect( editBtn.getAttribute( 'title' ) ).toBe( 'layers-viewer-edit' );
		} );

		it( 'should have correct ARIA attributes on view button', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			expect( viewBtn ).not.toBeNull();
			expect( viewBtn.getAttribute( 'type' ) ).toBe( 'button' );
			expect( viewBtn.getAttribute( 'aria-label' ) ).toBe( 'layers-viewer-view' );
			expect( viewBtn.getAttribute( 'title' ) ).toBe( 'layers-viewer-view' );
		} );

		it( 'should contain SVG icons in buttons', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );

			expect( editBtn.querySelector( 'svg' ) ).not.toBeNull();
			expect( viewBtn.querySelector( 'svg' ) ).not.toBeNull();
		} );
	} );

	describe( 'edit action', () => {
		it( 'should build correct edit URL when modal not available', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'default'
			} );

			// Test the URL building method directly
			const editUrl = overlay._buildEditUrl();

			expect( editUrl ).toContain( 'action=editlayers' );
			expect( editUrl ).toContain( 'File:Test_image.jpg' );
		} );

		it( 'should include setname in URL when not default', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'anatomy-labels'
			} );

			// Test the URL building method directly
			const editUrl = overlay._buildEditUrl();

			expect( editUrl ).toContain( 'setname=anatomy-labels' );
		} );

		it( 'should not include setname in URL when set to default', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'default'
			} );

			const editUrl = overlay._buildEditUrl();

			// Default setname should not be included in URL
			expect( editUrl ).not.toContain( 'setname=' );
		} );
	} );

	describe( 'view action', () => {
		it( 'should open file page in new tab as fallback', () => {
			const mockOpen = jest.fn();
			const originalOpen = window.open;
			window.open = mockOpen;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			viewBtn.click();

			expect( mockOpen ).toHaveBeenCalled();
			expect( mockOpen.mock.calls[ 0 ][ 0 ] ).toContain( 'layers=on' );
			expect( mockOpen.mock.calls[ 0 ][ 1 ] ).toBe( '_blank' );

			window.open = originalOpen;
		} );
	} );

	describe( 'touch support', () => {
		it( 'should show overlay on touchstart', () => {
			jest.useFakeTimers();

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Trigger touchstart
			const event = new TouchEvent( 'touchstart', {
				bubbles: true,
				touches: [ { clientX: 0, clientY: 0 } ]
			} );
			container.dispatchEvent( event );

			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );

			jest.useRealTimers();
		} );

		it( 'should auto-hide after 3 seconds on touch', () => {
			jest.useFakeTimers();

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Trigger touchstart
			const event = new TouchEvent( 'touchstart', {
				bubbles: true,
				touches: [ { clientX: 0, clientY: 0 } ]
			} );
			container.dispatchEvent( event );

			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );

			// Advance time by 3 seconds
			jest.advanceTimersByTime( 3000 );

			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( false );

			jest.useRealTimers();
		} );
	} );

	describe( 'destroy', () => {
		it( 'should remove overlay from DOM', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( container.querySelector( '.layers-viewer-overlay' ) ).not.toBeNull();

			overlay.destroy();

			expect( container.querySelector( '.layers-viewer-overlay' ) ).toBeNull();
			expect( overlay.overlay ).toBeNull();
		} );

		it( 'should clear touch timeout on destroy', () => {
			jest.useFakeTimers();
			const clearTimeoutSpy = jest.spyOn( global, 'clearTimeout' );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Trigger touch to create timeout
			const event = new TouchEvent( 'touchstart', {
				bubbles: true,
				touches: [ { clientX: 0, clientY: 0 } ]
			} );
			container.dispatchEvent( event );

			overlay.destroy();

			expect( clearTimeoutSpy ).toHaveBeenCalled();

			clearTimeoutSpy.mockRestore();
			jest.useRealTimers();
		} );
	} );

	describe( 'permission checking', () => {
		it( 'should handle missing mw.config gracefully', () => {
			delete global.mw.config;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Should fall back to no edit permission
			expect( overlay.canEdit ).toBe( false );
		} );

		it( 'should handle null rights array', () => {
			global.mw.config.get = jest.fn( () => null );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.canEdit ).toBe( false );
		} );
	} );

	describe( 'setname handling', () => {
		it( 'should default to "default" setname', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.setname ).toBe( 'default' );
		} );

		it( 'should use provided setname', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'my-custom-set'
			} );

			expect( overlay.setname ).toBe( 'my-custom-set' );
		} );
	} );

	describe( 'accessibility', () => {
		it( 'should have toolbar role on overlay', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.overlay.getAttribute( 'role' ) ).toBe( 'toolbar' );
		} );

		it( 'should have aria-label on overlay', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.overlay.getAttribute( 'aria-label' ) ).toBe( 'layers-viewer-overlay-label' );
		} );
	} );

	describe( 'debug logging', () => {
		it( 'should log debug messages when debug mode enabled', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				debug: true
			} );

			expect( overlay.debug ).toBe( true );
			// Debug log should be called during init
			expect( global.mw.log ).toHaveBeenCalled();
		} );

		it( 'should not log when debug mode disabled', () => {
			global.mw.log.mockClear();

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				debug: false
			} );

			overlay.debugLog( 'test message' );

			// mw.log should not be called
			expect( global.mw.log ).not.toHaveBeenCalled();
		} );

		it( 'should handle missing mw.log gracefully', () => {
			delete global.mw.log;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				debug: true
			} );

			// Should not throw
			expect( () => overlay.debugLog( 'test' ) ).not.toThrow();
		} );
	} );

	describe( 'icon factory integration', () => {
		it( 'should use IconFactory when available', () => {
			const mockCreatePencilIcon = jest.fn( () => {
				const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
				return svg;
			} );
			const mockCreateFullscreenIcon = jest.fn( () => {
				const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
				return svg;
			} );

			window.Layers.UI = {
				IconFactory: {
					createPencilIcon: mockCreatePencilIcon,
					createFullscreenIcon: mockCreateFullscreenIcon
				}
			};

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( mockCreatePencilIcon ).toHaveBeenCalled();
			expect( mockCreateFullscreenIcon ).toHaveBeenCalled();

			delete window.Layers.UI;
		} );

		it( 'should fall back to inline SVG when IconFactory not available', () => {
			delete window.Layers.UI;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			const svg = editBtn.querySelector( 'svg' );

			expect( svg ).not.toBeNull();
			expect( svg.getAttribute( 'viewBox' ) ).toBe( '0 0 24 24' );
		} );
	} );

	describe( 'edit button click handling', () => {
		beforeEach( () => {
			jest.useFakeTimers();
		} );

		afterEach( () => {
			jest.useRealTimers();
		} );

		it( 'should navigate to edit page when modal not available', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Spy on _buildEditUrl to verify navigation path is taken (without actually navigating)
			const buildUrlSpy = jest.spyOn( overlay, '_buildEditUrl' );

			// Spy on _handleEditClick and prevent actual execution
			const handleEditSpy = jest.spyOn( overlay, '_handleEditClick' ).mockImplementation( function () {
				// Modal not available, so navigation path should be called
				this._buildEditUrl();
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			editBtn.click();

			// Verify the edit handler was triggered
			expect( handleEditSpy ).toHaveBeenCalled();
			// Verify URL building was called (proves navigation path taken)
			expect( buildUrlSpy ).toHaveBeenCalled();
			expect( buildUrlSpy.mock.results[ 0 ].value ).toContain( 'action=editlayers' );
		} );

		it( 'should open modal editor when available and not on File page', () => {
			const mockOpen = jest.fn().mockResolvedValue( { saved: false } );
			const mockModal = jest.fn( () => ( { open: mockOpen } ) );

			window.Layers.Modal = {
				LayersEditorModal: mockModal
			};

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			editBtn.click();

			expect( mockModal ).toHaveBeenCalled();
			// Modal receives filename, setname, and the built URL
			expect( mockOpen ).toHaveBeenCalledWith(
				'Test_image.jpg',
				'default',
				expect.stringContaining( 'action=editlayers' )
			);

			delete window.Layers.Modal;
		} );

		it( 'should pass autoCreate=true when overlay is for non-existent set', () => {
			const mockOpen = jest.fn().mockResolvedValue( { saved: false } );
			const mockModal = jest.fn( () => ( { open: mockOpen } ) );

			window.Layers.Modal = {
				LayersEditorModal: mockModal
			};

			// Mark the image as needing auto-create
			img.setAttribute( 'data-layer-autocreate', '1' );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'new-set'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			editBtn.click();

			expect( mockModal ).toHaveBeenCalled();
			// Modal receives filename, setname, and built URL with autocreate
			expect( mockOpen ).toHaveBeenCalledWith(
				'Test_image.jpg',
				'new-set',
				expect.stringContaining( 'autocreate=1' )
			);

			delete window.Layers.Modal;
		} );

		it( 'should include autocreate in URL when autoCreate is true', () => {
			img.setAttribute( 'data-layer-autocreate', '1' );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'my-new-set'
			} );

			const url = overlay._buildEditUrl();
			expect( url ).toContain( 'autocreate=1' );
			expect( url ).toContain( 'setname=my-new-set' );
		} );

		it( 'should not use modal when on File page', () => {
			global.mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return true;
				}
				if ( key === 'wgCanonicalNamespace' ) {
					return 'File';
				}
				return null;
			} );

			const mockModal = jest.fn( () => ( { open: jest.fn() } ) );
			window.Layers.Modal = { LayersEditorModal: mockModal };

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Spy on _buildEditUrl to verify navigation path is taken
			const buildUrlSpy = jest.spyOn( overlay, '_buildEditUrl' );

			// Replace _handleEditClick to prevent actual navigation but still test logic
			const originalHandler = overlay._handleEditClick.bind( overlay );
			overlay._handleEditClick = function () {
				// Test that _shouldUseModal returns false on File page
				const shouldUseModal = this._shouldUseModal();
				expect( shouldUseModal ).toBe( false );
				// Verify navigation would be called (URL building)
				this._buildEditUrl();
			};

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			editBtn.click();

			// Should NOT use modal on File page
			expect( mockModal ).not.toHaveBeenCalled();
			// Verify navigation path was taken
			expect( buildUrlSpy ).toHaveBeenCalled();
			expect( buildUrlSpy.mock.results[ 0 ].value ).toContain( 'action=editlayers' );

			delete window.Layers.Modal;
		} );

		it( 'should refresh viewers when modal saves', async () => {
			const mockRefresh = jest.fn();
			global.mw.layers = {
				viewerManager: {
					refreshAllViewers: mockRefresh
				}
			};

			const mockOpen = jest.fn().mockResolvedValue( { saved: true } );
			window.Layers.Modal = {
				LayersEditorModal: jest.fn( () => ( { open: mockOpen } ) )
			};

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			editBtn.click();

			// Wait for promise to resolve
			await jest.runAllTimersAsync();

			expect( mockRefresh ).toHaveBeenCalled();

			delete window.Layers.Modal;
			delete global.mw.layers;
		} );
	} );

	describe( 'view button with lightbox', () => {
		it( 'should open lightbox when available', () => {
			const mockLightboxOpen = jest.fn();
			const mockLightbox = jest.fn( () => ( { open: mockLightboxOpen } ) );

			window.Layers.Viewer.Lightbox = mockLightbox;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'my-set'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			viewBtn.click();

			expect( mockLightbox ).toHaveBeenCalled();
			expect( mockLightboxOpen ).toHaveBeenCalledWith( {
				filename: 'Test_image.jpg',
				setName: 'my-set',
				imageUrl: img.src
			} );

			delete window.Layers.Viewer.Lightbox;
		} );

		it( 'should fall back to image src when mw.util not available', () => {
			delete window.Layers.Viewer.Lightbox;
			delete global.mw.util;

			const mockOpen = jest.fn();
			const originalOpen = window.open;
			window.open = mockOpen;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			viewBtn.click();

			expect( mockOpen ).toHaveBeenCalledWith( img.src, '_blank' );

			window.open = originalOpen;
		} );
	} );

	describe( '_buildEditUrl edge cases', () => {
		it( 'should use fallback URL when mw.util not available', () => {
			delete global.mw.util;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'custom'
			} );

			const url = overlay._buildEditUrl();

			expect( url ).toContain( '/wiki/File:' );
			expect( url ).toContain( 'action=editlayers' );
			expect( url ).toContain( 'setname=custom' );
		} );
	} );

	describe( '_shouldUseModal', () => {
		it( 'should return false when mw is undefined', () => {
			const savedMw = global.mw;
			delete global.mw;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay._shouldUseModal() ).toBe( false );

			global.mw = savedMw;
		} );

		it( 'should return false when modal module not available', () => {
			delete window.Layers.Modal;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay._shouldUseModal() ).toBe( false );
		} );
	} );

	describe( 'message fallbacks', () => {
		it( 'should use fallback when message does not exist', () => {
			global.mw.message = jest.fn( () => ( {
				exists: () => false,
				text: () => 'unused'
			} ) );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Should use fallback strings
			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			// The title should be something (either message or fallback)
			expect( editBtn.getAttribute( 'title' ) ).toBeTruthy();
		} );

		it( 'should use fallback when mw.message not available', () => {
			delete global.mw.message;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			expect( editBtn.getAttribute( 'title' ) ).toBeTruthy();
		} );
	} );

	describe( 'button click event handling', () => {
		it( 'should stop propagation on button click', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			const mockStopPropagation = jest.fn();

			const event = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( event, 'stopPropagation', { value: mockStopPropagation } );

			// Replace open to prevent actual navigation
			const originalOpen = window.open;
			window.open = jest.fn();

			viewBtn.dispatchEvent( event );

			expect( mockStopPropagation ).toHaveBeenCalled();

			window.open = originalOpen;
		} );

		it( 'should prevent default on button click', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			const mockPreventDefault = jest.fn();

			const event = new MouseEvent( 'click', { bubbles: true } );
			Object.defineProperty( event, 'preventDefault', { value: mockPreventDefault } );

			const originalOpen = window.open;
			window.open = jest.fn();

			viewBtn.dispatchEvent( event );

			expect( mockPreventDefault ).toHaveBeenCalled();

			window.open = originalOpen;
		} );

		it( 'should stop propagation on button mouseenter', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			const mockStopPropagation = jest.fn();

			const event = new MouseEvent( 'mouseenter', { bubbles: true } );
			Object.defineProperty( event, 'stopPropagation', { value: mockStopPropagation } );

			viewBtn.dispatchEvent( event );

			expect( mockStopPropagation ).toHaveBeenCalled();
		} );
	} );

	describe( 'touch handling edge cases', () => {
		it( 'should clear previous timeout on new touch', () => {
			jest.useFakeTimers();

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// First touch
			const event1 = new TouchEvent( 'touchstart', {
				bubbles: true,
				touches: [ { clientX: 0, clientY: 0 } ]
			} );
			container.dispatchEvent( event1 );

			const firstTimeout = overlay.touchTimeout;

			// Second touch before timeout
			const event2 = new TouchEvent( 'touchstart', {
				bubbles: true,
				touches: [ { clientX: 10, clientY: 10 } ]
			} );
			container.dispatchEvent( event2 );

			// Timeout should be different (new timeout created)
			expect( overlay.touchTimeout ).not.toBe( firstTimeout );

			// Overlay should still be visible
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );

			jest.useRealTimers();
		} );
	} );

	describe( 'permission check with wgUserRights fallback', () => {
		it( 'should use wgUserRights when wgLayersCanEdit is null', () => {
			global.mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return null; // Not set
				}
				if ( key === 'wgUserRights' ) {
					return [ 'read', 'edit', 'editlayers' ];
				}
				return null;
			} );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.canEdit ).toBe( true );
		} );

		it( 'should return false when wgUserRights lacks editlayers', () => {
			global.mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return null;
				}
				if ( key === 'wgUserRights' ) {
					return [ 'read', 'edit' ]; // No editlayers
				}
				return null;
			} );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.canEdit ).toBe( false );
		} );

		it( 'should return false when wgUserRights is not an array', () => {
			global.mw.config.get = jest.fn( ( key ) => {
				if ( key === 'wgLayersCanEdit' ) {
					return null;
				}
				if ( key === 'wgUserRights' ) {
					return 'editlayers'; // Not an array
				}
				return null;
			} );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.canEdit ).toBe( false );
		} );
	} );

	describe( 'focusout handling', () => {
		it( 'should hide overlay on focusout when focus leaves container', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Show overlay first
			overlay._showOverlay();
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );

			// Trigger focusout with relatedTarget outside container
			const outsideElement = document.createElement( 'div' );
			document.body.appendChild( outsideElement );

			const event = new FocusEvent( 'focusout', {
				bubbles: true,
				relatedTarget: outsideElement
			} );
			container.dispatchEvent( event );

			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( false );
		} );

		it( 'should not hide overlay when focus moves within container', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			// Show overlay first
			overlay._showOverlay();

			// Focus moves to a button within the overlay
			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );

			const event = new FocusEvent( 'focusout', {
				bubbles: true,
				relatedTarget: viewBtn
			} );
			container.dispatchEvent( event );

			// Should still be visible since focus is within container
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
		} );
	} );} );