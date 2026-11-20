/* eslint-env node */
'use strict';
const { expect } = require( '@playwright/test' );
const { test, getAcceptanceConfig, LayersEditorPage } = require( './fixtures' );
const guardReads = require( '../perf/native-request-guard' );

const owner = process.env.LAYERS_VIEWPORT_OWNER, surface = process.env.LAYERS_VIEWPORT_SURFACE;
test.skip( !getAcceptanceConfig() || !owner || !surface, 'Requires an explicit synthetic viewport fixture' );

async function open( page, context ) {
	const base = new URL( getAcceptanceConfig().base ).origin;
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( new URL( base ).hostname );
	expect( owner ).toMatch( /^Layers[_ ]/ );
	const errors = [];
	await guardReads( page, base, errors );
	page.on( 'pageerror', error => errors.push( { message: error.message } ) );
	const saved = async () => {
		const response = await context.request.get( base + '/api.php', { params: {
			action: 'query', titles: owner, prop: 'revisions', rvprop: 'ids|content', rvslots: '*',
			format: 'json', formatversion: 2
		} } );
		const result = await response.json(); expect( result.error ).toBeUndefined();
		return result.query.pages[ 0 ].revisions[ 0 ];
	};
	const before = await saved();
	await page.goto( base + '/index.php?title=Special:EditLayersPage&owner=' + encodeURIComponent( owner ) +
		'&surface=' + encodeURIComponent( surface ) + '&revid=current' );
	await page.getByRole( 'button', { name: 'Check saved page', exact: true } ).waitFor( { timeout: 90000 } );
	await page.waitForFunction( () => window.layersEditorInstance?.canvasManager?.zoomPanController?.resizeCanvas );
	const targetPage = Number( process.env.LAYERS_VIEWPORT_PDF_PAGE || 1 );
	expect( Number.isSafeInteger( targetPage ) && targetPage > 0 && targetPage <= 100 ).toBe( true );
	for ( let index = 1; index < targetPage; index++ ) {
		await page.locator( '.page-next-button' ).click();
		await page.waitForFunction( expected => window.layersEditorInstance.page === expected &&
			!window.layersEditorInstance.stateManager.get( 'isLoading' ), index + 1 );
	}
	await settled( page );
	return { errors, saved, before };
}

async function settled( page ) {
	await page.waitForFunction( () => !window.layersEditorInstance.canvasManager.zoomPanController.isAnimatingZoom );
	await page.evaluate( () => new Promise( resolve => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );
}

async function view( page ) {
	return page.evaluate( () => {
		const editor = window.layersEditorInstance, cm = editor.canvasManager;
		const rect = cm.canvas.getBoundingClientRect(), v = cm.zoomPanController.viewport();
		return { rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
			v, zoom: cm.zoom, panX: cm.panX, panY: cm.panY,
			point: cm.getMousePointFromClient( v.x, v.y ), layers: JSON.stringify( editor.layers ),
			canUndo: editor.historyManager.canUndo(), canRedo: editor.historyManager.canRedo(),
			dirty: editor.hasUnsavedChanges() };
	} );
}

function fitted( state ) {
	expect( state.rect.x ).toBeGreaterThanOrEqual( state.v.left - 1 );
	expect( state.rect.y ).toBeGreaterThanOrEqual( state.v.top - 1 );
	expect( state.rect.x + state.rect.width ).toBeLessThanOrEqual( state.v.left + state.v.width + 1 );
	expect( state.rect.y + state.rect.height ).toBeLessThanOrEqual( state.v.top + state.v.height + 1 );
	expect( state.rect.x + state.rect.width / 2 ).toBeCloseTo( state.v.x, 0 );
	expect( state.rect.y + state.rect.height / 2 ).toBeCloseTo( state.v.y, 0 );
}

test.describe( 'tablet viewport and touch', () => {
	test.use( { viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true,
		userAgent: 'Mozilla/5.0 (Linux; Android 10; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' } );
	test( 'fit, centred zoom, pan/pinch and subsequent one-finger edits retain saved content',
		async ( { loggedInPage: page, context }, testInfo ) => {
			test.setTimeout( 180000 );
			const check = await open( page, context ), initial = await view( page ); fitted( initial );
			await page.locator( '[data-action="zoom-in"]' ).click(); await settled( page );
			const zoomed = await view( page );
			expect( zoomed.point.x ).toBeCloseTo( initial.point.x, 0 );
			expect( zoomed.point.y ).toBeCloseTo( initial.point.y, 0 );
			const cdp = await context.newCDPSession( page );
			const touch = ( type, points ) => cdp.send( 'Input.dispatchTouchEvent', { type,
				touchPoints: points.map( ( p, id ) => ( { x: p.x, y: p.y, id, radiusX: 4, radiusY: 4 } ) ) } );
			const v = zoomed.v;
			await touch( 'touchStart', [ { x: v.x - 40, y: v.y }, { x: v.x + 40, y: v.y } ] );
			await touch( 'touchMove', [ { x: v.x - 10, y: v.y - 20 }, { x: v.x + 70, y: v.y - 20 } ] );
			const panned = await view( page );
			expect( panned.panX - zoomed.panX ).toBeCloseTo( 30, 0 );
			expect( panned.panY - zoomed.panY ).toBeCloseTo( -20, 0 );
			await touch( 'touchMove', [ { x: v.x - 50, y: v.y - 20 }, { x: v.x + 110, y: v.y - 20 } ] );
			expect( ( await view( page ) ).zoom ).toBeCloseTo( zoomed.zoom * 2, 1 );
			await touch( 'touchEnd', [] );
			await page.locator( '[data-action="fit-window"]' ).click(); await settled( page );
			const navigated = await view( page ); fitted( navigated );
			for ( const key of [ 'layers', 'canUndo', 'canRedo', 'dirty' ] ) {
				expect( navigated[ key ], key ).toEqual( initial[ key ] );
			}
			await page.screenshot( { path: testInfo.outputPath( 'tablet-fit.png' ) } );
			const editor = new LayersEditorPage( page ); await editor.selectTool( 'rectangle' );
			const r = navigated.rect, a = { x: r.x + r.width * 0.2, y: r.y + r.height * 0.2 },
				b = { x: r.x + r.width * 0.4, y: r.y + r.height * 0.4 };
			await touch( 'touchStart', [ a ] ); await touch( 'touchMove', [ b ] ); await touch( 'touchEnd', [] );
			await expect.poll( async () => ( await view( page ) ).layers ).not.toBe( initial.layers );
			await page.keyboard.press( 'Control+z' );
			await expect.poll( async () => ( await view( page ) ).layers ).toBe( initial.layers );
			await page.keyboard.press( 'Control+y' );
			await expect.poll( async () => ( await view( page ) ).layers ).not.toBe( initial.layers );
			await page.keyboard.press( 'Control+z' );
			await expect.poll( async () => ( await view( page ) ).layers ).toBe( initial.layers );
			expect( await check.saved() ).toEqual( check.before ); expect( check.errors ).toEqual( [] );
		} );
} );

test.describe( 'desktop viewport navigation', () => {
	test.use( { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false } );
	test( 'mouse wheel, Space-drag and resizing preserve content and its viewport anchor',
		async ( { loggedInPage: page, context }, testInfo ) => {
			test.setTimeout( 180000 );
			const check = await open( page, context ), initial = await view( page ); fitted( initial );
			await page.mouse.move( initial.v.x, initial.v.y ); await page.mouse.wheel( 0, -100 );
			await expect.poll( async () => ( await view( page ) ).zoom ).toBeGreaterThan( initial.zoom );
			const zoomed = await view( page );
			expect( zoomed.point.x ).toBeCloseTo( initial.point.x, 0 );
			expect( zoomed.point.y ).toBeCloseTo( initial.point.y, 0 );
			await page.locator( '.layers-canvas-container' ).focus();
			await page.keyboard.down( 'Space' ); await page.mouse.down();
			await page.mouse.move( initial.v.x + 30, initial.v.y - 20, { steps: 5 } );
			await page.mouse.up(); await page.keyboard.up( 'Space' );
			const panned = await view( page );
			expect( panned.panX - zoomed.panX ).toBeCloseTo( 30, 0 );
			expect( panned.panY - zoomed.panY ).toBeCloseTo( -20, 0 );
			await page.setViewportSize( { width: 1100, height: 800 } ); await settled( page );
			const resized = await view( page );
			expect( resized.zoom ).toBeCloseTo( panned.zoom, 5 );
			expect( resized.point.x ).toBeCloseTo( panned.point.x, 0 );
			expect( resized.point.y ).toBeCloseTo( panned.point.y, 0 );
			for ( const key of [ 'layers', 'canUndo', 'canRedo', 'dirty' ] ) {
				expect( resized[ key ], key ).toEqual( initial[ key ] );
			}
			await page.screenshot( { path: testInfo.outputPath( 'desktop-resized.png' ) } );
			expect( await check.saved() ).toEqual( check.before ); expect( check.errors ).toEqual( [] );
		} );
} );
