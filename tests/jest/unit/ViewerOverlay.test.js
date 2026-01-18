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
} );
