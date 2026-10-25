/** Approved viewer touch, non-drag pan and preserved PDF shortcuts. */
'use strict';

let box, controller, stage;
const point = ( x, y, identifier = 1 ) => ( { clientX: x, clientY: y, identifier } );
const rect = ( left, top, width, height ) => ( { left, top, width, height, right: left + width, bottom: top + height } );
const touch = ( type, points, cancelable = true ) => {
	const event = new Event( type, { bubbles: true, cancelable } );
	Object.defineProperty( event, 'touches', { value: points } );
	stage.dispatchEvent( event );
	return event;
};

beforeEach( () => {
	jest.resetModules();
	window.Layers = { Viewer: {} };
	window.mw = { message: () => ( { exists: () => false } ) };
	require( process.env.LAYERS_PAN_SOURCE || '../../resources/ext.layers/viewer/ViewerPanController.js' );
	const Lightbox = require( process.env.LAYERS_LIGHTBOX_SOURCE || '../../resources/ext.layers/viewer/LayersLightbox.js' );
	box = new Lightbox();
	box.zoom = 1;
	box.panX = box.panY = 0;
	box.pageCount = 2;
	box.currentPage = 1;
	box.createOverlay();
	box.isOpen = true;
	box.updateToolbar();
	stage = box.imageWrapper;
	box.overlay.getBoundingClientRect = () => rect( 0, 0, 390, 844 );
	box.toolbar.getBoundingClientRect = () => rect( 90, 56, 210, 154 );
	box.overlay.querySelector( '.layers-lightbox-close' ).getBoundingClientRect = () => rect( 346, 8, 36, 36 );
	stage.getBoundingClientRect = () => rect( 195 - 187 * box.zoom + box.panX,
		450 - 375 * box.zoom + box.panY, 374 * box.zoom, 750 * box.zoom );
	controller = box.panController;
	if ( controller ) {
		controller.strip.getBoundingClientRect = () => rect( 60, 770, 270, 58 );
	}
} );

afterEach( () => {
	box.close( true );
	document.body.innerHTML = '';
} );

test( 'native viewer constructs named direction buttons only above 100 percent', () => {
	expect( controller ).toBeTruthy();
	expect( controller.strip.hidden ).toBe( true );
	expect( Object.values( controller.buttons ).every( b => b.disabled ) ).toBe( true );
	box.setZoom( 2 );
	expect( controller.strip.hidden ).toBe( false );
	expect( controller.strip.getAttribute( 'aria-label' ) ).toBe( 'Pan' );
	expect( Object.values( controller.buttons ).map( b => b.getAttribute( 'aria-label' ) ) )
		.toEqual( [ 'Pan left', 'Pan up', 'Pan down', 'Pan right' ] );
} );

test( 'a stationary tap and small jitter keep default browser behavior', () => {
	box.setZoom( 2 );
	expect( touch( 'touchstart', [ point( 120, 300 ) ] ).defaultPrevented ).toBe( false );
	expect( touch( 'touchmove', [ point( 122, 302 ) ] ).defaultPrevented ).toBe( false );
	touch( 'touchend', [] );
	expect( [ box.panX, box.panY ] ).toEqual( [ 0, 0 ] );
} );

test( 'decorative arrow icons keep their own geometry and accessible names', () => {
	for ( const button of Object.values( controller.buttons ) ) {
		const icon = button.querySelector( 'svg' );
		expect( icon.getAttribute( 'viewBox' ) ).toBe( '0 0 24 24' );
		expect( icon.getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( icon.querySelector( 'path' ).getAttribute( 'd' ) ).toBeTruthy();
		expect( button.getAttribute( 'aria-label' ) ).toMatch( /^Pan / );
	}
} );

test( 'one finger translates enlarged media exactly like the mouse', () => {
	box.setZoom( 1.25 );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	expect( touch( 'touchmove', [ point( 160, 340 ) ] ).defaultPrevented ).toBe( true );
	expect( [ box.panX, box.panY ] ).toEqual( [ 60, 40 ] );
	expect( stage.style.transform ).toBe( 'translate(60px, 40px) scale(1.25)' );
		touch( 'touchmove', [ point( 102, 302 ) ] );
		expect( [ box.panX, box.panY ] ).toEqual( [ 2, 2 ] );
		touch( 'touchmove', [ point( 160, 340 ) ] );
	touch( 'touchend', [] );
	touch( 'touchmove', [ point( 220, 380 ) ] );
	expect( [ box.panX, box.panY ] ).toEqual( [ 60, 40 ] );
} );

test.each( [ 0.5, 1 ] )( 'touch at zoom %s is left to the browser', zoom => {
	box.setZoom( zoom );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	expect( touch( 'touchmove', [ point( 160, 340 ) ] ).defaultPrevented ).toBe( false );
	expect( [ box.panX, box.panY ] ).toEqual( [ 0, 0 ] );
} );

test( 'multiple fingers cancel pan without cancelling browser pinch; no single-finger resumption', () => {
	box.setZoom( 2 );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	touch( 'touchmove', [ point( 130, 320 ) ] );
	expect( touch( 'touchstart', [ point( 130, 320 ), point( 250, 320, 2 ) ] ).defaultPrevented ).toBe( false );
	expect( touch( 'touchmove', [ point( 90, 320 ), point( 290, 320, 2 ) ] ).defaultPrevented ).toBe( false );
	touch( 'touchend', [ point( 90, 320 ) ] );
	touch( 'touchmove', [ point( 160, 380 ) ] );
	expect( [ box.panX, box.panY ] ).toEqual( [ 30, 20 ] );
	touch( 'touchend', [] );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	touch( 'touchmove', [ point( 110, 310 ) ] );
	expect( [ box.panX, box.panY ] ).toEqual( [ 40, 30 ] );
} );

test.each( [ 'touchcancel', 'resize', 'reset' ] )( '%s clears an unfinished touch', action => {
	box.setZoom( 2 );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	if ( action === 'touchcancel' ) {
		touch( 'touchcancel', [] );
	} else if ( action === 'resize' ) {
		window.dispatchEvent( new Event( 'resize' ) );
	} else {
		box.resetZoom();
		box.setZoom( 2 );
	}
	touch( 'touchmove', [ point( 160, 340 ) ] );
	expect( [ box.panX, box.panY ] ).toEqual( [ 0, 0 ] );
} );

test( 'a browser-owned non-cancelable move is refused', () => {
	box.setZoom( 2 );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	touch( 'touchmove', [ point( 160, 340 ) ], false );
	expect( [ box.panX, box.panY ] ).toEqual( [ 0, 0 ] );
} );

test( 'a replaced touch identifier cannot move the media', () => {
	box.setZoom( 2 );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	touch( 'touchmove', [ point( 160, 340, 2 ) ] );
	expect( [ box.panX, box.panY ] ).toEqual( [ 0, 0 ] );
} );

test.each( [ [ 'left', 1, 0 ], [ 'right', -1, 0 ], [ 'up', 0, 1 ], [ 'down', 0, -1 ] ] )(
	'%s reveals content in its named direction and reaches the media edge', ( direction, dx, dy ) => {
		box.setZoom( 2 );
		controller.buttons[ direction ].click();
		if ( dx ) {
			expect( box.panX ).toBeCloseTo( dx * 358 / 5 );
		} else {
			expect( box.panY ).toBeCloseTo( dy * 536 / 5 );
		}
		for ( let i = 0; i < 30; i++ ) {
			controller.buttons[ direction ].click();
		}
		expect( controller.buttons[ direction ].disabled ).toBe( true );
		const bounds = controller.bounds();
		expect( box.panX ).toBeGreaterThanOrEqual( bounds.x[ 0 ] );
		expect( box.panX ).toBeLessThanOrEqual( bounds.x[ 1 ] );
		expect( box.panY ).toBeGreaterThanOrEqual( bounds.y[ 0 ] );
		expect( box.panY ).toBeLessThanOrEqual( bounds.y[ 1 ] );
	} );

test( 'directions that cannot reveal more media are disabled', () => {
	stage.getBoundingClientRect = () => rect( 140, 350, 100, 100 );
	box.setZoom( 1.25 );
	expect( Object.values( controller.buttons ).every( b => b.disabled ) ).toBe( true );
} );

test( 'Shift+arrows pan; unmodified PDF arrows still change the page', () => {
	box.setZoom( 2 );
	box.goToPage = jest.fn();
	document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'ArrowLeft', shiftKey: true, cancelable: true } ) );
	expect( box.panX ).toBeGreaterThan( 0 );
	expect( box.goToPage ).not.toHaveBeenCalled();
	document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'ArrowRight' } ) );
	expect( box.goToPage ).toHaveBeenCalledWith( 2 );
} );

test( 'hiding focused Pan controls returns focus to zoom; showing them does not steal focus', () => {
	box.zoomIndicator.focus();
	box.setZoom( 2 );
	expect( document.activeElement ).toBe( box.zoomIndicator );
	controller.buttons.left.focus();
	box.resetZoom();
	expect( document.activeElement ).toBe( box.zoomIndicator );
	expect( controller.strip.hidden ).toBe( true );
} );

test( 'PDF navigation resets touch and hides Pan before loading the next page', () => {
	box.setZoom( 2 );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	box.fetchAndRender = jest.fn();
	box.goToPage( 2 );
	touch( 'touchmove', [ point( 160, 340 ) ] );
	expect( [ box.zoom, box.panX, box.panY ] ).toEqual( [ 1, 0, 0 ] );
	expect( controller.strip.hidden ).toBe( true );
} );

test( 'native browser Ctrl+wheel magnification is not prevented', () => {
	const event = new WheelEvent( 'wheel', { ctrlKey: true, deltaY: -100, cancelable: true } );
	box.overlay.dispatchEvent( event );
	expect( event.defaultPrevented ).toBe( false );
	expect( box.zoom ).toBe( 1 );
} );

test( 'close removes touch/resize listeners; a fresh view gets one Pan strip', () => {
	box.setZoom( 2 );
	touch( 'touchstart', [ point( 100, 300 ) ] );
	box.close( true );
	touch( 'touchmove', [ point( 160, 340 ) ] );
	window.dispatchEvent( new Event( 'resize' ) );
	expect( controller.lightbox ).toBeNull();
	expect( [ box.panX, box.panY ] ).toEqual( [ 0, 0 ] );
	box.zoom = 1;
	box.createOverlay();
	box.isOpen = true;
	expect( document.querySelectorAll( '.layers-lightbox-pan' ) ).toHaveLength( 1 );
	expect( box.panController.strip.hidden ).toBe( true );
} );
