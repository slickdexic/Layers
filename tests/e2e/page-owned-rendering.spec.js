/* eslint-env node */
/**
 * Real ResourceLoader/canvas checks against an installed wiki. No pilot enablement,
 * authentication or database writes. These do not replace editor/save acceptance.
 */
const { test, expect } = require( '@playwright/test' );

test.beforeEach( async ( { page } ) => {
	await page.goto( '/index.php?title=Special:Version' );
	await page.waitForFunction( () => window.mw && mw.loader );
	await page.evaluate( () => mw.loader.using( 'ext.layers.history' ) );
} );

test( 'historical canvas preserves overlap order, coordinates and zero opacity', async ( { page } ) => {
	const result = await page.evaluate( async () => {
		const surface = {
			id: 'drawing', kind: 'slide', canvas: { width: 800, height: 600 },
			layers: [
				{ id: 'transparent', type: 'rectangle', x: 20, y: 20, width: 100, height: 100,
					fill: '#00ff00', stroke: 'none', opacity: 0 },
				{ id: 'front', type: 'rectangle', x: 60, y: 60, width: 100, height: 100,
					fill: '#ff0000', stroke: 'none' },
				{ id: 'back', type: 'rectangle', x: 20, y: 20, width: 100, height: 100,
					fill: '#0000ff', stroke: 'none' }
			]
		};
		const before = JSON.stringify( surface );
		const host = document.createElement( 'div' );
		host.id = 'acceptance-history';
		document.body.appendChild( host );
		const view = new window.Layers.Viewer.PageOwnedRevisionView( {
			bundle: { owner: 'Browser acceptance', revisionId: 1, surface },
			adapter: new window.Layers.Editor.PageOwnedSnapshotAdapter(),
			message: ( ...args ) => mw.msg( ...args ),
			render: ( canvas, selected, fail ) => window.Layers.Viewer.renderPageOwnedRevision(
				canvas, selected, fail, window.Layers.LayerRenderer, document.fonts )
		} );
		view.mount( host );
		await document.fonts.ready;
		const canvas = host.querySelector( 'canvas' );
		if ( !canvas ) {
			throw new Error( host.textContent );
		}
		const ctx = canvas.getContext( '2d' );
		const sample = ( x, y ) => Array.from( ctx.getImageData( x, y, 1, 1 ).data );
		return { blue: sample( 40, 40 ), red: sample( 80, 80 ), white: sample( 170, 170 ),
			width: canvas.width, height: canvas.height, unchanged: JSON.stringify( surface ) === before };
	} );
	expect( result ).toEqual( { blue: [ 0, 0, 255, 255 ], red: [ 255, 0, 0, 255 ],
		white: [ 255, 255, 255, 255 ], width: 800, height: 600, unchanged: true } );
} );

test( 'actual text, textbox and callout painters produce visible content', async ( { page } ) => {
	const results = await page.evaluate( async () => {
		await document.fonts.ready;
		return [ 'text', 'textbox', 'callout' ].map( ( type ) => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = 400;
			canvas.height = 200;
			let failed = false;
			const dispose = window.Layers.Viewer.renderPageOwnedRevision( canvas, {
				id: type, kind: 'slide', canvas: { width: 400, height: 200, backgroundVisible: false },
				layers: [ { id: type, type, x: 30, y: 50, width: 250, height: 100,
					text: 'Historical text', fontSize: 24, fontFamily: 'sans-serif',
					color: '#000000', fill: 'none', stroke: 'none', textColor: '#000000' } ]
			}, () => { failed = true; }, window.Layers.LayerRenderer );
			const pixels = canvas.getContext( '2d' ).getImageData( 0, 0, 400, 200 ).data;
			let ink = 0;
			for ( let index = 3; index < pixels.length; index += 4 ) {
				if ( pixels[ index ] > 0 ) {
					ink++;
				}
			}
			dispose();
			return { type, failed, ink };
		} );
	} );
	for ( const result of results ) {
		expect( result.failed, result.type ).toBe( false );
		expect( result.ink, result.type ).toBeGreaterThan( 100 );
	}
} );

test( 'image surface paints its source rendition under the layers and hides it with the background', async ( { page } ) => {
	const result = await page.evaluate( async () => {
		const paint = ( backgroundVisible ) => new Promise( ( resolve ) => {
			const canvas = document.createElement( 'canvas' );
			canvas.width = 270;
			canvas.height = 270;
			const ctx = canvas.getContext( '2d' );
			const surface = { id: 'photo', kind: 'image', canvas: { width: 270, height: 270, backgroundVisible,
				backgroundOpacity: 1 }, layers: [ { id: 'box', type: 'rectangle', x: 200, y: 200, width: 60,
				height: 60, fill: '#ff0000', stroke: 'none' } ] };
			let failed = false;
			window.Layers.Viewer.renderPageOwnedRevision( canvas, surface, () => {
				failed = true;
			}, window.Layers.LayerRenderer, null, { url: new URL( '/resources/assets/mediawiki.png',
				location.href ).href } );
			const done = () => {
				const box = Array.from( ctx.getImageData( 230, 230, 1, 1 ).data );
				const pixels = ctx.getImageData( 0, 0, 190, 190 ).data;
				let ink = 0;
				for ( let index = 3; index < pixels.length; index += 4 ) {
					ink += pixels[ index ] > 0 ? 1 : 0;
				}
				resolve( { failed, box, ink } );
			};
			// Layers are painted in the rendition's load handler; wait until they appear.
			const probe = () => requestAnimationFrame( failed || ctx.getImageData( 230, 230, 1, 1 ).data[ 3 ] ?
				done : probe );
			probe();
		} );
		return { shown: await paint( true ), hidden: await paint( false ) };
	} );
	expect( result.shown.failed ).toBe( false );
	expect( result.shown.box ).toEqual( [ 255, 0, 0, 255 ] );
	expect( result.shown.ink ).toBeGreaterThan( 1000 );
	expect( result.hidden.box ).toEqual( [ 255, 0, 0, 255 ] );
	expect( result.hidden.ink ).toBe( 0 );
} );

test( 'history module does not start or load the editable UI', async ( { page } ) => {
	expect( await page.evaluate( () => mw.loader.getState( 'ext.layers.history' ) ) ).toBe( 'ready' );
	expect( await page.evaluate( () => mw.loader.getState( 'ext.layers.editor' ) ) ).toBe( 'registered' );
	expect( await page.evaluate( () => mw.loader.getState( 'ext.layers.editor.pageOwned' ) ) ).toBe( 'registered' );
	await expect( page.locator( '.layers-editor-container' ) ).toHaveCount( 0 );
} );
