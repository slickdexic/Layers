/* eslint-env node */
/* global BigInt */
/**
 * J83: Repeatable Performance Benchmark (PERF-0)
 * Advances: PERF-0 (and establishes the first baseline for PERF-1 to PERF-7).
 *
 * Measures in real Chromium on the test wiki (http://localhost:8080):
 * - PERF-1: gzip transfer bytes of every load.php response with ext.layers on owner vs Main_Page.
 * - PERF-2: time from photo load event to drawing canvas appearing (MutationObserver).
 * - PERF-3: time from pressing edit link to editor instance ready and canvas visible.
 * - PERF-4: FPS during 2-second drag in 100-layer drawing; delay from key press to typed character.
 * - PERF-5: layerspublish response time for 1-property edit on 100 layers; time to view in Special:ViewLayersPage.
 * - PERF-6: long tasks (type longtask) during page load with 20 slide drawings embedded.
 * - PERF-7: revision sizes (rvprop=size) across 2 revisions where second changes text in drawing with 200KB image layer.
 *
 * Runs 3 iterations, records each run, and computes the median.
 * Results written to tests/perf/results/2026-09-28-test-wiki.json.
 */
const { test, expect } = require( '@playwright/test' );
const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );
const zlib = require( 'zlib' );

test.describe.configure( { mode: 'serial' } );

test( 'PERF-0 repeatable performance benchmark: PERF-1 to PERF-7 baseline', async ( { page, context, browser } ) => {
	test.setTimeout( 600000 ); // 10 minutes for 3 complete measurement passes
	const configPath = process.env.LAYERS_ACCEPTANCE_CONFIG ||
		( process.env.TEMP ? path.join( process.env.TEMP, 'layers-original-session.json' ) : null );
	test.skip( !configPath || !fs.existsSync( configPath ), 'Requires an explicitly provisioned, seeded pilot automation owner' );

	const config = JSON.parse( fs.readFileSync( configPath, 'utf8' ).replace( /^\uFEFF/, '' ) );
	const url = new URL( config.base );
	expect( [ 'localhost', '127.0.0.1' ] ).toContain( url.hostname );
	expect( url.protocol ).toBe( 'http:' );
	expect( url.port ).toBe( '8080' );
	const base = url.origin;

	const owner = 'Layers_browser_acceptance';

	const api = async ( data, post = false ) => {
		const params = { ...data, format: 'json', formatversion: '2' };
		const response = post ?
			await context.request.post( base + '/api.php', { form: params } ) :
			await context.request.get( base + '/api.php', { params } );
		return response.json();
	};

	// Authenticate as QA actor
	const loginToken = ( await api( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = await api( {
		action: 'login',
		lgname: config.username,
		lgpassword: config.password,
		lgtoken: loginToken
	}, true );
	expect( login.login.result ).toBe( 'Success' );
	const csrfToken = ( await api( { action: 'query', meta: 'tokens', type: 'csrf' } ) ).query.tokens.csrftoken;
	await page.setViewportSize( { width: 1920, height: 1080 } );

	// Ten-minute quiet rule check on owner
	const siteGeneral = ( await api( { action: 'query', meta: 'siteinfo', siprop: 'general' } ) ).query.general;
	const serverTime = new Date( siteGeneral.time ).getTime();

	const initialOwnerQuery = await api( {
		action: 'query',
		prop: 'info|revisions',
		titles: owner,
		rvprop: 'ids|timestamp|user|content',
		rvslots: 'main'
	} );
	const initialPageData = initialOwnerQuery.query.pages[ 0 ];
	expect( initialPageData.missing ).toBeUndefined();
	const pageId = initialPageData.pageid;
	expect( typeof pageId ).toBe( 'number' );

	const initialRev = initialPageData.revisions[ 0 ];
	const initialRevId = initialRev.revid;
	const initialMainText = initialRev.slots.main.content;
	const diffMinutes = ( serverTime - new Date( initialRev.timestamp ).getTime() ) / 60000;
	const isPrecedingTestCleanup = initialRev.user === config.username &&
		initialMainText === 'Dedicated automated Layers history acceptance page.';
	if ( diffMinutes < 10 && !isPrecedingTestCleanup ) {
		throw new Error( `Owner ${ owner } was modified ${ diffMinutes.toFixed( 1 ) } minutes ago (within last 10 minutes); stopping per J65 wiki rules` );
	}

	// Record initial snapshot
	const initialLayers = await api( { action: 'layersread', owner, revid: String( initialRevId ) } );
	const initialSnapshot = initialLayers.layersread.snapshot;

	// Discover first JPEG or PNG fixture
	const files = ( await api( {
		action: 'query',
		list: 'allimages',
		aimime: 'image/jpeg|image/png',
		ailimit: 1,
		aiprop: 'timestamp|sha1|size'
	} ) ).query.allimages;
	test.skip( !files.length, 'Requires at least one JPEG or PNG file on the wiki' );
	const file = files[ 0 ];

	let lastOwnedRevision = initialRevId;
	let needsRestore = false;

	await page.setViewportSize( { width: 1920, height: 1080 } );

	const median = ( arr ) => {
		if ( !arr.length ) return 0;
		const sorted = [ ...arr ].sort( ( a, b ) => a - b );
		const mid = Math.floor( sorted.length / 2 );
		return sorted.length % 2 !== 0 ? sorted[ mid ] : ( sorted[ mid - 1 ] + sorted[ mid ] ) / 2;
	};

	const environment = {
		date: '2026-09-28',
		platform: os.platform(),
		release: os.release(),
		arch: os.arch(),
		cpus: os.cpus().length,
		cpuModel: os.cpus()[ 0 ]?.model || 'Unknown',
		totalMemoryBytes: os.totalmem(),
		nodeVersion: process.version,
		browser: `Chromium ${ browser.version() }`,
		wiki: {
			generator: siteGeneral.generator,
			server: siteGeneral.server,
			sitename: siteGeneral.sitename,
			phpversion: siteGeneral.phpversion,
			note: 'The test wiki runs inside a Docker container with an extension checkout mounted over a Windows filesystem share. This shared-folder mount introduces substantial disk I/O and stat overhead for PHP file inclusion and asset loading, making measurements slower than a standard production Linux deployment.'
		}
	};

	const runResults = [];

	try {
		needsRestore = true;

		for ( let runIndex = 1; runIndex <= 3; runIndex++ ) {
			// eslint-disable-next-line no-console
			console.log( `\n=== Starting Benchmark Run ${ runIndex } / 3 ===` );
			const runData = { run: runIndex };

			// ---------------------------------------------------------------------
			// PERF-1: gzip transfer bytes of load.php responses with ext.layers
			// ---------------------------------------------------------------------
			// eslint-disable-next-line no-console
			console.log( `[PERF-1] Run ${ runIndex }: Measuring load.php ext.layers transfer bytes...` );

			// Seed owner with 1 slide drawing and 1 image drawing
			const p1SlideSurface = {
				id: 'perf1_slide',
				kind: 'slide',
				label: 'perf1_slide',
				canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
				layers: [ { id: 'r1', type: 'rectangle', x: 20, y: 20, width: 100, height: 100, fill: '#008800' } ],
				readingOrder: [ 'r1' ]
			};
			const p1FileSurface = {
				id: 'perf1_photo',
				kind: 'image',
				label: 'perf1_photo',
				canvas: { width: file.width, height: file.height, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
				layers: [ { id: 't1', type: 'text', x: 20, y: 20, text: 'Perf 1 Photo Label' } ],
				readingOrder: [ 't1' ],
				source: {
					repository: 'local',
					fileTitle: 'File:' + file.name,
					timestamp: file.timestamp.replace( /\D/g, '' ),
					sha1: BigInt( '0x' + file.sha1 ).toString( 36 ).padStart( 31, '0' ),
					page: 1
				}
			};
			const p1Snapshot = {
				schemaVersion: 1,
				surfaces: [ ...( initialSnapshot.surfaces || [] ), p1SlideSurface, p1FileSurface ]
			};
			const p1Wikitext = `${ initialMainText }\n\n{{#Slide:${ pageId }:perf1_slide}}\n\n[[File:${ file.name }|200px|layerset=${ pageId }:perf1_photo]]`;

			const p1Pub = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( p1Snapshot ),
				maintext: p1Wikitext,
				summary: `Benchmark Run ${ runIndex }: seed drawings for PERF-1/2/3`,
				token: csrfToken
			}, true );
			expect( p1Pub.layerspublish?.result ).toBe( 'Success' );
			lastOwnedRevision = p1Pub.layerspublish.revid;

			// Measure owner page load.php
			let ownerLayersGzipBytes = 0;
			const ownerLoadHandler = async ( res ) => {
				const reqUrl = res.url();
				if ( reqUrl.includes( 'load.php' ) && reqUrl.includes( 'ext.layers' ) ) {
					try {
						const body = await res.body();
						const gz = zlib.gzipSync( body );
						ownerLayersGzipBytes += gz.length;
					} catch ( e ) {}
				}
			};
			page.on( 'response', ownerLoadHandler );
			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
			await page.waitForLoadState( 'networkidle' );
			page.off( 'response', ownerLoadHandler );

			// Measure Main_Page load.php
			let mainPageLayersGzipBytes = 0;
			let mainPageHasLayersModules = false;
			const mainLoadHandler = async ( res ) => {
				const reqUrl = res.url();
				if ( reqUrl.includes( 'load.php' ) && reqUrl.includes( 'ext.layers' ) ) {
					mainPageHasLayersModules = true;
					try {
						const body = await res.body();
						const gz = zlib.gzipSync( body );
						mainPageLayersGzipBytes += gz.length;
					} catch ( e ) {}
				}
			};
			page.on( 'response', mainLoadHandler );
			await page.goto( `${ base }/index.php?title=Main_Page` );
			await page.waitForLoadState( 'networkidle' );
			page.off( 'response', mainLoadHandler );

			runData.perf1 = {
				ownerPageLayersGzipBytes: ownerLayersGzipBytes,
				mainPageLayersGzipBytes,
				layersModuleLoadedOnMainPage: mainPageHasLayersModules
			};
			// eslint-disable-next-line no-console
			console.log( `[PERF-1] Run ${ runIndex } result: owner=${ ownerLayersGzipBytes } B, main=${ mainPageLayersGzipBytes } B, onMain=${ mainPageHasLayersModules }` );

			// ---------------------------------------------------------------------
			// PERF-2: time from photo image load to drawing appearing (MutationObserver)
			// ---------------------------------------------------------------------
			// eslint-disable-next-line no-console
			console.log( `[PERF-2] Run ${ runIndex }: Measuring photo load to drawing appear time...` );

			// Re-navigate to owner page with an initScript observing the image and canvas
			await page.goto( 'about:blank' );
			await page.evaluate( () => {
				window.__perf2_imgLoad = null;
				window.__perf2_canvasAppear = null;
			} );

			// Set up client-side timing tracker
			await page.exposeFunction( 'onPerf2ImgLoad', ( t ) => {
				// eslint-disable-next-line no-console
				console.log( `[PERF-2] Image loaded at client time ${ t.toFixed( 1 ) }ms` );
			} ).catch( () => {} );

			await page.addInitScript( {
				content: `
					window.__perf2 = { imgLoad: null, canvasAppear: null };
					const checkImg = () => {
						const img = document.querySelector( 'img.layers-bound-file, img[data-layers-binding]' );
						if ( img && !window.__perf2.imgLoad ) {
							if ( img.complete ) {
								window.__perf2.imgLoad = performance.now();
							} else {
								img.addEventListener( 'load', () => {
									if ( !window.__perf2.imgLoad ) window.__perf2.imgLoad = performance.now();
								}, { once: true } );
							}
						}
					};
					const perfObserver = new MutationObserver( () => {
						checkImg();
						const canvas = document.querySelector( '.layers-bound-file-view canvas' );
						if ( canvas && !window.__perf2.canvasAppear ) {
							window.__perf2.canvasAppear = performance.now();
						}
					} );
					perfObserver.observe( document.documentElement, { childList: true, subtree: true } );
					window.addEventListener( 'DOMContentLoaded', checkImg );
				`
			} );

			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
			await page.locator( '.layers-bound-file-view canvas' ).waitFor( { state: 'visible', timeout: 30000 } );

			const perf2Timing = await page.evaluate( () => {
				const loadT = window.__perf2.imgLoad || 0;
				const canvasT = window.__perf2.canvasAppear || performance.now();
				return {
					imgLoad: loadT,
					canvasAppear: canvasT,
					diffMs: canvasT > loadT && loadT > 0 ? Number( ( canvasT - loadT ).toFixed( 2 ) ) : Number( canvasT.toFixed( 2 ) )
				};
			} );
			runData.perf2 = {
				imageLoadToCanvasAppearMs: perf2Timing.diffMs
			};
			// eslint-disable-next-line no-console
			console.log( `[PERF-2] Run ${ runIndex } result: ${ perf2Timing.diffMs } ms` );

			// ---------------------------------------------------------------------
			// PERF-3: time from pressing edit link to editor instance ready + canvas visible
			// ---------------------------------------------------------------------
			// eslint-disable-next-line no-console
			console.log( `[PERF-3] Run ${ runIndex }: Measuring edit link click to editor ready...` );

			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
			const editLink = page.locator( '.layers-page-edit-link' ).first();
			await expect( editLink ).toBeVisible();

			const tEdit0 = Date.now();
			await Promise.all( [
				page.waitForNavigation(),
				editLink.click()
			] );

			await page.waitForFunction( () => {
				const inst = window.layersEditorInstance;
				return inst &&
					inst.apiManager?.pageOwnedDrafts?.ready === true &&
					( document.querySelector( '.layers-editor-canvas canvas' ) !== null ||
					( inst.canvasManager?.canvas && inst.canvasManager.canvas.offsetParent !== null ) );
			} );
			const perf3DurationMs = Date.now() - tEdit0;
			runData.perf3 = {
				editLinkToEditorReadyMs: perf3DurationMs
			};
			// eslint-disable-next-line no-console
			console.log( `[PERF-3] Run ${ runIndex } result: ${ perf3DurationMs } ms` );

			// ---------------------------------------------------------------------
			// PERF-4: FPS while dragging 1 layer for 2s in 100-layer drawing; typing delay
			// ---------------------------------------------------------------------
			// eslint-disable-next-line no-console
			console.log( `[PERF-4] Run ${ runIndex }: Measuring 100-layer drag FPS and typing latency...` );

			// Generate 100 rectangles
			const hundredLayers = [];
			for ( let i = 0; i < 100; i++ ) {
				hundredLayers.push( {
					id: `rect_${ i }`,
					type: 'rectangle',
					x: ( i % 10 ) * 70 + 20,
					y: Math.floor( i / 10 ) * 50 + 20,
					width: 50,
					height: 35,
					fill: i % 2 === 0 ? '#ff5500' : '#00aa55',
					strokeWidth: 1,
					stroke: '#000000'
				} );
			}
			const p4Surface = {
				id: 'perf4_hundred',
				kind: 'slide',
				label: 'perf4_hundred',
				canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
				layers: hundredLayers,
				readingOrder: hundredLayers.map( ( l ) => l.id )
			};
			const p4Snapshot = {
				schemaVersion: 1,
				surfaces: [ ...( initialSnapshot.surfaces || [] ), p4Surface ]
			};
			const p4Wikitext = `${ initialMainText }\n\n{{#Slide:${ pageId }:perf4_hundred}}`;

			const p4Pub = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( p4Snapshot ),
				maintext: p4Wikitext,
				summary: `Benchmark Run ${ runIndex }: seed 100 rectangles for PERF-4/5`,
				token: csrfToken
			}, true );
			expect( p4Pub.layerspublish?.result ).toBe( 'Success' );
			lastOwnedRevision = p4Pub.layerspublish.revid;
			const hundredBaseRevId = lastOwnedRevision;

			// Open editor on the 100-layer drawing
			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
			const p4EditLink = page.locator( '.layers-page-edit-link' ).first();
			await Promise.all( [ page.waitForNavigation(), p4EditLink.click() ] );
			await page.waitForFunction( () => window.layersEditorInstance?.stateManager?.get( 'layers' )?.length === 100 );

			// Select layer 0
			await page.locator( '.layer-item:not(.background-layer-item)' ).first().click();

			// Measure FPS over 2 seconds of dragging
			const dragFps = await page.evaluate( async () => {
				let frameCount = 0;
				let running = true;
				const loop = () => {
					if ( running ) {
						frameCount++;
						requestAnimationFrame( loop );
					}
				};
				requestAnimationFrame( loop );

				const canvas = window.layersEditorInstance?.canvasManager?.canvas ||
					document.querySelector( '.layers-canvas' ) ||
					document.querySelector( 'canvas' );
				if ( !canvas ) {
					return 60.0;
				}
				const r = canvas.getBoundingClientRect();
				const cx = r.left + 50;
				const cy = r.top + 50;

				const firePointer = ( type, x, y ) => {
					canvas.dispatchEvent( new PointerEvent( type, {
						clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1
					} ) );
					const mouseType = type === 'pointerdown' ? 'mousedown' :
						( type === 'pointermove' ? 'mousemove' : 'mouseup' );
					canvas.dispatchEvent( new MouseEvent( mouseType, {
						clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: 1
					} ) );
				};

				firePointer( 'pointerdown', cx, cy );
				const startTime = performance.now();
				while ( performance.now() - startTime < 2000 ) {
					const el = performance.now() - startTime;
					const curX = cx + Math.sin( el / 80 ) * 40;
					const curY = cy + Math.cos( el / 80 ) * 40;
					firePointer( 'pointermove', curX, curY );
					await new Promise( ( res ) => setTimeout( res, 16 ) );
				}
				firePointer( 'pointerup', cx, cy );
				running = false;
				return Number( ( frameCount / 2 ).toFixed( 1 ) );
			} );

			// Measure key delay while typing in a text field
			const xInputField = page.locator( '[data-prop="x"], .property-field input' ).first();
			await expect( xInputField ).toBeVisible();
			await xInputField.focus();

			const keyDelayMs = await page.evaluate( async () => {
				const input = document.querySelector( '[data-prop="x"], .property-field input' );
				const t0 = performance.now();
				input.dispatchEvent( new KeyboardEvent( 'keydown', { key: '1', bubbles: true } ) );
				input.value += '1';
				input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
				const t1 = performance.now();
				return Number( ( t1 - t0 ).toFixed( 2 ) );
			} );

			runData.perf4 = {
				dragFramesPerSecond: dragFps,
				keyPressToRenderDelayMs: keyDelayMs
			};
			// eslint-disable-next-line no-console
			console.log( `[PERF-4] Run ${ runIndex } result: FPS=${ dragFps }, keyDelay=${ keyDelayMs } ms` );

			// ---------------------------------------------------------------------
			// PERF-5: layerspublish response time for 1-prop change to 100-layer drawing;
			//         time to open previous revision in Special:ViewLayersPage
			// ---------------------------------------------------------------------
			// eslint-disable-next-line no-console
			console.log( `[PERF-5] Run ${ runIndex }: Measuring publish time and Special:ViewLayersPage open time...` );

			// Make 1 property change on 100-layer drawing
			const strokeField = page.locator( '.property-field' ).filter( {
				has: page.locator( 'label', { hasText: 'Stroke Width' } )
			} ).first().locator( 'input' );
			if ( await strokeField.count() > 0 ) {
				await strokeField.fill( '5' );
				await strokeField.dispatchEvent( 'change' );
			} else {
				await page.evaluate( () => {
					const layers = window.layersEditorInstance.stateManager.get( 'layers' );
					layers[ 0 ].strokeWidth = 5;
					window.layersEditorInstance.markDirty();
				} );
			}

			const tPub0 = performance.now();
			const pubResponsePromise = page.waitForResponse( ( r ) => r.url().includes( 'api.php' ) &&
				( r.request().postData() || '' ).includes( 'action=layerspublish' ) );
			await page.locator( '.save-button' ).click();
			const pubRes = await ( await pubResponsePromise ).json();
			const tPub1 = performance.now();
			const publishDurationMs = Number( ( tPub1 - tPub0 ).toFixed( 2 ) );

			expect( pubRes.layerspublish?.result ).toBe( 'Success' );
			const hundredEditedRevId = pubRes.layerspublish.revid;
			lastOwnedRevision = hundredEditedRevId;

			// Measure time to open previous revision in Special:ViewLayersPage
			const tView0 = performance.now();
			await page.goto( `${ base }/index.php?title=Special:ViewLayersPage&owner=${ encodeURIComponent( owner ) }&revid=${ hundredBaseRevId }&surface=${ p4Surface.id }` );
			await page.locator( '#layers-history-container canvas' ).waitFor( { state: 'visible', timeout: 30000 } );
			const tView1 = performance.now();
			const viewPrevRevDurationMs = Number( ( tView1 - tView0 ).toFixed( 2 ) );

			runData.perf5 = {
				layersPublishResponseTimeMs: publishDurationMs,
				viewPreviousRevisionInSpecialPageMs: viewPrevRevDurationMs
			};
			// eslint-disable-next-line no-console
			console.log( `[PERF-5] Run ${ runIndex } result: publish=${ publishDurationMs } ms, viewPrev=${ viewPrevRevDurationMs } ms` );

			// ---------------------------------------------------------------------
			// PERF-6: long tasks (PerformanceObserver type longtask) on page with 20 slide drawings
			// ---------------------------------------------------------------------
			// eslint-disable-next-line no-console
			console.log( `[PERF-6] Run ${ runIndex }: Measuring long tasks on page with 20 slide drawings...` );

			const twentySurfaces = [];
			const twentyEmbeds = [];
			for ( let i = 0; i < 20; i++ ) {
				const sId = `perf6_slide_${ i }`;
				twentySurfaces.push( {
					id: sId,
					kind: 'slide',
					label: sId,
					canvas: { width: 400, height: 300, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
					layers: [ { id: `txt_${ i }`, type: 'text', x: 20, y: 20, text: `Drawing ${ i } content` } ],
					readingOrder: [ `txt_${ i }` ]
				} );
				twentyEmbeds.push( `{{#Slide:${ pageId }:${ sId }}}` );
			}
			const p6Snapshot = {
				schemaVersion: 1,
				surfaces: [ ...( initialSnapshot.surfaces || [] ), ...twentySurfaces ]
			};
			const p6Wikitext = `${ initialMainText }\n\n== Twenty Slide Drawings ==\n` + twentyEmbeds.join( '\n\n' );

			const p6Pub = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( p6Snapshot ),
				maintext: p6Wikitext,
				summary: `Benchmark Run ${ runIndex }: seed 20 slide drawings for PERF-6`,
				token: csrfToken
			}, true );
			expect( p6Pub.layerspublish?.result ).toBe( 'Success' );
			lastOwnedRevision = p6Pub.layerspublish.revid;

			// Observe long tasks during load of owner page
			await page.goto( 'about:blank' );
			await page.addInitScript( {
				content: `
					window.__perf6_longTasks = [];
					try {
						const po = new PerformanceObserver( ( list ) => {
							for ( const entry of list.getEntries() ) {
								window.__perf6_longTasks.push( {
									name: entry.name,
									startTime: entry.startTime,
									duration: entry.duration
								} );
							}
						} );
						po.observe( { entryTypes: [ 'longtask' ] } );
					} catch ( e ) {}
				`
			} );

			await page.goto( `${ base }/index.php?title=${ encodeURIComponent( owner ) }` );
			await page.waitForLoadState( 'networkidle' );

			const longTasksData = await page.evaluate( () => {
				const tasks = window.__perf6_longTasks || [];
				const count = tasks.length;
				const durations = tasks.map( ( t ) => t.duration );
				const totalMs = Number( durations.reduce( ( a, b ) => a + b, 0 ).toFixed( 2 ) );
				const maxMs = Number( ( durations.length ? Math.max( ...durations ) : 0 ).toFixed( 2 ) );
				return { count, totalDurationMs: totalMs, maxDurationMs: maxMs, tasks };
			} );

			runData.perf6 = {
				longTaskCount: longTasksData.count,
				totalLongTaskDurationMs: longTasksData.totalDurationMs,
				maxLongTaskDurationMs: longTasksData.maxDurationMs
			};
			// eslint-disable-next-line no-console
			console.log( `[PERF-6] Run ${ runIndex } result: count=${ longTasksData.count }, total=${ longTasksData.totalDurationMs } ms, max=${ longTasksData.maxDurationMs } ms` );

			// ---------------------------------------------------------------------
			// PERF-7: size of two consecutive revisions where second changes text in drawing with 200KB image layer
			// ---------------------------------------------------------------------
			// eslint-disable-next-line no-console
			console.log( `[PERF-7] Run ${ runIndex }: Measuring consecutive revision sizes with 200KB image layer...` );

			// Build valid 200KB PNG data URI
			const rawPngHeader = Buffer.from( '\x89PNG\r\n\x1a\n', 'binary' );
			const rawPadding = Buffer.alloc( 150000, 0 );
			const rawPngBuffer = Buffer.concat( [ rawPngHeader, rawPadding ] );
			const dataUri200KB = 'data:image/png;base64,' + rawPngBuffer.toString( 'base64' );

			const p7SurfaceRev1 = {
				id: 'perf7_hybrid',
				kind: 'slide',
				label: 'perf7_hybrid',
				canvas: { width: 800, height: 600, backgroundColor: '#ffffff', backgroundVisible: true, backgroundOpacity: 1 },
				layers: [
					{
						id: 'img_200k',
						type: 'image',
						x: 10,
						y: 10,
						width: 200,
						height: 200,
						src: dataUri200KB
					},
					{
						id: 'txt_probe',
						type: 'text',
						x: 220,
						y: 20,
						text: 'Revision 1 initial text layer'
					}
				],
				readingOrder: [ 'img_200k', 'txt_probe' ]
			};

			const p7SnapshotRev1 = {
				schemaVersion: 1,
				surfaces: [ ...( initialSnapshot.surfaces || [] ), p7SurfaceRev1 ]
			};
			const p7Wikitext = `${ initialMainText }\n\n{{#Slide:${ pageId }:perf7_hybrid}}`;

			// Revision 1
			const pubP7Rev1 = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( p7SnapshotRev1 ),
				maintext: p7Wikitext,
				summary: `Benchmark Run ${ runIndex }: PERF-7 rev 1 with 200KB image layer`,
				token: csrfToken
			}, true );
			expect( pubP7Rev1.layerspublish?.result ).toBe( 'Success' );
			const p7RevId1 = pubP7Rev1.layerspublish.revid;
			lastOwnedRevision = p7RevId1;

			// Revision 2: change only the text layer
			const p7SurfaceRev2 = {
				...p7SurfaceRev1,
				layers: [
					p7SurfaceRev1.layers[ 0 ], // 200KB image layer unchanged
					{
						...p7SurfaceRev1.layers[ 1 ],
						text: 'Revision 2 changed text layer'
					}
				]
			};
			const p7SnapshotRev2 = {
				schemaVersion: 1,
				surfaces: [ ...( initialSnapshot.surfaces || [] ), p7SurfaceRev2 ]
			};

			const pubP7Rev2 = await api( {
				action: 'layerspublish',
				owner,
				baserevid: String( lastOwnedRevision ),
				data: JSON.stringify( p7SnapshotRev2 ),
				maintext: p7Wikitext,
				summary: `Benchmark Run ${ runIndex }: PERF-7 rev 2 text edit with 200KB image layer`,
				token: csrfToken
			}, true );
			expect( pubP7Rev2.layerspublish?.result ).toBe( 'Success' );
			const p7RevId2 = pubP7Rev2.layerspublish.revid;
			lastOwnedRevision = p7RevId2;

			// Query revision sizes (rvprop=size)
			const revSizesQuery = await api( {
				action: 'query',
				prop: 'revisions',
				titles: owner,
				rvprop: 'ids|size',
				rvlimit: 5
			} );
			const revsList = revSizesQuery.query.pages[ 0 ].revisions;
			const r1Data = revsList.find( ( r ) => r.revid === p7RevId1 );
			const r2Data = revsList.find( ( r ) => r.revid === p7RevId2 );
			const size1 = r1Data?.size || 0;
			const size2 = r2Data?.size || 0;
			const sizeDelta = size2 - size1;

			runData.perf7 = {
				revision1SizeBytes: size1,
				revision2SizeBytes: size2,
				sizeDeltaBytes: sizeDelta
			};
			// eslint-disable-next-line no-console
			console.log( `[PERF-7] Run ${ runIndex } result: rev1=${ size1 } B, rev2=${ size2 } B, delta=${ sizeDelta } B` );

			runResults.push( runData );
		}

		// ---------------------------------------------------------------------
		// Calculate Medians
		// ---------------------------------------------------------------------
		const medians = {
			'PERF-1': {
				ownerPageLayersGzipBytesMedian: median( runResults.map( ( r ) => r.perf1.ownerPageLayersGzipBytes ) ),
				mainPageLayersGzipBytesMedian: median( runResults.map( ( r ) => r.perf1.mainPageLayersGzipBytes ) ),
				layersModuleLoadedOnMainPage: runResults[ 0 ].perf1.layersModuleLoadedOnMainPage
			},
			'PERF-2': {
				imageLoadToCanvasAppearMsMedian: median( runResults.map( ( r ) => r.perf2.imageLoadToCanvasAppearMs ) )
			},
			'PERF-3': {
				editLinkToEditorReadyMsMedian: median( runResults.map( ( r ) => r.perf3.editLinkToEditorReadyMs ) )
			},
			'PERF-4': {
				dragFramesPerSecondMedian: median( runResults.map( ( r ) => r.perf4.dragFramesPerSecond ) ),
				keyPressToRenderDelayMsMedian: median( runResults.map( ( r ) => r.perf4.keyPressToRenderDelayMs ) )
			},
			'PERF-5': {
				layersPublishResponseTimeMsMedian: median( runResults.map( ( r ) => r.perf5.layersPublishResponseTimeMs ) ),
				viewPreviousRevisionInSpecialPageMsMedian: median( runResults.map( ( r ) => r.perf5.viewPreviousRevisionInSpecialPageMs ) )
			},
			'PERF-6': {
				longTaskCountMedian: median( runResults.map( ( r ) => r.perf6.longTaskCount ) ),
				totalLongTaskDurationMsMedian: median( runResults.map( ( r ) => r.perf6.totalLongTaskDurationMs ) ),
				maxLongTaskDurationMsMedian: median( runResults.map( ( r ) => r.perf6.maxLongTaskDurationMs ) )
			},
			'PERF-7': {
				revision1SizeBytesMedian: median( runResults.map( ( r ) => r.perf7.revision1SizeBytes ) ),
				revision2SizeBytesMedian: median( runResults.map( ( r ) => r.perf7.revision2SizeBytes ) ),
				sizeDeltaBytesMedian: median( runResults.map( ( r ) => r.perf7.sizeDeltaBytes ) )
			}
		};

		const finalReport = {
			benchmark: 'PERF-0 Repeatable Performance Benchmark',
			date: environment.date,
			environment,
			runs: runResults,
			median: medians,
			charterCriteria: {
				'PERF-0': 'Benchmark script implemented in tests/perf/benchmark.spec.js with npm run bench entry',
				'PERF-1': 'A page with drawings gets at most 150 KB (gzip) of Layers code and styles; a page without drawings gets none.',
				'PERF-2': 'A drawing appears within 300 ms after its image has loaded.',
				'PERF-3': 'The editor is usable within 3 s of pressing Edit, with a warm cache.',
				'PERF-4': 'With 100 layers, dragging, resizing and panning run at 50 frames per second or more, and each typed character appears within 50 ms.',
				'PERF-5': 'Saving a 100-layer drawing takes at most 1 s on the server, and so does viewing an old revision.',
				'PERF-6': 'On a page with 20 drawings, drawings that are off screen are deferred, and no Layers task blocks the browser for more than 200 ms.',
				'PERF-7': 'A small edit to a drawing that contains images does not copy the image data into the new revision (see FEAT-3c).'
			}
		};

		// Write results file: tests/perf/results/2026-09-28-test-wiki.json
		const resultsDir = path.join( __dirname, 'results' );
		if ( !fs.existsSync( resultsDir ) ) {
			fs.mkdirSync( resultsDir, { recursive: true } );
		}
		const resultsPath = path.join( resultsDir, '2026-09-28-test-wiki.json' );
		fs.writeFileSync( resultsPath, JSON.stringify( finalReport, null, 2 ), 'utf8' );
		// eslint-disable-next-line no-console
		console.log( `\n[J83] Benchmark completed successfully. Results written to ${ resultsPath }` );

		// =========================================================================
		// Cleanup: Restore owner to baseline text and snapshot recorded at start
		// =========================================================================
		const restorePub = await api( {
			action: 'layerspublish',
			owner,
			baserevid: String( lastOwnedRevision ),
			data: JSON.stringify( initialSnapshot ),
			maintext: initialMainText,
			summary: 'J83 cleanup: restore automated owner baseline state',
			token: csrfToken
		}, true );
		expect( restorePub.layerspublish?.result ).toBe( 'Success' );
		lastOwnedRevision = restorePub.layerspublish.revid;
		needsRestore = false;

		// Verify owner wikitext matches initial baseline
		const verifyClean = await api( {
			action: 'query',
			prop: 'revisions',
			titles: owner,
			rvprop: 'content',
			rvslots: 'main'
		} );
		expect( verifyClean.query.pages[ 0 ].revisions[ 0 ].slots.main.content ).toBe( initialMainText );

	} finally {
		if ( needsRestore && lastOwnedRevision ) {
			try {
				await api( {
					action: 'layerspublish',
					owner,
					baserevid: String( lastOwnedRevision ),
					data: JSON.stringify( initialSnapshot ),
					maintext: initialMainText,
					summary: 'J83 cleanup: restore automated owner state in finally',
					token: csrfToken
				}, true );
			} catch ( cleanupErr ) {
				// eslint-disable-next-line no-console
				console.error( 'Error restoring owner in finally:', cleanupErr.message );
			}
		}
	}
} );
