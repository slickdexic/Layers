/** Approved bounded toolbar: scroll/focus admission and measured Fit. */
'use strict';

let box, controller, Resize;
const rect = ( left, top, width, height ) => ( { left, top, width, height, right: left + width, bottom: top + height } );
function media( width, height ) {
	Object.defineProperties( box.imageWrapper, {
		offsetWidth: { configurable: true, value: width },
		offsetHeight: { configurable: true, value: height }
	} );
	box.imageWrapper.getBoundingClientRect = () => rect( 195 + box.panX - width * box.zoom / 2,
		468 + box.panY - height * box.zoom / 2, width * box.zoom, height * box.zoom );
}
function overflow( height = 250 ) {
	Object.defineProperties( box.toolbar, {
		scrollHeight: { configurable: true, value: height },
		clientHeight: { configurable: true, value: 96 }
	} );
	controller.update();
}

beforeEach( () => {
	jest.resetModules();
	window.Layers = { Viewer: {} };
	window.mw = { message: () => ( { exists: () => false } ) };
	Resize = global.ResizeObserver;
	global.ResizeObserver = class {
		constructor( callback ) { this.callback = callback; }
		observe = jest.fn();
		disconnect = jest.fn();
	};
	require( '../../resources/ext.layers/viewer/ViewerPanController.js' );
	require( process.env.LAYERS_TOOLBAR_SOURCE || '../../resources/ext.layers/viewer/ViewerToolbarController.js' );
	const Lightbox = require( process.env.LAYERS_LIGHTBOX_SOURCE || '../../resources/ext.layers/viewer/LayersLightbox.js' );
	box = new Lightbox();
	Object.assign( box, { zoom: 1, panX: 0, panY: 0, currentPage: 1, pageCount: 2 } );
	box.createOverlay();
	box.isOpen = true;
	controller = box.toolbarController;
	box.overlay.getBoundingClientRect = () => rect( 0, 0, 390, 844 );
	box.toolbar.getBoundingClientRect = () => rect( 8, 56, 374, 96 );
	box.overlay.querySelector( '.layers-lightbox-close' ).getBoundingClientRect = () => rect( 346, 8, 36, 36 );
	box.panController.strip.getBoundingClientRect = () => rect( 60, 770, 270, 58 );
	media( 374, 250 );
	box.updateToolbar();
} );

afterEach( () => {
	box.close( true );
	global.ResizeObserver = Resize;
	document.body.innerHTML = '';
} );

test( 'keeps original PDF controls together without replacing their nodes or actions', () => {
	expect( controller.pages.children ).toHaveLength( 3 );
	expect( [ ...controller.pages.children ] ).toEqual( [ box.prevBtn, box.pageIndicator, box.nextBtn ] );
	box.goToPage = jest.fn();
	box.nextBtn.click();
	expect( box.goToPage ).toHaveBeenCalledWith( 2 );
	box.pageCount = 1;
	box.updateToolbar();
	expect( controller.pages.hidden ).toBe( true );
} );

test( 'shows only relevant overflow cues and hides them when everything fits', () => {
	overflow();
	expect( controller.cues.map( c => c.hidden ) ).toEqual( [ true, false ] );
	box.toolbar.scrollTop = 80;
	box.toolbar.dispatchEvent( new Event( 'scroll' ) );
	expect( controller.cues.map( c => c.hidden ) ).toEqual( [ false, false ] );
	box.toolbar.scrollTop = 154;
	controller.update();
	expect( controller.cues.map( c => c.hidden ) ).toEqual( [ false, true ] );
	overflow( 96 );
	expect( controller.cues.every( c => c.hidden ) ).toBe( true );
	expect( controller.cues.every( c => c.getAttribute( 'aria-hidden' ) === 'true' && c.tabIndex === -1 ) ).toBe( true );
} );

test( 'keyboard focus brings a hidden lower action into the scroll region', () => {
	overflow();
	box.downloadBtn.getBoundingClientRect = () => rect( 30, 156 - box.toolbar.scrollTop, 150, 32 );
	box.downloadBtn.focus();
	expect( box.toolbar.scrollTop ).toBe( 40 );
	expect( document.activeElement ).toBe( box.downloadBtn );
} );

test( 'focus reveals an upper action without moving focus elsewhere', () => {
	overflow();
	box.toolbar.scrollTop = 100;
	box.zoomOutBtn.getBoundingClientRect = () => rect( 30, 60 - box.toolbar.scrollTop, 32, 32 );
	box.zoomOutBtn.focus();
	expect( box.toolbar.scrollTop ).toBe( 0 );
	expect( document.activeElement ).toBe( box.zoomOutBtn );
} );

test( 'wheel over the toolbar is available for native scrolling instead of media zoom', () => {
	const zoom = jest.spyOn( box, 'zoomBy' );
	const event = new WheelEvent( 'wheel', { deltaY: 100, bubbles: true, cancelable: true } );
	box.printBtn.dispatchEvent( event );
	expect( event.defaultPrevented ).toBe( false );
	expect( zoom ).not.toHaveBeenCalled();
} );

test( 'wheel over media retains zoom and native Ctrl+wheel remains unclaimed', () => {
	const zoom = jest.spyOn( box, 'zoomBy' );
	box.imageWrapper.dispatchEvent( new WheelEvent( 'wheel', { deltaY: -100, bubbles: true, cancelable: true } ) );
	expect( zoom ).toHaveBeenCalledWith( 1.1 );
	const browserZoom = new WheelEvent( 'wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true } );
	box.toolbar.dispatchEvent( browserZoom );
	expect( browserZoom.defaultPrevented ).toBe( false );
	expect( zoom ).toHaveBeenCalledTimes( 1 );
} );

test( 'Fit uses the measured toolbar bottom and centers a portrait below it', () => {
	media( 200, 720 );
	box.fitToScreen();
	const r = box.imageWrapper.getBoundingClientRect();
	expect( r.top ).toBeCloseTo( 164 );
	expect( r.bottom ).toBeCloseTo( 828 );
	expect( box.zoom ).toBeCloseTo( 664 / 720 );
	expect( box.panController.strip.hidden ).toBe( true );
} );

test( 'Fit reserves Pan only when its final zoom needs the strip', () => {
	media( 100, 500 );
	box.fitToScreen();
	const r = box.imageWrapper.getBoundingClientRect();
	expect( r.top ).toBeCloseTo( 164 );
	expect( r.bottom ).toBeCloseTo( 758 );
	expect( box.panController.strip.hidden ).toBe( false );
	expect( box.zoom ).toBeCloseTo( 594 / 500 );
} );

test( 'Fit avoids oscillation when adding the strip would force zoom below 100 percent', () => {
	media( 100, 600 );
	box.fitToScreen();
	expect( box.zoom ).toBe( 1 );
	expect( box.panController.strip.hidden ).toBe( true );
	expect( box.imageWrapper.getBoundingClientRect().height ).toBe( 600 );
} );

test.each( [ 'missing media', 'no available height' ] )( 'Fit preserves the view for %s', reason => {
	box.panX = 20;
	if ( reason === 'missing media' ) {
		media( 0, 0 );
	} else {
		box.overlay.getBoundingClientRect = () => rect( 0, 0, 390, 100 );
	}
	box.fitToScreen();
	expect( [ box.zoom, box.panX, box.panY ] ).toEqual( [ 1, 20, 0 ] );
} );

test( 'resize and changed toolbar labels refresh the cues', async () => {
	overflow( 96 );
	Object.defineProperty( box.toolbar, 'scrollHeight', { configurable: true, value: 250 } );
	controller.resizeObserver.callback();
	expect( controller.cues[ 1 ].hidden ).toBe( false );
	overflow( 96 );
	Object.defineProperty( box.toolbar, 'scrollHeight', { configurable: true, value: 250 } );
	box.printBtn.textContent = 'Preparing pages';
	await Promise.resolve();
	expect( controller.cues[ 1 ].hidden ).toBe( false );
} );

test( 'teardown disconnects observers, removes cues and ignores late callbacks', () => {
	const resize = controller.resizeObserver;
	const observer = jest.spyOn( controller.mutationObserver, 'disconnect' );
	box.close( true );
	expect( resize.disconnect ).toHaveBeenCalledTimes( 1 );
	expect( observer ).toHaveBeenCalledTimes( 1 );
	expect( document.querySelectorAll( '.layers-lightbox-toolbar-cue' ) ).toHaveLength( 0 );
	expect( () => resize.callback() ).not.toThrow();
	expect( controller.lightbox ).toBeNull();
} );
