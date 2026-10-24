/* eslint-env node */
/** PERF-0/PERF-2: repeatable image-to-layer paint timing without content writes. */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );

test.skip( !process.env.LAYERS_NATIVE_PERF_CONFIG,
	'Requires an explicit isolated native performance configuration' );

function observePaint( probe ) {
	performance.setResourceTimingBufferSize( 1000 );
	window.layersNativePaint = { imageLoaded: null, painted: null };
	document.addEventListener( 'load', ( event ) => {
		if ( event.target instanceof HTMLImageElement &&
			event.target.matches( 'img.layers-bound-file' ) &&
			window.layersNativePaint.imageLoaded === null ) {
			window.layersNativePaint.imageLoaded = performance.now();
		}
	}, true );
	const check = () => {
		const canvas = document.querySelector( '.layers-bound-file-view canvas' );
		if ( canvas && canvas.width > probe.x && canvas.height > probe.y ) {
			const pixel = canvas.getContext( '2d' ).getImageData( probe.x, probe.y, 1, 1 ).data;
			if ( probe.rgba.every( ( value, index ) => pixel[ index ] === value ) ) {
				window.layersNativePaint.painted = performance.now();
				return;
			}
		}
		if ( performance.now() < 30000 ) {
			requestAnimationFrame( check );
		}
	};
	requestAnimationFrame( check );
}

test( 'native reader: fresh-browser layer paint on an isolated warm server', async ( { browser }, testInfo ) => {
	test.setTimeout( 180000 );
	const configPath = process.env.LAYERS_NATIVE_PERF_CONFIG;
	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const base = new URL( config.base );
	expect( config.disposable ).toBe( true );
	expect( base.protocol ).toBe( 'http:' );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( base.hostname );
	expect( base.username + base.password + base.search + base.hash ).toBe( '' );
	expect( [ '', '80', '8080', '8081' ] ).not.toContain( base.port );
	expect( base.pathname ).toBe( '/' );
	expect( config.wikiId ).toEqual( expect.any( String ) );
	expect( config.owner ).toEqual( expect.any( String ) );
	expect( Number.isSafeInteger( config.revision ) && config.revision > 0 ).toBe( true );
	expect( Number.isSafeInteger( config.pageId ) && config.pageId > 0 ).toBe( true );
	expect( Number.isSafeInteger( config.probe.x ) && config.probe.x >= 0 ).toBe( true );
	expect( Number.isSafeInteger( config.probe.y ) && config.probe.y >= 0 ).toBe( true );
	expect( config.probe.rgba ).toHaveLength( 4 );
	expect( config.probe.rgba.every( n => Number.isInteger( n ) && n >= 0 && n <= 255 ) ).toBe( true );
	expect( config.probe.rgba[ 3 ] ).toBe( 255 );
	const samples = [], errors = [];
	// One recorded warm-up, followed by five fresh browser contexts with empty browser caches.
	// Supply a private authenticated storage state; no login credentials are logged or copied.
	try {
		for ( let index = 0; index < 6; index++ ) {
			const context = await browser.newContext( {
				storageState: config.storageState,
				viewport: { width: 1920, height: 1080 }
			} );
			try {
				// Every browser/API request in this measurement is read-only and stays on the fixture origin.
				await context.route( '**/*', ( route ) => {
					const request = route.request(), url = new URL( request.url() );
					if ( url.origin !== base.origin || request.method() !== 'GET' ) {
						errors.push( { method: request.method(), url: url.origin + url.pathname } );
						return route.abort();
					}
					return route.continue();
				} );
				const identity = await context.request.get( base.origin + '/api.php', {
					params: { action: 'query', meta: 'siteinfo', siprop: 'general', format: 'json', formatversion: 2 },
					maxRedirects: 0
				} );
				expect( ( await identity.json() ).query.general.wikiid ).toBe( config.wikiId );
				await context.addInitScript( observePaint, config.probe );
				const page = await context.newPage();
				page.on( 'pageerror', error => errors.push( { message: error.message } ) );
				await page.goto( base.origin + '/index.php?title=' + encodeURIComponent( config.owner ), {
					waitUntil: 'load'
				} );
				await page.waitForFunction( () => typeof window.layersNativePaint.painted === 'number', null, {
					timeout: 30000
				} );
				const sample = await page.evaluate( () => ( {
					...window.layersNativePaint,
					pageId: mw.config.get( 'wgArticleId' ),
					revision: mw.config.get( 'wgRevisionId' ),
					resources: performance.getEntriesByType( 'resource' ).map( r => ( {
						url: r.name, start: r.startTime, end: r.responseEnd, duration: r.duration
					} ) )
				} ) );
				expect( sample.pageId ).toBe( config.pageId );
				expect( sample.revision ).toBe( config.revision );
				expect( sample.imageLoaded ).toBeGreaterThan( 0 );
				expect( sample.painted ).toBeGreaterThanOrEqual( sample.imageLoaded );
				expect( sample.resources.some( r => new URL( r.url ).searchParams.get( 'action' ) === 'layersread' ) ).toBe( true );
				samples.push( { index, warmup: index === 0, ...sample,
					paintMs: Number( ( sample.painted - sample.imageLoaded ).toFixed( 2 ) ) } );
				await page.waitForLoadState( 'networkidle' );
			} finally {
				await context.close();
			}
		}
	} finally {
		// Retain all samples before evaluating the budget, including slow observations.
		await testInfo.attach( 'native-reader-performance', {
			body: Buffer.from( JSON.stringify( { browser: browser.version(), samples, errors }, null, 2 ) ),
			contentType: 'application/json'
		} );
	}
	expect( errors ).toEqual( [] );
	for ( const sample of samples.filter( row => !row.warmup ) ) {
		expect( sample.paintMs, `fresh-browser sample ${ sample.index }` ).toBeLessThanOrEqual( 300 );
	}
} );
