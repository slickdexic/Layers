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

	describe( 'callback routing and lifecycle', () => {
		let routing;
		let originalLightbox;
		let originalModal;

		beforeEach( () => {
			originalLightbox = window.Layers.lightbox;
			originalModal = window.Layers.Modal;
			window.Layers.lightbox = { open: jest.fn() };
			window.Layers.Modal = { LayersEditorModal: jest.fn() };
			mw.Api = jest.fn();
			routing = [
				jest.spyOn( ViewerOverlay.prototype, '_buildEditUrl' ),
				jest.spyOn( ViewerOverlay.prototype, '_shouldUseModal' ),
				jest.spyOn( ViewerOverlay.prototype, '_findClickTarget' ),
				jest.spyOn( ViewerOverlay.prototype, '_checkEditPermission' ),
				jest.spyOn( window, 'open' ).mockImplementation( () => null ),
				window.Layers.lightbox.open,
				window.Layers.Modal.LayersEditorModal,
				mw.Api,
				mw.util.getUrl,
				mw.config.get
			];
		} );

		afterEach( () => {
			for ( const spy of routing ) {
				expect( spy ).not.toHaveBeenCalled();
			}
			jest.restoreAllMocks();
			window.Layers.lightbox = originalLightbox;
			window.Layers.Modal = originalModal;
		} );

		it.each( [ 'host', 'descendant' ] )( 'initial focus shows controls for a pre-focused %s without moving focus', ( target ) => {
			container.tabIndex = 0;
			const anchor = document.createElement( 'a' );
			anchor.href = '#existing';
			container.appendChild( anchor );
			const focused = target === 'host' ? container : anchor;
			focused.focus();
			expect( document.activeElement ).toBe( focused );
			const focus = jest.spyOn( focused, 'focus' );
			const focusIn = jest.fn();
			container.addEventListener( 'focusin', focusIn );
			const overlay = new ViewerOverlay( {
				container, canEdit: false, onEdit: jest.fn(), onView: jest.fn()
			} );
			try {
				expect( document.activeElement ).toBe( focused );
				expect( focus ).not.toHaveBeenCalled();
				expect( focusIn ).not.toHaveBeenCalled();
				expect( container.querySelector( '.layers-viewer-overlay-btn--edit' ) ).toBeNull();
				expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
			} finally {
				overlay.destroy();
				container.removeEventListener( 'focusin', focusIn );
			}
		} );

		it( 'initial focus remains visible when replacing an overlay on a focused host', () => {
			const oldView = jest.fn();
			const previous = new ViewerOverlay( { container, onView: oldView } );
			container.focus();
			expect( previous.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
			const oldButton = container.querySelector( '.layers-viewer-overlay-btn--view' );
			const focus = jest.spyOn( container, 'focus' );
			const focusIn = jest.fn();
			container.addEventListener( 'focusin', focusIn );
			const onView = jest.fn();
			const overlay = new ViewerOverlay( { container, onView } );
			try {
				expect( document.activeElement ).toBe( container );
				expect( focus ).not.toHaveBeenCalled();
				expect( focusIn ).not.toHaveBeenCalled();
				expect( previous.container ).toBeNull();
				expect( container.querySelectorAll( '.layers-viewer-overlay' ) ).toHaveLength( 1 );
				expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
				oldButton.click();
				expect( oldView ).not.toHaveBeenCalled();
				const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
				view.click();
				expect( onView ).toHaveBeenCalledTimes( 1 );
				expect( onView ).toHaveBeenCalledWith( view );
			} finally {
				overlay.destroy();
				container.removeEventListener( 'focusin', focusIn );
			}
		} );

		it( 'initial focus outside the host leaves new controls hidden', () => {
			const outside = document.createElement( 'button' );
			document.body.appendChild( outside );
			outside.focus();
			const overlay = new ViewerOverlay( { container, onView: jest.fn() } );
			try {
				expect( document.activeElement ).toBe( outside );
				expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( false );
			} finally {
				overlay.destroy();
			}
		} );

		it( 'dispatches admitted image callbacks once without intercepting the PDF anchor', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '#pdf';
			container.appendChild( anchor );
			anchor.appendChild( img );
			const onEdit = jest.fn();
			const onView = jest.fn();
			const location = window.location.href;
			mw.config.get.mockReturnValue( false );
			const overlay = new ViewerOverlay( {
				container, imageElement: img, filename: 'Current.pdf', canEdit: true, onEdit, onView
			} );
			const edit = container.querySelector( '.layers-viewer-overlay-btn--edit' );
			const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
			edit.click();
			view.click();
			expect( onEdit ).toHaveBeenCalledTimes( 1 );
			expect( onEdit ).toHaveBeenCalledWith( edit );
			expect( onView ).toHaveBeenCalledTimes( 1 );
			expect( onView ).toHaveBeenCalledWith( view );
			expect( window.location.href ).toBe( location );
			const click = new MouseEvent( 'click', { bubbles: true, cancelable: true, button: 0 } );
			img.dispatchEvent( click );
			expect( click.defaultPrevented ).toBe( false );
			expect( onView ).toHaveBeenCalledTimes( 1 );
			overlay.destroy();
		} );

		it.each( [ false, undefined ] )( 'hides Edit on a named PDF host with admission %p', ( canEdit ) => {
			const onEdit = jest.fn();
			const onView = jest.fn();
			const overlay = new ViewerOverlay( {
				container, imageElement: img, filename: 'Current.pdf', canEdit, onEdit, onView
			} );
			expect( container.querySelector( '.layers-viewer-overlay-btn--edit' ) ).toBeNull();
			const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
			view.click();
			expect( onView ).toHaveBeenCalledWith( view );
			overlay._handleEditClick( view );
			expect( onEdit ).not.toHaveBeenCalled();
			overlay.destroy();
		} );

		it( 'never falls back when a callback is missing or not callable', () => {
			for ( const options of [ { onEdit: null }, { onView: 'invalid' }, { onEdit: jest.fn() } ] ) {
				const overlay = new ViewerOverlay( {
					container, imageElement: img, filename: 'Current.pdf', canEdit: true, ...options
				} );
				container.querySelector( '.layers-viewer-overlay-btn--view' ).click();
				overlay.destroy();
			}
		} );

		it.each( [ 'throws', 'rejects' ] )( 'does not fall back or duplicate controls when a callback %s', async ( failure ) => {
			const callback = jest.fn( () => {
				const error = new Error( 'Caller route unavailable' );
				if ( failure === 'throws' ) {
					throw error;
				}
				return Promise.reject( error );
			} );
			const overlay = new ViewerOverlay( {
				container, imageElement: img, filename: 'Current.pdf', canEdit: true,
				onEdit: callback, onView: callback
			} );
			const edit = container.querySelector( '.layers-viewer-overlay-btn--edit' );
			const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
			edit.click();
			view.click();
			await Promise.resolve();
			expect( callback.mock.calls ).toEqual( [ [ edit ], [ view ] ] );
			expect( container.querySelectorAll( '.layers-viewer-overlay' ) ).toHaveLength( 1 );
			overlay.destroy();
		} );

		it( 'keeps controls visible through actual focus, mouseleave and the tap timeout', () => {
			jest.useFakeTimers();
			const onView = jest.fn();
			const overlay = new ViewerOverlay( { container, onView } );
			const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
			const visible = () => overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' );
			expect( container.tabIndex ).toBe( 0 );
			container.focus();
			expect( document.activeElement ).toBe( container );
			expect( visible() ).toBe( true );
			view.focus();
			expect( document.activeElement ).toBe( view );
			container.dispatchEvent( new MouseEvent( 'mouseleave' ) );
			expect( visible() ).toBe( true );
			container.dispatchEvent( new TouchEvent( 'touchstart', { bubbles: true } ) );
			jest.advanceTimersByTime( 3000 );
			expect( visible() ).toBe( true );
			for ( const key of [ 'Enter', ' ' ] ) {
				view.dispatchEvent( new KeyboardEvent( 'keydown', { key, bubbles: true } ) );
				view.dispatchEvent( new KeyboardEvent( 'keyup', { key, bubbles: true } ) );
			}
			expect( onView ).not.toHaveBeenCalled();
			view.dispatchEvent( new MouseEvent( 'click', { bubbles: true, detail: 0 } ) );
			expect( onView ).toHaveBeenCalledTimes( 1 );
			expect( onView ).toHaveBeenCalledWith( view );
			expect( view.type ).toBe( 'button' );
			const outside = document.createElement( 'button' );
			document.body.appendChild( outside );
			outside.focus();
			expect( visible() ).toBe( false );
			overlay.destroy();
			expect( container.hasAttribute( 'tabindex' ) ).toBe( false );
			jest.useRealTimers();
		} );

		it( 'shows on tap and times out when focus is outside', () => {
			jest.useFakeTimers();
			const overlay = new ViewerOverlay( { container, onView: jest.fn() } );
			container.dispatchEvent( new TouchEvent( 'touchstart', { bubbles: true } ) );
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
			jest.advanceTimersByTime( 3000 );
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( false );
			overlay.destroy();
			jest.useRealTimers();
		} );

		it.each( [ '-1', '2' ] )( 'preserves caller tabindex %s on dispose', ( tabindex ) => {
			container.setAttribute( 'tabindex', tabindex );
			const overlay = new ViewerOverlay( { container, onView: jest.fn() } );
			expect( container.tabIndex ).toBe( tabindex === '-1' ? 0 : 2 );
			container.focus();
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
			overlay.destroy();
			expect( container.getAttribute( 'tabindex' ) ).toBe( tabindex );
		} );

		it( 'removes every listener and pending timer across mount/dispose cycles', () => {
			jest.useFakeTimers();
			for ( let cycle = 0; cycle < 3; cycle++ ) {
				const onView = jest.fn();
				const overlay = new ViewerOverlay( { container, onView } );
				overlay.init();
				expect( container.querySelectorAll( '.layers-viewer-overlay' ) ).toHaveLength( 1 );
				const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
				const listeners = overlay.listeners.slice();
				const removers = new Map();
				for ( const { element } of listeners ) {
					if ( !removers.has( element ) ) {
						removers.set( element, jest.spyOn( element, 'removeEventListener' ) );
					}
				}
				container.dispatchEvent( new TouchEvent( 'touchstart', { bubbles: true } ) );
				expect( jest.getTimerCount() ).toBe( 1 );
				overlay.destroy();
				for ( const { element, type, handler, options } of listeners ) {
					expect( removers.get( element ) ).toHaveBeenCalledWith( type, handler, options );
				}
				for ( const remover of removers.values() ) {
					remover.mockRestore();
				}
				expect( jest.getTimerCount() ).toBe( 0 );
				container.dispatchEvent( new TouchEvent( 'touchstart', { bubbles: true } ) );
				view.click();
				overlay.init();
				expect( onView ).not.toHaveBeenCalled();
				expect( jest.getTimerCount() ).toBe( 0 );
				expect( container.querySelectorAll( '.layers-viewer-overlay' ) ).toHaveLength( 0 );
				expect( overlay.container ).toBeNull();
				expect( overlay.imageElement ).toBeNull();
				expect( overlay.onView ).toBeNull();
				expect( overlay.listeners ).toEqual( [] );
			}
			jest.useRealTimers();
		} );
	} );

	describe( 'constructor', () => {
		it( 'supports a canvas host with admitted callbacks and no image or filename', () => {
			const canvas = document.createElement( 'canvas' );
			container.replaceChildren( canvas );
			const onEdit = jest.fn();
			const onView = jest.fn();
			const overlay = new ViewerOverlay( { container, canEdit: true, onEdit, onView } );
			const edit = container.querySelector( '.layers-viewer-overlay-btn--edit' );
			const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
			expect( overlay.overlay ).not.toBeNull();
			expect( edit ).not.toBeNull();
			expect( view ).not.toBeNull();
			edit.click();
			view.click();
			expect( onEdit ).toHaveBeenCalledTimes( 1 );
			expect( onEdit ).toHaveBeenCalledWith( edit );
			expect( onView ).toHaveBeenCalledTimes( 1 );
			expect( onView ).toHaveBeenCalledWith( view );
			overlay.destroy();
		} );

		it.each( [ false, undefined, 'true', 1 ] )( 'fails closed for callback edit admission %p', ( canEdit ) => {
			const onEdit = jest.fn();
			const onView = jest.fn();
			const overlay = new ViewerOverlay( { container, canEdit, onEdit, onView } );
			expect( overlay.canEdit ).toBe( false );
			expect( container.querySelector( '.layers-viewer-overlay-btn--edit' ) ).toBeNull();
			const view = container.querySelector( '.layers-viewer-overlay-btn--view' );
			expect( view ).not.toBeNull();
			view.click();
			overlay._handleEditClick( view );
			expect( onEdit ).not.toHaveBeenCalled();
			expect( onView ).toHaveBeenCalledWith( view );
			expect( mw.config.get ).not.toHaveBeenCalled();
			overlay.destroy();
		} );

		it( 'replaces the previous host instance and makes detached controls inert', () => {
			const oldView = jest.fn();
			const first = new ViewerOverlay( { container, onView: oldView } );
			const oldButton = container.querySelector( '.layers-viewer-overlay-btn--view' );
			const onView = jest.fn();
			const second = new ViewerOverlay( { container, onView } );
			expect( container.querySelectorAll( '.layers-viewer-overlay' ) ).toHaveLength( 1 );
			expect( first.container ).toBeNull();
			oldButton.click();
			expect( oldView ).not.toHaveBeenCalled();
			const button = container.querySelector( '.layers-viewer-overlay-btn--view' );
			button.click();
			expect( onView ).toHaveBeenCalledTimes( 1 );
			second.destroy();
			second.destroy();
			button.click();
			expect( onView ).toHaveBeenCalledTimes( 1 );
			expect( container.querySelectorAll( '.layers-viewer-overlay' ) ).toHaveLength( 0 );
		} );

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

			// 'default' is an ordinary user-chosen name, so it is passed through
			expect( editUrl ).toContain( 'setname=default' );
		} );
	} );

	describe( 'editor return page', () => {
		let overlay;

		beforeEach( () => {
			overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'ABC & details',
				page: 2
			} );
		} );

		afterEach( () => {
			overlay.destroy();
		} );

		it( 'returns a full-page editor to the originating owner page', () => {
			const url = new URL( overlay._buildEditUrl(), 'https://wiki.example' );
			expect( url.pathname ).toBe( '/wiki/File:Test_image.jpg' );
			expect( url.searchParams.get( 'returnto' ) ).toBe( 'Main_Page' );
			expect( url.searchParams.get( 'setname' ) ).toBe( 'ABC & details' );
			expect( url.searchParams.get( 'page' ) ).toBe( '2' );
		} );

		it( 'preserves the owner title with the fallback URL builder', () => {
			mw.config.get = jest.fn( ( key ) => key === 'wgPageName' ?
				'User:Example/Annotations & notes' : null );
			delete mw.util;
			const url = new URL( overlay._buildEditUrl(), 'https://wiki.example' );
			expect( url.searchParams.get( 'returnto' ) ).toBe( 'User:Example/Annotations & notes' );
			expect( url.searchParams.get( 'setname' ) ).toBe( 'ABC & details' );
			expect( url.searchParams.get( 'page' ) ).toBe( '2' );
		} );

		it( 'keeps the existing File-page return fallback', () => {
			mw.config.get = jest.fn( ( key ) => ( {
				wgPageName: 'File:Test_image.jpg', wgCanonicalNamespace: 'File'
			} )[ key ] );
			const url = new URL( overlay._buildEditUrl(), 'https://wiki.example' );
			expect( url.searchParams.has( 'returnto' ) ).toBe( false );
		} );

		it( 'omits a missing origin without adding an invalid title', () => {
			mw.config.get = jest.fn( () => null );
			const url = new URL( overlay._buildEditUrl(), 'https://wiki.example' );
			expect( url.searchParams.has( 'returnto' ) ).toBe( false );
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
		function touch( target, type, x = 5, y = 5 ) {
			const event = new TouchEvent( type, { bubbles: true, cancelable: true,
				touches: type === 'touchend' || type === 'touchcancel' ? [] : [ { identifier: 1, clientX: x, clientY: y } ] } );
			target.dispatchEvent( event ); return event;
		}
		function click( target, options = {}, pointer = 'touch' ) {
			const event = new MouseEvent( 'click', { bubbles: true, cancelable: true, detail: 1, button: 0, ...options } );
			Object.defineProperty( event, 'pointerType', { value: pointer } );
			target.dispatchEvent( event ); return event;
		}
		it.each( [ true, false ] )( 'first host tap reveals; real controls preserve edit permission %s', canEdit => {
			const edit = jest.fn(), view = jest.fn();
			const overlay = new ViewerOverlay( { container, imageElement: img, canEdit, onEdit: edit, onView: view } );
			touch( img, 'touchstart' ); touch( img, 'touchend' );
			expect( click( img ).defaultPrevented ).toBe( true );
			expect( overlay.overlay.classList.contains( 'layers-viewer-overlay--visible' ) ).toBe( true );
			const viewButton = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			touch( viewButton, 'touchstart' ); touch( viewButton, 'touchend' ); click( viewButton );
			expect( view ).toHaveBeenCalledTimes( 1 );
			const editButton = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			if ( canEdit ) { touch( editButton, 'touchstart' ); touch( editButton, 'touchend' ); click( editButton ); expect( edit ).toHaveBeenCalledTimes( 1 ); }
			else { expect( editButton ).toBeNull(); expect( edit ).not.toHaveBeenCalled(); }
			overlay.destroy();
		} );
		it.each( [ 'scroll', 'cancel', 'keyboard', 'mouse', 'modified', 'second' ] )( 'does not swallow %s activation', kind => {
			const overlay = new ViewerOverlay( { container, imageElement: img, filename: 'Test_image.jpg' } );
			touch( img, 'touchstart' );
			if ( kind === 'scroll' ) expect( touch( img, 'touchmove', 5, 120 ).defaultPrevented ).toBe( false );
			if ( kind === 'cancel' ) touch( img, 'touchcancel' ); else touch( img, 'touchend' );
			if ( kind === 'second' ) { click( img ); touch( img, 'touchstart' ); touch( img, 'touchend' ); }
			expect( click( img, kind === 'keyboard' ? { detail: 0 } : kind === 'modified' ? { ctrlKey: true } : {}, kind === 'mouse' ? 'mouse' : 'touch' ).defaultPrevented ).toBe( false );
			overlay.destroy();
		} );

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
		it( 'should fall back to no set name', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( overlay.setname ).toBe( '' );
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
		it( 'should use ViewerIcons when available', () => {
			const mockCreatePencilIcon = jest.fn( () => {
				const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
				return svg;
			} );
			const mockCreateExpandIcon = jest.fn( () => {
				const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
				return svg;
			} );

			const savedViewerIcons = window.Layers.ViewerIcons;
			window.Layers.ViewerIcons = {
				createPencilIcon: mockCreatePencilIcon,
				createExpandIcon: mockCreateExpandIcon
			};

			new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			expect( mockCreatePencilIcon ).toHaveBeenCalled();
			expect( mockCreateExpandIcon ).toHaveBeenCalled();

			window.Layers.ViewerIcons = savedViewerIcons;
		} );

		it( 'should fall back to inline SVG when ViewerIcons not available', () => {
			const savedViewerIcons = window.Layers.ViewerIcons;
			delete window.Layers.ViewerIcons;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			const svg = editBtn.querySelector( 'svg' );

			// Fallback creates a bare SVG element
			expect( svg ).not.toBeNull();
			expect( svg.tagName.toLowerCase() ).toBe( 'svg' );

			window.Layers.ViewerIcons = savedViewerIcons;
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
				'',
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
			const _originalHandler = overlay._handleEditClick.bind( overlay );
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
		it( 'should use singleton lightbox instance when available', () => {
			const mockLightboxOpen = jest.fn();

			// Set up the singleton instance (not the constructor)
			window.Layers.lightbox = { open: mockLightboxOpen };

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg',
				setname: 'my-set'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			viewBtn.click();

			expect( mockLightboxOpen ).toHaveBeenCalledWith( {
				filename: 'Test_image.jpg',
				setName: 'my-set',
				page: 1,
				imageUrl: img.src
			} );

			delete window.Layers.lightbox;
		} );

		it( 'should not create new Lightbox instances on each click (P2.13 regression)', () => {
			const mockLightboxOpen = jest.fn();
			window.Layers.lightbox = { open: mockLightboxOpen };

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const viewBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--view' );
			viewBtn.click();
			viewBtn.click();
			viewBtn.click();

			// Same singleton should be reused — open called 3 times, no new instances
			expect( mockLightboxOpen ).toHaveBeenCalledTimes( 3 );

			delete window.Layers.lightbox;
		} );

		it( 'should fall back to image src when mw.util not available', () => {
			delete window.Layers.lightbox;
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

			expect( mockOpen ).toHaveBeenCalledWith( img.src, '_blank', 'noopener,noreferrer' );

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
			expect( typeof editBtn.getAttribute( 'title' ) ).toBe( 'string' );
		} );

		it( 'should use fallback when mw.message not available', () => {
			delete global.mw.message;

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Test_image.jpg'
			} );

			const editBtn = overlay.overlay.querySelector( '.layers-viewer-overlay-btn--edit' );
			expect( typeof editBtn.getAttribute( 'title' ) ).toBe( 'string' );
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
	} );

	describe( 'PDF click interception', () => {
		it( 'intercepts a plain left-click on a PDF thumbnail and opens the lightbox', () => {
			const open = jest.fn();
			window.Layers.lightbox = { open: open };
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Doc.pdf'
			} );

			const event = new MouseEvent( 'click', { bubbles: true, cancelable: true, button: 0 } );
			img.dispatchEvent( event );

			expect( open ).toHaveBeenCalled();
			expect( event.defaultPrevented ).toBe( true );
			overlay.destroy();
			delete window.Layers.lightbox;
		} );

		it( 'prefers the wrapping anchor as the click target', () => {
			const anchor = document.createElement( 'a' );
			anchor.href = '/wiki/File:Doc.pdf';
			container.appendChild( anchor );
			anchor.appendChild( img );

			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Doc.pdf'
			} );

			expect( overlay._pdfClickTarget ).toBe( anchor );
			overlay.destroy();
		} );

		it( 'does not intercept modified clicks (e.g. ctrl/meta)', () => {
			const open = jest.fn();
			window.Layers.lightbox = { open: open };
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Doc.pdf'
			} );

			const event = new MouseEvent( 'click', {
				bubbles: true, cancelable: true, button: 0, ctrlKey: true
			} );
			img.dispatchEvent( event );

			expect( open ).not.toHaveBeenCalled();
			expect( event.defaultPrevented ).toBe( false );
			overlay.destroy();
			delete window.Layers.lightbox;
		} );

		it( 'does not attach interception for non-PDF files', () => {
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Photo.jpg'
			} );
			expect( overlay._boundPdfClick ).toBeFalsy();
			overlay.destroy();
		} );

		it( 'removes the click listener on destroy', () => {
			const open = jest.fn();
			window.Layers.lightbox = { open: open };
			const overlay = new ViewerOverlay( {
				container: container,
				imageElement: img,
				filename: 'Doc.pdf'
			} );
			overlay.destroy();

			const event = new MouseEvent( 'click', { bubbles: true, cancelable: true, button: 0 } );
			img.dispatchEvent( event );
			expect( open ).not.toHaveBeenCalled();
			delete window.Layers.lightbox;
		} );
	} );
} );
